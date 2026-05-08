import { useEffect, useRef, useState, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
  /** Drag distance required to trigger refresh (px). Default: 72 */
  threshold?: number;
}

type PTRState = 'idle' | 'pulling' | 'ready' | 'refreshing';

/**
 * Lightweight pull-to-refresh wrapper.
 * Works on the `<Shell>` scroll container via touch events.
 */
export const PullToRefresh = ({
  onRefresh,
  children,
  threshold = 72,
}: PullToRefreshProps) => {
  const [state, setState] = useState<PTRState>('idle');
  const [pullY, setPullY] = useState(0);
  const startYRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    const el = containerRef.current;
    if (!el || el.scrollTop > 0) return; // only when at top
    startYRef.current = e.touches[0]!.clientY;
  }, []);

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (startYRef.current === null) return;
      const deltaY = e.touches[0]!.clientY - startYRef.current;
      if (deltaY <= 0) {
        setPullY(0);
        setState('idle');
        return;
      }
      // Rubber-band damping: diminishing returns after threshold
      const damped = Math.min(deltaY * 0.45, threshold * 1.4);
      setPullY(damped);
      setState(deltaY >= threshold ? 'ready' : 'pulling');
    },
    [threshold],
  );

  const handleTouchEnd = useCallback(async () => {
    if (state === 'ready') {
      setState('refreshing');
      setPullY(threshold * 0.55);
      try {
        await onRefresh();
      } finally {
        setPullY(0);
        setState('idle');
      }
    } else {
      setPullY(0);
      setState('idle');
    }
    startYRef.current = null;
  }, [state, onRefresh, threshold]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove',  handleTouchMove,  { passive: true });
    el.addEventListener('touchend',   handleTouchEnd);
    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove',  handleTouchMove);
      el.removeEventListener('touchend',   handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  const progress = Math.min(pullY / threshold, 1);
  const rotation = progress * 360;

  return (
    <div ref={containerRef} className="h-full overflow-y-auto overscroll-none">
      {/* Indicator */}
      {pullY > 4 && (
        <div
          className="flex items-center justify-center overflow-hidden transition-[height] duration-100"
          style={{ height: pullY }}
        >
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors duration-150 ${
              state === 'ready' || state === 'refreshing'
                ? 'border-accent bg-accent/10 text-accent'
                : 'border-border bg-bg-secondary text-text-muted'
            }`}
            style={{ transform: `rotate(${rotation}deg)` }}
          >
            <RefreshCw
              size={14}
              className={state === 'refreshing' ? 'animate-spin' : ''}
            />
          </div>
        </div>
      )}
      {children}
    </div>
  );
};
