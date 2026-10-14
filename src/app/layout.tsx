import type { Metadata } from 'next';
import { UIProviders } from '@/components/ui/UIProviders';
import ReactQueryProvider from '@/lib/react-query-provider';
import { Geist } from 'next/font/google';
import { getBrandCssVars, getBrandPreset } from '@/lib/brand';
import './globals.css';

const geist = Geist({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-geist',
});

const brand = getBrandPreset();

export const metadata: Metadata = {
  title: brand.appName,
  description: 'A complete, role-based Electronic Document Management System',
  icons: {
    icon: brand.faviconUrl,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={geist.variable} style={getBrandCssVars() as React.CSSProperties}>
      <body>
        <ReactQueryProvider>
          <div id="app">{children}</div>
          <UIProviders />
        </ReactQueryProvider>
      </body>
    </html>
  );
}
