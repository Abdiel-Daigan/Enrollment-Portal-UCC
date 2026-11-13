import { esc, toast } from './utils.js';
import { supa } from './api.js';

// Map IDs to Program Names
const PROGRAMS = {
  '0': 'General',
  '1': 'BEEd',
  '2': 'BSEd',
  '8': 'BSCS'
};

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const TIMES = [
  '07:30 - 08:30', '08:30 - 09:30', '09:30 - 10:30', '10:30 - 11:30',
  '13:00 - 14:00', '14:00 - 15:00', '15:00 - 16:00', '16:00 - 17:00'
];

export async function renderFacultyDashboard() {
  const students = await supa('users', { match: { role: 'student' } });
  const apps = await supa('applications');
  const courses = await supa('courses');
  
  const submitted = apps.filter(a => a.submitted).length;

  return `
    <div class="rp-grid-4">
      <div class="rp-card rp-stat"><div class="ic">👥</div><div><div class="val">${students.length}</div><div class="lbl">Total Students</div></div></div>
      <div class="rp-card rp-stat gold"><div class="ic">✅</div><div><div class="val">${submitted}</div><div class="lbl">Applications Submitted</div></div></div>
      <div class="rp-card rp-stat"><div class="ic">📚</div><div><div class="val">${courses.length}</div><div class="lbl">Total Subjects</div></div></div>
    </div>
    <div class="rp-card">
      <h3>College Department</h3>
      <p class="rp-hint" style="margin-top:10px;">Go to <strong>Check Students</strong> to assign subjects, or <strong>Manage Subjects</strong> to update the curriculum.</p>
    </div>
  `;
}

export async function renderFacultyProgress() {
  const students = await supa('users', { match: { role: 'student' } });
  if (!students.length) return `<div class="rp-empty">No students found.</div>`;

  const courses = await supa('courses');
  const subjects = await supa('student_subjects');
  const apps = await supa('applications');

  const searchQ = (window.facultySearch || '').toLowerCase();
  const filterYear = window.facultyFilterYear || '';
  const filterProg = window.facultyFilterProg || '';

  // Filter logic
  const filteredStudents = students.filter(u => {
    const app = apps.find(a => String(a.user_id) === String(u.id)) || {};
    let pr = app.program || {};
    if (typeof pr === 'string') { try { pr = JSON.parse(pr); } catch(e){} }
    
    // Show only if they match the search AND the filters
    const nameMatch = searchQ ? (u.name.toLowerCase().includes(searchQ) || (u.student_id && u.student_id.toLowerCase().includes(searchQ))) : true;
    const yearMatch = filterYear ? String(pr.year_level) === String(filterYear) : true;
    const progMatch = filterProg ? String(pr.preferred) === String(filterProg) : true;
    
    // Only show students who have started an application (so they have a program)
    const hasApp = !!app.submitted; 

    return hasApp && nameMatch && yearMatch && progMatch;
  });

  // Build suggestions HTML (only if typing)
  let suggestionsHtml = '';
  if (searchQ.length > 0) {
    const suggestions = students.filter(u => u.name.toLowerCase().includes(searchQ) || (u.student_id && u.student_id.toLowerCase().includes(searchQ))).slice(0, 5);
    if (suggestions.length) {
      suggestionsHtml = `
        <div style="position:absolute; top:100%; left:0; right:0; background:#fff; border:1px solid var(--line); border-radius:0 0 10px 10px; box-shadow:var(--shadow); z-index:10;">
          ${suggestions.map(s => `
            <div style="padding:10px 14px; border-bottom:1px solid #eee; cursor:pointer;" 
                 onclick="window.setFacultySearch('${esc(s.name)}')">
              <strong>${esc(s.name)}</strong> <span class="rp-hint">(${esc(s.student_id || 'No ID')})</span>
            </div>
          `).join('')}
        </div>
      `;
    }
  }

  return `
    <div class="rp-toolbar" style="gap: 10px; flex-wrap: wrap;">
      <div class="grow" style="min-width: 200px; position: relative;">
        <input class="rp-input" type="text" placeholder="Search name or student ID..." 
               data-change="facultySearch" value="${esc(window.facultySearch || '')}"
               autocomplete="off">
        ${suggestionsHtml}
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
          }).join('') : '<tr><td colspan="5" class="rp-empty">No students found. Type in the search bar.</td></tr>'}
        </tbody>
      </table>
    </div>
  `;
}

