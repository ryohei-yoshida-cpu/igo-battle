// はじめての人の流れ：目標の表示 → 巴 → ひなた → 静馬 → 玄斎 と、特別ミッションの「やってみよう」案内を、本当にさわって進める
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const PORT = 8700 + Math.floor(Math.random() * 80);
const URL0 = `http://localhost:${PORT}/`;
let server, browser, p;
const errors = [];

before(async () => {
  server = spawn(process.execPath, ['server/dev.mjs'], { cwd: ROOT, env: Object.assign({}, process.env, { PORT: String(PORT) }), stdio: 'ignore' });
  for (let i = 0; i < 100; i++) { try { if ((await fetch(URL0)).ok) break; } catch (e) {} await new Promise(r => setTimeout(r, 100)); }
  browser = await chromium.launch();
  p = await (await browser.newContext({ ...devices['Pixel 7'] })).newPage();
  p.on('pageerror', e => errors.push(e.message));
  await p.goto(URL0);
  await p.evaluate(() => { localStorage.clear(); localStorage.setItem('kuro9.agree', '3'); });
  await p.reload();
  await p.waitForFunction(() => window.APP && window.APP.S);
  // 初心者：小春の登場・はじめの案内・春告げは済み。対局はまだ0局
  await p.evaluate(() => {
    const S = window.APP.S; S.birth = '1990-01-01';
    S.prog = { games: 0, seen: { haru: 1 }, all: false, intro: true };
    S.tutDone = { base: 1, pvp: 1, rec: 1, room: 1, gk: 1 };
    S.solo.mode = 'beginner'; S.solo.read = { haru: true };
    window.APP.save(); document.querySelectorAll('.agree-back').forEach(x => x.remove());
  });
  await p.reload(); await p.waitForTimeout(800); await p.mouse.click(200, 120);
  await p.waitForFunction(() => window.APP.online() && window.APP.S.acct, null, { timeout: 15000 });
  // 銭：はじめてのプレゼントを受けとる
  await p.evaluate(() => new Promise(r => window.APP.giftReq({ t: 'gifttake', id: 'all' }, r)));
  await p.waitForTimeout(1500);
});
after(async () => { await browser.close(); server.kill(); });

const goals = () => p.evaluate(() => [...document.querySelectorAll('#goalBox .goal')].map(b => b.textContent.replace(/\s+/g, ' ').trim()));
// キャラの登場シーンを、最後までタップして進める（えらぶボタンがあれば、さいしょの）
async function through(ms = 30000) {
  const t0 = Date.now();
  await p.waitForSelector('.sj', { timeout: 10000 });
  await p.waitForTimeout(1800);   // 障子が開くまで
  while (await p.$('.sj')) {
    if (Date.now() - t0 > ms) throw new Error('シーンが終わらない');
    const opt = await p.$('.sj .thx-opts [data-k]');
    if (opt) await opt.click({ timeout: 1500 }).catch(() => {}); else await p.click('.sj', { position: { x: 200, y: 200 }, timeout: 1500 }).catch(() => {});
    await p.waitForTimeout(250);
  }
}
// 案内の「タップで次へ」を進めて、「やってみよう」（光っている場所）になったら、そこを押す
const tapTut = () => p.click('.tut', { position: { x: 30, y: 300 }, timeout: 1500 }).catch(() => {});
async function guideTap(sel) {
  for (let k = 0; k < 40; k++) {
    if (await p.evaluate(s => { const t = document.querySelector('.tut.live:not(.away)'); return !!t && !!document.querySelector(s); }, sel)) break;
    if (await p.$('.sj')) { await through(); continue; }
    if (await p.$('.tut')) await tapTut(); else await p.waitForTimeout(300);
    await p.waitForTimeout(250);
  }
  await p.waitForTimeout(500);
  await p.click(sel, { timeout: 8000 });
  await p.waitForTimeout(600);
}
async function confirmYes() { await p.waitForSelector('#confirm:not([hidden])', { timeout: 8000 }); await p.click('#cfYes'); await p.waitForTimeout(500); }
// 案内が終わるまで（最後のセリフをタップ）
async function guideEnd() {
  for (let k = 0; k < 40 && await p.$('.tut'); k++) {
    if (await p.$('.sj')) { await through(); continue; }
    if (await p.$('#confirm:not([hidden])')) { await p.click('#cfNo'); continue; }
    await tapTut(); await p.waitForTimeout(300);
  }
  assert.equal(await p.$('.tut'), null, '案内が終わった');
}
const games = n => p.evaluate(n => { window.APP.S.prog.games = n; window.APP.save(); window.PROG.check(); }, n);

