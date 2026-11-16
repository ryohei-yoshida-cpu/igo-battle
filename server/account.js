/* アカウント：作る・入る・保存・削除。パスワードはハッシュ（SHA-256）にして保存する */
import { normCode, LIMIT } from './core.js';
import { cleanStats, dailyGift, ensureEcon, gameOf, gamePack, pubEcon } from './econ.js';
import { cleanName } from './ng.js';
import { dispRank, rateOf } from './rating.js';
export const ALPH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // まぎらわしい 0/O/1/I は使わない
export function randCode(n) { const a = new Uint8Array(n); crypto.getRandomValues(a); let s = ''; for (const x of a) s += ALPH[x % ALPH.length]; return s; }
export async function sha(text) { const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)); return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join(''); }

export class AccountMethods {
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
      // パスワードの総当たりを防ぐ：同じIPから1時間に30回まちがえたら、しばらくログインできない
      this.failLog = this.failLog || new Map();
      const now = this.now(), fails = (this.failLog.get(ip) || []).filter(t => now - t < 3600e3);
      if (fails.length >= LIMIT.loginFailsPerHour) { out({ t: 'busy', what: 'login' }); return; }
      if (!rec || rec.h !== await sha(id + ':' + pass)) {
        fails.push(now); this.failLog.set(ip, fails);
        if (this.failLog.size > 10000) this.failLog.delete(this.failLog.keys().next().value);
        out({ t: 'authfail', restore: !!m.restore }); return;
      }
      if (rec.ban) { out({ t: 'banned', reason: rec.ban.reason || '' }); return; }   // 利用停止のアカウント
      info.game = game; this.bindAcct(sock, info, id);
      this.guild.seen(id, game).catch(() => {});
      this.mail.purge().catch(() => {});
      let welcome = false;
      const rec2 = await this.withAcct(id, async r => { ensureEcon(r); dailyGift(r, this.now()); gamePack(r, game, this.now()); if (r.welcome) { welcome = true; delete r.welcome; } return true; });
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
        r.name = cleanName(data.name);
        r.stats = r.stats || {}; const st = cleanStats(m.stats);
        if (st && game === 'go') for (const k of ['go9', 'go13']) { const t = rateOf(r, k); st[k] = Object.assign(st[k] || {}, { rating: t.rating, games: t.games, wins: t.wins, draws: t.draws, streak: t.streak, rank: dispRank(t) }); }   // レートはサーバーの数字で
        if (st) r.stats[game] = st;
        ok = true;
      });
      out({ t: 'synced', at, stale: !rec || !ok });
    }
  }

  // ゲームのセーブデータ（gd:<ID>:<ゲーム>）
  async gameData(id, r, game) {
    return (await this.store.get('gd:' + id + ':' + game)) || { data: null, at: 0 };
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
  // 利用停止にしたアカウントを、いまの接続から外す
  /* ---------- アカウント削除（アプリの設定から。Google Play のきまり） ----------
   * 消すもの：アカウント（銭・勾玉・持ち物・部屋・アバター・レート）、ゲームのセーブ、日記・一言・フレンド、受信箱、碁会所の所属、部屋番号
   * 残すもの：書きこみとメッセージの写し・通報（違反への対応のため。1年たったら自動で消える。プライバシーポリシー6）
   * 本人のパスワードを、もう一度確かめてから消す */
  async deleteAcct(sock, m) {
    const info = this.sockInfo.get(sock), out = msg => { try { sock.send(JSON.stringify(Object.assign({ t: 'delacct', req: m.req }, msg))); } catch (e) {} };
    const id = info && info.acct; if (!id) return out({ ok: false, reason: 'auth' });
    const rec = await this.store.get('acct:' + id);
    if (!rec || rec.h !== await sha(id + ':' + normCode(m.pass))) return out({ ok: false, reason: 'pass' });
    const pid = rec.pid || null;
    await this.guild.leaveAll(id, rec.guild).catch(() => {});
    await this.social.deleteAll(id, pid).catch(() => {});
    const games = new Set(['go'].concat(Object.keys(rec.stats || {}), Object.keys(rec.tama || {}), Object.keys(rec.guild || {})));
    for (const g of games) await this.store.del('gd:' + id + ':' + g);
    await this.store.del('mbox:' + id);
    // 同じアカウントの処理が終わるのを待ってから消す
    await this.withAcct(id, async () => false).catch(() => {});
    await this.store.del('acct:' + id);
    await this.social.withKey('deleted', list => { list.unshift({ t: this.now(), pid }); if (list.length > 1000) list.length = 1000; }, () => []);
    out({ ok: true });
    for (const [s2, inf] of this.sockInfo) if (inf && inf.acct === id) { inf.acct = null; if (s2 !== sock) { try { s2.send(JSON.stringify({ t: 'delacct', ok: true, other: true })); } catch (e) {} } }
    for (const p of this.players.values()) if (p.acct === id) { p.acct = null; p.pid = null; }
  }
  kickAcct(id) {
    for (const [sock, info] of this.sockInfo) if (info && info.acct === id) { try { sock.send(JSON.stringify({ t: 'banned' })); } catch (e) {} info.acct = null; }
  }
  // 同じアカウントの読み書きが重ならないよう、順番に処理する
}
