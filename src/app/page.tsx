'use client'

import { useEffect, useState } from 'react'
import { GestureLock } from '../components/GestureLock'
import { sanitizeNext } from '../lib/deeplink'

interface NavigatorWithMemory extends Navigator {
  deviceMemory?: number
}

interface NavigatorWithConnection extends Navigator {
  connection?: {
    effectiveType?: string
  }
}

function detectDeviceCapability(): boolean {
  let score = 100

  const memory = (navigator as NavigatorWithMemory).deviceMemory
  if (memory !== undefined) {
    if (memory < 2) score -= 30
    else if (memory < 4) score -= 15
  }

  const cores = navigator.hardwareConcurrency
  if (cores !== undefined) {
    if (cores < 2) score -= 25
    else if (cores < 4) score -= 10
  }

  const screenPixels = window.screen.width * window.screen.height
  if (screenPixels < 500000) score -= 20

  if (typeof CSS !== 'undefined' && CSS.supports) {
    if (!CSS.supports('width', 'clamp(10px, 1vw, 20px)')) score -= 15
    if (!CSS.supports('display', 'grid')) score -= 10
    if (!CSS.supports('backdrop-filter', 'blur(5px)')) score -= 5
    if (!CSS.supports('aspect-ratio', '2/3')) score -= 15
  }

  const connection = (navigator as NavigatorWithConnection).connection
  if (connection?.effectiveType) {
    const type = connection.effectiveType
    if (type === '2g' || type === 'slow-2g') score -= 30
    else if (type === '3g') score -= 15
  }

  const ua = navigator.userAgent
  if (ua.includes('Android 4') || ua.includes('Android 5')) score -= 25
  if (ua.includes('UCBrowser') || ua.includes('Quark')) score -= 10

  return score < 50
}

export default function Home() {
  const [target, setTarget] = useState('/jilaotv')
  const [ready, setReady] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    const lite = detectDeviceCapability()
    localStorage.setItem('jilaotv-mode', lite ? 'lite' : 'normal')
    // 分享链接带回跳目标时原样跳回，并把设备模式一并带上。
    const next = sanitizeNext(new URLSearchParams(window.location.search).get('next'))
    const base = next ?? '/jilaotv'
    if (lite) {
      const url = new URL(base, window.location.origin)
      if (!url.searchParams.has('mode')) url.searchParams.set('mode', 'lite')
      setTarget(url.pathname + url.search)
    } else {
      setTarget(base)
    }
  }, [])

  const go = () => window.location.replace(target)

  const unlock = () => {
    setError(false)
    void fetch('/api/unlock', { method: 'POST' })
      .then(res => {
        if (!res.ok) throw new Error('unlock failed')
        setReady(true)
        go()
      })
      .catch(() => setError(true))
  }

  return (
    <main className="min-h-screen bg-black flex flex-col items-center justify-center px-6">
      <h1 className="text-3xl font-semibold text-white tracking-wide mb-12">机佬TV</h1>
      {ready ? (
        <button
          type="button"
          onClick={go}
          className="px-8 py-3 rounded-full bg-white text-black text-sm font-medium"
        >
          进入
        </button>
      ) : (
        <>
          <GestureLock onUnlock={unlock} />
          {error && <p className="mt-2 text-sm text-red-400">解锁失败，请再画一次</p>}
        </>
      )}
    </main>
  )
}
