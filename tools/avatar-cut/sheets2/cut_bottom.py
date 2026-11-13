# 下の服のシートは1行の数がまちまち（12〜14）なので、行ごとに「すき間」で分ける。くっついているものは等分の近くの一番低い所で分ける
import cv2, numpy as np, json, glob, os
from scipy import ndimage as ndi
for f in glob.glob('bottom_*.png'): os.remove(f)
im = cv2.imread('src_3678.png', cv2.IMREAD_UNCHANGED); H, W = im.shape[:2]; fg = im[..., 3] > 30
rows = [0, 108, 215, 336, 439, 541, 644, 746, 848, 932, 1024]
owner = np.full((H, W), -1, int); k = 0
for r in range(10):
    y0, y1 = rows[r], rows[r + 1]; p = fg[y0:y1].sum(0).astype(float); low = p <= 1
    segs = []; x = 0
    while x < W:
        if not low[x]:
            a = x
            while x < W and not low[x]: x += 1
            segs.append([a, x])
        else: x += 1
    med = np.median([b - a for a, b in segs])
    out = []
    for a, b in segs:
        n = int(round((b - a) / med))
        if (b - a) < 0.45 * med and out: out[-1][1] = b; continue   # 小さすぎる（しっぽなど）→ となりに
        if n <= 1: out.append([a, b]); continue
        cuts = [a]
        for j in range(1, n):
            c = a + j * (b - a) / n; lo, hi = int(c - .25 * med), int(c + .25 * med)
            cuts.append(lo + int(np.argmin(p[lo:hi])))
        cuts.append(b)
        out += [[cuts[j], cuts[j + 1]] for j in range(n)]
    for a, b in out: owner[y0:y1, a:b] = k; k += 1
cl, n = ndi.label(fg); objs = ndi.find_objects(cl); assign = np.full((H, W), -1, int)
for i in range(n):
    sl = objs[i]; mm = cl[sl] == i + 1; ow = owner[sl][mm]
    vals, cnt = np.unique(ow, return_counts=True)
    if cnt.max() >= 0.8 * mm.sum(): assign[sl][mm] = vals[np.argmax(cnt)]
    else: assign[sl][mm] = ow
res = []
for j in range(k):
    m = assign == j
    c2, n2 = ndi.label(m)
    if n2 > 1: s2 = ndi.sum(m, c2, range(1, n2 + 1)); m = np.isin(c2, [q + 1 for q, v in enumerate(s2) if v > 0.03 * s2.max()])
    if m.sum() < 300: print('empty', j); continue
    ys, xs = np.nonzero(m); ya, yb, xa, xb = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    crop = im[ya:yb, xa:xb].copy(); crop[~m[ya:yb, xa:xb]] = 0
    cv2.imwrite(f'bottom_{len(res):03d}.png', crop); res.append(dict(i=len(res), box=[int(xa), int(ya), int(xb - xa), int(yb - ya)]))
json.dump(res, open('bottom_cells.json', 'w')); print('bottoms', len(res))
