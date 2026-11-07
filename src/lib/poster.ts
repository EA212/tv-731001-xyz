/**
 * 海报解析：静态索引优先 → 缓存 → 同名请求合并 → TMDb 兜底。
 *
 * 与页面组件完全解耦：缓存有 TTL 和容量上限，失败结果会过期重试，
 * 不会像永久 null 缓存那样"网络抖一次就永远缺图"。
 */
import { buildTmdbUrl, TMDB_IMG_URL, toStaticImage } from './tmdb'
import type { MovieItem, StaticData } from './types'

const TTL = 5 * 60_000
const MAX_ENTRIES = 300
const FALLBACK = '/static-images/jilaoTV.jpg'

type Entry = { url: string | null; at: number }

const cache = new Map<string, Entry>()
const inflight = new Map<string, Promise<string | null>>()
let staticIndex = new Map<string, string>()

export { FALLBACK }

export const isBadPic = (p?: string | null): boolean =>
  !p || /mac_default|nopic|undefined/i.test(p)

/** 用整份静态数据一次性重建索引，避免可变的全局 Map 被到处写入。 */
export function setStaticPosters(data: StaticData): void {
  const next = new Map<string, string>()
  const lists: MovieItem[][] = [data.movieList, data.tvList, data.listCn, data.listKrjp]
  for (const list of lists) {
    for (const item of list ?? []) {
      const name = item.title ?? item.name
      if (name && item.poster_path) next.set(name, toStaticImage(item.poster_path))
    }
  }
  staticIndex = next
}

const cleanTitle = (name: string): string =>
  name
    .replace(/第[0-9一二三四五六七八九十]+[季部]/g, '')
    .replace(/Season\s*\d+/gi, '')
    .replace(/S\d{1,2}/gi, '')
    .replace(/(HD|BD|1080P|720P|4K|202\d|TC|TS).*/i, '')
    .trim()

function remember(name: string, url: string | null): void {
  if (cache.size >= MAX_ENTRIES) {
    const oldest = cache.keys().next().value
    if (oldest !== undefined) cache.delete(oldest)
  }
  cache.set(name, { url, at: Date.now() })
}

export function lookupPoster(name: string, signal?: AbortSignal): Promise<string | null> {
  const local = staticIndex.get(name)
  if (local) return Promise.resolve(local)

  const hit = cache.get(name)
  if (hit && Date.now() - hit.at < TTL) return Promise.resolve(hit.url)

  const pending = inflight.get(name)
  if (pending) return pending

  const task = (async () => {
    try {
      // URL 内含 api_key，不要打印或写入日志
      const res = await fetch(
        buildTmdbUrl('/search/multi', { query: cleanTitle(name), language: 'zh-CN' }),
        { signal }
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const results: { poster_path?: string }[] = data.results ?? []
      const found = results.find(r => r.poster_path) ?? results[0]
      const url = found?.poster_path ? `${TMDB_IMG_URL}${found.poster_path}` : null
      remember(name, url)
      return url
    } catch {
      remember(name, null)
      return null
    } finally {
      inflight.delete(name)
    }
  })()

  inflight.set(name, task)
  return task
}
