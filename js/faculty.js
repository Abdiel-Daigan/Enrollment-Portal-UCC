import { esc, toast } from './utils.js';
import { supa } from './api.js';

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

  const selectedId = window.facultyStudent || students[0].id;
  const student = students.find(s => String(s.id) === String(selectedId)) || students[0];

  const app = apps.find(a => String(a.user_id) === String(student.id)) || {};
  
  let pr = app.program;
  if (typeof pr === 'string') { try { pr = JSON.parse(pr); } catch(e){} }
  const progId = pr ? pr.preferred : null;

  const programCourses = progId ? courses.filter(c => String(c.program_id) === String(progId)) : courses;

  const taken = subjects.filter(s => String(s.user_id) === String(student.id));
  const takenIds = taken.map(t => t.course_id);

  // What they haven't taken yet
  const availableToAdd = programCourses.filter(c => !takenIds.includes(c.id));

  return `
    <div class="rp-toolbar">
      <div class="grow">
        <label style="font-size:12.5px;font-weight:600;color:var(--muted);margin-bottom:5px;display:block">Select Student to Evaluate</label>
        <select class="rp-input" onchange="window.setFacultyStudent(this.value)">
          ${students.map(u => `<option value="${u.id}" ${u.id === student.id ? 'selected' : ''}>${esc(u.name)}</option>`).join('')}
        </select>
      </div>
    </div>

    <div class="rp-card" style="margin-bottom: 20px;">
      <div class="rp-card-head">
        <div>
          <h3>${esc(student.name)}</h3>
          <div class="rp-hint">${esc(student.email)} · Program ID: ${esc(progId || 'Not selected')}</div>
        </div>
        <span class="rp-badge ${app.submitted ? 'green' : 'gold'}">${app.submitted ? 'Application Submitted' : 'In Progress'}</span>
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
                <div class="rp-hint">${c ? c.units : 0} units</div>
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
        <form id="facultyAddSubjectForm" style="display:flex; gap:10px; flex-direction: column;">
          <input type="hidden" name="student_id" value="${student.id}">
          <select class="rp-input" name="course_id" required>
            <option value="">Select a course to add...</option>
            ${availableToAdd.map(c => `<option value="${c.id}">${esc(c.code)} — ${esc(c.title)}</option>`).join('')}
          </select>
          <select class="rp-input" name="status" required>
            <option value="Enrolled">Enrolled (Waiting for Payment)</option>
            <option value="Taken">Taken (Already Passed)</option>
          </select>
          <button type="submit" class="rp-btn rp-btn-primary" style="justify-content: center;">Add Subject</button>
        </form>
      </div>
    </div>
  `;
}

export async function renderFacultyCourses() {
  const courses = await supa('courses');
  
  return `
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
            <div class="field"><label>Program ID</label><input class="rp-input" type="number" name="program_id" placeholder="e.g. 8" required></div>
            <div class="field"><label>Department ID</label><input class="rp-input" type="number" name="department_id" value="2" required></div>
          </div>
          <button type="submit" class="rp-btn rp-btn-primary" style="margin-top: 10px; justify-content: center;">Create Subject</button>
        </form>
      </div>

      <div class="rp-card">
        <div class="rp-card-head"><h3>📚 All Subjects</h3></div>
        <div class="rp-table-wrap" style="max-height: 400px; overflow-y: auto;">
          <table class="rp-table">
            <thead><tr><th>Code</th><th>Title</th><th>Units</th><th style="text-align:right">Action</th></tr></thead>
            <tbody>
              ${courses.length ? courses.map(c => `
                <tr>
                  <td><strong>${esc(c.code)}</strong></td>
                  <td>${esc(c.title)}</td>
                  <td>${c.units}</td>
                  <td style="text-align:right">
                    <button class="rp-btn rp-btn-danger rp-btn-sm" data-action="facultyDeleteCourse" data-id="${c.id}">Delete</button>
                  </td>
                </tr>
              `).join('') : '<tr><td colspan="4" class="rp-empty">No subjects found.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

window.setFacultyStudent = (id) => {
  window.facultyStudent = id;
  renderAll();
};
