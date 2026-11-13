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
  function open(startSlot) {
    look = myLook(); slot = startSlot || 'face';
    P.showScreen('avatar');
    render();
  }
  function changed() { return JSON.stringify(AV.clean(look)) !== JSON.stringify(myLook()); }
  function unowned() { return AV.SLOTS.map(([sl]) => sl).filter(sl => !owned(sl, look[sl])); }
  // タブの中身：髪のタブは「髪型」と「髪の色」
  // 元の絵の服（色を買う）と、素材シートの服（形ごと買う）を分けて並べる
  const sections = tab => tab === 'hair' ? [['hair', '髪型（元の絵）', id => !AV.isSheet(id)], ['hairColor', '髪の色（元の絵の髪だけ）'], ['hair', 'いろいろな髪型', AV.isSheet]]
    : tab === 'face' || tab === 'body' || tab === 'bg' ? [[tab, '']]
    : [[tab, tab === 'shoes' ? 'いろいろな靴' : 'いろいろな服', AV.isSheet], [tab, '元の絵の服の色', id => !AV.isSheet(id)]];
  function render() {
    $('#avBig').innerHTML = AV.svg(look, 'av-svg', true);
    $('#avZeni').textContent = zeniText();
    $('#avTabs').innerHTML = AV.TABS.map(([k, n]) => `<button type="button" data-slot="${k}" aria-pressed="${slot === k}">${n}</button>`).join('');
    let h = '';
    for (const [sl, title, only] of sections(slot)) {
      if (title) h += `<div class="av-sec">${title}</div>`;
      h += AV.CATALOG[sl].filter(([id]) => !only || only(id)).map(([id, name, price]) => {
        const have = owned(sl, id), wearing = look[sl] === id;
        const preview = Object.assign({}, look, { [sl]: id });
        return `<button type="button" class="av-item ${wearing ? 'on' : ''}" data-sl="${sl}" data-id="${id}">${AV.thumb(preview, slot)}<b>${name}</b>` +
          `<small class="${have ? 'own' : 'price'}">${have ? (wearing ? '着ている' : '持っている') : price.toLocaleString() + ' 銭'}</small></button>`;
      }).join('');
    }
    $('#avGrid2').innerHTML = h;
    const need = unowned();
    $('#avSave').disabled = !changed() && !need.length;
    $('#avSave').textContent = need.length ? '試着中のパーツを買う' : 'この姿にする';
    $('#avNote').textContent = need.length ? '「試着」中です。銭で買うと、この姿にできます。' : changed() ? '' : 'いまの姿です。';
  }
  const BUY_NG = { zeni: '銭が足りません', offline: 'サーバーにつながっていないので、今は買えません', have: 'もう持っています' };
  // 1回目のタップは試着だけ。試着中のものをもう一度タップすると「買いますか？」
  function askBuy(sl, id) {
    const entry = AV.CATALOG[sl].find(x => x[0] === id); if (!entry) return;
    const price = entry[2];
    if ((S.zeni || 0) < price) { P.toast(`${entry[1]}は ${price} 銭です。銭が足りません`); return; }
    P.confirmBox(`${entry[1]}を ${price} 銭で買いますか？`, () => {
      P.buy({ av: sl + ':' + id }, price, res => {
        if (!res.ok) { P.toast(BUY_NG[res.reason] || '買えませんでした'); return; }
        P.sound('ok'); P.toast(`${entry[1]}を買いました`); render();
      });
    });
  }
  $('#avGrid2').addEventListener('click', e => {
    const b = e.target.closest('.av-item'); if (!b) return;
    const sl = b.dataset.sl, id = b.dataset.id, entry = AV.CATALOG[sl].find(x => x[0] === id);
    const again = look[sl] === id;
    look[sl] = id; P.sound('tap'); render();
    if (owned(sl, id)) return;
    if (again) askBuy(sl, id);
    else P.toast(`${entry[1]}を試着中（${entry[2]} 銭）。もう一度タップすると買えます`);
  });
  $('#avTabs').addEventListener('click', e => { const b = e.target.closest('[data-slot]'); if (b) { slot = b.dataset.slot; render(); } });
  document.querySelectorAll('.av-presets [data-preset]').forEach(b => b.onclick = () => {
    const p = AV.PRESETS[b.dataset.preset];
    look = Object.assign({}, look, { face: p.face, hair: p.hair, body: p.body });
    render();
  });
  $('#avSave').onclick = () => {
    const need = unowned();
    if (need.length) { askBuy(need[0], look[need[0]]); return; }   // まだ買っていないパーツを順に買う
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
