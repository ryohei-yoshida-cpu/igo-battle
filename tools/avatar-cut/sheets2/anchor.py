# avatar-art.js の ANCHOR（服・靴を1.05倍にするときの中心＝すその真ん中）を、全部の服・靴の絵から作りなおす
from PIL import Image; import glob, json, re
A = {}
for f in sorted(glob.glob('/home/claude/igo-battle/img/avatar/[tbs][0-9]*_*.webp')):
    k = f.split('/')[-1][:-5]
    if not re.match(r'^[tbs]\d{2,3}_(girl|boy)$', k): continue
    bb = Image.open(f).getchannel('A').point(lambda v: 255 if v > 40 else 0).getbbox()
    A[k] = [round((bb[0] + bb[2]) / 2), bb[3]]
p = '/home/claude/igo-battle/common/avatar-art.js'; s = open(p).read()
s = re.sub(r'ANCHOR = \{[^;]*\};', 'ANCHOR = ' + json.dumps(A, separators=(',', ':')) + ';', s, count=1)
open(p, 'w').write(s); print(len(A))
