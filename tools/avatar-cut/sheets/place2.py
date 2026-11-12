# 服・靴：アバターのキャンバスへ。シートの1番目（元の絵と同じ T シャツ・デニム・オリーブの靴）の大きさに合わせる
import cv2, numpy as np, json
OUT = '/home/claude/igo-battle/img/avatar/'
REF = {  # 体ごとの、元の服の範囲 [左, 上, 右, 下]
  'girl': {'top': (55, 263, 265, 447), 'bottom': (73, 436, 244, 551), 'shoes': (68, 666, 249, 757)},
  'boy': {'top': (51, 268, 270, 482), 'bottom': (74, 472, 247, 605), 'shoes': (64, 673, 257, 772)}}
SHEET = {'top': '../5ee88d51.png', 'bottom': '../7de060f5.png', 'shoes': '../24bb7287.png'}
PRE = {'top': 't', 'bottom': 'b', 'shoes': 's'}
for kind in ['top', 'bottom', 'shoes']:
    im = cv2.imread(SHEET[kind])[..., :3]
    cells = json.load(open(f'{kind}_cells.json'))
    m0 = np.load(f'{kind}_f0.npy'); ys, xs = np.nonzero(m0); w0 = xs.max() - xs.min(); h0 = ys.max() - ys.min()
    for body, ref in REF.items():
        L, T, R, B = ref[kind]; s = (R - L) / w0; cxr = (L + R) / 2
        sy = (B - T) / h0 if kind == 'top' else s   # 上の服は、元のTシャツの丈に合わせて少したてにのばす
        for c in cells:
            i = c['i']; x1, y1 = c['box']; m = np.load(f'{kind}_f{i}.npy'); h, w = m.shape
            sub = im[y1:y1 + h, x1:x1 + w]
            ys, xs = np.nonzero(m); cx = (xs.min() + xs.max()) / 2
            a = cv2.GaussianBlur(m.astype(np.float32), (3, 3), 0.6)
            rgba = np.dstack([sub, (a * 255).astype(np.uint8)])
            if kind == 'shoes': ty = B - ys.max() * s        # 靴は足もとで合わせる
            else: ty = T - ys.min() * s                         # 服は上の端で合わせる
            if kind == 'top': ty = T - ys.min() * sy
            sx = s * 1.1 if kind == "top" else s   # 上の服は横に1.1倍（肩が出ないように）
            M = np.float32([[sx, 0, cxr - cx * sx], [0, sy, ty]])
            out = cv2.warpAffine(rgba, M, (320, 780), flags=cv2.INTER_AREA, borderValue=0)
            out[out[..., 3] == 0, :3] = 0
            cv2.imwrite(OUT + f'{PRE[kind]}{i:02d}_{body}.png', out, [cv2.IMWRITE_PNG_COMPRESSION, 9])
print('ok')
