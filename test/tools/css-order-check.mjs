// CSS を複数のファイルに分けたとき、見た目が変わらないかを確かめる道具
//   node test/tools/css-order-check.mjs <元の1ファイル> <分けたファイル1> <ファイル2> …（読みこむ順）
// CSS は「あとに書いたほうが勝つ」。分けて順番が入れかわった2つのルールが、
//   同じ部品に当たり・同じ性質（色など）に・ちがう値を書いていたら、見た目が変わる可能性がある → それを全部出す。
// 画面をいくつか開いて（ホーム・各画面）、そのときの部品で確かめる。
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const [oldFile, ...newFiles] = process.argv.slice(2);
const oldText = fs.readFileSync(oldFile, 'utf8'), newTexts = newFiles.map(f => fs.readFileSync(f, 'utf8'));
const PORT = 8990 + Math.floor(Math.random() * 100), URL0 = `http://localhost:${PORT}/`;
const server = spawn(process.execPath, ['server/dev.mjs'], { cwd: ROOT, env: Object.assign({}, process.env, { PORT: String(PORT) }), stdio: 'ignore' });
for (let i = 0; i < 100; i++) { try { if ((await fetch(URL0)).ok) break; } catch (e) {} await new Promise(r => setTimeout(r, 100)); }
const browser = await chromium.launch();
const found = new Map();

// ページの中で：ルールを並べ、順番が入れかわった「ぶつかりそうな組」を探す
function inPage({ oldText, newTexts }) {
  const flat = (sheet) => { const out = []; const walk = (rules, cond) => { for (const r of rules) { if (r.cssRules && !r.selectorText) walk(r.cssRules, cond + (r.conditionText || r.media && r.media.mediaText || '') + '|'); else if (r.selectorText) out.push({ r, cond }); else if (r.name && r.type === 7) out.push({ kf: r.name, text: r.cssText }); } }; walk(sheet.cssRules, ''); return out; };
  const mk = t => { const s = new CSSStyleSheet(); s.replaceSync(t); return s; };
  const oldRules = flat(mk(oldText));
  const pos = new Map();
  oldRules.forEach((x, i) => { const k = (x.cond || '') + (x.r ? x.r.cssText : x.text); if (!pos.has(k)) pos.set(k, []); pos.get(k).push(i); });
  const rules = []; let n = 0;
  newTexts.forEach((t, fi) => { for (const x of flat(mk(t))) { const k = (x.cond || '') + (x.r ? x.r.cssText : x.text); const o = (pos.get(k) || []).shift(); if (o == null) throw new Error('元にないルール: ' + k.slice(0, 80)); rules.push(Object.assign(x, { o, nw: n++, fi })); } });
  if (rules.length !== oldRules.length) throw new Error(`ルールの数がちがう ${oldRules.length} → ${rules.length}`);
  // 同じ名前のアニメーション（@keyframes）が2つ以上あると、順番で変わる
  const kfs = {}; const warn = [];
  for (const x of rules) if (x.kf) (kfs[x.kf] = kfs[x.kf] || []).push(x);
  for (const [k, l] of Object.entries(kfs)) if (l.length > 1) { const a = [...l].sort((p, q) => p.o - q.o), b = [...l].sort((p, q) => p.nw - q.nw); if (a[a.length - 1] !== b[b.length - 1]) warn.push('@keyframes ' + k + ' の勝つほうが変わる'); }
  // セレクタ → 当たる部品（:hover などは「当たるかもしれない」として外す）
  const cache = new Map();
  const targets = sel => {
    if (cache.has(sel)) return cache.get(sel);
    const res = new Map();   // 'pseudo' → Set(el)
    for (let s of sel.split(/,(?![^(]*\))/)) {
      s = s.trim(); let ps = '';
      const m = s.match(/::?(before|after|placeholder|marker|selection|backdrop|-webkit-[a-z-]+)$/); if (m) { ps = m[1]; s = s.slice(0, m.index); }
      let q = s.replace(/:(hover|active|focus-visible|focus-within|focus)(?![\w-])/g, '');
      if (!q || /[ >+~]$/.test(q)) q += '*';
      let els = []; try { els = document.querySelectorAll(q); } catch (e) { try { els = document.querySelectorAll(s || '*'); } catch (e2) { els = []; } }
      if (!res.has(ps)) res.set(ps, new Set());
      for (const e of els) res.get(ps).add(e);
    }
    cache.set(sel, res); return res;
  };
  // 性質ごとに、順番が入れかわった組
  const byProp = {};
  for (const x of rules) { if (!x.r) continue; const st = x.r.style; for (let i = 0; i < st.length; i++) { const p = st[i]; (byProp[p] = byProp[p] || []).push({ x, v: st.getPropertyValue(p), imp: st.getPropertyPriority(p) }); } }
  const hits = [];
  for (const [p, list] of Object.entries(byProp)) {
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j];
      if (a.v === b.v || a.imp !== b.imp) continue;
      if ((a.x.o < b.x.o) === (a.x.nw < b.x.nw)) continue;   // 順番はそのまま
      const ta = targets(a.x.r.selectorText), tb = targets(b.x.r.selectorText);
      let hit = null;
      for (const [ps, A] of ta) { const B = tb.get(ps); if (!B) continue; for (const e of A) if (B.has(e)) { hit = e; break; } if (hit) break; }
      if (hit) hits.push(`${p}: 「${a.x.cond}${a.x.r.selectorText}」(${a.v}) と 「${b.x.cond}${b.x.r.selectorText}」(${b.v})  ※${hit.tagName.toLowerCase()}${hit.id ? '#' + hit.id : ''}.${[...hit.classList].join('.')}`);
    }
  }
  return { hits, warn, rules: rules.length };
}

