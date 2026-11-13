"""KataGo のモデル（.txt.gz / .bin.gz、モデル版 8 = g170 系）を、アプリ用の小さな形式に変える。
出力：<out>.json（層の並びと形）と <out>.bin（float16 の重みを順に並べたもの）。BN は scale/bias にまとめる。
使い方: python3 convert.py model.txt.gz out_prefix
"""
import gzip, json, sys, struct
import numpy as np

class R:
    def __init__(self, data, binary):
        self.d = data; self.i = 0; self.binary = binary
    def tok(self):
        d = self.d; n = len(d); i = self.i
        while i < n and d[i] in b' \t\r\n': i += 1
        j = i
        while j < n and d[j] not in b' \t\r\n': j += 1
        self.i = j
        return d[i:j].decode()
    def int(self): return int(self.tok())
    def float(self): return float(self.tok())
    def floats(self, n):
        if self.binary:
            k = self.d.index(b'@BIN@', self.i) + 5
            a = np.frombuffer(self.d[k:k + 4 * n], dtype='<f4').copy()
            self.i = k + 4 * n
            return a
        a = np.array([float(self.tok()) for _ in range(n)], dtype=np.float32)
        return a

def conv(r):
    name = r.tok(); ky = r.int(); kx = r.int(); ic = r.int(); oc = r.int(); dy = r.int(); dx = r.int()
    assert dy == 1 and dx == 1
    w = r.floats(ky * kx * ic * oc).reshape(ky, kx, ic, oc)   # ファイルの順：y,x,ic,oc
    return {'k': ky, 'ic': ic, 'oc': oc, 'w': w}
def bn(r):
    name = r.tok(); c = r.int(); eps = r.float(); hs = r.int(); hb = r.int()
    mean = r.floats(c); var = r.floats(c)
    sc = r.floats(c) if hs else np.ones(c, np.float32)
    b = r.floats(c) if hb else np.zeros(c, np.float32)
    s = sc / np.sqrt(var + eps)
    return {'c': c, 's': s.astype(np.float32), 'b': (b - s * mean).astype(np.float32)}
def act(r): r.tok()
def matmul(r):
    name = r.tok(); ic = r.int(); oc = r.int()
    return {'ic': ic, 'oc': oc, 'w': r.floats(ic * oc).reshape(ic, oc)}
def matbias(r):
    name = r.tok(); c = r.int()
    return {'c': c, 'w': r.floats(c)}

def main(src, out):
    raw = gzip.open(src).read()
    r = R(raw, src.endswith('.bin.gz'))
    name = r.tok(); ver = r.int(); nbin = r.int(); nglob = r.int()
    assert ver == 8, ver
    tname = r.tok(); nblocks = r.int(); trunkC = r.int(); midC = r.int(); regC = r.int(); dilC = r.int(); gpC = r.int()
    model = {'name': name, 'version': ver, 'bin': nbin, 'glob': nglob, 'trunkC': trunkC}
    tensors = []   # (key, array)
    def add(key, a): tensors.append((key, np.ascontiguousarray(a, dtype=np.float32)))
    c = conv(r); add('conv1', c['w']); model['conv1'] = [c['k'], c['ic'], c['oc']]
    m = matmul(r); add('ginput', m['w']); model['ginput'] = [m['ic'], m['oc']]
    blocks = []
    for bi in range(nblocks):
        kind = r.tok(); bname = r.tok(); p = f'b{bi}.'
        if kind == 'ordinary_block':
            pre = bn(r); act(r); c1 = conv(r); mid = bn(r); act(r); c2 = conv(r)
            add(p + 'pre.s', pre['s']); add(p + 'pre.b', pre['b']); add(p + 'c1', c1['w']); add(p + 'mid.s', mid['s']); add(p + 'mid.b', mid['b']); add(p + 'c2', c2['w'])
            blocks.append({'kind': 'reg', 'c1': [c1['k'], c1['ic'], c1['oc']], 'c2': [c2['k'], c2['ic'], c2['oc']]})
        elif kind == 'gpool_block':
            pre = bn(r); act(r); c1 = conv(r); cg = conv(r); gbn = bn(r); act(r); gm = matmul(r); mid = bn(r); act(r); c2 = conv(r)
            add(p + 'pre.s', pre['s']); add(p + 'pre.b', pre['b']); add(p + 'c1', c1['w']); add(p + 'cg', cg['w'])
            add(p + 'gbn.s', gbn['s']); add(p + 'gbn.b', gbn['b']); add(p + 'gm', gm['w']); add(p + 'mid.s', mid['s']); add(p + 'mid.b', mid['b']); add(p + 'c2', c2['w'])
            blocks.append({'kind': 'gpool', 'c1': [c1['k'], c1['ic'], c1['oc']], 'cg': [cg['k'], cg['ic'], cg['oc']], 'gm': [gm['ic'], gm['oc']], 'c2': [c2['k'], c2['ic'], c2['oc']]})
        else: raise Exception(kind)
    model['blocks'] = blocks
    tip = bn(r); act(r); add('tip.s', tip['s']); add('tip.b', tip['b'])
    # policy head
    r.tok()
    p1 = conv(r); g1 = conv(r); g1bn = bn(r); act(r); gb = matmul(r); p1bn = bn(r); act(r); p2 = conv(r); gp = matmul(r)
    add('p1', p1['w']); add('g1', g1['w']); add('g1bn.s', g1bn['s']); add('g1bn.b', g1bn['b']); add('pgb', gb['w']); add('p1bn.s', p1bn['s']); add('p1bn.b', p1bn['b']); add('p2', p2['w']); add('ppass', gp['w'])
    model['policy'] = {'p1': [p1['k'], p1['ic'], p1['oc']], 'g1': [g1['k'], g1['ic'], g1['oc']], 'gb': [gb['ic'], gb['oc']], 'p2': [p2['k'], p2['ic'], p2['oc']], 'pass': [gp['ic'], gp['oc']]}
    # value head
    r.tok()
    v1 = conv(r); v1bn = bn(r); act(r); v2 = matmul(r); v2b = matbias(r); act(r); v3 = matmul(r); v3b = matbias(r); sv3 = matmul(r); sv3b = matbias(r); own = conv(r)
    add('v1', v1['w']); add('v1bn.s', v1bn['s']); add('v1bn.b', v1bn['b']); add('v2', v2['w']); add('v2b', v2b['w']); add('v3', v3['w']); add('v3b', v3b['w']); add('sv3', sv3['w']); add('sv3b', sv3b['w']); add('own', own['w'])
    model['value'] = {'v1': [v1['k'], v1['ic'], v1['oc']], 'v2': [v2['ic'], v2['oc']], 'v3': [v3['ic'], v3['oc']], 'sv3': [sv3['ic'], sv3['oc']], 'own': [own['k'], own['ic'], own['oc']]}
    # 書き出し（float16）
    offs = {}; pos = 0; parts = []
    for k, a in tensors:
        h = a.astype(np.float16).ravel()
        offs[k] = [pos, int(h.size), list(a.shape)]; pos += h.size; parts.append(h)
    model['tensors'] = offs; model['total'] = pos
    np.concatenate(parts).astype('<f2').tofile(out + '.bin')
    json.dump(model, open(out + '.json', 'w'))
    print(name, 'params', pos, 'bytes', pos * 2, 'rest', len(raw) - r.i)

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
