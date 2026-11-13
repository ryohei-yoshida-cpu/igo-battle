import numpy as np, pickle, json, sys
from scipy import ndimage as ndi
from common import *
from register import skin
from lm3 import measure, sk, legdist
R = json.load(open('lm.json')); BHW = 473.0; BFEET = 1506.0; BCX = 423.0
EAR_B = BFEET - R['feet_dy'] * BHW
def rowmed(vals, nc):
    rows = {}
    for k, v in vals.items():
        if v: rows.setdefault(k // nc, []).append(v)
    return {r: float(np.median(v)) for r, v in rows.items()}
def nonskin_thick(c): return thick(c['m'] & ~skin(c['img']))
def head_anchor(cs, nc):
    """服・ペット：頭の幅で大きさ、頭の真ん中と耳の高さで位置"""
    ms = {c['k']: measure(sk(c)) for c in cs if c is not None}
    sr = rowmed({k: (m['hw'] / BHW if m else None) for k, m in ms.items()}, nc)
    T = {}
    for c in cs:
        if c is None: continue
        m = ms[c['k']]; s0 = sr[c['k'] // nc]
        if m and abs(m['hw'] / BHW / s0 - 1) < .10:
            s = m['hw'] / BHW; d = np.array([BCX * s - m['cx'], EAR_B * s - m['ear']])
        else:
            s = s0; ys, xs = np.nonzero(c['m']); d = np.array([BCX * s - (xs.min() + xs.max()) / 2, 25 * s - ys.min()])
        T[c['k']] = (s, d)
    return T
def feet_anchor(cs, nc):
    """顔：足の幅で大きさ、足の下と真ん中で位置（髪が頭をかくしているため）"""
    ms = {c['k']: measure(sk(c)) for c in cs if c is not None}
    sr = rowmed({k: (m['fspan'] / R['fspan'] / BHW if m else None) for k, m in ms.items()}, nc)
    T = {}
    for c in cs:
        if c is None: continue
        m = ms[c['k']]; s = sr[c['k'] // nc]
        d = np.array([(BCX + R['fcx_dx'] * BHW) * s - m['fcx'], BFEET * s - m['feet']])
        T[c['k']] = (s, d)
    return T
def faces():
    cs = pickle.load(open('cells_3694.pkl', 'rb')); T = feet_anchor(cs, 20)
    for c in cs:
        if c is None: continue
        s, d = T[c['k']]; yn = int(NECK * s - d[1])
        keep = c['m'].copy(); keep[yn + 1:] = False
        below = c['m'].copy(); below[:yn + 1] = False
        hair = ndi.binary_dilation(nonskin_thick(c), iterations=1) & below
        lab, n = ndi.label(hair | keep); ids = set(np.unique(lab[keep])) - {0}
        m = np.isin(lab, list(ids)) & (keep | hair)
        save(warp(c['img'], soft(m), to_canvas(s, d)), f'fg{c["k"]:03d}')
    return len(T)
def outfits():
    cs = pickle.load(open('cells_3695.pkl', 'rb')); T = head_anchor(cs, 20); hats = []
    for c in cs:
        if c is None: continue
        s, d = T[c['k']]; yn = int(NECK * s - d[1])
        body = c['m'].copy(); body[:yn - 1] = False
        hat = nonskin_thick(c); hat[yn - 1:] = False
        lab, n = ndi.label(hat)
        if n:
            sz = ndi.sum(hat, lab, range(1, n + 1)); hat = np.isin(lab, [i + 1 for i, v in enumerate(sz) if v >= 30])
        hat = ndi.binary_dilation(hat, iterations=1) & c['m']; hat[yn - 1:] = False
        save(warp(c['img'], soft(body), to_canvas(s, d)), f'og{c["k"]:03d}')
        if hat.sum() > 40: save(warp(c['img'], soft(hat), to_canvas(s, d)), f'og{c["k"]:03d}h'); hats.append(c['k'])
    return hats
def pets():
    cs = pickle.load(open('cells_3696.pkl', 'rb')); T = head_anchor(cs, 19)
    for c in cs:
        if c is None: continue
        s, d = T[c['k']]
        m = ndi.binary_dilation(nonskin_thick(c), iterations=1) & c['m'] & ~skin(c['img'])
        lab, n = ndi.label(m)
        if n:
            sz = ndi.sum(m, lab, range(1, n + 1)); big = int(np.argmax(sz)) + 1
            near = ndi.binary_dilation(lab == big, iterations=5)
            m = np.isin(lab, [i + 1 for i, v in enumerate(sz) if v >= .25 * sz.max() or (near & (lab == i + 1)).any()])
        save(warp(c['img'], soft(m), to_canvas(s, d)), f'p{c["k"]:03d}')
    return len(T)
if __name__ == '__main__':
    import os
    for f in os.listdir(OUT):
        if f[:2] in ('fg', 'og') or (f[0] == 'p' and f[1].isdigit()): os.remove(OUT + f)
    out = {k: globals()[k]() for k in sys.argv[1:]}
    json.dump(out, open('meta_' + '_'.join(sys.argv[1:]) + '.json', 'w')); print({k: (v if isinstance(v, int) else len(v)) for k, v in out.items()})
