/**
 * 値の正規化ヘルパー。現行 HTML の緩い値（空文字 / NaN / 文字列数値）を
 * DB に入れられる形へ正規化する。「欠損は null、未知は捨てない」が原則。
 * 詳細ルール: docs/04-data-migration.md §3
 */

/** 数値化。空文字 / null / NaN は null。 */
export function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(/,/g, ''));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** 整数化。 */
export function int(v: unknown): number | null {
  const n = num(v);
  return n === null ? null : Math.trunc(n);
}

/** 文字列化。空は null。前後空白除去。 */
export function str(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

/** 文字列配列へ。配列でなければ単値を配列化。空要素は除去。 */
export function arr(v: unknown): string[] {
  if (v === null || v === undefined || v === '') return [];
  if (Array.isArray(v)) {
    return v.map((x) => String(x).trim()).filter((x) => x !== '');
  }
  const s = String(v).trim();
  return s === '' ? [] : [s];
}

/** 真偽値化。 */
export function bool(v: unknown): boolean {
  return v === true || v === 'true' || v === 1 || v === '1';
}

/**
 * 日付正規化 → YYYY-MM-DD。
 * 受理: 'YYYY-MM-DD' / 'YYYY/MM/DD' / Date.parse 可能な文字列。不正は null。
 */
export function date(v: unknown): string | null {
  const s = str(v);
  if (!s) return null;
  const m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (m) {
    const y = m[1];
    const mo = m[2].padStart(2, '0');
    const d = m[3].padStart(2, '0');
    return `${y}-${mo}-${d}`;
  }
  const t = Date.parse(s);
  if (!Number.isNaN(t)) return new Date(t).toISOString().slice(0, 10);
  return null;
}

/** オブジェクトが「中身のある」エントリか（全フィールド空でないか）。 */
export function hasAnyValue(obj: Record<string, unknown>): boolean {
  return Object.values(obj).some((v) => {
    if (v === null || v === undefined || v === '') return false;
    if (Array.isArray(v)) return v.length > 0;
    return true;
  });
}

/** plain object 判定 */
export function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
