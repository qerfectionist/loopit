import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface PresencePayload {
  typing: boolean;
  user_id: string;
}

/**
 * Supabase Presence hook for "is typing..." indicator.
 * - Broadcasts your typing state to the channel.
 * - Calls onPartnerTyping(true/false) when the partner's state changes.
 */
export const useTypingPresence = (
  conversationId: string | undefined,
  myUserId: string | undefined,
  onPartnerTyping: (isTyping: boolean) => void
) => {
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!conversationId || !myUserId) return;

    const channel = supabase.channel(`typing:${conversationId}`, {
      config: { presence: { key: myUserId } },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<PresencePayload>();
        // Find partner (anyone who is not me)
        const partnerTyping = Object.entries(state)
          .filter(([key]) => key !== myUserId)
          .some(([, presences]) =>
            presences.some((p) => p.typing === true)
          );
        onPartnerTyping(partnerTyping);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ typing: false, user_id: myUserId });
        }
      });

    channelRef.current = channel;

    return () => {
      if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
      supabase.removeChannel(channel);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, myUserId]);

  /** Call this when user starts typing */
  const startTyping = useCallback(() => {
    if (!channelRef.current) return;

    // Clear existing stop timer
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);

    channelRef.current.track({ typing: true });

    // Auto-stop after 3s of no input
    stopTimerRef.current = setTimeout(() => {
      channelRef.current?.track({ typing: false });
    }, 3000);
  }, []);

  /** Call this when user sends a message or clears input */
  const stopTyping = useCallback(() => {
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    channelRef.current?.track({ typing: false });
  }, []);

  return { startTyping, stopTyping };
};
