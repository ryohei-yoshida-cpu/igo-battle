# avatar-art.js の ANCHOR（服・靴を1.05倍にするときの中心＝すその真ん中）を、全部の服・靴の絵から作りなおす
from PIL import Image; import glob, json, re
A = {}
for f in sorted(glob.glob('/home/claude/igo-battle/img/avatar/[tbs][0-9]*_*.webp')):
    k = f.split('/')[-1][:-5]
    if not re.match(r'^[tbs]\d{2,3}_(girl|boy)$', k): continue
    bb = Image.open(f).getchannel('A').point(lambda v: 255 if v > 40 else 0).getbbox()
    A[k] = [round((bb[0] + bb[2]) / 2), bb[3]]
# 靴の「はき口」の高さ：まん中あたり（左右の足の所）で、いちばん上に絵がある所
import numpy as np
T = {}
for f in sorted(glob.glob('/home/claude/igo-battle/img/avatar/s[0-9]*_*.webp')) + glob.glob('/home/claude/igo-battle/img/avatar/*_socks.png'):
    k = f.split('/')[-1].rsplit('.', 1)[0]
    if not re.match(r'^(s\d{2,3}_(girl|boy)|(girl|boy)_socks)$', k): continue
    a = np.asarray(Image.open(f).getchannel('A')) > 60
    cols = a[:, 110:210]; ys = np.nonzero(cols.any(1))[0]
    T[k] = int(np.percentile([np.nonzero(cols[:, c])[0].min() for c in range(cols.shape[1]) if cols[:, c].any()], 50)) if len(ys) else 780
p = '/home/claude/igo-battle/common/avatar-art.js'; s = open(p).read()
s = re.sub(r'SHOETOP = \{[^;]*\};', 'SHOETOP = ' + json.dumps(T, separators=(',', ':')) + ';', s, count=1)
s = re.sub(r'ANCHOR = \{[^;]*\};', 'ANCHOR = ' + json.dumps(A, separators=(',', ':')) + ';', s, count=1)
open(p, 'w').write(s); print(len(A))
