import { NextResponse, type NextRequest } from 'next/server'
import { verifyToken } from './lib/gate'

export async function middleware(request: NextRequest) {
  const token = request.cookies.get('jt')?.value
  if (await verifyToken(token)) return NextResponse.next()

  const url = request.nextUrl.clone()
  url.pathname = '/'
  url.search = ''
  return NextResponse.redirect(url)
}

export const config = {
  matcher: ['/jilaotv', '/jilaotv/:path*', '/jltv', '/jltv/:path*'],
}
