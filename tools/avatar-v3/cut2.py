# 白い背景は外とつながった白を消す。暗い背景は GrabCut（マスのふちを背景として）
import cv2, numpy as np, os, sys
from scipy import ndimage as ndi
from PIL import Image
os.makedirs('cut', exist_ok=True)
def white(im):
    hsv = cv2.cvtColor(im, cv2.COLOR_BGR2HSV)
    pale = (hsv[..., 1] < 18) & (hsv[..., 2] > 238)
    lab, n = ndi.label(pale); edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    return ndi.binary_opening(~np.isin(lab, list(edge)), iterations=1)
def dark_cell(cell):
    """背景はなめらかなぼかし。絵は輪郭線でかこまれている → 線を見つけて、中をうめる"""
    g = cv2.cvtColor(cell, cv2.COLOR_BGR2GRAY)
    e = cv2.Canny(cv2.GaussianBlur(g, (3, 3), 0), 40, 110) > 0
    e[:6] = e[-6:] = False; e[:, :6] = e[:, -6:] = False
    c = ndi.binary_closing(ndi.binary_dilation(e, iterations=2), iterations=3)
    f = ndi.binary_fill_holes(c)
    f = ndi.binary_erosion(f, iterations=2)
    lab, n = ndi.label(f)
    if n: sz = ndi.sum(f, lab, range(1, n + 1)); f = np.isin(lab, [i + 1 for i, q in enumerate(sz) if q > .03 * sz.max()])
    return f
for name in sys.argv[1:]:
    im = cv2.imread(f'src/{name}.png', cv2.IMREAD_UNCHANGED)[..., :3]; H, W = im.shape[:2]
    corner = cv2.cvtColor(im[:20, :20], cv2.COLOR_BGR2HSV)[..., 2].mean()
    darkbg = corner < 150
    if not darkbg:
        fg = white(im); alpha = cv2.GaussianBlur(fg.astype(np.float32), (3, 3), .7)
        cl, n = ndi.label(fg); com = ndi.center_of_mass(fg, cl, range(1, n + 1)); sz = ndi.sum(fg, cl, range(1, n + 1))
    for k in range(8):
        r, c = divmod(k, 4)
        x0c, x1c, y0c, y1c = int(c * W / 4), int((c + 1) * W / 4), int(r * H / 2), int((r + 1) * H / 2)
        if darkbg:
            cell = im[y0c:y1c, x0c:x1c]; f = dark_cell(cell)
            a = cv2.GaussianBlur(f.astype(np.float32), (3, 3), .8)
            ys, xs = np.nonzero(f); y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
            rgba = np.dstack([cell[y0:y1, x0:x1, ::-1], (a[y0:y1, x0:x1] * 255).astype(np.uint8)])
        else:
            ids = [i + 1 for i in range(n) if sz[i] > 15 and int(com[i][1] // (W / 4)) == c and int(com[i][0] // (H / 2)) == r]
            m = np.isin(cl, ids); m = ndi.binary_dilation(m, iterations=2) & (alpha > 0)
            ys, xs = np.nonzero(m); y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
            rgba = np.dstack([im[y0:y1, x0:x1, ::-1], ((alpha * m)[y0:y1, x0:x1] * 255).astype(np.uint8)])
        Image.fromarray(rgba).save(f'cut/{name}_{k}.png')
    print(name, 'dark' if darkbg else 'white')
