/* 共通：メッセージ（ホームのプレゼントの左の ✉️）
 *   フレンド・同じ碁会所のメンバーと、1対1でやりとりできる（どちらかがブロックしていたら送れない）
 *   碁会所の入会申請・招待もここに届く（申請は承認／おことわり、招待は入る／ことわる）
 *   受け取ったメッセージは「通報」できる（通報したメッセージと前後のやりとりだけ、運営が確認できる）
 */
(function () {
  'use strict';
  const P = window.APP, S = P.S;
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const when = t => { const d = new Date(t), n = new Date(); return d.toDateString() === n.toDateString() ? `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}` : `${d.getMonth() + 1}/${d.getDate()}`; };
  const WHY = {
    offline: 'サーバーにつながっているときに使えます', who: 'フレンドか、同じ碁会所のメンバーにだけ送れます', blocked: 'ブロックしているか、されているので送れません',
    empty: 'メッセージを入れてください', long: '200字までです', ng: '使えない言葉が入っています', contact: '連絡先・URLなどの個人情報は送れません',
    fast: '少し待ってから送ってください', kid: '15歳以下の人は、メッセージを使えません', kidto: '相手は15歳以下なので、メッセージを送れません', many: '今日はもう送れません（1日150通まで）', gone: 'もうありません', in: 'もう碁会所に入っています', full: '碁会所がいっぱいです', role: 'できるのはマスター・店長だけです'
  };
  const why = r => WHY[r && r.reason] || 'うまくいきませんでした';
  const req = (op, data, cb) => P.mail(op, data, r => { if (r && typeof r.unread === 'number') badge(r.unread); if (cb) cb(r); });
  let list = [], cur = null, back = 'home', unread = 0;

  function badge(n) { unread = n; const b = $('#mailBadge'); if (b) { b.hidden = !n; b.textContent = n > 99 ? '99+' : n; } }

  function open(from) {
    if (from) back = from;
    cur = null; P.showScreen('mail'); $('#mlTitle').textContent = 'メッセージ';
    if (!P.online()) { $('#mlBody').innerHTML = `<p class="rm-help">${WHY.offline}。</p>`; return; }
    $('#mlBody').innerHTML = '<p class="rm-help">読みこみ中……</p>';
    req('list', {}, r => { list = r.ok ? r.list : []; render(); });
  }
  const KIND = { apply: '入会申請', invite: '碁会所の招待', sys: 'お知らせ' };
  function render() {
    if (cur) return renderThread();
    let h = `<p class="ml-note">フレンド・同じ碁会所のメンバーとやりとりできます。連絡先などの個人情報や、会う約束はやりとりしないでください。</p>
      <button type="button" class="btn primary" data-new="1">＋ 新しいメッセージ</button><div class="ml-pick" id="mlPick" hidden></div>`;
    if (!list.length) h += '<p class="rm-help">メッセージはまだありません。</p>';
    h += '<ul class="ml-list">' + list.map(x => {
      if (x.kind === 'msg') return `<li><button type="button" class="ml-row${x.unread ? ' new' : ''}" data-peer="${esc(x.peer)}" data-name="${esc(x.name)}"><b>${esc(x.name)}</b><span>${x.mine ? 'あなた：' : ''}${esc(x.text)}</span><time>${when(x.t)}</time>${x.unread ? `<i>${x.unread}</i>` : ''}</button></li>`;
      const e = x.extra || {}, done = x.done ? `<em class="ml-done">${x.done === 'accepted' ? (x.kind === 'apply' ? '承認しました' : '入りました') : 'ことわりました'}</em>` : '';
      const acts = x.done ? done : x.kind === 'apply' ? `<button type="button" class="btn primary small" data-approve="${esc(e.pid)}" data-n="${x.n}">承認</button><button type="button" class="btn lac small" data-reject="${esc(e.pid)}" data-n="${x.n}">おことわり</button>`
        : x.kind === 'invite' ? `<button type="button" class="btn primary small" data-accept="${esc(e.gid)}" data-n="${x.n}">入る</button><button type="button" class="btn lac small" data-decline="${x.n}">ことわる</button>` : '';
      return `<li class="ml-sys${x.unread ? ' new' : ''}"><div><small>${KIND[x.kind] || ''}・${esc(x.name)}さんから・${when(x.t)}</small><p>${esc(x.text)}</p></div><div class="gk-row">${acts}<button type="button" class="sc-x" data-delsys="${x.n}">消す</button></div></li>`;
    }).join('') + '</ul>';
    $('#mlBody').innerHTML = h;
    // システムの知らせは、開いたら読んだことに
    for (const x of list) if (x.kind !== 'msg' && x.unread) { x.unread = 0; req('thread', { n: x.n }); }
  }
  function openThread(pid, name) {
    cur = { pid, name, items: [] }; $('#mlTitle').textContent = name;
    $('#mlBody').innerHTML = '<p class="rm-help">読みこみ中……</p>';
    req('thread', { pid }, r => { if (!cur || cur.pid !== pid) return; cur.items = r.ok ? r.items : []; renderThread(); });
  }
  function renderThread() {
    const c = cur;
    $('#mlBody').innerHTML = `<div class="ml-thread" id="mlThread">${c.items.length ? c.items.map(x => `<div class="ml-msg${x.mine ? ' mine' : ''}"><p>${esc(x.text)}</p><small>${when(x.t)}${x.mine ? '' : ` ・ <button type="button" class="ml-rep" data-rep="${x.n}">通報</button>`}</small></div>`).join('') : '<p class="rm-help">まだやりとりはありません。</p>'}</div>
      <div class="ml-send"><textarea id="mlText" maxlength="200" rows="2" placeholder="${esc(c.name)}さんへ（200字まで）"></textarea><button type="button" class="btn primary" data-send="1">送る</button></div>
      <p class="ml-note">連絡先・URL・会う約束などはやりとりできません。困ったときは「通報」してください。</p>
      <div class="gk-row ml-foot"><button type="button" class="btn lac small" data-visit="${esc(c.pid)}">部屋へ</button><button type="button" class="sc-x" data-delthread="1">このやりとりを消す</button></div>`;
    const th = $('#mlThread'); th.scrollTop = th.scrollHeight;
  }
  function compose(pid, name, from) { if (!P.online()) { P.toast(WHY.offline); return; } if (window.AGE && window.AGE.kid()) { P.toast(WHY.kid); return; } back = from || 'home'; P.showScreen('mail'); openThread(String(pid), name || String(pid)); }

  $('#mlBack').onclick = () => {
    P.sound('tap');
    if (cur) { cur = null; open(); return; }
    if (back === 'guild' && window.GUILD) window.GUILD.open(); else if (back === 'myroom' && window.ROOM) window.ROOM.open(); else { P.showScreen('home'); P.renderHome(); }
  };
  $('#mlBody').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || b.disabled) return;
    const d = b.dataset;
    const reload = () => req('list', {}, r => { list = r.ok ? r.list : list; render(); });
    if (d.peer) { P.sound('stone'); openThread(d.peer, d.name); }
    else if (d.new) {
      P.sound('tap'); const box = $('#mlPick'); box.hidden = !box.hidden; if (box.hidden) return;
      box.innerHTML = '<p class="rm-help">読みこみ中……</p>';
      req('to', {}, r => { box.innerHTML = r.ok && r.list.length ? r.list.map(x => `<button type="button" class="btn lac small" data-peer="${esc(x.pid)}" data-name="${esc(x.name)}">${esc(x.name)}<small>${x.f ? 'フレンド' : '碁会所'}</small></button>`).join('') : '<p class="rm-help">送れる相手がいません（フレンドか、同じ碁会所のメンバーに送れます）。</p>'; });
    }
    else if (d.send) {
      const t = $('#mlText'), text = t.value.trim(); if (!text) return;
      b.disabled = true;
      req('send', { pid: cur.pid, text }, r => { b.disabled = false; if (!r.ok) { P.sound('bad'); P.toast(why(r), 3500); return; } P.sound('ok'); cur.items = r.items; renderThread(); });
    }
    else if (d.rep) P.confirmBox('このメッセージを運営に通報しますか？（このメッセージと前後のやりとりを、運営が確認します）', () => req('report', { n: +d.rep, reason: 'メッセージ' }, r => P.toast(r.ok ? '通報しました。ありがとうございます' : why(r))), null, { yes: '通報する', no: 'やめる' });
    else if (d.delthread) P.confirmBox('このやりとりを、あなたのメッセージから消しますか？', () => req('del', { pid: cur.pid }, () => { cur = null; open(); }));
    else if (d.delsys) req('del', { n: +d.delsys }, reload);
    else if (d.visit) { P.sound('stone'); window.ROOM.visit(d.visit); }
    else if (d.approve || d.reject) P.guild(d.approve ? 'approve' : 'reject', { pid: d.approve || d.reject }, r => { if (!r.ok) { P.toast(why(r)); } else P.toast(d.approve ? '入会を承認しました' : 'おことわりしました'); reload(); });
    else if (d.accept) P.guild('accept', { id: d.accept, n: +d.n }, r => { if (!r.ok) { P.toast(why(r)); reload(); return; } P.sound('ok'); P.toast('碁会所に入りました！'); if (window.GUILD) window.GUILD.open('home', 'home'); });
    else if (d.decline) P.guild('decline', { n: +d.decline }, reload);
  });
  $('#mlBody').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && e.target.id === 'mlText') { e.preventDefault(); $('#mlBody [data-send]').click(); } });

  function push(m) {
    badge(m.unread | 0);
    const it = m.item;
    if (!$('#mail').hidden) {
      if (cur && it.kind === 'msg' && it.peer === cur.pid) { cur.items.push(it); renderThread(); req('thread', { pid: cur.pid }); }
      else if (!cur) req('list', {}, r => { list = r.ok ? r.list : list; render(); });
    }
    if (!(cur && it.peer === cur.pid && !$('#mail').hidden)) P.toast(it.kind === 'msg' ? `✉️ ${it.name}さんからメッセージ` : `✉️ ${KIND[it.kind] || 'お知らせ'}が届きました`, 3500);
  }
  $('#openMail').onclick = () => { P.sound('stone'); open('home'); };
  // つながったら未読の数を読む
  let loaded = false;
  setInterval(() => { if (!loaded && P.online()) { loaded = true; req('unread', {}, r => { if (!r.ok) loaded = false; }); } }, 2500);
  window.MAIL = { open, push, compose, badge };
})();
