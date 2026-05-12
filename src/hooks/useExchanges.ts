import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getExchanges,
  getExchange,
  proposeExchange,
  acceptExchange,
  confirmExchange,
  cancelExchange,
  updateMeetup,
} from '@/services/exchanges';

/** Fetch all exchanges for a user */
export const useExchanges = (userId: string | undefined) => {
  return useQuery({
    queryKey: ['exchanges', userId],
    queryFn: () => getExchanges(userId!),
    enabled: !!userId,
  });
};

/** Fetch a single exchange */
export const useExchange = (exchangeId: string | undefined) => {
  return useQuery({
    queryKey: ['exchange', exchangeId],
    queryFn: () => getExchange(exchangeId!),
    enabled: !!exchangeId,
  });
};

/** Propose a new exchange */
export const useProposeExchange = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: proposeExchange,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exchanges'] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
};

/** Accept an exchange */
export const useAcceptExchange = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (exchangeId: string) => acceptExchange(exchangeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exchanges'] });
      queryClient.invalidateQueries({ queryKey: ['exchange'] });
    },
  });
};

/** Confirm exchange completion */
export const useConfirmExchange = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (exchangeId: string) => confirmExchange(exchangeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exchanges'] });
      queryClient.invalidateQueries({ queryKey: ['exchange'] });
      queryClient.invalidateQueries({ queryKey: ['items'] });
    },
  });
};

/** Cancel an exchange */
export const useCancelExchange = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (exchangeId: string) => cancelExchange(exchangeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exchanges'] });
      queryClient.invalidateQueries({ queryKey: ['exchange'] });
    },
  });
};

/** Update meetup place + time */
export const useUpdateMeetup = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ exchangeId, place, time }: {
      exchangeId: string;
      place: string;
      time: string;
    }) => updateMeetup(exchangeId, place, time),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exchange'] });
    },
  });
};
