# 髪：顔の入る穴を抜く。下のまん中の色（背景の光）を手本に、列ごとに下から上へ、髪の線にぶつかるまで消す
import cv2, numpy as np, json
from scipy import ndimage as ndi
im = cv2.imread('src.png')[..., :3].astype(np.float32)
im = cv2.GaussianBlur(im, (3, 3), 0)
cells = json.load(open('hair_cells.json'))
for cinfo in cells:
    i = cinfo['i']; x1, y1 = cinfo['box']
    m = np.load(f'hair_m{i}.npy'); h, w = m.shape
    sub = im[y1:y1 + h, x1:x1 + w]
    ys, xs = np.nonzero(m); cx = int((xs.min() + xs.max()) / 2)
    # 手本の色：まん中の列の、いちばん下の所
    col = np.nonzero(m[:, cx])[0]; by = col.max()
    off = 10 if i == 14 else 0
    ref = np.median(sub[by - 6 - off:by + 1 - off, cx - 6:cx + 7].reshape(-1, 3), 0)
    hole = np.zeros_like(m)
    for x in range(xs.min(), xs.max() + 1):
        c = np.nonzero(m[:, x])[0]
        if not len(c): continue
        y = c.max() - off
        r = ref.copy()
        if np.abs(sub[y, x] - r).sum() > (70 if i == 14 else 50): continue          # 一番下が髪（横の髪）なら、その列はさわらない
        while y >= 0 and m[y, x] and np.abs(sub[y, x] - r).sum() < (48 if i == 14 else 42):
            hole[y, x] = True; r = r * 0.9 + sub[y, x] * 0.1; y -= 1
    # 下のまん中につながっている部分だけ
    cl, n = ndi.label(hole)
    keep = set(cl[max(0, by - 4 - off):by + 1 - off, cx - 3:cx + 4].ravel()) - {0}
    hole = np.isin(cl, list(keep))
    hole = ndi.binary_opening(hole, iterations=2)
    # 確かな穴から、なめらかにつながる所へ広げる（横のほうに残った光の部分）
    if hole.any() and i != 14:
        u8 = np.clip(sub, 0, 255).astype(np.uint8).copy()
        fm = np.zeros((h + 2, w + 2), np.uint8); fm[1:-1, 1:-1][~m] = 1
        hy, hx = np.nonzero(ndi.binary_erosion(hole, iterations=2))
        for k in range(0, len(hy), max(1, len(hy) // 40)):
            if fm[hy[k] + 1, hx[k] + 1] == 0:
                cv2.floodFill(u8, fm, (int(hx[k]), int(hy[k])), 0, (2, 2, 2), (2, 2, 2), 4 | cv2.FLOODFILL_MASK_ONLY | (2 << 8))
        grown = fm[1:-1, 1:-1] == 2
        if grown.sum() < hole.sum() * 2.5: hole |= grown        # 広がりすぎたら（髪にもれたら）使わない
    if off: hole[by - off:by + 1, :] |= m[by - off:by + 1, :] & (np.arange(w)[None, :] > cx - 60) & (np.arange(w)[None, :] < cx + 60) & np.any(hole, axis=0)[None, :]
    if i == 14:   # まん中の列だけ上まで抜けた所を、ほかの列の高さにそろえる
        tops = [np.nonzero(hole[:, x])[0].min() for x in range(w) if hole[:, x].any()]
        if tops:
            t = int(np.median(tops)); hole[:t - 4, :] = False
    m2 = m & ~ndi.binary_dilation(hole, iterations=1)
    cl, n = ndi.label(m2)
    if n: sz = ndi.sum(m2, cl, range(1, n + 1)); m2 = np.isin(cl, [k + 1 for k, s in enumerate(sz) if s > 200])
    np.save(f'hair_f{i}.npy', m2)
    vv = cv2.imread('src.png')[y1:y1 + h, x1:x1 + w].copy(); vv[~m2] = (0, 255, 0); cv2.imwrite(f'hair_v{i}.png', vv)
ims = [cv2.imread(f'hair_v{i}.png') for i in range(20)]
hh = min(i.shape[0] for i in ims); ww = min(i.shape[1] for i in ims)
ims = [i[:hh, :ww] for i in ims]
cv2.imwrite('hair_all.png', cv2.resize(np.concatenate([np.concatenate(ims[r*5:(r+1)*5], 1) for r in range(4)], 0), None, fx=.7, fy=.7))
