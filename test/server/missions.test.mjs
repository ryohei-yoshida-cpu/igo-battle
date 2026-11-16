// デイリーミッション：形の数え方・クリアで50銭・全部で100銭・日付でリセット
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeCore, user, wait } from '../helpers.mjs';
import { countShapes, addMissions, missionsOf } from '../../server/missions.js';

const at = (x, y) => y * 9 + x;
test('形を数える：ケイマ・一間トビ・大ゲイマ・アタリ', () => {
  assert.deepEqual(countShapes(9, [at(2, 2), at(8, 8), at(3, 4), at(8, 0), at(5, 4), at(0, 8), at(6, 1), at(7, 7)], 1, 0), { atari: 0, keima: 1, tobi: 1, ogeima: 1 });
  assert.equal(countShapes(9, [at(4, 3), at(4, 4), at(3, 4), at(0, 0), at(5, 4)], 1, 0).atari, 1);
  assert.equal(countShapes(9, [at(4, 3), at(4, 4), at(3, 4), at(0, 0), at(5, 4)], 2, 0).atari, 0, '相手の手は数えない');
});
test('くっつけた手や、あいだに石がある一間は数えない', () => {
  // 黒 (2,2) (3,2)〔くっつけ〕… (4,2) は (2,2) から一間だが (3,2) にくっついている
  assert.deepEqual(countShapes(9, [at(2, 2), at(8, 8), at(3, 2), at(8, 0), at(4, 2)], 1, 0), { atari: 0, keima: 0, tobi: 0, ogeima: 0 });
  // 一間のあいだに相手の石
  assert.equal(countShapes(9, [at(2, 2), at(3, 2), at(4, 2)], 1, 0).tobi, 0);
});
test('ルールに合わない手順は数えない', () => {
  assert.equal(countShapes(9, [at(2, 2), at(2, 2)], 1, 0), null);
});
test('クリアで50銭ずつ、5つ全部で100銭。日付が変わると0から', () => {
  const t = Date.UTC(2026, 10, 16, 3), r = { gifts: [] };
  const c1 = addMissions(r, t, { games: 5, atari: 20, keima: 3 });
  assert.deepEqual(c1, ['games', 'atari']);
  assert.deepEqual(r.gifts.map(g => g.amount), [50, 50]);
  const c2 = addMissions(r, t, { keima: 7, tobi: 10, ogeima: 9 });
  assert.deepEqual(c2, ['keima', 'tobi', 'ogeima', 'all']);
  assert.deepEqual(r.gifts.map(g => g.amount), [50, 50, 50, 50, 50, 100]);
  assert.equal(addMissions(r, t, { games: 1 }).length, 0, '同じ日に2回はもらえない');
  assert.equal(missionsOf(r, t + 24 * 3600e3).games, 0);
});
test('Bot戦の終わりに、手順から数えてプレゼントボックスへ', async () => {
  const { core, clock } = makeCore();
  const a = await user(core, 1);
  a.send({ t: 'botstart', g: 'b1', lv: 3, size: 9, color: 1 }); await wait(20);
  clock.t += 60e3;
  // 黒（自分）がケイマ・一間・大ゲイマ…を打つ16手以上の手順
  const rec = [at(2, 2), at(8, 8), at(3, 4), at(8, 0), at(5, 4), at(0, 8), at(6, 1), at(7, 7), at(0, 0), at(8, 6), at(1, 6), at(6, 8), at(4, 7), at(8, 2), at(2, 8), at(0, 4)];
  const dm = await a.call({ t: 'botend', g: 'b1', result: 'win', moves: rec.length, rec }, 'dm');
  assert.equal(dm.dm.games, 1); assert.ok(dm.dm.keima >= 1 && dm.dm.tobi >= 1 && dm.dm.ogeima >= 1);
});
