import cv2, numpy as np, pickle, json, sys
from register import BA
n, nc, ks = sys.argv[1], int(sys.argv[2]), [int(k) for k in sys.argv[3].split(',')]
cs = pickle.load(open(f'cells_{n}.pkl', 'rb')); reg = json.load(open(f'reg_{n}.json'))
tiles = []
edge = cv2.Canny(BA.astype(np.uint8) * 255, 50, 150) > 0
for k in ks:
    c = cs[k]; r = reg[str(k)]; s = r['s']; d = r['d']; U = 6
    img = cv2.resize(c['img'], None, fx=U, fy=U, interpolation=cv2.INTER_NEAREST)
    # 素体のりんかくを、マスの座標へ：cell = base*s - d
    ys, xs = np.nonzero(edge)
    cx = ((xs * s - d[0]) * U).astype(int); cy = ((ys * s - d[1]) * U).astype(int)
    ok = (cx >= 0) & (cy >= 0) & (cx < img.shape[1]) & (cy < img.shape[0])
    img[cy[ok], cx[ok]] = (0, 0, 255)
    t = np.full((720, 520, 3), 255, np.uint8); h, w = img.shape[:2]; t[:min(h, 720), :min(w, 520)] = img[:720, :520]; tiles.append(t)
cv2.imwrite(sys.argv[4], np.concatenate(tiles, 1))
