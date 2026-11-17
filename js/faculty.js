import { esc, toast } from './utils.js';
import { supa } from './api.js';

const PROGRAMS = {
  '0': 'General',
  '1': 'BEEd',
  '2': 'BSEd',
  '8': 'BSCS'
};

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export async function renderFacultyDashboard() {
  const students = await supa('users', { match: { role: 'student' } });
  const apps = await supa('applications');
  const courses = await supa('courses');
  
  const submitted = apps.filter(a => a.submitted && !a.returned).length;

  return `
    <div class="rp-grid-4">
      <div class="rp-card rp-stat"><div class="ic">👥</div><div><div class="val">${students.length}</div><div class="lbl">Total Students</div></div></div>
      <div class="rp-card rp-stat gold"><div class="ic">✅</div><div><div class="val">${submitted}</div><div class="lbl">Ready for Subjects</div></div></div>
      <div class="rp-card rp-stat"><div class="ic">📚</div><div><div class="val">${courses.length}</div><div class="lbl">Total Subjects</div></div></div>
    </div>
    <div class="rp-card">
      <h3>College Department</h3>
      <p class="rp-hint" style="margin-top:10px;">Go to <strong>Check Students</strong> to assign subjects. Only students whose documents have been verified by the Registrar will appear here.</p>
    </div>
  `;
}

