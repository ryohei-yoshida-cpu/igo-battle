# 6つ目のセット：ふつうの洋室の家具（白い背景から切りぬき・角度を測ってそろえる）
import cv2, numpy as np, os, sys
sys.path.insert(0, '/tmp/claude-0/ang'); from m3 import meas
IN, OUT = 'tools/room-img/cut14', 'tools/room-img/cut15'; os.makedirs(OUT, exist_ok=True)
# (src, id, 名前, 種類, w, d, 値段, 角度をそろえるか)
T = [('k100', 'y_dining', 'ダイニングセット', 'floor', 2, 2, 300, 1), ('k101', 'y_bed', 'ナチュラルなベッド', 'floor', 2, 3, 400, 1), ('k102', 'y_desk', '机といす', 'floor', 2, 1, 300, 1),
     ('k104a', 'y_sofa', 'グリーンのソファ', 'floor', 2, 1, 300, 1), ('k104b', 'y_armchair', '革のひとりがけ', 'floor', 1, 1, 200, 1), ('k105', 'y_bookshelf', '木の本棚', 'floor', 1, 1, 200, 1),
     ('k106', 'y_kitchen', 'キッチン', 'floor', 3, 1, 400, 1), ('k107', 'y_cupboard', '食器棚', 'floor', 2, 1, 300, 1), ('k108', 'y_wardrobe', '洋服だんす', 'floor', 2, 1, 300, 1),
     ('k109', 'y_chest', 'チェスト', 'floor', 2, 1, 200, 1), ('k110', 'y_trunk', '古いトランク', 'floor', 2, 1, 200, 1), ('k112', 'y_floorlamp', 'フロアランプ', 'floor', 1, 1, 100, 0),
     ('k113', 'y_tablelamp', 'テーブルランプ', 'floor', 1, 1, 100, 0), ('k116', 'y_roundtable', '丸いコーヒーテーブル', 'floor', 1, 1, 200, 0), ('k117', 'y_ottoman', 'オットマン', 'floor', 1, 1, 100, 1),
     ('k114', 'y_pendant', '吊りランプ', 'wall', 1, 4.2, 200, 0), ('k115', 'y_sconce', '壁のランプ', 'wall', 1.1, 3, 100, 0)]
CLOAK = {'y_wardrobe', 'y_chest'}
def shear(im):
    sL, sR = meas(im); d = 1 / (sL - sR); c = .5 - d * sL; H, W = im.shape[:2]
    M = np.float32([[1, 0, 0], [c, d, max(0, -c * W)]])
    im = cv2.warpAffine(im, M, (W, int(np.ceil(d * H + abs(c) * W)) + 2), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_CONSTANT, borderValue=(0, 0, 0, 0))
    ys, xs = np.nonzero(im[..., 3] > 8); return im[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
def fit(im):
    h, w = im.shape[:2]; f = min(1, 480 / max(h, w))
    return cv2.resize(im, (round(w * f), round(h * f)), interpolation=cv2.INTER_AREA) if f < 1 else im
L = []
for s, k, n, kind, w, d, p, sh in T:
    im = cv2.imread(f'{IN}/{s}.png', cv2.IMREAD_UNCHANGED)
    if sh: im = shear(im)
    cv2.imwrite(f'{OUT}/{k}.png', fit(im))
    if kind == 'wall': L.append(f"    {{ id: '{k}', name: '{n}', style: 'yo', kind: 'wall', w: {w}, h: {w}, v: {d}, price: {p}, draw() {{}} }}")
    else: L.append(f"    {{ id: '{k}', name: '{n}', style: 'yo', kind: 'floor', w: {w}, d: {d}, price: {p}{', cloak: true' if k in CLOAK else ''}, draw() {{}} }}")
# ラグ：4つの角を床のひし形へ
im = cv2.imread(f'{IN}/k111.png', cv2.IMREAD_UNCHANGED); a = (im[..., 3] > 128).astype(np.uint8)
cs, _ = cv2.findContours(a, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE); h = cv2.convexHull(max(cs, key=cv2.contourArea))
q = cv2.approxPolyDP(h, .03 * cv2.arcLength(h, True), True).reshape(-1, 2).astype(np.float32)
top, right, bot, left = q[np.argmin(q[:, 1])], q[np.argmax(q[:, 0])], q[np.argmax(q[:, 1])], q[np.argmin(q[:, 0])]
fw = fd = 3; u = 480 / 6
M = cv2.getPerspectiveTransform(np.float32([top, right, bot, left]), np.float32([[fd, 0], [fw + fd, fw / 2], [fw, (fw + fd) / 2], [0, fd / 2]]) * u)
cv2.imwrite(f'{OUT}/y_rug.png', cv2.warpPerspective(im, M, (480, 240), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_CONSTANT, borderValue=(0, 0, 0, 0)))
L.append("    { id: 'y_rug', name: 'ナチュラルなラグ', style: 'yo', kind: 'flat', w: 3, d: 3, price: 200, draw() {} }")
s = open('common/room-items-pics.js').read()
s = s.replace('\n  ];\n})', ',\n    /* 6つ目のセット：ふつうの洋室の家具 */\n' + ',\n'.join(L) + '\n  ];\n})', 1)
open('common/room-items-pics.js', 'w').write(s); print(len(L), q.tolist())
