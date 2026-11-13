# 白い背景（外側とつながった白）を消して、4列×2行のマスごとに切り出す
import cv2, numpy as np, os
from scipy import ndimage as ndi
from PIL import Image
OUT = 'cut/'; os.makedirs(OUT, exist_ok=True)
for kind in ['head', 'body', 'pet']:
    im = cv2.imread(f'src/{kind}.png', cv2.IMREAD_UNCHANGED)
    if im.shape[2] == 4: im = im[..., :3]
    H, W = im.shape[:2]
    hsv = cv2.cvtColor(im, cv2.COLOR_BGR2HSV)
    pale = (hsv[..., 1] < 18) & (hsv[..., 2] > 238)
    lab, n = ndi.label(pale); edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bg = np.isin(lab, list(edge))
    fg = ~bg; fg = ndi.binary_opening(fg, iterations=1)
    # 外側の白へのやわらかいふち
    alpha = cv2.GaussianBlur(fg.astype(np.float32), (3, 3), .7)
    cl, n = ndi.label(fg); com = ndi.center_of_mass(fg, cl, range(1, n + 1)); sz = ndi.sum(fg, cl, range(1, n + 1))
    for k in range(8):
        r, c = divmod(k, 4)
        ids = [i + 1 for i in range(n) if sz[i] > 15 and int(com[i][1] // (W / 4)) == c and int(com[i][0] // (H / 2)) == r]
        m = np.isin(cl, ids); m = ndi.binary_dilation(m, iterations=2) & (alpha > 0)
        ys, xs = np.nonzero(m); y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
        a = (alpha * m)[y0:y1, x0:x1]
        rgba = np.dstack([im[y0:y1, x0:x1, ::-1], (a * 255).astype(np.uint8)])
        Image.fromarray(rgba).save(f'{OUT}{kind}{k}.png'); print(kind, k, x1 - x0, y1 - y0)
