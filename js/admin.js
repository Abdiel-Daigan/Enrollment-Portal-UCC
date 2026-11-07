import { esc, toast } from './utils.js';
import { supa } from './api.js';

export async function renderAdminDashboard() {
  const students = await supa('users', { match: { role: 'student' } });
  const apps = await supa('applications');
  const enrollments = await supa('enrollments');

  const submitted = apps.filter(a => a.submitted).length;
  const pending = students.length - submitted;

  return `
    <div class="rp-grid-4">
      <div class="rp-card rp-stat">
        <div class="ic">👥</div>
        <div><div class="val">${students.length}</div><div class="lbl">Total Students</div></div>
      </div>
      <div class="rp-card rp-stat gold">
        <div class="ic">✅</div>
        <div><div class="val">${submitted}</div><div class="lbl">Submitted Apps</div></div>
      </div>
      <div class="rp-card rp-stat">
        <div class="ic">⏳</div>
        <div><div class="val">${pending}</div><div class="lbl">In Progress</div></div>
      </div>
      <div class="rp-card rp-stat gold">
        <div class="ic">📝</div>
        <div><div class="val">${enrollments.length}</div><div class="lbl">Enrollments</div></div>
      </div>
    </div>
    <div class="rp-card">
      <h3>Welcome to the Admin Portal</h3>
      <p class="rp-hint" style="margin-top:10px;">Use the sidebar to manage students, courses, and approve enrollments.</p>
    </div>
  `;
}

export async function renderAdminStudents() {
  const users = await supa('users', { match: { role: 'student' } });
  const apps = await supa('applications');

  return `
    <div class="rp-table-wrap">
      <table class="rp-table">
        <thead><tr><th>Name</th><th>Email</th><th>Status</th><th style="text-align:right">Actions</th></tr></thead>
        <tbody>
          ${users.length ? users.map(u => {
            const app = apps.find(a => String(a.user_id) === String(u.id)) || {};
            return `
              <tr>
                <td><strong>${esc(u.name)}</strong></td>
                <td>${esc(u.email)}</td>
                <td><span class="rp-badge ${app.submitted ? 'green' : 'gold'}">${app.submitted ? 'Submitted' : 'In Progress'}</span></td>
                <td style="text-align:right">
                  <button class="rp-btn rp-btn-primary rp-btn-sm" data-action="adminOpenStudent" data-id="${u.id}">Manage</button>
                </td>
              </tr>
            `;
          }).join('') : '<tr><td colspan="4" class="rp-empty">No students found.</td></tr>'}
        </tbody>
      </table>
    </div>
  `;
}

export async function renderAdminCourses() {
  const courses = await supa('courses');
  return `
    <div class="rp-table-wrap">
      <table class="rp-table">
        <thead><tr><th>Code</th><th>Title</th><th>Units</th><th>Program ID</th></tr></thead>
        <tbody>
          ${courses.length ? courses.map(c => `
            <tr>
              <td><strong>${esc(c.code)}</strong></td>
              <td>${esc(c.title)}</td>
              <td>${c.units}</td>
              <td>${esc(c.program_id)}</td>
            </tr>
          `).join('') : '<tr><td colspan="4" class="rp-empty">No courses found.</td></tr>'}
        </tbody>
      </table>
    </div>
  `;
}

export async function renderAdminEnrollments() {
  const apps = await supa('applications');
  const users = await supa('users', { match: { role: 'student' } });
  const enrollments = await supa('enrollments');

  const submittedApps = apps.filter(a => a.submitted);

  return `
    <div class="rp-notice mint">
      <span>ℹ️</span>
      <span>Approve submitted applications to officially enroll students. Approved students can no longer drop subjects.</span>
    </div>

    <div class="rp-table-wrap">
      <table class="rp-table">
        <thead><tr><th>Student</th><th>Reference</th><th>Status</th><th>Subjects</th><th style="text-align:right">Actions</th></tr></thead>
        <tbody>
          ${submittedApps.length ? submittedApps.map(app => {
            const u = users.find(x => String(x.id) === String(app.user_id)) || { name: 'Unknown' };
            const myEnr = enrollments.filter(e => String(e.user_id) === String(app.user_id));
            const isApproved = app.status === 'Enrolled';
            
            return `
              <tr>
                <td><strong>${esc(u.name)}</strong></td>
                <td>${esc(app.reference || '—')}</td>
                <td><span class="rp-badge ${isApproved ? 'green' : 'gold'}">${esc(app.status || 'Pending')}</span></td>
                <td>${myEnr.length} subject(s)</td>
                <td style="text-align:right">
                  ${!isApproved 
                    ? `<button class="rp-btn rp-btn-primary rp-btn-sm" data-action="adminApproveEnrollment" data-id="${app.user_id}">Approve Enrollment</button>`
                    : `<span class="rp-badge green">Officially Enrolled</span>`}
                </td>
              </tr>
            `;
          }).join('') : '<tr><td colspan="5" class="rp-empty">No submitted applications.</td></tr>'}
        </tbody>
      </table>
    </div>
  `;
}

