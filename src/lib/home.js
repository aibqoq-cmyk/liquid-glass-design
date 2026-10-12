/**
 * 首页数据。接口契约见 docs/03-首页.md。
 */
import { useEffect, useState } from 'react';
import { api } from './api.js';

function useOnce(path) {
  const [data, setData] = useState(null);
  useEffect(() => {
    let alive = true;
    api(path)
      .then((d) => alive && setData(d))
      .catch((e) => alive && setData({ available: false, reason: e.message }));
    return () => { alive = false; };
  }, [path]);
  return data;
}

/** 个人资料：头像、昵称、签名、统计、两张图卡 */
export const useProfile = () => useOnce('/api/profile');

/** 继续阅读 */
export const useReading = () => useOnce('/api/reading');
