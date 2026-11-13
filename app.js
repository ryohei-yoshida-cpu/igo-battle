/* 囲碁BLITZ — 画面・対局進行・レート管理 */
(() => {
  'use strict';
  const E9 = window.GoEngine;
  let E = E9, BN = 9;   // 今の盤（9路・13路）とそのエンジン
  const $ = s => document.querySelector(s);
  const KOMI = 7; // 同点は持碁（引き分け）
  const MAIN_MS = 5 * 60 * 1000, INC_MS = 5000;
  const NET_LIMIT = 180; // 秒
  const MATCH_SEARCH_MS = 8000;

  /* ---------- 段級とレート（囲碁クエスト9路の基準） ---------- */
  const RANKS = ['10級', '9級', '8級', '7級', '6級', '5級', '4級', '3級', '2級', '1級', '初段', '二段', '三段', '四段'];
  const TH = [1050, 1100, 1150, 1200, 1250, 1300, 1350, 1400, 1500, 1600, 1700, 1800, 1900, 2000];
  const DAN_FROM = 10;      // 初段の index
  const BOT_MAX = 13;       // Botは四段まで（初段から上は囲碁AI）
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
      settings: { confirm: true, fx: true, sound: true, bgm: true, board: 'kaya', tickerMode: 'all' }, botLevel: 'auto', noBot: false,
      solo: { mode: 'beginner', bot: 3, open: {}, lessons: [] }
    };
  }
  let S = fresh();
  try { const raw = localStorage.getItem(KEY); if (raw) S = Object.assign(fresh(), JSON.parse(raw)); } catch (e) {}
  S.settings = Object.assign({ confirm: true, fx: true, sound: true, bgm: true, board: 'kaya', tickerMode: 'all' }, S.settings);
  if (S.settings.board !== 'washi') S.settings.board = 'kaya';
  S.solo = Object.assign({ mode: 'beginner', bot: 3, open: {}, lessons: [] }, S.solo);
  // マイルーム：銭と、キャラごとの勝ち数（5勝で遊びに来る）
  if (S.zeni == null) { S.zeni = 0; S.gifts = [{ id: 1, kind: 'welcome', amount: 3000, label: 'はじめてのプレゼント', t: Date.now() }]; }   // はじめの3000銭はプレゼントボックスへ
  S.vs = S.vs || {};
  // 13路の戦績・段級位は9路と別（レート・連勝・昇段も別に数える）
  const fresh13 = () => ({ rating: START_RATE, games: 0, wins: 0, draws: 0, streak: 0, earnedDan: -1, bw: { bw: 0, bl: 0, ww: 0, wl: 0 }, rankGift: [] });
  S.r13 = Object.assign(fresh13(), S.r13);
  // 旧バージョン（コード描画のキャラ：0〜3小春、4〜5玄斎）からの引っ越し
  if (!S.avaV2) { if (S.avatar.type === 'preset') S.avatar.id = (S.avatar.id | 0) >= 4 ? 1 : 0; S.avaV2 = 1; }
  if (S.avatar.type !== 'preset') S.avatar = { type: 'preset', id: 0 };   // 写真アバターは廃止
  if (S.avatar.type === 'preset') S.avatar.id = ((S.avatar.id | 0) % A.VARIANTS.length + A.VARIANTS.length) % A.VARIANTS.length;
  // 保存：この端末に保存し、サーバー（アカウント）にも少し後に送る
  let syncHook = null;
  const saveLocal = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };   // この端末だけ（通信しない）
  const save = () => { if (syncHook) S._at = Date.now(); saveLocal(); if (syncHook) syncHook(); };

  // キャラクターは段級位で順に使えるようになる（三段で全員）
  const UNLOCK = { koharu: 0, hinata: 2, mike: 4, shima: 6, tomoe: 8, gensai: 10, tono: 12, dgensai: 12 };
  // キャラは 9路・13路の高いほうの段級位で開く。勾玉で先に開くこともできる（S.charaBuy）
  const charaOpen = i => Math.max(displayRank(9), displayRank(13)) >= (UNLOCK[A.VARIANTS[i].key] || 0) || (S.charaBuy || []).includes(A.VARIANTS[i].key);
  const GAME = 'go';   // このアプリのゲーム（セーブデータ・勾玉はゲームごと）
  const RS = size => size === 13 ? S.r13 : S;   // 盤の大きさごとの戦績（9路は前からの S そのもの）
  function displayRank(size) {
    const st = RS(size), r = rankFromRating(st.rating);
    if (r < DAN_FROM) return r;
    return Math.max(DAN_FROM - 1, Math.min(r, st.earnedDan));
  }
  // サーバーに送る戦績のまとめ（全ゲーム共通のプロフィール・戦績タブ用）
  function statsOut() {
    const one = sz => { const st = RS(sz), dr = displayRank(sz); return { rating: st.rating, games: st.games, wins: st.wins, draws: st.draws || 0, streak: st.streak, rank: dr, rn: RANKS[dr] }; };
    return { go9: one(9), go13: one(13) };
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
      if (kind === 'fanfare') { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => sound('n' + f), i * 85)); setTimeout(() => sound('chord'), 360); return; }
      if (kind[0] === 'n' && +kind.slice(1)) { tone(+kind.slice(1), 0.22, 0.06, 'triangle'); return; }
      if (kind === 'chord') { tone(1047, 1.1, 0.05, 'triangle'); tone(1319, 1.1, 0.04, 'triangle'); tone(1568, 1.1, 0.035); tone(2093, .8, .02); return; }
      if (kind === 'coin') { tone(1976, 0.07, 0.04, 'square'); setTimeout(() => sound('coin2'), 70); return; }
      if (kind === 'coin2') { tone(2637, 0.35, 0.04, 'square'); return; }
      if (kind === 'ok2') { tone(1175, 0.3, 0.07); tone(1568, 0.3, 0.035); return; }
      if (kind === 'taiko') {
        tone(78, 0.55, 0.6, 'sine', 46); noise(0.14, 180, 0.8, 1.2, 2.5);
        setTimeout(() => { try { sound('taiko2'); } catch (e) {} }, 170);
        return;
      }
      if (kind === 'taiko2') { tone(92, 0.6, 0.7, 'sine', 50); noise(0.18, 160, 0.8, 1.4, 2.2); return; }
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
      if (worker) { const id = ++reqId; pending.set(id, res); worker.postMessage(Object.assign({ id, size: BN }, msg)); }
      else setTimeout(() => res(msg.type === 'think' ? E.think(msg) : msg.type === 'analyze' ? E.analyze(msg) : { own: E.ownership(msg.board, msg.n || 400) }), 30);
    });
  }

  /* ---------- アバター・キャラ ---------- */
  const charaIdx = () => S.avatar.type === 'preset' ? S.avatar.id : 0;
  const myCharaSrc = () => A.charaUri(charaIdx());
  const myFaceSrc = () => A.faceUri(charaIdx());
  const rivalIdx = lv => A.rivalOf(charaIdx(), lv);
  const rivalSrc = lv => A.charaUri(rivalIdx(lv));
  const rivalFace = lv => A.faceUri(rivalIdx(lv));
  const rivalName = lv => A.VARIANTS[rivalIdx(lv)].name;
  // 対局相手のキャラ番号（人ならその人のアバター、マイルームから誘ったキャラならそのキャラ）
  const oppChara = bot => bot.human ? bot.ava : bot.chara != null ? bot.chara : rivalIdx(bot.level);
  const myAvatarSrc = () => myFaceSrc();
  const setImg = (el, src) => { if (el.getAttribute('src') !== src) el.src = src; };
  function applyBoardStyle() { document.body.classList.toggle('washi', S.settings.board === 'washi'); }

  // 人の手番中にBotが先読みする（Botの1手は5秒以内）
  function ponder() {
    if (!worker || !G || G.over || G.toPlay !== G.me || G.online) return;
    worker.postMessage({ type: 'ponder', size: BN, board: G.board, toPlay: G.toPlay, ko: G.ko, komi: G.komi, last: G.last, level: G.bot.level, rec: G.hc ? null : G.record.slice() });
  }
  function stopPonder() { if (worker) worker.postMessage({ type: 'stop' }); }

  /* ---------- 盤の静的部分 ---------- */
  const HOSHI = { 9: [[2, 2], [6, 2], [2, 6], [6, 6], [4, 4]], 13: [[3, 3], [9, 3], [3, 9], [9, 9], [6, 6]] };
  function drawGrid(g, n) {
    n = n || 9;
    let s = '';
    const k = n / 9;
    for (let i = 0; i < n; i++) {
      const v = i + 0.5, edge = i === 0 || i === n - 1, w = (edge ? 0.05 : 0.026) * k;
      s += `<line class="gl" x1="0.5" y1="${v}" x2="${n - .5}" y2="${v}" stroke-width="${w}"/><line class="gl" x1="${v}" y1="0.5" x2="${v}" y2="${n - .5}" stroke-width="${w}"/>`;
    }
    for (const [x, y] of HOSHI[n]) s += `<circle class="hoshi" cx="${x + .5}" cy="${y + .5}" r="${.09 * k}"/>`;
    g.innerHTML = s;
  }
  // 対局・検討の盤を 9路／13路 に切りかえる
  function setSize(n) {
    n = n === 13 ? 13 : 9;
    if (n === BN && $('#board').dataset.n) return;
    BN = n; E = window.GoEngines[n];
    const b = $('#board');
    b.dataset.n = n;
    b.setAttribute('viewBox', `-0.15 -0.15 ${n + .3} ${n + .3}`);
    b.setAttribute('aria-label', n + '路盤');
    for (const r of b.querySelectorAll('.bd-bg, .bd-grain')) { r.setAttribute('width', n + .3); r.setAttribute('height', n + .3); r.setAttribute('rx', .22 * n / 9); }
    drawGrid($('#grid'), n);
    document.body.classList.toggle('b13', n === 13);
  }
  document.querySelectorAll('svg .grid').forEach(g => drawGrid(g, 9));
  // 盤上の点 → 画面座標
  function pointXY(svg, p) {
    const r = svg.getBoundingClientRect();
    const n = +svg.dataset.n || 9;
    return [r.left + (p % n + .65) / (n + .3) * r.width, r.top + (((p / n) | 0) + .65) / (n + .3) * r.height];
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
    const x = p % BN, y = (p / BN) | 0;
    const at = (dx, dy) => { const X = x + dx, Y = y + dy; return X >= 0 && X < BN && Y >= 0 && Y < BN ? prev[Y * BN + X] : -1; };
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
      const lo = v => Math.min(v, BN - 1 - v), a = lo(x), b = lo(y), h = BN === 13 ? 3 : 2;
      if (x === (BN - 1) / 2 && y === (BN - 1) / 2) return ['天元', 1];
      if (a === h && b === h) return ['星', 1];
      if (BN === 13 && a === 2 && b === 2) return ['三々', 1];
      if ((a === 2 && b === 3) || (a === 3 && b === 2)) return ['小目', 1];
      if (BN === 9 ? (a === 3 && b === 3) : ((a === 3 && b === 4) || (a === 4 && b === 3))) return ['高目', 1];
    }
    return null;
  }

  /* ---------- エフェクト ---------- */
  // 着手点の波紋と、キャラ付きの技カットイン
  function fx(name, tier, p, mine) {
    if (!S.settings.fx) return;
    const x = p % BN, y = (p / BN) | 0;
    const ring = document.createElement('div');
    ring.className = `ring t${tier} ${mine ? 'me' : 'op'}`;
    ring.style.left = ((x + 0.65) / (BN + .3) * 100) + '%';
    ring.style.top = ((y + 0.65) / (BN + .3) * 100) + '%';
    $('#fxLayer').querySelectorAll('.fxBanner').forEach(n => n.remove());
    $('#fxLayer').append(ring);
    setTimeout(() => ring.remove(), 1000);
    // 打った石が隠れないよう、盤の反対側の半分に帯を出す
    const r = $('#boardWrap').getBoundingClientRect();
    const cy = r.top + r.height * (y >= (BN - 1) / 2 ? 0.27 : 0.73);
    const layer = $('#cutin');
    layer.innerHTML = '';
    const el = document.createElement('div');
    el.className = `cut t${tier} ${mine ? 'me' : 'op'}`;
    el.style.setProperty('--y', cy + 'px');
    el.innerHTML = `${tier === 2 ? '<div class="flash"></div>' : ''}<div class="band"></div><img class="chara" alt=""><div class="name"></div>`;
    el.querySelector('.chara').src = mine ? myCharaSrc() : A.charaUri(oppChara(G.bot));
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
  // labels：ボタンの文字（{ yes, no }）。no：やめたときにすること
  function confirmBox(text, yes, no, labels) {
    $('#cfText').textContent = text; $('#confirm').hidden = false;
    $('#cfYes').textContent = (labels && labels.yes) || 'はい'; $('#cfNo').textContent = (labels && labels.no) || 'やめる';
    $('#cfYes').onclick = () => { $('#confirm').hidden = true; yes(); };
    $('#cfNo').onclick = () => { $('#confirm').hidden = true; if (no) no(); };
  }

  /* ---------- ホーム描画 ---------- */
  function renderHome() {
    setImg($('#heroChara'), myCharaSrc());
    setImg($('#soloChara'), A.charaUri(charaIdx() === 0 ? 1 : 0));
    const ki = k => A.VARIANTS.findIndex(v => v.key === k);
    setImg($('#tileShop'), A.charaUri(ki('hinata'))); setImg($('#tileRec'), A.charaUri(ki('tono'))); setImg($('#tileRev'), A.charaUri(ki('gensai')));
    if (window.AVATAR) $('#homeAv').innerHTML = window.AVATAR.svg(S.av || window.AVATAR.PRESETS.girl);
    setImg($('#roomCharaA'), A.charaUri(ki('mike'))); setImg($('#roomCharaB'), A.charaUri(ki('shima')));
    // 新しく使えるようになったキャラを知らせる
    const nOpen = A.VARIANTS.filter((v, i) => charaOpen(i)).length;
    if (S.charaOpenN != null && nOpen > S.charaOpenN) {
      const nv = A.VARIANTS.filter((v, i) => charaOpen(i) && UNLOCK[v.key] > 0).sort((a, b) => UNLOCK[b.key] - UNLOCK[a.key])[0];
      if (nv) setTimeout(() => toast(`新しいキャラ「${nv.name}」が仲間になりました！ ルーム → キャラクターで選べます`, 5000), 600);
    }
    if (S.charaOpenN !== nOpen) { S.charaOpenN = nOpen; saveLocal(); }
    if (window.ROOM && !document.body.classList.contains('on-title')) window.ROOM.todayVisitor();
    if (window.AVATAR) $('#chipFace').innerHTML = window.AVATAR.thumb(S.av || window.AVATAR.PRESETS.girl, 'icon');
    $('#homeName').textContent = S.name;
    const dr = displayRank();
    $('#homeRank').textContent = `${RANKS[dr]}・${S.rating}`;
    renderRecord();
  }
  /* ---------- 戦績（タブ：囲碁9路・囲碁13路・ほかのゲーム） ---------- */
  const GAME_NAMES = { go: '囲碁', shogi: '将棋', othello: 'オセロ', mahjong: '麻雀', backgammon: 'バックギャモン', daifugo: '大富豪', chess: 'チェス' };
  let recTab = 'go9';
  function recTabs() {
    const tabs = [['go9', '囲碁', '9路'], ['go13', '囲碁', '13路']];
    for (const [g, sub] of Object.entries(S.statsAll || {})) {
      if (g === GAME || !sub) continue;
      for (const [k, v] of Object.entries(sub)) if (v && v.games > 0) tabs.push([g + ':' + k, GAME_NAMES[g] || g, Object.keys(sub).length > 1 ? k.replace(/^[a-z]+/, '') : '']);
    }
    return tabs;
  }
  function renderRecord() {
    const tabs = recTabs();
    if (!tabs.some(t => t[0] === recTab)) recTab = 'go9';
    $('#recTabs').innerHTML = tabs.map(([k, g, sub]) => `<button type="button" role="tab" data-rt="${k}" aria-selected="${k === recTab}">${g}${sub ? `<small>${sub}</small>` : ''}</button>`).join('');
    const other = recTab.includes(':');
    $('#recMine').hidden = other; $('#recOther').hidden = !other;
    if (other) {
      const [g, k] = recTab.split(':'), v = (S.statsAll[g] || {})[k] || {};
      $('#roName').textContent = GAME_NAMES[g] || g; $('#roRank').textContent = v.rn || '—'; $('#roRate').textContent = v.rating || '—';
      $('#roGames').textContent = v.games | 0; $('#roWin').textContent = v.games ? Math.round(v.wins / v.games * 100) + '%' : '—'; $('#roStreak').textContent = v.streak | 0;
      return;
    }
    const size = recTab === 'go13' ? 13 : 9, T = RS(size), dr = displayRank(size);
    $('#recRank').textContent = RANKS[dr];
    $('#homeRate').textContent = T.rating;
    const rr = rankFromRating(T.rating);
    let next = '';
    if (rr >= TH.length - 1 && dr === rr) { $('#rankBar').style.width = '100%'; next = '最高段位です'; }
    else if (dr < rr) { $('#rankBar').style.width = '100%'; next = `昇段まであと ${Math.max(0, DAN_STREAK - T.streak)} 連勝（${RANKS[rr]}のレートに到達済み）`; }
    else {
      const lo = TH[rr], hi = TH[rr + 1];
      $('#rankBar').style.width = Math.max(0, Math.min(100, (T.rating - lo) / (hi - lo) * 100)) + '%';
      next = `${RANKS[rr + 1]}まで あと ${hi - T.rating}` + (rr + 1 >= DAN_FROM ? `（${DAN_STREAK}連勝も必要）` : '');
      if (T.rating < TH[0]) next = `10級の基準 ${TH[0]} を下回っています`;
    }
    $('#rankNext').textContent = next;
    $('#stGames').textContent = T.games;
    $('#stWin').textContent = T.games ? Math.round(T.wins / T.games * 100) + '%' : '—';
    $('#stStreak').textContent = T.streak;
    $('#stBlack').textContent = `${T.bw.bw}-${T.bw.bl}`;
    $('#stWhite').textContent = `${T.bw.ww}-${T.bw.wl}`;
    const ol = $('#history'); ol.innerHTML = '';
    const hist = S.history.filter(h => (h.size === 13 ? 13 : 9) === size);
    if (!hist.length) {
      const li = document.createElement('li'); li.className = 'empty';
      li.textContent = `まだ${size}路の対局がありません。対人戦で一局打ってみましょう。`;
      ol.append(li);
    }
    for (const h of hist.slice(0, 15)) {
      const li = document.createElement('li');
      const hk = h.draw ? ['d', '持'] : h.win ? ['w', '勝'] : ['l', '負'];
      if (h.rec) { li.className = 'rec'; li.title = 'タップで検討'; li.onclick = () => openReview(h.rec, h.size || 9); }
      li.innerHTML = h.friend ? `<span class="hk ${hk[0]}">${hk[1]}</span><span class="hn"></span><span class="hr"></span><span class="hd fr">友</span>`
        : `<span class="hk ${hk[0]}">${hk[1]}</span><span class="hn"></span><span class="hr"></span><span class="hd ${h.delta >= 0 ? 'up' : 'down'}">${h.delta >= 0 ? '+' : ''}${h.delta}</span>`;
      li.querySelector('.hn').textContent = h.op; const sm = document.createElement('small'); sm.textContent = (h.size === 13 ? '13路・' : '') + (h.color === 1 ? '黒番' : '白番') + (h.friend ? '・' + HC_NAME[h.hc || 0] : ''); li.querySelector('.hn').append(sm);
      li.querySelector('.hr').textContent = h.reason;
      ol.append(li);
    }
  }
  $('#recTabs').addEventListener('click', e => { const b = e.target.closest('[data-rt]'); if (!b) return; recTab = b.dataset.rt; sound('tap'); renderRecord(); });

  /* ---------- 画面の切り替え ---------- */
  const SCREENS = ['home', 'game', 'solo', 'reader', 'lesson', 'chara', 'record', 'myroom', 'pvp', 'friend', 'hub', 'avatar', 'shop', 'kotto', 'friends', 'explore', 'diaryHub'];
  // 対局のアイコン：アバターの顔（右下に相棒のキャラ）。Bot はキャラそのもの
  function setPb(el, look, ci) {
    const AVT = window.AVATAR;
    if (look && AVT) el.innerHTML = `${AVT.thumb(look, 'icon')}<img class="pb-chara" src="${A.faceUri(ci)}" alt="">`;
    else el.innerHTML = `<img class="pb-solo" src="${A.faceUri(ci)}" alt="">`;
  }
  function showScreen(id) {
    for (const k of SCREENS) $('#' + k).hidden = k !== id;
    document.dispatchEvent(new CustomEvent('kuro9screen', { detail: id }));
    A.setPetals(id === 'game' || id === 'lesson' ? 5 : id === 'reader' ? 14 : 10);
  }

  /* ---------- 対局 ---------- */
  let G = null, gameSeq = 0, R = null;
  const clockOf = c => G.clock[c] - (G.toPlay === c && !G.over ? performance.now() - G.turnStart : 0);
  const fmt = ms => { ms = Math.max(0, ms); const s = Math.ceil(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

  function newGame(bot, myColor, opts) {
    opts = opts || {};
    gameSeq++;
    setSize(opts.size || (opts.hc && opts.hc.size) || 9);
    G = {
      id: gameSeq, board: new Array(BN * BN).fill(0), toPlay: 1, ko: -1, me: myColor, bot,
      caps: { 1: 0, 2: 0 }, clock: { 1: MAIN_MS, 2: MAIN_MS }, turnStart: performance.now(),
      passes: 0, moveNo: 0, last: -1, over: false, record: [], solo: opts.solo || null, pend: -1, thinking: false, net: null, final: null, lastDrop: -1,
      online: opts.online || null, oppAway: 0,
      hc: opts.hc || null, friend: !!opts.hc, komi: opts.hc ? opts.hc.komi : KOMI, size: BN
    };
    if (BN === 13) G.clock = { 1: MAIN_MS * 2, 2: MAIN_MS * 2 };   // 13路は10分
    // フレンド戦のハンデ：置き石を先に並べて、白から打つ
    if (G.hc) {
      G.clock = { 1: G.hc.min * 60000, 2: G.hc.min * 60000 };
      for (const p of hcStones(G.hc.h, BN)) G.board[p] = 1;
      if (G.hc.h >= 2) G.toPlay = 2;
    }
    if (!G.online && econOn()) { G.botId = 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); netSend({ t: 'botstart', g: G.botId, lv: bot.level, solo: !!G.solo }); }
    if (!G.solo) { try { localStorage.setItem(KEY + '.active', JSON.stringify({ op: bot.rating, color: myColor, name: bot.name, g: G.online ? G.online.g : null, friend: G.friend || undefined, h: G.hc ? G.hc.h : undefined, size: BN })); } catch (e) {} }
    showScreen('game'); setMode('play');
    setPb($('#meAvatar'), S.av || (window.AVATAR && window.AVATAR.PRESETS.girl), charaIdx()); $('#meName').textContent = S.name; $('#meRank').textContent = `${BN === 13 ? '13路 ' : ''}${RANKS[displayRank(BN)]} ${RS(BN).rating}`;
    if (bot.human) { setPb($('#opAvatar'), bot.av, bot.ava); $('#opName').textContent = bot.name; $('#opRank').textContent = `${RANKS[rankFromRating(bot.rating)]} ${bot.rating}・${G.friend ? 'フレンド' : 'オンライン'}`; }
    else { setPb($('#opAvatar'), null, oppChara(bot)); $('#opName').textContent = `${A.VARIANTS[oppChara(bot)].name}（${bot.name}）`; $('#opRank').textContent = `${RANKS[bot.level]} ${bot.rating}`; }
    // 対局のはじめの台詞（自分・相手）
    setTimeout(() => {
      sayAt($('#meAvatar'), lnText(S.av, 's'), 'up');
      if (bot.human && bot.av) sayAt($('#opAvatar'), lnText(bot.av, 's'), 'down');
    }, 1000);
    $('#meStone').className = 'mini-stone ' + (myColor === 1 ? 'b' : 'w');
    $('#opStone').className = 'mini-stone ' + (myColor === 1 ? 'w' : 'b');
    $('#passBtn').disabled = false; $('#resignBtn').disabled = false; $('#resignBtn').textContent = '投了';
    render();
    banner('お願いします', G.hc ? `${HC_NAME[G.hc.h]}・${myColor === 1 ? 'あなたは黒番' : 'あなたは白番'}${G.hc.h >= 2 ? (myColor === 2 ? '（白から）' : '（白から打ちます）') : ''}` : myColor === 1 ? 'あなたは黒番・先手' : 'あなたは白番');
    if (navigator.wakeLock) navigator.wakeLock.request('screen').then(l => { G && (G.wake = l); }).catch(() => {});
    if (!navigator.onLine) netDown();
    stopPonder();
    if (opts.moves) replayQuiet(opts.moves);
    nextTurn();
    ponder();
  }

  // 再接続したとき、それまでの手を演出なしで並べ直す
  function replayQuiet(moves) {
    for (const p of moves) {
      const c = G.toPlay;
      G.record.push(p); G.moveNo++;
      if (p < 0) { G.passes++; G.ko = -1; G.last = -1; }
      else { const r = E.play(G.board, p, c, G.ko); if (!r) continue; G.board = r.board; G.ko = r.ko; G.caps[c] += r.cap.length; G.last = p; G.passes = 0; }
      G.toPlay = 3 - c;
    }
    render();
  }

  function render() {
    const st = $('#stones'), mk = $('#marks'), tr = $('#terr');
    let s = '';
    const deadSet = G.final ? new Set(G.final.dead) : null;
    for (let p = 0; p < BN * BN; p++) {
      const v = G.board[p]; if (!v) continue;
      const x = p % BN + 0.5, y = ((p / BN) | 0) + 0.5;
      const cls = 'stone' + (p === G.lastDrop ? ' drop' : '') + (deadSet && deadSet.has(p) ? ' dead' : '');
      s += `<g class="${cls}"><circle cx="${x + .04}" cy="${y + .06}" r=".46" fill="#000" opacity=".28"/><circle cx="${x}" cy="${y}" r=".46" fill="url(#g${v === 1 ? 'B' : 'W'})"/></g>`;
    }
    if (G.pend >= 0 && !G.board[G.pend]) {
      const x = G.pend % BN + 0.5, y = ((G.pend / BN) | 0) + 0.5;
      s += `<circle cx="${x}" cy="${y}" r=".44" fill="url(#g${G.me === 1 ? 'B' : 'W'})" opacity=".55"/><circle cx="${x}" cy="${y}" r=".2" fill="none" stroke="#e0503e" stroke-width=".06"/>`;
    }
    st.innerHTML = s;
    G.lastDrop = -1;
    let m = '';
    if (G.last >= 0 && G.board[G.last]) {
      const x = G.last % BN + 0.5, y = ((G.last / BN) | 0) + 0.5;
      m = `<circle cx="${x}" cy="${y}" r=".17" fill="none" stroke="${G.board[G.last] === 1 ? '#fff3dc' : '#e0503e'}" stroke-width=".07"/>`;
    }
    mk.innerHTML = m;
    let t = '';
    if (G.final) for (let p = 0; p < BN * BN; p++) {
      const o = G.final.terr[p]; if (!o) continue;
      const x = p % BN + 0.5, y = ((p / BN) | 0) + 0.5;
      t += `<rect x="${x - .14}" y="${y - .14}" width=".28" height=".28" rx=".04" fill="${o === 1 ? '#111' : '#f4f2ea'}" stroke="${o === 1 ? '#f4f2ea55' : '#11111155'}" stroke-width=".02"/>`;
    }
    tr.innerHTML = t;
    $('#meCaps').textContent = G.caps[G.me]; $('#opCaps').textContent = G.caps[3 - G.me];
    $('#meBar').classList.toggle('active', !G.over && G.toPlay === G.me);
    $('#opBar').classList.toggle('active', !G.over && G.toPlay !== G.me);
    const tm = $('#turnMsg');
    if (G.over) tm.textContent = '対局終了';
    else if (G.toPlay === G.me) tm.innerHTML = G.pend >= 0 ? '<b>もう一度タップで確定</b>' : (G.passes ? '相手はパスしました。<b>あなたの番</b>' : '<b>あなたの番</b>');
    else tm.textContent = G.oppAway ? '相手の通信が切れています…' : '相手が考えています…';
    awayMsg();
    tickClocks();
  }

  function awayMsg() {
    if (!G || G.over || !G.oppAway || G.toPlay === G.me) return;
    const left = Math.max(0, Math.ceil((G.oppAway - Date.now()) / 1000));
    $('#turnMsg').innerHTML = `相手の通信が切れています <b>${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}</b>（戻らなければあなたの勝ち）`;
  }
  function tickClocks() {
    if (!G) return;
    const me = clockOf(G.me), op = clockOf(3 - G.me);
    $('#meClock').textContent = fmt(me); $('#opClock').textContent = fmt(op);
    $('#meClock').classList.toggle('low', !G.over && G.toPlay === G.me && me < 30000);
    $('#opClock').classList.toggle('low', !G.over && G.toPlay !== G.me && op < 30000);
    awayMsg();
    if (!G.over && clockOf(G.toPlay) <= 0) {
      if (G.online) return;   // 対人戦の時間切れはサーバーが判定する
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

  function doMove(p, c, remote) {
    const r = E.play(G.board, p, c, G.ko);
    if (!r) return false;
    if (G.online && !remote) netSend({ t: 'move', g: G.online.g, n: G.record.length, p });
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

  function doPass(c, remote) {
    if (G.online && !remote) netSend({ t: 'move', g: G.online.g, n: G.record.length, p: -1 });
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
    if (G.over || G.toPlay === G.me || G.online) return;
    const g = G, id = G.id, mv = G.moveNo;
    g.thinking = true;
    const t0 = performance.now();
    const r = await ask({ type: 'think', size: BN, board: g.board, toPlay: g.toPlay, ko: g.ko, level: g.bot.level, timeLeft: clockOf(g.toPlay), komi: g.komi, moveNum: g.moveNo, oppPassed: g.passes === 1, last: g.last, rec: g.hc ? null : g.record.slice() });
    const wait = Math.max(0, Math.min(4800 - (performance.now() - t0), 500 + Math.random() * 600 - (performance.now() - t0)));
    await new Promise(res => setTimeout(res, wait));
    if (!G || G.id !== id || G.over || G.moveNo !== mv) return;
    g.thinking = false;
    if (r.resign) { endGame(g.me, '中押し'); return; }
    if (r.move < 0 || !doMove(r.move, g.toPlay)) doPass(g.toPlay);
  }

  // 整地：死に石をエンジンで判定して、地を数える
  async function computeScore() {
    const r = await ask({ type: 'score', board: G.board, n: 800 });
    const b = G.board.slice(), dead = [];
    for (let p = 0; p < BN * BN; p++) {
      if ((b[p] === 1 && r.own[p] < -0.3) || (b[p] === 2 && r.own[p] > 0.3)) { dead.push(p); b[p] = 0; }
    }
    const terr = new Array(BN * BN).fill(0), seen = new Array(BN * BN).fill(false);
    for (let p = 0; p < BN * BN; p++) {
      if (b[p] || seen[p]) continue;
      const reg = [p], border = new Set(); seen[p] = true;
      for (let i = 0; i < reg.length; i++) for (const q of E.NB[reg[i]]) {
        if (b[q]) border.add(b[q]); else if (!seen[q]) { seen[q] = true; reg.push(q); }
      }
      if (border.size === 1) { const o = [...border][0]; for (const q of reg) terr[q] = o; }
    }
    let black = 0, white = 0;
    for (let p = 0; p < BN * BN; p++) { const o = b[p] || terr[p]; if (o === 1) black++; else if (o === 2) white++; }
    const fterr = terr.map((v, p) => b[p] ? 0 : v);
    for (const p of dead) fterr[p] = 3 - G.board[p];
    const margin = black - (white + G.komi);
    return { dead, terr: fterr, black, white, winner: margin > 0 ? 1 : margin < 0 ? 2 : 0 };
  }
  function applyScore(res) {
    G.final = { dead: res.dead || [], terr: res.terr || new Array(BN * BN).fill(0) };
    render();
    const pts = Math.abs(res.black - (res.white + G.komi));
    endGame(res.winner, res.winner === 0 ? '持碁' : `${pts}目${res.winner === G.me ? '勝ち' : '負け'}`, `黒 ${res.black}  ／  白 ${res.white}${G.komi ? ' + コミ ' + G.komi : '（コミなし）'}`, true);
  }
  async function scoreGame() {
    G.over = true;
    $('#turnMsg').textContent = '整地しています…';
    const g = G, id = G.id;
    if (G.online) {
      // 対人戦：黒番のアプリが整地してサーバーへ。白番は12秒待っても来なければ自分で整地する
      const send = async () => { const res = await computeScore(); if (G === g && !G.final) netSend({ t: 'score', g: g.online.g, res }); };
      if (G.me === 1) send(); else g.online.scoreT = setTimeout(send, 12000);
      return;
    }
    const res = await computeScore();
    if (!G || G.id !== id) return;
    applyScore(res);
  }

  // Bot との対局：自分よりレートの低い Bot に勝っても、レートは上がらない（負ければ下がる）
  function applyRating(score, opRating, color, opName, reason, rec, size, vsBot) {
    size = size === 13 ? 13 : (size || BN) === 13 ? 13 : 9;
    const T = RS(size);   // 9路と13路は別に数える
    const win = score === 1, draw = score === 0.5;
    const old = T.rating, oldRank = displayRank(size);
    let d = eloDelta(T.rating, opRating, score, T.games), capped = false;
    if (vsBot && d > 0 && opRating < T.rating) { d = 0; capped = true; }
    T.rating = Math.max(800, T.rating + d);
    T.games++;
    if (win) { T.wins++; T.streak++; } else if (draw) T.draws = (T.draws || 0) + 1; else T.streak = 0;
    if (!draw) { if (color === 1) win ? T.bw.bw++ : T.bw.bl++; else win ? T.bw.ww++ : T.bw.wl++; }
    const rr = rankFromRating(T.rating);
    if (rr >= DAN_FROM && T.streak >= DAN_STREAK && rr > T.earnedDan) T.earnedDan = rr;
    S.history.unshift({ win, draw, op: opName, opid: G && G.bot && G.bot.pid || null, color, reason, delta: d, size: size || BN, t: Date.now(), rec: rec || null });
    S.history = S.history.slice(0, 30);
    save();
    try { localStorage.removeItem(KEY + '.active'); } catch (e) {}
    const nr = displayRank(size), rname = (size === 13 ? '13路' : '') + RANKS[nr];
    if (nr > oldRank) {
      if (window.TICKER) window.TICKER.mine({ type: 'myrank', rank: rname });
      if (econOn()) { APP_SOC('rank', { rank: rname }); netSend({ t: 'rankup', rank: nr, name: rname, key: 'go' + size }); }   // ごほうび1000銭はプレゼントボックスへ（9路・13路それぞれ）
      else { T.rankGift = T.rankGift || []; if (!T.rankGift.includes(nr) && window.GIFT) { T.rankGift.push(nr); window.GIFT.add('rank', 1000, `${rname}昇格のごほうび`); } }
    }
    return { old, d, oldRank, newRank: nr, capped, size };
  }

  // フレンド戦の記録：レート・勝率は変えず、棋譜だけ残す（置き石は「黒・白パス」の形で棋譜の頭に入れる）
  function friendRecord(win, draw, color, opName, reason, rec, h, size) {
    S.history.unshift({ win, draw, op: opName, opid: G && G.bot && G.bot.pid || null, color, reason, delta: 0, friend: true, hc: h || 0, size: size || BN, t: Date.now(), rec: rec || null });
    S.history = S.history.slice(0, 30);
    save();
    try { localStorage.removeItem(KEY + '.active'); } catch (e) {}
    return { friend: true };
  }

  function endGame(winner, reason, scoreText, scored) {
    if (!G || (G.over && !scored)) return;
    G.over = true; G.thinking = false;
    stopPonder();
    if (G.wake) { G.wake.release().catch(() => {}); G.wake = null; }
    if (G.net) { clearInterval(G.net.timer); G.net = null; $('#netdown').hidden = true; }
    if (G.online) { clearTimeout(G.online.scoreT); G.oppAway = 0; }
    const win = winner === G.me, draw = winner === 0;
    let label = reason;
    if (reason === '中押し') label = win ? '中押し勝ち' : '中押し負け';
    if (reason === '時間切れ') label = win ? '時間切れ勝ち' : '時間切れ負け';
    if (reason === '切断') label = win ? '切断勝ち' : '切断負け';
    const r = G.solo ? null : G.friend ? friendRecord(win, draw, G.me, G.bot.name, label, hcRec(G.hc.h, BN).concat(G.record), G.hc.h) : applyRating(draw ? 0.5 : win ? 1 : 0, G.bot.rating, G.me, G.bot.name, label, G.record.slice(), BN, !G.bot.human);
    // 銭：対局1回につき100（勝ち負けに関係なく。フレンド戦はなし）。勝った相手のキャラは「5勝で遊びに来る」の数にかぞえる
    const zeni = G.friend || G.record.length < (G.online ? 10 : 16) ? 0 : 100;   // 10手未満（Botは16手未満）で終わった対局は、銭なし（すぐ投了してかせぐのを防ぐ）
    G.zeniBase = S.zeni || 0;
    if (win && !G.friend) { const k = A.VARIANTS[oppChara(G.bot)].key; S.vs[k] = (S.vs[k] || 0) + 1; }
    G.zeni = zeni;
    if (econOn()) {
      // 銭はサーバーが決める（対人戦はサーバーが結果を知っている。Bot戦は時間と手数を確かめてから）
      if (!G.online && G.botId) netSend({ t: 'botend', g: G.botId, result: win ? 'win' : draw ? 'draw' : 'loss', moves: G.record.length });
    } else if (zeni) S.zeni += zeni;   // サーバーにつながっていないとき（お試し版など）は、この端末で数える
    save();
    render();
    $('#passBtn').disabled = true; $('#resignBtn').disabled = true;
    setTimeout(() => showResult(draw ? 0 : win ? 1 : -1, label, scoreText || '', r), scored ? 900 : 500);
  }

  // 結果画面：右上に持っている銭（もらった銭が飛んで合わさる）、右の三分の一に相手、下に大きな「もう一局」（ハンコのように出る）
  let resT = [];
  function resultExtras(r) {
    resT.forEach(clearTimeout); resT = [];
    const base = G.zeniBase != null ? G.zeniBase : (S.zeni || 0) - (G.zeni || 0), gain = G.zeni || 0;
    const wn = $('#resWalletN'); wn.textContent = base.toLocaleString(); $('#resWallet').classList.remove('bump');
    const zc = $('#resZeni'); zc.classList.remove('fly'); zc.style.removeProperty('--fx'); zc.style.removeProperty('--fy');
    if (gain) resT.push(setTimeout(() => {
      // 「＋100銭」が右上の合計へ飛んで、数字がふえる
      const a = zc.getBoundingClientRect(), b = $('#resWallet').getBoundingClientRect();
      zc.style.setProperty('--fx', `${b.left + b.width / 2 - (a.left + a.width / 2)}px`); zc.style.setProperty('--fy', `${b.top + b.height / 2 - (a.top + a.height / 2)}px`);
      zc.classList.add('fly');
      resT.push(setTimeout(() => {
        const t0 = performance.now(), dur = 700; sound('ok');
        $('#resWallet').classList.add('bump');
        const step = () => { const k = Math.min(1, (performance.now() - t0) / dur); wn.textContent = Math.round(base + gain * k).toLocaleString(); if (k < 1) requestAnimationFrame(step); };
        requestAnimationFrame(step);
      }, 650));
    }, 1100));
    // 相手（名前・アバター・レート・上下したレート）
    const op = G.bot, box = $('#resOpp');
    box.hidden = !op || !!G.solo;
    if (op && !G.solo) {
      $('#resOppFig').innerHTML = op.human && window.AVATAR ? window.AVATAR.svg(op.av || window.AVATAR.PRESETS.girl) : `<img src="${A.charaUri(oppChara(op))}" alt="">`;
      $('#resOppName').textContent = op.human ? op.name : `${A.VARIANTS[oppChara(op)].name}（${op.name}）`;
      let d = null;
      if (op.human && r && !r.friend) d = eloDelta(op.rating, r.old, r.d > 0 ? 0 : r.d < 0 ? 1 : 0.5, 20);
      $('#resOppRate').textContent = d == null ? `レート ${op.rating}` : `${op.rating} → ${op.rating + d}`;
      const de = $('#resOppDelta'); de.textContent = d == null ? (G.friend ? 'レート変動なし' : 'Botのレートは変わりません') : (d >= 0 ? '+' : '') + d; de.className = d == null ? '' : d >= 0 ? 'up' : 'down';
      // 人が相手なら、タップで戦績（そこからフレンド申請）
      const tap = !!(op.human && op.pid && window.PROFILE);
      box.classList.toggle('tappable', tap);
      let hint = box.querySelector('.res-opp-tap'); if (!hint) { hint = document.createElement('small'); hint.className = 'res-opp-tap'; box.append(hint); }
      hint.textContent = tap ? 'タップで戦績・フレンド申請' : '';
      box.onclick = tap ? () => { sound('tap'); window.PROFILE.open(op.pid, op); } : null;
    }
    // 「もう一局」は、少したってからハンコのように押される
    const ag = $('#resAgain'); ag.classList.remove('stamped'); ag.style.visibility = 'hidden';
    resT.push(setTimeout(() => { ag.style.visibility = ''; void ag.offsetWidth; ag.classList.add('stamped'); setTimeout(() => sound('stone'), 330); }, gain ? 2300 : 1300));
  }
  /* ---------- 台詞（アバターの吹き出し）：対局のはじめ・勝ち・負け・おわり ---------- */
  const lnText = (look, k) => { const id = look && look.ln && look.ln[k]; return id && window.AVATAR ? window.AVATAR.LINE_TEXT[id] : ''; };
  function sayAt(el, text, dir, ms) {
    if (!el || !text) return;
    const old = el.querySelector(':scope > .say-bubble'); if (old) old.remove();
    const b = document.createElement('div'); b.className = 'say-bubble ' + (dir || 'up'); b.textContent = text;
    el.append(b); setTimeout(() => { b.classList.add('out'); setTimeout(() => b.remove(), 400); }, ms || 3200);
  }
  // 勝ち・負けの台詞 → おわりの台詞 の順に
  function sayEnd(el, look, win, dir) {
    const a = lnText(look, win > 0 ? 'w' : win < 0 ? 'l' : ''), e = lnText(look, 'e');
    if (a) { sayAt(el, a, dir, 2600); if (e) setTimeout(() => sayAt(el, e, dir, 3000), 2900); }
    else if (e) sayAt(el, e, dir, 3200);
  }
  function showResult(win, label, scoreText, r) {
    const k = $('#resKanji');
    k.textContent = win > 0 ? '勝' : win === 0 ? '持' : '負';
    const rc = $('#resChara'); setImg(rc, myCharaSrc()); rc.className = 'res-chara' + (win < 0 ? ' lose' : '');
    k.className = 'res-kanji ' + (win > 0 ? '' : 'lose');
    void k.offsetWidth; k.classList.add('pop');
    $('#resReason').textContent = label;
    $('#resZeni').hidden = !G.zeni; $('#resZeni').textContent = `＋${G.zeni} 銭`;
    resultExtras(r);
    $('#resHome').hidden = true;
    $('#resClose').onclick = leaveGame;
    $('#resScore').textContent = scoreText;
    if (win > 0) { const kr = k.getBoundingClientRect(); setTimeout(() => A.burst(kr.left + kr.width / 2, kr.top + kr.height / 2, 'win'), 250); sound('ok'); }
    // 台詞：自分（キャラの上）と、相手（人のとき）
    setTimeout(() => {
      sayEnd($('#resChara').parentNode, S.av, win, 'up');
      if (G && G.bot && G.bot.human && G.bot.av) sayEnd($('#resOppFig'), G.bot.av, -win, 'up');
    }, 900);
    const pr = $('#resPromo');
    $('#resRate').hidden = !r || !!r.friend;
    $('#resAgain').textContent = 'もう一局';
    $('#resAgain').onclick = () => { const sz = G && G.size; leaveGame(); startMatch(sz); };
    $('#resAgain').disabled = false;
    if (r && r.friend) {
      // フレンド戦：レートは動かない。「もう一局」は相手にも申しこむ
      pr.hidden = false; pr.textContent = `フレンドマッチ・${HC_NAME[G.hc.h]}（レート変動なし）`;
      const g = G.online.g, opp = G.bot;
      $('#resAgain').textContent = G.reAsk ? 'もう一局（相手が待っています）' : 'もう一局';
      $('#resAgain').onclick = () => {
        if (!NET.ok) { toast('サーバーにつながっていません'); return; }
        netSend({ t: 'rematch', g });
        M = { friend: true, rematch: true, found: false, t0: Date.now(), timer: 0, opp };
        $('#resAgain').disabled = true; $('#resAgain').textContent = '相手の返事を待っています…';
      };
      $('#resHome').onclick = leaveGame;
      $('#result').hidden = false;
      return;
    }
    if (!r) {
      // ソロモードのミッション対局（レートは変わらない）
      const solo = G.solo, cleared = win > 0;
      pr.hidden = false; pr.textContent = cleared ? 'ミッションクリア！' : 'ミッション失敗……もう一度挑戦しよう';
      $('#resAgain').textContent = cleared ? '続きを読む' : 'もう一度挑戦';
      $('#resAgain').onclick = () => { $('#result').hidden = true; const g = G; G = null; solo.done(cleared, g); };
      // 勝ったら、どのボタンで閉じても続きが読めるようにする（✕や「もどる」で閉じても、ミッションはクリア）
      G.soloCleared = cleared;
      if (cleared && solo.won) solo.won();   // 勝った時点で、続きを読めるようにしておく（アプリを閉じても大丈夫）
      $('#resHome').onclick = () => { $('#result').hidden = true; G = null; if (cleared) solo.done(true); else solo.back(); };
      $('#resHome').hidden = false; $('#resClose').onclick = () => $('#resHome').click();
      $('#result').hidden = false;
      return;
    }
    $('#resHome').onclick = leaveGame;
    $('#resOld').textContent = r.old; $('#resNew').textContent = RS(r.size).rating;
    const de = $('#resDelta'); de.textContent = (r.d >= 0 ? '+' : '') + r.d; de.className = r.d >= 0 ? 'up' : 'down';
    if (r.newRank > r.oldRank) {
      pr.hidden = false; pr.textContent = `${r.size === 13 ? '13路 ' : ''}${RANKS[r.newRank]}に昇${r.newRank >= DAN_FROM ? '段' : '級'}！`;
      // 盛大に：ハンコがとんできて「〇級昇格」。ごほうびと、使えるようになったキャラ
      const nu = A.VARIANTS.map((v, i) => i).filter(i => UNLOCK[A.VARIANTS[i].key] > r.oldRank && UNLOCK[A.VARIANTS[i].key] <= r.newRank);
      const rw = ['ごほうび 1000銭（プレゼントボックスに届きました）'].concat(nu.map(i => `「${A.VARIANTS[i].name}」をキャラクターに選べるようになりました！`));
      setTimeout(() => window.FX && window.FX.stamp({ kicker: r.newRank >= DAN_FROM ? '昇段' : '昇級', stamp: RANKS[r.newRank] + '昇格', title: `${RANKS[r.newRank]}に昇格しました！`, rewards: rw, chara: nu.length ? nu[nu.length - 1] : charaIdx(), kind: 'rank' }), 700);
    }
    else if (r.newRank < r.oldRank) { pr.hidden = false; pr.textContent = `${RANKS[r.newRank]}に降${r.newRank >= DAN_FROM ? '段' : '級'}`; }
    else if (r.capped) { pr.hidden = false; pr.textContent = '自分よりレートの低い相手（Bot）に勝っても、レートは上がりません。強い相手に挑戦しよう！'; }
    else pr.hidden = true;
    $('#result').hidden = false;
  }

  // 対人戦・Bot戦をやめたら「対人戦」の画面へもどる
  function leaveGame() {
    if (M && M.rematch) M = null;
    $('#result').hidden = true;
    const size = G && G.size;
    G = null; renderHome();
    openPvp();
    if (size && window.FRIEND && window.FRIEND.setSize) window.FRIEND.setSize(size);
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

  /* ---------- 対人戦サーバー（Cloudflare） ---------- */
  // 同じサイトの /ws につなぐ（Cloudflare で公開したとき）。別の場所で開くときは config.js で指定
  const NET_URL = window.KURO9_WS || ((/\.workers\.dev$/.test(location.hostname) || location.port === '8787') ? (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws' : '');
  const ONLINE_WAIT_MS = 20000;   // 人が見つからないときに Bot に切り替えるまで
  if (!S.cid) { S.cid = 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10); save(); }
  const NET = { ws: null, ok: false, retry: 0, online: 0, seeking: 0, pingT: 0 };
  function netConnect() {
    NET.paused = false;
    if (!NET_URL || (NET.ws && NET.ws.readyState <= 1)) return;
    let ws;
    try { ws = new WebSocket(NET_URL); } catch (e) { return; }
    NET.ws = ws;
    ws.onopen = () => {
      NET.ok = true; NET.retry = 0;
      netAuth();
      netHello();
      if (M && !M.found && !M.friend) netSend({ t: 'seek', size: M.size, rating: RS(M.size).rating });
      if (M && M.friend && !M.found && M.redo) M.redo();   // フレンドマッチ：つながってから部屋をつくる／入る
      clearInterval(NET.pingT); NET.pingT = setInterval(() => netSend({ t: 'ping' }), 40000);   // つながっているかの確認（40秒ごと）
    };
    ws.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch (err) { return; } netMsg(m); };
    ws.onclose = () => {
      if (NET.ws !== ws) return;
      NET.ok = false; NET.ws = null; clearInterval(NET.pingT);
      if (G && G.online && !G.over) netDown();
      if (NET.paused) return;   // 裏に回して休んでいるときはつなぎ直さない
      // つなぎ直しは少しずつ間をあける（最大60秒・ばらつきあり）。サーバーが止まっても一斉に押しよせないように
      const wait = Math.min(60000, 1000 * 2 ** NET.retry++) * (0.7 + Math.random() * 0.6);
      setTimeout(netConnect, wait);
    };
  }
  function netSend(m) { if (NET.ws && NET.ws.readyState === 1) NET.ws.send(JSON.stringify(m)); }
  function netHello() { netSend({ t: 'hello', cid: S.cid, name: S.name, rating: S.rating, ava: charaIdx() }); }

  /* ---------- アカウント：保存データをサーバーにも置く ----------
   * はじめて開いたとき、サーバーが ID とパスワード（各8文字）を作る。
   * 以後、保存のたびにサーバーへ送る。別の端末では ID とパスワードで引き継げる。 */
  const LOCAL_ONLY = ['acct', 'cid', '_at', 'zeni', 'room', 'av', 'avOwned', 'pid', 'myNotes', 'visitDay', 'visitGhost', 'gifts', 'loginDay', 'rankGift', 'tama', 'charaBuy', 'statsAll', 'offer'];   // 銭と部屋はサーバーが別に管理する
  const fmtCode = c => c ? String(c).replace(/(.{4})(?=.)/g, '$1-') : '';
  const normCode = v => String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
  function syncData() {
    const d = {};
    for (const k in S) if (!LOCAL_ONLY.includes(k)) d[k] = S[k];
    // 大きくなりすぎたら、古い対局の棋譜から省く
    if (JSON.stringify(d).length > 100000 && Array.isArray(d.history)) d.history = d.history.map((h, i) => i < 10 ? h : Object.assign({}, h, { rec: null }));
    return d;
  }
  // サーバーへの保存は、変更が落ち着いてから10秒後にまとめて1回。中身が前回と同じなら送らない
  let syncT = 0, lastSent = '';
  function netSync() {
    clearTimeout(syncT); syncT = 0;
    if (!(NET.ok && NET.authed)) return;
    const data = syncData(), js = JSON.stringify(data);
    if (js === lastSent) return;
    lastSent = js;
    netSend({ t: 'sync', game: GAME, data, stats: statsOut(), at: S._at || Date.now() });
  }
  syncHook = () => { if (!syncT) syncT = setTimeout(netSync, 10000); };
  // アプリを裏に回したら：未送信の保存をすぐ送る。2分たっても裏のまま（対局・マッチング中以外）なら接続を休む
  let hideT = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (syncT) netSync();
      clearTimeout(hideT);
      hideT = setTimeout(() => {
        if (!document.hidden || (G && G.online && !G.over) || M) return;
        NET.paused = true; clearInterval(NET.pingT);
        if (NET.ws) { const w = NET.ws; NET.ws = null; NET.ok = false; NET.authed = false; try { w.close(); } catch (e) {} }
      }, 120000);
    } else { clearTimeout(hideT); if (NET_URL && !NET.ws) { NET.retry = 0; netConnect(); } }
  });
  function netAuth() {
    NET.authed = false;
    if (S.acct && S.acct.id) netSend({ t: 'login', game: GAME, id: S.acct.id, pass: S.acct.pass });
    else netSend({ t: 'register', game: GAME });
  }
  function applyServerData(d, at) {
    const keep = { acct: S.acct, cid: S.cid, zeni: S.zeni, room: S.room, av: S.av, avOwned: S.avOwned, pid: S.pid, tama: S.tama, charaBuy: S.charaBuy, statsAll: S.statsAll };
    for (const k of Object.keys(S)) delete S[k];
    Object.assign(S, fresh(), d || {}, keep, { _at: at || Date.now() });
    S.settings = Object.assign({ confirm: true, fx: true, sound: true, bgm: true, board: 'kaya', tickerMode: 'all' }, S.settings);
    S.solo = Object.assign({ mode: 'beginner', bot: 3, open: {}, lessons: [] }, S.solo);
    S.r13 = Object.assign(fresh13(), S.r13);
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {}
    document.body.classList.toggle('washi', S.settings.board === 'washi');
    renderHome();
    if (!$('#settings').hidden) renderSettings();
  }
  /* ---------- 銭・持ち物・部屋（サーバーが正） ---------- */
  const econOn = () => !!(NET_URL && NET.ok && NET.authed);
  function applyEcon(e, layout) {
    if (!e) return;
    if (typeof e.zeni === 'number') S.zeni = e.zeni;
    if (e.gifts && window.GIFT) window.GIFT.setGifts(e.gifts);
    if (e.welcome) setTimeout(() => toast('ようこそ！ プレゼントボックスに3000銭が届いています', 5000), 1200);
    const r = S.room = S.room || {};
    if (e.owned) { r.ownedItems = Object.assign({}, e.owned.items); r.owned = { floors: e.owned.floors.slice(), walls: e.owned.walls.slice() }; S.avOwned = (e.owned.av || []).slice(); }
    if (e.av) S.av = e.av;
    if (e.pid) S.pid = e.pid;
    if (e.tama) S.tama = e.tama[GAME] | 0;          // 勾玉（このアプリのぶん）
    if (e.charas) S.charaBuy = (e.charas[GAME] || []).slice();
    if (e.stats) S.statsAll = e.stats;               // 全ゲームの戦績のまとめ（戦績のタブ）
    if (layout === false && e.rooms2 && e.rooms2.length > (r.extra = r.extra || []).length) {   // 部屋を買った：新しい部屋だけ足す
      for (const x of e.rooms2.slice(r.extra.length)) r.extra.push({ floor: x.floor, wall: x.wall, items: x.items || [], walls: x.walls || [], at: x.at, n: x.n });
    }
    if (layout === false && e.room && r.items) {   // 部屋を広くした：大きさだけ合わせる
      if (e.room.n) r.n = e.room.n;
      (e.rooms2 || []).forEach((x, i) => { if (r.extra && r.extra[i] && x.n) r.extra[i].n = x.n; });
    }
    if (layout !== false && e.room) {
      Object.assign(r, { floor: e.room.floor, wall: e.room.wall, items: e.room.items, walls: e.room.walls, g: e.room.g, gp: e.room.gp, n: e.room.n });
      r.extra = (e.rooms2 || []).map(x => ({ floor: x.floor, wall: x.wall, items: x.items || [], walls: x.walls || [], av: x.av, g: x.g, gp: x.gp, at: x.at, n: x.n }));
      r.seq = Math.max(r.seq || 1, ...r.items.concat(r.walls).concat(...r.extra.map(x => x.items.concat(x.walls))).map(i => (i.uid | 0) + 1));
    }
    saveLocal(); renderHome();
    if (window.ROOM) window.ROOM.refresh();
  }
  const ZENI_WHY = { short: '短すぎる対局なので、銭はもらえませんでした', cap: '今日のBot戦の銭は上限（2000銭）に達しました' };
  function onZeni(m) {
    if (typeof m.zeni === 'number') S.zeni = m.zeni;
    saveLocal(); renderHome();
    if (window.ROOM) window.ROOM.refresh();
    if (ZENI_WHY[m.why]) { toast(ZENI_WHY[m.why], 3500); if (!$('#result').hidden) $('#resZeni').hidden = true; }
    else if (m.gained && m.why === 'episode') toast(`エピソードクリア！ ＋${m.gained} 銭`, 4000);
    else if (m.gained && (m.why === 'lesson' || m.why === 'drill')) toast(`＋${m.gained} 銭`);
  }
  let buyReq = 0; const buyCb = {}, socCb = {}, giftCb = {};
  const APP_SOC = (op, data, cb) => { const req = ++buyReq; if (cb) socCb[req] = cb; netSend(Object.assign({ t: 'soc', op, req }, data || {})); };
  function onAccount(m) {
    NET.authed = true;
    if (m.pass) { S.acct = { id: m.id, pass: m.pass }; save(); netSync(); }                 // 新しく作った
    else if (m.restore) {                                                                   // 別の端末から引き継いだ
      S.acct = { id: m.id, pass: NET.pendingPass }; NET.pendingPass = null;
      if (m.data) { applyServerData(m.data, m.at); toast('データを引き継ぎました'); }
      else if (m.name) { S.name = m.name; save(); netSync(); toast('この端末で、このIDの囲碁のデータを始めます'); }
      else { save(); netSync(); toast('このIDにはまだデータがないので、この端末のデータを保存しました'); }
    } else if (m.data && (m.at || 0) > (S._at || 0)) applyServerData(m.data, m.at);       // サーバーのほうが新しい
    else if ((S._at || 0) > (m.at || 0) || !m.data) netSync();                              // この端末のほうが新しい
    if (!$('#settings').hidden) renderAccount();
    applyEcon(m.econ);
    netHello();
  }
  function onAuthFail(m) {
    if (m.restore) { NET.pendingPass = null; toast('IDかパスワードがちがいます'); return; }
    // 保存していたIDが使えない（サーバー側で消えたなど）→ 新しく作り直す
    S.acct = null; netSend({ t: 'register', game: GAME });
  }
  function renderAccount() {
    const has = S.acct && S.acct.id;
    $('#acctId').textContent = has ? fmtCode(S.acct.id) : (NET_URL ? 'サーバーにつながると作られます' : '—');
    $('#acctPass').textContent = has ? (NET.showPass ? fmtCode(S.acct.pass) : '••••-••••') : '—';
    $('#acctShow').textContent = NET.showPass ? 'パスワードをかくす' : 'パスワードを表示';
    $('#acctShow').disabled = $('#acctCopy').disabled = !has;
  }
  const humanOpp = o => ({ human: true, pid: o.pid || null, av: o.av || null, name: String(o.name || 'プレイヤー').slice(0, 12), rating: o.rating | 0, ava: o.ava | 0, level: Math.min(BOT_MAX, rankFromRating(o.rating | 0)) });
  function setClocks(c) { if (!G || !c) return; G.clock[1] = c[1]; G.clock[2] = c[2]; G.turnStart = performance.now(); }
  function isMine(gid) { return G && G.online && G.online.g === gid; }

  function netMsg(m) {
    switch (m.t) {
      case 'lobby': NET.online = m.online; NET.seeking = m.seeking; if (M && !M.found) matchTick(); break;
      case 'start':
        if (M && !M.found) onlineFound(m);
        else netSend({ t: 'decline', g: m.g });   // もう Bot 戦を始めていた
        break;
      case 'aborted':
        if (isMine(m.g) && G.moveNo === 0) { const fr = G.friend; G = null; showScreen('home'); if (fr) { toast('相手の接続が切れました'); openFriend(); } else { toast('相手の接続が切れたので、もう一度探します'); startMatch(); } }
        else if (M && M.found && M.g === m.g) { clearTimeout(M.timer); const fr = M.friend; M = null; if (fr) { $('#matching').hidden = true; toast('相手の接続が切れました'); openFriend(); } else startMatch(); }
        break;
      case 'resume':
        if (isMine(m.g)) {
          // 自分の手が届いていなかったら送り直し、相手の手が抜けていたら並べる
          for (let n = G.record.length; n < m.moves.length; n++) { const p = m.moves[n], c = G.toPlay; p < 0 ? doPass(c, true) : doMove(p, c, true); }
          if (G.record.length > m.moves.length && G.toPlay !== G.me) netSend({ t: 'move', g: G.online.g, n: m.moves.length, p: G.record[m.moves.length] });
          setClocks(m.clock); G.oppAway = m.oppAway ? Date.now() + 180000 : 0; netUp(); render();
        } else if (!G) {
          stopMatch();
          if (!$('#title').hidden) { $('#title').hidden = true; document.body.classList.remove('on-title'); }
          newGame(humanOpp(m.opp), m.color, { online: { g: m.g }, moves: m.moves, hc: m.hc || null, size: m.size });
          setClocks(m.clock);
          toast('中断していた対局を再開しました');
          if (m.scoring) scoreGame();
        }
        break;
      case 'move':
        if (!isMine(m.g)) break;
        if (m.n === G.record.length && m.c === G.toPlay && m.c !== G.me) { m.p < 0 ? doPass(m.c, true) : doMove(m.p, m.c, true); }
        else if (m.n > G.record.length) { netHello(); break; }   // 抜けがある → 再開情報をもらう
        setClocks(m.clock);
        break;
      case 'away': if (isMine(m.g)) { G.oppAway = Date.now() + 180000; toast('相手の通信が切れました。3分戻らなければ、あなたの勝ちです'); render(); } break;
      case 'back': if (isMine(m.g)) { G.oppAway = 0; toast('相手が戻ってきました'); render(); } break;
      case 'end': onlineEnd(m); break;
      case 'account': onAccount(m); break;
      case 'zeni': onZeni(m); break;
      case 'sold': applyEcon(m.econ, false); if (buyCb[m.req]) { buyCb[m.req](m); delete buyCb[m.req]; } break;
      case 'bought': applyEcon(m.econ, false); if (buyCb[m.req]) { buyCb[m.req](m); delete buyCb[m.req]; } break;
      case 'roomsaved': if (!m.ok) { applyEcon(m.econ); toast('部屋の配置を保存できなかったので、元に戻しました'); } break;
      case 'authfail': onAuthFail(m); break;
      case 'gifts': if (m.econ) applyEcon(m.econ, false); if (giftCb[m.req]) { giftCb[m.req](m); delete giftCb[m.req]; } else if (window.GIFT) window.GIFT.setGifts(m.gifts); if (typeof m.zeni === 'number') { S.zeni = m.zeni; saveLocal(); renderHome(); } break;
      case 'soc':
        if (m.op === 'push') { if (window.TICKER) window.TICKER.push(m.item); break; }
        if (socCb[m.req]) { socCb[m.req](m); delete socCb[m.req]; } break;
      case 'froom': if (M && M.friend && !M.found) { M.code = m.code; if (window.FRIEND) window.FRIEND.onRoom(m); } break;
      case 'fnone': if (M && M.friend && M.joining) { M = null; } if (window.FRIEND) window.FRIEND.onNone(m); break;
      case 'rematch':
        if (G && G.online && G.online.g === m.g && G.over) {
          G.reAsk = true; toast('相手が「もう一局」を希望しています', 3500);
          if (!$('#resAgain').disabled) $('#resAgain').textContent = 'もう一局（相手が待っています）';
        }
        break;
    }
  }
  function onlineEnd(m) {
    if (isMine(m.g)) {
      if (m.res && !G.final) { applyScore(m.res); return; }     // 整地の結果
      if (G.final || $('#result').hidden === false) return;       // もう終わっている（自分の投了など）
      if (G.over && m.reason !== '整地') return;
      G.over = false; endGame(m.winner, m.reason === '整地' ? '持碁' : m.reason);
      return;
    }
    // アプリを閉じている間に終わっていた対局
    try {
      const act = JSON.parse(localStorage.getItem(KEY + '.active') || 'null');
      if (act && act.g === m.g && act.friend) {
        const label = m.winner === 0 ? '持碁' : m.winner === act.color ? '勝ち' : (m.reason === '切断' ? '切断負け' : '負け');
        friendRecord(m.winner === act.color, m.winner === 0, act.color, act.name, label, hcRec(act.h | 0, act.size).concat(m.moves || []), act.h | 0, act.size);
        toast(`前回のフレンド戦の結果：${label}`, 4500); renderHome();
      } else if (act && act.g === m.g) {
        const sc = m.winner === 0 ? 0.5 : m.winner === act.color ? 1 : 0;
        const label = sc === 1 ? '勝ち' : sc === 0.5 ? '持碁' : (m.reason === '切断' ? '切断負け' : '負け');
        const r = applyRating(sc, act.op, act.color, act.name, label, m.moves || null, act.size);
        toast(`前回の対局の結果：${label}（${r.d >= 0 ? '+' : ''}${r.d}）`, 4500); renderHome();
      }
    } catch (e) {}
  }

  /* ---------- 対人戦のえらびかた：ランダムマッチ／フレンドマッチ ---------- */
  // 置き石の位置（9路）：右上・左下・右下・左上・天元の順
  const HC_PTS = { 9: [24, 56, 60, 20, 40], 13: [48, 120, 126, 42, 84] };
  const HC_NAME = ['互先', '定先', '2子局', '3子局', '4子局', '5子局'];
  const hcStones = (h, n) => h >= 2 ? HC_PTS[n === 13 ? 13 : 9].slice(0, h) : [];
  // 棋譜用：置き石を「黒・白パス・黒…」として先頭に入れる（検討モードでそのまま並ぶ）
  const hcRec = (h, n) => { const r = []; hcStones(h, n).forEach((p, i, a) => { r.push(p); if (i < a.length - 1) r.push(-1); }); return r; };
  function openPvp() { stopMatch(); showScreen('pvp'); if (window.FRIEND) window.FRIEND.renderPvp(); }
  function openFriend() { showScreen('friend'); if (window.FRIEND) window.FRIEND.open(); }
  // フレンドマッチ：つながっていなければ、つないでから送る
  function friendSend(msg, extra) {
    stopMatch();
    M = Object.assign({ friend: true, found: false, t0: Date.now(), timer: 0 }, extra || {});
    M.redo = () => { netHello(); netSend(msg); };
    if (NET.ok) M.redo(); else { NET.retry = 0; netConnect(); }
  }
  const FR = {
    available: () => !!NET_URL,
    random(size) { startMatch(size); },
    bot(size) { botNow(size); },
    online: () => NET.ok,
    host(hc) { friendSend({ t: 'fhost', hc }); },
    join(code) { friendSend({ t: 'fjoin', code }, { joining: true }); },
    cancel() { if (M && M.friend && !M.found) { netSend({ t: 'fcancel' }); clearTimeout(M.timer); M = null; } },
    waiting: () => !!(M && M.friend && !M.found),
    openFriend, back: () => { FR.cancel(); showScreen('home'); renderHome(); }
  };

  /* ---------- マッチング ---------- */
  // サーバーにつながれば、まず人を探す。見つからなければ Bot（「Botとはマッチしない」なら待ち続ける）
  let M = null;
  // 人を待たずに、すぐ Bot と打つ
  function botNow(size) {
    startMatch(size);
    if (!M) return;
    netSend({ t: 'cancel' });
    clearInterval(M.timer);
    matchFound();
  }
  function startMatch(size) {
    stopMatch();
    size = size === 13 ? 13 : 9;
    const myRank = rankFromRating(RS(size).rating);
    M = { t0: Date.now(), fixed: S.botLevel !== 'auto' && S.botLevel !== 'up', myRank, found: false, timer: 0, size };
    $('#matching').hidden = false;
    $('#mtFound').hidden = true; $('#mtOpts').hidden = false;
    $('#mtTitle').textContent = '対戦相手を探しています';
    setImg($('#mtMe'), myFaceSrc());
    $('#optNoBot').checked = !!S.noBot;
    $('#mtNoBotNote').hidden = !S.noBot;
    $('#mtTitle').textContent = `対戦相手を探しています（${size}路）`;
    if (NET_URL) { if (NET.ok) { netHello(); netSend({ t: 'seek', size, rating: RS(size).rating }); } else netConnect(); }
    M.timer = setInterval(matchTick, 250);
    matchTick();
  }
  function matchRange() {
    if (NET.ok) return `オンライン ${NET.online}人・対戦待ち ${NET.seeking}人`;
    if (S.noBot) return `${RANKS[Math.max(0, M.myRank - 1)]}〜${RANKS[Math.min(RANKS.length - 1, M.myRank + 1)]} のプレイヤー`;
    if (M.fixed) return `${RANKS[S.botLevel]} の相手`;
    if (S.botLevel === 'up') { const lv = upLevels(); return `${RANKS[lv[0]]}${lv.length > 1 ? '〜' + RANKS[lv[lv.length - 1]] : ''} の相手`; }
    return `${RANKS[Math.max(0, Math.min(BOT_MAX, M.myRank) - 1)]}〜${RANKS[Math.min(BOT_MAX, M.myRank + 1)]} の相手`;
  }
  function matchTick() {
    if (!M || M.found || M.friend) return;
    const sec = Math.floor((Date.now() - M.t0) / 1000);
    const tt = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
    $('#mtSub').textContent = `${matchRange()}・${tt}`;
    $('#mpText').textContent = `対戦相手を探しています ${tt}`;
    const wait = NET.ok ? ONLINE_WAIT_MS : MATCH_SEARCH_MS;
    if (!S.noBot && Date.now() - M.t0 >= wait) { netSend({ t: 'cancel' }); matchFound(); }
  }
  function showFound(face, name, rank, color, sub, hc) {
    if (R) closeReview(true);
    $('#matchPill').hidden = true; $('#game').classList.remove('waiting');
    $('#matching').hidden = false; $('#mtOpts').hidden = true;
    $('#mtTitle').textContent = '対戦相手が見つかりました';
    $('#mtSub').textContent = sub;
    setImg($('#mtAvatar'), face);
    $('#mtName').textContent = name;
    $('#mtRank').textContent = rank;
    $('#mtColor').textContent = hc && hc.h >= 2 ? (color === 1 ? `あなたは黒番（${hc.h}子を置きます）` : `あなたは白番（${hc.h}子置かせて、白から）`)
      : color === 1 ? 'あなたは黒番（先手）' : 'あなたは白番（後手）';
    $('#mtFound').hidden = false;
    sound('taiko');
  }
  function onlineFound(m) {
    M.found = true; M.g = m.g; clearInterval(M.timer);
    if (G && G.over) { $('#result').hidden = true; G = null; }   // フレンド戦の「もう一局」
    const opp = humanOpp(m.opp), hc = m.hc || null;
    showFound(A.faceUri(opp.ava), opp.name, `${RANKS[rankFromRating(opp.rating)]}・レート ${opp.rating}`, m.color,
      hc ? `フレンドマッチ・${hc.size === 13 ? '13路' : '9路'}・${HC_NAME[hc.h]}・持ち時間${hc.min}分` : `オンラインのプレイヤーとマッチしました（${m.size === 13 ? '13路' : '9路'}）`, hc);
    M.timer = setTimeout(() => { $('#matching').hidden = true; M = null; newGame(opp, m.color, { online: { g: m.g }, hc, size: m.size }); setClocks(m.clock); }, Math.max(1200, (m.delay || 2500) - 300));
  }
  // 「自分と同じ以上の強さ」：レートが自分以上の Bot のうち、弱いほうから2つ（いなければ いちばん強い Bot）
  function upLevels() {
    const out = [];
    const my = RS(M && M.size).rating;
    for (let i = 0; i <= BOT_MAX && out.length < 2; i++) if (botRating(i) >= my) out.push(i);
    return out.length ? out : [BOT_MAX];
  }
  function matchFound() {
    M.found = true; clearInterval(M.timer);
    const up = upLevels();
    const lv = M.fixed ? Math.min(BOT_MAX, S.botLevel) : S.botLevel === 'up' ? up[Math.floor(Math.random() * up.length)] : Math.max(0, Math.min(BOT_MAX, M.myRank + Math.floor(Math.random() * 3) - 1));
    const bot = { level: lv, rating: botRating(lv), name: `Bot ${RANKS[lv]}` };
    const myColor = Math.random() < 0.5 ? 1 : 2;
    showFound(rivalFace(bot.level), `${rivalName(bot.level)}（${bot.name}）`, `レート ${bot.rating}`, myColor, M.fixed ? '指定した強さのBotとマッチしました' : S.botLevel === 'up' ? '自分と同じ以上の強さのBotとマッチしました' : '近い強さのBotとマッチしました');
    const sz = M.size; M.timer = setTimeout(() => { $('#matching').hidden = true; M = null; newGame(bot, myColor, { size: sz }); }, 2200);
  }
  function stopMatch() {
    if (M) { clearInterval(M.timer); clearTimeout(M.timer); if (!M.found) netSend({ t: M.friend ? 'fcancel' : 'cancel' }); }
    M = null;
    $('#matching').hidden = true; $('#matchPill').hidden = true; $('#game').classList.remove('waiting');
  }
  // 待っている間に「すぐにキャラクターとマッチ」
  $('#matchChara').onclick = () => { if (!M || M.found || M.friend) return; sound('stone'); netSend({ t: 'cancel' }); matchFound(); };
  $('#cancelMatch').onclick = () => { stopMatch(); if (!$('#home').hidden || !$('#pvp').hidden) openPvp(); };
  $('#optNoBot').addEventListener('change', e => {
    S.noBot = e.target.checked; save();
    $('#mtNoBotNote').hidden = !S.noBot;
    matchTick();
  });
  $('#matchReview').onclick = () => {
    if (!M) return;
    $('#matching').hidden = true;
    $('#matchPill').hidden = false; $('#game').classList.add('waiting');
    openReview([], M.size);
  };
  $('#mpOpen').onclick = () => { if (M && !M.found) { $('#matching').hidden = false; } };

  /* ---------- 入力 ---------- */
  $('#board').addEventListener('click', e => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = Math.floor(((e.clientX - r.left) / r.width * (BN + .3)) - 0.15);
    const y = Math.floor(((e.clientY - r.top) / r.height * (BN + .3)) - 0.15);
    if (x < 0 || x >= BN || y < 0 || y >= BN) return;
    if (R) { reviewTap(y * BN + x); return; }
    if (!G || G.over || G.toPlay !== G.me || G.net) return;
    const p = y * BN + x;
    if (G.board[p]) return;
    if (!E.play(G.board, p, G.me, G.ko)) { const [bx, by] = pointXY($('#board'), p); A.burst(bx, by, 'bad'); sound('bad'); toast(p === G.ko ? 'コウなので、すぐには取り返せません' : 'そこには打てません'); return; }
    if (S.settings.confirm && G.pend !== p) { G.pend = p; render(); return; }
    doMove(p, G.me);
  });
  $('#passBtn').onclick = () => {
    if (!G || G.over || G.toPlay !== G.me) return;
    confirmBox(G.passes ? '相手もパスしています。パスすると終局して整地します。' : 'パスしますか？', () => { if (G && !G.over && G.toPlay === G.me) doPass(G.me); });
  };
  $('#resignBtn').onclick = () => { if (G && !G.over) confirmBox('投了しますか？ 負けになります。', () => { if (!G || G.over) return; if (G.online) netSend({ t: 'resign', g: G.online.g }); endGame(3 - G.me, '中押し'); }); };
  $('#startMatch').onclick = () => { sound('stone'); openPvp(); };
  $('#resHome').addEventListener('click', stopPonder);
  $('#resBoard').onclick = () => { const rec = G ? (G.hc ? hcRec(G.hc.h, BN) : []).concat(G.record) : []; reviewBack = G && G.solo ? (G.soloCleared ? (s => () => s.done(true))(G.solo) : G.solo.back) : null; $('#result').hidden = true; G = null; openReview(rec); };

  /* ---------- 設定 ---------- */
  function renderSettings() {
    renderAccount();
    $('#nameInput').value = S.name;
    const ci = charaIdx(), cv = A.VARIANTS[ci];
    setImg($('#charaBig'), A.charaUri(ci));
    $('#charaName').textContent = cv.name;
    $('#charaNote').textContent = cv.note;
    const grid = $('#avGrid'); grid.innerHTML = '';
    A.VARIANTS.forEach((v, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('aria-label', 'アバター ' + v.name);
      b.setAttribute('aria-pressed', String(S.avatar.type === 'preset' && S.avatar.id === i));
      const im = document.createElement('img'); im.alt = ''; im.src = A.faceUri(i); b.append(im);
      const open = charaOpen(i);
      const nm = document.createElement('span'); nm.textContent = open ? v.name : `${RANKS[UNLOCK[v.key]]}で解放`; b.append(nm);
      if (!open) { b.classList.add('locked'); b.onclick = () => toast(`${v.name}は${RANKS[UNLOCK[v.key]]}になると使えます`); grid.append(b); return; }
      b.onclick = () => { S.avatar = { type: 'preset', id: i }; save(); renderSettings(); renderHome(); };
      grid.append(b);
    });
    $('#boardKaya').setAttribute('aria-checked', String(S.settings.board !== 'washi'));
    $('#boardWashi').setAttribute('aria-checked', String(S.settings.board === 'washi'));
    $('#optConfirm').checked = S.settings.confirm; $('#optFx').checked = S.settings.fx; $('#optShopFx').checked = S.settings.shopFx !== false; $('#optSound').checked = S.settings.sound; $('#optBgm').checked = S.settings.bgm !== false; $('#optTicker').value = S.settings.tickerMode || 'all';
  }
  $('#boardKaya').onclick = () => { S.settings.board = 'kaya'; save(); applyBoardStyle(); renderSettings(); };
  $('#boardWashi').onclick = () => { S.settings.board = 'washi'; save(); applyBoardStyle(); renderSettings(); };
  $('#openSettings').onclick = () => { renderSettings(); $('#settings').hidden = false; };
  $('#acctShow').onclick = () => { NET.showPass = !NET.showPass; renderAccount(); };
  $('#acctCopy').onclick = () => {
    if (!S.acct) return;
    const text = `囲碁BLITZ の引き継ぎ\nID：${fmtCode(S.acct.id)}\nパスワード：${fmtCode(S.acct.pass)}`;
    const ok = () => toast('IDとパスワードをコピーしました');
    try { navigator.clipboard.writeText(text).then(ok, () => toast('コピーできませんでした。画面を見てメモしてください')); } catch (e) { toast('コピーできませんでした。画面を見てメモしてください'); }
  };
  $('#rsGo').onclick = () => {
    const id = normCode($('#rsId').value), pass = normCode($('#rsPass').value);
    if (id.length !== 8 || pass.length !== 8) { toast('IDとパスワードは、それぞれ8文字です'); return; }
    if (!NET.ok) { toast('サーバーにつながっていません。少し待ってからもう一度'); return; }
    if (S.acct && id === S.acct.id) { toast('それはこの端末のIDです'); return; }
    confirmBox('この端末のデータ（レート・戦績・進み具合）を、引き継ぐデータで置きかえますか？', () => {
      NET.pendingPass = pass;
      netSend({ t: 'login', game: GAME, id, pass, restore: true });
    });
  };
  $('#openChara').onclick = () => { renderSettings(); showScreen('chara'); };
  $('#openRecord').onclick = () => { renderHome(); showScreen('record'); };
  $('#meChip').onclick = () => { renderHome(); showScreen('record'); };
  $('#charaBack').onclick = () => { renderHome(); showScreen('home'); };
  $('#recordBack').onclick = () => { showScreen('home'); };
  $('#closeSettings').onclick = () => { $('#settings').hidden = true; };
  $('#settings').addEventListener('click', e => { if (e.target.id === 'settings') $('#settings').hidden = true; });
  $('#nameInput').addEventListener('input', e => {
    const v = e.target.value.trim().slice(0, 12);
    S.name = v || 'あなた'; save(); renderHome();
  });
  $('#optBgm').addEventListener('change', () => { if (!window.BGM) return; if (S.settings.bgm) window.BGM.start(); else window.BGM.stop(); });
  $('#optTicker').addEventListener('change', () => { S.settings.tickerMode = $('#optTicker').value; saveLocal(); if (window.TICKER) window.TICKER.draw(); });
  $('#nameInput').addEventListener('change', () => { if (NET.ok) netHello(); });   // 名前を変えたらサーバーにも知らせる（部屋や対局で見える名前）
  for (const [id, key] of [['#optConfirm', 'confirm'], ['#optFx', 'fx'], ['#optShopFx', 'shopFx'], ['#optSound', 'sound'], ['#optBgm', 'bgm']]) {
    $(id).addEventListener('change', e => { S.settings[key] = e.target.checked; save(); });
  }
  $('#resetRate').onclick = () => confirmBox('レートを1050（10級）に戻し、成績と履歴を消します。元に戻せません。', () => {
    Object.assign(S, { rating: START_RATE, games: 0, wins: 0, streak: 0, earnedDan: -1, bw: { bw: 0, bl: 0, ww: 0, wl: 0 }, history: [], r13: fresh13() });
    save(); renderHome(); $('#settings').hidden = true; toast('レートをリセットしました');
  });

  /* ---------- 検討モード ---------- */
  let reviewBack = null;
  const COLS = 'ABCDEFGHJKLMN';
  const coord = p => p < 0 ? 'パス' : COLS[p % BN] + (BN - ((p / BN) | 0));
  function setMode(m) {
    const rv = m === 'review';
    $('#rvTop').hidden = !rv; $('#rvPanel').hidden = !rv;
    $('#opBar').hidden = rv; $('#meBar').hidden = rv; $('#playActions').hidden = rv;
    $('#game').classList.toggle('reviewing', rv);
  }
  function openReview(rec, size) {
    setSize(size || BN);
    R = { main: rec.slice(), line: rec.slice(), idx: rec.length, hint: null, hintReq: 0 };
    showScreen('game'); $('#result').hidden = true;
    setMode('review');
    $('#fxLayer').innerHTML = '';
    reviewRender();
  }
  function replay(line, n) {
    let b = new Array(BN * BN).fill(0), ko = -1, c = 1, last = -1;
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
    for (let p = 0; p < BN * BN; p++) {
      const v = st.b[p]; if (!v) continue;
      const x = p % BN + 0.5, y = ((p / BN) | 0) + 0.5;
      s += `<g class="stone${p === R.drop ? ' drop' : ''}"><circle cx="${x + .04}" cy="${y + .06}" r=".46" fill="#000" opacity=".28"/><circle cx="${x}" cy="${y}" r=".46" fill="url(#g${v === 1 ? 'B' : 'W'})"/></g>`;
    }
    $('#stones').innerHTML = s; R.drop = -1;
    $('#terr').innerHTML = '';
    let m = '';
    if (st.last >= 0) {
      const x = st.last % BN + 0.5, y = ((st.last / BN) | 0) + 0.5;
      m += `<circle cx="${x}" cy="${y}" r=".17" fill="none" stroke="${st.b[st.last] === 1 ? '#fff3dc' : '#e0503e'}" stroke-width=".07"/>`;
    }
    if (R.hint && R.hint.at === R.idx + ':' + R.line.slice(0, R.idx).join(',')) {
      R.hint.cands.forEach((h, i) => {
        if (h.move < 0) return;
        const x = h.move % BN + 0.5, y = ((h.move / BN) | 0) + 0.5;
        m += `<circle cx="${x}" cy="${y}" r=".38" fill="${i === 0 ? '#e0503e' : '#e0503ebb'}" stroke="#fff3dc" stroke-width=".04"/><text x="${x}" y="${y + .15}" text-anchor="middle" font-size=".42" font-weight="900" fill="#fff6ea" font-family="'M PLUS Rounded 1c', system-ui">${i + 1}</text>`;
      });
    } else if (R.hint && !R.hint.loading) { R.hint = null; $('#rvHintOut').hidden = true; }
    $('#marks').innerHTML = m;
    const branch = R.main.length > 0 && (R.line.length !== R.main.length || R.line.some((p, i) => p !== R.main[i]));
    $('#rvMove').textContent = `${R.idx}手目` + (R.line.length ? ` / ${R.line.length}` : '');
    $('#rvSize').hidden = R.main.length > 0; $('#rvSize').textContent = BN === 9 ? '13路にする' : '9路にする';
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
    out.hidden = false; out.innerHTML = '<small>最強のAIが考えています…（5秒ほど）</small>';
    R.hint = { loading: true, at, cands: [] };
    $('#rvHint').disabled = true;
    const res = await ask({ type: 'analyze', size: BN, board: st.b, toPlay: st.c, ko: st.ko, komi: KOMI, last: st.last, rec: R.line.slice(0, R.idx), ms: 5000 });
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
  $('#openReview').onclick = () => openReview([], 9);
  $('#rvSize').onclick = () => { if (R && !R.main.length) { openReview([], BN === 9 ? 13 : 9); } };

  /* ---------- Botの強さ ---------- */
  // 設定画面と、対局画面の「キャラクターと対局」の右（当たる強さ）の2か所。どちらで変えても同じ
  (function setupBotPick() {
    const sels = [$('#botLevel'), $('#botLevelQuick')].filter(Boolean);
    sels.forEach((sel, k) => {
      const add = (v, t) => { const o = document.createElement('option'); o.value = v; o.textContent = t; sel.append(o); };
      add('auto', k ? '近い強さ' : '自動（近い強さ）');
      add('up', k ? '同じ以上' : '自分と同じ以上の強さ');
      RANKS.slice(0, BOT_MAX + 1).forEach((r, i) => add(String(i), k ? r : `${r}（レート ${botRating(i)}）`));
    });
    if (S.botLevel !== 'auto' && S.botLevel !== 'up') S.botLevel = (S.botLevel >= 0) ? Math.min(BOT_MAX, S.botLevel | 0) : 'auto';
    const sync = () => sels.forEach(s => { s.value = String(S.botLevel); });
    sync();
    sels.forEach(sel => sel.addEventListener('change', () => { S.botLevel = sel.value === 'auto' || sel.value === 'up' ? sel.value : +sel.value; save(); sync(); }));
  })();

  /* ---------- 起動：前回の対局が途中で切れていたら負け ---------- */
  try {
    const act = JSON.parse(localStorage.getItem(KEY + '.active') || 'null');
    if (act && act.g) {
      // 対人戦の途中だった → サーバーにつないで、続き（3分以内）か結果をもらう
      setTimeout(() => {
        const now = JSON.parse(localStorage.getItem(KEY + '.active') || 'null');
        if (now && now.g === act.g && !(G && G.online && G.online.g === act.g)) { localStorage.removeItem(KEY + '.active'); toast('前回の対局は終了していました'); }
      }, 12000);
    } else if (act) {
      const r = applyRating(0, act.op, act.color, act.name, '切断負け', null, act.size);
      setTimeout(() => toast(`前回の対局は途中で終了したため切断負けになりました（${r.d}）`, 4500), 400);
    }
  } catch (e) {}
  if (NET_URL) netConnect();
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
    if (G && !G.over) { showScreen('game'); return; }   // 中断していた対局が再開済み
    showScreen('home'); renderHome();
  }
  // タイトル：キャラクター総出演（扇のように並べる）
  (() => {
    const order = ['mike', 'shima', 'koharu', 'hinata', 'gensai', 'tomoe', 'tono'], n = order.length;
    $('#ttCast').innerHTML = order.map((k, j) => {
      const i = A.VARIANTS.findIndex(v => v.key === k), t = j - (n - 1) / 2;
      return `<figure class="tt-card" style="--t:${t};--d:${(j * 0.09).toFixed(2)}s;z-index:${10 - Math.abs(Math.round(t))}"><img src="${A.charaUri(i)}" alt=""><figcaption>${A.VARIANTS[i].name}</figcaption></figure>`;
    }).join('');
  })();
  $('#title').addEventListener('click', leaveTitle);
  $('#title').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') leaveTitle(); });
  $('#openSolo').onclick = () => window.SOLO && window.SOLO.open();

  // 「実戦！」の演出（終わったら then を呼ぶ）
  function jissen(sub, then) {
    const el = $('#jissen');
    $('#jsSub').textContent = sub || '';
    el.hidden = false; el.classList.remove('go'); void el.offsetWidth; el.classList.add('go');
    sound('taiko'); buzz(35);
    setTimeout(() => A.burst(window.innerWidth / 2, window.innerHeight / 2, 'win'), 260);
    setTimeout(() => { el.hidden = true; el.classList.remove('go'); if (then) then(); }, 1700);
  }

  // ソロモード（solo.js）から使う機能
  window.APP = {
    E: E9, A, S, save, RANKS, BOT_MAX, botRating, KOMI, showScreen, renderHome, toast, sound, buzz, setImg,
    drawGrid, pointXY, stoneFx, myCharaSrc, myFaceSrc, charaIdx, jissen, confirmBox, startMatch,
    rankOf: rating => rankFromRating(rating), saveLocal, econOn, FR, openReview, setReviewBack: f => { reviewBack = f; }, giftReq(msg, cb) { const req = ++buyReq; giftCb[req] = cb; netSend(Object.assign({ req }, msg)); }, charaOpen, UNLOCK, displayRank, HC_PTS, HC_NAME, hcStones, MAIN_MS,
    // レクチャー初クリア・ドリル正解の銭（サーバーにつながっていればサーバーが1回だけ出す）
    claim(kind, id, amount) {
      if (econOn()) netSend({ t: 'claim', kind, id });
      else { S.zeni = (S.zeni || 0) + amount; save(); toast(`＋${amount} 銭`); }
    },
    // 買い物：what は { item } / { floor } / { wall }。cb({ ok, reason })
    buy(what, price, cb0) {
      // 32回に1回の半額サービス（サーバーが決める）。店員さんのセリフは、次の演出の前に出る
      let cb = res => { if (res && res.ok && res.half && window.FANFARE) window.FANFARE.noteHalf(what.av ? 'hinata' : 'shima', Math.max(0, price - (res.paid | 0))); cb0(res); };
      if (econOn()) { const req = ++buyReq; buyCb[req] = cb; netSend(Object.assign({ t: 'buy', req }, what)); return; }
      if (NET_URL && !NET.ok) { cb({ ok: false, reason: 'offline' }); return; }
      const tm = what.av && window.AVATAR.TAMA[what.av];
      if (tm) {   // 勾玉限定
        if ((S.avOwned || []).includes(what.av)) { cb({ ok: false, reason: 'have' }); return; }
        if ((S.tama | 0) < tm) { cb({ ok: false, reason: 'tama' }); return; }
        S.tama -= tm; S.avOwned = (S.avOwned || []).concat(what.av); save(); cb({ ok: true }); return;
      }
      const half = price > 0 && !what.roomAdd && what.roomBig == null && Math.random() < 1 / 32;
      const pay = half ? Math.floor(price / 2) : price;
      if ((S.zeni || 0) < pay) { cb({ ok: false, reason: 'zeni' }); return; }
      S.zeni -= pay;
      const cb1 = cb; cb = res => cb1(Object.assign(res, { half, paid: pay }));
      const r = S.room;
      if (what.av) { S.avOwned = (S.avOwned || []).concat(what.av); save(); cb({ ok: true }); return; }
      if (what.item) r.ownedItems[what.item] = (r.ownedItems[what.item] || 0) + 1;
      else if (what.floor) r.owned.floors.push(what.floor);
      else if (what.wall) r.owned.walls.push(what.wall);
      else if (what.roomAdd) { r.extra = r.extra || []; r.extra.push({ floor: 'wood', wall: 'plain', items: [], walls: [], at: { p: what.p | 0, d: what.d === 'y' ? 'y' : 'x' }, n: 12 }); }
      else if (what.roomBig != null) { const rm = what.roomBig ? (r.extra || [])[what.roomBig - 1] : r; if (rm) rm.n = 17; }
      save(); cb({ ok: true });
    },
    // 勾玉：op 'swap'（n こを銭に）／ 'chara'（key のキャラを開放）。cb({ ok, reason })
    TAMA_ZENI: 10, TAMA_CHARA: 300,
    tama(op, data, cb) {
      if (econOn()) { const req = ++buyReq; buyCb[req] = cb; netSend(Object.assign({ t: 'tama', req, op }, data)); return; }
      if (NET_URL && !NET.ok) { cb({ ok: false, reason: 'offline' }); return; }
      const have = S.tama | 0;
      if (op === 'swap') { const n = Math.floor(data.n || 0); if (n < 1 || have < n) { cb({ ok: false, reason: 'tama' }); return; } S.tama = have - n; S.zeni = (S.zeni || 0) + n * 10; }
      else if (op === 'chara') { S.charaBuy = S.charaBuy || []; if (S.charaBuy.includes(data.key)) { cb({ ok: false, reason: 'have' }); return; } if (have < 300) { cb({ ok: false, reason: 'tama' }); return; } S.tama = have - 300; S.charaBuy.push(data.key); }
      save(); renderHome(); cb({ ok: true });
    },
    // 骨董屋：売る（what は { item } / { av }）。cb({ ok, reason, got, offer })。offer があれば玄斎からのおくりもの
    sell(what, cb) {
      if (econOn()) { const req = ++buyReq; buyCb[req] = cb; netSend(Object.assign({ t: 'sell', req }, what)); return; }
      if (NET_URL && !NET.ok) { cb({ ok: false, reason: 'offline' }); return; }
      const r = S.room; let price = 0;
      if (what.av) {
        const p = window.AVATAR.PRICE[what.av], [sl, id] = what.av.split(':');
        if (!(p > 0) || !(S.avOwned || []).includes(what.av)) { cb({ ok: false, reason: 'item' }); return; }
        if (S.av && S.av[sl] === id) { cb({ ok: false, reason: 'wear' }); return; }
        price = p; S.avOwned = S.avOwned.filter(k => k !== what.av);
      } else if (what.item) {
        const c = window.ROOMART.BY_ID[what.item], have = r.ownedItems[what.item] || 0;
        let placed = 0;
        for (const rm of [r].concat(r.extra || [])) for (const it of (rm.items || []).concat(rm.walls || [])) if (it.k === what.item && !it.trial) placed++;
        if (!c || !(c.price > 0) || have - placed < 1) { cb({ ok: false, reason: 'placed' }); return; }
        price = c.price; if (have > 1) r.ownedItems[what.item] = have - 1; else delete r.ownedItems[what.item];
      } else { cb({ ok: false, reason: 'item' }); return; }
      const got = Math.floor(price / 3); S.zeni = (S.zeni || 0) + got;
      // おくりもの（サーバーと同じ確率）
      const x = Math.random(), pick = a => a.length ? a[Math.floor(Math.random() * a.length)] : null;
      const avs = (lo, hi) => Object.entries(window.AVATAR.PRICE).filter(([k, p]) => p >= lo && p <= hi && !(S.avOwned || []).includes(k)).map(([k]) => k);
      const its = f => window.ROOMART.CATALOG.filter(c => f(c.price)).map(c => c.id);
      let offer = null;
      if (x < 1 / 256) { const id = pick(avs(2000, 1e9)); if (id) offer = { kind: 'av', id }; }
      else if (x < 1 / 256 + 1 / 64) { const id = pick(avs(1200, 1500)); if (id) offer = { kind: 'av', id }; }
      else if (x < 1 / 256 + 1 / 64 + 1 / 16) { const id = pick(its(p => p === 600)); if (id) offer = { kind: 'item', id }; }
      else if (x < 1 / 256 + 1 / 64 + 1 / 16 + 1 / 8) { const id = pick(its(p => p > 0 && p <= 300)); if (id) offer = { kind: 'item', id }; }
      S.offer = offer; save(); cb({ ok: true, got, offer });
    },
    // 玄斎のおくりものを、もらう（yes=true）か、ことわる
    offer(yes, cb) {
      if (econOn()) { const req = ++buyReq; buyCb[req] = cb || (() => {}); netSend({ t: 'offer', req, yes: !!yes }); return; }
      const o = S.offer; S.offer = null;
      if (o && yes) { if (o.kind === 'av') S.avOwned = (S.avOwned || []).concat(o.id); else S.room.ownedItems[o.id] = (S.room.ownedItems[o.id] || 0) + 1; }
      save(); if (cb) cb({ ok: !!(o && yes) });
    },
    // マイルームのつながり（日記・チャット・フレンドなど）。サーバーにつながっていないときは reason: 'offline'
    soc(op, data, cb) {
      if (!econOn()) { if (cb) cb({ ok: false, reason: 'offline' }); return; }
      const req = ++buyReq; if (cb) socCb[req] = cb;
      netSend(Object.assign({ t: 'soc', op, req }, data || {}));
    },
    online: () => econOn(),
    // 部屋の配置をサーバーへ（もようがえを終えたとき・部屋を出るとき）
    saveRoom() {
      saveLocal();
      const r = S.room;
      const pack = x => ({ floor: x.floor, wall: x.wall, items: (x.items || []).filter(i => !i.trial), walls: (x.walls || []).filter(i => !i.trial), av: x.av, g: x.g, gp: x.gp });   // 試し置きは送らない
      if (econOn()) netSend({ t: 'room', room: pack(r), rooms2: (r.extra || []).map(pack) });
    },
    // マイルームに来たキャラと一局（レート対局）
    playChara(chara, level) {
      const lv = Math.max(0, Math.min(BOT_MAX, level));
      newGame({ level: lv, rating: botRating(lv), name: `Bot ${RANKS[lv]}`, chara }, Math.random() < 0.5 ? 1 : 2);
    },
    startSoloGame(level, solo) {
      const lv = Math.max(0, Math.min(BOT_MAX, level));
      const bot = { level: lv, rating: botRating(lv), name: `Bot ${RANKS[lv]}` };
      newGame(bot, Math.random() < 0.5 ? 1 : 2, { solo });
    }
  };
  renderHome();
})();
