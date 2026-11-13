import numpy as np, pickle
from scipy import ndimage as ndi
from register import BA, BASE, skin
from common import NECK
BSK = BA & skin(BASE[..., :3])
def hands_span(S):
    ys = np.nonzero(S.any(1))[0]; t, b = ys.min(), ys.max(); h = b - t
    xs = np.nonzero(S[t + int(.45 * h): t + int(.75 * h)].any(0))[0]
    return xs.max() - xs.min() + 1 if len(xs) else np.nan
def head_skin_width(S):
    lab, n = ndi.label(S)
    if not n: return np.nan
    ys = np.nonzero(S.any(1))[0]; top = ys.min()
    # いちばん上にある大きなかたまり＝頭
    best = None
    for i in range(1, n + 1):
        yy, xx = np.nonzero(lab == i)
        if len(yy) < 30: continue
        if best is None or yy.min() < best[0]: best = (yy.min(), xx.max() - xx.min() + 1)
    return best[1] if best else np.nan
base_hand = hands_span(BSK); base_head = head_skin_width(ndi.binary_opening(BSK & (np.arange(BA.shape[0])[:, None] < NECK)))
def clean(c): return ndi.binary_opening(skin(c['img']) & c['m'])
if __name__ == '__main__':
    print('base hands', base_hand, 'base head', base_head)
    for n, nc in [('3696', 19), ('3694', 20), ('3695', 20)]:
        cs = pickle.load(open(f'cells_{n}.pkl', 'rb')); rows = {}
        for c in cs:
            if c is None: continue
            S = clean(c)
            rows.setdefault(c['k'] // nc, []).append((hands_span(S) / base_hand, head_skin_width(S) / base_head))
        for r, v in sorted(rows.items()):
            v = np.array(v); print(n, r, 'hands', np.round(np.nanmedian(v[:, 0]), 4), 'head', np.round(np.nanmedian(v[:, 1]), 4))
