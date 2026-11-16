// 囲碁のルール（サーバー用）：取る・自殺手・コウ・置き石・数え方
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as GO from '../../server/gorules.js';

const at = (x, y) => y * 9 + x;
test('石を取れる', () => {
  let b = GO.start(9, 0), r;
  // 黒 (1,0)(0,1) で白 (0,0) を取る
  r = GO.play(b, 9, at(0, 0), 2, -1); b = r.board;
  r = GO.play(b, 9, at(1, 0), 1, -1); b = r.board;
  r = GO.play(b, 9, at(0, 1), 1, -1); b = r.board;
  assert.equal(b[at(0, 0)], 0);
});
test('石の上と自殺手は打てない', () => {
  let b = GO.start(9, 0);
  b = GO.play(b, 9, at(1, 0), 1, -1).board;
  b = GO.play(b, 9, at(0, 1), 1, -1).board;
  assert.equal(GO.play(b, 9, at(1, 0), 2, -1), null);   // 石の上
  assert.equal(GO.play(b, 9, at(0, 0), 2, -1), null);   // 自殺手
});
test('コウはすぐ取り返せない', () => {
  let b, r;
  b = GO.start(9, 0);
  for (const [p, c] of [[at(1, 0), 1], [at(0, 1), 1], [at(1, 2), 1], [at(2, 0), 2], [at(3, 1), 2], [at(2, 2), 2], [at(2, 1), 1]]) b = GO.play(b, 9, p, c, -1).board;
  r = GO.play(b, 9, at(1, 1), 2, -1);   // 白が (1,1) に打って黒 (2,1) を取る
  assert.ok(r, '白は打てる'); assert.equal(r.board[at(2, 1)], 0); assert.equal(r.ko, at(2, 1));
  assert.equal(GO.play(r.board, 9, at(2, 1), 1, r.ko), null, 'すぐ取り返すのはコウで打てない');
});
test('置き石の位置', () => {
  const b = GO.start(9, 3);
  assert.deepEqual(b.map((v, p) => v ? p : -1).filter(p => p >= 0).sort((a, c) => a - c), [24, 56, 60].sort((a, c) => a - c));
});
test('数え方：死に石を取りのぞいて数える（コミ7）', () => {
  let b = GO.start(9, 0);
  for (let y = 0; y < 9; y++) { b[at(3, y)] = 1; b[at(5, y)] = 2; }
  b[at(0, 0)] = 2;   // 黒の地の中の白の死に石
  const s = GO.score(b, 9, [at(0, 0)], 7);
  assert.equal(s.black, 36); assert.equal(s.white, 36); assert.equal(s.winner, 2);
  const s2 = GO.score(b, 9, [], 7);   // 死に石と認めないと、黒の地にならない
  assert.ok(s2.black < 36);
});
