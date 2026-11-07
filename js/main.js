import { $, esc, toast, initials } from './utils.js';
import { supa } from './api.js';
import { session, loadSession, doLogin, doRegister, doLogout } from './auth.js';
import { renderStudentDashboard, renderApply, renderBrowseCourses, renderSchedule } from './student.js';

// 1. Initialize Session
loadSession();

// 2. Main Render Function
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

/* ============================ EVENT LISTENERS ============================ */

// 1. Handle all clicks (Navigation, Tabs, Checkboxes, etc.)
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

  if (action === 'submitApplication') {
    const chk = $('#certifyCheck');
    if (!chk || !chk.checked) return toast('Please certify that your information is correct.', 'error');
    
    const user = session;
    const existing = await supa('applications', { match: { user_id: user.userId } });
    
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

  const enrollBtn = e.target.closest('[data-enroll-section]');
  if (enrollBtn) {
    const sectionId = Number(enrollBtn.dataset.enrollSection);
    const user = session;
    try {
      await supa('enrollments', { method: 'POST', body: { user_id: user.userId, section_id: sectionId, status: 'Enrolled' } });
      toast('Enrolled successfully!');
      renderAll();
    } catch (err) {
      toast('Failed to enroll.', 'error');
    }
    return;
  }
});

// 2. Handle Form Submits (Login/Register AND Wizard Next Steps)
document.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  // Auth Forms
  if (e.target.id === 'loginForm') {
    await doLogin(e.target, () => { window.currentView = 'dashboard'; renderAll(); });
    return;
  }
  if (e.target.id === 'registerForm') {
    await doRegister(e.target, () => { window.currentView = 'dashboard'; renderAll(); });
    return;
  }

  // Wizard Forms
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
