/** Get the Telegram WebApp instance */
export const getTelegram = () => window.Telegram?.WebApp;

/** Check if running inside Telegram */
export const isTelegramWebApp = () => !!window.Telegram?.WebApp?.initData;

/** Initialize Telegram WebApp */
export const initTelegram = () => {
  const tg = getTelegram();
  if (tg) {
    tg.ready();
    tg.expand();
    tg.setHeaderColor('#0A0A0A');
    tg.setBackgroundColor('#0A0A0A');
  }
  return tg;
};

/** Get the current Telegram user */
export const getTelegramUser = () => {
  return getTelegram()?.initDataUnsafe?.user ?? null;
};

/** Haptic impact (vibration) */
export const triggerHaptic = (style: 'light' | 'medium' | 'heavy' = 'light') => {
  getTelegram()?.HapticFeedback?.impactOccurred(style);
};

/** Haptic notification feedback */
export const triggerNotification = (type: 'success' | 'warning' | 'error') => {
  getTelegram()?.HapticFeedback?.notificationOccurred(type);
};

/** Selection haptic */
export const triggerSelection = () => {
  getTelegram()?.HapticFeedback?.selectionChanged();
};

/** Show native Telegram confirm dialog */
export const showConfirm = (message: string): Promise<boolean> => {
  return new Promise((resolve) => {
    const tg = getTelegram();
    if (tg) {
      tg.showConfirm(message, (confirmed: boolean) => resolve(confirmed));
    } else {
      resolve(confirm(message));
    }
  });
};

/** Show native Telegram alert */
export const showAlert = (message: string): Promise<void> => {
  return new Promise((resolve) => {
    const tg = getTelegram();
    if (tg) {
      tg.showAlert(message, () => resolve());
    } else {
      alert(message);
      resolve();
    }
  });
};
