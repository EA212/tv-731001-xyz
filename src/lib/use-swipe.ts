/**
 * 水平手势：统一处理触摸与鼠标拖拽，只认「水平主导」的位移。
 * 自动避开输入框、按钮、榜单横滑区，避免和页面原有交互打架。
 */
'use client'

import { useEffect } from 'react'

interface SwipeOptions {
  onSwipeRight?: () => void
  onSwipeLeft?: () => void
  enabled?: boolean
  threshold?: number
}

const IGNORE = 'input, textarea, select, button, a, .hot-row, [data-no-swipe]'

export function useSwipe({
  onSwipeRight,
  onSwipeLeft,
  enabled = true,
  threshold = 80
}: SwipeOptions): void {
  useEffect(() => {
    if (!enabled) return

    let startX = 0
    let startY = 0
    let tracking = false

    const onDown = (e: PointerEvent) => {
      const target = e.target
      if (!(target instanceof Element) || target.closest(IGNORE)) return
      startX = e.clientX
      startY = e.clientY
      tracking = true
      if (e.pointerType === 'mouse') document.body.style.userSelect = 'none'
    }

    const reset = () => {
      tracking = false
      document.body.style.userSelect = ''
    }

    const onUp = (e: PointerEvent) => {
      if (!tracking) return
      const dx = e.clientX - startX
      const dy = e.clientY - startY
      reset()
      if (Math.abs(dx) < threshold || Math.abs(dx) < Math.abs(dy) * 1.5) return
      if (dx > 0) onSwipeRight?.()
      else onSwipeLeft?.()
    }

    window.addEventListener('pointerdown', onDown, { passive: true })
    window.addEventListener('pointerup', onUp, { passive: true })
    window.addEventListener('pointercancel', reset, { passive: true })
    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', reset)
      document.body.style.userSelect = ''
    }
  }, [enabled, threshold, onSwipeRight, onSwipeLeft])
}
