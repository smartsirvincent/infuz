// Facebook Graph API — IG + FB 粉專發文 + insights
// 認證與 Threads 完全分開:Threads 走 threads.net,IG/FB 走 Facebook Graph
//
// 連接流程 (帳號管理頁):
//   1. 使用者貼一個 FB User Access Token
//   2. 有設 FB_APP_ID / FB_APP_SECRET → 換長效 token
//   3. 讀 /me/accounts 取得粉專清單 + 各自 Page Access Token
//   4. 使用者選一個粉專 → 帶出它連結的 IG 商業帳號
// Page Access Token 不過期,連一次就長期有效

const GRAPH = `https://graph.facebook.com/${process.env.GRAPH_API_VERSION || 'v25.0'}`;

async function graph(path, { method = 'GET', token, params = {}, timeoutMs = 30000 } = {}) {
  const url = new URL(GRAPH + path);
  const body = new URLSearchParams();
  const target = method === 'GET' ? url.searchParams : body;
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) target.set(k, String(v));
  }
  if (token) target.set('access_token', token);

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(url.toString(), {
      method,
      signal: ctl.signal,
      ...(method === 'GET' ? {} : { body, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }),
    });
  } catch (err) {
    if (err.name === 'AbortError') throw new Error(`Facebook API 連線逾時(${timeoutMs / 1000} 秒)`);
    throw err;
  } finally {
    clearTimeout(timer);
  }

  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) {
    const e = json.error || {};
    const hint = e.code === 190 ? '(token 失效或過期,請重新連接)'
      : e.code === 200 || e.code === 10 ? '(權限不足,請確認 App 已取得對應權限)'
      : '';
    throw new Error(`Facebook API 錯誤:${e.message || res.status}${hint}`);
  }
  return json;
}

export const REQUIRED_SCOPES = [
  { need: ['pages_show_list'], label: '列出你管理的粉專' },
  { need: ['pages_manage_posts'], label: '發佈粉專貼文' },
  { need: ['pages_read_engagement'], label: '讀粉專貼文成效' },
  { need: ['instagram_basic', 'instagram_manage_contents'], label: '讀取 Instagram 帳號與貼文' },
  { need: ['instagram_content_publish'], label: '發佈 Instagram 貼文' },
  { need: ['instagram_manage_insights'], label: '讀取 Instagram 成效' },
];

export async function checkScopes(userToken) {
  const id = process.env.FB_APP_ID;
  const secret = process.env.FB_APP_SECRET;
  if (!id || !secret) return null;
  const r = await graph('/debug_token', {
    params: { input_token: userToken, access_token: `${id}|${secret}` },
  });
  const granted = new Set(r.data?.scopes || []);
  const unmet = REQUIRED_SCOPES.filter((g) => !g.need.some((s) => granted.has(s)));
  const expiresAt = r.data?.expires_at ? new Date(r.data.expires_at * 1000) : null;
  return {
    granted: [...granted],
    missing: unmet.flatMap((g) => g.need),
    missingLabels: unmet.map((g) => `${g.need.join(' 或 ')}(${g.label})`),
    appId: r.data?.app_id || null,
    expiresAt: expiresAt ? expiresAt.toISOString() : null,
    expired: Boolean(expiresAt && expiresAt.getTime() < Date.now()),
  };
}

export async function exchangeLongLivedUserToken(userToken) {
  const id = process.env.FB_APP_ID;
  const secret = process.env.FB_APP_SECRET;
  if (!id || !secret) {
    return { token: userToken, longLived: false };
  }
  const r = await graph('/oauth/access_token', {
    params: { grant_type: 'fb_exchange_token', client_id: id, client_secret: secret, fb_exchange_token: userToken },
  });
  return { token: r.access_token, longLived: true, expiresIn: r.expires_in || null };
}

export async function listPages(userToken) {
  // Meta gotcha: 沒帶 type=page 只回舊版 Classic Pages
  // New Pages Experience / Business Manager 底下的粉專必須加 type=page 才會出現
  const r = await graph('/me/accounts', {
    token: userToken,
    params: {
      type: 'page',
      fields: 'id,name,access_token,instagram_business_account{id,username}',
      limit: 100,
    },
  });
  return (r.data || []).map((p) => ({
    pageId: p.id,
    pageName: p.name,
    pageAccessToken: p.access_token,
    igUserId: p.instagram_business_account?.id || null,
    igUsername: p.instagram_business_account?.username || null,
  }));
}

// ---------- Instagram 發文 ----------
async function waitContainerReady(containerId, token, { timeoutMs = 90000, intervalMs = 3000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const r = await graph(`/${containerId}`, { token, params: { fields: 'status_code,status' } });
    if (r.status_code === 'FINISHED') return;
    if (r.status_code === 'ERROR' || r.status_code === 'EXPIRED') {
      throw new Error(`Instagram 圖片處理失敗:${r.status || r.status_code}`);
    }
    await new Promise((res) => setTimeout(res, intervalMs));
  }
  throw new Error('Instagram 圖片處理逾時(圖片網址可能無法公開存取)');
}

