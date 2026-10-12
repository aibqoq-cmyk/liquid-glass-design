import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft, ChevronRight, Search, Plus, Sparkles, ArrowUp, Smile, PawPrint, Heart, ThumbsUp, Laugh,
  ImagePlus, Paperclip, X, FileText, FileImage, File as FileIcon, Phone, Video,
} from 'lucide-react';
import { Glass, Sheet } from '../design/index.js';
import { FaceAvatar } from '../components/Faces.jsx';
import { useConversation, useSessions, useStickers } from '../lib/chat.js';
const fmtDur = (sec) => {
  const s = Math.max(0, Math.round(sec || 0));
  const m = Math.floor(s / 60);
  return m ? `${m} 分 ${String(s % 60).padStart(2, '0')} 秒` : `${s} 秒`;
};
import { hhmm, dividerTime, fileSize, fileExt } from '../lib/format.js';
import './chat-room.css';

const GAP_DIVIDER = 10 * 60e3; // 隔 10 分钟以上插一条时间分隔
const GAP_GROUP = 2 * 60e3; // 同一个人 2 分钟内连发算一组，只有最后一条带尾巴
const STATUS = { online: '在线', busy: '在忙', offline: '离线' };

/** 表态（iMessage 的 Tapback） */
const REACTIONS = [
  { id: 'heart', label: '喜欢', Icon: Heart },
  { id: 'like', label: '赞', Icon: ThumbsUp },
  { id: 'haha', label: '哈哈', Icon: Laugh },
  { id: 'wow', label: '惊', text: '!!' },
  { id: 'ask', label: '疑问', text: '?' },
];
const ReactionGlyph = ({ id }) => {
  const r = REACTIONS.find((x) => x.id === id);
  if (!r) return null;
  return r.Icon ? <r.Icon aria-hidden="true" /> : <b aria-hidden="true">{r.text}</b>;
};

/**
 * 第 04 页 · 聊天（一个聊天框里的对话）
 * 路由 #/chat/<sessionId>。全屏，不显示底部导航和播放条。
 */
