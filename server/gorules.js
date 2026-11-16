/* サーバー用の囲碁のルール（アプリの engine.js と同じ判定）
 *   start(size, h)            … 最初の盤面（置き石 h 子。アプリの HC_PTS と同じ位置）
 *   play(board, size, p, c, ko) … 打てれば { board, ko }、打てなければ null（石がある・自殺手・コウ）
 *   score(board, size, dead, komi) … 死に石を取りのぞいて地を数える（中国ルール：石＋地）。{ dead, terr, black, white, winner }
 *   libs(board, size, p)       … p の石のつながり（グループ）のダメの数
 */
const HC_PTS = { 9: [24, 56, 60, 20, 40], 13: [48, 120, 126, 42, 84] };
const NBS = {};
function nbOf(N) {
  if (NBS[N]) return NBS[N];
  const a = [];
  for (let p = 0; p < N * N; p++) { const x = p % N, y = (p / N) | 0, r = []; if (x > 0) r.push(p - 1); if (x < N - 1) r.push(p + 1); if (y > 0) r.push(p - N); if (y < N - 1) r.push(p + N); a.push(r); }
  return (NBS[N] = a);
}
function group(b, NB, p) {
  const c = b[p], st = [p], seen = new Set([p]), libs = new Set();
  for (let i = 0; i < st.length; i++) for (const r of NB[st[i]]) {
    if (b[r] === 0) libs.add(r); else if (b[r] === c && !seen.has(r)) { seen.add(r); st.push(r); }
  }
  return { stones: st, libs: libs.size };
}
export function libs(b, size, p) { return b[p] ? group(b, nbOf(size === 13 ? 13 : 9), p).libs : 0; }
export function start(size, h) {
  const N = size === 13 ? 13 : 9, b = new Array(N * N).fill(0);
  if (h >= 2) for (const p of HC_PTS[N].slice(0, h)) b[p] = 1;
  return b;
}
export function play(b, size, p, c, ko) {
  const N = size === 13 ? 13 : 9, NB = nbOf(N);
  if (p < 0 || p >= N * N || p === ko || b[p] !== 0) return null;
  const nb = b.slice(), o = 3 - c, cap = [];
  nb[p] = c;
  for (const r of NB[p]) if (nb[r] === o) { const g = group(nb, NB, r); if (g.libs === 0) for (const s of g.stones) { if (nb[s]) cap.push(s); nb[s] = 0; } }
  const g = group(nb, NB, p);
  if (g.libs === 0) return null;
  return { board: nb, ko: cap.length === 1 && g.stones.length === 1 && g.libs === 1 ? cap[0] : -1 };
}
export function score(board, size, dead, komi) {
  const N = size === 13 ? 13 : 9, NB = nbOf(N), NN = N * N, b = board.slice();
  const ds = [...new Set((dead || []).map(x => x | 0))].filter(p => p >= 0 && p < NN && board[p]);
  for (const p of ds) b[p] = 0;
  const terr = new Array(NN).fill(0), seen = new Array(NN).fill(false);
  for (let p = 0; p < NN; p++) {
    if (b[p] || seen[p]) continue;
    const reg = [p], border = new Set(); seen[p] = true;
    for (let i = 0; i < reg.length; i++) for (const q of NB[reg[i]]) { if (b[q]) border.add(b[q]); else if (!seen[q]) { seen[q] = true; reg.push(q); } }
    if (border.size === 1) { const o = [...border][0]; for (const q of reg) terr[q] = o; }
  }
  let black = 0, white = 0;
  for (let p = 0; p < NN; p++) { const o = b[p] || terr[p]; if (o === 1) black++; else if (o === 2) white++; }
  const fterr = terr.map((v, p) => b[p] ? 0 : v);
  for (const p of ds) fterr[p] = 3 - board[p];
  const margin = black - (white + komi);
  return { dead: ds, terr: fterr, black, white, winner: margin > 0 ? 1 : margin < 0 ? 2 : 0 };
}
