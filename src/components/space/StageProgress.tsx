/** 生成中的反馈：阶段文案、已用秒数、进度条，以及下方骨架。 */
'use client'

import { Loader2 } from 'lucide-react'
import s from './space.module.css'

const SKELETON_COUNT = 8

export function StageProgress({ stage, elapsed }: { stage: string; elapsed: number }) {
  return (
    <section className={s.progress} data-testid="space-progress" aria-live="polite">
      <div className={s.progressHead}>
        <Loader2 className="spin" aria-hidden />
        <span>{stage}…</span>
        <span className={s.elapsed}>{elapsed}s</span>
      </div>
      <div className={s.bar}>
        <span style={{ width: `${Math.min(94, 12 + elapsed * 6)}%` }} />
      </div>
      <p className={s.hint}>片单正在路上，通常十几秒。</p>
    </section>
  )
}

export function SkeletonGrid() {
  return (
    <div className={s.skeletonGrid} aria-hidden>
      {Array.from({ length: SKELETON_COUNT }, (_, i) => (
        <div className={s.skeletonCard} key={i}>
          <div className={s.skPoster} />
          <div className={s.skLine} />
          <div className={s.skLine} />
        </div>
      ))}
    </div>
  )
}