export default function ChatRoom({ navigate, params }) {
  const id = params?.id;
  const { data: sessionsData } = useSessions();
  const session = sessionsData?.items?.find((s) => s.id === id);
  const c = useConversation(id);
  const stickers = useStickers();

  const [draft, setDraft] = useState('');
  const [panel, setPanel] = useState(null); // null | 'stickers' | 'image' | 'file'
  const [thinking, setThinking] = useState(null);
  const [openTools, setOpenTools] = useState(() => new Set());
  const [picker, setPicker] = useState(null); // { id, top, side }
  const [searching, setSearching] = useState(false);
  const [q, setQ] = useState('');

  const listRef = useRef(null);
  const inputRef = useRef(null);
  const stickToBottom = useRef(true);
  const olderAnchor = useRef(null);
  const lastMarked = useRef(null);
  const autoScrolling = useRef(false);

  /* —— 消息 → 行（分隔条、尾巴、工具调用合并、已读回执） —— */
  const rows = useMemo(() => {
    const list = q
      ? c.messages.filter((m) => m.type === 'text' && m.text?.toLowerCase().includes(q.toLowerCase()))
      : c.messages;
    const out = [];
    const lastMine = [...list].reverse().find((m) => m.from === 'me');
    list.forEach((m, i) => {
      const prev = list[i - 1];
      const next = list[i + 1];
      if (!prev || new Date(m.at) - new Date(prev.at) > GAP_DIVIDER) out.push({ kind: 'divider', key: `d-${m.id}`, at: m.at });
      if (m.type === 'tool') {
        const last = out[out.length - 1];
        if (last?.kind === 'tools') last.items.push(m);
        else out.push({ kind: 'tools', key: `t-${m.id}`, items: [m] });
        return;
      }
      if (m.type === 'thinking') {
        if (m.text) out.push({ kind: 'thinking', key: m.id, m });
        return;
      }
      const tail = !next || next.from !== m.from || next.type === 'tool' || next.type === 'thinking'
        || new Date(next.at) - new Date(m.at) > GAP_GROUP;
      out.push({ kind: 'msg', key: m.id, m, tail });
      if (m === lastMine) out.push({ kind: 'receipt', key: `r-${m.id}`, m });
    });
    return out;
  }, [c.messages, q]);

  /* —— 滚动：新消息时贴底；往上翻时加载更早的并保持位置 —— */
  const onScroll = async () => {
    const el = listRef.current;
    if (picker && !autoScrolling.current) setPicker(null); // 手动滚动时收起表态条（它是按消息位置定位的）
    autoScrolling.current = false;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (el.scrollTop < 80 && c.hasMore && !olderAnchor.current) {
      olderAnchor.current = el.scrollHeight;
      await c.loadOlder();
    }
  };
  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el) return;
    if (olderAnchor.current) {
      el.scrollTop += el.scrollHeight - olderAnchor.current;
      olderAnchor.current = null;
      return;
    }
    if (picker) return; // 表态条开着时不自动滚，免得条和消息错位
    const lastIsMine = c.messages.at(-1)?.from === 'me';
    if ((stickToBottom.current || lastIsMine) && el.scrollTop !== el.scrollHeight - el.clientHeight) {
      autoScrolling.current = true;
      el.scrollTop = el.scrollHeight;
    }
  }, [rows, c.typing, panel, picker]);

  /* —— 已读：看到他的最新一条就告诉后端 —— */
  useEffect(() => {
    const lastAi = [...c.messages].reverse().find((m) => m.from === 'ai');
    if (lastAi && lastAi.id !== lastMarked.current && document.visibilityState === 'visible') {
      lastMarked.current = lastAi.id;
      c.markRead(lastAi.id);
    }
  }, [c.messages]); // eslint-disable-line react-hooks/exhaustive-deps

  /* —— 输入 —— */
  const autosize = () => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };
  const submit = () => {
    const text = draft.trim();
    if (!text) return;
    c.send({ type: 'text', text });
    setDraft('');
    stickToBottom.current = true;
    requestAnimationFrame(autosize);
  };
  const onKeyDown = (e) => {
    // 电脑上回车发送、Shift+回车换行；手机键盘的回车就是换行
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    if (e.key === 'Enter' && !e.shiftKey && !coarse && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };
  const pickFile = (kind) => (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (f) { c.sendFile(f, kind); setPanel(null); }
  };

  /* —— 长按表态 —— */
  const openPicker = (m, el) => {
    const r = el.getBoundingClientRect();
    setPicker({ id: m.id, top: Math.max(r.top - 62, 110), side: m.from === 'me' ? 'right' : 'left' });
  };
  const choose = (m, rid) => {
    const mine = (m.reactions || []).find((x) => x.from === 'me');
    c.react(m.id, mine?.emoji === rid ? null : rid);
    setPicker(null);
  };

  const toggleTool = (tid) => setOpenTools((s) => {
    const n = new Set(s);
    if (n.has(tid)) n.delete(tid); else n.add(tid);
    return n;
  });

  const back = () => (window.history.length > 1 ? window.history.back() : navigate('chat'));
  const statusLine = c.typing ? '正在输入…' : session ? `${session.title} · ${STATUS[session.status] || ''}` : '';
  const pickerMsg = picker && c.messages.find((m) => m.id === picker.id);

  return (
    <main className="cr" data-panel={!!panel}>
      <div className="cr-list" ref={listRef} onScroll={onScroll}>
        {!c.available && <p className="cr-empty muted">这个聊天框暂时连不上</p>}
        {c.available && !c.loading && rows.length === 0 && <p className="cr-empty muted">{q ? '没有找到' : '还没有聊过，说点什么吧'}</p>}

        {rows.map((row) => {
          if (row.kind === 'divider') return <div key={row.key} className="cr-divider muted">{dividerTime(row.at)}</div>;
          if (row.kind === 'thinking') {
            return (
              <button key={row.key} type="button" className="cr-thinking muted" onClick={() => setThinking(row.m.text)}>
                <PawPrint aria-hidden="true" />思考过程<ChevronRight aria-hidden="true" />
              </button>
            );
          }
          if (row.kind === 'tools') {
            return (
              <div key={row.key} className="cr-tools">
                {row.items.map((t) => <ToolLine key={t.id} t={t} open={openTools.has(t.id)} onToggle={() => toggleTool(t.id)} />)}
              </div>
            );
          }
          if (row.kind === 'receipt') return <Receipt key={row.key} m={row.m} onRetry={() => c.retry(row.m)} />;
          return <Message key={row.key} m={row.m} tail={row.tail} onLongPress={openPicker} />;
        })}

        {c.typing && !q && (
          <Glass variant="thick" className="cr-typing" aria-label="对方正在输入"><i /><i /><i /></Glass>
        )}
      </div>

      {/* 顶部：返回 / 头像名字 / 打电话 + 搜索 */}
      <div className="cr-top-fade" aria-hidden="true" />
      <header className="cr-head">
        <Glass as="button" type="button" shape="pill" pressable className="cr-back" onClick={back} aria-label="返回聊天框">
          <ChevronLeft aria-hidden="true" />
          {session?.unread > 0 && <span className="cr-back__n">{session.unread}</span>}
        </Glass>
        <div className="cr-who">
          <FaceAvatar src={session?.agent?.avatar} alt="" size={74} fallback={session?.title === '工作' ? 'dog-glasses' : 'dog'} bg={session?.title === '工作' ? '#eef4ff' : '#fff0f3'} />
          <Glass as="span" shape="pill" className="cr-who__name">{session?.agent?.name || '…'}<ChevronRight aria-hidden="true" /></Glass>
          <span className="cr-who__status muted">{statusLine}</span>
        </div>
        <Glass shape="pill" className="cr-actions">
          <button type="button" className="pressable" aria-label={searching ? '关闭搜索' : '搜索聊天记录'} onClick={() => { setSearching((v) => !v); setQ(''); }}>
            {searching ? <X aria-hidden="true" /> : <Search aria-hidden="true" />}
          </button>
        </Glass>
      </header>
      {searching && (
        <Glass shape="pill" variant="thick" className="cr-search">
          <Search aria-hidden="true" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索这个聊天框" aria-label="搜索这个聊天框" />
        </Glass>
      )}

      {/* 输入栏 */}
      <div className="cr-input">
        <Glass as="button" type="button" shape="circle" pressable className="cr-icon" aria-label={panel ? '收起' : '更多：表情、图片、文件'} aria-expanded={!!panel} onClick={() => setPanel((p) => (p ? null : 'stickers'))}>
          <Plus aria-hidden="true" className="cr-plus" data-open={!!panel} />
        </Glass>
        <Glass as="label" shape="pill" className="cr-field">
          <span className="visually-hidden">发消息</span>
          <textarea
            ref={inputRef}
            rows={1}
            value={draft}
            placeholder="发消息"
            onChange={(e) => { setDraft(e.target.value); autosize(); }}
            onKeyDown={onKeyDown}
            onFocus={() => setPanel(null)}
          />
          <button type="button" className="cr-field__emoji" aria-label="表情" onClick={() => setPanel((p) => (p === 'stickers' ? null : 'stickers'))}>
            <Smile aria-hidden="true" />
          </button>
        </Glass>
        {draft.trim() ? (
          <button type="button" className="cr-send pressable" aria-label="发送" onClick={submit}><ArrowUp aria-hidden="true" /></button>
        ) : (
          // ✦ 预留给语音（按住说话），接入方式见 docs/04-聊天.md
          <Glass as="button" type="button" shape="circle" pressable className="cr-icon" aria-label="按住说话（预留）"><Sparkles aria-hidden="true" /></Glass>
        )}
      </div>

      {/* 表情 / 图片 / 文件面板 */}
      {panel && (
        <Glass as="section" variant="thick" className="cr-panel" aria-label="更多">
          <div className="cr-panel__tabs" role="tablist">
            {[['stickers', '表情包'], ['image', '图片'], ['file', '文件']].map(([k, label]) => (
              <button key={k} type="button" role="tab" aria-selected={panel === k} onClick={() => setPanel(k)}>{label}</button>
            ))}
          </div>
          {panel === 'stickers' && (
            <div className="cr-stickers">
              <label className="cr-sticker cr-sticker--add" aria-label="添加表情包">
                <ImagePlus aria-hidden="true" />
                <input type="file" accept="image/*" className="visually-hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) stickers.add(f); }} />
              </label>
              {stickers.items.map((s) => (
                <button key={s.id} type="button" className="cr-sticker pressable" aria-label={`表情：${s.label || ''}`} onClick={() => { c.send({ type: 'sticker', stickerId: s.id, url: s.url, label: s.label }); setPanel(null); }}>
                  <img src={s.url} alt="" />
                </button>
              ))}
            </div>
          )}
          {panel === 'image' && (
            <label className="cr-pick pressable"><ImagePlus aria-hidden="true" />从相册选一张<input type="file" accept="image/*" className="visually-hidden" onChange={pickFile('image')} /></label>
          )}
          {panel === 'file' && (
            <label className="cr-pick pressable"><Paperclip aria-hidden="true" />选一个文件<input type="file" className="visually-hidden" onChange={pickFile('file')} /></label>
          )}
        </Glass>
      )}

      {/* 表态选择条 */}
      {pickerMsg && (
        <>
          <div className="cr-picker-scrim" onClick={() => setPicker(null)} aria-hidden="true" />
          <Glass shape="pill" variant="thick" className={`cr-picker cr-picker--${picker.side}`} style={{ top: picker.top }} role="menu" aria-label="表态">
            {REACTIONS.map((r) => {
              const on = (pickerMsg.reactions || []).some((x) => x.from === 'me' && x.emoji === r.id);
              return (
                <button key={r.id} type="button" role="menuitem" aria-label={r.label} aria-pressed={on} className="pressable" onClick={() => choose(pickerMsg, r.id)}>
                  <ReactionGlyph id={r.id} />
                </button>
              );
            })}
          </Glass>
        </>
      )}

      <Sheet open={!!thinking} onClose={() => setThinking(null)} title="思考过程">
        <p className="cr-thinking-body">{thinking}</p>
      </Sheet>
    </main>
  );
}

