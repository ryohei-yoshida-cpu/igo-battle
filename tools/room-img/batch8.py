# 8つ目のセット：春のアイテム（市松の背景をざらつきで見わけて切りぬき）
import cv2, numpy as np, os, sys
sys.path.insert(0, '/tmp/claude-0/ang'); from m3 import meas
IN, OUT = 'tools/room-img/cut18', 'tools/room-img/cut19'; os.makedirs(OUT, exist_ok=True)
# (src, id, 名前, kind, w, d|v, 値段, 角度そろえ  0=そのまま 1=測る (sL,sR)=指定)
T = [('n100', 's_sakuratree', '桜の木', 'floor', 2, 2, 400, 0), ('n101', 's_rosearch', '花のアーチ', 'floor', 2, 1, 300, (.33, -.62)), ('n102', 's_fujibench', '藤棚のベンチ', 'floor', 2, 1, 300, (.30, -.62)),
     ('n104', 's_fountain', '小鳥の噴水', 'floor', 2, 2, 400, 0), ('n105', 's_flowercart', '花屋のワゴン', 'floor', 2, 1, 300, (.25, -.80)), ('n106', 's_cafeset', '春のカフェセット', 'floor', 2, 2, 300, 0),
     ('n107', 's_tulipbox', 'チューリップのプランター', 'floor', 2, 1, 200, (.30, -.82)), ('n109a', 's_lamppost', '桜の街灯', 'floor', 1, 1, 200, 0), ('n109b', 's_banner', '桜ののぼり', 'floor', 1, 1, 100, 0),
     ('n111', 's_byobu', '桜の衝立', 'floor', 2, 1, 300, (.30, -.62)),
     ('n108', 'sw_basket', '花かごの壁掛け', 'wall', 1.6, 2.6, 200, 0), ('n110', 'sw_window', '花いっぱいの窓', 'wall', 2, 1.6, 400, 0), ('n112a', 'sw_uguisu', '桜とうぐいすの掛け軸', 'wall', 1.1, 2.4, 200, 0),
     ('n112b', 'sw_wreath', '桜のリース', 'wall', 1.3, 3, 200, 0)]
PAD = {'s_lamppost': 1.6, 's_banner': 1.6}
def shear(im, sl):
    sL, sR = meas(im) if sl == 1 else sl; d = 1 / (sL - sR); c = .5 - d * sL; H, W = im.shape[:2]
    M = np.float32([[1, 0, 0], [c, d, max(0, -c * W)]])
    im = cv2.warpAffine(im, M, (W, int(np.ceil(d * H + abs(c) * W)) + 2), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_CONSTANT, borderValue=(0, 0, 0, 0))
    ys, xs = np.nonzero(im[..., 3] > 8); return im[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
L = []
for s, k, n, kind, w, d, p, sl in T:
    im = cv2.imread(f'{IN}/{s}.png', cv2.IMREAD_UNCHANGED)
    if sl: im = shear(im, sl)
    if k in PAD: h, ww = im.shape[:2]; W2 = int(ww * PAD[k]); o = np.zeros((h, W2, 4), np.uint8); o[:, (W2 - ww) // 2:(W2 - ww) // 2 + ww] = im; im = o
    h, ww = im.shape[:2]; f = min(1, 480 / max(h, ww))
    if f < 1: im = cv2.resize(im, (round(ww * f), round(h * f)), interpolation=cv2.INTER_AREA)
    cv2.imwrite(f'{OUT}/{k}.png', im)
    if kind == 'wall': L.append(f"    {{ id: '{k}', name: '{n}', style: 'fun', kind: 'wall', w: {w}, h: {w}, v: {d}, price: {p}, season: 'spring', draw() {{}} }}")
    else: L.append(f"    {{ id: '{k}', name: '{n}', style: 'fun', kind: 'floor', w: {w}, d: {d}, price: {p}, season: 'spring', draw() {{}} }}")
# ラグ3つ：ピクニック（四角）・桜（花形）・花の芝生（丸）
def quad(src, k, fw, fd):
    im = cv2.imread(f'{IN}/{src}.png', cv2.IMREAD_UNCHANGED); a = (im[..., 3] > 128).astype(np.uint8)
    cs, _ = cv2.findContours(a, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE); h = cv2.convexHull(max(cs, key=cv2.contourArea))
    # 敷物の部分だけ：下半分の点で4つの角
    q = h.reshape(-1, 2).astype(np.float32)
    top, right, bot, left = q[np.argmin(q[:, 1] - q[:, 0] * .0)], q[np.argmax(q[:, 0])], q[np.argmax(q[:, 1])], q[np.argmin(q[:, 0])]
    u = 480 / (fw + fd)
    M = cv2.getPerspectiveTransform(np.float32([top, right, bot, left]), np.float32([[fd, 0], [fw + fd, fw / 2], [fw, (fw + fd) / 2], [0, fd / 2]]) * u)
    cv2.imwrite(f'{OUT}/{k}.png', cv2.warpPerspective(im, M, (480, 240), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_CONSTANT, borderValue=(0, 0, 0, 0)))
def ell(src, k):
    im = cv2.imread(f'{IN}/{src}.png', cv2.IMREAD_UNCHANGED); a = (im[..., 3] > 128).astype(np.uint8)
    cs, _ = cv2.findContours(a, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE); (cx, cy), (w, h), ang = cv2.fitEllipse(max(cs, key=cv2.contourArea))
    th = np.deg2rad(ang); a1 = np.array([np.cos(th), np.sin(th)]) * w / 2; a2 = np.array([-np.sin(th), np.cos(th)]) * h / 2
    if abs(a1[0]) < abs(a2[0]): a1, a2 = a2, a1
    if a1[0] < 0: a1 = -a1
    if a2[1] < 0: a2 = -a2
    W = 480; R = W / 2 * .74
    M = cv2.getAffineTransform(np.float32([[cx, cy], [cx + a1[0], cy + a1[1]], [cx + a2[0], cy + a2[1]]]), np.float32([[W / 2, W / 4], [W / 2 + R, W / 4], [W / 2, W / 4 + R / 2]]))
    cv2.imwrite(f'{OUT}/{k}.png', cv2.warpAffine(im, M, (W, W // 2), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_CONSTANT, borderValue=(0, 0, 0, 0)))
# ピクニックは上に物がのっているので、角度だけそろえて床の家具に
im = shear(cv2.imread(f'{IN}/n103.png', cv2.IMREAD_UNCHANGED), (.44, -1.0)); h, ww = im.shape[:2]; f = min(1, 480 / max(h, ww))
cv2.imwrite(f'{OUT}/s_picnic.png', cv2.resize(im, (round(ww * f), round(h * f)), interpolation=cv2.INTER_AREA) if f < 1 else im)
L.append("    { id: 's_picnic', name: 'お花見ピクニック', style: 'fun', kind: 'floor', w: 2, d: 2, price: 300, season: 'spring', draw() {} }")
ell('n113', 'sr_sakura'); ell('n114', 'sr_grass')
L.append("    { id: 'sr_sakura', name: '桜の花びらラグ', style: 'fun', kind: 'flat', w: 2, d: 2, price: 200, season: 'spring', draw() {} }")
L.append("    { id: 'sr_grass', name: '花の芝生ラグ', style: 'fun', kind: 'flat', w: 2, d: 2, price: 200, season: 'spring', draw() {} }")
s = open('common/room-items-pics.js').read()
s = s.replace('\n  ];\n})', ',\n    /* 8つ目のセット：春のアイテム */\n' + ',\n'.join(L) + '\n  ];\n})', 1)
open('common/room-items-pics.js', 'w').write(s); print(len(L))
