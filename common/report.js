/* 通報：プロフィール・一言コメント・日記・コメントから。運営（部屋番号 561149）は設定 →「運営：管理画面」で見る（common/admin.js） */
(function () {
  'use strict';
  const P = window.APP, S = P.S;
  const esc = window.U.esc;
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
  window.REPORT = { open, isAdmin: () => String(S.pid) === '561149' };
})();
