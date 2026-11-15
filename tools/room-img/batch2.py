# 2つ目の家具セット（ゲーム・動物・洋館・おもしろ・姫）：目で測った傾きで角度をそろえる。None はそのまま（丸いもの・動物）
import cv2, numpy as np, os, shutil, json
from PIL import Image
T = {  # src: (id, 名前, style, w, d, 値段段階, (sL, sR) or None)
 'g100': ('chess_box', 'チェス盤', 'yo', 1, 1, 200, (.31, -.65)),
 'g101': ('backgammon', 'バックギャモン', 'yo', 1, 1, 200, (.33, -.92)),
 'g102': ('goban_set', '卓上碁盤セット', 'wa', 2, 2, 300, (.47, -.70)),
 'g103': ('poker_table', 'ポーカーテーブル', 'fun', 2, 2, 300, (.29, -.65)),
 'g104': ('roulette', 'ルーレット', 'fun', 2, 2, 300, None),
 'g105': ('ludo', 'ルドー', 'fun', 1, 1, 100, (.61, -1.24)),
 'g107': ('block_tower', '積み木タワー', 'fun', 1, 1, 100, (.30, -.55)),
 'g200': ('pet_cat', '子ねこ', 'fun', 1, 1, 200, None),
 'g201': ('pet_corgi', 'コーギー', 'fun', 1, 1, 200, None),
 'g202': ('pet_rabbit', 'うさぎ', 'fun', 1, 1, 200, None),
 'g203': ('pet_inko', 'インコ', 'fun', 1, 1, 200, None),
 'g204': ('pet_deer', '子じか', 'fun', 1, 1, 200, None),
 'g205': ('pet_redpanda', 'レッサーパンダ', 'fun', 1, 1, 200, None),
 'g206': ('pet_hedgehog', 'ハリネズミ', 'fun', 1, 1, 200, None),
 'g207': ('pet_owl', 'シロフクロウ', 'fun', 1, 1, 200, None),
 'g302': ('library_shelf', '書庫の本棚', 'yo', 2, 1, 300, (.27, -.65)),
 'g306': ('aquarium', '大きな水槽', 'yo', 2, 1, 400, (.19, -.82)),
 'g400': ('teacup_bath', 'ティーカップ風呂', 'fun', 2, 2, 400, None),
 'g401': ('burger_bed', 'ハンバーガーベッド', 'fun', 2, 2, 400, None),
 'g402': ('cat_tent', 'ねこテント', 'fun', 2, 2, 300, None),
 'g404': ('crane_game', 'クレーンゲーム', 'fun', 1, 1, 400, (.34, -.55)),
 'g406': ('ufo', 'UFO', 'fun', 2, 2, 400, None),
 'g407': ('carousel', 'メリーゴーランド', 'fun', 2, 2, 400, None),
 'g503': ('hime_wardrobe', '姫のワードローブ', 'yo', 2, 1, 300, (.12, -.75)),
 'g504': ('hime_desk', '姫の書き物机', 'yo', 2, 1, 300, (.22, -.71)),
 'g505': ('hime_roundtable', '丸いティーテーブル', 'yo', 2, 2, 200, None),
 'g506': ('hime_shelf', '姫の本棚', 'yo', 2, 1, 300, (.12, -.60)),
 'g508': ('hime_clock', '振り子の大時計', 'yo', 1, 1, 300, (.30, -.55)),
 'g510': ('hime_chest', '姫のチェスト', 'yo', 2, 1, 200, (.15, -.70)),
 'g511': ('hime_lamp', '姫のフロアランプ', 'yo', 1, 1, 200, None),
 'g514': ('hime_table', '姫のティーテーブル', 'yo', 2, 1, 200, (.24, -.85)),
}
os.makedirs('tools/room-img/cut7', exist_ok=True)
for src, (k, *_ , sl) in T.items():
    im = cv2.imread(f'tools/room-img/cut6/{src}.png', cv2.IMREAD_UNCHANGED)
    if sl:
        sL, sR = sl; d = 1 / (sL - sR); c = .5 - d * sL; H, W = im.shape[:2]
        M = np.float32([[1, 0, 0], [c, d, max(0, -c * W)]])
        im = cv2.warpAffine(im, M, (W, int(np.ceil(d * H + abs(c) * W)) + 2), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_CONSTANT, borderValue=(0, 0, 0, 0))
        ys, xs = np.nonzero(im[..., 3] > 8); im = im[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    h, w = im.shape[:2]; s = min(1, 480 / max(h, w))
    if s < 1: im = cv2.resize(im, (round(w * s), round(h * s)), interpolation=cv2.INTER_AREA)
    cv2.imwrite(f'tools/room-img/cut7/{k}.png', im)
items = [v for v in T.values()]
lines = ',\n'.join(f"    {{ id: '{k}', name: '{n}', style: '{st}', kind: 'floor', w: {w}, d: {d}, price: {p}, draw() {{}} }}" for k, n, st, w, d, p, _ in items)
s = open('common/room-items-pics.js').read()
s = s.replace('\n  ];\n})', ',\n    /* 2つ目のセット（ゲーム・動物・洋館・おもしろ・姫） */\n' + lines + '\n  ];\n})', 1)
open('common/room-items-pics.js', 'w').write(s)
print(len(items))
