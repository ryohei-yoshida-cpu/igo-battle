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
 *   diary   { text }        … 日記を書く（自分の部屋だけ）
 *   comment { pid, did, text } … 日記にコメント
 *   chat    { pid, text }   … 一言チャット
 *   del     { pid, kind, id, did } … 消す（部屋の持ち主は全部、書いた人は自分のものだけ）
 *   cset    { v }           … コメント・チャット：all 全員 / friends フレンドだけ / none 受け付けない
 *   block / unblock { pid } … ブロック（その人は部屋に入れない・書きこめない。フレンドも解除）
 *   freq / faccept / fdecline / unfriend { pid } … フレンド
 *   avatar  { look }        … アバターの着がえ（持っているパーツだけ）
 */
import { check, cleanName } from './ng.js';
import '../common/avatar-art.js';
const AV = globalThis.AVATAR;

const LIM = {
  text: { hito: 40, diary: 300, comment: 60, chat: 40 },
  diaries: 10, comments: 15, chats: 40, foot: 20, friends: 100, blocks: 200, freq: 30,
  postGapMs: 4000, postsPerDay: 80
};
const NG_MSG = { sexual: 'sexual', violent: 'violent', abuse: 'abuse', contact: 'contact' };

const newSoc = () => ({ hito: '', diary: [], chat: [], visits: { total: 0, day: '', today: 0, seen: [] }, foot: [], cset: 'all', blocks: [], friends: [], freq: [], seq: 1 });
function fixSoc(s) { return Object.assign(newSoc(), s || {}); }
const has = (list, pid) => list.some(x => (x.pid || x) === pid);

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
  withSoc(id, fn) { return this.withKey('soc:' + id, async s => fn(Object.assign(s, fixSoc(s))), newSoc); }

  // 部屋番号（6けた）。はじめて必要になったときに作る
  async ensurePid(id) {
    const rec = await this.store.get('acct:' + id); if (!rec) return null;
    if (rec.pid) return rec.pid;
    let pid; do { pid = String(100000 + Math.floor(Math.random() * 900000)); } while (await this.store.get('pid:' + pid));
    await this.store.put('pid:' + pid, id);
    await this.core.withAcct(id, async r => { r.pid = pid; });
    return pid;
  }
  idOf(pid) { return this.store.get('pid:' + String(pid || '').replace(/\D/g, '').slice(0, 6)); }
  nameOf(id) { const p = [...this.core.players.values()].find(p => p.acct === id); return cleanName(p && p.name); }
  touchActive(pid) { this.active = [pid].concat(this.active.filter(x => x !== pid)).slice(0, 60); }

  async handle(sock, info, m) {
    const out = msg => { try { sock.send(JSON.stringify(Object.assign({ t: 'soc', op: m.op, req: m.req }, msg))); } catch (e) {} };
    const id = info.acct; if (!id) { out({ ok: false, reason: 'auth' }); return; }
    const me = await this.ensurePid(id); if (!me) return;
    const myName = this.nameOf(id);
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
      const s = fixSoc(await this.store.get('soc:' + id));
      out({ ok: true, pid: me, hito: s.hito, visits: { total: s.visits.total, today: s.visits.day === this.day() ? s.visits.today : 0 }, foot: s.foot, friends: s.friends, freq: s.freq, blocks: s.blocks, cset: s.cset });
      return;
    }
    if (op === 'avatar') {
      let ok = false;
      const rec = await this.core.withAcct(id, async r => {
        const look = AV.clean(m.look);
        const owned = new Set((r.owned && r.owned.av) || []);
        for (const [slot] of AV.SLOTS) if (AV.PRICE[slot + ':' + look[slot]] > 0 && !owned.has(slot + ':' + look[slot])) return false;
        r.av = look; ok = true;
      });
      out({ ok, look: rec && rec.av });
      if (ok) this.touchActive(me);
      return;
    }
    if (op === 'random') {
      const list = this.active.filter(p => p !== me);
      out({ ok: !!list.length, pid: list.length ? list[Math.floor(Math.random() * list.length)] : null });
      return;
    }
    // ここから先は、相手（または自分）の部屋番号が要る
    const pid = op === 'hito' || op === 'diary' || op === 'cset' ? me : String(m.pid || '').replace(/\D/g, '').slice(0, 6);
    const oid = pid === me ? id : await this.idOf(pid);
    if (!oid) { out({ ok: false, reason: 'nobody' }); return; }

    if (op === 'visit') {
      const acct = await this.store.get('acct:' + oid);
      let s = fixSoc(await this.store.get('soc:' + oid));
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
      const ownerName = (acct.data && cleanName(acct.data.name)) || 'プレイヤー';
      out({
        ok: true, pid, name: ownerName, av: acct.av || null, room: acct.room || null, hito: s.hito,
        diary: s.diary, chat: s.chat, visits: { total: s.visits.total, today: s.visits.day === day ? s.visits.today : 0 },
        cset: s.cset, friend: has(s.friends, me), asked: has(s.freq, me), canWrite: canWrite(s, pid), mine: pid === me
      });
      return;
    }
    if (op === 'hito' || op === 'diary') {
      const t = text(m.text);
      const bad = op === 'hito' && !t ? null : gate(t, op); if (bad) { out({ ok: false, reason: bad }); return; }
      const s = await this.withSoc(id, s => {
        if (op === 'hito') s.hito = t;
        else { s.diary.unshift({ id: s.seq++, t: now, text: t, c: [] }); s.diary = s.diary.slice(0, LIM.diaries); }
      });
      this.touchActive(me);
      out({ ok: true, hito: s.hito, diary: s.diary });
      return;
    }
    if (op === 'comment' || op === 'chat') {
      const t = text(m.text);
      let reason = null;
      const s = await this.withSoc(oid, s => {
        if (!canWrite(s, pid)) { reason = has(s.blocks, me) ? 'blocked' : 'closed'; return false; }
        reason = gate(t, op); if (reason) return false;
        const item = { id: s.seq++, pid: me, name: myName, text: t, t: now };
        if (op === 'chat') { s.chat.unshift(item); s.chat = s.chat.slice(0, LIM.chats); return; }
        const d = s.diary.find(d => d.id === (m.did | 0));
        if (!d) { reason = 'gone'; return false; }
        d.c.push(item); if (d.c.length > LIM.comments) d.c.shift();
      });
      if (reason || !s) { out({ ok: false, reason: reason || 'gone' }); return; }
      out({ ok: true, diary: s.diary, chat: s.chat });
      return;
    }
    if (op === 'del') {
      const s = await this.withSoc(oid, s => {
        const mine = it => pid === me || it.pid === me;   // 持ち主は全部、書いた人は自分のもの
        if (m.kind === 'diary' && pid === me) s.diary = s.diary.filter(d => d.id !== (m.id | 0));
        else if (m.kind === 'chat') s.chat = s.chat.filter(c => !(c.id === (m.id | 0) && mine(c)));
        else if (m.kind === 'comment') { const d = s.diary.find(d => d.id === (m.did | 0)); if (d) d.c = d.c.filter(c => !(c.id === (m.id | 0) && mine(c))); }
        else return false;
      });
      out({ ok: !!s, diary: s && s.diary, chat: s && s.chat });
      return;
    }
    if (op === 'cset') {
      const v = ['all', 'friends', 'none'].includes(m.v) ? m.v : 'all';
      await this.withSoc(id, s => { s.cset = v; });
      out({ ok: true, cset: v });
      return;
    }
    if (pid === me) { out({ ok: false, reason: 'self' }); return; }
    if (op === 'block' || op === 'unblock') {
      const name = cleanName(m.name);
      const s = await this.withSoc(id, s => {
        s.blocks = s.blocks.filter(b => b.pid !== pid);
        if (op === 'block') {
          s.blocks.unshift({ pid, name, t: now }); s.blocks = s.blocks.slice(0, LIM.blocks);
          s.friends = s.friends.filter(f => f.pid !== pid); s.freq = s.freq.filter(f => f.pid !== pid);
          s.chat = s.chat.filter(c => c.pid !== pid);                         // その人の書きこみも消す
          for (const d of s.diary) d.c = d.c.filter(c => c.pid !== pid);
        }
      });
      if (op === 'block') await this.withSoc(oid, s => { const n = s.friends.length; s.friends = s.friends.filter(f => f.pid !== me); if (n === s.friends.length) return false; });
      out({ ok: true, blocks: s.blocks, friends: s.friends });
      return;
    }
    if (op === 'freq') {
      let reason = null;
      await this.withSoc(oid, s => {
        if (has(s.blocks, me)) { reason = 'blocked'; return false; }
        if (has(s.friends, me) || has(s.freq, me)) return false;
        if (s.freq.length >= LIM.freq) { reason = 'full'; return false; }
        s.freq.unshift({ pid: me, name: myName, t: now });
      });
      out({ ok: !reason, reason });
      return;
    }
    if (op === 'faccept' || op === 'fdecline' || op === 'unfriend') {
      let ok = true;
      const s = await this.withSoc(id, s => {
        const req = s.freq.find(f => f.pid === pid);
        s.freq = s.freq.filter(f => f.pid !== pid);
        if (op === 'faccept') {
          if (!req) { ok = false; return; }
          if (s.friends.length >= LIM.friends) { ok = false; return; }
          if (!has(s.friends, pid)) s.friends.unshift({ pid, name: req.name, t: now });
        }
        if (op === 'unfriend') s.friends = s.friends.filter(f => f.pid !== pid);
      });
      if (ok && op === 'faccept') await this.withSoc(oid, s => { if (has(s.friends, me)) return false; s.friends.unshift({ pid: me, name: myName, t: now }); s.freq = s.freq.filter(f => f.pid !== me); });
      if (op === 'unfriend') await this.withSoc(oid, s => { const n = s.friends.length; s.friends = s.friends.filter(f => f.pid !== me); if (n === s.friends.length) return false; });
      out({ ok, friends: s.friends, freq: s.freq });
      return;
    }
    out({ ok: false, reason: 'op' });
  }
}
