/* 九路 Blitz — 囲碁エンジン（ルール判定 + モンテカルロ木探索bot）
 * ブラウザ本体では <script> で読み込み、Web Worker ではそのまま実行される。 */
(function (root) {
  'use strict';
  const N = 9, NN = 81;
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

  const mark = new Int32Array(NN), lmark = new Int32Array(NN);
  let stamp = 1;
  function group(b, p) {
    stamp++;
    const c = b[p], st = [p], libs = [];
    mark[p] = stamp;
    for (let i = 0; i < st.length; i++) {
      const q = st[i], nb = NB[q];
      for (let j = 0; j < nb.length; j++) {
        const r = nb[j], v = b[r];
        if (v === 0) { if (lmark[r] !== stamp) { lmark[r] = stamp; libs.push(r); } }
        else if (v === c && mark[r] !== stamp) { mark[r] = stamp; st.push(r); }
      }
    }
    return { stones: st, libs };
  }

  // その場で着手。戻り値: -2 不正 / -1 コウなし / それ以外 コウの禁止点
  function playIP(b, p, c, ko) {
    if (p === ko || b[p] !== 0) return -2;
    const o = 3 - c;
    b[p] = c;
    let ncap = 0, last = -1;
    const nb = NB[p];
    for (let j = 0; j < nb.length; j++) {
      const r = nb[j];
      if (b[r] === o) {
        const g = group(b, r);
        if (g.libs.length === 0) {
          ncap += g.stones.length; last = g.stones[0];
          for (const s of g.stones) b[s] = 0;
        }
      }
    }
    const g = group(b, p);
    if (ncap === 0 && g.libs.length === 0) { b[p] = 0; return -2; }
    if (ncap === 1 && g.stones.length === 1 && g.libs.length === 1) return last;
    return -1;
  }

  // 盤面をコピーして着手（UI用）。不正なら null
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

  function isEye(b, p, c) {
    const nb = NB[p];
    for (let j = 0; j < nb.length; j++) if (b[nb[j]] !== c) return false;
    const dg = DG[p], o = 3 - c;
    let bad = 0;
    for (let j = 0; j < dg.length; j++) if (b[dg[j]] === o) bad++;
    if (dg.length < 4) return bad === 0;
    return bad < 2;
  }

  function ownerOf(b, p) {
    const v = b[p];
    if (v) return v;
    const nb = NB[p];
    let c = 0;
    for (let j = 0; j < nb.length; j++) {
      const w = b[nb[j]];
      if (w === 0) return 0;
      if (c === 0) c = w; else if (c !== w) return 0;
    }
    return c;
  }

  function areaScore(b) { // 黒 - 白（コミ抜き）
    let s = 0;
    for (let p = 0; p < NN; p++) { const o = ownerOf(b, p); if (o === 1) s++; else if (o === 2) s--; }
    return s;
  }

  // 直前の手への簡単な戦術応答（取る / 逃げる）
  function tactic(b, c, last) {
    const o = 3 - c;
    if (b[last] === o) {
      const g = group(b, last);
      if (g.libs.length === 1) return g.libs[0];
    }
    const nb = NB[last];
    for (let j = 0; j < nb.length; j++) {
      const r = nb[j];
      if (b[r] === c) {
        const g = group(b, r);
        if (g.libs.length === 1) return g.libs[0];
      }
    }
    return -1;
  }

  const empt = new Int32Array(NN);
  function playout(b, c, ko, maxMoves, amaf) {
    let passes = 0, last = -1;
    for (let m = 0; m < maxMoves && passes < 2; m++) {
      let mv = -1;
      if (last >= 0 && Math.random() < 0.8) {
        const t = tactic(b, c, last);
        if (t >= 0 && !isEye(b, t, c)) {
          const k = playIP(b, t, c, ko);
          if (k !== -2) { mv = t; ko = k; }
        }
      }
      if (mv < 0) {
        let n = 0;
        for (let p = 0; p < NN; p++) if (b[p] === 0) empt[n++] = p;
        while (n > 0) {
          const i = (Math.random() * n) | 0, p = empt[i];
          empt[i] = empt[--n];
          if (isEye(b, p, c)) continue;
          const k = playIP(b, p, c, ko);
          if (k !== -2) { mv = p; ko = k; break; }
        }
      }
      if (mv < 0) { passes++; ko = -1; last = -1; }
      else { passes = 0; last = mv; if (amaf && amaf[mv] === 0) amaf[mv] = c; }
      c = 3 - c;
    }
  }

  function legalMoves(b, c, ko) {
    const res = [];
    for (let p = 0; p < NN; p++) {
      if (b[p] !== 0 || p === ko || isEye(b, p, c)) continue;
      let ok = false;
      for (const r of NB[p]) if (b[r] === 0) { ok = true; break; }
      if (!ok) ok = playIP(b.slice(), p, c, ko) !== -2;
      if (ok) res.push(p);
    }
    return res;
  }

  function mk(move, color) { return { move, color, N: 0, W: 0, aN: 0, aW: 0, children: null }; }

  function select(node) {
    let best = null, bv = -1;
    const lnN = Math.log(node.N + 1);
    for (const ch of node.children) {
      let v;
      if (ch.N === 0 && ch.aN === 0) v = 0.9 + Math.random() * 0.05;
      else {
        const q = ch.N > 0 ? ch.W / ch.N : 0.5;
        const aq = ch.aN > 0 ? ch.aW / ch.aN : 0.5;
        const beta = ch.aN / (ch.aN + ch.N + ch.aN * ch.N / 2000 + 1e-9);
        v = (1 - beta) * q + beta * aq + 0.25 * Math.sqrt(lnN / (ch.N + 1));
      }
      if (v > bv) { bv = v; best = ch; }
    }
    return best;
  }

  function search(b0, c0, ko0, playouts, ms, komi) {
    const root = mk(-1, 3 - c0);
    root.children = legalMoves(b0, c0, ko0).map(m => mk(m, c0));
    const own = new Float32Array(NN);
    const amaf = new Int8Array(NN);
    const t0 = Date.now();
    let n = 0;
    if (!root.children.length) return { root, own, n };
    while (n < playouts && (n & 15 || Date.now() - t0 < ms)) {
      const b = b0.slice();
      let c = c0, ko = ko0, node = root;
      const path = [root];
      amaf.fill(0);
      while (true) {
        if (!node.children) node.children = legalMoves(b, c, ko).map(m => mk(m, c));
        if (!node.children.length) break;
        const ch = select(node);
        const k = playIP(b, ch.move, c, ko);
        if (k === -2) break;
        ko = k;
        if (amaf[ch.move] === 0) amaf[ch.move] = c;
        c = 3 - c;
        node = ch; path.push(ch);
        if (ch.N < 3) break;
      }
      playout(b, c, ko, 160, amaf);
      const winner = areaScore(b) - komi > 0 ? 1 : 2;
      for (let p = 0; p < NN; p++) { const o = ownerOf(b, p); if (o === 1) own[p]++; else if (o === 2) own[p]--; }
      for (const nd of path) {
        nd.N++;
        if (nd.color === winner) nd.W++;
        if (nd.children) for (const ch of nd.children) {
          if (amaf[ch.move] === ch.color) { ch.aN++; if (ch.color === winner) ch.aW++; }
        }
      }
      n++;
    }
    return { root, own, n };
  }

  // botの強さ: level 0 = 10級 … 13 = 四段
  function think(d) {
    const b = Int8Array.from(d.board);
    const L = d.level, c = d.toPlay;
    const playouts = Math.round(60 * Math.pow(1.48, L));
    const ms = Math.max(250, Math.min(400 + L * 230, d.timeLeft / 12));
    const { root, own, n } = search(b, c, d.ko, playouts, ms, d.komi);
    if (!n) return { move: -1 };
    let est = 0, settled = true;
    for (let p = 0; p < NN; p++) {
      const v = own[p] / n;
      est += v;
      if (b[p] === 0 && Math.abs(v) < 0.85) settled = false;
    }
    est -= d.komi;
    const ahead = c === 1 ? est > 0 : est < 0;
    const sorted = root.children.slice().sort((a, z) => z.N - a.N);
    const best = sorted[0];
    const wr = best.N ? best.W / best.N : 0.5;
    if (d.moveNum > 24 && L >= 2 && wr < 0.04) return { resign: true, winrate: wr };
    if (d.oppPassed && ahead) return { move: -1, winrate: wr };
    if (d.moveNum >= 30 && settled) return { move: -1, winrate: wr };
    let choice = best;
    const T = Math.max(0, 1.6 - 0.13 * L);
    if (T > 0.05) {
      const top = sorted.slice(0, 8);
      const w = top.map(ch => Math.pow(ch.N + 1, 1 / T));
      let r = Math.random() * w.reduce((a, z) => a + z, 0);
      for (let i = 0; i < top.length; i++) { r -= w[i]; if (r <= 0) { choice = top[i]; break; } }
    }
    const blunder = Math.max(0, 0.25 - 0.022 * L);
    if (Math.random() < blunder) choice = sorted[(Math.random() * Math.min(20, sorted.length)) | 0];
    return { move: choice.move, winrate: wr };
  }

  // 終局時の死活判定用：各点の所有率（+1 黒 / -1 白）
  function ownership(board, n) {
    const own = new Float32Array(NN);
    for (let i = 0; i < n; i++) {
      const b = Int8Array.from(board);
      playout(b, (i & 1) + 1, -1, 200, null);
      for (let p = 0; p < NN; p++) { const o = ownerOf(b, p); if (o === 1) own[p]++; else if (o === 2) own[p]--; }
    }
    return Array.from(own, v => v / n);
  }

  const api = { N, NN, NB, DG, group, play, isEye, think, ownership };
  root.GoEngine = api;

  if (typeof window === 'undefined' && typeof self !== 'undefined') {
    self.onmessage = e => {
      const d = e.data;
      if (d.type === 'think') self.postMessage(Object.assign({ id: d.id }, think(d)));
      else if (d.type === 'score') self.postMessage({ id: d.id, own: ownership(d.board, d.n || 800) });
    };
  }
})(typeof self !== 'undefined' ? self : this);
