# place2.py で作った（作りなおすと手直しが消える）古い髪を、あとから動かす。元の絵は orig/ にとっておく
#   ADJ: id → (横, 縦, 大きさ)。何度動かしても orig から作るので、ずれがたまらない
import os, shutil, numpy as np
from PIL import Image
ADJ = {'h16': (0, -106, 1), 'h36': (0, -35, 1), 'h61': (0, 27, 1)}
os.makedirs('orig', exist_ok=True)
for k, (dx, dy, s) in ADJ.items():
    src = f'../../img/av3/{k}.webp'
    if not os.path.exists(f'orig/{k}.webp'): shutil.copy(src, f'orig/{k}.webp')
    im = Image.open(f'orig/{k}.webp').convert('RGBA'); W, H = im.size
    if s != 1: im = im.resize((round(W * s), round(H * s)), Image.LANCZOS)
    out = Image.new('RGBA', (W, H)); out.alpha_composite(im, (round(200 - 200 * s + dx), round(314 - 314 * s + dy))) if dx >= 0 and dy >= 0 else out.paste(im, (round(200 - 200 * s + dx), round(314 - 314 * s + dy)), im)
    out.save(src, quality=92, method=4); print(k)
