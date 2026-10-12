/** 时间、文件大小等显示格式 */

export const hhmm = (iso) => new Date(iso).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });

const sameDay = (a, b) => a.toDateString() === b.toDateString();

/** 聊天列表里的时间：今天显示 22:20，昨天显示"昨天"，更早显示 10/3 */
export function shortTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  if (sameDay(d, now)) return hhmm(iso);
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (sameDay(d, y)) return '昨天';
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/** 聊天里的时间分隔条：今天 22:18 / 昨天 22:18 / 10月3日 22:18 */
export function dividerTime(iso) {
  const d = new Date(iso);
  const now = new Date();
  const y = new Date(now); y.setDate(now.getDate() - 1);
  const day = sameDay(d, now) ? '今天' : sameDay(d, y) ? '昨天' : `${d.getMonth() + 1}月${d.getDate()}日`;
  return `${day} ${hhmm(iso)}`;
}

export function fileSize(n) {
  if (n == null) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 ** 2).toFixed(1)} MB`;
}

export const fileExt = (name = '') => (name.includes('.') ? name.split('.').pop().toUpperCase() : '文件');
