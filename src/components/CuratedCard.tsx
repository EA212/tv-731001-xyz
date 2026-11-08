/** 策展卡片：海报、名称复用主界面样式，只额外承担序号与推荐语。 */
'use client'

import { memo } from 'react'
import { Play } from 'lucide-react'
import { Poster } from './Poster'
import type { CuratedFilm } from '../lib/curate'

export const CuratedCard = memo(function CuratedCard({
  film,
  index,
  onSelect
}: {
  film: CuratedFilm
  index: number
  onSelect: (film: CuratedFilm) => void
}) {
  return (
    <button type="button" className="curated-card" onClick={() => onSelect(film)}>
      <div className="poster-wrap">
        <Poster src={film.pic} alt={film.name} referrerPolicy="no-referrer" />
        <span className="curated-index">{String(index + 1).padStart(2, '0')}</span>
        <span className="curated-play" aria-hidden><Play className="w-5 h-5 fill-current" /></span>
      </div>
      <div className="movie-name">{film.name}</div>
      <div className="curated-meta">{film.year || '—'}</div>
      <p className="curated-note">{film.note}</p>
    </button>
  )
})
