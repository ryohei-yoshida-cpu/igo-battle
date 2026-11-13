# 男の子の素材（頭だけ・体だけ・靴だけ）と、女の子の靴を、素体のキャンバスへ
import numpy as np, pickle, json, sys, os
from scipy import ndimage as ndi
from common import *
from cells import cells
from register import skin
from eyes import faceskin
from build3 import keep_big
FT = json.load(open('facetarget.json'))
SEC = {
    '3697': dict(outfit=((0, 45, 765, 1024), 11, 14), face=((765, 45, 1536, 580), 10, 15), shoes=((765, 640, 1536, 1024), 11, 16)),
    '3698': dict(outfit=((0, 50, 800, 565), 7, 17), face=((805, 50, 1536, 1024), 15, 14), shoes=((0, 630, 800, 1024), 10, 17)),
}
def Msim(s, sx, sy, tx, ty, sxx=None):
    a = sxx if sxx is not None else s
    return np.float32([[a, 0, tx - sx * a], [0, s, ty - sy * s]])
def boy_face(c):
    F = ndi.binary_opening(faceskin(c['img']) & c['m']); lab, n = ndi.label(F)
    if not n: return None
    sz = ndi.sum(F, lab, range(1, n + 1)); F = lab == (np.argmax(sz) + 1); ys, xs = np.nonzero(F)
    w = xs.max() - xs.min()
    if w < 10: return None
    s = FT['w'] / w
    return Msim(s, float(np.median(xs)), ys.max(), FT['cx'], FT['chin'])
def boy_outfit(c):
    m = c['m']; ys, xs = np.nonzero(m); top, bot = ys.min(), ys.max(); h = bot - top
    band = m[top + int(.30 * h): top + int(.62 * h)]; wd = np.nonzero(band.any(0))[0]; w = wd.max() - wd.min()
    sy = (572 - 258) / h; sx = 182 / w
    cx = (wd.min() + wd.max()) / 2
    return np.float32([[sx, 0, 200 - cx * sx], [0, sy, 258 - top * sy]])
def shoe_mask(c):
    m = c['m'] & ~skin(c['img']) & ~faceskin(c['img'])
    m = thick(m)
    lab, n = ndi.label(m)
    if n: sz = ndi.sum(m, lab, range(1, n + 1)); m = np.isin(lab, [i + 1 for i, v in enumerate(sz) if v >= .15 * sz.max()])
    return ndi.binary_dilation(m, iterations=1) & c['m'] & ~skin(c['img'])
def shoe_M(m):
    ys, xs = np.nonzero(m); w = xs.max() - xs.min(); s = 106 / w
    return Msim(s, (xs.min() + xs.max()) / 2, ys.max(), 200, 573)
def run():
    meta = dict(bface=[], boutfit=[], shoes=[])
    # 女の子の靴
    cs = cells('src/3693.png', 11, 18); k = 0
    for c in cs:
        if c is None: continue
        if c['m'].shape[0] > 95: print('skip double shoe', c['k']); continue
        m = shoe_mask(c)
        if m.sum() < 30: continue
        save(warp(c['img'], soft(m), shoe_M(m)), f's{k:03d}'); meta['shoes'].append(('g', c['k'])); k += 1
    nf = no = 0
    for sheet, S in SEC.items():
        for kind, (rect, nr, nc) in S.items():
            cs = cells(f'src/{sheet}.png', nr, nc, rect)
            hmed = np.median([np.ptp(np.nonzero(c['m'])[0]) for c in cs if c is not None and c['m'].sum() >= 150])
            for c in cs:
                if c is None or c['m'].sum() < 150: continue
                if np.ptp(np.nonzero(c['m'])[0]) > 1.45 * hmed: print('skip double', sheet, kind, c['k']); continue
                if kind == 'face':
                    M = boy_face(c)
                    if M is None: continue
                    save(warp(c['img'], soft(keep_big(c['m'], .15, 2)), M), f'fb{nf:03d}'); meta['bface'].append((sheet, c['k'])); nf += 1
                elif kind == 'outfit':
                    save(warp(c['img'], soft(c['m']), boy_outfit(c)), f'ob{no:03d}'); meta['boutfit'].append((sheet, c['k'])); no += 1
                else:
                    m = shoe_mask(c)
                    if m.sum() < 30: continue
                    ys = np.nonzero(m)[0]
                    if np.ptp(ys) > 1.4 * np.median([np.ptp(np.nonzero(x['m'])[0]) for x in cs if x is not None]): print('skip double shoe', c['k']); continue
                    save(warp(c['img'], soft(m), shoe_M(m)), f's{k:03d}'); meta['shoes'].append((sheet, c['k'])); k += 1
    json.dump(meta, open('meta_more.json', 'w')); print({a: len(b) for a, b in meta.items()})
if __name__ == '__main__':
    for f in os.listdir(OUT):
        if f[:2] in ('fb', 'ob') or (f[0] == 's' and f[1].isdigit()): os.remove(OUT + f)
    run()
