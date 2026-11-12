アバターのパーツ切りぬき（元画像 src.jpg → img/avatar/*.png）
  cd tools/avatar-cut && python3 layers.py && python3 post.py
必要：python3, numpy, scipy, opencv

顔パターン（faces.png = 3664.png）：python3 cut.py && python3 make.py（faces.png を src.png として読む）
