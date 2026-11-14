/* 共通：マイルームのつながり（囲碁・将棋・オセロなど、どのゲームでも同じアカウントで共有）
 *
 * 保存先
 *   acct:<ID>  … pid（部屋番号・6けた）、av（アバター）、owned.av（持っているパーツ）、room（部屋）、zeni
 *   pid:<番号> … 部屋番号 → アカウントID（ログイン用のIDは他人に見せない）
 *   soc:<ID>   … ひとこと・日記（コメントつき）・一言チャット・訪問数・足あと・フレンド・ブロック・コメント設定
 *
 * やりとり（アプリ → サーバー、すべて { t:'soc', op, req, ... }。返事は { t:'soc', op, req, ok, reason, ... }）
 *   me                      … 自分の部屋の情報（部屋番号・訪問数・足あと・フレンド・申請・ブロック）
 *   visit   { pid }         … 部屋をたずねる（ブロックされていたら入れない）。1日1人1回、訪問数に数える
 *   random                  … 最近にぎわっている部屋をひとつ
 *   hito    { text }        … 部屋の「ひとこと」
 *   diary   { title, text, pub, kifu } … 囲碁日記を書く（1日1回・題30字・本文300字・棋譜をひとつ添えられる）
 *                             pub: all みんな / friends フレンドだけ / me 自分だけ
 *   dlist   { pid }         … 日記の目次（見てよいものだけ）     dget { pid, did } … 日記1つ（コメントつき）
 *   dpub    { did, pub }    … 日記の公開範囲を変える            drandom … みんなの日記（公開の日記からランダムに5つ）
 *   comment { pid, did, text } … 日記にコメント
 *   flist   { page }        … フレンド一覧（部屋・アバター・最新の日記の題・最近の一言。20人ずつ）
 *   explore                 … みんなのルーム探訪（公開の部屋で、最近もようがえした部屋からランダムに5つ）
 *   rpub    { v }           … 自分の部屋を「みんなのルーム探訪」に出すか
 *   chat    { pid, text }   … 一言チャット
 *   del     { pid, kind, id, did } … 消す（部屋の持ち主は全部、書いた人は自分のものだけ）
 *   cset    { v }           … コメント・チャット：all 全員 / friends フレンドだけ / none 受け付けない
 *   block / unblock { pid } … ブロック（その人は部屋に入れない・書きこめない。フレンドも解除）
 *   freq / faccept / fdecline / unfriend { pid } … フレンド
 *   avatar  { look }        … アバターの着がえ（持っているパーツだけ）
 *   rank    { rank }        … 段級位が上がった → フレンドにお知らせ
 *   invite  { pid, code }   … 対人戦の申込 → 相手にお知らせ（フレンドマッチの合言葉つき）
 *   日記の本文は dia:<ID>:<番号> に1つずつ（目次は soc の diary）。半年（180日）たった日記は消える。
 *   公開の日記の一覧は pubdia、公開の部屋の一覧は pubrooms（どちらも最近のものだけ）
 *   （日記を書くと、フレンドにお知らせ）  お知らせは soc:<ID>.notes（最近30件）。つながっていれば op:'push' ですぐ届く
 */
import { check, cleanName } from './ng.js';
import '../common/avatar-art.js';
const AV = globalThis.AVATAR;

const LIM = {
  text: { hito: 40, diary: 300, title: 30, comment: 60, chat: 40 },
  diaryDays: 180, diaries: 180, pubdia: 300, pubrooms: 100, comments: 15, chats: 40, foot: 20, friends: 100, blocks: 200, freq: 30,
  postGapMs: 4000, postsPerDay: 80
};
const NG_MSG = { sexual: 'sexual', violent: 'violent', abuse: 'abuse', contact: 'contact' };

