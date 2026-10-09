/* =========================================================================
   UNIDA CHRISTIAN COLLEGES — Enrollment Management System
   -------------------------------------------------------------------------
   DEPLOYMENT NOTE
   GitHub Pages only serves static files, so a real SQL server cannot run
   there. This application therefore SIMULATES the SQL database using the
   browser's localStorage. Every table, primary key, foreign key and
   transaction mirrors the SQL schema displayed in Admin -> Database.
   To move to a real database, replace the `db` object + saveDB()/loadDB()
   with fetch() calls to a PHP/Node API sitting in front of MySQL.

   ARCHITECTURE
   Users .......... Student | Admin | Faculty
   Service Layer .. Authentication, Enrollment, Course Management,
                    Student Records, Notifications
   Database ....... Students, Users, Courses, Sections, Enrollments,
                    Departments (+ Programs, Student_Subjects, Documents,
                    Payments, Notifications, Audit_Log)
   External ....... Email (simulated), Payment (simulated), File/Storage
   ========================================================================= */

/* ============================ UTILITIES ============================ */

const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

const peso = (n) => '₱' + Number(n || 0).toLocaleString('en-PH', {
  minimumFractionDigits: 2, maximumFractionDigits: 2
});

const today = () => new Date().toISOString().slice(0, 10);
const nowISO = () => new Date().toISOString();

const fmtDate = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
};

const fmtDateTime = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleString('en-PH', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit'
  });
};

const toMin = (t) => {
  const [h, m] = String(t).split(':').map(Number);
  return h * 60 + m;
};

const initials = (name) => String(name || '?').trim().split(/\s+/)
  .slice(0, 2).map((w) => w[0]).join('').toUpperCase();

/* Simulated password hash — a real system would use bcrypt server-side. */
function hash(pw) {
  let h = 5381;
  const s = pw + '::ucc$salt';
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) + s.charCodeAt(i);
    h = h & 0xffffffff;
  }
  return 'sim$' + Math.abs(h).toString(16);
}

/* Schedule parser: "MW 07:30-09:00" or "TTh 13:00-14:30" */
function parseSchedule(str) {
  const m = String(str).match(/^([A-Za-z]+)\s+(\d{2}:\d{2})-(\d{2}:\d{2})$/);
  if (!m) return null;
  const days = [];
  let s = m[1], i = 0;
  while (i < s.length) {
    if (s.substr(i, 2) === 'Th') { days.push('Th'); i += 2; }
    else { days.push(s[i]); i += 1; }
  }
  return { days, start: toMin(m[2]), end: toMin(m[3]) };
}

function schedulesConflict(a, b) {
  const A = parseSchedule(a), B = parseSchedule(b);
  if (!A || !B) return false;
  const sharesDay = A.days.some((d) => B.days.includes(d));
  if (!sharesDay) return false;
  return A.start < B.end && B.start < A.end;
}

function downloadCSV(filename, rows) {
  const csv = rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
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

/* ============================ SEED DATA ============================ */

const DEPARTMENTS = [
  { id: 1, name: 'Admission Office', description: 'Handles new student applications, entrance requirements, and initial enrollment processing.' },
  { id: 2, name: 'Registrar',        description: 'Maintains academic records, official schedules, transcripts, and enrollment certification.' },
  { id: 3, name: 'Accounting',       description: 'Processes tuition assessment, payment posting, and financial clearances.' }
];

const PROGRAMS = [
  { id: 1, code: 'BSBA', name: 'Bachelor of Science in Business Administration', years: 4, department_id: 3 },
  { id: 2, code: 'BSCS', name: 'Bachelor of Science in Computer Science',        years: 4, department_id: 2 },
  { id: 3, code: 'BEEd', name: 'Bachelor of Elementary Education',               years: 4, department_id: 2 },
  { id: 4, code: 'BSEd', name: 'Bachelor of Secondary Education',                years: 4, department_id: 2 },
  { id: 5, code: 'ACT',  name: 'Associate in Computer Technology',               years: 2, department_id: 1 }
];

const CURRICULUM = {
  BSBA: {
    1: [['Fundamentals of Accounting', '3'], ['Business Mathematics', '3'], ['Microeconomics', '3'], ['Introduction to Business', '3']],
    2: [['Financial Management', '3'], ['Business Law & Ethics', '3'], ['Principles of Marketing', '3'], ['Business Statistics', '3']],
    3: [['Human Resource Management', '3'], ['Operations Management', '3'], ['Income Taxation', '3'], ['Entrepreneurship', '3']],
    4: [['Strategic Management', '3'], ['Business Research Methods', '3'], ['International Business', '3'], ['Business Practicum', '6']]
  },
  BSCS: {
    1: [['Introduction to Computing', '3'], ['Programming 1', '3'], ['Discrete Mathematics', '3'], ['Computer Fundamentals', '3']],
    2: [['Data Structures & Algorithms', '3'], ['Object-Oriented Programming', '3'], ['Digital Logic Design', '3'], ['Linear Algebra', '3']],
    3: [['Database Management Systems', '3'], ['Operating Systems', '3'], ['Computer Networks', '3'], ['Software Engineering', '3']],
    4: [['Artificial Intelligence', '3'], ['Web Systems & Technologies', '3'], ['Information Assurance & Security', '3'], ['Capstone Project', '6']]
  },
  BEEd: {
    1: [['Child & Adolescent Development', '3'], ['Foundation of Special & Inclusive Education', '3'], ['Mother Tongue-Based Multilingual Education', '3'], ['Physical Education 1', '2']],
    2: [['Principles of Teaching', '3'], ['Assessment in Learning 1', '3'], ['Facilitating Learner-Centered Teaching', '3'], ['Filipino sa Piling Larangan', '3']],
    3: [['Teaching Mathematics in the Elementary Grades', '3'], ['Teaching Science in the Elementary Grades', '3'], ['Curriculum Development', '3'], ['Research in Education', '3']],
    4: [['Practice Teaching', '6'], ['Educational Technology', '3'], ['Values Education', '3'], ['Thesis Writing', '3']]
  },
  BSEd: {
    1: [['Foundations of Education', '3'], ['Educational Psychology', '3'], ['General Mathematics', '3'], ['Communication Arts', '3']],
    2: [['Principles of Teaching 2', '3'], ['Assessment of Learning 2', '3'], ['The Teaching Profession', '3'], ['World Literature', '3']],
    3: [['Curriculum Development & Design', '3'], ['Research Methods in Education', '3'], ['Technology for Teaching & Learning', '3'], ['Field Study 1', '3']],
    4: [['Practice Teaching', '6'], ['Thesis Seminar', '3'], ['Field Study 2', '3'], ['Educational Leadership', '3']]
  },
  ACT: {
    1: [['Computer Basics', '3'], ['Programming Fundamentals', '3'], ['Web Design Basics', '3'], ['Office Productivity Tools', '3']],
    2: [['Networking Essentials', '3'], ['Database Fundamentals', '3'], ['Systems Analysis & Design', '3'], ['On-the-Job Training', '6']]
  }
};

const FACULTY_SEED = [
  { name: 'Prof. Maria Santos',   email: 'faculty@ucc.edu.ph' },
  { name: 'Prof. John Reyes',     email: 'jreyes@ucc.edu.ph' },
  { name: 'Prof. Ana Dela Cruz',  email: 'adelacruz@ucc.edu.ph' },
  { name: 'Prof. Ramon Bautista', email: 'rbautista@ucc.edu.ph' },
  { name: 'Prof. Liza Mendoza',   email: 'lmendoza@ucc.edu.ph' }
];

const DOC_TYPES = [
  'Form 138 / Report Card',
  'Good Moral Certificate',
  'PSA Birth Certificate',
  'Medical Certificate',
  '2x2 ID Picture',
  'Certificate of Residency'
];

const DAY_SETS   = ['MW', 'TTh', 'F'];
const TIME_SLOTS = [
  ['07:30', '09:00'], ['09:00', '10:30'], ['10:30', '12:00'],
  ['13:00', '14:30'], ['14:30', '16:00'], ['16:00', '17:30']
];
const ROOMS = ['MB-101', 'MB-102', 'MB-201', 'MB-202', 'SB-301', 'SB-302', 'LAB-1', 'LAB-2', 'AVR-1', 'GYM-A'];
const TUITION_PER_UNIT = 850;
const MISC_FEES = 3200;

/* ============================ DATABASE LAYER ============================ */

const DB_KEY = 'ucc_db_v1';
const SESSION_KEY = 'ucc_session_v1';

let db = null;
let session = null;

const ui = {
  view: 'dashboard',
  authTab: 'login',
  browseYear: null,
  browseSearch: '',
  sectionFilterProg: '',
  sectionSearch: '',
  studentSearch: '',
  facultySection: null,
  facultyStudent: null,
  reportProg: ''
};

function saveDB() { localStorage.setItem(DB_KEY, JSON.stringify(db)); }

function loadDB() {
  const raw = localStorage.getItem(DB_KEY);
  if (raw) {
    try { db = JSON.parse(raw); return; } catch (e) { /* fall through */ }
  }
  db = seedDatabase();
  saveDB();
}

function nextId(table) {
  return db[table].reduce((max, r) => Math.max(max, r.id), 0) + 1;
}

function seedDatabase() {
  const now = nowISO();
  const d = {
    users: [], students: [], departments: [], programs: [], courses: [], sections: [],
    enrollments: [], student_subjects: [], documents: [], payments: [],
    notifications: [], audit: []
  };

  d.departments = DEPARTMENTS.map((x) => ({ ...x }));
  d.programs = PROGRAMS.map((x) => ({ ...x }));

  /* ---------- Users ---------- */
  d.users.push({
    id: 1, name: 'Registrar Admin', email: 'admin@ucc.edu.ph',
    password_hash: hash('admin123'), role: 'admin', status: 'Active', created_at: now
  });
  FACULTY_SEED.forEach((f, i) => {
    d.users.push({
      id: 2 + i, name: f.name, email: f.email,
      password_hash: hash('faculty123'), role: 'faculty', status: 'Active', created_at: now
    });
  });
  d.users.push({
    id: 7, name: 'Juan Dela Cruz', email: 'student@ucc.edu.ph',
    password_hash: hash('student123'), role: 'student', status: 'Active', created_at: now
  });

  /* ---------- Students ---------- */
  d.students.push({
    id: 1, user_id: 7, student_no: '2024-0001', full_name: 'Juan Dela Cruz',
    email: 'student@ucc.edu.ph', phone: '0917-555-0101', status: 'Active',
    program_id: 2, year_level: 2, created_at: now
  });

  /* ---------- Courses + Sections ---------- */
  let cid = 1, sid = 1;
  PROGRAMS.forEach((p, pi) => {
    const cur = CURRICULUM[p.code];
    Object.keys(cur).forEach((yl) => {
      cur[yl].forEach((subj, idx) => {
        const combo = (idx + pi * 4) % 18;
        const days  = DAY_SETS[Math.floor(combo / 6)];
        const slot  = TIME_SLOTS[combo % 6];
        const courseId = cid++;

        d.courses.push({
          id: courseId,
          code: `${p.code}-${yl}${String(idx + 1).padStart(2, '0')}`,
          title: subj[0],
          units: Number(subj[1]),
          program_id: p.id,
          year_level: Number(yl),
          semester: '1st Semester',
          department_id: p.department_id,
          course_date: now
        });

        d.sections.push({
          id: sid++,
          course_id: courseId,
          section_name: 'A',
          schedule: `${days} ${slot[0]}-${slot[1]}`,
          capacity: [25, 30, 35, 40][courseId % 4],
          room: ROOMS[courseId % ROOMS.length],
          status: 'Open',
          faculty_id: 2 + (courseId % 5),
          created_at: now
        });
      });
    });
  });

  /* ---------- Completed subjects for the demo student ---------- */
  const bscsY1 = d.courses.filter((c) => c.program_id === 2 && c.year_level === 1);
  bscsY1.forEach((c, i) => {
    d.student_subjects.push({
      id: i + 1,
      student_id: 1,
      course_id: c.id,
      status: 'Passed',
      grade: ['1.25', '1.50', '1.75', '2.00'][i % 4],
      term: '1st Semester AY 2023-2024',
      recorded_at: now
    });
  });

  /* ---------- Document tracking ---------- */
  const docStatus = ['Verified', 'Pending', 'Verified', 'Missing', 'Pending', 'Verified'];
  DOC_TYPES.forEach((name, i) => {
    d.documents.push({
      id: i + 1, student_id: 1, name,
      status: docStatus[i] || 'Pending', updated_at: now
    });
  });

  d.audit.push({
    id: 1, action: 'SYSTEM', detail: 'Database initialised and seeded with default records.',
    actor: 'system', at: now
  });

  return d;
}

/* ============================ HELPERS ============================ */

const currentUser    = () => db.users.find((u) => u.id === session.userId);
const currentStudent = () => db.students.find((s) => s.user_id === session.userId);
const courseOf       = (section) => db.courses.find((c) => c.id === section.course_id);
const programOf      = (id) => db.programs.find((p) => p.id === id);
const deptOf         = (id) => db.departments.find((d) => d.id === id);

function enrolledCount(sectionId) {
  return db.enrollments.filter((e) => e.section_id === sectionId && e.status !== 'Dropped').length;
}

function logAudit(action, detail) {
  db.audit.unshift({
    id: nextId('audit'), action, detail,
    actor: session ? session.name : 'system', at: nowISO()
  });
  if (db.audit.length > 250) db.audit.length = 250;
}

function notify(userId, title, message, type = 'info') {
  db.notifications.unshift({
    id: nextId('notifications'), user_id: userId, title, message,
    type, is_read: 0, created_at: nowISO()
  });
}

function myNotifications() {
  return db.notifications.filter((n) => n.user_id === session.userId);
}

/* ============================ TOAST & MODAL ============================ */

function toast(msg, type = 'success') {
  const el = document.createElement('div');
  el.className = 'toast toast-' + type;
  el.textContent = msg;
  $('#toastRoot').appendChild(el);
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 320);
  }, 3400);
}

function openModal({ title, body, footer = '', wide = false }) {
  $('#modalRoot').innerHTML = `
    <div class="modal-backdrop">
      <div class="modal ${wide ? 'modal-wide' : ''}">
        <div class="modal-head">
          <h3>${esc(title)}</h3>
          <button class="icon-btn" data-action="closeModal" title="Close">✕</button>
        </div>
        <div class="modal-body">${body}</div>
        ${footer ? `<div class="modal-foot">${footer}</div>` : ''}
      </div>
    </div>`;
}

