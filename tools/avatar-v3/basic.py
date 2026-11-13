# 最初の装備（男女の身体・顔）：黒い背景を消して置く。b32/b33 身体（男・女）、h32/h33 顔（男・女）
import cv2, numpy as np
from PIL import Image
from scipy import ndimage as ndi
import importlib.util, sys
src = open('place2.py').read(); src = src[:src.index('# 基準')]
exec(src)
def cut(path):
    im = cv2.imread(path)[..., ::-1]; v = im.max(2)
    dark = v < 28; lab, n = ndi.label(dark)
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    fg = ~np.isin(lab, list(edge)); fg = ndi.binary_opening(fg, iterations=1)
    a = (cv2.GaussianBlur(fg.astype(np.float32), (3, 3), .7) * 255).astype(np.uint8)
    cl, n = ndi.label(fg); sz = ndi.sum(fg, cl, range(1, n + 1)); objs = ndi.find_objects(cl)
    out = []
    for i in np.argsort(sz)[::-1][:2]:
        sl = objs[i]; m = cl[sl] == i + 1; m = ndi.binary_erosion(m, iterations=1)
        rgba = np.dstack([im[sl], (a[sl] * m).astype(np.uint8)]); out.append((sl[1].start, sl[0].start, rgba))
    return out
bodies = sorted(cut('src/basebody.jpg'), key=lambda t: t[0])     # 左が男、右が女
heads = sorted(cut('src/basehead.jpg'), key=lambda t: t[1])      # 上が男、下が女
for nm, (_, _, p) in zip(['b32', 'b33'], bodies):
    ys, xs = np.nonzero(p[..., 3] > 128); s = (FEET - NECK) / (ys.max() - ys.min())
    fx = np.nonzero((p[..., 3] > 128)[ys.max() - 15:ys.max()].any(0))[0]; cx = (fx.min() + fx.max()) / 2
    put(p, s, 200 - cx * s, NECK - ys.min() * s, nm); thumb(p, nm); print(nm, round(s, 2))
for nm, (_, _, p) in zip(['h32', 'h33'], heads):
    S = ndi.binary_opening(skin(p[..., :3]) & (p[..., 3] > 200), iterations=2); lab, n = ndi.label(S); sz = ndi.sum(S, lab, range(1, n + 1))
    F = lab == (np.argmax(sz) + 1); fy, fx = np.nonzero(F); s = 150 / (fx.max() - fx.min()); cx = (fx.min() + fx.max()) / 2
    put(p, s, 200 - cx * s, 314 - fy.max() * s, nm); thumb(p, nm); print(nm, round(s, 2))
