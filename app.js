/* =========================================================================
   UNIDA CHRISTIAN COLLEGES — ADMISSIONS PORTAL (app.js)
   PART 1 / 4 — Utilities, Constants, State, Database
   ========================================================================= */

/* ============================ UTILITIES ============================ */

const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

const nowISO = () => new Date().toISOString();

function hash(pw) {
  let h = 5381;
  const s = pw + '::ucc$salt';
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) + s.charCodeAt(i);
    h = h & 0xffffffff;
  }
  return 'sim$' + Math.abs(h).toString(16);
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

/* ============================ CONSTANTS ============================ */

const DB_KEY = 'ucc_portal_v1';
const SESSION_KEY = 'ucc_portal_session_v1';

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
  { id: 'psa',       title: 'PSA Birth Certificate',            desc: 'Upload a clear copy of your PSA Birth Certificate.' },
  { id: 'goodmoral', title: 'Good Moral',                        desc: 'Upload a clear copy of your Good Moral.' },
  { id: 'idpic',     title: '2x2 ID Picture',                    desc: 'Upload a recent 2x2 photo (white background).' }
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
  <circle cx="50" cy="50" r="48" fill="#0d3b28"/>
  <circle cx="50" cy="50" r="42" fill="none" stroke="#d4af37" stroke-width="2"/>
  <text x="50" y="45" text-anchor="middle" fill="#d4af37" font-family="Georgia, serif" font-size="11" font-weight="700">UNIDA</text>
  <text x="50" y="58" text-anchor="middle" fill="#ffffff" font-family="Georgia, serif" font-size="7">CHRISTIAN</text>
  <text x="50" y="68" text-anchor="middle" fill="#ffffff" font-family="Georgia, serif" font-size="7">COLLEGES</text>
