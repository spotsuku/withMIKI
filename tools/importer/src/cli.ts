/**
 * WithMIKI インポータ CLI。
 *
 *   # dry-run（既定）: 変換して取り込み内容のサマリを表示。DB へは書き込まない。
 *   node src/cli.ts path/to/data.json
 *
 *   # 種別を強制
 *   node src/cli.ts path/to/data.json --kind=gyneco_full
 *
 *   # 正規化結果を JSON 出力
 *   node src/cli.ts path/to/data.json --json
 *
 *   # Supabase へ投入（要 env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TENANT_ID）
 *   node src/cli.ts path/to/data.json --commit
 *
 * 注意: 実患者データはリポジトリに置かないこと（docs/05-security-compliance.md）。
 */
import { readFileSync } from 'node:fs';
import { transform, summarize } from './transform.ts';
import type { SourceKind } from './model.ts';

async function main() {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith('--'));
  if (!file) {
    console.error('使い方: node src/cli.ts <data.json> [--kind=...] [--json] [--commit]');
    process.exit(1);
  }
  const kindArg = args.find((a) => a.startsWith('--kind='));
  const forceKind = kindArg ? (kindArg.split('=')[1] as SourceKind) : undefined;
  const asJson = args.includes('--json');
  const commit = args.includes('--commit');

  const raw = JSON.parse(readFileSync(file, 'utf-8'));
  const result = transform(raw, forceKind);

  if (asJson) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log('=== 取り込みサマリ (dry-run) ===');
    console.table(summarize(result));
    if (result.warnings.length) {
      console.log('--- 警告 ---');
      for (const w of result.warnings) console.log(' ⚠️ ' + w);
    }
  }

  if (commit) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const tenantId = process.env.TENANT_ID;
    if (!url || !key || !tenantId) {
      console.error('--commit には SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / TENANT_ID が必要です');
      process.exit(1);
    }
    const { loadToSupabase } = await import('./loadSupabase.ts');
    const out = await loadToSupabase(result, { url, serviceRoleKey: key, tenantId });
    console.log('=== Supabase 投入完了 ===');
    console.log('patientId:', out.patientId);
    console.table(out.counts);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
