import * as Sentry from '@sentry/react';

/**
 * Initialize Sentry error tracking.
 * Requires VITE_SENTRY_DSN in .env to activate.
 * No-op if DSN is not set (safe for dev/staging).
 */
export const initSentry = () => {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return; // skip if not configured

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE, // 'development' | 'production'
    release: import.meta.env.VITE_APP_VERSION ?? 'loopit@1.0.0',

    // Capture 100% of errors, 10% of performance traces
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,

    // Ignore noisy browser errors unrelated to our app
    ignoreErrors: [
      'ResizeObserver loop limit exceeded',
      'Network request failed',
      'Load failed',
      'Failed to fetch',
    ],

    beforeSend(event) {
      // Don't send events in development
      if (import.meta.env.DEV) return null;
      return event;
    },
  });
};

/**
 * Capture an exception manually (e.g. in catch blocks).
 * Safe to call even if Sentry is not initialized.
 */
export const captureError = (err: unknown, context?: Record<string, string>) => {
  if (context) {
    Sentry.withScope((scope) => {
      Object.entries(context).forEach(([k, v]) => scope.setTag(k, v));
      Sentry.captureException(err);
    });
  } else {
    Sentry.captureException(err);
  }
};

export { Sentry };