test('はじめ：初心者ミッションと共通ミッションが出る', async () => {
  const g = await goals();
  assert.match(g[0], /初心者ミッション.*幽玄の間の約束/);
  assert.match(g[1], /共通ミッション.*あと 3 局で 巴/);
});

test('九路の剣客まで読むと「アタリ碁を打ってみよう」。キャラのエピソードはまだ読めない', async () => {
  await p.evaluate(() => { Object.assign(window.APP.S.solo.read, { yugen: true, kenkaku: true }); window.APP.save(); window.APP.renderHome(); });
  assert.match((await goals())[0], /アタリ碁を打ってみよう（あと 3 回）/);
  await p.evaluate(() => window.SOLO.open()); await p.waitForTimeout(400);
  assert.match(await p.textContent('#storyList'), /巴に会うと読めます/);
  await p.evaluate(() => { window.APP.showScreen('home'); window.APP.renderHome(); });
});

test('3回打ったら「アタリ碁を打ってみよう」は消える（押してもう1局はじまらない）。キャラクターミッションもまだ出ない', async () => {
  await p.evaluate(() => { window.APP.S.prog.games = 3; window.APP.save(); window.APP.renderHome(); });
  const g = await goals();
  assert.equal(g.length, 1); assert.match(g[0], /巴がやってくる/);
});

test('3局：巴 →「戦歴を見てみよう」→ お駄賃の扇子 →「クロークで扇子を持ってみよう」', async () => {
  await games(3); await through();
  assert.match((await goals())[0], /特別ミッション.*戦歴/);
  await guideTap('#openRecord');
  await through();   // 巴：お駄賃
  await p.waitForFunction(() => (window.APP.S.avOwned || []).includes('tool:t13'), null, { timeout: 8000 });
  // 扇子を持つ：ルーム → クローク → 道具 → 扇子 → この姿にする
  await guideTap('#openHub');
  await guideTap('#openAvatar');
  await guideTap('#avTabs [data-slot="tool"]').catch(() => {});
  await guideTap('#avGrid2 [data-sl="tool"][data-id="t13"]');
  await guideTap('#avSave');
  await guideEnd();
  assert.equal(await p.evaluate(() => window.APP.S.av.tool), 't13');
  assert.equal(await p.evaluate(() => window.APP.S.sp || null), null);
  await p.evaluate(() => window.SOLO.open()); await p.waitForTimeout(400);
  assert.doesNotMatch(await p.textContent('#storyList'), /巴に会うと読めます/, 'ひなたのエピソードが読める');
  await p.evaluate(() => { window.APP.showScreen('home'); window.APP.renderHome(); });
  assert.match((await goals())[0], /ひなたの夏祭り/);
});

