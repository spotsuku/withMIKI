# 04. データ移行・互換性設計

目的: **現行 HTML が出力する JSON / localStorage を、データを失わずに新 DB へ取り込む**。
最優先事項は「いま使っている患者さんのデータを 1 件も失わないこと」。

---

## 1. 移行元データの種類

現行アプリは 3 系統の異なる形のデータを持つ。インポータは `source_kind` を自動判定する。

| source_kind | 出力元 | 形 | 判定キー |
|---|---|---|---|
| `gyneco_summary` | 婦人科 `exportSummaryJSON()` | サマリー（最新採血＋統計＋表紙） | `patientName` ＋ `latestLab` ＋ `cover` |
| `gyneco_full` | 婦人科 localStorage `db` | `{records:{date:{...}}, settings, customMeds}` | `records` がオブジェクトで各値に `menstrual/bbt` |
| `athlete_full` | アスリート `exportData()`（`db` 全体） | `{records, trainings, foodEntries, weightEntries, labHistory, mediaEntries, cover, foodGoals}` | `trainings` / `foodGoals` の存在 |
| `karte_state` | 総合カルテ localStorage `state` | `{patient, basicInfo, checks, visits, media, problems, soaps, bodyMarks}` | `visits` ＋ `basicInfo` の存在 |

> 注意: 婦人科の通常エクスポートは「サマリー」で、全履歴を含まない。**全履歴移行には localStorage の `db` を書き出す手段が必要**（移行用エクスポートボタンの追加を Phase 1 で検討、[06-roadmap.md](06-roadmap.md)）。

---

## 2. 変換マッピング

### 2.1 婦人科 full（`gyneco_full`）

| 移行元 | 新テーブル |
|---|---|
| `settings.patientName` / `settings.patientId` | `patient.name` / `patient.code` |
| `settings.cover.*` | `karte_cover.*`（purpose/goal/diagnosis/history/treatment/doctor/start_date/next_visit/caution）|
| `settings.height` | 各 `daily_record.height`（または patient メタ）|
| `records[date]` 共通項目（weight/fat/height/sbp/dbp/hr/bodytemp/sleep/sleepQuality/water/exercise/memo） | `daily_record`（1 日 1 行、`record_date=date`）|
| `records[date]` 婦人科項目（bbt/menstrual/flow/bloodState/discharge*/cervical/ovTest/ovPain/sex/sexNote/breast/pms*/pain/painLocation/chillArea/edemaArea/tongue/oriental） | `gyneco_daily`（daily_record にひも付け）|
| `records[date].selfcare` | `selfcare_log` |
| `records[date].meds` / `customMeds` / `records[date].customMeds[]` | `medication` ＋ `medication_log` |
| `records[date].lab` | `lab_result`（taken_date=date, source=manual）＋ `lab_value`（hb/ferritin/.../amh/prl/tsh/ft4/vitd/zinc/mg/crp/hba1c/glucose/ldl/hdl）|

### 2.2 婦人科サマリー（`gyneco_summary`）
- 全履歴がないため、**最新採血のみ** `lab_result`/`lab_value` に。`cover`→`karte_cover`、`patientName/Id`→`patient`。
- `stats`（totalDays/periodDays）は参考値として `import_job.report` に保持（再計算が原則）。

### 2.3 アスリート full（`athlete_full`）

| 移行元 | 新テーブル |
|---|---|
| `cover`（name/sport/team/dob/goal）| `patient`（name/dob）＋ `karte_cover`（goal）＋ `athlete_daily`/observation（sport/team）|
| `settings`（height/sport/category/weightRestriction）| `patient` メタ / `care_program` 設定 |
| `records[date]`（weight/fat/muscle/hr/sleep/height/condition/injury/memo）| `daily_record` ＋ `athlete_daily`（injury/condition）|
| `trainings[]`（date/type/duration/intensity/volume/memo）| `training_session` |
| `foodGoals`（calories/protein/carbs/weight）| `nutrition_goal` |
| `foodEntries[]`（date/meal/photo/memo/栄養）| `food_entry`（写真は `attachment`）|
| `labHistory[]` | `lab_result` ＋ `lab_value`（ck/ldh/ua/testosterone/cortisol 等を含む）|
| `mediaEntries[]` | `media` ＋ `attachment` |

### 2.4 総合カルテ（`karte_state`）

| 移行元 | 新テーブル |
|---|---|
| `patient`（name/avatar 等）| `patient` |
| `basicInfo`（chief/onset/current/history/sleep/appetite/meds/note ＋ f-* 連絡先）| `patient` ＋ `patient_intake` |
| `karte cover`（karte-purpose/therapist/goal/...）| `karte_cover` |
| `visits{id}`（visitDate/injury/disorder/points/tech/treatments/memo ＋ vitals v-*）| `visit` ＋ `visit_vital` |
| `problems[]` | `problem` |
| `soaps[]` / visit 内 soap | `soap_note` |
| `bodyMarks{front,back}` | `body_diagram`（view ごとに 1 行、marks=jsonb）|
| `media[]` / `mediaMemo` | `media` ＋ `attachment` |

---

## 3. 値の正規化ルール

- 数値: 空文字/`null`/`NaN` → `NULL`。`parseFloat`/`parseInt` 失敗は `NULL`。
- 複数選択（配列）: 空は `'{}'`。未知の選択肢値もそのまま保持（消さない）。
- 採血: カタログ未登録のコードが来たら `lab_test_catalog` に暫定追加 or `lab_value.value_text` へ退避（欠損させない）。
- 日付キー（`records` のキー）: `YYYY-MM-DD` を `record_date` に。重複日は後勝ち＋ `import_job.report` に警告。
- 画像: 現行は base64 等で埋め込み。移行時に `attachment`（ストレージ）へ展開し参照へ置換。
- 未知フィールド: 破棄せず `daily_record.payload` / `visit_vital.extra` / `import_job.raw_json` に保全。

---

## 4. インポート手順（API）

1. `POST /import/jobs`（JSON 添付）→ `source_kind` 自動判定、`raw_json` 保存、`status=pending`。
2. サーバーがドライランで変換し、`report`（作成予定件数・警告・既存との差分・重複日）を生成。
3. 先生が内容確認 → `POST /import/jobs/{id}/commit` で確定反映。
4. 既存患者への追記か新規作成かは `patient.code`/`name`/メールで突合（曖昧時は手動選択）。
5. すべて `audit_log` に記録。`raw_json` は監査のため保持。

---

## 5. 互換性の検証

- 現行 `legacy/` の各 HTML から出力した**架空サンプル JSON** を `tests/fixtures/`（実装時に作成）に用意し、インポータのゴールデンテストを行う。
- 「インポート → エクスポート（同等 JSON 再生成）→ 差分ゼロ」を回帰テストの基準にする。
- **実患者 JSON はリポジトリに置かない**（[05-security-compliance.md](05-security-compliance.md)・README §6.3）。

---

## 6. 移行運用フロー（現場向け）

1. 患者さんに旧ファイルで「JSON 出力」してもらう（または移行用フルエクスポート）。
2. 先生がカルテ Web の「インポート」へアップロード。
3. レポートを確認して確定。
4. 患者さんを新アプリ（PWA/LIFF）へ招待 → 以降はクラウド同期。
5. 旧 HTML は当面バックアップとして保管（README §6.2、`legacy/` は改変禁止）。
