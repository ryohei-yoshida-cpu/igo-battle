# パーツごとの合わせ方：頭は頭、体は体で合わせる（シートの人形は素体より頭が大きめ・足が短めのため）
import numpy as np, pickle, json
from scipy import ndimage as ndi
from register import BA, iou_match, skin
from common import NECK
Y = np.arange(BA.shape[0])[:, None]
HEADR = BA & (Y < NECK); BODYR = BA & (Y > NECK + 60); LOWR = BA & (Y > 820)
HC = np.array([423.0, 263.0]); NC = np.array([423.0, float(NECK)])   # 素体の頭の中心・首
def sk(c): return ndi.binary_opening(skin(c['img']) & c['m'])
def best(C, reg, scales):
    r = max(((iou_match(C, s, region=reg), s) for s in scales), key=lambda t: t[0][0]); return r[1], np.array(r[0][1], float), r[0][0]
def fit_head(c, scales=np.arange(.045, .080, .0005)):
    S = sk(c); ys = np.nonzero(S.any(1))[0]; C = S.copy(); C[ys.min() + int(.42 * (ys.max() - ys.min())):] = False
    return best(C, HEADR, scales)
def fit_body(c, s_head=None, d_head=None, scales=np.arange(.040, .075, .0005), low=False):
    S = sk(c)
    if low:
        ys = np.nonzero(S.any(1))[0]; C = S.copy(); C[:ys.max() - int(.42 * (ys.max() - ys.min()))] = False; reg = LOWR
    else:
        ny = int(NECK * s_head - d_head[1]) + 4; C = S.copy(); C[:ny] = False; reg = BODYR
    return best(C, reg, scales)
def per_row(vals, nc):
    rows = {}
    for k, v in vals.items(): rows.setdefault(k // nc, []).append(v)
    return {r: float(np.median(v)) for r, v in rows.items()}
if __name__ == '__main__':
    cs = pickle.load(open('cells_3696.pkl', 'rb'))
    R = {}
    for c in cs:
        if c is None: continue
        sh, dh, _ = fit_head(c); sb, db, _ = fit_body(c, sh, dh)
        sl, dl, _ = fit_body(c, low=True)
        R[c['k']] = dict(sh=sh, dh=dh.tolist(), sb=sb, db=db.tolist(), sl=sl, dl=dl.tolist())
    r_hb = np.median([v['sh'] / v['sb'] for v in R.values()])
    r_lb = np.median([v['sl'] / v['sb'] for v in R.values()])
    # 頭の中心（マス）－ 首（体の合わせ方での位置） を、体の大きさで割ったもの
    vv = np.median([((HC * v['sh'] - v['dh']) - (NC * v['sb'] - v['db'])) / v['sb'] for v in R.values()], axis=0)
    # 足（下半身の合わせ方）→ 体：体の首の位置 − 下半身での首の位置
    ww = np.median([((NC * v['sb'] - v['db']) - (NC * v['sl'] - v['dl'])) / v['sb'] for v in R.values()], axis=0)
    rel = dict(r_hb=float(r_hb), r_lb=float(r_lb), v=vv.tolist(), w=ww.tolist())
    json.dump(rel, open('rel.json', 'w')); print(rel)
    print('sh/sb spread', np.round(np.percentile([v['sh'] / v['sb'] for v in R.values()], [10, 50, 90]), 3))