function closeModal() { $('#modalRoot').innerHTML = ''; }

/* ============================ AUTH SCREEN ============================ */

function renderAuth() {
  const tab = ui.authTab || 'login';
  const progOptions = db.programs.map((p) =>
    `<option value="${p.id}">${esc(p.code)} — ${esc(p.name)}</option>`).join('');

  $('#authWrap').innerHTML = `
    <div class="auth-card">
      <div class="auth-brand">
        <div class="brand-logo">UCC</div>
        <h1>Unida Christian Colleges</h1>
        <p class="brand-tag">Online Enrollment &amp; Student Records Portal</p>
        <ul class="brand-points">
          <li>✓ Browse programs, courses &amp; sections</li>
          <li>✓ Enroll online with instant validation</li>
          <li>✓ Track records, grades &amp; documents</li>
        </ul>
        <div class="brand-demo">
          <strong>Demo accounts</strong>
          <span>Admin &nbsp;· admin@ucc.edu.ph / admin123</span>
          <span>Faculty · faculty@ucc.edu.ph / faculty123</span>
          <span>Student · student@ucc.edu.ph / student123</span>
        </div>
      </div>

      <div class="auth-form">
        <div class="tabs">
          <button class="tab ${tab === 'login' ? 'active' : ''}" data-action="authTab" data-tab="login">Sign in</button>
          <button class="tab ${tab === 'register' ? 'active' : ''}" data-action="authTab" data-tab="register">Register</button>
        </div>

        ${tab === 'login' ? `
          <form id="loginForm">
            <div class="field">
              <label>School Email</label>
              <input type="email" name="email" placeholder="you@ucc.edu.ph" required autocomplete="username">
            </div>
            <div class="field">
              <label>Password</label>
              <input type="password" name="password" placeholder="••••••••" required autocomplete="current-password">
            </div>
            <button class="btn btn-primary btn-block" type="submit" style="margin-top:8px">Sign in to portal</button>
            <p class="form-note">Use one of the demo accounts above to explore each role.</p>
          </form>
        ` : `
          <form id="registerForm">
            <div class="field">
              <label>Full Name</label>
              <input type="text" name="name" placeholder="Juan Dela Cruz" required>
            </div>
            <div class="field-row">
              <div class="field">
                <label>Email</label>
                <input type="email" name="email" placeholder="you@email.com" required>
              </div>
              <div class="field">
                <label>Mobile No.</label>
                <input type="text" name="phone" placeholder="0917-000-0000">
              </div>
            </div>
            <div class="field-row">
              <div class="field">
                <label>Program</label>
                <select name="program_id" required>${progOptions}</select>
              </div>
              <div class="field">
                <label>Year Level</label>
                <select name="year_level" required>
                  <option value="1">1st Year</option>
                  <option value="2">2nd Year</option>
                  <option value="3">3rd Year</option>
                  <option value="4">4th Year</option>
                </select>
              </div>
            </div>
            <div class="field">
              <label>Password</label>
              <input type="password" name="password" placeholder="At least 6 characters" required>
            </div>
            <button class="btn btn-primary btn-block" type="submit" style="margin-top:8px">Create student account</button>
            <p class="form-note">By registering you agree to the school's data privacy policy.</p>
          </form>
        `}
      </div>
    </div>`;
}

function doLogin(form) {
  const fd = new FormData(form);
  const email = String(fd.get('email') || '').trim().toLowerCase();
  const pw = String(fd.get('password') || '');

  const user = db.users.find((u) => u.email.toLowerCase() === email);
  if (!user) return toast('No account found with that email.', 'error');
  if (user.password_hash !== hash(pw)) return toast('Incorrect password. Please try again.', 'error');
  if (user.status !== 'Active') return toast('This account is not active. Contact the Registrar.', 'error');

  session = { userId: user.id, role: user.role, name: user.name };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));

  ui.view = 'dashboard';
  ui.browseYear = null;
  logAudit('LOGIN', `${user.name} signed in as ${user.role}.`);
  saveDB();
  renderAll();
  toast(`Welcome back, ${user.name.split(' ')[0]}!`);
}

function doRegister(form) {
  const fd = new FormData(form);
  const name = String(fd.get('name') || '').trim();
  const email = String(fd.get('email') || '').trim().toLowerCase();
  const phone = String(fd.get('phone') || '').trim();
  const pw = String(fd.get('password') || '');
  const program_id = Number(fd.get('program_id'));
  const year_level = Number(fd.get('year_level'));

  if (!name || !email || !pw) return toast('Please complete all required fields.', 'error');
  if (pw.length < 6) return toast('Password must be at least 6 characters.', 'error');
  if (db.users.some((u) => u.email.toLowerCase() === email)) {
    return toast('That email is already registered.', 'error');
  }

  const prog = programOf(program_id);
  if (year_level > prog.years) {
    return toast(`${prog.code} only offers ${prog.years} year level(s).`, 'error');
  }

  const uid = nextId('users');
  db.users.push({
    id: uid, name, email, password_hash: hash(pw),
    role: 'student', status: 'Active', created_at: nowISO()
  });

  const sid = nextId('students');
  const studentNo = `${new Date().getFullYear()}-${String(sid).padStart(4, '0')}`;
  db.students.push({
    id: sid, user_id: uid, student_no: studentNo, full_name: name,
    email, phone: phone || '—', status: 'Active',
    program_id, year_level, created_at: nowISO()
  });

  DOC_TYPES.forEach((docName) => {
    db.documents.push({
      id: nextId('documents'), student_id: sid, name: docName,
      status: 'Pending', updated_at: nowISO()
    });
  });

  notify(uid, 'Welcome to Unida Christian Colleges',
    'Your account has been created. Please submit your admission documents to the Admission Office.', 'info');

  logAudit('REGISTER', `New student account created: ${name} (${studentNo}).`);
  saveDB();

  session = { userId: uid, role: 'student', name };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  ui.view = 'dashboard';
  renderAll();
  toast('Account created! Welcome to UCC.');
}

/* ============================ SHELL ============================ */

const NAV = {
  student: [
    { id: 'dashboard', label: 'Dashboard',      icon: '🏠' },
    { id: 'browse',    label: 'Browse & Enroll', icon: '📚' },
    { id: 'schedule',  label: 'My Schedule',    icon: '🗓️' },
    { id: 'records',   label: 'My Records',     icon: '📄' }
  ],
  admin: [
    { id: 'dashboard', label: 'Dashboard', icon: '🏠' },
    { id: 'courses',   label: 'Courses',   icon: '📚' },
    { id: 'sections',  label: 'Sections',  icon: '🏫' },
    { id: 'students',  label: 'Students',  icon: '👥' },
    { id: 'reports',   label: 'Reports',   icon: '📊' },
    { id: 'database',  label: 'Database',  icon: '🗄️' }
  ],
  faculty: [
    { id: 'dashboard', label: 'Dashboard',        icon: '🏠' },
    { id: 'classes',   label: 'Class Lists',      icon: '👥' },
    { id: 'progress',  label: 'Student Progress', icon: '✅' }
  ]
};

const VIEW_TITLES = {
  dashboard: 'Dashboard',
  browse: 'Browse & Enroll',
  schedule: 'My Schedule',
  records: 'My Records',
  courses: 'Course Management',
  sections: 'Section Management',
  students: 'Student Records',
  reports: 'Reports & Analytics',
  database: 'Database Schema',
  classes: 'Class Lists',
  progress: 'Student Progress'
};

function renderShell() {
  if (!session) {
    $('#authWrap').classList.remove('hidden');
    $('#appShell').classList.add('hidden');
    return;
  }
  $('#authWrap').classList.add('hidden');
  $('#appShell').classList.remove('hidden');

  const nav = NAV[session.role] || [];
  const unread = myNotifications().filter((n) => !n.is_read).length;

  $('#sidebar').innerHTML = `
    <div class="side-brand">
      <div class="side-logo">UCC</div>
      <div>
        <strong>Unida Christian</strong>
        <span>Colleges</span>
      </div>
    </div>
    <nav class="nav">
      ${nav.map((n) => `
        <button class="nav-item ${ui.view === n.id ? 'active' : ''}" data-nav="${n.id}">
          <span class="ni">${n.icon}</span>${n.label}
        </button>`).join('')}
    </nav>
    <div class="side-foot">
      <div class="side-role">Signed in as ${esc(session.role)}</div>
      <button class="btn btn-ghost btn-block btn-sm" data-action="logout">Sign out</button>
    </div>`;

  const sub = session.role === 'student'
    ? (() => { const s = currentStudent(); const p = s && programOf(s.program_id);
        return s && p ? `${p.code} · Year ${s.year_level} · ${s.student_no}` : ''; })()
    : session.role === 'faculty'
      ? `${db.sections.filter((x) => x.faculty_id === session.userId).length} assigned sections`
      : 'Registrar & Admission Office';

  $('#topbar').innerHTML = `
    <div>
      <h2>${esc(VIEW_TITLES[ui.view] || 'Dashboard')}</h2>
      <div class="sub">${esc(sub)}</div>
    </div>
    <div class="top-user">
      ${unread ? `<span class="badge badge-gold">🔔 ${unread} new</span>` : ''}
      <div class="who">
        <strong>${esc(session.name)}</strong>
        <span>${esc(session.role)}</span>
      </div>
      <div class="avatar">${esc(initials(session.name))}</div>
    </div>`;
}

/* ============================ ROUTER ============================ */

function renderAll() {
  renderShell();
  if (session) renderContent();
}

