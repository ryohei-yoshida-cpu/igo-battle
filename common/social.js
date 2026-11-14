/* 共通：マイルームの交流パネル（日記・一言チャット・交流・この人）
 *   room.js から呼ばれる。サーバーとのやりとりは APP.soc(op, data, cb)。
 *   ctx = { mine, pid, name, data, me, visit(pid), reload() }
 *     data … たずねた部屋（自分の部屋も同じ形）{ hito, diary, chat, visits, cset, friend, asked, canWrite }
 *     me   … 自分の交流の情報 { pid, foot, friends, freq, blocks, cset }
 */
(function () {
  'use strict';
  const P = window.APP, S = P.S;
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const when = t => { const d = new Date(t), now = new Date(); const md = `${d.getMonth() + 1}/${d.getDate()}`; const hm = `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`; return d.toDateString() === now.toDateString() ? hm : md + ' ' + hm; };
  const WHY = {
    sexual: '性的な言葉が入っているので、書きこめません', violent: '暴力的な言葉が入っているので、書きこめません',
    abuse: '人を傷つける言葉が入っているので、書きこめません', contact: 'URL・メールアドレス・電話番号などは書きこめません',
    fast: '少し待ってから書きこんでください', many: '今日はもう書きこめません（1日80回まで）', long: '文字数が多すぎます', empty: '何か書いてください',
    closed: 'この部屋は今、書きこみを受け付けていません', blocked: 'この部屋には入れません', nobody: 'その番号の部屋はありません',
    offline: 'サーバーにつながっていません', full: '相手のフレンド申請がいっぱいです', myfull: 'フレンドは100人までです', theirfull: '相手のフレンドがいっぱいです（100人まで）', today: '日記は1日1回です', gone: 'その日記は消されました', self: '自分にはできません'
  };
  const why = r => WHY[r && r.reason] || 'うまくいきませんでした';
  const CSET = [['all', '全員'], ['friends', 'フレンドだけ'], ['none', '受け付けない']];

  // 名前（タップでその人の部屋へ）＋ 持ち主なら「ブロック」
  const who = (it, ctx) => `<button type="button" class="sc-name" data-visit="${esc(it.pid)}">${esc(it.name)}</button>`;
  const ctrl = (it, ctx, kind, did) => {
    let s = '';
    if (ctx.mine || it.pid === ctx.me.pid) s += `<button type="button" class="sc-x" data-del="${kind}" data-id="${it.id}" ${did ? `data-did="${did}"` : ''}>消す</button>`;
    if (it.pid !== ctx.me.pid) s += `<button type="button" class="sc-x" data-report="${kind}" data-rpid="${esc(it.pid)}" data-id="${it.id}" ${did ? `data-did="${did}"` : ''}>通報</button>`;
    if (ctx.mine && it.pid !== ctx.me.pid) s += `<button type="button" class="sc-x warn" data-block="${esc(it.pid)}" data-name="${esc(it.name)}">ブロック</button>`;
    return s;
  };
  const closedNote = ctx => ctx.mine || ctx.data.canWrite ? '' : `<p class="rm-help warn">${ctx.data.cset === 'friends' ? 'この部屋は、フレンドだけが書きこめます。' : 'この部屋は、書きこみを受け付けていません。'}</p>`;

  function render(tab, ctx, el) {
    const d = ctx.data || {}, me = ctx.me || {};
    let h = '';
    if (tab === 'diary') {
      if (ctx.mine) h += `<div class="sc-write"><button type="button" class="btn primary" data-dwrite="1">日記を書く（日記帳をひらく）</button></div>`;
      if (!(d.diary || []).length) h += `<p class="rm-help">${ctx.mine ? 'まだ日記がありません。今日の一局のことを書いてみましょう。' : 'まだ見られる日記がありません。'}</p>`;
      h += (d.diary || []).map(e => `<button type="button" class="dy-card" data-dopen="${e.id}"><span class="dy-day">${new Date(e.t).getMonth() + 1}/${new Date(e.t).getDate()}</span><span class="dy-t"><b>${esc(e.title)}</b><small>${e.kifu ? '棋譜つき' : ''}${e.nc ? `${e.kifu ? '・' : ''}コメント${e.nc}` : ''}</small></span></button>`).join('');
    } else if (tab === 'chat') {
      h += closedNote(ctx);
      if (ctx.mine || d.canWrite) h += `<div class="sc-line"><input type="text" id="scChat" maxlength="40" placeholder="一言（40字まで）"><button type="button" class="btn primary small" data-post="chat">送る</button></div>`;
      h += (d.chat || []).length ? `<ul class="sc-chat">${d.chat.map(c => `<li>${who(c, ctx)}<span>${esc(c.text)}</span><time>${when(c.t)}</time>${ctrl(c, ctx, 'chat')}</li>`).join('')}</ul>`
        : '<p class="rm-help">まだ書きこみがありません。</p>';
    } else if (tab === 'social') {
      const opps = [], seen = new Set();
      for (const x of S.history || []) if (x.opid && !seen.has(x.opid) && opps.length < 6) { seen.add(x.opid); opps.push({ pid: x.opid, name: x.op }); }
      h += `<div class="sc-card sc-num"><small>あなたの部屋番号</small><b>${esc(me.pid || '……')}</b><button type="button" class="btn lac small" data-copy="${esc(me.pid || '')}">コピー</button></div>`;
      h += `<div class="sc-sec"><b>部屋のひとこと</b><div class="sc-line"><input type="text" id="scHito" maxlength="40" placeholder="部屋の入り口に出るひとこと" value="${esc(d.hito || '')}"><button type="button" class="btn lac small" data-post="hito">決める</button></div></div>`;
      h += `<div class="sc-sec"><b>部屋をたずねる</b><div class="sc-line"><input type="text" id="scVisit" inputmode="numeric" maxlength="6" placeholder="部屋番号（6けた）"><button type="button" class="btn primary small" data-go="1">たずねる</button></div>
        <button type="button" class="btn lac small" data-random="1">にぎやかな部屋へ（ランダム）</button></div>`;
      if (opps.length) h += `<div class="sc-sec"><b>最近の対局相手</b><ul class="sc-people">${opps.map(o => `<li>${who(o, ctx)}<button type="button" class="btn lac small" data-visit="${esc(o.pid)}">たずねる</button></li>`).join('')}</ul></div>`;
      if ((me.freq || []).length) h += `<div class="sc-sec hi"><b>フレンド申請が来ています</b><ul class="sc-people">${me.freq.map(f => `<li>${who(f, ctx)}<button type="button" class="btn primary small" data-fa="${esc(f.pid)}">承認</button><button type="button" class="btn lac small" data-fd="${esc(f.pid)}">ことわる</button></li>`).join('')}</ul></div>`;
      h += `<div class="sc-sec"><b>フレンド（${(me.friends || []).length}）</b>${(me.friends || []).length ? `<ul class="sc-people">${me.friends.map(f => `<li>${who(f, ctx)}<button type="button" class="btn lac small" data-visit="${esc(f.pid)}">たずねる</button><button type="button" class="sc-x" data-unfriend="${esc(f.pid)}" data-name="${esc(f.name)}">解除</button></li>`).join('')}</ul>` : '<p class="rm-help">ほかの人の部屋の「この人」から、フレンド申請できます。</p>'}</div>`;
      h += `<div class="sc-sec"><b>足あと（最近来た人）</b>${(me.foot || []).length ? `<ul class="sc-people">${me.foot.map(f => `<li>${who(f, ctx)}<time>${when(f.t)}</time><button type="button" class="sc-x warn" data-block="${esc(f.pid)}" data-name="${esc(f.name)}">ブロック</button></li>`).join('')}</ul>` : '<p class="rm-help">まだ誰も来ていません。</p>'}</div>`;
      h += `<div class="sc-sec"><b>日記へのコメント・一言チャットを</b><div class="rm-seg">${CSET.map(([k, n]) => `<button type="button" data-cset="${k}" aria-pressed="${(me.cset || 'all') === k}">${n}</button>`).join('')}</div>
        <p class="rm-help">ブロックした人は、あなたの部屋に入れず、書きこみもできなくなります。不適切な言葉（性的・暴力的・悪口・連絡先など）は自動で止まります。</p></div>`;
      if ((me.blocks || []).length) h += `<div class="sc-sec"><b>ブロック中（${me.blocks.length}）</b><ul class="sc-people">${me.blocks.map(f => `<li><span class="sc-name">${esc(f.name)}</span><button type="button" class="btn lac small" data-unblock="${esc(f.pid)}">解除</button></li>`).join('')}</ul></div>`;
    } else if (tab === 'owner') {
      h += `<div class="sc-card"><small>部屋番号 ${esc(ctx.pid)}</small><b>${esc(ctx.name)}さんの部屋</b><span>訪問 今日${d.visits ? d.visits.today : 0}人・合計${d.visits ? d.visits.total : 0}人</span></div>`;
      h += `<div class="sc-sec">${d.friend ? '<p class="rm-help">フレンドです。</p>' : d.asked ? '<p class="rm-help">フレンド申請中です。</p>' : `<button type="button" class="btn primary small" data-freq="${esc(ctx.pid)}">フレンド申請する</button>`}</div>`;
      h += `<div class="sc-sec"><button type="button" class="btn lac small" data-home="1">自分の部屋にもどる</button>
        <button type="button" class="sc-x warn" data-block="${esc(ctx.pid)}" data-name="${esc(ctx.name)}">この人をブロックする</button></div>`;
    }
    el.innerHTML = h;
  }

  // パネルの中のボタン
  function onClick(e, ctx) {
    const b = e.target.closest('button'); if (!b) return false;
    const ds = b.dataset;
    const after = res => { if (!res.ok) { P.toast(why(res)); return; } ctx.reload(); };
    if (ds.visit) { ctx.visit(ds.visit); return true; }
    if (ds.dwrite) { ctx.write(); return true; }
    if (ds.dopen) { ctx.read(ctx.pid, +ds.dopen); return true; }
    if (ds.post) {
      const box = ds.post === 'chat' ? $('#scChat') : $('#scHito');
      const text = box.value.trim();
      if (!text && ds.post !== 'hito') { P.toast(WHY.empty); return true; }
      b.disabled = true;
      P.soc(ds.post, { pid: ctx.pid, text }, res => { b.disabled = false; if (res.ok) { box.value = ''; P.sound('ok'); P.toast(ds.post === 'hito' ? 'ひとことを決めました' : '書きこみました'); } after(res); });
      return true;
    }
    if (ds.comment) {
      const box = document.querySelector(`[data-cin="${ds.comment}"]`), text = box.value.trim();
      if (!text) { P.toast(WHY.empty); return true; }
      P.soc('comment', { pid: ctx.pid, did: +ds.comment, text }, res => { if (res.ok) P.sound('ok'); after(res); });
      return true;
    }
    if (ds.del) { P.confirmBox('消しますか？', () => P.soc('del', { pid: ctx.pid, kind: ds.del, id: +ds.id, did: +ds.did || 0 }, after)); return true; }
    if (ds.block) { P.confirmBox(`${ds.name}さんをブロックしますか？ あなたの部屋に入れなくなり、書きこみも消えます。`, () => P.soc('block', { pid: ds.block, name: ds.name }, res => { if (res.ok) P.toast('ブロックしました'); if (ctx.mine) after(res); else ctx.home(); })); return true; }
    if (ds.report) { window.REPORT.open({ pid: ds.rpid, kind: ds.report, owner: ctx.pid, id: +ds.id, did: +ds.did || 0 }); return true; }
    if (ds.unblock) { P.soc('unblock', { pid: ds.unblock }, after); return true; }
    if (ds.cset) { P.soc('cset', { v: ds.cset }, after); return true; }
    if (ds.fa) { P.soc('faccept', { pid: ds.fa }, res => { if (res.ok) P.toast('フレンドになりました'); after(res); }); return true; }
    if (ds.fd) { P.soc('fdecline', { pid: ds.fd }, after); return true; }
    if (ds.unfriend) { P.confirmBox(`${ds.name}さんとのフレンドを解除しますか？`, () => P.soc('unfriend', { pid: ds.unfriend }, after)); return true; }
    if (ds.freq) { P.soc('freq', { pid: ds.freq }, res => { if (res.ok) P.toast('フレンド申請しました'); after(res); }); return true; }
    if (ds.home) { ctx.home(); return true; }
    if (ds.go) { const v = ($('#scVisit').value || '').replace(/\D/g, ''); if (v.length !== 6) { P.toast('部屋番号は6けたです'); return true; } ctx.visit(v); return true; }
    if (ds.random) { P.soc('random', {}, res => { if (res.ok && res.pid) ctx.visit(res.pid); else P.toast('いまは、たずねられる部屋が見つかりません'); }); return true; }
    if (ds.copy) { const t = ds.copy; try { navigator.clipboard.writeText(t).then(() => P.toast('部屋番号をコピーしました'), () => P.toast(`部屋番号は ${t} です`)); } catch (err) { P.toast(`部屋番号は ${t} です`); } return true; }
    return false;
  }

  window.SOCIAL = { render, onClick, why };
})();
