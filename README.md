# AlgoBoard

LeetCode の Python 解答を、カテゴリ別に見返せるローカル Web アプリです。

## できること

- 問題番号、タイトル、タグで検索
- カテゴリと難易度で絞り込み
- 問題詳細、タグ、メモ、解答コードを 1 画面で確認
- Practice モードで答えを隠したまま自分で実装
- Solve モードで問題文を見ながら本番っぽく解く
- 下書きの自動保存と「書けた / あやしい」の自己評価
- 既存の `*.py` 解答ファイルからデータを自動生成
- 指定した LeetCode URL を各問題にひも付けて元問題を開ける

## セットアップ

1. サイト用データを生成します。

```bash
python generate_site.py
```

2. ローカルサーバーを起動します。

```bash
python -m http.server 8000
```

3. ブラウザで `http://localhost:8000` を開きます。

LeetCode の問題文を反映したいときは、ネット接続ありで次も実行します。

```bash
python sync_leetcode_meta.py
python generate_site.py
```

## Practice モード

`Mode` を `Practice` にすると、正解コードを隠した状態で自分で実装できます。

- 左側に自分用エディタ
- 最初の `class` / `def` シグネチャは見える
- 右側は「答えを見る」まで非表示
- 下書きはブラウザに自動保存
- 練習後に `あやしい` / `書けた` を記録
- `Random` でランダムな問題へ移動

## Solve モード

`Mode` を `Solve` にすると、問題文を見ながら自分で解く画面になります。

- 問題文、例、制約を上から順に表示
- 解答欄は Practice とは別に保存
- 最後にだけ参考解答を表示可能
- `Open LeetCode` ですぐ元問題を開ける

`problems_meta.json` に `statement` `examples` `constraints` を追加すると、問題文を表示できます。

## メタデータの編集

`problems_meta.json` を編集すると、タイトル、難易度、タグ、メモを追加できます。

```json
"121": {
  "title": "Best Time to Buy and Sell Stock",
  "difficulty": "Easy",
  "tags": ["Dynamic Programming", "Array"],
  "notes": "最安値を更新しながら最大利益を追う",
  "statement": "You are given an array prices where prices[i] is the price of a given stock on the ith day.",
  "examples": [
    "Input: prices = [7,1,5,3,6,4]\\nOutput: 5",
    "Input: prices = [7,6,4,3,1]\\nOutput: 0"
  ],
  "constraints": [
    "1 <= prices.length <= 10^5",
    "0 <= prices[i] <= 10^4"
  ]
}
```

## ディレクトリ構成

- `generate_site.py`: 問題データ生成スクリプト
- `sync_leetcode_meta.py`: LeetCode から問題文を同期
- `problems_meta.json`: 問題メタデータ
- `problem_urls.json`: 問題番号と LeetCode URL の対応表
- `index.html`: ローカルアプリ本体
- `assets/`: UI スタイルとクライアントスクリプト
- `data/problems.json`: 生成される問題データ
