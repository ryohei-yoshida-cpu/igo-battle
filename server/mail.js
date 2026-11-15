/* 共通：メッセージ（フレンド・同じ碁会所のメンバーに送れる。全ゲーム共通）
 *
 * 保存先
 *   msg:<番号>   … メッセージ1通の原本 { n, t, from, to, fromPid, toPid, text, kind }。受け取った人・送った人が消しても残る（通報や問い合わせのため）
 *   msgseq       … 原本の番号
 *   mbox:<ID>    … 自分の受信箱・送信箱 { items: [{ n, t, peer, name, mine, text, kind, read, extra }] }（新しい順に300通まで）
 *   mrep         … 通報されたメッセージの一覧（運営が見る。通報した人の同意で、そのメッセージと前後のやりとりだけ見られる）
 *
 * やりとり（アプリ → サーバー { t:'mail', op, req, ... }）
 *   list            … 相手ごとのやりとり一覧（未読の数つき）
 *   thread { pid }  … その相手とのやりとり（読んだことにする）
 *   send { pid, text } … 送る（フレンドか同じ碁会所のメンバーだけ。どちらかがブロックしていたら送れない）
 *   del { pid }     … その相手とのやりとりを、自分の箱から消す（原本は残る）
 *   report { n, reason } … 通報
 *   to              … 送れる相手（フレンド・碁会所のメンバー）
 * サーバー → アプリ { t:'mail', op:'push', item, unread }
 */
import { check, cleanName } from './ng.js';
import { ageState } from './age.js';

export const MAIL = { text: 200, box: 300, gapMs: 3000, perDay: 150 };
const NG = { sexual: 'ng', violent: 'ng', abuse: 'ng', contact: 'contact' };

export class Mail {
  constructor(core) { this.core = core; this.sent = new Map(); }
  get store() { return this.core.store; }
  get soc() { return this.core.social; }
  now() { return this.core.now(); }
  day() { return new Date(this.now() + 9 * 3600e3).toISOString().slice(0, 10); }
  sendTo(id, msg) { for (const p of this.core.players.values()) if (p.acct === id && p.sock) { try { p.sock.send(JSON.stringify(Object.assign({ t: 'mail' }, msg))); } catch (e) {} } }
  async box(id) { return (await this.store.get('mbox:' + id)) || { items: [] }; }
  unread(b) { return b.items.filter(x => !x.mine && !x.read).length; }

  // 1通を、両方の箱と原本に入れる（system：碁会所の申請・招待など。from は送り主）
  async deliver(fromId, toId, text, kind, extra) {
    const t = this.now();
    const [fp, tp] = [await this.soc.ensurePid(fromId), await this.soc.ensurePid(toId)];
    const fname = cleanName(this.soc.nameOf(fromId)) || await this.nameOfId(fromId) || fp, tname = await this.nameOfId(toId) || tp;
    const n = await this.soc.withKey('msgseq', c => { c.n = (c.n || 0) + 1; }, () => ({ n: 0 })).then(c => c.n);
    await this.store.put('msg:' + n, { n, t, from: fromId, to: toId, fromPid: fp, toPid: tp, fromName: fname, text, kind: kind || 'msg', extra: extra || null });
    const item = mine => ({ n, t, peer: mine ? tp : fp, name: mine ? tname : fname, mine, text, kind: kind || 'msg', read: mine, extra: extra || undefined });
    if (fromId !== toId && (kind || 'msg') === 'msg') await this.soc.withKey('mbox:' + fromId, b => { b.items.unshift(item(true)); b.items = b.items.slice(0, MAIL.box); }, () => ({ items: [] }));
    const b = await this.soc.withKey('mbox:' + toId, b => { b.items.unshift(item(false)); b.items = b.items.slice(0, MAIL.box); }, () => ({ items: [] }));
    this.sendTo(toId, { op: 'push', item: item(false), unread: this.unread(b) });
    return n;
  }
  async nameOfId(id) { const a = await this.store.get('acct:' + id); const n = a && (a.name || (a.data && a.data.name)); return n ? cleanName(n) : ''; }
  // 送れる相手か：フレンド（どちらかの一覧にいる）か、同じ碁会所。ブロックはどちら向きでもだめ
  async can(id, me, oid, pid) {
    const [ms, os] = [await this.soc.readSoc(id), await this.soc.readSoc(oid)];
    if (ms.blocks.some(b => b.pid === pid) || os.blocks.some(b => b.pid === me)) return 'blocked';
    const a = await this.store.get('acct:' + oid); if (a && a.ban) return 'gone';
    // 15歳以下（と誕生日がまだの人）は、送ることも受け取ることもできない
    if (ageState(await this.store.get('acct:' + id), this.now()) !== 'adult') return 'kid';
    if (ageState(a, this.now()) !== 'adult') return 'kidto';
    if (ms.friends.some(f => f.pid === pid) || os.friends.some(f => f.pid === me)) return null;
    const r1 = await this.store.get('acct:' + id);
    const g1 = r1 && r1.guild || {}, g2 = a && a.guild || {};
    for (const k of Object.keys(g1)) if (g1[k] && g1[k] === g2[k]) return null;
    return 'who';
  }

