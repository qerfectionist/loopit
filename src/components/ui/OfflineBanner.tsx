import { WifiOff } from 'lucide-react';
import { useOnline } from '@/hooks/useOnline';

/**
 * Banner shown when the user loses internet.
 * Always in the DOM — uses pure CSS transform to slide in/out.
 */
export const OfflineBanner = () => {
  const isOnline = useOnline();

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-50 transition-transform duration-300 ease-out ${
        isOnline ? '-translate-y-full' : 'translate-y-0'
      }`}
    >
      <div className="flex items-center gap-2 px-4 py-2.5 bg-warning/95 backdrop-blur-sm">
        <WifiOff size={15} className="text-white shrink-0" />
        <span className="text-[13px] font-medium text-white">
          No internet connection
        </span>
      </div>
    </div>
  );
};
