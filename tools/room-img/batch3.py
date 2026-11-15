# 3つ目のセット：クローク（壁ぎわに置く・下のラグは切る）と壁掛け。壁の家具は壁の面にあわせて描くので、正面向きの絵のまま使う
import os
from PIL import Image
CUT = {'hb00': 88, 'h101': 88, 'h102': 88, 'h103': 87, 'h104': 88, 'h105': 88, 'h106': 89, 'h107': 87}
CLOAK = [('hb00', 'cl_theater', '劇場のクローク', 400), ('h101', 'cl_princess', '姫のドレスクローク', 400), ('h102', 'cl_dark', '闇のクローク', 400), ('h103', 'cl_marine', 'マリンのクローク', 400),
         ('h104', 'cl_kimono', '着物のクローク', 400), ('h105', 'cl_wizard', '魔法使いのクローク', 400), ('h106', 'cl_explorer', '探検家のクローク', 400), ('h107', 'cl_snow', '雪のクローク', 400)]
WALL = [('h200', 'w_deer', '鹿の壁飾り', 1.4, 3, 300), ('h201', 'w_shield', '紋章の盾', 1.6, 3, 300), ('h202', 'w_hangclock', 'つるし時計', 1.4, 3, 200), ('h203', 'w_lantern', '壁のランタン', 1, 3, 200),
        ('h204', 'w_mirror', '金縁の鏡', 1, 2.4, 200), ('h205', 'w_dryflower', 'ドライフラワー', 1.6, 3, 100), ('h206', 'w_map', '古地図', 1.8, 2.8, 200), ('h207', 'w_roseplanter', 'バラの壁掛け鉢', 1.2, 2.8, 200),
        ('h300', 'w_archwindow', 'カーテンのアーチ窓', 2, 2, 300), ('h301', 'w_seawindow', '海の見える窓', 2, 2, 400), ('h302', 'w_rosewindow', 'ステンドグラスの丸窓', 1.6, 3, 400), ('h304', 'w_sconce', '燭台の壁飾り', 1.2, 3, 200),
        ('h305', 'w_shelf', '壁の飾り棚', 2, 3, 200), ('h306', 'w_banner', '百合紋のタペストリー', 1.3, 2.4, 200), ('h307', 'w_moonwindow', '月夜の窓', 1.8, 2, 400)]
os.makedirs('tools/room-img/cut9', exist_ok=True)
def save(src, k, cut=None):
    im = Image.open(f'tools/room-img/cut8/{src}.png').convert('RGBA')
    if cut: im = im.crop((0, 0, im.width, round(im.height * cut / 100))); im = im.crop(im.getbbox())
    im.thumbnail((480, 480), Image.LANCZOS); im.save(f'tools/room-img/cut9/{k}.png')
for s, k, *_ in CLOAK: save(s, k, CUT[s])
for s, k, *_ in WALL: save(s, k)
L = [f"    {{ id: '{k}', name: '{n}', style: 'yo', kind: 'wall', w: 2.6, h: 2.6, v: 0, price: {p}, cloak: true, draw() {{}} }}" for s, k, n, p in CLOAK]
L += [f"    {{ id: '{k}', name: '{n}', style: 'yo', kind: 'wall', w: {w}, h: {w}, v: {v}, price: {p}, draw() {{}} }}" for s, k, n, w, v, p in WALL]
s = open('common/room-items-pics.js').read()
s = s.replace('\n  ];\n})', ',\n    /* 3つ目のセット：クローク（壁ぎわ）と壁掛け */\n' + ',\n'.join(L) + '\n  ];\n})', 1)
open('common/room-items-pics.js', 'w').write(s)
print(len(L))
