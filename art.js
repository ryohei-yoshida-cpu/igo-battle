/* 九路 Blitz — イラストと背景（宇宙人キャラ・Bot・銀河）
 * すべてコードで描いているので、画像ファイルは不要。 */
(function () {
  'use strict';

  // キャラクターの色違い（アバターとしても使う）
  const VARIANTS = [
    { name: 'ノクス', skin: ['#5b63e0', '#262a78', '#11133d'], glow: '#5ef2ff', fin: '#1c1f5e', armor: '#151a3c' },
    { name: 'ヴィオラ', skin: ['#9a5ce6', '#4a2390', '#1f0d45'], glow: '#ff6ad5', fin: '#341566', armor: '#1d1238' },
    { name: 'テラ', skin: ['#36b39a', '#145a5a', '#082a2e'], glow: '#c6ff5e', fin: '#0e3f42', armor: '#0d2228' },
    { name: 'ルベル', skin: ['#d94c5e', '#7a1830', '#330818'], glow: '#ffd36a', fin: '#521022', armor: '#240b16' },
    { name: 'アルゲン', skin: ['#9aa6c4', '#4b5576', '#1e2338'], glow: '#ffffff', fin: '#353d5a', armor: '#171b2c' },
    { name: 'シアン', skin: ['#2fa6d9', '#10507a', '#062338'], glow: '#7dffea', fin: '#0b3b5c', armor: '#0a1a2b' },
    { name: 'オブシ', skin: ['#3b3f52', '#1b1d29', '#0a0b12'], glow: '#ff8a3d', fin: '#14151e', armor: '#0d0e15' },
    { name: 'アズール', skin: ['#4f86ff', '#1d3fa6', '#0b1a4d'], glow: '#ff7aa8', fin: '#15307d', armor: '#0f1838' }
  ];

  let uid = 0;
  // 胸から上のバストアップ（viewBox 0 0 200 240）
  function alien(i) {
    const v = VARIANTS[i] || VARIANTS[0];
    const k = 'a' + (uid++);
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 240">
<defs>
  <radialGradient id="${k}s" cx="38%" cy="30%" r="80%"><stop offset="0" stop-color="${v.skin[0]}"/><stop offset=".55" stop-color="${v.skin[1]}"/><stop offset="1" stop-color="${v.skin[2]}"/></radialGradient>
  <linearGradient id="${k}f" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="${v.skin[1]}"/><stop offset="1" stop-color="${v.fin}"/></linearGradient>
  <linearGradient id="${k}r" x1="0" y1="0" x2="1" y2="0"><stop offset=".45" stop-color="${v.glow}" stop-opacity="0"/><stop offset="1" stop-color="${v.glow}" stop-opacity=".9"/></linearGradient>
  <linearGradient id="${k}m" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2b3266"/><stop offset="1" stop-color="${v.armor}"/></linearGradient>
  <radialGradient id="${k}e" cx="50%" cy="55%" r="60%"><stop offset="0" stop-color="#ffffff"/><stop offset=".35" stop-color="${v.glow}"/><stop offset="1" stop-color="${v.glow}" stop-opacity=".55"/></radialGradient>
  <filter id="${k}g" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3.2"/></filter>
</defs>
<path d="M4 240 C 12 204 46 188 76 183 L 100 200 L 124 183 C 154 188 188 204 196 240 Z" fill="url(#${k}m)"/>
<path d="M30 240 C 34 220 48 206 66 198 M170 240 C 166 220 152 206 134 198" stroke="${v.glow}" stroke-opacity=".55" stroke-width="1.6" fill="none"/>
<path d="M84 158 L 81 186 L 100 200 L 119 186 L 116 158 Z" fill="${v.skin[2]}"/>
<path d="M62 188 L 100 216 L 138 188 L 130 175 L 100 198 L 70 175 Z" fill="#262d5e" stroke="${v.glow}" stroke-opacity=".7" stroke-width="1.2"/>
<path d="M100 222 l7 8 l-7 8 l-7 -8 Z" fill="${v.glow}" filter="url(#${k}g)"/>
<path d="M100 224 l5 6 l-5 6 l-5 -6 Z" fill="#fff"/>
<path d="M62 80 C 38 58 30 26 40 0 C 54 30 72 48 88 58 Z" fill="url(#${k}f)"/>
<path d="M138 80 C 162 58 170 26 160 0 C 146 30 128 48 112 58 Z" fill="url(#${k}f)"/>
<path d="M146 66 C 158 46 162 24 160 4" stroke="${v.glow}" stroke-opacity=".6" stroke-width="1.4" fill="none"/>
<path d="M40 204 L 56 146 L 76 166 L 78 190 Z M160 204 L 144 146 L 124 166 L 122 190 Z" fill="url(#${k}m)" stroke="${v.glow}" stroke-opacity=".6" stroke-width="1.3"/>
<path d="M100 20 C 140 20 157 52 155 92 C 154 112 147 130 133 146 L 112 167 Q 100 176 88 167 L 67 146 C 53 130 46 112 45 92 C 43 52 60 20 100 20 Z" fill="url(#${k}s)"/>
<path d="M58 118 L 70 124 L 86 156 L 70 146 Z M142 118 L 130 124 L 114 156 L 130 146 Z" fill="${v.skin[2]}" opacity=".55"/>
<path d="M100 20 C 140 20 157 52 155 92 C 154 112 147 130 133 146 L 112 167" stroke="url(#${k}r)" stroke-width="3" fill="none"/>
<path d="M50 96 C 68 90 88 94 98 106 L 97 110 C 86 100 68 98 50 102 Z" fill="${v.skin[2]}" opacity=".85"/>
<path d="M150 96 C 132 90 112 94 102 106 L 103 110 C 114 100 132 98 150 102 Z" fill="${v.skin[2]}" opacity=".85"/>
<g filter="url(#${k}g)" opacity=".95">
  <path d="M52 102 C 68 103 86 107 96 115 C 84 118 66 114 52 102 Z" fill="${v.glow}"/>
  <path d="M148 102 C 132 103 114 107 104 115 C 116 118 134 114 148 102 Z" fill="${v.glow}"/>
</g>
<path d="M52 102 C 68 103 86 107 96 115 C 84 118 66 114 52 102 Z" fill="url(#${k}e)"/>
<path d="M148 102 C 132 103 114 107 104 115 C 116 118 134 114 148 102 Z" fill="url(#${k}e)"/>
<path d="M100 40 L 100 66" stroke="${v.glow}" stroke-width="1.6" stroke-opacity=".8"/>
<path d="M100 68 l6 9 l-6 9 l-6 -9 Z" fill="${v.glow}" filter="url(#${k}g)"/>
<path d="M100 70 l4.5 7 l-4.5 7 l-4.5 -7 Z" fill="#fff"/>
<path d="M68 124 L 74 146 M132 124 L 126 146" stroke="${v.glow}" stroke-width="1.8" stroke-linecap="round" stroke-opacity=".8"/>
<path d="M62 122 L 64 134 M138 122 L 136 134" stroke="${v.glow}" stroke-width="1.2" stroke-linecap="round" stroke-opacity=".5"/>
<path d="M97 128 L 100 138 L 103 128" stroke="${v.skin[2]}" stroke-width="1.6" fill="none" opacity=".7"/>
<path d="M91 153 L 100 151 L 109 153" stroke="${v.skin[2]}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
</svg>`;
  }

  // 対戦相手のBot（ロボット）
  function robot() {
    const k = 'r' + (uid++);
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 240">
<defs>
  <linearGradient id="${k}h" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5a6280"/><stop offset=".5" stop-color="#262b40"/><stop offset="1" stop-color="#0e1020"/></linearGradient>
  <linearGradient id="${k}v" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ff2f7a" stop-opacity=".25"/><stop offset=".5" stop-color="#ff4fa3"/><stop offset="1" stop-color="#ff2f7a" stop-opacity=".25"/></linearGradient>
  <linearGradient id="${k}m" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a2f48"/><stop offset="1" stop-color="#0c0e1a"/></linearGradient>
  <filter id="${k}g" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter>
</defs>
<path d="M2 240 L 16 200 L 70 180 L 130 180 L 184 200 L 198 240 Z" fill="url(#${k}m)"/>
<path d="M16 200 L 70 180 L 76 196 L 24 214 Z M184 200 L 130 180 L 124 196 L 176 214 Z" fill="#363c5c"/>
<path d="M78 150 L 76 186 L 124 186 L 122 150 Z" fill="#1a1d30"/>
<path d="M80 160 H120 M80 170 H120" stroke="#ff4fa3" stroke-opacity=".4" stroke-width="1.5"/>
<path d="M100 8 V 30" stroke="#8a93b8" stroke-width="3"/>
<circle cx="100" cy="7" r="5" fill="#ff4fa3" filter="url(#${k}g)"/><circle cx="100" cy="7" r="3" fill="#fff"/>
<path d="M58 58 L 74 28 L 126 28 L 142 58 L 150 118 L 128 158 L 72 158 L 50 118 Z" fill="url(#${k}h)"/>
<path d="M126 28 L 142 58 L 150 118 L 128 158" stroke="#ff4fa3" stroke-opacity=".6" stroke-width="2" fill="none" stroke-linejoin="round"/>
<path d="M74 28 L 100 44 L 126 28" stroke="#0a0b14" stroke-width="2" fill="none" opacity=".6"/>
<path d="M44 80 L 54 76 L 54 124 L 44 118 Z M156 80 L 146 76 L 146 124 L 156 118 Z" fill="#2a2f48"/>
<path d="M56 86 L 100 104 L 144 86 L 144 104 L 100 124 L 56 104 Z" fill="#07080f"/>
<path d="M60 92 L 100 108 L 140 92 L 140 100 L 100 118 L 60 100 Z" fill="url(#${k}v)" filter="url(#${k}g)"/>
<path d="M64 95 L 100 110 L 136 95" stroke="#ffd1e8" stroke-width="3" fill="none" stroke-linecap="round"/>
<path d="M84 138 L 84 150 M92 140 L 92 152 M100 141 L 100 153 M108 140 L 108 152 M116 138 L 116 150" stroke="#0a0b14" stroke-width="2.6" stroke-linecap="round"/>
<path d="M66 52 Q 80 40 100 40" stroke="#9aa3c8" stroke-width="2" fill="none" opacity=".6"/>
</svg>`;
  }

  const uri = svg => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  const cache = {};
  function alienUri(i) { i = (i >= 0 && i < VARIANTS.length) ? i : 0; return cache['a' + i] || (cache['a' + i] = uri(alien(i))); }
  function robotUri() { return cache.r || (cache.r = uri(robot())); }

  /* ---------- 銀河の背景 ---------- */
  function rnd(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  function paintGalaxy(cv) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = window.innerWidth, H = window.innerHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    const g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const R = rnd(9);
    g.fillStyle = '#04050d'; g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'lighter';
    // 星雲
    const neb = [[.15, .78, .7, '106,43,217', .22], [.85, .9, .6, '194,51,143', .16], [.1, .2, .5, '26,166,183', .12], [.7, .35, .8, '72,60,200', .14]];
    for (const [x, y, r, c, a] of neb) {
      const rr = r * Math.max(W, H);
      const gr = g.createRadialGradient(x * W, y * H, 0, x * W, y * H, rr);
      gr.addColorStop(0, `rgba(${c},${a})`); gr.addColorStop(1, `rgba(${c},0)`);
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
    }
    // 渦巻き銀河
    const cx = W * (W > H ? .72 : .66), cy = H * .3, Rg = Math.min(W, H) * .62, tilt = -0.42, flat = .38;
    const core = g.createRadialGradient(cx, cy, 0, cx, cy, Rg * .32);
    core.addColorStop(0, 'rgba(255,236,205,.85)'); core.addColorStop(.25, 'rgba(255,190,140,.28)'); core.addColorStop(1, 'rgba(160,120,255,0)');
    g.save(); g.translate(cx, cy); g.rotate(tilt); g.scale(1, flat); g.translate(-cx, -cy);
    g.fillStyle = core; g.beginPath(); g.arc(cx, cy, Rg * .32, 0, Math.PI * 2); g.fill();
    g.restore();
    const n = Math.round(Math.min(9000, W * H / 70));
    const ct = Math.cos(tilt), st = Math.sin(tilt);
    for (let i = 0; i < n; i++) {
      const arm = i & 1, t = Math.pow(R(), .8);
      const ang = arm * Math.PI + t * 3.4 * Math.PI + (R() - .5) * (.9 - t * .4);
      const r = t * Rg + (R() - .5) * 12;
      const x0 = Math.cos(ang) * r, y0 = Math.sin(ang) * r * flat;
      const x = cx + x0 * ct - y0 * st, y = cy + x0 * st + y0 * ct;
      const warm = 1 - t;
      const col = R() < .12 ? '255,140,210' : warm > .6 ? '255,226,190' : R() < .5 ? '150,190,255' : '190,160,255';
      g.fillStyle = `rgba(${col},${(.15 + R() * .5) * (0.5 + warm * .5)})`;
      const s = R() < .03 ? 1.6 : .7;
      g.fillRect(x, y, s, s);
    }
    // 星
    g.globalCompositeOperation = 'source-over';
    for (let i = 0; i < W * H / 900; i++) {
      const x = R() * W, y = R() * H, s = R() < .08 ? 1.5 : R() * .9 + .3;
      g.fillStyle = `rgba(${R() < .2 ? '190,210,255' : R() < .1 ? '255,220,190' : '255,255,255'},${.35 + R() * .6})`;
      g.beginPath(); g.arc(x, y, s, 0, Math.PI * 2); g.fill();
    }
    // 光る星（十字の光条）
    for (let i = 0; i < 7; i++) {
      const x = R() * W, y = R() * H, L = 6 + R() * 10;
      const gr = g.createRadialGradient(x, y, 0, x, y, L * .5);
      gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(1, 'rgba(160,200,255,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, L * .5, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(200,225,255,.5)'; g.lineWidth = .6;
      g.beginPath(); g.moveTo(x - L, y); g.lineTo(x + L, y); g.moveTo(x, y - L); g.lineTo(x, y + L); g.stroke();
    }
  }
  function startGalaxy(cv) {
    let t = 0;
    const draw = () => { try { paintGalaxy(cv); } catch (e) {} };
    draw();
    window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(draw, 200); });
  }

  window.ART = { VARIANTS, alien, robot, alienUri, robotUri, startGalaxy };
})();
