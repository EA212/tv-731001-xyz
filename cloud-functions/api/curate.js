/**
 * AI 策展空间 · POST /api/curate
 *
 * 链路（一个主题最多 1 次模型调用）：
 *   1) askModel    官方 OpenAI SDK 调 Makers Models 网关，json_object 结构化输出，
 *                   只产出「片名清单 + 策展文案」，不让 AI 找图找源；
 *   2) enrichFilms 采集站检索脚本（零 AI）按片名批量补海报 + 可播放线路；
 *   3) 一次响应返回完整片单，前端不再逐片调 /api/search。
 * 前端另有 30 分钟缓存，刷新 / 来回切换 / 点播放都不再触发模型。
 *
 * 密钥：Makers 控制台环境变量，按官方 EventContext 契约只从 context.env 读取。
 * 无密钥或模型不可用时退化为真实检索，绝不伪造片单。
 */

import OpenAI from 'openai'

const BASE_URL = 'https://ai-gateway.edgeone.link/v1'
const MODEL = '@makers/deepseek-v4-flash'
const MAX_FILMS = 12
const AI_TIMEOUT = 20_000
const SITE_TIMEOUT = 8_000

// 与 /api/search、/api/detail 同源同 key，保证拿到的线路能直接交给播放器。
const SITES = [
  { key: 'ffzy', name: '非凡影视', api: 'https://api.ffzyapi.com/api.php/provide/vod' },
  { key: 'bfzy', name: '暴风资源', api: 'https://bfzyapi.com/api.php/provide/vod' },
  { key: 'jisu', name: '极速资源', api: 'https://jszyapi.com/api.php/provide/vod' }
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

const badPic = (pic) => !pic || /mac_default|nopic|undefined/i.test(pic)

/** 采集站检索脚本：按片名取详情列表（与 /api/search 的 ac=detail 一致）。 */
async function querySite(site, wd, signal) {
  const url = `${site.api}?ac=detail&wd=${encodeURIComponent(wd)}&out=json`
  const res = await fetch(url, { signal, headers: HEADERS })
  if (!res.ok) return []
  const data = await res.json()
  return Array.isArray(data?.list) ? data.list : []
}

/** 按片名批量跑检索脚本：拿到真实海报 + 可直接播放的线路。 */
async function resolveFilm(name, signal) {
  const lists = await Promise.all(
    SITES.map(site => querySite(site, name, signal).catch(() => []))
  )
  const target = normalize(name)
  let pic = ''
  const sources = []

  lists.forEach((list, i) => {
    const hit =
      list.find(item => normalize(item.vod_name) === target) ??
      list.find(item => normalize(item.vod_name).startsWith(target))
    if (!hit) return
    if (!pic && !badPic(hit.vod_pic)) pic = hit.vod_pic
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

// ---------------------------------------------------------------- 一次 AI 调用

/** JSON Output 官方要求：prompt 含 "json" 字样，并给出目标 JSON 样例。 */
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

/** 网关已保证合法 JSON；此处只做字段裁剪与去重，不再手写括号抠取。 */
function parsePlan(raw, topic) {
  let parsed
  try {
    parsed = JSON.parse(String(raw ?? ''))
  } catch {
    return null
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
  if (films.length === 0) return null

  return {
    title: text(parsed.title, 40) || `${topic} · 私人影展`,
    subtitle: text(parsed.subtitle, 60) || '为你挑选的一份片单',
    tag: text(parsed.tag, 12) || '私人策展',
    intro: text(parsed.intro, 200),
    films,
    ai: true
  }
}

/**
 * 官方 SDK 调用：baseURL 指向 Makers Models 网关，模型 ID 用 @makers/ 内置模型。
 * maxRetries: 0 —— SDK 默认重试 2 次，会凭空多烧 2 次额度，必须关掉。
 */
async function askModel(topic, key, signal) {
  const client = new OpenAI({
    apiKey: key,
    baseURL: BASE_URL,
    timeout: AI_TIMEOUT,
    maxRetries: 0
  })
  const completion = await client.chat.completions.create(
    {
      model: MODEL,
      temperature: 0.8,
      max_tokens: 1400,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: buildPrompt(topic) }]
    },
    { signal }
  )
  return parsePlan(completion.choices?.[0]?.message?.content, topic)
}

/** 无密钥或模型不可用时，直接跑检索脚本，绝不伪造片单。 */
async function searchPlan(topic, signal) {
  const lists = await Promise.all(
    SITES.map(site => querySite(site, topic, signal).catch(() => []))
  )
  const seen = new Set()
  const films = []

  lists.forEach((list, i) => {
    for (const item of list) {
      const name = text(item.vod_name, 40)
      const key = normalize(name)
      if (!name || seen.has(key)) continue
      seen.add(key)
      films.push({
        name,
        year: text(item.vod_year, 8),
        note: text(item.vod_remarks || item.type_name, 60) || '全网实时检索结果',
        pic: badPic(item.vod_pic) ? '' : item.vod_pic,
        sources: item.vod_id
          ? [{ site_name: SITES[i].name, site_key: SITES[i].key, vod_id: String(item.vod_id), latency: 999 }]
          : []
      })
      if (films.length >= MAX_FILMS) break
    }
  })
  if (films.length === 0) return null
  return {
    title: `关于「${topic}」`,
    subtitle: '全网实时检索 · 未启用 AI 策展',
    tag: '实时检索',
    intro: 'AI 模型未配置或暂不可用，以下为采集站按关键词返回的真实片单。配置 MAKERS_MODELS_KEY 后即可获得带策展导语的私人影展。',
    films: films.slice(0, MAX_FILMS),
    ai: false
  }
}

// ---------------------------------------------------------------- 检索脚本补全

async function enrichFilms(plan, signal) {
  const films = await Promise.all(
    plan.films.map(async film => {
      if (film.pic && film.sources.length > 0) return film
      const found = await resolveFilm(film.name, signal).catch(() => ({ pic: '', sources: [] }))
      return {
        ...film,
        pic: film.pic || found.pic,
        sources: film.sources.length > 0 ? film.sources : found.sources
      }
    })
  )
  return { ...plan, films }
}

// ---------------------------------------------------------------- 出口

/** Makers 环境变量按官方 EventContext 契约注入 context.env（云函数内不用 process.env）。 */
const getKey = (context) => context?.env?.MAKERS_MODELS_KEY ?? ''

export async function onRequestPost(context) {
  let topic = ''
  try {
    topic = text((await context.request.json())?.topic, 40)
  } catch {
    return json({ error: '请求体必须是 JSON' }, 400)
  }
  if (!topic) return json({ error: '请输入导演或主题' }, 400)

  const key = getKey(context)
  const aiSignal = AbortSignal.timeout(AI_TIMEOUT)
  const siteSignal = AbortSignal.timeout(SITE_TIMEOUT)

  // 模型只在这里被调用一次；后面全是零 AI 的检索脚本。
  let plan = key ? await askModel(topic, key, aiSignal).catch(() => null) : null
  if (!plan) plan = await searchPlan(topic, siteSignal).catch(() => null)
  if (!plan) return json({ error: '暂时没有找到相关片单，换一个导演或主题试试' }, 502)

  return json(await enrichFilms(plan, siteSignal))
}
