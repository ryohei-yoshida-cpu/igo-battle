// 運営画面の二重ロック：部屋番号 ＋ 合言葉。5回まちがえたら1時間ロック
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeCore, user } from '../helpers.mjs';
import { ADMIN_PID } from '../../server/admin.js';

// 運営の部屋番号のアカウントを作る
async function adminUser(core) {
  const a = await user(core, 9);
  const old = a.pid;
  await core.withAcct(a.id, async r => { r.pid = ADMIN_PID; });
  await core.store.del('pid:' + old); await core.store.put('pid:' + ADMIN_PID, a.id);
  a.pid = ADMIN_PID;
  return a;
}
const adm = (c, op, m) => c.ask('admin', Object.assign({ op }, m || {}));

test('合言葉を入れるまでは、運営の部屋番号でも使えない', async () => {
  const { core } = makeCore({ core: { adminKey: 'secret-key-123' } });
  const a = await adminUser(core);
  assert.equal((await adm(a, 'reports')).reason, 'lock');
  assert.equal((await adm(a, 'unlock', { key: 'wrong' })).reason, 'key');
  assert.equal((await adm(a, 'unlock', { key: 'secret-key-123' })).ok, true);
  assert.equal((await adm(a, 'reports')).ok, true);
  const log = (await adm(a, 'log')).log;
  assert.deepEqual(log.map(x => x.ok), [true, false], '成功も失敗も記録');
});

test('ほかの人は、合言葉を知っていても使えない', async () => {
  const { core } = makeCore({ core: { adminKey: 'secret-key-123' } });
  const b = await user(core, 1);
  assert.equal((await adm(b, 'unlock', { key: 'secret-key-123' })).reason, 'admin');
  assert.equal((await adm(b, 'reports')).reason, 'admin');
});

test('5回まちがえたら1時間ロック（正しい合言葉でも入れない）', async () => {
  const { core, clock } = makeCore({ core: { adminKey: 'secret-key-123' } });
  const a = await adminUser(core);
  for (let i = 0; i < 4; i++) assert.equal((await adm(a, 'unlock', { key: 'x' + i })).reason, 'key');
  assert.equal((await adm(a, 'unlock', { key: 'x5' })).reason, 'locked');
  assert.equal((await adm(a, 'unlock', { key: 'secret-key-123' })).reason, 'locked');
  clock.t += 3600e3 + 1000;
  assert.equal((await adm(a, 'unlock', { key: 'secret-key-123' })).ok, true);
});

test('合言葉は12時間で切れる', async () => {
  const { core, clock } = makeCore({ core: { adminKey: 'secret-key-123' } });
  const a = await adminUser(core);
  await adm(a, 'unlock', { key: 'secret-key-123' });
  clock.t += 12 * 3600e3 + 1000;
  assert.equal((await adm(a, 'reports')).reason, 'lock');
});

test('合言葉が設定されていなければ、だれも使えない', async () => {
  const { core } = makeCore();
  const a = await adminUser(core);
  assert.equal((await adm(a, 'unlock', { key: '' })).reason, 'nokey');
  assert.equal((await adm(a, 'reports')).reason, 'nokey');
});
