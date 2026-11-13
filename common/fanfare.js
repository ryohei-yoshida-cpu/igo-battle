/* 囲碁BLITZ — お買い物の演出と、店員さんの吹き出し
 *   FANFARE.celebrate({ items:[{ thumb, name }], title, then })  … 買ったときの、はなやかな演出
 *   FANFARE.noteHalf(who, saved)   … 半額サービスがあったことを覚えておく（次の celebrate の前に店員さんが言う）
 *   FANFARE.clerk({ who, line, item, yes, no, labels, then })   … 店員さんの絵＋セリフ（yes があれば はい／いいえ）
 */
(function () {
  'use strict';
  const P = window.APP;
  const NAME = { hinata: 'ひなた', shima: '静馬', gensai: '玄斎' };
  const HALF_LINE = {
    hinata: 'いっつも来てくれるから、今日はナイショでサービスしちゃおっかなって。ふふふ、ありがとね♪',
    shima: '…礼だ。こいつは半額でいいぞ。その、なんだ…いつも買いに来てくれて、感謝している。'
  };
  let halves = [];
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ---- 紙ふぶき・金の粒・小判（キャンバス） ----
  function confetti(cv, ms) {
    const dpr = Math.min(2, window.devicePixelRatio || 1), W = window.innerWidth, H = window.innerHeight;
    cv.width = W * dpr; cv.height = H * dpr; const g = cv.getContext('2d'); g.scale(dpr, dpr);
    const cols = ['#e8c46e', '#f7b6c8', '#e0503e', '#ffffff', '#a6e08e', '#7fb8ff', '#ffd66b'];
    const ps = [];
    const add = (x, y, n, sp) => { for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, v = sp * (.4 + Math.random()); ps.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - sp * .6, r: 4 + Math.random() * 6, c: cols[i % cols.length], rot: Math.random() * 6, vr: (Math.random() - .5) * .4, coin: Math.random() < .18, life: 0 }); } };
    add(W / 2, H * .42, 120, 13);
    add(W * .1, H, 40, 16); add(W * .9, H, 40, 16);
    let raf, t0 = performance.now(), last = t0;
    const step = now => {
      const dt = Math.min(2, (now - last) / 16.7); last = now;
      g.clearRect(0, 0, W, H);
      if (now - t0 < ms * .6 && Math.random() < .5) ps.push({ x: Math.random() * W, y: -10, vx: 0, vy: 2, r: 4 + Math.random() * 5, c: cols[Math.random() * cols.length | 0], rot: 0, vr: .2, coin: Math.random() < .12, life: 0 });
      for (const p of ps) {
        p.vy += .28 * dt; p.vx *= .985; p.vy = Math.min(p.vy, 5 + p.r * .3);
        p.x += p.vx * dt + Math.sin((now + p.r * 300) / 300) * .6; p.y += p.vy * dt; p.rot += p.vr * dt;
        g.save(); g.translate(p.x, p.y); g.rotate(p.rot);
        if (p.coin) {
          g.scale(Math.abs(Math.cos(p.rot * 2)) + .15, 1);
          g.fillStyle = '#e8b830'; g.beginPath(); g.ellipse(0, 0, p.r * 1.3, p.r * 1.7, 0, 0, 7); g.fill();
          g.strokeStyle = '#fff3b8'; g.lineWidth = 1.2; g.stroke();
        } else { g.fillStyle = p.c; g.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2); }
        g.restore();
      }
      for (let i = ps.length - 1; i >= 0; i--) if (ps[i].y > H + 30) ps.splice(i, 1);
      if (now - t0 < ms + 1500 && ps.length) raf = requestAnimationFrame(step); else g.clearRect(0, 0, W, H);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }

  function layer(cls) {
    const el = document.createElement('div'); el.className = 'ff ' + cls;
    document.body.append(el); return el;
  }

  // 買ったときの演出。タップか 3 秒で閉じて then()
  function celebrate(o) {
    o = o || {};
    if (halves.length) { const h = halves.shift(); clerk({ who: h.who, line: HALF_LINE[h.who], tag: `半額サービス！ ${h.saved.toLocaleString()} 銭 おトク`, then: () => celebrate(o) }); return; }
    const items = (o.items || []).slice(0, 6), more = (o.items || []).length - items.length;
    const el = layer('ff-buy');
    el.innerHTML = `<canvas class="ff-cv"></canvas><div class="ff-rays"></div>
      <div class="ff-card">
        <div class="ff-ribbon">お買い上げ</div>
        <div class="ff-title">${esc(o.title || 'ありがとうございます！')}</div>
        <div class="ff-items">${items.map((it, i) => `<figure style="--i:${i}"><div class="ff-thumb">${it.thumb || ''}</div><figcaption>${esc(it.name || '')}</figcaption></figure>`).join('')}${more > 0 ? `<span class="ff-more">ほか ${more} 点</span>` : ''}</div>
        <div class="ff-tap">タップで閉じる</div>
      </div>`;
    const stop = confetti(el.querySelector('canvas'), 2200);
    if (P) { P.sound('fanfare'); setTimeout(() => P.sound('coin'), 420); setTimeout(() => P.sound('coin'), 620); }
    if (navigator.vibrate) try { navigator.vibrate([30, 40, 60]); } catch (e) {}
    requestAnimationFrame(() => el.classList.add('on'));
    let done = false;
    const close = () => { if (done) return; done = true; el.classList.remove('on'); el.classList.add('off'); setTimeout(() => { stop(); el.remove(); if (o.then) o.then(); }, 320); };
    setTimeout(() => el.addEventListener('click', close), 350);
    setTimeout(close, 3200);
  }

  // 店員さん（ソロモードと同じ絵）のセリフ。yes があれば はい／いいえ を出す
  function clerk(o) {
    const el = layer('ff-clerk');
    const yn = !!o.yes;
    el.innerHTML = `<div class="ff-shade"></div>
      <div class="ff-cl">
        <img class="ff-bust" src="img/bust_${o.who}.webp" alt="">
        <div class="ff-say">
          ${o.tag ? `<div class="ff-tag">${esc(o.tag)}</div>` : ''}
          <b class="ff-who">${esc(o.name || NAME[o.who] || '')}</b>
          <p class="ff-line"></p>
          ${o.item ? `<div class="ff-gift"><div class="ff-thumb">${o.item.thumb || ''}</div><span>${esc(o.item.name || '')}</span></div>` : ''}
          <div class="ff-btns">${yn ? `<button type="button" class="primary" data-a="yes">${esc((o.labels && o.labels.yes) || 'はい')}</button><button type="button" class="ghost" data-a="no">${esc((o.labels && o.labels.no) || 'いいえ')}</button>` : '<button type="button" class="primary" data-a="ok">うれしい！</button>'}</div>
        </div>
      </div>`;
    // 1文字ずつ
    const line = el.querySelector('.ff-line'), txt = String(o.line || ''); let i = 0;
    const tick = setInterval(() => { i += 1; line.textContent = txt.slice(0, i); if (i >= txt.length) clearInterval(tick); }, 28);
    if (P) P.sound(o.tag ? 'coin' : 'tap');
    requestAnimationFrame(() => el.classList.add('on'));
    el.addEventListener('click', e => {
      const b = e.target.closest('button[data-a]');
      if (!b) { if (i < txt.length) { i = txt.length; line.textContent = txt; } return; }
      clearInterval(tick); el.classList.remove('on'); setTimeout(() => el.remove(), 250);
      const a = b.dataset.a;
      if (a === 'yes' && o.yes) o.yes(); else if (a === 'no' && o.no) o.no();
      if (o.then) o.then();
    });
  }

  window.FANFARE = { celebrate, clerk, noteHalf(who, saved) { halves.push({ who, saved }); }, HALF_LINE };
})();
