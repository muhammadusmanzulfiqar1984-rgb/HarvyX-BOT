import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'HARVYX BOT',
  description: 'HARVYX BOT — premium AI operating interface',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
