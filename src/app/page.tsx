'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { GestureLock } from '../components/GestureLock'
import { GATE_COOKIE, TTL, issueToken } from '../lib/gate'

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
  const router = useRouter()
  const [target, setTarget] = useState('/jilaotv')

  useEffect(() => {
    const lite = detectDeviceCapability()
    localStorage.setItem('jilaotv-mode', lite ? 'lite' : 'normal')
    setTarget(lite ? '/jilaotv?mode=lite' : '/jilaotv')
  }, [])

  const unlock = async () => {
    const token = await issueToken()
    document.cookie = `${GATE_COOKIE}=${token}; path=/; max-age=${TTL}; SameSite=Lax`
    router.replace(target)
  }

  return (
    <main className="min-h-screen bg-black flex flex-col items-center justify-center px-6">
      <h1 className="text-3xl font-semibold text-white tracking-wide mb-12">机佬TV</h1>
      <GestureLock onUnlock={unlock} />
    </main>
  )
}
