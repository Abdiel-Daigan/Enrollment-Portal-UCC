import { esc, toast, isHistorySubject } from './utils.js';
import { supa } from './api.js';
import { decodePrereqSet, hydratePrereqSets } from './prereqs.js';
import { reportCard } from './report.js';
import { DOC_TYPES, docsComplete, missingRequiredDocs, docUploaded, docComplete, requiredDocsComplete } from './documents.js';
import { applicationStatus, statusTone, isEnrolled, isAccepted, canAccept, hasRegistrationForm, acceptBlockReason } from './status.js';
import { registrationFormHtml } from './regform.js';
import {
  isMetaRow,
  getPrograms,
  programById,
  programLabel,
  programOptionsHtml,
  programPickerHtml,
  getCourseProgramIds,
  courseMatchesProgram,
  courseProgramLabels,
  presetMatchesProgram,
  prereqMatchesProgram,
  getAcademicTerm,
  currentSemester,
  allYearLevels,
  yearLabel,
  yearLevelsFor,
  yearOptionsHtml,
  MAX_PROGRAM_YEARS,
  SEMESTERS
} from './catalog.js';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// --- REGISTRAR DASHBOARD ---
export async function renderRegistrarDashboard() {
  const [students, courses, presetRows, apps, subjectRows, logRows] = await Promise.all([
    supa('users', { match: { role: 'student' } }).catch(() => []),
    supa('courses').catch(() => []),
    supa('presets').catch(() => []),
    supa('applications').catch(() => []),
    supa('student_subjects').catch(() => []),
    supa('payment_logs').catch(() => [])
  ]);

  const presets = presetRows.filter(p => !isMetaRow(p));
  const prereqSets = presetRows.map(decodePrereqSet).filter(Boolean);
  const submitted = apps.filter(a => a.submitted && !a.returned);
  const enrolled = apps.filter(isEnrolled).length;
  const docsPending = submitted.filter(a => !docsComplete(a)).length;
  const verified = submitted.length - docsPending;
  const collected = logRows.reduce((sum, l) => sum + Number(l.amount || 0), 0);

  const programRows = getPrograms().filter(p => !p.general).map((p) => {
    const ofProgram = apps.filter(a => {
      let pr = a.program || {};
      if (typeof pr === 'string') { try { pr = JSON.parse(pr); } catch (e) { pr = {}; } }
      return String(pr.preferred) === String(p.id);
    });
    return [
      p.code,
      ofProgram.length,
      ofProgram.filter(a => a.submitted && !a.returned).length,
      ofProgram.filter(isEnrolled).length
    ];
  });

  const studentRows = students.map(u => {
    const app = apps.find(a => String(a.user_id) === String(u.id)) || {};
    let pr = app.program || {};
    if (typeof pr === 'string') { try { pr = JSON.parse(pr); } catch (e) { pr = {}; } }
    const load = subjectRows.filter(s => String(s.user_id) === String(u.id) && !['Passed', 'Dropped', 'Failed'].includes(String(s.remarks || '').trim()));
    return [
      u.name,
      u.student_id || '-',
      programLabel(pr.preferred, 'Not set'),
      pr.year_level ? 'Year ' + pr.year_level : '-',
      applicationStatus(app),
      app.doc_type ? (docsComplete(app) ? 'Confirmed' : 'Not confirmed') : 'No checklist',
      load.length,
      Number(app.amount_paid || 0).toFixed(2)
    ];
  });

  return `
    <div class="rp-grid-4">
      <div class="rp-card rp-stat"><div class="ic">ST</div><div><div class="val">${students.length}</div><div class="lbl">Total Students</div></div></div>
      <div class="rp-card rp-stat gold"><div class="ic">PA</div><div><div class="val">${submitted.length}</div><div class="lbl">Pending Applicants</div></div></div>
      <div class="rp-card rp-stat"><div class="ic">EN</div><div><div class="val">${enrolled}</div><div class="lbl">Officially Enrolled</div></div></div>
      <div class="rp-card rp-stat gold"><div class="ic">DC</div><div><div class="val">${docsPending}</div><div class="lbl">Documents Awaiting Confirmation</div></div></div>
    </div>

    <div class="rp-grid-4">
      <div class="rp-card rp-stat"><div class="ic">SB</div><div><div class="val">${courses.length}</div><div class="lbl">Total Subjects</div></div></div>
      <div class="rp-card rp-stat gold"><div class="ic">PR</div><div><div class="val">${presets.length}</div><div class="lbl">Subject Presets</div></div></div>
      <div class="rp-card rp-stat"><div class="ic">PQ</div><div><div class="val">${prereqSets.length}</div><div class="lbl">Prerequisite Sequences</div></div></div>
      <div class="rp-card rp-stat gold"><div class="ic">VR</div><div><div class="val">${verified}</div><div class="lbl">Confirmed Applications</div></div></div>
    </div>

    <div class="rp-grid-2">
      <div class="rp-card">
        <div class="rp-card-head"><h3>Enrollment Summary by Program</h3></div>
        <div class="rp-table-wrap">
          <table class="rp-table" style="min-width:0;">
            <thead><tr><th>Program</th><th>Students</th><th>Applicants</th><th>Enrolled</th></tr></thead>
            <tbody>
              ${programRows.map(r => `<tr><td><strong>${esc(r[0])}</strong></td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td></tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
      <div class="rp-card">
        <div class="rp-card-head"><h3>Records Overview</h3></div>
        <p class="rp-hint">Payments recorded: <strong>PHP ${collected.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</strong> across ${logRows.length} transaction(s).</p>
        <p class="rp-hint" style="margin-top:8px;">Subjects on record: ${subjectRows.length} · Presets in use: ${presets.length} · Prerequisite sequences: ${prereqSets.length}.</p>
      </div>
    </div>

    ${reportCard({
      id: 'registrar-students',
      title: 'Student Enrollment Report',
      hint: 'Every student with program, status, document verification, subject load and amount paid.',
      columns: ['Student', 'Student ID', 'Program', 'Year', 'Status', 'Documents', 'Subjects', 'Amount Paid'],
      rows: studentRows,
      filename: 'ucc-registrar-students.csv'
    })}
  `;
}

// --- STUDENT MANAGEMENT ---
export async function renderRegistrarStudents() {
  const apps = await supa('applications').catch(() => []);
  const users = await supa('users').catch(() => []);
  
  const searchQ = (window.regSearch || '').toLowerCase();
  const filterProg = window.regFilterProg || '';
  const filterYear = window.regFilterYear || '';
  const filterStatus = window.regFilterStatus || '';

  // Filter logic
  const filtered = apps.filter(app => {
    const u = users.find(x => String(x.id) === String(app.user_id)) || {};
    if (!u.name) return false;

    let pr = app.program || {};
    if (typeof pr === 'string') { try { pr = JSON.parse(pr); } catch(e){} }

    const nameMatch = searchQ ? (u.name.toLowerCase().includes(searchQ) || (u.student_id && u.student_id.toLowerCase().includes(searchQ))) : true;
    const progMatch = filterProg ? String(pr.preferred) === String(filterProg) : true;
    const yearMatch = filterYear ? String(pr.year_level) === String(filterYear) : true;
    
    const statusLabel = applicationStatus(app);
    let statusMatch = true;
    if (filterStatus === 'enrolled') statusMatch = statusLabel === 'Enrolled';
    else if (filterStatus === 'enrollee') statusMatch = statusLabel === 'Enrollee';
    else if (filterStatus === 'documents') statusMatch = statusLabel === 'Documents Complete';
    else if (filterStatus === 'applicant') statusMatch = statusLabel === 'Applicant';

    return nameMatch && progMatch && yearMatch && statusMatch;
  });

  return `
    <div class="rp-toolbar" style="gap: 10px; flex-wrap: wrap;">
      <div class="grow" style="min-width: 200px;">
        <form id="regStudentSearchForm" style="display:flex; gap:8px;">
          <input class="rp-input" type="text" id="regSearchInput" placeholder="Search name or student ID, then press Enter..." value="${esc(window.regSearch || '')}">
          <button type="submit" class="rp-btn rp-btn-primary">Search</button>
        </form>
      </div>
      <div style="width: 140px;">
        <select class="rp-input" data-change="regFilterProg">
          ${programOptionsHtml(filterProg, { all: true, allValue: '' })}
        </select>
      </div>
      <div style="width: 140px;">
        <select class="rp-input" data-change="regFilterYear">
          <option value="">All Years</option>
          ${allYearLevels().map(y => `<option value="${y}" ${String(filterYear) === String(y) ? 'selected' : ''}>${yearLabel(y)}</option>`).join('')}
        </select>
      </div>
      <div style="width: 160px;">
        <select class="rp-input" data-change="regFilterStatus">
          <option value="">All Statuses</option>
          <option value="applicant" ${filterStatus === 'applicant' ? 'selected' : ''}>Applicant (Documents Incomplete)</option>
          <option value="documents" ${filterStatus === 'documents' ? 'selected' : ''}>Documents Complete (Awaiting Acceptance)</option>
          <option value="enrollee" ${filterStatus === 'enrollee' ? 'selected' : ''}>Enrollee (Accepted, Unpaid)</option>
          <option value="enrolled" ${filterStatus === 'enrolled' ? 'selected' : ''}>Enrolled</option>
        </select>
      </div>
    </div>

    <div class="rp-table-wrap">
      <table class="rp-table">
        <thead><tr><th>Student Name</th><th>Student ID</th><th>Program</th><th>Status</th><th style="text-align:right">Action</th></tr></thead>
        <tbody>
          ${filtered.length ? filtered.map(app => {
            const u = users.find(x => String(x.id) === String(app.user_id)) || { name: 'Unknown' };
            let pr = app.program || {};
            if (typeof pr === 'string') { try { pr = JSON.parse(pr); } catch(e){} }
            const progName = programLabel(pr.preferred);
            const statusLabel = applicationStatus(app);

            return `
              <tr>
                <td><strong>${esc(u.name)}</strong></td>
                <td>${esc(u.student_id || '—')}</td>
                <td><span class="rp-badge green">${progName}</span></td>
                <td>
                  <span class="rp-badge ${statusTone(statusLabel)}">${esc(statusLabel)}</span>
                </td>
                <td style="text-align:right; white-space:nowrap;">
                  <button class="rp-btn rp-btn-primary rp-btn-sm" data-action="regManageStudent" data-id="${app.user_id}">Manage</button>
                </td>
              </tr>
            `;
          }).join('') : '<tr><td colspan="5" class="rp-empty">No students found.</td></tr>'}
        </tbody>
      </table>
    </div>
  `;
}

const peso = (n) => Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 });

export async function regManageStudentModal(userId, tab, copyLabel = 'REGISTRAR COPY') {
  // The registration form only exists for an accepted student, so the tab is
  // never opened for an applicant.
  const requestedTab = tab === 'registration' ? tab : (tab || 'documents');
  window.regModalTab = requestedTab;
  let activeTab = window.regModalTab;

  const users = await supa('users', { match: { id: userId } }).catch(() => []);
  const u = users[0] || {};
  const apps = await supa('applications', { match: { user_id: userId } }).catch(() => []);
  const app = apps[0] || {};
  const courses = await supa('courses').catch(() => []);
  const subjects = await supa('student_subjects', { match: { user_id: userId } }).catch(() => []);
  const logs = await supa('payment_logs', { match: { user_id: userId } }).catch(() => []);
  const settingsRes = await supa('system_settings', { match: { id: 1 } }).catch(() => []);
  const settings = settingsRes[0] || { tuition_per_unit: 444, misc_fee: 5452, reg_fee: 1000 };

  let pr = app.program || {};
  if (typeof pr === 'string') { try { pr = JSON.parse(pr); } catch (e) { pr = {}; } }
  const personal = app.personal || {};
  const education = app.education || {};
  const courseById = (id) => courses.find(c => String(c.id) === String(id)) || {};

  const docs = DOC_TYPES[app.doc_type] || [];
  const uploaded = app.documents || {};
  const accepted = isAccepted(app);
  const registrationAllowed = hasRegistrationForm(app);
  const acceptReady = canAccept(app);

  // Asking for the registration tab on a student without a form falls back to
  // the documents tab instead of opening an empty pane.
  if (window.regModalTab === 'registration' && !registrationAllowed) {
    window.regModalTab = 'documents';
    activeTab = 'documents';
  }

  // ---------- Documents pane ----------
  const docRows = docs.length ? docs.map(d => {
    const hasFile = docUploaded(app, d.id);
    const complete = docComplete(app, d.id);

    // The Complete button only appears on a document that has a file. Pressing
    // it again is the Undo that puts the document back to Missing.
    return `
      <tr>
        <td>
          <strong>${esc(d.name)}</strong><br>
          ${d.required ? '<span class="rp-badge red" style="margin-top:4px;">Required</span>' : '<span class="rp-badge grey" style="margin-top:4px;">Follow-up</span>'}
        </td>
        <td data-label="File">
          ${hasFile
            ? `<button class="rp-btn rp-btn-ghost rp-btn-sm" data-doc-url="${esc(uploaded[d.id])}" onclick="window.viewDocument(this.dataset.docUrl)">View File</button>`
            : `<span class="rp-badge gold">Not Uploaded</span>`}
        </td>
        <td data-label="Complete" style="white-space:nowrap;">
          <button type="button" class="rp-btn rp-btn-sm ${complete ? 'rp-btn-ghost' : 'rp-btn-primary'}"
                  data-action="regToggleDoc" data-student="${userId}" data-doc="${d.id}"
                  ${hasFile ? '' : 'disabled title="The student has not uploaded this document yet."'}
                  >${complete ? 'Undo' : 'Complete'}</button>
          ${hasFile && !complete ? '<div class="rp-hint" style="margin-top:4px;">Awaiting your review</div>' : ''}
        </td>
      </tr>
    `;
  }).join('') : '<tr><td colspan="3" class="rp-empty">No document checklist recorded for this application yet.</td></tr>';

  const documentsPane = `
    <p class="rp-hint" style="margin-bottom:12px;">Mark a document complete after you have checked the uploaded file. Undo puts it back to missing. The Accept Student button at the bottom unlocks once every required document is complete, and it locks again if a document is undone.</p>

    <div class="rp-table-wrap">
      <table class="rp-table doc-table" style="min-width:0;">
        <thead><tr><th>Document Name</th><th>File</th><th style="text-align:left;">Complete</th></tr></thead>
        <tbody>${docRows}</tbody>
      </table>
    </div>

    <div class="rp-notice ${accepted ? 'mint' : 'info'}" style="margin-top:16px; margin-bottom:0;">
      <span>${accepted
        ? `Accepted as <strong>${esc(applicationStatus(app))}</strong> · Student ID: <strong>${esc(u.student_id || 'not issued')}</strong>. The Faculty can now assign subjects.`
        : `Status: <strong>${esc(applicationStatus(app))}</strong> · ${esc(acceptReady
            ? 'Every required document is complete, so the student can be accepted.'
            : acceptBlockReason(app) || 'Complete every required document first.')}`}</span>
    </div>

    ${!app.submitted || app.documents_verified ? '' : `
    <div style="margin-top: 20px; border-top: 1px solid #eee; padding-top: 20px;">
      <h4 style="margin-bottom: 10px; font-size:14px;">Return Application?</h4>
      <p class="rp-hint" style="margin-bottom: 10px;">If a document is invalid or missing, you can return the application to the student with a reason. Once the student confirms the documents this option disappears.</p>
      <form id="regReturnForm" style="display:flex; gap:10px;">
        <input type="hidden" name="user_id" value="${userId}">
        <input class="rp-input" name="feedback" placeholder="Reason for returning (e.g., Blurry PSA image)" required>
        <button type="submit" class="rp-btn rp-btn-danger">Return Application</button>
      </form>
    </div>`}
  `;

  // ---------- Subjects pane ----------
  const subjectRows = subjects.length ? subjects.map(s => {
    const c = courseById(s.course_id);
    const remarks = String(s.remarks || 'Ongoing');
    const badge = remarks === 'Passed' ? 'green' : remarks === 'Dropped' ? 'red' : 'gold';

    return `
      <tr>
        <td><strong>${esc(c.code || '—')}</strong></td>
        <td>${esc(c.title || 'Unknown subject')}</td>
        <td style="text-align:center">${esc(c.units)}</td>
        <td>${esc(s.grade)}</td>
        <td><span class="rp-badge ${badge}">${esc(remarks)}</span></td>
        <td style="text-align:right">
          <button type="button" class="rp-btn rp-btn-danger rp-btn-sm" onclick="window.regDeleteStudentSubject(${s.id}, ${userId})">Remove</button>
        </td>
      </tr>
    `;
  }).join('') : '<tr><td colspan="6" class="rp-empty">No subjects recorded for this student yet.</td></tr>';

  // The document that records the subjects this student already took. Only
  // some application types bring one: Form 138 for freshmen and the
  // Transcript of Records for transferees. Returnees have none, so no panel
  // is shown at all for them.
  const SUBJECT_RECORD_DOC = { freshman: 'form138', transferee: 'tor' };
  const subjectRecordDocId = SUBJECT_RECORD_DOC[app.doc_type] || null;
  const subjectRecordDoc = subjectRecordDocId ? docs.find(d => d.id === subjectRecordDocId) : null;
  const subjectRecordUrl = subjectRecordDocId ? uploaded[subjectRecordDocId] : null;

  // No document on file: never show an empty viewer, only the missing-file
  // notice so the staff member knows why there is nothing to reference.
  const subjectDocPane = !subjectRecordDoc ? '' : (subjectRecordUrl
    ? `
      <aside class="reg-subject-doc">
        <div class="rp-card-head">
          <h3>${esc(subjectRecordDoc.name)}</h3>
          <button type="button" class="rp-btn rp-btn-ghost rp-btn-sm" data-doc-url="${esc(subjectRecordUrl)}" onclick="window.viewDocument(this.dataset.docUrl)">Open in new tab</button>
        </div>
        ${documentPreview(subjectRecordUrl, subjectRecordDoc.name)}
        <p class="rp-hint" style="margin-top:10px;">Reference for the subjects this student has already taken.</p>
      </aside>
    `
    : `
      <aside class="reg-subject-doc">
        <div class="rp-notice red" style="margin-bottom:0;">
          <div>
            <strong>${esc(subjectRecordDoc.name)} has not been uploaded yet.</strong>
            <div class="rp-hint" style="color:inherit;">There is no file to show as a reference for the subjects this student has taken.</div>
          </div>
        </div>
      </aside>
    `);

  const subjectsPane = `
    <div class="reg-subjects-layout${subjectDocPane ? ' has-doc' : ''}">
      <div class="reg-subjects-main">
        <div class="rp-card" style="background:var(--mint-50); margin-bottom:18px;">
          <div style="display:flex; gap:12px; flex-wrap:wrap; align-items:flex-end;">
            <div class="field" style="flex:1 1 180px; margin-bottom:0;">
              <label>Course Code</label>
              <input class="rp-input" id="reg_subject_code" placeholder="e.g. BSCS-101" oninput="this.value = this.value.toUpperCase(); window.regLookupCourseCode();">
            </div>
            <div class="field" style="flex:2 1 240px; margin-bottom:0;">
              <label>Course Name</label>
              <input class="rp-input" id="reg_subject_title" placeholder="Fills in automatically from the course code" readonly>
            </div>
            <div class="field" style="width:110px; margin-bottom:0;">
              <label>Grade</label>
              <input class="rp-input" id="reg_subject_grade" placeholder="e.g. 1.25">
            </div>
            <div class="field" style="width:150px; margin-bottom:0;">
              <label>Remarks</label>
              <select class="rp-input" id="reg_subject_remarks">
                <option value="Passed">Passed</option>
                <option value="Dropped">Dropped</option>
              </select>
            </div>
            <button type="button" class="rp-btn rp-btn-primary" onclick="window.regAddStudentSubject(${userId})">Add Subject</button>
          </div>
          <div id="regSubjectError" class="rp-hint" style="color:var(--danger); display:none; margin-top:10px;"></div>
        </div>

        <div class="rp-table-wrap">
          <table class="rp-table">
            <thead><tr><th>Code</th><th>Course Name</th><th style="text-align:center">Units</th><th>Grade</th><th>Remarks</th><th style="text-align:right">Action</th></tr></thead>
            <tbody>${subjectRows}</tbody>
          </table>
        </div>
      </div>
      ${subjectDocPane}
    </div>
  `;

  // ---------- Student record pane ----------
  // Same file access as the Documents tab, so the Student Record shows the
  // uploaded files and not only their status.
  const docStatusRows = docs.length ? docs.map(d => {
    const file = uploaded[d.id];
    const complete = docComplete(app, d.id);
    const status = complete ? 'Complete' : (file ? 'Awaiting review' : 'Missing');
    return `
      <tr>
        <td>${esc(d.name)}</td>
        <td data-label="File">
          ${file
            ? `<button class="rp-btn rp-btn-ghost rp-btn-sm" data-doc-url="${esc(file)}" onclick="window.viewDocument(this.dataset.docUrl)">View File</button>`
            : '<span class="rp-badge gold">Not Uploaded</span>'}
        </td>
        <td style="text-align:right" data-label="Status"><span class="rp-badge ${complete ? 'green' : (file ? 'gold' : 'red')}">${esc(status)}</span></td>
      </tr>
    `;
  }).join('') : '<tr><td colspan="3" class="rp-empty">No documents on file.</td></tr>';

  const paymentRows = logs.length ? logs
    .slice()
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
    .map(l => `
      <div style="display:flex; justify-content:space-between; gap:16px; padding:7px 0; border-bottom:1px solid #eef7f3;">
        <span class="rp-hint">${esc(l.created_at ? new Date(l.created_at).toLocaleDateString('en-PH') : '—')} · ${esc(l.reference_no || 'No reference')} · ${esc(l.processed_by || '—')} · ${esc(l.payment_type || '—')}</span>
        <strong style="font-size:12.8px;">₱${peso(l.amount)}</strong>
      </div>
    `).join('') : '<div class="rp-hint" style="padding:8px 0;">No payments recorded for this student.</div>';

  const recordPane = `
    <form id="regStudentRecordForm" class="reg-record-form">
      <input type="hidden" name="user_id" value="${userId}">

      <div class="rp-card">
        <div class="rp-card-head">
          <h3>Student Information</h3>
          <span class="rp-hint">Editable by the Registrar and the Admin</span>
        </div>
        <div class="rp-grid-2" style="gap:0 16px;">
          <div class="field"><label>Full Name</label><input class="rp-input" name="name" value="${esc(u.name || '')}" required></div>
          <div class="field"><label>Email</label><input class="rp-input" type="email" name="email" value="${esc(u.email || '')}" required></div>
          <div class="field"><label>Student ID</label><input class="rp-input" name="student_id" value="${esc(u.student_id || '')}" placeholder="e.g. UCC-2026-0001"></div>
          <div class="field"><label>Contact Number</label><input class="rp-input" name="phone" value="${esc(personal.phone || '')}"></div>
          <div class="field" style="grid-column:1 / -1;"><label>Address</label><input class="rp-input" name="address" value="${esc(personal.address || '')}"></div>
        </div>
      </div>

      <div class="rp-card" style="margin-top:16px;">
        <div class="rp-card-head"><h3>Enrollment</h3></div>
        <div class="rp-grid-2" style="gap:0 16px;">
          <div class="field">
            <label>Program</label>
            <select class="rp-input" name="program" onchange="window.regRecordProgramYears(this)">
              ${programOptionsHtml(pr.preferred, { includeGeneral: true })}
            </select>
          </div>
          <div class="field">
            <label>Year Level</label>
            <select class="rp-input" name="year_level">
              ${yearOptionsHtml(pr.year_level, yearLevelsFor(pr.preferred))}
            </select>
          </div>
          <div class="field">
            <label>Regularity</label>
            <select class="rp-input" name="is_regular">
              <option value="true" ${app.is_regular === false ? '' : 'selected'}>Regular</option>
              <option value="false" ${app.is_regular === false ? 'selected' : ''}>Irregular</option>
            </select>
          </div>
          <div class="field"><label>Status</label><input class="rp-input" value="${esc(applicationStatus(app))}" readonly></div>
        </div>
        <p class="rp-hint">Application type: <strong>${esc(app.doc_type || '—')}</strong> · Documents confirmed by the student: <strong>${app.documents_verified ? 'Yes' : 'No'}</strong> · Submitted: <strong>${app.submitted ? 'Yes' : 'No'}</strong> · Reference: <strong>${esc(app.reference || '—')}</strong>${app.returned ? ` · Returned: <strong>${esc(app.registrar_feedback || 'no feedback given')}</strong>` : ''}</p>
      </div>

      <div class="rp-card" style="margin-top:16px;">
        <div class="rp-card-head"><h3>Educational Background</h3></div>
        <div class="rp-grid-2" style="gap:0 16px;">
          <div class="field"><label>Elementary School</label><input class="rp-input" name="elem_school" value="${esc((education.elem || {}).school || '')}"></div>
          <div class="field"><label>Elementary Year</label><input class="rp-input" name="elem_year" value="${esc((education.elem || {}).year || '')}"></div>
          <div class="field"><label>Junior High School</label><input class="rp-input" name="jhs_school" value="${esc((education.jhs || {}).school || '')}"></div>
          <div class="field"><label>Junior High Year</label><input class="rp-input" name="jhs_year" value="${esc((education.jhs || {}).year || '')}"></div>
          <div class="field"><label>Senior High School</label><input class="rp-input" name="shs_school" value="${esc((education.shs || {}).school || '')}"></div>
          <div class="field"><label>Senior High Year</label><input class="rp-input" name="shs_year" value="${esc((education.shs || {}).year || '')}"></div>
        </div>
      </div>

      <button type="submit" class="rp-btn rp-btn-primary" style="margin-top:16px;">Save Student Record</button>
    </form>

    <div class="rp-card" style="margin-top:16px;">
      <div class="rp-card-head">
        <h3>Documents</h3>
        <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
          <span class="rp-badge ${app.documents_verified ? 'green' : 'gold'}">${app.documents_verified ? 'Confirmed by the student' : 'Not confirmed yet'}</span>
          <span class="rp-hint">${docs.filter(d => docComplete(app, d.id)).length}/${docs.length} complete</span>
        </div>
      </div>
      <div class="rp-table-wrap">
        <table class="rp-table" style="min-width:0;">
          <thead><tr><th>Document</th><th>File</th><th style="text-align:right">Status</th></tr></thead>
          <tbody>${docStatusRows}</tbody>
        </table>
      </div>
    </div>

    <div class="rp-card" style="margin-top:16px;">
      <div class="rp-card-head">
        <h3>Subjects &amp; Grades</h3>
        <span class="rp-badge green">${subjects.length} record(s)</span>
      </div>
      <div class="rp-table-wrap">
        <table class="rp-table">
          <thead><tr><th>Code</th><th>Course Name</th><th style="text-align:center">Units</th><th>Grade</th><th>Remarks</th><th style="text-align:right">Action</th></tr></thead>
          <tbody>${subjectRows}</tbody>
        </table>
      </div>
    </div>

    <div class="rp-card" style="margin-top:16px;">
      <div class="rp-card-head">
        <h3>Payments</h3>
        <span class="rp-badge gold">₱${peso(app.amount_paid)} paid</span>
      </div>
      ${paymentRows}
    </div>
  `;

  // ---------- Registration form pane ----------
  // The same document the student prints, labelled as the caller's copy. It is
  // only issued to an accepted student (Enrollee) or an enrolled one.
  const registrationPane = registrationAllowed
    ? registrationFormHtml({
      app,
      subjects: subjects.filter(s => !isHistorySubject(s)),
      courses,
      settings,
      copyLabel,
      fallbackName: u.name
    })
    : `<div class="rp-notice info"><span>This student has no registration form yet. The form is issued after the Registrar accepts the application and the student becomes an Enrollee.</span></div>`;

  const modalHtml = `
    <div class="rp-modal-backdrop" id="regStudentModal">
      <div class="rp-modal wide">
        <div class="rp-modal-head">
          <div>
            <h3>Manage Student — ${esc(u.name || 'Unknown student')}</h3>
            <div class="rp-hint">${esc(u.email || '')}${u.student_id ? ' · ' + esc(u.student_id) : ''}</div>
          </div>
          <button type="button" class="rp-btn rp-btn-ghost rp-btn-sm" onclick="document.getElementById('regStudentModal').remove()">✕</button>
        </div>
        <div class="rp-modal-body">
          <div class="rp-tabs">
            <button type="button" class="rp-tab ${activeTab === 'documents' ? 'active' : ''}" data-tab="documents" onclick="window.regStudentModalTab('documents')">Documents</button>
            <button type="button" class="rp-tab ${activeTab === 'subjects' ? 'active' : ''}" data-tab="subjects" onclick="window.regStudentModalTab('subjects')">Course(s) Taken</button>
            <button type="button" class="rp-tab ${activeTab === 'record' ? 'active' : ''}" data-tab="record" onclick="window.regStudentModalTab('record')">Student Record</button>
            ${registrationAllowed ? `<button type="button" class="rp-tab ${activeTab === 'registration' ? 'active' : ''}" data-tab="registration" onclick="window.regStudentModalTab('registration')">Registration Form</button>` : ''}
          </div>

          <div class="rp-pane ${activeTab === 'documents' ? 'active' : ''}" data-pane="documents">${documentsPane}</div>
          <div class="rp-pane ${activeTab === 'subjects' ? 'active' : ''}" data-pane="subjects">${subjectsPane}</div>
          <div class="rp-pane ${activeTab === 'record' ? 'active' : ''}" data-pane="record">${recordPane}</div>
          ${registrationAllowed ? `<div class="rp-pane ${activeTab === 'registration' ? 'active' : ''}" data-pane="registration">${registrationPane}</div>` : ''}
        </div>
        <div class="rp-modal-foot">
          <div class="rp-accept">
            <button type="button" class="rp-btn ${acceptReady ? 'rp-btn-primary' : 'rp-btn-ghost'} rp-btn-sm"
                    data-action="regAcceptStudent" data-id="${userId}" ${acceptReady ? '' : 'disabled'}>${accepted ? 'Accepted' : 'Accept Student'}</button>
            <span class="rp-hint">${accepted
              ? `Accepted${u.student_id ? ' · Student ID ' + esc(u.student_id) : ''}`
              : esc(acceptReady
                ? (subjects.length ? 'Every required document is complete.' : 'Every required document is complete. No subjects are assigned yet — the Faculty adds the load after acceptance.')
                : (acceptBlockReason(app) || 'Complete every required document first.'))}</span>
          </div>
          <button type="button" class="rp-btn rp-btn-primary" onclick="document.getElementById('regStudentModal').remove()">Done</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('regStudentModal')?.remove();
  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

// The year levels a program offers, kept in step when the program changes in
// the Student Record form.
window.regRecordProgramYears = (select) => {
  const form = select && select.form;
  if (!form) return;
  const yearSelect = form.querySelector('[name="year_level"]');
  if (!yearSelect) return;
  const current = yearSelect.value;
  yearSelect.innerHTML = yearOptionsHtml(current, yearLevelsFor(select.value));
};

window.regStudentModalTab = (tab) => {
  // Never switch to a pane the student does not have (e.g. a registration form
  // for an applicant) — the modal would go blank.
  if (!document.querySelector(`#regStudentModal .rp-pane[data-pane="${tab}"]`)) return;
  window.regModalTab = tab;
  document.querySelectorAll('#regStudentModal .rp-pane').forEach(p => {
    p.classList.toggle('active', p.dataset.pane === tab);
  });
  document.querySelectorAll('#regStudentModal .rp-tab').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tab);
  });
};

