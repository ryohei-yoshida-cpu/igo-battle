import numpy as np, sys, cv2
from PIL import Image
from scipy import ndimage as ndi
for name in sys.argv[1:]:
    im = np.asarray(Image.open(f'src/{name}.png').convert('RGBA')); H, W = im.shape[:2]
    fg = im[..., 3] > 200; fg = ndi.binary_opening(fg, iterations=1)
    cl, n = ndi.label(fg); com = ndi.center_of_mass(fg, cl, range(1, n + 1)); sz = ndi.sum(fg, cl, range(1, n + 1))
    for k in range(8):
        r, c = divmod(k, 4)
        ids = [i + 1 for i in range(n) if sz[i] > 30 and int(com[i][1] // (W / 4)) == c and int(com[i][0] // (H / 2)) == r]
        m = np.isin(cl, ids); ys, xs = np.nonzero(m); y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
        a = cv2.GaussianBlur(m.astype(np.float32), (3, 3), .6)[y0:y1, x0:x1] * (im[y0:y1, x0:x1, 3] / 255.)
        Image.fromarray(np.dstack([im[y0:y1, x0:x1, :3], (a * 255).astype(np.uint8)])).save(f'cut/{name}_{k}.png')
    print(name, 'ok')
