// 發文失敗通知 · Gmail SMTP → smartsir@gmail.com
// env 需設: GMAIL_USER, GMAIL_APP_PASSWORD (16 位應用程式密碼)
// 可選:   NOTIFY_EMAIL_TO (預設同 GMAIL_USER)
import nodemailer from 'nodemailer';

const TOKEN_PATTERN = /access[ _]?token|session|password|invalidated|expired|OAuthException|reauth|token 失效|token 過期/i;

let _transporter = null;
function getTransporter() {
  if (_transporter) return _transporter;
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return null;
  _transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user, pass },
  });
  return _transporter;
}

/**
 * 依 publish results 送發文失敗通知
 * 自動判斷:全部成功 → 不送 · 有 fail → 送 · Token 失效 → 標題升級
 *
 * @param {Object} opts
 * @param {Object} opts.results - {threads:{ok,error?}, instagram:{...}, facebook:{...}}
 * @param {string} opts.source - '素材立即發佈' / '主題排程' / '氣候即時' etc
 * @param {Object} opts.post - {id, text, imageUrl, topicName?} (可選, 用於 preview)
 * @param {string} opts.link - 修復連結 (預設 /social/accounts)
 * @returns {Promise<{sent:boolean, reason?:string, messageId?:string}>}
 */
export async function notifyPublishFailure({ results = {}, source = '未知', post = null, link } = {}) {
  const platformEntries = Object.entries(results);
  const failed = platformEntries.filter(([, r]) => r && r.ok === false);
  if (failed.length === 0) return { sent: false, reason: 'all_ok' };

  const t = getTransporter();
  if (!t) return { sent: false, reason: 'no_credentials' };

  const to = process.env.NOTIFY_EMAIL_TO || process.env.GMAIL_USER;
  const from = process.env.GMAIL_USER;

  const tokenExpired = failed.some(([, r]) => TOKEN_PATTERN.test(r.error || ''));
  const allFailed = failed.length === platformEntries.length && platformEntries.length > 0;

  // 標題
  const subjectPrefix = tokenExpired ? '⚠ [Infuz] TOKEN 過期' : (allFailed ? '⚠ [Infuz] 發文全掛' : '⚠ [Infuz] 發文部分失敗');
  const platformStr = failed.map(([k]) => ({ threads: '🧵', instagram: '📷', facebook: '👍' }[k] || k)).join(' ');
  const subject = `${subjectPrefix} · ${source} · ${platformStr}`;

  // 內文 HTML
  const failLines = failed.map(([k, r]) => {
    const label = { threads: '🧵 Threads', instagram: '📷 Instagram', facebook: '👍 Facebook' }[k] || k;
    return `<tr>
      <td style="padding:6px 12px;border-bottom:1px solid #eee;font-weight:600">${label}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #eee;color:#c00;font-family:ui-monospace,monospace;font-size:12px">${escapeHtml(r.error || '未知錯誤')}</td>
    </tr>`;
  }).join('');
  const okLines = platformEntries.filter(([, r]) => r && r.ok).map(([k, r]) => {
    const label = { threads: '🧵 Threads', instagram: '📷 Instagram', facebook: '👍 Facebook' }[k] || k;
    return `<tr>
      <td style="padding:6px 12px;border-bottom:1px solid #eee;font-weight:600">${label}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #eee;color:#080">✓ 成功${r.permalink ? ` · <a href="${r.permalink}">連結</a>` : ''}</td>
    </tr>`;
  }).join('');

  const preview = post ? `
    <div style="margin:16px 0;padding:12px 16px;background:#faf9f7;border-left:3px solid #A16207">
      <div style="font-size:11px;color:#666;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px">貼文預覽</div>
      ${post.topicName ? `<div style="font-size:12px;color:#666;margin-bottom:4px">主題:${escapeHtml(post.topicName)}</div>` : ''}
      ${post.imageUrl ? `<img src="${post.imageUrl}" style="max-width:200px;border-radius:6px;margin-bottom:8px" alt="">` : ''}
      <pre style="white-space:pre-wrap;font-family:inherit;font-size:13px;margin:0;color:#333">${escapeHtml((post.text || '').slice(0, 400))}${(post.text || '').length > 400 ? '\n\n...(截斷)' : ''}</pre>
    </div>` : '';

  const fixHint = tokenExpired ? `
    <div style="margin:16px 0;padding:12px 16px;background:#fef3c7;border-left:3px solid #d97706;font-size:13px">
      <strong>⚠ Token 已失效 · 需要重連平台帳號</strong><br>
      <span style="color:#666">FB 改密碼 / Meta 安全撤銷 session 都會導致 Page Access Token 失效, IG 走 FB Graph API 會一起掛。</span>
    </div>` : '';

  const linkUrl = link || 'https://infuz-flax.vercel.app/social/accounts';

  const html = `<div style="font-family:-apple-system,'Segoe UI',sans-serif;max-width:640px;margin:0 auto;padding:20px;color:#1C1917">
    <h2 style="margin:0 0 4px;font-size:18px">${subjectPrefix}</h2>
    <div style="font-size:12px;color:#666;margin-bottom:16px">${escapeHtml(source)} · ${new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}</div>
    ${fixHint}
    ${preview}
    <table style="border-collapse:collapse;width:100%;font-size:13px;margin-top:12px">
      ${failLines}${okLines}
    </table>
    <div style="margin:24px 0 8px">
      <a href="${linkUrl}" style="display:inline-block;padding:10px 20px;background:#1C1917;color:white;text-decoration:none;border-radius:6px;font-size:13px">前往帳號管理修復 →</a>
    </div>
    <div style="margin-top:24px;padding-top:12px;border-top:1px solid #eee;font-size:11px;color:#999">
      Infuz 發文成效系統 · <a href="https://infuz-flax.vercel.app/social/insights" style="color:#999">查看成效</a>
    </div>
  </div>`;

  try {
    const info = await t.sendMail({
      from: `Infuz 系統 <${from}>`,
      to,
      subject,
      html,
    });
    return { sent: true, messageId: info.messageId };
  } catch (e) {
    console.error('[notify] Gmail SMTP 失敗:', e.message);
    return { sent: false, reason: e.message };
  }
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
