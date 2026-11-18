import { $, esc, toast, initials, isHistorySubject } from './utils.js';
import { supa } from './api.js';
import { session, loadSession, doLogin, doRegister, doLogout } from './auth.js';
import { renderStudentDashboard, renderApply, renderPaymentTab, renderScheduleTab, renderRegistrationTab, renderStudentDocumentsTab } from './student.js';
import { renderAdminDashboard } from './admin.js';
import { renderAdminUsers, renderAdminRecords, createStaffUser } from './adminmanage.js';
import { renderFacultyDashboard, renderFacultyProgress } from './faculty.js';
import { renderAccountingDashboard, renderAccountingLogs, renderAccountingSettings, renderAccountingStudents, accountingManageStudentModal } from './accounting.js';
import {
  renderRegistrarDashboard,
  renderRegistrarPresets,
  renderRegistrarCourses,
  renderRegistrarStudents,
  renderRegistrarPrereqs,
  renderRegistrarPrograms,
  renderRegistrarAcademicTerm,
  regManageStudentModal,
  regEditPresetModal,
  regEditCourseModal,
  regEditPrereqModal,
  regProgramModal
} from './registrar.js';
import { renderRegistrarUnitLimits, regUnitLimitModal } from './unitlimits.js';
import { decodePrereqSet, hydratePrereqSets, encodePrereqName, evaluatePrerequisites, missingLabel } from './prereqs.js';
import {
  loadCatalog,
  saveProgram,
  deleteProgram,
  saveCoursePrograms,
  saveProgramUnitLimits,
  saveAcademicTerm,
  findUnitLimit,
  prereqMatchesProgram,
  refreshProgramPickers,
  getPickedProgramIds
} from './catalog.js';
import { docsForType, docsComplete, docsUploaded } from './documents.js';
import { isAccepted, canAccept } from './status.js';
import { renderTemplate, preloadTemplates, setActiveNav } from './templates.js';

loadSession();

// Each portal's markup lives in html/<portal>.html. Load it before rendering.
await preloadTemplates(['auth', 'student', 'admin', 'faculty', 'accounting', 'registrar']);

// Programs, subject program mappings and unit limits are shared by every portal.
await loadCatalog();

export async function renderAll() {
  const authPage = $('#authPage');
  const pageWrap = $('#pageWrap');
  const navbar = $('#navbar');

  if (!session) {
    authPage.classList.remove('hidden');
    pageWrap.classList.add('hidden');
    navbar.classList.add('hidden');
    await renderAuthPage();
    return;
  }

  authPage.classList.add('hidden');
  pageWrap.classList.remove('hidden');
  navbar.classList.remove('hidden');

  if (session.role === 'admin') { renderAdminLayout(); return; }
  if (session.role === 'faculty') { renderFacultyLayout(); return; }
  if (session.role === 'accounting') { renderAccountingLayout(); return; }
  if (session.role === 'registrar') { renderRegistrarLayout(); return; }

  // --- STUDENT ROUTING & DYNAMIC NAVBAR ---
  pageWrap.className = 'page-wrap'; // Resets layout to student style
  const apps = await supa('applications', { match: { user_id: session.userId } }).catch(() => []);
  const app = apps[0] || {};
  // Subjects already taken (remarks Passed/Dropped) are history, not the current load
  const subjects = (await supa('student_subjects', { match: { user_id: session.userId } }).catch(() => []))
    .filter(s => !isHistorySubject(s));
  const courses = await supa('courses').catch(() => []);
  const settingsRes = await supa('system_settings', { match: { id: 1 } }).catch(() => []);
  const settings = settingsRes[0] || { tuition_per_unit: 444, misc_fee: 5452, reg_fee: 1000 };

  const hasSubjects = subjects.length > 0;
  const hasPaid = Number(app.amount_paid || 0) > 0;
  const isReturned = !!app.returned;

  let navItems = [];
  if (!hasSubjects || isReturned) {
    navItems = [
      { id: 'dashboard', label: 'Dashboard' },
      { id: 'apply', label: 'Application' }
    ];
    // A submitted application needs its Documents tab so the student can
    // confirm the uploaded documents before the Faculty sees the student.
    if (app.submitted && !isReturned) navItems.push({ id: 'documents', label: 'Documents' });
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
    if (app.submitted) {
      navItems.push({ id: 'documents', label: 'Documents' });
    }
  }

  let currentView = window.currentView || 'dashboard';
  if (!navItems.find(n => n.id === currentView)) {
    currentView = navItems[0].id;
    window.currentView = currentView;
  }

  navbar.innerHTML = await renderTemplate('student', {
    links: navItems.map(item => `
        <button class="nav-link ${currentView === item.id ? 'active' : ''}" data-nav="${item.id}">${item.label}</button>
      `).join(''),
    userName: esc(session.name)
  });

  pageWrap.innerHTML = '<div class="progress-card">Loading...</div>';

  if (currentView === 'dashboard') pageWrap.innerHTML = await renderStudentDashboard();
  else if (currentView === 'apply') pageWrap.innerHTML = await renderApply();
  else if (currentView === 'payment') pageWrap.innerHTML = await renderPaymentTab(app, subjects, courses, settings);
  else if (currentView === 'schedule') pageWrap.innerHTML = await renderScheduleTab(app, subjects, courses);
  else if (currentView === 'registration') pageWrap.innerHTML = await renderRegistrationTab(app, subjects, courses, settings);
  else if (currentView === 'documents') pageWrap.innerHTML = await renderStudentDocumentsTab(app);
}

// --- SIMULATED PAYMENT (STUDENT) ---
const pesoLabel = (n) => '₱' + Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 });

/* Records one online payment and updates the application in the same step, so
   the receipt the student prints and the amount the portals read always agree. */
