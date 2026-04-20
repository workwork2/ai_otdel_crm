'use client';

import React from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center min-h-[50vh] px-6 text-center">
      <p className="text-sm font-semibold text-amber-100">Ошибка в Super Admin</p>
      <p className="text-xs text-zinc-500 mt-2 max-w-md break-words">{error.message}</p>
      {error.digest ? (
        <p className="text-[10px] text-zinc-600 mt-1 font-mono">digest: {error.digest}</p>
      ) : null}
      <button
        type="button"
        onClick={() => reset()}
        className="mt-6 rounded-lg bg-amber-950/80 border border-amber-800/50 px-4 py-2 text-sm text-amber-100 hover:bg-amber-900/80"
      >
        Попробовать снова
      </button>
    </div>
  );
}
