# 06. 開発ロードマップ

現行 HTML（`legacy/`）を出発点に、外販可能なマルチテナント医療 SaaS へ段階的に移行する計画。
各フェーズは「使える状態」を保ちながら積み上げる（ビッグバン移行はしない）。

---

## フェーズ全体像

| フェーズ | ゴール | 主要成果物 | 状態 |
|---|---|---|---|
| Phase 0 | 設計確定 | 本ドキュメント一式・DB スキーマ・レビュー(07)・ADR | ✅ 完了 |
| Phase 1 | 基盤構築 | リポジトリ/CI、DB 構築、認証、テナント | 🟡 DB/RLS検証済・認証(Supabase)実装 |
| Phase 2 | データ移行 | 既存 JSON インポータ（データを失わない）| 🟡 変換ロジック実装・テスト済 |
| Phase 3 | 先生用カルテ | カルテ Web（基本情報/SOAP/施術/人体図）| 🟡 患者一覧/詳細(閲覧)実装 |
| Phase 4 | 患者アプリ | PWA デイリーレコード（婦人科/アスリート）| 🟡 婦人科デイリーMVP・PWA・患者RLS |
| Phase 5 | AI サーバー化 | OCR/食事解析/カルテ補助のプロキシ | 🟡 API実装・採血OCR/チャット連携 |
| Phase 6 | LINE 連携 | LIFF・自動受信・通知 | ⬜ |
| Phase 7 | 外販準備 | マルチテナント運用・課金・コンプラ仕上げ | ⬜ |

---

## Phase 0 — 設計確定（完了）
- [x] 現行 HTML のデータモデル分析（`legacy/`）
- [x] アーキテクチャ（[01](01-architecture.md)）
- [x] DB 設計：共通基盤＋対象別モジュール＋観測モデル（[02](02-database-design.md), `db/schema.sql`）
- [x] API 設計（[03](03-api-design.md)）
- [x] 移行・互換（[04](04-data-migration.md)）
- [x] セキュリティ（[05](05-security-compliance.md)）
- [ ] **レビュー＆技術スタック確定**（次のアクション）

## Phase 1 — 基盤構築
- [ ] 技術スタック確定（README §4 をベースに）
- [x] 構成（直下＝カルテ Next.js / `patient/` PWA / `tools/importer` / `db` / `docs`）
- [ ] PostgreSQL 構築（`db/schema.sql` 適用）＋ マイグレーションツール導入
- [ ] 認証（先生メール/IdP、患者 LINE）＋ JWT
- [ ] テナント＋ RLS の有効化・テスト
- [ ] CI（lint/test/脆弱性スキャン）、`.env.example` 整備
- **完了条件**: テナント分離がテストで保証され、ログインできる。

## Phase 2 — データ移行（最優先・現患者を守る）
- [x] `source_kind` 自動判定インポータ（`tools/importer/src/detect.ts`）
- [x] 婦人科 full / サマリー、アスリート full、karte_state の変換（`src/parsers/`）
- [x] 変換ロジックの単体テスト（`test/`、架空 JSON で 18 ケース）
- [x] Supabase ローダ（`src/loadSupabase.ts`）＋ CLI（dry-run/--commit）
- [x] 既存データ無損失のためのスキーマ補完（migrations 0003）
- [ ] 婦人科の**全履歴フルエクスポート**手段（現行はサマリーのみ：HTML 側に追加が必要）
- [ ] 実 Supabase での投入結合テスト（DB 構築後）
- [ ] 「インポート → 再エクスポート → 差分ゼロ」回帰テスト
- **完了条件**: 既存患者の JSON を取り込んでも 1 件も失わない。

