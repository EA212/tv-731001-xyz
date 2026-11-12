'use client'

/** 精简版：与主视图共用数据层、海报组件和 CSS 变量，只替换呈现方式。 */
import { memo, useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { fetchJson } from '../../lib/api'
import { streamSearch } from '../../lib/search-stream'
import { groupResults, parseEpisodes } from '../../lib/data'
import { Poster } from '../../components/Poster'
import { SECTIONS } from '../../components/Cards'
import { toStaticImage } from '../../lib/tmdb'
import { applyShareParams, clearShareParams, readShareTarget } from '../../lib/deeplink'
import type { StaticData, SearchResult, Group, Episode, MovieItem } from '../../lib/types'

const LiteRow = memo(function LiteRow({
  image, title, meta, onClick
}: {
  image: string
  title: string
  meta: string
  onClick: () => void
}) {
  return (
    <button type="button" className="lite-row" onClick={onClick}>
      <Poster src={image} alt={title} className="lite-poster" />
      <span className="lite-info">
        <strong className="lite-title">{title}</strong>
        <span className="lite-meta">{meta}</span>
      </span>
    </button>
  )
})

export default function LiteView({ initialData }: { initialData: StaticData }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const q = searchParams.get('q') ?? ''
  const searched = q.length > 0
  const paramsString = searchParams.toString()
  const share = useMemo(() => readShareTarget(new URLSearchParams(paramsString)), [paramsString])
  const [bootShare] = useState(() => readShareTarget(new URLSearchParams(paramsString)))

  const [keyword, setKeyword] = useState(q)
  const [rawList, setRawList] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [streaming, setStreaming] = useState(false)
  const [showDetail, setShowDetail] = useState(false)
  const [currentGroup, setCurrentGroup] = useState<Group | null>(null)
  const [episodeList, setEpisodeList] = useState<Episode[]>([])
  const [currentUrl, setCurrentUrl] = useState('')
  const [loadingDetail, setLoadingDetail] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    setKeyword(q)
    setRawList([])
    if (share || !q) { setLoading(false); setStreaming(false); return }
    const ctrl = new AbortController()
    setLoading(true)
    setStreaming(true)
    streamSearch(q, {
      signal: ctrl.signal,
      onBatch: items => {
        if (ctrl.signal.aborted) return
        setRawList(prev => prev.concat(items))
        setLoading(false)
      },
      onDone: () => {
        if (!ctrl.signal.aborted) { setLoading(false); setStreaming(false) }
      }
    }).catch(() => {
      if (!ctrl.signal.aborted) { setLoading(false); setStreaming(false) }
    })
    return () => ctrl.abort()
  }, [q, share])

  useEffect(() => () => abortRef.current?.abort(), [])

  const groups = useMemo(() => groupResults(rawList), [rawList])

  const updateParams = useCallback((mutate: (p: URLSearchParams) => void) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('mode', 'lite')
    mutate(params)
    router.push(`${pathname}?${params}`, { scroll: false })
  }, [searchParams, pathname, router])

  const doSearch = useCallback((value: string) => {
    const kw = value.trim()
    if (!kw) return
    updateParams(p => { clearShareParams(p); p.set('q', kw) })
  }, [updateParams])

  const clearSearch = useCallback(() => {
    setShowDetail(false)
    updateParams(p => { clearShareParams(p); p.delete('q') })
  }, [updateParams])

  /** 纯播放：详情点击与分享还原共用，不写 URL。 */
  const play = useCallback(async (group: Group) => {
    setCurrentGroup(group)
    setShowDetail(true)
    setLoadingDetail(true)
    setEpisodeList([])
    setCurrentUrl('')
    const source = group.sources[0]
    if (!source) { setLoadingDetail(false); return }

    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    try {
      const res = await fetchJson<{ list?: { vod_play_url?: string }[] }>(
        `/api/detail?site_key=${encodeURIComponent(source.site_key)}&id=${encodeURIComponent(source.vod_id)}`,
        ctrl.signal
      )
      if (ctrl.signal.aborted) return
      const episodes = parseEpisodes(res.list?.[0]?.vod_play_url)
      setEpisodeList(episodes)
      if (episodes[0]) setCurrentUrl(episodes[0].url)
    } catch {
      if (!ctrl.signal.aborted) setEpisodeList([])
    } finally {
      if (!ctrl.signal.aborted) setLoadingDetail(false)
    }
  }, [])

  const openDetail = useCallback((group: Group) => {
    void play(group)
    updateParams(p => applyShareParams(p, group.name, group.sources[0]))
  }, [play, updateParams])

  // 分享落地：首屏带 sid 时直接还原到那一部，不写 URL、不重跑搜索。
  const shareResolved = useRef(false)
  useEffect(() => {
    if (shareResolved.current || !bootShare) return
    shareResolved.current = true
    void play({
      name: bootShare.name,
      pic: '',
      sources: [{
        site_key: bootShare.siteKey,
        vod_id: bootShare.vodId,
        site_name: bootShare.siteName || bootShare.siteKey,
      }],
    })
  }, [bootShare, play])

  const closeDetail = useCallback(() => {
    setShowDetail(false)
    setCurrentUrl('')
    updateParams(clearShareParams)
  }, [updateParams])

  return (
    <div className="lite-shell">
      <header className="lite-header">
        <strong className="lite-brand">机佬TV</strong>
        <div className="lite-search">
          <input
            type="search"
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && doSearch(keyword)}
            placeholder="搜索片名"
            aria-label="搜索片名"
          />
          <button type="button" onClick={() => doSearch(keyword)}>搜索</button>
        </div>
      </header>

      {!searched && SECTIONS.map(section => (
        <section className="lite-section" key={section.key}>
          <h2 className="lite-section-title">{section.title}</h2>
          {(initialData[section.field] as MovieItem[]).map(item => (
            <LiteRow
              key={item.id}
              image={toStaticImage(item.poster_path)}
              title={item.title ?? item.name ?? ''}
              meta={`评分 ${item.vote_average} · ${(item.release_date ?? item.first_air_date ?? '').slice(0, 4)}`}
              onClick={() => doSearch(item.title ?? item.name ?? '')}
            />
          ))}
        </section>
      ))}

      {searched && (
        <section className="lite-section">
          <h2 className="lite-section-title">搜索结果 ({rawList.length}){streaming ? ' · 继续搜索中' : ''}</h2>
          {loading && <p className="lite-loading">加载中...</p>}
          {!loading && !streaming && groups.length === 0 && <p className="lite-loading">未找到相关结果</p>}
          {groups.map(group => (
            <LiteRow
              key={group.name}
              image={group.pic}
              title={group.name}
              meta={`${group.sources.length} 个来源 · ${group.sources[0]?.site_name ?? ''}`}
              onClick={() => openDetail(group)}
            />
          ))}
          <button type="button" className="lite-back" onClick={clearSearch}>返回热门列表</button>
        </section>
      )}

      {showDetail && currentGroup && (
        <div className="lite-overlay">
          <div className="lite-panel">
            <button type="button" className="lite-close" onClick={closeDetail}>关闭</button>
            <h2 className="lite-title-lg">{currentGroup.name}</h2>
            <Poster src={currentGroup.pic} alt={currentGroup.name} className="lite-detail-poster" />
            {currentUrl && <video src={currentUrl} controls className="lite-video" />}
            <h3 className="lite-subtitle">选集播放</h3>
            {loadingDetail ? <p className="lite-loading">加载中...</p> : (
              <div className="lite-episodes">
                {episodeList.map((ep, i) => (
                  <button
                    type="button"
                    key={`${ep.url}-${i}`}
                    className={`lite-ep ${currentUrl === ep.url ? 'active' : ''}`}
                    onClick={() => setCurrentUrl(ep.url)}
                  >
                    {ep.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
