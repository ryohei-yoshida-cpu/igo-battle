# 絵の家具の角度を、部屋の床の角度（2:1 のひし形）にあわせる
#   絵の「前の面のふち」の傾き sL（右下がり）と「横の面のふち」の傾き sR（右上がり）を測って、
#   たての線はたてのまま、ななめのふちが ±0.5 になるように、絵をずらす（せん断）
#   python3 tools/room-img/shear.py  … tools/room-img/orig の絵から img/room の絵を作りなおす
import cv2, numpy as np, os, json
from PIL import Image
SKIP = {'plant', 'kakejiku', 'window', 'clock'}   # 丸いもの・壁の家具はそのまま
GL, GR = 0.29, -0.65                              # 絵がはっきりしないときの傾き（全体のまんなか）
def meas(im):
    a = im[..., 3]; rgb = im[..., :3].copy(); rgb[a < 128] = 255
    g = cv2.cvtColor(rgb, cv2.COLOR_BGR2GRAY); e = cv2.Canny(g, 60, 160); H, W = g.shape
    L = cv2.HoughLinesP(e, 1, np.pi / 360, 30, minLineLength=max(25, W * .12), maxLineGap=4)
    pos, neg = [], []
    for x1, y1, x2, y2 in (L.reshape(-1, 4).tolist() if L is not None else []):
        if x2 == x1: continue
        s = (y2 - y1) / (x2 - x1); ln = np.hypot(x2 - x1, y2 - y1)
        if 0.1 < s < 0.55: pos.append((s, ln))
        elif -1.1 < s < -0.4: neg.append((s, ln))
    def wmed(v, d):
        if len(v) < 8: return d
        v = sorted(v); tot = sum(l for _, l in v); c = 0
        for s, l in v:
            c += l
            if c >= tot / 2: return s
    return min(.5, max(.2, wmed(pos, GL))), max(-.85, min(-.5, wmed(neg, GR)))
log = {}
for f in sorted(os.listdir('tools/room-img/orig')):
    k = f[:-4]
    if k in SKIP: continue
    im = cv2.imread('tools/room-img/orig/' + f, cv2.IMREAD_UNCHANGED)
    base = k[:-3] if k.endswith('_on') else k
    if base != k and base in log: sL, sR = log[base]   # つく・消える絵は同じずらし方
    else: sL, sR = meas(im)
    log[k] = (sL, sR)
    d = 1 / (sL - sR); c = .5 - d * sL
    H, W = im.shape[:2]
    M = np.float32([[1, 0, 0], [c, d, max(0, -c * W)]])
    H2 = int(np.ceil(d * H + abs(c) * W)) + 2
    out = cv2.warpAffine(im, M, (W, H2), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_CONSTANT, borderValue=(0, 0, 0, 0))
    ys, xs = np.nonzero(out[..., 3] > 8); out = out[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    rgba = cv2.cvtColor(out, cv2.COLOR_BGRA2RGBA)
    Image.fromarray(rgba).save(f'img/room/{k}.webp', 'WEBP', quality=88, method=4)
json.dump(log, open('tools/room-img/shear.json', 'w'), indent=0)
print(len(log), 'sheared')
