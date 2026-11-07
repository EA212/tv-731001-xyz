'use client'

import { memo, useRef } from 'react'
import { Star, ChevronLeft, ChevronRight, Film, Tv, Globe, Sparkles } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Poster } from './Poster'
import { toStaticImage } from '../lib/tmdb'
import type { Group, MovieItem } from '../lib/types'

/** 卡片是模块级 memo 组件：父组件重渲染不会卸载重建 <img>，图片不再闪烁。 */
export const HotCard = memo(function HotCard({
  item,
  onSelect
}: {
  item: MovieItem
  onSelect: (name: string) => void
}) {
  const name = item.title ?? item.name ?? ''
  const date = (item.release_date ?? item.first_air_date ?? '').slice(0, 4)

  return (
    <button type="button" className="hot-card" onClick={() => onSelect(name)}>
      <div className="poster-wrap">
        <Poster src={toStaticImage(item.poster_path)} alt={name} />
        <span className="rating-badge">
          <Star className="w-3 h-3 fill-current" aria-hidden />
          {item.vote_average.toFixed(1)}
        </span>
      </div>
      <div className="movie-name">{name}</div>
      <div className="movie-date">{date}</div>
    </button>
  )
})

export const ResultCard = memo(function ResultCard({
  group,
  poster,
  onOpen
}: {
  group: Group
  poster?: string
  onOpen: (group: Group) => void
}) {
  return (
    <button type="button" className="result-card" onClick={() => onOpen(group)}>
      <div className="poster-wrap">
        <Poster src={poster ?? group.pic} alt={group.name} referrerPolicy="no-referrer" />
        <span className="rating-badge source-badge">{group.sources.length} 源</span>
      </div>
      <div className="movie-name">{group.name}</div>
    </button>
  )
})

function SkeletonRow() {
  return Array.from({ length: 8 }, (_, i) => (
    <div className="skeleton-card" key={i}>
      <div className="skeleton-poster" />
      <div className="skeleton-text" />
      <div className="skeleton-text-sm" />
    </div>
  ))
}

/** 四个榜单共用同一个组件，用 ref 操作真实 DOM，不再 querySelector + 硬编码卡宽。 */
export const HotSection = memo(function HotSection({
  title,
  icon: Icon,
  sectionKey,
  items,
  onSelect
}: {
  title: string
  icon: LucideIcon
  sectionKey: string
  items: MovieItem[]
  onSelect: (name: string) => void
}) {
  const rowRef = useRef<HTMLDivElement>(null)

  const scroll = (direction: 'prev' | 'next') => {
    const row = rowRef.current
    if (!row) return
    const card = row.firstElementChild as HTMLElement | null
    const amount = (card?.offsetWidth ?? 150) * 3
    row.scrollBy({ left: direction === 'prev' ? -amount : amount, behavior: 'smooth' })
  }

  return (
    <section className="section-container">
      <div className="section-header">
        <div className="section-line" />
        <h2 className="section-title">
          <Icon className="w-5 h-5 opacity-70" aria-hidden /> {title}
        </h2>
        {items.length > 0 && (
          <div className="hot-row-nav">
            <button type="button" className="nav-btn" aria-label="向左" onClick={() => scroll('prev')}>
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button type="button" className="nav-btn" aria-label="向右" onClick={() => scroll('next')}>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
      <div className="hot-row" data-section={sectionKey} ref={rowRef}>
        {items.length > 0
          ? items.map(item => <HotCard key={item.id} item={item} onSelect={onSelect} />)
          : <SkeletonRow />}
      </div>
    </section>
  )
})

export const SECTIONS = [
  { key: 'movie', field: 'movieList', title: '全球震感·电影榜', icon: Film },
  { key: 'tv', field: 'tvList', title: '全球必追·剧集榜', icon: Tv },
  { key: 'cn', field: 'listCn', title: '华语强档·国产剧', icon: Globe },
  { key: 'krjp', field: 'listKrjp', title: '日韩潮流·剧集/动漫', icon: Sparkles }
] as const
