# 市松（にせの透明）背景のシートから切りぬく。外とつながった市松と、中にとじこめられた市松（格子のすきま）も消す
#   python3 cutchecker.py src.png COLS ROWS OUT prefix
import sys, os, cv2, numpy as np
from scipy import ndimage as ndi
from PIL import Image
src, C, R, out, pre = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4], sys.argv[5]
os.makedirs(out, exist_ok=True)
im = cv2.imread(src)[..., :3]; H, W = im.shape[:2]
hsv = cv2.cvtColor(im, cv2.COLOR_BGR2HSV); v = hsv[..., 2].astype(int)
pale = (hsv[..., 1] < 28) & (v > 200)
lab, n = ndi.label(pale)
edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
bgids = set(edge)
sl = ndi.find_objects(lab)
for i in range(1, n + 1):
    if i in bgids: continue
    m = lab[sl[i - 1]] == i; a = m.sum()
    if a < 60: continue
    vv = v[sl[i - 1]][m]; dark = ((vv > 200) & (vv < 232)).mean()
    if .2 < dark < .8: bgids.add(i)
bg = np.isin(lab, list(bgids))
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
