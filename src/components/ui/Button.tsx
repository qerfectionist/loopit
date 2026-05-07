import { type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { triggerHaptic } from '@/lib/telegram';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  haptic?: boolean;
}

const variants = {
  primary: 'bg-accent text-white hover:bg-accent-hover active:scale-[0.98]',
  secondary: 'bg-bg-tertiary text-text-primary hover:bg-bg-hover active:scale-[0.98]',
  ghost: 'bg-transparent text-text-secondary hover:text-text-primary hover:bg-bg-tertiary',
  danger: 'bg-error-soft text-error hover:bg-error/20 active:scale-[0.98]',
};

const sizes = {
  sm: 'h-8 px-3 text-[13px] gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-[14px] gap-2 rounded-xl',
  lg: 'h-12 px-6 text-[15px] gap-2.5 rounded-xl',
};

export const Button = ({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  loading = false,
  icon,
  haptic = true,
  className,
  children,
  onClick,
  disabled,
  ...props
}: ButtonProps) => {
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (haptic) triggerHaptic('light');
    onClick?.(e);
  };

  return (
    <button
      className={cn(
        'inline-flex items-center justify-center font-medium transition-all',
        'duration-[var(--duration-fast)] ease-[var(--ease-out)]',
        'disabled:opacity-40 disabled:pointer-events-none',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50',
        variants[variant],
        sizes[size],
        fullWidth && 'w-full',
        className,
      )}
      onClick={handleClick}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        <>
          {icon && <span className="flex-shrink-0">{icon}</span>}
          {children}
        </>
      )}
    </button>
  );
};
