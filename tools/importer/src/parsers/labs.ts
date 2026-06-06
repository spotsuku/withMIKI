import type { LabValue } from '../model.ts';
import { num, str, isObject } from '../normalize.ts';

/**
 * lab_test_catalog に登録済みの検査コード（db/migrations/0001_init.sql と一致）。
 * ここに無いコードは欠損させず value_text に退避する（docs/04 §3）。
 */
export const KNOWN_LAB_CODES = new Set<string>([
  'hb', 'mcv', 'ferritin', 'fe',
  'e2', 'p4', 'fsh', 'lh', 'amh', 'prl',
  'tsh', 'ft4',
  'b12', 'folate', 'vitd', 'zinc', 'mg',
  'ck', 'ldh', 'ua', 'testosterone', 'cortisol',
  'crp', 'hba1c', 'glucose', 'ldl', 'hdl',
]);

/** 現行フィールド名 → カタログコードの別名対応 */
const ALIAS: Record<string, string> = {
  testo: 'testosterone',
};

/** コメント等、検査値でないキー */
const NON_LAB_KEYS = new Set(['id', 'date', 'comment', 'other']);

/**
 * 採血オブジェクト(現行 lab / labHistory[] エントリ)から LabValue[] を生成。
 * - 既知コードは value、未知コードは value_text に退避。
 */
export function labValuesFromObject(obj: unknown): LabValue[] {
  if (!isObject(obj)) return [];
  const out: LabValue[] = [];
  for (const [rawKey, rawVal] of Object.entries(obj)) {
    if (NON_LAB_KEYS.has(rawKey)) continue;
    const code = ALIAS[rawKey] ?? rawKey;
    const n = num(rawVal);
    if (KNOWN_LAB_CODES.has(code)) {
      if (n !== null) out.push({ test_code: code, value: n });
      else {
        const s = str(rawVal);
        if (s) out.push({ test_code: code, value: null, value_text: s });
      }
    } else {
      // 未知コード: 欠損させず value_text として保全（test_code はそのまま）
      const s = str(rawVal);
      if (n !== null) out.push({ test_code: code, value: n });
      else if (s) out.push({ test_code: code, value: null, value_text: s });
    }
  }
  return out;
}

/** lab オブジェクトの comment / other を取り出す */
export function labComment(obj: unknown): string | null {
  if (!isObject(obj)) return null;
  return str(obj.comment) ?? str(obj.other);
}
