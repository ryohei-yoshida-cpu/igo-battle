import numpy as np, cv2
from scipy import ndimage as ndi
def faceskin(img):
    h = cv2.cvtColor(img, cv2.COLOR_BGR2HSV).astype(int)
    return (h[..., 0] >= 5) & (h[..., 0] <= 24) & (h[..., 1] >= 18) & (h[..., 1] <= 110) & (h[..., 2] >= 205)
def eyes(c):
    S = faceskin(c['img']) & c['m']; H = S.shape[0]
    S2 = ndi.binary_opening(S)
    lab, n = ndi.label(S2); best = None
    for i in range(1, n + 1):
        yy, xx = np.nonzero(lab == i)
        if len(yy) < 60 or yy.min() > .55 * H: continue
        if best is None or yy.min() < best[2] - 5 or (abs(yy.min() - best[2]) <= 5 and len(yy) > best[1]): best = (i, len(yy), yy.min())
    if not best: return None
    F = lab == best[0]
    Ff = ndi.binary_fill_holes(ndi.binary_closing(F, iterations=3))
    holes = Ff & ~ndi.binary_closing(F, iterations=1)
    ys, xs = np.nonzero(Ff); fy0, fy1 = ys.min(), ys.max()
    l2, n2 = ndi.label(holes); blobs = []
    for i in range(1, n2 + 1):
        yy, xx = np.nonzero(l2 == i)
        if len(yy) < 6 or yy.mean() > fy0 + .8 * (fy1 - fy0): continue
        blobs.append((len(yy), yy.mean(), xx.mean()))
    blobs.sort(reverse=True); fw = xs.max() - xs.min()
    for a in range(min(4, len(blobs))):
        for b in range(a + 1, min(5, len(blobs))):
            A, B = blobs[a], blobs[b]
            if abs(A[1] - B[1]) < 4 and .25 * fw < abs(A[2] - B[2]) < .8 * fw and min(A[0], B[0]) > .35 * max(A[0], B[0]):
                L, R = sorted([A, B], key=lambda t: t[2])
                return np.array([L[2], L[1]]), np.array([R[2], R[1]])
    return None
if __name__ == '__main__':
    import pickle
    for n in ['3694', '3695', '3697']:
        try: cs = pickle.load(open(f'cells_{n}.pkl', 'rb'))
        except Exception: continue
        ok = 0; ds = []
        for c in cs:
            if c is None: continue
            e = eyes(c)
            if e: ok += 1; ds.append(np.linalg.norm(e[1] - e[0]))
        print(n, 'found', ok, 'of', sum(c is not None for c in cs), 'dist med', np.median(ds), np.percentile(ds, [10, 90]))
