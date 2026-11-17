// 画面のテスト：本物のブラウザ（Chromium）で、手元のサーバーにつないで動かす
//   npm run test:e2e   （Playwright が必要）
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const PORT = 8790 + Math.floor(Math.random() * 100);
const URL0 = `http://localhost:${PORT}/`;
let server, browser;
const errors = [];

before(async () => {
  server = spawn(process.execPath, ['server/dev.mjs'], { cwd: ROOT, env: Object.assign({}, process.env, { PORT: String(PORT) }), stdio: 'ignore' });
  for (let i = 0; i < 100; i++) { try { if ((await fetch(URL0)).ok) break; } catch (e) {} await new Promise(r => setTimeout(r, 100)); }
  browser = await chromium.launch();
});
after(async () => { await browser.close(); server.kill(); });

// 同意ずみ・大人・チュートリアルずみ・50局以上のアプリ
async function open(tag, birth = '1990-01-01') {
  const p = await (await browser.newContext({ ...devices['Pixel 7'] })).newPage();
  p.on('pageerror', e => errors.push(`${tag}: ${e.message}`));
  await p.goto(URL0);
  await p.evaluate(() => { localStorage.clear(); localStorage.setItem('kuro9.agree', '3'); });
  await p.reload();
  await p.waitForFunction(() => window.APP && window.APP.S);
  await p.evaluate(bd => {
    const S = window.APP.S; S.birth = bd;
    S.prog = { games: 60, seen: { haru: 1, rec: 1, av: 1, room: 1, kotto: 1, gk: 1 }, all: true, intro: true };
    S.tutDone = { base: 1, pvp: 1, rec: 1, av: 1, room: 1, kotto: 1, gk: 1, chara: 1 };
    window.APP.save(); document.querySelectorAll('.agree-back').forEach(x => x.remove());
  }, birth);
  await p.mouse.click(200, 120);
  await p.waitForFunction(() => window.APP.online() && window.APP.S.acct && window.APP.S.acct.id, null, { timeout: 15000 });
  await p.waitForTimeout(3000);   // 進み具合がサーバーへ届くまで
  return p;
}
const screen = p => p.evaluate(() => [...document.querySelectorAll('.screen')].filter(x => !x.hidden).map(x => x.id).join(','));

test('ひらくとホームが出て、アカウントができる', async () => {
  const p = await open('home');
  assert.equal(await screen(p), 'home');
  assert.match(await p.evaluate(() => window.APP.S.acct.id), /^[A-Z0-9]{8}$/);
});

test('ランダムマッチで対局して、両方パスで終局できる', async () => {
  const A = await open('A'), B = await open('B');
  for (const p of [A, B]) { await p.click('#startMatch'); await p.waitForTimeout(400); await p.click('#goRandom'); }
  for (const p of [A, B]) await p.waitForFunction(() => !document.querySelector('#game').hidden, null, { timeout: 20000 });
  await A.waitForTimeout(3000);
  for (let k = 0; k < 6; k++) for (const p of [A, B]) {
    const btn = await p.$('#passBtn');
    if (btn && await btn.isVisible() && await btn.isEnabled()) {
      await btn.click().catch(() => {}); await p.waitForTimeout(300);
      const y = await p.$('#cfYes'); if (y && await y.isVisible()) await y.click();
      await p.waitForTimeout(600);
    }
  }
  for (const p of [A, B]) await p.waitForFunction(() => document.querySelector('#scorePanel') && !document.querySelector('#scorePanel').hidden, null, { timeout: 30000 });   // 整地の説明
  assert.match(await A.textContent('#scorePanel'), /石 \d+ ＋ 地 \d+/);
  await A.click('#spNext');
  for (const p of [A, B]) await p.waitForFunction(() => !document.querySelector('#result').hidden, null, { timeout: 30000 });
  // 「盤面を見る」で開いた整地の説明は、自分で「結果へ」を押すまで消えない
  await A.click('#resLook'); await A.waitForTimeout(7500);
  assert.equal(await A.evaluate(() => document.querySelector('#scorePanel').hidden), false);
  await A.click('#spNext');
  assert.equal(await A.evaluate(() => document.querySelector('#result').hidden), false);
});

