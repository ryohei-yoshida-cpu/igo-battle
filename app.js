/* 九路 Blitz — 画面・対局進行・レート管理 */
(() => {
  'use strict';
  const E = window.GoEngine;
  const $ = s => document.querySelector(s);
  const KOMI = 7; // 同点は持碁（引き分け）
  const MAIN_MS = 5 * 60 * 1000, INC_MS = 5000;
  const NET_LIMIT = 180; // 秒
  const MATCH_SEARCH_MS = 8000;

  /* ---------- 段級とレート（囲碁クエスト9路の基準） ---------- */
  const RANKS = ['10級', '9級', '8級', '7級', '6級', '5級', '4級', '3級', '2級', '1級', '初段', '二段', '三段', '四段'];
  const TH = [1050, 1100, 1150, 1200, 1250, 1300, 1350, 1400, 1500, 1600, 1700, 1800, 1900, 2000];
  const DAN_FROM = 10;      // 初段の index
  const BOT_MAX = 9;        // Botは1級まで
  const DAN_STREAK = 4;     // 昇段に必要な連勝数
  const START_RATE = 1050;
  const rankFromRating = r => { let i = 0; for (let k = 0; k < TH.length; k++) if (r >= TH[k]) i = k; return i; };
  const botRating = i => i < TH.length - 1 ? Math.round((TH[i] + TH[i + 1]) / 2) : TH[i] + 50;
  const kFactor = games => games < 20 ? 32 : 16;
  function eloDelta(my, op, score, games) {
    const exp = 1 / (1 + Math.pow(10, (op - my) / 400));
    let d = Math.round(kFactor(games) * (score - exp));
    if (d === 0 && score !== 0.5) d = score ? 1 : -1;
    return d;
  }

  /* ---------- 保存データ ---------- */
  const KEY = 'kuro9.v1';
  const A = window.ART;
  function fresh() {
    return {
      name: 'あなた', avatar: { type: 'preset', id: 0 },
      rating: START_RATE, games: 0, wins: 0, draws: 0, streak: 0, earnedDan: -1,
      bw: { bw: 0, bl: 0, ww: 0, wl: 0 }, history: [],
      settings: { confirm: true, fx: true, sound: true, board: 'kaya' }, botLevel: 'auto', noBot: false,
      solo: { mode: 'beginner', bot: 3, open: {}, lessons: [] }
    };
  }
  let S = fresh();
  try { const raw = localStorage.getItem(KEY); if (raw) S = Object.assign(fresh(), JSON.parse(raw)); } catch (e) {}
  S.settings = Object.assign({ confirm: true, fx: true, sound: true, board: 'kaya' }, S.settings);
  if (S.settings.board !== 'washi') S.settings.board = 'kaya';
  S.solo = Object.assign({ mode: 'beginner', bot: 3, open: {}, lessons: [] }, S.solo);
  if (S.avatar.type === 'preset') S.avatar.id = ((S.avatar.id | 0) % A.VARIANTS.length + A.VARIANTS.length) % A.VARIANTS.length;
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };

  function displayRank() {
    const r = rankFromRating(S.rating);
    if (r < DAN_FROM) return r;
    return Math.max(DAN_FROM - 1, Math.min(r, S.earnedDan));
  }

  /* ---------- 効果音 ---------- */
  let actx = null;
  function sound(kind) {
    if (!S.settings.sound) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === 'suspended') actx.resume();
      const t = actx.currentTime, out = actx.destination;
      const noise = (len, freq, q, gain, decay) => {
        const buf = actx.createBuffer(1, Math.max(1, actx.sampleRate * len | 0), actx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, decay);
        const src = actx.createBufferSource(); src.buffer = buf;
        const f = actx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
        const g = actx.createGain(); g.gain.value = gain;
        src.connect(f).connect(g).connect(out); src.start(t);
      };
      const tone = (freq, len, gain, type, slide) => {
        const o = actx.createOscillator(), g = actx.createGain();
        o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t);
        if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + len);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
        o.connect(g).connect(out); o.start(t); o.stop(t + len + 0.02);
      };
      if (kind === 'tap') { tone(1568, 0.16, 0.05); tone(2349, 0.12, 0.025); return; }
      if (kind === 'bad') { tone(330, 0.12, 0.06, 'triangle', 220); return; }
      if (kind === 'ok') { tone(784, 0.18, 0.07); setTimeout(() => sound('ok2'), 90); return; }
      if (kind === 'ok2') { tone(1175, 0.3, 0.07); tone(1568, 0.3, 0.035); return; }
      // 石の音：硬いカチッ＋盤の響き
      noise(0.05, 3200, 1.4, 0.9, 7);
      noise(0.09, 1300, 0.9, 0.45, 4);
      tone(190, 0.14, 0.22, 'sine', 120);
      if (kind === 'cap') { setTimeout(() => { try { noise(0.04, 2600, 1.2, 0.5, 6); noise(0.04, 2900, 1.2, 0.4, 6); } catch (e) {} }, 70); }
    } catch (e) {}
  }
  const buzz = ms => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} };

  /* ---------- bot（Web Worker） ---------- */
  let worker = null, reqId = 0;
  const pending = new Map();
  try {
    worker = new Worker('engine.js');
    worker.onmessage = e => { const cb = pending.get(e.data.id); if (cb) { pending.delete(e.data.id); cb(e.data); } };
    worker.onerror = () => { worker = null; };
  } catch (e) { worker = null; }
  function ask(msg) {
    return new Promise(res => {
      if (worker) { const id = ++reqId; pending.set(id, res); worker.postMessage(Object.assign({ id }, msg)); }
      else setTimeout(() => res(msg.type === 'think' ? E.think(msg) : msg.type === 'analyze' ? E.analyze(msg) : { own: E.ownership(msg.board, msg.n || 400) }), 30);
    });
  }

  /* ---------- アバター・キャラ ---------- */
  const charaIdx = () => S.avatar.type === 'preset' ? S.avatar.id : 0;
  const myCharaSrc = () => A.charaUri(charaIdx());
  const rivalSrc = () => A.charaUri(A.rivalOf(charaIdx()));
  const rivalName = () => A.VARIANTS[A.rivalOf(charaIdx())].kind === 'gensai' ? '玄斎' : '小春';
  const myAvatarSrc = () => (S.avatar.type === 'img' && S.avatar.data) ? S.avatar.data : myCharaSrc();
  const setImg = (el, src) => { if (el.getAttribute('src') !== src) el.src = src; };
  function applyBoardStyle() { document.body.classList.toggle('washi', S.settings.board === 'washi'); }

  // 人の手番中にBotが先読みする（Botの1手は5秒以内）
  function ponder() {
    if (!worker || !G || G.over || G.toPlay !== G.me) return;
    worker.postMessage({ type: 'ponder', board: G.board, toPlay: G.toPlay, ko: G.ko, komi: KOMI, last: G.last, level: G.bot.level });
  }
  function stopPonder() { if (worker) worker.postMessage({ type: 'stop' }); }

  /* ---------- 盤の静的部分 ---------- */
  function drawGrid(g) {
    let s = '';
    for (let i = 0; i < 9; i++) {
      const v = i + 0.5, edge = i === 0 || i === 8, w = edge ? 0.05 : 0.026;
      s += `<line class="gl" x1="0.5" y1="${v}" x2="8.5" y2="${v}" stroke-width="${w}"/><line class="gl" x1="${v}" y1="0.5" x2="${v}" y2="8.5" stroke-width="${w}"/>`;
    }
    for (const [x, y] of [[2, 2], [6, 2], [2, 6], [6, 6], [4, 4]]) s += `<circle class="hoshi" cx="${x + .5}" cy="${y + .5}" r=".09"/>`;
    g.innerHTML = s;
  }
  document.querySelectorAll('svg .grid').forEach(drawGrid);
  // 盤上の点 → 画面座標
  function pointXY(svg, p) {
    const r = svg.getBoundingClientRect();
    return [r.left + (p % 9 + .65) / 9.3 * r.width, r.top + (((p / 9) | 0) + .65) / 9.3 * r.height];
  }
  function stoneFx(svg, p, color, wrap) {
    const [x, y] = pointXY(svg, p);
    A.burst(x, y, color === 1 ? 'black' : 'white');
    if (wrap) { wrap.classList.remove('thump'); void wrap.offsetWidth; wrap.classList.add('thump'); }
    buzz(12);
  }

  /* ---------- 技の判定 ---------- */
  function techOf(prev, next, p, c, cap, ko, moveNo) {
    const o = 3 - c, nb = E.NB[p], dg = E.DG[p];
    const nbOwn = nb.filter(q => prev[q] === c), nbOpp = nb.filter(q => prev[q] === o), dgOwn = dg.filter(q => prev[q] === c);
    const gid = (b, q) => Math.min(...E.group(b, q).stones);
    if (cap.length) {
      if (ko >= 0) return ['コウ取り', 2];
      if (cap.length >= 5) return ['大石取り', 2];
      if (cap.length === 1 && E.NB[cap[0]].every(r => next[r] === c)) return ['ポン抜き', 2];
      return [cap.length + '子抜き', 2];
    }
    let atari = 0;
    const seen = new Set();
    for (const q of nb) if (next[q] === o) { const id = gid(next, q); if (!seen.has(id)) { seen.add(id); if (E.group(next, q).libs.length === 1) atari++; } }
    if (atari >= 2) return ['両アタリ', 2];
    if (atari === 1) return ['アタリ', 2];
    if (nbOwn.length >= 2 && new Set(nbOwn.map(q => gid(prev, q))).size >= 2) return ['ツナギ', 1];
    if (nbOpp.length >= 2 && new Set(nbOpp.map(q => gid(next, q))).size >= 2) return ['キリ', 1];
    for (const d of dgOwn) {
      const com = nb.filter(q => E.NB[d].includes(q));
      if (com.some(q => prev[q] === o) && nbOpp.length) return ['ハネ', 1];
    }
    if (nbOpp.length && !nbOwn.length) return dgOwn.length ? ['コスミツケ', 1] : ['ツケ', 1];
    if (nbOwn.length === 1 && !nbOpp.length && E.NB[nbOwn[0]].some(r => prev[r] === o)) return ['ノビ', 1];
    const x = p % 9, y = (p / 9) | 0;
    const at = (dx, dy) => { const X = x + dx, Y = y + dy; return X >= 0 && X < 9 && Y >= 0 && Y < 9 ? prev[Y * 9 + X] : -1; };
    if (!nbOwn.length && dgOwn.length) {
      for (const d of dgOwn) { const com = nb.filter(q => E.NB[d].includes(q)); if (com.every(q => prev[q] === 0)) return ['コスミ', 1]; }
    }
    if (!nbOwn.length && !dgOwn.length) {
      for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) if (at(dx, dy) === c && at(dx / 2, dy / 2) === 0) return ['一間トビ', 1];
      for (const [dx, dy] of [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]]) if (at(dx, dy) === c) return ['ケイマ', 1];
      for (const [dx, dy] of [[1, 3], [3, 1], [-1, 3], [-3, 1], [1, -3], [3, -1], [-1, -3], [-3, -1]]) if (at(dx, dy) === c) return ['大ゲイマ', 1];
      for (const [dx, dy] of [[3, 0], [-3, 0], [0, 3], [0, -3]]) if (at(dx, dy) === c && at(dx / 3, dy / 3) === 0 && at(dx * 2 / 3, dy * 2 / 3) === 0) return ['二間トビ', 1];
    }
    if (moveNo <= 4) {
      const lo = v => Math.min(v, 8 - v), a = lo(x), b = lo(y);
      if (x === 4 && y === 4) return ['天元', 1];
      if (a === 2 && b === 2) return ['星', 1];
      if ((a === 2 && b === 3) || (a === 3 && b === 2)) return ['小目', 1];
      if (a === 3 && b === 3) return ['高目', 1];
    }
    return null;
  }

  /* ---------- エフェクト ---------- */
  // 着手点の波紋と、キャラ付きの技カットイン
  function fx(name, tier, p, mine) {
    if (!S.settings.fx) return;
    const x = p % 9, y = (p / 9) | 0;
    const ring = document.createElement('div');
    ring.className = `ring t${tier} ${mine ? 'me' : 'op'}`;
    ring.style.left = ((x + 0.65) / 9.3 * 100) + '%';
    ring.style.top = ((y + 0.65) / 9.3 * 100) + '%';
    $('#fxLayer').querySelectorAll('.fxBanner').forEach(n => n.remove());
    $('#fxLayer').append(ring);
    setTimeout(() => ring.remove(), 1000);
    // 打った石が隠れないよう、盤の反対側の半分に帯を出す
    const r = $('#boardWrap').getBoundingClientRect();
    const cy = r.top + r.height * (y >= 4 ? 0.27 : 0.73);
    const layer = $('#cutin');
    layer.innerHTML = '';
    const el = document.createElement('div');
    el.className = `cut t${tier} ${mine ? 'me' : 'op'}`;
    el.style.setProperty('--y', cy + 'px');
    el.innerHTML = `${tier === 2 ? '<div class="flash"></div>' : ''}<div class="band"></div><img class="chara" alt=""><div class="name"></div>`;
    el.querySelector('.chara').src = mine ? myCharaSrc() : rivalSrc();
    el.querySelector('.name').textContent = name;
    layer.append(el);
    if (tier === 2) { const bw = $('#boardWrap'); bw.classList.remove('shake'); void bw.offsetWidth; bw.classList.add('shake'); }
    setTimeout(() => el.remove(), tier === 2 ? 1400 : 1000);
  }
  function banner(big, small) {
    const layer = $('#fxLayer');
    const el = document.createElement('div');
    el.className = 'fxBanner';
    el.innerHTML = `<b></b><span></span>`;
    el.querySelector('b').textContent = big; el.querySelector('span').textContent = small || '';
    layer.append(el);
    setTimeout(() => el.remove(), 1700);
  }

  /* ---------- トースト・確認 ---------- */
  let toastT = 0;
  function toast(msg, ms = 2800) {
    const t = $('#toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, ms);
  }
  function confirmBox(text, yes) {
    $('#cfText').textContent = text; $('#confirm').hidden = false;
    $('#cfYes').onclick = () => { $('#confirm').hidden = true; yes(); };
    $('#cfNo').onclick = () => { $('#confirm').hidden = true; };
  }

  /* ---------- ホーム描画 ---------- */
  function renderHome() {
    setImg($('#heroChara'), myCharaSrc());
    $('#homeName').textContent = S.name;
    const dr = displayRank();
    $('#homeRank').textContent = RANKS[dr];
    $('#homeRate').textContent = S.rating;
    const rr = rankFromRating(S.rating);
    let next = '';
    if (rr >= TH.length - 1 && dr === rr) { $('#rankBar').style.width = '100%'; next = '最高段位です'; }
    else if (dr < rr) { $('#rankBar').style.width = '100%'; next = `昇段まであと ${Math.max(0, DAN_STREAK - S.streak)} 連勝（${RANKS[rr]}のレートに到達済み）`; }
    else {
      const lo = TH[rr], hi = TH[rr + 1];
      $('#rankBar').style.width = Math.max(0, Math.min(100, (S.rating - lo) / (hi - lo) * 100)) + '%';
      next = `${RANKS[rr + 1]}まで あと ${hi - S.rating}` + (rr + 1 >= DAN_FROM ? `（${DAN_STREAK}連勝も必要）` : '');
      if (S.rating < TH[0]) next = `10級の基準 ${TH[0]} を下回っています`;
    }
    $('#rankNext').textContent = next;
    $('#stGames').textContent = S.games;
    $('#stWin').textContent = S.games ? Math.round(S.wins / S.games * 100) + '%' : '—';
    $('#stStreak').textContent = S.streak;
    $('#stBlack').textContent = `${S.bw.bw}-${S.bw.bl}`;
    $('#stWhite').textContent = `${S.bw.ww}-${S.bw.wl}`;
    const ol = $('#history'); ol.innerHTML = '';
    if (!S.history.length) {
      const li = document.createElement('li'); li.className = 'empty';
      li.textContent = 'まだ対局がありません。ランダムマッチで一局打ってみましょう。';
      ol.append(li);
    }
    for (const h of S.history.slice(0, 15)) {
      const li = document.createElement('li');
      const hk = h.draw ? ['d', '持'] : h.win ? ['w', '勝'] : ['l', '負'];
      if (h.rec) { li.className = 'rec'; li.title = 'タップで検討'; li.onclick = () => openReview(h.rec); }
      li.innerHTML = `<span class="hk ${hk[0]}">${hk[1]}</span><span class="hn"></span><span class="hr"></span><span class="hd ${h.delta >= 0 ? 'up' : 'down'}">${h.delta >= 0 ? '+' : ''}${h.delta}</span>`;
      li.querySelector('.hn').textContent = h.op; const sm = document.createElement('small'); sm.textContent = h.color === 1 ? '黒番' : '白番'; li.querySelector('.hn').append(sm);
      li.querySelector('.hr').textContent = h.reason;
      ol.append(li);
    }
  }

  /* ---------- 画面の切り替え ---------- */
  const SCREENS = ['home', 'game', 'solo', 'reader', 'lesson'];
  function showScreen(id) {
    for (const k of SCREENS) $('#' + k).hidden = k !== id;
    A.setPetals(id === 'game' || id === 'lesson' ? 5 : id === 'reader' ? 14 : 10);
  }

  /* ---------- 対局 ---------- */
  let G = null, gameSeq = 0, R = null;
  const clockOf = c => G.clock[c] - (G.toPlay === c && !G.over ? performance.now() - G.turnStart : 0);
  const fmt = ms => { ms = Math.max(0, ms); const s = Math.ceil(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

  function newGame(bot, myColor, opts) {
    opts = opts || {};
    gameSeq++;
    G = {
      id: gameSeq, board: new Array(81).fill(0), toPlay: 1, ko: -1, me: myColor, bot,
      caps: { 1: 0, 2: 0 }, clock: { 1: MAIN_MS, 2: MAIN_MS }, turnStart: performance.now(),
      passes: 0, moveNo: 0, last: -1, over: false, record: [], solo: opts.solo || null, pend: -1, thinking: false, net: null, final: null, lastDrop: -1
    };
    if (!G.solo) { try { localStorage.setItem(KEY + '.active', JSON.stringify({ op: bot.rating, color: myColor, name: bot.name })); } catch (e) {} }
    showScreen('game'); setMode('play');
    setImg($('#meAvatar'), myAvatarSrc()); $('#meName').textContent = S.name; $('#meRank').textContent = `${RANKS[displayRank()]} ${S.rating}`;
    setImg($('#opAvatar'), rivalSrc()); $('#opName').textContent = `${rivalName()}（${bot.name}）`; $('#opRank').textContent = `${RANKS[bot.level]} ${bot.rating}`;
    $('#meStone').className = 'mini-stone ' + (myColor === 1 ? 'b' : 'w');
    $('#opStone').className = 'mini-stone ' + (myColor === 1 ? 'w' : 'b');
    $('#passBtn').disabled = false; $('#resignBtn').disabled = false; $('#resignBtn').textContent = '投了';
    render();
    banner('お願いします', myColor === 1 ? 'あなたは黒番・先手' : 'あなたは白番');
    if (navigator.wakeLock) navigator.wakeLock.request('screen').then(l => { G && (G.wake = l); }).catch(() => {});
    if (!navigator.onLine) netDown();
    stopPonder();
    nextTurn();
    ponder();
  }

  function render() {
    const st = $('#stones'), mk = $('#marks'), tr = $('#terr');
    let s = '';
    const deadSet = G.final ? new Set(G.final.dead) : null;
    for (let p = 0; p < 81; p++) {
      const v = G.board[p]; if (!v) continue;
      const x = p % 9 + 0.5, y = ((p / 9) | 0) + 0.5;
      const cls = 'stone' + (p === G.lastDrop ? ' drop' : '') + (deadSet && deadSet.has(p) ? ' dead' : '');
      s += `<g class="${cls}"><circle cx="${x + .04}" cy="${y + .06}" r=".46" fill="#000" opacity=".28"/><circle cx="${x}" cy="${y}" r=".46" fill="url(#g${v === 1 ? 'B' : 'W'})"/></g>`;
    }
    if (G.pend >= 0 && !G.board[G.pend]) {
      const x = G.pend % 9 + 0.5, y = ((G.pend / 9) | 0) + 0.5;
      s += `<circle cx="${x}" cy="${y}" r=".44" fill="url(#g${G.me === 1 ? 'B' : 'W'})" opacity=".55"/><circle cx="${x}" cy="${y}" r=".2" fill="none" stroke="#e0503e" stroke-width=".06"/>`;
    }
    st.innerHTML = s;
    G.lastDrop = -1;
    let m = '';
    if (G.last >= 0 && G.board[G.last]) {
      const x = G.last % 9 + 0.5, y = ((G.last / 9) | 0) + 0.5;
      m = `<circle cx="${x}" cy="${y}" r=".17" fill="none" stroke="${G.board[G.last] === 1 ? '#fff3dc' : '#e0503e'}" stroke-width=".07"/>`;
    }
    mk.innerHTML = m;
    let t = '';
    if (G.final) for (let p = 0; p < 81; p++) {
      const o = G.final.terr[p]; if (!o) continue;
      const x = p % 9 + 0.5, y = ((p / 9) | 0) + 0.5;
      t += `<rect x="${x - .14}" y="${y - .14}" width=".28" height=".28" rx=".04" fill="${o === 1 ? '#111' : '#f4f2ea'}" stroke="${o === 1 ? '#f4f2ea55' : '#11111155'}" stroke-width=".02"/>`;
    }
    tr.innerHTML = t;
    $('#meCaps').textContent = G.caps[G.me]; $('#opCaps').textContent = G.caps[3 - G.me];
    $('#meBar').classList.toggle('active', !G.over && G.toPlay === G.me);
    $('#opBar').classList.toggle('active', !G.over && G.toPlay !== G.me);
    const tm = $('#turnMsg');
    if (G.over) tm.textContent = '対局終了';
    else if (G.toPlay === G.me) tm.innerHTML = G.pend >= 0 ? '<b>もう一度タップで確定</b>' : (G.passes ? '相手はパスしました。<b>あなたの番</b>' : '<b>あなたの番</b>');
    else tm.textContent = '相手が考えています…';
    tickClocks();
  }

  function tickClocks() {
    if (!G) return;
    const me = clockOf(G.me), op = clockOf(3 - G.me);
    $('#meClock').textContent = fmt(me); $('#opClock').textContent = fmt(op);
    $('#meClock').classList.toggle('low', !G.over && G.toPlay === G.me && me < 30000);
    $('#opClock').classList.toggle('low', !G.over && G.toPlay !== G.me && op < 30000);
    if (!G.over && clockOf(G.toPlay) <= 0) {
      G.clock[G.toPlay] = 0;
      endGame(3 - G.toPlay, '時間切れ');
    }
  }
  setInterval(tickClocks, 200);

  function switchTurn() {
    const now = performance.now();
    G.clock[G.toPlay] = G.clock[G.toPlay] - (now - G.turnStart) + INC_MS;
    G.toPlay = 3 - G.toPlay; G.turnStart = now;
  }

  function doMove(p, c) {
    const r = E.play(G.board, p, c, G.ko);
    if (!r) return false;
    const prev = G.board;
    G.moveNo++;
    const tech = techOf(prev, r.board, p, c, r.cap, r.ko, G.moveNo);
    G.record.push(p);
    G.board = r.board; G.ko = r.ko; G.caps[c] += r.cap.length; G.last = p; G.lastDrop = p; G.passes = 0; G.pend = -1;
    sound(r.cap.length ? 'cap' : 'stone');
    switchTurn();
    render();
    stoneFx($('#board'), p, c, $('#boardWrap'));
    if (tech) fx(tech[0], tech[1], p, c === G.me);
    nextTurn();
    ponder();
    return true;
  }

  function doPass(c) {
    G.record.push(-1);
    G.moveNo++; G.passes++; G.ko = -1; G.pend = -1; G.last = -1;
    switchTurn();
    render();
    banner('パス', c === G.me ? 'あなた' : G.bot.name);
    if (G.passes >= 2) { scoreGame(); return; }
    nextTurn();
    ponder();
  }

  async function nextTurn() {
    if (G.over || G.toPlay === G.me) return;
    const g = G, id = G.id, mv = G.moveNo;
    g.thinking = true;
    const t0 = performance.now();
    const r = await ask({ type: 'think', board: g.board, toPlay: g.toPlay, ko: g.ko, level: g.bot.level, timeLeft: clockOf(g.toPlay), komi: KOMI, moveNum: g.moveNo, oppPassed: g.passes === 1, last: g.last });
    const wait = Math.max(0, Math.min(4800 - (performance.now() - t0), 500 + Math.random() * 600 - (performance.now() - t0)));
    await new Promise(res => setTimeout(res, wait));
    if (!G || G.id !== id || G.over || G.moveNo !== mv) return;
    g.thinking = false;
    if (r.resign) { endGame(g.me, '中押し'); return; }
    if (r.move < 0 || !doMove(r.move, g.toPlay)) doPass(g.toPlay);
  }

  async function scoreGame() {
    G.over = true;
    $('#turnMsg').textContent = '整地しています…';
    const id = G.id;
    const r = await ask({ type: 'score', board: G.board, n: 800 });
    if (!G || G.id !== id) return;
    const b = G.board.slice(), dead = [];
    for (let p = 0; p < 81; p++) {
      if ((b[p] === 1 && r.own[p] < -0.3) || (b[p] === 2 && r.own[p] > 0.3)) { dead.push(p); b[p] = 0; }
    }
    const terr = new Array(81).fill(0), seen = new Array(81).fill(false);
    for (let p = 0; p < 81; p++) {
      if (b[p] || seen[p]) continue;
      const reg = [p], border = new Set(); seen[p] = true;
      for (let i = 0; i < reg.length; i++) for (const q of E.NB[reg[i]]) {
        if (b[q]) border.add(b[q]); else if (!seen[q]) { seen[q] = true; reg.push(q); }
      }
      if (border.size === 1) { const o = [...border][0]; for (const q of reg) terr[q] = o; }
    }
    let black = 0, white = 0;
    for (let p = 0; p < 81; p++) { const o = b[p] || terr[p]; if (o === 1) black++; else if (o === 2) white++; }
    G.final = { dead, terr: terr.map((v, p) => b[p] ? 0 : v) };
    for (const p of dead) G.final.terr[p] = 3 - G.board[p];
    render();
    const margin = black - (white + KOMI);
    const winner = margin > 0 ? 1 : margin < 0 ? 2 : 0;
    const pts = Math.abs(margin);
    endGame(winner, winner === 0 ? '持碁' : `${pts}目${winner === G.me ? '勝ち' : '負け'}`, `黒 ${black}  ／  白 ${white} + コミ ${KOMI}`, true);
  }

  function applyRating(score, opRating, color, opName, reason, rec) {
    const win = score === 1, draw = score === 0.5;
    const old = S.rating, oldRank = displayRank();
    const d = eloDelta(S.rating, opRating, score, S.games);
    S.rating = Math.max(800, S.rating + d);
    S.games++;
    if (win) { S.wins++; S.streak++; } else if (draw) S.draws = (S.draws || 0) + 1; else S.streak = 0;
    if (!draw) { if (color === 1) win ? S.bw.bw++ : S.bw.bl++; else win ? S.bw.ww++ : S.bw.wl++; }
    const rr = rankFromRating(S.rating);
    if (rr >= DAN_FROM && S.streak >= DAN_STREAK && rr > S.earnedDan) S.earnedDan = rr;
    S.history.unshift({ win, draw, op: opName, color, reason, delta: d, t: Date.now(), rec: rec || null });
    S.history = S.history.slice(0, 30);
    save();
    try { localStorage.removeItem(KEY + '.active'); } catch (e) {}
    return { old, d, oldRank, newRank: displayRank() };
  }

  function endGame(winner, reason, scoreText, scored) {
    if (!G || (G.over && !scored)) return;
    G.over = true; G.thinking = false;
    stopPonder();
    if (G.wake) { G.wake.release().catch(() => {}); G.wake = null; }
    if (G.net) { clearInterval(G.net.timer); G.net = null; $('#netdown').hidden = true; }
    const win = winner === G.me, draw = winner === 0;
    let label = reason;
    if (reason === '中押し') label = win ? '中押し勝ち' : '中押し負け';
    if (reason === '時間切れ') label = win ? '時間切れ勝ち' : '時間切れ負け';
    if (reason === '切断') label = '切断負け';
    const r = G.solo ? null : applyRating(draw ? 0.5 : win ? 1 : 0, G.bot.rating, G.me, G.bot.name, label, G.record.slice());
    render();
    $('#passBtn').disabled = true; $('#resignBtn').disabled = true;
    setTimeout(() => showResult(draw ? 0 : win ? 1 : -1, label, scoreText || '', r), scored ? 900 : 500);
  }

  function showResult(win, label, scoreText, r) {
    const k = $('#resKanji');
    k.textContent = win > 0 ? '勝' : win === 0 ? '持' : '負';
    const rc = $('#resChara'); setImg(rc, myCharaSrc()); rc.className = 'res-chara' + (win < 0 ? ' lose' : '');
    k.className = 'res-kanji ' + (win > 0 ? '' : 'lose');
    void k.offsetWidth; k.classList.add('pop');
    $('#resReason').textContent = label;
    $('#resScore').textContent = scoreText;
    if (win > 0) { const kr = k.getBoundingClientRect(); setTimeout(() => A.burst(kr.left + kr.width / 2, kr.top + kr.height / 2, 'win'), 250); sound('ok'); }
    const pr = $('#resPromo');
    $('#resRate').hidden = !r;
    $('#resAgain').textContent = 'もう一局';
    $('#resAgain').onclick = () => { leaveGame(); startMatch(); };
    if (!r) {
      // ソロモードのミッション対局（レートは変わらない）
      const solo = G.solo, cleared = win > 0;
      pr.hidden = false; pr.textContent = cleared ? 'ミッションクリア！' : 'ミッション失敗……もう一度挑戦しよう';
      $('#resAgain').textContent = cleared ? '続きを読む' : 'もう一度挑戦';
      $('#resAgain').onclick = () => { $('#result').hidden = true; const g = G; G = null; solo.done(cleared, g); };
      $('#resHome').onclick = () => { $('#result').hidden = true; G = null; solo.back(); };
      $('#result').hidden = false;
      return;
    }
    $('#resHome').onclick = leaveGame;
    $('#resOld').textContent = r.old; $('#resNew').textContent = S.rating;
    const de = $('#resDelta'); de.textContent = (r.d >= 0 ? '+' : '') + r.d; de.className = r.d >= 0 ? 'up' : 'down';
    if (r.newRank > r.oldRank) { pr.hidden = false; pr.textContent = `${RANKS[r.newRank]}に昇${r.newRank >= DAN_FROM ? '段' : '級'}！`; }
    else if (r.newRank < r.oldRank) { pr.hidden = false; pr.textContent = `${RANKS[r.newRank]}に降${r.newRank >= DAN_FROM ? '段' : '級'}`; }
    else pr.hidden = true;
    $('#result').hidden = false;
  }

  function leaveGame() {
    $('#result').hidden = true; showScreen('home');
    G = null; renderHome();
  }

  /* ---------- 通信切断（3分で負け） ---------- */
  function netDown() {
    if (!G || G.over || G.net) return;
    const until = Date.now() + NET_LIMIT * 1000;
    $('#netdown').hidden = false;
    const upd = () => {
      const left = Math.max(0, Math.ceil((until - Date.now()) / 1000));
      $('#ndTime').textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
      if (left <= 0) { clearInterval(G.net.timer); G.net = null; $('#netdown').hidden = true; endGame(3 - G.me, '切断'); }
    };
    G.net = { timer: setInterval(upd, 250) };
    upd();
  }
  function netUp() {
    if (!G || !G.net) return;
    clearInterval(G.net.timer); G.net = null; $('#netdown').hidden = true;
    toast('通信が戻りました。対局を続けます');
  }
  window.addEventListener('offline', netDown);
  window.addEventListener('online', netUp);

  /* ---------- マッチング ---------- */
  // 人と対戦するサーバーはまだ無いので、相手は必ずBot。
  // 「Botとはマッチしない」をオンにすると、見つからないまま待ち続ける。
  let M = null;
  function startMatch() {
    stopMatch();
    const myRank = rankFromRating(S.rating);
    M = { t0: Date.now(), fixed: S.botLevel !== 'auto', myRank, found: false, timer: 0 };
    $('#matching').hidden = false;
    $('#mtFound').hidden = true; $('#mtOpts').hidden = false;
    $('#mtTitle').textContent = '対戦相手を探しています';
    setImg($('#mtMe'), myCharaSrc());
    $('#optNoBot').checked = !!S.noBot;
    $('#mtNoBotNote').hidden = !S.noBot;
    M.timer = setInterval(matchTick, 250);
    matchTick();
  }
  function matchRange() {
    if (S.noBot) return `${RANKS[Math.max(0, M.myRank - 1)]}〜${RANKS[Math.min(RANKS.length - 1, M.myRank + 1)]} のプレイヤー`;
    if (M.fixed) return `${RANKS[S.botLevel]} の相手`;
    return `${RANKS[Math.max(0, Math.min(BOT_MAX, M.myRank) - 1)]}〜${RANKS[Math.min(BOT_MAX, M.myRank + 1)]} の相手`;
  }
  function matchTick() {
    if (!M || M.found) return;
    const sec = Math.floor((Date.now() - M.t0) / 1000);
    const tt = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
    $('#mtSub').textContent = `${matchRange()}を検索中・${tt}`;
    $('#mpText').textContent = `対戦相手を探しています ${tt}`;
    if (!S.noBot && Date.now() - M.t0 >= MATCH_SEARCH_MS) matchFound();
  }
  function matchFound() {
    M.found = true; clearInterval(M.timer);
    const lv = M.fixed ? Math.min(BOT_MAX, S.botLevel) : Math.max(0, Math.min(BOT_MAX, M.myRank + Math.floor(Math.random() * 3) - 1));
    const bot = { level: lv, rating: botRating(lv), name: `Bot ${RANKS[lv]}` };
    const myColor = Math.random() < 0.5 ? 1 : 2;
    // 検討中なら検討を閉じて対局へ
    if (R) closeReview(true);
    $('#matchPill').hidden = true; $('#game').classList.remove('waiting');
    $('#matching').hidden = false; $('#mtOpts').hidden = true;
    $('#mtTitle').textContent = '対戦相手が見つかりました';
    $('#mtSub').textContent = M.fixed ? '指定した強さのBotとマッチしました' : '近い強さのBotとマッチしました';
    setImg($('#mtAvatar'), rivalSrc());
    $('#mtName').textContent = `${rivalName()}（${bot.name}）`;
    $('#mtRank').textContent = `レート ${bot.rating}`;
    $('#mtColor').textContent = myColor === 1 ? 'あなたは黒番（先手）' : 'あなたは白番（後手）';
    $('#mtFound').hidden = false;
    M.timer = setTimeout(() => { $('#matching').hidden = true; M = null; newGame(bot, myColor); }, 2200);
  }
  function stopMatch() {
    if (M) { clearInterval(M.timer); clearTimeout(M.timer); }
    M = null;
    $('#matching').hidden = true; $('#matchPill').hidden = true; $('#game').classList.remove('waiting');
  }
  $('#cancelMatch').onclick = stopMatch;
  $('#optNoBot').addEventListener('change', e => {
    S.noBot = e.target.checked; save();
    $('#mtNoBotNote').hidden = !S.noBot;
    matchTick();
  });
  $('#matchReview').onclick = () => {
    if (!M) return;
    $('#matching').hidden = true;
    $('#matchPill').hidden = false; $('#game').classList.add('waiting');
    openReview([]);
  };
  $('#mpOpen').onclick = () => { if (M && !M.found) { $('#matching').hidden = false; } };

  /* ---------- 入力 ---------- */
  $('#board').addEventListener('click', e => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = Math.floor(((e.clientX - r.left) / r.width * 9.3) - 0.15);
    const y = Math.floor(((e.clientY - r.top) / r.height * 9.3) - 0.15);
    if (x < 0 || x > 8 || y < 0 || y > 8) return;
    if (R) { reviewTap(y * 9 + x); return; }
    if (!G || G.over || G.toPlay !== G.me || G.net) return;
    const p = y * 9 + x;
    if (G.board[p]) return;
    if (!E.play(G.board, p, G.me, G.ko)) { const [bx, by] = pointXY($('#board'), p); A.burst(bx, by, 'bad'); sound('bad'); toast(p === G.ko ? 'コウなので、すぐには取り返せません' : 'そこには打てません'); return; }
    if (S.settings.confirm && G.pend !== p) { G.pend = p; render(); return; }
    doMove(p, G.me);
  });
  $('#passBtn').onclick = () => {
    if (!G || G.over || G.toPlay !== G.me) return;
    confirmBox(G.passes ? '相手もパスしています。パスすると終局して整地します。' : 'パスしますか？', () => { if (G && !G.over && G.toPlay === G.me) doPass(G.me); });
  };
  $('#resignBtn').onclick = () => { if (G && !G.over) confirmBox('投了しますか？ 負けになります。', () => G && !G.over && endGame(3 - G.me, '中押し')); };
  $('#startMatch').onclick = () => { sound('stone'); startMatch(); };
  $('#resHome').addEventListener('click', stopPonder);
  $('#resBoard').onclick = () => { const rec = G ? G.record.slice() : []; reviewBack = G && G.solo ? G.solo.back : null; $('#result').hidden = true; G = null; openReview(rec); };

  /* ---------- 設定 ---------- */
  function renderSettings() {
    $('#nameInput').value = S.name;
    const grid = $('#avGrid'); grid.innerHTML = '';
    A.VARIANTS.forEach((v, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('aria-label', 'アバター ' + v.name);
      b.setAttribute('aria-pressed', String(S.avatar.type === 'preset' && S.avatar.id === i));
      const im = document.createElement('img'); im.alt = ''; im.src = A.charaUri(i); b.append(im);
      const nm = document.createElement('span'); nm.textContent = v.name; b.append(nm);
      b.onclick = () => { S.avatar = { type: 'preset', id: i }; save(); renderSettings(); renderHome(); };
      grid.append(b);
    });
    $('#boardKaya').setAttribute('aria-checked', String(S.settings.board !== 'washi'));
    $('#boardWashi').setAttribute('aria-checked', String(S.settings.board === 'washi'));
    $('#optConfirm').checked = S.settings.confirm; $('#optFx').checked = S.settings.fx; $('#optSound').checked = S.settings.sound;
  }
  $('#boardKaya').onclick = () => { S.settings.board = 'kaya'; save(); applyBoardStyle(); renderSettings(); };
  $('#boardWashi').onclick = () => { S.settings.board = 'washi'; save(); applyBoardStyle(); renderSettings(); };
  $('#openSettings').onclick = () => { renderSettings(); $('#settings').hidden = false; };
  $('#closeSettings').onclick = () => { $('#settings').hidden = true; };
  $('#settings').addEventListener('click', e => { if (e.target.id === 'settings') $('#settings').hidden = true; });
  $('#nameInput').addEventListener('input', e => {
    const v = e.target.value.trim().slice(0, 12);
    S.name = v || 'あなた'; save(); renderHome();
  });
  $('#avUpload').addEventListener('change', e => {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas'); c.width = c.height = 160;
        const s = Math.min(img.width, img.height);
        c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 160, 160);
        S.avatar = { type: 'img', data: c.toDataURL('image/jpeg', 0.85) };
        save(); renderSettings(); renderHome(); toast('アバターを変更しました');
      };
      img.src = rd.result;
    };
    rd.readAsDataURL(f);
    e.target.value = '';
  });
  for (const [id, key] of [['#optConfirm', 'confirm'], ['#optFx', 'fx'], ['#optSound', 'sound']]) {
    $(id).addEventListener('change', e => { S.settings[key] = e.target.checked; save(); });
  }
  $('#resetRate').onclick = () => confirmBox('レートを1050（10級）に戻し、成績と履歴を消します。元に戻せません。', () => {
    Object.assign(S, { rating: START_RATE, games: 0, wins: 0, streak: 0, earnedDan: -1, bw: { bw: 0, bl: 0, ww: 0, wl: 0 }, history: [] });
    save(); renderHome(); $('#settings').hidden = true; toast('レートをリセットしました');
  });

  /* ---------- 検討モード ---------- */
  let reviewBack = null;
  const COLS = 'ABCDEFGHJ';
  const coord = p => p < 0 ? 'パス' : COLS[p % 9] + (9 - ((p / 9) | 0));
  function setMode(m) {
    const rv = m === 'review';
    $('#rvTop').hidden = !rv; $('#rvPanel').hidden = !rv;
    $('#opBar').hidden = rv; $('#meBar').hidden = rv; $('#playActions').hidden = rv;
    $('#game').classList.toggle('reviewing', rv);
  }
  function openReview(rec) {
    R = { main: rec.slice(), line: rec.slice(), idx: rec.length, hint: null, hintReq: 0 };
    showScreen('game'); $('#result').hidden = true;
    setMode('review');
    $('#fxLayer').innerHTML = '';
    reviewRender();
  }
  function replay(line, n) {
    let b = new Array(81).fill(0), ko = -1, c = 1, last = -1;
    const caps = { 1: 0, 2: 0 };
    for (let i = 0; i < n; i++) {
      const p = line[i];
      if (p >= 0) { const r = E.play(b, p, c, ko); if (!r) break; b = r.board; ko = r.ko; caps[c] += r.cap.length; last = p; }
      else { ko = -1; last = -1; }
      c = 3 - c;
    }
    return { b, ko, c, last, caps };
  }
  function reviewRender() {
    const st = replay(R.line, R.idx);
    R.st = st;
    let s = '';
    for (let p = 0; p < 81; p++) {
      const v = st.b[p]; if (!v) continue;
      const x = p % 9 + 0.5, y = ((p / 9) | 0) + 0.5;
      s += `<g class="stone${p === R.drop ? ' drop' : ''}"><circle cx="${x + .04}" cy="${y + .06}" r=".46" fill="#000" opacity=".28"/><circle cx="${x}" cy="${y}" r=".46" fill="url(#g${v === 1 ? 'B' : 'W'})"/></g>`;
    }
    $('#stones').innerHTML = s; R.drop = -1;
    $('#terr').innerHTML = '';
    let m = '';
    if (st.last >= 0) {
      const x = st.last % 9 + 0.5, y = ((st.last / 9) | 0) + 0.5;
      m += `<circle cx="${x}" cy="${y}" r=".17" fill="none" stroke="${st.b[st.last] === 1 ? '#fff3dc' : '#e0503e'}" stroke-width=".07"/>`;
    }
    if (R.hint && R.hint.at === R.idx + ':' + R.line.slice(0, R.idx).join(',')) {
      R.hint.cands.forEach((h, i) => {
        if (h.move < 0) return;
        const x = h.move % 9 + 0.5, y = ((h.move / 9) | 0) + 0.5;
        m += `<circle cx="${x}" cy="${y}" r=".38" fill="${i === 0 ? '#e0503e' : '#e0503ebb'}" stroke="#fff3dc" stroke-width=".04"/><text x="${x}" y="${y + .15}" text-anchor="middle" font-size=".42" font-weight="900" fill="#fff6ea" font-family="'M PLUS Rounded 1c', system-ui">${i + 1}</text>`;
      });
    } else if (R.hint && !R.hint.loading) { R.hint = null; $('#rvHintOut').hidden = true; }
    $('#marks').innerHTML = m;
    const branch = R.main.length > 0 && (R.line.length !== R.main.length || R.line.some((p, i) => p !== R.main[i]));
    $('#rvMove').textContent = `${R.idx}手目` + (R.line.length ? ` / ${R.line.length}` : '');
    $('#rvBranch').hidden = !branch;
    $('#rvMain').disabled = !branch;
    $('#rvTurn').innerHTML = `<b>次は${st.c === 1 ? '黒' : '白'}番</b><small>アゲハマ 黒${st.caps[1]}・白${st.caps[2]}</small>`;
    $('#rvPrev').disabled = $('#rvFirst').disabled = R.idx === 0;
    $('#rvNext').disabled = $('#rvLast').disabled = R.idx >= R.line.length;
  }
  function reviewPlay(p) {
    if (R.idx < R.line.length && R.line[R.idx] === p) R.idx++;
    else { R.line = R.line.slice(0, R.idx); R.line.push(p); R.idx++; }
    if (p >= 0) { R.drop = p; sound('stone'); }
    reviewRender();
    if (p >= 0) stoneFx($('#board'), p, R.st.b[p] || 1, $('#boardWrap'));
  }
  function reviewTap(p) {
    const st = R.st;
    if (st.b[p]) return;
    if (!E.play(st.b, p, st.c, st.ko)) { const [bx, by] = pointXY($('#board'), p); A.burst(bx, by, 'bad'); sound('bad'); toast(p === st.ko ? 'コウなので、すぐには取り返せません' : 'そこには打てません'); return; }
    reviewPlay(p);
  }
  $('#rvFirst').onclick = () => { R.idx = 0; reviewRender(); };
  $('#rvPrev').onclick = () => { if (R.idx > 0) { R.idx--; reviewRender(); } };
  $('#rvNext').onclick = () => { if (R.idx < R.line.length) { R.idx++; reviewRender(); } };
  $('#rvLast').onclick = () => { R.idx = R.line.length; reviewRender(); };
  $('#rvPass').onclick = () => reviewPlay(-1);
  $('#rvMain').onclick = () => { const keep = Math.min(R.idx, R.main.length); let i = 0; while (i < keep && R.line[i] === R.main[i]) i++; R.line = R.main.slice(); R.idx = i; reviewRender(); };
  function closeReview(toGame) {
    R = null; $('#marks').innerHTML = ''; $('#rvHintOut').hidden = true;
    if (!toGame) {
      const back = reviewBack; reviewBack = null;
      if (back) back(); else { showScreen('home'); renderHome(); }
    }
  }
  $('#rvClose').onclick = () => {
    closeReview(false);
    if (M && !M.found) { $('#matchPill').hidden = true; $('#game').classList.remove('waiting'); $('#matching').hidden = false; }
  };
  $('#rvHint').onclick = async () => {
    if (!R || (R.hint && R.hint.loading)) return;
    const st = R.st, at = R.idx + ':' + R.line.slice(0, R.idx).join(',');
    const out = $('#rvHintOut');
    out.hidden = false; out.innerHTML = '<small>AIが考えています…（5秒以内）</small>';
    R.hint = { loading: true, at, cands: [] };
    $('#rvHint').disabled = true;
    const res = await ask({ type: 'analyze', board: st.b, toPlay: st.c, ko: st.ko, komi: KOMI, last: st.last, ms: 4500 });
    $('#rvHint').disabled = false;
    if (!R) return;
    const nowAt = R.idx + ':' + R.line.slice(0, R.idx).join(',');
    if (nowAt !== at) { R.hint = null; out.hidden = true; return; }
    R.hint = { loading: false, at, cands: res.cands };
    const who = st.c === 1 ? '黒' : '白';
    if (!res.cands.length) out.innerHTML = '<small>打てる手がありません。パスが妥当です。</small>';
    else {
      out.innerHTML = `<small>${who}番の候補（${res.playouts.toLocaleString()}局面を読みました）</small><ol>` +
        res.cands.map((h, i) => `<li><i>${i + 1}</i><b>${coord(h.move)}</b><span>${who}の勝率 ${Math.round(h.wr * 100)}%</span></li>`).join('') + '</ol>';
    }
    reviewRender();
  };
  $('#openReview').onclick = () => openReview([]);

  /* ---------- Botの強さ ---------- */
  (function setupBotPick() {
    const sel = $('#botLevel');
    const o = document.createElement('option'); o.value = 'auto'; o.textContent = '自動（近い強さ）'; sel.append(o);
    RANKS.slice(0, BOT_MAX + 1).forEach((r, i) => { const op = document.createElement('option'); op.value = String(i); op.textContent = `${r}（レート ${botRating(i)}）`; sel.append(op); });
    if (S.botLevel !== 'auto') S.botLevel = (S.botLevel >= 0) ? Math.min(BOT_MAX, S.botLevel | 0) : 'auto';
    sel.value = String(S.botLevel);
    sel.addEventListener('change', () => { S.botLevel = sel.value === 'auto' ? 'auto' : +sel.value; save(); });
  })();

  /* ---------- 起動：前回の対局が途中で切れていたら負け ---------- */
  try {
    const act = JSON.parse(localStorage.getItem(KEY + '.active') || 'null');
    if (act) {
      const r = applyRating(0, act.op, act.color, act.name, '切断負け');
      setTimeout(() => toast(`前回の対局は途中で終了したため切断負けになりました（${r.d}）`, 4500), 400);
    }
  } catch (e) {}
  /* ---------- タイトルとタップの心地よさ ---------- */
  applyBoardStyle();
  A.startRoom($('#room'));
  A.startFx($('#fx'));
  A.setPetals(70);
  document.body.classList.add('on-title');
  // どこをタップしても、光と花びらと小さな音
  document.addEventListener('pointerdown', e => {
    A.burst(e.clientX, e.clientY, 'tap');
    // 盤のタップは着手の音を鳴らすので、ここでは鳴らさない
    if (!(e.target.closest && e.target.closest('#board, #lboard'))) sound('tap');
  }, { passive: true });
  function leaveTitle() {
    if ($('#title').hidden) return;
    $('#title').hidden = true; document.body.classList.remove('on-title');
    showScreen('home'); renderHome();
  }
  $('#title').addEventListener('click', leaveTitle);
  $('#title').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') leaveTitle(); });
  $('#openSolo').onclick = () => window.SOLO && window.SOLO.open();

  // ソロモード（solo.js）から使う機能
  window.APP = {
    E, A, S, save, RANKS, BOT_MAX, botRating, KOMI, showScreen, renderHome, toast, sound, buzz, setImg,
    drawGrid, pointXY, stoneFx, myCharaSrc, charaIdx,
    startSoloGame(level, solo) {
      const lv = Math.max(0, Math.min(BOT_MAX, level));
      const bot = { level: lv, rating: botRating(lv), name: `Bot ${RANKS[lv]}` };
      newGame(bot, Math.random() < 0.5 ? 1 : 2, { solo });
    }
  };
  renderHome();
})();