window.regLookupCourseCode = async () => {
  const codeInput = document.getElementById('reg_subject_code');
  const titleInput = document.getElementById('reg_subject_title');
  const err = document.getElementById('regSubjectError');
  if (!codeInput || !titleInput || !err) return;

  const code = (codeInput.value || '').trim().toUpperCase();
  if (!code) {
    titleInput.value = '';
    err.style.display = 'none';
    return;
  }

  const courses = await supa('courses').catch(() => []);
  const course = courses.find(c => String(c.code || '').trim().toUpperCase() === code);

  if (!course) {
    titleInput.value = '';
    err.textContent = 'Invalid course code';
    err.style.display = 'block';
    return;
  }

  titleInput.value = `${course.title} (${course.units} units)`;
  err.style.display = 'none';
};

window.regAddStudentSubject = async (userId) => {
  const codeInput = document.getElementById('reg_subject_code');
  const gradeInput = document.getElementById('reg_subject_grade');
  const remarksInput = document.getElementById('reg_subject_remarks');
  const err = document.getElementById('regSubjectError');
  if (!codeInput || !err) return;

  const code = (codeInput.value || '').trim().toUpperCase();
  const grade = (gradeInput ? gradeInput.value : '').trim();
  const remarks = remarksInput ? remarksInput.value : 'Passed';

  if (!code) {
    err.textContent = 'Enter a course code first.';
    err.style.display = 'block';
    return;
  }

  try {
    const courses = await supa('courses').catch(() => []);
    const course = courses.find(c => String(c.code || '').trim().toUpperCase() === code);

    if (!course) {
      err.textContent = 'Invalid course code';
      err.style.display = 'block';
      return;
    }

    const existing = await supa('student_subjects', { match: { user_id: Number(userId) } }).catch(() => []);
    if (existing.some(s => String(s.course_id) === String(course.id))) {
      err.textContent = 'This subject is already recorded for this student.';
      err.style.display = 'block';
      return;
    }

    await supa('student_subjects', {
      method: 'POST',
      body: {
        user_id: Number(userId),
        course_id: Number(course.id),
        status: remarks,
        grade: grade || null,
        remarks: remarks
      }
    });

    toast(`${course.code} saved as ${remarks}.`);
    await regManageStudentModal(userId, 'subjects');
  } catch (e) {
    console.error('Add subject failed:', e);
    const message = String(e.message || '');
    // PostgREST reports unknown columns as a schema-cache miss
    const missingColumns = /grade|remarks|column|schema cache/i.test(message);
    err.textContent = missingColumns
      ? 'Could not save: the student_subjects table is missing the grade/remarks columns. Run the database setup SQL first, then try again.'
      : 'Could not save the subject: ' + (message || 'unknown error');
    err.style.display = 'block';
  }
};