// --- MODAL FOR MANAGING STUDENTS & SUBJECTS ---
export async function adminOpenStudentModal(userId) {
  try {
    const users = await supa('users', { match: { id: userId } });
    const u = users && users[0];
    if (!u) return toast('Student not found.', 'error');

    const apps = await supa('applications', { match: { user_id: userId } });
    const app = (apps && apps[0]) || {};

    const subjects = await supa('student_subjects', { match: { user_id: userId } }).catch(() => []);
    const courses = await supa('courses').catch(() => []);

    const p = app.personal || {};
    const e = app.education || {};
    let pr = app.program || {};
    if (typeof pr === 'string') { try { pr = JSON.parse(pr); } catch (err) {} }

    const fullName = p.first_name
      ? `${p.first_name} ${p.middle_name || ''} ${p.last_name || ''}`.trim()
      : u.name;

    const subjectRows = subjects.map((s) => {
      const c = courses.find((x) => String(x.id) === String(s.course_id));
      return `
        <tr>
          <td><strong>${esc(c ? c.code : '—')}</strong> ${esc(c ? c.title : '')}</td>
          <td>${esc(s.grade || '—')}</td>
          <td class="rp-hint">${esc(s.term || '—')}</td>
          <td><span class="rp-badge ${s.status === 'Passed' ? 'green' : (s.status === 'Failed' ? 'red' : 'gold')}">${esc(s.status)}</span></td>
          <td style="text-align:right">
            <button class="rp-btn rp-btn-danger rp-btn-sm" data-action="adminRemoveSubject" data-id="${s.id}">Delete</button>
          </td>
        </tr>`;
    }).join('');

    // We use a custom function in main.js to build this modal, or just build it here and append to body
    const modalHtml = `
      <div class="rp-modal-backdrop" id="adminModalBackdrop">
        <div class="rp-modal wide">
          <div class="rp-modal-head">
            <h3>Student — ${esc(fullName)}</h3>
            <button class="rp-btn rp-btn-ghost rp-btn-sm" onclick="document.getElementById('adminModalBackdrop').remove()">✕</button>
          </div>
          <div class="rp-modal-body">
            <div class="rp-grid-2" style="margin-bottom:18px">
              <div>
                <h4 style="font-size:12.5px;text-transform:uppercase;letter-spacing:1px;color:var(--muted);margin-bottom:8px">Personal</h4>
                <div style="display:grid;gap:6px;font-size:13.4px">
                  <div><strong>Name:</strong> ${esc(fullName)}</div>
                  <div><strong>Email:</strong> ${esc(p.email || u.email)}</div>
                  <div><strong>Phone:</strong> ${esc(p.phone || '—')}</div>
                  <div><strong>Address:</strong> ${esc(p.address || '—')}</div>
                </div>
              </div>
              <div>
                <h4 style="font-size:12.5px;text-transform:uppercase;letter-spacing:1px;color:var(--muted);margin-bottom:8px">Academic</h4>
                <div style="display:grid;gap:6px;font-size:13.4px">
                  <div><strong>Program ID:</strong> ${esc(pr.preferred || '—')}</div>
                  <div><strong>Application:</strong> ${app.submitted ? '<span class="rp-badge green">Submitted</span>' : '<span class="rp-badge gold">In Progress</span>'}</div>
                  <div><strong>Reference:</strong> ${esc(app.reference || '—')}</div>
                </div>
              </div>
            </div>

            <h4 style="font-size:12.5px;text-transform:uppercase;letter-spacing:1px;color:var(--muted);margin:16px 0 8px">Subjects Taken</h4>
            ${subjectRows ? `
              <div class="rp-table-wrap">
                <table class="rp-table">
                  <thead><tr><th>Course</th><th>Grade</th><th>Term</th><th>Status</th><th></th></tr></thead>
                  <tbody>${subjectRows}</tbody>
                </table>
              </div>` : '<div class="rp-empty" style="padding:14px">No subjects recorded.</div>'}

            <h4 style="font-size:12.5px;text-transform:uppercase;letter-spacing:1px;color:var(--muted);margin:18px 0 8px">Record Completed Subject</h4>
            <form id="adminSubjectForm" style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end">
              <input type="hidden" name="user_id" value="${userId}">
              <div style="flex:2;min-width:200px">
                <label style="font-size:12.4px;font-weight:600;display:block;margin-bottom:5px">Course</label>
                <select class="rp-input" name="course_id" required>
                  ${courses.map((c) => `<option value="${c.id}">${esc(c.code)} — ${esc(c.title)}</option>`).join('')}
                </select>
              </div>
              <div style="width:100px">
                <label style="font-size:12.4px;font-weight:600;display:block;margin-bottom:5px">Grade</label>
                <input class="rp-input" name="grade" placeholder="1.75">
              </div>
              <div style="width:140px">
                <label style="font-size:12.4px;font-weight:600;display:block;margin-bottom:5px">Status</label>
                <select class="rp-input" name="status">
                  <option>Passed</option><option>Failed</option><option>In Progress</option>
                </select>
              </div>
              <button class="rp-btn rp-btn-primary" type="submit">Add Record</button>
            </form>
          </div>
        </div>
      </div>
    `;

    // Remove existing modal if any, then append
    document.getElementById('adminModalBackdrop')?.remove();
    document.body.insertAdjacentHTML('beforeend', modalHtml);

  } catch (err) {
    console.error(err);
    toast('Failed to load student.', 'error');
  }
}
