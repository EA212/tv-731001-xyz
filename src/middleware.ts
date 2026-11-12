import { NextResponse, type NextRequest } from 'next/server'
import { verifyToken } from './lib/gate'

export async function middleware(request: NextRequest) {
  const ok = await verifyToken(request.cookies.get('jt')?.value)
  const isGate = request.nextUrl.pathname === '/'

  if (isGate) {
    if (ok) {
      const url = request.nextUrl.clone()
      url.pathname = '/jilaotv'
      url.search = ''
      return NextResponse.redirect(url)
    }
    return NextResponse.next()
  }

  if (ok) return NextResponse.next()

  const url = request.nextUrl.clone()
  url.pathname = '/'
  url.search = ''
  return NextResponse.redirect(url)
}

export const config = {
  matcher: ['/', '/jilaotv', '/jilaotv/:path*', '/jltv', '/jltv/:path*'],
}
