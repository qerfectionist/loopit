/* Database types — mirrors Supabase schema */

export interface User {
  id: string;
  telegram_id: number;
  username: string | null;
  first_name: string;
  last_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  location: LocationData | null;
  rating: number;
  total_exchanges: number;
  created_at: string;
  updated_at: string;
}

export interface LocationData {
  lat: number;
  lng: number;
  city: string;
  district?: string;
}

export type ItemCondition = 'new' | 'like_new' | 'good' | 'fair';
export type ExchangeType = 'exchange' | 'sell' | 'both';
export type ItemStatus = 'active' | 'reserved' | 'exchanged' | 'removed';
export type ItemCategory = 'book' | 'electronics' | 'vinyl' | 'fashion' | 'hobby' | 'collectibles';

export interface Item {
  id: string;
  user_id: string;
  category: ItemCategory;
  title: string;
  author: string | null;
  description: string | null;
  condition: ItemCondition;
  images: string[];
  isbn: string | null;
  exchange_type: ExchangeType;
  price: number | null;
  status: ItemStatus;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  // Joined
  user?: User;
}

export interface WishlistItem {
  id: string;
  user_id: string;
  title: string;
  author: string | null;
  category: ItemCategory;
  description: string | null;
  priority: number;
  created_at: string;
}

export type MatchStatus = 'pending' | 'viewed' | 'accepted' | 'declined' | 'expired';

export interface Match {
  id: string;
  user_a: string;
  user_b: string;
  item_a: string;
  item_b: string | null;
  wishlist_a: string | null;
  wishlist_b: string | null;
  score: number;
  status: MatchStatus;
  created_at: string;
  // Joined
  partner?: User;
  offered_item?: Item;
  wanted_item?: Item;
  conversation_id?: string | null;
}

export interface Conversation {
  id: string;
  match_id: string;
  user_a: string;
  user_b: string;
  last_message_at: string | null;
  created_at: string;
  // Joined
  partner?: User;
  last_message?: Message;
  match?: Match;
  unread_count?: number;
}

export type MessageType = 'text' | 'image' | 'system';

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  type: MessageType;
  read_at: string | null;
  created_at: string;
  // Joined
  sender?: User;
}

export type ExchangeStatus = 'proposed' | 'accepted' | 'completed' | 'cancelled';

export interface Exchange {
  id: string;
  conversation_id: string;
  match_id: string;
  initiator_id: string;
  responder_id: string;
  item_given: string;
  item_received: string | null;
  meetup_location: LocationData | null;
  meetup_time: string | null;
  status: ExchangeStatus;
  initiator_confirmed: boolean;
  responder_confirmed: boolean;
  completed_at: string | null;
  created_at: string;
}

export interface Review {
  id: string;
  exchange_id: string;
  reviewer_id: string;
  reviewed_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  // Joined
  reviewer?: User;
}
