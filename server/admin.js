/* 共通：運営（管理者）の画面のためのやりとり
 * 二重のロック：① 部屋番号 ADMIN_PID のアカウントで入っている　② 運営の合言葉（ADMIN_KEY）を入れた
 *   合言葉は Cloudflare の「秘密の設定」にだけあり、コードにも保存データにも書かない。
 *   入れた合言葉は、その接続のあいだ12時間まで有効（アプリを開きなおしたら、もう一度）。
 *   5回まちがえたら1時間ロック。成功・失敗はすべて記録（adminlog：時刻・IP）。
 *   ADMIN_KEY が設定されていなければ、だれも運営画面を使えない。
 *   { t:'admin', op, req, ... }
 *   unlock { key }    … 合言葉を確かめる
 *   reports           … 通報の一覧（部屋・日記・一言の通報 ＋ メッセージの通報）
 *   user { pid }      … その人の情報（名前・作成日・銭・碁会所・利用停止か）と、書きこみの写し（一言・コメント・碁会所の一言・掲示板）
 *   ban { pid, reason } / unban { pid } … アカウントの利用停止（ログインできなくなる）・解除
 *   clear { kind }    … 通報の一覧を片づける（soc / mail）
 * メッセージ（1対1）は「通信の秘密」があるので、運営が自由に読むことはしない。
 * 見られるのは、受け取った人が通報したメッセージと、その前後のやりとり（通報した人の箱にあるもの）だけ。
 */
import { sha } from './account.js';

export const ADMIN_PID = '561149';

const UNLOCK_MS = 12 * 3600e3, MAX_FAIL = 5, LOCK_MS = 3600e3;

// 同じ長さの文字どうしを、かかる時間が中身によらないように比べる
function same(a, b) { if (a.length !== b.length) return false; let x = 0; for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i); return x === 0; }

export class Admin {
  constructor(core) { this.core = core; }
  get store() { return this.core.store; }
  // 運営として使えるか（部屋番号 ＋ 合言葉）
  isAdmin(info, pid) { return pid === ADMIN_PID && !!this.core.adminKey && !!info.adminAt && this.core.now() - info.adminAt < UNLOCK_MS; }
  async log(info, ok, what) { await this.core.social.withKey('adminlog', l => { l.unshift({ t: this.core.now(), ip: info.ip || '', ok, what }); if (l.length > 500) l.length = 500; }, () => []); }
  async unlock(info, key) {
    const now = this.core.now();
    if (!this.core.adminKey) return { ok: false, reason: 'nokey' };
    const st = (await this.store.get('adminfail')) || { n: 0, until: 0 };
    if (st.until > now) return { ok: false, reason: 'locked', sec: Math.ceil((st.until - now) / 1000) };
    const ok = same(await sha('admin:' + String(key || '')), await sha('admin:' + this.core.adminKey));
    if (ok) { info.adminAt = now; await this.store.put('adminfail', { n: 0, until: 0 }); await this.log(info, true, 'unlock'); return { ok: true }; }
    const n = st.n + 1;
    await this.store.put('adminfail', n >= MAX_FAIL ? { n: 0, until: now + LOCK_MS } : { n, until: 0 });
    await this.log(info, false, 'unlock');
    return { ok: false, reason: n >= MAX_FAIL ? 'locked' : 'key', left: Math.max(0, MAX_FAIL - n), sec: n >= MAX_FAIL ? LOCK_MS / 1000 : 0 };
  }
  async handle(sock, info, m) {
    const out = msg => { try { sock.send(JSON.stringify(Object.assign({ t: 'admin', op: m.op, req: m.req }, msg))); } catch (e) {} };
    const id = info.acct; if (!id) { out({ ok: false, reason: 'auth' }); return; }
    const me = await this.core.social.ensurePid(id);
    if (me !== ADMIN_PID) { out({ ok: false, reason: 'admin' }); return; }
    if (m.op === 'unlock') { out(await this.unlock(info, m.key)); return; }
    if (!this.isAdmin(info, me)) { out({ ok: false, reason: this.core.adminKey ? 'lock' : 'nokey' }); return; }
    if (m.op === 'log') { out({ ok: true, log: ((await this.store.get('adminlog')) || []).slice(0, 100) }); return; }
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
