/** 影展面板：标题区、导语、海报网格与页脚。版式由 AI 选择（gallery / spotlight）。 */
'use client'

import { RefreshCw } from 'lucide-react'
import { FilmCard } from './FilmCard'
import type { CuratedFilm, CuratedSpace } from '../../lib/curate'
import s from './space.module.css'

interface Props {
  data: CuratedSpace
  onSelect: (film: CuratedFilm) => void
  onRegenerate: () => void
}

export function Gallery({ data, onSelect, onRegenerate }: Props) {
  return (
    <article className={s.gallery} data-testid="space-gallery">
      <header className={s.galleryHead}>
        <div className={s.headText}>
          <span className={s.badge}>{data.tag}</span>
          {data.eyebrow && <p className={s.mood}>{data.eyebrow}</p>}
          <h2 className={s.title} data-testid="space-title">{data.title}</h2>
          {data.subtitle && <p className={s.subtitle}>{data.subtitle}</p>}
        </div>
        <button type="button" className={s.regen} data-testid="space-regen" onClick={onRegenerate}>
          <RefreshCw className="w-4 h-4" /> 换一批
        </button>
      </header>

      {data.intro && <p className={s.intro}>{data.intro}</p>}

      <div className={s.grid} data-layout={data.layout}>
        {data.films.map((film, i) => (
          <FilmCard key={film.name} film={film} index={i} onSelect={onSelect} />
        ))}
      </div>

      <footer className={s.footnote}>
        <span>共 {data.films.length} 部 · {data.ai ? '私人策展' : '实时片单'}</span>
        <span>选一部，即刻放映</span>
      </footer>
    </article>
  )
}