export async function publishInstagram(conn, { caption, imageUrl }) {
  if (!conn?.igUserId) throw new Error('這個帳號沒有連結 Instagram 商業帳號');
  if (!imageUrl) throw new Error('Instagram 貼文必須附圖片');
  const token = conn.pageAccessToken;

  const container = await graph(`/${conn.igUserId}/media`, {
    method: 'POST',
    token,
    params: { image_url: imageUrl, caption },
  });
  await waitContainerReady(container.id, token);
  const published = await graph(`/${conn.igUserId}/media_publish`, {
    method: 'POST',
    token,
    params: { creation_id: container.id },
  });

  let permalink = null;
  try {
    permalink = (await graph(`/${published.id}`, { token, params: { fields: 'permalink' } })).permalink || null;
  } catch { /* 拿不到不影響 */ }

  return { ids: [published.id], permalink };
}

// ---------- 粉專發文 ----------
export async function publishFacebook(conn, { message, imageUrl }) {
  if (!conn?.pageId) throw new Error('這個帳號沒有連結 Facebook 粉專');
  const token = conn.pageAccessToken;

  const r = imageUrl
    ? await graph(`/${conn.pageId}/photos`, { method: 'POST', token, params: { url: imageUrl, caption: message } })
    : await graph(`/${conn.pageId}/feed`, { method: 'POST', token, params: { message } });

  const postId = r.post_id || r.id;
  return { ids: [postId], permalink: postId ? `https://www.facebook.com/${postId}` : null };
}

// ============================================================
// Insights (讀取貼文成效)
// IG: 需 instagram_manage_insights scope · business account only
// FB: post_impressions/post_reactions_by_type_total/post_clicks
// ============================================================

/**
 * IG media insights
 * mediaId 是 IG 貼文的 media id (publish 回傳的 ids[0])
 */
export async function getInstagramInsights(conn, mediaId) {
  const metrics = 'impressions,reach,likes,comments,saved,shares';
  const json = await graph(`/${mediaId}/insights`, {
    token: conn.pageAccessToken,
    params: { metric: metrics },
    timeoutMs: 20000,
  });
  const out = { platform: 'instagram', fetchedAt: new Date().toISOString() };
  for (const m of (json.data || [])) {
    out[m.name] = m.values?.[0]?.value ?? 0;
  }
  return out;
}

/**
 * FB post insights
 * postId 是 pageId_postId 格式
 */
export async function getFacebookInsights(conn, postId) {
  const metrics = 'post_impressions,post_impressions_unique,post_reactions_by_type_total,post_clicks';
  const json = await graph(`/${postId}/insights`, {
    token: conn.pageAccessToken,
    params: { metric: metrics },
    timeoutMs: 20000,
  });
  const out = { platform: 'facebook', fetchedAt: new Date().toISOString() };
  for (const m of (json.data || [])) {
    const v = m.values?.[0]?.value;
    if (m.name === 'post_reactions_by_type_total' && typeof v === 'object' && v !== null) {
      out.reactions_by_type = v;
      out.reactions = Object.values(v).reduce((a, b) => a + (Number(b) || 0), 0);
    } else {
      // 命名對齊 IG (reach/impressions)
      const key = m.name.replace('post_impressions_unique', 'reach').replace('post_impressions', 'impressions').replace('post_clicks', 'clicks');
      out[key] = v ?? 0;
    }
  }
  return out;
}

/**
 * FB Page 粉絲數
 * followers_count = 追蹤者 (含未按讚), fan_count = 按讚粉絲
 */
export async function getFacebookFollowers(conn) {
  const json = await graph(`/${conn.pageId}`, {
    token: conn.pageAccessToken,
    params: { fields: 'id,name,followers_count,fan_count' },
    timeoutMs: 15000,
  });
  return {
    platform: 'facebook',
    pageId: json.id,
    name: json.name,
    followers: json.followers_count ?? json.fan_count ?? 0,
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * IG Business Account 粉絲數
 */
export async function getInstagramFollowers(conn) {
  if (!conn?.igUserId) throw new Error('沒有連結 IG 商業帳號');
  const json = await graph(`/${conn.igUserId}`, {
    token: conn.pageAccessToken,
    params: { fields: 'id,username,followers_count,follows_count,media_count' },
    timeoutMs: 15000,
  });
  return {
    platform: 'instagram',
    igUserId: json.id,
    username: json.username,
    followers: json.followers_count ?? 0,
    following: json.follows_count ?? 0,
    mediaCount: json.media_count ?? 0,
    fetchedAt: new Date().toISOString(),
  };
}

export async function verifyConnection(conn) {
  const r = await graph(`/${conn.pageId}`, { token: conn.pageAccessToken, params: { fields: 'id,name' } });
  return { ok: true, pageName: r.name };
}
