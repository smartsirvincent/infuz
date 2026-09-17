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

/**
 * systemPrompt 加這一段, 提示 Claude 不要產 markdown
 */
export const NO_MARKDOWN_RULE = `
【格式硬規則 · 極重要】
禁止使用任何 markdown 語法 · 包括:
- ** (粗體) / __ (粗體) / ~~ (刪除線) / * _ (斜體)
- # ## ### (標題)
- > (引用)
- \` (行內程式碼) / \`\`\` (code block)
- [文字](網址) 的 markdown 連結格式

原因: Threads / IG / FB 都不解析 markdown, 會直接顯示 ** 這些原始符號, 看起來很亂。
要強調時直接用「」或空行分段就好, 需要放連結直接貼原始 URL (社群平台會自動變成可點連結)。
`;
