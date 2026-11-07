#!/usr/bin/env node
/**
 * 生成 TMDB 密钥的两份份额（运行时合成，源码与构建产物中不含明文）。
 *
 * 用法：
 *   TMDB_API_KEY=<32位hex> node scripts/generate-key-shares.js
 *   npm run key:rotate
 *
 * 原理：
 *   cipher = key XOR mask
 *   shareA = cipher XOR stream(seedB)   -> 还原需要 B 模块的 seedB
 *   shareB = mask   XOR stream(seedA)   -> 还原需要 A 模块的 seedA
 *   两个模块各自只有一串看似随机的数字，单独看任何一个都推不出 key。
 *
 * 注意：这只是「反静态扫描」的加固，不能阻止他人从浏览器 Network 面板
 * 看到最终请求。轮换密钥是本方案最重要的止血手段，请定期执行本脚本。
 */
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const key = (process.env.TMDB_API_KEY || process.argv[2] || '').trim().toLowerCase()

if (!/^[a-f0-9]{32}$/.test(key)) {
  console.error('✗ 需要提供 32 位十六进制的 API key')
  console.error('  TMDB_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx node scripts/generate-key-shares.js')
  process.exit(1)
}

function stream(seed, n) {
  let x = seed >>> 0
  const out = []
  for (let i = 0; i < n; i++) {
    x ^= x << 13
    x >>>= 0
    x ^= x >>> 17
    x >>>= 0
    x ^= x << 5
    x >>>= 0
    out.push(x & 0xff)
  }
  return out
}

let seedA = crypto.randomBytes(4).readUInt32LE(0) >>> 0
let seedB = crypto.randomBytes(4).readUInt32LE(0) >>> 0
if (seedA === 0) seedA = 0x9e3779b9
if (seedB === 0) seedB = 0x85ebca6b

const keyBytes = Buffer.from(key, 'utf8')
const mask = crypto.randomBytes(keyBytes.length)
const sa = stream(seedA, keyBytes.length)
const sb = stream(seedB, keyBytes.length)
const shareA = []
const shareB = []

for (let i = 0; i < keyBytes.length; i++) {
  const cipher = keyBytes[i] ^ mask[i]
  shareA.push(cipher ^ sb[i])
  shareB.push(mask[i] ^ sa[i])
}

// 自检：用与运行时完全相同的算法还原一次，确保两份份额能拼回原 key
const checkSa = stream(seedA, shareB.length)
const checkSb = stream(seedB, shareA.length)
let restored = ''
for (let i = 0; i < shareA.length; i++) {
  const cipher = shareA[i] ^ checkSb[i]
  const maskByte = shareB[i] ^ checkSa[i]
  restored += String.fromCharCode(cipher ^ maskByte)
}
if (restored !== key) {
  console.error('✗ 份额自检失败，未写入任何文件')
  process.exit(1)
}

const root = path.resolve(__dirname, '..')
const header = '// 由 scripts/generate-key-shares.js 自动生成，请勿手工编辑\n' +
  '// 轮换密钥：TMDB_API_KEY=<新key> npm run key:rotate\n' +
  '// 本文件只含随机份额，不含密钥明文；单独看本文件无法推导出密钥。\n'

fs.writeFileSync(
  path.join(root, 'src/lib/tmdb/share-a.ts'),
  header + `\nexport const SEED_A: number = ${seedA}\n\nexport const SHARE_A: number[] = [\n  ` +
    shareA.join(', ') + '\n]\n',
  'utf8'
)
fs.writeFileSync(
  path.join(root, 'src/lib/tmdb/share-b.ts'),
  header + `\nexport const SEED_B: number = ${seedB}\n\nexport const SHARE_B: number[] = [\n  ` +
    shareB.join(', ') + '\n]\n',
  'utf8'
)

// 只保存指纹（sha256），不保存密钥本身，供构建后校验使用
fs.writeFileSync(
  path.join(root, 'scripts/key.meta.json'),
  JSON.stringify({
    fingerprint: crypto.createHash('sha256').update(key).digest('hex'),
    length: keyBytes.length,
    generatedAt: new Date().toISOString(),
    note: '仅用于校验源码与构建产物中是否残留明文密钥，不含密钥本身'
  }, null, 2) + '\n',
  'utf8'
)

console.log('✓ 份额已生成：src/lib/tmdb/share-a.ts、share-b.ts')
console.log('✓ 指纹已保存：scripts/key.meta.json（不含明文）')
console.log('✓ 自检通过：两份份额可在运行时还原出正确的 key')
console.log('  记得重新构建发布，并吊销旧 key。')
