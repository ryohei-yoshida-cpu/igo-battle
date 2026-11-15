/* 共通：運営（管理者）の画面のためのやりとり。部屋番号 ADMIN_PID の人だけ使える
 *   { t:'admin', op, req, ... }
 *   reports           … 通報の一覧（部屋・日記・一言の通報 ＋ メッセージの通報）
 *   user { pid }      … その人の情報（名前・作成日・銭・碁会所・利用停止か）と、書きこみの写し（一言・コメント・碁会所の一言・掲示板）
 *   ban { pid, reason } / unban { pid } … アカウントの利用停止（ログインできなくなる）・解除
 *   clear { kind }    … 通報の一覧を片づける（soc / mail）
 * メッセージ（1対1）は「通信の秘密」があるので、運営が自由に読むことはしない。
 * 見られるのは、受け取った人が通報したメッセージと、その前後のやりとり（通報した人の箱にあるもの）だけ。
 */
export const ADMIN_PID = '561149';

export class Admin {
  constructor(core) { this.core = core; }
  get store() { return this.core.store; }
  async handle(sock, info, m) {
    const out = msg => { try { sock.send(JSON.stringify(Object.assign({ t: 'admin', op: m.op, req: m.req }, msg))); } catch (e) {} };
    const id = info.acct; if (!id) { out({ ok: false, reason: 'auth' }); return; }
    const me = await this.core.social.ensurePid(id);
    if (me !== ADMIN_PID) { out({ ok: false, reason: 'admin' }); return; }
    const pidOf = v => String(v || '').replace(/\D/g, '').slice(0, 6);
    if (m.op === 'reports') {
      out({ ok: true, soc: (await this.store.get('reports')) || [], mail: (await this.store.get('mrep')) || [] });
      return;
    }
    if (m.op === 'clear') {
      await this.core.social.withKey(m.kind === 'mail' ? 'mrep' : 'reports', list => { list.length = 0; }, null);
      out({ ok: true });
      return;
    }
    const pid = pidOf(m.pid), oid = pid && await this.core.social.idOf(pid);
    if (!oid) { out({ ok: false, reason: 'none' }); return; }
    if (m.op === 'user') {
      const r = await this.store.get('acct:' + oid) || {};
      const gid = r.guild && r.guild.go, g = gid && await this.store.get('guild:' + gid);
      const s = await this.core.social.readSoc(oid);
      out({ ok: true, user: { pid, name: r.name || (r.data && r.data.name) || '', created: r.created || 0, zeni: r.zeni | 0, ban: r.ban || null, guild: g ? `${g.name}（${g.short || ''}）` : '', hito: s.hito || '', friends: s.friends.length, blocks: s.blocks.length },
        posts: ((await this.store.get('clog:' + oid)) || []).slice(0, 200) });
      return;
    }
    if (m.op === 'ban' || m.op === 'unban') {
      if (pid === ADMIN_PID) { out({ ok: false, reason: 'self' }); return; }
      await this.core.withAcct(oid, async r => { if (m.op === 'ban') r.ban = { t: this.core.now(), reason: String(m.reason || '').slice(0, 100) }; else delete r.ban; });
      if (m.op === 'ban') this.core.kickAcct(oid);
      out({ ok: true });
      return;
    }
    out({ ok: false, reason: 'op' });
  }
}
