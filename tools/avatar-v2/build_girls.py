import numpy as np, pickle, json, sys
from scipy import ndimage as ndi
from common import *
from fit import fit_head, fit_body, sk, HC, NC
from register import skin
rel = json.load(open('rel.json')); RHB, RLB = rel['r_hb'], rel['r_lb']; V, Wv = np.array(rel['v']), np.array(rel['w'])
def nonskin_thick(c):
    m = c['m'] & ~skin(c['img'])
    return thick(m) 
def faces():
    cs = pickle.load(open('cells_3694.pkl', 'rb')); meta = []
    for c in cs:
        if c is None: continue
        sl, dl, _ = fit_body(c, low=True)
        sb = sl / RLB; neck = (NC * sl - dl) + Wv * sb; db = NC * sb - neck
        sh = RHB * sb; hc = neck + V * sb; dh = HC * sh - hc
        yn = int(NECK * sh - dh[1])
        keep = c['m'].copy(); below = keep.copy(); below[:yn + 2] = False
        keep[yn + 2:] = False
        hair = nonskin_thick(c); hair[:yn + 2] = False
        hair = ndi.binary_dilation(hair, iterations=1) & below
        # 首より下は、髪のかたまりのうち、頭につながっているものだけ
        lab, n = ndi.label(hair | keep); top_ids = set(np.unique(lab[keep])) - {0}
        m = np.isin(lab, list(top_ids)) & (keep | hair)
        meta.append((c['k'], sh, dh.tolist()))
        save(warp(c['img'], soft(m), to_canvas(sh, dh)), f'fg{c["k"]:03d}')
    return meta
def outfits():
    cs = pickle.load(open('cells_3695.pkl', 'rb')); meta = []
    fits = {}
    for c in cs:
        if c is None: continue
        try: fits[c['k']] = fit_head(c)[:2]
        except ValueError: fits[c['k']] = None
    rowmed = {}
    for k, f in fits.items():
        if f: rowmed.setdefault(k // 20, []).append(f[0])
    rowmed = {r: float(np.median(v)) for r, v in rowmed.items()}
    for c in cs:
        if c is None: continue
        f = fits[c['k']]; rm = rowmed[c['k'] // 20]
        if f is None or abs(f[0] / rm - 1) > .12:
            # 肌が見えない・大きさがおかしいマス：行の大きさで、外形の上の端と真ん中に合わせる
            sh = rm; ys, xs = np.nonzero(c['m']); top = ys.min(); cx = (xs.min() + xs.max()) / 2
            dh = np.array([HC[0] * sh - cx, 17 * sh - top])
            print('fallback', c['k'])
        else: sh, dh = f
        sb = sh / RHB; neck = (HC * sh - dh) - V * sb; db = NC * sb - neck
        ynh = int(NECK * sh - dh[1]); ynb = int(NECK * sb - db[1])
        body = c['m'].copy(); body[:ynb - 1] = False
        hat = nonskin_thick(c); hat[ynh - 1:] = False
        hat = ndi.binary_dilation(hat, iterations=1) & c['m'] & ~body; hat[ynh - 1:] = False
        save(warp(c['img'], soft(body), to_canvas(sb, db)), f'og{c["k"]:03d}')
        hs = int(hat.sum()) > 25
        if hs: save(warp(c['img'], soft(hat), to_canvas(sh, dh)), f'og{c["k"]:03d}h')
        meta.append((c['k'], hs))
    return meta
def pets():
    cs = pickle.load(open('cells_3696.pkl', 'rb')); meta = []
    for c in cs:
        if c is None: continue
        sh, dh, _ = fit_head(c); sb = sh / RHB; neck = (HC * sh - dh) - V * sb; db = NC * sb - neck
        m = nonskin_thick(c)
        # 体のりんかく線（肌のすぐとなりの細い線）は入れない。小さすぎるかけらも捨てる
        m = ndi.binary_dilation(m, iterations=1) & c['m'] & ~skin(c['img'])
        lab, n = ndi.label(m)
        if n:
            sz = ndi.sum(m, lab, range(1, n + 1)); m = np.isin(lab, [i + 1 for i, v in enumerate(sz) if v >= max(12, .08 * sz.max())])
        save(warp(c['img'], soft(m), to_canvas(sb, db)), f'p{c["k"]:03d}')
        meta.append(c['k'])
    return meta
if __name__ == '__main__':
    out = {}
    for k in sys.argv[1:]: out[k] = globals()[k]()
    json.dump(out, open('girls_meta_%s.json' % '_'.join(sys.argv[1:]), 'w'))
    print({k: len(v) for k, v in out.items()})
