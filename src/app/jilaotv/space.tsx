/**
 * AI 策展空间：全屏独立层，只负责发现，播放交回主界面播放器。
 * 两态布局——初始居中引导；提交后标题收起，进度与结果紧接其下，避免大标题把内容顶出屏幕。
 */
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties, FormEvent } from 'react'
import { ArrowLeft, Sparkles, Wand2, RefreshCw, Loader2 } from 'lucide-react'
import { CuratedCard } from '../../components/CuratedCard'
import { fetchCurated, clearCurateCache, topicHue } from '../../lib/curate'
import type { CuratedFilm, CuratedSpace } from '../../lib/curate'
import { isBadPic, lookupPoster } from '../../lib/poster'

const PRESETS = ['克里斯托弗·诺兰', '宫崎骏', '赛博朋克', '悬疑烧脑', '治愈系', '王家卫']
const STAGES = ['正在理解主题', '正在检索片源', '正在补齐海报与线路']

interface Props {
  open: boolean
  topic: string
  onClose: () => void
  onTopic: (topic: string) => void
  onSelect: (film: CuratedFilm) => void
}

function GallerySkeleton() {
  return (
    <div className="space-grid" aria-label="正在生成片单">
      {Array.from({ length: 8 }, (_, i) => (
        <div className="skeleton-card" key={i}>
          <div className="skeleton-poster" />
          <div className="skeleton-text" />
          <div className="skeleton-text-sm" />
        </div>
      ))}
    </div>
  )
}

