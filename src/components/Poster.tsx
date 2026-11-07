/* eslint-disable @next/next/no-img-element */
'use client'

// 海报来自用户浏览器直连的采集站/TMDb 图床，不经服务端图片优化，
// 用原生 <img> + loading/decoding 更省流量，也不必配置远程域名白名单。
import { memo, useState } from 'react'
import type { CSSProperties } from 'react'
import { FALLBACK, isBadPic } from '../lib/poster'

interface Props {
  src: string
  alt: string
  className?: string
  style?: CSSProperties
  referrerPolicy?: 'no-referrer' | 'origin' | 'unsafe-url'
}

/**
 * 声明式海报：加载失败只更新 state，不直接改 DOM。
 * src 变化时自动脱离失败态；占位图再失败也不会触发无限 onError。
 */
export const Poster = memo(function Poster({ src, alt, className, style, referrerPolicy }: Props) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const current = failedSrc === src || isBadPic(src) ? FALLBACK : src

  return (
    <img
      src={current}
      alt={alt}
      className={className}
      style={style}
      loading="lazy"
      decoding="async"
      referrerPolicy={referrerPolicy}
      onError={() => setFailedSrc(src)}
    />
  )
})
