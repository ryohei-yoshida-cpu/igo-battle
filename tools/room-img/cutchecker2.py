# 市松の背景（細かい・うすい）を、模様の「ざらつき」で見わけて消す。外とつながっていなくても、市松なら消す
#   python3 cutchecker2.py src.png COLS ROWS OUT prefix
import sys, os, cv2, numpy as np
from scipy import ndimage as ndi
from PIL import Image
src, C, R, out, pre = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4], sys.argv[5]
os.makedirs(out, exist_ok=True)
im = cv2.imread(src)[..., :3]; H, W = im.shape[:2]
hsv = cv2.cvtColor(im, cv2.COLOR_BGR2HSV); v = hsv[..., 2].astype(np.float32)
pale = (hsv[..., 1] < 20) & (v > 228)
K = 7
allpale = ndi.minimum_filter(pale.astype(np.uint8), size=K) > 0
mean = cv2.blur(v, (K, K)); sq = cv2.blur(v * v, (K, K)); sd = np.sqrt(np.maximum(sq - mean * mean, 0))
chk = allpale & (sd > 2.5) & (sd < 12)
chk = ndi.binary_dilation(chk, iterations=K // 2 + 1) & pale
lab, n = ndi.label(chk); sz = ndi.sum(chk, lab, range(1, n + 1))
chk = np.isin(lab, [i + 1 for i in range(n) if sz[i] > 60])
# 外とつながった うすい色も背景
lab2, n2 = ndi.label(pale); edge = set(np.unique(np.concatenate([lab2[0], lab2[-1], lab2[:, 0], lab2[:, -1]]))) - {0}
bg = chk | np.isin(lab2, list(edge))
fg = ndi.binary_opening(~bg, iterations=1)
alpha = cv2.GaussianBlur(fg.astype(np.float32), (3, 3), .7)
cl, m = ndi.label(fg); com = ndi.center_of_mass(fg, cl, range(1, m + 1)); sz = ndi.sum(fg, cl, range(1, m + 1))
for k in range(C * R):
    r, c = divmod(k, C)
    ids = [i + 1 for i in range(m) if sz[i] > 40 and int(com[i][1] // (W / C)) == c and int(com[i][0] // (H / R)) == r]
    if not ids: continue
    mk = np.isin(cl, ids); mk = ndi.binary_dilation(mk, iterations=1) & (alpha > 0)
    ys, xs = np.nonzero(mk); y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    a = (alpha * mk)[y0:y1, x0:x1]
    Image.fromarray(np.dstack([im[y0:y1, x0:x1, ::-1], (a * 255).astype(np.uint8)])).save(f'{out}/{pre}{k:02d}.png')
