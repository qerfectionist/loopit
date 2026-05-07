import { clsx, type ClassValue } from 'clsx';

/** Merge class names conditionally */
export const cn = (...inputs: ClassValue[]) => clsx(inputs);

/** Format relative time (e.g., "2 min ago") */
export const formatRelativeTime = (dateStr: string): string => {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diff = now - date;

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
};

/** Format rating (e.g., "4.8") */
export const formatRating = (rating: number): string => {
  return rating.toFixed(1);
};

/** Truncate text with ellipsis */
export const truncate = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + '…';
};

/** Generate initials from name */
export const getInitials = (firstName: string, lastName?: string | null): string => {
  const first = firstName.charAt(0).toUpperCase();
  const last = lastName ? lastName.charAt(0).toUpperCase() : '';
  return first + last;
};

/** Condition label mapping */
export const conditionLabels: Record<string, string> = {
  new: 'New',
  like_new: 'Like New',
  good: 'Good',
  fair: 'Fair',
};

/** Exchange type label mapping */
export const exchangeTypeLabels: Record<string, string> = {
  exchange: 'Exchange',
  sell: 'Sell',
  both: 'Exchange or Sell',
};

/** Condition color mapping */
export const conditionColors: Record<string, string> = {
  new: 'text-green-400',
  like_new: 'text-emerald-400',
  good: 'text-yellow-400',
  fair: 'text-orange-400',
};
