/* 九路 Blitz — 演出（ハンコの大演出）・プレゼントボックス・BGM
 *   FX.stamp({ stamp, title, sub, rewards[], chara, kind }) … 画面中央にハンコがとんできて押される
 *   GIFT.open() … プレゼントボックス（初回プレゼント・昇級のごほうび・ログインボーナス）
 *   BGM.start() / BGM.stop() … 和の雰囲気のBGM（三味線・琴・尺八ふうの音をその場で合成）
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

  /* ================= BGM（和の雰囲気） =================
   * 都節（みやこぶし）の音階で、三味線ふうのはじく音・琴のアルペジオ・尺八ふうの息の長い音・低いドローンを、
   * ゆっくりランダムに組み立てて流す。音源ファイルは使わない（通信量ゼロ）。 */
  const BGM = (() => {
    let ctx = null, master = null, timer = 0, on = false, nextT = 0, bar = 0;
    // 都節音階（D・E♭・G・A・B♭）
    const SCALE = [0, 1, 5, 7, 8];
    const note = (deg, oct) => 146.83 * Math.pow(2, (SCALE[((deg % 5) + 5) % 5] + 12 * (oct + Math.floor(deg / 5))) / 12);
    function ensure() {
      if (ctx) return true;
      try {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        master = ctx.createGain(); master.gain.value = 0;
        // うっすら残響（短いフィードバックディレイ）
        const dl = ctx.createDelay(1), fb = ctx.createGain(), wet = ctx.createGain();
        dl.delayTime.value = .32; fb.gain.value = .32; wet.gain.value = .35;
        master.connect(ctx.destination); master.connect(dl); dl.connect(fb).connect(dl); dl.connect(wet).connect(ctx.destination);
        return true;
      } catch (e) { return false; }
    }
    // 三味線：のこぎり波を急に減衰させ、ローパスで「ベン」という音に
    function shamisen(f, t, g) {
      const o = ctx.createOscillator(), lp = ctx.createBiquadFilter(), v = ctx.createGain();
      o.type = 'sawtooth'; o.frequency.setValueAtTime(f * 1.012, t); o.frequency.exponentialRampToValueAtTime(f, t + .05);
      lp.type = 'lowpass'; lp.frequency.setValueAtTime(3200, t); lp.frequency.exponentialRampToValueAtTime(500, t + .35); lp.Q.value = 6;
      v.gain.setValueAtTime(0.0001, t); v.gain.exponentialRampToValueAtTime(g, t + .004); v.gain.exponentialRampToValueAtTime(0.0001, t + .9);
      o.connect(lp).connect(v).connect(master); o.start(t); o.stop(t + 1);
    }
    // 琴：三角波＋倍音で、やわらかく長めに
    function koto(f, t, g) {
      for (const [m, k] of [[1, 1], [2, .35], [3, .12]]) {
        const o = ctx.createOscillator(), v = ctx.createGain();
        o.type = m === 1 ? 'triangle' : 'sine'; o.frequency.value = f * m;
        v.gain.setValueAtTime(0.0001, t); v.gain.exponentialRampToValueAtTime(g * k, t + .006); v.gain.exponentialRampToValueAtTime(0.0001, t + 2.2 / m);
        o.connect(v).connect(master); o.start(t); o.stop(t + 2.4);
      }
    }
    // 尺八ふう：ゆっくり立ち上がる息の音（サイン＋少しのノイズ）
    function shaku(f, t, len, g) {
      const o = ctx.createOscillator(), v = ctx.createGain(), vib = ctx.createOscillator(), vg = ctx.createGain();
      o.type = 'sine'; o.frequency.value = f; vib.frequency.value = 5; vg.gain.value = f * .006; vib.connect(vg).connect(o.frequency);
      v.gain.setValueAtTime(0.0001, t); v.gain.exponentialRampToValueAtTime(g, t + len * .35); v.gain.exponentialRampToValueAtTime(0.0001, t + len);
      o.connect(v).connect(master); o.start(t); vib.start(t); o.stop(t + len + .05); vib.stop(t + len + .05);
    }
    function drone(f, t, len) {
      const o = ctx.createOscillator(), v = ctx.createGain();
      o.type = 'sine'; o.frequency.value = f;
      v.gain.setValueAtTime(0.0001, t); v.gain.linearRampToValueAtTime(.05, t + 2); v.gain.linearRampToValueAtTime(0.0001, t + len);
      o.connect(v).connect(master); o.start(t); o.stop(t + len + .1);
    }
    const BEAT = .62;   // ゆったり（約97BPMの半分くらいの気分）
    // 1小節（8拍）ぶんを組み立てる
    function schedule() {
      if (!on) return;
      while (nextT < ctx.currentTime + 2) {
        const t = nextT, r = Math.random;
        if (bar % 4 === 0) drone(note(0, -1), t, BEAT * 32);
        // 三味線：まばらに、ときどき2つ続けて
        let d = Math.floor(r() * 5);
        for (let b = 0; b < 8; b++) {
          if (r() < (b % 2 ? .25 : .55)) { d += Math.round((r() - .5) * 3); d = Math.max(-2, Math.min(7, d)); shamisen(note(d, 0), t + b * BEAT, .08); if (r() < .25) shamisen(note(d + 1, 0), t + b * BEAT + BEAT * .5, .05); }
        }
        // 琴のアルペジオ（2小節に1回）
        if (bar % 2 === 1) { const s = Math.floor(r() * 3); for (let k = 0; k < 4; k++) koto(note(s + k, 1), t + BEAT * 4 + k * .16, .05); }
        // 尺八（4小節に1回、長い音）
        if (bar % 4 === 2) shaku(note(Math.floor(r() * 5), 1), t + BEAT, BEAT * 6, .035);
        nextT += BEAT * 8; bar++;
      }
    }
    function start() {
      if (on || !S.settings.bgm || !ensure()) return;
      on = true;
      if (ctx.state === 'suspended') ctx.resume();
      nextT = Math.max(nextT, ctx.currentTime + .1);
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
      master.gain.linearRampToValueAtTime(.5, ctx.currentTime + 2.5);
      schedule(); timer = setInterval(schedule, 500);
    }
    function stop() {
      if (!on) return; on = false; clearInterval(timer);
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
      master.gain.linearRampToValueAtTime(0, ctx.currentTime + .8);
    }
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
