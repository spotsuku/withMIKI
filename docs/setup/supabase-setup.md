# Supabase セットアップガイド

WithMIKI の DB（PostgreSQL）を Supabase 上に構築する手順。
スキーマは検証済み（PostgreSQL 16 で `schema.sql`＋`migrations/0001-0003` がクリーンに適用、RLS のテナント分離も動作確認済み）。

---

## 0. 前提

- Supabase アカウント（https://supabase.com）
- 本リポジトリの `db/schema.sql` と `db/migrations/`
- ホスティングリージョンは医療データの取り扱い方針に従って選定（[../05-security-compliance.md](../05-security-compliance.md)）。MVP/個人運用では Tokyo (ap-northeast-1) 推奨。

---

## 1. プロジェクト作成（ダッシュボード）

1. https://supabase.com/dashboard → **New project**。
2. 設定:
   - **Name**: `withmiki`（または `withmiki-staging` / `withmiki-prod`）
   - **Database Password**: 強力なものを生成し、パスワードマネージャに保管（後述の接続に使用）。
   - **Region**: `Northeast Asia (Tokyo)`
   - **Plan**: MVP は Free から開始可。本番・医療データ運用ではガイドライン適合を確認のうえ有料プランを検討。
3. 作成完了後、**Project Settings → API** と **Database** から後述のキー・接続情報を控える。

---

## 2. スキーマ・マイグレーションの適用

### 適用順序（重要）

```
1) db/schema.sql                         … テーブル / インデックス
2) db/migrations/0001_init.sql           … 標準ケアプログラム・検査カタログ（seed）
3) db/migrations/0002_review_refinements.sql … RLS（全業務テーブル）・索引・部分ユニーク
4) db/migrations/0003_import_compat.sql  … 既存データ無損失のためのスキーマ補完
5) db/migrations/supabase/0004_supabase_auth_rls.sql … ★Supabase 専用（後述§3）
6) db/migrations/supabase/0005_patient_portal.sql     … ★患者ポータル（患者PWA用, 後述§9）
```

> `0002` が RLS を一元定義する（`schema.sql` 側では RLS を定義しない＝名前衝突回避）。
> `0004` は **Supabase の `auth.uid()` を使うための上書き**。Supabase では必ず適用する。

### 適用方法 A: SQL Editor（手軽・MVP 向け）

1. ダッシュボード左メニュー **SQL Editor** → **New query**。
2. 上記 1)〜5) のファイル内容を順番に貼り付け → **Run**。各ステップが成功（エラーなし）を確認。

### 適用方法 B: Supabase CLI（推奨・再現性）

```bash
npm i -g supabase
supabase login
supabase link --project-ref <your-project-ref>

# db/migrations を Supabase migrations として管理する場合は supabase/migrations/ に配置。
# 手早く流すなら psql で直接適用（接続文字列は Settings→Database→Connection string）:
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f db/schema.sql
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f db/migrations/0001_init.sql
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f db/migrations/0002_review_refinements.sql
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f db/migrations/0003_import_compat.sql
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f db/migrations/supabase/0004_supabase_auth_rls.sql
```

### 適用確認（期待値）

```sql
select count(*) from information_schema.tables where table_schema='public'; -- 34
select count(*) from pg_policies;                                            -- 31 以上
select code from care_program order by code;                                 -- athlete, gyneco, master
select count(*) from lab_test_catalog;                                       -- 27
```

---

## 3. Supabase 用 RLS（auth.uid() ベース）

コアの `0001-0003` は API が `SET app.tenant_id` を行う前提の **GUC 方式**（自前 API 向け）。
一方 **Supabase はクライアントから PostgREST 経由**で接続するため、テナントは **ログインユーザー（`auth.uid()`）から解決**する必要がある。
これを行うのが `db/migrations/supabase/0004_supabase_auth_rls.sql`：

- `app_user.auth_user_id`（`auth.users.id` への参照）を追加。
- 関数 `app_current_tenant()` … ログインユーザーの所属テナントを返す（GUC も併用可）。
- 既存 `tenant_isolation_*` / `parent_isolation_*` ポリシーを `app_current_tenant()` ベースへ置換。

> これにより、先生が Supabase Auth でログインすると、自分のテナントのデータだけが見える。

---

## 4. 認証ユーザーと初期テナントの作成（ブートストラップ）

MVP（個人運用）では、先生 1 名 = テナント 1 つ。初回のみ以下を実施。

