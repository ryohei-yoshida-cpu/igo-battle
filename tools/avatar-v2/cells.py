# シートをマス目に分けて、マスごとの前景（背景を消したもの）を返す
import numpy as np
from scipy import ndimage as ndi
from seg import load, bgmask
from grid import cuts
def cells(path, nr, nc, rect=None):
    im = load(path)
    if rect: x0, y0, x1, y1 = rect; im = im[y0:y1, x0:x1]
    H, W = im.shape[:2]; fg = ~bgmask(im)
    fg = ndi.binary_opening(fg, iterations=1) | (fg & ndi.binary_dilation(ndi.binary_opening(fg, iterations=1), iterations=1))
    rows = cuts(fg.sum(1).astype(float), nr)
    owner = np.full((H, W), -1, int); rects = []
    for r in range(nr):
        a, b = rows[r], rows[r + 1]
        cols = cuts(fg[a:b].sum(0).astype(float), nc)
        for c in range(nc): owner[a:b, cols[c]:cols[c + 1]] = r * nc + c; rects.append((cols[c], a, cols[c + 1], b))
    cl, n = ndi.label(fg); objs = ndi.find_objects(cl); assign = np.full((H, W), -1, int)
    for i in range(n):
        sl = objs[i]; mm = cl[sl] == i + 1; ow = owner[sl][mm]
        vals, cnt = np.unique(ow, return_counts=True)
        if cnt.max() >= .8 * mm.sum(): assign[sl][mm] = vals[np.argmax(cnt)]
        else: assign[sl][mm] = ow
    out = []
    for k in range(nr * nc):
        m = assign == k
        if m.sum() < 80: out.append(None); continue
        c2, n2 = ndi.label(m)
        if n2 > 1:
            s2 = ndi.sum(m, c2, range(1, n2 + 1)); m = np.isin(c2, [q + 1 for q, v in enumerate(s2) if v > .02 * s2.max()])
        ys, xs = np.nonzero(m); y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
        pad = 3; y0, x0 = max(0, y0 - pad), max(0, x0 - pad); y1, x1 = min(H, y1 + pad), min(W, x1 + pad)
        out.append(dict(k=k, img=im[y0:y1, x0:x1].copy(), m=m[y0:y1, x0:x1].copy(), ox=x0, oy=y0))
    return out
