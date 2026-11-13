# 範囲を指定して切りぬく：python3 cutrect.py src.png name:x0,y0,x1,y1 ...
import cv2, numpy as np, sys, os
from scipy import ndimage as ndi
from PIL import Image
args = sys.argv[1:]; sys.argv = sys.argv[:1] + ['x', 'x', '1', '1', '0']
exec(open('cut.py').read().split('src, names =')[0])
out = os.environ.get('OUT', 'cut')
im = cv2.imread(args[0])[..., :3]
for spec in args[1:]:
    nm, box = spec.split(':'); x0, y0, x1, y1 = map(int, box.split(','))
    cell = im[y0:y1, x0:x1]; f = cut(cell)
    a = cv2.GaussianBlur(f.astype(np.float32), (3, 3), .8)
    ys, xs = np.nonzero(f); a0, a1, b0, b1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    Image.fromarray(np.dstack([cell[a0:a1, b0:b1, ::-1], (a[a0:a1, b0:b1] * 255).astype(np.uint8)])).save(f'{out}/{nm}.png')
    print(nm, b1 - b0, a1 - a0)
