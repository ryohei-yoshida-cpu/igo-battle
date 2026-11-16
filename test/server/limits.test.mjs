// 上限：同じ家具は99個まで、1部屋99個まで、全部で600個まで、部屋は20まで
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeCore, user } from '../helpers.mjs';
import { ROOM_LIM } from '../../server/core.js';

test('上限の値', () => {
  assert.deepEqual(ROOM_LIM, { perRoom: 99, perKind: 99, total: 600 });
});

test('同じ家具を99個持っていたら、もう買えない', async () => {
  const { core } = makeCore();
  const a = await user(core, 1);
  await core.withAcct(a.id, async r => { r.zeni = 1e7; r.owned.items.zaisu = 99; });
  const res = await a.call({ t: 'buy', item: 'zaisu' }, 'bought');
  assert.equal(res.ok, false); assert.equal(res.reason, 'cap');
});

test('1部屋に100個は保存できない（99個ならできる）', async () => {
  const { core } = makeCore();
  const a = await user(core, 1);
  await core.withAcct(a.id, async r => { r.owned.items.zaisu = 99; r.owned.items.kotatsu = 99; });
  const items = [];
  for (let i = 0; i < 100; i++) items.push({ uid: i + 1, k: i < 99 ? 'zaisu' : 'kotatsu', x: i % 10, y: (i / 10) | 0 });
  const bad = await a.call({ t: 'room', room: { items, walls: [] } }, 'roomsaved');
  assert.equal(bad.ok, false);
  const good = await a.call({ t: 'room', room: { items: items.slice(0, 99), walls: [] } }, 'roomsaved');
  assert.equal(good.ok, true);
});
