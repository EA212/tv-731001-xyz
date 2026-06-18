/* eslint-disable @next/next/no-img-element */
"use client"

import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
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
  site_name: string
  site_key: string
  latency?: number
}

// 静态数据中的电影/剧集项
interface MovieItem {
  id: number
  title?: string
  name?: string
  poster_path: string
  vote_average: number
  release_date?: string
  first_air_date?: string
  overview?: string
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

// 主内容组件（需要 Suspense 包裹）
function JilaotvContent() {
  // 路由管理
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  
  // 精简版模式检测（从URL参数或localStorage读取）
  const [isLiteMode, setIsLiteMode] = useState(false)
  
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
  
  // 用于防止重复触发 popstate
  const isInternalNavigation = useRef(false)

  const TMDB_API_KEY = 'c36cafd8b15f8b30f416867cfef1b01d'
  const MY_PROXY = 'https://daili.smdhb.com'
  const TMDB_BASE_URL = `${MY_PROXY}/3`
  const TMDB_IMG_URL = `${MY_PROXY}/t/p/w500`
  const TMDB_BACKDROP_URL = `${MY_PROXY}/t/p/original`

  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({})

  // 检测精简版模式
  useEffect(() => {
    const mode = searchParams.get('mode')
    const storedMode = localStorage.getItem('jilaotv-mode')
    
    if (mode === 'lite' || storedMode === 'lite') {
      console.log('📱 使用精简版模式')
      setIsLiteMode(true)
      // 保存到localStorage，后续访问自动使用精简版
      localStorage.setItem('jilaotv-mode', 'lite')
    } else {
      console.log('💻 使用完整版模式')
      setIsLiteMode(false)
    }
  }, [searchParams])

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

  // 从 URL 参数恢复状态
  useEffect(() => {
    const q = searchParams.get('q')
    const d = searchParams.get('d')
    
    console.log('🔗 [URL 参数]', { q, d })
    
    // 如果有搜索参数，恢复搜索状态
    if (q && !searched) {
      console.log('📝 从 URL 恢复搜索:', q)
      setKeyword(q)
      doSearch(q, false) // 不更新 URL，因为已经是从 URL 来的
    }
    
    // 如果有详情参数，需要等搜索完成后恢复详情
    // 这部分逻辑比较复杂，暂时简化处理
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  // 监听浏览器返回事件（popstate）
  useEffect(() => {
    const handlePopState = () => {
      console.log('🔙 [popstate] 浏览器返回事件触发')
      
      // 如果是内部导航触发的，忽略
      if (isInternalNavigation.current) {
        console.log('⏭️ 内部导航，忽略 popstate')
        return
      }
      
      // 获取当前 URL 参数
      const params = new URLSearchParams(window.location.search)
      const q = params.get('q')
      const d = params.get('d')
      
      console.log('📊 当前 URL 状态:', { q, d, showDetail, searched })
      
      // 根据当前状态和 URL 参数决定行为
      if (showDetail) {
        // 如果当前在详情页，返回应该关闭详情页
        console.log('🎬 关闭详情页')
        setShowDetail(false)
        setCurrentGroup(null)
        setCurrentSource(null)
        setEpisodeList([])
        setCurrentUrl('')
        
        // 销毁播放器
        if (dplayerRef.current) {
          try {
            dplayerRef.current.destroy()
          } catch {
            // 忽略销毁错误
          }
          dplayerRef.current = null
        }
      } else if (searched && !q) {
        // 如果当前在搜索结果页，但 URL 没有 q 参数，说明要回到首页
        console.log('🔍 清除搜索，回到首页')
        setSearched(false)
        setKeyword('')
        setRawList([])
      } else if (q && !searched) {
        // 如果 URL 有 q 参数但当前不在搜索状态，恢复搜索
        console.log('📝 恢复搜索:', q)
        setKeyword(q)
        doSearch(q, false)
      }
    }
    
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showDetail, searched])

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
  const doSearch = async (searchKeyword?: string, updateUrl = true) => {
    const kw = searchKeyword || keyword.trim()
    if (!kw) {
      console.warn('⚠️ 搜索关键词为空，已取消搜索')
      return
    }
    
    console.log('========================================')
    console.log('🔍 [开始搜索]')
    console.log('📝 关键词:', kw)
    console.log('⏰ 时间:', new Date().toLocaleTimeString())
    
    // 更新 URL（如果不是从 URL 参数恢复的）
    if (updateUrl) {
      isInternalNavigation.current = true
      const params = new URLSearchParams()
      params.set('q', kw)
      router.push(`${pathname}?${params.toString()}`, { scroll: false })
      setTimeout(() => {
        isInternalNavigation.current = false
      }, 100)
    }
    
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
    
    // 清除 URL 参数
    isInternalNavigation.current = true
    router.push(pathname, { scroll: false })
    setTimeout(() => {
      isInternalNavigation.current = false
    }, 100)
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

  // 打开详情页
  const openDetail = (group: Group) => {
    console.log('🎬 [打开详情]', group.name, '共', group.sources.length, '个源')
    setCurrentGroup(group)
    setShowDetail(true)
    
    // 更新 URL
    isInternalNavigation.current = true
    const params = new URLSearchParams(searchParams.toString())
    params.set('q', keyword)
    params.set('d', group.name)
    router.push(`${pathname}?${params.toString()}`, { scroll: false })
    setTimeout(() => {
      isInternalNavigation.current = false
    }, 100)
    
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
    
    // 更新 URL - 回到搜索结果页
    isInternalNavigation.current = true
    const params = new URLSearchParams()
    if (keyword) {
      params.set('q', keyword)
    }
    router.push(`${pathname}?${params.toString()}`, { scroll: false })
    setTimeout(() => {
      isInternalNavigation.current = false
    }, 100)
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
    // 优先使用 imageMap 中的图片，其次用原始图片，都没有则用占位图
    const posterSrc = imageMap[group.name] || group.pic || '/static-images/jilaoTV.jpg'
    // 判断是否是占位图
    const isPlaceholder = posterSrc === '/static-images/jilaoTV.jpg'
    
    return (
      <div className="result-card" onClick={() => openDetail(group)}>
        <div className="poster-wrap">
          <img 
            src={posterSrc} 
            alt={group.name}
            referrerPolicy="no-referrer"
            onError={() => {
              // 只有非占位图才触发搜索
              if (!isPlaceholder) {
                handleImgError(group.name)
              }
            }}
            loading="lazy"
          />
          <div className="rating-badge" style={{ background: '#e50914', color: '#fff', border: 'none' }}>
            {group.sources.length} 源
          </div>
        </div>
        <div className="movie-name">{group.name}</div>
      </div>
    )
  }

  // 根据模式渲染不同版本
  if (isLiteMode) {
    return <JilaotvLiteContent />
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
          <div className="flex items-center justify-center py-10">
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
        <div className="text-xs mt-1 opacity-30">
          版本: {process.env.NEXT_PUBLIC_BUILD_VERSION || '开发版本'}
        </div>
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

// 导出页面组件，用 Suspense 包裹
export default function JilaotvPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen bg-[#141414]">
        <Loader2 className="w-8 h-8 text-red-600 animate-spin" />
      </div>
    }>
      <JilaotvContent />
    </Suspense>
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

// ==================== 精简版组件 ====================
// 专为低端设备设计，使用最基础的CSS和HTML，避免高级特性
// 使用 static-data.json 中的固定数据，不依赖 TMDb API

function JilaotvLiteContent() {
  // 状态管理（精简版独立的状态）
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [rawList, setRawList] = useState<SearchResult[]>([])
  const [showDetail, setShowDetail] = useState(false)
  const [currentGroup, setCurrentGroup] = useState<Group | null>(null)
  const [episodeList, setEpisodeList] = useState<Episode[]>([])
  const [currentUrl, setCurrentUrl] = useState('')
  const [loadingDetail, setLoadingDetail] = useState(false)
  
  // 静态数据（从 static-data.json 加载）
  const [staticData, setStaticData] = useState<{
    movieList: MovieItem[]
    tvList: MovieItem[]
    listCn: MovieItem[]
    listKrjp: MovieItem[]
  } | null>(null)

  // 搜索 API
  const SEARCH_API = 'https://api.smdhb.com/api.php/provide/vod/?ac=detail&wd='

  // 将 poster_path 转换为静态图片路径
  const getStaticImagePath = (posterPath: string) => {
    // 移除开头的 /，然后添加 /static-images/
    const filename = posterPath.startsWith('/') ? posterPath.slice(1) : posterPath
    return `/static-images/${filename}`
  }

  // 加载静态数据
  useEffect(() => {
    fetch('/static-data.json')
      .then(res => res.json())
      .then(data => {
        console.log('✅ 加载静态数据:', data)
        setStaticData(data)
      })
      .catch(err => {
        console.error('❌ 加载静态数据失败:', err)
      })
  }, [])

  // 精简版搜索功能
  const doSearch = async (searchKeyword?: string) => {
    const kw = (searchKeyword || keyword).trim()
    if (!kw) return
    
    setLoading(true)
    setKeyword(kw)
    console.log('🔍 [精简版搜索]', kw)
    
    try {
      const res = await fetch(`${SEARCH_API}${encodeURIComponent(kw)}`)
      const data = await res.json()
      console.log('✅ 搜索结果:', data.list?.length || 0)
      setRawList(data.list || [])
      setSearched(true)
    } catch (err) {
      console.error('❌ 搜索失败:', err)
      setRawList([])
    } finally {
      setLoading(false)
    }
  }

  // 打开详情页
  const openDetail = async (group: Group) => {
    setCurrentGroup(group)
    setShowDetail(true)
    setLoadingDetail(true)
    setEpisodeList([])
    setCurrentUrl('')
    
    console.log('🎬 [精简版打开详情]', group.name)
    
    try {
      // 获取剧集列表
      const source = group.sources[0]
      const res = await fetch(`https://api.smdhb.com/api.php/provide/vod/?ac=detail&ids=${source.vod_id}`)
      const data = await res.json()
      
      if (data.list && data.list[0]) {
        const vod = data.list[0]
        // 解析剧集 URL
        const urls = vod.vod_play_url?.split('#') || []
        const names = vod.vod_play_note?.split('#') || []
        
        const episodes: Episode[] = urls.map((url: string, i: number) => ({
          name: names[i] || `第${i + 1}集`,
          url: url.split('$')[1] || url
        })).filter((ep: Episode) => ep.url)
        
        setEpisodeList(episodes)
        console.log('✅ 剧集列表:', episodes.length)
        
        // 自动播放第一集
        if (episodes.length > 0) {
          play(episodes[0].url)
        }
      }
    } catch (err) {
      console.error('❌ 获取剧集失败:', err)
    } finally {
      setLoadingDetail(false)
    }
  }

  // 关闭详情页
  const closeDetail = () => {
    setShowDetail(false)
    setCurrentGroup(null)
    setEpisodeList([])
    setCurrentUrl('')
  }

  // 播放视频
  const play = (url: string) => {
    console.log('▶️ [精简版播放]', url)
    setCurrentUrl(url)
  }

  return (
    <div style={{
      fontFamily: 'sans-serif',
      backgroundColor: '#141414',
      color: '#fff',
      minHeight: '100vh',
      padding: '10px'
    }}>
      {/* 精简版头部 */}
      <header style={{
        position: 'sticky',
        top: 0,
        backgroundColor: '#1a1a1a',
        padding: '10px',
        marginBottom: '10px',
        zIndex: 100
      }}>
        <h1 style={{ margin: '0 0 10px 0', fontSize: '20px' }}>机佬TV (精简版)</h1>
        
        {/* 搜索框 */}
        <div style={{ display: 'flex', gap: '5px' }}>
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && doSearch()}
            placeholder="搜索影片..."
            style={{
              flex: 1,
              padding: '10px',
              fontSize: '16px',
              border: '1px solid #333',
              backgroundColor: '#2a2a2a',
              color: '#fff',
              borderRadius: '4px'
            }}
          />
          <button
            onClick={() => doSearch()}
            disabled={loading}
            style={{
              padding: '10px 20px',
              fontSize: '16px',
              backgroundColor: '#e50914',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? '搜索中...' : '搜索'}
          </button>
        </div>
      </header>

      {/* 固定热门列表（搜索前显示） */}
      {!searched && staticData && (
        <div>
          {/* 电影榜 */}
          <h2 style={{ fontSize: '18px', marginBottom: '10px', color: '#e50914' }}>电影榜</h2>
          <div style={{ display: 'block' }}>
            {staticData.movieList.map((movie, index) => (
              <div
                key={index}
                onClick={() => doSearch(movie.title)}
                style={{
                  display: 'block',
                  padding: '10px',
                  marginBottom: '10px',
                  backgroundColor: '#1a1a1a',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <img
                    src={getStaticImagePath(movie.poster_path)}
                    alt={movie.title}
                    style={{
                      width: '60px',
                      height: '90px',
                      objectFit: 'cover',
                      borderRadius: '4px',
                      backgroundColor: '#333'
                    }}
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                      const parent = e.currentTarget.parentElement
                      if (parent && !parent.querySelector('.placeholder')) {
                        const placeholder = document.createElement('div')
                        placeholder.className = 'placeholder'
                        placeholder.style.cssText = 'width:60px;height:90px;background:#333;display:flex;align-items:center;justify-content:center;font-size:12px;border-radius:4px;'
                        placeholder.textContent = '无图'
                        parent.insertBefore(placeholder, e.currentTarget)
                      }
                    }}
                  />
                  <div>
                    <div style={{ fontSize: '16px', fontWeight: 'bold' }}>{movie.title}</div>
                    <div style={{ fontSize: '12px', color: '#888', marginTop: '5px' }}>
                      评分: {movie.vote_average} | {movie.release_date?.slice(0, 4)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* 剧集榜 */}
          <h2 style={{ fontSize: '18px', marginBottom: '10px', marginTop: '20px', color: '#e50914' }}>剧集榜</h2>
          <div style={{ display: 'block' }}>
            {staticData.tvList.map((tv, index) => (
              <div
                key={index}
                onClick={() => doSearch(tv.name)}
                style={{
                  display: 'block',
                  padding: '10px',
                  marginBottom: '10px',
                  backgroundColor: '#1a1a1a',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <img
                    src={getStaticImagePath(tv.poster_path)}
                    alt={tv.name}
                    style={{
                      width: '60px',
                      height: '90px',
                      objectFit: 'cover',
                      borderRadius: '4px',
                      backgroundColor: '#333'
                    }}
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                      const parent = e.currentTarget.parentElement
                      if (parent && !parent.querySelector('.placeholder')) {
                        const placeholder = document.createElement('div')
                        placeholder.className = 'placeholder'
                        placeholder.style.cssText = 'width:60px;height:90px;background:#333;display:flex;align-items:center;justify-content:center;font-size:12px;border-radius:4px;'
                        placeholder.textContent = '无图'
                        parent.insertBefore(placeholder, e.currentTarget)
                      }
                    }}
                  />
                  <div>
                    <div style={{ fontSize: '16px', fontWeight: 'bold' }}>{tv.name}</div>
                    <div style={{ fontSize: '12px', color: '#888', marginTop: '5px' }}>
                      评分: {tv.vote_average} | {tv.first_air_date?.slice(0, 4)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* 华语强档 */}
          <h2 style={{ fontSize: '18px', marginBottom: '10px', marginTop: '20px', color: '#e50914' }}>华语强档</h2>
          <div style={{ display: 'block' }}>
            {staticData.listCn.map((cn, index) => (
              <div
                key={index}
                onClick={() => doSearch(cn.name)}
                style={{
                  display: 'block',
                  padding: '10px',
                  marginBottom: '10px',
                  backgroundColor: '#1a1a1a',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <img
                    src={getStaticImagePath(cn.poster_path)}
                    alt={cn.name}
                    style={{
                      width: '60px',
                      height: '90px',
                      objectFit: 'cover',
                      borderRadius: '4px',
                      backgroundColor: '#333'
                    }}
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                      const parent = e.currentTarget.parentElement
                      if (parent && !parent.querySelector('.placeholder')) {
                        const placeholder = document.createElement('div')
                        placeholder.className = 'placeholder'
                        placeholder.style.cssText = 'width:60px;height:90px;background:#333;display:flex;align-items:center;justify-content:center;font-size:12px;border-radius:4px;'
                        placeholder.textContent = '无图'
                        parent.insertBefore(placeholder, e.currentTarget)
                      }
                    }}
                  />
                  <div>
                    <div style={{ fontSize: '16px', fontWeight: 'bold' }}>{cn.name}</div>
                    <div style={{ fontSize: '12px', color: '#888', marginTop: '5px' }}>
                      评分: {cn.vote_average} | {cn.first_air_date?.slice(0, 4)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* 日韩潮流 */}
          <h2 style={{ fontSize: '18px', marginBottom: '10px', marginTop: '20px', color: '#e50914' }}>日韩潮流</h2>
          <div style={{ display: 'block' }}>
            {staticData.listKrjp.map((krjp, index) => (
              <div
                key={index}
                onClick={() => doSearch(krjp.name)}
                style={{
                  display: 'block',
                  padding: '10px',
                  marginBottom: '10px',
                  backgroundColor: '#1a1a1a',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <img
                    src={getStaticImagePath(krjp.poster_path)}
                    alt={krjp.name}
                    style={{
                      width: '60px',
                      height: '90px',
                      objectFit: 'cover',
                      borderRadius: '4px',
                      backgroundColor: '#333'
                    }}
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                      const parent = e.currentTarget.parentElement
                      if (parent && !parent.querySelector('.placeholder')) {
                        const placeholder = document.createElement('div')
                        placeholder.className = 'placeholder'
                        placeholder.style.cssText = 'width:60px;height:90px;background:#333;display:flex;align-items:center;justify-content:center;font-size:12px;border-radius:4px;'
                        placeholder.textContent = '无图'
                        parent.insertBefore(placeholder, e.currentTarget)
                      }
                    }}
                  />
                  <div>
                    <div style={{ fontSize: '16px', fontWeight: 'bold' }}>{krjp.name}</div>
                    <div style={{ fontSize: '12px', color: '#888', marginTop: '5px' }}>
                      评分: {krjp.vote_average} | {krjp.first_air_date?.slice(0, 4)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 加载静态数据提示 */}
      {!searched && !staticData && (
        <div style={{ textAlign: 'center', padding: '50px 20px', color: '#888' }}>
          <p style={{ fontSize: '18px' }}>加载中...</p>
        </div>
      )}

      {/* 搜索结果列表 */}
      {searched && (
        <div>
          <h2 style={{ fontSize: '18px', marginBottom: '10px' }}>搜索结果 ({rawList.length})</h2>
          
          {rawList.length === 0 && !loading && (
            <p style={{ color: '#888' }}>未找到相关结果</p>
          )}
          
          <div style={{ display: 'block' }}>
            {rawList.map((item, index) => (
              <div
                key={index}
                onClick={() => openDetail({
                  name: item.vod_name,
                  pic: item.vod_pic,
                  sources: [{ site_name: item.site_name, site_key: item.site_key, vod_id: item.vod_id }]
                })}
                style={{
                  display: 'block',
                  padding: '10px',
                  marginBottom: '10px',
                  backgroundColor: '#1a1a1a',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <img
                    src={item.vod_pic}
                    alt={item.vod_name}
                    style={{
                      width: '60px',
                      height: '90px',
                      objectFit: 'cover',
                      borderRadius: '4px',
                      backgroundColor: '#333'
                    }}
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                      const parent = e.currentTarget.parentElement
                      if (parent && !parent.querySelector('.placeholder')) {
                        const placeholder = document.createElement('div')
                        placeholder.className = 'placeholder'
                        placeholder.style.cssText = 'width:60px;height:90px;background:#333;display:flex;align-items:center;justify-content:center;font-size:12px;border-radius:4px;'
                        placeholder.textContent = '无图'
                        parent.insertBefore(placeholder, e.currentTarget)
                      }
                    }}
                  />
                  <div>
                    <div style={{ fontSize: '16px', fontWeight: 'bold' }}>{item.vod_name}</div>
                    <div style={{ fontSize: '12px', color: '#888', marginTop: '5px' }}>
                      来源: {item.site_name}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {/* 返回热门列表按钮 */}
          <button
            onClick={() => {
              setSearched(false)
              setRawList([])
              setKeyword('')
            }}
            style={{
              marginTop: '20px',
              padding: '10px 20px',
              fontSize: '14px',
              backgroundColor: '#333',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            返回热门列表
          </button>
        </div>
      )}

      {/* 详情弹窗 */}
      {showDetail && currentGroup && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.9)',
          zIndex: 1000,
          overflow: 'auto',
          padding: '10px'
        }}>
          <div style={{
            backgroundColor: '#1a1a1a',
            borderRadius: '8px',
            padding: '15px',
            maxWidth: '600px',
            margin: '0 auto'
          }}>
            {/* 关闭按钮 */}
            <button
              onClick={closeDetail}
              style={{
                position: 'absolute',
                top: '10px',
                right: '10px',
                padding: '5px 10px',
                backgroundColor: '#333',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              关闭
            </button>

            {/* 影片信息 */}
            <h2 style={{ margin: '0 0 15px 0', fontSize: '20px' }}>{currentGroup.name}</h2>
            <img
              src={currentGroup.pic}
              alt={currentGroup.name}
              style={{
                width: '100%',
                maxWidth: '200px',
                borderRadius: '4px',
                marginBottom: '15px',
                backgroundColor: '#333'
              }}
              onError={(e) => {
                e.currentTarget.style.display = 'none'
              }}
            />

            {/* 播放器 */}
            {currentUrl && (
              <div style={{ marginBottom: '15px' }}>
                <video
                  src={currentUrl}
                  controls
                  style={{
                    width: '100%',
                    backgroundColor: '#000',
                    borderRadius: '4px'
                  }}
                />
              </div>
            )}

            {/* 选集列表 */}
            <div>
              <h3 style={{ fontSize: '16px', marginBottom: '10px' }}>选集播放</h3>
              {loadingDetail ? (
                <p style={{ color: '#888' }}>加载中...</p>
              ) : (
                <div style={{ display: 'block' }}>
                  {episodeList.map((ep, index) => (
                    <button
                      key={index}
                      onClick={() => play(ep.url)}
                      style={{
                        display: 'inline-block',
                        padding: '8px 12px',
                        margin: '5px',
                        backgroundColor: currentUrl === ep.url ? '#e50914' : '#333',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '14px'
                      }}
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
  )
}