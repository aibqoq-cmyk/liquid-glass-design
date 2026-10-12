import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_APPEARANCE, wallpaperById, wallpaperStyleOf, paintWallpaper, hexToRgb, autoTintFromAmbient,
  luminance, LIGHT_THRESHOLD,
} from './presets.js';
import { api } from '../lib/api.js';

const LS_KEY = 'lc.appearance';
const Ctx = createContext(null);

const readLocal = () => {
  try { return { ...DEFAULT_APPEARANCE, ...JSON.parse(localStorage.getItem(LS_KEY) || '{}') }; }
  catch { return DEFAULT_APPEARANCE; }
};

/** 图片缩成 8×8 求平均色 */
function sampleAmbient(img) {
  try {
    const c = document.createElement('canvas');
    c.width = c.height = 8;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, 8, 8);
    const d = ctx.getImageData(0, 0, 8, 8).data;
    const sum = [0, 0, 0];
    for (let i = 0; i < d.length; i += 4) { sum[0] += d[i]; sum[1] += d[i + 1]; sum[2] += d[i + 2]; }
    return sum.map((v) => Math.round(v / (d.length / 4)));
  } catch {
    return null; // 跨域图片没带 CORS 头：取不到色，保持上一个环境色
  }
}

/** 用户从相册选的图：缩到长边 1600、转 JPEG，用于本地兜底保存（不走后端时） */
export function fileToDataUrl(file, maxSide = 1600) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, maxSide / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL('image/jpeg', 0.84));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

/**
 * 外观中心。包在 App 最外层。
 * 负责：读写设置（本地 + 后端）、算环境色、把设置写成 CSS 变量、给心潮瓶提供"画壁纸"的能力。
 */
export function AppearanceProvider({ children }) {
  const [appearance, setAppearance] = useState(readLocal);
  const [ambient, setAmbient] = useState(() => wallpaperById(readLocal().wallpaper.preset).ambient);
  const imgRef = useRef(null);
  const [imgReady, setImgReady] = useState(0);
  const syncTimer = useRef(null);
  const loadedRemote = useRef(false);

  // 启动时拉一次后端设置；后端没有这个接口或离线就用本地的
  useEffect(() => {
    api('/api/appearance')
      .then((remote) => { if (remote && typeof remote === 'object') setAppearance((a) => ({ ...a, ...remote })); })
      .catch(() => {})
      .finally(() => { loadedRemote.current = true; });
  }, []);

  // 本地立即保存；后端防抖 600ms 保存（拖滑块时不会狂发请求）
  useEffect(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(appearance)); } catch { /* 存储满了也不影响使用 */ }
    if (!loadedRemote.current) return;
    clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => {
      api('/api/appearance', { method: 'PUT', body: appearance }).catch(() => {});
    }, 600);
  }, [appearance]);

  // 壁纸变化 → 环境色；图片壁纸要先加载完才能取色、才能给瓶子画折射
  const { wallpaper } = appearance;
  useEffect(() => {
    if (wallpaper.type !== 'image' || !wallpaper.url) {
      imgRef.current = null;
      setAmbient(wallpaperById(wallpaper.preset).ambient);
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imgRef.current = img;
      const rgb = sampleAmbient(img);
      if (rgb) setAmbient(rgb);
      setImgReady((n) => n + 1);
    };
    img.src = wallpaper.url;
  }, [wallpaper.type, wallpaper.preset, wallpaper.url]);

  // 浅色还是深色玻璃：跟随壁纸时看壁纸亮度；手动选色时看玻璃本身的亮度
  const auto = appearance.tint.mode === 'auto';
  const light = luminance(auto ? ambient : hexToRgb(appearance.tint.hex)) > LIGHT_THRESHOLD;
  const tintRgb = auto ? autoTintFromAmbient(ambient, light) : hexToRgb(appearance.tint.hex);

  // 设置 → CSS 变量（全 app 的玻璃、气泡都读这些变量）
  useEffect(() => {
    document.documentElement.dataset.glass = light ? 'light' : 'dark';
  }, [light]);
  useEffect(() => {
    const s = document.documentElement.style;
    s.setProperty('--ambient', ambient.join(', '));
    s.setProperty('--glass-tint', tintRgb.join(', '));
    s.setProperty('--glass-alpha', String(appearance.alpha / 100));
    s.setProperty('--glass-blur', `${appearance.blur}px`);
    s.setProperty('--bubble', appearance.bubble);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', `rgb(${tintRgb.join(',')})`);
  }, [ambient, tintRgb.join(','), appearance.alpha, appearance.blur, appearance.bubble]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = useCallback((patch) => setAppearance((a) => ({ ...a, ...patch })), []);
  const reset = useCallback(() => setAppearance(DEFAULT_APPEARANCE), []);

  /** 壁纸的 CSS（给 <Wallpaper/> 用） */
  const wallpaperStyle = useMemo(() => (
    wallpaper.type === 'image' && wallpaper.url
      ? { backgroundImage: `url("${wallpaper.url}")`, backgroundSize: 'cover' }
      : wallpaperStyleOf(wallpaperById(wallpaper.preset))
  ), [wallpaper.type, wallpaper.preset, wallpaper.url]);

  /** 当前预设壁纸要不要画手绘贴纸（自定义图片不画） */
  const stickers = wallpaper.type !== 'image' && !!wallpaperById(wallpaper.preset).stickers;

  /** 把整张壁纸画进 Canvas（按视口尺寸，object-fit: cover），心潮瓶折射用 */
  const paintBackdrop = useCallback((ctx, width, height) => {
    const img = imgRef.current;
    if (wallpaper.type === 'image' && img) {
      const k = Math.max(width / img.width, height / img.height);
      const w = img.width * k;
      const h = img.height * k;
      ctx.drawImage(img, (width - w) / 2, (height - h) / 2, w, h);
    } else {
      paintWallpaper(ctx, wallpaperById(wallpaper.preset), width, height);
    }
  }, [wallpaper.type, wallpaper.preset, imgReady]); // eslint-disable-line react-hooks/exhaustive-deps

  const value = useMemo(() => ({
    appearance, update, reset, ambient, tintRgb, light, stickers, wallpaperStyle, paintBackdrop,
  }), [appearance, update, reset, ambient, tintRgb.join(','), light, stickers, wallpaperStyle, paintBackdrop]); // eslint-disable-line react-hooks/exhaustive-deps

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useAppearance = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAppearance 必须在 <AppearanceProvider> 里面用');
  return v;
};
