# 囲碁BLITZ

9路・13路の対局アプリ（ウェブ版）。最終的にはAndroidアプリとしてリリースする予定。
公開先：`https://igo-battle.<サブドメイン>.workers.dev`（Cloudflare Workers）

## ファイルの地図

### アプリ（ブラウザ）— ビルドなし。`index.html` が下のファイルをそのまま読みこむ

| ファイル | 中身 |
| --- | --- |
| `index.html` | 画面の骨組み（すべての画面が入っていて、`hidden` で切りかえる） |
| `css/*.css` | 見た目。機能ごとに11ファイル（`base` → `home` → `solo` → `game` → `settings` → `room` → `avatar` → `shop` → `social` → `guild` → `mail` の順に読む。あとのほうが優先） |
| `common/util.js` | 共通の小さな道具（`U.$` `U.esc` など）。いちばん先に読む |
| `config.js` | 接続先のサーバー（Cloudflare 以外で開くとき） |
| `app.js` | 中心：保存データ・画面の切りかえ・対局・サーバーとのやりとり・設定 |
| `engine.js` | 囲碁のルールと Bot（Web Worker でも動く） |
| `art.js` / `fx.js` | キャラクター・背景・演出 / プレゼントボックス・BGM |
| `solo.js` `stories.js` `scripts.js` `story_*.js` `lessons.js` `drills.js` `episodes.js` `tsume.js` | ソロモード（物語・レクチャー・ドリル） |
| `room.js` `room-lines.js` | マイルーム（碁会所の部屋も同じしくみ） |
| `shop.js` | ショップ（服・部屋・骨董屋・碁会所ショップ） |
| `friend.js` `diary.js` | フレンドマッチ・囲碁日記 |
| `common/` | ほかのゲームとも共有する部分（アバター・部屋の絵・交流・碁会所・メッセージ・通報・運営・チュートリアル・同意と年齢確認） |
| `terms.html` `privacy.html` `help.html` `delete.html` | 利用規約・プライバシーポリシー・ヘルプ・アカウント削除の申請 |

### サーバー（`server/`）— Cloudflare Workers ＋ Durable Objects。時計・盤面・勝ち負け・銭は**サーバーが正**

| ファイル | 中身 |
| --- | --- |
| `core.js` | 中心：接続・送りすぎ対策・メッセージのふりわけ・アカウントの順番待ち |
| `account.js` | アカウント（作る・入る・保存・削除。ログイン失敗の回数制限） |
| `match.js` | 対局（マッチング・手と時計の中継・ルールの確認・整地の数えなおし・無効試合） |
| `gorules.js` | 囲碁のルール（打てる点・取る・コウ・置き石・地の数え方） |
| `rating.js` | レート・段級位・昇格のごほうび |
| `econ.js` / `prices.js` | 銭・勾玉・持ち物・部屋・プレゼント・お店 / 家具の値段 |
| `social.js` `guild.js` `mail.js` `admin.js` | 交流 / 碁会所 / メッセージ / 運営 |
| `ng.js` `age.js` | 使えない言葉 / 年齢（15歳以下の制限） |
| `worker.js` / `dev.mjs` | Cloudflare の入口 / 手元で動かす用 |

## 手元で動かす・確かめる

```
npm install          # はじめの1回（テスト用の道具）
npm run dev          # http://localhost:8787 で、アプリとサーバーがまとめて動く
npm run lint         # コードの書きまちがいチェック（警告も0にする）
npm test             # サーバーのテスト（ルール・アカウント・対局・碁会所・上限・交流・保管期間）
npm run test:e2e     # ブラウザのテスト（起動・対局・碁会所・買い物・削除・全画面）
```

- テストは `test/server/*.test.mjs`（サーバー）と `test/e2e/*.test.mjs`（ブラウザ）。共通の道具は `test/helpers.mjs`
- CSS を並べかえたり分けたりしたら：`node test/tools/css-order-check.mjs 前のCSS 新しいCSS…` で、見た目が変わる組がないか確かめる

## 公開のしかた

`main` に push すると、GitHub Actions が **コードチェック → サーバーのテスト → ブラウザのテスト** をして、全部通ったときだけ Cloudflare に公開する（`.github/workflows/deploy.yml`）。テストが失敗したら公開されず、前のものが動き続ける。

### はじめての公開（1回だけ）

1. Cloudflare →「My Profile」→「API Tokens」→「Create Token」→「Edit Cloudflare Workers」の「Use template」
2. 「Zone Resources」の「Specific zone」を「All zones」に変える →「Create Token」→ トークンをコピー
3. GitHub の igo-battle →「Settings」→「Secrets and variables」→「Actions」で2つ登録
   - `CLOUDFLARE_API_TOKEN` … 2 のトークン
   - `CLOUDFLARE_ACCOUNT_ID` … Cloudflare の「Workers & Pages」の Account ID
   - `ADMIN_KEY` … 運営画面の合言葉（長めの、ほかで使っていない文。公開のたびに Cloudflare の秘密の設定へうつる）
4. GitHub の「Actions」→「Test and Deploy」→「Run workflow」

## 決まりごと（サーバー）

- デイリーミッション（`server/missions.js`）：5局・アタリ100・ケイマ100・一間トビ100・大ゲイマ100。各50銭、全部で＋100銭。形はサーバーが対局の手順を並べなおして数える
- 初心者の保護：はじめの10局は負けてもレートが下がらない。マッチングはレート差200から、待つほど広げる（20秒で600）
- 上限：1部屋の家具 99個・同じ家具 99個・部屋 20・全部の部屋で 600個
- 保管期間：書きこみ・メッセージの写しと通報は1年で自動削除
- 連投：一言 30秒・掲示板の投稿 1時間・コメント 10分に1回
- 15歳以下：メッセージ・掲示板・コメント・一言は使えない。碁会所は kids碁会所だけ
- 運営画面：部屋番号 561149 ＋ 合言葉（`ADMIN_KEY`）の二重ロック。合言葉は12時間有効・5回まちがえると1時間ロック・入った記録（時刻・IP）を残す。`ADMIN_KEY` がなければだれも開けない
- 整地：両方のアプリから死に石だけを受けとり、サーバーが数えなおす。食いちがったら無効試合（レートは動かない）

## ほかのゲーム（将棋・オセロなど）と共有するもの

アカウント・銭・アバター・マイルーム・フレンド・日記・碁会所・メッセージは全ゲーム共通（`common/` と `server/`）。レート・戦績・棋譜・勾玉・キャラクター・ソロモードはゲームごと。
新しいゲームは、同じ Worker に同じメッセージ（`soc` `guild` `mail` `buy` など）を送れば、同じアバターと部屋が使える。
