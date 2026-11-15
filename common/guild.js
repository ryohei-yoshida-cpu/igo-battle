/* 共通：ギルド（囲碁は「碁会所」、将棋は「将棋サロン」、麻雀は「雀荘」。ゲームごとに別）
 *   50局で開く。つくった人がマスター。マスターは店長を1人えらべる。20人まで。
 *   碁会所   … メンバー（オンライン・今月の勝ち）・50銭おすそわけ（1日5人まで）・店長の任命・追放・リコール・抜ける
 *   マッチ   … 碁会所内のランダムマッチ／「マッチを呼ぶ」（相手をえらんでハンデを決める）／「マッチに入る」（OK か、ハンデの変更を提案）
 *   ミッション … 碁会所みんなの対局数で、ひとりずつ受け取れる銭（1日ごと・1週間ごと）
 *   ランキング … 月の「自分の強さ以上の相手への勝ち数」で碁会所どうしの順位。上位にトロフィーと銭
 *   一言     … 画面の一番上の一行をタップ → 下の欄から、碁会所のみんなに一言（☹️ はマスター・店長だけが数を見られる）
 */
(function () {
  'use strict';
  const P = window.APP, S = P.S;
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const WORD = '碁会所';
  const MISSIONS = [
    ['inner', '碁会所内で5局', 5, 100, '日'], ['random', 'ランダムマッチ20局', 20, 100, '日'], ['bot', 'キャラクターと20局', 20, 100, '日'],
    ['total', 'みんなで100局', 100, 150, '日'], ['week', '1週間で500局', 500, 300, '週']
  ];
  const WHY = {
    offline: 'サーバーにつながっているときに使えます', games: '50局打つと入れます', in: 'もう碁会所に入っています', name: '名前を入れてください', ng: 'その言葉は使えません',
    same: '同じ名前の碁会所があります', full: 'いっぱいです', none: '見つかりませんでした', role: 'できるのはマスター・店長だけです', who: 'その人には、できません',
    twice: '今日はもう、その人におくりました', many: '今日おくれるのは5人までです', yet: 'まだ達成していません', got: 'もう受け取りました', already: 'もう始まっています',
    empty: '一言を入れてください', long: '40字までです', fast: '少し待ってから送ってください', mine: '自分の一言です', gone: 'その呼びかけは、もうありません',
    turn: '相手の返事を待っています', off: '相手がオンラインではありません', busy: 'どちらかが対局中です', net: 'つながっていません', auth: 'アカウントが必要です'
  };
  const why = r => WHY[r && r.reason] || 'うまくいきませんでした';
  const ROLE = { master: 'マスター', manager: '店長', member: '' };

  let G = null, tab = 'home', calls = [], seeking = false, rank = null, list = null, back = 'home', open = null, busy = false;
  // 呼ぶとき・ハンデを提案するときの手合い：mode even 互先 / me 自分がもらう / them 相手がもらう / auto 階級差で
  const hcSt = { mode: 'auto', h: 1, min: 5, size: 9, pid: '' };
  try { Object.assign(hcSt, JSON.parse(localStorage.getItem('kuro9.gkhc') || '{}')); } catch (e) {}
  const keepHc = () => { try { localStorage.setItem('kuro9.gkhc', JSON.stringify(hcSt)); } catch (e) {} };

  const req = (op, data, cb) => P.guild(op, data, r => { if (r && r.guild !== undefined) setG(r.guild); if (cb) cb(r); });
  function setG(g) {
    G = g;
    if (window.TICKER) window.TICKER.guild(g ? g.chat : null, g && (g.role === 'master' || g.role === 'manager'));
    const sub = $('#goGuildSub');
    if (sub) sub.textContent = g ? `「${g.name}」の仲間と一局。オンライン ${g.members.filter(m => m.on && !m.me).length}人` : '碁会所の仲間と一局。ランダム・呼びかけ（ハンデ戦もできる）';
  }

  /* ---------- 画面 ---------- */
  function openGuild(t, from) {
    if (from) back = from;
    if (t) tab = t;
    P.showScreen('guild');
    $('#gkZeni').textContent = `${(S.zeni | 0).toLocaleString()} 銭`;
    if (!P.online()) { G = null; $('#gkTabs').hidden = true; $('#gkBody').innerHTML = `<p class="rm-help">${WHY.offline}。</p>`; return; }
    if (!G) $('#gkBody').innerHTML = '<p class="rm-help">読みこみ中……</p>';
    req('me', {}, r => { if (!r.ok) { $('#gkBody').innerHTML = `<p class="rm-help">${why(r)}</p>`; return; } render(); if (G && tab === 'match') loadCalls(); if (tab === 'rank' || !G) loadRank(); });
  }
  function render() {
    if ($('#guild').hidden) return;
    $('#gkTitle').textContent = G ? G.name : WORD;
    $('#gkTabs').hidden = !G;
    for (const b of document.querySelectorAll('#gkTabs button')) {
      b.setAttribute('aria-checked', String(b.dataset.tab === tab));
      b.classList.toggle('dot', b.dataset.tab === 'match' && calls.some(c => c.myTurn) || b.dataset.tab === 'mission' && G && canClaim().length > 0);
    }
    const body = $('#gkBody');
    if (!G) { body.innerHTML = joinView(); return; }
    body.innerHTML = tab === 'match' ? matchView() : tab === 'mission' ? missionView() : tab === 'rank' ? rankView() : homeView();
  }

  // 入っていない：つくる・さがす
  function joinView() {
    let h = `<div class="gk-hero"><b>碁会所</b><p>仲間と集まって打つ場所です。メンバーどうしで銭をおくったり、みんなの対局数でミッションを達成したり、月ごとに碁会所どうしで勝ち数をきそったりできます（20人まで）。</p></div>
      <div class="sc-sec"><b>碁会所をつくる</b><div class="sc-line"><input type="text" id="gkName" maxlength="12" placeholder="碁会所の名前（12字まで）"><button type="button" class="btn primary small" data-act="create">つくる</button></div><small class="gk-note">つくった人が「マスター」になります。</small></div>
      <div class="sc-sec"><b>碁会所をさがす</b><div class="sc-line"><input type="text" id="gkQ" maxlength="20" placeholder="名前か ID（6文字）"><button type="button" class="btn lac small" data-act="search">さがす</button></div>`;
    h += list ? (list.length ? `<ul class="gk-list">${list.map(x => `<li><span><b>${esc(x.name)}</b><small>ID ${esc(x.id)}・${x.n}/20人・今月 ${x.wins}勝</small></span>${x.n >= 20 ? '<em>満員</em>' : `<button type="button" class="btn primary small" data-join="${esc(x.id)}">入る</button>`}</li>`).join('')}</ul>` : '<p class="rm-help">見つかりませんでした。</p>') : '';
    return h + '</div>';
  }

  function homeView() {
    const g = G, boss = g.role === 'master' || g.role === 'manager', on = g.members.filter(m => m.on).length;
    let h = `<div class="gk-info"><span>ID <b>${esc(g.id)}</b></span><span>${g.members.length}/${g.max}人・オンライン ${on}人</span><span>今月 <b>${g.wins}</b>勝</span>${g.role !== 'member' ? `<em class="gk-role ${g.role}">${ROLE[g.role]}</em>` : ''}</div>`;
    if (g.recall) {
      const r = g.recall;
      h += `<div class="sc-sec hi gk-recall"><b>マスターのリコール投票中</b><p>店長がマスターのリコールをはじめました。賛成 ${r.yes}／必要 ${r.need}（マスターをのぞくメンバーの8割）・反対 ${r.no}</p>
        ${g.role === 'master' ? '<small>マスターは投票できません。</small>' : `<div class="gk-row"><button type="button" class="btn ${r.voted === 'yes' ? 'primary' : 'lac'} small" data-vote="1">賛成</button><button type="button" class="btn ${r.voted === 'no' ? 'primary' : 'lac'} small" data-vote="0">反対</button></div>`}</div>`;
    }
    h += `<div class="sc-sec"><b>メンバー</b><small class="gk-note">50銭おすそわけ：今日 ${g.gave.length}/5人（運営から出ます。もらえるのは1人1日3回まで）${boss ? '・☹️ はみんなが「やだなぁ」と押した数（マスターと店長だけに見えます）' : ''}</small><ul class="gk-mem">`;
    for (const m of g.members.slice().sort((a, b) => (b.on - a.on) || ({ master: 2, manager: 1, member: 0 }[b.role] - { master: 2, manager: 1, member: 0 }[a.role]) || b.wins - a.wins)) {
      const gave = g.gave.includes(m.pid), canKick = boss && m.role === 'member' && !m.me, openRow = open === m.pid;
      h += `<li class="${m.on ? 'on' : ''}${m.me ? ' me' : ''}">
        <span class="gk-av">${window.AVATAR.thumb(m.av || window.AVATAR.PRESETS.girl, 'icon')}<i class="gk-dot${m.busy ? ' busy' : ''}"></i></span>
        <span class="gk-who"><b>${esc(m.name)}${m.me ? '（自分）' : ''}</b><small>${m.role !== 'member' ? `<em class="gk-role ${m.role}">${ROLE[m.role]}</em>` : ''}今月 ${m.wins}勝${m.on ? (m.busy ? '・対局中' : '・オンライン') : ''}${m.frown != null && m.frown ? `・<span class="gk-frown">☹️${m.frown}</span>` : ''}</small></span>
        ${m.me ? '' : `<span class="gk-acts">${gave ? '<em>おくった</em>' : `<button type="button" class="btn primary small" data-give="${esc(m.pid)}">50銭</button>`}<button type="button" class="btn lac small" data-more="${esc(m.pid)}" aria-label="ほかの操作">…</button></span>`}
        ${openRow ? `<div class="gk-more"><button type="button" class="btn lac small" data-visit="${esc(m.pid)}">部屋へ</button>${m.on && !m.busy ? `<button type="button" class="btn lac small" data-callto="${esc(m.pid)}">マッチを呼ぶ</button>` : ''}${g.role === 'master' ? (m.role === 'manager' ? '<button type="button" class="btn lac small" data-boss="">店長をやめてもらう</button>' : `<button type="button" class="btn lac small" data-boss="${esc(m.pid)}">店長にする</button>`) : ''}${canKick ? `<button type="button" class="btn danger small" data-kick="${esc(m.pid)}">追放</button>` : ''}</div>` : ''}
      </li>`;
    }
    h += '</ul></div>';
    h += `<div class="sc-sec"><b>一言（碁会所のみんなへ）</b><div class="sc-line"><input type="text" id="gkSay" maxlength="40" placeholder="一言（40字まで）"><button type="button" class="btn primary small" data-act="say">送る</button></div>
      <ul class="gk-chat">${g.chat.length ? g.chat.slice(0, 15).map(chatLi).join('') : '<li class="gk-none">まだ一言はありません</li>'}</ul><small class="gk-note">画面の一番上の一行をタップしても、一言を送れます。</small></div>`;
    h += `<div class="gk-foot">${g.role === 'manager' && !g.recall ? '<button type="button" class="btn lac small" data-act="recall">マスターをリコールする</button>' : ''}<button type="button" class="btn danger small" data-act="leave">碁会所を抜ける</button></div>`;
    return h;
  }
  function chatLi(c) {
    const boss = G && (G.role === 'master' || G.role === 'manager');
    return `<li><b>${esc(c.name)}</b><span>${esc(c.text)}</span>${c.mine ? '' : `<button type="button" class="gk-fr${c.frowned ? ' on' : ''}" data-frown="${c.id}" aria-label="やだなぁ">☹️${boss && c.frown ? c.frown : ''}</button>`}</li>`;
  }

  /* ---------- マッチ ---------- */
  const hcName = h => P.HC_NAME[h] || '互先';
  function hcText(hc, mine) {
    const myB = hc.black === 'random' ? null : (hc.black === 'host') === mine;
    const who = myB ? 'あなた' : '相手';
    const t = hc.h === 0 ? '互先（コミ7目・黒白おまかせ）' : hc.h === 1 ? `定先（${who}が黒・コミなし）` : `${hc.h}子局（${who}が${hc.h}子置く）`;
    return `${t}・${hc.size === 13 ? 13 : 9}路・${hc.min}分`;
  }
  function matchView() {
    const others = G.members.filter(m => !m.me), online = others.filter(m => m.on);
    let h = `<div class="chips gk-size" role="radiogroup">${[9, 13].map(n => `<button type="button" role="radio" data-size="${n}" aria-checked="${hcSt.size === n}">${n}路</button>`).join('')}</div>`;
    h += `<div class="sc-sec"><b>碁会所内ランダム</b><p class="gk-note">待っている碁会所の仲間と、互先（コミ7目・${hcSt.size === 13 ? 10 : 5}分）で一局。レートと銭は変わりません（碁会所のミッションに数えます）。</p>
      ${seeking ? '<div class="gk-row"><span class="fr-dots"><i></i><i></i><i></i></span><b class="gk-wait">仲間を待っています……</b><button type="button" class="btn lac small" data-act="unseek">やめる</button></div>' : `<button type="button" class="btn primary" data-act="seek">ランダムで探す（オンライン ${online.length}人）</button>`}</div>`;
    // マッチに入る（自分あての呼びかけ・自分が出した呼びかけ）
    h += '<div class="sc-sec"><b>マッチに入る</b>';
    if (!calls.length) h += '<p class="gk-note">あなたあての呼びかけはありません。</p>';
    for (const c of calls) {
      const editing = open === 'prop:' + c.id;
      h += `<div class="gk-call${c.myTurn ? ' hi' : ''}"><div><b>${c.mine ? (c.myTurn ? `${esc(c.name)}さんからハンデの変更の提案` : `${esc(c.name)}さんを呼んでいます`) : `${esc(c.name)}さんからの呼びかけ`}</b><small>${esc(hcText(c.hc, c.mine))}${c.auto ? '（階級差で決定）' : ''}${c.proposed ? '・ハンデの変更が提案されています' : ''}</small></div>
        <div class="gk-row">${c.myTurn ? `<button type="button" class="btn primary small" data-ok="${c.id}">OK・対局する</button><button type="button" class="btn lac small" data-prop="${c.id}">ハンデの変更を提案する</button>` : '<span class="gk-note">相手の返事を待っています</span>'}<button type="button" class="btn lac small" data-drop="${c.id}">やめる</button></div>
        ${editing ? hcPicker(false) + `<button type="button" class="btn primary small" data-propgo="${c.id}">この手合いを提案する</button>` : ''}</div>`;
    }
    h += '</div>';
    // マッチを呼ぶ
    h += `<div class="sc-sec"><b>マッチを呼ぶ</b><p class="gk-note">相手をえらんで呼びかけます。呼ばれた人だけが入れます。</p>
      <label class="gk-pick"><small>相手</small><select class="select" id="gkTo">${others.length ? others.map(m => `<option value="${esc(m.pid)}"${m.pid === hcSt.pid ? ' selected' : ''}${!m.on ? ' disabled' : ''}>${esc(m.name)}${m.on ? (m.busy ? '（対局中）' : '') : '（オフライン）'}</option>`).join('') : '<option value="">メンバーがいません</option>'}</select></label>
      ${hcPicker(true)}<button type="button" class="btn primary" data-act="call"${online.length ? '' : ' disabled'}>この手合いで呼ぶ</button></div>`;
    return h;
  }
  function hcPicker() {
    const modes = [['auto', '階級差で決める'], ['even', '互先'], ['me', '自分がハンデをもらう'], ['them', '相手がハンデをもらう']];
    let h = `<div class="fr-label">手合い（ハンデ）</div><div class="chips gk-mode" role="radiogroup">${modes.map(([k, t]) => `<button type="button" role="radio" data-mode="${k}" aria-checked="${hcSt.mode === k}">${t}</button>`).join('')}</div>`;
    if (hcSt.mode === 'me' || hcSt.mode === 'them') h += `<div class="chips gk-h" role="radiogroup">${[1, 2, 3, 4, 5].map(n => `<button type="button" role="radio" data-h="${n}" aria-checked="${hcSt.h === n}">${hcName(n)}</button>`).join('')}</div>`;
    if (hcSt.mode === 'auto') h += '<p class="gk-note">段級位の差で決めます（差1で定先、2〜5で置き石。弱いほうが黒）。</p>';
    h += `<div class="fr-label">持ち時間（1手ごとに＋5秒）</div><div class="chips gk-min" role="radiogroup">${[3, 5, 10, 15].map(n => `<button type="button" role="radio" data-min="${n}" aria-checked="${hcSt.min === n}">${n}分</button>`).join('')}</div>`;
    return h;
  }
  // 画面の手合い → サーバーの形（host＝呼んだ人）
  function hcOut(iAmHost) {
    const base = { min: hcSt.min, size: hcSt.size };
    if (hcSt.mode === 'auto') return { hc: base, auto: true };
    if (hcSt.mode === 'even') return { hc: Object.assign(base, { h: 0, black: 'random' }) };
    const meBlack = hcSt.mode === 'me';
    return { hc: Object.assign(base, { h: hcSt.h, black: meBlack === iAmHost ? 'host' : 'guest' }) };
  }
  function loadCalls(then) { req('gcalls', {}, r => { if (r.ok) calls = r.calls || []; render(); if (then) then(); }); }

  /* ---------- ミッション ---------- */
  function canClaim() { return MISSIONS.filter(([k, , need]) => (k === 'week' ? G.week.total : G.day[k] | 0) >= need && !(k === 'week' ? G.wgot : G.got).includes(k)); }
  function missionView() {
    let h = '<p class="gk-note gk-lead">碁会所のみんなの対局数で達成します。達成したら、ひとりずつ受け取れます（短すぎる対局は数えません。毎日0時・週は月曜にリセット）。</p><ul class="gk-mis">';
    for (const [k, name, need, zeni, per] of MISSIONS) {
      const have = k === 'week' ? G.week.total : G.day[k] | 0, got = (k === 'week' ? G.wgot : G.got).includes(k), ok = have >= need;
      h += `<li class="${got ? 'got' : ok ? 'ok' : ''}"><div><b>${name}</b><small>${per === '週' ? '1週間ごと' : '1日ごと'}・${zeni}銭</small><span class="gk-bar"><i style="width:${Math.min(100, have / need * 100)}%"></i></span><small>${Math.min(have, need)} / ${need}局</small></div>
        ${got ? '<em>受け取りずみ</em>' : `<button type="button" class="btn ${ok ? 'primary' : 'lac'} small" data-claim="${k}"${ok ? '' : ' disabled'}>受け取る</button>`}</li>`;
    }
    return h + '</ul>';
  }

  /* ---------- ランキング ---------- */
  function loadRank() { req('rank', {}, r => { if (r.ok) { rank = r; if (!G) list = list || r.list; } render(); }); }
  function rankView() {
    if (!rank) return '<p class="rm-help">読みこみ中……</p>';
    let h = `<p class="gk-note gk-lead">月ごとに、碁会所のメンバーが「自分の強さ以上」の相手（ランダムマッチ・キャラクター戦）に勝った数を合計してきそいます。1位は10000銭、上位5%にはトロフィー（家具）、最下位でも300銭。銭はメンバーの勝ち数に応じて山分け（マスターは1.3倍の重み）。</p>`;
    h += '<ol class="gk-rank">' + (rank.list.length ? rank.list.map(x => `<li class="${x.id === (G && G.id) ? 'me' : ''}"><span class="gk-no">${x.rank || '−'}</span><span><b>${esc(x.name)}</b><small>${x.n}人</small></span><span class="gk-w">${x.wins}勝</span><small class="gk-p">${x.prize ? `${x.prize.zeni.toLocaleString()}銭${x.prize.trophy ? '🏆' : ''}` : ''}</small></li>`).join('') : '<li class="gk-none">まだ碁会所がありません</li>') + '</ol>';
    if (rank.last && rank.last.top && rank.last.top.length) h += `<div class="sc-sec"><b>先月の結果</b><ol class="gk-rank small">${rank.last.top.slice(0, 5).map(x => `<li><span class="gk-no">${x.rank}</span><span><b>${esc(x.name)}</b></span><span class="gk-w">${x.total}勝</span><small class="gk-p">${x.zeni.toLocaleString()}銭</small></li>`).join('')}</ol></div>`;
    return h;
  }

  /* ---------- 操作 ---------- */
  const fail = r => { P.sound('bad'); P.toast(why(r)); };
  $('#gkBack').onclick = () => { P.sound('tap'); if (seeking) { seeking = false; P.guild('gunseek', {}); } if (back === 'pvp') P.openPvp(); else { P.showScreen('home'); P.renderHome(); } };
  for (const b of document.querySelectorAll('#gkTabs button')) b.onclick = () => {
    P.sound('stone'); tab = b.dataset.tab; open = null; render();
    if (tab === 'match') loadCalls(); else if (tab === 'rank') loadRank(); else req('me', {}, () => render());
  };
  $('#gkBody').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || b.disabled || busy) return;
    const d = b.dataset;
    const done = (r, msg) => { busy = false; if (!r.ok) { fail(r); render(); return; } if (msg) P.toast(msg); P.sound('ok'); render(); };
    const go = (op, data, msg, cb) => { busy = true; req(op, data, r => { done(r, msg); if (cb && r.ok) cb(r); }); };
    if (d.act === 'create') { const name = $('#gkName').value.trim(); if (!name) { P.toast(WHY.name); return; } go('create', { name }, `碁会所「${name}」をつくりました！ あなたがマスターです`); }
    else if (d.act === 'search') { P.sound('tap'); P.guild('list', { q: $('#gkQ').value.trim() }, r => { list = r.ok ? r.list : []; render(); }); }
    else if (d.join) go('join', { id: d.join }, '碁会所に入りました！');
    else if (d.more) { P.sound('tap'); open = open === d.more ? null : d.more; render(); }
    else if (d.give) go('give', { pid: d.give }, '50銭をおくりました');
    else if (d.visit) { P.sound('stone'); window.ROOM.visit(d.visit); }
    else if (d.callto) { P.sound('stone'); hcSt.pid = d.callto; keepHc(); tab = 'match'; open = null; loadCalls(); }
    else if (d.boss !== undefined) { const m = G.members.find(x => x.pid === d.boss); P.confirmBox(d.boss ? `${m ? m.name : ''}さんを店長にしますか？（店長は1人だけ。前の店長は交代します）` : '店長をやめてもらいますか？', () => go('boss', { pid: d.boss }, d.boss ? '店長をえらびました' : '店長をやめてもらいました')); }
    else if (d.kick) { const m = G.members.find(x => x.pid === d.kick); P.confirmBox(`${m ? m.name : ''}さんを碁会所から追放しますか？`, () => { open = null; go('kick', { pid: d.kick }, '追放しました'); }, null, { yes: '追放する', no: 'やめる' }); }
    else if (d.act === 'leave') P.confirmBox(G.role === 'master' ? '碁会所を抜けますか？（マスターは店長に、店長がいなければいちばん古いメンバーに引きつがれます）' : '碁会所を抜けますか？', () => go('leave', {}, '碁会所を抜けました', () => { tab = 'home'; list = null; loadRank(); }), null, { yes: '抜ける', no: 'やめる' });
    else if (d.act === 'recall') P.confirmBox('マスターのリコール投票をはじめますか？（3日以内に、マスターをのぞくメンバーの8割が賛成すると、マスターは碁会所を外れ、あなたがマスターになります）', () => go('recall', {}, 'リコール投票をはじめました'));
    else if (d.vote !== undefined) go('vote', { yes: d.vote === '1' }, d.vote === '1' ? '賛成しました' : '反対しました', r => { if (r.recalled) P.toast('リコールが成立しました', 4000); });
    else if (d.act === 'say') { const text = $('#gkSay').value.trim(); if (!text) return; go('say', { text }, null, () => { req('me', {}, () => render()); }); }
    else if (d.frown) { P.sound('tap'); req('frown', { id: +d.frown }, r => { if (!r.ok) fail(r); render(); }); }
    else if (d.claim) go('claim', { k: d.claim }, null, r => { P.toast(`ミッション達成！ ＋${r.gained} 銭`, 3500); });
    else if (d.size) { P.sound('tap'); hcSt.size = +d.size; if (hcSt.size === 13 && hcSt.min < 10) hcSt.min = 10; if (hcSt.size === 9 && hcSt.min > 10) hcSt.min = 5; keepHc(); render(); }
    else if (d.mode) { P.sound('tap'); hcSt.mode = d.mode; keepHc(); render(); }
    else if (d.h) { P.sound('tap'); hcSt.h = +d.h; keepHc(); render(); }
    else if (d.min) { P.sound('tap'); hcSt.min = +d.min; keepHc(); render(); }
    else if (d.act === 'seek') { P.sound('stone'); req('gseek', { size: hcSt.size }, r => { seeking = !!(r.ok && r.seeking); if (!r.ok) fail(r); render(); }); }
    else if (d.act === 'unseek') { P.sound('tap'); req('gunseek', {}, () => { seeking = false; render(); }); }
    else if (d.act === 'call') {
      const pid = $('#gkTo').value; if (!pid) return;
      hcSt.pid = pid; keepHc();
      busy = true; req('gcall', Object.assign({ pid }, hcOut(true)), r => { busy = false; if (!r.ok) { fail(r); return; } calls = r.calls || calls; P.sound('ok'); P.toast(`呼びかけました：${hcText(r.call.hc, true)}`, 3500); render(); });
    }
    else if (d.ok) { busy = true; req('gok', { id: +d.ok }, r => { busy = false; if (!r.ok) { fail(r); loadCalls(); } }); }
    else if (d.prop) { P.sound('tap'); open = open === 'prop:' + d.prop ? null : 'prop:' + d.prop; render(); }
    else if (d.propgo) { const c = calls.find(x => x.id === +d.propgo); busy = true; req('gprop', Object.assign({ id: +d.propgo }, hcOut(c ? c.mine : true)), r => { busy = false; if (!r.ok) { fail(r); return; } calls = r.calls || calls; open = null; P.toast('ハンデの変更を提案しました'); render(); }); }
    else if (d.drop) { busy = true; req('gdrop', { id: +d.drop }, r => { busy = false; if (r.ok) calls = r.calls || []; render(); }); }
  });
  $('#gkBody').addEventListener('change', e => { if (e.target.id === 'gkTo') { hcSt.pid = e.target.value; keepHc(); } });
  $('#gkBody').addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'gkSay') { e.preventDefault(); $('#gkBody [data-act="say"]').click(); } });

  /* ---------- サーバーからのお知らせ ---------- */
  function push(m) {
    if (m.kind === 'say') { if (window.TICKER) window.TICKER.gpush(m.item); if (G) { G.chat = [m.item].concat(G.chat.filter(c => c.id !== m.item.id)).slice(0, 40); if (tab === 'home') render(); } return; }
    if (m.kind === 'call') {
      calls = [m.call].concat(calls.filter(c => c.id !== m.call.id));
      P.toast(`${m.text}（碁会所 → マッチ）`, 4500); P.sound('ok');
      render(); return;
    }
    if (m.kind === 'calldrop') { calls = calls.filter(c => c.id !== m.id); P.toast(m.text); render(); return; }
    if (m.text) P.toast(m.text, 4000);
    if (m.kind === 'kicked') { setG(null); tab = 'home'; render(); return; }
    req('me', {}, () => render());
  }
  // 対局が始まったら、ランダムの待ちはおしまい
  document.addEventListener('kuro9screen', e => { if (e.detail === 'game') seeking = false; if (e.detail === 'pvp' && P.online()) req('me', {}); });
  // つながったら一度、自分の碁会所を読みこむ（一言の欄・対人戦の画面のため）
  let loaded = false;
  setInterval(() => { if (!loaded && P.online()) { loaded = true; req('me', {}, r => { if (!r.ok) loaded = false; }); } }, 2500);

  $('#openGuild').onclick = () => { P.sound('stone'); openGuild('home', 'home'); };
  $('#goGuild').onclick = () => { P.sound('stone'); openGuild(G ? 'match' : 'home', 'pvp'); };
  window.GUILD = {
    open: openGuild, push, info: () => G,
    say(text, cb) { req('say', { text }, r => { if (!r.ok) fail(r); if (cb) cb(r); }); },
    frown(id, cb) { req('frown', { id }, r => { if (!r.ok) fail(r); if (cb) cb(r); }); }
  };
})();
