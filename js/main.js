import { $, esc, toast, initials } from './utils.js';
import { supa } from './api.js';
import { session, loadSession, doLogin, doRegister, doLogout } from './auth.js';
import { renderStudentDashboard, renderApply } from './student.js';
import { renderAdminDashboard, renderAdminStudents, renderAdminCourses, renderAdminEnrollments, adminOpenStudentModal } from './admin.js';
import { renderFacultyDashboard, renderFacultyProgress, renderFacultyPresets, renderFacultyCourses, facultyEditPresetModal, facultyEditCourseModal } from './faculty.js';

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
  else if (view === 'courses') content.innerHTML = await renderFacultyCourses(); 
}

window.setFacultyView = (view) => { 
  window.currentView = view; 
  window.facultySelectedStudent = null; 
  window.tempStudentSubjects = [];
  renderAll(); 
};

window.closeFacultyStudent = () => {
  window.facultySelectedStudent = null;
  window.tempStudentSubjects = [];
  renderAll();
};

window.tempStudentSubjects = [];
window.tempPresetSubjects = [];
window.tempDeletedPSIds = [];

window.tempAddSubject = (studentId) => {
  const sel = document.querySelector('#facultyAddSubjectForm select[name="course_id"]');
  if (!sel.value) return toast('Select a subject first', 'error');
  const courseId = Number(sel.value);
  
  if (window.tempStudentSubjects.some(s => String(s.courseId) === String(courseId))) {
    return toast('Subject is already in the list.', 'error');
  }

  const opt = sel.options[sel.selectedIndex];
  const text = opt.text;
  const code = text.split('—')[0].trim();
  const title = text.split('—')[1].split('(')[0].trim();
  const units = text.match(/\((\d+)\s*units\)/)[1];

  window.tempStudentSubjects.push({ courseId, code, title, units });
  renderAll(); // Instantly updates UI and removes from dropdown
};

window.removeTempSubject = (idx) => {
  window.tempStudentSubjects.splice(idx, 1);
  renderAll(); // Instantly updates UI and puts subject back in dropdown
};

window.confirmStudentSubjects = async (studentId) => {
  if (!window.tempStudentSubjects.length) return;
  
  try {
    for (const sub of window.tempStudentSubjects) {
      await supa('student_subjects', { method: 'POST', body: { user_id: Number(studentId), course_id: Number(sub.courseId), status: 'Enrolled' } });
    }
    toast('Subjects confirmed and added to student!');
    window.tempStudentSubjects = [];
    renderAll();
  } catch (err) {
    toast('Failed to confirm subjects.', 'error');
  }
};

window.facultyLoadPresetToTemp = async (presetId) => {
  try {
    const presetSubs = await supa('preset_subjects', { match: { preset_id: presetId } });
    const courses = await supa('courses');
    const currentTaken = await supa('student_subjects', { match: { user_id: window.facultySelectedStudent } });

    let addedCount = 0;
    for (const ps of presetSubs) {
      const courseId = ps.course_id;
      
      // Skip if already confirmed or already in temp
      if (currentTaken.some(t => String(t.course_id) === String(courseId))) continue;
      if (window.tempStudentSubjects.some(s => String(s.courseId) === String(courseId))) continue;

      const c = courses.find(x => String(x.id) === String(courseId));
      if (c) {
        window.tempStudentSubjects.push({ 
          courseId: c.id, 
          code: c.code, 
          title: c.title, 
          units: c.units 
        });
        addedCount++;
      }
    }
    
    if (addedCount > 0) {
      toast(`Added ${addedCount} subjects to the pending list.`);
    } else {
      toast('No new subjects to add (already in list or confirmed).', 'warn');
    }
    
    renderAll();
    
  } catch (err) {
    console.error(err);
    toast('Failed to load preset.', 'error');
  }
};

window.addPresetSubjectTemp = async (presetId) => {
  const input = document.getElementById('presetCodeInput');
  const code = input.value.trim().toUpperCase();
  const errDiv = document.getElementById('presetErrorMsg');
  
  if (!code) return;
  
  const courses = await supa('courses');
  const course = courses.find(c => c.code.toUpperCase() === code);
  
  if (!course) {
    errDiv.textContent = "Course code does not exist!";
    errDiv.style.display = 'block';
    return;
  }
  errDiv.style.display = 'none';
  
  if (window.tempPresetSubjects.some(s => String(s.id) === String(course.id))) {
    errDiv.textContent = "Subject is already in the preset.";
    errDiv.style.display = 'block';
    return;
  }

  window.tempPresetSubjects.push({ ...course, psId: 'NEW' });
  input.value = '';
  
  const listContainer = document.getElementById('presetSubjectListContainer');
  if (listContainer) {
    listContainer.innerHTML = window.tempPresetSubjects.map(c => `
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #eee; padding:10px 0;">
        <div>
          <div style="font-weight:600; font-size:13px;">${esc(c.code)} — ${esc(c.title)}</div>
          <div class="rp-hint">${c.units} units</div>
        </div>
        <button type="button" class="rp-btn rp-btn-danger rp-btn-sm" onclick="window.removePresetSubjectTemp('${c.psId}', '${c.id}')">Remove</button>
      </div>
    `).join('');
  }
};

