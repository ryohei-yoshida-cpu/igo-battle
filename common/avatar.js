/* 共通：アバター（服ショップ／クローク）と、マイルームのえらぶ画面（アバター／マイルーム／キャラクター）
 *   服ショップ … ひなたが店員。タップで試着、もう一度タップか試着中リストで買う。買ったら「そのまま着替える？」
 *   クローク   … 持っている服だけ。えらんで「この姿にする」で保存（そのときだけサーバーへ送る）
 *   パーツは銭で買う（サーバーが持ち物を確かめる）。
 *   キャラクターはこのゲーム（囲碁）だけのもの。アバター・部屋・銭は、ほかのゲームとも共有する。
 */
(function () {
  'use strict';
  const P = window.APP, S = P.S, AV = window.AVATAR;
  const $ = s => document.querySelector(s);
  let look = null, slot = 'face', mode = 'shop', from = 'hub';

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
  $('#openAvatar').onclick = () => { P.sound('stone'); open('closet', null, 'hub'); };
  $('#openAvShop').onclick = () => { P.sound('stone'); open('shop', null, 'hub'); };

  /* ---------- ひなた（服ショップの店員） ---------- */
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const SAY = {
    hello: ['いらっしゃいませ♪ 気になる服は、タップで試着できるよ！', 'いらっしゃいませー！ 新作、入ってますよ♪', 'ゆっくり見ていってね♪ 試着はタダだよ！'],
    pick: ['似合うじゃん！', '試着室へご案内ー♪', 'わぁ、かわいい！', 'それ、今いちばん人気だよ♪', 'その色、ぴったり！', 'ちょっと大人っぽいね♪', '迷ったら、ぜんぶ試着しちゃお！', 'もう一回タップで、お買い上げ〜♪', 'いいセンスしてる〜！', 'それ着て対局したら、勝てそう！'],
    have: ['それはもう持ってるよ！ クロークで着替えられるよ♪', 'お手持ちの服だね。合わせてみる？'],
    buy: ['お買い上げ、ありがとうございまーす♪', '大事に着てね！', 'まいどありっ♪ また来てね！'],
    poor: ['あと少し銭がたまったら、また来てね♪', '対局で勝つと銭がもらえるよ！']
  };
  function hinata(kind) {
    if (mode !== 'shop') return;
    $('#avClerkT').textContent = pick(SAY[kind]);
    const b = $('#avClerkB'); b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
  }

  /* ---------- 服ショップ・クローク ---------- */
  // m：'shop' 服ショップ / 'closet' クローク。back：もどる先（'hub' ルームのメニュー / 'shop' ショップ）
  function open(m, startSlot, back) {
    if (typeof m !== 'string' || (m !== 'shop' && m !== 'closet')) { startSlot = m; m = 'closet'; }
    mode = m; if (back) from = back;
    look = myLook(); slot = startSlot || (m === 'shop' ? 'outfit' : 'face');
    P.showScreen('avatar');
    render();
    if (m === 'shop') hinata((S.zeni || 0) < 300 ? 'poor' : 'hello');
  }
  function switchMode() {
    const go = () => { P.sound('stone'); open(mode === 'shop' ? 'closet' : 'shop', slot); };
    if (mode === 'closet' && changed()) P.confirmBox('着がえを保存せずに、服ショップへ行きますか？', go); else go();
  }
  $('#avSwitch').onclick = switchMode;
  function changed() { return JSON.stringify(AV.clean(look)) !== JSON.stringify(myLook()); }
  function unowned() { return AV.SLOTS.map(([sl]) => sl).filter(sl => !owned(sl, look[sl])); }
  // タブの中身：髪のタブは「髪型」と「髪の色」
  // 元の絵の服（色を買う）と、素材シートの服（形ごと買う）を分けて並べる
  const sections = tab => [[tab, '']];
  function render() {
    const shop = mode === 'shop';
    $('#avTitle').textContent = shop ? '服ショップ' : 'クローク';
    $('#avSwitch').textContent = shop ? 'クロークへ' : '服ショップへ';
    $('#avClerk').classList.toggle('closet', !shop);
    $('#avClerkB').hidden = !shop; $('#avClerkImg').hidden = !shop;
    $('#avBig').innerHTML = AV.svg(look, 'av-svg', true);
    $('#avZeni').textContent = zeniText();
    $('#avTabs').innerHTML = AV.TABS.map(([k, n]) => `<button type="button" data-slot="${k}" aria-pressed="${slot === k}">${n}</button>`).join('');
    let h = '';
    for (const [sl, title, only] of sections(slot)) {
      if (title) h += `<div class="av-sec">${title}</div>`;
      const list = AV.CATALOG[sl].filter(([id]) => (!only || only(id)) && (mode === 'shop' || owned(sl, id)));
      if (!list.length) { if (mode === 'closet' && title) h = h.replace(/<div class="av-sec">[^<]*<\/div>$/, ''); continue; }
      h += list.map(([id, name, price]) => {
        const have = owned(sl, id), wearing = look[sl] === id;
        const preview = Object.assign({}, look, { [sl]: id });
        return `<button type="button" class="av-item ${wearing ? 'on' : ''}" data-sl="${sl}" data-id="${id}">${AV.thumb(preview, slot)}<b>${name}</b>` +
          `<small class="${have ? 'own' : 'price'}">${have ? (wearing ? '着ている' : '持っている') : price.toLocaleString() + ' 銭'}</small></button>`;
      }).join('');
    }
    if (mode === 'closet') h += `<button type="button" class="av-goshop" data-goshop="1">ほかの${SLOT_NAME[slot] || ''}は、服ショップで買えます →</button>`;
    $('#avGrid2').innerHTML = h;
    const need = mode === 'shop' ? unowned() : [];
    renderTry(need);
    $('#avLead').textContent = shop ? 'タップで試着。もう一度タップするか、試着中リストから買えます。' : '持っている服で着がえます。えらんだら「この姿にする」。';
    $('.av-presets').hidden = shop; $('#avSave').hidden = shop; $('#avNote').hidden = shop;
    if (shop) return;
    $('#avSave').disabled = !changed() && !need.length;
    $('#avSave').textContent = need.length ? `試着中を買う（${need.reduce((a, sl) => a + entryOf(sl)[2], 0).toLocaleString()} 銭）` : 'この姿にする';
    $('#avNote').textContent = need.length ? '「試着」中です。銭で買うと、この姿にできます。' : changed() ? '' : 'いまの姿です。';
  }
  // 試着中リスト（まだ買っていないパーツ）：1つずつ買う・まとめて買う、合計の銭
  const SLOT_NAME = Object.fromEntries(AV.SLOTS);
  const entryOf = sl => AV.CATALOG[sl].find(x => x[0] === look[sl]);
  function renderTry(need) {
    const box = $('#avTry');
    $('#avLead').hidden = !!need.length; box.hidden = !need.length;
    if (!need.length) { box.innerHTML = ''; return; }
    const total = need.reduce((a, sl) => a + entryOf(sl)[2], 0), short = total > (S.zeni || 0);
    box.innerHTML = `<b class="av-try-h">試着中</b><ul>${need.map(sl => { const e = entryOf(sl); return `<li><span><small>${SLOT_NAME[sl]}</small>${e[1]}</span><em>${e[2].toLocaleString()}</em><button type="button" class="btn primary small" data-tbuy="${sl}" ${e[2] > (S.zeni || 0) ? 'disabled' : ''}>買う</button><button type="button" class="sc-x" data-tundo="${sl}" aria-label="試着をやめる">×</button></li>`; }).join('')}</ul>
      <div class="av-try-sum"><span>合計</span><b class="${short ? 'short' : ''}">${total.toLocaleString()} 銭</b></div>
      ${need.length > 1 ? `<button type="button" class="btn primary small" data-tall="1" ${short ? 'disabled' : ''}>まとめて買う（${total.toLocaleString()} 銭）</button>` : ''}
      ${short ? `<small class="av-try-short">あと ${(total - (S.zeni || 0)).toLocaleString()} 銭たりません</small>` : ''}`;
  }
  $('#avTry').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.tbuy) { askBuy(b.dataset.tbuy, look[b.dataset.tbuy]); return; }
    if (b.dataset.tundo) { const sl = b.dataset.tundo; look[sl] = myLook()[sl]; P.sound('tap'); render(); return; }
    if (b.dataset.tall) {
      const need = unowned(), total = need.reduce((a, sl) => a + entryOf(sl)[2], 0);
      P.confirmBox(`試着中の ${need.length} 点を、合計 ${total.toLocaleString()} 銭で買いますか？`, () => {
        const bought = [];
        const next = () => {
          const sl = unowned()[0];
          if (!sl) { P.sound('ok'); hinata('buy'); askWear(bought, 'まとめて買いました！'); return; }
          bought.push(sl);
          const id = look[sl];
          P.buy({ av: sl + ':' + id }, entryOf(sl)[2], res => { if (!res.ok) { P.toast(BUY_NG[res.reason] || '買えませんでした'); render(); return; } next(); });
        };
        next();
      });
    }
  });
  const BUY_NG = { zeni: '銭が足りません', offline: 'サーバーにつながっていないので、今は買えません', have: 'もう持っています' };
  // 1回目のタップは試着だけ。試着中のものをもう一度タップすると「買いますか？」
  function askBuy(sl, id) {
    const entry = AV.CATALOG[sl].find(x => x[0] === id); if (!entry) return;
    const price = entry[2];
    if ((S.zeni || 0) < price) { hinata('poor'); P.toast(`${entry[1]}は ${price} 銭です。銭が足りません`); return; }
    P.confirmBox(`${entry[1]}を ${price} 銭で買いますか？`, () => {
      P.buy({ av: sl + ':' + id }, price, res => {
        if (!res.ok) { P.toast(BUY_NG[res.reason] || '買えませんでした'); return; }
        P.sound('ok'); hinata('buy'); askWear([sl], `${entry[1]}を買いました！`);
      });
    });
  }
  // 買ったら「そのまま着替える？」。着替えないときは、買った服はクロークへ（試着は元にもどす）
  function askWear(slots, head) {
    render();
    P.confirmBox(`${head} そのまま着替えますか？`, () => {
      const l = Object.assign({}, myLook()); for (const sl of slots) l[sl] = look[sl];
      wear(l);
    }, () => {
      const cur = myLook(); for (const sl of slots) look[sl] = cur[sl];
      P.toast('買った服は、クロークに入れました'); render();
    }, { yes: '着替える', no: '着替えない' });
  }
  function wear(l) {
    l = AV.clean(l);
    const done = () => { S.av = l; P.saveLocal(); P.sound('ok'); P.toast('アバターを着がえました'); const keep = look; look = Object.assign({}, l); for (const sl of Object.keys(keep)) if (!owned(sl, keep[sl])) look[sl] = keep[sl]; render(); };
    if (!P.online()) { if (P.FR.available()) { P.toast('サーバーにつながっていません'); return; } done(); return; }
    P.soc('avatar', { look: l }, res => { if (res.ok) done(); else P.toast('保存できませんでした'); });
  }
  $('#avGrid2').addEventListener('click', e => {
    const b = e.target.closest('.av-item'); if (!b) return;
    const sl = b.dataset.sl, id = b.dataset.id, entry = AV.CATALOG[sl].find(x => x[0] === id);
    const again = look[sl] === id;
    look[sl] = id; P.sound('tap'); render();
    if (mode !== 'shop') return;
    if (owned(sl, id)) { hinata('have'); return; }
    if (again) askBuy(sl, id);
    else hinata('pick');
  });
  $('#avGrid2').addEventListener('click', e => { if (e.target.closest('[data-goshop]')) switchMode(); });
  $('#avClerkImg').onclick = () => hinata('pick');
  $('#avTabs').addEventListener('click', e => { const b = e.target.closest('[data-slot]'); if (b) { slot = b.dataset.slot; render(); } });
  document.querySelectorAll('.av-presets [data-preset]').forEach(b => b.onclick = () => {
    const p = AV.PRESETS[b.dataset.preset];
    look = Object.assign({}, look, { face: p.face, outfit: p.outfit });
    render();
  });
  $('#avSave').onclick = () => { if (unowned().length) return; wear(look); };
  const leave = () => { if (from === 'shop' && window.SHOP) window.SHOP.open(); else openHub(); };
  $('#avBack').onclick = () => {
    if (mode === 'closet' && changed()) P.confirmBox('着がえを保存せずにもどりますか？', leave);
    else leave();
  };

  // キャラクター画面は、えらぶ画面から開いて、えらぶ画面にもどる
  $('#charaBack').onclick = openHub;
  window.AVATAR_UI = { open, openHub };
})();
