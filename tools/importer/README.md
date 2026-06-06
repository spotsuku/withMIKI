# @withmiki/importer

WithMIKI の既存データ（現行 HTML の localStorage / エクスポート JSON）を、新 DB（Supabase / PostgreSQL）へ
**データを失わずに**取り込むためのツール。Phase 2（[../../docs/06-roadmap.md](../../docs/06-roadmap.md)）の中核。

対応する取り込み元（自動判定）:

| source_kind | 取り込み元 |
|---|---|
| `gyneco_full` | 婦人科レコードの localStorage `db`（全履歴）|
| `gyneco_summary` | 婦人科の `exportSummaryJSON()` 出力（最新採血＋表紙のみ）|
| `athlete_full` | アスリートレコードの `exportData()` 出力（`db` 全体）|
| `karte_state` | 総合カルテの localStorage `state` |

変換規則は [../../docs/04-data-migration.md](../../docs/04-data-migration.md)、出力先スキーマは
[../../db/schema.sql](../../db/schema.sql)（＋ migrations 0001〜0003）。

## 設計

- **変換ロジック（`src/transform.ts` ＋ `src/parsers/`）は DB 非依存の純関数**。
  → 単体テスト（`test/`）で網羅。`@supabase/supabase-js` 不要で動く。
- **投入（`src/loadSupabase.ts`）は分離**。正規化モデル `NormalizedImport` を依存関係順に insert し、生成 ID で FK をひも付ける。
- 「欠損は null、未知は捨てない」原則（未知の採血項目は `value_text`、未知フィールドは `source_ref`/`extra`/`payload` に保全）。

```
src/
  model.ts            正規化中間モデル（NormalizedImport）
  normalize.ts        値正規化ヘルパー（num/int/str/arr/date…）
  detect.ts           source_kind 自動判定
  transform.ts        判定→パーサ振り分け（単一エントリポイント）
  parsers/
    labs.ts           採血項目 → lab_test_catalog コードへのマッピング
    gynecoFull.ts / gynecoSummary.ts / athleteFull.ts / karteState.ts
  loadSupabase.ts     正規化モデル → Supabase 投入
  cli.ts              CLI（dry-run / --json / --commit）
test/                 node:test による単体テスト（依存ゼロ）
  fixtures/           架空サンプル JSON（実患者データは置かない）
```

## 必要環境

Node.js **22.6 以上**（TypeScript をネイティブ実行・`node:test` 使用）。

## 使い方

```bash
# 依存インストール（投入機能 / 型チェック用）
npm install

# テスト（依存ゼロで動く）
npm test

# 型チェック
npm run typecheck

# dry-run: 取り込み内容のサマリだけ表示（DB に書き込まない）
node src/cli.ts path/to/data.json

# 種別を強制 / 正規化結果を JSON 出力
node src/cli.ts path/to/data.json --kind=gyneco_full
node src/cli.ts path/to/data.json --json

# Supabase へ投入（要 env）
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... TENANT_ID=... \
  node src/cli.ts path/to/data.json --commit
```

## 注意（セキュリティ）

- **実患者データ・実 JSON をリポジトリに置かない**（[../../docs/05-security-compliance.md](../../docs/05-security-compliance.md)）。
  `test/fixtures/` は架空データのみ。
- `--commit` は RLS を越えて書き込むため **service role キー**を用いる。鍵は環境変数で渡し、コミットしない。
- 投入は患者単位。既存患者への追記/新規判定は将来 API（`/import/jobs`）側で突合する。

## テスト方針

- 各 `source_kind` のゴールデンテスト（`test/transform.test.ts`）。
- 値正規化の単体テスト（`test/normalize.test.ts`）、判定（`test/detect.test.ts`）。
- 将来: 「インポート → 再エクスポート → 差分ゼロ」の回帰テストを追加予定（docs/04 §5）。