const newSoc = () => ({ hito: '', diary: [], diaryDay: '', rpub: true, chat: [], visits: { total: 0, day: '', today: 0, seen: [] }, foot: [], cset: 'all', blocks: [], friends: [], freq: [], notes: [], seq: 1 });
function fixSoc(s) { return Object.assign(newSoc(), s || {}); }
const has = (list, pid) => list.some(x => (x.pid || x) === pid);
const PUBS = ['all', 'friends', 'me'];
// 見てよい日記か（持ち主は全部、フレンドは「みんな」と「フレンドだけ」、ほかの人は「みんな」だけ）
const canSee = (d, mine, friend) => mine || d.pub === 'all' || (d.pub === 'friends' && friend);
const head = d => ({ id: d.id, t: d.t, title: d.title, pub: d.pub, kifu: !!d.kifu, nc: d.nc || 0 });
// 棋譜：{ size, rec:[打った点…], op, res } だけを、正しい形にして残す
function cleanKifu(k) {
  if (!k || typeof k !== 'object') return null;
  const size = k.size === 13 ? 13 : k.size === 9 ? 9 : 0; if (!size) return null;
  if (!Array.isArray(k.rec) || !k.rec.length || k.rec.length > 400) return null;
  const rec = k.rec.map(p => p | 0); if (rec.some(p => p < -1 || p >= size * size)) return null;
  return { size, rec, op: cleanName(k.op).slice(0, 16), res: ['win', 'loss', 'draw'].includes(k.res) ? k.res : '', color: k.color === 2 ? 2 : 1 };
}

// アカウントの名前（全ゲーム共通。前の形は data.name）
const acctName = a => { const n = a && (a.name || (a.data && a.data.name)); return n ? cleanName(n) : ''; };
export class Social {
  constructor(core) { this.core = core; this.active = []; this.posts = new Map(); }
  get store() { return this.core.store; }
  day() { return new Date(this.core.now() + 9 * 3600e3).toISOString().slice(0, 10); }

  // 鍵ごとに順番に読み書きする（同時に書いて消えないように）
  withKey(key, fn, make) {
    const c = this.core; c.locks = c.locks || new Map();
    const prev = c.locks.get(key) || Promise.resolve();
    const run = prev.then(async () => {
      let rec = await this.store.get(key);
      if (!rec) { if (!make) return null; rec = make(); }
      const r = await fn(rec);
      if (r !== false) await this.store.put(key, rec);
      return r === false ? false : rec;
    });
    c.locks.set(key, run.catch(() => {}));
    return run;
  }
  withSoc(id, fn) { return this.withKey('soc:' + id, async s => { Object.assign(s, fixSoc(s)); await this.migrate(id, s); return fn(s); }, newSoc); }
  // 前の形の日記（本文が目次の中にある）を、本文を別に保存する形へ。半年すぎた日記も、ここで消す
  async migrate(id, s) {
    const old = s.diary.filter(d => d.text != null && d.title == null);
    for (const d of old) {
      const body = { id: d.id, t: d.t, title: String(d.text).slice(0, 12) + (d.text.length > 12 ? '…' : ''), text: d.text, pub: 'friends', kifu: null, c: d.c || [] };
      await this.store.put(`dia:${id}:${d.id}`, body);
      Object.assign(d, head(body)); d.nc = body.c.length; delete d.text; delete d.c;
    }
    const limit = this.core.now() - LIM.diaryDays * 864e5;
    const gone = s.diary.filter((d, i) => d.t < limit || i >= LIM.diaries);
    if (gone.length) {
      s.diary = s.diary.filter(d => !gone.includes(d));
      for (const d of gone) if (this.store.del) await this.store.del(`dia:${id}:${d.id}`);
    }
    return old.length || gone.length;
  }
  // 読むだけ（前の形が残っていたら、一度だけ書きかえる）
  async readSoc(id) {
    const s = fixSoc(await this.store.get('soc:' + id));
    if (s.diary.some(d => d.text != null && d.title == null)) return fixSoc(await this.withSoc(id, () => {}));
    return s;
  }
  // 公開の一覧（みんなの日記・みんなの部屋）。新しいものを先頭に、古いものから消える
  pushList(key, item, same, max) {
    return this.withKey(key, list => { const l = list.filter(x => !same(x)); l.unshift(item); list.length = 0; list.push(...l.slice(0, max)); }, () => []);
  }
  dropList(key, same) { return this.withKey(key, list => { const l = list.filter(x => !same(x)); if (l.length === list.length) return false; list.length = 0; list.push(...l); }, null); }
  // もようがえを終えたとき（core.js から）：公開の部屋なら「みんなのルーム探訪」の一覧へ
  async roomChanged(id) {
    const s = fixSoc(await this.store.get('soc:' + id)); if (s.rpub === false) return;
    const pid = await this.ensurePid(id); if (!pid) return;
    await this.pushList('pubrooms', { pid, t: this.core.now() }, x => x.pid === pid, LIM.pubrooms);
  }