export async function renderFacultyProgress() {
  const students = await supa('users', { match: { role: 'student' } });
  if (!students.length) return `<div class="rp-empty">No students found.</div>`;

  const courses = await supa('courses');
  const subjects = await supa('student_subjects');
  const apps = await supa('applications');
  const presets = await supa('presets');
  const presetSubs = await supa('preset_subjects');

  const searchQ = (window.facultySearch || '').toLowerCase();
  const filterYear = window.facultyFilterYear || '';
  const filterProg = window.facultyFilterProg || '';

  const filteredStudents = students.filter(u => {
    const app = apps.find(a => String(a.user_id) === String(u.id)) || {};
    let pr = app.program || {};
    if (typeof pr === 'string') { try { pr = JSON.parse(pr); } catch(e){} }
    
    // 1. Basic Filters
    const nameMatch = searchQ ? (u.name.toLowerCase().includes(searchQ) || (u.student_id && u.student_id.toLowerCase().includes(searchQ))) : true;
    const yearMatch = filterYear ? String(pr.year_level) === String(filterYear) : true;
    const progMatch = filterProg ? String(pr.preferred) === String(filterProg) : true;
    
    // 2. Application Status (Must be submitted and NOT returned)
    const hasApp = !!app.submitted && !app.returned; 

    // 3. Document Verification (Registrar must mark all required docs as Complete)
    const docStatus = app.doc_status || {};
    let docsComplete = true;
    
    if (app.doc_type === 'freshman') {
      docsComplete = ['form138', 'psa', 'idpic', 'goodmoral', 'exam'].every(id => docStatus[id] === 'Complete');
    } else if (app.doc_type === 'transferee') {
      docsComplete = ['transfer_cred', 'tor', 'goodmoral_prev', 'psa', 'idpic'].every(id => docStatus[id] === 'Complete');
    } else if (app.doc_type === 'returnee') {
      docsComplete = ['readmission', 'clearance'].every(id => docStatus[id] === 'Complete');
    } else {
      docsComplete = false; // If no doc_type, they can't proceed
    }

    return hasApp && nameMatch && yearMatch && progMatch && docsComplete;
  });

  if (window.facultySelectedStudent) {
    const student = students.find(s => String(s.id) === String(window.facultySelectedStudent));
    if (student) {
      const app = apps.find(a => String(a.user_id) === String(student.id)) || {};
      let pr = app.program || {};
      if (typeof pr === 'string') { try { pr = JSON.parse(pr); } catch(e){} }
      const progId = pr ? pr.preferred : null;
      const progName = progId ? (PROGRAMS[progId] || 'Unknown') : 'No Program';
      const isRegular = app.is_regular !== false;
      
      const programCourses = courses.filter(c => String(c.program_id) === String(progId) || String(c.program_id) === '0');
      const taken = subjects.filter(s => String(s.user_id) === String(student.id));
      
      const confirmedIds = taken.map(t => String(t.course_id));
      const tempIds = window.tempStudentSubjects.map(t => String(t.courseId));
      
      const availableToAdd = programCourses.filter(c => 
        !confirmedIds.includes(String(c.id)) && !tempIds.includes(String(c.id))
      );

      const matchingPresets = presets.filter(p => String(p.program_id) === String(progId) && String(p.year_level) === String(pr.year_level));

      return `
        <div class="rp-toolbar" style="margin-bottom: 20px;">
          <button class="rp-btn rp-btn-ghost" onclick="window.closeFacultyStudent()">← Back to List</button>
        </div>

        <div class="rp-card" style="margin-bottom: 20px; background:var(--mint-50);">
          <div class="rp-card-head" style="margin-bottom:0">
            <div>
              <h3>${esc(student.name)} <span class="rp-hint">(${esc(student.student_id || 'No ID')})</span></h3>
              <div class="rp-hint">${esc(student.email)} · ${progName} - Year ${esc(pr.year_level || '?')}</div>
            </div>
            <div style="display:flex; gap:10px; align-items:center;">
              <label style="font-size:12.5px;font-weight:600;">Status:</label>
              <select class="rp-input" data-change="facultyRegularity" data-student="${student.id}" style="width:120px; padding:6px 10px;">
                <option value="true" ${isRegular ? 'selected' : ''}>Regular</option>
                <option value="false" ${!isRegular ? 'selected' : ''}>Irregular</option>
              </select>
            </div>
          </div>
        </div>

        <div class="rp-grid-2">
          <div class="rp-card" style="display:flex; flex-direction:column;">
            <div class="rp-card-head">
              <h3>📝 Pre-Confirmed List</h3>
              <span class="rp-hint">${window.tempStudentSubjects.length} subject(s)</span>
            </div>
            
            <div id="tempSubjectList" style="flex:1;">
              ${window.tempStudentSubjects.length ? window.tempStudentSubjects.map((s, idx) => `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid #eee;">
                  <div>
                    <div style="font-size:13.5px; font-weight:600;">${esc(s.code)} — ${esc(s.title)}</div>
                    <div class="rp-hint">${s.units} units</div>
                  </div>
                  <button type="button" class="rp-btn rp-btn-danger rp-btn-sm" onclick="window.removeTempSubject(${idx})">✕</button>
                </div>
              `).join('') : '<div class="rp-empty" style="padding:20px 0;">No subjects pre-confirmed yet.</div>'}
            </div>

            <button type="button" class="rp-btn rp-btn-primary" style="margin-top: 16px; width: 100%; display: ${window.tempStudentSubjects.length ? 'block' : 'none'};" id="btnConfirmSubjects" onclick="window.confirmStudentSubjects('${student.id}')">
              Confirm Subjects
            </button>
          </div>

          <div class="rp-card">
            <div class="rp-card-head"><h3>➕ Add Subjects</h3></div>
            
            ${matchingPresets.length ? `
              <div style="margin-bottom: 20px; background:var(--mint-100); padding: 14px; border-radius: 10px;">
                <div style="font-size:13px; font-weight:700; margin-bottom:10px; color:var(--mint-800)">Available Presets</div>
                ${matchingPresets.map(mp => {
                  const subCount = presetSubs.filter(ps => String(ps.preset_id) === String(mp.id)).length;
                  return `
                    <div style="display:flex; justify-content:space-between; align-items:center; background:#fff; padding:10px 14px; border-radius:8px; margin-bottom:8px; box-shadow:0 2px 5px rgba(0,0,0,0.05);">
                      <div>
                        <div style="font-weight:600; font-size:13.5px;">${esc(mp.name)}</div>
                        <div class="rp-hint">${subCount} subjects</div>
                      </div>
                      <button type="button" class="rp-btn rp-btn-primary rp-btn-sm" data-action="facultyLoadPresetToTemp" data-preset="${mp.id}">Add to List</button>
                    </div>
                  `;
                }).join('')}
              </div>
            ` : ''}

            <form id="facultyAddSubjectForm" style="display:flex; gap:10px; flex-direction: column;">
              <input type="hidden" name="student_id" value="${student.id}">
              <select class="rp-input" name="course_id" required>
                <option value="">Select a course to add manually...</option>
                ${availableToAdd.map(c => `<option value="${c.id}">${esc(c.code)} — ${esc(c.title)} (${c.units} units)</option>`).join('')}
              </select>
              <button type="button" class="rp-btn rp-btn-ghost" style="justify-content: center; border: 1px dashed var(--mint-500);" onclick="window.tempAddSubject('${student.id}')">Add to List</button>
            </form>
          </div>
        </div>

        <div class="rp-card" style="margin-top: 20px;">
          <div class="rp-card-head">
            <h3>📚 Subjects to be added:</h3>
            <span class="rp-badge green">${taken.length} subject(s)</span>
          </div>
          ${taken.length ? taken.map(t => {
            const c = courses.find(x => String(x.id) === String(t.course_id));
            return `
              <div style="display:flex;justify-content:space-between;padding:12px 0;border-bottom:1px solid #eee; align-items: center;">
                <div>
                  <div style="font-size:13.5px;font-weight:600">${esc(c ? c.code : '')} — ${esc(c ? c.title : '')}</div>
                  <div class="rp-hint">${c ? c.units : 0} units · ${c ? c.schedule_day + ' ' + c.schedule_time : ''}</div>
                </div>
                <div style="display:flex; gap: 8px; align-items: center;">
                  <span class="rp-badge green">Pending Payment</span>
                  <button class="rp-btn rp-btn-danger rp-btn-sm" data-action="facultyRemoveSubject" data-id="${t.id}" data-student="${student.id}">✕</button>
                </div>
              </div>
            `;
          }).join('') : '<div class="rp-empty">No subjects added to the student yet.</div>'}
        </div>
      `;
    }
  }

  return `
    <div class="rp-toolbar" style="gap: 10px; flex-wrap: wrap;">
      <div class="grow" style="min-width: 250px;">
        <form id="facultySearchForm" style="display:flex; gap:8px;">
          <input class="rp-input" type="text" id="facultySearchInput" placeholder="Search name or student ID, then press Enter..." value="${esc(window.facultySearch || '')}">
          <button type="submit" class="rp-btn rp-btn-primary">Search</button>
        </form>
      </div>
      <div style="width: 150px;">
        <select class="rp-input" data-change="facultyFilterYear">
          <option value="">All Years</option>
          <option value="1" ${filterYear === '1' ? 'selected' : ''}>1st Year</option>
          <option value="2" ${filterYear === '2' ? 'selected' : ''}>2nd Year</option>
          <option value="3" ${filterYear === '3' ? 'selected' : ''}>3rd Year</option>
          <option value="4" ${filterYear === '4' ? 'selected' : ''}>4th Year</option>
        </select>
      </div>
      <div style="width: 150px;">
        <select class="rp-input" data-change="facultyFilterProg">
          <option value="">All Programs</option>
          <option value="1" ${filterProg === '1' ? 'selected' : ''}>BEEd</option>
          <option value="2" ${filterProg === '2' ? 'selected' : ''}>BSEd</option>
          <option value="8" ${filterProg === '8' ? 'selected' : ''}>BSCS</option>
        </select>
      </div>
    </div>

    <div class="rp-notice info" style="margin-bottom: 16px;">
      <span>ℹ️</span>
      <span>Only students whose documents have been <strong>Verified by the Registrar</strong> appear here.</span>
    </div>

    <div class="rp-table-wrap">
      <table class="rp-table">
        <thead><tr><th>Student Name</th><th>Student ID</th><th>Program</th><th>Year</th><th style="text-align:right">Action</th></tr></thead>
        <tbody>
          ${filteredStudents.length ? filteredStudents.map(u => {
            const app = apps.find(a => String(a.user_id) === String(u.id)) || {};
            let pr = app.program || {};
            if (typeof pr === 'string') { try { pr = JSON.parse(pr); } catch(e){} }
            const progName = PROGRAMS[pr.preferred] || 'Unknown';
            
            return `
              <tr>
                <td><strong>${esc(u.name)}</strong></td>
                <td>${esc(u.student_id || '—')}</td>
                <td><span class="rp-badge green">${progName}</span></td>
                <td>Year ${esc(pr.year_level || '?')}</td>
                <td style="text-align:right">
                  <button class="rp-btn rp-btn-primary rp-btn-sm" data-action="facultyManageStudent" data-id="${u.id}">Manage Student</button>
                </td>
              </tr>
            `;
          }).join('') : '<tr><td colspan="5" class="rp-empty">No verified students found.</td></tr>'}
        </tbody>
      </table>
    </div>
  `;
}

