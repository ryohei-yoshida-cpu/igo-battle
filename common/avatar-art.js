/* 共通アバター（囲碁・将棋・オセロなど、どのゲームでも同じものを使う）
 *
 * パーツは5種類：head 頭（顔と髪）/ body 身体（服を着た体）/ pet ペット / tool 道具 / bg 背景
 * 絵は img/av3/（460×650 のキャンバスに、素体 3692.png の位置で重ねてある）、一覧用の小さな絵は img/av3t/。
 * 素材は1枚に8個まで（高画質）。少しずつ増やす。tools/avatar-v3/place.py で置く。
 * 重ねる順：身体 → 頭 → 道具 → ペット
 *
 * look = { head, body, pet, tool, bg }
 */
(function (root) {
  'use strict';
  const W = 460, H = 650, VB = `0 0 ${W} ${H}`;
  const pre = root.AVATAR_BASE != null ? root.AVATAR_BASE : '';
  const base = pre + 'img/av3/', tbase = pre + 'img/av3t/', bgbase = pre + 'img/avatar/';
  const CATALOG = {
    head: [['h00', '桜かんざしのロング', 0], ['h01', 'メイドのツインテール', 1200], ['h02', 'ティアラの編みこみ', 1800], ['h03', 'ねこみみボブ', 1200],
      ['h04', 'くせっ毛（茶）', 0], ['h05', 'ふわふわショート（金）', 300], ['h06', 'さらさらショート（銀）', 300], ['h07', 'ゴーグル（紺）', 1200]],
    body: [['b00', 'ロリータドレス（桃）', 1200], ['b01', 'セーラー服', 0], ['b02', 'はかま（赤）', 1800], ['b03', 'プリンセスドレス（藤）', 2400],
      ['b04', '王子の軍服', 2400], ['b05', 'ネオンパーカー', 0], ['b06', '紋付きはかま', 1800], ['b07', '騎士のよろい', 2400]],
    pet: [['none', 'なし', 0], ['p00', '天使ねこ', 1800], ['p01', '子ドラゴン', 2400], ['p02', 'さくらうさぎ', 1200], ['p03', '魔法スライム', 1800],
      ['p04', 'ふくろう', 1200], ['p05', '九尾のきつね', 2400], ['p06', 'パンダ', 1200], ['p07', '星ねこ', 1800]],
    tool: [['none', 'なし', 0]],
    bg: [['none', 'なし', 0]].concat(['白いスタジオ', '草原', '桜並木', '南の海', '雪の森', 'お城', '魔法の門', '夜の街', '神社', 'ネオン街', 'カフェ', '教室', '子ども部屋', '図書館', 'ステージ', '夏祭り', 'ハロウィン', '海の底', '宇宙', '雲の上のお城']
      .map((name, i) => ['bg' + String(i).padStart(2, '0'), name, [1200, 1200, 1200, 1200, 1200, 1800, 2400, 1800, 1200, 1800, 1200, 1200, 1200, 1200, 1800, 1800, 1800, 2400, 2400, 2400][i]]))
  };
  const SLOTS = [['head', '頭'], ['body', '身体'], ['pet', 'ペット'], ['tool', '道具'], ['bg', '背景']];
  const TABS = SLOTS;
  const PRICE = {}, COLOR = {};
  for (const [slot, list] of Object.entries(CATALOG)) for (const [id, , price] of list) PRICE[slot + ':' + id] = price;
  const PRESETS = {
    girl: { head: 'h00', body: 'b01', pet: 'none', tool: 'none', bg: 'none' },
    boy: { head: 'h04', body: 'b05', pet: 'none', tool: 'none', bg: 'none' }
  };
  const DEFAULT = PRESETS.girl;
  function clean(look) {
    look = look || {};
    // 前の形のアバター（髪・上の服… や 顔・服…）は、最初の姿にもどす（背景だけ引きつぐ）
    if (look.head === undefined && (look.top !== undefined || look.outfit !== undefined || look.face !== undefined)) {
      const boy = look.body === 'boy' || /^(fb|ob)/.test(look.face || look.outfit || '');
      return Object.assign({}, boy ? PRESETS.boy : PRESETS.girl, { bg: PRICE['bg:' + look.bg] != null ? look.bg : 'none' });
    }
    const l = Object.assign({}, DEFAULT, look);
    for (const [slot] of SLOTS) if (PRICE[slot + ':' + l[slot]] == null) l[slot] = DEFAULT[slot];
    return { head: l.head, body: l.body, pet: l.pet, tool: l.tool, bg: l.bg };
  }
  const isSheet = () => false;
  const img = f => `<image href="${base}${f}.webp" x="0" y="0" width="${W}" height="${H}"/>`;
  function inner(look) {
    const l = clean(look);
    return `<ellipse cx="200" cy="620" rx="74" ry="10" fill="rgba(0,0,0,.16)"/>` + img(l.body) + img(l.head) +
      (l.tool !== 'none' ? img(l.tool) : '') + (l.pet !== 'none' ? img(l.pet) : '');
  }
  const bgImg = (look, x, y, w, h) => { const b = clean(look).bg; return b && b !== 'none' ? `<image href="${bgbase}${b}.webp" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice"/>` : ''; };
  const svg = (look, cls, withBg) => `<svg viewBox="${VB}" class="${cls || 'av-svg'}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" preserveAspectRatio="xMidYMid meet">${withBg ? bgImg(look, -200, -20, W + 400, H + 40) : ''}${inner(look)}</svg>`;
  const noneThumb = '<svg viewBox="0 0 4 3" class="av-thumb"><rect width="4" height="3" fill="#efe4d0"/><path d="M1 1L3 2M3 1L1 2" stroke="#b9a88a" stroke-width=".12"/></svg>';
  const bgThumb = id => id === 'none' ? noneThumb : `<svg viewBox="0 0 480 385" class="av-thumb"><image href="${bgbase}${id}.webp" width="480" height="385"/></svg>`;
  const CROP = { icon: '100 90 200 200', face: '60 30 280 300', body: VB };
  function thumb(look, tab) {
    const l = clean(look);
    if (tab === 'bg') return bgThumb(l.bg);
    if (tab === 'head' || tab === 'body' || tab === 'pet' || tab === 'tool') {
      const id = l[tab]; if (id === 'none') return noneThumb;
      return `<img class="av-thumb" loading="lazy" decoding="async" src="${tbase}${id}.webp" alt="">`;
    }
    return `<svg viewBox="${CROP[tab] || VB}" class="av-thumb" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${inner(look)}</svg>`;
  }
  root.AVATAR = { isSheet, W, H, VB, CATALOG, SLOTS, TABS, PRICE, COLOR, PRESETS, DEFAULT, clean, inner, svg, thumb };
})(typeof window !== 'undefined' ? window : globalThis);
