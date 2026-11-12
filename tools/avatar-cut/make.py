# 顔パターン（3664.png）の10個の頭を切りぬいて、アバターのキャンバス（320×780）に合わせる
import cv2, numpy as np, json
from scipy import ndimage as ndi
im = cv2.imread('src.png')[..., :3]
cells = json.load(open('cells.json'))
IDS = ['smile', 'laugh', 'wink', 'kira', 'paint', 'kabuki', 'wanko', 'cry', 'angry', 'gaan']
OUT = '/home/claude/igo-battle/img/avatar/'
s = 71 / 103                       # 目と目の間の長さを、今のアバターに合わせる
Xc, Yc = 160 + (148 - 151.5) * s, 252
for c, fid in zip(cells, IDS):
    x1, y1 = c['box']; m = np.load(f"m{c['i']}.npy")
    sub = im[y1:y1 + m.shape[0], x1:x1 + m.shape[1]]
    ys, xs = np.nonzero(m); cx = (xs.min() + xs.max()) / 2; chin = ys.max()
    a = cv2.GaussianBlur(m.astype(np.float32), (3, 3), 0.7)
    rgba = np.dstack([sub, (a * 255).astype(np.uint8)])
    M = np.float32([[s, 0, Xc - cx * s], [0, s, Yc - chin * s]])
    out = cv2.warpAffine(rgba, M, (320, 780), flags=cv2.INTER_AREA, borderValue=0)
    out[out[..., 3] == 0, :3] = 0
    cv2.imwrite(OUT + f'f_{fid}_face.png', out, [cv2.IMWRITE_PNG_COMPRESSION, 9])
    # おでこの飾り（犬・キラキラ・怒りマーク・たて線など）は、髪の上に重ねる別の絵にする
    hh, ww = m.shape
    yy = np.arange(hh)[:, None].repeat(ww, 1)
    skin = np.median(sub[ndi.binary_erosion(m, iterations=20) & (yy < 120)].astype(np.float32), 0)
    far = np.abs(sub.astype(np.float32) - skin).sum(2) > (55 if fid == "kira" else 90)
    deco = ndi.binary_erosion(m, iterations=7) & (yy < 126) & far
    cl, n = ndi.label(deco)
    if n:
        sizes = ndi.sum(deco, cl, range(1, n + 1))
        ring = m & ~ndi.binary_erosion(m, iterations=12)        # 頭のふちにかかる大きなかたまり（頭のてっぺんの肌）は飾りではない
        touch = set(np.unique(cl[ring & deco])) - {0}
        deco = np.isin(cl, [i + 1 for i, z in enumerate(sizes) if z > 40 and (i + 1) not in touch])
    deco = ndi.binary_fill_holes(ndi.binary_dilation(deco, iterations=2) & m & (far | ndi.binary_dilation(deco, iterations=1)))
    if fid == 'wanko':   # 頭の上の犬：犬の輪郭線の中を、まるごと飾りにする
        box = np.zeros_like(m); box[55:160, 50:240] = True
        dk = box & m & (sub.max(2) < 120)
        cl2, n2 = ndi.label(ndi.binary_dilation(dk, iterations=1))
        sz = ndi.sum(dk, cl2, range(1, n2 + 1))
        dog = ndi.binary_fill_holes(cl2 == (np.argmax(sz) + 1))
        deco = ndi.binary_dilation(dog, iterations=1) & m
    if deco.sum() > 150 and fid != 'kabuki':
        da = cv2.GaussianBlur(deco.astype(np.float32), (3, 3), 0.7)
        d = cv2.warpAffine(np.dstack([sub, (da * 255).astype(np.uint8)]), M, (320, 780), flags=cv2.INTER_AREA, borderValue=0)
        d[d[..., 3] == 0, :3] = 0
        cv2.imwrite(OUT + f'f_{fid}_deco.png', d, [cv2.IMWRITE_PNG_COMPRESSION, 9])
        print(fid, 'deco', int(deco.sum()))
print('ok')
