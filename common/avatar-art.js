/* 共通アバター（囲碁・将棋・オセロなど、どのゲームでも同じものを使う）
 *
 * 2026/11/13 に作りなおし。素体は1つ（男女なし・3692.png）。パーツは5種類：
 *   face 顔（顔と髪型がいっしょ）/ outfit 服（上下セット）/ shoes 靴 / pet ペット / bg 背景
 * 絵は img/av2/（400×600 のキャンバスに素体の位置で重ねてある）、一覧用の小さな絵は img/av2t/。
 * 重ねる順：素体の体 → 素体の頭 → 服 → 靴 → 顔 → 服のぼうし（ある服だけ）→ ペット
 *
 * look = { face, outfit, shoes, pet, bg }
 * AVATAR.svg(look) / AVATAR.inner(look) / AVATAR.thumb(look, tab)
 */
(function (root) {
  'use strict';
  const W = 400, H = 600, VB = `0 0 ${W} ${H}`;
  const pre = root.AVATAR_BASE != null ? root.AVATAR_BASE : '';
  const base = pre + 'img/av2/', tbase = pre + 'img/av2t/', bgbase = pre + 'img/avatar/';
  const CAT = root.AVATAR_CAT || { face: [], outfit: [], shoes: [], pet: [] };
  const HATS = new Set(root.AVATAR_HATS || []);
  const CATALOG = {
    face: CAT.face,
    outfit: CAT.outfit,
    shoes: [['none', 'なし', 0]].concat(CAT.shoes),
    pet: [['none', 'なし', 0]].concat(CAT.pet),
    bg: [['none', 'なし', 0]].concat(['白いスタジオ', '草原', '桜並木', '南の海', '雪の森', 'お城', '魔法の門', '夜の街', '神社', 'ネオン街', 'カフェ', '教室', '子ども部屋', '図書館', 'ステージ', '夏祭り', 'ハロウィン', '海の底', '宇宙', '雲の上のお城']
      .map((name, i) => ['bg' + String(i).padStart(2, '0'), name, [1200, 1200, 1200, 1200, 1200, 1800, 2400, 1800, 1200, 1800, 1200, 1200, 1200, 1200, 1800, 1800, 1800, 2400, 2400, 2400][i]]))
  };
  const SLOTS = [['face', '顔'], ['outfit', '服'], ['shoes', '靴'], ['pet', 'ペット'], ['bg', '背景']];
  const TABS = SLOTS;
  const PRICE = {}, COLOR = {};
  for (const [slot, list] of Object.entries(CATALOG)) for (const [id, , price] of list) PRICE[slot + ':' + id] = price;
  const PRESETS = {
    girl: { face: 'fg000', outfit: 'og000', shoes: 'none', pet: 'none', bg: 'none' },
    boy: { face: 'fb000', outfit: 'ob000', shoes: 'none', pet: 'none', bg: 'none' }
  };
  const DEFAULT = PRESETS.girl;
  function clean(look) {
    const l = Object.assign({}, DEFAULT, look || {});
    // 前の形（髪・上の服…）のアバターは、最初の姿にもどす
    if (look && look.top !== undefined && look.outfit === undefined) return Object.assign({}, look.body === 'boy' ? PRESETS.boy : PRESETS.girl, { bg: PRICE['bg:' + look.bg] != null ? look.bg : 'none' });
    for (const [slot] of SLOTS) if (PRICE[slot + ':' + l[slot]] == null) l[slot] = DEFAULT[slot];
    return { face: l.face, outfit: l.outfit, shoes: l.shoes, pet: l.pet, bg: l.bg };
  }
  const isSheet = () => false;
  const img = f => `<image href="${base}${f}.webp" x="0" y="0" width="${W}" height="${H}"/>`;
  function inner(look) {
    const l = clean(look);
    return `<ellipse cx="200" cy="572" rx="70" ry="9" fill="rgba(0,0,0,.16)"/>` + img('base_body') + img('base_head') + img(l.outfit) +
      (l.shoes !== 'none' ? img(l.shoes) : '') + img(l.face) + (HATS.has(l.outfit) ? img(l.outfit + 'h') : '') + (l.pet !== 'none' ? img(l.pet) : '');
  }
  // withBg：背景つき（着せかえ画面などの大きな絵）
  const bgImg = (look, x, y, w, h) => { const b = clean(look).bg; return b && b !== 'none' ? `<image href="${bgbase}${b}.webp" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice"/>` : ''; };
  const svg = (look, cls, withBg) => `<svg viewBox="${VB}" class="${cls || 'av-svg'}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" preserveAspectRatio="xMidYMid meet">${withBg ? bgImg(look, -200, -20, W + 400, H + 40) : ''}${inner(look)}</svg>`;
  const noneThumb = '<svg viewBox="0 0 4 3" class="av-thumb"><rect width="4" height="3" fill="#efe4d0"/><path d="M1 1L3 2M3 1L1 2" stroke="#b9a88a" stroke-width=".12"/></svg>';
  const bgThumb = id => id === 'none' ? noneThumb : `<svg viewBox="0 0 480 385" class="av-thumb"><image href="${bgbase}${id}.webp" width="480" height="385"/></svg>`;
  const CROP = { icon: '110 80 180 180', face: '70 20 260 260', body: VB };
  // tab が顔・服・靴・ペットなら、そのパーツだけの小さな絵（一覧用・あとから読みこむ）
  function thumb(look, tab) {
    const l = clean(look);
    if (tab === 'bg') return bgThumb(l.bg);
    if (tab === 'face' || tab === 'outfit' || tab === 'shoes' || tab === 'pet') {
      const id = l[tab]; if (id === 'none') return noneThumb;
      return `<img class="av-thumb" loading="lazy" decoding="async" src="${tbase}${id}.webp" alt="">`;
    }
    return `<svg viewBox="${CROP[tab] || VB}" class="av-thumb" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${inner(look)}</svg>`;
  }
  if (typeof Image !== 'undefined') setTimeout(() => { for (const f of ['base_body', 'base_head', 'fg000', 'og000']) new Image().src = base + f + '.webp'; }, 800);

  root.AVATAR = { isSheet, W, H, VB, CATALOG, SLOTS, TABS, PRICE, COLOR, PRESETS, DEFAULT, clean, inner, svg, thumb };
})(typeof window !== 'undefined' ? window : globalThis);
