import { esc, toast } from './utils.js';
import { supa, uploadFile } from './api.js';
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

    ${app && app.returned ? `
      <div class="rp-notice red" style="margin-bottom:20px; border-color:var(--danger); background:#fdeceb; color:var(--danger);">
        <span>⚠️</span>
        <div>
          <strong>Application Returned by Registrar</strong>
          <p>${esc(app.registrar_feedback)}</p>
          <button class="btn btn-danger btn-sm" style="margin-top:10px;" data-action="continueApp">Fix Application</button>
        </div>
      </div>
    ` : ''}

    <div class="progress-card">
      <h3>Enrollment Status</h3>
      <div class="steps">
        ${steps.map(s => {
          const isDone = s.id <= completed;
          const isActive = s.id === completed + 1 && (!app || !app.submitted || app.returned);
          return `
            <div class="step ${isDone ? 'done' : (isActive ? 'active' : '')}">
              <div class="step-circle">${s.icon}</div>
              <div class="step-num">${s.id}</div>
              <div class="step-label">${s.label}</div>
            </div>
          `;
        }).join('')}
      </div>

      ${app && app.submitted && !app.returned ? `
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
            <span>Please wait for the Registrar to verify your documents. Once verified, the Faculty will assign your subjects.</span>
          </div>
        </div>
      ` : (app && app.returned ? '' : `
        <div class="continue-bar">
          <div class="cb-icon">👤</div>
          <div class="cb-text">
            <h4>Continue your application</h4>
            <p>Complete all required information to finish your enrollment.</p>
          </div>
          <button class="btn btn-primary" data-action="continueApp">Continue Application →</button>
        </div>
      `)}
    </div>
  `;
}

export async function renderApply() {
  const user = session;
  const apps = await supa('applications', { match: { user_id: user.userId } }).catch(() => []);
  const app = apps[0] || { personal: {}, education: {}, program: {}, documents: {}, doc_type: null, submitted: false };

  const step = window.currentStep || 1;

  let html = '';
  if (app.submitted && !app.returned) {
    html = `<div class="success-wrap"><div class="success-check">✓</div><h2>Application Submitted!</h2><p>Wait for the Registrar to verify your documents.</p></div>`;
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

const DOC_TYPES = {
  freshman: [
    { id: 'form138', name: 'Form 138', required: true },
    { id: 'psa', name: 'PSA Birth Certificate', required: true },
    { id: 'idpic', name: 'ID Photo', required: true },
    { id: 'goodmoral', name: 'Good Moral Certificate', required: true },
    { id: 'exam', name: 'Entrance Exam Result', required: true }
  ],
  transferee: [
    { id: 'transfer_cred', name: 'Transfer Credentials / Honorable Dismissal', required: true },
    { id: 'tor', name: 'Transcript of Records', required: true },
    { id: 'goodmoral_prev', name: 'Good Moral Certificate (Previous School)', required: true },
    { id: 'psa', name: 'PSA Birth Certificate', required: true },
    { id: 'idpic', name: 'ID Photo', required: true }
  ],
  returnee: [
    { id: 'readmission', name: 'Readmission Form', required: true },
    { id: 'clearance', name: 'Clearance from Last Term', required: true },
    { id: 'approval', name: 'School Approval Document', required: false }
  ]
};

function renderStepDocuments(app) {
  if (!app.doc_type) {
    return `
      <h2>Select Student Type</h2>
      <p class="subtitle">Please choose your student status to see the required documents.</p>
      <div class="doc-choices" style="grid-template-columns: 1fr 1fr 1fr;">
        <div class="doc-choice featured" data-action="chooseDocType" data-type="freshman">
          <h3>Freshman</h3>
          <p>New incoming 1st-year students.</p>
          <button class="btn btn-primary">Select</button>
        </div>
        <div class="doc-choice" data-action="chooseDocType" data-type="transferee">
          <h3>Transferee</h3>
          <p>Students transferring from another school.</p>
          <button class="btn btn-outline">Select</button>
        </div>
        <div class="doc-choice" data-action="chooseDocType" data-type="returnee">
          <h3>Returnee</h3>
          <p>Students returning after a leave of absence.</p>
          <button class="btn btn-outline">Select</button>
        </div>
      </div>
    `;
  }

  const docs = DOC_TYPES[app.doc_type] || [];
  const uploaded = app.documents || {};

  return `
    <h2>Upload Documents (${app.doc_type.charAt(0).toUpperCase() + app.doc_type.slice(1)})</h2>
    <p class="subtitle">Please upload all required documents to proceed.</p>
    
    <form id="stepForm" class="apply-form-body" data-step="4">
      ${docs.map(d => {
        const isUploaded = uploaded[d.id];
        return `
          <div class="upload-row" style="border-color: ${d.required && !isUploaded ? 'var(--danger)' : 'var(--line)'}">
            <div class="ur-text">
              <h4>${esc(d.name)} ${d.required ? '<span style="color:var(--danger)">*</span>' : '<span class="rp-hint">(Follow-up)</span>'}</h4>
              <p>${isUploaded ? `<span style="color:var(--mint-600)">✓ File Uploaded</span>` : 'No file uploaded'}</p>
            </div>
            <div class="ur-input" style="display:flex; flex-direction:row; gap:8px; align-items:center;">
              ${isUploaded ? `<button type="button" class="btn btn-ghost btn-sm" onclick="window.viewDocument('${uploaded[d.id]}')">View File</button>` : ''}
              <label class="file-btn">
                ⬆ ${isUploaded ? 'Replace' : 'Choose'} File
                <input type="file" accept=".pdf,.jpg,.jpeg,.png" onchange="window.handleFileUpload(event, '${d.id}', '${d.name}')">
              </label>
            </div>
          </div>
        `;
      }).join('')}
    </form>
    <div class="apply-footer">
      <button type="button" class="btn btn-outline" data-action="changeDocType">← Back</button>
      <button type="submit" form="stepForm" class="btn btn-primary" data-action="nextStep" data-step="4">Next →</button>
    </div>
  `;
}

// NEW: Handle File Upload with resizing and Supabase Storage
window.handleFileUpload = async (event, docId, docName) => {
  const file = event.target.files[0];
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) return toast('File is too large (max 10MB).', 'error');

  // Show loading toast
  toast(`Uploading ${docName}...`, 'info');

  try {
    // 1. Compress image if it's an image
    let fileToUpload = file;
    if (file.type.startsWith('image/')) {
      fileToUpload = await compressImage(file);
    }

    // 2. Upload to Supabase Storage
    const publicUrl = await uploadFile(fileToUpload, session.userId, docId);

    // 3. Save URL to Database
    const user = session;
    const existing = await supa('applications', { match: { user_id: user.userId } });
    const app = existing[0] || {};
    const docs = app.documents || {};
    
    docs[docId] = publicUrl;

    await supa('applications', {
      method: 'PATCH',
      match: { user_id: user.userId },
      body: { documents: docs }
    });

    toast(`${docName} uploaded successfully.`);
    renderAll(); // Refresh UI immediately
    
  } catch (err) {
    console.error(err);
    toast('Failed to upload file.', 'error');
  }
};

window.viewDocument = (url) => {
  window.open(url, '_blank');
};

// Helper to compress image using Canvas
function compressImage(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1200;
        const scaleSize = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scaleSize;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        canvas.toBlob((blob) => {
          const newFile = new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() });
          resolve(newFile);
        }, 'image/jpeg', 0.7); // 70% quality
      };
    };
  });
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
      <button type="button" class="btn btn-gold" data-action="submitApplication">Submit Application</button>
    </div>
  `;
}