test('碁会所を作って、看板のお店をひらける', async () => {
  const A = await open('G');
  await A.click('#openGuild'); await A.waitForTimeout(1000);
  await A.click('[data-act="make"]');
  for (let i = 0; i < 6 && !(await A.evaluate(() => !!window.GUILD.info())); i++) {
    await A.fill('#gfName', 'テスト会' + i); await A.fill('#gfShort', 'T');
    await A.click('[data-act="create"]'); await A.waitForTimeout(2000);
  }
  assert.ok(await A.evaluate(() => !!window.GUILD.info()), '碁会所ができた');
  await A.click('[data-act="signopen"]');
  assert.equal(await A.$$eval('[data-sign]', x => x.length), 11);
});

test('ショップに碁会所ショップのボタンがある', async () => {
  const A = await open('S');
  await A.evaluate(() => { window.APP.showScreen('shop'); window.SHOP.open(); });
  assert.ok(await A.isVisible('#shopGuild'));
});

test('設定からアカウントを削除できる', async () => {
  const A = await open('D');
  const id0 = await A.evaluate(() => window.APP.S.acct.id);
  await A.click('#openSettings');
  await A.click('#delAcct'); await A.click('#cfYes'); await A.waitForTimeout(400); await A.click('#cfYes');
  await A.waitForFunction(() => /削除しました/.test(document.body.textContent), null, { timeout: 10000 });
  assert.deepEqual(await A.evaluate(() => Object.keys(localStorage)), []);
  await A.reload();
  await A.waitForFunction(() => window.APP && window.APP.S.acct && window.APP.S.acct.id, null, { timeout: 15000 });
  assert.notEqual(await A.evaluate(() => window.APP.S.acct.id), id0, '最初からやりなおし');
});

test('プレゼントを受け取って、家具を買える（サーバーが正）', async () => {
  const p = await open('buy');
  const got = await p.evaluate(() => new Promise(r => window.APP.giftReq({ t: 'gifttake', id: 'all' }, m => r(m.got))));
  assert.ok(got >= 3000, 'はじめてのプレゼント');
  await p.waitForFunction(() => window.APP.S.zeni >= 3000);
  const before = await p.evaluate(() => window.APP.S.room.ownedItems.zaisu | 0);
  const res = await p.evaluate(() => new Promise(r => window.APP.buy({ item: 'zaisu' }, 0, r)));
  assert.equal(res.ok, true);
  assert.equal(await p.evaluate(() => window.APP.S.room.ownedItems.zaisu | 0), before + 1);
});

test('ホームの「今日のミッション」をひらける（5つ＋ぜんぶクリア）', async () => {
  const p = await open('dm');
  assert.equal(await p.textContent('#dmCount'), '0/5');
  await p.click('#homeDm');
  await p.waitForFunction(() => document.querySelectorAll('#dmList li').length === 6);
  assert.match(await p.textContent('#dmList'), /アタリを100回/);
  await p.click('#dmClose');
});

test('新しいキャラの知らせは、結果画面の裏では出さず、ホームで出す（「行く」で移動できる）', async () => {
  const p = await open('chara');
  await p.evaluate(() => {
    const S = window.APP.S; S.charaOpenN = window.ART.VARIANTS.length - 99;   // まだ知らせていない、ことにする
    S.charaBuy = ['shima']; document.querySelector('#result').hidden = false; window.APP.renderHome();
  });
  await p.waitForTimeout(1300);
  assert.ok(await p.evaluate(() => document.querySelector('#confirm').hidden), '結果画面の裏では聞かない');
  await p.evaluate(() => { document.querySelector('#result').hidden = true; window.APP.showScreen('home'); window.APP.renderHome(); });
  await p.waitForSelector('#confirm:not([hidden])', { timeout: 3000 });
  await p.click('#cfYes'); await p.waitForTimeout(400);
  assert.equal(await screen(p), 'chara');
});

test('はじめて仲間が増えたとき（静馬のあと）は、小春がキャラクター選択を案内する', async () => {
  const p = await open('charaGuide');
  await p.evaluate(() => { const S = window.APP.S; delete S.tutDone.chara; S.charaGot = (S.charaGot || []).concat('hinata'); S.charaOpenN = 1; window.APP.save(); window.APP.renderHome(); });
  await p.waitForFunction(() => /仲間になりました/.test((document.querySelector('.tut') || {}).textContent || ''), null, { timeout: 10000 });
});

