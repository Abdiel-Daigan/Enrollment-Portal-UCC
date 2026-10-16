/* =========================================================================
   UNIDA CHRISTIAN COLLEGES — Enrollment Portal
   Roles: student / admin / faculty
   Storage: localStorage (SQL-simulated) — swap for PHP/MySQL API later
   ========================================================================= */

/* ============================ UTILS ============================ */
const SUPABASE_URL = 'https://oysqcmgdpmmhyaxxvjbl.supabase.co';       // paste your Project URL
const SUPABASE_KEY = 'sb_publishable_DZyDoTCghbN0VccKWIFMlw_R1a5tlW1';                     // paste your anon key

async function supa(table, options = {}) {
  const { method = 'GET', body, match } = options;
  let url = `${SUPABASE_URL}/rest/v1/${table}`;
  if (match) {
    const q = Object.entries(match).map(([k, v]) => `${k}=eq.${encodeURIComponent(v)}`).join('&');
    url += '?' + q;
  }
  const res = await fetch(url, {
    method,
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY,
      'Content-Type': 'application/json',
      'Prefer': method === 'POST' ? 'return=representation' : ''
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) throw new Error(await res.text());
  return method === 'DELETE' ? true : res.json();
}

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

const nowISO = () => new Date().toISOString();
const today  = () => new Date().toISOString().slice(0, 10);

const fmtDate = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
};

function hash(pw) {
  let h = 5381;
  const s = pw + '::ucc$salt';
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) + s.charCodeAt(i);
    h = h & 0xffffffff;
  }
  return 'sim$' + Math.abs(h).toString(16);
}

function initials(name) {
  return String(name || '?').trim().split(/\s+/).slice(0, 2)
    .map((w) => w[0]).join('').toUpperCase();
}
/* ---------- API (PHP + MySQL backend) ---------- */
const API_URL = 'https://bscs3rdyear2026-ucc-portal.infinityfreeapp.com/api.php';

async function api(action, body = null) {
  const options = {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json' }
  };
  if (body) options.body = JSON.stringify(body);
  const res = await fetch(API_URL + '?action=' + action, options);
  return res.json();
}

function toast(msg, type = 'success') {
  const el = document.createElement('div');
  el.className = 'toast toast-' + type;
  el.textContent = msg;
  $('#toastRoot').appendChild(el);
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 350);
  }, 3200);
}

function downloadCSV(filename, rows) {
  const csv = rows.map((r) =>
    r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')
  ).join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* ============================ CONSTANTS ============================ */

const DB_KEY = 'ucc_db_v1';
const SESSION_KEY = 'ucc_session_v1';

const PROGRAMS = [
  { id: 1, code: 'BEEd', name: 'Bachelor of Elementary Education (Generalist)' },
  { id: 2, code: 'BSEd', name: 'Bachelor of Secondary Education Major in English' },
  { id: 3, code: 'BSEd', name: 'Bachelor of Secondary Education Major in Social Studies' },
  { id: 4, code: 'BSEd', name: 'Bachelor of Secondary Education Major in Values Education' },
  { id: 5, code: 'CTP',  name: 'Certificate in Teaching Program (18 Units)' },
  { id: 6, code: 'BSBA', name: 'Bachelor of Science in Business Administration Major in Operation Management' },
  { id: 7, code: 'BSBA', name: 'Bachelor of Science in Business Administration Major in Human Resource Management' },
  { id: 8, code: 'BSCS', name: 'Bachelor of Science in Computer Science' },
  { id: 9, code: 'ACT',  name: 'Associate in Computer Technology with Specialization in Application Development' }
];

const REGIONS = [
  'Region I — Ilocos Region','Region II — Cagayan Valley','Region III — Central Luzon',
  'Region IV-A — CALABARZON','Region IV-B — MIMAROPA','Region V — Bicol Region',
  'Region VI — Western Visayas','Region VII — Central Visayas','Region VIII — Eastern Visayas',
  'Region IX — Zamboanga Peninsula','Region X — Northern Mindanao','Region XI — Davao Region',
  'Region XII — SOCCSKSARGEN','Region XIII — Caraga','NCR — National Capital Region',
  'CAR — Cordillera Administrative Region','BARMM — Bangsamoro Autonomous Region'
];

const DOCS_NEW = [
  { id: 'form138',   title: 'Original Report Card (Form 138)', desc: 'Upload a clear copy of your latest report card.' },
  { id: 'psa',       title: 'PSA Birth Certificate',           desc: 'Upload a clear copy of your PSA Birth Certificate.' },
  { id: 'goodmoral', title: 'Good Moral',                       desc: 'Upload a clear copy of your Good Moral.' },
  { id: 'idpic',     title: '2x2 ID Picture',                   desc: 'Upload a recent 2x2 photo (white background).' }
];

const DOCS_TRANSFEREE = [
  { id: 'tor',       title: 'Original Transcript of Records', desc: 'Upload a clear copy of your original Transcript of Records.' },
  { id: 'psa',       title: 'PSA Birth Certificate',           desc: 'Upload a clear copy of your PSA Birth Certificate.' },
  { id: 'goodmoral', title: 'Good Moral',                       desc: 'Upload a clear copy of your Good Moral.' },
  { id: 'idpic',     title: '2x2 ID Picture',                   desc: 'Upload a recent 2x2 photo (white background).' }
];

const STEP_LABELS = [
  { id: 1, key: 'personal',  label: 'Personal Information',   icon: '👤' },
  { id: 2, key: 'education', label: 'Educational Background', icon: '🏛️' },
  { id: 3, key: 'program',   label: 'Program Choice',         icon: '⚙️' },
  { id: 4, key: 'documents', label: 'Upload Documents',       icon: '📄' },
  { id: 5, key: 'review',    label: 'Review & Submit',        icon: '✓' }
];

const NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'apply',     label: 'Apply' },
  { key: 'programs',  label: 'Programs' },
  { key: 'documents', label: 'Documents' },
  { key: 'review',    label: 'Review' }
];

const CREST_SVG = `
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <circle cx="50" cy="50" r="48" fill="#0d3f31"/>
  <circle cx="50" cy="50" r="42" fill="none" stroke="#d4af37" stroke-width="2"/>
  <text x="50" y="46" text-anchor="middle" fill="#d4af37" font-family="Georgia, serif" font-size="11" font-weight="700">UNIDA</text>
  <text x="50" y="59" text-anchor="middle" fill="#ffffff" font-family="Georgia, serif" font-size="7">CHRISTIAN</text>
  <text x="50" y="69" text-anchor="middle" fill="#ffffff" font-family="Georgia, serif" font-size="7">COLLEGES</text>
</svg>`;

/* ============================ STATE ============================ */

let db = null;
let session = null;

const state = {
  authTab: 'login',
  view: 'dashboard',
  step: 1,
  roleView: 'dashboard',
  studentSearch: '',
  courseSearch: '',
  facultySection: null,
  facultyStudent: null
};

/* ============================ DATABASE ============================ */

function seedDatabase() {
  const now = nowISO();
  const d = {
    users: [],
    applications: [],
    courses: [],
    sections: [],
    enrollments: [],
    student_subjects: [],
    departments: [
      { id: 1, name: 'Admission Office', description: 'Handles new student applications and initial enrollment.' },
      { id: 2, name: 'Registrar',        description: 'Maintains academic records, schedules and transcripts.' },
      { id: 3, name: 'Accounting',       description: 'Processes tuition assessment and payments.' }
    ]
  };

  /* Users: 1 admin, 3 faculty, 1 student demo */
  d.users.push({
    id: 1, name: 'Registrar Admin', email: 'admin@ucc.edu.ph',
    password_hash: hash('admin123'), role: 'admin', created_at: now
  });
  d.users.push({
    id: 2, name: 'Prof. Maria Santos', email: 'faculty@ucc.edu.ph',
    password_hash: hash('faculty123'), role: 'faculty', created_at: now
  });
  d.users.push({
    id: 3, name: 'Prof. John Reyes', email: 'jreyes@ucc.edu.ph',
    password_hash: hash('faculty123'), role: 'faculty', created_at: now
  });
  d.users.push({
    id: 4, name: 'Carlos John Daniel R.', email: 'student@ucc.edu.ph',
    password_hash: hash('student123'), role: 'student', created_at: now
  });

  /* Sample courses for BSCS and BSBA */
  let cid = 1;
  const mkCourse = (code, title, units, program_id, dept_id) => {
    d.courses.push({ id: cid++, code, title, units, program_id, department_id: dept_id, course_date: now });
  };

  mkCourse('BSCS-101', 'Introduction to Computing',   3, 8, 2);
  mkCourse('BSCS-102', 'Programming 1',               3, 8, 2);
  mkCourse('BSCS-103', 'Discrete Mathematics',        3, 8, 2);
  mkCourse('BSCS-201', 'Data Structures & Algorithms',3, 8, 2);
  mkCourse('BSCS-202', 'Object-Oriented Programming', 3, 8, 2);
  mkCourse('BSBA-101', 'Fundamentals of Accounting',  3, 6, 3);
  mkCourse('BSBA-102', 'Business Mathematics',        3, 6, 3);
  mkCourse('BSBA-201', 'Financial Management',        3, 6, 3);
  mkCourse('BEEd-101', 'Child & Adolescent Dev',      3, 1, 2);
  mkCourse('BSEd-101', 'Foundations of Education',    3, 2, 2);

  /* Sections for those courses */
  let sid = 1;
  const mkSection = (course_id, sec, sched, room, cap, faculty_id) => {
    d.sections.push({
      id: sid++, course_id, section_name: sec, schedule: sched,
      capacity: cap, room, status: 'Open', faculty_id,
      created_at: now
    });
  };
  mkSection(1, 'A', 'MW 07:30-09:00', 'MB-101', 30, 2);
  mkSection(2, 'A', 'MW 09:00-10:30', 'LAB-1',  25, 2);
  mkSection(3, 'A', 'TTh 07:30-09:00','MB-102', 30, 3);
  mkSection(4, 'A', 'TTh 09:00-10:30','MB-201', 30, 2);
  mkSection(5, 'A', 'F 08:00-11:00',  'LAB-2',  25, 2);
  mkSection(6, 'A', 'MW 13:00-14:30', 'MB-202', 35, 3);
  mkSection(7, 'A', 'TTh 13:00-14:30','MB-102', 30, 3);

  /* Demo student application: partially filled */
  d.applications.push({
    id: 1, user_id: 4,
    personal: {
      first_name: 'Carlos John', middle_name: 'Daniel', last_name: 'R.',
      email: 'student@ucc.edu.ph', phone: '0917-000-0000',
      address: '123 Main St, Barangay Poblacion', region: 'NCR — National Capital Region', zip: '1000',
      civil_status: 'Single', sex: 'Male', dob: '2005-05-15', pob: 'Manila', religion: 'Catholic'
    },
    education: {
      elem:   { school: '', address: '', year: '' },
      jhs:    { school: '', address: '', year: '' },
      shs:    { school: 'UCC Senior High', address: 'Manila', year: '2023' },
      college:{ school: '', address: '', year: '' }
    },
    program: { preferred: '8' },
    documents: {},
    docType: null,
    submitted: false, submittedAt: null, reference: null, certified: false
  });

  /* Sample completed subjects for the demo student */
  d.student_subjects.push({
    id: 1, user_id: 4, course_id: 1, grade: '1.75',
    status: 'Passed', term: '1st Sem AY 2023-2024', recorded_at: now
  });
  d.student_subjects.push({
    id: 2, user_id: 4, course_id: 2, grade: '2.00',
    status: 'Passed', term: '1st Sem AY 2023-2024', recorded_at: now
  });

  return d;
}

function loadDB() {
  const raw = localStorage.getItem(DB_KEY);
  if (raw) {
    try { db = JSON.parse(raw); return; } catch (e) {}
  }
  db = seedDatabase();
  saveDB();
}

