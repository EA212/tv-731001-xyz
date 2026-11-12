/* eslint-disable @next/next/no-img-element */
'use client'

import { useState, useEffect, useRef, useCallback, useMemo, Suspense } from 'react'
import type { ReactNode } from 'react'
import dynamic from 'next/dynamic'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { Search, Play, X, Tv, Loader2, Sun, Moon, Sparkles, ChevronRight } from 'lucide-react'
import { fetchJson, loadScript } from '../../lib/api'
import { lookupPoster, isBadPic, setStaticPosters } from '../../lib/poster'
import { groupResults, parseEpisodes } from '../../lib/data'
import { applyShareParams, clearShareParams, readShareTarget } from '../../lib/deeplink'
import type { ShareTarget } from '../../lib/deeplink'
import { ResultCard, HotSection, SECTIONS } from '../../components/Cards'
import { PullHint } from '../../components/PullHint'
import { usePullToContinue } from '../../lib/use-pull-to-continue'
import type { CuratedFilm } from '../../lib/curate'
import type {
  StaticData, SearchResult, Group, Source, Episode, DPlayerInstance
} from '../../lib/types'

const LiteView = dynamic(() => import('./lite'), { ssr: false })
const SpaceView = dynamic(() => import('./space'), { ssr: false })

const ENABLE_TMDB_POSTER_FALLBACK = true
const HERO_INTERVAL = 6_000

const getLatencyClass = (ms: number) =>
  ms < 500 ? 'dot-green' : ms < 2000 ? 'dot-yellow' : 'dot-red'

/** 模式分流：精简版懒加载，主包里完全不含它的代码。 */
function ModeRouter({ initialData }: { initialData: StaticData }) {
  const searchParams = useSearchParams()
  const fromUrl = searchParams.get('mode') === 'lite'
  const [lite, setLite] = useState<boolean | null>(fromUrl ? true : null)

  useEffect(() => {
    if (fromUrl) {
      localStorage.setItem('jilaotv-mode', 'lite')
      setLite(true)
    } else {
      setLite(localStorage.getItem('jilaotv-mode') === 'lite')
    }
  }, [fromUrl])

  // 默认直接渲染完整版，服务端不再输出空白 loading。
  if (lite === null || lite === false) return <JilaotvContent initialData={initialData} />
  return <LiteView initialData={initialData} />
}

