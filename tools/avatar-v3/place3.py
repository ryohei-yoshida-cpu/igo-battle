import cv2, numpy as np, os, json
from PIL import Image
from scipy import ndimage as ndi
OUT = '/home/claude/igo-battle/img/av3/'; TH = '/home/claude/igo-battle/img/av3t/'
W, H = 460, 650; NECK, FEET = 300, 622
SETS0 = {'body': ['body1', 'body2', 'body3', 'body4', 'body5'], 'head': ['head1', 'head2', 'head3', 'head4', 'head5', 'head6', 'head7', 'head8'], 'pet': ['pet1', 'pet2', 'pet3', 'pet4'], 'tool': ['tool2', 'tool4']}
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

# 行事の限定のアバター：python3 place3.py <かしら> <頭の数> <頭の最初の番号> <服の数> <服の最初の番号>
#   お正月：nyh/nyb 15 64 12 42　ひな祭り：hnh/hnb 15 79 12 54
import sys
PRE, NH, H0, NB, B0 = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), int(sys.argv[4]), int(sys.argv[5])
FEETONLY = 'feet' in sys.argv[6:]   # 足まで描いてある服は、首から足でそろえる（手で合わせると浮く）
FIX3 = {'h95': (1.1, 40)}   # 目で見て直したもの（大きさ・下へ）。花粉症の女の子は、たれた髪の先があごより下
heads = []
for k in range(NH):
    p = np.asarray(Image.open(f'cut/{PRE}h{k:02d}.png')); name = f'h{H0 + k}'
    S = skin(p[..., :3]) & (p[..., 3] > 200); S = ndi.binary_opening(S, iterations=2)
    lab, n = ndi.label(S); sz = ndi.sum(S, lab, range(1, n + 1))
    F = lab == (np.argmax(sz) + 1); fy, fx = np.nonzero(F)
    heads.append((name, p, 150 / (fx.max() - fx.min()), (fx.min() + fx.max()) / 2, fy.max()))
med = float(np.median([q[2] for q in heads]))
for nm, pp, ss, ccx, chin in heads:
    if abs(ss / med - 1) > .12:   # 顔がうまく測れない（マスク・ひげなど）：大きさはまわりと同じ、あごは絵の下はし
        print('head scale fix', nm, round(ss / med, 2)); ss = med; chin = np.nonzero(pp[..., 3] > 128)[0].max()
    f, dy = FIX3.get(nm, (1, 0)); cy = 314 - chin * ss; ss2 = ss * f
    put(pp, ss2, 200 - ccx * ss2, cy - chin * (ss2 - ss) + dy, nm); thumb(pp, nm)
for k in range(NB):
    p = np.asarray(Image.open(f'cut/{PRE}b{k:02d}.png')); name = f'b{B0 + k}'
    h = hands(p); ys, xs = np.nonzero(p[..., 3] > 128); sf = (FEET - NECK) / (ys.max() - ys.min())
    if h is None or FEETONLY: s = sf; top, cx = ys.min(), (xs.min() + xs.max()) / 2; note = 'feet'
    else:
        top, cx, hy, hw = h; sh = (HAND_Y / (hy - top) + HAND_W / hw) / 2; s = min(sh, sf); note = 'hands' if sh < sf else 'feet'
    put(p, s, 200 - cx * s, NECK - top * s, name); thumb(p, name); print(name, note, round(s, 3))
