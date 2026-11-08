/**
 * POST /api/curate —— 一次请求返回完整影展。
 *
 * AI 只产出「片名 + 文案」，海报与线路由采集站检索补齐；
 * 模型不可用时退化为关键词检索，任何失败都返回可用结果而不是 502。
 * 密钥按 Cloud Functions 契约只从 context.env 读取。
 */

const BASE_URL = 'https://ai-gateway.edgeone.link/v1'
const MODEL = '@makers/deepseek-v4-flash'
const MAX_FILMS = 12
const AI_TIMEOUT = 30_000
const SITE_TIMEOUT = 4_000
const BUDGET = 52_000

const SITES = [
  { key: 'ffzy', name: '非凡影视', api: 'https://api.ffzyapi.com/api.php/provide/vod' },
  { key: 'bfzy', name: '暴风资源', api: 'https://bfzyapi.com/api.php/provide/vod' },
  { key: 'jisu', name: '极速资源', api: 'https://jszyapi.com/api.php/provide/vod' },
  { key: 'lzi', name: '量子资源', api: 'https://cj.lziapi.com/api.php/provide/vod' },
  { key: 'dbzy', name: '豆瓣资源', api: 'https://dbzy.tv/api.php/provide/vod' }
]

const HEADERS = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }

// ---------------------------------------------------------------- utils

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
  })

const text = (value, max) => String(value ?? '').replace(/[\r\n]+/g, ' ').trim().slice(0, max)

const normalize = (value) =>
  String(value ?? '').toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/g, '')

/** 坏图或 http 图床统一丢弃：https 页面里加载 http 图会被浏览器直接拦掉。 */
const safePic = (pic) => {
  const url = String(pic ?? '').trim()
  if (!url || /mac_default|nopic|undefined/i.test(url)) return ''
  return url.replace(/^http:\/\//i, 'https://')
}

/** 每个请求独立计时，绝不复用外层已经跑过头的 signal。 */
async function querySite(site, wd, ms) {
  const url = `${site.api}?ac=detail&wd=${encodeURIComponent(wd)}&out=json`
  const res = await fetch(url, { signal: AbortSignal.timeout(ms), headers: HEADERS })
  if (!res.ok) return []
  const data = await res.json()
  return Array.isArray(data?.list) ? data.list : []
}

// ---------------------------------------------------------------- 关键词直搜（兜底）

/** 既是 AI 不可用时的底稿，也顺手把海报与线路一次拿全。 */
async function searchByKeyword(topic) {
  const lists = await Promise.all(
    SITES.map(site => querySite(site, topic, 6_000).catch(() => []))
  )
  const seen = new Set()
  const films = []

  lists.forEach((list, i) => {
    if (films.length >= MAX_FILMS) return
    for (const item of list) {
      const name = text(item.vod_name, 40)
      const key = normalize(name)
      if (!name || seen.has(key)) continue
      seen.add(key)
      films.push({
        name,
        year: text(item.vod_year, 8),
        note: text(item.vod_remarks || item.type_name, 60) || '全网实时检索',
        pic: safePic(item.vod_pic),
        sources: item.vod_id
          ? [{ site_name: SITES[i].name, site_key: SITES[i].key, vod_id: String(item.vod_id), latency: 999 }]
          : []
      })
      if (films.length >= MAX_FILMS) break
    }
  })

  if (!films.length) return null
  return {
    title: `关于「${topic}」`,
    subtitle: '全网实时检索',
    tag: '实时检索',
    intro: '',
    films,
    ai: false
  }
}

// ---------------------------------------------------------------- 一次 AI 调用

/** JSON Output 要求 prompt 含 "json" 字样并给出目标结构样例。 */
function buildPrompt(topic) {
  return [
    '你是资深电影策展人。用户给出一个导演、类型或主题，请列出他值得看的片名。',
    '只输出一个 json 对象，不要解释文字、不要 markdown 代码块。',
    '严格遵循下面的 JSON 样例，键名与结构完全一致：',
    '{"title":"影展标题(8-16字,有意境)","subtitle":"副标题(10-20字)",',
    '"tag":"四字主题标签","intro":"50-80字策展导语",',
    '"films":[{"name":"通用中文片名","year":"年份","note":"15-30字推荐理由"}]}',
    '要求：films 8-12 部，必须是真实存在、与主题强相关的影视作品，',
    '片名用最通用的中文译名，不要编造、不要重复，按推荐优先级排列。',
    '只给片名和文案，不要提供海报地址、链接或播放地址，检索交给下游脚本完成。',
    `主题：${topic}`
  ].join('\n')
}

function parsePlan(raw, topic) {
  const source = String(raw ?? '')
  let parsed
  try {
    parsed = JSON.parse(source)
  } catch {
    // 推理模型可能把 token 预算耗在思考上，正文被截断：截到最后一个完整影片对象再补全数组
    const cut = source.lastIndexOf('"}')
    if (cut < 0) return null
    try {
      parsed = JSON.parse(`${source.slice(0, cut + 2)}]}`)
    } catch {
      return null
    }
  }
  if (!Array.isArray(parsed?.films) || parsed.films.length === 0) return null

  const seen = new Set()
  const films = parsed.films
    .map(f => ({
      name: text(f?.name, 40),
      year: text(f?.year, 8),
      note: text(f?.note, 60),
      pic: '',
      sources: []
    }))
    .filter(f => {
      const key = normalize(f.name)
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, MAX_FILMS)

  if (!films.length) return null
  return {
    title: text(parsed.title, 40) || `${topic} · 私人影展`,
    subtitle: text(parsed.subtitle, 60) || '为你挑选的一份片单',
    tag: text(parsed.tag, 12) || '私人策展',
    intro: text(parsed.intro, 200),
    films,
    ai: true
  }
}

async function askModel(topic, key) {
  // 延迟加载：依赖缺失或打包异常时只让 AI 这一步失败，不会把整个函数拖成 502
  const { default: OpenAI } = await import('openai')
  const client = new OpenAI({
    apiKey: key,
    baseURL: BASE_URL,
    timeout: AI_TIMEOUT,
    maxRetries: 0 // 默认重试 2 次，会凭空多烧两次额度
  })
  const completion = await client.chat.completions.create(
    {
      model: MODEL,
      temperature: 0.8,
      max_tokens: 4096, // 该模型带推理过程，1400 会被思考耗尽导致正文截断
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: buildPrompt(topic) }]
    },
    { signal: AbortSignal.timeout(AI_TIMEOUT) }
  )
  return parsePlan(completion.choices?.[0]?.message?.content, topic)
}

