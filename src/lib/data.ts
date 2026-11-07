/** 纯数据层：分组与剧集解析都不依赖 React，便于复用与测试。 */
import { isBadPic } from './poster'
import type { SearchResult, Group, Episode } from './types'

/** 按片名聚合多站点结果，线路多的排前面。 */
export function groupResults(list: SearchResult[]): Group[] {
  const groups = new Map<string, Group>()
  for (const item of list) {
    let group = groups.get(item.vod_name)
    if (!group) {
      group = { name: item.vod_name, pic: item.vod_pic, sources: [] }
      groups.set(item.vod_name, group)
    }
    if (isBadPic(group.pic) && !isBadPic(item.vod_pic)) group.pic = item.vod_pic
    group.sources.push({
      site_name: item.site_name,
      site_key: item.site_key,
      vod_id: item.vod_id,
      latency: item.latency ?? 999
    })
  }
  return [...groups.values()].sort((a, b) => b.sources.length - a.sources.length)
}

/** 解析 m3u8/普通播放地址串，优先 m3u8 分组。 */
export function parseEpisodes(raw?: string): Episode[] {
  if (!raw) return []
  const sets = raw.split('$$$')
  const source = sets.find(s => s.toLowerCase().includes('m3u8')) ?? sets[0]
  return source
    .split('#')
    .map(part => {
      const [name, url] = part.split('$')
      return url ? { name, url } : { name: '正片', url: name }
    })
    .filter(ep => Boolean(ep.url))
}
