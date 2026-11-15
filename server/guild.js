/* 囲碁BLITZ — ギルド「碁会所」（将棋なら将棋サロン、麻雀なら雀荘。ゲームごとに別）
 *
 * 保存先
 *   guild:<ID>     … 碁会所ひとつ（名前・マスター・店長・メンバー・今日／今週／今月の対局数・一言・リコール）
 *   guilds:<game>  … 碁会所の目次 [{ id, name, n }]
 *   gsettle:<game>:<年-月> … 月のランキングを配り終えた印
 *   acct:<ID>.guild[<game>] … 入っている碁会所の ID
 *   acct:<ID>.gk   … 自分の受け取り記録（ミッション・おすそわけ）。碁会所をかえても二重にもらえないように
 *
 * やりとり（アプリ → サーバー、すべて { t:'guild', op, req, ... }。返事は { t:'guild', op, req, ok, reason, ... }）
 *   me                 … 自分の碁会所（入っていなければ guild:null）
 *   list   { q }       … 碁会所をさがす（名前・ID。今月の勝ち数の順）
 *   create { name }    … つくる（作った人がマスター）       join { id } … 入る（20人まで）   leave … 抜ける
 *   boss   { pid }     … 店長を任命（マスターだけ。pid が空なら解任）
 *   kick   { pid }     … 追放（マスター・店長。マスターと店長は追放できない）
 *   give   { pid }     … メンバーに50銭（1日5人まで・もらうのは1日3回まで）
 *   claim  { k }       … ミッションのごほうびを受け取る（inner / random / bot / total / week）
 *   recall             … 店長がマスターのリコールをはじめる   vote { yes } … メンバーが投票（8割で成立）
 *   say    { text }    … 一言（碁会所のみんなに届く）          frown { id } … ☹️（やだなぁ）をつける／はずす
 *   rank               … 今月の碁会所ランキング
 *   rec                … おすすめの碁会所（自分の段級位・タグにあうものを5つ）
 *   create { name, short, lvl, join, talk, idle, board, pr } … つくる／ settings { 同じ } … 設定を変える（マスター）
 *      lvl：beg 初心者歓迎 / k<N> N級以上 / d<N> N段以上   join：open 誰でも / apply 申請 / invite 招待のみ
 *      talk：on わいわい（一言を共有）/ off 会話なし   idle：keep 自動バイバイしない / bye 1か月来ない人は自動で退会   board：on / off 掲示板
 *   join { id } … open なら入会、apply なら申請（マスター・店長のメッセージに届く）   approve / reject { pid } … 申請の承認・おことわり
 *   invite { pid } … 招待（だれでも。相手のメッセージに届く）   accept { id, n } / decline { n } … 招待をうける・ことわる
 *   掲示板：threads … スレッド一覧   post { title, text } … スレ立て   reply { tid, text } … 返信   bdel { tid, rid } … 消す（書いた人・マスター・店長）
 *   碁会所内マッチ：gseek { size } / gunseek … ランダム   gcall { pid, hc, auto } … 呼ぶ   gcalls … 一覧
 *                   gok { id } … その手合いでOK（対局開始）   gprop { id, hc } … ハンデの変更を提案   gdrop { id } … やめる
 *
 * サーバー → アプリ { t:'guild', op:'push', kind, ... }：一言・マッチの呼びかけ・メンバーの出入り
 */
import { check, cleanName } from './ng.js';

export const GUILD = {
  max: 20, giveAmount: 50, giveTo: 5, recvMax: 3, needGames: 50, chat: 60, text: 40,
  // ミッション（碁会所の合計。短すぎる対局は数えない）。per: day 1日ごと / week 1週間ごと
  missions: {
    inner: { need: 5, zeni: 100, per: 'day', name: '碁会所内で5局' },
    random: { need: 20, zeni: 100, per: 'day', name: 'ランダムマッチ20局' },
    bot: { need: 20, zeni: 100, per: 'day', name: 'キャラクターと20局' },
    total: { need: 100, zeni: 150, per: 'day', name: 'みんなで100局' },
    week: { need: 500, zeni: 300, per: 'week', name: '1週間で500局' }
  },
  recallRate: 0.8, recallDays: 3, idleDays: 30, pr: 60, threads: 40, replies: 100, btitle: 30, btext: 300
};
// 碁会所のタグ・設定（そろえる）
const LVL = v => /^[kd]([1-9]|10)$/.test(v) && !(v[0] === 'd' && +v.slice(1) > 4) ? v : 'beg';
const LVL_RANK = v => v === 'beg' ? 0 : v[0] === 'k' ? 10 - +v.slice(1) : 9 + +v.slice(1);   // 段級位の番号（0=10級 … 9=1級, 10=初段 …）
export function cleanSet(m) {
  return {
    lvl: LVL(String(m.lvl || 'beg')), join: ['open', 'apply', 'invite'].includes(m.join) ? m.join : 'open',
    talk: m.talk === 'off' ? 'off' : 'on', idle: m.idle === 'bye' ? 'bye' : 'keep', board: m.board === 'off' ? 'off' : 'on'
  };
}
// 月のランキングのごほうび（碁会所ぜんたいの銭。勝ちの数に応じて山分け、マスターは1.3倍の重み）
//   1位 10000銭、上位5%ずつの帯で 8000 → 300銭 へなめらかに下がる。上位5%（と1位）はトロフィーも
export function monthPrize(rank, n) {
  if (rank === 0) return { zeni: 10000, trophy: true };
  const band = Math.min(19, Math.floor(rank / n / 0.05));
  const zeni = Math.round(300 * Math.pow(8000 / 300, (19 - band) / 19) / 10) * 10;
  return { zeni, trophy: band === 0 };
}

