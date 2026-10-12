/**
 * 工作室数据层。接口契约见 docs/06-工作室.md。
 */
import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';

function useLoad(path, { every } = {}) {
  const [data, setData] = useState(null);
  const load = useCallback(() => {
    if (!path) return Promise.resolve();
    return api(path)
      .then(setData)
      .catch((e) => setData({ available: false, reason: e.message }));
  }, [path]);
  useEffect(() => {
    setData(null);
    load();
    if (!every) return undefined;
    // 页面切到后台时不拉，回来立刻拉一次
    const tick = () => { if (document.visibilityState === 'visible') load(); };
    const t = setInterval(tick, every);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', tick); };
  }, [load, every]);
  return { data, reload: load };
}

/** 他的窗口：当前是哪个、各自上下文用了多少 */
export const useWindows = () => useLoad('/api/studio/windows', { every: 30_000 });
/** Claude 额度 */
export const useQuota = () => useLoad('/api/studio/quota', { every: 60_000 });
/** 服务器 + 我的电脑 */
export const useMachines = () => useLoad('/api/studio/machines', { every: 30_000 });
/** 改动记录（最近 limit 条）。limit 为 0 时不拉 */
export const useChanges = (limit) => useLoad(limit ? `/api/studio/changes?limit=${limit}` : null, { every: 60_000 });
/** 他做出来的文件（最近 limit 个）。limit 为 0 时不拉 */
export const useFiles = (limit) => useLoad(limit ? `/api/studio/files?limit=${limit}` : null);
/** 设置概览（每一项右边显示的值） */
export const useSettings = () => useLoad('/api/studio/settings');
/** 某一项设置的详情。key 为空时不拉 */
export const useSetting = (key) => useLoad(key ? `/api/studio/settings/${key}` : null);

/** 一次改动的详情（说明 + 每个文件的增删行） */
export const getChange = (id) => api(`/api/studio/changes/${encodeURIComponent(id)}`);

/** 让他写交接便签。他要现写，可能要几十秒 */
export const writeHandoff = (windowId) => api(`/api/studio/windows/${encodeURIComponent(windowId)}/handoff`, { method: 'POST', timeout: 120_000 });
/** 带着便签换到新窗口 */
export const swapWindow = (windowId, handoffId) => api(`/api/studio/windows/${encodeURIComponent(windowId)}/swap`, { method: 'POST', body: { handoffId }, timeout: 60_000 });

/** 改设置：Heartbeat / Context 改整组值，列表类（Prompts / Nudges / Hooks / MCP）开关单项 */
export const saveSetting = (key, patch) => api(`/api/studio/settings/${key}`, { method: 'PUT', body: patch });
export const toggleSettingItem = (key, id, enabled) => api(`/api/studio/settings/${key}/items/${encodeURIComponent(id)}`, { method: 'PATCH', body: { enabled } });
