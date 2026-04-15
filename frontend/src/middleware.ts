import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (pathname === '/' || pathname.startsWith('/api/')) return NextResponse.next()
  return NextResponse.redirect(new URL('/', request.url))
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|ico|svg|jpg|jpeg|webp|woff|woff2|ttf)$).*)',
  ],
}
