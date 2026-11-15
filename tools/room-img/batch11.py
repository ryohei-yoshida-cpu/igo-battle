# 11こ目のセット：行事の限定（ひな祭り・こどもの日・七夕・お月見・ハロウィン・クリスマス）（市松の背景は cutgrid.py で切りぬき）
import cv2, numpy as np, os
IN, OUT = 'tools/room-img/cut24', 'tools/room-img/cut25'
SCR = (.30, -.62); os.makedirs(OUT, exist_ok=True)
BOX = (.22, -.62)   # この絵のカメラの傾き（前・横）
F, W, Q, E = 'floor', 'wall', 'quad', 'ell'
# (src, id, 名前, 季節, 種類, w, d|v, 値段, 角度そろえ, よこ余白)
T = [
 ('h00', 'ev_hina', 'ひな人形', 'hina', F, 2, 1, 400, BOX, 1),
 ('h01', 'ev_tsurushi', 'つるし雛', 'hina', F, 1, 1, 300, 0, 1.3),
 ('h02', 'ev_momobonsai', '桃の盆栽', 'hina', F, 1, 1, 200, 0, 1),
 ('h03', 'ev_bonbori', 'ぼんぼり', 'hina', F, 1, 1, 200, 0, 1.6),
 ('h04', 'ev_hinagasa', '桜の野点傘', 'hina', F, 2, 1, 300, BOX, 1),
 ('h05', 'ev_sakurapanel', '桜の掛け衝立', 'hina', F, 1, 1, 200, 0, 1.2),
 ('h06', 'ev_usagihina', 'うさぎ雛の飾り棚', 'hina', F, 2, 1, 300, BOX, 1),
 ('h07', 'ev_sakuramochi', '桜餅と三色だんご', 'hina', F, 1, 1, 100, 0, 1),
 ('h08', 'ev_hishimochi', '菱餅', 'hina', F, 1, 1, 200, BOX, 1),
 ('h09', 'ev_sakuratable', '桜の花形テーブル', 'hina', F, 2, 2, 300, 0, 1),
 ('h11', 'ev_momovase', '桃の花の花瓶', 'hina', F, 1, 1, 200, 0, 1.2),
 ('h12', 'ev_sakurabyobu', '桜の金屏風', 'hina', F, 2, 1, 400, SCR, 1),
 ('h13', 'ev_sakurawin', '桜の窓', 'hina', W, 2, 1.6, 400, 0, 1),
 ('h14', 'ev_goshoguruma', '御所車の掛け軸', 'hina', W, 1.1, 2.4, 200, 0, 1),
 ('h15', 'ev_sakurarug', '桜の花形ラグ', 'hina', E, 2, 2, 200, 0, 1),
 ('h16', 'ev_sakuragoza', '桜のござ', 'hina', Q, 2, 3, 200, 0, 1),
 ('k00', 'ev_kabuto', '兜飾り', 'kodomo', F, 2, 1, 400, BOX, 1),
 ('k01', 'ev_koinobori', 'こいのぼり', 'kodomo', F, 1, 1, 300, 0, 1.3),
 ('k02', 'ev_fujidai', '藤棚の縁台', 'kodomo', F, 2, 1, 300, BOX, 1),
 ('k03', 'ev_kashiwa', '柏餅とちまき', 'kodomo', F, 1, 1, 100, 0, 1),
 ('k04', 'ev_kabutoandon', '兜の行灯', 'kodomo', F, 1, 1, 200, BOX, 1.3),
 ('k05', 'ev_katanakake', '刀掛けと菖蒲', 'kodomo', F, 2, 1, 300, BOX, 1),
 ('k06', 'ev_tora', '張り子の虎', 'kodomo', F, 1, 1, 200, 0, 1),
 ('k07', 'ev_jindaiko', '陣太鼓', 'kodomo', F, 1, 1, 300, 0, 1),
 ('k08', 'ev_matokake', '弓の的', 'kodomo', F, 1, 1, 200, BOX, 1),
 ('k09', 'ev_kazaguruma', '風車の屋台', 'kodomo', F, 2, 1, 400, BOX, 1),
 ('k10', 'ev_shobubox', '菖蒲のプランター', 'kodomo', F, 1, 1, 200, BOX, 1),
 ('k11', 'ev_fujibyobu', '富士と松の屏風', 'kodomo', F, 2, 1, 400, SCR, 1),
 ('k12', 'ev_koiscroll', '鯉の滝のぼり掛け軸', 'kodomo', W, 1.1, 2.4, 200, 0, 1),
 ('k13', 'ev_shobuzataku', '菖蒲の座卓', 'kodomo', F, 2, 2, 300, 0, 1),
 ('k14', 'ev_koirug', '鯉の丸ラグ', 'kodomo', E, 2, 2, 200, 0, 1),
 ('k15', 'ev_shobugoza', '菖蒲のござ', 'kodomo', Q, 2, 3, 200, 0, 1),
 ('t00', 'ev_sasakazari', '七夕の笹飾り', 'tanabata', F, 1, 1, 300, 0, 1),
 ('t01', 'ev_fukinagashi', '吹き流し', 'tanabata', F, 1, 1, 300, 0, 1),
 ('t02x', 'ev_asagaodai', '朝顔の縁台', 'tanabata', F, 2, 1, 300, BOX, 1),
 ('t02y', 'ev_hoshizataku', '星の座卓', 'tanabata', F, 2, 2, 300, 0, 1),
 ('t03', 'ev_amanoandon', '天の川の行灯', 'tanabata', F, 1, 1, 200, BOX, 1.3),
 ('t04', 'ev_hoshitsukubai', '星のつくばい', 'tanabata', F, 1, 1, 300, 0, 1),
 ('t05', 'ev_hoshibashi', '星の太鼓橋', 'tanabata', F, 2, 2, 400, 0, 1),
 ('t06', 'ev_hoshiyatai', '星の屋台', 'tanabata', F, 2, 1, 400, BOX, 1),
 ('t07', 'ev_bouenkyo', '望遠鏡', 'tanabata', F, 1, 1, 300, 0, 1),
 ('t08', 'ev_hoshimobile', '星のモビール', 'tanabata', W, 1.2, 3, 200, 0, 1),
 ('t09', 'ev_amanobyobu', '天の川の屏風', 'tanabata', F, 2, 1, 400, SCR, 1),
 ('t10', 'ev_sasaandon', '笹の行灯', 'tanabata', F, 1, 1, 200, BOX, 1.3),
 ('t11', 'ev_orihime', '織姫と彦星の掛け軸', 'tanabata', W, 1.1, 2.4, 200, 0, 1),
 ('t12', 'ev_amanomado', '天の川の丸窓', 'tanabata', W, 1.8, 2, 400, 0, 1),
 ('t13', 'ev_hoshilamp', '星のランプ', 'tanabata', F, 1, 1, 200, 0, 1),
 ('t14', 'ev_asagaokago', '朝顔のかご', 'tanabata', F, 1, 1, 200, 0, 1),
 ('t15', 'ev_amanorug', '天の川の丸ラグ', 'tanabata', E, 2, 2, 200, 0, 1),
 ('t16', 'ev_sasagoza', '笹の葉のござ', 'tanabata', Q, 2, 3, 200, 0, 1),
 ('m00', 'ev_tsukimimado', '月見の庭', 'tsukimi', F, 2, 1, 400, 0, 1),
 ('m01', 'ev_tsukimidai', '月見の縁台', 'tsukimi', F, 2, 1, 300, BOX, 1),
 ('m02', 'ev_tsukimizataku', 'お月見の座卓', 'tsukimi', F, 2, 2, 300, 0, 1),
 ('m03', 'ev_dango', '月見団子', 'tsukimi', F, 1, 1, 200, BOX, 1),
 ('m04', 'ev_mochitsuki', 'うさぎの餅つき臼', 'tsukimi', F, 1, 1, 300, 0, 1),
 ('m05', 'ev_momijibonsai', '紅葉の盆栽', 'tsukimi', F, 1, 1, 200, 0, 1),
 ('m06', 'ev_susukivase', 'すすきと桔梗の花瓶', 'tsukimi', F, 1, 1, 200, 0, 1.2),
 ('m07', 'ev_usagiandon', 'うさぎの行灯', 'tsukimi', F, 1, 1, 200, BOX, 1.3),
 ('m08', 'ev_tsukibyobu', '月とうさぎの屏風', 'tsukimi', F, 2, 1, 400, SCR, 1),
 ('m09', 'ev_meigetsumado', '名月の丸窓', 'tsukimi', W, 1.8, 2, 400, 0, 1),
 ('m10', 'ev_tsukiscroll', '月見うさぎの掛け軸', 'tsukimi', W, 1.1, 2.4, 200, 0, 1),
 ('m11', 'ev_momijitsukubai', '紅葉のつくばい', 'tsukimi', F, 1, 1, 300, 0, 1),
 ('m12', 'ev_yomise', '秋の夜店', 'tsukimi', F, 2, 1, 400, BOX, 1),
 ('m13', 'ev_kurikago', '栗と柿のかご', 'tsukimi', F, 1, 1, 100, 0, 1),
 ('m14', 'ev_tsukirug', '月夜の丸ラグ', 'tsukimi', E, 2, 2, 200, 0, 1),
 ('m15', 'ev_susukigoza', 'すすきのござ', 'tsukimi', Q, 2, 3, 200, 0, 1),
 ('o00', 'ev_pumpkintree', 'かぼちゃの木', 'halloween', F, 2, 2, 400, 0, 1),
 ('o01', 'ev_obakeyashiki', 'おばけ屋敷', 'halloween', F, 2, 2, 400, 0, 1),
 ('o02', 'ev_candystall', 'お菓子の屋台', 'halloween', F, 2, 1, 400, BOX, 1),
 ('o03', 'ev_witchtea', '魔女のティーセット', 'halloween', F, 2, 2, 300, 0, 1),
 ('o04', 'ev_witchbed', '魔女の天蓋ベッド', 'halloween', F, 2, 3, 400, 0, 1),
 ('o05', 'ev_cauldron', '魔女の大鍋', 'halloween', F, 2, 1, 300, 0, 1),
 ('o06', 'ev_jackolantern', 'ジャック・オ・ランタン', 'halloween', F, 1, 1, 200, 0, 1),
 ('o07', 'ev_obake', 'おばけとランタン', 'halloween', F, 1, 1, 200, 0, 1),
 ('o08', 'ev_coffinshelf', 'ひつぎの本棚', 'halloween', F, 1, 1, 300, 0, 1.2),
 ('o09', 'ev_castlewin', '古城の窓', 'halloween', W, 2, 1.6, 400, 0, 1),
 ('o10', 'ev_castleflag', '古城のタペストリー', 'halloween', W, 1.2, 2.6, 200, 0, 1),
 ('o11', 'ev_gravegate', '墓場の門', 'halloween', F, 2, 1, 300, 0, 1),
 ('o12x', 'ev_scarecrow', 'かかしと黒ねこ', 'halloween', F, 1, 1, 200, 0, 1),
 ('o12y', 'ev_hwsweets', 'ハロウィンのお菓子スタンド', 'halloween', F, 1, 1, 200, 0, 1.2),
 ('o13', 'ev_castlebyobu', '満月の古城の屏風', 'halloween', F, 2, 1, 400, SCR, 1),
 ('o14', 'ev_pumpkinrug', 'かぼちゃの丸ラグ', 'halloween', E, 2, 2, 200, 0, 1),
 ('o15', 'ev_catrug', '黒ねこのラグ', 'halloween', Q, 2, 3, 200, 0, 1),
 ('x00', 'ev_xmastree', 'クリスマスツリー', 'xmas', F, 2, 2, 400, 0, 1),
 ('x01', 'ev_okashihouse', 'お菓子の家', 'xmas', F, 2, 2, 400, 0, 1),
 ('x02', 'ev_xmasmarket', 'クリスマスマーケット', 'xmas', F, 2, 1, 400, BOX, 1),
 ('x03', 'ev_nutcracker', 'くるみ割り人形と暖炉', 'xmas', F, 2, 1, 400, BOX, 1),
 ('x04x', 'ev_xmasdinner', 'クリスマスディナー', 'xmas', F, 2, 2, 300, 0, 1),
 ('x04y', 'ev_xmasbed', 'クリスマスの天蓋ベッド', 'xmas', F, 2, 3, 400, 0, 1),
 ('x05', 'ev_sori', 'トナカイのそり', 'xmas', F, 3, 1, 400, 0, 1),
 ('x06', 'ev_snowdome', 'スノードーム', 'xmas', F, 1, 1, 300, 0, 1),
 ('x07', 'ev_xsnowman', 'シルクハットの雪だるま', 'xmas', F, 1, 1, 200, 0, 1.2),
 ('x08', 'ev_ribbonlamp', 'リボンの街灯', 'xmas', F, 1, 1, 200, 0, 1.6),
 ('x09', 'ev_seiyawin', '聖夜の窓', 'xmas', W, 2, 1.6, 400, 0, 1),
 ('x10', 'ev_bellwreath', 'ベルのリース', 'xmas', W, 1.4, 3, 200, 0, 1),
 ('x11', 'ev_treeflag', 'もみの木のタペストリー', 'xmas', W, 1.2, 2.6, 200, 0, 1),
 ('x12', 'ev_lightdeer', '光のトナカイ', 'xmas', F, 1, 1, 300, 0, 1),
 ('x13', 'ev_presents', 'プレゼントの山', 'xmas', F, 1, 1, 200, 0, 1),
 ('x14', 'ev_xsweets', 'クリスマスのスイーツスタンド', 'xmas', F, 1, 1, 200, 0, 1.2),
 ('x15', 'ev_aurorabyobu', 'オーロラの屏風', 'xmas', F, 2, 1, 400, SCR, 1),
 ('x16', 'ev_snowrug', '雪の結晶の丸ラグ', 'xmas', E, 2, 2, 200, 0, 1),
 ('x17', 'ev_deerrug', 'トナカイのラグ', 'xmas', Q, 2, 3, 200, 0, 1),
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
s = s.replace('\n  ];\n})', ',\n    /* 11こ目のセット：行事の限定（ひな祭り・こどもの日・七夕・お月見・ハロウィン・クリスマス） */\n' + ',\n'.join(L) + '\n  ];\n})', 1)
open('common/room-items-pics.js', 'w').write(s); print(len(L))