function saveDB() { localStorage.setItem(DB_KEY, JSON.stringify(db)); }

ffunction currentUser() {
  if (!session) return null;
  return {
    id: session.userId,
    name: session.name,
    email: session.email,
    role: session.role
  };
}

function currentApp() {
  const u = currentUser();
  if (!u) return null;
  let app = db.applications.find((a) => a.user_id === u.id);
  if (!app) {
    app = {
      id: db.applications.length + 1, user_id: u.id,
      personal: {}, education: {}, program: {}, documents: {},
      docType: null, submitted: false, submittedAt: null, reference: null, certified: false
    };
    db.applications.push(app);
    saveDB();
  }
  return app;
}

function computeCompletedSteps(app) {
  let done = 0;
  if (app.personal && app.personal.first_name) done = Math.max(done, 1);
  if (app.education && app.education.shs && app.education.shs.school) done = Math.max(done, 2);
  if (app.program && app.program.preferred) done = Math.max(done, 3);
  if (app.docType && app.documents) {
    const list = app.docType === 'new' ? DOCS_NEW : DOCS_TRANSFEREE;
    if (list.every((dd) => app.documents[dd.id])) done = Math.max(done, 4);
  }
  return done;
}

/* ============================ AUTH ============================ */

async function doLogin(form) {
  const fd = new FormData(form);
  const email = String(fd.get('email') || '').trim().toLowerCase();
  const pw = String(fd.get('password') || '');

  try {
    const rows = await supa('users', {
      match: { email: email, password_hash: hash(pw) }
    });
    if (!rows || !rows.length) return toast('Invalid email or password.', 'error');
    const user = rows[0];
    session = { userId: user.id, name: user.name, email: user.email, role: user.role };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    state.view = 'dashboard';
    state.roleView = 'dashboard';
    state.step = 1;
    toast('Welcome, ' + user.name.split(' ')[0] + '!');
    setTimeout(() => { window.location.reload(); }, 800);
    renderAll();
  } catch (err) {
    toast('Cannot reach the server.', 'error');
  }
}

async function doRegister(form) {
  const fd = new FormData(form);
  const name  = String(fd.get('name') || '').trim();
  const email = String(fd.get('email') || '').trim().toLowerCase();
  const pw    = String(fd.get('password') || '');
  const pw2   = String(fd.get('password2') || '');

  if (!name || !email || !pw) return toast('Please complete all fields.', 'error');
  if (pw.length < 6) return toast('Password must be at least 6 characters.', 'error');
  if (pw !== pw2) return toast('Passwords do not match.', 'error');

  try {
    const rows = await supa('users', {
      method: 'POST',
      body: { name, email, password_hash: hash(pw), role: 'student' }
    });
    const user = rows[0];
    session = { userId: user.id, name: user.name, email: user.email, role: user.role };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    state.view = 'dashboard';
    state.step = 1;
    toast('Account created. Welcome to UCC!');
    setTimeout(() => { window.location.reload(); }, 800);
    renderAll();
  } catch (err) {
    toast('Email already registered or connection failed.', 'error');
  }
}

function doLogout() {
  session = null;
  localStorage.removeItem(SESSION_KEY);
  state.view = 'dashboard';
  state.roleView = 'dashboard';
  state.step = 1;
  renderAll();
}

/* ============================ NAVBAR (student only) ============================ */

function renderNavbar() {
  const nav = $('#navbar');
  if (!session || session.role !== 'student') { nav.classList.add('hidden'); return; }
  nav.classList.remove('hidden');

  const u = currentUser();

  nav.innerHTML = `
    <div class="nav-brand">
      <div class="nav-crest">${CREST_SVG}</div>
      <div class="nav-brand-text">
        <span class="b1">UNIDA</span>
        <span class="b2">CHRISTIAN COLLEGES</span>
      </div>
    </div>
    <div class="nav-links">
      ${NAV_ITEMS.map((item) => `
        <button class="nav-link ${state.view === item.key ? 'active' : ''}"
                data-nav="${item.key}">${item.label}</button>
      `).join('')}
    </div>
    <div style="position:relative">
      <div class="nav-user" data-action="toggleUserMenu">👤</div>
      <div class="nav-user-menu ${state.showUserMenu ? 'open' : ''}"
           style="position:absolute;top:52px;right:0;background:#fff;color:var(--ink);border-radius:10px;
                  box-shadow:var(--shadow-lg);padding:8px;min-width:190px;display:${state.showUserMenu ? 'block' : 'none'}">
        <div style="padding:8px 12px 10px;border-bottom:1px solid var(--line);margin-bottom:6px">
          <strong style="display:block;font-size:13.5px">${esc(u.name)}</strong>
          <span style="font-size:11.5px;color:var(--muted)">${esc(u.email)}</span>
        </div>
        <button data-action="logout" style="width:100%;text-align:left;padding:9px 12px;border-radius:6px;font-size:13.5px;font-weight:600">Sign out</button>
      </div>
    </div>
  `;
}

/* ============================ AUTH PAGE ============================ */

function renderAuthPage() {
  const wrap = $('#authPage');
  wrap.classList.remove('hidden');
  const tab = state.authTab;

  wrap.innerHTML = `
    <div class="auth-card">
      <div class="auth-brand">
        <div class="brand-logo">UCC</div>
        <h1>Unida Christian Colleges</h1>
        <p class="brand-tag">Online Enrollment &amp; Student Records Portal</p>
        <ul class="brand-points">
          <li>✓ Apply online in 5 guided steps</li>
          <li>✓ Track your application progress</li>
          <li>✓ Upload and verify documents</li>
        </ul>
        <div class="brand-demo">
          <strong>Demo accounts</strong>
          <span>Student · student@ucc.edu.ph / student123</span>
          <span>Admin · admin@ucc.edu.ph / admin123</span>
          <span>Faculty · faculty@ucc.edu.ph / faculty123</span>
        </div>
      </div>

      <div class="auth-form">
        <div class="auth-tabs">
          <button class="auth-tab ${tab === 'login' ? 'active' : ''}"
                  data-action="authTab" data-tab="login">Sign In</button>
          <button class="auth-tab ${tab === 'register' ? 'active' : ''}"
                  data-action="authTab" data-tab="register">Register</button>
        </div>

        ${tab === 'login' ? `
          <form id="loginForm">
            <div class="field">
              <label>Email Address <span class="req">*</span></label>
              <input type="email" name="email" required placeholder="you@ucc.edu.ph">
            </div>
            <div class="field">
              <label>Password <span class="req">*</span></label>
              <input type="password" name="password" required placeholder="••••••••">
            </div>
            <button class="btn btn-primary btn-block" type="submit" style="margin-top:8px">
              Sign In →
            </button>
          </form>
        ` : `
          <form id="registerForm">
            <div class="field">
              <label>Full Name <span class="req">*</span></label>
              <input type="text" name="name" required placeholder="Juan Dela Cruz">
            </div>
            <div class="field">
              <label>Email Address <span class="req">*</span></label>
              <input type="email" name="email" required placeholder="you@example.com">
            </div>
            <div class="field-row">
              <div class="field">
                <label>Password <span class="req">*</span></label>
                <input type="password" name="password" required placeholder="Min 6 chars">
              </div>
              <div class="field">
                <label>Confirm Password <span class="req">*</span></label>
                <input type="password" name="password2" required placeholder="Repeat">
              </div>
            </div>
            <button class="btn btn-primary btn-block" type="submit" style="margin-top:8px">
              Create Student Account →
            </button>
          </form>
        `}
      </div>
    </div>
  `;
}

/* ============================ STUDENT DASHBOARD ============================ */

function renderStudentDashboard() {
  const app = currentApp();
  const completed = app.submitted ? 5 : computeCompletedSteps(app);

  return `
    <div class="college-banner">
      <div class="banner-text">
        <h2>The College Department</h2>
        <div class="banner-sub">Bold, Emerging, Resolute</div>
        <p>We're excited to be part of your journey.</p>
      </div>
      <div class="banner-img"></div>
    </div>

    <div class="progress-card">
      <h3>Enrollment Progress</h3>
      <div class="steps">
        ${STEP_LABELS.map((s) => {
          const isDone = s.id <= completed;
          const isActive = s.id === completed + 1 && !app.submitted;
          const cls = isDone ? 'done' : (isActive ? 'active' : '');
          return `
            <div class="step ${cls}">
              <div class="step-circle">${s.icon}</div>
              <div class="step-num">${s.id}</div>
              <div class="step-label">${s.label}</div>
            </div>
          `;
        }).join('')}
      </div>

      ${app.submitted ? `
        <div class="continue-bar">
          <div class="cb-icon">✓</div>
          <div class="cb-text">
            <h4>Application Submitted</h4>
            <p>Reference: <strong>${esc(app.reference)}</strong> · ${fmtDate(app.submittedAt)}</p>
          </div>
          <button class="btn btn-outline" data-nav="review">View Application</button>
        </div>
      ` : `
        <div class="continue-bar">
          <div class="cb-icon">👤</div>
          <div class="cb-text">
            <h4>Continue your application</h4>
            <p>Complete all required information and upload your documents to finish your enrollment.</p>
          </div>
          <button class="btn btn-primary" data-action="continueApp">Continue Application →</button>
        </div>
      `}
    </div>
  `;
}

/* ============================ STUDENT APPLY ============================ */

function renderApply() {
  const app = currentApp();
  const completed = computeCompletedSteps(app);
  const step = state.step;

  return `
    <div class="apply-layout">
      <aside class="apply-sidebar">
        ${STEP_LABELS.map((s) => {
          const isDone = s.id <= completed;
          const isActive = s.id === step;
          const cls = isActive ? 'active' : (isDone ? 'done' : '');
          return `
            <button class="sidebar-step ${cls}" data-action="gotoStep" data-step="${s.id}">
              <span class="ss-icon">${s.icon}</span>
              <span>${s.label}</span>
            </button>
          `;
        }).join('')}
      </aside>
      <section class="apply-main">
        ${app.submitted ? renderSuccess(app) : renderApplyStep(step, app)}
      </section>
    </div>
  `;
}

function renderApplyStep(step, app) {
  switch (step) {
    case 1: return renderStepPersonal(app);
    case 2: return renderStepEducation(app);
    case 3: return renderStepProgram(app);
    case 4: return renderStepDocuments(app);
    case 5: return renderStepReview(app);
    default: return renderStepPersonal(app);
  }
}