1. **Authentication → Users → Add user** で先生のメール/パスワードを作成（または招待）。作成された `User UID` を控える。
2. SQL Editor で初期テナントと `app_user` を作成し、Auth ユーザーとひも付ける:

```sql
-- テナント作成
insert into tenant (name) values ('みっきー鍼灸院')
  returning id;  -- 返った id を控える（<TENANT_ID>）

-- 先生(app_user)を Auth ユーザーにひも付け
insert into app_user (tenant_id, email, name, role, license_type, auth_user_id)
values ('<TENANT_ID>', 'doctor@example.com', '三木裕昭', 'owner', '鍼灸師/AT',
        '<AUTH_USER_UID>');
```

3. 以降、このユーザーでログインすると `app_current_tenant()` がテナントを解決し、RLS が効く。

---

## 5. ストレージ（画像・採血写真など）

1. **Storage → Create bucket**: `media`（Public OFF＝署名付き URL 運用）。
2. バケットポリシーはテナント分離方針に従って設定（MVP では service role 経由アップロード＋短命署名 URL）。
3. 採血画像・食事写真・人体図は `attachment` テーブルにメタ、本体は Storage に保存（[../02-database-design.md](../02-database-design.md) §4.7）。

---

## 6. 環境変数

カルテアプリ（リポジトリ直下）と各ツールで使用する。**サービスロールキーは絶対にクライアントへ出さない / コミットしない**（[../05-security-compliance.md](../05-security-compliance.md)）。

| 変数 | 用途 | 公開可否 | 取得元 |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase プロジェクト URL | ブラウザ可 | Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 公開 anon キー（RLS 前提） | ブラウザ可 | Settings → API → anon public |
| `SUPABASE_SERVICE_ROLE_KEY` | RLS バイパス（サーバー専用） | **サーバーのみ** | Settings → API → service_role |
| `SUPABASE_DB_URL` | 直接 psql 接続（マイグレーション） | **秘匿** | Settings → Database → Connection string |
| `TENANT_ID` | インポータ `--commit` 投入先テナント | サーバーのみ | §4 で作成した tenant.id |
| `ANTHROPIC_API_KEY` | AI（OCR/食事解析）※将来 | **サーバーのみ** | Anthropic Console |

リポジトリ直下の `.env.local.example` をコピーして `.env.local` を作成し値を設定（[vercel-deploy.md](vercel-deploy.md) も参照）。

---

## 7. RLS 設定の確認ポイント（チェックリスト）

- [ ] `pg_policies` が 31 件以上（全業務テーブルに `tenant_isolation_*`、子テーブルに `parent_isolation_*`）。
- [ ] `0004` 適用後、`app_current_tenant()` 関数が存在する（`select app_current_tenant();` がエラーなく実行）。
- [ ] `app_user.auth_user_id` が作成したログインユーザーの UID とひも付いている。
- [ ] **テナント分離テスト**: 別テナントのユーザーで他院の患者が見えないこと。
- [ ] `lab_test_catalog` は共有マスタのため RLS 対象外（全テナントから参照可）で正しい。
- [ ] anon キーで `service_role` 相当の操作ができないこと（公開キーで書き込み制限が効く）。
- [ ] サービスロールキーがクライアントバンドル（`NEXT_PUBLIC_*` 以外）に含まれていないこと。

---

## 9. 患者ポータル（患者 PWA `patient/`）

患者本人がデイリー記録を入力できるようにする手順（`0005_patient_portal.sql` 適用済み前提）。

1. **Authentication → Users → Add user** で患者のメール/パスワードを作成。`User UID` を控える。
2. SQL Editor で患者を `patient_user` にひも付け:

```sql
insert into patient_user (tenant_id, patient_id, auth_user_id)
values ('<TENANT_ID>', '<PATIENT_ID>', '<患者の AUTH_USER_UID>');
```

3. 患者は `patient/`（PWA・別 Vercel プロジェクト）にそのメール/パスワードでログイン → 当日のデイリーを記録。
4. RLS により患者は**自分の記録だけ**読み書き可能（他患者・他院は不可。実機検証済み）。
5. iOS は Safari で開き「ホーム画面に追加」（現行運用の体験を継承）。

> 将来 LINE ログイン(LIFF)へ置換予定（docs/01-architecture.md §3.6）。

## 8. 次に

→ フロント/デプロイは [vercel-deploy.md](vercel-deploy.md)。
→ 既存患者データの取り込みは [`../../tools/importer/`](../../tools/importer/)（`--commit` に `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`/`TENANT_ID` を渡す）。
