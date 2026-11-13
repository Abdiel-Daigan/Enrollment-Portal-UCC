import { $, esc, toast, initials } from './utils.js';
import { supa } from './api.js';
import { session, loadSession, doLogin, doRegister, doLogout } from './auth.js';
import { renderStudentDashboard, renderApply } from './student.js';
import { renderAdminDashboard, renderAdminStudents, renderAdminCourses, renderAdminEnrollments, adminOpenStudentModal } from './admin.js';
import { renderFacultyDashboard, renderFacultyProgress, renderFacultyPresets, facultyEditPresetModal } from './faculty.js';

loadSession();

export async function renderAll() {
  const authPage = $('#authPage');
  const pageWrap = $('#pageWrap');
  const navbar = $('#navbar');

  if (!session) {
    authPage.classList.remove('hidden');
    pageWrap.classList.add('hidden');
    navbar.classList.add('hidden');
    renderAuthPage();
    return;
  }

  authPage.classList.add('hidden');
  pageWrap.classList.remove('hidden');
  navbar.classList.remove('hidden');

  if (session.role === 'admin') { renderAdminLayout(); return; }
  if (session.role === 'faculty') { renderFacultyLayout(); return; }

  // STUDENT NAVBAR
  navbar.innerHTML = `
    <div class="nav-brand">
      <div class="nav-brand-text"><span class="b1">UNIDA</span><span class="b2">CHRISTIAN COLLEGES</span></div>
    </div>
    <div class="nav-links">
      <button class="nav-link" data-nav="dashboard">Dashboard</button>
      <button class="nav-link" data-nav="apply">Application</button>
    </div>
    <div style="display:flex; align-items:center; gap:16px;">
      <span style="font-size:14px; font-weight:600; color:#fff;">${esc(session.name)}</span>
      <button class="btn btn-outline btn-sm" onclick="window.logout()" style="color:#fff; border-color:rgba(255,255,255,0.4)">Logout</button>
    </div>
  `;

  pageWrap.innerHTML = '<div class="progress-card">Loading...</div>';
  const currentView = window.currentView || 'dashboard';

  if (currentView === 'dashboard') pageWrap.innerHTML = await renderStudentDashboard();
  else if (currentView === 'apply') pageWrap.innerHTML = await renderApply();
}