/* ───────── 单条消息 ───────── */

function useLongPress(onLong) {
  const t = useRef(0);
  const start = (e) => {
    const el = e.currentTarget;
    t.current = setTimeout(() => onLong(el), 450);
  };
  const cancel = () => clearTimeout(t.current);
  return {
    onPointerDown: start, onPointerUp: cancel, onPointerLeave: cancel, onPointerCancel: cancel,
    onContextMenu: (e) => { e.preventDefault(); cancel(); onLong(e.currentTarget); },
  };
}

function Message({ m, tail, onLongPress }) {
  const press = useLongPress((el) => onLongPress(m, el));
  const side = m.from === 'me' ? 'me' : 'ai';
  const pending = m.status === 'sending' ? ' cr-msg--sending' : '';
  return (
    <div className={`cr-msg cr-msg--${side}${tail ? ' cr-msg--tail' : ''}${pending}`}>
      <div className="cr-msg__body" {...press}>
        <Body m={m} side={side} />
        {m.reactions?.length > 0 && (
          <span className="cr-reactions" aria-label={`表态：${m.reactions.map((r) => REACTIONS.find((x) => x.id === r.emoji)?.label).join('、')}`}>
            {m.reactions.map((r, i) => (
              <span key={i} className={`cr-reaction cr-reaction--${r.from}`}><ReactionGlyph id={r.emoji} /></span>
            ))}
          </span>
        )}
      </div>
    </div>
  );
}

