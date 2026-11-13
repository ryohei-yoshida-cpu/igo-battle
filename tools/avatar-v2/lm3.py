# 目印で合わせる：頭（幅・耳の高さ・真ん中）、首、足、両手の幅
import numpy as np, pickle, json
from scipy import ndimage as ndi
from register import BA, BASE, skin
def measure(S):
    ys = np.nonzero(S.any(1))[0]
    if len(ys) < 10: return None
    top, feet = ys.min(), ys.max(); Ht = feet - top
    wid = S.sum(1)
    # 頭：上から下へ。幅が一番大きくなってから、その6割より細くなった所が首
    mx, ear, neck = 0, top, None
    for y in range(top, feet):
        if wid[y] > mx: mx, ear = wid[y], y
        if mx > 8 and wid[y] < .40 * mx and y > ear: neck = y; break
    if neck is None: neck = top + int(.4 * Ht)
    hw = mx; xs = np.nonzero(S[ear])[0]; cx = (xs.min() + xs.max()) / 2
    band = S[neck + int(.30 * (feet - neck)): neck + int(.62 * (feet - neck))]
    hx = np.nonzero(band.any(0))[0]; hands = hx.max() - hx.min() + 1 if len(hx) else 0
    fx = np.nonzero(S[feet - 4:feet + 1].any(0))[0]
    if not len(fx): fx = np.array([0, 1])
    fspan = fx.max() - fx.min() + 1; fcx = (fx.max() + fx.min()) / 2
    return dict(top=top, feet=feet, ear=ear, hw=hw, cx=cx, neck=neck, hands=hands, fspan=fspan, fcx=fcx)
B = measure(BA & skin(BASE[..., :3]) | (BA & ~ndi.binary_erosion(BA, iterations=6)) & False)
B = measure(ndi.binary_erosion(BA, iterations=8))   # 素体：りんかく線の内側（シートの肌と同じくらい）
def sk(c): return ndi.binary_opening(skin(c['img']) & c['m'])
if __name__ == '__main__':
    print('base', B)
    cs = pickle.load(open('cells_3696.pkl', 'rb')); M = []
    for c in cs:
        if c is None: continue
        m = measure(sk(c))
        if m: M.append(m)
    keys = ['neck', 'feet', 'ear', 'hands', 'fspan']
    R = {}
    for k in ['neck', 'feet']: R[k + '_dy'] = float(np.median([(m[k] - m['ear']) / m['hw'] for m in M]))
    for k in ['hands', 'fspan']: R[k] = float(np.median([m[k] / m['hw'] for m in M]))
    R['fcx_dx'] = float(np.median([(m['fcx'] - m['cx']) / m['hw'] for m in M]))
    R['B'] = {k: float(v) for k, v in B.items()}
    json.dump(R, open('lm.json', 'w')); print(R)
    print('base ratios', (B['neck'] - B['ear']) / B['hw'], (B['feet'] - B['ear']) / B['hw'], B['hands'] / B['hw'], B['fspan'] / B['hw'])
def legdist(S, m):
    y = int(m['feet'] - .22 * (m['feet'] - m['neck']))
    lab, n = ndi.label(S[y])
    segs = sorted([np.nonzero(lab == i + 1)[0] for i in range(n)], key=len, reverse=True)[:2]
    if len(segs) < 2: return None
    a, b = sorted([s.mean() for s in segs]); return b - a, (a + b) / 2
def chin_down(S, m):
    """はげ頭：耳の高さから真ん中の列を下へ。肌が切れた所＝あごの線"""
    cx = int(round(m['cx'])); col = S[:, max(0, cx - 1):cx + 2].any(1); y = m['ear']
    while y < len(col) - 1 and col[y]: y += 1
    return y
def chin_up(S, feet, top, cx):
    """顔のシート：おなかから真ん中の列を上へ。肌が切れた所＝あごの線"""
    cx = int(round(cx)); col = S[:, max(0, cx - 1):cx + 2].any(1); y = int(feet - .55 * (feet - top))
    while y > top and not col[y]: y -= 1      # おなかが髪でかくれていたら、肌が出るまで上へ
    while y > top and col[y]: y -= 1
    return y
