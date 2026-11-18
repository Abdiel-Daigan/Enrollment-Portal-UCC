import { esc, toast } from './utils.js';
import { supa } from './api.js';
import { decodePrereqSet, hydratePrereqSets, encodePrereqName, isPrereqRow } from './prereqs.js';
import { reportCard } from './report.js';

const PROGRAMS = { '0': 'General', '1': 'BEEd', '2': 'BSEd', '8': 'BSCS' };
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

  const presets = presetRows.filter(p => !isPrereqRow(p));
  const prereqSets = presetRows.map(decodePrereqSet).filter(Boolean);
  const submitted = apps.filter(a => a.submitted && !a.returned);
  const enrolled = apps.filter(a => a.status === 'Approved').length;
  const docsPending = submitted.filter(a => !docsComplete(a)).length;
  const verified = submitted.length - docsPending;
  const collected = logRows.reduce((sum, l) => sum + Number(l.amount || 0), 0);

  const programRows = Object.entries(PROGRAMS).filter(([id]) => id !== '0').map(([id, name]) => {
    const ofProgram = apps.filter(a => {
      let pr = a.program || {};
      if (typeof pr === 'string') { try { pr = JSON.parse(pr); } catch (e) { pr = {}; } }
      return String(pr.preferred) === String(id);
    });
    return [
      name,
      ofProgram.length,
      ofProgram.filter(a => a.submitted && !a.returned).length,
      ofProgram.filter(a => a.status === 'Approved').length
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
      PROGRAMS[pr.preferred] || 'Not set',
      pr.year_level ? 'Year ' + pr.year_level : '-',
      app.status === 'Approved' ? 'Enrolled' : (app.submitted ? 'Applicant' : 'In Progress'),
      app.doc_type ? (docsComplete(app) ? 'Complete' : 'Incomplete') : 'No checklist',
      load.length,
      Number(app.amount_paid || 0).toFixed(2)
    ];
  });

  return `
    <div class="rp-grid-4">
      <div class="rp-card rp-stat"><div class="ic">ST</div><div><div class="val">${students.length}</div><div class="lbl">Total Students</div></div></div>
      <div class="rp-card rp-stat gold"><div class="ic">PA</div><div><div class="val">${submitted.length}</div><div class="lbl">Pending Applicants</div></div></div>
      <div class="rp-card rp-stat"><div class="ic">EN</div><div><div class="val">${enrolled}</div><div class="lbl">Officially Enrolled</div></div></div>
      <div class="rp-card rp-stat gold"><div class="ic">DC</div><div><div class="val">${docsPending}</div><div class="lbl">Documents Awaiting Verification</div></div></div>
    </div>

    <div class="rp-grid-4">
      <div class="rp-card rp-stat"><div class="ic">SB</div><div><div class="val">${courses.length}</div><div class="lbl">Total Subjects</div></div></div>
      <div class="rp-card rp-stat gold"><div class="ic">PR</div><div><div class="val">${presets.length}</div><div class="lbl">Subject Presets</div></div></div>
      <div class="rp-card rp-stat"><div class="ic">PQ</div><div><div class="val">${prereqSets.length}</div><div class="lbl">Prerequisite Sequences</div></div></div>
      <div class="rp-card rp-stat gold"><div class="ic">VR</div><div><div class="val">${verified}</div><div class="lbl">Verified Applications</div></div></div>
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

// A document checklist is complete when every required document is verified.
export function docsComplete(app) {
  const docs = DOC_TYPES[app && app.doc_type];
  if (!docs) return false;
  const status = (app && app.doc_status) || {};
  return docs.filter(d => d.required).every(d => status[d.id] === 'Complete');
}

// --- STUDENT MANAGEMENT ---
export async function renderRegistrarStudents() {
  const apps = await supa('applications');
  const users = await supa('users');
  
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
    
    let statusMatch = true;
    if (filterStatus === 'enrolled') statusMatch = app.status === 'Approved';
    else if (filterStatus === 'applicant') statusMatch = !!app.submitted && app.status !== 'Approved';

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
          <option value="">All Programs</option>
          <option value="1" ${filterProg === '1' ? 'selected' : ''}>BEEd</option>
          <option value="2" ${filterProg === '2' ? 'selected' : ''}>BSEd</option>
          <option value="8" ${filterProg === '8' ? 'selected' : ''}>BSCS</option>
        </select>
      </div>
      <div style="width: 140px;">
        <select class="rp-input" data-change="regFilterYear">
          <option value="">All Years</option>
          <option value="1" ${filterYear === '1' ? 'selected' : ''}>1st Year</option>
          <option value="2" ${filterYear === '2' ? 'selected' : ''}>2nd Year</option>
          <option value="3" ${filterYear === '3' ? 'selected' : ''}>3rd Year</option>
          <option value="4" ${filterYear === '4' ? 'selected' : ''}>4th Year</option>
        </select>
      </div>
      <div style="width: 160px;">
        <select class="rp-input" data-change="regFilterStatus">
          <option value="">All Statuses</option>
          <option value="applicant" ${filterStatus === 'applicant' ? 'selected' : ''}>Applicant (Unenrolled)</option>
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
            const progName = PROGRAMS[pr.preferred] || 'Unknown';
            
            return `
              <tr>
                <td><strong>${esc(u.name)}</strong></td>
                <td>${esc(u.student_id || '—')}</td>
                <td><span class="rp-badge green">${progName}</span></td>
                <td>
                  <span class="rp-badge ${app.status === 'Approved' ? 'green' : 'gold'}">
                    ${app.status === 'Approved' ? 'Enrolled' : (app.submitted ? 'Applicant' : 'In Progress')}
                  </span>
                </td>
                <td style="text-align:right">
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

