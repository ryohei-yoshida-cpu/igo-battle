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
    $('#shopZeni').innerHTML = `${(S.zeni || 0).toLocaleString()} 銭<i class="chip-tama">勾玉 ${(S.tama | 0).toLocaleString()}</i>`;
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
    $('#kottoZeni').innerHTML = `${(S.zeni || 0).toLocaleString()} 銭<i class="chip-tama">勾玉 ${(S.tama | 0).toLocaleString()}</i>`;
    $('#kottoTabs').innerHTML = [['item', '家具'], ['av', '服など'], ['tama', '勾玉']].map(([k, n]) => `<button type="button" data-kt="${k}" aria-pressed="${ktTab === k}">${n}</button>`).join('');
    let g = '';
    $('.kt-note').hidden = ktTab === 'tama';
    if (ktTab === 'tama') g = tamaHtml();
    else if (ktTab === 'item') {
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
  /* ---------- 勾玉（課金石）：買う（準備中）・銭と交換（一方通行）・キャラ開放・勾玉限定の台詞 ---------- */
  const MAGATAMA = '<svg class="tm-gem" viewBox="0 0 40 48" aria-hidden="true"><defs><radialGradient id="tmg" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#d8fff0"/><stop offset=".45" stop-color="#3cc49a"/><stop offset="1" stop-color="#0d6b56"/></radialGradient></defs><path d="M22 4c9 0 15 7 15 15 0 13-12 24-28 26 8-5 11-10 10-14C9 30 5 25 5 19 5 10 12 4 22 4z" fill="url(#tmg)" stroke="#0a4d3e" stroke-width="1.5"/><circle cx="21" cy="17" r="5" fill="#0a4d3e" opacity=".85"/><ellipse cx="15" cy="12" rx="4" ry="2.5" fill="#fff" opacity=".55" transform="rotate(-30 15 12)"/></svg>';
  const TAMA_PACKS = [[60, 120], [300, 600], [980, 1800], [2000, 3600]];   // [勾玉, 円]（お金とつなぐのは、あとで）
  function tamaHtml() {
    const have = S.tama | 0, rate = P.TAMA_ZENI;
    const locked = window.ART.VARIANTS.map((v, i) => ({ v, i })).filter(({ i }) => !P.charaOpen(i));
    return `<div class="tm-box tm-have">${MAGATAMA}<div><small>持っている勾玉</small><b>${have.toLocaleString()}</b></div></div>
      <div class="tm-box"><h4>勾玉を買う</h4><div class="tm-packs">${TAMA_PACKS.map(([n, yen]) => `<button type="button" class="tm-pack" disabled><b>勾玉 ${n}</b><small>${yen.toLocaleString()} 円</small></button>`).join('')}</div><p class="tm-note">ただいま準備中です。もうしばらくお待ちください。<br>勾玉は、このアプリ（囲碁BLITZ）の中だけで使えます。</p></div>
      <div class="tm-box"><h4>銭と交換する<small>勾玉1つ → ${rate}銭（銭から勾玉にはもどせません）</small></h4><div class="tm-packs">${[10, 50, 100, have].filter((n, i, a) => n > 0 && a.indexOf(n) === i).map((n, i, a) => `<button type="button" class="tm-pack" data-swap="${n}" ${have < n ? 'disabled' : ''}><b>${n === have && i === a.length - 1 && ![10, 50, 100].includes(n) ? 'ぜんぶ ' : ''}勾玉 ${n}</b><small>→ ${(n * rate).toLocaleString()} 銭</small></button>`).join('')}</div></div>
      <div class="tm-box"><h4>キャラクターを先に開く<small>1人 勾玉 ${P.TAMA_CHARA}</small></h4>${locked.length ? `<div class="tm-charas">${locked.map(({ v, i }) => `<button type="button" class="tm-chara" data-chara="${v.key}" ${have < P.TAMA_CHARA ? 'disabled' : ''}><img src="${window.ART.charaUri(i)}" alt=""><b>${esc(v.name)}</b><small>${P.RANKS[P.UNLOCK[v.key] || 0]}で開く</small></button>`).join('')}</div>` : '<p class="tm-note">もう全員のキャラクターと会えています。</p>'}</div>
      <div class="tm-box"><h4>勾玉限定のアイテム</h4><p class="tm-note">対局で言える「台詞」に、勾玉でしか買えないものがあります。</p><button type="button" class="btn lac small" data-tmshop="1">服ショップの「台詞」を見る →</button></div>`;
  }
  const TAMA_NG = { tama: '勾玉が足りねえな。', have: 'そいつはもう開いてるぜ。', offline: K_NG.offline };
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
    if (b.dataset.swap) {
      const n = +b.dataset.swap;
      P.confirmBox(`勾玉 ${n} を ${(n * P.TAMA_ZENI).toLocaleString()} 銭と交換しますか？（銭から勾玉にはもどせません）`, () => P.tama('swap', { n }, res => {
        if (!res.ok) { kTalk(TAMA_NG[res.reason] || 'できなかったな。'); return; }
        P.sound('coin'); kTalk('ほらよ。いい色の勾玉だった。'); P.toast(`＋${(n * P.TAMA_ZENI).toLocaleString()} 銭`); renderKotto();
      }), null, { yes: '交換する', no: 'やめる' });
      return;
    }
    if (b.dataset.chara) {
      const v = window.ART.VARIANTS.find(x => x.key === b.dataset.chara);
      P.confirmBox(`勾玉 ${P.TAMA_CHARA} で「${v.name}」を開きますか？`, () => P.tama('chara', { key: v.key }, res => {
        if (!res.ok) { kTalk(TAMA_NG[res.reason] || 'できなかったな。'); return; }
        kTalk(`${v.name}に話はつけといた。……大事にしろよ。`); renderKotto();
        window.FANFARE.celebrate({ items: [{ thumb: `<img src="${window.ART.charaUri(window.ART.VARIANTS.indexOf(v))}" alt="">`, name: v.name }], title: 'キャラクターが仲間になりました！' });
      }), null, { yes: '開く', no: 'やめる' });
      return;
    }
    if (b.dataset.tmshop) { P.sound('stone'); window.AVATAR_UI.open('shop', 'line', 'shop'); return; }
    if (b.dataset.sellItem) { const c = R().BY_ID[b.dataset.sellItem]; sell({ item: c.id }, c.name, c.price); }
    else if (b.dataset.sellAv) { const x = avEntry(b.dataset.sellAv); sell({ av: b.dataset.sellAv }, x.name, x.price); }
  });
  $('#kottoFace').onclick = () => kTalk(pick(K_HELLO));
  $('#kottoBack').onclick = () => { P.sound('tap'); open(); };
  /* ---------- お店に入る演出：障子が開いて、店員さんが奥からズームアップ →「いらっしゃいませ」→ 光でいっぱい → お店へ ---------- */
  const WELCOME = {
    hinata: ['いらっしゃいませー♪ 今日はどれにする？', 'いらっしゃいませっ！ 新作、入ってるよ♪'],
    shima: ['……いらっしゃい。ゆっくり見ていけ。', '……来たか。いらっしゃい。'],
    gensai: ['いらっしゃい。……何か売りに来たのかい？', 'おう、いらっしゃい。掘り出し物があるかもしれねえぜ。']
  };
  const SHOJI = '<div class="sj-lat"></div>';
  function enterShop(who, then) {
    if (S.settings.shopFx === false || matchMedia('(prefers-reduced-motion: reduce)').matches) { P.sound('stone'); setTimeout(then, 200); return; }
    const el = document.createElement('div'); el.className = 'sj ' + who;
    el.innerHTML = `<div class="sj-room"><img class="sj-clerk" src="img/bust_${who}.webp" alt=""><div class="sj-say"><b>${{ hinata: 'ひなた', shima: '静馬', gensai: '玄斎' }[who]}</b><span></span></div></div>
      <div class="sj-door l">${SHOJI}</div><div class="sj-door r">${SHOJI}</div><div class="sj-flash"></div><div class="sj-skip">タップでスキップ</div>`;
    document.body.append(el);
    const T = [];
    const at = (ms, f) => T.push(setTimeout(f, ms));
    let done = false;
    const flash = () => {
      if (done) return; done = true; T.forEach(clearTimeout);
      el.classList.add('flash'); P.sound('chord');
      setTimeout(() => { then(); el.classList.add('fade'); }, 700);
      setTimeout(() => el.remove(), 1600);
    };
    P.sound('stone');
    at(80, () => el.classList.add('on'));
    at(650, () => { el.classList.add('open'); P.sound('n784'); });
    at(1300, () => el.classList.add('zoom'));
    at(2300, () => { el.querySelector('.sj-say span').textContent = pick(WELCOME[who]); el.classList.add('say'); P.sound('coin'); });
    at(4600, flash);
    el.addEventListener('click', flash);
  }
  $('#shopKotto').onclick = () => { bubble('#shopBubbleK', '#shopTalkK', '……こっちだ。奥へ入んな。'); enterShop('gensai', openKotto); };
  $('#openShop').onclick = () => { P.sound('stone'); open(); };
  $('#shopBack').onclick = () => { P.renderHome(); P.showScreen('home'); };
  $('#shopAvatar').onclick = () => { bubble('#shopBubbleH', '#shopTalkH', pick(H_GO)); enterShop('hinata', () => window.AVATAR_UI.open('shop', 'body', 'shop')); };
  $('#shopRoom').onclick = () => { bubble('#shopBubbleS', '#shopTalkS', pick(S_GO)); enterShop('shima', () => window.ROOM.open('shop', 'shop')); };
  $('#pvpShop').onclick = () => { P.sound('stone'); open(); };
  window.SHOP = { open, openKotto, renderKotto };
})();
