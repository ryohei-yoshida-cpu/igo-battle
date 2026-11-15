# 7つ目のセット：中華の家具（市松の背景から切りぬき）。同じカメラで描かれているので、目で測った傾き（前 0.18・横 -0.58）でまとめてそろえる
import cv2, numpy as np, os
IN, OUT = 'tools/room-img/cut16', 'tools/room-img/cut17'; os.makedirs(OUT, exist_ok=True)
SL, SR = .18, -.58
T = [('m100', 'c_dining', '円卓セット', 'floor', 2, 2, 400, 1), ('m101', 'c_bed', '天蓋の寝台', 'floor', 2, 3, 400, 1), ('m103', 'c_desk', '書斎の机', 'floor', 2, 1, 300, 1),
     ('m104', 'c_sofa', '羅漢床', 'floor', 2, 1, 400, 1), ('m105', 'c_shelf', '多宝格', 'floor', 2, 1, 300, 1), ('m106', 'c_kitchen', '中華のかまど', 'floor', 2, 1, 400, 1),
     ('m107', 'c_cupboard', '茶器の棚', 'floor', 2, 1, 300, 1), ('m108', 'c_wardrobe', '中華の衣装だんす', 'floor', 2, 1, 300, 1), ('m109', 'c_chest', '中華のチェスト', 'floor', 2, 1, 200, 1),
     ('m110', 'c_screen', '梅の衝立', 'floor', 2, 1, 300, 1), ('m112', 'c_floorlamp', '中華の灯籠スタンド', 'floor', 1, 1, 200, 0), ('m113', 'c_tablelamp', '角灯', 'floor', 1, 1, 100, 1),
     ('m116', 'c_teatable', '茶卓', 'floor', 1, 1, 200, 1), ('m117', 'c_stool', '鼓のいす', 'floor', 1, 1, 100, 0),
     ('m114', 'c_hanglantern', '宮灯', 'wall', 1.2, 4, 200, 0), ('m115', 'c_walllantern', '壁の提灯', 1.1, 'wall', 3, 100, 0)]
T[-1] = ('m115', 'c_walllantern', '壁の提灯', 'wall', 1.1, 3, 100, 0)
CLOAK = {'c_wardrobe', 'c_chest'}; PAD = {'c_floorlamp': 1.9, 'c_tablelamp': 2.2, 'c_stool': 1.4}
def shear(im):
    d = 1 / (SL - SR); c = .5 - d * SL; H, W = im.shape[:2]
    M = np.float32([[1, 0, 0], [c, d, max(0, -c * W)]])
    im = cv2.warpAffine(im, M, (W, int(np.ceil(d * H + abs(c) * W)) + 2), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_CONSTANT, borderValue=(0, 0, 0, 0))
    ys, xs = np.nonzero(im[..., 3] > 8); return im[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
L = []
for s, k, n, kind, w, d, p, sh in T:
    im = cv2.imread(f'{IN}/{s}.png', cv2.IMREAD_UNCHANGED)
    if sh: im = shear(im)
    if k in PAD: h, ww = im.shape[:2]; W2 = int(ww * PAD[k]); o = np.zeros((h, W2, 4), np.uint8); o[:, (W2 - ww) // 2:(W2 - ww) // 2 + ww] = im; im = o
    h, ww = im.shape[:2]; f = min(1, 480 / max(h, ww))
    if f < 1: im = cv2.resize(im, (round(ww * f), round(h * f)), interpolation=cv2.INTER_AREA)
    cv2.imwrite(f'{OUT}/{k}.png', im)
    if kind == 'wall': L.append(f"    {{ id: '{k}', name: '{n}', style: 'chu', kind: 'wall', w: {w}, h: {w}, v: {d}, price: {p}, draw() {{}} }}")
    else: L.append(f"    {{ id: '{k}', name: '{n}', style: 'chu', kind: 'floor', w: {w}, d: {d}, price: {p}{', cloak: true' if k in CLOAK else ''}, draw() {{}} }}")
im = cv2.imread(f'{IN}/m111.png', cv2.IMREAD_UNCHANGED); a = (im[..., 3] > 128).astype(np.uint8)
cs, _ = cv2.findContours(a, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE); h = cv2.convexHull(max(cs, key=cv2.contourArea))
q = cv2.approxPolyDP(h, .03 * cv2.arcLength(h, True), True).reshape(-1, 2).astype(np.float32)
top, right, bot, left = q[np.argmin(q[:, 1])], q[np.argmax(q[:, 0])], q[np.argmax(q[:, 1])], q[np.argmin(q[:, 0])]
u = 480 / 6
M = cv2.getPerspectiveTransform(np.float32([top, right, bot, left]), np.float32([[3, 0], [6, 1.5], [3, 3], [0, 1.5]]) * u)
cv2.imwrite(f'{OUT}/c_rug.png', cv2.warpPerspective(im, M, (480, 240), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_CONSTANT, borderValue=(0, 0, 0, 0)))
L.append("    { id: 'c_rug', name: '龍紋の絨毯', style: 'chu', kind: 'flat', w: 3, d: 3, price: 300, draw() {} }")
s = open('common/room-items-pics.js').read()
s = s.replace('\n  ];\n})', ',\n    /* 7つ目のセット：中華の家具 */\n' + ',\n'.join(L) + '\n  ];\n})', 1)
open('common/room-items-pics.js', 'w').write(s); print(len(L), len(q))
