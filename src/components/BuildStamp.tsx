/**
 * 构建标识：独立可插拔的小件。
 * 删除本文件 + page 里的一行引用即可完全移除，不牵连任何逻辑。
 * 默认显示；设 NEXT_PUBLIC_BUILD_STAMP=off 关闭。
 */
export function BuildStamp() {
  if (process.env.NEXT_PUBLIC_BUILD_STAMP === 'off') return null
  const version = process.env.NEXT_PUBLIC_BUILD_VERSION
  if (!version) return null
  return <span className="build-stamp">{version}</span>
}
