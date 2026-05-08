import { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Send, Repeat2, MoreVertical, Loader2 } from 'lucide-react';
import { Shell } from '@/components/layout';
import { Avatar } from '@/components/ui';
import { triggerHaptic } from '@/lib/telegram';
import { useChatMessages, useSendMessage, useMarkRead, useRealtimeMessages } from '@/hooks/useChat';
import { useTypingPresence } from '@/hooks/useTypingPresence';
import { useAppStore } from '@/stores/appStore';
import { getConversations } from '@/services/chat';
import type { Conversation } from '@/types';

export const ChatRoomPage = () => {
  const { id: conversationId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const currentUser = useAppStore((s) => s.currentUser);
  const [message, setMessage] = useState('');
  const [conv, setConv] = useState<Conversation | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: messages = [], isLoading } = useChatMessages(conversationId);
  const sendMessage = useSendMessage();
  const markRead = useMarkRead();
  const [partnerIsTyping, setPartnerIsTyping] = useState(false);

  const { startTyping, stopTyping } = useTypingPresence(
    conversationId,
    currentUser?.id,
    setPartnerIsTyping
  );

  // Load conversation details (partner info)
  useEffect(() => {
    if (!currentUser?.id || !conversationId) return;
    getConversations(currentUser.id).then((convos) => {
      const found = convos.find((c) => c.id === conversationId);
      if (found) setConv(found);
    });
  }, [currentUser?.id, conversationId]);

  // Mark messages as read on enter
  useEffect(() => {
    if (conversationId && currentUser?.id) {
      markRead.mutate({ conversationId, userId: currentUser.id });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, currentUser?.id]);

  // Scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Realtime subscription
  useRealtimeMessages(conversationId, () => {
    scrollToBottom();
  });

  const handleSend = () => {
    if (!message.trim() || !currentUser || !conversationId) return;
    triggerHaptic('light');
    stopTyping(); // clear typing indicator immediately
    sendMessage.mutate({
      conversation_id: conversationId,
      sender_id: currentUser.id,
      content: message.trim(),
    });
    setMessage('');
    inputRef.current?.focus();
  };

  const partnerName = conv?.partner
    ? `${conv.partner.first_name} ${conv.partner.last_name ?? ''}`
    : 'Chat';

  return (
    <Shell hideNav>
      <div className="flex flex-col h-dvh">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-bg-primary/80 backdrop-blur-lg sticky top-0 z-20">
          <button
            onClick={() => {
              triggerHaptic('light');
              navigate('/chat');
            }}
            className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-bg-tertiary transition-colors flex-shrink-0"
          >
            <ArrowLeft size={20} />
          </button>
          {conv?.partner && (
            <Avatar
              name={conv.partner.first_name}
              lastName={conv.partner.last_name ?? undefined}
              size="md"
            />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-semibold leading-tight">
              {partnerName}
            </p>
          </div>
          <button className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-bg-tertiary transition-colors flex-shrink-0">
            <MoreVertical size={18} className="text-text-secondary" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2.5">
          {isLoading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-accent" />
            </div>
          ) : (
            <>
              {messages.length === 0 && (
                <div className="flex justify-center py-10">
                  <p className="text-[13px] text-text-muted">
                    No messages yet. Say hi! 👋
                  </p>
                </div>
              )}
              {messages.map((msg, i) => {
                if (msg.type === 'system') {
                  return (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex justify-center my-3"
                    >
                      <div className="bg-accent-soft/50 px-3 py-1.5 rounded-full flex items-center gap-1.5">
                        <Repeat2 size={12} className="text-accent" />
                        <span className="text-[11px] text-accent-text">
                          {msg.content}
                        </span>
                      </div>
                    </motion.div>
                  );
                }

                const isMe = msg.sender_id === currentUser?.id;
                const time = new Date(msg.created_at).toLocaleTimeString('en', {
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: false,
                });

                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.02, duration: 0.2 }}
                    className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[75%] px-3.5 py-2.5 rounded-2xl ${
                        isMe
                          ? 'bg-accent text-white rounded-br-md'
                          : 'bg-bg-secondary border border-border text-text-primary rounded-bl-md'
                      }`}
                    >
                      <p className="text-[14px] leading-relaxed">
                        {msg.content}
                      </p>
                      <p
                        className={`text-[10px] mt-1 text-right ${
                          isMe ? 'text-white/50' : 'text-text-muted'
                        }`}
                      >
                        {time}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
            </>
          )}
          <div ref={messagesEndRef} />

          {/* Typing indicator */}
          <AnimatePresence>
            {partnerIsTyping && (
              <motion.div
                initial={{ opacity: 0, y: 6, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="flex justify-start px-1"
              >
                <div className="bg-bg-secondary border border-border rounded-2xl rounded-bl-md px-3.5 py-2.5 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-text-muted animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-text-muted animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-text-muted animate-bounce [animation-delay:300ms]" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Input */}
        <div className="px-4 py-3 border-t border-border bg-bg-primary safe-area-bottom">
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              placeholder="Type a message..."
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
                if (e.target.value.trim()) startTyping();
                else stopTyping();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSend();
              }}
              className="flex-1 h-10 px-4 rounded-full text-[14px] bg-bg-tertiary text-text-primary placeholder-text-muted border border-border focus:border-accent outline-none transition-colors"
            />
            <button
              onClick={handleSend}
              disabled={!message.trim() || sendMessage.isPending}
              className="w-10 h-10 bg-accent rounded-full flex items-center justify-center flex-shrink-0 transition-all disabled:opacity-30 active:scale-90"
            >
              <Send size={16} className="text-white ml-0.5" />
            </button>
          </div>
        </div>
      </div>
    </Shell>
  );
};
