# 02. データベース設計

DBMS: **PostgreSQL 15+**
方針: **共通カルテ基盤（コア）＋ 対象別ケアプログラム（モジュール）＋ 拡張可能な観測モデル**。
DDL の実体は [`../db/schema.sql`](../db/schema.sql)、初期マイグレーションは [`../db/migrations/0001_init.sql`](../db/migrations/0001_init.sql)。

---

## 1. 設計思想：共通基盤の上に対象別カルテを載せる

現行は「婦人科 HTML」「アスリート HTML」「総合カルテ HTML」が**別々のデータ構造**を持っている。
本設計では **総合（マスター）カルテを共通基盤**とし、その上に**対象別カルテ（ケアプログラム）をモジュールとして拡張**する。

```
                ┌──────────────────────────────────────────────┐
                │  共通コア（全対象で共通）                      │
                │  tenant / user / patient / karte_cover         │
                │  problem / visit / visit_vital / soap_note     │
                │  body_diagram / media / daily_record(共通項目) │
                │  medication / lab_result / consent / audit_log │
                └───────────────┬──────────────────────────────┘
                                │ care_program でひも付け
        ┌───────────────────────┼───────────────────────────────┐
        │                       │                               │
 ┌──────▼───────┐       ┌───────▼────────┐            ┌──────────▼─────────┐
 │ 婦人科モジュール │       │ アスリートモジュール │            │ 将来の対象（整形/内科…）│
 │ gyneco_daily   │       │ athlete_daily    │            │ ＝ 観測モデルで追加 │
 │ cycle_*        │       │ training_session │            │ （スキーマ変更不要） │
 └────────────────┘       └──────────────────┘            └────────────────────┘
```

### 拡張の二段構え
1. **高頻度・型付きが必要な対象**（婦人科・アスリート）→ 専用拡張テーブル（`gyneco_daily` 等）で型安全に。
2. **新規対象や自由項目**（整形・内科・小児・院ごとの独自項目）→ **観測モデル**（`observation_definition` ＋ `observation`）で**スキーマ変更なしに**追加。

これにより「まず婦人科とアスリートを堅く作り、将来の対象は設定だけで増やせる」拡張性を確保する。

> **責務分離ルール（[07 §2.1](07-db-design-review.md) で確定）**:
> 標準対象（master/gyneco/athlete）の項目は **型付き列が唯一の正**とし、観測モデルには入れない。
> 観測モデル（`observation_*`）は **`record_kind='generic'` の対象、または院独自の追加項目専用**。
> これにより同一指標の二重登録・不整合を防ぐ。

---

## 2. ER 図（論理）

```
tenant 1──* user
tenant 1──* patient
patient 1──1 karte_cover
patient 1──* problem
patient 1──* visit
visit   1──1 visit_vital
visit   1──* body_diagram
patient 1──* soap_note          (visit に任意ひも付け)
patient 1──* media              (visit に任意ひも付け)

care_program (master) 1──* care_program (婦人科 / アスリート …)   ※自己参照ツリー
patient *──* care_program  (= patient_program: 患者が受けているプログラム)

patient 1──* daily_record                      (共通デイリー項目)
daily_record 1──0..1 gyneco_daily              (婦人科拡張)
daily_record 1──0..1 athlete_daily             (アスリート拡張)
daily_record 1──* observation                  (汎用拡張：任意対象)

patient 1──* medication
daily_record *──* medication (= medication_log)
daily_record 1──* selfcare_log
patient 1──* training_session
patient 1──1 nutrition_goal
patient 1──* food_entry
patient 1──* lab_result 1──* lab_value
lab_test_catalog 1──* lab_value

observation_definition 1──* observation

patient 1──* consent
patient 1──* line_account
line_inbound_message *──0..1 patient
patient 1──* import_job
tenant 1──* ai_job
tenant 1──* audit_log
tenant 1──* attachment
```

---

## 3. 共通規約

- 主キー: `id UUID DEFAULT gen_random_uuid()`（`pgcrypto`）。
- 全業務テーブルに `tenant_id UUID NOT NULL`（RLS 境界）。
- 監査列: `created_at`, `updated_at`（`timestamptz`）, `created_by`, `updated_by`（user 参照）。
- 論理削除: `deleted_at timestamptz NULL`（医療記録は物理削除しない）。
- 複数選択肢（現行の `getChipMulti`）→ `text[]`。単一選択（`getChipSingle`）→ `text`。
- 院ごとに増減しうる自由項目・将来対象 → 観測モデル or `payload JSONB`。
- 命名: スネークケース、テーブルは単数形。

