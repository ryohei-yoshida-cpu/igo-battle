# 行事・季節の服の置きなおし：首（服の上の、肌色の首）の位置で合わせる。
#   首が見えない服（かぶとなど）は、手と足で合わせる。どちらもだめなら足まで。
#   python3 neckfix.py <かしら>:<最初の番号>:<数> ...   例 kd:78:12
import sys, numpy as np
from PIL import Image
from scipy import ndimage as ndi
exec(open('place3.py').read().split('# 行事の限定のアバター')[0])
def neck(p):
    a = p[..., 3] > 128; ys, xs = np.nonzero(a); top, bot = ys.min(), ys.max(); H = bot - top
    S = skin(p[..., :3]) & a
    h = hands(p); cx = h[1] if h else (xs.min() + xs.max()) / 2
    lab, n = ndi.label(S); best = None
    for i, sl in enumerate(ndi.find_objects(lab)):
        mk = lab[sl] == i + 1; c = mk.sum()
        if c < 60: continue
        y0 = sl[0].start; w = sl[1].stop - sl[1].start; mx = (sl[1].start + sl[1].stop) / 2
        if y0 > top + .45 * H or abs(mx - cx) > .12 * (xs.max() - xs.min()) or w > .35 * (xs.max() - xs.min()): continue
        if best is None or y0 < best[0]: best = (y0, mx)
    return best, h, bot
NOHEAD = {'b89', 'b90', 'b97', 'b166'}
MANUAL = {'b85': 1.18}   # 首が見えず、肌色のまちがいを拾う服（手と足で合わせる）
for arg in sys.argv[1:]:
    pre, b0, n = arg.split(':'); b0, n = int(b0), int(n)
    for k in range(n):
        p = np.asarray(Image.open(f'cut/{pre}b{k:02d}.png')); name = f'b{b0 + k}'
        nk, h, bot = neck(p)
        if name in NOHEAD: nk = None
        if name in MANUAL:   # 目で決めた大きさ。足もとの真ん中・下はしで合わせる
            s = MANUAL[name]; a = p[..., 3] > 128; ys, xs = np.nonzero(a); fy = ys.max(); fx = xs[ys > fy - .08 * (fy - ys.min())]
            cx = (fx.min() + fx.max()) / 2; put(p, s, 200 - cx * s, FEET - fy * s, name); print(name, 'manual', s); continue
        if nk:
            s = (FEET - NECK) / (bot - nk[0]); cx = h[1] if h else nk[1]; ny = nk[0]; how = 'neck'
        elif h:
            top, cx, hy, hw = h; s = (FEET - NECK - HAND_Y) / (bot - hy); ny = hy - HAND_Y / s; how = 'hands+feet'
        else:
            ys, xs = np.nonzero(p[..., 3] > 128); s = (FEET - NECK) / (bot - ys.min()); ny = ys.min(); cx = (xs.min() + xs.max()) / 2; how = 'feet'
        put(p, s, 200 - cx * s, NECK - ny * s, name); print(name, how, round(s, 3))