## Phase 3 — 先生用カルテ Web（リポジトリ直下）
- [x] Supabase Auth ログイン / ログアウト / セッション（middleware）
- [x] 患者一覧（`/patients`）— RLS でテナント分離
- [x] 患者詳細（`/patients/[id]`）— 基本情報/問診/ケアプラン/問題/施術/採血の閲覧
- [x] Vercel デプロイ設定（直下 `vercel.json` / Root Directory = `./`）
- [x] 患者の新規登録 / 基本情報編集（`/patients/new`, `/patients/[id]/edit`）
- [x] 施術記録の新規作成 / 編集 / 削除（`/patients/[id]/visits/new`・`.../edit`）— SOAP・バイタル込み
- [x] 問診（intake）・ケアプラン（cover）の編集（`/patients/[id]/intake/edit`・`/cover/edit`）
- [x] 問題リストの作成/編集/削除 ＋ 問題ひも付け SOAP 経過（`/patients/[id]/problems/...`）
- [x] 採血の入力/編集/削除（手入力、`/patients/[id]/labs/new`・`.../edit`）— カタログ連動
- [x] 人体図（Canvas、front/back マーク）（`/patients/[id]/body`）
- [x] メディア（Storage アップロード＋署名付き URL 表示）（`/patients/[id]/media/new`）
- [x] AI チャット（カルテ補助、サーバープロキシ経由）
- [x] 施術時の全血液検査項目（約60項目・カテゴリ別）
- [x] 問診チェックリスト（CHECK_ITEMS）
- [x] 問診票OCR（/api/ai/intake-scan）
- [x] 推移グラフ（体重・血圧・Hb・フェリチン）
- **完了条件**: 先生が現行 `personal-karte` 相当を Web で行える。→ 達成

## Phase 4 — 患者アプリ（PWA, `patient/`）
- [x] 患者ポータル基盤（`patient_user` ＋ `app_current_patient()` ＋ 本人限定 RLS）= 0005
- [x] 患者ログイン（Supabase Auth）/ ログアウト
- [x] 婦人科デイリー MVP（基礎体温/月経/経血量/痛み/体重/体温/睡眠/メモ）当日 upsert
- [x] PWA manifest（「ホーム画面に追加」体験）
- [x] 婦人科の全項目（月経/おりもの/PMS/舌診/東洋医学/排卵/乳房/痛み 等＋追加チップ）
- [x] アスリートデイリー（体組成・コンディション・傷害）＋トレーニング記録
- [x] 食事記録＋食事写真OCR（/api/ai/food-analysis）
- [x] 推移グラフ（基礎体温・体重・体脂肪・痛み・心拍）
- [x] セルフケア・服薬チェック（Phase I）
- [x] 栄養目標（Phase J）
- [x] 周期予測・カレンダー（Phase K）
- [x] 患者側の採血（OCR含む）・メディア（Phase L）
- [x] LINE ログイン(LIFF)（Phase M, docs/setup/line-liff.md）
- [ ] オフライン保存（IndexedDB）＋ 冪等同期
- **完了条件**: 患者が現行 HTML 相当をクラウド同期付きで使える。→ ほぼ達成

## Phase 5 — AI サーバー化
- [x] AI プロキシ（`/api/ai/lab-ocr`, `/api/ai/food-analysis`, `/api/ai/karte-chat`）— キーはサーバー専用
- [x] 採血 OCR を採血入力フォームに連携（画像→値プレフィル）
- [x] カルテ補助チャット（患者文脈はサーバー側で構築）
- [x] `ai_job` 記録（モデル・トークン・成否）
- [ ] コスト上限・レート制限・同意（consent.ai_analysis）チェック
- [ ] intake-scan（問診票OCR）
- **完了条件**: クライアントに API キーが一切存在しない。

## Phase 6 — LINE 連携
- [ ] LIFF で患者アプリ起動＋本人ひも付け（`line_account`）
- [ ] Webhook 受信（署名検証）→ `line_inbound_message` → 取り込み/通知
- [ ] 先生→患者の通知（次回予約・記録リマインド）
- **完了条件**: 患者の記録が LINE 経由で自動的に DB へ。

## Phase 7 — 外販準備
- [ ] テナント登録・メンバー招待・権限
- [ ] プラン/課金、利用量メータリング（AI コスト等）
- [ ] ケアプログラムの追加 UI（観測モデルで新対象を設定追加）
- [ ] セキュリティ/コンプラ仕上げ（監査・バックアップ訓練・規約）
- [ ] 導入マニュアル（現行 `manual-*.html` を SaaS 版へ更新）
- **完了条件**: 別の治療院がセルフサインアップして安全に使える。

---

## 横断的に常に守ること
- DB 変更は追番マイグレーション＋ドキュメント同時更新（README §6.4）。
- 実データ・シークレットを絶対にコミットしない（[05](05-security-compliance.md)）。
- 本番前必須要件: AI キーのサーバー化 / 認証＋RLS / 暗号化 / 監査ログ。

---

## 次の具体アクション（提案）
1. 本設計のレビュー（特に DB の共通基盤＋対象別モジュール方針）。
2. 技術スタック確定（Supabase ベースで素早く立ち上げ → 必要に応じ自前 API 拡張、が現実的）。
3. Phase 1・2 のチケット化（インポータを最優先で着手）。
