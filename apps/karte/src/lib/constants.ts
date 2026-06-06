/** 施術記録フォームで使う選択肢・項目定義 */

/** 処置（treatments, 複数選択） */
export const TREATMENT_OPTIONS = [
  '鍼',
  '灸',
  '手技療法',
  '電気療法',
  'テーピング',
  'カッピング',
  '骨格・骨盤矯正',
  '運動指導',
  '物理療法',
] as const;

/** 施術時バイタル（visit_vital の型付き列のうちフォームに出す項目） */
export const VITAL_FIELDS: { key: string; label: string; unit?: string; step?: string }[] = [
  { key: 'weight', label: '体重', unit: 'kg', step: '0.1' },
  { key: 'fat', label: '体脂肪', unit: '%', step: '0.1' },
  { key: 'bmi', label: 'BMI', step: '0.1' },
  { key: 'temp', label: '体温', unit: '℃', step: '0.1' },
  { key: 'sbp', label: '収縮期血圧', unit: 'mmHg' },
  { key: 'dbp', label: '拡張期血圧', unit: 'mmHg' },
  { key: 'hr', label: '心拍', unit: 'bpm' },
  { key: 'spo2', label: 'SpO2', unit: '%' },
];

export const SEX_OPTIONS = ['女性', '男性', 'その他'] as const;

/** 問題リストのステータス（value は DB 保存値） */
export const PROBLEM_STATUS: { value: string; label: string }[] = [
  { value: 'active', label: '進行中' },
  { value: 'monitoring', label: '経過観察' },
  { value: 'resolved', label: '解決' },
];

export function problemStatusLabel(value: string | null): string {
  return PROBLEM_STATUS.find((s) => s.value === value)?.label ?? value ?? '';
}
