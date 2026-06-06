/** 婦人科デイリーのチップ項目定義（現行 gyneco HTML から完全移植） */

export interface ChipGroup {
  key: string;            // フォーム上のグループキー
  label: string;
  type: 'single' | 'multi';
  col?: string;           // gyneco_daily の型付き列（無ければ payload へ）
  options: [string, string][]; // [value, label]
}

export const GYNECO_CHIPS: ChipGroup[] = [
  { key: 'menstrual', label: '月経', type: 'single', col: 'menstrual', options: [['none','なし'],['period','🔴 月経あり'],['spot','🩸 少量出血'],['implant','着床出血?']] },
  { key: 'flow', label: '経血量', type: 'single', col: 'flow', options: [['少','少'],['中','中'],['多','多'],['大量','大量']] },
  { key: 'bloodState', label: '経血の状態', type: 'multi', col: 'blood_state', options: [['正常','正常'],['血塊あり','血塊あり'],['レバー状','レバー状'],['茶色','茶色'],['黒っぽい','黒っぽい']] },
  { key: 'dischargeAmt', label: 'おりもの量', type: 'single', col: 'discharge_amt', options: [['少','少'],['普通','普通'],['多','多']] },
  { key: 'dischargeState', label: 'おりものの状態', type: 'multi', col: 'discharge_state', options: [['透明・水様','透明・水様'],['白・クリーム','白・クリーム'],['卵白状','卵白状🥚'],['黄色','黄色'],['茶色','茶色'],['血混じり','血混じり'],['においあり','においあり']] },
  { key: 'cervical', label: '頸管粘液', type: 'single', col: 'cervical', options: [['なし','なし'],['粘り少','粘り少'],['粘り多','粘り多'],['卵白状(排卵近)','卵白状(排卵近)']] },
  { key: 'ovTest', label: '排卵検査', type: 'single', col: 'ov_test', options: [['未使用','未使用'],['陰性(−)','陰性(−)'],['陽性(＋)','陽性(＋)'],['強陽性(!)','強陽性(!)']] },
  { key: 'ovPain', label: '排卵期の症状', type: 'multi', col: 'ov_pain', options: [['なし','なし'],['左卵巣痛','左卵巣痛'],['右卵巣痛','右卵巣痛'],['骨盤の重さ','骨盤の重さ'],['腰の張り','腰の張り']] },
  { key: 'sex', label: '性交', type: 'single', col: 'sex', options: [['なし','なし'],['あり','あり']] },
  { key: 'sexNote', label: '性交メモ', type: 'multi', col: 'sex_note', options: [['性交痛あり','性交痛あり'],['出血あり','出血あり'],['避妊あり','避妊あり']] },
  { key: 'breast', label: '乳房', type: 'multi', col: 'breast', options: [['なし','なし'],['張り','張り'],['痛み（左）','痛み（左）'],['痛み（右）','痛み（右）'],['しこり感','しこり感'],['乳頭分泌','乳頭分泌']] },
  { key: 'pmsPhysical', label: 'PMS（身体）', type: 'multi', col: 'pms_physical', options: [['腹部膨満','腹部膨満'],['むくみ','むくみ'],['頭痛','頭痛'],['腰痛','腰痛'],['便秘','便秘'],['下痢','下痢'],['肌荒れ','肌荒れ'],['ニキビ','ニキビ'],['食欲増加','食欲増加']] },
  { key: 'pmsMental', label: 'PMS（精神）', type: 'multi', col: 'pms_mental', options: [['イライラ','イライラ'],['落ち込み','落ち込み'],['不安感','不安感'],['涙もろい','涙もろい'],['集中できない','集中できない'],['過食衝動','過食衝動'],['眠気強い','眠気強い'],['性欲変化','性欲変化']] },
  { key: 'painLocation', label: '痛みの部位', type: 'multi', col: 'pain_location', options: [['下腹部','下腹部'],['腰部','腰部'],['骨盤全体','骨盤全体'],['右卵巣','右卵巣'],['左卵巣','左卵巣'],['排便時','排便時'],['頭痛','頭痛'],['片頭痛','片頭痛']] },
  { key: 'chillArea', label: '冷えの部位', type: 'multi', col: 'chill_area', options: [['手先','手先'],['足先','足先'],['下腹部','下腹部'],['腰','腰'],['全身','全身'],['上熱下寒','上熱下寒']] },
  { key: 'edemaArea', label: 'むくみの部位', type: 'multi', col: 'edema_area', options: [['顔','顔'],['手','手'],['足首','足首'],['ふくらはぎ','ふくらはぎ'],['全身','全身']] },
  { key: 'tongue', label: '舌診', type: 'multi', col: 'tongue', options: [['淡紅（正常）','淡紅（正常）'],['紅（熱）','紅（熱）'],['淡白（虚寒）','淡白（虚寒）'],['暗紫（瘀血）','暗紫（瘀血）'],['白苔','白苔'],['黄苔','黄苔'],['歯痕あり','歯痕あり']] },
  { key: 'oriental', label: '東洋医学所見', type: 'multi', col: 'oriental', options: [['のぼせ','のぼせ'],['ほてり','ほてり'],['動悸','動悸'],['息切れ','息切れ'],['耳鳴り','耳鳴り'],['口渇','口渇'],['手足の痺れ','手足の痺れ']] },
];