window.regDeleteStudentSubject = async (rowId, userId) => {
  // A paid load can only be corrected by the Registrar or the Admin, and only
  // after they acknowledge that the student has already paid for it.
  const apps = await supa('applications', { match: { user_id: Number(userId) } }).catch(() => []);
  const paid = Number((apps[0] || {}).amount_paid || 0) > 0;
  const question = paid
    ? 'This student has already paid for this load. Removing the subject changes a paid enrollment. Continue?'
    : 'Remove this subject record from the student?';
  if (!confirm(question)) return;
  try {
    await supa('student_subjects', { method: 'DELETE', match: { id: Number(rowId) } });
    toast('Subject record removed.');
    await regManageStudentModal(userId, window.regModalTab || 'subjects');
  } catch (e) {
    console.error('Delete subject failed:', e);
    toast('Could not remove the subject record.', 'error');
  }
};

/* Previews an uploaded reference document inline (PDF or image).
   window.viewDocument is defined once in utils.js. */
function documentPreview(url, name) {
  const path = String(url).split('?')[0].toLowerCase();
  if (/\.(png|jpe?g|gif|webp|bmp|svg)$/.test(path)) {
    return `<div class="reg-doc-preview"><img src="${esc(url)}" alt="${esc(name)}"></div>`;
  }
  if (/\.pdf$/.test(path)) {
    return `<div class="reg-doc-preview"><iframe src="${esc(url)}" title="${esc(name)}"></iframe></div>`;
  }
  return `<div class="reg-doc-preview reg-doc-preview-file"><a class="rp-btn rp-btn-primary" href="${esc(url)}" target="_blank" rel="noopener">Open ${esc(name)}</a></div>`;
}