---

## 4. テーブル定義

> 型・制約の正本は [`../db/schema.sql`](../db/schema.sql)。本書は意味と由来（現行 HTML のどのフィールドか）を説明する。

### 4.1 テナント / ユーザー（外販の土台）

#### `tenant` — 治療院・クリニック
| 列 | 型 | 説明 |
|---|---|---|
| id | uuid PK | |
| name | text | 院名 |
| plan | text | 契約プラン（free/standard/pro …）|
| status | text | active / suspended |
| settings | jsonb | 院単位の設定（既定プログラム等）|
| created_at / updated_at | timestamptz | |

#### `user` — 先生・スタッフ
| 列 | 型 | 説明 |
|---|---|---|
| id | uuid PK | |
| tenant_id | uuid FK | |
| email | citext UNIQUE(tenant内) | ログイン |
| name | text | 氏名（現行 `cover-therapist` 等の担当者）|
| role | text | owner / practitioner / staff |
| license_type | text | 鍼灸師 / AT / 医師 等 |
| auth_provider / auth_subject | text | IdP 連携 |
| status | text | active / invited / disabled |

### 4.2 ケアプログラム（対象別カルテの定義）

#### `care_program` — 「総合（master）」を親とする対象別カルテ定義
| 列 | 型 | 説明 |
|---|---|---|
| id | uuid PK | |
| tenant_id | uuid FK | NULL ならシステム標準プログラム |
| code | text | `master` / `gyneco` / `athlete` / 任意 |
| name | text | 表示名（例: 婦人科デイリーレコード）|
| parent_id | uuid FK→care_program | master を親にした自己参照ツリー |
| record_kind | text | `none`/`gyneco`/`athlete`/`generic`（どの拡張を使うか）|
| form_schema | jsonb | 患者入力フォーム定義（動的生成用）|
| is_active | boolean | |

> `master`（総合カルテ）は record_kind=none の共通土台。`gyneco`/`athlete` は master を親に持ち、それぞれの拡張テーブルを使う。新対象は `generic` ＋観測定義で追加。

#### `patient_program` — 患者が受けているプログラム
| 列 | 型 | 説明 |
|---|---|---|
| id | uuid PK | |
| patient_id | uuid FK | |
| care_program_id | uuid FK | |
| started_at / ended_at | date | |
| is_primary | boolean | 主プログラム |

### 4.3 患者・カルテ基盤（共通コア）

#### `patient` — 患者（現行 `personal-karte` の f-* 基本情報 ＋ 患者識別）
| 列 | 型 | 由来 / 説明 |
|---|---|---|
| id | uuid PK | |
| tenant_id | uuid FK | |
| code | text | 院内患者番号（現行 `patientId`）|
| name | text | `f-name` / `patientName` |
| kana | text | `f-kana` |
| dob | date | `f-dob` |
| sex | text | `f-sex` |
| blood_type | text | `f-blood` |
| tel / tel2 | text | `f-tel` / `f-tel2` |
| email | citext | `f-email` |
| address | text | `f-address` |
| job | text | `f-job` |
| first_visit_date | date | `f-firstvisit` |
| referrer / route | text | `f-referrer` / `f-route` |
| emergency_name / emergency_rel / emergency_tel | text | `f-emname` / `f-emrel` / `f-emtel` |
| hospital | text | `f-hospital` |
| avatar | text | 絵文字/写真参照（現行 setAvatarEmoji/photo）|
| status | text | active / inactive |
| deleted_at | timestamptz | 論理削除 |

#### `patient_intake` — 問診基本情報（現行 `f-chief`〜`f-note`）
| 列 | 型 | 由来 |
|---|---|---|
| patient_id | uuid FK (PK) | 1患者1件（履歴は更新監査で）|
| chief | text | 主訴 `f-chief` |
| onset | text | 発症 `f-onset` |
| current | text | 現病歴 `f-current` |
| history | text | 既往歴 `f-history` |
| sleep | text | `f-sleep` |
| appetite | text | `f-appetite` |
| meds | text | 服薬 `f-meds` |
| note | text | 禁忌・備考 `f-note` |

