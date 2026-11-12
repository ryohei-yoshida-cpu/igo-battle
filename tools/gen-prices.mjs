// マイルームの値段表（server/prices.js）を、common のカタログから作り直す
//   node tools/gen-prices.mjs
import fs from 'node:fs';
const g = globalThis; g.window = g;
for (const f of ['common/room-items-more.js', 'common/room-art.js']) (0, eval)(fs.readFileSync(f, 'utf8'));
const R = g.ROOMART;
const ITEMS = {}; for (const c of R.CATALOG) ITEMS[c.id] = [c.price, c.kind === 'wall' ? 'w' : c.kind === 'flat' ? 'f' : 'b'];
const FLOORS = {}, WALLS = {};
for (const [k, v] of Object.entries(R.FLOORS)) FLOORS[k] = v.price;
for (const [k, v] of Object.entries(R.WALLS)) WALLS[k] = v.price;
fs.writeFileSync('server/prices.js', `/* 九路 Blitz — ショップの値段（サーバーが正）。tools/gen-prices.mjs で common のカタログから作る
 * [値段, 種類] 種類: b=床の家具 f=ラグ w=壁の家具 */
export const ITEMS = ${JSON.stringify(ITEMS)};
export const FLOORS = ${JSON.stringify(FLOORS)};
export const WALLS = ${JSON.stringify(WALLS)};
`);
console.log('items', Object.keys(ITEMS).length);