export async function renderStudentDocumentsTab(app) {
  if (!app.doc_type) return `<div class="rp-empty">No documents required.</div>`;
  
  const docs = DOC_TYPES[app.doc_type] || [];
  const uploaded = app.documents || {};
  const docStatus = app.doc_status || {};

  return `
    <div class="progress-card">
      <h3>Document Tracking</h3>
      <p class="rp-hint" style="margin-bottom: 20px;">Please complete the follow-up documents below. Required documents must be verified by the Registrar.</p>
      
      <div class="rp-table-wrap">
        <table class="rp-table">
          <thead><tr><th>Document Name</th><th>Requirement</th><th>Status</th><th style="text-align:right">Action</th></tr></thead>
          <tbody>
            ${docs.map(d => {
              const isUploaded = uploaded[d.id];
              const status = docStatus[d.id] || 'Pending';
              return `
                <tr>
                  <td><strong>${esc(d.name)}</strong></td>
                  <td>${d.required ? '<span class="rp-badge red">Required</span>' : '<span class="rp-badge grey">Follow-up</span>'}</td>
                  <td>
                    ${isUploaded 
                      ? (status === 'Complete' ? `<span class="rp-badge green">Verified</span>` : `<span class="rp-badge gold">Submitted</span>`)
                      : `<span class="rp-badge red">Missing</span>`}
                  </td>
                  <td style="text-align:right">
                    ${isUploaded ? `<button class="rp-btn rp-btn-ghost rp-btn-sm" onclick="window.viewDocument('${uploaded[d.id]}')">View File</button>` : ''}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// --- PAYMENT, SCHEDULE, REGISTRATION TABS ---
// (Keep the existing code for these functions exactly as it is)
