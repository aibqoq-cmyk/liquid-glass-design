import { ChevronRight, Search } from 'lucide-react';

const cx = (...a) => a.filter(Boolean).join(' ');

/**
 * 玻璃面。所有卡片、按钮、浮层的底材。
 * @param {'thin'|'regular'|'thick'|'dark'} variant 玻璃层级
 * @param {'card'|'pill'|'circle'} shape 形状
 * @param {boolean} pressable 是否带按压回弹（可点击的玻璃都应该开）
 * @param {string} as 渲染成什么标签，默认 div；可点击时传 'button'
 */
export function Glass({ variant = 'regular', shape = 'card', pressable = false, as: Tag = 'div', className, children, ...rest }) {
  return (
    <Tag
      className={cx(
        'glass',
        variant !== 'regular' && `glass--${variant}`,
        shape === 'pill' && 'glass--pill',
        shape === 'circle' && 'glass--circle',
        pressable && 'pressable',
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/** 带内边距的标准卡片 */
export function Card({ className, children, ...rest }) {
  return <Glass className={cx('card', className)} {...rest}>{children}</Glass>;
}

/**
 * 胶囊按钮。
 * @param {'glass'|'primary'} tone glass=玻璃按钮（换窗那种），primary=iOS 蓝
 */
export function Button({ tone = 'glass', block = false, icon: Icon, className, children, ...rest }) {
  const cls = cx('btn', block && 'btn--block', className);
  const body = <>{Icon && <Icon aria-hidden="true" />}{children}</>;
  if (tone === 'primary') {
    return <button type="button" className={cx(cls, 'btn--primary', 'pressable')} {...rest}>{body}</button>;
  }
  return (
    <Glass as="button" type="button" shape="pill" variant="thin" pressable className={cls} {...rest}>
      {body}
    </Glass>
  );
}

/** 圆形图标按钮（返回、搜索、+、✦ 那种） */
export function IconButton({ icon: Icon, label, size = 'md', variant = 'regular', className, ...rest }) {
  return (
    <Glass
      as="button"
      type="button"
      shape="circle"
      variant={variant}
      pressable
      aria-label={label}
      className={cx('icon-btn', size === 'sm' && 'icon-btn--sm', className)}
      {...rest}
    >
      <Icon aria-hidden="true" />
    </Glass>
  );
}

/** 分区标题：图标 + 文字 + 右侧可选附注 */
export function SectionTitle({ icon: Icon, children, trailing }) {
  return (
    <h2 className="section-title">
      {Icon && <Icon aria-hidden="true" />}
      <span>{children}</span>
      {trailing && <span className="trailing">{trailing}</span>}
    </h2>
  );
}

/** 分组列表容器 */
export function List({ children, className }) {
  return <Glass className={cx('list', className)}>{children}</Glass>;
}

/**
 * 列表行（设置页 Prompts / Context 那种）。
 * 有 onClick 或 href 就是可点击的，自动带右箭头。
 */
export function ListRow({ icon: Icon, title, subtitle, trailing, onClick, href, chevron }) {
  const showChev = chevron ?? Boolean(onClick || href);
  const inner = (
    <>
      {Icon && <Icon className="list-row__icon" aria-hidden="true" />}
      <span className="list-row__text">
        <span className="list-row__title">{title}</span>
        {subtitle && <div className="list-row__sub">{subtitle}</div>}
      </span>
      {trailing}
      {showChev && <ChevronRight className="list-row__chev" aria-hidden="true" />}
    </>
  );
  if (href) return <a className="list-row" href={href} style={{ textDecoration: 'none', color: 'inherit' }}>{inner}</a>;
  if (onClick) return <button type="button" className="list-row" onClick={onClick}>{inner}</button>;
  return <div className="list-row">{inner}</div>;
}

/**
 * 进度条。value 0–100。
 * 超过 warnAt 变橙，超过 dangerAt 变红（磁盘 75% 那种）。
 */
export function Bar({ value, warnAt = 70, dangerAt = 90, thin = false }) {
  const v = Math.max(0, Math.min(100, Number(value) || 0));
  const tone = v >= dangerAt ? 'bar--danger' : v >= warnAt ? 'bar--warn' : '';
  return (
    <div className={cx('bar', tone, thin && 'bar--thin')} role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100}>
      <div className="bar__fill" style={{ width: `${v}%` }} />
    </div>
  );
}

/** 带标签和数值的进度条行（CPU / 内存 / 磁盘） */
export function Meter({ label, value, ...barProps }) {
  return (
    <div className="meter">
      <span className="meter__label">{label}</span>
      <Bar value={value} {...barProps} />
      <span className="meter__value">{Math.round(value)}%</span>
    </div>
  );
}

/**
 * 状态胶囊（SSH ● / Edge ●）。
 * @param {'ok'|'off'|'busy'|'idle'} status
 */
export function Chip({ status = 'idle', children }) {
  return (
    <Glass shape="pill" variant="thin" className="chip">
      <i className={cx('chip__dot', status !== 'idle' && `chip__dot--${status}`)} aria-hidden="true" />
      {children}
    </Glass>
  );
}

/** 未读数小圆点 */
export function Badge({ count }) {
  if (!count) return null;
  return <span className="badge">{count > 99 ? '99+' : count}</span>;
}

/** 玻璃搜索框 */
export function SearchField({ placeholder = '搜索', value, onChange, ...rest }) {
  return (
    <Glass shape="pill" variant="thin" className="search">
      <Search aria-hidden="true" />
      <input
        type="search"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        {...rest}
      />
    </Glass>
  );
}

/** iOS 开关 */
export function Toggle({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className="toggle"
      onClick={() => onChange?.(!checked)}
    />
  );
}

/** 圆形头像 */
export function Avatar({ src, alt = '', size = 72 }) {
  return <img className="avatar" src={src} alt={alt} width={size} height={size} style={{ width: size, height: size }} />;
}
