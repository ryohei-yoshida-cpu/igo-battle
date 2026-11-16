/* 囲碁BLITZ — はじめての人の「開放」の流れ
 *   はじめ：小春が登場して「囲碁のルール、知ってる？」→ 初心者／経験者モードでソロモードへ
 *   ソロ「春告げの一局」を読み終える → 対人戦が開く（小春からお礼の1000銭・アタリ碁で最初の一局）
 *   3局 → 巴（戦歴・検討・クローク）→ 特別ミッション「戦歴を見よう」→ お駄賃の扇子 →「クロークで扇子を持とう」
 *   5局 か「ひなたのエピソード」を読む → ひなた（服ショップ・お祝い300銭）→「服ショップでネオンパーカーを買おう」
 *   10局 か「静馬のエピソード」を読む → 静馬（マイルームなど・800銭のクーポン券）→「碁盤を買おう」→「碁盤を置こう」
 *   20局 か「闇落ち玄斎」を読む → 玄斎（骨董屋・投げ捨てたドライフラワー）→「骨董屋で売ろう」
 *   骨董屋が開いてから30局 → 碁会所（玄斎）
 *   開放は順番どおり（前のキャラに会っていないと、次のキャラは来ない）。
 *   特別ミッション：キャラの登場のあとに、その場所の使い方を「やってみよう」で案内する（TUTORIAL.guide）。
 *     終わるまでホームの目標に出る。「あとで」にしても、ホームからまた案内できる。
 */
