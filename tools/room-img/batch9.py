# 9つ目のセット：夏・秋・冬の季節限定（市松の背景は cutgrid.py で切りぬき）
import cv2, numpy as np, os
IN, OUT = 'tools/room-img/cut20', 'tools/room-img/cut21'; os.makedirs(OUT, exist_ok=True)
BOX = (.22, -.62)   # この絵のカメラの傾き（前・横）
F, W, Q, E = 'floor', 'wall', 'quad', 'ell'
# (src, id, 名前, 季節, 種類, w, d|v, 値段, 角度そろえ, よこ余白)
T = [
 # 冬
 ('w00', 'wi_tree', '雪のもみの木', 'winter', F, 2, 2, 400, 0, 1), ('w01', 'wi_snowman', '雪だるま', 'winter', F, 1, 1, 200, 0, 1.2), ('w02', 'wi_bench', '雪のパーゴラベンチ', 'winter', F, 2, 1, 300, BOX, 1),
 ('w03', 'wi_kotatsu', '雪の結晶のこたつ', 'winter', F, 2, 2, 400, 0, 1), ('w04', 'wi_stall', '肉まんの屋台', 'winter', F, 2, 1, 400, BOX, 1), ('w05', 'wi_onsen', '雪見の露天風呂', 'winter', F, 3, 3, 400, 0, 1),
 ('w06', 'wi_fireplace', 'れんがの暖炉', 'winter', F, 2, 1, 400, BOX, 1), ('w07', 'wi_armchair', 'ニットのアームチェア', 'winter', F, 1, 1, 200, BOX, 1), ('w08', 'wi_shelf', '冬の本棚', 'winter', F, 2, 1, 300, BOX, 1),
 ('w10', 'wi_lantern', '雪の灯籠', 'winter', F, 1, 1, 200, 0, 1.3), ('w13', 'wi_byobu', '雪と梅の衝立', 'winter', F, 2, 1, 300, (.30, -.62), 1),
 ('w09', 'wiw_window', '雪景色の窓', 'winter', W, 2, 1.6, 400, 0, 1), ('w11', 'wiw_wreath', '冬のリース', 'winter', W, 1.4, 3, 200, 0, 1), ('w12', 'wiw_banner', '雪の結晶のタペストリー', 'winter', W, 1.1, 2.4, 200, 0, 1),
 ('w14', 'wir_fur', 'ふわふわの丸ラグ', 'winter', E, 2, 2, 200, 0, 1), ('w15', 'wir_snow', '雪の結晶のラグ', 'winter', Q, 2, 3, 200, 0, 1),
 # 秋
 ('a00', 'au_tree', '紅葉の木', 'autumn', F, 2, 2, 400, 0, 1), ('a01x', 'au_bench', '紅葉のパーゴラベンチ', 'autumn', F, 2, 1, 300, BOX, 1), ('a01y', 'au_tea', '炭火のお茶セット', 'autumn', F, 2, 2, 200, BOX, 1),
 ('a02', 'au_stall', '秋の実りの屋台', 'autumn', F, 2, 1, 400, BOX, 1), ('a03', 'au_susuki', 'すすきと石灯籠', 'autumn', F, 1, 1, 200, 0, 1), ('a04', 'au_irori', '囲炉裏', 'autumn', F, 2, 2, 400, BOX, 1),
 ('a05', 'au_table', '紅葉の縁台', 'autumn', F, 2, 1, 300, BOX, 1), ('a06', 'au_shelf', '紅葉の本棚', 'autumn', F, 1, 1, 300, BOX, 1), ('a07', 'au_tansu', '秋の箪笥', 'autumn', F, 2, 1, 300, BOX, 1),
 ('a08', 'au_byobu', '紅葉の衝立', 'autumn', F, 2, 1, 300, (.30, -.62), 1), ('a11', 'au_andon', '紅葉の行灯', 'autumn', F, 1, 1, 200, BOX, 1.4), ('a12', 'au_lamp', '紅葉の街灯', 'autumn', F, 1, 1, 200, 0, 1.6),
 ('a09', 'auw_scroll', '月とすすきの掛け軸', 'autumn', W, 1.1, 2.4, 200, 0, 1), ('a10', 'auw_window', '紅葉の丸窓', 'autumn', W, 1.8, 2, 400, 0, 1), ('a13', 'auw_wreath', '秋のリース', 'autumn', W, 1.4, 3, 200, 0, 1),
 ('a14', 'aur_momiji', '紅葉の丸ラグ', 'autumn', E, 2, 2, 200, 0, 1), ('a15', 'aur_icho', 'いちょうのラグ', 'autumn', Q, 2, 3, 200, 0, 1),
 # 夏
 ('s00x', 'su_beach', 'パラソルとビーチチェア', 'summer', F, 2, 2, 300, 0, 1), ('s00y', 'su_tsukubai', 'あじさいの水場', 'summer', F, 1, 1, 300, 0, 1), ('s01', 'su_hibiscus', 'ハイビスカスの鉢', 'summer', F, 1, 1, 200, BOX, 1),
 ('s02', 'su_bench', '風鈴の縁台', 'summer', F, 2, 1, 300, BOX, 1), ('s03', 'su_kakigori', 'かき氷の屋台', 'summer', F, 2, 1, 400, BOX, 1), ('s04', 'su_suika', 'すいかの桶', 'summer', F, 1, 1, 200, 0, 1),
 ('s05', 'su_kingyo', '金魚鉢', 'summer', F, 1, 1, 200, 0, 1.2), ('s06', 'su_zataku', '夏の座卓', 'summer', F, 2, 2, 300, 0, 1), ('s08', 'su_andon', '波の行灯', 'summer', F, 1, 1, 200, BOX, 1.2),
 ('s10', 'su_byobu', '波の屏風', 'summer', F, 2, 1, 400, (.30, -.62), 1), ('s12', 'su_himawari', 'ひまわりのプランター', 'summer', F, 1, 1, 200, BOX, 1), ('s13', 'su_ukibana', '浮き花の鉢', 'summer', F, 1, 1, 200, 0, 1),
 ('s07', 'suw_hanabi', '花火の掛け軸', 'summer', W, 1.1, 2.4, 300, 0, 1), ('s09', 'suw_sudare', '朝顔のすだれ', 'summer', W, 1.4, 2.2, 200, 0, 1), ('s11', 'suw_furin', '金魚の風鈴', 'summer', W, .6, 3.4, 100, 0, 1),
 ('s14', 'sur_goza', '青海波の丸ござ', 'summer', E, 2, 2, 200, 0, 1), ('s15', 'sur_nami', '波と桜のラグ', 'summer', Q, 2, 3, 200, 0, 1),
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
    if kind == W: L.append(f"    {{ id: '{k}', name: '{n}', style: 'fun', kind: 'wall', w: {w}, h: {w}, v: {d}, price: {p}, season: '{se}', draw() {{}} }}")
    else: L.append(f"    {{ id: '{k}', name: '{n}', style: 'fun', kind: '{kind}', w: {w}, d: {d}, price: {p}, season: '{se}', draw() {{}} }}")
s = open('common/room-items-pics.js').read()
s = s.replace('\n  ];\n})', ',\n    /* 9つ目のセット：夏・秋・冬の季節限定 */\n' + ',\n'.join(L) + '\n  ];\n})', 1)
open('common/room-items-pics.js', 'w').write(s); print(len(L))
