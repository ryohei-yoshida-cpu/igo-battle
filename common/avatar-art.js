/* 共通アバター（囲碁・将棋・オセロなど、どのゲームでも同じものを使う）
 *
 * 絵は、いただいた元画像（女の子・男の子）をパーツごとに切りぬいたもの（img/avatar/）。
 *   face 顔 / hair 髪 / body 体 / top 上の服 / bottom 下の服 / shoes 靴
 *   顔・髪・体は「女の子」「男の子」から選ぶ（目の位置で合わせてあるので、組み合わせ自由）。
 *   服と靴の形は体に合わせる。服・靴・髪の「色」を銭で買う（price 0 は最初から持っている）。
 *
 * look = { face, hair, body, hairColor, top, bottom, shoes }   … top / bottom / shoes は色の名前
 * AVATAR.svg(look) / AVATAR.inner(look) / AVATAR.thumb(look, tab)
 */
(function (root) {
  'use strict';
  const W = 320, H = 780, VB = `0 0 ${W} ${H}`;
  const base = (root.AVATAR_BASE != null ? root.AVATAR_BASE : '') + 'img/avatar/';
  // 色を変えるときの、元の絵の明るさ（切りぬいたときに測った値）
  const REF = { hair: 0.2475, top: 0.82, bottom: 0.62, shoes: 0.453 };

  // [id, 名前, 値段, 色（null は元の色のまま）]
  const CATALOG = {
    face: [['girl', 'ぱっちり', 0], ['boy', 'すっきり', 0],
      // 顔パターン（3664.png から切りぬき）
      ['smile', 'にこにこ', 200], ['laugh', 'おおわらい', 300], ['wink', 'ウインク', 300], ['kira', 'キラキラ', 400], ['cry', 'なみだ', 300],
      ['angry', 'ぷんぷん', 300], ['gaan', 'がーん', 300], ['paint', 'フェイスペイント', 600], ['wanko', 'わんこ', 700], ['kabuki', '歌舞伎', 800]],
    hair: [['girl', 'ロング', 0], ['boy', 'ショート', 0]],
    hairColor: [['kuro', '黒', 0, null], ['choco', 'こげ茶', 0, '#5a3a28'], ['kuri', '栗色', 300, '#8a5a34'], ['kin', '金', 500, '#e8be5c'], ['aka', '赤', 500, '#c4452e'], ['gin', '銀', 600, '#d6d8e2'], ['momo', '桃', 600, '#f39cbc'], ['ai', '藍', 600, '#4f6fd0'], ['midori', '翠', 600, '#3f9a6a']],
    body: [['girl', '女の子', 0], ['boy', '男の子', 0]],
    top: [['grey', 'グレー', 0, null], ['white', '白', 0, '#ffffff'], ['red', '赤', 300, '#e2493a'], ['navy', '紺', 300, '#2f3f78'], ['pink', '桃色', 300, '#f6a0bd'], ['yellow', '黄色', 300, '#f5cf4a'], ['mint', 'ミント', 300, '#7fd6be'], ['sky', '空色', 300, '#8cc4f2'], ['black', '黒', 400, '#3a3a40'], ['purple', '紫', 400, '#9a72d0']],
    bottom: [['denim', 'デニム', 0, null], ['black', '黒', 300, '#3a3a44'], ['white', '白', 300, '#f3f1ea'], ['khaki', 'カーキ', 300, '#b8a46e'], ['navy', '紺', 300, '#2f3f78'], ['red', '赤', 400, '#d84a3c'], ['pink', '桃色', 400, '#f2a2bf'], ['green', '緑', 400, '#5f9a5a']],
    shoes: [['olive', 'オリーブ', 0, null], ['red', '赤', 300, '#d84a3c'], ['navy', '紺', 300, '#34447e'], ['black', '黒', 300, '#3a3a40'], ['white', '白', 300, '#f3f1ea'], ['pink', '桃色', 300, '#f2a2bf'], ['brown', '茶色', 300, '#8a5a3a'], ['yellow', '黄色', 400, '#f0c84a']]
  };
  // 素材シート（髪・上の服・下の服・靴 各20）から切りぬいたパーツ。id は h00〜 / t00〜 / b00〜 / s00〜
  const SHEET = {
    hair: [['ショート（茶）', 300], ['ウェーブ（こげ茶）', 400], ['ツンツン（茶）', 400], ['ツインテール', 800], ['姫ボブ', 600],
      ['くせ毛（銀）', 600], ['ワイルド（赤）', 600], ['編みこみ（桃）', 900], ['ボサボサ（深緑）', 500], ['おだんご', 800],
      ['ツンツン（金）', 600], ['ボブ（紫）', 600], ['メッシュ（黒×赤）', 800], ['ゆるふわ（藤色）', 800], ['ポニーテール', 700],
      ['くせ毛（青緑）', 600], ['ねこみみ', 1200], ['カチューシャ', 900], ['メッシュ（白黒）', 900], ['アホ毛（桃）', 800]],
    top: [['白Tシャツ', 200], ['タキシード', 1200], ['セーラー服', 900], ['ロリータ', 1200], ['よろい', 2000],
      ['パーカー', 700], ['ケーブルセーター', 700], ['デニムジャケット', 900], ['ワイシャツ＆ネクタイ', 700], ['メイド服', 1500],
      ['貴族のケープ', 1500], ['チャイナ服', 1000], ['アロハシャツ', 600], ['サッカーシャツ', 500], ['魔法使いのマント', 1500],
      ['軍服', 1500], ['白衣', 1000], ['しばいぬパーカー', 1200], ['かぼちゃセーター', 1000], ['きんにく', 1500]],
    bottom: [['水色ショーツ', 200], ['カーゴショーツ', 400], ['黒ハーフパンツ', 400], ['ダメージデニム', 600], ['カーゴパンツ', 600],
      ['ジャージ短パン（紺）', 400], ['ジャージ短パン（白）', 400], ['ジャージ（黒）', 500], ['スウェット', 500], ['迷彩カーゴ', 700],
      ['プリーツスカート', 600], ['チェックスカート', 700], ['フリルスカート（黒）', 900], ['フリルスカート（桃）', 900], ['袴スカート', 1000],
      ['スラックス', 600], ['王子さまパンツ', 1500], ['海賊パンツ', 1200], ['かぼちゃパンツ（白）', 800], ['かぼちゃパンツ', 1200]],
    shoes: [['スリッポン', 200], ['赤いスニーカー', 400], ['青いハイカット', 500], ['ランニングシューズ', 600], ['ワークブーツ', 700],
      ['長ぐつ', 500], ['もこもこブーツ', 800], ['こうもりブーツ', 1200], ['騎士のブーツ', 1500], ['天使のブーツ', 1500],
      ['革ぐつ', 600], ['ローファー', 600], ['赤いストラップぐつ', 700], ['バレエシューズ', 600], ['ピンクのスリッパ', 500],
      ['ぞうり', 500], ['サンダル', 400], ['ひつじスリッパ', 900], ['きょうりゅうスリッパ', 1000], ['うさぎスリッパ', 900]]
  };
  const PFX = { hair: 'h', top: 't', bottom: 'b', shoes: 's' };
  for (const [slot, list] of Object.entries(SHEET)) list.forEach(([name, price], i) => CATALOG[slot].push([PFX[slot] + String(i).padStart(2, '0'), name, price]));
  const isSheet = id => /^[htbs]\d\d$/.test(id);
  // 素材シートの服・靴は、体がはみ出ないように 1.15倍。すその真ん中を中心に、上と横へ大きくする
  const GROW = 1.15, ANCHOR = {"b00_boy":[161,607],"b00_girl":[159,569],"b01_boy":[161,629],"b01_girl":[159,591],"b02_boy":[161,640],"b02_girl":[159,602],"b03_boy":[161,641],"b03_girl":[159,603],"b04_boy":[161,627],"b04_girl":[159,590],"b05_boy":[161,608],"b05_girl":[159,570],"b06_boy":[161,609],"b06_girl":[159,571],"b07_boy":[161,635],"b07_girl":[159,597],"b08_boy":[161,635],"b08_girl":[159,597],"b09_boy":[161,639],"b09_girl":[159,601],"b10_boy":[161,592],"b10_girl":[160,555],"b11_boy":[161,596],"b11_girl":[159,559],"b12_boy":[162,605],"b12_girl":[159,568],"b13_boy":[161,591],"b13_girl":[159,553],"b14_boy":[161,622],"b14_girl":[159,584],"b15_boy":[161,650],"b15_girl":[159,612],"b16_boy":[161,652],"b16_girl":[159,614],"b17_boy":[161,646],"b17_girl":[159,608],"b18_boy":[161,612],"b18_girl":[159,574],"b19_boy":[161,624],"b19_girl":[159,586],"s00_boy":[161,773],"s00_girl":[159,758],"s01_boy":[161,773],"s01_girl":[159,758],"s02_boy":[161,773],"s02_girl":[159,758],"s03_boy":[161,773],"s03_girl":[159,758],"s04_boy":[161,773],"s04_girl":[159,758],"s05_boy":[161,773],"s05_girl":[159,758],"s06_boy":[161,773],"s06_girl":[159,758],"s07_boy":[161,773],"s07_girl":[159,758],"s08_boy":[161,773],"s08_girl":[159,758],"s09_boy":[161,773],"s09_girl":[159,758],"s10_boy":[161,773],"s10_girl":[159,758],"s11_boy":[161,773],"s11_girl":[159,758],"s12_boy":[161,773],"s12_girl":[159,758],"s13_boy":[161,773],"s13_girl":[159,758],"s14_boy":[161,773],"s14_girl":[159,758],"s15_boy":[161,773],"s15_girl":[159,758],"s16_boy":[161,773],"s16_girl":[159,758],"s17_boy":[161,773],"s17_girl":[159,758],"s18_boy":[161,773],"s18_girl":[159,758],"s19_boy":[161,773],"s19_girl":[159,758],"t00_boy":[161,484],"t00_girl":[160,448],"t01_boy":[161,497],"t01_girl":[160,460],"t02_boy":[161,490],"t02_girl":[160,454],"t03_boy":[161,493],"t03_girl":[160,457],"t04_boy":[161,504],"t04_girl":[160,466],"t05_boy":[161,494],"t05_girl":[160,458],"t06_boy":[161,492],"t06_girl":[160,456],"t07_boy":[161,487],"t07_girl":[160,451],"t08_boy":[161,492],"t08_girl":[160,456],"t09_boy":[161,493],"t09_girl":[160,457],"t10_boy":[161,477],"t10_girl":[160,443],"t11_boy":[161,494],"t11_girl":[160,458],"t12_boy":[161,486],"t12_girl":[160,450],"t13_boy":[161,483],"t13_girl":[160,448],"t14_boy":[161,503],"t14_girl":[160,465],"t15_boy":[161,505],"t15_girl":[160,467],"t16_boy":[161,504],"t16_girl":[160,466],"t17_boy":[161,500],"t17_girl":[160,462],"t18_boy":[161,499],"t18_girl":[160,461],"t19_boy":[161,489],"t19_girl":[160,453]};
  // サーバーが持ち物を確かめる項目（値段のあるもの）
  // 背景（3672.png から切りぬき）。アバターの大きな絵のうしろに出る
  CATALOG.bg = [['none', 'なし', 0]].concat(['白いスタジオ', '草原', '桜並木', '南の海', '雪の森', 'お城', '魔法の門', '夜の街', '神社', 'ネオン街', 'カフェ', '教室', '子ども部屋', '図書館', 'ステージ', '夏祭り', 'ハロウィン', '海の底', '宇宙', '雲の上のお城']
    .map((name, i) => ['bg' + String(i).padStart(2, '0'), name, Math.max(600, [300, 300, 600, 600, 600, 900, 1200, 900, 600, 900, 600, 300, 300, 600, 900, 900, 900, 1200, 1200, 1200][i])]));
  const SLOTS = [['face', '顔'], ['hair', '髪'], ['hairColor', '髪の色'], ['body', '体'], ['top', '上の服'], ['bottom', '下の服'], ['shoes', '靴'], ['bg', '背景']];
  // 着せかえ画面のタブ
  const TABS = [['face', '顔'], ['hair', '髪'], ['body', '体'], ['top', '上の服'], ['bottom', '下の服'], ['shoes', '靴'], ['bg', '背景']];
  // 値段は4段階（下300・中1200・上1800・特2400 … 対局3・12・18・24回ぶん）
  const TIER = p => p === 0 ? 0 : p <= 300 ? 300 : p <= 700 ? 1200 : p <= 1000 ? 1800 : 2400;
  for (const list of Object.values(CATALOG)) for (const it of list) it[2] = TIER(it[2]);
  const PRICE = {}, COLOR = {};
  for (const [slot, list] of Object.entries(CATALOG)) for (const [id, , price, col] of list) { PRICE[slot + ':' + id] = price; COLOR[slot + ':' + id] = col || null; }
  const PRESETS = {
    girl: { face: 'girl', hair: 'girl', body: 'girl', hairColor: 'kuro', top: 'grey', bottom: 'denim', shoes: 'olive', bg: 'none' },
    boy: { face: 'boy', hair: 'boy', body: 'boy', hairColor: 'kuro', top: 'grey', bottom: 'denim', shoes: 'olive', bg: 'none' }
  };
  const DEFAULT = PRESETS.girl;
  function clean(look) {
    const l = Object.assign({}, DEFAULT, look || {});
    for (const [slot] of SLOTS) if (PRICE[slot + ':' + l[slot]] == null) l[slot] = DEFAULT[slot];
    return { face: l.face, hair: l.hair, body: l.body, hairColor: l.hairColor, top: l.top, bottom: l.bottom, shoes: l.shoes, bg: l.bg };
  }

  // 明るさを保ったまま色をつける（feColorMatrix）
  let seq = 0;
  function tint(id, hex, ref) {
    const n = parseInt(hex.slice(1), 16), c = [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
    const row = k => [0.299, 0.587, 0.114].map(w => (c[k] * w / ref).toFixed(4)).join(' ') + ' 0 0';
    return `<filter id="${id}" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="${row(0)} ${row(1)} ${row(2)} 0 0 0 1 0"/></filter>`;
  }
  // 「ぱっちり」をショートの髪で使うときは、男の子の頭の形に女の子の目をのせた顔（元の顔は横を長い髪でかくしていたため）
  const NEWFACE = new Set(['smile', 'laugh', 'wink', 'kira', 'cry', 'angry', 'gaan', 'paint', 'wanko', 'kabuki']);
  const DECO = new Set(['kira', 'angry', 'gaan', 'paint', 'wanko']);   // おでこの飾りは髪の上に重ねる
  const faceFile = l => NEWFACE.has(l.face) ? 'f_' + l.face : l.face === 'girl' && l.hair !== 'girl' ? 'girl2' : l.face;
  function inner(look) {
    const l = clean(look), b = l.body, pre = 'av' + (++seq) + '_';
    let defs = '';
    const img = (file, filt) => {
      const tag = `<image href="${base}${file}${isSheet(file.slice(0, 3)) ? '.webp' : '.png'}" x="0" y="0" width="${W}" height="${H}"${filt ? ` filter="url(#${pre + filt})"` : ''}/>`;
      const a = ANCHOR[file]; if (!a) return tag;
      return `<g transform="translate(${a[0]} ${a[1]}) scale(${GROW}) translate(${-a[0]} ${-a[1]})">${tag}</g>`;
    };
    const tinted = (key, slot, ref) => { const col = COLOR[slot + ':' + l[slot]]; if (!col) return null; defs += tint(pre + key, col, ref); return key; };
    const fTop = isSheet(l.top) ? null : tinted('t', 'top', REF.top), fBot = isSheet(l.bottom) ? null : tinted('b', 'bottom', REF.bottom),
      fShoe = isSheet(l.shoes) ? null : tinted('s', 'shoes', REF.shoes), fHair = isSheet(l.hair) ? null : tinted('h', 'hairColor', REF.hair);
    return `<defs>${defs}</defs><ellipse cx="160" cy="752" rx="92" ry="12" fill="rgba(0,0,0,.16)"/>` +
      img(b + '_body') + img(faceFile(l) + '_face') +
      (isSheet(l.bottom) ? img(l.bottom + '_' + b) : img(b + '_bottom', fBot)) +
      (isSheet(l.top) ? img(l.top + '_' + b) : img(b + '_top', fTop)) +
      (isSheet(l.shoes) ? img(l.shoes + '_' + b) : img(b + '_socks') + img(b + '_shoes', fShoe)) +
      (isSheet(l.hair) ? img(l.hair + '_hair') : img(l.hair + '_hair', fHair)) + (DECO.has(l.face) ? img('f_' + l.face + '_deco') : '');
  }
  // withBg：背景つき（着せかえ画面などの大きな絵）。背景は絵の大きさいっぱいに広げる
  const bgImg = (look, x, y, w, h) => { const b = clean(look).bg; return b && b !== 'none' ? `<image href="${base}${b}.webp" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice"/>` : ''; };
  const svg = (look, cls, withBg) => `<svg viewBox="${VB}" class="${cls || 'av-svg'}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" preserveAspectRatio="xMidYMid meet">${withBg ? bgImg(look, -240, -40, W + 480, H + 80) : ''}${inner(look)}</svg>`;
  const bgThumb = id => id === 'none' ? '<svg viewBox="0 0 4 3" class="av-thumb"><rect width="4" height="3" fill="#efe4d0"/><path d="M1 1L3 2M3 1L1 2" stroke="#b9a88a" stroke-width=".12"/></svg>' : `<svg viewBox="0 0 480 385" class="av-thumb"><image href="${base}${id}.webp" width="480" height="385"/></svg>`;
  const CROP = { icon: '62 52 196 196', face: '58 50 204 204', hair: '0 0 320 420', body: VB, top: '20 220 280 260', bottom: '40 380 240 200', shoes: '40 590 240 190' };
  const thumb = (look, tab) => tab === 'bg' ? bgThumb(clean(look).bg) : `<svg viewBox="${CROP[tab] || VB}" class="av-thumb" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${inner(look)}</svg>`;
  // 先に読みこんでおく
  if (typeof Image !== 'undefined') setTimeout(() => { for (const g of ['girl', 'boy']) for (const p of ['body', 'face', 'hair', 'top', 'bottom', 'socks', 'shoes']) new Image().src = base + g + '_' + p + '.png'; new Image().src = base + 'girl2_face.png'; }, 800);

  root.AVATAR = { isSheet, W, H, VB, CATALOG, SLOTS, TABS, PRICE, COLOR, PRESETS, DEFAULT, clean, inner, svg, thumb };
})(typeof window !== 'undefined' ? window : globalThis);