function renderStepPersonal(app) {
  const p = app.personal || {};
  return `
    <h2>Personal Information</h2>
    <p class="subtitle">Please fill out the required details. All information must be accurate.</p>
    <form id="stepForm" class="apply-form-body" data-step="1">
      <div class="field-row" style="grid-template-columns:1fr 1fr 1fr">
        <div class="field"><label>First Name <span class="req">*</span></label>
          <input name="first_name" required value="${esc(p.first_name || '')}"></div>
        <div class="field"><label>Middle Name</label>
          <input name="middle_name" value="${esc(p.middle_name || '')}"></div>
        <div class="field"><label>Last Name <span class="req">*</span></label>
          <input name="last_name" required value="${esc(p.last_name || '')}"></div>
      </div>
      <div class="field-row" style="grid-template-columns:2fr 1fr 1fr">
        <div class="field"><label>Address <span class="req">*</span></label>
          <input name="address" required value="${esc(p.address || '')}"></div>
        <div class="field"><label>Region <span class="req">*</span></label>
          <select name="region" required>
            <option value="">Select region</option>
            ${REGIONS.map((r) => `<option ${p.region === r ? 'selected' : ''}>${esc(r)}</option>`).join('')}
          </select></div>
        <div class="field"><label>ZIP Code <span class="req">*</span></label>
          <input name="zip" required value="${esc(p.zip || '')}"></div>
      </div>
      <div class="field-row" style="grid-template-columns:1.4fr 1fr 1fr 0.8fr">
        <div class="field"><label>Email <span class="req">*</span></label>
          <input type="email" name="email" required value="${esc(p.email || session.email)}"></div>
        <div class="field"><label>Cellphone <span class="req">*</span></label>
          <input name="phone" required value="${esc(p.phone || '')}"></div>
        <div class="field"><label>Civil Status <span class="req">*</span></label>
          <select name="civil_status" required>
            <option value="">Select</option>
            ${['Single','Married','Widowed','Separated'].map((v) => `<option ${p.civil_status === v ? 'selected' : ''}>${v}</option>`).join('')}
          </select></div>
        <div class="field"><label>Sex <span class="req">*</span></label>
          <select name="sex" required>
            <option value="">Select</option>
            ${['Male','Female'].map((v) => `<option ${p.sex === v ? 'selected' : ''}>${v}</option>`).join('')}
          </select></div>
      </div>
      <div class="field-row" style="grid-template-columns:1fr 1.6fr 1fr">
        <div class="field"><label>Date of Birth <span class="req">*</span></label>
          <input type="date" name="dob" required value="${esc(p.dob || '')}"></div>
        <div class="field"><label>Place of Birth <span class="req">*</span></label>
          <input name="pob" required value="${esc(p.pob || '')}"></div>
        <div class="field"><label>Religion</label>
          <input name="religion" value="${esc(p.religion || '')}"></div>
      </div>
    </form>
    <div class="apply-footer">
      <span></span>
      <button class="btn btn-primary" data-action="nextStep" data-step="1">Next →</button>
    </div>
  `;
}

function renderStepEducation(app) {
  const e = app.education || {};
  const yearOpts = (sel) => {
    const cur = new Date().getFullYear();
    let out = '<option value="">Select year</option>';
    for (let y = cur; y >= cur - 40; y--) out += `<option ${sel === String(y) ? 'selected' : ''}>${y}</option>`;
    return out;
  };
  const block = (key, title, prefix, req) => {
    const b = e[key] || {};
    return `
      <div class="edu-block">
        <h4>${title}</h4>
        <div class="field-row" style="grid-template-columns:1.4fr 1.4fr 0.6fr">
          <div class="field"><label>School Name ${req ? '<span class="req">*</span>' : ''}</label>
            <input name="${prefix}_school" ${req ? 'required' : ''} value="${esc(b.school || '')}"></div>
          <div class="field"><label>School Address ${req ? '<span class="req">*</span>' : ''}</label>
            <input name="${prefix}_address" ${req ? 'required' : ''} value="${esc(b.address || '')}"></div>
          <div class="field"><label>Year Graduated ${req ? '<span class="req">*</span>' : ''}</label>
            <select name="${prefix}_year" ${req ? 'required' : ''}>${yearOpts(b.year || '')}</select></div>
        </div>
      </div>`;
  };
  return `
    <h2>Educational Background</h2>
    <p class="subtitle">Please provide your previous school information.</p>
    <form id="stepForm" class="apply-form-body" data-step="2">
      ${block('elem', 'Elementary', 'elem', true)}
      ${block('jhs', 'Junior High School', 'jhs', true)}
      ${block('shs', 'Senior High School', 'shs', true)}
      ${block('college', 'College / University (if applicable)', 'college', false)}
    </form>
    <div class="apply-footer">
      <button class="btn btn-outline" data-action="prevStep" data-step="2">← Back</button>
      <button class="btn btn-primary" data-action="nextStep" data-step="2">Next →</button>
    </div>
  `;
}

function renderStepProgram(app) {
  const p = app.program || {};
  return `
    <h2>Program Choice</h2>
    <p class="subtitle">Select the program you wish to enroll in.</p>
    <form id="stepForm" class="apply-form-body" data-step="3">
      <div class="field" style="max-width:520px">
        <label>Preferred Program <span class="req">*</span></label>
        <select name="preferred" required>
          <option value="">Select a program</option>
          ${PROGRAMS.map((pr) => `
            <option value="${pr.id}" ${String(p.preferred) === String(pr.id) ? 'selected' : ''}>
              ${esc(pr.code)} — ${esc(pr.name)}
            </option>
          `).join('')}
        </select>
      </div>
      <div class="program-list" style="margin-top:20px">
        <h3>Programs Offered</h3>
        <p><strong>Bachelor of Elementary Education</strong> (Generalist)</p>
        <p><strong>Bachelor of Secondary Education Major in</strong></p>
        <ul><li>English</li><li>Social Studies</li><li>Values Education</li></ul>
        <p><strong>Certificate in Teaching Program</strong> (18 Units)</p>
        <p><strong>Bachelor of Science in Business Administration Major in Operation Management</strong></p>
        <p><strong>Bachelor of Science in Business Administration Major in Human Resource Management</strong></p>
        <p><strong>Bachelor of Science in Computer Science</strong></p>
        <p><strong>Associate in Computer Technology with Specialization in Application Development</strong></p>
      </div>
    </form>
    <div class="apply-footer">
      <button class="btn btn-outline" data-action="prevStep" data-step="3">← Back</button>
      <button class="btn btn-primary" data-action="nextStep" data-step="3">Next →</button>
    </div>
  `;
}

function renderStepDocuments(app) {
  if (!app.docType) {
    return `
      <h2>Upload Documents</h2>
      <p class="subtitle">Please upload the required documents in PDF, JPG, or PNG format.</p>
      <div class="doc-choices">
        <div class="doc-choice featured" data-action="chooseDocType" data-type="new">
          <div class="dc-icon">🎓</div>
          <h3>New Student</h3>
          <p>Upload your documents for freshman and new enrollees.</p>
          <button class="btn btn-primary" style="margin-top:6px">Continue →</button>
        </div>
        <div class="doc-choice" data-action="chooseDocType" data-type="transferee">
          <div class="dc-icon">👤</div>
          <h3>Transferee / Second Courser</h3>
          <p>Upload your documents for transferees and second coursers.</p>
          <button class="btn btn-outline" style="margin-top:6px">Continue →</button>
        </div>
      </div>
    `;
  }
  const docs = app.docType === 'new' ? DOCS_NEW : DOCS_TRANSFEREE;
  const title = app.docType === 'new' ? 'Upload Documents (New Student)' : 'Upload Documents (Transferee / Second Courser)';
  return `
    <h2>${title}</h2>
    <p class="subtitle">Please upload the required documents in PDF, JPG, or PNG format.</p>
    <div class="apply-form-body">
      ${docs.map((d) => {
        const has = app.documents && app.documents[d.id];
        return `
          <div class="upload-row">
            <div class="ur-text">
              <h4>${esc(d.title)}</h4>
              <p>${esc(d.desc)}</p>
            </div>
            <div class="ur-input">
              <label class="file-btn">
                ⬆ Choose File
                <input type="file" accept=".pdf,.jpg,.jpeg,.png"
                       data-upload="${d.id}" data-doc="${esc(d.title)}">
              </label>
              <span class="file-name ${has ? 'selected' : ''}" id="fn_${d.id}">
                ${has ? esc(has.name) : 'No file chosen'}
              </span>
            </div>
          </div>
        `;
      }).join('')}
    </div>
    <div class="apply-footer">
      <button class="btn btn-outline" data-action="changeDocType">← Back</button>
      <button class="btn btn-primary" data-action="nextStep" data-step="4">Next →</button>
    </div>
  `;
}

function renderStepReview(app) {
  const p = app.personal || {};
  const e = app.education || {};
  const pr = app.program || {};
  const prog = PROGRAMS.find((x) => String(x.id) === String(pr.preferred));
  const docs = app.docType === 'new' ? DOCS_NEW : DOCS_TRANSFEREE;
  const docCount = app.documents ? Object.keys(app.documents).length : 0;
  const fullName = [p.first_name, p.middle_name, p.last_name].filter(Boolean).join(' ');
  const shsName = e.shs ? e.shs.school : '—';

  return `
    <h2>Review & Submit</h2>
    <p class="subtitle">Please check your information carefully before submitting.</p>

    <div class="review-card">
      <div class="review-row">
        <div class="rr-icon">👤</div>
        <div class="rr-content">
          <h4>Personal Information</h4>
          <p>${esc(fullName || '—')}<br>${esc(p.phone || '—')}<br>${esc(p.email || '—')}</p>
        </div>
        <button class="rr-edit" data-action="gotoStep" data-step="1">✎ Edit</button>
      </div>
      <div class="review-row">
        <div class="rr-icon">🏛️</div>
        <div class="rr-content">
          <h4>Education Background</h4>
          <p>Senior High School<br>${esc(shsName)}</p>
        </div>
        <button class="rr-edit" data-action="gotoStep" data-step="2">✎ Edit</button>
      </div>
      <div class="review-row">
        <div class="rr-icon">⚙️</div>
        <div class="rr-content">
          <h4>Program Choice</h4>
          <p>${esc(prog ? prog.name : '—')}<br>${esc(prog ? prog.code : '')}</p>
        </div>
        <button class="rr-edit" data-action="gotoStep" data-step="3">✎ Edit</button>
      </div>
      <div class="review-row">
        <div class="rr-icon">📄</div>
        <div class="rr-content">
          <h4>Upload Documents</h4>
          <p>${docCount} of ${docs.length} documents uploaded.</p>
        </div>
        <button class="rr-edit" data-action="gotoStep" data-step="4">✎ Edit</button>
      </div>
    </div>

    <label class="certify ${app.certified ? 'checked' : ''}" id="certifyBox">
      <input type="checkbox" id="certifyCheck" ${app.certified ? 'checked' : ''}>
      <span class="check-box">${app.certified ? '✓' : ''}</span>
      <span class="cert-text">I certify that all information provided is true and correct to the best of my knowledge.</span>
    </label>

    <div class="apply-footer">
      <button class="btn btn-outline" data-action="prevStep" data-step="5">← Back</button>
      <button class="btn btn-gold" data-action="submitApplication">✈ Submit Application</button>
    </div>
  `;
}

function renderSuccess(app) {
  return `
    <div class="success-wrap">
      <div class="success-check">✓</div>
      <h2>Application Submitted!</h2>
      <p>Your enrollment application has been successfully submitted.
         We will review your information and get back to you via email within 3–5 days.</p>
      <div class="email-confirm">
        <div class="ec-icon">✉</div>
        <div class="ec-text">
          <p>A confirmation email has been sent to</p>
          <strong>${esc((app.personal && app.personal.email) || session.email)}</strong>
        </div>
      </div>
      <div class="success-actions">
        <button class="btn btn-primary" data-nav="dashboard">Go to Dashboard</button>
        <button class="btn btn-outline" data-action="viewApplication">View Application</button>
      </div>
    </div>
  `;
}

/* ============================ ROLE SHELL ============================ */

const ADMIN_VIEWS = {
  dashboard:   adminDashboard,
  students:    adminStudents,
  courses:     adminCourses,
  sections:    adminSections,
  enrollments: adminEnrollments,
  reports:     adminReports,
  setup:       adminSetup
};

const FACULTY_VIEWS = {
  dashboard: facultyDashboard,
  classes:   facultyClasses,
  progress:  facultyProgress
};

