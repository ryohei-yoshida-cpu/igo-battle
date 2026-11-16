// アカウント：作成・ログイン・総当たり対策・削除
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeCore, client, user, guild, wait } from '../helpers.mjs';

test('作ってログインできる。パスワードがちがえば authfail', async () => {
  const { core } = makeCore();
  const a = await user(core, 1);
  const c = client(core, 'ipX');
  c.send({ t: 'login', game: 'go', id: a.id, pass: a.pass });
  assert.equal((await c.next('account')).id, a.id);
  const d = client(core, 'ipY');
  d.send({ t: 'login', game: 'go', id: a.id, pass: 'ZZZZZZZZ' });
  await d.next('authfail');
});
test('同じIPから1時間に30回まちがえると、ログインできなくなる', async () => {
  const { core, clock } = makeCore();
  const c = client(core, 'bad');
  for (let i = 0; i < 30; i++) { c.send({ t: 'login', id: 'AAAAAAAA', pass: 'BBBBBBBB' }); await wait(2); }
  await wait(50); clock.t += 2000;   // 送りすぎの制限（1秒2回）がもどるまで進める
  c.send({ t: 'login', id: 'AAAAAAAA', pass: 'BBBBBBBB' });
  assert.equal((await c.next('busy')).what, 'login');
});
test('はじめてのレートは1050（アプリから送られた数字は使わない）', async () => {
  const { core } = makeCore();
  const a = await user(core, 1);
  a.send({ t: 'sync', game: 'go', stats: { go: { go9: { rating: 2000, games: 99, wins: 99 } } } });
  await wait(30);
  const st = await a.ask('econ', { t: 'gifts' }).catch(() => null);
  const r = await core.store.get('acct:' + a.id);
  assert.ok(!r.rate || !r.rate.go9 || r.rate.go9.rating === 1050);
  void st;
});
test('アカウント削除：パスワードを確かめ、データ・フレンド・碁会所の所属を消す', async () => {
  const { core } = makeCore();
  const a = await user(core, 1), b = await user(core, 2);
  const gid = (await guild(a, 'create', { name: '削除会', short: 'S' })).guild.id;
  await guild(b, 'join', { id: gid });
  await a.ask('soc', { op: 'freq', pid: b.pid }); await b.ask('soc', { op: 'faccept', pid: a.pid });
  assert.equal((await a.ask('delacct', { pass: 'WRONGPAS' })).reason, 'pass');
  assert.equal((await a.ask('delacct', { pass: a.pass })).ok, true);
  assert.equal(await core.store.get('acct:' + a.id), undefined);
  assert.equal(await core.store.get('pid:' + a.pid), undefined);
  assert.equal(await core.store.get('soc:' + a.id), undefined);
  const g = await core.store.get('guild:' + gid);
  assert.equal(g.master, b.id, 'マスターはのこったメンバーへ');
  assert.equal((await core.store.get('soc:' + b.id)).friends.length, 0, '相手のフレンド一覧からも外れる');
});
