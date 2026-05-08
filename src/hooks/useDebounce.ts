import { useState, useEffect } from 'react';

/**
 * Debounces a value by delaying updates until after `delay` ms have passed
 * since the last change. Prevents excessive API calls on rapid input.
 */
export const useDebounce = <T>(value: T, delay = 300): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
};
