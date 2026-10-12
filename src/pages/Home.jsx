import { useEffect, useRef, useState } from 'react';
import { ChevronRight, ImagePlus, Rewind, FastForward, Play, Pause, RotateCcw, RotateCw, BadgeCheck, Heart, Library } from 'lucide-react';
import { Glass } from '../design/index.js';
import { FaceAvatar } from '../components/Faces.jsx';
import ChatBoxes from '../components/chat-boxes/ChatBoxes.jsx';
import { useProfile, useReading } from '../lib/home.js';
import { usePlayer, player, livePosition } from '../lib/player.js';
import { useSessions } from '../lib/chat.js';
import './home.css';

const PANES = ['主页', '聊天框'];

/**
 * 第 03 页 · 首页
 * 三屏左右滑：① 个人主页 ② 聊天框 ③ 记忆（日历）。每一屏各自上下滚动。
 * 网址 #/home?p=2 可以直接打开第二屏。
 */
export default function Home({ navigate }) {
  const pager = useRef(null);
  const [active, setActive] = useState(() => Math.max(0, Math.min(PANES.length - 1, Number(new URLSearchParams(location.hash.split('?')[1]).get('p') || 1) - 1)));

  // 打开时跳到指定那一屏（不带动画）
  useEffect(() => {
    const el = pager.current;
    if (el) el.scrollLeft = active * el.clientWidth;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onScroll = () => {
    const el = pager.current;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (i !== active) setActive(i);
  };
  const goTo = (i) => pager.current?.scrollTo({ left: i * pager.current.clientWidth, behavior: 'smooth' });

  return (
    <main className="home">
      <div className="home-pager" ref={pager} onScroll={onScroll}>
        <section className="home-pane" aria-label="主页"><div className="page home-page"><ProfilePane navigate={navigate} /></div></section>
        <section className="home-pane" aria-label="聊天框"><div className="page home-page"><ChatPane navigate={navigate} /></div></section>
      </div>
      <nav className="home-dots" aria-label="分页">
        {PANES.map((name, i) => (
          <button key={name} type="button" aria-label={`第 ${i + 1} 页：${name}`} aria-current={i === active ? 'page' : undefined} onClick={() => goTo(i)} />
        ))}
      </nav>
    </main>
  );
}

/* ───────── 第一屏：个人主页 ───────── */

function ProfilePane({ navigate }) {
  const p = useProfile();
  const ok = p && p.available !== false;
  return (
    <>
      <div className="hm-avatars">
        <FaceAvatar src={p?.avatars?.ai} alt="他的头像" size={104} ring={4} fallback="dog" bg="#fff0f3" />
        <span className="hm-heart" aria-hidden="true"><Heart /></span>
        <FaceAvatar src={p?.avatars?.me} alt="我的头像" size={104} ring={4} fallback="bunny" bg="#eef4ff" />
      </div>

      <h1 className="hm-name">
        {ok ? p.name : ' '}
        {ok && p.verified && <BadgeCheck className="hm-verified" aria-label="已认证" />}
      </h1>
      {ok && p.handle && <div className="hm-handle muted">@{p.handle}</div>}
      {ok && p.bio && <p className="hm-bio">{p.bio}</p>}
      {ok && p.tags?.length > 0 && <div className="hm-tags muted">{p.tags.map((t) => `#${t}`).join(' ')}</div>}

      {ok && p.stats?.length > 0 && (
        <div className="hm-stats">
          {p.stats.map((s) => {
            const body = <><b>{s.value}</b><span className="muted">{s.unit}</span></>;
            return s.href
              ? <a key={s.label} href={s.href} className="hm-stat pressable" aria-label={`${s.label} ${s.value}${s.unit}`}>{body}</a>
              : <span key={s.label} className="hm-stat" aria-label={`${s.label} ${s.value}${s.unit}`}>{body}</span>;
          })}
        </div>
      )}

      <div className="hm-cards">
        {[0, 1].map((i) => {
          const c = p?.cards?.[i];
          const inner = c?.image
            ? <img src={c.image} alt={c.alt || ''} />
            : <span className="hm-card__empty"><ImagePlus aria-hidden="true" /><span>放一张图</span></span>;
          return c?.href
            ? <a key={i} href={c.href} className="hm-card pressable">{inner}</a>
            : <div key={i} className="hm-card">{inner}</div>;
        })}
      </div>

      <MusicCard onLibrary={() => navigate('music')} />
      <ReadingCard />
    </>
  );
}

const mmss = (sec) => {
  if (!Number.isFinite(sec)) return '--:--';
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** 正在播放（和迷你播放条同一份状态）。点封面或歌名打开全屏播放器，右上角进音乐库 */
function MusicCard({ onLibrary }) {
  const st = usePlayer();
  const [, tick] = useState(0);
  useEffect(() => {
    if (!st.playing) return undefined;
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [st.playing]);

  const t = st.track;
  if (!t) {
    return (
      <Glass as="button" type="button" pressable className="hm-music hm-music--idle" aria-label="去音乐库" onClick={onLibrary}>
        <span className="muted">{st.available ? '现在没在放歌，去音乐库挑一首' : '音乐暂时连不上'}</span>
      </Glass>
    );
  }
  const pos = livePosition(st);
  const pct = t.duration ? Math.min(100, (pos / t.duration) * 100) : 0;
  return (
    <Glass as="section" className="hm-music" aria-label="正在播放">
      <button type="button" className="hm-music__cover-btn pressable" onClick={() => player.expand('cover')} aria-label="打开播放器">
        {t.cover ? <img className="hm-music__cover" src={t.cover} alt="" /> : <span className="hm-music__cover hm-music__cover--empty" />}
      </button>
      <button type="button" className="hm-music__lib pressable" onClick={onLibrary} aria-label="音乐库"><Library aria-hidden="true" /></button>
      <div className="hm-music__body">
        <button type="button" className="hm-music__title" onClick={() => player.expand('cover')}><b>{t.title}</b> <span className="muted">· {t.artist}</span></button>
        {t.lyric && <div className="hm-music__lyric muted">{t.lyric}</div>}
        <div className="hm-music__progress muted">
          <span>{mmss(pos)}</span>
          <span className="hm-music__bar"><i style={{ width: `${pct}%` }} /></span>
          <span>{mmss(t.duration)}</span>
        </div>
        <div className="hm-music__controls">
          <button type="button" className="pressable" aria-label="后退 10 秒" onClick={() => player.seekBy(-10)}><RotateCcw /></button>
          <button type="button" className="pressable hm-fill-icon" aria-label="上一首" onClick={player.prev}><Rewind /></button>
          <button type="button" className="pressable hm-music__play" aria-label={st.playing ? '暂停' : '播放'} onClick={player.toggle}>
            {st.playing ? <Pause /> : <Play />}
          </button>
          <button type="button" className="pressable hm-fill-icon" aria-label="下一首" onClick={player.next}><FastForward /></button>
          <button type="button" className="pressable" aria-label="快进 10 秒" onClick={() => player.seekBy(10)}><RotateCw /></button>
        </div>
      </div>
    </Glass>
  );
}

/** 心潮入口：小圆瓶 + 此刻一句话 */
function ReadingCard() {
  const r = useReading();
  if (!r || r.available === false || !r.items?.length) return null;
  return (
    <Glass as="section" className="hm-read" aria-label="继续阅读">
      <div className="hm-read__head">
        <h2>继续阅读</h2>
        {r.href
          ? <a className="muted" href={r.href}>全部 {r.total} 本<ChevronRight aria-hidden="true" /></a>
          : <span className="muted">全部 {r.total} 本</span>}
      </div>
      <div className="hm-read__shelf">
        {r.items.map((b) => {
          const cover = b.cover
            ? <img src={b.cover} alt={b.title} />
            : <span className="hm-book__type" style={{ background: b.color || '#efe6e0', color: b.ink || '#5e4448' }}>{b.title}</span>;
          return b.href
            ? <a key={b.id} href={b.href} className="hm-book pressable" aria-label={b.title}>{cover}</a>
            : <span key={b.id} className="hm-book" aria-label={b.title}>{cover}</span>;
        })}
      </div>
    </Glass>
  );
}

/* ───────── 第二屏：聊天框 ───────── */

function ChatPane({ navigate }) {
  const { data, reload } = useSessions();
  return <ChatBoxes data={data} onOpen={(id) => navigate(`chat/${id}`)} reload={reload} />;
}

/* ───────── 第三屏：记忆（日历，和底部「记忆」标签同一个） ───────── */

