/* 共通：不適切な言葉のチェック（日記・コメント・一言チャット・ひとこと・名前）
 *   性的な言葉／暴力的な言葉／ひどい悪口・差別語／個人情報（URL・メール・電話番号）を止める。
 *   ひらがな・カタカナ・全角半角・空白や記号のはさみこみ（「し ね」「シ.ネ」など）をそろえてから調べる。
 *   check(text) → null（OK）または理由 'sexual' | 'violent' | 'abuse' | 'contact'
 */
const SEXUAL = ['せっくす', 'えっち', 'えろい', 'えろ画像', 'えろどう', 'ちんこ', 'ちんぽ', 'ちんちん', 'まんこ', 'おっぱい', 'ぱいずり', 'ふぇら', 'なかだし', 'れいぷ', 'ぬーど', 'おなにー', 'おなに', 'ぼっき', 'しゃせい', 'あいぶ', 'ぱんつみせ', 'はだかみせ', 'やらせて', 'やりもく', 'せふれ', 'えんこう', 'ぱぱかつ', 'ままかつ',
  '性交', '強姦', '援交', '売春', '買春', '痴漢', '陰部', '射精', '勃起', '乳首', '全裸', '裸の', '淫', '童貞', '処女', 'sex', 'porn', 'fuck', 'dick', 'pussy', 'tits', 'nude', 'hentai', 'xvideo', 'nsfw'];
const VIOLENT = ['ころす', 'ころして', 'ころされ', 'ころしたい', 'ぶっころ', 'さしころ', 'しんでくれ', 'しんでしまえ', 'しんどけ', 'くたばれ', 'なぐるぞ', 'なぐってやる', 'さすぞ', 'ばくは', 'ばくだん', 'くびつ', 'ころしてやる',
  '殺す', '殺し', '殺さ', '殺せ', '死ね', '氏ね', '刺す', '刺し殺', '爆破', '爆弾', '首吊', '自殺しろ', '殴るぞ', '殴ってやる', 'kill', 'kys'];
const ABUSE = ['きもい', 'きもすぎ', 'きしょい', 'うざい', 'うぜえ', 'くずが', 'くずやろう', 'ごみくず', 'ぶさいく', 'ぶすが', 'きえろ', 'がいじ', 'ちしょう', 'かたわ', 'めくら', 'つんぼ', 'きちがい', 'しなじん', 'ちょうせんじん',
  '消えろ', '池沼', '気持ち悪', '基地外', '支那', 'ゴミ人間', 'クズ野郎'];

// そろえる：全角→半角、カタカナ→ひらがな、小文字、空白・記号・のばし棒を取る
function norm(s) {
  return String(s || '').normalize('NFKC').toLowerCase()
    .replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60))
    .replace(/[\s　.,、。・･!！?？~〜ー\-_*＊/\\|'"`()（）「」『』【】\[\]{}<>＜＞♪☆★♡♥…:;]/g, '');
}
const N_SEX = SEXUAL.map(norm), N_VIO = VIOLENT.map(norm), N_ABU = ABUSE.map(norm);

export function check(text) {
  const raw = String(text || '');
  const n = norm(raw);
  // 個人情報・外への誘導（URL・メール・電話番号・LINE ID）
  if (/https?:|www\.|\.(com|net|jp|io|me|ly)\b/i.test(raw.normalize('NFKC')) || /[a-z0-9._-]+@[a-z0-9-]+\./i.test(raw.normalize('NFKC'))) return 'contact';
  if (/\d{10,}/.test(n) || /(line|ライン|らいん)(id|あいでぃ)/.test(n)) return 'contact';
  for (const w of N_SEX) if (w && n.includes(w)) return 'sexual';
  for (const w of N_VIO) if (w && n.includes(w)) return 'violent';
  // 「しね」は「楽しいしね」「しねま」を除いて止める
  if (/(^|[^い])しね(?!ま)/.test(n) || /(^|[^い])死ね/.test(n)) return 'violent';
  for (const w of N_ABU) if (w && n.includes(w)) return 'abuse';
  return null;
}
// 名前に使えない言葉なら「プレイヤー」にする
export const cleanName = name => { const s = String(name || '').slice(0, 12).trim(); return !s || check(s) ? 'プレイヤー' : s; };
