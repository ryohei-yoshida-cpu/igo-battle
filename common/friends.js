/* 共通：フレンド一覧と、みんなのルーム探訪（囲碁・将棋・オセロなど、どのゲームでも同じ）
 *   フレンド … 部屋・アバター・最近の日記の題・最近の一言。フレンドごとの一言欄から、すぐ一言を送れる（100人まで）
 *   探訪     … 公開の部屋で、最近もようがえした部屋からランダムに5部屋。部屋番号で探すこともできる
 */
(function () {
  'use strict';
  const P = window.APP, S = P.S;
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const md = t => { const d = new Date(t); return `${d.getMonth() + 1}/${d.getDate()}`; };
  const why = r => window.SOCIAL ? window.SOCIAL.why(r) : 'うまくいきませんでした';
  const MSG = { myfull: 'フレンドは100人までです', theirfull: '相手のフレンドがいっぱいです（100人まで）' };
  const offline = el => { el.innerHTML = '<p class="rm-help">サーバーにつながっているときに使えます。</p>'; };
  const mini = (room, av) => window.ROOM ? window.ROOM.miniOf(room, av) : '';

  /* ---------- フレンド ---------- */
  let page = 0, list = [], total = 0, freq = [];
  function friendCard(f) {
    return `<article class="frs-card" data-pid="${esc(f.pid)}">
      <button type="button" class="frs-room" data-visit="${esc(f.pid)}" aria-label="${esc(f.name)}さんの部屋へ">${mini(f.room, f.av || window.AVATAR.PRESETS.girl)}</button>
      <div class="frs-body">
        <div class="frs-top"><b>${esc(f.name)}</b><button type="button" class="btn lac small" data-visit="${esc(f.pid)}">部屋へ</button></div>
        ${f.hito ? `<p class="frs-hito">「${esc(f.hito)}」</p>` : ''}
        ${f.diary ? `<button type="button" class="frs-diary" data-dpid="${esc(f.pid)}" data-did="${f.diary.id}"><small>${md(f.diary.t)} の日記</small>${esc(f.diary.title)}</button>` : '<p class="frs-none">日記はまだありません</p>'}
      </div>
      <div class="frs-talk">
        ${f.from ? `<p class="frs-from"><b>${esc(f.name)}</b>${esc(f.from.text)}<time>${md(f.from.t)}</time></p>` : ''}
        ${f.to ? `<p class="frs-to"><b>自分</b>${esc(f.to.text)}<time>${md(f.to.t)}</time></p>` : ''}
        <div class="sc-line"><input type="text" maxlength="40" placeholder="${esc(f.name)}さんに一言（40字まで）" data-to="${esc(f.pid)}"><button type="button" class="btn primary small" data-send="${esc(f.pid)}">送る</button></div>
      </div></article>`;
  }
  function renderFriends() {
    let h = '';
    if (freq.length) h += `<div class="sc-sec hi"><b>フレンド申請が来ています</b><ul class="sc-people">${freq.map(f => `<li><button type="button" class="sc-name" data-visit="${esc(f.pid)}">${esc(f.name)}</button><button type="button" class="btn primary small" data-fa="${esc(f.pid)}">承認</button><button type="button" class="btn lac small" data-fd="${esc(f.pid)}">ことわる</button></li>`).join('')}</ul></div>`;
    h += list.length ? list.map(friendCard).join('') : '<p class="rm-help">まだフレンドがいません。ルーム探訪や、ほかの人の部屋の「この人」から、フレンド申請してみましょう。</p>';
    $('#frsList').innerHTML = h;
    $('#frsCount').textContent = `${total} / 100人`;
    $('#frsMore').hidden = list.length >= total;
  }
  function loadFriends(more) {
    if (!more) { page = 0; list = []; }
    P.soc('flist', { page }, res => {
      if (!res.ok) { $('#frsList').innerHTML = `<p class="rm-help">${why(res)}</p>`; return; }
      list = list.concat(res.list); total = res.total; renderFriends();
    });
  }
  function openFriends() {
    P.showScreen('friends');
    if (window.DIARY) window.DIARY.setBack(openFriends);
    if (!P.online()) { offline($('#frsList')); $('#frsCount').textContent = ''; return; }
    if (!list.length) $('#frsList').innerHTML = '<p class="rm-help">読みこみ中……</p>';
    P.soc('me', {}, res => { if (res.ok) { freq = res.freq || []; S.pid = res.pid; } loadFriends(false); });
  }
  $('#openFriends').onclick = () => { P.sound('stone'); openFriends(); };
  $('#frsBack').onclick = () => window.AVATAR_UI.openHub();
  $('#frsMore').onclick = () => { page++; loadFriends(true); };
  $('#frsList').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    const ds = b.dataset;
    if (ds.visit) { window.ROOM.visit(ds.visit, openFriends); return; }
    if (ds.did) { window.DIARY.read(ds.dpid, +ds.did); return; }
    if (ds.send) {
      const box = document.querySelector(`[data-to="${ds.send}"]`), text = box.value.trim();
      if (!text) { P.toast('何か書いてください'); return; }
      b.disabled = true;
      P.soc('chat', { pid: ds.send, text }, res => {
        b.disabled = false;
        if (!res.ok) { P.toast(why(res)); return; }
        P.sound('ok'); P.toast('一言を送りました'); box.value = '';
        const f = list.find(x => x.pid === ds.send); if (f) { f.to = { text, t: Date.now() }; renderFriends(); }
      });
      return;
    }
    if (ds.fa) { P.soc('faccept', { pid: ds.fa }, res => { if (!res.ok) { P.toast(MSG[res.reason] || why(res)); return; } P.toast('フレンドになりました'); openFriends(); }); return; }
    if (ds.fd) { P.soc('fdecline', { pid: ds.fd }, () => openFriends()); }
  });
  $('#frsList').addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.dataset.to) { const b = document.querySelector(`[data-send="${e.target.dataset.to}"]`); if (b) b.click(); } });

  /* ---------- みんなのルーム探訪 ---------- */
  function loadExplore() {
    $('#exList').innerHTML = '<p class="rm-help">部屋をさがしています……</p>';
    P.soc('explore', {}, res => {
      if (!res.ok) { $('#exList').innerHTML = `<p class="rm-help">${why(res)}</p>`; return; }
      $('#exList').innerHTML = res.rooms.length ? res.rooms.map(r => `<button type="button" class="ex-card" data-visit="${esc(r.pid)}">
        <span class="ex-room">${mini(r.room, r.av || window.AVATAR.PRESETS.girl)}</span>
        <span class="ex-t"><b>${esc(r.name)}さんの部屋</b><small>${md(r.t)} にもようがえ・訪問${r.visits || 0}人</small>${r.hito ? `<span>「${esc(r.hito)}」</span>` : ''}</span></button>`).join('')
        : '<p class="rm-help">まだ公開の部屋がありません。自分の部屋をもようがえして、最初の一部屋になりましょう。</p>';
    });
  }
  function openExplore() {
    P.showScreen('explore');
    if (window.DIARY) window.DIARY.setBack(openExplore);
    if (!P.online()) { offline($('#exList')); return; }
    loadExplore();
    P.soc('me', {}, res => { if (res.ok) $('#exPub').checked = res.rpub !== false; });
  }
  $('#openExplore').onclick = () => { P.sound('stone'); openExplore(); };
  $('#exBack').onclick = () => window.AVATAR_UI.openHub();
  $('#exMore').onclick = () => { P.sound('tap'); loadExplore(); };
  $('#exFind').onclick = () => { const box = $('#exFindBox'); box.hidden = !box.hidden; if (!box.hidden) $('#exPid').focus(); };
  const findGo = () => { const v = ($('#exPid').value || '').replace(/\D/g, ''); if (v.length !== 6) { P.toast('部屋番号は6けたです'); return; } window.ROOM.visit(v, openExplore); };
  $('#exGo').onclick = findGo;
  $('#exPid').addEventListener('keydown', e => { if (e.key === 'Enter') findGo(); });
  $('#exList').addEventListener('click', e => { const b = e.target.closest('[data-visit]'); if (b) window.ROOM.visit(b.dataset.visit, openExplore); });
  $('#exPub').onchange = e => P.soc('rpub', { v: e.target.checked }, res => { if (res.ok) P.toast(res.rpub ? '自分の部屋も、ルーム探訪に出します（もようがえしたときに出ます）' : '自分の部屋は、ルーム探訪に出しません'); });

  window.FRIENDS = { open: openFriends, explore: openExplore };
})();
