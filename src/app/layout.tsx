import type { Metadata } from 'next';
import { UIProviders } from '@/components/ui/UIProviders';
import ReactQueryProvider from '@/lib/react-query-provider';
import './globals.css';

export const metadata: Metadata = {
  title: 'SchullTech EDMS',
  description: 'A complete, role-based Electronic Document Management System',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <ReactQueryProvider>
          <div id="app">{children}</div>
          <UIProviders />
        </ReactQueryProvider>
      </body>
    </html>
  );
}
