import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Sidebar } from '@/components/sidebar';
import { Providers } from './providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'AgentOS',
  description: 'AgentOS - single Agent MVP',
  icons: {
    icon: '/brand/document-link.svg',
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <Providers>
          <div className="flex h-screen overflow-hidden">
            <Sidebar />
            <main className="min-w-0 flex-1 overflow-hidden">{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
