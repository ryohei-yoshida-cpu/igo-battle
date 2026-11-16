/* 共通：画面の一番上の一行（一言コメント＋お知らせ）
 *   ・自分の部屋に書かれた一言コメント
 *   ・お知らせ：キャラが遊びに来た／フレンドが日記を更新した／フレンドの段級位が上がった／対人戦の申込（部屋番号つき）
 *   ・自分のお知らせ：日記を書いた／段級位が上がった／対人戦を申し込んだ
 *   下線の言葉（日記・マイルーム・アバター・部屋番号など）をタップすると、その画面へ。
 *   碁会所に入っていれば、碁会所の一言も流れる。一覧の下の欄から、碁会所のみんなに一言（☹️＝やだなぁ。数はマスター・店長だけに見える）
 *   開くと2段：上は「会話」（一言コメント・碁会所の一言）、下は「通知」（お知らせ・全国のアナウンス）。たたんだ一行には、いちばん新しいものだけ
 *   会話の欄から送れる：送り先は「碁会所」か「フレンド」（フレンド全員／ひとりをえらぶ）。15歳以下は送れない
 *   アイコンをタップすると、その人の部屋へ
 *   表示：設定「一言コメント・お知らせの表示」… すべての画面 / マイルームだけ / 表示しない
 */
