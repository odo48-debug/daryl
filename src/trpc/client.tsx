'use client';
import superjson from 'superjson';
import type { QueryClient } from '@tanstack/react-query';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import { createTRPCContext } from '@trpc/tanstack-react-query';
import { useState } from 'react';
import { makeQueryClient } from './query-client';
import type { AppRouter } from './routers/_app';

export const { TRPCProvider } = createTRPCContext<AppRouter>();

let browserQueryClient: QueryClient;
function getQueryClient() {
  if (typeof window === 'undefined') return makeQueryClient();
  if (!browserQueryClient) browserQueryClient = makeQueryClient();
  return browserQueryClient;
}

function getUrl() {
  // Cliente: same-origin para que viajen cookies en www.daryl.bot
  if (typeof window !== 'undefined') return '/api/trpc';
  // Server: usa tu dominio público de prod
  const base =
    process.env.NEXT_PUBLIC_APP_URL /* setea: https://www.daryl.bot */ ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
  return `${base}/api/trpc`;
}

export function TRPCReactProvider({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();

  const [trpcClient] = useState(() =>
    createTRPCClient<AppRouter>({
      links: [
        httpBatchLink({
          url: getUrl(),
          transformer: superjson, // Movido aquí según la nueva API de tRPC
          // ✅ enviar cookies (Clerk) en navegador y SSR
          fetch(url, opts) {
            return fetch(url, { ...opts, credentials: 'include' });
          },
          // (opcional si usas token Bearer en SSR)
          // headers: async () => {
          //   const token = await getToken(); return token ? { Authorization: `Bearer ${token}` } : {};
          // },
        }),
      ],
    })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        {children}
      </TRPCProvider>
    </QueryClientProvider>
  );
}
