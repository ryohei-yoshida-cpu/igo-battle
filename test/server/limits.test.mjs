// 上限：同じ家具は99個まで、1部屋99個まで、全部で600個まで、部屋は20まで
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeCore, user } from '../helpers.mjs';
import { ROOM_LIM } from '../../server/econ.js';

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

test('開放のイベントのもらいもの：直接わたす（扇子・300銭・800銭・ドライフラワー）。2回目はもらえない', async () => {
  const { core } = makeCore();
  const a = await user(core, 1);
  const z0 = (await core.store.get('acct:' + a.id)).zeni;
  for (const id of ['rec', 'av', 'room', 'kotto']) assert.ok((await a.call({ t: 'claim', kind: 'unlock', id }, 'claimed')).econ);
  const r = await core.store.get('acct:' + a.id);
  assert.ok(r.owned.av.includes('tool:t13'));
  assert.equal(r.zeni, z0 + 1100);
  assert.equal(r.owned.items.w_dryflower, 1);
  await a.call({ t: 'claim', kind: 'unlock', id: 'av' }, 'zeni');
  assert.equal((await core.store.get('acct:' + a.id)).zeni, z0 + 1100);
});
test('碁盤は800銭で買える', async () => {
  const { core } = makeCore();
  const a = await user(core, 1);
  await core.withAcct(a.id, async r => { r.zeni = 800; });
  const res = await a.call({ t: 'buy', item: 'goban' }, 'bought');
  assert.equal(res.ok, true); assert.equal(res.econ.zeni, 0);
});

test('ゲームの記念品：同じゲームの中ではもらえない。ほかのゲームをはじめたら、前のゲームの記念品がもらえる（1回だけ）', async () => {
  const { gamePack } = await import('../../server/econ.js');
  const r = { owned: { av: [], items: {} }, gifts: [] };
  gamePack(r, 'go', 1);
  gamePack(r, 'go', 2);
  const packs = () => (r.gifts || []).filter(g => g.kind === 'pack' || /記念品/.test(g.label || g.l || JSON.stringify(g)));
  assert.equal(packs().length, 0, '囲碁だけなら、もらえない');
  gamePack(r, 'shogi', 3);
  assert.equal(packs().length, 1, '将棋をはじめたら、囲碁の記念品');
  assert.match(JSON.stringify(packs()[0]), /囲碁BLITZ 記念品/);
  gamePack(r, 'othello', 4);
  assert.equal(packs().length, 1, '2回目はもらえない');
});
