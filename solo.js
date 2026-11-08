/* 九路 Blitz — ソロモード（脚本を読む・ミッション・レクチャー） */
(() => {
  'use strict';
  const P = window.APP, E = P.E, A = P.A, S = P.S;
  const $ = s => document.querySelector(s);
  const STORIES = window.STORIES || [], LESSONS = window.LESSONS || [];
  const COLS = 'ABCDEFGHJ';
  const pt = s => COLS.indexOf(s[0]) + (9 - (+s.slice(1))) * 9;
  const parse = rows => { const b = []; for (const r of rows) for (const ch of r) b.push(ch === 'X' ? 1 : ch === 'O' ? 2 : 0); return b; };
  const faceOf = who => A.faceUri(who === '玄斎' ? 1 : 0);
  const nameClass = who => who === '小春' ? '' : who === '玄斎' ? 'gensai' : 'other';
  const opened = id => S.solo.open[id] || 0;               // 読める幕の最後（0 = 第一幕だけ）
  const nextLesson = () => LESSONS.find(l => !S.solo.lessons.includes(l.id));

  /* 長い幕は約30行ずつに分ける（区切りごとにミッション）。
   * 区切りはなるべくト書き（ナレーション）の行から始まるようにずらす。 */
  const CHUNK = 30;
  for (const st of STORIES) {
    if (st.chunked) continue;
    const chunks = [], firstOf = [];
    st.parts.forEach(pa => {
      firstOf.push(chunks.length);
      const L = pa.lines, n = Math.max(1, Math.ceil(L.length / CHUNK));
      const cuts = [0];
      for (let k = 1; k < n; k++) {
        let c = Math.round(L.length * k / n);
        for (let d = 0; d <= 6; d++) {
          if (c + d < L.length && !L[c + d][0]) { c += d; break; }
          if (c - d > cuts[cuts.length - 1] + 5 && !L[c - d][0]) { c -= d; break; }
        }
        cuts.push(c);
      }
      cuts.push(L.length);
      for (let k = 0; k < n; k++) chunks.push({ title: n > 1 ? `${pa.title}（${k + 1}/${n}）` : pa.title, lines: L.slice(cuts[k], cuts[k + 1]) });
    });
    // 話す人が変わるたびに、名前の位置を左右入れかえる
    let side = 0, prev = null;
    for (const ch of chunks) ch.sides = ch.lines.map(([who]) => {
      if (!who) return -1;
      if (prev !== null && who !== prev) side ^= 1;
      prev = who; return side;
    });
    st.firstOf = firstOf; st.parts = chunks; st.chunked = true;
    st.total = chunks.reduce((a, c) => a + c.lines.length, 0);
  }
  // 以前の保存データ（幕ごと）を、区切りごとの番号に引っ越す
  if (S.solo.chunkV !== 1) {
    for (const st of STORIES) if (S.solo.open[st.id] != null) S.solo.open[st.id] = st.firstOf[Math.min(S.solo.open[st.id], st.firstOf.length - 1)] || 0;
    S.solo.chunkV = 1; P.save();
  }

  /* ================= 実戦ドリル（レベル順・同じ問題は出さない） =================
   * Lv.1 1つの石を1手で取る → Lv.2 つながった石を取る・アタリから逃げる → Lv.3 2手で取る（シチョウ・ゲタ）
   * → Lv.4 ひと工夫して逃げる → Lv.5 3手以上追いかけて取る → Lv.6 長いシチョウを読み切る
   * ミスなしで正解すると1点。6点でレベルが上がる。 */
  const DRW = window.DRILLS || {};
  const DL = DRW.levels || { 1: DRW.cap1 || [], 2: DRW.save || [], 3: DRW.cap3 || [] };   // 古い形式にも対応
  const LV_MAX = Math.max(1, ...Object.keys(DL).map(Number));
  const DRILL_N = Object.values(DL).reduce((a, l) => a + l.length, 0);
  const LV_NAME = { 1: '1手で取る', 2: 'つながった石・アタリから逃げる', 3: '2手で取る（シチョウ・ゲタ）', 4: 'ひと工夫して逃げる', 5: '追いかけて取る', 6: '長いシチョウを読み切る' };
  const PER_LV = 6;
  const drillState = () => { S.solo.drill = Object.assign({ pts: 0, seen: [] }, S.solo.drill); return S.solo.drill; };
  const drillLv = () => Math.min(LV_MAX, 1 + Math.floor(drillState().pts / PER_LV));
  const LINES = {
    小春: {
      cap1: ['白石を1手で取ってください！', '白石の呼吸点は、あとひとつ。どこが空いてる？'],
      cap: ['白石を追いかけて取ってください。逃げられないように！', 'シチョウやゲタを思い出して。逃げ道の広い方をふさぐようにアタリ。'],
      long: ['じっくり読んで、白石を取り切ってください。', '白が逃げた先も読んでみて。階段の先に黒石はある？'],
      save: ['アタリの黒石を助けてください！', '呼吸点が増える方へ伸びてみよう。'],
      save2: ['アタリの黒石を助けて！ ただ伸びるだけだと……？', '伸びても助からないかも。白石を取れないか探してみて。']
    },
    玄斎: {
      cap1: ['白を1手で取ってみな。', '白の呼吸点は残りひとつだ。どこが空いてる？'],
      cap: ['白を追いかけて取り切れ。逃がすなよ。', 'シチョウかゲタだ。逃げ道の広い方からふさげ。'],
      long: ['よく読め。白を取り切ってみな。', '白が逃げた先まで読め。階段の先に黒はあるか？'],
      save: ['黒がアタリだ。助けてみな。', '呼吸点が増える方へ伸びろ。'],
      save2: ['黒がアタリだ。ただ伸びても助からねえぞ。', '伸びるだけじゃダメだ。白を取れないか見てみろ。']
    }
  };
  const lineKey = (p, lv) => p.type === 'save' ? (lv >= 4 ? 'save2' : 'save') : p.depth <= 1 ? 'cap1' : p.depth >= 5 ? 'long' : 'cap';
  function makeDrill() {
    const teacher = Math.random() < .5 ? '小春' : '玄斎';
    const lv = drillLv(), st = drillState();
    let pool = (DL[lv] || []).map((p, i) => ({ p, id: lv + ':' + i }));
    let fresh = pool.filter(x => !st.seen.includes(x.id));
    if (fresh.length < 3) { st.seen = st.seen.filter(id => !id.startsWith(lv + ':')); fresh = pool; }   // ひと回りしたら最初から
    const picks = fresh.slice().sort(() => Math.random() - .5).slice(0, 3);
    const problems = picks.map(({ p, id }) => {
      const [text, hint] = LINES[teacher][lineKey(p, lv)];
      return Object.assign({}, p, { text, hint, good: p.type === 'save' ? '助かりました！ もう取られません。' : '取れました！', goodWho: '小春', drillId: id });
    });
    return {
      id: 'drill', drill: true, lv, title: `実戦ドリル Lv.${lv}`, teacher,
      talk: [{ who: teacher, text: (teacher === '玄斎' ? `Lv.${lv}「${LV_NAME[lv]}」だ。3問いくぞ。` : `実戦ドリル Lv.${lv}「${LV_NAME[lv]}」です。3問いきますね！`) }],
      problems
    };
  }

  /* ================= ソロのトップ ================= */
  function open() { renderTop(); P.showScreen('solo'); }
  function renderTop() {
    const beg = S.solo.mode !== 'expert';
    $('#soloBeginner').setAttribute('aria-checked', String(beg));
    $('#soloExpert').setAttribute('aria-checked', String(!beg));
    $('#soloDesc').textContent = beg
      ? '幕の区切りごとに、小春と玄斎の囲碁レクチャーが入ります。実戦問題に正解すると続きが読めます。'
      : '幕の区切りごとに、Botとの対局が入ります。勝つと続きが読めます（レートは変わりません）。';
    $('#soloBotRow').hidden = beg;
    const sel = $('#soloBot');
    if (!sel.options.length) P.RANKS.slice(0, P.BOT_MAX + 1).forEach((r, i) => { const o = document.createElement('option'); o.value = i; o.textContent = r; sel.append(o); });
    sel.value = String(S.solo.bot);

    const list = $('#storyList'); list.innerHTML = '';
    let userHead = false;
    for (const st of STORIES) {
      if (st.user && !userHead) {
        userHead = true;
        const h = document.createElement('div'); h.className = 'story-sub'; h.innerHTML = '<span>読み物 ― オリジナル脚本</span><small>キャラクターとストーリーは関係ありません</small>';
        list.append(h);
      }
      const n = st.parts.length, op = opened(st.id), done = S.solo.read && S.solo.read[st.id];
      const b = document.createElement('button'); b.className = 'story'; b.type = 'button';
      const pips = n <= 12 ? `<span class="pips">${st.parts.map((_, i) => `<i class="${i <= op ? 'on' : ''}"></i>`).join('')}</span>`
        : `<span class="st-bar"><i style="width:${Math.round(100 * (done ? n : op + 1) / n)}%"></i></span>`;
      b.innerHTML = `<b></b>${pips}<small></small><span class="st-state"></span>`;
      b.querySelector('b').textContent = st.title;
      b.querySelector('small').textContent = st.sub;
      const t = st.parts[Math.min(op, n - 1)].title, m = t.match(/（\d+\/\d+）$/);
      b.querySelector('.st-state').textContent = done ? '読了・もう一度読めます' : `${t.split(/\s|　/)[0]}${m ? m[0] : ''}まで読めます（${Math.min(op, n - 1) + 1}/${n}区切り）`;
      b.onclick = () => {
        const at = S.solo.at && S.solo.at[st.id];
        if (at && at[0] <= op && st.parts[at[0]] && at[1] < st.parts[at[0]].lines.length) openReader(st, at[0], at[1]);
        else openReader(st, Math.min(op, n - 1));
      };
      list.append(b);
    }
    $('#lessonHead').hidden = !beg; $('#lessonList').hidden = !beg;
    const ll = $('#lessonList'); ll.innerHTML = '';
    const nx = nextLesson();
    LESSONS.forEach((l, i) => {
      const done = S.solo.lessons.includes(l.id);
      const b = document.createElement('button'); b.type = 'button';
      b.className = done ? 'done' : '';
      b.disabled = !done && l !== nx;
      b.innerHTML = `<span></span><i>${done ? '✓ クリア' : l === nx ? '次のレクチャー' : `その${i + 1}`}</i>`;
      b.querySelector('span').textContent = l.title;
      b.onclick = () => runLesson(l, () => open());
      ll.append(b);
    });
    const db = document.createElement('button'); db.type = 'button'; db.className = 'drill';
    db.innerHTML = `<span>実戦ドリル Lv.${drillLv()}</span><i>${LV_NAME[drillLv()] || ''}・次のレベルまで ${PER_LV - drillState().pts % PER_LV} 問・全${DRILL_N}問</i>`;
    db.onclick = () => runLesson(makeDrill(), () => open());
    ll.append(db);
  }
  $('#soloBeginner').onclick = () => { S.solo.mode = 'beginner'; P.save(); renderTop(); };
  $('#soloExpert').onclick = () => { S.solo.mode = 'expert'; P.save(); renderTop(); };
  $('#soloBot').addEventListener('change', e => { S.solo.bot = +e.target.value; P.save(); });
  $('#soloBack').onclick = () => { P.showScreen('home'); P.renderHome(); };

  /* ================= 脚本を読む ================= */
  let RD = null, typeT = 0;
  function openReader(story, part, line) {
    RD = { story, part, line: line || 0, typing: false, lastWho: null };
    P.showScreen('reader');
    $('#rdStory').textContent = story.title;
    $('#rdNote').hidden = !story.user;
    showLine();
  }
  function posIndex(part, line) { let k = line; for (let i = 0; i < part; i++) k += RD.story.parts[i].lines.length; return k; }
  function showLine() {
    const part = RD.story.parts[RD.part];
    $('#rdPart').textContent = part.title;
    $('#rdCard').hidden = true; $('#rdBox').hidden = false;
    const [who, text] = part.lines[RD.line];
    const side = part.sides[RD.line];
    const nm = $('#rdName'); nm.textContent = who;
    nm.className = 'rd-name ' + nameClass(who) + (side === 1 ? ' right' : '') + (who && who !== RD.lastWho ? ' swap' : '');
    if (who) RD.lastWho = who;
    const tx = $('#rdText'); tx.className = 'rd-text' + (who ? '' : ' narr');
    $('#rdCount').textContent = `${RD.line + 1}/${part.lines.length}`;
    $('#rdGauge i').style.width = (100 * (posIndex(RD.part, RD.line) + 1) / RD.story.total) + '%';
    const last = RD.part >= RD.story.parts.length - 1;
    $('#rdSkip').hidden = false;
    $('#rdSkip').textContent = last ? '最後へ ≫' : opened(RD.story.id) > RD.part ? '次へ ≫' : '実戦へ ≫';
    S.solo.at = S.solo.at || {}; S.solo.at[RD.story.id] = [RD.part, RD.line]; P.save();
    // 1文字ずつ表示（タップで全文）
    clearInterval(typeT); RD.typing = true;
    let i = 0; tx.textContent = '';
    typeT = setInterval(() => {
      i += 1; tx.textContent = text.slice(0, i);
      if (i >= text.length) { clearInterval(typeT); RD.typing = false; }
    }, 28);
    RD.full = text;
  }
  function advance() {
    if (!RD || !$('#rdCard').hidden) return;
    if (RD.typing) { clearInterval(typeT); RD.typing = false; $('#rdText').textContent = RD.full; return; }
    const part = RD.story.parts[RD.part];
    if (RD.line < part.lines.length - 1) { RD.line++; showLine(); return; }
    endOfPart();
  }

  /* ログ：ここまで読んだ行。タップでその場面から読み直す */
  function openLog() {
    if (!RD) return;
    clearInterval(typeT); RD.typing = false;
    const list = $('#rdLogList'); list.innerHTML = '';
    const endPart = RD.part, endLine = $('#rdCard').hidden ? RD.line : RD.story.parts[RD.part].lines.length - 1;
    const from = Math.max(0, endPart - 5);   // 長くなりすぎないよう、直近の区切りまで
    let nowEl = null;
    for (let pi = from; pi <= endPart; pi++) {
      const pa = RD.story.parts[pi];
      const h = document.createElement('div'); h.className = 'log-sec'; h.textContent = pa.title; list.append(h);
      const upto = pi === endPart ? endLine : pa.lines.length - 1;
      for (let li = 0; li <= upto; li++) {
        const [who, text] = pa.lines[li];
        const b = document.createElement('button'); b.type = 'button';
        b.className = 'log-row' + (who ? '' : ' narr') + (pa.sides[li] === 1 ? ' right' : '') + (pi === endPart && li === endLine ? ' now' : '');
        if (who) { const n = document.createElement('span'); n.className = 'rd-name ' + nameClass(who); n.textContent = who; b.append(n); }
        const p = document.createElement('p'); p.textContent = text; b.append(p);
        b.onclick = () => { $('#rdLog').hidden = true; P.sound('tap'); RD.part = pi; RD.line = li; RD.lastWho = null; showLine(); };
        list.append(b);
        if (pi === endPart && li === endLine) nowEl = b;
      }
    }
    $('#rdLog').hidden = false;
    if (nowEl) nowEl.scrollIntoView({ block: 'center' });
  }
  $('#rdLogBtn').onclick = e => { e.stopPropagation(); openLog(); };
  $('#closeLog').onclick = () => { $('#rdLog').hidden = true; };
  $('#rdLog').addEventListener('click', e => { if (e.target.id === 'rdLog') $('#rdLog').hidden = true; });

  /* 登場人物：ここまでに出てきた人だけ（ネタバレしないように） */
  const castKey = (st, who) => {
    const list = st.cast || [];
    let best = null;
    for (const c of list) if (who.startsWith(c[0]) && (!best || c[0].length > best[0].length)) best = c;
    return best;
  };
  function openCast() {
    if (!RD) return;
    const st = RD.story, seen = new Map();
    for (let pi = 0; pi <= RD.part; pi++) {
      const pa = st.parts[pi], upto = pi === RD.part ? RD.line : pa.lines.length - 1;
      for (let li = 0; li <= upto; li++) {
        const who = pa.lines[li][0];
        if (!who || who.includes('・') || who === '一同') continue;
        const c = castKey(st, who), key = c ? c[0] : who;
        if (!seen.has(key)) seen.set(key, c ? c[1] : '');
      }
    }
    const list = $('#rdCastList'); list.innerHTML = '';
    if (!seen.size) list.innerHTML = '<p class="rd-card-d">まだ誰も話していません。</p>';
    for (const [name, desc] of seen) {
      const row = document.createElement('div'); row.className = 'cast-row';
      if (!st.user && (name === '小春' || name === '玄斎')) { const im = document.createElement('img'); im.alt = ''; im.src = faceOf(name); row.append(im); }
      else { const ini = document.createElement('span'); ini.className = 'cast-ini'; ini.textContent = name[0]; row.append(ini); }
      const d = document.createElement('div'); d.innerHTML = '<b></b><p></p>';
      d.querySelector('b').textContent = name; d.querySelector('p').textContent = desc || '';
      row.append(d); list.append(row);
    }
    $('#rdCast').hidden = false;
  }
  $('#rdCastBtn').onclick = e => { e.stopPropagation(); openCast(); };
  $('#closeCast').onclick = () => { $('#rdCast').hidden = true; };
  $('#rdCast').addEventListener('click', e => { if (e.target.id === 'rdCast') $('#rdCast').hidden = true; });

  function card(kicker, title, desc, buttons) {
    $('#rdBox').hidden = true; $('#rdSkip').hidden = true;
    $('#rdCard').hidden = false;
    $('#rdCardK').textContent = kicker; $('#rdCardT').textContent = title; $('#rdCardD').textContent = desc;
    const bx = $('#rdCardBtns'); bx.innerHTML = '';
    for (const [label, cls, fn] of buttons) { const b = document.createElement('button'); b.className = 'btn ' + cls; b.textContent = label; b.onclick = fn; bx.append(b); }
  }
  function endOfPart() {
    const st = RD.story, n = st.parts.length;
    if (RD.part >= n - 1) {
      S.solo.read = S.solo.read || {}; S.solo.read[st.id] = true; P.save();
      const r = $('#rdStage').getBoundingClientRect(); A.burst(r.left + r.width / 2, r.top + r.height / 2, 'win'); P.sound('ok');
      card('完', st.title, '最後まで読んでくれて、ありがとうございました。', [['物語をえらぶ', 'primary', open], ['最初から読む', 'lac', () => openReader(st, 0)]]);
      return;
    }
    if (opened(st.id) > RD.part) {
      card('つづき', st.parts[RD.part + 1].title, '', [['続きを読む', 'primary', () => { RD.part++; RD.line = 0; showLine(); }], ['もどる', 'lac', open]]);
      return;
    }
    gate();
  }
  function unlockNext() {
    S.solo.open[RD.story.id] = Math.max(opened(RD.story.id), RD.part + 1); P.save();
  }
  function gate() {
    const expert = S.solo.mode === 'expert';
    const back = () => { P.showScreen('reader'); gate(); };
    if (expert) {
      const lv = S.solo.bot;
      card('続きを読むには', `ミッション：Bot ${P.RANKS[lv]}に勝つ`, '9路・5分＋1手5秒・コミ7目。勝てば次の幕が読めます。レートは変わりません。', [
        ['対局する', 'primary', () => startGame(lv, back)], ['あとで', 'lac', open]
      ]);
    } else {
      // 新しいレクチャーと実戦ドリルを交互に（レクチャーを全部クリアしたらドリルだけ）
      const nl = nextLesson();
      const l = nl && RD.part % 2 === 0 ? nl : makeDrill();
      const desc = l.drill ? '自動で選ばれる3問に正解しよう。' : `${l.teacher === '玄斎' ? '玄斎' : '小春'}のレクチャーを聞いて、実戦問題に正解しよう。`;
      card('続きを読むには', `ミッション：${l.title}`, desc, [
        ['レクチャーを受ける', 'primary', () => runLesson(l, ok => { if (ok) { unlockNext(); resumeNext(); } else back(); })], ['あとで', 'lac', open]
      ]);
    }
  }
  function resumeNext() { P.showScreen('reader'); RD.part++; RD.line = 0; showLine(); }
  function startGame(lv, back) {
    P.jissen(`Bot ${P.RANKS[lv]}に勝て`, () => P.startSoloGame(lv, {
      done: (cleared) => { if (cleared) { unlockNext(); resumeNext(); } else startGame(lv, back); },
      back
    }));
  }
  $('#rdBox').addEventListener('click', advance);
  $('#rdBox').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); advance(); } });
  $('#rdStage').addEventListener('click', e => { if (e.target.closest('#rdCard')) return; advance(); });
  $('#rdBack').onclick = () => { clearInterval(typeT); open(); };
  // この幕の残りをとばして、幕の終わり（ミッション）へ
  $('#rdSkip').onclick = e => { e.stopPropagation(); if (!RD || !$('#rdCard').hidden) return; clearInterval(typeT); RD.typing = false; P.sound('tap'); endOfPart(); };

  /* ================= レクチャー ================= */
  const TS = window.Tsume;
  let LS = null;
  const voice = {
    '小春': { wrong: 'うーん、そこじゃないみたい。', retry: 'おしい！ もう一度考えてみて。', illegal: 'そこには打てないみたい。', kou: 'コウだから、すぐには取り返せないよ。', escape: '白に逃げられちゃいました……。', dead: 'そこだと、白に取られちゃいます。', next: 'いいね、その調子！', cont: '白が逃げました。続けて！' },
    '玄斎': { wrong: '違うな。もう一回だ。', retry: '惜しい。もう一度読め。', illegal: 'そこには打てねえ。', kou: 'コウだ。すぐには取り返せねえ。', escape: '白に逃げられた。やり直しだ。', dead: 'それだと取られちまう。', next: 'そうだ、その調子。', cont: '白が逃げた。続けてアタリだ。' }
  };
  const V = who => voice[who] || voice['小春'];
  function runLesson(lesson, onDone) {
    LS = { l: lesson, onDone, phase: 'talk', i: 0, pi: 0, board: new Array(81).fill(0), ko: -1, marks: [], last: -1, lock: false, solved: false };
    P.showScreen('lesson');
    $('#lsTitle').textContent = lesson.drill ? lesson.title : 'レクチャー：' + lesson.title;
    $('#lsChoices').hidden = true;
    talkStep();
  }
  const whoOf = pr => pr.who || LS.l.teacher;
  function say(who, text, mood) {
    P.setImg($('#lsFace'), faceOf(who));
    const nm = $('#lsName'); nm.textContent = who; nm.className = 'rd-name ' + nameClass(who);
    $('#lsText').textContent = text;
    const bb = document.querySelector('.ls-bubble');
    bb.classList.remove('ok', 'ng'); void bb.offsetWidth;
    if (mood) bb.classList.add(mood);
  }
  function drawLesson() {
    const svg = $('#lboard');
    let s = '';
    for (let p = 0; p < 81; p++) {
      const v = LS.board[p]; if (!v) continue;
      const x = p % 9 + .5, y = ((p / 9) | 0) + .5;
      s += `<g class="stone${p === LS.drop ? ' drop' : ''}"><circle cx="${x + .04}" cy="${y + .06}" r=".46" fill="#000" opacity=".28"/><circle cx="${x}" cy="${y}" r=".46" fill="url(#g${v === 1 ? 'B' : 'W'})"/></g>`;
    }
    svg.querySelector('.stones').innerHTML = s; LS.drop = -1;
    let m = '';
    for (const p of LS.marks) {
      const x = p % 9 + .5, y = ((p / 9) | 0) + .5;
      m += `<circle cx="${x}" cy="${y}" r=".3" fill="#e0503e" opacity=".28"/><circle cx="${x}" cy="${y}" r=".3" fill="none" stroke="#e0503e" stroke-width=".06" stroke-dasharray=".12 .08"/>`;
    }
    if (LS.last >= 0 && LS.board[LS.last]) {
      const x = LS.last % 9 + .5, y = ((LS.last / 9) | 0) + .5;
      m += `<circle cx="${x}" cy="${y}" r=".17" fill="none" stroke="${LS.board[LS.last] === 1 ? '#fff3dc' : '#e0503e'}" stroke-width=".07"/>`;
    }
    svg.querySelector('.marks').innerHTML = m;
  }
  function buttons(next, hint, retry, nextLabel) {
    $('#lsNext').hidden = !next; $('#lsNext').textContent = nextLabel || '次へ';
    $('#lsHint').hidden = !hint; $('#lsRetry').hidden = !retry;
  }
  function talkStep() {
    const t = LS.l.talk[LS.i];
    $('#lsStep').textContent = `説明 ${LS.i + 1}/${LS.l.talk.length}`;
    if (t.board) { LS.board = parse(t.board); LS.last = -1; }
    LS.marks = (t.marks || []).map(pt);
    drawLesson();
    say(t.who, t.text);
    buttons(true, false, false, LS.i < LS.l.talk.length - 1 ? '次へ' : '実戦問題へ');
    $('#lsSkip').hidden = LS.i >= LS.l.talk.length - 1;
  }
  function probStep() {
    $('#lsSkip').hidden = true;
    if (LS.missPi !== LS.pi) { LS.miss = false; LS.missPi = LS.pi; }   // やり直しではミスを消さない
    const pr = LS.l.problems[LS.pi];
    $('#lsStep').textContent = `実戦問題 ${LS.pi + 1}/${LS.l.problems.length}`;
    LS.board = pr.board ? parse(pr.board) : new Array(81).fill(0);
    LS.ko = -1; LS.last = -1; LS.marks = []; LS.step = 0; LS.solved = false; LS.lock = false; LS.used = 0;
    drawLesson();
    say(whoOf(pr), pr.text);
    const ch = $('#lsChoices'); ch.innerHTML = '';
    if (pr.type === 'choice') {
      ch.hidden = false;
      pr.choices.forEach((c, i) => {
        const b = document.createElement('button'); b.className = 'btn lac'; b.type = 'button'; b.textContent = c;
        b.onclick = () => choose(i, b);
        ch.append(b);
      });
      buttons(false, true, false);
    } else { ch.hidden = true; buttons(false, true, true); }
  }
  function choose(i, btn) {
    if (!LS || LS.solved || LS.lock) return;
    const pr = LS.l.problems[LS.pi];
    if (i === pr.answer) { btn.classList.add('right'); solved(pr.good); }
    else {
      btn.classList.add('wrongc'); setTimeout(() => btn.classList.remove('wrongc'), 600);
      wrong(V(whoOf(pr)).wrong + (pr.hint ? ' ' + pr.hint : ''));
    }
  }
  function place(p, c) {
    const r = E.play(LS.board, p, c, LS.ko);
    if (!r) return null;
    LS.board = r.board; LS.ko = r.ko; LS.last = p; LS.drop = p;
    drawLesson();
    P.sound(r.cap.length ? 'cap' : 'stone');
    P.stoneFx($('#lboard'), p, c, $('#lsWrap'));
    return r;
  }
  function solved(msg) {
    const pr = LS.l.problems[LS.pi];
    LS.solved = true; LS.lock = true;
    say(pr.goodWho || whoOf(pr), msg, 'ok');
    if (LS.l.drill && pr.drillId) {
      const st = drillState(), before = drillLv();
      if (!st.seen.includes(pr.drillId)) st.seen.push(pr.drillId);
      if (!LS.miss) st.pts++;
      P.save();
      const after = drillLv();
      if (after > before) setTimeout(() => { if (LS) say('小春', `レベルアップ！ 次は Lv.${after}「${LV_NAME[after]}」です。`, 'ok'); }, 1100);
    }
    P.sound('ok');
    const r = $('#lsWrap').getBoundingClientRect(); A.burst(r.left + r.width / 2, r.top + r.height / 2, 'win');
    buttons(true, false, false, LS.pi < LS.l.problems.length - 1 ? '次の問題へ' : 'クリア！');
  }
  function wrong(msg, revert, delay) {
    LS.lock = true; LS.miss = true;
    say(whoOf(LS.l.problems[LS.pi]), msg, 'ng');
    P.sound('bad');
    setTimeout(() => { if (!LS) return; if (revert) revert(); LS.lock = false; drawLesson(); }, delay || 900);
  }
  function tapLesson(p) {
    if (!LS || LS.phase !== 'prob' || LS.lock || LS.solved) return;
    const pr = LS.l.problems[LS.pi], v = V(whoOf(pr));
    if (pr.type === 'choice') return;
    if (LS.board[p]) return;
    if (!E.play(LS.board, p, 1, LS.ko)) {
      const [x, y] = P.pointXY($('#lboard'), p); A.burst(x, y, 'bad');
      wrong(p === LS.ko ? v.kou : v.illegal);
      return;
    }
    const before = { b: LS.board.slice(), ko: LS.ko, last: LS.last, used: LS.used };
    const revert = () => { LS.board = before.b; LS.ko = before.ko; LS.last = before.last; LS.used = before.used; };
    const name = COLS[p % 9] + (9 - ((p / 9) | 0));
    if (pr.type === 'point') {
      place(p, 1);
      if (pr.ok.map(pt).includes(p)) solved(pr.good);
      else wrong(((pr.near && pr.near[name]) || v.wrong) + (pr.hint && !(pr.near && pr.near[name]) ? ' ' + pr.hint : ''), revert, pr.near && pr.near[name] ? 1600 : 900);
      return;
    }
    if (pr.type === 'seq') {
      const st = pr.steps[LS.step];
      place(p, 1);
      if (!st.ok.map(pt).includes(p)) { wrong(v.retry + (pr.hint ? ' ' + pr.hint : ''), revert); return; }
      LS.step++;
      if (LS.step >= pr.steps.length) { solved(pr.good); return; }
      LS.lock = true;
      setTimeout(() => { if (!LS) return; if (st.reply) place(pt(st.reply), 2); say(whoOf(pr), st.say || v.next); LS.lock = false; }, 650);
      return;
    }
    const target = pt(pr.target), depth = pr.depth || 9, net = !!pr.net;
    if (pr.type === 'capture') {
      place(p, 1); LS.used++;
      if (!LS.board[target]) { solved(pr.good); return; }
      const left = Math.max(1, depth - (LS.used * 2 - 1));
      if (!TS.canCapture(LS.board, LS.ko, target, 1, 2, left, net)) { wrong(v.escape + ' ' + (pr.hint || ''), () => { LS.board = parse(pr.board); LS.ko = -1; LS.last = -1; LS.used = 0; }, 1800); return; }
      LS.lock = true;
      setTimeout(() => {
        if (!LS) return;
        const d = TS.bestDefense(LS.board, LS.ko, target, 1, left, net);
        if (d !== null && d !== undefined) place(d, 2);
        say(whoOf(pr), v.cont);
        LS.lock = false;
      }, 520);
      return;
    }
    if (pr.type === 'save') {
      place(p, 1);
      if (!LS.board[target]) { wrong(v.dead, revert); return; }
      if (TS.canCapture(LS.board, LS.ko, target, 2, 2, depth, net)) { wrong(v.dead + ' ' + (pr.hint || ''), revert, 1500); return; }
      solved(pr.good);
    }
  }
  $('#lboard').addEventListener('click', e => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = Math.floor(((e.clientX - r.left) / r.width * 9.3) - 0.15);
    const y = Math.floor(((e.clientY - r.top) / r.height * 9.3) - 0.15);
    if (x < 0 || x > 8 || y < 0 || y > 8) return;
    tapLesson(y * 9 + x);
  });
  $('#lsNext').onclick = () => {
    if (!LS) return;
    if (LS.phase === 'talk') {
      if (LS.i < LS.l.talk.length - 1) { LS.i++; talkStep(); }
      else toProblems();
      return;
    }
    if (LS.phase === 'prob' && LS.solved) {
      if (LS.pi < LS.l.problems.length - 1) { LS.pi++; probStep(); return; }
      if (!LS.l.drill && !S.solo.lessons.includes(LS.l.id)) S.solo.lessons.push(LS.l.id);
      P.save();
      const done = LS.onDone; LS = null;
      done(true);
    }
  };
  function toProblems() {
    LS.phase = 'prob'; LS.pi = 0; LS.lock = true; $('#lsSkip').hidden = true;
    P.jissen(`${LS.l.title}・全${LS.l.problems.length}問`, () => { if (LS) probStep(); });
  }
  // 説明をとばして実戦問題へ
  $('#lsSkip').onclick = () => { if (LS && LS.phase === 'talk') { P.sound('tap'); toProblems(); } };
  $('#lsHint').onclick = () => { if (LS && LS.phase === 'prob') { const pr = LS.l.problems[LS.pi]; say(whoOf(pr), pr.hint || 'よく見てみて！'); } };
  $('#lsRetry').onclick = () => { if (LS && LS.phase === 'prob') probStep(); };
  $('#lsBack').onclick = () => { if (!LS) return; const done = LS.onDone; LS = null; done(false); };

  window.SOLO = { open };
})();
