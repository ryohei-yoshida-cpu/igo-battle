/* 囲碁BLITZ — 対人戦のえらびかた（ランダムマッチ／フレンドマッチ）と、フレンドマッチの部屋
 *   部屋をつくる：手合い（ハンデ）・黒を持つ人・持ち時間をえらぶ → 4けたの合言葉が出る
 *   部屋に入る　：友だちから聞いた合言葉を入れる → すぐ対局
 */
(() => {
  'use strict';
  const P = window.APP, A = P.A, S = P.S, FR = P.FR;
  const $ = s => document.querySelector(s);
  const ci = key => Math.max(0, A.VARIANTS.findIndex(v => v.key === key));

  // 手合いごとに、説明してくれるキャラ
  const HC_TALK = [
    ['tomoe', '互先（たがいせん）。黒と白は対等で、先に打つ黒のぶん、白にコミ7目を足す。真剣勝負だ。'],
    ['shima', '定先（じょうせん）は、少し弱い方がいつも黒を持ち、コミなしで打つ手合いです。ほんの少しの差なら、これがちょうどいい。'],
    ['koharu', '2子局です！ 黒が星に2つ置いて、白から打ちます。ちょっとした実力差なら、これで互角になりますよ！'],
    ['hinata', '3子局だよ！ 角が3つも黒でうまってるから、黒はかなり打ちやすいよ！'],
    ['mike', 'みけ「4すみ、ぜんぶ黒……」　こむぎ「これなら始めたばかりの人でも戦えるワン！」'],
    ['tono', '5子局、天元まで置くとは！ 余でも白は骨が折れるぞ。はじめての友と打つなら、これが良い。']
  ];
  // 部屋で待っている間のひとこと（手合いを説明してくれたキャラが、そのまま付きそう）
  const WAIT_TALK = {
    tomoe: '合言葉は伝えたか？ 相手が来るまで、心を静めて待とう。',
    shima: '盤と石は用意しておいた。……あとは相手を待つだけだ。',
    koharu: 'お友だち、まだかな？ わくわくしますね！',
    hinata: 'ねえねえ、まだかな？ 来たら一緒に応援するね！',
    mike: 'みけ「……まだ？」　こむぎ「もうすぐ来るワン！ しっぽふって待つワン！」',
    tono: 'うむ、余も見物させてもらうぞ。友が来るまで、茶でも持て。',
    dgensai: '……待つのは慣れてる。あけみちゃんの出勤も、こうして待ってたからな。'
  };
  const HC_SUB = ['コミ7目', 'コミなし', '置き石2', '置き石3', '置き石4', '置き石5'];
  const st = { tab: 'make', h: 0, black: 'random', min: 5, size: 9, code: '' };
  try { Object.assign(st, JSON.parse(localStorage.getItem('kuro9.friend') || '{}'), { tab: 'make', code: '' }); } catch (e) {}
  const keep = () => { try { localStorage.setItem('kuro9.friend', JSON.stringify({ h: st.h, black: st.black, min: st.min, size: st.size })); } catch (e) {} };

  /* ---------- 対人戦：どちらで打つ？ ---------- */
  function renderPvp() {
    const me = P.charaIdx();
    // ランダム：自分と、知らない誰か（毎回ちがうキャラ）。フレンド：仲よしの2人
    const others = A.VARIANTS.map((v, i) => i).filter(i => i !== me);
    const rival = others[Math.floor(Math.random() * others.length)];
    P.setImg($('#pmRandA'), A.charaUri(me)); P.setImg($('#pmRandB'), A.charaUri(rival));
    P.setImg($('#pmFrA'), A.charaUri(ci('koharu') === me ? ci('hinata') : ci('koharu'))); P.setImg($('#pmFrB'), A.charaUri(ci('mike')));
    for (const b of document.querySelectorAll('#pvpSize button')) b.setAttribute('aria-checked', String(+b.dataset.v === st.size));
    P.setImg($('#pmBot'), A.charaUri(ci('gensai')));
    $('#pvpNote').textContent = FR.available() ? '' : 'この版はサーバーにつながっていないので、ランダムマッチはBotとの対局になります。';
  }
  $('#pvpBack').onclick = () => FR.back();
  $('#goRandom').onclick = () => { P.sound('stone'); FR.random(st.size); };
  for (const b of document.querySelectorAll('#pvpSize button')) b.onclick = () => { P.sound('stone'); st.size = +b.dataset.v; if (st.size === 13 && st.min < 10) st.min = 10; if (st.size === 9 && st.min > 10) st.min = 5; keep(); renderPvp(); };
  $('#goBot').onclick = () => { P.sound('stone'); FR.bot(st.size); };
  $('#goFriend').onclick = () => {
    P.sound('stone');
    if (!FR.available()) { P.toast('この版ではフレンドマッチは使えません（サーバーにつながっていません）', 3500); return; }
    FR.openFriend();
  };

  /* ---------- フレンドマッチ ---------- */
  function open() {
    $('#frInviteNote').hidden = !inviteTarget;
    if (!FR.waiting()) { st.code = ''; showPane(st.tab); $('#joinTalk').textContent = '合言葉を教えてもらいましたか？ 4けたの数字を入れてください！'; }
    renderMake(); renderCode();
  }
  function showPane(tab) {
    st.tab = tab;
    for (const b of document.querySelectorAll('#frTabs button')) b.setAttribute('aria-checked', String(b.dataset.tab === tab));
    $('#frTabs').hidden = false;
    $('#frMake').hidden = tab !== 'make'; $('#frJoin').hidden = tab !== 'join'; $('#frWait').hidden = true;
  }
  for (const b of document.querySelectorAll('#frTabs button')) b.onclick = () => { P.sound('stone'); showPane(b.dataset.tab); if (b.dataset.tab === 'join') renderCode(); };
  $('#frBack').onclick = () => { inviteTarget = null; $('#frInviteNote').hidden = true; FR.cancel(); P.showScreen('pvp'); renderPvp(); };

  // 9路のちいさな盤（置き石つき）
  function miniBoard(h, n) {
    const c = n === 13 ? 4.2 : 6, pad = 5, w = pad * 2 + c * (n - 1), stars = n === 13 ? [42, 48, 84, 120, 126] : [20, 24, 40, 56, 60];
    let s = `<svg viewBox="0 0 ${w} ${w}" aria-hidden="true"><rect width="${w}" height="${w}" rx="4" class="mb-bg"/>`;
    for (let i = 0; i < n; i++) s += `<path class="mb-l" d="M${pad} ${pad + i * c}H${pad + c * (n - 1)}M${pad + i * c} ${pad}V${pad + c * (n - 1)}"/>`;
    for (const p of stars) s += `<circle class="mb-star" cx="${pad + (p % n) * c}" cy="${pad + ((p / n) | 0) * c}" r=".9"/>`;
    for (const p of P.hcStones(h, n)) s += `<circle class="mb-b" cx="${pad + (p % n) * c}" cy="${pad + ((p / n) | 0) * c}" r="${n === 13 ? 2 : 2.6}"/>`;
    return s + '</svg>';
  }
  function talk(key, text) {
    const i = ci(key);
    P.setImg($('#frTalkImg'), A.charaUri(i));
    $('#frTalkName').textContent = A.VARIANTS[i].name;
    $('#frTalkText').textContent = text;
    const el = $('#frTalk'); el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
  }
  function renderMake() {
    const g = $('#hcGrid');
    if (g.dataset.size !== String(st.size)) {
      g.dataset.size = st.size; g.innerHTML = '';
      P.HC_NAME.forEach((name, h) => {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'hc-btn'; b.dataset.h = h; b.setAttribute('role', 'radio');
        b.innerHTML = `${miniBoard(h, st.size)}<b>${name}</b><small>${HC_SUB[h]}</small>`;
        b.onclick = () => { P.sound('stone'); st.h = h; if (h > 0 && st.black === 'random') st.black = 'guest'; keep(); renderMake(); };
        g.append(b);
      });
    }
    if (!g.dataset.wired) {
      g.dataset.wired = 1;
      for (const b of document.querySelectorAll('#frSize button')) b.onclick = () => { st.size = +b.dataset.v; if (st.size === 13 && st.min < 10) st.min = 10; keep(); renderMake(); };
      for (const b of document.querySelectorAll('#frBlack button')) b.onclick = () => { st.black = b.dataset.v; keep(); renderMake(); };
      for (const b of document.querySelectorAll('#frTime button')) b.onclick = () => { st.min = +b.dataset.v; keep(); renderMake(); };
    }
    for (const b of g.children) b.setAttribute('aria-checked', String(+b.dataset.h === st.h));
    $('#frBlackLabel').textContent = st.h === 0 ? '黒番（先手）を持つのは' : '黒（ハンデをもらう側）を持つのは';
    const rnd = document.querySelector('#frBlack [data-v=random]'); rnd.hidden = st.h > 0;
    for (const b of document.querySelectorAll('#frBlack button')) b.setAttribute('aria-checked', String(b.dataset.v === st.black));
    for (const b of document.querySelectorAll('#frTime button')) b.setAttribute('aria-checked', String(+b.dataset.v === st.min));
    for (const b of document.querySelectorAll('#frSize button')) b.setAttribute('aria-checked', String(+b.dataset.v === st.size));
    const [key, text] = HC_TALK[st.h];
    if ($('#frTalk').dataset.h !== String(st.h) && !$('#frMake').hidden) { $('#frTalk').dataset.h = st.h; talk(key, text); }
    $('#frSummary').textContent = condText(st);
  }
  const condText = c => `${c.size === 13 ? '13路' : '9路'}・${P.HC_NAME[c.h]}・${c.black === 'host' ? 'あなたが黒' : c.black === 'guest' ? '友だちが黒' : '黒白はおまかせ'}・持ち時間${c.min}分（1手ごとに＋5秒）`;

  $('#frCreate').onclick = () => {
    P.sound('stone');
    FR.host({ h: st.h, black: st.black, min: st.min, size: st.size });
    // 待つ画面（合言葉はサーバーから届いたら出す）
    $('#frTabs').hidden = true; $('#frMake').hidden = true; $('#frJoin').hidden = true; $('#frWait').hidden = false;
    $('#frCode').textContent = '····'; $('#frCopy').disabled = true;
    $('#frCond').textContent = condText(st);
    P.setImg($('#frWaitMe'), P.myFaceSrc());
    P.setImg($('#frWaitChara'), A.charaUri(ci(HC_TALK[st.h][0])));
    $('#frWaitName').textContent = A.VARIANTS[ci(HC_TALK[st.h][0])].name;
    $('#frWaitText').textContent = FR.online() ? '部屋をつくっています…' : 'サーバーにつないでいます…';
  };
  // 対人戦の申込：部屋ができたら、相手のお知らせに合言葉を届ける（あとは普通のフレンドマッチと同じ）
  let inviteTarget = null;
  function inviteTo(to) {
    inviteTarget = to;
    P.showScreen('friend'); st.code = ''; showPane('make'); renderMake(); renderCode();
    $('#frInviteNote').hidden = false; $('#frInviteNote').textContent = `${to.name}さんへの対人戦の申込。部屋をつくると、相手の一言コメント欄に部屋番号が届きます。`;
  }
  function joinWith(code) {
    P.showScreen('friend'); showPane('join');
    st.code = String(code || '').replace(/\D/g, '').slice(0, 4); renderCode();
    $('#joinTalk').textContent = '部屋番号を入れておきました！「入る」を押してくださいね。';
  }
  function onRoom(m) {
    if (inviteTarget) {
      const to = inviteTarget; inviteTarget = null;
      P.soc('invite', { pid: to.pid, code: m.code }, res => {
        if (res.ok) { P.toast(`${to.name}さんに申込みを送りました`); if (window.TICKER) window.TICKER.mine({ type: 'myinvite', name: to.name, code: m.code }); }
        else P.toast(res.reason === 'blocked' ? 'この人には申し込めません' : '申込みを送れませんでした');
      });
    }
    $('#frCode').textContent = m.code; $('#frCopy').disabled = false;
    $('#frCond').textContent = condText(m.hc);
    const key = HC_TALK[m.hc.h][0];
    P.setImg($('#frWaitChara'), A.charaUri(ci(key)));
    $('#frWaitName').textContent = A.VARIANTS[ci(key)].name;
    $('#frWaitText').textContent = WAIT_TALK[key];
    const el = $('#frCodeCard'); el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
    P.sound('ok');
  }
  $('#frCopy').onclick = () => {
    const code = $('#frCode').textContent, text = `囲碁BLITZ で一局打とう！ フレンドマッチの合言葉は「${code}」です。`;
    const done = () => P.toast('合言葉をコピーしました。友だちに送ってね');
    try { navigator.clipboard.writeText(text).then(done, () => P.toast(`合言葉は ${code} です`)); } catch (e) { P.toast(`合言葉は ${code} です`); }
  };
  $('#frClose').onclick = () => { FR.cancel(); showPane('make'); renderMake(); };

  /* ---------- 部屋に入る：4けたを入れる ---------- */
  function renderCode() {
    const boxes = $('#codeBoxes').children;
    for (let i = 0; i < 4; i++) { boxes[i].textContent = st.code[i] || ''; boxes[i].classList.toggle('on', i === st.code.length); }
    $('#kpGo').disabled = st.code.length !== 4;
  }
  function key(k) {
    if (FR.waiting()) return;
    if (k === 'del') st.code = st.code.slice(0, -1);
    else if (k === 'go') { if (st.code.length === 4) join(); return; }
    else if (st.code.length < 4) st.code += k;
    P.sound('stone'); renderCode();
  }
  function join() {
    FR.join(st.code);
    $('#joinTalk').textContent = FR.online() ? '部屋をさがしています…' : 'サーバーにつないでいます…';
    $('#kpGo').disabled = true;
  }
  function onNone(m) {
    $('#kpGo').disabled = st.code.length !== 4;
    const el = $('#codeBoxes'); el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake');
    $('#joinTalk').textContent = m.busy ? 'ちょっと間違えすぎです……。1分ほど待ってから、もう一度ためしてくださいね。'
      : 'あれ？ その合言葉の部屋は見つかりませんでした。数字をもう一度たしかめてください！';
    P.sound('bad');
  }
  const kp = $('#keypad');
  for (const k of ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'go']) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'kp-' + (k === 'go' ? 'go' : k === 'del' ? 'del' : 'n');
    b.textContent = k === 'del' ? '消す' : k === 'go' ? '入る' : k;
    if (k === 'go') b.id = 'kpGo';
    b.onclick = () => key(k);
    kp.append(b);
  }
  document.addEventListener('keydown', e => {
    if ($('#friend').hidden || $('#frJoin').hidden) return;
    if (/^[0-9]$/.test(e.key)) key(e.key); else if (e.key === 'Backspace') key('del'); else if (e.key === 'Enter') key('go');
  });
  P.setImg($('#joinImg'), A.charaUri(ci('koharu')));

  window.FRIEND = { renderPvp, open, onRoom, onNone, inviteTo, joinWith, setSize: n => { st.size = n === 13 ? 13 : 9; renderPvp(); } };
})();
