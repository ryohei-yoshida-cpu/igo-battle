/* 共通の小さな道具（ほかのファイルより先に読みこむ）
 *   U.$(s) / U.$$(s)   … 画面の部品をさがす（1つ / 全部）
 *   U.esc(s)           … 文字を画面に出す前の安全処理（< > & " ' を置きかえる）。人が書いた文字は必ずこれを通す
 *   U.pick(list)       … ランダムに1つ
 *   U.standSrc(key)    … キャラクターの立ち絵の画像（isStand：全身の立ち絵があるか）
 *   U.waitText(r)      … 連投の禁止で「あと何秒（何分）」の文
 */
(function () {
  'use strict';
  const STAND = new Set(['hinata', 'shima', 'tomoe', 'mike', 'tono']);
  window.U = {
    $: s => document.querySelector(s),
    $$: s => [...document.querySelectorAll(s)],
    esc: s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
    pick: a => a[Math.floor(Math.random() * a.length)],
    isStand: key => STAND.has(key),
    standSrc: key => STAND.has(key) ? `img/stand_${key}.webp` : `img/visit_${key}.webp`,
    waitText: r => `連続では書きこめません。あと${r.sec >= 60 ? Math.ceil(r.sec / 60) + '分' : r.sec + '秒'}待ってください`
  };
})();
