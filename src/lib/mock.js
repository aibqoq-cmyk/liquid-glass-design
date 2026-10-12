/**
 * 没有后端时的占位（VITE_MOCK=1）。示例数据已移除：接上你自己的后端再看效果。
 */
export async function mockFetch() {
  return { available: false };
}

export function mockStream() {
  return () => {};
}