// --- REGISTRAR PRESETS ---
export async function renderRegistrarPresets() {
  // Rows that hold prerequisite sequences live in the same table and are hidden here.
  const presets = (await supa('presets')).filter(p => !isMetaRow(p));
  const presetSubs = await supa('preset_subjects').catch(() => []);
  const filterProg = window.regPresetFilterProg || 'all';
  const filterYear = window.regPresetFilterYear || 'all';
  const filterSem = window.regPresetFilterSem || 'all';

  const filteredPresets = presets.filter(p => {
    // General and Unspecified presets are offered to every program, so they
    // stay in the list when a single program is chosen.
    const progMatch = filterProg === 'all' || presetMatchesProgram(p, filterProg);
    const yearMatch = filterYear === 'all' || String(p.year_level) === String(filterYear);
    const semMatch = filterSem === 'all' || String(p.semester) === String(filterSem);
    return progMatch && yearMatch && semMatch;
  });

  return `
    <div class="rp-toolbar" style="margin-bottom:20px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
      <div style="display:flex; gap:10px;">
        <select class="rp-input" data-change="regPresetFilterProg" style="width:160px;">
          ${programOptionsHtml(filterProg, { all: true })}
        </select>
        <select class="rp-input" data-change="regPresetFilterYear" style="width:140px;">
          <option value="all">All Years</option>
          ${allYearLevels().map(y => `<option value="${y}" ${String(filterYear) === String(y) ? 'selected' : ''}>${yearLabel(y)}</option>`).join('')}
        </select>
        <select class="rp-input" data-change="regPresetFilterSem" style="width:170px;">
          <option value="all">All Semesters</option>
          ${SEMESTERS.map(s => `<option value="${esc(s)}" ${filterSem === s ? 'selected' : ''}>${esc(s)}</option>`).join('')}
        </select>
      </div>
      <button class="rp-btn rp-btn-primary" data-action="regCreatePreset">＋ Create New Preset</button>
    </div>

    <div class="rp-table-wrap">
      <table class="rp-table">
        <thead><tr><th>Preset Name</th><th>Program</th><th>Year</th><th>Sem</th><th>Subjects</th><th style="text-align:right">Actions</th></tr></thead>
        <tbody>
          ${filteredPresets.length ? filteredPresets.map(p => {
            const count = presetSubs.filter(ps => String(ps.preset_id) === String(p.id)).length;
            const pName = programLabel(p.program_id);
            return `
              <tr>
                <td><strong>${esc(p.name)}</strong></td>
                <td><span class="rp-badge ${String(p.program_id) === '0' ? 'gold' : 'green'}">${pName}</span></td>
                <td>${yearLabel(p.year_level)}</td>
                <td>${esc(p.semester)}</td>
                <td>${count} subject(s)</td>
                <td style="text-align:right; white-space:nowrap;">
                  <button class="rp-btn rp-btn-primary rp-btn-sm" data-action="regEditPreset" data-id="${p.id}">Edit</button>
                  <button class="rp-btn rp-btn-danger rp-btn-sm" data-action="regDeletePreset" data-id="${p.id}">Delete</button>
                </td>
              </tr>
            `;
          }).join('') : '<tr><td colspan="6" class="rp-empty">No presets found.</td></tr>'}
        </tbody>
      </table>
    </div>
  `;
}

