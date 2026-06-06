# ADR 0001: 技術スタックを Supabase 基盤に確定する

- ステータス: **承認（Accepted）** — 2026-06
- 関連: [README §4](../../README.md), [01-architecture.md](../01-architecture.md)

## 背景

WithMIKI を外販可能なマルチテナント医療 SaaS へ発展させる（[06-roadmap.md](../06-roadmap.md)）。
個人〜小規模治療院での運用から始め、段階的にスケールしたい。サーバー運用負荷は最小化したい。
重視要件: テナント分離（RLS）・医療データの安全管理・LINE 連携・AI のサーバー化・既存 JSON 互換。

## 決定

**基盤を Supabase に確定する。** 不足分は自前 API / Edge Functions で拡張する（「まず Supabase で素早く、必要に応じ拡張」）。

| レイヤー | 採用 |
|---|---|
| データベース | Supabase Postgres（`db/schema.sql` ＋ `db/migrations/` を適用）|
| テナント分離 | PostgreSQL Row-Level Security（[07 §2.2](../07-db-design-review.md)）|
| 認証 | Supabase Auth（先生）＋ LINE Login/LIFF（患者）|
| ストレージ | Supabase Storage（暗号化・署名付き URL）|
| サーバーロジック / AI プロキシ / LINE Webhook | Supabase Edge Functions（Deno）。重くなれば独立 API（NestJS）へ切り出し |
| フロント | Next.js (React/TS) PWA（患者）＋ Next.js（先生カルテ）|
| 移行インポータ | TypeScript（純関数の変換 ＋ `@supabase/supabase-js` ローダ。`tools/importer/`）|

## 理由

- **立ち上げが速い**: Postgres・Auth・Storage・関数が一体で、初期構築コストが小さい。
- **RLS ネイティブ**: 本設計のテナント分離方針と直結。
- **段階拡張が可能**: ロジックが増えたら Edge Functions → 独立 API へ無理なく移行（DB はそのまま）。
- **引き継ぎ容易**: 標準的な Postgres＋TypeScript。将来「息子さんのシステム」連携や内製化に有利。
- **コスト**: 小規模で低コスト、利用に応じてスケール。

## 留意・代替案

- 代替: 自前 Node+PostgreSQL（自由度高／運用重）、Firebase（RLS 相当が弱く医療データのリレーショナル整合に不利）。→ 不採用。
- ベンダーロックイン: 中核は素の PostgreSQL／TypeScript に寄せ、Supabase 固有機能への依存を限定（移植性を確保）。
- 医療データ: ホスティング先のリージョン・契約・3省2ガイドライン適合を運用主体で確認（[05](../05-security-compliance.md)）。

## 影響

- インポータ（Phase 2）は `@supabase/supabase-js` でローダを実装。変換ロジックは DB 非依存の純関数とし単体テスト可能にする。
- スキーマは `db/schema.sql`＋追番マイグレーションを Supabase に適用して管理する。