(function () {
  'use strict';
  const P = window.APP, S = P.S, A = P.A, AV = window.AVATAR;
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let chat = [], notes = [], ann = [], friends = [], gchat = null, gboss = false, screen = 'home', loaded = false;
  const isTalk = it => it.kind === 'chat' || it.kind === 'gchat';
  const link = (go, text) => `<u data-go="${esc(go)}">${esc(text)}</u>`;
  const myAv = () => S.av || AV.PRESETS.girl;

  function all() {
    const mine = S.settings.tickerMine === false ? [] : (S.myNotes || []).map(n => Object.assign({ kind: 'note', mine: true }, n));   // 自分のお知らせ（設定で出さないこともできる）
    const seen = new Set(notes.map(n => n.id));
    return chat.map(c => Object.assign({ kind: 'chat' }, c)).concat((gchat || []).map(c => Object.assign({}, c, { kind: 'gchat', gid: c.id })), notes, ann.filter(a => !seen.has(a.id)), mine).sort((a, b) => (b.t || 0) - (a.t || 0)).slice(0, 40);
  }
  function icon(it) {
    if (it.type === 'gann') return '<span class="tk-mega" aria-hidden="true">📣</span>';
    if (it.type === 'visit') { const i = A.VARIANTS.findIndex(v => v.key === it.chara); return `<img src="${A.faceUri(Math.max(0, i))}" alt="">`; }
    return AV.thumb(it.mine ? myAv() : (it.av || AV.PRESETS.girl), 'icon');
  }
  function html(it) {
    const nm = (it.gs ? it.gs + ':' : '') + (it.name || '');   // 碁会所に入っている人は「省略名:名前」
    const who = it.pid ? link('room:' + it.pid, nm) : esc(nm);
    if (it.kind === 'chat') return `<b>${who}</b>${esc(it.text)}`;
    if (it.kind === 'gchat') return `<b><i class="tk-gk">碁会所</i>${who}</b>${esc(it.text)}`;
    switch (it.type) {
      case 'visit': return `${esc(it.name)}が${link('room', 'マイルーム')}に遊びに来ました`;
      case 'diary': return `${who}が${link('diary:' + it.pid, '日記')}を更新しました${it.title ? `「${esc(it.title)}」` : ''}`;
      case 'rank': return `${who}の段級位が${esc(it.rank)}に上がりました`;
      case 'invite': return `${who}から対人戦の申込みがあります。部屋番号は${link('join:' + it.code, it.code)}です`;
      case 'mydiary': return `あなたが${link('diary:me', '日記')}を更新しました`;
      case 'myrank': return `あなたの段級位が${link('record', it.rank)}に上がりました`;
      case 'myinvite': return `${esc(it.name)}さんに対人戦を申し込みました。部屋番号は${link('friend', it.code)}です`;
      case 'myavatar': return `あなたの${link('avatar', 'アバター')}を着がえました`;
      case 'freq': return `${who}からフレンド申請が届きました。${link('gift', 'プレゼントボックス')}で許可できます`;
      case 'friendok': return `${who}とフレンドになりました`;
      case 'gboard': return `${who}が碁会所の掲示板にスレッドを立てました${link('guild:board:' + (it.tid || ''), `「${it.title || '掲示板'}」`)}`;
      case 'gcmt': return `${who}が掲示板${link('guild:board:' + (it.tid || ''), `「${it.title || ''}」`)}にコメントしました`;
      case 'gmis': return `碁会所のミッション「${esc(it.name)}」をクリア！ ${link('guild:mission', `${it.zeni | 0}銭を受け取る`)}`;
      case 'gann': return it.fixed ? `${link('guild:find:' + (it.gid || ''), it.text)}` : `${link('guild:find:' + (it.gid || ''), `碁会所「${it.gname || ''}」`)}：${esc(it.text)}`;
      case 'fzeni': return `${who}から100銭が届きました（${link('gift', 'プレゼントボックス')}）`;
    }
    return '';
  }

  function set(list, nlist, fr, an) {
    chat = (list || []).slice(0, 20); if (nlist) notes = nlist.map(n => Object.assign({ kind: 'note' }, n));
    if (fr) friends = fr; if (an) ann = an.map(a => Object.assign({ kind: 'note', type: 'gann' }, a));
    loaded = true; draw();
  }
  function push(it) {
    if (!it) return;
    if (it.kind === 'note') notes = [it].concat(notes.filter(x => x.id !== it.id)).slice(0, 30);
    else chat = [it].concat(chat.filter(x => x.id !== it.id)).slice(0, 20);
    draw(true);
  }
  // 自分のお知らせ（この端末に残す）
  function mine(n) {
    S.myNotes = [Object.assign({ t: Date.now() }, n)].concat(S.myNotes || []).slice(0, 20);
    P.saveLocal(); draw(true);
  }
  function shouldShow() {
    if (document.body.classList.contains('on-title')) return false;
    const mode = (S.settings && S.settings.tickerMode) || 'all';
    if (mode === 'off') return false;
    if (mode === 'all') return true;
    return screen === 'myroom' && !(window.ROOM && window.ROOM.info().guest);
  }
  function draw(fresh) {
    const el = $('#ticker'), show = shouldShow();
    el.hidden = !show;
    document.body.classList.toggle('has-ticker', show);
    if (!show) return;
    const it = all()[0];
    $('#tkAva').innerHTML = it ? icon(it) : '';
    $('#tkText').innerHTML = it ? html(it) : '<span class="tk-empty">一言コメント・お知らせはまだありません</span>';
    const run = $('#tkText');
    run.classList.remove('run'); void run.offsetWidth;
    if (run.scrollWidth > run.parentElement.clientWidth) run.classList.add('run');
    if (fresh) { el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }
    if (!$('#tkList').hidden) list();
  }
  function list() {
    const items = all(), talk = items.filter(isTalk), info = items.filter(it => !isTalk(it));
    const hm = t => { const d = new Date(t); return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`; };
    const key = it => it.mine ? 'mine:' + it.t : (it.kind === 'chat' ? 'chat:' : 'note:') + it.id;
    const side = it => it.kind === 'gchat' ? (it.mine ? '' : `<button type="button" class="tk-fr${it.frowned ? ' on' : ''}" data-frown="${it.gid}" aria-label="やだなぁ">☹️${gboss && it.frown ? it.frown : ''}</button>`)
      : it.type === 'gann' ? '' : `<button type="button" class="tk-del" data-del="${esc(key(it))}" aria-label="消す">✕</button>`;
    const ic = it => it.pid && !it.mine && String(it.pid) !== String(S.pid) ? `<span class="tk-ic" data-go="room:${esc(it.pid)}">${icon(it)}</span>` : `<span class="tk-ic">${icon(it)}</span>`;
    const row = it => `<div class="tk-item${it.kind === 'note' ? ' note' : ''}${it.kind === 'gchat' ? ' gk' : ''}${it.type === 'gann' ? ' ann' : ''}">${ic(it)}<span>${html(it)}</span><time>${hm(it.t)}</time>${side(it)}</div>`;
    // 送り先：碁会所（会話ありの碁会所に入っているとき）／フレンド全員／フレンドひとり
    const kid = window.AGE && window.AGE.kid();
    const tos = (gchat ? [['gk', '碁会所のみんな']] : []).concat(friends.length ? [['fall', 'フレンド全員']].concat(friends.map(f => ['f:' + f.pid, f.name])) : []);
    let to = (S.settings && S.settings.tkTo) || (gchat ? 'gk' : 'fall'); if (!tos.some(x => x[0] === to)) to = tos[0] && tos[0][0];
    const old = $('#tkSay'), typed = old ? old.value : '', focus = old && document.activeElement === old;
    const say = kid ? '<p class="tk-empty">15歳以下の人は、一言コメントを送れません。</p>'
      : tos.length ? `<div class="tk-say"><div class="tk-to"><button type="button" class="tk-seg${to === 'gk' ? ' on' : ''}" data-to="gk" ${gchat ? '' : 'disabled'}>碁会所</button><button type="button" class="tk-seg${to && to !== 'gk' ? ' on' : ''}" data-to="fall" ${friends.length ? '' : 'disabled'}>フレンド</button>${to && to !== 'gk' ? `<select class="select tk-fsel" id="tkFsel">${tos.filter(x => x[0] !== 'gk').map(([k, n]) => `<option value="${esc(k)}"${k === to ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select>` : ''}</div>
          <div class="tk-say-row"><input type="text" id="tkSay" maxlength="40" placeholder="${to === 'gk' ? '碁会所のみんなに一言' : to === 'fall' ? 'フレンド全員に一言' : 'フレンドに一言'}（40字まで）"><button type="button" class="btn primary small" id="tkSend">送る</button></div></div>`
      : '<p class="tk-empty">フレンドか碁会所の仲間ができると、ここから一言を送れます。</p>';
    $('#tkList').innerHTML = `<div class="tk-sec"><b class="tk-h">会話</b>${talk.length ? talk.map(row).join('') : '<p class="tk-empty">まだ会話はありません。</p>'}${say}</div>
      <div class="tk-sec"><b class="tk-h">通知</b>${info.length ? info.map(row).join('') : '<p class="tk-empty">まだお知らせはありません。</p>'}</div>` +
      (items.length ? '<button type="button" class="tk-delall" data-del="all">ぜんぶ消す</button>' : '');
    const inp = $('#tkSay'); if (inp && typed) inp.value = typed; if (inp && focus) inp.focus();
  }

  // 下線の言葉から、その画面へ
  function go(dest) {
    if (screen === 'game') { P.toast('対局が終わってから開けます'); return; }
    $('#tkList').hidden = true;
    const i = dest.indexOf(':'), k = i < 0 ? dest : dest.slice(0, i), v = i < 0 ? '' : dest.slice(i + 1);
    const R = window.ROOM;
    if (k === 'room') { if (v && v !== String(S.pid)) R.visit(v); else R.open(); }
    else if (k === 'diary') { if (v && v !== 'me' && v !== String(S.pid)) R.visit(v); else if (window.DIARY) window.DIARY.openHub(); else R.open('diary'); }
    else if (k === 'avatar') window.AVATAR_UI.open();
    else if (k === 'record') $('#openRecord').click();
    else if (k === 'join') window.FRIEND.joinWith(v);
    else if (k === 'friend') { P.showScreen('friend'); window.FRIEND.open(); }
    else if (k === 'gift') $('#openGift').click();
    else if (k === 'guild' && window.GUILD) window.GUILD.open(v || 'home', 'home');
  }
  // 消す：自分のお知らせはこの端末から、部屋の一言コメント・とどいたお知らせはサーバーから
  function del(k) {
    const [kind, id] = k.split(':');
    const done = r => { if (r && r.ok) { if (r.chat) chat = r.chat.slice(0, 20); if (r.notes) notes = r.notes.map(n => Object.assign({ kind: 'note' }, n)); } draw(); list(); };
    if (k === 'all') {
      P.confirmBox('一言コメントとお知らせを、ぜんぶ消しますか？（部屋に書かれた一言コメントも消えます）', () => {
        S.myNotes = []; P.saveLocal();
        if (!P.online()) { chat = []; notes = []; done(); return; }
        P.soc('del', { pid: S.pid, kind: 'note', id: 'all' }, r => { done(r); P.soc('del', { pid: S.pid, kind: 'chatall' }, done); });
      });
      return;
    }
    P.sound('tap');
    if (kind === 'mine') { S.myNotes = (S.myNotes || []).filter(n => String(n.t) !== id); P.saveLocal(); done(); return; }
    if (!P.online()) { if (kind === 'chat') chat = chat.filter(c => String(c.id) !== id); else notes = notes.filter(n => String(n.id) !== id); done(); return; }
    P.soc('del', { pid: S.pid, kind, id: +id }, done);
  }
  $('#tkList').addEventListener('click', e => {
    const f = e.target.closest('[data-frown]');
    if (f) { e.stopPropagation(); P.sound('tap'); if (window.GUILD) window.GUILD.frown(+f.dataset.frown); return; }
    if (e.target.closest('#tkSend')) { e.stopPropagation(); sendSay(); return; }
    if (e.target.closest('#tkSay') || e.target.closest('#tkFsel')) { e.stopPropagation(); return; }
    const sg = e.target.closest('[data-to]');
    if (sg) { e.stopPropagation(); P.sound('tap'); S.settings.tkTo = sg.dataset.to === 'fall' ? ((S.settings.tkTo || '').startsWith('f:') ? S.settings.tkTo : 'fall') : 'gk'; P.saveLocal(); list(); return; }
    const b = e.target.closest('[data-del]'); if (!b) return; e.stopPropagation(); del(b.dataset.del);
  });
  $('#tkList').addEventListener('change', e => { if (e.target.id === 'tkFsel') { S.settings.tkTo = e.target.value; P.saveLocal(); list(); } });
  $('#tkList').addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'tkSay') { e.preventDefault(); sendSay(); } });
  function sendSay() {
    const inp = $('#tkSay'), text = inp && inp.value.trim(); if (!text) return;
    const sel = $('#tkFsel'), to = sel ? sel.value : ((S.settings && S.settings.tkTo) || 'gk');
    const done = r => { inp.disabled = false; if (r && r.ok) { inp.value = ''; P.sound('ok'); P.toast(to === 'gk' ? '碁会所に送りました' : to === 'fall' ? `フレンド${r.n != null ? ' ' + r.n + '人' : ''}に送りました` : '送りました'); } };
    const ng = r => { done(r); if (r && !r.ok) P.toast(r.reason === 'wait' ? `連続では送れません。あと${r.sec}秒待ってください` : window.SOCIAL && window.SOCIAL.why ? window.SOCIAL.why(r) : '送れませんでした'); };
    inp.disabled = true;
    if (to === 'gk') { if (window.GUILD) window.GUILD.say(text, done); return; }
    if (to === 'fall') { P.soc('chatall', { text }, ng); return; }
    P.soc('chat', { pid: to.slice(2), text }, ng);
  }
  // 碁会所の一言（入っていなければ null）。boss：マスター・店長（☹️の数が見える）
  function guild(list, boss) {
    gchat = list ? list.slice(0, 20) : null; gboss = !!boss; draw();
  }
  function gpush(it) { if (!gchat || !it) return; gchat = [it].concat(gchat.filter(x => x.id !== it.id)).slice(0, 20); draw(true); }
  $('#ticker').addEventListener('click', e => {
    const u = e.target.closest('[data-go]');
    if (u) { e.stopPropagation(); go(u.dataset.go); return; }
    if (e.target.closest('#tkLine')) { const l = $('#tkList'); l.hidden = !l.hidden; if (!l.hidden) list(); }
  });
  document.addEventListener('kuro9screen', e => { screen = e.detail; $('#tkList').hidden = true; draw(); });
  // つながったら一度だけ、最新を読みこむ
  setInterval(() => {
    if (!loaded && P.online() && shouldShow()) { loaded = true; P.soc('me', {}, r => { if (r.ok) set(r.chat, r.notes, r.friends, r.ann); else loaded = false; }); }
  }, 2000);
  window.TICKER = { set, push, draw, mine, guild, gpush };
})();
