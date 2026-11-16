/* レート・段級位（サーバーが計算する。アプリから送られてきた数字は使わない） */
import { RANKUP, addGift, ensureEcon } from './econ.js';
import { ITEMS } from './prices.js';
/* ---------- レート（サーバーが計算する。アプリから送られてきた数字は使わない） ---------- */
export const TH = [1050, 1100, 1150, 1200, 1250, 1300, 1350, 1400, 1500, 1600, 1700, 1800, 1900, 2000], DAN_FROM = 10, DAN_STREAK = 4, START_RATE = 1050;
export const rankFrom = v => { let i = 0; for (let k = 0; k < TH.length; k++) if (v >= TH[k]) i = k; return i; };
export const botRating = i => i < TH.length - 1 ? Math.round((TH[i] + TH[i + 1]) / 2) : TH[i] + 50;
export function eloD(my, op, score, games) {
  const exp = 1 / (1 + Math.pow(10, (op - my) / 400));
  let d = Math.round((games < 20 ? 32 : 16) * (score - exp));
  if (d === 0 && score !== 0.5) d = score ? 1 : -1;
  return d;
}
// その盤の戦績（はじめてなら、前のデータから引きつぐ。上限 2050）
export function rateOf(r, key) {
  r.rate = r.rate || {};
  if (!r.rate[key]) {
    // はじめては、だれでも 1050 から（アプリから送られてくる数字は、書きかえられるので使わない）
    r.rate[key] = { rating: START_RATE, games: 0, wins: 0, draws: 0, streak: 0, earnedDan: -1 };
  }
  return r.rate[key];
}
export const dispRank = t => { const r = rankFrom(t.rating); return r < DAN_FROM ? r : Math.max(DAN_FROM - 1, Math.min(r, t.earnedDan)); };
// 1局ぶん反映して、変わったレートを返す。vsBot：自分よりレートの低い Bot に勝っても上がらない
// 段級位が上がったら、ごほうび 1000銭（段級位ごとに1回だけ）。アプリからの rankup を待たずにサーバーが入れる
export const RANK_NAMES = ['10級', '9級', '8級', '7級', '6級', '5級', '4級', '3級', '2級', '1級', '初段', '二段', '三段', '四段'];
export function rankGift(r, key, before, t, now) {
  const nr = dispRank(t); if (nr <= before) return;
  ensureEcon(r);
  const ck = key === 'go9' ? 'rank' : 'rank_' + key, list = r.claims[ck] = r.claims[ck] || [];
  if (list.includes(nr)) return;
  list.push(nr); addGift(r, 'rank', RANKUP, `${key === 'go13' ? '13路' : ''}${RANK_NAMES[nr] || ''}昇格のごほうび`, now);
}
// 段級位のごほうびの家具（9路・13路のどちらかで、はじめてとどいたら1回だけ）。五段の免状は、五段ができたら
export const RANK_ITEMS = { 2: ['rw_zashiki'], 4: ['rw_isshu'], 6: ['rw_gogudana'], 8: ['rw_shinbo'], 9: ['rw_tokonoma'],
  10: ['rw_menjo1', 'rw_makiegoban'], 11: ['rw_menjo2', 'rw_kinbyobu'], 12: ['rw_menjo3', 'rw_meijin'], 13: ['rw_menjo4', 'rw_kisei'] };
export function rankItems(r, now) {
  if (!r.rate) return;
  const best = Math.max(...['go9', 'go13'].map(k => r.rate[k] ? dispRank(r.rate[k]) : -1));
  r.rankItems = r.rankItems || [];
  for (const [nr, list] of Object.entries(RANK_ITEMS)) {
    if (+nr > best || r.rankItems.includes(+nr)) continue;
    r.rankItems.push(+nr);
    const items = list.filter(k => ITEMS[k]);
    if (items.length) addGift(r, 'rank', 0, `${RANK_NAMES[nr]}の記念品（${items.map(k => RANK_ITEM_NAME[k] || k).join('・')}）`, now, { items });
  }
}
export const RANK_ITEM_NAME = { rw_zashiki: '対局の座敷', rw_isshu: '一手入魂の額', rw_gogudana: '碁具の飾り棚', rw_shinbo: '深謀遠慮の額', rw_tokonoma: '碁打ちの床の間',
  rw_menjo1: '初段の免状', rw_makiegoban: '蒔絵の名品碁盤', rw_menjo2: '二段の免状', rw_kinbyobu: '富士と鶴の金屏風', rw_menjo3: '三段の免状', rw_meijin: '名人の盾', rw_menjo4: '四段の免状', rw_kisei: '棋聖のトロフィー' };
// 初心者の保護：はじめの10局は、負けてもレートが下がらない
export const PROTECT_GAMES = 10;
export function applyRate(t, op, score, vsBot) {
  let d = eloD(t.rating, op, score, t.games);
  if (vsBot && d > 0 && op < t.rating) d = 0;
  if (d < 0 && t.games < PROTECT_GAMES) d = 0;
  t.rating = Math.max(800, t.rating + d); t.games++;
  if (score === 1) { t.wins++; t.streak++; } else if (score === 0.5) t.draws++; else t.streak = 0;
  const rr = rankFrom(t.rating); if (rr >= DAN_FROM && t.streak >= DAN_STREAK && rr > t.earnedDan) t.earnedDan = rr;
  return d;
}
