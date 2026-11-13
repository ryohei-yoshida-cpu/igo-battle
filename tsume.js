/* 囲碁BLITZ — 詰碁の判定（石を取り切れるか・逃げ切れるか）
 * 攻める側（attacker）が target の石を depth 手以内に取れるかを読む。
 * レクチャーの「取る」「逃げる」問題の正誤判定と、白の自動応手に使う。 */
(function (root) {
  'use strict';
  const NB = () => root.GoEngine.NB;
  const group = (b, p) => root.GoEngine.group(b, p);
  const play = (b, p, c, ko) => root.GoEngine.play(b, p, c, ko);

  function uniq(a) { return [...new Set(a)]; }

  // 攻め側の候補手：相手の呼吸点（net=true なら呼吸点のとなりも＝ゲタ）、自分のアタリの石を助ける手
  function attackMoves(b, target, atk, net) {
    const g = group(b, target), nb = NB();
    let mv = g.libs.slice();
    if (net) for (const l of g.libs) for (const q of nb[l]) if (b[q] === 0) mv.push(q);
    for (const s of g.stones) for (const q of nb[s]) {
      if (b[q] === atk) { const h = group(b, q); if (h.libs.length === 1) mv.push(h.libs[0]); }
    }
    return uniq(mv);
  }
  // 守り側の候補手：逃げる（呼吸点に伸びる）、まわりの攻め石を取る／アタリにする
  function defendMoves(b, target, atk) {
    const g = group(b, target), nb = NB();
    let mv = g.libs.slice();
    const seen = new Set();
    for (const s of g.stones) for (const q of nb[s]) {
      if (b[q] !== atk) continue;
      const h = group(b, q), id = Math.min(...h.stones);
      if (seen.has(id)) continue; seen.add(id);
      if (h.libs.length <= 2) mv = mv.concat(h.libs);
    }
    // 伸びた先の呼吸点（逃げ道を広げる手）
    for (const l of g.libs) for (const q of nb[l]) if (b[q] === 0) mv.push(q);
    return uniq(mv);
  }

  // attacker が target を depth 手以内に取れるか（toPlay から打つ）
  function canCapture(b, ko, target, atk, toPlay, depth, net) {
    if (!b[target]) return true;
    const g = group(b, target);
    if (toPlay === atk && g.libs.length === 1) return true;
    if (depth <= 0 || g.libs.length >= 4) return false;
    if (toPlay === atk) {
      for (const m of attackMoves(b, target, atk, net)) {
        const r = play(b, m, atk, ko); if (!r) continue;
        if (canCapture(r.board, r.ko, target, atk, 3 - atk, depth - 1, net)) return true;
      }
      return false;
    }
    for (const m of defendMoves(b, target, atk)) {
      const r = play(b, m, 3 - atk, ko); if (!r) continue;
      if (!canCapture(r.board, r.ko, target, atk, atk, depth - 1, net)) return false;
    }
    // 手を抜く（よそに打つ）場合
    if (!canCapture(b, -1, target, atk, atk, depth - 1, net)) return false;
    return true;
  }

  // 守り側のいちばん粘る応手（呼吸点が最も多くなる手）
  function bestDefense(b, ko, target, atk, depth, net) {
    let best = null, bestScore = -1;
    for (const m of defendMoves(b, target, atk)) {
      const r = play(b, m, 3 - atk, ko); if (!r) continue;
      if (!r.board[target]) continue;
      const libs = group(r.board, target).libs.length;
      const escapes = !canCapture(r.board, r.ko, target, atk, atk, depth - 1, net);
      const score = (escapes ? 100 : 0) + libs * 3 + (r.cap.length ? 5 : 0) + (group(b, target).libs.includes(m) ? 1 : 0);
      if (score > bestScore) { bestScore = score; best = m; }
    }
    return best;
  }

  // 初手として正しい手をすべて列挙（問題の検証用）
  function solutions(b, target, atk, depth, net, mode) {
    const res = [];
    for (let p = 0; p < 81; p++) {
      if (b[p]) continue;
      const mover = mode === 'save' ? 3 - atk : atk;
      const r = play(b, p, mover, -1); if (!r) continue;
      if (mode === 'save') { if (r.board[target] && !canCapture(r.board, r.ko, target, atk, atk, depth, net)) res.push(p); }
      else if (!r.board[target] || canCapture(r.board, r.ko, target, atk, 3 - atk, depth - 1, net)) res.push(p);
    }
    return res;
  }

  root.Tsume = { canCapture, bestDefense, solutions, attackMoves, defendMoves };
})(typeof self !== 'undefined' ? self : this);
