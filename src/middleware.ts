import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api(.*)",
  "/pricing(.*)",
]);

// Middleware de Clerk usando la API estándar
export default clerkMiddleware(async (auth, req: NextRequest) => {
  // Añadir headers para CORS y cookies
  const response = NextResponse.next();
  
  // Configurar headers para cookies SameSite=None y Secure
  // Esto ayuda con la autenticación entre dominios
  response.headers.set('Set-Cookie', 'SameSite=None; Secure');
  
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
  
  return response;
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webm|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};