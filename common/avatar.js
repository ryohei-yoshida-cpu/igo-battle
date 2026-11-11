/* 共通：アバターの着せかえ画面と、マイルームのえらぶ画面（アバター／マイルーム／キャラクター）
 *   パーツは銭で買う（サーバーが持ち物を確かめる）。「この姿にする」で保存（そのときだけサーバーへ送る）。
 *   キャラクターはこのゲーム（囲碁）だけのもの。アバター・部屋・銭は、ほかのゲームとも共有する。
 */
(function () {
  'use strict';
  const P = window.APP, S = P.S, AV = window.AVATAR;
  const $ = s => document.querySelector(s);
  let look = null, slot = 'face';

  const myLook = () => AV.clean(S.av || AV.PRESETS.girl);
  const owned = (sl, id) => AV.PRICE[sl + ':' + id] === 0 || (S.avOwned || []).includes(sl + ':' + id);
  const zeniText = () => `${(S.zeni || 0).toLocaleString()} 銭`;

  /* ---------- えらぶ画面 ---------- */
  function openHub() {
    $('#hubAv').innerHTML = AV.svg(myLook());
    P.setImg($('#hubChara'), P.myCharaSrc());
    $('#hubZeni').textContent = zeniText();
    $('#hubRoom').innerHTML = window.ROOM ? window.ROOM.mini() : '';
    P.showScreen('hub');
  }
  $('#openHub').onclick = () => { P.sound('stone'); openHub(); };
  $('#hubBack').onclick = () => { P.renderHome(); P.showScreen('home'); };
  $('#openAvatar').onclick = () => { P.sound('stone'); open(); };

  /* ---------- 着せかえ ---------- */
  function open() {
    look = myLook(); slot = 'face';
    P.showScreen('avatar');
    render();
  }
  function changed() { return JSON.stringify(AV.clean(look)) !== JSON.stringify(myLook()); }
  function unowned() { return AV.SLOTS.map(([sl]) => sl).filter(sl => !owned(sl, look[sl])); }
  function render() {
    $('#avBig').innerHTML = AV.svg(look);
    $('#avZeni').textContent = zeniText();
    $('#avHairColors').innerHTML = Object.entries(AV.HAIR_COLORS).map(([k, c]) => `<button type="button" data-hc="${k}" style="--c:${c}" aria-pressed="${look.hairColor === k}" title="${AV.HAIR_COLOR_NAME[k]}"></button>`).join('');
    $('#avSkins').innerHTML = Object.entries(AV.SKINS).map(([k, c]) => `<button type="button" data-skin="${k}" style="--c:${c}" aria-pressed="${look.skin === k}" title="${AV.SKIN_NAME[k]}"></button>`).join('');
    $('#avTabs').innerHTML = AV.SLOTS.map(([k, n]) => `<button type="button" data-slot="${k}" aria-pressed="${slot === k}">${n}</button>`).join('');
    const list = AV.CATALOG[slot];
    $('#avGrid2').innerHTML = list.map(([id, name, price]) => {
      const have = owned(slot, id), wearing = look[slot] === id;
      const preview = Object.assign({}, look, { [slot]: id });
      return `<button type="button" class="av-item ${wearing ? 'on' : ''}" data-id="${id}">${AV.thumb(preview, slot)}<b>${name}</b>` +
        `<small class="${have ? 'own' : 'price'}">${have ? (wearing ? '着ている' : '持っている') : price.toLocaleString() + ' 銭'}</small></button>`;
    }).join('');
    const need = unowned();
    $('#avSave').disabled = !changed();
    $('#avSave').textContent = need.length ? 'まだ買っていないパーツがあります' : 'この姿にする';
    $('#avNote').textContent = need.length ? '「試着」中です。銭で買うと、この姿にできます。' : changed() ? '' : 'いまの姿です。';
  }
  const BUY_NG = { zeni: '銭が足りません', offline: 'サーバーにつながっていないので、今は買えません', have: 'もう持っています' };
  $('#avGrid2').addEventListener('click', e => {
    const b = e.target.closest('.av-item'); if (!b) return;
    const id = b.dataset.id, entry = AV.CATALOG[slot].find(x => x[0] === id);
    look[slot] = id; P.sound('tap'); render();
    if (!owned(slot, id)) {
      const price = entry[2];
      if ((S.zeni || 0) < price) { P.toast(`${entry[1]}は ${price} 銭です（試着中）。銭が足りません`); return; }
      P.confirmBox(`${entry[1]}を ${price} 銭で買いますか？`, () => {
        P.buy({ av: slot + ':' + id }, price, res => {
          if (!res.ok) { P.toast(BUY_NG[res.reason] || '買えませんでした'); return; }
          P.sound('ok'); P.toast(`${entry[1]}を買いました`); render();
        });
      });
    }
  });
  $('#avTabs').addEventListener('click', e => { const b = e.target.closest('[data-slot]'); if (b) { slot = b.dataset.slot; render(); } });
  $('#avHairColors').addEventListener('click', e => { const b = e.target.closest('[data-hc]'); if (b) { look.hairColor = b.dataset.hc; render(); } });
  $('#avSkins').addEventListener('click', e => { const b = e.target.closest('[data-skin]'); if (b) { look.skin = b.dataset.skin; render(); } });
  document.querySelectorAll('.av-presets [data-preset]').forEach(b => b.onclick = () => {
    const p = AV.PRESETS[b.dataset.preset];
    look = Object.assign({}, look, { face: p.face, hair: p.hair, top: p.top, bottom: p.bottom, shoes: p.shoes, body: p.body });
    render();
  });
  $('#avSave').onclick = () => {
    if (unowned().length) return;
    const l = AV.clean(look);
    const done = () => { S.av = l; P.saveLocal(); P.sound('ok'); P.toast('アバターを着がえました'); render(); };
    if (!P.online()) { if (P.FR.available()) { P.toast('サーバーにつながっていません'); return; } done(); return; }
    P.soc('avatar', { look: l }, res => { if (res.ok) done(); else P.toast('保存できませんでした'); });
  };
  $('#avBack').onclick = () => {
    if (changed() && !unowned().length) P.confirmBox('着がえを保存せずにもどりますか？', openHub);
    else openHub();
  };

  // キャラクター画面は、えらぶ画面から開いて、えらぶ画面にもどる
  $('#charaBack').onclick = openHub;
  window.AVATAR_UI = { open, openHub };
})();
