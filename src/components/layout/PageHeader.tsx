import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
}

export const PageHeader = ({ title, subtitle, action, className }: PageHeaderProps) => {
  return (
    <div className={cn('flex items-start justify-between px-5 pt-4 pb-2', className)}>
      <div>
        <h1 className="text-[24px] font-bold tracking-tight">{title}</h1>
        {subtitle && (
          <p className="text-[14px] text-text-secondary mt-0.5">{subtitle}</p>
        )}
      </div>
      {action && <div className="flex-shrink-0 pt-1">{action}</div>}
    </div>
  );
};
