# 服・靴：GrabCut の切りぬきから、まわりの光（にじみ）を落とす。輪郭線で囲まれた所だけ残す
import cv2, numpy as np, json, sys
from scipy import ndimage as ndi
src, name = sys.argv[1], sys.argv[2]
im = cv2.imread(src)[..., :3]
v = im.max(2).astype(np.float32)
lmax = cv2.dilate(v, np.ones((7, 7), np.uint8))
edge_all = (v < 110) & (lmax - v > 35)
cells = json.load(open(f'{name}_cells.json'))
for c in cells:
    i = c['i']; x1, y1 = c['box']; m = np.load(f'{name}_m{i}.npy'); h, w = m.shape
    e = edge_all[y1:y1 + h, x1:x1 + w] & ndi.binary_dilation(m, iterations=3)
    closed = np.zeros_like(m)
    for it in (2, 3, 4, 6):
        cl = ndi.binary_fill_holes(ndi.binary_closing(e, iterations=it))
        if (cl & m).sum() > (0.55 if name == "shoes" else 0.85) * m.sum(): closed = cl; break
    if closed.any():
        f = m & ndi.binary_dilation(closed, iterations=1)
    else:
        f = m
    if name == 'shoes' and i in (3, 13) and f.any():   # 黒い靴は線とまぎれるので、線で囲めた範囲（の箱）の中の GrabCut をそのまま使う
        ys, xs = np.nonzero(f); bb = np.zeros_like(m); bb[max(0, ys.min() - 3):ys.max() + 4, max(0, xs.min() - 3):xs.max() + 4] = True
        f = m & bb
    lab, n = ndi.label(f)
    if n: sz = ndi.sum(f, lab, range(1, n + 1)); f = np.isin(lab, [k + 1 for k, s in enumerate(sz) if s > 0.1 * sz.max()])
    holes = ndi.binary_fill_holes(f) & ~f; hl, hn = ndi.label(holes)
    if hn: hs = ndi.sum(holes, hl, range(1, hn + 1)); f |= np.isin(hl, [k + 1 for k, s in enumerate(hs) if s < 900])
    np.save(f'{name}_f{i}.npy', f)
    vv = im[y1:y1 + h, x1:x1 + w].copy(); vv[~f] = (0, 255, 0); cv2.imwrite(f'{name}_v{i}.png', vv)
ims = [cv2.imread(f'{name}_v{i}.png') for i in range(20)]
hh = min(i.shape[0] for i in ims); ww = min(i.shape[1] for i in ims)
ims = [i[:hh, :ww] for i in ims]
cv2.imwrite(f'{name}_all.png', cv2.resize(np.concatenate([np.concatenate(ims[r*5:(r+1)*5], 1) for r in range(4)], 0), None, fx=.5, fy=.5))
