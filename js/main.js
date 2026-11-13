import { $, esc, toast, initials } from './utils.js';
import { supa } from './api.js';
import { session, loadSession, doLogin, doRegister, doLogout } from './auth.js';
import { renderStudentDashboard, renderApply } from './student.js';
import { renderAdminDashboard, renderAdminStudents, renderAdminCourses, renderAdminEnrollments, adminOpenStudentModal } from './admin.js';
import { renderFacultyDashboard, renderFacultyProgress, renderFacultyCourses } from './faculty.js';

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

  if (session.role === 'admin') {
    renderAdminLayout();
    return;
  }
  
  if (session.role === 'faculty') {
    renderFacultyLayout();
    return;
  }

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
  else if (view === 'courses') content.innerHTML = await renderFacultyCourses();
}

window.setFacultyView = (view) => { window.currentView = view; renderAll(); };

// GLOBAL CLICKS
document.addEventListener('click', async (e) => {
  const navBtn = e.target.closest('[data-nav]');
  if (navBtn) { window.currentView = navBtn.dataset.nav; window.currentStep = 1; renderAll(); return; }

  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;

  if (action === 'authTab') {
    $('.auth-tab.active').classList.remove('active');
    btn.classList.add('active');
    if (btn.dataset.tab === 'login') {
      $('#loginForm').classList.remove('hidden'); $('#registerForm').classList.add('hidden');
    } else {
      $('#loginForm').classList.add('hidden'); $('#registerForm').classList.remove('hidden');
    }
    return;
  }

  if (action === 'toggleCertify') {
    const box = $('#certifyBox'); const chk = $('#certifyCheck');
    if (chk.checked) { chk.checked = false; box.classList.remove('checked'); box.querySelector('.check-box').textContent = ''; }
    else { chk.checked = true; box.classList.add('checked'); box.querySelector('.check-box').textContent = '✓'; }
    return;
  }

  if (action === 'prevStep') { window.currentStep = Number(btn.dataset.step) - 1; renderAll(); return; }
  if (action === 'gotoStep') { window.currentStep = Number(btn.dataset.step); renderAll(); return; }
  if (action === 'continueApp') { window.currentStep = 1; window.currentView = 'apply'; renderAll(); return; }

  if (action === 'chooseDocType') {
    const type = btn.dataset.type;
    const user = session;
    const existing = await supa('applications', { match: { user_id: user.userId } });
    const app = existing[0] || {};
    await supa('applications', {
      method: existing.length ? 'PATCH' : 'POST',
      match: existing.length ? { user_id: user.userId } : undefined,
      body: { user_id: user.userId, doc_type: type, personal: app.personal || {}, education: app.education || {}, program: app.program || {}, documents: app.documents || {}, submitted: false }
    });
    window.currentStep = 4; renderAll(); return;
  }

  if (action === 'changeDocType') {
    await supa('applications', { method: 'PATCH', match: { user_id: session.userId }, body: { doc_type: null, documents: {} } });
    window.currentStep = 4; renderAll(); return;
  }

  if (action === 'submitApplication') {
    const chk = $('#certifyCheck');
    if (!chk || !chk.checked) return toast('Please certify your information.', 'error');
    await supa('applications', { method: 'PATCH', match: { user_id: session.userId }, body: { submitted: true, reference: 'UCC-' + Date.now().toString().slice(-8), status: 'Pending Review' } });
    toast('Application submitted successfully!');
    window.currentView = 'dashboard'; renderAll(); return;
  }

  // FACULTY ACTIONS
  if (action === 'facultyApproveSubject') {
    const subjectId = Number(btn.dataset.id);
    const studentId = Number(btn.dataset.student);
    try {
      await supa('student_subjects', { method: 'PATCH', match: { id: subjectId }, body: { status: 'Taken' } });
      toast('Payment approved. Subject marked as Taken.');
      window.facultyStudent = studentId; renderAll();
    } catch (err) { toast('Failed to approve.', 'error'); }
    return;
  }

  if (action === 'facultyRemoveSubject') {
    const subjectId = Number(btn.dataset.id);
    const studentId = Number(btn.dataset.student);
    try {
      await supa('student_subjects', { method: 'DELETE', match: { id: subjectId } });
      toast('Subject removed.');
      window.facultyStudent = studentId; renderAll();
    } catch (err) { toast('Failed to remove.', 'error'); }
    return;
  }

  if (action === 'facultyDeleteCourse') {
    const courseId = Number(btn.dataset.id);
    if (!confirm('Are you sure you want to delete this subject from the curriculum?')) return;
    try {
      await supa('courses', { method: 'DELETE', match: { id: courseId } });
      toast('Subject deleted.');
      renderAll();
    } catch (err) {
      toast('Cannot delete subject. It might be tied to student records.', 'error');
    }
    return;
  }

  // ADMIN ACTIONS
  if (action === 'adminOpenStudent') {
    await adminOpenStudentModal(Number(btn.dataset.id)); return;
  }

  if (action === 'adminRemoveSubject') {
    const subjectId = Number(btn.dataset.id);
    const userId = Number(btn.dataset.user);
    try {
      await supa('student_subjects', { method: 'DELETE', match: { id: subjectId } });
      toast('Subject record removed.');
      await adminOpenStudentModal(userId); 
    } catch (err) { toast('Failed to delete subject.', 'error'); }
    return;
  }

  if (action === 'adminApproveEnrollment') {
    const userId = Number(btn.dataset.id);
    try {
      await supa('applications', { method: 'PATCH', match: { user_id: userId }, body: { status: 'Approved' } });
      toast('Student officially enrolled!');
      renderAll();
    } catch (err) { toast('Failed to approve.', 'error'); }
    return;
  }
});

