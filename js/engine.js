// 学员管理平台 · 测量学分析引擎（纯前端，供演示模式与图表复用）
window.Engine = (function () {
  function parseExamDetailCSV(text) {
    const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.trim());
    if (!lines.length) return [];
    let headerIdx = 0;
    for (let i = 0; i < Math.min(3, lines.length); i++) {
      if (/question_no|题号|module|模块/.test(lines[i])) { headerIdx = i; break; }
    }
    const header = lines[headerIdx].split(",").map((h) => h.trim());
    const col = (names) => header.findIndex((h) => names.includes(h));
    const cQ = col(["question_no", "题号", "qno"]), cM = col(["module", "模块"]), cK = col(["knowledge_point", "知识点", "kp"]);
    const cC = col(["cognitive_level", "认知层级"]), cF = col(["full_score", "满分", "full"]), cS = col(["score", "得分", "s"]);
    const cE = col(["error_type", "错误类型"]), cN = col(["note", "备注"]);
    const rows = [];
    for (let i = headerIdx + 1; i < lines.length; i++) {
      const c = lines[i].split(",");
      const f = parseFloat(c[cF] ?? 0) || 0, s = parseFloat(c[cS] ?? 0) || 0;
      rows.push({ question_no: c[cQ] ?? (i - headerIdx), module: c[cM] ?? "未分类", knowledge_point: c[cK] ?? "未标注", cognitive_level: c[cC] ?? "", full_score: f, score: s, error_type: c[cE] ?? (s < f ? "未标注" : "无"), note: c[cN] ?? "" });
    }
    return rows;
  }

  function analyze(rows) {
    const total = rows.reduce((a, r) => ({ f: a.f + (+r.full_score || 0), s: a.s + (+r.score || 0) }), { f: 0, s: 0 });
    const rate = total.f ? total.s / total.f : 0, lostTotal = total.f - total.s;
    const modMap = {};
    rows.forEach((r) => { const m = r.module || "未分类"; if (!modMap[m]) modMap[m] = { f: 0, s: 0, n: 0 }; modMap[m].f += +r.full_score || 0; modMap[m].s += +r.score || 0; modMap[m].n += 1; });
    const modules = Object.entries(modMap).map(([k, v]) => ({ name: k, full: v.f, score: v.s, n: v.n, rate: v.f ? v.s / v.f : 0 })).sort((a, b) => a.rate - b.rate);
    const etMap = {};
    rows.forEach((r) => { const lost = (+r.full_score || 0) - (+r.score || 0); if (lost <= 0) return; const et = r.error_type || "未标注"; if (!etMap[et]) etMap[et] = { lost: 0, n: 0 }; etMap[et].lost += lost; etMap[et].n += 1; });
    const errorTypes = Object.entries(etMap).map(([k, v]) => ({ k, lost: v.lost, n: v.n })).sort((a, b) => b.lost - a.lost);
    const kpMap = {};
    rows.forEach((r) => { const lost = (+r.full_score || 0) - (+r.score || 0); if (lost <= 0) return; const kp = r.knowledge_point || "未标注"; if (!kpMap[kp]) kpMap[kp] = { lost: 0, n: 0 }; kpMap[kp].lost += lost; kpMap[kp].n += 1; });
    const knowledge = Object.entries(kpMap).map(([k, v]) => ({ kp: k, lost: v.lost, n: v.n })).sort((a, b) => b.lost - a.lost).slice(0, 12);
    return { total, rate, lostTotal, modules, errorTypes, knowledge, rows };
  }

  function genSuggestions(d) {
    const out = []; const weak = d.modules.find((m) => m.full >= 5); const topErr = d.errorTypes[0];
    const kpTop = d.knowledge.slice(0, 2).map((k) => k.kp).join("、") || "核心薄弱知识点";
    if (topErr && /知识/.test(topErr.k)) out.push({ what: `知识筛查专项：针对失分最高的「${kpTop}」做听写/默写/辨析，每周 8–10 个`, who: "学员本人 + 家长每日监督", when: "下次随堂测正确率" });
    if (topErr && /审题|提取/.test(topErr.k)) out.push({ what: "信息提取训练：阅读定位、数字比对、TRUE/NOT mentioned 判断专项", who: "1V1 课堂（限时训练）", when: "两周后同题型正确率提升" });
    if (topErr && /表达/.test(topErr.k)) out.push({ what: "书面表达规范课：要点完整、书写工整、大小写/单复数、连接词", who: "作业批改即时反馈", when: "下次作文扣分减少" });
    if (topErr && /方法|思维/.test(topErr.k)) out.push({ what: "方法思维课：主旨/标题/六选五衔接逻辑与排除法", who: "1V1 精讲 + 错题复盘", when: "同类题正确率" });
    if (weak) out.push({ what: `模块突破：「${weak.name}」当前得分率 ${(weak.rate * 100).toFixed(1)}%，目标提升至 ${Math.min(85, Math.round((weak.rate + 0.15) * 100))}%`, who: "1V1 针对性讲练", when: "下次测评模块得分率" });
    if (!out.length) out.push({ what: "维持当前节奏，增加综合运用与限时模拟", who: "学员本人", when: "下次测评" });
    return out.slice(0, 4);
  }

  function genPlan(d) {
    const weak = d.modules.filter((m) => m.full >= 5).slice(0, 3);
    const kp = d.knowledge.slice(0, 4).map((k) => k.kp);
    const w1 = (kp[0] || "基础词汇/短语") + "、" + (kp[1] || "语法基础");
    const w2 = weak[0] ? weak[0].name + "模块专项" : (kp[2] || "阅读定位");
    const w3 = weak[1] ? weak[1].name + "模块专项" : "方法思维与错题复盘";
    const w4 = "综合限时模拟 + 书面表达规范";
    return [
      { week: "第 1 周", title: "基础筛查与补漏", focus: w1, actions: ["每日 10 个知识点听写/默写", "错题归因标注（错误类型）", "建立个人错题本"] },
      { week: "第 2 周", title: "薄弱模块突破", focus: w2, actions: ["模块专项讲练 2 次", "同题型限时训练", "周测验证"] },
      { week: "第 3 周", title: "方法思维提升", focus: w3, actions: ["审题/信息提取训练", "方法型错题复盘", "减半错误率目标"] },
      { week: "第 4 周", title: "综合与固化", focus: w4, actions: ["套卷限时模拟 1 套", "书面表达规范批改", "阶段性诊断复盘"] },
    ];
  }

  // 模板课程规划（演示模式）：按学期课次基数，围绕薄弱点排课
  function genCoursePlan(term, n, weakModules) {
    const sessions = [];
    for (let i = 1; i <= n; i++) {
      let topic, focus;
      if (i <= 3) { topic = "入学诊断复盘与基础筛查"; focus = "建立错题本、定位薄弱点"; }
      else if (weakModules && weakModules.length && i % 2 === 0) {
        const m = weakModules[(i / 2 - 1) % weakModules.length];
        topic = m.name + " 专题讲练"; focus = "该模块得分率提升至 75%+";
      } else { topic = "综合训练与限时模拟"; focus = "提速 + 规范"; }
      sessions.push({ seq: i, topic, focus, status: "planned" });
    }
    return sessions;
  }

  function genGrowthArchive(student, records) {
    const lines = [];
    lines.push(`# 学生成长档案 · ${student.name}`);
    lines.push("");
    lines.push(`- 年级/学科：${student.grade || "-"} · ${student.subject || "-"}${student.school ? "（" + student.school + "）" : ""}`);
    lines.push(`- 入学：${student.enroll_date || "-"}`);
    lines.push("");
    lines.push(`## 成长轨迹`);
    (records.assessments || []).forEach((a) => {
      const r = a.total_full ? (a.total_score / a.total_full * 100).toFixed(1) : "-";
      lines.push(`- ${a.date} ${a.name}：得分率 ${r}%`);
    });
    lines.push("");
    lines.push(`## 关键拐点`);
    lines.push(`- 入学诊断显示知识性错误为主，已安排基础筛查与模块专项；后续按课程规划逐周推进。`);
    lines.push("");
    lines.push(`## 当前状态与下一步`);
    lines.push(`- 基于累计学情记录，建议继续保持模块专项 + 限时模拟节奏，重点提升最薄弱模块。`);
    return lines.join("\n");
  }

  return { parseExamDetailCSV, analyze, genSuggestions, genPlan, genCoursePlan, genGrowthArchive };
})();
