# 市松の背景を消して、まとまり（近いかけらは1つに）ごとに切りぬく。上の段から左→右の順に番号
#   python3 cutblobs.py src.png OUT prefix
import sys, os, cv2, numpy as np
from scipy import ndimage as ndi
from PIL import Image
src, out, pre = sys.argv[1:4]; os.makedirs(out, exist_ok=True)
im = cv2.imread(src)[..., :3]; H, W = im.shape[:2]
hsv = cv2.cvtColor(im, cv2.COLOR_BGR2HSV); v = hsv[..., 2].astype(np.float32)
pale = (hsv[..., 1] < 20) & (v > 228)
K = 7
allpale = ndi.minimum_filter(pale.astype(np.uint8), size=K) > 0
mean = cv2.blur(v, (K, K)); sq = cv2.blur(v * v, (K, K)); sd = np.sqrt(np.maximum(sq - mean * mean, 0))
chk = allpale & (sd > 2.5) & (sd < 12)
chk = ndi.binary_dilation(chk, iterations=K // 2 + 1) & pale
lab, n = ndi.label(chk); sz = ndi.sum(chk, lab, range(1, n + 1)); chk = np.isin(lab, [i + 1 for i in range(n) if sz[i] > 60])
lab2, n2 = ndi.label(pale); edge = set(np.unique(np.concatenate([lab2[0], lab2[-1], lab2[:, 0], lab2[:, -1]]))) - {0}
bg = chk | np.isin(lab2, list(edge))
fg = ndi.binary_opening(~bg, iterations=1)
alpha = cv2.GaussianBlur(fg.astype(np.float32), (3, 3), .7)
grp, g = ndi.label(ndi.binary_dilation(fg, iterations=int(sys.argv[4]) if len(sys.argv) > 4 else 9))
objs = []
for i, s in enumerate(ndi.find_objects(grp)):
    mk = (grp == i + 1) & fg
    if mk.sum() < 1500: continue
    ys, xs = np.nonzero(mk); objs.append((ys.mean(), xs.mean(), i + 1, ys.min(), ys.max() + 1, xs.min(), xs.max() + 1))
rows = sorted(objs, key=lambda o: o[0]); out_list = []; cur = []
for o in rows:
    if cur and o[0] - np.mean([c[0] for c in cur]) > H * .18: out_list += sorted(cur, key=lambda c: c[1]); cur = []
    cur.append(o)
out_list += sorted(cur, key=lambda c: c[1])
for k, (_, _, i, y0, y1, x0, x1) in enumerate(out_list):
    mk = ((grp == i) & fg); mk = ndi.binary_dilation(mk, iterations=1) & (alpha > 0)
    a = (alpha * mk)[y0:y1, x0:x1]
    Image.fromarray(np.dstack([im[y0:y1, x0:x1, ::-1], (a * 255).astype(np.uint8)])).save(f'{out}/{pre}{k:02d}.png')
print(pre, len(out_list))
