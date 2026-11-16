/* デイリーミッション（日本時間で毎日リセット）。1つ50銭、5つ全部で さらに100銭（プレゼントボックスへ）
 *   games  … 5局打つ（オンライン・Bot・ソロの実戦。短すぎる対局は数えない）
 *   atari  … アタリを20回（自分の手で、相手の石のダメを1つにした）
 *   keima  … ケイマを10回（自分の石から、桂馬の位置に打った）
 *   tobi   … 一間トビを10回（自分の石から、1つあけてまっすぐ。あいだは空いている）
 *   ogeima … 大ゲイマを5回（自分の石から、1つ横・3つ先）
 * 形（ケイマ・トビ・大ゲイマ）は「くっつけずに離れて打った手」だけ数える（自分の石のとなりに打った手は数えない）。
 * 数えるのはサーバー：対局の手順を自分で並べなおして数える（アプリから送られた回数は使わない）。
 */
import * as GO from './gorules.js';
import { addGift } from './econ.js';

export const MISSIONS = [
  { id: 'games', name: '対局を5局打つ', n: 5 },
  { id: 'atari', name: 'アタリを20回する', n: 20 },
  { id: 'keima', name: 'ケイマを10回打つ', n: 10 },
  { id: 'tobi', name: '一間トビを10回打つ', n: 10 },
  { id: 'ogeima', name: '大ゲイマを5回打つ', n: 5 }
];
export const MISSION_ZENI = 50, MISSION_ALL = 100;
const SHAPES = {
  tobi: [[2, 0], [-2, 0], [0, 2], [0, -2]],
  keima: [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]],
  ogeima: [[1, 3], [3, 1], [-1, 3], [-3, 1], [1, -3], [3, -1], [-1, -3], [-3, -1]]
};

// 1手ぶんの形：b は打つ前の盤、nb は打ったあとの盤
function shapesOf(b, nb, N, p, c) {
  const x = p % N, y = (p / N) | 0, at = (dx, dy) => { const X = x + dx, Y = y + dy; return X < 0 || Y < 0 || X >= N || Y >= N ? -1 : Y * N + X; };
  const out = {};
  const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => at(dx, dy)).filter(q => q >= 0);
  if (!near.some(q => b[q] === c)) {   // くっつけていない手
    for (const [k, offs] of Object.entries(SHAPES)) for (const [dx, dy] of offs) {
      const q = at(dx, dy); if (q < 0 || b[q] !== c) continue;
      if (k === 'tobi' && b[at(dx / 2, dy / 2)] !== 0) continue;   // 一間トビは、あいだが空いている
      out[k] = 1; break;
    }
  }
  if (near.some(q => nb[q] === 3 - c && GO.libs(nb, N, q) === 1)) out.atari = 1;   // 相手の石をアタリに
  return out;
}

// 対局の手順から、自分（color）の形を数える。ルールに合わない手順なら null
export function countShapes(size, moves, color, h) {
  const N = size === 13 ? 13 : 9;
  let b = GO.start(N, h || 0), ko = -1, c = h >= 2 ? 2 : 1;
  const sum = { atari: 0, keima: 0, tobi: 0, ogeima: 0 };
  for (const raw of (moves || []).slice(0, 400)) {
    const p = raw | 0;
    if (p < 0) { ko = -1; c = 3 - c; continue; }
    const r = GO.play(b, N, p, c, ko); if (!r) return null;
    if (c === color) for (const k of Object.keys(shapesOf(b, r.board, N, p, c))) sum[k]++;
    b = r.board; ko = r.ko; c = 3 - c;
  }
  return sum;
}

const dayOf = now => new Date(now + 9 * 3600e3).toISOString().slice(0, 10);
// 今日のデイリーミッション（日付が変わっていたら 0 から）
export function missionsOf(r, now) {
  const day = dayOf(now);
  if (!r.dm || r.dm.day !== day) return { day, games: 0, atari: 0, keima: 0, tobi: 0, ogeima: 0, done: [], all: false };
  return r.dm;
}
// 1局ぶんを足す。クリアしたものは50銭、全部そろったら100銭をプレゼントボックスへ。新しくクリアしたものを返す
export function addMissions(r, now, add) {
  const dm = r.dm = missionsOf(r, now), cleared = [];
  for (const m of MISSIONS) {
    dm[m.id] = Math.min(m.n, (dm[m.id] | 0) + ((add && add[m.id]) | 0));
    if (dm[m.id] >= m.n && !dm.done.includes(m.id)) { dm.done.push(m.id); cleared.push(m.id); addGift(r, 'mission', MISSION_ZENI, `デイリーミッション「${m.name}」クリア`, now); }
  }
  if (!dm.all && dm.done.length === MISSIONS.length) { dm.all = true; cleared.push('all'); addGift(r, 'mission', MISSION_ALL, 'デイリーミッション ぜんぶクリア！', now); }
  return cleared;
}
