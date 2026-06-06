# 予約システム設定ガイド

先生用カルテに統合された予約機能（予約管理・公開予約ページ・Google Calendar連携・通知）の設定。

## 概要
- 先生: `/appointments` で週次の予約管理、`/appointments/slots` で空き枠の設定、公開予約リンクの発行。
- 患者（公開・ログイン不要）: `/book/[token]` で空き枠から予約 → `/appointment/[token]` で確認・キャンセル。
- 確定時に Google Calendar へ自動登録、メール（Resend）/LINE で通知、24時間前リマインダー（Cron）。

## 必要なマイグレーション
`db/supabase_all.sql` を Supabase で再実行（`0011` で appointments / appointment_slots / tenant_settings を作成。冪等）。

## 環境変数（Vercel・先生用プロジェクト）
| 変数 | 用途 | 必須 |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | 公開予約ページのデータ取得・通知 | 予約に必須 |
| `APP_BASE_URL` | 通知内リンクの生成（例 `https://with-miki.vercel.app`）| 通知時 |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI` | Google Calendar 連携 | 任意 |
| `RESEND_API_KEY` / `RESEND_FROM` | 予約メール通知 | 任意 |
| `LINE_CHANNEL_ACCESS_TOKEN` | LINE 通知（Messaging API）| 任意 |
| `CRON_SECRET` | リマインダーCronの保護 | 任意 |

## Google Calendar 連携手順
1. Google Cloud でOAuthクライアント（Webアプリ）を作成。
2. 承認済みリダイレクトURIに `https://<ドメイン>/api/google/callback` を登録。
3. 上記 `GOOGLE_*` をVercelに設定。
4. `/appointments` の「Googleカレンダーと連携」をクリックして認可。
5. 「Googleの予定を取り込む」で既存予定を空き枠ブロックに反映。確定予約はGoogleへ自動登録。

## メール（Resend）
1. [resend.com](https://resend.com) でAPIキー発行、送信ドメイン認証。
2. `RESEND_API_KEY` / `RESEND_FROM` を設定。

## LINE 通知
1. LINE Developers で **Messaging API** チャネルを作成し、チャネルアクセストークンを発行。
2. `LINE_CHANNEL_ACCESS_TOKEN` を設定。
3. 患者の `line_account`（line_user_id）がひも付いていれば、確定/キャンセル/リマインダーがLINEに届く。

## リマインダー（24時間前）
- `vercel.json` の crons で `/api/cron/reminders` を毎時実行（Vercel Cron）。
- 23〜25時間後に始まる確定予約へ通知し、二重送信を防止。
- 外部スケジューラを使う場合は `CRON_SECRET` を設定し `?key=` か `Authorization: Bearer` で呼び出す。

## 使い方（先生）
1. `/appointments/slots` で空き枠を追加（または Google から取り込み）。
2. `/appointments` の「公開予約リンク」を患者へ送付（患者詳細の「予約リンクを送る」からLINE送信も可）。
3. 患者がオンライン予約 → `/appointments` に「申込」として表示 → 「確定」で確定＋通知＋Google登録。
