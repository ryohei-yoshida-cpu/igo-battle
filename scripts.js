/* 囲碁BLITZ — 台本形式の脚本を読みこむしくみ
 * addScript(id, タイトル, 紹介文, [ [幕のタイトル, 台本テキスト], ... ])
 * 台本テキストは1行ずつ：
 *   名前「セリフ」 … セリフ（名前の後ろの（老）などもそのまま表示）
 *   （ト書き）      … ナレーションとして表示
 *   それ以外        … ナレーション
 * 空行は無視します。
 */
(function () {
  function parse(text) {
    const out = [];
    for (let raw of text.split('\n')) {
      const line = raw.trim();
      if (!line) continue;
      const m = line.match(/^([^「（(\s][^「]{0,15})「([\s\S]*)」$/);
      if (m) { out.push([m[1].trim(), m[2].trim()]); continue; }
      out.push(['', line.replace(/^[（(]/, '').replace(/[）)]$/, '')]);
    }
    return out;
  }
  window.addScript = (id, title, sub, parts, extra) => {
    (window.STORIES = window.STORIES || []).push(Object.assign({
      id, title, sub, user: true,
      parts: parts.map(([t, body]) => ({ title: t, lines: parse(body) }))
    }, extra || {}));
  };
})();
