/* 九路 Blitz — 画面・対局進行・レート管理 */
(() => {
  'use strict';
  const E = window.GoEngine;
  const $ = s => document.querySelector(s);
  const KOMI = 7.5;
  const MAIN_MS = 5 * 60 * 1000, INC_MS = 5000;
  const NET_LIMIT = 180; // 秒
  const MATCH_SEARCH_MS = 8000;

  /* ---------- 段級とレート（囲碁クエスト9路の基準） ---------- */
  const RANKS = ['10級', '9級', '8級', '7級', '6級', '5級', '4級', '3級', '2級', '1級', '初段', '二段', '三段', '四段'];
  const TH = [1050, 1100, 1150, 1200, 1250, 1300, 1350, 1400, 1500, 1600, 1700, 1800, 1900, 2000];
  const DAN_FROM = 10;      // 初段の index
  const DAN_STREAK = 4;     // 昇段に必要な連勝数
  const START_RATE = 1050;
  const rankFromRating = r => { let i = 0; for (let k = 0; k < TH.length; k++) if (r >= TH[k]) i = k; return i; };
  const botRating = i => i < TH.length - 1 ? Math.round((TH[i] + TH[i + 1]) / 2) : TH[i] + 50;
  const kFactor = games => games < 20 ? 32 : 16;
  function eloDelta(my, op, score, games) {
    const exp = 1 / (1 + Math.pow(10, (op - my) / 400));
    let d = Math.round(kFactor(games) * (score - exp));
    if (d === 0) d = score ? 1 : -1;
    return d;
  }

  /* ---------- 保存データ ---------- */
  const KEY = 'kuro9.v1';
  const AV = [
    ['碁', '#1d2b4a', '#3c5a9a'], ['石', '#1f1f24', '#5b5b66'], ['星', '#3a2350', '#7b4bb0'], ['天', '#103d3a', '#2c8a7f'],
    ['龍', '#4a1414', '#b23a2a'], ['虎', '#4a3410', '#c08a2a'], ['風', '#183a2a', '#3f8f5f'], ['雷', '#2a2f4a', '#c8a94a'],
    ['剣', '#26303a', '#7f93a6'], ['鶴', '#3a3a42', '#a9a9ba'], ['月', '#1c2140', '#6f80c6'], ['炎', '#4a1d0e', '#d9602a']
  ];
  const BOT_AV = ['機', '#20262e', '#56606c'];
  function fresh() {
    return {
      name: 'あなた', avatar: { type: 'preset', id: 0 },
      rating: START_RATE, games: 0, wins: 0, streak: 0, earnedDan: -1,
      bw: { bw: 0, bl: 0, ww: 0, wl: 0 }, history: [],
      settings: { confirm: true, fx: true, sound: true }, botLevel: 'auto'
    };
  }
  let S = fresh();
  try { const raw = localStorage.getItem(KEY); if (raw) S = Object.assign(fresh(), JSON.parse(raw)); } catch (e) {}
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
      const t = actx.currentTime;
      const len = kind === 'cap' ? 0.12 : 0.06;
      const buf = actx.createBuffer(1, actx.sampleRate * len, actx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, kind === 'cap' ? 3 : 6);
      const src = actx.createBufferSource(); src.buffer = buf;
      const f = actx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = kind === 'cap' ? 900 : 2200; f.Q.value = 1.2;
      const g = actx.createGain(); g.gain.setValueAtTime(kind === 'cap' ? 0.9 : 0.7, t);
      src.connect(f).connect(g).connect(actx.destination); src.start(t);
    } catch (e) {}
  }

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
      else setTimeout(() => res(msg.type === 'think' ? E.think(msg) : { own: E.ownership(msg.board, msg.n || 400) }), 30);
    });
  }

  /* ---------- アバター描画 ---------- */
  function paintAvatar(el, av) {
    el.style.backgroundImage = ''; el.textContent = '';
    if (av && av.type === 'img' && av.data) { el.style.backgroundImage = `url(${av.data})`; return; }
    const a = Array.isArray(av) ? av : AV[(av && av.id) || 0] || AV[0];
    el.textContent = a[0];
    el.style.backgroundImage = `linear-gradient(145deg, ${a[2]}, ${a[1]})`;
  }

  /* ---------- 盤の静的部分 ---------- */
  (function drawGrid() {
    const g = $('#grid'); let s = '';
    for (let i = 0; i < 9; i++) {
      const v = i + 0.5, w = (i === 0 || i === 8) ? 0.05 : 0.028;
      s += `<line x1="0.5" y1="${v}" x2="8.5" y2="${v}" stroke="#3b2a12" stroke-width="${w}"/>`;
      s += `<line x1="${v}" y1="0.5" x2="${v}" y2="8.5" stroke="#3b2a12" stroke-width="${w}"/>`;
    }
    for (const [x, y] of [[2, 2], [6, 2], [2, 6], [6, 6], [4, 4]]) s += `<circle cx="${x + .5}" cy="${y + .5}" r=".09" fill="#3b2a12"/>`;
    g.innerHTML = s;
  })();

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
  const shown = el => el && !el.hidden;
  function fx(name, tier, p, mine) {
    if (!S.settings.fx) return;
    const layer = $('#fxLayer');
    const x = p % 9, y = (p / 9) | 0;
    const ring = document.createElement('div');
    ring.className = `ring t${tier} ${mine ? 'me' : 'op'}`;
    ring.style.left = ((x + 0.65) / 9.3 * 100) + '%';
    ring.style.top = ((y + 0.65) / 9.3 * 100) + '%';
    const txt = document.createElement('div');
    txt.className = `fxText t${tier} ${mine ? 'me' : 'op'}`;
    txt.textContent = name;
    const top = y >= 4 ? 27 : 73;
    txt.style.top = top + '%';
    const nodes = [ring, txt];
    if (tier === 2) {
      const sl = document.createElement('div');
      sl.className = 'slash' + (mine ? '' : ' op');
      sl.style.top = (top + 2) + '%';
      nodes.push(sl);
      const bw = $('#boardWrap'); bw.classList.remove('shake'); void bw.offsetWidth; bw.classList.add('shake');
    }
    layer.append(...nodes);
    setTimeout(() => nodes.forEach(n => n.remove()), 1500);
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
    paintAvatar($('#homeAvatar'), S.avatar);
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
      li.innerHTML = `<span class="hk ${h.win ? 'w' : 'l'}">${h.win ? '勝' : '負'}</span><span class="hn"></span><span class="hr"></span><span class="hd ${h.delta >= 0 ? 'up' : 'down'}">${h.delta >= 0 ? '+' : ''}${h.delta}</span>`;
      li.querySelector('.hn').textContent = h.op; const sm = document.createElement('small'); sm.textContent = h.color === 1 ? '黒番' : '白番'; li.querySelector('.hn').append(sm);
      li.querySelector('.hr').textContent = h.reason;
      ol.append(li);
    }
  }

  /* ---------- 対局 ---------- */
  let G = null, gameSeq = 0;
  const clockOf = c => G.clock[c] - (G.toPlay === c && !G.over ? performance.now() - G.turnStart : 0);
  const fmt = ms => { ms = Math.max(0, ms); const s = Math.ceil(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

  function newGame(bot, myColor) {
    gameSeq++;
    G = {
      id: gameSeq, board: new Array(81).fill(0), toPlay: 1, ko: -1, me: myColor, bot,
      caps: { 1: 0, 2: 0 }, clock: { 1: MAIN_MS, 2: MAIN_MS }, turnStart: performance.now(),
      passes: 0, moveNo: 0, last: -1, over: false, pend: -1, thinking: false, net: null, final: null, lastDrop: -1
    };
    try { localStorage.setItem(KEY + '.active', JSON.stringify({ op: bot.rating, color: myColor, name: bot.name })); } catch (e) {}
    $('#home').hidden = true; $('#game').hidden = false;
    paintAvatar($('#meAvatar'), S.avatar); $('#meName').textContent = S.name; $('#meRank').textContent = `${RANKS[displayRank()]} ${S.rating}`;
    paintAvatar($('#opAvatar'), BOT_AV); $('#opName').textContent = bot.name; $('#opRank').textContent = `${RANKS[bot.level]} ${bot.rating}`;
    $('#meStone').className = 'mini-stone ' + (myColor === 1 ? 'b' : 'w');
    $('#opStone').className = 'mini-stone ' + (myColor === 1 ? 'w' : 'b');
    $('#passBtn').disabled = false; $('#resignBtn').disabled = false; $('#resignBtn').textContent = '投了';
    render();
    banner('お願いします', myColor === 1 ? 'あなたは黒番・先手' : 'あなたは白番');
    if (navigator.wakeLock) navigator.wakeLock.request('screen').then(l => { G && (G.wake = l); }).catch(() => {});
    if (!navigator.onLine) netDown();
    nextTurn();
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
      s += `<circle cx="${x}" cy="${y}" r=".44" fill="url(#g${G.me === 1 ? 'B' : 'W'})" opacity=".55"/><circle cx="${x}" cy="${y}" r=".2" fill="none" stroke="#e9c46a" stroke-width=".06"/>`;
    }
    st.innerHTML = s;
    G.lastDrop = -1;
    let m = '';
    if (G.last >= 0 && G.board[G.last]) {
      const x = G.last % 9 + 0.5, y = ((G.last / 9) | 0) + 0.5;
      m = `<circle cx="${x}" cy="${y}" r=".17" fill="none" stroke="${G.board[G.last] === 1 ? '#f3d27e' : '#c2412b'}" stroke-width=".07"/>`;
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
    G.board = r.board; G.ko = r.ko; G.caps[c] += r.cap.length; G.last = p; G.lastDrop = p; G.passes = 0; G.pend = -1;
    sound(r.cap.length ? 'cap' : 'stone');
    switchTurn();
    render();
    if (tech) fx(tech[0], tech[1], p, c === G.me);
    nextTurn();
    return true;
  }

  function doPass(c) {
    G.moveNo++; G.passes++; G.ko = -1; G.pend = -1; G.last = -1;
    switchTurn();
    render();
    banner('パス', c === G.me ? 'あなた' : G.bot.name);
    if (G.passes >= 2) { scoreGame(); return; }
    nextTurn();
  }

  async function nextTurn() {
    if (G.over || G.toPlay === G.me) return;
    const g = G, id = G.id, mv = G.moveNo;
    g.thinking = true;
    const t0 = performance.now();
    const r = await ask({ type: 'think', board: g.board, toPlay: g.toPlay, ko: g.ko, level: g.bot.level, timeLeft: clockOf(g.toPlay), komi: KOMI, moveNum: g.moveNo, oppPassed: g.passes === 1, last: g.last });
    const wait = Math.max(0, 500 + Math.random() * 600 - (performance.now() - t0));
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
    const winner = margin > 0 ? 1 : 2;
    const pts = Math.abs(margin);
    endGame(winner, `${Math.floor(pts)}目半${winner === G.me ? '勝ち' : '負け'}`, `黒 ${black}  ／  白 ${white} + コミ ${KOMI}`, true);
  }

  function applyRating(win, opRating, color, opName, reason) {
    const old = S.rating, oldRank = displayRank();
    const d = eloDelta(S.rating, opRating, win ? 1 : 0, S.games);
    S.rating = Math.max(800, S.rating + d);
    S.games++;
    if (win) { S.wins++; S.streak++; } else S.streak = 0;
    if (color === 1) win ? S.bw.bw++ : S.bw.bl++; else win ? S.bw.ww++ : S.bw.wl++;
    const rr = rankFromRating(S.rating);
    if (rr >= DAN_FROM && S.streak >= DAN_STREAK && rr > S.earnedDan) S.earnedDan = rr;
    S.history.unshift({ win, op: opName, color, reason, delta: d, t: Date.now() });
    S.history = S.history.slice(0, 30);
    save();
    try { localStorage.removeItem(KEY + '.active'); } catch (e) {}
    return { old, d, oldRank, newRank: displayRank() };
  }

  function endGame(winner, reason, scoreText, scored) {
    if (!G || (G.over && !scored)) return;
    G.over = true; G.thinking = false;
    if (G.wake) { G.wake.release().catch(() => {}); G.wake = null; }
    if (G.net) { clearInterval(G.net.timer); G.net = null; $('#netdown').hidden = true; }
    const win = winner === G.me;
    let label = reason;
    if (reason === '中押し') label = win ? '中押し勝ち' : '中押し負け';
    if (reason === '時間切れ') label = win ? '時間切れ勝ち' : '時間切れ負け';
    if (reason === '切断') label = '切断負け';
    const r = applyRating(win, G.bot.rating, G.me, G.bot.name, label);
    render();
    $('#passBtn').disabled = true; $('#resignBtn').disabled = true;
    setTimeout(() => showResult(win, label, scoreText || '', r), scored ? 900 : 500);
  }

  function showResult(win, label, scoreText, r) {
    const k = $('#resKanji');
    k.textContent = win ? '勝' : '負';
    k.className = 'res-kanji ' + (win ? '' : 'lose');
    void k.offsetWidth; k.classList.add('pop');
    $('#resReason').textContent = label;
    $('#resScore').textContent = scoreText;
    $('#resOld').textContent = r.old; $('#resNew').textContent = S.rating;
    const de = $('#resDelta'); de.textContent = (r.d >= 0 ? '+' : '') + r.d; de.className = r.d >= 0 ? 'up' : 'down';
    const pr = $('#resPromo');
    if (r.newRank > r.oldRank) { pr.hidden = false; pr.textContent = `${RANKS[r.newRank]}に昇${r.newRank >= DAN_FROM ? '段' : '級'}！`; }
    else if (r.newRank < r.oldRank) { pr.hidden = false; pr.textContent = `${RANKS[r.newRank]}に降${r.newRank >= DAN_FROM ? '段' : '級'}`; }
    else pr.hidden = true;
    $('#result').hidden = false;
  }

  function leaveGame() {
    $('#result').hidden = true; $('#game').hidden = true; $('#home').hidden = false;
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
  let matchT = [];
  function startMatch() {
    matchT.forEach(clearTimeout); matchT = [];
    const ov = $('#matching'); ov.hidden = false;
    $('#mtFound').hidden = true; $('#cancelMatch').hidden = false;
    $('#mtTitle').textContent = '対戦相手を探しています';
    const myRank = rankFromRating(S.rating);
    const fixed = S.botLevel !== 'auto';
    const t0 = Date.now();
    const tick = () => {
      const s = Math.floor((Date.now() - t0) / 1000);
      $('#mtSub').textContent = `${fixed ? RANKS[S.botLevel] : RANKS[Math.max(0, myRank - 1)] + '〜' + RANKS[Math.min(13, myRank + 1)]} のプレイヤーを検索中 ・ ${s}秒`;
    };
    tick();
    const iv = setInterval(tick, 500);
    matchT.push(setTimeout(() => {
      clearInterval(iv);
      const lv = fixed ? S.botLevel : Math.max(0, Math.min(13, myRank + Math.floor(Math.random() * 3) - 1));
      const bot = { level: lv, rating: botRating(lv), name: `Bot ${RANKS[lv]}` };
      const myColor = Math.random() < 0.5 ? 1 : 2;
      $('#mtTitle').textContent = '対局者が見つかりませんでした';
      $('#mtSub').textContent = fixed ? '指定した強さのBotとマッチしました' : '近い強さのBotとマッチしました';
      paintAvatar($('#mtAvatar'), BOT_AV);
      $('#mtName').textContent = bot.name;
      $('#mtRank').textContent = `レート ${bot.rating}`;
      $('#mtColor').textContent = myColor === 1 ? 'あなたは黒番（先手）' : 'あなたは白番（後手）';
      $('#mtFound').hidden = false; $('#cancelMatch').hidden = true;
      matchT.push(setTimeout(() => { ov.hidden = true; newGame(bot, myColor); }, 2200));
    }, MATCH_SEARCH_MS));
    matchT.push(iv);
    $('#cancelMatch').onclick = () => { matchT.forEach(t => { clearTimeout(t); clearInterval(t); }); ov.hidden = true; };
  }

  /* ---------- 入力 ---------- */
  $('#board').addEventListener('click', e => {
    if (!G || G.over || G.toPlay !== G.me || G.net) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = Math.floor(((e.clientX - r.left) / r.width * 9.3) - 0.15);
    const y = Math.floor(((e.clientY - r.top) / r.height * 9.3) - 0.15);
    if (x < 0 || x > 8 || y < 0 || y > 8) return;
    const p = y * 9 + x;
    if (G.board[p]) return;
    if (!E.play(G.board, p, G.me, G.ko)) { toast(p === G.ko ? 'コウなので、すぐには取り返せません' : 'そこには打てません'); return; }
    if (S.settings.confirm && G.pend !== p) { G.pend = p; render(); return; }
    doMove(p, G.me);
  });
  $('#passBtn').onclick = () => {
    if (!G || G.over || G.toPlay !== G.me) return;
    confirmBox(G.passes ? '相手もパスしています。パスすると終局して整地します。' : 'パスしますか？', () => { if (G && !G.over && G.toPlay === G.me) doPass(G.me); });
  };
  $('#resignBtn').onclick = () => { if (G && !G.over) confirmBox('投了しますか？ 負けになります。', () => G && !G.over && endGame(3 - G.me, '中押し')); };
  $('#startMatch').onclick = () => { sound('stone'); startMatch(); };
  $('#resHome').onclick = leaveGame;
  $('#resAgain').onclick = () => { leaveGame(); startMatch(); };
  $('#resBoard').onclick = () => { $('#result').hidden = true; $('#resignBtn').disabled = false; $('#resignBtn').textContent = '結果'; $('#resignBtn').onclick = () => { $('#result').hidden = false; }; };
  const restoreResign = () => { $('#resignBtn').onclick = () => { if (G && !G.over) confirmBox('投了しますか？ 負けになります。', () => G && !G.over && endGame(3 - G.me, '中押し')); }; };
  $('#resHome').addEventListener('click', restoreResign); $('#resAgain').addEventListener('click', restoreResign);

  /* ---------- 設定 ---------- */
  function renderSettings() {
    $('#nameInput').value = S.name;
    const grid = $('#avGrid'); grid.innerHTML = '';
    AV.forEach((a, i) => {
      const b = document.createElement('button');
      b.className = 'avatar'; b.type = 'button';
      b.setAttribute('aria-label', 'アバター ' + a[0]);
      b.setAttribute('aria-pressed', String(S.avatar.type === 'preset' && S.avatar.id === i));
      paintAvatar(b, { type: 'preset', id: i });
      b.onclick = () => { S.avatar = { type: 'preset', id: i }; save(); renderSettings(); renderHome(); };
      grid.append(b);
    });
    $('#optConfirm').checked = S.settings.confirm; $('#optFx').checked = S.settings.fx; $('#optSound').checked = S.settings.sound;
  }
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

  /* ---------- Botの強さ ---------- */
  (function setupBotPick() {
    const sel = $('#botLevel');
    const o = document.createElement('option'); o.value = 'auto'; o.textContent = '自動（自分のレートの近く）'; sel.append(o);
    RANKS.forEach((r, i) => { const op = document.createElement('option'); op.value = String(i); op.textContent = `${r}（レート ${botRating(i)}）`; sel.append(op); });
    if (S.botLevel !== 'auto' && !(S.botLevel >= 0 && S.botLevel < RANKS.length)) S.botLevel = 'auto';
    sel.value = String(S.botLevel);
    sel.addEventListener('change', () => { S.botLevel = sel.value === 'auto' ? 'auto' : +sel.value; save(); });
  })();

  /* ---------- 起動：前回の対局が途中で切れていたら負け ---------- */
  try {
    const act = JSON.parse(localStorage.getItem(KEY + '.active') || 'null');
    if (act) {
      const r = applyRating(false, act.op, act.color, act.name, '切断負け');
      setTimeout(() => toast(`前回の対局は途中で終了したため切断負けになりました（${r.d}）`, 4500), 400);
    }
  } catch (e) {}
  renderHome();
})();
