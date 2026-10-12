/**
 * 外观预设。壁纸用结构化数据描述，同一份数据：
 *   - toCss()   生成 CSS background-image，给页面铺底
 *   - paint()   画进 Canvas，给心潮瓶做折射（瓶子里能看见被放大、弯折的背景）
 * 全部是渐变，不依赖任何图片版权。
 */

/**
 * 一张预设壁纸 = 底色线性渐变 + 若干云团（径向椭圆）+ 可选星点 + 可选点阵 + 可选手绘贴纸。
 * 亮度够高的壁纸会自动切到浅色玻璃（深字），见 AppearanceContext。
 */
export const WALLPAPERS = [
  {
    id: 'milk',
    name: '奶糖',
    ambient: [250, 232, 234],
    stops: [[0, '#fdf8f6'], [0.55, '#fcf0f0'], [1, '#fbe8ec']],
    blobs: [
      [0.85, 0.06, 0.55, 0.26, 'rgba(255,210,222,.75)'],
      [0.08, 0.46, 0.50, 0.28, 'rgba(255,226,234,.85)'],
      [0.70, 0.92, 0.60, 0.30, 'rgba(255,220,228,.70)'],
    ],
    stars: [],
    dots: { color: 'rgba(214,165,168,.30)', size: 24 },
    stickers: true,
  },
  {
    id: 'sky',
    name: '晴空',
    ambient: [110, 150, 215],
    stops: [[0, '#0f285f'], [0.4, '#22509f'], [0.72, '#5f8bd2'], [1, '#9dbde9']],
    blobs: [
      [0.50, 0.14, 0.42, 0.24, 'rgba(255,255,255,.78)'],
      [0.16, 0.40, 0.36, 0.20, 'rgba(228,240,255,.55)'],
      [0.88, 0.56, 0.40, 0.24, 'rgba(214,232,255,.50)'],
      [0.40, 0.84, 0.60, 0.30, 'rgba(235,245,255,.55)'],
      [0.74, 0.26, 0.28, 0.16, 'rgba(255,255,255,.32)'],
    ],
    stars: [],
  },
  {
    id: 'dusk',
    name: '黄昏',
    ambient: [196, 132, 172],
    stops: [[0, '#2b1f5c'], [0.4, '#6a3d8f'], [0.72, '#b8607f'], [1, '#e09a7c']],
    blobs: [
      [0.30, 0.20, 0.50, 0.28, 'rgba(255,214,226,.50)'],
      [0.80, 0.56, 0.44, 0.26, 'rgba(255,186,150,.42)'],
      [0.50, 1.00, 0.70, 0.36, 'rgba(255,214,190,.45)'],
    ],
    stars: [],
  },
  {
    id: 'snow',
    name: '雪窗',
    ambient: [150, 180, 215],
    stops: [[0, '#3e5a80'], [0.5, '#7d9dc4'], [1, '#b7cce6']],
    blobs: [
      [0.70, 0.18, 0.40, 0.28, 'rgba(255,255,255,.75)'],
      [0.20, 0.70, 0.50, 0.36, 'rgba(235,244,255,.60)'],
    ],
    stars: [[0.20, 0.30, 3], [0.60, 0.48, 2], [0.82, 0.74, 3], [0.36, 0.62, 2]],
  },
  {
    id: 'night',
    name: '夜航',
    ambient: [70, 92, 150],
    stops: [[0, '#050a1c'], [0.55, '#0d1b40'], [1, '#22356e']],
    blobs: [[0.50, 1.08, 0.60, 0.36, 'rgba(90,120,200,.50)']],
    stars: [[0.15, 0.18, 1.5], [0.40, 0.10, 1], [0.72, 0.26, 1.5], [0.88, 0.08, 1], [0.55, 0.38, 1]],
  },
];

export const wallpaperById = (id) => WALLPAPERS.find((w) => w.id === id) || WALLPAPERS[0];

