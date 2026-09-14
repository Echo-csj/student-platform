// 学员管理平台 · 数据层（Supabase / 演示模式 localStorage 双实现）
window.Store = (function () {
  const cfg = window.APP_CONFIG || {};
  let sb = null;       // supabase client
  let mode = "demo";   // 'supabase' | 'demo'
  let uid = "demo";

  const BUCKET = "student-files"; // Supabase Storage 桶（用户自有项目内）

  function isConfigured() {
    return !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY);
  }

  // ---------- 演示模式文件兜底：IndexedDB（仅本浏览器，非服务器） ----------
  function idb() {
    return new Promise((res, rej) => {
      const r = indexedDB.open("sp_files_v1", 1);
      r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains("files")) r.result.createObjectStore("files"); };
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
  }
  async function idbPut(key, blob) {
    const db = await idb();
    return new Promise((res, rej) => { const tx = db.transaction("files", "readwrite"); tx.objectStore("files").put(blob, key); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
  }

  // 上传文件到「用户自有」存储：Supabase 模式→项目 Storage 桶；演示模式→本浏览器 IndexedDB
  // 返回 { path, url, demo }。path 即服务器侧保存路径（桶内 key）。
  async function uploadFile(path, file) {
    if (mode !== "supabase" || !sb) {
      await idbPut(path, file);
      return { path, url: URL.createObjectURL(file), demo: true };
    }
    const { data, error } = await sb.storage.from(BUCKET).upload(path, file, { upsert: true, cacheControl: "3600" });
    if (error) throw error;
    const { data: pub } = sb.storage.from(BUCKET).getPublicUrl(data.path);
    return { path: data.path, url: pub.publicUrl, demo: false };
  }
  function fileUrl(path) {
    if (mode !== "supabase" || !sb) return null;
    try { return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl; } catch { return null; }
  }

  async function init() {
    if (!isConfigured()) { mode = "demo"; return false; }
    try {
      if (typeof supabase === "undefined") {
        await new Promise((res, rej) => {
          const s = document.createElement("script");
          s.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
          s.onload = res; s.onerror = rej; document.head.appendChild(s);
        });
      }
      sb = supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
      const { data } = await sb.auth.getUser();
      if (data.user) { uid = data.user.id; mode = "supabase"; }
      else mode = "supabase"; // 已配置但未登录：UI 引导登录
      return true;
    } catch (e) { mode = "demo"; return false; }
  }

  function getMode() { return mode; }
  function getUid() { return uid; }
  function client() { return sb; }

  // ---------- Demo (localStorage) ----------
  const K = (t) => "sp_" + t + "_v1";
  function dGet(t, d) { try { return JSON.parse(localStorage.getItem(K(t))) || d; } catch { return d; } }
  function dSet(t, v) { localStorage.setItem(K(t), JSON.stringify(v)); }
  function dList(t) { return dGet(t, []); }
  function dUpsert(t, row) {
    const arr = dList(t);
    const i = arr.findIndex((x) => x.id === row.id);
    if (i >= 0) arr[i] = { ...arr[i], ...row }; else arr.push({ id: row.id || uidGen(), ...row });
    dSet(t, arr); return arr.find((x) => x.id === (row.id || arr[arr.length - 1].id));
  }
  function dRemove(t, id) { dSet(t, dList(t).filter((x) => x.id !== id)); }

  function uidGen() { return "id_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  // ---------- Auth (supabase) ----------
  async function getUser() { if (mode !== "supabase") return null; const { data } = await sb.auth.getUser(); return data.user; }
  async function signIn(email, pw) { const { data, error } = await sb.auth.signInWithPassword({ email, password }); if (error) throw error; uid = data.user.id; return data.user; }
  async function signUp(email, pw, fullName) { const { data, error } = await sb.auth.signUp({ email, password, options: { data: { full_name: fullName } } }); if (error) throw error; return data.user; }
  async function signOut() { await sb.auth.signOut(); uid = "demo"; }

  // ---------- 通用表操作 ----------
  async function list(t, opts = {}) {
    if (mode === "demo") {
      let arr = dList(t);
      if (opts.studentId) arr = arr.filter((x) => x.student_id === opts.studentId);
      if (opts.ownerOnly !== false) arr = arr.filter((x) => x.owner_id === "demo" || !x.owner_id);
      return arr;
    }
    let q = sb.from(t).select("*");
    if (opts.studentId) q = q.eq("student_id", opts.studentId);
    const { data, error } = await q.order("created_at", { ascending: false });
    if (error) throw error; return data || [];
  }
  async function upsert(t, row) {
    if (mode === "demo") return dUpsert(t, row);
    const payload = { ...row, owner_id: uid };
    const { data, error } = await sb.from(t).upsert(payload).select().single();
    if (error) throw error; return data;
  }
  async function remove(t, id) {
    if (mode === "demo") return dRemove(t, id);
    const { error } = await sb.from(t).delete().eq("id", id);
    if (error) throw error;
  }
  // 逐题明细：按测评整体替换
  async function setDetails(assessmentId, rows) {
    if (mode === "demo") {
      let arr = dList("exam_details").filter((x) => x.assessment_id !== assessmentId);
      rows.forEach((r) => arr.push({ id: uidGen(), owner_id: "demo", assessment_id: assessmentId, ...r }));
      dSet("exam_details", arr); return;
    }
    await sb.from("exam_details").delete().eq("assessment_id", assessmentId);
    if (rows.length) {
      const payload = rows.map((r) => ({ owner_id: uid, assessment_id: assessmentId, ...r }));
      const { error } = await sb.from("exam_details").insert(payload);
      if (error) throw error;
    }
  }
  async function getDetails(assessmentId) {
    if (mode === "demo") return dList("exam_details").filter((x) => x.assessment_id === assessmentId);
    const { data, error } = await sb.from("exam_details").select("*").eq("assessment_id", assessmentId);
    if (error) throw error; return data || [];
  }

  return {
    init, getMode, getUid, client, isConfigured,
    getUser, signIn, signUp, signOut,
    list, upsert, remove, setDetails, getDetails,
    uploadFile, fileUrl, uidGen,
  };
})();
