import { esc, toast } from './utils.js';
import { supa } from './api.js';

const PROGRAMS = { '0': 'General', '1': 'BEEd', '2': 'BSEd', '8': 'BSCS' };
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// --- REGISTRAR DASHBOARD ---
export async function renderRegistrarDashboard() {
  const students = await supa('users', { match: { role: 'student' } });
  const courses = await supa('courses');
  const presets = await supa('presets');
  const apps = await supa('applications');
  const submitted = apps.filter(a => a.submitted).length;

  return `
    <div class="rp-grid-4">
      <div class="rp-card rp-stat"><div class="ic">👥</div><div><div class="val">${students.length}</div><div class="lbl">Total Students</div></div></div>
      <div class="rp-card rp-stat gold"><div class="ic">📝</div><div><div class="val">${submitted}</div><div class="lbl">Applicants</div></div></div>
      <div class="rp-card rp-stat"><div class="ic">📚</div><div><div class="val">${courses.length}</div><div class="lbl">Total Subjects</div></div></div>
      <div class="rp-card rp-stat gold"><div class="ic">🧩</div><div><div class="val">${presets.length}</div><div class="lbl">Total Presets</div></div></div>
    </div>
    <div class="rp-card">
      <h3>Registrar Overview</h3>
      <p class="rp-hint" style="margin-top:10px;">Manage student documents, create subjects, and organize course bundles for Faculty use.</p>
    </div>
  `;
}

// --- NEW: REGISTRAR STUDENT MANAGEMENT ---
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

export async function regManageStudentModal(userId) {
  const users = await supa('users', { match: { id: userId } });
  const u = users[0];
  const apps = await supa('applications', { match: { user_id: userId } });
  const app = apps[0] || {};
  
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

  const docs = DOC_TYPES[app.doc_type] || [];
  const uploaded = app.documents || {};
  const docStatus = app.doc_status || {}; // Tracks if registrar verified them

  const docRows = docs.map(d => {
    const isUploaded = uploaded[d.id];
    const status = docStatus[d.id] || 'Missing';
    return `
      <tr>
        <td><strong>${esc(d.name)}</strong></td>
        <td>${d.required ? '<span class="rp-badge red">Required</span>' : '<span class="rp-badge grey">Follow-up</span>'}</td>
        <td>
          ${isUploaded 
            ? `<span class="rp-badge green">Submitted (${esc(uploaded[d.id])})</span>` 
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
  }).join('');

  const modalHtml = `
    <div class="rp-modal-backdrop" id="regStudentModal">
      <div class="rp-modal wide">
        <div class="rp-modal-head">
          <h3>Manage Documents — ${esc(u.name)}</h3>
          <button type="button" class="rp-btn rp-btn-ghost rp-btn-sm" onclick="document.getElementById('regStudentModal').remove()">✕</button>
        </div>
        <div class="rp-modal-body">
          <div class="rp-notice info" style="margin-bottom:20px;">
            <span>ℹ️</span>
            <span>Verify the uploaded documents below. Mark them as "Complete" once verified. The student will not appear in the Faculty portal until all <strong>Required</strong> documents are marked Complete.</span>
          </div>
          
          <div class="rp-table-wrap">
            <table class="rp-table">
              <thead><tr><th>Document Name</th><th>Requirement</th><th>Uploaded File</th><th>Registrar Status</th></tr></thead>
              <tbody>${docRows}</tbody>
            </table>
          </div>
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

// --- REGISTRAR PRESETS ---
export async function renderRegistrarPresets() {
  const presets = await supa('presets');
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
        <div class="rp-card-head"><h3>➕ Create New Subject</h3></div>
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
          <h3 style="margin:0;">📚 Subject List</h3>
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

// --- PRESET MODALS & HELPERS ---
export async function regEditPresetModal(presetId) {
  // Keep existing preset modal logic
}

export async function regEditCourseModal(courseId) {
  // Keep existing course modal logic
}

// Helpers for Preset Temp
window.regAddPresetSubjectTemp = async (presetId) => {
  // Keep existing logic
};

window.regRemovePresetSubjectTemp = (psId, courseId) => {
  // Keep existing logic
};
