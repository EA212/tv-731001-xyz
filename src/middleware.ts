import { NextResponse, type NextRequest } from 'next/server'
import { GATE_COOKIE, TTL, issueToken, verifyToken } from './lib/gate'
import { sanitizeNext } from './lib/deeplink'

const UNLOCK_PATH = '/api/unlock'

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl

  // 解锁端点：密钥只在服务端，签发后以 HttpOnly cookie 下发，前端永远拿不到。
  if (pathname === UNLOCK_PATH) {
    if (request.method !== 'POST') {
      return new NextResponse(null, { status: 405, headers: { Allow: 'POST' } })
    }
    // Fetch Metadata 由浏览器强制附加、脚本无法伪造；缺失时按旧浏览器放行。
    if (request.headers.get('sec-fetch-site') === 'cross-site') {
      return new NextResponse(null, { status: 403 })
    }

    const token = await issueToken()
    const res = NextResponse.json(
      { ok: true },
      { headers: { 'Cache-Control': 'no-store' } }
    )
    res.cookies.set({
      name: GATE_COOKIE,
      value: token,
      httpOnly: true,
      secure: request.nextUrl.protocol === 'https:',
      sameSite: 'lax',
      path: '/',
      maxAge: TTL,
    })
    return res
  }

  const ok = await verifyToken(request.cookies.get(GATE_COOKIE)?.value)
  const isGate = pathname === '/'

  if (isGate) {
    if (!ok) return NextResponse.next()
    // 已解锁：优先跳回分享链接里的原始目标，否则回默认首页。
    const dest = sanitizeNext(request.nextUrl.searchParams.get('next')) ?? '/jilaotv'
    return NextResponse.redirect(new URL(dest, request.url))
  }

  if (ok) return NextResponse.next()

  // 未解锁：完整 pathname+search 装进 next，解锁后原样跳回，绝不丢参数。
  const url = request.nextUrl.clone()
  url.pathname = '/'
  url.search = ''
  url.searchParams.set('next', pathname + search)
  return NextResponse.redirect(url)
}

export const config = {
  matcher: ['/', '/api/unlock', '/jilaotv', '/jilaotv/:path*', '/jltv', '/jltv/:path*'],
}
