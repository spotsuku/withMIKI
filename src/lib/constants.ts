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

export interface VitalField { code: string; label: string; unit?: string; ph?: string; text?: boolean }
export interface VitalGroup { category: string; items: VitalField[] }

/** visit_vital に型付き列を持つコード（それ以外は extra jsonb へ） */
export const VITAL_TYPED_COLS = new Set<string>([
  'weight', 'fat', 'bmi', 'temp', 'sbp', 'dbp', 'hr', 'spo2',
  'hb', 'ht', 'rbc', 'mcv', 'mch', 'ferritin', 'fe', 'tibc', 'tsat', 'retic', 'b12',
]);

/** 施術記録の全バイタル・血液検査項目（現行 personal-karte の LAB_KEYS を完全移植） */
export const VISIT_VITAL_GROUPS: VitalGroup[] = [
  { category: 'バイタル・体組成', items: [
    { code: 'weight', label: '体重', unit: 'kg', ph: '55.0' },
    { code: 'fat', label: '体脂肪率', unit: '%', ph: '22.0' },
    { code: 'bmi', label: 'BMI', ph: '21.5' },
    { code: 'temp', label: '体温', unit: '℃', ph: '36.5' },
    { code: 'sbp', label: '収縮期血圧', unit: 'mmHg', ph: '120' },
    { code: 'dbp', label: '拡張期血圧', unit: 'mmHg', ph: '80' },
    { code: 'hr', label: '脈拍', unit: 'bpm', ph: '72' },
    { code: 'spo2', label: 'SpO₂', unit: '%', ph: '98' },
  ]},
  { category: '血算', items: [
    { code: 'hb', label: 'Hb ヘモグロビン', unit: 'g/dL', ph: '13.5' },
    { code: 'ht', label: 'Ht ヘマトクリット', unit: '%', ph: '40.0' },
    { code: 'rbc', label: 'RBC 赤血球', unit: '万/μL', ph: '450' },
    { code: 'mcv', label: 'MCV 平均赤血球容積', unit: 'fL', ph: '90' },
    { code: 'mch', label: 'MCH 平均赤血球Hb', unit: 'pg', ph: '30' },
    { code: 'wbc', label: 'WBC 白血球', unit: '×10³/μL', ph: '6.0' },
    { code: 'neut', label: '好中球', unit: '%', ph: '60' },
    { code: 'lymph', label: 'リンパ球', unit: '%', ph: '30' },
    { code: 'plt', label: '血小板', unit: '×10⁴/μL', ph: '22' },
  ]},
  { category: '鉄代謝', items: [
    { code: 'ferritin', label: 'フェリチン', unit: 'ng/mL', ph: '30' },
    { code: 'fe', label: '血清鉄', unit: 'μg/dL', ph: '100' },
    { code: 'tibc', label: 'TIBC 総鉄結合能', unit: 'μg/dL', ph: '300' },
    { code: 'tsat', label: 'トランスフェリン飽和度', unit: '%', ph: '33' },
    { code: 'retic', label: '網状赤血球', unit: '%', ph: '1.0' },
  ]},
  { category: '栄養・ビタミン・微量元素', items: [
    { code: 'b12', label: 'ビタミンB12', unit: 'pg/mL', ph: '500' },
    { code: 'folate', label: '葉酸', unit: 'ng/mL', ph: '8.0' },
    { code: 'vitd', label: 'ビタミンD', unit: 'ng/mL', ph: '40' },
    { code: 'zinc', label: '亜鉛', unit: 'μg/dL', ph: '100' },
    { code: 'mg', label: 'マグネシウム', unit: 'mg/dL', ph: '2.2' },
    { code: 'cu', label: '銅', unit: 'μg/dL', ph: '110' },
  ]},
  { category: '炎症', items: [
    { code: 'crp', label: 'CRP', unit: 'mg/dL', ph: '0.10' },
    { code: 'esr', label: 'ESR 赤沈', unit: 'mm/h', ph: '10' },
  ]},
  { category: '女性ホルモン', items: [
    { code: 'e2', label: 'E2 エストラジオール', unit: 'pg/mL', ph: '50' },
    { code: 'p4', label: 'P4 プロゲステロン', unit: 'ng/mL', ph: '1.0' },
    { code: 'fsh', label: 'FSH', unit: 'mIU/mL', ph: '8.0' },
    { code: 'lh', label: 'LH', unit: 'mIU/mL', ph: '5.0' },
    { code: 'amh', label: 'AMH', unit: 'ng/mL', ph: '2.0' },
    { code: 'prl', label: 'PRL プロラクチン', unit: 'ng/mL', ph: '12' },
    { code: 'testo', label: 'テストステロン', unit: 'ng/dL', ph: '30' },
    { code: 'dheas', label: 'DHEA-S', unit: 'μg/dL', ph: '150' },
  ]},
  { category: '甲状腺', items: [
    { code: 'tsh', label: 'TSH', unit: 'μIU/mL', ph: '2.0' },
    { code: 'ft4', label: 'FT4 遊離T4', unit: 'ng/dL', ph: '1.20' },
    { code: 'ft3', label: 'FT3 遊離T3', unit: 'pg/mL', ph: '3.0' },
    { code: 'tpo', label: '抗TPO抗体', unit: 'IU/mL', ph: '10' },
    { code: 'tgab', label: '抗Tg抗体', unit: 'IU/mL', ph: '10' },
  ]},
  { category: '脂質・代謝', items: [
    { code: 'ldl', label: 'LDL', unit: 'mg/dL', ph: '120' },
    { code: 'hdl', label: 'HDL', unit: 'mg/dL', ph: '60' },
    { code: 'tg', label: '中性脂肪', unit: 'mg/dL', ph: '100' },
    { code: 'hba1c', label: 'HbA1c', unit: '%', ph: '5.5' },
    { code: 'glucose', label: '空腹時血糖', unit: 'mg/dL', ph: '95' },
    { code: 'insulin', label: '空腹時インスリン', unit: 'μU/mL', ph: '5.0' },
    { code: 'homaIR', label: 'HOMA-IR', ph: '1.1' },
    { code: 'ua', label: '尿酸', unit: 'mg/dL', ph: '4.5' },
  ]},
  { category: '肝・腎機能', items: [
    { code: 'alt', label: 'ALT', unit: 'U/L', ph: '20' },
    { code: 'ast', label: 'AST', unit: 'U/L', ph: '20' },
    { code: 'ggt', label: 'γ-GTP', unit: 'U/L', ph: '20' },
    { code: 'cre', label: 'クレアチニン', unit: 'mg/dL', ph: '0.70' },
    { code: 'egfr', label: 'eGFR', unit: 'mL/分/1.73㎡', ph: '80' },
  ]},
  { category: '尿検査', items: [
    { code: 'upro', label: '尿蛋白' },
    { code: 'uglc', label: '尿糖' },
    { code: 'uph', label: '尿pH', ph: '6.0' },
    { code: 'uocc', label: '尿潜血' },
    { code: 'umg', label: '尿中マグネシウム', ph: '排泄量など' },
  ]},
  { category: 'その他', items: [
    { code: 'labother', label: '自由記述', text: true, ph: '例：Dダイマー=0.8、抗核抗体 陰性、CA125=12…' },
  ]},
];

/** 全バイタルコード一覧 */
export const ALL_VITAL_CODES: string[] = VISIT_VITAL_GROUPS.flatMap((g) => g.items.map((i) => i.code));

export const SEX_OPTIONS = ['女性', '男性', 'その他'] as const;

/** 問診チェックリスト（現行 personal-karte CHECK_ITEMS） */
export const CHECK_ITEMS: string[] = [
  '大きな病気にかかったことがある',
  '肝炎にかかったことがある / 輸血を受けたことがある',
  '血圧が高い（低い）と言われたことがある',
  '特異体質・アレルギーといわれたことがある',
  '生理が不順なことが多い / 生理痛が強い（女性のみ）',
];

/** 問題リストのステータス（value は DB 保存値） */
export const PROBLEM_STATUS: { value: string; label: string }[] = [
  { value: 'active', label: '進行中' },
  { value: 'monitoring', label: '経過観察' },
  { value: 'resolved', label: '解決' },
];

export function problemStatusLabel(value: string | null): string {
  return PROBLEM_STATUS.find((s) => s.value === value)?.label ?? value ?? '';
}
