import { supabase } from '@/lib/supabase';
import type { Exchange } from '@/types';

/** Get exchanges for a user */
export const getExchanges = async (userId: string): Promise<Exchange[]> => {
  const { data, error } = await supabase
    .from('exchanges')
    .select('*')
    .or(`initiator_id.eq.${userId},responder_id.eq.${userId}`)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Exchanges] Fetch failed:', error);
    return [];
  }

  return (data ?? []) as Exchange[];
};

/** Get a single exchange by ID */
export const getExchange = async (exchangeId: string): Promise<Exchange | null> => {
  const { data, error } = await supabase
    .from('exchanges')
    .select('*')
    .eq('id', exchangeId)
    .single();

  if (error) {
    console.error('[Exchanges] Fetch single failed:', error);
    return null;
  }

  return data as Exchange;
};

/** Propose a new exchange from a conversation */
export const proposeExchange = async (params: {
  conversation_id: string;
  match_id: string;
  initiator_id: string;
  responder_id: string;
  item_given: string;
  item_received?: string;
  meetup_location?: { lat: number; lng: number; city: string };
  meetup_time?: string;
}): Promise<Exchange | null> => {
  const { data, error } = await supabase
    .from('exchanges')
    .insert({
      conversation_id: params.conversation_id,
      match_id: params.match_id,
      initiator_id: params.initiator_id,
      responder_id: params.responder_id,
      item_given: params.item_given,
      item_received: params.item_received ?? null,
      meetup_location: params.meetup_location ?? null,
      meetup_time: params.meetup_time ?? null,
      status: 'proposed',
    })
    .select()
    .single();

  if (error) {
    console.error('[Exchanges] Propose failed:', error);
    return null;
  }

  return data as Exchange;
};

/** Accept an exchange proposal */
export const acceptExchange = async (exchangeId: string): Promise<boolean> => {
  const { error } = await supabase
    .from('exchanges')
    .update({ status: 'accepted' })
    .eq('id', exchangeId);

  if (error) {
    console.error('[Exchanges] Accept failed:', error);
    return false;
  }

  return true;
};

/** Confirm exchange completion (by one party) */
export const confirmExchange = async (
  exchangeId: string,
  userId: string
): Promise<boolean> => {
  // First get the exchange to know which field to update
  const { data: exchange } = await supabase
    .from('exchanges')
    .select('initiator_id, responder_id, initiator_confirmed, responder_confirmed')
    .eq('id', exchangeId)
    .single();

  if (!exchange) return false;

  const isInitiator = exchange.initiator_id === userId;
  const updateField = isInitiator
    ? { initiator_confirmed: true }
    : { responder_confirmed: true };

  // Check if other party already confirmed
  const otherConfirmed = isInitiator
    ? exchange.responder_confirmed
    : exchange.initiator_confirmed;

  // If both confirmed, mark as completed
  const statusUpdate = otherConfirmed
    ? { ...updateField, status: 'completed', completed_at: new Date().toISOString() }
    : updateField;

  const { error } = await supabase
    .from('exchanges')
    .update(statusUpdate)
    .eq('id', exchangeId);

  if (error) {
    console.error('[Exchanges] Confirm failed:', error);
    return false;
  }

  // If completed, update item statuses to 'exchanged'
  if (otherConfirmed) {
    const { data: ex } = await supabase
      .from('exchanges')
      .select('item_given, item_received')
      .eq('id', exchangeId)
      .single();

    if (ex) {
      const itemIds = [ex.item_given, ex.item_received].filter(Boolean);
      if (itemIds.length > 0) {
        await supabase
          .from('items')
          .update({ status: 'exchanged' })
          .in('id', itemIds);
      }
    }

    // Update users' total_exchanges count
    if (exchange.initiator_id && exchange.responder_id) {
      for (const uid of [exchange.initiator_id, exchange.responder_id]) {
        const { data: user } = await supabase
          .from('users')
          .select('total_exchanges')
          .eq('id', uid)
          .single();
        if (user) {
          await supabase
            .from('users')
            .update({ total_exchanges: (user.total_exchanges ?? 0) + 1 })
            .eq('id', uid);
        }
      }
    }
  }

  return true;
};

/** Cancel an exchange */
export const cancelExchange = async (exchangeId: string): Promise<boolean> => {
  const { error } = await supabase
    .from('exchanges')
    .update({ status: 'cancelled' })
    .eq('id', exchangeId);

  if (error) {
    console.error('[Exchanges] Cancel failed:', error);
    return false;
  }

  return true;
};