#### `karte_cover` — ケアプラン表紙（現行 `karte-*` / `cover-*`）
| 列 | 型 | 由来 |
|---|---|---|
| patient_id | uuid FK (PK) | |
| purpose | text | 目的 `karte-purpose` / `cover-purpose` |
| therapist | text | 担当 `karte-therapist` |
| goal | text | 目標 `cover-goal` |
| diagnosis | text | 診断 `cover-diagnosis` |
| history | text | 経過 `cover-history` |
| treatment | text | 治療方針 `cover-treatment` |
| caution | text | 注意 `cover-caution` |
| doctor | text | 主治医 `cover-doctor` |
| start_date | date | `cover-startdate` |
| next_visit | date | `cover-nextvisit` |

#### `problem` — 問題リスト（現行 problems[]）
| 列 | 型 | 説明 |
|---|---|---|
| id / patient_id | uuid | |
| title | text | 問題名 |
| detail | text | 内容 |
| status | text | active / resolved |
| sort_order | int | 表示順 |

#### `visit` — 施術記録（現行 visits{}）
| 列 | 型 | 由来 |
|---|---|---|
| id / patient_id | uuid | |
| visit_date | date | `visitDate` |
| injury_part / injury_name | text | `v-injurypart` / `v-injuryname` |
| disorder_part / disorder_name | text | `v-disorderpart` / `v-disordername` |
| points | text | 取穴 `v-points` |
| technique | text | 手技 `v-tech` |
| treatments | text[] | 処置（buildContext の treatments）|
| memo | text | `v-memo` |

#### `visit_vital` — 施術時バイタル/簡易採血（現行 v-* 多数）
| 列 | 型 | 由来 |
|---|---|---|
| visit_id | uuid FK (PK) | |
| weight / fat / bmi | numeric | `v-weight`/`v-fat`/`v-bmi` |
| temp | numeric | `v-temp` |
| sbp / dbp / hr / spo2 | int | `v-sbp`/`v-dbp`/`v-hr`/`v-spo2` |
| hb / ht / rbc / mcv / mch | numeric | 血算 `v-hb`…`v-mch` |
| ferritin / fe / tibc / tsat / retic / b12 | numeric | 鉄関連 `v-ferritin`… |
| extra | jsonb | 上記以外の測定値 |

#### `soap_note` — SOAP（現行 soaps[] / soap-*）
| 列 | 型 | 由来 |
|---|---|---|
| id / patient_id | uuid | |
| visit_id | uuid FK NULL | 任意ひも付け |
| note_date | date | `soap-date` |
| s / o / a / p | text | `soap-s`/`soap-o`/`soap-a`/`soap-p` |

#### `body_diagram` — 人体図（現行 bodyMarks{front,back}）
| 列 | 型 | 説明 |
|---|---|---|
| id / patient_id | uuid | |
| visit_id | uuid FK NULL | |
| view | text | front / back |
| marks | jsonb | 座標・色・サイズの配列（Canvas マーク）|
| note | text | `bodyNote` |

### 4.4 デイリーレコード（患者セルフ記録：共通＋対象別）

#### `daily_record` — 共通デイリー（婦人科/アスリート共通の vitals）
| 列 | 型 | 由来 |
|---|---|---|
| id / patient_id | uuid | |
| record_date | date | UNIQUE(patient_id, record_date) |
| care_program_id | uuid FK | どのプログラムの記録か |
| weight / body_fat / muscle_mass / height | numeric | `v-weight`/`v-fat`/`v-muscle`/`v-height` |
| sbp / dbp / hr | int | `v-sbp`/`v-dbp`/`v-hr` |
| body_temp | numeric | `v-bodytemp` |
| sleep_hours | numeric | `v-sleep` |
| sleep_quality | text | `v-sleepQuality` |
| water | numeric | `v-water` |
| exercise | text | `v-exercise` |
| condition | text | アスリート `v-condition` |
| memo | text | `memoInput` / `v-memo` |
| payload | jsonb | 院独自の自由項目の受け皿 |

