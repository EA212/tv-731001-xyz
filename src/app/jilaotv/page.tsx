/**
 * 服务端直出静态数据：首屏 HTML 就带真实榜单与海报，
 * 不需要客户端再发一次 /static-data.json，也不需要骨架屏等待。
 */
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import JilaotvClient from './client'
import StaticHome from './static-home'
import type { StaticData } from '../../lib/types'

export default async function JilaotvPage() {
  const file = path.join(process.cwd(), 'public', 'static-data.json')
  const initialData = JSON.parse(await readFile(file, 'utf8')) as StaticData
  return (
    <JilaotvClient
      initialData={initialData}
      fallback={<StaticHome data={initialData} />}
    />
  )
}
