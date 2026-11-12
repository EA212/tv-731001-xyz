/**
 * GET /api/search-stream?wd=... —— NDJSON 流式搜索。
 *
 * 哪个采集站先返回就先推一批，前端无需等待最慢的站点（首屏从「最慢站」降到「最快站」）。
 * 原生 onRequestGet + ReadableStream，绕开 Express 适配层的响应缓冲；
 * 若平台缓冲 chunked，前端会检测到并自动降级到一次性 /api/search。
 * 密钥无关，逻辑与字段全部复用 _lib/search-core.js（下划线前缀为内部模块，不生成路由）。
 */
import { searchAll } from '../_lib/search-core.js'

const HEADERS = {
  'Content-Type': 'application/x-ndjson; charset=utf-8',
  'Cache-Control': 'no-store, no-transform',
  'X-Accel-Buffering': 'no'
}

const write = (controller, encoder, event) => {
  try {
    controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'))
    return true
  } catch {
    return false
  }
}

export function onRequestGet(context) {
  const wd = (new URL(context.request.url).searchParams.get('wd') ?? '').trim().slice(0, 80)
  const encoder = new TextEncoder()
  const ctrl = new AbortController()
  context.request?.signal?.addEventListener?.('abort', () => ctrl.abort(), { once: true })

  let closed = false
  const stream = new ReadableStream({
    start(controller) {
      if (!wd) {
        write(controller, encoder, { type: 'done', total: 0, sites: 0, arrived: 0, failed: 0, elapsed: 0 })
        closed = true
        controller.close()
        return
      }

      searchAll(wd, {
        signal: ctrl.signal,
        onBatch: ({ site, items }) => write(controller, encoder, { type: 'batch', site, items })
      })
        .then(stats => write(controller, encoder, { type: 'done', ...stats }))
        .catch(() => write(controller, encoder, {
          type: 'done', total: 0, sites: 0, arrived: 0, failed: 0, elapsed: 0, error: true
        }))
        .finally(() => {
          if (!closed) {
            closed = true
            try { controller.close() } catch { /* 已关闭 */ }
          }
        })
    },
    cancel() {
      closed = true
      ctrl.abort()
    }
  })

  return new Response(stream, { headers: HEADERS })
}
