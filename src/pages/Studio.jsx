import { useEffect, useState } from 'react';
import {
  ArrowLeftRight, Laptop, ChevronRight, Palette, ScrollText, Gauge, HeartPulse, AlarmClock, Zap, Plug, MessageCircle, Loader,
} from 'lucide-react';
import { Glass, Button, Bar, Meter, Sheet, Toggle } from '../design/index.js';
import { useAppearance } from '../theme/AppearanceContext.jsx';
import { wallpaperById } from '../theme/presets.js';
import {
  useWindows, useQuota, useMachines, useChanges, useFiles, useSettings, useSetting,
  getChange, writeHandoff, swapWindow, saveSetting, toggleSettingItem,
} from '../lib/studio.js';
import { hhmm, fileSize, fileExt } from '../lib/format.js';
import './studio.css';

const STATUS = { online: '在线', busy: '忙', idle: '休息', offline: '离线' };
const k = (n) => `${Math.round(n / 1000)}k`;
const pctOf = (c) => (c?.limit ? Math.round((c.used / c.limit) * 100) : 0);
/** 距离某个时间点还有多久："2:14" / "3 天" */
const until = (iso) => {
  const min = Math.max(0, Math.round((new Date(iso) - Date.now()) / 60_000));
  if (min >= 48 * 60) return `${Math.round(min / 1440)} 天`;
  return `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}`;
};
const every = (m) => (m >= 60 ? `${m / 60} 小时` : `${m} 分钟`);
const dayLabel = (iso) => {
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return hhmm(iso);
  const y = new Date(today); y.setDate(today.getDate() - 1);
  return d.toDateString() === y.toDateString() ? '昨天' : `${d.getMonth() + 1}/${d.getDate()}`;
};

/** 设置列表。value(d) 用 /api/studio/settings 里对应那一项算右边显示的值 */
const SETTINGS = [
  { key: 'prompts', name: 'Prompts', desc: '他的人设和说话方式', icon: ScrollText, color: '#7d8cff', value: (d) => `${d.count} 份` },
  { key: 'context', name: 'Context', desc: '上下文多满时提醒换窗', icon: Gauge, color: '#5e9bf0', value: (d) => `${d.warnAt}%` },
  { key: 'heartbeat', name: 'Heartbeat', desc: '他隔多久自己醒一次', icon: HeartPulse, color: '#ff6f8f', value: (d) => (d.enabled ? every(d.everyMin) : '关') },
  { key: 'nudges', name: 'Nudges', desc: '到点轻轻提醒他做的事', icon: AlarmClock, color: '#f0a92c', value: (d) => `${d.count} 条` },
  { key: 'hooks', name: 'Hooks', desc: '某件事发生时自动做什么', icon: Zap, color: '#9a7cf0', value: (d) => `${d.count} 条` },
  { key: 'mcp', name: 'MCP', desc: '他能用的工具和连接', icon: Plug, color: '#34a77b', value: (d) => `${d.connected} 个已连` },
];

/**
 * 第 06 页 · 工作室
 * 窗口和换窗、额度、我的电脑、服务器、改动记录、文件、设置（外观入口在设置第一行）。
 */
