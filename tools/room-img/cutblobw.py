# 白い背景のシートを、かたまりごとに切りぬく（行は上から、左→右）。python3 cutblobw.py src OUT prefix
import sys, os, cv2, numpy as np
from scipy import ndimage as ndi
from PIL import Image
src, out, pre = sys.argv[1:4]; os.makedirs(out, exist_ok=True)
im = cv2.imread(src)[..., :3]; H, W = im.shape[:2]
hsv = cv2.cvtColor(im, cv2.COLOR_BGR2HSV); pale = (hsv[..., 1] < 20) & (hsv[..., 2] > 236)
lab, n = ndi.label(pale); edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
fg = ndi.binary_opening(~np.isin(lab, list(edge)), iterations=1)
alpha = cv2.GaussianBlur(fg.astype(np.float32), (3, 3), .7)
grp, g = ndi.label(ndi.binary_dilation(fg, iterations=int(sys.argv[4]) if len(sys.argv) > 4 else 6))
objs = []
for i, sl in enumerate(ndi.find_objects(grp)):
    mk = (grp[sl] == i + 1) & fg[sl]
    if mk.sum() < 1500: continue
    objs.append(((sl[0].start + sl[0].stop) / 2, (sl[1].start + sl[1].stop) / 2, i + 1, sl))
objs.sort(key=lambda o: o[0]); rows, cur = [], []
for o in objs:
    if cur and o[0] - np.mean([c[0] for c in cur]) > H * .18: rows += sorted(cur, key=lambda c: c[1]); cur = []
    cur.append(o)
rows += sorted(cur, key=lambda c: c[1])
for k, (_, _, i, sl) in enumerate(rows):
    mk = (grp[sl] == i) & fg[sl]; mk = ndi.binary_dilation(mk, iterations=1) & (alpha[sl] > 0)
    Image.fromarray(np.dstack([im[sl][..., ::-1], (alpha[sl] * mk * 255).astype(np.uint8)])).save(f'{out}/{pre}{k:02d}.png')
print(len(rows))
