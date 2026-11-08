/* 九路 Blitz — ソロモード（脚本を読む・ミッション・レクチャー） */
(() => {
  'use strict';
  const P = window.APP, E = P.E, A = P.A, S = P.S;
  const $ = s => document.querySelector(s);
  const STORIES = window.STORIES || [], LESSONS = window.LESSONS || [];
  const COLS = 'ABCDEFGHJ';
  const pt = s => COLS.indexOf(s[0]) + (9 - (+s.slice(1))) * 9;
  const parse = rows => { const b = []; for (const r of rows) for (const ch of r) b.push(ch === 'X' ? 1 : ch === 'O' ? 2 : 0); return b; };
  const faceOf = who => A.charaUri(who === '玄斎' ? 4 : 0);
  const nameClass = who => who === '小春' ? '' : who === '玄斎' ? 'gensai' : 'other';
  const opened = id => S.solo.open[id] || 0;               // 読める幕の最後（0 = 第一幕だけ）
  const nextLesson = () => LESSONS.find(l => !S.solo.lessons.includes(l.id));

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
    for (const st of STORIES) {
      const n = st.parts.length, op = opened(st.id), done = S.solo.read && S.solo.read[st.id];
      const b = document.createElement('button'); b.className = 'story'; b.type = 'button';
      b.innerHTML = `<b></b><span class="pips">${st.parts.map((_, i) => `<i class="${i <= op ? 'on' : ''}"></i>`).join('')}</span><small></small><span class="st-state"></span>`;
      b.querySelector('b').textContent = st.title;
      b.querySelector('small').textContent = st.sub;
      b.querySelector('.st-state').textContent = done ? '読了・もう一度読めます' : `${st.parts[Math.min(op, n - 1)].title.split(/\s|　/)[0]}まで読めます`;
      b.onclick = () => openReader(st, Math.min(op, n - 1));
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
  }
  $('#soloBeginner').onclick = () => { S.solo.mode = 'beginner'; P.save(); renderTop(); };
  $('#soloExpert').onclick = () => { S.solo.mode = 'expert'; P.save(); renderTop(); };
  $('#soloBot').addEventListener('change', e => { S.solo.bot = +e.target.value; P.save(); });
  $('#soloBack').onclick = () => { P.showScreen('home'); P.renderHome(); };

  /* ================= 脚本を読む ================= */
  let RD = null, typeT = 0;
  function openReader(story, part) {
    RD = { story, part, line: 0, typing: false };
    P.showScreen('reader');
    $('#rdStory').textContent = story.title;
    showLine();
  }
  function showLine() {
    const part = RD.story.parts[RD.part];
    $('#rdPart').textContent = part.title;
    $('#rdCard').hidden = true; $('#rdBox').hidden = false;
    const [who, text] = part.lines[RD.line];
    const nm = $('#rdName'); nm.textContent = who; nm.className = 'rd-name ' + nameClass(who);
    const tx = $('#rdText'); tx.className = 'rd-text' + (who ? '' : ' narr');
    $('#rdCount').textContent = `${RD.line + 1}/${part.lines.length}`;
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
  function card(kicker, title, desc, buttons) {
    $('#rdBox').hidden = true;
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
      const l = nextLesson() || LESSONS[(Math.random() * LESSONS.length) | 0];
      const review = S.solo.lessons.includes(l.id);
      card('続きを読むには', `ミッション：${l.title}`, `${l.teacher === '玄斎' ? '玄斎' : '小春'}のレクチャーを聞いて、実戦問題に正解しよう。${review ? '（復習）' : ''}`, [
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
    $('#lsTitle').textContent = 'レクチャー：' + lesson.title;
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
  }
  function probStep() {
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
    say(whoOf(pr), msg, 'ok');
    P.sound('ok');
    const r = $('#lsWrap').getBoundingClientRect(); A.burst(r.left + r.width / 2, r.top + r.height / 2, 'win');
    buttons(true, false, false, LS.pi < LS.l.problems.length - 1 ? '次の問題へ' : 'クリア！');
  }
  function wrong(msg, revert, delay) {
    LS.lock = true;
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
      else {
        LS.phase = 'prob'; LS.pi = 0; LS.lock = true;
        P.jissen(`${LS.l.title}・全${LS.l.problems.length}問`, () => { if (LS) probStep(); });
      }
      return;
    }
    if (LS.phase === 'prob' && LS.solved) {
      if (LS.pi < LS.l.problems.length - 1) { LS.pi++; probStep(); return; }
      if (!S.solo.lessons.includes(LS.l.id)) S.solo.lessons.push(LS.l.id);
      P.save();
      const done = LS.onDone; LS = null;
      done(true);
    }
  };
  $('#lsHint').onclick = () => { if (LS && LS.phase === 'prob') { const pr = LS.l.problems[LS.pi]; say(whoOf(pr), pr.hint || 'よく見てみて！'); } };
  $('#lsRetry').onclick = () => { if (LS && LS.phase === 'prob') probStep(); };
  $('#lsBack').onclick = () => { if (!LS) return; const done = LS.onDone; LS = null; done(false); };

  window.SOLO = { open };
})();