test('一度開放したキャラは、降格しても開いたまま（もう一度知らせない）', async () => {
  const p = await open('demote');
  const r = await p.evaluate(() => {
    const S = window.APP.S, i = window.ART.VARIANTS.findIndex(v => v.key === 'hinata');
    S.charaGot = ['koharu', 'hinata'];   // 前に8級まで上がって、ひなたを開放した（今は降格して10級）
    S.charaOpenN = window.ART.VARIANTS.filter((v, j) => window.APP.charaOpen(j)).length;   // そのとき知らせた
    window.APP.showScreen('home'); window.APP.renderHome();
    return { open: window.APP.charaOpen(i), n: S.charaOpenN };
  });
  assert.equal(r.open, true);
  await p.waitForTimeout(1200);
  await p.evaluate(() => { window.APP.renderHome(); });
  await p.waitForTimeout(1200);
  assert.ok(await p.evaluate(() => document.querySelector('#confirm').hidden), '同じキャラをもう一度は知らせない');
});

test('中押し：「盤面を見る」で形勢（推定）と投了の理由。石をタップすると、その石だけ残して検討できる', async () => {
  const p = await open('resign');
  await p.evaluate(() => { window.APP.S.settings.confirm = false; window.APP.startSoloGame(0, { done() {}, back() {} }); });
  await p.waitForFunction(() => !document.querySelector('#game').hidden);
  const tapAt = async (x, y) => { const r = await p.$eval('#board', b => { const q = b.getBoundingClientRect(); return [q.left, q.top, q.width]; }); await p.mouse.click(r[0] + (x + .65) / 9.3 * r[2], r[1] + (y + .65) / 9.3 * r[2]); };
  const stones = () => p.$$eval('#stones .stone', a => a.length);
  for (const [x, y] of [[2, 2], [6, 6], [2, 6], [6, 2], [4, 4]]) {
    const n = await stones(); await tapAt(x, y);
    await p.waitForFunction(n => document.querySelectorAll('#stones .stone').length >= n + 2, n, { timeout: 20000 }).catch(() => {});
  }
  await p.click('#resignBtn'); await p.click('#cfYes');
  await p.waitForFunction(() => !document.querySelector('#result').hidden, null, { timeout: 10000 });
  await p.click('#resLook');
  await p.waitForFunction(() => /リード|互角/.test(document.querySelector('#scorePanel').textContent), null, { timeout: 20000 });
  assert.match(await p.textContent('#scorePanel'), /あなた（.）が投了しました/);
  // 相手の石をタップ → その石（つながりごと）と、自分の石だけで検討
  const pt = await p.evaluate(() => { const b = [...document.querySelectorAll('#stones .stone circle:nth-child(2)')].map(c => [c.getAttribute('cx'), c.getAttribute('cy'), c.getAttribute('fill')]); return b; });
  // 自分は黒か白か：自分の最初の手 (2,2) の色
  const mine = /あなた（黒）/.test(await p.textContent('#scorePanel')) ? 'url(#gB)' : 'url(#gW)';
  const other = pt.find(s => s[2] !== mine);
  await tapAt(+other[0] - .5, +other[1] - .5);
  assert.equal(await p.evaluate(() => document.querySelector('#spStudy').hidden), false);
  await p.click('#spStudy');
  await p.waitForFunction(() => !document.querySelector('#rvTop').hidden);
  const fills = await p.$$eval('#stones .stone circle:nth-child(2)', a => a.map(c => c.getAttribute('fill')));
  assert.equal(fills.filter(f => f === mine).length, pt.filter(s => s[2] === mine).length, '自分の石はぜんぶ残る');
  assert.ok(fills.filter(f => f !== mine).length >= 1 && fills.filter(f => f !== mine).length < pt.filter(s => s[2] !== mine).length, '相手の石は、えらんだ石だけ');
  await p.click('#rvClose');
  await p.waitForFunction(() => !document.querySelector('#result').hidden, null, { timeout: 5000 });
});

