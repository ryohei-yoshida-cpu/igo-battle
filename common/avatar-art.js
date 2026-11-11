/* 共通アバター（囲碁・将棋・オセロなど、どのゲームでも同じものを使う）
 *
 * アバターは6つのパーツの組み合わせ：
 *   face 顔 / hair 髪 / body 体（ポーズ） / top 上の服 / bottom 下の服 / shoes 靴
 * 髪の色と肌の色は無料でえらべる。パーツは銭で買う（price 0 は最初から持っている）。
 *
 * look = { face, hair, body, top, bottom, shoes, hairColor, skin }
 * AVATAR.svg(look)        … アバター1人ぶんの <svg>
 * AVATAR.inner(look)      … <g> の中身だけ（部屋の中などに埋めこむとき）
 * AVATAR.thumb(look, slot)… パーツの見本（そのパーツのあたりを大きく）
 *
 * 絵はすべてSVGで描く（参考画像の「デフォルメ・茶色の線・やわらかい塗り」に合わせた）。
 * 座標：横200 × 縦420。頭のてっぺん y≈30、あご y≈167、足もと y≈410。
 */
(function (root) {
  'use strict';
  const OL = '#4a3226';           // 線の色（こげ茶）
  const LW = 2.4;
  const shade = (hex, k) => {
    const n = parseInt(hex.slice(1), 16);
    let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    const f = v => Math.max(0, Math.min(255, Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k)));
    return '#' + ((1 << 24) | (f(r) << 16) | (f(g) << 8) | f(b)).toString(16).slice(1);
  };
  const st = (fill) => `fill="${fill}" stroke="${OL}" stroke-width="${LW}" stroke-linejoin="round" stroke-linecap="round"`;

  /* ---------- 色（無料） ---------- */
  const SKINS = { light: '#fbdcc2', peach: '#f6c9a4', tan: '#dca57c', brown: '#a8714c' };
  const HAIR_COLORS = { black: '#2b2220', brown: '#3d2a22', chestnut: '#6b4128', blonde: '#e3b75a', red: '#b8452f', silver: '#c9c9d2', pink: '#f08fb0', blue: '#4a6fc2', green: '#3f8a63' };
  const SKIN_NAME = { light: 'しろめ', peach: 'ふつう', tan: '小麦色', brown: '褐色' };
  const HAIR_COLOR_NAME = { black: '黒', brown: 'こげ茶', chestnut: '栗色', blonde: '金', red: '赤', silver: '銀', pink: '桃', blue: '藍', green: '翠' };

  /* ---------- 腕・脚：関節の点をつないで描く ---------- */
  const lenOf = pts => { let s = 0; for (let i = 1; i < pts.length; i++) s += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return s; };
  // 先頭から len ぶんだけの折れ線
  function part(pts, len) {
    const out = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1], [bx, by] = pts[i], d = Math.hypot(bx - ax, by - ay);
      if (len <= d) { out.push([ax + (bx - ax) * len / d, ay + (by - ay) * len / d]); return out; }
      len -= d; out.push(pts[i]);
    }
    return out;
  }
  const pl = pts => 'M' + pts.map(p => p.map(v => v.toFixed(1)).join(' ')).join(' L');
  // 線の太さで手足を描く（外側に線の色、内側に塗り）
  function limb(pts, w, fill) {
    const d = pl(pts);
    return `<path d="${d}" fill="none" stroke="${OL}" stroke-width="${w + LW * 2}" stroke-linecap="round" stroke-linejoin="round"/>` +
      `<path d="${d}" fill="none" stroke="${fill}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
  function hand(p, skin, kind, ang) {
    const [x, y] = p;
    let s = `<circle cx="${x}" cy="${y}" r="9" ${st(skin)}/>`;
    if (kind === 'peace') {
      const a = (ang || -90) * Math.PI / 180;
      for (const da of [-0.28, 0.28]) {
        const ex = x + Math.cos(a + da) * 17, ey = y + Math.sin(a + da) * 17;
        s = `<path d="M${x} ${y} L${ex.toFixed(1)} ${ey.toFixed(1)}" stroke="${OL}" stroke-width="${7 + LW * 2}" stroke-linecap="round"/><path d="M${x} ${y} L${ex.toFixed(1)} ${ey.toFixed(1)}" stroke="${skin}" stroke-width="7" stroke-linecap="round"/>` + s;
      }
    } else if (kind === 'open') {
      s = `<ellipse cx="${x}" cy="${y - 3}" rx="10.5" ry="12" ${st(skin)}/><path d="M${x - 5} ${y - 13} v6 M${x} ${y - 15} v7 M${x + 5} ${y - 13} v6" stroke="${OL}" stroke-width="1.4" fill="none"/>`;
    }
    return s;
  }

  /* ---------- 体（ポーズ） ---------- */
  // 腕: [肩, ひじ, 手首]。 hand: 手の形。 front: 頭より手前に描く
  const SHL = [70, 194], SHR = [130, 194];
  const POSES = {
    stand: { L: [SHL, [60, 242], [62, 288]], R: [SHR, [140, 242], [138, 288]] },
    wave: { L: [SHL, [60, 242], [62, 288]], R: [SHR, [166, 170], [176, 124]], hR: 'open', frontR: true },
    peace: { L: [SHL, [60, 242], [62, 288]], R: [SHR, [164, 200], [156, 156]], hR: 'peace', aR: -75, frontR: true },
    hips: { L: [SHL, [44, 232], [74, 262]], R: [SHR, [156, 232], [126, 262]] },
    banzai: { L: [SHL, [48, 150], [42, 98]], R: [SHR, [152, 150], [158, 98]], hL: 'open', hR: 'open' },
    think: { L: [SHL, [60, 242], [62, 288]], R: [SHR, [148, 236], [118, 172]], frontR: true },
    salute: { L: [SHL, [60, 242], [62, 288]], R: [SHR, [168, 150], [150, 92]], hR: 'open', frontR: true }
  };
  const LEGS = { L: [[86, 282], [85, 340], [86, 392]], R: [[114, 282], [115, 340], [114, 392]] };

  /* ---------- 顔 ---------- */
  function eyes(kind, lash) {
    let s = '';
    for (const x of [75, 125]) {
      const side = x < 100 ? -1 : 1;
      if (kind === 'closed' || (kind === 'wink' && side > 0)) {
        s += `<path d="M${x - 12} ${110} Q${x} ${120} ${x + 12} ${110}" fill="none" stroke="${OL}" stroke-width="3" stroke-linecap="round"/>`;
        continue;
      }
      if (kind === 'sleepy') {
        s += `<path d="M${x - 12} 112 Q${x} 108 ${x + 12} 112" fill="none" stroke="${OL}" stroke-width="3" stroke-linecap="round"/><path d="M${x - 9} 113 Q${x} 121 ${x + 9} 113 Z" fill="#6b4630"/>`;
        continue;
      }
      if (kind === 'cool') {
        s += `<path d="M${x - 12} 106 Q${x} 101 ${x + 12} 106 L${x + 11} 114 Q${x} 119 ${x - 11} 114 Z" fill="#fff" stroke="${OL}" stroke-width="1.6"/>` +
          `<ellipse cx="${x + side * 1}" cy="111" rx="7" ry="7" fill="#5a3b2a"/><circle cx="${x + side * 1}" cy="111" r="3.4" fill="#1e1410"/><circle cx="${x + side * 1 - 2.5}" cy="108.5" r="2" fill="#fff"/>` +
          `<path d="M${x - 13} 105 Q${x} 99 ${x + 13} 105" fill="none" stroke="${OL}" stroke-width="3.4" stroke-linecap="round"/>`;
        continue;
      }
      const big = kind === 'kirari' ? 1.14 : 1, ry = 15 * big, rx = 12.5 * big, cy = 112;
      s += `<ellipse cx="${x}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#fff" stroke="${OL}" stroke-width="1.4"/>` +
        `<ellipse cx="${x}" cy="${cy + 2}" rx="${9.5 * big}" ry="${12 * big}" fill="#7a4a2c"/>` +
        `<ellipse cx="${x}" cy="${cy + 5}" rx="${7.5 * big}" ry="${8 * big}" fill="#5a331d"/>` +
        `<circle cx="${x}" cy="${cy + 3}" r="${4.4 * big}" fill="#1e1410"/>` +
        `<circle cx="${x - 4}" cy="${cy - 4}" r="${3.6 * big}" fill="#fff"/><circle cx="${x + 4}" cy="${cy + 7}" r="${1.7 * big}" fill="#fff"/>` +
        `<path d="M${x - rx - 1} ${cy - 5} Q${x} ${cy - ry - 6} ${x + rx + 1} ${cy - 5}" fill="none" stroke="${OL}" stroke-width="3.6" stroke-linecap="round"/>`;
      if (kind === 'kirari') s += `<path d="M${x + 5} ${cy - 1} l1.6 3.4 3.4 1.6 -3.4 1.6 -1.6 3.4 -1.6 -3.4 -3.4 -1.6 3.4 -1.6z" fill="#fff"/>`;
      if (lash) s += `<path d="M${x + side * (rx - 1)} ${cy - 8} l${side * 6} -4 M${x + side * (rx - 4)} ${cy - 12} l${side * 5} -5" stroke="${OL}" stroke-width="2.2" stroke-linecap="round"/>`;
    }
    return s;
  }
  const brows = (y, tilt) => `<path d="M64 ${y + tilt} Q75 ${y - 4} 86 ${y}" fill="none" stroke="#5a3b2a" stroke-width="2.4" stroke-linecap="round"/><path d="M114 ${y} Q125 ${y - 4} 136 ${y + tilt}" fill="none" stroke="#5a3b2a" stroke-width="2.4" stroke-linecap="round"/>`;
  const blush = `<ellipse cx="64" cy="133" rx="9" ry="5" fill="#f28c8c" opacity=".45"/><ellipse cx="136" cy="133" rx="9" ry="5" fill="#f28c8c" opacity=".45"/>`;
  const nose = `<path d="M99 127 q2 2 3 0" fill="none" stroke="#c9876a" stroke-width="1.8" stroke-linecap="round"/>`;
  const MOUTH = {
    smile: `<path d="M91 141 Q100 149 109 141" fill="none" stroke="${OL}" stroke-width="2.4" stroke-linecap="round"/>`,
    open: `<path d="M89 139 Q100 141 111 139 Q108 154 100 154 Q92 154 89 139 Z" fill="#c84a4a" stroke="${OL}" stroke-width="2"/><path d="M93 149 Q100 145 107 149 Q104 153 100 153 Q96 153 93 149Z" fill="#f08a8a"/>`,
    flat: `<path d="M93 144 L107 144" stroke="${OL}" stroke-width="2.4" stroke-linecap="round"/>`,
    cat: `<path d="M89 140 Q94 147 100 141 Q106 147 111 140" fill="none" stroke="${OL}" stroke-width="2.4" stroke-linecap="round"/>`,
    smirk: `<path d="M92 144 Q102 147 110 139" fill="none" stroke="${OL}" stroke-width="2.4" stroke-linecap="round"/>`,
    o: `<ellipse cx="100" cy="145" rx="4.5" ry="5.5" fill="#c84a4a" stroke="${OL}" stroke-width="2"/>`
  };
  const FACES = {
    girl: { eyes: 'round', lash: true, mouth: 'smile', brow: 0 },
    boy: { eyes: 'round', mouth: 'smile', brow: 2 },
    genki: { eyes: 'round', lash: true, mouth: 'open', brow: -1 },
    cool: { eyes: 'cool', mouth: 'smirk', brow: 4 },
    kirari: { eyes: 'kirari', lash: true, mouth: 'open', brow: -1 },
    wink: { eyes: 'wink', lash: true, mouth: 'open', brow: 0 },
    neko: { eyes: 'closed', mouth: 'cat', brow: 0, extra: 'whisker' },
    megane: { eyes: 'round', mouth: 'smile', brow: 2, extra: 'glasses' },
    sleepy: { eyes: 'sleepy', mouth: 'o', brow: -2, extra: 'zzz' }
  };
  function drawFace(id) {
    const f = FACES[id] || FACES.girl;
    let s = brows(91, f.brow) + eyes(f.eyes, f.lash) + nose + blush + MOUTH[f.mouth];
    if (f.extra === 'glasses') s += `<g fill="rgba(255,255,255,.18)" stroke="#2c2c3a" stroke-width="2.6"><rect x="58" y="98" width="34" height="27" rx="9"/><rect x="108" y="98" width="34" height="27" rx="9"/></g><path d="M92 108 Q100 103 108 108 M58 106 L44 103 M142 106 L156 103" stroke="#2c2c3a" stroke-width="2.6" fill="none"/>`;
    if (f.extra === 'whisker') s += `<path d="M52 136 l-12 -3 M52 141 l-12 2 M148 136 l12 -3 M148 141 l12 2" stroke="${OL}" stroke-width="1.6" stroke-linecap="round"/>`;
    if (f.extra === 'zzz') s += `<text x="150" y="70" font-size="18" font-weight="900" fill="#7aa4e0" font-family="system-ui">z</text><text x="162" y="54" font-size="13" font-weight="900" fill="#7aa4e0" font-family="system-ui">z</text>`;
    return s;
  }

  /* ---------- 髪（後ろ・前） ---------- */
  // c: 髪の色。 back は頭より奥、front は顔より手前
  const HAIRS = {
    long: { // ロング（ウェーブ）… 参考画像の女の子
      back: c => `<path d="M30 92 C26 40 64 18 100 18 C138 18 174 40 170 92 C172 140 186 170 176 210 C186 240 168 262 172 290 C150 300 140 280 132 296 C118 278 128 250 120 230 L80 230 C72 250 82 278 68 296 C60 280 50 300 28 290 C32 262 14 240 24 210 C14 170 28 140 30 92 Z" ${st(c)}/>` +
        `<path d="M40 150 C34 190 44 220 36 250 M160 150 C166 190 156 220 164 250 M52 200 C48 230 58 250 50 276 M148 200 C152 230 142 250 150 276" fill="none" stroke="${shade(c, -0.35)}" stroke-width="2"/>`,
      front: c => `<path d="M38 104 C34 58 66 30 100 30 C136 30 166 58 162 104 C152 90 144 72 136 62 C130 76 114 86 96 88 C104 78 104 70 100 62 C90 78 72 88 54 94 C50 98 44 102 38 104 Z" ${st(c)}/>` +
        `<path d="M38 104 C36 130 44 150 40 176 C34 196 44 214 38 232 C52 222 58 198 52 176 C58 156 50 128 54 106 Z" ${st(c)}/>` +
        `<path d="M162 104 C164 130 156 150 160 176 C166 196 156 214 162 232 C148 222 142 198 148 176 C142 156 150 128 146 106 Z" ${st(c)}/>` +
        `<path d="M76 46 C90 40 110 40 124 46" fill="none" stroke="${shade(c, 0.35)}" stroke-width="4" stroke-linecap="round" opacity=".7"/>`
    },
    short: { // ショート … 参考画像の男の子
      back: c => `<path d="M34 104 C26 50 62 22 100 22 C140 22 176 50 166 104 C164 120 158 126 154 130 L46 130 C42 126 36 120 34 104 Z" ${st(c)}/>`,
      front: c => `<path d="M36 108 C30 56 64 26 102 26 C116 18 126 12 132 18 C126 22 124 26 126 30 C152 40 170 64 164 108 C158 96 154 82 148 74 C146 86 140 96 134 100 C132 88 128 78 122 72 C116 88 104 96 90 98 C96 88 96 80 94 74 C84 88 70 96 56 98 C60 88 60 82 58 78 C48 88 42 98 36 108 Z" ${st(c)}/>` +
        `<path d="M70 48 C86 40 112 38 130 46" fill="none" stroke="${shade(c, 0.35)}" stroke-width="4" stroke-linecap="round" opacity=".6"/>`
    },
    bob: {
      back: c => `<path d="M30 100 C26 46 64 20 100 20 C136 20 174 46 170 100 C172 140 168 168 164 182 L36 182 C32 168 28 140 30 100 Z" ${st(c)}/>`,
      front: c => `<path d="M38 100 C34 54 66 28 100 28 C134 28 166 54 162 100 L156 92 L44 92 Z" ${st(c)}/>` +
        `<path d="M38 96 C34 140 38 164 42 180 L56 180 C52 160 50 130 52 92 Z M162 96 C166 140 162 164 158 180 L144 180 C148 160 150 130 148 92 Z" ${st(c)}/>` +
        `<path d="M70 46 C90 38 112 38 130 46" fill="none" stroke="${shade(c, 0.35)}" stroke-width="4" stroke-linecap="round" opacity=".6"/>`
    },
    pony: {
      back: c => `<path d="M150 60 C190 70 196 120 184 170 C178 200 186 230 176 256 C166 236 160 210 164 186 C170 150 166 110 148 84 Z" ${st(c)}/>` +
        `<path d="M34 104 C26 50 62 22 100 22 C140 22 176 50 166 104 L34 104 Z" ${st(c)}/>`,
      front: c => `<path d="M38 110 C32 58 66 30 100 30 C134 30 168 58 162 110 C156 96 150 84 142 78 C126 92 96 100 66 94 C58 100 46 104 38 110 Z" ${st(c)}/>` +
        `<circle cx="152" cy="66" r="7" fill="#e0503e" stroke="${OL}" stroke-width="2"/>`
    },
    twin: {
      back: c => `<path d="M34 104 C26 50 62 22 100 22 C140 22 176 50 166 104 L34 104 Z" ${st(c)}/>` +
        `<path d="M34 72 C6 90 4 140 14 180 C20 210 12 240 26 262 C36 236 30 210 36 186 C42 150 44 110 42 86 Z" ${st(c)}/>` +
        `<path d="M166 72 C194 90 196 140 186 180 C180 210 188 240 174 262 C164 236 170 210 164 186 C158 150 156 110 158 86 Z" ${st(c)}/>`,
      front: c => `<path d="M38 108 C32 56 66 30 100 30 C134 30 168 56 162 108 C154 96 146 84 138 80 L128 92 L118 80 L100 94 L84 80 L72 92 L62 80 C54 86 44 98 38 108 Z" ${st(c)}/>` +
        `<circle cx="40" cy="76" r="8" fill="#f08fb0" stroke="${OL}" stroke-width="2"/><circle cx="160" cy="76" r="8" fill="#f08fb0" stroke="${OL}" stroke-width="2"/>`
    },
    bun: {
      back: c => `<circle cx="100" cy="18" r="22" ${st(c)}/><path d="M34 104 C26 50 62 24 100 24 C140 24 176 50 166 104 L34 104 Z" ${st(c)}/>`,
      front: c => `<path d="M38 108 C34 58 66 32 100 32 C134 32 166 58 162 108 C150 92 140 82 128 78 C116 90 84 90 72 78 C60 82 48 92 38 108 Z" ${st(c)}/>` +
        `<path d="M86 6 C94 2 106 2 114 6" fill="none" stroke="${shade(c, 0.4)}" stroke-width="3" stroke-linecap="round"/><path d="M118 2 L136 -8" stroke="#c9a24a" stroke-width="3" stroke-linecap="round"/><circle cx="137" cy="-9" r="4" fill="#e0503e"/>`
    },
    spiky: {
      back: c => `<path d="M34 104 C26 50 62 22 100 22 C140 22 176 50 166 104 L34 104 Z" ${st(c)}/>`,
      front: c => `<path d="M36 108 L30 74 L46 82 L40 44 L62 60 L64 22 L84 46 L100 10 L114 44 L136 20 L138 58 L162 42 L156 80 L172 72 L164 108 C156 96 150 88 144 84 L136 98 L126 84 L114 98 L100 84 L86 98 L74 84 L64 98 L56 84 C48 90 42 98 36 108 Z" ${st(c)}/>`
    },
    hime: {
      back: c => `<path d="M30 96 C26 44 64 18 100 18 C136 18 174 44 170 96 L172 300 L28 300 Z" ${st(c)}/><path d="M50 160 V296 M150 160 V296 M70 220 V296 M130 220 V296" stroke="${shade(c, -0.35)}" stroke-width="1.8"/>`,
      front: c => `<path d="M38 110 C34 56 66 28 100 28 C134 28 166 56 162 110 L162 96 L38 96 Z" ${st(c)}/>` +
        `<path d="M38 96 L38 170 L58 170 L58 100 Z M162 96 L162 170 L142 170 L142 100 Z" ${st(c)}/>` +
        `<path d="M70 44 C90 36 112 36 130 44" fill="none" stroke="${shade(c, 0.35)}" stroke-width="4" stroke-linecap="round" opacity=".6"/>`
    },
    chonmage: { // ちょんまげ（月代は肌色）
      back: c => `<path d="M34 104 C30 76 36 60 44 54 L156 54 C164 60 170 76 166 104 Z" ${st(c)}/>`,
      front: (c, skin) => `<path d="M44 92 C46 60 70 40 100 40 C130 40 154 60 156 92 C140 80 120 74 100 74 C80 74 60 80 44 92 Z" ${st(skin)}/>` +
        `<path d="M92 40 C90 28 96 18 104 14 C120 8 134 12 140 20 C128 18 116 22 110 32 L108 40 Z" ${st(c)}/><path d="M96 36 L110 36" stroke="#fff" stroke-width="3"/>` +
        `<path d="M36 108 C36 96 40 86 46 82 L52 104 Z M164 108 C164 96 160 86 154 82 L148 104 Z" ${st(c)}/>`
    },
    curly: {
      back: c => [[50, 60], [80, 34], [120, 34], [150, 60], [164, 100], [158, 140], [42, 140], [36, 100], [100, 28]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="30" ${st(c)}/>`).join(''),
      front: c => [[54, 66], [78, 50], [102, 46], [126, 50], [150, 66]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="18" ${st(c)}/>`).join('') +
        `<path d="M50 96 C70 84 130 84 150 96" fill="none" stroke="none"/>`
    }
  };

  /* ---------- 上の服 ---------- */
  // 胴：肩から腰まで。 sleeve: none | short | long | wide
  const TORSO = 'M88 176 L112 176 C122 180 132 184 138 192 L134 238 C134 252 132 264 132 278 L68 278 C68 264 66 252 66 238 L62 192 C68 184 78 180 88 176 Z';
  const TOPS = {
    tee_white: { sleeve: 'short', color: '#f6f4ef', draw: c => `<path d="${TORSO}" ${st(c)}/><path d="M86 177 Q100 192 114 177" fill="none" stroke="${OL}" stroke-width="2"/><path d="M84 176 Q100 196 116 176" fill="none" stroke="${shade(c, -0.12)}" stroke-width="3"/>` },
    tee_grey: { sleeve: 'short', color: '#c6c8cc', draw: c => TOPS.tee_white.draw(c) },
    tank: { sleeve: 'none', color: '#f2c84b', draw: c => `<path d="M80 180 L90 180 Q100 198 110 180 L120 180 L130 200 L132 278 L68 278 L70 200 Z" ${st(c)}/>` },
    hoodie: { sleeve: 'long', color: '#6f8fc9', draw: c => `<path d="M70 186 C70 168 130 168 130 186" ${st(shade(c, -0.15))}/><path d="${TORSO}" ${st(c)}/><path d="M86 178 Q100 196 114 178" ${st(shade(c, -0.15))}/><path d="M94 192 v26 M106 192 v26" stroke="#f6f4ef" stroke-width="2.4" stroke-linecap="round"/><path d="M78 240 L122 240 L118 266 L82 266 Z" fill="${shade(c, -0.12)}" stroke="${OL}" stroke-width="2"/>` },
    sweater: { sleeve: 'long', color: '#e98a6a', draw: c => `<path d="${TORSO}" ${st(c)}/><path d="M66 214 L134 214 M66 230 L134 230 M67 246 L133 246" stroke="#fff6ea" stroke-width="5"/><path d="M86 177 Q100 192 114 177" fill="none" stroke="${OL}" stroke-width="2"/><path d="${TORSO}" fill="none" stroke="${OL}" stroke-width="${LW}"/>` },
    kimono: { sleeve: 'wide', color: '#3d5a9c', style: 'wa', draw: c => `<path d="${TORSO}" ${st(c)}/><path d="M86 177 L100 214 L114 177" fill="none" stroke="#f6f4ef" stroke-width="6"/><path d="M86 177 L100 214 L114 177" fill="none" stroke="${OL}" stroke-width="1.6"/><path d="M114 177 L80 250" stroke="${OL}" stroke-width="1.6"/><rect x="66" y="236" width="68" height="20" fill="#e8c46e" stroke="${OL}" stroke-width="2"/><path d="M66 246 H134" stroke="#c0392b" stroke-width="3"/><path d="M76 196 l4 4 M120 222 l4 4 M84 268 l4 4 M118 262 l4 4" stroke="#f7b6c8" stroke-width="3" stroke-linecap="round"/>` },
    happi: { sleeve: 'wide', color: '#2f5fb0', style: 'wa', draw: c => `<path d="${TORSO}" ${st(c)}/><path d="M86 177 L92 278 M114 177 L108 278" stroke="#f6f4ef" stroke-width="8"/><path d="M86 177 L92 278 M114 177 L108 278" stroke="${OL}" stroke-width="1.4"/><text x="100" y="246" text-anchor="middle" font-size="22" font-weight="900" fill="#f6f4ef" font-family="serif">祭</text><path d="M66 266 H134" stroke="#f6f4ef" stroke-width="4"/>` },
    china: { sleeve: 'short', color: '#c0392b', style: 'chu', draw: c => `<path d="${TORSO}" ${st(c)}/><rect x="88" y="170" width="24" height="10" rx="3" ${st(c)}/><path d="M112 180 C108 196 96 202 82 206" fill="none" stroke="#e8c46e" stroke-width="2.6"/><path d="M98 194 h8 M90 202 h8 M100 220 h8 M100 240 h8 M100 260 h8" stroke="#e8c46e" stroke-width="3" stroke-linecap="round"/><path d="M66 238 l6 4 -6 4 M134 238 l-6 4 6 4" stroke="#e8c46e" stroke-width="2" fill="none"/>` },
    blazer: { sleeve: 'long', color: '#2e3a5c', style: 'yo', draw: c => `<path d="${TORSO}" ${st(c)}/><path d="M88 177 L100 230 L112 177 Z" fill="#f6f4ef" stroke="${OL}" stroke-width="2"/><path d="M96 186 L104 186 L102 222 L100 228 L98 222 Z" fill="#c0392b" stroke="${OL}" stroke-width="1.4"/><path d="M88 177 L80 214 L100 230 M112 177 L120 214 L100 230" fill="none" stroke="${OL}" stroke-width="2"/><circle cx="100" cy="244" r="3" fill="#e8c46e"/><circle cx="100" cy="260" r="3" fill="#e8c46e"/><path d="M114 210 h12" stroke="#e8c46e" stroke-width="2"/>` },
    sailor: { sleeve: 'short', color: '#f6f4ef', style: 'yo', draw: c => `<path d="${TORSO}" ${st(c)}/><path d="M66 192 L88 176 L100 214 L112 176 L134 192 L130 214 L104 218 L100 214 L96 218 L70 214 Z" fill="#2e3a6c" stroke="${OL}" stroke-width="2"/><path d="M70 208 L128 208" stroke="#f6f4ef" stroke-width="2"/><path d="M100 214 L88 236 L100 228 L112 236 Z" fill="#c0392b" stroke="${OL}" stroke-width="1.6"/>` }
  };

  /* ---------- 下の服 ---------- */
  const BOTTOMS = {
    shorts_denim: { color: '#7fa6d4', draw: c => `<path d="M68 266 L132 266 L134 318 L102 320 L100 296 L98 320 L66 318 Z" ${st(c)}/><path d="M66 312 L98 314 M102 314 L134 312" stroke="${shade(c, -0.2)}" stroke-width="4"/><path d="M100 268 V292 M74 276 Q82 282 86 270 M126 276 Q118 282 114 270" fill="none" stroke="${shade(c, -0.3)}" stroke-width="1.6"/><circle cx="100" cy="272" r="2" fill="#c9a24a"/>` },
    shorts_light: { color: '#a9c8e8', draw: c => BOTTOMS.shorts_denim.draw(c) },
    jeans: { color: '#3f5f94', legs: true, draw: c => `<path d="M68 266 L132 266 L130 392 L104 392 L100 300 L96 392 L70 392 Z" ${st(c)}/><path d="M100 268 V296 M74 276 Q82 282 86 270 M126 276 Q118 282 114 270 M86 300 L86 380 M114 300 L114 380" fill="none" stroke="${shade(c, -0.3)}" stroke-width="1.4"/>` },
    cargo: { color: '#8a8558', draw: c => `<path d="M68 266 L132 266 L132 344 L104 344 L100 300 L96 344 L68 344 Z" ${st(c)}/><rect x="70" y="300" width="18" height="20" rx="3" fill="${shade(c, -0.12)}" stroke="${OL}" stroke-width="1.6"/><rect x="112" y="300" width="18" height="20" rx="3" fill="${shade(c, -0.12)}" stroke="${OL}" stroke-width="1.6"/>` },
    skirt: { color: '#e0798f', draw: c => `<path d="M70 262 L130 262 L144 322 L56 322 Z" ${st(c)}/><path d="M70 270 H130" stroke="${shade(c, -0.2)}" stroke-width="3"/>` },
    pleats: { color: '#2e3a6c', style: 'yo', draw: c => `<path d="M70 262 L130 262 L146 320 L54 320 Z" ${st(c)}/><path d="M80 266 L70 320 M90 266 L86 320 M100 266 L100 320 M110 266 L114 320 M120 266 L130 320" stroke="${shade(c, -0.35)}" stroke-width="1.6"/><path d="M56 314 L144 314" stroke="#f6f4ef" stroke-width="2"/>` },
    hakama: { color: '#5b2a3a', style: 'wa', legs: true, draw: c => `<path d="M66 256 L134 256 L150 392 L104 392 L100 330 L96 392 L50 392 Z" ${st(c)}/><path d="M84 260 L76 390 M116 260 L124 390 M92 262 L90 330" stroke="${shade(c, -0.35)}" stroke-width="1.6"/><path d="M66 260 H134" stroke="#e8c46e" stroke-width="3"/>` },
    kungfu: { color: '#1f1f26', style: 'chu', legs: true, draw: c => `<path d="M66 266 L134 266 L138 382 L104 382 L100 300 L96 382 L62 382 Z" ${st(c)}/><path d="M62 376 L96 376 M104 376 L138 376" stroke="#c0392b" stroke-width="5"/><path d="M66 270 H134" stroke="#c0392b" stroke-width="4"/>` }
  };

  /* ---------- 靴（くつ下つき） ---------- */
  const foot = (x, d) => `<g transform="translate(${x} 410) scale(1.18) translate(0 -410)">${d}</g>`;
  const SHOES = {
    sneaker_olive: { color: '#6f7b3c', socks: '#7c7f86', draw: c => [-14, 14].map(dx => foot(100 + dx, `<path d="M-15 400 C-15 388 -8 384 0 384 C8 384 15 388 15 400 C15 408 10 410 0 410 C-10 410 -15 408 -15 400 Z" ${st(c)}/><path d="M-15 402 C-10 410 10 410 15 402" fill="none" stroke="#f1ead8" stroke-width="4"/><path d="M-8 389 Q0 393 8 389" fill="none" stroke="${shade(c, -0.3)}" stroke-width="1.6"/>`)).join('') },
    sneaker_red: { color: '#d64535', socks: '#f6f4ef', draw: c => SHOES.sneaker_olive.draw(c) },
    loafer: { color: '#6b3d22', socks: '#2a2a33', style: 'yo', draw: c => [-14, 14].map(dx => foot(100 + dx, `<path d="M-14 402 C-14 390 -8 386 0 386 C8 386 14 390 14 402 C14 408 8 410 0 410 C-8 410 -14 408 -14 402 Z" ${st(c)}/><path d="M-7 392 H7" stroke="#e8c46e" stroke-width="2"/>`)).join('') },
    boots: { color: '#5a3a2a', socks: null, draw: c => [-14, 14].map(dx => foot(100 + dx, `<path d="M-12 344 L12 344 L13 396 C16 400 16 410 0 410 C-14 410 -16 404 -14 398 Z" ${st(c)}/><path d="M-12 352 H12" stroke="${shade(c, 0.25)}" stroke-width="3"/><path d="M-15 404 C-8 410 8 410 15 404" fill="none" stroke="#2a1a12" stroke-width="3"/>`)).join('') },
    geta: { color: '#c9a06a', socks: '#f6f4ef', style: 'wa', draw: c => [-14, 14].map(dx => foot(100 + dx, `<path d="M-11 384 C-11 380 11 380 11 384 L11 400 C11 404 -11 404 -11 400 Z" fill="#f6f4ef" stroke="${OL}" stroke-width="1.8"/><rect x="-15" y="400" width="30" height="6" rx="2" ${st(c)}/><rect x="-11" y="406" width="6" height="5" fill="${shade(c, -0.3)}"/><rect x="5" y="406" width="6" height="5" fill="${shade(c, -0.3)}"/><path d="M-9 400 L0 389 L9 400" fill="none" stroke="#c0392b" stroke-width="3"/>`)).join('') },
    sandal: { color: '#3aa7a0', socks: null, draw: (c, skin) => [-14, 14].map(dx => foot(100 + dx, `<path d="M-12 402 C-12 390 12 390 12 402 C12 408 -12 408 -12 402 Z" ${st(skin)}/><rect x="-15" y="404" width="30" height="6" rx="3" ${st(c)}/><path d="M-11 396 H11 M-6 390 L6 400" stroke="${c}" stroke-width="4"/>`)).join('') },
    kungfu_shoe: { color: '#26262e', socks: '#f6f4ef', style: 'chu', draw: c => [-14, 14].map(dx => foot(100 + dx, `<path d="M-14 402 C-14 392 -8 388 0 388 C8 388 14 392 14 402 C14 408 8 410 0 410 C-8 410 -14 408 -14 402 Z" ${st(c)}/><path d="M-15 405 C-8 411 8 411 15 405" fill="none" stroke="#f6f4ef" stroke-width="3"/>`)).join('') }
  };

  /* ---------- カタログ（名前・値段） ---------- */
  const CATALOG = {
    face: [['girl', 'にっこり', 0], ['boy', 'すまし', 0], ['genki', 'げんき', 300], ['wink', 'ウインク', 400], ['cool', 'クール', 400], ['neko', 'ねこ口', 450], ['megane', 'めがね', 500], ['kirari', 'きらきら', 500], ['sleepy', 'ねむねむ', 300]],
    hair: [['long', 'ロング', 0], ['short', 'ショート', 0], ['bob', 'ボブ', 400], ['pony', 'ポニーテール', 500], ['twin', 'ツインテール', 600], ['bun', 'おだんご', 500], ['spiky', 'ツンツン', 500], ['hime', '姫カット', 700], ['curly', 'もこもこ', 600], ['chonmage', 'ちょんまげ', 1200]],
    body: [['stand', '気をつけ', 0], ['wave', '手をふる', 600], ['peace', 'ピース', 800], ['hips', '腰に手', 700], ['banzai', 'ばんざい', 900], ['think', '考えちゅう', 900], ['salute', 'けいれい', 800]],
    top: [['tee_white', '白Tシャツ', 0], ['tee_grey', 'グレーTシャツ', 0], ['tank', 'タンクトップ', 400], ['sweater', 'しましまセーター', 700], ['hoodie', 'パーカー', 800], ['blazer', 'ブレザー', 1200], ['sailor', 'セーラー服', 1300], ['happi', '法被', 1200], ['kimono', '着物', 1500], ['china', 'チャイナ服', 1500]],
    bottom: [['shorts_denim', 'デニムショーツ', 0], ['shorts_light', '水色ショーツ', 0], ['jeans', 'ジーンズ', 600], ['cargo', 'カーゴパンツ', 700], ['skirt', 'スカート', 600], ['pleats', 'プリーツスカート', 800], ['hakama', '袴', 1500], ['kungfu', 'カンフーパンツ', 900]],
    shoes: [['sneaker_olive', 'オリーブのスニーカー', 0], ['sneaker_red', '赤いスニーカー', 400], ['loafer', 'ローファー', 700], ['boots', 'ブーツ', 900], ['geta', '下駄', 800], ['sandal', 'サンダル', 400], ['kungfu_shoe', 'カンフーシューズ', 600]]
  };
  const SLOTS = [['face', '顔'], ['hair', '髪'], ['body', '体（ポーズ）'], ['top', '上の服'], ['bottom', '下の服'], ['shoes', '靴']];
  const PRICE = {};
  for (const [slot, list] of Object.entries(CATALOG)) for (const [id, , price] of list) PRICE[slot + ':' + id] = price;
  const DEFAULT = { face: 'girl', hair: 'long', body: 'stand', top: 'tee_grey', bottom: 'shorts_denim', shoes: 'sneaker_olive', hairColor: 'brown', skin: 'peach' };
  const PRESETS = {   // 参考画像の2人
    girl: { face: 'girl', hair: 'long', body: 'stand', top: 'tee_grey', bottom: 'shorts_denim', shoes: 'sneaker_olive', hairColor: 'brown', skin: 'peach' },
    boy: { face: 'boy', hair: 'short', body: 'stand', top: 'tee_grey', bottom: 'shorts_light', shoes: 'sneaker_olive', hairColor: 'brown', skin: 'peach' }
  };
  function clean(look) {
    const l = Object.assign({}, DEFAULT, look || {});
    for (const slot of Object.keys(CATALOG)) if (PRICE[slot + ':' + l[slot]] == null) l[slot] = DEFAULT[slot];
    if (!HAIR_COLORS[l.hairColor]) l.hairColor = DEFAULT.hairColor;
    if (!SKINS[l.skin]) l.skin = DEFAULT.skin;
    return l;
  }

  /* ---------- 組み立て ---------- */
  function inner(look) {
    const l = clean(look);
    const skin = SKINS[l.skin], hc = HAIR_COLORS[l.hairColor];
    const pose = POSES[l.body], top = TOPS[l.top], bot = BOTTOMS[l.bottom], shoe = SHOES[l.shoes], hair = HAIRS[l.hair];
    let s = `<ellipse cx="100" cy="410" rx="44" ry="7" fill="rgba(0,0,0,.18)"/>`;
    s += hair.back(hc, skin);
    // 脚・くつ下・靴
    s += limb(LEGS.L, 20, skin) + limb(LEGS.R, 20, skin);
    if (shoe.socks) for (const L of [LEGS.L, LEGS.R]) s += limb([[L[2][0], 366], [L[2][0], 390]], 21, shoe.socks);
    s += shoe.draw(shoe.color, skin);
    s += bot.draw(bot.color);
    // 腕（奥）・胴
    const arm = (pts, h, ang) => {
      let a = limb(pts, 15, skin);
      const total = lenOf(pts);
      if (top.sleeve === 'short') a += limb(part(pts, 30), 21, top.color);
      else if (top.sleeve === 'long') a += limb(part(pts, total - 4), 19, top.color);
      else if (top.sleeve === 'wide') a += limb(part(pts, total - 6), 26, top.color);
      return a + hand(pts[2], skin, h, ang);
    };
    const armL = arm(pose.L, pose.hL, pose.aL), armR = arm(pose.R, pose.hR, pose.aR);
    s += `<rect x="89" y="150" width="22" height="34" rx="6" ${st(skin)}/>`;   // 首
    s += top.draw(top.color);
    if (!pose.frontL) s += armL;
    if (!pose.frontR) s += armR;
    // 頭
    s += `<ellipse cx="40" cy="112" rx="9" ry="13" ${st(skin)}/><ellipse cx="160" cy="112" rx="9" ry="13" ${st(skin)}/>`;
    s += `<path d="M40 100 C40 56 70 36 100 36 C130 36 160 56 160 100 C160 136 136 166 100 168 C64 166 40 136 40 100 Z" ${st(skin)}/>`;
    s += `<g transform="translate(0 5)">${drawFace(l.face)}</g>`;
    s += hair.front(hc, skin);
    if (pose.frontL) s += armL;
    if (pose.frontR) s += armR;
    return s;
  }
  const svg = (look, cls) => `<svg viewBox="0 -14 200 432" class="${cls || 'av-svg'}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${inner(look)}</svg>`;
  // パーツの見本：そのパーツのあたりを切り取って大きく見せる
  const CROP = { face: '30 30 140 150', hair: '0 -14 200 320', body: '10 70 180 350', top: '20 150 160 150', bottom: '30 240 140 170', shoes: '50 340 100 76' };
  const thumb = (look, slot) => `<svg viewBox="${CROP[slot] || '0 -14 200 432'}" class="av-thumb" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${inner(look)}</svg>`;

  const api = { CATALOG, SLOTS, PRICE, DEFAULT, PRESETS, SKINS, HAIR_COLORS, SKIN_NAME, HAIR_COLOR_NAME, clean, inner, svg, thumb };
  root.AVATAR = api;
})(typeof window !== 'undefined' ? window : globalThis);
