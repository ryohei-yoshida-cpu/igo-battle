/* 九路 Blitz — ショップ（店員：ひなた）
 *   アバターショップ → 着せかえ画面、マイルームショップ → マイルームのショップ
 */
(function () {
  'use strict';
  const P = window.APP, A = P.A, S = P.S;
  const $ = s => document.querySelector(s);
  const HINATA = A.VARIANTS.findIndex(v => v.key === 'hinata');
  const HELLO = [
    'いらっしゃいませ♪ 今日はなにをお探しですか？',
    'いらっしゃいませー！ 新しい色、入ってますよ♪',
    'あっ、来てくれたんだ！ ゆっくり見ていってね♪',
    'いらっしゃいませ♪ 勝った銭で、ぱーっとお買いもの！',
    'お部屋のもようがえ、お手伝いしますよ♪',
    'その服もかわいいけど、ほかの色も似合いそう！',
    'いらっしゃいませ♪ 迷ったら、ひなたのおすすめ聞いてね！',
    'わぁ、銭がたまってますね！ なにか買っていきます？'
  ];
  const POOR = ['銭が少なくても、見るだけでも楽しいですよ♪', '対局に勝つと銭がもらえるよ！ またきてね♪'];
  const AV_SAY = ['アバターショップへ、ごあんなーい♪', '着せかえ、楽しんでね♪'];
  const ROOM_SAY = ['マイルームショップへ、ごあんなーい♪', '家具を置いたら、お部屋見せてね！'];
  const pick = a => a[Math.floor(Math.random() * a.length)];
  function say(t) {
    $('#shopTalk').textContent = t;
    const b = $('#shopBubble'); b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
  }
  function open() {
    P.setImg($('#shopImg'), A.charaUri(HINATA));
    $('#shopZeni').textContent = `${(S.zeni || 0).toLocaleString()} 銭`;
    if (window.AVATAR) $('#shopAvFig').innerHTML = window.AVATAR.svg(S.av || window.AVATAR.PRESETS.girl);
    if (window.ROOM) $('#shopRoomFig').innerHTML = window.ROOM.mini();
    P.showScreen('shop');
    say((S.zeni || 0) < 300 && Math.random() < 0.5 ? pick(POOR) : pick(HELLO));
  }
  const go = (lines, fn) => { say(pick(lines)); P.sound('stone'); setTimeout(fn, 550); };
  $('#openShop').onclick = () => { P.sound('stone'); open(); };
  $('#shopBack').onclick = () => { P.renderHome(); P.showScreen('home'); };
  $('#shopImg').onclick = () => say(pick(HELLO));
  $('#shopAvatar').onclick = () => go(AV_SAY, () => window.AVATAR_UI.open('top'));
  $('#shopRoom').onclick = () => go(ROOM_SAY, () => window.ROOM.open('shop'));
  window.SHOP = { open };
})();
