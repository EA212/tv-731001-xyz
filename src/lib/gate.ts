/**
 * 门禁令牌：仅在服务端（middleware / Edge Runtime）引用，禁止从客户端组件导入。
 * 密钥优先取环境变量 GATE_SECRET，未配置时回退到内置默认值，保证站点始终可用。
 */

const DEFAULT_SECRET = 'jilaotv:gate:v1'
const SECRET = process.env.GATE_SECRET || DEFAULT_SECRET

export const GATE_COOKIE = 'jt'
export const TTL = 2 * 60 * 60

const encoder = new TextEncoder()

// importKey 与密钥绑定且不变，进程内复用，避免每个请求重复派生。
let keyPromise: Promise<CryptoKey> | undefined

function hmacKey(): Promise<CryptoKey> {
  if (!keyPromise) {
    keyPromise = crypto.subtle.importKey(
      'raw',
      encoder.encode(SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )
  }
  return keyPromise
}

async function sign(data: string): Promise<string> {
  const buf = await crypto.subtle.sign('HMAC', await hmacKey(), encoder.encode(data))
  return Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('')
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export async function issueToken(now = Date.now()): Promise<string> {
  const exp = String(now + TTL * 1000)
  return `${exp}.${await sign(exp)}`
}

export async function verifyToken(token?: string | null): Promise<boolean> {
  if (!token) return false
  const [exp, signature] = token.split('.')
  if (!/^\d{13}$/.test(exp ?? '') || !/^[0-9a-f]{64}$/.test(signature ?? '')) return false
  if (Number(exp) < Date.now()) return false
  try {
    return timingSafeEqual(signature, await sign(exp))
  } catch {
    return false
  }
}