function renderRoleShell() {
  const user = currentUser();
  if (!user || user.role === 'student') return false;

  $('#authPage').classList.add('hidden');
  $('#pageWrap').classList.add('hidden');
  $('#navbar').classList.add('hidden');

  // Build role-shell on the fly (created lazily so index.html stays minimal)
  let shell = document.getElementById('roleShell');
  if (!shell) {
    shell = document.createElement('div');
    shell.id = 'roleShell';
    shell.className = 'role-shell';
    shell.innerHTML = `
      <aside id="roleSidebar" class="role-sidebar"></aside>
      <div class="role-main">
        <header id="roleTopbar" class="role-topbar"></header>
        <div id="roleContent" class="role-content"></div>
      </div>`;
    document.body.appendChild(shell);
  }
  shell.classList.remove('hidden');

  const navByRole = {
    admin: [
      { key: 'dashboard',   label: 'Dashboard',     icon: '🏠' },
      { key: 'students',    label: 'Students',      icon: '👥' },
      { key: 'courses',     label: 'Courses',       icon: '📚' },
      { key: 'sections',    label: 'Sections',      icon: '🏫' },
      { key: 'enrollments', label: 'Enrollments',   icon: '📝' },
      { key: 'reports',     label: 'Reports',       icon: '📊' },
      { key: 'setup',       label: 'Backend Setup', icon: '⚙️' }
    ],
    faculty: [
      { key: 'dashboard', label: 'Dashboard',        icon: '🏠' },
      { key: 'classes',   label: 'My Classes',       icon: '👥' },
      { key: 'progress',  label: 'Student Progress', icon: '✅' }
    ]
  };

  const items = navByRole[user.role] || [];
  if (!items.find((i) => i.key === state.roleView)) state.roleView = 'dashboard';

  const titles = {
    dashboard: 'Dashboard', students: 'Student Records', courses: 'Course Management',
    sections: 'Section Management', enrollments: 'Enrollment Records',
    reports: 'Reports & Analytics', setup: 'Backend Setup',
    classes: 'My Classes', progress: 'Student Progress'
  };

  const subForRole = user.role === 'admin'
    ? 'Registrar & Admission Office'
    : `${db.sections.filter((s) => s.faculty_id === user.id).length} assigned section(s)`;

  $('#roleSidebar').innerHTML = `
    <div class="role-side-brand">
      <div class="rsb-logo">UCC</div>
      <div><strong>Unida Christian</strong><span>Colleges</span></div>
    </div>
    <nav class="role-nav">
      ${items.map((n) => `
        <button class="role-nav-item ${state.roleView === n.key ? 'active' : ''}"
                data-role-nav="${n.key}">
          <span class="rni">${n.icon}</span>${n.label}
        </button>
      `).join('')}
    </nav>
    <div class="role-side-foot">
      <div class="role-tag">Signed in as ${esc(user.role)}</div>
      <button data-action="logout">Sign out</button>
    </div>
  `;

  $('#roleTopbar').innerHTML = `
    <div>
      <h1>${esc(titles[state.roleView] || 'Dashboard')}</h1>
      <div class="rt-sub">${esc(subForRole)}</div>
    </div>
    <div class="rt-user">
      <div class="rt-who">
        <strong>${esc(user.name)}</strong>
        <span>${esc(user.role)}</span>
      </div>
      <div class="rt-avatar">${esc(initials(user.name))}</div>
    </div>
  `;

  const view = user.role === 'admin' ? ADMIN_VIEWS[state.roleView] : FACULTY_VIEWS[state.roleView];
  $('#roleContent').innerHTML = view ? view() : '<div class="rp-empty">Page not found.</div>';
  return true;
}

/* ============================ ADMIN VIEWS ============================ */

function rpStat(value, label, sub, icon, gold = false) {
  return `
    <div class="rp-card rp-stat ${gold ? 'gold' : ''}">
      <div class="ic">${icon}</div>
      <div>
        <div class="val">${value}</div>
        <div class="lbl">${esc(label)}</div>
        ${sub ? `<div class="sub">${esc(sub)}</div>` : ''}
      </div>
    </div>`;
}

function adminDashboard() {
  const totalStudents = db.users.filter((u) => u.role === 'student').length;
  const submitted = db.applications.filter((a) => a.submitted).length;
  const pending = db.applications.filter((a) => !a.submitted && a.personal && a.personal.first_name).length;
  const totalCourses = db.courses.length;
  const totalSections = db.sections.length;
  const totalEnroll = db.enrollments.length;

  const recent = db.applications.slice(-5).reverse();

  const byProgram = PROGRAMS.map((p) => ({
    p,
    count: db.applications.filter((a) => String(a.program && a.program.preferred) === String(p.id)).length
  })).filter((b) => b.count > 0);
  const maxCount = Math.max(1, ...byProgram.map((b) => b.count));

  return `
    <div class="rp-grid-4">
      ${rpStat(totalStudents, 'Registered Students', 'Accounts with student role', '👥')}
      ${rpStat(submitted, 'Submitted Applications', `${pending} in progress`, '📋', true)}
      ${rpStat(totalCourses, 'Total Courses', `${totalSections} section(s) · ${totalEnroll} enrollments`, '📚')}
      ${rpStat(db.departments.length, 'Departments', 'Admission · Registrar · Accounting', '🏢', true)}
    </div>

    ${pending ? `
      <div class="rp-notice gold">
        <span>⏳</span>
        <span><strong>${pending}</strong> application(s) are still in progress. Track them under <strong>Students</strong>.</span>
      </div>` : ''}

    <div class="rp-grid-2">
      <div class="rp-card">
        <div class="rp-card-head"><h3>Applications by Program</h3></div>
        ${byProgram.length ? byProgram.map((b) => `
          <div style="margin-bottom:14px">
            <div style="display:flex;justify-content:space-between;font-size:13.2px;margin-bottom:6px">
              <strong>${esc(b.p.code)} <span class="rp-hint">— ${esc(b.p.name)}</span></strong>
              <span>${b.count}</span>
            </div>
            <div class="rp-progress"><i style="width:${Math.round((b.count / maxCount) * 100)}%"></i></div>
          </div>`).join('') : '<div class="rp-empty">No applications yet.</div>'}
      </div>

      <div class="rp-card">
        <div class="rp-card-head"><h3>Recent Activity</h3><span class="rp-hint">Latest 5</span></div>
        ${recent.length ? recent.map((a) => {
          const u = db.users.find((x) => x.id === a.user_id);
          const name = a.personal && a.personal.first_name
            ? `${a.personal.first_name} ${a.personal.last_name || ''}`.trim()
            : (u ? u.name : 'Unknown');
          return `
            <div style="display:flex;justify-content:space-between;gap:10px;padding:9px 0;border-bottom:1px solid #eef7f3">
              <div>
                <div style="font-size:13.2px;font-weight:600">${esc(name)}</div>
                <div class="rp-hint">${esc(u ? u.email : '')}</div>
              </div>
              <span class="rp-badge ${a.submitted ? 'green' : 'gold'}">${a.submitted ? 'Submitted' : 'In Progress'}</span>
            </div>`;
        }).join('') : '<div class="rp-empty">No activity yet.</div>'}
      </div>
    </div>
  `;
}

function adminStudents() {
  const q = (state.studentSearch || '').toLowerCase();

  const rows = db.users
    .filter((u) => u.role === 'student')
    .map((u) => {
      const app = db.applications.find((a) => a.user_id === u.id) || {};
      const name = app.personal && app.personal.first_name
        ? `${app.personal.first_name} ${app.personal.middle_name || ''} ${app.personal.last_name || ''}`.trim()
        : u.name;
      const prog = PROGRAMS.find((p) => String(p.id) === String(app.program && app.program.preferred));
      return { u, app, name, prog };
    })
    .filter((r) => !q || r.name.toLowerCase().includes(q) || r.u.email.toLowerCase().includes(q));

  return `
    <div class="rp-toolbar">
      <div class="grow">
        <input class="rp-input" id="adminStudentSearch" placeholder="Search name or email…" value="${esc(state.studentSearch)}">
      </div>
      <button class="rp-btn rp-btn-ghost" data-action="adminExportCSV">⤓ Export CSV</button>
    </div>

    <div class="rp-table-wrap">
      <table class="rp-table">
        <thead>
          <tr><th>Name</th><th>Email</th><th>Program</th><th>Status</th><th>Reference</th><th style="text-align:right">Actions</th></tr>
        </thead>
        <tbody>
          ${rows.length ? rows.map((r) => `
            <tr>
              <td><strong>${esc(r.name)}</strong></td>
              <td>${esc(r.u.email)}</td>
              <td>${r.prog ? `<span class="rp-badge green">${esc(r.prog.code)}</span>` : '<span class="rp-badge grey">—</span>'}</td>
              <td><span class="rp-badge ${r.app.submitted ? 'green' : 'gold'}">${r.app.submitted ? 'Submitted' : 'In Progress'}</span></td>
              <td class="rp-hint">${esc(r.app.reference || '—')}</td>
              <td style="text-align:right">
                <button class="rp-btn rp-btn-primary rp-btn-sm" data-action="adminOpenStudent" data-id="${r.u.id}">Manage</button>
              </td>
            </tr>`).join('') : '<tr><td colspan="6" class="rp-empty">No students found.</td></tr>'}
        </tbody>
      </table>
    </div>
  `;
}

function adminCourses() {
  const q = (state.courseSearch || '').toLowerCase();
  const list = db.courses.filter((c) => !q || c.code.toLowerCase().includes(q) || c.title.toLowerCase().includes(q));

  return `
    <div class="rp-toolbar">
      <div class="grow">
        <input class="rp-input" id="adminCourseSearch" placeholder="Search code or title…" value="${esc(state.courseSearch)}">
      </div>
      <button class="rp-btn rp-btn-primary" data-action="adminNewCourse">＋ Add Course</button>
    </div>

    <div class="rp-table-wrap">
      <table class="rp-table">
        <thead>
          <tr><th>Code</th><th>Title</th><th>Units</th><th>Program</th><th>Department</th><th style="text-align:right">Actions</th></tr>
        </thead>
        <tbody>
          ${list.length ? list.map((c) => {
            const p = PROGRAMS.find((x) => String(x.id) === String(c.program_id));
            const d = db.departments.find((x) => x.id === c.department_id);
            return `
              <tr>
                <td><strong>${esc(c.code)}</strong></td>
                <td>${esc(c.title)}</td>
                <td>${c.units}</td>
                <td>${p ? `<span class="rp-badge green">${esc(p.code)}</span>` : '—'}</td>
                <td>${esc(d ? d.name : '—')}</td>
                <td style="text-align:right;white-space:nowrap">
                  <button class="rp-btn rp-btn-ghost rp-btn-sm" data-action="adminEditCourse" data-id="${c.id}">Edit</button>
                  <button class="rp-btn rp-btn-danger rp-btn-sm" data-action="adminDeleteCourse" data-id="${c.id}">Remove</button>
                </td>
              </tr>`;
          }).join('') : '<tr><td colspan="6" class="rp-empty">No courses.</td></tr>'}
        </tbody>
      </table>
    </div>
  `;
}

function adminSections() {
  const list = db.sections;
  return `
    <div class="rp-toolbar">
      <div class="grow"></div>
      <button class="rp-btn rp-btn-primary" data-action="adminNewSection">＋ Add Section</button>
    </div>
    <div class="rp-table-wrap">
      <table class="rp-table">
        <thead>
          <tr><th>Course</th><th>Section</th><th>Schedule</th><th>Room</th><th>Faculty</th><th>Capacity</th><th>Status</th><th style="text-align:right">Actions</th></tr>
        </thead>
        <tbody>
          ${list.length ? list.map((s) => {
            const c = db.courses.find((x) => x.id === s.course_id);
            const f = db.users.find((u) => u.id === s.faculty_id);
            return `
              <tr>
                <td><strong>${esc(c ? c.code : '—')}</strong><div class="rp-hint">${esc(c ? c.title : '')}</div></td>
                <td>${esc(s.section_name || 'A')}</td>
                <td>${esc(s.schedule || '—')}</td>
                <td>${esc(s.room || '—')}</td>
                <td>${esc(f ? f.name : '—')}</td>
                <td>${s.capacity || 30}</td>
                <td><span class="rp-badge ${s.status === 'Full' ? 'red' : 'green'}">${esc(s.status || 'Open')}</span></td>
                <td style="text-align:right;white-space:nowrap">
                  <button class="rp-btn rp-btn-ghost rp-btn-sm" data-action="adminEditSection" data-id="${s.id}">Edit</button>
                  <button class="rp-btn rp-btn-gold rp-btn-sm" data-action="adminToggleSection" data-id="${s.id}">${s.status === 'Full' ? 'Reopen' : 'Mark Full'}</button>
                  <button class="rp-btn rp-btn-danger rp-btn-sm" data-action="adminDeleteSection" data-id="${s.id}">✕</button>
                </td>
              </tr>`;
          }).join('') : '<tr><td colspan="8" class="rp-empty">No sections.</td></tr>'}
        </tbody>
      </table>
    </div>
  `;
}

