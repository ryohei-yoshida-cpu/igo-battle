// オンライン対局：ルール違反の手・整地の数えなおし・無効試合
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeCore, user, wait } from '../helpers.mjs';

async function startGame() {
  const { core, clock } = makeCore();
  const a = await user(core, 1), b = await user(core, 2);
  a.send({ t: 'seek', size: 9 }); b.send({ t: 'seek', size: 9 });
  const sa = await a.next('start'); await b.next('start');
  const B = sa.color === 1 ? a : b, W = B === a ? b : a;
  let n = 0;
  const mv = async (c, p) => { c.send({ t: 'move', g: sa.g, n, p }); n++; await wait(2); };
  return { core, clock, g: sa.g, B, W, mv, n: () => n };
}
// 黒は3列目、白は5列目にかべ。白は最後の1子を黒の地 (1,1)=10 に入れる
async function playWalls(t) {
  for (let y = 0; y < 9; y++) { await t.mv(t.B, y * 9 + 3); await t.mv(t.W, y < 8 ? y * 9 + 5 : 10); }
}

test('石の上に打つ手は受けつけない', async () => {
  const t = await startGame();
  await t.mv(t.B, 40); await t.mv(t.W, 41);
  const before = t.B.inbox.filter(x => x.t === 'move').length;
  t.B.send({ t: 'move', g: t.g, n: t.n(), p: 41 }); await wait(20);
  assert.equal(t.B.inbox.filter(x => x.t === 'move').length, before);
});

test('整地：アプリの「勝ち」は使わず、サーバーが数えなおす', async () => {
  const t = await startGame();
  await playWalls(t); await t.mv(t.B, -1); await t.mv(t.W, -1);
  t.B.send({ t: 'score', g: t.g, res: { dead: [10], winner: 2 } });   // 両方「白の勝ち」と言っているが…
  t.W.send({ t: 'score', g: t.g, res: { dead: [10], winner: 2, black: 0, white: 81 } });
  const end = await t.B.next('end');
  // 白のかべは下の端が空いているので、白の地はない。黒36・白8（石だけ）→ 黒の勝ち
  assert.equal(end.res.black, 36); assert.equal(end.res.white, 8); assert.equal(end.winner, 1);
  await t.B.next('rate');
});

test('整地が食いちがったら無効試合（レートは動かない）', async () => {
  const t = await startGame();
  await playWalls(t); await t.mv(t.B, -1); await t.mv(t.W, -1);
  t.B.send({ t: 'score', g: t.g, res: { dead: [10] } });
  t.W.send({ t: 'score', g: t.g, res: { dead: [] } });
  const end = await t.B.next('end');
  assert.equal(end.reason, '無効試合'); assert.equal(end.winner, 0); assert.ok(end.res.void);
  await wait(50);
  assert.ok(!t.B.inbox.some(x => x.t === 'rate'));
  assert.equal((await t.core.store.get('disputes')).length, 1, '運営用に記録');
});