// --- REGISTRAR COURSES ---
export async function renderRegistrarCourses() {
  const courses = await supa('courses').catch(() => []);
  const filterProg = window.regCourseFilterProg || 'all';
  const filteredCourses = courses.filter(c => filterProg === 'all' || courseMatchesProgram(c, filterProg));

  // A subject can be offered to several programs at once.
  const programBadges = (c) => courseProgramLabels(c)
    .map(label => `<span class="rp-badge ${label === 'General' ? 'gold' : 'green'}">${esc(label)}</span>`)
    .join(' ');

  return `
    <div class="rp-grid-2">
      <div class="rp-card">
        <div class="rp-card-head"><h3>Create New Subject</h3></div>
        <form id="regCreateCourseForm" style="display:flex; flex-direction: column; gap: 10px;">
          <div class="field-row">
            <div class="field"><label>Course Code</label><input class="rp-input" name="code" placeholder="e.g. BSCS-101" required></div>
            <div class="field"><label>Units</label><input class="rp-input" type="number" name="units" value="3" required></div>
          </div>
          <div class="field"><label>Title</label><input class="rp-input" name="title" placeholder="Introduction to Computing" required></div>
          <div class="field-row">
            <div class="field">
              <label>Day</label>
              <select class="rp-input" name="schedule_day" required>
                ${DAYS.map(d => `<option value="${d}">${d}</option>`).join('')}
              </select>
            </div>
            <div class="field-row" style="grid-template-columns: 1fr 1fr; gap: 8px;">
              <div class="field">
                <label>Start Time</label>
                <input type="time" class="rp-input" name="schedule_time_start" required>
              </div>
              <div class="field">
                <label>End Time</label>
                <input type="time" class="rp-input" name="schedule_time_end" required>
              </div>
            </div>
          </div>
          <div class="field">
            <label>Offered to <span class="rp-hint">(pick one program, several, or General for all)</span></label>
            ${programPickerHtml([], { id: 'regCreateCourseProgs' })}
          </div>
          <button type="submit" class="rp-btn rp-btn-primary" style="margin-top: 10px; justify-content: center;">Create Subject</button>
        </form>
      </div>

      <div class="rp-card" style="display:flex; flex-direction:column;">
        <div class="rp-card-head" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:16px;">
          <h3 style="margin:0;">Subject List</h3>
          <select class="rp-input" data-change="regCourseFilterProg" style="width:auto; min-width:160px; padding:6px 12px;">
            ${programOptionsHtml(filterProg, { all: true, includeGeneral: true })}
          </select>
        </div>
        
        <div class="rp-table-wrap" style="max-height: 500px; overflow-y: auto; flex:1;">
          <table class="rp-table">
            <thead><tr><th>Code</th><th>Title</th><th>Prog</th><th>Units</th><th>Schedule</th><th style="text-align:right">Action</th></tr></thead>
            <tbody>
              ${filteredCourses.length ? filteredCourses.map(c => {
                const timeStr = c.schedule_time || '';
                return `
                <tr>
                  <td><strong>${esc(c.code)}</strong></td>
                  <td>${esc(c.title)}</td>
                  <td style="white-space:normal;">${programBadges(c)}</td>
                  <td>${c.units}</td>
                  <td class="rp-hint" style="white-space:nowrap;">${esc((c.schedule_day || '') + ' ' + timeStr)}</td>
                  <td style="text-align:right; white-space:nowrap;">
                    <button class="rp-btn rp-btn-primary rp-btn-sm" data-action="regEditCourse" data-id="${c.id}">Edit</button>
                    <button class="rp-btn rp-btn-danger rp-btn-sm" data-action="regDeleteCourse" data-id="${c.id}">✕</button>
                  </td>
                </tr>
              `}).join('') : '<tr><td colspan="6" class="rp-empty">No subjects found.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

// --- MODALS & HELPERS ---
export async function regEditPresetModal(presetId) {
  const isNew = !presetId;
  let preset = { name: '', program_id: '1', year_level: '1', semester: currentSemester() };
  let currentSubjects = [];

  if (!isNew) {
    const pRes = await supa('presets', { match: { id: presetId } }).catch(() => []);
    preset = pRes[0] || preset;
    const psRes = await supa('preset_subjects', { match: { preset_id: presetId } }).catch(() => []);
    const courses = await supa('courses').catch(() => []);
    
    currentSubjects = psRes.map(ps => {
      const c = courses.find(x => String(x.id) === String(ps.course_id));
      return { psId: ps.id, ...c };
    });
  }

  const renderSubjectList = () => {
    if (!currentSubjects.length) return '<div class="rp-empty" style="padding:10px;">No subjects added to this preset yet.</div>';
    return currentSubjects.map(c => `
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #eee; padding:10px 0;">
        <div>
          <div style="font-weight:600; font-size:13px;">${esc(c.code)} — ${esc(c.title)}</div>
          <div class="rp-hint">${c.units} units</div>
        </div>
        <button type="button" class="rp-btn rp-btn-danger rp-btn-sm" onclick="window.regRemovePresetSubjectTemp('${c.psId || 'NEW'}', '${c.id}')">Remove</button>
      </div>
    `).join('');
  };

  const modalHtml = `
    <div class="rp-modal-backdrop" id="regPresetModal">
      <div class="rp-modal wide">
        <div class="rp-modal-head">
          <h3>${isNew ? 'Create Preset' : 'Edit Preset'}</h3>
          <button type="button" class="rp-btn rp-btn-ghost rp-btn-sm" onclick="document.getElementById('regPresetModal').remove()">✕</button>
        </div>
        <div class="rp-modal-body">
          <div class="rp-grid-2">
            
            <div>
              <h4 style="margin-bottom:10px; font-size:14px; color:var(--mint-800);">Preset Info</h4>
              <div id="regPresetForm" style="display:flex; flex-direction:column; gap:12px;">
                <input type="hidden" id="reg_preset_edit_id" value="${isNew ? '' : preset.id}">
                <div class="field">
                  <label>Preset Name</label>
                  <input class="rp-input" id="reg_preset_name" value="${esc(preset.name)}" placeholder="e.g. BSCS 1st Year - 1st Sem" required>
                </div>
                <div class="field">
                  <label>Program</label>
                  <select class="rp-input" id="reg_preset_prog" required>
                    ${programOptionsHtml(preset.program_id)}
                  </select>
                </div>
                <div class="field-row">
                  <div class="field">
                    <label>Year Level</label>
                    <select class="rp-input" id="reg_preset_year" required>
                      ${allYearLevels().map(y => `<option value="${y}" ${String(preset.year_level) === String(y) ? 'selected' : ''}>${esc(yearLabel(y))}</option>`).join('')}
                    </select>
                  </div>
                  <div class="field">
                    <label>Semester</label>
                    <select class="rp-input" id="reg_preset_sem" required>
                      ${SEMESTERS.map(sem => `<option value="${esc(sem)}" ${preset.semester === sem ? 'selected' : ''}>${esc(sem)}</option>`).join('')}
                    </select>
                  </div>
                </div>
                <button type="button" class="rp-btn rp-btn-primary" data-action="regSavePreset" style="margin-top:10px;">Save Preset Info</button>
              </div>
            </div>

            <div>
              <h4 style="margin-bottom:10px; font-size:14px; color:var(--mint-800);">Add Subjects</h4>
              <div style="display:flex; gap:8px;">
                <input class="rp-input" id="regPresetCodeInput" placeholder="Type Course Code (e.g. BSCS-101)">
                <button type="button" class="rp-btn rp-btn-primary" onclick="window.regAddPresetSubjectTemp('${isNew ? '' : preset.id}')">Add</button>
              </div>
              <div id="regPresetErrorMsg" style="color:var(--danger); font-size:12px; margin-top:5px; display:none;"></div>
              
              <h4 style="margin-top:20px; margin-bottom:10px; font-size:14px; color:var(--mint-800);">Subjects in Preset</h4>
              <div style="max-height: 250px; overflow-y:auto; border:1px solid #eee; border-radius:8px; padding: 0 10px;" id="regPresetSubjectListContainer">
                ${renderSubjectList()}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  `;

  window.tempRegPresetSubjects = currentSubjects;
  window.tempRegDeletedPSIds = [];

  document.getElementById('regPresetModal')?.remove();
  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

export async function regEditCourseModal(courseId) {
  const courses = await supa('courses', { match: { id: courseId } }).catch(() => []);
  const c = courses[0];
  if (!c) return toast('This subject could not be loaded.', 'error');
  
  let startTime = '';
  let endTime = '';
  if (c.schedule_time && c.schedule_time.includes('-')) {
    const parts = c.schedule_time.split('-');
    startTime = parts[0].trim();
    endTime = parts[1].trim();
  }

  const modalHtml = `
    <div class="rp-modal-backdrop" id="regEditCourseModal">
      <div class="rp-modal">
        <div class="rp-modal-head">
          <h3>Edit Subject — ${esc(c.code)}</h3>
          <button type="button" class="rp-btn rp-btn-ghost rp-btn-sm" onclick="document.getElementById('regEditCourseModal').remove()">✕</button>
        </div>
        <div class="rp-modal-body">
          <form id="regEditCourseForm">
            <input type="hidden" name="id" id="reg_edit_course_id" value="${c.id}">
            <div class="field-row">
              <div class="field"><label>Course Code</label><input class="rp-input" id="reg_edit_course_code" name="code" value="${esc(c.code)}" required></div>
              <div class="field"><label>Units</label><input class="rp-input" id="reg_edit_course_units" type="number" name="units" value="${c.units}" required></div>
            </div>
            <div class="field"><label>Title</label><input class="rp-input" id="reg_edit_course_title" name="title" value="${esc(c.title)}" required></div>
            <div class="field-row">
              <div class="field">
                <label>Day</label>
                <select class="rp-input" id="reg_edit_course_day" name="schedule_day" required>
                  ${DAYS.map(d => `<option value="${d}" ${c.schedule_day === d ? 'selected' : ''}>${d}</option>`).join('')}
                </select>
              </div>
              <div class="field-row" style="grid-template-columns: 1fr 1fr; gap: 8px;">
                <div class="field">
                  <label>Start Time</label>
                  <input type="time" class="rp-input" id="reg_edit_course_start" name="schedule_time_start" value="${startTime}" required>
                </div>
                <div class="field">
                  <label>End Time</label>
                  <input type="time" class="rp-input" id="reg_edit_course_end" name="schedule_time_end" value="${endTime}" required>
                </div>
              </div>
            </div>
            <div class="field">
              <label>Offered to <span class="rp-hint">(pick one program, several, or General for all)</span></label>
              ${programPickerHtml(getCourseProgramIds(c), { id: 'regEditCourseProgs' })}
            </div>
            <button type="button" class="rp-btn rp-btn-primary" data-action="regSaveEditedCourse" style="margin-top: 20px; width:100%;">Save Changes</button>
          </form>
        </div>
      </div>
    </div>
  `;

  document.getElementById('regEditCourseModal')?.remove();
  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

// Helpers for Preset Temp
window.regAddPresetSubjectTemp = async (presetId) => {
  const input = document.getElementById('regPresetCodeInput');
  const code = input.value.trim().toUpperCase();
  const errDiv = document.getElementById('regPresetErrorMsg');
  
  if (!code) return;
  
  const courses = await supa('courses').catch(() => []);
  const course = courses.find(c => String(c.code || '').toUpperCase() === code);
  
  if (!course) {
    errDiv.textContent = "Course code does not exist!";
    errDiv.style.display = 'block';
    return;
  }
  errDiv.style.display = 'none';
  
  if (window.tempRegPresetSubjects.some(s => String(s.id) === String(course.id))) {
    errDiv.textContent = "Subject is already in the preset.";
    errDiv.style.display = 'block';
    return;
  }

  window.tempRegPresetSubjects.push({ ...course, psId: 'NEW' });
  input.value = '';
  
  const listContainer = document.getElementById('regPresetSubjectListContainer');
  if (listContainer) {
    listContainer.innerHTML = window.tempRegPresetSubjects.map(c => `
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #eee; padding:10px 0;">
        <div>
          <div style="font-weight:600; font-size:13px;">${esc(c.code)} — ${esc(c.title)}</div>
          <div class="rp-hint">${c.units} units</div>
        </div>
        <button type="button" class="rp-btn rp-btn-danger rp-btn-sm" onclick="window.regRemovePresetSubjectTemp('${c.psId}', '${c.id}')">Remove</button>
      </div>
    `).join('');
  }
};

window.regRemovePresetSubjectTemp = (psId, courseId) => {
  if (psId !== 'NEW') {
    window.tempRegDeletedPSIds.push(psId);
  }
  window.tempRegPresetSubjects = window.tempRegPresetSubjects.filter(s => String(s.id) !== String(courseId));
  
  const listContainer = document.getElementById('regPresetSubjectListContainer');
  if (listContainer) {
    listContainer.innerHTML = window.tempRegPresetSubjects.map(c => `
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #eee; padding:10px 0;">
        <div>
          <div style="font-weight:600; font-size:13px;">${esc(c.code)} — ${esc(c.title)}</div>
          <div class="rp-hint">${c.units} units</div>
        </div>
        <button type="button" class="rp-btn rp-btn-danger rp-btn-sm" onclick="window.regRemovePresetSubjectTemp('${c.psId}', '${c.id}')">Remove</button>
      </div>
    `).join('');
  }
};

/* =========================================================================
   PREREQUISITE SUBJECTS
   -------------------------------------------------------------------------
   A prerequisite set is an ordered sequence of subjects for one program.
   Order defines what has to be taken first, so the editor lets the registrar
   drag subjects or nudge them with the arrow buttons.
   ========================================================================= */

export async function renderRegistrarPrereqs() {
  const [rows, courses] = await Promise.all([
    supa('presets').catch(() => []),
    supa('courses').catch(() => [])
  ]);

  const sets = hydratePrereqSets(rows.map(decodePrereqSet).filter(Boolean), courses);
  const filterProg = window.regPrereqFilterProg || 'all';

  const filtered = sets.filter(set =>
    filterProg === 'all' || prereqMatchesProgram(set, filterProg)
  );

  const chainText = (set) => set.courses.length
    ? set.courses.map(c => esc(c.code)).join(' <span class="chain-arrow">&rarr;</span> ')
    : '<span class="rp-hint">No subjects yet</span>';

  return `
    <div class="rp-toolbar" style="margin-bottom:20px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
      <div style="display:flex; gap:10px;">
        <select class="rp-input" data-change="regPrereqFilterProg" style="width:160px;">
          ${programOptionsHtml(filterProg, { all: true })}
        </select>
      </div>
      <button class="rp-btn rp-btn-primary" data-action="regCreatePrereq">Create New Prerequisite Set</button>
    </div>

    <div class="rp-notice info">
      <span>Subjects inside a sequence must be taken in order. A student may take the whole sequence in one semester, but no subject may be skipped.</span>
    </div>

    <div class="rp-table-wrap">
      <table class="rp-table">
        <thead><tr><th>Title</th><th>Program</th><th>Sequence</th><th style="text-align:right">Actions</th></tr></thead>
        <tbody>
          ${filtered.length ? filtered.map(set => `
            <tr>
              <td><strong>${esc(set.title)}</strong></td>
              <td style="white-space:normal;">${(set.programIds || []).length
                ? set.programIds.map(id => `<span class="rp-badge ${String(id) === '0' ? 'gold' : 'green'}">${esc(programLabel(id))}</span>`).join(' ')
                : '<span class="rp-badge grey">Unspecified</span>'}</td>
              <td>${chainText(set)}</td>
              <td style="text-align:right; white-space:nowrap;">
                <button class="rp-btn rp-btn-primary rp-btn-sm" data-action="regEditPrereq" data-id="${set.id}">Edit</button>
                <button class="rp-btn rp-btn-danger rp-btn-sm" data-action="regDeletePrereq" data-id="${set.id}">Delete</button>
              </td>
            </tr>
          `).join('') : '<tr><td colspan="4" class="rp-empty">No prerequisite subjects found.</td></tr>'}
        </tbody>
      </table>
    </div>
  `;
}

export async function regEditPrereqModal(setId) {
  const isNew = !setId;
  const courses = await supa('courses').catch(() => []);

  let set = { id: null, title: '', programId: '1', courseIds: [] };
  if (!isNew) {
    const rows = await supa('presets', { match: { id: setId } }).catch(() => []);
    const decoded = decodePrereqSet(rows[0]);
    if (decoded) set = decoded;
  }

  const byId = new Map(courses.map(c => [String(c.id), c]));
  window.tempRegPrereqSubjects = set.courseIds.map(id => byId.get(String(id))).filter(Boolean);

  const modalHtml = `
    <div class="rp-modal-backdrop" id="regPrereqModal">
      <div class="rp-modal wide">
        <div class="rp-modal-head">
          <h3>${isNew ? 'Create Prerequisite Set' : 'Edit Prerequisite Set'}</h3>
          <button type="button" class="rp-btn rp-btn-ghost rp-btn-sm" onclick="document.getElementById('regPrereqModal').remove()">✕</button>
        </div>
        <div class="rp-modal-body">
          <div class="rp-grid-2">

            <div>
              <h4 style="margin-bottom:10px; font-size:14px; color:var(--mint-800);">Sequence Info</h4>
              <div style="display:flex; flex-direction:column; gap:12px;">
                <input type="hidden" id="reg_prereq_id" value="${isNew ? '' : set.id}">
                <div class="field">
                  <label>Title</label>
                  <input class="rp-input" id="reg_prereq_title" value="${esc(set.title)}" placeholder="e.g. BSCS Programming Sequence">
                </div>
                <div class="field">
                  <label>Offered to</label>
                  ${programPickerHtml(set.programIds || [], { id: 'regPrereqPrograms' })}
                </div>
                <div class="rp-hint">The sequence is enforced for the programs ticked above (or every program when General is ticked). The student must take these subjects in the order shown on the right.</div>
              </div>
            </div>

            <div>
              <h4 style="margin-bottom:10px; font-size:14px; color:var(--mint-800);">Add Subjects</h4>
              <div style="display:flex; gap:8px;">
                <input class="rp-input" id="regPrereqCodeInput" placeholder="Type course code (e.g. BSCS-101)"
                       oninput="this.value = this.value.toUpperCase();"
                       onkeydown="if(event.key==='Enter'){ event.preventDefault(); window.regAddPrereqSubject(); }">
                <button type="button" class="rp-btn rp-btn-primary" onclick="window.regAddPrereqSubject()">Add</button>
              </div>
              <div id="regPrereqErrorMsg" style="color:var(--danger); font-size:12px; margin-top:5px; display:none;"></div>

              <h4 style="margin-top:20px; margin-bottom:6px; font-size:14px; color:var(--mint-800);">Sequence Order</h4>
              <div class="rp-hint" style="margin-bottom:10px;">Drag a subject, or use the arrow buttons, to change the order.</div>
              <div class="prereq-list" id="regPrereqList"></div>
            </div>

          </div>
        </div>
        <div class="rp-modal-foot">
          <button type="button" class="rp-btn rp-btn-ghost" onclick="document.getElementById('regPrereqModal').remove()">Cancel</button>
          <button type="button" class="rp-btn rp-btn-primary" data-action="regSavePrereq">Save Prerequisite Set</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('regPrereqModal')?.remove();
  document.body.insertAdjacentHTML('beforeend', modalHtml);
  drawPrereqList();
}

