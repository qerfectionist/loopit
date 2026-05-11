import { useLocation, useNavigate } from 'react-router-dom';
import { Compass, Repeat2, MessageCircle, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { triggerSelection } from '@/lib/telegram';
import { useAppStore } from '@/stores/appStore';
import { useUnreadMatches } from '@/hooks/useMatches';
import { useUnreadMessages } from '@/hooks/useChat';

const tabs = [
  { id: 'explore' as const, label: 'Explore', icon: Compass, path: '/' },
  { id: 'matches' as const, label: 'Matches', icon: Repeat2, path: '/matches' },
  { id: 'chat' as const, label: 'Chat', icon: MessageCircle, path: '/chat' },
  { id: 'profile' as const, label: 'Profile', icon: User, path: '/profile' },
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
    <nav className="fixed bottom-0 left-0 right-0 z-50 glass border-t border-border safe-area-bottom">
      <div className="flex items-center justify-around h-14 max-w-lg mx-auto">
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
                'flex flex-col items-center justify-center gap-0.5 flex-1 h-full',
                'transition-colors duration-[var(--duration-fast)]',
                'relative',
                active ? 'text-accent' : 'text-text-muted',
              )}
            >
              <div className="relative">
                <Icon size={22} strokeWidth={active ? 2.2 : 1.8} />
                {unread > 0 && (
                  <div className="absolute -top-1 -right-1.5 w-4 h-4 bg-error rounded-full flex items-center justify-center">
                    <span className="text-[9px] font-bold text-white">{unread > 9 ? '9+' : unread}</span>
                  </div>
                )}
              </div>
              <span className={cn(
                'text-[10px] font-medium',
                active ? 'text-accent' : 'text-text-muted',
              )}>
                {tab.label}
              </span>
              {active && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-accent rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
