/* 囲碁BLITZ — マイルーム
 *   ・見る：遊びに来たキャラをタップでおしゃべり／碁盤をタップで対局／電気をタップでつける・消す
 *   ・もようがえ：家具をドラッグして置く（マスにぴったり）。回転・しまう
 *   ・ショップ：銭で家具・床・壁紙を買う
 *   ・お客さん：だれが遊びに来るか（自分のキャラは通算5勝、ほかのキャラはそのキャラに5勝）
 */
(function () {
  const P = window.APP, A = P.A, S = P.S, R = window.ROOMART, LINES = window.ROOM_LINES || {}, AV = window.AVATAR, SO = window.SOCIAL;
  const $ = s => document.querySelector(s);
  let N = R.N;   // いま操作している部屋の広さ（12、広くした部屋は17）

  /* ---------- データ ---------- */
  // ほかの人の部屋をたずねているときは guest に、その部屋の情報が入る（見るだけ）
  let guest = null, mySoc = null, meInfo = { pid: S.pid || null, foot: [], friends: [], freq: [], blocks: [], cset: 'all' };
  const DEF_ROOM = () => ({ floor: 'wood', wall: 'plain', items: [{ uid: 1, k: 'goban', x: 5, y: 5, rot: 0 }], walls: [] });
  // 部屋はいくつも持てる（廊下でつながる）。cur は、いま操作している部屋の番号（0 = はじめの部屋）
  let cur = 0;
  function guestRooms() {
    const g = guest.room || (guest.room = DEF_ROOM());
    const list = [g].concat(Array.isArray(guest.rooms2) ? guest.rooms2 : []);
    for (const x of list) { x.items = x.items || []; x.walls = x.walls || []; }
    return list;
  }
  function allRooms() { if (guest) return guestRooms(); const b = base(); return [b].concat(b.extra); }
  function room() {
    let r;
    if (guest) { const list = guestRooms(); if (cur >= list.length) cur = 0; r = list[cur]; }
    else {
      const b = base();
      if (cur > b.extra.length) cur = 0;
      if (!cur) r = b; else { r = b.extra[cur - 1]; r.items = r.items || []; r.walls = r.walls || []; }
    }
    N = r.n || R.N;
    return r;
  }
  // 家の中での部屋の位置（画面のずれ）と、低くする壁（つながっている側）
  const houseOf = () => { const list = allRooms(); return { list, L: R.layout(list) }; };
  const offOf = p => [(p.x - p.y) * R.TW / 2, (p.x + p.y) * R.TH / 2];
  function cutOf(i, list) { if (!i) return {}; const at = list[i].at || R.defAt(i); return at.d === 'y' ? { R: true } : { L: true }; }
  // 持ち物（家具の数・床・壁紙）や番号は、はじめの部屋にまとめて持つ
  function base() {
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
    r.extra = Array.isArray(r.extra) ? r.extra : [];
    if (r.sizeV !== 2) { r.sizeV = 2; refit(r); }
    return r;
  }
  // 家具の「1倍」が大きくなったので、重なった家具は空いている場所へ（置けなければ倉庫へ）
  function refit(r) {
    const items = r.items, walls = r.walls; r.items = []; r.walls = [];
    for (const it of items) { if (!cat(it.k)) continue; if (canPlace(it, it.x, it.y, it.rot)) r.items.push(it); else { const sp = freeSpot(it); if (sp) { Object.assign(it, sp); r.items.push(it); } } }
    for (const it of walls) { if (!cat(it.k)) continue; if (canPlaceWall(it, it.side, it.u)) r.walls.push(it); else { const sp = freeWallSpot(it); if (sp) { Object.assign(it, sp); r.walls.push(it); } } }
    dirty = true;
  }
  // 倉庫にある数＝持っている数－置いている数
  function invOf(k) { let n = base().ownedItems[k] || 0; for (const r of allRooms()) n -= r.items.concat(r.walls).filter(i => i.k === k && !i.trial).length; return n; }
  function invKeys() { return Object.keys(base().ownedItems).filter(k => invOf(k) > 0); }
  let dirty = false;   // 配置を変えたが、まだサーバーに送っていない
  function flush() { if (dirty) { dirty = false; P.saveRoom(); } }
  const touch = () => { dirty = true; P.saveLocal(); };
  const cat = k => R.BY_ID[k];

  /* ---------- 置けるかどうか ---------- */
  function rectOf(it) { const f = R.footprint(it); return { x: it.x, y: it.y, w: f.w, d: f.d }; }
  const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.d && b.y < a.y + a.d;
  function canPlace(it, x, y, rot) {
    const c = cat(it.k), f = R.footprint(Object.assign({}, it, { rot }));
    if (x < 0 || y < 0 || x + f.w > N || y + f.d > N) return false;
    const me = { x, y, w: f.w, d: f.d };
    for (const o of room().items) {
      if (o === it) continue;
      if ((cat(o.k).kind === 'flat') !== (c.kind === 'flat')) continue;   // ラグの上には家具を置ける
      if (overlap(me, rectOf(o))) return false;
    }
    return true;
  }
  // 壁の家具の幅と高さ（大きさの倍率つき）
  const wallBox = it => { const c = cat(it.k), s = R.wallScale(it); return { w: Math.max(1, Math.ceil(c.w * s - 1e-9)), v: c.v, h: c.h * s }; };
  function canPlaceWall(it, side, u) {
    if (cutOf(cur, allRooms())[side]) return false;   // 低い壁（廊下の側）には、かけられない
    const b = wallBox(it);
    if (u < 0 || u + b.w > N || b.v + b.h > R.WH + 1e-9) return false;
    for (const o of room().walls) {
      if (o === it || o.side !== side) continue;
      const ob = wallBox(o);
      if (u < o.u + ob.w && o.u < u + b.w && b.v < ob.v + ob.h && ob.v < b.v + b.h) return false;
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
  // ほかの部屋（見るだけ）：床・壁・家具・呼んだキャラ
  function drawRoomStatic(rm, i, list, hall) {
    const n = rm.n || R.N, cut = cutOf(i, list);
    let s = R.drawWalls(rm.wall || 'plain', n, cut) + R.drawFloor(rm.floor || 'wood', n);
    if (hall) s += R.drawDoor(hall.d === 'y' ? 'R' : 'L', hall.u0, hall.u1);
    for (const w of rm.walls || []) if (cat(w.k) && !w.trial) s += R.drawWallItem(w, {});
    const items = (rm.items || []).filter(it => cat(it.k) && !it.trial);
    for (const it of items.filter(it => cat(it.k).kind === 'flat')) s += R.drawFloorItem(it);
    const ents = items.filter(it => cat(it.k).kind !== 'flat').map(it => Object.assign(rectOf(it), { it }));
    const ck = rm.g && (guest || charaKeys().has(rm.g)) ? rm.g : null;
    if (ck) { const sp = charaSpot(Object.assign({}, rm, { items }), null); if (sp) ents.push({ x: sp.x, y: sp.y, w: 1, d: 1, ch: ck }); }
    for (const e of drawOrder(ents)) s += e.it ? R.drawFloorItem(e.it) : drawChara(e.ch, e.x, e.y, false);
    return s;
  }
  function render() {
    const r = room(), H = houseOf(), multi = H.list.length > 1;
    const hallTo = i => H.L.halls.find(h => h.i === i);
    const myOff = offOf(H.L.pos[cur]);
    let back = '', front = '';
    // 家のほかの部屋と廊下：奥にあるものから順に
    const parts = H.list.map((rm, i) => ({ i, k: H.L.pos[i].x + H.L.pos[i].y })).concat(H.L.halls.map(h => ({ h, k: h.x0 + h.y0 + .5 }))).sort((a, b) => a.k - b.k);
    const myK = H.L.pos[cur].x + H.L.pos[cur].y;
    // 廊下は床なので、いちばん先に描く（扉・家具・アバターが上にくる）
    for (const h of H.L.halls) back += `<g class="rm-hallg" pointer-events="none">${R.drawHall(h.x0, h.y0, h.x1, h.y1)}</g>`;
    for (const pt of parts) {
      let g;
      if (pt.h) continue;
      else if (pt.i === cur) continue;
      else { const o = offOf(H.L.pos[pt.i]), rm = H.list[pt.i], n = rm.n || R.N, top = R.proj(n / 2, n / 2, 0);
        g = `<g class="rm-other" data-room="${pt.i}" transform="translate(${o[0]} ${o[1]})">${drawRoomStatic(rm, pt.i, H.list, hallTo(pt.i))}<text x="${top[0]}" y="${top[1]}" class="rm-room-label">部屋${pt.i + 1}</text></g>`; }
      if (pt.k < myK) back += g; else front += g;
    }
    const cutMe = cutOf(cur, H.list), hallMe = hallTo(cur);
    let s = R.DEFS + back + `<g id="rmActive" transform="translate(${myOff[0]} ${myOff[1]})">` + R.drawWalls(r.wall, N, cutMe) + R.drawFloor(r.floor, N);
    if (hallMe) s += R.drawDoor(hallMe.d === 'y' ? 'R' : 'L', hallMe.u0, hallMe.u1);
    if (editing()) {   // マス目
      for (let i = 0; i <= N; i++) {
        const a = R.proj(i, 0, 0), b = R.proj(i, N, 0), c = R.proj(0, i, 0), d = R.proj(N, i, 0);
        s += `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" class="rm-grid"/><line x1="${c[0]}" y1="${c[1]}" x2="${d[0]}" y2="${d[1]}" class="rm-grid"/>`;
      }
    }
    for (const w of r.walls) s += `<g data-uid="${w.uid}" data-wall="1" class="${sel === w ? 'rm-sel' : ''}${w.trial ? ' rm-trial' : ''}">${R.drawWallItem(w, {})}</g>`;
    const flats = r.items.filter(i => cat(i.k).kind === 'flat'), solids = r.items.filter(i => cat(i.k).kind !== 'flat');
    for (const it of flats) s += `<g data-uid="${it.uid}" class="${sel === it ? 'rm-sel' : ''}${it.trial ? ' rm-trial' : ''}">${R.drawFloorItem(it)}</g>`;
    // 選んでいる家具の足もと（置けるなら緑、置けないなら赤）
    if (sel && !sel.side && (editing() || sel.trial)) {
      const f = R.footprint(sel), ok = drag ? drag.ok : true;
      const q = [R.proj(sel.x, sel.y, 0), R.proj(sel.x + f.w, sel.y, 0), R.proj(sel.x + f.w, sel.y + f.d, 0), R.proj(sel.x, sel.y + f.d, 0)];
      s += `<polygon points="${q.map(p => p.join(',')).join(' ')}" class="rm-foot ${ok ? 'ok' : 'ng'}"/>`;
    }
    const owner = ownerSpot(), ch = charaSpot(r, owner);
    const ents = solids.map(it => Object.assign(rectOf(it), { it }))
      .concat(owner ? [{ x: owner.x, y: owner.y, w: 1, d: 1, av: true }] : [])
      .concat(ch ? [{ x: ch.x, y: ch.y, w: 1, d: 1, ch: ch.key }] : []);
    for (const e of drawOrder(ents)) {
      if (e.it) s += `<g data-uid="${e.it.uid}" class="${sel === e.it ? 'rm-sel' : ''}${e.it.trial ? ' rm-trial' : ''}">${R.drawFloorItem(e.it)}</g>`;
      else if (e.av) s += drawOwner(e);
      else s += drawChara(e.ch, e.x, e.y, true);
    }
    if (multi) { const top = R.proj(N / 2, N / 2, 0); s += `<text x="${top[0]}" y="${top[1]}" class="rm-room-label on">部屋${cur + 1}</text>`; }
    s += '</g>' + front;
    $('#roomSvg').innerHTML = s;
    houseBar();
    if (viewKey !== cur + ':' + N + ':' + H.list.length) { viewKey = cur + ':' + N + ':' + H.list.length; setZoom(zoom.z < 1 ? zoom.z : 1, null, null, true); }
    uiSync();
  }
  const editing = () => mode === 'edit' || mode === 'shop';   // 家具を動かせるとき（もようがえ・ショップ）
  // 画面の部品を、いまの状態（見る・もようがえ・ショップ・ほかの人の部屋）に合わせる
  function uiSync() {
    if (guest) $('#roomZeni').textContent = `部屋番号 ${guest.pid}`; else $('#roomZeni').innerHTML = `${S.zeni.toLocaleString()} 銭<i class="chip-tama">勾玉 ${(S.tama | 0).toLocaleString()}</i>`;
    $('#roomTitle').textContent = guest ? `${guest.name}さんの部屋` : 'マイルーム';
    const info = guest || mySoc;
    $('#roomHito').hidden = !(info && info.hito); $('#roomHito').textContent = info && info.hito ? info.hito : '';
    $('#roomVisits').textContent = info && info.visits ? `訪問 今日${info.visits.today}・合計${info.visits.total}` : '';
    const shop = mode === 'shop' && !guest, own = !guest;
    $('#roomGuestBar').hidden = !guest;
    $('#roomShop').hidden = !shop;
    $('#roomDock').hidden = !own;
    $('#roomLower').hidden = shop || (own && mode === 'view' && !dockTab);
    $('#visitIcons').hidden = !own || mode !== 'view' || !!dockTab;
    if (!own || mode !== 'view' || dockTab) $('#visit').hidden = true;
    document.querySelectorAll('#roomDock [data-dock]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.dock === (mode === 'edit' ? 'edit' : mode === 'shop' ? 'shop' : dockTab))));
    document.querySelectorAll('#roomTabs button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tab === tab)));
    $('#rmHouseAll').hidden = allRooms().length < 2;
    $('#roomTools').hidden = !(editing() && sel);
    if (sel) { $('#rmRot').hidden = !!sel.side; $('#rmName').textContent = cat(sel.k).name; $('#rmSize').textContent = `大きさ ×${R.sizeOf(sel)}`; $('#rmStore').textContent = sel.trial ? 'もどす' : 'しまう'; }
    $('#roomStage').classList.toggle('editing', editing());
    $('#myroom').classList.toggle('rm-shopping', shop);
  }

  /* ---------- 部屋の持ち主（アバター）が立つ ---------- */
  function ownerSpot() {
    const busy = new Set();
    for (const it of room().items) if (cat(it.k).kind !== 'flat') { const f = rectOf(it); for (let x = f.x; x < f.x + f.w; x++) for (let y = f.y; y < f.y + f.d; y++) busy.add(x + ',' + y); }
    for (const v of guest ? [] : visitors) busy.add(v.x + ',' + v.y);
    const av = room().av;
    if (av && Number.isInteger(av.x) && Number.isInteger(av.y) && !busy.has(av.x + ',' + av.y)) return { x: av.x, y: av.y };
    for (const [x, y] of [[3, 9], [9, 3], [2, 8], [8, 2], [4, 10], [10, 4], [9, 9], [10, 10]]) if (!busy.has(x + ',' + y)) return { x, y };
    for (let x = N - 1; x >= 0; x--) for (let y = N - 1; y >= 0; y--) if (!busy.has(x + ',' + y)) return { x, y };
    return null;
  }
  function drawOwner(e) {
    const look = guest ? guest.av : S.av;
    const [sx, sy] = R.proj(e.x + .5, e.y + .5, 0), w = 80, h = w * AV.H / AV.W;
    const on = drag && drag.av;
    // 背の高い絵なので、つかめるのは足もと〜おなかのあたりだけ（うしろの家具をさわれるように）
    return `<g class="rm-owner${editing() ? ' movable' : ''}${on ? ' rm-sel' : ''}"><ellipse cx="${sx}" cy="${sy}" rx="14" ry="5" fill="rgba(0,0,0,.25)"/><svg x="${sx - w / 2}" y="${sy - h * .955}" width="${w}" height="${h}" viewBox="${AV.VB}" pointer-events="none">${AV.inner(look || AV.PRESETS.girl)}</svg>` +
      `<rect class="rm-owner-hit" x="${sx - 13}" y="${sy - h * 0.55}" width="26" height="${h * 0.55 + 4}" rx="8" fill="transparent"/></g>`;
  }

  /* ---------- 部屋に呼んだキャラ（1部屋に1人） ---------- */
  const charaKeys = () => guest ? null : new Set(unlocked().map(u => u.v.key));
  function charaSpot(rm, owner) {
    const key = rm.g; if (!key) return null;
    if (!guest && !charaKeys().has(key)) return null;
    const busy = new Set();
    for (const it of rm.items) if (cat(it.k) && cat(it.k).kind !== 'flat') { const f = rectOf(it); for (let x = f.x; x < f.x + f.w; x++) for (let y = f.y; y < f.y + f.d; y++) busy.add(x + ',' + y); }
    if (owner) busy.add(owner.x + ',' + owner.y);
    const gp = rm.gp;
    if (gp && Number.isInteger(gp.x) && Number.isInteger(gp.y) && !busy.has(gp.x + ',' + gp.y)) return { key, x: gp.x, y: gp.y };
    for (const [x, y] of [[6, 8], [8, 6], [5, 9], [9, 5], [7, 7], [4, 8], [8, 4], [10, 7]]) if (!busy.has(x + ',' + y)) return { key, x, y };
    for (let x = N - 1; x >= 0; x--) for (let y = N - 1; y >= 0; y--) if (!busy.has(x + ',' + y)) return { key, x, y };
    return null;
  }
  // キャラの立ち姿（透過画像）。足もとに影
  function drawChara(key, gx, gy, live) {
    const [sx, sy] = R.proj(gx + .5, gy + .5, 0), w = 60, h = 112, on = live && drag && drag.gp;
    return `<g class="rm-chara${live && editing() ? ' movable' : ''}${on ? ' rm-sel' : ''}" data-chara="${key}"><ellipse cx="${sx}" cy="${sy}" rx="15" ry="5" fill="rgba(0,0,0,.25)"/>` +
      `<image href="${standSrc(key)}" x="${sx - w / 2}" y="${sy - h + 4}" width="${w}" height="${h}" preserveAspectRatio="xMidYMax meet" pointer-events="none"/>` +
      `<rect class="rm-owner-hit" x="${sx - 14}" y="${sy - h * 0.6}" width="28" height="${h * 0.6 + 4}" rx="8" fill="transparent"/></g>`;
  }
  function charaWhere(key) { const list = allRooms(); for (let i = 0; i < list.length; i++) if (list[i].g === key) return i; return -1; }
  function callChara(key) {
    for (const rm of allRooms()) if (rm.g === key) { delete rm.g; delete rm.gp; }
    const r = room(); r.g = key; delete r.gp;
    touch(); flush(); P.sound('ok');
    const v = guests.find(g => g.key === key); if (v) { curGuest = v; showVisit(); }
    render(); renderPanel();
  }
  function sendHome(key) { for (const rm of allRooms()) if (rm.g === key) { delete rm.g; delete rm.gp; } touch(); flush(); P.sound('tap'); render(); renderPanel(); }

  /* ---------- 家：部屋どうしは廊下と扉でつながる。部屋をタップすると、その部屋を操作（まんなかへ） ---------- */
  let viewKey = '';
  function pickRoom(i, quiet) {
    if (i === cur) { focusRoom(); return; }
    if (mode === 'shop') {
      // ショップのまま、ほかの部屋へ（試し置きは、それぞれの部屋に残る）
      sel = null; drag = null; addMode = false; cur = i; room(); snapRoom(i);
      if (!quiet) P.sound('stone');
      viewKey = 'x'; render(); renderPanel(); focusRoom(); return;
    }
    clearTrials(); sel = null; drag = null; addMode = false;
    cur = i; room();
    if (!quiet) P.sound('stone');
    viewKey = 'x'; render(); renderPanel(); showVisit(); focusRoom();
  }
  const ROOM_MAX = 6, ROOM_PRICE = 10000, BIG_PRICE = 5000, BIG_N = 17;
  let addMode = false;
  // 家のメニュー（もようがえの上）：部屋を増やす（右下・左下）・広くする
  function houseBar() {}
  function houseHtml() {
    if (guest) return '';
    const H = houseOf();
    let h = `<div class="rm-house"><b>${H.list.length > 1 ? `部屋${cur + 1}` : 'この部屋'}${N >= BIG_N ? '（広い）' : ''}</b>`;
    if (addMode) {
      const okX = R.canAttach(H.list, cur, 'x', 12), okY = R.canAttach(H.list, cur, 'y', 12);
      h += `<button type="button" class="btn primary small" data-house="add-y" ${okY ? '' : 'disabled'}>↙ 左下につなぐ</button><button type="button" class="btn primary small" data-house="add-x" ${okX ? '' : 'disabled'}>右下につなぐ ↘</button><button type="button" class="btn lac small" data-house="cancel">やめる</button>`;
    } else {
      if (H.list.length < ROOM_MAX) h += `<button type="button" class="btn lac small" data-house="add">＋部屋を増やす <small>${ROOM_PRICE.toLocaleString()}銭</small></button>`;
      if (N < BIG_N) h += `<button type="button" class="btn lac small" data-house="big">広くする <small>${BIG_PRICE.toLocaleString()}銭</small></button>`;
    }
    return h + '</div>';
  }
  function buyRoom(d) {
    if ((S.zeni || 0) < ROOM_PRICE) { P.toast(`部屋を増やすには ${ROOM_PRICE.toLocaleString()} 銭いります`); return; }
    const from = cur;
    P.confirmBox(`${ROOM_PRICE.toLocaleString()} 銭で、部屋${from + 1}の${d === 'y' ? '左下' : '右下'}に廊下をのばして、部屋を増やしますか？`, () => {
      flush();
      P.buy({ roomAdd: 1, p: from, d }, ROOM_PRICE, res => {
        if (!res.ok) { P.toast(res.reason === 'max' ? '部屋はこれ以上増やせません' : res.reason === 'used' ? 'その向きには、もう部屋があります' : (BUY_NG[res.reason] || '買えませんでした')); return; }
        addMode = false;
        const n = base().extra.length;
        pickRoom(n, true); renderPanel();
        window.FANFARE.thanks({ who: 'shima',  items: [{ thumb: '<span class="ff-emoji">🏠</span>', name: `部屋${n + 1}` }], title: '部屋が増えました！', then: () => P.toast(`部屋${n + 1}ができました！ もようがえしてみましょう`) });
      });
    });
  }
  function bigRoom() {
    const H = houseOf(), test = H.list.map((x, i) => i === cur ? Object.assign({}, x, { n: BIG_N }) : x);
    if (!houseFits(test)) { P.toast('となりの部屋とぶつかるので、この部屋は広くできません'); return; }
    if ((S.zeni || 0) < BIG_PRICE) { P.toast(`広くするには ${BIG_PRICE.toLocaleString()} 銭いります`); return; }
    P.confirmBox(`${BIG_PRICE.toLocaleString()} 銭で、部屋${cur + 1}を広くしますか？（12×12マス → 17×17マス。広さはおよそ2倍）`, () => {
      flush();
      P.buy({ roomBig: cur }, BIG_PRICE, res => {
        if (!res.ok) { P.toast(BUY_NG[res.reason] || '広くできませんでした'); return; }
        room().n = BIG_N; viewKey = 'x'; render(); renderPanel();
        window.FANFARE.thanks({ who: 'shima',  items: [{ thumb: '<span class="ff-emoji">📐</span>', name: '17×17マス' }], title: '部屋が広くなりました！' });
      });
    });
  }
  // 家の中で、部屋と廊下が重なっていないか
  function houseFits(list) {
    const L = R.layout(list), rs = L.pos.map((p, i) => ({ x0: p.x, y0: p.y, x1: p.x + (list[i].n || R.N), y1: p.y + (list[i].n || R.N) }));
    const hit = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
    for (let a = 0; a < rs.length; a++) for (let b = a + 1; b < rs.length; b++) if (hit(rs[a], rs[b])) return false;
    for (const h of L.halls) rs.forEach((q, k) => { if (k !== h.i && k !== h.p && hit(h, q)) rs.bad = true; });
    return !rs.bad;
  }
  function onHouse(a) {
    if (a === 'add') { addMode = true; P.sound('tap'); renderPanel(); return; }
    if (a === 'cancel') { addMode = false; renderPanel(); return; }
    if (a === 'add-x' || a === 'add-y') { buyRoom(a === 'add-y' ? 'y' : 'x'); return; }
    if (a === 'big') bigRoom();
  }
  $('#rmHouseAll').onclick = () => { P.sound('tap'); showAll(); };

  function avFree(x, y) {
    for (const it of room().items) if (cat(it.k).kind !== 'flat') { const f = rectOf(it); if (x >= f.x && x < f.x + f.w && y >= f.y && y < f.y + f.d) return false; }
    return true;
  }

  /* ---------- 遊びに来るキャラ ---------- */
  function unlocked() {
    const mine = A.VARIANTS[P.charaIdx()].key;
    // 段級位で解放されたキャラだけが、5勝したら遊びに来る
    return A.VARIANTS.map((v, idx) => ({ v, idx })).filter(({ v, idx }) => P.charaOpen(idx) && (v.key === mine ? (S.wins || 0) >= 5 : (S.vs[v.key] || 0) >= 5));
  }
  // 遊びに来られるキャラ（いまは部屋の中には描かず、部屋の左下に一人ずつ出す）
  let guests = [], curGuest = null;
  function placeVisitors() {
    visitors = [];
    guests = unlocked().map(u => ({ key: u.v.key, idx: u.idx, name: u.v.name }));
    if (!guests.some(g => curGuest && g.key === curGuest.key)) {
      const today = S.visitDay && guests.find(g => g.key === S.visitDay.key);
      curGuest = today || guests[Math.floor(Math.random() * guests.length)] || null;
    }
    return;
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
    const seen = base().seen;
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
  const CHARA_LV = { mike: 1, hinata: 3, shima: 5, tomoe: 7, tono: 8, gensai: 9, dgensai: 13 };
  // 立ち姿の絵（透過画像があるキャラはそれ、ないキャラはカットインの切りぬき）
  const STAND = new Set(['hinata', 'shima', 'tomoe', 'mike', 'tono']);
  const standSrc = key => STAND.has(key) ? `img/stand_${key}.webp` : `img/visit_${key}.webp`;
  function showVisit() {
    const box = $('#visit');
    if (!guest) { const k = room().g, v = k && guests.find(g => g.key === k); if (v) curGuest = v; }
    if (guest || mode !== 'view' || dockTab || !curGuest) { box.hidden = true; $('#visitIcons').innerHTML = ''; return; }
    box.hidden = false;
    talk(curGuest, true);
    $('#visitIcons').innerHTML = guests.length ? guests.map(g => `<button type="button" data-key="${g.key}" aria-pressed="${g.key === curGuest.key}" title="${g.name}"><img src="${A.faceUri(g.idx)}" alt="${g.name}"></button>`).join('') : '';
  }
  function talk(v, quiet) {
    curGuest = v;
    const img = $('#visitImg');
    if (img.dataset.key !== v.key) { img.dataset.key = v.key; img.src = standSrc(v.key); img.classList.toggle('bust', !STAND.has(v.key)); img.classList.remove('in'); void img.offsetWidth; img.classList.add('in'); }
    $('#visitName').textContent = v.name;
    $('#visitLine').textContent = pickLine(v.key);
    const b = $('#visitBubble'); b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
    for (const x of document.querySelectorAll('#visitIcons button')) x.setAttribute('aria-pressed', String(x.dataset.key === v.key));
    callBtn();
    if (!quiet) P.sound('tap');
  }
  $('#visitNext').onclick = () => curGuest && talk(curGuest);
  // 吹き出しの「部屋に呼ぶ」「帰ってもらう」（1部屋に1人）
  function callBtn() { const b = $('#visitCall'); if (!curGuest) return; const here = room().g === curGuest.key; b.textContent = here ? '帰ってもらう' : '部屋に呼ぶ'; b.dataset.here = here ? '1' : ''; }
  $('#visitCall').onclick = () => { if (!curGuest) return; if ($('#visitCall').dataset.here) sendHome(curGuest.key); else callChara(curGuest.key); callBtn(); };
  $('#visitImg').onclick = () => curGuest && talk(curGuest);
  $('#visitIcons').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; const g = guests.find(x => x.key === b.dataset.key); if (g) talk(g); });
  $('#visitPlay').onclick = () => {
    const v = curGuest; if (!v) return;
    const lv = CHARA_LV[v.key] != null ? CHARA_LV[v.key] : Math.min(P.BOT_MAX, Math.max(0, Math.floor(((S.rating || 1050) - 1050) / 50)));
    P.confirmBox(`${v.name}と一局打ちますか？（Bot ${P.RANKS[lv]}・レート対局）`, () => { flush(); P.playChara(v.idx, lv); });
  };
  // 今日遊びに来たキャラ（一日一回、お知らせ）
  function todayVisitor() {
    const list = unlocked(); if (!list.length) return;
    const day = new Date().toDateString();
    if (S.visitDay && S.visitDay.day === day) return;
    const u = list[Math.floor(Math.random() * list.length)];
    S.visitDay = { day, key: u.v.key }; P.saveLocal();
    if (window.TICKER) window.TICKER.mine({ type: 'visit', chara: u.v.key, name: u.v.name });
  }

  /* ---------- 操作 ---------- */
  const svg = () => $('#roomSvg');
  function svgPoint(e) {
    const s = svg(), pt = s.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
    const q = pt.matrixTransform(s.getScreenCTM().inverse());
    const o = offOf(R.layout(allRooms()).pos[cur] || { x: 0, y: 0 });
    return [q.x - o[0], q.y - o[1]];   // いまの部屋の中の座標
  }
  function findItem(e) {
    const g = e.target.closest && e.target.closest('[data-uid]'); if (!g) return null;
    const uid = +g.dataset.uid, r = room();
    return r.items.find(i => i.uid === uid) || r.walls.find(i => i.uid === uid) || null;
  }
  /* ---------- ズーム（＋・－ボタン、2本指でつまむ、大きいときはドラッグで見る場所を動かす） ---------- */
  const ASP = R.W / R.H, zoom = { z: 1, cx: R.W / 2, cy: R.H / 2 }, ptrs = new Map();
  let pan = null, pinch = null;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function activeBox() { const o = offOf(R.layout(allRooms()).pos[cur] || { x: 0, y: 0 }), b = R.roomBox(N); return { x: b.x + o[0], y: b.y + o[1], w: b.w, h: b.h }; }
  function houseBox() {
    const list = allRooms(), L = R.layout(list); let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    list.forEach((rm, i) => { const o = offOf(L.pos[i]), b = R.roomBox(rm.n || R.N); x0 = Math.min(x0, b.x + o[0]); y0 = Math.min(y0, b.y + o[1]); x1 = Math.max(x1, b.x + o[0] + b.w); y1 = Math.max(y1, b.y + o[1] + b.h); });
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }
  const baseW = () => { const b = activeBox(); return Math.max(b.w, b.h * ASP); };
  const zMin = () => { const hb = houseBox(); return Math.min(1, baseW() / Math.max(hb.w, hb.h * ASP)); };
  // z：1 = いまの部屋がちょうど入る大きさ。1より小さいと家ぜんたいが見える。center=true なら、いまの部屋をまんなかに
  function setZoom(z, cx, cy, center) {
    if (center) { const ab = activeBox(); cx = ab.x + ab.w / 2; cy = ab.y + ab.h / 2; }
    const zm = zMin();
    zoom.z = clamp(z, zm, 3);
    const vw = baseW() / zoom.z, vh = vw / ASP, hb = houseBox();
    let x = (cx != null ? cx : zoom.cx) - vw / 2, y = (cy != null ? cy : zoom.cy) - vh / 2;
    x = vw >= hb.w ? hb.x + (hb.w - vw) / 2 : clamp(x, hb.x, hb.x + hb.w - vw);
    y = vh >= hb.h ? hb.y + (hb.h - vh) / 2 : clamp(y, hb.y, hb.y + hb.h - vh);
    zoom.cx = x + vw / 2; zoom.cy = y + vh / 2;
    svg().setAttribute('viewBox', `${x.toFixed(1)} ${y.toFixed(1)} ${vw.toFixed(1)} ${vh.toFixed(1)}`);
    $('#roomStage').classList.toggle('zoomed', Math.abs(zoom.z - 1) > .01);
    $('#rmZoomOut').disabled = zoom.z <= zm + .01; $('#rmZoomIn').disabled = zoom.z >= 2.99;
  }
  // なめらかに動かす（部屋をえらんだとき・家ぜんたい）
  let animT = 0;
  function animTo(z, cx, cy) {
    cancelAnimationFrame(animT);
    const z0 = zoom.z, x0 = zoom.cx, y0 = zoom.cy, t0 = performance.now(), dur = 380;
    const step = t => { const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3); setZoom(z0 + (z - z0) * e, x0 + (cx - x0) * e, y0 + (cy - y0) * e); if (k < 1) animT = requestAnimationFrame(step); };
    animT = requestAnimationFrame(step);
  }
  function focusRoom() { const ab = activeBox(); animTo(1, ab.x + ab.w / 2, ab.y + ab.h / 2); }
  function showAll() { const hb = houseBox(); animTo(zMin(), hb.x + hb.w / 2, hb.y + hb.h / 2); }
  const zoomedNow = () => Math.abs(zoom.z - 1) > .01;
  const unitsPerPx = () => (baseW() / zoom.z) / svg().getBoundingClientRect().width;
  function startPan(e) { pan = { x: e.clientX, y: e.clientY, cx: zoom.cx, cy: zoom.cy }; try { svg().setPointerCapture(e.pointerId); } catch (err) {} }
  $('#rmZoomIn').onclick = () => { setZoom(zoom.z * 1.5); P.sound('tap'); };
  $('#rmZoomOut').onclick = () => { setZoom(zoom.z / 1.5); P.sound('tap'); };

  function onDown(e) {
    if (e.isPrimary) { ptrs.clear(); pinch = null; }   // 1本目の指：前の指の記録が残っていたら消す（つまむズームと間違えないように）
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.size === 2) {   // 2本指：つまんでズーム
      if (drag) { Object.assign(drag.it, drag.orig); drag = null; render(); }
      const [a, b] = [...ptrs.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, z: zoom.z }; pan = null; return;
    }
    const chEl = e.target.closest && e.target.closest('.rm-chara');
    const onThing = findItem(e) || (e.target.closest && e.target.closest('.rm-owner')) || chEl;
    const otherRoom = e.target.closest && e.target.closest('[data-room]');
    if (zoomedNow() && (!onThing || otherRoom || (mode === 'view' && guest))) { if (editing() && sel) { sel = null; render(); } tapCand = mode === 'view' || otherRoom ? { x: e.clientX, y: e.clientY, room: otherRoom ? +otherRoom.dataset.room : null } : null; startPan(e); return; }
    if (otherRoom) { tapCand = { x: e.clientX, y: e.clientY, room: +otherRoom.dataset.room }; return; }
    const tr = mode === 'view' && findItem(e);
    if (mode === 'view' && !(tr && tr.trial)) {
      // 見るとき：指をはなしたときに「タップ」として動かす（横にスクロールしたときは動かさない）
      tapCand = { x: e.clientX, y: e.clientY, it: findItem(e), ch: chEl ? chEl.dataset.chara : null, room: null };
      return;
    }
    if (mode === 'view' && guest) return;   // ほかの人の部屋は見るだけ
    // 部屋に呼んだキャラも、もようがえで動かせる
    if (chEl && editing()) {
      const r = room(), sp = charaSpot(r, ownerSpot()); if (!sp) return;
      r.gp = { x: sp.x, y: sp.y };
      const [sx, sy] = svgPoint(e), g = R.toGrid(sx, sy);
      sel = null; drag = { av: true, gp: true, it: r.gp, off: [g.x - sp.x, g.y - sp.y], orig: { x: sp.x, y: sp.y }, ok: true };
      svg().setPointerCapture(e.pointerId); e.preventDefault(); render(); return;
    }
    // 自分のアバターも、もようがえで動かせる
    if (e.target.closest && e.target.closest('.rm-owner')) {
      const sp = ownerSpot(); if (!sp) return;
      const r = room(); r.av = { x: sp.x, y: sp.y };
      const [sx, sy] = svgPoint(e), g = R.toGrid(sx, sy);
      sel = null; drag = { av: true, it: r.av, off: [g.x - sp.x, g.y - sp.y], orig: { x: sp.x, y: sp.y }, ok: true };
      svg().setPointerCapture(e.pointerId); e.preventDefault(); render(); return;
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
    if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && ptrs.size >= 2) { const [a, b] = [...ptrs.values()]; setZoom(pinch.z * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d); return; }
    if (pan) { const k = unitsPerPx(); setZoom(zoom.z, pan.cx - (e.clientX - pan.x) * k, pan.cy - (e.clientY - pan.y) * k); return; }
    if (!drag) return;
    const [sx, sy] = svgPoint(e), it = drag.it;
    if (drag.av) {
      const g = R.toGrid(sx, sy);
      const x = Math.max(0, Math.min(N - 1, Math.round(g.x - drag.off[0]))), y = Math.max(0, Math.min(N - 1, Math.round(g.y - drag.off[1])));
      if (x !== it.x || y !== it.y) { it.x = x; it.y = y; drag.ok = avFree(x, y); render(); }
      return;
    }
    if (drag.wall) {
      const w = R.toWall(sx, sy), u = Math.round(w.u - drag.off);
      const cu = Math.max(0, Math.min(N - wallBox(it).w, u));
      if (cu !== it.u || w.side !== it.side) { it.side = w.side; it.u = cu; drag.ok = canPlaceWall(it, it.side, it.u); render(); }
    } else {
      const g = R.toGrid(sx, sy), f = R.footprint(it);
      const x = Math.max(0, Math.min(N - f.w, Math.round(g.x - drag.off[0]))), y = Math.max(0, Math.min(N - f.d, Math.round(g.y - drag.off[1])));
      if (x !== it.x || y !== it.y) { it.x = x; it.y = y; drag.ok = canPlace(it, x, y, it.rot); render(); }
    }
  }
  // タップしたとき（見るとき）：家具が動く・キャラとおしゃべり・碁盤で対局
  let tapCand = null;
  function onTap(t) {
    if (t.room != null) { pickRoom(t.room); return; }
    if (t.ch) { const v = guests.find(g => g.key === t.ch) || (guest ? { key: t.ch, idx: A.VARIANTS.findIndex(x => x.key === t.ch), name: (A.VARIANTS.find(x => x.key === t.ch) || {}).name } : null); if (v) { if (guest) { fx(null, t.ch); P.sound('tap'); } else { talk(v); fx(null, t.ch); } } return; }
    const it = t.it;
    if (sel && sel.trial && it !== sel) { sel = null; render(); }
    if (!it) return;
    const c = cat(it.k);
    if (!guest && (c.light || c.toggle)) { it.on = !it.on; touch(); P.sound('tap'); render(); fx(it); return; }
    if (!guest && it.k === 'goban') { P.confirmBox('対人戦で一局打ちますか？', () => { flush(); P.startMatch(); }); return; }
    P.sound('tap'); fx(it);
  }
  // 家具の動き：テレビ・明かりはつく／消える、掛け軸はおばけ、植物はゆれる、動物ははねる、ほかはぴょこっ
  const FX_SWAY = new Set(['plant', 'bonsai', 'matsu', 'bamboo', 'cactus', 'kadomatsu', 'xmastree', 'bangasa', 'hammock', 'kabin', 'rack']);
  const FX_JUMP = new Set(['maneki', 'zhaocai', 'cat', 'dog', 'penguin', 'panda', 'teddy', 'daruma', 'tanuki', 'kokeshi', 'robot', 'alien', 'ghost', 'snowman', 'kanfu', 'dino', 'shishi', 'dragon']);
  const FX_SPIN = new Set(['globe', 'mirrorball', 'ufo', 'clock', 'bigstone_b', 'bigstone_w', 'coins']);
  function fx(it, chKey) {
    const host = svg();
    const g = chKey ? host.querySelector(`.rm-chara[data-chara="${chKey}"]`) : host.querySelector(`[data-uid="${it.uid}"]`);
    if (!g) return;
    const kind = chKey ? 'jump' : it.k === 'kakejiku' ? 'ghost' : FX_SWAY.has(it.k) ? 'sway' : FX_JUMP.has(it.k) ? 'jump' : FX_SPIN.has(it.k) ? 'spin' : (cat(it.k).light || cat(it.k).toggle) ? 'flash' : 'bob';
    if (kind === 'ghost') {
      // 掛け軸のうしろから、おばけがのぞいて引っこむ
      const r = g.getBBox(), gh = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      const cx = r.x + r.width / 2, cy = r.y + r.height * .35;
      gh.setAttribute('class', 'rm-ghostpop'); gh.setAttribute('pointer-events', 'none');
      gh.innerHTML = `<g style="--gx:${(it.side === 'L' ? -1 : 1) * 16}px"><path d="M${cx - 9} ${cy + 10}v-10a9 9 0 0 1 18 0v10l-3-3-3 3-3-3-3 3-3-3z" fill="#f5f7ff" stroke="#9aa3c4" stroke-width=".8"/><circle cx="${cx - 3}" cy="${cy}" r="1.4" fill="#222"/><circle cx="${cx + 3}" cy="${cy}" r="1.4" fill="#222"/><ellipse cx="${cx}" cy="${cy + 4}" rx="1.6" ry="2" fill="#222"/></g>`;
      g.before(gh);
      setTimeout(() => gh.remove(), 1700);
      return;
    }
    g.classList.remove('fx-sway', 'fx-jump', 'fx-spin', 'fx-flash', 'fx-bob'); void g.getBBox(); g.classList.add('fx-' + kind);
    setTimeout(() => g.classList.remove('fx-' + kind), 1300);
  }
  function onUp(e) {
    if (e && e.type === 'pointerup' && tapCand && ptrs.size <= 1 && Math.hypot(e.clientX - tapCand.x, e.clientY - tapCand.y) < 10) { const t = tapCand; tapCand = null; pan = null; ptrs.delete(e.pointerId); onTap(t); return; }
    tapCand = null;
    if (e) ptrs.delete(e.pointerId);
    if (ptrs.size < 2) pinch = null;
    if (pan) { pan = null; return; }
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
  // 大きさ：1倍 → 1.5倍 → 2倍 → 1倍（置けないときは近くの空いている場所へ）
  function sizeSel() {
    if (!sel) return;
    const cur = R.sizeOf(sel), next = R.SIZES[(R.SIZES.indexOf(cur) + 1) % R.SIZES.length];
    const t = Object.assign({}, sel, { s: next });
    if (sel.side) {
      if (canPlaceWall(t, sel.side, sel.u)) sel.s = next;
      else { const sp = (() => { for (const side of ['R', 'L']) for (let u = 0; u < N; u++) if (canPlaceWall(t, side, u)) return { side, u }; return null; })(); if (!sp) { P.toast('その大きさにする場所がありません'); return; } Object.assign(sel, sp, { s: next }); }
    } else {
      if (canPlace(t, sel.x, sel.y, sel.rot)) sel.s = next;
      else { const sp = freeSpot(t); if (!sp) { P.toast('その大きさにする場所がありません'); return; } Object.assign(sel, sp, { s: next }); }
    }
    P.sound('tap'); touch(); render();
  }
  function storeSel() {
    if (!sel) return;
    if (sel.trial) { removeTrial(sel); return; }
    const r = room();
    if (sel.side) r.walls = r.walls.filter(w => w !== sel); else r.items = r.items.filter(i => i !== sel);
    sel = null; touch(); render(); if (tab === 'inv') renderPanel();
  }
  function placeFromInv(k) {
    const r = room(), c = cat(k);
    if (invOf(k) <= 0) return;
    const it = { uid: base().seq++, k, rot: 0 };
    if (c.kind === 'wall') { const sp = freeWallSpot(it); if (!sp) { P.toast('壁に空きがありません'); return; } Object.assign(it, sp); r.walls.push(it); }
    else { const sp = freeSpot(it); if (!sp) { P.toast('床に空きがありません'); return; } Object.assign(it, sp); r.items.push(it); }
    sel = it; touch(); if (mode !== 'edit') setMode('edit'); else { renderPanel(); render(); }
    P.toast('ドラッグして好きな場所へ');
  }

  /* ---------- 試し置き（ルームショップ）：買う前に部屋に置いてみる。買ったら「そのまま置く？」 ---------- */
  const trials = () => room().items.concat(room().walls).filter(i => i.trial);
  function addTrial(k) {
    const r = room(), c = cat(k), it = { uid: base().seq++, k, rot: 0, trial: true };
    if (c.kind === 'wall') { const sp = freeWallSpot(it); if (!sp) { P.toast('壁に空きがありません'); return; } Object.assign(it, sp); r.walls.push(it); }
    else { const sp = freeSpot(it); if (!sp) { P.toast('床に空きがありません'); return; } Object.assign(it, sp); r.items.push(it); }
    sel = it; P.sound('stone'); render(); renderPanel();
  }
  function removeTrial(it) {
    for (const r of allRooms()) { r.items = r.items.filter(i => i !== it); r.walls = r.walls.filter(i => i !== it); }
    if (sel === it) sel = null; render(); renderPanel();
  }
  // 全部の部屋の試し置きを消す
  function clearTrials() {
    for (const r of allRooms()) { r.items = r.items.filter(i => !i.trial); r.walls = r.walls.filter(i => !i.trial); }
    if (sel && sel.trial) sel = null;
  }
  // 買う（list：試し置きの家具）。買えたら「そのまま置きますか？」
  function buyTrials(list) {
    const total = list.reduce((a, it) => a + cat(it.k).price, 0);
    if ((S.zeni || 0) < total) { shima('poor'); P.toast('銭が足りません'); return; }
    const names = list.length === 1 ? cat(list[0].k).name : `試し置きの ${list.length} 点`;
    P.confirmBox(`${names}を、${list.length > 1 ? '合計 ' : ''}${total.toLocaleString()} 銭で買いますか？`, () => {
      const bought = [];
      const next = () => {
        const it = list[bought.length];
        if (!it) { done(); return; }
        P.buy({ item: it.k }, cat(it.k).price, res => { if (!res.ok) { P.toast(BUY_NG[res.reason] || '買えませんでした'); done(); return; } bought.push(it); next(); });
      };
      const done = () => {
        if (!bought.length) { render(); renderPanel(); return; }
        shima('buy');
        window.FANFARE.thanks({ who: 'shima',  items: bought.map(it => ({ thumb: thumb(it.k), name: cat(it.k).name })), then: () => P.confirmBox(`${bought.length === 1 ? cat(bought[0].k).name : bought.length + ' 点'}を買いました！ そのまま部屋に置きますか？`, () => {
          for (const it of bought) delete it.trial;
          touch(); flush(); P.toast(`静馬「${clerkLine}」`); render(); renderPanel();
        }, () => {
          for (const it of bought) { const r = room(); r.items = r.items.filter(i => i !== it); r.walls = r.walls.filter(i => i !== it); }
          sel = null; P.toast('買った家具は、倉庫に入れました'); render(); renderPanel();
        }, { yes: '置く', no: '倉庫へ' }) });
      };
      next();
    });
  }

  /* ---------- パネル（ショップ・倉庫・お客さん） ---------- */
  let tab = 'shop', shopKind = 'floor', shopStyle = 'all';
  // 家具ひとつを小さく描く（ショップ・倉庫の見本）
  function thumb(k) {
    const c = cat(k);
    if (c.img) return `<img class="rm-thumb rm-thumb-img" src="img/room/${(c.light || c.toggle) && R.hasOn(k) ? k + '_on' : k}.webp" alt="" loading="lazy">`;
    if (c.kind === 'wall') return `<svg viewBox="0 0 ${c.w} ${c.h}" class="rm-thumb wall">${c.wall({ on: !!c.light })}</svg>`;
    const it = { k, x: 0, y: 0, rot: 0, on: !!c.light };
    const f = R.footprint(it), hmax = 3.4;
    const a = R.proj(0, f.d, 0), b = R.proj(f.w, 0, 0), t = R.proj(0, 0, hmax), u = R.proj(f.w, f.d, 0);
    const x0 = a[0] - 4, x1 = b[0] + 4, y0 = t[1] - 4, y1 = u[1] + 4;
    return `<svg viewBox="${x0} ${y0} ${x1 - x0} ${y1 - y0}" class="rm-thumb">${R.DEFS}${R.drawFloorItem(it)}</svg>`;
  }
  /* ---------- 静馬（ルームショップの店主） ---------- */
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const SHIMA = {
    hello: ['……いらっしゃい。ゆっくり見ていけ。', '部屋は、打ち手の心をうつす。', '掘り出し物が入っている。'],
    pick: ['いい部屋になりそうだな。', '……センスがいい。', 'よく見つけたな。', 'そいつは代物だ。', '買ったアイテムは大きくできるぞ。', '置き場所まで考えてあるか？', '……悪くない。', '和・洋・中、混ぜるのもまた一興。'],
    buy: ['毎度。……大事に使え。', '買ったアイテムは大きくできるぞ。', 'いい買い物だ。'],
    poor: ['……銭が足りないな。一局打ってこい。']
  };
  let clerkLine = SHIMA.hello[0];
  function shima(kind) {
    const list = SHIMA[kind]; clerkLine = list[Math.floor(Math.random() * list.length)];
    const el = $('#rmClerk'); if (!el) return;
    el.querySelector('span').textContent = clerkLine; el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
  }
  const STYLE_NAME = { wa: '和', yo: '洋', chu: '中', fun: 'おもしろ' };
  const BUY_NG = { zeni: '銭が足りません', offline: 'サーバーにつながっていないので、今は買えません', have: 'もう持っています' };
  // 交流パネル（common/social.js）にわたす情報
  const ctx = () => ({
    mine: !guest, pid: guest ? guest.pid : meInfo.pid, name: guest ? guest.name : P.S.name, data: guest || mySoc || {}, me: meInfo,
    visit: pid => visit(pid, guestBack), home: goHome, read: (pid, did) => window.DIARY && window.DIARY.read(pid, did), write: () => window.DIARY && window.DIARY.write(), reload: () => loadSocial(guest ? guest.pid : null)
  });
  let dockTab = null;   // 下の帯で開いているもの（'chara' | 'social'）。もようがえ・ショップは mode で持つ
  function charaListHtml() {
    const mine = A.VARIANTS[P.charaIdx()].key;
    return `<p class="rm-help">5勝すると遊びに来ます（自分のキャラは通算5勝、ほかのキャラはそのキャラに5勝）。「部屋に呼ぶ」で、いまの部屋に1人ずつ置けます。</p><div class="rm-guests">` +
      A.VARIANTS.map((v, i) => {
        const n = v.key === mine ? (S.wins || 0) : (S.vs[v.key] || 0), open = P.charaOpen(i), ok = n >= 5 && open;
        const at = ok ? charaWhere(v.key) : -1, here = at === cur;
        const need = !open ? `${P.RANKS[P.UNLOCK[v.key] || 0]}になると会えます` : `あと ${5 - n} 勝${v.key === mine ? '（通算）' : ''}`;
        const btn = !ok ? '' : here ? `<button type="button" class="btn lac small" data-uncall="${v.key}">帰ってもらう</button>` : `<button type="button" class="btn primary small" data-call="${v.key}">${at >= 0 ? 'この部屋へ呼ぶ' : '部屋に呼ぶ'}</button>`;
        const where = here ? `部屋${cur + 1}にいます` : at >= 0 ? `部屋${at + 1}にいます` : '遊びに来ます';
        return `<div class="rm-guest ${ok ? 'ok' : ''}"><img src="${A.faceUri(i)}" alt=""><div><b>${v.name}</b><small>${ok ? where : need}</small></div>${btn}</div>`;
      }).join('') + '</div>';
  }
  // 交流：部屋番号・部屋をたずねる・最近の対局相手
  function socialHtml() {
    const pid = (meInfo && meInfo.pid) || S.pid || '';
    const seen = new Set(), opps = [];
    for (const h of S.history || []) { if (!h.opid || seen.has(h.opid) || h.opid === pid) continue; seen.add(h.opid); opps.push(h); if (opps.length >= 10) break; }
    return `<div class="rm-soc">
      <div class="rm-soc-card"><small>あなたの部屋番号</small><b class="rm-pid">${pid ? esc(pid) : '—'}</b><small>この番号を教えると、部屋に遊びに来てもらえます</small></div>
      <div class="rm-soc-card"><small>部屋をたずねる</small><div class="sc-line"><input type="text" inputmode="numeric" maxlength="6" placeholder="部屋番号（6けた）" id="rmVisitPid"><button type="button" class="btn primary small" data-visitgo="1">たずねる</button></div></div>
      <div class="rm-soc-card"><small>最近の対局相手</small>${opps.length ? `<ul class="rm-opps">${opps.map(h => `<li><button type="button" data-prof="${esc(h.opid)}"><b>${esc(h.op)}</b><span class="${h.win ? 'w' : h.draw ? 'd' : 'l'}">${h.win ? '勝ち' : h.draw ? '持碁' : '負け'}</span><small>${new Date(h.t).toLocaleDateString('ja-JP')}</small></button></li>`).join('')}</ul>` : '<p class="rm-help">対人戦をすると、ここに相手が出ます。タップで戦績を見て、フレンド申請できます。</p>'}</div>
    </div>`;
  }
  function renderPanel() {
    const p = $('#roomPanel');
    if (guest) {
      if (!P.online()) { p.innerHTML = '<p class="rm-help">サーバーにつながっているときに見られます。</p>'; return; }
      SO.render(tab, ctx(), p); uiSync(); return;
    }
    if (mode === 'shop') { renderShop(); uiSync(); return; }
    if (mode === 'edit') {
      const ks = invKeys();
      p.innerHTML = houseHtml() + `<div class="rm-edit-h"><b>倉庫</b><small>タップで部屋に置く・部屋の家具はドラッグで動かす</small><button type="button" class="btn primary small" data-dock="edit">もようがえを終わる</button></div>` +
        (ks.length ? `<div class="rm-grid-list">${ks.map(k => `<button type="button" class="rm-card" data-place="${k}">${thumb(k)}<b>${cat(k).name}</b><small>${invOf(k)}こ</small></button>`).join('')}</div>` : '<p class="rm-help">倉庫は空っぽです。ショップで家具を買いましょう。</p>');
    } else if (dockTab === 'chara') p.innerHTML = charaListHtml();
    else if (dockTab === 'social') {
      p.innerHTML = socialHtml() + '<div class="rm-soc-card"><small>一言コメント（部屋に来た人から）</small><div id="rmChatBox"></div></div>';
      if (P.online() && mySoc) SO.render('chat', ctx(), $('#rmChatBox')); else $('#rmChatBox').innerHTML = '<p class="rm-help">サーバーにつながっているときに見られます。</p>';
    }
    else p.innerHTML = '';
    uiSync();
  }

  /* ---------- ルームショップ：試し置き（家具・床・壁紙）。ショップの中では、置いてある家具も動かせる ---------- */
  // snaps[部屋番号]：ショップに入ったときの配置（ほかの部屋へ移ったら、その部屋のぶんも取る）。tryInts[部屋番号]：試している床・壁紙
  let snaps = {}, tryInts = {};
  const tryInt = () => tryInts[cur] = tryInts[cur] || { floor: null, wall: null };
  const copyRoom = r => ({ floor: r.floor, wall: r.wall, items: JSON.parse(JSON.stringify(r.items.filter(i => !i.trial))), walls: JSON.parse(JSON.stringify(r.walls.filter(i => !i.trial))), av: r.av && Object.assign({}, r.av), gp: r.gp && Object.assign({}, r.gp), key: layoutOf(r) });
  function snapRoom(i) { if (!snaps[i]) snaps[i] = copyRoom(allRooms()[i]); }
  const roomName = i => `部屋${i + 1}`;
  // カート：全部の部屋の試し置き＋床・壁紙（ri：どの部屋か）
  function cartList() {
    const out = [], rooms = allRooms(), multi = rooms.length > 1;
    rooms.forEach((r, ri) => {
      const pre = multi ? `[${roomName(ri)}] ` : '';
      for (const it of r.items.concat(r.walls)) if (it.trial) out.push({ kind: 'item', it, ri, name: pre + cat(it.k).name, price: cat(it.k).price });
      const t = tryInts[ri]; if (!t) return;
      if (t.floor) out.push({ kind: 'floor', id: t.floor, ri, name: pre + '床：' + R.FLOORS[t.floor].name, price: R.FLOORS[t.floor].price });
      if (t.wall) out.push({ kind: 'wall', id: t.wall, ri, name: pre + '壁紙：' + R.WALLS[t.wall].name, price: R.WALLS[t.wall].price });
    });
    // 同じ床・壁紙を、いくつかの部屋で試しているときは、1回買えばいい
    const seen = new Set();
    for (const c of out) if (c.kind !== 'item') { const k = c.kind + ':' + c.id; if (seen.has(k)) { c.dup = true; c.price = 0; } seen.add(k); }
    return out;
  }
  function renderShop() {
    const r = room(), cart = cartList(), total = cart.reduce((a, c) => a + c.price, 0), short = total > (S.zeni || 0);
    $('#rmClerk').querySelector('span').textContent = clerkLine;
    let g = '';
    if (shopKind === 'interior') {
      for (const [kind, table] of [['floors', R.FLOORS], ['walls', R.WALLS]]) for (const [id, it] of Object.entries(table)) {
        const own = base().owned[kind].includes(id), using = (kind === 'floors' ? r.floor : r.wall) === id;
        g += `<button type="button" class="rm-card rs-card${using ? ' on' : ''}" data-int="${kind}:${id}"><div class="rm-swatch ${kind === 'floors' ? 'f-' : 'w-'}${id}"></div><b>${it.name}</b><span class="rm-price">${own ? '持っている' : `${it.price.toLocaleString()} 銭`}</span></button>`;
      }
    } else {
      for (const c of R.CATALOG) {
        if (c.price <= 0) continue;
        if ((c.cloak ? 'cloak' : c.kind === 'wall' ? 'wall' : 'floor') !== shopKind) continue;
        const have = base().ownedItems[c.id] || 0, trying = trials().filter(it => it.k === c.id).length;
        g += `<button type="button" class="rm-card rs-card${trying ? ' on' : ''}" data-try="${c.id}">${thumb(c.id)}<b>${c.name}</b><span class="rm-price">${c.price.toLocaleString()} 銭</span>${have ? `<small class="rs-have">${have}こ持ってる</small>` : ''}</button>`;
      }
    }
    $('#rsGrid').innerHTML = (shopKind === 'cloak' ? '<p class="rm-help rs-note">部屋にクロークを1つ置くごとに、アバターの「お気に入りセット」が2つふえます。</p>' : '') + g;
    $('#rsCart').innerHTML = `<b class="rs-cart-h">選んでいる品</b>` + (cart.length
      ? `<ul>${cart.map((c, i) => `<li><span>${esc(c.name)}</span><em>${c.price.toLocaleString()} 銭</em><button type="button" class="sc-x" data-cx="${i}" aria-label="やめる">×</button></li>`).join('')}</ul>`
      : `<p class="rs-empty">商品をタップすると、部屋に試し置きできます${allRooms().length > 1 ? '。ほかの部屋をタップすると、その部屋の買い物もまとめてできます' : ''}</p>`) +
      `<div class="rs-total"><small>合計</small><b class="${short ? 'short' : ''}">${total.toLocaleString()} 銭</b></div><button type="button" class="btn primary rs-buy" data-buyall="1" ${!cart.length || short ? 'disabled' : ''}>購入</button>`;
    $('#rsNav').innerHTML = [['floor', '床の家具'], ['wall', '壁の家具'], ['cloak', 'クローク'], ['interior', '床・壁紙']].map(([k, n]) => `<button type="button" data-kind="${k}" aria-pressed="${shopKind === k}">${n}</button>`).join('');
  }
  const layoutOf = r => JSON.stringify({ f: r.floor, w: r.wall, i: r.items.filter(i => !i.trial).map(i => [i.uid, i.x, i.y, i.rot, i.s, i.on]), wl: r.walls.filter(i => !i.trial).map(i => [i.uid, i.side, i.u, i.s]), av: r.av, gp: r.gp });
  function enterShop(kind) {
    if (guest) return;
    if (mode === 'edit') { flush(); }
    clearTrials();
    snaps = {}; tryInts = {}; snapRoom(cur);
    if (kind) shopKind = kind;
    mode = 'shop'; dockTab = null; sel = null;
    shima('hello'); P.sound('stone');
    render(); renderPanel(); showVisit();
  }
  // 全部の部屋を、ショップに入ったときの配置にもどす
  function restoreSnap() {
    const rooms = allRooms();
    for (const [i, s] of Object.entries(snaps)) {
      const r = rooms[i]; if (!r) continue;
      Object.assign(r, { floor: s.floor, wall: s.wall, items: JSON.parse(JSON.stringify(s.items)), walls: JSON.parse(JSON.stringify(s.walls)) }); r.av = s.av; r.gp = s.gp;
      if (!r.av) delete r.av; if (!r.gp) delete r.gp;
    }
  }
  // ショップを出る：動かした配置を残すか聞く（試し置きで買っていないものは消える）
  function leaveShop(cb) {
    const rooms = allRooms();
    const end = () => { snaps = {}; tryInts = {}; mode = 'view'; sel = null; render(); renderPanel(); showVisit(); if (cb) cb(); };
    clearTrials();
    for (const [i, t] of Object.entries(tryInts)) { const r = rooms[i], s = snaps[i]; if (!r || !s) continue; if (t.floor) r.floor = s.floor; if (t.wall) r.wall = s.wall; }
    tryInts = {};
    if (Object.entries(snaps).some(([i, s]) => rooms[i] && layoutOf(rooms[i]) !== s.key)) {
      P.confirmBox('動かした配置を、そのまま残しますか？', () => { touch(); flush(); end(); }, () => { restoreSnap(); end(); }, { yes: '残す', no: 'もとに戻す' });
      return;
    }
    end();
  }
  function leaveMode(quiet) {
    if (mode === 'shop') { clearTrials(); restoreSnap(); snaps = {}; tryInts = {}; mode = 'view'; sel = null; return; }
    if (mode === 'edit') { flush(); mode = 'view'; sel = null; }
  }
  // まとめて買う → 「今の模様替えを反映する？」はい：そのまま／いいえ：配置を戻して、買った家具は倉庫へ
  function buyCart() {
    const cart = cartList(), total = cart.reduce((a, c) => a + c.price, 0);
    if (!cart.length) return;
    if ((S.zeni || 0) < total) { shima('poor'); P.toast('銭が足りません'); return; }
    P.confirmBox(`${cart.length === 1 ? cart[0].name : `${cart.length}点`}を、${cart.length > 1 ? '合計 ' : ''}${total.toLocaleString()} 銭で買いますか？`, () => {
      const got = [];
      const next = () => {
        const c = cart[got.length]; if (!c) { done(); return; }
        if (c.dup) { got.push(c); next(); return; }   // ほかの部屋で同じ床・壁紙を買った
        const what = c.kind === 'item' ? { item: c.it.k } : c.kind === 'floor' ? { floor: c.id } : { wall: c.id };
        P.buy(what, c.price, res => { if (!res.ok) { P.toast(BUY_NG[res.reason] || '買えませんでした'); done(); return; } got.push(c); next(); });
      };
      const done = () => {
        if (!got.length) { renderPanel(); return; }
        shima('buy');
        for (const c of got) { if (c.kind === 'item') delete c.it.trial; const t = tryInts[c.ri]; if (t && c.kind === 'floor') t.floor = null; if (t && c.kind === 'wall') t.wall = null; }
        window.FANFARE.thanks({ who: 'shima',  items: got.filter(c => !c.dup).map(c => ({ thumb: c.kind === 'item' ? thumb(c.it.k) : `<div class="rm-swatch ${c.kind === 'floor' ? 'f-' : 'w-'}${c.id}"></div>`, name: c.name })), then: () => P.confirmBox('買いました！ 今の模様替えを反映しますか？', () => {
          touch(); flush();
          const rooms = allRooms(); for (const i of Object.keys(snaps)) if (rooms[i]) snaps[i] = copyRoom(rooms[i]);
          P.toast(`静馬「${clerkLine}」`); render(); renderPanel();
        }, () => {
          const rooms = allRooms(), keep = rooms.map(r => r.items.concat(r.walls).filter(i => i.trial));
          restoreSnap();
          rooms.forEach((r, i) => { for (const t of keep[i]) (cat(t.k).kind === 'wall' ? r.walls : r.items).push(t); const ti = tryInts[i]; if (ti && ti.floor) r.floor = ti.floor; if (ti && ti.wall) r.wall = ti.wall; });
          sel = null; P.toast('配置をもとに戻しました。買った家具は倉庫にあります'); render(); renderPanel();
        }, { yes: 'はい', no: 'いいえ' }) });
      };
      next();
    });
  }
  $('#rsFace').onclick = () => shima('pick');
  $('#roomShop').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.kind) { shopKind = b.dataset.kind; P.sound('tap'); renderShop(); $('#rsGrid').scrollTop = 0; return; }
    if (b.dataset.try) { addTrial(b.dataset.try); shima('pick'); return; }
    if (b.dataset.int) {
      const [kind, id] = b.dataset.int.split(':'), r = room(), isF = kind === 'floors';
      if (isF) r.floor = id; else r.wall = id;
      const own = base().owned[kind].includes(id);
      if (isF) tryInt().floor = own ? null : id; else tryInt().wall = own ? null : id;
      shima('pick'); P.sound('tap'); render(); renderShop(); return;
    }
    if (b.dataset.cx != null) {
      const c = cartList()[+b.dataset.cx]; if (!c) return;
      if (c.kind === 'item') { removeTrial(c.it); return; }
      const r = allRooms()[c.ri], s = snaps[c.ri], t = tryInts[c.ri];
      if (c.kind === 'floor') { r.floor = s.floor; t.floor = null; } else { r.wall = s.wall; t.wall = null; }
      render(); renderShop(); return;
    }
    if (b.dataset.buyall) buyCart();
  });

  function onPanelClick(e) {
    if (guest) { SO.onClick(e, ctx()); return; }
    if (dockTab === 'social' && e.target.closest('#rmChatBox') && SO.onClick(e, ctx())) return;
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.house) { onHouse(b.dataset.house); return; }
    if (b.dataset.dock) { dock(b.dataset.dock); return; }
    if (b.dataset.place) { placeFromInv(b.dataset.place); return; }
    if (b.dataset.call) { callChara(b.dataset.call); return; }
    if (b.dataset.uncall) { sendHome(b.dataset.uncall); return; }
    if (b.dataset.prof) { if (window.PROFILE) window.PROFILE.open(b.dataset.prof); return; }
    if (b.dataset.visitgo) { const v = ($('#rmVisitPid').value || '').replace(/\D/g, ''); if (v.length !== 6) { P.toast('部屋番号は6けたです'); return; } visit(v); }
  }
  // 下の帯
  function dock(k) {
    if (guest) return;
    if (mode === 'shop') { P.sound('tap'); leaveShop(k === 'shop' ? null : () => dock(k)); return; }   // ショップ中に帯を押したら、ショップを出てから
    if (k === 'shop') { if (mode === 'edit') setMode('view'); enterShop(); return; }
    if (k === 'edit') { dockTab = null; setMode(mode === 'edit' ? 'view' : 'edit'); P.sound('tap'); return; }
    if (mode === 'edit') setMode('view');
    dockTab = dockTab === k ? null : k; P.sound('tap');
    if (dockTab === 'social') loadSocial(null);
    renderPanel(); showVisit();
  }
  $('#roomDock').addEventListener('click', e => { const b = e.target.closest('[data-dock]'); if (b) dock(b.dataset.dock); });
  function setMode(m) {
    if (m === 'edit') { clearTrials(); dockTab = null; }
    if (mode === 'edit' && m === 'view') flush();   // もようがえを終えたときだけ、部屋の配置をサーバーへ送る
    mode = m;
    if (m === 'view') { sel = null; if (!guest) placeVisitors(); }
    addMode = false;
    renderPanel();
    render();
    showVisit();
  }

  let roomFrom = null;   // 'shop'：ショップから来た（もどるでショップへ）
  // 置いているクロークの数（全部の部屋。試し置きは数えない）
  function cloaks() { if (!S.room) return 0; let n = 0; for (const r of [S.room].concat(S.room.extra || [])) for (const it of r.items || []) if (!it.trial && cat(it.k) && cat(it.k).cloak) n++; return n; }
  function open(startTab, back) {
    if (typeof startTab !== 'string') startTab = null;
    roomFrom = back || null;
    guest = null; viewKey = ''; snaps = {}; tryInts = {}; dockTab = null;
    room(); clearTrials();
    mode = 'view'; sel = null;
    P.showScreen('myroom');
    setMode('view');
    loadSocial(null);
    setZoom(1, null, null, true);
    if (startTab === 'shop') enterShop();
  }
  function openShop(kind, back) { open('shop', back); if (kind) { shopKind = kind; renderPanel(); } }
  // 交流の情報を読みこむ（自分の部屋なら「自分の情報」と「自分の部屋」、ほかの部屋ならその部屋）
  function loadSocial(pid) {
    if (!P.online()) return;
    if (!pid) {
      P.soc('me', {}, res => {
        if (!res.ok) return;
        meInfo = res; S.pid = res.pid;
        if (window.TICKER) window.TICKER.set(res.chat || [], res.notes || []);
        P.soc('visit', { pid: res.pid }, r2 => { if (r2.ok && !guest) { mySoc = r2; render(); renderPanel(); } });
      });
    } else {
      P.soc('visit', { pid }, res => {
        if (!res.ok) { P.toast(SO.why(res)); if (res.reason === 'blocked') goHome(); return; }
        if (res.mine) { goHome(); return; }
        guest = res; cur = 0; viewKey = ''; render(); renderPanel();
      });
    }
  }
  let guestBack = null;   // ほかの部屋から「もどる」で帰る先（フレンド・探訪など）
  function visit(pid, back) {
    pid = String(pid || '');
    guestBack = back || null;
    if (!pid) return;
    if (pid === String(meInfo.pid)) { goHome(); return; }
    if (mode !== 'view') leaveMode(true);
    flush();
    P.soc('visit', { pid }, res => {
      if (!res.ok) { P.toast(SO.why(res)); return; }
      if (res.mine) { goHome(); return; }
      guest = res; cur = 0; viewKey = ''; tab = 'diary'; sel = null; mode = 'view'; setZoom(1, null, null, true);
      if (window.TICKER) setTimeout(window.TICKER.draw, 0);
      P.showScreen('myroom'); showVisit();
      render(); renderPanel(); P.sound('stone');
    });
  }
  function goHome() { guest = null; cur = 0; viewKey = ''; setTimeout(showVisit, 0); if (window.TICKER) setTimeout(window.TICKER.draw, 0); dockTab = null; setMode('view'); renderPanel(); loadSocial(null); }
  // えらぶ画面に出す、小さな自分の部屋。miniOf はほかの人の部屋（フレンド・探訪）も、持ち主のアバターつきで描く
  function mini() { return miniOf(room(), null); }
  function miniOf(rm, look, chara) {
    rm = rm || DEF_ROOM();
    const n = rm.n || R.N, bx = R.roomBox(n);
    let s = R.DEFS + R.drawWalls(rm.wall || 'plain', n) + R.drawFloor(rm.floor || 'wood', n);
    for (const w of rm.walls || []) if (cat(w.k) && !w.trial) s += R.drawWallItem(w, {});
    const items = (rm.items || []).filter(it => cat(it.k) && !it.trial);
    const ents = items.map(it => Object.assign(rectOf(it), { it }));
    if (look) {
      const busy = new Set();
      for (const it of items) if (cat(it.k).kind !== 'flat') { const f = rectOf(it); for (let x = f.x; x < f.x + f.w; x++) for (let y = f.y; y < f.y + f.d; y++) busy.add(x + ',' + y); }
      const a = rm.av && !busy.has(rm.av.x + ',' + rm.av.y) ? rm.av : [[3, 9], [9, 3], [2, 8], [8, 2], [9, 9]].map(([x, y]) => ({ x, y })).find(p => !busy.has(p.x + ',' + p.y));
      if (a) ents.push({ x: a.x, y: a.y, w: 1, d: 1, look });
    }
    if (chara) { const sp = charaSpot(Object.assign({}, rm, { items }), null); if (sp) ents.push({ x: sp.x, y: sp.y, w: 1, d: 1, ch: chara }); }
    for (const e of drawOrder(ents)) {
      if (e.it) s += R.drawFloorItem(e.it);
      else if (e.ch) s += drawChara(e.ch, e.x, e.y, false);
      else { const [sx, sy] = R.proj(e.x + .5, e.y + .5, 0), w = 80, h = w * AV.H / AV.W; s += `<ellipse cx="${sx}" cy="${sy}" rx="14" ry="5" fill="rgba(0,0,0,.25)"/><svg x="${sx - w / 2}" y="${sy - h * .955}" width="${w}" height="${h}" viewBox="${AV.VB}">${AV.inner(e.look)}</svg>`; }
    }
    const vw = Math.max(bx.w, bx.h * R.W / R.H), vh = vw * R.H / R.W;
    return `<svg viewBox="${(bx.x + bx.w / 2 - vw / 2).toFixed(1)} ${(bx.y + bx.h / 2 - vh / 2).toFixed(1)} ${vw.toFixed(1)} ${vh.toFixed(1)}" aria-hidden="true">${s}</svg>`;
  }

  // つなぐ
  const s = svg();
  s.addEventListener('pointerdown', onDown);
  s.addEventListener('pointermove', onMove);
  s.addEventListener('pointerup', onUp);
  s.addEventListener('pointercancel', onUp);
  window.addEventListener('pointerup', e => { if (ptrs.has(e.pointerId) && e.target !== s && !s.contains(e.target)) { ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = null; } });
  $('#roomPanel').addEventListener('click', onPanelClick);
  $('#roomTabs').addEventListener('click', e => { const b = e.target.closest('button'); if (b && b.dataset.tab) { if (b.dataset.tab !== 'shop') { clearTrials(); render(); } tab = b.dataset.tab; renderPanel(); if (['diary', 'chat', 'social', 'owner'].includes(tab)) loadSocial(guest ? guest.pid : null); } });
  $('#rmRot').onclick = rotateSel;
  $('#rmSize').onclick = sizeSel;
  $('#rmStore').onclick = storeSel;
  $('#rmDone').onclick = () => { sel = null; render(); };
  $('#roomBack').onclick = () => {
    if (guest && guestBack) { const f = guestBack; guestBack = null; guest = null; f(); return; }
    if (guest) { goHome(); return; }
    if (mode !== 'view') leaveMode(true);
    clearTrials(); flush();
    if (roomFrom === 'shop' && window.SHOP) { roomFrom = null; window.SHOP.open(); return; }
    if (roomFrom === 'closet' && window.AVATAR_UI) { roomFrom = null; window.AVATAR_UI.open('closet'); return; }
    if (window.AVATAR_UI) window.AVATAR_UI.openHub(); else { P.renderHome(); P.showScreen('home'); }
  };
  document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
  $('#openRoom').onclick = open;
  s.setAttribute('viewBox', `0 0 ${R.W} ${R.H}`); s.style.aspectRatio = `${R.W} / ${R.H}`;
  s.addEventListener('wheel', e => { if (!e.ctrlKey && Math.abs(e.deltaY) < 1) return; e.preventDefault(); setZoom(zoom.z * (e.deltaY < 0 ? 1.15 : 1 / 1.15)); }, { passive: false });

  // サーバーから銭・持ち物・部屋が届いたとき（もようがえ中は配置を上書きしない）
  function refresh() {
    if ($('#myroom').hidden || guest) return;
    if (mode !== 'view') { $('#roomZeni').innerHTML = `${S.zeni.toLocaleString()} 銭<i class="chip-tama">勾玉 ${(S.tama | 0).toLocaleString()}</i>`; renderPanel(); return; }
    sel = null; render(); renderPanel();
  }

  // ほかの人の部屋から「対人戦の申込」：フレンドマッチの部屋をつくって、合言葉を相手のお知らせへ
  $('#rmInvite').onclick = () => {
    if (!guest) return;
    const to = { pid: guest.pid, name: guest.name };
    flush(); P.sound('stone');
    window.FRIEND.inviteTo(to);
  };
  window.ROOM = { open, openShop, cloaks, thumb, refresh, visit, mini, miniOf, todayVisitor, info: () => ({ guest: !!guest }) };
})();
