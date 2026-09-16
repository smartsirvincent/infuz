// Threads 高互動貼文 · 7 個 archetype 池
// 依據 2025 台灣 Threads 爆文研究:見 CLAUDE.md 對應 commit
// produce 時每篇隨機挑一個 archetype, 讓連續發文有變化

export const ENGAGEMENT_ARCHETYPES = [
  {
    key: 'help_call',
    name: '脆友求助 (內圈感召集令)',
    hint: '開場「有台灣人在嗎?」丟出低門檻、地點時間物品明確的求助, 激發台灣人幫忙癖',
    hookPattern: '「有 XX 的人在嗎?」/「在 OO 求救...」/「XX 有推薦嗎?」',
    example: '有台灣人在仁川機場嗎? 忘記買牛奶了 · 現在急需 (誇張版) 求一盒',
  },
  {
    key: 'contrast_mismatch',
    name: '反差錯置 (畫面/文案落差)',
    hint: '溫馨或正常口吻配荒謬情境, 落差感創造 hook',
    hookPattern: '「我爸從來不會讓我失望」/「終於等到這一天」/「原來我一直誤會了」+ 荒謬展開',
    example: '「我媽對我的愛」(接一個很日常但很誇張的行為)',
  },
  {
    key: 'shared_experience',
    name: '共同經驗接龍',
    hint: '給讀者「比爽」或「比慘」的接龍空間 · 具體場景+開放式問句就成',
    hookPattern: '「這種 XX 只有我遇過嗎?」/「大家有沒有 OO 的經驗?」/「今天終於發生 YY」',
    example: '早餐店阿姨記得我 5 年的餐點 · 大家有這種被記得的瞬間嗎',
  },
  {
    key: 'warm_story',
    name: '溫馨小故事',
    hint: '陌生人善意/家人無聲關心/日常療癒/老一輩的話 · 感人不狗血 · 結尾一句餘韻',
    hookPattern: '「今天在 XX 遇到...」/「回家發現 OO」/「原本以為 PP · 沒想到...」/「我媽/阿嬤說了一句話」',
    example: '搭計程車 · 司機說今天女兒生日 · 講到眼睛紅了 · 下車時我多給了他小費 · 他堅持不收',
  },
  {
    key: 'binary_choice',
    name: '二選一逼你選',
    hint: '「只能選一個, 你選 A 還是 B?」逼路人自曝立場, 熟悉品項對決',
    hookPattern: '「一輩子只能吃一個 · A vs B?」/「非要選的話...」',
    example: '一輩子只能喝一杯: 珍珠奶茶還是可樂? 我先選珍奶',
  },
  {
    key: 'weird_combo',
    name: '獵奇食物/反直覺搭配',
    hint: '「香菜冰淇淋」型不合常理但真的有人愛的組合, 激發爭辯',
    hookPattern: '「原來 XX 加 YY 這麼好吃」/「有人也吃過 OO+PP 的嗎」/「別人都以為我怪, 但 XX...」',
    example: '滷肉飯加花生醬真的很好吃 大家不要笑我',
  },
  {
    key: 'insider_tip',
    name: '熟客才知道 (冷知識/內行密技)',
    hint: '「圈內密技」讓人想留言補充自己版本',
    hookPattern: '「XX 熟客都會這樣點...」/「其實 OO 這樣做才最順...」/「10 年老鳥告訴你...」',
    example: '飲料店微糖少冰放 10 分鐘再喝才最香 大家都怎麼喝',
  },
  {
    key: 'daily_vent',
    name: '廢話認同型 (都會語錄/職場尷尬)',
    hint: '一句戳到共同回憶的廢話, 愈廢愈紅',
    hookPattern: '「有沒有一種 XX 叫 YY」/「上班第 N 年 · 我終於學會 OO」/「原來這才叫 PP」',
    example: '有沒有一種餓叫剛吃飽兩小時的餓',
  },
];

/**
 * 隨機挑一個 archetype (依 index 讓連續發文能輪流不重複)
 */
export function pickArchetype(index = 0) {
  return ENGAGEMENT_ARCHETYPES[index % ENGAGEMENT_ARCHETYPES.length];
}

/**
 * 從 name/description 猜 archetype key (不強制 · 若 topic 名稱有 hint 就用它, 否則隨機)
 */
export function inferArchetype(topicName = '') {
  const name = (topicName || '').toLowerCase();
  if (/求助|求救|推薦|哪裡/i.test(name)) return ENGAGEMENT_ARCHETYPES[0];
  if (/反差|荒謬/i.test(name)) return ENGAGEMENT_ARCHETYPES[1];
  if (/共同|經驗|接龍|大家/i.test(name)) return ENGAGEMENT_ARCHETYPES[2];
  if (/溫馨|療癒|感人|善意|溫暖/i.test(name)) return ENGAGEMENT_ARCHETYPES[3];
  if (/二選|選擇|vs|對決/i.test(name)) return ENGAGEMENT_ARCHETYPES[4];
  if (/獵奇|反直覺|奇怪/i.test(name)) return ENGAGEMENT_ARCHETYPES[5];
  if (/冷知識|密技|老鳥|熟客/i.test(name)) return ENGAGEMENT_ARCHETYPES[6];
  if (/廢話|語錄|職場|上班/i.test(name)) return ENGAGEMENT_ARCHETYPES[7];
  return null;
}

/**
 * 高互動貼文的硬規則 (寫進 systemPrompt) · 依 Threads 2025 演算法 + 台灣文化調校
 */
export const ENGAGEMENT_HARD_RULES = `
【Threads 高互動貼文 · 硬規則 (違反直接重寫)】

1. 完全不提品牌、產品、購買、折扣、hashtag。 這篇的目標是「拉聲量」不是「賣東西」。

2. 全文 30-180 字, 硬上限 200 字 (短一點也可以, 一句金句也算)。
   - 第一行 hook ≤ 25 字 · 必須是問句 / 反差 / 場景 / 溫馨畫面 / 數字 / 爭議 / 清單 其中一種
   - 每 1-2 句就換行留白, 像 LINE 訊息不是作文
   - Emoji 全篇最多 2 個, 且不放行首
   - 禁止 hashtag, 禁止外部 URL

3. 結尾可留鉤子 (但不強制每篇都有):
   - 討論型:「你都怎麼 XX?」「A 還 B?」「還有嗎?」讓路人 5 秒內能答
   - 溫馨型:留一句感觸就好, 不需要問話, 讓人自然想留言分享
   - 選對節奏比硬套 CTA 重要

4. 語感像深夜傳 LINE 給朋友:
   - 口語、去修飾詞
   - 禁用「各位」「大家好」「分享一個」這類自媒體口氣
   - 禁用「落地」「閉環」「賦能」「復盤」等對岸網路詞
   - 用台灣人日常真的會講的話

5. 絕對不能碰的話題 (Meta 會降推 + 留言區品質崩壞):
   - 政黨、候選人姓名、選舉、政策辯論
   - 疫苗、藥品、療效、健康醫療爭議
   - 戰男女 / 戰世代 / 戰種族 / 戰地域 / 戰南北
   - 中國政治敏感詞
   - 死亡/自殺/家暴 等重度話題

6. 溫馨故事類特別注意:
   - 感人不狗血, 不要哭腔、不要「淚崩」「不敢相信」這類過度渲染
   - 具體細節取勝 (時間/地點/對話), 別靠形容詞堆疊
   - 結尾一句餘韻就夠, 別總結道理
`;
