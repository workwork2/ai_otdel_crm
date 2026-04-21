import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { ShellSwitcher } from '@/components/shell/ShellSwitcher';
import './globals.css';
import './shell.scss';
import './super-theme.css';

const inter = Inter({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Control Plane — AI Отдел',
    template: '%s · Super Admin',
  },
  applicationName: 'AI Отдел · Super Admin',
  description:
    'Единая панель управления: арендаторы, тарифы, MRR, ИИ-хаб, мониторинг очередей и поддержка.',
  robots: { index: false, follow: false },
  openGraph: {
    title: 'AI Отдел — Super Admin',
    description: 'Внутренняя консоль для команды продукта.',
    type: 'website',
    locale: 'ru_RU',
  },
};

export const viewport: Viewport = {
  themeColor: '#0c0a09',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={`${inter.variable} h-full`}>
      <body
        className={`${inter.className} antialiased sa-mesh text-zinc-300 h-full overflow-hidden`}
      >
        <ShellSwitcher>{children}</ShellSwitcher>
      </body>
    </html>
  );
}
