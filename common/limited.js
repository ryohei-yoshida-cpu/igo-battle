/* 囲碁BLITZ — 限定品のお知らせ（バナー）
 *   いま並んでいる行事・季節の限定品を、ホーム・マイルーム・ショップの上に出す。
 *   タップで静馬のルームショップの「限定」タブへ。マイルームがまだ開いていない人には出さない。
 */
(function () {
  const P = window.APP, S = P.S, $ = s => document.querySelector(s);
  const THEME = {   // [地の色, ふちの色, 字の色, ひとこと]
    newyear: ['#7a1414', '#e8c15a', '#fff4dc', '新年の飾りで、福を呼びこもう'], hina: ['#c2557a', '#f6d0de', '#fff6f9', '桃の節句の、やさしい飾り'],
    kodomo: ['#1f4f8a', '#f2c94c', '#f3f8ff', '鯉のぼりと兜で、端午の節句'], tanabata: ['#1c2559', '#f5d76e', '#eef1ff', '星に願いを。天の川の飾り'],
    tsukimi: ['#3b2a63', '#f1d27a', '#fbf4ff', 'お月見団子と、うさぎの夜'], halloween: ['#3b1d4f', '#f39a2b', '#fff3e6', 'かぼちゃとおばけの、ちょっとこわい夜'],
    xmas: ['#1d5a35', '#d8343a', '#fffaf0', '聖夜を彩る、ツリーと贈りもの'],
    spring: ['#b85c80', '#ffd6e4', '#fff7fa', '桜と花の、春の家具'], summer: ['#13667f', '#8fd6e8', '#effcff', '風鈴とかき氷の、夏の家具'],
    autumn: ['#8a3a12', '#f0a24a', '#fff5ea', '紅葉とすすきの、秋の家具'], winter: ['#2b4a72', '#cfe3f5', '#f4f9ff', '雪とこたつの、冬の家具']
  };
  const END_SEASON = { spring: '05-31', summer: '08-31', autumn: '11-30', winter: '02-28' };
  function daysLeft(tag, now) {
    const R = window.ROOMART, e = R.EVENTS[tag], to = e ? e.to : END_SEASON[tag];
    const d = new Date(now + 9 * 3600e3), y = d.getUTCFullYear(), [m, dd] = to.split('-').map(Number);
    let end = Date.UTC(y, m - 1, dd);
    if (tag === 'winter' && m === 2) end = Date.UTC(y, 2, 1) - 86400e3;   // 2月のおわり（うるう年も）
    const today = Date.UTC(y, d.getUTCMonth(), d.getUTCDate());
    if (end < today) { end = Date.UTC(y + 1, m - 1, dd); if (tag === 'winter') end = Date.UTC(y + 1, 2, 1) - 86400e3; }
    return Math.round((end - today) / 86400e3);
  }
  function html() {
    const R = window.ROOMART; if (!R || !R.openLimits || !window.ROOM) return '';
    if (window.PROG && !window.PROG.isOpen('room')) return '';
    const now = Date.now(), lim = R.openLimits(now);
    const items = R.CATALOG.filter(c => c.season && R.limitOpen(c.season, now));
    if (!items.length) return '';
    const top = lim[0], th = THEME[top.tag] || THEME.spring, left = daysLeft(top.tag, now);
    const pick = items.filter(c => c.season === top.tag && c.kind === 'floor').slice(0, 3);
    const other = lim.slice(1).map(x => x.name + 'の限定').join('・');
    return `<button type="button" class="lim-banner" style="--lb-bg:${th[0]};--lb-edge:${th[1]};--lb-fg:${th[2]}">
      <span class="lb-text"><b>${top.name}の限定${other ? `<i>＋${other}</i>` : ''}</b><small>${top.when}${left <= 7 ? `<em>あと${left === 0 ? '今日まで' : left + '日'}</em>` : ''}</small></span>
      <span class="lb-items">${pick.map(c => window.ROOM.thumb(c.id)).join('')}</span>
      <span class="lb-go">見る</span></button>`;
  }
  function refresh() {
    const h = html();
    for (const el of document.querySelectorAll('.lim-slot')) { if (el.dataset.h !== h) { el.innerHTML = h; el.dataset.h = h; } el.hidden = !h; }
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('.lim-banner'); if (!b) return;
    P.sound && P.sound('stone');
    window.ROOM.openShop('season');
  });
  window.LIMITED = { refresh };
  refresh();
})();
