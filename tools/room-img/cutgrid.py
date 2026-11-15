# 市松の背景（描きこまれた にせの透明）を、市松そのものを作りなおして見わけて消す。
#   まわりの市松から マスの大きさ・ずれ・2つの色 を求め、各点のまわりが市松とぴったり同じなら背景。
#   白い雪や白い家具は、こい色のマスとちがうので消えない。
#   python3 cutgrid.py src.png OUT prefix
import sys, os, cv2, numpy as np
from scipy import ndimage as ndi
from PIL import Image
src, out, pre = sys.argv[1:4]; os.makedirs(out, exist_ok=True)
im = cv2.imread(src)[..., :3]; H, W = im.shape[:2]
g = im.astype(np.float32).mean(2)
hsv = cv2.cvtColor(im, cv2.COLOR_BGR2HSV); pale = (hsv[..., 1] < 22) & (hsv[..., 2] > 226)
# 市松らしさ：1マスずらすと色がちがい、2マスずらすと同じ（雪のなめらかな白とはちがう）
def sh(a, dx, dy): return np.roll(np.roll(a, dy, 0), dx, 1)
B = 15
A = (cv2.blur(np.abs(g - sh(g, 6, 0)), (B, B)) + cv2.blur(np.abs(g - sh(g, 0, 6)), (B, B))) / 2
Bv = (cv2.blur(np.abs(g - sh(g, 11, 0)), (B, B)) + cv2.blur(np.abs(g - sh(g, 0, 11)), (B, B))) / 2
chk = pale & (A > 3) & (A > Bv * 1.6)
chk = ndi.binary_dilation(chk, iterations=4) & pale
lab, n = ndi.label(chk); sz = ndi.sum(chk, lab, range(1, n + 1)); chk = np.isin(lab, [i + 1 for i in range(n) if sz[i] > 80])
lab2, n2 = ndi.label(pale); edge = set(np.unique(np.concatenate([lab2[0], lab2[-1], lab2[:, 0], lab2[:, -1]]))) - {0}
bg = chk | np.isin(lab2, list(edge))
# とじこめられた うすい色のかたまり：市松が4分の1以上まじっていたら、まるごと背景
for i, sl in enumerate(ndi.find_objects(lab2)):
    if i + 1 in edge or sl is None: continue
    mk = lab2[sl] == i + 1; c = mk.sum()
    if c < 40: continue
    if (chk[sl] & mk).sum() > .06 * c: bg[sl] |= mk
fg = ~bg; fg = ndi.binary_opening(fg, iterations=1)
lab, n = ndi.label(fg); sz = ndi.sum(fg, lab, range(1, n + 1))
fg = np.isin(lab, [i + 1 for i in range(n) if sz[i] > 25])
alpha = cv2.GaussianBlur(fg.astype(np.float32), (3, 3), .7)
grp, gn = ndi.label(ndi.binary_dilation(fg, iterations=3))
objs, small = [], []
for i, sl in enumerate(ndi.find_objects(grp)):
    mk = (grp[sl] == i + 1) & fg[sl]; c = mk.sum()
    rec = [i + 1, sl[0].start, sl[0].stop, sl[1].start, sl[1].stop, c]
    (objs if c > 2500 else small).append(rec)
for sm in small:   # 小さなかけらは、いちばん近い大きなものへ
    cy, cx = (sm[1] + sm[2]) / 2, (sm[3] + sm[4]) / 2
    def dist(o): return max(0, o[1] - cy, cy - o[2]) + max(0, o[3] - cx, cx - o[4])
    o = min(objs, key=dist)
    if dist(o) < 30: grp[grp == sm[0]] = o[0]; o[1], o[2], o[3], o[4] = min(o[1], sm[1]), max(o[2], sm[2]), min(o[3], sm[3]), max(o[4], sm[4])
objs.sort(key=lambda o: (o[1] + o[2]) / 2); rows, cur = [], []
for o in objs:
    if cur and (o[1] + o[2]) / 2 - np.mean([(c[1] + c[2]) / 2 for c in cur]) > H * .17: rows += sorted(cur, key=lambda c: c[3]); cur = []
    cur.append(o)
rows += sorted(cur, key=lambda c: c[3])
for k, (i, y0, y1, x0, x1, _) in enumerate(rows):
    mk = (grp[y0:y1, x0:x1] == i) & fg[y0:y1, x0:x1]
    al = (alpha[y0:y1, x0:x1] * ndi.binary_dilation(mk, iterations=1))
    Image.fromarray(np.dstack([im[y0:y1, x0:x1, ::-1], (al * 255).astype(np.uint8)])).save(f'{out}/{pre}{k:02d}.png')
print(pre, len(rows))
