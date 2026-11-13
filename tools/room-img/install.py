# 切りぬいた家具（cut の下のフォルダ）を img/room に入れ、common/room-art.js の IMG 表を作りなおす
#   python3 tools/room-img/install.py tools/room-img/cut2
import sys, os, re, json
from PIL import Image
for d in sys.argv[1:]:
    for f in sorted(os.listdir(d)):
        if f.endswith('.png'): Image.open(os.path.join(d, f)).save('img/room/' + f[:-4] + '.webp', 'WEBP', quality=88, method=4)
IMG = {}
for f in sorted(os.listdir('img/room')):
    im = Image.open('img/room/' + f); IMG[f[:-5]] = [im.width, im.height]
p = 'common/room-art.js'; s = open(p).read()
s = re.sub(r'  const IMG = \{.*?\};', '  const IMG = ' + json.dumps(IMG, separators=(',', ':')) + ';', s, count=1, flags=re.S)
open(p, 'w').write(s); print(len(IMG), 'images')