function JilaotvContent({ initialData }: { initialData: StaticData }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // URL 是唯一状态源：搜索、刷新恢复、浏览器前进/后退都由它驱动。
  const q = searchParams.get('q') ?? ''
  const d = searchParams.get('d') ?? ''
  const topic = searchParams.get('topic') ?? ''
  const searched = q.length > 0

  // 分享落地：URL 只带定位线索（d/sid/sn），不含任何列表或播放数据。
  const paramsString = searchParams.toString()
  const share = useMemo(() => readShareTarget(new URLSearchParams(paramsString)), [paramsString])
  // 仅捕获首屏 URL：用户交互写入的 sid 不触发还原，避免与 openDetail 打架。
  const [bootShare] = useState(() => readShareTarget(new URLSearchParams(paramsString)))
  const spaceOpen = searchParams.get('space') === '1' && !share

  const [spaceLoaded, setSpaceLoaded] = useState(false)
  const [keyword, setKeyword] = useState(q)
  const [rawList, setRawList] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [imageMap, setImageMap] = useState<Record<string, string>>({})
  const [scrolled, setScrolled] = useState(false)
  const [heroIndex, setHeroIndex] = useState(0)
  const [isDark, setIsDark] = useState(true)

  const [showDetail, setShowDetail] = useState(false)
  const [currentGroup, setCurrentGroup] = useState<Group | null>(null)
  const [currentSource, setCurrentSource] = useState<Source | null>(null)
  const [episodeList, setEpisodeList] = useState<Episode[]>([])
  const [currentUrl, setCurrentUrl] = useState('')
  const [loadingDetail, setLoadingDetail] = useState(false)

  const pullHint = useRef<HTMLDivElement>(null)
  const dplayerRef = useRef<DPlayerInstance | null>(null)
  const detailAbort = useRef<AbortController | null>(null)
  const speedAbort = useRef<AbortController | null>(null)

  // 静态索引只需在客户端注册一次；数据本身由服务端直出，无额外请求。
  useEffect(() => setStaticPosters(initialData), [initialData])

  // ---- 主题：单一来源，只用 effect 同步到 DOM ----
  useEffect(() => {
    document.documentElement.dataset.theme = isDark ? 'dark' : 'light'
  }, [isDark])

  // 空间首次进入才加载 chunk；之后保留实例，退出有滑出动画、回来仍保留上次的影展。
  useEffect(() => { if (spaceOpen) setSpaceLoaded(true) }, [spaceOpen])
  useEffect(() => {
    document.body.style.overflow = spaceOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [spaceOpen])

  // ---- 滚动：rAF 节流 + passive，且只存布尔阈值 ----
  useEffect(() => {
    let frame = 0
    const onScroll = () => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        setScrolled(window.scrollY > 50)
        frame = 0
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [])

  // ---- Hero 自动轮播：原生定时器，不引入 bootstrap ----
  const heroList = initialData.heroList ?? []
  useEffect(() => {
    if (heroList.length < 2) return
    const id = window.setInterval(
      () => setHeroIndex(i => (i + 1) % heroList.length),
      HERO_INTERVAL
    )
    return () => window.clearInterval(id)
  }, [heroList.length])

  // ---- 搜索：q 变化即请求；分享直达时让路，绝不重跑全量搜索 ----
  useEffect(() => {
    setKeyword(q)
    if (share) {
      setRawList([])
      setImageMap({})
      setLoading(false)
      return
    }
    if (!q) {
      setRawList([])
      setImageMap({})
      setLoading(false)
      return
    }
    const ctrl = new AbortController()
    setLoading(true)
    setRawList([])
    setImageMap({})
    fetchJson<{ list?: SearchResult[] }>(`/api/search?wd=${encodeURIComponent(q)}`, ctrl.signal)
      .then(res => { if (!ctrl.signal.aborted) setRawList(res.list ?? []) })
      .catch(err => { if (!ctrl.signal.aborted) console.error('搜索失败', err) })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false) })
    return () => ctrl.abort()
  }, [q, share])

  // ---- 缺图补图：并发拉取，一次批量写入 state ----
  useEffect(() => {
    if (!ENABLE_TMDB_POSTER_FALLBACK || rawList.length === 0) return
    const names = [...new Set(rawList.filter(i => isBadPic(i.vod_pic)).map(i => i.vod_name))]
    const ctrl = new AbortController()
    let cancelled = false
    Promise.all(names.map(name => lookupPoster(name, ctrl.signal))).then(urls => {
      if (cancelled) return
      const next: Record<string, string> = {}
      names.forEach((name, i) => { if (urls[i]) next[name] = urls[i]! })
      if (Object.keys(next).length) setImageMap(next)
    })
    return () => { cancelled = true; ctrl.abort() }
  }, [rawList])

  // ---- 派生数据：只在 rawList 变化时重算 ----
  const groups = useMemo(() => groupResults(rawList), [rawList])

  // ---- 浏览器后退关掉详情（d 参数由 URL 驱动） ----
  useEffect(() => {
    if (d) return
    setShowDetail(false)
    setCurrentGroup(null)
    setCurrentSource(null)
    setEpisodeList([])
    setCurrentUrl('')
  }, [d])

  // ---- 播放器脚本按需加载：Promise 缓存，无轮询、无泄漏 ----
  useEffect(() => {
    if (!showDetail || !currentUrl) return
    let cancelled = false
    const needed = [loadScript('/js/DPlayer.min.js')]
    if (currentUrl.includes('.m3u8')) needed.push(loadScript('/js/hls.min.js'))

    Promise.all(needed)
      .then(() => {
        if (cancelled) return
        const container = document.getElementById('dplayer')
        const DPlayer = window.DPlayer
        if (!container || !DPlayer) return
        dplayerRef.current?.destroy()
        dplayerRef.current = new DPlayer({
          container,
          screenshot: false,
          autoplay: true,
          video: currentUrl.includes('.m3u8')
            ? { url: currentUrl, type: 'hls' }
            : { url: currentUrl }
        })
      })
      .catch(() => {})

    return () => {
      cancelled = true
      dplayerRef.current?.destroy()
      dplayerRef.current = null
    }
  }, [showDetail, currentUrl])

  useEffect(() => () => {
    detailAbort.current?.abort()
    speedAbort.current?.abort()
  }, [])

  // ---- 操作：URL 是唯一状态源，所有跳转基于当前参数增删，不丢 space/topic/q/d ----
  const updateParams = useCallback((mutate: (p: URLSearchParams) => void) => {
    const params = new URLSearchParams(searchParams.toString())
    mutate(params)
    const qs = params.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }, [searchParams, pathname, router])

  const doSearch = useCallback((value: string) => {
    const kw = value.trim()
    if (kw) updateParams(p => {
      p.set('q', kw)
      clearShareParams(p)
      p.delete('space')
      p.delete('topic')
    })
  }, [updateParams])

  const clearSearch = useCallback(() => {
    updateParams(p => { p.delete('q'); clearShareParams(p) })
  }, [updateParams])

  const autoSearch = useCallback((name: string) => {
    doSearch(name)
    requestAnimationFrame(() => {
      document.getElementById('search-result-anchor')?.scrollIntoView({ behavior: 'smooth' })
    })
  }, [doSearch])

  const openSpace = useCallback(() => updateParams(p => p.set('space', '1')), [updateParams])
  usePullToContinue(openSpace, !spaceOpen && !showDetail, pullHint)
  const closeSpace = useCallback(() => updateParams(p => {
    p.delete('space'); p.delete('topic'); clearShareParams(p)
  }), [updateParams])
  const setSpaceTopic = useCallback((value: string) => updateParams(p => {
    p.set('space', '1'); p.set('topic', value)
  }), [updateParams])

  // ---- 线路 / 剧集：统一 abort + 一次 setState ----
  const switchSource = useCallback(async (source: Source): Promise<boolean> => {
    detailAbort.current?.abort()
    const ctrl = new AbortController()
    detailAbort.current = ctrl
    setCurrentSource(source)
    setLoadingDetail(true)
    setEpisodeList([])
    try {
      const res = await fetchJson<{ list?: { vod_play_url?: string }[] }>(
        `/api/detail?site_key=${encodeURIComponent(source.site_key)}&id=${encodeURIComponent(source.vod_id)}`,
        ctrl.signal
      )
      if (ctrl.signal.aborted) return false
      const episodes = parseEpisodes(res.list?.[0]?.vod_play_url)
      setEpisodeList(episodes)
      if (episodes[0]) setCurrentUrl(episodes[0].url)
      return episodes.length > 0
    } catch {
      if (!ctrl.signal.aborted) setEpisodeList([])
      return false
    } finally {
      if (!ctrl.signal.aborted) setLoadingDetail(false)
    }
  }, [])

  const openDetail = useCallback((group: Group) => {
    setCurrentGroup(group)
    setShowDetail(true)
    updateParams(p => applyShareParams(p, group.name, group.sources[0]))

    speedAbort.current?.abort()
    const ctrl = new AbortController()
    speedAbort.current = ctrl
    Promise.all(group.sources.map(async source => {
      try {
        const res = await fetchJson<{ latency?: number }>(
          `/api/check?key=${encodeURIComponent(source.site_key)}`, ctrl.signal
        )
        return [source.site_key, res.latency ?? 999] as const
      } catch {
        return [source.site_key, 999] as const
      }
    })).then(pairs => {
      if (ctrl.signal.aborted) return
      const latencies = new Map(pairs)
      setCurrentGroup(prev => prev && ({
        ...prev,
        sources: prev.sources.map(s => ({ ...s, latency: latencies.get(s.site_key) ?? s.latency }))
      }))
    })

    if (group.sources[0]) switchSource(group.sources[0])
  }, [updateParams, switchSource])

  /** 分享落地：定位线索先秒开详情，再用 sid 一次定点查询换当下最新线路。 */
  const resolveShare = useCallback(async (target: ShareTarget) => {
    const source: Source = {
      site_key: target.siteKey,
      vod_id: target.vodId,
      site_name: target.siteName || target.siteKey,
    }
    setCurrentGroup({ name: target.name, pic: '', sources: [source] })
    setShowDetail(true)
    setCurrentSource(source)
    if (await switchSource(source)) return

    // sid 失效才按精确片名兜底一次；仅同名命中才展开，绝不模糊误播。
    try {
      const res = await fetchJson<{ list?: SearchResult[] }>(
        `/api/search?wd=${encodeURIComponent(target.name)}`
      )
      const hit = groupResults(res.list ?? []).find(g => g.name === target.name)
      if (hit?.sources[0]) {
        setCurrentGroup(hit)
        if (await switchSource(hit.sources[0])) return
      }
    } catch { /* 落到统一退化 */ }

    // 无可用线路：清掉占位线路，交给现有提示，不误播、不白屏。
    setCurrentGroup({ name: target.name, pic: '', sources: [] })
  }, [switchSource])

  const shareResolved = useRef(false)
  useEffect(() => {
    if (shareResolved.current || !bootShare) return
    shareResolved.current = true
    void resolveShare(bootShare)
  }, [bootShare, resolveShare])

  const closeDetail = useCallback(() => {
    setShowDetail(false)
    updateParams(clearShareParams)
  }, [updateParams])

  /** 空间点片：有线路直接播；没有线路就在详情层里按片名解析，绝不把人踢回搜索框。 */
  const openFilm = useCallback(async (film: CuratedFilm) => {
    if (film.sources.length > 0) {
      openDetail({ name: film.name, pic: film.pic, sources: film.sources })
      return
    }

    setCurrentGroup({ name: film.name, pic: film.pic, sources: [] })
    setShowDetail(true)
    setLoadingDetail(true)
    updateParams(p => applyShareParams(p, film.name))

    try {
      const res = await fetchJson<{ list?: SearchResult[] }>(
        `/api/search?wd=${encodeURIComponent(film.name)}`
      )
      const groups = groupResults(res.list ?? [])
      const hit = groups.find(g => g.name === film.name) ?? groups[0]
      if (!hit) return
      setCurrentGroup(hit)
      if (hit.sources[0]) await switchSource(hit.sources[0])
    } catch {
      /* 保持空线路，详情层给出提示 */
    } finally {
      setLoadingDetail(false)
    }
  }, [openDetail, switchSource, updateParams])

  const castVideo = useCallback(() => {
    const video = document.querySelector<HTMLVideoElement & {
      webkitShowPlaybackTargetPicker?: () => void
    }>('.dplayer-video')
    if (!video) return alert('请先播放视频')
    if (video.remote && video.remote.state !== 'disconnected') {
      video.remote.prompt().catch(() => {})
    } else if (video.webkitShowPlaybackTargetPicker) {
      video.webkitShowPlaybackTargetPicker()
    } else {
      alert('您的浏览器不支持网页直接投屏，请使用浏览器菜单中的投射功能。')
    }
  }, [])

  const hero = heroList[heroIndex % heroList.length]

  return (
    <div className="app-shell">
      <nav className={`navbar-custom ${scrolled ? 'scrolled' : ''}`}>
        <div className="brand">
          <img src="/logo.png" alt="机佬TV" className="brand-logo" />
          <span className="brand-tag">MAX</span>
        </div>
        <div className="nav-actions">
          <button type="button" className="space-entry" onClick={openSpace}>
            <Sparkles className="w-4 h-4" /> AI 策展空间 <ChevronRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            className="theme-toggle"
            onClick={() => setIsDark(v => !v)}
            aria-label="切换主题"
          >
            {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>
      </nav>

      {/* Hero 轮播 */}
      <section className="hero" aria-label="本周推荐">
        {hero ? (
          <div className="hero-slide" key={hero.title}>
            <div className="hero-bg" style={{ backgroundImage: `url(${hero.backdrop})` }} />
            <div className="hero-overlay">
              <div className="hero-content">
                <div className="hero-tag">本周 TOP {(heroIndex % heroList.length) + 1}</div>
                <h1 className="hero-title">{hero.title}</h1>
                <p className="hero-desc">{hero.overview}</p>
                <div className="hero-btns">
                  <button type="button" className="btn-play" onClick={() => autoSearch(hero.title)}>
                    <Play className="w-5 h-5" /> 播放
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : <div className="skeleton-hero"><div className="skeleton-hero-content" /></div>}
      </section>

      {/* 搜索：按钮独立在左，输入框自身是完整胶囊 */}
      <div className="search-section">
        <button type="button" className="search-btn" aria-label="搜索" onClick={() => doSearch(keyword)}>
          <Search className="w-5 h-5" />
        </button>
        <input
          type="search"
          value={keyword}
          onChange={e => setKeyword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && doSearch(keyword)}
          className="search-input"
          placeholder="请输入你要查询的内容"
        />
      </div>

      {/* 榜单 */}
      {!searched && SECTIONS.map(section => (
        <HotSection
          key={section.key}
          title={section.title}
          icon={section.icon}
          sectionKey={section.key}
          items={initialData[section.field] ?? []}
          onSelect={autoSearch}
        />
      ))}

      {/* 搜索结果 */}
      <section id="search-result-anchor" className="section-container" hidden={!searched}>
        <div className="search-result-head">
          <div className="section-header">
            <div className="section-line" />
            <h2 className="section-title">搜索结果</h2>
          </div>
          <button type="button" className="btn-clear" onClick={clearSearch}>清除搜索 ×</button>
        </div>
        {loading ? (
          <div className="loading-row"><Loader2 className="spin" /></div>
        ) : groups.length > 0 ? (
          <div className="result-grid">
            {groups.map(group => (
              <ResultCard key={group.name} group={group} poster={imageMap[group.name]} onOpen={openDetail} />
            ))}
          </div>
        ) : (
          <p className="empty-hint">未找到相关内容，请尝试更换关键词</p>
        )}
      </section>

      <footer className="footer">
        <div>机佬TV 改编 爱吃王哥呆阿龟头 原创</div>
        <div className="footer-sub">片源与海报来自公开影视资料库</div>
      </footer>

      {/* 到底再下滑：进入策展空间 */}
      <PullHint side="bottom" hintRef={pullHint} label="继续下滑，进入 AI 策展空间" />

      {/* 播放详情页 */}
      <div className={`detail-overlay ${showDetail ? 'active' : ''}`} aria-hidden={!showDetail}>
        <button type="button" className="close-btn" onClick={closeDetail} aria-label="关闭">
          <X className="w-6 h-6" />
        </button>
        {currentGroup && (
          <div className="player-layout">
            <div className="video-header">
              <div>
                <h1 className="video-title">{currentGroup.name}</h1>
                <div className="video-meta">正在播放：<strong>{currentSource?.site_name ?? '—'}</strong></div>
              </div>
              <button type="button" className="btn-cast" onClick={castVideo}>
                <Tv className="w-4 h-4" /> 一键投屏
              </button>
            </div>

            <div className="player-box"><div id="dplayer" /></div>

            <div className="controls-area">
              <div className="control-block">
                <div className="panel-title">切换线路</div>
                {loadingDetail && currentGroup.sources.length === 0 ? (
                  <div className="loading-row"><Loader2 className="spin" /></div>
                ) : currentGroup.sources.length === 0 ? (
                  <p className="empty-hint">没有匹配到可播放线路，关闭后换一部试试。</p>
                ) : (
                  <div className="source-list">
                    {currentGroup.sources.map(source => (
                      <button
                        type="button"
                        key={source.site_key}
                        className={`source-pill ${currentSource?.site_key === source.site_key ? 'active' : ''}`}
                        onClick={() => switchSource(source)}
                      >
                        <span>{source.site_name}</span>
                        {source.latency != null && (
                          <>
                            <span className={`latency-dot ${getLatencyClass(source.latency)}`} />
                            <span className="latency-text">{source.latency}ms</span>
                          </>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="control-block">
                <div className="panel-title">选集播放</div>
                {loadingDetail ? (
                  <div className="loading-row"><Loader2 className="spin" /></div>
                ) : (
                  <div className="ep-grid">
                    {episodeList.map((ep, i) => (
                      <button
                        type="button"
                        key={`${ep.url}-${i}`}
                        className={`ep-btn ${currentUrl === ep.url ? 'active' : ''}`}
                        onClick={() => setCurrentUrl(ep.url)}
                      >
                        {ep.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {spaceLoaded && (
        <SpaceView
          open={spaceOpen}
          topic={topic}
          onClose={closeSpace}
          onTopic={setSpaceTopic}
          onSelect={openFilm}
        />
      )}
    </div>
  )
}

export default function JilaotvClient({
  initialData,
  fallback
}: {
  initialData: StaticData
  fallback: ReactNode
}) {
  return (
    <Suspense fallback={fallback}>
      <ModeRouter initialData={initialData} />
    </Suspense>
  )
}
