/* 共通：アバター（服ショップ／クローク）と、マイルームのえらぶ画面（アバター／マイルーム／キャラクター）
 *   服ショップ … ひなたが店員。タップで試着、もう一度タップか試着中リストで買う。買ったら「そのまま着替える？」
 *   クローク   … 持っている服だけ。えらんで「この姿にする」で保存（そのときだけサーバーへ送る）
 *   パーツは銭で買う（サーバーが持ち物を確かめる）。
 *   キャラクターはこのゲーム（囲碁）だけのもの。アバター・部屋・銭は、ほかのゲームとも共有する。
 */
(function () {
  'use strict';
  const P = window.APP, S = P.S, AV = window.AVATAR;
  const $ = s => document.querySelector(s);
  let look = null, slot = 'face', mode = 'shop', from = 'hub';

  const myLook = () => AV.clean(S.av || AV.PRESETS.girl);
  const owned = (sl, id) => AV.PRICE[sl + ':' + id] === 0 || (S.avOwned || []).includes(sl + ':' + id);
  const zeniText = () => `${(S.zeni || 0).toLocaleString()} 銭`;
  const walletHtml = () => `${(S.zeni || 0).toLocaleString()} 銭<i class="chip-tama">勾玉 ${(S.tama | 0).toLocaleString()}</i>`;

  /* ---------- えらぶ画面 ---------- */
  function openHub() {
    $('#hubAv').innerHTML = AV.svg(myLook());
    P.setImg($('#hubChara'), P.myCharaSrc());
    $('#hubZeni').textContent = zeniText();
    $('#hubRoom').innerHTML = window.ROOM ? window.ROOM.mini() : '';
    P.showScreen('hub');
  }
  $('#openHub').onclick = () => { P.sound('stone'); openHub(); };
  $('#hubBack').onclick = () => { P.renderHome(); P.showScreen('home'); };
  $('#openAvatar').onclick = () => { P.sound('stone'); open('closet', null, 'hub'); };
  $('#openAvShop').onclick = () => { P.sound('stone'); open('shop', null, 'hub'); };

  /* ---------- ひなた（服ショップの店員） ---------- */
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const SAY = {
    hello: ['いらっしゃいませ♪ 気になる服は、タップで試着できるよ！', 'いらっしゃいませー！ 新作、入ってますよ♪', 'ゆっくり見ていってね♪ 試着はタダだよ！'],
    pick: ['似合うじゃん！', '試着室へご案内ー♪', 'わぁ、かわいい！', 'それ、今いちばん人気だよ♪', 'その色、ぴったり！', 'ちょっと大人っぽいね♪', '迷ったら、ぜんぶ試着しちゃお！', 'もう一回タップで、お買い上げ〜♪', 'いいセンスしてる〜！', 'それ着て対局したら、勝てそう！'],
    have: ['それはもう持ってるよ！ クロークで着替えられるよ♪', 'お手持ちの服だね。合わせてみる？'],
    buy: ['お買い上げ、ありがとうございまーす♪', '大事に着てね！', 'まいどありっ♪ また来てね！'],
    poor: ['あと少し銭がたまったら、また来てね♪', '対局で勝つと銭がもらえるよ！']
  };
  function hinata(kind) {
    if (mode !== 'shop') return;
    $('#avClerkT').textContent = pick(SAY[kind]);
    const b = $('#avClerkB'); b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
  }

  /* ---------- 服ショップ・クローク ---------- */
  // m：'shop' 服ショップ / 'closet' クローク。back：もどる先（'hub' ルームのメニュー / 'shop' ショップ）
  function open(m, startSlot, back) {
    if (typeof m !== 'string' || (m !== 'shop' && m !== 'closet')) { startSlot = m; m = 'closet'; }
    mode = m; if (back) from = back;
    look = myLook(); slot = startSlot || (m === 'shop' ? 'body' : 'head'); lineTry = null; lineWhere = '';
    P.showScreen('avatar');
    render();
    if (m === 'shop') hinata((S.zeni || 0) < 300 ? 'poor' : 'hello');
  }
  function switchMode() {
    const go = () => { P.sound('stone'); open(mode === 'shop' ? 'closet' : 'shop', slot); };
    if (mode === 'closet' && changed()) P.confirmBox('着がえを保存せずに、服ショップへ行きますか？', go); else go();
  }
  $('#avSwitch').onclick = switchMode;
  function changed() { return JSON.stringify(AV.clean(look)) !== JSON.stringify(myLook()); }
  function unowned() { return AV.SLOTS.map(([sl]) => sl).filter(sl => !owned(sl, look[sl])); }
  // タブの中身：髪のタブは「髪型」と「髪の色」
  // 元の絵の服（色を買う）と、素材シートの服（形ごと買う）を分けて並べる
  const sections = tab => [[tab, '']];
  function render() {
    const shop = mode === 'shop';
    $('#avTitle').textContent = shop ? '服ショップ' : 'クローク';
    $('#avSwitch').textContent = shop ? 'クロークへ' : '服ショップへ';
    $('#avClerk').classList.toggle('closet', !shop);
    $('#avClerkB').hidden = !shop; $('#avClerkImg').hidden = !shop;
    $('#avBig').innerHTML = AV.svg(look, 'av-svg', true);
    $('#avZeni').innerHTML = walletHtml();
    $('#avTabs').innerHTML = AV.TABS.concat([['line', '台詞']]).map(([k, n]) => `<button type="button" data-slot="${k}" aria-pressed="${slot === k}">${n}</button>`).join('');
    let h = slot === 'line' ? linesHtml() : '';
    for (const [sl, title, only] of slot === 'line' ? [] : sections(slot)) {
      if (title) h += `<div class="av-sec">${title}</div>`;
      const list = AV.CATALOG[sl].filter(([id]) => (!only || only(id)) && (mode === 'shop' || owned(sl, id)));
      if (!list.length) { if (mode === 'closet' && title) h = h.replace(/<div class="av-sec">[^<]*<\/div>$/, ''); continue; }
      h += list.map(([id, name, price]) => {
        const have = owned(sl, id), wearing = look[sl] === id;
        const preview = Object.assign({}, look, { [sl]: id });
        return `<button type="button" class="av-item ${wearing ? 'on' : ''}" data-sl="${sl}" data-id="${id}">${AV.thumb(preview, slot)}<b>${name}</b>` +
          `<small class="price">${price ? price.toLocaleString() + ' 銭' : '無料'}</small>${have ? `<i class="av-own">${wearing ? '着ている' : '持っている'}</i>` : ''}</button>`;
      }).join('');
    }
    if (mode === 'closet') h += `<button type="button" class="av-goshop" data-goshop="1">ほかの${SLOT_NAME[slot] || '台詞'}は、服ショップで買えます →</button>`;
    $('#avGrid2').innerHTML = h;
    const need = mode === 'shop' ? unowned() : [];
    renderTry(need);
    renderSets();
    $('#avLead').textContent = shop ? 'タップで試着。もう一度タップするか、試着中リストから買えます。' : '持っている服で着がえます。えらんだら「この姿にする」。';
    $('.av-presets').hidden = shop; $('#avSave').hidden = shop; $('#avNote').hidden = shop;
    if (shop) return;
    $('#avSave').disabled = !changed() && !need.length;
    $('#avSave').textContent = need.length ? `試着中を買う（${need.reduce((a, sl) => a + entryOf(sl)[2], 0).toLocaleString()} 銭）` : 'この姿にする';
    $('#avNote').textContent = need.length ? '「試着」中です。銭で買うと、この姿にできます。' : changed() ? '' : 'いまの姿です。';
  }
  /* ---------- 台詞（せりふ）：対局のはじめ・勝ち・負け・おわりに、吹き出しで言う ---------- */
  const lineOwned = id => AV.PRICE['line:' + id] === 0 || (S.avOwned || []).includes('line:' + id);
  const linePrice = id => { const t = AV.TAMA['line:' + id]; return t ? `勾玉 ${t}` : `${AV.PRICE['line:' + id].toLocaleString()} 銭`; };
  let lineTry = null, lineWhere = '';   // 試し聞き中の台詞・試着中リストで決めた「使う場面」
  function linesHtml() {
    const ln = look.ln || {};
    let h = '';
    if (mode === 'closet') {
      // 4つの場面に、持っている台詞をセット
      const mine = AV.LINES.filter(([id]) => lineOwned(id));
      h += `<div class="ln-slots"><b class="ln-ask">対局で言う台詞をセット</b>` +
        AV.LINE_SLOTS.map(([k, n]) => `<label class="ln-row"><span>${n}</span><select data-lnsel="${k}"><option value="">（なし）</option>${mine.map(([id, t]) => `<option value="${id}" ${ln[k] === id ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>`).join('') + '</div>';
      return h;
    }
    h += `<p class="ln-lead">台詞は、対局のはじめ・勝ったとき・負けたとき・対局のおわりに、アバターの吹き出しで出ます。相手にも見えます。</p>`;
    h += AV.LINES.map(([id, t]) => {
      const have = lineOwned(id), used = Object.values(ln).includes(id), tm = AV.TAMA['line:' + id];
      return `<button type="button" class="av-item ln-item ${lineTry === id ? 'on' : ''} ${tm ? 'tama' : ''}" data-line="${id}"><div class="ln-thumb">${esc(t)}</div>` +
        `<small class="price">${tm ? '<i class="tm">勾玉限定</i>' : ''}${linePrice(id)}</small>${have ? `<i class="av-own">${used ? 'セット中' : '持っている'}</i>` : ''}</button>`;
    }).join('');
    return h;
  }
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function sayPreview(id) {
    const old = $('#avBigSay'); if (old) old.remove();
    if (!id) return;
    const b = document.createElement('div'); b.id = 'avBigSay'; b.className = 'say-bubble'; b.textContent = AV.LINE_TEXT[id];
    $('#avBig').append(b); setTimeout(() => b.remove(), 2600);
  }
  // 台詞をその場面にセットして保存
  function setLine(id, k) {
    const l = AV.clean(Object.assign({}, myLook(), { ln: Object.assign({}, myLook().ln, { [k]: id }) }));
    look.ln = l.ln; wear(l);
  }
  function buyLine(id) {
    const tm = AV.TAMA['line:' + id], price = AV.PRICE['line:' + id];
    if (tm ? (S.tama | 0) < tm : (S.zeni || 0) < price) { hinata('poor'); P.toast(tm ? `勾玉が足りません（勾玉 ${tm}）。勾玉は骨董屋で手に入ります` : `銭が足りません（${price} 銭）`); return; }
    P.confirmBox(`台詞「${AV.LINE_TEXT[id]}」を ${linePrice(id)} で買いますか？`, () => {
      P.buy({ av: 'line:' + id }, tm ? 0 : price, res => {
        if (!res.ok) { P.toast(BUY_NG[res.reason] || '買えませんでした'); return; }
        const where = lineWhere; lineTry = null; lineWhere = ''; render();
        // 場面を決めていなければ、お礼の前に店員さんが聞く
        window.FANFARE.thanks({
          who: 'hinata', items: [{ thumb: `<div class="ln-thumb">${esc(AV.LINE_TEXT[id])}</div>`, name: '台詞' }],
          ask: where ? null : { opts: AV.LINE_SLOTS.concat([['', 'あとで決める']]), pick: k => { if (k) setLine(id, k); } },
          then: () => { if (where) setLine(id, where); else if (!(myLook().ln && Object.values(myLook().ln).includes(id))) P.toast('台詞はクロークの「台詞」でセットできます'); }
        });
      });
    });
  }
  $('#avGrid2').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.line) {
      const id = b.dataset.line, again = lineTry === id;
      lineTry = id; P.sound('tap'); render(); sayPreview(id);
      if (mode !== 'shop') return;
      if (lineOwned(id)) { hinata('have'); return; }
      if (again) buyLine(id); else hinata('pick');
      return;
    }
  });
  $('#avGrid2').addEventListener('change', e => {
    const s = e.target.closest('[data-lnsel]'); if (!s) return;
    const ln = Object.assign({}, look.ln); if (s.value) ln[s.dataset.lnsel] = s.value; else delete ln[s.dataset.lnsel];
    look.ln = ln; sayPreview(s.value); render();
  });

  /* ---------- お気に入りセット（クロークだけ）：2つまで。部屋にクロークを1つ置くごとに2つふえる（12まで） ---------- */
  const setSlots = () => Math.min(12, 2 + 2 * (window.ROOM && window.ROOM.cloaks ? window.ROOM.cloaks() : 0));
  function renderSets() {
    const box = $('#avSets');
    box.hidden = mode !== 'closet'; if (box.hidden) return;
    const sets = S.avSets = Array.isArray(S.avSets) ? S.avSets : [], n = setSlots();
    let h = `<div class="av-sets-h"><b>お気に入りセット</b><small>${n}つまで登録できます</small></div><div class="av-sets-list">`;
    for (let i = 0; i < n; i++) {
      const st = sets[i];
      h += st ? `<div class="av-set"><button type="button" class="av-set-fig" data-setuse="${i}" aria-label="セット${i + 1}を着てみる">${AV.svg(AV.clean(st), 'av-set-svg')}</button><span>セット${i + 1}</span><button type="button" class="sc-x" data-setsave="${i}">上書き</button></div>`
        : `<div class="av-set empty"><button type="button" class="av-set-fig" data-setsave="${i}"><b>＋</b><small>いまの姿を登録</small></button><span>セット${i + 1}</span></div>`;
    }
    h += `<button type="button" class="av-set more" data-setmore="1"><b>クロークを増やす</b><small>部屋にクロークを置くと、セットが2つふえます</small></button></div>`;
    box.innerHTML = h;
  }
  $('#avSets').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    const sets = S.avSets = Array.isArray(S.avSets) ? S.avSets : [];
    if (b.dataset.setuse) { look = Object.assign({}, AV.clean(sets[+b.dataset.setuse])); P.sound('tap'); render(); P.toast('セットを着てみました。「この姿にする」で決定'); return; }
    if (b.dataset.setsave) {
      const i = +b.dataset.setsave, l = AV.clean(look);
      if (unowned().length) { P.toast('まだ買っていない服があるので、登録できません'); return; }
      const save = () => { sets[i] = l; P.save(); P.sound('ok'); P.toast(`セット${i + 1}に登録しました`); renderSets(); };
      if (sets[i]) P.confirmBox(`セット${i + 1}を、いまの姿で上書きしますか？`, save); else save();
      return;
    }
    if (b.dataset.setmore) {
      const go = () => { P.sound('stone'); if (window.ROOM) window.ROOM.openShop('cloak', 'closet'); };
      if (changed()) P.confirmBox('着がえを保存せずに、ルームショップ（クローク）へ行きますか？', go); else go();
    }
  });
  // 試着中リスト（まだ買っていないパーツ）：1つずつ買う・まとめて買う、合計の銭
  const SLOT_NAME = Object.fromEntries(AV.SLOTS);
  const entryOf = sl => AV.CATALOG[sl].find(x => x[0] === look[sl]);
  function renderTry(need) {
    const box = $('#avTry');
    const ln = mode === 'shop' && lineTry && !lineOwned(lineTry) ? lineTry : null;   // 試し聞き中の台詞（まだ持っていない）
    $('#avLead').hidden = !!(need.length || ln); box.hidden = !(need.length || ln);
    if (!need.length && !ln) { box.innerHTML = ''; return; }
    const total = need.reduce((a, sl) => a + entryOf(sl)[2], 0), short = total > (S.zeni || 0);
    const ltm = ln && AV.TAMA['line:' + ln], lp = ln && AV.PRICE['line:' + ln], lok = ln && (ltm ? (S.tama | 0) >= ltm : (S.zeni || 0) >= lp);
    box.innerHTML = `<b class="av-try-h">試着中</b><ul>${need.map(sl => { const e = entryOf(sl); return `<li><span><small>${SLOT_NAME[sl]}</small>${e[1]}</span><em>${e[2].toLocaleString()}</em><button type="button" class="btn primary small" data-tbuy="${sl}" ${e[2] > (S.zeni || 0) ? 'disabled' : ''}>買う</button><button type="button" class="sc-x" data-tundo="${sl}" aria-label="試着をやめる">×</button></li>`; }).join('')}` +
      (ln ? `<li class="ln-try"><span><small>台詞</small>「${esc(AV.LINE_TEXT[ln])}」</span><em>${ltm ? `勾玉 ${ltm}` : lp.toLocaleString()}</em><button type="button" class="btn primary small" data-lbuy="1" ${lok ? '' : 'disabled'}>買う</button><button type="button" class="sc-x" data-lundo="1" aria-label="試し聞きをやめる">×</button>
        <label class="ln-where">使う場面<select data-lnwhere="1"><option value="">買ったあとで選ぶ</option>${AV.LINE_SLOTS.map(([k, n]) => `<option value="${k}" ${lineWhere === k ? 'selected' : ''}>${n}</option>`).join('')}</select></label></li>` : '') + `</ul>
      ${need.length ? `<div class="av-try-sum"><span>服の合計</span><b class="${short ? 'short' : ''}">${total.toLocaleString()} 銭</b></div>` : ''}
      ${need.length > 1 ? `<button type="button" class="btn primary small" data-tall="1" ${short ? 'disabled' : ''}>まとめて買う（${total.toLocaleString()} 銭）</button>` : ''}
      ${need.length && short ? `<small class="av-try-short">あと ${(total - (S.zeni || 0)).toLocaleString()} 銭たりません</small>` : ''}`;
  }
  $('#avTry').addEventListener('change', e => { if (e.target.dataset.lnwhere) lineWhere = e.target.value; });
  $('#avTry').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.tbuy) { askBuy(b.dataset.tbuy, look[b.dataset.tbuy]); return; }
    if (b.dataset.lbuy) { buyLine(lineTry); return; }
    if (b.dataset.lundo) { lineTry = null; lineWhere = ''; P.sound('tap'); render(); return; }
    if (b.dataset.tundo) { const sl = b.dataset.tundo, mine = myLook()[sl]; const ml = myLook(), boy = ml.head === 'h32' || ml.body === 'b32' || look.head === 'h32' || look.body === 'b32'; look[sl] = owned(sl, mine) ? mine : (boy ? AV.PRESETS.boy : AV.PRESETS.girl)[sl]; P.sound('tap'); render(); return; }
    if (b.dataset.tall) {
      const need = unowned(), total = need.reduce((a, sl) => a + entryOf(sl)[2], 0);
      P.confirmBox(`試着中の ${need.length} 点を、合計 ${total.toLocaleString()} 銭で買いますか？`, () => {
        const bought = [];
        const next = () => {
          const sl = unowned()[0];
          if (!sl) { hinata('buy'); render(); window.FANFARE.thanks({ who: 'hinata', items: bought.map(s => ({ thumb: AV.thumb(look, s), name: entryOf(s)[1] })), then: () => askWear(bought, 'まとめて買いました！') }); return; }
          bought.push(sl);
          const id = look[sl];
          P.buy({ av: sl + ':' + id }, entryOf(sl)[2], res => { if (!res.ok) { P.toast(BUY_NG[res.reason] || '買えませんでした'); render(); return; } next(); });
        };
        next();
      });
    }
  });
  const BUY_NG = { zeni: '銭が足りません', offline: 'サーバーにつながっていないので、今は買えません', have: 'もう持っています' };
  // 1回目のタップは試着だけ。試着中のものをもう一度タップすると「買いますか？」
  function askBuy(sl, id) {
    const entry = AV.CATALOG[sl].find(x => x[0] === id); if (!entry) return;
    const price = entry[2];
    if ((S.zeni || 0) < price) { hinata('poor'); P.toast(`${entry[1]}は ${price} 銭です。銭が足りません`); return; }
    P.confirmBox(`${entry[1]}を ${price} 銭で買いますか？`, () => {
      P.buy({ av: sl + ':' + id }, price, res => {
        if (!res.ok) { P.toast(BUY_NG[res.reason] || '買えませんでした'); return; }
        hinata('buy'); render(); window.FANFARE.thanks({ who: 'hinata', items: [{ thumb: AV.thumb(look, sl), name: entry[1] }], then: () => askWear([sl], `${entry[1]}を買いました！`) });
      });
    });
  }
  // 買ったら「そのまま着替える？」。着替えないときは、買った服はクロークへ（試着は元にもどす）
  function askWear(slots, head) {
    render();
    P.confirmBox(`${head} そのまま着替えますか？`, () => {
      const l = Object.assign({}, myLook()); for (const sl of slots) l[sl] = look[sl];
      wear(l);
    }, () => {
      const cur = myLook(); for (const sl of slots) look[sl] = cur[sl];
      P.toast('買った服は、クロークに入れました'); render();
    }, { yes: '着替える', no: '着替えない' });
  }
  function wear(l) {
    l = AV.clean(l);
    const done = () => { S.av = l; P.saveLocal(); P.sound('ok'); P.toast('アバターを着がえました'); const keep = look; look = Object.assign({}, l); for (const sl of Object.keys(keep)) if (!owned(sl, keep[sl])) look[sl] = keep[sl]; render(); };
    if (!P.online()) { if (P.FR.available()) { P.toast('サーバーにつながっていません'); return; } done(); return; }
    P.soc('avatar', { look: l }, res => { if (res.ok) done(); else P.toast('保存できませんでした'); });
  }
  $('#avGrid2').addEventListener('click', e => {
    const b = e.target.closest('.av-item'); if (!b || b.dataset.line) return;
    const sl = b.dataset.sl, id = b.dataset.id, entry = AV.CATALOG[sl].find(x => x[0] === id);
    const again = look[sl] === id;
    look[sl] = id; P.sound('tap'); render();
    if (mode !== 'shop') return;
    if (owned(sl, id)) { hinata('have'); return; }
    if (again) askBuy(sl, id);
    else hinata('pick');
  });
  $('#avGrid2').addEventListener('click', e => { if (e.target.closest('[data-goshop]')) switchMode(); });
  $('#avClerkImg').onclick = () => hinata('pick');
  $('#avTabs').addEventListener('click', e => { const b = e.target.closest('[data-slot]'); if (b) { slot = b.dataset.slot; render(); } });
  document.querySelectorAll('.av-presets [data-preset]').forEach(b => b.onclick = () => {
    const p = AV.PRESETS[b.dataset.preset];
    look = Object.assign({}, look, { head: p.head, body: p.body });
    render();
  });
  $('#avSave').onclick = () => { if (unowned().length) return; wear(look); };
  const leave = () => { if (from === 'shop' && window.SHOP) window.SHOP.open(); else openHub(); };
  $('#avBack').onclick = () => {
    if (mode === 'closet' && changed()) P.confirmBox('着がえを保存せずにもどりますか？', leave);
    else leave();
  };

  // キャラクター画面は、えらぶ画面から開いて、えらぶ画面にもどる
  $('#charaBack').onclick = openHub;
  window.AVATAR_UI = { open, openHub };
})();
