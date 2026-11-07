/** 全站共享的数据类型，单一来源。 */

export interface MovieItem {
  id: number
  title?: string
  name?: string
  poster_path: string
  vote_average: number
  release_date?: string
  first_air_date?: string
  overview?: string
  backdrop_path?: string
}

export interface HeroItem {
  title: string
  overview: string
  backdrop: string
}

export interface StaticData {
  movieList: MovieItem[]
  tvList: MovieItem[]
  listCn: MovieItem[]
  listKrjp: MovieItem[]
  heroList: HeroItem[]
}

export interface SearchResult {
  vod_name: string
  vod_pic: string
  vod_id: string
  site_name: string
  site_key: string
  latency?: number
}

export interface Source {
  site_name: string
  site_key: string
  vod_id: string
  latency?: number
}

export interface Group {
  name: string
  pic: string
  sources: Source[]
}

export interface Episode {
  name: string
  url: string
}

export interface DPlayerInstance {
  destroy(): void
}

export interface DPlayerConstructor {
  new (options: {
    container: HTMLElement
    screenshot: boolean
    autoplay: boolean
    video: { url: string; type?: string }
  }): DPlayerInstance
}

declare global {
  interface Window {
    DPlayer?: DPlayerConstructor
  }
}
