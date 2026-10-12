import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Pause, Play, FastForward, X, Music2 } from 'lucide-react';
import { Glass, Badge } from './primitives.jsx';

/**
 * 底部悬浮导航胶囊。选中项下面有一颗亮玻璃泡，切换时带弹簧滑过去。
 * @param {{ key: string, label: string, icon: Component, badge?: number }[]} tabs
 * @param {string} active 当前选中的 key
 * @param {(key: string) => void} onChange
 */
export function TabBar({ tabs, active, onChange }) {
  const index = Math.max(0, tabs.findIndex((t) => t.key === active));
  return (
    <Glass
      as="nav"
      shape="pill"
      className="tabbar"
      aria-label="主导航"
      style={{ '--tab-count': tabs.length, '--tab-index': index }}
    >
      <span className="tabbar__bubble" aria-hidden="true" />
      {tabs.map(({ key, label, icon: Icon, badge }) => (
        <button
          key={key}
          type="button"
          className="tabbar__item pressable"
          aria-current={key === active ? 'page' : undefined}
          onClick={() => onChange?.(key)}
        >
          <Icon aria-hidden="true" />
          <span>{label}</span>
          <Badge count={badge} />
        </button>
      ))}
    </Glass>
  );
}

/**
 * 迷你播放条，悬浮在导航上方，全局常驻。
 * @param {{ title: string, artist: string, cover?: string }} track 没有歌时传 null，播放条整个隐藏
 * @param {boolean} playing
 * @param {() => void} onToggle 播放/暂停
 * @param {() => void} onNext 下一首
 * @param {() => void} onOpen 点歌名区域，打开全屏播放器
 */
export function MiniPlayer({ track, playing, onToggle, onNext, onOpen }) {
  if (!track) return null;
  return (
    <Glass shape="pill" variant="thick" className="miniplayer">
      <button type="button" className="row pressable" style={{ flex: 1, minWidth: 0 }} onClick={onOpen} aria-label="打开播放器">
        {track.cover ? (
          <img className={`miniplayer__cover ${playing ? 'miniplayer__cover--spin' : ''}`} src={track.cover} alt="" />
        ) : (
          <span className="miniplayer__cover" style={{ display: 'grid', placeItems: 'center', background: 'rgba(255,255,255,.2)' }}>
            <Music2 size={22} aria-hidden="true" />
          </span>
        )}
        <span className="miniplayer__meta">
          <span className="miniplayer__title">
            <b>{track.title}</b>
            <span className={`eq ${playing ? '' : 'eq--paused'}`} aria-hidden="true"><i /><i /><i /><i /></span>
          </span>
          <span className="miniplayer__artist">{track.artist}</span>
        </span>
      </button>
      <button type="button" className="icon-btn pressable" onClick={onToggle} aria-label={playing ? '暂停' : '播放'}>
        {playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
      </button>
      <button type="button" className="icon-btn pressable" onClick={onNext} aria-label="下一首">
        <FastForward aria-hidden="true" />
      </button>
    </Glass>
  );
}

/**
 * 底部弹层。思考过程、命令行输出、全屏播放器、设置详情都用它。
 * 支持：点遮罩关闭、Esc 关闭、按住标题区往下拖关闭。
 * @param {'regular'|'thick'|'dark'} variant 播放器用 dark
 */
export function Sheet({ open, onClose, title, variant = 'thick', children }) {
  const [drag, setDrag] = useState(0);
  const startY = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  const onTouchStart = (e) => { startY.current = e.touches[0].clientY; };
  const onTouchMove = (e) => {
    if (startY.current == null) return;
    setDrag(Math.max(0, e.touches[0].clientY - startY.current));
  };
  const onTouchEnd = () => {
    if (drag > 110) onClose?.();
    setDrag(0);
    startY.current = null;
  };

  return createPortal(
    <>
      <div className="sheet-scrim" data-open={open} onClick={onClose} style={{ pointerEvents: open ? 'auto' : 'none' }} />
      <Glass
        variant={variant}
        className="sheet"
        data-open={open}
        role="dialog"
        aria-modal="true"
        aria-hidden={!open}
        aria-label={title}
        style={drag ? { transform: `translate(-50%, ${drag}px)`, transition: 'none' } : undefined}
      >
        <div onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
          <div className="sheet__grabber" aria-hidden="true" />
          {title != null && (
            <div className="sheet__head">
              <button type="button" className="icon-btn icon-btn--sm fill pressable" style={{ borderRadius: '50%' }} onClick={onClose} aria-label="关闭">
                <X aria-hidden="true" />
              </button>
              <div className="sheet__title">{title}</div>
              <span />
            </div>
          )}
        </div>
        <div className="sheet__body">{children}</div>
      </Glass>
    </>,
    document.body,
  );
}
