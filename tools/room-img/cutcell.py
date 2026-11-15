# 白い背景のシートを、マスごとに切ってから背景を消す（となりの絵とくっついていてもOK）
#   python3 cutcell.py src.png COLS ROWS OUT prefix
import sys, os, cv2, numpy as np
from scipy import ndimage as ndi
from PIL import Image
src, C, R, out, pre = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4], sys.argv[5]
os.makedirs(out, exist_ok=True)
im0 = cv2.imread(src)[..., :3]; H, W = im0.shape[:2]
for k in range(C * R):
    r, c = divmod(k, C)
    x0, x1, y0, y1 = int(c * W / C), int((c + 1) * W / C), int(r * H / R), int((r + 1) * H / R)
    im = im0[y0:y1, x0:x1]
    hsv = cv2.cvtColor(im, cv2.COLOR_BGR2HSV)
    pale = (hsv[..., 1] < 22) & (hsv[..., 2] > 232)
    lab, n = ndi.label(pale); edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    fg = ~np.isin(lab, list(edge)); fg = ndi.binary_opening(fg, iterations=1)
    cl, m = ndi.label(fg); sz = ndi.sum(fg, cl, range(1, m + 1))
    # まんなかに近い大きなかたまりと、それにふれる（または近い）もの。マスのふちにかかる となりの絵のはしは捨てる
    keep = []
    for i, sl in enumerate(ndi.find_objects(cl)):
        if sz[i] < 40: continue
        touch = sl[1].start == 0 or sl[1].stop == im.shape[1] or sl[0].start == 0 or sl[0].stop == im.shape[0]
        if touch and sz[i] < .2 * sz.max(): continue
        keep.append(i + 1)
    mk = np.isin(cl, keep)
    alpha = cv2.GaussianBlur(fg.astype(np.float32), (3, 3), .7) * ndi.binary_dilation(mk, iterations=2)
    ys, xs = np.nonzero(mk); a0, a1, b0, b1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    Image.fromarray(np.dstack([im[a0:a1, b0:b1, ::-1], (alpha[a0:a1, b0:b1] * 255).astype(np.uint8)])).save(f'{out}/{pre}{k:02d}.png')
