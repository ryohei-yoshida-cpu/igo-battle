/* 九路 Blitz — マイルーム
 *   ・見る：遊びに来たキャラをタップでおしゃべり／碁盤をタップで対局／電気をタップでつける・消す
 *   ・もようがえ：家具をドラッグして置く（マスにぴったり）。回転・しまう
 *   ・ショップ：銭で家具・床・壁紙を買う
 *   ・お客さん：だれが遊びに来るか（自分のキャラは通算5勝、ほかのキャラはそのキャラに5勝）
 */
(function () {
  const P = window.APP, A = P.A, S = P.S, R = window.ROOMART, LINES = window.ROOM_LINES || {}, AV = window.AVATAR, SO = window.SOCIAL;
  const $ = s => document.querySelector(s);
  const N = R.N;

  /* ---------- データ ---------- */
  // ほかの人の部屋をたずねているときは guest に、その部屋の情報が入る（見るだけ）
  let guest = null, mySoc = null, meInfo = { pid: S.pid || null, foot: [], friends: [], freq: [], blocks: [], cset: 'all' };
  const DEF_ROOM = () => ({ floor: 'wood', wall: 'plain', items: [{ uid: 1, k: 'goban', x: 5, y: 5, rot: 0 }], walls: [] });
  function room() {
    if (guest) { const g = guest.room || (guest.room = DEF_ROOM()); g.items = g.items || []; g.walls = g.walls || []; return g; }
    if (!S.room) {
      S.room = { floor: 'wood', wall: 'plain', items: [{ uid: 1, k: 'goban', x: 5, y: 5, rot: 0 }], walls: [], inv: {}, owned: { floors: ['wood'], walls: ['plain'] }, seq: 2, seen: [] };
      touch();
    }
    const r = S.room;
    r.items = r.items || []; r.walls = r.walls || []; r.seen = r.seen || [];
    r.owned = r.owned || { floors: ['wood'], walls: ['plain'] };
    if (!r.ownedItems) {   // 持っている家具の数（置いている分＋倉庫の分）
      r.ownedItems = {};
      for (const it of r.items.concat(r.walls)) r.ownedItems[it.k] = (r.ownedItems[it.k] || 0) + 1;
      for (const [k, n] of Object.entries(r.inv || {})) r.ownedItems[k] = (r.ownedItems[k] || 0) + n;
    }
    delete r.inv;
    r.seq = r.seq || 2;
    return r;
  }
  // 倉庫にある数＝持っている数－置いている数
  function invOf(k) { const r = room(); return (r.ownedItems[k] || 0) - r.items.concat(r.walls).filter(i => i.k === k).length; }
  function invKeys() { return Object.keys(room().ownedItems).filter(k => invOf(k) > 0); }
  let dirty = false;   // 配置を変えたが、まだサーバーに送っていない
  function flush() { if (dirty) { dirty = false; P.saveRoom(); } }
  const touch = () => { dirty = true; P.saveLocal(); };
  const cat = k => R.BY_ID[k];

  /* ---------- 置けるかどうか ---------- */
  function rectOf(it) { const f = R.footprint(it); return { x: it.x, y: it.y, w: f.w, d: f.d }; }
  const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.d && b.y < a.y + a.d;
  function canPlace(it, x, y, rot) {
    const c = cat(it.k), f = rot ? { w: c.d, d: c.w } : { w: c.w, d: c.d };
    if (x < 0 || y < 0 || x + f.w > N || y + f.d > N) return false;
    const me = { x, y, w: f.w, d: f.d };
    for (const o of room().items) {
      if (o === it) continue;
      if ((cat(o.k).kind === 'flat') !== (c.kind === 'flat')) continue;   // ラグの上には家具を置ける
      if (overlap(me, rectOf(o))) return false;
    }
    return true;
  }
  function canPlaceWall(it, side, u) {
    const c = cat(it.k);
    if (u < 0 || u + c.w > N) return false;
    for (const o of room().walls) {
      if (o === it || o.side !== side) continue;
      const oc = cat(o.k);
      if (u < o.u + oc.w && o.u < u + c.w && c.v < oc.v + oc.h && oc.v < c.v + c.h) return false;
    }
    return true;
  }
  function freeSpot(it) {
    for (let s = 0; s < N * 2; s++) for (let x = 0; x <= s; x++) { const y = s - x; if (x < N && y < N && canPlace(it, x, y, it.rot)) return { x, y }; }
    return null;
  }
  function freeWallSpot(it) {
    for (const side of ['R', 'L']) for (let u = 0; u < N; u++) if (canPlaceWall(it, side, u)) return { side, u };
    return null;
  }

  /* ---------- 描く ---------- */
  let mode = 'view', sel = null, drag = null, visitors = [];
  // 奥にあるものから順に描く（重なりを正しく）
  function drawOrder(list) {
    const rest = list.slice(), out = [];
    const behind = (a, b) => a.x + a.w <= b.x || a.y + a.d <= b.y;
    while (rest.length) {
      let i = rest.findIndex(r => !rest.some(s => s !== r && behind(s, r) && !behind(r, s)));
      if (i < 0) { i = 0; let best = Infinity; rest.forEach((r, j) => { const v = r.x + r.w / 2 + r.y + r.d / 2; if (v < best) { best = v; i = j; } }); }
      out.push(rest.splice(i, 1)[0]);
    }
    return out;
  }
  function render() {
    const r = room();
    let s = R.DEFS + R.drawWalls(r.wall) + R.drawFloor(r.floor);
    if (mode === 'edit') {   // マス目
      for (let i = 0; i <= N; i++) {
        const a = R.proj(i, 0, 0), b = R.proj(i, N, 0), c = R.proj(0, i, 0), d = R.proj(N, i, 0);
        s += `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" class="rm-grid"/><line x1="${c[0]}" y1="${c[1]}" x2="${d[0]}" y2="${d[1]}" class="rm-grid"/>`;
      }
    }
    for (const w of r.walls) s += `<g data-uid="${w.uid}" data-wall="1" class="${sel === w ? 'rm-sel' : ''}">${R.drawWallItem(w, {})}</g>`;
    const flats = r.items.filter(i => cat(i.k).kind === 'flat'), solids = r.items.filter(i => cat(i.k).kind !== 'flat');
    for (const it of flats) s += `<g data-uid="${it.uid}" class="${sel === it ? 'rm-sel' : ''}">${R.drawFloorItem(it)}</g>`;
    // 選んでいる家具の足もと（置けるなら緑、置けないなら赤）
    if (sel && !sel.side && mode === 'edit') {
      const f = R.footprint(sel), ok = drag ? drag.ok : true;
      const q = [R.proj(sel.x, sel.y, 0), R.proj(sel.x + f.w, sel.y, 0), R.proj(sel.x + f.w, sel.y + f.d, 0), R.proj(sel.x, sel.y + f.d, 0)];
      s += `<polygon points="${q.map(p => p.join(',')).join(' ')}" class="rm-foot ${ok ? 'ok' : 'ng'}"/>`;
    }
    const owner = mode === 'view' ? ownerSpot() : null;
    const ents = solids.map(it => Object.assign(rectOf(it), { it }))
      .concat(mode === 'view' && !guest ? visitors.map(v => ({ x: v.x, y: v.y, w: 1, d: 1, v })) : [])
      .concat(owner ? [{ x: owner.x, y: owner.y, w: 1, d: 1, av: true }] : []);
    for (const e of drawOrder(ents)) {
      if (e.it) s += `<g data-uid="${e.it.uid}" class="${sel === e.it ? 'rm-sel' : ''}">${R.drawFloorItem(e.it)}</g>`;
      else if (e.av) s += drawOwner(e);
      else s += R.drawVisitor(e.v, A.faceUri(e.v.idx), e.v.key);
    }
    $('#roomSvg').innerHTML = s;
    $('#roomZeni').textContent = guest ? `部屋番号 ${guest.pid}` : `${S.zeni.toLocaleString()} 銭`;
    $('#roomTitle').textContent = guest ? `${guest.name}さんの部屋` : 'マイルーム';
    const info = guest || mySoc;
    $('#roomHito').hidden = !(info && info.hito); $('#roomHito').textContent = info && info.hito ? info.hito : '';
    $('#roomVisits').textContent = info && info.visits ? `訪問 今日${info.visits.today}・合計${info.visits.total}` : '';
    $('#rmEdit').hidden = !!guest;
    $('#roomTools').hidden = !(mode === 'edit' && sel);
    if (sel) { $('#rmRot').hidden = !!sel.side; $('#rmName').textContent = cat(sel.k).name; }
    $('#roomStage').classList.toggle('editing', mode === 'edit');
  }

  /* ---------- 部屋の持ち主（アバター）が立つ ---------- */
  function ownerSpot() {
    const busy = new Set();
    for (const it of room().items) if (cat(it.k).kind !== 'flat') { const f = rectOf(it); for (let x = f.x; x < f.x + f.w; x++) for (let y = f.y; y < f.y + f.d; y++) busy.add(x + ',' + y); }
    for (const v of guest ? [] : visitors) busy.add(v.x + ',' + v.y);
    for (const [x, y] of [[8, 8], [7, 9], [9, 7], [6, 8], [8, 6], [9, 9], [5, 9], [9, 5], [10, 10], [4, 10], [10, 4]]) if (!busy.has(x + ',' + y)) return { x, y };
    for (let x = N - 1; x >= 0; x--) for (let y = N - 1; y >= 0; y--) if (!busy.has(x + ',' + y)) return { x, y };
    return null;
  }
  function drawOwner(e) {
    const look = guest ? guest.av : S.av;
    const [sx, sy] = R.proj(e.x + .5, e.y + .5, 0), w = 46, h = w * AV.H / AV.W;
    return `<g class="rm-owner"><ellipse cx="${sx}" cy="${sy}" rx="14" ry="5" fill="rgba(0,0,0,.25)"/><svg x="${sx - w / 2}" y="${sy - h + 4}" width="${w}" height="${h}" viewBox="${AV.VB}">${AV.inner(look || AV.PRESETS.girl)}</svg></g>`;
  }

  /* ---------- 遊びに来るキャラ ---------- */
  function unlocked() {
    const mine = A.VARIANTS[P.charaIdx()].key;
    return A.VARIANTS.map((v, idx) => ({ v, idx })).filter(({ v }) => v.key === mine ? (S.wins || 0) >= 5 : (S.vs[v.key] || 0) >= 5);
  }
  function placeVisitors() {
    visitors = [];
    const list = unlocked().sort(() => Math.random() - .5).slice(0, 2);
    const busy = new Set();
    for (const it of room().items) if (cat(it.k).kind !== 'flat') { const f = rectOf(it); for (let x = f.x; x < f.x + f.w; x++) for (let y = f.y; y < f.y + f.d; y++) busy.add(x + ',' + y); }
    for (const u of list) {
      for (let t = 0; t < 60; t++) {
        const x = 2 + ((Math.random() * (N - 3)) | 0), y = 2 + ((Math.random() * (N - 3)) | 0);
        if (busy.has(x + ',' + y)) continue;
        busy.add(x + ',' + y); visitors.push({ key: u.v.key, idx: u.idx, name: u.v.name, x, y }); break;
      }
    }
  }
  // 今の部屋に合うセリフを選ぶ（家具や雰囲気に関係あるものを出やすく、最近のものは出さない）
  function facts() {
    const r = room(), has = new Set(), styles = { wa: 0, yo: 0, chu: 0 };
    let n = 0, lit = false;
    for (const it of r.items.concat(r.walls)) { const c = cat(it.k); has.add(it.k); styles[c.style]++; n++; if (it.on) lit = true; }
    const top = Object.entries(styles).sort((a, b) => b[1] - a[1]);
    return { has, n, lit, style: top[0][1] > top[1][1] ? top[0][0] : null, floor: r.floor, wall: r.wall };
  }
  function pickLine(key) {
    const f = facts(), list = LINES[key] || [];
    const ok = (cond) => {
      if (cond === 'any') return true;
      if (cond === 'empty') return f.n <= 3;
      if (cond === 'many') return f.n >= 12;
      if (cond === 'lit') return f.lit;
      if (cond === 'wa' || cond === 'yo' || cond === 'chu') return f.style === cond;
      const [a, b] = cond.split(':');
      if (a === 'has') return f.has.has(b);
      if (a === 'floor') return f.floor === b;
      if (a === 'wall') return f.wall === b;
      return false;
    };
    const seen = room().seen;
    let cands = list.map((l, i) => ({ l, i, id: key + ':' + i })).filter(c => ok(c.l[0]));
    const fresh = cands.filter(c => !seen.includes(c.id));
    if (fresh.length) cands = fresh;
    const weight = c => c.l[0] === 'any' ? 1 : 3;
    let t = Math.random() * cands.reduce((a, c) => a + weight(c), 0);
    let pick = cands[0];
    for (const c of cands) { t -= weight(c); if (t <= 0) { pick = c; break; } }
    if (!pick) return '……';
    seen.push(pick.id); while (seen.length > 30) seen.shift();
    P.saveLocal();
    return pick.l[1];
  }
  // キャラごとの、一局打つときの強さ（Bot の級）
  const CHARA_LV = { mike: 1, hinata: 3, shima: 5, tomoe: 7, tono: 8, gensai: 9 };
  function talk(v) {
    const b = $('#roomBubble');
    b.querySelector('b').textContent = v.name;
    b.querySelector('p').textContent = pickLine(v.key);
    b.hidden = false;
    b.dataset.key = v.key;
    $('#rbNext').onclick = () => talk(v);
    $('#rbPlay').onclick = () => {
      const lv = CHARA_LV[v.key] != null ? CHARA_LV[v.key] : Math.min(P.BOT_MAX, Math.max(0, Math.floor(((S.rating || 1050) - 1050) / 50)));
      P.confirmBox(`${v.name}と一局打ちますか？（Bot ${P.RANKS[lv]}・レート対局）`, () => { b.hidden = true; flush(); P.playChara(v.idx, lv); });
    };
    P.sound('tap');
  }

  /* ---------- 操作 ---------- */
  const svg = () => $('#roomSvg');
  function svgPoint(e) {
    const s = svg(), pt = s.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
    const q = pt.matrixTransform(s.getScreenCTM().inverse()); return [q.x, q.y];
  }
  function findItem(e) {
    const g = e.target.closest && e.target.closest('[data-uid]'); if (!g) return null;
    const uid = +g.dataset.uid, r = room();
    return r.items.find(i => i.uid === uid) || r.walls.find(i => i.uid === uid) || null;
  }
  function onDown(e) {
    $('#roomBubble').hidden = true;
    const vg = e.target.closest && e.target.closest('.rm-visitor');
    if (mode === 'view' && guest) return;   // ほかの人の部屋は見るだけ
    if (mode === 'view') {
      if (vg) { const v = visitors.find(x => x.key === vg.dataset.key); if (v) talk(v); return; }
      const it = findItem(e); if (!it) return;
      const c = cat(it.k);
      if (c.light) { it.on = !it.on; touch(); P.sound('tap'); render(); return; }
      if (it.k === 'goban') { P.confirmBox('対人戦で一局打ちますか？', () => { flush(); P.startMatch(); }); return; }
      return;
    }
    const it = findItem(e);
    if (!it) { sel = null; render(); return; }
    sel = it;
    const [sx, sy] = svgPoint(e);
    if (it.side) {
      const w = R.toWall(sx, sy);
      drag = { it, wall: true, off: w.u - it.u, orig: { side: it.side, u: it.u }, ok: true };
    } else {
      const g = R.toGrid(sx, sy);
      drag = { it, off: [g.x - it.x, g.y - it.y], orig: { x: it.x, y: it.y }, ok: true };
    }
    svg().setPointerCapture(e.pointerId);
    e.preventDefault();
    render();
  }
  function onMove(e) {
    if (!drag) return;
    const [sx, sy] = svgPoint(e), it = drag.it;
    if (drag.wall) {
      const w = R.toWall(sx, sy), u = Math.round(w.u - drag.off);
      const cu = Math.max(0, Math.min(N - cat(it.k).w, u));
      if (cu !== it.u || w.side !== it.side) { it.side = w.side; it.u = cu; drag.ok = canPlaceWall(it, it.side, it.u); render(); }
    } else {
      const g = R.toGrid(sx, sy), f = R.footprint(it);
      const x = Math.max(0, Math.min(N - f.w, Math.round(g.x - drag.off[0]))), y = Math.max(0, Math.min(N - f.d, Math.round(g.y - drag.off[1])));
      if (x !== it.x || y !== it.y) { it.x = x; it.y = y; drag.ok = canPlace(it, x, y, it.rot); render(); }
    }
  }
  function onUp() {
    if (!drag) return;
    const it = drag.it;
    if (!drag.ok) { Object.assign(it, drag.orig); P.toast('そこには置けません'); }
    else P.sound('stone');
    drag = null; touch(); render();
  }

  function rotateSel() {
    if (!sel || sel.side) return;
    const nr = sel.rot ? 0 : 1;
    if (canPlace(sel, sel.x, sel.y, nr)) { sel.rot = nr; touch(); render(); return; }
    // その場で回せなければ、近くの空いている場所へ
    const t = Object.assign({}, sel, { rot: nr }), spot = freeSpot(t);
    if (spot) { sel.rot = nr; sel.x = spot.x; sel.y = spot.y; touch(); render(); }
    else P.toast('回すための場所がありません');
  }
  function storeSel() {
    if (!sel) return;
    const r = room();
    if (sel.side) r.walls = r.walls.filter(w => w !== sel); else r.items = r.items.filter(i => i !== sel);
    sel = null; touch(); render(); if (tab === 'inv') renderPanel();
  }
  function placeFromInv(k) {
    const r = room(), c = cat(k);
    if (invOf(k) <= 0) return;
    const it = { uid: r.seq++, k, rot: 0 };
    if (c.kind === 'wall') { const sp = freeWallSpot(it); if (!sp) { P.toast('壁に空きがありません'); return; } Object.assign(it, sp); r.walls.push(it); }
    else { const sp = freeSpot(it); if (!sp) { P.toast('床に空きがありません'); return; } Object.assign(it, sp); r.items.push(it); }
    mode = 'edit'; sel = it; touch(); setMode('edit'); renderPanel(); render();
    P.toast('ドラッグして好きな場所へ');
  }

  /* ---------- パネル（ショップ・倉庫・お客さん） ---------- */
  let tab = 'shop', shopKind = 'floor', shopStyle = 'all';
  // 家具ひとつを小さく描く（ショップ・倉庫の見本）
  function thumb(k) {
    const c = cat(k);
    if (c.kind === 'wall') return `<svg viewBox="0 0 ${c.w} ${c.h}" class="rm-thumb wall">${c.wall({ on: !!c.light })}</svg>`;
    const it = { k, x: 0, y: 0, rot: 0, on: !!c.light };
    const f = R.footprint(it), hmax = 3.4;
    const a = R.proj(0, f.d, 0), b = R.proj(f.w, 0, 0), t = R.proj(0, 0, hmax), u = R.proj(f.w, f.d, 0);
    const x0 = a[0] - 4, x1 = b[0] + 4, y0 = t[1] - 4, y1 = u[1] + 4;
    return `<svg viewBox="${x0} ${y0} ${x1 - x0} ${y1 - y0}" class="rm-thumb">${R.DEFS}${R.drawFloorItem(it)}</svg>`;
  }
  const STYLE_NAME = { wa: '和', yo: '洋', chu: '中' };
  const BUY_NG = { zeni: '銭が足りません', offline: 'サーバーにつながっていないので、今は買えません', have: 'もう持っています' };
  // 交流パネル（common/social.js）にわたす情報
  const ctx = () => ({
    mine: !guest, pid: guest ? guest.pid : meInfo.pid, name: guest ? guest.name : P.S.name, data: guest || mySoc || {}, me: meInfo,
    visit, home: goHome, reload: () => loadSocial(guest ? guest.pid : null)
  });
  function renderPanel() {
    const p = $('#roomPanel'), r = room();
    document.querySelectorAll('#roomTabs button').forEach(b => {
      b.hidden = b.dataset.own === '1' ? !!guest : b.dataset.own === '0' ? !guest : false;
      b.setAttribute('aria-pressed', String(b.dataset.tab === tab));
    });
    if (['diary', 'chat', 'social', 'owner'].includes(tab)) {
      if (!P.online()) { p.innerHTML = '<p class="rm-help">日記・一言チャット・交流は、サーバーにつながっているときに使えます。</p>'; return; }
      SO.render(tab, ctx(), p);
      return;
    }
    if (tab === 'shop') {
      let h = `<div class="rm-seg">${[['floor', '床の家具'], ['wall', '壁の家具'], ['interior', '床・壁紙']].map(([k, n]) => `<button data-kind="${k}" aria-pressed="${shopKind === k}">${n}</button>`).join('')}</div>`;
      h += `<div class="rm-seg small">${[['all', 'すべて'], ['wa', '和'], ['yo', '洋'], ['chu', '中']].map(([k, n]) => `<button data-style="${k}" aria-pressed="${shopStyle === k}">${n}</button>`).join('')}</div><div class="rm-grid-list">`;
      if (shopKind === 'interior') {
        for (const [kind, table] of [['floors', R.FLOORS], ['walls', R.WALLS]]) for (const [id, it] of Object.entries(table)) {
          if (shopStyle !== 'all' && it.style !== shopStyle) continue;
          const own = r.owned[kind].includes(id), using = (kind === 'floors' ? r.floor : r.wall) === id;
          h += `<div class="rm-card"><div class="rm-swatch ${kind === 'floors' ? 'f-' : 'w-'}${id}"></div><b>${it.name}</b><small>${kind === 'floors' ? '床' : '壁紙'}・${STYLE_NAME[it.style]}</small>
            <button class="btn ${own ? 'lac' : 'primary'} small" data-int="${kind}:${id}" ${using ? 'disabled' : ''}>${using ? '使用中' : own ? '使う' : `${it.price} 銭で買う`}</button></div>`;
        }
      } else {
        for (const c of R.CATALOG) {
          if (c.price <= 0) continue;
          if ((c.kind === 'wall') !== (shopKind === 'wall')) continue;
          if (shopStyle !== 'all' && c.style !== shopStyle) continue;
          const have = r.ownedItems[c.id] || 0;
          h += `<div class="rm-card">${thumb(c.id)}<b>${c.name}</b><small>${STYLE_NAME[c.style]}${c.light ? '・電気' : ''}${have ? `・${have}こ持ってる` : ''}</small>
            <button class="btn primary small" data-buy="${c.id}" ${S.zeni < c.price ? 'disabled' : ''}>${c.price} 銭</button></div>`;
        }
      }
      p.innerHTML = h + '</div>';
    } else if (tab === 'inv') {
      const ks = invKeys();
      p.innerHTML = ks.length ? `<p class="rm-help">タップすると部屋に置きます。もようがえ中に家具を選んで「しまう」と、ここに戻ります。</p><div class="rm-grid-list">${ks.map(k => `<div class="rm-card">${thumb(k)}<b>${cat(k).name}</b><small>${invOf(k)}こ</small><button class="btn primary small" data-place="${k}">置く</button></div>`).join('')}</div>`
        : '<p class="rm-help">倉庫は空っぽです。ショップで家具を買うと、ここに入ります。</p>';
    } else {
      const mine = A.VARIANTS[P.charaIdx()].key;
      p.innerHTML = `<p class="rm-help">5勝すると遊びに来ます。自分のキャラは通算5勝、ほかのキャラはそのキャラに5勝（対局相手のキャラはBotの強さで変わります）。遊びに来たキャラをタップするとおしゃべり、「一局打つ」で対局できます。</p><div class="rm-guests">` +
        A.VARIANTS.map((v, i) => {
          const n = v.key === mine ? (S.wins || 0) : (S.vs[v.key] || 0), ok = n >= 5;
          return `<div class="rm-guest ${ok ? 'ok' : ''}"><img src="${A.faceUri(i)}" alt=""><div><b>${v.name}</b><small>${ok ? '遊びに来ます' : `あと ${5 - n} 勝${v.key === mine ? '（通算）' : ''}`}</small></div></div>`;
        }).join('') + '</div>';
    }
  }
  function onPanelClick(e) {
    if (SO.onClick(e, ctx())) return;
    const b = e.target.closest('button'); if (!b) return;
    const r = room();
    if (b.dataset.kind) { shopKind = b.dataset.kind; renderPanel(); return; }
    if (b.dataset.style) { shopStyle = b.dataset.style; renderPanel(); return; }
    if (b.dataset.buy) {
      const c = cat(b.dataset.buy);
      if (S.zeni < c.price) { P.toast('銭が足りません'); return; }
      P.confirmBox(`${c.name}を ${c.price} 銭で買いますか？`, () => {
        P.buy({ item: c.id }, c.price, res => {
          if (!res.ok) { P.toast(BUY_NG[res.reason] || '買えませんでした'); return; }
          P.sound('ok'); P.toast(`${c.name}を買いました。倉庫から置けます`); renderPanel(); render();
        });
      });
      return;
    }
    if (b.dataset.place) { placeFromInv(b.dataset.place); return; }
    if (b.dataset.int) {
      const [kind, id] = b.dataset.int.split(':'), table = kind === 'floors' ? R.FLOORS : R.WALLS, it = table[id];
      const use = () => { if (kind === 'floors') r.floor = id; else r.wall = id; dirty = true; flush(); renderPanel(); render(); };
      if (r.owned[kind].includes(id)) { use(); return; }
      if (S.zeni < it.price) { P.toast('銭が足りません'); return; }
      P.confirmBox(`${it.name}を ${it.price} 銭で買いますか？`, () => {
        P.buy(kind === 'floors' ? { floor: id } : { wall: id }, it.price, res => {
          if (!res.ok) { P.toast(BUY_NG[res.reason] || '買えませんでした'); return; }
          P.sound('ok'); use();
        });
      });
    }
  }
  function setMode(m) {
    if (mode === 'edit' && m === 'view') flush();   // もようがえを終えたときだけ、部屋の配置をサーバーへ送る
    mode = m;
    if (m === 'view') { sel = null; if (!guest) placeVisitors(); }
    $('#rmEdit').textContent = m === 'edit' ? 'もようがえを終わる' : 'もようがえ';
    $('#rmEdit').classList.toggle('primary', m === 'edit');
    $('#roomBubble').hidden = true;
    render();
  }

  function open() {
    guest = null;
    room();
    tab = 'shop'; mode = 'view'; sel = null;
    P.showScreen('myroom');
    setMode('view');
    renderPanel();
    loadSocial(null);
    // 遊びに来ていたら、ひとこと
    if (visitors.length) setTimeout(() => { if (!$('#myroom').hidden) talk(visitors[0]); }, 500);
  }
  // 交流の情報を読みこむ（自分の部屋なら「自分の情報」と「自分の部屋」、ほかの部屋ならその部屋）
  function loadSocial(pid) {
    if (!P.online()) return;
    if (!pid) {
      P.soc('me', {}, res => {
        if (!res.ok) return;
        meInfo = res; S.pid = res.pid;
        P.soc('visit', { pid: res.pid }, r2 => { if (r2.ok && !guest) { mySoc = r2; render(); renderPanel(); } });
      });
    } else {
      P.soc('visit', { pid }, res => {
        if (!res.ok) { P.toast(SO.why(res)); if (res.reason === 'blocked') goHome(); return; }
        if (res.mine) { goHome(); return; }
        guest = res; render(); renderPanel();
      });
    }
  }
  function visit(pid) {
    pid = String(pid || '');
    if (!pid) return;
    if (pid === String(meInfo.pid)) { goHome(); return; }
    if (mode === 'edit') setMode('view');
    flush();
    P.soc('visit', { pid }, res => {
      if (!res.ok) { P.toast(SO.why(res)); return; }
      if (res.mine) { goHome(); return; }
      guest = res; tab = 'diary'; sel = null; mode = 'view';
      P.showScreen('myroom'); $('#roomBubble').hidden = true;
      render(); renderPanel(); P.sound('stone');
    });
  }
  function goHome() { guest = null; tab = 'social'; setMode('view'); renderPanel(); loadSocial(null); }
  // えらぶ画面に出す、小さな自分の部屋
  function mini() {
    const g = guest; guest = null;
    const r = room();
    let s = R.DEFS + R.drawWalls(r.wall) + R.drawFloor(r.floor);
    for (const w of r.walls) s += R.drawWallItem(w, {});
    const ents = r.items.map(it => Object.assign(rectOf(it), { it }));
    for (const e of drawOrder(ents)) s += R.drawFloorItem(e.it);
    guest = g;
    return `<svg viewBox="0 0 ${R.W} ${R.H}" aria-hidden="true">${s}</svg>`;
  }

  // つなぐ
  const s = svg();
  s.addEventListener('pointerdown', onDown);
  s.addEventListener('pointermove', onMove);
  s.addEventListener('pointerup', onUp);
  s.addEventListener('pointercancel', onUp);
  $('#roomPanel').addEventListener('click', onPanelClick);
  $('#roomTabs').addEventListener('click', e => { const b = e.target.closest('button'); if (b && b.dataset.tab) { tab = b.dataset.tab; renderPanel(); if (['diary', 'chat', 'social', 'owner'].includes(tab)) loadSocial(guest ? guest.pid : null); } });
  $('#rmEdit').onclick = () => setMode(mode === 'edit' ? 'view' : 'edit');
  $('#rmRot').onclick = rotateSel;
  $('#rmStore').onclick = storeSel;
  $('#rmDone').onclick = () => { sel = null; render(); };
  $('#roomBack').onclick = () => {
    if (guest) { goHome(); return; }
    if (mode === 'edit') setMode('view'); flush();
    if (window.AVATAR_UI) window.AVATAR_UI.openHub(); else { P.renderHome(); P.showScreen('home'); }
  };
  document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
  $('#openRoom').onclick = open;
  s.setAttribute('viewBox', `0 0 ${R.W} ${R.H}`);

  // サーバーから銭・持ち物・部屋が届いたとき（もようがえ中は配置を上書きしない）
  function refresh() {
    if ($('#myroom').hidden || guest) return;
    if (mode === 'edit') { $('#roomZeni').textContent = `${S.zeni.toLocaleString()} 銭`; renderPanel(); return; }
    sel = null; render(); renderPanel();
  }
  window.ROOM = { open, refresh, visit, mini };
})();
