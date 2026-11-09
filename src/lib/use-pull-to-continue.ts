import { useEffect, useRef, type RefObject } from 'react'

const DRAG = 72   // 触屏续滑距离
const WHEEL = 240 // 滚轮累积距离
const IDLE = 480  // 滚轮停顿多久算新的一次手势

/**
 * 滚到底后继续下滑就触发（触屏用手指上滑，滚轮继续下滚）。
 * 传入 scrollRef 时按该容器判断，不传按整个页面。
 * 只认「起手时已经在底部」的手势：一路翻到底不会顺手触发，
 * 需要停下来再滑一下，意图更明确。进度写进 --pull，不触发 React 重渲染。
 */
export function usePullToContinue(
  onTrigger: () => void,
  enabled: boolean,
  hintRef: RefObject<HTMLElement | null>,
  scrollRef?: RefObject<HTMLElement | null>
) {
  const handler = useRef(onTrigger)
  useEffect(() => { handler.current = onTrigger }, [onTrigger])

  useEffect(() => {
    if (!enabled) return
    const hint = hintRef.current
    const root = scrollRef?.current ?? null
    let startY = 0
    let pulled = 0
    let locked = false
    let touchReady = false
    let wheelReady = false
    let lastWheel = 0
    let idle = 0
    let frame = 0

    const atBottom = () =>
      root
        ? root.scrollTop + root.clientHeight >= root.scrollHeight - 2
        : window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2

    // 事件必须落在自己的滚动容器里：上层详情浮层的滑动不能带着空间退出
    const inRoot = (e: Event) => !root || root.contains(e.target as Node)

    const paint = (progress: number) => {
      if (!hint) return
      if (frame) cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        frame = 0
        hint.style.setProperty('--pull', String(Math.min(1, Math.max(0, progress))))
        hint.classList.toggle('pulling', progress > 0)
      })
    }

    const reset = () => {
      pulled = 0
      paint(0)
    }

    const enter = () => {
      locked = true
      reset()
      handler.current()
    }

    const onTouchStart = (e: TouchEvent) => {
      locked = false
      touchReady = inRoot(e) && atBottom()
      startY = e.touches[0].clientY
      pulled = 0
      paint(0)
    }

    const onTouchMove = (e: TouchEvent) => {
      if (locked || !touchReady || e.touches.length > 1 || !inRoot(e)) return
      if (!atBottom()) return reset()
      // 到底后手指继续上滑：内容已到尽头还想往下翻
      pulled = startY - e.touches[0].clientY
      if (pulled <= 0) return reset()
      if (pulled >= DRAG) return enter()
      paint(pulled / DRAG)
    }

    const onTouchEnd = () => {
      locked = false
      touchReady = false
      reset()
    }

    const onWheel = (e: WheelEvent) => {
      if (locked || !inRoot(e)) return
      const now = Date.now()
      if (!atBottom() || e.deltaY <= 0) {
        lastWheel = now
        wheelReady = false
        return reset()
      }
      // 停顿过再滚才算新的一次；连续滚到底不会顺势触发
      if (now - lastWheel > IDLE) wheelReady = true
      lastWheel = now
      if (!wheelReady) return
      pulled += e.deltaY
      if (pulled >= WHEEL) return enter()
      paint(pulled / WHEEL)
      clearTimeout(idle)
      idle = window.setTimeout(reset, IDLE)
    }

    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: true })
    window.addEventListener('touchend', onTouchEnd, { passive: true })
    window.addEventListener('touchcancel', onTouchEnd, { passive: true })
    window.addEventListener('wheel', onWheel, { passive: true })

    return () => {
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
      window.removeEventListener('touchcancel', onTouchEnd)
      window.removeEventListener('wheel', onWheel)
      clearTimeout(idle)
      if (frame) cancelAnimationFrame(frame)
      hint?.style.removeProperty('--pull')
      hint?.classList.remove('pulling')
    }
  }, [enabled, hintRef, scrollRef])
}
