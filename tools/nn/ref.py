"""numpy での参照実装（JS版の答え合わせ用）"""
import json, numpy as np, sys
N = 9
def load(prefix):
    m = json.load(open(prefix + '.json')); raw = np.fromfile(prefix + '.bin', dtype='<f2').astype(np.float32)
    T = {k: raw[o:o + n].reshape(sh) for k, (o, n, sh) in m['tensors'].items()}
    return m, T
def conv(x, w):
    ky, kx, ic, oc = w.shape; r = ky // 2
    xp = np.zeros((ic, N + 2 * r, N + 2 * r), np.float32); xp[:, r:r + N, r:r + N] = x
    out = np.zeros((oc, N, N), np.float32)
    for dy in range(ky):
        for dx in range(kx):
            out += np.einsum('io,ihw->ohw', w[dy, dx], xp[:, dy:dy + N, dx:dx + N])
    return out
def bnact(x, s, b): return np.maximum(x * s[:, None, None] + b[:, None, None], 0)
def gpool(x):
    mean = x.mean(axis=(1, 2)); return np.concatenate([mean, mean * (np.sqrt(N * N) - 14) * 0.1, x.max(axis=(1, 2))])
def vpool(x):
    mean = x.mean(axis=(1, 2)); q = np.sqrt(N * N) - 14
    return np.concatenate([mean, mean * q * 0.1, mean * (q * q * 0.01 - 0.1)])
def forward(m, T, binp, glob):
    x = conv(binp, T['conv1']) + (glob @ T['ginput'])[:, None, None]
    for i, b in enumerate(m['blocks']):
        p = f'b{i}.'
        h = bnact(x, T[p + 'pre.s'], T[p + 'pre.b'])
        r = conv(h, T[p + 'c1'])
        if b['kind'] == 'gpool':
            g = bnact(conv(h, T[p + 'cg']), T[p + 'gbn.s'], T[p + 'gbn.b'])
            r = r + (gpool(g) @ T[p + 'gm'])[:, None, None]
        x = x + conv(bnact(r, T[p + 'mid.s'], T[p + 'mid.b']), T[p + 'c2'])
    t = bnact(x, T['tip.s'], T['tip.b'])
    p1 = conv(t, T['p1']); g1 = bnact(conv(t, T['g1']), T['g1bn.s'], T['g1bn.b']); gc = gpool(g1)
    p1 = bnact(p1 + (gc @ T['pgb'])[:, None, None], T['p1bn.s'], T['p1bn.b'])
    pol = conv(p1, T['p2'])[0].ravel(); ps = (gc @ T['ppass'])[0]
    v1 = bnact(conv(t, T['v1']), T['v1bn.s'], T['v1bn.b'])
    v2 = np.maximum(vpool(v1) @ T['v2'] + T['v2b'], 0)
    val = v2 @ T['v3'] + T['v3b']; sv = v2 @ T['sv3'] + T['sv3b']
    own = np.tanh(conv(v1, T['own'])[0].ravel())
    return pol, ps, val, sv, own
def feats(board, pla, komi):
    """board: 81 (0空 1黒 2白)。履歴・シチョウ・地の特徴は空のまま（簡易版）"""
    b = np.zeros((22, N, N), np.float32); g = np.zeros(19, np.float32)
    b[0] = 1
    for p in range(81):
        y, x = divmod(p, 9)
        if board[p] == pla: b[1, y, x] = 1
        elif board[p]: b[2, y, x] = 1
    g[5] = (komi if pla == 2 else -komi) / 20
    return b, g
if __name__ == '__main__':
    m, T = load(sys.argv[1])
    board = [0] * 81
    pol, ps, val, sv, own = forward(m, T, *feats(board, 1, 7))
    e = np.exp(np.append(pol, ps) - max(pol.max(), ps)); pr = e / e.sum()
    v = np.exp(val - val.max()); v /= v.sum()
    print('value(win,loss,nr)', v.round(3), 'score', sv.round(2))
    print((pr[:81].reshape(9, 9) * 100).round(1)); print('pass', pr[81])