/** gyneco_daily に列を持たない追加チップ → daily_record.payload に保存 */
export const GYNECO_EXTRA_CHIPS: ChipGroup[] = [
  { key: 'mood', label: '気分', type: 'single', options: [['😊 良い','😊 良い'],['😐 普通','😐 普通'],['😢 落ち込み','😢 落ち込み'],['😤 イライラ','😤 イライラ'],['😴 眠い','😴 眠い'],['😰 不安','😰 不安'],['🌟 元気','🌟 元気']] },
  { key: 'energy', label: '活力', type: 'single', options: [['高い','高い'],['普通','普通'],['低い','低い'],['とても低い','とても低い']] },
  { key: 'lifestyle', label: '生活', type: 'multi', options: [['アルコールあり','🍷 アルコール'],['カフェイン多め','☕ カフェイン多め'],['甘いもの多め','🍰 甘いもの多め'],['外食','🍽️ 外食']] },
  { key: 'bowel', label: '排便', type: 'single', options: [['なし','なし'],['1回','1回'],['2回以上','2回以上'],['便秘気味','便秘気味'],['下痢気味','下痢気味']] },
  { key: 'stoolState', label: '便の状態', type: 'multi', options: [['普通','普通'],['硬い','硬い'],['軟らかい','軟らかい'],['コロコロ','コロコロ'],['残便感','残便感'],['血混じり','血混じり'],['腹痛あり','腹痛あり']] },
  { key: 'urine', label: '排尿', type: 'multi', options: [['普通','普通'],['頻尿','頻尿'],['少ない','少ない'],['色が濃い','色が濃い'],['排尿時痛み','排尿時痛み']] },
  { key: 'headache', label: '頭痛', type: 'single', options: [['なし','なし'],['片頭痛','片頭痛'],['緊張型頭痛','緊張型頭痛'],['群発頭痛','群発頭痛'],['後頭部痛','後頭部痛'],['頭重感','頭重感']] },
  { key: 'headacheNote', label: '頭痛メモ', type: 'multi', options: [['光過敏','光過敏'],['音過敏','音過敏'],['吐き気あり','吐き気あり'],['拍動性','拍動性'],['目の奥が痛い','目の奥が痛い'],['肩こり伴う','肩こり伴う']] },
  { key: 'skin', label: '肌', type: 'multi', options: [['良好','✨ 良好'],['乾燥','乾燥'],['脂っぽい','脂っぽい'],['ニキビ（あご）','ニキビ（あご）'],['ニキビ（額）','ニキビ（額）'],['ニキビ（頬）','ニキビ（頬）'],['くすみ','くすみ'],['かゆみ','かゆみ'],['敏感肌状態','敏感肌状態'],['むくみ顔','むくみ顔']] },
  { key: 'hair', label: '髪', type: 'multi', options: [['良好','✨ 良好'],['抜け毛多い','抜け毛多い'],['パサつき','パサつき'],['脂っぽい','脂っぽい'],['細くなった','細くなった'],['白髪増えた','白髪増えた']] },
];

export const ALL_GYNECO_CHIPS = [...GYNECO_CHIPS, ...GYNECO_EXTRA_CHIPS];
