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
  const { data, error } = await supabase.rpc('propose_exchange', {
    p_conversation_id: params.conversation_id,
    p_match_id: params.match_id,
    p_item_given: params.item_given,
    p_item_received: params.item_received ?? null,
    p_meetup_location: params.meetup_location ?? null,
    p_meetup_time: params.meetup_time ?? null,
  });

  if (error) {
    console.error('[Exchanges] Propose RPC failed:', error);
    return null;
  }

  return data as Exchange;
};

/** Accept an exchange proposal */
export const acceptExchange = async (exchangeId: string): Promise<boolean> => {
  const { error } = await supabase.rpc('accept_exchange', {
    p_exchange_id: exchangeId,
  });

  if (error) {
    console.error('[Exchanges] Accept RPC failed:', error);
    return false;
  }

  return true;
};

/** Confirm exchange completion (by one party) - atomic via PostgreSQL RPC */
export const confirmExchange = async (
  exchangeId: string
): Promise<boolean> => {
  const { data, error } = await supabase.rpc('confirm_exchange', {
    p_exchange_id: exchangeId,
  });

  if (error) {
    console.error('[Exchanges] Confirm RPC failed:', error);
    return false;
  }

  const result = data as { completed?: boolean; error?: string };

  if (result?.error) {
    console.error('[Exchanges] Confirm RPC error:', result.error);
    return false;
  }

  return true;
};


/** Cancel an exchange */
export const cancelExchange = async (exchangeId: string): Promise<boolean> => {
  const { error } = await supabase.rpc('cancel_exchange', {
    p_exchange_id: exchangeId,
  });

  if (error) {
    console.error('[Exchanges] Cancel RPC failed:', error);
    return false;
  }

  return true;
};

/** Update meetup location and time for an accepted exchange */
export const updateMeetup = async (
  exchangeId: string,
  place: string,
  time: string // ISO datetime string
): Promise<boolean> => {
  const { error } = await supabase.rpc('update_exchange_meetup', {
    p_exchange_id: exchangeId,
    p_place: place,
    p_time: time,
  });

  if (error) {
    console.error('[Exchanges] Update meetup RPC failed:', error);
    return false;
  }

  return true;
};