window.removePresetSubjectTemp = (psId, courseId) => {
  if (psId !== 'NEW') {
    window.tempDeletedPSIds.push(psId);
  }
  window.tempPresetSubjects = window.tempPresetSubjects.filter(s => String(s.id) !== String(courseId));
  
  const listContainer = document.getElementById('presetSubjectListContainer');
  if (listContainer) {
    listContainer.innerHTML = window.tempPresetSubjects.map(c => `
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #eee; padding:10px 0;">
        <div>
          <div style="font-weight:600; font-size:13px;">${esc(c.code)} — ${esc(c.title)}</div>
          <div class="rp-hint">${c.units} units</div>
        </div>
        <button type="button" class="rp-btn rp-btn-danger rp-btn-sm" onclick="window.removePresetSubjectTemp('${c.psId}', '${c.id}')">Remove</button>
      </div>
    `).join('');
  }
};

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

  if (action === 'facultyManageStudent') {
    window.facultySelectedStudent = Number(btn.dataset.id);
    window.tempStudentSubjects = []; 
    renderAll();
    return;
  }

  if (action === 'facultyLoadPresetToTemp') {
    await window.facultyLoadPresetToTemp(Number(btn.dataset.preset));
    return;
  }

  if (action === 'facultyRemoveSubject') {
    const subjectId = Number(btn.dataset.id);
    try {
      await supa('student_subjects', { method: 'DELETE', match: { id: subjectId } });
      toast('Subject removed.');
      renderAll();
    } catch (err) { toast('Failed to remove.', 'error'); }
    return;
  }

  if (action === 'facultyCreatePreset') {
    await facultyEditPresetModal(null);
    return;
  }

  if (action === 'facultyEditPreset') {
    await facultyEditPresetModal(Number(btn.dataset.id));
    return;
  }

  if (action === 'facultyEditCourse') {
    await facultyEditCourseModal(Number(btn.dataset.id));
    return;
  }

  if (action === 'facultySavePreset') {
    const id = document.getElementById('preset_edit_id').value;
    const name = document.getElementById('preset_name').value;
    const prog = document.getElementById('preset_prog').value;
    const year = document.getElementById('preset_year').value;
    const sem = document.getElementById('preset_sem').value;

    if (!name) return toast('Preset name is required.', 'error');

    const payload = {
      name: name,
      program_id: Number(prog),
      year_level: Number(year),
      semester: sem
    };

    try {
      let presetId = id;
      if (id) {
        await supa('presets', { method: 'PATCH', match: { id: Number(id) }, body: payload });
      } else {
        const res = await supa('presets', { method: 'POST', body: payload });
        presetId = res[0].id;
      }

      for (const delId of window.tempDeletedPSIds) {
        await supa('preset_subjects', { method: 'DELETE', match: { id: delId } });
      }
      window.tempDeletedPSIds = [];

      const existingSubs = await supa('preset_subjects', { match: { preset_id: presetId } });
      for (const sub of window.tempPresetSubjects) {
        if (sub.psId === 'NEW' && !existingSubs.some(es => String(es.course_id) === String(sub.id))) {
          await supa('preset_subjects', { method: 'POST', body: { preset_id: presetId, course_id: sub.id } });
        }
      }

      toast('Preset saved successfully.');
      document.getElementById('facultyPresetModal')?.remove();
      renderAll();
    } catch (err) {
      console.error(err);
      toast('Failed to save preset.', 'error');
    }
    return;
  }

  if (action === 'facultyDeletePreset') {
    const id = Number(btn.dataset.id);
    if (!confirm('Delete this preset?')) return;
    try {
      await supa('presets', { method: 'DELETE', match: { id } });
      toast('Preset deleted.');
      renderAll();
    } catch (err) { toast('Failed to delete.', 'error'); }
    return;
  }

  if (action === 'facultySaveEditedCourse') {
    const id = Number(document.getElementById('edit_course_id').value);
    const code = document.getElementById('edit_course_code').value;
    const title = document.getElementById('edit_course_title').value;
    const units = Number(document.getElementById('edit_course_units').value);
    const day = document.getElementById('edit_course_day').value;
    const start = document.getElementById('edit_course_start').value;
    const end = document.getElementById('edit_course_end').value;
    const prog = Number(document.getElementById('edit_course_prog').value);

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
      document.getElementById('facultyEditCourseModal')?.remove();
      renderAll();
    } catch (err) {
      console.error(err);
      toast('Failed to update subject.', 'error');
    }
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

document.addEventListener('change', async (e) => {
  const key = e.target.dataset.change;
  if (!key) return;

  if (key === 'facultyFilterYear') {
    window.facultyFilterYear = e.target.value;
    renderAll();
  } else if (key === 'facultyFilterProg') {
    window.facultyFilterProg = e.target.value;
    renderAll();
  } else if (key === 'presetFilterProg') {
    window.presetFilterProg = e.target.value;
    renderAll();
  } else if (key === 'presetFilterYear') {
    window.presetFilterYear = e.target.value;
    renderAll();
  } else if (key === 'facultyCourseFilterProg') {
    window.facultyCourseFilterProg = e.target.value;
    renderAll();
  } else if (key === 'facultyRegularity') {
    const studentId = Number(e.target.dataset.student);
    const isRegular = e.target.value === 'true';
    try {
      await supa('applications', { method: 'PATCH', match: { user_id: studentId }, body: { is_regular: isRegular } });
      toast('Student status updated.');
    } catch (err) { toast('Failed to update status', 'error'); }
  }
});

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

  if (e.target.id === 'facultySearchForm') {
    const q = document.getElementById('facultySearchInput').value;
    window.facultySearch = q;
    renderAll();
    return;
  }

  if (e.target.id === 'facultyCreateCourseForm') {
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

window.logout = () => { doLogout(() => renderAll()); };

window.currentView = 'dashboard';
window.currentStep = 1;
window.facultySearch = '';
window.facultyFilterYear = '';
window.facultyFilterProg = '';
window.presetFilterProg = 'all';
window.presetFilterYear = 'all';
window.facultyCourseFilterProg = 'all';
window.facultySelectedStudent = null;
renderAll();
