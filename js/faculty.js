import { esc, toast } from './utils.js';
import { supa } from './api.js';

export async function renderFacultyDashboard() {
  const students = await supa('users', { match: { role: 'student' } });
  const apps = await supa('applications');
  const submitted = apps.filter(a => a.submitted).length;

  return `
    <div class="rp-grid-4">
      <div class="rp-card rp-stat">
        <div class="ic">👥</div>
        <div><div class="val">${students.length}</div><div class="lbl">Total Students</div></div>
      </div>
      <div class="rp-card rp-stat gold">
        <div class="ic">✅</div>
        <div><div class="val">${submitted}</div><div class="lbl">Applications Submitted</div></div>
      </div>
    </div>
    <div class="rp-card">
      <div class="rp-card-head"><h3>College Department</h3></div>
      <p class="rp-hint">Go to <strong>Check Students</strong> to evaluate what subjects a student has taken and what they can take next.</p>
    </div>
  `;
}

export async function renderFacultyProgress() {
  const students = await supa('users', { match: { role: 'student' } });
  if (!students.length) return `<div class="rp-empty">No students found.</div>`;

  const courses = await supa('courses');
  const subjects = await supa('student_subjects');
  const apps = await supa('applications');

  // Default to first student if none selected
  const selectedId = window.facultyStudent || students[0].id;
  const student = students.find(s => String(s.id) === String(selectedId)) || students[0];

  // Get program
  const app = apps.find(a => String(a.user_id) === String(student.id)) || {};
  let pr = app.program;
  if (typeof pr === 'string') { try { pr = JSON.parse(pr); } catch(e){} }
  const progId = pr ? pr.preferred : null;

  // Filter courses by program
  const programCourses = progId ? courses.filter(c => String(c.program_id) === String(progId)) : courses;

  // Get taken subjects
  const taken = subjects.filter(s => String(s.user_id) === String(student.id));
  const takenIds = taken.map(t => t.course_id);
  const passedIds = taken.filter(t => t.status === 'Passed').map(t => t.course_id);

  // Get what they can take
  const canTake = programCourses.filter(c => !takenIds.includes(c.id) && !passedIds.includes(c.id));

  return `
    <div class="rp-toolbar">
      <div class="grow">
        <select class="rp-input" onchange="window.setFacultyStudent(this.value)">
          ${students.map(u => `<option value="${u.id}" ${u.id === student.id ? 'selected' : ''}>${esc(u.name)}</option>`).join('')}
        </select>
      </div>
    </div>

    <div class="rp-grid-4" style="margin-bottom: 20px;">
      ${renderStat(taken.length, 'Subjects Taken', '📗')}
      ${renderStat(passedIds.length, 'Subjects Passed', '✅', true)}
      ${renderStat(canTake.length, 'Available to Take', '🎯')}
    </div>

    <div class="rp-grid-2">
      <div class="rp-card">
        <div class="rp-card-head"><h3>✅ Subjects Taken</h3></div>
        ${taken.length ? taken.map(t => {
          const c = courses.find(x => String(x.id) === String(t.course_id));
          return `
            <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #eee;">
              <div><strong>${esc(c ? c.code : '')}</strong> ${esc(c ? c.title : '')}</div>
              <span class="rp-badge ${t.status === 'Passed' ? 'green' : 'red'}">${esc(t.status)}</span>
            </div>
          `;
        }).join('') : '<div class="rp-empty">No subjects recorded.</div>'}
      </div>

      <div class="rp-card">
        <div class="rp-card-head"><h3>🎯 Can Take</h3></div>
        ${canTake.length ? canTake.map(c => `
          <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #eee;">
            <div><strong>${esc(c.code)}</strong> ${esc(c.title)}</div>
            <span class="rp-badge gold">Available</span>
          </div>
        `).join('') : '<div class="rp-empty">No eligible subjects.</div>'}
      </div>
    </div>
  `;
}

function renderStat(val, lbl, icon, gold = false) {
  return `
    <div class="rp-card rp-stat ${gold ? 'gold' : ''}">
      <div class="ic">${icon}</div>
      <div><div class="val">${val}</div><div class="lbl">${esc(lbl)}</div></div>
    </div>
  `;
}

window.setFacultyStudent = (id) => {
  window.facultyStudent = id;
  renderAll();
};
