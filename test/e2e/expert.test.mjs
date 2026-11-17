// 経験者ではじめる：小春が「Botの強さ」を聞く → ソロモードで強さを変える場所を案内する
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const PORT = 8600 + Math.floor(Math.random() * 80);
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
  await p.evaluate(() => { window.APP.S.birth = '1990-01-01'; window.APP.save(); document.querySelectorAll('.agree-back').forEach(x => x.remove()); });
  await p.reload(); await p.waitForTimeout(800); await p.mouse.click(200, 120);
});
after(async () => { await browser.close(); server.kill(); });

test('経験者をえらぶと、名前とBotの強さを聞かれて、ソロモードで強さの場所を案内される', async () => {
  const said = [];
  for (let k = 0; k < 120; k++) {
    await p.waitForTimeout(400);
    if (await p.$('.sj .thx-in')) { await p.fill('.sj .thx-in', 'たろう'); await p.click('.sj [data-k="__in"]'); continue; }   // お名前
    if (await p.$('.sj .thx-opts [data-k]')) {
      if (await p.$('.sj [data-k="expert"]')) await p.click('.sj [data-k="expert"]', { timeout: 1500 }).catch(() => {});
      else if (await p.$('.sj [data-k="6"]')) await p.click('.sj [data-k="6"]', { timeout: 1500 }).catch(() => {});
      continue;
    }
    if (await p.$('.sj')) { await p.click('.sj', { position: { x: 200, y: 200 }, timeout: 1500 }).catch(() => {}); continue; }
    if (await p.$('.tut')) { said.push(await p.textContent('.tut')); await p.click('.tut', { position: { x: 30, y: 300 }, timeout: 1500 }).catch(() => {}); continue; }
    if (said.some(t => /強さを変えて/.test(t))) break;
  }
  assert.ok(said.some(t => /ここで選んだ強さのBot（いまは4級）/.test(t)), 'Botの強さの案内');
  assert.equal(await p.evaluate(() => window.APP.S.name), 'たろう', '名前を聞かれた');
  assert.deepEqual(await p.evaluate(() => [window.APP.S.solo.mode, window.APP.S.solo.bot, document.querySelector('#soloBot').value]), ['expert', 6, '6']);
});

test('エラーが出ていない', () => { assert.deepEqual(errors, []); });
