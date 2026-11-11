import numpy as np, cv2, json, os
from scipy import ndimage as ndi
from scipy.spatial import ConvexHull
exec(open('seg2.py').read().split("res = {}")[0])   # figure() を使う
EYEC = {'girl': 157.5, 'boy': 149.0}
EYEY = {'girl': 170, 'boy': 183}
OUT = '/home/claude/igo-battle/img/avatar'; os.makedirs(OUT, exist_ok=True)
CW, CH = 320, 780
data = {}
for name, x0, x1, chin in [('girl', 330, 650, 243), ('boy', 810, 1110, 252)]:
    sub, full, fg, ys = figure(x0, x1, name, chin)
    # 輪郭のにじみ（背景との境目）をラベルに入れなおす：内側だけを信じる
    inner = ndi.binary_erosion(fg, iterations=2)
    lab = full.copy(); keep = inner & (lab > 0)
    idx = ndi.distance_transform_edt(~keep, return_distances=False, return_indices=True)
    lab = lab[idx[0], idx[1]]; lab[~fg] = 0
    face = lab == 8
    # 顔の幅（目の高さ）
    rows = [face[y].sum() for y in range(chin - 70, chin - 30)]
    data[name] = dict(sub=sub, lab=lab, fg=fg, chin=chin, fw=float(np.median(rows)), cx=float(np.nonzero(face[chin - 50])[0].mean()))
g, b = data['girl'], data['boy']
print('face widths', g['fw'], b['fw'])
def place(d, s, tx, ty):
    M = np.float32([[s, 0, tx], [0, s, ty]])
    return M
# 目の位置で合わせる（女の子：目と目の間 71px・中心(157.5,170)、男の子：68px・(149,183)）
gm = place(g, 1.0, CW / 2 - 157.5, 10)
s = 71 / 68
bm = place(b, s, CW / 2 - 149 * s, 10 + 170 - 183 * s)
skinc = np.array([243, 196, 168])
def warp(img, M, interp=cv2.INTER_LINEAR):
    return cv2.warpAffine(img, M, (CW, CH), flags=interp, borderValue=0)
