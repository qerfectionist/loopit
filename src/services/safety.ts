import { supabase } from '@/lib/supabase';

export interface UserBlock {
  id: string;
  blocker_id: string;
  blocked_id: string;
  created_at: string;
}

export interface Report {
  id: string;
  reporter_id: string;
  reported_user_id: string;
  reason: string;
  description?: string;
  related_item_id?: string;
  related_conversation_id?: string;
  related_exchange_id?: string;
  status: 'open' | 'reviewed' | 'resolved';
  created_at: string;
}

export const blockUser = async (blockerId: string, blockedId: string): Promise<void> => {
  const { error } = await supabase
    .from('user_blocks')
    .insert({ blocker_id: blockerId, blocked_id: blockedId });
  
  if (error) {
    if (error.code === '23505') return; // Already blocked
    throw error;
  }
};

export const unblockUser = async (blockerId: string, blockedId: string): Promise<void> => {
  const { error } = await supabase
    .from('user_blocks')
    .delete()
    .eq('blocker_id', blockerId)
    .eq('blocked_id', blockedId);

  if (error) throw error;
};

export const getBlockedUsers = async (blockerId: string): Promise<UserBlock[]> => {
  const { data, error } = await supabase
    .from('user_blocks')
    .select('*')
    .eq('blocker_id', blockerId);

  if (error) throw error;
  return data || [];
};

export const reportUser = async (
  reportedId: string,
  reason: string,
  description?: string,
  relatedItemId?: string,
  relatedConversationId?: string,
  relatedExchangeId?: string
): Promise<void> => {
  const { error } = await supabase.rpc('submit_report', {
    p_reported_user_id: reportedId,
    p_reason: reason,
    p_description: description ?? null,
    p_related_item_id: relatedItemId ?? null,
    p_related_conversation_id: relatedConversationId ?? null,
    p_related_exchange_id: relatedExchangeId ?? null,
  });

  if (error) throw error;
};
