/* 囲碁BLITZ — ショップ
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
  const K_HELLO = [
    'いらねえ物があるなら、置いていきな。値段の3分の1で引きとってやる。', 'ここは骨董屋だ。……古い物にも、まだ使い道はある。',
    '物を手放すのも、碁の捨て石と同じだ。', 'ふぁ……。客か。ゆっくり見ていきな。'
  ];
  const K_SOLD = ['毎度。……大事にしてやるよ。', 'いい品だ。店の奥に置いとこう。', 'ほらよ、銭だ。無駄づかいすんなよ。', '……こいつも、次の持ち主を待つさ。'];
  const K_NG = { placed: 'そいつは部屋に置いてあるだろ。片づけてから持ってきな。', wear: '着てる服は買いとれねえよ。着がえてから来な。', offline: 'すまねえ、今は店を開けられねえ。（サーバーにつながっていません）', item: 'そいつは買いとれねえな。' };
  const GIFT_LINE = '店の奥にしまってあったんだが…誰も貰っちゃくれねえから、こいつが寂しがっているように見えてな。お前さん、貰っちゃくれねえかい？';
  function bubble(id, textId, t) { $(textId).textContent = t; const b = $(id); b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); }
  function open() {
    $('#shopZeni').textContent = `${(S.zeni || 0).toLocaleString()} 銭`;
    P.showScreen('shop');
    bubble('#shopBubbleH', '#shopTalkH', (S.zeni || 0) < 300 ? '銭が少なくても、見るだけでも楽しいよ♪' : pick(H_HELLO));
    bubble('#shopBubbleS', '#shopTalkS', pick(S_HELLO));
    bubble('#shopBubbleK', '#shopTalkK', pick(K_HELLO));
  }
  /* ---------- 骨董屋（店主：玄斎） ---------- */
  let ktTab = 'item';
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const R = () => window.ROOMART, AV = () => window.AVATAR;
  function avEntry(key) { const [sl, id] = key.split(':'), e = (AV().CATALOG[sl] || []).find(x => x[0] === id); return e ? { sl, id, name: e[1], price: e[2] } : null; }
  function placedCount(k) {
    const r = S.room || {}; let n = 0;
    for (const rm of [r].concat(r.extra || [])) for (const it of (rm.items || []).concat(rm.walls || [])) if (it.k === k && !it.trial) n++;
    return n;
  }
  // 売れる家具：持っている数 − 部屋に置いている数
  function sellItems() {
    const own = (S.room && S.room.ownedItems) || {}, out = [];
    for (const [k, n] of Object.entries(own)) { const c = R().BY_ID[k]; if (!c || !(c.price > 0)) continue; const free = n - placedCount(k); if (free > 0) out.push({ k, c, free, placed: n - free }); }
    return out.sort((a, b) => b.c.price - a.c.price);
  }
  function sellAvs() {
    const wear = AV().clean(S.av || {});
    return (S.avOwned || []).map(avEntry).filter(e => e && e.price > 0 && wear[e.sl] !== e.id).sort((a, b) => b.price - a.price);
  }
  function giftThumb(o) {
    if (o.kind === 'av') { const e = avEntry(o.id); return e ? { thumb: AV().thumb({ [e.sl]: e.id }, e.sl), name: e.name } : null; }
    const c = R().BY_ID[o.id]; return c ? { thumb: window.ROOM.thumb(o.id), name: c.name } : null;
  }
  function kTalk(t) { $('#kottoTalk').textContent = t; const b = $('.kt-say'); b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); }
  function renderKotto() {
    $('#kottoZeni').textContent = `${(S.zeni || 0).toLocaleString()} 銭`;
    $('#kottoTabs').innerHTML = [['item', '家具'], ['av', 'アバターの服など']].map(([k, n]) => `<button type="button" data-kt="${k}" aria-pressed="${ktTab === k}">${n}</button>`).join('');
    let g = '';
    if (ktTab === 'item') {
      const list = sellItems();
      g = list.length ? list.map(x => `<button type="button" class="rm-card kt-card" data-sell-item="${x.k}">${window.ROOM.thumb(x.k)}<b>${esc(x.c.name)}</b><small>${x.free}こ売れる${x.placed ? `（置いてる ${x.placed}）` : ''}</small><span class="kt-price">買取 ${Math.floor(x.c.price / 3).toLocaleString()} 銭</span></button>`).join('')
        : '<p class="kt-empty">売れる家具がありません。部屋に置いていない家具が、ここに並びます。</p>';
    } else {
      const list = sellAvs();
      g = list.length ? list.map(e => `<button type="button" class="rm-card kt-card" data-sell-av="${e.sl}:${e.id}"><div class="kt-av">${AV().thumb({ [e.sl]: e.id }, e.sl)}</div><b>${esc(e.name)}</b><span class="kt-price">買取 ${Math.floor(e.price / 3).toLocaleString()} 銭</span></button>`).join('')
        : '<p class="kt-empty">売れる服がありません。着ていない服・道具・ペット・背景が、ここに並びます。</p>';
    }
    $('#kottoGrid').innerHTML = g;
  }
  function openKotto() { ktTab = 'item'; P.showScreen('kotto'); kTalk(pick(K_HELLO)); renderKotto(); }
  function sell(what, name, price) {
    const got = Math.floor(price / 3);
    P.confirmBox(`${name}を、${got.toLocaleString()} 銭で売りますか？`, () => {
      P.sell(what, res => {
        if (!res.ok) { kTalk(K_NG[res.reason] || K_NG.item); P.sound('bad'); renderKotto(); return; }
        P.sound('coin'); kTalk(pick(K_SOLD)); P.toast(`＋${(res.got | 0).toLocaleString()} 銭`); renderKotto();
        const g = res.offer && giftThumb(res.offer);
        if (!g) return;
        setTimeout(() => window.FANFARE.clerk({
          who: 'gensai', line: GIFT_LINE, item: g, labels: { yes: 'はい', no: 'いいえ' },
          yes: () => P.offer(true, r2 => {
            renderKotto();
            if (r2 && r2.ok === false) { P.toast('受けとれませんでした'); return; }
            window.FANFARE.celebrate({ items: [g], title: '玄斎からのおくりもの！', then: () => { kTalk('……ありがとよ。そいつも喜んでるさ。'); P.toast(res.offer.kind === 'av' ? 'クロークに入れました' : '倉庫に入れました'); } });
          }),
          no: () => P.offer(false, () => { kTalk('……そうかい。なら、こいつは処分しとくよ。'); renderKotto(); })
        }), 500);
      });
    }, null, { yes: '売る', no: 'やめる' });
  }
  $('#kottoTabs').addEventListener('click', e => { const b = e.target.closest('[data-kt]'); if (!b) return; ktTab = b.dataset.kt; P.sound('tap'); renderKotto(); });
  $('#kottoGrid').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.sellItem) { const c = R().BY_ID[b.dataset.sellItem]; sell({ item: c.id }, c.name, c.price); }
    else if (b.dataset.sellAv) { const x = avEntry(b.dataset.sellAv); sell({ av: b.dataset.sellAv }, x.name, x.price); }
  });
  $('#kottoFace').onclick = () => kTalk(pick(K_HELLO));
  $('#kottoBack').onclick = () => { P.sound('tap'); open(); };
  $('#shopKotto').onclick = () => { bubble('#shopBubbleK', '#shopTalkK', '……こっちだ。奥へ入んな。'); P.sound('stone'); setTimeout(openKotto, 450); };
  $('#openShop').onclick = () => { P.sound('stone'); open(); };
  $('#shopBack').onclick = () => { P.renderHome(); P.showScreen('home'); };
  $('#shopAvatar').onclick = () => { bubble('#shopBubbleH', '#shopTalkH', pick(H_GO)); P.sound('stone'); setTimeout(() => window.AVATAR_UI.open('shop', 'body', 'shop'), 450); };
  $('#shopRoom').onclick = () => { bubble('#shopBubbleS', '#shopTalkS', pick(S_GO)); P.sound('stone'); setTimeout(() => window.ROOM.open('shop', 'shop'), 450); };
  $('#pvpShop').onclick = () => { P.sound('stone'); open(); };
  window.SHOP = { open, openKotto, renderKotto };
})();