</svg>`;

/* ============================ STATE ============================ */

let db = null;
let session = null;

const state = {
  authTab: 'login',
  view: 'dashboard',
  step: 1,
  docType: null,
  showUserMenu: false
};

/* ============================ DATABASE ============================ */

function loadDB() {
  const raw = localStorage.getItem(DB_KEY);
  if (raw) {
    try { db = JSON.parse(raw); return; } catch (e) {}
  }
  db = { users: [], applications: [] };
  saveDB();
}

function saveDB() { localStorage.setItem(DB_KEY, JSON.stringify(db)); }

function currentUser() { return db.users.find((u) => u.id === session.userId); }

function currentApp() {
  const u = currentUser();
  if (!u) return null;
  let app = db.applications.find((a) => a.user_id === u.id);
  if (!app) {
    app = {
      id: db.applications.length + 1,
      user_id: u.id,
      personal: {}, education: {}, program: {}, documents: {},
      docType: null, submitted: false, submittedAt: null,
      reference: null, certified: false
    };
    db.applications.push(app);
    saveDB();
  }
  return app;
}

function computeCompletedSteps(app) {
  let done = 0;
  if (app.personal && app.personal.first_name) done = Math.max(done, 1);
  if (app.education && app.education.elem && app.education.elem.school) done = Math.max(done, 2);
  if (app.program && app.program.preferred) done = Math.max(done, 3);
  if (app.docType && app.documents) {
    const list = app.docType === 'new' ? DOCS_NEW : DOCS_TRANSFEREE;
    if (list.every((d) => app.documents[d.id])) done = Math.max(done, 4);
  }
  return done;
}

/* =========================================================================
   PART 2 / 4 — Auth, Navbar, Auth Page
   ========================================================================= */

/* ============================ AUTH ============================ */

function doLogin(form) {
  const fd = new FormData(form);
  const email = String(fd.get('email') || '').trim().toLowerCase();
  const pw = String(fd.get('password') || '');

  const user = db.users.find((u) => u.email.toLowerCase() === email);
  if (!user) return toast('No account found with that email.', 'error');
  if (user.password_hash !== hash(pw)) return toast('Incorrect password.', 'error');

  session = { userId: user.id, name: user.name, email: user.email };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  state.view = 'dashboard';
  state.step = 1;

  toast(`Welcome, ${user.name.split(' ')[0]}!`);
  renderAll();
}

function doRegister(form) {
  const fd = new FormData(form);
  const name  = String(fd.get('name') || '').trim();
  const email = String(fd.get('email') || '').trim().toLowerCase();
  const pw    = String(fd.get('password') || '');
  const pw2   = String(fd.get('password2') || '');

  if (!name || !email || !pw) return toast('Please complete all fields.', 'error');
  if (pw.length < 6) return toast('Password must be at least 6 characters.', 'error');
  if (pw !== pw2) return toast('Passwords do not match.', 'error');
  if (db.users.some((u) => u.email.toLowerCase() === email)) {
    return toast('That email is already registered.', 'error');
  }

  const id = db.users.reduce((m, u) => Math.max(m, u.id), 0) + 1;
  db.users.push({ id, name, email, password_hash: hash(pw), created_at: nowISO() });
  saveDB();

  session = { userId: id, name, email };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  state.view = 'dashboard';
  state.step = 1;

  toast('Account created. Welcome to UCC!');
  renderAll();
}

function doLogout() {
  session = null;
  localStorage.removeItem(SESSION_KEY);
  state.view = 'dashboard';
  state.step = 1;
  state.docType = null;
  state.showUserMenu = false;
  renderAll();
}

/* ============================ NAVBAR ============================ */

function renderNavbar() {
  const nav = $('#navbar');
  if (!session) { nav.classList.add('hidden'); return; }
  nav.classList.remove('hidden');

  const u = currentUser();
  const menu = state.showUserMenu ? 'open' : '';

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
      <div class="nav-user-menu ${menu}">
        <div class="um-name">
          <strong>${esc(u.name)}</strong>
          <span>${esc(u.email)}</span>
        </div>
        <button data-action="logout">Sign out</button>
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
    <div class="hero-bg-illustration">
      <svg viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice">
        <defs>
          <radialGradient id="g1" cx="50%" cy="50%">
            <stop offset="0%" stop-color="#2f9666" stop-opacity=".4"/>
            <stop offset="100%" stop-color="#0a2e1f" stop-opacity="0"/>
          </radialGradient>
        </defs>
        <circle cx="200" cy="200" r="300" fill="url(#g1)"/>
        <circle cx="1000" cy="600" r="400" fill="url(#g1)"/>
      </svg>
    </div>

    <div class="hero-left">
      <h1 class="hero-heading">UNIDA CHRISTIAN COLLEGES</h1>
      <p class="hero-sub">At UCC, we shape excellence, integrity, and purpose for life.</p>
      <div>
        <button class="btn btn-gold btn-lg" data-action="focusAuth">ENROLL NOW!</button>
      </div>
      <div class="hero-tagline">
        <div class="line1">Dream High, Aim High</div>
        <div class="line2">AMBASSADORS!</div>
      </div>
    </div>

    <div class="hero-right">
      <div class="auth-card" id="authCard">
        <h2>${tab === 'login' ? 'Welcome Back' : 'Create Account'}</h2>
        <p class="auth-desc">
          ${tab === 'login'
            ? 'Sign in to continue your application.'
            : 'Register with your email to begin your application.'}
        </p>

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
              <input type="email" name="email" required placeholder="you@example.com">
            </div>
            <div class="field">
              <label>Password <span class="req">*</span></label>
              <input type="password" name="password" required placeholder="••••••••">
            </div>
            <button class="btn btn-primary btn-block" type="submit" style="margin-top:6px">
              Sign In →
            </button>
            <p style="text-align:center;font-size:12.5px;color:var(--muted);margin-top:16px">
              Demo: <strong>student@ucc.edu.ph</strong> / <strong>student123</strong>
            </p>
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
            <button class="btn btn-primary btn-block" type="submit" style="margin-top:6px">
              Create Account →
            </button>
          </form>
        `}
      </div>
    </div>
  `;

  if (!db.users.some((u) => u.email === 'student@ucc.edu.ph')) {
    db.users.push({
      id: 1,
      name: 'Carlos John Daniel R.',
      email: 'student@ucc.edu.ph',
      password_hash: hash('student123'),
      created_at: nowISO()
    });
    saveDB();
  }
}

/* =========================================================================
   PART 3 / 4 — Dashboard and Apply Steps
   ========================================================================= */

/* ============================ DASHBOARD ============================ */

function renderDashboard() {
  const wrap = $('#pageWrap');
  wrap.classList.remove('hidden');

  const app = currentApp();
  const completed = app.submitted ? 5 : computeCompletedSteps(app);

  wrap.innerHTML = `
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
          const isDone   = s.id <= completed;
          const isActive = s.id === completed + 1 && !app.submitted;
          const cls      = isDone ? 'done' : (isActive ? 'active' : '');
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
            <p>Reference: <strong>${esc(app.reference)}</strong> · ${new Date(app.submittedAt).toLocaleDateString()}</p>
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

