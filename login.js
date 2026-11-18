/* ログインボーナス（7日間）
 * 毎日はじめて来たとき、7日ぶんのカードを矢印でつないだ表を出す。今日のところに印、明日のぶんも見える。
 * 7日目は1000銭。1日でも空くと1日目から（サーバーが数える：server/econ.js の LOGIN7）。
 * 小春が今日のぶんを手わたしてくれる。「受け取る」でそのまま受け取り（プレゼントボックスを通さない）。
 */
(() => {
  'use strict';
  const P = window.APP, S = P.S, $ = s => document.querySelector(s);
  const LOGIN7 = [100, 150, 200, 250, 300, 400, 1000];
  let pend = null;
  // サーバーから：{ day:'2026-11-18', n: 今日が何日目 }
  function set(login) {
    if (!login || !login.day || !login.n) return;
    if (S.loginSeen === login.day) return;
    pend = login; setTimeout(tryShow, 1200);
  }
  // 出してよいとき：ホームで、ほかの案内・キャラの登場が出ていない（はじめの小春の案内が済んでから）
  function tryShow() {
    if (!pend) return;
    if (S.loginSeen === pend.day) { pend = null; return; }   // もう見た（ほかの端末・あとから届いた保存データ）
    const home = !$('#home').hidden, busy = document.querySelector('.sj, .tut, .ff, .lb, #fxStamp:not([hidden]), #confirm:not([hidden])');
    if (!home || busy || !(S.prog && S.prog.intro) || (window.PROG && window.PROG.busy())) { setTimeout(tryShow, 2000); return; }
    const l = pend; pend = null; S.loginSeen = l.day; P.save(); show(l.n);
  }
  const coin = z => z >= 1000 ? '💰💰💰' : z >= 300 ? '💰💰' : '💰';
  function line(n) {
    const z = LOGIN7[n - 1];
    if (n === 7) return '1週間、毎日来てくれて、ありがとうございます！ 7日目のごほうび、1000銭です！ 明日からは、また1日目ですよ。';
    if (n === 6) return `今日は6日目！ ${z}銭どうぞ！ ……明日はいよいよ7日目、1000銭ですよ！ ぜったい来てくださいね！`;
    if (n === 1) return `今日も来てくれたんですね！ ${z}銭どうぞ！ 7日つづけて来ると、7日目は1000銭です。いっしょにがんばりましょう！`;
    return `今日は${n}日目！ ${z}銭どうぞ！ 明日は${LOGIN7[n]}銭ですよ。また来てくださいね！`;
  }
  function show(n) {
    const el = document.createElement('div'); el.className = 'lb';
    const cells = LOGIN7.map((z, i) => {
      const d = i + 1, st = d < n ? 'done' : d === n ? 'today' : d === n + 1 ? 'next' : '';
      const tag = d === n ? '今日' : d === n + 1 ? '明日' : '';
      return `<div class="lb-c ${st}${d === 7 ? ' big' : ''}"><small>${d}日目</small><i aria-hidden="true">${coin(z)}</i><b>${z.toLocaleString()}銭</b>${tag ? `<u>${tag}</u>` : ''}${d < n ? '<s aria-hidden="true">済</s>' : ''}</div>`;
    });
    const row = list => list.map((c, i) => (i ? '<em aria-hidden="true">➔</em>' : '') + c).join('');
    el.innerHTML = `<div class="lb-card" role="dialog" aria-label="ログインボーナス">
        <div class="lb-head"><b>ログインボーナス</b><small>7日つづけて来ると、7日目は1000銭！</small></div>
        <div class="lb-row">${row(cells.slice(0, 4))}</div>
        <div class="lb-row">${row(cells.slice(4))}</div>
        <div class="lb-talk"><img class="lb-k" alt=""><p></p></div>
        <button type="button" class="btn primary lb-ok">受け取る</button>
      </div>`;
    document.body.append(el);
    P.setImg(el.querySelector('.lb-k'), 'img/bust_koharu.webp');
    el.querySelector('.lb-talk p').textContent = line(n);
    P.sound('coin');
    const ok = el.querySelector('.lb-ok');
    ok.onclick = () => {
      ok.disabled = true; P.sound('tap');
      const g = (window.GIFT ? window.GIFT.list() : []).filter(x => x.kind === 'daily').pop();
      const end = () => { el.classList.add('out'); setTimeout(() => { el.remove(); P.renderHome(); }, 350); };   // とじたあと、New Mission などを出す
      if (!g || !P.online()) { P.toast('プレゼントボックスに入っています'); end(); return; }
      P.giftReq({ t: 'gifttake', id: g.id }, m => {
        if (m && m.gifts && window.GIFT) window.GIFT.setGifts(m.gifts);
        el.querySelector(`.lb-c.today`).classList.add('got');
        P.toast(`＋${(g.amount | 0).toLocaleString()} 銭`); P.sound('coin');
        setTimeout(end, 700);
      });
    };
  }
  window.LOGINBONUS = { set, show, pending: () => !!pend };
})();