  async handle(sock, info, m) {
    const out = msg => { try { sock.send(JSON.stringify(Object.assign({ t: 'mail', op: m.op, req: m.req }, msg))); } catch (e) {} };
    const id = info.acct; if (!id) { out({ ok: false, reason: 'auth' }); return; }
    const me = await this.soc.ensurePid(id); if (!me) return;
    const op = m.op, now = this.now();
    const pidOf = v => String(v || '').replace(/\D/g, '').slice(0, 6);
    if (op === 'list') {
      const b = await this.box(id), seen = new Map();
      for (const x of b.items) {
        const k = x.kind === 'msg' ? x.peer : 'sys:' + x.n;
        if (!seen.has(k)) seen.set(k, { peer: x.peer, name: x.name, t: x.t, text: x.text, mine: x.mine, kind: x.kind, n: x.n, extra: x.extra, unread: 0, done: x.done });
        if (!x.mine && !x.read) seen.get(k).unread++;
      }
      out({ ok: true, list: [...seen.values()], unread: this.unread(b) });
      return;
    }
    if (op === 'unread') { out({ ok: true, unread: this.unread(await this.box(id)) }); return; }
    if (op === 'to') {
      const s = await this.soc.readSoc(id), list = s.friends.map(f => ({ pid: f.pid, name: f.name, f: 1 }));
      const r = await this.store.get('acct:' + id), gid = r && r.guild && r.guild[info.game || 'go'];
      const g = gid && await this.store.get('guild:' + gid);
      if (g) for (const x of g.members) if (x.id !== id && !list.some(y => y.pid === x.pid)) list.push({ pid: x.pid, name: x.name, g: 1 });
      out({ ok: true, list: list.filter(x => !s.blocks.some(b => b.pid === x.pid)) });
      return;
    }
    if (op === 'thread' || op === 'del') {
      const pid = pidOf(m.pid), n = m.n | 0;
      const same = x => n ? x.n === n : x.kind === 'msg' && x.peer === pid;
      const b = await this.soc.withKey('mbox:' + id, b => {
        if (op === 'del') b.items = b.items.filter(x => !same(x));
        else for (const x of b.items) if (same(x)) x.read = true;
      }, () => ({ items: [] }));
      out({ ok: true, items: op === 'thread' ? b.items.filter(same).slice(0, 100).reverse() : undefined, unread: this.unread(b) });
      return;
    }
    if (op === 'send') {
      const pid = pidOf(m.pid), text = String(m.text || '').replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, ' ').trim();
      if (!pid || pid === me) { out({ ok: false, reason: 'who' }); return; }
      if (!text) { out({ ok: false, reason: 'empty' }); return; }
      if (text.length > MAIL.text) { out({ ok: false, reason: 'long' }); return; }
      const ng = check(text); if (ng) { out({ ok: false, reason: NG[ng] || 'ng' }); return; }
      const st = this.sent.get(id) || { at: 0, day: '', n: 0 };
      if (now - st.at < MAIL.gapMs) { out({ ok: false, reason: 'fast' }); return; }
      if (st.day === this.day() && st.n >= MAIL.perDay) { out({ ok: false, reason: 'many' }); return; }
      const oid = await this.soc.idOf(pid); if (!oid) { out({ ok: false, reason: 'who' }); return; }
      const why = await this.can(id, me, oid, pid); if (why) { out({ ok: false, reason: why }); return; }
      this.sent.set(id, { at: now, day: this.day(), n: st.day === this.day() ? st.n + 1 : 1 });
      if (this.sent.size > 5000) this.sent.delete(this.sent.keys().next().value);
      await this.deliver(id, oid, text, 'msg');
      const b = await this.box(id);
      out({ ok: true, items: b.items.filter(x => x.kind === 'msg' && x.peer === pid).slice(0, 100).reverse() });
      return;
    }
    if (op === 'report') {
      const n = m.n | 0, b = await this.box(id), it = b.items.find(x => x.n === n && !x.mine);
      if (!it) { out({ ok: false, reason: 'gone' }); return; }
      const ctx = b.items.filter(x => x.kind === 'msg' && x.peer === it.peer).slice(0, 20).reverse().map(x => ({ n: x.n, t: x.t, mine: x.mine, text: x.text }));
      await this.soc.pushList('mrep', { t: now, by: me, pid: it.peer, name: it.name, n, text: it.text, reason: String(m.reason || '').slice(0, 20), ctx }, () => false, 500);
      out({ ok: true });
      return;
    }
    out({ ok: false, reason: 'op' });
  }
}
