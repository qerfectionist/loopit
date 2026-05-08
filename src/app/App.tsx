import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Sentry } from '@/lib/sentry';
import { AppRouter } from './router';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const ErrorFallback = () => (
  <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center">
    <p className="text-[20px] font-bold mb-2">Something went wrong</p>
    <p className="text-[14px] text-text-secondary mb-4">The error has been reported. Please restart the app.</p>
    <button
      onClick={() => window.location.reload()}
      className="px-4 py-2 rounded-xl bg-accent text-white text-[14px] font-medium"
    >
      Reload
    </button>
  </div>
);

export const App = () => {
  return (
    <Sentry.ErrorBoundary fallback={<ErrorFallback />}>
      <QueryClientProvider client={queryClient}>
        <AppRouter />
      </QueryClientProvider>
    </Sentry.ErrorBoundary>
  );
};
