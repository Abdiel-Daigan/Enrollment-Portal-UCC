import { $, esc, toast, initials } from './utils.js';
import { supa } from './api.js';
import { session, loadSession, doLogin, doRegister, doLogout } from './auth.js';
import { renderStudentDashboard, renderApply, renderPaymentTab, renderScheduleTab, renderRegistrationTab } from './student.js';
import { renderAdminDashboard, renderAdminStudents, renderAdminCourses, renderAdminEnrollments, adminOpenStudentModal } from './admin.js';
import { renderFacultyDashboard, renderFacultyProgress, facultyEditPresetModal, facultyEditCourseModal } from './faculty.js'; // Removed Preset/Course renders
import { renderAccountingDashboard, renderAccountingLogs, renderAccountingSettings, renderAccountingStudents, accountingManageStudentModal } from './accounting.js';
import { renderRegistrarDashboard, renderRegistrarPresets, renderRegistrarCourses, regEditPresetModal, regEditCourseModal } from './registrar.js'; // New Registrar imports

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
  if (session.role === 'accounting') { renderAccountingLayout(); return; }
  if (session.role === 'registrar') { renderRegistrarLayout(); return; } // New Role Router

  // --- STUDENT ROUTING & DYNAMIC NAVBAR ---
  const apps = await supa('applications', { match: { user_id: session.userId } }).catch(() => []);
  const app = apps[0] || {};
  const subjects = await supa('student_subjects', { match: { user_id: session.userId } }).catch(() => []);
  const courses = await supa('courses').catch(() => []);
  const settingsRes = await supa('system_settings', { match: { id: 1 } }).catch(() => []);
  const settings = settingsRes[0] || { tuition_per_unit: 444, misc_fee: 5452, reg_fee: 1000 };

  const hasSubjects = subjects.length > 0;
  const hasPaid = Number(app.amount_paid || 0) > 0;

  let navItems = [];
  if (!hasSubjects) {
    navItems = [
      { id: 'dashboard', label: 'Dashboard' },
      { id: 'apply', label: 'Application' }
    ];
  } else {
    if (hasPaid) {
      navItems = [
        { id: 'schedule', label: 'Schedule' },
        { id: 'payment', label: 'Payment' },
        { id: 'registration', label: 'Registration Form' }
      ];
    } else {
      navItems = [{ id: 'payment', label: 'Payment' }];
    }
  }

  let currentView = window.currentView || 'dashboard';
  if (!navItems.find(n => n.id === currentView)) {
    currentView = navItems[0].id; 
    window.currentView = currentView;
  }

  navbar.innerHTML = `
    <div class="nav-brand">
      <div class="nav-brand-text"><span class="b1">UNIDA</span><span class="b2">CHRISTIAN COLLEGES</span></div>
    </div>
    <div class="nav-links">
      ${navItems.map(item => `
        <button class="nav-link ${currentView === item.id ? 'active' : ''}" data-nav="${item.id}">${item.label}</button>
      `).join('')}
    </div>
    <div style="display:flex; align-items:center; gap:16px;">
      <span style="font-size:14px; font-weight:600; color:#fff;">${esc(session.name)}</span>
      <button class="btn btn-outline btn-sm" onclick="window.logout()" style="color:#fff; border-color:rgba(255,255,255,0.4)">Logout</button>
    </div>
  `;

  pageWrap.innerHTML = '<div class="progress-card">Loading...</div>';

  if (currentView === 'dashboard') pageWrap.innerHTML = await renderStudentDashboard();
  else if (currentView === 'apply') pageWrap.innerHTML = await renderApply();
  else if (currentView === 'payment') pageWrap.innerHTML = await renderPaymentTab(app, subjects, courses, settings);
  else if (currentView === 'schedule') pageWrap.innerHTML = await renderScheduleTab(app, subjects, courses);
  else if (currentView === 'registration') pageWrap.innerHTML = await renderRegistrationTab(app, subjects, courses, settings);
}

// ... (Keep window.payTuition and renderAuthPage exactly as they are) ...