  // 部屋番号（6けた）。はじめて必要になったときに作る
  async ensurePid(id) {
    const rec = await this.store.get('acct:' + id); if (!rec) return null;
    for (const p of this.core.players.values()) if (p.acct === id && rec.av) p.av = rec.av;
    if (rec.pid) return rec.pid;
    let pid; do { pid = String(100000 + Math.floor(Math.random() * 900000)); } while (await this.store.get('pid:' + pid));
    await this.store.put('pid:' + pid, id);
    await this.core.withAcct(id, async r => { r.pid = pid; });
    return pid;
  }
  idOf(pid) { return this.store.get('pid:' + String(pid || '').replace(/\D/g, '').slice(0, 6)); }
  nameOf(id) { const p = [...this.core.players.values()].find(p => p.acct === id); return cleanName(p && p.name); }
  // お知らせを相手に届ける（保存して、つながっていればすぐ送る）
  async notify(oid, note) {
    const s = await this.withSoc(oid, s => {
      if (s.blocks.some(b => b.pid === note.pid)) return false;
      note.id = s.seq++; s.notes.unshift(note); s.notes = s.notes.slice(0, 30);
    });
    if (!s) return false;
    const item = Object.assign({ kind: 'note' }, note);
    for (const p of this.core.players.values()) if (p.acct === oid && p.sock) { try { p.sock.send(JSON.stringify({ t: 'soc', op: 'push', item })); } catch (e) {} }
    return true;
  }
  async notifyFriends(id, note) {
    const s = fixSoc(await this.store.get('soc:' + id));
    for (const f of s.friends.slice(0, 100)) { const oid = await this.idOf(f.pid); if (oid) await this.notify(oid, Object.assign({}, note)); }
  }
  touchActive(pid) { this.active = [pid].concat(this.active.filter(x => x !== pid)).slice(0, 60); }

