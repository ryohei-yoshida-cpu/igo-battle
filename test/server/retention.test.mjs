// 保管期間：書きこみの写し・メッセージの原本・通報は1年で消える
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeCore } from '../helpers.mjs';

const DAY = 864e5;
test('メッセージの原本は1年たったものから消える', async () => {
  const { core, clock } = makeCore();
  for (let i = 1; i <= 5; i++) await core.store.put('msg:' + i, { n: i, t: clock.t - (i <= 3 ? 400 : 100) * DAY });
  await core.store.put('msgseq', { n: 5 });
  await core.mail.purge();
  const left = []; for (let i = 1; i <= 5; i++) left.push(!!(await core.store.get('msg:' + i)));
  assert.deepEqual(left, [false, false, false, true, true]);
});
test('書きこみの写しと通報は、1年たったものが消える', async () => {
  const { core, clock } = makeCore();
  await core.social.withKey('clog:x', l => { l.push({ t: clock.t - 400 * DAY, text: 'old' }); }, () => []);
  await core.social.logPost('x', { text: 'new' });
  assert.deepEqual((await core.store.get('clog:x')).map(x => x.text), ['new']);
  await core.social.withKey('reports', l => { l.push({ t: clock.t - 400 * DAY, x: 'old' }); }, () => []);
  await core.social.pushList('reports', { t: clock.t, x: 'new' }, () => false, 500);
  assert.deepEqual((await core.store.get('reports')).map(x => x.x), ['new']);
});
