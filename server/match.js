/* 対局：出会わせる・手と時計を中継する・ルールの確認・整地・レート */
import { GAME_ZENI } from './econ.js';
import { START_RATE, applyRate, dispRank, rankGift, rankItems, rateOf } from './rating.js';
import * as GO from './gorules.js';
import { cleanName } from './ng.js';
export const MAIN_MS = 5 * 60 * 1000, INC_MS = 5000, AWAY_MS = 180 * 1000, START_DELAY_MS = 2500;
export const KOMI = 7;   // ランダムマッチのコミ（アプリと同じ。同点は持碁）

export class MatchMethods {
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
  create(a, b, hc, black, size, gk) {
    size = hc ? hc.size : size === 13 ? 13 : 9;
    const id = 'g' + (++this.seq) + '-' + Math.random().toString(36).slice(2, 7);
    if (!black) black = hc && hc.black === 'host' ? a : hc && hc.black === 'guest' ? b : Math.random() < 0.5 ? a : b;
    const white = black === a ? b : a;
    const main = hc ? hc.min * 60000 : MAIN_MS * (size === 13 ? 2 : 1);   // 13路のランダムマッチは10分
    const g = {
      id, players: { 1: black.cid, 2: white.cid }, colorOf: { [black.cid]: 1, [white.cid]: 2 },
      hc: hc || null, host: hc ? a.cid : null, size, gk: gk || null,
      moves: [], clock: { 1: main, 2: main }, toPlay: hc && hc.h >= 2 ? 2 : 1, turnStart: this.now() + START_DELAY_MS,
      passes: 0, over: false, scoring: false, away: { 1: null, 2: null }, timer: null, acked: {}, endMsg: null,
      // サーバーも盤面を持って、ルールどおりの手か確かめる（置き石も同じ位置に）
      board: GO.start(size, hc && hc.h >= 2 ? hc.h : 0), ko: -1, komi: hc ? (hc.komi | 0) : KOMI, scores: {}
    };
    this.games.set(id, g);
    for (const p of [black, white]) { p.seekAt = 0; p.game = id; this.closeRoom(p); }
    for (const c of [1, 2]) this.send(g.players[c], { t: 'start', g: id, color: c, opp: this.pub(g.players[3 - c]), clock: this.clocks(g), delay: START_DELAY_MS, hc: g.hc || undefined, size: g.size, gk: g.gk || undefined });
    this.arm(g);
    return g;
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
    if (p >= 0) {   // 石のあるところ・自殺手・コウは打てない（改造したアプリの手は受けつけない）
      const r = GO.play(g.board, g.size || 9, p, c, g.ko); if (!r) return;
      g.board = r.board; g.ko = r.ko;
    } else g.ko = -1;
    const used = Math.max(0, this.now() - g.turnStart);
    if (g.clock[c] - used <= 0) { this.finish(g, 3 - c, '時間切れ'); return; }
    g.clock[c] = g.clock[c] - used + INC_MS;
    g.moves.push(p); g.toPlay = 3 - c; g.turnStart = this.now();
    g.passes = p < 0 ? g.passes + 1 : 0;
    if (g.passes >= 2) g.scoring = true;
    const msg = { t: 'move', g: g.id, n: g.moves.length - 1, p, c, clock: this.clocks(g) };
    for (const cc of [1, 2]) this.send(g.players[cc], msg);
    if (g.scoring) {
      // 両方のアプリが整地して送ってくる（scoreIn）。30秒たっても来なければ、来たほう、どちらも来なければ持碁
      g.timer = this.setTimeout(() => { if (!g.over) this.scoreDone(g); }, 30000);
    } else this.arm(g);
  }

  /* ---------- フレンドマッチ：合言葉（4けたの数字）で部屋に入る ---------- */
  fhost(pl, m) {
    if (pl.game) return;
    const hc = this.cleanHc(m.hc);
    this.closeRoom(pl); pl.seekAt = 0;
    if (this.rooms.size > 5000) return;
    let code; do { code = String(1000 + Math.floor(Math.random() * 9000)); } while (this.rooms.has(code));
    this.rooms.set(code, { code, host: pl.cid, hc, at: this.now() });
    pl.room = code;
    this.send(pl.cid, { t: 'froom', code, hc });
  }
  // ハンデ（フレンドマッチ・碁会所内マッチ）：置き石 0〜5、黒番 host/guest/random、持ち時間、盤
  cleanHc(h) {
    h = h || {};
    const hc = {
      h: [0, 1, 2, 3, 4, 5].includes(h.h) ? h.h : 0,
      black: ['host', 'guest', 'random'].includes(h.black) ? h.black : 'random',
      min: [3, 5, 10, 15].includes(h.min) ? h.min : 5,
      size: h.size === 13 ? 13 : 9
    };
    if (hc.h > 0 && hc.black === 'random') hc.black = 'guest';
    hc.komi = hc.h === 0 ? 7 : 0;
    return hc;
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
    this.create(host, guest, g.hc, black, null, g.gk);
  }