/* ============================ APPLY ============================ */

function renderApply() {
  const wrap = $('#pageWrap');
  wrap.classList.remove('hidden');

  const app = currentApp();
  const completed = computeCompletedSteps(app);
  const step = state.step;

  wrap.innerHTML = `
    <div class="apply-layout">
      <aside class="apply-sidebar">
        ${STEP_LABELS.map((s) => {
          const isDone   = s.id <= completed;
          const isActive = s.id === step;
          const cls      = isActive ? 'active' : (isDone ? 'done' : '');
          return `
            <button class="sidebar-step ${cls}" data-action="gotoStep" data-step="${s.id}">
              <span class="ss-icon">${s.icon}</span>
              <span>${s.label}</span>
            </button>
          `;
        }).join('')}
      </aside>
      <section class="apply-main" id="applyMain">
        ${renderApplyStep(step, app)}
      </section>
    </div>
  `;
}

function renderApplyStep(step, app) {
  if (app.submitted) return renderSuccess(app);
  switch (step) {
    case 1: return renderStepPersonal(app);
    case 2: return renderStepEducation(app);
    case 3: return renderStepProgram(app);
    case 4: return renderStepDocuments(app);
    case 5: return renderStepReview(app);
    default: return renderStepPersonal(app);
  }
}

/* ---- Step 1: Personal ---- */
function renderStepPersonal(app) {
  const p = app.personal || {};
  return `
    <h2>Personal Information</h2>
    <p class="subtitle">Please fill out the required details. All information must be accurate.</p>

    <form id="stepForm" class="apply-form-body" data-step="1">
      <div class="field-row" style="grid-template-columns: 1fr 1fr 1fr">
        <div class="field">
          <label>First Name <span class="req">*</span></label>
          <input name="first_name" required value="${esc(p.first_name || '')}">
        </div>
        <div class="field">
          <label>Middle Name</label>
          <input name="middle_name" value="${esc(p.middle_name || '')}">
        </div>
        <div class="field">
          <label>Last Name <span class="req">*</span></label>
          <input name="last_name" required value="${esc(p.last_name || '')}">
        </div>
      </div>

      <div class="field-row" style="grid-template-columns: 2fr 1fr 1fr">
        <div class="field">
          <label>Address (Unit/House no., Street, Barangay, City, Province) <span class="req">*</span></label>
          <input name="address" required value="${esc(p.address || '')}">
        </div>
        <div class="field">
          <label>Region <span class="req">*</span></label>
          <select name="region" required>
            <option value="">Select region</option>
            ${REGIONS.map((r) => `<option ${p.region === r ? 'selected' : ''}>${esc(r)}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label>ZIP Code <span class="req">*</span></label>
          <input name="zip" required value="${esc(p.zip || '')}">
        </div>
      </div>

      <div class="field-row" style="grid-template-columns: 1.4fr 1fr 1fr 0.8fr">
        <div class="field">
          <label>Email Address <span class="req">*</span></label>
          <input type="email" name="email" required value="${esc(p.email || session.email)}">
        </div>
        <div class="field">
          <label>Cellphone Number <span class="req">*</span></label>
          <input name="phone" required value="${esc(p.phone || '')}" placeholder="09XX XXX XXXX">
        </div>
        <div class="field">
          <label>Civil Status <span class="req">*</span></label>
          <select name="civil_status" required>
            <option value="">Select</option>
            ${['Single','Married','Widowed','Separated'].map((v) =>
              `<option ${p.civil_status === v ? 'selected' : ''}>${v}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label>Sex <span class="req">*</span></label>
          <select name="sex" required>
            <option value="">Select</option>
            ${['Male','Female'].map((v) =>
              `<option ${p.sex === v ? 'selected' : ''}>${v}</option>`).join('')}
          </select>
        </div>
      </div>

      <div class="field-row" style="grid-template-columns: 1fr 1.6fr 1fr">
        <div class="field">
          <label>Date of Birth <span class="req">*</span></label>
          <input type="date" name="dob" required value="${esc(p.dob || '')}">
        </div>
        <div class="field">
          <label>Place of Birth <span class="req">*</span></label>
          <input name="pob" required value="${esc(p.pob || '')}">
        </div>
        <div class="field">
          <label>Religion</label>
          <input name="religion" value="${esc(p.religion || '')}">
        </div>
      </div>
    </form>

    <div class="apply-footer">
      <span></span>
      <button class="btn btn-primary" data-action="nextStep" data-step="1">Next →</button>
    </div>
  `;
}

/* ---- Step 2: Education ---- */
function renderStepEducation(app) {
  const e = app.education || {};
  const yearOpts = (sel) => {
    const cur = new Date().getFullYear();
    let out = '<option value="">Select year</option>';
    for (let y = cur; y >= cur - 40; y--) {
      out += `<option ${sel === String(y) ? 'selected' : ''}>${y}</option>`;
    }
    return out;
  };
  const block = (key, title, prefix) => {
    const b = e[key] || {};
    return `
      <div class="edu-block">
        <h4>${title}</h4>
        <div class="field-row" style="grid-template-columns: 1.4fr 1.4fr 0.6fr">
          <div class="field">
            <label>School Name <span class="req">*</span></label>
            <input name="${prefix}_school" required value="${esc(b.school || '')}">
          </div>
          <div class="field">
            <label>School Address <span class="req">*</span></label>
            <input name="${prefix}_address" required value="${esc(b.address || '')}">
          </div>
          <div class="field">
            <label>Year Graduated <span class="req">*</span></label>
            <select name="${prefix}_year" required>${yearOpts(b.year || '')}</select>
          </div>
        </div>
      </div>
    `;
  };
  return `
    <h2>Educational Background</h2>
    <p class="subtitle">Please provide your previous school information.</p>
    <form id="stepForm" class="apply-form-body" data-step="2">
      ${block('elem',    'Elementary',                          'elem')}
      ${block('jhs',     'Junior High School',                  'jhs')}
      ${block('shs',     'Senior High School',                  'shs')}
      ${block('college', 'College / University (if applicable)', 'college')}
    </form>
    <div class="apply-footer">
      <button class="btn btn-outline" data-action="prevStep" data-step="2">← Back</button>
      <button class="btn btn-primary" data-action="nextStep" data-step="2">Next →</button>
    </div>
  `;
}

/* ---- Step 3: Program ---- */
function renderStepProgram(app) {
  const p = app.program || {};
  return `
    <h2>Program Choice</h2>
    <p class="subtitle">Select the program you wish to enroll in. Make sure to choose the correct course and track based on your interest and academic background.</p>

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

      <div class="program-list" style="margin-top:22px">
        <h3>Programs Offered</h3>
        <p><strong>Bachelor of Elementary Education</strong> (Generalist)</p>
        <p><strong>Bachelor of Secondary Education Major in</strong></p>
        <ul>
          <li>English</li>
          <li>Social Studies</li>
          <li>Values Education</li>
        </ul>
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

/* ---- Step 4: Documents ---- */
function renderStepDocuments(app) {
  if (!app.docType) {
    return `
      <h2>Upload Documents</h2>
      <p class="subtitle">Please upload the required documents in PDF, JPG, or PNG format. Make sure the files are clear and readable.</p>

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
  const title = app.docType === 'new'
    ? 'Upload Documents (New Student)'
    : 'Upload Documents (Transferee / Second Courser)';

  return `
    <h2>${title}</h2>
    <p class="subtitle">Please upload the required documents in PDF, JPG, or PNG format. Make sure the files are clear and readable.</p>

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

/* ---- Step 5: Review ---- */
function renderStepReview(app) {
  const p  = app.personal  || {};
  const e  = app.education || {};
  const pr = app.program   || {};
  const prog = PROGRAMS.find((x) => String(x.id) === String(pr.preferred));
  const docs = app.docType === 'new' ? DOCS_NEW : DOCS_TRANSFEREE;
  const docCount = app.documents ? Object.keys(app.documents).length : 0;
  const fullName = [p.first_name, p.middle_name, p.last_name].filter(Boolean).join(' ');
  const shsName  = e.shs ? e.shs.school : '—';

  return `
    <h2>Review & Submit</h2>
    <p class="subtitle">Please check your information carefully before submitting. You can go back and edit any section if needed.</p>

    <div class="review-card">
      <div class="review-row">
        <div class="rr-icon">👤</div>
        <div class="rr-content">
          <h4>Personal Information.</h4>
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

/* ---- Success page ---- */
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

/* =========================================================================
   PART 4 / 4 — Events, File Upload, Render, Bootstrap
   ========================================================================= */

/* ============================ CLICK EVENTS ============================ */

document.addEventListener('click', (e) => {
  const btn    = e.target.closest('[data-action]');
  const navBtn = e.target.closest('[data-nav]');

  // Close user menu when clicking outside
  if (!e.target.closest('.nav-user') && !e.target.closest('.nav-user-menu')) {
    if (state.showUserMenu) {
      state.showUserMenu = false;
      renderNavbar();
    }
  }

  // Navbar navigation
  if (navBtn) {
    const key = navBtn.dataset.nav;
    state.view = key;
    if (key === 'apply' && state.step < 1) state.step = 1;
    renderAll();
    return;
  }

  if (!btn) return;
  const action = btn.dataset.action;

  switch (action) {
    case 'authTab':
      state.authTab = btn.dataset.tab;
      renderAuthPage();
      break;

    case 'focusAuth':
      $('#authCard').scrollIntoView({ behavior: 'smooth', block: 'center' });
      $('#authCard').animate(
        [{ transform: 'scale(1)' }, { transform: 'scale(1.03)' }, { transform: 'scale(1)' }],
        { duration: 500, easing: 'ease-in-out' }
      );
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
      const next = app.submitted ? 5 : (computeCompletedSteps(app) + 1);
      state.step = Math.min(next, 5);
      state.view = 'apply';
      renderAll();
      break;
    }

    case 'gotoStep': {
      const step = Number(btn.dataset.step);
      state.view = 'apply';
      state.step = step;
      renderAll();
      break;
    }

    case 'nextStep': {
      if (!saveStep(Number(btn.dataset.step))) return;
      state.step = Math.min(Number(btn.dataset.step) + 1, 5);
      renderApply();
      break;
    }

    case 'prevStep': {
      if (!saveStep(Number(btn.dataset.step))) return;
      state.step = Math.max(Number(btn.dataset.step) - 1, 1);
      renderApply();
      break;
    }

    case 'chooseDocType': {
      const app = currentApp();
      app.docType = btn.dataset.type;
      if (!app.documents) app.documents = {};
      saveDB();
      renderApply();
      break;
    }

    case 'changeDocType': {
      const app = currentApp();
      app.docType = null;
      app.documents = {};
      saveDB();
      renderApply();
      break;
    }

    case 'submitApplication': {
      const app = currentApp();
      const chk = $('#certifyCheck');
      if (!chk || !chk.checked) {
        return toast('Please certify that your information is correct.', 'error');
      }
      app.certified = true;
      app.submitted = true;
      app.submittedAt = nowISO();
      app.reference = 'UCC-' + Date.now().toString().slice(-8);
      saveDB();
      toast('Application submitted successfully!');
      renderAll();
      break;
    }

    case 'viewApplication':
      state.view = 'review';
      state.step = 5;
      renderAll();
      break;
  }
});

/* ============================ FORM SUBMITS ============================ */

document.addEventListener('submit', (e) => {
  e.preventDefault();
  const f = e.target;
  if (f.id === 'loginForm') doLogin(f);
  else if (f.id === 'registerForm') doRegister(f);
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
      elem: {
        school:  String(fd.get('elem_school')  || '').trim(),
        address: String(fd.get('elem_address') || '').trim(),
        year:    String(fd.get('elem_year')    || '').trim()
      },
      jhs: {
        school:  String(fd.get('jhs_school')   || '').trim(),
        address: String(fd.get('jhs_address')  || '').trim(),
        year:    String(fd.get('jhs_year')     || '').trim()
      },
      shs: {
        school:  String(fd.get('shs_school')   || '').trim(),
        address: String(fd.get('shs_address')  || '').trim(),
        year:    String(fd.get('shs_year')     || '').trim()
      },
      college: {
        school:  String(fd.get('college_school')  || '').trim(),
        address: String(fd.get('college_address') || '').trim(),
        year:    String(fd.get('college_year')    || '').trim()
      }
    };
    saveDB();
    return true;
  }

  if (step === 3) {
    const fd = new FormData(form);
    const app = currentApp();
    app.program = { preferred: String(fd.get('preferred') || '').trim() };
    if (!app.program.preferred) {
      toast('Please select a program.', 'error');
      return false;
    }
    saveDB();
    return true;
  }

  if (step === 4) {
    const app = currentApp();
    if (!app.docType) {
      toast('Please choose a document type.', 'error');
      return false;
    }
    const docs = app.docType === 'new' ? DOCS_NEW : DOCS_TRANSFEREE;
    const missing = docs.filter((d) => !app.documents || !app.documents[d.id]);
    if (missing.length) {
      toast('Please upload all required documents.', 'error');
      return false;
    }
    return true;
  }

  return true;
}

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

  const docId   = input.dataset.upload;
  const docName = input.dataset.doc;
  const app = currentApp();
  if (!app.documents) app.documents = {};

  app.documents[docId] = {
    name: file.name,
    size: file.size,
    type: file.type,
    uploaded_at: nowISO()
  };
  saveDB();

  const label = document.getElementById('fn_' + docId);
  if (label) {
    label.textContent = file.name;
    label.classList.add('selected');
  }

  toast(`${docName} uploaded.`);
});

