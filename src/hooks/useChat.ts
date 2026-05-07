import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { getConversations, getMessages, sendMessage, markMessagesRead, subscribeToMessages, getUnreadCount } from '@/services/chat';
import type { Message } from '@/types';

/** Fetch user's conversations */
export const useConversations = (userId: string | undefined) => {
  return useQuery({
    queryKey: ['conversations', userId],
    queryFn: () => getConversations(userId!),
    enabled: !!userId,
    refetchInterval: 1000 * 15,
  });
};

/** Fetch messages for a conversation */
export const useChatMessages = (conversationId: string | undefined) => {
  return useQuery({
    queryKey: ['messages', conversationId],
    queryFn: () => getMessages(conversationId!),
    enabled: !!conversationId,
    refetchInterval: 1000 * 5,
  });
};

/** Send a message */
export const useSendMessage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (msg: {
      conversation_id: string;
      sender_id: string;
      content: string;
    }) => sendMessage(msg),
    onSuccess: (data) => {
      if (data) {
        queryClient.invalidateQueries({ queryKey: ['messages', data.conversation_id] });
        queryClient.invalidateQueries({ queryKey: ['conversations'] });
      }
    },
  });
};

/** Mark messages as read when entering a chat */
export const useMarkRead = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ conversationId, userId }: {
      conversationId: string;
      userId: string;
    }) => markMessagesRead(conversationId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['unreadMessages'] });
    },
  });
};

/** Subscribe to realtime messages */
export const useRealtimeMessages = (
  conversationId: string | undefined,
  onNewMessage?: (msg: Message) => void
) => {
  const queryClient = useQueryClient();
  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!conversationId) return;

    unsubRef.current = subscribeToMessages(conversationId, (msg) => {
      queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
      onNewMessage?.(msg);
    });

    return () => {
      unsubRef.current?.();
    };
  }, [conversationId, queryClient, onNewMessage]);
};

/** Unread messages count for badges */
export const useUnreadMessages = (userId: string | undefined) => {
  return useQuery({
    queryKey: ['unreadMessages', userId],
    queryFn: () => getUnreadCount(userId!),
    enabled: !!userId,
    refetchInterval: 1000 * 15,
  });
};
