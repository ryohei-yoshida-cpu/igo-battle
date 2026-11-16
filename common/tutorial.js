/* 囲碁BLITZ — 小春のチュートリアル
 *   場所が開くたびに、その場所の分だけ自動で案内する（はじめ／対人戦／戦歴／ルーム／マイルーム／骨董屋）。
 *   設定の「チュートリアルを受ける」で、開いている場所をぜんぶもう一度。
 *   小春が画面の3分の1くらいの大きさで、説明する場所をよけて立つ（歩くようにフェードで移動・向きも変える）。
 *   どこをタップしても次へ。「スキップ」でいつでも終われる。
 *
 * guide({ who, steps, then, later }) … 特別ミッションの「やってみよう」案内（小春・ひなた・静馬が案内する）
 *   steps：{ go, at, say, until, skip }
 *     until があるステップは、光っている場所だけさわれる（ほかは押せない）。until() が true になったら自動で次へ
 *     確認・お礼などの画面が出ているあいだは、案内は引っこんでじゃましない
 *     skip() が true のステップはとばす
 *   「あとで」で中断できる（later()）。ホームの特別ミッションから、また最初から案内する
 */
(function () {
  'use strict';
  const P = window.APP, S = P.S;
  const $ = window.U.$;

  // 1歩ずつ：go（画面を開く）、at（光らせる場所）、say（小春のセリフ）
  const home = () => { for (const id of ['result', 'settings']) { const e = $('#' + id); if (e) e.hidden = true; } P.showScreen('home'); P.renderHome(); };
  // 開いた場所ごとに区切る。sec の場所が開いたら、その区切りだけ案内する
  const SECS = {
    base: [
      { go: home, say: 'ここが囲碁BLITZのホーム画面です。少しだけ、案内させてくださいね！' },
      { go: home, at: '#openSolo', say: 'こちらは「ソロモード」。私たちの物語を読みながら、囲碁を覚えられます。' },
      { go: () => window.SOLO.open(), at: '#storyList', say: '物語の続きは、ミッションをクリアすると読めます。……ちょっと恥ずかしい話もあるかも。えへへ。' },
      { go: home, at: '#startMatch', say: 'ほかの場所は、まだカギがかかっています。物語を読んだり、対局を重ねたりすると、どんどん開いていきますよ！' }
    ],
    pvp: [
      { go: home, at: '#startMatch', say: 'ここが「対人戦」。全国のみんなと、真剣勝負ができるんです。ドキドキしますね！' },
      { go: () => $('#startMatch').click(), at: '#goRandom', say: '「ランダムマッチ」なら、同じくらいの強さの人と打てます。勝てばレートが上がりますよ！' },
      { at: '#goFriend', say: '「フレンドマッチ」は、合言葉で友だちと一局。おしゃべりしながら打つのも楽しいです♪' },
      { at: '.bot-row', say: 'すぐ打ちたいときは「キャラクターと対局」。強さを「入門」にすると、私とアタリ碁が打てますよ！' }
    ],
    rec: [
      { go: home, at: '#openRecord', say: '「戦歴」では、あなたの成績や、打った碁をふり返れます。巴ちゃん、ああ見えてとっても努力家なんですよ。' },
      { go: () => $('#startMatch').click(), at: '#openReview', say: '「検討」は対人戦の画面にあります。打った碁をAIと一緒に見直せます。負けた碁ほど、宝物なんです！' }
    ],
    av: [
      { go: home, at: '#openHub', say: '「ルーム」には、あなたのアバターがいます。行ってみましょう！' },
      { go: () => window.AVATAR_UI.openHub(), at: '#openAvShop', say: 'ここでアバターの服を買えるんです。ひなたちゃんのお店、かわいい服がいっぱいですよ♪' },
      { at: '#openAvatar', say: 'こっちは「クローク」。買った服に着がえられます。' },
      { go: () => window.AVATAR_UI.open('closet', null, 'hub'), at: '#avBig', say: 'ここで着がえられるよ！ あなたに似合う服、私も見てみたいです！' },
      { go: home, at: '#openShop', say: 'ホームの「ショップ」からも、ひなたちゃんのお店に行けますよ。' }
    ],
    room: [
      { go: () => window.ROOM.open(), say: 'ここが、あなたのマイルーム！ 好きなものをかざって、自分だけのお部屋にしてくださいね。' },
      { at: '#roomDock [data-dock="social"]', say: '「交流」では、フレンドや、遊びに来てくれた人とお話しできます。' },
      { at: '#roomDock [data-dock="chara"]', say: '「キャラ」から、私たちをお部屋に呼べます。……呼んでくれたら、すぐ行きますね！' },
      { at: '#roomDock [data-dock="shop"]', say: '家具は「ショップ」で。静馬さんのお店です。無口だけど、とってもやさしい人ですよ。' },
      { at: '#roomDock [data-dock="edit"]', say: '「もようがえ」で、家具を好きな場所に並べられます。お部屋づくり、楽しみです！' },
      { go: () => { window.AVATAR_UI.openHub(); $('#openChara').click(); }, at: '#avGrid', say: 'ここは「キャラクター」。段級位が上がると、仲間がどんどん増えていきます。早くみんなに会いたいな！' },
      { go: () => window.FRIENDS.explore(), at: '#exList', say: '「ルーム探訪」では、ほかの人のお部屋をのぞけます。すてきなお部屋、たくさんありますよ！' },
      { go: () => window.FRIENDS.open(), at: '.frs-me', say: 'これがあなたの部屋番号。友だちに教えて、フレンドになってくださいね。' },
      { go: () => $('#openDiary').click(), at: '#dyWrite', say: 'ここで日記をつけられるよ。あなたの日記、楽しみです！' }
    ],
    kotto: [
      { go: () => window.SHOP.open(), at: '#shopKotto', say: 'ショップの奥に「骨董屋」ができました！ 師匠のお店です。' },
      { at: '#shopKotto', say: 'いらなくなった服や家具を引きとってくれたり、めずらしい掘り出し物があったり……のぞいてみてくださいね！' }
    ],
    gk: [
      { go: home, at: '#openGuild', say: '「碁会所」が開きました！ 仲間と集まって打つ場所です。自分でつくることも、ほかの碁会所に入ることもできますよ。' },
      { go: () => window.GUILD.open('home', 'home'), at: '#gkBody', say: '碁会所の仲間には、1日5人まで50銭をおくれます。みんなで対局するとミッションの銭も受け取れるんです！' },
      { go: () => $('#startMatch').click(), at: '#goGuild', say: '対人戦の画面の「碁会所内マッチ」で、仲間と打てます。ハンデをつけて呼ぶこともできますよ。' },
      { go: home, at: '#tkLine', say: 'それから、いちばん上の一行をタップすると、碁会所のみんなに一言を送れます。おしゃべりも楽しいですよ♪' }
    ]
  };
  const ORDER = ['base', 'pvp', 'rec', 'av', 'room', 'kotto', 'gk'];
  const END = { go: home, say: 'これで案内はおしまいです！ 最後まで聞いてくれて、ありがとうございました。これから、よろしくお願いしますね！', last: true };
  const PART_END = { go: home, say: 'ここの案内はおしまいです。また新しい場所が開いたら、案内しますね！', last: true };
  let STEPS = [], cur = null, onEnd = null;   // cur：いま案内している区切り（全部なら 'all'）
  let GD = null;   // guide() のとき：{ who, later, poll, lost }
  const WHO = { koharu: '小春', hinata: 'ひなた', shima: '静馬', tomoe: '巴', gensai: '玄斎' };
  function build(sec) {
    if (sec === 'all') {
      const open = ORDER.filter(k => k === 'base' || !window.PROG || window.PROG.isOpen(k));
      return [{ go: home, say: 'これから、囲碁BLITZの中を案内しますね。ついてきてください！' }].concat(...open.map(k => SECS[k].filter((st, j) => !(k === 'base' && (j === 0 || j === 3))))).concat([END]);
    }
    const last = sec === ORDER.filter(k => k !== 'base').slice(-1)[0] ? END : PART_END;
    return SECS[sec].concat([last]);
  }

  let el = null, i = -1, typing = 0, full = '', busy = false, pos = null;
  function buildEl(who) {
    who = WHO[who] ? who : 'koharu';
    el = document.createElement('div'); el.className = 'tut';
    el.innerHTML = `<div class="tut-hole" hidden></div>${GD ? '<i class="tut-block"></i><i class="tut-block"></i><i class="tut-block"></i><i class="tut-block"></i>' : ''}
      <div class="tut-k"><img src="img/visit_${who}.webp" alt="${WHO[who]}"></div>
      <div class="tut-say"><b>${WHO[who]}</b><p></p><small class="tut-next">タップで次へ ▶</small></div>
      <div class="tut-top"><span class="tut-n"></span><button type="button" class="tut-skip">${GD ? 'あとで' : 'スキップ'}</button></div>`;
    document.body.append(el);
    el.addEventListener('click', e => {
      if (e.target.closest('.tut-skip')) { e.stopPropagation(); skip(); return; }
      next();
    });
  }
  function rectOf(sel) {
    const t = sel && document.querySelector(sel);
    if (!t || !t.offsetParent) return null;
    const r = t.getBoundingClientRect();
    return r.width && r.height ? r : null;
  }
  // 小春の立つ場所：光らせる場所と重ならない側（左右・上下）。向きは、光らせる場所のほうを見る
  function place(r) {
    const W = window.innerWidth, H = window.innerHeight;
    const kh = Math.min(H * 0.36, 340), kw = kh * 0.545;
    let side = 'right', vert = 'bottom';
    if (r) {
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      side = cx > W / 2 ? 'left' : 'right';
      vert = cy > H * 0.55 ? 'top' : 'bottom';
      if (r.width > W * 0.7) side = Math.random() < 0.5 ? 'left' : 'right';   // 横いっぱいの場所なら、どちらでも
    }
    const x = side === 'left' ? 4 : W - kw - 4;
    const y = vert === 'bottom' ? H - kh - Math.max(8, H * 0.02) : Math.max(54, H * 0.07);
    return { x, y, kw, kh, side, vert, flip: side === 'left' };   // 元の絵は左向き。広いほう（画面のまん中のほう）を向く
  }
  function moveTo(p) {
    if (!el) return Promise.resolve();
    const k = el.querySelector('.tut-k'), say = el.querySelector('.tut-say');
    const apply = () => {
      k.style.left = p.x + 'px'; k.style.top = p.y + 'px'; k.style.width = p.kw + 'px'; k.style.height = p.kh + 'px';
      k.classList.toggle('flip', p.flip);
      // 吹き出し：小春の上（下にいるとき）か下（上にいるとき）。画面からはみ出さないように
      const W = window.innerWidth, bw = Math.min(W - 24, 360);
      say.style.width = bw + 'px';
      say.style.left = Math.max(12, Math.min(W - bw - 12, p.side === 'left' ? p.x + 8 : p.x + p.kw - bw - 8)) + 'px';
      if (p.vert === 'bottom') { say.style.top = ''; say.style.bottom = (window.innerHeight - p.y - 6) + 'px'; }
      else { say.style.bottom = ''; say.style.top = (p.y + p.kh - 10) + 'px'; }
      say.dataset.tail = p.side;
    };
    const same = pos && Math.abs(pos.x - p.x) < 4 && Math.abs(pos.y - p.y) < 4;
    if (!pos || same) { apply(); k.classList.toggle('flip', p.flip); pos = p; k.classList.add('in'); return Promise.resolve(); }
    // 歩くように：ぴょこぴょこしながら、うすくなって移動して、また出てくる
    return new Promise(res => {
      const dir = p.x > pos.x ? 1 : -1;
      k.classList.add('walk'); k.style.setProperty('--dx', (dir * 40) + 'px');
      k.classList.remove('in'); say.classList.remove('in');
      setTimeout(() => {
        if (!el) { res(); return; }
        apply(); k.style.setProperty('--dx', (-dir * 40) + 'px');
        void k.offsetWidth;
        k.classList.add('in');
        setTimeout(() => { k.classList.remove('walk'); res(); }, 650);
      }, 520);
      pos = p;
    });
  }
  function hole(r) {
    const h = el.querySelector('.tut-hole');
    if (!r) { h.hidden = true; el.classList.add('dim'); return; }
    el.classList.remove('dim');
    const pad = 6;
    Object.assign(h.style, { left: (r.left - pad) + 'px', top: (r.top - pad) + 'px', width: (r.width + pad * 2) + 'px', height: (r.height + pad * 2) + 'px' });
    h.hidden = false; h.classList.remove('pulse'); void h.offsetWidth; h.classList.add('pulse');
  }
  function speak(text) {
    const p = el.querySelector('.tut-say p'), say = el.querySelector('.tut-say');
    clearInterval(typing); full = text; let n = 0; p.textContent = '';
    say.classList.add('in');
    typing = setInterval(() => { n++; p.textContent = full.slice(0, n); if (n >= full.length) clearInterval(typing); }, 38);
  }
  async function show(n) {
    busy = true;
    if (!GD) { S.tutStep = n; S.tutSec = cur; P.saveLocal(); }   // 途中で落ちても、ここから再開できるように
    const st = STEPS[n];
    if (GD && st.skip && st.skip()) { busy = false; i = n; nextStep(); return; }
    el.classList.toggle('live', !!st.until);
    el.classList.toggle('light', !!st.light);   // 試着・試し置き：まわりを暗くしすぎない（着た姿・部屋が見えるように）
    el.querySelector('.tut-next').textContent = st.until ? 'やってみてね' : 'タップで次へ ▶';
        el.querySelector('.tut-n').textContent = `${n + 1} / ${STEPS.length}`;
    el.querySelector('.tut-say').classList.remove('in');
    el.querySelector('.tut-hole').hidden = true;
    if (st.go) { try { st.go(); } catch (e) {} await wait(500); }
    if (!el) return;
    const t = st.at && document.querySelector(st.at);
    if (t) { t.scrollIntoView({ block: 'center', behavior: 'auto' }); await wait(200); }
    if (!el) return;
    const r = rectOf(st.at);
    hole(r);
    await moveTo(place(r));
    if (!el) return;
    speak(st.say);
    if (n > 0) P.sound('tap');
    if (st.until) block(r);
    busy = false;
  }
  // 「やってみよう」：光っている場所のまわりを、4つの板でふさぐ（光っている場所だけ押せる）
  function block(r) {
    const bs = el.querySelectorAll('.tut-block'); if (!bs.length) return;
    const W = window.innerWidth, H = window.innerHeight, pad = 6;
    if (!r) { Object.assign(bs[0].style, { left: 0, top: 0, width: W + 'px', height: H + 'px' }); for (const b of [bs[1], bs[2], bs[3]]) b.style.width = '0'; return; }
    const L = Math.max(0, r.left - pad), T = Math.max(0, r.top - pad), R = Math.min(W, r.right + pad), Bt = Math.min(H, r.bottom + pad);
    Object.assign(bs[0].style, { left: 0, top: 0, width: W + 'px', height: T + 'px' });
    Object.assign(bs[1].style, { left: 0, top: Bt + 'px', width: W + 'px', height: (H - Bt) + 'px' });
    Object.assign(bs[2].style, { left: 0, top: T + 'px', width: L + 'px', height: (Bt - T) + 'px' });
    Object.assign(bs[3].style, { left: R + 'px', top: T + 'px', width: (W - R) + 'px', height: (Bt - T) + 'px' });
  }
  // ほかの画面（確認・お礼・お店の登場など）が上に出ているか
  const modalOpen = () => !!document.querySelector('#confirm:not([hidden]), .sj, .ff, #fxStamp:not([hidden]), #giftBox:not([hidden])');
  // 「やってみよう」のステップを見張る：できたら次へ。光らせる場所が動いたら追いかける
  function watch() {
    if (!el || !GD || busy || i < 0) return;
    const st = STEPS[i], m = modalOpen();
    el.classList.toggle('away', m);   // ほかの画面が出ているあいだは引っこむ（セリフだけのステップでも）
    if (!st || !st.until) return;
    if (st.until()) { nextStep(); return; }
    if (m) return;
    const r = rectOf(st.at);
    if (r) { GD.lost = 0; hole(r); block(r); }
    else if (++GD.lost > 8 && st.go) { GD.lost = 0; try { st.go(); } catch (e) {} }   // 場所が見つからない（別の画面に行った）：もう一度案内する
  }
  function nextStep() {
    i++;
    if (i >= STEPS.length) { finish(true); return; }
    show(i);
  }
  const wait = ms => new Promise(r => setTimeout(r, ms));
  function next() {
    if (busy || !el) return;
    if (GD && STEPS[i] && STEPS[i].until) return;   // 「やってみよう」は、できるまで進まない
    const p = el.querySelector('.tut-say p');
    if (p.textContent.length < full.length) { clearInterval(typing); p.textContent = full; return; }   // まず全部表示
    if (STEPS[i] && STEPS[i].last) { finish(true); return; }
    i++;
    if (i >= STEPS.length) { finish(true); return; }
    show(i);
  }
  function close() {
    clearInterval(typing);
    if (GD) { clearInterval(GD.poll); } else { delete S.tutStep; delete S.tutSec; P.saveLocal(); }
    if (!el) return;
    el.classList.add('out'); document.body.classList.remove('tut-on');
    const e = el; el = null; pos = null;
    setTimeout(() => e.remove(), 500);
  }
  function markDone() {
    S.tutDone = S.tutDone || {};
    if (cur === 'all') ORDER.forEach(k => { if (k === 'base' || !window.PROG || window.PROG.isOpen(k)) S.tutDone[k] = 1; });
    else if (cur) S.tutDone[cur] = 1;
  }
  function end() { const f = onEnd; onEnd = null; if (f) setTimeout(f, 400); }
  function skip() {
    if (GD) {
      P.confirmBox('案内をいったん終わりますか？（ホームの「特別ミッション」から、また案内します）', () => { const f = GD.later; close(); GD = null; onEnd = null; if (f) setTimeout(f, 300); }, null, { yes: 'あとで', no: 'つづける' });
      return;
    }
    P.confirmBox('案内をスキップしますか？（設定の「チュートリアルを受ける」で、いつでももう一度見られます）', () => {
      markDone(); if (!S.tut) S.tut = 'skip'; P.save(); close(); home(); end();
    }, null, { yes: 'スキップ', no: 'つづける' });
  }
  function finish() {
    if (GD) { close(); GD = null; end(); return; }
    markDone(); if (cur === 'all' || cur === 'kotto') S.tut = 'done';
    P.save(); close(); home();
    P.toast('案内はおしまいです。おつかれさまでした！');
    end();
  }
  function open(sec, n, then, who) {
    if (el) { if (then) then(); return; }
    if (sec !== 'guide') { cur = sec; STEPS = build(sec); }
    onEnd = then || null;
    buildEl(who); i = Math.max(-1, Math.min(STEPS.length - 1, (n | 0) - 1)); full = ''; busy = false; document.body.classList.add('tut-on');
    requestAnimationFrame(() => el.classList.add('on'));
    setTimeout(next, 300);
  }
  // 設定から：開いている場所を、ぜんぶ案内
  function start() { open('all', 0); }
  // 場所が開いたとき：その区切りだけ（もう見ていたら、何もしない）
  function run(sec, then) {
    if (!SECS[sec] || (S.tutDone && S.tutDone[sec])) { if (then) then(); return; }
    open(sec, 0, then);
  }
  window.addEventListener('resize', () => { if (el && i >= 0 && !busy) { const r = rectOf(STEPS[i].at); hole(r); const p = place(r); pos = null; moveTo(p); } });
  // 途中から再開（アプリを開き直したとき）
  function resume(n, then) { open(S.tutSec && (S.tutSec === 'all' || SECS[S.tutSec]) ? S.tutSec : 'all', n, then); }
  // 特別ミッションの案内
  function guide(o) {
    if (el) return false;
    GD = { who: o.who || 'koharu', later: o.later || null, lost: 0, poll: setInterval(watch, 300) };
    cur = 'guide'; STEPS = o.steps.slice();
    open('guide', 0, o.then, GD.who);
    return true;
  }
  window.TUTORIAL = { start, run, resume, guide, busy: () => !!el, SECS: Object.keys(SECS) };
})();
