/** 策展数据层：类型、请求、会话缓存。与视图无关。 */
import { fetchJson } from './api'
import type { Source } from './types'

export type SpaceLayout = 'gallery' | 'spotlight'

export interface CuratedFilm {
  name: string
  year: string
  note: string
  pic: string
  /** 检索补全的真实线路，直接交给主界面播放器。 */
  sources: Source[]
}

export interface CuratedSpace {
  /** 氛围短句，如 A QUIET CATASTROPHE */
  eyebrow: string
  title: string
  subtitle: string
  tag: string
  /** 主题色，AI 给十六进制；空串表示按主题哈希生成 */
  accent: string
  layout: SpaceLayout
  intro: string
  ai: boolean
  films: CuratedFilm[]
}

const PREFIX = 'jilaotv:curate:v2:' // v2 起增加配色与版式，旧缓存作废
const TTL = 30 * 60_000

/** 主题 → 色相，纯函数，用于 AI 没给颜色时的回退。 */
export function topicHue(topic: string): number {
  let hash = 0
  for (const ch of topic) hash = (hash * 31 + ch.codePointAt(0)!) % 360
  return hash
}

/** 相对亮度，用于给主题色挑一个对比度更高的文字色。 */
function luminance(r: number, g: number, b: number): number {
  const channel = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const hp = (((h % 360) + 360) % 360) / 60
  const x = c * (1 - Math.abs((hp % 2) - 1))
  const [r, g, b] =
    hp < 1 ? [c, x, 0]
    : hp < 2 ? [x, c, 0]
    : hp < 3 ? [0, c, x]
    : hp < 4 ? [0, x, c]
    : hp < 5 ? [x, 0, c]
    : [c, 0, x]
  const m = l - c / 2
  return [r + m, g + m, b + m]
}

/**
 * 把 AI 给的颜色压进可读区间：明度 50–66%、饱和度 48–88%。
 * 再按白字对比度决定按钮用黑字还是白字。
 */
export function accentFrom(hex: string, hue: number): { accent: string; ink: string } {
  const match = /^#([0-9a-f]{6})$/i.exec(String(hex).trim())

  let h = hue
  let sat = 68
  let lit = 58

  if (match) {
    const n = parseInt(match[1], 16)
    const r = ((n >> 16) & 255) / 255
    const g = ((n >> 8) & 255) / 255
    const b = (n & 255) / 255
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    const l = (max + min) / 2
    const d = max - min
    const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1))

    if (s >= 0.12) {
      if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60
      else if (max === g) h = ((b - r) / d + 2) * 60
      else h = ((r - g) / d + 4) * 60
      sat = Math.round(Math.min(88, Math.max(48, s * 100)))
      lit = Math.round(Math.min(66, Math.max(50, l * 100)))
    }
  }

  const [fr, fg, fb] = hslToRgb(h, sat / 100, lit / 100)
  const ink = 1.05 / (luminance(fr, fg, fb) + 0.05) >= 4.5 ? '#ffffff' : '#101010'
  return { accent: `hsl(${Math.round(h)} ${sat}% ${lit}%)`, ink }
}

const normalize = (data: CuratedSpace): CuratedSpace => ({
  eyebrow: data.eyebrow ?? '',
  title: data.title || '私人影展',
  subtitle: data.subtitle ?? '',
  tag: data.tag || '私人策展',
  accent: data.accent ?? '',
  layout: data.layout === 'spotlight' ? 'spotlight' : 'gallery',
  intro: data.intro ?? '',
  ai: Boolean(data.ai),
  films: (data.films ?? []).map(film => ({
    ...film,
    sources: Array.isArray(film.sources) ? film.sources : []
  }))
})

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
    return normalize(entry.data)
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

  const result = normalize(data)
  writeCache(topic, result)
  return result
}
