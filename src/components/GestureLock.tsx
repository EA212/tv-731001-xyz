'use client'

import { useRef, useState } from 'react'

const SIZE = 300
const HIT = 34
const PATTERN = [0, 3, 6, 7, 8]
const DOTS = Array.from({ length: 9 }, (_, i) => ({
  x: 60 + (i % 3) * 90,
  y: 60 + Math.floor(i / 3) * 90,
}))

export function GestureLock({ onUnlock }: { onUnlock: () => void }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const pathRef = useRef<number[]>([])
  const drawing = useRef(false)
  const [path, setPath] = useState<number[]>([])
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null)
  const [failed, setFailed] = useState(false)

  const track = (clientX: number, clientY: number) => {
    if (!drawing.current || !svgRef.current) return
    const box = svgRef.current.getBoundingClientRect()
    const point = {
      x: (clientX - box.left) * SIZE / box.width,
      y: (clientY - box.top) * SIZE / box.height,
    }
    setCursor(point)

    let hit = -1
    let nearest = HIT
    DOTS.forEach((dot, index) => {
      const distance = Math.hypot(dot.x - point.x, dot.y - point.y)
      if (distance < nearest && !pathRef.current.includes(index)) {
        nearest = distance
        hit = index
      }
    })
    if (hit >= 0) {
      pathRef.current = [...pathRef.current, hit]
      setPath(pathRef.current)
    }
  }

  const start = (clientX: number, clientY: number) => {
    drawing.current = true
    pathRef.current = []
    setPath([])
    setFailed(false)
    track(clientX, clientY)
  }

  const finish = () => {
    if (!drawing.current) return
    drawing.current = false
    setCursor(null)

    const matched = pathRef.current.length === PATTERN.length &&
      pathRef.current.every((value, index) => value === PATTERN[index])
    if (matched) {
      onUnlock()
      return
    }

    setFailed(true)
    setTimeout(() => {
      pathRef.current = []
      setPath([])
      setFailed(false)
    }, 600)
  }

  return (
    <>
      <svg
        ref={svgRef}
        viewBox="0 0 300 300"
        className="w-[270px] h-[270px] touch-none select-none"
        style={{ touchAction: 'none' }}
        onMouseDown={event => {
          event.preventDefault()
          start(event.clientX, event.clientY)
        }}
        onMouseMove={event => track(event.clientX, event.clientY)}
        onMouseUp={finish}
        onMouseLeave={finish}
        onTouchStart={event => start(event.touches[0].clientX, event.touches[0].clientY)}
        onTouchMove={event => track(event.touches[0].clientX, event.touches[0].clientY)}
        onTouchEnd={finish}
      >
        <polyline
          points={PATTERN.map(i => `${DOTS[i].x},${DOTS[i].y}`).join(' ')}
          fill="none"
          stroke="rgba(255,255,255,0.18)"
          strokeWidth={2}
          strokeDasharray="1 11"
          strokeLinecap="round"
        />
        {path.length > 0 && (
          <polyline
            points={[
              ...path.map(i => `${DOTS[i].x},${DOTS[i].y}`),
              cursor ? `${cursor.x},${cursor.y}` : '',
            ].join(' ')}
            fill="none"
            stroke={failed ? '#ef4444' : 'rgba(255,255,255,0.9)'}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        {DOTS.map((dot, index) => {
          const active = path.includes(index)
          const color = failed ? '#ef4444' : active ? '#ffffff' : '#52525b'
          return (
            <circle
              key={index}
              cx={dot.x}
              cy={dot.y}
              r={active ? 11 : 8}
              fill={active || failed ? color : '#09090b'}
              stroke={color}
              strokeWidth={2}
            />
          )
        })}
      </svg>

      <p className={`mt-8 text-sm ${failed ? 'text-red-400' : 'text-neutral-500'}`}>
        {failed ? '没画对，再来一次' : '按虚线画一遍'}
      </p>
    </>
  )
}
