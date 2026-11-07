#!/usr/bin/env node
/**
 * 构建后自检：确认源码与 .next 产物里没有残留明文密钥。
 *
 * 做法：从 scripts/key.meta.json 读取密钥的 sha256 指纹（不含密钥本身），
 * 扫描所有文本文件中的 32 位十六进制串，逐个比对指纹。这样既能防止
 * 有人把明文写回代码，也能防止打包器把两个份额常量折叠成明文。
 *
 * 用法：node scripts/verify-key-absence.js   （已挂在 npm run postbuild）
 */
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const root = path.resolve(__dirname, '..')
const metaPath = path.join(root, 'scripts/key.meta.json')

if (!fs.existsSync(metaPath)) {
  console.error('✗ 缺少 scripts/key.meta.json，请先执行 npm run key:rotate')
  process.exit(1)
}

const { fingerprint } = JSON.parse(fs.readFileSync(metaPath, 'utf8'))
const targets = ['src', 'public', 'scripts', '.next/static']
const textExt = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.css',
  '.html', '.htm', '.txt', '.map', '.md'
])
const maxBytes = 20 * 1024 * 1024
const hits = []
let files = 0
let candidates = 0

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex')
}

function walk(dir) {
  let entries
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue
      walk(full)
    } else if (entry.isFile()) {
      if (!textExt.has(path.extname(entry.name).toLowerCase())) continue
      let stat
      try {
        stat = fs.statSync(full)
      } catch {
        continue
      }
      if (stat.size > maxBytes) continue
      let text
      try {
        text = fs.readFileSync(full, 'utf8')
      } catch {
        continue
      }
      files++
      const matches = text.match(/[a-f0-9]{32}/gi) || []
      candidates += matches.length
      for (const m of matches) {
        if (sha256(m.toLowerCase()) === fingerprint) {
          hits.push(path.relative(root, full))
          break
        }
      }
    }
  }
}

for (const t of targets) walk(path.join(root, t))

console.log(`已扫描 ${files} 个文本文件，检查 ${candidates} 个候选串`)

if (hits.length > 0) {
  console.error('✗ 发现明文密钥残留：')
  for (const h of hits) console.error('   ' + h)
  console.error('  请检查这些文件；若是构建产物，重新构建后再验证。')
  process.exit(1)
}

console.log('✓ 源码与构建产物中均未发现明文密钥')
