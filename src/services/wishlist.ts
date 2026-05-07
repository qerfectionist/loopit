import { supabase } from '@/lib/supabase';
import type { WishlistItem, ItemCategory } from '@/types';

/** Get user's wishlist */
export const getWishlist = async (userId: string): Promise<WishlistItem[]> => {
  const { data, error } = await supabase
    .from('wishlists')
    .select('*')
    .eq('user_id', userId)
    .order('priority', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Wishlist] Failed to fetch wishlist:', error);
    return [];
  }

  return data as WishlistItem[];
};

/** Add item to wishlist */
export const addToWishlist = async (item: {
  user_id: string;
  title: string;
  author?: string;
  description?: string;
  category?: ItemCategory;
  priority?: number;
}): Promise<WishlistItem | null> => {
  const { data, error } = await supabase
    .from('wishlists')
    .insert({
      user_id: item.user_id,
      title: item.title,
      author: item.author ?? null,
      description: item.description ?? null,
      category: item.category ?? 'book',
      priority: item.priority ?? 0,
    })
    .select()
    .single();

  if (error) {
    console.error('[Wishlist] Failed to add wishlist item:', error);
    return null;
  }

  return data as WishlistItem;
};

/** Update a wishlist item */
export const updateWishlistItem = async (
  id: string,
  updates: Partial<Pick<WishlistItem, 'title' | 'author' | 'description' | 'priority'>>
): Promise<WishlistItem | null> => {
  const { data, error } = await supabase
    .from('wishlists')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('[Wishlist] Failed to update wishlist item:', error);
    return null;
  }

  return data as WishlistItem;
};

/** Remove item from wishlist */
export const removeFromWishlist = async (id: string): Promise<boolean> => {
  const { error } = await supabase
    .from('wishlists')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('[Wishlist] Failed to remove wishlist item:', error);
    return false;
  }

  return true;
};

/** Get wishlist count for user */
export const getWishlistCount = async (userId: string): Promise<number> => {
  const { count, error } = await supabase
    .from('wishlists')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (error) return 0;
  return count ?? 0;
};