function Body({ m, side }) {
  switch (m.type) {
    case 'text':
      return side === 'me'
        ? <div className="cr-bubble cr-bubble--me">{m.text}</div>
        : <Glass variant="thick" className="cr-bubble cr-bubble--ai">{m.text}</Glass>;
    case 'sticker':
      return <img className="cr-sticker-msg" src={m.url} alt={m.label ? `表情：${m.label}` : '表情'} />;
    case 'image':
      return <a href={m.url} target="_blank" rel="noreferrer"><img className="cr-image" src={m.url} alt={m.name || '图片'} /></a>;
    case 'file': {
      const Icon = m.mime?.startsWith('image/') ? FileImage : m.mime?.startsWith('text/') ? FileText : FileIcon;
      return (
        <Glass as="a" variant="thick" className="cr-file" href={m.url} download={m.name} target="_blank" rel="noreferrer" aria-label={`${m.name}，${fileSize(m.size)}`}>
          <span className="cr-file__icon"><Icon aria-hidden="true" /></span>
          <span className="cr-file__text">
            <b>{m.name}</b>
            <span className="muted">{fileExt(m.name)} 文件 · {fileSize(m.size)}</span>
          </span>
        </Glass>
      );
    }
    case 'alarm':
      return <AlarmCard m={m} />;
    case 'call':
      return <CallCard m={m} />;
    default:
      return <Glass variant="thick" className="cr-bubble cr-bubble--ai muted">[暂时显示不了这种消息]</Glass>;
  }
}

