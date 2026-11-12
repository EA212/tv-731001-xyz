import express from "express";
import axios from "axios";
import { SITES, searchAll } from "../_lib/search-core.js";

const app = express();

// ============================================
// 详细日志中间件 - 帮助调试API调用
// ============================================
app.use((req, res, next) => {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substring(7);
  
  console.log('\n========================================');
  console.log(`🚀 [${new Date().toISOString()}] 请求开始`);
  console.log(`📋 Request ID: ${requestId}`);
  console.log(`📡 ${req.method} ${req.url}`);
  console.log(`🔍 Query参数:`, req.query);
  console.log(`📦 Headers:`, {
    'user-agent': req.headers['user-agent'],
    'content-type': req.headers['content-type'],
    'x-forwarded-for': req.headers['x-forwarded-for'],
    'host': req.headers['host']
  });
  
  // 响应完成后记录耗时
  const originalEnd = res.end;
  res.end = function(chunk, encoding) {
    const duration = Date.now() - startTime;
    console.log(`✅ [${requestId}] 响应完成 - 状态: ${res.statusCode} - 耗时: ${duration}ms`);
    console.log('========================================\n');
    return originalEnd.apply(this, arguments);
  };
  
  next();
});

// 站点表与抓取逻辑统一由 _lib/search-core.js 提供（下划线前缀为内部模块，不生成路由），流式与一次性端点共用。

// 根路由
app.get("/", (req, res) => {
  console.log('🏠 [根路由] 返回服务状态');
  console.log(`📊 当前配置站点数: ${SITES.length}`);
  console.log('✅ 活跃站点:', SITES.filter(s => s.active).map(s => s.name).join(', '));
  res.json({ message: "机佬TV API 服务运行中", sites: SITES.length });
});

// 测速接口
app.get("/check", async (req, res) => {
  const { key } = req.query;
  console.log(`⚡ [测速] 开始测速 - 站点: ${key}`);
  
  const site = SITES.find(s => s.key === key);
  
  if (!site) {
    console.log(`❌ [测速] 站点不存在: ${key}`);
    return res.json({ latency: 9999 });
  }

  console.log(`📡 [测速] 请求 URL: ${site.api}?ac=list&pg=1`);
  const start = Date.now();
  
  try {
    const response = await axios.get(`${site.api}?ac=list&pg=1`, { timeout: 3000 });
    const latency = Date.now() - start;
    console.log(`✅ [测速] ${site.name} 成功 - 延迟: ${latency}ms - 状态: ${response.status}`);
    res.json({ latency });
  } catch (e) {
    const latency = Date.now() - start;
    console.log(`❌ [测速] ${site.name} 失败 - 耗时: ${latency}ms`);
    console.log(`❌ [测速] 错误类型: ${e.code || 'unknown'}`);
    console.log(`❌ [测速] 错误信息: ${e.message}`);
    res.json({ latency: 9999 });
  }
});

// 热门接口
app.get("/hot", async (req, res) => {
  console.log('🔥 [热门] 开始获取热门内容');
  const sites = SITES.filter(s => ['ffzy', 'bfzy', 'lzi', 'dbzy'].includes(s.key));
  console.log(`📡 [热门] 尝试站点: ${sites.map(s => s.name).join(', ')}`);
  
  for (const site of sites) {
    console.log(`⏳ [热门] 尝试 ${site.name}...`);
    try {
      const url = `${site.api}?ac=list&pg=1&h=24&out=json`;
      console.log(`📡 [热门] URL: ${url}`);
      
      const response = await axios.get(url, { timeout: 3000 });
      const list = response.data.list || response.data.data;
      
      if (list && list.length > 0) {
        console.log(`✅ [热门] ${site.name} 成功 - 返回 ${list.length} 条数据`);
        console.log(`📦 [热门] 前3条: ${list.slice(0, 3).map(i => i.vod_name).join(', ')}`);
        return res.json({ list: list.slice(0, 12) });
      } else {
        console.log(`⚠️ [热门] ${site.name} 返回空数据`);
      }
    } catch (e) {
      console.log(`❌ [热门] ${site.name} 失败: ${e.message}`);
      continue;
    }
  }
  console.log('❌ [热门] 所有站点都失败');
  res.json({ list: [] });
});

// 搜索接口（一次性）：流式端点的降级目标，与 /api/search-stream 共用抓取逻辑。
// ac=detail 优先带海报，避免前端逐片名打 TMDb 补图；结果裁剪成 6 个字段回前端。
app.get("/search", async (req, res) => {
  const wd = String(req.query.wd ?? "").trim().slice(0, 80);
  if (!wd) return res.json({ list: [] });

  const list = [];
  await searchAll(wd, {
    deadline: 12_000,
    onBatch: ({ items }) => list.push(...items)
  });
  res.json({ list });
});

// 详情接口
app.get("/detail", async (req, res) => {
  const { site_key, id } = req.query;
  console.log('\n📄 ========================================');
  console.log(`📄 [详情] 站点: ${site_key} - ID: ${id}`);
  
  const targetSite = SITES.find(s => s.key === site_key);
  
  if (!targetSite) {
    console.log(`❌ [详情] 站点不存在: ${site_key}`);
    console.log('📄 ========================================\n');
    return res.status(404).json({ error: "Site not found" });
  }
  
  console.log(`📡 [详情] 站点名称: ${targetSite.name}`);
  console.log(`📡 [详情] API地址: ${targetSite.api}`);
  
  try {
    const url = `${targetSite.api}?ac=detail&ids=${id}&out=json`;
    console.log(`📡 [详情] 请求 URL: ${url}`);
    
    const startTime = Date.now();
    const response = await axios.get(url, { timeout: 6000 });
    const duration = Date.now() - startTime;
    
    console.log(`✅ [详情] 请求成功 - 状态: ${response.status} - 耗时: ${duration}ms`);
    
    const data = response.data;
    if (data.list && data.list.length > 0) {
      const item = data.list[0];
      console.log(`📦 [详情] 视频名称: ${item.vod_name}`);
      console.log(`📦 [详情] 视频ID: ${item.vod_id}`);
      console.log(`📦 [详情] 播放地址长度: ${item.vod_play_url?.length || 0} 字符`);
    }
    
    console.log('📄 ========================================\n');
    res.json(response.data);
  } catch (e) {
    console.log(`❌ [详情] 请求失败`);
    console.log(`❌ [详情] 错误类型: ${e.code || 'unknown'}`);
    console.log(`❌ [详情] 错误信息: ${e.message}`);
    console.log('📄 ========================================\n');
    res.status(500).json({ error: "Source Error", message: e.message });
  }
});

// 启动日志
console.log('\n');
console.log('╔════════════════════════════════════════╗');
console.log('║     🚀 机佬TV API 服务已启动          ║');
console.log('╚════════════════════════════════════════╝');
console.log(`📊 配置站点数: ${SITES.length}`);
console.log(`✅ 活跃站点: ${SITES.filter(s => s.active).length}`);
console.log(`❌ 禁用站点: ${SITES.filter(s => !s.active).length}`);
console.log('📡 站点列表:');
SITES.forEach((site, index) => {
  console.log(`   ${index + 1}. ${site.name} (${site.key}) - ${site.active ? '✅' : '❌'}`);
});
console.log('\n');

export default app;
