/**
 * TMDB 请求构造。
 *
 * 设计要点：
 * - 明文密钥不以任何形式出现在源码、环境变量或构建产物里；
 * - share-a / share-b 各自只持有一份随机份额，且互相需要对方的种子才能解开；
 * - 只在真正要发请求的那一刻还原密钥，用完立刻清空中间数组；
 * - 不要把返回的 URL 打印到控制台（URL 里含 api_key）。
 *
 * 边界：这只能挡住静态扫描、代码检索和自动化密钥爬虫。浏览器 Network
 * 面板仍然能看到完整 URL，任何用户都能取得该请求。请配合 key:rotate
 * 定期轮换，并优先使用静态数据模式（USE_STATIC_DATA_ONLY）。
 */
import { SEED_A, SHARE_A } from './share-a'
import { SEED_B, SHARE_B } from './share-b'

export const TMDB_PROXY = 'https://daili.smdhb.com'
export const TMDB_BASE_URL = `${TMDB_PROXY}/3`
export const TMDB_IMG_URL = `${TMDB_PROXY}/t/p/w500`
export const TMDB_BACKDROP_URL = `${TMDB_PROXY}/t/p/original`
export const TMDB_POSTER_SMALL = `${TMDB_PROXY}/t/p/w300`

/** 与 scripts/generate-key-shares.js 中完全一致的伪随机字节流 */
function stream(seed: number, n: number): number[] {
  let x = seed >>> 0
  const out: number[] = []
  for (let i = 0; i < n; i++) {
    x ^= x << 13
    x >>>= 0
    x ^= x >>> 17
    x >>>= 0
    x ^= x << 5
    x >>>= 0
    out.push(x & 0xff)
  }
  return out
}

/** 两个份额相互解锁，还原出密钥明文。明文只存在于本函数栈内。 */
function deriveKey(): string {
  const a = SHARE_A.slice()
  const b = SHARE_B.slice()
  const fromB = stream(SEED_B, a.length)
  const fromA = stream(SEED_A, b.length)
  const chars: number[] = []

  for (let i = 0; i < a.length; i++) {
    const cipher = a[i] ^ fromB[i]
    const mask = b[i] ^ fromA[i]
    chars.push(cipher ^ mask)
  }

  const key = String.fromCharCode(...chars)

  // 缩短明文在内存中的驻留时间
  a.fill(0)
  b.fill(0)
  fromA.fill(0)
  fromB.fill(0)
  chars.fill(0)

  // 份额不匹配时宁可报错，也不要发出带错误 key 的请求
  if (!/^[a-f0-9]{32}$/.test(key)) {
    throw new Error('TMDB 密钥份额不匹配，请重新执行 npm run key:rotate')
  }
  return key
}

/**
 * 构造带密钥的 TMDB 请求地址。
 * 调用方不要 log 返回值，也不要把它写进 state / localStorage / 埋点。
 */
export function buildTmdbUrl(
  path: string,
  params: Record<string, string> = {}
): string {
  const url = new URL(`${TMDB_BASE_URL}${path}`)
  url.searchParams.set('api_key', deriveKey())
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  return url.toString()
}

/** 静态数据里的 poster_path 是本地文件名，转成 /static-images/ 路径 */
export function toStaticImage(posterPath: string): string {
  const filename = posterPath.startsWith('/') ? posterPath.slice(1) : posterPath
  return `/static-images/${filename}`
}