function adminEnrollments() {
  const list = db.enrollments;
  return `
    <div class="rp-notice mint">
      <span>ℹ️</span>
      <span>Enrollments are created when a student completes the enrollment process. Remove them here if needed.</span>
    </div>
    <div class="rp-table-wrap">
      <table class="rp-table">
        <thead><tr><th>Student</th><th>Course</th><th>Section</th><th>Date</th><th>Status</th><th style="text-align:right">Actions</th></tr></thead>
        <tbody>
          ${list.length ? list.map((e) => {
            const u = db.users.find((x) => x.id === e.user_id);
            const sec = db.sections.find((x) => x.id === e.section_id);
            const c = sec && db.courses.find((x) => x.id === sec.course_id);
            return `
              <tr>
                <td>${esc(u ? u.name : '—')}</td>
                <td>${esc(c ? c.code : '—')} <span class="rp-hint">${esc(c ? c.title : '')}</span></td>
                <td>${esc(sec ? sec.section_name : '—')}</td>
                <td>${esc(e.enrollment_date || '—')}</td>
                <td><span class="rp-badge green">${esc(e.status || 'Enrolled')}</span></td>
                <td style="text-align:right">
                  <button class="rp-btn rp-btn-danger rp-btn-sm" data-action="adminRemoveEnrollment" data-id="${e.id}">Remove</button>
                </td>
              </tr>`;
          }).join('') : '<tr><td colspan="6" class="rp-empty">No enrollments yet.</td></tr>'}
        </tbody>
      </table>
    </div>
  `;
}

function adminReports() {
  const totalStudents = db.users.filter((u) => u.role === 'student').length;
  const submitted = db.applications.filter((a) => a.submitted).length;

  const byProgram = PROGRAMS.map((p) => ({
    p,
    count: db.applications.filter((a) => String(a.program && a.program.preferred) === String(p.id)).length
  })).filter((b) => b.count > 0);
  const maxCount = Math.max(1, ...byProgram.map((b) => b.count));

  return `
    <div class="rp-grid-4">
      ${rpStat(totalStudents, 'Total Students', 'All accounts', '👥')}
      ${rpStat(submitted, 'Submitted', 'Applications completed', '✅', true)}
      ${rpStat(db.courses.length, 'Courses', 'Active catalog', '📚')}
      ${rpStat(db.sections.length, 'Sections', 'Open + full', '🏫', true)}
    </div>

    <div class="rp-card" style="margin-bottom:20px">
      <div class="rp-card-head"><h3>Applications by Program</h3></div>
      ${byProgram.length ? byProgram.map((b) => `
        <div style="margin-bottom:14px">
          <div style="display:flex;justify-content:space-between;font-size:13.2px;margin-bottom:6px">
            <strong>${esc(b.p.code)} <span class="rp-hint">— ${esc(b.p.name)}</span></strong>
            <span>${b.count}</span>
          </div>
          <div class="rp-progress"><i style="width:${Math.round((b.count / maxCount) * 100)}%"></i></div>
        </div>`).join('') : '<div class="rp-empty">No data.</div>'}
    </div>

    <div class="rp-card">
      <div class="rp-card-head">
        <h3>Export</h3>
        <button class="rp-btn rp-btn-ghost rp-btn-sm" data-action="adminExportCSV">⤓ Download CSV</button>
      </div>
      <p style="font-size:13.4px;color:var(--muted)">Downloads a CSV of all student applications with program, status, and reference numbers.</p>
    </div>
  `;
}

function adminSetup() {
  return `
    <div class="rp-notice info">
      <span>⚙️</span>
      <span>GitHub Pages is <strong>static only</strong>. To use a real MySQL database you must host a PHP backend
      elsewhere (InfinityFree, 000webhost, or any PHP host). Follow the steps below.</span>
    </div>

    <div class="rp-card" style="margin-bottom:18px">
      <div class="rp-card-head"><h3>Step 1 — Create MySQL tables</h3></div>
      <p style="font-size:13.4px;margin-bottom:12px">Run this SQL in phpMyAdmin on your PHP host:</p>
      <pre class="rp-code">CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(160),
  email VARCHAR(160) UNIQUE,
  password_hash VARCHAR(255),
  role VARCHAR(20) DEFAULT 'student',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE courses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(30) UNIQUE,
  title VARCHAR(180),
  units TINYINT,
  program_id INT,
  department_id INT
);

CREATE TABLE sections (
  id INT AUTO_INCREMENT PRIMARY KEY,
  course_id INT,
  section_name VARCHAR(10) DEFAULT 'A',
  schedule VARCHAR(60),
  capacity INT DEFAULT 30,
  room VARCHAR(30),
  status VARCHAR(20) DEFAULT 'Open',
  faculty_id INT,
  FOREIGN KEY (course_id) REFERENCES courses(id)
);

CREATE TABLE enrollments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  section_id INT,
  enrollment_date DATE,
  status VARCHAR(20) DEFAULT 'Enrolled',
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (section_id) REFERENCES sections(id)
);</pre>
    </div>

    <div class="rp-card" style="margin-bottom:18px">
      <div class="rp-card-head"><h3>Step 2 — Upload config.php</h3></div>
      <pre class="rp-code">&lt;?php
// config.php — fill in your InfinityFree details
define('DB_HOST', 'sqlXXX.infinityfree.com');
define('DB_USER', 'if0_XXXXXXXX');
define('DB_PASS', 'your_password');
define('DB_NAME', 'if0_XXXXXXXX_ucc');

function db() {
  static $conn = null;
  if ($conn === null) {
    $conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
    if ($conn->connect_error) {
      http_response_code(500);
      die(json_encode(['error' => 'DB connection failed']));
    }
  }
  return $conn;
}
?&gt;</pre>
    </div>

    <div class="rp-card" style="margin-bottom:18px">
      <div class="rp-card-head"><h3>Step 3 — Upload api.php</h3></div>
      <pre class="rp-code">&lt;?php
header('Access-Control-Allow-Origin: https://YOUR-USERNAME.github.io');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');
require 'config.php';

$action = $_GET['action'] ?? '';

if ($action === 'courses') {
  $res = db()-&gt;query('SELECT * FROM courses ORDER BY code');
  $out = [];
  while ($row = $res-&gt;fetch_assoc()) $out[] = $row;
  echo json_encode($out);
  exit;
}

if ($action === 'enroll' && $_SERVER['REQUEST_METHOD'] === 'POST') {
  $in = json_decode(file_get_contents('php://input'), true);
  $stmt = db()-&gt;prepare('INSERT INTO enrollments (user_id, section_id, enrollment_date, status)
                          VALUES (?, ?, CURDATE(), "Enrolled")');
  $stmt-&gt;bind_param('ii', $in['user_id'], $in['section_id']);
  echo json_encode(['success' =&gt; $stmt-&gt;execute()]);
  exit;
}

echo json_encode(['error' =&gt; 'Unknown action']);</pre>
    </div>

    <div class="rp-card">
      <div class="rp-card-head"><h3>Step 4 — Point the frontend at your API</h3></div>
      <p style="font-size:13.4px;margin-bottom:12px">In <code>app.js</code>, add this helper and replace <code>localStorage</code> calls with it:</p>
      <pre class="rp-code">async function api(action, body) {
  const r = await fetch('https://YOUR-SITE.infinityfreeapp.com/api.php?action=' + action, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  return r.json();
}</pre>
    </div>
  `;
}

/* ============================ FACULTY VIEWS ============================ */

function facultyDashboard() {
  const user = currentUser();
  const mySections = db.sections.filter((s) => s.faculty_id === user.id);
  const uniqueStudents = new Set();
  mySections.forEach((sec) => {
    db.enrollments
      .filter((e) => e.section_id === sec.id && e.status !== 'Dropped')
      .forEach((e) => uniqueStudents.add(e.user_id));
  });
  const totalEnroll = db.enrollments.filter(
    (e) => mySections.some((sec) => sec.id === e.section_id) && e.status !== 'Dropped'
  ).length;

  return `
    <div class="rp-grid-4">
      ${rpStat(mySections.length, 'Assigned Sections', 'Current term', '🏫')}
      ${rpStat(uniqueStudents.size, 'Unique Students', 'Across all sections', '👥', true)}
      ${rpStat(totalEnroll, 'Total Enrollments', 'In your sections', '📝')}
      ${rpStat(mySections.filter((s) => s.status === 'Full').length, 'Full Sections', 'At capacity', '🔒', true)}
    </div>

    <div class="rp-card">
      <div class="rp-card-head"><h3>My Sections</h3><span class="rp-hint">Click to view class list</span></div>
      ${mySections.length ? `
        <div class="rp-grid-3">
          ${mySections.map((sec) => {
            const c = db.courses.find((x) => x.id === sec.course_id);
            const count = db.enrollments.filter((e) => e.section_id === sec.id && e.status !== 'Dropped').length;
            const pct = sec.capacity ? Math.round((count / sec.capacity) * 100) : 0;
            return `
              <div class="rp-card" style="box-shadow:none;border:1px solid var(--line)">
                <div style="display:flex;justify-content:space-between;gap:8px">
                  <div>
                    <div class="rp-hint" style="font-weight:700;color:var(--gold-600)">${esc(c ? c.code : '—')}</div>
                    <div style="font-weight:800;color:var(--mint-800);margin-top:2px">${esc(c ? c.title : '—')}</div>
                  </div>
                  <span class="rp-badge ${sec.status === 'Full' ? 'red' : 'green'}">${esc(sec.status || 'Open')}</span>
                </div>
                <div style="margin-top:12px;font-size:12.5px;color:var(--muted);display:grid;gap:5px">
                  <div>🕒 ${esc(sec.schedule || 'TBA')}</div>
                  <div>📍 Room ${esc(sec.room || 'TBA')}</div>
                  <div>👥 ${count} / ${sec.capacity || 30} students</div>
                </div>
                <div class="rp-progress" style="margin-top:10px"><i style="width:${pct}%"></i></div>
                <button class="rp-btn rp-btn-primary rp-btn-sm"
                        style="margin-top:12px;width:100%;justify-content:center"
                        data-action="facultyOpenSection" data-id="${sec.id}">View Class List</button>
              </div>`;
          }).join('')}
        </div>` : '<div class="rp-empty"><span class="big">🏫</span>No sections assigned yet.</div>'}
    </div>
  `;
}

