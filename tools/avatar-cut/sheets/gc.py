# 素材シート（5×4）を GrabCut で切りぬく
import cv2, numpy as np, json, sys
from scipy import ndimage as ndi
src, name = sys.argv[1], sys.argv[2]
im = cv2.imread(src)[..., :3]; H, W = im.shape[:2]
CW, CH = W / 5, H / 4
out = []
for r in range(4):
    for c in range(5):
        x1, y1 = int(c * CW), int(r * CH); x2, y2 = int((c + 1) * CW), int((r + 1) * CH)
        sub = np.ascontiguousarray(im[y1:y2, x1:x2]); h, w = sub.shape[:2]
        mask = np.zeros((h, w), np.uint8)
        rect = (4, 2, w - 8, h - 4)
        bgd = np.zeros((1, 65), np.float64); fgd = np.zeros((1, 65), np.float64)
        cv2.grabCut(sub, mask, rect, bgd, fgd, 6, cv2.GC_INIT_WITH_RECT)
        m = (mask == 1) | (mask == 3)
        m = ndi.binary_opening(m, iterations=1)
        cl, n = ndi.label(m)
        if n:
            sz = ndi.sum(m, cl, range(1, n + 1)); m = np.isin(cl, [i + 1 for i, s in enumerate(sz) if s > 0.08 * sz.max()])
        holes = ndi.binary_fill_holes(m) & ~m
        hl, hn = ndi.label(holes)
        if hn:
            hs = ndi.sum(holes, hl, range(1, hn + 1)); m |= np.isin(hl, [i + 1 for i, s in enumerate(hs) if s < 600])
        np.save(f'{name}_m{r*5+c}.npy', m)
        out.append(dict(i=r * 5 + c, box=[x1, y1]))
        vv = sub.copy(); vv[~m] = (0, 255, 0); cv2.imwrite(f'{name}_v{r*5+c}.png', vv)
json.dump(out, open(f'{name}_cells.json', 'w'))
ims = [cv2.imread(f'{name}_v{i}.png') for i in range(20)]
hh = min(i.shape[0] for i in ims); ww = min(i.shape[1] for i in ims)
ims = [i[:hh, :ww] for i in ims]
cv2.imwrite(f'{name}_all.png', cv2.resize(np.concatenate([np.concatenate(ims[r*5:(r+1)*5], 1) for r in range(4)], 0), None, fx=.7, fy=.7))
