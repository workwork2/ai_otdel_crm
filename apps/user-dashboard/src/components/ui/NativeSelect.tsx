'use client';

import React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export type NativeSelectProps = Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> & {
  /** Обёртка (relative + min-w-0). */
  className?: string;
  /** Доп. классы на &lt;select&gt;. */
  selectClassName?: string;
  /**
   * filter — боковые панели (мелкий текст);
   * field — формы, настройки;
   * bare — без рамки у select (родитель рисует border).
   */
  variant?: 'filter' | 'field' | 'bare';
};

export const NativeSelect = React.forwardRef<HTMLSelectElement, NativeSelectProps>(
  ({ className, selectClassName, variant = 'filter', disabled, children, ...props }, ref) => {
    const isBare = variant === 'bare';
    return (
      <div className={cn('relative min-w-0 w-full', className)}>
        <select
          ref={ref}
          disabled={disabled}
          className={cn(
            'w-full min-w-0 cursor-pointer appearance-none shadow-none',
            'focus:outline-none disabled:cursor-not-allowed disabled:opacity-45',
            !isBare && 'rounded-lg border border-[#1f1f22] bg-[#121214] text-zinc-200',
            !isBare && 'focus:border-[#3b82f6]/55 focus:ring-1 focus:ring-[#3b82f6]/25',
            variant === 'filter' && 'py-1.5 pl-2.5 pr-8 text-xs min-h-[36px]',
            variant === 'field' && 'py-2 pl-3 pr-9 text-sm min-h-[40px]',
            isBare &&
              'border-0 bg-transparent py-0 pl-0 pr-7 text-sm font-medium text-[#d4d4d8] rounded-none min-h-0 focus:ring-0',
            selectClassName
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          className={cn(
            'pointer-events-none absolute text-zinc-500',
            isBare ? 'right-0 top-1/2 h-3.5 w-3.5 -translate-y-1/2' : 'right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2',
            variant === 'field' && 'h-4 w-4 right-2.5'
          )}
          aria-hidden
        />
      </div>
    );
  }
);
NativeSelect.displayName = 'NativeSelect';
