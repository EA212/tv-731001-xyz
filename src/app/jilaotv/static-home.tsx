/* eslint-disable @next/next/no-img-element */
/**
 * 服务端直出的静态首屏：作为 Client 组件的 Suspense fallback。
 * 无 JS 也能看到完整榜单与海报，图片提前进入浏览器缓存；
 * 交互版 hydrate 后接管，src 相同因此不会重新加载、不会闪烁。
 */
import { toStaticImage } from '../../lib/tmdb'
import type { StaticData, MovieItem } from '../../lib/types'

const GROUPS = [
  { field: 'movieList', title: '全球震感·电影榜' },
  { field: 'tvList', title: '全球必追·剧集榜' },
  { field: 'listCn', title: '华语强档·国产剧' },
  { field: 'listKrjp', title: '日韩潮流·剧集/动漫' }
] as const

export default function StaticHome({ data }: { data: StaticData }) {
  const hero = data.heroList?.[0]

  return (
    <div className="app-shell" aria-hidden="true">
      <nav className="navbar-custom">
        <div className="brand">
          <img src="/logo.png" alt="" className="brand-logo" />
          <span className="brand-tag">MAX</span>
        </div>
      </nav>

      {hero && (
        <section className="hero">
          <div className="hero-slide">
            <div className="hero-bg" style={{ backgroundImage: `url(${hero.backdrop})` }} />
            <div className="hero-overlay">
              <div className="hero-content">
                <div className="hero-tag">本周 TOP 1</div>
                <h1 className="hero-title">{hero.title}</h1>
                <p className="hero-desc">{hero.overview}</p>
              </div>
            </div>
          </div>
        </section>
      )}

      <div className="search-section">
        <div className="search-box-wrapper">
          <input className="search-input" placeholder="输入片名、剧集、演员..." readOnly />
        </div>
      </div>

      {GROUPS.map(group => (
        <section className="section-container" key={group.field}>
          <div className="section-header">
            <div className="section-line" />
            <h2 className="section-title">{group.title}</h2>
          </div>
          <div className="hot-row">
            {(data[group.field] as MovieItem[]).map(item => (
              <div className="hot-card" key={item.id}>
                <div className="poster-wrap">
                  <img
                    src={toStaticImage(item.poster_path)}
                    alt={item.title ?? item.name ?? ''}
                    loading="lazy"
                    decoding="async"
                  />
                  <span className="rating-badge">{item.vote_average.toFixed(1)}</span>
                </div>
                <div className="movie-name">{item.title ?? item.name}</div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
