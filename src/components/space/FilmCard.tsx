/** 影展卡片：海报 + 片名 + 推荐语。spotlight 版式下首张会铺成封面。 */
'use client'

import { memo } from 'react'
import { Play } from 'lucide-react'
import { Poster } from '../Poster'
import type { CuratedFilm } from '../../lib/curate'
import s from './space.module.css'

interface Props {
  film: CuratedFilm
  index: number
  onSelect: (film: CuratedFilm) => void
}

export const FilmCard = memo(function FilmCard({ film, index, onSelect }: Props) {
  return (
    <button
      type="button"
      className={s.card}
      data-testid="curated-card"
      onClick={() => onSelect(film)}
    >
      <span
        className={s.featureBg}
        style={film.pic ? { backgroundImage: `url(${film.pic})` } : undefined}
        aria-hidden
      />

      <div className={s.poster}>
        <Poster src={film.pic} alt={film.name} referrerPolicy="no-referrer" />
        <span className={s.index}>{String(index + 1).padStart(2, '0')}</span>
        <span className={s.play} aria-hidden>
          <Play className="w-5 h-5 fill-current" />
        </span>
      </div>

      <div className={s.body}>
        <div className={s.name} data-testid="film-name">{film.name}</div>
        {film.year && <div className={s.year}>{film.year}</div>}
        {film.note && <p className={s.note}>{film.note}</p>}
        <span className={s.cta}>
          <Play className="w-3 h-3 fill-current" /> 开始放映
        </span>
      </div>
    </button>
  )
})
