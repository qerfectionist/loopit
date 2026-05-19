import { useLocation, useNavigate } from 'react-router-dom';
import { Heart, MessageCircle, Search, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { triggerSelection } from '@/lib/telegram';
import { useAppStore } from '@/stores/appStore';
import { useUnreadMatches } from '@/hooks/useMatches';
import { useUnreadMessages } from '@/hooks/useChat';

const tabs = [
  { id: 'explore' as const, label: 'Поиск', icon: Search, path: '/' },
  { id: 'matches' as const, label: 'Матчи', icon: Heart, path: '/matches' },
  { id: 'chat' as const, label: 'Чат', icon: MessageCircle, path: '/chat' },
  { id: 'profile' as const, label: 'Профиль', icon: User, path: '/profile' },
];

export const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const currentUser = useAppStore((s) => s.currentUser);
  
  const { data: unreadMatches = 0 } = useUnreadMatches(currentUser?.id);
  const { data: unreadMessages = 0 } = useUnreadMessages(currentUser?.id);

  const getUnread = (id: string) => {
    if (id === 'matches') return unreadMatches;
    if (id === 'chat') return unreadMessages;
    return 0;
  };

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-[#eaecf0] bg-white/95 shadow-[0_-10px_30px_rgba(15,23,42,0.04)] backdrop-blur-xl safe-area-bottom">
      <div className="mx-auto flex h-16 max-w-lg items-center justify-around">
        {tabs.map((tab) => {
          const active = isActive(tab.path);
          const unread = getUnread(tab.id);
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              id={`nav-${tab.id}`}
              onClick={() => {
                triggerSelection();
                navigate(tab.path);
              }}
              className={cn(
                'flex h-full flex-1 flex-col items-center justify-center gap-1',
                'transition-colors duration-[var(--duration-fast)]',
                'relative',
                active ? 'text-[#08642f]' : 'text-[#667085]',
              )}
            >
              <div className="relative">
                <Icon size={active ? 31 : 27} strokeWidth={active ? 2.2 : 1.8} />
                {unread > 0 && (
                  <div className="absolute -right-1.5 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#d92d20]">
                    <span className="text-[9px] font-bold text-white">{unread > 9 ? '9+' : unread}</span>
                  </div>
                )}
              </div>
              <span className={cn(
                'text-[12px] font-medium leading-none',
                active ? 'text-[#08642f]' : 'text-[#667085]',
              )}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
