# 人形（マス）を素体に重ねる位置と大きさを探す：マスの肌が、素体の形の中に入るように
import cv2, numpy as np
BASE = cv2.imread('src/3692.png', cv2.IMREAD_UNCHANGED)
BA = BASE[..., 3] > 128
def skin(bgr):
    h = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    return (h[..., 0] >= 4) & (h[..., 0] <= 22) & (h[..., 1] >= 38) & (h[..., 1] <= 128) & (h[..., 2] >= 195)
BS = BA & skin(BASE[..., :3])
def match(C, s, region=None, ylock=None):
    """C：マスの肌（bool）。s：素体の縮め方。戻り値：score, (dx, dy) … マスの (0,0) が、縮めた素体のどこにあたるか"""
    B = cv2.resize(BA.astype(np.float32), None, fx=s, fy=s, interpolation=cv2.INTER_AREA)
    if region is not None: B = B * cv2.resize(region.astype(np.float32), (B.shape[1], B.shape[0]))
    h, w = C.shape; P = np.pad(B, ((h, h), (w, w)))
    T = C.astype(np.float32)
    inn = cv2.matchTemplate(P, T, cv2.TM_CCORR); out = cv2.matchTemplate(1 - P, T, cv2.TM_CCORR)
    sc = inn - 4 * out
    if ylock is not None:   # 足の下をそろえる（y は固定）
        y = int(round(ylock)); y = min(max(y, 0), sc.shape[0] - 1); row = sc[y]; x = int(np.argmax(row)); return row[x] / T.sum(), (x - w, y - h)
    y, x = np.unravel_index(np.argmax(sc), sc.shape)
    return sc[y, x] / T.sum(), (x - w, y - h)
def best(C, scales, **kw):
    r = max(((match(C, s, **kw), s) for s in scales), key=lambda t: t[0][0])
    return r[1], r[0][1], r[0][0]
_CACHE = {}
def _scaled(s, region):
    key = (round(s, 5), id(region))
    if key not in _CACHE:
        R = BA if region is None else region
        _CACHE[key] = cv2.resize(R.astype(np.float32), None, fx=s, fy=s, interpolation=cv2.INTER_AREA)
    return _CACHE[key]
def iou_match(C, s, region=None, ylock=None):
    """肌のかたちと、素体（region の部分だけ）の重なり（IoU）がいちばん大きい位置"""
    B = _scaled(s, region)
    h, w = C.shape; P = np.pad(B, ((h, h), (w, w))); T = C.astype(np.float32)
    inter = cv2.matchTemplate(P, T, cv2.TM_CCORR)
    bsum = cv2.matchTemplate(P, np.ones_like(T), cv2.TM_CCORR)
    # 素体がマスの外にはみ出る分も数える（マスの中の素体だけでなく、region 全体の面積）
    sc = inter / (B.sum() + T.sum() - inter + 1e-6)
    if ylock is not None:
        y = min(max(int(round(ylock)), 0), sc.shape[0] - 1); x = int(np.argmax(sc[y])); return sc[y, x], (x - w, y - h)
    y, x = np.unravel_index(np.argmax(sc), sc.shape); return sc[y, x], (x - w, y - h)
def iou_best(C, scales, **kw):
    r = max(((iou_match(C, s, **kw), s) for s in scales), key=lambda t: t[0][0])
    return r[1], r[0][1], r[0][0]
