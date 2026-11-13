# 切り出したパーツを、アバターのキャンバス（400×600。素体の位置は前と同じ）へ置く
#   身体：上の端（首）を 250、足の下を 572 に。頭：顔の肌の幅を FACE_W、あごを CHIN に。ペット：右上に浮かぶ
import cv2, numpy as np, os, sys, json
from PIL import Image
from scipy import ndimage as ndi
OUT = '/home/claude/igo-battle/img/av3/'; TH = '/home/claude/igo-battle/img/av3t/'
os.makedirs(OUT, exist_ok=True); os.makedirs(TH, exist_ok=True)
P = dict(NECK=300, FEET=622, FACE_W=150, CHIN=314, PET_H=118, PET_CX=372, PET_CY=250)
W, H = 460, 650
def faceskin(rgb):
    h = cv2.cvtColor(np.ascontiguousarray(rgb[..., ::-1]), cv2.COLOR_BGR2HSV).astype(int)
    return (h[..., 0] >= 4) & (h[..., 0] <= 24) & (h[..., 1] >= 14) & (h[..., 1] <= 110) & (h[..., 2] >= 215)
def put(rgba, s, tx, ty, name):
    im = rgba.astype(np.float32); im[..., :3] *= im[..., 3:4] / 255
    M = np.float32([[s, 0, tx], [0, s, ty]])
    o = cv2.warpAffine(im, M, (W, H), flags=cv2.INTER_AREA if s < 1 else cv2.INTER_CUBIC, borderValue=0)
    a = np.clip(o[..., 3], 0, 255); rgb = np.where(a[..., None] > 1, o[..., :3] / np.maximum(a[..., None], 1) * 255, 0)
    Image.fromarray(np.dstack([np.clip(rgb, 0, 255), a]).astype(np.uint8)).save(OUT + name + '.webp', quality=92, method=4)
def thumb(rgba, name):
    im = Image.fromarray(rgba); s = 150 / max(im.size); im = im.resize((int(im.width * s), int(im.height * s)), Image.LANCZOS)
    t = Image.new('RGBA', (160, 160)); t.alpha_composite(im, ((160 - im.width) // 2, (160 - im.height) // 2)); t.save(TH + name + '.webp', quality=85)
for k in range(8):
    b = np.asarray(Image.open(f'cut/body{k}.png')); a = b[..., 3] > 128; ys, xs = np.nonzero(a)
    s = (P['FEET'] - P['NECK']) / (ys.max() - ys.min())
    # 真ん中：足もとの左右のまん中
    fx = np.nonzero(a[ys.max() - 25:ys.max()].any(0))[0]; cx = (fx.min() + fx.max()) / 2
    put(b, s, 200 - cx * s, P['NECK'] - ys.min() * s, f'b{k:02d}'); thumb(b, f'b{k:02d}')
    h = np.asarray(Image.open(f'cut/head{k}.png')); S = faceskin(h[..., :3]) & (h[..., 3] > 200); S = ndi.binary_opening(S, iterations=2)
    lab, n = ndi.label(S); sz = ndi.sum(S, lab, range(1, n + 1)); F = lab == (np.argmax(sz) + 1); fy, fxs = np.nonzero(F)
    s = P['FACE_W'] / (fxs.max() - fxs.min()); cx = (fxs.min() + fxs.max()) / 2
    put(h, s, 200 - cx * s, P['CHIN'] - fy.max() * s, f'h{k:02d}'); thumb(h, f'h{k:02d}')
    p = np.asarray(Image.open(f'cut/pet{k}.png')); s = P['PET_H'] / p.shape[0]
    put(p, s, P['PET_CX'] - p.shape[1] * s / 2, P['PET_CY'] - p.shape[0] * s / 2, f'p{k:02d}'); thumb(p, f'p{k:02d}')
print('ok', P)
