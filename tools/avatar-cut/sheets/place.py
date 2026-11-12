# 髪：アバターのキャンバス（320×780）へ。横は真ん中、たては頭のてっぺん（まん中あたりの髪の上の端）で合わせる
import cv2, numpy as np, json
from scipy import ndimage as ndi
im = cv2.imread('src.png')[..., :3]
cells = json.load(open('hair_cells.json'))
OUT = '/home/claude/igo-battle/img/avatar/'
S = 0.895; TOP = 44; CX = 158
ADJ = {}   # 個別のずれ直し {番号: (dx, dy)}
for c in cells:
    i = c['i']; x1, y1 = c['box']; m = np.load(f'hair_f{i}.npy'); h, w = m.shape
    sub = im[y1:y1 + h, x1:x1 + w]
    ys, xs = np.nonzero(m); cx = (xs.min() + xs.max()) / 2
    tops = [np.nonzero(m[:, x])[0].min() for x in range(int(cx - 50), int(cx + 51)) if m[:, x].any()]
    top = float(np.median(tops))
    dx, dy = ADJ.get(i, (0, 0))
    a = cv2.GaussianBlur(m.astype(np.float32), (3, 3), 0.6)
    rgba = np.dstack([sub, (a * 255).astype(np.uint8)])
    M = np.float32([[S, 0, CX + dx - cx * S], [0, S, TOP + dy - top * S]])
    out = cv2.warpAffine(rgba, M, (320, 780), flags=cv2.INTER_AREA, borderValue=0)
    out[out[..., 3] == 0, :3] = 0
    cv2.imwrite(OUT + f'h{i:02d}_hair.png', out, [cv2.IMWRITE_PNG_COMPRESSION, 9])
print('ok')