function renderContent() {
  const map = {
    student: {
      dashboard: viewStudentDashboard,
      browse: viewBrowse,
      schedule: viewSchedule,
      records: viewRecords
    },
    admin: {
      dashboard: viewAdminDashboard,
      courses: viewAdminCourses,
      sections: viewAdminSections,
      students: viewAdminStudents,
      reports: viewAdminReports,
      database: viewAdminDatabase
    },
    faculty: {
      dashboard: viewFacultyDashboard,
      classes: viewFacultyClasses,
      progress: viewFacultyProgress
    }
  };
  const roleMap = map[session.role] || {};
  const fn = roleMap[ui.view] || roleMap.dashboard;
  $('#content').innerHTML = fn ? fn() : '<div class="empty">View not found.</div>';
  renderShell(); // keep nav highlight in sync
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ============================ SHARED PARTIALS ============================ */

function statCard(value, label, sub, icon, gold = false) {
  return `
    <div class="card stat ${gold ? 'gold' : ''}">
      <div class="ic">${icon}</div>
      <div>
        <div class="val">${value}</div>
        <div class="lbl">${esc(label)}</div>
        ${sub ? `<div class="sub">${esc(sub)}</div>` : ''}
      </div>
    </div>`;
}

function capacityBar(section) {
  const used = enrolledCount(section.id);
  const pct = Math.min(100, Math.round((used / section.capacity) * 100));
  let cls = '';
  if (pct >= 100) cls = 'full';
  else if (pct >= 75) cls = 'warn';
  return `<div class="slot-bar ${cls}"><i style="width:${pct}%"></i></div>`;
}

/* =========================================================================
   STUDENT VIEWS
   ========================================================================= */

function viewStudentDashboard() {
  const s = currentStudent();
  if (!s) return '<div class="empty">Student record not found. Please contact the Registrar.</div>';

  const prog = programOf(s.program_id);
  const myEnroll = db.enrollments.filter((e) => e.student_id === s.id && e.status !== 'Dropped');
  const units = myEnroll.reduce((t, e) => {
    const sec = db.sections.find((x) => x.id === e.section_id);
    const c = sec && courseOf(sec);
    return t + (c ? c.units : 0);
  }, 0);

  const passed = db.student_subjects.filter((ss) => ss.student_id === s.id && ss.status === 'Passed').length;
  const missingDocs = db.documents.filter((d) => d.student_id === s.id && d.status !== 'Verified').length;
  const assessed = units * TUITION_PER_UNIT + MISC_FEES;
  const paid = db.payments.filter((p) => p.student_id === s.id && p.status === 'Paid')
    .reduce((t, p) => t + p.amount, 0);

  const notifs = myNotifications().slice(0, 4);

  return `
    <div class="grid grid-4" style="margin-bottom:22px">
      ${statCard(myEnroll.length, 'Enrolled Subjects', `SY ${new Date().getFullYear()}-${new Date().getFullYear() + 1}`, '📚')}
      ${statCard(units, 'Total Units', 'This semester', '🎯', true)}
      ${statCard(passed, 'Subjects Passed', 'Lifetime record', '✅')}
      ${statCard(missingDocs, 'Documents Pending', 'Submit to Admission', '📄', true)}
    </div>

    <div class="grid grid-2" style="margin-bottom:22px">
      <div class="card">
        <div class="card-head">
          <h3>My Program</h3>
          <span class="badge badge-green">${esc(prog ? prog.code : '—')}</span>
        </div>
        <p style="font-size:15px;font-weight:700;color:var(--mint-800);margin-bottom:6px">
          ${esc(prog ? prog.name : '—')}
        </p>
        <p class="muted" style="margin-bottom:14px">
          Year Level ${s.year_level} of ${prog ? prog.years : '—'} · Student No. ${esc(s.student_no)}
        </p>
        <div class="progress-track">
          <i style="width:${prog ? Math.round((s.year_level / prog.years) * 100) : 0}%"></i>
        </div>
        <p class="muted" style="margin-top:8px">Academic progress</p>
        <div style="display:flex;gap:10px;margin-top:16px;flex-wrap:wrap">
          <button class="btn btn-primary btn-sm" data-nav="browse">Browse &amp; Enroll</button>
          <button class="btn btn-ghost btn-sm" data-nav="schedule">View Schedule</button>
        </div>
      </div>

      <div class="card">
        <div class="card-head">
          <h3>Account Statement</h3>
          <span class="badge ${paid >= assessed && assessed > 0 ? 'badge-green' : 'badge-gold'}">
            ${paid >= assessed && assessed > 0 ? 'Fully Paid' : 'Balance Due'}
          </span>
        </div>
        <div style="display:grid;gap:10px;font-size:13.6px">
          <div style="display:flex;justify-content:space-between">
            <span class="muted">Tuition (${units} units × ${peso(TUITION_PER_UNIT)})</span>
            <strong>${peso(units * TUITION_PER_UNIT)}</strong>
          </div>
          <div style="display:flex;justify-content:space-between">
            <span class="muted">Miscellaneous fees</span>
            <strong>${peso(MISC_FEES)}</strong>
          </div>
          <div style="display:flex;justify-content:space-between;border-top:1px solid var(--line);padding-top:10px">
            <span class="muted">Total Assessed</span><strong>${peso(assessed)}</strong>
          </div>
          <div style="display:flex;justify-content:space-between">
            <span class="muted">Amount Paid</span><strong style="color:var(--mint-600)">${peso(paid)}</strong>
          </div>
          <div style="display:flex;justify-content:space-between">
            <span class="muted">Outstanding Balance</span>
            <strong style="color:${assessed - paid > 0 ? 'var(--danger)' : 'var(--mint-600)'}">${peso(Math.max(0, assessed - paid))}</strong>
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-head">
        <h3>Notifications</h3>
        <span class="hint">Simulated email inbox</span>
      </div>
      ${notifs.length ? notifs.map((n) => `
        <div style="display:flex;gap:12px;padding:11px 0;border-bottom:1px solid #eef7f3">
          <div style="font-size:18px">${n.type === 'payment' ? '💳' : n.type === 'enrollment' ? '📝' : '🔔'}</div>
          <div style="flex:1">
            <div style="font-weight:700;font-size:13.6px;color:var(--mint-800)">${esc(n.title)}</div>
            <div class="muted">${esc(n.message)}</div>
          </div>
          <div class="muted" style="white-space:nowrap">${fmtDateTime(n.created_at)}</div>
        </div>`).join('') : '<div class="empty">No notifications yet.</div>'}
    </div>`;
}

function viewBrowse() {
  const s = currentStudent();
  if (!s) return '<div class="empty">Student record not found.</div>';

  const prog = programOf(s.program_id);
  const yearFilter = ui.browseYear || s.year_level;
  const q = (ui.browseSearch || '').toLowerCase();

  const sections = db.sections
    .filter((sec) => {
      const c = courseOf(sec);
      return c && c.program_id === s.program_id;
    })
    .filter((sec) => {
      const c = courseOf(sec);
      return yearFilter === 'all' ? true : c.year_level === Number(yearFilter);
    })
    .filter((sec) => {
      if (!q) return true;
      const c = courseOf(sec);
      return c.code.toLowerCase().includes(q) ||
             c.title.toLowerCase().includes(q) ||
             sec.room.toLowerCase().includes(q);
    })
    .sort((a, b) => courseOf(a).code.localeCompare(courseOf(b).code));

  const myEnroll = db.enrollments.filter((e) => e.student_id === s.id && e.status !== 'Dropped');
  const mySectionIds = myEnroll.map((e) => e.section_id);
  const myCourseIds = mySectionIds
    .map((id) => db.sections.find((x) => x.id === id))
    .filter(Boolean)
    .map((x) => x.course_id);
  const passedIds = db.student_subjects
    .filter((ss) => ss.student_id === s.id && ss.status === 'Passed')
    .map((ss) => ss.course_id);

  const cards = sections.map((sec) => {
    const c = courseOf(sec);
    const used = enrolledCount(sec.id);
    const slots = Math.max(0, sec.capacity - used);
    const isFull = sec.status === 'Full' || slots <= 0;
    const alreadyEnrolled = myCourseIds.includes(c.id);
    const alreadyPassed = passedIds.includes(c.id);
    const aheadYear = c.year_level > s.year_level;

    let btn;
    if (alreadyPassed) {
      btn = `<button class="btn btn-ghost btn-sm" disabled>Already passed</button>`;
    } else if (alreadyEnrolled) {
      btn = `<button class="btn btn-ghost btn-sm" disabled>Enrolled</button>`;
    } else if (isFull) {
      btn = `<button class="btn btn-ghost btn-sm" disabled>Section full</button>`;
    } else {
      btn = `<button class="btn btn-primary btn-sm" data-action="enroll" data-section="${sec.id}">Enroll</button>`;
    }

    return `
      <div class="course-card">
        <div class="cc-top">
          <div>
            <div class="cc-code">${esc(c.code)}</div>
            <h4>${esc(c.title)}</h4>
          </div>
          <span class="badge ${aheadYear ? 'badge-grey' : 'badge-green'}">Year ${c.year_level}</span>
        </div>
        <div class="cc-meta">
          <div>🕒 <span>${esc(sec.schedule)}</span></div>
          <div>📍 <span>Room ${esc(sec.room)} · Section ${esc(sec.section_name)}</span></div>
          <div>🎓 <span>${c.units} units · ${esc(deptOf(c.department_id)?.name || '—')}</span></div>
        </div>
        <div>
          ${capacityBar(sec)}
          <div style="display:flex;justify-content:space-between;margin-top:6px" class="muted">
            <span>${used}/${sec.capacity} slots taken</span>
            <span>${isFull ? 'No slots left' : slots + ' slots available'}</span>
          </div>
        </div>
        <div class="cc-foot">
          <span class="muted">${peso(c.units * TUITION_PER_UNIT)} tuition</span>
          ${btn}
        </div>
        ${aheadYear ? `<div class="notice notice-gold" style="padding:8px 10px;font-size:11.8px">
          <span>⚠️</span><span>Prerequisite: this is a Year ${c.year_level} subject. Enrollment will be blocked.</span>
        </div>` : ''}
      </div>`;
  }).join('');

  return `
    <div class="notice notice-info" style="margin-bottom:18px">
      <span>ℹ️</span>
      <span>You are browsing the <strong>${esc(prog.code)}</strong> curriculum.
      The system validates prerequisites, schedule conflicts and section capacity before saving your enrollment.</span>
    </div>

    <div class="toolbar">
      <div class="grow">
        <input class="input-inline" id="browseSearch" placeholder="Search course code, title or room…" value="${esc(ui.browseSearch)}">
      </div>
      <select class="input-inline" style="width:auto" data-change="browseYear">
        <option value="all" ${yearFilter === 'all' ? 'selected' : ''}>All year levels</option>
        ${Array.from({ length: prog.years }, (_, i) => i + 1).map((y) =>
          `<option value="${y}" ${Number(yearFilter) === y ? 'selected' : ''}>Year ${y}</option>`).join('')}
      </select>
    </div>

    <div class="section-title">${sections.length} section${sections.length === 1 ? '' : 's'} available</div>

    ${sections.length
      ? `<div class="grid grid-3">${cards}</div>`
      : `<div class="card empty"><span class="big">🔍</span>No sections match your filters.</div>`}`;
}

function viewSchedule() {
  const s = currentStudent();
  if (!s) return '<div class="empty">Student record not found.</div>';

  const DAY_COLS = [
    { key: 'M',  label: 'Monday' },
    { key: 'T',  label: 'Tuesday' },
    { key: 'W',  label: 'Wednesday' },
    { key: 'Th', label: 'Thursday' },
    { key: 'F',  label: 'Friday' },
    { key: 'S',  label: 'Saturday' }
  ];

  const myEnroll = db.enrollments.filter((e) => e.student_id === s.id && e.status !== 'Dropped');
  const blocks = myEnroll.map((e) => {
    const sec = db.sections.find((x) => x.id === e.section_id);
    if (!sec) return null;
    return { sec, course: courseOf(sec), parsed: parseSchedule(sec.schedule) };
  }).filter(Boolean);

  let rows = '';
  TIME_SLOTS.forEach((slot, i) => {
    rows += `<tr>
      <td class="time-cell">${slot[0]}<br>${slot[1]}</td>`;
    DAY_COLS.forEach((day, di) => {
      const hit = blocks.find((b) => b.parsed &&
        b.parsed.days.includes(day.key) &&
        b.parsed.start === toMin(slot[0]));
      if (hit) {
        rows += `<td class="slot-cell">
          <div class="class-block ${(i + di) % 2 ? 'gold' : ''}">
            <strong>${esc(hit.course.code)}</strong>
            <span>${esc(hit.course.title.slice(0, 34))}${hit.course.title.length > 34 ? '…' : ''}</span>
            <span>📍 ${esc(hit.sec.room)}</span>
          </div>
        </td>`;
      } else {
        rows += `<td class="slot-cell"></td>`;
      }
    });
    rows += `</tr>`;
  });

  const totalUnits = blocks.reduce((t, b) => t + b.course.units, 0);

  return `
    <div class="notice notice-gold" style="margin-bottom:18px">
      <span>📌</span>
      <span><strong>Placeholder schedule view.</strong> This timetable is generated from the sections you are
      currently enrolled in. The <strong>official class schedule</strong> will be posted by the Registrar's Office
      before the start of classes and may differ from this preview.</span>
    </div>

    <div class="grid grid-3" style="margin-bottom:20px">
      ${statCard(blocks.length, 'Scheduled Subjects', 'This semester', '📘')}
      ${statCard(totalUnits, 'Scheduled Units', 'Load for the term', '⚖️', true)}
      ${statCard(blocks.length ? blocks[0].sec.schedule.split(' ')[0] : '—', 'Earliest Class Day', 'Based on your load', '⏰')}
    </div>

    <div class="card">
      <div class="card-head">
        <h3>Weekly Timetable</h3>
        <span class="hint">SY ${new Date().getFullYear()}–${new Date().getFullYear() + 1} · 1st Semester</span>
      </div>
      <div style="overflow-x:auto">
        <table class="timetable">
          <thead>
            <tr>
              <th class="time-col">Time</th>
              ${DAY_COLS.map((d) => `<th>${d.label}</th>`).join('')}
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      ${blocks.length ? '' : `<div class="empty"><span class="big">🗓️</span>
        You have no enrolled sections yet. Go to <strong>Browse &amp; Enroll</strong> to build your load.</div>`}
    </div>`;
}

function viewRecords() {
  const s = currentStudent();
  if (!s) return '<div class="empty">Student record not found.</div>';

  const taken = db.student_subjects.filter((ss) => ss.student_id === s.id);
  const docs = db.documents.filter((d) => d.student_id === s.id);
  const pays = db.payments.filter((p) => p.student_id === s.id);
  const myEnroll = db.enrollments.filter((e) => e.student_id === s.id && e.status !== 'Dropped');

  const gradePoints = { '1.00': 1, '1.25': 1.25, '1.50': 1.5, '1.75': 1.75, '2.00': 2, '2.25': 2.25, '2.50': 2.5, '2.75': 2.75, '3.00': 3 };
  const graded = taken.filter((t) => t.grade);
  const gpa = graded.length
    ? (graded.reduce((sum, t) => sum + (gradePoints[t.grade] || 3), 0) / graded.length).toFixed(2)
    : '—';

  const docBadge = (st) => st === 'Verified' ? 'badge-green' : st === 'Pending' ? 'badge-gold' : 'badge-red';

  return `
    <div class="grid grid-4" style="margin-bottom:22px">
      ${statCard(taken.length, 'Subjects on Record', 'Completed + in progress', '📗')}
      ${statCard(gpa, 'General Weighted Average', 'Lower is better (PH scale)', '🎯', true)}
      ${statCard(docs.filter((d) => d.status === 'Verified').length + '/' + docs.length, 'Documents Verified', 'Admission requirements', '📄')}
      ${statCard(pays.length, 'Payment Transactions', 'Simulated payments', '💳')}
    </div>

    <div class="card" style="margin-bottom:22px">
      <div class="card-head">
        <h3>Subjects Taken</h3>
        <span class="hint">Official record from the Registrar</span>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>Code</th><th>Subject</th><th>Units</th><th>Term</th><th>Grade</th><th>Status</th></tr>
          </thead>
          <tbody>
            ${taken.length ? taken.map((t) => {
              const c = db.courses.find((x) => x.id === t.course_id);
              if (!c) return '';
              return `<tr>
                <td><strong>${esc(c.code)}</strong></td>
                <td>${esc(c.title)}</td>
                <td>${c.units}</td>
                <td class="muted">${esc(t.term)}</td>
                <td><strong>${esc(t.grade || '—')}</strong></td>
                <td><span class="badge ${t.status === 'Passed' ? 'badge-green' : 'badge-red'}">${esc(t.status)}</span></td>
              </tr>`;
            }).join('') : '<tr><td colspan="6" class="empty">No completed subjects on record yet.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>

    <div class="grid grid-2">
      <div class="card">
        <div class="card-head">
          <h3>Document Tracking</h3>
          <span class="hint">Admission Office</span>
        </div>
        ${docs.length ? docs.map((d) => `
          <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid #eef7f3">
            <div>
              <div style="font-size:13.4px;font-weight:600">${esc(d.name)}</div>
              <div class="muted">Updated ${fmtDate(d.updated_at)}</div>
            </div>
            <span class="badge ${docBadge(d.status)}">${esc(d.status)}</span>
          </div>`).join('') : '<div class="empty">No document requirements on file.</div>'}
      </div>

      <div class="card">
        <div class="card-head">
          <h3>Payments</h3>
          <span class="hint">Simulated — no real transaction</span>
        </div>
        ${pays.length ? pays.map((p) => `
          <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid #eef7f3">
            <div>
              <div style="font-size:13.4px;font-weight:600">${esc(p.reference)}</div>
              <div class="muted">${fmtDateTime(p.paid_at)} · ${esc(p.method)}</div>
            </div>
            <div style="text-align:right">
              <div style="font-weight:800;color:var(--mint-700)">${peso(p.amount)}</div>
              <span class="badge badge-green">Paid</span>
            </div>
          </div>`).join('') : '<div class="empty">No payments recorded yet.</div>'}

        <button class="btn btn-gold btn-block" style="margin-top:14px" data-action="payTuition">
          💳 Pay Tuition (Simulated)
        </button>
      </div>
    </div>

    <div class="card" style="margin-top:22px">
      <div class="card-head"><h3>Current Enrollment</h3></div>
      ${myEnroll.length ? `<div class="table-wrap"><table>
        <thead><tr><th>Course</th><th>Section</th><th>Schedule</th><th>Room</th><th>Status</th><th></th></tr></thead>
        <tbody>
          ${myEnroll.map((e) => {
            const sec = db.sections.find((x) => x.id === e.section_id);
            const c = sec && courseOf(sec);
            if (!c) return '';
            return `<tr>
              <td><strong>${esc(c.code)}</strong><div class="muted">${esc(c.title)}</div></td>
              <td>${esc(sec.section_name)}</td>
              <td>${esc(sec.schedule)}</td>
              <td>${esc(sec.room)}</td>
              <td><span class="badge badge-green">${esc(e.status)}</span></td>
              <td><button class="btn btn-danger btn-sm" data-action="dropEnroll" data-id="${e.id}">Drop</button></td>
            </tr>`;
          }).join('')}
        </tbody>
      </table></div>` : '<div class="empty"><span class="big">📭</span>You are not enrolled in any section yet.</div>'}
    </div>`;
}

/* =========================================================================
   ENROLLMENT SERVICE (student actions)
   ========================================================================= */

function handleEnroll(sectionId) {
  const s = currentStudent();
  const sec = db.sections.find((x) => x.id === sectionId);
  if (!s || !sec) return toast('Section not found.', 'error');

  const course = courseOf(sec);
  if (!course) return toast('Course not found.', 'error');

  /* 1 — capacity / status */
  if (sec.status === 'Full') return toast('This section is marked FULL by the Registrar.', 'error');
  const used = enrolledCount(sec.id);
  if (used >= sec.capacity) return toast('No available slots in this section.', 'error');

  /* 2 — duplicate */
  const myEnroll = db.enrollments.filter((e) => e.student_id === s.id && e.status !== 'Dropped');
  const mySections = myEnroll
    .map((e) => db.sections.find((x) => x.id === e.section_id))
    .filter(Boolean);

  if (mySections.some((x) => x.course_id === course.id)) {
    return toast('You are already enrolled in this subject.', 'error');
  }

  /* 3 — prerequisite (year level) */
  if (course.year_level > s.year_level) {
    return toast(`Prerequisite not met — ${course.code} is a Year ${course.year_level} subject.`, 'error');
  }

  /* 4 — already passed */
  if (db.student_subjects.some((ss) => ss.student_id === s.id && ss.course_id === course.id && ss.status === 'Passed')) {
    return toast('You have already passed this subject.', 'error');
  }

  /* 5 — program check */
  if (course.program_id !== s.program_id) {
    return toast('This subject is not part of your program curriculum.', 'error');
  }

  /* 6 — schedule conflict */
  const conflict = mySections.find((x) => schedulesConflict(x.schedule, sec.schedule));
  if (conflict) {
    const cc = courseOf(conflict);
    return toast(`Schedule conflict with ${cc.code} (${conflict.schedule}).`, 'error');
  }

  /* 7 — transaction: save the record */
  const newId = nextId('enrollments');
  db.enrollments.push({
    id: newId,
    student_id: s.id,
    section_id: sec.id,
    enrollment_date: today(),
    status: 'Enrolled'
  });

  notify(s.user_id || s.id, 'Enrollment Confirmation',
    `You have been enrolled in ${course.code} — ${course.title} (Section ${sec.section_name}, ${sec.schedule}). ` +
    `A confirmation email was sent to ${s.email}.`, 'enrollment');

  logAudit('ENROLL', `${s.full_name} enrolled in ${course.code} (Section ${sec.section_name}).`);

  /* Auto-mark section full when capacity reached */
  if (enrolledCount(sec.id) >= sec.capacity) sec.status = 'Full';

  saveDB();

  openModal({
    title: 'Enrollment Confirmed',
    body: `
      <div class="notice notice-mint" style="margin-bottom:16px">
        <span>✅</span><span>Your enrollment was saved successfully in a single database transaction.</span>
      </div>
      <div style="display:grid;gap:10px;font-size:13.8px">
        <div style="display:flex;justify-content:space-between"><span class="muted">Reference No.</span><strong>ENR-${String(newId).padStart(5, '0')}</strong></div>
        <div style="display:flex;justify-content:space-between"><span class="muted">Student</span><strong>${esc(s.full_name)}</strong></div>
        <div style="display:flex;justify-content:space-between"><span class="muted">Course</span><strong>${esc(course.code)} — ${esc(course.title)}</strong></div>
        <div style="display:flex;justify-content:space-between"><span class="muted">Section</span><strong>${esc(sec.section_name)} · ${esc(sec.schedule)}</strong></div>
        <div style="display:flex;justify-content:space-between"><span class="muted">Room</span><strong>${esc(sec.room)}</strong></div>
        <div style="display:flex;justify-content:space-between"><span class="muted">Units</span><strong>${course.units}</strong></div>
        <div style="display:flex;justify-content:space-between"><span class="muted">Date</span><strong>${fmtDate(today())}</strong></div>
      </div>
      <div class="notice notice-gold" style="margin-top:16px">
        <span>📧</span><span>A confirmation email has been queued to <strong>${esc(s.email)}</strong>
        (simulated — no real email is sent from this demo).</span>
      </div>`,
    footer: `<button class="btn btn-primary" data-action="closeModal">Done</button>`
  });
}

function handleDrop(enrollmentId) {
  const e = db.enrollments.find((x) => x.id === enrollmentId);
  if (!e) return;
  const sec = db.sections.find((x) => x.id === e.section_id);
  const c = sec && courseOf(sec);

  openModal({
    title: 'Drop this subject?',
    body: `<p style="font-size:14px">You are about to drop <strong>${esc(c ? c.code + ' — ' + c.title : 'this subject')}</strong>.
      The slot will be released back to the available pool.</p>`,
    footer: `
      <button class="btn btn-ghost" data-action="closeModal">Cancel</button>
      <button class="btn btn-danger" data-action="confirmDrop" data-id="${e.id}">Yes, drop it</button>`
  });
}

function confirmDrop(id) {
  const e = db.enrollments.find((x) => x.id === id);
  if (!e) return;
  const sec = db.sections.find((x) => x.id === e.section_id);
  const c = sec && courseOf(sec);
  db.enrollments = db.enrollments.filter((x) => x.id !== id);
  if (sec && sec.status === 'Full' && enrolledCount(sec.id) < sec.capacity) sec.status = 'Open';

  const s = currentStudent();
  logAudit('DROP', `${s ? s.full_name : 'Student'} dropped ${c ? c.code : 'a subject'}.`);
  saveDB();
  closeModal();
  renderContent();
  toast('Subject dropped successfully.');
}

function handlePayTuition() {
  const s = currentStudent();
  const myEnroll = db.enrollments.filter((e) => e.student_id === s.id && e.status !== 'Dropped');
  const units = myEnroll.reduce((t, e) => {
    const sec = db.sections.find((x) => x.id === e.section_id);
    const c = sec && courseOf(sec);
    return t + (c ? c.units : 0);
  }, 0);
  const amount = units * TUITION_PER_UNIT + MISC_FEES;

  openModal({
    title: 'Simulated Payment',
    body: `
      <div class="notice notice-info" style="margin-bottom:16px">
        <span>ℹ️</span><span>This is a <strong>simulated payment gateway</strong>. No real money is processed
        and no card details are collected.</span>
      </div>
      <div style="display:grid;gap:10px;font-size:13.8px;margin-bottom:16px">
        <div style="display:flex;justify-content:space-between"><span class="muted">Enrolled units</span><strong>${units}</strong></div>
        <div style="display:flex;justify-content:space-between"><span class="muted">Tuition</span><strong>${peso(units * TUITION_PER_UNIT)}</strong></div>
        <div style="display:flex;justify-content:space-between"><span class="muted">Miscellaneous</span><strong>${peso(MISC_FEES)}</strong></div>
        <div style="display:flex;justify-content:space-between;border-top:1px solid var(--line);padding-top:10px">
          <span class="muted">Total due</span><strong style="font-size:16px;color:var(--mint-700)">${peso(amount)}</strong>
        </div>
      </div>
      <div class="field">
        <label>Payment Method</label>
        <select id="payMethod">
          <option>Over-the-counter (Accounting Office)</option>
          <option>Bank Transfer</option>
          <option>GCash / Maya (simulated)</option>
          <option>Installment Plan</option>
        </select>
      </div>`,
    footer: `
      <button class="btn btn-ghost" data-action="closeModal">Cancel</button>
      <button class="btn btn-gold" data-action="confirmPay" data-amount="${amount}">Confirm payment</button>`
  });
}

function confirmPay(amount) {
  const s = currentStudent();
  const method = ($('#payMethod') || {}).value || 'Over-the-counter';
  const ref = 'PAY-' + Date.now().toString().slice(-8);

  db.payments.push({
    id: nextId('payments'),
    student_id: s.id,
    reference: ref,
    amount: Number(amount),
    method,
    status: 'Paid',
    paid_at: nowISO()
  });

  notify(s.user_id, 'Payment Received',
    `We received your payment of ${peso(amount)} (${ref}). Thank you!`, 'payment');

  logAudit('PAYMENT', `${s.full_name} paid ${peso(amount)} via ${method} (${ref}).`);
  saveDB();
  closeModal();
  renderContent();
  toast('Payment posted to your account.');
}

/* =========================================================================
   ADMIN VIEWS
   ========================================================================= */

function viewAdminDashboard() {
  const totalStudents = db.students.filter((s) => s.status === 'Active').length;
  const totalEnroll = db.enrollments.filter((e) => e.status !== 'Dropped').length;
  const totalSections = db.sections.length;
  const totalCapacity = db.sections.reduce((t, s) => t + s.capacity, 0);
  const utilization = totalCapacity ? Math.round((totalEnroll / totalCapacity) * 100) : 0;
  const fullSections = db.sections.filter((s) => s.status === 'Full').length;
  const revenue = db.payments.filter((p) => p.status === 'Paid').reduce((t, p) => t + p.amount, 0);

  const recent = db.enrollments.slice(-6).reverse();

  const byProgram = db.programs.map((p) => {
    const count = db.enrollments.filter((e) => {
      const sec = db.sections.find((x) => x.id === e.section_id);
      const c = sec && courseOf(sec);
      return c && c.program_id === p.id && e.status !== 'Dropped';
    }).length;
    return { p, count };
  });

  const maxCount = Math.max(1, ...byProgram.map((b) => b.count));

  return `
    <div class="grid grid-4" style="margin-bottom:22px">
      ${statCard(totalStudents, 'Active Students', 'Registered accounts', '👥')}
      ${statCard(totalEnroll, 'Total Enrollments', `Across ${totalSections} sections`, '📝', true)}
      ${statCard(utilization + '%', 'Seat Utilization', `${totalCapacity} total seats`, '📊')}
      ${statCard(peso(revenue), 'Collected (Simulated)', 'All posted payments', '💰', true)}
    </div>

    ${fullSections ? `
      <div class="notice notice-gold" style="margin-bottom:20px">
        <span>⚠️</span>
        <span><strong>${fullSections}</strong> section${fullSections === 1 ? ' is' : 's are'} currently marked FULL.
        Review them in <strong>Sections</strong> to open additional slots.</span>
      </div>` : ''}

    <div class="grid grid-2" style="margin-bottom:22px">
      <div class="card">
        <div class="card-head"><h3>Enrollment by Program</h3></div>
        ${byProgram.map((b) => `
          <div style="margin-bottom:14px">
            <div style="display:flex;justify-content:space-between;font-size:13.4px;margin-bottom:6px">
              <strong>${esc(b.p.code)} <span class="muted" style="font-weight:400">— ${esc(b.p.name)}</span></strong>
              <span>${b.count}</span>
            </div>
            <div class="progress-track"><i style="width:${Math.round((b.count / maxCount) * 100)}%"></i></div>
          </div>`).join('')}
      </div>

      <div class="card">
        <div class="card-head"><h3>Recent Enrollments</h3><span class="hint">Latest transactions</span></div>
        ${recent.length ? recent.map((e) => {
          const st = db.students.find((x) => x.id === e.student_id);
          const sec = db.sections.find((x) => x.id === e.section_id);
          const c = sec && courseOf(sec);
          return `<div style="display:flex;justify-content:space-between;gap:10px;padding:9px 0;border-bottom:1px solid #eef7f3">
            <div>
              <div style="font-size:13.2px;font-weight:600">${esc(st ? st.full_name : 'Unknown')}</div>
              <div class="muted">${esc(c ? c.code : '—')} · Section ${esc(sec ? sec.section_name : '—')}</div>
            </div>
            <div class="muted" style="white-space:nowrap">${fmtDate(e.enrollment_date)}</div>
          </div>`;
        }).join('') : '<div class="empty">No enrollments recorded yet.</div>'}
      </div>
    </div>

    <div class="card">
      <div class="card-head"><h3>System Activity Log</h3><span class="hint">Most recent 8 events</span></div>
      ${db.audit.slice(0, 8).map((a) => `
        <div style="display:flex;gap:12px;padding:9px 0;border-bottom:1px solid #eef7f3;font-size:13px">
          <span class="badge badge-grey" style="min-width:92px;justify-content:center">${esc(a.action)}</span>
          <span style="flex:1">${esc(a.detail)}</span>
          <span class="muted" style="white-space:nowrap">${fmtDateTime(a.at)}</span>
        </div>`).join('')}
    </div>`;
}

function viewAdminCourses() {
  const q = (ui.sectionSearch || '').toLowerCase();
  const progFilter = ui.sectionFilterProg;

  const courses = db.courses
    .filter((c) => !progFilter || c.program_id === Number(progFilter))
    .filter((c) => !q || c.code.toLowerCase().includes(q) || c.title.toLowerCase().includes(q))
    .sort((a, b) => a.code.localeCompare(b.code));

  return `
    <div class="toolbar">
      <div class="grow">
        <input class="input-inline" id="courseSearch" placeholder="Search course code or title…" value="${esc(ui.sectionSearch)}">
      </div>
      <select class="input-inline" style="width:auto" data-change="filterProg">
        <option value="">All programs</option>
        ${db.programs.map((p) => `<option value="${p.id}" ${String(progFilter) === String(p.id) ? 'selected' : ''}>${esc(p.code)}</option>`).join('')}
      </select>
      <button class="btn btn-primary" data-action="courseNew">＋ Add Course</button>
    </div>

    <div class="card" style="padding:0;overflow:hidden">
      <div class="table-wrap" style="border:none;border-radius:0">
        <table>
          <thead>
            <tr>
              <th>Code</th><th>Title</th><th>Program</th><th>Year</th><th>Units</th>
              <th>Department</th><th>Sections</th><th style="text-align:right">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${courses.length ? courses.map((c) => {
              const secs = db.sections.filter((s) => s.course_id === c.id);
              return `<tr>
                <td><strong>${esc(c.code)}</strong></td>
                <td>${esc(c.title)}</td>
                <td><span class="badge badge-green">${esc(programOf(c.program_id)?.code || '—')}</span></td>
                <td>Year ${c.year_level}</td>
                <td>${c.units}</td>
                <td class="muted">${esc(deptOf(c.department_id)?.name || '—')}</td>
                <td>${secs.length}</td>
                <td style="text-align:right;white-space:nowrap">
                  <button class="btn btn-ghost btn-sm" data-action="courseEdit" data-id="${c.id}">Edit</button>
                  <button class="btn btn-danger btn-sm" data-action="courseDelete" data-id="${c.id}">Remove</button>
                </td>
              </tr>`;
            }).join('') : '<tr><td colspan="8" class="empty">No courses match your filters.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>`;
}

function viewAdminSections() {
  const q = (ui.sectionSearch || '').toLowerCase();
  const progFilter = ui.sectionFilterProg;

  const sections = db.sections
    .filter((s) => {
      const c = courseOf(s);
      if (!c) return false;
      if (progFilter && c.program_id !== Number(progFilter)) return false;
      if (!q) return true;
      return c.code.toLowerCase().includes(q) || c.title.toLowerCase().includes(q) || s.room.toLowerCase().includes(q);
    })
    .sort((a, b) => courseOf(a).code.localeCompare(courseOf(b).code));

  return `
    <div class="toolbar">
      <div class="grow">
        <input class="input-inline" id="courseSearch" placeholder="Search section, course or room…" value="${esc(ui.sectionSearch)}">
      </div>
      <select class="input-inline" style="width:auto" data-change="filterProg">
        <option value="">All programs</option>
        ${db.programs.map((p) => `<option value="${p.id}" ${String(progFilter) === String(p.id) ? 'selected' : ''}>${esc(p.code)}</option>`).join('')}
      </select>
      <button class="btn btn-primary" data-action="sectionNew">＋ Add Section</button>
    </div>

    <div class="card" style="padding:0;overflow:hidden">
      <div class="table-wrap" style="border:none;border-radius:0">
        <table>
          <thead>
            <tr>
              <th>Course</th><th>Section</th><th>Schedule</th><th>Room</th>
              <th>Faculty</th><th>Capacity</th><th>Status</th><th style="text-align:right">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${sections.length ? sections.map((s) => {
              const c = courseOf(s);
              const used = enrolledCount(s.id);
              const fac = db.users.find((u) => u.id === s.faculty_id);
              const isFull = s.status === 'Full' || used >= s.capacity;
              return `<tr>
                <td><strong>${esc(c.code)}</strong><div class="muted">${esc(c.title)}</div></td>
                <td>${esc(s.section_name)}</td>
                <td>${esc(s.schedule)}</td>
                <td>${esc(s.room)}</td>
                <td class="muted">${esc(fac ? fac.name : 'Unassigned')}</td>
                <td style="min-width:130px">
                  <div style="font-size:12.6px;margin-bottom:4px">${used} / ${s.capacity}</div>
                  ${capacityBar(s)}
                </td>
                <td><span class="badge ${isFull ? 'badge-red' : 'badge-green'}">${isFull ? 'Full' : 'Open'}</span></td>
                <td style="text-align:right;white-space:nowrap">
                  <button class="btn btn-ghost btn-sm" data-action="sectionEdit" data-id="${s.id}">Edit</button>
                  <button class="btn ${isFull ? 'btn-ghost' : 'btn-gold'} btn-sm" data-action="sectionToggle" data-id="${s.id}">
                    ${isFull ? 'Reopen' : 'Mark Full'}
                  </button>
                  <button class="btn btn-danger btn-sm" data-action="sectionDelete" data-id="${s.id}">✕</button>
                </td>
              </tr>`;
            }).join('') : '<tr><td colspan="8" class="empty">No sections match your filters.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>`;
}

function viewAdminStudents() {
  const q = (ui.studentSearch || '').toLowerCase();

  const students = db.students
    .filter((s) => !q ||
      s.full_name.toLowerCase().includes(q) ||
      s.student_no.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q));

  return `
    <div class="toolbar">
      <div class="grow">
        <input class="input-inline" id="studentSearch" placeholder="Search student name, ID or email…" value="${esc(ui.studentSearch)}">
      </div>
      <button class="btn btn-ghost" data-action="exportStudents">⤓ Export CSV</button>
    </div>

    <div class="card" style="padding:0;overflow:hidden">
      <div class="table-wrap" style="border:none;border-radius:0">
        <table>
          <thead>
            <tr>
              <th>Student No.</th><th>Name</th><th>Program</th><th>Year</th>
              <th>Subjects</th><th>Documents</th><th>Status</th><th style="text-align:right">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${students.length ? students.map((s) => {
              const prog = programOf(s.program_id);
              const enr = db.enrollments.filter((e) => e.student_id === s.id && e.status !== 'Dropped').length;
              const docs = db.documents.filter((d) => d.student_id === s.id);
              const verified = docs.filter((d) => d.status === 'Verified').length;
              return `<tr>
                <td><strong>${esc(s.student_no)}</strong></td>
                <td>${esc(s.full_name)}<div class="muted">${esc(s.email)}</div></td>
                <td><span class="badge badge-green">${esc(prog ? prog.code : '—')}</span></td>
                <td>Year ${s.year_level}</td>
                <td>${enr}</td>
                <td>${verified}/${docs.length}</td>
                <td><span class="badge ${s.status === 'Active' ? 'badge-green' : 'badge-grey'}">${esc(s.status)}</span></td>
                <td style="text-align:right">
                  <button class="btn btn-primary btn-sm" data-action="studentManage" data-id="${s.id}">Manage</button>
                </td>
              </tr>`;
            }).join('') : '<tr><td colspan="8" class="empty">No students found.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>`;
}

