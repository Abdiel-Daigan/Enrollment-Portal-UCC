/* =========================================================================
   MAIN.JS — App Engine, Routing, and Event Listeners
   ========================================================================= */

import { $, esc, toast, initials } from './utils.js';
import { supa } from './api.js';
import { session, loadSession, doLogin, doRegister, doLogout } from './auth.js';
import { renderStudentDashboard, renderApply, renderBrowseCourses, renderSchedule } from './student.js';
import { renderAdminDashboard, renderAdminStudents, renderAdminCourses, renderAdminEnrollments } from './admin.js';
import { renderFacultyDashboard, renderFacultyProgress } from './faculty.js';

// 1. Initialize Session
loadSession();

// 2. Main Render Function (Routes based on Role)
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

  // --- ROLE BASED ROUTING ---
  if (session.role === 'admin') {
    renderAdminLayout();
    return;
  }
  
  if (session.role === 'faculty') {
    renderFacultyLayout();
    return;
  }

  // --- STUDENT ROUTING (Default) ---
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

  pageWrap.innerHTML = '<div class="progress-card">Loading...</div>';
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

// 4. Admin Layout Wrapper
async function renderAdminLayout() {
  const pageWrap = $('#pageWrap');
  const navbar = $('#navbar');
  
  navbar.classList.add('hidden');
  
  pageWrap.innerHTML = `
    <div class="role-shell" style="min-height: 100vh;">
      <aside class="role-sidebar">
        <div class="role-side-brand">
          <strong>Admin Portal</strong>
          <span>Registrar</span>
        </div>
        <nav class="role-nav">
          <button class="role-nav-item ${window.currentView === 'dashboard' ? 'active' : ''}" onclick="window.setAdminView('dashboard')"><span class="rni">🏠</span> Dashboard</button>
          <button class="role-nav-item ${window.currentView === 'students' ? 'active' : ''}" onclick="window.setAdminView('students')"><span class="rni">👥</span> Students</button>
          <button class="role-nav-item ${window.currentView === 'courses' ? 'active' : ''}" onclick="window.setAdminView('courses')"><span class="rni">📚</span> Courses</button>
          <button class="role-nav-item ${window.currentView === 'enrollments' ? 'active' : ''}" onclick="window.setAdminView('enrollments')"><span class="rni">📝</span> Enrollments</button>
        </nav>
        <div class="role-side-foot">
          <button onclick="window.logout()">Sign out</button>
        </div>
      </aside>
      <div class="role-main">
        <header class="role-topbar">
          <div>
            <h1>${window.currentView ? window.currentView.toUpperCase() : 'DASHBOARD'}</h1>
            <div class="rt-sub">Manage system data</div>
          </div>
          <div class="rt-user">
            <div class="rt-who">
              <strong>${esc(session.name)}</strong>
              <span>Admin</span>
            </div>
            <div class="rt-avatar">${initials(session.name)}</div>
          </div>
        </header>
        <div class="role-content" id="adminContent">
          <div class="rp-empty">Loading...</div>
        </div>
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

window.setAdminView = (view) => {
  window.currentView = view;
  renderAll();
};

// 5. Faculty Layout Wrapper
async function renderFacultyLayout() {
  const pageWrap = $('#pageWrap');
  const navbar = $('#navbar');
  
  navbar.classList.add('hidden');
  
  pageWrap.innerHTML = `
    <div class="role-shell" style="min-height: 100vh;">
      <aside class="role-sidebar">
        <div class="role-side-brand">
          <strong>Faculty Portal</strong>
          <span>College Department</span>
        </div>
        <nav class="role-nav">
          <button class="role-nav-item ${window.currentView === 'dashboard' ? 'active' : ''}" onclick="window.setFacultyView('dashboard')"><span class="rni">🏠</span> Dashboard</button>
          <button class="role-nav-item ${window.currentView === 'progress' ? 'active' : ''}" onclick="window.setFacultyView('progress')"><span class="rni">🔍</span> Check Students</button>
        </nav>
        <div class="role-side-foot">
          <button onclick="window.logout()">Sign out</button>
        </div>
      </aside>
      <div class="role-main">
        <header class="role-topbar">
          <div>
            <h1>${window.currentView ? window.currentView.toUpperCase() : 'DASHBOARD'}</h1>
            <div class="rt-sub">Student Evaluation</div>
          </div>
          <div class="rt-user">
            <div class="rt-who">
              <strong>${esc(session.name)}</strong>
              <span>Faculty</span>
            </div>
            <div class="rt-avatar">${initials(session.name)}</div>
          </div>
        </header>
        <div class="role-content" id="facultyContent">
          <div class="rp-empty">Loading...</div>
        </div>
      </div>
    </div>
  `;

  const content = $('#facultyContent');
  const view = window.currentView || 'dashboard';

  if (view === 'dashboard') content.innerHTML = await renderFacultyDashboard();
  else if (view === 'progress') content.innerHTML = await renderFacultyProgress();
}

window.setFacultyView = (view) => {
  window.currentView = view;
  renderAll();
};

// 6. Global Click Listeners (Routing, Wizard, Mobile Checkbox)
document.addEventListener('click', async (e) => {
  const navBtn = e.target.closest('[data-nav]');
  if (navBtn) {
    window.currentView = navBtn.dataset.nav;
    window.currentStep = 1; 
    renderAll();
    return;
  }

  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;

  // Auth Tabs
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
    return;
  }

  // Custom Checkbox
  if (action === 'toggleCertify') {
    const box = $('#certifyBox');
    const chk = $('#certifyCheck');
    if (chk.checked) {
      chk.checked = false;
      box.classList.remove('checked');
      box.querySelector('.check-box').textContent = '';
    } else {
      chk.checked = true;
      box.classList.add('checked');
      box.querySelector('.check-box').textContent = '✓';
    }
    return;
  }

  // Wizard Back
  if (action === 'prevStep') {
    window.currentStep = Number(btn.dataset.step) - 1;
    renderAll();
    return;
  }

  if (action === 'gotoStep') {
    window.currentStep = Number(btn.dataset.step);
    renderAll();
    return;
  }

  if (action === 'continueApp') {
    window.currentStep = 1;
    window.currentView = 'apply';
    renderAll();
    return;
  }

  // Wizard Documents
  if (action === 'chooseDocType') {
    const type = btn.dataset.type;
    const user = session;
    const existing = await supa('applications', { match: { user_id: user.userId } });
    const app = existing[0] || {};
    
    await supa('applications', {
      method: existing.length ? 'PATCH' : 'POST',
      match: existing.length ? { user_id: user.userId } : undefined,
      body: { 
        user_id: user.userId, doc_type: type,
        personal: app.personal || {}, education: app.education || {},
        program: app.program || {}, documents: app.documents || {}, submitted: false
      }
    });
    window.currentStep = 4;
    renderAll();
    return;
  }

  if (action === 'changeDocType') {
    const user = session;
    await supa('applications', {
      method: 'PATCH',
      match: { user_id: user.userId },
      body: { doc_type: null, documents: {} }
    });
    window.currentStep = 4;
    renderAll();
    return;
  }

  // Submit Application
  if (action === 'submitApplication') {
    const chk = $('#certifyCheck');
    if (!chk || !chk.checked) return toast('Please certify that your information is correct.', 'error');
    
    const user = session;
    await supa('applications', {
      method: 'PATCH',
      match: { user_id: user.userId },
      body: { 
        submitted: true, 
        reference: 'UCC-' + Date.now().toString().slice(-8),
        status: 'Pending Review'
      }
    });
    toast('Application submitted successfully!');
    window.currentView = 'dashboard';
    renderAll();
    return;
  }

  // Enroll in Section
  const enrollBtn = e.target.closest('[data-enroll-section]');
  if (enrollBtn) {
    const sectionId = Number(enrollBtn.dataset.enrollSection);
    try {
      await supa('enrollments', { method: 'POST', body: { user_id: session.userId, section_id: sectionId, status: 'Enrolled' } });
      toast('Enrolled successfully!');
      renderAll();
    } catch (err) {
      toast('Failed to enroll.', 'error');
    }
    return;
  }

  // Admin Approve Enrollment
  if (action === 'adminApproveEnrollment') {
    const userId = Number(btn.dataset.id);
    try {
      await supa('applications', {
        method: 'PATCH',
        match: { user_id: userId },
        body: { status: 'Enrolled' }
      });
      toast('Student officially enrolled!');
      renderAll();
    } catch (err) {
      toast('Failed to approve.', 'error');
    }
    return;
  }
});

// 7. Form Submit (Login/Register AND Wizard Next Steps)
document.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  if (e.target.id === 'loginForm') {
    await doLogin(e.target, () => { window.currentView = 'dashboard'; renderAll(); });
    return;
  }
  if (e.target.id === 'registerForm') {
    await doRegister(e.target, () => { window.currentView = 'dashboard'; renderAll(); });
    return;
  }

  // Wizard Next Step (Works on PC and Mobile)
  if (e.target.id === 'stepForm') {
    const step = Number(e.target.dataset.step);
    const user = session;
    
    const existing = await supa('applications', { match: { user_id: user.userId } });
    let app = existing[0] || { personal: {}, education: {}, program: {}, documents: {}, doc_type: null, submitted: false };
    
    const fd = new FormData(e.target);

    if (step === 1) {
      app.personal = {
        first_name: fd.get('first_name'), middle_name: fd.get('middle_name'), last_name: fd.get('last_name'),
        email: fd.get('email'), phone: fd.get('phone'), address: fd.get('address')
      };
    } else if (step === 2) {
      app.education = {
        elem: { school: fd.get('elem_school'), year: fd.get('elem_year') },
        jhs: { school: fd.get('jhs_school'), year: fd.get('jhs_year') },
        shs: { school: fd.get('shs_school'), year: fd.get('shs_year') }
      };
    } else if (step === 3) {
      app.program = { preferred: fd.get('preferred') };
    }

    await supa('applications', {
      method: existing.length ? 'PATCH' : 'POST',
      match: existing.length ? { user_id: user.userId } : undefined,
      body: {
        user_id: user.userId,
        personal: app.personal, education: app.education, program: app.program,
        documents: app.documents || {}, doc_type: app.doc_type || null, submitted: false
      }
    });

    window.currentStep = step + 1;
    renderAll();
  }
});

// Global logout helper
window.logout = () => {
  doLogout(() => renderAll());
};

// Initial Boot
window.currentView = 'dashboard';
window.currentStep = 1;
renderAll();
