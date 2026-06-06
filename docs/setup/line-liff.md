# LINE LIFF ログイン設定ガイド（患者用 PWA）

患者が LINE でログインして `patient/` アプリを使うための設定。LINE Developers のチャネルが必要です。

## 仕組み
1. 患者が LIFF（`/liff`）を開く → LINE ログイン → idToken 取得
2. `/api/auth/line` が idToken を LINE で検証 → `line_account` で患者を特定
3. その患者の Supabase アカウントの OTP を発行 → クライアントでセッション確立 → `/today`

> 事前に「LINE ユーザー ⇄ 患者」のひも付け（`line_account`）と「患者 ⇄ Supabase Auth」のひも付け（`patient_user`）が必要です。

## 手順
1. **LINE Developers** でプロバイダー作成 →「LINE Login」チャネル作成。
2. チャネルに **LIFF アプリ**を追加（Endpoint URL = `https://<患者アプリのドメイン>/liff`、Scope: `openid profile`）。発行された **LIFF ID** を控える。
3. チャネルの **Channel ID** を控える。
4. 患者アプリ（Vercel）の環境変数:
   - `NEXT_PUBLIC_LIFF_ID` = LIFF ID
   - `LINE_LOGIN_CHANNEL_ID` = Channel ID
   - `SUPABASE_SERVICE_ROLE_KEY` = service role（OTP 発行に必要）
5. 患者のひも付け（SQL Editor、初回のみ）:
   ```sql
   -- LINE userId は LIFF の profile.userId（先生が患者から取得）
   insert into line_account (tenant_id, patient_id, line_user_id)
   values ('<TENANT_ID>', '<PATIENT_ID>', '<LINE_USER_ID>');
   -- 併せて patient_user（Supabase Auth）も作成済みであること（supabase-setup.md §9）
   ```
6. 患者に LIFF の URL（または LINE 公式アカウントのリッチメニュー）を案内。

## 注意
- `SUPABASE_SERVICE_ROLE_KEY` はサーバー専用（`NEXT_PUBLIC_` を付けない）。
- メール/パスワードログイン（`/login`）も併用可能。LIFF 未設定でも通常ログインで動作します。
