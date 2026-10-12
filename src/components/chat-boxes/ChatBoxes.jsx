import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Glass, IconButton, Sheet, Button } from '../../design/index.js';
import { FaceAvatar } from '../Faces.jsx';
import { shortTime } from '../../lib/format.js';
import { createSession } from '../../lib/chat.js';
import './chat-boxes.css';

/** 预留空位上的建议名字（点了就用这个名字开新窗口，也可以自己改） */
const SUGGESTIONS = ['睡前聊天', '陪我打游戏', '一起读书', '吐槽专用'];

const STATUS_TEXT = { online: '在线', busy: '在忙', offline: '离线' };

/**
 * 聊天框总览：最近在聊的一张宽卡 + 其余窗口的方卡 + 预留空位。
 * 首页第二屏和底部「聊天」标签都用它。
 *
 * @param {object} data      GET /api/chat/sessions 的返回
 * @param {(id) => void} onOpen  点开一个聊天框
 * @param {() => void} reload    新建后刷新列表
 */
export default function ChatBoxes({ data, onOpen, reload }) {
  const [creating, setCreating] = useState(null); // 正在新建时是输入框里的名字
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const sessions = [...(data?.items || [])].sort((a, b) => new Date(b.last?.at || 0) - new Date(a.last?.at || 0));
  const [first, ...rest] = sessions;
  // 网格凑满 4 格；窗口多了以后只补一个空位让格子成双
  const slotCount = rest.length < 4 ? 4 - rest.length : rest.length % 2;
  const slots = SUGGESTIONS.filter((n) => !sessions.some((s) => s.title === n)).slice(0, Math.max(0, slotCount));

  const submit = async () => {
    const title = (creating || '').trim();
    if (!title) return;
    setBusy(true);
    setErr('');
    try {
      const s = await createSession(title);
      setCreating(null);
      await reload?.();
      if (s?.id) onOpen(s.id);
    } catch (e) {
      setErr(e.message || '没开成，再试一次');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="cb" aria-label="聊天框">
      <div className="cb-head">
        <h2 className="cb-title">聊天框</h2>
        <IconButton icon={Plus} label="新建聊天框" onClick={() => setCreating('')} />
      </div>
      <p className="cb-sub muted">他的每个窗口都是一个聊天框，点进去就聊</p>

      {data?.available === false && <p className="cb-empty muted">暂时连不上，等一会儿再来</p>}

      {first && <WideCard s={first} onOpen={onOpen} />}

      <div className="cb-grid">
        {rest.map((s) => <SquareCard key={s.id} s={s} onOpen={onOpen} />)}
        {data?.available !== false && slots.map((name) => (
          <button key={name} type="button" className="cb-slot pressable" onClick={() => setCreating(name)} aria-label={`新建聊天框：${name}`}>
            <span className="cb-slot__plus"><Plus aria-hidden="true" /></span>
            <span className="cb-slot__name">{name}</span>
            <span className="cb-slot__hint">开一个新窗口</span>
          </button>
        ))}
      </div>

      <Sheet open={creating !== null} onClose={() => setCreating(null)} title="新的聊天框">
        <label className="cb-new">
          <span className="muted">给这个窗口起个名字</span>
          <input
            className="cb-new__input"
            value={creating || ''}
            onChange={(e) => setCreating(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="比如：睡前聊天"
            maxLength={20}
            autoFocus
          />
        </label>
        <div className="cb-new__chips">
          {SUGGESTIONS.map((n) => (
            <button key={n} type="button" className="cb-new__chip pressable" onClick={() => setCreating(n)}>{n}</button>
          ))}
        </div>
        {err && <p className="cb-new__err">{err}</p>}
        <Button tone="primary" block onClick={submit} disabled={busy || !(creating || '').trim()}>
          {busy ? '正在开…' : '开一个新窗口'}
        </Button>
      </Sheet>
    </section>
  );
}

function StatusDot({ status }) {
  return <span className={`cb-dot cb-dot--${status || 'offline'}`} aria-hidden="true" />;
}

function Avatar({ s, size }) {
  return (
    <span className="cb-avatar">
      <FaceAvatar src={s.agent?.avatar} size={size} ring={size > 44 ? 3 : 2.5} fallback={s.title === '工作' ? 'dog-glasses' : 'dog'} bg={s.title === '工作' ? '#eef4ff' : '#fff0f3'} />
      <StatusDot status={s.status} />
    </span>
  );
}

function ContextBar({ context }) {
  if (!context?.limit) return <span />;
  const pct = Math.round((context.used / context.limit) * 100);
  return (
    <span className="cb-ctx muted">
      <span className="cb-ctx__bar"><i style={{ width: `${pct}%` }} /></span>
      窗口 {pct}%
    </span>
  );
}

function WideCard({ s, onOpen }) {
  const statusLine = s.typing ? '正在写…' : `${STATUS_TEXT[s.status] || ''}${s.context?.limit ? ` · 窗口用了${s.context.used / s.context.limit > 0.5 ? '一大半' : s.context.used / s.context.limit > 0.3 ? '一半' : '一点'}` : ''}`;
  return (
    <Glass as="button" type="button" pressable className="cb-wide" onClick={() => onOpen(s.id)} aria-label={`打开聊天框：${s.title}`}>
      <div className="cb-wide__top">
        <Avatar s={s} size={52} />
        <div className="cb-wide__who">
          <div><b>{s.title}</b> <span className="muted">{s.agent?.name}</span></div>
          <div className="muted cb-small">{statusLine}</div>
        </div>
        <span className="muted cb-small">{shortTime(s.last?.at)}</span>
      </div>
      {s.preview?.length > 0 && (
        <div className="cb-wide__preview">
          {s.preview.map((p, i) => (
            <span key={i} className={`cb-mini cb-mini--${p.from}`}>{p.text}</span>
          ))}
        </div>
      )}
      <div className="cb-wide__foot">
        <ContextBar context={s.context} />
        {s.unread > 0 && <span className="cb-unread">{s.unread}</span>}
      </div>
    </Glass>
  );
}

function SquareCard({ s, onOpen }) {
  return (
    <Glass as="button" type="button" pressable className="cb-square" onClick={() => onOpen(s.id)} aria-label={`打开聊天框：${s.title}`}>
      <div className="cb-square__top">
        <Avatar s={s} size={38} />
        <b>{s.title}</b>
        {s.unread > 0 ? <span className="cb-unread">{s.unread}</span> : <span className="muted cb-small cb-square__time">{shortTime(s.last?.at)}</span>}
      </div>
      <p className="cb-square__last">{s.last?.text || '还没有聊过'}</p>
      {s.typing
        ? <span className="cb-typing muted cb-small"><span className="cb-typing__dots"><i /><i /><i /></span>正在写</span>
        : <ContextBar context={s.context} />}
    </Glass>
  );
}
