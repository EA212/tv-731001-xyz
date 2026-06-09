/* eslint-disable @next/next/no-img-element */
"use client"

import { useState, useEffect, useRef, useCallback } from 'react'
import { Search, Play, Info, Star, ChevronLeft, ChevronRight, X, Tv, Film, Globe, Sparkles, Loader2, Sun, Moon } from 'lucide-react'

// 类型定义
interface MovieItem {
  id: number
  title?: string
  name?: string
  poster_path: string
  vote_average: number
  release_date?: string
  first_air_date?: string
  overview?: string
  backdrop_path?: string
}

interface SearchResult {
  vod_name: string
  vod_pic: string
  vod_id: string
  site_key: string
  site_name: string
  latency?: number
}

interface Episode {
  name: string
  url: string
}

interface Source {
  site_name: string
  site_key: string
  vod_id: string
  latency?: number | string
}

interface Group {
  name: string
  pic: string
  sources: Source[]
}

interface DPlayerInstance {
  destroy: () => void
}

interface DPlayerConstructor {
  new (options: {
    container: HTMLElement
    screenshot: boolean
    autoplay: boolean
    video: { url: string; type?: string }
  }): DPlayerInstance
}

// WebKit 扩展的视频元素接口
interface WebKitHTMLVideoElement extends HTMLVideoElement {
  webkitShowPlaybackTargetPicker?: () => void
}

declare global {
  interface Window {
    DPlayer?: DPlayerConstructor
  }
}

