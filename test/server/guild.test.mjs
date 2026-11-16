// 碁会所：作成・入会・権限・家具の提供・看板・年齢
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeCore, user, guild } from '../helpers.mjs';

test('作って、入って、マスターだけが看板を買える（勾玉）', async () => {
  const { core } = makeCore();
  const a = await user(core, 1), b = await user(core, 2);
  const r = await guild(a, 'create', { name: '看板会', short: 'K' });
  assert.ok(r.ok); assert.equal(r.guild.sign, 'kaya');
  assert.ok((await guild(b, 'join', { id: r.guild.id })).ok);
  assert.equal((await guild(b, 'sign', { id: 'kin' })).reason, 'role');
  assert.equal((await guild(a, 'sign', { id: 'kin' })).reason, 'tama');
  await core.withAcct(a.id, async x => { x.tama = { go: 500 }; });
  const s = await guild(a, 'sign', { id: 'kin' });
  assert.equal(s.guild.sign, 'kin'); assert.equal(s.econ.tama.go, 350);
  assert.equal((await guild(a, 'sign', { id: 'kaya' })).guild.sign, 'kaya');
  const again = await guild(a, 'sign', { id: 'kin' });
  assert.equal(again.guild.sign, 'kin'); assert.ok(!again.econ, '買ったものは無料で切りかえ');
  assert.equal((await guild(a, 'sign', { id: 'nope' })).ok, false);
});

test('余っている家具だけ提供できる（置いているものは不可・戻せない）', async () => {
  const { core } = makeCore();
  const a = await user(core, 1), b = await user(core, 2);
  const gid = (await guild(a, 'create', { name: '家具会', short: 'F' })).guild.id;
  await guild(b, 'join', { id: gid });
  await core.withAcct(b.id, async r => { r.owned.items.zaisu = 3; r.room.items = [{ uid: 1, k: 'zaisu', x: 1, y: 1 }]; });
  const r = await guild(b, 'gitem', { k: 'zaisu', n: 2 });
  assert.ok(r.ok); assert.equal(r.guild.groom.owned.items.zaisu, 2);
  assert.equal((await core.store.get('acct:' + b.id)).owned.items.zaisu, 1);
  assert.equal((await guild(b, 'gitem', { k: 'zaisu', n: 1 })).reason, 'placed');
});

test('15歳以下は、ふつうの碁会所に入れない', async () => {
  const { core } = makeCore();
  const a = await user(core, 1), kid = await user(core, 2, { birth: '2015-04-01' });
  const gid = (await guild(a, 'create', { name: '大人会', short: 'O' })).guild.id;
  const r = await guild(kid, 'join', { id: gid });
  assert.equal(r.ok, false);
});

test('抜けると、マスターは店長かほかのメンバーへ。最後の1人が抜けると閉じる', async () => {
  const { core } = makeCore();
  const a = await user(core, 1), b = await user(core, 2);
  const gid = (await guild(a, 'create', { name: '退会会', short: 'L' })).guild.id;
  await guild(b, 'join', { id: gid });
  assert.equal((await guild(a, 'leave')).guild, null);
  assert.equal((await core.store.get('guild:' + gid)).master, b.id);
  assert.equal((await guild(a, 'me')).guild, null);
  await guild(b, 'leave');
  assert.equal(await core.store.get('guild:' + gid), undefined);
});
