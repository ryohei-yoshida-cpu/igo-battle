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
    const S = window.APP.S; S.birth = '1990-01-01'; S.loginSeen = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);   // ログインボーナスの表は、テストでは出さない（別のテストで確かめる）
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
// ミッションクリアのハンコ：見えたらタップでとじる
async function stampClose() { if (await p.$('#fxStamp:not([hidden])')) { await p.waitForTimeout(1300); await p.click('#fxStamp', { timeout: 1500 }).catch(() => {}); await p.waitForTimeout(400); return true; } return false; }
let stamps = 0;
// キャラの登場シーンを、最後までタップして進める（えらぶボタンがあれば、さいしょの）
async function through(ms = 30000) {
  const t0 = Date.now();
  for (let k = 0; k < 20 && !await p.$('.sj'); k++) { if (await stampClose()) stamps++; else await p.waitForTimeout(500); }
  await p.waitForSelector('.sj', { timeout: 5000 });
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
    if (await stampClose()) { stamps++; continue; }
    if (await p.evaluate(s => { const t = document.querySelector('.tut.live:not(.away)'); return !!t && !!document.querySelector(s); }, sel)) break;
    if (await p.$('.sj')) { await through(); continue; }
    if (await p.$('.tut.away') && await p.$('.ff')) { await p.click('.ff', { position: { x: 200, y: 300 }, timeout: 1500 }).catch(() => {}); await p.waitForTimeout(400); continue; }   // お店の人のあいさつなど
    if (await p.$('.tut')) await tapTut(); else await p.waitForTimeout(300);
    await p.waitForTimeout(250);
  }
  await p.waitForTimeout(500);
  await p.click(sel, { timeout: 8000 });
  await p.waitForTimeout(600);
}
// お店の人のお礼など（.ff）：タップでとじる
async function ffClose() { if (!(await p.$('.ff'))) return false;
  const btn = await p.$('.ff-clerk [data-a="no"]') || await p.$('.ff-clerk [data-a]');   // 玄斎の「これも持っていくかい？」（ときどき出る）
  if (btn) { await p.waitForTimeout(400); await btn.click({ timeout: 1500 }).catch(() => {}); await p.waitForTimeout(500); return true; } await p.click('.ff', { position: { x: 200, y: 300 }, timeout: 1500 }).catch(() => {}); await p.waitForTimeout(500); return true; }
async function confirmYes() { await p.waitForSelector('#confirm:not([hidden])', { timeout: 8000 }); await p.click('#cfYes'); await p.waitForTimeout(500); }
// 案内が終わるまで（最後のセリフをタップ）
async function guideEnd() {
  for (let k = 0; k < 40 && await p.$('.tut'); k++) {
    if (await p.$('.sj')) { await through(); continue; }
    if (await p.$('#confirm:not([hidden])')) { await p.click('#cfNo'); continue; }
    if (await stampClose()) { stamps++; break; }   // クリアのハンコ（このあと次の案内がはじまることがある）
    await tapTut(); await p.waitForTimeout(300);
  }
  for (let k = 0; k < 20; k++) { if (await stampClose()) { stamps++; break; } await p.waitForTimeout(300); }   // ゆっくりのパソコンでも、ハンコが出るまで待つ
}
const games = n => p.evaluate(n => { window.APP.S.prog.games = n; window.APP.save(); window.PROG.check(); }, n);

test('はじめ：初心者ミッションと共通ミッションが出る', async () => {
  const g = await goals();
  assert.match(g[0], /初心者ミッション.*幽玄の間の約束/);
  assert.match(g[1], /共通ミッション.*対人戦メニューで 3 局打ってみよう.*0\/3/);
  assert.doesNotMatch(g.join(), /巴|ひなた|静馬/, 'だれが来るかは出さない');
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
  assert.equal(g.length, 1); assert.match(g[0], /だれかが来たみたい/);
});

