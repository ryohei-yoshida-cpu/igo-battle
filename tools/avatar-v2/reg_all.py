# 女の子のシート（人形にのった絵）のマスごとに、素体に重ねる大きさ s と位置 d を決める
import json, numpy as np, pickle
from cells import cells
from register import *
from common import NECK
body = np.zeros_like(BA); body[NECK + 20:] = True
head = np.zeros_like(BA); head[:NECK] = True
SCALES = np.arange(.046, .076, .0005)
def run(n, nr, nc, reg, cut_low=None):
    cs = cells(f'src/{n}.png', nr, nc)
    res = {}
    for c in cs:
        if c is None: continue
        C = skin(c['img']) & c['m']
        if cut_low: C[int(C.shape[0] * cut_low):] = False
        s, d, sc = iou_best(C, SCALES, region=reg)
        res[c['k']] = [s, d, sc]
    # 行ごとの大きさ：その行の中央値。位置はその大きさでもう一度
    out = {}
    for r in range(nr):
        ks = [k for k in res if k // nc == r]
        sr = float(np.median([res[k][0] for k in ks]))
        for k in ks:
            c = cs[k]; C = skin(c['img']) & c['m']
            if cut_low: C[int(C.shape[0] * cut_low):] = False
            sc, d = iou_match(C, sr, region=reg)
            out[k] = dict(s=sr, d=[int(d[0]), int(d[1])], score=float(sc))
        print(n, 'row', r, 'scale', round(sr, 4), 'spread', np.round(np.percentile([res[k][0] for k in ks], [25, 75]), 4))
    pickle.dump(cs, open(f'cells_{n}.pkl', 'wb')); json.dump(out, open(f'reg_{n}.json', 'w'))
run('3696', 10, 19, None)
run('3694', 10, 20, body)
run('3695', 10, 20, head, cut_low=.55)