#### `gyneco_daily` — 婦人科拡張（現行 saveRecord の婦人科項目）
| 列 | 型 | 由来（getChip*） |
|---|---|---|
| daily_record_id | uuid FK (PK) | |
| bbt | numeric | 基礎体温 `bbtInput` |
| cycle_day | int | 周期日（calcCycleDay）|
| menstrual | text | `menstrual`（single）|
| flow | text | `flow` |
| blood_state | text[] | `bloodState`（multi）|
| discharge_amt | text | `dischargeAmt` |
| discharge_state | text[] | `dischargeState` |
| cervical | text | `cervical` |
| ov_test | text | 排卵検査 `ovTest` |
| ov_pain | text[] | `ovPain` |
| sex | text | `sex` |
| sex_note | text[] | `sexNote` |
| breast | text[] | `breast` |
| pms_physical | text[] | `pmsPhysical` |
| pms_mental | text[] | `pmsMental` |
| pain | int | 痛みスケール `getPain` |
| pain_location | text[] | `painLocation` |
| chill_area | text[] | 冷え `chillArea` |
| edema_area | text[] | むくみ `edemaArea` |
| tongue | text[] | 舌診 `tongue` |
| oriental | text[] | 東洋医学所見 `oriental` |

#### `athlete_daily` — アスリート拡張
| 列 | 型 | 由来 |
|---|---|---|
| daily_record_id | uuid FK (PK) | |
| injury | text | `v-injury` |
| condition_score | int | コンディション |
| extra | jsonb | スポーツ種目別の追加指標 |

#### `selfcare_log` — セルフケア実施（現行 SELFCARES / getSelfcare）
| 列 | 型 | 説明 |
|---|---|---|
| id | uuid | |
| daily_record_id | uuid FK | |
| selfcare_code | text | iap / pelvic / autonomic / stretch / lymph / walk … |
| done | boolean | |

#### `medication` — 服薬マスタ（現行 MEDS ＋ customMed1..10）
| 列 | 型 | 説明 |
|---|---|---|
| id / patient_id | uuid | |
| name | text | 薬剤名（既定 or カスタム）|
| is_custom | boolean | |
| is_active | boolean | |

#### `medication_log` — 服薬実績（現行 getTakenMeds / customMeds taken）
| 列 | 型 | 説明 |
|---|---|---|
| daily_record_id | uuid FK | |
| medication_id | uuid FK | |
| taken | boolean | (PK: daily_record_id, medication_id) |

### 4.5 トレーニング・栄養（アスリート中心、婦人科でも食事は利用）

#### `training_session` — トレーニング記録（現行 trainings[]）
| 列 | 型 | 由来 |
|---|---|---|
| id / patient_id | uuid | |
| session_date | date | `trainDate` |
| type | text | 種別（buildTrainTypes）|
| duration_min | int | `trainDuration` |
| intensity | text | `trainIntensity` |
| volume | text | `trainVolume` |
| memo | text | `trainMemo` |

#### `nutrition_goal` — 栄養目標（現行 foodGoals）
| 列 | 型 | 由来 |
|---|---|---|
| patient_id | uuid (PK) | |
| calories / protein / carbs / fat | numeric | `goalCalories`/`goalProtein`/`goalCarbs` |
| target_weight | numeric | `goalWeight` |

#### `food_entry` — 食事ログ（現行 foodEntries[]）
| 列 | 型 | 由来 |
|---|---|---|
| id / patient_id | uuid | |
| entry_date | date | `foodDate` |
| meal | text | 朝/昼/夕/間食（selMeal）|
| photo_attachment_id | uuid FK→attachment | `foodPhotoInput` |
| memo | text | `foodMemo` |
| calories / protein / carbs / fat | numeric | AI 解析 or 手入力 |
| ai_analysis | jsonb | Claude 解析の生結果 |

### 4.6 採血（拡張可能な検査モデル）

検査項目は対象により大きく異なる（婦人科: E2/P4/FSH/LH/AMH…、アスリート: CK/テストステロン/コルチゾール…）。
**ヘッダ（`lab_result`）＋ 明細（`lab_value`）＋ カタログ（`lab_test_catalog`）** の構成で、項目追加に強くする。

#### `lab_test_catalog` — 検査項目マスタ
| 列 | 型 | 説明 |
|---|---|---|
| code | text PK | `hb`,`ferritin`,`e2`,`p4`,`fsh`,`lh`,`amh`,`ck`,`testosterone`,`cortisol` … |
| name | text | 表示名 |
| unit | text | 単位 |
| ref_low / ref_high | numeric | 基準値 |
| category | text | 血算/鉄/ホルモン/代謝 等 |
| applies_to | text[] | `{gyneco,athlete,general}` |

