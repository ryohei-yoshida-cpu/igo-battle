/* 九路 Blitz — イラストと演出（和）
 * キャラクター（画像）、幽玄の間の背景、桜吹雪、タップの光。 */
(function () {
  'use strict';

  /* ================= キャラクター ================= */
  // 画像は img/ フォルダ。<名前>.jpg が上半身、<名前>_face.jpg が顔。
  // kind は口調（小春＝明るい少女／玄斎＝けだるい師匠）を選ぶのに使う。
  const VARIANTS = [
    { key: 'koharu', name: '小春', kind: 'koharu', note: '囲碁好きの看板娘' },
    { key: 'gensai', name: '玄斎', kind: 'gensai', note: 'けだるい師匠' },
    { key: 'hinata', name: 'ひなた', kind: 'koharu', note: 'にぎやか担当' },
    { key: 'shima', name: '静馬', kind: 'koharu', note: '片眼鏡の書生' },
    { key: 'tomoe', name: '巴', kind: 'koharu', note: '女武者' },
    { key: 'mike', name: 'みけ＆こむぎ', kind: 'koharu', note: '猫と柴の門下生' },
    { key: 'tono', name: '殿', kind: 'gensai', note: '碁好きのお殿様' }
  ];
  const clampI = i => (i >= 0 && i < VARIANTS.length) ? i : 0;
  const charaUri = i => 'img/' + VARIANTS[clampI(i)].key + '.jpg';
  const faceUri = i => 'img/' + VARIANTS[clampI(i)].key + '_face.jpg';
  // Botの強さで対局相手が変わる：10〜9級 みけ＆こむぎ → ひなた → 静馬 → 巴 → 殿 → 1級 玄斎
  const RIVAL_BY_LEVEL = [5, 5, 2, 2, 3, 3, 4, 4, 6, 1];
  function rivalOf(me, level) {
    const r = RIVAL_BY_LEVEL[Math.max(0, Math.min(9, level | 0))];
    return r === me ? (me === 0 ? 1 : 0) : r;
  }
  // 先に読みこんでおく（対局中のカットインが一瞬で出るように）
  setTimeout(() => VARIANTS.forEach((v, i) => { new Image().src = charaUri(i); new Image().src = faceUri(i); }), 400);

  function rnd(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

  /* ================= 幽玄の間（背景） ================= */
  function paintRoom(cv) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = window.innerWidth, H = window.innerHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    const g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const R = rnd(3);
    const floorY = H * .56, wallTop = H * .07;
    g.fillStyle = '#140d08'; g.fillRect(0, 0, W, H);

    // 欄間・天井
    g.fillStyle = '#21150d'; g.fillRect(0, 0, W, wallTop);
    g.fillStyle = '#3a2516'; g.fillRect(0, wallTop - 6, W, 8);

    // 床の間（右）と障子（左）
    const tokoX = W * (W > H ? .7 : .62);
    // 障子
    const shojiW = tokoX;
    const panels = Math.max(2, Math.round(shojiW / 120));
    const pw = shojiW / panels;
    for (let i = 0; i < panels; i++) {
      const x0 = i * pw;
      const gr = g.createLinearGradient(0, wallTop, 0, floorY);
      gr.addColorStop(0, '#f7e9c9'); gr.addColorStop(.6, '#ecd3a0'); gr.addColorStop(1, '#c79e62');
      g.fillStyle = gr; g.fillRect(x0, wallTop, pw, floorY - wallTop);
      // 組子
      g.strokeStyle = 'rgba(70,42,20,.55)'; g.lineWidth = 1.2;
      const cols = 3, rows = 7;
      for (let c = 1; c < cols; c++) { const x = x0 + pw * c / cols; g.beginPath(); g.moveTo(x, wallTop); g.lineTo(x, floorY); g.stroke(); }
      for (let r = 1; r < rows; r++) { const y = wallTop + (floorY - wallTop) * r / rows; g.beginPath(); g.moveTo(x0, y); g.lineTo(x0 + pw, y); g.stroke(); }
      // 腰板
      g.fillStyle = '#5a3a22'; g.fillRect(x0, floorY - (floorY - wallTop) * .12, pw, (floorY - wallTop) * .12);
      // 框
      g.fillStyle = '#3a2516'; g.fillRect(x0, wallTop, 5, floorY - wallTop); g.fillRect(x0 + pw - 5, wallTop, 5, floorY - wallTop);
    }
    // 障子越しの月明かり（枝の影）
    g.save(); g.globalAlpha = .28; g.strokeStyle = '#3d2a1e'; g.lineCap = 'round';
    const branch = (x, y, a, len, w, d) => {
      if (d > 5 || len < 6) return;
      const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
      g.lineWidth = w; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo((x + x2) / 2 + (R() - .5) * 14, (y + y2) / 2 + (R() - .5) * 14, x2, y2); g.stroke();
      branch(x2, y2, a + (R() * .6 + .1), len * .72, w * .7, d + 1);
      if (R() < .8) branch(x2, y2, a - (R() * .6 + .1), len * .66, w * .65, d + 1);
    };
    branch(shojiW * .9, floorY * .95, -2.3, H * .16, 7, 0);
    g.restore();

    // 床の間
    g.fillStyle = '#2a1b12'; g.fillRect(tokoX, wallTop, W - tokoX, floorY - wallTop);
    const tg = g.createLinearGradient(tokoX, 0, W, 0);
    tg.addColorStop(0, 'rgba(255,214,150,.06)'); tg.addColorStop(1, 'rgba(0,0,0,.25)');
    g.fillStyle = tg; g.fillRect(tokoX, wallTop, W - tokoX, floorY - wallTop);
    g.fillStyle = '#3e2618'; g.fillRect(tokoX, wallTop, 10, floorY - wallTop); // 床柱
    g.fillStyle = '#1b110a'; g.fillRect(tokoX, floorY - 12, W - tokoX, 12);
    // 掛け軸「幽玄」
    const sw = Math.min(70, (W - tokoX) * .42), sx = tokoX + (W - tokoX - sw) / 2 + 5, sy = wallTop + 20, sh = (floorY - wallTop) * .74;
    g.fillStyle = '#6b4a2b'; g.fillRect(sx - 4, sy, sw + 8, sh);
    g.fillStyle = '#efe4cc'; g.fillRect(sx + 4, sy + 14, sw - 8, sh - 34);
    g.fillStyle = '#2b1a10'; g.fillRect(sx - 8, sy - 4, sw + 16, 6); g.fillRect(sx - 8, sy + sh - 2, sw + 16, 7);
    g.fillStyle = '#1e140e'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const fs = Math.min(sw * .62, (sh - 50) / 2.4);
    g.font = `${fs}px "Yuji Syuku", "Hiragino Mincho ProN", "Yu Mincho", serif`;
    g.fillText('幽', sx + sw / 2, sy + 14 + (sh - 34) * .32);
    g.fillText('玄', sx + sw / 2, sy + 14 + (sh - 34) * .68);
    g.fillStyle = '#b8322c'; g.fillRect(sx + sw / 2 - 5, sy + sh - 34, 10, 10);

    // 畳（遠近）
    const vx = W / 2, vy = floorY - H * .5;
    const fg = g.createLinearGradient(0, floorY, 0, H);
    fg.addColorStop(0, '#8a7a44'); fg.addColorStop(1, '#5b4c26');
    g.fillStyle = fg; g.fillRect(0, floorY, W, H - floorY);
    g.strokeStyle = 'rgba(30,24,10,.25)'; g.lineWidth = 1;
    for (let i = -30; i <= 30; i++) { const x = vx + i * 9; g.beginPath(); g.moveTo(x + (x - vx) * 0, floorY); g.lineTo(vx + (x - vx) * (H - vy) / (floorY - vy), H); g.stroke(); }
    g.strokeStyle = '#1b1f14'; g.lineWidth = 3;
    for (const t of [.08, .3, .62]) { const y = floorY + (H - floorY) * t * t * 1.4 + (H - floorY) * t * .3; g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    for (const fx of [-.9, 0, .9]) { g.beginPath(); g.moveTo(vx + fx * W * .25, floorY); g.lineTo(vx + fx * W * .25 * (H - vy) / (floorY - vy), H); g.stroke(); }

    // 碁盤（遠近）
    const bw = Math.min(W * .62, 360), bh = bw * .32, bx = W / 2 - bw / 2, by = floorY + (H - floorY) * .34;
    const top = [[bx + bw * .12, by], [bx + bw * .88, by], [bx + bw, by + bh], [bx, by + bh]];
    g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(W / 2, by + bh + bw * .22, bw * .62, bw * .07, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#9a6a2c'; g.fillRect(bx, by + bh, bw, bw * .14);
    g.fillStyle = '#4a2e14'; for (const lx of [.08, .86]) g.fillRect(bx + bw * lx, by + bh + bw * .14, bw * .06, bw * .07);
    const tgr = g.createLinearGradient(0, by, 0, by + bh); tgr.addColorStop(0, '#e9c47a'); tgr.addColorStop(1, '#d4a456');
    g.fillStyle = tgr; g.beginPath(); top.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(60,35,10,.55)'; g.lineWidth = .8;
    const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    for (let i = 1; i < 9; i++) {
      const t = i / 9;
      let p = lerp(top[0], top[3], t), q = lerp(top[1], top[2], t); g.beginPath(); g.moveTo(...p); g.lineTo(...q); g.stroke();
      p = lerp(top[0], top[1], t); q = lerp(top[3], top[2], t); g.beginPath(); g.moveTo(...p); g.lineTo(...q); g.stroke();
    }
    // 碁笥
    for (const [cx, col] of [[bx - bw * .04, '#2a1a0e'], [bx + bw * 1.04, '#5a3a1c']]) {
      g.fillStyle = col; g.beginPath(); g.ellipse(cx, by + bh * .9, bw * .08, bw * .035, 0, 0, Math.PI * 2); g.fill();
      g.fillRect(cx - bw * .08, by + bh * .9, bw * .16, bw * .05);
      g.beginPath(); g.ellipse(cx, by + bh * .9 + bw * .05, bw * .08, bw * .035, 0, 0, Math.PI); g.fill();
    }

    // 灯り
    const lg = g.createRadialGradient(W * .32, floorY * .55, 0, W * .32, floorY * .55, Math.max(W, H) * .7);
    lg.addColorStop(0, 'rgba(255,200,120,.16)'); lg.addColorStop(1, 'rgba(255,200,120,0)');
    g.fillStyle = lg; g.fillRect(0, 0, W, H);
    // 周辺減光
    const vg = g.createRadialGradient(W / 2, H * .45, Math.min(W, H) * .3, W / 2, H * .5, Math.max(W, H) * .8);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.65)');
    g.fillStyle = vg; g.fillRect(0, 0, W, H);

    // 手前の桜の枝
    g.lineCap = 'round';
    const sakura = (x, y, a, len, w, d) => {
      if (d > 4 || len < 8) return;
      const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
      g.strokeStyle = '#2b1a14'; g.lineWidth = w;
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo((x + x2) / 2 + (R() - .5) * 18, (y + y2) / 2 + (R() - .5) * 18, x2, y2); g.stroke();
      const n = d >= 2 ? 3 : 1;
      for (let i = 0; i < n; i++) blossom(x2 + (R() - .5) * 18, y2 + (R() - .5) * 18, 5 + R() * 5);
      sakura(x2, y2, a + R() * .7, len * .75, w * .68, d + 1);
      sakura(x2, y2, a - R() * .7, len * .7, w * .62, d + 1);
    };
    const blossom = (x, y, r) => {
      g.fillStyle = `rgba(255,${190 + R() * 30 | 0},${205 + R() * 25 | 0},.95)`;
      for (let i = 0; i < 5; i++) {
        const a = i * Math.PI * 2 / 5 + R();
        g.beginPath(); g.ellipse(x + Math.cos(a) * r * .55, y + Math.sin(a) * r * .55, r * .5, r * .36, a, 0, Math.PI * 2); g.fill();
      }
      g.fillStyle = '#e88aa4'; g.beginPath(); g.arc(x, y, r * .22, 0, Math.PI * 2); g.fill();
    };
    sakura(-10, H * .02, .45, Math.min(W, H) * .26, 11, 0);
    sakura(W + 10, H * .2, Math.PI - .35, Math.min(W, H) * .18, 8, 1);
  }

  async function startRoom(cv) {
    let t = 0;
    const draw = () => { try { paintRoom(cv); } catch (e) {} };
    draw();
    try { await document.fonts.load('60px "Yuji Syuku"', '幽玄'); draw(); } catch (e) {}
    window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(draw, 200); });
  }

  /* ================= 桜吹雪とタップの光 ================= */
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let fxCv = null, fx = null, W = 0, H = 0, dpr = 1, running = false;
  const petals = [], parts = [];
  let petalTarget = 18, gust = 0;
  function sizeFx() {
    dpr = Math.min(2, window.devicePixelRatio || 1); W = window.innerWidth; H = window.innerHeight;
    fxCv.width = Math.round(W * dpr); fxCv.height = Math.round(H * dpr);
    fx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function newPetal(anywhere) {
    return {
      x: anywhere ? Math.random() * W : -20 - Math.random() * 60, y: anywhere ? Math.random() * H : Math.random() * H * .8 - H * .1,
      vx: .6 + Math.random() * 1.2, vy: .4 + Math.random() * .9, r: 4 + Math.random() * 5,
      a: Math.random() * 6.3, va: (Math.random() - .5) * .08, f: Math.random() * 6.3, vf: .04 + Math.random() * .06,
      c: `${255},${170 + (Math.random() * 50 | 0)},${190 + (Math.random() * 40 | 0)}`
    };
  }
  function drawPetal(p, alpha) {
    fx.save(); fx.translate(p.x, p.y); fx.rotate(p.a); fx.scale(1, Math.abs(Math.cos(p.f)) * .8 + .2);
    fx.fillStyle = `rgba(${p.c},${alpha})`;
    const r = p.r;
    fx.beginPath(); fx.moveTo(0, -r);
    fx.bezierCurveTo(r * .9, -r * .7, r * .8, r * .6, 0, r);
    fx.bezierCurveTo(-r * .8, r * .6, -r * .9, -r * .7, 0, -r);
    fx.fill();
    fx.fillStyle = `rgba(255,255,255,${alpha * .35})`; fx.beginPath(); fx.ellipse(-r * .2, -r * .2, r * .25, r * .5, 0, 0, 6.3); fx.fill();
    fx.restore();
  }
  function loop() {
    if (!fxCv) return;
    fx.clearRect(0, 0, W, H);
    gust = Math.sin(Date.now() / 2300) * .8 + Math.sin(Date.now() / 900) * .3;
    if (!reduce) {
      while (petals.length < petalTarget) petals.push(newPetal(petals.length < petalTarget / 2 && !petals._init));
      petals._init = true;
      for (let i = petals.length - 1; i >= 0; i--) {
        const p = petals[i];
        p.x += p.vx + gust; p.y += p.vy + Math.sin(p.f) * .3; p.a += p.va; p.f += p.vf;
        if (p.x > W + 30 || p.y > H + 30 || (petals.length > petalTarget && Math.random() < .02)) { petals.splice(i, 1); continue; }
        drawPetal(p, .85);
      }
    }
    for (let i = parts.length - 1; i >= 0; i--) {
      const q = parts[i];
      q.t += 1;
      if (q.t <= 0) continue;
      const k = q.t / q.life;
      if (k >= 1) { parts.splice(i, 1); continue; }
      if (q.type === 'ring') {
        const e = 1 - Math.pow(1 - k, 3);
        fx.strokeStyle = `rgba(${q.c},${(1 - k) * q.a})`; fx.lineWidth = q.w * (1 - k) + .5;
        fx.beginPath(); fx.arc(q.x, q.y, q.r0 + (q.r1 - q.r0) * e, 0, 6.3); fx.stroke();
      } else if (q.type === 'flash') {
        const gr = fx.createRadialGradient(q.x, q.y, 0, q.x, q.y, q.r);
        gr.addColorStop(0, `rgba(${q.c},${(1 - k) * q.a})`); gr.addColorStop(1, `rgba(${q.c},0)`);
        fx.fillStyle = gr; fx.beginPath(); fx.arc(q.x, q.y, q.r, 0, 6.3); fx.fill();
      } else if (q.type === 'spark') {
        q.x += q.vx; q.y += q.vy; q.vx *= .92; q.vy = q.vy * .92 + .06;
        fx.strokeStyle = `rgba(${q.c},${1 - k})`; fx.lineWidth = q.w;
        fx.beginPath(); fx.moveTo(q.x, q.y); fx.lineTo(q.x - q.vx * 3, q.y - q.vy * 3); fx.stroke();
      } else if (q.type === 'petal') {
        q.x += q.vx; q.y += q.vy; q.vx *= .95; q.vy = q.vy * .95 + .05; q.a += q.va; q.f += .2;
        drawPetal(q, 1 - k);
      } else if (q.type === 'star') {
        const s = q.s * Math.sin(k * Math.PI);
        fx.fillStyle = `rgba(${q.c},${1 - k * .5})`;
        fx.beginPath();
        for (let j = 0; j < 8; j++) { const rr = j % 2 ? s * .25 : s, a = j * Math.PI / 4 + q.rot; fx.lineTo(q.x + Math.cos(a) * rr, q.y + Math.sin(a) * rr); }
        fx.closePath(); fx.fill();
      }
    }
    requestAnimationFrame(loop);
  }
  function startFx(cv) {
    fxCv = cv; fx = cv.getContext('2d'); sizeFx();
    window.addEventListener('resize', sizeFx);
    if (!running) { running = true; requestAnimationFrame(loop); }
  }
  function setPetals(n) { petalTarget = n; }
  // kind: 'tap'（どこでも）/ 'black' / 'white'（着手）/ 'bad'（打てない点）/ 'win'
  function burst(x, y, kind) {
    if (!fx) return;
    const gold = '255,214,120', white = '255,250,235', sak = '255,190,210', shu = '230,80,60';
    if (kind === 'tap') {
      parts.push({ type: 'flash', x, y, r: 34, c: white, a: .45, t: 0, life: 14 });
      parts.push({ type: 'ring', x, y, r0: 4, r1: 34, w: 2.4, c: gold, a: .9, t: 0, life: 22 });
      for (let i = 0; i < 7; i++) { const a = Math.random() * 6.3, v = 2 + Math.random() * 3; parts.push({ type: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, w: 1.4, c: gold, t: 0, life: 18 + Math.random() * 10 }); }
      for (let i = 0; i < 2; i++) { const a = Math.random() * 6.3; parts.push(Object.assign(newPetal(true), { type: 'petal', x, y, vx: Math.cos(a) * 2.4, vy: Math.sin(a) * 2.4 - 1, r: 4 + Math.random() * 2, t: 0, life: 40 })); }
      return;
    }
    const big = kind !== 'bad';
    const core = kind === 'black' ? '160,190,255' : kind === 'bad' ? shu : white;
    parts.push({ type: 'flash', x, y, r: big ? 90 : 46, c: kind === 'black' ? '200,215,255' : white, a: big ? .75 : .4, t: 0, life: big ? 18 : 12 });
    parts.push({ type: 'ring', x, y, r0: 10, r1: big ? 90 : 40, w: big ? 5 : 3, c: big ? gold : shu, a: 1, t: 0, life: big ? 26 : 18 });
    if (big) parts.push({ type: 'ring', x, y, r0: 6, r1: 60, w: 2.5, c: core, a: .9, t: -4, life: 30 });
    const n = big ? 22 : 9;
    for (let i = 0; i < n; i++) { const a = Math.random() * 6.3, v = (big ? 4 : 2.5) + Math.random() * 4; parts.push({ type: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, w: big ? 2 : 1.4, c: i % 3 ? gold : core, t: 0, life: 22 + Math.random() * 14 }); }
    if (big) {
      for (let i = 0; i < 6; i++) { const a = Math.random() * 6.3, v = 2 + Math.random() * 3; parts.push(Object.assign(newPetal(true), { type: 'petal', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1.5, t: 0, life: 55 })); }
      for (let i = 0; i < 4; i++) parts.push({ type: 'star', x: x + (Math.random() - .5) * 70, y: y + (Math.random() - .5) * 70, s: 6 + Math.random() * 8, rot: Math.random(), c: i % 2 ? gold : white, t: -i * 3, life: 24 });
    }
    if (kind === 'win') for (let i = 0; i < 30; i++) { const a = Math.random() * 6.3, v = 3 + Math.random() * 5; parts.push(Object.assign(newPetal(true), { type: 'petal', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 2, t: 0, life: 80 })); }
  }

  window.ART = { VARIANTS, charaUri, faceUri, rivalOf, startRoom, startFx, setPetals, burst };
})();
