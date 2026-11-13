import numpy as np, sys
from cells import cells
from register import *
N = {'3694': (10, 20), '3695': (10, 20), '3696': (10, 19)}
for n, (nr, nc) in N.items():
    cs = cells(f'src/{n}.png', nr, nc)
    ss = []
    for c in cs[::17]:
        if c is None: continue
        C = skin(c['img']) & c['m']
        s, off, sc = best(C, np.arange(.050, .080, .001))
        ss.append(s); print(n, c['k'], round(s, 3), off, round(sc, 2))
    print(n, 'median s', np.median(ss), 'cells', sum(c is not None for c in cs))
