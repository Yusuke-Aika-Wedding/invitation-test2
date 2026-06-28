# 作業手順：GitHub Pages + GAS 結婚式Web招待状

## 0. 前提

- GitHubユーザー名：`Yusuke-Aika-Wedding`
- リポジトリ名：`invitation-test2`
- スプレッドシートID：`1micDJFsf6ktwZrq_tlIz9TiC4PjbBbv-7dlWgbhMjbs`
- スプレッドシート列：A〜L列を使用
- 招待状URL形式：`https://Yusuke-Aika-Wedding.github.io/invitation-test2/URL末尾/`

---

## 1. GitHubにアップロード

1. ZIPを解凍します。
2. 中にある `invitation-test2` フォルダを開きます。
3. GitHubで `Yusuke-Aika-Wedding` アカウントにログインします。
4. `invitation-test2` というリポジトリを作成します。
5. リポジトリのトップに、`invitation-test2` フォルダの中身をすべてアップロードします。
   - `index.html` がリポジトリ直下に来るようにしてください。
   - `invitation-test2/index.html` のように1階層深くならないよう注意してください。
6. `Settings` → `Pages` を開きます。
7. `Build and deployment` の `Source` を `Deploy from a branch` にします。
8. `Branch` を `main`、フォルダを `/root` にして `Save` します。
9. 数分待つと、サイトURLが使えるようになります。

例：

```text
https://Yusuke-Aika-Wedding.github.io/invitation-test2/sfm549Eys/
```

---

## 2. Google Apps Scriptを作成

1. 対象のGoogleスプレッドシートを開きます。
2. `拡張機能` → `Apps Script` を開きます。
3. `コード.gs` に、`gas/Code.gs` の全文を貼り付けます。
4. 左側の歯車アイコン `プロジェクトの設定` を開きます。
5. `appsscript.json マニフェスト ファイルをエディタで表示する` をオンにします。
6. 左側に出た `appsscript.json` に、`gas/appsscript.json` の全文を貼り付けます。
7. 保存します。

---

## 3. GASの初期設定を実行

1. Apps Script画面上部の関数選択で `setup` を選びます。
2. `実行` を押します。
3. 初回は権限承認が出るので、Googleアカウントを選びます。
4. `このアプリはGoogleで確認されていません` と出た場合は、`詳細` → `安全ではないページに移動` を選びます。
5. 許可します。

`setup` を実行すると、次が自動で行われます。

- A〜L列の見出しを整える
- L列に招待状URLを入れる
- D列・E列に「出席／欠席」のプルダウンを設定
- 1週間前・前日リマインド用の毎日8時トリガーを作成

---

## 4. GASをWebアプリとしてデプロイ

1. Apps Script右上の `デプロイ` → `新しいデプロイ` を押します。
2. 種類の選択で `ウェブアプリ` を選びます。
3. 説明は `Wedding Invitation API` などでOKです。
4. `次のユーザーとして実行`：`自分`
5. `アクセスできるユーザー`：`全員`
6. `デプロイ` を押します。
7. 表示された `ウェブアプリURL` をコピーします。

---

## 5. GitHub側にGAS URLを貼る

1. GitHubのリポジトリで `js/config.js` を開きます。
2. 鉛筆アイコンで編集します。
3. 次の部分を、コピーしたGASのWebアプリURLに置き換えます。

```js
gasWebAppUrl: "PASTE_YOUR_GAS_WEB_APP_URL_HERE"
```

例：

```js
gasWebAppUrl: "https://script.google.com/macros/s/xxxxxxxxxxxxxxxxxxxxxxxx/exec"
```

4. `Commit changes` します。
5. 1〜3分ほど待って反映を確認します。

---

## 6. 動作確認

### 6-1. 表示確認

`docs/URL_LIST.csv` にあるURLを1つ開きます。

確認すること：

- 最初にメッセージページが出る
- タップすると招待状ページが開く
- カウントダウンが秒単位で動く
- Googleマップが表示される
- RSVPフォームが表示される

### 6-2. 送信確認

1. テスト用ゲストURLを開きます。
2. 氏名・メール・挙式出欠・披露宴出欠・アレルギーを入力します。
3. `Send Reply` を押します。
4. スプレッドシートのC〜L列に内容が入るか確認します。
5. 入力したメールアドレスに確認メールが届くか確認します。
6. ページを再読み込みし、フォームが消えているか確認します。

---

## 7. リマインドメールの確認

Apps Scriptで次の関数を実行すると、テストとしてリマインドメールを送れます。

```text
testReminder7Days
```

```text
testReminder1Day
```

注意：

- テスト関数は、送信済み日時をスプレッドシートに書き込みません。
- 本番の自動送信は、`setup` が作成する毎日8時のトリガーで行われます。
- 挙式・披露宴の少なくとも一方が「出席」の人だけに送信されます。

---

## 8. 行き方動画の差し替え

`assets/access-placeholder.mp4` を、本番用動画に同じ名前で置き換えます。

推奨：

- 形式：mp4
- 長さ：30秒〜2分程度
- 容量：できれば50MB以下
- スマホで見やすい縦動画または横動画

ポスター画像を変える場合は、`assets/access-poster.jpg` も置き換えます。

---

## 9. ゲストを増やす場合

1. スプレッドシートのA列にURL末尾、B列にゲスト名を追加します。
2. GitHub側にも、そのURL末尾のフォルダを作ります。
3. 既存のゲストフォルダの `index.html` をコピーして、新しいフォルダに入れます。
4. コピーした `index.html` の次の2か所を変更します。
   - `data-guest-id`
   - `data-default-name`
   - `guestId` hidden inputのvalue
   - 氏名inputのvalue
5. Apps Scriptで `setup` を再実行します。

ゲストを頻繁に増やす予定がある場合は、次回、スプレッドシートからGitHub用フォルダを自動生成するGASまたはPythonも作れます。

---

## 10. よくあるエラー

### 送信できませんでした。GASのWebアプリURLが未設定です。

`js/config.js` の `gasWebAppUrl` が未設定です。

### ゲスト情報が見つかりません。

URL末尾とスプレッドシートA列が一致していません。

### 確認メールが届かない

- 迷惑メールを確認してください。
- Apps Scriptの実行権限を承認しているか確認してください。
- Apps Scriptの `実行数` 画面でエラー内容を確認してください。

### GitHub Pagesに反映されない

- `Settings` → `Pages` で公開設定を確認してください。
- 反映まで数分待ってください。
- ブラウザのキャッシュを消すか、シークレットウィンドウで確認してください。