function facultyClasses() {
  const user = currentUser();
  const mySections = db.sections.filter((s) => s.faculty_id === user.id);

  if (!mySections.length) {
    return `<div class="rp-card rp-empty"><span class="big">📭</span>No sections assigned.</div>`;
  }

  const activeId = Number(state.facultySection) || mySections[0].id;
  const active = mySections.find((s) => s.id === activeId) || mySections[0];
  const course = db.courses.find((x) => x.id === active.course_id);

  const roster = db.enrollments
    .filter((e) => e.section_id === active.id && e.status !== 'Dropped')
    .map((e) => {
      const u = db.users.find((x) => x.id === e.user_id);
      const app = db.applications.find((a) => a.user_id === e.user_id) || {};
      const prog = PROGRAMS.find((p) => String(p.id) === String(app.program && app.program.preferred));
      return { e, u, app, prog };
    })
    .filter((r) => r.u);

  return `
    <div class="rp-toolbar">
      <div class="grow">
        <select class="rp-input" data-change="facultySectionSelect">
          ${mySections.map((s) => {
            const c = db.courses.find((x) => x.id === s.course_id);
            return `<option value="${s.id}" ${s.id === active.id ? 'selected' : ''}>
              ${esc(c ? c.code + ' — ' + c.title : 'Section')} (Sec ${esc(s.section_name || 'A')})
            </option>`;
          }).join('')}
        </select>
      </div>
      <span class="rp-badge green">${roster.length} enrolled</span>
    </div>

    <div class="rp-card" style="margin-bottom:18px">
      <div class="rp-card-head">
        <div>
          <h3>${esc(course ? course.code + ' — ' + course.title : '—')}</h3>
          <div class="rp-hint">
            Section ${esc(active.section_name || 'A')} · ${esc(active.schedule || 'TBA')} ·
            Room ${esc(active.room || 'TBA')} · ${course ? course.units : 0} units
          </div>
        </div>
        <span class="rp-badge ${active.status === 'Full' ? 'red' : 'green'}">${esc(active.status || 'Open')}</span>
      </div>

      <div class="rp-table-wrap">
        <table class="rp-table">
          <thead>
            <tr><th>#</th><th>Student</th><th>Email</th><th>Program</th><th>Status</th><th style="text-align:right">Progress</th></tr>
          </thead>
          <tbody>
            ${roster.length ? roster.map((r, i) => `
              <tr>
                <td>${i + 1}</td>
                <td><strong>${esc(r.u.name)}</strong></td>
                <td>${esc(r.u.email)}</td>
                <td>${r.prog ? `<span class="rp-badge green">${esc(r.prog.code)}</span>` : '—'}</td>
                <td><span class="rp-badge green">${esc(r.e.status || 'Enrolled')}</span></td>
                <td style="text-align:right">
                  <button class="rp-btn rp-btn-ghost rp-btn-sm"
                          data-action="facultyCheckStudent" data-id="${r.u.id}">Check Subjects</button>
                </td>
              </tr>`).join('') : '<tr><td colspan="6" class="rp-empty">No students enrolled yet.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function facultyProgress() {
  const user = currentUser();
  const mySections = db.sections.filter((s) => s.faculty_id === user.id);
  const myStudentIds = new Set();
  mySections.forEach((sec) => {
    db.enrollments
      .filter((e) => e.section_id === sec.id && e.status !== 'Dropped')
      .forEach((e) => myStudentIds.add(e.user_id));
  });

  const allStudents = db.users.filter((u) => u.role === 'student');
  const list = allStudents.filter((u) => myStudentIds.has(u.id));

  if (!list.length) {
    return `<div class="rp-card rp-empty"><span class="big">🎓</span>No students in your sections yet.</div>`;
  }

  const selectedId = Number(state.facultyStudent) || list[0].id;
  const student = list.find((u) => u.id === selectedId) || list[0];

  const app = db.applications.find((a) => a.user_id === student.id) || {};
  const prog = PROGRAMS.find((p) => String(p.id) === String(app.program && app.program.preferred));

  const taken = db.student_subjects.filter((s) => s.user_id === student.id);
  const takenIds = taken.map((t) => t.course_id);
  const passedIds = taken.filter((t) => t.status === 'Passed').map((t) => t.course_id);

  const programCourses = prog
    ? db.courses.filter((c) => String(c.program_id) === String(prog.id))
    : db.courses;

  const canTake = programCourses.filter((c) => !takenIds.includes(c.id) && !passedIds.includes(c.id));

  return `
    <div class="rp-toolbar">
      <div class="grow">
        <select class="rp-input" data-change="facultyStudentSelect">
          ${list.map((u) => `<option value="${u.id}" ${u.id === student.id ? 'selected' : ''}>${esc(u.name)} — ${esc(u.email)}</option>`).join('')}
        </select>
      </div>
    </div>

    <div class="rp-grid-4" style="margin-bottom:20px">
      ${rpStat(taken.length, 'Subjects Taken', 'On record', '📗')}
      ${rpStat(passedIds.length, 'Subjects Passed', 'Cleared prerequisites', '✅', true)}
      ${rpStat(canTake.length, 'Available to Take', 'Not yet taken', '🎯')}
      ${rpStat(prog ? prog.code : '—', 'Program', prog ? prog.name : '—', '🎓', true)}
    </div>

    <div class="rp-card" style="margin-bottom:18px">
      <div class="rp-card-head">
        <div>
          <h3>${esc(student.name)}</h3>
          <div class="rp-hint">${esc(student.email)} · ${prog ? esc(prog.name) : 'No program'}</div>
        </div>
        <span class="rp-badge ${app.submitted ? 'green' : 'gold'}">${app.submitted ? 'Submitted' : 'In Progress'}</span>
      </div>
    </div>

    <div class="rp-grid-2">
      <div class="rp-card">
        <div class="rp-card-head"><h3>✅ Subjects Taken</h3></div>
        ${taken.length ? taken.map((t) => {
          const c = db.courses.find((x) => x.id === t.course_id);
          return `
            <div style="display:flex;justify-content:space-between;gap:10px;padding:9px 0;border-bottom:1px solid #eef7f3">
              <div>
                <div style="font-size:13.2px;font-weight:600">${esc(c ? c.code : '—')} — ${esc(c ? c.title : '')}</div>
                <div class="rp-hint">${esc(t.term || 'Recorded')}</div>
              </div>
              <div style="text-align:right">
                <div style="font-weight:800">${esc(t.grade || '—')}</div>
                <span class="rp-badge ${t.status === 'Passed' ? 'green' : 'red'}">${esc(t.status)}</span>
              </div>
            </div>`;
        }).join('') : '<div class="rp-empty" style="padding:16px">No subjects on record.</div>'}
      </div>

      <div class="rp-card">
        <div class="rp-card-head"><h3>🎯 Subjects They Can Take</h3></div>
        ${canTake.length ? canTake.map((c) => `
          <div style="display:flex;justify-content:space-between;gap:10px;padding:9px 0;border-bottom:1px solid #eef7f3">
            <div>
              <div style="font-size:13.2px;font-weight:600">${esc(c.code)} — ${esc(c.title)}</div>
              <div class="rp-hint">${c.units} units</div>
            </div>
            <span class="rp-badge gold">Available</span>
          </div>`).join('') : '<div class="rp-empty" style="padding:16px">No eligible subjects left.</div>'}
      </div>
    </div>
  `;
}

/* ============================ MODAL ============================ */

function openRoleModal({ title, body, footer = '', wide = false }) {
  let root = document.getElementById('roleModalRoot');
  if (!root) {
    root = document.createElement('div');
    root.id = 'roleModalRoot';
    document.body.appendChild(root);
  }
  root.innerHTML = `
    <div class="rp-modal-backdrop">
      <div class="rp-modal ${wide ? 'wide' : ''}">
        <div class="rp-modal-head">
          <h3>${esc(title)}</h3>
          <button class="rp-btn rp-btn-ghost rp-btn-sm" data-action="closeRoleModal">✕</button>
        </div>
        <div class="rp-modal-body">${body}</div>
        ${footer ? `<div class="rp-modal-foot">${footer}</div>` : ''}
      </div>
    </div>`;
}

function closeRoleModal() {
  const root = document.getElementById('roleModalRoot');
  if (root) root.innerHTML = '';
}

/* ============================ CLICK HANDLERS ============================ */

document.addEventListener('click', (e) => {
  // Click outside user menu → close it
  if (state.showUserMenu && !e.target.closest('.nav-user') && !e.target.closest('.nav-user-menu')) {
    state.showUserMenu = false;
    if (session && session.role === 'student') renderNavbar();
  }

  // Click backdrop → close role modal
  const backdrop = e.target.closest('.rp-modal-backdrop');
  if (backdrop && e.target === backdrop) { closeRoleModal(); return; }

  // Role sidebar nav
  const roleNav = e.target.closest('[data-role-nav]');
  if (roleNav) {
    state.roleView = roleNav.dataset.roleNav;
    renderRoleShell();
    return;
  }

  // Student navbar
  const navBtn = e.target.closest('[data-nav]');
  if (navBtn) {
    state.view = navBtn.dataset.nav;
    renderAll();
    return;
  }

  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;
  const id = Number(btn.dataset.id) || 0;

  switch (action) {
    case 'closeRoleModal': closeRoleModal(); break;

    case 'authTab':
      state.authTab = btn.dataset.tab;
      renderAuthPage();
      break;

    case 'toggleUserMenu':
      state.showUserMenu = !state.showUserMenu;
      renderNavbar();
      break;

    case 'logout':
      doLogout();
      break;

    case 'continueApp': {
      const app = currentApp();
      const next = app.submitted ? 5 : Math.min(computeCompletedSteps(app) + 1, 5);
      state.step = next;
      state.view = 'apply';
      renderAll();
      break;
    }

    case 'gotoStep':
      state.view = 'apply';
      state.step = Number(btn.dataset.step);
      renderAll();
      break;

    case 'nextStep': {
      if (!saveStep(Number(btn.dataset.step))) return;
      state.step = Math.min(Number(btn.dataset.step) + 1, 5);
      renderAll();
      break;
    }

    case 'prevStep': {
      if (!saveStep(Number(btn.dataset.step))) return;
      state.step = Math.max(Number(btn.dataset.step) - 1, 1);
      renderAll();
      break;
    }

    case 'chooseDocType': {
      const app = currentApp();
      app.docType = btn.dataset.type;
      if (!app.documents) app.documents = {};
      saveDB();
      renderAll();
      break;
    }

    case 'changeDocType': {
      const app = currentApp();
      app.docType = null;
      app.documents = {};
      saveDB();
      renderAll();
      break;
    }

    case 'submitApplication': {
  const app = currentApp();
  const chk = $('#certifyCheck');
  if (!chk || !chk.checked) return toast('Please certify that your information is correct.', 'error');
  app.certified = true;
  app.submitted = true;
  app.submittedAt = nowISO();
  app.reference = 'UCC-' + Date.now().toString().slice(-8);
  saveDB();

  // Save to MySQL in the background
  api('save_application', {
    user_id: session.userId,
    personal: app.personal,
    education: app.education,
    program: app.program,
    documents: app.documents,
    doc_type: app.docType,
    submitted: true,
    submitted_at: app.submittedAt,
    reference: app.reference
  }).catch(() => {});

  toast('Application submitted successfully!');
  renderAll();
  break;
}

    case 'viewApplication':
      state.view = 'apply';
      state.step = 5;
      renderAll();
      break;

    /* ---------- Admin actions ---------- */
    case 'adminOpenStudent': adminOpenStudentModal(id); break;

    case 'adminRemoveSubject': {
      const userId = Number(document.querySelector('#adminSubjectForm [name="user_id"]')?.value || 0);
      db.student_subjects = db.student_subjects.filter((s) => s.id !== id);
      saveDB();
      toast('Subject record removed.');
      if (userId) adminOpenStudentModal(userId);
      break;
    }

    case 'adminNewCourse': adminCourseFormModal(null); break;
    case 'adminEditCourse': adminCourseFormModal(db.courses.find((c) => c.id === id)); break;
    case 'adminDeleteCourse': {
      const c = db.courses.find((x) => x.id === id);
      if (!c) break;
      openRoleModal({
        title: 'Remove course?',
        body: `<p style="font-size:14px">Remove <strong>${esc(c.code)} — ${esc(c.title)}</strong> and all its sections/enrollments?</p>`,
        footer: `
          <button class="rp-btn rp-btn-ghost" data-action="closeRoleModal">Cancel</button>
          <button class="rp-btn rp-btn-danger" data-action="adminConfirmCourseDelete" data-id="${id}">Yes, remove</button>`
      });
      break;
    }
    case 'adminConfirmCourseDelete': {
      const sectionIds = db.sections.filter((s) => s.course_id === id).map((s) => s.id);
      db.enrollments = db.enrollments.filter((e) => !sectionIds.includes(e.section_id));
      db.sections = db.sections.filter((s) => s.course_id !== id);
      db.courses = db.courses.filter((c) => c.id !== id);
      saveDB();
      closeRoleModal();
      renderRoleShell();
      toast('Course removed.');
      break;
    }

    case 'adminNewSection': adminSectionFormModal(null); break;
    case 'adminEditSection': adminSectionFormModal(db.sections.find((s) => s.id === id)); break;
    case 'adminToggleSection': {
      const s = db.sections.find((x) => x.id === id);
      if (!s) break;
      s.status = s.status === 'Full' ? 'Open' : 'Full';
      saveDB();
      renderRoleShell();
      toast(`Section marked ${s.status}.`);
      break;
    }
    case 'adminDeleteSection': {
      db.enrollments = db.enrollments.filter((e) => e.section_id !== id);
      db.sections = db.sections.filter((s) => s.id !== id);
      saveDB();
      renderRoleShell();
      toast('Section deleted.');
      break;
    }

    case 'adminRemoveEnrollment':
      db.enrollments = db.enrollments.filter((e) => e.id !== id);
      saveDB();
      renderRoleShell();
      toast('Enrollment removed.');
      break;

    case 'adminExportCSV': {
      const rows = [['Name', 'Email', 'Program', 'Status', 'Reference']];
      db.users.filter((u) => u.role === 'student').forEach((u) => {
        const app = db.applications.find((a) => a.user_id === u.id) || {};
        const p = app.personal || {};
        const pr = app.program || {};
        const prog = PROGRAMS.find((x) => String(x.id) === String(pr.preferred));
        const name = p.first_name ? `${p.first_name} ${p.last_name || ''}`.trim() : u.name;
        rows.push([name, u.email, prog ? prog.code : '', app.submitted ? 'Submitted' : 'In Progress', app.reference || '']);
      });
      downloadCSV('ucc-students.csv', rows);
      toast('CSV downloaded.');
      break;
    }

    /* ---------- Faculty actions ---------- */
    case 'facultyOpenSection':
      state.facultySection = id;
      state.roleView = 'classes';
      renderRoleShell();
      break;

    case 'facultyCheckStudent':
      state.facultyStudent = id;
      state.roleView = 'progress';
      renderRoleShell();
      break;
  }
});

/* ============================ SUBMIT HANDLERS ============================ */

document.addEventListener('submit', (e) => {
  const f = e.target;
  if (f.id === 'loginForm') { e.preventDefault(); doLogin(f); return; }
  if (f.id === 'registerForm') { e.preventDefault(); doRegister(f); return; }

  if (f.id === 'adminCourseForm') {
    e.preventDefault();
    const fd = new FormData(f);
    const cid = Number(fd.get('id')) || 0;
    const payload = {
      code: String(fd.get('code')).trim(),
      title: String(fd.get('title')).trim(),
      units: Number(fd.get('units')),
      program_id: Number(fd.get('program_id')),
      department_id: Number(fd.get('department_id'))
    };
    if (db.courses.some((c) => c.code.toLowerCase() === payload.code.toLowerCase() && c.id !== cid)) {
      return toast('Course code already exists.', 'error');
    }
    if (cid) {
      Object.assign(db.courses.find((c) => c.id === cid), payload);
      toast('Course updated.');
    } else {
      const nid = db.courses.reduce((m, c) => Math.max(m, c.id), 0) + 1;
      db.courses.push({ id: nid, ...payload, course_date: nowISO() });
      toast('Course added.');
    }
    saveDB(); closeRoleModal(); renderRoleShell();
    return;
  }

  if (f.id === 'adminSectionForm') {
    e.preventDefault();
    const fd = new FormData(f);
    const sid = Number(fd.get('id')) || 0;
    const payload = {
      course_id: Number(fd.get('course_id')),
      section_name: String(fd.get('section_name')).trim().toUpperCase(),
      schedule: String(fd.get('schedule')).trim(),
      room: String(fd.get('room')).trim(),
      capacity: Number(fd.get('capacity')),
      faculty_id: Number(fd.get('faculty_id')) || null,
      status: String(fd.get('status'))
    };
    if (sid) {
      Object.assign(db.sections.find((s) => s.id === sid), payload);
      toast('Section updated.');
    } else {
      const nid = db.sections.reduce((m, s) => Math.max(m, s.id), 0) + 1;
      db.sections.push({ id: nid, ...payload, created_at: nowISO() });
      toast('Section added.');
    }
    saveDB(); closeRoleModal(); renderRoleShell();
    return;
  }

  if (f.id === 'adminSubjectForm') {
    e.preventDefault();
    const fd = new FormData(f);
    const userId = Number(fd.get('user_id'));
    const courseId = Number(fd.get('course_id'));
    const grade = String(fd.get('grade') || '').trim();
    const status = String(fd.get('status'));

    if (db.student_subjects.some((s) => s.user_id === userId && s.course_id === courseId)) {
      return toast('This subject is already on the student record.', 'error');
    }
    const nid = db.student_subjects.reduce((m, s) => Math.max(m, s.id), 0) + 1;
    db.student_subjects.push({
      id: nid, user_id: userId, course_id: courseId,
      grade: grade || null, status, term: 'Recorded by Admin',
      recorded_at: nowISO()
    });
    saveDB();
    toast('Subject record added.');
    adminOpenStudentModal(userId);
    return;
  }
});

/* ============================ CHANGE HANDLERS ============================ */

document.addEventListener('change', (e) => {
  const t = e.target;
  if (t.dataset && t.dataset.change === 'facultySectionSelect') {
    state.facultySection = Number(t.value);
    state.roleView = 'classes';
    renderRoleShell();
    return;
  }
  if (t.dataset && t.dataset.change === 'facultyStudentSelect') {
    state.facultyStudent = Number(t.value);
    renderRoleShell();
    return;
  }
  if (t.id === 'certifyCheck') {
    const app = currentApp();
    app.certified = t.checked;
    saveDB();
    const box = $('#certifyBox');
    if (box) {
      box.classList.toggle('checked', t.checked);
      const cbox = box.querySelector('.check-box');
      if (cbox) cbox.textContent = t.checked ? '✓' : '';
    }
  }
});

/* ============================ FILE UPLOAD ============================ */

document.addEventListener('change', (e) => {
  const input = e.target.closest('input[type="file"][data-upload]');
  if (!input) return;
  const file = input.files && input.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) {
    toast('File is too large. Maximum 5MB.', 'error');
    input.value = '';
    return;
  }
  const docId = input.dataset.upload;
  const docName = input.dataset.doc;
  const app = currentApp();
  if (!app.documents) app.documents = {};
  app.documents[docId] = {
    name: file.name, size: file.size, type: file.type, uploaded_at: nowISO()
  };
  saveDB();
  const label = document.getElementById('fn_' + docId);
  if (label) { label.textContent = file.name; label.classList.add('selected'); }
  toast(`${docName} uploaded.`);
});

/* ============================ LIVE SEARCH ============================ */

document.addEventListener('input', (e) => {
  if (e.target.id === 'adminStudentSearch') {
    state.studentSearch = e.target.value;
    clearTimeout(window.__t1);
    window.__t1 = setTimeout(() => {
      const pos = e.target.selectionStart;
      renderRoleShell();
      const next = document.getElementById('adminStudentSearch');
      if (next) { next.focus(); next.setSelectionRange(pos, pos); }
    }, 320);
  } else if (e.target.id === 'adminCourseSearch') {
    state.courseSearch = e.target.value;
    clearTimeout(window.__t2);
    window.__t2 = setTimeout(() => {
      const pos = e.target.selectionStart;
      renderRoleShell();
      const next = document.getElementById('adminCourseSearch');
      if (next) { next.focus(); next.setSelectionRange(pos, pos); }
    }, 320);
  }
});

/* ============================ STEP SAVE ============================ */

function saveStep(step) {
  const form = $('#stepForm');
  if (!form) return true;

  if (step === 1) {
    const fd = new FormData(form);
    const app = currentApp();
    app.personal = {
      first_name:   String(fd.get('first_name')   || '').trim(),
      middle_name:  String(fd.get('middle_name')  || '').trim(),
      last_name:    String(fd.get('last_name')    || '').trim(),
      address:      String(fd.get('address')      || '').trim(),
      region:       String(fd.get('region')       || '').trim(),
      zip:          String(fd.get('zip')          || '').trim(),
      email:        String(fd.get('email')        || '').trim(),
      phone:        String(fd.get('phone')        || '').trim(),
      civil_status: String(fd.get('civil_status') || '').trim(),
      sex:          String(fd.get('sex')          || '').trim(),
      dob:          String(fd.get('dob')          || '').trim(),
      pob:          String(fd.get('pob')          || '').trim(),
      religion:     String(fd.get('religion')     || '').trim()
    };
    saveDB();
    return true;
  }

  if (step === 2) {
    const fd = new FormData(form);
    const app = currentApp();
    app.education = {
      elem:   { school: String(fd.get('elem_school')   || '').trim(), address: String(fd.get('elem_address')   || '').trim(), year: String(fd.get('elem_year')   || '').trim() },
      jhs:    { school: String(fd.get('jhs_school')    || '').trim(), address: String(fd.get('jhs_address')    || '').trim(), year: String(fd.get('jhs_year')    || '').trim() },
      shs:    { school: String(fd.get('shs_school')    || '').trim(), address: String(fd.get('shs_address')    || '').trim(), year: String(fd.get('shs_year')    || '').trim() },
      college:{ school: String(fd.get('college_school')|| '').trim(), address: String(fd.get('college_address')|| '').trim(), year: String(fd.get('college_year')|| '').trim() }
    };
    saveDB();
    return true;
  }

  if (step === 3) {
    const fd = new FormData(form);
    const app = currentApp();
    app.program = { preferred: String(fd.get('preferred') || '').trim() };
    if (!app.program.preferred) { toast('Please select a program.', 'error'); return false; }
    saveDB();
    return true;
  }

  if (step === 4) {
    const app = currentApp();
    if (!app.docType) { toast('Please choose a document type.', 'error'); return false; }
    const docs = app.docType === 'new' ? DOCS_NEW : DOCS_TRANSFEREE;
    const missing = docs.filter((d) => !app.documents || !app.documents[d.id]);
    if (missing.length) { toast('Please upload all required documents.', 'error'); return false; }
    return true;
  }

  return true;
}

/* ============================ ADMIN MODALS ============================ */

function adminOpenStudentModal(userId) {
  const u = db.users.find((x) => x.id === userId);
  if (!u) return;
  const app = db.applications.find((a) => a.user_id === userId) || {};
  const p = app.personal || {};
  const e = app.education || {};
  const pr = app.program || {};
  const prog = PROGRAMS.find((x) => String(x.id) === String(pr.preferred));
  const fullName = p.first_name ? `${p.first_name} ${p.middle_name || ''} ${p.last_name || ''}`.trim() : u.name;

  const docs = app.docType === 'new' ? DOCS_NEW : DOCS_TRANSFEREE;
  const uploaded = app.documents ? Object.keys(app.documents).length : 0;

  const taken = db.student_subjects.filter((s) => s.user_id === userId);

  openRoleModal({
    title: `Student — ${fullName}`,
    wide: true,
    body: `
      <div class="rp-grid-2" style="margin-bottom:18px">
        <div>
          <h4 style="font-size:12.5px;text-transform:uppercase;letter-spacing:1px;color:var(--muted);margin-bottom:8px">Personal</h4>
          <div style="display:grid;gap:6px;font-size:13.4px">
            <div><strong>Name:</strong> ${esc(fullName)}</div>
            <div><strong>Email:</strong> ${esc(p.email || u.email)}</div>
            <div><strong>Phone:</strong> ${esc(p.phone || '—')}</div>
            <div><strong>Status:</strong> ${esc(p.civil_status || '—')} · ${esc(p.sex || '—')}</div>
            <div><strong>DOB:</strong> ${esc(p.dob || '—')}</div>
            <div><strong>Address:</strong> ${esc(p.address || '—')} ${esc(p.region || '')} ${esc(p.zip || '')}</div>
          </div>
        </div>
        <div>
          <h4 style="font-size:12.5px;text-transform:uppercase;letter-spacing:1px;color:var(--muted);margin-bottom:8px">Academic</h4>
          <div style="display:grid;gap:6px;font-size:13.4px">
            <div><strong>Program:</strong> ${prog ? esc(prog.code + ' — ' + prog.name) : '—'}</div>
            <div><strong>SHS:</strong> ${esc((e.shs && e.shs.school) || '—')}</div>
            <div><strong>Documents:</strong> ${uploaded} of ${docs ? docs.length : 0}</div>
            <div><strong>Application:</strong> ${app.submitted ? '<span class="rp-badge green">Submitted</span>' : '<span class="rp-badge gold">In Progress</span>'}</div>
            <div><strong>Reference:</strong> ${esc(app.reference || '—')}</div>
          </div>
        </div>
      </div>

      <h4 style="font-size:12.5px;text-transform:uppercase;letter-spacing:1px;color:var(--muted);margin:16px 0 8px">Subjects Taken</h4>
      ${taken.length ? `
        <div class="rp-table-wrap">
          <table class="rp-table">
            <thead><tr><th>Course</th><th>Grade</th><th>Term</th><th>Status</th><th></th></tr></thead>
            <tbody>
              ${taken.map((s) => {
                const c = db.courses.find((x) => x.id === s.course_id);
                return `<tr>
                  <td><strong>${esc(c ? c.code : '—')}</strong> ${esc(c ? c.title : '')}</td>
                  <td>${esc(s.grade || '—')}</td>
                  <td class="rp-hint">${esc(s.term || '—')}</td>
                  <td><span class="rp-badge ${s.status === 'Passed' ? 'green' : (s.status === 'Failed' ? 'red' : 'gold')}">${esc(s.status)}</span></td>
                  <td style="text-align:right">
                    <button class="rp-btn rp-btn-danger rp-btn-sm" data-action="adminRemoveSubject" data-id="${s.id}">Delete</button>
                  </td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>` : '<div class="rp-empty" style="padding:14px">No subjects recorded.</div>'}

      <h4 style="font-size:12.5px;text-transform:uppercase;letter-spacing:1px;color:var(--muted);margin:18px 0 8px">Record Completed Subject</h4>
      <form id="adminSubjectForm" style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end">
        <input type="hidden" name="user_id" value="${userId}">
        <div style="flex:2;min-width:200px">
          <label style="font-size:12.4px;font-weight:600;display:block;margin-bottom:5px">Course</label>
          <select class="rp-input" name="course_id" required>
            ${db.courses.map((c) => `<option value="${c.id}">${esc(c.code)} — ${esc(c.title)}</option>`).join('')}
          </select>
        </div>
        <div style="width:100px">
          <label style="font-size:12.4px;font-weight:600;display:block;margin-bottom:5px">Grade</label>
          <input class="rp-input" name="grade" placeholder="1.75">
        </div>
        <div style="width:140px">
          <label style="font-size:12.4px;font-weight:600;display:block;margin-bottom:5px">Status</label>
          <select class="rp-input" name="status">
            <option>Passed</option><option>Failed</option><option>In Progress</option>
          </select>
        </div>
        <button class="rp-btn rp-btn-primary" type="submit">Add</button>
      </form>
    `,
    footer: `<button class="rp-btn rp-btn-ghost" data-action="closeRoleModal">Close</button>`
  });
}

