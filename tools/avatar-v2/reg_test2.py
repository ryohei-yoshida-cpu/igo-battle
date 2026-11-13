import numpy as np
from cells import cells
from register import *
H, Wb = BA.shape
NECK = 505
body = np.zeros_like(BA); body[NECK:] = True
head = np.zeros_like(BA); head[:NECK] = True
for n, (nr, nc), reg in [('3696', (10, 19), None), ('3694', (10, 20), body), ('3695', (10, 20), head)]:
    cs = cells(f'src/{n}.png', nr, nc); ss = []
    for c in cs[::13]:
        if c is None: continue
        C = skin(c['img']) & c['m']
        if reg is head: C[int(C.shape[0] * .55):] = False
        s, off, sc = iou_best(C, np.arange(.045, .075, .001), region=reg)
        ss.append(s)
    print(n, 'scales', np.round(ss, 3), 'median', np.median(ss))
