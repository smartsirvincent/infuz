// 測試 email 通知是否正常
// GET /api/infuz/notify/test?token=1 → 送模擬失敗通知
import { NextResponse } from 'next/server';
import { notifyPublishFailure } from '@/lib/infuz-notify.js';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const testTokenErr = searchParams.get('token') === '1';

  const res = await notifyPublishFailure({
    source: '通知測試',
    post: {
      id: 'test_post',
      topicName: '測試主題',
      text: '這是一則測試訊息 · 用來確認 Gmail SMTP 通知已經正常運作。\n\n如果收到這封信 = 設定 OK。',
    },
    results: {
      facebook: testTokenErr
        ? { ok: false, error: 'Error validating access token: The session has been invalidated because the user changed their password (測試訊息)' }
        : { ok: false, error: '這是模擬的失敗訊息' },
      instagram: { ok: true, permalink: 'https://example.com' },
      threads: { ok: false, error: '這是 Threads 模擬錯誤' },
    },
  });
  return NextResponse.json(res);
}
