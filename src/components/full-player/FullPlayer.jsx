import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronDown, Heart, Ellipsis, Rewind, FastForward, Play, Pause, Volume1, Volume2,
  MessageSquareQuote, Laptop, ListMusic, Shuffle, Repeat, Infinity as InfinityIcon,
} from 'lucide-react';
import { FaceAvatar } from '../Faces.jsx';
import { usePlayer, player, livePosition } from '../../lib/player.js';
import { usePalette, useLyrics, useQueue, useTogether } from '../../lib/music.js';
import { useProfile } from '../../lib/home.js';
import TrackActions from './TrackActions.jsx';
import './full-player.css';

const mmss = (sec) => {
  if (!Number.isFinite(sec)) return '--:--';
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/**
 * 第 05 页 · 全屏播放器（Apple Music 那种）。
 * 挂在 App 最外层，任何页面都能 player.expand('cover' | 'lyrics' | 'queue') 打开。
 * 背景颜色取自封面：浅封面 → 浅底深字，深封面 → 深底白字。
 */
export default function FullPlayer({ navigate }) {
  const st = usePlayer();
  const t = st.track;
  const open = !!st.view && !!t;
  const view = st.view || 'cover';
  const { colors, light } = usePalette(t);
  const together = useTogether(open).data;
  const profile = useProfile();
  const [more, setMore] = useState(false);
  const [drag, setDrag] = useState(0);
  const startY = useRef(null);
  const [, tick] = useState(0);

  // 播放中每 250ms 刷一次进度和歌词
  useEffect(() => {
    if (!open || !st.playing) return undefined;
    const id = setInterval(() => tick((n) => n + 1), 250);
    return () => clearInterval(id);
  }, [open, st.playing]);

  // 打开时锁住底下页面滚动；Esc 收起
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => e.key === 'Escape' && !more && player.collapse();
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [open, more]);

  // 在顶部 / 封面上往下拖收起
  const grab = {
    onTouchStart: (e) => { startY.current = e.touches[0].clientY; },
    onTouchMove: (e) => { if (startY.current != null) setDrag(Math.max(0, e.touches[0].clientY - startY.current)); },
    onTouchEnd: () => { if (drag > 120) player.collapse(); setDrag(0); startY.current = null; },
  };

  const pos = livePosition(st);
  const switchTo = (v) => player.expand(view === v ? 'cover' : v);
  const style = {
    '--c1': colors[0], '--c2': colors[1], '--c3': colors[2], '--c4': colors[3],
    ...(drag ? { transform: `translateY(${drag}px)`, transition: 'none' } : null),
  };

  return createPortal(
    <section
      className="fp"
      data-open={open}
      data-light={light}
      data-view={view}
      role="dialog"
      aria-modal="true"
      aria-label="正在播放"
      aria-hidden={!open}
      style={style}
    >
      <div className="fp-bg" aria-hidden="true"><i /><i /></div>

      {t && (
        <>
          <div className="fp-top" {...grab}>
            <span className="fp-grabber" aria-hidden="true" />
            <div className="fp-topbar">
              <button type="button" className="fp-btn pressable" onClick={player.collapse} aria-label="收起播放器"><ChevronDown aria-hidden="true" /></button>
              {together?.listening && (
                <span className="fp-together">
                  <FaceAvatar src={profile?.avatars?.ai} size={24} ring={0} fallback="dog" alt="" />
                  他也在听
                  {st.playing && <span className="eq" aria-hidden="true"><i /><i /><i /></span>}
                </span>
              )}
              <span className="fp-btn-space" />
            </div>
          </div>

          {view === 'cover' ? (
            <div className="fp-art-wrap" {...grab}>
              {t.cover
                ? <img className="fp-art" data-playing={st.playing} src={t.cover} alt={`${t.title} 的封面`} />
                : <span className="fp-art fp-art--empty" data-playing={st.playing} />}
            </div>
          ) : (
            <div className="fp-head">
              {t.cover ? <img className="fp-head__art" src={t.cover} alt="" /> : <span className="fp-head__art fp-art--empty" />}
              <TitleBlock t={t} small />
              <LoveButton t={t} />
              <button type="button" className="fp-btn fp-btn--sm pressable" onClick={() => setMore(true)} aria-label="更多操作"><Ellipsis aria-hidden="true" /></button>
            </div>
          )}

          {view === 'lyrics' && <Lyrics trackId={t.id} pos={pos} />}
          {view === 'queue' && <Queue trackId={t.id} mode={st.mode} />}

          <div className="fp-panel">
            {view === 'cover' && (
              <div className="fp-title-row">
                <TitleBlock t={t} />
                <LoveButton t={t} />
                <button type="button" className="fp-btn fp-btn--sm pressable" onClick={() => setMore(true)} aria-label="更多操作"><Ellipsis aria-hidden="true" /></button>
              </div>
            )}

            <Slider
              className="fp-scrub"
              label="播放进度"
              value={pos}
              max={t.duration || 1}
              valueText={`${mmss(pos)} / ${mmss(t.duration)}`}
              onCommit={player.seek}
            />
            <div className="fp-times">
              <span>{mmss(pos)}</span>
              {st.device?.name && <span className="fp-device"><Laptop aria-hidden="true" />{st.device.name}</span>}
              <span>-{mmss((t.duration || 0) - pos)}</span>
            </div>

            <div className="fp-controls">
              <button type="button" className="pressable" onClick={player.prev} aria-label="上一首"><Rewind aria-hidden="true" /></button>
              <button type="button" className="pressable fp-play" onClick={player.toggle} aria-label={st.playing ? '暂停' : '播放'}>
                {st.playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
              </button>
              <button type="button" className="pressable" onClick={player.next} aria-label="下一首"><FastForward aria-hidden="true" /></button>
            </div>

            {view === 'cover' && (
              <div className="fp-volume">
                <Volume1 aria-hidden="true" />
                <Slider className="fp-scrub" label="音量" value={st.volume} max={100} valueText={`${Math.round(st.volume)}%`} onCommit={player.volume} />
                <Volume2 aria-hidden="true" />
              </div>
            )}

            <div className="fp-tabs">
              <button type="button" className="pressable" aria-pressed={view === 'lyrics'} onClick={() => switchTo('lyrics')} aria-label="歌词"><MessageSquareQuote aria-hidden="true" /></button>
              <span className="fp-tabs__device" title={st.device?.name ? `在 ${st.device.name} 上播放` : undefined} aria-hidden="true"><Laptop /></span>
              <button type="button" className="pressable" aria-pressed={view === 'queue'} onClick={() => switchTo('queue')} aria-label="播放队列"><ListMusic aria-hidden="true" /></button>
            </div>
          </div>
        </>
      )}

      <TrackActions track={more ? t : null} current inPlayer onClose={() => setMore(false)} navigate={navigate} />
    </section>,
    document.body,
  );
}

function TitleBlock({ t, small }) {
  return (
    <span className={`fp-title${small ? ' fp-title--sm' : ''}`}>
      <b>{t.title}</b>
      <span>{t.artist}</span>
    </span>
  );
}

function LoveButton({ t }) {
  return (
    <button
      type="button"
      className="fp-btn fp-btn--sm fp-love pressable"
      aria-pressed={!!t.loved}
      aria-label={t.loved ? '取消喜欢' : '喜欢'}
      onClick={() => player.love(!t.loved)}
    >
      <Heart aria-hidden="true" />
    </button>
  );
}

/**
 * 进度条 / 音量条。拖动时只改本地显示，松手才发给后端（不然一拖发几十个请求）。
 */
function Slider({ value, max, label, valueText, onCommit, className }) {
  const [local, setLocal] = useState(null);
  const v = local ?? value;
  const commit = () => { if (local != null) { onCommit(local); setLocal(null); } };
  return (
    <input
      type="range"
      className={className}
      min={0}
      max={max}
      step="any"
      value={v}
      aria-label={label}
      aria-valuetext={valueText}
      style={{ '--p': `${(Math.min(v, max) / max) * 100}%` }}
      onChange={(e) => setLocal(Number(e.target.value))}
      onPointerUp={commit}
      onKeyUp={commit}
      onTouchEnd={commit}
      onBlur={commit}
    />
  );
}

/** 歌词：当前句最亮，离得越远越淡越糊；点哪句跳到哪句 */
function Lyrics({ trackId, pos }) {
  const { data } = useLyrics(trackId);
  const lines = data?.lines || [];
  const box = useRef(null);
  const [shift, setShift] = useState(0);
  let cur = -1;
  for (let i = 0; i < lines.length; i += 1) if (lines[i].t <= pos) cur = i;

  // 当前句停在离顶部 1/4 的位置
  useLayoutEffect(() => {
    const el = box.current?.querySelector(`[data-i="${Math.max(0, cur)}"]`);
    if (el) setShift(Math.max(0, el.offsetTop - box.current.clientHeight * 0.25));
  }, [cur, lines.length]);

  if (!data) return <div className="fp-lyrics" />;
  if (data.available === false || !lines.length) {
    return <div className="fp-lyrics fp-lyrics--empty">{data.available === false ? '歌词暂时连不上' : '这首暂时没有歌词'}</div>;
  }
  return (
    <div className="fp-lyrics" ref={box}>
      <div className="fp-lyrics__track" style={{ transform: `translateY(${-shift}px)` }}>
        {lines.map((l, i) => (
          <button
            key={i}
            type="button"
            data-i={i}
            className="fp-line"
            data-state={i === cur ? 'current' : i < cur ? 'past' : 'future'}
            style={{ '--d': Math.min(4, Math.abs(i - Math.max(cur, 0))) }}
            aria-current={i === cur ? 'true' : undefined}
            onClick={() => player.seek(l.t)}
          >
            {l.text}
            {l.marked && <span className="fp-mark"><Heart aria-hidden="true" />他划的</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

const MODES = [
  { key: 'shuffle', label: '随机', icon: Shuffle },
  { key: 'repeat', label: '循环', icon: Repeat },
  { key: 'autoplay', label: '自动续播', icon: InfinityIcon },
];

/** 播放队列：三个模式开关 + 接下来要放的歌。「他插的」= 他用工具加进来的 */
function Queue({ trackId, mode }) {
  const { data } = useQueue(trackId);
  const items = data?.items || [];
  return (
    <div className="fp-queue">
      <div className="fp-modes">
        {MODES.map(({ key, label, icon: Icon }) => (
          <button key={key} type="button" className="pressable" aria-pressed={!!mode[key]} onClick={() => player.setMode({ [key]: !mode[key] })}>
            <Icon aria-hidden="true" />{label}
          </button>
        ))}
      </div>
      <div className="fp-queue__head">
        <b>接下来</b>
        {data?.source?.name && <span>来自「{data.source.name}」</span>}
      </div>
      <div className="fp-queue__list">
        {data && !items.length && <p className="fp-queue__empty">后面没有歌了{mode.autoplay ? '，放完会自动续播相似的歌' : ''}</p>}
        {items.map((q, i) => (
          <button key={`${q.id}-${i}`} type="button" className="fp-qrow pressable" onClick={() => player.skipTo(i)}>
            {q.cover ? <img src={q.cover} alt="" /> : <span className="fp-art--empty" />}
            <span className="fp-qrow__text">
              <span className="fp-qrow__title"><b>{q.title}</b>{q.addedBy === 'ai' && <span className="fp-tag">他插的</span>}</span>
              <span className="fp-qrow__sub">{q.artist}</span>
            </span>
            <span className="fp-qrow__dur">{mmss(q.duration)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
