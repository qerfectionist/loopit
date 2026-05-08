import { lazy, Suspense } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';
import { OfflineBanner } from '@/components/ui';

// Eager — first screen, must render immediately
import { ExplorePage } from '@/features/explore/ExplorePage';

// Lazy — loaded only when route is visited
const MatchesPage         = lazy(() => import('@/features/matching/MatchesPage').then(m => ({ default: m.MatchesPage })));
const ChatListPage        = lazy(() => import('@/features/chat/ChatListPage').then(m => ({ default: m.ChatListPage })));
const ChatRoomPage        = lazy(() => import('@/features/chat/ChatRoomPage').then(m => ({ default: m.ChatRoomPage })));
const ProfilePage         = lazy(() => import('@/features/profile/ProfilePage').then(m => ({ default: m.ProfilePage })));
const AddBookPage         = lazy(() => import('@/features/books/AddBookPage').then(m => ({ default: m.AddBookPage })));
const BookDetailPage      = lazy(() => import('@/features/books/BookDetailPage').then(m => ({ default: m.BookDetailPage })));
const MyBooksPage         = lazy(() => import('@/features/books/MyBooksPage').then(m => ({ default: m.MyBooksPage })));
const WishlistPage        = lazy(() => import('@/features/wishlist/WishlistPage').then(m => ({ default: m.WishlistPage })));
const SettingsPage        = lazy(() => import('@/features/profile/SettingsPage').then(m => ({ default: m.SettingsPage })));
const ExchangeHistoryPage = lazy(() => import('@/features/exchange/ExchangeHistoryPage').then(m => ({ default: m.ExchangeHistoryPage })));
const ExchangeDetailPage  = lazy(() => import('@/features/exchange/ExchangeDetailPage').then(m => ({ default: m.ExchangeDetailPage })));
const ReviewPage          = lazy(() => import('@/features/reviews/ReviewPage').then(m => ({ default: m.ReviewPage })));

const PageLoader = () => (
  <div className="flex h-screen w-full items-center justify-center bg-bg-primary">
    <Loader2 className="w-7 h-7 animate-spin text-accent" />
  </div>
);

const router = createBrowserRouter([
  { path: '/',              element: <ExplorePage /> },
  { path: '/matches',       element: <Suspense fallback={<PageLoader />}><MatchesPage /></Suspense> },
  { path: '/chat',          element: <Suspense fallback={<PageLoader />}><ChatListPage /></Suspense> },
  { path: '/chat/:id',      element: <Suspense fallback={<PageLoader />}><ChatRoomPage /></Suspense> },
  { path: '/profile',       element: <Suspense fallback={<PageLoader />}><ProfilePage /></Suspense> },
  { path: '/add-book',      element: <Suspense fallback={<PageLoader />}><AddBookPage /></Suspense> },
  { path: '/book/:id',      element: <Suspense fallback={<PageLoader />}><BookDetailPage /></Suspense> },
  { path: '/my-books',      element: <Suspense fallback={<PageLoader />}><MyBooksPage /></Suspense> },
  { path: '/wishlist',      element: <Suspense fallback={<PageLoader />}><WishlistPage /></Suspense> },
  { path: '/settings',      element: <Suspense fallback={<PageLoader />}><SettingsPage /></Suspense> },
  { path: '/exchanges',     element: <Suspense fallback={<PageLoader />}><ExchangeHistoryPage /></Suspense> },
  { path: '/exchange/:id',  element: <Suspense fallback={<PageLoader />}><ExchangeDetailPage /></Suspense> },
  { path: '/review/:id',    element: <Suspense fallback={<PageLoader />}><ReviewPage /></Suspense> },
]);

const AuthWrapper = ({ children }: { children: React.ReactNode }) => {
  const { isLoading } = useAuth();
  if (isLoading) return <PageLoader />;
  return <>{children}</>;
};

export const AppRouter = () => (
  <AuthWrapper>
    {/* Global offline banner — visible across all routes */}
    <OfflineBanner />
    <RouterProvider router={router} />
  </AuthWrapper>
);