async function recordStudentPayment(amount, paymentType) {
  const apps = await supa('applications', { match: { user_id: session.userId } }).catch(() => []);
  const app = apps[0] || {};
  const newPaid = Number(app.amount_paid || 0) + Number(amount);

  await supa('applications', {
    method: 'PATCH',
    match: { user_id: session.userId },
    body: isAccepted(app) ? { amount_paid: newPaid, status: 'Enrolled' } : { amount_paid: newPaid }
  });

  await supa('payment_logs', {
    method: 'POST',
    body: {
      user_id: session.userId,
      amount: Number(amount),
      reference_no: 'PAY-ONL-' + Date.now().toString().slice(-6),
      payment_type: paymentType,
      processed_by: 'Online'
    }
  });
}

// Student IDs look like UCC-2026-0001 and are numbered per calendar year.
async function nextStudentId() {
  const users = await supa('users').catch(() => []);
  const prefix = `UCC-${new Date().getFullYear()}-`;
  const highest = users.reduce((max, u) => {
    const id = String(u.student_id || '');
    if (!id.startsWith(prefix)) return max;
    const n = Number(id.slice(prefix.length));
    return Number.isFinite(n) ? Math.max(max, n) : max;
  }, 0);
  return prefix + String(highest + 1).padStart(4, '0');
}

window.payTuition = async (type, total, currentPaid) => {
  const balance = Number(total) - Number(currentPaid);
  const amountToAdd = type === 'half' ? balance / 2 : balance;
  if (!(amountToAdd > 0)) return toast('There is nothing left to pay.', 'error');
  if (!confirm(`Simulate paying ${pesoLabel(amountToAdd)}?`)) return;

  try {
    await recordStudentPayment(amountToAdd, type === 'half' ? 'Downpayment' : 'Full Payment');
    toast('Payment successful!');
    window.currentView = 'schedule';
    renderAll();
  } catch (err) {
    console.error('Payment Error Details:', err);
    toast('Payment failed. Check console (F12) for details.', 'error');
  }
};

// Third option: the student types any amount up to the remaining balance.
window.payCustomAmount = async (total, currentPaid) => {
  const input = document.getElementById('customPayAmount');
  const amount = Number(input ? input.value : NaN);
  const balance = Number(total) - Number(currentPaid);

  if (!Number.isFinite(amount) || amount <= 0) {
    return toast('Enter an amount greater than zero.', 'error');
  }
  if (amount > balance + 0.001) {
    return toast(`That is more than the remaining balance of ${pesoLabel(balance)}.`, 'error');
  }
  if (!confirm(`Simulate paying ${pesoLabel(amount)}?`)) return;

  try {
    await recordStudentPayment(amount, 'Custom Amount');
    toast('Payment successful!');
    window.currentView = 'schedule';
    renderAll();
  } catch (err) {
    console.error('Payment Error Details:', err);
    toast('Payment failed. Check console (F12) for details.', 'error');
  }
};

// --- LOGIN / REGISTRATION ---
async function renderAuthPage() {
  $('#authPage').innerHTML = await renderTemplate('auth');
}

// --- ADMIN LAYOUT ---
const ADMIN_VIEWS = {
  dashboard: { label: 'Dashboard', sub: 'System-wide overview' },
  students: { label: 'Student Management', sub: 'Registrar records' },
  users: { label: 'Staff Accounts', sub: 'Create Registrar, Accounting and Faculty logins' },
  records: { label: 'Application Records', sub: 'Every record, with delete' },
  programs: { label: 'Programs', sub: 'Degree programs offered' },
  unitlimits: { label: 'Unit Limits', sub: 'Maximum units per program and year level' },
  academicterm: { label: 'Academic Term', sub: 'Current semester and school year' },
  courses: { label: 'Subjects', sub: 'Curriculum' },
  presets: { label: 'Preset Subjects', sub: 'Curriculum' },
  prereqs: { label: 'Prerequisite Subjects', sub: 'Curriculum' },
  faculty: { label: 'Student Courses', sub: 'Assign student subjects' },
  logs: { label: 'Payment Logs', sub: 'Accounting' },
  payments: { label: 'Student Payments', sub: 'Accounting' },
  fees: { label: 'Fee Settings', sub: 'Accounting' }
};

const FACULTY_VIEWS = {
  dashboard: { label: 'Dashboard', sub: 'Student Evaluation' },
  progress: { label: 'Check Students', sub: 'Assign student subjects' }
};

const ACCOUNTING_VIEWS = {
  dashboard: { label: 'Dashboard', sub: 'Manage student payments' },
  logs: { label: 'Payment Logs', sub: 'Recorded transactions' },
  students: { label: 'Student Payments', sub: 'Process a payment' },
  settings: { label: 'Fee Settings', sub: 'Tuition and other fees' }
};

const REGISTRAR_VIEWS = {
  dashboard: { label: 'Dashboard', sub: 'Manage academic records' },
  students: { label: 'Student Management', sub: 'Applications and records' },
  programs: { label: 'Programs', sub: 'Degree programs offered' },
  unitlimits: { label: 'Unit Limits', sub: 'Maximum units per program, year and semester' },
  academicterm: { label: 'Academic Term', sub: 'Current semester and school year' },
  presets: { label: 'Preset Subjects', sub: 'Curriculum presets' },
  prereqs: { label: 'Prerequisite Subjects', sub: 'Required sequences' },
  courses: { label: 'Manage Subjects', sub: 'Curriculum' }
};

