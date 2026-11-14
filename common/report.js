/* 通報：プロフィール・一言コメント・日記・コメントから。運営（部屋番号 561149）は設定から一覧を見られる */
(function () {
  'use strict';
  const P = window.APP, S = P.S;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const REASONS = ['ひどい名前・ことば', 'いやがらせ・悪口', '性的・暴力的な内容', '連絡先・個人情報', 'その他'];
  const KIND = { prof: '名前・ひとこと', chat: '一言コメント', diary: '日記', comment: '日記へのコメント' };
  let box = null, ctx = null;
  function ensure() {
    if (box) return box;
    box = document.createElement('div'); box.className = 'prof-wrap rep-wrap'; box.hidden = true;
    box.innerHTML = '<div class="prof-card" role="dialog" aria-modal="true"><button type="button" class="prof-x" aria-label="閉じる">✕</button><div class="rep-body"></div></div>';
    document.body.append(box);
    box.addEventListener('click', e => {
      if (e.target === box || e.target.closest('.prof-x')) { box.hidden = true; return; }
      const b = e.target.closest('button[data-send]'); if (!b) return;
      const r = box.querySelector('input[name=rep]:checked');
      if (!r) { P.toast('理由をえらんでください'); return; }
      b.disabled = true;
      P.soc('report', Object.assign({}, ctx, { reason: r.value, note: box.querySelector('textarea').value }), res => {
        b.disabled = false;
        if (!res.ok) { P.toast(res.reason === 'many' ? '今日はこれ以上通報できません' : '送れませんでした'); return; }
        box.hidden = true; P.sound('ok'); P.toast('通報を受けつけました。ご協力ありがとうございます');
      });
    });
    return box;
  }
  function open(c) {
    if (!P.online()) { P.toast('サーバーにつながっているときに通報できます'); return; }
    ctx = c; const b = ensure();
    b.querySelector('.rep-body').innerHTML = `<h3 class="rep-h">通報する（${esc(KIND[c.kind] || '')}）</h3>
      <p class="rm-help">運営が内容を確かめます。通報したことは相手には知らされません。すぐに見たくない場合は、ブロックもできます。</p>
      <div class="rep-list">${REASONS.map((r, i) => `<label><input type="radio" name="rep" value="${esc(r)}"> ${esc(r)}</label>`).join('')}</div>
      <textarea maxlength="200" placeholder="くわしく（なくてもOK・200字まで）"></textarea>
      <div class="prof-btns"><button type="button" class="btn primary" data-send="1">通報する</button></div>`;
    b.hidden = false;
  }
  // 運営：通報の一覧
  function admin() {
    const b = ensure(); b.hidden = false;
    const body = b.querySelector('.rep-body'); body.innerHTML = '<p class="rm-help">読みこみ中……</p>';
    P.soc('reports', {}, res => {
      if (!res.ok) { body.innerHTML = '<p class="rm-help">見られませんでした。</p>'; return; }
      const d = t => new Date(t).toLocaleString('ja-JP');
      body.innerHTML = `<h3 class="rep-h">通報の一覧（${res.list.length}件）</h3>` + (res.list.length ? res.list.map(x => `<div class="rep-item"><small>${d(x.t)}・${esc(KIND[x.kind] || x.kind)}・${esc(x.reason)}</small>
        <b>相手：${esc(x.name)}（部屋番号 <button type="button" class="sc-name" data-room="${esc(x.pid)}">${esc(x.pid)}</button>）</b><p>${esc(x.excerpt)}</p>${x.note ? `<p class="rep-note">通報した人のメモ：${esc(x.note)}</p>` : ''}<small>通報した人：${esc(x.from)}${x.owner && x.owner !== x.pid ? `・書かれた部屋 ${esc(x.owner)}` : ''}</small></div>`).join('') : '<p class="rm-help">通報はありません。</p>');
    });
  }
  document.addEventListener('click', e => { const r = e.target.closest('.rep-item [data-room]'); if (r) { box.hidden = true; $s('#settings').hidden = true; window.ROOM.visit(r.dataset.room); } });
  const $s = s => document.querySelector(s);
  window.REPORT = { open, admin, isAdmin: () => String(S.pid) === '561149' };
})();