// ---------------------------------------------------------------- 补海报与线路

async function resolveFilm(name) {
  const lists = await Promise.all(
    SITES.map(site => querySite(site, name, SITE_TIMEOUT).catch(() => []))
  )
  const target = normalize(name)
  let pic = ''
  const sources = []

  lists.forEach((list, i) => {
    const hit =
      list.find(item => normalize(item.vod_name) === target) ??
      list.find(item => normalize(item.vod_name).startsWith(target))
    if (!hit) return
    if (!pic && safePic(hit.vod_pic)) pic = safePic(hit.vod_pic)
    if (hit.vod_id) {
      sources.push({
        site_name: SITES[i].name,
        site_key: SITES[i].key,
        vod_id: String(hit.vod_id),
        latency: 999
      })
    }
  })
  return { pic, sources }
}

/** 只补缺图或缺线路的片子；4 路并发，到预算就停，已拿到的照常返回。 */
async function enrich(plan, deadline) {
  const films = plan.films.slice()
  const todo = films
    .map((film, i) => ({ film, i }))
    .filter(({ film }) => !film.pic || film.sources.length === 0)

  let cursor = 0
  const worker = async () => {
    while (cursor < todo.length && Date.now() < deadline) {
      const { film, i } = todo[cursor++]
      const found = await resolveFilm(film.name).catch(() => null)
      if (!found) continue
      films[i] = {
        ...film,
        pic: film.pic || found.pic,
        sources: film.sources.length ? film.sources : found.sources
      }
    }
  }
  await Promise.all([worker(), worker(), worker(), worker()])
  return { ...plan, films }
}

// ---------------------------------------------------------------- 出口

export async function onRequestPost(context) {
  let topic = ''
  try {
    topic = text((await context.request.json())?.topic, 40)
  } catch {
    return json({ error: '请求体必须是 JSON' }, 400)
  }
  if (!topic) return json({ error: '请输入导演或主题' }, 400)

  const key = context?.env?.MAKERS_MODELS_KEY ?? ''
  const deadline = Date.now() + BUDGET

  try {
    // AI 与直搜同时起跑：模型慢或失败时，兜底结果已经在路上，不会出现空白 502。
    const [ai, fallback] = await Promise.all([
      key ? askModel(topic, key).catch(() => null) : Promise.resolve(null),
      searchByKeyword(topic).catch(() => null)
    ])

    const plan = ai ?? fallback
    if (!plan) return json({ error: '没有找到相关片单，换一个导演或主题试试', films: [] })

    return json(await enrich(plan, deadline))
  } catch {
    return json({ error: '生成失败，请稍后重试', films: [] })
  }
}
