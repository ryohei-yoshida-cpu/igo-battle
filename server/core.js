/* 囲碁BLITZ — サーバーの中心（Cloudflare でも、手元の Node でも同じものを使う）
 *
 * ファイルの分けかた（server/）
 *   core.js     … ここ。接続・送りすぎ対策・メッセージのふりわけ・アカウントの順番待ち（withAcct）
 *   account.js  … アカウントを作る・入る・保存・削除
 *   match.js    … 対局（出会わせる・手と時計の中継・ルールの確認・整地・レート反映）
 *   gorules.js  … 囲碁のルール（打てる点・取る・コウ・地の数え方）
 *   rating.js   … レート・段級位・昇格のごほうび
 *   econ.js     … 銭・勾玉・持ち物・部屋・プレゼント・お店（サーバーが正）
 *   prices.js   … 家具・床・壁の値段
 *   social.js / guild.js / mail.js / admin.js … 交流・碁会所・メッセージ・運営
 *   ng.js / age.js … 使えない言葉・年齢
 *
 * 時計・盤面・勝ち負け・銭はサーバーが正（アプリから送られてきた数字は、確かめてから使う）。
 *
 * やりとり（JSON）
 *   アプリ → サーバー
 *     hello  { cid, name, rating, ava }   … 接続したら最初に送る。cid は端末ごとの固定ID
 *     seek   {}                           … 対戦相手を探す
 *     cancel {}                           … 探すのをやめる
 *     move   { g, n, p }                  … n手目に p（-1 はパス）
 *     resign { g }
 *     score  { g, res }                   … 2回パスのあと、整地の結果（黒番のアプリが送る）
 *     decline{ g }                        … マッチした瞬間にBot戦へ移っていたなど、始める前に取り消す
 *     ping   {}
 *     register {}                          … アカウントを新しく作る（初めて開いたとき）
 *     login    { id, pass, restore }       … アカウントで入る（restore: 別の端末から引き継ぐ）
 *     sync     { data, at }                … 保存データ（名前・レート・戦績・進み具合）をサーバーへ
 *     fhost    { hc }                      … フレンドマッチの部屋をつくる（hc = ハンデ）
 *     fjoin    { code }                    … 合言葉（4けた）で部屋に入る
 *     fcancel  {}                          … 部屋を閉じる
 *     rematch  { g }                       … フレンド戦のあと「もう一局」
 *   サーバー → アプリ
 *     lobby  { online, seeking }
 *     start  { g, color, opp, clock, moves }
 *     resume { g, color, opp, clock, toPlay, moves, oppAway }
 *     move   { g, n, p, c, clock }
 *     away   { g, until }  / back { g }   … 相手の通信が切れた／戻った
 *     end    { g, winner, reason, res }   … winner: 1黒 2白 0持碁
 *     aborted{ g }                        … 始まる前に取り消された（探し直す）
 *     pong   { now }
 *     account  { id, pass?, data, at, restore }   … 入れた（pass は作ったときだけ）
 *     authfail { restore }                 … IDかパスワードがちがう
 *     synced   { at }
 *     froom    { code, hc }                … 部屋ができた（合言葉）
 *     fnone    {}                          … その合言葉の部屋はない
 *     rematch  { g }                       … 相手が「もう一局」を希望している
 *   start / resume には、フレンド戦なら hc { h, black, min, komi } がつく
 *     h: 0 互先 / 1 定先 / 2〜5 置き石の数   black: 'host' | 'guest' | 'random'   min: 持ち時間（分）
 *
 * アカウントの保存先は store（Cloudflare では Durable Object のストレージ、手元ではメモリ）。
 */
import { Social } from './social.js';
import { Guild } from './guild.js';
import { Mail } from './mail.js';
import { Admin } from './admin.js';
import { AccountMethods } from './account.js';
import { EconMethods, ECON } from './econ.js';
import { MatchMethods } from './match.js';
import '../common/avatar-art.js';

export const normCode = v => String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
export function memStore() { const m = new Map(); return { get: async k => m.get(k), put: async (k, v) => { m.set(k, v); }, del: async k => { m.delete(k); } }; }