  async handle(sock, info, m) {
    const out = msg => { try { sock.send(JSON.stringify(Object.assign({ t: 'soc', op: m.op, req: m.req }, msg))); } catch (e) {} };
    const id = info.acct; if (!id) { out({ ok: false, reason: 'auth' }); return; }
    const me = await this.ensurePid(id); if (!me) return;
    const myName = this.nameOf(id);
    const myAv = () => { const p = [...this.core.players.values()].find(p => p.acct === id); return (p && p.av) || null; };
    const op = m.op, now = this.core.now();
    const text = s => String(s || '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
    // 書きこみの回数制限と、言葉のチェック
    const gate = (t, kind) => {
      if (!t) return 'empty';
      if (t.length > LIM.text[kind]) return 'long';
      if (kind === 'hito') { const ng = check(t); return ng ? NG_MSG[ng] : null; }   // ひとことは設定なので回数に数えない
      const p = this.posts.get(id) || { at: 0, day: '', n: 0 };
      if (now - p.at < LIM.postGapMs) return 'fast';
      if (p.day === this.day() && p.n >= LIM.postsPerDay) return 'many';
      const ng = check(t); if (ng) return NG_MSG[ng];
      this.posts.set(id, { at: now, day: this.day(), n: p.day === this.day() ? p.n + 1 : 1 });
      if (this.posts.size > 5000) this.posts.delete(this.posts.keys().next().value);
      return null;
    };
    // 相手の部屋に書きこめるか（ブロック・コメント設定）
    const canWrite = (s, pid) => pid === me || (!has(s.blocks, me) && (s.cset === 'all' || (s.cset === 'friends' && has(s.friends, me))));

    if (op === 'me') {
      const s = await this.readSoc(id);
      out({ ok: true, pid: me, diary: s.diary.map(head), wrote: s.diaryDay === this.day(), rpub: s.rpub !== false, chat: s.chat.slice(0, 20), notes: s.notes.slice(0, 20), hito: s.hito, visits: { total: s.visits.total, today: s.visits.day === this.day() ? s.visits.today : 0 }, foot: s.foot, friends: s.friends, freq: s.freq, blocks: s.blocks, cset: s.cset, fsent: s.fsend && s.fsend.day === this.day() ? s.fsend.to : [] });
      return;
    }
    if (op === 'avatar') {
      let ok = false;
      const rec = await this.core.withAcct(id, async r => {
        const look = AV.clean(m.look);
        const owned = new Set((r.owned && r.owned.av) || []);
        for (const [slot] of AV.SLOTS) { const k = slot + ':' + (look[slot] || 'none'); if (AV.PRICE[k] !== 0 && !owned.has(k)) return false; }   // 勾玉限定（-1）も持っているものだけ
        for (const v of Object.values(look.ln || {})) if (AV.PRICE['line:' + v] !== 0 && !owned.has('line:' + v)) return false;   // 台詞も持っているものだけ
        r.av = look; ok = true;
      });
      if (ok) for (const p of this.core.players.values()) if (p.acct === id) p.av = rec.av;
      if (ok) for (const inf of this.core.sockInfo.values()) if (inf.acct === id) inf.av = rec.av;
      out({ ok, look: rec && rec.av });
      if (ok) this.touchActive(me);
      return;
    }
    if (op === 'random') {
      const list = this.active.filter(p => p !== me);
      out({ ok: !!list.length, pid: list.length ? list[Math.floor(Math.random() * list.length)] : null });
      return;
    }
    if (op === 'explore') {
      const list = ((await this.store.get('pubrooms')) || []).filter(x => x.pid !== me).slice(0, 40);
      const pick = list.sort(() => Math.random() - .5), rooms = [];
      for (const x of pick) {
        if (rooms.length >= 5) break;
        const oid = await this.idOf(x.pid); if (!oid) continue;
        const s = fixSoc(await this.store.get('soc:' + oid));
        if (s.rpub === false || has(s.blocks, me)) continue;
        const a = await this.store.get('acct:' + oid); if (!a) continue;
        rooms.push({ pid: x.pid, t: x.t, name: acctName(a) || 'プレイヤー', av: a.av || null, room: a.room || null, hito: s.hito, visits: s.visits.total });
      }
      out({ ok: true, rooms });
      return;
    }
    if (op === 'drandom') {
      const list = ((await this.store.get('pubdia')) || []).filter(x => x.pid !== me).sort(() => Math.random() - .5), items = [];
      for (const x of list) {
        if (items.length >= 5) break;
        if (items.some(i => i.pid === x.pid)) continue;   // 同じ人は1つだけ
        const s = fixSoc(await this.store.get('soc:' + x.oid));
        if (has(s.blocks, me)) continue;
        const d = s.diary.find(d => d.id === x.did); if (!d || d.pub !== 'all') continue;
        const body = await this.store.get(`dia:${x.oid}:${x.did}`); if (!body) continue;
        const a = await this.store.get('acct:' + x.oid);
        items.push({ pid: x.pid, name: acctName(a) || 'プレイヤー', av: (a && a.av) || null, id: body.id, t: body.t, title: body.title, text: body.text, kifu: body.kifu, nc: (body.c || []).length });
      }
      out({ ok: true, items });
      return;
    }
    if (op === 'flist') {
      const s = await this.readSoc(id), page = Math.max(0, m.page | 0), total = s.friends.length, list = [];
      for (const f of s.friends.slice(page * 20, page * 20 + 20)) {
        const oid = await this.idOf(f.pid); if (!oid) continue;
        const a = await this.store.get('acct:' + oid), fs = fixSoc(await this.store.get('soc:' + oid));
        const last = fs.diary.find(d => canSee(d, false, true));
        const mine = s.chat.find(c => c.pid === f.pid), theirs = fs.chat.find(c => c.pid === me);
        list.push({ pid: f.pid, name: acctName(a) || f.name, av: (a && a.av) || null, room: (a && a.room) || null, hito: fs.hito,
          diary: last ? { id: last.id, t: last.t, title: last.title } : null,
          from: mine ? { text: mine.text, t: mine.t } : null, to: theirs ? { text: theirs.text, t: theirs.t } : null });
      }
      out({ ok: true, list, total, page, fsent: s.fsend && s.fsend.day === this.day() ? s.fsend.to : [] });
      return;
    }
    if (op === 'rpub') {
      const v = !!m.v;
      await this.withSoc(id, s => { s.rpub = v; });
      if (!v) await this.dropList('pubrooms', x => x.pid === me); else await this.roomChanged(id);
      out({ ok: true, rpub: v });
      return;
    }
    if (op === 'diary') {
      const title = text(m.title), body = String(m.text || '').replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, ' ').replace(/\n{3,}/g, '\n\n').trim(), pub = PUBS.includes(m.pub) ? m.pub : 'all', kifu = cleanKifu(m.kifu);
      let reason = !title ? 'notitle' : title.length > LIM.text.title ? 'long' : !body ? 'empty' : body.length > LIM.text.diary ? 'long' : null;
      if (!reason) { const ng = check(title) || check(body); if (ng) reason = NG_MSG[ng]; }
      if (reason) { out({ ok: false, reason }); return; }
      const day = this.day(); let entry = null;
      const s = await this.withSoc(id, async s => {
        if (s.diaryDay === day) { reason = 'today'; return false; }   // 日記は1日1回
        const d = { id: s.seq++, t: now, title, text: body, pub, kifu, c: [] };
        await this.store.put(`dia:${id}:${d.id}`, d);
        s.diaryDay = day; s.diary.unshift(head(d)); entry = d;
        await this.migrate(id, s);
      });
      if (reason || !s) { out({ ok: false, reason: reason || 'gone' }); return; }
      if (pub === 'all') await this.pushList('pubdia', { pid: me, oid: id, did: entry.id, t: now }, x => x.oid === id && x.did === entry.id, LIM.pubdia);
      this.touchActive(me);
      out({ ok: true, diary: s.diary.map(head), entry, wrote: true });
      if (pub !== 'me') this.notifyFriends(id, { type: 'diary', pid: me, name: myName, av: myAv(), title, t: now }).catch(() => {});
      return;
    }
    // 書いた日記をあとから直す（題・本文・棋譜。日付と公開範囲・コメントはそのまま）
    if (op === 'dedit') {
      const did = m.did | 0, title = text(m.title), body = String(m.text || '').replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, ' ').replace(/\n{3,}/g, '\n\n').trim(), kifu = cleanKifu(m.kifu);
      let reason = !title ? 'notitle' : title.length > LIM.text.title ? 'long' : !body ? 'empty' : body.length > LIM.text.diary ? 'long' : null;
      if (!reason) { const ng = check(title) || check(body); if (ng) reason = NG_MSG[ng]; }
      if (reason) { out({ ok: false, reason }); return; }
      let entry = null;
      const s = await this.withSoc(id, async s => {
        const h = s.diary.find(d => d.id === did); if (!h) return false;
        const d = await this.store.get(`dia:${id}:${did}`); if (!d) return false;
        Object.assign(d, { title, text: body, kifu, edited: now }); await this.store.put(`dia:${id}:${did}`, d);
        Object.assign(h, head(d)); entry = d;
      });
      if (!s) { out({ ok: false, reason: 'gone' }); return; }
      out({ ok: true, diary: s.diary.map(head), entry });
      return;
    }
    if (op === 'dpub') {
      const pub = PUBS.includes(m.pub) ? m.pub : 'all', did = m.did | 0;
      const s = await this.withSoc(id, async s => {
        const d = s.diary.find(d => d.id === did); if (!d) return false;
        d.pub = pub;
        const b = await this.store.get(`dia:${id}:${did}`); if (b) { b.pub = pub; await this.store.put(`dia:${id}:${did}`, b); }
      });
      if (pub === 'all' && s) { const d = s.diary.find(d => d.id === did); await this.pushList('pubdia', { pid: me, oid: id, did, t: d.t }, x => x.oid === id && x.did === did, LIM.pubdia); }
      else await this.dropList('pubdia', x => x.oid === id && x.did === did);
      out({ ok: !!s, diary: s ? s.diary.map(head) : [] });
      return;
    }
    // ここから先は、相手（または自分）の部屋番号が要る
    const pid = op === 'hito' || op === 'cset' || (!m.pid && (op === 'dlist' || op === 'dget')) ? me : String(m.pid || '').replace(/\D/g, '').slice(0, 6);
    const oid = pid === me ? id : await this.idOf(pid);
    if (!oid) { out({ ok: false, reason: 'nobody' }); return; }