// --- NEW: REGISTRAR LAYOUT ---
async function renderRegistrarLayout() {
  const pageWrap = $('#pageWrap');
  $('#navbar').classList.add('hidden');
  
  pageWrap.innerHTML = `
    <div class="role-shell" style="min-height: 100vh;">
      <aside class="role-sidebar">
        <div class="role-side-brand"><strong>Registrar Portal</strong><span>Records & Curriculum</span></div>
        <nav class="role-nav">
          <button class="role-nav-item ${window.currentView === 'dashboard' ? 'active' : ''}" onclick="window.setRegistrarView('dashboard')"><span class="rni">🏠</span> Dashboard</button>
          <button class="role-nav-item ${window.currentView === 'presets' ? 'active' : ''}" onclick="window.setRegistrarView('presets')"><span class="rni">🧩</span> Preset Subjects</button>
          <button class="role-nav-item ${window.currentView === 'courses' ? 'active' : ''}" onclick="window.setRegistrarView('courses')"><span class="rni">📚</span> Manage Subjects</button>
        </nav>
        <div class="role-side-foot"><button onclick="window.logout()">Sign out</button></div>
      </aside>
      <div class="role-main">
        <header class="role-topbar">
          <div><h1>${window.currentView ? window.currentView.toUpperCase() : 'DASHBOARD'}</h1><div class="rt-sub">Manage academic records</div></div>
          <div class="rt-user"><div class="rt-who"><strong>${esc(session.name)}</strong><span>Registrar</span></div><div class="rt-avatar">${initials(session.name)}</div></div>
        </header>
        <div class="role-content" id="regContent"><div class="rp-empty">Loading...</div></div>
      </div>
    </div>
  `;

  const content = $('#regContent');
  const view = window.currentView || 'dashboard';

  if (view === 'dashboard') content.innerHTML = await renderRegistrarDashboard();
  else if (view === 'presets') content.innerHTML = await renderRegistrarPresets();
  else if (view === 'courses') content.innerHTML = await renderRegistrarCourses();
}

window.setRegistrarView = (view) => { window.currentView = view; renderAll(); };

// ... (Keep renderAdminLayout and renderFacultyLayout exactly as they are, but remove presets/courses from faculty nav) ...

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
}

window.setFacultyView = (view) => { 
  window.currentView = view; 
  window.facultySelectedStudent = null; 
  window.tempStudentSubjects = [];
  renderAll(); 
};

// ... (Keep tempStudentSubjects helpers and facultyLoadPresetToTemp exactly as they are) ...

