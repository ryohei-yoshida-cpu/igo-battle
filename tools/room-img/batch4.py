# 4つ目のセット：床に置くクローク（上から見た角度が深いので、測った傾きでそろえる）
import cv2, numpy as np, os, sys
sys.path.insert(0, '/tmp/claude-0/ang')
from m3 import meas
T = [('i100', 'clf_baroque', 'バロックのチェスト', 'yo', 300), ('i101', 'clf_white', '白いドレッサーチェスト', 'yo', 300), ('i102', 'clf_study', '書斎の本棚', 'yo', 300),
     ('i103', 'clf_fuji', '藤の白い飾り棚', 'yo', 400), ('i104', 'clf_sakura', '桜の箪笥', 'wa', 300), ('i105', 'clf_magic', '魔法の小物棚', 'yo', 300),
     ('i106', 'clf_wardrobe', '金具のワードローブ', 'yo', 400), ('i107', 'clf_rack', '真鍮のオープンラック', 'yo', 300)]
os.makedirs('tools/room-img/cut11', exist_ok=True)
for s, k, *_ in T:
    im = cv2.imread(f'tools/room-img/cut10/{s}.png', cv2.IMREAD_UNCHANGED)
    sL, sR = meas(im); d = 1 / (sL - sR); c = .5 - d * sL; H, W = im.shape[:2]
    M = np.float32([[1, 0, 0], [c, d, max(0, -c * W)]])
    im = cv2.warpAffine(im, M, (W, int(np.ceil(d * H + abs(c) * W)) + 2), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_CONSTANT, borderValue=(0, 0, 0, 0))
    ys, xs = np.nonzero(im[..., 3] > 8); im = im[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    h, w = im.shape[:2]; f = min(1, 480 / max(h, w))
    if f < 1: im = cv2.resize(im, (round(w * f), round(h * f)), interpolation=cv2.INTER_AREA)
    cv2.imwrite(f'tools/room-img/cut11/{k}.png', im); print(k, round(sL, 2), round(sR, 2))
L = [f"    {{ id: '{k}', name: '{n}', style: '{st}', kind: 'floor', w: 2, d: 1, price: {p}, cloak: true, draw() {{}} }}" for s, k, n, st, p in T]
s = open('common/room-items-pics.js').read()
s = s.replace('\n  ];\n})', ',\n    /* 4つ目のセット：床に置くクローク */\n' + ',\n'.join(L) + '\n  ];\n})', 1)
open('common/room-items-pics.js', 'w').write(s)
