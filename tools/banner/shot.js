const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1200, height: 560 } })).newPage();
  for (const n of process.argv.slice(2)) { await p.goto('file:///home/claude/bm/banner/' + n + '.html'); await p.waitForTimeout(500); await p.screenshot({ path: n + '.png' }); }
  await b.close(); })();
