// テスト用の道具：サーバー（Core）を手元で動かし、アプリのかわりに通信する
import { Core } from '../server/core.js';

export const wait = ms => new Promise(r => setTimeout(r, ms));

// now を自由に進められるサーバー
export function makeCore(opt = {}) {
  const clock = { t: opt.t || Date.now() };
  // タイマーは unref（テストが終わったら、残っているタイマーを待たずに終われるように）
  const later = (f, ms) => { const t = setTimeout(f, ms); if (t.unref) t.unref(); return t; };
  const core = new Core(Object.assign({ now: () => clock.t, setTimeout: later }, opt.core || {}));
  return { core, clock };
}

// アプリ1台ぶん
export function client(core, ip = 'ip' + Math.random()) {
  const inbox = [];
  const sock = { send: t => inbox.push(JSON.parse(t)), close() {} };
  const h = core.connect(sock, ip);
  const c = {
    inbox, sock,
    send: m => h.message(JSON.stringify(m)),
    // 返事を待つ（req つきで送って、同じ t・req の返事が来るまで）
    async ask(t, m) {
      const req = Math.random(), n = inbox.length;
      c.send(Object.assign({ t, req }, m));
      for (let k = 0; k < 200; k++) { await wait(5); const r = inbox.slice(n).find(x => x.t === t && x.req === req); if (r) return r; }
      throw new Error('返事が来ない: ' + t + ' ' + JSON.stringify(m));
    },
    // 送って、決まった種類の返事を待つ（返事の t が送った t とちがうもの用）
    async call(m, type) { const n = inbox.length; c.send(m); return c.next(type, n); },
    // ある種類の知らせが来るまで待つ
    async next(t, from = 0) {
      for (let k = 0; k < 400; k++) { const r = inbox.slice(from).find(x => x.t === t); if (r) return r; await wait(5); }
      throw new Error('来ない: ' + t);
    }
  };
  return c;
}

// アカウントを作って、名前をつけ、大人の生年月日を登録したアプリ
export async function user(core, i, o = {}) {
  const c = client(core, 'ip' + i);
  c.send({ t: 'register', game: 'go' });
  const a = await c.next('account');
  c.id = a.id; c.pass = a.pass;
  c.send({ t: 'hello', cid: 'c' + i + '-' + Math.random(), name: o.name || 'P' + i });
  await wait(10);
  c.pid = (await core.store.get('acct:' + c.id)).pid;
  if (o.games !== false) await core.store.put('gd:' + c.id + ':go', { data: { prog: { games: 60 } }, at: 1 });
  await c.ask('soc', { op: 'birth', birth: o.birth || '1990-01-01' });
  return c;
}
export const guild = (c, op, m) => c.ask('guild', Object.assign({ op }, m || {}));