function adminCourseFormModal(course) {
  const isEdit = !!course;
  openRoleModal({
    title: isEdit ? 'Edit Course' : 'Add New Course',
    wide: true,
    body: `
      <form id="adminCourseForm">
        <input type="hidden" name="id" value="${isEdit ? course.id : ''}">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
          <div>
            <label style="font-size:12.6px;font-weight:600;display:block;margin-bottom:5px">Course Code *</label>
            <input class="rp-input" name="code" required value="${isEdit ? esc(course.code) : ''}" placeholder="BSCS-101">
          </div>
          <div>
            <label style="font-size:12.6px;font-weight:600;display:block;margin-bottom:5px">Units *</label>
            <input class="rp-input" name="units" type="number" min="1" max="12" required value="${isEdit ? course.units : 3}">
          </div>
        </div>
        <div style="margin-top:14px">
          <label style="font-size:12.6px;font-weight:600;display:block;margin-bottom:5px">Descriptive Title *</label>
          <input class="rp-input" name="title" required value="${isEdit ? esc(course.title) : ''}">
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:14px">
          <div>
            <label style="font-size:12.6px;font-weight:600;display:block;margin-bottom:5px">Program *</label>
            <select class="rp-input" name="program_id" required>
              ${PROGRAMS.map((p) => `<option value="${p.id}" ${isEdit && String(course.program_id) === String(p.id) ? 'selected' : ''}>${esc(p.code)} — ${esc(p.name)}</option>`).join('')}
            </select>
          </div>
          <div>
            <label style="font-size:12.6px;font-weight:600;display:block;margin-bottom:5px">Department *</label>
            <select class="rp-input" name="department_id" required>
              ${db.departments.map((d) => `<option value="${d.id}" ${isEdit && course.department_id === d.id ? 'selected' : ''}>${esc(d.name)}</option>`).join('')}
            </select>
          </div>
        </div>
      </form>`,
    footer: `
      <button class="rp-btn rp-btn-ghost" data-action="closeRoleModal">Cancel</button>
      <button class="rp-btn rp-btn-primary" type="submit" form="adminCourseForm">${isEdit ? 'Save changes' : 'Create course'}</button>`
  });
}