function renderAuthPage() {
  $('#authPage').innerHTML = `
    <div class="auth-card">
      <div class="auth-brand"><h1>Unida Christian Colleges</h1><p>Enrollment Portal</p></div>
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

async function renderAdminLayout() {
  const pageWrap = $('#pageWrap');
  $('#navbar').classList.add('hidden');
  
  pageWrap.innerHTML = `
    <div class="role-shell" style="min-height: 100vh;">
      <aside class="role-sidebar">
        <div class="role-side-brand"><strong>Admin Portal</strong><span>Registrar</span></div>
        <nav class="role-nav">
          <button class="role-nav-item ${window.currentView === 'dashboard' ? 'active' : ''}" onclick="window.setAdminView('dashboard')"><span class="rni">🏠</span> Dashboard</button>
          <button class="role-nav-item ${window.currentView === 'students' ? 'active' : ''}" onclick="window.setAdminView('students')"><span class="rni">👥</span> Students</button>
          <button class="role-nav-item ${window.currentView === 'courses' ? 'active' : ''}" onclick="window.setAdminView('courses')"><span class="rni">📚</span> Courses</button>
          <button class="role-nav-item ${window.currentView === 'enrollments' ? 'active' : ''}" onclick="window.setAdminView('enrollments')"><span class="rni">📝</span> Final Approvals</button>
        </nav>
        <div class="role-side-foot"><button onclick="window.logout()">Sign out</button></div>
      </aside>
      <div class="role-main">
        <header class="role-topbar">
          <div><h1>${window.currentView ? window.currentView.toUpperCase() : 'DASHBOARD'}</h1><div class="rt-sub">Manage system data</div></div>
          <div class="rt-user"><div class="rt-who"><strong>${esc(session.name)}</strong><span>Admin</span></div><div class="rt-avatar">${initials(session.name)}</div></div>
        </header>
        <div class="role-content" id="adminContent"><div class="rp-empty">Loading...</div></div>
      </div>
    </div>
  `;

  const content = $('#adminContent');
  const view = window.currentView || 'dashboard';

  if (view === 'dashboard') content.innerHTML = await renderAdminDashboard();
  else if (view === 'students') content.innerHTML = await renderAdminStudents();
  else if (view === 'courses') content.innerHTML = await renderAdminCourses();
  else if (view === 'enrollments') content.innerHTML = await renderAdminEnrollments();
}

window.setAdminView = (view) => { window.currentView = view; renderAll(); };

async function renderFacultyLayout() {
  const pageWrap = $('#pageWrap');
  $('#navbar').classList.add('hidden');
  
  pageWrap.innerHTML = `
    <div class="role-shell" style="min-height: 100vh;">
      <aside class="role-sidebar">
        <div class="role-side-brand"><strong>Faculty Portal</strong><span>College Department</span></div>
        <nav class="role-nav">
          <button class="role-nav-item ${window.currentView === 'dashboard' ? 'active' : ''}" onclick="window.setFacultyView('dashboard')"><span class="rni">🏠</span> Dashboard</button>
          <button class="role-nav-item ${window.currentView === 'progress' ? 'active' : ''}" onclick="window.setFacultyView('progress')"><span class="rni">🔍</span> Check Students</button>
          <button class="role-nav-item ${window.currentView === 'presets' ? 'active' : ''}" onclick="window.setFacultyView('presets')"><span class="rni">🧩</span> Preset Subjects</button>
          <button class="role-nav-item ${window.currentView === 'courses' ? 'active' : ''}" onclick="window.setFacultyView('courses')"><span class="rni">📚</span> Manage Subjects</button>
        </nav>
        <div class="role-side-foot"><button onclick="window.logout()">Sign out</button></div>
      </aside>
      <div class="role-main">
        <header class="role-topbar">
          <div><h1>${window.currentView ? window.currentView.toUpperCase() : 'DASHBOARD'}</h1><div class="rt-sub">Student Evaluation</div></div>
          <div class="rt-user"><div class="rt-who"><strong>${esc(session.name)}</strong><span>Faculty</span></div><div class="rt-avatar">${initials(session.name)}</div></div>
        </header>
        <div class="role-content" id="facultyContent"><div class="rp-empty">Loading...</div></div>
      </div>
    </div>
  `;

  const content = $('#facultyContent');
  const view = window.currentView || 'dashboard';

  if (view === 'dashboard') content.innerHTML = await renderFacultyDashboard();
  else if (view === 'progress') content.innerHTML = await renderFacultyProgress();
  else if (view === 'presets') content.innerHTML = await renderFacultyPresets();
  else if (view === 'courses') content.innerHTML = await renderFacultyCourses(); // Note: You may need to add renderFacultyCourses back if I removed it in the prompt, but I kept it in the file above.
}

window.setFacultyView = (view) => { 
  window.currentView = view; 
  window.facultySelectedStudent = null; 
  renderAll(); 
};

window.closeFacultyStudent = () => {
  window.facultySelectedStudent = null;
  renderAll();
};

// --- TEMP STATE FOR SUBJECT ADDITION ---
window.tempStudentSubjects = [];
window.tempPresetSubjects = [];
window.tempDeletedPSIds = [];

window.tempAddSubject = (studentId) => {
  const sel = document.querySelector('#facultyAddSubjectForm select[name="course_id"]');
  if (!sel.value) return toast('Select a subject first', 'error');
  const courseId = Number(sel.value);
  
  // Find the course details from the global cache (we'll just inject it directly via DOM for UI)
  const opt = sel.options[sel.selectedIndex];
  const text = opt.text;
  const code = text.split('—')[0].trim();
  const title = text.split('—')[1].split('(')[0].trim();
  const units = text.match(/\((\d+)\s*units\)/)[1];

  window.tempStudentSubjects.push({ courseId, code, title, units });
  
  // Re-render temp list
  const listDiv = document.getElementById('tempSubjectList');
  if (listDiv) {
    listDiv.innerHTML = window.tempStudentSubjects.map((s, idx) => `
      <div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid #eee;">
        <div>
          <div style="font-size:13px; font-weight:600;">