async function renderAdminLayout() {
  const pageWrap = $('#pageWrap');
  pageWrap.className = 'role-page-wrap'; // Enforces full flush width
  $('#navbar').classList.add('hidden');
  pageWrap.classList.remove('hidden');

  const view = window.currentView && ADMIN_VIEWS[window.currentView] ? window.currentView : 'dashboard';
  window.currentView = view;
  const meta = ADMIN_VIEWS[view];

  pageWrap.innerHTML = await renderTemplate('admin', {
    title: esc(meta.label),
    subtitle: esc(meta.sub),
    userName: esc(session.name),
    initials: initials(session.name)
  });
  setActiveNav(pageWrap, view);

  const content = $('#adminContent');

  if (view === 'dashboard') content.innerHTML = await renderAdminDashboard();
  else if (view === 'students') content.innerHTML = await renderRegistrarStudents();
  else if (view === 'users') content.innerHTML = await renderAdminUsers();
  else if (view === 'records') content.innerHTML = await renderAdminRecords();
  else if (view === 'programs') content.innerHTML = await renderRegistrarPrograms();
  else if (view === 'unitlimits') content.innerHTML = await renderRegistrarUnitLimits();
  else if (view === 'academicterm') content.innerHTML = await renderRegistrarAcademicTerm();
  else if (view === 'courses') content.innerHTML = await renderRegistrarCourses();
  else if (view === 'presets') content.innerHTML = await renderRegistrarPresets();
  else if (view === 'prereqs') content.innerHTML = await renderRegistrarPrereqs();
  else if (view === 'faculty') content.innerHTML = await renderFacultyProgress();
  else if (view === 'logs') content.innerHTML = await renderAccountingLogs();
  else if (view === 'payments') content.innerHTML = await renderAccountingStudents();
  else if (view === 'fees') content.innerHTML = await renderAccountingSettings();
}

window.setAdminView = (view) => {
  window.currentView = view;
  window.facultySelectedStudent = null;
  window.tempStudentSubjects = [];
  renderAll();
};

// --- FACULTY LAYOUT ---
async function renderFacultyLayout() {
  const pageWrap = $('#pageWrap');
  pageWrap.className = 'role-page-wrap'; // Enforces full flush width
  $('#navbar').classList.add('hidden');
  pageWrap.classList.remove('hidden');

  const view = window.currentView && FACULTY_VIEWS[window.currentView] ? window.currentView : 'dashboard';
  window.currentView = view;
  const meta = FACULTY_VIEWS[view];

  pageWrap.innerHTML = await renderTemplate('faculty', {
    title: esc(meta.label),
    subtitle: esc(meta.sub),
    userName: esc(session.name),
    initials: initials(session.name)
  });
  setActiveNav(pageWrap, view);

  const content = $('#facultyContent');

  if (view === 'dashboard') content.innerHTML = await renderFacultyDashboard();
  else if (view === 'progress') content.innerHTML = await renderFacultyProgress();
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

// --- ACCOUNTING LAYOUT ---
async function renderAccountingLayout() {
  const pageWrap = $('#pageWrap');
  pageWrap.className = 'role-page-wrap'; // Enforces full flush width
  $('#navbar').classList.add('hidden');
  pageWrap.classList.remove('hidden');

  const view = window.currentView && ACCOUNTING_VIEWS[window.currentView] ? window.currentView : 'dashboard';
  window.currentView = view;
  const meta = ACCOUNTING_VIEWS[view];

  pageWrap.innerHTML = await renderTemplate('accounting', {
    title: esc(meta.label),
    subtitle: esc(meta.sub),
    userName: esc(session.name),
    initials: initials(session.name)
  });
  setActiveNav(pageWrap, view);

  const content = $('#accContent');

  if (view === 'dashboard') content.innerHTML = await renderAccountingDashboard();
  else if (view === 'logs') content.innerHTML = await renderAccountingLogs();
  else if (view === 'students') content.innerHTML = await renderAccountingStudents();
  else if (view === 'settings') content.innerHTML = await renderAccountingSettings();
}

window.setAccountingView = (view) => { window.currentView = view; renderAll(); };

// --- REGISTRAR LAYOUT ---
async function renderRegistrarLayout() {
  const pageWrap = $('#pageWrap');
  pageWrap.className = 'role-page-wrap'; // Enforces full flush width
  $('#navbar').classList.add('hidden');
  pageWrap.classList.remove('hidden');

  const view = window.currentView && REGISTRAR_VIEWS[window.currentView] ? window.currentView : 'dashboard';
  window.currentView = view;
  const meta = REGISTRAR_VIEWS[view];

  pageWrap.innerHTML = await renderTemplate('registrar', {
    title: esc(meta.label),
    subtitle: esc(meta.sub),
    userName: esc(session.name),
    initials: initials(session.name)
  });
  setActiveNav(pageWrap, view);

  const content = $('#regContent');

  if (view === 'dashboard') content.innerHTML = await renderRegistrarDashboard();
  else if (view === 'students') content.innerHTML = await renderRegistrarStudents();
  else if (view === 'programs') content.innerHTML = await renderRegistrarPrograms();
  else if (view === 'unitlimits') content.innerHTML = await renderRegistrarUnitLimits();
  else if (view === 'academicterm') content.innerHTML = await renderRegistrarAcademicTerm();
  else if (view === 'presets') content.innerHTML = await renderRegistrarPresets();
  else if (view === 'prereqs') content.innerHTML = await renderRegistrarPrereqs();
  else if (view === 'courses') content.innerHTML = await renderRegistrarCourses();
}

window.setRegistrarView = (view) => { window.currentView = view; renderAll(); };


// --- GLOBAL HELPERS (FACULTY & REGISTRAR) ---
window.tempStudentSubjects = [];
window.tempRegPresetSubjects = [];
window.tempRegPresetId = null;
window.tempRegDeletedPSIds = [];
window.tempRegPrereqSubjects = [];

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
  renderAll();
};

