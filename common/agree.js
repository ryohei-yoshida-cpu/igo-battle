/* 共通：はじめに利用規約の大事なところを見せて、同意してもらう（規約を変えたら AGREE_V を上げる → もう一度出る） */
(function () {
  'use strict';
  const P = window.APP, S = P.S;
  const AGREE_V = 3;   // 2026/11/16：年齢確認・連投の禁止を追加
  let done = false;
  try { done = +localStorage.getItem('kuro9.agree') >= AGREE_V; } catch (e) {}
  function showAgree() {
  const el = document.createElement('div');
  el.className = 'agree-back';
  el.innerHTML = `<div class="agree" role="dialog" aria-modal="true" aria-labelledby="agTitle">
    <h2 id="agTitle">はじめに・おやくそく</h2>
    <p>囲碁BLITZ では、ほかの人と対局したり、一言・日記・メッセージ・碁会所で交流したりできます。みんなが安心して遊べるように、次のことは禁止です。</p>
    <ul>
      <li><b>個人情報のやりとり</b>（本名・住所・学校・電話番号・メールアドレス・SNSのIDなど）</li>
      <li><b>オフラインでの勧誘</b>（会う約束・ほかのアプリやサイトへの誘い出し）</li>
      <li><b>犯罪や、そのきっかけになること</b>（お金・物の取引、アカウントや銭の売り買いなど）</li>
      <li>悪口・いやがらせ・性的な書きこみ・なりすまし</li>
    </ul>
    <p class="agree-note">守られないときは、書きこみの削除やアカウントの利用停止をします。書きこみは、消したあとも運営が一定期間保管します。困ったときは「通報」や「ブロック」を使ってください。</p>
    <label class="agree-chk"><input type="checkbox" id="agChk"> <span><a href="terms.html" target="_blank" rel="noopener">利用規約</a>と<a href="privacy.html" target="_blank" rel="noopener">プライバシーポリシー</a>を読んで、同意します</span></label>
    <button type="button" class="btn primary" id="agOk" disabled>同意してはじめる</button>
  </div>`;
  document.body.append(el);
  const chk = el.querySelector('#agChk'), ok = el.querySelector('#agOk');
  chk.onchange = () => { ok.disabled = !chk.checked; };
  ok.onclick = () => {
    S.agreeV = AGREE_V; try { localStorage.setItem('kuro9.agree', String(AGREE_V)); } catch (e) {}
    P.save(); el.remove(); askBirth();
  };
  }

  /* ---------- 年齢確認：生年月日（1回だけ。あとから変えられない） ----------
   *   15歳以下（中学生まで）：メッセージ・掲示板・コメント・一言コメントは使えない。碁会所は「kids碁会所」だけ */
  const KID_MAX = 15;
  function ageOf(b) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(b || '')) return null;
    const t = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
    const [y, m, d] = b.split('-').map(Number), [ty, tm, td] = t.split('-').map(Number);
    return ty - y - ((tm < m || (tm === m && td < d)) ? 1 : 0);
  }
  const AGE = {
    birth: () => S.birth || null,
    age: () => ageOf(S.birth),
    kid: () => { const a = ageOf(S.birth); return a == null || a <= KID_MAX; },   // 誕生日がまだのときも、子どもと同じあつかい
    apply
  };
  window.AGE = AGE;
  // 15歳以下：✉️ と碁会所内マッチは出さない
  function apply() {
    const kid = AGE.kid(), q = s => document.querySelector(s);
    if (q('#openMail')) q('#openMail').hidden = kid;
    if (q('#goGuild')) q('#goGuild').hidden = kid;
    const b = q('#setBirth');
    if (b) { const a = AGE.age(); b.textContent = S.birth ? `生年月日：${S.birth.replace(/^(\d+)-0?(\d+)-0?(\d+)$/, '$1年$2月$3日')}（${a}歳）・あとから変えられません${a <= KID_MAX ? '。15歳以下なので、メッセージ・掲示板・コメント・一言は使えません（碁会所はkids碁会所）' : ''}` : '生年月日：まだ登録されていません'; }
  }
  function askBirth() {
    apply();
    if (S.birth) return;
    const el = document.createElement('div');
    el.className = 'agree-back';
    const y0 = new Date().getFullYear();
    const opt = (a, b, sel) => Array.from({ length: b - a + 1 }, (_, i) => a + i).map(v => `<option value="${v}"${v === sel ? ' selected' : ''}>${v}</option>`).join('');
    el.innerHTML = `<div class="agree" role="dialog" aria-modal="true" aria-labelledby="bdTitle">
      <h2 id="bdTitle">生年月日を教えてください</h2>
      <p>年齢にあわせて、使える機能が変わります。<b>あとから変えることはできません。</b></p>
      <div class="bd-row"><select class="select" id="bdY"><option value="">年</option>${Array.from({ length: 98 }, (_, i) => y0 - 3 - i).map(v => `<option value="${v}">${v}</option>`).join('')}</select><select class="select" id="bdM"><option value="">月</option>${opt(1, 12)}</select><select class="select" id="bdD"><option value="">日</option>${opt(1, 31)}</select></div>
      <p class="agree-note">15歳以下（中学生まで）の人は、メッセージ・掲示板・コメント・一言コメントが使えません。碁会所は、15歳以下の人だけの「kids碁会所」に入れます。生年月日はほかの人には見えません。</p>
      <p class="bd-check" id="bdCheck" hidden></p>
      <button type="button" class="btn primary" id="bdOk" disabled>これで登録する</button>
    </div>`;
    document.body.append(el);
    const q = s => el.querySelector(s), val = () => {
      const y = q('#bdY').value, m = q('#bdM').value, d = q('#bdD').value; if (!y || !m || !d) return null;
      const s = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`, t = new Date(s + 'T00:00:00Z');
      return isNaN(t) || t.toISOString().slice(0, 10) !== s ? null : s;
    };
    let sure = false;
    el.addEventListener('change', () => { sure = false; const v = val(); q('#bdOk').disabled = !v; q('#bdCheck').hidden = true; q('#bdOk').textContent = 'これで登録する'; });
    q('#bdOk').onclick = () => {
      const v = val(); if (!v) return;
      if (!sure) {   // 変えられないので、もう一度だけ確かめる
        sure = true; const a = ageOf(v);
        q('#bdCheck').hidden = false; q('#bdCheck').textContent = `${v.replace(/^(\d+)-0?(\d+)-0?(\d+)$/, '$1年$2月$3日')}（${a}歳）でまちがいありませんか？ あとから変えられません。`;
        q('#bdOk').textContent = 'まちがいない・登録する'; return;
      }
      S.birth = v; P.save(); el.remove(); apply();
      if (P.online()) P.soc('birth', { birth: v }, r => { if (r && r.ok && r.birth !== S.birth) { S.birth = r.birth; P.save(); apply(); } });
    };
  }
  // サーバーとそろえる（ほかの端末で登録していれば、そちらが正しい）
  let synced = false;
  setInterval(() => {
    if (synced || !P.online()) return;
    synced = true;
    P.soc('me', {}, r => {
      if (!r || !r.ok) { synced = false; return; }
      if (r.birth && r.birth !== S.birth) { S.birth = r.birth; P.save(); document.querySelectorAll('.agree-back').forEach(x => { if (x.querySelector('#bdOk')) x.remove(); }); }
      else if (!r.birth && S.birth) P.soc('birth', { birth: S.birth }, () => {});
      apply();
    });
  }, 2500);
  document.addEventListener('kuro9screen', apply);
  if (done || (S.agreeV | 0) >= AGREE_V) askBirth(); else showAgree();
})();
