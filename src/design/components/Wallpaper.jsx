import { useAppearance } from '../../theme/AppearanceContext.jsx';

const Paw = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="var(--sticker)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <ellipse cx="12" cy="15.5" rx="4.4" ry="3.6" />
    <circle cx="6.2" cy="10.2" r="1.8" /><circle cx="9.7" cy="6.6" r="1.8" />
    <circle cx="14.3" cy="6.6" r="1.8" /><circle cx="17.8" cy="10.2" r="1.8" />
  </svg>
);
const Sparkle = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#f3c45c" strokeWidth="1.7" strokeLinejoin="round">
    <path d="M12 2.5c.8 5.4 4.1 8.7 9.5 9.5-5.4.8-8.7 4.1-9.5 9.5-.8-5.4-4.1-8.7-9.5-9.5 5.4-.8 8.7-4.1 9.5-9.5Z" />
  </svg>
);
const Drop = ({ size }) => (
  <svg width={size * 0.7} height={size} viewBox="0 0 14 20" fill="none" stroke="#9cc9f0" strokeWidth="1.6">
    <path d="M7 1.5C9 6 12.5 9.5 12.5 13a5.5 5.5 0 0 1-11 0C1.5 9.5 5 6 7 1.5Z" />
  </svg>
);

/** 手绘贴纸的位置（相对视口的百分比） */
const STICKERS = [
  { C: Paw, size: 28, left: '60%', top: '2.5%', delay: '0s' },
  { C: Paw, size: 22, left: '78%', top: '5%', delay: '-3.1s' },
  { C: Sparkle, size: 26, left: '87%', top: '15%', delay: '-1.6s' },
  { C: Drop, size: 20, left: '4%', top: '34%', delay: '-2.4s' },
  { C: Sparkle, size: 16, left: '6%', top: '70%', delay: '-0.8s' },
  { C: Paw, size: 24, left: '86%', top: '62%', delay: '-2s' },
];

/**
 * 全屏壁纸层。放在 App 最外层，所有玻璃都透出它。
 * 壁纸是什么、要不要贴纸，全由 AppearanceProvider 决定，这里只负责画。
 */
export default function Wallpaper() {
  const { wallpaperStyle, stickers } = useAppearance();
  return (
    <div className="wallpaper" style={wallpaperStyle} aria-hidden="true">
      {stickers && STICKERS.map(({ C, size, left, top, delay }, i) => (
        <span key={i} className="wallpaper__sticker" style={{ left, top, animationDelay: delay }}>
          <C size={size} />
        </span>
      ))}
    </div>
  );
}
