import sys, numpy as np
from seg import *
for n in ['3693','3694','3695','3696']:
    im = load(f'src/{n}.png'); fg = ~bgmask(im)
    figs = figures(im, fg); R = rows(figs)
    print(n, len(figs), [len(r) for r in R], 'h med', int(np.median([f['y1']-f['y0'] for f in figs])), 'w med', int(np.median([f['x1']-f['x0'] for f in figs])))
