/** 先生→患者への公開単位（基本カルテのどの部分を患者に見せるか）。既定はすべて公開。 */
export const KARTE_SECTIONS: { key: string; label: string }[] = [
  { key: 'careplan', label: 'ケアプラン' },
  { key: 'intake', label: '問診' },
  { key: 'problems', label: '問題リスト' },
  { key: 'visits', label: '施術記録' },
  { key: 'labs', label: '採血' },
];
