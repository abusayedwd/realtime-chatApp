import { NextRequest, NextResponse } from 'next/server'

/**
 * Route protection based on the `refreshToken` HTTP-only cookie.
 * (The access token lives in memory / Redux, so we can't check it here.)
 *
 * This is a first-line guard — real enforcement happens on the API.
 */
const PUBLIC_PATHS = ['/login', '/register', '/verify-email']

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const refreshToken = req.cookies.get('refreshToken')?.value

  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p))

  if (!refreshToken && !isPublic) {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('from', pathname)
    return NextResponse.redirect(url)
  }

  if (refreshToken && isPublic) {
    const url = req.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next|api|favicon.ico|.*\\..*).*)'],
}
