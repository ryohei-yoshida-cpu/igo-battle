/* 九路 Blitz — 接続先の設定
 * Cloudflare で公開したサイト（https://igo-battle.〇〇.workers.dev）で開くときは、空のままで自動でつながります。
 * GitHub Pages など別の場所で開くときだけ、対人戦サーバーの住所を書いてください。例：
 *   window.KURO9_WS = 'wss://igo-battle.〇〇.workers.dev/ws';
 */
// Cloudflare 上・手元のテスト（localhost）では同じサイトにつなぐので、ここは使わない
if (!window.KURO9_WS && !/\.workers\.dev$|^localhost$|^127\./.test(location.hostname)) window.KURO9_WS = 'wss://igo-battle.ryohei-yoshida.workers.dev/ws';
