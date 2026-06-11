'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

// 扩展 Navigator 类型定义
interface NavigatorWithMemory extends Navigator {
  deviceMemory?: number
}

interface NavigatorWithConnection extends Navigator {
  connection?: {
    effectiveType?: string
  }
}

// 设备能力检测（后台运行，不影响UI）
function detectDeviceCapability(): boolean {
  let score = 100 // 满分100，低于50认为是低端设备

  // 1. 检测内存（低端手机通常内存小）
  const memory = (navigator as NavigatorWithMemory).deviceMemory
  if (memory !== undefined) {
    if (memory < 2) {
      score -= 30
    } else if (memory < 4) {
      score -= 15
    }
  }

  // 2. 检测CPU核心数
  const cores = navigator.hardwareConcurrency
  if (cores !== undefined) {
    if (cores < 2) {
      score -= 25
    } else if (cores < 4) {
      score -= 10
    }
  }

  // 3. 检测屏幕分辨率
  const screenPixels = window.screen.width * window.screen.height
  if (screenPixels < 500000) {
    score -= 20
  }

  // 4. 检测CSS特性支持（通过CSS.supports API）
  if (typeof CSS !== 'undefined' && CSS.supports) {
    if (!CSS.supports('width', 'clamp(10px, 1vw, 20px)')) {
      score -= 15
    }
    if (!CSS.supports('display', 'grid')) {
      score -= 10
    }
    if (!CSS.supports('backdrop-filter', 'blur(5px)')) {
      score -= 5
    }
    if (!CSS.supports('aspect-ratio', '2/3')) {
      score -= 15
    }
  }

  // 5. 检测网络类型（2G/3G网络）
  const connection = (navigator as NavigatorWithConnection).connection
  if (connection?.effectiveType) {
    const type = connection.effectiveType
    if (type === '2g' || type === 'slow-2g') {
      score -= 30
    } else if (type === '3g') {
      score -= 15
    }
  }

  // 6. 检测浏览器UA（检测是否是老旧浏览器）
  const ua = navigator.userAgent
  if (ua.includes('Android 4') || ua.includes('Android 5')) {
    score -= 25
  }
  if (ua.includes('UCBrowser') || ua.includes('Quark')) {
    score -= 10
  }

  console.log('📊 设备检测评分:', score, score < 50 ? '(低端设备)' : '(正常设备)')

  return score < 50
}

export default function Home() {
  // 检测结果状态
  const [isLowEnd, setIsLowEnd] = useState<boolean | null>(null)

  useEffect(() => {
    // 后台检测设备能力
    const result = detectDeviceCapability()
    setIsLowEnd(result)
    // 保存结果到 localStorage
    localStorage.setItem('jilaotv-mode', result ? 'lite' : 'normal')
  }, [])

  // 根据检测结果生成跳转路径
  const targetPath = isLowEnd === null ? '/jilaotv' : (isLowEnd ? '/jilaotv?mode=lite' : '/jilaotv')

  return (
    <div className="min-h-screen flex items-center justify-center bg-black">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-white mb-8">
          机佬TV
        </h1>
        <Link 
          href={targetPath}
          className="text-2xl text-blue-500 hover:text-blue-400 transition-colors cursor-pointer"
        >
          点击进入 →
        </Link>
      </div>
    </div>
  )
}