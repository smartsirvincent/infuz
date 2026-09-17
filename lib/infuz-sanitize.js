// 產文 sanitize · 去除 markdown 語法 (Threads / IG / FB 都不解析 markdown, 會顯示原字元)
// 所有 AI 產文入口 (topic produce / realtime / suggest-copy / suggest-slogan) 都要跑一遍
// 也可以塞進 systemPrompt 提示 Claude 別產, 但這裡是最後保險

/**
 * 移除 markdown 語法, 保留純文字
 * - **bold** / __bold__ → bold
 * - *italic* / _italic_ → italic (小心中文 · 只處理成對且無空格)
 * - ~~strike~~ → strike
 * - # heading (行首) → 只留文字
 * - > blockquote (行首) → 只留文字
 * - `code` → code
 * - [text](url) → text url (Threads/IG/FB 會自動辨識 URL, 分開反而清楚)
 * - horizontal rule --- === ___ (整行只有這些字元) → 空行
 */
export function stripMarkdown(text) {
  if (!text || typeof text !== 'string') return text;
  return text
    // bold **xxx** / __xxx__ (至少 1 字, 非貪婪)
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    // strikethrough
    .replace(/~~(.+?)~~/g, '$1')
    // heading 行首 (含空格)
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    // blockquote 行首
    .replace(/^\s{0,3}>\s+/gm, '')
    // inline code (單一 backtick 環繞, 且內容無空 backtick)
    .replace(/`([^`\n]+)`/g, '$1')
    // link [text](url) → text url
    .replace(/\[([^\]\n]+)\]\(([^)\n]+)\)/g, '$1 $2')
    // 水平線 (整行只有 --- === ___)
    .replace(/^\s*(?:-{3,}|={3,}|_{3,})\s*$/gm, '')
    // italic (單星號/底線, 只處理明確成對, 不誤傷中文 * · 要求 * 兩側非空白)
    .replace(/\*(\S(?:[^*\n]*\S)?)\*/g, '$1')
    // 收尾: 三個以上連續空行 → 兩個
    .replace(/\n{3,}/g, '\n\n')
    .trimEnd();
}

// 額外移除文案內裸露的 Cloudinary 圖片 URL / 產品參考照 URL
// Claude 有時會把 productHint 內的 image_front URL 抄進文案, 這裡兜底
// 也移除任何 cloudinary image upload 的 URL
export function stripBareImageUrls(text) {
  if (!text || typeof text !== 'string') return text;
  return text
    .replace(/https?:\/\/res\.cloudinary\.com\/[^\s]+/gi, '')
    .replace(/https?:\/\/\S+\.(?:jpg|jpeg|png|webp|gif|avif)(?:\?\S*)?/gi, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * systemPrompt 加這一段, 提示 Claude 不要產 markdown, 也不要在文案內貼 URL
 */
export const NO_MARKDOWN_RULE = `
【格式硬規則 · 極重要】
1. 禁止使用任何 markdown 語法:
   - ** __ (粗體) / ~~ (刪除線) / * _ (斜體)
   - # ## ### (標題) / > (引用)
   - \` (行內程式碼) / \`\`\` (code block)
   - [文字](網址) 的 markdown 連結格式

2. 絕不要在文案中放任何 URL / 網址 / 連結 / 圖片路徑:
   - 不要複製產品照 URL 或參考照 URL 到文案 (那只是給你判讀產品用的, 不是要出現在貼文)
   - 不要編任何 https:// 或 www. 開頭的網址
   - 如果需要導購連結, 系統會在文末自動附上 (你不用寫)

原因: Threads / IG / FB 不解析 markdown 會顯示原字元;裸貼圖片 URL 看起來很亂且沒必要 (圖片會直接以附件形式呈現)。
要強調用「」或空行分段。
`;
