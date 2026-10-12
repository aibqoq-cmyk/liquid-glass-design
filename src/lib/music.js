/**
 * 音乐页 + 全屏播放器的数据层。播放状态本身在 player.js。接口契约见 docs/05-音乐.md。
 */
import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';
import { hexToRgb, luminance, LIGHT_THRESHOLD } from '../theme/presets.js';

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
    const t = setInterval(load, every);
    return () => clearInterval(t);
  }, [load, every]);
  return { data, reload: load };
}

/** 音乐页：他为你挑的、最近播放、歌单、他划的歌词 */
export const useMusicHome = (enabled = true) => useLoad(enabled ? '/api/music/home' : null);

/** 一起听：他在不在听、一起听了多久、他刚说的一句。30 秒刷新一次 */
export const useTogether = (enabled = true) => useLoad(enabled ? '/api/music/together' : null, { every: 30_000 });

/** 歌词（带时间轴）。换歌时 trackId 变，自动重拉 */
export const useLyrics = (trackId) => useLoad(trackId ? `/api/music/lyrics?trackId=${encodeURIComponent(trackId)}` : null);

/** 播放队列。带上当前这首的 id：换歌时网址变，自动重拉（后端可以忽略这个参数） */
export const useQueue = (trackId) => useLoad(trackId ? `/api/music/queue?current=${encodeURIComponent(trackId)}` : null);

/**
 * 搜索。输入停 300 毫秒才发请求；q 为空时不搜。
 * @param {'all'|'track'|'artist'|'playlist'} type
 */
export function useSearch(q, type) {
  const [data, setData] = useState(null);
  useEffect(() => {
    const query = q.trim();
    if (!query) { setData(null); return undefined; }
    let alive = true;
    const t = setTimeout(() => {
      api(`/api/music/search?q=${encodeURIComponent(query)}&type=${type}`)
        .then((d) => alive && setData(d))
        .catch((e) => alive && setData({ available: false, reason: e.message }));
    }, 300);
    return () => { alive = false; clearTimeout(t); };
  }, [q, type]);
  return data;
}

export const createPlaylist = (name) => api('/api/music/playlists', { method: 'POST', body: { name } });
export const addToPlaylist = (playlistId, trackId) => api(`/api/music/playlists/${encodeURIComponent(playlistId)}/tracks`, { method: 'POST', body: { trackId } });

/* ───────── 全屏播放器的背景色：从封面取 ───────── */

const FALLBACK = ['#3a3f8f', '#8a4a9a', '#f2687e', '#ff9a6b'];
const toHex = (r, g, b) => `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

/** 把封面缩成 2×2 读四个角的平均色。封面跨域且没开 CORS 时读不到，返回 null */
function sampleCover(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = 2; c.height = 2;
        const g = c.getContext('2d', { willReadFrequently: true });
        g.drawImage(img, 0, 0, 2, 2);
        const d = g.getImageData(0, 0, 2, 2).data;
        resolve([0, 4, 8, 12].map((i) => toHex(d[i], d[i + 1], d[i + 2])));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

const cache = new Map();

/**
 * 播放器背景用的 4 个颜色 + 深浅。
 * 优先用后端给的 track.palette；没给就从封面取；都没有用默认紫粉。
 * light = 颜色整体够亮 → 浅底深字（和「外观」里浅色玻璃同一个阈值）。
 */
export function usePalette(track) {
  const key = track ? track.id : null;
  const [pal, setPal] = useState(() => (key && cache.get(key)) || null);
  useEffect(() => {
    if (!track) return undefined;
    if (track.palette?.length) { setPal(track.palette); return undefined; }
    if (cache.has(key)) { setPal(cache.get(key)); return undefined; }
    let alive = true;
    (track.cover ? sampleCover(track.cover) : Promise.resolve(null)).then((p) => {
      const v = p || FALLBACK;
      cache.set(key, v);
      if (alive) setPal(v);
    });
    return () => { alive = false; };
  }, [key, track?.palette, track?.cover]); // eslint-disable-line react-hooks/exhaustive-deps
  const colors = pal || FALLBACK;
  const avg = colors.reduce((n, h) => n + luminance(hexToRgb(h)), 0) / colors.length;
  return { colors, light: avg > LIGHT_THRESHOLD };
}
