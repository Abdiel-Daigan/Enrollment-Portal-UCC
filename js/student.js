import { $, esc, toast, hash, initials } from './utils.js';
import { supa } from './api.js';
import { session } from './auth.js';

// --- DASHBOARD ---
export async function renderStudentDashboard() {
  const user = session;
  const apps = await supa('applications', { match: { user_id: user.userId } }).catch(() => []);
  const app = apps && apps[0];
  
  let completed = 0;
  if (app) {
    let pr = app.program;
    if (typeof pr === 'string') { try { pr = JSON.parse(pr); } catch (e) {} }
    
    if (app.personal && app.personal.first_name) completed = 1;
    if (app.education && app.education.shs && app.education.shs.school) completed = 2;
    if (pr && pr.preferred) completed = 3;
    if (app.documents && Object.keys(app.documents).length >= 3) completed = 4;
    if (app.submitted) completed = 5;
  }

  const steps = [
    { id: 1, label: 'Personal Information', icon: '👤' },
    { id: 2, label: 'Educational Background', icon: '🏛️' },
    { id: 3, label: 'Program Choice', icon: '⚙️' },
    { id: 4, label: 'Upload Documents', icon: '📄' },
    { id: 5, label: 'Review & Submit', icon: '✓' }
  ];

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
        ${steps.map(s => {
          const isDone = s.id <= completed;
          const isActive = s.id === completed + 1 && (!app || !app.submitted);
          return `
            <div class="step ${isDone ? 'done' : (isActive ? 'active' : '')}">
              <div class="step-circle">${s.icon}</div>
              <div class="step-num">${s.id}</div>
              <div class="step-label">${s.label}</div>
            </div>
          `;
        }).join('')}
      </div>

      ${app && app.submitted ? `
        <div class="continue-bar">
          <div class="cb-icon">✓</div>
          <div class="cb-text">
            <h4>Application Submitted</h4>
            <p>Reference: <strong>${esc(app.reference || '—')}</strong> · Status: <strong>${esc(app.status || 'Pending')}</strong></p>
          </div>
          <button class="btn btn-outline" data-nav="browse">Browse Courses</button>
        </div>
      ` : `
        <div class="continue-bar">
          <div class="cb-icon">👤</div>
          <div class="cb-text">
            <h4>Continue your application</h4>
            <p>Complete all required information to finish your enrollment.</p>
          </div>
          <button class="btn btn-primary" data-action="continueApp">Continue Application →</button>
        </div>
      `}
    </div>
  `;
}

// --- APPLY WIZARD ---
export async function renderApply() {
  const user = session;
  const apps = await supa('applications', { match: { user_id: user.userId } }).catch(() => []);
  const app = apps[0] || { personal: {}, education: {}, program: {}, documents: {}, doc_type: null, submitted: false };

  const step = window.currentStep || 1;

  let html = '';
  if (app.submitted) {
    html = renderSuccess(app);
  } else {
    switch(step) {
      case 1: html = renderStepPersonal(app); break;
      case 2: html = renderStepEducation(app); break;
      case 3: html = renderStepProgram(app); break;
      case 4: html = renderStepDocuments(app); break;
      case 5: html = renderStepReview(app); break;
      default: html = renderStepPersonal(app);
    }
  }

  return `
    <div class="apply-layout">
      <aside class="apply-sidebar">
        ${[
          { id: 1, label: 'Personal', icon: '👤' },
          { id: 2, label: 'Education', icon: '🏛️' },
          { id: 3, label: 'Program', icon: '⚙️' },
          { id: 4, label: 'Documents', icon: '📄' },
          { id: 5, label: 'Review', icon: '✓' }
        ].map(s => `
          <button class="sidebar-step ${step === s.id ? 'active' : ''}" data-action="gotoStep" data-step="${s.id}">
            <span class="ss-icon">${s.icon}</span>
            <span>${s.label}</span>
          </button>
        `).join('')}
      </aside>
      <section class="apply-main" id="applyMain">
        ${html}
      </section>
    </div>
  `;
}

function renderStepPersonal(app) {
  const p = app.personal || {};
  return `
    <h2>Personal Information</h2>
    <p class="subtitle">Please fill out the required details.</p>
    <form id="stepForm" class="apply-form-body" data-step="1">
      <div class="field-row" style="grid-template-columns:1fr 1fr 1fr">
        <div class="field"><label>First Name *</label><input name="first_name" required value="${esc(p.first_name || '')}"></div>
        <div class="field"><label>Middle Name</label><input name="middle_name" value="${esc(p.middle_name || '')}"></div>
        <div class="field"><label>Last Name *</label><input name="last_name" required value="${esc(p.last_name || '')}"></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Email *</label><input type="email" name="email" required value="${esc(p.email || session.email)}"></div>
        <div class="field"><label>Phone *</label><input name="phone" required value="${esc(p.phone || '')}"></div>
      </div>
      <div class="field"><label>Address *</label><input name="address" required value="${esc(p.address || '')}"></div>
    </form>
    <div class="apply-footer">
      <span></span>
      <button class="btn btn-primary" data-action="nextStep" data-step="1">Next →</button>
    </div>
  `;
}

function renderStepEducation(app) {
  const e = app.education || {};
  const block = (key, title, prefix) => `
    <div class="edu-block">
      <h4>${title}</h4>
      <div class="field-row">
        <div class="field"><label>School Name *</label><input name="${prefix}_school" required value="${esc((e[key] && e[key].school) || '')}"></div>
        <div class="field"><label>Year Graduated *</label><input name="${prefix}_year" required value="${esc((e[key] && e[key].year) || '')}"></div>
      </div>
    </div>`;
  
  return `
    <h2>Educational Background</h2>
    <form id="stepForm" class="apply-form-body" data-step="2">
      ${block('elem', 'Elementary', 'elem')}
      ${block('jhs', 'Junior High', 'jhs')}
      ${block('shs', 'Senior High', 'shs')}
    </form>
    <div class="apply-footer">
      <button class="btn btn-outline" data-action="prevStep" data-step="2">← Back</button>
      <button class="btn btn-primary" data-action="nextStep" data-step="2">Next →</button>
    </div>
  `;
}

function renderStepProgram(app) {
  let p = app.program || {};
  if (typeof p === 'string') { try { p = JSON.parse(p); } catch (e) {} }
  const PROGRAMS = [
    { id: '1', code: 'BEEd', name: 'Bachelor of Elementary Education' },
    { id: '2', code: 'BSEd', name: 'Bachelor of Secondary Education' },
    { id: '8', code: 'BSCS', name: 'Bachelor of Science in Computer Science' }
  ];
  return `
    <h2>Program Choice</h2>
    <form id="stepForm" class="apply-form-body" data-step="3">
      <div class="field" style="max-width:520px">
        <label>Preferred Program *</label>
        <select name="preferred" required>
          <option value="">Select a program</option>
          ${PROGRAMS.map(pr => `<option value="${pr.id}" ${String(p.preferred) === String(pr.id) ? 'selected' : ''}>${esc(pr.code)} — ${esc(pr.name)}</option>`).join('')}
        </select>
      </div>
    </form>
    <div class="apply-footer">
      <button class="btn btn-outline" data-action="prevStep" data-step="3">← Back</button>
      <button class="btn btn-primary" data-action="nextStep" data-step="3">Next →</button>
    </div>
  `;
}

function renderStepDocuments(app) {
  if (!app.doc_type) {
    return `
      <h2>Upload Documents</h2>
      <div class="doc-choices">
        <div class="doc-choice featured" data-action="chooseDocType" data-type="new">
          <h3>New Student</h3>
          <button class="btn btn-primary">Continue →</button>
        </div>
        <div class="doc-choice" data-action="chooseDocType" data-type="transferee">
          <h3>Transferee</h3>
          <button class="btn btn-outline">Continue →</button>
        </div>
      </div>
    `;
  }
  return `
    <h2>Upload Documents (${app.doc_type === 'new' ? 'New Student' : 'Transferee'})</h2>
    <form id="stepForm" class="apply-form-body" data-step="4">
      <div class="upload-row"><div><h4>Report Card / TOR</h4></div><input type="file" data-upload="tor"></div>
      <div class="upload-row"><div><h4>PSA Birth Certificate</h4></div><input type="file" data-upload="psa"></div>
      <div class="upload-row"><div><h4>Good Moral</h4></div><input type="file" data-upload="moral"></div>
    </form>
    <div class="apply-footer">
      <button class="btn btn-outline" data-action="changeDocType">← Back</button>
      <button class="btn btn-primary" data-action="nextStep" data-step="4">Next →</button>
    </div>
  `;
}

function renderStepReview(app) {
  return `
    <h2>Review & Submit</h2>
    <p class="subtitle">Please check your information carefully before submitting.</p>
    
    <div class="certify" id="certifyBox" data-action="toggleCertify">
      <input type="checkbox" id="certifyCheck" style="pointer-events: none;">
      <span class="check-box"></span>
      <span class="cert-text">I certify that all information provided is true and correct to the best of my knowledge.</span>
    </div>

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
      <p>Reference: ${esc(app.reference)}</p>
      <button class="btn btn-primary" data-nav="browse">Browse Courses</button>
    </div>
  `;
}

// --- BROWSE COURSES ---
export async function renderBrowseCourses() {
  const user = session;
  const apps = await supa('applications', { match: { user_id: user.userId } }).catch(() => []);
  const app = apps[0];
  
  if (!app) return `<div class="progress-card rp-empty">Please complete your application first.</div>`;
  
  let pr = app.program;
  if (typeof pr === 'string') { try { pr = JSON.parse(pr); } catch (e) {} }
  const progId = pr && pr.preferred;
  
  if (!progId) return `<div class="progress-card rp-empty">Please select a program in your application first.</div>`;

  const [courses, sections, myEnrollments] = await Promise.all([
    supa('courses', { match: { program_id: Number(progId) } }),
    supa('sections'),
    supa('enrollments', { match: { user_id: user.userId } })
  ]);

  const mySectionIds = new Set(myEnrollments.map(e => String(e.section_id)));

  return `
    <div class="college-banner" style="min-height:160px">
      <div class="banner-text" style="padding:28px 34px"><h2 style="font-size:26px">Browse Courses</h2></div>
      <div class="banner-img"></div>
    </div>
    ${courses.map(c => {
      const secs = sections.filter(s => String(s.course_id) === String(c.id));
      if (!secs.length) return '';
      return `
        <div class="progress-card" style="margin-bottom:18px">
          <h3>${esc(c.code)} — ${esc(c.title)}</h3>
          ${secs.map(sec => {
            const enrolled = mySectionIds.has(String(sec.id));
            return `
              <div style="display:flex;justify-content:space-between;padding:12px;border:1px solid #ddd;margin-top:10px">
                <div>Sec ${esc(sec.section_name)} | ${esc(sec.schedule)} | Room ${esc(sec.room)}</div>
                ${enrolled 
                  ? '<button class="btn btn-ghost btn-sm" disabled>Enrolled</button>' 
                  : `<button class="btn btn-primary btn-sm" data-enroll-section="${sec.id}">Enroll</button>`}
              </div>
            `;
          }).join('')}
        </div>
      `;
    }).join('')}
  `;
}

// --- SCHEDULE ---
export async function renderSchedule() {
  const myEnrollments = await supa('enrollments', { match: { user_id: session.userId } });
  if (!myEnrollments.length) return `<div class="progress-card rp-empty">No schedule yet. Go to Browse Courses to enroll.</div>`;

  const sections = await supa('sections');
  const courses = await supa('courses');
  
  return `
    <div class="progress-card">
      <h3>My Schedule</h3>
      <div class="rp-table-wrap">
        <table class="rp-table">
          <thead><tr><th>Code</th><th>Title</th><th>Section</th><th>Schedule</th><th>Room</th></tr></thead>
          <tbody>
            ${myEnrollments.map(e => {
              const sec = sections.find(s => String(s.id) === String(e.section_id));
              const c = sec ? courses.find(x => String(x.id) === String(sec.course_id)) : null;
              if (!sec || !c) return '';
              return `<tr>
                <td><strong>${esc(c.code)}</strong></td>
                <td>${esc(c.title)}</td>
                <td>${esc(sec.section_name)}</td>
                <td>${esc(sec.schedule)}</td>
                <td>${esc(sec.room)}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}
