/* 囲碁BLITZ — ニューラルネットを使った読み（PUCT 探索）。ai/nn.js と engine.js（GoEngine）を使う。9路のみ。
 * 入力の特徴は KataGo の版7入力（22面＋19個）にそろえる。地の特徴（パスしても生きている石）は省略。 */
(function (root) {
  'use strict';
  const N = 9, P = 81, NF = 22, NG = 19;
  let E = null;   // GoEngine（9路）
  const NB = [];
  for (let p = 0; p < P; p++) { const x = p % N, y = (p / N) | 0, a = []; if (x > 0) a.push(p - 1); if (x < N - 1) a.push(p + 1); if (y > 0) a.push(p - N); if (y < N - 1) a.push(p + N); NB.push(a); }

  /* ---------- 連と呼吸点 ---------- */
  function groups(b) {   // 各点の連番号と、連ごとの呼吸点の数
    const gid = new Int16Array(P).fill(-1), libs = [];
    const mark = new Int16Array(P).fill(-1);
    let g = 0;
    for (let p = 0; p < P; p++) {
      if (!b[p] || gid[p] >= 0) continue;
      const c = b[p], st = [p]; gid[p] = g; let n = 0;
      for (let i = 0; i < st.length; i++) for (const q of NB[st[i]]) {
        if (b[q] === c && gid[q] < 0) { gid[q] = g; st.push(q); }
        else if (!b[q] && mark[q] !== g) { mark[q] = g; n++; }
      }
      libs.push(n); g++;
    }
    return { gid, libs };
  }
  function libsOf(b, p) { return E.group(b, p).libs; }

  /* ---------- シチョウ（KataGo と同じ考え方の簡易版） ---------- */
  // 守る側が先（呼吸点1）：逃げても取られるなら true
  function ladderCaptured(b, ko, loc, defFirst, budget) {
    const pla = b[loc], opp = 3 - pla;
    function rec(b, ko, defTurn, depth) {
      if (budget.n++ > 3000) return false;
      if (depth > 60) return true;
      const libs = libsOf(b, loc);
      if (!defTurn) {
        if (libs.length <= 1) return true;
        if (libs.length >= 3) return false;
        for (const m of libs) {
          const r = E.play(b, m, opp, ko); if (!r) continue;
          if (!r.board[loc]) return true;
          if (rec(r.board, r.ko, true, depth + 1)) return true;
        }
        return false;
      }
      if (libs.length >= 2) return false;
      if (ko >= 0 && depth > 0) return false;   // コウがからむシチョウは、取れないことにする
      // 守り：まわりの相手の石でアタリのものを取る手、または呼吸点に伸びる手
      const moves = [];
      const st = E.group(b, loc).stones, seen = new Set();
      for (const s of st) for (const q of NB[s]) if (b[q] === opp && !seen.has(q)) {
        const g = E.group(b, q); for (const x of g.stones) seen.add(x);
        if (g.libs.length === 1) moves.push(g.libs[0]);
      }
      moves.push(libs[0]);
      for (const m of moves) {
        const r = E.play(b, m, pla, depth === 0 ? -1 : ko); if (!r) continue;
        const nl = libsOf(r.board, loc).length;
        if (nl >= 3) return false;
        if (nl === 2 && !rec(r.board, r.ko, false, depth + 1)) return false;
      }
      return true;
    }
    return rec(b, ko, defFirst, 0);
  }
  // 呼吸点2の連：攻める側が先に打ってシチョウになる手（あれば）
  function ladderWorking2(b, ko, loc, budget) {
    const opp = 3 - b[loc], res = [];
    for (const m of libsOf(b, loc)) {
      const r = E.play(b, m, opp, ko); if (!r) continue;
      if (!r.board[loc] || ladderCaptured(r.board, r.ko, loc, true, budget)) res.push(m);
    }
    return res;
  }
  // 盤のシチョウ情報：laddered[p]=1（取られる石）、working[]（相手の石をシチョウで取れる手）
  function ladders(b, ko, pla, laddered, working) {
    const { gid, libs } = groups(b), done = new Map(), budget = { n: 0 };
    for (let p = 0; p < P; p++) {
      if (!b[p]) continue;
      const l = libs[gid[p]]; if (l !== 1 && l !== 2) continue;
      let v = done.get(gid[p]);
      if (v === undefined) {
        let w = [];
        if (l === 1) v = ladderCaptured(b, -1, p, true, budget);
        else { w = ladderWorking2(b, ko, p, budget); v = w.length > 0; }
        done.set(gid[p], v);
        if (v && working && b[p] !== pla && l === 2) for (const m of w) working[m] = 1;
      }
      if (v) laddered[p] = 1;
    }
  }

  /* ---------- 入力の特徴 ---------- */
  // st: { b, ko, pla, hist: [最近の手…]（-1 = パス）, prev: [1手前の盤, 2手前の盤] }
  function features(st, komi, sym) {
    const bin = new Float32Array(P * NF), glob = new Float32Array(NG);
    const b = st.b, pla = st.pla, opp = 3 - pla, T = SYM[sym];
    const { gid, libs } = groups(b);
    for (let p = 0; p < P; p++) {
      const o = T[p] * NF;
      bin[o] = 1;
      if (!b[p]) continue;
      bin[o + (b[p] === pla ? 1 : 2)] = 1;
      const l = libs[gid[p]]; if (l >= 1 && l <= 3) bin[o + 2 + l] = 1;
    }
    if (st.ko >= 0) bin[T[st.ko] * NF + 6] = 1;
    const h = st.hist || [];
    for (let i = 0; i < 5 && i < h.length; i++) {
      const m = h[h.length - 1 - i];
      if (m < 0) glob[i] = 1; else bin[T[m] * NF + 9 + i] = 1;
    }
    const lad = new Uint8Array(P), work = new Uint8Array(P);
    ladders(b, st.ko, pla, lad, work);
    for (let p = 0; p < P; p++) { if (lad[p]) bin[T[p] * NF + 14] = 1; if (work[p]) bin[T[p] * NF + 17] = 1; }
    const pb = st.prev || [];
    for (let k = 0; k < 2; k++) {
      const bb = pb[k] || (k === 1 && pb[0]) || b, l2 = new Uint8Array(P);
      ladders(bb, -1, pla, l2, null);
      for (let p = 0; p < P; p++) if (l2[p]) bin[T[p] * NF + 15 + k] = 1;
    }
    const selfKomi = pla === 2 ? komi : -komi;
    glob[5] = selfKomi / 20;
    glob[14] = h.length && h[h.length - 1] < 0 ? 1 : 0;    // 相手がパスした直後：パスすると終局
    // コミの偶奇（9路は面積が奇数）
    const floor = Math.floor((selfKomi - 1) / 2) * 2 + 1;
    let d = Math.max(0, Math.min(2, selfKomi - floor));
    glob[18] = d < 0.5 ? d : d < 1.5 ? 1 - d : d - 2;
    return { bin, glob };
  }
  // 8通りの向き（回転・裏返し）
  const SYM = [];
  for (let s = 0; s < 8; s++) {
    const t = new Int16Array(P);
    for (let p = 0; p < P; p++) { let x = p % N, y = (p / N) | 0; if (s & 1) x = N - 1 - x; if (s & 2) y = N - 1 - y; if (s & 4) { const z = x; x = y; y = z; } t[p] = y * N + x; }
    SYM.push(t);
  }

  /* ---------- 評価 ---------- */
  let net = null;
  function evaluate(st, komi) {
    const sym = (Math.random() * 8) | 0, T = SYM[sym];
    const f = features(st, komi, sym);
    const o = net.forward(f.bin, f.glob);
    const pol = new Float32Array(P + 1), own = new Float32Array(P);
    for (let p = 0; p < P; p++) { pol[p] = o.policy[T[p]]; own[p] = o.own[T[p]]; }
    pol[P] = o.policy[P];
    const mx = Math.max(o.value[0], o.value[1], o.value[2]);
    const w = Math.exp(o.value[0] - mx), l = Math.exp(o.value[1] - mx), n = Math.exp(o.value[2] - mx), s = w + l + n;
    return { pol, v: (w + 0.5 * n) / s, lead: o.score[2] * 20, own };   // v・lead・own は手番の人から見た値
  }

  /* ---------- 探索 ---------- */
  function areaScore(b) {   // 黒 - 白（石＋囲んだ地。コミ抜き）
    let s = 0; const seen = new Uint8Array(P);
    for (let p = 0; p < P; p++) {
      if (b[p] === 1) { s++; continue; } if (b[p] === 2) { s--; continue; }
      if (seen[p]) continue;
      const reg = [p]; seen[p] = 1; let tb = false, tw = false;
      for (let i = 0; i < reg.length; i++) for (const q of NB[reg[i]]) { if (b[q] === 1) tb = true; else if (b[q] === 2) tw = true; else if (!seen[q]) { seen[q] = 1; reg.push(q); } }
      if (tb && !tw) s += reg.length; else if (tw && !tb) s -= reg.length;
    }
    return s;
  }
  function Node(mv, prior) { this.mv = mv; this.prior = prior; this.n = 0; this.w = 0; this.kids = null; this.v = 0.5; this.own = null; this.lead = 0; }
  function child(st, mv) {
    if (mv < 0) return { b: st.b, ko: -1, pla: 3 - st.pla, hist: st.hist.concat(-1).slice(-6), prev: [st.b, st.prev[0]], passes: (st.passes || 0) + 1 };
    const r = E.play(st.b, mv, st.pla, st.ko); if (!r) return null;
    return { b: r.board, ko: r.ko, pla: 3 - st.pla, hist: st.hist.concat(mv).slice(-6), prev: [st.b, st.prev[0]], passes: 0 };
  }
  function expand(node, st, komi) {
    const e = evaluate(st, komi);
    node.v = e.v; node.own = e.own; node.lead = e.lead;
    const kids = []; let mx = -1e9;
    for (let p = 0; p <= P; p++) {
      if (p < P && (st.b[p] || p === st.ko || !E.play(st.b, p, st.pla, st.ko))) continue;
      if (e.pol[p] > mx) mx = e.pol[p];
      kids.push(p);
    }
    let sum = 0; const pr = kids.map(p => { const v = Math.exp(e.pol[p] - mx); sum += v; return v; });
    node.kids = kids.map((p, i) => new Node(p === P ? -1 : p, pr[i] / sum)).sort((a, z) => z.prior - a.prior);
    return e.v;
  }
  const CPUCT = 1.1, FPU = 0.2;
  function select(node) {
    const sq = Math.sqrt(node.n + 0.01);
    const parentQ = node.n ? 1 - node.w / node.n : 0.5;   // 手番の人から見た今の評価
    let visitedP = 0; for (const k of node.kids) if (k.n) visitedP += k.prior;
    const fpu = parentQ - FPU * Math.sqrt(visitedP);
    let best = null, bv = -1e9;
    for (const k of node.kids) {
      const q = k.n ? k.w / k.n : fpu;
      const s = q + CPUCT * k.prior * sq / (1 + k.n);
      if (s > bv) { bv = s; best = k; }
    }
    return best;
  }
  function playout(root, rst, komi) {
    const path = [root]; let node = root, st = rst, v;
    while (true) {
      if (!node.kids) { v = expand(node, st, komi); break; }
      if (st.passes >= 2) { const sc = areaScore(st.b) - komi; v = sc === 0 ? 0.5 : (sc > 0) === (st.pla === 1) ? 1 : 0; break; }
      const k = select(node); if (!k) { v = node.v; break; }
      const ns = child(st, k.mv);
      if (!ns) { node.kids.splice(node.kids.indexOf(k), 1); continue; }
      node = k; st = ns; path.push(k);
      if (st.passes >= 2) { const sc = areaScore(st.b) - komi; v = sc === 0 ? 0.5 : (sc > 0) === (st.pla === 1) ? 1 : 0; node.kids = node.kids || []; break; }
    }
    // v は最後の局面の手番の人から見た勝率。親へ向かって、見る側を入れかえながら足す
    for (let i = path.length - 1; i >= 0; i--) { const nd = path[i]; v = 1 - v; nd.n++; nd.w += v; }
  }

  /* ---------- 木の引き継ぎ ---------- */
  let tree = null;   // { root, st, komi, key }
  const keyOf = st => st.b.join('') + st.pla + ':' + st.ko;
  function rootFor(st, komi) {
    const key = keyOf(st);
    if (tree && tree.komi === komi) {
      if (tree.key === key) return tree.root;
      // 1手または2手すすんだ局面なら、その枝を使う
      const try1 = (nd, s, depth) => {
        if (!nd.kids || depth > 2) return null;
        for (const k of nd.kids) { if (!k.n) continue; const ns = child(s, k.mv); if (!ns) continue; if (keyOf(ns) === key) return k; const r = try1(k, ns, depth + 1); if (r) return r; }
        return null;
      };
      const r = try1(tree.root, tree.st, 1);
      if (r) { tree = { root: r, st, komi, key }; return r; }
    }
    const root = new Node(-1, 1);
    tree = { root, st, komi, key };
    return root;
  }
  // 探索：visits 回まで（ms をこえたら打ち切り）
  function search(st, komi, visits, ms) {
    const root = rootFor(st, komi), end = Date.now() + ms;
    if (!root.kids) { const v = expand(root, st, komi); root.n = 1; root.w = 1 - v; }
    while (root.n < visits && Date.now() < end) playout(root, st, komi);
    return root;
  }
  function stepPonder(st, komi, cap, ms) {
    const root = rootFor(st, komi), end = Date.now() + ms;
    if (!root.kids) { const v = expand(root, st, komi); root.n = 1; root.w = 1 - v; }
    while (root.n < cap && Date.now() < end) playout(root, st, komi);
    return root.n >= cap;
  }

  /* ---------- 読みこみ ---------- */
  function init(meta, u16, engine) { E = engine; net = new root.GoNet.Net(meta, u16); tree = null; }
  // 手の記録から、いまの局面（履歴つき）を作る。盤が合わなければ履歴なし
  function stateFrom(board, toPlay, ko, rec) {
    let st = { b: board.slice(), ko, pla: toPlay, hist: [], prev: [board, board], passes: 0 };
    if (Array.isArray(rec) && rec.length) {
      let b = new Array(P).fill(0), k = -1, c = 1; const boards = [b], hist = [];
      let ok = true;
      for (const m of rec) {
        if (m >= 0) { const r = E.play(b, m, c, k); if (!r) { ok = false; break; } b = r.board; k = r.ko; } else k = -1;
        boards.push(b); hist.push(m); c = 3 - c;
      }
      if (ok && b.every((v, i) => v === board[i]) && c === toPlay) {
        st.hist = hist.slice(-6);
        st.prev = [boards[boards.length - 2] || board, boards[boards.length - 3] || boards[boards.length - 2] || board];
        let n = 0; for (let i = hist.length - 1; i >= 0 && hist[i] < 0; i--) n++; st.passes = n;
      }
    }
    return st;
  }
  root.KataAI = { init, ready: () => !!net, evaluate: (st, komi) => evaluate(st, komi), search, stepPonder, stateFrom, areaScore, reset: () => { tree = null; } };
})(typeof self !== 'undefined' ? self : this);
