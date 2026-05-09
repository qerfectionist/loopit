import { motion } from 'framer-motion';
import { MessageCircle, Loader2 } from 'lucide-react';
import { Shell, PageHeader } from '@/components/layout';
import { Avatar } from '@/components/ui';
import { useNavigate } from 'react-router-dom';
import { triggerHaptic } from '@/lib/telegram';
import { formatRelativeTime, truncate } from '@/lib/utils';
import { useConversations } from '@/hooks/useChat';
import { useBlockedUsers } from '@/hooks/useSafety';
import { useAppStore } from '@/stores/appStore';

export const ChatListPage = () => {
  const navigate = useNavigate();
  const currentUser = useAppStore((s) => s.currentUser);
  const { data: allConversations = [], isLoading } = useConversations(currentUser?.id);
  const { data: blockedUsers = [] } = useBlockedUsers();

  const conversations = allConversations.filter(
    (conv) => !blockedUsers.some((b) => b.blocked_id === conv.partner?.id)
  );

  return (
    <Shell>
      <PageHeader
        title="Messages"
        subtitle={
          isLoading ? 'Loading...' : `${conversations.length} conversations`
        }
      />
      <div className="px-2 pb-6">
        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-accent" />
          </div>
        ) : (
          <>
            {conversations.map((conv, i) => (
              <motion.button
                key={conv.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06, duration: 0.3 }}
                className="w-full flex items-center gap-3 p-3.5 rounded-2xl hover:bg-bg-secondary active:bg-bg-tertiary transition-colors text-left"
                onClick={() => {
                  triggerHaptic('light');
                  navigate(`/chat/${conv.id}`);
                }}
              >
                <div className="relative">
                  <Avatar
                    name={conv.partner?.first_name ?? '?'}
                    lastName={conv.partner?.last_name ?? undefined}
                    size="lg"
                  />
                  {(conv.unread_count ?? 0) > 0 && (
                    <div className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-accent rounded-full flex items-center justify-center border-2 border-bg-primary">
                      <span className="text-[10px] font-bold text-white">
                        {conv.unread_count}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[15px] font-semibold">
                      {conv.partner?.first_name} {conv.partner?.last_name ?? ''}
                    </span>
                    <span className="text-[11px] text-text-muted flex-shrink-0 ml-2">
                      {conv.last_message_at
                        ? formatRelativeTime(conv.last_message_at)
                        : ''}
                    </span>
                  </div>
                  {conv.last_message && (
                    <p
                      className={`text-[13px] line-clamp-1 ${
                        (conv.unread_count ?? 0) > 0
                          ? 'text-text-primary font-medium'
                          : 'text-text-secondary'
                      }`}
                    >
                      {truncate(conv.last_message.content, 50)}
                    </p>
                  )}
                </div>
              </motion.button>
            ))}

            {conversations.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-center px-5">
                <div className="w-16 h-16 bg-bg-secondary rounded-2xl flex items-center justify-center mb-4 border border-border">
                  <MessageCircle size={28} className="text-text-muted" />
                </div>
                <p className="text-[16px] font-medium mb-1">No messages yet</p>
                <p className="text-[13px] text-text-secondary max-w-[240px]">
                  Match with someone to start chatting
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </Shell>
  );
};
