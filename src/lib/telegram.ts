/** Get the Telegram WebApp instance */
export const getTelegram = () => window.Telegram?.WebApp;

const TELEGRAM_HEADER_COLOR = '#ffffff';
const TELEGRAM_BACKGROUND_COLOR = '#ffffff';
const TELEGRAM_BOTTOM_BAR_COLOR = '#ffffff';
const TELEGRAM_MAIN_BUTTON_COLOR = '#08642f';
const TELEGRAM_MAIN_BUTTON_TEXT_COLOR = '#ffffff';

/** Check if running inside Telegram */
export const isTelegramWebApp = () => !!window.Telegram?.WebApp?.initData;

/** Initialize Telegram WebApp */
export const initTelegram = () => {
  const tg = getTelegram();
  if (tg) {
    tg.ready();
    tg.expand();
    tg.setHeaderColor(TELEGRAM_HEADER_COLOR);
    tg.setBackgroundColor(TELEGRAM_BACKGROUND_COLOR);
    tg.setBottomBarColor?.(TELEGRAM_BOTTOM_BAR_COLOR);
    tg.MainButton.setParams({
      color: TELEGRAM_MAIN_BUTTON_COLOR,
      text_color: TELEGRAM_MAIN_BUTTON_TEXT_COLOR,
    });
    // Prevent Telegram swipe-to-close from conflicting with PullToRefresh
    tg.disableVerticalSwipes?.();
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
