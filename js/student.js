import { esc, toast } from './utils.js';
import { supa } from './api.js';
import { session } from './auth.js';

// Helper for the timetable
function parseTimeToMin(t) {
  const clean = t.replace(/\s*[AP]M/i, '');
  const parts = clean.split(':');
  let h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (t.toUpperCase().includes('PM') && h < 12) h += 12;
  if (t.toUpperCase().includes('AM') && h === 12) h = 0;
  return h * 60 + m;
}

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
    { id: 5, label: 'Application Submitted', icon: '✓' }
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
      <h3>Enrollment Status</h3>
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
        <div class="continue-bar" style="flex-direction: column; align-items: flex-start; gap: 10px;">
          <div style="display:flex; gap:10px; align-items:center;">
            <div class="cb-icon" style="background: ${app.status === 'Approved' ? 'var(--mint-600)' : 'var(--gold-500)'};">✓</div>
            <div class="cb-text">
              <h4>Application Status: ${esc(app.status || 'Pending Review')}</h4>
              <p>Reference: <strong>${esc(app.reference || '—')}</strong></p>
            </div>
          </div>
          <div class="rp-notice info" style="margin-bottom:0; width: 100%;">
            <span>ℹ️</span>
            <span>Please wait for the Faculty to assign your subjects. Once assigned, your Payment tab will appear.</span>
          </div>
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

