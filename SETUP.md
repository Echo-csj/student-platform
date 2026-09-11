# 学员管理平台 · 部署与接入指南

学员管理平台（Student Management Platform）把「学情诊断工作台」与「学员成长规划平台」合并为一个闭环系统：

> 新生入学学情诊断 → 教学建议 → 学期课程规划 → 学情记录 → 阶段学情诊断 → 学生成长档案
> 数据底座：教材/知识点库 + 校历库

本站是**纯静态前端**（HTML/CSS/JS，零框架依赖），默认开箱即用； optionally 接入 **Supabase** 后升级为「真实大模型 + 云端多人协作」模式。两种模式由 `js/config.js` 一个开关切换，无需改动任何业务代码。

---

## 一、开箱即用（演示模式，无需任何后端）

把整个文件夹（含 `index.html`、`css/`、`js/`、`supabase/`）原样托管到任意静态服务器即可。

- GitHub Pages 部署后访问：`https://你的用户名.github.io/student-platform/`
- 本地预览：`python3 -m http.server 8080` 后浏览器开 `http://localhost:8080`

`js/config.js` 中 `SUPABASE_URL` 与 `SUPABASE_ANON_KEY` 留空时，系统自动进入**演示模式**：

- 数据存在浏览器 `localStorage`（键名 `sp_*_v1`），刷新不丢、换设备不共享；
- AI 批阅/建议/规划走**内置测量学模板引擎**（`js/engine.js`），输出结构完整、可手动编辑，但非真实大模型生成；
- 首次打开自动注入种子数据（刘英杰·英语入学测 61/110、王梓涵），可立即体验六步闭环。

> 演示模式适合先验收交互与流程。要让学生真实试卷被 AI 批阅、建议/规划由大模型生成、且多角色（校长/教务/教师）跨设备共享数据，请按下面接入 Supabase。

---

## 二、接入 Supabase + 真实大模型

### 步骤 1：创建 Supabase 项目

1. 打开 https://supabase.com → New project，填名称、设数据库密码（记下）。
2. 等待项目就绪，进入 **Project Settings → API**，复制：
   - `Project URL`（形如 `https://xxxx.supabase.co`）
   - `anon public key`（以 `eyJ...` 开头）

### 步骤 2：建表与权限（RLS）

在 Supabase 控制台 **SQL Editor** 中，全量粘贴并运行本仓库 `supabase/schema.sql`。该脚本会：

- 建 10 张表：`profiles / students / assessments / exam_details / diagnoses / course_plans / learning_records / lesson_logs / knowledge_db / calendar_db`；
- 开启 **行级安全（RLS）**，策略为「仅本人（`owner_id = auth.uid()`）可读写」；
- 建 `handle_new_user` 触发器，注册即写入 `profiles`（角色默认 `teacher`）。

> 如需多人协作（如校长看全部学员），在 `schema.sql` 末尾把对应表的策略改为包含 `role = 'manager'`，或在控制台手动加 policy。本仓库默认「各账号仅看自己数据」。

### 步骤 3：填前端配置

打开 `js/config.js`，把步骤 1 的两项填进去（改完需**重新部署**静态站）：

```js
window.APP_CONFIG = {
  SUPABASE_URL: "https://xxxx.supabase.co",
  SUPABASE_ANON_KEY: "eyJxxxx...",
};
```

填好之后，系统自动切到 Supabase 模式，打开页面会显示**登录/注册**框（邮箱 + 密码）。

### 步骤 4：部署两个 Edge Function（真实 AI 的入口）

批阅与建议/规划走两个 Deno 函数，环境变量统一读取：

| 变量 | 含义 | 默认 |
| --- | --- | --- |
| `OPENAI_API_KEY` | 大模型 API Key | 必填 |
| `OPENAI_BASE_URL` | 兼容 OpenAI 的接口地址 | `https://api.openai.com/v1` |
| `OPENAI_MODEL` | 模型名 | `gpt-4o` |

