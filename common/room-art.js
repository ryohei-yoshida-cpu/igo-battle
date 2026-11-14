/* 囲碁BLITZ — マイルームの絵（アイソメトリック＝ななめ上から見た部屋）
 * 家具はすべて「箱」「円柱」「面の上の四角や丸」の組み合わせでコード描画する。
 *   座標：床のマス (x, y)、高さ z（1マス＝1）。x と y が大きいほど手前。
 *   床の家具は w×d マス。回転（rot=1）すると x と y を入れかえる。
 *   壁の家具は左の壁（x=0）か右の壁（y=0）に、u（壁ぞいの位置）と v（床からの高さ）で置く。
 */
(function () {
  const N = 12, WH = 6.5;                 // 部屋の広さ（12×12マス）と壁の高さ
  const TW = 32, TH = 16, TZ = 17;        // 1マスの絵の大きさ
  const PAD = 14;
  const OX = N * TW / 2 + PAD, OY = WH * TZ + PAD;
  const W = N * TW + PAD * 2, H = WH * TZ + N * TH + PAD * 2 + 10;
  const proj = (x, y, z) => [OX + (x - y) * TW / 2, OY + (x + y) * TH / 2 - z * TZ];

  /* ---------- 色 ---------- */
  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    if (f >= 0) { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; }
    else { r *= 1 + f; g *= 1 + f; b *= 1 + f; }
    return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  }
  const P = pts => pts.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');

  /* ---------- 家具の部品を作る道具 ---------- */
  // 家具ひとつぶんの描画命令を集める。rot=1 なら x と y を入れかえて出力する
  function Maker(ox, oy, rot) {
    const out = [];
    const T = (x, y, z) => rot ? proj(ox + y, oy + x, z) : proj(ox + x, oy + y, z);
    const poly = (pts3, fill, extra) => out.push(`<polygon points="${P(pts3.map(p => T(p[0], p[1], p[2])))}" fill="${fill}"${extra || ''}/>`);
    const m = {
      out, T, poly,
      // 箱：上面・手前（y+d の面）・右（x+w の面）
      box(x, y, z, w, d, h, c, opt) {
        const o = opt || {};
        const t = z + h;
        const top = [[x, y, t], [x + w, y, t], [x + w, y + d, t], [x, y + d, t]];
        const fr = [[x, y + d, z], [x + w, y + d, z], [x + w, y + d, t], [x, y + d, t]];
        const sd = [[x + w, y, z], [x + w, y + d, z], [x + w, y + d, t], [x + w, y, t]];
        const st = o.stroke ? ` stroke="${o.stroke}" stroke-width=".6" stroke-linejoin="round"` : '';
        // 回転したら手前と右が入れかわるので、明るさも入れかえて光の向きをそろえる
        const cF = shade(c, rot ? -0.28 : -0.12), cS = shade(c, rot ? -0.12 : -0.28);
        if (h > 0) { poly(fr, o.front || cF, st); poly(sd, o.side || cS, st); }
        poly(top, o.top || shade(c, 0.12), st);
        return { x, y, z, w, d, h };
      },
      // 箱の面に四角を描く。face='F'（手前 y+d）/'S'（右 x+w）。u は面ぞい、v は下からの高さ
      rect(b, face, u0, v0, u1, v1, fill, extra) {
        if (face === 'F') poly([[b.x + u0, b.y + b.d, b.z + v0], [b.x + u1, b.y + b.d, b.z + v0], [b.x + u1, b.y + b.d, b.z + v1], [b.x + u0, b.y + b.d, b.z + v1]], fill, extra);
        else poly([[b.x + b.w, b.y + u0, b.z + v0], [b.x + b.w, b.y + u1, b.z + v0], [b.x + b.w, b.y + u1, b.z + v1], [b.x + b.w, b.y + u0, b.z + v1]], fill, extra);
      },
      circleOn(b, face, cu, cv, r, fill, extra) {
        const pts = [];
        for (let i = 0; i < 18; i++) {
          const a = i / 18 * Math.PI * 2, u = cu + Math.cos(a) * r, v = cv + Math.sin(a) * r;
          pts.push(face === 'F' ? [b.x + u, b.y + b.d, b.z + v] : [b.x + b.w, b.y + u, b.z + v]);
        }
        poly(pts, fill, extra);
      },
      // 水平な円（テーブルの天板など）
      disc(cx, cy, z, r, fill, extra) {
        const pts = [];
        for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r, z]); }
        poly(pts, fill, extra);
      },
      // 円柱（つぼ・鉢・円卓の脚など）。画面上で描く
      cyl(cx, cy, z, r, h, c, opt) {
        const o = opt || {};
        const [sx, sy] = T(cx, cy, z), [, ty] = T(cx, cy, z + h);
        const rx = r * TW / Math.SQRT2, ry = r * TH / Math.SQRT2;
        out.push(`<path d="M${(sx - rx).toFixed(1)},${ty.toFixed(1)} L${(sx - rx).toFixed(1)},${sy.toFixed(1)} A${rx.toFixed(1)},${ry.toFixed(1)} 0 0 0 ${(sx + rx).toFixed(1)},${sy.toFixed(1)} L${(sx + rx).toFixed(1)},${ty.toFixed(1)} Z" fill="${o.side || shade(c, -0.15)}"/>`);
        out.push(`<ellipse cx="${sx.toFixed(1)}" cy="${ty.toFixed(1)}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" fill="${o.top || shade(c, 0.12)}"/>`);
      },
      // 球っぽい丸（葉っぱ・みかん・猫の頭など）
      ball(cx, cy, z, r, c, extra) {
        const [sx, sy] = T(cx, cy, z);
        out.push(`<circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="${(r * TW / Math.SQRT2).toFixed(1)}" fill="${c}"${extra || ''}/>`);
      },
      line(a, b, stroke, wdt) {
        const p = T(...a), q = T(...b);
        out.push(`<line x1="${p[0].toFixed(1)}" y1="${p[1].toFixed(1)}" x2="${q[0].toFixed(1)}" y2="${q[1].toFixed(1)}" stroke="${stroke}" stroke-width="${wdt || 1}" stroke-linecap="round"/>`);
      },
      raw(s) { out.push(s); },
      glow(cx, cy, z, r, color) {
        const [sx, sy] = T(cx, cy, z);
        out.push(`<circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="${r}" fill="url(#rmGlow${color || ''})" pointer-events="none"/>`);
      }
    };
    return m;
  }

  /* ---------- 壁に描く道具（壁の面にそって、ななめに描く） ---------- */
  // 左の壁（x=0）は u が y 方向、右の壁（y=0）は u が x 方向。v は床からの高さ
  function wallMatrix(side, u, vTop) {
    const base = side === 'L' ? proj(0, u, vTop) : proj(u, 0, vTop);
    const ux = side === 'L' ? [-TW / 2, TH / 2] : [TW / 2, TH / 2];
    return `matrix(${ux[0]},${ux[1]},0,${TZ},${base[0].toFixed(1)},${base[1].toFixed(1)})`;
  }

  /* ---------- 家具のカタログ ----------
   * kind: floor（床）/ flat（ラグ：ほかの家具と重ねられる）/ wall（壁）
   * style: wa（和）/ yo（洋）/ chu（中）。price は銭。light は電気（タップでつく・消える）
   */
  const WOOD = '#9a6a3c', DARKWOOD = '#5c3a22', KAYA = '#d9b26b', RED = '#b8322a', GOLD = '#d9a93a', CREAM = '#efe4cf';
  const CATALOG = [
    /* 和 */
    { id: 'goban', name: '碁盤', style: 'wa', kind: 'floor', w: 2, d: 2, price: 0, note: 'タップで対局',
      draw(m, o) {
        for (const [x, y] of [[.35, .35], [1.45, .35], [.35, 1.45], [1.45, 1.45]]) m.box(x, y, 0, .2, .2, .35, DARKWOOD);
        const b = m.box(.15, .15, .35, 1.7, 1.7, .65, KAYA);
        for (let i = 0; i < 7; i++) { const t = .3 + i * 1.4 / 6; m.line([.3, t + .15, 1], [1.7, t + .15, 1], '#3b2a17', .5); m.line([t + .15, .3, 1], [t + .15, 1.7, 1], '#3b2a17', .5); }
        m.ball(.85, .85, 1, .09, '#151515'); m.ball(1.3, 1.1, 1, .09, '#f7f3ea'); m.ball(.75, 1.3, 1, .09, '#151515');
        return b;
      } },
    { id: 'chabudai', name: 'ちゃぶ台', style: 'wa', kind: 'floor', w: 2, d: 2, price: 150,
      draw(m) { m.cyl(.7, .7, 0, .07, .45, DARKWOOD); m.cyl(1.3, 1.3, 0, .07, .45, DARKWOOD); m.cyl(1, 1, .45, .95, .12, WOOD); m.cyl(1, 1, .57, .18, .25, '#e9e2d2'); m.cyl(.65, 1.2, .57, .12, .14, '#3d5a4a'); } },
    { id: 'zabuton', name: '座布団', style: 'wa', kind: 'floor', w: 1, d: 1, price: 50,
      draw(m) { m.box(.1, .1, 0, .8, .8, .18, '#7a3f6e'); m.ball(.5, .5, .2, .05, GOLD); } },
    { id: 'kotatsu', name: 'こたつ', style: 'wa', kind: 'floor', w: 3, d: 3, price: 400,
      draw(m) {
        const f = m.box(0, 0, 0, 3, 3, .7, '#c2563f');
        m.rect(f, 'F', .2, .15, 2.8, .55, '#d97b52'); m.rect(f, 'S', .2, .15, 2.8, .55, '#b04a36');
        m.box(.15, .15, .7, 2.7, 2.7, .12, WOOD);
        m.ball(1.3, 1.4, .95, .14, '#f08a1c'); m.ball(1.6, 1.3, .95, .14, '#f39a2c'); m.ball(1.45, 1.65, .95, .14, '#ec8314');
      } },
    { id: 'byobu', name: '屏風', style: 'wa', kind: 'floor', w: 3, d: 1, price: 500,
      draw(m) {
        for (let i = 0; i < 3; i++) {
          const b = m.box(i, .4, 0, 1, .12, 2.6, GOLD, { front: '#e3b54a' });
          m.rect(b, 'F', .1, .6 + (i % 2) * .3, .9, .9 + (i % 2) * .3, '#3f6d4e');
          m.rect(b, 'F', .3 + i * .1, 1.6, .55 + i * .1, 2.2, '#2f4f3a');
        }
      } },
    { id: 'bonsai', name: '盆栽', style: 'wa', kind: 'floor', w: 1, d: 1, price: 300,
      draw(m) { m.box(.2, .25, 0, .6, .5, .25, '#4a5b6c'); m.box(.47, .47, .25, .06, .06, .55, '#6b4a2b'); m.ball(.35, .5, .9, .2, '#3f7a3a'); m.ball(.65, .45, 1.05, .22, '#4c8c42'); m.ball(.5, .55, 1.25, .18, '#5fa04e'); } },
    { id: 'andon', name: '行灯', style: 'wa', kind: 'floor', w: 1, d: 1, price: 250, light: true,
      draw(m, o) {
        m.box(.15, .15, 0, .7, .7, .12, DARKWOOD);
        const b = m.box(.2, .2, .12, .6, .6, 1.4, o.on ? '#ffe7a8' : '#efe2c4', { stroke: DARKWOOD });
        m.rect(b, 'F', .29, 0, .31, 1.4, DARKWOOD); m.rect(b, 'S', .29, 0, .31, 1.4, DARKWOOD);
        if (o.on) m.glow(.5, .5, .9, 46);
      } },
    { id: 'tansu', name: '箪笥', style: 'wa', kind: 'floor', w: 2, d: 1, price: 350,
      draw(m) {
        const b = m.box(0, .15, 0, 2, .85, 2.2, '#8a5a32');
        for (let i = 0; i < 4; i++) { m.rect(b, 'F', .1, .15 + i * .5, 1.9, .55 + i * .5, '#a06b3d'); m.rect(b, 'F', .9, .3 + i * .5, 1.1, .38 + i * .5, '#2a2a2a'); }
      } },
    { id: 'ikou', name: '衣桁（着物かけ）', style: 'wa', kind: 'floor', w: 2, d: 1, price: 300,
      draw(m) {
        m.box(.05, .35, 0, .15, .3, .12, DARKWOOD); m.box(1.8, .35, 0, .15, .3, .12, DARKWOOD);
        m.box(.08, .45, 0, .08, .08, 2.2, DARKWOOD); m.box(1.84, .45, 0, .08, .08, 2.2, DARKWOOD);
        m.box(-.05, .45, 2.1, 2.1, .08, .08, DARKWOOD); m.box(.08, .45, 1.2, 1.84, .06, .06, DARKWOOD);
        const k = m.box(.25, .5, .5, 1.5, .04, 1.6, '#c94f6d', { front: '#d8607e' });
        m.rect(k, 'F', .1, .3, 1.4, .45, GOLD); m.circleOn(k, 'F', .45, 1.0, .12, '#f3d36a'); m.circleOn(k, 'F', 1.05, .7, .1, '#ffffff');
      } },
    { id: 'closet', name: 'クローゼット', style: 'yo', kind: 'floor', w: 2, d: 1, price: 600,
      draw(m) {
        const b = m.box(0, .1, 0, 2, .9, 3.0, '#e9dfcf');
        m.rect(b, 'F', .06, .1, .97, 2.9, '#f3ebdd'); m.rect(b, 'F', 1.03, .1, 1.94, 2.9, '#f3ebdd');
        m.rect(b, 'F', .86, 1.3, .92, 1.8, '#b08a52'); m.rect(b, 'F', 1.08, 1.3, 1.14, 1.8, '#b08a52');
        m.box(-.05, .05, 3.0, 2.1, 1.0, .12, '#d6c9b3');
      } },
    { id: 'hibachi', name: '火鉢', style: 'wa', kind: 'floor', w: 1, d: 1, price: 200,
      draw(m) { m.cyl(.5, .5, 0, .38, .6, '#3b4f6b'); m.disc(.5, .5, .6, .3, '#b9b2a6'); m.ball(.45, .5, .62, .07, '#e2462a'); m.ball(.58, .45, .62, .06, '#f06a2a'); } },
    { id: 'maneki', name: '招き猫', style: 'wa', kind: 'floor', w: 1, d: 1, price: 180,
      draw(m) { m.box(.25, .3, 0, .5, .4, .5, '#f7f3ea'); m.ball(.5, .55, .75, .2, '#f7f3ea'); m.ball(.42, .62, .82, .05, '#e98a8a'); m.box(.27, .32, .45, .46, .36, .06, RED); m.ball(.5, .72, .5, .05, GOLD); m.ball(.72, .55, .9, .07, '#f7f3ea'); } },

    /* 洋 */
    { id: 'sofa', name: 'ソファ', style: 'yo', kind: 'floor', w: 3, d: 2, price: 500,
      draw(m) {
        const C = '#4f6fa8';
        m.box(0, 0, 0, 3, .45, 1.6, C);
        m.box(0, .45, 0, .35, 1.4, 1.05, C); m.box(2.65, .45, 0, .35, 1.4, 1.05, C);
        m.box(.35, .45, 0, 2.3, 1.4, .7, '#5d7fbc');
        m.box(.5, .2, .7, .9, .3, .55, '#e9d79b'); m.box(1.6, .2, .7, .9, .3, .55, '#e9d79b');
      } },
    { id: 'tv', name: 'テレビ', style: 'yo', kind: 'floor', w: 2, d: 1, price: 800, toggle: true, note: 'タップでつく・消える',
      draw(m, o) {
        m.box(0, .2, 0, 2, .7, .5, '#3a3a40');
        const s = m.box(.1, .4, .5, 1.8, .15, 1.15, '#1c1c22');
        if (o.on) {   // つけると、碁の番組
          m.rect(s, 'F', .08, .08, 1.72, 1.07, '#d9b26b');
          for (let i = 0; i < 4; i++) { m.rect(s, 'F', .25 + i * .4, .15, .27 + i * .4, 1.0, '#6b4a2b'); m.rect(s, 'F', .15, .2 + i * .25, 1.65, .22 + i * .25, '#6b4a2b'); }
          m.circleOn(s, 'F', .65, .47, .09, '#151515'); m.circleOn(s, 'F', 1.05, .72, .09, '#f7f3ea'); m.circleOn(s, 'F', 1.05, .47, .09, '#151515');
          m.glow(1, .5, 1.1, 40);
        } else { m.rect(s, 'F', .08, .08, 1.72, 1.07, '#15161c'); m.rect(s, 'F', .2, .6, .8, .95, '#23252e'); }
      } },
    { id: 'lowtable', name: 'ローテーブル', style: 'yo', kind: 'floor', w: 2, d: 1, price: 200,
      draw(m) { for (const [x, y] of [[.1, .15], [1.75, .15], [.1, .7], [1.75, .7]]) m.box(x, y, 0, .15, .15, .4, DARKWOOD); m.box(0, .1, .4, 2, .8, .1, '#c08a55'); m.cyl(1.4, .5, .5, .12, .15, '#e7e1d6'); } },
    { id: 'floorlamp', name: 'フロアランプ', style: 'yo', kind: 'floor', w: 1, d: 1, price: 250, light: true,
      draw(m, o) { m.cyl(.5, .5, 0, .25, .08, '#2d2d2d'); m.box(.47, .47, .08, .06, .06, 2.1, '#2d2d2d'); m.cyl(.5, .5, 2.1, .32, .5, o.on ? '#fff0b8' : '#e8dcc0'); if (o.on) m.glow(.5, .5, 2.2, 52); } },
    { id: 'bookshelf', name: '本棚', style: 'yo', kind: 'floor', w: 2, d: 1, price: 400,
      draw(m) {
        const b = m.box(0, .3, 0, 2, .7, 2.9, '#7a5233');
        const cols = ['#b8322a', '#2f5d8a', '#3f7a3a', '#d9a93a', '#6a3f8a', '#c86b2a'];
        for (let r = 0; r < 4; r++) {
          m.rect(b, 'F', .08, .1 + r * .7, 1.92, .7 + r * .7, '#4a3020');
          for (let k = 0; k < 7; k++) m.rect(b, 'F', .15 + k * .25, .12 + r * .7, .32 + k * .25, .52 + r * .7 - (k % 3) * .06, cols[(k + r * 2) % cols.length]);
        }
      } },
    { id: 'bed', name: 'ベッド', style: 'yo', kind: 'floor', w: 3, d: 4, price: 900,
      draw(m) {
        m.box(0, 0, 0, 3, .3, 1.5, '#8a5a32');
        m.box(0, .3, 0, 3, 3.7, .5, '#8a5a32');
        m.box(.1, .3, .5, 2.8, 3.6, .35, '#f4efe6');
        m.box(.3, .45, .85, 1.1, .7, .2, '#ffffff'); m.box(1.6, .45, .85, 1.1, .7, .2, '#ffffff');
        m.box(.05, 1.5, .5, 2.9, 2.5, .42, '#e58f8f');
      } },
    { id: 'plant', name: '観葉植物', style: 'yo', kind: 'floor', w: 1, d: 1, price: 150,
      draw(m) { m.cyl(.5, .5, 0, .26, .5, '#d8d2c4'); m.ball(.4, .5, 1.0, .25, '#3f8a46'); m.ball(.62, .45, 1.25, .25, '#4c9a52'); m.ball(.5, .6, 1.5, .22, '#5aa860'); m.ball(.45, .4, 1.6, .16, '#68b46c'); } },
    { id: 'fridge', name: '冷蔵庫', style: 'yo', kind: 'floor', w: 1, d: 1, price: 700,
      draw(m) { const b = m.box(.05, .1, 0, .9, .85, 3.1, '#e9eef2'); m.rect(b, 'F', 0, 2.0, .9, 2.04, '#9aa6b0'); m.rect(b, 'F', .72, 2.2, .78, 2.8, '#7d8a95'); m.rect(b, 'F', .72, 1.2, .78, 1.8, '#7d8a95'); } },
    { id: 'washer', name: '洗濯機', style: 'yo', kind: 'floor', w: 1, d: 1, price: 600,
      draw(m) { const b = m.box(.05, .05, 0, .9, .9, 1.7, '#f1f3f5'); m.rect(b, 'F', .05, 1.45, .85, 1.65, '#c9d2da'); m.circleOn(b, 'F', .45, .75, .32, '#8fa3b5'); m.circleOn(b, 'F', .45, .75, .24, '#bcd7ef'); } },
    { id: 'fireplace', name: '暖炉', style: 'yo', kind: 'floor', w: 2, d: 1, price: 1200, light: true,
      draw(m, o) {
        const b = m.box(0, .3, 0, 2, .7, 2.3, '#a85a42');
        m.box(-.05, .25, 2.3, 2.1, .8, .15, '#e8dfd0');
        for (let r = 0; r < 6; r++) m.rect(b, 'F', 0, r * .38, 2, r * .38 + .03, '#8c4632');
        m.rect(b, 'F', .45, 0, 1.55, 1.15, '#2a1a14');
        if (o.on) { m.rect(b, 'F', .65, .05, 1.35, .55, '#f2741c'); m.rect(b, 'F', .8, .05, 1.2, .85, '#ffb23a'); m.glow(1, 1.2, .5, 60, 'R'); }
      } },
    { id: 'piano', name: 'ピアノ', style: 'yo', kind: 'floor', w: 3, d: 1, price: 1500,
      draw(m) {
        const b = m.box(0, .1, 0, 3, .6, 2.4, '#1a1a1e');
        const k = m.box(.1, .7, 1.05, 2.8, .3, .12, '#1a1a1e');
        m.rect(k, 'F', 0, 0, 2.8, .12, '#f7f3ea');
        for (let i = 0; i < 18; i++) m.rect(k, 'F', .1 + i * .15, .04, .17 + i * .15, .12, i % 7 === 2 || i % 7 === 6 ? '#f7f3ea' : '#1a1a1e');
        m.rect(b, 'F', .3, 1.6, 2.7, 2.1, '#2c2c34');
      } },
    { id: 'rug', name: 'ラグ', style: 'yo', kind: 'flat', w: 4, d: 3, price: 120,
      draw(m) {
        m.poly([[0, 0, .01], [4, 0, .01], [4, 3, .01], [0, 3, .01]], '#7b3f52');
        m.poly([[.25, .25, .02], [3.75, .25, .02], [3.75, 2.75, .02], [.25, 2.75, .02]], '#a35a6e');
        m.poly([[1, .9, .03], [3, .9, .03], [3, 2.1, .03], [1, 2.1, .03]], '#d6b46a');
      } },

    /* 中 */
    { id: 'entaku', name: '円卓', style: 'chu', kind: 'floor', w: 2, d: 2, price: 600,
      draw(m) { m.cyl(1, 1, 0, .25, .8, '#5a1d18'); m.cyl(1, 1, .8, .98, .12, '#8a2a22'); m.cyl(1, 1, .92, .45, .06, '#3a3a3a'); m.cyl(.9, .9, .98, .14, .1, '#f0ece2'); m.cyl(1.25, 1.1, .98, .12, .12, '#3c7a5a'); } },
    { id: 'chuchair', name: '中華椅子', style: 'chu', kind: 'floor', w: 1, d: 1, price: 200,
      draw(m) { for (const [x, y] of [[.15, .15], [.75, .15], [.15, .75], [.75, .75]]) m.box(x, y, 0, .1, .1, .55, '#4a1612'); m.box(.1, .1, .55, .8, .8, .1, '#7a2420'); m.box(.1, .1, .65, .8, .12, .9, '#7a2420'); m.box(.4, .1, .8, .2, .13, .55, GOLD); } },
    { id: 'tsubo', name: '青磁の壺', style: 'chu', kind: 'floor', w: 1, d: 1, price: 350,
      draw(m) { m.cyl(.5, .5, 0, .22, .15, '#7fb3a3'); m.ball(.5, .5, .55, .34, '#8cc2b1'); m.cyl(.5, .5, .85, .15, .3, '#7fb3a3'); m.disc(.5, .5, 1.15, .17, '#9fd0c0'); } },
    { id: 'bamboo', name: '竹の鉢', style: 'chu', kind: 'floor', w: 1, d: 1, price: 250,
      draw(m) { m.box(.15, .15, 0, .7, .7, .4, '#3a3a3a'); for (const [x, y, h] of [[.35, .4, 2.4], [.55, .5, 2.9], [.62, .32, 2.1], [.42, .62, 2.6]]) { m.box(x, y, .4, .07, .07, h, '#5f9a3c'); m.ball(x + .1, y, .4 + h, .14, '#6fb04a'); } } },
    { id: 'shishi', name: '獅子像', style: 'chu', kind: 'floor', w: 1, d: 1, price: 800,
      draw(m) { m.box(.1, .1, 0, .8, .8, .35, '#8d8d8d'); m.box(.2, .25, .35, .6, .5, .55, '#a9a9a9'); m.ball(.5, .62, 1.1, .25, '#b8b8b8'); m.ball(.45, .7, 1.12, .07, '#3a3a3a'); m.ball(.32, .45, 1.25, .1, GOLD); } },
    { id: 'chataku', name: '茶卓', style: 'chu', kind: 'floor', w: 2, d: 1, price: 300,
      draw(m) { m.box(.05, .1, 0, 1.9, .8, .55, '#3c1f14'); m.box(0, .05, .55, 2, .9, .1, '#5a2e1c'); m.cyl(.6, .5, .65, .14, .2, '#c6935a'); m.cyl(1.05, .45, .65, .07, .1, '#efe7d6'); m.cyl(1.3, .6, .65, .07, .1, '#efe7d6'); } },

    /* 壁：w は壁ぞいのマス数、h は高さ、v は床からの高さ */
    { id: 'window', name: '窓', style: 'yo', kind: 'wall', w: 2, h: 2, v: 2, price: 300,
      wall: (o) => `<rect x="0" y="0" width="2" height="2" fill="#f4f1ea"/><rect x=".12" y=".12" width="1.76" height="1.76" fill="${o.night ? '#24304f' : '#9fd0f0'}"/><rect x=".12" y="1.2" width="1.76" height=".68" fill="${o.night ? '#1d2742' : '#c6e6f7'}"/><rect x=".96" y=".12" width=".08" height="1.76" fill="#f4f1ea"/><rect x=".12" y=".96" width="1.76" height=".08" fill="#f4f1ea"/><rect x="-.1" y="1.95" width="2.2" height=".12" fill="#ddd6c8"/>` },
    { id: 'shoji', name: '障子窓', style: 'wa', kind: 'wall', w: 2, h: 2, v: 2, price: 300,
      wall: () => { let s = '<rect x="0" y="0" width="2" height="2" fill="#6b4a2b"/><rect x=".08" y=".08" width="1.84" height="1.84" fill="#f6f0dc"/>'; for (let i = 1; i < 4; i++) s += `<rect x="${.08 + i * .46 - .02}" y=".08" width=".04" height="1.84" fill="#8a6a45"/>`; for (let i = 1; i < 5; i++) s += `<rect x=".08" y="${.08 + i * .37 - .02}" width="1.84" height=".04" fill="#8a6a45"/>`; return s; } },
    { id: 'marumado', name: '丸窓', style: 'chu', kind: 'wall', w: 2, h: 2, v: 2, price: 400,
      wall: (o) => `<circle cx="1" cy="1" r="1" fill="#5a2e1c"/><circle cx="1" cy="1" r=".86" fill="${o.night ? '#24304f' : '#a8d8c8'}"/><path d="M1 .14V1.86M.14 1H1.86M.4 .4L1.6 1.6M1.6 .4L.4 1.6" stroke="#5a2e1c" stroke-width=".06"/><circle cx="1" cy="1" r=".3" fill="none" stroke="#5a2e1c" stroke-width=".06"/>` },
    { id: 'painting', name: '絵画', style: 'yo', kind: 'wall', w: 2, h: 1.5, v: 2.8, price: 400,
      wall: () => `<rect x="0" y="0" width="2" height="1.5" fill="${GOLD}"/><rect x=".12" y=".12" width="1.76" height="1.26" fill="#bfe0f2"/><path d="M.12 1.38L.7 .6L1.1 1.0L1.4 .75L1.88 1.38Z" fill="#5b8a5a"/><circle cx="1.5" cy=".4" r=".14" fill="#f6d06a"/>` },
    { id: 'kakejiku', name: '掛け軸', style: 'wa', kind: 'wall', w: 1, h: 2.6, v: 2.2, price: 250,
      wall: () => `<rect x=".18" y="0" width=".64" height="2.6" fill="#7a5a3a"/><rect x=".24" y=".2" width=".52" height="2.15" fill="#f5efe0"/><path d="M.5 .45Q.62 .9 .44 1.3T.52 2.05" stroke="#222" stroke-width=".09" fill="none" stroke-linecap="round"/><circle cx=".62" cy="2.1" r=".05" fill="${RED}"/><rect x=".12" y="2.5" width=".76" height=".08" fill="#3a2a1a"/>` },
    { id: 'clock', name: '壁掛け時計', style: 'yo', kind: 'wall', w: 1, h: 1, v: 4, price: 200,
      wall: () => `<circle cx=".5" cy=".5" r=".45" fill="#5c3a22"/><circle cx=".5" cy=".5" r=".37" fill="#fbf7ee"/><path d="M.5 .5V.24M.5 .5L.68 .58" stroke="#222" stroke-width=".05" stroke-linecap="round"/>` },
    { id: 'chouchin', name: '提灯', style: 'chu', kind: 'wall', w: 1, h: 1.6, v: 3.4, price: 200, light: true,
      wall: (o) => `<rect x=".45" y="0" width=".1" height=".3" fill="#222"/><rect x=".25" y=".25" width=".5" height=".1" fill="#222"/><ellipse cx=".5" cy=".85" rx=".4" ry=".52" fill="${o.on ? '#ff5a3c' : RED}"/><path d="M.12 .7H.88M.12 1H.88" stroke="#7a1a12" stroke-width=".04"/><rect x=".25" y="1.33" width=".5" height=".1" fill="#222"/>${o.on ? '<ellipse cx=".5" cy=".85" rx=".9" ry=".9" fill="url(#rmGlowR)"/>' : ''}` },
    { id: 'fuku', name: '「福」飾り', style: 'chu', kind: 'wall', w: 1, h: 1, v: 3.6, price: 150,
      wall: () => `<path d="M.5 0L1 .5L.5 1L0 .5Z" fill="${RED}"/><text x=".5" y=".68" font-size=".5" text-anchor="middle" fill="${GOLD}" font-weight="900">福</text>` }
  ];
  // 追加の家具（common/room-items-more.js）
  if (typeof window !== 'undefined' && window.ROOM_MORE) CATALOG.push(...window.ROOM_MORE({ WOOD, DARKWOOD, KAYA, RED, GOLD, CREAM, shade }));
  // 値段は4段階（下100・中400・上600・特800）にそろえる。碁盤は無料
  const tier = p => p === 0 ? 0 : p <= 150 ? 100 : p <= 350 ? 200 : p <= 700 ? 300 : 400;
  const TIER_PRICE = { 100: 100, 200: 400, 300: 600, 400: 800 };
  for (const c of CATALOG) if (c.price > 0) c.price = TIER_PRICE[[100, 200, 300, 400].includes(c.price) ? c.price : tier(c.price)];
  // クローク（服をしまう家具）：置くと、アバターのお気に入りセットを増やせる
  const CLOAK = new Set(['tansu', 'ikou', 'closet', 'rack', 'mirror', 'dresser']);
  for (const c of CATALOG) if (CLOAK.has(c.id)) { c.cloak = true; c.note = c.note || '置くと、お気に入りセットが2つふえる'; }
  // 絵で描いた家具（img/room/<id>.webp、つくものは <id>_on.webp）。[横, 縦] ピクセル
  const IMG = {"andon":[141,181],"andon_on":[141,181],"bed":[679,555],"bookshelf":[485,567],"chabudai":[556,517],"clock":[168,178],"fireplace":[232,188],"fireplace_on":[232,181],"fridge":[147,216],"goban":[573,410],"kakejiku":[106,195],"plant":[308,355],"sofa":[589,473],"tv":[432,417],"tv_on":[432,417],"window":[263,175],"zabuton":[507,313]};
  for (const c of CATALOG) if (IMG[c.id]) {
    c.img = true;
    if (c.kind === 'wall') { const [iw, ih] = IMG[c.id]; c.h = Math.round(c.w * ih / iw * 100) / 100; }   // 壁の家具は絵の縦横の比にあわせる
  }
  const imgOf = (id, on) => on && IMG[id + '_on'] ? [id + '_on', IMG[id + '_on']] : [id, IMG[id]];
  const BY_ID = {}; CATALOG.forEach(c => BY_ID[c.id] = c);

  /* 床と壁紙 */
  // 床：pat（もよう）と c（色）で描く。sw はショップの見本（CSS）
  //   plank 板張り / checker 市松 / solid じゅうたん（ふちの色つき）/ grid 線の入った床 / herring ヘリンボーン / var まだら / stars 星
  const FLOORS = {
    wood: { name: 'フローリング', style: 'yo', price: 0 },
    tatami: { name: '畳', style: 'wa', price: 400 },
    tile: { name: '中華タイル', style: 'chu', price: 400 },
    oak: { name: '明るいオーク', style: 'yo', price: 300, pat: 'plank', c: ['#e3c494', '#d9b884', '#b8925e'] },
    walnut: { name: 'ウォールナット', style: 'yo', price: 400, pat: 'plank', c: ['#6e4a30', '#634229', '#3e2716'] },
    herring: { name: 'ヘリンボーン', style: 'yo', price: 600, pat: 'herring', c: ['#c99b66', '#b0824f', '#8a6238'] },
    ryukyu: { name: '縁なし琉球畳', style: 'wa', price: 600, pat: 'checker', c: ['#d6cc8e', '#c2b673', '#8f8450'], line: true },
    gobanfl: { name: '碁盤の床', style: 'wa', price: 800, pat: 'grid', c: ['#e2b866', '#d9ad59', '#3a2a14'] },
    stone: { name: '石だたみ', style: 'wa', price: 400, pat: 'var', c: ['#a9a59c', '#8f8b82', '#6d6a63'], line: true },
    marble: { name: '大理石', style: 'yo', price: 800, pat: 'var', c: ['#f2efe9', '#e2ded6', '#c9c4ba'], line: true },
    checker: { name: '白黒チェック', style: 'yo', price: 600, pat: 'checker', c: ['#f4f1ea', '#2e2b28'] },
    pastel: { name: 'パステルタイル', style: 'yo', price: 400, pat: 'checker', c: ['#f6d3dc', '#cdeee0'] },
    redcarpet: { name: '赤じゅうたん', style: 'chu', price: 600, pat: 'solid', c: ['#a3262c', '#d9a93a'] },
    bluecarpet: { name: '青いカーペット', style: 'yo', price: 400, pat: 'solid', c: ['#4f6fa8', '#3b5585'] },
    grass: { name: '芝生', style: 'yo', price: 400, pat: 'var', c: ['#7fb85a', '#6fa84c', '#8cc466'] },
    starry: { name: '星空の床', style: 'yo', price: 800, pat: 'stars', c: ['#1c2350', '#252d63', '#fff6c8'] }
  };
  // 壁紙：c は [左の壁, 右の壁]。pat：stripe / plank 板張り / brick レンガ / waist 腰板 / dots 水玉 / lattice 格子 / stars 星 / fold 屏風
  const WALLS = {
    plain: { name: '白い壁', style: 'yo', price: 0 },
    shikkui: { name: '漆喰と柱', style: 'wa', price: 400 },
    beni: { name: '紅の壁', style: 'chu', price: 400 },
    stripe: { name: 'ストライプ', style: 'yo', price: 400 },
    cream: { name: 'クリーム', style: 'yo', price: 200, c: ['#f3e6c8', '#e8d9b6'] },
    mint: { name: 'ミント', style: 'yo', price: 300, c: ['#cfeadf', '#bfdfd2'] },
    sakurairo: { name: 'さくら色', style: 'yo', price: 300, c: ['#f6d6de', '#ecc6d0'] },
    navy: { name: '紺の壁', style: 'yo', price: 400, c: ['#2f3f66', '#273657'] },
    planks: { name: '板張り', style: 'wa', price: 400, c: ['#b98a5a', '#a87b4e'], pat: 'plank', a: '#7a5534' },
    brick: { name: 'レンガ', style: 'yo', price: 600, c: ['#b5573f', '#a24c36'], pat: 'brick', a: '#e8d6c4' },
    waist: { name: '腰板と白壁', style: 'yo', price: 600, c: ['#f2ede4', '#e6e0d5'], pat: 'waist', a: '#6e4a30' },
    dots: { name: '水玉', style: 'yo', price: 400, c: ['#fdf3e2', '#f5e8d2'], pat: 'dots', a: '#f2a3b4' },
    washi: { name: '和紙と格子', style: 'wa', price: 600, c: ['#f7f1e3', '#ede5d2'], pat: 'lattice', a: '#7a5534' },
    sakura: { name: '桜もよう', style: 'wa', price: 600, c: ['#f9e3ea', '#f1d5de'], pat: 'dots', a: '#e889a3', big: true },
    night: { name: '夜空', style: 'yo', price: 800, c: ['#1c2350', '#161c42'], pat: 'stars', a: '#fff6c8' },
    gold: { name: '金屏風', style: 'wa', price: 800, c: ['#e2b84e', '#d1a63e'], pat: 'fold', a: '#a07a22' }
  };
  // ショップの見本（CSS の background）
  function swatch(kind, id) {
    const d = (kind === 'floors' || kind === 'floor' ? FLOORS : WALLS)[id]; if (!d || !d.c) return '';
    const [a, b, c] = d.c;
    if (kind === 'floors' || kind === 'floor') {
      if (d.pat === 'plank') return `background: repeating-linear-gradient(90deg, ${a} 0 14px, ${b} 14px 27px, ${c} 27px 28px)`;
      if (d.pat === 'checker' || d.pat === 'herring') return `background: conic-gradient(${a} 25%, ${b} 0 50%, ${a} 0 75%, ${b} 0) 0 0 / 22px 22px`;
      if (d.pat === 'grid') return `background: ${a}; background-image: linear-gradient(${c} 1px, transparent 1px), linear-gradient(90deg, ${c} 1px, transparent 1px); background-size: 14px 14px`;
      if (d.pat === 'solid') return `background: ${a}; box-shadow: inset 0 0 0 5px ${b}`;
      if (d.pat === 'stars') return `background: radial-gradient(${c} 1px, transparent 1.5px) 0 0 / 12px 12px, ${a}`;
      return `background: radial-gradient(circle at 30% 30%, ${c}, transparent 40%), linear-gradient(135deg, ${a}, ${b})`;
    }
    const ac = d.a || b;
    if (d.pat === 'plank') return `background: repeating-linear-gradient(90deg, ${a} 0 10px, ${ac} 10px 11px)`;
    if (d.pat === 'brick') return `background: repeating-linear-gradient(0deg, ${a} 0 8px, ${ac} 8px 9px)`;
    if (d.pat === 'waist') return `background: linear-gradient(${a} 0 55%, ${ac} 55%)`;
    if (d.pat === 'dots') return `background: radial-gradient(${ac} ${d.big ? 3 : 2}px, transparent ${d.big ? 3.5 : 2.5}px) 0 0 / 14px 14px, ${a}`;
    if (d.pat === 'lattice') return `background: ${a}; background-image: linear-gradient(${ac} 1.5px, transparent 1.5px), linear-gradient(90deg, ${ac} 1.5px, transparent 1.5px); background-size: 16px 20px`;
    if (d.pat === 'stars') return `background: radial-gradient(${ac} 1px, transparent 1.5px) 0 0 / 11px 13px, ${a}`;
    if (d.pat === 'fold') return `background: repeating-linear-gradient(90deg, ${a} 0 18px, ${ac} 18px 19px, ${b} 19px 37px, ${ac} 37px 38px)`;
    return `background: ${a}`;
  }
  const hash = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

  function drawFloor(type, n) {
    n = n || N;
    let s = '';
    const d = FLOORS[type];
    if (d && d.pat) {   // 新しい床（もようと色で描く）
      const [a, b, c] = d.c;
      for (let x = 0; x < n; x++) for (let y = 0; y < n; y++) {
        let col = a;
        if (d.pat === 'plank') col = y % 2 ? a : b;
        else if (d.pat === 'checker') col = (x + y) % 2 ? a : b;
        else if (d.pat === 'herring') col = ((x + (y >> 1)) % 2) ? a : b;
        else if (d.pat === 'grid') col = a;
        else if (d.pat === 'solid') col = x === 0 || y === 0 || x === n - 1 || y === n - 1 ? b : a;
        else if (d.pat === 'var') { const h = hash(x, y); col = h < .4 ? a : h < .75 ? b : c; }
        else if (d.pat === 'stars') col = (x + y) % 2 ? a : b;
        const q = [proj(x, y, 0), proj(x + 1, y, 0), proj(x + 1, y + 1, 0), proj(x, y + 1, 0)];
        s += `<polygon points="${P(q)}" fill="${col}"/>`;
        if (d.pat === 'stars' && hash(x, y) < .35) { const [px, py] = proj(x + .2 + hash(y, x) * .6, y + .2 + hash(x + 7, y) * .6, 0); s += `<circle cx="${px}" cy="${py}" r="${hash(x, y + 3) < .2 ? 1.6 : .9}" fill="${c}"/>`; }
      }
      const ln = (x1, y1, x2, y2, col, w) => { const p = proj(x1, y1, 0), q = proj(x2, y2, 0); return `<line x1="${p[0]}" y1="${p[1]}" x2="${q[0]}" y2="${q[1]}" stroke="${col}" stroke-width="${w}"/>`; };
      if (d.pat === 'plank' || d.pat === 'herring') for (let y = 0; y <= n; y++) s += ln(0, y, n, y, c, .6);
      if (d.pat === 'grid') for (let k = 0; k <= n; k++) { s += ln(k, 0, k, n, c, .7); s += ln(0, k, n, k, c, .7); }
      if (d.line) for (let k = 0; k <= n; k++) { s += ln(k, 0, k, n, c, .5); s += ln(0, k, n, k, c, .5); }
      return s;
    }
    for (let x = 0; x < n; x++) for (let y = 0; y < n; y++) {
      let c;
      if (type === 'tatami') c = ((Math.floor(x / 2) + y) % 2 ? '#cfc58a' : '#c6bc7e');
      else if (type === 'tile') c = (x + y) % 2 ? '#c9b48e' : '#8f3a2c';
      else c = (y % 2 ? '#b98a5a' : '#c4956a');
      const q = [proj(x, y, 0), proj(x + 1, y, 0), proj(x + 1, y + 1, 0), proj(x, y + 1, 0)];
      s += `<polygon points="${P(q)}" fill="${c}"/>`;
    }
    if (type === 'tatami') for (let x = 0; x <= n; x += 2) s += `<line x1="${proj(x, 0, 0)[0]}" y1="${proj(x, 0, 0)[1]}" x2="${proj(x, n, 0)[0]}" y2="${proj(x, n, 0)[1]}" stroke="#4a3a20" stroke-width="1.2"/>`;
    if (type === 'wood') for (let y = 0; y <= n; y++) s += `<line x1="${proj(0, y, 0)[0]}" y1="${proj(0, y, 0)[1]}" x2="${proj(n, y, 0)[0]}" y2="${proj(n, y, 0)[1]}" stroke="#8c6238" stroke-width=".6"/>`;
    return s;
  }
  // 壁。cut.L / cut.R が true の壁は、手前の部屋（廊下の側）が見えるように低くする
  function drawWalls(type, n, cut) {
    n = n || N; cut = cut || {};
    const hL = cut.L ? LOW : WH, hR = cut.R ? LOW : WH;
    const L = [proj(0, 0, 0), proj(0, n, 0), proj(0, n, hL), proj(0, 0, hL)];
    const R = [proj(0, 0, 0), proj(n, 0, 0), proj(n, 0, hR), proj(0, 0, hR)];
    const wd = WALLS[type] && WALLS[type].c ? WALLS[type] : null;
    const col = wd ? wd.c : { plain: ['#efe9df', '#e2dace'], shikkui: ['#ece2c8', '#e0d4b6'], beni: ['#a8352c', '#922c25'], stripe: ['#dfe7e3', '#d2ddd8'] }[type] || ['#efe9df', '#e2dace'];
    let s = `<polygon points="${P(L)}" fill="${col[0]}"/><polygon points="${P(R)}" fill="${col[1]}"/>`;
    if (wd && wd.pat) s += wallPat(wd, n, hL, hR);
    if (type === 'stripe') for (let u = 0; u < n; u += 1) {
      s += `<polygon points="${P([proj(0, u + .5, 0), proj(0, u + 1, 0), proj(0, u + 1, hL), proj(0, u + .5, hL)])}" fill="#c9d8d1"/>`;
      s += `<polygon points="${P([proj(u + .5, 0, 0), proj(u + 1, 0, 0), proj(u + 1, 0, hR), proj(u + .5, 0, hR)])}" fill="#bccdc6"/>`;
    }
    if (type === 'shikkui') for (let u = 0; u < n; u += 4) {
      s += `<polygon points="${P([proj(0, u, 0), proj(0, u + .3, 0), proj(0, u + .3, hL), proj(0, u, hL)])}" fill="#6b4a2b"/>`;
      s += `<polygon points="${P([proj(u, 0, 0), proj(u + .3, 0, 0), proj(u + .3, 0, hR), proj(u, 0, hR)])}" fill="#5c3e24"/>`;
    }
    if (type === 'beni' && !cut.L && !cut.R) {
      s += `<polygon points="${P([proj(0, 0, WH - .6), proj(0, n, WH - .6), proj(0, n, WH - .4), proj(0, 0, WH - .4)])}" fill="#d9a93a"/>`;
      s += `<polygon points="${P([proj(0, 0, WH - .6), proj(n, 0, WH - .6), proj(n, 0, WH - .4), proj(0, 0, WH - .4)])}" fill="#c99a30"/>`;
    }
    // 巾木（床ぎわの板）
    const bb = type === 'beni' ? '#3a120e' : '#6b4a2b';
    s += `<polygon points="${P([proj(0, 0, 0), proj(0, n, 0), proj(0, n, .3), proj(0, 0, .3)])}" fill="${bb}"/>`;
    s += `<polygon points="${P([proj(0, 0, 0), proj(n, 0, 0), proj(n, 0, .3), proj(0, 0, .3)])}" fill="${shade(bb, -0.2)}"/>`;
    // 低くした壁の上のふち
    if (cut.L) s += `<polygon points="${P([proj(0, 0, hL), proj(0, n, hL), proj(-.25, n, hL), proj(-.25, 0, hL)])}" fill="#8a6a45"/>`;
    if (cut.R) s += `<polygon points="${P([proj(0, 0, hR), proj(n, 0, hR), proj(n, -.25, hR), proj(0, -.25, hR)])}" fill="#7a5a3a"/>`;
    return s;
  }
  // 新しい壁紙のもよう（左の壁 x=0・右の壁 y=0 の両方に）
  function wallPat(d, n, hL, hR) {
    const a = d.a || '#888';
    let s = '';
    const quadL = (u0, u1, z0, z1, f) => `<polygon points="${P([proj(0, u0, z0), proj(0, u1, z0), proj(0, u1, z1), proj(0, u0, z1)])}" fill="${f}"/>`;
    const quadR = (u0, u1, z0, z1, f) => `<polygon points="${P([proj(u0, 0, z0), proj(u1, 0, z0), proj(u1, 0, z1), proj(u0, 0, z1)])}" fill="${f}"/>`;
    const both = (u0, u1, z0, z1, f, f2) => { let t = ''; if (z0 < hL) t += quadL(u0, u1, z0, Math.min(z1, hL), f); if (z0 < hR) t += quadR(u0, u1, z0, Math.min(z1, hR), f2 || shade(f, -0.08)); return t; };
    const dot = (u, z, r, f) => { let t = ''; if (z < hL) { const [x, y] = proj(0, u, z); t += `<ellipse cx="${x}" cy="${y}" rx="${r * .8}" ry="${r}" fill="${f}"/>`; } if (z < hR) { const [x, y] = proj(u, 0, z); t += `<ellipse cx="${x}" cy="${y}" rx="${r * .8}" ry="${r}" fill="${shade(f, -0.08)}"/>`; } return t; };
    const top = Math.max(hL, hR);
    if (d.pat === 'plank') for (let u = 0; u < n; u += .5) s += both(u, u + .04, 0, top, a);
    if (d.pat === 'brick') for (let z = 0, row = 0; z < top; z += .45, row++) { s += both(0, n, z, z + .05, a); for (let u = row % 2 ? .5 : 0; u < n; u += 1) s += both(u, u + .05, z, z + .45, a); }
    if (d.pat === 'waist') { s += both(0, n, 0, 1.3, a); s += both(0, n, 1.3, 1.42, shade(a, .25)); for (let u = .7; u < n; u += 1.4) s += both(u, u + .05, .15, 1.2, shade(a, -0.2)); }
    if (d.pat === 'dots') for (let u = .5; u < n; u += 1) for (let z = .6; z < top; z += .9) { const off = Math.round(z / .9) % 2 ? .5 : 0; s += dot(u + off, z, d.big ? 3 : 1.8, a); if (d.big) { s += dot(u + off + .12, z + .08, 1.4, '#fff'); } }
    if (d.pat === 'lattice') { for (let u = 0; u < n; u += 1) s += both(u, u + .06, 0, top, a); for (let z = .8; z < top; z += .8) s += both(0, n, z, z + .06, a); }
    if (d.pat === 'stars') for (let u = 0; u < n; u++) for (let z = .3; z < top; z += .7) if (hash(u * 3, Math.round(z * 10)) < .45) s += dot(u + hash(u, Math.round(z * 10)), z + hash(Math.round(z * 10), u) * .4, hash(u + 1, Math.round(z * 7)) < .2 ? 1.6 : .9, a);
    if (d.pat === 'fold') for (let u = 0; u < n; u += 2) { s += both(u + 1, u + 2, 0, top, shade(d.c[0], -0.07)); s += both(u, u + .05, 0, top, a); }
    return s;
  }
  /* ---------- 家（部屋どうしを廊下と扉でつなぐ） ---------- */
  const LOW = 0.9, HALL = 3, HALLW = 2;
  // 廊下の床：x0..x1, y0..y1（そのマスの範囲）
  function drawHall(x0, y0, x1, y1) {
    let s = '';
    const along = x1 - x0 > y1 - y0;
    for (let x = x0; x < x1; x++) for (let y = y0; y < y1; y++) {
      const q = [proj(x, y, 0), proj(x + 1, y, 0), proj(x + 1, y + 1, 0), proj(x, y + 1, 0)];
      s += `<polygon points="${P(q)}" fill="${((along ? y : x) % 2) ? '#a8784a' : '#b4845a'}"/>`;
    }
    // 両側の巾木
    if (along) { s += `<polygon points="${P([proj(x0, y0, 0), proj(x1, y0, 0), proj(x1, y0, .5), proj(x0, y0, .5)])}" fill="#e8dfd0"/>`; s += `<polygon points="${P([proj(x0, y1, 0), proj(x1, y1, 0), proj(x1, y1, .25), proj(x0, y1, .25)])}" fill="#6b4a2b"/>`; }
    else { s += `<polygon points="${P([proj(x0, y0, 0), proj(x0, y1, 0), proj(x0, y1, .5), proj(x0, y0, .5)])}" fill="#efe9df"/>`; s += `<polygon points="${P([proj(x1, y0, 0), proj(x1, y1, 0), proj(x1, y1, .25), proj(x1, y0, .25)])}" fill="#5c3e24"/>`; }
    return s;
  }
  // 扉：side 'L'（x=0 の壁）/ 'R'（y=0 の壁）、u0..u1 が扉の幅。すこし開いた引き戸
  function drawDoor(side, u0, u1) {
    const H2 = 3.4, pt = (u, v) => side === 'L' ? proj(0, u, v) : proj(u, 0, v);
    const quad = (a, b, c, d, f) => `<polygon points="${P([a, b, c, d])}" fill="${f}"/>`;
    let s = quad(pt(u0, 0), pt(u1, 0), pt(u1, H2), pt(u0, H2), 'rgba(30,18,10,.55)');   // 開いたところの奥（くらい）
    s += quad(pt(u0 + .9, 0), pt(u1, 0), pt(u1, H2), pt(u0 + .9, H2), '#c99a5e');          // 引き戸（半分ひらく）
    s += quad(pt(u0 + 1.05, .25), pt(u1 - .15, .25), pt(u1 - .15, H2 - .25), pt(u0 + 1.05, H2 - .25), '#e8cfa0');
    for (const u of [u0 - .15, u1]) s += quad(pt(u, 0), pt(u + .15, 0), pt(u + .15, H2 + .2), pt(u, H2 + .2), '#5c3a22');   // 柱
    s += quad(pt(u0 - .15, H2), pt(u1 + .15, H2), pt(u1 + .15, H2 + .3), pt(u0 - .15, H2 + .3), '#5c3a22');                // かもい
    return s;
  }
  // 部屋の絵の大きさ（その部屋の原点からの画面上の箱）
  function roomBox(n) {
    n = n || N;
    const x0 = proj(0, n, 0)[0] - PAD, x1 = proj(n, 0, 0)[0] + PAD, y0 = proj(0, 0, WH)[1] - PAD, y1 = proj(n, n, 0)[1] + PAD + 10;
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }
  // 家の並び：部屋ごとの位置（マス）。list[0] がはじめの部屋、ほかは at: { p: つながる部屋, d: 'x'（右下）| 'y'（左下） }
  function layout(list) {
    const pos = [{ x: 0, y: 0 }], halls = [];
    for (let i = 1; i < list.length; i++) {
      const at = list[i].at || defAt(i), p = Math.min(at.p | 0, i - 1), pp = pos[p] || pos[0], pn = list[p].n || N, n = list[i].n || N;
      const c = Math.floor(Math.min(pn, n) / 2) - 1;
      if (at.d === 'y') { pos.push({ x: pp.x, y: pp.y + pn + HALL }); halls.push({ i, p, d: 'y', x0: pp.x + c, x1: pp.x + c + HALLW, y0: pp.y + pn, y1: pp.y + pn + HALL, u0: c, u1: c + HALLW }); }
      else { pos.push({ x: pp.x + pn + HALL, y: pp.y }); halls.push({ i, p, d: 'x', x0: pp.x + pn, x1: pp.x + pn + HALL, y0: pp.y + c, y1: pp.y + c + HALLW, u0: c, u1: c + HALLW }); }
    }
    return { pos, halls };
  }
  const defAt = i => i === 1 ? { p: 0, d: 'x' } : i === 2 ? { p: 0, d: 'y' } : { p: i - 1, d: 'x' };
  // その向きに部屋を足せるか（ほかの部屋や廊下と重ならないか）
  function canAttach(list, p, d, n) {
    if (list.some((r, i) => i && (r.at || defAt(i)).p === p && (r.at || defAt(i)).d === d)) return false;
    const L = layout(list.concat([{ at: { p, d }, n: n || N }])), k = L.pos.length - 1, me = L.pos[k], mn = n || N;
    const hit = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
    const box = { x0: me.x - 1, y0: me.y - 1, x1: me.x + mn + 1, y1: me.y + mn + 1 };
    for (let i = 0; i < k; i++) { const q = L.pos[i], qn = list[i].n || N; if (hit(box, { x0: q.x, y0: q.y, x1: q.x + qn, y1: q.y + qn })) return false; }
    for (const h of L.halls.slice(0, -1)) if (hit(box, h)) return false;
    return true;
  }

  // 床の家具を描く（rot は 0/1）
  // 家具の大きさの倍率（0.5・1・1.5・2）。見た目の「1倍」は、元の絵の1.5倍（BASE）
  //   床の家具は奥の角を中心に、壁の家具は下の辺を中心に大きくする。壁の家具は壁の高さに収まるところまで
  const SIZES = [0.5, 1, 1.5, 2], BASE = 1.5;
  const sizeOf = it => SIZES.includes(it.s) ? it.s : 1;
  const scaleOf = it => BASE * sizeOf(it);
  const wallScale = it => { const c = BY_ID[it.k]; return Math.min(scaleOf(it), (WH - c.v) / c.h); };
  // 絵の家具：床のひし形の左の角・下の角に、絵の左はし・下はしをあわせる。回転したら左右反転
  function imgFloor(it, c) {
    const rot = it.rot ? 1 : 0, fw = rot ? (c.d || 1) : c.w, fd = rot ? c.w : (c.d || 1);
    const [file, [iw, ih]] = imgOf(c.id, it.on);
    const left = proj(it.x, it.y + fd, 0), bottom = proj(it.x + fw, it.y + fd, 0);
    const w = (fw + fd) * TW / 2, h = w * ih / iw, x = left[0], y = bottom[1] - h;
    const flip = rot ? ` transform="translate(${(2 * x + w).toFixed(1)} 0) scale(-1 1)"` : '';
    let s = `<image href="img/room/${file}.webp" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}"${flip} preserveAspectRatio="none"/>`;
    if (c.light && it.on) { const [gx, gy] = proj(it.x + fw / 2, it.y + fd / 2, 1); s += `<circle cx="${gx.toFixed(1)}" cy="${gy.toFixed(1)}" r="${(w * .55).toFixed(1)}" fill="url(#rmGlow)" pointer-events="none"/>`; }
    return s;
  }
  function drawFloorItem(it, opts) {
    const c = BY_ID[it.k]; if (!c) return '';
    let body;
    if (c.img) body = imgFloor(it, c);
    else { const m = Maker(it.x, it.y, it.rot ? 1 : 0); c.draw(m, { on: !!it.on }); body = m.out.join(''); }
    const m = { out: [body] };
    const s = scaleOf(it); if (s === 1) return m.out.join('');
    const [px, py] = proj(it.x, it.y, 0);
    return `<g transform="translate(${px} ${py}) scale(${s}) translate(${-px} ${-py})">${m.out.join('')}</g>`;
  }
  function drawWallItem(it, opts) {
    const c = BY_ID[it.k]; if (!c) return '';
    const s = wallScale(it);
    const inner = c.img ? `<image href="img/room/${imgOf(c.id, it.on)[0]}.webp" x="0" y="0" width="${c.w}" height="${c.h}" preserveAspectRatio="none"/>` : c.wall({ on: !!it.on, night: opts && opts.night });
    return `<g transform="${wallMatrix(it.side, it.u, c.v + c.h * s)}"><g transform="scale(${s})">${inner}</g></g>`;
  }
  // 家具の大きさ（回転と倍率を考える。マスは切り上げ）
  function footprint(it) {
    const c = BY_ID[it.k], s = c.kind === 'wall' ? wallScale(it) : scaleOf(it);
    const w = Math.max(1, Math.ceil(c.w * s - 1e-9)), d = Math.max(1, Math.ceil((c.d || 1) * s - 1e-9));
    return it.rot ? { w: d, d: w } : { w, d };
  }
  // 床の点（マスの角）→ 画面の点、画面の点 → 床のマス
  function toGrid(sx, sy) {
    const a = (sx - OX) / (TW / 2), b = (sy - OY) / (TH / 2);
    return { x: (a + b) / 2, y: (b - a) / 2 };
  }
  // 画面の点 → 壁の位置（左壁なら y、右壁なら x）。高さ v も返す
  function toWall(sx, sy) {
    if (sx < OX) { const u = (OX - sx) / (TW / 2); const yb = OY + u * TH / 2; return { side: 'L', u, v: (yb - sy) / TZ }; }
    const u = (sx - OX) / (TW / 2); const yb = OY + u * TH / 2; return { side: 'R', u, v: (yb - sy) / TZ };
  }

  // 遊びに来たキャラ（顔の写真＋着物のからだ）
  const CHARA_COLORS = { koharu: '#2f4f8a', gensai: '#4a6a8a', hinata: '#e58fb0', shima: '#6b5a4a', tomoe: '#8a2a2a', mike: '#d9a35a', tono: '#5a3a8a', dgensai: '#2a1a3a' };
  // 遊びに来たキャラ：カットインの絵から切りぬいた立ち姿（img/visit_<key>.webp）。足もとはふわっと消えて、床の影に立つ
  function drawVisitor(v, faceUrl, key) {
    const [sx, sy] = proj(v.x + .5, v.y + .5, 0);
    const w = 62, h = w * 624 / 340;
    return `<g class="rm-visitor" data-key="${key}">
      <ellipse cx="${sx}" cy="${sy}" rx="20" ry="7" fill="rgba(0,0,0,.28)"/>
      <image href="img/visit_${key}.webp" x="${sx - w / 2}" y="${sy - h + 10}" width="${w}" height="${h}" preserveAspectRatio="xMidYMax meet"/>
      <rect x="${sx - 16}" y="${sy - h * 0.8}" width="32" height="${h * 0.8}" fill="transparent"/>
    </g>`;
  }

  const DEFS = `<defs>
    <radialGradient id="rmGlow"><stop offset="0" stop-color="#ffe9a8" stop-opacity=".75"/><stop offset="1" stop-color="#ffe9a8" stop-opacity="0"/></radialGradient>
    <radialGradient id="rmGlowR"><stop offset="0" stop-color="#ffb05a" stop-opacity=".7"/><stop offset="1" stop-color="#ff8a3a" stop-opacity="0"/></radialGradient>
  </defs>`;

  window.ROOMART = { swatch, LOW, HALL, HALLW, drawHall, drawDoor, roomBox, layout, canAttach, defAt, hasOn: id => !!IMG[id + '_on'], SIZES, BASE, sizeOf, scaleOf, wallScale, N, WH, W, H, TW, TH, TZ, OX, OY, proj, CATALOG, BY_ID, FLOORS, WALLS, drawFloor, drawWalls, drawFloorItem, drawWallItem, drawVisitor, footprint, toGrid, toWall, DEFS, shade };
})();
