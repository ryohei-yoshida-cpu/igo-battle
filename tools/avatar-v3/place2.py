import cv2, numpy as np, os, json
from PIL import Image
from scipy import ndimage as ndi
OUT = '/home/claude/igo-battle/img/av3/'; TH = '/home/claude/igo-battle/img/av3t/'
W, H = 460, 650; NECK, FEET = 300, 622
SETS = {'body': ['body1', 'body2', 'body3', 'body4', 'body5'], 'head': ['head1', 'head2', 'head3', 'head4', 'head5', 'head6', 'head7', 'head8'], 'pet': ['pet1', 'pet2', 'pet3', 'pet4'], 'tool': ['tool2', 'tool4']}
SKIP = {('head8', 0), ('head8', 4)}          # 「ふつうの男の子・女の子」と同じ絵
RESERVED = {'b32', 'b33', 'h32', 'h33'}      # 最初の装備（basic.py で置く）
PFX = {'body': 'b', 'head': 'h', 'pet': 'p', 'tool': 't'}
def hsv(rgb): return cv2.cvtColor(np.ascontiguousarray(rgb[..., ::-1]), cv2.COLOR_BGR2HSV).astype(int)
def skin(rgb):
    h = hsv(rgb); return (h[..., 0] >= 4) & (h[..., 0] <= 24) & (h[..., 1] >= 14) & (h[..., 1] <= 110) & (h[..., 2] >= 215)
def put(rgba, s, tx, ty, name):
    im = rgba.astype(np.float32); im[..., :3] *= im[..., 3:4] / 255
    o = cv2.warpAffine(im, np.float32([[s, 0, tx], [0, s, ty]]), (W, H), flags=cv2.INTER_AREA if s < 1 else cv2.INTER_CUBIC, borderValue=0)
    a = np.clip(o[..., 3], 0, 255); rgb = np.where(a[..., None] > 1, o[..., :3] / np.maximum(a[..., None], 1) * 255, 0)
    Image.fromarray(np.dstack([np.clip(rgb, 0, 255), a]).astype(np.uint8)).save(OUT + name + '.webp', quality=92, method=4)