#### `lab_result` — 採血セット（現行 lab / labHistory）
| 列 | 型 | 由来 |
|---|---|---|
| id / patient_id | uuid | |
| taken_date | date | `labDate` |
| source | text | manual / ocr（写真スキャン）|
| image_attachment_id | uuid FK→attachment | `labScanInput` 画像 |
| comment | text | `lab-comment` / `lab-other` |

#### `lab_value` — 採血の各値（EAV、カタログ参照）
| 列 | 型 | 説明 |
|---|---|---|
| lab_result_id | uuid FK | |
| test_code | text FK→lab_test_catalog | |
| value | numeric | 値 |
| value_text | text | 数値化できない場合 |
| (PK: lab_result_id, test_code) | | |

> 現行 `lab-hb`,`lab-ferritin`,…,`lab-amh`,`lab-cortisol` 等は **すべて `lab_value` の行**として表現。新項目はカタログに 1 行足すだけ。

### 4.7 メディア・添付

#### `attachment` — ファイル本体メタ（画像/動画/PDF）
| 列 | 型 | 説明 |
|---|---|---|
| id / tenant_id / patient_id | uuid | |
| kind | text | food_photo / lab_image / body_photo / media / intake / import |
| storage_key | text | オブジェクトストレージ上のキー |
| mime / size_bytes | text/bigint | |
| sha256 | text | 整合性・重複検出 |
| is_encrypted | boolean | |
| created_at | timestamptz | |

#### `media` — 患者の画像/動画記録（現行 mediaEntries / media[]）
| 列 | 型 | 由来 |
|---|---|---|
| id / patient_id | uuid | |
| visit_id | uuid FK NULL | |
| category | text | selMediaCat |
| title | text | `mediaTitle` |
| memo | text | `mediaMemo` |
| taken_date | date | `mediaDate` |
| attachment_id | uuid FK→attachment | `mediaFileInput` |

### 4.8 汎用観測モデル（将来対象を“設定”で追加）

新しい対象別カルテ（整形・内科・小児・院独自項目）を**スキーマ変更なし**で追加するための仕組み。

#### `observation_definition` — 観測項目の定義
| 列 | 型 | 説明 |
|---|---|---|
| id | uuid PK | |
| tenant_id | uuid FK NULL | NULL=標準 |
| care_program_id | uuid FK | どのプログラムの項目か |
| code | text | 項目コード |
| label | text | 表示名 |
| data_type | text | number / text / boolean / single / multi / date |
| options | jsonb | 選択肢（single/multi 用）|
| unit | text | 単位 |
| sort_order | int | |

#### `observation` — 観測値（daily_record や visit にひも付く実値）
| 列 | 型 | 説明 |
|---|---|---|
| id | uuid PK | |
| definition_id | uuid FK | |
| patient_id | uuid FK | |
| daily_record_id | uuid FK NULL | デイリーにひも付く場合 |
| visit_id | uuid FK NULL | 施術にひも付く場合 |
| observed_at | timestamptz | |
| num_value | numeric | |
| text_value | text | |
| bool_value | boolean | |
| array_value | text[] | multi 用 |

> 「まず婦人科・アスリートを型付きで堅く、将来対象は観測モデルで柔らかく」の二段構えを実現する中核テーブル。

### 4.9 連携・運用（LINE / 移行 / AI / 同意 / 監査）

#### `line_account` — 患者と LINE のひも付け
| 列 | 型 | 説明 |
|---|---|---|
| id / patient_id | uuid | |
| line_user_id | text UNIQUE | LINE ユーザー ID |
| linked_at | timestamptz | |

#### `line_inbound_message` — LINE 自動受信ログ
| 列 | 型 | 説明 |
|---|---|---|
| id | uuid | |
| line_user_id | text | 送信元 |
| patient_id | uuid FK NULL | 解決後ひも付け |
| message_type | text | text / file / postback |
| payload | jsonb | Webhook 生データ |
| processed_at | timestamptz NULL | 取り込み完了時刻 |

