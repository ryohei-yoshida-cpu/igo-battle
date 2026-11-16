/* ホームの「次の目標」（いつもいちばん上に、やることを1つずつ）
 *   ★ 特別ミッション … キャラが来たあとの「やってみよう」（common/progress.js）
 *   📖 初心者ミッション … 初心者モード：ソロの物語を順番に（春告げ → … → 九路の剣客 → キャラのエピソード → 闇落ち玄斎）
 *        九路の剣客まで読んで、まだ巴に会っていなければ「アタリ碁を打ってみよう」
 *   ⚔ キャラクターミッション … 経験者は最初から／初心者は闇落ち玄斎のあと。Botの強さの順に「3勝」→「5勝で部屋に呼ぶ」
 *   🎯 共通ミッション … 巴（3局）→ ひなた（5局）→ 静馬（10局）→ 段級位でキャラの開放
 */
(function () {
  'use strict';
  const P = window.APP, S = P.S, A = P.A;
  const $ = window.U.$, esc = window.U.esc;
  const PR = () => window.PROG;
  const read = id => !!(S.solo && S.solo.read && S.solo.read[id]);
  const STORIES = ['haru', 'yugen', 'kenkaku', 'ep_hinata', 'ep_shima', 'ep_tomoe', 'ep_mike', 'ep_tono', 'ep_dgensai'];
  const titleOf = id => ((window.STORIES || []).find(s => s.id === id) || {}).title || id;
  const CH_LV = [0, 2, 4, 6, 8, 9, 12];   // キャラクターミッション：Botの強さ（10級みけ → 8級ひなた → 6級静馬 → 4級巴 → 2級殿 → 1級玄斎 → 三段ダーク玄斎）
  const nameOf = key => (A.VARIANTS.find(v => v.key === key) || {}).name || key;

  // 初心者ミッション（ソロの物語）。読み終わったら null
  function soloGoal() {
    const g = S.prog || {}, seen = g.seen || {};
    const next = STORIES.find(id => !read(id));
    if (!next) return null;
    if (next.startsWith('ep_') && !g.all && !seen.recLook) {
      if (seen.rec) return { icon: '📖', kind: '初心者ミッション', text: '特別ミッション「戦歴を見てみよう」をクリアしよう', go: () => PR().runSpecial() };
      const n = PR().gamesLeft('rec');
      return { icon: '📖', kind: '初心者ミッション', text: `アタリ碁を打ってみよう（あと ${n} 回）`, go: () => P.startAtari(() => { P.showScreen('home'); P.renderHome(); }) };
    }
    return { icon: '📖', kind: '初心者ミッション', text: `ソロモード「${titleOf(next)}」を読もう`, go: () => window.SOLO.open() };
  }
  // キャラクターミッション（Botのキャラに3勝 → 5勝で部屋に呼ぶ）。ぜんぶ終わったら null
  function charaGoal() {
    const done = new Set();
    for (const lv of CH_LV) {
      const key = A.VARIANTS[A.rivalOf(P.charaIdx(), lv)].key;
      if (done.has(key)) continue; done.add(key);
      const w = (S.vs && S.vs[key]) | 0;
      const go = () => { P.setBotLevel(lv); P.openPvp(); P.toast(`「キャラクターと対局」で、${nameOf(key)}（${P.RANKS[lv]}）と打てます`, 3500); };
      if (w < 3) return { icon: '⚔', kind: 'キャラクターミッション', text: `${nameOf(key)}（${P.RANKS[lv]}）に3勝しよう`, n: w, of: 3, go };
      if (w < 5) return { icon: '⚔', kind: 'キャラクターミッション', text: `${nameOf(key)}に5勝して、部屋に呼ぼう`, n: w, of: 5, go };
    }
    return null;
  }
  // 共通ミッション：巴 → ひなた → 静馬 → 段級位でキャラの開放
  function commonGoal() {
    const g = S.prog || {}, seen = g.seen || {}, beg = PR().beginner();
    if (g.all && seen.room) return rankGoal();
    for (const [k, who, ep] of [['rec', '巴', null], ['av', 'ひなた', 'ep_hinata'], ['room', '静馬', 'ep_shima']]) {
      if (seen[k]) continue;
      const n = PR().gamesLeft(k);
      if (PR().ready(k)) return { icon: '🎯', kind: '共通ミッション', text: `${who}がやってくる！`, go: () => PR().check() };
      return { icon: '🎯', kind: '共通ミッション', text: `あと ${n} 局で ${who}に会える${ep && beg && !read(ep) ? '（またはエピソードを読む）' : ''}`, go: () => P.openPvp() };
    }
    return rankGoal();
  }
  function rankGoal() {
    const now = Math.max(P.displayRank(9), P.displayRank(13));
    const locked = A.VARIANTS.map((v, i) => ({ v, i, r: P.UNLOCK[v.key] || 0 })).filter(x => !P.charaOpen(x.i)).sort((a, b) => a.r - b.r);
    if (!locked.length) return null;
    const r = locked[0].r, who = locked.filter(x => x.r === r).map(x => x.v.name).join('・');
    const need = Math.max(0, Math.min(P.TH[r] - (S.rating | 0), P.TH[r] - ((S.r13 && S.r13.rating) | 0)));
    return { icon: '🎯', kind: '共通ミッション', text: `${P.RANKS[r]}になると ${who}が仲間に${r > now ? `（あとレート ${need}）` : ''}`, go: () => P.openPvp() };
  }

  function list() {
    const out = [];
    const sp = PR() && PR().spInfo();
    if (sp) out.push({ icon: '★', kind: '特別ミッション', text: sp.title, sp: true, go: () => PR().runSpecial() });
    if (!PR()) return out;
    const beg = PR().beginner();
    const main = (beg ? soloGoal() : null) || charaGoal();
    if (main) out.push(main);
    const c = commonGoal(); if (c) out.push(c);
    return out;
  }
  let cur = [];
  function render() {
    const box = $('#goalBox'); if (!box) return;
    if (!(S.prog && S.prog.intro)) { box.hidden = true; return; }   // はじめの小春の登場の前は出さない
    cur = list();
    box.hidden = !cur.length;
    box.innerHTML = cur.map((x, i) => `<button type="button" class="goal${x.sp ? ' sp' : ''}" data-goal="${i}"><i aria-hidden="true">${x.icon}</i><span><small>${esc(x.kind)}</small><b>${esc(x.text)}</b></span>${x.of ? `<em>${x.n}/${x.of}</em>` : ''}<s aria-hidden="true">›</s></button>`).join('');
  }
  $('#goalBox').addEventListener('click', e => {
    const b = e.target.closest('[data-goal]'); if (!b) return;
    const x = cur[+b.dataset.goal]; if (!x) return;
    P.sound('tap'); x.go();
  });
  document.addEventListener('kuro9screen', e => { if (e.detail === 'home') setTimeout(render, 0); });
  window.GOALS = { render, list };
})();
