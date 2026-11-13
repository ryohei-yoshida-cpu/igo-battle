# 置き方が自由なシート：画面全体で切りぬいて、大きいかたまりを左上から順に名前をつける（行→列）
import cv2, numpy as np, sys, os
from scipy import ndimage as ndi
from PIL import Image
sys.argv = sys.argv[:3] + ['1', '1', '0']
exec(open('cut.py').read().split('src, names =')[0])   # cut() と keep() を使う
src, names, rows = sys.argv[1], sys.argv[2].split(','), 2
out = os.environ.get('OUT', 'cut')
im = cv2.imread(src)[..., :3]; H, W = im.shape[:2]
f = cut(im)
lab, n = ndi.label(f); objs = ndi.find_objects(lab)
sz = ndi.sum(f, lab, range(1, n + 1)); big = sorted(range(n), key=lambda i: -sz[i])[:len(names)]
cents = {i: ndi.center_of_mass(f, lab, i + 1) for i in big}
order = sorted(big, key=lambda i: (int(cents[i][0] // (H / rows)), cents[i][1]))
a = cv2.GaussianBlur(f.astype(np.float32), (3, 3), .8)
for nm, i in zip(names, order):
    sl = objs[i]; m = (lab[sl] == i + 1)
    m = ndi.binary_dilation(m, iterations=1) & (a[sl] > 0)
    rgba = np.dstack([im[sl][..., ::-1], (a[sl] * m * 255).astype(np.uint8)])
    Image.fromarray(rgba).save(f'{out}/{nm}.png'); print(nm, rgba.shape[1], rgba.shape[0])