export default function Studio({ navigate }) {
  const windows = useWindows();
  const quota = useQuota().data;
  const machines = useMachines().data;
  const changes = useChanges(3).data;
  const files = useFiles(3).data;
  const settings = useSettings();
  const { appearance } = useAppearance();
  // null | { type: 'swap' } | { type: 'change', id } | { type: 'changes' } | { type: 'files' } | { type: 'setting', key }
  const [sheet, setSheet] = useState(null);
  const close = () => setSheet(null);

  const w = windows.data;
  const cur = w?.items?.find((x) => x.id === w.current);
  const others = (w?.items || []).filter((x) => x.id !== w?.current);
  const wp = appearance.wallpaper.type === 'preset' ? wallpaperById(appearance.wallpaper.preset)?.name : '自定义';

  return (
    <main className="page st-page">
      <h1 className="cb-title">工作室</h1>
      <p className="st-sub muted">他在哪干活、用了多少、改了什么</p>

      {/* 窗口 */}
      <Glass as="section" className="st-card st-win" aria-label="窗口">
        {!w && <p className="st-none muted">正在加载…</p>}
        {w?.available === false && <p className="st-none muted">窗口状态暂时连不上</p>}
        {cur && (
          <>
            <div className="st-win__who muted">
              <i className="st-dot" data-status={cur.status} />
              当前窗口 · {cur.title}
              <span>{cur.agent} · {STATUS[cur.status]}</span>
            </div>
            <div className="st-win__main">
              <span>
                <span className="st-label muted">上下文用了</span>
                <b className="st-big">{pctOf(cur.context)}<small>%</small></b>
                <span className="st-label muted">
                  {k(cur.context.used)} / {k(cur.context.limit)}
                  {cur.etaMinutes != null && ` · 约 ${cur.etaMinutes >= 60 ? `${Math.round(cur.etaMinutes / 60)} 小时` : `${cur.etaMinutes} 分钟`}后该换`}
                </span>
              </span>
              <Button icon={ArrowLeftRight} className="st-swap" onClick={() => setSheet({ type: 'swap' })}>换窗</Button>
            </div>
            <Bar value={pctOf(cur.context)} warnAt={settings.data?.context?.warnAt ?? 80} dangerAt={95} />
          </>
        )}
        {others.length > 0 && (
          <div className="st-win__others">
            <div className="st-label muted">其他窗口</div>
            {others.map((o) => (
              <div key={o.id} className="st-win__row">
                <i className="st-dot" data-status={o.status} />
                <span className="st-win__name">{o.title}</span>
                <Bar value={pctOf(o.context)} warnAt={settings.data?.context?.warnAt ?? 80} dangerAt={95} thin />
                <span className="st-win__note muted">{STATUS[o.status]} · {pctOf(o.context)}%</span>
              </div>
            ))}
          </div>
        )}
      </Glass>

      <div className="st-pair">
        {/* 额度 */}
        <Glass as="section" className="st-card st-small" aria-label="Claude 额度">
          <div className="st-label muted">Claude 额度</div>
          {quota?.available === false && <p className="st-none muted">暂时连不上</p>}
          {quota?.session && (
            <>
              <b className="st-mid">{quota.session.pct}<small>%</small></b>
              <Bar value={quota.session.pct} thin />
              <div className="st-tiny muted">5 小时额度<br />{until(quota.session.resetAt)} 后重置</div>
              {quota.week && (
                <div className="st-week muted">本周<Bar value={quota.week.pct} thin />{quota.week.pct}%</div>
              )}
            </>
          )}
        </Glass>

        {/* 我的电脑 */}
        <Glass as="section" className="st-card st-small st-pc" aria-label="我的电脑">
          <div className="st-label muted">我的电脑</div>
          <Laptop className="st-pc__icon" aria-hidden="true" />
          {machines?.available === false && <p className="st-none muted">暂时连不上</p>}
          <div className="st-pc__chips">
            {(machines?.pc || []).map((p) => (
              <span key={p.key} className="st-pill fill">
                <i className="st-dot" data-status={p.status} />{p.name}<span className="muted">{p.label}</span>
              </span>
            ))}
          </div>
        </Glass>
      </div>

      {/* 服务器 */}
      {machines?.server && (
        <Glass as="section" className="st-card" aria-label="服务器状态">
          <div className="st-server__head">
            <b>{machines.server.name}</b>
            <span className="st-pill st-pill--sm fill"><i className="st-dot" data-status={machines.server.status} />{{ ok: '正常', warn: '有点忙', down: '连不上' }[machines.server.status]}</span>
            <span className="st-label muted">已运行 {Math.floor(machines.server.uptimeS / 86400)} 天</span>
          </div>
          <div className="st-meters">
            <Meter label="CPU" value={machines.server.cpu} />
            <Meter label="内存" value={machines.server.mem} />
            <Meter label="磁盘" value={machines.server.disk} />
          </div>
          <p className="st-tiny muted">超过 70% 变橙，超过 90% 变红</p>
        </Glass>
      )}

      {/* 改动记录 */}
      <section aria-label="改动记录">
        <h2 className="st-h2">
          改动记录
          {changes?.todayCount != null && <span className="muted">今天改了 {changes.todayCount} 次</span>}
          <button type="button" className="st-all muted" onClick={() => setSheet({ type: 'changes' })}>全部</button>
        </h2>
        <Glass className="st-list">
          {changes?.available === false && <p className="st-none muted">暂时连不上</p>}
          {changes?.items?.length === 0 && <p className="st-none muted">还没有改动</p>}
          {(changes?.items || []).map((c) => <ChangeRow key={c.id} c={c} onOpen={() => setSheet({ type: 'change', id: c.id })} />)}
        </Glass>
      </section>

      {/* 文件 */}
      <section aria-label="文件">
        <h2 className="st-h2">
          文件<span className="muted">他做出来、发给你的</span>
          {files?.total != null && <button type="button" className="st-all muted" onClick={() => setSheet({ type: 'files' })}>全部 {files.total} 个</button>}
        </h2>
        {files?.available === false && <p className="st-none muted">暂时连不上</p>}
        <div className="st-files">
          {(files?.items || []).map((f) => (
            <Glass key={f.id} as="a" pressable className="st-file" href={f.url} download={f.name} target="_blank" rel="noopener">
              <FileBadge name={f.name} />
              <span className="st-file__name">{f.name}</span>
              <span className="st-file__meta muted">{fileSize(f.size)} · {dayLabel(f.at)}</span>
            </Glass>
          ))}
        </div>
      </section>

      {/* 设置 */}
      <section aria-label="设置">
        <h2 className="st-h2">设置</h2>
        <Glass className="st-list">
          {SETTINGS.map((s) => (
            <SettingRow
              key={s.key}
              icon={s.icon}
              color={s.color}
              name={s.name}
              desc={s.desc}
              value={settings.data?.[s.key] ? s.value(settings.data[s.key]) : ''}
              onClick={() => setSheet({ type: 'setting', key: s.key })}
            />
          ))}
        </Glass>
      </section>

      <SwapSheet open={sheet?.type === 'swap'} win={cur} onClose={close} onDone={windows.reload} />
      <ChangeSheet id={sheet?.type === 'change' ? sheet.id : null} onClose={close} onAsk={() => { close(); navigate('chat'); }} />
      <AllChangesSheet open={sheet?.type === 'changes'} onClose={close} onOpen={(id) => setSheet({ type: 'change', id })} />
      <AllFilesSheet open={sheet?.type === 'files'} onClose={close} />
      <SettingSheet settingKey={sheet?.type === 'setting' ? sheet.key : null} onClose={close} onSaved={settings.reload} />
    </main>
  );
}

