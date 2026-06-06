# 03. API 設計

形式: REST / JSON over HTTPS。認証: JWT（Bearer）。全エンドポイントはテナント文脈で動作（[02](02-database-design.md) の RLS）。
本書は設計指針であり、実装着手（Phase 2）で OpenAPI 仕様へ落とし込む。

---

## 1. 共通仕様

- ベース URL: `https://api.withmiki.example/v1`
- 認証: `Authorization: Bearer <JWT>`。JWT に `tenant_id` / `sub`(user or patient) / `role` を含む。
- テナント: サーバーが JWT の `tenant_id` から RLS 用に `SET app.tenant_id` を設定。クライアントは指定不可。
- 冪等性: 作成系で `Idempotency-Key` ヘッダ対応（オフライン同期の二重送信対策）。
- ページング: `?limit=&cursor=`（カーソル方式）。
- エラー: `{ "error": { "code": "...", "message": "...", "details": [...] } }`、適切な HTTP ステータス。
- 日付: `record_date` 等は `YYYY-MM-DD`、時刻は ISO8601(UTC)。

## 2. 認証 / 認可

| メソッド | パス | 説明 |
|---|---|---|
| POST | `/auth/login` | 先生ログイン（メール/IdP）→ JWT |
| POST | `/auth/line` | 患者の LINE ログイン（LIFF idToken 検証）→ 患者 JWT |
| POST | `/auth/refresh` | トークン更新 |
| GET  | `/me` | ログイン主体（user/patient）情報 |

ロール: `owner` > `practitioner` > `staff`。患者トークンは自分のリソースのみ。

## 3. テナント / メンバー（外販）

| メソッド | パス | 説明 |
|---|---|---|
| GET/PATCH | `/tenant` | 自院情報の取得・更新 |
| GET/POST | `/tenant/members` | メンバー一覧 / 招待 |
| PATCH/DELETE | `/tenant/members/{id}` | 権限変更 / 無効化 |
| GET | `/tenant/programs` | 利用中ケアプログラム一覧 |
| POST | `/tenant/programs` | 標準プログラムを複製して有効化 / 新規対象を作成 |

## 4. 患者

| メソッド | パス | 説明 |
|---|---|---|
| GET | `/patients?query=&program=` | 患者検索・一覧 |
| POST | `/patients` | 患者作成 |
| GET/PATCH | `/patients/{id}` | 基本情報（patient） |
| GET/PUT | `/patients/{id}/intake` | 問診基本情報（patient_intake） |
| GET/PUT | `/patients/{id}/cover` | ケアプラン表紙（karte_cover） |
| GET/POST | `/patients/{id}/programs` | 受講プログラムの割当 |
| DELETE | `/patients/{id}` | 論理削除（要権限・監査） |

## 5. カルテ（先生側）

| メソッド | パス | 説明 |
|---|---|---|
| GET/POST | `/patients/{id}/problems` | 問題リスト |
| PATCH/DELETE | `/problems/{id}` | 問題の更新/削除 |
| GET/POST | `/patients/{id}/visits` | 施術記録（visit）|
| GET/PATCH/DELETE | `/visits/{id}` | 施術詳細 |
| PUT | `/visits/{id}/vital` | 施術時バイタル/採血（visit_vital）|
| GET/POST | `/patients/{id}/soap` | SOAP 一覧/作成 |
| GET/PUT | `/visits/{id}/body-diagram` | 人体図（front/back のマーク）|
| GET/POST | `/patients/{id}/media` | メディア一覧/登録 |

## 6. デイリーレコード（患者側）

| メソッド | パス | 説明 |
|---|---|---|
| GET | `/patients/{id}/records?from=&to=` | 期間のデイリー（グラフ用） |
| GET | `/patients/{id}/records/{date}` | 当日分（共通＋対象別＋観測） |
| PUT | `/patients/{id}/records/{date}` | 当日分の保存（upsert・冪等）|
| PUT | `/patients/{id}/records/{date}/gyneco` | 婦人科拡張の保存 |
| PUT | `/patients/{id}/records/{date}/athlete` | アスリート拡張の保存 |
| PUT | `/patients/{id}/records/{date}/selfcare` | セルフケア実施 |
| PUT | `/patients/{id}/records/{date}/medications` | 服薬実績 |

