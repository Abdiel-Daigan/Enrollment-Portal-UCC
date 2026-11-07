import { esc } from './utils.js';
import { supa } from './api.js';

export async function renderFacultyDashboard() {
  const students = await supa('users', { match: { role: 'student' } });
  const apps = await supa('applications');
  const submitted = apps.filter(a => a.submitted).length;

  return `
    <div class="rp-grid-4">
      <div class="rp-card rp-stat"><div class="ic">👥</div><div><div class="val">${students.length}</div><div class="lbl">Total Students</div></div></div>
      <div class="rp-card rp-stat gold"><div class="ic">✅</div><div><div class="val">${submitted}</div><div class="lbl">Applications Submitted</div></div></div>
    </div>
    <div class="rp-card">
      <h3>College Department</h3>
      <p class="rp-hint" style="margin-top:10px;">Go to <strong>Check Students</strong> to evaluate what subjects a student has taken and what they can take next.</p>
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
  const passedIds = taken.filter(t => t.status === 'Passed').map(t => t.course_id);

  const canTake = programCourses.filter(c => !takenIds.includes(c.id) && !passedIds.includes(c.id));

  const p = app.personal || {};
  const fullName = p.first_name ? `${p.first_name} ${p.last_name}` : student.name;

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
          <h3>${esc(fullName)}</h3>
          <div class="rp-hint">${esc(student.email)} · Program ID: ${esc(progId || 'Not selected')}</div>
        </div>
        <span class="rp-badge ${app.submitted ? 'green' : 'gold'}">${app.submitted ? 'Application Submitted' : 'In Progress'}</span>
      </div>
    </div>

    <div class="rp-grid-4" style="margin-bottom: 20px;">
      <div class="rp-card rp-stat"><div class="ic">📗</div><div><div class="val">${taken.length}</div><div class="lbl">Subjects Taken</div></div></div>
      <div class="rp-card rp-stat gold"><div class="ic">✅</div><div><div class="val">${passedIds.length}</div><div class="lbl">Subjects Passed</div></div></div>
      <div class="rp-card rp-stat"><div class="ic">🎯</div><div><div class="val">${canTake.length}</div><div class="lbl">Available to Take</div></div></div>
      <div class="rp-card rp-stat gold"><div class="ic">🎓</div><div><div class="val">${programCourses.length}</div><div class="lbl">Total Program Courses</div></div></div>
    </div>

    <div class="rp-grid-2">
      <div class="rp-card">
        <div class="rp-card-head"><h3>✅ Subjects Taken / Passed</h3></div>
        ${taken.length ? taken.map(t => {
          const c = courses.find(x => String(x.id) === String(t.course_id));
          return `
            <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #eee;">
              <div>
                <div style="font-size:13.2px;font-weight:600">${esc(c ? c.code : '')} — ${esc(c ? c.title : '')}</div>
                <div class="rp-hint">${esc(t.term || 'Recorded')}</div>
              </div>
              <div style="text-align:right">
                <div style="font-weight:800">${esc(t.grade || '—')}</div>
                <span class="rp-badge ${t.status === 'Passed' ? 'green' : 'red'}">${esc(t.status)}</span>
              </div>
            </div>
          `;
        }).join('') : '<div class="rp-empty">No subjects recorded yet.</div>'}
      </div>

      <div class="rp-card">
        <div class="rp-card-head"><h3>🎯 Subjects They Can Take</h3></div>
        ${canTake.length ? canTake.map(c => `
          <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #eee;">
            <div>
              <div style="font-size:13.2px;font-weight:600">${esc(c.code)} — ${esc(c.title)}</div>
              <div class="rp-hint">${c.units} units</div>
            </div>
            <span class="rp-badge gold">Available</span>
          </div>
        `).join('') : '<div class="rp-empty">No eligible subjects left.</div>'}
      </div>
    </div>
  `;
}

window.setFacultyStudent = (id) => {
  window.facultyStudent = id;
  renderAll();
};
