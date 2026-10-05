import type { Metadata } from 'next';

/**
 * This route sits outside the `(app)` group on purpose: it is public, so it
 * gets neither the application shell nor the sign-in guard. Keep the content
 * at product level — see the notice at the top of `data.ts`.
 */
export const metadata: Metadata = {
  title: 'Product Guide — SchullTech EDMS',
  description:
    'How a document moves through SchullTech EDMS: the six roles, the setup flow, the life of a document, and what is available today.',
};

export default function ProductGuideLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
