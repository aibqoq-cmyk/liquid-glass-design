/**
 * 播放状态（全局唯一一份）。首页音乐卡、迷你播放条、全屏播放器都读这里，永远同步。
 *
 * "遥控器"模式：歌在哪里放由后端决定（比如他的电脑、音箱或音乐服务），
 * 前端只显示正在放什么、发控制指令。接口见 docs/05-音乐.md。
 */
import { useEffect, useSyncExternalStore } from 'react';
import { api } from './api.js';

let state = {
  available: false, track: null, playing: false, position: 0, volume: 60, device: null,
  mode: { shuffle: false, repeat: false, autoplay: true },
  at: Date.now(),
  /** 全屏播放器：null = 收起；'cover' | 'lyrics' | 'queue' = 展开在哪一面 */
  view: null,
};
const subs = new Set();
const emit = () => subs.forEach((f) => f());
// position 只在 at 那一刻准确；没给新进度的改动先把走过的时间结算进去，进度条才不会往回跳
const set = (patch) => {
  const position = 'position' in patch ? patch.position : livePosition();
  state = { ...state, ...patch, position, at: Date.now() };
  emit();
};

let polling = 0;
let users = 0;

/** 后端返回的播放状态 → 本地状态（只取认识的字段） */
function apply(d) {
  if (!d) return;
  set({
    available: d.available !== false,
    track: d.track ?? null,
    playing: !!d.playing,
    position: d.position ?? 0,
    ...(d.volume != null && { volume: d.volume }),
    ...(d.device !== undefined && { device: d.device }),
    ...(d.mode && { mode: { ...state.mode, ...d.mode } }),
  });
}

async function refresh() {
  try {
    apply(await api('/api/music/now'));
  } catch {
    set({ available: false });
  }
}

/** 当前播放进度（秒）：播放中按本地时钟往前走，不用每秒请求后端 */
export const livePosition = (s = state) => {
  if (!s.playing || !s.track) return s.position;
  return Math.min(s.track.duration || Infinity, s.position + (Date.now() - s.at) / 1000);
};

async function control(action, extra = {}, optimistic) {
  // 先在本地生效（手感跟手），再让后端执行，后端回来的状态为准
  if (optimistic) set(optimistic);
  try {
    const d = await api('/api/music/control', { method: 'POST', body: { action, ...extra } });
    if (d && d.track !== undefined) apply(d);
    else refresh();
  } catch {
    refresh();
  }
}

export const player = {
  toggle: () => control('toggle', {}, { playing: !state.playing }),
  next: () => control('next'),
  prev: () => control('prev'),
  seek: (sec) => control('seek', { position: Math.max(0, sec) }, { position: Math.max(0, sec) }),
  seekBy: (sec) => player.seek(livePosition() + sec),
  volume: (value) => control('volume', { value }, { volume: value }),
  /** 播放：{ trackId } | { playlistId, index? } | { artistId } */
  play: (target) => control('play', target),
  /** 加进队列：where = 'next'（下一首）| 'end'（最后） */
  enqueue: (trackId, where = 'next') => control('enqueue', { trackId, where }),
  /** 跳到队列里的第 index 首（前面的都跳过） */
  skipTo: (index) => control('skipTo', { index }),
  /** 随机 / 循环 / 自动续播 */
  setMode: (patch) => control('mode', patch, { mode: { ...state.mode, ...patch } }),
  /** 喜欢 / 取消喜欢当前这首 */
  love: async (loved) => {
    const t = state.track;
    if (!t) return;
    set({ track: { ...t, loved } });
    try { await api(`/api/music/tracks/${encodeURIComponent(t.id)}/love`, { method: 'POST', body: { loved } }); } catch { refresh(); }
  },
  /** 展开全屏播放器（或切到另一面） */
  expand: (view = 'cover') => set({ view }),
  collapse: () => set({ view: null }),
};

/** 订阅播放状态。挂载时开始每 5 秒同步一次，所有用到的组件都卸载后停止 */
export function usePlayer() {
  const s = useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => state);
  useEffect(() => {
    users += 1;
    if (users === 1) { refresh(); polling = setInterval(refresh, 5000); }
    return () => { users -= 1; if (users === 0) clearInterval(polling); };
  }, []);
  return s;
}
