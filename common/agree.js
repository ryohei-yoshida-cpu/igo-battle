/* 共通：はじめに利用規約の大事なところを見せて、同意してもらう（規約を変えたら AGREE_V を上げる → もう一度出る） */
(function () {
  'use strict';
  const P = window.APP, S = P.S;
  const AGREE_V = 2;   // 2026/11/16：メッセージ・碁会所を追加
  let done = false;
  try { done = +localStorage.getItem('kuro9.agree') >= AGREE_V; } catch (e) {}
  if (done || (S.agreeV | 0) >= AGREE_V) return;
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
    P.save(); el.remove();
  };
})();
