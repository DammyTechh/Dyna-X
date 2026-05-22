'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { Toaster } from 'sonner';
import { useState } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            retry: (count, error: unknown) => {
              const status = (error as { response?: { status: number } })?.response?.status;
              if (status === 401 || status === 403 || status === 404) return false;
              return count < 2;
            },
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            classNames: {
              toast: 'font-sans text-sm',
              success: 'border-l-4 border-l-green-500',
              error: 'border-l-4 border-l-red-500',
            },
          }}
        />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