window.removeTempSubject = (idx) => {
  window.tempStudentSubjects.splice(idx, 1);
  renderAll();
};

window.confirmStudentSubjects = async (studentId) => {
  if (!window.tempStudentSubjects.length) return;

  try {
    // Enforce prerequisite sequences before anything is written.
    const [recorded, presetRows, courses, apps] = await Promise.all([
      supa('student_subjects', { match: { user_id: Number(studentId) } }).catch(() => []),
      supa('presets').catch(() => []),
      supa('courses').catch(() => []),
      supa('applications', { match: { user_id: Number(studentId) } }).catch(() => [])
    ]);

    let program = (apps[0] || {}).program || {};
    if (typeof program === 'string') { try { program = JSON.parse(program); } catch (e) { program = {}; } }

    // Only the sequences that apply to this student's program are enforced.
    const prereqSets = hydratePrereqSets(presetRows.map(decodePrereqSet).filter(Boolean), courses)
      .filter(set => prereqMatchesProgram(set, program.preferred));
    const passedIds = recorded
      .filter(s => String(s.remarks || '').trim() === 'Passed')
      .map(s => s.course_id);

    const problems = evaluatePrerequisites({
      selectedIds: window.tempStudentSubjects.map(s => s.courseId),
      passedIds,
      sets: prereqSets,
      courses
    });

    if (problems.size) {
      const codeById = new Map(courses.map(c => [String(c.id), c.code]));
      window.facultyPrereqErrors = [...problems.entries()].map(([courseId, missing]) =>
        `${codeById.get(String(courseId)) || 'Subject'} — ${missingLabel(missing)}`);
      renderAll();
      return toast('Cannot confirm subjects: the prerequisite sequence is broken.', 'error');
    }

    window.facultyPrereqErrors = [];

    // Enforce the unit limit the Registrar set for this program and year level.
    const limit = findUnitLimit(program.preferred, program.year_level);

    if (limit) {
      const unitsOf = (courseId) => {
        const c = courses.find(x => String(x.id) === String(courseId));
        return c ? Number(c.units) || 0 : 0;
      };
      const recordedUnits = recorded.filter(s => !isHistorySubject(s)).reduce((sum, s) => sum + unitsOf(s.course_id), 0);
      const pendingUnits = window.tempStudentSubjects.reduce((sum, s) => sum + (Number(s.units) || unitsOf(s.courseId)), 0);
      const totalUnits = recordedUnits + pendingUnits;

      if (totalUnits > limit.maxUnits) {
        toast(`Cannot confirm subjects: the load is ${totalUnits} units but the limit is ${limit.maxUnits} for this program, year and semester.`, 'error');
        renderAll();
        return;
      }
    }

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
    // A preset must never re-offer a subject the student already finished
    const takenIds = new Set(currentTaken
      .filter(t => !isHistorySubject(t))
      .map(t => String(t.course_id)));
    const historyIds = new Set(currentTaken
      .filter(t => isHistorySubject(t))
      .map(t => String(t.course_id)));

    let addedCount = 0;
    let skippedCount = 0;
    for (const ps of presetSubs) {
      const courseId = ps.course_id;

      if (takenIds.has(String(courseId)) || historyIds.has(String(courseId))) { skippedCount++; continue; }
      if (window.tempStudentSubjects.some(s => String(s.courseId) === String(courseId))) continue;

      const c = courses.find(x => String(x.id) === String(courseId));
      if (c) {
        window.tempStudentSubjects.push({ courseId: c.id, code: c.code, title: c.title, units: c.units });
        addedCount++;
      }
    }

    if (addedCount > 0) {
      toast(`Added ${addedCount} subjects to the pending list.`);
    } else {
      toast(skippedCount > 0
        ? `No new subjects to add — ${skippedCount} already taken or in the list.`
        : 'No new subjects to add (already in list or confirmed).', 'warn');
    }

    renderAll();
  } catch (err) {
    console.error(err);
    toast('Failed to load preset.', 'error');
  }
};

window.searchAcc = () => { renderAll(); };

