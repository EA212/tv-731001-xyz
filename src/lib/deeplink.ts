/** 分享深链与站内回跳：纯计算，可被 Edge middleware 与客户端组件同时引用。 */

const SITE_KEY = /^[a-z0-9][a-z0-9_-]{0,31}$/
const VOD_ID = /^[A-Za-z0-9_-]{1,64}$/
const MAX_NEXT = 2048
const ALLOWED = ['/jilaotv', '/jltv']

export interface SourceLike {
  site_key: string
  vod_id: string | number
  site_name?: string
}

export interface ShareTarget {
  name: string
  sid: string
  siteKey: string
  vodId: string
  siteName: string
}

/** 生成稳定指针「站点代号:影片编号」；不合法返回空串，降级为片名兜底。 */
export function buildSid(source?: SourceLike): string {
  if (!source) return ''
  const key = String(source.site_key)
  const id = String(source.vod_id)
  if (!SITE_KEY.test(key) || !VOD_ID.test(id)) return ''
  return `${key}:${id}`
}

/** 把定位线索写进 URL：只写线索，绝不写播放地址或结果列表。 */
export function applyShareParams(p: URLSearchParams, name: string, source?: SourceLike): void {
  p.set('d', name)
  const sid = buildSid(source)
  if (!sid) {
    p.delete('sid')
    p.delete('sn')
    return
  }
  p.set('sid', sid)
  if (source?.site_name) p.set('sn', source.site_name)
  else p.delete('sn')
}

/** 清除定位线索，保留 q / space / topic / mode。 */
export function clearShareParams(p: URLSearchParams): void {
  p.delete('d')
  p.delete('sid')
  p.delete('sn')
}

/** 读出并严格校验定位线索；缺 d 或 sid 非法一律返回 null（fail-closed）。 */
export function readShareTarget(p: URLSearchParams): ShareTarget | null {
  const name = (p.get('d') ?? '').trim()
  const sid = p.get('sid') ?? ''
  if (!name || name.length > 120 || !sid) return null
  const i = sid.indexOf(':')
  if (i < 1) return null
  const siteKey = sid.slice(0, i)
  const vodId = sid.slice(i + 1)
  if (!SITE_KEY.test(siteKey) || !VOD_ID.test(vodId)) return null
  return { name, sid, siteKey, vodId, siteName: (p.get('sn') ?? '').slice(0, 40) }
}

/** 回跳目标白名单校验，防开放重定向：只接受站内受保护路径。 */
export function sanitizeNext(raw?: string | null): string | null {
  if (!raw || raw.length > MAX_NEXT) return null
  if (!raw.startsWith('/') || raw.startsWith('//')) return null
  if (/[\\\u0000-\u001f\u007f]/.test(raw)) return null
  try {
    const u = new URL(raw, 'https://local.invalid')
    const path = u.pathname
    if (u.protocol !== 'https:' || u.host !== 'local.invalid') return null
    if (!ALLOWED.some(pre => path === pre || path.startsWith(`${pre}/`))) return null
    const out = path + u.search
    return out.length <= MAX_NEXT ? out : null
  } catch {
    return null
  }
}
