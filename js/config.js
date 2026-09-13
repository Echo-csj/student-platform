// 学员管理平台 · 运行配置（已接入自建 Supabase，统一登录后端）
// 在 Supabase 控制台 Project Settings → API 获取。
// 说明：anon key 仅前端使用，已受 RLS（owner_id 行级权限）保护；切勿填写 secret / service_role 密钥。
window.APP_CONFIG = {
  SUPABASE_URL: 'https://supabase.dosworkbench.top',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzg5MTk1Mzk5LCJleHAiOjQxMDI0NDQ4MDB9.Yejt5D7n9lzPzORBa9nUYJrzccPgxk3i5-sihrn-AV4',
  // 云端 AI 批阅 / 建议（grade-paper / ai-text 边缘函数）仍走云项目地址：自建暂未部署函数。
  EDGE_URL: 'https://zxemcyngesgxpbevdxsu.supabase.co',
};
// 术语：学期课次基数（一周1次课）
window.TERM_SESSIONS = {
  s1: { label: "第一学期 (9月-1月)", n: 25 },
  winter: { label: "寒假", n: 12 },
  s2: { label: "第二学期 (3月-6月)", n: 25 },
  summer: { label: "暑期", n: 25 },
};
window.TERM_ORDER = ["s1", "winter", "s2", "summer"];