function ChangeRow({ c, onOpen }) {
  return (
    <button type="button" className="st-change pressable" onClick={onOpen}>
      <span className="st-change__time muted">{dayLabel(c.at)}</span>
      <span className="st-change__text">
        <b>{c.title}</b>
        <span className="st-mono muted">{c.files} 个文件 · <ins>+{c.add}</ins> <del>−{c.del}</del></span>
      </span>
      <ChevronRight className="st-chev" aria-hidden="true" />
    </button>
  );
}

const EXT_COLOR = { TXT: '#8f9bb3', MD: '#5e9bf0', M3U: '#f58fab', CSV: '#34a77b', PDF: '#e5534b', PNG: '#9a7cf0', JPG: '#9a7cf0' };
function FileBadge({ name }) {
  const ext = fileExt(name).toUpperCase().slice(0, 4) || 'FILE';
  return <span className="st-file__badge" style={{ background: EXT_COLOR[ext] || '#b49a8f' }}>{ext}</span>;
}

function SettingRow({ icon: Icon, color, name, desc, value, onClick }) {
  return (
    <button type="button" className="st-set pressable" onClick={onClick}>
      <span className="st-set__icon" style={{ background: color }}><Icon aria-hidden="true" /></span>
      <span className="st-set__text"><b>{name}</b><span className="muted">{desc}</span></span>
      <span className="st-set__value muted">{value}</span>
      <ChevronRight className="st-chev" aria-hidden="true" />
    </button>
  );
}

/* ───────── 弹层 ───────── */