test('ひなたのエピソードを読むと、ひなたが来る（お祝い300銭）→ 服ショップでネオンパーカーを買う', async () => {
  const z0 = await p.evaluate(() => window.APP.S.zeni);
  await p.evaluate(() => { window.APP.S.solo.read.ep_hinata = true; window.APP.save(); window.PROG.check(); });
  await through();
  await p.waitForFunction(z => window.APP.S.zeni >= z + 300, z0, { timeout: 8000 });
  await guideTap('#openShop');
  await guideTap('#shopAvatar');
  if (await p.$('.sj')) await through();   // ひなたの「いらっしゃい」
  await guideTap('#avTabs [data-slot="body"]').catch(() => {});
  await guideTap('#avGrid2 [data-sl="body"][data-id="b05"]');
  await p.click('#avGrid2 [data-sl="body"][data-id="b05"]');   // もう一度で買う
  await confirmYes();
  await p.waitForTimeout(800); if (await p.$('.sj')) await through();   // お礼
  if (await p.$('#confirm:not([hidden])')) await p.click('#cfNo');   // 着がえる？
  await guideEnd();
  assert.ok(await p.evaluate(() => window.APP.S.avOwned.includes('body:b05')));
});

test('10局：静馬（800銭のクーポン）→ 碁盤を買う → もようがえで置く', async () => {
  await p.evaluate(() => { window.APP.showScreen('home'); });
  await games(10); await through();
  await guideTap('#openHub');
  await guideTap('#openRoom');
  await guideTap('#roomDock [data-dock="shop"]');
  await guideTap('#rsNav [data-kind="floor"]').catch(() => {});
  await guideTap('#rsGrid [data-try="goban"]');
  await guideTap('#rsCart .rs-buy');
  await confirmYes();
  await p.waitForTimeout(800); if (await p.$('.sj')) await through();
  if (await p.$('#confirm:not([hidden])')) await p.click('#cfNo');   // いいえ：倉庫へ（このあと自分で置く）
  await guideEnd();
  assert.ok(await p.evaluate(() => (window.APP.S.room.ownedItems.goban | 0) >= 1));
  // 置こう
  await guideTap('#roomDock [data-dock="edit"]');
  await guideTap('[data-place="goban"]');
  await guideTap('.rm-edit-h [data-dock="edit"]');
  await guideEnd();
  assert.ok(await p.evaluate(() => window.ROOM.state().placed('goban') >= 1));
  assert.equal(await p.evaluate(() => window.APP.S.sp || null), null);
});

test('20局：玄斎がドライフラワーを投げ捨てる → 骨董屋で売る', async () => {
  await p.evaluate(() => { window.APP.showScreen('home'); });
  await games(20); await through();
  await p.waitForFunction(() => (window.APP.S.room.ownedItems.w_dryflower | 0) >= 1, null, { timeout: 8000 });
  await guideTap('#openShop');
  await guideTap('#shopKotto');
  if (await p.$('.sj')) await through();
  await guideTap('#kottoGrid [data-sell-item="w_dryflower"]');
  await confirmYes();
  await p.waitForTimeout(800); if (await p.$('.sj, .ff')) await through().catch(() => {});
  await guideEnd();
  assert.equal(await p.evaluate(() => window.APP.S.room.ownedItems.w_dryflower | 0), 0);
  assert.equal(await p.evaluate(() => window.PROG.isOpen('kotto')), true);
});

test('骨董屋から30局で碁会所。闇落ち玄斎まで読むとキャラクターミッション', async () => {
  await p.evaluate(() => { window.APP.showScreen('home'); });
  assert.equal(await p.evaluate(() => window.PROG.ready('gk')), false);
  await p.evaluate(() => { window.APP.S.prog.games = 49; });
  assert.equal(await p.evaluate(() => window.PROG.ready('gk')), false);
  await p.evaluate(() => { window.APP.S.prog.games = 50; });
  assert.equal(await p.evaluate(() => window.PROG.ready('gk')), true);
  await p.evaluate(() => { for (const id of ['ep_shima', 'ep_tomoe', 'ep_mike', 'ep_tono', 'ep_dgensai']) window.APP.S.solo.read[id] = true; window.APP.renderHome(); });
  assert.match((await goals())[0], /キャラクターミッション.*みけ＆こむぎ（10級）に3勝/);
});

test('エラーが出ていない', () => { assert.deepEqual(errors, []); });
