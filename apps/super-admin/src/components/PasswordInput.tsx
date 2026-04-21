'use client';

import React, { useId, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  className?: string;
  inputClassName?: string;
};

export function PasswordInput({ className, inputClassName, id, autoComplete, ...rest }: Props) {
  const uid = useId();
  const inputId = id ?? uid;
  const [show, setShow] = useState(false);

  return (
    <div className={cn('relative flex items-center', className)}>
      <input
        id={inputId}
        type={show ? 'text' : 'password'}
        autoComplete={autoComplete}
        {...rest}
        className={cn(
          'w-full rounded-lg border border-zinc-700 bg-zinc-900 text-white placeholder:text-zinc-600 px-3 py-2 pr-10 text-sm',
          'outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20',
          'disabled:opacity-50',
          inputClassName
        )}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setShow((s) => !s)}
        className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-zinc-500 hover:text-amber-200/90 hover:bg-zinc-800"
        aria-label={show ? 'Скрыть пароль' : 'Показать пароль'}
      >
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}
