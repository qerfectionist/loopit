import { type InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-[13px] font-medium text-text-secondary"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'w-full h-11 px-3.5 rounded-xl text-[15px]',
            'bg-bg-tertiary text-text-primary placeholder-text-muted',
            'border border-border focus:border-accent',
            'outline-none transition-colors duration-[var(--duration-fast)]',
            error && 'border-error focus:border-error',
            className,
          )}
          {...props}
        />
        {error && (
          <p className="text-[12px] text-error">{error}</p>
        )}
        {hint && !error && (
          <p className="text-[12px] text-text-muted">{hint}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
