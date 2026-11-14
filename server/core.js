/* 囲碁BLITZ — 対人戦サーバーの中身（Cloudflare でも、手元の Node でも同じものを使う）
 *
 * サーバーは「人と人を出会わせて、手と時計を中継する」だけ。
 * 囲碁のルール（打てる点・アゲハマ・整地）は、両方のアプリが同じエンジンで計算する。
 * 時計だけはサーバーが正（ずるや時計のずれを防ぐため）。
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
 * パスワードはそのまま保存せず、ハッシュ（SHA-256）にして保存する。
 */
const ALPH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // まぎらわしい 0/O/1/I は使わない
function randCode(n) { const a = new Uint8Array(n); crypto.getRandomValues(a); let s = ''; for (const x of a) s += ALPH[x % ALPH.length]; return s; }
async function sha(text) { const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)); return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join(''); }
export const normCode = v => String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
export function memStore() { const m = new Map(); return { get: async k => m.get(k), put: async (k, v) => { m.set(k, v); }, del: async k => { m.delete(k); } }; }
import { ITEMS, FLOORS, WALLS } from './prices.js';
import { Social } from './social.js';
import { cleanName } from './ng.js';
import '../common/avatar-art.js';
const AVP = globalThis.AVATAR.PRICE, AVATAR_CLEAN = globalThis.AVATAR.clean;
import { AV_OLD, AV_OLD2 } from './av-old-prices.js';
export const MAIN_MS = 5 * 60 * 1000, INC_MS = 5000, AWAY_MS = 180 * 1000, START_DELAY_MS = 2500;

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
    this.social = new Social(this);   // マイルームのつながり（日記・チャット・フレンド・ブロック。全ゲーム共通）
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
    if (ECON.includes(m.t)) return this.econ(sock, m);
    if (raw.length > 4000) return;
    if (m.t === 'soc') { const info = this.sockInfo.get(sock); return info && this.social.handle(sock, info, m); }
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
      case 'score': { const g = this.gameOf(pl, m.g); if (g && g.scoring && !g.over) this.finish(g, m.res && [0, 1, 2].includes(m.res.winner) ? m.res.winner : 0, '整地', m.res || null); break; }
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

  /* ---------- アカウント（保存データ） ---------- */
  async account(sock, m, ip) {
    const info = this.sockInfo.get(sock) || { acct: null };
    this.sockInfo.set(sock, info);
    const out = msg => { try { sock.send(JSON.stringify(msg)); } catch (e) {} };
    const game = gameOf(m.game);   // どのゲームのアプリか（セーブデータはゲームごと）
    if (m.t === 'register') {
      // 同じIPからのアカウント作成は1時間に5回まで（大量に作られてストレージが増え続けないように）
      this.regLog = this.regLog || new Map();
      const now = this.now(), log = (this.regLog.get(ip) || []).filter(t => now - t < 3600e3);
      if (log.length >= LIMIT.registersPerHour) { out({ t: 'busy', what: 'register' }); return; }
      log.push(now); this.regLog.set(ip, log);
      if (this.regLog.size > 10000) this.regLog.delete(this.regLog.keys().next().value);
      let id; do { id = randCode(8); } while (await this.store.get('acct:' + id));
      const pass = randCode(8);
      const rec = { h: await sha(id + ':' + pass), at: 0, created: this.now() };
      ensureEcon(rec); delete rec.welcome; dailyGift(rec, this.now()); gamePack(rec, game, this.now());
      await this.store.put('acct:' + id, rec);
      info.game = game; this.bindAcct(sock, info, id);
      out({ t: 'account', id, pass, data: null, at: 0, fresh: true, econ: Object.assign(pubEcon(rec), { welcome: true }) });
    } else if (m.t === 'login') {
      const id = normCode(m.id), pass = normCode(m.pass);
      const rec = id && await this.store.get('acct:' + id);
      if (!rec || rec.h !== await sha(id + ':' + pass)) { out({ t: 'authfail', restore: !!m.restore }); return; }
      info.game = game; this.bindAcct(sock, info, id);
      let welcome = false;
      const rec2 = await this.withAcct(id, async r => { ensureEcon(r); dailyGift(r, this.now()); gamePack(r, game, this.now()); if (r.welcome) { welcome = true; delete r.welcome; } await this.testReset(id, r, game); return true; });
      const gd = await this.gameData(id, rec2 || rec, game);
      out({ t: 'account', id, data: gd.data, at: gd.at, name: (rec2 || rec).name || '', restore: !!m.restore, econ: Object.assign(pubEcon(rec2 || rec), { welcome }) });
    } else if (m.t === 'sync') {
      if (!info.acct || !m.data || typeof m.data !== 'object') return;
      // 保存は1アカウント5秒に1回まで（書きこみ回数＝料金なので）
      const now = this.now();
      if (info.lastSync && now - info.lastSync < 5000) return;
      info.lastSync = now;
      const at = +m.at || now;
      // 銭と部屋はサーバーが正なので、アプリから送られてきても使わない
      const data = Object.assign({}, m.data); delete data.zeni; delete data.room;
      // セーブデータは「gd:<ID>:<ゲーム>」に（ゲームごと・1つの保存場所が大きくなりすぎないように）
      const key = 'gd:' + info.acct + ':' + game;
      let ok = false;
      const rec = await this.withAcct(info.acct, async r => {
        const cur = await this.gameData(info.acct, r, game);
        if (at < (cur.at || 0)) return false;   // 古いデータで上書きしない
        await this.store.put(key, { data, at });
        if (game === 'go' && r.data !== undefined) { delete r.data; delete r.at; }   // 前の保存場所（囲碁だけだったころ）は片づける
        r.name = cleanName(data.name);
        r.stats = r.stats || {}; const st = cleanStats(m.stats);
        if (st && game === 'go') for (const k of ['go9', 'go13']) { const t = rateOf(r, k); st[k] = Object.assign(st[k] || {}, { rating: t.rating, games: t.games, wins: t.wins, draws: t.draws, streak: t.streak, rank: dispRank(t) }); }   // レートはサーバーの数字で
        if (st) r.stats[game] = st;
        ok = true;
      });
      out({ t: 'synced', at, stale: !rec || !ok });
    }
  }

  // テスト用（2026/11/14）：部屋番号 561149 のアカウントを1回だけ初期化（ID・パスワード・部屋番号・交流はそのまま。銭・持ち物・部屋・アバター・レート・セーブデータは新しく）
  async testReset(id, r, game) {
    if (game !== 'go' || String(r.pid || '') !== '561149' || r.fullReset2) return;
    r.fullReset1 = r.fullReset2 = 1; r.progReset1 = 1;
    await this.social.resetExceptFriends(id, String(r.pid));   // 日記・部屋の書きこみも（フレンドだけ残す）
    for (const k of ['owned', 'room', 'rooms2', 'av', 'zeni', 'gifts', 'giftSeq', 'econV', 'avV', 'avG', 'avRm1', 'daily', 'claims', 'tama', 'charas', 'rate', 'stats', 'packs', 'offer', 'welcome', 'loginDay', 'data', 'at']) delete r[k];
    ensureEcon(r); dailyGift(r, this.now()); gamePack(r, game, this.now()); delete r.welcome;
    r.name = String(r.pid);
    await this.store.put('gd:' + id + ':' + game, { data: { name: String(r.pid), prog: { games: 0, seen: {}, all: false, intro: false } }, at: this.now() });
    for (const p of this.players.values()) if (p.acct === id) { p.rates = null; p.rating = START_RATE; p.av = null; }
  }
  // ゲームのセーブデータ（前の形：acct の data は囲碁のもの）
  async gameData(id, r, game) {
    const gd = await this.store.get('gd:' + id + ':' + game);
    if (gd) return gd;
    if (game === 'go' && r && r.data) return { data: r.data, at: r.at || 0 };
    return { data: null, at: 0 };
  }
  bindAcct(sock, info, id) {
    info.acct = id;
    const cid = this.socks.get(sock), pl = cid && this.players.get(cid);
    if (pl) pl.acct = id;
    // 部屋番号（対局相手の部屋をたずねられるように、相手に見せる番号）
    this.social.ensurePid(id).then(async pid => {
      info.pid = pid;
      try { sock.send(JSON.stringify({ t: 'pid', pid })); } catch (e) {}   // 新しく作った部屋番号をアプリへ（名前のかわりにも使う）
      const rec = await this.store.get('acct:' + id); info.av = rec && rec.av || null;   // 対局相手に見せるアバター
      info.rates = rec ? { go9: rateOf(rec, 'go9').rating, go13: rateOf(rec, 'go13').rating } : null;
      const p = cid && this.players.get(cid); if (p && p.acct === id) { p.pid = pid; p.av = info.av; p.rates = info.rates; if (info.rates) p.rating = info.rates.go9; }
    }).catch(() => {});
  }
  // 同じアカウントの読み書きが重ならないよう、順番に処理する
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
  // プレゼントボックスに入れる（social.js から：フレンド申請・フレンドからの銭）。つながっていればすぐ知らせる
  async giftTo(id, kind, amount, label, extra, check) {
    const rec = await this.withAcct(id, async r => {
      ensureEcon(r);
      if (check && check(r) === false) return false;
      if (kind === 'freq') r.gifts = (r.gifts || []).filter(g => !(g.kind === 'freq' && g.pid === extra.pid));
      addGift(r, kind, amount, label, this.now(), extra);
    });
    if (!rec) return false;
    for (const p of this.players.values()) if (p.acct === id && p.sock) { try { p.sock.send(JSON.stringify({ t: 'gifts', gifts: rec.gifts || [], zeni: rec.zeni })); } catch (e) {} }
    return true;
  }
  async dropGift(id, kind, pid) {
    const rec = await this.withAcct(id, async r => { const n = (r.gifts || []).length; r.gifts = (r.gifts || []).filter(g => !(g.kind === kind && g.pid === pid)); if (n === r.gifts.length) return false; });
    if (rec) for (const p of this.players.values()) if (p.acct === id && p.sock) { try { p.sock.send(JSON.stringify({ t: 'gifts', gifts: rec.gifts || [], zeni: rec.zeni })); } catch (e) {} }
  }
  // 銭をふやす（対人戦・Bot戦・レクチャーなど）。つながっていれば新しい残高を知らせる
  async give(id, amount, why, sock) {
    if (!id || !amount) return;
    const rec = await this.withAcct(id, async r => { ensureEcon(r); r.zeni += amount; });
    if (!rec) return;
    const msg = { t: 'zeni', zeni: rec.zeni, gained: amount, why };
    if (sock) { try { sock.send(JSON.stringify(msg)); } catch (e) {} }
    else for (const p of this.players.values()) if (p.acct === id && p.sock) { try { p.sock.send(JSON.stringify(msg)); } catch (e) {} }
  }

  async rateBot(id, bg, score, gid) {
    const key = 'go' + (bg.size || 9); let t = null, d = 0;
    await this.withAcct(id, async r => { t = rateOf(r, key); const b = dispRank(t); d = applyRate(t, bg.lv < 0 ? 1000 : botRating(bg.lv), score, true); rankGift(r, key, b, t, this.now()); });
    if (t) this.sendRate(id, key, t, d, gid ? gid.split(':').slice(1).join(':') : null);
  }
  /* ---------- 銭・ショップ・部屋（サーバーが正） ---------- */
  async econ(sock, m) {
    const info = this.sockInfo.get(sock); if (!info || !info.acct) return;
    const id = info.acct, out = msg => { try { sock.send(JSON.stringify(msg)); } catch (e) {} };
    const day = new Date(this.now() + 9 * 3600e3).toISOString().slice(0, 10);   // 日本時間の日付
    if (m.t === 'botstart') {
      // Bot 戦の開始を記録（勝ったときに「早すぎないか」を確かめるため）
      const gid = String(m.g || '').slice(0, 40); if (!gid) return;
      this.botGames = this.botGames || new Map();
      // 前の Bot 戦が終わらないまま新しく始めた（アプリを閉じた など）→ 前のは負けとして数える
      this.botOpen = this.botOpen || new Map();
      const prev = this.botOpen.get(id), pg = prev && this.botGames.get(prev);
      if (pg && !pg.solo) { this.botGames.delete(prev); await this.rateBot(id, pg, 0); }
      this.botGames.set(id + ':' + gid, { t0: this.now(), lv: m.lv === -1 ? -1 : Math.max(0, Math.min(13, m.lv | 0)), solo: !!m.solo, size: m.size === 13 ? 13 : 9 });
      if (!m.solo) this.botOpen.set(id, id + ':' + gid);
      if (this.botGames.size > 5000) this.botGames.delete(this.botGames.keys().next().value);
    } else if (m.t === 'botend') {
      const key = id + ':' + String(m.g || '').slice(0, 40), bg = this.botGames && this.botGames.get(key);
      if (!bg) return;
      this.botGames.delete(key); if (this.botOpen && this.botOpen.get(id) === key) this.botOpen.delete(id);
      const sec = (this.now() - bg.t0) / 1000, moves = m.moves | 0;
      if (!['win', 'draw', 'loss'].includes(m.result)) return;
      const short = sec < 30 || moves < 16;
      // レート：負けはいつでも数える。勝ち・引き分けは、早すぎる・短すぎる対局なら数えない
      if (!bg.solo && (m.result === 'loss' || !short)) await this.rateBot(id, bg, m.result === 'win' ? 1 : m.result === 'draw' ? 0.5 : 0, key);
      if (short) { out({ t: 'zeni', gained: 0, why: 'short' }); return; }   // 早すぎる・短すぎる対局は数えない
      let amount = GAME_ZENI;   // 対局1回につき100銭（勝ち負けに関係なく）
      const rec = await this.withAcct(id, async r => {
        ensureEcon(r);
        if (r.daily.day !== day) r.daily = { day, bot: 0 };
        amount = Math.max(0, Math.min(amount, BOT_DAILY - r.daily.bot));
        r.daily.bot += amount; r.zeni += amount;
      });
      if (rec) out({ t: 'zeni', zeni: rec.zeni, gained: amount, why: amount ? 'bot' : 'cap' });
    } else if (m.t === 'claim') {
      // レクチャー初クリア 20 銭、ドリル（1問1回まで）3 銭、ソロのエピソードを読み終えたら 500 銭（1話1回）
      const kind = ['lesson', 'drill', 'episode', 'tutorial', 'unlock'].includes(m.kind) ? m.kind : null;
      const cid = String(m.id || '').slice(0, 24); if (!kind || !/^[\w:.-]+$/.test(cid)) return;
      const amount = { lesson: 20, drill: 3, episode: EPISODE_ZENI, tutorial: 1000, unlock: 0 }[kind], limit = { lesson: 80, drill: 400, episode: 40, tutorial: 5, unlock: 20 }[kind];
      let gained = 0;
      const rec = await this.withAcct(id, async r => {
        ensureEcon(r);
        const list = r.claims[kind] = r.claims[kind] || [];
        if (list.includes(cid) || list.length >= limit) return;
        list.push(cid);
        if (kind === 'unlock') { const u = UNLOCK_GIFT[cid]; if (!u) return false; addGift(r, 'pack', 0, u.label, this.now(), { av: u.av, items: u.items }); gained = -1; return; }   // 新しい場所が開いたときの、キャラからのおくりもの
        if (kind === 'tutorial') { addGift(r, 'welcome', amount, 'チュートリアルを最後まで受けたお礼（小春より）', this.now()); gained = -1; return; }   // チュートリアル完走（ゲームごとに1回）はプレゼントボックスへ
        r.zeni += amount; gained = amount;
      });
      if (rec && gained === -1) out({ t: 'gifts', gifts: rec.gifts || [], zeni: rec.zeni });
      else if (rec) out({ t: 'zeni', zeni: rec.zeni, gained, why: kind });
    } else if (m.t === 'gifts') {
      const rec = await this.withAcct(id, async r => { ensureEcon(r); dailyGift(r, this.now()); });
      if (rec) out({ t: 'gifts', req: m.req, gifts: rec.gifts || [], zeni: rec.zeni });
    } else if (m.t === 'gifttake') {
      // 受け取る：id を指定（'all' なら全部）。勾玉・アバター・家具が入っていることもある
      let got = 0, things = false;
      const rec = await this.withAcct(id, async r => {
        ensureEcon(r);
        const keep = [];
        for (const g of r.gifts || []) {
          if (g.kind !== 'freq' && (m.id === 'all' || g.id === (m.id | 0))) {   // フレンド申請は、許可・ことわるで消える
            got += g.amount;
            if (g.tama || g.av || g.items) things = true;
            if (g.tama) addTama(r, g.game || 'go', g.tama);
            for (const k of g.av || []) if (AVP[k] != null && !r.owned.av.includes(k)) r.owned.av.push(k);
            for (const k of g.items || []) if (ITEMS[k]) r.owned.items[k] = (r.owned.items[k] || 0) + 1;
          } else keep.push(g);
        }
        r.gifts = keep; r.zeni += got;
      });
      if (rec) out({ t: 'gifts', req: m.req, gifts: rec.gifts || [], zeni: rec.zeni, got, things, econ: things ? pubEcon(rec) : undefined });
    } else if (m.t === 'rankup') {
      // 昇級・昇段のごほうび 1000銭（段級位ごとに1回だけ。プレゼントボックスへ）
      // key：どのゲーム・盤か（囲碁9路は前からの 'rank'、13路は 'rank_go13' のように別に数える）
      const rank = m.rank | 0, name = String(m.name || '').slice(0, 10);
      const key = /^[a-z0-9]{2,10}$/.test(m.key || '') && m.key !== 'go9' ? 'rank_' + m.key : 'rank';
      if (rank < 1 || rank > 30) return;
      const rec = await this.withAcct(id, async r => {
        ensureEcon(r);
        if (rank > dispRank(rateOf(r, key === 'rank' ? 'go9' : key.slice(5)))) return false;   // サーバーのレートで、その段級位に届いているときだけ
        const list = r.claims[key] = r.claims[key] || [];
        if (list.includes(rank)) return false;
        list.push(rank); addGift(r, 'rank', RANKUP, `${name}昇格のごほうび`, this.now());
      });
      if (rec) out({ t: 'gifts', req: m.req, gifts: rec.gifts || [], zeni: rec.zeni });
    } else if (m.t === 'buy') {
      let ok = false, reason = '', half = false, paid = 0;
      const rec = await this.withAcct(id, async r => {
        ensureEcon(r);
        let price, apply;
        if (m.av && TAMA[m.av]) {
          // 勾玉で買う（勾玉限定のアイテム）。半額サービスはなし
          if (r.owned.av.includes(m.av)) { reason = 'have'; return; }
          const g = info.game || 'go', t = TAMA[m.av];
          if (tamaOf(r, g) < t) { reason = 'tama'; return; }
          addTama(r, g, -t); r.owned.av.push(m.av); ok = true; return;
        }
        if (m.av && AVP[m.av] > 0) { if (r.owned.av.includes(m.av)) { reason = 'have'; return; } price = AVP[m.av]; apply = () => r.owned.av.push(m.av); }
        else if (m.item && ITEMS[m.item]) { price = ITEMS[m.item][0]; apply = () => { r.owned.items[m.item] = (r.owned.items[m.item] || 0) + 1; }; }
        else if (m.floor && FLOORS[m.floor] != null) { if (r.owned.floors.includes(m.floor)) { reason = 'have'; return; } price = FLOORS[m.floor]; apply = () => r.owned.floors.push(m.floor); }
        else if (m.wall && WALLS[m.wall] != null) { if (r.owned.walls.includes(m.wall)) { reason = 'have'; return; } price = WALLS[m.wall]; apply = () => r.owned.walls.push(m.wall); }
        else if (m.roomAdd) {
          // 部屋を足す：どの部屋（p）の、右下（d='x'）か左下（d='y'）に、廊下でつなぐか
          r.rooms2 = Array.isArray(r.rooms2) ? r.rooms2 : [];
          if (r.rooms2.length >= ROOM_MAX - 1) { reason = 'max'; return; }
          const p = m.p | 0, d = m.d === 'y' ? 'y' : 'x';
          if (p < 0 || p > r.rooms2.length) { reason = 'item'; return; }
          const used = r.rooms2.map((x, i) => x.at || defAt(i + 1));
          if (used.some(a => a.p === p && a.d === d)) { reason = 'used'; return; }
          price = ROOM_PRICE; apply = () => r.rooms2.push({ floor: 'wood', wall: 'plain', items: [], walls: [], at: { p, d }, n: 12 });
        }
        else if (m.roomBig != null) {
          // 部屋を広くする（12×12 → 17×17。広さはおよそ2倍）
          const i = m.roomBig | 0, rm = i === 0 ? r.room : (r.rooms2 || [])[i - 1];
          if (!rm) { reason = 'item'; return; }
          if (rm.n === BIG_N) { reason = 'have'; return; }
          price = BIG_PRICE; apply = () => { rm.n = BIG_N; };
        }
        else { reason = 'item'; return; }
        // 32回に1回、店員さんのサービスで半額（部屋の増築・拡張はのぞく）
        if (price > 0 && !m.roomAdd && m.roomBig == null && this.rand() < 1 / 32) { half = true; price = Math.floor(price / 2); }
        if (r.zeni < price) { reason = 'zeni'; half = false; return; }
        r.zeni -= price; apply(); ok = true; paid = price;
      });
      if (rec) out({ t: 'bought', ok, reason, half, paid, req: m.req, econ: pubEcon(rec) });
    } else if (m.t === 'sell') {
      // 骨董屋：いらない家具・アバターのパーツを、値段の3分の1で買いとる。ときどき玄斎からおくりもの
      let ok = false, reason = '', got = 0, offer = null;
      const rec = await this.withAcct(id, async r => {
        ensureEcon(r);
        let price = 0;
        if (m.av && AVP[m.av] > 0) {
          if (!r.owned.av.includes(m.av)) { reason = 'item'; return; }
          const [sl, pid] = m.av.split(':');
          if (r.av && r.av[sl] === pid) { reason = 'wear'; return; }
          price = AVP[m.av]; r.owned.av = r.owned.av.filter(k => k !== m.av);
        } else if (m.item && ITEMS[m.item] && ITEMS[m.item][0] > 0) {
          const have = r.owned.items[m.item] || 0;
          let placed = 0;
          for (const rm of [r.room].concat(r.rooms2 || [])) if (rm) for (const it of (rm.items || []).concat(rm.walls || [])) if (it.k === m.item) placed++;
          if (have - placed < 1) { reason = 'placed'; return; }
          price = ITEMS[m.item][0];
          if (have > 1) r.owned.items[m.item] = have - 1; else delete r.owned.items[m.item];
        } else { reason = 'item'; return; }
        got = Math.floor(price / 3); r.zeni += got; ok = true;
        offer = r.offer = antiqueGift(r, this.rand());
      });
      if (rec) out({ t: 'sold', ok, reason, got, offer, req: m.req, econ: pubEcon(rec) });
    } else if (m.t === 'ratereset') {
      // レートをリセット（設定から）：9路・13路とも 1050 に
      const rec = await this.withAcct(id, async r => { r.rate = r.rate || {}; for (const k of ['go9', 'go13']) r.rate[k] = { rating: START_RATE, games: 0, wins: 0, draws: 0, streak: 0, earnedDan: -1 }; });
      if (rec) for (const k of ['go9', 'go13']) this.sendRate(id, k, rec.rate[k], 0, null);
    } else if (m.t === 'tama') {
      // 勾玉：銭と交換（勾玉→銭の一方通行）・キャラクター開放。勾玉はアプリ（ゲーム）ごと
      const g = info.game || 'go';
      let ok = false, reason = '';
      const rec = await this.withAcct(id, async r => {
        ensureEcon(r);
        if (m.op === 'swap') {
          const n = Math.floor(+m.n || 0);
          if (n < 1 || n > 100000) { reason = 'n'; return false; }
          if (tamaOf(r, g) < n) { reason = 'tama'; return false; }
          addTama(r, g, -n); r.zeni += n * TAMA_ZENI; ok = true;
        } else if (m.op === 'chara') {
          const key = String(m.key || ''); if (!/^[a-z]{2,10}$/.test(key)) { reason = 'key'; return false; }
          r.charas = r.charas || {}; const list = r.charas[g] = r.charas[g] || [];
          if (list.includes(key)) { reason = 'have'; return false; }
          if (tamaOf(r, g) < TAMA_CHARA) { reason = 'tama'; return false; }
          addTama(r, g, -TAMA_CHARA); list.push(key); ok = true;
        } else return false;
      });
      out({ t: 'bought', ok, reason, req: m.req, econ: rec ? pubEcon(rec) : undefined });
    } else if (m.t === 'offer') {
      // 玄斎のおくりものを、もらう（yes）か、ことわる
      let ok = false;
      const rec = await this.withAcct(id, async r => {
        ensureEcon(r);
        const o = r.offer; r.offer = null;
        if (!o || !m.yes) return;
        if (o.kind === 'av' && AVP[o.id] != null && !r.owned.av.includes(o.id)) { r.owned.av.push(o.id); ok = true; }
        else if (o.kind === 'item' && ITEMS[o.id]) { r.owned.items[o.id] = (r.owned.items[o.id] || 0) + 1; ok = true; }
      });
      if (rec) out({ t: 'bought', ok, reason: ok ? '' : 'item', req: m.req, econ: pubEcon(rec) });
    } else if (m.t === 'room') {
      // 模様替えを終えたときに届く部屋の配置。持っていない家具が置かれていないか確かめる
      let ok = false;
      const rec = await this.withAcct(id, async r => {
        ensureEcon(r);
        // 部屋が2つ以上あるときは、全部の部屋をまとめて数える（持っている数より多く置いていないか）
        const cnt = {}, extra = Array.isArray(r.rooms2) ? r.rooms2 : [];
        const room = cleanRoom(m.room, r.owned, cnt, (r.room && r.room.n) || 12);
        if (!room) return;
        if (r.room && r.room.n) room.n = r.room.n;
        let rooms2 = extra;
        if (Array.isArray(m.rooms2)) {
          if (m.rooms2.length !== extra.length) return;
          // 位置（at）と大きさ（n）はサーバーが持っているものを使う
          rooms2 = m.rooms2.map((x, i) => { const c = cleanRoom(x, r.owned, cnt, extra[i].n || 12); if (c) { if (extra[i].at) c.at = extra[i].at; if (extra[i].n) c.n = extra[i].n; } return c; });
          if (rooms2.some(x => !x)) return;
        } else for (const x of extra) for (const it of (x.items || []).concat(x.walls || [])) cnt[it.k] = (cnt[it.k] || 0) + 1;
        for (const [k, n] of Object.entries(cnt)) if (n > (r.owned.items[k] || 0)) return;
        r.room = room; r.rooms2 = rooms2; ok = true;
      });
      if (ok) this.social.roomChanged(id).catch(() => {});
      if (rec) out({ t: 'roomsaved', ok, econ: ok ? undefined : pubEcon(rec) });
    }
  }

  onClose(sock) {
    this.sockInfo.delete(sock);
    const cid = this.socks.get(sock); this.socks.delete(sock);
    if (!cid) return;
    const pl = this.players.get(cid); if (!pl || pl.sock !== sock) return;
    pl.sock = null; pl.seekAt = 0; this.closeRoom(pl);
    const g = pl.game && this.games.get(pl.game);
    if (g && !g.over) {
      // 3分戻らなければ負け
      const c = g.colorOf[cid], until = this.now() + AWAY_MS;
      g.away[c] = { until, timer: this.setTimeout(() => { if (!g.over && g.away[c]) this.finish(g, 3 - c, '切断'); }, AWAY_MS) };
      this.send(g.players[3 - c], { t: 'away', g: g.id, until });
    } else if (!g) {
      this.players.delete(cid);
    }
    this.lobby();
  }

  pub(cid) { const p = this.players.get(cid); return p ? { name: cleanName(p.name), rating: p.rating, ava: p.ava, pid: p.pid || null, av: p.av || null } : { name: '？', rating: 1050, ava: 0 }; }
  gameOf(pl, gid) { const g = this.games.get(gid); return g && g.colorOf[pl.cid] ? g : null; }

  /* ---------- マッチング：待っている人どうし、レートの近い順に ---------- */
  match() {
    const q = [...this.players.values()].filter(p => p.seekAt && p.sock && !p.game).sort((a, b) => a.seekAt - b.seekAt);
    while (q.length >= 2) {
      const a = q.shift();
      let bi = -1, best = Infinity;
      q.forEach((b, i) => { if ((b.size || 9) !== (a.size || 9)) return; const d = Math.abs(a.rating - b.rating); if (d < best) { best = d; bi = i; } });   // 同じ盤の大きさどうし
      if (bi < 0) continue;
      const b = q.splice(bi, 1)[0];
      this.create(a, b, null, null, a.size || 9);
    }
  }
  // a, b: プレイヤー。hc があればフレンド戦（a が部屋をつくった人）。black を指定すると黒番が決まる
  create(a, b, hc, black, size) {
    size = hc ? hc.size : size === 13 ? 13 : 9;
    const id = 'g' + (++this.seq) + '-' + Math.random().toString(36).slice(2, 7);
    if (!black) black = hc && hc.black === 'host' ? a : hc && hc.black === 'guest' ? b : Math.random() < 0.5 ? a : b;
    const white = black === a ? b : a;
    const main = hc ? hc.min * 60000 : MAIN_MS * (size === 13 ? 2 : 1);   // 13路のランダムマッチは10分
    const g = {
      id, players: { 1: black.cid, 2: white.cid }, colorOf: { [black.cid]: 1, [white.cid]: 2 },
      hc: hc || null, host: hc ? a.cid : null, size,
      moves: [], clock: { 1: main, 2: main }, toPlay: hc && hc.h >= 2 ? 2 : 1, turnStart: this.now() + START_DELAY_MS,
      passes: 0, over: false, scoring: false, away: { 1: null, 2: null }, timer: null, acked: {}, endMsg: null
    };
    this.games.set(id, g);
    for (const p of [black, white]) { p.seekAt = 0; p.game = id; this.closeRoom(p); }
    for (const c of [1, 2]) this.send(g.players[c], { t: 'start', g: id, color: c, opp: this.pub(g.players[3 - c]), clock: this.clocks(g), delay: START_DELAY_MS, hc: g.hc || undefined, size: g.size });
    this.arm(g);
  }
  abort(g) {
    g.over = true; this.clearTimeout(g.timer);
    for (const c of [1, 2]) {
      const p = this.players.get(g.players[c]);
      if (p) { p.game = null; if (!p.sock) this.players.delete(p.cid); }
      this.send(g.players[c], { t: 'aborted', g: g.id });
    }
    this.games.delete(g.id);
  }

  /* ---------- 時計（サーバーが正） ---------- */
  left(g, c) { return g.clock[c] - (g.toPlay === c && !g.over && !g.scoring ? Math.max(0, this.now() - g.turnStart) : 0); }
  clocks(g) { return { 1: Math.round(this.left(g, 1)), 2: Math.round(this.left(g, 2)), toPlay: g.toPlay }; }
  arm(g) {
    this.clearTimeout(g.timer);
    if (g.over || g.scoring) return;
    const c = g.toPlay, ms = Math.max(0, this.left(g, c)) + 300;
    g.timer = this.setTimeout(() => { if (!g.over && !g.scoring && g.toPlay === c && this.left(g, c) <= 0) this.finish(g, 3 - c, '時間切れ'); else this.arm(g); }, ms);
  }

  move(pl, m) {
    const g = this.gameOf(pl, m.g); if (!g || g.over || g.scoring) return;
    const c = g.colorOf[pl.cid];
    if (g.toPlay !== c || (m.n | 0) !== g.moves.length) return;          // 手番ちがい・二重送信
    const p = m.p | 0; if (p < -1 || p >= (g.size || 9) ** 2) return;
    const used = Math.max(0, this.now() - g.turnStart);
    if (g.clock[c] - used <= 0) { this.finish(g, 3 - c, '時間切れ'); return; }
    g.clock[c] = g.clock[c] - used + INC_MS;
    g.moves.push(p); g.toPlay = 3 - c; g.turnStart = this.now();
    g.passes = p < 0 ? g.passes + 1 : 0;
    if (g.passes >= 2) g.scoring = true;
    const msg = { t: 'move', g: g.id, n: g.moves.length - 1, p, c, clock: this.clocks(g) };
    for (const cc of [1, 2]) this.send(g.players[cc], msg);
    if (g.scoring) {
      // 黒番のアプリが整地して送ってくる。来なければ白番、それも来なければ持碁
      g.timer = this.setTimeout(() => { if (!g.over) this.finish(g, 0, '整地', null); }, 30000);
    } else this.arm(g);
  }

  /* ---------- フレンドマッチ：合言葉（4けたの数字）で部屋に入る ---------- */
  fhost(pl, m) {
    if (pl.game) return;
    const h = m.hc || {};
    const hc = {
      h: [0, 1, 2, 3, 4, 5].includes(h.h) ? h.h : 0,
      black: ['host', 'guest', 'random'].includes(h.black) ? h.black : 'random',
      min: [3, 5, 10, 15].includes(h.min) ? h.min : 5,
      size: h.size === 13 ? 13 : 9
    };
    if (hc.h > 0 && hc.black === 'random') hc.black = 'guest';
    hc.komi = hc.h === 0 ? 7 : 0;
    this.closeRoom(pl); pl.seekAt = 0;
    if (this.rooms.size > 5000) return;
    let code; do { code = String(1000 + Math.floor(Math.random() * 9000)); } while (this.rooms.has(code));
    this.rooms.set(code, { code, host: pl.cid, hc, at: this.now() });
    pl.room = code;
    this.send(pl.cid, { t: 'froom', code, hc });
  }
  fjoin(pl, m) {
    if (pl.game) return;
    // 合言葉の当てずっぽうを防ぐ：まちがいは1分に10回まで
    const now = this.now();
    if (!pl.fj || now - pl.fj.at > 60000) pl.fj = { at: now, n: 0 };
    if (pl.fj.n >= 10) { this.send(pl.cid, { t: 'fnone', busy: true }); return; }
    const r = this.rooms.get(String(m.code || '').replace(/\D/g, '').slice(0, 4));
    const host = r && this.players.get(r.host);
    if (!r || !host || !host.sock || host.game || host.cid === pl.cid) { pl.fj.n++; this.send(pl.cid, { t: 'fnone' }); return; }
    this.closeRoom(host); this.closeRoom(pl); pl.seekAt = 0;
    this.create(host, pl, r.hc);
  }
  closeRoom(pl) {
    if (pl && pl.room) { const r = this.rooms.get(pl.room); if (r && r.host === pl.cid) this.rooms.delete(pl.room); pl.room = null; }
  }
  rematch(pl, m) {
    const g = this.games.get(m.g);
    if (!g || !g.over || !g.hc || !g.colorOf[pl.cid] || pl.game) return;
    g.re = g.re || {};
    g.re[pl.cid] = true;
    const other = this.players.get(g.players[3 - g.colorOf[pl.cid]]);
    if (!other || !other.sock || other.game) return;
    if (!g.re[other.cid]) { this.send(other.cid, { t: 'rematch', g: g.id }); return; }
    g.re = {};
    const host = this.players.get(g.host), guest = host === pl ? other : pl;
    if (!host) return;
    // 互先は黒白を入れかえる。ハンデ戦は同じ手合いのまま
    const black = g.hc.h === 0 ? this.players.get(g.players[2]) : this.players.get(g.players[1]);
    this.create(host, guest, g.hc, black);
  }

  // 対人戦のレート：両方のアカウントのサーバーのレートで計算して、それぞれに知らせる
  async rateOnline(g, winner) {
    const key = 'go' + (g.size === 13 ? 13 : 9), ps = [1, 2].map(c => this.players.get(g.players[c]));
    if (ps.some(p => !p || !p.acct) || ps[0].acct === ps[1].acct) return;
    const before = [];
    for (const p of ps) { const r = await this.store.get('acct:' + p.acct); before.push(r ? rateOf(r, key).rating : START_RATE); }
    for (const [i, p] of ps.entries()) {
      const c = i + 1, score = winner === 0 ? 0.5 : winner === c ? 1 : 0;
      let d = 0, t = null;
      await this.withAcct(p.acct, async r => { t = rateOf(r, key); const b = dispRank(t); d = applyRate(t, before[1 - i], score, false); rankGift(r, key, b, t, this.now()); });
      if (t) this.sendRate(p.acct, key, t, d, g.id);
    }
  }
  sendRate(acct, key, t, d, gid) {
    const msg = Object.assign({ t: 'rate', key, d, g: gid, rank: dispRank(t) }, t);
    for (const p of this.players.values()) if (p.acct === acct) { p.rates = Object.assign(p.rates || {}, { [key]: t.rating }); if (key === 'go' + (p.size || 9)) p.rating = t.rating; if (p.sock) { try { p.sock.send(JSON.stringify(msg)); } catch (e) {} } }
  }
  finish(g, winner, reason, res) {
    if (g.over) return;
    g.over = true; this.clearTimeout(g.timer);
    for (const c of [1, 2]) if (g.away[c]) this.clearTimeout(g.away[c].timer);
    g.endMsg = { t: 'end', g: g.id, winner, reason, res: res || null, moves: g.moves };
    // 対人戦の銭：1局100（勝ち負けに関係なく。10手未満で終わった対局は出さない）。フレンド戦は出さない（なれあいで増やせないように）
    if (g.moves.length >= 10 && !g.hc) for (const c of [1, 2]) {   // 10手未満で終わった対局（すぐ投了など）は銭なし
      const p = this.players.get(g.players[c]);
      const amount = GAME_ZENI;
      if (p && p.acct && amount) this.give(p.acct, amount, 'online').catch(() => {});
    }
    for (const c of [1, 2]) this.send(g.players[c], g.endMsg);
    if (!g.hc) this.rateOnline(g, winner).catch(() => {});
    for (const c of [1, 2]) {
      const p = this.players.get(g.players[c]);
      if (p) { p.game = p.sock ? null : g.id; if (p.sock) g.acked[p.cid] = true; }
    }
    // つながっていない人には、戻ってきたときに結果を伝える（30分まで）
    this.setTimeout(() => {
      this.games.delete(g.id);
      for (const c of [1, 2]) { const p = this.players.get(g.players[c]); if (p && p.game === g.id) { p.game = null; if (!p.sock) this.players.delete(p.cid); } }
    }, 30 * 60 * 1000);
  }
}

