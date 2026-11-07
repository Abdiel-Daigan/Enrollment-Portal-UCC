import { $, esc, toast, initials } from './utils.js';
import { supa } from './api.js';
import { session, loadSession, doLogin, doRegister, doLogout } from './auth.js';
import { setStudentView, renderStudentDashboard, renderApply, renderBrowseCourses, renderSchedule } from './student.js';

// 1. Initialize Session
loadSession();

// 2. Main Render Function
export async function renderAll() {
  const authPage = $('#authPage');
  const pageWrap = $('#pageWrap');
  const navbar = $('#navbar');
  const toastRoot = $('#toastRoot');

  if (!session) {
    authPage.classList.remove('hidden');
    pageWrap.classList.add('hidden');
    navbar.classList.add('hidden');
    renderAuthPage();
    return;
  }

  authPage.classList.add('hidden');
  pageWrap.classList.remove('hidden');

  // Render Navbar
  navbar.classList.remove('hidden');
  navbar.innerHTML = `
    <div class="nav-brand">
      <div class="nav-brand-text"><span class="b1">UNIDA</span><span class="b2">CHRISTIAN COLLEGES</span></div>
    </div>
    <div class="nav-links">
      <button class="nav-link" data-nav="dashboard">Dashboard</button>
      <button class="nav-link" data-nav="browse">Browse Courses</button>
      <button class="nav-link" data-nav="apply">Apply</button>
      <button class="nav-link" data-nav="schedule">My Schedule</button>
    </div>
    <div style="cursor:pointer" onclick="window.logout()" class="nav-user">👤</div>
  `;

  // Render Page Content
  pageWrap.innerHTML = '<div class="progress-card">Loading...</div>';
  
  // Determine current view (default to dashboard)
  const currentView = window.currentView || 'dashboard';

  if (currentView === 'dashboard') pageWrap.innerHTML = await renderStudentDashboard();
  else if (currentView === 'apply') pageWrap.innerHTML = await renderApply();
  else if (currentView === 'browse') pageWrap.innerHTML = await renderBrowseCourses();
  else if (currentView === 'schedule') pageWrap.innerHTML = await renderSchedule();
}

// 3. Auth Page Renderer
function renderAuthPage() {
  $('#authPage').innerHTML = `
    <div class="auth-card">
      <div class="auth-brand">
        <h1>Unida Christian Colleges</h1>
        <p>Enrollment Portal</p>
      </div>
      <div class="auth-form">
        <div class="auth-tabs">
          <button class="auth-tab active" data-action="authTab" data-tab="login">Sign In</button>
          <button class="auth-tab" data-action="authTab" data-tab="register">Register</button>
        </div>
        <form id="loginForm">
          <div class="field"><label>Email</label><input type="email" name="email" required></div>
          <div class="field"><label>Password</label><input type="password" name="password" required></div>
          <button class="btn btn-primary btn-block" type="submit">Sign In</button>
        </form>
        <form id="registerForm" class="hidden">
          <div class="field"><label>Name</label><input type="text" name="name" required></div>
          <div class="field"><label>Email</label><input type="email" name="email" required></div>
          <div class="field"><label>Password</label><input type="password" name="password" required></div>
          <button class="btn btn-primary btn-block" type="submit">Create Account</button>
        </form>
      </div>
    </div>
  `;
}

// 4. Event Listeners
document.addEventListener('click', async (e) => {
  // Nav routing
  const navBtn = e.target.closest('[data-nav]');
  if (navBtn) {
    window.currentView = navBtn.dataset.nav;
    renderAll();
    return;
  }

  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;

  if (action === 'authTab') {
    $('.auth-tab.active').classList.remove('active');
    btn.classList.add('active');
    if (btn.dataset.tab === 'login') {
      $('#loginForm').classList.remove('hidden');
      $('#registerForm').classList.add('hidden');
    } else {
      $('#loginForm').classList.add('hidden');
      $('#registerForm').classList.remove('hidden');
    }
  }

  if (action === 'nextStep') {
    const step = Number(btn.dataset.step);
    // Save step logic here (simplified for brevity)
    setStudentView('apply', step + 1);
    renderAll();
  }
  
  if (action === 'prevStep') {
    const step = Number(btn.dataset.step);
    setStudentView('apply', step - 1);
    renderAll();
  }

  if (action === 'continueApp') {
    setStudentView('apply', 1);
    window.currentView = 'apply';
    renderAll();
  }
});

document.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (e.target.id === 'loginForm') {
    await doLogin(e.target, () => { window.currentView = 'dashboard'; renderAll(); });
  }
  if (e.target.id === 'registerForm') {
    await doRegister(e.target, () => { window.currentView = 'dashboard'; renderAll(); });
  }
});

// Global logout helper
window.logout = () => {
  doLogout(() => renderAll());
};

// Initial Boot
window.currentView = 'dashboard';
renderAll();
