// Supabase Edge Function: ai-text
// 文本大模型：教学建议 / 学期课程规划 / 阶段学情诊断 / 学生成长档案。
// 环境变量：OPENAI_API_KEY, OPENAI_BASE_URL(默认 https://api.openai.com/v1), OPENAI_MODEL(默认 gpt-4o)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

const TASK_PROMPTS: Record<string, string> = {
  teach_suggest: `你是学情分析专家。基于下列试卷分析（模块得分率、错误类型、知识点失分），给出知识点学习的教学建议。
要求：每条建议必须含三要素——做什么(具体动作)/给谁做(全班或个体)/何时验证(下一次测量节点)；避免"多练习"等空话。
只输出 JSON：{"suggestions":[{"what":"...","who":"...","when":"..."}]}`,

  course_plan: `你是课程规划师。按一周1次课的课频，为该学员规划学期课次。
学期课次基数：第一学期(9月-1月)=25次；寒假=12次；第二学期(3月-6月)=25次；暑期=25次。
要求：结合入学诊断的薄弱点安排每节课主题(topic)与重点(focus)，输出该学期的 sessions 数组。
只输出 JSON：{"sessions":[{"seq":1,"topic":"...","focus":"..."}]}`,

  stage_diagnosis: `你是学情分析专家。基于该生半个学期的学情记录（多次测评/逐题诊断），出具阶段学情诊断。
要求：用测量学证据链(难度/区分度/得分率/分布)做归因，区分全班性漏洞与分层差异(此处为个体，重点看自身纵向趋势)，错误归因细化到六类之一。
只输出 JSON：{"summary":"...","modules":[{"name":"...","rate":<0-1>}],"suggestions":[{"what":"...","who":"...","when":"..."}],"plan":[{"week":"...","title":"...","focus":"...","actions":["..."]}]}`,

  growth_archive: `你是成长档案编辑。基于该生从入学学情分析到当前阶段的所有记录（入学诊断、课程规划、各次学情记录、上课记录），出具学生成长档案。
要求：以叙事+要点形式呈现成长轨迹、关键拐点、当前状态与下一步。
只输出 JSON：{"archive":"...（Markdown 文本）"}`,
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { task, context } = await req.json();
    const sysPrompt = TASK_PROMPTS[task];
    if (!sysPrompt) return json({ error: "未知 task: " + task }, 400);
    const apiKey = Deno.env.get("OPENAI_API_KEY");
    const base = Deno.env.get("OPENAI_BASE_URL") || "https://api.openai.com/v1";
    const model = Deno.env.get("OPENAI_MODEL") || "gpt-4o";
    if (!apiKey) return json({ error: "未配置 OPENAI_API_KEY" }, 500);

    const resp = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: sysPrompt },
          { role: "user", content: "上下文数据：\n" + JSON.stringify(context, null, 2) },
        ],
        temperature: 0.4,
        response_format: { type: "json_object" },
      }),
    });
    if (!resp.ok) return json({ error: `模型调用失败: ${resp.status}`, detail: await resp.text() }, 502);
    const data = await resp.json();
    const text = data?.choices?.[0]?.message?.content || "{}";
    const parsed = JSON.parse(text.replace(/^```json|```$/g, "").trim());
    return json(parsed);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
