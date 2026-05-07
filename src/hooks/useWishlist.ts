import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getWishlist, addToWishlist, updateWishlistItem, removeFromWishlist } from '@/services/wishlist';
import type { ItemCategory } from '@/types';

/** Fetch user's wishlist */
export const useWishlist = (userId: string | undefined) => {
  return useQuery({
    queryKey: ['wishlist', userId],
    queryFn: () => getWishlist(userId!),
    enabled: !!userId,
  });
};

/** Add item to wishlist */
export const useAddToWishlist = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (item: {
      user_id: string;
      title: string;
      author?: string;
      description?: string;
      category?: ItemCategory;
      priority?: number;
    }) => addToWishlist(item),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['wishlist', variables.user_id] });
    },
  });
};

/** Update wishlist item */
export const useUpdateWishlistItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: {
      id: string;
      updates: Parameters<typeof updateWishlistItem>[1];
    }) => updateWishlistItem(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wishlist'] });
    },
  });
};

/** Remove from wishlist */
export const useRemoveFromWishlist = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => removeFromWishlist(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wishlist'] });
    },
  });
};
