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
      wanted_item:items!matches_item_b_fkey(*, user:users(*)),
      conversation:conversations!conversations_match_id_fkey(id)
    `)
    .or(`user_a.eq.${userId},user_b.eq.${userId}`)
    .in('status', ['pending', 'viewed', 'accepted'])
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Matches] Failed to fetch matches:', error);
    return [];
  }

  // Normalize: set `partner` to the other user, flatten conversation_id
  return (data ?? []).map((match) => ({
    ...match,
    partner: match.user_a === userId ? match.partner_b : match.partner_a,
    conversation_id: (match.conversation as { id: string }[] | null)?.[0]?.id ?? null,
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
export const acceptMatch = async (matchId: string): Promise<string | null> => {
  // 1. Fetch match + participant names to notify the liker
  const { data: match, error: fetchErr } = await supabase
    .from('matches')
    .select('user_a, user_b, user_a_profile:users!matches_user_a_fkey(telegram_id, first_name), user_b_profile:users!matches_user_b_fkey(first_name)')
    .eq('id', matchId)
    .single();

  if (fetchErr || !match) {
    console.error('[Matches] Failed to fetch match for accept:', fetchErr);
    return null;
  }

  // 2. Upsert conversation FIRST — idempotent, safe to retry
  const { data: conv, error: convErr } = await supabase
    .from('conversations')
    .upsert(
      { match_id: matchId, user_a: match.user_a, user_b: match.user_b },
      { onConflict: 'match_id', ignoreDuplicates: false }
    )
    .select('id')
    .single();

  if (convErr || !conv) {
    console.error('[Matches] Failed to upsert conversation:', convErr);
    return null;
  }

  // 3. Mark match as accepted
  const { error: matchErr } = await supabase
    .from('matches')
    .update({ status: 'accepted' })
    .eq('id', matchId);

  if (matchErr) {
    console.error('[Matches] Failed to update match status:', matchErr);
  }

  // NOTE: Telegram notification is now fired server-side by
  //       the PostgreSQL trigger `trg_notify_match` via pg_net.
  //       No frontend notify call needed.

  return conv.id;
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

  // Fetch both profiles for notifications
  const { data: profiles } = await supabase
    .from('users')
    .select('id, telegram_id, first_name')
    .in('id', [likerUserId, ownerUserId]);

  const likerProfile = profiles?.find((u) => u.id === likerUserId);
  const ownerProfile = profiles?.find((u) => u.id === ownerUserId);

  if (reciprocal && data) {
    // Auto-accept both matches
    await supabase
      .from('matches')
      .update({ status: 'accepted' })
      .in('id', [data.id, reciprocal.id]);

    // Upsert conversation (safe on retry / race condition)
    const { error: convErr } = await supabase
      .from('conversations')
      .upsert(
        { match_id: data.id, user_a: likerUserId, user_b: ownerUserId },
        { onConflict: 'match_id', ignoreDuplicates: false }
      )
      .select('id')
      .single();

    if (convErr) {
      console.error('[Matches] Reciprocal conv upsert failed:', convErr);
    } else {
      console.log('[Matches] 🎉 Reciprocal match! Auto-accepted + conversation upserted');
    }

  // NOTE: Telegram notifications (new_match / match_accepted) are now fired
  //       server-side by the PostgreSQL trigger `trg_notify_match` via pg_net.
  //       No frontend notify call needed here.

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