export class Core {
  constructor(opts = {}) {
    this.now = opts.now || (() => Date.now());
    this.rand = opts.rand || Math.random;   // 半額・骨董屋のおくりもの（試すときに差しかえられる）
    this.setTimeout = opts.setTimeout || ((f, ms) => setTimeout(f, ms));
    this.clearTimeout = opts.clearTimeout || (t => clearTimeout(t));
    this.players = new Map();   // cid → { cid, name, rating, ava, sock, seekAt, game }
    this.socks = new Map();     // sock → cid
    this.games = new Map();     // g → game
    this.seq = 0;
    this.store = opts.store || memStore();
    this.sockInfo = new Map();  // sock → { acct }
    this.rooms = new Map();     // 合言葉 → { code, host, hc, at }  フレンドマッチの部屋
    this.guild = new Guild(this);   // 碁会所（ギルド）
    this.social = new Social(this);   // マイルームのつながり（日記・チャット・フレンド・ブロック。全ゲーム共通）
    this.mail = new Mail(this);       // メッセージ（全ゲーム共通）
    this.admin = new Admin(this);     // 運営の画面
    this.adminKey = opts.adminKey || '';   // 運営の合言葉（Cloudflare の秘密の設定 ADMIN_KEY）。なければ運営画面は開かない
  }

  /* ---------- 接続 ---------- */
  /* 使いすぎ・いたずら対策（クラウド破産の防止）
   *   ・1つの接続：送れるのは平均 1秒に2通まで（まとめて30通まで）。ひどく超えたら切る
   *   ・同じIP：同時に8接続まで、アカウント作成は1時間に5回まで
   */
  connect(sock, ip) {
    ip = String(ip || '');
    this.ipConns = this.ipConns || new Map();
    const n = (this.ipConns.get(ip) || 0) + 1;
    if (ip && n > LIMIT.connPerIp) { try { sock.close(); } catch (e) {} return { message() {}, close() {} }; }
    if (ip) this.ipConns.set(ip, n);
    const bucket = { tokens: LIMIT.burst, at: this.now(), drops: 0 };
    let closed = false;
    return {
      message: raw => {
        const now = this.now();
        bucket.tokens = Math.min(LIMIT.burst, bucket.tokens + (now - bucket.at) / 1000 * LIMIT.perSec); bucket.at = now;
        if (bucket.tokens < 1) { if (++bucket.drops > LIMIT.dropsToClose) { try { sock.close(); } catch (e) {} } return; }
        bucket.tokens -= 1;
        try { const r = this.onMessage(sock, raw, ip); if (r && r.catch) r.catch(() => {}); } catch (e) { /* 壊れたメッセージは無視 */ }
      },
      close: () => {
        if (closed) return; closed = true;
        if (ip) { const c = (this.ipConns.get(ip) || 1) - 1; if (c > 0) this.ipConns.set(ip, c); else this.ipConns.delete(ip); }
        this.onClose(sock);
      }
    };
  }
  send(cid, msg) {
    const pl = this.players.get(cid);
    if (pl && pl.sock) { try { pl.sock.send(JSON.stringify(msg)); } catch (e) {} }
  }
  // 人数のお知らせは、まとめて2秒に1回まで（出入りのたびに全員へ送らない）
  lobby() {
    if (this.lobbyT) return;
    this.lobbyT = this.setTimeout(() => { this.lobbyT = null; this.lobbyNow(); }, 2000);
  }
  lobbyNow() {
    let online = 0, seeking = 0;
    for (const p of this.players.values()) { if (p.sock) online++; if (p.seekAt) seeking++; }
    const msg = { t: 'lobby', online, seeking };
    for (const p of this.players.values()) if (p.sock) this.send(p.cid, msg);
  }

  onMessage(sock, raw, ip) {
    if (typeof raw !== 'string' || raw.length > LIMIT.syncBytes) return;
    const m = JSON.parse(raw);
    if (m.t === 'register' || m.t === 'login' || m.t === 'sync') return this.account(sock, m, ip);
    if (m.t === 'delacct') return this.deleteAcct(sock, m);
    if (ECON.includes(m.t)) return this.econ(sock, m);
    if (raw.length > 4000) return;
    if (m.t === 'soc') { const info = this.sockInfo.get(sock); return info && this.social.handle(sock, info, m); }
    if (m.t === 'mail' || m.t === 'admin') { const info = this.sockInfo.get(sock); return info && this[m.t].handle(sock, info, m).catch(e => console.error(m.t, e)); }
    if (m.t === 'guild') { const info = this.sockInfo.get(sock); return info && this.guild.handle(sock, info, m).catch(e => console.error('guild', e)); }
    if (m.t === 'hello') return this.hello(sock, m);
    const cid = this.socks.get(sock); if (!cid) return;
    const pl = this.players.get(cid);
    switch (m.t) {
      case 'ping': sock.send(JSON.stringify({ t: 'pong', now: this.now() })); break;
      case 'fhost': this.fhost(pl, m); break;
      case 'fjoin': this.fjoin(pl, m); break;
      case 'fcancel': this.closeRoom(pl); break;
      case 'rematch': this.rematch(pl, m); break;
      case 'seek': if (!pl.game) { this.closeRoom(pl); pl.size = m.size === 13 ? 13 : 9; { const k = 'go' + pl.size; pl.rating = pl.rates && pl.rates[k] ? pl.rates[k] : m.rating ? Math.max(0, Math.min(4000, m.rating | 0)) : pl.rating; } pl.seekAt = pl.seekAt || this.now() || 1; this.match(); this.lobby(); } break;
      case 'cancel': pl.seekAt = 0; this.lobby(); break;
      case 'move': this.move(pl, m); break;
      case 'resign': { const g = this.gameOf(pl, m.g); if (g && !g.over) this.finish(g, 3 - g.colorOf[pl.cid], '中押し'); break; }
      case 'score': { const g = this.gameOf(pl, m.g); if (g && g.scoring && !g.over) this.scoreIn(g, g.colorOf[pl.cid], m.res); break; }
      case 'decline': { const g = this.gameOf(pl, m.g); if (g && !g.over && g.moves.length === 0) this.abort(g); break; }
    }
  }

