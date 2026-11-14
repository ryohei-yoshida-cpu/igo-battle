/* 囲碁BLITZ — はじめての人の「開放」の流れ
 *   はじめ：小春が登場して「囲碁のルール、知ってる？」→ 初心者／経験者モードでソロモードへ
 *   ソロ「春告げの一局」を読み終える → 対人戦が開く（小春からお礼の1000銭・アタリ碁で最初の一局）
 *   3局 → 戦歴・検討（巴）／ 5局 → アバター・服ショップ（ひなた）／ 10局 → マイルームなど（静馬）／ 20局 → 骨董屋（玄斎）
 *   前から遊んでいる人は、ぜんぶ開いたまま。
 */
(function () {
  'use strict';
  const P = window.APP, S = P.S;
  const $ = s => document.querySelector(s);
  const NEED = { rec: 3, av: 5, room: 10, kotto: 20 };
  const LOCKS = [
    ['pvp', ['#startMatch']],
    ['rec', ['#openRecord', '#openReview', '#meChip']],
    ['av', ['#openHub', '#openShop', '#openAvShop', '#openAvatar', '#shopAvatar']],
    ['room', ['#openRoom', '#openChara', '#openFriends', '#openExplore', '#openDiary', '#homeDiary', '#shopRoom']],
    ['kotto', ['#shopKotto']]
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
  function isOpen(k) {
    const g = prog();
    if (g.all) return true;
    if (k === 'pvp') return !!(S.solo && S.solo.read && S.solo.read.haru);
    return (g.games | 0) >= (NEED[k] || 0);
  }
  const lockText = k => k === 'pvp' ? 'ソロモード「春告げの一局」を読むと開きます' : `あと ${Math.max(0, NEED[k] - (prog().games | 0))} 局で開きます`;
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
    const g = prog(); if (g.intro) return;
    let mode = 'beginner';
    window.FANFARE.scene({
      who: 'koharu', doors: true,
      steps: [
        { text: 'はじめまして！ 私、小春です。この幽玄亭で、囲碁を習っています。' },
        { text: 'あなたも囲碁を打ちに来てくれたんですね！ うれしいなぁ。' },
        { text: 'ひとつ聞いてもいいですか？ 囲碁のルール、対局できるくらい知っていますか？',
          opts: [['expert', '知っている（対局できる）'], ['beginner', 'まだ知らない・自信がない']],
          pick: k => { mode = k; return [{ text: k === 'expert' ? 'すごい！ じゃあ「経験者モード」で、物語を読みながらBotと対局してみてくださいね。' : '大丈夫です！ 私も最初はそうでした。「初心者モード」で、物語を読みながら少しずつ覚えていきましょう！' }]; } },
        { text: 'まずは、ソロモードの最初のお話「春告げの一局」を読んでみてください。……私と師匠が出会ったお話なんです。えへへ。' },
        { text: '読み終わったら、対人戦もできるようになりますよ。いってらっしゃい！' }
      ],
      then: () => {
        g.intro = true; S.solo.mode = mode; P.save();
        if (window.SOLO) window.SOLO.open();
      }
    });
  }

  /* ---------- 「春告げの一局」を読み終えた：対人戦が開く・お礼・アタリ碁 ---------- */
  function haruDone() {
    const g = prog(); if (g.all || g.seen.haru) return;
    g.seen.haru = 1; P.save();
    let atari = false;
    if (P.online()) P.claimTutorial(); else if (window.GIFT) window.GIFT.add('welcome', 1000, '「春告げの一局」を読んでくれたお礼（小春より）');
    window.FANFARE.scene({
      who: 'koharu', doors: true,
      steps: [
        { text: '「春告げの一局」、最後まで読んでくれて、ありがとうございます！' },
        Object.assign(gift('<span class="ff-emoji">💰</span>', '1000銭'), { text: '読んでくれたお礼です。受け取ってください！' }),
        { text: 'それから……これで「対人戦」ができるようになりました！ 全国のみんなと打てますよ。' },
        { text: 'さっそく、私と一局打ってみませんか？ はじめての人にぴったりの「アタリ碁」です！',
          opts: [['go', '打ってみる'], ['', 'あとで']],
          pick: k => { atari = k === 'go'; return atari
            ? [{ text: 'アタリ碁は、相手の石をひとつでも取ったら勝ち！' }, { text: '石のまわりの点を、ぜんぶ自分の石でふさぐと、その石が取れます。取れそうな石があったら、光って教えますね。' }, { text: 'じゃあ、いきますよ！ よろしくお願いします！' }]
            : [{ text: 'わかりました！ 打ちたくなったら、対人戦の「キャラクターと対局」で、強さを「入門」にしてみてくださいね。' }]; } }
      ],
      then: () => {
        refresh();
        if (atari) P.startAtari(won => afterAtari(won));
      }
    });
  }
  function afterAtari(won) {
    P.showScreen('home'); P.renderHome();
    window.FANFARE.scene({
      who: 'koharu',
      steps: won
        ? [{ text: 'やったー！ はじめての勝利、おめでとうございます！' }, { text: 'これからも、一緒に強くなりましょうね。対局を重ねると、新しい場所や仲間に会えますよ！' }]
        : [{ text: 'おしかったですね！ でも、石を取る感じ、つかめたと思います。' }, { text: 'また一緒に打ちましょう！ 対局を重ねると、新しい場所や仲間に会えますよ！' }],
      then: () => check()
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
        Object.assign(gift(avThumb('tool', 't13'), '扇子'), { text: 'これ、あげる！ あんたも強くなりなさいよ！' })
      ]
    }),
    av: () => ({
      who: 'hinata', toast: '「ルーム（アバター）」と「ショップ」が開きました！',
      steps: [
        { text: '君が噂の新人くん？ あはは、やっと会えた！ 楽しみにしてたんだー♪' },
        { text: '私、ここで服屋さんのお手伝いをしてるの！ 服を選びたくなったら、ここに来てね♪' },
        Object.assign(gift(avThumb('body', 'b05'), 'ネオンパーカー'), { text: 'これ、お近づきのキャンペーン品！ 試してみてね♪' })
      ]
    }),
    room: () => ({
      who: 'shima', toast: '「マイルーム」「キャラクター」「フレンド」「ルーム探訪」「囲碁日記」が開きました！',
      steps: [
        { text: 'おっと……すまない、怪我はないか？' },
        { text: '仕入れの帰りで、ぼーっとしてしまった……すまない。' },
        Object.assign(gift(window.ROOM ? window.ROOM.thumb('goban') : '', '碁盤'), { text: 'これは詫びだ……。俺はそこで、家具を扱っている。……興味あるのか。……嬉しいな。良かったら、買い物に来てくれ……。' })
      ]
    }),
    kotto: () => ({
      who: 'gensai', toast: 'ショップに「骨董屋」が開きました！',
      steps: [
        { text: 'よう。……二十局も打ったか。いい面構えになってきたじゃねえか。' },
        { text: '俺は玄斎。この幽玄亭の主だ。小春の師匠なんて呼ばれてるが……まあ、ただの碁打ちさ。' },
        { text: 'ついでに、奥で骨董屋なんてもんもやっててな。いらなくなった服や家具があったら持ってきな。値段の3分の1で引きとってやる。' },
        { text: '店の奥からは、ときどき掘り出し物も出てくる。……お前さんになら、譲ってやってもいい。' },
        Object.assign(gift(window.ROOM ? window.ROOM.thumb('tsubo') : '', '青磁の壺'), { text: 'ほれ、近づきのしるしだ。大事にしな。' })
      ]
    })
  };
  let playing = false;
  function check() {
    const g = prog(); refresh();
    if (g.all || playing || !g.intro) return;
    const k = ['rec', 'av', 'room', 'kotto'].find(k => !g.seen[k] && (g.games | 0) >= NEED[k]);
    if (!k) return;
    g.seen[k] = 1; P.save(); P.claimUnlock(k);
    const sc = SCENES[k]();
    playing = true;
    window.FANFARE.scene({ who: sc.who, doors: true, steps: sc.steps, then: () => { playing = false; refresh(); P.toast(sc.toast, 4500); setTimeout(check, 600); } });
  }
  // アプリを開いたとき：はじめての人は小春の登場、そうでなければ開放のたしかめ
  function start() { const g = prog(); refresh(); if (!g.intro) intro(); else check(); }

  window.PROG = { isOpen, refresh, check, start, haruDone, intro };
})();
