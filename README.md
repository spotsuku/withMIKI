# WithMIKI

> 鍼灸師・アスレティックトレーナー（AT）のための、患者カルテ & セルフレコード プラットフォーム

WithMIKI（ウィズミキ）は、**患者さんが日々の体調を記録し、先生が施術カルテとして活用する**ための医療レコードシステムです。
現在は単体 HTML ＋ LINE 配布で運用されていますが、本リポジトリでは将来の**外販（SaaS化）を見据えたマルチテナント型プラットフォーム**へ発展させるための設計を整備します。

著作・監修: 三木裕昭（鍼灸師・AT）

---

## 1. このリポジトリの目的

このリポジトリは、現行の HTML アプリ（`legacy/`）を出発点に、以下を「正」として整備するための場所です。

1. **要件・運用ルールの明文化**（README ＝ このファイル）
2. **データベース設計**（[`docs/02-database-design.md`](docs/02-database-design.md) ＋ [`db/schema.sql`](db/schema.sql)）
3. **システムアーキテクチャ**（[`docs/01-architecture.md`](docs/01-architecture.md)）
4. **API 設計**（[`docs/03-api-design.md`](docs/03-api-design.md)）
5. **既存 JSON からの移行・互換性**（[`docs/04-data-migration.md`](docs/04-data-migration.md)）
6. **セキュリティ・医療コンプライアンス**（[`docs/05-security-compliance.md`](docs/05-security-compliance.md)）
7. **開発ロードマップ**（[`docs/06-roadmap.md`](docs/06-roadmap.md)）
8. **DB 設計レビュー（決定事項）**（[`docs/07-db-design-review.md`](docs/07-db-design-review.md)）
9. **意思決定記録（ADR）**（[`docs/adr/`](docs/adr/)）— 技術スタック等
10. **移行インポータ（実装）**（[`tools/importer/`](tools/importer/)）— 既存 JSON → DB 取り込み

> ⚠️ 現時点ではコードの本実装はまだ着手していません。**まず設計を固める**フェーズです（ロードマップ Phase 0）。

---

## 2. 現行システム（legacy）の全体像

現行は「サーバー・URL 不要、HTML ファイルと LINE だけで完結する」運用です。

```
💻 先生のMac（マスター原本）
   └─ コピーして患者名を付ける ─→ 💬 LINEで送信 ─→ 📱 患者さんのスマホ（Safari→ホーム画面に追加）
                                                          └─ 毎日記録 ─→ 📤 JSON出力 ─→ 💬 LINEで返送
   🩺 先生：総合カルテに JSON を読み込んで確認・施術記録
```

### 2.1 現行アプリ一覧（`legacy/`）

| ファイル | 種別 | 利用者 | 役割 |
|---|---|---|---|
| `gyneco-daily-record.master.html` | 患者用原本 | 婦人科の患者 | 基礎体温・月経・PMS・東洋医学所見・採血・食事などのデイリー記録 |
| `athlete-record.master.html` | 患者用原本 | アスリート | 体組成・トレーニング・栄養・採血・コンディション記録（パスワード保護） |
| `personal-karte.master.html` | 先生専用 | 先生 | 患者 JSON を取り込み、問題リスト・SOAP・施術記録・人体図・AIチャットで管理 |
| `gyneco-record.sample-aachan.html` | 患者個別例 | 特定患者 | 婦人科レコードを患者向けに複製した実例 |
| `manual-simple.html` / `manual-dialogue.html` | マニュアル | 患者 | 使い方ガイド（通常版・対話版） |
| `operations-summary.html` | 運用ガイド | 先生 | 全体の運用フロー・ファイル管理ルール |

### 2.2 現行の技術的特徴と課題

