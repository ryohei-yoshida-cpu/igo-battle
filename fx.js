/* 囲碁BLITZ — 演出（ハンコの大演出）・プレゼントボックス・BGM
 *   FX.stamp({ stamp, title, sub, rewards[], chara, kind }) … 画面中央にハンコがとんできて押される
 *   GIFT.open() … プレゼントボックス（初回プレゼント・昇級のごほうび・ログインボーナス）
 *   BGM.start() / BGM.stop() … BGM（音楽：魔王魂）
 */
(function () {
  'use strict';
  const P = window.APP, A = P.A, S = P.S;
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ================= ハンコの大演出 ================= */
  let queue = [], busy = false;
  function stamp(o) { queue.push(o); if (!busy) next(); }
  function next() {
    const o = queue.shift(); if (!o) { busy = false; return; }
    busy = true;
    const el = $('#fxStamp');
    const ci = o.chara != null ? (typeof o.chara === 'number' ? o.chara : A.VARIANTS.findIndex(v => v.key === o.chara)) : -1;
    el.className = 'fx-stamp ' + (o.kind || '');
    el.innerHTML = `<div class="fx-rays"></div>
      ${ci >= 0 ? `<img class="fx-chara" src="${A.charaUri(ci)}" alt="">` : ''}
      <div class="fx-kicker">${esc(o.kicker || '')}</div>
      <div class="fx-seal"><span>${esc(o.stamp)}</span></div>
      <div class="fx-title">${esc(o.title || '')}</div>
      ${o.sub ? `<div class="fx-sub">${esc(o.sub)}</div>` : ''}
      ${(o.rewards || []).length ? `<ul class="fx-rewards">${o.rewards.map(r => `<li>${esc(r)}</li>`).join('')}</ul>` : ''}
      <div class="fx-tap">タップでとじる</div>`;
    el.hidden = false;
    void el.offsetWidth; el.classList.add('go');
    P.sound('taiko');
    // ハンコが押される瞬間に、紙ふぶきと画面のゆれ
    setTimeout(() => {
      document.body.classList.remove('fx-shake'); void document.body.offsetWidth; document.body.classList.add('fx-shake');
      const r = el.querySelector('.fx-seal').getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      for (let i = 0; i < 6; i++) setTimeout(() => A.burst(cx + (Math.random() - .5) * 220, cy + (Math.random() - .5) * 260, 'win'), i * 140);
      P.sound('ok');
    }, 620);
    let canClose = false; setTimeout(() => { canClose = true; }, 1100);
    el.onclick = () => { if (!canClose) return; el.hidden = true; el.onclick = null; if (o.done) o.done(); setTimeout(next, 150); };
  }

  /* ================= プレゼントボックス ================= */
  let gifts = [];
  const LOCAL = () => !P.online() && !P.FR.available();     // サーバーなしのお試し版
  function setGifts(list) {
    gifts = (list || []).slice();
    const n = gifts.length, b = $('#giftBadge');
    b.textContent = n > 9 ? '9+' : String(n); b.hidden = !n;
    $('#openGift').classList.toggle('has', !!n);
    if (!$('#giftBox').hidden) draw();
  }
  // この端末だけで数える版（サーバーにつながっていないとき）
  function localDaily() {
    S.gifts = S.gifts || [];
    const day = new Date().toLocaleDateString('sv-SE');
    if (S.loginDay !== day) { S.loginDay = day; S.gifts.push({ id: Date.now(), kind: 'daily', amount: 100, label: `ログインボーナス（${day.slice(5).replace('-', '/')}）`, t: Date.now() }); P.saveLocal(); }
    setGifts(S.gifts);
  }
  function add(kind, amount, label) {   // お試し版で、昇級のごほうびなどを入れる
    S.gifts = S.gifts || []; S.gifts.push({ id: Date.now() + Math.random(), kind, amount, label, t: Date.now() }); P.saveLocal(); setGifts(S.gifts);
  }
  function refresh() {
    if (P.online()) P.giftReq({ t: 'gifts' }, m => setGifts(m.gifts));
    else if (LOCAL()) localDaily();
  }
  const ICON = { welcome: '🎁', daily: '📅', rank: '🏮' };
  function draw() {
    const list = $('#giftList');
    list.innerHTML = gifts.length ? gifts.slice().reverse().map(g => `<li><span class="gf-ic">${ICON[g.kind] || '🎁'}</span><span class="gf-t"><b>${esc(g.label)}</b><small>${new Date(g.t).toLocaleDateString('ja-JP')}</small></span><span class="gf-z">${g.amount.toLocaleString()}銭</span><button type="button" class="btn primary small" data-id="${g.id}">受け取る</button></li>`).join('')
      : '<p class="gf-empty">いまはプレゼントがありません。<br>毎日ログインすると100銭、昇級すると1000銭が届きます。</p>';
    $('#giftAll').hidden = gifts.length < 2;
  }
  function take(id) {
    const done = got => {
      if (!got) return;
      P.sound('ok'); P.toast(`${got.toLocaleString()}銭を受け取りました！`);
      const r = $('#giftBox .gf-card').getBoundingClientRect(); A.burst(r.left + r.width / 2, r.top + 80, 'win');
      P.renderHome();
    };
    if (P.online()) { P.giftReq({ t: 'gifttake', id }, m => { setGifts(m.gifts); done(m.got); }); return; }
    if (!LOCAL()) { P.toast('サーバーにつながっていません'); return; }
    let got = 0; S.gifts = (S.gifts || []).filter(g => { if (id === 'all' || g.id === id) { got += g.amount; return false; } return true; });
    S.zeni = (S.zeni || 0) + got; P.saveLocal(); setGifts(S.gifts); done(got);
  }
  function open() { P.sound('stone'); $('#giftBox').hidden = false; draw(); refresh(); }
  $('#openGift').onclick = open;
  $('#giftClose').onclick = () => { $('#giftBox').hidden = true; };
  $('#giftBox').addEventListener('click', e => {
    if (e.target.id === 'giftBox') { $('#giftBox').hidden = true; return; }
    const b = e.target.closest('[data-id]'); if (b) { const v = b.dataset.id; take(LOCAL() ? +v : (v | 0)); }
  });
  $('#giftAll').onclick = () => take('all');
  P.setImg($('#giftChara'), A.charaUri(A.VARIANTS.findIndex(v => v.key === 'hinata')));

  /* ================= BGM =================
   * 曲：魔王魂「healing17」（音楽：魔王魂 https://maou.audio/ ・ 利用ルールにそってクレジットを表示）
   * 前後の無音を切って、終わりは自然に消えるようにしたものを audio/ に置いて、くり返し流す。
   * ファイルは一度読めばブラウザに残るので、通信は1人1回ぶんだけ。対局中は少し小さくする。 */
  const BGM = (() => {
    const SRC = 'audio/maoudamashii_bgm_healing17.mp3', VOL = .42, VOL_GAME = .2;
    let el = null, on = false, fade = 0, screen = 'home';
    const target = () => screen === 'game' || screen === 'lesson' ? VOL_GAME : VOL;
    function ramp(to, ms, done) {
      clearInterval(fade);
      const from = el.volume, t0 = performance.now();
      fade = setInterval(() => {
        const k = Math.min(1, (performance.now() - t0) / ms);
        el.volume = Math.max(0, Math.min(1, from + (to - from) * k));
        if (k >= 1) { clearInterval(fade); if (done) done(); }
      }, 50);
    }
    function start() {
      if (on || !S.settings.bgm) return;
      if (!el) { el = new Audio(SRC); el.loop = true; el.preload = 'auto'; el.volume = 0; }
      on = true;
      const p = el.play(); if (p && p.catch) p.catch(() => { on = false; });
      ramp(target(), 2000);
    }
    function stop() {
      if (!on) return; on = false;
      ramp(0, 700, () => { if (!on) el.pause(); });
    }
    document.addEventListener('kuro9screen', e => { screen = e.detail; if (on && el) ramp(target(), 800); });
    return { start, stop, get on() { return on; } };
  })();
  // 最初にタップしたときから流す（ブラウザは、さわる前に音を出せない）
  const kick = () => { if (S.settings.bgm) BGM.start(); };
  document.addEventListener('pointerdown', kick, { capture: true });
  document.addEventListener('visibilitychange', () => { if (document.hidden) BGM.stop(); else if (S.settings.bgm) setTimeout(kick, 300); });

  window.FX = { stamp };
  window.GIFT = { open, refresh, setGifts, add };
  window.BGM = BGM;
  setTimeout(refresh, 1500);
})();
