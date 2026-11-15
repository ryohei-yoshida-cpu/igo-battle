/* 共通：年齢（誕生日はアカウントに1回だけ登録。あとから変えられない）
 *   15歳以下（中学生まで）は「子ども」：メッセージ・掲示板・コメント・一言コメントは使えない。ふつうの碁会所ではなく、kids碁会所に入れる
 *   誕生日がまだのときも、子どもと同じあつかい（交流の機能は使えない）
 */
export const KID_MAX = 15;
export function ageOf(birth, now) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birth || '')) return null;
  const t = new Date(now + 9 * 3600e3).toISOString().slice(0, 10);   // 日本の今日
  const [y, m, d] = birth.split('-').map(Number), [ty, tm, td] = t.split('-').map(Number);
  return ty - y - ((tm < m || (tm === m && td < d)) ? 1 : 0);
}
// 'adult'（16歳以上）/ 'kid'（15歳以下）/ 'unknown'（まだ登録していない）
export function ageState(r, now) { const a = ageOf(r && r.birth, now); return a == null ? 'unknown' : a > KID_MAX ? 'adult' : 'kid'; }
export function cleanBirth(v, now) {
  const s = String(v || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(s + 'T00:00:00Z'); if (isNaN(d) || d.toISOString().slice(0, 10) !== s) return null;
  const a = ageOf(s, now); return a != null && a >= 3 && a <= 120 ? s : null;
}
