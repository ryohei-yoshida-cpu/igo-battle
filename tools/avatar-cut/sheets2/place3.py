# 新しいパーツをアバターのキャンバス（320×780）へ。大きさ・位置は「前と同じもの（重複）」の組で前のパーツに合わせて決める
#   服：上の端と真ん中で合わせる（横は前と同じ1.155倍のぶんも入る）／靴：下の端で合わせる／髪：上の端と真ん中
import cv2, numpy as np, json
from PIL import Image
AV = '/home/claude/igo-battle/img/avatar/'
DUP = {'hair': {4: 5, 5: 6, 20: 10, 23: 12, 36: 3, 50: 14},
       'top': {0: 0, 3: 2, 5: 3, 7: 7, 15: 9, 22: 1, 27: 15, 38: 14, 47: 18, 51: 17, 70: 12, 77: 16, 96: 11},
       'bottom': {3: 15, 5: 3, 6: 0, 7: 4, 8: 7, 10: 11, 14: 12, 17: 10, 19: 11, 20: 13, 35: 14, 50: 19, 102: 8, 103: 7, 105: 9, 106: 4},
       'shoes': {0: 2, 1: 1, 9: 3, 11: 10, 13: 11, 16: 10, 32: 16, 40: 4, 45: 6, 49: 5, 59: 9, 69: 9, 73: 19, 78: 18}}
REFS = {'hair': [(4, 5), (5, 6), (20, 10), (23, 12), (50, 14)], 'top': [(0, 0), (22, 1), (3, 2), (7, 7), (15, 9), (27, 15)],
        'bottom': [(6, 0), (5, 3), (3, 15), (102, 8), (105, 9)], 'shoes': [(1, 1), (9, 3), (11, 10), (40, 4), (13, 11)]}
PFX = {'hair': 'h', 'top': 't', 'bottom': 'b', 'shoes': 's'}
def bbox(a): ys, xs = np.nonzero(a > 40); return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
plan = {}
for kind in ['hair', 'top', 'bottom', 'shoes']:
    bodies = ['hair'] if kind == 'hair' else ['girl', 'boy']
    for body in bodies:
        sx, sy, cxs, tops, bots = [], [], [], [], []
        for n, o in REFS[kind]:
            nw = np.asarray(Image.open(f'{kind}_{n:03d}.png').convert('RGBA'))[..., 3]
            ow = np.asarray(Image.open(f'{AV}{PFX[kind]}{o:02d}_{body}.webp').convert('RGBA'))[..., 3]
            a, b = bbox(nw), bbox(ow)
            sx.append((b[2] - b[0]) / (a[2] - a[0])); sy.append((b[3] - b[1]) / (a[3] - a[1]))
            cxs.append((b[0] + b[2]) / 2); tops.append(b[1]); bots.append(b[3])
        SX = float(np.median(sx)); SY = float(np.median(sy)) if kind == 'top' else SX * (np.median(np.array(sy) / np.array(sx)) if kind == 'bottom' else 1)
        if kind in ('hair', 'shoes'): SY = SX
        plan[(kind, body)] = dict(sx=SX, sy=SY, cx=float(np.median(cxs)), top=float(np.median(tops)), bot=float(np.median(bots)))
        print(kind, body, {k: round(v, 3) for k, v in plan[(kind, body)].items()})
made = {}
import sys
ONLY = sys.argv[1:] or ['hair', 'top', 'bottom', 'shoes']
for kind in ONLY:
    cells = json.load(open(f'{kind}_cells.json'))
    ids = [c['i'] for c in cells if c['i'] not in DUP[kind]]
    made[kind] = ids
    for body in (['hair'] if kind == 'hair' else ['girl', 'boy']):
        p = plan[(kind, body)]
        for k, i in enumerate(ids):
            im = np.asarray(Image.open(f'{kind}_{i:03d}.png').convert('RGBA')).astype(np.float32)
            a = bbox(im[..., 3]); cx = (a[0] + a[2]) / 2
            ty = (p['bot'] - a[3] * p['sy']) if kind == 'shoes' else (p['top'] - a[1] * p['sy'])
            M = np.float32([[p['sx'], 0, p['cx'] - cx * p['sx']], [0, p['sy'], ty]])
            pm = im.copy(); pm[..., :3] *= pm[..., 3:4] / 255.0          # 色のにじみを防ぐため、透明度をかけてから拡大
            out = cv2.warpAffine(pm, M, (320, 780), flags=cv2.INTER_CUBIC, borderValue=0)
            al = np.clip(out[..., 3], 0, 255); rgb = np.where(al[..., None] > 0, out[..., :3] / np.maximum(al[..., None], 1) * 255, 0)
            res = np.dstack([np.clip(rgb, 0, 255), al]).astype(np.uint8)
            nid = f'{PFX[kind]}{20 + k:02d}'
            Image.fromarray(res).save(f'{AV}{nid}_{body}.webp', quality=88, method=4)
json.dump(made, open('made.json', 'w'))
print({k: len(v) for k, v in made.items()})
