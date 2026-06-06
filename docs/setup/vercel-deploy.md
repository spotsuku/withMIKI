# Vercel デプロイガイド（先生用カルテ Web）

`apps/karte`（Next.js）を Vercel にデプロイする手順。前提として [supabase-setup.md](supabase-setup.md) が完了していること。

> このリポジトリは **モノレポ**（`apps/karte`, `tools/importer`, `db/`, `docs/`）。
> Vercel では **Root Directory を `apps/karte`** に設定するのが要点。

---

## 1. 事前準備

- GitHub リポジトリ: `spotsuku/withMIKI`
- Supabase の値（[supabase-setup.md §6](supabase-setup.md)）:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - （任意）`SUPABASE_SERVICE_ROLE_KEY` … サーバー専用。MVP の閲覧機能だけなら不要。
- ローカル動作確認:
  ```bash
  cd apps/karte
  cp .env.local.example .env.local   # 値を設定
  npm install
  npm run dev                        # http://localhost:3000
  npm run build                      # 本番ビルド確認（検証済み）
  ```

---

## 2. Vercel プロジェクト作成（ダッシュボード）

1. https://vercel.com → **Add New… → Project**。
2. **Import Git Repository** で `spotsuku/withMIKI` を選択（初回は GitHub 連携を承認）。
3. **Configure Project**:
   - **Root Directory**: **`apps/karte`** を指定（Edit → apps/karte を選択）。★最重要
   - **Framework Preset**: `Next.js`（自動検出）。
   - **Build Command**: `next build`（既定。`apps/karte/vercel.json` でも指定済み）。
   - **Install Command**: `npm install`（既定）。
   - **Node.js Version**: 20.x 以上。
4. **Environment Variables**（次節）を設定。
5. **Deploy**。

---

## 3. 環境変数の設定（Vercel）

**Project → Settings → Environment Variables** で設定。各値の取得元は [supabase-setup.md §6](supabase-setup.md)。

| 変数 | 値 | 対象環境 | 備考 |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL | Production / Preview / Development | 公開値 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon public key | Production / Preview / Development | 公開値（RLS 前提） |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key | Production のみ（必要時） | **NEXT_PUBLIC を付けない**。サーバー専用 |
| `ANTHROPIC_API_KEY` | Claude API キー | Production（AI 機能を使う場合） | **NEXT_PUBLIC を付けない**。`/api/ai/*` 用 |
| `ANTHROPIC_MODEL` | `claude-sonnet-4-6` | 任意 | 未設定なら既定値 |

> ⚠️ `SUPABASE_SERVICE_ROLE_KEY` に **`NEXT_PUBLIC_` を付けないこと**。付けるとクライアントバンドルに含まれ漏洩する。
> 変数変更後は **Redeploy** が必要。

---

## 4. GitHub 連携と自動デプロイ

Vercel は GitHub と連携すると以下を自動化する:

- **`main` への push → Production デプロイ**
- **`staging` / その他ブランチ・PR への push → Preview デプロイ**（プレビュー URL 発行）

推奨運用（本リポジトリのブランチ方針と整合）:
- 開発はトピックブランチ → PR（Preview で確認）→ `staging`（結合）→ `main`（本番）。
- Production Branch を Vercel 側で `main` に設定。

---

## 5. デプロイコマンド（CLI、任意）

ダッシュボード運用で十分だが、CLI も使える:

```bash
npm i -g vercel
cd apps/karte
vercel            # 初回: プロジェクトひも付け（Root Directory を apps/karte に）
vercel pull       # 環境変数をローカルへ取得
vercel build      # ローカルで本番ビルド
vercel deploy --prebuilt          # Preview デプロイ
vercel deploy --prebuilt --prod   # Production デプロイ
```

---

## 6. デプロイ後チェック

- [ ] トップ `/` → `/patients` にリダイレクト。未ログインなら `/login` へ。
- [ ] Supabase 未設定だと `/patients` に設定案内（notice）が出る → 環境変数を確認。
- [ ] `/login` で先生アカウント（[supabase-setup.md §4](supabase-setup.md)）でログインできる。
- [ ] ログイン後、自テナントの患者だけが一覧に出る（RLS）。
- [ ] 患者詳細 `/patients/[id]` で問診・ケアプラン・施術・採血が表示される。
- [ ] ログアウトで `/login` に戻る。
- [ ] ブラウザの devtools で `service_role` キーが露出していない（`NEXT_PUBLIC_` 以外がバンドルに無い）。

---

## 7. よくある詰まり

| 症状 | 原因 / 対処 |
|---|---|
| ビルドは通るが 404/500 | Root Directory が `apps/karte` になっていない |
| ログインできるが患者が 0 件 | `app_user.auth_user_id` 未ひも付け、または別テナント（supabase §4）|
| `Invalid API key` | 環境変数の貼り間違い / 変更後に Redeploy していない |
| Middleware で Edge 警告 | `@supabase/ssr` 由来の既知の警告。動作に影響なし |
| 患者が見えない（RLS で全拒否） | `0004_supabase_auth_rls.sql` 未適用（supabase §3）|

---

## 8. 次に

- 既存患者データの取り込み: [`../../tools/importer/`](../../tools/importer/)（`--commit`）。
- 認証強化（MFA）、施術記録の新規作成 UI、患者 PWA（Phase 4）は [../06-roadmap.md](../06-roadmap.md)。