/** 结构化壁纸 → CSS（backgroundImage + 每层的 backgroundSize），直接塞进 style */
export function wallpaperStyleOf(w) {
  const layers = [];
  const sizes = [];
  if (w.dots) {
    layers.push(`radial-gradient(circle at 2px 2px, ${w.dots.color} 1.2px, transparent 1.8px)`);
    sizes.push(`${w.dots.size}px ${w.dots.size}px`);
  }
  for (const [x, y, r] of w.stars) {
    layers.push(`radial-gradient(${r}px ${r}px at ${x * 100}% ${y * 100}%, #fff, transparent)`);
    sizes.push('100% 100%');
  }
  for (const [x, y, rx, ry, c] of w.blobs) {
    layers.push(`radial-gradient(${rx * 100}% ${ry * 100}% at ${x * 100}% ${y * 100}%, ${c}, transparent 72%)`);
    sizes.push('100% 100%');
  }
  layers.push(`linear-gradient(180deg, ${w.stops.map(([p, c]) => `${c} ${p * 100}%`).join(', ')})`);
  sizes.push('100% 100%');
  return { backgroundImage: layers.join(', '), backgroundSize: sizes.join(', ') };
}

/** 结构化壁纸 → 画进 2D Canvas（w×h 是整个视口的尺寸） */
export function paintWallpaper(ctx, w, width, height) {
  const lg = ctx.createLinearGradient(0, 0, 0, height);
  w.stops.forEach(([p, c]) => lg.addColorStop(p, c));
  ctx.fillStyle = lg;
  ctx.fillRect(0, 0, width, height);
  for (const [x, y, rx, ry, c] of w.blobs) {
    ctx.save();
    ctx.translate(x * width, y * height);
    ctx.scale(rx * width, ry * height);
    const rg = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    rg.addColorStop(0, c);
    rg.addColorStop(0.72, 'rgba(255,255,255,0)');
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(0, 0, 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  if (w.dots) {
    ctx.fillStyle = w.dots.color;
    for (let y = 2; y < height; y += w.dots.size) {
      for (let x = 2; x < width; x += w.dots.size) {
        ctx.beginPath();
        ctx.arc(x, y, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.fillStyle = '#fff';
  for (const [x, y, r] of w.stars) {
    ctx.beginPath();
    ctx.arc(x * width, y * height, r / 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** 玻璃色调预设（"跟随壁纸"不在这里，它由环境色实时算出） */
export const TINTS = [
  { id: 'cream', name: '奶白', hex: '#FFF7F5' },
  { id: 'blush', name: '淡粉', hex: '#FFE1EA' },
  { id: 'mist', name: '雾灰', hex: '#6B7C96' },
  { id: 'sky', name: '天蓝', hex: '#3F7CC9' },
  { id: 'sakura', name: '樱粉', hex: '#C9718F' },
  { id: 'mint', name: '薄荷', hex: '#4E9C8A' },
  { id: 'dusk', name: '暮紫', hex: '#7A62B8' },
  { id: 'ink', name: '夜黑', hex: '#23262E' },
];

/** 我的气泡颜色 */
export const BUBBLES = [
  { id: 'imessage', name: '信息蓝', hex: '#0A84FF' },
  { id: 'sakura', name: '樱粉', hex: '#FF6FA8' },
  { id: 'mint', name: '薄荷', hex: '#30B08F' },
  { id: 'dusk', name: '暮紫', hex: '#8E6CE0' },
];

/** 心潮瓶造型（几何定义见 components/tide-bottle/shapes.js） */
export const BOTTLE_SHAPES = [
  { id: 'round', name: '圆瓶' },
  { id: 'jar', name: '许愿瓶' },
  { id: 'heart', name: '爱心' },
  { id: 'drop', name: '水滴' },
  { id: 'pup', name: '狗狗' },
];

/** 出厂默认外观 */
export const DEFAULT_APPEARANCE = {
  wallpaper: { type: 'preset', preset: 'milk', url: null },
  tint: { mode: 'auto', hex: '#6B7C96' }, // mode: 'auto' 跟随壁纸 | 'manual' 用 hex
  alpha: 40, // 玻璃浓度 15–70
  blur: 26, // 磨砂 6–44（px）
  bubble: '#0A84FF',
  bottle: 'round',
};

/** '#RRGGBB' → [r, g, b] */
export function hexToRgb(hex) {
  const h = String(hex).replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) || 0);
}

/** 相对亮度 0–1（sRGB 近似） */
export const luminance = ([r, g, b]) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

/** 超过这个亮度就用浅色玻璃（深字） */
export const LIGHT_THRESHOLD = 0.62;

/**
 * 跟随壁纸时玻璃的颜色：
 *   深壁纸 → 环境色压暗，配白字
 *   浅壁纸 → 环境色提亮成奶白，配深字
 */
export const autoTintFromAmbient = (rgb, light = false) => (light
  ? rgb.map((c) => Math.round(c + (255 - c) * 0.82))
  : rgb.map((c) => Math.round(c * 0.55)));
