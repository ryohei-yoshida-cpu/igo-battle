# 頭と体を別々に、素体の目印へ合わせる（縦横べつべつの拡大）
import numpy as np, pickle, json, sys, os
from scipy import ndimage as ndi
from common import *
from register import skin
from lm3 import measure, sk, chin_down, chin_up
R = json.load(open('lm.json'))
B = dict(top=25., neck=float(NECK), feet=1506., hw=473., cx=423., hands=552.)
def canvas_of(bx, by): return ((bx - BX) * K + CX, (by - BY) * K + CY)
def affine(cx, y0, y1, w, bx, by0, by1, bw):
    """マスの (真ん中x, 上y0, 下y1, 幅w) → 素体の (bx, by0, by1, bw) → キャンバス"""
    ax = bw / w * K; ay = (by1 - by0) / (y1 - y0) * K
    X0, Y0 = canvas_of(bx, by0)
    return np.float32([[ax, 0, X0 - cx * ax], [0, ay, Y0 - y0 * ay]])
def geo(hw, cx, neck, top=None):
    return dict(hw=hw, cx=cx, neck=neck, top=neck - R['nt'] * hw if top is None else top, feet=neck + R['fn'] * hw, hands=R['hands'] * hw)
def head_M(g): return affine(g['cx'], g['top'], g['neck'], g['hw'], B['cx'], B['top'], B['neck'], B['hw'])
def body_M(g): return affine(g['cx'], g['neck'], g['feet'], g['hands'], B['cx'], B['neck'], B['feet'], B['hands'])
def rowmed(d, nc):
    rows = {}
    for k, v in d.items():
        if v is not None: rows.setdefault(k // nc, []).append(v)
    return {r: float(np.median(v)) for r, v in rows.items()}
def by_head(cs, nc):
    ms = {c['k']: measure(sk(c)) for c in cs if c is not None}
    rm = rowmed({k: (m['hw'] if m else None) for k, m in ms.items()}, nc); G = {}
    for c in cs:
        if c is None: continue
        m = ms[c['k']]; hw0 = rm[c['k'] // nc]
        if m and abs(m['hw'] / hw0 - 1) < .12: G[c['k']] = geo(m['hw'], m['cx'], chin_down(sk(c), m))
        else:
            ys, xs = np.nonzero(c['m']); G[c['k']] = geo(hw0, (xs.min() + xs.max()) / 2, ys.min() + R['nt'] * hw0 * 1.05)
    return G
def by_feet(cs, nc):
    ms = {c['k']: measure(sk(c)) for c in cs if c is not None}
    rm = rowmed({k: (m['fspan'] / R['fspan'] if m else None) for k, m in ms.items()}, nc); G = {}
    for c in cs:
        if c is None: continue
        m = ms[c['k']]; hw = rm[c['k'] // nc]
        ys, xs = np.nonzero(c['m'])
        if m is None: feet, fcx = ys.max(), (xs.min() + xs.max()) / 2
        else: feet, fcx = m['feet'], m['fcx']
        cx = fcx - R['dx'] * hw
        chin = chin_up(sk(c), feet, ys.min(), cx)
        if not (feet - 2.3 * R['fn'] * hw < chin < feet - .6 * R['fn'] * hw): chin = feet - R['fn'] * hw
        G[c['k']] = geo(hw, cx, chin)
    return G
def nst(c): return thick(c['m'] & ~skin(c['img']))
def keep_big(m, frac=.25, near=5):
    lab, n = ndi.label(m)
    if not n: return m
    sz = ndi.sum(m, lab, range(1, n + 1)); big = int(np.argmax(sz)) + 1; nb = ndi.binary_dilation(lab == big, iterations=near)
    return np.isin(lab, [i + 1 for i, v in enumerate(sz) if v >= frac * sz.max() or (nb & (lab == i + 1)).any()])
def faces():
    cs = pickle.load(open('cells_3694.pkl', 'rb')); G = by_feet(cs, 20)
    for c in cs:
        if c is None: continue
        g = G[c['k']]; yn = int(round(g['neck']))
        keep = c['m'].copy(); keep[yn + 1:] = False
        below = c['m'].copy(); below[:yn + 1] = False
        hair = ndi.binary_dilation(nst(c), iterations=1) & below
        lab, n = ndi.label(hair | keep); ids = set(np.unique(lab[keep])) - {0}
        m = np.isin(lab, list(ids)) & (keep | hair)
        # 首より下の髪は、頭と同じ合わせ方（つながって見えるように）
        save(warp(c['img'], soft(m), head_M(g)), f'fg{c["k"]:03d}')
    return len(G)
def outfits():
    cs = pickle.load(open('cells_3695.pkl', 'rb')); G = by_head(cs, 20); hats = []
    for c in cs:
        if c is None: continue
        g = G[c['k']]; yn = int(round(g['neck']))
        body = c['m'].copy(); body[:yn - 1] = False
        hat = nst(c); hat[yn - 1:] = False
        lab, n = ndi.label(hat)
        if n: sz = ndi.sum(hat, lab, range(1, n + 1)); hat = np.isin(lab, [i + 1 for i, v in enumerate(sz) if v >= 30])
        hat = ndi.binary_dilation(hat, iterations=1) & c['m']; hat[yn - 1:] = False
        save(warp(c['img'], soft(body), body_M(g)), f'og{c["k"]:03d}')
        if hat.sum() > 40: save(warp(c['img'], soft(hat), head_M(g)), f'og{c["k"]:03d}h'); hats.append(c['k'])
    return hats
def pets():
    cs = pickle.load(open('cells_3696.pkl', 'rb')); G = by_head(cs, 19)
    for c in cs:
        if c is None: continue
        g = G[c['k']]
        m = keep_big(ndi.binary_dilation(nst(c), iterations=1) & c['m'] & ~skin(c['img']))
        # ペットは頭の横にいるので、頭の合わせ方（大きさは頭と体のあいだ）
        Mh, Mb = head_M(g), body_M(g); M = (Mh + Mb) / 2
        save(warp(c['img'], soft(m), M), f'p{c["k"]:03d}')
    return len(G)
if __name__ == '__main__':
    for f in os.listdir(OUT):
        if f[:2] in ('fg', 'og') or (f[0] == 'p' and f[1].isdigit()): os.remove(OUT + f)
    out = {k: globals()[k]() for k in sys.argv[1:]}
    json.dump(out, open('meta_girls.json', 'w')); print({k: (v if isinstance(v, int) else len(v)) for k, v in out.items()})
