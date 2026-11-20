import { esc, toast } from './utils.js';
import { registrationFormHtml } from './regform.js';
import { supa, uploadFile } from './api.js';
import { session } from './auth.js';
import { getSelectablePrograms, programLabel, getAcademicTerm, yearLevelsFor, yearLabel } from './catalog.js';
import { docsForType, docsComplete, docsUploaded, missingRequiredDocs } from './documents.js';
import { applicationStatus } from './status.js';

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

  const statusLabel = app ? applicationStatus(app) : 'In Progress';
  const confirmed = app ? docsComplete(app) : false;
  const confirmable = app ? docsUploaded(app) : false;

  const steps = [
    { id: 1, label: 'Personal Information', icon: '1' },
    { id: 2, label: 'Educational Background', icon: '2' },
    { id: 3, label: 'Program Choice', icon: '3' },
    { id: 4, label: 'Upload Documents', icon: '4' },
    { id: 5, label: 'Application Submitted', icon: '5' }
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
            <div class="cb-icon" style="background: ${statusLabel === 'Enrolled' || statusLabel === 'Enrollee' ? 'var(--mint-600)' : 'var(--gold-500)'};">✓</div>
            <div class="cb-text">
              <h4>Status: ${esc(statusLabel)}</h4>
              <p>Reference: <strong>${esc(app.reference || '—')}</strong></p>
            </div>
          </div>
          ${!confirmed ? `
            <div class="rp-notice info" style="margin-bottom:0; width: 100%;">
              ${confirmable ? `
                <div>
                  <strong>All documents are complete.</strong>
                  <div class="rp-hint">Confirm them so the Registrar can review and accept your application. Confirming is final — the Registrar can no longer return the application.</div>
                  <button type="button" class="btn btn-primary btn-sm" style="margin-top:10px;" data-action="confirmDocuments">Confirm All Documents</button>
                </div>
              ` : `
                <span>Upload your remaining documents in the Documents tab, then confirm them so the Registrar can review your application.</span>
              `}
            </div>
          ` : `
            <div class="rp-notice mint" style="margin-bottom:0; width: 100%;">
              <span>${statusLabel === 'Enrolled'
                ? 'Your documents are confirmed and your fees are paid. You are officially enrolled.'
                : statusLabel === 'Enrollee'
                  ? 'The Registrar has accepted your application. Pay your tuition once the Faculty has assigned your subjects to become officially enrolled.'
                  : 'Your documents are confirmed and now wait for the Registrar to accept your application.'}</span>
            </div>
          `}
        </div>
      ` : (app && app.returned ? '' : `
        <div class="continue-bar">
          <div class="cb-icon">1</div>
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
    const confirmed = docsComplete(app);
    const confirmable = docsUploaded(app);
    html = `
      <div class="success-wrap">
        <div class="success-check">✓</div>
        <h2>Application Submitted!</h2>
        <p>${confirmed
          ? 'Your documents are confirmed. The Registrar will now review and accept your application.'
          : confirmable
            ? 'All your documents are complete. Confirm them so the Registrar can review your application.'
            : 'Upload your remaining documents, then confirm them so the Registrar can review your application.'}</p>
        ${!confirmed && confirmable ? `<button type="button" class="btn btn-primary" style="margin-top:16px;" data-action="confirmDocuments">Confirm All Documents</button>` : ''}
      </div>
    `;
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
          { id: 1, label: 'Personal', icon: '1' },
          { id: 2, label: 'Education', icon: '2' },
          { id: 3, label: 'Program', icon: '3' },
          { id: 4, label: 'Documents', icon: '4' },
          { id: 5, label: 'Review', icon: '5' }
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
  
  // Programs come from the catalog, so programs the Registrar adds appear here.
  const PROGRAMS = getSelectablePrograms();
  // The year level list follows the number of years the program actually has.
  const years = yearLevelsFor(p.preferred || (PROGRAMS[0] && PROGRAMS[0].id));

  return `
    <h2>Program Choice</h2>
    <form id="stepForm" class="apply-form-body" data-step="3">
      <div class="field-row" style="max-width:600px">
        <div class="field">
          <label>Preferred Program *</label>
          <select name="preferred" required onchange="window.syncApplicationYears(this)">
            <option value="">Select a program</option>
            ${PROGRAMS.map(pr => `<option value="${pr.id}" ${String(p.preferred) === String(pr.id) ? 'selected' : ''}>${esc(pr.code)} — ${esc(pr.name)}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label>Year Level *</label>
          <select name="year_level" id="programYearSelect" required>
            <option value="">Select year level</option>
            ${years.map(y => `<option value="${y}" ${String(p.year_level) === String(y) ? 'selected' : ''}>${yearLabel(y)}</option>`).join('')}
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

  const docs = docsForType(app.doc_type);
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
                ${isUploaded ? 'Replace' : 'Choose'} File
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

window.handleFileUpload = async (event, docId, docName) => {
  const file = event.target.files[0];
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) return toast('File is too large (max 10MB).', 'error');

  toast(`Uploading ${docName}...`, 'info');

  try {
    let fileToUpload = file;
    if (file.type.startsWith('image/')) {
      fileToUpload = await compressImage(file);
    }

    const publicUrl = await uploadFile(fileToUpload, session.userId, docId);

    const user = session;
    const existing = await supa('applications', { match: { user_id: user.userId } });
    const app = existing[0] || {};
    const docs = app.documents || {};
    const docStatus = app.doc_status || {};

    docs[docId] = publicUrl;
    // The file is on record, but the Registrar still has to mark it complete.
    // A replaced file needs reviewing again, so completion is always reset.
    docStatus[docId] = 'Missing';

    await supa('applications', {
      method: 'PATCH',
      match: { user_id: user.userId },
      body: { documents: docs, doc_status: docStatus }
    });

    toast(`${docName} uploaded successfully.`);
    window.renderAll(); 
    
  } catch (err) {
    console.error(err);
    toast(err.message || 'Failed to upload file.', 'error');
  }
};

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
        }, 'image/jpeg', 0.7); 
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

  const docs = docsForType(app.doc_type);
  const uploaded = app.documents || {};
  const docStatus = app.doc_status || {};
  const missing = missingRequiredDocs(app);
  const confirmed = docsComplete(app);

  return `
    <div class="progress-card">
      <h3>Document Tracking</h3>
      <p class="rp-hint" style="margin-bottom: 20px;">
        Upload every required document, then confirm the whole set. The Registrar reviews each file and marks it
        complete before your application can be accepted.
      </p>

      <div class="rp-table-wrap">
        <table class="rp-table doc-table">
          <thead><tr><th>Document Name</th><th>Requirement</th><th>Status</th><th style="text-align:right">Action</th></tr></thead>
          <tbody>
            ${docs.map(d => {
              const file = uploaded[d.id];
              const complete = !!file && docStatus[d.id] === 'Complete';
              return `
                <tr>
                  <td><strong>${esc(d.name)}</strong></td>
                  <td data-label="Requirement">${d.required ? '<span class="rp-badge red">Required</span>' : '<span class="rp-badge grey">Follow-up</span>'}</td>
                  <td data-label="Status">
                    ${!file
                      ? `<span class="rp-badge red">Missing</span>`
                      : complete
                        ? `<span class="rp-badge green">Complete</span>`
                        : `<span class="rp-badge gold">Awaiting review</span>`}
                  </td>
                  <td style="text-align:right" data-label="Action">
                    ${file ? `<button class="rp-btn rp-btn-ghost rp-btn-sm" data-doc-url="${esc(file)}" onclick="window.viewDocument(this.dataset.docUrl)">View File</button>` : ''}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <div class="progress-card">
      ${confirmed ? `
        <div class="rp-card-head"><h3>Documents Confirmed</h3></div>
        <div class="rp-notice mint" style="margin-bottom:0;">
          <span>You confirmed these documents. ${applicationStatus(app) === 'Enrolled'
            ? 'Your fees are paid and you are officially enrolled.'
            : applicationStatus(app) === 'Enrollee'
              ? 'The Registrar accepted your application. Once the Faculty assigns your subjects and you pay your tuition, you are officially enrolled.'
              : 'They now wait for the Registrar to accept your application.'}</span>
        </div>
      ` : missing.length ? `
        <div class="rp-card-head"><h3>Confirm All Documents</h3></div>
        <div class="rp-notice info" style="margin-bottom:0;">
          <span>Upload the remaining required document(s) first: ${missing.map(id => {
            const d = docs.find(x => x.id === id);
            return esc(d ? d.name : id);
          }).join(', ')}.</span>
        </div>
      ` : `
        <div class="rp-card-head"><h3>Confirm All Documents</h3></div>
        <p class="rp-hint">
          Every required document has been uploaded. Press the button below to confirm them.
          Confirming is final: the application can no longer be returned. The Registrar then marks each document complete and accepts you as an Enrollee.
        </p>
        <button type="button" class="btn btn-primary" style="margin-top:14px;" data-action="confirmDocuments">Confirm All Documents</button>
      `}
    </div>
  `;
}

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

  // Receipts: every payment logged for this student (online or recorded by Accounting)
  const logs = await supa('payment_logs', { match: { user_id: session.userId } }).catch(() => []);
  const peso = (n) => Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 });

  let runningTotal = 0;
  const receipts = logs
    .slice()
    .sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0))
    .map(log => {
      runningTotal += Number(log.amount || 0);
      return { log, cumulative: runningTotal };
    })
    .reverse(); // newest receipt first

  const receiptsHtml = receipts.length ? receipts.map(({ log, cumulative }) => {
    const when = log.created_at ? new Date(log.created_at) : null;
    const dateText = when && !isNaN(when)
      ? when.toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })
      : 'Date not recorded';

    return `
      <div class="rp-card" style="margin-bottom:14px; border-left:4px solid var(--gold-500);">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:16px; flex-wrap:wrap;">
          <div>
            <div style="font-family:var(--serif); font-size:15.5px; font-weight:800; color:var(--mint-800);">UNIDA CHRISTIAN COLLEGES</div>
            <div class="rp-hint" style="font-size:10.5px; letter-spacing:1px; text-transform:uppercase;">Official Payment Receipt</div>
          </div>
          <div style="text-align:right;">
            <div class="rp-badge grey">${esc(log.reference_no || 'No reference')}</div>
            <div class="rp-hint" style="margin-top:6px;">${esc(dateText)}</div>
          </div>
        </div>

        <div class="rp-grid-2" style="margin-top:16px;">
          <div>
            <div class="rp-hint">Payment Type</div>
            <strong>${esc(log.payment_type || 'Payment')}</strong>
          </div>
          <div>
            <div class="rp-hint">Processed By</div>
            <strong>${esc(log.processed_by || 'Online')}</strong>
          </div>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:flex-end; gap:16px; flex-wrap:wrap; border-top:1px dashed var(--line); margin-top:14px; padding-top:12px;">
          <div class="rp-hint">Received from ${esc(session.name)} · total paid to date ₱${peso(cumulative)}</div>
          <div style="font-size:20px; font-weight:800; color:var(--mint-700);">₱${peso(log.amount)}</div>
        </div>
      </div>
    `;
  }).join('') : `
    <div class="rp-empty">No payments recorded yet. Receipts appear here as soon as a payment is made online or recorded by the Accounting office.</div>
  `;

  return `
    <div class="progress-card">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
        <h3>Payment Assessment</h3>
        <span class="rp-badge ${balance <= 0 ? 'green' : 'gold'}">${balance <= 0 ? 'Fully Paid' : 'Pending Payment'}</span>
      </div>

      <div class="rp-grid-2" style="margin-bottom: 24px;">
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
              <div class="custom-pay-row">
                <div class="field">
                  <label>Or pay a custom amount</label>
                  <input class="rp-input" type="number" id="customPayAmount" min="1" step="0.01"
                         placeholder="Up to ₱${balance.toLocaleString('en-PH', { minimumFractionDigits: 2 })}">
                </div>
                <button class="btn btn-outline" onclick="window.payCustomAmount(${total}, ${paid})">Pay Custom Amount</button>
              </div>
            </div>
          ` : `
            <div class="rp-notice mint" style="margin-top:20px;">
              <span>Your tuition is fully paid. You can now view your Schedule and Registration Form.</span>
            </div>
          `}
        </div>
      </div>

      <div class="rp-card">
        <div class="rp-card-head"><h3>Subject List</h3></div>
        <div class="rp-table-wrap">
          <table class="rp-table" style="min-width:0;">
            <thead><tr><th>Course Code</th><th>Description</th><th style="text-align:center">Units</th></tr></thead>
            <tbody>${subjectsHtml}</tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="progress-card">
      <div class="rp-card-head">
        <h3>Payment Receipts</h3>
        <span class="rp-hint">${receipts.length} transaction${receipts.length === 1 ? '' : 's'} · synced with the Accounting payment logs</span>
      </div>
      ${receiptsHtml}
    </div>
  `;
}

export async function renderScheduleTab(app, subjects, courses) {
  let pr = app.program || {};
  if (typeof pr === 'string') { try { pr = JSON.parse(pr); } catch(e){} }
  
  const progName = programLabel(pr.preferred);

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
          <strong>${esc(getAcademicTerm().semester)}</strong>
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

// The registration form lives in regform.js because the Registrar, Accounting
// and Admin portals print the same document as their own copy.
export async function renderRegistrationTab(app, subjects, courses, settings) {
  return registrationFormHtml({
    app,
    subjects,
    courses,
    settings,
    copyLabel: "STUDENT'S COPY",
    fallbackName: session.name
  });
}

// The year level choices follow the program's own number of year levels.
window.syncApplicationYears = (select) => {
  const yearSelect = document.getElementById('programYearSelect');
  if (!yearSelect) return;
  const chosen = yearSelect.value;
  yearSelect.innerHTML = '<option value="">Select year level</option>' +
    yearLevelsFor(select.value)
      .map(y => `<option value="${y}" ${String(chosen) === String(y) ? 'selected' : ''}>${yearLabel(y)}</option>`)
      .join('');
};
