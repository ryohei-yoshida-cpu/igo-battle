/* ホームの「次の目標」（いつもいちばん上に、やることを1つずつ）
 *   ★ 特別ミッション … キャラが来たあとの「やってみよう」（common/progress.js）
 *   📖 初心者ミッション … 初心者モード：ソロの物語を順番に（春告げ → … → 九路の剣客 → キャラのエピソード → 闇落ち玄斎）
 *        九路の剣客まで読んで、まだ巴に会っていなければ「アタリ碁を打ってみよう」
 *   ⚔ キャラクターミッション … 静馬に会ってから（経験者はすぐ／初心者は闇落ち玄斎のあと）。Botの強さの順に「3勝」→「5勝で部屋に呼ぶ」
 *   🎯 共通ミッション … 対人戦メニューで打つ（だれが来るかは出さない）→ 段級位でキャラの開放
 *   はじめて出た目標には「NEW」の印（タップするまで）と、「New Mission!」のお知らせ
 */
(function () {
  'use strict';
  const P = window.APP, S = P.S, A = P.A;
  const $ = window.U.$, esc = window.U.esc;
  const PR = () => window.PROG;
  const read = id => !!(S.solo && S.solo.read && S.solo.read[id]);
  const STORIES = ['haru', 'yugen', 'kenkaku', 'ep_hinata', 'ep_shima', 'ep_tomoe', 'ep_mike', 'ep_tono', 'ep_dgensai'];
  const titleOf = id => ((window.STORIES || []).find(s => s.id === id) || {}).title || id;
  const CH_LV = [0, 2, 4, 6, 8, 10, 11, 12];   // キャラクターミッション：Botの強さ（10級小春 → 8級ひなた → 6級みけ → 4級静馬 → 2級巴 → 初段玄斎 → 二段殿 → 三段ダーク玄斎）
  const nameOf = key => (A.VARIANTS.find(v => v.key === key) || {}).name || key;

  // 初心者ミッション（ソロの物語）。読み終わったら null
  function soloGoal() {
    const g = S.prog || {}, seen = g.seen || {};
    const next = STORIES.find(id => !read(id));
    if (!next) return null;
    if (next.startsWith('ep_') && !g.all && !seen.recLook) {
      if (seen.rec) return { icon: '📖', kind: '初心者ミッション', text: '特別ミッション「戦歴を見てみよう」をクリアしよう', go: () => PR().runSpecial() };
      const n = PR().gamesLeft('rec');
      if (n <= 0) return false;   // 3回打った：あとは巴の登場（共通ミッションの行）。キャラクターミッションにはまだ進まない
      return { icon: '📖', kind: '初心者ミッション', text: `アタリ碁を打ってみよう（あと ${n} 回）`, go: () => P.startAtari(() => { P.showScreen('home'); P.renderHome(); setTimeout(() => PR().check(), 500); }) };
    }
    return { icon: '📖', kind: '初心者ミッション', text: `ソロモード「${titleOf(next)}」を読もう`, go: () => window.SOLO.open() };
  }
  // キャラクターミッション（Botのキャラに3勝 → 5勝で部屋に呼ぶ）。ぜんぶ終わったら null
  function charaGoal() {
    const g = S.prog || {};
    if (!g.all && !(g.seen && g.seen.room)) return null;   // 静馬に会って、マイルームが開いてからはじまる
    const done = new Set();
    for (const lv of CH_LV) {
      const key = A.VARIANTS[A.rivalOf(P.charaIdx(), lv)].key;
      if (done.has(key)) continue; done.add(key);
      const w = (S.vs && S.vs[key]) | 0;
      const go = () => { P.setBotLevel(lv); P.openPvp(); P.toast(`「キャラクターと対局」で、${nameOf(key)}（${P.RANKS[lv]}）と打てます`, 3500); };
      if (w < 3) return { key: 'ch:' + key + ':3', icon: '⚔', kind: 'キャラクターミッション', text: `${nameOf(key)}（${P.RANKS[lv]}）に3勝しよう`, n: w, of: 3, go };
      if (w < 5) return { key: 'ch:' + key + ':5', icon: '⚔', kind: 'キャラクターミッション', text: `${nameOf(key)}に5勝して、部屋に呼ぼう`, n: w, of: 5, go };
    }
    return null;
  }
  // 共通ミッション：巴 → ひなた → 静馬 → 段級位でキャラの開放
  function commonGoal() {
    const g = S.prog || {}, seen = g.seen || {};
    if (g.all && seen.room) return rankGoal();
    for (const k of ['rec', 'av', 'room']) {
      if (seen[k]) continue;
      // だれが来るかは、来るまでのおたのしみ（名前・局数は出さない）
      if (PR().ready(k)) return { key: 'c:' + k + ':come', icon: '🎯', kind: '共通ミッション', text: 'だれかが来たみたい……？', go: () => PR().check() };
      // すすみぐあい：前のイベントからの局数
      const N = PR().NEED, base = { rec: 0, av: N.rec, room: N.av }[k], of = N[k] - base, n = Math.max(0, Math.min(of, (g.games | 0) - base));
      return { key: 'c:' + k, icon: '🎯', kind: '共通ミッション', text: `対人戦メニューで ${of} 局打ってみよう`, n, of, go: () => P.openPvp() };
    }
    return rankGoal();
  }
  function rankGoal() {
    const now = Math.max(P.displayRank(9), P.displayRank(13));
    const locked = A.VARIANTS.map((v, i) => ({ v, i, r: P.UNLOCK[v.key] || 0 })).filter(x => !P.charaOpen(x.i)).sort((a, b) => a.r - b.r);
    if (!locked.length) return null;
    const r = locked[0].r, who = locked.filter(x => x.r === r).map(x => x.v.name).join('・');
    const need = Math.max(0, Math.min(P.TH[r] - (S.rating | 0), P.TH[r] - ((S.r13 && S.r13.rating) | 0)));
    return { key: 'r:' + r, icon: '🎯', kind: '共通ミッション', text: `${P.RANKS[r]}になると ${who}が仲間に${r > now ? `（あとレート ${need}）` : ''}`, go: () => P.openPvp() };
  }

  function list() {
    const out = [];
    const sp = PR() && PR().spInfo();
    if (sp) out.push({ key: 'sp:' + S.sp, icon: '★', kind: '特別ミッション', text: sp.title, sp: true, go: () => PR().runSpecial() });
    if (!PR()) return out;
    const beg = PR().beginner();
    const sg = beg ? soloGoal() : null;
    const main = sg === false ? null : sg || charaGoal();
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
    // 新しい目標：NEW の印（タップするまで）。はじめて出たときは「New Mission!」
    S.goalAck = S.goalAck || {};
    const keyOf = x => x.key || (x.kind + ':' + x.text);
    const fresh = cur.filter(x => !S.goalAck[keyOf(x)] && !(S.goalShown || {})[keyOf(x)]);
    box.innerHTML = cur.map((x, i) => `<button type="button" class="goal${x.sp ? ' sp' : ''}${S.goalAck[keyOf(x)] ? '' : ' new'}" data-goal="${i}"><i aria-hidden="true">${x.icon}</i><span><small>${esc(x.kind)}${S.goalAck[keyOf(x)] ? '' : '<u>NEW</u>'}</small><b>${esc(x.text)}</b></span>${x.of ? `<em>${x.n}/${x.of}</em>` : ''}<s aria-hidden="true">›</s></button>`).join('');
    if (fresh.length && !document.querySelector('.sj, .tut, .ff, .lb') && !(window.LOGINBONUS && window.LOGINBONUS.pending())) {   // ログインボーナスが出ているあいだは、あとで
      S.goalShown = S.goalShown || {}; fresh.forEach(x => { S.goalShown[keyOf(x)] = 1; }); P.save();
      newMission(fresh.map(x => x.text));
    }
  }
  // 「New Mission!」の帯（ホームの上に、少しのあいだ）
  function newMission(texts) {
    const el = document.createElement('div'); el.className = 'goal-newban';
    el.innerHTML = `<b>New Mission!</b>${texts.map(t => `<span>${esc(t)}</span>`).join('')}`;
    document.body.append(el); P.sound('coin');
    setTimeout(() => el.classList.add('out'), 2600); setTimeout(() => el.remove(), 3200);
  }
  $('#goalBox').addEventListener('click', e => {
    const b = e.target.closest('[data-goal]'); if (!b) return;
    const x = cur[+b.dataset.goal]; if (!x) return;
    if (PR().busy() || document.querySelector('.sj, .tut, .ff')) return;   // キャラの登場・案内のさいちゅう（とじた直後のタップも）は動かさない
    S.goalAck = S.goalAck || {}; S.goalAck[x.key || (x.kind + ':' + x.text)] = 1; P.save();
    P.sound('tap'); x.go();
  });
  document.addEventListener('kuro9screen', e => { if (e.detail === 'home') setTimeout(render, 0); });
  window.GOALS = { render, list };
})();
