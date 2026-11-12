/* 共通：画面の一番上の一行（一言コメント＋お知らせ）
 *   ・自分の部屋に書かれた一言コメント
 *   ・お知らせ：キャラが遊びに来た／フレンドが日記を更新した／フレンドの段級位が上がった／対人戦の申込（部屋番号つき）
 *   ・自分のお知らせ：日記を書いた／段級位が上がった／対人戦を申し込んだ
 *   下線の言葉（日記・マイルーム・アバター・部屋番号など）をタップすると、その画面へ。
 *   表示：設定「一言コメント・お知らせの表示」… すべての画面 / マイルームだけ / 表示しない
 */
(function () {
  'use strict';
  const P = window.APP, S = P.S, A = P.A, AV = window.AVATAR;
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let chat = [], notes = [], screen = 'home', loaded = false;
  const link = (go, text) => `<u data-go="${esc(go)}">${esc(text)}</u>`;
  const myAv = () => S.av || AV.PRESETS.girl;

  function all() {
    const mine = (S.myNotes || []).map(n => Object.assign({ kind: 'note', mine: true }, n));
    return chat.map(c => Object.assign({ kind: 'chat' }, c)).concat(notes, mine).sort((a, b) => (b.t || 0) - (a.t || 0)).slice(0, 30);
  }
  function icon(it) {
    if (it.type === 'visit') { const i = A.VARIANTS.findIndex(v => v.key === it.chara); return `<img src="${A.faceUri(Math.max(0, i))}" alt="">`; }
    return AV.thumb(it.mine ? myAv() : (it.av || AV.PRESETS.girl), 'icon');
  }
  function html(it) {
    const who = it.pid ? link('room:' + it.pid, it.name) : esc(it.name);
    if (it.kind === 'chat') return `<b>${who}</b>${esc(it.text)}`;
    switch (it.type) {
      case 'visit': return `${esc(it.name)}が${link('room', 'マイルーム')}に遊びに来ました`;
      case 'diary': return `${who}が${link('diary:' + it.pid, '日記')}を更新しました`;
      case 'rank': return `${who}の段級位が${esc(it.rank)}に上がりました`;
      case 'invite': return `${who}から対人戦の申込みがあります。部屋番号は${link('join:' + it.code, it.code)}です`;
      case 'mydiary': return `あなたが${link('diary:me', '日記')}を更新しました`;
      case 'myrank': return `あなたの段級位が${link('record', it.rank)}に上がりました`;
      case 'myinvite': return `${esc(it.name)}さんに対人戦を申し込みました。部屋番号は${link('friend', it.code)}です`;
      case 'myavatar': return `あなたの${link('avatar', 'アバター')}を着がえました`;
    }
    return '';
  }

  function set(list, nlist) { chat = (list || []).slice(0, 20); if (nlist) notes = nlist.map(n => Object.assign({ kind: 'note' }, n)); loaded = true; draw(); }
  function push(it) {
    if (!it) return;
    if (it.kind === 'note') notes = [it].concat(notes.filter(x => x.id !== it.id)).slice(0, 30);
    else chat = [it].concat(chat.filter(x => x.id !== it.id)).slice(0, 20);
    draw(true);
  }
  // 自分のお知らせ（この端末に残す）
  function mine(n) {
    S.myNotes = [Object.assign({ t: Date.now() }, n)].concat(S.myNotes || []).slice(0, 20);
    P.saveLocal(); draw(true);
  }
  function shouldShow() {
    if (document.body.classList.contains('on-title')) return false;
    const mode = (S.settings && S.settings.tickerMode) || 'all';
    if (mode === 'off') return false;
    if (mode === 'all') return true;
    return screen === 'myroom' && !(window.ROOM && window.ROOM.info().guest);
  }
  function draw(fresh) {
    const el = $('#ticker'), show = shouldShow();
    el.hidden = !show;
    document.body.classList.toggle('has-ticker', show);
    if (!show) return;
    const it = all()[0];
    $('#tkAva').innerHTML = it ? icon(it) : '';
    $('#tkText').innerHTML = it ? html(it) : '<span class="tk-empty">一言コメント・お知らせはまだありません</span>';
    const run = $('#tkText');
    run.classList.remove('run'); void run.offsetWidth;
    if (run.scrollWidth > run.parentElement.clientWidth) run.classList.add('run');
    if (fresh) { el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }
    if (!$('#tkList').hidden) list();
  }
  function list() {
    const items = all();
    const hm = t => { const d = new Date(t); return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`; };
    $('#tkList').innerHTML = items.length ? items.map(it => `<div class="tk-item${it.kind === 'note' ? ' note' : ''}">${icon(it)}<span>${html(it)}</span><time>${hm(it.t)}</time></div>`).join('')
      : '<p class="tk-empty">まだありません。部屋に一言コメントが書かれたり、フレンドの日記が更新されたりすると、ここに流れます。</p>';
  }

  // 下線の言葉から、その画面へ
  function go(dest) {
    if (screen === 'game') { P.toast('対局が終わってから開けます'); return; }
    $('#tkList').hidden = true;
    const [k, v] = dest.split(':');
    const R = window.ROOM;
    if (k === 'room') { if (v && v !== String(S.pid)) R.visit(v); else R.open(); }
    else if (k === 'diary') { if (v && v !== 'me' && v !== String(S.pid)) R.visit(v); else R.open('diary'); }
    else if (k === 'avatar') window.AVATAR_UI.open();
    else if (k === 'record') $('#openRecord').click();
    else if (k === 'join') window.FRIEND.joinWith(v);
    else if (k === 'friend') { P.showScreen('friend'); window.FRIEND.open(); }
  }
  $('#ticker').addEventListener('click', e => {
    const u = e.target.closest('u[data-go]');
    if (u) { e.stopPropagation(); go(u.dataset.go); return; }
    if (e.target.closest('#tkLine')) { const l = $('#tkList'); l.hidden = !l.hidden; if (!l.hidden) list(); }
  });
  document.addEventListener('kuro9screen', e => { screen = e.detail; $('#tkList').hidden = true; draw(); });
  // つながったら一度だけ、最新を読みこむ
  setInterval(() => {
    if (!loaded && P.online() && shouldShow()) { loaded = true; P.soc('me', {}, r => { if (r.ok) set(r.chat, r.notes); else loaded = false; }); }
  }, 2000);
  window.TICKER = { set, push, draw, mine };
})();
