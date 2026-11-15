# 5つ目のセット：和の壁掛け8種と、和のラグ8種
#   ラグは床のひし形にぴったり合わせる：四角いものは4つの角をひし形の角へ（射影変換）、
#   丸いもの・花形などは輪郭のだ円を、床の上の円（横:たて＝2:1 のだ円）へ
import cv2, numpy as np, os
OUT = 'tools/room-img/cut13'; os.makedirs(OUT, exist_ok=True)
WALL = [('j100', 'w_noren', '月とうさぎののれん', 2, 2.6, 200), ('j101', 'w_fujimado', '藤の丸窓', 1.8, 2, 400), ('j102', 'w_byobu', '紅白梅の屏風', 3, 0, 400), ('j103', 'w_marudana', '丸い壁棚', 1.8, 2.4, 300),
        ('j200', 'w_sakuramado', '桜の丸窓', 1.8, 2, 400), ('j201', 'w_tsuru', '鶴の掛け軸', 1.2, 2.2, 300), ('j202', 'w_sensu', '桜と扇の飾り', 1.8, 2.6, 200), ('j203', 'w_momijitoro', '紅葉の吊り灯籠', 1.2, 3, 200)]
RUG = [('j104', 'r_tatami', '紫べりの畳ござ', 'q', 300), ('j105', 'r_momiji', '紅葉と流水のラグ', 'e', 300), ('j106', 'r_botan', '牡丹と麻の葉のラグ', 'e', 400), ('j107', 'r_ayame', 'あやめの雲形ラグ', 'e', 300),
       ('j204', 'r_seigaiha', '桜と青海波のござ', 'q', 300), ('j205', 'r_koi', '鯉と紅葉のラグ', 'e', 400), ('j206', 'r_take', '竹のござ', 'q', 200), ('j207', 'r_sakura', '桜の花形ラグ', 'e', 300)]
def rug(src, k, kind):
    im = cv2.imread(f'tools/room-img/cut12/{src}.png', cv2.IMREAD_UNCHANGED)
    a = (im[..., 3] > 128).astype(np.uint8)
    cs, _ = cv2.findContours(a, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE); c = max(cs, key=cv2.contourArea)
    if kind == 'q':
        h = cv2.convexHull(c); q = cv2.approxPolyDP(h, .03 * cv2.arcLength(h, True), True).reshape(-1, 2).astype(np.float32)
        top = q[np.argmin(q[:, 1])]; right = q[np.argmax(q[:, 0])]; bot = q[np.argmax(q[:, 1])]; left = q[np.argmin(q[:, 0])]
        fw, fd = (3, 2) if np.linalg.norm(right - top) >= np.linalg.norm(top - left) else (2, 3)
        u = 480 / (fw + fd)
        dst = np.float32([[fd, 0], [fw + fd, fw / 2], [fw, (fw + fd) / 2], [0, fd / 2]]) * u
        M = cv2.getPerspectiveTransform(np.float32([top, right, bot, left]), dst)
        out = cv2.warpPerspective(im, M, (480, 240), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_CONSTANT, borderValue=(0, 0, 0, 0))
        return out, fw, fd
    (cx, cy), (w, h), ang = cv2.fitEllipse(c)
    th = np.deg2rad(ang)   # w の軸の向き
    ax1 = np.array([np.cos(th), np.sin(th)]) * w / 2; ax2 = np.array([-np.sin(th), np.cos(th)]) * h / 2
    if abs(ax1[0]) < abs(ax2[0]): ax1, ax2 = ax2, ax1     # 横に近い軸を横に
    if ax1[0] < 0: ax1 = -ax1
    if ax2[1] < 0: ax2 = -ax2
    W = 480; R = W / 2 * .74      # 2×2 のひし形の中におさまる円
    src3 = np.float32([[cx, cy], [cx + ax1[0], cy + ax1[1]], [cx + ax2[0], cy + ax2[1]]])
    dst3 = np.float32([[W / 2, W / 4], [W / 2 + R, W / 4], [W / 2, W / 4 + R / 2]])
    out = cv2.warpAffine(im, cv2.getAffineTransform(src3, dst3), (W, W // 2), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_CONSTANT, borderValue=(0, 0, 0, 0))
    return out, 2, 2
L = []
for s, k, n, kind, p in RUG:
    out, fw, fd = rug(s, k, kind); cv2.imwrite(f'{OUT}/{k}.png', out)
    L.append(f"    {{ id: '{k}', name: '{n}', style: 'wa', kind: 'flat', w: {fw}, d: {fd}, price: {p}, draw() {{}} }}")
for s, k, n, w, v, p in WALL:
    im = cv2.imread(f'tools/room-img/cut12/{s}.png', cv2.IMREAD_UNCHANGED); h, ww = im.shape[:2]; f = min(1, 480 / max(h, ww))
    if f < 1: im = cv2.resize(im, (round(ww * f), round(h * f)), interpolation=cv2.INTER_AREA)
    cv2.imwrite(f'{OUT}/{k}.png', im)
    L.append(f"    {{ id: '{k}', name: '{n}', style: 'wa', kind: 'wall', w: {w}, h: {w}, v: {v}, price: {p}, draw() {{}} }}")
s = open('common/room-items-pics.js').read()
s = s.replace('\n  ];\n})', ',\n    /* 5つ目のセット：和の壁掛けとラグ */\n' + ',\n'.join(L) + '\n  ];\n})', 1)
open('common/room-items-pics.js', 'w').write(s); print(len(L))
