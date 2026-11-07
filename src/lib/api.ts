/**
 * 统一的请求层：所有网络调用都带 AbortSignal，脚本只加载一次。
 * 组件卸载或请求被取代时调用 abort()，杜绝竞态与卸载后 setState。
 */

export async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return (await res.json()) as T
}

const scripts = new Map<string, Promise<void>>()

/** 同一个 src 全局只插入一次 <script>，并返回可复用的 Promise。 */
export function loadScript(src: string): Promise<void> {
  const cached = scripts.get(src)
  if (cached) return cached

  const promise = new Promise<void>((resolve, reject) => {
    const el = document.createElement('script')
    el.src = src
    el.async = true
    el.crossOrigin = 'anonymous'
    el.referrerPolicy = 'no-referrer'
    el.onload = () => resolve()
    el.onerror = () => {
      scripts.delete(src)
      reject(new Error(`脚本加载失败: ${src}`))
    }
    document.body.appendChild(el)
  })
  scripts.set(src, promise)
  return promise
}
