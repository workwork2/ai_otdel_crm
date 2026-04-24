import { Suspense } from 'react';
import { QA } from '@/views/QA';

export default function QAPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-[#71717a]">Загрузка…</div>}>
      <QA />
    </Suspense>
  );
}
