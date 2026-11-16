/* 共通：運営（管理者）の画面。設定 → 「運営：管理画面」（部屋番号 561149 の人だけ）
 *   通報 … 部屋・日記・一言の通報／メッセージの通報（通報したメッセージと前後のやりとり）
 *   利用者 … 部屋番号でさがす → 名前・碁会所・利用停止か、書きこみの写し（一言・コメント・碁会所の一言・掲示板。消されても残る）→ 利用停止／解除
 *   メッセージ（1対1）は通信の秘密があるので、通報されたもの以外は運営も読まない。
 */
(function () {
  'use strict';
  const P = window.APP;
  const $ = window.U.$;
  const esc = window.U.esc;
  const dt = t => { const d = new Date(t); return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`; };
  const KIND = { prof: 'プロフィール', chat: '部屋の一言', diary: '日記', comment: '日記のコメント' };
  let tab = 'rep', rep = null, user = null;

  function open() { P.showScreen('admin'); render(); if (tab === 'rep') loadRep(); }
  function loadRep() { P.admin('reports', {}, r => { rep = r.ok ? r : { soc: [], mail: [], err: r.reason }; render(); }); }
  function render() {
    for (const b of document.querySelectorAll('#adTabs button')) b.setAttribute('aria-checked', String(b.dataset.tab === tab));
    let h = '';
    if (tab === 'rep') {
      if (!rep) h = '<p class="rm-help">読みこみ中……</p>';
      else if (rep.err) h = `<p class="rm-help">見られません（${esc(rep.err)}）</p>`;
      else {
        h += `<div class="sc-sec"><b>メッセージの通報（${rep.mail.length}）</b>${rep.mail.length ? rep.mail.map(x => `<div class="ad-item"><small>${dt(x.t)}・通報した人 ${esc(x.by)}</small><p><b>${esc(x.name)}（${esc(x.pid)}）</b>「${esc(x.text)}」</p>
          <details><summary>前後のやりとり（通報した人の箱）</summary>${(x.ctx || []).map(c => `<p class="ad-ctx${c.mine ? ' mine' : ''}">${c.mine ? '通報者' : '相手'}：${esc(c.text)} <small>${dt(c.t)}</small></p>`).join('')}</details>
          <button type="button" class="btn lac small" data-user="${esc(x.pid)}">この人を見る</button></div>`).join('') : '<p class="rm-help">ありません</p>'}${rep.mail.length ? '<button type="button" class="sc-x" data-clear="mail">片づける</button>' : ''}</div>`;
        h += `<div class="sc-sec"><b>部屋・日記・一言の通報（${rep.soc.length}）</b>${rep.soc.length ? rep.soc.map(x => `<div class="ad-item"><small>${dt(x.t)}・${KIND[x.kind] || x.kind}・${esc(x.reason)}・通報した人 ${esc(x.from)}</small><p><b>${esc(x.name)}（${esc(x.pid)}）</b>${esc(x.excerpt)}</p>${x.note ? `<p class="ad-ctx">メモ：${esc(x.note)}</p>` : ''}<button type="button" class="btn lac small" data-user="${esc(x.pid)}">この人を見る</button></div>`).join('') : '<p class="rm-help">ありません</p>'}${rep.soc.length ? '<button type="button" class="sc-x" data-clear="soc">片づける</button>' : ''}</div>`;
      }
    } else {
      h += `<div class="sc-sec"><b>利用者をさがす</b><div class="sc-line"><input type="text" id="adPid" inputmode="numeric" maxlength="6" placeholder="部屋番号（6けた）" value="${user ? esc(user.user.pid) : ''}"><button type="button" class="btn primary small" data-find="1">さがす</button></div></div>`;
      if (user && user.err) h += `<p class="rm-help">見つかりません</p>`;
      else if (user) {
        const u = user.user;
        h += `<div class="sc-sec ${u.ban ? 'hi' : ''}"><b>${esc(u.name || '（名前なし）')}　部屋番号 ${esc(u.pid)}</b>
          <p class="ad-ctx">作成 ${u.created ? dt(u.created) : '—'}・${u.zeni.toLocaleString()}銭・フレンド ${u.friends}人・ブロック ${u.blocks}人${u.guild ? '・碁会所 ' + esc(u.guild) : ''}</p>
          ${u.hito ? `<p class="ad-ctx">ひとこと：${esc(u.hito)}</p>` : ''}
          ${u.ban ? `<p class="ad-ban">利用停止中（${dt(u.ban.t)}）${esc(u.ban.reason || '')}</p><button type="button" class="btn lac small" data-unban="${esc(u.pid)}">利用停止を解除</button>`
            : `<div class="sc-line"><input type="text" id="adReason" maxlength="100" placeholder="利用停止の理由（本人にも表示されます）"><button type="button" class="btn danger small" data-ban="${esc(u.pid)}">利用停止</button></div>`}</div>
          <div class="sc-sec"><b>書きこみの写し（${user.posts.length}）</b><small class="gk-note">一言・日記へのコメント・碁会所の一言・掲示板。本人が消しても残ります。お知らせとメッセージは入りません。</small>
          ${user.posts.length ? user.posts.map(p => `<p class="ad-ctx"><small>${dt(p.t)}・${esc(p.where)}</small><br>${esc(p.text)}</p>`).join('') : '<p class="rm-help">ありません</p>'}</div>`;
      }
    }
    $('#adBody').innerHTML = h;
  }
  function find(pid) { tab = 'user'; user = null; render(); P.admin('user', { pid }, r => { user = r.ok ? r : { err: 1, user: { pid } }; render(); }); }
  $('#adBack').onclick = () => { P.sound('tap'); P.showScreen('home'); P.renderHome(); };
  for (const b of document.querySelectorAll('#adTabs button')) b.onclick = () => { P.sound('tap'); tab = b.dataset.tab; render(); if (tab === 'rep') loadRep(); };
  $('#adBody').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    const d = b.dataset;
    if (d.user) find(d.user);
    else if (d.find) { const v = $('#adPid').value.replace(/\D/g, ''); if (v) find(v); }
    else if (d.clear) P.confirmBox('この通報の一覧を片づけますか？', () => P.admin('clear', { kind: d.clear }, loadRep));
    else if (d.ban) { const reason = $('#adReason').value.trim(); P.confirmBox(`部屋番号 ${d.ban} のアカウントを利用停止にしますか？`, () => P.admin('ban', { pid: d.ban, reason }, r => { P.toast(r.ok ? '利用停止にしました' : '失敗しました'); find(d.ban); }), null, { yes: '利用停止', no: 'やめる' }); }
    else if (d.unban) P.admin('unban', { pid: d.unban }, r => { P.toast(r.ok ? '解除しました' : '失敗しました'); find(d.unban); });
  });
  window.ADMIN = { open };
})();
