import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getItems, getItemById, getUserItems, createItem, updateItem, removeItem, uploadItemImage, getItemsCount } from '@/services/items';
import type { ItemCategory, ItemCondition, ExchangeType } from '@/types';

/** Fetch active items with optional search/filter */
export const useItems = (opts?: {
  search?: string;
  category?: ItemCategory;
  limit?: number;
  offset?: number;
}) => {
  return useQuery({
    queryKey: ['items', opts],
    queryFn: () => getItems(opts),
    staleTime: 1000 * 60 * 2, // 2 min
  });
};

/** Fetch a single item by ID */
export const useItem = (id: string | undefined) => {
  return useQuery({
    queryKey: ['item', id],
    queryFn: () => getItemById(id!),
    enabled: !!id,
  });
};

/** Fetch items for a specific user */
export const useUserItems = (userId: string | undefined) => {
  return useQuery({
    queryKey: ['userItems', userId],
    queryFn: () => getUserItems(userId!),
    enabled: !!userId,
  });
};

/** Create a new item listing */
export const useCreateItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (item: {
      user_id: string;
      title: string;
      author?: string;
      description?: string;
      condition: ItemCondition;
      exchange_type: ExchangeType;
      price?: number;
      images?: string[];
      category?: ItemCategory;
    }) => createItem(item),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      queryClient.invalidateQueries({ queryKey: ['userItems'] });
      queryClient.invalidateQueries({ queryKey: ['itemsCount'] });
    },
  });
};

/** Update an existing item */
export const useUpdateItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: {
      id: string;
      updates: Parameters<typeof updateItem>[1];
    }) => updateItem(id, updates),
    onSuccess: (data) => {
      if (data) {
        queryClient.setQueryData(['item', data.id], data);
        queryClient.invalidateQueries({ queryKey: ['items'] });
        queryClient.invalidateQueries({ queryKey: ['userItems'] });
      }
    },
  });
};

/** Remove an item (soft delete) */
export const useRemoveItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => removeItem(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      queryClient.invalidateQueries({ queryKey: ['userItems'] });
      queryClient.invalidateQueries({ queryKey: ['itemsCount'] });
    },
  });
};

/** Upload item image */
export const useUploadImage = () => {
  return useMutation({
    mutationFn: ({ userId, file }: { userId: string; file: File }) =>
      uploadItemImage(userId, file),
  });
};

/** Get total active items count */
export const useItemsCount = () => {
  return useQuery({
    queryKey: ['itemsCount'],
    queryFn: getItemsCount,
    staleTime: 1000 * 60 * 5,
  });
};
