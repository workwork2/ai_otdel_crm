import { cn } from '@/lib/utils';

export type CrmPageWidth = 'narrow' | 'std' | 'wide';

type CrmPageProps = {
  width?: CrmPageWidth;
  className?: string;
  children: React.ReactNode;
};

/**
 * Единая прокручиваемая область контента CRM: те же отступы и max-width, что на Главной, Автоматизации, Тарифе и т.д.
 */
export function CrmPage({ width = 'std', className, children }: CrmPageProps) {
  return (
    <div
      className={cn(
        'crm-page custom-scrollbar fade-in',
        width === 'narrow' && 'crm-page--narrow',
        width === 'std' && 'crm-page--std',
        width === 'wide' && 'crm-page--wide',
        className
      )}
    >
      {children}
    </div>
  );
}