function drawPrereqList() {
  const box = document.getElementById('regPrereqList');
  if (!box) return;
  const list = window.tempRegPrereqSubjects || [];

  if (!list.length) {
    box.innerHTML = '<div class="rp-empty" style="padding:16px;">No subjects in this sequence yet.</div>';
    return;
  }

  box.innerHTML = list.map((c, i) => `
    <div class="prereq-item" draggable="true" data-index="${i}"
         ondragstart="window.regPrereqDragStart(event, ${i})"
         ondragover="event.preventDefault()"
         ondrop="window.regPrereqDrop(event, ${i})">
      <span class="prereq-step">${i + 1}</span>
      <div class="prereq-item-text">
        <div class="prereq-code">${esc(c.code)}</div>
        <div class="rp-hint">${esc(c.title)} · ${c.units} units</div>
      </div>
      <div class="prereq-item-actions">
        <button type="button" class="rp-btn rp-btn-ghost rp-btn-sm" title="Move up"
                onclick="window.regPrereqMove(${i}, -1)" ${i === 0 ? 'disabled' : ''}>&uarr;</button>
        <button type="button" class="rp-btn rp-btn-ghost rp-btn-sm" title="Move down"
                onclick="window.regPrereqMove(${i}, 1)" ${i === list.length - 1 ? 'disabled' : ''}>&darr;</button>
        <button type="button" class="rp-btn rp-btn-danger rp-btn-sm" title="Remove"
                onclick="window.regPrereqRemove(${i})">✕</button>
      </div>
    </div>
  `).join('');
}