// --- GLOBAL CLICKS ---
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

  if (action === 'createReport') { if (window.createReportTable) window.createReportTable(btn.dataset.report); return; }
  if (action === 'downloadReport') { if (window.downloadReport) window.downloadReport(btn.dataset.report); return; }

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

    // Validation: Check if required docs are uploaded
    const apps = await supa('applications', { match: { user_id: session.userId } });
    const app = apps[0];
    const docType = app.doc_type;

    if (docType === 'freshman') {
      const required = ['form138', 'psa', 'idpic', 'goodmoral', 'exam'];
      const missing = required.filter(id => !app.documents || !app.documents[id]);
      if (missing.length > 0) return toast('Please upload all required documents.', 'error');
    } else if (docType === 'transferee') {
       const required = ['transfer_cred', 'tor', 'goodmoral_prev', 'psa', 'idpic'];
      const missing = required.filter(id => !app.documents || !app.documents[id]);
      if (missing.length > 0) return toast('Please upload all required documents.', 'error');
    } else if (docType === 'returnee') {
       const required = ['readmission', 'clearance'];
      const missing = required.filter(id => !app.documents || !app.documents[id]);
      if (missing.length > 0) return toast('Please upload all required documents.', 'error');
    }

    await supa('applications', { method: 'PATCH', match: { user_id: session.userId }, body: { submitted: true, returned: false, reference: 'UCC-' + Date.now().toString().slice(-8), status: 'Pending Review' } });
    toast('Application submitted successfully!');
    window.currentView = 'dashboard'; renderAll(); return;
  }

  if (action === 'confirmDocuments') {
    const apps = await supa('applications', { match: { user_id: session.userId } }).catch(() => []);
    const app = apps[0];

    if (!app || !app.submitted) return toast('Submit your application before confirming your documents.', 'error');
    if (docsComplete(app)) return toast('Your documents are already confirmed.');
    if (!docsUploaded(app)) return toast('Upload every required document before confirming.', 'error');

    // Every uploaded required document is complete; the confirmation is what
    // lets the Faculty see the student.
    const docStatus = app.doc_status || {};
    docsForType(app.doc_type).filter(d => d.required).forEach(d => {
      if (app.documents && app.documents[d.id]) docStatus[d.id] = 'Complete';
    });

    try {
      await supa('applications', {
        method: 'PATCH',
        match: { user_id: session.userId },
        body: {
          doc_status: docStatus,
          documents_verified: true,
          // Completed documents no longer enrol anybody: the Registrar accepts
          // the application, which is what makes the student an Enrollee.
          status: 'Documents Complete'
        }
      });
      toast('Documents confirmed. The Registrar will now review and accept your application.');
      renderAll();
    } catch (err) {
      console.error(err);
      toast('Could not confirm your documents.', 'error');
    }
    return;
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
      // Once the student has paid for the load the Faculty can no longer change
      // it. The Registrar and the Admin still can, after a warning.
      const studentApps = await supa('applications', { match: { user_id: Number(btn.dataset.student) } }).catch(() => []);
      const paid = Number((studentApps[0] || {}).amount_paid || 0) > 0;

      if (paid && session.role === 'faculty') {
        return toast('This student has already paid, so the subject can no longer be removed here.', 'error');
      }
      if (paid && !confirm('This student has already paid for this load. Removing the subject changes a paid enrollment. Continue?')) return;

      await supa('student_subjects', { method: 'DELETE', match: { id: subjectId } });
      toast('Subject removed.');
      renderAll();
    } catch (err) { toast('Failed to remove.', 'error'); }
    return;
  }

  // REGISTRAR ACTIONS
  if (action === 'regManageStudent') {
    await regManageStudentModal(
      Number(btn.dataset.id),
      undefined,
      session.role === 'admin' ? 'ADMIN COPY' : 'REGISTRAR COPY'
    );
    return;
  }

  if (action === 'regCreateProgram') {
    await regProgramModal(null);
    return;
  }

  if (action === 'regEditProgram') {
    await regProgramModal(Number(btn.dataset.id));
    return;
  }

  if (action === 'regDeleteProgram') {
    const programId = btn.dataset.id;
    const apps = await supa('applications').catch(() => []);
    const inUse = apps.filter((a) => {
      let pr = a.program || {};
      if (typeof pr === 'string') { try { pr = JSON.parse(pr); } catch (e) { pr = {}; } }
      return String(pr.preferred) === String(programId);
    }).length;

    const warning = inUse
      ? `${inUse} student application(s) use this program and will show "Unspecified". `
      : '';
    if (!confirm(`${warning}Delete this program? Its unit limits and subject assignments will also be removed.`)) return;

    try {
      await deleteProgram(Number(programId));
      await loadCatalog();
      toast('Program deleted.');
      renderAll();
    } catch (err) {
      console.error(err);
      toast('Failed to delete the program.', 'error');
    }
    return;
  }

  if (action === 'regEditUnitLimits') {
    await regUnitLimitModal(Number(btn.dataset.id));
    return;
  }

  if (action === 'regAcceptStudent') {
    const userId = Number(btn.dataset.id);
    try {
      const apps = await supa('applications', { match: { user_id: userId } }).catch(() => []);
      const app = apps[0];
      if (!app) return toast('This application could not be found.', 'error');
      if (isAccepted(app)) return toast('This student has already been accepted.');
      if (!canAccept(app)) return toast('Every required document must be uploaded before the student can be accepted.', 'error');

      const users = await supa('users', { match: { id: userId } }).catch(() => []);
      const user = users[0] || {};
      const studentId = user.student_id || await nextStudentId();

      await supa('applications', {
        method: 'PATCH',
        match: { user_id: userId },
        body: { status: Number(app.amount_paid || 0) > 0 ? 'Enrolled' : 'Enrollee' }
      });
      if (!user.student_id) {
        await supa('users', { method: 'PATCH', match: { id: userId }, body: { student_id: studentId } });
      }

      toast(`Student accepted as an Enrollee. Student ID ${studentId} issued.`);
      await regManageStudentModal(userId, 'documents', session.role === 'admin' ? 'ADMIN COPY' : 'REGISTRAR COPY');
      renderAll();
    } catch (err) {
      console.error(err);
      toast('Failed to accept the student.', 'error');
    }
    return;
  }

  if (action === 'accDeletePaymentLog') {
    const logId = Number(btn.dataset.id);
    const userId = Number(btn.dataset.student);
    if (!confirm('Delete this payment log? The student receipt for it is removed as well.')) return;

    try {
      const logs = await supa('payment_logs', { match: { id: logId } }).catch(() => []);
      const log = logs[0];
      if (!log) return toast('This payment log no longer exists.', 'error');

      const apps = await supa('applications', { match: { user_id: userId } }).catch(() => []);
      const app = apps[0];
      if (app) {
        const newPaid = Math.max(0, Number(app.amount_paid || 0) - Number(log.amount || 0));
        const body = { amount_paid: newPaid };
        // Losing the last payment puts an accepted student back to Enrollee.
        if (newPaid === 0 && isAccepted(app)) body.status = 'Enrollee';
        await supa('applications', { method: 'PATCH', match: { user_id: userId }, body });
      }

      await supa('payment_logs', { method: 'DELETE', match: { id: logId } });
      toast('Payment log deleted. The receipt is gone from the student portal.');
      renderAll();
    } catch (err) {
      console.error(err);
      toast('Failed to delete the payment log.', 'error');
    }
    return;
  }

  if (action === 'adminDeleteUser') {
    const userId = Number(btn.dataset.id);
    if (String(userId) === String(session.userId)) return toast('You cannot delete your own account.', 'error');
    if (!confirm('Delete this account? The student records, subjects and payment logs of a student account are deleted too. This cannot be undone.')) return;
    try {
      const users = await supa('users', { match: { id: userId } }).catch(() => []);
      if ((users[0] || {}).role === 'student') {
        await supa('student_subjects', { method: 'DELETE', match: { user_id: userId } });
        await supa('payment_logs', { method: 'DELETE', match: { user_id: userId } });
        await supa('applications', { method: 'DELETE', match: { user_id: userId } });
      }
      await supa('users', { method: 'DELETE', match: { id: userId } });
      toast('Account deleted.');
      renderAll();
    } catch (err) {
      console.error(err);
      toast('Failed to delete the account.', 'error');
    }
    return;
  }

  if (action === 'adminOpenRecord') {
    await regManageStudentModal(Number(btn.dataset.id), 'documents', 'ADMIN COPY');
    return;
  }

  if (action === 'adminDeleteRecord') {
    const userId = Number(btn.dataset.id);
    const name = btn.dataset.name || 'this student';
    if (!confirm(`Delete the application record of ${name}? Subject and payment records for that student are deleted too.`)) return;
    try {
      await supa('student_subjects', { method: 'DELETE', match: { user_id: userId } });
      await supa('payment_logs', { method: 'DELETE', match: { user_id: userId } });
      await supa('applications', { method: 'DELETE', match: { user_id: userId } });
      toast('Application record deleted.');
      renderAll();
    } catch (err) {
      console.error(err);
      toast('Failed to delete the record.', 'error');
    }
    return;
  }

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

  if (action === 'regCreatePrereq') {
    await regEditPrereqModal(null);
    return;
  }

  if (action === 'regEditPrereq') {
    await regEditPrereqModal(Number(btn.dataset.id));
    return;
  }

  if (action === 'regSavePrereq') {
    const id = document.getElementById('reg_prereq_id').value;
    const title = document.getElementById('reg_prereq_title').value.trim();
    const subjects = window.tempRegPrereqSubjects || [];
    const programIds = getPickedProgramIds(document.getElementById('regPrereqPrograms'));

    if (!title) return toast('A title is required.', 'error');
    if (subjects.length < 2) return toast('Add at least two subjects to form a sequence.', 'error');
    if (!programIds.length) return toast('Choose at least one program for this sequence.', 'error');

    const payload = {
      name: encodePrereqName(title, subjects.map(s => s.id), programIds),
      program_id: programIds.includes(0) ? 0 : programIds[0]
    };

    try {
      if (id) {
        await supa('presets', { method: 'PATCH', match: { id: Number(id) }, body: payload });
      } else {
        // Year level and semester are no longer part of a sequence; keep the
        // presets columns filled so inserts stay valid for existing schemas.
        await supa('presets', {
          method: 'POST',
          body: { ...payload, year_level: 1, semester: '1st Semester' }
        });
      }
      toast('Prerequisite set saved.');
      document.getElementById('regPrereqModal')?.remove();
      renderAll();
    } catch (err) {
      console.error(err);
      toast('Failed to save the prerequisite set.', 'error');
    }
    return;
  }

  if (action === 'regDeletePrereq') {
    const id = Number(btn.dataset.id);
    if (!confirm('Delete this prerequisite set?')) return;
    try {
      await supa('presets', { method: 'DELETE', match: { id } });
      toast('Prerequisite set deleted.');
      renderAll();
    } catch (err) { toast('Failed to delete.', 'error'); }
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
    const progIds = [...document.querySelectorAll('#regEditCourseProgs input:checked')]
      .map(input => Number(input.value))
      .filter(n => Number.isFinite(n));

    if (!code || !title || !units || !day || !start || !end) {
      return toast('Please fill out all fields.', 'error');
    }
    if (!progIds.length) return toast('Select at least one program for this subject.', 'error');

    const general = progIds.includes(0);
    const specific = progIds.filter(pid => pid !== 0);
    if (general && specific.length) return toast('Choose General or specific programs, not both.', 'error');

    const payload = {
      code: code,
      title: title,
      units: units,
      schedule_day: day,
      schedule_time: `${start} - ${end}`,
      program_id: general ? 0 : specific[0]
    };

    try {
      await supa('courses', { method: 'PATCH', match: { id: id }, body: payload });
      await saveCoursePrograms(id, specific);
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
      // Drop any extra program assignments for the deleted subject.
      await saveCoursePrograms(courseId, []).catch(() => {});
      toast('Subject deleted.');
      renderAll();
    } catch (err) {
      toast('Cannot delete subject. It might be tied to student records.', 'error');
    }
    return;
  }

  // ACCOUNTING ACTIONS
  if (action === 'accManageStudent') {
    await accountingManageStudentModal(Number(btn.dataset.id));
    return;
  }
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
  else if (key === 'regPresetFilterSem') { window.regPresetFilterSem = e.target.value; renderAll(); }
  else if (key === 'regPrereqFilterProg') { window.regPrereqFilterProg = e.target.value; renderAll(); }
  else if (key === 'regCourseFilterProg') { window.regCourseFilterProg = e.target.value; renderAll(); }
  else if (key === 'regLimitFilterProg') { window.regLimitFilterProg = e.target.value; renderAll(); }
  else if (key === 'regLimitFilterYear') { window.regLimitFilterYear = e.target.value; renderAll(); }
  else if (key === 'regLimitFilterSem') { window.regLimitFilterSem = e.target.value; renderAll(); }
  else if (key === 'regFilterProg') { window.regFilterProg = e.target.value; renderAll(); }
  else if (key === 'regFilterYear') { window.regFilterYear = e.target.value; renderAll(); }
  else if (key === 'regFilterStatus') { window.regFilterStatus = e.target.value; renderAll(); }
  else if (key === 'regDocStatus') {
    const studentId = Number(e.target.dataset.student);
    const docId = e.target.dataset.doc;
    const newStatus = e.target.value;

    try {
      const apps = await supa('applications', { match: { user_id: studentId } });
      const app = apps[0];
      const docStatus = app.doc_status || {};
      docStatus[docId] = newStatus;

      await supa('applications', { method: 'PATCH', match: { user_id: studentId }, body: { doc_status: docStatus } });
      toast('Document status updated.');
    } catch (err) { toast('Failed to update document status', 'error'); }
  }
});

