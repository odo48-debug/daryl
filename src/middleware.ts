import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Definir rutas públicas que no requieren autenticación
const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api(.*)",
  "/pricing(.*)",
]);

// Middleware personalizado para manejar casos especiales como videos
function handleFileAccess(req: NextRequest): boolean {
  return req.nextUrl.pathname.endsWith('.webm');
}

// Middleware de Clerk usando la API estándar
export default clerkMiddleware(async (auth, req: NextRequest) => {
  // Si es un archivo especial como un video, permitir acceso
  if (handleFileAccess(req)) {
    return NextResponse.next();
  }
  
  // Crear una respuesta que podemos modificar
  const response = NextResponse.next();
  
  // Configurar headers para cookies SameSite=None y Secure
  // Esto ayuda con la autenticación entre dominios
  response.headers.set('Set-Cookie', 'SameSite=None; Secure');
  
  // Para rutas normales, seguir el flujo estándar
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
  
  return response;
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
    // Asegurarse de incluir el video webm para que podamos manejarlo en el middleware
    '/(.*)\.webm',
  ],
};