/* ---------- レート（サーバーが計算する。アプリから送られてきた数字は使わない） ---------- */
const TH = [1050, 1100, 1150, 1200, 1250, 1300, 1350, 1400, 1500, 1600, 1700, 1800, 1900, 2000], DAN_FROM = 10, DAN_STREAK = 4, START_RATE = 1050;
const rankFrom = v => { let i = 0; for (let k = 0; k < TH.length; k++) if (v >= TH[k]) i = k; return i; };
const botRating = i => i < TH.length - 1 ? Math.round((TH[i] + TH[i + 1]) / 2) : TH[i] + 50;
function eloD(my, op, score, games) {
  const exp = 1 / (1 + Math.pow(10, (op - my) / 400));
  let d = Math.round((games < 20 ? 32 : 16) * (score - exp));
  if (d === 0 && score !== 0.5) d = score ? 1 : -1;
  return d;
}
// その盤の戦績（はじめてなら、前のデータから引きつぐ。上限 2050）
function rateOf(r, key) {
  r.rate = r.rate || {};
  if (!r.rate[key]) {
    const st = r.stats && r.stats.go && r.stats.go[key], legacy = key === 'go9' && r.data && r.data.rating;
    const v = Math.max(800, Math.min(2050, (st && st.rating) || legacy || START_RATE) | 0), rr = rankFrom(v);
    r.rate[key] = { rating: v, games: (st && st.games) | 0, wins: (st && st.wins) | 0, draws: (st && st.draws) | 0, streak: 0, earnedDan: rr >= DAN_FROM ? rr : -1 };
  }
  return r.rate[key];
}
const dispRank = t => { const r = rankFrom(t.rating); return r < DAN_FROM ? r : Math.max(DAN_FROM - 1, Math.min(r, t.earnedDan)); };
// 1局ぶん反映して、変わったレートを返す。vsBot：自分よりレートの低い Bot に勝っても上がらない
// 段級位が上がったら、ごほうび 1000銭（段級位ごとに1回だけ）。アプリからの rankup を待たずにサーバーが入れる
const RANK_NAMES = ['10級', '9級', '8級', '7級', '6級', '5級', '4級', '3級', '2級', '1級', '初段', '二段', '三段', '四段'];
function rankGift(r, key, before, t, now) {
  const nr = dispRank(t); if (nr <= before) return;
  ensureEcon(r);
  const ck = key === 'go9' ? 'rank' : 'rank_' + key, list = r.claims[ck] = r.claims[ck] || [];
  if (list.includes(nr)) return;
  list.push(nr); addGift(r, 'rank', RANKUP, `${key === 'go13' ? '13路' : ''}${RANK_NAMES[nr] || ''}昇格のごほうび`, now);
}
function applyRate(t, op, score, vsBot) {
  let d = eloD(t.rating, op, score, t.games);
  if (vsBot && d > 0 && op < t.rating) d = 0;
  t.rating = Math.max(800, t.rating + d); t.games++;
  if (score === 1) { t.wins++; t.streak++; } else if (score === 0.5) t.draws++; else t.streak = 0;
  const rr = rankFrom(t.rating); if (rr >= DAN_FROM && t.streak >= DAN_STREAK && rr > t.earnedDan) t.earnedDan = rr;
  return d;
}

