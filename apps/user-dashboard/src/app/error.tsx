'use client';

import React from 'react';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isNetwork =
    /fetch|network|failed to load|load failed|connection/i.test(error.message) ||
    error.message.includes('ECONNREFUSED');

  return (
    <div className="flex flex-1 flex-col items-center justify-center min-h-[50vh] px-6 text-center">
      <p className="text-sm font-semibold text-white">Не удалось отобразить раздел</p>
      <p className="text-xs text-zinc-500 mt-2 max-w-md leading-relaxed">
        {isNetwork ? (
          <>
            Похоже, нет связи с API или сервер ещё не запущен. Проверьте{' '}
            <code className="text-zinc-400">npm run dev:api</code> и{' '}
            <code className="text-zinc-400">NEXT_PUBLIC_API_URL</code>.
          </>
        ) : (
          error.message
        )}
      </p>
      {error.digest ? (
        <p className="text-[10px] text-zinc-600 mt-1 font-mono">digest: {error.digest}</p>
      ) : null}
      <div className="mt-6 flex flex-wrap gap-3 justify-center">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-lg bg-zinc-800 border border-zinc-600 px-4 py-2 text-sm text-white hover:bg-zinc-700"
        >
          Попробовать снова
        </button>
        <Link
          href="/"
          className="rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800/80"
        >
          На главную
        </Link>
      </div>
    </div>
  );
}
