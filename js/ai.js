// 学员管理平台 · AI 层（Supabase Edge Function 真实大模型 / 演示模式模板回退）
window.AI = (function () {
  const cfg = () => window.APP_CONFIG || {};
  let edgeSb = null;
  // 云项目边缘函数（EDGE_URL + EDGE_ANON_KEY 均配置时启用）
  function edgeReady() { return !!(cfg().EDGE_URL && cfg().EDGE_ANON_KEY && typeof supabase !== "undefined"); }
  const sbReady = () => Store.getMode() === "supabase" && Store.client();
  // AI 服务是否可用：优先云项目边缘函数，其次自建库
  function ready() { return edgeReady() || !!sbReady(); }
  function fnClient() {
    if (edgeReady()) {
      if (!edgeSb) edgeSb = supabase.createClient(cfg().EDGE_URL, cfg().EDGE_ANON_KEY);
      return edgeSb;
    }
    return Store.client();
  }

  async function callFn(name, body) {
    const sb = fnClient();
    const { data, error } = await sb.functions.invoke(name, { body });
    if (error) throw error;
    return data;
  }

  // 多模态试卷处理
  //   mode = "graded"   已批阅试卷：读取卷面上老师已写的分数，不重新判分、不需要答案（路径A）
  //   mode = "ungraded" 未批阅试卷：按参考答案/评分标准批阅（路径B，默认）
  async function gradePaper({ images, answerText, studentName, subject, mode }) {
    const m = mode === "graded" ? "graded" : "ungraded";
    if (!ready()) {
      throw new Error(m === "graded"
        ? "演示模式不支持图片识别，请改用逐题 CSV，或在 config.js 配置 Supabase 后登录以启用真实 AI 识别。"
        : "演示模式不支持图片 AI 批阅，请上传逐题 CSV，或在 config.js 配置 Supabase 后登录以启用真实 AI 批阅。");
    }
    return callFn("grade-paper", { images, answerText, studentName, subject, mode: m });
  }

  async function teachSuggest(context) {
    if (!sbReady()) return { suggestions: Engine.genSuggestions(context.analyze || { modules: [], errorTypes: [], knowledge: [] }) };
    return callFn("ai-text", { task: "teach_suggest", context });
  }
  async function coursePlan(context) {
    if (!sbReady()) return { sessions: Engine.genCoursePlan(context.term, context.n, context.weakModules) };
    return callFn("ai-text", { task: "course_plan", context });
  }
  async function stageDiagnosis(context) {
    if (!sbReady()) {
      const d = context.analyze || { modules: [], errorTypes: [], knowledge: [] };
      return { summary: "（演示模式）基于阶段学情记录的综合诊断。", modules: d.modules || [], suggestions: Engine.genSuggestions(d), plan: Engine.genPlan(d) };
    }
    return callFn("ai-text", { task: "stage_diagnosis", context });
  }
  async function growthArchive(context) {
    if (!sbReady()) return { archive: Engine.genGrowthArchive(context.student, context) };
    return callFn("ai-text", { task: "growth_archive", context });
  }

  return { ready, gradePaper, teachSuggest, coursePlan, stageDiagnosis, growthArchive };
})();
