/**
 * 聊天数据层。接口契约见 docs/04-聊天.md。
 *
 * 实时：优先用 SSE（/api/chat/sessions/:id/stream）推新消息、工具调用进度、正在输入、已读；
 *       SSE 连不上就自动退回每 3 秒轮询，页面不用管。
 * 发送：乐观更新——点发送立刻出现在屏幕上（"发送中…"），后端确认后换成正式消息；失败可点重发。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, MOCK, streamUrl } from './api.js';
import { mockStream } from './mock.js';

/* ───────── 聊天框列表 ───────── */

export function useSessions() {
  const [data, setData] = useState(null);
  const load = useCallback(() => api('/api/chat/sessions')
    .then(setData)
    .catch((e) => setData((d) => d ?? { available: false, reason: e.message })), []);
  useEffect(() => {
    load();
    const t = setInterval(load, 10_000);
    return () => clearInterval(t);
  }, [load]);
  return { data, reload: load };
}

/** 新开一个聊天框（他那边会新开一个窗口） */
export const createSession = (title) => api('/api/chat/sessions', { method: 'POST', body: { title } });

/** 表情包 */
export function useStickers() {
  const [items, setItems] = useState([]);
  const load = useCallback(() => api('/api/stickers').then((d) => setItems(d?.items || [])).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);
  const add = async (file) => {
    const form = new FormData();
    form.append('file', file);
    await api('/api/stickers', { method: 'POST', form });
    load();
  };
  return { items, add };
}

/* ───────── 一个聊天框里的对话 ───────── */

const byTime = (a, b) => new Date(a.at) - new Date(b.at);

