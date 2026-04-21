'use client';

import React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export type SaNativeSelectProps = Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> & {
  className?: string;
  selectClassName?: string;
  /** sm — строки таблицы; md — формы (новая организация). */
  size?: 'sm' | 'md';
};

export const NativeSelect = React.forwardRef<HTMLSelectElement, SaNativeSelectProps>(
  ({ className, selectClassName, size = 'sm', disabled, children, ...props }, ref) => (
    <div className={cn('relative min-w-0 inline-block max-w-full align-middle', className)}>
      <select
        ref={ref}
        disabled={disabled}
        className={cn(
          'w-full min-w-0 cursor-pointer appearance-none shadow-none rounded-md',
          'border border-zinc-700 bg-zinc-900/80 text-zinc-200',
          'focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20',
          'disabled:cursor-not-allowed disabled:opacity-45',
          size === 'sm' && 'py-1.5 pl-2 pr-7 text-[11px] min-h-[32px]',
          size === 'md' && 'py-2.5 pl-3 pr-9 text-sm min-h-[44px]',
          selectClassName
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className={cn(
          'pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-zinc-500',
          size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5 right-2'
        )}
        aria-hidden
      />
    </div>
  )
);
NativeSelect.displayName = 'SaNativeSelect';
