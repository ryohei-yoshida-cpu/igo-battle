/* 九路 Blitz — 対人戦サーバーの中身（Cloudflare でも、手元の Node でも同じものを使う）
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
 *
 * アカウントの保存先は store（Cloudflare では Durable Object のストレージ、手元ではメモリ）。
 * パスワードはそのまま保存せず、ハッシュ（SHA-256）にして保存する。
 */
const ALPH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // まぎらわしい 0/O/1/I は使わない
function randCode(n) { const a = new Uint8Array(n); crypto.getRandomValues(a); let s = ''; for (const x of a) s += ALPH[x % ALPH.length]; return s; }
async function sha(text) { const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)); return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join(''); }
export const normCode = v => String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
export function memStore() { const m = new Map(); return { get: async k => m.get(k), put: async (k, v) => { m.set(k, v); } }; }
import { ITEMS, FLOORS, WALLS } from './prices.js';
export const MAIN_MS = 5 * 60 * 1000, INC_MS = 5000, AWAY_MS = 180 * 1000, START_DELAY_MS = 2500;

export class Core {
  constructor(opts = {}) {
    this.now = opts.now || (() => Date.now());
    this.setTimeout = opts.setTimeout || ((f, ms) => setTimeout(f, ms));
    this.clearTimeout = opts.clearTimeout || (t => clearTimeout(t));
    this.players = new Map();   // cid → { cid, name, rating, ava, sock, seekAt, game }
    this.socks = new Map();     // sock → cid
    this.games = new Map();     // g → game
    this.seq = 0;
    this.store = opts.store || memStore();
    this.sockInfo = new Map();  // sock → { acct }
  }

  /* ---------- 接続 ---------- */
  connect(sock) {
    return {
      message: raw => { try { const r = this.onMessage(sock, raw); if (r && r.catch) r.catch(() => {}); } catch (e) { /* 壊れたメッセージは無視 */ } },
      close: () => this.onClose(sock)
    };
  }
  send(cid, msg) {
    const pl = this.players.get(cid);
    if (pl && pl.sock) { try { pl.sock.send(JSON.stringify(msg)); } catch (e) {} }
  }
  lobby() {
    let online = 0, seeking = 0;
    for (const p of this.players.values()) { if (p.sock) online++; if (p.seekAt) seeking++; }
    const msg = { t: 'lobby', online, seeking };
    for (const p of this.players.values()) if (p.sock) this.send(p.cid, msg);
  }

