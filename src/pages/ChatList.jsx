import ChatBoxes from '../components/chat-boxes/ChatBoxes.jsx';
import { useSessions } from '../lib/chat.js';

/**
 * 底部「聊天」标签：聊天框总览（和首页第二屏是同一个组件）。
 */
export default function ChatList({ navigate }) {
  const { data, reload } = useSessions();
  return (
    <main className="page" style={{ paddingTop: 'calc(var(--safe-top) + 52px)' }}>
      <ChatBoxes data={data} onOpen={(id) => navigate(`chat/${id}`)} reload={reload} />
    </main>
  );
}
