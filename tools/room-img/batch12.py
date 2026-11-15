# 12こ目のセット：段級位のごほうび（売らない・骨董屋でも売れない）（市松の背景は cutgrid.py で切りぬき）
import cv2, numpy as np, os
IN, OUT = 'tools/room-img/cut26', 'tools/room-img/cut27'
SCR = (.30, -.62); os.makedirs(OUT, exist_ok=True)
BOX = (.22, -.62)   # この絵のカメラの傾き（前・横）
F, W, Q, E = 'floor', 'wall', 'quad', 'ell'
# (src, id, 名前, 季節, 種類, w, d|v, 値段, 角度そろえ, よこ余白)
T = [
 ('r00', 'rw_menjo1', '初段の免状', 'reward', F, 2, 1, -1, BOX, 1),
 ('r01', 'rw_menjo2', '二段の免状', 'reward', F, 2, 1, -1, BOX, 1),
 ('r02', 'rw_menjo3', '三段の免状', 'reward', F, 2, 1, -1, BOX, 1),
 ('r03', 'rw_menjo4', '四段の免状', 'reward', F, 2, 1, -1, BOX, 1),
 ('r04', 'rw_menjo5', '五段の免状', 'reward', F, 2, 1, -1, BOX, 1),
 ('r05', 'rw_kisei', '棋聖のトロフィー', 'reward', F, 1, 1, -1, 0, 1.2),
 ('r06', 'rw_meijin', '名人の盾', 'reward', F, 1, 1, -1, 0, 1.3),
 ('r07', 'rw_makiegoban', '蒔絵の名品碁盤', 'reward', F, 2, 2, -1, BOX, 1),
 ('r08', 'rw_isshu', '一手入魂の額', 'reward', W, 2, 3.2, -1, 0, 1),
 ('r09', 'rw_tokonoma', '碁打ちの床の間', 'reward', F, 2, 1, -1, BOX, 1),
 ('r10', 'rw_zashiki', '対局の座敷', 'reward', F, 2, 2, -1, 0, 1),
 ('r11', 'rw_kinbyobu', '富士と鶴の金屏風', 'reward', F, 2, 1, -1, SCR, 1),
 ('r12x', 'rw_shinbo', '深謀遠慮の額', 'reward', W, 2, 3.2, -1, 0, 1),
 ('r12y', 'rw_gogudana', '碁具の飾り棚', 'reward', F, 1, 1, -1, BOX, 1),
]
def shear(im, sl):
    sL, sR = sl; d = 1 / (sL - sR); c = .5 - d * sL; H, W_ = im.shape[:2]
    M = np.float32([[1, 0, 0], [c, d, max(0, -c * W_)]])
    im = cv2.warpAffine(im, M, (W_, int(np.ceil(d * H + abs(c) * W_)) + 2), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_CONSTANT, borderValue=(0, 0, 0, 0))
    ys, xs = np.nonzero(im[..., 3] > 8); return im[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
def quad(im, fw, fd):
    a = (im[..., 3] > 128).astype(np.uint8); cs, _ = cv2.findContours(a, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    q = cv2.convexHull(max(cs, key=cv2.contourArea)).reshape(-1, 2).astype(np.float32)
    top, right, bot, left = q[np.argmin(q[:, 1])], q[np.argmax(q[:, 0])], q[np.argmax(q[:, 1])], q[np.argmin(q[:, 0])]
    if np.linalg.norm(right - top) < np.linalg.norm(top - left): fw, fd = fd, fw
    u = 480 / (fw + fd)
    M = cv2.getPerspectiveTransform(np.float32([top, right, bot, left]), np.float32([[fd, 0], [fw + fd, fw / 2], [fw, (fw + fd) / 2], [0, fd / 2]]) * u)
    return cv2.warpPerspective(im, M, (480, 240), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_CONSTANT, borderValue=(0, 0, 0, 0)), fw, fd
def ell(im):
    a = (im[..., 3] > 128).astype(np.uint8); cs, _ = cv2.findContours(a, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    (cx, cy), (w, h), ang = cv2.fitEllipse(max(cs, key=cv2.contourArea))
    th = np.deg2rad(ang); a1 = np.array([np.cos(th), np.sin(th)]) * w / 2; a2 = np.array([-np.sin(th), np.cos(th)]) * h / 2
    if abs(a1[0]) < abs(a2[0]): a1, a2 = a2, a1
    if a1[0] < 0: a1 = -a1
    if a2[1] < 0: a2 = -a2
    R = 240 * .74
    M = cv2.getAffineTransform(np.float32([[cx, cy], [cx + a1[0], cy + a1[1]], [cx + a2[0], cy + a2[1]]]), np.float32([[240, 120], [240 + R, 120], [240, 120 + R / 2]]))
    return cv2.warpAffine(im, M, (480, 240), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_CONSTANT, borderValue=(0, 0, 0, 0))
L = []
for s, k, n, se, kind, w, d, p, sl, pad in T:
    im = cv2.imread(f'{IN}/{s}.png', cv2.IMREAD_UNCHANGED)
    if kind == Q: im, w, d = quad(im, w, d); kind = 'flat'
    elif kind == E: im = ell(im); kind = 'flat'
    else:
        if sl: im = shear(im, sl)
        if pad > 1: h, ww = im.shape[:2]; W2 = int(ww * pad); o = np.zeros((h, W2, 4), np.uint8); o[:, (W2 - ww) // 2:(W2 - ww) // 2 + ww] = im; im = o
        h, ww = im.shape[:2]; f = min(1, 480 / max(h, ww))
        if f < 1: im = cv2.resize(im, (round(ww * f), round(h * f)), interpolation=cv2.INTER_AREA)
    cv2.imwrite(f'{OUT}/{k}.png', im)
    if kind == W: L.append(f"    {{ id: '{k}', name: '{n}', style: 'fun', kind: 'wall', w: {w}, h: {w}, v: {d}, price: {p}, reward: true, draw() {{}} }}")
    else: L.append(f"    {{ id: '{k}', name: '{n}', style: 'fun', kind: '{kind}', w: {w}, d: {d}, price: {p}, reward: true, draw() {{}} }}")
s = open('common/room-items-pics.js').read()
s = s.replace('\n  ];\n})', ',\n    /* 12こ目のセット：段級位のごほうび（売らない・骨董屋でも売れない） */\n' + ',\n'.join(L) + '\n  ];\n})', 1)
open('common/room-items-pics.js', 'w').write(s); print(len(L))
