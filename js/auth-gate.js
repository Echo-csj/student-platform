/* ============================================
   auth-gate.js — 学员管理平台 · 全屏登录门禁
   未登录锁定整个应用；数据表均带 owner_id 行级权限（RLS），
   未登录用户既看不到界面，也无法读取任何数据。

   依赖：window.Store（signIn / signUp / signOut / getUser / isConfigured / getMode）
         window.SP.render（由 app.js 暴露的路由渲染函数）
   登录屏 DOM：#sp-email #sp-pass #sp-login #sp-signup #sp-err #sp-ok #ag-offline
   ============================================ */
(function (global) {
  'use strict';
  var Store = global.Store;
  var SP = global.SP;

  function setLoading(on) {
    var btn = document.getElementById('sp-login');
    var label = btn && btn.querySelector('.ag-btn-label');
    var spin = btn && btn.querySelector('.ag-spinner');
    if (!btn) return;
    btn.disabled = !!on;
    if (btn.classList) btn.classList.toggle('loading', !!on);
    if (label) label.textContent = on ? '登录中…' : '登录';
    if (spin) spin.style.display = on ? '' : 'none';
  }
  function showError(msg) {
    setLoading(false);
    var err = document.getElementById('sp-err');
    var ok = document.getElementById('sp-ok');
    if (ok) ok.style.display = 'none';
    if (err) { err.textContent = msg || '登录失败，请重试'; err.style.display = ''; }
  }
  function showOk(msg) {
    var ok = document.getElementById('sp-ok');
    var err = document.getElementById('sp-err');
    if (err) err.style.display = 'none';
    if (ok) { ok.textContent = msg; ok.style.display = ''; }
  }

  function showAccountChip(email) {
    var foot = document.getElementById('auth-foot');
    if (foot) {
      // 登录态/退出移入左侧栏底部账户区（不再用右上角悬浮条遮挡内容）
      foot.innerHTML = '<div class="sf-mail">' + (email || '已登录') + '</div>' +
        '<button id="sp-signout" class="sf-logout" type="button">退出登录</button>';
      var btn = document.getElementById('sp-signout');
      if (btn) btn.onclick = function () {
        if (Store && Store.signOut) {
          Store.signOut().then(function () { location.reload(); }).catch(function () { location.reload(); });
        } else { location.reload(); }
      };
      return;
    }
    // 回退：无侧栏账户区时仍用悬浮 pill
    var old = document.getElementById('sp-account');
    if (old) old.remove();
    var chip = document.createElement('div');
    chip.id = 'sp-account';
    chip.innerHTML = '<span class="sp-chip-mail">' + (email || '已登录') + '</span>' +
      '<button id="sp-signout" class="sp-chip-btn" type="button">退出</button>';
    document.body.appendChild(chip);
    document.getElementById('sp-signout').onclick = function () {
      if (Store && Store.signOut) {
        Store.signOut().then(function () { location.reload(); }).catch(function () { location.reload(); });
      } else { location.reload(); }
    };
  }

  function unlock() {
    document.body.classList.remove('auth-locked');
    var vc = document.getElementById('view-container') || document.getElementById('view');
    // 已登录：不清空（保留已渲染内容），仅恢复
    try { if (global.SP && global.SP.render) global.SP.render(); } catch (e) {}
    Store.getUser().then(function (u) { showAccountChip(u && u.email); }).catch(function () {});
  }

  function lock() {
    document.body.classList.add('auth-locked');
    var vc = document.getElementById('view-container') || document.getElementById('view');
    if (vc) vc.innerHTML = '';
    var chip = document.getElementById('sp-account');
    if (chip) chip.remove();
    var foot = document.getElementById('auth-foot');
    if (foot) foot.innerHTML = '';
  }

  function doSignIn() {
    var e = document.getElementById('sp-email');
    var p = document.getElementById('sp-pass');
    var email = e ? e.value.trim() : '';
    var pass = p ? p.value : '';
    if (!email || !pass) { showError('请填写邮箱和密码'); return; }
    showError(''); setLoading(true);
    Store.signIn(email, pass).then(function () {
      showOk('登录成功 ✓');
      setTimeout(unlock, 500);
    }).catch(function (err) {
      showError((err && err.message) ? err.message : '登录失败');
    });
  }

  function doSignUp() {
    var e = document.getElementById('sp-email');
    var p = document.getElementById('sp-pass');
    var email = e ? e.value.trim() : '';
    var pass = p ? p.value : '';
    if (!email || !pass) { showError('请填写邮箱和密码'); return; }
    if ((pass || '').length < 6) { showError('密码至少 6 位'); return; }
    showError(''); setLoading(true);
    Store.signUp(email, pass, '教师').then(function () {
      // 自建 Supabase 若关闭邮件验证会直接返回会话；否则需查收验证邮件
      return Store.getUser().then(function (u) {
        if (u) { showOk('注册成功 ✓'); setTimeout(unlock, 500); }
        else { setLoading(false); showOk('注册成功，请查收验证邮件后登录'); }
      });
    }).catch(function (err) {
      showError((err && err.message) ? err.message : '注册失败');
    });
  }

  function renderOffline() {
    var form = document.getElementById('ag-form');
    var off = document.getElementById('ag-offline');
    if (form) form.style.display = 'none';
    if (off) off.style.display = '';
  }

  async function init() {
    // 确保 Store 客户端已就绪（幂等）
    try { if (Store && Store.init) await Store.init(); } catch (e) {}
    SP = global.SP;

    var btn = document.getElementById('sp-login');
    if (btn) btn.onclick = doSignIn;
    var sup = document.getElementById('sp-signup');
    if (sup) sup.onclick = doSignUp;
    var pass = document.getElementById('sp-pass');
    if (pass) pass.onkeydown = function (ev) { if (ev.key === 'Enter') doSignIn(); };

    if (!Store || !Store.isConfigured || !Store.isConfigured()) {
      renderOffline();
      document.body.classList.add('auth-locked');
      return;
    }

    var u = null;
    try { u = await Store.getUser(); } catch (e) {}
    if (u) { unlock(); }
    else { document.body.classList.add('auth-locked'); }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window);