test('ライバル台詞は、障子が開いてキャラが話す（3勝：「もちろん！」→ あと2勝で来る）', async () => {
  const p = await open('rivalScene');
  await p.evaluate(() => window.APP.rivalSay('hinata', 'w3'));
  await p.waitForSelector('.sj.doors.hinata', { timeout: 5000 });
  for (let k = 0; k < 30 && !(await p.$('.sj [data-k="ok"]')); k++) { await p.click('.sj', { position: { x: 200, y: 200 }, timeout: 1500 }).catch(() => {}); await p.waitForTimeout(300); }
  await p.click('.sj [data-k="ok"]');
  await p.waitForFunction(() => /あと2回勝ったら/.test((document.querySelector('.sj .thx-t') || {}).textContent || ''), null, { timeout: 8000 });
  for (let k = 0; k < 20 && await p.$('.sj'); k++) { await p.click('.sj', { position: { x: 200, y: 200 }, timeout: 1500 }).catch(() => {}); await p.waitForTimeout(400); }
  assert.equal(await p.$('.sj'), null);
});

test('ライバル台詞が8人ぶん・4場面そろっている', async () => {
  const p = await open('rv');
  const ok = await p.evaluate(() => window.ART.VARIANTS.every(v => ['w3', 'w5', 'strong', 'rival', 'catch'].every(k => window.RIVAL_LINES[v.key] && window.RIVAL_LINES[v.key][k])));
  assert.ok(ok);
});

test('運営画面：合言葉を入れるまで中が見えない', async () => {
  const p = await open('admin');
  // サーバーの返事のかわり（このテストのサーバーには部屋番号 561149 の人がいないので）
  await p.evaluate(() => {
    let ok = false; window.__calls = [];
    window.APP.admin = (op, data, cb) => { window.__calls.push(op); setTimeout(() => {
      if (op === 'unlock') { ok = data.key === 'correct-key'; cb(ok ? { ok: true } : { ok: false, reason: 'key', left: 4 }); return; }
      cb(ok ? { ok: true, soc: [], mail: [] } : { ok: false, reason: 'lock' });
    }, 10); };
    window.ADMIN.open();
  });
  await p.waitForSelector('#adKey');
  assert.match(await p.textContent('#adBody'), /合言葉を入れてください/);
  await p.fill('#adKey', 'wrong'); await p.click('[data-unlock]');
  await p.waitForFunction(() => /合言葉がちがいます/.test(document.querySelector('#adBody').textContent));
  assert.match(await p.textContent('#adBody'), /あと4回/);
  await p.fill('#adKey', 'correct-key'); await p.press('#adKey', 'Enter');
  await p.waitForFunction(() => /メッセージの通報/.test(document.querySelector('#adBody').textContent));
  assert.equal(await p.$('#adKey'), null);
});

test('おもな画面をひととおり開ける（エラーが出ない）', async () => {
  const p = await open('tour');
  const home = async () => { await p.evaluate(() => { document.querySelectorAll('.overlay, .modal, #settings').forEach(x => { if (x.id === 'settings') x.hidden = true; }); window.APP.showScreen('home'); window.APP.renderHome(); }); await p.waitForTimeout(300); };
  // ホームのボタン → 開いた画面
  const tour = [['#openSolo', 'solo'], ['#openRoom', 'myroom'], ['#openAvatar', 'avatar'], ['#openChara', 'chara'], ['#openRecord', 'record'], ['#openDiary', null], ['#openFriends', 'friends'], ['#openMail', 'mail'], ['#openShop', 'shop'], ['#openExplore', 'explore'], ['#openHub', 'hub'], ['#openGift', null], ['#openSettings', null]];
  for (const [btn, scr] of tour) {
    await home();
    const b = await p.$(btn);
    if (!b || !(await b.isVisible())) continue;
    await b.evaluate(x => x.click()); await p.waitForTimeout(700);
    if (scr) assert.equal(await screen(p), scr, btn + ' で ' + scr + ' が開く');
  }
  // ショップの中のお店
  await home(); await p.evaluate(() => { window.APP.showScreen('shop'); window.SHOP.open(); });
  for (const b of ['#shopAvatar', '#shopRoom', '#shopKotto']) {
    await p.evaluate(() => { window.APP.showScreen('shop'); window.SHOP.open(); }); await p.waitForTimeout(300);
    const el = await p.$(b); if (el && await el.isVisible()) { await el.evaluate(x => x.click()); await p.waitForTimeout(2500); await p.mouse.click(200, 400); await p.waitForTimeout(600); }
  }
});

test('画面でエラーが出ていない', () => {
  assert.deepEqual(errors, []);
});