function viewAdminReports() {
  const students = db.students;
  const enrollments = db.enrollments.filter((e) => e.status !== 'Dropped');
  const totalCapacity = db.sections.reduce((t, s) => t + s.capacity, 0);
  const utilization = totalCapacity ? Math.round((enrollments.length / totalCapacity) * 100) : 0;
  const revenue = db.payments.filter((p) => p.status === 'Paid').reduce((t, p) => t + p.amount, 0);

  const byProgram = db.programs.map((p) => {
    const pCourses = db.courses.filter((c) => c.program_id === p.id);
    const courseIds = pCourses.map((c) => c.id);
    const count = enrollments.filter((e) => {
      const sec = db.sections.find((x) => x.id === e.section_id);
      return sec && courseIds.includes(sec.course_id);
    }).length;
    const studentCount = students.filter((s) => s.program_id === p.id).length;
    return { p, count, studentCount, courseCount: pCourses.length };
  });

  const byYear = [1, 2, 3, 4].map((y) => ({
    y,
    count: enrollments.filter((e) => {
      const sec = db.sections.find((x) => x.id === e.section_id);
      const c = sec && courseOf(sec);
      return c && c.year_level === y;
    }).length
  }));

  const topSections = db.sections
    .map((s) => ({ s, used: enrolledCount(s.id), pct: Math.round((enrolledCount(s.id) / s.capacity) * 100) }))
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 8);

  const deptLoad = db.departments.map((d) => ({
    d,
    courses: db.courses.filter((c) => c.department_id === d.id).length,
    sections: db.sections.filter((s) => {
      const c = courseOf(s);
      return c && c.department_id === d.id;
    }).length
  }));

  const maxYear = Math.max(1, ...byYear.map((b) => b.count));

  return `
    <div class="grid grid-4" style="margin-bottom:22px">
      ${statCard(students.length, 'Total Students', 'All records', '👥')}
      ${statCard(enrollments.length, 'Total Enrollments', 'Active + completed', '📝', true)}
      ${statCard(utilization + '%', 'Seat Utilization', `${totalCapacity} seats available`, '📊')}
      ${statCard(peso(revenue), 'Total Collections', 'Simulated payments', '💰', true)}
    </div>

    <div class="card" style="margin-bottom:22px">
      <div class="card-head">
        <h3>How to read this report</h3>
      </div>
      <div class="grid grid-3">
        <div class="notice notice-mint"><span>1️⃣</span><span><strong>Enrollment by Program</strong> shows how many students
          are taking subjects under each degree. Use it to decide where to open more sections.</span></div>
        <div class="notice notice-mint"><span>2️⃣</span><span><strong>Seat Utilization</strong> compares confirmed enrollments
          against total section capacity. Above 85% means you are near full.</span></div>
        <div class="notice notice-mint"><span>3️⃣</span><span><strong>Department Workload</strong> tracks how many courses and
          sections each office (Admission, Registrar, Accounting) is handling.</span></div>
      </div>
    </div>

    <div class="grid grid-2" style="margin-bottom:22px">
      <div class="card">
        <div class="card-head"><h3>Enrollment by Program</h3>
          <button class="btn btn-ghost btn-sm" data-action="exportPrograms">⤓ CSV</button></div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Program</th><th>Students</th><th>Courses</th><th>Enrollments</th></tr></thead>
            <tbody>
              ${byProgram.map((b) => `<tr>
                <td><strong>${esc(b.p.code)}</strong><div class="muted">${esc(b.p.name)}</div></td>
                <td>${b.studentCount}</td>
                <td>${b.courseCount}</td>
                <td><strong>${b.count}</strong></td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <div class="card-head"><h3>Enrollment by Year Level</h3></div>
        ${byYear.map((b) => `
          <div style="margin-bottom:14px">
            <div style="display:flex;justify-content:space-between;font-size:13.4px;margin-bottom:6px">
              <strong>Year ${b.y}</strong><span>${b.count}</span>
            </div>
            <div class="progress-track"><i style="width:${Math.round((b.count / maxYear) * 100)}%"></i></div>
          </div>`).join('')}
      </div>
    </div>

    <div class="grid grid-2">
      <div class="card">
        <div class="card-head"><h3>Section Capacity Watchlist</h3><span class="hint">Highest utilization first</span></div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Course</th><th>Sec</th><th>Filled</th><th>Utilization</th></tr></thead>
            <tbody>
              ${topSections.map((t) => {
                const c = courseOf(t.s);
                return `<tr>
                  <td><strong>${esc(c.code)}</strong></td>
                  <td>${esc(t.s.section_name)}</td>
                  <td>${t.used}/${t.s.capacity}</td>
                  <td style="min-width:110px">${capacityBar(t.s)}<div class="muted" style="margin-top:3px">${t.pct}%</div></td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <div class="card-head"><h3>Department Workload</h3></div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Department</th><th>Courses</th><th>Sections</th></tr></thead>
            <tbody>
              ${deptLoad.map((x) => `<tr>
                <td><strong>${esc(x.d.name)}</strong><div class="muted">${esc(x.d.description.slice(0, 54))}…</div></td>
                <td>${x.courses}</td>
                <td>${x.sections}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>`;
}

const SQL_SCHEMA = `-- =====================================================================
-- UNIDA CHRISTIAN COLLEGES — ENROLLMENT SYSTEM (MySQL schema)
-- =====================================================================

CREATE TABLE departments (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  name         VARCHAR(120) NOT NULL,
  description  TEXT
);

CREATE TABLE programs (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  code          VARCHAR(20)  NOT NULL UNIQUE,
  name          VARCHAR(160) NOT NULL,
  years         TINYINT      NOT NULL,
  department_id INT,
  FOREIGN KEY (department_id) REFERENCES departments(id)
);

CREATE TABLE users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(160) NOT NULL,
  email         VARCHAR(160) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role          ENUM('student','faculty','admin') NOT NULL,
  status        VARCHAR(20)  DEFAULT 'Active',
  created_at    DATETIME     DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE students (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT UNIQUE,
  student_no  VARCHAR(20) UNIQUE,
  full_name   VARCHAR(160) NOT NULL,
  email       VARCHAR(160),
  phone       VARCHAR(40),
  status      VARCHAR(20) DEFAULT 'Active',
  program_id  INT,
  year_level  TINYINT,
  FOREIGN KEY (user_id)    REFERENCES users(id),
  FOREIGN KEY (program_id) REFERENCES programs(id)
);

CREATE TABLE courses (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  code          VARCHAR(30) NOT NULL UNIQUE,
  title         VARCHAR(180) NOT NULL,
  units         TINYINT NOT NULL,
  program_id    INT,
  year_level    TINYINT,
  semester      VARCHAR(30),
  department_id INT,
  course_date   DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (program_id)    REFERENCES programs(id),
  FOREIGN KEY (department_id) REFERENCES departments(id)
);

CREATE TABLE sections (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  course_id    INT NOT NULL,
  section_name VARCHAR(10) DEFAULT 'A',
  schedule     VARCHAR(60),
  capacity     INT DEFAULT 30,
  room         VARCHAR(30),
  status       ENUM('Open','Full','Closed') DEFAULT 'Open',
  faculty_id   INT,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (course_id)  REFERENCES courses(id) ON DELETE CASCADE,
  FOREIGN KEY (faculty_id) REFERENCES users(id)
);

CREATE TABLE enrollments (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  student_id      INT NOT NULL,
  section_id      INT NOT NULL,
  enrollment_date DATE NOT NULL,
  status          ENUM('Enrolled','Dropped','Completed') DEFAULT 'Enrolled',
  UNIQUE KEY uniq_student_section (student_id, section_id),
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE
);

CREATE TABLE student_subjects (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  student_id  INT NOT NULL,
  course_id   INT NOT NULL,
  status      ENUM('Passed','Failed','In Progress') NOT NULL,
  grade       VARCHAR(6),
  term        VARCHAR(60),
  recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id)  REFERENCES courses(id)
);

CREATE TABLE documents (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  name       VARCHAR(120) NOT NULL,
  status     ENUM('Verified','Pending','Missing') DEFAULT 'Pending',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

CREATE TABLE payments (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  reference  VARCHAR(40) UNIQUE,
  amount     DECIMAL(10,2) NOT NULL,
  method     VARCHAR(60),
  status     ENUM('Paid','Pending','Void') DEFAULT 'Paid',
  paid_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id)
);

CREATE TABLE notifications (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT NOT NULL,
  title      VARCHAR(160),
  message    TEXT,
  type       VARCHAR(30) DEFAULT 'info',
  is_read    TINYINT DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ---------------------------------------------------------------------
-- Enrollment transaction (step 4 of the data flow)
-- ---------------------------------------------------------------------
START TRANSACTION;
  SELECT capacity, (SELECT COUNT(*) FROM enrollments WHERE section_id = ?)
    FROM sections WHERE id = ? FOR UPDATE;   -- 1. lock & check capacity
  INSERT INTO enrollments (student_id, section_id, enrollment_date, status)
    VALUES (?, ?, CURDATE(), 'Enrolled');    -- 2. save record
  INSERT INTO notifications (user_id, title, message, type)
    VALUES (?, 'Enrollment Confirmation', '...', 'enrollment');
COMMIT;`;

function viewAdminDatabase() {
  const counts = [
    ['users', db.users.length], ['students', db.students.length],
    ['departments', db.departments.length], ['programs', db.programs.length],
    ['courses', db.courses.length], ['sections', db.sections.length],
    ['enrollments', db.enrollments.length], ['student_subjects', db.student_subjects.length],
    ['documents', db.documents.length], ['payments', db.payments.length],
    ['notifications', db.notifications.length], ['audit', db.audit.length]
  ];

  return `
    <div class="notice notice-info" style="margin-bottom:20px">
      <span>🗄️</span>
      <span>GitHub Pages is a <strong>static host</strong>, so a live SQL server cannot run here. This demo
      reproduces every table in <strong>localStorage</strong> with the same primary keys, foreign keys and
      transaction logic. The SQL below is the production schema you would run on MySQL.</span>
    </div>

    <div class="grid grid-4" style="margin-bottom:22px">
      ${counts.slice(0, 4).map(([t, n]) => statCard(n, t, 'rows', '📦', false)).join('')}
    </div>

    <div class="card" style="margin-bottom:22px">
      <div class="card-head"><h3>Table Row Counts</h3></div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Table</th><th>Rows</th><th>Primary Key</th><th>Foreign Keys</th></tr></thead>
          <tbody>
            <tr><td><strong>departments</strong></td><td>${db.departments.length}</td><td>id</td><td>—</td></tr>
            <tr><td><strong>programs</strong></td><td>${db.programs.length}</td><td>id</td><td>department_id → departments.id</td></tr>
            <tr><td><strong>users</strong></td><td>${db.users.length}</td><td>id</td><td>—</td></tr>
            <tr><td><strong>students</strong></td><td>${db.students.length}</td><td>id</td><td>user_id → users.id, program_id → programs.id</td></tr>
            <tr><td><strong>courses</strong></td><td>${db.courses.length}</td><td>id</td><td>program_id → programs.id, department_id → departments.id</td></tr>
            <tr><td><strong>sections</strong></td><td>${db.sections.length}</td><td>id</td><td>course_id → courses.id, faculty_id → users.id</td></tr>
            <tr><td><strong>enrollments</strong></td><td>${db.enrollments.length}</td><td>id</td><td>student_id → students.id, section_id → sections.id</td></tr>
            <tr><td><strong>student_subjects</strong></td><td>${db.student_subjects.length}</td><td>id</td><td>student_id → students.id, course_id → courses.id</td></tr>
            <tr><td><strong>documents</strong></td><td>${db.documents.length}</td><td>id</td><td>student_id → students.id</td></tr>
            <tr><td><strong>payments</strong></td><td>${db.payments.length}</td><td>id</td><td>student_id → students.id</td></tr>
            <tr><td><strong>notifications</strong></td><td>${db.notifications.length}</td><td>id</td><td>user_id → users.id</td></tr>
            <tr><td><strong>audit</strong></td><td>${db.audit.length}</td><td>id</td><td>—</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="card" style="margin-bottom:22px">
      <div class="card-head"><h3>Entity Relationships</h3></div>
      <pre class="code">students ──(1:N)──► enrollments ◄──(N:1)── sections
                                      │
                                      ├──(N:1)── courses ──(N:1)── departments
                                      │              │
                                      │              └──(N:1)── programs
                                      │
                                      └──(N:1)── users (faculty)

users ──(1:1)── students
students ──(1:N)── student_subjects ──(N:1)── courses
students ──(1:N)── documents
students ──(1:N)── payments
users    ──(1:N)── notifications</pre>
    </div>

    <div class="card">
      <div class="card-head">
        <h3>SQL Schema</h3>
        <button class="btn btn-ghost btn-sm" data-action="exportSchema">⤓ Download schema.sql</button>
      </div>
      <pre class="code">${esc(SQL_SCHEMA)}</pre>
      <div style="display:flex;gap:10px;margin-top:16px;flex-wrap:wrap">
        <button class="btn btn-ghost" data-action="exportJSON">⤓ Export full database (JSON)</button>
        <button class="btn btn-danger" data-action="resetDB">⟲ Reset &amp; reseed database</button>
      </div>
    </div>`;
}

/* =========================================================================
   FACULTY VIEWS
   ========================================================================= */

function viewFacultyDashboard() {
  const mySections = db.sections.filter((s) => s.faculty_id === session.userId);
  const totalStudents = new Set(
    mySections.flatMap((s) => db.enrollments.filter((e) => e.section_id === s.id && e.status !== 'Dropped').map((e) => e.student_id))
  ).size;

  const byProgram = {};
  mySections.forEach((s) => {
    const c = courseOf(s);
    if (!c) return;
    const code = programOf(c.program_id)?.code || '—';
    byProgram[code] = (byProgram[code] || 0) + 1;
  });

  return `
    <div class="grid grid-4" style="margin-bottom:22px">
      ${statCard(mySections.length, 'Assigned Sections', 'Current semester', '🏫')}
      ${statCard(totalStudents, 'Students Handled', 'Unique learners', '👥', true)}
      ${statCard(Object.keys(byProgram).length, 'Programs Covered', Object.keys(byProgram).join(', ') || '—', '🎓')}
      ${statCard(db.enrollments.filter((e) => {
        const s = db.sections.find((x) => x.id === e.section_id);
        return s && s.faculty_id === session.userId && e.status !== 'Dropped';
      }).length, 'Total Enrollments', 'In your sections', '📝', true)}
    </div>

    <div class="card">
      <div class="card-head"><h3>My Sections</h3><span class="hint">Click a section to view its class list</span></div>
      ${mySections.length ? `<div class="grid grid-3">
        ${mySections.slice(0, 9).map((s) => {
          const c = courseOf(s);
          const used = enrolledCount(s.id);
          return `
            <div class="course-card">
              <div class="cc-top">
                <div>
                  <div class="cc-code">${esc(c.code)}</div>
                  <h4>${esc(c.title)}</h4>
                </div>
                <span class="badge badge-green">Sec ${esc(s.section_name)}</span>
              </div>
              <div class="cc-meta">
                <div>🕒 <span>${esc(s.schedule)}</span></div>
                <div>📍 <span>Room ${esc(s.room)}</span></div>
                <div>👥 <span>${used} of ${s.capacity} students</span></div>
              </div>
              ${capacityBar(s)}
              <div class="cc-foot">
                <span class="muted">${esc(programOf(c.program_id)?.code || '')} · Year ${c.year_level}</span>
                <button class="btn btn-primary btn-sm" data-action="openSection" data-id="${s.id}">Class list</button>
              </div>
            </div>`;
        }).join('')}
      </div>` : '<div class="empty"><span class="big">🏫</span>No sections are assigned to you yet.</div>'}
    </div>`;
}

function viewFacultyClasses() {
  const mySections = db.sections.filter((s) => s.faculty_id === session.userId);
  const active = ui.facultySection
    ? mySections.find((s) => s.id === Number(ui.facultySection))
    : mySections[0];

  const roster = active
    ? db.enrollments
        .filter((e) => e.section_id === active.id && e.status !== 'Dropped')
        .map((e) => ({ e, student: db.students.find((x) => x.id === e.student_id) }))
        .filter((r) => r.student)
    : [];

  return `
    <div class="toolbar">
      <select class="input-inline" style="width:auto;min-width:320px" data-change="facultySection">
        <option value="">Select a section…</option>
        ${mySections.map((s) => {
          const c = courseOf(s);
          return `<option value="${s.id}" ${active && active.id === s.id ? 'selected' : ''}>
            ${esc(c.code)} — ${esc(c.title)} (Sec ${esc(s.section_name)} · ${esc(s.schedule)})
          </option>`;
        }).join('')}
      </select>
      ${active ? `<span class="badge badge-green">${roster.length} enrolled</span>` : ''}
    </div>

    ${active ? `
      <div class="card" style="margin-bottom:20px">
        <div class="card-head">
          <div>
            <h3>${esc(courseOf(active).code)} — ${esc(courseOf(active).title)}</h3>
            <div class="hint">Section ${esc(active.section_name)} · ${esc(active.schedule)} · Room ${esc(active.room)} ·
              ${courseOf(active).units} units · ${esc(programOf(courseOf(active).program_id)?.name || '')}</div>
          </div>
          <span class="badge ${active.status === 'Full' ? 'badge-red' : 'badge-green'}">${esc(active.status)}</span>
        </div>

        <div class="table-wrap">
          <table>
            <thead>
              <tr><th>#</th><th>Student No.</th><th>Name</th><th>Program</th><th>Year</th>
                  <th>Enrolled On</th><th>Status</th><th style="text-align:right">Progress</th></tr>
            </thead>
            <tbody>
              ${roster.length ? roster.map((r, i) => `
                <tr>
                  <td class="muted">${i + 1}</td>
                  <td><strong>${esc(r.student.student_no)}</strong></td>
                  <td>${esc(r.student.full_name)}<div class="muted">${esc(r.student.email)}</div></td>
                  <td><span class="badge badge-green">${esc(programOf(r.student.program_id)?.code || '—')}</span></td>
                  <td>Year ${r.student.year_level}</td>
                  <td class="muted">${fmtDate(r.e.enrollment_date)}</td>
                  <td><span class="badge ${r.e.status === 'Enrolled' ? 'badge-green' : 'badge-grey'}">${esc(r.e.status)}</span></td>
                  <td style="text-align:right">
                    <button class="btn btn-ghost btn-sm" data-action="checkStudent" data-id="${r.student.id}">Check subjects</button>
                  </td>
                </tr>`).join('') : '<tr><td colspan="8" class="empty">No students enrolled in this section yet.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    ` : '<div class="card empty"><span class="big">👥</span>Select a section to view its class list.</div>'}`;
}

function viewFacultyProgress() {
  const mySections = db.sections.filter((s) => s.faculty_id === session.userId);
  const myStudentIds = new Set(
    db.enrollments
      .filter((e) => mySections.some((s) => s.id === e.section_id))
      .map((e) => e.student_id)
  );
  const allStudents = db.students.filter((s) => myStudentIds.has(s.id) || db.students.length <= 5);

  const selectedId = ui.facultyStudent
    ? Number(ui.facultyStudent)
    : (allStudents[0] ? allStudents[0].id : null);

  const student = db.students.find((s) => s.id === selectedId);

  let body = '<div class="card empty"><span class="big">🎓</span>Select a student to inspect their subject progress.</div>';

  if (student) {
    const prog = programOf(student.program_id);
    const taken = db.student_subjects.filter((ss) => ss.student_id === student.id);
    const takenIds = taken.map((t) => t.course_id);
    const passedIds = taken.filter((t) => t.status === 'Passed').map((t) => t.course_id);
    const enrolledCourseIds = db.enrollments
      .filter((e) => e.student_id === student.id && e.status !== 'Dropped')
      .map((e) => db.sections.find((x) => x.id === e.section_id))
      .filter(Boolean)
      .map((x) => x.course_id);

    const programCourses = db.courses
      .filter((c) => c.program_id === student.program_id)
      .sort((a, b) => a.year_level - b.year_level || a.code.localeCompare(b.code));

    const canTake = programCourses.filter((c) =>
      !takenIds.includes(c.id) &&
      !enrolledCourseIds.includes(c.id) &&
      c.year_level <= student.year_level
    );

    const locked = programCourses.filter((c) =>
      !takenIds.includes(c.id) &&
      !enrolledCourseIds.includes(c.id) &&
      c.year_level > student.year_level
    );

    const yearBlocks = {};
    programCourses.forEach((c) => {
      (yearBlocks[c.year_level] = yearBlocks[c.year_level] || []).push(c);
    });

    body = `
      <div class="grid grid-4" style="margin-bottom:20px">
        ${statCard(taken.length, 'Subjects Taken', 'On official record', '📗')}
        ${statCard(passedIds.length, 'Subjects Passed', 'Cleared prerequisites', '✅', true)}
        ${statCard(canTake.length, 'Available to Take', 'Prerequisites satisfied', '🎯')}
        ${statCard(locked.length, 'Locked', 'Higher year level', '🔒', true)}
      </div>

      <div class="card" style="margin-bottom:20px">
        <div class="card-head">
          <div>
            <h3>${esc(student.full_name)}</h3>
            <div class="hint">${esc(student.student_no)} · ${esc(prog ? prog.name : '—')} · Year ${student.year_level}</div>
          </div>
          <span class="badge ${student.status === 'Active' ? 'badge-green' : 'badge-grey'}">${esc(student.status)}</span>
        </div>

        <div class="grid grid-2">
          <div>
            <div class="section-title" style="font-size:14px">✅ Subjects already taken</div>
            ${taken.length ? taken.map((t) => {
              const c = db.courses.find((x) => x.id === t.course_id);
              if (!c) return '';
              return `<div style="display:flex;justify-content:space-between;gap:10px;padding:9px 0;border-bottom:1px solid #eef7f3">
                <div>
                  <div style="font-size:13.2px;font-weight:600">${esc(c.code)} — ${esc(c.title)}</div>
                  <div class="muted">${esc(t.term)} · ${c.units} units</div>
                </div>
                <div style="text-align:right">
                  <div style="font-weight:800">${esc(t.grade || '—')}</div>
                  <span class="badge ${t.status === 'Passed' ? 'badge-green' : 'badge-red'}">${esc(t.status)}</span>
                </div>
              </div>`;
            }).join('') : '<div class="empty" style="padding:20px">No subjects on record.</div>'}
          </div>

          <div>
            <div class="section-title" style="font-size:14px">🎯 Subjects the student can take now</div>
            ${canTake.length ? canTake.map((c) => `
              <div style="display:flex;justify-content:space-between;gap:10px;padding:9px 0;border-bottom:1px solid #eef7f3">
                <div>
                  <div style="font-size:13.2px;font-weight:600">${esc(c.code)} — ${esc(c.title)}</div>
                  <div class="muted">Year ${c.year_level} · ${c.units} units</div>
                </div>
                <span class="badge badge-gold">Available</span>
              </div>`).join('') : '<div class="empty" style="padding:20px">No eligible subjects left this term.</div>'}
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-head"><h3>Full Curriculum Checklist</h3><span class="hint">Grouped by year level</span></div>
        ${Object.keys(yearBlocks).sort().map((y) => `
          <div style="margin-bottom:18px">
            <div class="section-title" style="font-size:13.4px;color:var(--gold-600)">YEAR ${y}</div>
            <div class="table-wrap">
              <table>
                <thead><tr><th>Code</th><th>Subject</th><th>Units</th><th>Status</th></tr></thead>
                <tbody>
                  ${yearBlocks[y].map((c) => {
                    let badge = '<span class="badge badge-grey">Not taken</span>';
                    if (passedIds.includes(c.id)) badge = '<span class="badge badge-green">Passed</span>';
                    else if (takenIds.includes(c.id)) badge = '<span class="badge badge-red">Failed</span>';
                    else if (enrolledCourseIds.includes(c.id)) badge = '<span class="badge badge-blue">Enrolled now</span>';
                    else if (c.year_level <= student.year_level) badge = '<span class="badge badge-gold">Can take</span>';
                    else badge = '<span class="badge badge-grey">Locked</span>';
                    return `<tr>
                      <td><strong>${esc(c.code)}</strong></td>
                      <td>${esc(c.title)}</td>
                      <td>${c.units}</td>
                      <td>${badge}</td>
                    </tr>`;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>`).join('')}
      </div>`;
  }

  return `
    <div class="toolbar">
      <select class="input-inline" style="width:auto;min-width:320px" data-change="facultyStudent">
        <option value="">Select a student…</option>
        ${allStudents.map((s) => `<option value="${s.id}" ${selectedId === s.id ? 'selected' : ''}>
          ${esc(s.full_name)} — ${esc(programOf(s.program_id)?.code || '')} Year ${s.year_level}
        </option>`).join('')}
      </select>
    </div>
    ${body}`;
}

/* =========================================================================
   ADMIN ACTIONS — COURSE / SECTION / STUDENT MANAGEMENT
   ========================================================================= */

function courseFormModal(course) {
  const isEdit = !!course;
  openModal({
    title: isEdit ? 'Edit Course' : 'Add New Course',
    wide: true,
    body: `
      <form id="courseForm">
        <input type="hidden" name="id" value="${isEdit ? course.id : ''}">
        <div class="field-row">
          <div class="field">
            <label>Course Code *</label>
            <input name="code" required value="${isEdit ? esc(course.code) : ''}" placeholder="BSCS-101">
          </div>
          <div class="field">
            <label>Units *</label>
            <input name="units" type="number" min="1" max="12" required value="${isEdit ? course.units : 3}">
          </div>
        </div>
        <div class="field">
          <label>Descriptive Title *</label>
          <input name="title" required value="${isEdit ? esc(course.title) : ''}" placeholder="Introduction to Computing">
        </div>
        <div class="field-row">
          <div class="field">
            <label>Program *</label>
            <select name="program_id" required>
              ${db.programs.map((p) => `<option value="${p.id}" ${isEdit && course.program_id === p.id ? 'selected' : ''}>${esc(p.code)} — ${esc(p.name)}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label>Year Level *</label>
            <select name="year_level" required>
              ${[1, 2, 3, 4].map((y) => `<option value="${y}" ${isEdit && course.year_level === y ? 'selected' : ''}>Year ${y}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="field-row">
          <div class="field">
            <label>Department *</label>
            <select name="department_id" required>
              ${db.departments.map((d) => `<option value="${d.id}" ${isEdit && course.department_id === d.id ? 'selected' : ''}>${esc(d.name)}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label>Semester</label>
            <select name="semester">
              <option ${isEdit && course.semester === '1st Semester' ? 'selected' : ''}>1st Semester</option>
              <option ${isEdit && course.semester === '2nd Semester' ? 'selected' : ''}>2nd Semester</option>
              <option ${isEdit && course.semester === 'Summer' ? 'selected' : ''}>Summer</option>
            </select>
          </div>
        </div>
      </form>`,
    footer: `
      <button class="btn btn-ghost" data-action="closeModal">Cancel</button>
      <button class="btn btn-primary" type="submit" form="courseForm">${isEdit ? 'Save changes' : 'Create course'}</button>`
  });
}

function saveCourseForm(form) {
  const fd = new FormData(form);
  const id = Number(fd.get('id')) || 0;
  const payload = {
    code: String(fd.get('code')).trim(),
    title: String(fd.get('title')).trim(),
    units: Number(fd.get('units')),
    program_id: Number(fd.get('program_id')),
    year_level: Number(fd.get('year_level')),
    department_id: Number(fd.get('department_id')),
    semester: String(fd.get('semester'))
  };

  if (db.courses.some((c) => c.code.toLowerCase() === payload.code.toLowerCase() && c.id !== id)) {
    return toast('A course with that code already exists.', 'error');
  }

  if (id) {
    const c = db.courses.find((x) => x.id === id);
    Object.assign(c, payload);
    logAudit('COURSE_UPDATE', `Course ${payload.code} updated.`);
    toast('Course updated.');
  } else {
    db.courses.push({ id: nextId('courses'), ...payload, course_date: nowISO() });
    logAudit('COURSE_CREATE', `Course ${payload.code} created.`);
    toast('Course created.');
  }
  saveDB();
  closeModal();
  renderContent();
}

function deleteCourse(id) {
  const c = db.courses.find((x) => x.id === id);
  if (!c) return;
  const secs = db.sections.filter((s) => s.course_id === id);
  const enrCount = db.enrollments.filter((e) => secs.some((s) => s.id === e.section_id)).length;

  openModal({
    title: 'Remove course?',
    body: `<p style="font-size:14px">You are about to remove <strong>${esc(c.code)} — ${esc(c.title)}</strong>.</p>
      <div class="notice notice-gold" style="margin-top:14px">
        <span>⚠️</span>
        <span>This will also delete <strong>${secs.length}</strong> section(s) and
        <strong>${enrCount}</strong> enrollment record(s) linked to this course (ON DELETE CASCADE).</span>
      </div>`,
    footer: `
      <button class="btn btn-ghost" data-action="closeModal">Cancel</button>
      <button class="btn btn-danger" data-action="confirmCourseDelete" data-id="${id}">Yes, remove it</button>`
  });
}

function confirmCourseDelete(id) {
  const c = db.courses.find((x) => x.id === id);
  const secIds = db.sections.filter((s) => s.course_id === id).map((s) => s.id);
  db.enrollments = db.enrollments.filter((e) => !secIds.includes(e.section_id));
  db.sections = db.sections.filter((s) => s.course_id !== id);
  db.courses = db.courses.filter((x) => x.id !== id);
  logAudit('COURSE_DELETE', `Course ${c ? c.code : id} removed.`);
  saveDB();
  closeModal();
  renderContent();
  toast('Course removed.');
}

function sectionFormModal(section) {
  const isEdit = !!section;
  openModal({
    title: isEdit ? 'Edit Section' : 'Add New Section',
    wide: true,
    body: `
      <form id="sectionForm">
        <input type="hidden" name="id" value="${isEdit ? section.id : ''}">
        <div class="field">
          <label>Course *</label>
          <select name="course_id" required>
            ${db.courses.sort((a, b) => a.code.localeCompare(b.code)).map((c) => `
              <option value="${c.id}" ${isEdit && section.course_id === c.id ? 'selected' : ''}>
                ${esc(c.code)} — ${esc(c.title)} (${esc(programOf(c.program_id)?.code || '')} Y${c.year_level})
              </option>`).join('')}
          </select>
        </div>
        <div class="field-row">
          <div class="field">
            <label>Section Name *</label>
            <input name="section_name" required value="${isEdit ? esc(section.section_name) : 'A'}" maxlength="6">
          </div>
          <div class="field">
            <label>Room *</label>
            <input name="room" required value="${isEdit ? esc(section.room) : ''}" placeholder="MB-201">
          </div>
        </div>
        <div class="field-row">
          <div class="field">
            <label>Schedule *</label>
            <input name="schedule" required value="${isEdit ? esc(section.schedule) : ''}" placeholder="MW 08:00-09:30">
          </div>
          <div class="field">
            <label>Capacity *</label>
            <input name="capacity" type="number" min="1" max="200" required value="${isEdit ? section.capacity : 30}">
          </div>
        </div>
        <div class="field-row">
          <div class="field">
            <label>Faculty</label>
            <select name="faculty_id">
              <option value="">— Unassigned —</option>
              ${db.users.filter((u) => u.role === 'faculty').map((u) => `
                <option value="${u.id}" ${isEdit && section.faculty_id === u.id ? 'selected' : ''}>${esc(u.name)}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label>Status</label>
            <select name="status">
              <option ${isEdit && section.status === 'Open' ? 'selected' : ''}>Open</option>
              <option ${isEdit && section.status === 'Full' ? 'selected' : ''}>Full</option>
              <option ${isEdit && section.status === 'Closed' ? 'selected' : ''}>Closed</option>
            </select>
          </div>
        </div>
        <p class="form-note" style="text-align:left">Schedule format: <strong>MW 08:00-09:30</strong> ·
          day codes <strong>M, T, W, Th, F, S</strong>.</p>
      </form>`,
    footer: `
      <button class="btn btn-ghost" data-action="closeModal">Cancel</button>
      <button class="btn btn-primary" type="submit" form="sectionForm">${isEdit ? 'Save changes' : 'Create section'}</button>`
  });
}

function saveSectionForm(form) {
  const fd = new FormData(form);
  const id = Number(fd.get('id')) || 0;
  const schedule = String(fd.get('schedule')).trim();

  if (!parseSchedule(schedule)) {
    return toast('Invalid schedule format. Use e.g. "MW 08:00-09:30".', 'error');
  }

  const payload = {
    course_id: Number(fd.get('course_id')),
    section_name: String(fd.get('section_name')).trim().toUpperCase(),
    schedule,
    room: String(fd.get('room')).trim(),
    capacity: Number(fd.get('capacity')),
    faculty_id: Number(fd.get('faculty_id')) || null,
    status: String(fd.get('status'))
  };

  if (id) {
    const s = db.sections.find((x) => x.id === id);
    Object.assign(s, payload);
    logAudit('SECTION_UPDATE', `Section ${s.section_name} of course #${s.course_id} updated.`);
    toast('Section updated.');
  } else {
    db.sections.push({ id: nextId('sections'), ...payload, created_at: nowISO() });
    logAudit('SECTION_CREATE', `New section ${payload.section_name} created.`);
    toast('Section created.');
  }
  saveDB();
  closeModal();
  renderContent();
}

function toggleSectionStatus(id) {
  const s = db.sections.find((x) => x.id === id);
  if (!s) return;
  const c = courseOf(s);
  const used = enrolledCount(s.id);

  if (s.status === 'Full' || used >= s.capacity) {
    s.status = 'Open';
    if (used >= s.capacity) s.capacity = used + 10;
    toast('Section reopened with additional slots.');
  } else {
    s.status = 'Full';
    toast('Section marked as FULL.');
  }
  logAudit('SECTION_STATUS', `${c.code} Sec ${s.section_name} → ${s.status}.`);
  saveDB();
  renderContent();
}

function deleteSection(id) {
  const s = db.sections.find((x) => x.id === id);
  if (!s) return;
  const c = courseOf(s);
  const enr = db.enrollments.filter((e) => e.section_id === id);

  openModal({
    title: 'Delete section?',
    body: `<p style="font-size:14px">Delete <strong>${esc(c.code)} — Section ${esc(s.section_name)}</strong>?</p>
      <div class="notice notice-gold" style="margin-top:14px">
        <span>⚠️</span><span>${enr.length} enrollment record(s) will also be removed.</span>
      </div>`,
    footer: `
      <button class="btn btn-ghost" data-action="closeModal">Cancel</button>
      <button class="btn btn-danger" data-action="confirmSectionDelete" data-id="${id}">Delete section</button>`
  });
}

function confirmSectionDelete(id) {
  db.enrollments = db.enrollments.filter((e) => e.section_id !== id);
  db.sections = db.sections.filter((s) => s.id !== id);
  logAudit('SECTION_DELETE', `Section #${id} deleted.`);
  saveDB();
  closeModal();
  renderContent();
  toast('Section deleted.');
}

function manageStudentModal(studentId) {
  const s = db.students.find((x) => x.id === studentId);
  if (!s) return;

  const prog = programOf(s.program_id);
  const docs = db.documents.filter((d) => d.student_id === s.id);
  const enrollments = db.enrollments.filter((e) => e.student_id === s.id && e.status !== 'Dropped');
  const taken = db.student_subjects.filter((t) => t.student_id === s.id);

  const docRows = DOC_TYPES.map((name) => {
    const rec = docs.find((d) => d.name === name) || { id: null, name, status: 'Missing' };
    return `
      <tr>
        <td>${esc(name)}</td>
        <td>
          <select class="input-inline" style="padding:6px 9px;font-size:12.6px" data-change="docStatus"
                  data-student="${s.id}" data-doc="${esc(name)}">
            ${['Verified', 'Pending', 'Missing'].map((st) =>
              `<option ${rec.status === st ? 'selected' : ''}>${st}</option>`).join('')}
          </select>
        </td>
      </tr>`;
  }).join('');

  openModal({
    title: `Manage Student — ${s.full_name}`,
    wide: true,
    body: `
      <form id="studentForm">
        <input type="hidden" name="id" value="${s.id}">
        <div class="field-row">
          <div class="field">
            <label>Full Name</label>
            <input name="full_name" value="${esc(s.full_name)}" required>
          </div>
          <div class="field">
            <label>Student Number</label>
            <input name="student_no" value="${esc(s.student_no)}" required>
          </div>
        </div>
        <div class="field-row">
          <div class="field">
            <label>Email</label>
            <input name="email" type="email" value="${esc(s.email)}" required>
          </div>
          <div class="field">
            <label>Mobile No.</label>
            <input name="phone" value="${esc(s.phone)}">
          </div>
        </div>
        <div class="field-row">
          <div class="field">
            <label>Program</label>
            <select name="program_id">
              ${db.programs.map((p) => `<option value="${p.id}" ${s.program_id === p.id ? 'selected' : ''}>${esc(p.code)} — ${esc(p.name)}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label>Year Level</label>
            <select name="year_level">
              ${[1, 2, 3, 4].map((y) => `<option value="${y}" ${s.year_level === y ? 'selected' : ''}>Year ${y}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="field">
          <label>Enrollment Status</label>
          <select name="status">
            ${['Active', 'On Leave', 'Graduated', 'Dropped', 'Inactive'].map((st) =>
              `<option ${s.status === st ? 'selected' : ''}>${st}</option>`).join('')}
          </select>
        </div>
      </form>

      <div class="section-title" style="font-size:14px;margin-top:22px">Document Tracking</div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Requirement</th><th>Status</th></tr></thead>
          <tbody>${docRows}</tbody>
        </table>
      </div>

      <div class="section-title" style="font-size:14px;margin-top:22px">Currently Enrolled Subjects</div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Course</th><th>Section</th><th>Schedule</th><th>Status</th><th></th></tr></thead>
          <tbody>
            ${enrollments.length ? enrollments.map((e) => {
              const sec = db.sections.find((x) => x.id === e.section_id);
              const c = sec && courseOf(sec);
              if (!c) return '';
              return `<tr>
                <td><strong>${esc(c.code)}</strong><div class="muted">${esc(c.title)}</div></td>
                <td>${esc(sec.section_name)}</td>
                <td>${esc(sec.schedule)}</td>
                <td><span class="badge badge-green">${esc(e.status)}</span></td>
                <td style="text-align:right">
                  <button class="btn btn-danger btn-sm" data-action="adminDrop" data-id="${e.id}">Remove</button>
                </td>
              </tr>`;
            }).join('') : '<tr><td colspan="5" class="empty">No active enrollments.</td></tr>'}
          </tbody>
        </table>
      </div>

      <div class="section-title" style="font-size:14px;margin-top:22px">Subjects Taken (${taken.length})</div>
      <div class="table-wrap" style="max-height:240px;overflow:auto">
        <table>
          <thead><tr><th>Course</th><th>Grade</th><th>Status</th><th></th></tr></thead>
          <tbody>
            ${taken.length ? taken.map((t) => {
              const c = db.courses.find((x) => x.id === t.course_id);
              if (!c) return '';
              return `<tr>
                <td><strong>${esc(c.code)}</strong><div class="muted">${esc(c.title)}</div></td>
                <td>${esc(t.grade || '—')}</td>
                <td><span class="badge ${t.status === 'Passed' ? 'badge-green' : 'badge-red'}">${esc(t.status)}</span></td>
                <td style="text-align:right">
                  <button class="btn btn-danger btn-sm" data-action="removeRecord" data-id="${t.id}">Delete</button>
                </td>
              </tr>`;
            }).join('') : '<tr><td colspan="4" class="empty">No academic records.</td></tr>'}
          </tbody>
        </table>
      </div>

      <div class="section-title" style="font-size:14px;margin-top:22px">Record a Completed Subject</div>
      <form id="recordForm" style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end">
        <input type="hidden" name="student_id" value="${s.id}">
        <div class="field" style="flex:2;min-width:200px;margin:0">
          <label>Course</label>
          <select name="course_id" required>
            ${db.courses.filter((c) => c.program_id === s.program_id)
              .sort((a, b) => a.year_level - b.year_level || a.code.localeCompare(b.code))
              .map((c) => `<option value="${c.id}">${esc(c.code)} — ${esc(c.title)}</option>`).join('')}
          </select>
        </div>
        <div class="field" style="width:110px;margin:0">
          <label>Grade</label>
          <input name="grade" placeholder="1.75">
        </div>
        <div class="field" style="width:130px;margin:0">
          <label>Status</label>
          <select name="status">
            <option>Passed</option>
            <option>Failed</option>
            <option>In Progress</option>
          </select>
        </div>
        <button class="btn btn-primary btn-sm" type="submit" style="height:42px">Add record</button>
      </form>`,
    footer: `
      <button class="btn btn-ghost" data-action="closeModal">Close</button>
      <button class="btn btn-primary" type="submit" form="studentForm">Save student details</button>`
  });
}

function saveStudentForm(form) {
  const fd = new FormData(form);
  const id = Number(fd.get('id'));
  const s = db.students.find((x) => x.id === id);
  if (!s) return;

  const program_id = Number(fd.get('program_id'));
  const year_level = Number(fd.get('year_level'));
  const prog = programOf(program_id);

  if (year_level > prog.years) {
    return toast(`${prog.code} only offers ${prog.years} year level(s).`, 'error');
  }

  Object.assign(s, {
    full_name: String(fd.get('full_name')).trim(),
    student_no: String(fd.get('student_no')).trim(),
    email: String(fd.get('email')).trim(),
    phone: String(fd.get('phone')).trim(),
    program_id,
    year_level,
    status: String(fd.get('status'))
  });

  logAudit('STUDENT_UPDATE', `Student record for ${s.full_name} updated.`);
  saveDB();
  closeModal();
  renderContent();
  toast('Student record updated.');
}

function updateDocStatus(studentId, docName, status) {
  let rec = db.documents.find((d) => d.student_id === Number(studentId) && d.name === docName);
  if (!rec) {
    rec = { id: nextId('documents'), student_id: Number(studentId), name: docName, status, updated_at: nowISO() };
    db.documents.push(rec);
  } else {
    rec.status = status;
    rec.updated_at = nowISO();
  }
  logAudit('DOCUMENT', `${docName} marked as ${status}.`);
  saveDB();
  toast(`${docName} → ${status}`);
}

function addStudentRecord(form) {
  const fd = new FormData(form);
  const student_id = Number(fd.get('student_id'));
  const course_id = Number(fd.get('course_id'));

  if (db.student_subjects.some((t) => t.student_id === student_id && t.course_id === course_id)) {
    return toast('This subject is already on the student record.', 'error');
  }

  db.student_subjects.push({
    id: nextId('student_subjects'),
    student_id,
    course_id,
    status: String(fd.get('status')),
    grade: String(fd.get('grade') || '').trim() || null,
    term: 'Recorded by Registrar',
    recorded_at: nowISO()
  });

  const c = db.courses.find((x) => x.id === course_id);
  logAudit('RECORD_ADD', `Subject ${c ? c.code : course_id} recorded for student #${student_id}.`);
  saveDB();
  closeModal();
  renderContent();
  toast('Academic record added.');
}

/* =========================================================================
   GLOBAL EVENT HANDLING
   ========================================================================= */

document.addEventListener('click', (e) => {

  /* close modal when clicking the dark backdrop itself */
  const backdrop = e.target.closest('.modal-backdrop');
  if (backdrop && e.target === backdrop) { closeModal(); return; }

  /* sidebar navigation */
  const navBtn = e.target.closest('[data-nav]');
  if (navBtn) {
    ui.view = navBtn.dataset.nav;
    renderContent();
    return;
  }

  /* data-action buttons */
  const btn = e.target.closest('[data-action]');
  if (!btn) return;

  const action = btn.dataset.action;
  const id = Number(btn.dataset.id) || 0;

  switch (action) {
    case 'closeModal': closeModal(); break;

    case 'authTab':
      ui.authTab = btn.dataset.tab;
      renderAuth();
      break;

    case 'logout': {
      logAudit('LOGOUT', `${session.name} signed out.`);
      saveDB();
      session = null;
      localStorage.removeItem(SESSION_KEY);
      ui.view = 'dashboard';
      renderShell();
      renderAuth();
      break;
    }

    /* ---------- student ---------- */
    case 'enroll': handleEnroll(Number(btn.dataset.section)); break;
    case 'dropEnroll': handleDrop(id); break;
    case 'confirmDrop': confirmDrop(id); break;
    case 'payTuition': handlePayTuition(); break;
    case 'confirmPay': confirmPay(btn.dataset.amount); break;

    /* ---------- admin : courses ---------- */
    case 'courseNew': courseFormModal(null); break;
    case 'courseEdit': courseFormModal(db.courses.find((c) => c.id === id)); break;
    case 'courseDelete': deleteCourse(id); break;
    case 'confirmCourseDelete': confirmCourseDelete(id); break;

    /* ---------- admin : sections ---------- */
    case 'sectionNew': sectionFormModal(null); break;
    case 'sectionEdit': sectionFormModal(db.sections.find((s) => s.id === id)); break;
    case 'sectionToggle': toggleSectionStatus(id); break;
    case 'sectionDelete': deleteSection(id); break;
    case 'confirmSectionDelete': confirmSectionDelete(id); break;

    /* ---------- admin : students ---------- */
    case 'studentManage': manageStudentModal(id); break;
    case 'adminDrop': {
      const enr = db.enrollments.find((x) => x.id === id);
      if (!enr) break;
      const sec = db.sections.find((x) => x.id === enr.section_id);
      db.enrollments = db.enrollments.filter((x) => x.id !== id);
      if (sec && sec.status === 'Full' && enrolledCount(sec.id) < sec.capacity) sec.status = 'Open';
      logAudit('ADMIN_DROP', `Registrar removed enrollment #${id}.`);
      saveDB();
      closeModal();
      renderContent();
      toast('Enrollment removed by admin.');
      break;
    }
    case 'removeRecord': {
      db.student_subjects = db.student_subjects.filter((x) => x.id !== id);
      logAudit('RECORD_DELETE', `Academic record #${id} deleted.`);
      saveDB();
      closeModal();
      renderContent();
      toast('Academic record deleted.');
      break;
    }

    /* ---------- admin : exports & maintenance ---------- */
    case 'exportStudents': {
      const rows = [['Student No', 'Name', 'Email', 'Phone', 'Program', 'Year', 'Status']];
      db.students.forEach((s) => rows.push([
        s.student_no, s.full_name, s.email, s.phone,
        programOf(s.program_id)?.code || '', s.year_level, s.status
      ]));
      downloadCSV('ucc-students.csv', rows);
      toast('Student list exported.');
      break;
    }
    case 'exportPrograms': {
      const rows = [['Program', 'Name', 'Students', 'Courses', 'Enrollments']];
      db.programs.forEach((p) => {
        const courseIds = db.courses.filter((c) => c.program_id === p.id).map((c) => c.id);
        const enr = db.enrollments.filter((e) => {
          const sec = db.sections.find((x) => x.id === e.section_id);
          return sec && courseIds.includes(sec.course_id);
        }).length;
        rows.push([p.code, p.name, db.students.filter((s) => s.program_id === p.id).length, courseIds.length, enr]);
      });
      downloadCSV('ucc-program-report.csv', rows);
      toast('Program report exported.');
      break;
    }
    case 'exportSchema': {
      const blob = new Blob([SQL_SCHEMA], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'schema.sql';
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      toast('schema.sql downloaded.');
      break;
    }
    case 'exportJSON': {
      const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'ucc-database.json';
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      toast('Full database exported.');
      break;
    }
    case 'resetDB':
      openModal({
        title: 'Reset the entire database?',
        body: `<div class="notice notice-gold">
          <span>⚠️</span><span>All students, enrollments, courses, sections, payments and documents will be
          <strong>permanently deleted</strong> and replaced with the default seed data.</span></div>`,
        footer: `
          <button class="btn btn-ghost" data-action="closeModal">Cancel</button>
          <button class="btn btn-danger" data-action="confirmReset">Yes, reset everything</button>`
      });
      break;
    case 'confirmReset':
      db = seedDatabase();
      saveDB();
      closeModal();
      renderContent();
      toast('Database reset and reseeded.');
      break;

    /* ---------- faculty ---------- */
    case 'openSection':
      ui.facultySection = id;
      ui.view = 'classes';
      renderContent();
      break;
    case 'checkStudent':
      ui.facultyStudent = id;
      ui.view = 'progress';
      renderContent();
      break;
  }
});

/* ---- form submissions ---- */
document.addEventListener('submit', (e) => {
  e.preventDefault();
  const f = e.target;
  switch (f.id) {
    case 'loginForm': doLogin(f); break;
    case 'registerForm': doRegister(f); break;
    case 'courseForm': saveCourseForm(f); break;
    case 'sectionForm': saveSectionForm(f); break;
    case 'studentForm': saveStudentForm(f); break;
    case 'recordForm': addStudentRecord(f); break;
  }
});

/* ---- select changes ---- */
document.addEventListener('change', (e) => {
  const el = e.target.closest('[data-change]');
  if (!el) return;
  const key = el.dataset.change;

  if (key === 'browseYear') { ui.browseYear = el.value === 'all' ? 'all' : Number(el.value); renderContent(); }
  else if (key === 'filterProg') { ui.sectionFilterProg = el.value; renderContent(); }
  else if (key === 'facultySection') { ui.facultySection = Number(el.value) || null; renderContent(); }
  else if (key === 'facultyStudent') { ui.facultyStudent = Number(el.value) || null; renderContent(); }
  else if (key === 'docStatus') { updateDocStatus(el.dataset.student, el.dataset.doc, el.value); }
});

/* ---- live search inputs ---- */
document.addEventListener('input', (e) => {
  const id = e.target.id;
  if (id === 'browseSearch') {
    ui.browseSearch = e.target.value;
    clearTimeout(window.__searchTimer);
    window.__searchTimer = setTimeout(() => {
      const pos = e.target.selectionStart;
      renderContent();
      const next = $('#browseSearch');
      if (next) { next.focus(); next.setSelectionRange(pos, pos); }
    }, 320);
  } else if (id === 'courseSearch') {
    ui.sectionSearch = e.target.value;
    clearTimeout(window.__searchTimer2);
    window.__searchTimer2 = setTimeout(() => {
      const pos = e.target.selectionStart;
      renderContent();
      const next = $('#courseSearch');
      if (next) { next.focus(); next.setSelectionRange(pos, pos); }
    }, 320);
  } else if (id === 'studentSearch') {
    ui.studentSearch = e.target.value;
    clearTimeout(window.__searchTimer3);
    window.__searchTimer3 = setTimeout(() => {
      const pos = e.target.selectionStart;
      renderContent();
      const next = $('#studentSearch');
      if (next) { next.focus(); next.setSelectionRange(pos, pos); }
    }, 320);
  }
});

/* =========================================================================
   BOOTSTRAP
   ========================================================================= */

function boot() {
  loadDB();

  const raw = localStorage.getItem(SESSION_KEY);
  if (raw) {
    try {
      const s = JSON.parse(raw);
      const user = db.users.find((u) => u.id === s.userId);
      if (user && user.status === 'Active') {
        session = { userId: user.id, role: user.role, name: user.name };
        ui.view = 'dashboard';
      } else {
        localStorage.removeItem(SESSION_KEY);
      }
    } catch (err) {
      localStorage.removeItem(SESSION_KEY);
    }
  }

  if (session) {
    renderShell();
    renderContent();
  } else {
    renderAuth();
  }
}

boot();