/* ============================ CERTIFY CHECKBOX ============================ */

document.addEventListener('change', (e) => {
  if (e.target.id !== 'certifyCheck') return;
  const box = document.getElementById('certifyBox');
  const app = currentApp();
  app.certified = e.target.checked;
  saveDB();
  if (box) {
    box.classList.toggle('checked', e.target.checked);
    const checkBox = box.querySelector('.check-box');
    if (checkBox) checkBox.textContent = e.target.checked ? '✓' : '';
  }
});

/* ============================ RENDER ALL ============================ */

function renderAll() {
  renderNavbar();

  const authPage = $('#authPage');
  const pageWrap = $('#pageWrap');

  if (!session) {
    authPage.classList.remove('hidden');
    pageWrap.classList.add('hidden');
    renderAuthPage();
    return;
  }

  authPage.classList.add('hidden');
  pageWrap.classList.remove('hidden');

  switch (state.view) {
    case 'dashboard':
      renderDashboard();
      break;
    case 'apply':
      renderApply();
      break;
    case 'programs':
      state.step = 3;
      state.view = 'apply';
      renderApply();
      break;
    case 'documents':
      state.step = 4;
      state.view = 'apply';
      renderApply();
      break;
    case 'review':
      state.step = 5;
      state.view = 'apply';
      renderApply();
      break;
    default:
      renderDashboard();
  }
}

/* ============================ BOOTSTRAP ============================ */

function boot() {
  loadDB();

  const raw = localStorage.getItem(SESSION_KEY);
  if (raw) {
    try {
      const s = JSON.parse(raw);
      const user = db.users.find((u) => u.id === s.userId);
      if (user) {
        session = { userId: user.id, name: user.name, email: user.email };
        state.view = 'dashboard';
      } else {
        localStorage.removeItem(SESSION_KEY);
      }
    } catch (err) {
      localStorage.removeItem(SESSION_KEY);
    }
  }

  renderAll();
}

boot();