async function check(p, name) {
  const r = await p.evaluate(inPage, { oldText, newTexts });
  for (const h of r.hits.concat(r.warn)) if (!found.has(h)) found.set(h, name);
  return r.rules;
}
const ctx = await browser.newContext({ viewport: { width: 412, height: 915 } });
const p = await ctx.newPage();
await p.goto(URL0);
await p.evaluate(() => { localStorage.clear(); localStorage.setItem('kuro9.agree', '3'); });
await p.reload(); await p.waitForFunction(() => window.APP && window.APP.S);
await p.evaluate(() => { const S = window.APP.S; S.birth = '1990-01-01'; S.prog = { games: 60, seen: { haru: 1, rec: 1, av: 1, room: 1, kotto: 1, gk: 1 }, all: true, intro: true }; S.tutDone = { base: 1, pvp: 1, rec: 1, av: 1, room: 1, kotto: 1, gk: 1 }; window.APP.save(); });
await p.reload(); await p.waitForTimeout(800); await p.mouse.click(200, 120);
await p.waitForFunction(() => window.APP.online() && window.APP.S.acct, null, { timeout: 15000 }); await p.waitForTimeout(2000);
const n = await check(p, 'home');
const home = () => p.evaluate(() => { document.querySelector('#settings').hidden = true; window.APP.showScreen('home'); window.APP.renderHome(); });
for (const b of ['#openSolo', '#openRoom', '#openAvatar', '#openChara', '#openRecord', '#openFriends', '#openMail', '#openShop', '#openExplore', '#openHub', '#openDiary', '#openGift', '#openSettings', '#openGuild', '#startMatch']) {
  await home(); const el = await p.$(b); if (!el) continue;
  await el.evaluate(x => x.click()); await p.waitForTimeout(1200); await check(p, b);
}
await browser.close(); server.kill();
console.log(`ルール ${n} 個を確かめました`);
for (const [h, where] of found) console.log(`[${where}] ${h}`);
console.log(found.size ? `ぶつかる組 ${found.size}` : 'ぶつかる組なし（見た目は変わらない）');
process.exit(found.size ? 1 : 0);
