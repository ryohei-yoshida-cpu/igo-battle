import numpy as np, pickle, json
from scipy import ndimage as ndi
from register import BA, BASE, skin
from common import NECK
BSK = BA & skin(BASE[..., :3])
def chin_feet(S, fgm):
    """あご（体の真ん中の列を、おなかから上へたどって、最初に肌でなくなる所）と足の下"""
    ys = np.nonzero(S.any(1))[0]; feet = ys.max(); top = ys.min()
    xs = np.nonzero(S[feet - 6:feet].any(0))[0]
    if len(xs) == 0: return None
    cx = int(round((xs.min() + xs.max()) / 2))
    start = top + int((feet - top) * .62)
    col = S[:, max(0, cx - 1):cx + 2].any(1)
    y = start
    while y > top and col[y]: y -= 1
    return feet, y, cx
def head_box(S):
    lab, n = ndi.label(S); best = None
    for i in range(1, n + 1):
        yy, xx = np.nonzero(lab == i)
        if len(yy) < 30: continue
        if best is None or yy.min() < best[0]: best = (yy.min(), yy.max(), xx.min(), xx.max())
    return best
bf, bchin, bcx = chin_feet(BSK, BA)
bh = head_box(ndi.binary_opening(BSK & (np.arange(BA.shape[0])[:, None] < NECK)))
BASEINFO = dict(feet=bf, chin=bchin, cx=bcx, head=bh)
if __name__ == '__main__':
    print('base', BASEINFO)
    reg = json.load(open('reg_3696.json'))
    for n, nc in [('3696', 19), ('3694', 20)]:
        cs = pickle.load(open(f'cells_{n}.pkl', 'rb')); rows = {}
        for c in cs:
            if c is None: continue
            S = ndi.binary_opening(skin(c['img']) & c['m'])
            r = chin_feet(S, c['m'])
            if r: rows.setdefault(c['k'] // nc, []).append((r[0] - r[1]) / (bf - bchin))
        for r, v in sorted(rows.items()):
            iou = np.median([reg[str(k)]['s'] for k in reg if int(k) // nc == r]) if n == '3696' else 0
            print(n, r, 'chin-feet scale', np.round(np.median(v), 4), 'iqr', np.round(np.percentile(v, [25, 75]), 4), 'iou', iou)