> `OPENAI_BASE_URL` 可指向任意兼容 OpenAI 协议的服务（如国内中转、自建 vLLM、Azure OpenAI 等），只要 `POST {base}/chat/completions` 可用即可。
> - `grade-paper` 用到**视觉能力**（多模态），模型需支持图片输入（如 `gpt-4o`）。
> - `ai-text` 仅文本，可用更便宜的模型。

**用 Supabase CLI 部署**（需本机有 Node ≥ 18）：

```bash
# 安装 CLI（一次）
npm install -g supabase

# 登录并关联项目
supabase login
supabase link --project-ref xxxx      # xxxx 即 Project URL 中的子域

# 部署两个函数（分别在每个函数目录执行，或一次 deploy 全部）
supabase functions deploy grade-paper
supabase functions deploy ai-text

# 设置密钥（只需一次，写在项目级 Secrets，函数运行时自动读取）
supabase secrets set OPENAI_API_KEY=sk-xxxx
supabase secrets set OPENAI_BASE_URL=https://api.openai.com/v1
supabase secrets set OPENAI_MODEL=gpt-4o
```

部署完成后，前端在 Supabase 模式下调用 AI 会自动走这两个函数；密钥**只存在 Supabase 服务端**，不会下发到浏览器。

### 步骤 5：验证真实 AI 生效

1. 用 Supabase 模式注册/登录一个账号；
2. 在「入学诊断」选择「上传试卷 + 答案」→ 提交，确认返回逐题结构化得分（说明 `grade-paper` 通）；
3. 在「教学建议 / 课程规划 / 阶段诊断 / 成长档案」点「AI 生成」，确认返回大模型内容（说明 `ai-text` 通）。

> 任一步报错，可在浏览器控制台看函数返回的 `error` 字段；常见是密钥未设、模型不支持视觉、或 `anon key` 的 JWT 未带（前端已自动带，无需额外处理）。

---

## 三、重新部署静态站点

改了 `js/config.js` 或 `js/*` 后，需重新把仓库推到 GitHub Pages（或你的静态托管）：

```bash
git add -A && git commit -m "update" && git push
```

GitHub Pages 缓存可用 URL 上的版本号参数（`index.html` 中 `?v=20260911a`）强制刷新绕过。

---

## 四、目录结构

```
student-platform/
├─ index.html                 # SPA 外壳，按 hash 路由 8 个视图
├─ css/styles.css             # Linear 风格主题（亮/暗，Indigo 强调）
├─ js/
│  ├─ config.js               # ★ 仅此文件决定 演示 / Supabase 模式
│  ├─ engine.js               # 测量学分析 + 演示模式模板引擎
│  ├─ store.js                # 双实现数据层（Supabase / localStorage）
│  ├─ ai.js                   # AI 层：真实函数 or 模板回退
│  └─ app.js                  # 主逻辑 + 8 视图 + SVG 图表 + 鉴权
├─ supabase/
│  ├─ schema.sql              # 10 张表 + RLS + 触发器
│  └─ functions/
│     ├─ grade-paper/index.ts # 多模态批阅（图片 → 逐题得分）
│     └─ ai-text/index.ts     # 教学建议/规划/诊断/档案（文本大模型）
└─ SETUP.md                   # 本文件
```

---

## 五、常见问题

- **演示模式能长期用吗？** 能，但数据只在本机浏览器。换电脑/清缓存即丢失，也不能多人共享。
- **一定要 Supabase 吗？** 想用真实 AI 批阅图片试卷，必须有服务端（密钥不能放前端）。Supabase 是零运维方案；你也可用任意能跑 Deno/Node 的服务托管两个函数，并把 `js/ai.js` 的 `sb.functions.invoke` 换成你的接口。
- **不想用 Supabase 但想要真实 AI？** 可只把两个 Edge Function 部署到自己的服务端，前端 `ai.js` 改为 `fetch` 你的 HTTPS 接口（无需 Supabase Auth，可改用简单口令）。
- **校历库/知识点库有何用？** 当前版本「数据库」视图支持手动录入；后续诊断与课程规划可调用它们做知识点召回与考试节点预测（接口已在 `store.js` 预留 `knowledge_db` / `calendar_db` 表）。