> `PUT .../records/{date}` は共通 vitals と対象別ペイロードをまとめて upsert できる複合 body も許容（オフライン同期を 1 リクエストで完結）。

## 7. トレーニング・栄養

| メソッド | パス | 説明 |
|---|---|---|
| GET/POST | `/patients/{id}/trainings` | トレーニング記録 |
| DELETE | `/trainings/{id}` | 削除 |
| GET/PUT | `/patients/{id}/nutrition-goal` | 栄養目標 |
| GET/POST | `/patients/{id}/food-entries` | 食事ログ |

## 8. 採血

| メソッド | パス | 説明 |
|---|---|---|
| GET | `/lab-catalog?program=` | 検査項目カタログ |
| GET/POST | `/patients/{id}/labs` | 採血セット一覧/作成（明細含む）|
| GET/PATCH/DELETE | `/labs/{id}` | 採血セット詳細 |
| GET | `/patients/{id}/labs/trend?codes=hb,ferritin` | 項目別トレンド |

## 9. メディア / 添付

| メソッド | パス | 説明 |
|---|---|---|
| POST | `/uploads/sign` | アップロード用署名付き URL を発行（kind 指定）|
| POST | `/attachments` | アップロード完了をメタ登録（sha256 等）|
| GET | `/attachments/{id}/url` | ダウンロード用署名付き URL（短命）|

## 10. AI プロキシ（サーバー集約：キー非露出）

| メソッド | パス | 説明 |
|---|---|---|
| POST | `/ai/lab-ocr` | 採血画像 → 構造化検査値（attachment 参照）|
| POST | `/ai/food-analysis` | 食事写真 → カロリー/PFC 推定 |
| POST | `/ai/intake-scan` | 問診票画像 → 基本情報抽出 |
| POST | `/ai/karte-chat` | カルテ補助チャット（患者文脈はサーバー生成）|

共通仕様:
- 入力は **attachment_id / patient_id / 文脈参照** のみ。画像バイナリやキーをクライアントに持たせない。
- サーバーが `ai_job` に記録（モデル・トークン・コスト・結果）。
- レート制限・月次コスト上限・同意（`consent.ai_analysis`）チェックを適用。
- 返却は構造化 JSON（OCR は検査コード→値のマップ）。確定保存は別途 `/labs` 等で行う（人間の確認を挟む）。

## 11. LINE 連携

| メソッド | パス | 説明 |
|---|---|---|
| POST | `/webhooks/line` | LINE Messaging API Webhook（署名検証必須）|
| POST | `/patients/{id}/line/link` | LIFF からの本人ひも付け |
| POST | `/line/notify` | 先生→患者の通知送信（内部用）|

Webhook 処理:
1. `X-Line-Signature` を検証。
2. `line_inbound_message` に生データ保存。
3. `line_user_id` → `line_account` → `patient` 解決。
4. ファイル/JSON 添付なら `import_job` を生成、テキストなら記録/通知。

## 12. 移行（既存 JSON 互換）

| メソッド | パス | 説明 |
|---|---|---|
| POST | `/import/jobs` | JSON アップロード（source_kind 自動判定）|
| GET | `/import/jobs/{id}` | 取り込み状況・レポート |
| POST | `/import/jobs/{id}/commit` | 内容確認後に確定反映 |

詳細な変換規則は [04-data-migration.md](04-data-migration.md)。

## 13. 監査・同意

| メソッド | パス | 説明 |
|---|---|---|
| GET | `/patients/{id}/consents` / POST | 同意一覧 / 付与 |
| POST | `/consents/{id}/revoke` | 同意撤回 |
| GET | `/audit-logs?entity=&from=&to=` | 監査ログ参照（owner のみ）|

> すべての参照/更新/エクスポート/ログインは `audit_log` に記録する（横断のミドルウェアで実装）。
