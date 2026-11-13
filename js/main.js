import { $, esc, toast, initials } from './utils.js';
import { supa } from './api.js';
import { session, loadSession, doLogin, doRegister, doLogout } from './auth.js';
import { renderStudentDashboard, renderApply } from './student.js';
import { renderAdminDashboard, renderAdminStudents, renderAdminCourses, renderAdminEnrollments, adminOpenStudentModal } from './admin.js';
import { renderFacultyDashboard, renderFacultyProgress, renderFacultyCourses, facultyEditCourseModal } from './faculty.js';

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

// ... [Keep renderAuthPage, renderAdminLayout, renderFacultyLayout as they are] ...

// GLOBAL CLICKS
document.addEventListener('click', async (e) => {
  const navBtn = e.target.closest('[data-nav]');
  if (navBtn) { window.currentView = navBtn.dataset.nav; window.currentStep = 1; renderAll(); return; }

  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;

  // ... [Keep authTab, toggleCertify, prevStep, gotoStep, continueApp, chooseDocType, changeDocType, submitApplication as they are] ...

  // FACULTY ACTIONS
  if (action === 'facultyManageStudent') {
    window.facultySelectedStudent = Number(btn.dataset.id);
    renderAll();
    return;
  }

  if (action === 'facultyApproveSubject') {
    const subjectId = Number(btn.dataset.id);
    try {
      await supa('student_subjects', { method: 'PATCH', match: { id: subjectId }, body: { status: 'Taken' } });
      toast('Payment approved. Subject marked as Taken.');
      renderAll();
    } catch (err) { toast('Failed to approve.', 'error'); }
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

  if (action === 'facultyEditCourse') {
    await facultyEditCourseModal(Number(btn.dataset.id));
    return;
  }

  // --- NEW ACTION FOR SAVING EDITED SUBJECT ---
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

  // ADMIN ACTIONS
  // ... [Keep adminOpenStudent, adminRemoveSubject, adminApproveEnrollment as they are] ...
});

// GLOBAL CHANGE LISTENERS
document.addEventListener('change', (e) => {
  const key = e.target.dataset.change;
  if (!key) return;

  if (key === 'facultyFilterYear') {
    window.facultyFilterYear = e.target.value;
    renderAll();
  } else if (key === 'facultyFilterProg') {
    window.facultyFilterProg = e.target.value;
    renderAll();
  } else if (key === 'facultyCourseFilterProg') {
    window.facultyCourseFilterProg = e.target.value;
    renderAll();
  }
});

// GLOBAL FORMS
document.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  if (e.target.id === 'loginForm') { await doLogin(e.target, () => { window.currentView = 'dashboard'; renderAll(); }); return; }
  if (e.target.id === 'registerForm') { await doRegister(e.target, () => { window.currentView = 'dashboard'; renderAll(); }); return; }

  // ... [Keep stepForm, facultySearchForm, facultyAddSubjectForm, facultyCreateCourseForm, adminEditStudentForm, adminSubjectForm as they are] ...
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
window.facultyCourseFilterProg = 'all';
window.facultySelectedStudent = null;
renderAll();
