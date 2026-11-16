// 交流：メッセージ・一言コメントの連投禁止・15歳以下の制限・NGワード
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeCore, user } from '../helpers.mjs';

async function friends(a, b) { await a.ask('soc', { op: 'freq', pid: b.pid }); await b.ask('soc', { op: 'faccept', pid: a.pid }); }

test('フレンドにメッセージを送れる。連絡先は送れない', async () => {
  const { core } = makeCore();
  const a = await user(core, 1), b = await user(core, 2);
  await friends(a, b);
  assert.ok((await a.ask('mail', { op: 'send', pid: b.pid, text: 'こんにちは' })).ok);
  assert.equal((await a.ask('mail', { op: 'send', pid: b.pid, text: 'メールは abc@example.com です' })).ok, false);
  const list = await b.ask('mail', { op: 'list' });
  assert.equal(list.list[0].text, 'こんにちは');
});

test('フレンドでも碁会所の仲間でもない人には送れない', async () => {
  const { core } = makeCore();
  const a = await user(core, 1), b = await user(core, 2);
  assert.equal((await a.ask('mail', { op: 'send', pid: b.pid, text: 'やあ' })).reason, 'who');
});

test('一言コメントは30秒に1回', async () => {
  const { core, clock } = makeCore();
  const a = await user(core, 1), b = await user(core, 2);
  await friends(a, b);
  assert.ok((await a.ask('soc', { op: 'chat', pid: b.pid, text: 'いち' })).ok);
  assert.equal((await a.ask('soc', { op: 'chat', pid: b.pid, text: 'に' })).reason, 'wait');
  clock.t += 31e3;
  assert.ok((await a.ask('soc', { op: 'chat', pid: b.pid, text: 'さん' })).ok);
});

test('15歳以下は、一言コメントもメッセージも使えない', async () => {
  const { core } = makeCore();
  const kid = await user(core, 1, { birth: '2014-06-01' }), b = await user(core, 2);
  await friends(kid, b);
  assert.equal((await kid.ask('soc', { op: 'chat', pid: b.pid, text: 'やあ' })).reason, 'kid');
  assert.equal((await kid.ask('mail', { op: 'send', pid: b.pid, text: 'やあ' })).reason, 'kid');
  assert.equal((await b.ask('mail', { op: 'send', pid: kid.pid, text: 'やあ' })).reason, 'kidto');
});

test('生年月日はあとから変えられない', async () => {
  const { core } = makeCore();
  const a = await user(core, 1, { birth: '1990-01-01' });
  const r = await a.ask('soc', { op: 'birth', birth: '2015-01-01' });
  assert.equal(r.birth, '1990-01-01');
});
