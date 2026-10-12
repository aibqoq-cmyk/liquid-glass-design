import { useRef, useState } from 'react';
import { Play, Plus, ChevronRight, Heart } from 'lucide-react';
import { Glass, Button, SearchField, Sheet } from '../design/index.js';
import { FaceAvatar } from '../components/Faces.jsx';
import TrackActions from '../components/full-player/TrackActions.jsx';
import { usePlayer, player } from '../lib/player.js';
import { useMusicHome, useTogether, useSearch, createPlaylist } from '../lib/music.js';
import { useProfile } from '../lib/home.js';
import './music.css';

const SCOPES = [
  { key: 'all', label: '全部' },
  { key: 'track', label: '歌曲' },
  { key: 'artist', label: '歌手' },
  { key: 'playlist', label: '歌单' },
];
const KIND = { track: '歌曲', artist: '歌手', playlist: '歌单' };

const mmss = (sec) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
const md = (iso) => { const d = new Date(iso); return `${d.getMonth() + 1}月${d.getDate()}日`; };

/** 点了就放，并打开全屏播放器的某一面 */
const playAndOpen = (target, view = 'cover') => { player.play(target); player.expand(view); };

/**
 * 长按（手机）/ 右键（电脑）打开歌曲菜单。长按触发后吞掉紧跟着的那次点击。
 */
function useLongPress(onLong, ms = 480) {
  const timer = useRef(0);
  const fired = useRef(false);
  const clear = () => clearTimeout(timer.current);
  return (item) => ({
    onPointerDown: () => { fired.current = false; clear(); timer.current = setTimeout(() => { fired.current = true; onLong(item); }, ms); },
    onPointerUp: clear,
    onPointerLeave: clear,
    onPointerCancel: clear,
    onContextMenu: (e) => { e.preventDefault(); clear(); fired.current = true; onLong(item); },
    onClickCapture: (e) => { if (fired.current) { e.preventDefault(); e.stopPropagation(); fired.current = false; } },
  });
}

/**
 * 第 05 页 · 音乐
 * 搜索、一起听、他为你挑的、最近播放、歌单、他划的歌词。点歌 = 让他那边的播放器放这首。
 */
