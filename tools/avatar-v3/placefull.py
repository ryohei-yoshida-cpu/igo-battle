# オールセット（全身の絵）を置く：足もと 620・頭のてっぺん 22 くらい・横は 200 を中心に。顔のまわりも測る（アイコン用）
#   python3 placefull.py <かしら> <数> <最初の番号>
import sys, numpy as np, json
from PIL import Image
from scipy import ndimage as ndi
exec(open('place3.py').read().split('# 基準：')[0])
pre, n, f0 = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]); face = {}
for k in range(n):
    p = np.asarray(Image.open(f'cut/{pre}{k:02d}.png')); a = p[..., 3] > 128; ys, xs = np.nonzero(a)
    top, bot = ys.min(), ys.max(); s = 598 / (bot - top)
    fy = bot - (bot - top) * .03; feet = xs[ys > fy]; cx = (feet.min() + feet.max()) / 2
    if (xs.max() - xs.min()) * s > 440: s = 440 / (xs.max() - xs.min())
    name = f'f{f0 + k:02d}'; tx, ty = 200 - cx * s, 620 - bot * s
    put(p, s, tx, ty, name); thumb(p, name)
    # 顔：上 3分の1 の肌色のいちばん大きなかたまり
    S = skin(p[..., :3]) & a; S[int(top + (bot - top) * .3):] = False; S = ndi.binary_opening(S, iterations=2)
    lab, m = ndi.label(S); sz = ndi.sum(S, lab, range(1, m + 1)); F = lab == (np.argmax(sz) + 1); yy, xx = np.nonzero(F)
    face[name] = [round((xx.mean()) * s + tx), round((yy.mean()) * s + ty), 84]
print(json.dumps(face))
