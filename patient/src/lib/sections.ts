/** 共有設定のセクション定義（患者が公開/非公開を選ぶ単位） */
export const SHARE_SECTIONS: { key: string; label: string }[] = [
  { key: 'menstrual', label: '月経・おりもの・周期' },
  { key: 'pms', label: 'PMS・症状' },
  { key: 'oriental', label: '舌診・東洋医学所見' },
  { key: 'body', label: '体重・体組成・バイタル' },
  { key: 'selfcare', label: 'セルフケア' },
  { key: 'meds', label: '服薬・サプリ' },
  { key: 'food', label: '食事記録' },
  { key: 'labs', label: '採血' },
  { key: 'media', label: '写真・メディア' },
];