  hello(sock, m) {
    const cid = String(m.cid || '').slice(0, 40);
    if (!cid) return;
    const old = this.players.get(cid);
    if (old && old.sock && old.sock !== sock) { this.socks.delete(old.sock); try { old.sock.close(); } catch (e) {} }
    const pl = old || { cid, seekAt: 0, game: null };
    pl.name = String(m.name || 'プレイヤー').slice(0, 12);
    const si = this.sockInfo.get(sock); if (si && si.acct) { pl.acct = si.acct; pl.pid = si.pid || pl.pid; pl.av = si.av || pl.av; pl.rates = si.rates || pl.rates; }
    pl.rating = pl.rates && pl.rates.go9 ? pl.rates.go9 : Math.max(0, Math.min(4000, m.rating | 0));   // アカウントがあれば、サーバーのレート
    pl.ava = Math.max(0, Math.min(20, m.ava | 0));
    pl.sock = sock;
    this.players.set(cid, pl); this.socks.set(sock, cid);
    // 対局の途中で切れていた → 再開
    const g = pl.game && this.games.get(pl.game);
    if (g && !g.over) {
      const c = g.colorOf[cid];
      if (g.away[c]) { this.clearTimeout(g.away[c].timer); g.away[c] = null; this.send(g.players[3 - c], { t: 'back', g: g.id }); }
      this.send(cid, { t: 'resume', g: g.id, color: c, opp: this.pub(g.players[3 - c]), clock: this.clocks(g), toPlay: g.toPlay, moves: g.moves, oppAway: !!g.away[3 - c], scoring: g.scoring, hc: g.hc || undefined, size: g.size || 9 });
    } else if (g && g.over) {
      if (!g.acked[cid]) { this.send(cid, g.endMsg); g.acked[cid] = true; }
      pl.game = null;
    } else if (pl.game && !g) pl.game = null;
    this.lobby();
  }

  // 連投の禁止：kind ごとに、その人が最後に書いた時刻。あと何秒待つか（0ならOK）
  waitFor(kind, id, gap) { this.lastAt = this.lastAt || new Map(); const t = this.lastAt.get(kind + ':' + id) || 0, left = gap - (this.now() - t); return left > 0 ? Math.ceil(left / 1000) : 0; }
  stamp(kind, id) { this.lastAt = this.lastAt || new Map(); this.lastAt.set(kind + ':' + id, this.now()); if (this.lastAt.size > 20000) this.lastAt.delete(this.lastAt.keys().next().value); }
  withAcct(id, fn) {
    this.locks = this.locks || new Map();
    const prev = this.locks.get(id) || Promise.resolve();
    const run = prev.then(async () => {
      const rec = await this.store.get('acct:' + id); if (!rec) return null;
      const r = await fn(rec);
      if (r !== false) await this.store.put('acct:' + id, rec);
      return r === false ? false : rec;
    });
    this.locks.set(id, run.catch(() => {}));
    return run;
  }
}

/* ---------- 使いすぎ対策の数字 ---------- */
export const LIMIT = { perSec: 2, burst: 30, dropsToClose: 60, connPerIp: 8, registersPerHour: 5, loginFailsPerHour: 30, syncBytes: 100000 };

// 役割ごとのファイルに分けたやりとりを、Core に足す
for (const M of [AccountMethods, EconMethods, MatchMethods])
  for (const k of Object.getOwnPropertyNames(M.prototype)) if (k !== 'constructor') Object.defineProperty(Core.prototype, k, Object.getOwnPropertyDescriptor(M.prototype, k));