/** 通话卡：一通电话结束后留在聊天里，点开看转写 */
function CallCard({ m }) {
  const missed = m.status === 'missed' || m.status === 'declined';
  const Icon = m.video ? Video : Phone;
  const title = missed ? '未接通话' : `${m.video ? '视频' : '语音'}通话 ${fmtDur(m.durationS)}`;
  const sub = `${m.direction === 'in' ? '他打来的' : '你打的'}${missed ? '' : ' · 看转写'}`;
  return (
    <Glass as="div" variant="thick" className="cr-call" data-missed={missed}>
      <span className="cr-call__icon"><Icon aria-hidden="true" /></span>
      <span className="cr-call__text"><b>{title}</b><span className="muted">{sub}</span></span>
    </Glass>
  );
}

/** 闹钟卡：表盘指针按时间画 */
function AlarmCard({ m }) {
  const [h, min] = String(m.time || '0:0').split(':').map(Number);
  const STATE = { pending: '等待中', rung: '已响过', cancelled: '已取消' };
  return (
    <Glass variant="thick" className="cr-alarm">
      <span className="cr-alarm__face" aria-hidden="true">
        <i className="cr-alarm__h" style={{ transform: `rotate(${((h % 12) + min / 60) * 30}deg)` }} />
        <i className="cr-alarm__m" style={{ transform: `rotate(${min * 6}deg)` }} />
        <i className="cr-alarm__dot" />
      </span>
      <span className="cr-alarm__text">
        <b>{m.time}</b>
        <span className="muted">{m.date ? m.date : '今天'} · {m.label}</span>
        <span className="cr-alarm__state">{STATE[m.state] || ''}</span>
      </span>
    </Glass>
  );
}

/** 命令行：模仿 Claude 客户端，一行工具名+参数，一行 ⎿ 摘要；点开看完整输出 */
function ToolLine({ t, open, onToggle }) {
  return (
    <>
      <button type="button" className="cr-tool" onClick={onToggle} aria-expanded={open} aria-label={`${t.name}：${t.arg}，${t.status === 'running' ? '正在运行' : '点开看完整输出'}`}>
        <span className="cr-tool__head mono">
          <i className={`cr-tool__dot cr-tool__dot--${t.status || 'done'}`} />
          <span className="cr-tool__call"><b>{t.name}</b><span className="muted">({t.arg})</span></span>
        </span>
        <span className="cr-tool__out mono">⎿ {t.status === 'running' ? '正在运行…' : t.summary}</span>
      </button>
      {open && t.status !== 'running' && <pre className="cr-tool__full mono">{t.output || t.summary}</pre>}
    </>
  );
}

/** 我最后一条消息下面的状态：发送中 / 发送失败（点了重发）/ 已送达 / 几点已读 */
function Receipt({ m, onRetry }) {
  if (m.status === 'failed') return <button type="button" className="cr-receipt cr-receipt--failed" onClick={onRetry}>发送失败 · 点一下重发</button>;
  const text = m.status === 'sending' ? '发送中…' : m.readAt ? `${hhmm(m.readAt)} 已读` : '已送达';
  return <div className="cr-receipt muted">{text}</div>;
}
