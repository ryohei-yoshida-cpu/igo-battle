import cv2, numpy as np, sys
kind = sys.argv[1]; out = sys.argv[2]; T = 120
tiles = []
import json; N = len(json.load(open(f'{kind}_cells.json')))
for k in range(N):
    im = cv2.imread(f'{kind}_{k:03d}.png', cv2.IMREAD_UNCHANGED)
    tile = np.full((T + 16, T, 3), 200, np.uint8)
    if im is not None:
        h, w = im.shape[:2]; s = min((T - 4) / w, (T - 4) / h); im = cv2.resize(im, (max(1, int(w * s)), max(1, int(h * s))), interpolation=cv2.INTER_AREA)
        h, w = im.shape[:2]; y0 = (T - h) // 2; x0 = (T - w) // 2
        a = im[..., 3:4] / 255.0; reg = tile[y0:y0 + h, x0:x0 + w]
        tile[y0:y0 + h, x0:x0 + w] = (im[..., :3] * a + reg * (1 - a)).astype(np.uint8)
    cv2.putText(tile, str(k), (3, T + 12), cv2.FONT_HERSHEY_SIMPLEX, .4, (0, 0, 160), 1)
    tiles.append(tile)
C = 13 if kind == 'bottom' else 10
tiles += [np.full_like(tiles[0], 200)] * (-len(tiles) % C)
rows = [np.concatenate(tiles[r * C:(r + 1) * C], 1) for r in range(len(tiles) // C)]
cv2.imwrite(out, np.concatenate(rows, 0))