const peso = (n) => Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 });

export async function regManageStudentModal(userId, tab) {
  window.regModalTab = tab || 'documents';
  const activeTab = window.regModalTab;

  const users = await supa('users', { match: { id: userId } });
  const u = users[0] || {};
  const apps = await supa('applications', { match: { user_id: userId } });
  const app = apps[0] || {};
  const courses = await supa('courses').catch(() => []);
  const subjects = await supa('student_subjects', { match: { user_id: userId } }).catch(() => []);
  const logs = await supa('payment_logs', { match: { user_id: userId } }).catch(() => []);

  let pr = app.program || {};
  if (typeof pr === 'string') { try { pr = JSON.parse(pr); } catch (e) { pr = {}; } }
  const personal = app.personal || {};
  const education = app.education || {};
  const courseById = (id) => courses.find(c => String(c.id) === String(id)) || {};

  const docs = DOC_TYPES[app.doc_type] || [];
  const uploaded = app.documents || {};
  const docStatus = app.doc_status || {};

  // ---------- Documents pane ----------
  const docRows = docs.length ? docs.map(d => {
    const isUploaded = uploaded[d.id];
    const status = docStatus[d.id] || 'Missing';

    return `
      <tr>
        <td>
          <strong>${esc(d.name)}</strong><br>
          ${d.required ? '<span class="rp-badge red" style="margin-top:4px;">Required</span>' : '<span class="rp-badge grey" style="margin-top:4px;">Follow-up</span>'}
        </td>
        <td>
          ${isUploaded
            ? `<button class="rp-btn rp-btn-ghost rp-btn-sm" onclick="window.viewDocument('${uploaded[d.id]}')">View File</button>`
            : `<span class="rp-badge gold">Not Uploaded</span>`}
        </td>
        <td>
          <select class="rp-input" style="padding:4px; font-size:12px; width:120px;" data-change="regDocStatus" data-student="${userId}" data-doc="${d.id}">
            <option value="Missing" ${status === 'Missing' ? 'selected' : ''}>Missing</option>
            <option value="Complete" ${status === 'Complete' ? 'selected' : ''}>Complete</option>
          </select>
        </td>
      </tr>
    `;
  }).join('') : '<tr><td colspan="3" class="rp-empty">No document checklist recorded for this application yet.</td></tr>';

  const documentsPane = `
    <div class="rp-table-wrap">
      <table class="rp-table">
        <thead><tr><th>Document Name</th><th>File</th><th>Registrar Status</th></tr></thead>
        <tbody>${docRows}</tbody>
      </table>
    </div>

    <div style="margin-top: 24px; border-top: 1px solid #eee; padding-top: 20px;">
      <h4 style="margin-bottom: 10px; font-size:14px;">Return Application?</h4>
      <p class="rp-hint" style="margin-bottom: 10px;">If a document is invalid or missing, you can return the application to the student with a reason.</p>
      <form id="regReturnForm" style="display:flex; gap:10px;">
        <input type="hidden" name="user_id" value="${userId}">
        <input class="rp-input" name="feedback" placeholder="Reason for returning (e.g., Blurry PSA image)" required>
        <button type="submit" class="rp-btn rp-btn-danger">Return Application</button>
      </form>
    </div>
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

  const subjectsPane = `
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
  `;

  // ---------- Student record pane ----------
  const kv = (label, value) => `
    <div style="display:flex; justify-content:space-between; gap:16px; padding:7px 0; border-bottom:1px solid #eef7f3;">
      <span class="rp-hint">${esc(label)}</span>
      <strong style="font-size:12.8px; text-align:right;">${esc(value === null || value === undefined || value === '' ? '—' : value)}</strong>
    </div>
  `;

  const educationValue = (block) => block
    ? `${block.school || 'School not recorded'} ${block.year ? '(' + block.year + ')' : ''}`.trim()
    : '';

  const docStatusRows = docs.length ? docs.map(d => {
    const status = docStatus[d.id] || 'Missing';
    return `<tr><td>${esc(d.name)}</td><td style="text-align:right"><span class="rp-badge ${status === 'Complete' ? 'green' : 'red'}">${esc(status)}</span></td></tr>`;
  }).join('') : '<tr><td colspan="2" class="rp-empty">No documents on file.</td></tr>';

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
    <div class="rp-grid-2">
      <div class="rp-card">
        <div class="rp-card-head"><h3>Student Information</h3></div>
        ${kv('Full Name', u.name)}
        ${kv('Student ID', u.student_id)}
        ${kv('Email', u.email)}
        ${kv('Contact Number', personal.phone)}
        ${kv('Address', personal.address)}
        ${kv('Role', u.role)}
      </div>

      <div class="rp-card">
        <div class="rp-card-head"><h3>Enrollment</h3></div>
        ${kv('Program', PROGRAMS[pr.preferred] || 'Not set')}
        ${kv('Year Level', pr.year_level ? 'Year ' + pr.year_level : '')}
        ${kv('Status', app.status || (app.submitted ? 'Pending' : 'In Progress'))}
        ${kv('Regularity', app.is_regular === false ? 'Irregular' : 'Regular')}
        ${kv('Application Type', app.doc_type)}
        ${kv('Submitted', app.submitted ? 'Yes' : 'No')}
        ${kv('Returned', app.returned ? 'Yes — ' + (app.registrar_feedback || 'no feedback given') : 'No')}
        ${kv('Reference No.', app.reference)}
      </div>
    </div>

    <div class="rp-card" style="margin-top:16px;">
      <div class="rp-card-head"><h3>Educational Background</h3></div>
      ${kv('Elementary', educationValue(education.elem))}
      ${kv('Junior High School', educationValue(education.jhs))}
      ${kv('Senior High School', educationValue(education.shs))}
    </div>

    <div class="rp-card" style="margin-top:16px;">
      <div class="rp-card-head">
        <h3>Documents</h3>
        <span class="rp-hint">${docs.filter(d => (docStatus[d.id] || 'Missing') === 'Complete').length}/${docs.length} complete</span>
      </div>
      <div class="rp-table-wrap">
        <table class="rp-table">
          <thead><tr><th>Document</th><th style="text-align:right">Status</th></tr></thead>
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
            <button type="button" class="rp-tab ${activeTab === 'subjects' ? 'active' : ''}" data-tab="subjects" onclick="window.regStudentModalTab('subjects')">Subjects Taken</button>
            <button type="button" class="rp-tab ${activeTab === 'record' ? 'active' : ''}" data-tab="record" onclick="window.regStudentModalTab('record')">Student Record</button>
          </div>

          <div class="rp-pane ${activeTab === 'documents' ? 'active' : ''}" data-pane="documents">${documentsPane}</div>
          <div class="rp-pane ${activeTab === 'subjects' ? 'active' : ''}" data-pane="subjects">${subjectsPane}</div>
          <div class="rp-pane ${activeTab === 'record' ? 'active' : ''}" data-pane="record">${recordPane}</div>
        </div>
        <div class="rp-modal-foot">
          <button type="button" class="rp-btn rp-btn-primary" onclick="document.getElementById('regStudentModal').remove()">Done</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('regStudentModal')?.remove();
  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

window.regStudentModalTab = (tab) => {
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
  if (!confirm('Remove this subject record from the student?')) return;
  try {
    await supa('student_subjects', { method: 'DELETE', match: { id: Number(rowId) } });
    toast('Subject record removed.');
    await regManageStudentModal(userId, window.regModalTab || 'subjects');
  } catch (e) {
    console.error('Delete subject failed:', e);
    toast('Could not remove the subject record.', 'error');
  }
};

window.viewDocument = (url) => {
  window.open(url, '_blank');
};

// --- REGISTRAR PRESETS ---
export async function renderRegistrarPresets() {
  // Rows that hold prerequisite sequences live in the same table and are hidden here.
  const presets = (await supa('presets')).filter(p => !isPrereqRow(p));
  const presetSubs = await supa('preset_subjects');
  const filterProg = window.regPresetFilterProg || 'all';
  const filterYear = window.regPresetFilterYear || 'all';

  const filteredPresets = presets.filter(p => {
    const progMatch = filterProg === 'all' || String(p.program_id) === String(filterProg);
    const yearMatch = filterYear === 'all' || String(p.year_level) === String(filterYear);
    return progMatch && yearMatch;
  });

  return `
    <div class="rp-toolbar" style="margin-bottom:20px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
      <div style="display:flex; gap:10px;">
        <select class="rp-input" data-change="regPresetFilterProg" style="width:160px;">
          <option value="all">All Programs</option>
          <option value="1" ${filterProg === '1' ? 'selected' : ''}>BEEd</option>
          <option value="2" ${filterProg === '2' ? 'selected' : ''}>BSEd</option>
          <option value="8" ${filterProg === '8' ? 'selected' : ''}>BSCS</option>
        </select>
        <select class="rp-input" data-change="regPresetFilterYear" style="width:140px;">
          <option value="all">All Years</option>
          <option value="1" ${filterYear === '1' ? 'selected' : ''}>1st Year</option>
          <option value="2" ${filterYear === '2' ? 'selected' : ''}>2nd Year</option>
          <option value="3" ${filterYear === '3' ? 'selected' : ''}>3rd Year</option>
          <option value="4" ${filterYear === '4' ? 'selected' : ''}>4th Year</option>
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
            const pName = PROGRAMS[p.program_id] || 'Unknown';
            return `
              <tr>
                <td><strong>${esc(p.name)}</strong></td>
                <td><span class="rp-badge ${p.program_id === '0' ? 'gold' : 'green'}">${pName}</span></td>
                <td>Year ${p.year_level}</td>
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
  const courses = await supa('courses');
  const filterProg = window.regCourseFilterProg || 'all';
  const filteredCourses = courses.filter(c => filterProg === 'all' || String(c.program_id) === String(filterProg));

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
            <label>Program</label>
            <select class="rp-input" name="program_id" required>
              <option value="0">General (All Programs)</option>
              <option value="1">BEEd (Elementary Education)</option>
              <option value="2">BSEd (Secondary Education)</option>
              <option value="8">BSCS (Computer Science)</option>
            </select>
          </div>
          <button type="submit" class="rp-btn rp-btn-primary" style="margin-top: 10px; justify-content: center;">Create Subject</button>
        </form>
      </div>

      <div class="rp-card" style="display:flex; flex-direction:column;">
        <div class="rp-card-head" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:16px;">
          <h3 style="margin:0;">Subject List</h3>
          <select class="rp-input" data-change="regCourseFilterProg" style="width:auto; min-width:160px; padding:6px 12px;">
            <option value="all">All Programs</option>
            <option value="0" ${filterProg === '0' ? 'selected' : ''}>General Subjects</option>
            <option value="1" ${filterProg === '1' ? 'selected' : ''}>BEEd</option>
            <option value="2" ${filterProg === '2' ? 'selected' : ''}>BSEd</option>
            <option value="8" ${filterProg === '8' ? 'selected' : ''}>BSCS</option>
          </select>
        </div>
        
        <div class="rp-table-wrap" style="max-height: 500px; overflow-y: auto; flex:1;">
          <table class="rp-table">
            <thead><tr><th>Code</th><th>Title</th><th>Prog</th><th>Units</th><th>Schedule</th><th style="text-align:right">Action</th></tr></thead>
            <tbody>
              ${filteredCourses.length ? filteredCourses.map(c => {
                const pName = PROGRAMS[c.program_id] || 'Unknown';
                const timeStr = c.schedule_time || '';
                return `
                <tr>
                  <td><strong>${esc(c.code)}</strong></td>
                  <td>${esc(c.title)}</td>
                  <td><span class="rp-badge ${c.program_id === '0' ? 'gold' : 'green'}">${pName}</span></td>
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
  let preset = { name: '', program_id: '1', year_level: '1', semester: '1st Semester' };
  let currentSubjects = [];

  if (!isNew) {
    const pRes = await supa('presets', { match: { id: presetId } });
    preset = pRes[0];
    const psRes = await supa('preset_subjects', { match: { preset_id: presetId } });
    const courses = await supa('courses');
    
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
                    <option value="1" ${preset.program_id === '1' ? 'selected' : ''}>BEEd</option>
                    <option value="2" ${preset.program_id === '2' ? 'selected' : ''}>BSEd</option>
                    <option value="8" ${preset.program_id === '8' ? 'selected' : ''}>BSCS</option>
                  </select>
                </div>
                <div class="field-row">
                  <div class="field">
                    <label>Year Level</label>
                    <select class="rp-input" id="reg_preset_year" required>
                      <option value="1" ${preset.year_level === '1' ? 'selected' : ''}>1st Year</option>
                      <option value="2" ${preset.year_level === '2' ? 'selected' : ''}>2nd Year</option>
                      <option value="3" ${preset.year_level === '3' ? 'selected' : ''}>3rd Year</option>
                      <option value="4" ${preset.year_level === '4' ? 'selected' : ''}>4th Year</option>
                    </select>
                  </div>
                  <div class="field">
                    <label>Semester</label>
                    <select class="rp-input" id="reg_preset_sem" required>
                      <option value="1st Semester" ${preset.semester === '1st Semester' ? 'selected' : ''}>1st Semester</option>
                      <option value="2nd Semester" ${preset.semester === '2nd Semester' ? 'selected' : ''}>2nd Semester</option>
                      <option value="Summer" ${preset.semester === 'Summer' ? 'selected' : ''}>Summer</option>
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
  window.tempRegPresetId = isNew ? null : preset.id;
  window.tempRegDeletedPSIds = [];

  document.getElementById('regPresetModal')?.remove();
  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

export async function regEditCourseModal(courseId) {
  const courses = await supa('courses', { match: { id: courseId } });
  const c = courses[0];
  
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
              <label>Program</label>
              <select class="rp-input" id="reg_edit_course_prog" name="program_id" required>
                <option value="0" ${c.program_id === '0' ? 'selected' : ''}>General (All Programs)</option>
                <option value="1" ${c.program_id === '1' ? 'selected' : ''}>BEEd (Elementary Education)</option>
                <option value="2" ${c.program_id === '2' ? 'selected' : ''}>BSEd (Secondary Education)</option>
                <option value="8" ${c.program_id === '8' ? 'selected' : ''}>BSCS (Computer Science)</option>
              </select>
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
  
  const courses = await supa('courses');
  const course = courses.find(c => c.code.toUpperCase() === code);
  
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
   A prerequisite set is an ordered sequence of subjects for one program,
   year level and semester. Order defines what has to be taken first, so the
   editor lets the registrar drag subjects or nudge them with the arrow
   buttons.
   ========================================================================= */

export async function renderRegistrarPrereqs() {
  const [rows, courses] = await Promise.all([
    supa('presets').catch(() => []),
    supa('courses').catch(() => [])
  ]);

  const sets = hydratePrereqSets(rows.map(decodePrereqSet).filter(Boolean), courses);
  const filterProg = window.regPrereqFilterProg || 'all';
  const filterYear = window.regPrereqFilterYear || 'all';

  const filtered = sets.filter(set => {
    const progMatch = filterProg === 'all' || String(set.programId) === String(filterProg);
    const yearMatch = filterYear === 'all' || String(set.yearLevel) === String(filterYear);
    return progMatch && yearMatch;
  });

  const chainText = (set) => set.courses.length
    ? set.courses.map(c => esc(c.code)).join(' <span class="chain-arrow">&rarr;</span> ')
    : '<span class="rp-hint">No subjects yet</span>';

  return `
    <div class="rp-toolbar" style="margin-bottom:20px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
      <div style="display:flex; gap:10px;">
        <select class="rp-input" data-change="regPrereqFilterProg" style="width:160px;">
          <option value="all">All Programs</option>
          <option value="1" ${filterProg === '1' ? 'selected' : ''}>BEEd</option>
          <option value="2" ${filterProg === '2' ? 'selected' : ''}>BSEd</option>
          <option value="8" ${filterProg === '8' ? 'selected' : ''}>BSCS</option>
        </select>
        <select class="rp-input" data-change="regPrereqFilterYear" style="width:140px;">
          <option value="all">All Years</option>
          <option value="1" ${filterYear === '1' ? 'selected' : ''}>1st Year</option>
          <option value="2" ${filterYear === '2' ? 'selected' : ''}>2nd Year</option>
          <option value="3" ${filterYear === '3' ? 'selected' : ''}>3rd Year</option>
          <option value="4" ${filterYear === '4' ? 'selected' : ''}>4th Year</option>
        </select>
      </div>
      <button class="rp-btn rp-btn-primary" data-action="regCreatePrereq">Create New Prerequisite Set</button>
    </div>

    <div class="rp-notice info">
      <span>Subjects inside a sequence must be taken in order. A student may take the whole sequence in one semester, but no subject may be skipped.</span>
    </div>

    <div class="rp-table-wrap">
      <table class="rp-table">
        <thead><tr><th>Title</th><th>Program</th><th>Year</th><th>Sem</th><th>Sequence</th><th style="text-align:right">Actions</th></tr></thead>
        <tbody>
          ${filtered.length ? filtered.map(set => `
            <tr>
              <td><strong>${esc(set.title)}</strong></td>
              <td><span class="rp-badge green">${PROGRAMS[set.programId] || 'Unknown'}</span></td>
              <td>Year ${esc(set.yearLevel)}</td>
              <td>${esc(set.semester)}</td>
              <td>${chainText(set)}</td>
              <td style="text-align:right; white-space:nowrap;">
                <button class="rp-btn rp-btn-primary rp-btn-sm" data-action="regEditPrereq" data-id="${set.id}">Edit</button>
                <button class="rp-btn rp-btn-danger rp-btn-sm" data-action="regDeletePrereq" data-id="${set.id}">Delete</button>
              </td>
            </tr>
          `).join('') : '<tr><td colspan="6" class="rp-empty">No prerequisite subjects found.</td></tr>'}
        </tbody>
      </table>
    </div>
  `;
}

export async function regEditPrereqModal(setId) {
  const isNew = !setId;
  const courses = await supa('courses').catch(() => []);

  let set = { id: null, title: '', programId: '1', yearLevel: '1', semester: '1st Semester', courseIds: [] };
  if (!isNew) {
    const rows = await supa('presets', { match: { id: setId } });
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
                  <label>Program</label>
                  <select class="rp-input" id="reg_prereq_prog">
                    <option value="1" ${String(set.programId) === '1' ? 'selected' : ''}>BEEd</option>
                    <option value="2" ${String(set.programId) === '2' ? 'selected' : ''}>BSEd</option>
                    <option value="8" ${String(set.programId) === '8' ? 'selected' : ''}>BSCS</option>
                  </select>
                </div>
                <div class="field-row">
                  <div class="field">
                    <label>Year Level</label>
                    <select class="rp-input" id="reg_prereq_year">
                      <option value="1" ${String(set.yearLevel) === '1' ? 'selected' : ''}>1st Year</option>
                      <option value="2" ${String(set.yearLevel) === '2' ? 'selected' : ''}>2nd Year</option>
                      <option value="3" ${String(set.yearLevel) === '3' ? 'selected' : ''}>3rd Year</option>
                      <option value="4" ${String(set.yearLevel) === '4' ? 'selected' : ''}>4th Year</option>
                    </select>
                  </div>
                  <div class="field">
                    <label>Semester</label>
                    <select class="rp-input" id="reg_prereq_sem">
                      <option value="1st Semester" ${set.semester === '1st Semester' ? 'selected' : ''}>1st Semester</option>
                      <option value="2nd Semester" ${set.semester === '2nd Semester' ? 'selected' : ''}>2nd Semester</option>
                      <option value="Summer" ${set.semester === 'Summer' ? 'selected' : ''}>Summer</option>
                    </select>
                  </div>
                </div>
                <div class="rp-hint">The student must take these subjects in the order shown on the right.</div>
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
