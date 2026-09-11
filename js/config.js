// 学员管理平台 · 运行配置
// 接入真实后端与真实 AI：把下面两项填为你自己的 Supabase 项目值即可（演示模式自动关闭）。
// 在 Supabase 控制台 Project Settings → API 获取。
window.APP_CONFIG = {
  SUPABASE_URL: "",        // 例如 https://xxxx.supabase.co
  SUPABASE_ANON_KEY: "",   // anon public key（仅前端使用，已受 RLS 保护）
};
// 术语：学期课次基数（一周1次课）
window.TERM_SESSIONS = {
  s1: { label: "第一学期 (9月-1月)", n: 25 },
  winter: { label: "寒假", n: 12 },
  s2: { label: "第二学期 (3月-6月)", n: 25 },
  summer: { label: "暑期", n: 25 },
};
window.TERM_ORDER = ["s1", "winter", "s2", "summer"];
