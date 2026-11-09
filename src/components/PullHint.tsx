import type { RefObject } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

/**
 * 页面边缘的续拉提示：一行小字 + 边缘 1px 进度，贴在容器最上 / 最下沿。
 * 箭头指向去处：底部指向下（空间在下面），顶部指向上（回首页）。
 */
export function PullHint({
  side,
  label,
  hintRef
}: {
  side: 'top' | 'bottom'
  label: string
  hintRef: RefObject<HTMLDivElement | null>
}) {
  const Chevron = side === 'top' ? ChevronUp : ChevronDown
  return (
    <div className={side === 'top' ? 'pull-hint pull-hint--top' : 'pull-hint'} ref={hintRef}>
      <span className="pull-hint-text">
        <Chevron aria-hidden /> {label}
      </span>
      <span className="pull-hint-bar" aria-hidden><span /></span>
    </div>
  )
}