// --- GLOBAL CLICKS ---
document.addEventListener('click', async (e) => {
  const navBtn = e.target.closest('[data-nav]');
  if (navBtn) { window.currentView = navBtn.dataset.nav; window.currentStep = 1; renderAll(); return; }

  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;

  // ... (Keep auth, student wizard, and faculty checks exactly as they are) ...

  // REGISTRAR ACTIONS (Replaced faculty preset/course actions)
  if (action === 'regCreatePreset') {
    await regEditPresetModal(null);
    return;
  }

  if (action === 'regEditPreset') {
    await regEditPresetModal(Number(btn.dataset.id));
    return;
  }

  if (action === 'regEditCourse') {
    await regEditCourseModal(Number(btn.dataset.id));
    return;
  }

  if (action === 'regSavePreset') {
    const id = document.getElementById('reg_preset_edit_id').value;
    const name = document.getElementById('reg_preset_name').value;
    const prog = document.getElementById('reg_preset_prog').value;
    const year = document.getElementById('reg_preset_year').value;
    const sem = document.getElementById('reg_preset_sem').value;

    if (!name) return toast('Preset name is required.', 'error');

    const payload = { name: name, program_id: Number(prog), year_level: Number(year), semester: sem };

    try {
      let presetId = id;
      if (id) {
        await supa('presets', { method: 'PATCH', match: { id: Number(id) }, body: payload });
      } else {
        const res = await supa('presets', { method: 'POST', body: payload });
        presetId = res[0].id;
      }

      for (const delId of window.tempRegDeletedPSIds) {
        await supa('preset_subjects', { method: 'DELETE', match: { id: delId } });
      }
      window.tempRegDeletedPSIds = [];

      const existingSubs = await supa('preset_subjects', { match: { preset_id: presetId } });
      for (const sub of window.tempRegPresetSubjects) {
        if (sub.psId === 'NEW' && !existingSubs.some(es => String(es.course_id) === String(sub.id))) {
          await supa('preset_subjects', { method: 'POST', body: { preset_id: presetId, course_id: sub.id } });
        }
      }

      toast('Preset saved successfully.');
      document.getElementById('regPresetModal')?.remove();
      renderAll();
    } catch (err) {
      console.error(err);
      toast('Failed to save preset.', 'error');
    }
    return;
  }

  if (action === 'regDeletePreset') {
    const id = Number(btn.dataset.id);
    if (!confirm('Delete this preset?')) return;
    try {
      await supa('presets', { method: 'DELETE', match: { id } });
      toast('Preset deleted.');
      renderAll();
    } catch (err) { toast('Failed to delete.', 'error'); }
    return;
  }

  if (action === 'regSaveEditedCourse') {
    const id = Number(document.getElementById('reg_edit_course_id').value);
    const code = document.getElementById('reg_edit_course_code').value;
    const title = document.getElementById('reg_edit_course_title').value;
    const units = Number(document.getElementById('reg_edit_course_units').value);
    const day = document.getElementById('reg_edit_course_day').value;
    const start = document.getElementById('reg_edit_course_start').value;
    const end = document.getElementById('reg_edit_course_end').value;
    const prog = Number(document.getElementById('reg_edit_course_prog').value);

    if (!code || !title || !units || !day || !start || !end) {
      return toast('Please fill out all fields.', 'error');
    }

    const payload = {
      code: code,
      title: title,
      units: units,
      schedule_day: day,
      schedule_time: `${start} - ${end}`,
      program_id: prog
    };

    try {
      await supa('courses', { method: 'PATCH', match: { id: id }, body: payload });
      toast('Subject updated successfully.');
      document.getElementById('regEditCourseModal')?.remove();
      renderAll();
    } catch (err) {
      console.error(err);
      toast('Failed to update subject.', 'error');
    }
    return;
  }

  if (action === 'regDeleteCourse') {
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
  
  // ... (Keep admin and accounting actions exactly as they are) ...
});

// --- GLOBAL CHANGE LISTENERS ---
document.addEventListener('change', async (e) => {
  const key = e.target.dataset.change;
  if (!key) return;

  if (key === 'facultyFilterYear') { window.facultyFilterYear = e.target.value; renderAll(); }
  else if (key === 'facultyFilterProg') { window.facultyFilterProg = e.target.value; renderAll(); }
  else if (key === 'facultyRegularity') {
    const studentId = Number(e.target.dataset.student);
    const isRegular = e.target.value === 'true';
    try {
      await supa('applications', { method: 'PATCH', match: { user_id: studentId }, body: { is_regular: isRegular } });
      toast('Student status updated.');
    } catch (err) { toast('Failed to update status', 'error'); }
  }
  else if (key === 'regPresetFilterProg') { window.regPresetFilterProg = e.target.value; renderAll(); }
  else if (key === 'regPresetFilterYear') { window.regPresetFilterYear = e.target.value; renderAll(); }
  else if (key === 'regCourseFilterProg') { window.regCourseFilterProg = e.target.value; renderAll(); }
});

// --- GLOBAL FORMS ---
document.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  // ... (Keep auth, student wizard, faculty, and accounting forms exactly as they are) ...

  // REGISTRAR FORMS
  if (e.target.id === 'regCreateCourseForm') {
    const fd = new FormData(e.target);
    const start = fd.get('schedule_time_start');
    const end = fd.get('schedule_time_end');
    const timeStr = `${start} - ${end}`;

    const payload = {
      code: fd.get('code'),
      title: fd.get('title'),
      units: Number(fd.get('units')),
      schedule_day: fd.get('schedule_day'),
      schedule_time: timeStr,
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
});

// ... (Keep logout and initial boot exactly as they are, but add window.regPresetFilterProg = 'all' etc.) ...
