# 切りぬいた絵の中に残った、とじこめられた白い背景（市松）を消す（白いものがない絵だけに使う）
#   python3 holefix.py cut24/k02.png ...
import sys, cv2, numpy as np
from scipy import ndimage as ndi
from PIL import Image
for p in sys.argv[1:]:
    im = np.array(Image.open(p).convert('RGBA')); rgb = im[..., :3][..., ::-1].copy()
    hsv = cv2.cvtColor(np.ascontiguousarray(rgb), cv2.COLOR_BGR2HSV)
    pale = (hsv[..., 1] < 28) & (hsv[..., 2] > 222) & (im[..., 3] > 0)
    lab, n = ndi.label(pale); cnt = 0
    for i, sl in enumerate(ndi.find_objects(lab)):
        mk = lab[sl] == i + 1
        if mk.sum() < 120: continue
        im[sl][..., 3][mk] = 0; cnt += 1
        dil = ndi.binary_dilation(mk, iterations=1); a = im[sl][..., 3]; a[dil & ~mk] = (a[dil & ~mk] * .5).astype(np.uint8)
    Image.fromarray(im).save(p); print(p, cnt)
