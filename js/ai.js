// 学员管理平台 · AI 层（Supabase Edge Function 真实大模型 / 演示模式模板回退）
window.AI = (function () {
  const sbReady = () => Store.getMode() === "supabase" && Store.client();

  async function callFn(name, body) {
    const sb = Store.client();
    const { data, error } = await sb.functions.invoke(name, { body });
    if (error) throw error;
    return data;
  }

  // 批阅图片试卷（多模态）
  async function gradePaper({ images, answerText, studentName, subject }) {
    if (!sbReady()) {
      // 演示模式：无法真批阅图片，提示用 CSV 或返回空
      throw new Error("演示模式不支持图片 AI 批阅，请上传逐题 CSV，或在 config.js 配置 Supabase 后登录以启用真实 AI 批阅。");
    }
    return callFn("grade-paper", { images, answerText, studentName, subject });
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

  return { gradePaper, teachSuggest, coursePlan, stageDiagnosis, growthArchive };
})();