const jst = t => new Date(t + 9 * 3600e3);
const dayOf = t => jst(t).toISOString().slice(0, 10);
const weekOf = t => 'w' + Math.floor((Math.floor((t + 9 * 3600e3) / 864e5) + 3) / 7);   // 月曜はじまり
const monthOf = t => jst(t).toISOString().slice(0, 7);
const prevMonth = ym => { const [y, m] = ym.split('-').map(Number); return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`; };
const ALPH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newId = () => { const a = new Uint8Array(6); crypto.getRandomValues(a); return [...a].map(x => ALPH[x % ALPH.length]).join(''); };

export class Guild {
  constructor(core, h) { this.core = core; this.h = h; this.calls = new Map(); this.callSeq = 1; }
  get store() { return this.core.store; }
  now() { return this.core.now(); }
  withG(gid, fn) { return this.core.social.withKey('guild:' + gid, async g => { this.roll(g); return fn(g); }, null); }
  // 日・週・月がかわっていたら、数えなおす
  roll(g) {
    const t = this.now(), d = dayOf(t), w = weekOf(t), m = monthOf(t);
    if (!g.day || g.day.d !== d) g.day = { d, inner: 0, random: 0, bot: 0, total: 0 };
    if (!g.week || g.week.w !== w) g.week = { w, total: 0 };
    if (!g.month || g.month.m !== m) { if (g.month && g.month.m) g.last = { m: g.month.m, wins: g.month.wins }; g.month = { m, wins: {} }; }
    if (g.recall && t - g.recall.at > GUILD.recallDays * 864e5) g.recall = null;
    g.chat = g.chat || []; g.seq = g.seq || 1; g.apps = g.apps || []; g.invites = (g.invites || []).filter(x => t - x.at < 7 * 864e5);
    if (!g.set) g.set = cleanSet({});
    if (!g.short) g.short = String(g.name || '').slice(0, 3);
    // 1か月来ていない人は自動で退会（マスターも。マスターは店長か、いちばん古いメンバーに）
    if (g.set.idle === 'bye') {
      const gone = g.members.filter(m => t - (m.seen || m.at || t) > GUILD.idleDays * 864e5);
      if (gone.length && gone.length < g.members.length) {
        g.members = g.members.filter(m => !gone.includes(m));
        if (gone.some(m => m.id === g.manager)) g.manager = null;
        if (gone.some(m => m.id === g.master)) { g.master = g.manager || g.members[0].id; if (g.master === g.manager) g.manager = null; }
        g.recall = null;
      }
    }
  }
  // ログインしたとき：メンバーの「最後に来た日」（1日1回だけ書く）
  async seen(id, game) {
    const gid = await this.gidOf(id, game); if (!gid) return;
    const d = dayOf(this.now());
    await this.withG(gid, g => { const m = g.members.find(x => x.id === id); if (!m || m.seenDay === d) return false; m.seen = this.now(); m.seenDay = d; });
  }
  // 一言コメントの名前の前につける、碁会所の省略名
  async shortOf(id, game) { const gid = await this.gidOf(id, game); if (!gid) return ''; const g = await this.store.get('guild:' + gid); return g && g.members.some(m => m.id === id) ? (g.short || '') : ''; }
  // 昇級などのお知らせを、碁会所のメンバーにも
  async notifyMembers(id, note, game, skip) {
    const gid = await this.gidOf(id, game); if (!gid) return;
    const g = await this.store.get('guild:' + gid); if (!g) return;
    for (const m of g.members) if (m.id !== id && !(skip || []).includes(m.pid)) await this.core.social.notify(m.id, Object.assign({}, note, { gs: g.short })).catch(() => {});
  }
  // 自分の段級位（9路・13路の高いほう）
  async rankOf(id) {
    const r = await this.store.get('acct:' + id); if (!r) return 0;
    return Math.max(...['go9', 'go13'].map(k => this.h.dispRank(this.h.rateOf(r, k))));
  }
  // おすすめ・一覧で見せる形
  card(g) { this.roll(g); return { id: g.id, name: g.name, short: g.short, n: g.members.length, wins: Object.values(g.month.wins).reduce((a, b) => a + b, 0), set: g.set, pr: g.pr || '', on: g.members.filter(m => this.online(m.id)).length, today: g.day.total }; }
  async gidOf(id, game) { const r = await this.store.get('acct:' + id); return (r && r.guild && r.guild[game || 'go']) || null; }
  online(id) { for (const p of this.core.players.values()) if (p.acct === id && p.sock) return p; return null; }
  sendTo(id, msg) { for (const p of this.core.players.values()) if (p.acct === id && p.sock) { try { p.sock.send(JSON.stringify(Object.assign({ t: 'guild' }, msg))); } catch (e) {} } }
  pushAll(g, msg, skip) { for (const m of g.members) if (m.id !== skip) this.sendTo(m.id, Object.assign({ op: 'push' }, msg)); }
  role(g, id) { return g.master === id ? 'master' : g.manager === id ? 'manager' : 'member'; }
  // アプリに見せる形（☹️の数は、マスターと店長だけ）
  view(g, id) {
    const boss = g.master === id || g.manager === id, mi = this.core.social;
    const frownOf = {};
    for (const c of g.chat) frownOf[c.from] = (frownOf[c.from] || 0) + (c.frown || []).length;
    const members = g.members.map(m => {
      const p = this.online(m.id);
      return { pid: m.pid, name: m.name, role: this.role(g, m.id), on: !!p, busy: !!(p && p.game), av: (p && p.av) || m.av || null, wins: (g.month.wins[m.id] | 0), frown: boss ? (frownOf[m.id] | 0) : undefined, me: m.id === id || undefined };
    });
    const mine = g.members.find(m => m.id === id);
    return {
      id: g.id, name: g.name, at: g.at, role: this.role(g, id), members, max: GUILD.max,
      day: g.day, week: g.week, wins: Object.values(g.month.wins).reduce((a, b) => a + b, 0), month: g.month.m,
      chat: g.set && g.set.talk === 'off' ? [] : g.chat.slice(0, 40).map(c => this.chatView(c, id, boss)),
      recall: g.recall ? { by: g.recall.by, at: g.recall.at, yes: g.recall.yes.length, no: g.recall.no.length, need: this.recallNeed(g), voted: g.recall.yes.includes(id) ? 'yes' : g.recall.no.includes(id) ? 'no' : '' } : null,
      last: g.last || null, me: mine ? mine.pid : null,
      short: g.short, set: g.set, pr: g.pr || '',
      apps: boss ? g.apps.map(a => ({ pid: a.pid, name: a.name, at: a.at })) : undefined
    };
  }
  chatView(c, id, boss) { return { id: c.id, t: c.t, pid: c.pid, name: c.name, gs: c.gs || undefined, av: c.av || null, text: c.text, mine: c.from === id || undefined, frowned: (c.frown || []).includes(id) || undefined, frown: boss ? (c.frown || []).length : undefined }; }
  recallNeed(g) { return Math.max(1, Math.ceil((g.members.length - 1) * GUILD.recallRate)); }   // マスターをのぞいたメンバーの8割

  // 自分の受け取り記録
  gk(r) { const t = this.now(), d = dayOf(t), w = weekOf(t); r.gk = r.gk || {}; if (r.gk.d !== d) { r.gk.d = d; r.gk.got = []; r.gk.to = []; r.gk.recv = 0; } if (r.gk.w !== w) { r.gk.w = w; r.gk.wgot = []; } return r.gk; }
  async meData(id, game) {
    const gid = await this.gidOf(id, game); if (!gid) return null;
    const g = await this.withG(gid, g => { if (!g.members.some(m => m.id === id)) return false; });
    if (!g) { await this.core.withAcct(id, async r => { if (r.guild) delete r.guild[game]; }); return null; }
    const r = await this.store.get('acct:' + id), k = r ? this.gk(Object.assign({}, r, { gk: Object.assign({}, r.gk) })) : {};
    return Object.assign(this.view(g, id), { got: k.got || [], wgot: k.wgot || [], gave: k.to || [], recv: k.recv | 0 });
  }

  /* ---------- 対局を数える（core.js の対局の終わりから） ----------
   *   kind: inner 碁会所内 / random ランダムマッチ / bot キャラクター戦。up：自分の強さ以上の相手に勝った（月のランキング） */
  async count(id, game, kind, up) {
    const gid = await this.gidOf(id, game); if (!gid) return;
    const clear = [];
    const g = await this.withG(gid, g => {
      if (!g.members.some(m => m.id === id)) return false;
      if (g.day[kind] != null) g.day[kind]++;
      g.day.total++; g.week.total++;
      if (up && kind !== 'inner') g.month.wins[id] = (g.month.wins[id] | 0) + 1;
      // ちょうど達成した瞬間のミッション
      for (const [k, ms] of Object.entries(GUILD.missions)) {
        const have = ms.per === 'week' ? g.week.total : g.day[k];
        if (have === ms.need && (k === kind || k === 'total' || k === 'week')) clear.push(ms);
      }
    });
    // ミッションクリアを、メンバーみんなの一言コメント欄に（タップで受け取り画面へ）
    if (g && clear.length) for (const ms of clear) for (const mm of g.members)
      await this.core.social.notify(mm.id, { type: 'gmis', name: ms.name, zeni: ms.zeni, gs: g.short, t: this.now() }).catch(() => {});
  }

  /* ---------- 月のランキング：月がかわってから、だれかが碁会所を開いたときに1回だけ配る ---------- */
  async settle(game) {
    const ym = prevMonth(monthOf(this.now())), key = `gsettle:${game}:${ym}`;
    if (this.settling || await this.store.get(key)) return;
    this.settling = true;
    try {
      await this.store.put(key, { at: this.now(), running: true });
      const idx = (await this.store.get('guilds:' + game)) || [];
      const rows = [];
      for (const it of idx) {
        const g = await this.store.get('guild:' + it.id); if (!g) continue;
        const wins = g.month && g.month.m === ym ? g.month.wins : g.last && g.last.m === ym ? g.last.wins : null;
        const total = wins ? Object.values(wins).reduce((a, b) => a + b, 0) : 0;
        if (total > 0) rows.push({ g, wins, total });
      }
      rows.sort((a, b) => b.total - a.total);
      const result = [];
      for (const [i, row] of rows.entries()) {
        const prize = monthPrize(i, rows.length), g = row.g;
        const weight = m => (row.wins[m.id] | 0) * (m.id === g.master ? 1.3 : 1);
        const sum = g.members.reduce((a, m) => a + weight(m), 0);
        result.push({ id: g.id, name: g.name, total: row.total, rank: i + 1, zeni: prize.zeni });
        for (const m of g.members) {
          const share = sum > 0 ? Math.floor(prize.zeni * weight(m) / sum) : 0;
          const label = `碁会所ランキング ${ym.slice(5)}月 ${i + 1}位「${g.name}」`;
          if (share > 0 || prize.trophy) await this.core.giftTo(m.id, 'guild', share, label, prize.trophy ? { items: ['gk_trophy'] } : undefined);
        }
      }
      await this.store.put(key, { at: this.now(), top: result.slice(0, 50), n: rows.length });
    } finally { this.settling = false; }
  }

  async handle(sock, info, m) {
    const out = msg => { try { sock.send(JSON.stringify(Object.assign({ t: 'guild', op: m.op, req: m.req }, msg))); } catch (e) {} };
    const id = info.acct; if (!id) { out({ ok: false, reason: 'auth' }); return; }
    const game = info.game || 'go', op = m.op, now = this.now();
    const pid = await this.core.social.ensurePid(id);
    const myName = () => cleanName(this.core.social.nameOf(id)) || pid;
    const gid = await this.gidOf(id, game);
    this.settle(game).catch(() => {});
    const fail = reason => out({ ok: false, reason });
    const reply = async extra => out(Object.assign({ ok: true, guild: await this.meData(id, game) }, extra || {}));
    const memberId = async (g, p) => { const oid = await this.core.social.idOf(p); return oid && g.members.some(x => x.id === oid) ? oid : null; };

    if (op === 'me') { const ar = await this.store.get('acct:' + id); return reply({ noinv: !!(ar && ar.noGkInv) }); }
    if (op === 'pref') {   // 設定「碁会所の勧誘を受けない」
      await this.core.withAcct(id, async r => { if (m.noinv) r.noGkInv = 1; else delete r.noGkInv; });
      return out({ ok: true, noinv: !!m.noinv });
    }
    if (op === 'rank') {
      const idx = (await this.store.get('guilds:' + game)) || [], rows = [];
      for (const it of idx) { const g = await this.store.get('guild:' + it.id); if (!g) continue; this.roll(g); rows.push({ id: g.id, name: g.name, n: g.members.length, wins: Object.values(g.month.wins).reduce((a, b) => a + b, 0) }); }
      rows.sort((a, b) => b.wins - a.wins);
      const ranked = rows.filter(r => r.wins > 0);
      const list = rows.slice(0, 50).map((r, i) => Object.assign(r, r.wins > 0 ? { rank: i + 1, prize: monthPrize(i, ranked.length) } : {}));
      out({ ok: true, list, n: ranked.length, mine: gid, last: await this.store.get(`gsettle:${game}:${prevMonth(monthOf(now))}`) || null });
      return;
    }
    if (op === 'list') {
      const q = String(m.q || '').trim().slice(0, 20).toUpperCase(), idx = (await this.store.get('guilds:' + game)) || [];
      const hit = idx.filter(it => !q || it.id === q || it.name.toUpperCase().includes(q)).slice(0, 60);
      const list = [];
      for (const it of hit.slice(0, 30)) { const g = await this.store.get('guild:' + it.id); if (!g) continue; list.push(this.card(g)); }
      list.sort((a, b) => b.wins - a.wins || b.n - a.n);
      out({ ok: true, list, mine: gid });
      return;
    }
    if (op === 'rec') {
      // おすすめ：入れる（満員でない・招待のみでない・段級位が足りる）碁会所から、点数の高い5つ
      const my = await this.rankOf(id), idx = (await this.store.get('guilds:' + game)) || [], rows = [];
      for (const it of idx.slice(-300)) {
        const g = await this.store.get('guild:' + it.id); if (!g) continue;
        const c = this.card(g);
        if (c.n >= GUILD.max || c.set.join === 'invite' || LVL_RANK(c.set.lvl) > my || g.members.some(x => x.id === id)) continue;
        let sc = Math.random() * 3 + Math.min(10, c.today / 5) + c.on * 2 + Math.min(6, c.n);
        if (c.set.lvl === 'beg' && my <= 5) sc += 12;                       // 初心者歓迎 × 10〜5級
        if (c.set.lvl !== 'beg') sc += 10 - Math.min(10, (my - LVL_RANK(c.set.lvl)) * 2);   // 条件がぎりぎりあう＝同じくらいの強さの集まり
        if (c.set.join === 'open') sc += 3;
        if (c.set.talk === 'on') sc += 1;
        rows.push(Object.assign(c, { sc }));
      }
      rows.sort((a, b) => b.sc - a.sc);
      out({ ok: true, list: rows.slice(0, 5).map(r => { delete r.sc; return r; }), my, mine: gid });
      return;
    }
    if (op === 'accept') {
      // 招待をうける：招待はどの設定でも有効（段級位の条件も、招待なら入れる）
      if (gid) return fail('in');
      const nid = String(m.id || '').slice(0, 8);
      let why = '';
      const av = (this.online(id) || {}).av || null;
      const g = await this.withG(nid, g => {
        if (!g.invites.some(x => x.to === id)) { why = 'gone'; return false; }
        if (g.members.length >= GUILD.max) { why = 'full'; return false; }
        g.invites = g.invites.filter(x => x.to !== id); g.apps = g.apps.filter(x => x.id !== id);
        g.members.push({ id, pid, name: myName(), av, at: now, seen: now });
      });
      if (!g) return fail(why || 'none');
      await this.core.withAcct(id, async r => { r.guild = r.guild || {}; r.guild[game] = g.id; });
      await this.index(g); await this.markMail(id, m.n | 0, 'accepted');
      this.pushAll(g, { kind: 'member', text: `${myName()}さんが入りました` }, id);
      return reply();
    }
    if (op === 'decline') { await this.markMail(id, m.n | 0, 'declined'); return out({ ok: true }); }
    if (op === 'create' || op === 'join') {
      if (gid) return fail('in');
      const gd = await this.store.get('gd:' + id + ':' + game), prog = gd && gd.data && gd.data.prog;
      const ar = await this.store.get('acct:' + id);
      if (!(prog && (prog.all || (prog.games | 0) >= GUILD.needGames)) && !(ar && ar.gkFree) && !(gd && gd.data && gd.data.gkFree)) return fail('games');
      const av = (this.online(id) || {}).av || null, me = { id, pid, name: myName(), av, at: now };
      let g;
      if (op === 'create') {
        const name = String(m.name || '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 12), short = String(m.short || '').replace(/[\s\u0000-\u001f\u007f:：]/g, '').slice(0, 3);
        const pr = String(m.pr || '').replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, ' ').trim().slice(0, GUILD.pr);
        if (!name) return fail('name');
        if (!short) return fail('short');
        if (check(name) || check(short) || (pr && check(pr))) return fail('ng');
        const idx = (await this.store.get('guilds:' + game)) || [];
        if (idx.some(it => it.name === name)) return fail('same');
        let nid; do { nid = newId(); } while (await this.store.get('guild:' + nid));
        me.seen = now;
        g = { id: nid, game, name, short, pr, set: cleanSet(m), at: now, master: id, manager: null, members: [me], chat: [], seq: 1 };
        this.roll(g); await this.store.put('guild:' + nid, g);
        await this.core.social.withKey('guilds:' + game, list => { list.push({ id: nid, name, n: 1 }); }, () => []);
      } else {
        let why = '', applied = false;
        const my = await this.rankOf(id);
        me.seen = now;
        g = await this.withG(String(m.id || '').slice(0, 8), g => {
          if (g.members.some(x => x.id === id)) return;
          if (g.members.length >= GUILD.max) { why = 'full'; return false; }
          if (LVL_RANK(g.set.lvl) > my) { why = 'lvl'; return false; }
          if (g.set.join === 'invite') { why = 'invite'; return false; }
          if (g.set.join === 'apply') {
            if (g.apps.some(x => x.id === id)) { why = 'applied'; return false; }
            g.apps.unshift({ id, pid, name: me.name, at: now }); g.apps = g.apps.slice(0, 30); applied = true; return;
          }
          g.members.push(me);
        });
        if (!g) return fail(why || 'none');
        if (applied) {
          for (const boss of [g.master, g.manager]) if (boss) await this.core.mail.deliver(id, boss, `碁会所「${g.name}」への入会申請が届きました。`, 'apply', { gid: g.id, gname: g.name, pid }).catch(() => {});
          return out({ ok: true, applied: true, guild: null });
        }
        this.pushAll(g, { kind: 'member', text: `${me.name}さんが入りました` }, id);
      }
      await this.core.withAcct(id, async r => { r.guild = r.guild || {}; r.guild[game] = g.id; });
      await this.index(g);
      return reply();
    }
    if (!gid) return fail('none');

    if (op === 'leave') {
      let left = null;
      const g = await this.withG(gid, g => {
        g.members = g.members.filter(x => x.id !== id);
        if (g.manager === id) g.manager = null;
        if (g.master === id) { g.master = g.manager || (g.members[0] && g.members[0].id) || null; if (g.master === g.manager) g.manager = null; }
        if (g.recall && (g.recall.by === id || g.master !== g.recall.master)) g.recall = null;
        left = g;
      });
      await this.core.withAcct(id, async r => { if (r.guild) delete r.guild[game]; });
      if (left) { if (!left.members.length) await this.drop(left); else { await this.index(left); this.pushAll(left, { kind: 'member', text: `${myName()}さんが抜けました` }); } }
      for (const [k, c] of this.calls) if (c.from === id || c.to === id) this.calls.delete(k);
      return out({ ok: true, guild: null });
    }
    if (op === 'approve' || op === 'reject') {
      let why = '', app = null;
      const g = await this.withG(gid, g => {
        if (g.master !== id && g.manager !== id) { why = 'role'; return false; }
        app = g.apps.find(x => x.pid === String(m.pid)); if (!app) { why = 'gone'; return false; }
        g.apps = g.apps.filter(x => x !== app);
        if (op === 'reject') return;
        if (g.members.length >= GUILD.max) { why = 'full'; return false; }
        g.members.push({ id: app.id, pid: app.pid, name: app.name, av: null, at: now, seen: now });
      });
      if (!g) return fail(why);
      if (op === 'approve') {
        const ok = await this.core.withAcct(app.id, async r => { r.guild = r.guild || {}; if (r.guild[game]) return false; r.guild[game] = g.id; });
        if (!ok) { await this.withG(gid, g => { g.members = g.members.filter(x => x.id !== app.id); }); return fail('in'); }
        await this.index(g);
        await this.core.mail.deliver(id, app.id, `碁会所「${g.name}」への入会が承認されました。ようこそ！`, 'sys', { gid: g.id, gname: g.name }).catch(() => {});
        this.pushAll(g, { kind: 'member', text: `${app.name}さんが入りました` });
      } else await this.core.mail.deliver(id, app.id, `碁会所「${g.name}」への入会申請は、今回は見送りになりました。`, 'sys', { gid: g.id, gname: g.name }).catch(() => {});
      await this.markMailAll(g, app.pid, op === 'approve' ? 'accepted' : 'declined');
      return reply();
    }
    if (op === 'invite') {
      const oid = await this.core.social.idOf(m.pid);
      if (!oid || oid === id) return fail('who');
      const os = await this.core.social.readSoc(oid), ms = await this.core.social.readSoc(id);
      if (os.blocks.some(b => b.pid === pid) || ms.blocks.some(b => b.pid === String(m.pid))) return fail('blocked');
      if (await this.gidOf(oid, game)) return fail('theirs');
      const oa = await this.store.get('acct:' + oid); if (oa && oa.noGkInv) return fail('noinv');
      let why = '';
      const g = await this.withG(gid, g => {
        if (g.invites.some(x => x.to === oid)) { why = 'invited'; return false; }
        if (g.invites.filter(x => x.by === id).length >= 10) { why = 'many'; return false; }
        g.invites.push({ to: oid, by: id, at: now });
      });
      if (!g) return fail(why);
      await this.core.mail.deliver(id, oid, `碁会所「${g.name}」に招待されました。${g.pr ? '\n「' + g.pr + '」' : ''}`, 'invite', { gid: g.id, gname: g.name });
      return out({ ok: true });
    }
    if (op === 'settings') {
      let why = '';
      const pr = String(m.pr || '').replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, ' ').trim().slice(0, GUILD.pr), short = String(m.short || '').replace(/[\s\u0000-\u001f\u007f:：]/g, '').slice(0, 3);
      if ((pr && check(pr)) || (short && check(short))) return fail('ng');
      const g = await this.withG(gid, g => {
        if (g.master !== id) { why = 'role'; return false; }
        g.set = cleanSet(m); g.pr = pr; if (short) g.short = short;
        if (g.set.talk === 'off') g.chat = g.chat.slice(0, 0);
      });
      if (!g) return fail(why);
      return reply();
    }
    if (op === 'threads' || op === 'post' || op === 'reply' || op === 'bdel') {
      const g0 = await this.store.get('guild:' + gid);
      if (!g0 || !g0.members.some(x => x.id === id)) return fail('none');
      if (g0.set && g0.set.board === 'off') return fail('board');
      const boss = g0.master === id || g0.manager === id, key = 'gboard:' + gid;
      const clean = (v, n) => String(v || '').replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, ' ').trim().slice(0, n);
      let why = '';
      if (op === 'post' || op === 'reply') {
        const title = clean(m.title, GUILD.btitle), text = clean(m.text, GUILD.btext);
        if (!text || (op === 'post' && !title)) return fail('empty');
        if (check(text) || (title && check(title))) return fail('ng');
        this.saidAt = this.saidAt || new Map();
        if (now - (this.saidAt.get(id) || 0) < 4000) return fail('fast');
        this.saidAt.set(id, now);
        const r = await this.core.social.withKey(key, b => {
          b.seq = (b.seq || 0) + 1;
          const it = { id: b.seq, t: now, pid, name: myName(), text };
          if (op === 'post') { b.threads.unshift(Object.assign(it, { title, replies: [], last: now })); b.threads = b.threads.slice(0, GUILD.threads); return; }
          const th = b.threads.find(x => x.id === (m.tid | 0)); if (!th) { why = 'gone'; return false; }
          th.replies.push(it); th.replies = th.replies.slice(-GUILD.replies); th.last = now;
          b.threads = [th].concat(b.threads.filter(x => x !== th));
        }, () => ({ seq: 0, threads: [] }));
        if (!r) return fail(why);
        this.archive(id, op === 'post' ? `[掲示板] ${title}：${text}` : `[掲示板の返信] ${text}`, g0).catch(() => {});
        if (op === 'post') for (const mm of g0.members) if (mm.id !== id)   // スレッドが立ったら、メンバーの一言コメント欄にお知らせ
          this.core.social.notify(mm.id, { type: 'gboard', pid, name: myName(), gs: g0.short, title: String(m.title || '').slice(0, GUILD.btitle), t: now }).catch(() => {});
      } else if (op === 'bdel') {
        const r = await this.core.social.withKey(key, b => {
          const th = b.threads.find(x => x.id === (m.tid | 0)); if (!th) { why = 'gone'; return false; }
          if (m.rid) { const rp = th.replies.find(x => x.id === (m.rid | 0)); if (!rp || (rp.pid !== pid && !boss)) { why = 'role'; return false; } th.replies = th.replies.filter(x => x !== rp); }
          else { if (th.pid !== pid && !boss) { why = 'role'; return false; } b.threads = b.threads.filter(x => x !== th); }
        }, null);
        if (!r) return fail(why || 'gone');
      }
      const b = (await this.store.get(key)) || { threads: [] };
      return out({ ok: true, threads: b.threads, me: pid, boss });
    }
    if (op === 'boss') {
      let why = '';
      const g = await this.withG(gid, async g => {
        if (g.master !== id) { why = 'role'; return false; }
        if (!m.pid) { g.manager = null; g.recall = null; return; }
        const oid = await memberId(g, m.pid); if (!oid || oid === id) { why = 'who'; return false; }
        g.manager = oid; g.recall = null;
      });
      if (!g) return fail(why);
      const mm = g.members.find(x => x.id === g.manager);
      if (mm) this.pushAll(g, { kind: 'member', text: `${mm.name}さんが店長になりました` });
      return reply();
    }
    if (op === 'kick') {
      let why = '', oid = null, name = '';
      const g = await this.withG(gid, async g => {
        if (g.master !== id && g.manager !== id) { why = 'role'; return false; }
        oid = await memberId(g, m.pid);
        if (!oid || oid === g.master || oid === g.manager) { why = 'who'; return false; }
        name = (g.members.find(x => x.id === oid) || {}).name || '';
        g.members = g.members.filter(x => x.id !== oid);
      });
      if (!g) return fail(why);
      await this.core.withAcct(oid, async r => { if (r.guild && r.guild[game] === gid) delete r.guild[game]; });
      this.sendTo(oid, { op: 'push', kind: 'kicked', text: `碁会所「${g.name}」から外れました` });
      await this.index(g);
      this.pushAll(g, { kind: 'member', text: `${name}さんが碁会所を外れました` });
      return reply();
    }
    if (op === 'give') {
      let why = '';
      const g = await this.store.get('guild:' + gid);
      const oid = g && await memberId(g, m.pid);
      if (!oid || oid === id) return fail('who');
      const r1 = await this.core.withAcct(id, async r => { const k = this.gk(r); if (k.to.includes(m.pid)) { why = 'twice'; return false; } if (k.to.length >= GUILD.giveTo) { why = 'many'; return false; } k.to.push(String(m.pid)); });
      if (!r1) return fail(why);
      const ok = await this.core.giftTo(oid, 'guild', GUILD.giveAmount, `碁会所の${myName()}さんから${GUILD.giveAmount}銭`, { pid }, r => { const k = this.gk(r); if (k.recv >= GUILD.recvMax) return false; k.recv++; });
      if (!ok) { await this.core.withAcct(id, async r => { const k = this.gk(r); k.to = k.to.filter(x => x !== String(m.pid)); }); return fail('full'); }
      this.sendTo(oid, { op: 'push', kind: 'give', text: `碁会所の${myName()}さんから${GUILD.giveAmount}銭が届きました` });
      return reply();
    }
    if (op === 'claim') {
      const k = String(m.k || ''), ms = GUILD.missions[k]; if (!ms) return fail('k');
      const g = await this.withG(gid, () => false) || await this.store.get('guild:' + gid);
      if (!g) return fail('none');
      this.roll(g);
      const have = ms.per === 'week' ? g.week.total : g.day[k];
      if ((have | 0) < ms.need) return fail('yet');
      let why = '';
      const r = await this.core.withAcct(id, async r => { const gk = this.gk(r), list = ms.per === 'week' ? gk.wgot : gk.got; if (list.includes(k)) { why = 'got'; return false; } list.push(k); });
      if (!r) return fail(why);
      await this.core.give(id, ms.zeni, 'guild', sock);
      return reply({ gained: ms.zeni });
    }
    if (op === 'recall') {
      let why = '';
      const g = await this.withG(gid, g => {
        if (g.manager !== id) { why = 'role'; return false; }
        if (g.recall) { why = 'already'; return false; }
        g.recall = { by: pid, at: now, master: g.master, yes: [id], no: [] };
        return this.recallCheck(g);
      });
      if (!g) return fail(why);
      this.pushAll(g, { kind: 'recall', text: '店長がマスターのリコールをはじめました。碁会所で投票してください' });
      return reply();
    }
    if (op === 'vote') {
      let why = '', done = null;
      const g = await this.withG(gid, g => {
        if (!g.recall) { why = 'none'; return false; }
        if (id === g.master) { why = 'role'; return false; }
        g.recall.yes = g.recall.yes.filter(x => x !== id); g.recall.no = g.recall.no.filter(x => x !== id);
        (m.yes ? g.recall.yes : g.recall.no).push(id);
        done = this.recallCheck(g);
      });
      if (!g) return fail(why);
      if (done) {
        await this.core.withAcct(done.old, async r => { if (r.guild && r.guild[game] === gid) delete r.guild[game]; });
        this.sendTo(done.old, { op: 'push', kind: 'kicked', text: `リコールが成立し、碁会所「${g.name}」から外れました` });
        await this.index(g);
        this.pushAll(g, { kind: 'member', text: `リコールが成立しました。${done.name}さんが新しいマスターです` });
      }
      return reply({ recalled: !!done });
    }
    if (op === 'say') {
      const g0 = await this.store.get('guild:' + gid);
      if (g0 && g0.set && g0.set.talk === 'off') return fail('talkoff');
      const text = String(m.text || '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
      if (!text) return fail('empty');
      if (text.length > GUILD.text) return fail('long');
      if (check(text)) return fail('ng');
      this.saidAt = this.saidAt || new Map();
      if (now - (this.saidAt.get(id) || 0) < 4000) return fail('fast');
      this.saidAt.set(id, now);
      let item = null;
      const g = await this.withG(gid, g => {
        if (!g.members.some(x => x.id === id)) return false;
        item = { id: g.seq++, t: now, from: id, pid, name: myName(), gs: g.short, av: (this.online(id) || {}).av || null, text, frown: [] };
        g.chat.unshift(item); g.chat = g.chat.slice(0, GUILD.chat);
      });
      if (!g) return fail('none');
      this.archive(id, text, g).catch(() => {});
      for (const mm of g.members) { const boss = g.master === mm.id || g.manager === mm.id; this.sendTo(mm.id, { op: 'push', kind: 'say', item: this.chatView(item, mm.id, boss), guild: g.name }); }
      return out({ ok: true });
    }
    if (op === 'frown') {
      let why = '';
      const g = await this.withG(gid, g => {
        const c = g.chat.find(x => x.id === (m.id | 0)); if (!c) { why = 'none'; return false; }
        if (c.from === id) { why = 'mine'; return false; }
        c.frown = c.frown || [];
        if (c.frown.includes(id)) c.frown = c.frown.filter(x => x !== id); else c.frown.push(id);
      });
      if (!g) return fail(why);
      return reply();
    }
    // ---------- 碁会所内マッチ ----------
    const pl = this.core.players.get(this.core.socks.get(sock));
    if (!pl) return fail('net');
    if (op === 'gseek' || op === 'gunseek') {
      pl.gseek = op === 'gseek' && !pl.game ? { gid, size: m.size === 13 ? 13 : 9, at: now } : null;
      if (pl.gseek) { pl.seekAt = 0; this.core.closeRoom(pl); this.gmatch(gid); }
      return out({ ok: true, seeking: !!pl.gseek });
    }
    this.sweepCalls();
    if (op === 'gcalls') return out({ ok: true, calls: this.callsOf(id) });
    if (op === 'gcall') {
      const g = await this.store.get('guild:' + gid);
      const oid = g && await memberId(g, m.pid);
      if (!oid || oid === id) return fail('who');
      let hc = this.core.cleanHc(m.hc || {});
      if (m.auto) hc = await this.autoHc(id, oid, hc);
      for (const [k, c] of this.calls) if (c.from === id) this.calls.delete(k);
      const c = { id: this.callSeq++, gid, from: id, fromPid: pid, fromName: myName(), to: oid, toPid: String(m.pid), toName: (g.members.find(x => x.id === oid) || {}).name || '', hc, turn: 'to', who: 'from', at: now, auto: !!m.auto };
      this.calls.set(c.id, c);
      this.sendTo(oid, { op: 'push', kind: 'call', call: this.callView(c, oid), text: `${c.fromName}さんが碁会所内マッチであなたを待っています` });
      return out({ ok: true, call: this.callView(c, id), calls: this.callsOf(id) });
    }
    const c = this.calls.get(m.id | 0);
    if (!c || (c.from !== id && c.to !== id)) return fail('gone');
    const other = c.from === id ? c.to : c.from;
    if (op === 'gdrop') {
      this.calls.delete(c.id);
      this.sendTo(other, { op: 'push', kind: 'calldrop', id: c.id, text: '碁会所内マッチの呼びかけが取り消されました' });
      return out({ ok: true, calls: this.callsOf(id) });
    }
    const side = c.from === id ? 'from' : 'to';
    if (op === 'gprop') {
      c.hc = this.core.cleanHc(m.hc || {}); c.auto = !!m.auto;
      if (c.auto) c.hc = await this.autoHc(c.from, c.to, c.hc);
      c.turn = side === 'from' ? 'to' : 'from'; c.who = side; c.at = now;
      this.sendTo(other, { op: 'push', kind: 'call', call: this.callView(c, other), text: 'ハンデの変更が提案されました' });
      return out({ ok: true, calls: this.callsOf(id) });
    }
    if (op === 'gok') {
      if (c.turn !== side) return fail('turn');
      const a = this.online(c.from), b = this.online(c.to);
      if (!a || !b) return fail('off');
      if (a.game || b.game) return fail('busy');
      this.calls.delete(c.id);
      for (const p of [a, b]) { p.gseek = null; p.seekAt = 0; }
      this.core.create(a, b, c.hc, null, null, c.gid);
      return out({ ok: true });
    }
    return fail('op');
  }
  // マスターの追放が決まったか（マスターをのぞいたメンバーの8割が賛成）
  recallCheck(g) {
    if (!g.recall || g.recall.yes.length < this.recallNeed(g)) return null;
    const old = g.master, nm = g.manager;
    if (!nm || !g.members.some(x => x.id === nm)) { g.recall = null; return null; }
    g.members = g.members.filter(x => x.id !== old);
    g.master = nm; g.manager = null; g.recall = null;
    return { old, name: (g.members.find(x => x.id === nm) || {}).name || '' };
  }
  // 階級差でハンデを決める：弱いほうが黒。差1で定先、2〜5で置き石
  async autoHc(a, b, hc) {
    const key = 'go' + (hc.size === 13 ? 13 : 9), ra = await this.store.get('acct:' + a), rb = await this.store.get('acct:' + b);
    const ka = ra ? this.h.dispRank(this.h.rateOf(ra, key)) : 0, kb = rb ? this.h.dispRank(this.h.rateOf(rb, key)) : 0;
    const d = Math.min(5, Math.abs(ka - kb));
    return this.core.cleanHc(Object.assign({}, hc, { h: d, black: d === 0 ? 'random' : ka < kb ? 'host' : 'guest' }));
  }
  callView(c, id) {
    const mine = c.from === id;
    return { id: c.id, mine, pid: mine ? c.toPid : c.fromPid, name: mine ? c.toName : c.fromName, hc: c.hc, myBlack: c.hc.black === 'random' ? null : (c.hc.black === 'host') === mine, myTurn: c.turn === (mine ? 'from' : 'to'), proposed: c.who !== 'from' || undefined, auto: c.auto || undefined, at: c.at };
  }
  callsOf(id) { return [...this.calls.values()].filter(c => c.from === id || c.to === id).map(c => this.callView(c, id)); }
  sweepCalls() { const t = this.now(); for (const [k, c] of this.calls) if (t - c.at > 15 * 60000) this.calls.delete(k); }
  // 碁会所内のランダムマッチ（同じ碁会所・同じ盤の大きさで待っている人どうし。互先・コミ7目）
  gmatch(gid) {
    const q = [...this.core.players.values()].filter(p => p.gseek && p.gseek.gid === gid && p.sock && !p.game).sort((a, b) => a.gseek.at - b.gseek.at);
    while (q.length >= 2) {
      const a = q.shift(), bi = q.findIndex(b => b.gseek.size === a.gseek.size);
      if (bi < 0) continue;
      const b = q.splice(bi, 1)[0], size = a.gseek.size;
      a.gseek = b.gseek = null;
      this.core.create(a, b, this.core.cleanHc({ h: 0, black: 'random', min: size === 13 ? 10 : 5, size }), null, null, gid);
    }
  }
  async index(g) {
    await this.core.social.withKey('guilds:' + (g.game || 'go'), list => { const it = list.find(x => x.id === g.id); if (it) { it.name = g.name; it.n = g.members.length; } else list.push({ id: g.id, name: g.name, n: g.members.length }); }, () => []);
  }
  // 一言・掲示板の書きこみを、運営用に残す（あとで消されても分かるように）
  archive(id, text, g) { return this.core.social.logPost(id, { where: `碁会所「${g.name}」`, text }); }
  // メッセージの申請・招待を「すんだ」にする
  async markMail(id, n, done) { if (!n) return; await this.core.social.withKey('mbox:' + id, b => { const x = b.items.find(x => x.n === n); if (!x) return false; x.done = done; x.read = true; }, null); }
  async markMailAll(g, appPid, done) {
    for (const boss of [g.master, g.manager]) if (boss) await this.core.social.withKey('mbox:' + boss, b => { let ch = false; for (const x of b.items) if (x.kind === 'apply' && x.extra && x.extra.gid === g.id && x.extra.pid === appPid && !x.done) { x.done = done; x.read = true; ch = true; } if (!ch) return false; }, null);
  }
  async drop(g) {
    await this.core.social.withKey('guilds:' + (g.game || 'go'), list => { const l = list.filter(x => x.id !== g.id); list.length = 0; list.push(...l); }, () => []);
    if (this.store.del) await this.store.del('guild:' + g.id);
  }
}
