'use client'

import { useEffect, useState } from 'react'
import { GestureLock } from '../components/GestureLock'
import { sanitizeNext } from '../lib/deeplink'

export default function Home() {
  const [target, setTarget] = useState('/jilaotv')
  const [ready, setReady] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    // 分享链接带回跳目标时原样跳回。
    setTarget(sanitizeNext(new URLSearchParams(window.location.search).get('next')) ?? '/jilaotv')
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
