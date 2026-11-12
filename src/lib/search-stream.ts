/**
 * 搜索流式消费：NDJSON 逐批回调，首批到达即可渲染，不必等最慢的采集站。
 *
 * 三层兜底，功能永不坏：
 *  1. 端点返回普通 JSON（被兜底路由接管）→ 就地解析，不额外发请求；
 *  2. 环境不支持 ReadableStream / 首字节超时 / 网络异常 → 降级到一次性 /api/search；
 *  3. 已收到部分批次后失败 → 保留已有结果，不重复请求、不重复渲染。
 */
import { fetchJson } from './api'
import type { SearchResult } from './types'

const STREAM_PATH = '/api/search-stream'
const FALLBACK_PATH = '/api/search'
const FIRST_BYTE_TIMEOUT = 10_000

export interface StreamStats {
  total: number
  sites: number
  arrived: number
  failed: number
  elapsed: number
  truncated?: boolean
  aborted?: boolean
  error?: boolean
}

interface Handlers {
  onBatch: (items: SearchResult[], site: string) => void
  onDone?: (stats: StreamStats) => void
  signal?: AbortSignal
}

const EMPTY_STATS: StreamStats = { total: 0, sites: 0, arrived: 0, failed: 0, elapsed: 0 }

/** 解析一行 NDJSON；batch 交给上层累加，done 返回统计并结束。 */
function parseLine(line: string): { type: 'batch'; items: SearchResult[]; site: string } | { type: 'done'; stats: StreamStats } | null {
  let event: Record<string, unknown>
  try { event = JSON.parse(line) as Record<string, unknown> } catch { return null }
  if (event.type === 'batch' && Array.isArray(event.items)) {
    return { type: 'batch', items: event.items as SearchResult[], site: String(event.site ?? '') }
  }
  if (event.type === 'done') {
    return { type: 'done', stats: { ...EMPTY_STATS, ...(event as object) } as StreamStats }
  }
  return null
}

async function consume(wd: string, signal: AbortSignal | undefined, onBatch: Handlers['onBatch'], onDone: Handlers['onDone']) {
  const ctrl = new AbortController()
  const forward = () => ctrl.abort()
  signal?.addEventListener('abort', forward, { once: true })
  const timer = setTimeout(() => ctrl.abort(), FIRST_BYTE_TIMEOUT)

  try {
    const res = await fetch(`${STREAM_PATH}?wd=${encodeURIComponent(wd)}`, { signal: ctrl.signal })
    if (!res.ok || !res.body) throw new Error('stream unavailable')

    const type = res.headers.get('content-type') ?? ''
    if (!type.includes('ndjson')) {
      const data = (await res.json()) as { list?: SearchResult[] }
      const list = data?.list ?? []
      if (list.length) onBatch(list, '')
      onDone?.({ ...EMPTY_STATS, total: list.length, sites: list.length ? 1 : 0 })
      return
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let finished = false

    const handle = (line: string) => {
      if (!line.trim()) return
      const event = parseLine(line)
      if (!event) return
      if (event.type === 'batch') onBatch(event.items, event.site)
      else { finished = true; onDone?.(event.stats) }
    }

    for (;;) {
      const { done, value } = await reader.read()
      clearTimeout(timer)
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let nl: number
      while ((nl = buffer.indexOf('\n')) >= 0) {
        handle(buffer.slice(0, nl))
        buffer = buffer.slice(nl + 1)
      }
      if (finished) break
    }
    if (!finished) {
      handle(buffer)
      handle(decoder.decode())
      if (!finished) onDone?.(EMPTY_STATS)
    }
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', forward)
  }
}

async function fallback(wd: string, handlers: Handlers) {
  const data = await fetchJson<{ list?: SearchResult[] }>(
    `${FALLBACK_PATH}?wd=${encodeURIComponent(wd)}`, handlers.signal
  )
  const list = data.list ?? []
  if (list.length) handlers.onBatch(list, '')
  handlers.onDone?.({ ...EMPTY_STATS, total: list.length, sites: list.length ? 1 : 0 })
}

/** 流式搜索入口：主视图与精简版共用，调用方只负责累加与收尾。 */
export async function streamSearch(wd: string, handlers: Handlers): Promise<void> {
  let received = 0
  const onBatch: Handlers['onBatch'] = (items, site) => {
    received += items.length
    handlers.onBatch(items, site)
  }
  try {
    await consume(wd, handlers.signal, onBatch, handlers.onDone)
  } catch (err) {
    if (handlers.signal?.aborted) throw err
    if (received > 0) {
      handlers.onDone?.({ ...EMPTY_STATS, total: received })
      return
    }
    await fallback(wd, handlers)
  }
}