export default function SpaceView({ open, topic, onClose, onTopic, onSelect }: Props) {
  const [input, setInput] = useState(topic)
  const [data, setData] = useState<CuratedSpace | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const abortRef = useRef<AbortController | null>(null)
  const posterHandled = useRef<CuratedSpace | null>(null)

  const load = useCallback((value: string, force = false) => {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setLoading(true)
    setError('')
    setData(null)
    fetchCurated(value, ctrl.signal, force)
      .then(res => { if (!ctrl.signal.aborted) setData(res) })
      .catch(err => {
        if (ctrl.signal.aborted) return
        const message = err instanceof Error ? err.message : '生成失败'
        setError(/HTTP 5\d\d/.test(message) ? '服务暂时不可用，请稍后重试' : message)
      })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false) })
  }, [])

  useEffect(() => {
    setInput(topic)
    if (topic) load(topic)
    else {
      abortRef.current?.abort()
      setData(null)
      setError('')
      setLoading(false)
    }
    return () => abortRef.current?.abort()
  }, [topic, load])

  // 已用秒数：给等待一个可见的锚点，而不是无限空白
  useEffect(() => {
    if (!loading) { setElapsed(0); return }
    const start = Date.now()
    setElapsed(0)
    const id = window.setInterval(
      () => setElapsed(Math.floor((Date.now() - start) / 1000)),
      500
    )
    return () => window.clearInterval(id)
  }, [loading])

  // 云端没补到图的，用主界面同一套 TMDb 兜底补一次
  useEffect(() => {
    if (!data || posterHandled.current === data) return
    posterHandled.current = data
    const missing = data.films.filter(f => isBadPic(f.pic)).map(f => f.name)
    if (!missing.length) return
    let cancelled = false
    Promise.all(missing.map(name => lookupPoster(name).catch(() => null))).then(urls => {
      if (cancelled) return
      const patches = new Map(
        missing.map((name, i) => [name, urls[i]] as const).filter(([, url]) => Boolean(url))
      )
      if (!patches.size) return
      setData(prev => prev && ({
        ...prev,
        films: prev.films.map(f => (!f.pic && patches.get(f.name) ? { ...f, pic: patches.get(f.name)! } : f))
      }))
    })
    return () => { cancelled = true }
  }, [data])

  const regenerate = useCallback(() => {
    if (!topic) return
    clearCurateCache(topic)
    load(topic, true)
  }, [topic, load])

  /** 同一主题再选一次视为重新生成；换主题才改 URL。 */
  const choose = useCallback((value: string) => {
    const next = value.trim().slice(0, 40)
    if (!next) return
    if (next === topic) regenerate()
    else onTopic(next)
  }, [topic, regenerate, onTopic])

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    choose(input)
  }

  const active = Boolean(topic) || loading || Boolean(data) || Boolean(error)
  const stage = elapsed < 4 ? STAGES[0] : elapsed < 12 ? STAGES[1] : STAGES[2]
  const hue = topicHue(topic || '私人影展')

  return (
    <div
      className={`space-layer ${open ? 'open' : ''} ${active ? 'is-active' : ''}`}
      style={{ '--space-hue': hue } as CSSProperties}
      aria-hidden={!open}
      aria-label="AI 策展空间"
    >
      <div className="space-ambient" aria-hidden="true" />

      <header className="space-topbar">
        <button type="button" className="space-back" onClick={onClose}>
          <ArrowLeft className="w-4 h-4" /> 返回主界面
        </button>
        <span className="space-brand"><Sparkles className="w-4 h-4" /> AI 策展空间</span>
        <span className="space-count">{data ? `${data.films.length} 部` : ''}</span>
      </header>

      <main className="space-main">
        <section className="space-hero">
          <div className="space-eyebrow">PRIVATE SCREENING ROOM · 私人放映室</div>
          <h1 className="space-heading">
            {active ? (topic || '私人影展') : <>给一个名字，<br />还你一整座影展。</>}
          </h1>
          {!active && (
            <p className="space-lead">
              输入一位导演、一种风格，或某个说不清的念头。AI 列出片名，检索脚本补齐海报与线路，
              把这一整层空间布置成只属于你的片单。
            </p>
          )}

          <form className="space-form" onSubmit={submit}>
            <Wand2 className="w-5 h-5 shrink-0" aria-hidden />
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              maxLength={40}
              placeholder="例如：克里斯托弗·诺兰 / 赛博朋克 / 治愈系..."
              aria-label="导演或主题"
            />
            <button type="submit" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 spin" /> : '生成影展'}
            </button>
          </form>

          {!active && (
            <div className="space-presets">
              {PRESETS.map(preset => (
                <button type="button" key={preset} onClick={() => choose(preset)}>
                  {preset}
                </button>
              ))}
            </div>
          )}
        </section>

        {loading && (
          <>
            <section className="space-progress" aria-live="polite">
              <div className="space-progress-head">
                <Loader2 className="spin" />
                <span>{stage}…</span>
                <span className="space-elapsed">{elapsed}s</span>
              </div>
              <div className="space-progress-bar">
                <span style={{ width: `${Math.min(94, 10 + elapsed * 6)}%` }} />
              </div>
              <p className="space-progress-hint">
                AI 先列出片名，再逐部补齐海报与播放线路，通常需要 10–25 秒。
              </p>
            </section>
            <GallerySkeleton />
          </>
        )}

        {!loading && error && (
          <div className="space-error">
            <p>{error}</p>
            <button type="button" onClick={regenerate}>
              <RefreshCw className="w-4 h-4" /> 重试
            </button>
          </div>
        )}

        {!loading && data && (
          <section className="space-gallery" key={data.title}>
            <div className="space-gallery-head">
              <div>
                <span className="space-tag">{data.tag}</span>
                <h2 className="space-title">{data.title}</h2>
                {data.subtitle && <p className="space-subtitle">{data.subtitle}</p>}
              </div>
              <button type="button" className="space-regen" onClick={regenerate}>
                <RefreshCw className="w-4 h-4" /> 重新生成
              </button>
            </div>

            {data.intro && <p className="space-intro-text">{data.intro}</p>}

            <div className="space-grid">
              {data.films.map((film, i) => (
                <CuratedCard key={film.name} film={film} index={i} onSelect={onSelect} />
              ))}
            </div>

            <div className="space-footnote">
              <span>{data.ai ? 'AI 策展' : '实时检索'} · 共 {data.films.length} 部</span>
              <span>点海报直接播放；同一主题 30 分钟内不再调用 AI</span>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
