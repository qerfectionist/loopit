import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface CardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  padding?: boolean;
  hover?: boolean;
}

export const Card = ({
  children,
  className,
  onClick,
  padding = true,
  hover = false,
}: CardProps) => {
  return (
    <div
      className={cn(
        'bg-bg-secondary rounded-2xl border border-border',
        'transition-all duration-[var(--duration-fast)]',
        padding && 'p-4',
        hover && 'hover:bg-bg-tertiary hover:border-border/80 cursor-pointer active:scale-[0.99]',
        onClick && 'cursor-pointer active:scale-[0.99]',
        className,
      )}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {children}
    </div>
  );
};
