# 新しい素体の足を、前の素体の足と同じ位置まで少しずつ外へ広げる（靴が前の足の位置に合わせてあるため）
#   股より下（Y0）から足の下まで、左足は左へ・右足は右へ、下に行くほど大きく動かす
import numpy as np, cv2
from PIL import Image
D = {'girl': (17, 15), 'boy': (27, 27)}      # 足の下での動かす量（左・右）
Y0, Y1 = 575, 760
for b, (dl, dr) in D.items():
    im = np.asarray(Image.open(f'{b}_body.png').convert('RGBA')).astype(np.float32)
    H, W = im.shape[:2]; yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    k = np.clip((yy - Y0) / (Y1 - Y0), 0, 1); k = k * k * (3 - 2 * k)       # なめらかに
    dx = np.where(xx < 160, -dl * k, dr * k)
    src_x = xx - dx
    # 真ん中で左右がまざらないように：左の画素は左半分からだけ、右は右半分からだけ
    src_x = np.where(xx < 160, np.minimum(src_x, 159.5), np.maximum(src_x, 160.5))
    out = cv2.remap(im, src_x, yy, cv2.INTER_LINEAR, borderValue=0)
    Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).save(f'/home/claude/igo-battle/img/avatar/{b}_body.png')
    print(b, 'ok')