export async function renderApply() {
  const user = session;
  const apps = await supa('applications', { match: { user_id: user.userId } }).catch(() => []);
  const app = apps[0] || { personal: {}, education: {}, program: {}, documents: {}, doc_type: null, submitted: false };

  const step = window.currentStep || 1;

  let html = '';
  if (app.submitted) {
    html = `<div class="success-wrap"><div class="success-check">✓</div><h2>Application Submitted!</h2><p>Wait for the Faculty to assign your subjects.</p></div>`;
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
      <button type="submit" form="stepForm" class="btn btn-primary" data-action="nextStep" data-step="1">Next →</button>
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
      <button type="button" class="btn btn-outline" data-action="prevStep" data-step="2">← Back</button>
      <button type="submit" form="stepForm" class="btn btn-primary" data-action="nextStep" data-step="2">Next →</button>
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
      <div class="field-row" style="max-width:600px">
        <div class="field">
          <label>Preferred Program *</label>
          <select name="preferred" required>
            <option value="">Select a program</option>
            ${PROGRAMS.map(pr => `<option value="${pr.id}" ${String(p.preferred) === String(pr.id) ? 'selected' : ''}>${esc(pr.code)} — ${esc(pr.name)}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label>Year Level *</label>
          <select name="year_level" required>
            <option value="">Select year level</option>
            <option value="1" ${String(p.year_level) === '1' ? 'selected' : ''}>1st Year</option>
            <option value="2" ${String(p.year_level) === '2' ? 'selected' : ''}>2nd Year</option>
            <option value="3" ${String(p.year_level) === '3' ? 'selected' : ''}>3rd Year</option>
            <option value="4" ${String(p.year_level) === '4' ? 'selected' : ''}>4th Year</option>
          </select>
        </div>
      </div>
    </form>
    <div class="apply-footer">
      <button type="button" class="btn btn-outline" data-action="prevStep" data-step="3">← Back</button>
      <button type="submit" form="stepForm" class="btn btn-primary" data-action="nextStep" data-step="3">Next →</button>
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
      <button type="button" class="btn btn-outline" data-action="changeDocType">← Back</button>
      <button type="submit" form="stepForm" class="btn btn-primary" data-action="nextStep" data-step="4">Next →</button>
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
      <button type="button" class="btn btn-outline" data-action="prevStep" data-step="5">← Back</button>
      <button type="button" class="btn btn-gold" data-action="submitApplication">✈ Submit Application</button>
    </div>
  `;
}

// --- PAYMENT TAB (Accepts dynamic settings) ---
export async function renderPaymentTab(app, subjects, courses, settings) {
  let totalUnits = 0;
  let subjectsHtml = '';

  subjects.forEach(s => {
    const c = courses.find(x => String(x.id) === String(s.course_id));
    if (c) {
      totalUnits += Number(c.units);
      subjectsHtml += `
        <tr>
          <td>${esc(c.code)}</td>
          <td>${esc(c.title)}</td>
          <td style="text-align:center">${c.units}</td>
        </tr>
      `;
    }
  });

  const tuition = totalUnits * settings.tuition_per_unit;
  const misc = settings.misc_fee;
  const reg = settings.reg_fee;
  const total = tuition + misc + reg;
  const paid = Number(app.amount_paid || 0);
  const balance = total - paid;

  return `
    <div class="progress-card">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
        <h3>Payment Assessment</h3>
        <span class="rp-badge ${balance <= 0 ? 'green' : 'gold'}">${balance <= 0 ? 'Fully Paid' : 'Pending Payment'}</span>
      </div>

      <div class="rp-table-wrap" style="margin-bottom: 24px;">
        <table class="rp-table">
          <thead><tr><th>Course Code</th><th>Description</th><th style="text-align:center">Units</th></tr></thead>
          <tbody>${subjectsHtml}</tbody>
        </table>
      </div>

      <div class="rp-grid-2">
        <div class="rp-card" style="background:var(--mint-50);">
          <div class="rp-card-head"><h3>Summary of Fees</h3></div>
          <div style="display:flex; justify-content:space-between; padding: 8px 0; border-bottom:1px solid #eee;">
            <span>Tuition Fee (${totalUnits} units × ₱${settings.tuition_per_unit})</span>
            <strong>₱${tuition.toLocaleString('en-PH', {minimumFractionDigits:2})}</strong>
          </div>
          <div style="display:flex; justify-content:space-between; padding: 8px 0; border-bottom:1px solid #eee;">
            <span>Miscellaneous Fees</span>
            <strong>₱${misc.toLocaleString('en-PH', {minimumFractionDigits:2})}</strong>
          </div>
          <div style="display:flex; justify-content:space-between; padding: 8px 0; border-bottom:1px solid #eee;">
            <span>Registration Fee</span>
            <strong>₱${reg.toLocaleString('en-PH', {minimumFractionDigits:2})}</strong>
          </div>
          <div style="display:flex; justify-content:space-between; padding: 12px 0; font-size:18px; color:var(--mint-800); font-weight:800;">
            <span>TOTAL AMOUNT DUE</span>
            <span>₱${total.toLocaleString('en-PH', {minimumFractionDigits:2})}</span>
          </div>
        </div>

        <div class="rp-card">
          <div class="rp-card-head"><h3>Payment Details</h3></div>
          <div style="display:flex; justify-content:space-between; padding: 8px 0; border-bottom:1px solid #eee;">
            <span>Amount Paid</span>
            <strong style="color:var(--mint-600)">₱${paid.toLocaleString('en-PH', {minimumFractionDigits:2})}</strong>
          </div>
          <div style="display:flex; justify-content:space-between; padding: 8px 0;">
            <span>Remaining Balance</span>
            <strong style="color:var(--danger)">₱${balance.toLocaleString('en-PH', {minimumFractionDigits:2})}</strong>
          </div>

          ${balance > 0 ? `
            <div style="margin-top:20px; border-top:1px solid #eee; padding-top:20px;">
              <p class="rp-hint" style="margin-bottom:10px;">Select payment option (Simulated):</p>
              <div style="display:flex; gap:10px; flex-direction:column;">
                <button class="btn btn-primary" onclick="window.payTuition('half', ${total}, ${paid})">Pay Downpayment (50%)</button>
                <button class="btn btn-gold" onclick="window.payTuition('full', ${total}, ${paid})">Pay Full Balance</button>
              </div>
            </div>
          ` : `
            <div class="rp-notice mint" style="margin-top:20px;">
              <span>✅</span><span>Your tuition is fully paid. You can now view your Schedule and Registration Form.</span>
            </div>
          `}
        </div>
      </div>
    </div>
  `;
}

// --- SCHEDULE TAB ---
export async function renderScheduleTab(app, subjects, courses) {
  let pr = app.program || {};
  if (typeof pr === 'string') { try { pr = JSON.parse(pr); } catch(e){} }
  
  const PROG_NAMES = { '1': 'BEEd', '2': 'BSEd', '8': 'BSCS' };
  const progName = PROG_NAMES[pr.preferred] || 'Unknown';

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  
  let blocks = [];
  let minTime = 8 * 60;
  let maxTime = 17 * 60;

  subjects.forEach(s => {
    const c = courses.find(x => String(x.id) === String(s.course_id));
    if (c && c.schedule_day && c.schedule_time && c.schedule_time.includes('-')) {
      const dayIndex = days.indexOf(c.schedule_day);
      if (dayIndex === -1) return;

      try {
        const [startStr, endStr] = c.schedule_time.split('-').map(x => x.trim());
        const startMin = parseTimeToMin(startStr);
        const endMin = parseTimeToMin(endStr);
        
        if (startMin < minTime) minTime = startMin;
        if (endMin > maxTime) maxTime = endMin;

        blocks.push({ day: dayIndex, startMin, endMin, course: c });
      } catch (e) { console.error("Error parsing time", c.schedule_time); }
    }
  });

  const startHour = Math.max(0, Math.floor(minTime / 60) - 1);
  const endHour = Math.min(24, Math.ceil(maxTime / 60) + 1);
  const slotsCount = (endHour - startHour) * 2;

  let tableHtml = `<div class="timetable">`;
  
  tableHtml += `<div class="tt-header" style="grid-row:1; grid-column:1;">Time</div>`;
  days.forEach((d, i) => {
    tableHtml += `<div class="tt-header" style="grid-row:1; grid-column:${i+2};">${d.slice(0,3)}</div>`;
  });

  for (let i = 0; i < slotsCount; i++) {
    const row = i + 2; 
    const hour = startHour + Math.floor(i / 2);
    const min = (i % 2) * 30;
    
    let timeLabel = '';
    if (min === 0) {
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour > 12 ? hour - 12 : (hour === 0 ? 12 : hour);
      timeLabel = `${displayHour} ${ampm}`;
    }
    
    tableHtml += `<div class="tt-time" style="grid-row:${row}; grid-column:1;">${timeLabel}</div>`;
    
    days.forEach((_, j) => {
      tableHtml += `<div class="tt-cell" style="grid-row:${row}; grid-column:${j+2};"></div>`;
    });
  }

  blocks.forEach(b => {
    const startRow = 2 + Math.floor((b.startMin - startHour * 60) / 30);
    const endRow = 2 + Math.ceil((b.endMin - startHour * 60) / 30);
    const gridRow = `${startRow} / ${endRow}`;
    const gridColumn = `${b.day + 2} / ${b.day + 3}`;
    
    const colors = ['var(--mint-500)', 'var(--gold-500)', '#8e44ad', '#e67e22', '#2980b9'];
    const color = colors[b.course.id % colors.length];

    tableHtml += `
      <div class="tt-block" style="grid-row:${gridRow}; grid-column:${gridColumn}; background:${color};">
        <div class="tt-code">${esc(b.course.code)}</div>
        <div class="tt-title">${esc(b.course.title)}</div>
      </div>
    `;
  });

  tableHtml += `</div>`;

  return `
    <div class="schedule-header-card">
      <h2>My Timetable</h2>
      <div class="schedule-info-grid">
        <div class="schedule-info-item">
          <span>Program</span>
          <strong>${progName}</strong>
        </div>
        <div class="schedule-info-item">
          <span>Year Level</span>
          <strong>Year ${esc(pr.year_level || '?')}</strong>
        </div>
        <div class="schedule-info-item">
          <span>Semester</span>
          <strong>${esc(pr.semester || '1st Semester')}</strong>
        </div>
      </div>
    </div>

    <div class="rp-card" style="padding: 0; overflow: hidden; border: none; background: transparent;">
      <div style="overflow-x: auto;">
        ${tableHtml}
      </div>
    </div>
  `;
}

// --- REGISTRATION FORM TAB (Accepts dynamic settings) ---
export async function renderRegistrationTab(app, subjects, courses, settings) {
  let totalUnits = 0;
  let subjectsHtml = '';

  subjects.forEach(s => {
    const c = courses.find(x => String(x.id) === String(s.course_id));
    if (c) {
      totalUnits += Number(c.units);
      subjectsHtml += `
        <tr>
          <td style="border:1px solid #000; padding:4px;">${esc(c.code)}</td>
          <td style="border:1px solid #000; padding:4px;">${esc(c.title)}</td>
          <td style="border:1px solid #000; padding:4px; text-align:center;">${c.units}</td>
        </tr>
      `;
    }
  });

  const tuition = totalUnits * settings.tuition_per_unit;
  const misc = settings.misc_fee;
  const reg = settings.reg_fee;
  const total = tuition + misc + reg;
  const paid = Number(app.amount_paid || 0);

  let pr = app.program || {};
  if (typeof pr === 'string') { try { pr = JSON.parse(pr); } catch(e){} }
  const PROG_NAMES = { '1': 'BEEd', '2': 'BSEd', '8': 'BSCS' };
  const progName = PROG_NAMES[pr.preferred] || 'Unknown';
  const fullName = app.personal ? `${app.personal.first_name} ${app.personal.middle_name || ''} ${app.personal.last_name}`.trim() : session.name;

  return `
    <div class="progress-card" style="background:#fff; color:#000; font-family: 'Times New Roman', Times, serif; max-width: 800px; margin: 0 auto; padding: 40px;">
      
      <!-- HEADER -->
      <div style="text-align:center; margin-bottom:20px;">
        <h2 style="font-size:16px; font-weight:bold; margin-bottom:5px;">UNIDA CHRISTIAN COLLEGES</h2>
        <p style="font-size:12px;">Unida Street Anabu I-F, Imus City, Cavite</p>
        <h3 style="font-size:14px; font-weight:bold; margin-top:10px;">COLLEGE DEPARTMENT</h3>
        <p style="font-size:10px; text-align:right;">STUDENT'S COPY</p>
      </div>

      <!-- DETAILS -->
      <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:10px;">
        <div>
          <p><strong>Schedule of Payment</strong></p>
          <p style="margin-top:10px;">NAME: <span style="border-bottom:1px solid #000; display:inline-block; width:200px;">${esc(fullName).toUpperCase()}</span></p>
          <p style="margin-top:5px;">COURSE AND YEAR: <span style="border-bottom:1px solid #000; display:inline-block; width:150px;">${progName} - YEAR ${esc(pr.year_level || '?')}</span></p>
        </div>
        <div style="text-align:right;">
          <p>AY: <strong>2025-2026</strong></p>
          <p>SEMESTER: <strong>${esc(pr.semester || '1st Semester').toUpperCase()}</strong></p>
        </div>
      </div>

      <!-- TABLE -->
      <table style="width:100%; border-collapse:collapse; font-size:11px; margin-bottom:20px;">
        <thead>
          <tr style="border:1px solid #000; text-align:center; font-weight:bold;">
            <th style="border:1px solid #000; padding:4px;" colspan="2">SUBJECTS</th>
            <th style="border:1px solid #000; padding:4px;">No. of Units</th>
            <th style="border:1px solid #000; padding:4px;">Amount per Unit</th>
            <th style="border:1px solid #000; padding:4px;">TOTAL TUITION FEE</th>
          </tr>
        </thead>
        <tbody>
          ${subjectsHtml}
          <tr>
            <td style="border:1px solid #000; padding:4px; font-weight:bold;" colspan="2">TOTAL TUITION</td>
            <td style="border:1px solid #000; padding:4px; text-align:center; font-weight:bold;">${totalUnits}</td>
            <td style="border:1px solid #000; padding:4px; text-align:center;">${settings.tuition_per_unit}</td>
            <td style="border:1px solid #000; padding:4px; text-align:right; font-weight:bold;">${tuition.toLocaleString('en-PH', {minimumFractionDigits:2})}</td>
          </tr>
          <tr>
            <td style="border:1px solid #000; padding:4px;" colspan="4">REGISTRATION</td>
            <td style="border:1px solid #000; padding:4px; text-align:right;">${reg.toLocaleString('en-PH', {minimumFractionDigits:2})}</td>
          </tr>
          <tr>
            <td style="border:1px solid #000; padding:4px;" colspan="4">MISCELLANEOUS FEES</td>
            <td style="border:1px solid #000; padding:4px; text-align:right;">${misc.toLocaleString('en-PH', {minimumFractionDigits:2})}</td>
          </tr>
          <tr>
            <td style="border:1px solid #000; padding:4px; font-weight:bold;" colspan="4">TOTAL</td>
            <td style="border:1px solid #000; padding:4px; text-align:right; font-weight:bold;">${total.toLocaleString('en-PH', {minimumFractionDigits:2})}</td>
          </tr>
          <tr>
            <td style="border:1px solid #000; padding:4px; font-weight:bold; color:green;" colspan="4">AMOUNT PAID</td>
            <td style="border:1px solid #000; padding:4px; text-align:right; font-weight:bold; color:green;">${paid.toLocaleString('en-PH', {minimumFractionDigits:2})}</td>
          </tr>
          <tr>
            <td style="border:1px solid #000; padding:4px; font-weight:bold; color:red;" colspan="4">REMAINING BALANCE</td>
            <td style="border:1px solid #000; padding:4px; text-align:right; font-weight:bold; color:red;">${(total - paid).toLocaleString('en-PH', {minimumFractionDigits:2})}</td>
          </tr>
        </tbody>
      </table>

      <!-- STAMP -->
      <div style="display:flex; justify-content:center; margin:30px 0;">
        <div style="border: 3px solid #2e7d32; color: #2e7d32; padding: 10px 30px; border-radius: 8px; text-align:center; transform: rotate(-5deg);">
          <p style="font-size:12px; font-weight:bold; margin-bottom:5px;">UCC ADMISSIONS OFFICE</p>
          <p style="font-size:28px; font-weight:900; letter-spacing:2px;">ENROLLED</p>
          <p style="font-size:12px;">Date: ${new Date().toLocaleDateString()}</p>
        </div>
      </div>

      <!-- SIGNATURES -->
      <div style="display:flex; justify-content:space-between; font-size:11px; margin-top:40px;">
        <div style="text-align:center;">
          <p>Checked by:</p>
          <div style="border-bottom:1px solid #000; width:150px; margin:20px auto 5px;"></div>
          <p>Ms. Analee I. Ramos</p>
          <p style="font-weight:bold;">Registrar Head</p>
        </div>
        <div style="text-align:center;">
          <p>Approved by:</p>
          <div style="border-bottom:1px solid #000; width:150px; margin:20px auto 5px;"></div>
          <p>Dr. Ruthmita Rozul</p>
          <p style="font-weight:bold;">College Director</p>
        </div>
      </div>

    </div>
  `;
}
