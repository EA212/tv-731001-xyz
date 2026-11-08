/**
 * 策展空间数据层：类型、请求、会话缓存。
 * 与视图无关，缓存按「主题」隔离，刷新页面不重复消耗 AI token。
 */
import { fetchJson } from './api'
import type { Source } from './types'

export interface CuratedFilm {
  name: string
  year: string
  note: string
  pic: string
  /** 检索脚本补全的真实线路，直接交给主界面播放器，无需再搜索。 */
  sources: Source[]
}

export interface CuratedSpace {
  title: string
  subtitle: string
  tag: string
  intro: string
  ai: boolean
  films: CuratedFilm[]
}

const PREFIX = 'jilaotv:curate:'
const TTL = 30 * 60_000

function readCache(topic: string): CuratedSpace | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(PREFIX + topic)
    if (!raw) return null
    const entry = JSON.parse(raw) as { at: number; data: CuratedSpace }
    if (Date.now() - entry.at > TTL) {
      sessionStorage.removeItem(PREFIX + topic)
      return null
    }
    return entry.data
  } catch {
    return null
  }
}

function writeCache(topic: string, data: CuratedSpace): void {
  try {
    sessionStorage.setItem(PREFIX + topic, JSON.stringify({ at: Date.now(), data }))
  } catch {
    /* 隐私模式或配额满：缓存失败不影响功能 */
  }
}

export function clearCurateCache(topic: string): void {
  try {
    sessionStorage.removeItem(PREFIX + topic)
  } catch {
    /* noop */
  }
}

export async function fetchCurated(
  topic: string,
  signal?: AbortSignal,
  force = false
): Promise<CuratedSpace> {
  const cached = force ? null : readCache(topic)
  if (cached) return cached

  const data = await fetchJson<CuratedSpace & { error?: string }>('/api/curate', signal, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic })
  })
  if (data.error) throw new Error(data.error)
  if (!Array.isArray(data.films) || data.films.length === 0) {
    throw new Error('片单为空，换个主题试试')
  }
  // 归一化：线路缺失时降级为空数组，由视图退回主界面搜索。
  const result: CuratedSpace = {
    ...data,
    films: data.films.map(f => ({ ...f, sources: Array.isArray(f.sources) ? f.sources : [] }))
  }
  writeCache(topic, result)
  return result
}

/** 主题 → 色相，让每个空间有自己的氛围色，纯函数、无需存状态。 */
export function topicHue(topic: string): number {
  let hash = 0
  for (const ch of topic) hash = (hash * 31 + ch.codePointAt(0)!) % 360
  return hash
}
