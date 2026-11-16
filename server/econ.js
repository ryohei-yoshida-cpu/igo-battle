/* 銭・勾玉・持ち物・部屋・プレゼント（サーバーが正。アプリから送られてきた数字は使わない） */
import { countShapes, addMissions, missionsOf, MISSIONS, MISSION_ZENI, MISSION_ALL } from './missions.js';
import { START_RATE, applyRate, botRating, dispRank, rankGift, rankItems, rateOf } from './rating.js';
import { ITEMS, FLOORS, WALLS, SEASON } from './prices.js';
import '../common/avatar-art.js';
// 季節（日本時間）：春 3〜5月・夏 6〜8月・秋 9〜11月・冬 12〜2月
export const EVENTS = { newyear: ['12-26', '01-07'], hina: ['02-15', '03-03'], kodomo: ['04-20', '05-05'], tanabata: ['06-25', '07-07'], tsukimi: ['09-01', '09-30'], halloween: ['10-15', '10-31'], xmas: ['12-01', '12-25'] };   // 行事の限定（common/room-art.js と同じ）
export const seasonOf = t => { const m = new Date(t + 9 * 3600e3).getUTCMonth() + 1; return m >= 3 && m <= 5 ? 'spring' : m >= 6 && m <= 8 ? 'summer' : m >= 9 && m <= 11 ? 'autumn' : 'winter'; };
export function limitOpen(tag, t) {
  if (['spring', 'summer', 'autumn', 'winter'].includes(tag)) return seasonOf(t) === tag;
  const e = EVENTS[tag]; if (!e) return false;
  const d = new Date(t + 9 * 3600e3), md = String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0');
  return e[0] <= e[1] ? md >= e[0] && md <= e[1] : md >= e[0] || md <= e[1];
}
export const AVP = globalThis.AVATAR.PRICE, AV_SEASON = globalThis.AVATAR.SEASON || {};

