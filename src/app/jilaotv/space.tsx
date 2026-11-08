/**
 * AI 策展空间：与主界面平行的一层，只负责「发现」，播放交回主界面播放器。
 *
 * 分层：URL 的 topic 由父组件传入（本组件不改路由）；请求/缓存/竞态在 lib/curate；
 * 手势在 lib/use-swipe；卡片在 components/CuratedCard；样式只依赖既有 token。
 * 这样主界面与空间互不知晓对方内部状态，切换只靠一个 URL 参数。
 */
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties, FormEvent } from 'react'
import { ArrowLeft, Sparkles, Wand2, RefreshCw, Loader2 } from 'lucide-react'
import { CuratedCard } from '../../components/CuratedCard'
import { fetchCurated, clearCurateCache, topicHue } from '../../lib/curate'
import type { CuratedFilm, CuratedSpace } from '../../lib/curate'
import { useSwipe } from '../../lib/use-swipe'

const PRESETS = ['克里斯托弗·诺兰', '宫崎骏', '赛博朋克', '悬疑烧脑', '治愈系', '王家卫']

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
  const abortRef = useRef<AbortController | null>(null)

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
        if (!ctrl.signal.aborted) setError(err instanceof Error ? err.message : '生成失败')
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

  const regenerate = useCallback(() => {
    if (!topic) return
    clearCurateCache(topic)
    load(topic, true)
  }, [topic, load])

  /** 同一主题重复选择视为「重新生成」，不同主题才改 URL、才可能触发新一次 AI。 */
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

  useSwipe({ onSwipeLeft: onClose, enabled: open })

  const hue = topicHue(topic || '私人影展')

  return (
    <div
      className={`space-layer ${open ? 'open' : ''}`}
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
        <span className="space-hint">左滑返回</span>
      </header>

      <main className="space-main">
        <section className="space-hero">
          <div className="space-eyebrow">PRIVATE SCREENING ROOM · 私人放映室</div>
          <h1 className="space-heading">给一个名字，<br />还你一整座影展。</h1>
          <p className="space-lead">
            输入一位导演、一种风格，或某个说不清的念头。AI 列出片名，检索脚本补齐海报与线路，
            把这一整层空间布置成只属于你的片单。
          </p>

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

          <div className="space-presets">
            {PRESETS.map(preset => (
              <button
                type="button"
                key={preset}
                className={preset === topic ? 'active' : ''}
                onClick={() => choose(preset)}
              >
                {preset}
              </button>
            ))}
          </div>
        </section>

        {loading && <GallerySkeleton />}

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
                <p className="space-subtitle">{data.subtitle}</p>
              </div>
              <button type="button" className="space-regen" onClick={regenerate}>
                <RefreshCw className="w-4 h-4" /> 重新生成
              </button>
            </div>

            <p className="space-intro-text">{data.intro}</p>

            <div className="space-grid">
              {data.films.map((film, i) => (
                <CuratedCard key={film.name} film={film} index={i} onSelect={onSelect} />
              ))}
            </div>

            <div className="space-footnote">
              <span>{data.ai ? 'AI 策展' : '实时检索'} · 共 {data.films.length} 部</span>
              <span>同一主题 30 分钟内缓存，刷新与切换不再调用 AI；点击海报直接观看，无需二次搜索。</span>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