| 項目 | 現状 | 課題（SaaS化で解決したい点） |
|---|---|---|
| データ保存 | ブラウザ `localStorage` | 端末紛失＝データ消失。複数端末で共有できない |
| データ連携 | JSON を手動で LINE 送受信 | 手作業・取り違えリスク。リアルタイム性なし |
| AI（採血OCR・食事解析） | ブラウザから Claude API を直接呼び出し | **API キーがクライアントに露出**（重大リスク）→ サーバー化必須 |
| バックアップ | Google Drive へ手動アップロード | 個人アカウント依存。監査・権限管理なし |
| マルチ患者管理 | ファイルを患者ごとに複製 | スケールしない。集計・横断分析ができない |
| セキュリティ | 一部パスワードのみ | 暗号化・アクセス制御・監査ログ・同意管理なし |

---

## 3. 目指す姿（ターゲット像）

**個人運用の使いやすさを保ったまま、外販可能なマルチテナント医療 SaaS へ。**

- **患者アプリ（PWA / LINE LIFF）**: 現行の「Safari→ホーム画面に追加」体験を維持しつつ、データはクラウドへ自動同期。
- **先生用カルテ（Web）**: 複数患者を横断管理。施術記録・SOAP・人体図・AI 補助。
- **テナント（治療院）単位の分離**: 1 治療院＝1 テナント。他院のデータは一切見えない（Row-Level Security）。
- **LINE 自動受信**: 患者の記録が LINE/LIFF 経由で自動的に DB へ。
- **AI のサーバー化**: Claude API はサーバー経由のみ。キーはサーバーに隔離。
- **医療データの安全管理**: 暗号化・監査ログ・同意管理・3省2ガイドライン準拠を志向。
- **既存 JSON 互換**: 現在の患者が出力した JSON をそのまま取り込めるインポータを用意。

詳細は [`docs/01-architecture.md`](docs/01-architecture.md) を参照。

---

## 4. 推奨技術スタック（提案）

外販・医療データ・マルチテナントを前提とした提案です。確定は Phase 1 のレビューで行います。

| レイヤー | 採用候補 | 理由 |
|---|---|---|
| 患者フロント | **Next.js (React) + TypeScript / PWA + LINE LIFF** | 現行の「ホーム画面追加」体験を維持。LINE 連携が容易 |
| 先生フロント | **Next.js (React) + TypeScript** | 同一コードベースで管理。人体図は Canvas を継承 |
| API / バックエンド | **NestJS (Node + TypeScript)** | 構造化された業務ロジック・LINE Webhook・AI プロキシを集約 |
| データベース | **PostgreSQL**（マネージド: Supabase / Amazon RDS / Cloud SQL） | リレーショナル整合性 ＋ Row-Level Security によるテナント分離 |
| 認証 | 先生＝**メール/IdP**（Supabase Auth / Auth0）、患者＝**LINE Login (LIFF)** | 役割に応じた認証分離 |
| ファイル保存 | **S3 互換オブジェクトストレージ**（暗号化） | 採血画像・食事写真・人体図・メディア |
| AI | **サーバー経由で Claude API**（`claude-sonnet` 系）| キーをサーバーに隔離。OCR・食事解析・カルテ補助 |
| LINE | **LINE Messaging API + LIFF** | 自動受信・通知・患者アプリ配信 |
| ホスティング | フロント: Vercel / API: Fly.io・Render・AWS | 段階的にスケール可能 |

> TypeScript / PostgreSQL を軸にすることで、「息子さん（開発者）のシステム」との連携・引き継ぎも容易になります。

---

## 5. リポジトリ構成

