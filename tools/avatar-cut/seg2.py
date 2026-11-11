import numpy as np, cv2, json
from scipy import ndimage as ndi
from scipy.spatial import ConvexHull
im = cv2.cvtColor(cv2.imread('src.jpg'), cv2.COLOR_BGR2RGB).astype(np.int32)
SKIN, SHIRT, SHORTS, SOCK, SHOE, SOLE, HAIR = 1, 2, 3, 4, 5, 6, 7
out = {}
SEED = {}
def figure(x0, x1, name, chin):
    sub = im[:, x0:x1].copy(); h, w, _ = sub.shape
    r, g, b = sub[..., 0], sub[..., 1], sub[..., 2]
    mx, mn = sub.max(2), sub.min(2); v = mx; sat = mx - mn
    cand = (v > 188) & (b >= r + 3) & (sat < 55)
    cl, n = ndi.label(cand)
    border = set(np.unique(np.concatenate([cl[0], cl[-1], cl[:, 0], cl[:, -1]]))) - {0}
    bg = np.isin(cl, list(border))
    # 足もとの影（青みがかった灰色）も背景に
    shadow = (b > r + 8) & (v > 150) & (v < 215) & (np.arange(h)[:, None] > h * 0.9)
    bg |= shadow & ~((g > b + 10))
    bg = ndi.binary_opening(bg, iterations=1) | (bg & ndi.binary_erosion(bg))
    # 小さい穴（背景の中の点）は背景、前景の外側1pxは削る
    fg = ~bg
    fg = ndi.binary_opening(fg, iterations=1)
    lab_comp, n2 = ndi.label(fg); sizes = ndi.sum(fg, lab_comp, range(1, n2 + 1)); fg = lab_comp == (np.argmax(sizes) + 1)
    fg = ndi.binary_fill_holes(fg)
    ys = np.arange(h)[:, None].repeat(w, 1)
    lab = np.zeros((h, w), np.int32)
    lab[fg & (r > 200) & (r - b > 40) & (g > 140)] = SKIN
    lab[fg & (sat < 22) & (v > 160)] = SHIRT
    lab[fg & (b > r + 25) & (v > 90)] = SHORTS
    lab[fg & (sat < 22) & (v > 85) & (v <= 160)] = SOCK
    lab[fg & (g > b + 15) & (np.abs(r - g) < 30) & (v > 70) & (v < 170)] = SHOE
    dark = fg & (v < 95)
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
    core = cv2.morphologyEx(dark.astype(np.uint8), cv2.MORPH_OPEN, k) > 0
    cl2, n = ndi.label(core); sizes = ndi.sum(core, cl2, range(1, n + 1))
    hair = np.isin(cl2, [i + 1 for i, s in enumerate(sizes) if s > 1200])
    lab[hair] = HAIR
    feet = ys > h * 0.86
    lab[(lab == SHIRT) & feet] = SOLE
    lab[(lab == SOCK) & (ys < h * 0.8)] = 0
    lab[(lab == SHOE) & (ys < h * 0.8)] = 0
    lab[(lab == SHIRT) & (ys < chin)] = 0
    SEED[name] = lab.copy()
    known = lab > 0
    idx = ndi.distance_transform_edt(~known, return_distances=False, return_indices=True)
    full = lab[idx[0], idx[1]]; full[~fg] = 0
    # 頭（あごより上）で髪以外は顔
    FACE = 8
    full[(ys < chin) & fg & (full != HAIR)] = FACE
    return sub, full, fg, ys
def bbox(m):
    yy, xx = np.nonzero(m); return xx.min(), yy.min(), xx.max(), yy.max()
res = {}
for name, x0, x1, chin in [('girl', 330, 650, 243), ('boy', 810, 1110, 252)]:
    sub, full, fg, ys = figure(x0, x1, name, chin)
    face = full == 8
    fx0, fy0, fx1, fy1 = bbox(face & (sub[..., 0] > 200))
    gx0, gy0, gx1, gy1 = bbox(fg)
    res[name] = dict(sub=sub, full=full, fg=fg, face=(fx0, fy0, fx1, fy1), fig=(gx0, gy0, gx1, gy1), chin=chin)
    print(name, 'face', (fx0, fy0, fx1, fy1), 'w', fx1 - fx0, 'fig', (gx0, gy0, gx1, gy1), 'h', gy1 - gy0)
    pal = np.array([[255, 255, 255], [240, 190, 160], [160, 160, 170], [60, 100, 200], [90, 90, 90], [110, 130, 40], [250, 240, 200], [200, 40, 40], [250, 160, 200]])
    vis = pal[full].astype(np.uint8); vis[~fg] = 255
    cv2.imwrite(name + '_vis.png', cv2.cvtColor(np.concatenate([sub.astype(np.uint8), vis], 1), cv2.COLOR_RGB2BGR))
np.save('res.npy', {k: {kk: vv for kk, vv in v.items()} for k, v in res.items()}, allow_pickle=True)
