# 名前（いちばん多い色＋種類）と値段（シートの後ろほど凝った絵なので高く）を決めて、common/avatar-cat.js に書く
import glob, os, json, colorsys, numpy as np
from PIL import Image
A = '/home/claude/igo-battle/img/av2/'
def colname(f, region=None):
    a = np.asarray(Image.open(f).convert('RGBA')).astype(float)
    if region: a = a[region[0]:region[1]]
    m = a[..., 3] > 200; px = a[m][:, :3] / 255
    if len(px) < 20: return '？'
    hsv = np.array([colorsys.rgb_to_hsv(*p) for p in px[::max(1, len(px) // 1500)]])
    # はだ色（うすい橙）は数えない
    skin = (hsv[:, 0] > .02) & (hsv[:, 0] < .11) & (hsv[:, 1] > .1) & (hsv[:, 1] < .45) & (hsv[:, 2] > .8)
    hsv = hsv[~skin]
    if len(hsv) < 10: return 'はだ色'
    dark = hsv[:, 2] < .36; white = (hsv[:, 1] < .12) & (hsv[:, 2] > .8); gray = (hsv[:, 1] < .15) & ~dark & ~white
    cnt = {'黒': dark.mean(), '白': white.mean(), '灰': gray.mean()}
    ch = hsv[~dark & ~white & ~gray]
    if len(ch):
        bins = [('赤', 0, .04), ('橙', .04, .1), ('茶', -1, -1), ('黄', .1, .18), ('緑', .18, .45), ('水色', .45, .53), ('青', .53, .7), ('紫', .7, .83), ('桃', .83, .96), ('赤', .96, 1.01)]
        for nm, lo, hi in bins:
            if lo < 0: continue
            sel = (ch[:, 0] >= lo) & (ch[:, 0] < hi); v = sel.sum() / len(hsv)
            if nm in ('橙', '赤') and sel.any() and np.median(ch[sel][:, 2]) < .6: nm = '茶'
            if nm == '赤' and sel.any() and np.median(ch[sel][:, 1]) < .55: nm = '桃'
            if nm == '黄' and sel.any() and np.median(ch[sel][:, 2]) < .75: nm = '金' if region else '黄'
            if nm == '黄' and region: nm = '金'
            if nm == '橙' and region and sel.any() and np.median(ch[sel][:, 1]) < .6: nm = '金'
            cnt[nm] = cnt.get(nm, 0) + v
    return max(cnt, key=cnt.get)
KIND = {'fg': ('face', '{c}ヘア'), 'fb': ('face', '{c}ヘア'), 'og': ('outfit', '{c}コーデ'), 'ob': ('outfit', '{c}コーデ'), 's': ('shoes', '{c}シューズ'), 'p': ('pet', 'ペット')}
TIER = [300, 1200, 1800, 2400]
cat = {'face': [], 'outfit': [], 'shoes': [], 'pet': []}
for pre, (slot, fmt) in KIND.items():
    fs = sorted(f for f in glob.glob(A + pre + '[0-9][0-9][0-9].webp'))
    for i, f in enumerate(fs):
        n = os.path.basename(f)[:-5]
        c = colname(f, (0, 300) if slot == 'face' else None)
        frac = i / len(fs)
        price = 0 if i < 4 and slot in ('face', 'outfit') else TIER[min(3, int(frac * 4))]
        if slot == 'pet': price = TIER[min(3, 1 + int(frac * 3))]
        name = fmt.format(c=c) if slot != 'pet' else 'ペット'
        cat[slot].append([n, name, price])
# 同じ名前には番号
for slot, L in cat.items():
    seen = {}
    for it in L:
        seen[it[1]] = seen.get(it[1], 0) + 1; it[1] = f'{it[1]} {seen[it[1]]}'
hats = sorted(os.path.basename(f)[:5] for f in glob.glob(A + 'og[0-9][0-9][0-9]h.webp'))
open('/home/claude/igo-battle/common/avatar-cat.js', 'w').write('/* アバターのパーツ一覧（tools/avatar-v2/catalog.py で作る）：[id, 名前, 値段] */\n(function (r) { r.AVATAR_HATS = ' + json.dumps(hats) + '; r.AVATAR_CAT = ' + json.dumps(cat, ensure_ascii=False, separators=(',', ':')) + '; })(typeof window !== "undefined" ? window : globalThis);\n')
print({k: len(v) for k, v in cat.items()})
