/* 九路 Blitz — イラストと演出（和）
 * キャラクター（小春・玄斎）、幽玄の間の背景、桜吹雪、タップの光。すべてコードで描画。 */
(function () {
  'use strict';

  /* ================= キャラクター ================= */
  // kind: 'koharu'（少女）/ 'gensai'（けだるい師匠）
  const VARIANTS = [
    { kind: 'koharu', name: '小春・桜', kimono: ['#f6b3c4', '#e0809b', '#a94a68'], flower: '#ffe3ea', obi: '#d8b25a' },
    { kind: 'koharu', name: '小春・藤', kimono: ['#c6b0ec', '#8f72c9', '#55408f'], flower: '#f1e8ff', obi: '#d8b25a' },
    { kind: 'koharu', name: '小春・若草', kimono: ['#bfe3a8', '#7fbf73', '#3f7a45'], flower: '#fff7d6', obi: '#e07a5f' },
    { kind: 'koharu', name: '小春・紺', kimono: ['#6c86c4', '#34508f', '#1b2a52'], flower: '#ffd1dc', obi: '#d8b25a' },
    { kind: 'gensai', name: '玄斎・鉄紺', haori: ['#3d4a66', '#262f45', '#141a28'], inner: '#8d8a80' },
    { kind: 'gensai', name: '玄斎・焦茶', haori: ['#6b4b36', '#43301f', '#24180f'], inner: '#9a9184' }
  ];
  let uid = 0;

  function koharu(v) {
    const k = 'k' + (uid++);
    const eye = (cx, flip) => {
      const s = flip ? -1 : 1, X = x => cx + s * x;
      return `
  <ellipse cx="${cx}" cy="123" rx="9" ry="11.5" fill="url(#${k}i)"/>
  <ellipse cx="${X(0.6)}" cy="125" rx="4" ry="6" fill="#1b0d0a"/>
  <circle cx="${X(-3)}" cy="117" r="3.2" fill="#fff"/>
  <circle cx="${X(3.4)}" cy="129" r="1.6" fill="#fff" opacity=".9"/>
  <path d="M${X(-13)} 115 C ${X(-8)} 106 ${X(8)} 105 ${X(12)} 113 L ${X(12)} 116 C ${X(6)} 110 ${X(-6)} 111 ${X(-12)} 119 Z" fill="#1d1218"/>
  <path d="M${X(-13)} 115 L ${X(-18)} 111 L ${X(-12)} 119 Z" fill="#1d1218"/>
  <path d="M${X(-8)} 134 C ${X(-3)} 137 ${X(4)} 136 ${X(8)} 132" stroke="#5a3a3a" stroke-width="1" fill="none" opacity=".6"/>`;
    };
    const flower = (x, y, r, c) => {
      let p = '';
      for (let i = 0; i < 5; i++) {
        const a = i * 72 - 90;
        p += `<ellipse cx="${x}" cy="${y - r * .55}" rx="${r * .42}" ry="${r * .6}" fill="${c}" transform="rotate(${a + 90} ${x} ${y})"/>`;
      }
      return p + `<circle cx="${x}" cy="${y}" r="${r * .22}" fill="#e8a23a"/>`;
    };
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 240">
<defs>
  <linearGradient id="${k}h" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a2838"/><stop offset="1" stop-color="#140c14"/></linearGradient>
  <radialGradient id="${k}s" cx="45%" cy="40%" r="70%"><stop offset="0" stop-color="#fff3ea"/><stop offset="1" stop-color="#f6d4c2"/></radialGradient>
  <linearGradient id="${k}m" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${v.kimono[0]}"/><stop offset=".6" stop-color="${v.kimono[1]}"/><stop offset="1" stop-color="${v.kimono[2]}"/></linearGradient>
  <linearGradient id="${k}i" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a1410"/><stop offset=".55" stop-color="#8a3f22"/><stop offset="1" stop-color="#e3a05a"/></linearGradient>
</defs>
<path d="M36 238 C 28 170 32 96 62 64 C 80 46 120 46 138 64 C 168 96 172 170 164 238 Z" fill="url(#${k}h)"/>
<path d="M12 240 C 20 206 56 192 100 190 C 144 192 180 206 188 240 Z" fill="url(#${k}m)"/>
${flower(40, 222, 9, v.flower)}${flower(160, 216, 8, v.flower)}${flower(58, 236, 6, v.flower)}
<path d="M88 158 L 86 194 L 114 194 L 112 158 Z" fill="#efc6b2"/>
<path d="M70 192 L 100 238 L 108 230 L 80 190 Z" fill="#c73e3a"/>
<path d="M130 192 L 100 238 L 92 230 L 120 190 Z" fill="#c73e3a"/>
<path d="M80 190 L 100 226 L 120 190 L 113 189 L 100 212 L 87 189 Z" fill="#fffaf4"/>
<rect x="60" y="234" width="80" height="8" fill="${v.obi}"/>
<path d="M100 64 C 128 64 141 88 139 114 C 137 140 120 160 100 164 C 80 160 63 140 61 114 C 59 88 72 64 100 64 Z" fill="url(#${k}s)"/>
<ellipse cx="77" cy="136" rx="9" ry="4.6" fill="#ff8fa6" opacity=".45"/>
<ellipse cx="123" cy="136" rx="9" ry="4.6" fill="#ff8fa6" opacity=".45"/>
${eye(82, false)}${eye(118, true)}
<path d="M100 137 L 99 140" stroke="#d29a86" stroke-width="1.4" stroke-linecap="round"/>
<path d="M93 147 C 96 153 104 153 107 147 Z" fill="#c9465f"/>
<path d="M96 150.5 C 98 152 102 152 104 150.5" stroke="#ff9fb1" stroke-width="1.6" fill="none"/>
<path d="M59 114 C 55 78 74 52 100 50 C 126 52 145 78 141 114 L 135 97 L 129 109 L 122 88 L 114 105 L 107 86 L 100 101 L 93 86 L 86 105 L 78 88 L 71 109 L 65 97 Z" fill="url(#${k}h)"/>
<path d="M61 98 C 51 130 53 170 62 204 L 73 202 C 66 168 66 132 71 108 Z" fill="url(#${k}h)"/>
<path d="M139 98 C 149 130 147 170 138 204 L 127 202 C 134 168 134 132 129 108 Z" fill="url(#${k}h)"/>
<path d="M76 68 C 90 58 112 58 126 68" stroke="#fff" stroke-opacity=".22" stroke-width="4" fill="none" stroke-linecap="round"/>
<g>${flower(66, 76, 11, '#ffc4d2')}${flower(78, 66, 7, '#ffe0e8')}</g>
<path d="M62 84 L 58 104 M66 86 L 68 102" stroke="#d8b25a" stroke-width="1.2"/>
<circle cx="58" cy="107" r="3.4" fill="#151217"/><circle cx="68" cy="105" r="3.4" fill="#f6f3ea" stroke="#bdb4a4" stroke-width=".6"/>
</svg>`;
  }

  function gensai(v) {
    const k = 'g' + (uid++);
    const eye = (cx, flip) => {
      const s = flip ? -1 : 1, X = x => cx + s * x;
      return `
  <ellipse cx="${cx}" cy="123" rx="9" ry="4" fill="#f8f2ea"/>
  <circle cx="${X(1)}" cy="125" r="4.2" fill="#3b2618"/>
  <path d="M${X(-11)} 116 C ${X(-6)} 113 ${X(6)} 113 ${X(11)} 117 L ${X(11)} 123.5 C ${X(5)} 122.5 ${X(-5)} 122 ${X(-11)} 124 Z" fill="#cfa688"/>
  <path d="M${X(-11)} 124 C ${X(-5)} 122 ${X(5)} 122.5 ${X(11)} 123.5" stroke="#2b1d16" stroke-width="2.6" fill="none" stroke-linecap="round"/>
  <path d="M${X(-9)} 118.5 C ${X(-3)} 117 ${X(4)} 117 ${X(9)} 119" stroke="#a87c60" stroke-width="1" fill="none" opacity=".7"/>
  <path d="M${X(-8)} 129.5 C ${X(-3)} 132.5 ${X(4)} 132.5 ${X(9)} 128.5" stroke="#9b7258" stroke-width="1.2" fill="none" opacity=".8"/>
  <path d="M${X(-15)} 113 C ${X(-9)} 106 ${X(3)} 104 ${X(12)} 108" stroke="#2a2622" stroke-width="3.6" fill="none" stroke-linecap="round"/>`;
    };
    let stub = '';
    const R = rnd(7);
    for (let i = 0; i < 0; i++) {
      const t = R(), side = R() * 2 - 1;
      const x = 100 + side * (16 + 22 * (1 - Math.abs(side) * .3)) * (0.6 + t * .4);
      const y = 142 + R() * 20 - Math.abs(side) * 8;
      stub += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r=".7" fill="#4a3a30" opacity=".55"/>`;
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 240">
<defs>
  <linearGradient id="${k}h" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4b4741"/><stop offset="1" stop-color="#1f1c19"/></linearGradient>
  <radialGradient id="${k}s" cx="45%" cy="40%" r="75%"><stop offset="0" stop-color="#f3d6bc"/><stop offset="1" stop-color="#d7ad8c"/></radialGradient>
  <linearGradient id="${k}m" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${v.haori[0]}"/><stop offset=".6" stop-color="${v.haori[1]}"/><stop offset="1" stop-color="${v.haori[2]}"/></linearGradient>
</defs>
<path d="M8 240 C 18 202 56 188 100 186 C 144 188 182 202 192 240 Z" fill="url(#${k}m)"/>
<path d="M82 154 L 79 192 L 121 192 L 118 154 Z" fill="#cfa283"/>
<path d="M82 188 L 100 236 L 118 188 Z" fill="#d3a888"/>
<path d="M92 206 C 96 210 104 210 108 206" stroke="#a87c60" stroke-width="1.2" fill="none"/>
<path d="M68 190 L 98 240 L 106 232 L 82 188 Z" fill="${v.inner}"/>
<path d="M132 190 L 102 240 L 94 232 L 118 188 Z" fill="${v.inner}"/>
<path d="M58 196 L 92 240 M142 196 L 108 240" stroke="#000" stroke-opacity=".25" stroke-width="6"/>
<ellipse cx="58" cy="120" rx="6" ry="10" fill="#d7ad8c"/><ellipse cx="142" cy="120" rx="6" ry="10" fill="#d7ad8c"/>
<path d="M100 60 C 130 60 143 86 141 114 C 140 138 128 160 100 167 C 72 160 60 138 59 114 C 57 86 70 60 100 60 Z" fill="url(#${k}s)"/>
<path d="M64 132 C 70 156 86 167 100 168 C 114 167 130 156 136 132 C 128 148 114 158 100 158 C 86 158 72 148 64 132 Z" fill="#4b3a2e" opacity=".3"/>
<path d="M88 144 C 94 141 106 141 112 144 C 106 146 94 146 88 144 Z" fill="#4b3a2e" opacity=".3"/>
${stub}
${eye(84, false)}${eye(116, true)}
<path d="M101 120 L 98 137 C 100 139 104 139 105 136" stroke="#b38466" stroke-width="1.6" fill="none" stroke-linecap="round"/>
<path d="M90 150 C 97 151.5 104 151 111 148.5" stroke="#5e3a2c" stroke-width="2.3" fill="none" stroke-linecap="round"/>
<path d="M108 149.5 L 128 144" stroke="#e2c391" stroke-width="2.2" stroke-linecap="round"/>
<path d="M55 112 C 49 74 66 48 100 44 C 134 48 153 74 147 112 L 141 92 L 135 101 L 128 80 L 119 95 L 110 74 L 101 92 L 90 72 L 82 93 L 72 77 L 66 99 L 60 89 Z" fill="url(#${k}h)"/>
<path d="M74 54 C 70 46 72 40 78 36 C 80 44 86 48 92 49 Z M110 47 C 114 40 120 37 126 38 C 122 42 120 48 120 54 Z M58 80 C 52 76 50 70 52 64 C 56 70 60 72 64 72 Z" fill="#35312c"/>
<path d="M84 56 C 92 50 104 50 112 54 M120 62 C 128 66 134 74 138 84" stroke="#9a948a" stroke-width="1.8" fill="none" opacity=".7"/>
<path d="M58 100 C 56 112 57 122 60 130 M142 100 C 144 112 143 122 140 130" stroke="#8d877c" stroke-width="2" fill="none" opacity=".8"/>
</svg>`;
  }

  function rnd(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  const uri = svg => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  const cache = {};
  function charaUri(i) {
    i = (i >= 0 && i < VARIANTS.length) ? i : 0;
    if (!cache[i]) { const v = VARIANTS[i]; cache[i] = uri(v.kind === 'koharu' ? koharu(v) : gensai(v)); }
    return cache[i];
  }
  // 対局相手のキャラ：自分が小春なら玄斎、玄斎なら小春（藤）
  const rivalOf = i => (VARIANTS[i] && VARIANTS[i].kind === 'gensai') ? 1 : 4;

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

  window.ART = { VARIANTS, charaUri, rivalOf, startRoom, startFx, setPetals, burst };
})();