```
withMIKI/
├── README.md                  ← このファイル（全体ルール・運用）
├── docs/
│   ├── 01-architecture.md     システム構成・コンポーネント・データフロー
│   ├── 02-database-design.md  ER 図・テーブル定義・テナント分離・インデックス
│   ├── 03-api-design.md       REST API・認証・LINE Webhook・AI プロキシ
│   ├── 04-data-migration.md   既存 localStorage/JSON → DB マッピング
│   ├── 05-security-compliance.md 医療データ安全管理・同意・監査・暗号化
│   ├── 06-roadmap.md          フェーズ別開発計画・マイルストーン
│   ├── 07-db-design-review.md DB設計レビューと決定事項（共通基盤＋対象別）
│   └── adr/
│       └── 0001-tech-stack-supabase.md  技術スタック確定(ADR)
├── db/
│   ├── schema.sql             PostgreSQL DDL（設計の実体）
│   └── migrations/
│       ├── 0001_init.sql      初期マイグレーション（標準プログラム・検査カタログ）
│       ├── 0002_review_refinements.sql  レビュー反映（RLS全テーブル・索引等）
│       └── 0003_import_compat.sql       既存データ無損失のためのスキーマ補完
├── tools/
│   └── importer/              既存JSON → Supabase 取り込みツール（TypeScript）
└── legacy/                    ← 現行 HTML 原本（設計の元データ・改変禁止）
    ├── gyneco-daily-record.master.html
    ├── athlete-record.master.html
    ├── personal-karte.master.html
    ├── gyneco-record.sample-aachan.html
    ├── manual-simple.html
    ├── manual-dialogue.html
    └── operations-summary.html
```

---

## 6. 開発・運用ルール（厳守）

### 6.1 ブランチ運用
- `main` … 安定版。直接 push 禁止（レビュー経由）。
- 機能開発はトピックブランチで行い、Pull Request 経由でマージする。
- 現在の作業ブランチ: `claude/dazzling-clarke-e2oJu`

### 6.2 `legacy/` の扱い
- `legacy/` は**現行運用中の原本**。**改変・削除禁止**（設計の根拠であり、移行元データ仕様そのもの）。
- 仕様確認は `legacy/` のフォームフィールド・JSON 出力関数を「正」とする。

### 6.3 医療データの取り扱い（最重要）
- **実患者データ（個人情報・医療情報）をリポジトリにコミットしない**。サンプルは必ず架空・匿名化する。
- **API キー・シークレットをコミットしない**（`.env` は `.gitignore`。`*.example` のみ共有）。
- 患者写真・採血画像・JSON エクスポート等の実データを `legacy/` 含めリポジトリへ置かない。
- セキュリティ要件は [`docs/05-security-compliance.md`](docs/05-security-compliance.md) を必須遵守。

### 6.4 設計変更のルール
- DB スキーマ変更は **必ずマイグレーション（`db/migrations/`）として追加**する（既存ファイルの書き換えではなく追番）。
- スキーマを変えたら `docs/02-database-design.md` と `db/schema.sql` を同時に更新する。
- 既存 JSON との互換性に影響する変更は `docs/04-data-migration.md` を更新する。

### 6.5 コミットメッセージ
- 日本語可。`種別: 概要` 形式を推奨（例: `docs: DB設計に同意管理テーブルを追加`）。

---

## 7. 用語集

| 用語 | 意味 |
|---|---|
| テナント (tenant) | 治療院・クリニック単位。データ分離の境界 |
| カルテ (karte) | 先生側の診療記録。基本情報・問題リスト・SOAP・施術記録を含む |
| SOAP | 診療記録法（Subjective / Objective / Assessment / Plan） |
| デイリーレコード | 患者が毎日入力するセルフ記録 |
| BBT | 基礎体温（Basal Body Temperature） |
| 取穴 / 手技 | 鍼灸で用いるツボの選定 / 施術テクニック |
| LIFF | LINE Front-end Framework（LINE 内で動く Web アプリ） |
| RLS | Row-Level Security（行単位アクセス制御） |

---

## 8. 次のステップ

1. 本 README とロードマップのレビュー（Phase 0 完了判定）
2. 技術スタックの確定
3. `db/schema.sql` を基に開発用 PostgreSQL を構築
4. 既存 JSON インポータの実装（最優先：現患者のデータを失わない）

詳細は [`docs/06-roadmap.md`](docs/06-roadmap.md) を参照してください。
