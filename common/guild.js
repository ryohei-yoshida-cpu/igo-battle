/* 共通：ギルド（囲碁は「碁会所」、将棋は「将棋サロン」、麻雀は「雀荘」。ゲームごとに別）
 *   50局で開く。つくった人がマスター。マスターは店長を1人えらべる。20人まで。
 *   碁会所   … メンバー（オンライン・今月の勝ち）・50銭おすそわけ（1日5人まで）・店長の任命・追放・リコール・抜ける
 *   マッチ   … 碁会所内のランダムマッチ／「マッチを呼ぶ」（相手をえらんでハンデを決める）／「マッチに入る」（OK か、ハンデの変更を提案）
 *   ミッション … 碁会所みんなの対局数で、ひとりずつ受け取れる銭（1日ごと・1週間ごと）
 *   ランキング … 月の「自分の強さ以上の相手への勝ち数」で碁会所どうしの順位。上位にトロフィーと銭
 *   一言     … 画面の一番上の一行をタップ → 下の欄から、碁会所のみんなに一言（☹️ はマスター・店長だけが数を見られる）
 * 画面：タブではなく、入ると「看板（碁会所の名前）」→「マスターの全身アバター＋マスターからのお知らせ」→「マッチ・ミッション・メンバー・ランキング」→「掲示板」とスクロール
 *   掲示板は投稿者のアイコンとタイトルだけ。タップでスレッド（投稿者のアバター・タイトル・本文・コメント）
 *   お知らせの [[番号]] は、その掲示板へのリンク（[[番号:挨拶はこちら]] で文字も変えられる）
 * kids碁会所（15歳以下）：看板・マスターのアバター＋「いらっしゃい」・ミッションだけ
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
    turn: '相手の返事を待っています', off: '相手がオンラインではありません', busy: 'どちらかが対局中です', net: 'つながっていません', auth: 'アカウントが必要です',
    short: '省略名（3文字まで）を入れてください', lvl: '段級位の条件に届いていません', invite: '招待された人だけが入れる碁会所です', applied: 'もう申請しています',
    blocked: 'ブロックしているか、されているので招待できません', zeni: '銭が足りません', ticket: 'アナウンス券がありません', num: '金額を入れてください', room: '部屋を保存できませんでした', kid: '15歳以下の人は使えません', kidto: 'その人は15歳以下なので招待できません', kids: 'kids碁会所では使えません', kidsonly: '15歳以下の人の碁会所です',
    birth: '先に生年月日を登録してください', mpost: 'この碁会所では、スレッドはマスター・店長だけが立てられます', denied: 'この碁会所では使えないように設定されています', nocmt: 'このスレッドはコメントなしです', noinv: 'その人は碁会所の勧誘を受けない設定です', theirs: 'その人は、もうほかの碁会所に入っています', invited: 'もう招待しています', talkoff: 'この碁会所は会話なしの設定です', board: '掲示板は使わない設定です'
  };
  const why = r => r && r.reason === 'wait' ? `連続では書きこめません。あと${r.sec >= 60 ? Math.ceil(r.sec / 60) + '分' : r.sec + '秒'}待ってください` : WHY[r && r.reason] || 'うまくいきませんでした';
  const ROLE = { master: 'マスター', manager: '店長', member: '' };
  // タグ
  const LVLS = [['beg', '初心者歓迎']].concat([10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map(n => ['k' + n, n + '級以上のみ']), [1, 2, 3, 4].map(n => ['d' + n, ['初', '二', '三', '四'][n - 1] + '段以上のみ']));
  const LVL_NAME = Object.fromEntries(LVLS);
  const SETS = {
    join: [['open', '誰でも歓迎'], ['apply', '申請歓迎'], ['invite', '招待のみ']],
    talk: [['on', 'わいわいしよう'], ['off', '碁会所内の会話なし']],
    idle: [['keep', '自動バイバイしない'], ['bye', '非活動はバイバイ']],
    board: [['on', '碁会所掲示板を有効'], ['off', '掲示板は使わない']],
    mpost: [['on', 'メンバーの掲示板投稿を許可'], ['off', 'スレッドはマスター・店長だけ']],
    cmt: [['on', 'コメントあり'], ['off', 'コメントなし']],
    notify: [['none', '通知なし'], ['past', '書きこんだメンバーに通知'], ['me', '自分にだけ通知'], ['all', '碁会所みんなに通知']]
  };
  const kidNow = () => !!(window.AGE && window.AGE.kid());
  const tagName = (k, v) => (SETS[k].find(x => x[0] === v) || [])[1] || '';
  const tags = set => set ? `<span class="gk-tags"><i class="lv">${esc(LVL_NAME[set.lvl] || '初心者歓迎')}</i><i>${tagName('join', set.join)}</i><i>${tagName('talk', set.talk)}</i>${set.idle === 'bye' ? '<i>非活動はバイバイ</i>' : ''}${set.board === 'on' ? '<i>掲示板</i>' : ''}</span>` : '';
  // つくる・設定の入力欄
  function setForm(g, create) {
    const v = g || { name: '', short: '', pr: '', set: { lvl: 'beg', join: 'open', talk: 'on', idle: 'keep', board: 'on', mpost: 'on' } };
    if (kidNow()) return `<div class="sc-sec gk-form" id="gkForm">
      <label class="gk-pick"><small>名前（12字まで）</small><input type="text" class="gk-in" id="gfName" maxlength="12" placeholder="例：ひよこ碁会所"></label>
      <label class="gk-pick"><small>省略名（3文字まで）</small><input type="text" class="gk-in" id="gfShort" maxlength="3" placeholder="例：ひよこ"></label>
      <button type="button" class="btn primary" data-act="create">この名前でkids碁会所をつくる</button>
      <small class="gk-note">kids碁会所は、15歳以下の人だけが入れます。みんなで対局すると、ミッションのごほうびがもらえます。</small></div>`;
    const chips = (k, list) => `<div class="chips gk-set" role="radiogroup" data-k="${k}">${list.map(([x, t]) => `<button type="button" role="radio" data-setv="${x}" aria-checked="${v.set[k] === x}">${t}</button>`).join('')}</div>`;
    return `<div class="sc-sec gk-form" id="gkForm">
      ${create ? `<label class="gk-pick"><small>名前（12字まで）</small><input type="text" class="gk-in" id="gfName" maxlength="12" value="${esc(v.name)}" placeholder="例：ヤブシラズ碁会所"></label>` : ''}
      <label class="gk-pick"><small>省略名（3文字まで。一言の名前の前につきます：例「ヤブシ:こはる」）</small><input type="text" class="gk-in" id="gfShort" maxlength="3" value="${esc(v.short)}" placeholder="例：ヤブシ"></label>
      <div class="gk-pick"><small>強さ（おすすめに出る条件になります）</small><select class="select" id="gfLvl">${LVLS.map(([x, t]) => `<option value="${x}"${v.set.lvl === x ? ' selected' : ''}>${t}</option>`).join('')}</select></div>
      <div class="gk-pick"><small>入会のしかた</small>${chips('join', SETS.join)}<span class="gk-note">誰でも歓迎：申請したらすぐ入会／申請歓迎：マスター・店長が承認したら入会（申請はメッセージに届きます）／招待のみ：招待された人だけ（招待はどの設定でもできます）</span></div>
      <div class="gk-pick"><small>碁会所内の会話</small>${chips('talk', SETS.talk)}<span class="gk-note">会話なしにすると、一言コメントに碁会所の一言が出ません（昇級などのお知らせは出ます）</span></div>
      <div class="gk-pick"><small>来なくなった人</small>${chips('idle', SETS.idle)}<span class="gk-note">非活動はバイバイ：1か月以上ログインしていない人は、自動で退会します</span></div>
      <div class="gk-pick"><small>掲示板</small>${chips('board', SETS.board)}${chips('mpost', SETS.mpost)}</div>
      <label class="gk-pick"><small>勧誘メッセージ（60字まで）</small><textarea class="gk-in" id="gfPr" maxlength="60" rows="2" placeholder="例：のんびり打てる人、大歓迎！">${esc(v.pr)}</textarea></label>
      ${create ? '<label class="gk-annchk"><input type="checkbox" id="gfAnn" checked> 作成したことを全国に通知する（「碁会所「〇〇」ができました！ 仲間を募集中です」と、みんなの一言コメント欄に出ます）</label>' : ''}
      <button type="button" class="btn primary" data-act="${create ? 'create' : 'saveset'}">${create ? 'この内容で碁会所をつくる' : '設定を保存する'}</button>
      ${create ? '<small class="gk-note">つくった人が「マスター」になります。</small>' : ''}
    </div>`;
  }
  function readForm() {
    const f = $('#gkForm'), val = k => { const b = f.querySelector(`[data-k="${k}"] [aria-checked="true"]`); return b ? b.dataset.setv : undefined; };
    const q = s => f.querySelector(s);
    return { name: q('#gfName') ? q('#gfName').value.trim() : undefined, short: q('#gfShort').value.trim(), pr: q('#gfPr') ? q('#gfPr').value.trim() : '',
      lvl: q('#gfLvl') ? q('#gfLvl').value : 'beg', ann: !!(q('#gfAnn') && q('#gfAnn').checked), join: val('join'), talk: val('talk'), idle: val('idle'), board: val('board'), mpost: val('mpost'), notice: G ? G.notice : undefined };
  }
  let recs = null, making = false, board = null, bOpen = null, thread = null, editNotice = false;

  let G = null, tab = 'home', calls = [], seeking = false, rank = null, list = null, back = 'home', open = null, busy = false;
  // 呼ぶとき・ハンデを提案するときの手合い：mode even 互先 / me 自分がもらう / them 相手がもらう / auto 階級差で
  const hcSt = { mode: 'auto', h: 1, min: 5, size: 9, pid: '' };
  try { Object.assign(hcSt, JSON.parse(localStorage.getItem('kuro9.gkhc') || '{}')); } catch (e) {}
  const keepHc = () => { try { localStorage.setItem('kuro9.gkhc', JSON.stringify(hcSt)); } catch (e) {} };
  // 新しいスレッドの設定（前回のを覚えておく）
  const postSt = { cmt: 'on', notify: 'past' };
  try { Object.assign(postSt, JSON.parse(localStorage.getItem('kuro9.gkpost') || '{}')); } catch (e) {}

  const req = (op, data, cb) => P.guild(op, data, r => { if (r && r.guild !== undefined) setG(r.guild); if (r && typeof r.noinv === 'boolean' && !!S.noGkInv !== r.noinv) { S.noGkInv = r.noinv; } if (cb) cb(r); });
  function setG(g) {
    G = g;
    if (window.TICKER) window.TICKER.guild(g && !g.kids ? g.chat : null, g && (g.role === 'master' || g.role === 'manager'));
    const sub = $('#goGuildSub');
    if (sub) sub.textContent = g ? `「${g.name}」の仲間と一局。オンライン ${g.members.filter(m => m.on && !m.me).length}人` : '碁会所の仲間と一局。ランダム・呼びかけ（ハンデ戦もできる）';
  }
  const AV = () => window.AVATAR;
  const fig = av => AV().svg(av || AV().PRESETS.girl);
  const icon = av => AV().thumb(av || AV().PRESETS.girl, 'icon');
  const dt = t => { const d = new Date(t); return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`; };

  /* ---------- 画面 ---------- */
  // tab：home（入口）/ thread（スレッド）/ post（スレッドを立てる）/ match / mission / members / rank
  function openGuild(t, from) {
    if (from) back = from;
    let find = null;
    if (t) { const [k, v] = String(t).split(':'); tab = k === 'board' ? (v ? 'thread' : 'home') : k === 'find' ? 'home' : k; if (k === 'board' && v) bOpen = +v; if (k === 'find') find = v; }
    P.showScreen('guild');
    $('#gkZeni').textContent = `${(S.zeni | 0).toLocaleString()} 銭`;
    if (!P.online()) { G = null; $('#gkBody').innerHTML = `<p class="rm-help">${WHY.offline}。</p>`; return; }
    if (!G) $('#gkBody').innerHTML = '<p class="rm-help">読みこみ中……</p>';
    req('me', {}, r => {
      if (!r.ok) { $('#gkBody').innerHTML = `<p class="rm-help">${why(r)}</p>`; return; }
      render();
      if (G && tab === 'match') loadCalls();
      if (G && tab === 'thread' && bOpen) loadThread(bOpen);
      if (G && !G.kids && G.set.board === 'on') loadBoard();
      if (tab === 'rank') loadRank();
      if (!G) { making = false; P.guild('rec', {}, r2 => { recs = r2.ok ? r2.list : []; render(); }); if (find) P.guild('list', { q: find }, r3 => { list = r3.ok ? r3.list : []; render(); }); }
      if (G && G.kids) loadRank();
    });
  }
  function go(t) { tab = t; open = null; render(); const sc = $('#guild'); if (sc) sc.scrollTop = 0; window.scrollTo(0, 0); }
  function render() {
    if ($('#guild').hidden) return;
    $('#gkTitle').textContent = G ? (G.kids ? 'kids碁会所' : '碁会所') : WORD;
    $('#gkTabs').hidden = true;
    const body = $('#gkBody');
    body.classList.toggle('gk-kids', !!(G && G.kids));
    if (!G) { body.innerHTML = joinView(); return; }
    if (G.kids) { body.innerHTML = kidsView(); return; }
    const sub = { match: matchView, mission: missionView, rank: rankView, members: membersView, thread: threadView, post: postView }[tab];
    body.innerHTML = sub ? `<button type="button" class="gk-backbar" data-go="home">← ${esc(G.name)}へもどる</button>${sub()}` : homeView();
  }

  // 入っていない：おすすめ・さがす・つくる
  const gkCard = x => `<li class="gk-card"><div><b>${esc(x.name)}${x.short ? `<small class="gk-short">${esc(x.short)}</small>` : ''}</b>${x.kids ? '<span class="gk-tags"><i class="lv">kids</i></span>' : tags(x.set)}${x.pr ? `<p>「${esc(x.pr)}」</p>` : ''}<small>ID ${esc(x.id)}・${x.n}/20人・オンライン ${x.on | 0}人${x.kids ? '' : `・今月 ${x.wins}勝`}</small></div>
    ${x.n >= 20 ? '<em>満員</em>' : x.set && x.set.join === 'invite' ? '<em>招待のみ</em>' : `<button type="button" class="btn primary small" data-join="${esc(x.id)}">${x.set && x.set.join === 'apply' ? '申請する' : '入る'}</button>`}</li>`;
  function joinView() {
    const kid = kidNow();
    if (making) return `<div class="gk-sign"><div class="gk-sign-board"><small>${kid ? 'kids碁会所' : '碁会所'}</small><b>つくる</b></div></div>${setForm(null, true)}<button type="button" class="btn lac small" data-act="unmake">もどる</button>`;
    let h = `<div class="gk-sign"><div class="gk-sign-board"><i class="gk-st b"></i><i class="gk-st w"></i><small>${kid ? 'kids' : 'ようこそ'}</small><b>${kid ? 'kids碁会所' : '碁会所'}</b><span>${kid ? '15歳以下の人だけの碁会所です。みんなで打って、ミッションのごほうびをもらおう！' : '仲間と集まって打つ場所です（20人まで）'}</span></div></div>`;
    h += `<div class="gk-panel"><h3>おすすめの${kid ? 'kids' : ''}碁会所</h3>${recs ? (recs.length ? `<ul class="gk-list">${recs.map(gkCard).join('')}</ul>` : `<p class="gk-note">いま入れるおすすめの${kid ? 'kids' : ''}碁会所がありません。つくってみませんか？</p>`) : '<p class="gk-note">読みこみ中……</p>'}</div>`;
    h += `<div class="gk-panel"><h3>さがす</h3><div class="sc-line"><input type="text" id="gkQ" maxlength="20" placeholder="名前か ID（6文字）"><button type="button" class="btn lac small" data-act="search">さがす</button></div>`;
    h += list ? (list.length ? `<ul class="gk-list">${list.map(gkCard).join('')}</ul>` : '<p class="gk-note">見つかりませんでした。</p>') : '';
    h += `</div><button type="button" class="btn primary gk-make" data-act="make">＋ ${kid ? 'kids碁会所' : '碁会所'}をつくる</button>`;
    return h;
  }
  // 看板（碁盤の木目に、碁会所の名前）
  function sign(g) {
    const on = g.members.filter(m => m.on).length;
    return `<div class="gk-sign"><div class="gk-sign-board"><i class="gk-st b"></i><i class="gk-st w"></i><small>${g.kids ? 'kids碁会所' : '碁会所'}</small><b>${esc(g.name)}</b><span>${g.short ? `「${esc(g.short)}」・` : ''}${g.members.length}/${g.max}人・オンライン ${on}人${g.kids ? '' : `・今月 ${g.wins}勝`}</span></div></div>`;
  }
  // 碁会所の部屋（看板の下）・碁会所の銭（寄付）・アナウンス券
  function roomBox(g) {
    if (!g.groom || !window.ROOM) return '';
    const boss = g.role === 'master' || g.role === 'manager';
    let h = `<div class="gk-room"><button type="button" class="gk-room-view" data-act="groom" aria-label="碁会所の部屋に入る">${window.ROOM.miniOf(g.groom.room, null)}<span>碁会所の部屋に入る ›</span></button>
      <div class="gk-pool"><span>碁会所の銭 <b>${(g.zeni | 0).toLocaleString()}</b>${g.donated ? `<small>（あなたの寄付 ${g.donated.toLocaleString()}）</small>` : ''}</span><button type="button" class="btn primary small" data-act="donateopen">寄付する</button>${boss ? `<button type="button" class="btn lac small" data-act="annopen">📣 アナウンス（券 ${g.tickets | 0}枚）</button>` : ''}</div>`;
    if (open === 'donate') h += `<div class="gk-pool-form"><input type="number" class="gk-in" id="gkDon" min="10" step="10" placeholder="寄付する銭（10〜）"><button type="button" class="btn primary small" data-act="donate">寄付</button><small class="gk-note">寄付した銭は碁会所のものになり、戻せません。マスターと店長が、部屋の家具やアナウンス券に使います（今 ${(S.zeni | 0).toLocaleString()} 銭持っています）。</small></div>`;
    if (open === 'ann') h += g.tickets > 0 ? `<div class="gk-pool-form"><textarea class="gk-in" id="gkAnn" maxlength="60" rows="2" placeholder="全国へのお知らせ（60字まで）"></textarea><button type="button" class="btn primary small" data-act="ann">券を1枚使ってアナウンス</button><small class="gk-note">みんなの一言コメント欄のお知らせに出ます。</small></div>`
      : `<div class="gk-pool-form"><small class="gk-note">アナウンス券がありません。碁会所の部屋の「ショップ」で、ミケとこむぎが売っています（碁会所の銭 5,000）。</small><button type="button" class="btn lac small" data-act="groom">碁会所の部屋へ</button></div>`;
    return h + '</div>';
  }
  // マスターの全身アバター＋お知らせ
  function host(g, noticeHtml) {
    const m = g.master || {};
    return `<div class="gk-host"><div class="gk-master" ${m.pid ? `data-visit="${esc(m.pid)}"` : ''}><div class="gk-master-fig">${fig(m.av)}</div><em>マスター</em><b>${esc(m.name || '')}</b></div>
      <div class="gk-notice"><h3>マスターからのお知らせ</h3>${noticeHtml}</div></div>`;
  }
  // お知らせの本文：[[番号]] / [[番号:文字]] は掲示板へのリンク
  function noticeHtml(text) {
    if (!text) return '<p class="gk-notice-empty">（まだお知らせはありません）</p>';
    const ths = (board && board.threads) || [];
    return '<p>' + esc(text).replace(/\[\[(\d{1,6})(?::([^\]]{1,20}))?\]\]/g, (_, id, label) => {
      const th = ths.find(x => x.id === +id);
      return `<button type="button" class="gk-nlink" data-bopen="${id}">${label || (th ? esc(th.title) : 'スレッド')} ›</button>`;
    }).replace(/\n/g, '<br>') + '</p>';
  }
  function homeView() {
    const g = G, boss = g.role === 'master' || g.role === 'manager';
    let note = noticeHtml(g.notice);
    if (g.role === 'master') note += editNotice ? `<div class="gk-nedit"><textarea class="gk-in" id="gkNotice" maxlength="400" rows="5" placeholder="ルールなど（400字まで）">${esc(g.notice)}</textarea>
      ${board && board.threads.length ? `<select class="select" id="gkNlink"><option value="">掲示板へのリンクを入れる…</option>${board.threads.map(t => `<option value="${t.id}">${esc(t.title)}</option>`).join('')}</select>` : ''}
      <div class="gk-row"><button type="button" class="btn primary small" data-act="savenotice">保存</button><button type="button" class="btn lac small" data-act="nocancel">やめる</button></div></div>`
      : '<button type="button" class="gk-nedit-btn" data-act="editnotice">お知らせを書く</button>';
    let h = sign(g) + roomBox(g) + host(g, note);
    if (g.recall) {
      const r = g.recall;
      h += `<div class="gk-panel hi"><h3>マスターのリコール投票中</h3><p class="gk-note">店長がマスターのリコールをはじめました。賛成 ${r.yes}／必要 ${r.need}（マスターをのぞくメンバーの8割）・反対 ${r.no}</p>
        ${g.role === 'master' ? '<small class="gk-note">マスターは投票できません。</small>' : `<div class="gk-row"><button type="button" class="btn ${r.voted === 'yes' ? 'primary' : 'lac'} small" data-vote="1">賛成</button><button type="button" class="btn ${r.voted === 'no' ? 'primary' : 'lac'} small" data-vote="0">反対</button></div>`}</div>`;
    }
    const nClaim = canClaim().length, nCall = calls.filter(c => c.myTurn).length, nApp = boss && g.apps ? g.apps.length : 0;
    const tile = (k, mark, name, sub, n) => `<button type="button" class="gk-tile" data-go="${k}"><i class="gk-tile-mark">${mark}</i><b>${name}</b><small>${sub}</small>${n ? `<em>${n}</em>` : ''}</button>`;
    h += `<div class="gk-tiles">${tile('match', '●○', '碁会所内マッチ', 'ランダム・呼びかけ', nCall)}${tile('mission', '◎', 'ミッション', `今日 ${g.day.total}局`, nClaim)}${tile('members', '☗', 'メンバー', `${g.members.length}人・一言・招待`, nApp)}${tile('rank', '冠', 'ランキング', `今月 ${g.wins}勝`, 0)}</div>`;
    if (g.set.board === 'on') {
      h += `<div class="gk-panel gk-boardp"><div class="gk-ph"><h3>碁会所掲示板</h3>${g.canPost ? '<button type="button" class="btn primary small" data-go="post">＋ スレッドを立てる</button>' : ''}</div>`;
      if (!board) h += '<p class="gk-note">読みこみ中……</p>';
      else if (board.err) h += `<p class="gk-note">${why({ reason: board.err })}</p>`;
      else h += `<ul class="gk-threads">${board.threads.length ? board.threads.map(x => `<li><button type="button" data-bopen="${x.id}"><span class="gk-ti" data-visit="${esc(x.pid)}">${icon(x.av)}</span><b>${esc(x.title)}</b>${x.n ? `<small>${x.n}</small>` : ''}</button></li>`).join('') : '<li class="gk-none">まだスレッドはありません</li>'}</ul>`;
      h += '</div>';
    }
    h += `<div class="gk-foot">${g.role === 'master' ? '<button type="button" class="btn lac small" data-go="members">碁会所の設定</button>' : ''}${g.role === 'manager' && !g.recall ? '<button type="button" class="btn lac small" data-act="recall">マスターをリコールする</button>' : ''}<button type="button" class="btn danger small" data-act="leave">碁会所を抜ける</button></div>`;
    return h;
  }
  // kids碁会所：看板・マスターの全身アバター＋「いらっしゃい」・ミッションだけ
  function kidsView() {
    return sign(G) + host(G, `<p class="gk-kids-hi">${esc(G.notice || 'いらっしゃい')}</p>`) + `<div class="gk-panel"><h3>ミッション</h3>${missionView()}</div><div class="gk-panel"><h3>ランキング</h3>${rankView()}</div>
      <div class="gk-foot"><button type="button" class="btn danger small" data-act="leave">碁会所を抜ける</button></div>`;
  }
  /* ---------- 掲示板 ---------- */
  function loadBoard() { req('threads', {}, r => { board = r.ok ? r : { threads: [], err: r.reason }; render(); }); }
  function loadThread(id) { thread = null; req('thread', { tid: id }, r => { if (r.ok) { board = r; thread = r.thread; } else { P.toast(why(r)); tab = 'home'; } render(); }); }
  function threadView() {
    const th = thread;
    if (!th) return '<p class="rm-help">読みこみ中……</p>';
    const del = (it, rid) => (it.pid === board.me || board.boss) ? `<button type="button" class="sc-x" data-bdel="${th.id}" data-rid="${rid || ''}">消す</button>` : '';
    const nt = (SETS.notify.find(x => x[0] === th.notify) || [])[1] || '';
    const canC = th.cmt === 'on' && G.canCmt && !kidNow();
    return `<div class="gk-thv"><div class="gk-thv-fig" data-visit="${esc(th.pid)}">${fig(th.av)}<b>${esc(th.name)}</b></div>
        <div class="gk-thv-main"><h3>${esc(th.title)}</h3><p>${esc(th.text)}</p><small>${dt(th.t)}・${th.cmt === 'on' ? 'コメントあり' : 'コメントなし'}・${nt}</small>${del(th)}</div></div>
      ${th.cmt === 'on' ? `<div class="gk-panel"><h3>コメント（${th.replies.length}）</h3><ul class="gk-replies">${th.replies.length ? th.replies.map(x => `<li><span class="gk-ti" data-visit="${esc(x.pid)}">${icon(x.av)}</span><div><small>${esc(x.name)}・${dt(x.t)}</small><p>${esc(x.text)}</p>${del(x, x.id)}</div></li>`).join('') : '<li class="gk-none">まだコメントはありません</li>'}</ul>
        ${canC ? `<textarea class="gk-in" id="gbReply" maxlength="300" rows="3" placeholder="コメント（300字まで）"></textarea><button type="button" class="btn primary small" data-breply="${th.id}">コメントする</button><small class="gk-note">コメントは10分に1回までです。</small>` : `<p class="gk-note">${G.canCmt ? '' : 'この碁会所では、あなたはコメントできない設定です。'}</p>`}</div>` : ''}`;
  }
  function postView() {
    const chips = (k, v) => `<div class="chips gk-set" role="radiogroup" data-pk="${k}">${SETS[k].map(([x, t]) => `<button type="button" role="radio" data-postv="${x}" aria-checked="${v === x}">${t}</button>`).join('')}</div>`;
    return `<div class="gk-panel gk-form"><h3>スレッドを立てる</h3>
      <input type="text" class="gk-in" id="gbTitle" maxlength="30" placeholder="タイトル（30字まで）">
      <textarea class="gk-in" id="gbText" maxlength="300" rows="5" placeholder="本文（300字まで）"></textarea>
      <div class="gk-pick"><small>コメント</small>${chips('cmt', postSt.cmt)}<span class="gk-note">コメントありにすると、碁会所のメンバーだれでもコメントできます。</span></div>
      <div class="gk-pick"><small>コメントがついたときの通知（一言コメント欄に出ます）</small>${chips('notify', postSt.notify)}</div>
      <button type="button" class="btn primary" data-act="bpost">立てる</button><small class="gk-note">スレッドは1人1時間に1回まで、コメントは10分に1回までです。</small></div>`;
  }

  function membersView() {
    const g = G, boss = g.role === 'master' || g.role === 'manager';
    let h = `<div class="gk-info"><span>ID <b>${esc(g.id)}</b></span><span>${g.members.length}/${g.max}人</span>${g.role !== 'member' ? `<em class="gk-role ${g.role}">${ROLE[g.role]}</em>` : ''}</div>`;
    h += `<div class="gk-panel"><h3>メンバー</h3><small class="gk-note">50銭おすそわけ：今日 ${g.gave.length}/5人（運営から出ます。もらえるのは1人1日3回まで）${boss ? '・☹️ はみんなが「やだなぁ」と押した数（マスターと店長だけに見えます）' : ''}</small><ul class="gk-mem">`;
    for (const m of g.members.slice().sort((a, b) => (b.on - a.on) || ({ master: 2, manager: 1, member: 0 }[b.role] - { master: 2, manager: 1, member: 0 }[a.role]) || b.wins - a.wins)) {
      const gave = g.gave.includes(m.pid), canKick = boss && m.role === 'member' && !m.me, openRow = open === m.pid, canDeny = boss && m.role !== 'master' && !m.me;
      h += `<li class="${m.on ? 'on' : ''}${m.me ? ' me' : ''}">
        <span class="gk-av" data-visit="${esc(m.pid)}">${icon(m.av)}<i class="gk-dot${m.busy ? ' busy' : ''}"></i></span>
        <span class="gk-who"><b>${esc(m.name)}${m.me ? '（自分）' : ''}</b><small>${m.role !== 'member' ? `<em class="gk-role ${m.role}">${ROLE[m.role]}</em>` : ''}今月 ${m.wins}勝${m.on ? (m.busy ? '・対局中' : '・オンライン') : ''}${m.frown != null && m.frown ? `・<span class="gk-frown">☹️${m.frown}</span>` : ''}${m.noPost ? '・<span class="gk-frown">投稿拒否</span>' : ''}${m.noCmt ? '・<span class="gk-frown">コメント拒否</span>' : ''}</small></span>
        ${m.me ? '' : `<span class="gk-acts">${gave ? '<em>おくった</em>' : `<button type="button" class="btn primary small" data-give="${esc(m.pid)}">50銭</button>`}<button type="button" class="btn lac small" data-more="${esc(m.pid)}" aria-label="ほかの操作">…</button></span>`}
        ${openRow ? `<div class="gk-more"><button type="button" class="btn lac small" data-visit="${esc(m.pid)}">部屋へ</button><button type="button" class="btn lac small" data-mailto="${esc(m.pid)}" data-name="${esc(m.name)}">✉️</button>${m.on && !m.busy ? `<button type="button" class="btn lac small" data-callto="${esc(m.pid)}">マッチを呼ぶ</button>` : ''}${g.role === 'master' ? (m.role === 'manager' ? '<button type="button" class="btn lac small" data-boss="">店長をやめてもらう</button>' : `<button type="button" class="btn lac small" data-boss="${esc(m.pid)}">店長にする</button>`) : ''}${canDeny ? `<button type="button" class="btn lac small" data-deny="post" data-pid="${esc(m.pid)}" data-on="${m.noPost ? '' : '1'}">${m.noPost ? '掲示板投稿の拒否を解除' : '掲示板投稿を拒否'}</button><button type="button" class="btn lac small" data-deny="cmt" data-pid="${esc(m.pid)}" data-on="${m.noCmt ? '' : '1'}">${m.noCmt ? 'コメントの拒否を解除' : 'コメントを拒否'}</button>` : ''}${canKick ? `<button type="button" class="btn danger small" data-kick="${esc(m.pid)}">追放</button>` : ''}</div>` : ''}
      </li>`;
    }
    h += '</ul></div>';
    if (boss && g.apps && g.apps.length) h += `<div class="gk-panel hi"><h3>入会申請（${g.apps.length}）</h3><ul class="gk-list">${g.apps.map(a => `<li><span><b>${esc(a.name)}</b><small>部屋番号 ${esc(a.pid)}</small></span><button type="button" class="btn lac small" data-visit="${esc(a.pid)}">部屋へ</button><button type="button" class="btn primary small" data-approve="${esc(a.pid)}">承認</button><button type="button" class="btn lac small" data-reject="${esc(a.pid)}">おことわり</button></li>`).join('')}</ul></div>`;
    h += `<div class="gk-panel"><h3>招待する</h3><div class="sc-line"><input type="text" id="gkInv" inputmode="numeric" maxlength="6" placeholder="相手の部屋番号（6けた）"><button type="button" class="btn primary small" data-act="invite">招待</button></div><small class="gk-note">招待は相手のメッセージに届きます。相手の部屋の「この人」からも招待できます。</small></div>`;
    if (g.set && g.set.talk === 'off') h += '<p class="gk-note">この碁会所は「碁会所内の会話なし」の設定です。</p>';
    else h += `<div class="gk-panel"><h3>一言（碁会所のみんなへ）</h3><div class="sc-line"><input type="text" id="gkSay" maxlength="40" placeholder="一言（40字まで）"><button type="button" class="btn primary small" data-act="say">送る</button></div>
      <ul class="gk-chat">${g.chat.length ? g.chat.slice(0, 15).map(chatLi).join('') : '<li class="gk-none">まだ一言はありません</li>'}</ul><small class="gk-note">画面の一番上の一行をタップしても、一言を送れます。</small></div>`;
    h += `<div class="gk-panel"><h3>碁会所の設定</h3>${tags(g.set)}${g.set.mpost === 'off' ? '<span class="gk-tags"><i>スレッドはマスター・店長だけ</i></span>' : ''}<p class="gk-note">省略名「${esc(g.short || '')}」${g.pr ? `・勧誘「${esc(g.pr)}」` : ''}</p>${g.role === 'master' ? (open === 'set' ? setForm(g, false) : '<button type="button" class="btn lac small" data-act="editset">設定を変える</button>') : ''}</div>`;
    return h;
  }
  function chatLi(c) {
    const boss = G && (G.role === 'master' || G.role === 'manager');
    return `<li><b>${c.gs ? esc(c.gs) + ':' : ''}${esc(c.name)}</b><span>${esc(c.text)}</span>${c.mine ? '' : `<button type="button" class="gk-fr${c.frowned ? ' on' : ''}" data-frown="${c.id}" aria-label="やだなぁ">☹️${boss && c.frown ? c.frown : ''}</button>`}</li>`;
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
    for (const [k, name, need, zeni, per] of MISSIONS.filter(x => !(G.kids && x[0] === 'inner'))) {   // kids碁会所に碁会所内マッチはない
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
    const mem = G ? G.members.slice().sort((a, b) => b.wins - a.wins) : [];
    let h = G ? `<div class="gk-panel"><h3>碁会所内ランキング（今月）</h3><ol class="gk-rank">${mem.map((m, i) => `<li class="${m.me ? 'me' : ''}"><span class="gk-no">${m.wins ? i + 1 : '−'}</span><span><b>${esc(m.name)}</b><small>${ROLE[m.role] || 'メンバー'}</small></span><span class="gk-w">${m.wins}勝</span><small class="gk-p"></small></li>`).join('')}</ol></div><h3 class="gk-h3">碁会所対抗ランキング</h3>` : '';
    h += `<p class="gk-note gk-lead">月ごとに、碁会所のメンバーが「自分の強さ以上」の相手にランダムマッチで勝った数を合計してきそいます（キャラクター戦は数えません）。1位は10000銭、上位5%にはトロフィー（家具）、最下位でも300銭。銭はメンバーの勝ち数に応じて山分け（マスターは1.3倍の重み）。</p>`;
    h += '<ol class="gk-rank">' + (rank.list.length ? rank.list.map(x => `<li class="${x.id === (G && G.id) ? 'me' : ''}"><span class="gk-no">${x.rank || '−'}</span><span><b>${esc(x.name)}</b><small>${x.n}人</small></span><span class="gk-w">${x.wins}勝</span><small class="gk-p">${x.prize ? `${x.prize.zeni.toLocaleString()}銭${x.prize.trophy ? '🏆' : ''}` : ''}</small></li>`).join('') : '<li class="gk-none">まだ碁会所がありません</li>') + '</ol>';
    if (rank.last && rank.last.top && rank.last.top.length) h += `<div class="sc-sec"><b>先月の結果</b><ol class="gk-rank small">${rank.last.top.slice(0, 5).map(x => `<li><span class="gk-no">${x.rank}</span><span><b>${esc(x.name)}</b></span><span class="gk-w">${x.total}勝</span><small class="gk-p">${x.zeni.toLocaleString()}銭</small></li>`).join('')}</ol></div>`;
    return h;
  }

  /* ---------- 操作 ---------- */
  const fail = r => { P.sound('bad'); P.toast(why(r)); };
  $('#gkBack').onclick = () => { P.sound('tap'); if (seeking) { seeking = false; P.guild('gunseek', {}); } if (back === 'pvp') P.openPvp(); else { P.showScreen('home'); P.renderHome(); } };
  $('#gkBody').addEventListener('click', e => {
    const vis = e.target.closest('[data-visit]');
    if (vis && vis.tagName !== 'BUTTON' && vis.dataset.visit) { e.stopPropagation(); P.sound('stone'); window.ROOM.visit(vis.dataset.visit); return; }   // アバター・アイコンをタップ → その人の部屋
    const b = e.target.closest('button'); if (!b || b.disabled || busy) return;
    const d = b.dataset;
    const done = (r, msg) => { busy = false; if (!r.ok) { fail(r); render(); return; } if (msg) P.toast(msg); P.sound('ok'); render(); };
    const go_ = (op, data, msg, cb) => { busy = true; req(op, data, r => { done(r, msg); if (cb && r.ok) cb(r); }); };
    if (d.go) {
      P.sound('stone'); go(d.go);
      if (d.go === 'match') loadCalls(); else if (d.go === 'rank') loadRank(); else if (d.go === 'home') { req('me', {}, () => render()); if (G.set.board === 'on') loadBoard(); } else req('me', {}, () => render());
      return;
    }
    if (d.bopen) { P.sound('tap'); bOpen = +d.bopen; thread = null; go('thread'); loadThread(bOpen); return; }
    if (d.postv) { P.sound('tap'); for (const x of b.parentElement.children) x.setAttribute('aria-checked', String(x === b)); postSt[b.parentElement.dataset.pk] = d.postv; try { localStorage.setItem('kuro9.gkpost', JSON.stringify(postSt)); } catch (e) {} return; }
    if (d.act === 'editnotice') { P.sound('tap'); editNotice = true; render(); return; }
    if (d.act === 'nocancel') { P.sound('tap'); editNotice = false; render(); return; }
    if (d.act === 'savenotice') { go_('notice', { text: $('#gkNotice').value }, 'お知らせを保存しました', () => { editNotice = false; render(); }); return; }
    if (d.deny) { go_('deny', { pid: d.pid, kind: d.deny, on: !!d.on }, d.on ? '拒否しました' : '解除しました'); return; }
    if (d.mailto) { window.MAIL.compose(d.mailto, d.name, 'guild'); return; }
    if (d.act === 'groom') { P.sound('stone'); window.ROOM.openGuild(G); return; }
    if (d.act === 'donateopen' || d.act === 'annopen') { P.sound('tap'); open = open === d.act.replace('open', '') ? null : d.act.replace('open', ''); render(); return; }
    if (d.act === 'donate') {
      const n = Math.floor(+$('#gkDon').value || 0);
      if (n < 10) { P.toast('10銭から寄付できます'); return; }
      if (n > (S.zeni | 0)) { P.toast('銭が足りません'); return; }
      P.confirmBox(`${n.toLocaleString()} 銭を碁会所に寄付しますか？（戻せません）`, () => go_('donate', { n }, `${n.toLocaleString()} 銭を寄付しました。ありがとう！`, r => { if (typeof r.myZeni === 'number') { S.zeni = r.myZeni; P.saveLocal(); } open = null; render(); }), null, { yes: '寄付する', no: 'やめる' });
      return;
    }
    if (d.act === 'ann') { const text = $('#gkAnn').value.trim(); if (!text) return; P.confirmBox('アナウンス券を1枚使って、全国にお知らせしますか？', () => go_('ann', { text }, '全国にアナウンスしました！', () => { open = null; render(); })); return; }
    if (d.act === 'create') { const f = readForm(); if (!f.name) { P.toast(WHY.name); return; } if (!f.short) { P.toast(WHY.short); return; } go_('create', f, `碁会所「${f.name}」をつくりました！ あなたがマスターです`, () => { making = false; }); }
    else if (d.act === 'make') { P.sound('stone'); making = true; render(); $('#gkBody').scrollTop = 0; window.scrollTo(0, 0); }
    else if (d.act === 'unmake') { P.sound('tap'); making = false; render(); }
    else if (d.setv) { P.sound('tap'); for (const x of b.parentElement.children) x.setAttribute('aria-checked', String(x === b)); }
    else if (d.act === 'editset') { P.sound('tap'); open = 'set'; render(); }
    else if (d.act === 'saveset') { const f = readForm(); delete f.name; go_('settings', f, '設定を保存しました', () => { open = null; render(); }); }
    else if (d.act === 'invite') { const pid = $('#gkInv').value.replace(/\D/g, ''); if (pid.length !== 6) { P.toast('部屋番号（6けた）を入れてください'); return; } busy = true; P.guild('invite', { pid }, r => { busy = false; if (!r.ok) { fail(r); return; } P.sound('ok'); P.toast('招待しました（相手のメッセージに届きます）'); $('#gkInv').value = ''; }); }
    else if (d.approve || d.reject) go_(d.approve ? 'approve' : 'reject', { pid: d.approve || d.reject }, d.approve ? '入会を承認しました' : 'おことわりしました');
    else if (d.act === 'bpost') { const title = $('#gbTitle').value.trim(), text = $('#gbText').value.trim(); if (!title || !text) { P.toast('タイトルと本文を入れてください'); return; } busy = true; req('post', { title, text, cmt: postSt.cmt, notify: postSt.notify }, r => { busy = false; if (!r.ok) { fail(r); return; } board = r; thread = r.thread; bOpen = r.thread.id; P.sound('ok'); go('thread'); }); }
    else if (d.breply) { const text = $('#gbReply').value.trim(); if (!text) return; busy = true; req('reply', { tid: +d.breply, text }, r => { busy = false; if (!r.ok) { fail(r); return; } board = r; thread = r.thread; P.sound('ok'); render(); }); }
    else if (d.bdel) P.confirmBox(d.rid ? 'このコメントを消しますか？' : 'このスレッドを消しますか？（コメントもすべて消えます）', () => req('bdel', { tid: +d.bdel, rid: +d.rid || 0 }, r => { if (!r.ok) { fail(r); return; } board = r; if (d.rid) thread = r.thread; else { bOpen = null; thread = null; tab = 'home'; } P.sound('ok'); render(); }));
    else if (d.act === 'search') { P.sound('tap'); P.guild('list', { q: $('#gkQ').value.trim() }, r => { list = r.ok ? r.list : []; render(); }); }
    else if (d.join) { busy = true; req('join', { id: d.join }, r => { busy = false; if (!r.ok) { fail(r); render(); return; } P.sound('ok'); P.toast(r.applied ? '入会を申請しました。承認されるとメッセージが届きます' : '碁会所に入りました！', 3500); render(); }); }
    else if (d.more) { P.sound('tap'); open = open === d.more ? null : d.more; render(); }
    else if (d.give) go_('give', { pid: d.give }, '50銭をおくりました');
    else if (d.visit) { P.sound('stone'); window.ROOM.visit(d.visit); }
    else if (d.callto) { P.sound('stone'); hcSt.pid = d.callto; keepHc(); go('match'); loadCalls(); }
    else if (d.boss !== undefined) { const m = G.members.find(x => x.pid === d.boss); P.confirmBox(d.boss ? `${m ? m.name : ''}さんを店長にしますか？（店長は1人だけ。前の店長は交代します）` : '店長をやめてもらいますか？', () => go_('boss', { pid: d.boss }, d.boss ? '店長をえらびました' : '店長をやめてもらいました')); }
    else if (d.kick) { const m = G.members.find(x => x.pid === d.kick); P.confirmBox(`${m ? m.name : ''}さんを碁会所から追放しますか？`, () => { open = null; go_('kick', { pid: d.kick }, '追放しました'); }, null, { yes: '追放する', no: 'やめる' }); }
    else if (d.act === 'leave') P.confirmBox(G.role === 'master' ? '碁会所を抜けますか？（マスターは店長に、店長がいなければいちばん古いメンバーに引きつがれます）' : '碁会所を抜けますか？', () => go_('leave', {}, '碁会所を抜けました', () => { tab = 'home'; list = null; recs = null; P.guild('rec', {}, r2 => { recs = r2.ok ? r2.list : []; render(); }); }), null, { yes: '抜ける', no: 'やめる' });
    else if (d.act === 'recall') P.confirmBox('マスターのリコール投票をはじめますか？（3日以内に、マスターをのぞくメンバーの8割が賛成すると、マスターは碁会所を外れ、あなたがマスターになります）', () => go_('recall', {}, 'リコール投票をはじめました'));
    else if (d.vote !== undefined) go_('vote', { yes: d.vote === '1' }, d.vote === '1' ? '賛成しました' : '反対しました', r => { if (r.recalled) P.toast('リコールが成立しました', 4000); });
    else if (d.act === 'say') { const text = $('#gkSay').value.trim(); if (!text) return; go_('say', { text }, null, () => { req('me', {}, () => render()); }); }
    else if (d.frown) { P.sound('tap'); req('frown', { id: +d.frown }, r => { if (!r.ok) fail(r); render(); }); }
    else if (d.claim) go_('claim', { k: d.claim }, null, r => { P.toast(`ミッション達成！ ＋${r.gained} 銭`, 3500); });
    else if (d.size) { P.sound('tap'); hcSt.size = +d.size; if (hcSt.size === 13 && hcSt.min < 10) hcSt.min = 10; if (hcSt.size === 9 && hcSt.min > 10) hcSt.min = 5; keepHc(); render(); }
    else if (d.mode) { P.sound('tap'); hcSt.mode = d.mode; keepHc(); render(); }
    else if (d.h) { P.sound('tap'); hcSt.h = +d.h; keepHc(); render(); }
    else if (d.min) { P.sound('tap'); hcSt.min = +d.min; keepHc(); render(); }
    else if (d.act === 'seek') { P.sound('stone'); P.FR.guildMatch(hcSt.size); }
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
  $('#gkBody').addEventListener('change', e => {
    if (e.target.id === 'gkTo') { hcSt.pid = e.target.value; keepHc(); }
    if (e.target.id === 'gkNlink' && e.target.value) {   // お知らせに掲示板のリンクを入れる
      const t = $('#gkNotice'), tok = `[[${e.target.value}]]`, at = t.selectionStart != null ? t.selectionStart : t.value.length;
      t.value = (t.value.slice(0, at) + tok + t.value.slice(at)).slice(0, 400); e.target.value = ''; t.focus();
    }
  });
  $('#gkBody').addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'gkSay') { e.preventDefault(); $('#gkBody [data-act="say"]').click(); } });

  /* ---------- サーバーからのお知らせ ---------- */
  function push(m) {
    if (m.kind === 'say') { if (window.TICKER) window.TICKER.gpush(m.item); if (G) { G.chat = [m.item].concat(G.chat.filter(c => c.id !== m.item.id)).slice(0, 40); if (tab === 'members') render(); } return; }
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
  $('#goGuild').onclick = () => { P.sound('stone'); openGuild(G && !G.kids ? 'match' : 'home', 'pvp'); };
  window.GUILD = {
    open: openGuild, push, info: () => G,
    invite(pid, cb) { P.guild('invite', { pid }, r => { if (!r.ok) fail(r); else { P.sound('ok'); P.toast('碁会所に招待しました（相手のメッセージに届きます）'); } if (cb) cb(r); }); },
    say(text, cb) { req('say', { text }, r => { if (!r.ok) fail(r); if (cb) cb(r); }); },
    frown(id, cb) { req('frown', { id }, r => { if (!r.ok) fail(r); if (cb) cb(r); }); }
  };
})();
