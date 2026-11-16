import { esc, toast } from './utils.js';
import { supa } from './api.js';

const PROGRAMS = {
  '0': 'General',
  '1': 'BEEd',
  '2': 'BSEd',
  '8': 'BSCS'
};

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export async function renderRegistrarDashboard() {
  const students = await supa('users', { match: { role: 'student' } });
  const courses = await supa('courses');
  const presets = await supa('presets');

  return `
    <div class="rp-grid-4">
      <div class="rp-card rp-stat"><div class="ic">👥</div><div><div class="val">${students.length}</div><div class="lbl">Total Students</div></div></div>
      <div class="rp-card rp-stat gold"><div class="ic">📚</div><div><div class="val">${courses.length}</div><div class="lbl">Total Subjects</div></div></div>
      <div class="rp-card rp-stat"><div class="ic">🧩</div><div><div class="val">${presets.length}</div><div class="lbl">Total Presets</div></div></div>
    </div>
    <div class="rp-card">
      <h3>Registrar Overview</h3>
      <p class="rp-hint" style="margin-top:10px;">Manage the academic curriculum, create subjects, and organize course bundles for Faculty use.</p>
    </div>
  `;
}

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