def thumb(rgba, name):
    im = Image.fromarray(rgba); s = 150 / max(im.size); im = im.resize((max(1, int(im.width * s)), max(1, int(im.height * s))), Image.LANCZOS)
    t = Image.new('RGBA', (160, 160)); t.alpha_composite(im, ((160 - im.width) // 2, (160 - im.height) // 2)); t.save(TH + name + '.webp', quality=85)
def hands(b):
    """両手（外側にある肌のかたまり）の、下の端と左右の真ん中"""
    a = b[..., 3] > 128; S = skin(b[..., :3]) & a; S = ndi.binary_opening(S, iterations=2)
    ys, xs = np.nonzero(a); top = ys.min(); w = xs.max() - xs.min(); cx = (xs.min() + xs.max()) / 2
    lab, n = ndi.label(S); best = []
    for i in range(1, n + 1):
        yy, xx = np.nonzero(lab == i)
        if len(yy) < 80: continue
        mx = xx.mean()
        if abs(mx - cx) < .22 * w or yy.mean() < top + .2 * (ys.max() - top): continue
        best.append((len(yy), mx, yy.max(), yy.mean()))
    L = max([q for q in best if q[1] < cx], default=None); R = max([q for q in best if q[1] > cx], default=None)
    if not L or not R: return None
    return top, (L[1] + R[1]) / 2, (L[3] + R[3]) / 2, R[1] - L[1]
# 基準：最初の8つの身体（足まで描かれている）で、首→手の高さを決める
ref = []
for k in range(8):
    b = np.asarray(Image.open(f'cut/body1_{k}.png')); h = hands(b); ys = np.nonzero(b[..., 3] > 128)[0]
    s = (FEET - NECK) / (ys.max() - ys.min()); ref.append(((h[2] - h[0]) * s, h[3] * s))
HAND_Y = float(np.median([r[0] for r in ref])); HAND_W = float(np.median([r[1] for r in ref]))
print('hand y', HAND_Y, 'hand span', HAND_W)
meta = {}
HEADS = {}
# h09 は place2.py のあと、さらに 0.95倍・左へ約50・上へ約50 ずらしてある（2026/11/14 手直し。作り直すときは注意）
FIX = {'h09': (1.12, -22), 'h36': (1.06, -30, 16), 'h61': (1.08, -8)}   # 目で見て直したもの（大きさ、上下）
for kind, srcs in SETS.items():
    i = 0; meta[kind] = []
    for src in srcs:
        for k in range(8):
            if (src, k) in SKIP: continue
            while f'{PFX[kind]}{i:02d}' in RESERVED: i += 1
            p = np.asarray(Image.open(f'cut/{src}_{k}.png')); name = f'{PFX[kind]}{i:02d}'; i += 1
            if kind == 'body':
                h = hands(p)
                if h is None:
                    ys, xs = np.nonzero(p[..., 3] > 128); s = (FEET - NECK) / (ys.max() - ys.min()); top, cx = ys.min(), (xs.min() + xs.max()) / 2; note = 'feet'
                else:
                    top, cx, hy, hw = h; sh = (HAND_Y / (hy - top) + HAND_W / hw) / 2
                    ys = np.nonzero(p[..., 3] > 128)[0]; sf = (FEET - NECK) / (ys.max() - ys.min())
                    s = min(sh, sf); note = 'hands' if sh < sf else 'feet'   # 足のない着物は手で、手がうまく見つからないときは足で
                put(p, s, 200 - cx * s, NECK - top * s, name)
            elif kind == 'head':
                S = skin(p[..., :3]) & (p[..., 3] > 200); S = ndi.binary_opening(S, iterations=2)
                lab, n = ndi.label(S); sz = ndi.sum(S, lab, range(1, n + 1)) if n else []
                ys, xs = np.nonzero(p[..., 3] > 128); bw = xs.max() - xs.min()
                ok = n and max(sz) > .06 * len(ys)
                if ok:
                    F = lab == (np.argmax(sz) + 1); fy, fx = np.nonzero(F); fw = fx.max() - fx.min()
                    ok = fw > .3 * bw
                if not ok:
                    # 白ぬりの顔：白っぽい所でさがす
                    hh = hsv(p[..., :3]); Wm = (hh[..., 1] < 45) & (hh[..., 2] > 225) & (p[..., 3] > 200)
                    Wm = ndi.binary_opening(Wm, iterations=3); lab, n = ndi.label(Wm); sz = ndi.sum(Wm, lab, range(1, n + 1))
                    F = lab == (np.argmax(sz) + 1); fy, fx = np.nonzero(F); note = 'white'
                else: note = 'skin'
                fw = fx.max() - fx.min(); s = 150 / fw; cx = (fx.min() + fx.max()) / 2
                HEADS.setdefault(src, []).append((name, p, s, cx, fy.max()))
                if k == 7:
                    med = float(np.median([q[2] for q in HEADS[src]]))
                    for nm, pp, ss, ccx, chin in HEADS[src]:
                        if abs(ss / med - 1) > .12: print('head scale fix', nm, round(ss / med, 2)); ss = med
                        f, dy, dx = (FIX.get(nm, (1, 0)) + (0,))[:3]; ss *= f
                        put(pp, ss, 200 - ccx * ss + dx, 314 - chin * ss + dy, nm)
            elif kind == 'pet':
                s = 118 / max(p.shape[0], p.shape[1] * .85); put(p, s, 372 - p.shape[1] * s / 2, 250 - p.shape[0] * s / 2, name); note = ''
            else:
                s = 112 / max(p.shape[0], p.shape[1]); put(p, s, 92 - p.shape[1] * s / 2, 470 - p.shape[0] * s / 2, name); note = ''
            thumb(p, name); meta[kind].append(note)
print(json.dumps(meta))
