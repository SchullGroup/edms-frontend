import type { Metadata } from 'next';
import { UIProviders } from '@/components/ui/UIProviders';
import ReactQueryProvider from '@/lib/react-query-provider';
import { Geist } from 'next/font/google';
import './globals.css';

const geist = Geist({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-geist',
});

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
    <html lang="en" className={geist.variable}>
      <body>
        <ReactQueryProvider>
          <div id="app">{children}</div>
          <UIProviders />
        </ReactQueryProvider>
      </body>
    </html>
  );
}
