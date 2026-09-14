/* 学员管理平台 — 统一 SPA
 * 流程：入学诊断 → 教学建议 → 学期课程规划 → 学情记录 → 阶段诊断 → 成长档案 + 数据库
 */
(function () {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmtDate = (d) => (d ? String(d).slice(0, 10) : "");
  const rateColor = (r) => (r >= 0.8 ? "var(--green)" : r >= 0.6 ? "var(--amber)" : "var(--red)");
  const rateChip = (r) => `<span class="chip" style="background:color-mix(in srgb,${rateColor(r)} 14%,var(--bg));color:${rateColor(r)}">${(r * 100).toFixed(1)}% · ${r >= 0.8 ? "达标" : r >= 0.6 ? "偏弱" : "薄弱"}</span>`;
  function toast(m) { const t = $("#toast"); t.textContent = m; t.classList.add("show"); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove("show"), 2200); }

  // ---------- 图表 ----------
  function lineChart(series) {
    const W = 600, H = 250, padL = 40, padR = 18, padT = 16, padB = 36, iw = W - padL - padR, ih = H - padT - padB;
    if (!series.length) return `<svg viewBox="0 0 ${W} ${H}"><text x="${W / 2}" y="${H / 2}" text-anchor="middle" fill="var(--text-muted)">暂无数据</text></svg>`;
    const n = series.length, X = (i) => (n <= 1 ? padL + iw / 2 : padL + (iw * i) / (n - 1)), Y = (v) => padT + ih * (1 - v / 100);
    let grid = "";
    [0, 25, 50, 75, 100].forEach((g) => { grid += `<line x1="${padL}" y1="${Y(g)}" x2="${W - padR}" y2="${Y(g)}" stroke="var(--border)"/><text x="${padL - 8}" y="${Y(g) + 4}" text-anchor="end" font-size="10" fill="var(--text-muted)">${g}%</text>`; });
    const pts = series.map((s, i) => `${X(i)},${Y(s.value)}`).join(" ");
    let lab = "";
    series.forEach((s, i) => { lab += `<text x="${X(i)}" y="${H - 14}" text-anchor="middle" font-size="10.5" fill="var(--text-subtle)">${esc(s.label)}</text><circle cx="${X(i)}" cy="${Y(s.value)}" r="3.5" fill="var(--indigo)"/><text x="${X(i)}" y="${Y(s.value) - 9}" text-anchor="middle" font-size="10.5" font-family="var(--font-mono)" fill="var(--indigo)">${s.value.toFixed(0)}</text>`; });
    return `<svg viewBox="0 0 ${W} ${H}"><polyline points="${pts}" fill="none" stroke="var(--indigo)" stroke-width="2.5" stroke-linejoin="round"/><polygon points="${padL},${Y(series[0].value)} ${pts} ${X(n - 1)},${Y(series[n - 1].value)}" fill="var(--indigo)" opacity="0.12"/>${grid}${lab}</svg>`;
  }
  function hBar(items) {
    const W = 600, rowH = 34, padL = 150, padR = 64, padT = 4, padB = 4, H = padT + padB + items.length * rowH, iw = W - padL - padR;
    let b = "";
    items.forEach((it, i) => { const y = padT + i * rowH + rowH / 2, w = Math.max(2, iw * it.value), c = rateColor(it.value); b += `<text x="${padL - 10}" y="${y + 4}" text-anchor="end" font-size="12" fill="var(--text)">${esc(it.label)}</text><rect x="${padL}" y="${y - 9}" width="${iw}" height="18" rx="5" fill="var(--bg-muted)"/><rect x="${padL}" y="${y - 9}" width="${w}" height="18" rx="5" fill="${c}" opacity="0.9"/><text x="${padL + iw + 8}" y="${y + 4}" font-size="12" font-family="var(--font-mono)" fill="${c}">${(it.value * 100).toFixed(1)}%</text>`; });
    return `<svg viewBox="0 0 ${W} ${H}">${b}</svg>`;
  }
  function doughnut(items) {
    const sum = items.reduce((a, b) => a + b.value, 0) || 1, W = 260, H = 260, cx = 130, cy = 130, r = 70, sw = 26, C = 2 * Math.PI * r;
    const pal = ["#4F46E5", "#0ea5e9", "#f59e0b", "#ef4444", "#10b981", "#a855f7"];
    let arcs = "", off = 0, leg = "";
    items.forEach((it, i) => { const frac = it.value / sum, len = frac * C, col = pal[i % pal.length]; arcs += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${col}" stroke-width="${sw}" stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-off}" transform="rotate(-90 ${cx} ${cy})"/>`; off += len; leg += `<div style="display:flex;gap:8px;font-size:12px;margin:3px 0"><span style="width:10px;height:10px;border-radius:3px;background:${col}"></span><span style="flex:1;color:var(--text-subtle)">${esc(it.label)}</span><span class="mono">${it.value}</span></div>`; });
    return `<div style="display:flex;gap:18px;align-items:center;flex-wrap:wrap;justify-content:center"><svg viewBox="0 0 ${W} ${H}" style="width:200px;height:200px;flex:none">${arcs}<text x="${cx}" y="${cy - 2}" text-anchor="middle" font-size="13" fill="var(--text-muted)">失分</text><text x="${cx}" y="${cy + 16}" text-anchor="middle" font-size="17" font-family="var(--font-mono)" fill="var(--text)">${sum}</text></svg><div style="min-width:150px">${leg}</div></div>`;
  }

  // ---------- Modal / 导出 ----------
  function openModal(title, body, actions) {
    const root = $("#modalRoot");
    root.innerHTML = `<div class="modal-back"><div class="modal"><div class="modal-head"><h3>${esc(title)}</h3><button class="icon-btn" id="modalX"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg></button></div><div class="modal-body">${body}</div><div class="modal-foot" id="modalFoot"></div></div></div>`;
    const foot = $("#modalFoot");
    actions.forEach((a) => { const b = document.createElement("button"); b.className = "btn " + (a.cls || ""); b.textContent = a.label; b.onclick = a.onClick; foot.appendChild(b); });
    $("#modalX").onclick = closeModal;
    root.querySelector(".modal-back").onclick = (e) => { if (e.target.classList.contains("modal-back")) closeModal(); };
  }
  function closeModal() { $("#modalRoot").innerHTML = ""; }
  function downloadText(text, filename) { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" })); a.download = filename; a.click(); URL.revokeObjectURL(a.href); }

  // ---------- 导航 ----------
  const NAV = [
    { id: "students", label: "学员", icon: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>' },
    { id: "enroll", label: "入学诊断", icon: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>' },
    { id: "suggest", label: "教学建议", icon: '<path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.3h6c0-1 .4-1.8 1-2.3A7 7 0 0 0 12 2Z"/>' },
    { id: "plan", label: "课程规划", icon: '<path d="M4 19h16M4 5h16M4 12h16"/>' },
    { id: "records", label: "学情记录", icon: '<path d="M3 3v18h18"/><path d="M7 14l4-4 4 4 5-6"/>' },
    { id: "stage", label: "阶段诊断", icon: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>' },
    { id: "archive", label: "成长档案", icon: '<path d="M3 7l9-4 9 4M3 7v10l9 4 9-4V7"/><path d="M12 11v10"/>' },
    { id: "db", label: "数据库", icon: '<path d="M3 7l9-4 9 4M3 7v10l9 4 9-4V7"/><path d="M3 12l9 4 9-4"/>' },
  ];

  // ---------- 种子（演示模式） ----------
  function genLiuDetails() {
    const spec = [
      { m: "单项选择", n: 10, full: 1, score: 4, kp: ["冠词", "介词", "时态", "短语", "连词", "代词", "情态", "比较级", "宾语", "交际"] },
      { m: "完形填空", n: 15, full: 1, score: 7, kp: ["逻辑", "搭配", "词汇", "指代", "连词", "介词", "短语", "复现", "情感", "常识", "结构", "冠词", "副词", "名词", "形容词"] },
      { m: "阅读理解", n: 20, full: 2, score: 24, kp: ["细节", "推理", "主旨", "猜词", "计算", "态度", "标题", "结构"] },
      { m: "词语运用", n: 15, full: 1, score: 6, kp: ["词形", "时态", "搭配", "单复数", "形容词", "代词", "介词", "连词", "语态", "比较", "冠词", "数词", "非谓语", "情态", "同根"] },
      { m: "阅读与表达", n: 5, full: 2, score: 8, kp: ["提取", "翻译", "问答", "归纳", "转换"] },
      { m: "书面表达", n: 1, full: 20, score: 12, kp: ["书面表达"] },
    ];
    const et = ["知识性错误", "知识性错误", "审题信息提取", "知识性错误", "表达规范", "方法思维", "知识性错误", "审题信息提取"];
    const rows = []; spec.forEach((sp) => { let lost = sp.full * sp.n - sp.score; for (let i = 0; i < sp.n; i++) { const lose = Math.min(sp.full, lost); const sc = sp.full - lose; lost -= lose; rows.push({ question_no: rows.length + 1, module: sp.m, knowledge_point: sp.kp[i % sp.kp.length], cognitive_level: sp.full === 2 ? "理解" : "识记", full_score: sp.full, score: sc, error_type: sc < sp.full ? et[i % et.length] : "无", note: "", data_source: "sample" }); } });
    return rows;
  }
  async function seedIfEmpty() {
    if (Store.getMode() !== "demo") return;
    if ((await Store.list("students")).length) return;
    const s1 = { id: Store.uidGen(), name: "刘英杰", grade: "九年级", school: "城北中学", subject: "英语", enroll_date: "2026-09-01", phone: "", tags: ["1V1"], notes: "" };
    const s2 = { id: Store.uidGen(), name: "王梓涵", grade: "九年级", school: "城北中学", subject: "英语", enroll_date: "2026-09-03", phone: "", tags: ["1V1"], notes: "" };
    await Store.upsert("students", s1); await Store.upsert("students", s2);
    const det = genLiuDetails();
    const a1 = { id: Store.uidGen(), student_id: s1.id, name: "入学测", date: "2026-09-02", type: "enrollment", total_score: 61, total_full: 110, source: "graded_upload", note: "" };
    await Store.upsert("assessments", a1);
    await Store.setDetails(a1.id, det);
    await Store.upsert("diagnoses", { id: Store.uidGen(), student_id: s1.id, assessment_id: a1.id, kind: "enrollment", report: { rate: 0.555, modules: Engine.analyze(det).modules }, suggestions: Engine.genSuggestions(Engine.analyze(det)), plan: Engine.genPlan(Engine.analyze(det)) });
  }

  // ---------- 公共：学员选择器 ----------
  function studentSelect(curId, onChange) {
    return Store.list("students").then((sts) => {
      const cur = curId || (sts[0] && sts[0].id);
      const sel = `<select id="stSel" style="width:auto;min-width:160px">${sts.map((s) => `<option value="${s.id}" ${s.id === cur ? "selected" : ""}>${esc(s.name)} · ${esc(s.grade || "")}</option>`).join("")}</select>`;
      setTimeout(() => { const el = $("#stSel"); if (el) el.onchange = (e) => onChange(e.target.value); }, 0);
      return { cur, sel, sts };
    });
  }

  // ================= 视图：学员 =================
  async function viewStudents() {
    setCrumb("学员档案与测评概览");
    const sts = await Store.list("students");
    $("#topActions").innerHTML = `<button class="btn btn-primary btn-sm" id="addSt">新增学员</button>`;
    let html = sts.length ? `<div class="card"><div class="card-head"><h3>学员列表（${sts.length}）</h3><input id="stSearch" placeholder="搜索姓名/学校/标签" style="width:240px"></div><div class="card-pad" style="padding-top:8px"><table><thead><tr><th>姓名</th><th>年级/学科</th><th>学校</th><th>入学</th><th>测评</th><th>最近得分率</th><th></th></tr></thead><tbody id="stBody"></tbody></table></div></div>` : `<div class="empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg><p>还没有学员，点击右上角新增。</p></div>`;
    $("#view").innerHTML = html;
    if (sts.length) renderStudentRows("");
    $("#addSt").onclick = () => openStudentModal(null);
    const s = $("#stSearch"); if (s) s.oninput = (e) => renderStudentRows(e.target.value);
  }
  async function renderStudentRows(q) {
    const sts = await Store.list("students"); const as = await Store.list("assessments");
    const ql = (q || "").trim().toLowerCase();
    const fil = sts.filter((s) => !ql || (s.name + " " + (s.school || "") + " " + (s.tags || []).join(" ")).toLowerCase().includes(ql));
    $("#stBody").innerHTML = fil.map((s) => {
      const sa = as.filter((a) => a.student_id === s.id).sort((a, b) => a.date.localeCompare(b.date));
      const last = sa[sa.length - 1]; const r = last && last.total_full ? last.total_score / last.total_full : null;
      const tags = (s.tags || []).map((t) => `<span class="tag tag-indigo">${esc(t)}</span>`).join(" ");
      return `<tr><td><strong>${esc(s.name)}</strong><div class="muted" style="font-size:11.5px">${tags}</div></td><td>${esc(s.grade || "-")} / ${esc(s.subject || "-")}</td><td class="subtle">${esc(s.school || "-")}</td><td class="mono subtle">${fmtDate(s.enroll_date)}</td><td class="num">${sa.length}</td><td>${r != null ? rateChip(r) : "<span class='muted'>—</span>"}</td><td class="right"><button class="btn btn-sm" data-d="${s.id}">查看</button></td></tr>`;
    }).join("") || `<tr><td colspan="7" class="muted" style="text-align:center;padding:20px">无匹配</td></tr>`;
    $$("#stBody [data-d]").forEach((b) => (b.onclick = () => viewStudentDetail(b.dataset.d)));
  }
  async function viewStudentDetail(id) {
    const s = (await Store.list("students")).find((x) => x.id === id); if (!s) return;
    const as = (await Store.list("assessments")).filter((a) => a.student_id === id).sort((a, b) => a.date.localeCompare(b.date));
    const dg = (await Store.list("diagnoses")).filter((d) => d.student_id === id);
    setCrumb("学员档案");
    $("#topActions").innerHTML = `<button class="btn btn-sm" id="edSt">编辑</button>`;
    const tags = (s.tags || []).map((t) => `<span class="tag tag-indigo">${esc(t)}</span>`).join(" ") || "<span class='muted'>无</span>";
    const asRows = as.length ? as.map((a) => `<tr><td>${esc(a.name)}</td><td class="mono subtle">${fmtDate(a.date)}</td><td>${esc(a.type)}</td><td class="num">${a.total_score}/${a.total_full}</td><td>${a.total_full ? rateChip(a.total_score / a.total_full) : ""}</td><td class="right"><button class="btn btn-sm" data-g="${a.id}">看</button></td></tr>`).join("") : `<tr><td colspan="6" class="muted" style="text-align:center;padding:18px">暂无测评</td></tr>`;
    $("#view").innerHTML = `<div class="grid grid-3 mb-16"><div class="card stat"><div class="label">年级/学科</div><div class="value" style="font-size:18px">${esc(s.grade || "-")} · ${esc(s.subject || "-")}</div></div><div class="card stat"><div class="label">测评</div><div class="value">${as.length}<small> 次</small></div></div><div class="card stat"><div class="label">诊断</div><div class="value">${dg.length}<small> 份</small></div></div></div>
    <div class="grid grid-2"><div class="card card-pad"><div class="section-title">档案</div><div class="row"><div><div class="muted" style="font-size:12px">学校</div>${esc(s.school || "-")}</div><div><div class="muted" style="font-size:12px">入学</div><div class="mono">${fmtDate(s.enroll_date)}</div></div></div><div class="mt-16"><div class="muted" style="font-size:12px">标签</div><div class="mt-8">${tags}</div></div><div class="mt-16"><div class="muted" style="font-size:12px">备注</div><div class="mt-8 subtle">${esc(s.notes || "无")}</div></div></div>
    <div class="card card-pad"><div class="section-title">快捷入口</div><div class="flex gap-12" style="flex-wrap:wrap"><button class="btn btn-primary btn-sm" id="qEn">入学诊断</button><button class="btn btn-sm" id="qSu">教学建议</button><button class="btn btn-sm" id="qPl">课程规划</button><button class="btn btn-sm" id="qAr">成长档案</button></div><hr class="hr"/><div class="note">在顶部导航按「入学诊断→教学建议→课程规划→学情记录→阶段诊断→成长档案」顺序推进。</div></div></div>
    <div class="grid grid-2 mt-16"><div class="card"><div class="card-head"><h3>测评记录</h3></div><div class="card-pad" style="padding-top:8px"><table><thead><tr><th>名称</th><th>日期</th><th>类型</th><th>得分</th><th>得分率</th><th></th></tr></thead><tbody>${asRows}</tbody></table></div></div>
    <div class="card"><div class="card-head"><h3>诊断记录</h3></div><div class="card-pad" style="padding-top:8px"><table><thead><tr><th>类型</th><th>日期</th><th>得分率</th></tr></thead><tbody>${dg.length ? dg.map((d) => `<tr><td>${d.kind === "enrollment" ? "入学" : "阶段"}</td><td class="mono subtle">${fmtDate(d.created_at)}</td><td>${d.report ? rateChip(d.report.rate) : ""}</td></tr>`).join("") : '<tr><td colspan="3" class="muted" style="text-align:center;padding:18px">暂无</td></tr>'}</tbody></table></div></div></div>`;
    $("#edSt").onclick = () => openStudentModal(s);
    $("#qEn").onclick = () => (location.hash = "#/enroll/" + id);
    $("#qSu").onclick = () => (location.hash = "#/suggest/" + id);
    $("#qPl").onclick = () => (location.hash = "#/plan/" + id);
    $("#qAr").onclick = () => (location.hash = "#/archive/" + id);
  }
  function openStudentModal(s) {
    const e = !!s; const o = s || { name: "", grade: "", school: "", subject: "", enroll_date: fmtDate(new Date().toISOString()), phone: "", tags: [], notes: "" };
    openModal("学员信息", `<label class="fld"><span>姓名 *</span><input id="f_name" value="${esc(o.name)}"></label><div class="row"><label class="fld"><span>年级</span><input id="f_grade" value="${esc(o.grade)}"></label><label class="fld"><span>学科</span><input id="f_subject" value="${esc(o.subject)}"></label></div><div class="row"><label class="fld"><span>学校</span><input id="f_school" value="${esc(o.school)}"></label><label class="fld"><span>入学日期</span><input id="f_enroll" type="date" value="${esc(o.enroll_date)}"></label></div><label class="fld"><span>标签(逗号分隔)</span><input id="f_tags" value="${esc((o.tags || []).join(", "))}"></label><label class="fld"><span>备注</span><textarea id="f_notes">${esc(o.notes)}</textarea></label>`,
      [{ label: "取消", cls: "btn-ghost", onClick: closeModal }, { label: e ? "保存" : "创建", cls: "btn-primary", onClick: async () => { const name = $("#f_name").value.trim(); if (!name) return toast("请填写姓名"); const row = { name, grade: $("#f_grade").value.trim(), school: $("#f_school").value.trim(), subject: $("#f_subject").value.trim(), enroll_date: $("#f_enroll").value, phone: $("#f_phone").value.trim(), tags: $("#f_tags").value.split(",").map((t) => t.trim()).filter(Boolean), notes: $("#f_notes").value.trim() }; if (e) await Store.upsert("students", { ...s, ...row }); else await Store.upsert("students", row); closeModal(); toast("已保存"); viewStudents(); } }]);
  }

  // ================= 视图：入学诊断 =================
  async function viewEnroll(studentId) {
    setCrumb("上传试卷 → 试卷分析");
    const { cur, sel } = await studentSelect(studentId, (v) => (location.hash = "#/enroll/" + v));
    $("#topActions").innerHTML = sel;
    $("#view").innerHTML = `<div class="card card-pad">
      <div class="section-title">第 1 步 · 录入试卷</div>
      <div class="grid grid-2">
        <div><div class="note mb-12">路径 A：上传<b>已批阅试卷</b>的逐题 CSV（字段 question_no,module,knowledge_point,cognitive_level,full_score,score,error_type,note），平台直接生成试卷分析。</div>
        <label class="fld"><span>粘贴逐题 CSV / 上传</span><textarea id="enCsv" style="min-height:130px;font-family:var(--font-mono);font-size:12px" placeholder="question_no,module,knowledge_point,cognitive_level,full_score,score,error_type,note"></textarea><input type="file" id="enFile" accept=".csv,text/csv" class="mt-8"></label></div>
        <div><div class="note mb-12">路径 B：上传<b>未批阅试卷图片 + 答案</b>，由 AI 批阅后生成分析（需配置 Supabase + AI）。</div>
        <label class="fld"><span>试卷图片（可多张）</span><input type="file" id="enImgs" accept="image/*" multiple></label>
        <label class="fld"><span>答案 / 评分标准（文本）</span><textarea id="enAns" style="min-height:80px"></textarea></label></div>
      </div>
      <div class="flex gap-8"><button class="btn btn-primary" id="enRunA">路径A · 生成分析</button><button class="btn" id="enRunB">路径B · AI 批阅生成</button><button class="btn btn-sm" id="enSample">填入示例CSV</button></div>
    </div><div id="enOut"></div>`;
    $("#enSample").onclick = () => ($("#enCsv").value = "question_no,module,knowledge_point,cognitive_level,full_score,score,error_type,note\n1,单项选择,冠词,识记,1,0,知识性错误,\n2,阅读理解,细节,理解,2,0,审题信息提取,");
    $("#enFile").onchange = (e) => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => ($("#enCsv").value = r.result); r.readAsText(f); };
    $("#enRunA").onclick = () => runEnrollA(cur);
    $("#enRunB").onclick = () => runEnrollB(cur);
  }
  async function runEnrollA(studentId) {
    const csv = $("#enCsv").value.trim(); if (!csv) return toast("请粘贴或上传 CSV");
    const rows = Engine.parseExamDetailCSV(csv); if (!rows.length) return toast("CSV 解析失败");
    const d = Engine.analyze(rows);
    const a = await Store.upsert("assessments", { student_id: studentId, name: "入学测", date: fmtDate(new Date().toISOString()), type: "enrollment", total_score: d.total.s, total_full: d.total.f, source: "graded_upload" });
    await Store.setDetails(a.id, rows);
    const diag = await Store.upsert("diagnoses", { student_id: studentId, assessment_id: a.id, kind: "enrollment", report: { rate: d.rate, modules: d.modules, errorTypes: d.errorTypes, knowledge: d.knowledge, total: d.total, lostTotal: d.lostTotal }, suggestions: Engine.genSuggestions(d), plan: Engine.genPlan(d) });
    renderEnrollReport(d, diag.id, "已保存入学诊断（可到「教学建议」继续）。");
  }
  async function runEnrollB(studentId) {
    const s = (await Store.list("students")).find((x) => x.id === studentId);
    const imgEls = $("#enImgs").files; const ans = $("#enAns").value.trim();
    if (!imgEls.length) return toast("请选择试卷图片");
    const ts = Date.now();
    const images = []; const paperPaths = [];
    for (const f of imgEls) {
      const b64 = await fileToDataUrl(f);
      images.push({ name: f.name, dataUrl: b64 });
      try { const up = await Store.uploadFile(`${studentId}/enroll/${ts}-${f.name}`, f); paperPaths.push(up.path); }
      catch (e) { console.warn("试卷上传失败（不影响批阅）", e); }
    }
    toast("AI 批阅中…");
    try {
      const res = await AI.gradePaper({ images, answerText: ans, studentName: s ? s.name : "", subject: s ? s.subject : "" });
      const rows = (res.details || []).map((r) => ({ question_no: r.question_no, module: r.module, knowledge_point: r.knowledge_point, cognitive_level: r.cognitive_level, full_score: r.full_score, score: r.score, error_type: r.error_type, note: r.note, data_source: "ai" }));
      const d = Engine.analyze(rows);
      const a = await Store.upsert("assessments", { student_id: studentId, name: "入学测", date: fmtDate(new Date().toISOString()), type: "enrollment", total_score: res.summary ? res.summary.totalScore : d.total.s, total_full: res.summary ? res.summary.totalFull : d.total.f, source: "ai_graded", paper_url: paperPaths.length ? JSON.stringify(paperPaths) : null });
      await Store.setDetails(a.id, rows);
      const diag = await Store.upsert("diagnoses", { student_id: studentId, assessment_id: a.id, kind: "enrollment", report: { rate: d.rate, modules: d.modules, errorTypes: d.errorTypes, knowledge: d.knowledge, total: d.total, lostTotal: d.lostTotal }, suggestions: Engine.genSuggestions(d), plan: Engine.genPlan(d) });
      const where = Store.getMode() === "supabase"
        ? "试卷已存入你的 Supabase Storage。"
        : "（演示模式：图片仅存于本浏览器 IndexedDB，未上传服务器；配置 Supabase 后才会存入你的项目）";
      renderEnrollReport(d, diag.id, "AI 批阅完成，入学诊断已保存。" + where);
    } catch (err) { toast(err.message || "批阅失败"); }
  }
  function renderEnrollReport(d, diagId, msg) {
    $("#enOut").innerHTML = `<div class="grid grid-3 mt-16"><div class="card stat"><div class="label">总得分率</div><div class="value" style="color:${rateColor(d.rate)}">${(d.rate * 100).toFixed(1)}<small>%</small></div></div><div class="card stat"><div class="label">失分</div><div class="value">${d.lostTotal}<small> 分</small></div></div><div class="card stat"><div class="label">模块数</div><div class="value" style="font-size:20px">${d.modules.length}</div></div></div>
    <div class="grid grid-2 mt-16"><div class="card card-pad"><div class="section-title">模块得分率</div><div class="chart-box">${hBar(d.modules.map((m) => ({ label: m.name, value: m.rate })))}</div></div><div class="card card-pad"><div class="section-title">错误类型</div>${d.errorTypes.length ? doughnut(d.errorTypes.map((e) => ({ label: e.k, value: e.lost }))) : "<p class='muted'>无失分</p>"}</div></div>
    <div class="card card-pad mt-16"><div class="section-title">失分知识点 Top</div><div class="chart-box">${hBar(d.knowledge.slice(0, 8).map((k) => ({ label: k.kp, value: k.lost / (d.lostTotal || 1) })))}</div></div>
    <div class="card card-pad mt-16"><div class="section-title">自动教学建议（可手动修改）</div><div id="enSug">${Engine.genSuggestions(d).map((s) => `<div class="suggestion"><div class="dot"></div><div><div style="font-weight:550">${esc(s.what)}</div><div class="muted" style="font-size:12px">给谁做：${esc(s.who)} ｜ 何时验证：${esc(s.when)}</div></div></div>`).join("")}</div></div>
    <div class="flex gap-8 mt-16" style="justify-content:flex-end"><button class="btn" id="enMd">导出 Markdown</button></div>`;
    if (msg) toast(msg);
    $("#enMd").onclick = () => downloadText(`# 入学诊断\n得分率 ${(d.rate * 100).toFixed(1)}%\n` + d.modules.map((m) => `- ${m.name}: ${(m.rate * 100).toFixed(1)}%`).join("\n"), "入学诊断.md");
  }
  function fileToDataUrl(f) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); }); }

  // ================= 视图：教学建议 =================
  async function viewSuggest(studentId) {
    setCrumb("基于试卷分析的知识点教学建议");
    const { cur, sel } = await studentSelect(studentId, (v) => (location.hash = "#/suggest/" + v));
    const dgs = (await Store.list("diagnoses")).filter((d) => d.student_id === cur && d.kind === "enrollment");
    $("#topActions").innerHTML = sel;
    $("#view").innerHTML = `<div class="card card-pad"><div class="section-title">生成教学建议</div><div class="note mb-12">基于该生<b>入学诊断</b>的薄弱点与错误类型，AI 给出知识点学习建议（含做什么/给谁做/何时验证）。支持自动生成与手动修改。</div><button class="btn btn-primary" id="suGen" ${dgs.length ? "" : "disabled"}>AI 生成教学建议</button>${dgs.length ? "" : '<span class="muted" style="margin-left:10px">需先完成入学诊断</span>'}<div id="suOut" class="mt-16"></div></div>`;
    if (dgs.length) $("#suGen").onclick = async () => {
      toast("生成中…"); const d = dgs[0];
      const r = await AI.teachSuggest({ analyze: d.report });
      const sug = r.suggestions || [];
      await Store.upsert("diagnoses", { ...d, suggestions: sug });
      $("#suOut").innerHTML = sug.map((s, i) => `<div class="suggestion"><div class="dot"></div><div><div style="font-weight:550">${esc(s.what || "")}</div><div class="muted" style="font-size:12px">给谁做：${esc(s.who || "")} ｜ 何时验证：${esc(s.when || "")}</div></div></div>`).join("") || "<p class='muted'>无建议</p>";
      toast("已生成并保存");
    };
  }

  // ================= 视图：课程规划 =================
  async function viewPlan(studentId) {
    setCrumb("学期课次规划（一周1次课）");
    const { cur, sel } = await studentSelect(studentId, (v) => (location.hash = "#/plan/" + v));
    const dgs = (await Store.list("diagnoses")).filter((d) => d.student_id === cur && d.kind === "enrollment");
    const weak = dgs[0] ? dgs[0].report.modules.filter((m) => m.full >= 5) : [];
    const termOpts = window.TERM_ORDER.map((t) => `<option value="${t}">${window.TERM_SESSIONS[t].label}</option>`).join("");
    $("#topActions").innerHTML = sel;
    $("#view").innerHTML = `<div class="card card-pad"><div class="section-title">学期课程规划</div><div class="row" style="max-width:460px"><label class="fld"><span>学期</span><select id="plTerm">${termOpts}</select></label><label class="fld"><span>课次基数</span><input id="plN" type="number" value="25"></label></div><div class="note mb-12">课频：第一学期 25 次 / 寒假 12 次 / 第二学期 25 次 / 暑期 25 次。可改。</div><button class="btn btn-primary" id="plGen">AI 生成课次规划</button><div id="plOut" class="mt-16"></div></div>`;
    $("#plTerm").onchange = (e) => ($("#plN").value = window.TERM_SESSIONS[e.target.value].n);
    $("#plGen").onclick = async () => {
      const term = $("#plTerm").value, n = parseInt($("#plN").value) || 25;
      toast("生成中…");
      const r = await AI.coursePlan({ term, n, weakModules: weak });
      const sessions = r.sessions || [];
      const saved = await Store.upsert("course_plans", { student_id: cur, term, start_date: "", end_date: "", total_sessions: n, sessions });
      renderPlanTable(saved.id, sessions);
    };
  }
  function renderPlanTable(planId, sessions) {
    $("#plOut").innerHTML = `<table><thead><tr><th>#</th><th>主题</th><th>重点</th></tr></thead><tbody>${sessions.map((s, i) => `<tr><td class="num">${i + 1}</td><td>${esc(s.topic || "")}</td><td class="subtle">${esc(s.focus || "")}</td></tr>`).join("")}</tbody></table><div class="flex gap-8 mt-16" style="justify-content:flex-end"><button class="btn" id="plMd">导出</button></div>`;
    $("#plMd").onclick = () => downloadText("# 课程规划\n" + sessions.map((s, i) => `${i + 1}. ${s.topic} —— ${s.focus}`).join("\n"), "课程规划.md");
  }

  // ================= 视图：学情记录 =================
  async function viewRecords(studentId) {
    setCrumb("周测/月测/期中期末 成绩与诊断");
    const { cur, sel } = await studentSelect(studentId, (v) => (location.hash = "#/records/" + v));
    const recs = (await Store.list("learning_records")).filter((r) => r.student_id === cur).sort((a, b) => a.date.localeCompare(b.date));
    const typeOpts = ["weekly", "monthly", "mid", "final"].map((t) => `<option value="${t}">${t}</option>`).join("");
    $("#topActions").innerHTML = sel;
    $("#view").innerHTML = `<div class="card card-pad"><div class="section-title">新增学情记录</div><div class="row" style="max-width:560px"><label class="fld"><span>类型</span><select id="rcType">${typeOpts}</select></label><label class="fld"><span>日期</span><input id="rcDate" type="date" value="${fmtDate(new Date().toISOString())}"></label></div><label class="fld"><span>小结</span><textarea id="rcSum" placeholder="本次测评整体情况"></textarea></label><label class="fld"><span>逐题诊断 CSV（可选，自动生成知识点诊断）</span><textarea id="rcCsv" style="min-height:90px;font-family:var(--font-mono);font-size:12px" placeholder="question_no,module,knowledge_point,cognitive_level,full_score,score,error_type,note"></textarea></label><button class="btn btn-primary" id="rcAdd">保存记录</button></div>
    <div class="card mt-16"><div class="card-head"><h3>学情记录（${recs.length}）</h3></div><div class="card-pad" style="padding-top:8px"><table><thead><tr><th>日期</th><th>类型</th><th>小结</th><th>知识点诊断</th></tr></thead><tbody>${recs.length ? recs.map((r) => `<tr><td class="mono subtle">${fmtDate(r.date)}</td><td>${r.type}</td><td class="subtle">${esc((r.summary || "").slice(0, 30))}</td><td>${r.knowledge_diagnosis ? rateChip(avgRate(r.knowledge_diagnosis.modules)) : "—"}</td></tr>`).join("") : '<tr><td colspan="4" class="muted" style="text-align:center;padding:18px">暂无记录</td></tr>'}</tbody></table></div></div>`;
    $("#rcAdd").onclick = async () => {
      const csv = $("#rcCsv").value.trim(); let kd = null;
      if (csv) { const d = Engine.analyze(Engine.parseExamDetailCSV(csv)); kd = { modules: d.modules, errorTypes: d.errorTypes, knowledge: d.knowledge, rate: d.rate }; }
      await Store.upsert("learning_records", { student_id: cur, date: $("#rcDate").value, type: $("#rcType").value, summary: $("#rcSum").value, knowledge_diagnosis: kd });
      toast("已保存"); viewRecords(cur);
    };
  }
  function avgRate(mods) { if (!mods || !mods.length) return 0; return mods.reduce((a, m) => a + m.rate, 0) / mods.length; }

  // ================= 视图：阶段诊断 =================
  async function viewStage(studentId) {
    setCrumb("半学期综合学情诊断");
    const { cur, sel } = await studentSelect(studentId, (v) => (location.hash = "#/stage/" + v));
    const recs = (await Store.list("learning_records")).filter((r) => r.student_id === cur);
    const dgs = (await Store.list("diagnoses")).filter((d) => d.student_id === cur);
    $("#topActions").innerHTML = sel;
    $("#view").innerHTML = `<div class="card card-pad"><div class="section-title">阶段学情诊断</div><div class="note mb-12">综合该生半学期的学情记录与历次诊断，AI 出具阶段诊断（归因 + 建议 + 计划）。支持自动生成与手动修改。</div><button class="btn btn-primary" id="stGen">AI 生成阶段诊断</button><div id="stOut" class="mt-16"></div></div>`;
    $("#stGen").onclick = async () => {
      toast("生成中…");
      const allMods = {}, cnt = {};
      recs.forEach((r) => { if (r.knowledge_diagnosis) r.knowledge_diagnosis.modules.forEach((m) => { allMods[m.name] = (allMods[m.name] || 0) + m.rate; cnt[m.name] = (cnt[m.name] || 0) + 1; }); });
      const modules = Object.entries(allMods).map(([k, v]) => ({ name: k, rate: cnt[k] ? v / cnt[k] : 0 }));
      const r = await AI.stageDiagnosis({ analyze: { modules, errorTypes: [], knowledge: [] }, records: recs });
      const saved = await Store.upsert("diagnoses", { student_id: cur, kind: "stage", report: { rate: r.modules ? avgRate(r.modules) : 0, modules: r.modules || [] }, suggestions: r.suggestions || [], plan: r.plan || [] });
      $("#stOut").innerHTML = `<div class="card card-pad"><div class="section-title">阶段诊断</div><p class="subtle">${esc(r.summary || "")}</p>${r.suggestions ? "<div class='mt-16'>" + r.suggestions.map((s) => `<div class="suggestion"><div class="dot"></div><div><div style="font-weight:550">${esc(s.what || "")}</div><div class="muted" style="font-size:12px">给谁做：${esc(s.who || "")} ｜ 何时验证：${esc(s.when || "")}</div></div></div>`).join("") + "</div>" : ""}${r.plan ? "<div class='mt-16 section-title'>阶段计划</div>" + r.plan.map((w) => `<div class="plan-week"><div class="wk">${esc(w.week || "")} · ${esc(w.title || "")}</div><div class="subtle" style="font-size:12px">${esc(w.focus || "")}</div></div>`).join("") : ""}</div>`;
      toast("已生成并保存");
    };
  }

  // ================= 视图：成长档案 =================
  async function viewArchive(studentId) {
    setCrumb("从入学到当前的成长档案");
    const { cur, sel } = await studentSelect(studentId, (v) => (location.hash = "#/archive/" + v));
    const s = (await Store.list("students")).find((x) => x.id === cur);
    const as = (await Store.list("assessments")).filter((a) => a.student_id === cur);
    const recs = (await Store.list("learning_records")).filter((r) => r.student_id === cur);
    const logs = (await Store.list("lesson_logs")).filter((l) => l.student_id === cur);
    const dgs = (await Store.list("diagnoses")).filter((d) => d.student_id === cur);
    $("#topActions").innerHTML = sel;
    $("#view").innerHTML = `<div class="card card-pad"><div class="section-title">学生成长档案</div><div class="note mb-12">汇总入学诊断、课程规划、各次学情记录与上课情况，AI 出具成长档案（生成后可手动修改、导出）。</div><button class="btn btn-primary" id="arGen">AI 生成成长档案</button><div id="arOut" class="mt-16"></div></div>`;
    $("#arGen").onclick = async () => {
      toast("生成中…");
      const r = await AI.growthArchive({ student: s, context: { assessments: as, records: recs, logs, diagnoses: dgs } });
      const md = r.archive || Engine.genGrowthArchive(s, { assessments: as });
      $("#arOut").innerHTML = `<div class="card card-pad"><div class="section-title">成长档案（可编辑）</div><textarea id="arTxt" style="min-height:320px;font-family:var(--font-mono);font-size:12.5px">${esc(md)}</textarea><div class="flex gap-8 mt-16" style="justify-content:flex-end"><button class="btn" id="arCopy">复制</button><button class="btn btn-primary" id="arMd">导出 Markdown</button></div></div>`;
      $("#arMd").onclick = () => downloadText($("#arTxt").value, `成长档案_${esc(s.name)}.md`);
      $("#arCopy").onclick = () => { navigator.clipboard.writeText($("#arTxt").value); toast("已复制"); };
    };
  }

  // ================= 视图：数据库 =================
  async function viewDB() {
    setCrumb("知识点库 / 校历库");
    const kdb = await Store.list("knowledge_db");
    const cdb = await Store.list("calendar_db");
    $("#topActions").innerHTML = "";
    $("#view").innerHTML = `<div class="grid grid-2">
      <div class="card card-pad"><div class="section-title">知识点库（教材/知识点明细）</div>
        <label class="fld"><span>学科</span><input id="kSub" placeholder="如 英语"></label>
        <label class="fld"><span>学段</span><input id="kGrade" placeholder="如 九年级"></label>
        <label class="fld"><span>标题</span><input id="kTitle"></label>
        <label class="fld"><span>内容（知识点明细文本）</span><textarea id="kContent"></textarea></label>
        <label class="fld"><span>或上传文件（教材/Excel 等）</span><input type="file" id="kFile"></label>
        <button class="btn btn-primary btn-sm" id="kAdd">入库</button>
        <div class="mt-16"><div id="kList">${kdb.map((k) => `<div class="suggestion"><div class="dot"></div><div><div style="font-weight:550">${esc(k.title)}</div><div class="muted" style="font-size:12px">${esc(k.subject || "")} ${esc(k.grade_band || "")}</div>${k.file_url ? `<div class="mono" style="font-size:11px;color:var(--indigo);margin-top:3px">📎 ${esc(k.file_url)}</div>` : ""}</div></div>`).join("") || '<p class="muted">空</p>'}</div></div>
      </div>
      <div class="card card-pad"><div class="section-title">校历库（考试预判依据）</div>
        <label class="fld"><span>标题</span><input id="cTitle"></label>
        <label class="fld"><span>内容（校历/考试安排）</span><textarea id="cContent"></textarea></label>
        <label class="fld"><span>或上传图片/Excel</span><input type="file" id="cFile"></label>
        <button class="btn btn-primary btn-sm" id="cAdd">入库</button>
        <div class="mt-16"><div id="cList">${cdb.map((c) => `<div class="suggestion"><div class="dot"></div><div><div style="font-weight:550">${esc(c.title)}</div></div></div>`).join("") || '<p class="muted">空</p>'}</div></div>
      </div>
    </div>`;
    $("#kAdd").onclick = async () => { const f = $("#kFile").files[0]; let fileUrl = null; if (f) { try { const up = await Store.uploadFile(`${Store.getUid()}/kb/${Date.now()}-${f.name}`, f); fileUrl = up.path; } catch (e) { toast("文件上传失败：" + (e.message || e)); } } await Store.upsert("knowledge_db", { subject: $("#kSub").value, grade_band: $("#kGrade").value, title: $("#kTitle").value || (f ? f.name : "未命名"), content: $("#kContent").value, file_url: fileUrl }); toast("已入库" + (fileUrl ? "（文件已存至你的存储）" : (f ? "（未配置 Supabase，文件仅本浏览器）" : ""))); viewDB(); };
    $("#cAdd").onclick = async () => { const f = $("#cFile").files[0]; let fileUrl = null; if (f) { try { const up = await Store.uploadFile(`${Store.getUid()}/calendar/${Date.now()}-${f.name}`, f); fileUrl = up.path; } catch (e) { toast("文件上传失败：" + (e.message || e)); } } await Store.upsert("calendar_db", { title: $("#cTitle").value || (f ? f.name : "未命名"), content: $("#cContent").value, file_url: fileUrl }); toast("已入库" + (fileUrl ? "（文件已存至你的存储）" : (f ? "（未配置 Supabase，文件仅本浏览器）" : ""))); viewDB(); };
  }

  // ================= 认证 =================
  async function maybeAuthGate() {
    if (Store.getMode() !== "supabase") return false;
    const u = await Store.getUser();
    if (u) return false;
    $("#view").innerHTML = `<div class="empty" style="max-width:380px;margin:80px auto"><h3>登录以使用学员管理平台</h3><p class="muted">已检测到 Supabase 配置，请登录（数据受行级权限保护）。</p>
      <input id="auEmail" placeholder="邮箱" style="margin-bottom:10px"><input id="auPw" type="password" placeholder="密码" style="margin-bottom:10px">
      <div class="flex gap-8" style="justify-content:center"><button class="btn btn-primary" id="auIn">登录</button><button class="btn btn-ghost" id="auUp">注册</button></div></div>`;
    $("#auIn").onclick = async () => { try { await Store.signIn($("#auEmail").value, $("#auPw").value); toast("已登录"); router(); } catch (e) { toast(e.message); } };
    $("#auUp").onclick = async () => { try { await Store.signUp($("#auEmail").value, $("#auPw").value, "教师"); toast("注册成功，请查收验证邮件"); } catch (e) { toast(e.message); } };
    return true;
  }

  // ================= 路由 =================
  function setActive(nav) { $$(".nav-item[data-nav],.mnav-item[data-nav]").forEach((n) => n.classList.toggle("active", n.dataset.nav === nav)); }
  function setCrumb(t) { $("#pageTitle").textContent = NAV.find((n) => location.hash.includes("/" + n.id) || (location.hash === "#/" + n.id))?.label || "学员管理平台"; $("#pageCrumb").textContent = t; }
  async function router() {
    const hash = location.hash || "#/students";
    const parts = hash.replace(/^#\//, "").split("/");
    const nav = parts[0] || "students";
    setActive(nav);
    if (await maybeAuthGate()) return;
    if (nav === "enroll") return viewEnroll(parts[1]);
    if (nav === "suggest") return viewSuggest(parts[1]);
    if (nav === "plan") return viewPlan(parts[1]);
    if (nav === "records") return viewRecords(parts[1]);
    if (nav === "stage") return viewStage(parts[1]);
    if (nav === "archive") return viewArchive(parts[1]);
    if (nav === "db") return viewDB();
    return viewStudents();
  }

  // ================= 初始化 =================
  async function init() {
    await Store.init();
    const savedTheme = (localStorage.getItem("sp_theme") || "light");
    document.documentElement.setAttribute("data-theme", savedTheme);
    $("#themeToggle").onclick = () => { const c = document.documentElement.getAttribute("data-theme"); const n = c === "dark" ? "light" : "dark"; document.documentElement.setAttribute("data-theme", n); localStorage.setItem("sp_theme", n); toast(n === "dark" ? "已切换为深色" : "已切换为浅色"); };
    $("#exportAll").onclick = () => toast("演示模式：数据存于本浏览器；接入 Supabase 后可在多端同步");
    $$(".nav-item[data-nav]").forEach((n) => (n.onclick = () => { const id = n.dataset.nav; location.hash = id === "students" ? "#/students" : "#/" + id; }));
    const mn = $("#mobileNav");
    if (mn) { mn.innerHTML = NAV.map((n) => `<div class="mnav-item" data-nav="${n.id}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${n.icon}</svg><span>${n.label}</span></div>`).join(""); $$(".mnav-item[data-nav]").forEach((n) => (n.onclick = () => { const id = n.dataset.nav; location.hash = id === "students" ? "#/students" : "#/" + id; })); }
    window.addEventListener("hashchange", router);
    await seedIfEmpty();
    router();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
