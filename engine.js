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

  /* =========================================================
   * 画面用：配列の盤面で着手を判定する（わかりやすさ優先）
   * ========================================================= */
  const mark = new Int32Array(NN), lmark = new Int32Array(NN);
  let stamp = 1;
  function group(b, p) {
    stamp++;
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

  function search(rootF, c0, playouts, ms, komi, last0) {
    const root = mk(-1, 3 - c0);
    root.children = expand(rootF, c0, last0);
    const own = new Float32Array(NN);
    const amaf = new Int8Array(NN);
    const f = new FB();
    const t0 = Date.now();
    let n = 0;
    if (!root.children.length) return { root, own, n };
    while (n < playouts && ((n & 31) || Date.now() - t0 < ms)) {
      f.copyFrom(rootF);
      let c = c0, node = root, lastMv = last0;
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
      playout(f, c, 160, amaf, lastMv);
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
      n++;
    }
    return { root, own, n };
  }

  // まだ打つべき点（駄目・コウ・アタリの石）が残っているか
  function needsPlay(f, c) {
    for (let p = 0; p < NN; p++) {
      if (f.col[p] !== 0) {
        if (f.rep[p] === p && f.inAtari(p)) {
          const l = f.lib1(p);
          if (f.legal(l, c) && !f.selfAtari(l, c)) return true;
        }
        continue;
      }
      let b = false, w = false;
      for (const q of NB[p]) { if (f.col[q] === 1) b = true; else if (f.col[q] === 2) w = true; }
      if (b && w && f.legal(p, c) && !f.selfAtari(p, c)) return true;
    }
    return f.ko >= 0;
  }

  // 強さの段階 s（0〜16）ごとの読みの量と時間。表示の段級 level は s = level + 3
  function budget(s, timeLeft) {
    const playouts = Math.round(300 * Math.pow(1.5, s));
    const ms = Math.max(300, Math.min(500 + s * 380 + Math.max(0, s - 13) * 1500, timeLeft / 14));
    return { playouts, ms };
  }

  // botの着手: level 0 = 10級 … 13 = 四段
  function think(d) {
    const L = d.level, S = L + 3, c = d.toPlay;
    const f = FB.fromArray(d.board, d.ko);
    const { playouts, ms } = budget(S, d.timeLeft);
    const last = d.last === undefined ? -1 : d.last;
    const { root, own, n } = search(f, c, playouts, ms, d.komi, last);
    const must = needsPlay(f, c);
    if (!n) return { move: -1 };
    let est = 0, settled = true;
    for (let p = 0; p < NN; p++) {
      const v = own[p] / n;
      est += v;
      if (d.board[p] === 0 && Math.abs(v) < 0.85) settled = false;
    }
    est -= d.komi;
    const margin = c === 1 ? est : -est; // botから見た推定の差（目）
    const ahead = margin >= 0;
    const sorted = root.children.slice().sort((a, z) => z.N - a.N);
    const best = sorted[0];
    const wr = best.N ? best.W / best.N : 0.5;
    const out = { winrate: wr, margin, playouts: n };
    // 投了：はっきり負けている（勝率8%未満、または15目以上の差で勝率25%未満）
    if (!d.noResign && d.moveNum >= 16 && n >= 150 && (wr < 0.08 || (margin < -15 && wr < 0.25))) return Object.assign(out, { resign: true });
    if (!d.noResign && d.oppPassed && !ahead && wr < 0.3) return Object.assign(out, { resign: true });
    // パスは、駄目・コウ・アタリが残っていないときだけ
    if (!must && ((d.oppPassed && ahead) || (d.moveNum >= 30 && settled && ahead))) return Object.assign(out, { move: -1 });
    let choice = best;
    // 弱いbotほど、2〜5番手の手もときどき選ぶ
    const T = Math.max(0, 0.7 - 0.15 * S);
    if (T > 0.05) {
      const top = sorted.slice(0, 5);
      const w = top.map(ch => Math.pow(ch.N + 1, 1 / T));
      let r = Math.random() * w.reduce((a, z) => a + z, 0);
      for (let i = 0; i < top.length; i++) { r -= w[i]; if (r <= 0) { choice = top[i]; break; } }
    }
    const blunder = Math.max(0, 0.1 - 0.025 * S);
    if (Math.random() < blunder) choice = sorted[(Math.random() * Math.min(10, sorted.length)) | 0];
    return Object.assign(out, { move: choice.move });
  }

  // 検討用：一番強い設定で読んだ候補手（上位3つ）
  function analyze(d) {
    const f = FB.fromArray(d.board, d.ko);
    const { root, n } = search(f, d.toPlay, 400000, d.ms || 5000, d.komi, d.last === undefined ? -1 : d.last);
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
      playout(f, (i & 1) + 1, 200, null, -1);
      for (let p = 0; p < NN; p++) { const o = f.ownerOf(p); if (o === 1) own[p]++; else if (o === 2) own[p]--; }
    }
    return Array.from(own, v => v / n);
  }

  const api = { N, NN, NB, DG, group, play, think, analyze, ownership, FB };
  root.GoEngine = api;

  if (typeof window === 'undefined' && typeof self !== 'undefined') {
    self.onmessage = e => {
      const d = e.data;
      if (d.type === 'think') self.postMessage(Object.assign({ id: d.id }, think(d)));
      else if (d.type === 'analyze') self.postMessage(Object.assign({ id: d.id }, analyze(d)));
      else if (d.type === 'score') self.postMessage({ id: d.id, own: ownership(d.board, d.n || 800) });
    };
  }
})(typeof self !== 'undefined' ? self : this);