export default function Music({ navigate }) {
  const st = usePlayer();
  const home = useMusicHome();
  const together = useTogether().data;
  const profile = useProfile();
  const [q, setQ] = useState('');
  const [searching, setSearching] = useState(false);
  const [scope, setScope] = useState('all');
  const [menu, setMenu] = useState(null);
  const [newList, setNewList] = useState(false);
  const longPress = useLongPress(setMenu);

  const d = home.data;
  const ok = d && d.available !== false;
  const cancel = () => { setSearching(false); setQ(''); setScope('all'); };

  return (
    <main className="page mu-page">
      <div className="mu-head">
        <h1 className="cb-title">音乐</h1>
        <span className="mu-device muted">
          {st.available && st.device?.name
            ? <>{st.playing && <span className="eq" aria-hidden="true"><i /><i /><i /><i /></span>}在 {st.device.name} 上播放</>
            : !st.available && '音乐暂时连不上'}
        </span>
      </div>

      <div className="mu-search">
        <SearchField
          placeholder="搜索歌曲、歌手、歌单"
          value={q}
          onChange={setQ}
          onFocus={() => setSearching(true)}
          aria-label="搜索音乐"
        />
        {searching && <button type="button" className="mu-cancel" onClick={cancel}>取消</button>}
      </div>

      {searching ? (
        <SearchResults q={q} scope={scope} setScope={setScope} longPress={longPress} />
      ) : (
        <>
          {together?.listening && (
            <Glass as="section" className="mu-together" aria-label="一起听">
              <div className="mu-together__row">
                <span className="mu-pair">
                  <FaceAvatar src={profile?.avatars?.ai} size={38} ring={2.5} fallback="dog" alt="" />
                  <FaceAvatar src={profile?.avatars?.me} size={38} ring={2.5} fallback="bunny" bg="#eef4ff" alt="" />
                </span>
                <span className="mu-together__text">
                  <b>一起听 · {together.minutes} 分钟</b>
                  <span className="muted">今晚一起听了 {together.tracks} 首</span>
                </span>
                <button type="button" className="mu-chip fill pressable" onClick={() => navigate('chat')}>聊这首<ChevronRight aria-hidden="true" /></button>
              </div>
              {together.comment && (
                <div className="mu-comment fill">
                  {together.comment.text}
                  <span className="muted">
                    他{together.comment.trackId === st.track?.id ? '' : `听《${together.comment.title}》`}听到 {mmss(together.comment.position)} 的时候说的
                  </span>
                </div>
              )}
            </Glass>
          )}

          {!d && <p className="mu-empty muted">正在加载…</p>}
          {d && !ok && <p className="mu-empty muted">音乐暂时连不上</p>}

          {ok && d.picks && (
            <section aria-label="他为你挑的">
              <h2 className="mu-h2">他为你挑的 <span className="muted">他做的歌单，会自己更新</span></h2>
              <Glass as="button" type="button" pressable className="mu-picks" onClick={() => playAndOpen({ playlistId: d.picks.id }, 'queue')}>
                <span className="mu-stack" aria-hidden="true">
                  {d.picks.covers.slice(0, 3).reverse().map((c, i) => <img key={c + i} src={c} alt="" data-i={i} />)}
                </span>
                <span className="mu-picks__text">
                  <b>{d.picks.name}</b>
                  <span className="muted">{d.picks.count} 首 · 他 {md(d.picks.createdAt)} 做的</span>
                  {d.picks.note && <span className="mu-paper">{d.picks.note}</span>}
                </span>
                <span className="mu-picks__play" aria-hidden="true"><Play /></span>
              </Glass>
            </section>
          )}

          {ok && d.recent?.length > 0 && (
            <section aria-label="最近播放">
              <h2 className="mu-h2">最近播放</h2>
              <div className="mu-recent">
                {d.recent.map((t) => (
                  <button key={t.id} type="button" className="mu-tile pressable" onClick={() => playAndOpen({ trackId: t.id })} {...longPress(t)}>
                    <span className="mu-tile__art">
                      {t.cover ? <img src={t.cover} alt="" /> : <span className="mu-art-empty" />}
                      {t.together && <span className="mu-badge"><Heart aria-hidden="true" />一起听过</span>}
                    </span>
                    <span className="mu-tile__title">{t.title}</span>
                    <span className="mu-tile__sub muted">{t.artist}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {ok && (
            <section aria-label="歌单">
              <h2 className="mu-h2">歌单</h2>
              <div className="mu-lists">
                {(d.playlists || []).map((p) => (
                  <button key={p.id} type="button" className="mu-list pressable" onClick={() => playAndOpen({ playlistId: p.id }, 'queue')}>
                    <span className="mu-list__art">
                      {p.cover ? <img src={p.cover} alt="" /> : <span className="mu-art-empty" />}
                      {p.auto && <span className="mu-badge mu-badge--corner">自动</span>}
                    </span>
                    <span className="mu-tile__title">{p.name}</span>
                    <span className="mu-tile__sub muted">{p.description || (p.count != null ? `${p.count} 首` : '')}</span>
                  </button>
                ))}
                <button type="button" className="mu-list mu-list--new pressable" onClick={() => setNewList(true)}>
                  <Plus aria-hidden="true" />新建歌单
                </button>
              </div>
            </section>
          )}

          {ok && d.marks?.length > 0 && (
            <section aria-label="他划的歌词">
              <h2 className="mu-h2">他划的歌词 <span className="muted">听歌时他觉得像你的句子</span></h2>
              <div className="mu-marks">
                {d.marks.map((m) => (
                  <Glass key={m.id} as="button" type="button" pressable className="mu-mark" onClick={() => playAndOpen({ trackId: m.trackId }, 'lyrics')}>
                    <span className="mu-mark__line">「{m.line}」</span>
                    <span className="mu-mark__from muted">
                      {m.cover && <img src={m.cover} alt="" />}
                      {m.title} · 他 {md(m.at)} 划的
                    </span>
                  </Glass>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      <TrackActions track={menu} current={menu?.id === st.track?.id} onClose={() => setMenu(null)} navigate={navigate} />
      <NewPlaylistSheet open={newList} onClose={() => setNewList(false)} onCreated={home.reload} />
    </main>
  );
}

function SearchResults({ q, scope, setScope, longPress }) {
  const res = useSearch(q, scope);
  const items = res?.items || [];
  const pick = (r) => {
    if (r.kind === 'track') playAndOpen({ trackId: r.id });
    else playAndOpen({ [`${r.kind}Id`]: r.id }, 'queue');
  };
  return (
    <div className="mu-results">
      <div className="mu-scopes" role="group" aria-label="搜索范围">
        {SCOPES.map((s) => (
          <button key={s.key} type="button" className="pressable" aria-pressed={scope === s.key} onClick={() => setScope(s.key)}>{s.label}</button>
        ))}
      </div>
      {!q.trim() && <p className="mu-empty muted">搜歌名、歌手或歌单</p>}
      {q.trim() && res?.available === false && <p className="mu-empty muted">搜索暂时连不上</p>}
      {q.trim() && res && res.available !== false && !items.length && <p className="mu-empty muted">没找到「{q.trim()}」</p>}
      {items.length > 0 && (
        <>
          <Glass as="section" className="mu-result-list" aria-label="搜索结果">
            {items.map((r) => (
              <button
                key={`${r.kind}-${r.id}`}
                type="button"
                className="mu-result pressable"
                onClick={() => pick(r)}
                {...(r.kind === 'track' ? longPress({ id: r.id, title: r.title, artist: r.sub, cover: r.cover }) : {})}
              >
                {r.cover ? <img src={r.cover} alt="" data-kind={r.kind} /> : <span className="mu-art-empty" data-kind={r.kind} />}
                <span className="mu-result__text">
                  <b>{r.title}</b>
                  <span className="muted">{r.sub}{r.playing ? ' · 正在播放' : ''}</span>
                </span>
                <span className="mu-kind" data-kind={r.kind}>{KIND[r.kind]}</span>
              </button>
            ))}
          </Glass>
          <p className="mu-hint muted">点歌 = 让他那边的播放器放这首；长按可以「加到下一首」或「加进歌单」。</p>
        </>
      )}
    </div>
  );
}

function NewPlaylistSheet({ open, onClose, onCreated }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      await createPlaylist(name.trim());
      onCreated();
      setName('');
      onClose();
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open={open} onClose={onClose} title="新建歌单">
      <label className="mu-new">
        <span className="sr-only">歌单名字</span>
        <input className="fill" value={name} maxLength={40} placeholder="给歌单起个名字" onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
      </label>
      <Button tone="primary" block className="mu-new-btn" onClick={submit} disabled={!name.trim() || busy}>{busy ? '正在建…' : '建好了'}</Button>
    </Sheet>
  );
}