  /* ---------- 整地：アプリの言う「勝ち負け」はそのまま使わない ----------
   * それぞれのアプリから「死に石」の位置だけをもらい、サーバーが自分の盤面で地を数えなおす。
   * 両方そろって勝ち負けが同じならその結果。食いちがったら「無効試合」（レートも碁会所の勝ちも動かない）。
   * 片方しか来なかったとき（相手が切断など）は、来たほうの死に石で数える。 */
  scoreIn(g, c, res) {
    if (!c || g.scores[c]) return;
    g.scores[c] = GO.score(g.board, g.size || 9, res && Array.isArray(res.dead) ? res.dead : [], g.komi);
    if (g.scores[1] && g.scores[2]) this.scoreDone(g);
    else { this.clearTimeout(g.timer); g.timer = this.setTimeout(() => { if (!g.over) this.scoreDone(g); }, 15000); }
  }
  scoreDone(g) {
    if (g.over) return;
    const a = g.scores[1], b = g.scores[2];
    if (a && b && a.winner !== b.winner) {
      this.dispute(g).catch(() => {});
      return this.finish(g, 0, '無効試合', Object.assign({}, a, { winner: 0, void: true }), { void: true });
    }
    const r = a || b;
    if (!r) return this.finish(g, 0, '整地', null);
    this.finish(g, r.winner, '整地', r);
  }
  // 整地が食いちがった記録（運営が見る。同じ人が何度も起こしていたら、改造アプリのうたがい）
  async dispute(g) {
    const ps = [1, 2].map(c => this.players.get(g.players[c]));
    await this.social.withKey('disputes', list => { list.unshift({ t: this.now(), g: g.id, pids: ps.map(p => p && p.pid || null), accts: ps.map(p => p && p.acct || null), moves: g.moves.slice(), dead: [g.scores[1].dead, g.scores[2].dead] }); if (list.length > 300) list.length = 300; }, () => []);
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
      await this.withAcct(p.acct, async r => { t = rateOf(r, key); const b = dispRank(t); d = applyRate(t, before[1 - i], score, false); rankGift(r, key, b, t, this.now()); rankItems(r, this.now()); });
      if (t) this.sendRate(p.acct, key, t, d, g.id);
    }
  }
  sendRate(acct, key, t, d, gid) {
    const msg = Object.assign({ t: 'rate', key, d, g: gid, rank: dispRank(t) }, t);
    for (const p of this.players.values()) if (p.acct === acct) { p.rates = Object.assign(p.rates || {}, { [key]: t.rating }); if (key === 'go' + (p.size || 9)) p.rating = t.rating; if (p.sock) { try { p.sock.send(JSON.stringify(msg)); } catch (e) {} } }
  }
  finish(g, winner, reason, res, opt) {
    const voided = !!(opt && opt.void);
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
    // 碁会所の対局数・月のランキング（短すぎる対局は数えない。勝ち数は自分の強さ以上の相手に勝ったときだけ）
    if (g.moves.length >= 16 && (g.gk || !g.hc) && !voided) {
      const key = 'go' + (g.size === 13 ? 13 : 9), ps = [1, 2].map(c => this.players.get(g.players[c]));
      const rt = p => (p && p.rates && p.rates[key]) || (p && p.rating) || START_RATE;
      if (ps.every(p => p && p.acct) && ps[0].acct !== ps[1].acct) ps.forEach((p, i) => {
        const up = winner === i + 1 && rt(ps[1 - i]) >= rt(p);
        this.guild.count(p.acct, 'go', g.gk ? 'inner' : 'random', up).catch(() => {});
      });
    }
    if (!g.hc && !voided) this.rateOnline(g, winner).catch(() => {});
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
