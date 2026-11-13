# 重複チェック：前の素材（img/avatar の h/t/b/s 00〜19、女の子の体用）と、新しい素材を、形と色でくらべる
import cv2, numpy as np, json, glob
from PIL import Image
AV = '/home/claude/igo-battle/img/avatar/'
def feat(rgba):
    a = rgba[..., 3] > 40
    ys, xs = np.nonzero(a); rgba = rgba[ys.min():ys.max() + 1, xs.min():xs.max() + 1]; a = a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    h, w = a.shape
    small = cv2.resize(rgba, (24, 24), interpolation=cv2.INTER_AREA).astype(np.float32)
    m = small[..., 3:4] / 255.0
    col = (small[..., :3] * m).reshape(-1) / 255.0
    shape = m.reshape(-1)
    lab = cv2.cvtColor(rgba[..., :3][a][None].astype(np.uint8), cv2.COLOR_RGB2LAB)[0].astype(np.float32)
    hist = np.histogramdd(lab, bins=(4, 6, 6), range=((0, 256), (0, 256), (0, 256)))[0].reshape(-1); hist /= hist.sum()
    return dict(col=col, shape=shape, hist=hist, ar=w / h)
PFX = {'hair': 'h', 'top': 't', 'bottom': 'b', 'shoes': 's'}
res = {}
for kind, p in PFX.items():
    old = []
    for i in range(20):
        f = f'{AV}{p}{i:02d}_' + ('hair' if kind == 'hair' else 'girl') + '.webp'
        old.append(feat(np.asarray(Image.open(f).convert('RGBA'))))
    new = [feat(np.asarray(Image.open(f).convert('RGBA'))) for f in sorted(glob.glob(f'{kind}_[0-9][0-9][0-9].png'))]
    rows = []
    for j, n in enumerate(new):
        best = None
        for i, o in enumerate(old):
            d = 0.5 * np.abs(n['shape'] - o['shape']).mean() + 0.3 * np.abs(n['col'] - o['col']).mean() + 0.6 * np.minimum(n['hist'], o['hist']).sum() * -1 + 0.6 + 0.3 * abs(np.log(n['ar'] / o['ar']))
            if best is None or d < best[0]: best = (d, i)
        rows.append((round(float(best[0]), 3), j, best[1]))
    rows.sort()
    res[kind] = rows
    print(kind, rows[:14])
json.dump(res, open('dup_scores.json', 'w'))