window.regAddPrereqSubject = async () => {
  const input = document.getElementById('regPrereqCodeInput');
  const err = document.getElementById('regPrereqErrorMsg');
  if (!input || !err) return;

  const code = input.value.trim().toUpperCase();
  if (!code) return;

  const courses = await supa('courses').catch(() => []);
  const course = courses.find(c => String(c.code || '').trim().toUpperCase() === code);

  if (!course) {
    err.textContent = 'Course code does not exist.';
    err.style.display = 'block';
    return;
  }

  if (window.tempRegPrereqSubjects.some(s => String(s.id) === String(course.id))) {
    err.textContent = 'This subject is already in the sequence.';
    err.style.display = 'block';
    return;
  }

  err.style.display = 'none';
  window.tempRegPrereqSubjects.push(course);
  input.value = '';
  drawPrereqList();
};

window.regPrereqMove = (index, direction) => {
  const list = window.tempRegPrereqSubjects || [];
  const target = index + direction;
  if (target < 0 || target >= list.length) return;
  const [item] = list.splice(index, 1);
  list.splice(target, 0, item);
  drawPrereqList();
};

window.regPrereqRemove = (index) => {
  const list = window.tempRegPrereqSubjects || [];
  list.splice(index, 1);
  drawPrereqList();
};