// GLOBAL CHANGE LISTENERS (Filters, Dropdowns, Search)
document.addEventListener('change', (e) => {
  const key = e.target.dataset.change;
  if (!key) return;

  if (key === 'facultyStudent') {
    window.facultyStudent = e.target.value;
    renderAll();
  } else if (key === 'facultyFilterYear') {
    window.facultyFilterYear = e.target.value;
    renderAll();
  } else if (key === 'facultyFilterProg') {
    window.facultyFilterProg = e.target.value;
    renderAll();
  }
});

// GLOBAL INPUT LISTENER (Live Search)
document.addEventListener('input', (e) => {
  if (e.target.dataset.change === 'facultySearch') {
    window.facultySearch = e.target.value;
    clearTimeout(window.searchTimer);
    window.searchTimer = setTimeout(() => {
      const pos = e.target.selectionStart;
      renderAll();
      const nextInput = document.querySelector('[data-change="facultySearch"]');
      if (nextInput) {
        nextInput.focus();
        nextInput.setSelectionRange(pos, pos);
      }
    }, 300);
  }
});

// GLOBAL FORMS
document.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  if (e.target.id === 'loginForm') { await doLogin(e.target, () => { window.currentView = 'dashboard'; renderAll(); }); return; }
  if (e.target.id === 'registerForm') { await doRegister(e.target, () => { window.currentView = 'dashboard'; renderAll(); }); return; }

  if (e.target.id === 'stepForm') {
    const step = Number(e.target.dataset.step);
    const user = session;
    const existing = await supa('applications', { match: { user_id: user.userId } });
    let app = existing[0] || { personal: {}, education: {}, program: {}, documents: {}, doc_type: null, submitted: false };
    const fd = new FormData(e.target);

    if (step === 1) app.personal = { first_name: fd.get('first_name'), middle_name: fd.get('middle_name'), last_name: fd.get('last_name'), email: fd.get('email'), phone: fd.get('phone'), address: fd.get('address') };
    else if (step === 2) app.education = { elem: { school: fd.get('elem_school'), year: fd.get('elem_year') }, jhs: { school: fd.get('jhs_school'), year: fd.get('jhs_year') }, shs: { school: fd.get('shs_school'), year: fd.get('shs_year') } };
    else if (step === 3) app.program = { preferred: fd.get('preferred'), year_level: fd.get('year_level') };

    await supa('applications', {
      method: existing.length ? 'PATCH' : 'POST',
      match: existing.length ? { user_id: user.userId } : undefined,
      body: { user_id: user.userId, personal: app.personal, education: app.education, program: app.program, documents: app.documents || {}, doc_type: app.doc_type || null, submitted: false }
    });

    window.currentStep = step + 1;
    renderAll();
    return;
  }

  // Faculty Add Subject to Student
  if (e.target.id === 'facultyAddSubjectForm') {
    const fd = new FormData(e.target);
    const studentId = Number(fd.get('student_id'));
    const courseId = Number(fd.get('course_id'));
    const status = String(fd.get('status'));

    try {
      await supa('student_subjects', { method: 'POST', body: { user_id: studentId, course_id: courseId, status } });
      toast('Subject added.');
      window.facultyStudent = studentId; renderAll();
    } catch (err) { toast('Failed to add subject.', 'error'); }
    return;
  }

  // Faculty Create Subject (Course)
  if (e.target.id === 'facultyCreateCourseForm') {
    const fd = new FormData(e.target);
    const payload = {
      code: fd.get('code'),
      title: fd.get('title'),
      units: Number(fd.get('units')),
      schedule: fd.get('schedule'),
      program_id: Number(fd.get('program_id'))
    };

    try {
      await supa('courses', { method: 'POST', body: payload });
      toast('Subject created successfully.');
      e.target.reset();
      renderAll();
    } catch (err) {
      toast('Failed to create subject. Check if code already exists.', 'error');
    }
    return;
  }

  // Admin Edit Student
  if (e.target.id === 'adminEditStudentForm') {
    const fd = new FormData(e.target);
    const userId = Number(fd.get('user_id'));
    
    try {
      await supa('users', { method: 'PATCH', match: { id: userId }, body: { name: fd.get('name'), email: fd.get('email'), role: fd.get('role') } });
      
      const existing = await supa('applications', { match: { user_id: userId } });
      if (existing.length) {
        let app = existing[0];
        let pr = app.program || {};
        if (typeof pr === 'string') { try { pr = JSON.parse(pr); } catch(e){} }
        pr.preferred = fd.get('program_id');
        await supa('applications', { method: 'PATCH', match: { user_id: userId }, body: { program: pr } });
      }
      
      toast('Student data updated.');
      await adminOpenStudentModal(userId);
    } catch (err) { toast('Failed to update student.', 'error'); }
    return;
  }

  // Admin Add Subject
  if (e.target.id === 'adminSubjectForm') {
    const fd = new FormData(e.target);
    const userId = Number(fd.get('user_id'));
    const courseId = Number(fd.get('course_id'));
    const status = String(fd.get('status'));

    try {
      const existing = await supa('student_subjects', { match: { user_id: userId, course_id: courseId } });
      if (existing && existing.length) return toast('This subject is already on the record.', 'error');

      await supa('student_subjects', { method: 'POST', body: { user_id: userId, course_id: courseId, status } });
      toast('Subject added.');
      await adminOpenStudentModal(userId);
    } catch (err) { toast('Failed to add subject.', 'error'); }
    return;
  }
});

window.logout = () => { doLogout(() => renderAll()); };

window.deleteStudent = async (userId) => {
  if (!confirm('Are you absolutely sure? This will delete the student and all their records.')) return;
  try {
    await supa('users', { method: 'DELETE', match: { id: userId } });
    toast('Student deleted.');
    document.getElementById('adminModalBackdrop')?.remove();
    renderAll();
  } catch (err) {
    toast('Failed to delete student.', 'error');
  }
};

window.currentView = 'dashboard';
window.currentStep = 1;
window.facultySearch = '';
window.facultyFilterYear = '';
window.facultyFilterProg = '';
renderAll();