// --- MODALS (Kept just in case they are needed) ---

export async function facultyEditPresetModal(presetId) {
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
        <button type="button" class="rp-btn rp-btn-danger rp-btn-sm" onclick="window.removePresetSubjectTemp('${c.psId || 'NEW'}', '${c.id}')">Remove</button>
      </div>
    `).join('');
  };

  const modalHtml = `
    <div class="rp-modal-backdrop" id="facultyPresetModal">
      <div class="rp-modal wide">
        <div class="rp-modal-head">
          <h3>${isNew ? 'Create Preset' : 'Edit Preset'}</h3>
          <button type="button" class="rp-btn rp-btn-ghost rp-btn-sm" onclick="document.getElementById('facultyPresetModal').remove()">✕</button>
        </div>
        <div class="rp-modal-body">
          <div class="rp-grid-2">
            
            <div>
              <h4 style="margin-bottom:10px; font-size:14px; color:var(--mint-800);">Preset Info</h4>
              <div id="facultyPresetForm" style="display:flex; flex-direction:column; gap:12px;">
                <input type="hidden" id="preset_edit_id" value="${isNew ? '' : preset.id}">
                <div class="field">
                  <label>Preset Name</label>
                  <input class="rp-input" id="preset_name" value="${esc(preset.name)}" placeholder="e.g. BSCS 1st Year - 1st Sem" required>
                </div>
                <div class="field">
                  <label>Program</label>
                  <select class="rp-input" id="preset_prog" required>
                    <option value="1" ${preset.program_id === '1' ? 'selected' : ''}>BEEd</option>
                    <option value="2" ${preset.program_id === '2' ? 'selected' : ''}>BSEd</option>
                    <option value="8" ${preset.program_id === '8' ? 'selected' : ''}>BSCS</option>
                  </select>
                </div>
                <div class="field-row">
                  <div class="field">
                    <label>Year Level</label>
                    <select class="rp-input" id="preset_year" required>
                      <option value="1" ${preset.year_level === '1' ? 'selected' : ''}>1st Year</option>
                      <option value="2" ${preset.year_level === '2' ? 'selected' : ''}>2nd Year</option>
                      <option value="3" ${preset.year_level === '3' ? 'selected' : ''}>3rd Year</option>
                      <option value="4" ${preset.year_level === '4' ? 'selected' : ''}>4th Year</option>
                    </select>
                  </div>
                  <div class="field">
                    <label>Semester</label>
                    <select class="rp-input" id="preset_sem" required>
                      <option value="1st Semester" ${preset.semester === '1st Semester' ? 'selected' : ''}>1st Semester</option>
                      <option value="2nd Semester" ${preset.semester === '2nd Semester' ? 'selected' : ''}>2nd Semester</option>
                      <option value="Summer" ${preset.semester === 'Summer' ? 'selected' : ''}>Summer</option>
                    </select>
                  </div>
                </div>
                <button type="button" class="rp-btn rp-btn-primary" data-action="facultySavePreset" style="margin-top:10px;">Save Preset Info</button>
              </div>
            </div>

            <div>
              <h4 style="margin-bottom:10px; font-size:14px; color:var(--mint-800);">Add Subjects</h4>
              <div style="display:flex; gap:8px;">
                <input class="rp-input" id="presetCodeInput" placeholder="Type Course Code (e.g. BSCS-101)">
                <button type="button" class="rp-btn rp-btn-primary" onclick="window.addPresetSubjectTemp('${isNew ? '' : preset.id}')">Add</button>
              </div>
              <div id="presetErrorMsg" style="color:var(--danger); font-size:12px; margin-top:5px; display:none;"></div>
              
              <h4 style="margin-top:20px; margin-bottom:10px; font-size:14px; color:var(--mint-800);">Subjects in Preset</h4>
              <div style="max-height: 250px; overflow-y:auto; border:1px solid #eee; border-radius:8px; padding: 0 10px;" id="presetSubjectListContainer">
                ${renderSubjectList()}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  `;

  window.tempPresetSubjects = currentSubjects;
  window.tempPresetId = isNew ? null : preset.id;
  window.tempDeletedPSIds = [];

  document.getElementById('facultyPresetModal')?.remove();
  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

export async function facultyEditCourseModal(courseId) {
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
    <div class="rp-modal-backdrop" id="facultyEditCourseModal">
      <div class="rp-modal">
        <div class="rp-modal-head">
          <h3>Edit Subject — ${esc(c.code)}</h3>
          <button type="button" class="rp-btn rp-btn-ghost rp-btn-sm" onclick="document.getElementById('facultyEditCourseModal').remove()">✕</button>
        </div>
        <div class="rp-modal-body">
          <form id="facultyEditCourseForm">
            <input type="hidden" name="id" id="edit_course_id" value="${c.id}">
            <div class="field-row">
              <div class="field"><label>Course Code</label><input class="rp-input" id="edit_course_code" name="code" value="${esc(c.code)}" required></div>
              <div class="field"><label>Units</label><input class="rp-input" id="edit_course_units" type="number" name="units" value="${c.units}" required></div>
            </div>
            <div class="field"><label>Title</label><input class="rp-input" id="edit_course_title" name="title" value="${esc(c.title)}" required></div>
            <div class="field-row">
              <div class="field">
                <label>Day</label>
                <select class="rp-input" id="edit_course_day" name="schedule_day" required>
                  ${DAYS.map(d => `<option value="${d}" ${c.schedule_day === d ? 'selected' : ''}>${d}</option>`).join('')}
                </select>
              </div>
              <div class="field-row" style="grid-template-columns: 1fr 1fr; gap: 8px;">
                <div class="field">
                  <label>Start Time</label>
                  <input type="time" class="rp-input" id="edit_course_start" name="schedule_time_start" value="${startTime}" required>
                </div>
                <div class="field">
                  <label>End Time</label>
                  <input type="time" class="rp-input" id="edit_course_end" name="schedule_time_end" value="${endTime}" required>
                </div>
              </div>
            </div>
            <div class="field">
              <label>Program</label>
              <select class="rp-input" id="edit_course_prog" name="program_id" required>
                <option value="0" ${c.program_id === '0' ? 'selected' : ''}>General (All Programs)</option>
                <option value="1" ${c.program_id === '1' ? 'selected' : ''}>BEEd (Elementary Education)</option>
                <option value="2" ${c.program_id === '2' ? 'selected' : ''}>BSEd (Secondary Education)</option>
                <option value="8" ${c.program_id === '8' ? 'selected' : ''}>BSCS (Computer Science)</option>
              </select>
            </div>
            <button type="button" class="rp-btn rp-btn-primary" data-action="facultySaveEditedCourse" style="margin-top: 20px; width:100%;">Save Changes</button>
          </form>
        </div>
      </div>
    </div>
  `;

  document.getElementById('facultyEditCourseModal')?.remove();
  document.body.insertAdjacentHTML('beforeend', modalHtml);
}
