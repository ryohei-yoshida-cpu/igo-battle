# ショップの一覧用の小さな絵（128×128）。パーツの絵だけを、まわりを切って真ん中に
import glob, os
from PIL import Image
O = '/home/claude/igo-battle/img/av2t/'
for f in sorted(glob.glob('/home/claude/igo-battle/img/av2/*.webp')):
    n = os.path.basename(f)[:-5]
    if n.startswith('base') or n.endswith('h'): continue
    im = Image.open(f).convert('RGBA')
    if n.startswith('og'):
        h = f[:-5] + 'h.webp'
        if os.path.exists(h): im.alpha_composite(Image.open(h).convert('RGBA'))
    bb = im.getchannel('A').point(lambda v: 255 if v > 40 else 0).getbbox()
    if not bb: continue
    c = im.crop(bb); s = 120 / max(c.size); c = c.resize((max(1, int(c.width * s)), max(1, int(c.height * s))), Image.LANCZOS)
    t = Image.new('RGBA', (128, 128), (0, 0, 0, 0)); t.alpha_composite(c, ((128 - c.width) // 2, (128 - c.height) // 2))
    t.save(O + n + '.webp', quality=78, method=4)
print(len(os.listdir(O)))
