import { useEffect, useState } from 'react';
import { Play, ListStart, ListEnd, ListPlus, MessageCircle, Library, Check, ChevronLeft } from 'lucide-react';
import { Sheet } from '../../design/index.js';
import { player } from '../../lib/player.js';
import { useMusicHome, addToPlaylist } from '../../lib/music.js';

/**
 * 一首歌的操作菜单（底部弹层）。音乐页长按歌曲、全屏播放器的「···」都用它。
 * @param {object|null} track 打开时传歌，关闭时传 null
 * @param {boolean} current 是不是正在放的这首（是就不显示「现在播放」「下一首播放」）
 * @param {boolean} inPlayer 从全屏播放器里打开（多一个「去音乐库」）
 */
export default function TrackActions({ track, current = false, inPlayer = false, onClose, navigate }) {
  const open = !!track;
  const [picking, setPicking] = useState(false);
  const [added, setAdded] = useState(null);
  const lists = useMusicHome(picking).data?.playlists || [];

  useEffect(() => { if (!open) { setPicking(false); setAdded(null); } }, [open]);

  const run = (fn) => () => { fn(); onClose(); };
  const goto = (to) => () => { player.collapse(); onClose(); navigate(to); };
  const add = async (p) => {
    setAdded(p.id);
    try { await addToPlaylist(p.id, track.id); } catch { setAdded(null); return; }
    setTimeout(onClose, 600);
  };

  return (
    <Sheet open={open} onClose={onClose} title={track ? track.title : ''}>
      {track && !picking && (
        <div className="ta-list">
          {!current && <ActionRow icon={Play} label="现在播放" onClick={run(() => player.play({ trackId: track.id }))} />}
          {!current && <ActionRow icon={ListStart} label="下一首播放" onClick={run(() => player.enqueue(track.id, 'next'))} />}
          {!current && <ActionRow icon={ListEnd} label="加到最后" onClick={run(() => player.enqueue(track.id, 'end'))} />}
          <ActionRow icon={ListPlus} label="加进歌单" onClick={() => setPicking(true)} chevron />
          <ActionRow icon={MessageCircle} label="在聊天里聊这首" onClick={goto('chat')} />
          {inPlayer && <ActionRow icon={Library} label="去音乐库" onClick={goto('music')} />}
        </div>
      )}
      {track && picking && (
        <div className="ta-list">
          <ActionRow icon={ChevronLeft} label="返回" onClick={() => setPicking(false)} muted />
          {lists.filter((p) => !p.auto).map((p) => (
            <button key={p.id} type="button" className="ta-row pressable" onClick={() => add(p)} disabled={!!added}>
              {p.cover ? <img className="ta-cover" src={p.cover} alt="" /> : <span className="ta-cover" />}
              <span className="ta-label">{p.name}</span>
              {added === p.id && <Check className="ta-done" aria-label="已加入" />}
            </button>
          ))}
          {!lists.length && <p className="ta-empty muted">还没有可以加的歌单</p>}
        </div>
      )}
    </Sheet>
  );
}

function ActionRow({ icon: Icon, label, onClick, chevron, muted }) {
  return (
    <button type="button" className={`ta-row pressable${muted ? ' muted' : ''}`} onClick={onClick}>
      <span className="ta-icon fill"><Icon aria-hidden="true" /></span>
      <span className="ta-label">{label}</span>
      {chevron && <span className="ta-chev muted" aria-hidden="true">›</span>}
    </button>
  );
}
