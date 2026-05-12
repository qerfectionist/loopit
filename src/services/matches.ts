import { supabase } from '@/lib/supabase';
import type { Match } from '@/types';

/** Get matches for a user (both user_a and user_b) */
export const getMatches = async (userId: string, limit = 30): Promise<Match[]> => {
  const { data, error } = await supabase
    .from('matches')
    .select(`
      *,
      partner_a:users!matches_user_a_fkey(*),
      partner_b:users!matches_user_b_fkey(*),
      offered_item:items!matches_item_a_fkey(*, user:users(*)),
      wanted_item:items!matches_item_b_fkey(*, user:users(*)),
      conversation:conversations!conversations_match_id_fkey(id)
    `)
    .or(`user_a.eq.${userId},user_b.eq.${userId}`)
    .in('status', ['pending', 'viewed', 'accepted'])
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[Matches] Failed to fetch matches:', error);
    return [];
  }

  return (data ?? []).map((match) => ({
    ...match,
    partner: match.user_a === userId ? match.partner_b : match.partner_a,
    conversation_id: (match.conversation as { id: string }[] | null)?.[0]?.id ?? null,
  })) as Match[];
};

/** Get unread matches count */
export const getUnreadMatchesCount = async (userId: string): Promise<number> => {
  const { count, error } = await supabase
    .from('matches')
    .select('*', { count: 'exact', head: true })
    .or(`user_a.eq.${userId},user_b.eq.${userId}`)
    .eq('status', 'pending');

  if (error) return 0;
  return count ?? 0;
};

/** Accept a match and create/reuse its conversation */
export const acceptMatch = async (matchId: string): Promise<string | null> => {
  const { data, error } = await supabase.rpc('accept_match', {
    p_match_id: matchId,
  });

  if (error) {
    console.error('[Matches] Failed to accept match:', error);
    return null;
  }

  return data as string | null;
};

/**
 * Express interest in another user's item.
 * User identity and item ownership are verified in the database.
 */
export const createLike = async (opts: {
  likerItemId: string | null;
  ownerItemId: string;
}): Promise<{ id: string } | null> => {
  const { data, error } = await supabase.rpc('create_like', {
    p_liker_item_id: opts.likerItemId,
    p_owner_item_id: opts.ownerItemId,
  });

  if (error) {
    console.error('[Matches] Failed to create like:', error);
    return null;
  }

  return data as { id: string };
};

/** Decline a match */
export const declineMatch = async (matchId: string): Promise<boolean> => {
  const { error } = await supabase.rpc('decline_match', {
    p_match_id: matchId,
  });

  if (error) {
    console.error('[Matches] Failed to decline match:', error);
    return false;
  }

  return true;
};
