# 透明の背景つきシートから、家具を1つずつ切りぬく（マスごと・小さなゴミは捨てる）
#   python3 cutalpha.py src/g1.png 4 2 OUTDIR prefix
import sys, os, numpy as np
from scipy import ndimage as ndi
from PIL import Image
src, C, R, out, pre = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4], sys.argv[5]
os.makedirs(out, exist_ok=True)
im = np.array(Image.open(src).convert('RGBA')); H, W = im.shape[:2]
a = im[..., 3]
fg = a > 140
lab, n = ndi.label(fg); sz = ndi.sum(fg, lab, range(1, n + 1)); com = ndi.center_of_mass(fg, lab, range(1, n + 1))
for k in range(C * R):
    r, c = divmod(k, C)
    ids = [i + 1 for i in range(n) if int(com[i][1] // (W / C)) == c and int(com[i][0] // (H / R)) == r]
    if not ids: continue
    big = max(sz[i - 1] for i in ids)
    ids = [i for i in ids if sz[i - 1] > big * .01]
    m = np.isin(lab, ids)
    m = ndi.binary_fill_holes(ndi.binary_closing(m, iterations=2)) | m
    mm = ndi.binary_dilation(m, iterations=2)
    ys, xs = np.nonzero(m); y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    rgba = im[y0:y1, x0:x1].copy()
    alpha = np.where(mm[y0:y1, x0:x1], rgba[..., 3], 0)
    alpha = np.where(m[y0:y1, x0:x1], np.maximum(alpha, 0), alpha)
    rgba[..., 3] = alpha
    Image.fromarray(rgba).save(f'{out}/{pre}{k:02d}.png')
    print(pre, k, x1 - x0, y1 - y0)
