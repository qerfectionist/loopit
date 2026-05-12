import { supabase } from '@/lib/supabase';
import type { Conversation, Message } from '@/types';

/** Get user's conversations with partner info */
export const getConversations = async (userId: string): Promise<Conversation[]> => {
  const { data, error } = await supabase
    .from('conversations')
    .select(`
      *,
      partner_a:users!conversations_user_a_fkey(*),
      partner_b:users!conversations_user_b_fkey(*)
    `)
    .or(`user_a.eq.${userId},user_b.eq.${userId}`)
    .order('last_message_at', { ascending: false, nullsFirst: false });

  if (error) {
    console.error('[Chat] Fetch conversations failed:', error);
    return [];
  }

  return (data ?? []).map((conv) => ({
    ...conv,
    partner: conv.user_a === userId ? conv.partner_b : conv.partner_a,
  })) as Conversation[];
};

/** Get one conversation with partner info */
export const getConversation = async (
  conversationId: string,
  userId: string
): Promise<Conversation | null> => {
  const { data, error } = await supabase
    .from('conversations')
    .select(`
      *,
      partner_a:users!conversations_user_a_fkey(*),
      partner_b:users!conversations_user_b_fkey(*)
    `)
    .eq('id', conversationId)
    .or(`user_a.eq.${userId},user_b.eq.${userId}`)
    .maybeSingle();

  if (error) {
    console.error('[Chat] Fetch conversation failed:', error);
    return null;
  }

  if (!data) return null;

  return {
    ...data,
    partner: data.user_a === userId ? data.partner_b : data.partner_a,
  } as Conversation;
};

/** Get messages for a conversation */
export const getMessages = async (
  conversationId: string,
  limit = 50
): Promise<Message[]> => {
  const { data, error } = await supabase
    .from('messages')
    .select('*, sender:users(*)')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[Chat] Fetch messages failed:', error);
    return [];
  }

  return (data ?? []).reverse() as Message[];
};

/** Send a message */
export const sendMessage = async (msg: {
  conversation_id: string;
  sender_id: string;
  content: string;
  type?: 'text' | 'image' | 'system';
}): Promise<Message | null> => {
  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: msg.conversation_id,
      sender_id: msg.sender_id,
      content: msg.content,
      type: msg.type ?? 'text',
    })
    .select('*, sender:users(*)')
    .single();

  if (error) {
    console.error('[Chat] Send message failed:', error);
    return null;
  }

  return data as Message;
};

/** Mark messages as read */
export const markMessagesRead = async (
  conversationId: string,
  userId: string
): Promise<void> => {
  await supabase
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .neq('sender_id', userId)
    .is('read_at', null);
};

/** Subscribe to new messages (Supabase Realtime) */
export const subscribeToMessages = (
  conversationId: string,
  onMessage: (message: Message) => void
) => {
  const channel = supabase
    .channel(`messages:${conversationId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => onMessage(payload.new as Message)
    )
    .subscribe();

  return () => { supabase.removeChannel(channel); };
};

/** Get total unread count */
export const getUnreadCount = async (userId: string): Promise<number> => {
  const { data: convos } = await supabase
    .from('conversations')
    .select('id')
    .or(`user_a.eq.${userId},user_b.eq.${userId}`);

  if (!convos?.length) return 0;

  const { count } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .in('conversation_id', convos.map((c) => c.id))
    .neq('sender_id', userId)
    .is('read_at', null);

  return count ?? 0;
};
