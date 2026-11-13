# 新しい素材シート（背景は透明）を切りぬく。行・列の区切りは「すき間」を、ちょうど等分の位置の近くで探す
import cv2, numpy as np, json
from scipy import ndimage as ndi
SHEETS = {'shoes': ('src_3677.png', 10), 'bottom': ('src_3678.png', 12), 'hair': ('src_3679.png', 10), 'top': ('src_3680.png', 10)}
def cuts(profile, n):
    L = len(profile); sm = np.convolve(profile, np.ones(5) / 5, 'same'); res = [0]
    for k in range(1, n):
        b = k * L / n; lo, hi = int(b - .3 * L / n), int(b + .3 * L / n)
        seg = sm[lo:hi]; m = seg.min(); idx = np.nonzero(seg <= m + 1e-6)[0]
        res.append(lo + int(idx[np.argmin(np.abs(idx + lo - b))]))   # いちばん低い所（等分の位置にいちばん近いもの）
    return res + [L]
for kind, (f, nc) in SHEETS.items():
    im = cv2.imread(f, cv2.IMREAD_UNCHANGED); H, W = im.shape[:2]; fg = im[..., 3] > 30
    rows = cuts(fg.sum(1).astype(float), 10)
    owner = np.full((H, W), -1, int); rects = []
    for r in range(10):
        y0, y1 = rows[r], rows[r + 1]
        cols = cuts(fg[y0:y1].sum(0).astype(float), nc)
        for c in range(nc): rects.append((cols[c], y0, cols[c + 1], y1)); owner[y0:y1, cols[c]:cols[c + 1]] = r * nc + c
    cl, n = ndi.label(fg); objs = ndi.find_objects(cl)
    assign = np.full((H, W), -1, int)
    for i in range(n):
        sl = objs[i]; mm = cl[sl] == i + 1; ow = owner[sl][mm]
        vals, cnt = np.unique(ow, return_counts=True)
        if cnt.max() >= 0.8 * mm.sum(): assign[sl][mm] = vals[np.argmax(cnt)]   # ほとんどが一つのマス → まるごとそのマス
        else: assign[sl][mm] = ow                                                 # くっついたもの → マスで分ける
    out = []
    for k in range(10 * nc):
        m = assign == k
        c2, n2 = ndi.label(m)
        if n2 > 1: s2 = ndi.sum(m, c2, range(1, n2 + 1)); m = np.isin(c2, [j + 1 for j, v in enumerate(s2) if v > 0.03 * s2.max()])
        if m.sum() < 300: print(kind, 'empty', k); continue
        ys, xs = np.nonzero(m); y1, y2, x1, x2 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
        crop = im[y1:y2, x1:x2].copy(); crop[~m[y1:y2, x1:x2]] = 0
        cv2.imwrite(f'{kind}_{k:03d}.png', crop)
        out.append(dict(i=k, box=[int(x1), int(y1), int(x2 - x1), int(y2 - y1)]))
    json.dump(out, open(f'{kind}_cells.json', 'w'))
    print(kind, len(out), 'rows', rows)
