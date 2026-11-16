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
    S.tutDone = { base: 1, pvp: 1, rec: 1, av: 1, room: 1, kotto: 1, gk: 1 };
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
  assert.match(await p.textContent('#dmList'), /アタリを20回/);
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

test('ライバル台詞が8人ぶん・4場面そろっている', async () => {
  const p = await open('rv');
  const ok = await p.evaluate(() => window.ART.VARIANTS.every(v => ['w3', 'strong', 'rival', 'catch'].every(k => window.RIVAL_LINES[v.key] && window.RIVAL_LINES[v.key][k])));
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
