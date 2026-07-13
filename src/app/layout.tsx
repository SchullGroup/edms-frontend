import type { Metadata } from 'next';
import { UIProviders } from '@/components/ui/UIProviders';
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
        <div id="app">{children}</div>
        <UIProviders />
      </body>
    </html>
  );
}
