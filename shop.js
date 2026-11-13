/* 九路 Blitz — ショップ
 *   上：ひなたの「服ショップ」（アバターの服ショップへ）
 *   下：静馬の「ルームショップ」（マイルームのショップへ）
 */
(function () {
  'use strict';
  const P = window.APP, S = P.S;
  const $ = s => document.querySelector(s);
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const H_HELLO = [
    'いらっしゃいませ♪ 新作、入ってますよ！', 'あっ、来てくれたんだ！ 試着はタダだよ♪', 'その服もかわいいけど、ほかのも似合いそう！',
    '勝った銭で、ぱーっとお買いもの！', '迷ったら、ひなたのおすすめ聞いてね♪'
  ];
  const S_HELLO = [
    '……いらっしゃい。ゆっくり見ていけ。', '部屋は、打ち手の心をうつす。', '掘り出し物が入っている。', '家具は、置き方しだいで化けるぞ。', '……銭は、使ってこそ生きる。'
  ];
  const H_GO = ['服ショップへ、ごあんなーい♪', '試着室へご案内ー♪'];
  const S_GO = ['……こっちだ。', 'いい部屋になりそうだな。'];
  function bubble(id, textId, t) { $(textId).textContent = t; const b = $(id); b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); }
  function open() {
    $('#shopZeni').textContent = `${(S.zeni || 0).toLocaleString()} 銭`;
    P.showScreen('shop');
    bubble('#shopBubbleH', '#shopTalkH', (S.zeni || 0) < 300 ? '銭が少なくても、見るだけでも楽しいよ♪' : pick(H_HELLO));
    bubble('#shopBubbleS', '#shopTalkS', pick(S_HELLO));
  }
  $('#openShop').onclick = () => { P.sound('stone'); open(); };
  $('#shopBack').onclick = () => { P.renderHome(); P.showScreen('home'); };
  $('#shopAvatar').onclick = () => { bubble('#shopBubbleH', '#shopTalkH', pick(H_GO)); P.sound('stone'); setTimeout(() => window.AVATAR_UI.open('shop', 'top', 'shop'), 450); };
  $('#shopRoom').onclick = () => { bubble('#shopBubbleS', '#shopTalkS', pick(S_GO)); P.sound('stone'); setTimeout(() => window.ROOM.open('shop', 'shop'), 450); };
  window.SHOP = { open };
})();
