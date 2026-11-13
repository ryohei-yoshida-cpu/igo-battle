# シートの人形＝素体（大きさがちがうだけ）。マスごとに1つの拡大・移動で重ねる
#   服：頭の肌で合わせる / 顔：下半身の肌で合わせる / ペット：全身の肌で合わせる
import numpy as np, pickle, json, sys, os
from scipy import ndimage as ndi
from common import *
from register import skin, BA
from fit import fit_head, fit_body, sk, best
from build3 import nst, keep_big, rowmed
SC = np.arange(.045, .085, .0005)
def fit_rows(cs, nc, f):
    F = {}
    for c in cs:
        if c is None: continue
        try: F[c['k']] = f(c)
        except Exception: F[c['k']] = None
    rm = rowmed({k: (v[0] if v else None) for k, v in F.items()}, nc)
    return F, rm
def fallback(c, s):
    ys, xs = np.nonzero(c['m']); return s, np.array([423 * s - (xs.min() + xs.max()) / 2, 25 * s - ys.min()])
def outfits():
    cs = pickle.load(open('cells_3695.pkl', 'rb')); F, rm = fit_rows(cs, 20, lambda c: fit_head(c, SC)); hats = []
    for c in cs:
        if c is None: continue
        f = F[c['k']]; s0 = rm[c['k'] // 20]
        s, d = (f[0], f[1]) if f and abs(f[0] / s0 - 1) < .08 else fallback(c, s0)
        yn = int(round(NECK * s - d[1]))
        body = c['m'].copy(); body[:yn - 1] = False
        hat = nst(c); hat[yn - 1:] = False
        lab, n = ndi.label(hat)
        if n: sz = ndi.sum(hat, lab, range(1, n + 1)); hat = np.isin(lab, [i + 1 for i, v in enumerate(sz) if v >= 30])
        hat = ndi.binary_dilation(hat, iterations=1) & c['m']; hat[yn - 1:] = False
        M = to_canvas(s, d)
        save(warp(c['img'], soft(body), M), f'og{c["k"]:03d}')
        if hat.sum() > 40: save(warp(c['img'], soft(hat), M), f'og{c["k"]:03d}h'); hats.append(c['k'])
    return hats
from register import BA as _BA
_Y = np.arange(_BA.shape[0])[:, None]; LEGS = _BA & (_Y > 1506 - .45 * (1506 - 120))
def fit_legs(c):
    S = sk(c); ys = np.nonzero(S.any(1))[0]; f = ys.max(); C = S.copy(); C[:int(f - .45 * (f - ys.min()))] = False
    return best(C, LEGS, SC)
from eyes import faceskin
def chin(c):
    S = ndi.binary_opening(faceskin(c['img']) & c['m']); H = S.shape[0]
    lab, n = ndi.label(S); best = None
    for i in range(1, n + 1):
        yy, xx = np.nonzero(lab == i)
        if len(yy) < 60 or yy.min() > .5 * H: continue
        if best is None or yy.min() < best[0]: best = (yy.min(), yy, xx)
    if not best: return None
    yy, xx = best[1], best[2]; bot = yy.max()
    low = xx[yy > bot - 3]
    return np.array([float(np.median(xx[yy > yy.min() + .5 * (bot - yy.min())])), float(bot), float(xx.max() - xx.min())])
def faces():
    cs = pickle.load(open('cells_3694.pkl', 'rb'))
    SF = .0558   # 顔のシートの人形はどれも同じ大きさ（よく合った行の中央値）
    F = {}; rm = {r: SF for r in range(10)}
    CH = {c['k']: chin(c) for c in cs if c is not None}
    good = {k: v for k, v in CH.items() if v is not None and v[2] > 14 and v[1] < .7 * cs[k]['m'].shape[0]}
    rowy = rowmed({k: v[1] + cs[k]['oy'] for k, v in good.items()}, 20)
    for c in cs:
        if c is None: continue
        ch = good.get(c['k'])
        if ch is None:
            S = sk(c); ys, xs = np.nonzero(S); low = xs[ys > ys.max() - 6]
            ch = np.array([float(np.median(low)) if len(low) else c['m'].shape[1] / 2, rowy[c['k'] // 20] - c['oy']])
            print('face fallback', c['k'])
        F[c['k']] = (SF, np.array([423 * SF - ch[0], 497 * SF - ch[1]]), 1)
    for c in cs:
        if c is None: continue
        f = F[c['k']]; s0 = rm[c['k'] // 20]
        s, d = (f[0], f[1]) if f and abs(f[0] / s0 - 1) < .08 else (s0, f[1] if f else fallback(c, s0)[1])
        yn = int(round(NECK * s - d[1]))
        keep = c['m'].copy(); keep[yn + 1:] = False
        below = c['m'].copy(); below[:yn + 1] = False
        hair = ndi.binary_dilation(thick(c['m'] & ~skin(c['img']) & ~faceskin(c['img'])), iterations=1) & below & ~faceskin(c['img'])
        lab, n = ndi.label(hair | keep); ids = set(np.unique(lab[keep])) - {0}
        m = np.isin(lab, list(ids)) & (keep | hair)
        m = keep_big(m, .15, 2)   # となりのマスのかけらを捨てる
        save(warp(c['img'], soft(m), to_canvas(s, d)), f'fg{c["k"]:03d}')
    return len(F)
def pets():
    cs = pickle.load(open('cells_3696.pkl', 'rb'))
    F, rm = fit_rows(cs, 19, lambda c: best(sk(c), None, SC))
    for c in cs:
        if c is None: continue
        f = F[c['k']]; s0 = rm[c['k'] // 19]
        s, d = (f[0], f[1]) if f and abs(f[0] / s0 - 1) < .08 else fallback(c, s0)
        m = keep_big(ndi.binary_dilation(nst(c), iterations=1) & c['m'] & ~skin(c['img']))
        save(warp(c['img'], soft(m), to_canvas(s, d)), f'p{c["k"]:03d}')
    return len(F)
if __name__ == '__main__':
    PRE = {'faces': 'fg', 'outfits': 'og', 'pets': 'p'}
    for f in os.listdir(OUT):
        for k in sys.argv[1:]:
            p = PRE[k]
            if f.startswith(p) and f[len(p)].isdigit(): os.remove(OUT + f)
    out = {k: globals()[k]() for k in sys.argv[1:]}
    json.dump(out, open('meta_girls.json', 'w')); print({k: (v if isinstance(v, int) else len(v)) for k, v in out.items()})
