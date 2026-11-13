import numpy as np
from seg import *
def period(p, lo, hi):
    p = p - p.mean(); best = None
    for n in range(lo, hi + 1):
        L = len(p); k = np.arange(L)
        c = abs((p * np.exp(-2j * np.pi * n * k / L)).sum())
        if best is None or c > best[0]: best = (c, n)
    return best[1]
def cuts(profile, n, a=0, b=None):
    b = b or len(profile); L = b - a; sm = np.convolve(profile, np.ones(5) / 5, 'same'); res = [a]
    for k in range(1, n):
        c = a + k * L / n; lo, hi = int(c - .3 * L / n), int(c + .3 * L / n)
        seg = sm[lo:hi]; m = seg.min(); idx = np.nonzero(seg <= m + 1e-6)[0]
        res.append(lo + int(idx[np.argmin(np.abs(idx + lo - c))]))
    return res + [b]
if __name__ == '__main__':
    for n in ['3693','3694','3695','3696']:
        im = load(f'src/{n}.png'); fg = ~bgmask(im)
        ys, xs = np.nonzero(fg)
        print(n, 'bbox', xs.min(), xs.max(), ys.min(), ys.max(), 'cols', period(fg.sum(0).astype(float), 8, 30), 'rows', period(fg.sum(1).astype(float), 5, 16))