/** 换窗：先让他写交接便签，看过再换 */
function SwapSheet({ open, win, onClose, onDone }) {
  const [state, setState] = useState('idle'); // idle | writing | ready | swapping | done | error
  const [note, setNote] = useState(null);

  const write = async () => {
    setState('writing');
    try { setNote(await writeHandoff(win.id)); setState('ready'); } catch { setState('error'); }
  };
  useEffect(() => {
    if (open && win) write();
    if (!open) { setState('idle'); setNote(null); }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const swap = async () => {
    setState('swapping');
    try {
      await swapWindow(win.id, note.id);
      setState('done');
      onDone();
      setTimeout(onClose, 900);
    } catch { setState('error'); }
  };

  return (
    <Sheet open={open} onClose={onClose} title={win ? `给「${win.title}」换个新窗口` : '换窗'}>
      <p className="st-sheet-p muted">他会先写一张交接便签：进行到哪、下一步、还欠什么。新窗口读完便签接着聊，旧窗口的聊天记录都还在。</p>
      {state === 'writing' && <p className="st-wait muted"><Loader className="st-spin" aria-hidden="true" />他在写交接便签…</p>}
      {state === 'error' && <p className="st-wait muted">没写成，再试一次？</p>}
      {note && state !== 'writing' && (
        <div className="st-note">
          <p><b>进行到哪</b>{note.progress}</p>
          <p><b>下一步</b>{note.next}</p>
          <p><b>还欠</b>{note.owe}</p>
          <span>他 {hhmm(note.at)} 写的 · 便签 {until(note.expiresAt)} 后自动过期</span>
        </div>
      )}
      <div className="st-actions">
        <button type="button" className="st-btn fill pressable" onClick={write} disabled={state === 'writing' || state === 'swapping' || state === 'done'}>让他重写</button>
        <button type="button" className="st-btn st-btn--accent pressable" onClick={swap} disabled={state !== 'ready'}>
          {state === 'swapping' ? '正在换…' : state === 'done' ? '换好了' : '换到新窗口'}
        </button>
      </div>
    </Sheet>
  );
}

/** 一次改动：他的说明 + 每个文件改了哪几行 */
function ChangeSheet({ id, onClose, onAsk }) {
  const [c, setC] = useState(null);
  useEffect(() => {
    if (!id) return undefined;
    let alive = true;
    setC(null);
    getChange(id).then((d) => alive && setC(d)).catch(() => alive && setC({ available: false }));
    return () => { alive = false; };
  }, [id]);
  return (
    <Sheet open={!!id} onClose={onClose} title={c?.title || '改动'}>
      {!c && <p className="st-wait muted"><Loader className="st-spin" aria-hidden="true" />正在加载…</p>}
      {c?.available === false && <p className="st-wait muted">暂时连不上</p>}
      {c?.files && (
        <>
          <div className="st-label muted">{dayLabel(c.at)} · {c.files.length} 个文件{c.note ? ' · 他的说明：' : ''}</div>
          {c.note && <p className="st-change-note">{c.note}</p>}
          <div className="st-diff st-mono">
            {c.files.map((f) => (
              <div key={f.path} className="st-diff__file">
                <div className="st-diff__path">{f.path} <ins>+{f.add}</ins> <del>−{f.del}</del></div>
                {f.lines.map((l, i) => (
                  <div key={i} className="st-diff__line" data-t={l.t === '+' ? 'add' : l.t === '-' ? 'del' : 'ctx'}>
                    {l.t === ' ' ? ' ' : l.t}{l.text}
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div className="st-actions">
            <button type="button" className="st-btn fill pressable" onClick={onAsk}><MessageCircle aria-hidden="true" />问问他为什么这么改</button>
          </div>
        </>
      )}
    </Sheet>
  );
}

function AllChangesSheet({ open, onClose, onOpen }) {
  const { data } = useChanges(open ? 50 : 0);
  return (
    <Sheet open={open} onClose={onClose} title="改动记录">
      {(data?.items || []).map((c) => <ChangeRow key={c.id} c={c} onOpen={() => onOpen(c.id)} />)}
    </Sheet>
  );
}
function AllFilesSheet({ open, onClose }) {
  const items = useFiles(open ? 50 : 0).data?.items || [];
  return (
    <Sheet open={open} onClose={onClose} title="文件">
      {items.map((f) => (
        <a key={f.id} className="st-file-row pressable" href={f.url} download={f.name} target="_blank" rel="noopener">
          <FileBadge name={f.name} />
          <span className="st-change__text"><b>{f.name}</b><span className="muted">{fileSize(f.size)} · {dayLabel(f.at)}</span></span>
        </a>
      ))}
    </Sheet>
  );
}

const TITLES = { prompts: 'Prompts', context: 'Context', heartbeat: 'Heartbeat 心跳', nudges: 'Nudges', hooks: 'Hooks', mcp: 'MCP' };
const INTRO = {
  prompts: '他是谁、怎么说话。这里只看不改，要改请在他那边改。',
  context: '上下文快满的时候，他会变得健忘。到这条线就提醒你换窗。',
  heartbeat: '心跳 = 他隔一会儿自己醒一次：看看你有没有来过、心潮有没有变化，想说话就说。',
  nudges: '到点轻轻提醒他做的事。关掉的不会删，随时能再打开。',
  hooks: '某件事发生的时候，自动替他做一件事。',
  mcp: '他能用的工具和连接。关掉后他暂时用不了这一项。',
};

/** 设置详情：Heartbeat / Context 是表单，其余是带开关的列表 */
function SettingSheet({ settingKey, onClose, onSaved }) {
  const { data, reload } = useSetting(settingKey);
  const [local, setLocal] = useState(null);
  useEffect(() => { setLocal(data && data.available !== false ? data : null); }, [data]);

  const save = async (patch) => {
    setLocal((v) => ({ ...v, ...patch }));
    try { await saveSetting(settingKey, patch); onSaved(); } catch { reload(); }
  };
  const flip = async (it) => {
    setLocal((v) => ({ ...v, items: v.items.map((x) => (x.id === it.id ? { ...x, enabled: !x.enabled } : x)) }));
    try { await toggleSettingItem(settingKey, it.id, !it.enabled); onSaved(); } catch { reload(); }
  };

  return (
    <Sheet open={!!settingKey} onClose={onClose} title={TITLES[settingKey] || ''}>
      {settingKey && <p className="st-sheet-p muted">{INTRO[settingKey]}</p>}
      {data?.available === false && <p className="st-wait muted">暂时连不上</p>}
      {local && settingKey === 'heartbeat' && (
        <>
          <div className="st-field fill"><b>开启心跳</b><Toggle checked={!!local.enabled} onChange={(v) => save({ enabled: v })} label="开启心跳" /></div>
          <div className="st-label muted st-gap">多久醒一次</div>
          <Choices options={[15, 30, 60, 120]} value={local.everyMin} format={every} onPick={(v) => save({ everyMin: v })} />
          <div className="st-label muted st-gap">安静时段（不醒）</div>
          <div className="st-field fill">
            <input type="time" aria-label="安静开始" value={local.quiet.from} onChange={(e) => save({ quiet: { ...local.quiet, from: e.target.value } })} />
            <span className="muted">到</span>
            <input type="time" aria-label="安静结束" value={local.quiet.to} onChange={(e) => save({ quiet: { ...local.quiet, to: e.target.value } })} />
          </div>
          {local.lastAt && <p className="st-label muted st-gap">上次心跳 {hhmm(local.lastAt)}{local.nextAt && local.enabled ? ` · 下次 ${hhmm(local.nextAt)}` : ''}</p>}
        </>
      )}
      {local && settingKey === 'context' && (
        <>
          <div className="st-label muted">用到多少提醒换窗</div>
          <Choices options={[70, 80, 90]} value={local.warnAt} format={(v) => `${v}%`} onPick={(v) => save({ warnAt: v })} />
          <div className="st-field fill st-gap"><b>到了自动写交接便签</b><Toggle checked={!!local.autoHandoff} onChange={(v) => save({ autoHandoff: v })} label="到了自动写交接便签" /></div>
        </>
      )}
      {local?.items && (
        <div className="st-items">
          {local.items.map((it) => (
            <div key={it.id} className="st-item fill">
              <span className="st-item__text"><b>{it.title}</b><span className="muted">{it.desc}</span></span>
              {it.toggle && <Toggle checked={!!it.enabled} onChange={() => flip(it)} label={`${it.title}：${it.enabled ? '开' : '关'}`} />}
            </div>
          ))}
        </div>
      )}
    </Sheet>
  );
}

function Choices({ options, value, format, onPick }) {
  return (
    <div className="st-choices" role="group">
      {options.map((o) => (
        <button key={o} type="button" className="pressable" aria-pressed={o === value} onClick={() => onPick(o)}>{format(o)}</button>
      ))}
    </div>
  );
}