info = {}
for name, d, M in [('girl', g, gm), ('boy', b, bm)]:
    sub, lab, fg, chin = d['sub'].astype(np.uint8), d['lab'], d['fg'], d['chin']
    def layer(mask, rgb=None): pass
    h, w = lab.shape
    ys = np.arange(h)[:, None].repeat(w, 1)
    alpha_all = cv2.GaussianBlur(fg.astype(np.float32), (3, 3), 0.7)
    def layer(mask, rgb=None):
        rgb = sub if rgb is None else rgb
        m = cv2.GaussianBlur(mask.astype(np.float32), (3, 3), 0.6) * alpha_all
        rgba = np.dstack([rgb, (np.clip(m, 0, 1) * 255).astype(np.uint8)])
        out = warp(rgba, M)
        out[out[..., 3] == 0, :3] = 0
        return out
    def save(part, rgba):
        a = rgba[..., 3] > 40
        cl, n = ndi.label(a)
        if n > 1:
            sizes = ndi.sum(a, cl, range(1, n + 1))
            small = np.isin(cl, [i + 1 for i, sz in enumerate(sizes) if sz < 250])
            rgba = rgba.copy(); rgba[small | (~a & ~ndi.binary_dilation(a & ~small, iterations=2))] = 0
        cv2.imwrite(f'{OUT}/{name}_{part}.png', cv2.cvtColor(rgba, cv2.COLOR_RGBA2BGRA), [cv2.IMWRITE_PNG_COMPRESSION, 9])
    # 髪
    save('hair', layer(lab == HAIR))
    # 顔：髪にかくれていたおでこは、肌の色でうめる（ほかの髪型にしたとき穴があかないように）
    face = lab == 8
    sk = face & (sub[..., 0] > 190) & (sub[..., 1] > 140)
    cl, n = ndi.label(sk); sizes = ndi.sum(sk, cl, range(1, n + 1)); sk = cl == (np.argmax(sizes) + 1)
    pts = np.argwhere(sk)[:, ::-1].astype(np.float64)
    ecx = EYEC[name]
    mp = pts.copy(); mp[:, 0] = 2 * ecx - mp[:, 0]          # 左右対称にして、髪にかくれた側もうめる
    allp = np.concatenate([pts, mp])
    hull = ConvexHull(allp); poly = allp[hull.vertices].astype(np.int32)
    hm = np.zeros((h, w), np.uint8); cv2.fillPoly(hm, [poly], 1)
    # 頭の形のだ円も足す（こめかみが髪にかくれていても、ほかの髪型で穴があかないように）
    eyY = EYEY[name]; row = sk[eyY + 25]; xs_ = np.nonzero(row)[0]
    rx = int(max(abs(xs_.min() - ecx), abs(xs_.max() - ecx)) * 1.02)
    cv2.ellipse(hm, (int(ecx), int(eyY)), (rx, int(chin - eyY)), 0, 0, 360, 1, -1)
    hm[chin:] = 0
    frgb = sub.copy(); fill = (hm > 0) & ~face
    frgb[fill] = skinc
    save('face', layer(face | fill, frgb))
    # 髪にかくれていた肩や服は、まわりの色でうめる（ほかの髪型にしたとき穴があかないように）
    hairm = lab == HAIR
    # 髪にかくれた肩・腕・服を、反対側（左右対称）からうつしてうめる
    ecx = EYEC[name]
    xs = np.arange(w)[None, :].repeat(h, 0); mx_ = np.clip(np.round(2 * ecx - xs).astype(int), 0, w - 1)
    mlab = lab[ys, mx_]; msub = sub[ys, mx_]
    mir = hairm & (ys > chin) & np.isin(mlab, [SKIN, SHIRT]) & fg[ys, mx_]
    sub = sub.copy(); sub[mir] = msub[mir]
    lab = lab.copy(); lab[mir] = mlab[mir]
    hairm = lab == HAIR
    fg = fg | mir
    shirt = lab == SHIRT
    cl, n = ndi.label(shirt); sizes = ndi.sum(shirt, cl, range(1, n + 1)); shirt_main = cl == (np.argmax(sizes) + 1)
    sp = np.argwhere(shirt_main)[:, ::-1].astype(np.int32)
    sh = np.zeros((h, w), np.uint8); cv2.fillPoly(sh, [cv2.convexHull(sp)], 1)
    near = ndi.binary_dilation(shirt_main, iterations=14)
    shirt_fill = (sh > 0) & hairm & (ys > chin) & near
    torso = shirt | ((lab == SKIN) & (ys > chin)) | shirt_fill
    tp = np.argwhere(torso & (ys < chin + 200))[:, ::-1].astype(np.int32)
    th = np.zeros((h, w), np.uint8); cv2.fillPoly(th, [cv2.convexHull(tp)], 1)
    arm_fill = np.zeros_like(hairm)
    sub = sub.copy()
    if shirt_fill.any():
        sub = cv2.inpaint(sub, (shirt_fill | arm_fill).astype(np.uint8), 5, cv2.INPAINT_TELEA)
        sub[arm_fill] = skinc
        # うめた服の色を、服のまわりの色にそろえる
        sub[shirt_fill] = np.median(sub[shirt & ndi.binary_erosion(shirt, iterations=4)], 0)
    lab = lab.copy(); lab[shirt_fill] = SHIRT; lab[arm_fill] = SKIN
    alpha_all = cv2.GaussianBlur((fg | shirt_fill | arm_fill).astype(np.float32), (3, 3), 0.7)
    # 体：服や靴の下は肌でうめる（ふちには線を残す）
    body = (fg | arm_fill | shirt_fill) & (ys >= chin - 6) & (lab != HAIR) & (lab != 8)
    brgb = sub.copy(); notskin = body & (lab != SKIN)
    brgb[notskin] = skinc
    edge = notskin & ~ndi.binary_erosion(body, iterations=2)
    brgb[edge] = (110, 70, 58)
    # 靴とくつ下の下は、足の形にしぼる（くつ下の幅）
    seed = SEED[name]
    def near(code, r=4):   # 色で確かに判定できた部分の近くだけ（輪郭のにじみを服にしない）
        core = (seed == code) & ndi.binary_erosion(fg, iterations=4)
        cl, n = ndi.label(core)
        if n > 1:
            sizes = ndi.sum(core, cl, range(1, n + 1)); core = np.isin(cl, [i + 1 for i, sz in enumerate(sizes) if sz >= 60])
        return ndi.binary_dilation(core, iterations=r)
    def biggest(m):
        cl, n = ndi.label(m)
        if n < 2: return m
        sizes = ndi.sum(m, cl, range(1, n + 1)); return cl == (np.argmax(sizes) + 1)
    save('body', layer(biggest(body), brgb))
    save('top', layer(biggest((lab == SHIRT) & (near(SHIRT) | shirt_fill | mir))))
    save('bottom', layer((lab == SHORTS) & near(SHORTS)))
    save('shoes', layer((lab == SHOE) & near(SHOE)))
    save('socks', layer((lab == SOCK) | (lab == SOLE)))
    # 色を変えるときの基準の明るさ
    def ref(mask):
        px = sub[mask & ndi.binary_erosion(mask, iterations=3)].astype(np.float32)
        lum = px @ np.array([0.299, 0.587, 0.114]) / 255
        return float(np.percentile(lum, 60))
    info[name] = dict(hair=ref(lab == HAIR), top=ref(lab == SHIRT), bottom=ref(lab == SHORTS), shoes=ref(lab == SHOE))
json.dump(info, open('ref.json', 'w'), indent=1)
print(info)
