# 部屋に遊びに来るキャラ：カットインの絵（img/<key>.jpg）から人物だけを切りぬく
import cv2, numpy as np
from scipy import ndimage as ndi
D = '/home/claude/igo-battle/img/'
out = []
for k in ['koharu', 'gensai', 'hinata', 'shima', 'tomoe', 'mike', 'tono']:
    im = cv2.imread(D + k + '.jpg'); h, w = im.shape[:2]
    mask = np.zeros((h, w), np.uint8)
    rect = (int(w * 0.04), 2, int(w * 0.92), h - 2)
    bg = np.zeros((1, 65)); fg = np.zeros((1, 65))
    if k == 'shima':   # 紺の着物が背景と見分けにくいので、体のまん中を「人物」と教える
        mask[:] = cv2.GC_PR_BGD; mask[:, int(w * 0.25):int(w * 0.8)] = cv2.GC_PR_FGD
        mask[int(h * 0.2):, int(w * 0.38):int(w * 0.68)] = cv2.GC_FGD
        mask[:, :6] = cv2.GC_BGD; mask[:, -6:] = cv2.GC_BGD; mask[:4] = cv2.GC_BGD
        cv2.grabCut(im, mask, None, bg, fg, 8, cv2.GC_INIT_WITH_MASK)
    else:
        cv2.grabCut(im, mask, rect, bg, fg, 8, cv2.GC_INIT_WITH_RECT)
    m = (mask == 1) | (mask == 3)
    m = ndi.binary_opening(m, iterations=2)
    cl, n = ndi.label(m); sz = ndi.sum(m, cl, range(1, n + 1)); m = np.isin(cl, [i + 1 for i, s in enumerate(sz) if s > 0.05 * sz.max()])
    holes = ndi.binary_fill_holes(m) & ~m; hl, hn = ndi.label(holes)
    if hn: hs = ndi.sum(holes, hl, range(1, hn + 1)); m |= np.isin(hl, [i + 1 for i, s in enumerate(hs) if s < 1500])
    a = cv2.GaussianBlur(m.astype(np.float32), (5, 5), 1.2)
    # 下のはしは、ふわっと消す（足もとが切れているので）
    fade = np.clip((h - 1 - np.arange(h)) / (h * 0.12), 0, 1)[:, None]
    a = a * fade
    rgba = np.dstack([im, (a * 255).astype(np.uint8)])
    cv2.imwrite(D + 'visit_' + k + '.webp', rgba, [cv2.IMWRITE_WEBP_QUALITY, 88])
    vv = im.copy(); vv[~m] = (0, 255, 0); out.append(cv2.resize(vv, (170, int(h * 170 / w))[:2][::-1] if False else (170, 312)))
cv2.imwrite('all.png', np.concatenate(out, 1))
