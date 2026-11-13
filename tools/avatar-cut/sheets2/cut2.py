# 新しい素材シート（10×10、背景は透明）を切りぬく：透明でない部分のかたまりを、どのマスにあるかで分ける
import cv2, numpy as np, json, sys
from scipy import ndimage as ndi
SHEETS = {'shoes': 'src_3677.png', 'bottom': 'src_3678.png', 'hair': 'src_3679.png', 'top': 'src_3680.png'}
for kind, f in SHEETS.items():
    im = cv2.imread(f, cv2.IMREAD_UNCHANGED); H, W = im.shape[:2]
    a = im[..., 3]; fg = a > 30
    cl, n = ndi.label(fg)
    objs = ndi.find_objects(cl); com = ndi.center_of_mass(fg, cl, range(1, n + 1)); sz = ndi.sum(fg, cl, range(1, n + 1))
    # 各画素の「マス」番号。ふつうはかたまりの中心のマス、となりのマスまで広がるかたまり（くっついた2つ）は画素ごとにマスで分ける
    yy, xx = np.mgrid[0:H, 0:W]; gridc = (yy // (H / 10)).astype(int) * 10 + (xx // (W / 10)).astype(int)
    owner = np.full((H, W), -1, int)
    for i in range(n):
        if sz[i] < 40: continue
        sl = objs[i]; mm = cl[sl] == i + 1
        wcells = (sl[1].stop - sl[1].start) / (W / 10); hcells = (sl[0].stop - sl[0].start) / (H / 10)
        if wcells > 1.15 or hcells > 1.15:
            owner[sl][mm] = gridc[sl][mm]; print(kind, 'split', i, round(wcells, 2), round(hcells, 2))
        else:
            cy, cx = com[i]; owner[sl][mm] = int(cy // (H / 10)) * 10 + int(cx // (W / 10))
    out = []
    for k in range(100):
        m = owner == k
        if m.sum() < 200: print(kind, 'empty', k); continue
        # 分けたときに出た小さなかけらは捨てる
        c2, n2 = ndi.label(m)
        if n2 > 1:
            s2 = ndi.sum(m, c2, range(1, n2 + 1)); m = np.isin(c2, [j + 1 for j, v in enumerate(s2) if v > 0.04 * s2.max()])
        ys, xs = np.nonzero(m); y1, y2, x1, x2 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
        crop = im[y1:y2, x1:x2].copy(); crop[~m[y1:y2, x1:x2]] = 0
        cv2.imwrite(f'{kind}_{k:02d}.png', crop)
        out.append(dict(i=k, box=[int(x1), int(y1), int(x2 - x1), int(y2 - y1)]))
    json.dump(out, open(f'{kind}_cells.json', 'w'))
    print(kind, len(out), 'median size', np.median([o['box'][2] for o in out]), np.median([o['box'][3] for o in out]))