export function useConversation(sessionId) {
  const [messages, setMessages] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [typing, setTyping] = useState(false);
  const [available, setAvailable] = useState(true);
  const [loading, setLoading] = useState(true);
  const lastId = useRef(null);

  /** 插入或替换一条消息（按 id，或按发送时带上的 clientId 认领乐观消息） */
  const upsert = useCallback((m) => {
    setMessages((list) => {
      const i = list.findIndex((x) => x.id === m.id || (m.clientId && x.clientId === m.clientId));
      const next = i >= 0 ? list.map((x, j) => (j === i ? { ...x, ...m } : x)) : [...list, m];
      return next.sort(byTime);
    });
    if (m.id && !String(m.id).startsWith('c-')) lastId.current = m.id;
  }, []);

  const markReadUpTo = useCallback((at) => {
    setMessages((list) => list.map((x) => (x.from === 'me' && !x.readAt && new Date(x.at) <= new Date(at) ? { ...x, readAt: at } : x)));
  }, []);

  // 首屏 + 实时
  useEffect(() => {
    if (!sessionId) return undefined;
    let alive = true;
    let poll = 0;
    let es = null;
    let stop = null;
    setMessages([]);
    setLoading(true);

    api(`/api/chat/sessions/${encodeURIComponent(sessionId)}/messages?limit=50`)
      .then((d) => {
        if (!alive) return;
        if (d?.available === false) { setAvailable(false); return; }
        const items = (d?.items || []).sort(byTime);
        setMessages(items);
        setHasMore(!!d?.hasMore);
        lastId.current = items.at(-1)?.id ?? null;
        setAvailable(true);
      })
      .catch(() => alive && setAvailable(false))
      .finally(() => alive && setLoading(false));

    const handlers = {
      message: (m) => upsert(m),
      typing: (d) => setTyping(!!d.typing),
      read: (d) => markReadUpTo(d.upToAt),
    };

    const startPolling = () => {
      clearInterval(poll);
      poll = setInterval(async () => {
        try {
          const after = lastId.current ? `&after=${encodeURIComponent(lastId.current)}` : '';
          const d = await api(`/api/chat/sessions/${encodeURIComponent(sessionId)}/messages?limit=50${after}`);
          (d?.items || []).forEach(upsert);
          if (typeof d?.typing === 'boolean') setTyping(d.typing);
          if (d?.readUpToAt) markReadUpTo(d.readUpToAt);
        } catch { /* 下一轮再试 */ }
      }, 3000);
    };

    if (MOCK) {
      stop = mockStream(sessionId, handlers);
    } else if (typeof EventSource !== 'undefined') {
      let fails = 0;
      es = new EventSource(streamUrl(`/api/chat/sessions/${encodeURIComponent(sessionId)}/stream`));
      for (const [ev, fn] of Object.entries(handlers)) {
        es.addEventListener(ev, (e) => { fails = 0; try { fn(JSON.parse(e.data)); } catch { /* 坏数据跳过 */ } });
      }
      es.onerror = () => {
        fails += 1;
        if (fails >= 3) { es.close(); startPolling(); } // 连续失败 3 次：退回轮询
      };
    } else {
      startPolling();
    }

    return () => {
      alive = false;
      clearInterval(poll);
      es?.close();
      stop?.();
    };
  }, [sessionId, upsert, markReadUpTo]);

  /** 往上翻加载更早的消息 */
  const loadOlder = useCallback(async () => {
    const first = messages[0];
    if (!first || !hasMore) return;
    const d = await api(`/api/chat/sessions/${encodeURIComponent(sessionId)}/messages?limit=50&before=${encodeURIComponent(first.id)}`);
    setMessages((list) => [...(d?.items || []), ...list].sort(byTime));
    setHasMore(!!d?.hasMore);
  }, [messages, hasMore, sessionId]);

  /** 发一条消息：payload 形如 { type: 'text', text } 或 { type: 'sticker', stickerId, url } */
  const send = useCallback(async (payload) => {
    const clientId = `c-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    upsert({ ...payload, id: clientId, clientId, from: 'me', at: new Date().toISOString(), status: 'sending' });
    try {
      const m = await api(`/api/chat/sessions/${encodeURIComponent(sessionId)}/messages`, {
        method: 'POST',
        body: { ...payload, url: undefined, clientId },
      });
      upsert({ ...m, clientId, status: 'sent' });
    } catch {
      upsert({ id: clientId, clientId, status: 'failed' });
    }
  }, [sessionId, upsert]);

  /** 发图片或文件（kind: 'image' | 'file'） */
  const sendFile = useCallback(async (file, kind) => {
    const clientId = `c-${Date.now()}`;
    const local = URL.createObjectURL(file);
    upsert({
      id: clientId, clientId, from: 'me', at: new Date().toISOString(), status: 'sending',
      type: kind, url: local, name: file.name, size: file.size, mime: file.type,
    });
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('type', kind);
      form.append('clientId', clientId);
      const m = await api(`/api/chat/sessions/${encodeURIComponent(sessionId)}/messages`, { method: 'POST', form, timeout: 60_000 });
      upsert({ ...m, clientId, status: 'sent' });
    } catch {
      upsert({ id: clientId, clientId, status: 'failed' });
    }
  }, [sessionId, upsert]);

  /** 重发失败的消息 */
  const retry = useCallback((m) => {
    setMessages((list) => list.filter((x) => x.id !== m.id));
    const { id, clientId, status, at, from, ...payload } = m;
    send(payload);
  }, [send]);

  /** 表态：emoji 传 null 表示取消 */
  const react = useCallback(async (messageId, emoji) => {
    setMessages((list) => list.map((x) => {
      if (x.id !== messageId) return x;
      const others = (x.reactions || []).filter((r) => r.from !== 'me');
      return { ...x, reactions: emoji ? [...others, { emoji, from: 'me' }] : others };
    }));
    api(`/api/chat/messages/${encodeURIComponent(messageId)}/reaction`, { method: 'POST', body: { emoji } }).catch(() => {});
  }, []);

  /** 告诉后端：他的消息我看到这一条了 */
  const markRead = useCallback((upToId) => {
    if (!upToId || String(upToId).startsWith('c-')) return;
    api(`/api/chat/sessions/${encodeURIComponent(sessionId)}/read`, { method: 'POST', body: { upToId } }).catch(() => {});
  }, [sessionId]);

  return { messages, hasMore, loadOlder, typing, available, loading, send, sendFile, retry, react, markRead };
}