(function () {
  'use strict';
  const P = window.APP, S = P.S;
  const $ = window.U.$;
  const NEED = { rec: 3, av: 5, room: 10, kotto: 20 }, GK_AFTER = 30;   // 碁会所は、骨董屋が開いてから30局
  const ORDER = ['rec', 'av', 'room', 'kotto', 'gk'];
  const LOCKS = [
    ['pvp', ['#startMatch']],
    ['rec', ['#openRecord', '#openReview', '#meChip']],
    ['cloak', ['#openHub', '#openAvatar']],
    ['av', ['#openShop', '#openAvShop', '#shopAvatar']],
    ['room', ['#openRoom', '#openChara', '#openFriends', '#openExplore', '#openDiary', '#homeDiary', '#shopRoom']],
    ['kotto', ['#shopKotto']],
    ['gk', ['#openGuild', '#goGuild']]
  ];
  // 状態（サーバーから読みこみ直したときに消えることがあるので、毎回たしかめる）
  function prog() {
    if (!S.prog || typeof S.prog !== 'object') {
      const old = (S.games | 0) > 0 || (S.r13 && S.r13.games > 0) || !!S.tut || Object.keys((S.solo && S.solo.read) || {}).length > 0;
      S.prog = { games: (S.games | 0) + ((S.r13 && S.r13.games) | 0), seen: {}, all: old, intro: old };
      P.saveLocal();
    }
    S.prog.seen = S.prog.seen || {};
    return S.prog;
  }
  const read = id => !!(S.solo && S.solo.read && S.solo.read[id]);
  const beginner = () => !S.solo || S.solo.mode !== 'expert';
  // 開いているか（イベントの条件）。前のキャラに会っていないと、次は開かない
  function ready(k) {
    const g = prog(), n = g.games | 0;
    if (k === 'rec') return n >= NEED.rec;
    if (k === 'av') return !!g.seen.rec && (n >= NEED.av || read('ep_hinata'));
    if (k === 'room') return !!g.seen.av && (n >= NEED.room || read('ep_shima'));
    if (k === 'kotto') return !!g.seen.room && (n >= NEED.kotto || read('ep_dgensai'));
    if (k === 'gk') return !!g.seen.kotto && n >= (g.kottoAt | 0) + GK_AFTER;
    return false;
  }
  function isOpen(k) {
    const g = prog();
    if (g.all) return true;
    if (k === 'pvp') return read('haru');
    if (k === 'cloak') return !!g.seen.rec;
    if (k === 'gk' && S.gkFree) return true;   // 試し用にあけた碁会所
    return !!g.seen[k];
  }
  // 次のキャラが来るまで、あと何局
  function gamesLeft(k) { const g = prog(); return Math.max(0, (k === 'gk' ? (g.kottoAt | 0) + GK_AFTER : NEED[k]) - (g.games | 0)); }
  function lockText(k) {
    if (k === 'pvp') return 'ソロモード「春告げの一局」を読むと開きます';
    if (k === 'cloak') return `巴に会うと開きます（あと ${gamesLeft('rec')} 局）`;
    const prev = ORDER[ORDER.indexOf(k) - 1], g = prog();
    if (prev && !g.seen[prev]) return 'もう少し先で開きます';
    return `あと ${gamesLeft(k)} 局で開きます`;
  }
  function refresh() {
    for (const [k, sels] of LOCKS) for (const s of sels) {
      const el = $(s); if (!el) continue;
      const lk = !isOpen(k);
      el.classList.toggle('plock', lk);
      if (lk) el.dataset.lock = lockText(k); else delete el.dataset.lock;
    }
  }
  // 開いていない場所は、押しても入れない（理由を出す）
  document.addEventListener('click', e => {
    const el = e.target.closest && e.target.closest('.plock');
    if (!el) return;
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
    P.sound('bad'); P.toast(`🔒 ${el.dataset.lock || 'まだ開いていません'}`);
  }, true);
  document.addEventListener('kuro9screen', () => setTimeout(refresh, 0));

  const avThumb = (sl, id) => window.AVATAR.thumb({ [sl]: id }, sl);
  const gift = (thumb, name) => ({ text: '', items: [{ thumb, name }], title: 'プレゼントボックスに入れました', party: true });

  /* ---------- はじめて：小春が登場して、ルールを知っているか聞く ---------- */
  function intro() {
    const g = prog(); if (g.intro || playing) return;
    playing = true;
    let mode = 'beginner';
    window.FANFARE.scene({
      who: 'koharu', doors: true,
      steps: [
        { text: 'はじめまして！ 私、小春です。この幽玄亭で、囲碁を習っています。' },
        { text: 'あなたも囲碁を打ちに来てくれたんですね！ うれしいなぁ。' },
        { text: 'ひとつ聞いてもいいですか？ 囲碁のルール、対局できるくらい知っていますか？',
          opts: [['expert', '知っている（対局できる）'], ['beginner', 'まだ知らない・自信がない']],
          pick: k => {
            mode = k;
            if (k !== 'expert') return [{ text: '大丈夫です！ 私も最初はそうでした。「初心者モード」で、物語を読みながら少しずつ覚えていきましょう！' }];
            // 経験者：ソロモードのBotの強さを、はじめに決める
            return [
              { text: 'すごい！ じゃあ「経験者モード」で、物語を読みながらBotと対局してみてくださいね。物語の続きは、Botに勝つと読めます。' },
              { text: 'どのくらいの強さのBotと打ちたいですか？',
                opts: BOT_PICK.map(([lv, label]) => [String(lv), label]),
                pick: v => { S.solo.bot = +v; P.save(); return [{ text: `${P.RANKS[+v]}のBotですね！ 強さは、ソロモードの画面でいつでも変えられますよ。` }]; } }
            ];
          } },
        { text: 'まずは、ソロモードの最初のお話「春告げの一局」を読んでみてください。……私と師匠が出会ったお話なんです。えへへ。' },
        { text: '読み終わったら、対人戦もできるようになりますよ。いってらっしゃい！' }
      ],
      then: () => {
        playing = false; g.intro = true; S.solo.mode = mode; P.save();
        tour('base', () => { if (window.SOLO) window.SOLO.open(); if (mode === 'expert') setTimeout(botGuide, 700); });
      }
    });
  }

  // 経験者モードのBotの強さ（はじめにえらぶ）
  const BOT_PICK = [[0, '10級（はじめたばかり）'], [3, '7級（ルールはばっちり）'], [6, '4級（ふだん打っている）'], [9, '1級（かなり打てる）'], [12, '三段（腕に自信あり）']];
  // ソロモードの画面で、Botの強さを変える場所を教える
  function botGuide() {
    if (!window.TUTORIAL || !document.querySelector('#soloBotRow:not([hidden])')) return;
    window.TUTORIAL.guide({ who: 'koharu', steps: [
      { at: '#soloBotRow', say: `経験者モードでは、物語の続きを読むために、ここで選んだ強さのBot（いまは${P.RANKS[S.solo.bot]}）に勝つのがミッションです。` },
      { at: '#soloBot', say: '強すぎたり、物足りなかったりしたら、ここで強さを変えてくださいね。いつでも変えられます！' }
    ] });
  }

  /* ---------- 「春告げの一局」を読み終えた：対人戦が開く・お礼・アタリ碁 ---------- */
  function haruDone() {
    const g = prog(); if (g.all || g.seen.haru || playing) return;
    playing = true;
    let atari = false;
    P.claimTutorial();   // 1000銭のお礼（つながっていなければ、つながったときに）
    window.FANFARE.scene({
      who: 'koharu', doors: true,
      steps: [
        { text: '「春告げの一局」、最後まで読んでくれて、ありがとうございます！' },
        Object.assign(gift('<span class="ff-emoji">💰</span>', '1000銭'), { text: '読んでくれたお礼です。受け取ってください！' }),
        { text: S.solo.mode === 'expert' ? 'それから……これで「対人戦」ができるようになりました！ 全国のみんなと打てますよ。' : 'それから……「対人戦」もできるようになりました。でも、あわてなくて大丈夫ですよ。' },
        { text: 'さっそく、私と一局打ってみませんか？ はじめての人にぴったりの「アタリ碁」です！',
          opts: [['go', '打ってみる'], ['', 'あとで']],
          pick: k => { atari = k === 'go'; return atari
            ? [{ text: 'アタリ碁は、相手の石をひとつでも取ったら勝ち！' }, { text: '石のまわりの点を、ぜんぶ自分の石でふさぐと、その石が取れます。取れそうな石があったら、光って教えますね。' }, { text: 'じゃあ、いきますよ！ よろしくお願いします！' }]
            : [{ text: 'わかりました！ 打ちたくなったら、対人戦の「キャラクターと対局」で、強さを「入門」にしてみてくださいね。' }]; } }
      ],
      then: () => {
        playing = false; g.seen.haru = 1;   // 最後まで見たら「見た」にする（途中で落ちたら、また最初から）
        if (atari) g.atari = 'pending';
        P.save(); refresh();
        if (atari) startAtari(); else tour('pvp', check);
      }
    });
  }
  // アタリ碁（終わるまでは「とちゅう」として覚えておく。アプリが落ちても、次に開いたときにもう一度さそう）
  function startAtari() { P.startAtari(won => afterAtari(won)); }
  function atariAgain() {
    playing = true;
    window.FANFARE.scene({
      who: 'koharu',
      steps: [{ text: 'おかえりなさい！ さっきのアタリ碁、もう一度やりましょうか？', opts: [['go', 'やる'], ['', 'またこんど']], pick: k => { g2 = k; return k ? [{ text: 'じゃあ、いきますよ！ 石をひとつ取ったら勝ちです！' }] : [{ text: 'わかりました！ 打ちたくなったら、「キャラクターと対局」で強さを「入門」にしてくださいね。' }]; } }],
      then: () => { playing = false; const g = prog(); if (g2) startAtari(); else { delete g.atari; P.save(); tour('pvp', check); } }
    });
  }
  let g2 = '';
  function afterAtari(won) {
    const g = prog(); delete g.atari; P.save();
    P.showScreen('home'); P.renderHome();
    const beginner = S.solo.mode !== 'expert';
    // 初心者には、いきなり対人戦ではなく、ソロモードをすすめる
    const tail = beginner
      ? [{ text: '初心者なら、まずはソロモードをクリアしてみてはいかがでしょう？ 素敵なみんなと会えるかもです！' }, { text: 'お話を読みながら、囲碁のルールも少しずつ覚えられますよ。対局を重ねると、新しい場所も開いていきます！' }]
      : [{ text: '対人戦では、全国のみんなと打てます。強さが近い相手と当たるので、気軽にどうぞ！' }, { text: '対局を重ねると、新しい場所や仲間に会えますよ！' }];
    window.FANFARE.scene({
      who: 'koharu',
      steps: (won
        ? [{ text: 'やったー！ はじめての勝利、おめでとうございます！' }]
        : [{ text: 'おしかったですね！ でも、石を取る感じ、つかめたと思います。' }]).concat(tail),
      then: () => tour('pvp', () => { if (beginner && window.SOLO) window.SOLO.open(); check(); })
    });
  }

  /* ---------- 対局数で開く：キャラが障子の奥から登場 ---------- */
  const SCENES = {
    rec: () => ({
      who: 'tomoe', toast: '「戦歴」と「検討」が開きました！',
      steps: [
        { text: 'なによ！ ……あ、ごめん。負けて泣いてるの、見られたのが恥ずかしかったのよ。' },
        { text: 'ふ、ふん！ こんなの、なんでもないわ！ 負けて強くなるんだから。戦いの数だけ、私は強くなるの！' },
        { text: 'ここで勉強して、過去をいっぱい学ぶんだから！' },
        { text: '……そうだ。あんたも自分の「戦歴」、ちゃんと見ておきなさいよ。見たら、いいものあげるわ！' }
      ]
    }),
    av: () => ({
      who: 'hinata', toast: '「ショップ」と「服ショップ」が開きました！',
      steps: [
        { text: read('ep_hinata') ? 'やっほー！ 夏祭りから帰ってきたよー！ 君が噂の新人くん？ あはは、やっと会えた！' : '君が噂の新人くん？ あはは、やっと会えた！ 楽しみにしてたんだー♪' },
        { text: '私、ここで服屋さんのお手伝いをしてるの！ 服を選びたくなったら、ここに来てね♪' },
        Object.assign(gift('<span class="ff-emoji">💰</span>', '300銭'), { text: 'これ、来てくれたお祝い！ 好きな服を買ってみて♪' })
      ]
    }),
    room: () => ({
      who: 'shima', toast: '「マイルーム」「キャラクター」「フレンド」「ルーム探訪」「囲碁日記」が開きました！',
      steps: [
        { text: 'おっと……すまない、怪我はないか？' },
        { text: '仕入れの帰りで、ぼーっとしてしまった……すまない。' },
        Object.assign(gift('<span class="ff-emoji">🎫</span>', '800銭のクーポン券'), { text: '詫びだ……。俺はそこで、家具を扱っている。この券で、何か買っていってくれ。……碁盤なんか、どうだ。' })
      ]
    }),
    // 玄斎：また振られて、花束を投げ捨てる → 拾う → 小春「売っちゃいましょうか」（特別ミッション sell_flower）
    kotto: () => ({
      who: 'gensai', toast: 'ショップに「骨董屋」が開きました！',
      steps: [
        { text: '……ちっ。また振られちまった。' },
        { text: 'なじみの店の子にやろうと思ってな……「枯れた花なんていらない」だとよ。ドライフラワーだっての。' },
        { text: '……もう、こんなもん、いらねえ！' },
        Object.assign(gift(window.ROOM ? window.ROOM.thumb('w_dryflower') : '', 'ドライフラワー'), { text: '（玄斎は花束を放り投げて、店の奥へ行ってしまった……）', title: '投げ捨てられた花束を拾った', party: false })
      ]
    }),
    gk: () => ({
      who: 'gensai', toast: '「碁会所」が開きました！ ホームと対人戦の画面から行けます',
      steps: [
        { text: 'よう。……すっかり、ここの常連だな。' },
        { text: '碁ってのは、ひとりで強くなるもんじゃねえ。仲間と打って、笑って、悔しがって強くなるんだ。' },
        { text: 'お前さんも「碁会所」を開いてみるか？ 気の合う連中を集めて、月ごとにほかの碁会所と勝ち数をきそうのも面白えぞ。' },
        { text: 'ほかの碁会所に入れてもらうのもいい。……ま、好きにやんな。' }
      ]
    })
  };
  let playing = false;
  function check() {
    const g = prog(); refresh();
    if (g.all || playing || !g.intro) return;
    const k = ORDER.find(k => !g.seen[k] && ready(k));
    if (!k) {
      const t = pendingTour(); if (t) { tour(t, () => setTimeout(check, 600)); return; }
      if (S.sp && !spBusy) spCheck();
      return;
    }
    const sc = SCENES[k]();
    playing = true;
    window.FANFARE.scene({ who: sc.who, doors: true, steps: sc.steps, then: () => {
      playing = false; g.seen[k] = 1;
      if (k === 'kotto') g.kottoAt = g.games | 0;   // 碁会所は、ここから30局
      P.save(); refresh(); P.toast(sc.toast, 4500);
      const go = () => setTimeout(check, 600);
      // キャラの登場のあと：案内 → 特別ミッション
      if (k === 'rec') tour('rec', () => special('rec_look'));
      else if (k === 'av') { P.claimUnlock('av'); doneTour('av'); special('buy_parka'); }
      else if (k === 'room') { P.claimUnlock('room'); tour('room', () => special('buy_goban')); }
      else if (k === 'kotto') { doneTour('kotto'); P.claimUnlock('kotto', () => special('sell_flower')); }
      else tour(k, go);
    } });
  }
  const doneTour = k => { S.tutDone = S.tutDone || {}; S.tutDone[k] = 1; P.save(); };

  /* ---------- 特別ミッション：その場所の使い方を「やってみよう」で ----------
   *   S.sp：いまの特別ミッション、S.spQ：あとに控えているもの（つづけてキャラが来たとき）
   *   done()：できたか。guide：案内（TUTORIAL.guide）。lines：できたあとのセリフ
   *   案内なしで自分でできたときも、done() を見て、セリフを出して次へ */
  const $$ = s => document.querySelector(s);
  const home = () => { for (const id of ['result', 'settings']) { const e = $$('#' + id); if (e) e.hidden = true; } P.showScreen('home'); P.renderHome(); };
  const RM = () => window.ROOM.state();
  const avTab = sl => !!$$(`#avTabs [data-slot="${sl}"][aria-pressed="true"]`);
  const avIs = t => !$$('#avatar').hidden && $$('#avTitle').textContent === t;
  const SP = {
    rec_look: {
      title: '「戦歴」を見てみよう', who: 'koharu',
      done: () => !!S.spSeen,
      steps: [{ go: home, at: '#openRecord', say: '巴ちゃんの言っていた「戦歴」を、開いてみましょう！', until: () => !!S.spSeen }],
      after(then) {
        // 巴からお駄賃（扇子）→ 初心者は、ひなたのエピソードが読めるように
        window.FANFARE.scene({ who: 'tomoe', steps: [
          { text: 'ちゃんと見たわね！ ……自分の碁をふり返れる人は、強くなるわ。' },
          Object.assign(gift(avThumb('tool', 't13'), '扇子'), { text: 'はい、お駄賃。扇子よ。……あんたも、強くなりなさいよね！' })
        ], then: () => {
          prog().seen.recLook = 1; P.save();
          P.claimUnlock('rec', () => {
            if (beginner()) P.toast('ソロモードで「ひなたの夏祭り囲碁大作戦」が読めるようになりました！', 4500);
            then('equip_fan');
          });
        } });
      }
    },
    equip_fan: {
      title: 'クロークで扇子を持ってみよう', who: 'koharu',
      done: () => !!(S.av && S.av.tool === 't13'),
      steps: [
        { go: home, say: '巴ちゃんから扇子をもらいましたね！ さっそく、アバターに持たせてみましょう！' },
        { go: home, at: '#openHub', say: 'まずは「ルーム」を開いてください。', until: () => !$$('#hub').hidden },
        { go: () => window.AVATAR_UI.openHub(), at: '#openAvatar', say: '「クローク」をタップ！ 持っている服に着がえられる場所です。', until: () => avIs('クローク') },
        { go: () => window.AVATAR_UI.open('closet', null, 'hub'), at: '#avTabs [data-slot="tool"]', say: '「道具」のタブを開いて……', until: () => avTab('tool'), skip: () => avTab('tool') },
        { light: true, at: '#avGrid2 [data-sl="tool"][data-id="t13"]', say: '扇子をタップ！', until: () => !!$$('#avGrid2 [data-sl="tool"][data-id="t13"].on') },
        { light: true, at: '#avSave', say: '「この姿にする」で決まりです！', until: () => !!(S.av && S.av.tool === 't13') }
      ],
      lines: ['とってもお似合いです！ 扇子を持つと、なんだか強そうに見えますね。',
        'お店で新しい服も買えるのですが……店員のひなたさん、今はお休みみたいですね。この街に新人さんが来るの、一番楽しみにしていたのに。夏祭りにでも行っちゃったかなぁ。']
    },
    buy_parka: {
      title: '服ショップで服を買ってみよう', who: 'hinata',
      done: () => (S.avOwned || []).includes('body:b05'),
      steps: [
        { go: home, say: 'お祝いの300銭で、さっそくお買い物してみよっか！ お店はこっちだよ♪' },
        { go: home, at: '#openShop', say: 'まずは「ショップ」！', until: () => !$$('#shop').hidden },
        { go: () => window.SHOP.open(), at: '#shopAvatar', say: '私の「服ショップ」はここ！', until: () => avIs('服ショップ') },
        { go: () => window.AVATAR_UI.open('shop', null, 'home'), at: '#avTabs [data-slot="body"]', say: '「身体」のタブをタップしてね。', until: () => avTab('body'), skip: () => avTab('body') },
        { light: true, at: '#avGrid2 [data-sl="body"][data-id="b05"]', say: 'おすすめは、この「ネオンパーカー」！ タップすると試着できるよ♪', until: () => !!$$('#avGrid2 [data-sl="body"][data-id="b05"].on') || (S.avOwned || []).includes('body:b05') },
        { light: true, at: '#avGrid2 [data-sl="body"][data-id="b05"]', say: '似合ってる！ もう一度タップすると、買えるよ！', until: () => (S.avOwned || []).includes('body:b05') }
      ],
      lines: ['お買い上げ、ありがとう！ すっごく似合ってるよ♪', '新しい服が入ったら、また見に来てね！']
    },
    buy_goban: {
      title: '家具を買ってみよう（碁盤）', who: 'shima',
      done: () => RM().owned('goban') >= 1,
      steps: [
        { go: home, say: '……クーポン券、使ってくれるのか。俺の店に案内しよう。' },
        { go: home, at: '#openHub', say: 'まずは「ルーム」を開いてくれ。', until: () => !$$('#hub').hidden || !$$('#myroom').hidden },
        { go: () => window.AVATAR_UI.openHub(), at: '#openRoom', say: '「マイルーム」へ。', until: () => !$$('#myroom').hidden },
        { go: () => window.ROOM.open(), at: '#roomDock [data-dock="shop"]', say: '下の「ショップ」が、俺の店だ。', until: () => RM().mode === 'shop' },
        { at: '#rsNav [data-kind="floor"]', say: '「床の家具」を見てくれ。', until: () => RM().shopKind === 'floor', skip: () => RM().shopKind === 'floor' },
        { light: true, at: '#rsGrid [data-try="goban"]', say: '……碁盤だ。タップすると、部屋に試し置きできる。', until: () => RM().trying('goban') || RM().owned('goban') >= 1 },
        { light: true, at: '#rsCart .rs-buy', say: 'よければ「購入」を押してくれ。', until: () => RM().owned('goban') >= 1 }
      ],
      lines: ['……ありがとう。いい碁盤だ。大事にしてくれ。'],
      next: 'place_goban'
    },
    place_goban: {
      title: '家具を置いてみよう', who: 'koharu',
      done: () => !!S.spSeen,
      steps: [
        { say: '碁盤、買えましたね！ 次は、お部屋に置いてみましょう！' },
        { go: () => window.ROOM.open(), at: '#roomDock [data-dock="edit"]', say: '「もようがえ」をタップ！', until: () => RM().mode === 'edit' },
        { light: true, at: '[data-place="goban"]', say: '倉庫の碁盤をタップすると、お部屋に置けます。', until: () => RM().placed('goban') >= 1, skip: () => RM().placed('goban') >= 1 },
        { say: '置いた家具は、ドラッグで好きな場所に動かせますよ。' },
        { at: '.rm-edit-h [data-dock="edit"]', say: 'できたら「もようがえを終わる」をタップ！', until: () => { if (RM().mode === 'view' && RM().placed('goban') >= 1) S.spSeen = 1; return !!S.spSeen; } }
      ],
      lines: ['すてきなお部屋になりましたね！ 碁盤をタップすると、対人戦にも行けますよ。']
    },
    sell_flower: {
      title: '骨董屋で売ってみよう', who: 'koharu',
      done: () => !!S.spSeen,
      steps: [
        { go: home, say: '……あれ？ それ、師匠が投げた花束ですか？' },
        { say: '縁起でもないですし……売っちゃいましょうか。あの人、この先で骨董屋もやってるんです。' },
        { go: home, at: '#openShop', say: '「ショップ」へ行きましょう！', until: () => !$$('#shop').hidden },
        { go: () => window.SHOP.open(), at: '#shopKotto', say: '奥の「骨董屋」です。', until: () => !$$('#kotto').hidden },
        { go: () => window.SHOP.openKotto(), at: '#kottoGrid [data-sell-item="w_dryflower"]', say: 'ドライフラワーをタップして、売ってみてください。', until: () => !!S.spSeen }
      ],
      lines: ['売れましたね！',
        '玄斎さんは勾玉のコレクターで、勾玉も売っているんですが……貴重な品だそうで、しっかりとした大人しか買えないんです。興味があったら、のぞいてみてくださいね。']
    }
  };
  let spBusy = false;
  // 特別ミッションを始める（ほかのが残っていたら、あとに並べる）
  function special(id) {
    if (S.sp && S.sp !== id) { S.spQ = (S.spQ || []).filter(x => x !== id).concat(id); P.save(); setTimeout(check, 600); return; }
    S.sp = id; S.spSeen = 0; P.save(); P.renderHome();
    runSpecial();
  }
  // 案内する（ホームの目標をタップしたときも）
  function runSpecial() {
    const d = SP[S.sp]; if (!d || spBusy || playing) return;
    if (d.done()) { spDone(); return; }
    if (!window.TUTORIAL || window.TUTORIAL.busy()) return;
    spBusy = true;
    const steps = d.steps.concat((d.lines || []).map(t => ({ say: t })));
    window.TUTORIAL.guide({ who: d.who, steps, then: () => { spBusy = false; spDone(true); }, later: () => { spBusy = false; home(); } });
  }
  // できた：セリフ（案内なしでできたとき）→ 次の特別ミッション
  function spDone(said) {
    const id = S.sp, d = SP[id]; if (!d) return;
    if (!d.done()) return;
    S.sp = null; S.spSeen = 0; P.save();
    const next = nx => {
      const n = nx || d.next || (S.spQ || []).shift();
      P.save();
      if (n) setTimeout(() => special(n), 500); else { home(); setTimeout(check, 600); }
    };
    // ミッションクリアの演出（ハンコ）→ そのあと
    const after0 = () => d.after ? d.after(next) : next();
    const after = () => {
      if (!window.FX || !window.FX.stamp) { after0(); return; }
      spBusy = true;
      window.FX.stamp({ kicker: '特別ミッション', stamp: 'クリア', title: d.title, sub: 'ミッションクリア！', chara: d.who, kind: 'mission', done: () => { spBusy = false; after0(); } });
    };
    if (!said && d.lines) { spBusy = true; window.FANFARE.scene({ who: d.who === 'shima' ? 'shima' : d.who, steps: d.lines.map(text => ({ text })), then: () => { spBusy = false; after(); } }); }
    else after();
  }
  // 自分でできたかの見張り（ホームにもどったとき・画面を移ったとき）
  function spCheck() { const d = SP[S.sp]; if (d && !spBusy && !playing && d.done()) spDone(); }
  document.addEventListener('kuro9screen', e => {
    if (S.sp === 'rec_look' && e.detail === 'record' && !S.spSeen) { S.spSeen = 1; P.save(); }
    if (e.detail === 'home') setTimeout(spCheck, 300);
  });
  document.addEventListener('kuro9room', e => { if (S.sp === 'place_goban' && e.detail === 'editdone' && RM().placed('goban') >= 1) { S.spSeen = 1; P.save(); } });
  document.addEventListener('kuro9sold', e => { if (S.sp === 'sell_flower' && e.detail === 'w_dryflower') { S.spSeen = 1; P.save(); } });
  // ホームの目標用
  function spInfo() { const d = SP[S.sp]; return d ? { id: S.sp, title: d.title } : null; }

  // 小春の案内（開いた場所の分だけ）。案内のあいだは、ほかの登場をまつ
  function tour(sec, then) {
    if (!window.TUTORIAL || prog().all) { if (then) then(); return; }
    playing = true;
    window.TUTORIAL.run(sec, () => { playing = false; if (then) then(); });
  }
  // 開いているのに、まだ案内していない場所（前の版で開いた人・とちゅうで落ちた人）
  function pendingTour() {
    const g = prog(); if (g.all || !g.intro) return null;
    const done = S.tutDone || {};
    if (!done.base) return 'base';
    if (isOpen('pvp') && g.seen.haru && g.atari !== 'pending' && !done.pvp) return 'pvp';
    return ['rec', 'av', 'room', 'kotto', 'gk'].find(k => g.seen[k] && !done[k]) || null;
  }
  // アプリを開いたとき：はじめての人は小春の登場、そうでなければ開放のたしかめ
  // アプリを開いたとき・読みこみ直したとき：とちゅうだったところから
  function start() {
    const g = prog(); refresh();
    if (playing) return;
    if (!g.intro) { intro(); return; }
    if (!g.all && S.solo && S.solo.read && S.solo.read.haru && !g.seen.haru) { haruDone(); return; }   // 春告げを読んだあとの小春の話がとちゅうだった
    if (g.atari === 'pending') { atariAgain(); return; }
    if (S.tutStep != null && window.TUTORIAL) { playing = true; window.TUTORIAL.resume(S.tutStep, () => { playing = false; setTimeout(check, 600); }); return; }   // メニューの案内がとちゅうだった
    check();
  }

  window.PROG = { busy: () => playing || spBusy, isOpen, ready, refresh, check, start, haruDone, intro, gamesLeft, spInfo, runSpecial, beginner, NEED, GK_AFTER };
})();
