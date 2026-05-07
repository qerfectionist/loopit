import { type ReactNode } from 'react';
import { BottomNav } from './BottomNav';
import { cn } from '@/lib/utils';

interface ShellProps {
  children: ReactNode;
  hideNav?: boolean;
  className?: string;
}

export const Shell = ({ children, hideNav = false, className }: ShellProps) => {
  return (
    <div className={cn('flex flex-col min-h-dvh', className)}>
      <main className={cn(
        'flex-1 overflow-y-auto',
        !hideNav && 'pb-20', // Space for bottom nav
      )}>
        {children}
      </main>
      {!hideNav && <BottomNav />}
    </div>
  );
};
