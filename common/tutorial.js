/* 囲碁BLITZ — 小春のチュートリアル
 *   はじめてアプリを開いたとき（タイトルのあと）に自動で始まる。設定の「チュートリアルを受ける」でもう一度。
 *   小春が画面の3分の1くらいの大きさで、説明する場所をよけて立つ（歩くようにフェードで移動・向きも変える）。
 *   どこをタップしても次へ。「スキップ」でいつでも終われる。最後まで受けたら、はじめの1回だけ 1000銭（プレゼントボックス）。
 */
(function () {
  'use strict';
  const P = window.APP, S = P.S;
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // 1歩ずつ：go（画面を開く）、at（光らせる場所）、say（小春のセリフ）
  const home = () => { P.showScreen('home'); P.renderHome(); };
  const STEPS = [
    { go: home, say: 'はじめまして！ 小春です。これから、囲碁BLITZの中を案内しますね。ついてきてください！' },
    { need: 'pvp', at: '#startMatch', say: 'ここは「対人戦」。全国のみんなと、真剣勝負ができるんです。ドキドキしますね！' },
    { need: 'pvp', go: () => $('#startMatch').click(), at: '#goRandom', say: '「ランダムマッチ」なら、同じくらいの強さの人と打てます。勝てばレートが上がりますよ！' },
    { need: 'pvp', at: '#goFriend', say: '「フレンドマッチ」は、合言葉で友だちと一局。おしゃべりしながら打つのも楽しいです♪' },
    { need: 'pvp', at: '.bot-row', say: 'すぐ打ちたいときは「キャラクターと対局」。私と一緒に対局してくれると、嬉しいです！' },
    { go: home, at: '#openSolo', say: 'こちらは「ソロモード」。私たちの物語を読みながら、囲碁を覚えられます。' },
    { go: () => window.SOLO.open(), at: '#storyList', say: '物語の続きは、ミッションをクリアすると読めます。……ちょっと恥ずかしい話もあるかも。えへへ。' },
    { need: 'av', go: home, at: '#openHub', say: '「ルーム」には、あなたのアバターとお部屋があります。行ってみましょう！' },
    { need: 'av', go: () => window.AVATAR_UI.openHub(), at: '#openAvShop', say: 'ここでアバターの服を買えるんです。ひなたちゃんのお店、かわいい服がいっぱいですよ♪' },
    { need: 'av', at: '#openAvatar', say: 'こっちは「クローク」。買った服に着がえられます。' },
    { need: 'av', go: () => window.AVATAR_UI.open('closet', null, 'hub'), at: '#avBig', say: 'ここで着がえられるよ！ あなたに似合う服、私も見てみたいです！' },
    { need: 'room', go: () => window.ROOM.open(), say: 'ここが、あなたのマイルーム！ 好きなものをかざって、自分だけのお部屋にしてくださいね。' },
    { need: 'room', at: '#roomDock [data-dock="social"]', say: '「交流」では、フレンドや、遊びに来てくれた人とお話しできます。' },
    { need: 'room', at: '#roomDock [data-dock="chara"]', say: '「キャラ」から、私たちをお部屋に呼べます。……呼んでくれたら、すぐ行きますね！' },
    { need: 'room', at: '#roomDock [data-dock="shop"]', say: '家具は「ショップ」で。静馬さんのお店です。無口だけど、とってもやさしい人ですよ。' },
    { need: 'room', at: '#roomDock [data-dock="edit"]', say: '「もようがえ」で、家具を好きな場所に並べられます。お部屋づくり、楽しみです！' },
    { need: 'room', go: () => { window.AVATAR_UI.openHub(); $('#openChara').click(); }, at: '#avGrid', say: 'ここは「キャラクター」。段級位が上がると、仲間がどんどん増えていきます。早くみんなに会いたいな！' },
    { need: 'room', go: () => window.FRIENDS.explore(), at: '#exList', say: '「ルーム探訪」では、ほかの人のお部屋をのぞけます。すてきなお部屋、たくさんありますよ！' },
    { need: 'room', go: () => window.FRIENDS.open(), at: '.frs-me', say: 'これがあなたの部屋番号。友だちに教えて、フレンドになってくださいね。' },
    { need: 'room', go: () => $('#openDiary').click(), at: '#dyWrite', say: 'ここで日記をつけられるよ。あなたの日記、楽しみです！' },
    { go: home, say: 'これで案内はおしまいです！ 最後まで聞いてくれて、ありがとうございました。これから、よろしくお願いしますね！', last: true }
  ];

  let el = null, i = -1, typing = 0, full = '', busy = false, done = null, pos = null;
  function build() {
    el = document.createElement('div'); el.className = 'tut';
    el.innerHTML = `<div class="tut-hole" hidden></div>
      <div class="tut-k"><img src="img/visit_koharu.webp" alt="小春"></div>
      <div class="tut-say"><b>小春</b><p></p><small class="tut-next">タップで次へ ▶</small></div>
      <div class="tut-top"><span class="tut-n"></span><button type="button" class="tut-skip">スキップ</button></div>`;
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
    const st = STEPS[n];
    if (st.need && window.PROG && !window.PROG.isOpen(st.need)) { busy = false; i = n; if (n + 1 < STEPS.length) { i = n; next2(); } return; }
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
    busy = false;
  }
  function next2() { i++; if (i >= STEPS.length) { finish(); return; } show(i); }
  const wait = ms => new Promise(r => setTimeout(r, ms));
  function next() {
    if (busy || !el) return;
    const p = el.querySelector('.tut-say p');
    if (p.textContent.length < full.length) { clearInterval(typing); p.textContent = full; return; }   // まず全部表示
    if (STEPS[i] && STEPS[i].last) { finish(true); return; }
    i++;
    if (i >= STEPS.length) { finish(true); return; }
    show(i);
  }
  function close() {
    clearInterval(typing);
    if (!el) return;
    el.classList.add('out'); document.body.classList.remove('tut-on');
    const e = el; el = null; pos = null;
    setTimeout(() => e.remove(), 500);
  }
  function skip() {
    P.confirmBox('案内をスキップしますか？（設定の「チュートリアルを受ける」で、いつでももう一度見られます）', () => {
      if (!S.tut) S.tut = 'skip'; P.save(); close(); home();
    }, null, { yes: 'スキップ', no: 'つづける' });
  }
  function finish() {
    S.tut = 'done'; P.save(); close(); home();
    P.toast('案内はおしまいです。おつかれさまでした！');
  }
  function start(auto) {
    if (el) return;
    if (auto && S.tut) return;
    build(); i = -1; full = ''; busy = false; document.body.classList.add('tut-on');
    requestAnimationFrame(() => el.classList.add('on'));
    setTimeout(next, 300);
  }
  window.addEventListener('resize', () => { if (el && i >= 0 && !busy) { const r = rectOf(STEPS[i].at); hole(r); const p = place(r); pos = null; moveTo(p); } });
  window.TUTORIAL = { start };
})();
