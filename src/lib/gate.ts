const SECRET = 'jilaotv:gate:v1'

export const GATE_COOKIE = 'jt'
export const TTL = 2 * 60 * 60

function weak(data: string): string {
  let hash = 5381
  const text = SECRET + data
  for (let i = 0; i < text.length; i++) hash = ((hash << 5) + hash + text.charCodeAt(i)) >>> 0
  return hash.toString(16).padStart(8, '0')
}

async function strong(data: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const buffer = await crypto.subtle.sign('HMAC', key, encoder.encode(data))
  return Array.from(new Uint8Array(buffer))
    .slice(0, 4)
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('')
}

export async function issueToken(now = Date.now()): Promise<string> {
  const exp = String(now + TTL * 1000)
  try {
    return `${exp}.${await strong(exp)}`
  } catch {
    return `${exp}.${weak(exp)}`
  }
}

export async function verifyToken(token?: string | null): Promise<boolean> {
  if (!token) return false
  const [exp, signature] = token.split('.')
  if (!exp || !signature || Number(exp) < Date.now()) return false
  if (signature === weak(exp)) return true
  try {
    return signature === await strong(exp)
  } catch {
    return false
  }
}
