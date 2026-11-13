# 素体を、頭（首より上）と体（首より下）の2枚にしてキャンバスへ
from common import *
bgr = BASE[..., :3]; a = BASE[..., 3].astype(np.float32)
M = np.float32([[K, 0, -BX * K + CX], [0, K, -BY * K + CY]])
ah = a.copy(); ah[NECK + 4:] = 0
ab = a.copy(); ab[:NECK - 4] = 0
save(warp(bgr, ah, M), 'base_head'); save(warp(bgr, ab, M), 'base_body')
full = warp(bgr, a, M); ys, xs = np.nonzero(full[..., 3] > 100); print('canvas bbox', xs.min(), xs.max(), ys.min(), ys.max(), 'neck y', NECK * K - BY * K + CY)
