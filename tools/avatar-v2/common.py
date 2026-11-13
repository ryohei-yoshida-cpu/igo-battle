import cv2, numpy as np
from PIL import Image
from scipy import ndimage as ndi
from register import BA, BS, BASE, skin
W, H = 400, 600
K = 460 / 1497
BX, BY, CX, CY = 423.5, 17, 200, 110      # 素体の (中心x, 頭の上) → キャンバスの (200, 110)。上は帽子・耳のぶんあける
NECK = 505                                # 素体の首（これより上が頭）
OUT = '/home/claude/igo-battle/img/av2/'
def to_canvas(s, d):
    """マスの座標 → キャンバス。base = (cell + d) / s"""
    a = K / s
    return np.float32([[a, 0, (d[0] / s - BX) * K + CX], [0, a, (d[1] / s - BY) * K + CY]])
def warp(bgr, alpha, M, size=(W, H)):
    rgba = np.dstack([bgr[..., ::-1].astype(np.float32) * (alpha[..., None] / 255.0), alpha.astype(np.float32)])
    out = cv2.warpAffine(rgba, M, size, flags=cv2.INTER_CUBIC, borderValue=0)
    al = np.clip(out[..., 3], 0, 255); rgb = np.where(al[..., None] > 1, out[..., :3] / np.maximum(al[..., None], 1) * 255, 0)
    return np.dstack([np.clip(rgb, 0, 255), al]).astype(np.uint8)
def soft(mask):
    return (cv2.GaussianBlur(mask.astype(np.float32), (3, 3), .6) * 255)
def thick(mask, it=1):
    """細い線（体のりんかく線など）を消して、太いところだけ。消えたふちは1画素だけもどす"""
    o = ndi.binary_opening(mask, structure=np.ones((3, 3)), iterations=it)
    return ndi.binary_dilation(o, iterations=it) & mask
def save(img, name):
    Image.fromarray(img).save(OUT + name + '.webp', quality=90, method=4)
