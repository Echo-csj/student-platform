/* 学员管理平台 · 排课申请 .docx 批量解析
 * 纯前端：mammoth 把 docx → HTML，再展开合并单元格为 2D 网格，标签锚定抽取学员字段。
 * 纯函数（tableToGrid / extractStudent 等）与浏览器无关，可在 Node 中单元测试。
 */
(function (root) {
  "use strict";

  function pad(n) { return String(n).padStart(2, "0"); }

  // 将一个 HTML <table> 展开合并单元格，返回 2D 字符串数组（row -> [col texts]）
  // 注意：colspan 会把同一文本铺到多列（由 findVal/rowCellsWithCol 做连续去重）；
  // rowspan 必须对其覆盖的每一行都注册占位，否则中间行整体左移。
  function tableToGrid(table) {
    const rows = Array.from(table.querySelectorAll("tr"));
    const grid = [];
    const pending = {}; // col -> { left: 剩余行数, text }
    rows.forEach((tr) => {
      const cells = Array.from(tr.querySelectorAll("td,th")).map((cell) => ({
        cs: parseInt(cell.getAttribute("colspan") || "1", 10) || 1,
        rs: parseInt(cell.getAttribute("rowspan") || "1", 10) || 1,
        txt: (cell.textContent || "").replace(/\s+/g, " ").trim(),
      }));
      const rowArr = [];
      let ci = 0, i = 0;
      while (i < cells.length || pending[ci]) {
        if (pending[ci]) {
          const p = pending[ci];
          rowArr[ci] = p.text;
          if (--p.left <= 0) delete pending[ci];
          ci++;
        } else {
          const c = cells[i++];
          for (let k = 0; k < c.cs; k++) {
            rowArr[ci + k] = c.txt;
            if (c.rs > 1) pending[ci + k] = { left: c.rs - 1, text: c.txt };
          }
          ci += c.cs;
        }
      }
      grid.push(rowArr);
    });
    return grid;
  }

  // 在展开后的网格中，按标签找其右侧/下方的值
  // 关键：标签自身常带 colspan（展开后同名延续多列），必须先跳过标签自己的延续列，
  // 否则会把「学校」的值读成「学校」。
  function findVal(grid, label) {
    for (let r = 0; r < grid.length; r++) {
      const row = grid[r] || [];
      for (let c = 0; c < row.length; c++) {
        if (row[c] && row[c].trim() === label) {
          let e = c + 1;
          while (e < row.length && row[e].trim() === label) e++; // 跳过标签延续列
          for (let k = e; k < row.length; k++) {
            if (row[k] && row[k].trim() !== label) return row[k];
          }
          const nxt = grid[r + 1] || [];
          for (let k = e; k < nxt.length; k++) {
            if (nxt[k] && nxt[k].trim() !== label) return nxt[k];
          }
        }
      }
    }
    return "";
  }

  // 取某一行标签右侧（或该行）的全部非空单元格，保留列号：[{col,text}]
  // 连续相同文本视为同一单元格的 colspan 延续，只保留首个（列号取起始列）。
  function rowCellsWithCol(grid, label) {
    for (let r = 0; r < grid.length; r++) {
      const row = grid[r] || [];
      const ci = row.indexOf(label);
      if (ci >= 0) {
        const out = [];
        for (let c = ci + 1; c < row.length; c++) {
          if (row[c] && row[c] !== row[c - 1]) out.push({ col: c, text: row[c] });
        }
        return out;
      }
    }
    return [];
  }

  // 在整表文本中识别带 ☑ / ☒ 的复选项
  function pickChecked(grid, options) {
    const all = grid.map(r => (r || []).join(" ")).join(" ");
    for (const o of options) {
      if (all.includes("☑" + o) || all.includes("☒" + o) || all.includes("[x]" + o) || all.includes("■" + o)) return o;
    }
    for (const o of options) if (all.includes(o)) return o; // 退路：出现即选（模板未勾时也兜底）
    return "";
  }

  function extractSubjects(grid) {
    const subs = rowCellsWithCol(grid, "辅导科目");
    const scs = rowCellsWithCol(grid, "分数/卷面总分");
    const out = subs.map(s => ({ subject: s.text.trim(), score: null, full: null, col: s.col }));
    // 每个分数归到「列号不大于它、且最靠近的」科目（中间缺分数的科目正确留空）
    scs.forEach(sc => {
      let best = null;
      out.forEach(o => { if (o.col <= sc.col && (!best || o.col > best.col)) best = o; });
      if (best) {
        const m = sc.text.match(/([\d.]+)\s*\/\s*([\d.]+)/);
        if (m) { best.score = +m[1]; best.full = +m[2]; }
      }
    });
    return out.filter(x => x.subject);
  }

  function normDate(s) {
    s = (s || "").trim();
    let m = s.match(/(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})/);
    if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
    m = s.match(/(\d{1,2})[/.](\d{1,2})/);
    if (m) return `${new Date().getFullYear()}-${pad(m[1])}-${pad(m[2])}`;
    return "";
  }

  // 从单张学员表（2D 网格）抽取一条学员记录
  function extractStudent(grid) {
    const name = findVal(grid, "姓名");
    const phoneRaw = findVal(grid, "电话");
    const phone = (phoneRaw.match(/1[3-9]\d{9}/) || [""])[0];
    const subs = extractSubjects(grid);
    return {
      name,
      gender: findVal(grid, "性别"),
      school: findVal(grid, "学校"),
      grade: findVal(grid, "年级"),
      class_type: pickChecked(grid, ["普通班", "重点班", "实验班"]),
      phone,
      parent_contact: phoneRaw,
      enroll_date: normDate(findVal(grid, "开课日期")),
      subjects: subs,
      payment_method: pickChecked(grid, ["支付宝", "微信", "银行卡转账", "信用卡", "poss机", "公户"]),
      personality: findVal(grid, "学员学习及个人性格情况"),
      goals: findVal(grid, "家长的教学目标要求"),
      advisor_note: findVal(grid, "教育顾问学习建议"),
      teacher_req: findVal(grid, "对老师的要求"),
      schedule_note: findVal(grid, "允许排课时间及各科周课时"),
      accompany: findVal(grid, "陪读情况"),
    };
  }

  // 解析一个 .docx File（浏览器）：mammoth → HTML → 每张表 → 一条学员
  async function parseDocxFile(file) {
    if (typeof mammoth === "undefined") throw new Error("解析库 mammoth 未加载");
    const buf = await file.arrayBuffer();
    const res = await mammoth.convertToHtml({ arrayBuffer: buf });
    const doc = new DOMParser().parseFromString(res.value, "text/html");
    const tables = Array.from(doc.querySelectorAll("table"));
    return tables.map(tableToGrid).map(extractStudent);
  }

  async function parseDocxFiles(files) {
    const all = [];
    for (const f of files) {
      try { all.push(...(await parseDocxFile(f))); }
      catch (e) { console.warn("解析失败:", f && f.name, e); }
    }
    return all;
  }

  const api = { tableToGrid, findVal, rowCellsWithCol, extractSubjects, normDate, extractStudent, parseDocxFile, parseDocxFiles };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.DocxImport = api;
})(typeof window !== "undefined" ? window : globalThis);
