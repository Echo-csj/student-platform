// Supabase Edge Function: grade-paper
// 多模态批阅：接收试卷图片(base64) + 答案，调用视觉大模型给出结构化逐题得分。
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

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { images, answerText, studentName, subject } = await req.json();
    if (!images || !Array.isArray(images) || !images.length) {
      return json({ error: "缺少试卷图片" }, 400);
    }
    const apiKey = Deno.env.get("OPENAI_API_KEY");
    const base = Deno.env.get("OPENAI_BASE_URL") || "https://api.openai.com/v1";
    const model = Deno.env.get("OPENAI_MODEL") || "gpt-4o";
    if (!apiKey) return json({ error: "未配置 OPENAI_API_KEY" }, 500);

    const content: any[] = [
      {
        type: "text",
        text: `你是严谨的阅卷老师与学情分析专家。请批阅以下${subject || "学科"}试卷${studentName ? `（学生：${studentName}）` : ""}。
${answerText ? `参考答案/评分标准：\n${answerText}\n` : ""}
要求：
1. 逐题判分，给出每题得分与满分；
2. 标注每题所属模块(module)、知识点(knowledge_point)、认知层级(cognitive_level，如识记/理解/应用/综合)；
3. 若学生作答有误，标注错误类型(error_type)，取值限于：知识性错误/审题信息提取/表达规范/方法思维/计算失误/其他；
4. 给出该题简要判分说明(note)。
只输出如下 JSON（不要任何额外文字、不要 markdown 代码块）：
{"summary":{"totalScore":<数字>,"totalFull":<数字>},"details":[{"question_no":"1","module":"...","knowledge_point":"...","cognitive_level":"...","full_score":<数字>,"score":<数字>,"error_type":"...","note":"..."}]}`,
      },
    ];
    for (const img of images) {
      content.push({ type: "image_url", image_url: { url: img.dataUrl } });
    }

    const resp = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages: [{ role: "user", content }], temperature: 0.2, response_format: { type: "json_object" } }),
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
