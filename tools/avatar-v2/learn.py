import numpy as np, pickle, json
from lm3 import measure, sk, chin_down
def stats(n):
    cs = pickle.load(open(f'cells_{n}.pkl', 'rb')); M = []
    for c in cs:
        if c is None: continue
        m = measure(sk(c))
        if m and m['hands'] > 0: m['neck'] = chin_down(sk(c), m); M.append(m)
    med = lambda f: float(np.median([f(m) for m in M]))
    return dict(nt=med(lambda m: (m['neck'] - m['top']) / m['hw']), fn=med(lambda m: (m['feet'] - m['neck']) / m['hw']),
                hands=med(lambda m: m['hands'] / m['hw']), fspan=med(lambda m: m['fspan'] / m['hw']), dx=med(lambda m: (m['fcx'] - m['cx']) / m['hw']),
                et=med(lambda m: (m['ear'] - m['top']) / m['hw']), n=len(M))
R = stats('3696'); print('3696', R); print('3695', stats('3695'))
json.dump(R, open('lm.json', 'w'))
