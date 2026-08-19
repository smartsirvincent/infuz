// 主題排程 tick — 由 /api/infuz/cron/tick 呼叫
// 找出「schedule.enabled + 到點 + 今日未發過」的 topic → 從 topic_posts queue 取最早的 queued 篇 → 發文 → 更新
import { loadDb, saveDb, updateItem } from './infuz-db.js';
import { buildTextWithLink } from './topic-publish-helper.js';

const SCHEDULE_GRACE_MS = 6 * 3600 * 1000;

export async function tickTopics() {
  const stats = { tried: 0, fired: 0, skipped: 0, noQueue: 0, errors: [] };
  const [topicsDb, productsDb, settingsDb] = await Promise.all([
    loadDb('topics'),
    loadDb('products'),
    loadDb('settings'),
  ]);
  const topics = topicsDb.items || [];
  const settings = (settingsDb.items || []).find((s) => s.id === 'main') || {};
  const utmCfg = settings.utm || null;
  const taipeiNowMs = Date.now() + 8 * 3600 * 1000;

  for (const topic of topics) {
    const sch = topic.schedule;
    if (!sch?.enabled || !sch?.time) continue;

    const slot = findDueSlot(sch, taipeiNowMs);
    if (!slot) continue;
    if (sch.lastRunDate && sch.lastRunDate >= slot.dateStr) continue;

    stats.tried++;

    // 先佔位 lastRunDate 避免下輪重複
    await patchTopicSchedule(topic.id, { lastRunDate: slot.dateStr });

    // 從 queue 取最早的 queued 篇 (FIFO)
    const postsDb = await loadDb('topic_posts');
    const posts = postsDb.items || [];
    const queued = posts.filter((p) => p.topicId === topic.id && p.status === 'queued')
      .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));

    if (queued.length === 0) {
      stats.noQueue++;
      console.log(`[topic-tick] ${topic.name}: 佇列空`);
      continue;
    }

    const post = queued[0];
    const finalText = buildTextWithLink({ post, productsDb, utmCfg });

    try {
      const res = await fetch(`${getBaseUrl()}/api/infuz/publish`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          text: finalText,
          imageUrl: post.imageUrl || null,
          hashtags: '',
          platforms: sch.platforms || { threads: true },
        }),
      });
      const publishResult = await res.json();

      await updateItem('topic_posts', post.id, {
        status: publishResult.ok ? 'published' : 'failed',
        publishedAt: new Date().toISOString(),
        results: publishResult.results || null,
        error: publishResult.ok ? null : publishResult.error || 'publish failed',
      });

      if (publishResult.ok) {
        stats.fired++;
        console.log(`[topic-tick] ${topic.name}: 已發`);
      } else {
        stats.errors.push(`${topic.name}: ${publishResult.error || 'failed'}`);
      }
    } catch (err) {
      await updateItem('topic_posts', post.id, {
        status: 'failed',
        publishedAt: new Date().toISOString(),
        error: err.message,
      });
      stats.errors.push(`${topic.name}: ${err.message}`);
      console.error(`[topic-tick] ${topic.name}: ${err.message}`);
    }
  }

  return stats;
}

async function patchTopicSchedule(topicId, patch) {
  const db = await loadDb('topics');
  const items = (db.items || []).map((t) =>
    t.id === topicId ? { ...t, schedule: { ...t.schedule, ...patch } } : t,
  );
  await saveDb('topics', { items });
}

function findDueSlot(sch, taipeiNowMs) {
  const days = Array.isArray(sch.days) && sch.days.length ? sch.days : [0, 1, 2, 3, 4, 5, 6];
  const [h, m] = sch.time.split(':').map(Number);
  for (let back = 0; back <= 1; back++) {
    const d = new Date(taipeiNowMs - back * 86400000);
    const dStr = d.toISOString().slice(0, 10);
    if (!days.includes(d.getUTCDay())) continue;
    const slotMs = Date.parse(dStr + 'T00:00:00Z') + (h * 60 + (m || 0)) * 60000;
    if (slotMs > taipeiNowMs) continue;
    if (taipeiNowMs - slotMs > SCHEDULE_GRACE_MS) return null;
    return { dateStr: dStr, slotMs };
  }
  return null;
}

function getBaseUrl() {
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  return 'http://localhost:3000';
}
