import { supabase } from '@/lib/supabase';
import type { Match, MatchStatus } from '@/types';

/** Get matches for a user (both user_a and user_b) */
export const getMatches = async (userId: string): Promise<Match[]> => {
  const { data, error } = await supabase
    .from('matches')
    .select(`
      *,
      partner_a:users!matches_user_a_fkey(*),
      partner_b:users!matches_user_b_fkey(*),
      offered_item:items!matches_item_a_fkey(*, user:users(*)),
      wanted_item:items!matches_item_b_fkey(*, user:users(*))
    `)
    .or(`user_a.eq.${userId},user_b.eq.${userId}`)
    .in('status', ['pending', 'viewed', 'accepted'])
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Matches] Failed to fetch matches:', error);
    return [];
  }

  // Normalize: set `partner` to the other user
  return (data ?? []).map((match) => ({
    ...match,
    partner: match.user_a === userId ? match.partner_b : match.partner_a,
  })) as Match[];
};

/** Update match status */
export const updateMatchStatus = async (
  matchId: string,
  status: MatchStatus
): Promise<boolean> => {
  const { error } = await supabase
    .from('matches')
    .update({ status })
    .eq('id', matchId);

  if (error) {
    console.error('[Matches] Failed to update match:', error);
    return false;
  }

  return true;
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

/** Accept a match — creates a conversation so users can chat */
export const acceptMatch = async (matchId: string): Promise<boolean> => {
  // 1. Get match details to know who the users are
  const { data: match, error: fetchErr } = await supabase
    .from('matches')
    .select('user_a, user_b')
    .eq('id', matchId)
    .single();

  if (fetchErr || !match) {
    console.error('[Matches] Failed to fetch match for accept:', fetchErr);
    return false;
  }

  // 2. Update match status
  const { error } = await supabase
    .from('matches')
    .update({ status: 'accepted' })
    .eq('id', matchId);

  if (error) {
    console.error('[Matches] Failed to accept match:', error);
    return false;
  }

  // 3. Create conversation (ignore if already exists)
  const { error: convErr } = await supabase
    .from('conversations')
    .insert({
      match_id: matchId,
      user_a: match.user_a,
      user_b: match.user_b,
    });

  if (convErr) {
    console.error('[Matches] Failed to create conversation:', convErr);
    // Not fatal — match is still accepted
  }

  return true;
};

/**
 * Express interest in another user's item.
 * Creates a pending match from the current user (user_a) to the item owner (user_b).
 * item_a is the liker's item they'd offer (optional for now), item_b is the liked item.
 */
export const createLike = async (opts: {
  likerUserId: string;
  likerItemId: string | null; // item the liker would offer — can be null if they have no items yet
  ownerUserId: string;
  ownerItemId: string;
}): Promise<{ id: string } | null> => {
  const { likerUserId, likerItemId, ownerUserId, ownerItemId } = opts;

  // Check if a match already exists between these two users for this item
  const { data: existing } = await supabase
    .from('matches')
    .select('id')
    .eq('user_a', likerUserId)
    .eq('user_b', ownerUserId)
    .eq('item_b', ownerItemId)
    .maybeSingle();

  if (existing) return existing; // already liked

  const { data, error } = await supabase
    .from('matches')
    .insert({
      user_a: likerUserId,
      user_b: ownerUserId,
      item_a: likerItemId,
      item_b: ownerItemId,
      score: 50,
      status: 'pending',
    })
    .select('id')
    .single();

  if (error) {
    console.error('[Matches] Failed to create like:', error);
    return null;
  }

  // ── Reciprocal check ──
  // Did the other user already like one of my items?
  const { data: reciprocal } = await supabase
    .from('matches')
    .select('id')
    .eq('user_a', ownerUserId)
    .eq('user_b', likerUserId)
    .in('status', ['pending', 'viewed'])
    .maybeSingle();

  if (reciprocal && data) {
    // Auto-accept both matches
    await supabase
      .from('matches')
      .update({ status: 'accepted' })
      .in('id', [data.id, reciprocal.id]);

    // Create conversation between the two users
    await supabase
      .from('conversations')
      .insert({
        match_id: data.id,
        user_a: likerUserId,
        user_b: ownerUserId,
      });

    console.log('[Matches] 🎉 Reciprocal match! Auto-accepted + conversation created');
  }

  return data;
};

/** Decline a match */
export const declineMatch = async (matchId: string): Promise<boolean> => {
  const { error } = await supabase
    .from('matches')
    .update({ status: 'declined' })
    .eq('id', matchId);

  if (error) {
    console.error('[Matches] Failed to decline match:', error);
    return false;
  }

  return true;
};
