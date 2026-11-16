/* デイリーミッション（ホームの「今日のミッション」）。数えるのはサーバー（server/missions.js）
 *   クリアすると50銭、5つ全部で さらに100銭がプレゼントボックスに届く。日本時間の0時にリセット
 */
(function () {
  'use strict';
  const P = window.APP;
  const $ = window.U.$, esc = window.U.esc;
  const LIST = [
    { id: 'games', name: '対局を5局打つ', n: 5, help: 'オンライン・キャラクター・ソロの実戦。すぐ終わった対局は数えません' },
    { id: 'atari', name: 'アタリを20回する', n: 20, help: '相手の石を、あと1手で取れる形（ダメが1つ）にする' },
    { id: 'keima', name: 'ケイマを10回打つ', n: 10, help: '自分の石から、将棋の桂馬の位置に打つ' },
    { id: 'tobi', name: '一間トビを10回打つ', n: 10, help: '自分の石から、1つあけてまっすぐ打つ（あいだは空いている）' },
    { id: 'ogeima', name: '大ゲイマを5回打つ', n: 5, help: '自分の石から、1つ横・3つ先に打つ' }
  ];
  const ZENI = 50, ALL = 100;
  let dm = null;

  // 形の小さな図（○ が自分の石、● が相手、☆ が今回打つところ）
  const PIC = {
    atari: { w: 3, h: 3, b: [[1, 0], [0, 1], [2, 1]], w2: [[1, 1]], s: [1, 2] },
    keima: { w: 2, h: 3, b: [[0, 0]], s: [1, 2] },
    tobi: { w: 1, h: 3, b: [[0, 0]], s: [0, 2] },
    ogeima: { w: 2, h: 4, b: [[0, 0]], s: [1, 3] },
    games: null
  };
  function pic(id) {
    const d = PIC[id]; if (!d) return '<span class="dm-pic dm-pic-go" aria-hidden="true">碁</span>';
    const g = 14, W = (d.w + 1) * g, H = (d.h + 1) * g, c = (x, y) => [(x + 1) * g - g / 2 + g / 2, (y + 1) * g - g / 2 + g / 2];
    let s = `<svg class="dm-pic" viewBox="0 0 ${W} ${H}" aria-hidden="true">`;
    for (let x = 0; x < d.w; x++) s += `<line x1="${c(x, 0)[0]}" y1="${g}" x2="${c(x, 0)[0]}" y2="${H - g}" stroke="#7a5a30" stroke-width="1"/>`;
    for (let y = 0; y < d.h; y++) s += `<line x1="${g}" y1="${c(0, y)[1]}" x2="${W - g}" y2="${c(0, y)[1]}" stroke="#7a5a30" stroke-width="1"/>`;
    for (const [x, y] of d.b) s += `<circle cx="${c(x, y)[0]}" cy="${c(x, y)[1]}" r="5.6" fill="#111" stroke="#000"/>`;
    for (const [x, y] of d.w2 || []) s += `<circle cx="${c(x, y)[0]}" cy="${c(x, y)[1]}" r="5.6" fill="#f4efe4" stroke="#555"/>`;
    s += `<circle cx="${c(...d.s)[0]}" cy="${c(...d.s)[1]}" r="5.6" fill="#111" stroke="#e35d47" stroke-width="2"/>`;
    return s + '</svg>';
  }
  const doneN = () => dm ? LIST.filter(m => (dm[m.id] | 0) >= m.n).length : 0;
  function bar() {
    const b = $('#homeDm'); if (!b) return;
    const n = doneN();
    $('#dmCount').textContent = `${n}/${LIST.length}`;
    b.classList.toggle('done', n === LIST.length);
  }
  function render() {
    const d = dm || {};
    $('#dmList').innerHTML = LIST.map(m => {
      const v = Math.min(m.n, d[m.id] | 0), ok = v >= m.n;
      return `<li class="${ok ? 'ok' : ''}">${pic(m.id)}<span class="dm-t"><b>${esc(m.name)}</b><small>${esc(m.help)}</small><span class="dm-gauge"><i style="width:${(v / m.n * 100).toFixed(0)}%"></i></span></span><span class="dm-n">${ok ? '✓' : `${v}/${m.n}`}<small>${ZENI}銭</small></span></li>`;
    }).join('') + `<li class="dm-all${d.all ? ' ok' : ''}"><span class="dm-pic dm-pic-go" aria-hidden="true">🎁</span><span class="dm-t"><b>5つぜんぶクリア</b><small>${doneN()}/${LIST.length}</small></span><span class="dm-n">${d.all ? '✓' : ''}<small>${ALL}銭</small></span></li>`;
  }
  function set(x) { if (x) { dm = x; bar(); if (!$('#dmBox').hidden) render(); } }
  function open() {
    P.sound('stone'); render(); $('#dmBox').hidden = false;
    if (P.online()) P.giftReq({ t: 'dm' }, m => { if (m && m.dm) set(m.dm); render(); });
  }
  // サーバーから：1局ぶん数えたあと
  function push(m) {
    set(m.dm);
    if (m.gifts && window.GIFT) window.GIFT.setGifts(m.gifts);
    const names = (m.cleared || []).map(id => id === 'all' ? null : (LIST.find(x => x.id === id) || {}).name).filter(Boolean);
    if (names.length) P.toast(`📜 ミッション「${names.join('」「')}」クリア！ プレゼントボックスに銭が届きました`, 4500);
    if ((m.cleared || []).includes('all')) setTimeout(() => P.toast(`🎁 今日のミッションぜんぶクリア！ ${ALL}銭のプレゼント`, 4500), 4700);
  }
  $('#homeDm').onclick = open;
  $('#dmClose').onclick = () => { P.sound('tap'); $('#dmBox').hidden = true; };
  $('#dmBox').addEventListener('click', e => { if (e.target.id === 'dmBox') $('#dmBox').hidden = true; });
  window.DM = { set, push, open };
})();