// --- GLOBAL FORMS ---
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

  if (e.target.id === 'regStudentSearchForm') {
    const q = document.getElementById('regSearchInput').value;
    window.regSearch = q;
    renderAll();
    return;
  }

  if (e.target.id === 'regReturnForm') {
    const fd = new FormData(e.target);
    const userId = Number(fd.get('user_id'));
    const feedback = fd.get('feedback');

    try {
      await supa('applications', {
        method: 'PATCH',
        match: { user_id: userId },
        body: { returned: true, submitted: false, registrar_feedback: feedback }
      });
      toast('Application returned to student.');
      document.getElementById('regStudentModal')?.remove();
      renderAll();
    } catch (err) {
      toast('Failed to return application.', 'error');
    }
    return;
  }

  // REGISTRAR FORMS
  if (e.target.id === 'regCreateCourseForm') {
    const fd = new FormData(e.target);
    const start = fd.get('schedule_time_start');
    const end = fd.get('schedule_time_end');
    const timeStr = `${start} - ${end}`;

    const progIds = fd.getAll('program_ids').map(Number).filter(n => Number.isFinite(n));
    if (!progIds.length) return toast('Select at least one program for this subject.', 'error');

    const general = progIds.includes(0);
    const specific = progIds.filter(pid => pid !== 0);
    if (general && specific.length) return toast('Choose General or specific programs, not both.', 'error');

    const payload = {
      code: fd.get('code'),
      title: fd.get('title'),
      units: Number(fd.get('units')),
      schedule_day: fd.get('schedule_day'),
      schedule_time: timeStr,
      program_id: general ? 0 : specific[0]
    };

    try {
      const created = await supa('courses', { method: 'POST', body: payload });
      const newId = Array.isArray(created) && created[0] ? created[0].id : null;
      if (newId) await saveCoursePrograms(newId, specific);
      toast('Subject created successfully.');
      e.target.reset();
      renderAll();
    } catch (err) {
      toast('Failed to create subject. Check if code already exists.', 'error');
    }
    return;
  }

  if (e.target.id === 'regProgramForm') {
    const fd = new FormData(e.target);
    const id = fd.get('program_id');

    try {
      await saveProgram({
        id: id ? Number(id) : null,
        code: fd.get('code'),
        name: fd.get('name'),
        years: fd.get('years')
      });
      await loadCatalog();
      toast(id ? 'Program updated.' : 'Program created.');
      document.getElementById('regProgramModal')?.remove();
      renderAll();
    } catch (err) {
      console.error(err);
      toast(err.message || 'Failed to save the program.', 'error');
    }
    return;
  }

  if (e.target.id === 'regProgramUnitLimitsForm') {
    const fd = new FormData(e.target);
    const programId = fd.get('program_id');
    const values = {};
    for (const [key, value] of fd.entries()) {
      if (key.startsWith('year_')) values[key.slice(5)] = value;
    }

    try {
      await saveProgramUnitLimits(programId, values);
      await loadCatalog();
      toast('Unit limits saved.');
      document.getElementById('regUnitLimitModal')?.remove();
      renderAll();
    } catch (err) {
      console.error(err);
      toast(err.message || 'Failed to save the unit limits.', 'error');
    }
    return;
  }

  if (e.target.id === 'adminCreateUserForm') {
    const fd = new FormData(e.target);
    try {
      await createStaffUser({
        name: fd.get('name'),
        email: fd.get('email'),
        password: fd.get('password'),
        role: fd.get('role')
      });
      toast('Staff account created.');
      e.target.reset();
      renderAll();
    } catch (err) {
      console.error(err);
      toast(err.message || 'Failed to create the account.', 'error');
    }
    return;
  }

  if (e.target.id === 'regAcademicTermForm') {
    const fd = new FormData(e.target);
    try {
      await saveAcademicTerm({ semester: fd.get('semester'), schoolYear: fd.get('school_year') });
      await loadCatalog();
      toast('Current academic term updated.');
      renderAll();
    } catch (err) {
      console.error(err);
      toast(err.message || 'Failed to save the current term.', 'error');
    }
    return;
  }

  // ACCOUNTING FORMS
  if (e.target.id === 'accountingSettingsForm') {
    const fd = new FormData(e.target);
    try {
      await supa('system_settings', {
        method: 'PATCH',
        match: { id: 1 },
        body: {
          tuition_per_unit: Number(fd.get('tuition_per_unit')),
          misc_fee: Number(fd.get('misc_fee')),
          reg_fee: Number(fd.get('reg_fee'))
        }
      });
      toast('Settings updated successfully.');
    } catch (err) {
      toast('Failed to update settings.', 'error');
    }
    return;
  }

  if (e.target.id === 'inPersonPaymentForm') {
    const fd = new FormData(e.target);
    const userId = Number(fd.get('user_id'));
    const amount = Number(fd.get('amount'));
    const currentPaid = Number(fd.get('current_paid'));
    const totalAssessment = Number(fd.get('total_assessment'));

    if (!Number.isFinite(amount) || amount <= 0) return toast('Amount must be greater than 0', 'error');
    if (totalAssessment > 0 && amount > totalAssessment - currentPaid + 0.001) {
      return toast('That is more than the remaining balance.', 'error');
    }

    try {
      const newPaid = currentPaid + amount;
      const refNo = 'PAY-ACC-' + Date.now().toString().slice(-6);

      // A payment on an accepted student makes them officially enrolled.
      const studentApps = await supa('applications', { match: { user_id: userId } }).catch(() => []);
      const accepted = isAccepted(studentApps[0]);
      await supa('applications', {
        method: 'PATCH',
        match: { user_id: userId },
        body: accepted ? { amount_paid: newPaid, status: 'Enrolled' } : { amount_paid: newPaid }
      });

      await supa('payment_logs', {
        method: 'POST',
        body: {
          user_id: userId,
          amount: amount,
          reference_no: refNo,
          payment_type: fd.get('payment_type'),
          processed_by: 'Accounting'
        }
      });

      toast('In-person payment recorded.');
      document.getElementById('accStudentModal')?.remove();
      renderAll();
    } catch (err) {
      console.error(err);
      toast('Failed to record payment.', 'error');
    }
    return;
  }
});