/* ---------- 銭まわりの決まり ---------- */
const ECON = ['botstart', 'botend', 'claim', 'buy', 'sell', 'offer', 'tama', 'ratereset', 'room', 'gifts', 'gifttake', 'rankup'];
const BOT_DAILY = 2000, GAME_ZENI = 100, EPISODE_ZENI = 500, WELCOME = 3000, RANKUP = 1000, DAILY = 100;
// プレゼントボックス：受け取るまで銭にならない。{ id, kind, amount, label, t }
function addGift(r, kind, amount, label, t, extra) {
  r.gifts = r.gifts || []; r.giftSeq = (r.giftSeq || 0) + 1;
  r.gifts.push(Object.assign({ id: r.giftSeq, kind, amount, label, t }, extra || {})); if (r.gifts.length > 50) r.gifts.shift();
}
// 毎日はじめてつないだら 100銭（日本時間の日付）
function dailyGift(r, now) {
  const day = new Date(now + 9 * 3600e3).toISOString().slice(0, 10);
  if (r.loginDay === day) return false;
  r.loginDay = day; addGift(r, 'daily', DAILY, 'ログインボーナス（' + day.slice(5).replace('-', '/') + '）', now); return true;
}
// アカウントに銭・持ち物・部屋がなければ作る。前のバージョンのデータがあれば、上限つきで引き継ぐ
function avRenew(r) {
  // アバター作りなおし（2026/11/13）：前に買ったパーツの銭を、プレゼントボックスで返す。背景はそのまま持てる
  const av = (r.owned && r.owned.av) || []; let back = 0;
  for (const k of av) if (!k.startsWith('bg:')) back += AV_OLD[k] || AV_OLD2[k] || 0;
  r.owned.av = av.filter(k => k.startsWith('bg:'));
  if (r.av) r.av = AVATAR_CLEAN(r.av);
  if (back > 0) addGift(r, 'refund', back, 'アバター作りなおしのおかえし', Date.now());
  r.avV = 3;
}
function ensureEcon(r) {
  // テスト用（2026/11/13）：部屋番号 561149 のアカウントに 20000銭を1回だけ（プレゼントボックスへ）
  if (r.owned && String(r.pid || '') === '561149' && !r.testGift1) { r.testGift1 = 1; addGift(r, 'test', 20000, 'テスト用のおくりもの', Date.now()); }
  if (r.owned && String(r.pid || '') === '561149' && !r.testGift3) { r.testGift3 = 1; addGift(r, 'test', 0, 'テスト用の勾玉 1000こ', Date.now(), { tama: 1000, game: 'go' }); }
  if (r.owned && String(r.pid || '') === '561149' && !r.testGift2) { r.testGift2 = 1; addGift(r, 'test', 50000, 'テスト用のおくりもの（2回目）', Date.now()); }
  // 2026/11/13 に無料→300銭になった4点：その時点で着ていた人には、そのまま持たせる
  if (!r.avG && r.owned && r.av) { r.owned.av = r.owned.av || []; for (const sl of ['head', 'body']) { const k = sl + ':' + r.av[sl]; if (['head:h00', 'head:h04', 'body:b01', 'body:b05'].includes(k) && !r.owned.av.includes(k)) r.owned.av.push(k); } }
  if (r.owned) r.avG = 1;
  if (r.owned && r.owned.av && !r.avRm1) {
    let back = 0;
    r.owned.av = r.owned.av.filter(k => { if (AV_RM[k]) { back += AV_RM[k]; return false; } return true; });
    if (r.av) r.av = AVATAR_CLEAN(r.av);
    if (back > 0) addGift(r, 'refund', back, '取りやめた服のおかえし', Date.now());
    r.avRm1 = 1;
  }
  if (r.econV === 2 && r.avV !== 3 && r.owned) { avRenew(r); return; }
  // はじめての人には 3000 銭のプレゼント（前からの人にも1回だけ）
  if (r.econV === 1) { r.daily = r.daily || { day: '', bot: 0 }; r.claims = r.claims || {}; r.owned.av = r.owned.av || []; addGift(r, 'welcome', WELCOME, 'はじめてのプレゼント', Date.now()); r.econV = 2; r.welcome = true; avRenew(r); return; }
  if (r.econV === 2) return;
  const d = r.data || {}, old = d.room || {};
  r.zeni = Math.min(3000, Math.max(0, d.zeni | 0));   // 前のデータの銭（3000まで）。はじめてのプレゼントはプレゼントボックスへ
  addGift(r, 'welcome', WELCOME, 'はじめてのプレゼント', Date.now());
  r.owned = { items: {}, floors: ['wood'], walls: ['plain'], av: [] };   // はじめは何も持たない（碁盤は静馬からもらう）
  let value = 0;
  const add = k => { if (ITEMS[k] && k !== 'goban' && value + ITEMS[k][0] <= 6000) { value += ITEMS[k][0]; r.owned.items[k] = (r.owned.items[k] || 0) + 1; } };
  for (const it of (old.items || []).concat(old.walls || [])) if (it) add(it.k);
  for (const [k, n] of Object.entries(old.inv || {})) for (let i = 0; i < Math.min(n | 0, 20); i++) add(k);
  for (const f of ((old.owned || {}).floors || [])) if (FLOORS[f] != null && !r.owned.floors.includes(f) && value + FLOORS[f] <= 6000) { value += FLOORS[f]; r.owned.floors.push(f); }
  for (const w of ((old.owned || {}).walls || [])) if (WALLS[w] != null && !r.owned.walls.includes(w) && value + WALLS[w] <= 6000) { value += WALLS[w]; r.owned.walls.push(w); }
  const def = { floor: 'wood', wall: 'plain', items: [], walls: [] };   // はじめの部屋は空っぽ
  r.room = (Array.isArray(old.items) && old.items.length ? cleanRoom(old, r.owned) : null) || def;
  r.daily = { day: '', bot: 0 }; r.claims = {};
  r.econV = 2; r.welcome = true; r.avV = 3;
}
// 骨董屋で売ったときの、玄斎からのおくりもの（x は 0〜1 の乱数）
//   1/256 持っていない 2000銭以上のアバター / 1/64 1200〜1500銭のアバター / 1/16 600銭の家具 / 1/8 300銭以下の家具
function antiqueGift(r, x) {
  const pick = a => a.length ? a[Math.floor(Math.random() * a.length)] : null;
  const avs = (lo, hi) => Object.entries(AVP).filter(([k, p]) => p >= lo && p <= hi && !r.owned.av.includes(k)).map(([k]) => k);
  const items = f => Object.entries(ITEMS).filter(([, v]) => f(v[0])).map(([k]) => k);
  let id = null, kind = 'item';
  if (x < 1 / 256) { id = pick(avs(2000, 1e9)); kind = 'av'; }
  else if (x < 1 / 256 + 1 / 64) { id = pick(avs(1200, 1500)); kind = 'av'; }
  else if (x < 1 / 256 + 1 / 64 + 1 / 16) id = pick(items(p => p === 600));
  else if (x < 1 / 256 + 1 / 64 + 1 / 16 + 1 / 8) id = pick(items(p => p > 0 && p <= 300));
  return id ? { kind, id } : null;
}
// 足もとのないアバターの服（2026/11/14 取りやめ）。持っていた人には、銭をおかえし
const AV_RM = { 'body:b02': 1800, 'body:b06': 1800, 'body:b24': 1800, 'body:b25': 1200, 'body:b26': 1200, 'body:b27': 1800, 'body:b29': 1800, 'body:b30': 300, 'body:b31': 300 };
function pubEcon(r) { return { zeni: r.zeni, owned: r.owned, room: r.room, rooms2: r.rooms2 || [], av: r.av || null, pid: r.pid || null, gifts: r.gifts || [], tama: r.tama || {}, charas: r.charas || {}, stats: r.stats || {}, rates: { go9: rateOf(r, 'go9'), go13: rateOf(r, 'go13') } }; }
/* ---------- 勾玉（課金石）：アプリ（ゲーム）ごとに持つ。お金で買った分は、そのアプリの中だけで使う（Google Play のきまり） ---------- */
const TAMA = globalThis.AVATAR.TAMA || {}, TAMA_ZENI = 10, TAMA_CHARA = 300;
const tamaOf = (r, g) => (r.tama && r.tama[g]) | 0;
function addTama(r, g, n) { r.tama = r.tama || {}; r.tama[g] = Math.max(0, tamaOf(r, g) + n); }
const gameOf = g => /^[a-z0-9]{2,8}$/.test(g || '') ? g : 'go';
// 戦績のまとめ（全ゲーム共通で、プロフィールに出す）。{ go9: { rating, games, wins, draws, streak, rank, rn } … }
function cleanStats(s) {
  if (!s || typeof s !== 'object') return null;
  const out = {}; let n = 0;
  const num = v => Math.max(0, Math.min(1e6, v | 0));
  for (const [k, v] of Object.entries(s)) {
    if (!/^[a-z0-9]{2,10}$/.test(k) || !v || typeof v !== 'object' || ++n > 6) continue;
    out[k] = { rating: num(v.rating), games: num(v.games), wins: num(v.wins), draws: num(v.draws), streak: num(v.streak), rank: num(v.rank), rn: String(v.rn || '').slice(0, 6) };
  }
  return out;
}
// 新しい場所が開いたとき（対局数）に、キャラからもらえるもの
const UNLOCK_GIFT = {
  rec: { label: '巴からのおくりもの（扇子）', av: ['tool:t13'] },
  av: { label: 'ひなたのお近づきキャンペーン品（ネオンパーカー）', av: ['body:b05'] },
  room: { label: '静馬からのおわびの品（碁盤）', items: ['goban'] },
  kotto: { label: '玄斎からの近づきのしるし（青磁の壺）', items: ['tsubo'] }
};
// はじめてそのゲームのアプリに入ったら、そのゲームの記念品（ほかのゲームでも使える）をプレゼントボックスへ
const GAME_PACK = {
  go: { label: '囲碁BLITZ 記念品（碁打ちのアバターと囲碁の家具）', av: ['head:h40', 'body:b13', 'tool:t13', 'bg:bg08'], items: ['goke', 'igostatue', 'gobanrug'] }
};
function gamePack(r, game, now) {
  const pk = GAME_PACK[game]; if (!pk || !r.owned) return;
  r.packs = r.packs || {}; if (r.packs[game]) return;
  r.packs[game] = 1; addGift(r, 'pack', 0, pk.label, now, { av: pk.av, items: pk.items });
}
// 部屋は最大6つ（はじめの部屋＋5）。1つ増やすのに 10000銭
const ROOM_MAX = 6, ROOM_PRICE = 10000, BIG_N = 17, BIG_PRICE = 5000;
const defAt = i => i === 1 ? { p: 0, d: 'x' } : i === 2 ? { p: 0, d: 'y' } : { p: i - 1, d: 'x' };   // 位置の記録がない部屋（はじめのころに買った部屋）
// 部屋の配置を確かめる：持っている数より多く置いていない・範囲の中・床と壁紙は持っているもの
function cleanRoom(room, owned, total, n) {
  n = n || 12;
  if (!room || typeof room !== 'object') return null;
  const cnt = {}, items = [], walls = [];
  const num = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
  for (const it of (Array.isArray(room.items) ? room.items : []).slice(0, 200)) {
    if (!it || !ITEMS[it.k] || ITEMS[it.k][1] === 'w' || !num(it.x, 0, n - 1) || !num(it.y, 0, n - 1)) return null;
    cnt[it.k] = (cnt[it.k] || 0) + 1;
    items.push({ uid: it.uid | 0, k: it.k, x: it.x, y: it.y, rot: it.rot ? 1 : 0, on: !!it.on, s: [0.5, 1.5, 2].includes(it.s) ? it.s : 1 });   // s：大きさ（0.5・1・1.5・2倍）
  }
  for (const it of (Array.isArray(room.walls) ? room.walls : []).slice(0, 100)) {
    if (!it || !ITEMS[it.k] || ITEMS[it.k][1] !== 'w' || !num(it.u, 0, n - 1) || (it.side !== 'L' && it.side !== 'R')) return null;
    cnt[it.k] = (cnt[it.k] || 0) + 1;
    walls.push({ uid: it.uid | 0, k: it.k, side: it.side, u: it.u, on: !!it.on, s: [0.5, 1.5, 2].includes(it.s) ? it.s : 1 });
  }
  for (const [k, n] of Object.entries(cnt)) { if (n > (owned.items[k] || 0)) return null; if (total) total[k] = (total[k] || 0) + n; }
  const floor = owned.floors.includes(room.floor) ? room.floor : 'wood', wall = owned.walls.includes(room.wall) ? room.wall : 'plain';
  const av = room.av && num(room.av.x, 0, n - 1) && num(room.av.y, 0, n - 1) ? { x: room.av.x, y: room.av.y } : undefined;   // 部屋の持ち主（アバター）の立ち位置
  const g = typeof room.g === 'string' && /^[a-z]{2,10}$/.test(room.g) ? room.g : undefined;   // この部屋に呼んだキャラ（1部屋に1人）
  const gp = g && room.gp && num(room.gp.x, 0, n - 1) && num(room.gp.y, 0, n - 1) ? { x: room.gp.x, y: room.gp.y } : undefined;
  return { floor, wall, items, walls, av, g, gp };
}

/* ---------- 使いすぎ対策の数字 ---------- */
const LIMIT = { perSec: 2, burst: 30, dropsToClose: 60, connPerIp: 8, registersPerHour: 5, syncBytes: 100000 };

