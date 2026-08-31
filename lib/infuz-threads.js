// Threads Graph API 封裝
// 文件:https://developers.facebook.com/docs/threads

const API_BASE = 'https://graph.threads.net/v1.0';

async function api(token, method, endpoint, params = {}) {
  if (!token) throw new Error('沒有 Threads access token');

  const url = new URL(`${API_BASE}${endpoint}`);
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    if (method === 'GET') url.searchParams.set(k, v);
    else body.set(k, v);
  }
  if (method === 'GET') url.searchParams.set('access_token', token);
  else body.set('access_token', token);

  const res = await fetch(url, {
    method,
    ...(method === 'POST' ? { body } : {}),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) {
    const msg = json.error?.message || `Threads API ${res.status}`;
    throw new Error(msg);
  }
  return json;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function getMe(token) {
  return api(token, 'GET', '/me', { fields: 'id,username,threads_profile_picture_url' });
}

/**
 * Threads 帳號粉絲/追蹤者數 · 用 user insights endpoint
 * 需要 threads_manage_insights scope · followers_count 是 2024 加的 metric
 */
export async function getThreadsFollowers(conn) {
  // 先拿基本 profile (username · id)
  const profile = await api(conn.accessToken, 'GET', '/me', {
    fields: 'id,username,threads_biography',
  });
  // 再嘗試拿 followers_count (Threads User Insights API)
  let followers = null;
  let followersError = null;
  try {
    const ins = await api(conn.accessToken, 'GET', `/${profile.id}/threads_insights`, {
      metric: 'followers_count',
    });
    followers = ins.data?.[0]?.total_value?.value ?? ins.data?.[0]?.values?.[0]?.value ?? null;
  } catch (e) {
    followersError = e.message;
  }
  return {
    platform: 'threads',
    userId: profile.id,
    username: profile.username,
    followers,
    followersError,
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * Threads post insights
 * mediaId 是發文回傳的 posts[0].id (parent post, 有 replies 才有數據)
 */
export async function getThreadsInsights(conn, mediaId) {
  const metrics = 'views,likes,replies,reposts,quotes';
  const json = await api(conn.accessToken, 'GET', `/${mediaId}/insights`, { metric: metrics });
  const out = { platform: 'threads', fetchedAt: new Date().toISOString() };
  for (const m of (json.data || [])) {
    out[m.name] = m.values?.[0]?.value ?? 0;
  }
  return out;
}

async function waitContainerReady(token, creationId, { timeoutMs = 90000, intervalMs = 2500 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const st = await api(token, 'GET', `/${creationId}`, { fields: 'status,error_message' });
    if (st.status === 'FINISHED' || st.status === 'PUBLISHED') return;
    if (st.status === 'ERROR' || st.status === 'EXPIRED') {
      throw new Error(`媒體容器處理失敗:${st.error_message || st.status}`);
    }
    await sleep(intervalMs);
  }
  throw new Error('媒體容器處理逾時');
}

async function publishSingle(token, userId, { text, imageUrl, replyToId }) {
  const params = {
    media_type: imageUrl ? 'IMAGE' : 'TEXT',
    text,
    ...(imageUrl ? { image_url: imageUrl } : {}),
    ...(replyToId ? { reply_to_id: replyToId } : {}),
  };
  const container = await api(token, 'POST', `/${userId}/threads`, params);
  if (imageUrl) await waitContainerReady(token, container.id);

  const published = await api(token, 'POST', `/${userId}/threads_publish`, {
    creation_id: container.id,
  });

  let permalink = null;
  try {
    const info = await api(token, 'GET', `/${published.id}`, { fields: 'permalink' });
    permalink = info.permalink || null;
  } catch { /* ignore */ }

  return { id: published.id, permalink };
}

/**
 * 用指定帳號發佈 (長文自動分段串成 reply chain)
 * conn = { accessToken, userId?, username? }
 * chunks = string[] 已分段的文字
 * imageUrl = 只掛在第一段
 */
export async function publishThread(conn, chunks, imageUrl = null) {
  const token = conn.accessToken;
  let userId = conn.userId;
  if (!userId) {
    const me = await getMe(token);
    userId = me.id;
  }

  const posts = [];
  let replyToId = null;
  for (let i = 0; i < chunks.length; i += 1) {
    const result = await publishSingle(token, userId, {
      text: chunks[i],
      imageUrl: i === 0 ? imageUrl : null,
      replyToId,
    });
    posts.push(result);
    replyToId = result.id;
    if (i < chunks.length - 1) await sleep(1500);
  }

  return { posts, firstPermalink: posts[0]?.permalink || null, ids: posts.map((p) => p.id) };
}