window.logout = () => { doLogout(() => renderAll()); };

// Expose renderAll globally
window.renderAll = renderAll;

/* =========================================================================
   MOBILE NAV, TABLE LABELS, DIALOG ACCESSIBILITY
   ========================================================================= */

window.toggleRoleNav = (btn) => {
  const sidebar = btn.closest('.role-sidebar');
  if (!sidebar) return;
  const open = sidebar.classList.toggle('nav-open');
  btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  btn.setAttribute('aria-label', open ? 'Close navigation menu' : 'Open navigation menu');
  btn.textContent = open ? '\u2715' : '\u2630';
};

/* Copy each column header onto its cells so the phone card layout has labels. */
function labelTableCells() {
  document.querySelectorAll('table.rp-table').forEach((table) => {
    const headers = [...table.querySelectorAll('thead th')].map(th => th.textContent.trim());
    if (!headers.length) return;
    table.querySelectorAll('tbody tr').forEach((row) => {
      [...row.children].forEach((cell, index) => {
        if (cell.tagName !== 'TD' || cell.dataset.label || cell.hasAttribute('colspan')) return;
        if (headers[index]) cell.dataset.label = headers[index];
      });
    });
  });
}

let returnFocusTo = null;

function focusableIn(root) {
  return [...root.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
    .filter(el => el.offsetParent !== null || el === document.activeElement);
}

function labelIconButtons(root) {
  root.querySelectorAll('button:not([aria-label])').forEach((btn) => {
    const text = btn.textContent.trim();
    if (/^[\u2715\u00d7]$/.test(text)) {
      btn.setAttribute('aria-label', btn.closest('.rp-modal-head') ? 'Close dialog' : 'Remove');
    } else if (btn.title && text.length <= 2) {
      btn.setAttribute('aria-label', btn.title);
    }
  });
}

function setupDialog(backdrop) {
  if (backdrop.dataset.enhanced) return;
  const dialog = backdrop.querySelector('.rp-modal');
  if (!dialog) return;
  backdrop.dataset.enhanced = '1';

  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('tabindex', '-1');
  const heading = dialog.querySelector('.rp-modal-head h3');
  if (heading && !dialog.getAttribute('aria-label')) {
    dialog.setAttribute('aria-label', heading.textContent.trim());
  }
  labelIconButtons(dialog);

  returnFocusTo = document.activeElement;
  const first = focusableIn(dialog)[0] || dialog;
  first.focus({ preventScroll: true });
}

function refreshEnhancements() {
  labelTableCells();
  labelIconButtons(document);
  refreshProgramPickers(document);
  document.querySelectorAll('.rp-modal-backdrop').forEach(setupDialog);

  if (!document.querySelector('.rp-modal-backdrop')) {
    if (returnFocusTo && document.contains(returnFocusTo)) returnFocusTo.focus({ preventScroll: true });
    returnFocusTo = null;
  }
}

let enhanceQueued = false;
const enhanceObserver = new MutationObserver(() => {
  if (enhanceQueued) return;
  enhanceQueued = true;
  requestAnimationFrame(() => { enhanceQueued = false; refreshEnhancements(); });
});
enhanceObserver.observe(document.body, { childList: true, subtree: true });
refreshEnhancements();

document.addEventListener('keydown', (e) => {
  const backdrops = [...document.querySelectorAll('.rp-modal-backdrop')];
  if (!backdrops.length) return;
  const top = backdrops[backdrops.length - 1];
  const dialog = top.querySelector('.rp-modal');
  if (!dialog) return;

  if (e.key === 'Escape') {
    e.preventDefault();
    top.remove();
    return;
  }

  if (e.key === 'Tab') {
    const items = focusableIn(dialog);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
});

window.currentView = 'dashboard';
window.currentStep = 1;
window.facultySearch = '';
window.facultyFilterYear = '';
window.facultyFilterProg = '';
window.regSearch = '';
window.regFilterProg = '';
window.regFilterYear = '';
window.regFilterStatus = '';
window.regPresetFilterProg = 'all';
window.regPresetFilterYear = 'all';
window.regPresetFilterSem = 'all';
window.regPrereqFilterProg = 'all';
window.regCourseFilterProg = 'all';
window.facultySelectedStudent = null;
window.facultyPrereqErrors = [];
window.accSearch = '';
renderAll();
