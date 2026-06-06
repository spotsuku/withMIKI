# 07. DB 設計レビュー（共通基盤＋対象別モジュール方針）

対象: [02-database-design.md](02-database-design.md) / [`../db/schema.sql`](../db/schema.sql)
目的: 「総合カルテを共通基盤とし、婦人科・アスリート等を対象別モジュールとして拡張する」方針を批判的に検証し、決定事項を確定する。
反映: 本レビューで合意した改善は [`../db/migrations/0002_review_refinements.sql`](../db/migrations/0002_review_refinements.sql) に実装。

---

## 1. 方針の評価（結論：採用。ただし運用ルールの明文化が必要）

| 観点 | 評価 |
|---|---|
| 共通コア（patient/visit/soap/daily_record…）を全対象で共有 | ◎ 重複排除・横断集計が容易。総合カルテが自然に基盤になる |
| 婦人科/アスリートを型付き拡張テーブル（gyneco_daily/athlete_daily）で表現 | ◎ クエリ・グラフ・バリデーションが型安全 |
| 新対象を観測モデル（observation_*）で設定追加 | ◎ スキーマ改修なしに拡張可能。外販時の差別化要素 |
| 二段構え（型付き＋観測）の併存 | ○ 強力だが **「どちらに入れるか」のルールがないと二重登録・不整合の温床**（要対策, §2.1）|

**判定: 方針は妥当。以下の決定事項（§2）を加えて確定とする。**

---

## 2. 指摘事項と決定

### 2.1 【重要】型付き列と観測モデルの責務分離
**問題**: 同じ指標を `gyneco_daily.bbt`（型付き）と `observation`（汎用）の両方に入れられてしまい、二重・不整合が起きうる。
**決定**:
- **標準対象（master/gyneco/athlete）の項目は型付き列が唯一の正**。観測モデルに入れない。
- 観測モデルは **`care_program.record_kind='generic'` の対象、または院独自の追加項目専用**。
- `observation_definition` は `care_program_id` 必須運用とし、標準プログラムには標準項目を定義しない（型付き列があるため）。
- ドキュメント（02 §1, 08）にこのルールを明記。

### 2.2 【重要】RLS を全業務テーブルへ
**問題**: `schema.sql` では RLS を patient/daily_record/visit/lab_result の 4 テーブルにしか有効化していない。子テーブル（`gyneco_daily`, `lab_value`, `visit_vital`, `medication_log`, `selfcare_log`）や他テーブルが未保護。
**決定**: **全業務テーブルで RLS を有効化**。`tenant_id` を持つテーブルは直接ポリシー、`tenant_id` を持たない子テーブルは**親経由のポリシー**（EXISTS サブクエリ）で保護。0002 で一括適用。

### 2.3 子テーブルのテナント整合
**問題**: `gyneco_daily`/`athlete_daily`/`lab_value`/`medication_log`/`selfcare_log` は `tenant_id` を持たず、親に依存。RLS とパフォーマンスの両面で扱いに注意。
**決定**:
- これら子テーブルは **親（daily_record / lab_result）への FK ＋ 親経由 RLS** で保護（非正規な tenant_id 重複は持たせない＝整合性優先）。
- 0002 で親参照型 RLS ポリシーを追加。

### 2.4 論理削除と一意制約の競合
**問題**: `daily_record` は `UNIQUE(patient_id, record_date)`。将来 `deleted_at` を導入すると、削除→同日再作成で衝突する。また現状 `daily_record` に `deleted_at` 列がない（他の記録系は持つのに非対称）。
**決定**:
- `daily_record` に `deleted_at` を追加（医療記録は論理削除に統一）。
- 一意制約を **部分ユニークインデックス `WHERE deleted_at IS NULL`** に置換。0002 で対応。

### 2.5 外部キー・RLS フィルタ用インデックス不足
**問題**: 多くのテーブルで `tenant_id` や FK 列にインデックスがなく、RLS の絞り込み・結合・親削除が遅くなりうる。
**決定**: 主要な `tenant_id` 列、結合に使う FK（visit_id, daily_record_id, lab_result_id, attachment_id 等）へインデックス追加。0002 で対応。

### 2.6 マスタの重複（medication）
**問題**: 服薬マスタ `medication` が患者単位。現行の既定 MEDS（ジエノゲスト等）が全患者で重複行になる。
**決定（当面）**:
- まずは患者単位のまま実装（現行 HTML と一致し移行が単純）。
- 将来、テナント共有の `medication_catalog` を追加し `medication` から参照する正規化を検討（0002 では変更せず、08 に TODO 記載）。
- 重複緩和のため `(patient_id, name)` にユニークを付与（同名重複を防止）。0002 で対応。

### 2.7 身長など患者属性の冗長
**問題**: `daily_record.height` は日々ほぼ不変で冗長。現行も settings に持つ。
**決定**: `daily_record.height` は**任意（その日の実測がある時のみ）**とし、患者の基準身長は `patient` 側メタ（将来 `patient.height_cm`）で保持する方針を 08 に記載。0002 では列は残す（移行互換のため）。

### 2.8 基本情報・表紙の履歴
**問題**: `patient_intake`/`karte_cover` は 1 患者 1 行で履歴を持たない。
**決定**: 変更履歴は **`audit_log`（更新前後）で担保**。本格的な版管理が必要になった段階で `*_history` を追加（現時点は過剰設計を避ける）。08 に判断根拠を記載。

### 2.9 予約語・命名
**問題**: `patient_intake.current` は予約語に近く、SQL で `"current"` のクォートが必要。
**決定**: 互換性のため現状維持（`"current"`）。実装の ORM/クエリでは明示クォート。将来リネーム候補として 08 に記載。

### 2.10 監査列の一貫性
**問題**: `created_by`/`updated_by` の有無がテーブル間で不揃い。患者起点の記録（daily_record 等）は user ではなく patient が作成主体。
**決定**: 作成主体は `source`（patient/import/line/user）で表現し、user 操作テーブルにのみ `created_by/updated_by` を置く（現状方針を踏襲）。詳細記録は `audit_log`。

---

## 3. 据え置き（過剰設計を避けるため今はやらない）

- パーティショニング（daily_record 等の時系列）: データ量が増えてから。
- 列レベル暗号化の全面適用: まず通信/保存時暗号化＋RLS。機微列のみ段階導入（05 参照）。
- medication のテナント共有マスタ化: §2.6 の通り将来課題。
- intake/cover の版管理テーブル: §2.8 の通り将来課題。

---

## 4. 決定事項サマリ（0002 で実装する項目）

1. 全業務テーブルで RLS 有効化（子テーブルは親経由ポリシー）。§2.2 §2.3
2. `daily_record.deleted_at` 追加 ＋ 部分ユニークインデックス化。§2.4
3. `tenant_id`・主要 FK へインデックス追加。§2.5
4. `medication (patient_id, name)` ユニーク。§2.6
5. （ドキュメント）型付き列 vs 観測モデルの責務分離ルールを 02/08 に明記。§2.1

確定後、本方針で Phase 1（基盤）・Phase 2（インポータ）へ進む。
