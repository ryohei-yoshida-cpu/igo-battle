import sys, os, numpy as np
from PIL import Image
A = '/home/claude/igo-battle/img/av2/'
def L(n):
    p = A + n + '.webp'
    return Image.open(p).convert('RGBA') if os.path.exists(p) else None
def comp(face=None, outfit=None, shoes=None, pet=None):
    im = Image.new('RGBA', (400, 600), (236, 236, 236, 255))
    layers = [] if outfit else ['base_body']
    layers = ['base_body'] + ([outfit] if outfit else []) + ([face] if face else ['base_head']) + ([outfit + 'h'] if outfit else []) + ([shoes] if shoes else []) + ([pet] if pet else [])
    for n in layers:
        l = L(n)
        if l: im.alpha_composite(l)
    return im
def grid(looks, path, cols=10, sc=.5):
    w, h = int(400 * sc), int(600 * sc); rows = (len(looks) + cols - 1) // cols
    G = Image.new('RGB', (w * cols, h * rows), 'white')
    for i, lk in enumerate(looks): G.paste(comp(**lk).resize((w, h), Image.LANCZOS).convert('RGB'), ((i % cols) * w, (i // cols) * h))
    G.save(path)
if __name__ == '__main__':
    S = '/tmp/claude-0/-home-claude/39558bf2-1781-58ca-ab6e-b49bfd6110c8/scratchpad/'
    kind, a, b = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
    if kind == 'og': looks = [dict(outfit=f'og{i:03d}', face='fg000') for i in range(a, b)]
    if kind == 'fg': looks = [dict(face=f'fg{i:03d}', outfit='og000') for i in range(a, b)]
    if kind == 'p': looks = [dict(pet=f'p{i:03d}', outfit='og000', face='fg000') for i in range(a, b)]
    grid(looks, S + f'pv_{kind}_{a}.jpg')
