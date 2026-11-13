# 家具のシート（4×4、下にラベル）から、家具を1つずつ切りぬく。背景はぼかし → 輪郭線を見つけて中をうめる
import cv2, numpy as np, sys
from scipy import ndimage as ndi
from PIL import Image
def cut(cell):
    g = cv2.cvtColor(cell, cv2.COLOR_BGR2GRAY)
    e = cv2.Canny(cv2.GaussianBlur(g, (3, 3), 0), 30, 90) > 0
    e[:4] = e[-2:] = False; e[:, :4] = e[:, -4:] = False
    c = ndi.binary_closing(ndi.binary_dilation(e, iterations=2), iterations=4)
    f = ndi.binary_fill_holes(c)
    f = ndi.binary_erosion(f, iterations=2)
    f = keep(f)
    # 線がとぎれて中がうまらなかったところは、GrabCut（色で前景・背景を分ける）でおぎなう
    m = np.full(f.shape, cv2.GC_PR_BGD, np.uint8)
    m[ndi.binary_dilation(f, iterations=6)] = cv2.GC_PR_FGD
    m[ndi.binary_erosion(f, iterations=3)] = cv2.GC_FGD
    m[:3] = m[-3:] = m[:, :3] = m[:, -3:] = cv2.GC_BGD
    bg, fg = np.zeros((1, 65), np.float64), np.zeros((1, 65), np.float64)
    cv2.grabCut(cell, m, None, bg, fg, 6, cv2.GC_INIT_WITH_MASK)
    g2 = (m == cv2.GC_FGD) | (m == cv2.GC_PR_FGD)
    g2 = ndi.binary_fill_holes(ndi.binary_opening(g2, iterations=1))
    return keep(g2 | f)
def keep(f):
    lab, n = ndi.label(f)
    if not n: return f
    ok = []
    for i, sl in enumerate(ndi.find_objects(lab)):
        h, w = sl[0].stop - sl[0].start, sl[1].stop - sl[1].start
        if h >= 22 and ndi.sum(f, lab, i + 1) > 300: ok.append(i + 1)
    f = np.isin(lab, ok)
    lab, n = ndi.label(f)
    if n: sz = ndi.sum(f, lab, range(1, n + 1)); f = np.isin(lab, [i + 1 for i, q in enumerate(sz) if q > .05 * sz.max()])
    return f
src, names = sys.argv[1], sys.argv[2].split(',')
COLS, ROWS, LABEL = (int(sys.argv[3]), int(sys.argv[4]), sys.argv[5] == '1') if len(sys.argv) > 5 else (4, 4, True)
im = cv2.imread(src)[..., :3]; H, W = im.shape[:2]
ROWBOT = {}
import os; OUT = os.environ.get('OUT', 'cut')
for k, nm in enumerate(names):
    if not nm: continue
    r, c = divmod(k, COLS)
    x0c, x1c, y0c = int(c * W / COLS), int((c + 1) * W / COLS), int(r * H / ROWS)
    if not LABEL:
        cell = im[y0c:int((r + 1) * H / ROWS), x0c:x1c]; f = cut(cell); top = bottom = 0
    else:
        # ラベル（クリーム色の横長の札）をさがして、その上までを使う
        full = im[y0c:min(H, y0c + int(H / 4) + 12), x0c:x1c].astype(int)
        cream = (full[..., 2] > 225) & (full[..., 1] > 215) & (full[..., 0] > 190) & (full.max(2) - full.min(2) < 45)
        def run(row):
            best = cur = 0
            for v in row: cur = cur + 1 if v else 0; best = max(best, cur)
            return best
        runs = [run(cream[yy]) for yy in range(cream.shape[0])]
        lab_rows = [yy for yy in range(int(H / 4) - 70, int(H / 4) + 12) if yy < len(runs) and runs[yy] > 120]
        bottom = (min(lab_rows) - 4) if lab_rows else ROWBOT.get(r, int(H / 4 * .84))
        bottom = min(bottom, ROWBOT.get(r, 999) + 8); ROWBOT[r] = min(ROWBOT.get(r, 999), bottom)
        tops = [yy for yy in range(0, 24) if runs[yy] > 120]
        top = (max(tops) + 6) if (tops and r) else (14 if r else 0)
        cell = im[y0c + top:y0c + bottom, x0c:x1c]
        f = cut(cell)
    a = cv2.GaussianBlur(f.astype(np.float32), (3, 3), .8)
    ys, xs = np.nonzero(f); y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    Image.fromarray(np.dstack([cell[y0:y1, x0:x1, ::-1], (a[y0:y1, x0:x1] * 255).astype(np.uint8)])).save(f'{OUT}/{nm}.png')
    print(nm, x1 - x0, y1 - y0, "top", top, "bottom", bottom)