export default function JilaotvPage() {
  // 状态管理
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [rawList, setRawList] = useState<SearchResult[]>([])
  const [movieList, setMovieList] = useState<MovieItem[]>([])
  const [tvList, setTvList] = useState<MovieItem[]>([])
  const [listCn, setListCn] = useState<MovieItem[]>([])
  const [listKrjp, setListKrjp] = useState<MovieItem[]>([])
  const [heroList, setHeroList] = useState<{title: string; overview: string; backdrop: string}[]>([])
  const [scrollY, setScrollY] = useState(0)
  const [showDetail, setShowDetail] = useState(false)
  const [currentGroup, setCurrentGroup] = useState<Group | null>(null)
  const [currentSource, setCurrentSource] = useState<Source | null>(null)
  const [episodeList, setEpisodeList] = useState<Episode[]>([])
  const [currentUrl, setCurrentUrl] = useState('')
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [imageMap, setImageMap] = useState<Record<string, string>>({})
  const [fallbackMap, setFallbackMap] = useState<Record<string, boolean>>({})
  const [isDark, setIsDark] = useState(true) // 黑暗模式状态
  const dplayerRef = useRef<{ destroy: () => void } | null>(null)

  const TMDB_API_KEY = 'c36cafd8b15f8b30f416867cfef1b01d'
  const MY_PROXY = 'https://daili.smdhb.com'
  const TMDB_BASE_URL = `${MY_PROXY}/3`
  const TMDB_IMG_URL = `${MY_PROXY}/t/p/w500`
  const TMDB_BACKDROP_URL = `${MY_PROXY}/t/p/original`

  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({})

  // 切换主题
  const toggleTheme = () => {
    setIsDark(!isDark)
    document.documentElement.setAttribute('data-theme', isDark ? 'light' : 'dark')
  }

  // 初始化主题
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 滚动事件监听
  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // 初始化触摸滑动支持（已通过 CSS touch-action 处理，无需 JavaScript）
  // CSS 已设置：
  // - touch-action: pan-y pinch-zoom (桌面端允许垂直滚动)
  // - touch-action: pan-x pan-y (触摸设备允许水平和垂直滚动)
  // - overflow-x: auto (触摸设备启用水平滚动)
  // 无需额外的 JavaScript 事件监听

  // 获取所有榜单数据
  const fetchAllLists = useCallback(async () => {
    console.log('🚀 [开始获取榜单数据]')
    console.log('📡 TMDb API URL:', TMDB_BASE_URL)
    
    try {
      console.log('⏳ 正在请求 4 个榜单...')
      
      const [movieRes, tvRes, cnRes, krjpRes] = await Promise.all([
        fetch(`${TMDB_BASE_URL}/trending/movie/week?api_key=${TMDB_API_KEY}&language=zh-CN`),
        fetch(`${TMDB_BASE_URL}/trending/tv/week?api_key=${TMDB_API_KEY}&language=zh-CN`),
        fetch(`${TMDB_BASE_URL}/discover/tv?with_origin_country=CN&sort_by=popularity.desc&api_key=${TMDB_API_KEY}&language=zh-CN`),
        fetch(`${TMDB_BASE_URL}/discover/tv?with_origin_country=KR|JP&sort_by=popularity.desc&api_key=${TMDB_API_KEY}&language=zh-CN`)
      ])
      
      console.log('✅ 所有榜单请求完成')
      console.log('📊 响应状态:', {
        电影榜: movieRes.status,
        剧集榜: tvRes.status,
        华语强档: cnRes.status,
        日韩潮流: krjpRes.status
      })
      
      const [movieData, tvData, cnData, krjpData] = await Promise.all([
        movieRes.json(),
        tvRes.json(),
        cnRes.json(),
        krjpRes.json()
      ])

      console.log('📦 数据解析完成:', {
        电影榜: movieData.results?.length || 0,
        剧集榜: tvData.results?.length || 0,
        华语强档: cnData.results?.length || 0,
        日韩潮流: krjpData.results?.length || 0
      })

      setMovieList(movieData.results || [])
      setTvList(tvData.results || [])
      setListCn(cnData.results || [])
      setListKrjp(krjpData.results || [])
      
      console.log('✨ 榜单数据加载完成')
    } catch (error) {
      console.error('❌ 获取榜单数据失败:', error)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 获取 Hero 轮播数据
  const fetchHero = useCallback(async () => {
    console.log('🎬 [开始获取 Hero 轮播数据]')
    
    try {
      const url = `${TMDB_BASE_URL}/trending/all/week?api_key=${TMDB_API_KEY}&language=zh-CN`
      console.log('📡 请求 URL:', url)
      
      const res = await fetch(url)
      console.log('✅ Hero 数据请求完成, 状态:', res.status)
      
      const data = await res.json()
      console.log('📦 Hero 数据:', data.results?.length || 0, '条')
      
      if (data.results) {
        const heroes = data.results
          .filter((item: MovieItem) => item.backdrop_path)
          .slice(0, 5)
          .map((item: MovieItem) => ({
            title: item.title || item.name || '',
            overview: item.overview || '精彩内容不容错过',
            backdrop: `${TMDB_BACKDROP_URL}${item.backdrop_path}`
          }))
        
        console.log('🖼️ Hero 轮播图片:', heroes.map((h: { title: string }) => h.title))
        setHeroList(heroes)
      }
      
      console.log('✨ Hero 数据加载完成')
    } catch (error) {
      console.error('❌ 获取 Hero 数据失败:', error)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 加载静态数据
  const loadStaticData = useCallback(async () => {
    console.log('📦 [加载静态数据] 开始...')
    
    try {
      const res = await fetch('/static-data.json')
      if (!res.ok) {
        console.warn('⚠️ 静态数据文件不存在')
        return
      }
      
      const data = await res.json()
      console.log('✅ 静态数据加载成功')
      
      // 设置静态数据
      if (data.movieList) setMovieList(data.movieList)
      if (data.tvList) setTvList(data.tvList)
      if (data.listCn) setListCn(data.listCn)
      if (data.listKrjp) setListKrjp(data.listKrjp)
      if (data.heroList) setHeroList(data.heroList)
      
      console.log('📊 静态数据统计:', {
        电影: data.movieList?.length || 0,
        剧集: data.tvList?.length || 0,
        华语: data.listCn?.length || 0,
        日韩: data.listKrjp?.length || 0,
        Hero: data.heroList?.length || 0
      })
    } catch (error) {
      console.error('❌ 加载静态数据失败:', error)
    }
  }, [])

  // 初始化数据
  useEffect(() => {
    console.log('🚀 [页面初始化] 开始加载数据...')
    
    // 先加载静态数据
    loadStaticData().then(() => {
      console.log('📡 静态数据加载完成，开始获取动态数据...')
      // 然后异步获取动态数据
      fetchAllLists()
      fetchHero()
    })
  }, [loadStaticData, fetchAllLists, fetchHero])

  // DPlayer 初始化
  useEffect(() => {
    if (!currentUrl || !showDetail) return

    const initPlayer = () => {
      const container = document.getElementById('dplayer')
      if (!container) return

      // 销毁旧实例
      if (dplayerRef.current) {
        try {
          dplayerRef.current.destroy()
        } catch {
          // 忽略销毁错误
        }
        dplayerRef.current = null
      }

      // 创建新实例
      const isHls = currentUrl.includes('.m3u8')
      const DPlayer = window.DPlayer
      
      if (DPlayer) {
        try {
          dplayerRef.current = new DPlayer({
            container: container,
            screenshot: false,
            autoplay: true,
            video: isHls ? {
              url: currentUrl,
              type: 'hls'
            } : {
              url: currentUrl
            }
          })
        } catch (error) {
          console.error('DPlayer init failed:', error)
        }
      }
    }

    // 等待 DPlayer 脚本加载
    if (window.DPlayer) {
      initPlayer()
    } else {
      const checkInterval = setInterval(() => {
        if (window.DPlayer) {
          clearInterval(checkInterval)
          initPlayer()
        }
      }, 100)
      
      setTimeout(() => clearInterval(checkInterval), 5000)
    }

    return () => {
      if (dplayerRef.current) {
        try {
          dplayerRef.current.destroy()
        } catch {
          // 忽略销毁错误
        }
        dplayerRef.current = null
      }
    }
  }, [currentUrl, showDetail])

  // 搜索功能
  const doSearch = async (searchKeyword?: string) => {
    const kw = searchKeyword || keyword.trim()
    if (!kw) {
      console.warn('⚠️ 搜索关键词为空，已取消搜索')
      return
    }
    
    console.log('========================================')
    console.log('🔍 [开始搜索]')
    console.log('📝 关键词:', kw)
    console.log('⏰ 时间:', new Date().toLocaleTimeString())
    
    setLoading(true)
    setSearched(true)
    setRawList([])
    
    try {
      const url = `/api/search?wd=${encodeURIComponent(kw)}`
      console.log('📡 请求 URL:', url)
      console.log('⏳ 正在发送请求...')
      
      const startTime = Date.now()
      const res = await fetch(url)
      const endTime = Date.now()
      
      console.log('✅ 请求完成')
      console.log('📊 HTTP 状态:', res.status, res.statusText)
      console.log('⏱️ 耗时:', endTime - startTime, 'ms')
      
      if (!res.ok) {
        console.error('❌ HTTP 错误:', res.status, res.statusText)
        throw new Error(`HTTP ${res.status}: ${res.statusText}`)
      }
      
      console.log('⏳ 正在解析 JSON...')
      const data = await res.json()
      
      console.log('📦 解析完成')
      console.log('📊 结果数量:', data.list?.length || 0, '条')
      
      if (data.list && data.list.length > 0) {
        console.log('✅ 搜索成功！找到', data.list.length, '条结果')
        console.log('📝 前 3 条结果预览:')
        data.list.slice(0, 3).forEach((item: SearchResult, index: number) => {
          console.log(`  ${index + 1}. ${item.vod_name} - ${item.site_name}`)
        })
        
        // 统计各站点结果数
        const siteCount: Record<string, number> = {}
        data.list.forEach((item: SearchResult) => {
          siteCount[item.site_name] = (siteCount[item.site_name] || 0) + 1
        })
        console.log('📊 各站点结果统计:', siteCount)
      } else {
        console.warn('⚠️ 未找到任何结果')
      }
      
      setRawList(data.list || [])
      
      // 处理图片 fallback
      const needFallback = data.list?.filter((item: SearchResult) => 
        !item.vod_pic || item.vod_pic.includes('mac_default')
      ) || []
      
      if (needFallback.length > 0) {
        console.log('🖼️ 需要图片 Fallback:', needFallback.length, '条')
      }
      
      data.list?.forEach((item: SearchResult) => {
        if (!item.vod_pic || item.vod_pic.includes('mac_default')) {
          handleImgError(item.vod_name)
        }
      })
      
      console.log('✨ 搜索流程全部完成')
      console.log('========================================')
    } catch (error) {
      console.error('========================================')
      console.error('❌ [搜索失败]')
      console.error('❌ 错误类型:', error instanceof Error ? error.name : typeof error)
      console.error('❌ 错误信息:', error instanceof Error ? error.message : error)
      console.error('❌ 完整错误:', error)
      console.error('========================================')
    } finally {
      setLoading(false)
    }
  }

  // 图片错误处理
  const handleImgError = async (name: string) => {
    // 如果已经有图片、正在加载中、或者已经 fallback 过，都跳过
    if (imageMap[name] || loadingMap[name] || fallbackMap[name]) return
    
    console.log('🖼️ [图片 Fallback]', name)
    setLoadingMap(prev => ({ ...prev, [name]: true }))  // 标记为加载中
    setFallbackMap(prev => ({ ...prev, [name]: true })) // 立即显示 fallback
    
    const cleanName = name.replace(/第[0-9一二三四五六七八九十]+[季部]/g, '')
      .replace(/Season\s*\d+/ig, '')
      .replace(/S\d{1,2}/ig, '')
      .replace(/(HD|BD|1080P|720P|4K|202\d|TC|TS).*/i, '')
      .trim()
    
    console.log('🔍 清理后的名称:', cleanName)
    
    try {
      const url = `${TMDB_BASE_URL}/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(cleanName)}&language=zh-CN`
      const res = await fetch(url)
      const data = await res.json()
      
      if (data.results && data.results.length > 0) {
        const found = data.results.find((i: MovieItem) => i.poster_path) || data.results[0]
        if (found.poster_path) {
          console.log('✅ 找到图片:', found.title || found.name)
          setImageMap(prev => ({ ...prev, [name]: `${TMDB_IMG_URL}${found.poster_path}` }))
          setFallbackMap(prev => ({ ...prev, [name]: false })) // 有图才取消 fallback
        } else {
          console.warn('⚠️ 未找到图片')
        }
      } else {
        console.warn('⚠️ TMDb 未找到结果')
      }
    } catch (error) {
      console.error('❌ 图片 Fallback 失败:', error)
    } finally {
      setLoadingMap(prev => ({ ...prev, [name]: false }))
    }
  }

  // 自动搜索
  const autoSearch = (name: string) => {
    setKeyword(name)
    doSearch(name)  // 直接传递 name，不依赖状态更新
    
    setTimeout(() => {
      const anchor = document.getElementById('search-result-anchor')
      anchor?.scrollIntoView({ behavior: 'smooth' })
    }, 100)
  }

  // 清除搜索
  const clearSearch = () => {
    setSearched(false)
    setKeyword('')
    setRawList([])
  }

  // 计算分组列表
  const groupedList = () => {
    const groups: Record<string, Group> = {}
    
    rawList.forEach(item => {
      const name = item.vod_name
      if (!groups[name]) {
        groups[name] = { name, pic: item.vod_pic, sources: [] }
      }
      
      const isDefault = (url: string | undefined) => !url || url?.includes('mac_default') || url?.includes('nopic')
      if (isDefault(groups[name].pic) && !isDefault(item.vod_pic)) {
        groups[name].pic = item.vod_pic
      }
      if (isDefault(groups[name].pic)) {
        handleImgError(name)
      }
      
      groups[name].sources.push({
        site_name: item.site_name,
        site_key: item.site_key,
        vod_id: item.vod_id,
        latency: item.latency || 999
      })
    })
    
    return Object.values(groups).sort((a, b) => b.sources.length - a.sources.length)
  }

  // 获取最终海报
  const finalPoster = (item: MovieItem | Group, isHot = false) => {
    const name = isHot ? (item as MovieItem).title || (item as MovieItem).name || '' : (item as Group).name
    
    // 优先使用 imageMap 中的图片
    if (imageMap[name]) {
      return imageMap[name]
    }
    
    // 处理静态数据中的图片路径
    const posterPath = isHot ? (item as MovieItem).poster_path : ''
    
    // 如果是静态数据的相对路径（以 / 开头），使用本地静态图片
    if (posterPath && posterPath.startsWith('/')) {
      return `/static-images${posterPath}`
    }
    
    // 否则使用远程图片
    return isHot ? `https://daili.smdhb.com/t/p/w300${posterPath}` : (item as Group).pic
  }

  // 判断是否使用 fallback
  const isFallback = (name: string) => fallbackMap[name] === true

  // 打开详情页
  const openDetail = (group: Group) => {
    console.log('🎬 [打开详情]', group.name, '共', group.sources.length, '个源')
    setCurrentGroup(group)
    setShowDetail(true)
    
    console.log('⏳ 开始测速...')
    group.sources.forEach(source => {
      source.latency = '...'
      fetch(`/api/check?key=${source.site_key}`)
        .then(res => res.json())
        .then(data => {
          console.log(`✅ ${source.site_name} 延迟:`, data.latency, 'ms')
          setCurrentGroup(prev => {
            if (!prev) return prev
            return {
              ...prev,
              sources: prev.sources.map(s => 
                s.site_key === source.site_key ? { ...s, latency: data.latency } : s
              )
            }
          })
        })
        .catch(error => {
          console.error(`❌ ${source.site_name} 测速失败:`, error)
        })
    })
    
    const best = group.sources[0]
    console.log('🎯 选择最佳源:', best.site_name)
    switchSource(best)
  }

  // 关闭详情页
  const closeDetail = () => {
    setShowDetail(false)
  }

  // 切换线路
  const switchSource = async (source: Source) => {
    console.log('🔄 [切换线路]', source.site_name)
    setCurrentSource(source)
    setLoadingDetail(true)
    setEpisodeList([])
    
    try {
      const url = `/api/detail?site_key=${source.site_key}&id=${source.vod_id}`
      console.log('📡 详情 URL:', url)
      
      const res = await fetch(url)
      console.log('✅ 详情请求完成, 状态:', res.status)
      
      const data = await res.json()
      
      if (data.list && data.list.length > 0) {
        console.log('📦 获取到剧集数据')
        parseEpisodes(data.list[0].vod_play_url)
      } else {
        console.warn('⚠️ 未找到剧集数据')
      }
    } catch (error) {
      console.error('❌ 获取详情失败:', error)
    } finally {
      setLoadingDetail(false)
    }
  }

  // 解析集数
  const parseEpisodes = (urlStr: string) => {
    let playSource = urlStr
    if (urlStr.includes('$$$')) {
      const sets = urlStr.split('$$$')
      playSource = sets.find(s => s.toLowerCase().includes('m3u8')) || sets[0]
    }
    
    const episodes = playSource.split('#').map(ep => {
      const p = ep.split('$')
      return { name: p.length > 1 ? p[0] : '正片', url: p.length > 1 ? p[1] : p[0] }
    })
    
    setEpisodeList(episodes)
    if (episodes.length > 0) {
      play(episodes[0].url)
    }
  }

  // 播放视频
  const play = (url: string) => {
    setCurrentUrl(url)
    // DPlayer 初始化将在 useEffect 中处理
  }

  // 获取延迟等级
  const getLatencyClass = (ms: number | string) => {
    const numMs = typeof ms === 'string' ? 999 : ms
    return numMs < 500 ? 'dot-green' : (numMs < 2000 ? 'dot-yellow' : 'dot-red')
  }

  // 投屏功能
  const castVideo = () => {
    const videoEl = document.querySelector('.dplayer-video') as WebKitHTMLVideoElement
    if (!videoEl) {
      alert('请先播放视频')
      return
    }
    
    // 尝试使用 Presentation API
    if (videoEl.remote && videoEl.remote.state !== 'disconnected') {
      videoEl.remote.prompt().catch(() => {})
    } 
    // 尝试使用 WebKit 投屏 API (iOS Safari)
    else if (videoEl.webkitShowPlaybackTargetPicker) {
      videoEl.webkitShowPlaybackTargetPicker()
    } 
    else {
      alert('您的浏览器不支持网页直接投屏，请使用浏览器菜单中的投射功能。')
    }
  }

  // 滚动热榜
  const scrollHotRow = (section: string, direction: 'prev' | 'next') => {
    const hotRow = document.querySelector(`[data-section="${section}"]`) as HTMLElement
    if (!hotRow) return
    
    const cardWidth = 164
    const scrollAmount = cardWidth * 3
    
    hotRow.scrollBy({
      left: direction === 'prev' ? -scrollAmount : scrollAmount,
      behavior: 'smooth'
    })
  }

  // HotCard 组件
  const HotCard = ({ item }: { item: MovieItem }) => {
    const name = item.title || item.name || ''
    const date = item.release_date?.split('-')[0] || item.first_air_date?.split('-')[0] || ''
    
    return (
      <div 
        className="hot-card" 
        onClick={() => autoSearch(name)}
        data-section={item.backdrop_path ? 'hero' : ''}
      >
        <div className="poster-wrap">
          <img 
            src={`https://daili.smdhb.com/t/p/w300${item.poster_path}`} 
            alt={name}
            loading="lazy"
          />
          <div className="rating-badge">
            <Star className="w-3 h-3 text-warning fill-warning mr-1" />
            {item.vote_average.toFixed(1)}
          </div>
        </div>
        <div className="movie-name">{name}</div>
        <div className="movie-date">{date}</div>
      </div>
    )
  }

  // ResultCard 组件
  const ResultCard = ({ group }: { group: Group }) => {
    const posterSrc = imageMap[group.name] || (fallbackMap[group.name] ? null : group.pic)
    
    return (
      <div className="result-card" onClick={() => openDetail(group)}>
        <div className="poster-wrap">
          {posterSrc ? (
            <img 
              src={posterSrc} 
              alt={group.name}
              referrerPolicy="no-referrer"
              onError={() => handleImgError(group.name)}
              loading="lazy"
            />
          ) : (
            <div className="poster-fallback">
              <Film className="w-12 h-12 mb-2 opacity-50" />
              <div style={{ fontSize: '12px', color: '#999' }}>{group.name}</div>
            </div>
          )}
          <div className="rating-badge" style={{ background: '#e50914', color: '#fff', border: 'none' }}>
            {group.sources.length} 源
          </div>
        </div>
        <div className="movie-name">{group.name}</div>
      </div>
    )
  }

  return (
    <div className={`min-h-screen ${isDark ? 'bg-[#141414]' : 'bg-[#f5f5f5]'} ${isDark ? 'text-white' : 'text-[#141414]'}`}>
      {/* 导航栏 */}
      <nav className={`navbar-custom fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrollY > 50 ? 'scrolled' : ''}`}>
        <div className="brand flex items-center">
          <img src="/logo.png" alt="机佬TV" className="h-[50px] md:h-[60px] mr-2" />
          <span className="text-xs text-gray-500 font-normal">MAX</span>
        </div>
        <button 
          className="theme-toggle" 
          onClick={toggleTheme} 
          title="切换主题"
        >
          {isDark ? (
            <Sun className="w-5 h-5" />
          ) : (
            <Moon className="w-5 h-5" />
          )}
        </button>
      </nav>

      {/* Hero 轮播 */}
      <div id="heroCarousel" className="carousel slide carousel-fade" data-bs-ride="carousel" data-bs-interval="6000">
        <div className="carousel-inner">
          {heroList.length > 0 ? (
            heroList.map((item, index) => (
              <div key={index} className={`carousel-item ${index === 0 ? 'active' : ''}`}>
                <div className="hero-bg" style={{ backgroundImage: `url(${item.backdrop})` }}></div>
                <div className="hero-overlay">
                  <div className="hero-content">
                    <div className="hero-tag">本周 TOP {index + 1}</div>
                    <h1 className="hero-title">{item.title}</h1>
                    <p className="hero-desc">{item.overview}</p>
                    <div className="hero-btns">
                      <button className="btn-play" onClick={() => autoSearch(item.title)}>
                        <Play className="w-5 h-5 mr-2" /> 播放
                      </button>
                      <button className="btn-info" onClick={() => autoSearch(item.title)}>
                        <Info className="w-5 h-5 mr-2" /> 更多信息
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            /* Hero 骨架屏 */
            <div className="carousel-item active">
              <div className="skeleton-hero">
                <div className="skeleton-hero-content">
                  <div className="skeleton-hero-tag"></div>
                  <div className="skeleton-hero-title"></div>
                  <div className="skeleton-hero-desc"></div>
                  <div className="skeleton-hero-desc" style={{ width: '70%' }}></div>
                  <div style={{ marginTop: '20px' }}>
                    <div className="skeleton-hero-btn"></div>
                    <div className="skeleton-hero-btn"></div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 搜索框 */}
      <div className="search-section">
        <div className="search-box-wrapper">
          <Search className="search-icon w-6 h-6 text-gray-400 cursor-pointer" onClick={() => doSearch()} />
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && doSearch()}
            className="search-input"
            placeholder="输入片名、剧集、演员..."
          />
        </div>
      </div>

      {/* 榜单区域 */}
      {!searched && (
        <>
          {/* 电影榜 */}
          <div className="section-container animate__animated animate__fadeInUp">
            <div className="section-header">
              <div className="section-line"></div>
              <div className="section-title">
                <Film className="w-5 h-5 opacity-70" /> 全球震感·电影榜
              </div>
              {movieList.length > 0 && (
                <div className="hot-row-nav">
                  <button className="nav-btn nav-prev" onClick={() => scrollHotRow('movie', 'prev')}>
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button className="nav-btn nav-next" onClick={() => scrollHotRow('movie', 'next')}>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
            <div className="hot-row" data-section="movie">
              {movieList.length > 0 ? (
                movieList.map((item) => <HotCard key={item.id} item={item} />)
              ) : (
                /* 骨架屏 */
                Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className="skeleton-card">
                    <div className="skeleton-poster"></div>
                    <div className="skeleton-text"></div>
                    <div className="skeleton-text-sm"></div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 剧集榜 */}
          <div className="section-container animate__animated animate__fadeInUp">
            <div className="section-header">
              <div className="section-line"></div>
              <div className="section-title">
                <Tv className="w-5 h-5 opacity-70" /> 全球必追·剧集榜
              </div>
              {tvList.length > 0 && (
                <div className="hot-row-nav">
                  <button className="nav-btn nav-prev" onClick={() => scrollHotRow('tv', 'prev')}>
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button className="nav-btn nav-next" onClick={() => scrollHotRow('tv', 'next')}>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
            <div className="hot-row" data-section="tv">
              {tvList.length > 0 ? (
                tvList.map((item) => <HotCard key={item.id} item={item} />)
              ) : (
                Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className="skeleton-card">
                    <div className="skeleton-poster"></div>
                    <div className="skeleton-text"></div>
                    <div className="skeleton-text-sm"></div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 华语强档 */}
          <div className="section-container animate__animated animate__fadeInUp">
            <div className="section-header">
              <div className="section-line"></div>
              <div className="section-title">
                <Globe className="w-5 h-5 opacity-70" /> 华语强档·国产剧
              </div>
              {listCn.length > 0 && (
                <div className="hot-row-nav">
                  <button className="nav-btn nav-prev" onClick={() => scrollHotRow('cn', 'prev')}>
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button className="nav-btn nav-next" onClick={() => scrollHotRow('cn', 'next')}>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
            <div className="hot-row" data-section="cn">
              {listCn.length > 0 ? (
                listCn.map((item) => <HotCard key={item.id} item={item} />)
              ) : (
                Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className="skeleton-card">
                    <div className="skeleton-poster"></div>
                    <div className="skeleton-text"></div>
                    <div className="skeleton-text-sm"></div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 日韩潮流 */}
          <div className="section-container animate__animated animate__fadeInUp">
            <div className="section-header">
              <div className="section-line"></div>
              <div className="section-title">
                <Sparkles className="w-5 h-5 opacity-70" /> 日韩潮流·剧集/动漫
              </div>
              {listKrjp.length > 0 && (
                <div className="hot-row-nav">
                  <button className="nav-btn nav-prev" onClick={() => scrollHotRow('krjp', 'prev')}>
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button className="nav-btn nav-next" onClick={() => scrollHotRow('krjp', 'next')}>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
            <div className="hot-row" data-section="krjp">
              {listKrjp.length > 0 ? (
                listKrjp.map((item) => <HotCard key={item.id} item={item} />)
              ) : (
                Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className="skeleton-card">
                    <div className="skeleton-poster"></div>
                    <div className="skeleton-text"></div>
                    <div className="skeleton-text-sm"></div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}

      {/* 搜索结果 */}
      <div id="search-result-anchor" className="section-container" style={{ display: searched ? 'block' : 'none' }}>
        <div className="flex justify-between items-center mb-4">
          <div className="section-header mb-0">
            <div className="section-line"></div>
            <div className="section-title">搜索结果</div>
          </div>
          <button className="btn btn-sm btn-outline-secondary" onClick={clearSearch}>清除搜索 X</button>
        </div>

        {loading ? (
          <div className="text-center py-10">
            <Loader2 className="w-8 h-8 text-red-600 animate-spin" />
          </div>
        ) : (
          <div className="result-grid">
            {groupedList().map((group) => (
              <ResultCard key={group.name} group={group} />
            ))}
          </div>
        )}

        {!loading && groupedList().length === 0 && (
          <div className="text-center text-gray-500 py-10">
            未找到相关内容，请尝试更换关键词
          </div>
        )}
      </div>

      {/* 页脚 */}
      <div className="footer">
        <div>机佬TV 改编 爱吃王哥呆阿龟头 原创</div>
        <div className="text-xs mt-2 opacity-50">Data provided by TMDb & Maccms APIs</div>
      </div>

      {/* 播放详情页 */}
      <div className={`detail-overlay ${showDetail ? 'active' : ''}`}>
        <div className="close-btn fixed top-6 right-8 z-50" onClick={closeDetail}>
          <X className="w-6 h-6" />
        </div>

        {currentGroup && (
          <div className="player-layout">
            {/* 视频标题栏 */}
            <div className="video-header">
              <div>
                <h1 className="video-title">{currentGroup.name}</h1>
                <div className="video-meta">
                  正在播放: <span className="text-white font-bold">{currentSource?.site_name}</span>
                </div>
              </div>
              <button className="btn-cast" onClick={castVideo}>
                <Tv className="w-4 h-4 mr-2" /> 一键投屏
              </button>
            </div>

            {/* 播放器区域 */}
            <div className="player-box">
              <div id="dplayer" className="w-full h-full bg-black"></div>
            </div>

            {/* 控制面板 */}
            <div className="controls-area">
              {/* 线路选择 */}
              <div className="mb-6">
                <div className="panel-title">切换线路 (真实测速)</div>
                <div className="source-list">
                  {currentGroup.sources.map((source) => (
                    <div
                      key={source.site_key}
                      className={`source-pill ${currentSource?.site_key === source.site_key ? 'active' : ''}`}
                      onClick={() => switchSource(source)}
                    >
                      <span>{source.site_name}</span>
                      <span className={`latency-dot ${getLatencyClass(source.latency || 999)}`}></span>
                      <span className="text-xs opacity-60">{source.latency}ms</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 选集列表 */}
              <div>
                <div className="panel-title">选集播放</div>
                {loadingDetail ? (
                  <div className="text-center py-8 text-gray-500">
                    <Loader2 className="w-6 h-6 animate-spin inline-block mr-2" /> 加载中...
                  </div>
                ) : (
                  <div className="ep-grid">
                    {episodeList.map((ep, index) => (
                      <div
                        key={index}
                        className={`ep-btn ${currentUrl === ep.url ? 'active' : ''}`}
                        onClick={() => play(ep.url)}
                      >
                        {ep.name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 加载外部脚本 */}
      <Script src="/js/bootstrap.bundle.min.js" />
      <Script src="/js/hls.min.js" />
      <Script src="/js/DPlayer.min.js" />
    </div>
  )
}

// Script 组件用于加载外部脚本
function Script({ src }: { src: string }) {
  useEffect(() => {
    const script = document.createElement('script')
    script.src = src
    script.crossOrigin = 'anonymous'
    script.referrerPolicy = 'no-referrer'
    document.body.appendChild(script)
    
    return () => {
      document.body.removeChild(script)
    }
  }, [src])
  
  return null
}