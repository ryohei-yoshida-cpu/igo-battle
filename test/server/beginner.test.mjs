// 初心者の保護：はじめの10局はレートが下がらない／強さが離れた人とはすぐには当たらない
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeCore, user, wait } from '../helpers.mjs';
import { applyRate } from '../../server/rating.js';

test('はじめの10局は、負けてもレートが下がらない', () => {
  const t = { rating: 1050, games: 0, wins: 0, draws: 0, streak: 0, earnedDan: -1 };
  for (let i = 0; i < 10; i++) assert.equal(applyRate(t, 1200, 0, false), 0);
  assert.equal(t.rating, 1050);
  assert.ok(applyRate(t, 1200, 0, false) < 0, '11局目からは下がる');
});
test('勝てば最初から上がる', () => {
  const t = { rating: 1050, games: 0, wins: 0, draws: 0, streak: 0, earnedDan: -1 };
  assert.ok(applyRate(t, 1100, 1, false) > 0);
});
test('レート差が大きいと、待ち始めてすぐには当たらない（待つと広がる）', async () => {
  const { core, clock } = makeCore();
  const a = await user(core, 1), b = await user(core, 2);
  for (const p of core.players.values()) if (p.acct === b.id) p.rates = { go9: 1500, go13: 1050 };   // B は 1500
  a.send({ t: 'seek', size: 9 }); b.send({ t: 'seek', size: 9 }); await wait(30);
  assert.ok(!a.inbox.some(x => x.t === 'start'), '450差はすぐには当たらない');
  clock.t += 13000;   // 13秒待つと 200+260=460 まで
  await new Promise(r => setTimeout(r, 1100));
  assert.ok(a.inbox.some(x => x.t === 'start'), '待てば当たる');
});
