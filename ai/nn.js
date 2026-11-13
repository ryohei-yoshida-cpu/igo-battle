/* 囲碁BLITZ — 囲碁AI（ニューラルネット）の計算。KataGo の g170 系モデル（版8）を、ブラウザだけで動かす。
 * モデル：KataGo g170（CC0 / パブリックドメイン）。tools/nn/convert.py で ai/*.bin（float16）と ai/*.json に変換したもの。
 * 盤の大きさは 9路・13路など（GoNet.of(N)）。データの並びは [点][チャンネル]（点 = y*N+x）。 */
(function (root) {
  'use strict';
  function half2f(u16) {
    const out = new Float32Array(u16.length);
    for (let i = 0; i < u16.length; i++) {
      const h = u16[i], s = h & 0x8000 ? -1 : 1, e = (h >> 10) & 31, f = h & 1023;
      out[i] = e === 0 ? s * f * 5.960464477539063e-8 : e === 31 ? (f ? NaN : s * Infinity) : s * (1 + f / 1024) * Math.pow(2, e - 15);
    }
    return out;
  }
  // 重み（float16）を、一度だけ float32 の表に直す。どの盤の大きさでも同じ重みを使える
  function tensors(meta, u16) {
    const all = half2f(u16), T = {};
    for (const k in meta.tensors) { const [o, n] = meta.tensors[k]; T[k] = all.subarray(o, o + n); }
    return T;
  }
  const built = {};
  function build(N) {
  const P = N * N;
  // 3x3・5x5 の畳み込みで、点 p のとなり（はみ出しは -1）
  const NBR = {};
  function nbr(k) {
    if (NBR[k]) return NBR[k];
    const r = k >> 1, a = new Int16Array(P * k * k);
    for (let p = 0; p < P; p++) { const x = p % N, y = (p / N) | 0; let i = 0;
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const xx = x + dx, yy = y + dy; a[p * k * k + i++] = xx < 0 || yy < 0 || xx >= N || yy >= N ? -1 : yy * N + xx; } }
    return (NBR[k] = a);
  }
  // 畳み込み：in [P][ic] → out [P][oc]（add=true なら足しこむ）。重みは [ky][kx][ic][oc]
  function conv(inp, ic, w, k, oc, out, add) {
    const nb = nbr(k), kk = k * k;
    if (!add) out.fill(0, 0, P * oc);
    for (let p = 0; p < P; p++) {
      const ob = p * oc;
      for (let t = 0; t < kk; t++) {
        const q = nb[p * kk + t]; if (q < 0) continue;
        const ib = q * ic, wb = t * ic * oc;
        for (let ci = 0; ci < ic; ci++) {
          const v = inp[ib + ci]; if (v === 0) continue;   // ReLU のあとは0が多い
          const wr = wb + ci * oc;
          for (let co = 0; co < oc; co++) out[ob + co] += v * w[wr + co];
        }
      }
    }
  }
  function bnact(inp, c, s, b, out) {
    for (let p = 0; p < P; p++) { const o = p * c; for (let i = 0; i < c; i++) { const v = inp[o + i] * s[i] + b[i]; out[o + i] = v > 0 ? v : 0; } }
  }
  const SQ = Math.sqrt(P) - 14;
  function gpool(x, c, out) {   // 平均・平均×(√面積-14)/10・最大
    for (let i = 0; i < c; i++) { let s = 0, m = -1; for (let p = 0; p < P; p++) { const v = x[p * c + i]; s += v; if (v > m) m = v; } const mean = s / P; out[i] = mean; out[c + i] = mean * SQ * 0.1; out[2 * c + i] = m; }
  }
  function vpool(x, c, out) {
    for (let i = 0; i < c; i++) { let s = 0; for (let p = 0; p < P; p++) s += x[p * c + i]; const mean = s / P; out[i] = mean; out[c + i] = mean * SQ * 0.1; out[2 * c + i] = mean * (SQ * SQ * 0.01 - 0.1); }
  }
  function matvec(v, ic, w, oc, out) { out.fill(0, 0, oc); for (let i = 0; i < ic; i++) { const a = v[i]; if (a === 0) continue; const r = i * oc; for (let o = 0; o < oc; o++) out[o] += a * w[r + o]; } }
  function addBias(x, c, bias) { for (let p = 0; p < P; p++) { const o = p * c; for (let i = 0; i < c; i++) x[o + i] += bias[i]; } }

  // u16 のかわりに、tensors() で作った表（T）を渡してもよい
  function Net(meta, u16, T) {
    T = T || tensors(meta, u16);
    this.m = meta; this.T = T;
    const C = meta.trunkC, maxC = 4 * C;
    this.x = new Float32Array(P * C); this.h = new Float32Array(P * C); this.r = new Float32Array(P * maxC); this.r2 = new Float32Array(P * maxC); this.g = new Float32Array(P * maxC);
    this.vec = new Float32Array(maxC * 3); this.vec2 = new Float32Array(maxC * 3);
  }
  // bin: Float32Array(P*22) [点][特徴]、glob: Float32Array(19)
  Net.prototype.forward = function (bin, glob) {
    const m = this.m, T = this.T, C = m.trunkC, x = this.x, h = this.h, r = this.r, r2 = this.r2, g = this.g, vec = this.vec, vec2 = this.vec2;
    conv(bin, m.bin, T.conv1, m.conv1[0], C, x, false);
    matvec(glob, m.glob, T.ginput, C, vec); addBias(x, C, vec);
    m.blocks.forEach((b, i) => {
      const p = 'b' + i + '.';
      bnact(x, C, T[p + 'pre.s'], T[p + 'pre.b'], h);
      const rc = b.c1[2];
      conv(h, C, T[p + 'c1'], b.c1[0], rc, r, false);
      if (b.kind === 'gpool') {
        const gc = b.cg[2];
        conv(h, C, T[p + 'cg'], b.cg[0], gc, g, false);
        bnact(g, gc, T[p + 'gbn.s'], T[p + 'gbn.b'], g);
        gpool(g, gc, vec); matvec(vec, 3 * gc, T[p + 'gm'], rc, vec2); addBias(r, rc, vec2);
      }
      bnact(r, rc, T[p + 'mid.s'], T[p + 'mid.b'], r2);
      conv(r2, rc, T[p + 'c2'], b.c2[0], C, x, true);
    });
    bnact(x, C, T['tip.s'], T['tip.b'], h);   // h = 幹の出力
    // 方策（どこに打つか）
    const pp = m.policy, c1 = pp.p1[2], cg = pp.g1[2];
    conv(h, C, T.p1, 1, c1, r, false);
    conv(h, C, T.g1, 1, cg, g, false); bnact(g, cg, T['g1bn.s'], T['g1bn.b'], g);
    gpool(g, cg, vec); matvec(vec, 3 * cg, T.pgb, c1, vec2); addBias(r, c1, vec2);
    bnact(r, c1, T['p1bn.s'], T['p1bn.b'], r);
    const policy = new Float32Array(P + 1);
    for (let p = 0; p < P; p++) { let s = 0; for (let i = 0; i < c1; i++) s += r[p * c1 + i] * T.p2[i]; policy[p] = s; }
    { let s = 0; for (let i = 0; i < 3 * cg; i++) s += vec[i] * T.ppass[i]; policy[P] = s; }
    // 価値（勝率）と、それぞれの点がどちらの地になりそうか
    const vv = m.value, cv = vv.v1[2], nv2 = vv.v2[1];
    conv(h, C, T.v1, 1, cv, g, false); bnact(g, cv, T['v1bn.s'], T['v1bn.b'], g);
    vpool(g, cv, vec); matvec(vec, 3 * cv, T.v2, nv2, vec2); for (let i = 0; i < nv2; i++) { const v = vec2[i] + T.v2b[i]; vec2[i] = v > 0 ? v : 0; }
    const value = new Float32Array(3); for (let o = 0; o < 3; o++) { let s = T.v3b[o]; for (let i = 0; i < nv2; i++) s += vec2[i] * T.v3[i * 3 + o]; value[o] = s; }
    const score = new Float32Array(vv.sv3[1]); for (let o = 0; o < score.length; o++) { let s = T.sv3b[o]; for (let i = 0; i < nv2; i++) s += vec2[i] * T.sv3[i * score.length + o]; score[o] = s; }
    const own = new Float32Array(P); for (let p = 0; p < P; p++) { let s = 0; for (let i = 0; i < cv; i++) s += g[p * cv + i] * T.own[i]; own[p] = Math.tanh(s); }
    return { policy, value, score, own };
  };
  return { Net, N, P };
  }
  const of = n => built[n] || (built[n] = build(n));
  root.GoNet = Object.assign({ of, tensors }, of(9));
})(typeof self !== 'undefined' ? self : this);