export async function facultyManageStudentModal(userId) {
  const users = await supa('users', { match: { id: userId } });
  const u = users[0];
  const apps = await supa('applications', { match: { user_id: userId } });
  const app = apps[0] || {};
  const subjects = await supa('student_subjects', { match: { user_id: userId } });
  const courses = await supa('courses');
  
  let pr = app.program || {};
  if (typeof pr === 'string') { try { pr = JSON.parse(pr); } catch(e){} }
  const progId = pr ? pr.preferred : null;
  const progName = progId ? (PROGRAMS[progId] || 'Unknown') : 'No Program';

  // Courses available for this program OR General (0)
  const programCourses = courses.filter(c => String(c.program_id) === String(progId) || String(c.program_id) === '0');
  const taken = subjects;
  const takenIds = taken.map(t => String(t.course_id));
  const availableToAdd = programCourses.filter(c => !takenIds.includes(String(c.id)));

  const modalHtml = `
    <div class="rp-modal-backdrop" id="facultyStudentModal">
      <div class="rp-modal wide">
        <div class="rp-modal-head">
          <h3>Manage Student — ${esc(u.name)}</h3>
          <button class="rp-btn rp-btn-ghost rp-btn-sm" onclick="document.getElementById('facultyStudentModal').remove()">✕</button>
        </div>
        <div class="rp-modal-body">
          <div class="rp-card" style="margin-bottom: 20px; background:var(--mint-50);">
            <div class="rp-card-head" style="margin-bottom:0">
              <div>
                <h3>${esc(u.name)} <span class="rp-hint">(${esc(u.student_id || 'No ID')})</span></h3>
                <div class="rp-hint">${esc(u.email)} · ${progName} - Year ${esc(pr.year_level || '?')}</div>
              </div>
            </div>
          </div>

          <div class="rp-grid-2">
            <div class="rp-card">
              <div class="rp-card-head"><h3>📚 Current Subjects</h3></div>
              ${taken.length ? taken.map(t => {
                const c = courses.find(x => String(x.id) === String(t.course_id));
                let badge = '';
                if (t.status === 'Taken') badge = '<span class="rp-badge green">Taken</span>';
                else if (t.status === 'Enrolled') badge = '<span class="rp-badge gold">Enrolled (Pending Payment)</span>';
                else badge = `<span class="rp-badge grey">${esc(t.status)}</span>`;

                return `
                  <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #eee; align-items: center;">
                    <div>
                      <div style="font-size:13.2px;font-weight:600">${esc(c ? c.code : '')} — ${esc(c ? c.title : '')}</div>
                      <div class="rp-hint">${c ? c.units : 0} units · ${esc(c ? c.schedule_day + ' ' + c.schedule_time : '')}</div>
                    </div>
                    <div style="display:flex; gap: 8px; align-items: center;">
                      ${badge}
                      ${t.status === 'Enrolled' ? `
                        <button class="rp-btn rp-btn-primary rp-btn-sm" data-action="facultyApproveSubject" data-id="${t.id}" data-student="${student.id}">Approve Payment</button>
                      ` : ''}
                      <button class="rp-btn rp-btn-danger rp-btn-sm" data-action="facultyRemoveSubject" data-id="${t.id}" data-student="${student.id}">✕</button>
                    </div>
                  </div>
                `;
              }).join('') : '<div class="rp-empty">No subjects assigned yet.</div>'}
            </div>

            <div class="rp-card">
              <div class="rp-card-head"><h3>➕ Add Subject</h3></div>
              ${availableToAdd.length ? `
                <form id="facultyAddSubjectForm" style="display:flex; gap:10px; flex-direction: column;">
                  <input type="hidden" name="student_id" value="${u.id}">
                  <select class="rp-input" name="course_id" required>
                    <option value="">Select a course to add...</option>
                    ${availableToAdd.map(c => `<option value="${c.id}">${esc(c.code)} — ${esc(c.title)} (${PROGRAMS[c.program_id]})</option>`).join('')}
                  </select>
                  <select class="rp-input" name="status" required>
                    <option value="Enrolled">Enrolled (Waiting for Payment)</option>
                    <option value="Taken">Taken (Already Passed)</option>
                  </select>
                  <button type="submit" class="rp-btn rp-btn-primary" style="justify-content: center;">Add Subject</button>
                </form>
              ` : `
                <div class="rp-empty">
                  <span class="big">✅</span>
                  No subjects available to add.
                </div>
              `}
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('facultyStudentModal')?.remove();
  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

export async function renderFacultyCourses() {
  const courses = await supa('courses');
  const filterProg = window.facultyCourseFilterProg || 'all';

  const filteredCourses = courses.filter(c => filterProg === 'all' || String(c.program_id) === String(filterProg));

  return `
    <div class="rp-toolbar" style="margin-bottom:20px;">
      <div class="grow"></div>
      <div style="width: 200px;">
        <select class="rp-input" data-change="facultyCourseFilterProg">
          <option value="all">All Programs</option>
          <option value="0" ${filterProg === '0' ? 'selected' : ''}>General Subjects</option>
          <option value="1" ${filterProg === '1' ? 'selected' : ''}>BEEd</option>
          <option value="2" ${filterProg === '2' ? 'selected' : ''}>BSEd</option>
          <option value="8" ${filterProg === '8' ? 'selected' : ''}>BSCS</option>
        </select>
      </div>
    </div>

    <div class="rp-grid-2">
      <div class="rp-card">
        <div class="rp-card-head"><h3>➕ Create New Subject</h3></div>
        <form id="facultyCreateCourseForm" style="display:flex; flex-direction: column; gap: 10px;">
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
            <div class="field">
              <label>Time</label>
              <select class="rp-input" name="schedule_time" required>
                ${TIMES.map(t => `<option value="${t}">${t}</option>`).join('')}
              </select>
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

      <div class="rp-card">
        <div class="rp-card-head"><h3>📚 Subject List</h3></div>
        <div class="rp-table-wrap" style="max-height: 500px; overflow-y: auto;">
          <table class="rp-table">
            <thead><tr><th>Code</th><th>Title</th><th>Prog</th><th>Units</th><th>Schedule</th><th style="text-align:right">Action</th></tr></thead>
            <tbody>
              ${filteredCourses.length ? filteredCourses.map(c => {
                const pName = PROGRAMS[c.program_id] || 'Unknown';
                return `
                <tr>
                  <td><strong>${esc(c.code)}</strong></td>
                  <td>${esc(c.title)}</td>
                  <td><span class="rp-badge ${c.program_id === '0' ? 'gold' : 'green'}">${pName}</span></td>
                  <td>${c.units}</td>
                  <td class="rp-hint">${esc((c.schedule_day || '') + ' ' + (c.schedule_time || ''))}</td>
                  <td style="text-align:right; white-space:nowrap;">
                    <button class="rp-btn rp-btn-primary rp-btn-sm" data-action="facultyEditCourse" data-id="${c.id}">Edit</button>
                    <button class="rp-btn rp-btn-danger rp-btn-sm" data-action="facultyDeleteCourse" data-id="${c.id}">✕</button>
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

export async function facultyEditCourseModal(courseId) {
  const courses = await supa('courses', { match: { id: courseId } });
  const c = courses[0];

  const modalHtml = `
    <div class="rp-modal-backdrop" id="facultyEditCourseModal">
      <div class="rp-modal">
        <div class="rp-modal-head">
          <h3>Edit Subject — ${esc(c.code)}</h3>
          <button class="rp-btn rp-btn-ghost rp-btn-sm" onclick="document.getElementById('facultyEditCourseModal').remove()">✕</button>
        </div>
        <div class="rp-modal-body">
          <form id="facultyEditCourseForm">
            <input type="hidden" name="id" value="${c.id}">
            <div class="field-row">
              <div class="field"><label>Course Code</label><input class="rp-input" name="code" value="${esc(c.code)}" required></div>
              <div class="field"><label>Units</label><input class="rp-input" type="number" name="units" value="${c.units}" required></div>
            </div>
            <div class="field"><label>Title</label><input class="rp-input" name="title" value="${esc(c.title)}" required></div>
            <div class="field-row">
              <div class="field">
                <label>Day</label>
                <select class="rp-input" name="schedule_day" required>
                  ${DAYS.map(d => `<option value="${d}" ${c.schedule_day === d ? 'selected' : ''}>${d}</option>`).join('')}
                </select>
              </div>
              <div class="field">
                <label>Time</label>
                <select class="rp-input" name="schedule_time" required>
                  ${TIMES.map(t => `<option value="${t}" ${c.schedule_time === t ? 'selected' : ''}>${t}</option>`).join('')}
                </select>
              </div>
            </div>
            <div class="field">
              <label>Program</label>
              <select class="rp-input" name="program_id" required>
                <option value="0" ${c.program_id === '0' ? 'selected' : ''}>General (All Programs)</option>
                <option value="1" ${c.program_id === '1' ? 'selected' : ''}>BEEd (Elementary Education)</option>
                <option value="2" ${c.program_id === '2' ? 'selected' : ''}>BSEd (Secondary Education)</option>
                <option value="8" ${c.program_id === '8' ? 'selected' : ''}>BSCS (Computer Science)</option>
              </select>
            </div>
            <button type="submit" class="rp-btn rp-btn-primary" style="margin-top: 20px; width:100%;">Save Changes</button>
          </form>
        </div>
      </div>
    </div>
  `;

  document.getElementById('facultyEditCourseModal')?.remove();
  document.body.insertAdjacentHTML('beforeend', modalHtml);
}
