import { useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getTelegram, triggerHaptic, triggerNotification, triggerSelection, showConfirm, showAlert } from '@/lib/telegram';

/** Hook for Telegram WebApp integration */
export const useTelegram = () => {
  const navigate = useNavigate();
  const webapp = getTelegram();
  const backHandlerRef = useRef<(() => void) | null>(null);

  /** Show back button with optional custom handler */
  const showBackButton = useCallback((onBack?: () => void) => {
    if (!webapp) return;

    // Remove previous handler
    if (backHandlerRef.current) {
      webapp.BackButton.offClick(backHandlerRef.current);
    }

    const handler = () => {
      if (onBack) {
        onBack();
      } else {
        navigate(-1);
      }
    };

    backHandlerRef.current = handler;
    webapp.BackButton.onClick(handler);
    webapp.BackButton.show();
  }, [webapp, navigate]);

  /** Hide back button */
  const hideBackButton = useCallback(() => {
    if (!webapp) return;
    if (backHandlerRef.current) {
      webapp.BackButton.offClick(backHandlerRef.current);
      backHandlerRef.current = null;
    }
    webapp.BackButton.hide();
  }, [webapp]);

  /** Cleanup on unmount */
  useEffect(() => {
    return () => {
      if (webapp && backHandlerRef.current) {
        webapp.BackButton.offClick(backHandlerRef.current);
      }
    };
  }, [webapp]);

  return {
    webapp,
    user: webapp?.initDataUnsafe?.user ?? null,
    colorScheme: webapp?.colorScheme ?? 'dark',
    platform: webapp?.platform ?? 'unknown',
    showBackButton,
    hideBackButton,
    haptic: triggerHaptic,
    notification: triggerNotification,
    selection: triggerSelection,
    confirm: showConfirm,
    alert: showAlert,
  };
};
