import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { ExplorePage } from '@/features/explore/ExplorePage';
import { MatchesPage } from '@/features/matching/MatchesPage';
import { ChatListPage } from '@/features/chat/ChatListPage';
import { ChatRoomPage } from '@/features/chat/ChatRoomPage';
import { ProfilePage } from '@/features/profile/ProfilePage';
import { AddBookPage } from '@/features/books/AddBookPage';
import { BookDetailPage } from '@/features/books/BookDetailPage';
import { WishlistPage } from '@/features/wishlist/WishlistPage';
import { MyBooksPage } from '@/features/books/MyBooksPage';
import { SettingsPage } from '@/features/profile/SettingsPage';
import { ExchangeHistoryPage } from '@/features/exchange/ExchangeHistoryPage';
import { ExchangeDetailPage } from '@/features/exchange/ExchangeDetailPage';
import { ReviewPage } from '@/features/reviews/ReviewPage';

const router = createBrowserRouter([
  { path: '/', element: <ExplorePage /> },
  { path: '/matches', element: <MatchesPage /> },
  { path: '/chat', element: <ChatListPage /> },
  { path: '/chat/:id', element: <ChatRoomPage /> },
  { path: '/profile', element: <ProfilePage /> },
  { path: '/add-book', element: <AddBookPage /> },
  { path: '/book/:id', element: <BookDetailPage /> },
  { path: '/my-books', element: <MyBooksPage /> },
  { path: '/wishlist', element: <WishlistPage /> },
  { path: '/settings', element: <SettingsPage /> },
  { path: '/exchanges', element: <ExchangeHistoryPage /> },
  { path: '/exchange/:id', element: <ExchangeDetailPage /> },
  { path: '/review/:id', element: <ReviewPage /> },
]);

const AuthWrapper = ({ children }: { children: React.ReactNode }) => {
  const { isLoading } = useAuth();
  
  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-bg-primary">
        <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  
  return <>{children}</>;
};

export const AppRouter = () => (
  <AuthWrapper>
    <RouterProvider router={router} />
  </AuthWrapper>
);