  onMessage(sock, raw) {
    if (typeof raw !== 'string' || raw.length > 300000) return;
    const m = JSON.parse(raw);
    if (m.t === 'register' || m.t === 'login' || m.t === 'sync') return this.account(sock, m);
    if (ECON.includes(m.t)) return this.econ(sock, m);
    if (raw.length > 4000) return;
    if (m.t === 'hello') return this.hello(sock, m);
    const cid = this.socks.get(sock); if (!cid) return;
    const pl = this.players.get(cid);
    switch (m.t) {
      case 'ping': sock.send(JSON.stringify({ t: 'pong', now: this.now() })); break;
      case 'seek': if (!pl.game) { pl.seekAt = pl.seekAt || this.now() || 1; this.match(); this.lobby(); } break;
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
    const si = this.sockInfo.get(sock); if (si && si.acct) pl.acct = si.acct;
    pl.rating = Math.max(0, Math.min(4000, m.rating | 0));
    pl.ava = Math.max(0, Math.min(20, m.ava | 0));
    pl.sock = sock;
    this.players.set(cid, pl); this.socks.set(sock, cid);
    // 対局の途中で切れていた → 再開
    const g = pl.game && this.games.get(pl.game);
    if (g && !g.over) {
      const c = g.colorOf[cid];
      if (g.away[c]) { this.clearTimeout(g.away[c].timer); g.away[c] = null; this.send(g.players[3 - c], { t: 'back', g: g.id }); }
      this.send(cid, { t: 'resume', g: g.id, color: c, opp: this.pub(g.players[3 - c]), clock: this.clocks(g), toPlay: g.toPlay, moves: g.moves, oppAway: !!g.away[3 - c], scoring: g.scoring });
    } else if (g && g.over) {
      if (!g.acked[cid]) { this.send(cid, g.endMsg); g.acked[cid] = true; }
      pl.game = null;
    } else if (pl.game && !g) pl.game = null;
    this.lobby();
  }

  /* ---------- アカウント（保存データ） ---------- */
  async account(sock, m) {
    const info = this.sockInfo.get(sock) || { acct: null };
    this.sockInfo.set(sock, info);
    const out = msg => { try { sock.send(JSON.stringify(msg)); } catch (e) {} };
    if (m.t === 'register') {
      let id; do { id = randCode(8); } while (await this.store.get('acct:' + id));
      const pass = randCode(8);
      const rec = { h: await sha(id + ':' + pass), data: null, at: 0, created: this.now() };
      ensureEcon(rec);
      await this.store.put('acct:' + id, rec);
      this.bindAcct(sock, info, id);
      out({ t: 'account', id, pass, data: null, at: 0, fresh: true, econ: pubEcon(rec) });
    } else if (m.t === 'login') {
      const id = normCode(m.id), pass = normCode(m.pass);
      const rec = id && await this.store.get('acct:' + id);
      if (!rec || rec.h !== await sha(id + ':' + pass)) { out({ t: 'authfail', restore: !!m.restore }); return; }
      this.bindAcct(sock, info, id);
      const rec2 = await this.withAcct(id, async r => { ensureEcon(r); return true; });
      out({ t: 'account', id, data: rec.data, at: rec.at || 0, restore: !!m.restore, econ: pubEcon(rec2 || rec) });
    } else if (m.t === 'sync') {
      if (!info.acct || !m.data || typeof m.data !== 'object') return;
      const at = +m.at || this.now();
      // 銭と部屋はサーバーが正なので、アプリから送られてきても使わない
      const data = Object.assign({}, m.data); delete data.zeni; delete data.room;
      const ok = await this.withAcct(info.acct, async rec => {
        if (at < (rec.at || 0)) return false;   // 古いデータで上書きしない
        rec.data = data; rec.at = at; return true;
      });
      out({ t: 'synced', at, stale: ok === false });
    }
  }

  bindAcct(sock, info, id) {
    info.acct = id;
    const cid = this.socks.get(sock), pl = cid && this.players.get(cid);
    if (pl) pl.acct = id;
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
  // 銭をふやす（対人戦・Bot戦・レクチャーなど）。つながっていれば新しい残高を知らせる
  async give(id, amount, why, sock) {
    if (!id || !amount) return;
    const rec = await this.withAcct(id, async r => { ensureEcon(r); r.zeni += amount; });
    if (!rec) return;
    const msg = { t: 'zeni', zeni: rec.zeni, gained: amount, why };
    if (sock) { try { sock.send(JSON.stringify(msg)); } catch (e) {} }
    else for (const p of this.players.values()) if (p.acct === id && p.sock) { try { p.sock.send(JSON.stringify(msg)); } catch (e) {} }
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
      this.botGames.set(id + ':' + gid, { t0: this.now(), lv: Math.max(0, Math.min(9, m.lv | 0)), solo: !!m.solo });
      if (this.botGames.size > 5000) this.botGames.delete(this.botGames.keys().next().value);
    } else if (m.t === 'botend') {
      const key = id + ':' + String(m.g || '').slice(0, 40), bg = this.botGames && this.botGames.get(key);
      if (!bg) return;
      this.botGames.delete(key);
      const sec = (this.now() - bg.t0) / 1000, moves = m.moves | 0;
      if (m.result !== 'win' && m.result !== 'draw') return;
      if (sec < 30 || moves < 16) { out({ t: 'zeni', gained: 0, why: 'short' }); return; }   // 早すぎる・短すぎる対局は数えない
      let amount = bg.solo ? 30 : 20 + 5 * bg.lv;
      if (m.result === 'draw') amount = Math.round(amount / 2);
      const rec = await this.withAcct(id, async r => {
        ensureEcon(r);
        if (r.daily.day !== day) r.daily = { day, bot: 0 };
        amount = Math.max(0, Math.min(amount, BOT_DAILY - r.daily.bot));
        r.daily.bot += amount; r.zeni += amount;
      });
      if (rec) out({ t: 'zeni', zeni: rec.zeni, gained: amount, why: amount ? 'bot' : 'cap' });
    } else if (m.t === 'claim') {
      // レクチャー初クリア 20 銭、ドリル（1問1回まで）3 銭
      const kind = m.kind === 'lesson' ? 'lesson' : m.kind === 'drill' ? 'drill' : null;
      const cid = String(m.id || '').slice(0, 24); if (!kind || !/^[\w:.-]+$/.test(cid)) return;
      const amount = kind === 'lesson' ? 20 : 3, limit = kind === 'lesson' ? 60 : 400;
      let gained = 0;
      const rec = await this.withAcct(id, async r => {
        ensureEcon(r);
        const list = r.claims[kind] = r.claims[kind] || [];
        if (list.includes(cid) || list.length >= limit) return;
        list.push(cid); r.zeni += amount; gained = amount;
      });
      if (rec) out({ t: 'zeni', zeni: rec.zeni, gained, why: kind });
    } else if (m.t === 'buy') {
      let ok = false, reason = '';
      const rec = await this.withAcct(id, async r => {
        ensureEcon(r);
        let price, apply;
        if (m.item && ITEMS[m.item]) { price = ITEMS[m.item][0]; apply = () => { r.owned.items[m.item] = (r.owned.items[m.item] || 0) + 1; }; }
        else if (m.floor && FLOORS[m.floor] != null) { if (r.owned.floors.includes(m.floor)) { reason = 'have'; return; } price = FLOORS[m.floor]; apply = () => r.owned.floors.push(m.floor); }
        else if (m.wall && WALLS[m.wall] != null) { if (r.owned.walls.includes(m.wall)) { reason = 'have'; return; } price = WALLS[m.wall]; apply = () => r.owned.walls.push(m.wall); }
        else { reason = 'item'; return; }
        if (r.zeni < price) { reason = 'zeni'; return; }
        r.zeni -= price; apply(); ok = true;
      });
      if (rec) out({ t: 'bought', ok, reason, req: m.req, econ: pubEcon(rec) });
    } else if (m.t === 'room') {
      // 模様替えを終えたときに届く部屋の配置。持っていない家具が置かれていないか確かめる
      let ok = false;
      const rec = await this.withAcct(id, async r => {
        ensureEcon(r);
        const room = cleanRoom(m.room, r.owned);
        if (!room) return;
        r.room = room; ok = true;
      });
      if (rec) out({ t: 'roomsaved', ok, econ: ok ? undefined : pubEcon(rec) });
    }
  }

  onClose(sock) {
    this.sockInfo.delete(sock);
    const cid = this.socks.get(sock); this.socks.delete(sock);
    if (!cid) return;
    const pl = this.players.get(cid); if (!pl || pl.sock !== sock) return;
    pl.sock = null; pl.seekAt = 0;
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

  pub(cid) { const p = this.players.get(cid); return p ? { name: p.name, rating: p.rating, ava: p.ava } : { name: '？', rating: 1050, ava: 0 }; }
  gameOf(pl, gid) { const g = this.games.get(gid); return g && g.colorOf[pl.cid] ? g : null; }

  /* ---------- マッチング：待っている人どうし、レートの近い順に ---------- */
  match() {
    const q = [...this.players.values()].filter(p => p.seekAt && p.sock && !p.game).sort((a, b) => a.seekAt - b.seekAt);
    while (q.length >= 2) {
      const a = q.shift();
      let bi = 0, best = Infinity;
      q.forEach((b, i) => { const d = Math.abs(a.rating - b.rating); if (d < best) { best = d; bi = i; } });
      const b = q.splice(bi, 1)[0];
      this.create(a, b);
    }
  }
  create(a, b) {
    const id = 'g' + (++this.seq) + '-' + Math.random().toString(36).slice(2, 7);
    const black = Math.random() < 0.5 ? a : b, white = black === a ? b : a;
    const g = {
      id, players: { 1: black.cid, 2: white.cid }, colorOf: { [black.cid]: 1, [white.cid]: 2 },
      moves: [], clock: { 1: MAIN_MS, 2: MAIN_MS }, toPlay: 1, turnStart: this.now() + START_DELAY_MS,
      passes: 0, over: false, scoring: false, away: { 1: null, 2: null }, timer: null, acked: {}, endMsg: null
    };
    this.games.set(id, g);
    for (const p of [black, white]) { p.seekAt = 0; p.game = id; }
    for (const c of [1, 2]) this.send(g.players[c], { t: 'start', g: id, color: c, opp: this.pub(g.players[3 - c]), clock: this.clocks(g), delay: START_DELAY_MS });
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
    const p = m.p | 0; if (p < -1 || p > 80) return;
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

  finish(g, winner, reason, res) {
    if (g.over) return;
    g.over = true; this.clearTimeout(g.timer);
    for (const c of [1, 2]) if (g.away[c]) this.clearTimeout(g.away[c].timer);
    g.endMsg = { t: 'end', g: g.id, winner, reason, res: res || null, moves: g.moves };
    // 対人戦の銭：勝ち 80、持碁 40（8手未満で終わった対局は出さない）
    if (g.moves.length >= 8) for (const c of [1, 2]) {
      const p = this.players.get(g.players[c]);
      const amount = winner === c ? ONLINE_WIN : winner === 0 ? ONLINE_WIN / 2 : 0;
      if (p && p.acct && amount) this.give(p.acct, amount, 'online').catch(() => {});
    }
    for (const c of [1, 2]) this.send(g.players[c], g.endMsg);
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

/* ---------- 銭まわりの決まり ---------- */
const ECON = ['botstart', 'botend', 'claim', 'buy', 'room'];
const BOT_DAILY = 600, ONLINE_WIN = 80;
// アカウントに銭・持ち物・部屋がなければ作る。前のバージョンのデータがあれば、上限つきで引き継ぐ
function ensureEcon(r) {
  if (r.econV === 1) { r.daily = r.daily || { day: '', bot: 0 }; r.claims = r.claims || {}; return; }
  const d = r.data || {}, old = d.room || {};
  r.zeni = Math.min(3000, Math.max(300, (d.zeni | 0) || 300));
  r.owned = { items: { goban: 1 }, floors: ['wood'], walls: ['plain'] };
  let value = 0;
  const add = k => { if (ITEMS[k] && k !== 'goban' && value + ITEMS[k][0] <= 6000) { value += ITEMS[k][0]; r.owned.items[k] = (r.owned.items[k] || 0) + 1; } };
  for (const it of (old.items || []).concat(old.walls || [])) if (it) add(it.k);
  for (const [k, n] of Object.entries(old.inv || {})) for (let i = 0; i < Math.min(n | 0, 20); i++) add(k);
  for (const f of ((old.owned || {}).floors || [])) if (FLOORS[f] != null && !r.owned.floors.includes(f) && value + FLOORS[f] <= 6000) { value += FLOORS[f]; r.owned.floors.push(f); }
  for (const w of ((old.owned || {}).walls || [])) if (WALLS[w] != null && !r.owned.walls.includes(w) && value + WALLS[w] <= 6000) { value += WALLS[w]; r.owned.walls.push(w); }
  const def = { floor: 'wood', wall: 'plain', items: [{ uid: 1, k: 'goban', x: 5, y: 5, rot: 0, on: false }], walls: [] };
  r.room = (Array.isArray(old.items) && old.items.length ? cleanRoom(old, r.owned) : null) || def;
  r.daily = { day: '', bot: 0 }; r.claims = {};
  r.econV = 1;
}
function pubEcon(r) { return { zeni: r.zeni, owned: r.owned, room: r.room }; }
// 部屋の配置を確かめる：持っている数より多く置いていない・範囲の中・床と壁紙は持っているもの
function cleanRoom(room, owned) {
  if (!room || typeof room !== 'object') return null;
  const cnt = {}, items = [], walls = [];
  const num = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
  for (const it of (Array.isArray(room.items) ? room.items : []).slice(0, 200)) {
    if (!it || !ITEMS[it.k] || ITEMS[it.k][1] === 'w' || !num(it.x, 0, 11) || !num(it.y, 0, 11)) return null;
    cnt[it.k] = (cnt[it.k] || 0) + 1;
    items.push({ uid: it.uid | 0, k: it.k, x: it.x, y: it.y, rot: it.rot ? 1 : 0, on: !!it.on });
  }
  for (const it of (Array.isArray(room.walls) ? room.walls : []).slice(0, 100)) {
    if (!it || !ITEMS[it.k] || ITEMS[it.k][1] !== 'w' || !num(it.u, 0, 11) || (it.side !== 'L' && it.side !== 'R')) return null;
    cnt[it.k] = (cnt[it.k] || 0) + 1;
    walls.push({ uid: it.uid | 0, k: it.k, side: it.side, u: it.u, on: !!it.on });
  }
  for (const [k, n] of Object.entries(cnt)) if (n > (owned.items[k] || 0)) return null;
  const floor = owned.floors.includes(room.floor) ? room.floor : 'wood', wall = owned.walls.includes(room.wall) ? room.wall : 'plain';
  return { floor, wall, items, walls };
}
