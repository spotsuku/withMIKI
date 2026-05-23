# WithMIKI パーソナルカルテ

鍼灸・統合医療向けのブラウザ完結型パーソナルカルテアプリです。問診・施術記録（SOAP）・部位マーキング・画像/動画添付・AIアシスタント・来院履歴を1ファイルで管理できます。サーバー不要で、データは端末のブラウザ内（localStorage）に保存されます。

## 主な機能

- **問診・基本情報** — 基本情報の入力、既往歴チェックリスト、紙カルテ/問診票の写メをAIで読み取って自動入力
- **施術記録** — 処置内容のチェック、傷害・障害記録、SOAP記録、取穴・施術詳細
- **部位マーキング** — 前面/背面の人体図に色分けして治療部位をマーキング（タッチ操作対応）
- **画像・動画** — レントゲン・エコー・動作動画などの添付
- **AIアシスタント** — SOAP文章化、取穴提案、患者説明文作成などをサポート
- **来院履歴** — 過去の施術記録を一覧・呼び出し
- **データ出力** — カルテ内容をJSONファイルでエクスポート

## 使い方

1. このリポジトリをクローン、またはZIPでダウンロード
2. `index.html` をブラウザで開くだけで動作します（ビルド不要）

```bash
git clone https://github.com/<your-account>/<your-repo>.git
cd <your-repo>
open index.html   # Windows は start index.html
```

## GitHub Pages で公開する

1. リポジトリの **Settings** → **Pages** を開く
2. **Source** を `Deploy from a branch` に設定
3. Branch を `main`（または `master`）、フォルダを `/ (root)` に指定して **Save**
4. 数分後に `https://<your-account>.github.io/<your-repo>/` で公開されます

## AI機能について

AIアシスタントと写メ読み取り機能は、Claude in Artifacts のAPI連携を前提に実装されています。Claude.ai のアーティファクト環境では追加設定なしで動作しますが、GitHub Pages 等の外部環境では認証付きのAPIエンドポイントが必要になる場合があります。AI機能を外部で利用する場合は、ご自身のバックエンド経由でAnthropic APIを呼び出すよう `index.html` 内の `fetch` 部分を差し替えてください。

## データの保存場所と注意

- データはブラウザの `localStorage` に保存されます。**サーバーには送信されません**
- ブラウザのキャッシュ削除や別端末では、データは引き継がれません
- 重要なデータは「出力」ボタンから定期的にJSONバックアップを取得してください
- 患者の個人情報・医療情報を扱うため、共有端末での利用や公開環境への実データ入力は避けてください

## 技術構成

- 単一HTMLファイル（HTML + CSS + Vanilla JavaScript）
- 外部依存：Google Fonts（Noto Serif JP / Noto Sans JP）のみ
- データ永続化：ブラウザ localStorage
- レスポンシブ対応（スマホ・タブレット・PC）

## ライセンス

MIT License（`LICENSE` を参照）
