import cv2, numpy as np, json
from scipy import ndimage as ndi
im = cv2.imread('src.png')[..., :3]
H, W = im.shape[:2]; print(W, H)
v = im.max(2).astype(int)
cx = [190, 480, 765, 1050, 1340]; cy = [345, 685]
out = []
for r, y0 in enumerate(cy):
    for c, x0 in enumerate(cx):
        x1, x2, y1, y2 = x0 - 150, x0 + 150, y0 - 175, y0 + 160
        sub = im[y1:y2, x1:x2]; sv = v[y1:y2, x1:x2]
        dark = sv < 105
        cl, n = ndi.label(dark)
        # 中心を囲む輪郭：一番大きい暗い成分（顔の線）
        sizes = ndi.sum(dark, cl, range(1, n + 1))
        # 背景の暗い部分（外周に触れる成分）を除く
        edge = set(np.unique(np.concatenate([cl[0], cl[-1], cl[:, 0], cl[:, -1]]))) - {0}
        cand = [(s, i + 1) for i, s in enumerate(sizes) if (i + 1) not in edge]
        cand.sort(reverse=True)
        outline = cl == cand[0][1]
        mask = ndi.binary_fill_holes(outline)
        # 目：中の暗い・茶色のかたまり
        hsub = sub.astype(int)
        out.append(dict(i=r * 5 + c, box=[x1, y1], area=int(mask.sum())))
        np.save(f'm{r*5+c}.npy', mask)
        vis = sub.copy(); vis[~mask] = (0, 255, 0)
        cv2.imwrite(f'v{r*5+c}.png', vis)
json.dump(out, open('cells.json', 'w'))
print(out)