    // 相手の戦績（対局のあとで）：名前・アバター・レート・対局数・勝率・フレンドかどうか
    if (op === 'prof') {
      const acct = await this.store.get('acct:' + oid), s = fixSoc(await this.store.get('soc:' + oid));
      // 戦績は全ゲームぶん（stats：{ go: { go9: {…}, go13: {…} }, shogi: {…} }）。囲碁9路は前の形（data）からも読む
      let d = acct && acct.data; if (typeof d === 'string') { try { d = JSON.parse(d); } catch (e) { d = null; } }
      d = d || {};
      const stats = (acct && acct.stats) || {};
      const g9 = (stats.go && stats.go.go9) || d;
      const num = v => Math.max(0, v | 0);
      out({ ok: true, pid, name: acctName(acct) || this.nameOf(oid), av: (acct && acct.av) || null, hito: s.hito,
        rating: num(g9.rating), games: num(g9.games), wins: num(g9.wins), draws: num(g9.draws), streak: num(g9.streak), stats,
        friend: has(s.friends, me), asked: has(s.freq, me), mine: pid === me });
      return;
    }
    if (op === 'visit') {
      const acct = await this.store.get('acct:' + oid);
      let s = await this.readSoc(oid);
      if (has(s.blocks, me)) { out({ ok: false, reason: 'blocked' }); return; }
      // 訪問数：自分以外・1日1人1回だけ数える（書きこみを減らすため）
      const day = this.day();
      if (pid !== me && !(s.visits.day === day && s.visits.seen.includes(me))) {
        s = await this.withSoc(oid, s2 => {
          if (s2.visits.day !== day) s2.visits = { total: s2.visits.total, day, today: 0, seen: [] };
          if (s2.visits.seen.includes(me)) return false;
          s2.visits.total++; s2.visits.today++; s2.visits.seen.push(me);
          if (s2.visits.seen.length > 300) s2.visits.seen.shift();
          s2.foot = [{ pid: me, name: myName, t: now }].concat(s2.foot.filter(f => f.pid !== me)).slice(0, LIM.foot);
        }) || s;
      }
      this.touchActive(pid);
      const ownerName = acctName(acct) || 'プレイヤー';
      out({
        ok: true, pid, name: ownerName, av: acct.av || null, room: acct.room || null, rooms2: acct.rooms2 || [], hito: s.hito,
        diary: s.diary.filter(d => canSee(d, pid === me, has(s.friends, me))).map(head), chat: s.chat, visits: { total: s.visits.total, today: s.visits.day === day ? s.visits.today : 0 },
        cset: s.cset, friend: has(s.friends, me), asked: has(s.freq, me), canWrite: canWrite(s, pid), mine: pid === me
      });
      return;
    }
    if (op === 'hito') {
      const t = text(m.text);
      const bad = !t ? null : gate(t, op); if (bad) { out({ ok: false, reason: bad }); return; }
      const s = await this.withSoc(id, s => { s.hito = t; });
      this.touchActive(me);
      out({ ok: true, hito: s.hito });
      return;
    }
    if (op === 'dlist' || op === 'dget') {
      const s = await this.readSoc(oid), friend = has(s.friends, me);
      if (pid !== me && has(s.blocks, me)) { out({ ok: false, reason: 'blocked' }); return; }
      const a = pid === me ? null : await this.store.get('acct:' + oid);
      const name = pid === me ? myName : acctName(a) || 'プレイヤー';
      if (op === 'dlist') { out({ ok: true, pid, name, mine: pid === me, diary: s.diary.filter(d => canSee(d, pid === me, friend)).map(head), wrote: pid === me && s.diaryDay === this.day() }); return; }
      const d = s.diary.find(d => d.id === (m.did | 0));
      if (!d || !canSee(d, pid === me, friend)) { out({ ok: false, reason: 'gone' }); return; }
      const body = await this.store.get(`dia:${oid}:${d.id}`); if (!body) { out({ ok: false, reason: 'gone' }); return; }
      out({ ok: true, pid, name, av: pid === me ? myAv() : (a && a.av) || null, mine: pid === me, entry: Object.assign({}, body, { c: (body.c || []).filter(c => !has(s.blocks, c.pid)) }), canWrite: canWrite(s, pid) });
      return;
    }
    if (op === 'rank') {
      const r = text(m.rank).slice(0, 6);
      const last = this.rankAt && this.rankAt.get(id) || 0;
      if (!r || check(r) || now - last < 60000) { out({ ok: false }); return; }
      this.rankAt = this.rankAt || new Map(); this.rankAt.set(id, now);
      if (this.rankAt.size > 5000) this.rankAt.delete(this.rankAt.keys().next().value);
      out({ ok: true });
      this.notifyFriends(id, { type: 'rank', pid: me, name: myName, av: myAv(), rank: r, t: now }).catch(() => {});
      return;
    }
    if (op === 'comment' || op === 'chat') {
      const t = text(m.text);
      let reason = null, entry = null;
      const s = await this.withSoc(oid, async s => {
        if (!canWrite(s, pid)) { reason = has(s.blocks, me) ? 'blocked' : 'closed'; return false; }
        reason = gate(t, op); if (reason) return false;
        const item = { id: s.seq++, pid: me, name: myName, text: t, t: now, av: myAv() };
        if (op === 'chat') { s.chat.unshift(item); s.chat = s.chat.slice(0, LIM.chats); return; }
        const d = s.diary.find(d => d.id === (m.did | 0));
        if (!d || !canSee(d, pid === me, has(s.friends, me))) { reason = 'gone'; return false; }
        const b = await this.store.get(`dia:${oid}:${d.id}`); if (!b) { reason = 'gone'; return false; }
        b.c.push(item); if (b.c.length > LIM.comments) b.c.shift();
        d.nc = b.c.length; await this.store.put(`dia:${oid}:${d.id}`, b); entry = b;
      });
      if (reason || !s) { out({ ok: false, reason: reason || 'gone' }); return; }
      out({ ok: true, entry, chat: s.chat });
      // 部屋の持ち主がつながっていたら、新しい一言コメントをすぐ知らせる（画面上の流れる一行）
      if (op === 'chat') for (const p of this.core.players.values()) if (p.acct === oid && p.sock) { try { p.sock.send(JSON.stringify({ t: 'soc', op: 'push', item: s.chat[0] })); } catch (e) {} }
      return;
    }
    if (op === 'del') {
      let entry = null;
      const s = await this.withSoc(oid, async s => {
        const mine = it => pid === me || it.pid === me;   // 持ち主は全部、書いた人は自分のもの
        if (m.kind === 'diary' && pid === me) { s.diary = s.diary.filter(d => d.id !== (m.id | 0)); if (this.store.del) await this.store.del(`dia:${oid}:${m.id | 0}`); }
        else if (m.kind === 'chat') s.chat = s.chat.filter(c => !(c.id === (m.id | 0) && mine(c)));
        else if (m.kind === 'note' && pid === me) s.notes = m.id === 'all' ? [] : s.notes.filter(n => n.id !== (m.id | 0));   // お知らせ（自分あて）を消す
        else if (m.kind === 'chatall' && pid === me) s.chat = [];
        else if (m.kind === 'comment') {
          const d = s.diary.find(d => d.id === (m.did | 0)), key = `dia:${oid}:${m.did | 0}`, b = d && await this.store.get(key);
          if (!b) return false;
          b.c = b.c.filter(c => !(c.id === (m.id | 0) && mine(c))); d.nc = b.c.length; await this.store.put(key, b); entry = b;
        }
        else return false;
      });
      if (s && m.kind === 'diary') await this.dropList('pubdia', x => x.oid === oid && x.did === (m.id | 0));
      out({ ok: !!s, diary: s && s.diary.map(head), chat: s && s.chat, notes: s && s.notes.slice(0, 20), entry });
      return;
    }
    if (op === 'cset') {
      const v = ['all', 'friends', 'none'].includes(m.v) ? m.v : 'all';
      await this.withSoc(id, s => { s.cset = v; });
      out({ ok: true, cset: v });
      return;
    }
    if (pid === me) { out({ ok: false, reason: 'self' }); return; }
    if (op === 'invite') {
      const code = String(m.code || '').replace(/\D/g, '').slice(0, 4);
      this.inviteAt = this.inviteAt || new Map();
      if (code.length !== 4 || now - (this.inviteAt.get(id) || 0) < 10000) { out({ ok: false, reason: 'fast' }); return; }
      this.inviteAt.set(id, now); if (this.inviteAt.size > 5000) this.inviteAt.delete(this.inviteAt.keys().next().value);
      const ok = await this.notify(oid, { type: 'invite', pid: me, name: myName, av: myAv(), code, t: now });
      out({ ok, reason: ok ? null : 'blocked' });
      return;
    }
    if (op === 'block' || op === 'unblock') {
      const name = cleanName(m.name);
      const s = await this.withSoc(id, s => {
        s.blocks = s.blocks.filter(b => b.pid !== pid);
        if (op === 'block') {
          s.blocks.unshift({ pid, name, t: now }); s.blocks = s.blocks.slice(0, LIM.blocks);
          s.friends = s.friends.filter(f => f.pid !== pid); s.freq = s.freq.filter(f => f.pid !== pid);
          s.chat = s.chat.filter(c => c.pid !== pid);                         // その人の書きこみも消す
          // 日記へのその人のコメントは、日記を開いたときに出さない（本文の保存はそのまま）
        }
      });
      if (op === 'block') await this.withSoc(oid, s => { const n = s.friends.length; s.friends = s.friends.filter(f => f.pid !== me); if (n === s.friends.length) return false; });
      out({ ok: true, blocks: s.blocks, friends: s.friends });
      return;
    }
    if (op === 'freq') {
      let reason = null;
      const mySoc = fixSoc(await this.store.get('soc:' + id));
      if (mySoc.friends.length >= LIM.friends) { out({ ok: false, reason: 'myfull' }); return; }
      await this.withSoc(oid, s => {
        if (s.friends.length >= LIM.friends) { reason = 'theirfull'; return false; }
        if (has(s.blocks, me)) { reason = 'blocked'; return false; }
        if (has(s.friends, me) || has(s.freq, me)) return false;
        if (s.freq.length >= LIM.freq) { reason = 'full'; return false; }
        s.freq.unshift({ pid: me, name: myName, t: now });
      });
      if (!reason) {   // 相手のプレゼントボックスと、一言（お知らせ）に出す
        await this.core.giftTo(oid, 'freq', 0, `${myName}さんからフレンド申請`, { pid: me, name: myName });
        await this.notify(oid, { type: 'freq', pid: me, name: myName, av: myAv(), t: now });
      }
      out({ ok: !reason, reason });
      return;
    }
    // フレンドに銭をおくる：1人に1日1回100銭。送れるのは1日5人まで、受け取れるのは1日500銭まで
    if (op === 'fsend') {
      const day = this.day();
      const mine = fixSoc(await this.store.get('soc:' + id));
      if (!has(mine.friends, pid)) { out({ ok: false, reason: 'notfriend' }); return; }
      const sent = mine.fsend && mine.fsend.day === day ? mine.fsend.to : [];
      if (sent.includes(pid)) { out({ ok: false, reason: 'already' }); return; }
      if (sent.length >= 5) { out({ ok: false, reason: 'mymax' }); return; }
      let full = false;
      const ok = await this.core.giftTo(oid, 'fzeni', 100, `${myName}さんからのおくりもの`, { pid: me, name: myName }, r => {
        const got = r.fgot && r.fgot.day === day ? r.fgot.n : 0;
        if (got + 100 > 500) { full = true; return false; }
        r.fgot = { day, n: got + 100 };
      });
      if (!ok) { out({ ok: false, reason: full ? 'theirmax' : 'err' }); return; }
      const s2 = await this.withSoc(id, s => { const t = s.fsend && s.fsend.day === day ? s.fsend.to : []; s.fsend = { day, to: t.concat(pid) }; });
      await this.notify(oid, { type: 'fzeni', pid: me, name: myName, av: myAv(), t: now });
      out({ ok: true, sent: s2.fsend.to });
      return;
    }
    if (op === 'faccept' || op === 'fdecline' || op === 'unfriend') {
      let ok = true, reason = null;
      if (op === 'faccept') { const os = fixSoc(await this.store.get('soc:' + oid)); if (os.friends.length >= LIM.friends && !has(os.friends, me)) { out({ ok: false, reason: 'theirfull' }); return; } }
      const s = await this.withSoc(id, s => {
        const req = s.freq.find(f => f.pid === pid);
        s.freq = s.freq.filter(f => f.pid !== pid);
        if (op === 'faccept') {
          if (!req) { ok = false; return; }
          if (s.friends.length >= LIM.friends) { ok = false; reason = 'myfull'; return; }
          if (!has(s.friends, pid)) s.friends.unshift({ pid, name: req.name, t: now });
        }
        if (op === 'unfriend') s.friends = s.friends.filter(f => f.pid !== pid);
      });
      if (ok && op === 'faccept') await this.withSoc(oid, s => { if (has(s.friends, me)) return false; s.friends.unshift({ pid: me, name: myName, t: now }); s.freq = s.freq.filter(f => f.pid !== me); });
      if (op === 'faccept' || op === 'fdecline') await this.core.dropGift(id, 'freq', pid);   // プレゼントボックスの申請を消す
      if (ok && op === 'faccept') await this.notify(oid, { type: 'friendok', pid: me, name: myName, av: myAv(), t: now });
      if (op === 'unfriend') await this.withSoc(oid, s => { const n = s.friends.length; s.friends = s.friends.filter(f => f.pid !== me); if (n === s.friends.length) return false; });
      out({ ok, reason, friends: s.friends, freq: s.freq });
      return;
    }
    out({ ok: false, reason: 'op' });
  }
}
