import express from "express";
import axios from "axios";

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

// 写死的接口配置（直接在代码中修改）
const SITES = [
  { key: "ffzy", name: "非凡影视", api: "https://api.ffzyapi.com/api.php/provide/vod", active: true },
  { key: "bfzy", name: "暴风资源", api: "https://bfzyapi.com/api.php/provide/vod", active: true },
  { key: "dyttzy", name: "电影天堂", api: "http://caiji.dyttzyapi.com/api.php/provide/vod", active: true },
  { key: "tyyszy", name: "天涯资源", api: "https://tyyszy.com/api.php/provide/vod", active: true },
  { key: "zy360", name: "360资源", api: "https://360zy.com/api.php/provide/vod", active: true },
  { key: "maotaizy", name: "茅台资源", api: "https://caiji.maotaizy.cc/api.php/provide/vod", active: true },
  { key: "wolong", name: "卧龙资源", api: "https://wolongzyw.com/api.php/provide/vod", active: true },
  { key: "jisu", name: "极速资源", api: "https://jszyapi.com/api.php/provide/vod", active: true },
  { key: "dbzy", name: "豆瓣资源", api: "https://dbzy.tv/api.php/provide/vod", active: true },
  { key: "mozhua", name: "魔爪资源", api: "https://mozhuazy.com/api.php/provide/vod", active: true },
  { key: "mdzy", name: "魔都资源", api: "https://www.mdzyapi.com/api.php/provide/vod", active: true },
  { key: "zuid", name: "最大资源", api: "https://api.zuidapi.com/api.php/provide/vod", active: true },
  { key: "yinghua", name: "樱花资源", api: "https://m3u8.apiyhzy.com/api.php/provide/vod", active: true },
  { key: "wujin", name: "无尽资源", api: "https://api.wujinapi.me/api.php/provide/vod", active: true },
  { key: "wwzy", name: "旺旺短剧", api: "https://wwzy.tv/api.php/provide/vod", active: true },
  { key: "ikun", name: "iKun资源", api: "https://ikunzyapi.com/api.php/provide/vod", active: true },
  { key: "lzi", name: "量子资源", api: "https://cj.lziapi.com/api.php/provide/vod", active: true },
  { key: "bdzy", name: "百度资源", api: "https://api.apibdzy.com/api.php/provide/vod", active: true },
  { key: "hongniuzy", name: "红牛资源", api: "https://www.hongniuzy2.com/api.php/provide/vod", active: true },
  { key: "xinlangaa", name: "新浪资源", api: "https://api.xinlangapi.com/xinlangapi.php/provide/vod", active: true },
  { key: "ckzy", name: "CK资源", api: "https://ckzy.me/api.php/provide/vod", active: true },
  { key: "ukuapi", name: "U酷资源", api: "https://api.ukuapi.com/api.php/provide/vod", active: true },
  { key: "1080zyk", name: "1080资源", api: "https://api.1080zyku.com/inc/apijson.php/", active: true },
  { key: "hhzyapi", name: "豪华资源", api: "https://hhzyapi.com/api.php/provide/vod", active: true },
  { key: "subocaiji", name: "速博资源", api: "https://subocaiji.com/api.php/provide/vod", active: true },
  { key: "p2100", name: "飘零资源", api: "https://p2100.net/api.php/provide/vod", active: true },
  { key: "aqyzy", name: "爱奇艺", api: "https://iqiyizyapi.com/api.php/provide/vod", active: true },
  { key: "yzzy", name: "优质资源", api: "https://api.yzzy-api.com/inc/apijson.php", active: true },
  { key: "myzy", name: "猫眼资源", api: "https://api.maoyanapi.top/api.php/provide/vod", active: true },
  { key: "rycj", name: "如意资源", api: "https://cj.rycjapi.com/api.php/provide/vod", active: true },
  { key: "jinyingzy", name: "金鹰点播", api: "https://jinyingzy.com/api.php/provide/vod", active: true },
  { key: "guangsuapi", name: "光速资源", api: "https://api.guangsuapi.com/api.php/provide/vod", active: true }
];

// 根路由
app.get("/", (req, res) => {
  console.log('🏠 [根路由] 返回服务状态');
  console.log(`📊 当前配置站点数: ${SITES.length}`);
  console.log('✅ 活跃站点:', SITES.filter(s => s.active).map(s => s.name).join(', '));
  res.json({ message: "机佬TV API 服务运行中", sites: SITES.length });
});

// 测速接口
app.get("/api/check", async (req, res) => {
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
app.get("/api/hot", async (req, res) => {
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

// 搜索接口
app.get("/api/search", async (req, res) => {
  const { wd } = req.query;
  console.log('\n🔍 ========================================');
  console.log(`🔍 [搜索] 关键词: "${wd}"`);
  console.log(`🔍 [搜索] 时间: ${new Date().toLocaleTimeString()}`);
  
  if (!wd) {
    console.log('⚠️ [搜索] 关键词为空，返回空结果');
    return res.json({ list: [] });
  }
  
  const activeSites = SITES.filter(s => s.active);
  console.log(`📡 [搜索] 活跃站点数: ${activeSites.length}`);
  console.log(`📡 [搜索] 站点列表: ${activeSites.map(s => s.name).join(', ')}`);
  
  const promises = activeSites.map(async (site) => {
    console.log(`⏳ [搜索][${site.name}] 开始搜索...`);
    const startTime = Date.now();
    
    try {
      const url = `${site.api}?ac=list&wd=${encodeURIComponent(wd)}&out=json`;
      console.log(`📡 [搜索][${site.name}] URL: ${url}`);
      
      const response = await axios.get(url, { timeout: 6000 });
      const data = response.data;
      const list = data.list || data.data;
      
      const duration = Date.now() - startTime;
      
      if (list && Array.isArray(list)) {
        console.log(`✅ [搜索][${site.name}] 成功 - 找到 ${list.length} 条 - 耗时 ${duration}ms`);
        if (list.length > 0) {
          console.log(`📦 [搜索][${site.name}] 示例: ${list[0].vod_name}`);
        }
        return list.map(item => ({
          ...item,
          site_key: site.key,
          site_name: site.name,
          latency: duration
        }));
      } else {
        console.log(`⚠️ [搜索][${site.name}] 返回数据格式异常`);
      }
    } catch (e) {
      const duration = Date.now() - startTime;
      console.log(`❌ [搜索][${site.name}] 失败 - 耗时 ${duration}ms`);
      console.log(`❌ [搜索][${site.name}] 错误: ${e.code || 'unknown'} - ${e.message}`);
    }
    return [];
  });
  
  console.log('⏳ [搜索] 等待所有站点响应...');
  const results = await Promise.all(promises);
  const flatResults = results.flat();
  
  console.log(`\n📊 [搜索] 汇总结果:`);
  console.log(`📊 [搜索] 总结果数: ${flatResults.length} 条`);
  
  // 统计各站点结果
  const siteStats = {};
  flatResults.forEach(item => {
    siteStats[item.site_name] = (siteStats[item.site_name] || 0) + 1;
  });
  console.log(`📊 [搜索] 各站点统计:`, siteStats);
  
  console.log('🔍 ========================================\n');
  res.json({ list: flatResults });
});

// 详情接口
app.get("/api/detail", async (req, res) => {
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