test('3局：巴 →「戦歴を見てみよう」→ お駄賃の扇子 → 3局あと「クロークで扇子を持ってみよう」', async () => {
  await games(3); await through();
  assert.match((await goals())[0], /特別ミッション.*戦歴/);
  await guideTap('#openRecord');
  await through();   // 巴：お駄賃
  await p.waitForFunction(() => (window.APP.S.avOwned || []).includes('tool:t13'), null, { timeout: 8000 });
  await guideEnd();
  // 扇子に着がえる案内は、3局あと
  await p.evaluate(() => { window.APP.showScreen('home'); });
  await games(5); await p.waitForTimeout(1200);
  assert.equal(await p.$('.tut'), null, '2局ではまだ');
  await games(6); await p.waitForTimeout(800);
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

test('14局：静馬（800銭のクーポン）→ 碁盤を試し置きして、場所を選んで買う → 小春：座布団を置く', async () => {
  await p.evaluate(() => { window.APP.showScreen('home'); });
  await games(14); await through();
  await guideTap('#openHub');
  await guideTap('#openRoom');
  await guideTap('#roomDock [data-dock="shop"]');
  await guideTap('#rsNav [data-kind="floor"]').catch(() => {});
  await guideTap('#rsGrid [data-try="goban"]');
  // 場所を選ぶ：案内のあいだも、部屋の碁盤をドラッグできる（まわりがふさがれていない）
  await p.waitForFunction(() => /ドラッグして選べる/.test((document.querySelector('.tut-say') || {}).textContent || '') && [...document.querySelectorAll('.tut-block')].every(b => parseFloat(b.style.width || '0') === 0), null, { timeout: 8000 });   // 自由にさわれる
  await guideTap('#rsCart .rs-buy');
  await confirmYes();
  await p.waitForTimeout(800); if (await p.$('.sj')) await through();
  if (await p.$('#confirm:not([hidden])')) await p.click('#cfYes');   // 今の模様替え（選んだ場所）を反映
  await guideEnd();
  assert.ok(await p.evaluate(() => window.ROOM.state().placed('goban') >= 1), '選んだ場所に碁盤');
  // 小春：座布団（はじめから持っている）を置く
  await guideTap('#roomDock [data-dock="edit"]');
  await guideTap('[data-place="zabuton"]');
  await guideTap('.rm-edit-h [data-dock="edit"]');
  await guideEnd();
  assert.ok(await p.evaluate(() => window.ROOM.state().placed('zabuton') >= 1));
  assert.equal(await p.evaluate(() => window.APP.S.sp || null), null);
  assert.equal(await p.evaluate(() => !!(window.APP.S.tutDone && window.APP.S.tutDone.room)), true, 'マイルームの案内はしない（済みにする）');
});

test('静馬から5局：小春が囲碁日記をすすめる → 勝った対局の棋譜をえらんで、日記をつける', async () => {
  await p.evaluate(() => { window.APP.showScreen('home'); const S = window.APP.S; S.history = [{ win: false, rec: [40, 41], size: 9, op: 'Bot A', t: Date.now(), color: 1 }, { win: true, rec: [40, 41, 30], size: 9, op: 'Bot B', t: Date.now() - 1000, color: 1 }].concat(S.history || []); window.APP.save(); });
  await games(18); await p.waitForTimeout(1500);
  assert.equal(await p.$('.sj'), null, '4局ではまだ');
  await games(19); await through();
  await guideTap('#homeDiary');
  await p.waitForTimeout(2600);   // 日記帳がひらく
  await guideTap('#bkKifu [data-pick]');
  await guideTap('#kpList [data-k="1"]');   // いちばん新しい勝ち（2つ目）
  assert.match(await p.textContent('#bkKifu'), /棋譜を外す/);
  await p.fill('#bkTitle', 'はじめての日記'); await p.fill('#bkText', '石を取れてうれしかった。');
  await p.click('.bk-btns [data-save]');
  await p.waitForSelector('.bk-in.read', { timeout: 10000 });
  await guideEnd();
  assert.equal(await p.evaluate(() => window.APP.S.sp || null), null);
  await p.evaluate(() => { const c = document.querySelector('.bk-btns [data-close], [data-close]'); if (c) c.click(); window.APP.showScreen('home'); });
});

test('25局：玄斎がドライフラワーを投げ捨てる → 骨董屋で売る', async () => {
  await p.evaluate(() => { window.APP.showScreen('home'); });
  await games(25); await through();
  await p.waitForFunction(() => (window.APP.S.room.ownedItems.w_dryflower | 0) >= 1, null, { timeout: 8000 });
  await guideTap('#openShop');
  await guideTap('#shopKotto');
  if (await p.$('.sj')) await through();
  await guideTap('#kottoGrid [data-sell-item="w_dryflower"]');
  await confirmYes();
  await p.waitForTimeout(800); if (await p.$('.sj')) await through().catch(() => {}); else await ffClose();
  await guideEnd();
  for (let k = 0; k < 80 && await p.evaluate(() => !!window.APP.S.sp); k++) { if (await stampClose()) stamps++; else if (await p.$('.sj')) await through().catch(() => {}); else if (await ffClose()) continue; else if (await p.$('#confirm:not([hidden])')) await p.click('#cfNo').catch(() => {}); else if (await p.$('.tut:not(.away)')) { await tapTut(); await p.waitForTimeout(300); } else await p.waitForTimeout(300); }
  const why = await p.evaluate(() => JSON.stringify({ sp: window.APP.S.sp, flower: window.APP.S.room.ownedItems.w_dryflower | 0, tut: ((document.querySelector('.tut') || {}).className || '') + ' ' + ((document.querySelector('.tut-say') || {}).textContent || '').slice(0, 50), mod: [...document.querySelectorAll('#confirm:not([hidden]), .sj, .ff, #fxStamp:not([hidden]), #giftBox:not([hidden])')].map(x => x.id + '.' + x.className + ' ' + (x.textContent || '').slice(0, 40)).join('|'), scr: [...document.querySelectorAll('.screen')].filter(x => !x.hidden).map(x => x.id).join(), busy: window.PROG.busy() }));
  assert.equal(await p.evaluate(() => window.APP.S.sp || null), null, '特別ミッションが終わった ' + why);
  assert.equal(await p.evaluate(() => window.APP.S.room.ownedItems.w_dryflower | 0), 0);
  assert.equal(await p.evaluate(() => window.PROG.isOpen('kotto')), true);
});

test('骨董屋から30局で碁会所。闇落ち玄斎まで読むとキャラクターミッション', async () => {
  await p.evaluate(() => { window.APP.showScreen('home'); });
  assert.equal(await p.evaluate(() => window.PROG.ready('gk')), false);
  await p.evaluate(() => { window.APP.S.prog.games = 54; });
  assert.equal(await p.evaluate(() => window.PROG.ready('gk')), false);
  await p.evaluate(() => { window.APP.S.prog.games = 55; });
  assert.equal(await p.evaluate(() => window.PROG.ready('gk')), true);
  await p.evaluate(() => { for (const id of ['ep_shima', 'ep_tomoe', 'ep_mike', 'ep_tono', 'ep_dgensai']) window.APP.S.solo.read[id] = true; window.APP.renderHome(); });
  assert.match((await goals())[0], /キャラクターミッション.*（10級）に3勝/);
});

test('特別ミッションをクリアするたびに「クリア」のハンコが出た', () => { assert.ok(stamps >= 6, 'ハンコ ' + stamps); });

test('エラーが出ていない', () => { assert.deepEqual(errors, []); });