window.regPrereqDragStart = (event, index) => {
  window.regPrereqDragIndex = index;
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(index));
  }
};

window.regPrereqDrop = (event, index) => {
  event.preventDefault();
  const from = window.regPrereqDragIndex;
  window.regPrereqDragIndex = null;
  const list = window.tempRegPrereqSubjects || [];
  if (from === null || from === undefined || from === index || from < 0 || from >= list.length) return;
  const [item] = list.splice(from, 1);
  list.splice(index, 0, item);
  drawPrereqList();
};

/* =========================================================================
   PROGRAMS
   -------------------------------------------------------------------------
   Programs created here are read through catalog.js, so they immediately
   become available to the student application form, subjects, presets,
   prerequisite sets, unit limits and the faculty portal.
   ========================================================================= */

export async function renderRegistrarPrograms() {
  const [apps, courses] = await Promise.all([
    supa('applications').catch(() => []),
    supa('courses').catch(() => [])
  ]);

  const list = getPrograms().filter(p => !p.general);

  const studentsOf = (id) => apps.filter((a) => {
    let pr = a.program || {};
    if (typeof pr === 'string') { try { pr = JSON.parse(pr); } catch (e) { pr = {}; } }
    return String(pr.preferred) === String(id);
  }).length;

  const subjectsOf = (id) => courses.filter(c => getCourseProgramIds(c).some(pid => String(pid) === String(id))).length;

  return `
    <div class="rp-toolbar" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
      <div class="rp-hint" style="max-width:560px;">Programs appear in the student application form, subject curriculum, presets, prerequisite sets, unit limits and the faculty portal. Deleting one leaves its subjects and presets as <strong>Unspecified</strong>, which are offered to every program.</div>
      <button class="rp-btn rp-btn-primary" data-action="regCreateProgram">＋ New Program</button>
    </div>

    <div class="rp-table-wrap">
      <table class="rp-table">
        <thead><tr><th>Code</th><th>Program Name</th><th>Year Levels</th><th>Applicants</th><th>Subjects</th><th style="text-align:right">Actions</th></tr></thead>
        <tbody>
          ${list.length ? list.map(p => `
            <tr>
              <td><strong>${esc(p.code)}</strong></td>
              <td>${esc(p.name)}</td>
              <td>${esc(p.years || 4)} year level(s)</td>
              <td>${studentsOf(p.id)}</td>
              <td>${subjectsOf(p.id)}</td>
              <td style="text-align:right; white-space:nowrap;">
                <button class="rp-btn rp-btn-primary rp-btn-sm" data-action="regEditProgram" data-id="${p.id}">Edit</button>
                ${p.rowId ? `<button class="rp-btn rp-btn-danger rp-btn-sm" data-action="regDeleteProgram" data-id="${p.id}">Delete</button>` : ''}
              </td>
            </tr>
          `).join('') : '<tr><td colspan="5" class="rp-empty">No programs found.</td></tr>'}
        </tbody>
      </table>
    </div>
  `;
}

export async function regProgramModal(programId) {
  const existing = programId ? programById(programId) : null;

  const modalHtml = `
    <div class="rp-modal-backdrop" id="regProgramModal">
      <div class="rp-modal">
        <div class="rp-modal-head">
          <h3>${existing ? 'Edit Program' : 'Create New Program'}</h3>
          <button type="button" class="rp-btn rp-btn-ghost rp-btn-sm" onclick="document.getElementById('regProgramModal').remove()">✕</button>
        </div>
        <div class="rp-modal-body">
          <form id="regProgramForm" style="display:flex; flex-direction:column; gap:12px;">
            <input type="hidden" name="program_id" value="${existing ? existing.id : ''}">
            <div class="field">
              <label>Program Code</label>
              <input class="rp-input" name="code" value="${esc(existing ? existing.code : '')}" placeholder="e.g. BSIT" required>
            </div>
            <div class="field">
              <label>Program Name</label>
              <input class="rp-input" name="name" value="${esc(existing ? existing.name : '')}" placeholder="e.g. BS Information Technology" required>
            </div>
            <div class="field">
              <label>Number of Year Levels</label>
              <select class="rp-input" name="years" required>
                ${Array.from({ length: MAX_PROGRAM_YEARS }, (_, i) => i + 1).map(n => `<option value="${n}" ${String(existing ? existing.years : 4) === String(n) ? 'selected' : ''}>${n} year${n > 1 ? 's' : ''}</option>`).join('')}
              </select>
            </div>
            <p class="rp-hint">The code is what appears in student records and reports. The full name is used in selection lists. The year level count limits which years this program offers everywhere in the site.</p>
            <button type="submit" class="rp-btn rp-btn-primary" style="margin-top:6px;">${existing ? 'Save Changes' : 'Create Program'}</button>
          </form>
        </div>
      </div>
    </div>
  `;

  document.getElementById('regProgramModal')?.remove();
  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

/* =========================================================================
   UNIT LIMITS
   -------------------------------------------------------------------------
   Maximum units per program, year level and semester. The faculty portal
   reads these through catalog.js and blocks a subject load that is over the
   limit before the subjects can be confirmed.
   ========================================================================= */

/* =========================================================================
   ACADEMIC TERM
   -------------------------------------------------------------------------
   One current semester and school year for the whole site. Presets carry a
   semester, so the term set here decides which presets the Faculty may offer.
   ========================================================================= */

export async function renderRegistrarAcademicTerm() {
  const term = getAcademicTerm();
  const presets = (await supa('presets').catch(() => [])).filter(p => !isMetaRow(p));
  const termPresets = presets.filter(p => String(p.semester) === String(term.semester));
  const otherPresets = presets.length - termPresets.length;

  return `
    <div class="rp-grid-2">
      <div class="rp-card" style="background:var(--mint-50);">
        <div class="rp-card-head"><h3>Current Academic Term</h3></div>
        <div style="display:flex; gap:26px; flex-wrap:wrap; margin:16px 0;">
          <div>
            <div class="rp-hint">Semester</div>
            <div style="font-size:22px; font-weight:800; color:var(--mint-800);">${esc(term.semester)}</div>
          </div>
          <div>
            <div class="rp-hint">School Year</div>
            <div style="font-size:22px; font-weight:800; color:var(--mint-800);">${esc(term.schoolYear)}</div>
          </div>
        </div>
        <p class="rp-hint">Students see this term on their registration form, and the Faculty can only assign presets that belong to it.</p>
      </div>

      <div class="rp-card">
        <div class="rp-card-head"><h3>Set the Current Term</h3></div>
        <form id="regAcademicTermForm" style="display:flex; flex-direction:column; gap:12px;">
          <div class="field">
            <label>Semester</label>
            <select class="rp-input" name="semester" required>
              ${SEMESTERS.map(s => `<option value="${esc(s)}" ${term.semester === s ? 'selected' : ''}>${esc(s)}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label>School Year</label>
            <input class="rp-input" name="school_year" value="${esc(term.schoolYear)}" placeholder="e.g. 2026-2027" required>
          </div>
          <button type="submit" class="rp-btn rp-btn-primary" style="margin-top:6px;">Save Current Term</button>
        </form>
        <p class="rp-hint" style="margin-top:12px;">Changing the semester immediately changes which presets the Faculty can load for students.</p>
      </div>
    </div>

    <div class="rp-card" style="margin-top:16px;">
      <div class="rp-card-head">
        <h3>${esc(term.semester)} Presets</h3>
        <span class="rp-badge green">${termPresets.length} preset(s)</span>
      </div>
      ${termPresets.length ? `
        <div class="rp-table-wrap">
          <table class="rp-table" style="min-width:0;">
            <thead><tr><th>Preset Name</th><th>Program</th><th>Year</th></tr></thead>
            <tbody>
              ${termPresets.map(p => `
                <tr>
                  <td><strong>${esc(p.name)}</strong></td>
                  <td>${esc(programLabel(p.program_id))}</td>
                  <td>Year ${esc(p.year_level)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        ${otherPresets ? `<p class="rp-hint" style="margin-top:10px;">${otherPresets} preset(s) belong to another semester and are not offered while this term is active.</p>` : ''}
      ` : `
        <div class="rp-notice info">
          <span>No presets are registered for ${esc(term.semester)} yet. Create them in <strong>Preset Subjects</strong>.</span>
        </div>
      `}
    </div>
  `;
}
