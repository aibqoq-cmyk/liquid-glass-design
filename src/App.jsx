import { useEffect, useState } from 'react';
import { House, Sparkles, MessagesSquare, Library } from 'lucide-react';
import { Wallpaper, TabBar, MiniPlayer } from './design/index.js';
import { AppearanceProvider } from './theme/AppearanceContext.jsx';
import { usePlayer, player } from './lib/player.js';
import { useSessions } from './lib/chat.js';
import Home from './pages/Home.jsx';
import ChatList from './pages/ChatList.jsx';
import ChatRoom from './pages/ChatRoom.jsx';
import Music from './pages/Music.jsx';
import Studio from './pages/Studio.jsx';
import FullPlayer from './components/full-player/FullPlayer.jsx';

function Blank() {
  return <main className="page"><h1 className="cb-title">记忆</h1><p className="muted">这一页留给你自己做。</p></main>;
}

const ROUTES = {
  home: { tab: 'home', page: Home, player: false },
  memory: { tab: 'memory', page: Blank },
  music: { tab: 'home', page: Music },
  chat: { tab: 'chat', page: ChatList },
  'chat/:id': { tab: 'chat', page: ChatRoom, chrome: false },
  studio: { tab: 'studio', page: Studio },
};
const DEFAULT_ROUTE = 'home';

const TABS = [
  { key: 'home', label: '首页', icon: House },
  { key: 'memory', label: '记忆', icon: Sparkles },
  { key: 'chat', label: '聊天', icon: MessagesSquare },
  { key: 'studio', label: '工作室', icon: Library },
];

function readRoute() {
  const path = location.hash.replace(/^#\/?/, '').split('?')[0];
  const [first, second] = path.split('/');
  if (second && ROUTES[`${first}/:id`]) return { key: `${first}/:id`, params: { id: decodeURIComponent(second) } };
  return { key: ROUTES[first] ? first : DEFAULT_ROUTE, params: {} };
}

function RingWatcher() { return null; }

function Shell() {
  const [route, setRoute] = useState(readRoute);
  const playerState = usePlayer();
  const { data: sessions } = useSessions();
  useEffect(() => { const on = () => { setRoute(readRoute()); window.scrollTo(0, 0); }; window.addEventListener('hashchange', on); return () => window.removeEventListener('hashchange', on); }, []);
  const navigate = (to) => { location.hash = `#/${to}`; };
  const def = ROUTES[route.key];
  const { page: Page, tab } = def;
  const unread = (sessions?.items || []).reduce((n, s) => n + (s.unread || 0), 0);
  return (
    <>
      <Wallpaper />
      <Page key={route.key + (route.params.id || '')} navigate={navigate} params={route.params} />
      {def.chrome !== false && (
        <>
          {def.player !== false && <MiniPlayer track={playerState.track} playing={playerState.playing} onToggle={player.toggle} onNext={player.next} onOpen={() => player.expand('cover')} />}
          <TabBar tabs={TABS.map((t) => (t.key === 'chat' ? { ...t, badge: unread } : t))} active={tab} onChange={navigate} />
        </>
      )}
      <FullPlayer navigate={navigate} />
      <RingWatcher />
    </>
  );
}

export default function App() { return <AppearanceProvider><Shell /></AppearanceProvider>; }
