# 「ぱっちり」の顔を短い髪で使うとき用：男の子の顔（輪郭・耳・おでこがきれい）に、女の子の目（まつげつき）をはめる
import cv2, numpy as np
from scipy import ndimage as ndi
D = '/home/claude/igo-battle/img/avatar/'
g = cv2.imread(D + 'girl_face.png', cv2.IMREAD_UNCHANGED)
b = cv2.imread(D + 'boy_face.png', cv2.IMREAD_UNCHANGED)
h, w = g.shape[:2]
ys = np.arange(h)[:, None].repeat(w, 1); xs = np.arange(w)[None, :].repeat(h, 0)
skin = np.median(b[(b[..., 3] > 250) & (ys > 205) & (ys < 215) & (np.abs(xs - 158) < 12)][:, :3].astype(np.float32), 0)
def eye_blob(img, x0, x1):
    box = (xs >= x0) & (xs <= x1) & (ys >= 156) & (ys <= 206)
    m = box & (img[..., 3] > 200) & (np.abs(img[..., :3].astype(np.float32) - skin).sum(2) > 60)
    cl, n = ndi.label(ndi.binary_dilation(m, iterations=2))
    sizes = ndi.sum(m, cl, range(1, n + 1))
    return m & (cl == (np.argmax(sizes) + 1))
out = b.copy()
rgb = np.ascontiguousarray(out[..., :3])
for (x0, x1) in [(90, 146), (168, 228)]:
    old = ndi.binary_dilation(eye_blob(b, x0, x1), iterations=4)
    rgb = cv2.inpaint(rgb, old.astype(np.uint8), 6, cv2.INPAINT_TELEA)   # 男の子の目を、まわりの肌でうめる
out[..., :3] = rgb
o = out.astype(np.float32)
for (x0, x1) in [(90, 146), (168, 228)]:
    cx = (x0 + x1) / 2
    ell = ((xs - cx) / 23.5) ** 2 + ((ys - 182) / 19) ** 2 <= 1      # 目のまわりのだ円の中だけ
    m = ndi.binary_dilation(eye_blob(g, x0, x1) & ell, iterations=1) & ell
    ma = cv2.GaussianBlur(m.astype(np.float32), (3, 3), 0.7)[..., None]
    o[..., :3] = o[..., :3] * (1 - ma) + g[..., :3].astype(np.float32) * ma
cv2.imwrite(D + 'girl2_face.png', np.clip(o, 0, 255).astype(np.uint8), [cv2.IMWRITE_PNG_COMPRESSION, 9])

# 首を上に少しのばす（ほかの顔と組み合わせたとき、あごの下にすきまが出ないように）
for n in ['girl_body', 'boy_body']:
    im = cv2.imread(D + n + '.png', cv2.IMREAD_UNCHANGED)
    col = np.abs(np.arange(w) - 157.5) < 17
    rows = [y for y in range(200, 320) if (im[y, col, 3] > 250).sum() >= col.sum() - 2]
    if rows:
        top = rows[0] + 2
        src = im[top, col].copy()
        for y in range(top - 14, top): im[y, col] = src
        xs1 = np.arange(w)
        for y in range(0, top + 8): im[y, np.abs(xs1 - 157.5) >= 19] = 0   # あごの線の切れはしを消す
    cv2.imwrite(D + n + '.png', im, [cv2.IMWRITE_PNG_COMPRESSION, 9])
