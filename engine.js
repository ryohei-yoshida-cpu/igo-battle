/* 囲碁BLITZ — 囲碁エンジン（ルール判定 + モンテカルロ木探索bot）
 * ブラウザ本体では <script> で読み込み、Web Worker ではそのまま実行される。 */
(function (root) {
  'use strict';
  // 盤の大きさ（9路・13路）ごとに、エンジンを1つずつ作る
  function make(N) {
  const NN = N * N;
  const NB = [], DG = [];
  for (let p = 0; p < NN; p++) {
    const x = p % N, y = (p / N) | 0;
    const a = [];
    if (x > 0) a.push(p - 1);
    if (x < N - 1) a.push(p + 1);
    if (y > 0) a.push(p - N);
    if (y < N - 1) a.push(p + N);
    NB.push(a);
    const d = [];
    for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const X = x + dx, Y = y + dy;
      if (X >= 0 && X < N && Y >= 0 && Y < N) d.push(Y * N + X);
    }
    DG.push(d);
  }

  /* =========================================================
   * 画面用：配列の盤面で着手を判定する（わかりやすさ優先）
   * ========================================================= */
  const mark = new Int32Array(NN), lmark = new Int32Array(NN);
  let stamp = 1;
  function group(b, p) {
    if (++stamp > 2e9) { mark.fill(0); lmark.fill(0); stamp = 1; }   // 長時間の計算でも番号があふれないように
    const c = b[p], st = [p], libs = [];
    mark[p] = stamp;
    for (let i = 0; i < st.length; i++) {
      const nb = NB[st[i]];
      for (let j = 0; j < nb.length; j++) {
        const r = nb[j], v = b[r];
        if (v === 0) { if (lmark[r] !== stamp) { lmark[r] = stamp; libs.push(r); } }
        else if (v === c && mark[r] !== stamp) { mark[r] = stamp; st.push(r); }
      }
    }
    return { stones: st, libs };
  }

  function play(b, p, c, ko) {
    if (p < 0 || p >= NN || p === ko || b[p] !== 0) return null;
    const nb = b.slice(), o = 3 - c, cap = [];
    nb[p] = c;
    for (const r of NB[p]) {
      if (nb[r] === o) {
        const g = group(nb, r);
        if (g.libs.length === 0) for (const s of g.stones) { nb[s] = 0; cap.push(s); }
      }
    }
    const g = group(nb, p);
    if (g.libs.length === 0) return null;
    const ko2 = (cap.length === 1 && g.stones.length === 1 && g.libs.length === 1) ? cap[0] : -1;
    return { board: nb, cap, ko: ko2 };
  }

  /* =========================================================
   * bot用：連と呼吸点を逐次管理する高速な盤面
   * 呼吸点は「疑似呼吸点」（石と空点の接触の数）で数え、
   * 合計と二乗和からアタリ（呼吸点が1か所だけ）を判定する。
   * ========================================================= */
  function FB() {
    this.col = new Int8Array(NN);
    this.rep = new Int16Array(NN);
    this.nxt = new Int16Array(NN);
    this.cnt = new Int16Array(NN);
    this.sum = new Int32Array(NN);
    this.sum2 = new Int32Array(NN);
    this.size = new Int16Array(NN);
    this.ko = -1;
  }
  FB.prototype.copyFrom = function (o) {
    this.col.set(o.col); this.rep.set(o.rep); this.nxt.set(o.nxt); this.cnt.set(o.cnt);
    this.sum.set(o.sum); this.sum2.set(o.sum2); this.size.set(o.size); this.ko = o.ko;
  };
  FB.fromArray = function (arr, ko) {
    const f = new FB();
    for (let p = 0; p < NN; p++) if (arr[p]) f.place(p, arr[p]);
    f.ko = ko === undefined ? -1 : ko;
    return f;
  };
  FB.prototype.inAtari = function (r) {
    const n = this.cnt[r];
    return n > 0 && this.sum[r] * this.sum[r] === n * this.sum2[r];
  };
  FB.prototype.lib1 = function (r) { return this.sum[r] / this.cnt[r]; };
  FB.prototype.legal = function (p, c) {
    if (this.col[p] !== 0 || p === this.ko) return false;
    const nb = NB[p];
    for (let j = 0; j < nb.length; j++) {
      const q = nb[j], v = this.col[q];
      if (v === 0) return true;
      const a = this.inAtari(this.rep[q]);
      if (v === c ? !a : a) return true;
    }
    return false;
  };
  FB.prototype.isEye = function (p, c) {
    const col = this.col, nb = NB[p];
    for (let j = 0; j < nb.length; j++) if (col[nb[j]] !== c) return false;
    const dg = DG[p], o = 3 - c;
    let bad = 0;
    for (let j = 0; j < dg.length; j++) if (col[dg[j]] === o) bad++;
    return dg.length < 4 ? bad === 0 : bad < 2;
  };
  FB.prototype.merge = function (a, b) {
    if (this.size[a] < this.size[b]) { const t = a; a = b; b = t; }
    let s = b;
    do { this.rep[s] = a; s = this.nxt[s]; } while (s !== b);
    const t = this.nxt[a]; this.nxt[a] = this.nxt[b]; this.nxt[b] = t;
    this.cnt[a] += this.cnt[b]; this.sum[a] += this.sum[b]; this.sum2[a] += this.sum2[b]; this.size[a] += this.size[b];
  };
  FB.prototype.remove = function (r) {
    const col = this.col, nxt = this.nxt;
    let n = 0, s = r;
    do { col[s] = 0; n++; s = nxt[s]; } while (s !== r);
    s = r;
    do {
      const nb = NB[s];
      for (let j = 0; j < nb.length; j++) {
        const q = nb[j];
        if (col[q]) { const rq = this.rep[q]; this.cnt[rq]++; this.sum[rq] += s; this.sum2[rq] += s * s; }
      }
      s = nxt[s];
    } while (s !== r);
    return n;
  };
  // 着手（合法手であること前提）。取った石の数を返す
  FB.prototype.place = function (p, c) {
    const col = this.col, rep = this.rep, o = 3 - c, nb = NB[p];
    col[p] = c; rep[p] = p; this.nxt[p] = p; this.size[p] = 1;
    this.cnt[p] = 0; this.sum[p] = 0; this.sum2[p] = 0;
    for (let j = 0; j < nb.length; j++) {
      const q = nb[j];
      if (col[q] === 0) { this.cnt[p]++; this.sum[p] += q; this.sum2[p] += q * q; }
      else { const r = rep[q]; this.cnt[r]--; this.sum[r] -= p; this.sum2[r] -= p * p; }
    }
    for (let j = 0; j < nb.length; j++) {
      const q = nb[j];
      if (col[q] === c && rep[q] !== rep[p]) this.merge(rep[p], rep[q]);
    }
    let cap = 0, capPos = -1;
    for (let j = 0; j < nb.length; j++) {
      const q = nb[j];
      if (col[q] === o && this.cnt[rep[q]] === 0) { capPos = q; cap += this.remove(rep[q]); }
    }
    const rp = rep[p];
    this.ko = (cap === 1 && this.size[rp] === 1 && this.inAtari(rp)) ? capPos : -1;
    return cap;
  };
  // 2子以上の自分の連をアタリにする手か（相手を取る手は除く）
  FB.prototype.selfAtari = function (p, c) {
    const col = this.col, nb = NB[p], o = 3 - c;
    let lib = -1, two = false;
    const add = q => { if (q === p || two) return; if (lib === -1) lib = q; else if (lib !== q) two = true; };
    for (let j = 0; j < nb.length; j++) if (col[nb[j]] === 0) add(nb[j]);
    if (two) return false;
    for (let j = 0; j < nb.length; j++) { const q = nb[j]; if (col[q] === o && this.inAtari(this.rep[q])) return false; }
    let sz = 1;
    for (let j = 0; j < nb.length; j++) {
      const q = nb[j];
      if (col[q] !== c) continue;
      const r = this.rep[q];
      sz += this.size[r];
      if (this.inAtari(r)) add(this.lib1(r));
      else {
        let s = r;
        do {
          const nb2 = NB[s];
          for (let k = 0; k < nb2.length; k++) if (col[nb2[k]] === 0) add(nb2[k]);
          s = this.nxt[s];
        } while (s !== r && !two);
      }
      if (two) return false;
    }
    return sz > 1;
  };
  FB.prototype.ownerOf = function (p) {
    const col = this.col, v = col[p];
    if (v) return v;
    const nb = NB[p];
    let c = 0;
    for (let j = 0; j < nb.length; j++) {
      const w = col[nb[j]];
      if (w === 0) return 0;
      if (c === 0) c = w; else if (c !== w) return 0;
    }
    return c;
  };
  FB.prototype.score = function () { // 黒 - 白（コミ抜き）
    let s = 0;
    for (let p = 0; p < NN; p++) { const o = this.ownerOf(p); if (o === 1) s++; else if (o === 2) s--; }
    return s;
  };
  FB.prototype.stones = function () { let n = 0; for (let p = 0; p < NN; p++) if (this.col[p]) n++; return n; };

  // 直前の手への戦術応答：取れる石を取る／アタリの石を逃げる
  function tactic(f, c, last) {
    const col = f.col, o = 3 - c;
    if (col[last] === o) {
      const r = f.rep[last];
      if (f.inAtari(r)) return f.lib1(r);
    }
    const nb = NB[last];
    for (let j = 0; j < nb.length; j++) {
      const q = nb[j];
      if (col[q] !== c) continue;
      const r = f.rep[q];
      if (!f.inAtari(r)) continue;
      const esc = f.lib1(r);
      // 相手の石を取って助かるなら取る
      let s = r;
      do {
        const nb2 = NB[s];
        for (let k = 0; k < nb2.length; k++) {
          const t = nb2[k];
          if (col[t] === o && f.inAtari(f.rep[t])) return f.lib1(f.rep[t]);
        }
        s = f.nxt[s];
      } while (s !== r);
      if (f.legal(esc, c) && !f.selfAtari(esc, c)) return esc;
    }
    return -1;
  }

  const empt = new Int32Array(NN);
  const near = [];
  function tryMove(f, p, c) {
    if (!f.legal(p, c) || f.isEye(p, c)) return false;
    if (f.selfAtari(p, c) && Math.random() < 0.9) return false;
    f.place(p, c);
    return true;
  }
  function playout(f, c, maxMoves, amaf, last) {
    let passes = 0;
    for (let m = 0; m < maxMoves && passes < 2; m++) {
      let mv = -1;
      if (last >= 0) {
        const t = tactic(f, c, last);
        if (t >= 0 && tryMove(f, t, c)) mv = t;
        if (mv < 0 && Math.random() < 0.5) {
          near.length = 0;
          const nb = NB[last], dg = DG[last];
          for (let j = 0; j < nb.length; j++) if (f.col[nb[j]] === 0) near.push(nb[j]);
          for (let j = 0; j < dg.length; j++) if (f.col[dg[j]] === 0) near.push(dg[j]);
          while (near.length) {
            const i = (Math.random() * near.length) | 0, p = near[i];
            near[i] = near[near.length - 1]; near.pop();
            if (tryMove(f, p, c)) { mv = p; break; }
          }
        }
      }
      if (mv < 0) {
        let n = 0;
        for (let p = 0; p < NN; p++) if (f.col[p] === 0) empt[n++] = p;
        while (n > 0) {
          const i = (Math.random() * n) | 0, p = empt[i];
          empt[i] = empt[--n];
          if (tryMove(f, p, c)) { mv = p; break; }
        }
      }
      if (mv < 0) { passes++; f.ko = -1; last = -1; }
      else { passes = 0; last = mv; if (amaf && amaf[mv] === 0) amaf[mv] = c; }
      c = 3 - c;
    }
  }

  function mk(move, color) { return { move, color, N: 0, W: 0, aN: 0, aW: 0, children: null }; }

  // 候補手を作り、簡単な事前知識（RAVEの仮想的な勝ち数）を入れる
  function expand(f, c, last) {
    const stones = f.stones();
    const tac = last >= 0 ? tactic(f, c, last) : -1;
    const res = [];
    for (let m = 0; m < NN; m++) {
      if (!f.legal(m, c) || f.isEye(m, c)) continue;
      const ch = mk(m, c);
      const x = m % N, y = (m / N) | 0;
      const edge = x === 0 || y === 0 || x === N - 1 || y === N - 1;
      let pn = 10, pw = 5;
      if (m === tac) { pn = 30; pw = 26; }
      else if (f.selfAtari(m, c)) { pn = 30; pw = 3; }
      else if (edge) {
        let alone = true;
        for (const q of NB[m]) if (f.col[q]) alone = false;
        for (const q of DG[m]) if (f.col[q]) alone = false;
        if (alone) { pn = 20; pw = stones < 30 ? 2 : 6; }
      } else if (stones < 4) {
        const lx = Math.min(x, N - 1 - x), ly = Math.min(y, N - 1 - y);
        if (lx >= 2 && ly >= 2) { pn = 20; pw = 13; }
      }
      ch.aN = pn; ch.aW = pw;
      res.push(ch);
    }
    return res;
  }

  function select(node) {
    let best = null, bv = -1;
    const lnN = Math.log(node.N + 1);
    const ch = node.children;
    for (let i = 0; i < ch.length; i++) {
      const c = ch[i];
      const q = c.N > 0 ? c.W / c.N : 0.5;
      const aq = c.aW / c.aN;
      const beta = c.aN / (c.aN + c.N + c.aN * c.N / 2000);
      const v = (1 - beta) * q + beta * aq + 0.2 * Math.sqrt(lnN / (c.N + 1));
      if (v > bv) { bv = v; best = c; }
    }
    return best;
  }

  /* 探索木。相手の手番中に先読みし、実際に打たれた手の枝を引き継げる */
  function Tree(rootF, c0, komi, last0) {
    this.rootF = new FB(); this.rootF.copyFrom(rootF);
    this.c0 = c0; this.komi = komi; this.last0 = last0;
    this.root = mk(-1, 3 - c0);
    this.root.children = expand(this.rootF, c0, last0);
    this.own = new Float32Array(NN); this.n = 0;
  }
  const amafBuf = new Int8Array(NN), work = new FB();
  Tree.prototype.run = function (maxPlayouts, deadline) {
    const root = this.root, rootF = this.rootF, komi = this.komi, own = this.own, amaf = amafBuf, f = work;
    if (!root.children.length) return;
    while (root.N < maxPlayouts && ((this.n & 31) || Date.now() < deadline)) {
      f.copyFrom(rootF);
      let c = this.c0, node = root, lastMv = this.last0;
      const path = [root];
      amaf.fill(0);
      while (true) {
        if (!node.children) node.children = expand(f, c, lastMv);
        if (!node.children.length) break;
        const ch = select(node);
        if (!f.legal(ch.move, c)) break;
        f.place(ch.move, c);
        lastMv = ch.move;
        if (amaf[ch.move] === 0) amaf[ch.move] = c;
        c = 3 - c;
        node = ch; path.push(ch);
        if (ch.N < 3) break;
      }
      playout(f, c, NN * 2, amaf, lastMv);
      const sc = f.score() - komi;
      const winner = sc > 0 ? 1 : sc < 0 ? 2 : 0; // 0 = 持碁
      for (let p = 0; p < NN; p++) { const o = f.ownerOf(p); if (o === 1) own[p]++; else if (o === 2) own[p]--; }
      for (let i = 0; i < path.length; i++) {
        const nd = path[i];
        nd.N++;
        if (nd.color === winner) nd.W++; else if (winner === 0) nd.W += 0.5;
        const chs = nd.children;
        if (chs) for (let k = 0; k < chs.length; k++) {
          const ch = chs[k];
          if (amaf[ch.move] === ch.color) { ch.aN++; if (ch.color === winner) ch.aW++; else if (winner === 0) ch.aW += 0.5; }
        }
      }
      this.n++;
    }
  };
  // 手 move を打った後の局面の木を返す（読みを引き継ぐ）。一致しなければ null
  Tree.prototype.descend = function (move, board, ko) {
    if (move < 0 || !this.root.children) return null;
    const ch = this.root.children.find(x => x.move === move);
    if (!ch) return null;
    const f = new FB(); f.copyFrom(this.rootF);
    if (!f.legal(move, this.c0)) return null;
    f.place(move, this.c0);
    for (let p = 0; p < NN; p++) if (f.col[p] !== board[p]) return null;
    if (f.ko !== ko) return null;
    const t = Object.create(Tree.prototype);
    t.rootF = f; t.c0 = 3 - this.c0; t.komi = this.komi; t.last0 = move;
    t.root = ch;
    if (!ch.children) ch.children = expand(f, t.c0, move);
    t.own = new Float32Array(NN); t.n = 0;
    return t;
  };
  Tree.prototype.matches = function (board, toPlay, ko) {
    if (toPlay !== this.c0 || this.rootF.ko !== ko) return false;
    for (let p = 0; p < NN; p++) if (this.rootF.col[p] !== board[p]) return false;
    return true;
  };

  // 前の木から引き継げるならそれを使い、だめなら新しく作る
  let tree = null;
  function treeFor(board, toPlay, ko, komi, last) {
    if (tree && tree.komi === komi) {
      if (tree.matches(board, toPlay, ko)) return tree;
      const t = tree.descend(last, board, ko);
      if (t) return t;
    }
    return new Tree(FB.fromArray(board, ko), toPlay, komi, last);
  }

  function search(rootF, c0, playouts, ms, komi, last0) {
    const t = new Tree(rootF, c0, komi, last0);
    t.run(playouts, Date.now() + ms);
    return { root: t.root, own: t.own, n: t.n };
  }

  // 終局間際に打つ価値のある手だけを集める
  //  saves: 自分のアタリの石をつなぐ手（コウを含む）
  //  kos:   相手の1子をコウで取る手（コウの解消）
  //  dames: 黒白の境目の空点（ダメ）
  // 自陣にある相手の死に石を抜く手や、必要のないツナギは含めない
  function endgameMoves(f, c) {
    const o = 3 - c, saves = [], kos = [], dames = [];
    const seen = new Set();
    for (let p = 0; p < NN; p++) {
      const v = f.col[p];
      if (!v) continue;
      const r = f.rep[p];
      if (seen.has(r) || !f.inAtari(r)) continue;
      seen.add(r);
      const l = f.lib1(r);
      if (v === c) {
        if (f.legal(l, c) && !f.selfAtari(l, c)) saves.push(l);
      } else if (f.size[r] === 1 && f.legal(l, c)) {
        const t = new FB(); t.copyFrom(f); t.place(l, c);
        if (t.ko >= 0) kos.push(l);
      }
    }
    for (let p = 0; p < NN; p++) {
      if (f.col[p] !== 0) continue;
      let b = false, w = false;
      for (const q of NB[p]) { if (f.col[q] === 1) b = true; else if (f.col[q] === 2) w = true; }
      if (b && w && f.legal(p, c) && !f.selfAtari(p, c) && !f.isEye(p, c)) dames.push(p);
    }
    return { saves, kos, dames };
  }

  // 段級 level（0 = 10級 … 9 = 1級）ごとの読みの量。
  // 強さは「読む回数」で決める（時間では決めない）。相手の手番中に先読みした分もふくめて数えるので、
  // スマホの速さや、相手がどれだけ考えたかで強さが変わりにくい。時間は、遅い機種での上限としてだけ使う
  const MAX_MS = 6000;
  function budget(level, timeLeft) {
    const playouts = Math.round(3000 * Math.pow(1.3, level));       // 10級 3000 … 5級 約11000 … 1級 約32000
    const ms = Math.max(250, Math.min(MAX_MS, timeLeft / 14));
    return { playouts, ms };
  }

  // botの着手
  function think(d) {
    const L = Math.max(0, Math.min(9, d.level)), S = L + 5, c = d.toPlay;
    const last = d.last === undefined ? -1 : d.last;
    const { playouts, ms } = budget(L, d.timeLeft);
    const t = treeFor(d.board, c, d.ko, d.komi, last);
    const reused = t.root.N;
    t.run(Math.max(playouts, reused + Math.round(playouts * 0.2)), Date.now() + ms);   // 先読みの分もふくめて playouts 回（最低2割は新しく読む）
    tree = t;
    const f = t.rootF, root = t.root, own = t.own, n = t.n;
    const eg = endgameMoves(f, c);
    const must = eg.saves.length + eg.kos.length + eg.dames.length > 0;
    if (!root.children.length || !root.N) return { move: -1 };
    let est = 0, settled = true;
    for (let p = 0; p < NN; p++) {
      const v = n ? own[p] / n : 0;
      est += v;
      if (d.board[p] === 0 && Math.abs(v) < 0.85) settled = false;
    }
    est -= d.komi;
    const margin = c === 1 ? est : -est; // botから見た推定の差（目）
    const ahead = margin >= 0;
    const sorted = root.children.slice().sort((a, z) => z.N - a.N);
    const best = sorted[0];
    const wr = best.N ? best.W / best.N : 0.5;
    const out = { winrate: wr, margin, playouts: n, reused };
    // 投了：はっきり負けている（勝率8%未満、または15目以上の差で勝率25%未満）
    if (!d.noResign && d.moveNum >= N * 2 - 2 && root.N >= 150 && (wr < 0.08 || (margin < -15 && wr < 0.25))) return Object.assign(out, { resign: true });
    if (!d.noResign && d.oppPassed && !ahead && wr < 0.3) return Object.assign(out, { resign: true });
    // 相手がパスした後：形勢がはっきりしていれば、ツナギ・コウ・ダメだけを打ち、残りはパス
    if (d.oppPassed && (ahead || settled)) {
      const pick = list => list.slice().sort((a, z) => {
        const na = (root.children.find(x => x.move === a) || { N: 0 }).N, nz = (root.children.find(x => x.move === z) || { N: 0 }).N;
        return nz - na;
      })[0];
      if (eg.saves.length) return Object.assign(out, { move: pick(eg.saves) });
      if (eg.kos.length) return Object.assign(out, { move: pick(eg.kos) });
      if (eg.dames.length) return Object.assign(out, { move: pick(eg.dames) });
      return Object.assign(out, { move: -1 });
    }
    // 自分からパスするのは、ツナギ・コウ・ダメが残っていないときだけ
    if (!must && d.moveNum >= NN * 0.37 && settled && ahead) return Object.assign(out, { move: -1 });
    // 弱くするしかけ：でたらめな手は打たない。「最善より少しだけ勝率の低い手」を、ちゃんと読んだ候補の中から選ぶ
    //   loss … 最善からどこまで勝率が下がってよいか（10級 26% … 5級 約9% … 1級 1%）
    //   slip … ときどき、もう少し大きく損する手も許す確率（10級 15% … 3級 1%、2級・1級は0）
    //   弱いほど、候補を平らに選ぶ（強いほど、よく読んだ手を選ぶ）
    let choice = best;
    const loss = 0.25 * Math.pow(1 - L / 9, 1.5) + 0.01, slip = Math.max(0, 0.15 - 0.02 * L), pw = 0.5 + L / 18;
    const lim = loss * (Math.random() < slip ? 2.5 : 1);
    const minN = Math.max(20, best.N * 0.04);
    const ok = sorted.filter(ch => ch.N >= minN && ch.W / ch.N >= wr - lim);
    if (ok.length > 1 && wr > 0.03 && wr < 0.97) {
      const w = ok.map(ch => Math.pow(ch.N, pw));
      let r = Math.random() * w.reduce((a, z) => a + z, 0);
      for (let i = 0; i < ok.length; i++) { r -= w[i]; if (r <= 0) { choice = ok[i]; break; } }
    }
    return Object.assign(out, { move: choice.move });
  }

  // 相手（人）の手番中の先読み。少しずつ進め、メッセージを受け取れるようにする
  let pondering = false, ponderCap = 0;
  function ponderStart(d) {
    const last = d.last === undefined ? -1 : d.last;
    tree = treeFor(d.board, d.toPlay, d.ko, d.komi, last);
    ponderCap = budget(Math.max(0, Math.min(9, d.level)), 1e9).playouts;   // 先読みも、その級の読みの量まで
    if (!pondering) { pondering = true; setTimeout(ponderStep, 0); }
  }
  function ponderStep() {
    if (!pondering || !tree) { pondering = false; return; }
    tree.run(ponderCap, Date.now() + 30);
    if (tree.root.N >= ponderCap || !tree.root.children.length) { pondering = false; return; }
    setTimeout(ponderStep, 0);
  }
  function ponderStop() { pondering = false; }

  // 検討用：一番強い設定で読んだ候補手（上位3つ）
  function analyze(d) {
    const f = FB.fromArray(d.board, d.ko);
    const { root, n } = search(f, d.toPlay, 400000, Math.min(d.ms || 4500, 4500), d.komi, d.last === undefined ? -1 : d.last);
    if (!n) return { cands: [], playouts: 0 };
    const sorted = root.children.slice().sort((a, z) => z.N - a.N).slice(0, 3);
    return { cands: sorted.map(ch => ({ move: ch.move, wr: ch.N ? ch.W / ch.N : 0.5, visits: ch.N })), playouts: n };
  }

  // 終局時の死活判定用：各点の所有率（+1 黒 / -1 白）
  function ownership(board, n) {
    const own = new Float32Array(NN);
    const base = FB.fromArray(board, -1), f = new FB();
    for (let i = 0; i < n; i++) {
      f.copyFrom(base);
      playout(f, (i & 1) + 1, NN * 2 + 40, null, -1);
      for (let p = 0; p < NN; p++) { const o = f.ownerOf(p); if (o === 1) own[p]++; else if (o === 2) own[p]--; }
    }
    return Array.from(own, v => v / n);
  }

  return { N, NN, NB, DG, group, play, think, analyze, ownership, FB, ponderStart, ponderStop, budget, resetTree: () => { tree = null; pondering = false; }, endgame: (board, c) => endgameMoves(FB.fromArray(board, -1), c) };
  }
  const E9 = make(9), E13 = make(13);
  root.GoEngine = E9;
  root.GoEngines = { 9: E9, 13: E13 };

  /* =========================================================
   * 囲碁AI（ニューラルネット、ai/nn.js・ai/kata.js）。9路だけ。読みこめていなければ、上のモンテカルロ探索を使う
   * ========================================================= */
  // 1級までは上のモンテカルロ探索（強さを細かく調整してある）。初段から上はAIで打つ
  //   v … 読む局面の数（1 = 直感だけ）、T … 直感の手をどれくらい散らすか、loss … 最善からどれだけ勝率が下がる手まで選ぶか
  //   bot同士の対局で、AIの直感だけ（初段）でも、モンテカルロの1級に勝ち越すことを確かめてある
  const NNLV = { 10: { v: 1, T: 1.0 }, 11: { v: 1, T: 0.4 }, 12: { v: 16, loss: 0 }, 13: { v: 48, loss: 0 } };
  const NN_FROM = 10;   // 初段から上はAIで打つ
  const nnOn = d => (d.size || 9) === 9 && root.KataAI && root.KataAI.ready() && d.level >= NN_FROM;
  function nnThink(d) {
    const K = root.KataAI, L = Math.max(NN_FROM, Math.min(13, d.level)), cfg = NNLV[L], c = d.toPlay;
    const st = K.stateFrom(d.board, c, d.ko, d.rec);
    const ms = Math.max(300, Math.min(4500, (d.timeLeft || 3e5) / 14));
    const rt = K.search(st, d.komi, cfg.v, ms);
    const kids = rt.kids.filter(k => k.n).sort((a, z) => z.n - a.n);
    const best = kids[0] || rt.kids[0];
    if (!best) return { move: -1 };
    const wr = cfg.v > 1 && best.n ? best.w / best.n : rt.v, margin = rt.lead;
    let settled = true;
    for (let p = 0; p < 81; p++) if (d.board[p] === 0 && Math.abs(rt.own[p]) < 0.8) settled = false;
    const ahead = margin >= 0;
    const out = { winrate: wr, margin, playouts: rt.n, nn: true };
    // 投了：はっきり負けている
    if (!d.noResign && d.moveNum >= 16 && (wr < 0.04 || (margin < -15 && wr < 0.15))) return Object.assign(out, { resign: true });
    if (!d.noResign && d.oppPassed && !ahead && wr < 0.25) return Object.assign(out, { resign: true });
    const eg = E9.endgame(d.board, c), must = eg.saves.length + eg.kos.length + eg.dames.length > 0;
    const prior = m => (rt.kids.find(k => k.mv === m) || { prior: 0 }).prior;
    const pick = list => list.slice().sort((a, z) => prior(z) - prior(a))[0];
    if (d.oppPassed && (ahead || settled)) {
      if (eg.saves.length) return Object.assign(out, { move: pick(eg.saves) });
      if (eg.kos.length) return Object.assign(out, { move: pick(eg.kos) });
      if (eg.dames.length) return Object.assign(out, { move: pick(eg.dames) });
      return Object.assign(out, { move: -1 });
    }
    if (!must && d.moveNum >= 30 && settled && ahead) return Object.assign(out, { move: -1 });
    // 手をえらぶ（パスはえらばない）
    const moves = rt.kids.filter(k => k.mv >= 0);
    if (!moves.length) return Object.assign(out, { move: -1 });
    let choice = moves[0];
    if (cfg.v <= 1) {
      // 直感の手を、温度 T で散らしてえらぶ（ありえない手は出ないように、上位の手だけ）
      const top = moves.filter(k => k.prior >= moves[0].prior * 0.02).slice(0, 12);
      const w = top.map(k => Math.pow(k.prior, 1 / cfg.T));
      let r = Math.random() * w.reduce((a, z) => a + z, 0);
      for (let i = 0; i < top.length; i++) { r -= w[i]; if (r <= 0) { choice = top[i]; break; } }
    } else {
      const vis = kids.filter(k => k.mv >= 0);
      choice = vis[0] || moves[0];
      if (cfg.loss > 0 && vis.length > 1 && wr > 0.03 && wr < 0.97) {
        const minN = Math.max(2, vis[0].n * 0.1), bq = vis[0].w / vis[0].n;
        const ok = vis.filter(k => k.n >= minN && k.w / k.n >= bq - cfg.loss);
        let r = Math.random() * ok.reduce((a, k) => a + k.n, 0);
        for (const k of ok) { r -= k.n; if (r <= 0) { choice = k; break; } }
      }
    }
    return Object.assign(out, { move: choice.mv });
  }
  // 相手の手番中の先読み（AI）
  let nnP = null;
  function nnPonderStart(d) {
    const K = root.KataAI, L = Math.max(NN_FROM, Math.min(13, d.level));
    if (NNLV[L].v <= 1) return;
    nnP = { st: K.stateFrom(d.board, d.toPlay, d.ko, d.rec), komi: d.komi, cap: NNLV[L].v * 2 };
    setTimeout(nnPonderStep, 0);
  }
  function nnPonderStep() {
    if (!nnP) return;
    if (root.KataAI.stepPonder(nnP.st, nnP.komi, nnP.cap, 40)) { nnP = null; return; }
    setTimeout(nnPonderStep, 0);
  }
  // 検討：いちばん強い設定（いちばん強いBotより多く読む）で、AIの候補手（上位3つ）
  function nnAnalyze(d) {
    const K = root.KataAI, st = K.stateFrom(d.board, d.toPlay, d.ko, d.rec);
    K.reset();
    const rt = K.search(st, d.komi, 800, Math.min(d.ms || 5000, 5000));
    const sorted = rt.kids.filter(k => k.n).sort((a, z) => z.n - a.n).slice(0, 3);
    return { cands: sorted.map(k => ({ move: k.mv, wr: k.w / k.n, visits: k.n })), playouts: rt.n, nn: true };
  }
  // 整地：死に石の判定（AIの「どちらの地になりそうか」を、黒番・白番の両方から見て平均）
  function nnOwnership(board) {
    const K = root.KataAI, own = new Array(81).fill(0);
    for (const c of [1, 2]) { const e = K.evaluate({ b: board, ko: -1, pla: c, hist: [], prev: [board, board], passes: 0 }, 7); for (let p = 0; p < 81; p++) own[p] += (c === 1 ? e.own[p] : -e.own[p]) / 2; }
    return own;
  }
  // 重みの読みこみ（ワーカーの中で、はじめに1回）
  function nnLoad() {
    if (typeof importScripts !== 'function' || typeof fetch !== 'function') return;
    try { importScripts('ai/nn.js', 'ai/kata.js'); } catch (e) { return; }
    Promise.all([fetch('ai/b6c96.json').then(r => r.json()), fetch('ai/b6c96.bin').then(r => r.arrayBuffer())])
      .then(([meta, buf]) => { root.KataAI.init(meta, new Uint16Array(buf), E9); })
      .catch(() => {});
  }
  root.GoNN = { think: nnThink, analyze: nnAnalyze, ownership: nnOwnership, on: nnOn, NNLV };

  if (typeof window === 'undefined' && typeof self !== 'undefined' && typeof importScripts === 'function') {
    nnLoad();
    self.onmessage = e => {
      const d = e.data;
      const { think, ponderStart, ponderStop, analyze, ownership } = d.size === 13 ? E13 : E9;
      const nn = nnOn(d);
      if (d.type === 'stop') { nnP = null; E9.ponderStop(); E13.ponderStop(); E9.resetTree(); E13.resetTree(); if (root.KataAI && root.KataAI.ready()) root.KataAI.reset(); return; }
      if (d.type === 'think') { ponderStop(); nnP = null; self.postMessage(Object.assign({ id: d.id }, nn ? nnThink(d) : think(d))); }
      else if (d.type === 'ponder') { if (nn) nnPonderStart(d); else ponderStart(d); }
      else if (d.type === 'analyze') { ponderStop(); nnP = null; self.postMessage(Object.assign({ id: d.id }, (d.size || 9) === 9 && root.KataAI && root.KataAI.ready() ? nnAnalyze(d) : analyze(d))); }
      else if (d.type === 'score') { ponderStop(); nnP = null; self.postMessage({ id: d.id, own: (d.size || 9) === 9 && root.KataAI && root.KataAI.ready() ? nnOwnership(d.board) : ownership(d.board, d.n || 800) }); }
    };
  }
})(typeof self !== 'undefined' ? self : this);
