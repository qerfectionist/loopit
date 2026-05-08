import { supabase } from '@/lib/supabase';
import type { Item, ItemCategory, ExchangeType, ItemCondition } from '@/types';

/** Fetch paginated list of active items with user data */
export const getItems = async (opts?: {
  search?: string;
  category?: ItemCategory;
  condition?: ItemCondition;
  limit?: number;
  offset?: number;
}): Promise<Item[]> => {
  const { search, category, condition, limit = 20, offset = 0 } = opts ?? {};

  let query = supabase
    .from('items')
    .select('*, user:users(*)')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (category) {
    query = query.eq('category', category);
  }

  if (condition) {
    query = query.eq('condition', condition);
  }

  if (search) {
    query = query.or(`title.ilike.%${search}%,author.ilike.%${search}%`);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[Items] Failed to fetch items:', error);
    return [];
  }

  return data as Item[];
};

/** Get a single item by id with user data */
export const getItemById = async (id: string): Promise<Item | null> => {
  const { data, error } = await supabase
    .from('items')
    .select('*, user:users(*)')
    .eq('id', id)
    .single();

  if (error) {
    console.error('[Items] Failed to fetch item:', error);
    return null;
  }

  return data as Item;
};

/** Get items belonging to a specific user */
export const getUserItems = async (userId: string): Promise<Item[]> => {
  const { data, error } = await supabase
    .from('items')
    .select('*')
    .eq('user_id', userId)
    .neq('status', 'removed')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Items] Failed to fetch user items:', error);
    return [];
  }

  return data as Item[];
};

/** Create a new item listing */
export const createItem = async (item: {
  user_id: string;
  title: string;
  author?: string;
  description?: string;
  condition: ItemCondition;
  exchange_type: ExchangeType;
  price?: number;
  images?: string[];
  category?: ItemCategory;
}): Promise<Item | null> => {
  const { data, error } = await supabase
    .from('items')
    .insert({
      user_id: item.user_id,
      title: item.title,
      author: item.author ?? null,
      description: item.description ?? null,
      condition: item.condition,
      exchange_type: item.exchange_type,
      price: item.price ?? null,
      images: item.images ?? [],
      category: item.category ?? 'book',
      status: 'active',
    })
    .select('*, user:users(*)')
    .single();

  if (error) {
    console.error('[Items] Failed to create item:', error);
    return null;
  }

  return data as Item;
};

/** Update an existing item */
export const updateItem = async (
  id: string,
  updates: Partial<Pick<Item, 'title' | 'author' | 'description' | 'condition' | 'exchange_type' | 'price' | 'images' | 'status'>>
): Promise<Item | null> => {
  const { data, error } = await supabase
    .from('items')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*, user:users(*)')
    .single();

  if (error) {
    console.error('[Items] Failed to update item:', error);
    return null;
  }

  return data as Item;
};

/** Soft-delete an item (set status to removed) */
export const removeItem = async (id: string): Promise<boolean> => {
  const { error } = await supabase
    .from('items')
    .update({ status: 'removed', updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    console.error('[Items] Failed to remove item:', error);
    return false;
  }

  return true;
};

/** Upload item images to Supabase Storage */
export const uploadItemImage = async (
  userId: string,
  file: File
): Promise<string> => {
  // --- Validation (client-side, before any network request) ---
  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error(`Unsupported file type: ${file.type}. Only JPG, PNG and WebP are allowed.`);
  }

  if (file.size > MAX_SIZE_BYTES) {
    throw new Error(`File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is 5 MB.`);
  }

  // --- Upload ---
  const ext = file.type === 'image/webp' ? 'webp'
    : file.type === 'image/png' ? 'png'
    : 'jpg';
  const fileName = `${userId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('item-images')
    .upload(fileName, file, { cacheControl: '3600', upsert: false });

  if (uploadError) {
    console.error('[Items] Failed to upload image:', uploadError);
    throw new Error(uploadError.message);
  }

  const { data: urlData } = supabase.storage
    .from('item-images')
    .getPublicUrl(fileName);

  return urlData.publicUrl;
};

/** Get items count for stats */
export const getItemsCount = async (): Promise<number> => {
  const { count, error } = await supabase
    .from('items')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active');

  if (error) {
    console.error('[Items] Failed to count items:', error);
    return 0;
  }

  return count ?? 0;
};
