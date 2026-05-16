import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'REZ Unified CRM - Internal Intelligence Hub',
  description: '⚠️ INTERNAL USE ONLY - For REZ Platform Team Only',
};

/**
 * INTERNAL USE ONLY LAYOUT
 * This layout is for the internal REZ platform team only.
 * All data shown here is internal intelligence and must NOT be exposed to merchants or customers.
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50">
        {/* Internal Use Only Banner */}
        <div className="bg-amber-500 text-amber-950 px-4 py-2 text-center text-sm font-medium">
          ⚠️ INTERNAL USE ONLY - For REZ Platform Team Only ⚠️
          {' | '}
          All data shown is internal intelligence and must NOT be exposed to merchants or customers.
        </div>
        {children}
      </body>
    </html>
  );
}
