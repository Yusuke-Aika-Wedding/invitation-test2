# Yusuke & Aika Wedding Invitation / invitation-test2

GitHub Pages + Google Apps Script + Google スプレッドシートで動く、ゲスト専用URLつきの結婚式Web招待状です。

## できること

- ゲストごとの専用URLを自動生成済み（`docs/URL_LIST.csv`）
- URL末尾はスプレッドシートA列の値を使用
- 初回表示時に、新郎新婦メッセージページを表示
- メッセージタップで招待状ページを表示
- 2027年3月21日 10:00までの秒単位カウントダウン
- 挙式・披露宴それぞれの出欠、氏名、メール、アレルギーを送信
- 回答内容をスプレッドシートC〜L列へ反映
- 回答確認メールを自動送信
- 1週間前・前日リマインドメールを自動送信
- 回答済みゲストはフォーム非表示

## ファイル構成

```text
invitation-test2/
├── index.html
├── 404.html
├── robots.txt
├── assets/
│   ├── message-bg.jpg
│   ├── hero-outdoor.jpg
│   ├── access-placeholder.mp4
│   ├── access-poster.jpg
│   └── favicon.svg
├── css/style.css
├── js/config.js
├── js/script.js
├── gas/
│   ├── Code.gs
│   └── appsscript.json
├── docs/
│   ├── SETUP_GUIDE.md
│   └── URL_LIST.csv
└── 各ゲストURL末尾/index.html
```

## まず編集する場所

### 1. GASのデプロイURL

`js/config.js` のここを、GASのWebアプリURLに置き換えます。

```js
gasWebAppUrl: "PASTE_YOUR_GAS_WEB_APP_URL_HERE"
```

### 2. 行き方動画

仮動画を本番動画に差し替える場合は、次のファイルを同じ名前で置き換えてください。

```text
assets/access-placeholder.mp4
```

## 詳しい手順

`docs/SETUP_GUIDE.md` を見てください。
