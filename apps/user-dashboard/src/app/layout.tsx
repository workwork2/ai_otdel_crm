import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { Providers } from '@/components/Providers';
import './globals.css';
import './shell.scss';

const inter = Inter({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_ORIGIN ?? 'http://localhost:3000'),
  title: {
    default: 'AI Отдел — платформа лояльности и ИИ-касаний',
    template: '%s · AI Отдел',
  },
  applicationName: 'AI Отдел',
  description:
    'Единая экономика сценариев (EES): база клиентов, QA с ИИ, автоматизации, отчёты и интеграции для retail, услуг и B2B.',
  keywords: [
    'CRM',
    'loyalty',
    'AI маркетинг',
    'EES',
    'удержание клиентов',
    'retail',
    'B2B',
    'WhatsApp',
    'автоматизация',
  ],
  openGraph: {
    type: 'website',
    locale: 'ru_RU',
    siteName: 'AI Отдел',
    title: 'AI Отдел — платформа лояльности и ИИ-касаний',
    description:
      'Выручка после касаний ИИ, анти-скидки, удержание зоны риска и прозрачные тарифы — в одном продукте.',
  },
};

export const viewport: Viewport = {
  themeColor: '#0a0a0c',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={`${inter.variable} h-full`}>
      <body
        className={`${inter.className} antialiased bg-[#0a0a0c] text-zinc-300 h-full overflow-hidden`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
