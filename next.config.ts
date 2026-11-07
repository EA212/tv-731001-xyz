import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 不生成浏览器端 source map，避免源码原文（含份额与还原逻辑）被直接反查。
  // 构建后的明文密钥残留由 scripts/verify-key-absence.js 另行校验。
  productionBrowserSourceMaps: false,
};

export default nextConfig;