#### `import_job` — 既存 JSON 取り込み（互換）
| 列 | 型 | 説明 |
|---|---|---|
| id / patient_id | uuid | |
| source_filename | text | `withmiki_summary_*.json` 等 |
| source_kind | text | gyneco_summary / athlete_full / karte_state |
| raw_json | jsonb | 取り込んだ生 JSON（保全）|
| status | text | pending / done / failed |
| report | jsonb | 取り込み結果・警告・差分 |

#### `ai_job` — AI 利用ログ（OCR/食事/カルテ補助）
| 列 | 型 | 説明 |
|---|---|---|
| id / tenant_id | uuid | |
| patient_id | uuid FK NULL | |
| type | text | lab_ocr / food_analysis / karte_chat / intake_scan |
| model | text | claude-sonnet-… |
| input_ref | jsonb | 入力参照（attachment/context）|
| output | jsonb | 構造化結果 |
| input_tokens / output_tokens | int | |
| cost_usd | numeric | |
| status | text | succeeded / failed |
| created_at | timestamptz | |

#### `consent` — 同意管理
| 列 | 型 | 説明 |
|---|---|---|
| id / patient_id | uuid | |
| consent_type | text | data_processing / ai_analysis / sharing |
| granted_at / revoked_at | timestamptz | |
| document_attachment_id | uuid FK NULL | 同意書 |
| version | text | 同意文面バージョン |

#### `audit_log` — 監査ログ（医療データアクセス記録）
| 列 | 型 | 説明 |
|---|---|---|
| id / tenant_id | uuid | |
| actor_user_id | uuid FK NULL | 操作者（患者操作は NULL+actor_kind）|
| actor_kind | text | user / patient / system |
| action | text | create / read / update / delete / export / login |
| entity | text | テーブル名 |
| entity_id | uuid | |
| ip / user_agent | text | |
| at | timestamptz | |

---

## 5. テナント分離（RLS）

全業務テーブルに `tenant_id` を持たせ、PostgreSQL Row-Level Security で分離する。

```sql
ALTER TABLE patient ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON patient
  USING (tenant_id = current_setting('app.tenant_id')::uuid);
```

- API は接続/トランザクション開始時に `SET app.tenant_id = '<認証テナント>'` を設定。
- 患者は自分のレコードのみ（追加で `app.patient_id` を用いた行ポリシー）。
- 管理用バッチは専用ロールで運用（RLS バイパスは最小限・監査必須）。

---

## 6. 主なインデックス

| テーブル | インデックス | 目的 |
|---|---|---|
| patient | (tenant_id, code), (tenant_id, name) | 院内検索 |
| daily_record | UNIQUE(patient_id, record_date), (patient_id, record_date DESC) | 日次取得・グラフ |
| visit | (patient_id, visit_date DESC) | 施術時系列 |
| soap_note | (patient_id, note_date DESC) | SOAP 履歴 |
| lab_result | (patient_id, taken_date DESC) | 採血推移 |
| lab_value | (test_code), (lab_result_id) | 項目別トレンド |
| observation | (patient_id, definition_id, observed_at) | 汎用トレンド |
| line_inbound_message | (line_user_id), (processed_at) | 未処理抽出 |
| audit_log | (tenant_id, at DESC), (entity, entity_id) | 監査 |

---

## 7. 現行 → 新テーブル 対応サマリ

| 現行 HTML | 現行データ | 新テーブル |
|---|---|---|
| gyneco `db.records[date]` | 婦人科デイリー | `daily_record` + `gyneco_daily` + `selfcare_log` + `medication_log` |
| gyneco `db.settings.cover` | 表紙 | `karte_cover` |
| gyneco `lab` | 採血 | `lab_result` + `lab_value` |
| athlete `db.records/trainings/foodEntries/labHistory` | 各種 | `daily_record`+`athlete_daily` / `training_session` / `food_entry` / `lab_result`+`lab_value` |
| athlete `db.cover` | 表紙 | `patient` + `karte_cover` |
| karte `state.patient/basicInfo` | 基本情報 | `patient` + `patient_intake` |
| karte `state.visits` | 施術 | `visit` + `visit_vital` |
| karte `state.problems/soaps` | 問題/SOAP | `problem` / `soap_note` |
| karte `state.bodyMarks` | 人体図 | `body_diagram` |
| karte `state.media` | メディア | `media` + `attachment` |

詳細な変換規則は [04-data-migration.md](04-data-migration.md)。