function adminSectionFormModal(section) {
  const isEdit = !!section;
  const faculty = db.users.filter((u) => u.role === 'faculty');

  openRoleModal({
    title: isEdit ? 'Edit Section' : 'Add Section',
    wide: true,
    body: `
      <form id="adminSectionForm">
        <input type="hidden" name="id" value="${isEdit ? section.id : ''}">
        <div style="margin-bottom:14px">
          <label style="font-size:12.6px;font-weight:600;display:block;margin-bottom:5px">Course *</label>
          <select class="rp-input" name="course_id" required>
            ${db.courses.map((c) => `<option value="${c.id}" ${isEdit && section.course_id === c.id ? 'selected' : ''}>${esc(c.code)} — ${esc(c.title)}</option>`).join('')}
          </select>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
          <div>
            <label style="font-size:12.6px;font-weight:600;display:block;margin-bottom:5px">Section Name</label>
            <input class="rp-input" name="section_name" required value="${isEdit ? esc(section.section_name || 'A') : 'A'}">
          </div>
          <div>
            <label style="font-size:12.6px;font-weight:600;display:block;margin-bottom:5px">Room</label>
            <input class="rp-input" name="room" required value="${isEdit ? esc(section.room || '') : ''}" placeholder="MB-201">
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:14px">
          <div>
            <label style="font-size:12.6px;font-weight:600;display:block;margin-bottom:5px">Schedule</label>
            <input class="rp-input" name="schedule" value="${isEdit ? esc(section.schedule || '') : ''}" placeholder="MW 08:00-09:30">
          </div>
          <div>
            <label style="font-size:12.6px;font-weight:600;display:block;margin-bottom:5px">Capacity</label>
            <input class="rp-input" name="capacity" type="number" min="1" value="${isEdit ? (section.capacity || 30) : 30}">
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:14px">
          <div>
            <label style="font-size:12.6px;font-weight:600;display:block;margin-bottom:5px">Faculty</label>
            <select class="rp-input" name="faculty_id">
              <option value="">— Unassigned —</option>
              ${faculty.map((f) => `<option value="${f.id}" ${isEdit && section.faculty_id === f.id ? 'selected' : ''}>${esc(f.name)}</option>`).join('')}
            </select>
          </div>
          <div>
            <label style="font-size:12.6px;font-weight:600;display:block;margin-bottom:5px">Status</label>
            <select class="rp-input" name="status">
              <option ${isEdit && section.status === 'Open' ? 'selected' : ''}>Open</option>
              <option ${isEdit && section.status === 'Full' ? 'selected' : ''}>Full</option>
            </select>
          </div>
        </div>
      </form>`,
    footer: `
      <button class="rp-btn rp-btn-ghost" data-action="closeRoleModal">Cancel</button>
      <button class="rp-btn rp-btn-primary" type="submit" form="adminSectionForm">${isEdit ? 'Save changes' : 'Create section'}</button>`
  });
}

/* ============================ RENDER ALL ============================ */

function renderAll() {
  const authPage = $('#authPage');
  const pageWrap = $('#pageWrap');
  const navbar = $('#navbar');

  // --- Not logged in ---
  if (!session) {
    const roleShell = document.getElementById('roleShell');
    if (roleShell) roleShell.classList.add('hidden');
    authPage.classList.remove('hidden');
    pageWrap.classList.add('hidden');
    navbar.classList.add('hidden');
    renderAuthPage();
    return;
  }

  // --- Logged in — pull the user from session ---
  const user = currentUser();

  if (!user) {
    session = null;
    localStorage.removeItem(SESSION_KEY);
    return renderAll();
  }

  // --- Admin / Faculty → role shell ---
  if (user.role === 'admin' || user.role === 'faculty') {
    authPage.classList.add('hidden');
    pageWrap.classList.add('hidden');
    navbar.classList.add('hidden');
    renderRoleShell();
    return;
  }

  // --- Student → student portal ---
  const roleShell = document.getElementById('roleShell');
  if (roleShell) roleShell.classList.add('hidden');
  authPage.classList.add('hidden');
  pageWrap.classList.remove('hidden');
  renderNavbar();

  switch (state.view) {
    case 'dashboard':
      pageWrap.innerHTML = renderStudentDashboard();
      break;
    case 'apply':
      pageWrap.innerHTML = renderApply();
      break;
    case 'programs':
      state.view = 'apply';
      state.step = 3;
      pageWrap.innerHTML = renderApply();
      break;
    case 'documents':
      state.view = 'apply';
      state.step = 4;
      pageWrap.innerHTML = renderApply();
      break;
    case 'review':
      state.view = 'apply';
      state.step = 5;
      pageWrap.innerHTML = renderApply();
      break;
    default:
      pageWrap.innerHTML = renderStudentDashboard();
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ============================ SAFE BOOT ============================ */

function safeBoot() {
  try {
    if (!document.getElementById('authPage')) {
      document.body.innerHTML =
        '<pre style="background:#fff;color:#900;padding:24px;font:14px monospace">' +
        'ERROR: #authPage not found in index.html\n</pre>';
      return;
    }
    if (!document.getElementById('toastRoot')) {
      document.body.innerHTML =
        '<pre style="background:#fff;color:#900;padding:24px;font:14px monospace">' +
        'ERROR: #toastRoot not found in index.html\n</pre>';
      return;
    }

    loadDB();

    const raw = localStorage.getItem(SESSION_KEY);
    if (raw) {
      try {
        const s = JSON.parse(raw);
        const user = db.users.find((u) => u.id === s.userId);
        if (user) {
          session = { userId: user.id, name: user.name, email: user.email, role: user.role };
          state.view = 'dashboard';
          state.roleView = 'dashboard';
        } else {
          localStorage.removeItem(SESSION_KEY);
        }
      } catch (err) {
        localStorage.removeItem(SESSION_KEY);
      }
    }

    renderAll();
  } catch (err) {
    document.body.innerHTML =
      '<pre style="background:#fff;color:#900;padding:24px;font:14px monospace">' +
      'STARTUP ERROR:\n\n' + (err && err.message) + '\n\n' +
      (err && err.stack ? err.stack : '') +
      '</pre>';
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', safeBoot);
} else {
  safeBoot();
}
