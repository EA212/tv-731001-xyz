/** AI 策展空间：只负责取数与状态，视图交给 space/ 下的组件。 */
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { ArrowLeft, RefreshCw, Sparkles } from 'lucide-react'
import { SearchBar } from '../../components/space/SearchBar'
import { SkeletonGrid, StageProgress } from '../../components/space/StageProgress'
import { Gallery } from '../../components/space/Gallery'
import { accentFrom, clearCurateCache, fetchCurated, topicHue } from '../../lib/curate'
import type { CuratedFilm, CuratedSpace } from '../../lib/curate'
import { isBadPic, lookupPoster } from '../../lib/poster'
import s from '../../components/space/space.module.css'

const PRESETS = ['克里斯托弗·诺兰', '宫崎骏', '赛博朋克', '悬疑烧脑', '治愈系', '王家卫']
const STAGES = ['正在品味这个主题', '正在翻找片源', '正在布置放映厅']

interface Props {
  open: boolean
  topic: string
  onClose: () => void
  onTopic: (topic: string) => void
  onSelect: (film: CuratedFilm) => void
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

  useEffect(() => {
    if (!loading) { setElapsed(0); return }
    const start = Date.now()
    setElapsed(0)
    const id = window.setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 500)
    return () => window.clearInterval(id)
  }, [loading])

  // 云端没补到图的，用主界面同一套图库兜底补一次
  useEffect(() => {
    if (!data || posterHandled.current === data) return
    posterHandled.current = data
    const missing = data.films.filter(film => isBadPic(film.pic)).map(film => film.name)
    if (!missing.length) return

    let cancelled = false
    Promise.all(missing.map(name => lookupPoster(name).catch(() => null))).then(urls => {
      if (cancelled) return
      const patches = new Map(
        missing.map((name, i) => [name, urls[i]] as const).filter(([, url]) => Boolean(url))
      )
      if (!patches.size) return
      setData(prev => prev && {
        ...prev,
        films: prev.films.map(film =>
          !film.pic && patches.get(film.name) ? { ...film, pic: patches.get(film.name)! } : film
        )
      })
    })
    return () => { cancelled = true }
  }, [data])

  const regenerate = useCallback(() => {
    if (!topic) return
    clearCurateCache(topic)
    load(topic, true)
  }, [topic, load])

  /** 同一主题再选一次视为换一批；换主题才改 URL。 */
  const choose = useCallback((value: string) => {
    const next = value.trim().slice(0, 40)
    if (!next) return
    if (next === topic) regenerate()
    else onTopic(next)
  }, [topic, regenerate, onTopic])

  const active = Boolean(topic) || loading || Boolean(data) || Boolean(error)
  const stage = elapsed < 4 ? STAGES[0] : elapsed < 12 ? STAGES[1] : STAGES[2]
  const theme = accentFrom(data?.accent ?? '', topicHue(topic || '私人影展'))

  return (
    <div
      className={s.layer}
      data-testid="space-layer"
      data-open={open}
      data-active={active}
      style={{ '--accent': theme.accent, '--accent-ink': theme.ink } as CSSProperties}
      aria-hidden={!open}
      aria-label="AI 策展空间"
    >
      <div className={s.ambient} aria-hidden />

      <header className={s.topbar}>
        <button type="button" className={s.back} data-testid="space-back" onClick={onClose}>
          <ArrowLeft className="w-4 h-4" />
          <span className={s.backLabel}>返回</span>
        </button>
        <span className={s.brand}><Sparkles className="w-4 h-4" /> 策展空间</span>
        <span className={s.count}>{data ? `${data.films.length} 部` : ''}</span>
      </header>

      <main className={s.main}>
        <section className={s.hero}>
          <div className={s.eyebrow}>PRIVATE SCREENING ROOM</div>
          <h1 className={s.heading} data-testid="space-heading">
            {active ? (topic || '私人影展') : <>给一个名字，<br />还你一整座影展。</>}
          </h1>
          {!active && (
            <p className={s.lead}>
              一位导演、一种风格，或某个说不清的念头。剩下的，交给策展人。
            </p>
          )}

          <SearchBar
            value={input}
            loading={loading}
            presets={PRESETS}
            onChange={setInput}
            onSubmit={() => choose(input)}
            onPick={choose}
          />
        </section>

        {loading && (
          <>
            <StageProgress stage={stage} elapsed={elapsed} />
            <SkeletonGrid />
          </>
        )}

        {!loading && error && (
          <div className={s.error} data-testid="space-error">
            <p>{error}</p>
            <button type="button" className={s.retry} onClick={regenerate}>
              <RefreshCw className="w-4 h-4" /> 再试一次
            </button>
          </div>
        )}

        {!loading && data && (
          <Gallery
            key={`${data.title}-${data.films.length}`}
            data={data}
            onSelect={onSelect}
            onRegenerate={regenerate}
          />
        )}
      </main>
    </div>
  )
}
