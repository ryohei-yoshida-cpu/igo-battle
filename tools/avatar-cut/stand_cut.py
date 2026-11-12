# 3673.png（市松もようの背景つき）からキャラの立ち姿を切りぬく
import cv2, numpy as np
from scipy import ndimage as ndi
im = cv2.imread('src.png'); H, W = im.shape[:2]
v = im.max(2).astype(int); sat = v - im.min(2)
chk = (sat < 14) & (v > 200)                      # 市松の白とうすいグレー
cl, n = ndi.label(chk)
edge = set(np.unique(np.concatenate([cl[0], cl[-1], cl[:, 0], cl[:, -1]]))) - {0}
bg = np.isin(cl, list(edge))
# 市松のすきま（線の境目）もふさぐ
bg = ndi.binary_closing(bg, iterations=2) & ~ndi.binary_erosion(~bg, iterations=0) | bg
fg = ~bg
fg = ndi.binary_opening(fg, iterations=2)
cl, n = ndi.label(fg); sz = ndi.sum(fg, cl, range(1, n + 1))
print(sorted([(int(s), i + 1) for i, s in enumerate(sz)], reverse=True)[:8])
np.save('fg.npy', fg); np.save('cl.npy', cl)
for i, s in enumerate(sz):
    if s > 5000:
        ys, xs = np.nonzero(cl == i + 1); print(i + 1, xs.min(), xs.max(), ys.min(), ys.max())
vis = im.copy(); vis[~fg] = (0, 200, 0); cv2.imwrite('vis.png', cv2.resize(vis, None, fx=.5, fy=.5))
