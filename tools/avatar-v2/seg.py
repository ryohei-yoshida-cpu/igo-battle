# 市松もようの背景（うすい灰色と白）を消して、パーツ（または人形）を一つずつ取り出す
import cv2, numpy as np
from scipy import ndimage as ndi
def load(path):
    im = cv2.imread(path, cv2.IMREAD_UNCHANGED)
    if im.shape[2] == 4: im = im[..., :3]
    return im
def bgmask(im, region=None):
    hsv = cv2.cvtColor(im, cv2.COLOR_BGR2HSV); s, v = hsv[..., 1].astype(int), hsv[..., 2].astype(int)
    pale = (s < 22) & (v > 214)
    if region is not None: pale &= region
    lab, n = ndi.label(pale)
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    # 大きな「うすい」かたまり（パーツどうしのすき間）は背景
    sz = ndi.sum(pale, lab, range(1, n + 1))
    big = {i + 1 for i, v in enumerate(sz) if v > 1500}
    return np.isin(lab, list(edge | big))
def figures(im, fg, min_area=150, join=3):
    g = ndi.binary_dilation(fg, iterations=join)
    lab, n = ndi.label(g); objs = ndi.find_objects(lab)
    out = []
    for i, sl in enumerate(objs):
        m = (lab[sl] == i + 1) & fg[sl]
        if m.sum() < min_area: continue
        out.append(dict(y0=sl[0].start, y1=sl[0].stop, x0=sl[1].start, x1=sl[1].stop, m=m))
    return out
def rows(figs, gap=None):
    figs = sorted(figs, key=lambda f: (f['y0'] + f['y1']) / 2)
    hs = np.median([f['y1'] - f['y0'] for f in figs]); gap = gap or hs * .5
    R, cur = [], [figs[0]]
    for f in figs[1:]:
        if (f['y0'] + f['y1']) / 2 - np.mean([(c['y0'] + c['y1']) / 2 for c in cur]) > gap: R.append(cur); cur = [f]
        else: cur.append(f)
    R.append(cur)
    return [sorted(r, key=lambda f: f['x0']) for r in R]
