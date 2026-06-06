# 共同開発ガイド（お父様 × 息子さん）

WithMIKI は次の分担で進めます。

- **お父様（三木裕昭）= 設計・プロトタイプ**
  自分のスマホ等の **Claude チャット**で、機能のたたき台 HTML を作成（現行 `legacy/` のように単体で動くもの）。
- **息子さん（智弘）= 本実装**
  **Claude Code** で、その HTML の機能を本リポジトリ（Next.js + Supabase）へ実装・統合。

## フロー

1. **お父様**: Claude チャットで HTML を作る/更新する → その HTML ファイルを息子さんへ共有（LINE 等）。
2. **息子さん**: HTML を `legacy/` に追加（原本・改変禁止）→ 機能を抽出して実装。
3. 実装は **トピックブランチ → ビルド確認 → `staging` → `main`** の順でコミット。
4. 進捗・差分は [parity-status.md](parity-status.md) を更新して可視化。

## 受け渡しのコツ（お父様へ）

- 新機能の HTML は「**1機能=1まとまり**」で作ると実装しやすいです。
- 入力項目は **選択肢（チップ）の値とラベル**が分かるようにしておくと、そのまま移植できます。
- 既存の患者データ（実在の方）は HTML に残さないでください（架空サンプルで）。

## 実装の置き場所（息子さん向け）

| 対象 | 場所 |
|---|---|
| 先生用カルテ | リポジトリ直下（Next.js, `src/`）|
| 患者用 PWA | `patient/` |
| DB スキーマ/マイグレーション | `db/`（変更は追番マイグレーション＋ `supabase_all.sql` 再生成）|
| 設計ドキュメント | `docs/` |
| 既存 HTML 原本 | `legacy/`（改変禁止）|

## ルール（再掲）

- 実患者データ・APIキーをコミットしない（[05-security-compliance.md](05-security-compliance.md)）。
- DB 変更は `db/migrations/` に追番で追加し、`db/supabase_all.sql` を再生成（冪等を維持）。
- 各機能は **ビルド確認 → staging → main**。
- セットアップ: [setup/supabase-setup.md](setup/supabase-setup.md) / [setup/vercel-deploy.md](setup/vercel-deploy.md) / [setup/line-liff.md](setup/line-liff.md)。
