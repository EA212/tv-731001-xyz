// 自动生成版本号脚本
// 格式: YYYY.MM.DD.短commit哈希 (例: 2026.06.11.2059bb0)

const fs = require('fs');
const { execSync } = require('child_process');

// 获取当前日期
const now = new Date();
const dateStr = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`;

// 获取短 commit 哈希
let commitHash = 'local';
try {
  commitHash = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
} catch (error) {
  // 如果没有 git 信息，使用 'local'
  console.log('⚠️ 无法获取 Git commit 哈希，使用 "local" 作为版本标识');
}

// 组合版本号
const version = `${dateStr}.${commitHash}`;

console.log('📝 生成版本号:', version);

// 写入 .env.production 文件
const envContent = `NEXT_PUBLIC_BUILD_VERSION=${version}\n`;

fs.writeFileSync('.env.production', envContent, 'utf-8');

console.log('✅ 版本号已写入 .env.production 文件');
console.log('📦 文件内容:', envContent.trim());