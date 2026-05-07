import { create } from 'zustand';
import type { User, Item, WishlistItem, Match, Conversation } from '@/types';

interface AppState {
  // Auth
  currentUser: User | null;
  isAuthenticated: boolean;
  setCurrentUser: (user: User | null) => void;

  // Navigation
  activeTab: 'explore' | 'matches' | 'chat' | 'profile';
  setActiveTab: (tab: AppState['activeTab']) => void;

  // Books
  myBooks: Item[];
  setMyBooks: (books: Item[]) => void;
  addBook: (book: Item) => void;
  removeBook: (id: string) => void;

  // Wishlist
  wishlist: WishlistItem[];
  setWishlist: (items: WishlistItem[]) => void;
  addWishlistItem: (item: WishlistItem) => void;
  removeWishlistItem: (id: string) => void;

  // Matches
  matches: Match[];
  setMatches: (matches: Match[]) => void;
  unreadMatches: number;
  setUnreadMatches: (count: number) => void;

  // Conversations
  conversations: Conversation[];
  setConversations: (conversations: Conversation[]) => void;
  unreadMessages: number;
  setUnreadMessages: (count: number) => void;
}

export const useAppStore = create<AppState>((set) => ({
  // Auth
  currentUser: null,
  isAuthenticated: false,
  setCurrentUser: (user) => set({ currentUser: user, isAuthenticated: !!user }),

  // Navigation
  activeTab: 'explore',
  setActiveTab: (tab) => set({ activeTab: tab }),

  // Books
  myBooks: [],
  setMyBooks: (books) => set({ myBooks: books }),
  addBook: (book) => set((state) => ({ myBooks: [book, ...state.myBooks] })),
  removeBook: (id) => set((state) => ({ myBooks: state.myBooks.filter((b) => b.id !== id) })),

  // Wishlist
  wishlist: [],
  setWishlist: (items) => set({ wishlist: items }),
  addWishlistItem: (item) => set((state) => ({ wishlist: [item, ...state.wishlist] })),
  removeWishlistItem: (id) => set((state) => ({ wishlist: state.wishlist.filter((w) => w.id !== id) })),

  // Matches
  matches: [],
  setMatches: (matches) => set({ matches }),
  unreadMatches: 0,
  setUnreadMatches: (count) => set({ unreadMatches: count }),

  // Conversations
  conversations: [],
  setConversations: (conversations) => set({ conversations }),
  unreadMessages: 0,
  setUnreadMessages: (count) => set({ unreadMessages: count }),
}));
