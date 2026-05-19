/** Get the Telegram WebApp instance */
export const getTelegram = () => window.Telegram?.WebApp;

const TELEGRAM_HEADER_COLOR = '#ffffff';
const TELEGRAM_BACKGROUND_COLOR = '#ffffff';
const TELEGRAM_BOTTOM_BAR_COLOR = '#ffffff';
const TELEGRAM_MAIN_BUTTON_COLOR = '#08642f';
const TELEGRAM_MAIN_BUTTON_TEXT_COLOR = '#ffffff';
const DEFAULT_VIEWPORT_HEIGHT = '100dvh';
const telegramBotUsername = (import.meta.env.VITE_TELEGRAM_BOT_USERNAME as string | undefined)?.replace(/^@/, '');
const telegramMiniAppName = import.meta.env.VITE_TELEGRAM_MINI_APP_NAME as string | undefined;

const setCssVar = (name: string, value: string | number | undefined) => {
  if (value === undefined || value === null) return;
  document.documentElement.style.setProperty(name, typeof value === 'number' ? `${value}px` : value);
};

const supportsTelegramVersion = (version: string) => {
  const tg = getTelegram();
  if (!tg) return false;

  try {
    return typeof tg.isVersionAtLeast === 'function' ? tg.isVersionAtLeast(version) : false;
  } catch {
    return false;
  }
};

export const applyTelegramCssVars = () => {
  const tg = getTelegram();

  setCssVar('--loopit-viewport-height', tg?.viewportHeight ? `${tg.viewportHeight}px` : DEFAULT_VIEWPORT_HEIGHT);
  setCssVar(
    '--loopit-viewport-stable-height',
    tg?.viewportStableHeight ? `${tg.viewportStableHeight}px` : DEFAULT_VIEWPORT_HEIGHT,
  );

  setCssVar('--loopit-safe-top', tg?.safeAreaInset?.top ?? 'env(safe-area-inset-top, 0px)');
  setCssVar('--loopit-safe-bottom', tg?.safeAreaInset?.bottom ?? 'env(safe-area-inset-bottom, 0px)');
  setCssVar('--loopit-safe-left', tg?.safeAreaInset?.left ?? 'env(safe-area-inset-left, 0px)');
  setCssVar('--loopit-safe-right', tg?.safeAreaInset?.right ?? 'env(safe-area-inset-right, 0px)');

  setCssVar('--loopit-content-safe-top', tg?.contentSafeAreaInset?.top ?? '0px');
  setCssVar('--loopit-content-safe-bottom', tg?.contentSafeAreaInset?.bottom ?? '0px');
  setCssVar('--loopit-content-safe-left', tg?.contentSafeAreaInset?.left ?? '0px');
  setCssVar('--loopit-content-safe-right', tg?.contentSafeAreaInset?.right ?? '0px');

  setCssVar('--loopit-tg-bg', tg?.themeParams?.bg_color ?? TELEGRAM_BACKGROUND_COLOR);
  setCssVar('--loopit-tg-secondary-bg', tg?.themeParams?.secondary_bg_color ?? '#f8fafc');
  setCssVar('--loopit-tg-text', tg?.themeParams?.text_color ?? '#101828');
  setCssVar('--loopit-tg-hint', tg?.themeParams?.hint_color ?? '#667085');
  setCssVar('--loopit-tg-button', tg?.themeParams?.button_color ?? TELEGRAM_MAIN_BUTTON_COLOR);
  setCssVar('--loopit-tg-button-text', tg?.themeParams?.button_text_color ?? TELEGRAM_MAIN_BUTTON_TEXT_COLOR);
};

const applyTelegramShellColors = () => {
  const tg = getTelegram();
  if (!tg) return;

  try {
    tg.setHeaderColor(TELEGRAM_HEADER_COLOR);
    tg.setBackgroundColor(TELEGRAM_BACKGROUND_COLOR);
    if (supportsTelegramVersion('7.10')) {
      tg.setBottomBarColor?.(TELEGRAM_BOTTOM_BAR_COLOR);
    }
    tg.MainButton?.setParams({
      color: TELEGRAM_MAIN_BUTTON_COLOR,
      text_color: TELEGRAM_MAIN_BUTTON_TEXT_COLOR,
    });
  } catch {
    // Telegram clients differ by version; theme setup is non-critical.
  }
};

/** Check if running inside Telegram */
export const isTelegramWebApp = () => !!window.Telegram?.WebApp?.initData;

/** Initialize Telegram WebApp */
export const initTelegram = () => {
  const tg = getTelegram();
  applyTelegramCssVars();

  if (tg) {
    tg.ready();
    tg.expand();
    applyTelegramShellColors();
    // Prevent Telegram swipe-to-close from conflicting with PullToRefresh
    if (supportsTelegramVersion('7.7')) {
      tg.disableVerticalSwipes?.();
    }

    const refreshTelegramLayout = () => {
      applyTelegramCssVars();
      applyTelegramShellColors();
    };

    tg.onEvent?.('viewportChanged', refreshTelegramLayout);
    tg.onEvent?.('themeChanged', refreshTelegramLayout);
    tg.onEvent?.('safeAreaChanged', refreshTelegramLayout);
    tg.onEvent?.('contentSafeAreaChanged', refreshTelegramLayout);
  }

  return tg;
};

/** Get the current Telegram user */
export const getTelegramUser = () => {
  return getTelegram()?.initDataUnsafe?.user ?? null;
};

export const getTelegramStartParam = () => {
  const fromInitData = getTelegram()?.initDataUnsafe?.start_param;
  if (fromInitData) return fromInitData;

  return new URLSearchParams(window.location.search).get('tgWebAppStartParam');
};

export const createMiniAppUrl = (startParam: string, fallbackPath = '/') => {
  if (telegramBotUsername && telegramMiniAppName) {
    return `https://t.me/${telegramBotUsername}/${telegramMiniAppName}?startapp=${encodeURIComponent(startParam)}`;
  }

  return new URL(fallbackPath, window.location.origin).toString();
};

export const createBookShareUrl = (bookId: string) => createMiniAppUrl(`book_${bookId}`, `/book/${bookId}`);

export const shareToTelegram = (url: string, text: string) => {
  const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
  const tg = getTelegram();

  if (tg) {
    tg.openTelegramLink(shareUrl);
    return;
  }

  window.open(shareUrl, '_blank', 'noopener,noreferrer');
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
