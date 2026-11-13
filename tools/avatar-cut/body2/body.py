# 新しい素体（白い背景）から、首から下の体だけを切りぬいて、アバターのキャンバス（320×780）の前の体と同じ位置に置く
import cv2, numpy as np
from scipy import ndimage as ndi
from PIL import Image
CHIN = {'girl': 398, 'boy': 408}
OLD = {'girl': (242, 759), 'boy': (241, 775)}   # 前の体：首の上・足の下
for b in ['girl', 'boy']:
    im = cv2.imread(f'src_{b}.png', cv2.IMREAD_UNCHANGED)[..., :3]; H, W = im.shape[:2]
    hsv = cv2.cvtColor(im, cv2.COLOR_BGR2HSV); s, v = hsv[..., 1].astype(int), hsv[..., 2].astype(int)
    # 背景：白〜灰色（色がうすい）で、外側につながっているところ（床の影も）
    pale = (s < 30) & (v > 140)
    lab, n = ndi.label(pale); edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bg = np.isin(lab, list(edge))
    # 影（灰色のだ円）は足の下の外側にある。外とつながっていない灰色も、足より下なら消す
    fg = ~bg
    # 髪：こい茶色の太いところ（線は細いので残る）。穴（ハイライト）もうめる
    dark = (v < 110)
    hair = cv2.morphologyEx(dark.astype(np.uint8), cv2.MORPH_OPEN, np.ones((9, 9), np.uint8)).astype(bool)
    hair = ndi.binary_fill_holes(cv2.dilate(hair.astype(np.uint8), np.ones((5, 5), np.uint8)).astype(bool))
    # 髪のハイライト（少し明るい茶色）もまとめる：髪のまわりの、肌色ではない茶色
    brown = (hsv[..., 0] < 25) & (s > 25) & (v < 170) & ~((s > 40) & (v > 150))
    hair |= ndi.binary_dilation(hair, iterations=6) & brown
    fg &= ~hair
    fg[:CHIN[b]] = False                       # 頭は消す（顔は別の部品）
    # いちばん大きなかたまりだけ（体）
    lab2, n2 = ndi.label(fg); sz = ndi.sum(fg, lab2, range(1, n2 + 1)); fg = lab2 == (np.argmax(sz) + 1)
    # 小さな穴だけうめる（腕と体のあいだのすき間は残す）
    holes = ndi.binary_fill_holes(fg) & ~fg; hl, hn = ndi.label(holes)
    if hn: hs = ndi.sum(holes, hl, range(1, hn + 1)); fg |= np.isin(hl, [i + 1 for i, v in enumerate(hs) if v < 400])
    # 髪でかくれていた所は線がないので、外側に元の絵と同じ色の線を足す（線がすでにある所はそのまま）
    ring = cv2.dilate(fg.astype(np.uint8), np.ones((5, 5), np.uint8)).astype(bool) & ~fg
    lined = cv2.dilate((fg & (v < 120)).astype(np.uint8), np.ones((7, 7), np.uint8)).astype(bool)
    add = ring & ~lined; add[:CHIN[b] + 6] = False
    im = im.copy(); im[add] = (48, 58, 92)     # BGR：こげ茶の線
    fg = fg | add
    ys, xs = np.nonzero(fg); top, bot = CHIN[b], ys.max()
    if b == 'girl':
        # 女の子は、長い髪が向かって左の肩と腕にかかっているので、右半分を左右反転して左半分にする（体は左右対称）
        c = int(round(np.median([(np.nonzero(fg[y])[0].min() + np.nonzero(fg[y])[0].max()) / 2 for y in range(900, 1000) if fg[y].any()])))
        w = min(c, W - c)
        R = im[:, c:c + w].copy(); Rm = fg[:, c:c + w].copy()
        im = im.copy(); im[:, c - w:c] = R[:, ::-1]; fg = fg.copy(); fg[:, c - w:c] = Rm[:, ::-1]
        ys, xs = np.nonzero(fg)
    o0, o1 = OLD[b]; sc = (o1 - o0) / (bot - top)
    cx = (xs.min() + xs.max()) / 2
    a = (cv2.GaussianBlur(fg.astype(np.float32), (3, 3), 0) * 255)
    rgba = np.dstack([im[..., ::-1].astype(np.float32) * (a[..., None] / 255), a])
    sx = sc * min(1.0, 250 / ((xs.max() - xs.min()) * sc))   # 横はひろがりすぎないように（服のそでに収まる幅、手の先まで250まで）
    M = np.float32([[sx, 0, 160 - cx * sx], [0, sc, o0 - top * sc]])
    out = cv2.warpAffine(rgba, M, (320, 780), flags=cv2.INTER_AREA, borderValue=0)
    al = np.clip(out[..., 3], 0, 255); rgb = np.where(al[..., None] > 0, out[..., :3] / np.maximum(al[..., None], 1) * 255, 0)
    Image.fromarray(np.dstack([np.clip(rgb, 0, 255), al]).astype(np.uint8)).save(f'{b}_body.png')
    print(b, 'scale', round(sc, 3), 'bbox', Image.open(f'{b}_body.png').getchannel('A').getbbox())
