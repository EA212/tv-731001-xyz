/**
 * 采集站检索的单一来源：站点表、单站抓取、字段裁剪、并发编排。
 * /api/search（一次性）与 /api/search-stream（NDJSON）共用，避免两套逻辑漂移。
 * 用运行时原生 fetch，无第三方依赖；可注入 fetchImpl 便于本地验证。
 */

export const SITES = [
  { key: "ffzy", name: "非凡影视", api: "https://api.ffzyapi.com/api.php/provide/vod", active: true },
  { key: "bfzy", name: "暴风资源", api: "https://bfzyapi.com/api.php/provide/vod", active: true },
  { key: "dyttzy", name: "电影天堂", api: "http://caiji.dyttzyapi.com/api.php/provide/vod", active: true },
  { key: "tyyszy", name: "天涯资源", api: "https://tyyszy.com/api.php/provide/vod", active: true },
  { key: "zy360", name: "360资源", api: "https://360zy.com/api.php/provide/vod", active: true },
  { key: "maotaizy", name: "茅台资源", api: "https://caiji.maotaizy.cc/api.php/provide/vod", active: true },
  { key: "wolong", name: "卧龙资源", api: "https://wolongzyw.com/api.php/provide/vod", active: true },
  { key: "jisu", name: "极速资源", api: "https://jszyapi.com/api.php/provide/vod", active: true },
  { key: "dbzy", name: "豆瓣资源", api: "https://dbzy.tv/api.php/provide/vod", active: true },
  { key: "mozhua", name: "魔爪资源", api: "https://mozhuazy.com/api.php/provide/vod", active: true },
  { key: "mdzy", name: "魔都资源", api: "https://www.mdzyapi.com/api.php/provide/vod", active: true },
  { key: "zuid", name: "最大资源", api: "https://api.zuidapi.com/api.php/provide/vod", active: true },
  { key: "yinghua", name: "樱花资源", api: "https://m3u8.apiyhzy.com/api.php/provide/vod", active: true },
  { key: "wujin", name: "无尽资源", api: "https://api.wujinapi.me/api.php/provide/vod", active: true },
  { key: "wwzy", name: "旺旺短剧", api: "https://wwzy.tv/api.php/provide/vod", active: true },
  { key: "ikun", name: "iKun资源", api: "https://ikunzyapi.com/api.php/provide/vod", active: true },
  { key: "lzi", name: "量子资源", api: "https://cj.lziapi.com/api.php/provide/vod", active: true },
  { key: "bdzy", name: "百度资源", api: "https://api.apibdzy.com/api.php/provide/vod", active: true },
  { key: "hongniuzy", name: "红牛资源", api: "https://www.hongniuzy2.com/api.php/provide/vod", active: true },
  { key: "xinlangaa", name: "新浪资源", api: "https://api.xinlangapi.com/xinlangapi.php/provide/vod", active: true },
  { key: "ckzy", name: "CK资源", api: "https://ckzy.me/api.php/provide/vod", active: true },
  { key: "ukuapi", name: "U酷资源", api: "https://api.ukuapi.com/api.php/provide/vod", active: true },
  { key: "1080zyk", name: "1080资源", api: "https://api.1080zyku.com/inc/apijson.php/", active: true },
  { key: "hhzyapi", name: "豪华资源", api: "https://hhzyapi.com/api.php/provide/vod", active: true },
  { key: "subocaiji", name: "速博资源", api: "https://subocaiji.com/api.php/provide/vod", active: true },
  { key: "p2100", name: "飘零资源", api: "https://p2100.net/api.php/provide/vod", active: true },
  { key: "aqyzy", name: "爱奇艺", api: "https://iqiyizyapi.com/api.php/provide/vod", active: true },
  { key: "yzzy", name: "优质资源", api: "https://api.yzzy-api.com/inc/apijson.php", active: true },
  { key: "myzy", name: "猫眼资源", api: "https://api.maoyanapi.top/api.php/provide/vod", active: true },
  { key: "rycj", name: "如意资源", api: "https://cj.rycjapi.com/api.php/provide/vod", active: true },
  { key: "jinyingzy", name: "金鹰点播", api: "https://jinyingzy.com/api.php/provide/vod", active: true },
  { key: "guangsuapi", name: "光速资源", api: "https://api.guangsuapi.com/api.php/provide/vod", active: true }
]

const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
const MAX_PER_SITE = 20
const SITE_TIMEOUT = 6_000
const STREAM_DEADLINE = 8_000

const str = value => String(value ?? '')

/** 单站检索：ac=detail 优先（带海报），失败退 ac=list；只回 6 个必要字段。 */
export async function fetchSite(site, wd, { signal, fetchImpl = fetch, timeout = SITE_TIMEOUT } = {}) {
  const ctrl = new AbortController()
  const forward = () => ctrl.abort()
  signal?.addEventListener('abort', forward, { once: true })
  const timer = setTimeout(() => ctrl.abort(), timeout)
  const started = Date.now()
  try {
    for (const ac of ['detail', 'list']) {
      if (ctrl.signal.aborted) break
      try {
        const url = `${site.api}?ac=${ac}&wd=${encodeURIComponent(wd)}&out=json`
        const res = await fetchImpl(url, { signal: ctrl.signal, headers: UA })
        if (!res.ok) continue
        const body = await res.json()
        const list = body?.list ?? body?.data
        if (!Array.isArray(list) || list.length === 0) continue
        const latency = Date.now() - started
        return list.slice(0, MAX_PER_SITE).map(item => ({
          vod_name: str(item.vod_name),
          vod_pic: str(item.vod_pic),
          vod_id: str(item.vod_id),
          site_key: site.key,
          site_name: site.name,
          latency
        }))
      } catch { /* 换下一种 ac */ }
    }
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', forward)
  }
  return []
}

/** 并发检索全部活跃站点；每站一返回就 onBatch，全部完成或到 deadline 收口。 */
export async function searchAll(wd, { signal, onBatch, fetchImpl, deadline = STREAM_DEADLINE } = {}) {
  const sites = SITES.filter(s => s.active)
  const ctrl = new AbortController()
  const forward = () => ctrl.abort()
  signal?.addEventListener('abort', forward, { once: true })
  const timer = setTimeout(() => ctrl.abort(), deadline)
  const started = Date.now()
  const stats = { total: 0, sites: sites.length, arrived: 0, failed: 0, elapsed: 0, aborted: false, truncated: false }

  await Promise.all(sites.map(async site => {
    const items = await fetchSite(site, wd, { signal: ctrl.signal, fetchImpl })
    if (items.length === 0) { stats.failed++; return }
    stats.total += items.length
    stats.arrived++
    onBatch?.({ site: site.key, items })
  }))

  clearTimeout(timer)
  signal?.removeEventListener('abort', forward)
  stats.aborted = Boolean(signal?.aborted)
  stats.truncated = ctrl.signal.aborted && !stats.aborted
  stats.elapsed = Date.now() - started
  return stats
}