/* ---------- 銭まわりの決まり ---------- */
export const ECON = ['botstart', 'botend', 'claim', 'buy', 'sell', 'offer', 'tama', 'ratereset', 'room', 'gifts', 'gifttake', 'rankup', 'dm'];
export const BOT_DAILY = 2000, GAME_ZENI = 100, EPISODE_ZENI = 500, WELCOME = 3000, RANKUP = 1000, DAILY = 100;
// プレゼントボックス：受け取るまで銭にならない。{ id, kind, amount, label, t }
export function addGift(r, kind, amount, label, t, extra) {
  r.gifts = r.gifts || []; r.giftSeq = (r.giftSeq || 0) + 1;
  r.gifts.push(Object.assign({ id: r.giftSeq, kind, amount, label, t }, extra || {})); if (r.gifts.length > 50) r.gifts.shift();
}
// 毎日はじめてつないだら 100銭（日本時間の日付）
export function dailyGift(r, now) {
  const day = new Date(now + 9 * 3600e3).toISOString().slice(0, 10);
  if (r.loginDay === day) return false;
  r.loginDay = day; addGift(r, 'daily', DAILY, 'ログインボーナス（' + day.slice(5).replace('-', '/') + '）', now); return true;
}
// アカウントに銭・持ち物・部屋がなければ作る。前のバージョンのデータがあれば、上限つきで引き継ぐ
export function ensureEcon(r) {
  // はじめて：3000銭のプレゼント（プレゼントボックスへ）。持ち物も部屋も空っぽから（碁盤は静馬からもらう）
  if (!r.owned) {
    r.zeni = 0;
    addGift(r, 'welcome', WELCOME, 'はじめてのプレゼント', Date.now());
    r.owned = { items: {}, floors: ['wood'], walls: ['plain'], av: [] };
    r.room = { floor: 'wood', wall: 'plain', items: [], walls: [] };
    r.daily = { day: '', bot: 0 }; r.claims = {};
    r.welcome = true;
  }
  if (r.rate) rankItems(r, Date.now());   // とどいた段級位の記念品
}
// 骨董屋で売ったときの、玄斎からのおくりもの（x は 0〜1 の乱数）
//   1/256 持っていない 2000銭以上のアバター / 1/64 1200〜1500銭のアバター / 1/16 600銭の家具 / 1/8 300銭以下の家具
export function antiqueGift(r, x) {
  const pick = a => a.length ? a[Math.floor(Math.random() * a.length)] : null;
  const avs = (lo, hi) => Object.entries(AVP).filter(([k, p]) => p >= lo && p <= hi && !r.owned.av.includes(k)).map(([k]) => k);
  const items = f => Object.entries(ITEMS).filter(([k, v]) => f(v[0]) && !SEASON[k]).map(([k]) => k);   // 季節限定は出さない
  let id = null, kind = 'item';
  if (x < 1 / 256) { id = pick(avs(2000, 1e9)); kind = 'av'; }
  else if (x < 1 / 256 + 1 / 64) { id = pick(avs(1200, 1500)); kind = 'av'; }
  else if (x < 1 / 256 + 1 / 64 + 1 / 16) id = pick(items(p => p === 600));
  else if (x < 1 / 256 + 1 / 64 + 1 / 16 + 1 / 8) id = pick(items(p => p > 0 && p <= 300));
  return id ? { kind, id } : null;
}
// 2026/11/15 取りやめた家具（線で描いた家具・角度の合わない絵の家具）と、その値段。持っていた人には、銭をおかえし
// 足もとのないアバターの服（2026/11/14 取りやめ）。持っていた人には、銭をおかえし
export function pubEcon(r) { return { dm: missionsOf(r, Date.now()), zeni: r.zeni, owned: r.owned, room: r.room, rooms2: r.rooms2 || [], av: r.av || null, pid: r.pid || null, gifts: r.gifts || [], tama: r.tama || {}, charas: r.charas || {}, stats: r.stats || {}, rates: { go9: rateOf(r, 'go9'), go13: rateOf(r, 'go13') } }; }
/* ---------- 勾玉（課金石）：アプリ（ゲーム）ごとに持つ。お金で買った分は、そのアプリの中だけで使う（Google Play のきまり） ---------- */
export const TAMA = globalThis.AVATAR.TAMA || {}, TAMA_ZENI = 10, TAMA_CHARA = 300;
export const tamaOf = (r, g) => (r.tama && r.tama[g]) | 0;
export function addTama(r, g, n) { r.tama = r.tama || {}; r.tama[g] = Math.max(0, tamaOf(r, g) + n); }
export const gameOf = g => /^[a-z0-9]{2,8}$/.test(g || '') ? g : 'go';
// 戦績のまとめ（全ゲーム共通で、プロフィールに出す）。{ go9: { rating, games, wins, draws, streak, rank, rn } … }
export function cleanStats(s) {
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
// 開放のイベントでもらうもの。すぐ使えるように、プレゼントボックスを通さずに直接わたす
//   rec：「戦歴」を見たら、巴からお駄賃の扇子 ／ av：ひなたからお祝いの300銭 ／ room：静馬の800銭のクーポン券（碁盤が買える）
//   kotto：玄斎が投げ捨てたドライフラワー（壁の家具。骨董屋で売ってみる）
export const UNLOCK_GIFT = {
  rec: { label: '巴からのお駄賃（扇子）', av: ['tool:t13'] },
  av: { label: 'ひなたからのお祝い', zeni: 300 },
  room: { label: '静馬のクーポン券', zeni: 800 },
  kotto: { label: '玄斎が投げ捨てた花束', items: ['w_dryflower'] }
};
// ゲームの記念品：あるゲームで遊んでいる人が、はじめて「ほかのゲーム」のアプリに入ったら、前のゲームの記念品をプレゼントボックスへ
//   （例：囲碁BLITZで遊んでいた人が将棋BLITZをはじめたら、将棋BLITZで囲碁の記念品がもらえる。同じゲームの中ではもらえない）
export const GAME_PACK = {
  go: { label: '囲碁BLITZ 記念品（碁打ちのアバターと囲碁の家具）', av: ['head:h40', 'body:b13', 'tool:t13', 'bg:bg08'], items: ['goishi_hako', 'zaisu', 'goishi_kazari'] }
};
export function gamePack(r, game, now) {
  if (!r.owned || !game) return;
  r.packs = r.packs || {}; r.packGot = r.packGot || {};
  if (r.packs[game]) return;   // このゲームには前にも入った
  const before = Object.keys(r.packs);   // 前から遊んでいるゲーム
  r.packs[game] = 1;
  for (const g of before) {
    const pk = GAME_PACK[g];
    if (g === game || !pk || r.packGot[g]) continue;
    r.packGot[g] = 1; addGift(r, 'pack', 0, pk.label, now, { av: pk.av, items: pk.items });
  }
}
// 部屋は最大6つ（はじめの部屋＋5）。1つ増やすのに 10000銭
export const ROOM_MAX = 20, ROOM_PRICE = 10000, BIG_N = 17, BIG_PRICE = 5000;
// 上限：1部屋に置ける家具（床＋壁）99個・同じ家具を持てるのは99個まで・全部屋あわせて置けるのは600個まで（保存の大きさを守るため）
export const ROOM_LIM = { perRoom: 99, perKind: 99, total: 600 };
export const defAt = i => i === 1 ? { p: 0, d: 'x' } : i === 2 ? { p: 0, d: 'y' } : { p: i - 1, d: 'x' };   // 位置の記録がない部屋（はじめのころに買った部屋）
// 部屋の配置を確かめる：持っている数より多く置いていない・範囲の中・床と壁紙は持っているもの
export function cleanRoom(room, owned, total, n) {
  n = n || 12;
  if (!room || typeof room !== 'object') return null;
  const cnt = {}, items = [], walls = [];
  const num = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
  if ((Array.isArray(room.items) ? room.items.length : 0) + (Array.isArray(room.walls) ? room.walls.length : 0) > ROOM_LIM.perRoom) return null;
  for (const it of (Array.isArray(room.items) ? room.items : [])) {
    if (!it || !ITEMS[it.k] || ITEMS[it.k][1] === 'w' || !num(it.x, 0, n - 1) || !num(it.y, 0, n - 1)) return null;
    cnt[it.k] = (cnt[it.k] || 0) + 1;
    // 小さく保存：rot・on・s はふつうの値なら書かない（s：大きさ 0.5・1.5・2倍）
    const o = { uid: it.uid | 0, k: it.k, x: it.x, y: it.y }; if (it.rot) o.rot = 1; if (it.on) o.on = true; if ([0.5, 1.5, 2].includes(it.s)) o.s = it.s;
    items.push(o);
  }
  for (const it of (Array.isArray(room.walls) ? room.walls : [])) {
    if (!it || !ITEMS[it.k] || ITEMS[it.k][1] !== 'w' || !num(it.u, 0, n - 1) || (it.side !== 'L' && it.side !== 'R')) return null;
    cnt[it.k] = (cnt[it.k] || 0) + 1;
    const o = { uid: it.uid | 0, k: it.k, side: it.side, u: it.u }; if (it.on) o.on = true; if ([0.5, 1.5, 2].includes(it.s)) o.s = it.s;
    walls.push(o);
  }
  for (const [k, n] of Object.entries(cnt)) { if (n > (owned.items[k] || 0)) return null; if (total) total[k] = (total[k] || 0) + n; }
  const floor = owned.floors.includes(room.floor) ? room.floor : 'wood', wall = owned.walls.includes(room.wall) ? room.wall : 'plain';
  const av = room.av && num(room.av.x, 0, n - 1) && num(room.av.y, 0, n - 1) ? { x: room.av.x, y: room.av.y } : undefined;   // 部屋の持ち主（アバター）の立ち位置
  const g = typeof room.g === 'string' && /^[a-z]{2,10}$/.test(room.g) ? room.g : undefined;   // この部屋に呼んだキャラ（1部屋に1人）
  const gp = g && room.gp && num(room.gp.x, 0, n - 1) && num(room.gp.y, 0, n - 1) ? { x: room.gp.x, y: room.gp.y } : undefined;
  return { floor, wall, items, walls, av, g, gp };
}

/* ---------- やりとり（Core に足す） ---------- */
export class EconMethods {
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

  // デイリーミッションに1局ぶん足す。クリアがあればプレゼントボックスと、ミッションの進み具合を知らせる
  async missionGame(id, add, sock) {
    let cleared = [];
    const rec = await this.withAcct(id, async r => { ensureEcon(r); cleared = addMissions(r, this.now(), add); });
    if (!rec) return;
    const msg = JSON.stringify({ t: 'dm', dm: missionsOf(rec, this.now()), cleared, gifts: cleared.length ? rec.gifts || [] : undefined });
    const socks = sock ? [sock] : [...this.players.values()].filter(p => p.acct === id && p.sock).map(p => p.sock);
    for (const s of socks) { try { s.send(msg); } catch (e) {} }
  }
  async rateBot(id, bg, score, gid) {
    const key = 'go' + (bg.size || 9); let t = null, d = 0;
    await this.withAcct(id, async r => { t = rateOf(r, key); const b = dispRank(t); d = applyRate(t, bg.lv < 0 ? 1000 : botRating(bg.lv), score, true); rankGift(r, key, b, t, this.now()); rankItems(r, this.now()); });
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
      // 始まりはアカウントに保存する（サーバーが入れかわっても、勝ち負けが消えないように）
      const bg = { gid, t0: this.now(), lv: m.lv === -1 ? -1 : Math.max(0, Math.min(13, m.lv | 0)), solo: !!m.solo, size: m.size === 13 ? 13 : 9, color: m.color === 2 ? 2 : 1 };
      let prev = null;
      await this.withAcct(id, async r => { prev = r.botg || null; r.botg = bg; });
      // 前の Bot 戦が終わらないまま新しく始めた（アプリを閉じた など）→ 前のは負けとして数える
      if (prev && !prev.solo && prev.gid !== gid) await this.rateBot(id, prev, 0);
    } else if (m.t === 'botend') {
      const gid = String(m.g || '').slice(0, 40), key = id + ':' + gid;
      if (!['win', 'draw', 'loss'].includes(m.result)) return;
      let bg = null;
      await this.withAcct(id, async r => { if (!r.botg || r.botg.gid !== gid) return false; bg = r.botg; delete r.botg; });
      if (!bg) return;
      const sec = (this.now() - bg.t0) / 1000, moves = m.moves | 0;
      const short = sec < 30 || moves < 16;
      if (!short) {   // 碁会所の対局数（キャラクター戦）。強さ以上のキャラクターに勝ったら月のランキングに数える
        this.guild.count(id, info.game || 'go', 'bot', false).catch(() => {});   // キャラクター戦は、月のランキングの勝ちには数えない
      }
      // レート：負けはいつでも数える。勝ち・引き分けは、早すぎる・短すぎる対局なら数えない
      if (!bg.solo && (m.result === 'loss' || !short)) await this.rateBot(id, bg, m.result === 'win' ? 1 : m.result === 'draw' ? 0.5 : 0, key);
      if (short) { out({ t: 'zeni', gained: 0, why: 'short' }); return; }   // 早すぎる・短すぎる対局は数えない
      // デイリーミッション：対局数と、手順から数えた形（アタリ・ケイマ・一間トビ・大ゲイマ）
      await this.missionGame(id, Object.assign({ games: 1 }, countShapes(bg.size, Array.isArray(m.rec) ? m.rec : [], bg.color, 0) || {}), sock);
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
        if (kind === 'unlock') {   // 開放のイベント：直接わたす
          const u = UNLOCK_GIFT[cid]; if (!u) return false;
          if (u.zeni) r.zeni += u.zeni;
          for (const a of u.av || []) if (!r.owned.av.includes(a)) r.owned.av.push(a);
          for (const k of u.items || []) if (ITEMS[k]) r.owned.items[k] = Math.min(ROOM_LIM.perKind, (r.owned.items[k] || 0) + 1);
          gained = -2; return;
        }   // 新しい場所が開いたときの、キャラからのおくりもの
        if (kind === 'tutorial') { addGift(r, 'welcome', amount, 'チュートリアルを最後まで受けたお礼（小春より）', this.now()); gained = -1; return; }   // チュートリアル完走（ゲームごとに1回）はプレゼントボックスへ
        r.zeni += amount; gained = amount;
      });
      if (rec && gained === -2) out({ t: 'claimed', req: m.req, kind, id: cid, econ: pubEcon(rec) });
      else if (rec && gained === -1) out({ t: 'gifts', gifts: rec.gifts || [], zeni: rec.zeni });
      else if (rec) out({ t: 'zeni', zeni: rec.zeni, gained, why: kind });
    } else if (m.t === 'dm') {   // 今日のデイリーミッション
      const r = await this.store.get('acct:' + id);
      out({ t: 'dm', req: m.req, dm: missionsOf(r || {}, this.now()), list: MISSIONS.map(x => ({ id: x.id, name: x.name, n: x.n })), zeni: MISSION_ZENI, all: MISSION_ALL });
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
            for (const k of g.items || []) if (ITEMS[k]) r.owned.items[k] = Math.min(ROOM_LIM.perKind, (r.owned.items[k] || 0) + 1);
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
        if (m.av && AV_SEASON[m.av] && !limitOpen(AV_SEASON[m.av], this.now()) && !r.owned.av.includes(m.av)) { reason = 'season'; return; }
        if (m.av && TAMA[m.av]) {
          // 勾玉で買う（勾玉限定のアイテム）。半額サービスはなし
          if (r.owned.av.includes(m.av)) { reason = 'have'; return; }
          const g = info.game || 'go', t = TAMA[m.av];
          if (tamaOf(r, g) < t) { reason = 'tama'; return; }
          addTama(r, g, -t); r.owned.av.push(m.av); ok = true; return;
        }
        if (m.av && AVP[m.av] > 0) { if (r.owned.av.includes(m.av)) { reason = 'have'; return; } price = AVP[m.av]; apply = () => r.owned.av.push(m.av); }
        else if (m.item && ITEMS[m.item] && ITEMS[m.item][0] <= 0) { reason = 'item'; return; }   // ごほうびの家具は売っていない
        else if (m.item && ITEMS[m.item]) { if (SEASON[m.item] && !limitOpen(SEASON[m.item], this.now())) { reason = 'season'; return; } if ((r.owned.items[m.item] || 0) >= ROOM_LIM.perKind) { reason = 'cap'; return; } price = ITEMS[m.item][0]; apply = () => { r.owned.items[m.item] = (r.owned.items[m.item] || 0) + 1; }; }
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
        else if (o.kind === 'item' && ITEMS[o.id]) { if ((r.owned.items[o.id] || 0) >= ROOM_LIM.perKind) return; r.owned.items[o.id] = (r.owned.items[o.id] || 0) + 1; ok = true; }
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
        if ([room].concat(rooms2).reduce((a, x) => a + x.items.length + x.walls.length, 0) > ROOM_LIM.total) return;   // 全部屋で600個まで
        r.room = room; r.rooms2 = rooms2; ok = true;
      });
      if (ok) this.social.roomChanged(id).catch(() => {});
      if (rec) out({ t: 'roomsaved', ok, econ: ok ? undefined : pubEcon(rec) });
    }
  }

}
