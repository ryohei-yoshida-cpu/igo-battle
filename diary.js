/* 囲碁BLITZ — 囲碁日記
 *   ・日記を書く：日記帳がひらく演出 → 題（30字）と本文（300字）、棋譜をひとつ添えられる。1日1回
 *   ・みんなの日記：公開の日記からランダムに5つ
 *   ・読む：日記帳で1つずつ。棋譜は小さな碁盤で1手ずつ見られて、「検討で開く」で検討の画面へ
 *   サーバーとのやりとりは APP.soc（diary / dlist / dget / dpub / drandom / comment / del）
 */
(function () {
  'use strict';
  const P = window.APP, S = P.S, AV = window.AVATAR;
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ymd = t => { const d = new Date(t); return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`; };
  const md = t => { const d = new Date(t); return `${d.getMonth() + 1}/${d.getDate()}`; };
  const PUB = [['all', 'みんなに公開'], ['friends', 'フレンドだけ'], ['me', '自分だけ']];
  const PUBS = { all: 'みんな', friends: 'フレンド', me: '自分だけ' };
  const RES = { win: '勝ち', loss: '負け', draw: '引き分け' };
  const WHY = {
    today: '日記は1日1回です。また明日書いてね', notitle: '題を書いてください', empty: '本文を書いてください', long: '文字数が多すぎます',
    sexual: '性的な言葉が入っているので、書けません', violent: '暴力的な言葉が入っているので、書けません', abuse: '人を傷つける言葉が入っているので、書けません',
    contact: 'URL・メールアドレス・電話番号などは書けません', gone: 'その日記は見られません', blocked: 'この人の日記は見られません', offline: 'サーバーにつながっていません'
  };
  const why = r => WHY[r && r.reason] || (window.SOCIAL ? window.SOCIAL.why(r) : 'うまくいきませんでした');
  const NOTICE = '人を傷つける言葉・性的な表現・個人が特定できる情報は書けません。ルールを守らない使い方をした場合、アカウントを停止することがあります。';

  let mine = { diary: [], wrote: false, pid: null }, cur = null, kifu = null, pub = 'all', back = null, screen = 'home';
  document.addEventListener('kuro9screen', e => { screen = e.detail; });

  /* ---------- 小さな碁盤（棋譜を1手ずつ） ---------- */
  function replay(size, rec, n) {
    const E = window.GoEngines[size];
    let b = new Array(size * size).fill(0), ko = -1, c = 1, last = -1;
    for (let i = 0; i < n; i++) {
      const p = rec[i];
      if (p >= 0) { const r = E.play(b, p, c, ko); if (!r) break; b = r.board; ko = r.ko; last = p; } else { ko = -1; last = -1; }
      c = 3 - c;
    }
    return { b, last };
  }
  function boardSvg(size, rec, n) {
    const c = 10, pad = 7, w = pad * 2 + c * (size - 1), st = replay(size, rec, n);
    const stars = size === 13 ? [42, 48, 84, 120, 126] : [20, 24, 40, 56, 60];
    const xy = p => [pad + (p % size) * c, pad + ((p / size) | 0) * c];
    let s = `<svg viewBox="0 0 ${w} ${w}" class="dy-board" aria-label="棋譜"><rect width="${w}" height="${w}" rx="3" class="mb-bg"/>`;
    for (let i = 0; i < size; i++) s += `<path class="mb-l" d="M${pad} ${pad + i * c}H${pad + c * (size - 1)}M${pad + i * c} ${pad}V${pad + c * (size - 1)}"/>`;
    for (const p of stars) { const [x, y] = xy(p); s += `<circle class="mb-star" cx="${x}" cy="${y}" r="1.2"/>`; }
    st.b.forEach((v, p) => { if (!v) return; const [x, y] = xy(p); s += `<circle cx="${x}" cy="${y}" r="4.5" class="${v === 1 ? 'dy-b' : 'dy-w'}"/>`; });
    if (st.last >= 0) { const [x, y] = xy(st.last); s += `<circle cx="${x}" cy="${y}" r="1.8" fill="none" stroke="${st.b[st.last] === 1 ? '#fff3dc' : '#e0503e'}" stroke-width=".9"/>`; }
    return s + '</svg>';
  }
  function kifuBlock(k, id) {
    const n = k.rec.length;
    return `<div class="dy-kifu" data-kid="${id}" data-n="${n}"><div class="dy-kb">${boardSvg(k.size, k.rec, n)}</div>
      <div class="dy-kinfo"><b>${k.size}路・${esc(k.op || '相手')}戦${k.res ? '・' + RES[k.res] : ''}</b><small class="dy-kn">${n}手目 / ${n}</small>
      <div class="dy-kbtn"><button type="button" data-step="first">|◀</button><button type="button" data-step="-1">◀</button><button type="button" data-step="1">▶</button><button type="button" data-step="last">▶|</button></div>
      <button type="button" class="btn lac small" data-review="${id}">検討で開く</button></div></div>`;
  }
  // 棋譜の◀▶（読む画面・書く画面のどちらでも）
  function stepKifu(btn, k) {
    const box = btn.closest('.dy-kifu'), max = k.rec.length;
    let n = +box.dataset.n; const v = btn.dataset.step;
    n = v === 'first' ? 0 : v === 'last' ? max : Math.max(0, Math.min(max, n + +v));
    box.dataset.n = n;
    box.querySelector('.dy-kb').innerHTML = boardSvg(k.size, k.rec, n);
    box.querySelector('.dy-kn').textContent = `${n}手目 / ${max}`;
    P.sound('tap');
  }
  function openReview(k) {
    const from = screen;
    closeBook(true);
    P.setReviewBack(() => { P.showScreen(from === 'game' ? 'home' : from); if (cur && cur.entry) reopen(); });
    P.openReview(k.rec, k.size);
  }

  /* ---------- 日記帳（ひらく・とじる） ---------- */
  function openBook(html) {
    const ov = $('#book'), el = $('#bookEl');
    $('#bookPage').innerHTML = html;
    ov.hidden = false; el.classList.remove('open', 'closing'); void el.offsetWidth;
    setTimeout(() => el.classList.add('open'), 500);   // 閉じた表紙を少し見せてから、ひらく
    P.sound('stone');
  }
  function turnPage(html) {
    const pg = $('#bookPage'); pg.classList.remove('turn'); void pg.offsetWidth; pg.innerHTML = html; pg.classList.add('turn'); P.sound('tap');
  }
  function closeBook(now) {
    const ov = $('#book'), el = $('#bookEl');
    if (now) { ov.hidden = true; return; }
    el.classList.add('closing'); el.classList.remove('open');
    setTimeout(() => { ov.hidden = true; el.classList.remove('closing'); }, 1040);
  }
  $('#book').addEventListener('click', e => { if (e.target.id === 'book') closeBook(); });

  /* ---------- 書く ---------- */
  // ed：直すときの日記（なければ新しく書く）
  function writePage(ed) {
    const today = ymd(ed ? ed.t : Date.now());
    return `<div class="bk-in"><div class="bk-date">${today}${ed ? '<span class="bk-pubtag">なおす</span>' : ''}</div>
      <label class="bk-lab">題<input type="text" id="bkTitle" maxlength="30" placeholder="今日の一局（30字まで）" value="${ed ? esc(ed.title) : ''}"></label>
      <label class="bk-lab">本文<textarea id="bkText" maxlength="300" rows="7" placeholder="今日の対局のこと、うれしかった一手、くやしかった一手……">${ed ? esc(ed.text) : ''}</textarea></label>
      <div class="bk-count"><span id="bkCount">${ed ? ed.text.length : 0}</span> / 300</div>
      <div class="bk-kifu" id="bkKifu">${kifu ? kifuBlock(kifu, 'w') + '<button type="button" class="sc-x" data-unkifu="1">棋譜を外す</button>' : '<button type="button" class="btn lac small" data-pick="1">棋譜をえらぶ（戦歴から）</button>'}</div>
      ${ed ? '' : `<div class="rm-seg bk-pub">${PUB.map(([k, n]) => `<button type="button" data-pub="${k}" aria-pressed="${pub === k}">${n}</button>`).join('')}</div>`}
      <p class="bk-note">${NOTICE}</p>
      <div class="bk-btns"><button type="button" class="btn lac" data-close="1">とじる</button><button type="button" class="btn primary" data-save="1">${ed ? '直して保存' : '日記をつける'}</button></div></div>`;
  }
  function write() {
    if (!P.online()) { P.toast('日記は、サーバーにつながっているときに書けます'); return; }
    P.soc('dlist', {}, res => {
      if (!res.ok) { P.toast(why(res)); return; }
      mine = res;
      if (res.wrote) {
        P.toast('今日の日記はもう書きました。また明日！');
        if (res.diary[0]) read(res.pid, res.diary[0].id);
        return;
      }
      kifu = null; pub = 'all'; cur = { write: true };
      openBook(writePage());
      setTimeout(() => { const t = $('#bkTitle'); if (t) t.focus({ preventScroll: true }); }, 2400);
    });
  }
  function save(btn) {
    const title = $('#bkTitle').value.trim(), text = $('#bkText').value.trim();
    if (!title) { P.toast(WHY.notitle); return; }
    if (!text) { P.toast(WHY.empty); return; }
    btn.disabled = true;
    if (cur && cur.edit) {   // 書いた日記を直す
      const did = cur.edit.id;
      P.soc('dedit', { did, title, text, kifu }, res => {
        btn.disabled = false;
        if (!res.ok) { P.toast(why(res)); return; }
        P.sound('ok'); P.toast('日記を直しました');
        mine.diary = res.diary;
        cur = { pid: mine.pid || S.pid, entry: res.entry, mine: true, name: S.name, canWrite: true };
        turnPage(readPage());
        if (!$('#diaryHub').hidden) renderMine();
      });
      return;
    }
    P.soc('diary', { title, text, pub, kifu }, res => {
      btn.disabled = false;
      if (!res.ok) { P.toast(why(res)); return; }
      P.sound('ok'); P.toast('日記をつけました');
      if (window.TICKER) window.TICKER.mine({ type: 'mydiary' });
      mine.diary = res.diary; mine.wrote = true;
      cur = { pid: mine.pid || S.pid, entry: res.entry, mine: true, name: S.name, canWrite: true };
      turnPage(readPage());
      if (!$('#diaryHub').hidden) renderMine();
    });
  }

  /* ---------- 棋譜をえらぶ ---------- */
  function pickKifu() {
    const list = (S.history || []).filter(h => h.rec && h.rec.length);
    $('#kpList').innerHTML = list.length ? list.map((h, i) => `<li><button type="button" data-k="${i}"><b>${md(h.t)}</b><span>${h.size || 9}路・${esc(h.op)}</span><em class="${h.win ? 'w' : h.draw ? '' : 'l'}">${h.win ? '勝ち' : h.draw ? '引き分け' : '負け'}</em><small>${h.rec.length}手</small></button></li>`).join('')
      : '<li class="rm-help">棋譜のある対局がまだありません。対局すると、ここに出ます。</li>';
    $('#kifuPick').hidden = false;
    $('#kpList').onclick = e => {
      const b = e.target.closest('[data-k]'); if (!b) return;
      const h = list[+b.dataset.k];
      kifu = { size: h.size || 9, rec: h.rec.slice(0, 400), op: h.op, res: h.win ? 'win' : h.draw ? 'draw' : 'loss', color: h.color };
      $('#kifuPick').hidden = true; P.sound('ok');
      $('#bkKifu').innerHTML = kifuBlock(kifu, 'w') + '<button type="button" class="sc-x" data-unkifu="1">棋譜を外す</button>';
    };
  }
  $('#kpClose').onclick = () => { $('#kifuPick').hidden = true; };

  /* ---------- 読む ---------- */
  function readPage() {
    const e = cur.entry, c = e.c || [];
    let h = `<div class="bk-in read"><div class="bk-date">${ymd(e.t)}${cur.mine ? `<span class="bk-pubtag">${PUBS[e.pub] || ''}</span>` : ''}</div>
      <h3 class="bk-title">${esc(e.title)}</h3>
      <button type="button" class="bk-who" data-visit="${esc(cur.pid)}">${cur.av ? `<span class="bk-av">${AV.svg(cur.av)}</span>` : ''}${esc(cur.name)}${cur.mine ? '' : 'さんの日記'}</button>
      <p class="bk-text">${esc(e.text)}</p>`;
    if (e.kifu) h += kifuBlock(e.kifu, 'r');
    h += `<div class="bk-cm"><b>コメント（${c.length}）</b><ul>${c.map(x => `<li><button type="button" class="sc-name" data-visit="${esc(x.pid)}">${esc(x.name)}</button><span>${esc(x.text)}</span>${cur.mine || x.pid === S.pid ? `<button type="button" class="sc-x" data-delc="${x.id}">消す</button>` : ''}${x.pid !== S.pid ? `<button type="button" class="sc-x" data-repc="${x.id}" data-rpid="${esc(x.pid)}">通報</button>` : ''}</li>`).join('')}</ul>`;
    if (cur.canWrite) h += `<div class="sc-line"><input type="text" id="bkCm" maxlength="60" placeholder="コメント（60字まで）"><button type="button" class="btn lac small" data-cm="1">送る</button></div>`;
    h += '</div>';
    if (cur.mine) h += `<div class="rm-seg bk-pub">${PUB.map(([k, n]) => `<button type="button" data-repub="${k}" aria-pressed="${e.pub === k}">${n}</button>`).join('')}</div>`;
    h += `<p class="bk-note">${NOTICE}</p><div class="bk-btns">${cur.mine ? '<button type="button" class="sc-x warn" data-deld="1">この日記を消す</button><button type="button" class="btn lac" data-edit="1">直す</button>' : ''}<button type="button" class="btn lac" data-close="1">とじる</button></div>${cur.mine ? '' : '<button type="button" class="prof-report" data-repd="1">この日記を通報する</button>'}</div>`;
    return h;
  }
  function read(pid, did) {
    if (!P.online()) { P.toast(WHY.offline); return; }
    P.soc('dget', { pid, did }, res => {
      if (!res.ok) { P.toast(why(res)); return; }
      const opened = !$('#book').hidden;
      cur = { pid: res.pid, entry: res.entry, mine: res.mine, name: res.name, av: res.av, canWrite: res.canWrite };
      if (opened) turnPage(readPage()); else openBook(readPage());
    });
  }
  function reopen() { if (cur && cur.entry) openBook(readPage()); }

  $('#bookPage').addEventListener('input', e => { if (e.target.id === 'bkText') $('#bkCount').textContent = e.target.value.length; });
  $('#bookPage').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    const ds = b.dataset;
    if (ds.close) { closeBook(); return; }
    if (ds.repd) { window.REPORT.open({ pid: cur.pid, kind: 'diary', owner: cur.pid, did: cur.entry.id }); return; }
    if (ds.repc) { window.REPORT.open({ pid: ds.rpid, kind: 'comment', owner: cur.pid, did: cur.entry.id, id: +ds.repc }); return; }
    if (ds.save) { save(b); return; }
    if (ds.edit) { const e = cur.entry; kifu = e.kifu || null; cur = { edit: e }; turnPage(writePage(e)); return; }
    if (ds.pick) { pickKifu(); return; }
    if (ds.unkifu) { kifu = null; $('#bkKifu').innerHTML = '<button type="button" class="btn lac small" data-pick="1">棋譜をえらぶ（戦歴から）</button>'; return; }
    if (ds.pub) { pub = ds.pub; b.parentNode.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); return; }
    if (ds.step) { const k = b.closest('.dy-kifu').dataset.kid === 'w' ? kifu : cur.entry.kifu; if (k) stepKifu(b, k); return; }
    if (ds.review) { const k = ds.review === 'w' ? kifu : cur.entry.kifu; if (k) openReview(k); return; }
    if (ds.visit) { closeBook(true); if (window.ROOM) window.ROOM.visit(ds.visit, back); return; }
    if (ds.cm) {
      const box = $('#bkCm'), text = box.value.trim(); if (!text) { P.toast(WHY.empty); return; }
      b.disabled = true;
      P.soc('comment', { pid: cur.pid, did: cur.entry.id, text }, res => { b.disabled = false; if (!res.ok) { P.toast(why(res)); return; } P.sound('ok'); cur.entry = res.entry; $('#bookPage').innerHTML = readPage(); });
      return;
    }
    if (ds.delc) { P.confirmBox('このコメントを消しますか？', () => P.soc('del', { pid: cur.pid, kind: 'comment', did: cur.entry.id, id: +ds.delc }, res => { if (res.ok && res.entry) { cur.entry = res.entry; $('#bookPage').innerHTML = readPage(); } })); return; }
    if (ds.repub) {
      P.soc('dpub', { did: cur.entry.id, pub: ds.repub }, res => { if (!res.ok) return; cur.entry.pub = ds.repub; mine.diary = res.diary; $('#bookPage').innerHTML = readPage(); if (!$('#diaryHub').hidden) renderMine(); P.toast(`「${PUBS[ds.repub]}」にしました`); });
      return;
    }
    if (ds.deld) {
      P.confirmBox('この日記を消しますか？（消しても、今日もう一度書くことはできません）', () => P.soc('del', { pid: cur.pid, kind: 'diary', id: cur.entry.id }, res => {
        if (!res.ok) return; mine.diary = res.diary || []; closeBook(); P.toast('日記を消しました'); if (!$('#diaryHub').hidden) renderMine();
      }));
    }
  });

  /* ---------- 囲碁日記の画面 ---------- */
  const card = (d, who) => `<button type="button" class="dy-card" data-open="${esc(who ? who.pid : '')}" data-did="${d.id}">
    ${who ? `<span class="dy-av">${AV.svg(who.av || AV.PRESETS.girl)}</span>` : `<span class="dy-day">${md(d.t)}</span>`}
    <span class="dy-t"><b>${esc(d.title)}</b><small>${who ? esc(who.name) + 'さん・' + md(d.t) : PUBS[d.pub] || ''}${d.kifu ? '・棋譜つき' : ''}${d.nc ? `・コメント${d.nc}` : ''}</small>${d.text ? `<span class="dy-snip">${esc(d.text.slice(0, 40))}${d.text.length > 40 ? '…' : ''}</span>` : ''}</span></button>`;
  function renderMine() {
    $('#dyWriteSub').textContent = mine.wrote ? '今日はもう書きました（また明日）' : '1日1回・300字まで・棋譜もつけられる';
    $('#dyMine').innerHTML = (mine.diary || []).length ? mine.diary.map(d => card(d)).join('') : '<p class="rm-help">まだ日記がありません。「日記を書く」から、今日の一局のことを書いてみましょう。</p>';
  }
  function loadAll() {
    $('#dyAll').hidden = false; $('#dyAllList').innerHTML = '<p class="rm-help">読みこみ中……</p>';
    P.soc('drandom', {}, res => {
      if (!res.ok) { $('#dyAllList').innerHTML = `<p class="rm-help">${why(res)}</p>`; return; }
      $('#dyAllList').innerHTML = res.items.length ? res.items.map(d => card(d, d)).join('') : '<p class="rm-help">まだ公開の日記がありません。最初の一人になってみませんか？</p>';
    });
  }
  function openHub(showAll) {
    back = () => openHub();
    P.showScreen('diaryHub');
    if (!P.online()) { $('#dyMine').innerHTML = '<p class="rm-help">囲碁日記は、サーバーにつながっているときに使えます。</p>'; return; }
    P.soc('dlist', {}, res => { if (res.ok) { mine = res; renderMine(); } });
    if (showAll) loadAll(); else $('#dyAll').hidden = true;
  }
  $('#openDiary').onclick = () => { P.sound('stone'); openHub(); };
  $('#homeDiary').onclick = () => { P.sound('stone'); back = () => { P.renderHome(); P.showScreen('home'); }; write(); };
  $('#dyBack').onclick = () => window.AVATAR_UI.openHub();
  $('#dyWrite').onclick = () => { if (mine.wrote) { P.toast('今日の日記はもう書きました。また明日！'); return; } write(); };
  $('#dyRead').onclick = () => { P.sound('stone'); loadAll(); };
  $('#dyReload').onclick = loadAll;
  $('#diaryHub').addEventListener('click', e => { const b = e.target.closest('[data-did]'); if (b) read(b.dataset.open || mine.pid || S.pid, +b.dataset.did); });

  window.DIARY = { write, read, openHub, setBack: f => { back = f; } };
})();
