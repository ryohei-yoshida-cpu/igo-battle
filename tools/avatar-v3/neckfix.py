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
        if best is None or y0 < best[0]:
            top8 = mk[:10]; xx = np.nonzero(top8.any(0))[0]; best = (y0, sl[1].start + (xx.min() + xx.max()) / 2 if len(xx) else mx)   # 首の上はし10段のまん中
    return best, h, bot
DROP = {'b166', 'b67', 'b68', 'b79', 'b82', 'b102', 'b103', 'b113', 'b117', 'b163', 'b169'}   # 廃棄（2026/11/15）
BODYFIX = {'b170': (15, 0), 'b164': (15, 0), 'b119': (15, 0), 'b90': (0, -15)}   # 目で見て直したもの（横, 縦）
NOHEAD = {'b89', 'b90', 'b97', 'b166'}
MANUAL = {'b85': 1.18}   # 首が見えず、肌色のまちがいを拾う服（手と足で合わせる）
def feetx(p):
    # 足（いちばん下の 4% の高さ）のまん中。持ち物が横にあっても、ずれない
    a = p[..., 3] > 128; ys, xs = np.nonzero(a); b = ys.max(); band = a[int(b - .04 * (b - ys.min())):b + 1]
    lab, n = ndi.label(band); sz = ndi.sum(band, lab, range(1, n + 1))
    big = [i + 1 for i in np.argsort(sz)[::-1][:2]]; xx = np.nonzero(np.isin(lab, big).any(0))[0]
    return (xx.min() + xx.max()) / 2
for arg in sys.argv[1:]:
    pre, b0, n = arg.split(':'); b0, n = int(b0), int(n)
    for k in range(n):
        p = np.asarray(Image.open(f'cut/{pre}b{k:02d}.png')); name = f'b{b0 + k}'
        if name in DROP: continue
        nk, h, bot = neck(p)
        if name in NOHEAD: nk = None
        if name in MANUAL:   # 目で決めた大きさ。足もとの真ん中・下はしで合わせる
            s = MANUAL[name]; a = p[..., 3] > 128; ys, xs = np.nonzero(a); fy = ys.max(); fx = xs[ys > fy - .08 * (fy - ys.min())]
            cx = (fx.min() + fx.max()) / 2; put(p, s, 200 - cx * s, FEET - fy * s, name); print(name, 'manual', s); continue
        if nk:
            s = (FEET - NECK) / (bot - nk[0]); cx = nk[1]; ny = nk[0]; how = 'neck'   # 横は首のまん中（持ち物で手の位置がずれるので）
        elif h:
            top, cx, hy, hw = h; s = (FEET - NECK - HAND_Y) / (bot - hy); ny = hy - HAND_Y / s; how = 'hands+feet'; cx = feetx(p)
        else:
            ys, xs = np.nonzero(p[..., 3] > 128); s = (FEET - NECK) / (bot - ys.min()); ny = ys.min(); cx = feetx(p); how = 'feet'
        fx, fy = BODYFIX.get(name, (0, 0))
        put(p, s, 200 - cx * s + fx, NECK - ny * s + fy, name); print(name, how, round(s, 3))
