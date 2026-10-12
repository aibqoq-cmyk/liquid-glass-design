/**
 * 前端唯一的请求出口。所有页面都通过 api() 访问后端。
 *
 * 环境变量（写在 .env.local）：
 *   VITE_API_BASE   后端地址，例如 https://api.example.com；同域部署留空
 *   VITE_MOCK=1     用内置假数据跑（没有后端时开发、截图用）
 *
 * 鉴权：如果后端需要登录，把令牌存进 localStorage 的 'lc.token'，
 *       这里会自动带上 Authorization: Bearer <token>。
 */
import { mockFetch } from './mock.js';

const BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '');
export const MOCK = import.meta.env.VITE_MOCK === '1';

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/**
 * SSE 地址。浏览器的 EventSource 不能带请求头，所以令牌放在网址参数 ?token= 里，
 * 后端的流式接口要能从 query 里取令牌（见 docs/04-聊天.md）。
 */
export function streamUrl(path) {
  let token = null;
  try { token = localStorage.getItem('lc.token'); } catch { /* 隐私模式 */ }
  return BASE + path + (token ? `${path.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}` : '');
}

/**
 * @param {string} path  以 /api 开头的路径
 * @param {{ method?: string, body?: any, form?: FormData, timeout?: number }} opts
 * @returns {Promise<any>} 解析后的 JSON
 */
export async function api(path, { method = 'GET', body, form, timeout = 12000 } = {}) {
  if (MOCK) return mockFetch(path, { method, body, form });

  const headers = {};
  let token = null;
  try { token = localStorage.getItem('lc.token'); } catch { /* 隐私模式 */ }
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(BASE + path, {
      method,
      headers,
      body: form ?? (body !== undefined ? JSON.stringify(body) : undefined),
      signal: ctrl.signal,
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    if (!res.ok) throw new ApiError(res.status, data?.error || res.statusText);
    return data;
  } catch (e) {
    if (e.name === 'AbortError') throw new ApiError(0, '请求超时');
    throw e;
  } finally {
    clearTimeout(t);
  }
}
