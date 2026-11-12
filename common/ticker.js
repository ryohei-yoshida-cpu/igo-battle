/* 共通：一言コメントの「流れる一行」
 *   自分の部屋に書かれた一言コメントの最新を、書いた人のアバターと一緒に画面の一番上に流す。
 *   タップすると履歴（最近20件）。名前をタップするとその人の部屋へ。
 *   マイルームでは いつも出す。設定「一言コメントを画面の一番上に出す」がオンなら、対局中も含めて全画面で出す。
 *   新しいコメントは、サーバーから op:'push' で届く。
 */
(function () {
  'use strict';
  const P = window.APP, S = P.S, AV = window.AVATAR;
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let items = [], screen = 'home', loaded = false;
  const face = look => AV.thumb(look || AV.PRESETS.girl, 'icon');

  function set(list) { items = (list || []).slice(0, 20); loaded = true; draw(); }
  function push(it) {
    if (!it) return;
    items = [it].concat(items.filter(x => x.id !== it.id)).slice(0, 20);
    draw(true);
  }
  function shouldShow() {
    if (document.body.classList.contains('on-title')) return false;
    if (S.settings && S.settings.ticker) return true;
    return screen === 'myroom' && !(window.ROOM && window.ROOM.info().guest);
  }
  function draw(fresh) {
    const el = $('#ticker'), show = shouldShow();
    el.hidden = !show;
    document.body.classList.toggle('has-ticker', show);
    if (!show) return;
    const it = items[0];
    $('#tkAva').innerHTML = it ? face(it.av) : '';
    $('#tkText').innerHTML = it ? `<b>${esc(it.name)}</b>${esc(it.text)}` : '<span class="tk-empty">一言コメントはまだありません</span>';
    // 長いときは右から左へ流す
    const run = $('#tkText');
    run.classList.remove('run'); void run.offsetWidth;
    if (run.scrollWidth > run.parentElement.clientWidth) run.classList.add('run');
    if (fresh) { el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }
    if (!$('#tkList').hidden) list();
  }
  function list() {
    $('#tkList').innerHTML = items.length ? items.map(it => `<button type="button" class="tk-item" data-pid="${esc(it.pid)}">${face(it.av)}<span><b>${esc(it.name)}</b>${esc(it.text)}</span><time>${new Date(it.t).getHours()}:${String(new Date(it.t).getMinutes()).padStart(2, '0')}</time></button>`).join('')
      : '<p class="tk-empty">まだありません。ほかの人があなたの部屋に一言コメントを書くと、ここに流れます。</p>';
  }
  $('#tkLine').onclick = () => { const l = $('#tkList'); l.hidden = !l.hidden; if (!l.hidden) list(); };
  $('#tkList').addEventListener('click', e => {
    const b = e.target.closest('.tk-item'); if (!b) return;
    $('#tkList').hidden = true;
    if (b.dataset.pid && b.dataset.pid !== String(S.pid) && window.ROOM) window.ROOM.visit(b.dataset.pid);
  });
  document.addEventListener('kuro9screen', e => { screen = e.detail; $('#tkList').hidden = true; draw(); });
  document.getElementById('optTicker').addEventListener('change', () => setTimeout(draw, 0));
  // つながったら一度だけ、最新を読みこむ
  setInterval(() => {
    if (!loaded && P.online() && shouldShow()) { loaded = true; P.soc('me', {}, r => { if (r.ok) set(r.chat); else loaded = false; }); }
  }, 2000);
  window.TICKER = { set, push, draw };
})();
