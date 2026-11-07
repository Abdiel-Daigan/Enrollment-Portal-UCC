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
      <div class="rp-card rp-stat"><div class="ic">👥</div><div><div class="val">${students.length}</div><div class="lbl">Total Students</div></div></div>
      <div class="rp-card rp-stat gold"><div class="ic">✅</div><div><div class="val">${submitted}</div><div class="lbl">Submitted Apps</div></div></div>
      <div class="rp-card rp-stat"><div class="ic">⏳</div><div><div class="val">${pending}</div><div class="lbl">In Progress</div></div></div>
      <div class="rp-card rp-stat gold"><div class="ic">📝</div><div><div class="val">${enrollments.length}</div><div class="lbl">Enrollments</div></div></div>
    </div>
    <div class="rp-card">
      <h3>Welcome to the Admin Portal</h3>
      <p class="rp-hint" style="margin-top:10px;">Use the sidebar to manage students, courses, and approve final enrollments.</p>
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
                <td><span class="rp-badge ${app.status === 'Approved' ? 'green' : (app.submitted ? 'gold' : 'grey')}">${app.status || (app.submitted ? 'Pending' : 'In Progress')}</span></td>
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
  
  // We only want to approve students who have submitted their app and are waiting
  const submittedApps = apps.filter(a => a.submitted);

  return `
    <div class="rp-notice mint">
      <span>ℹ️</span>
      <span>Review final enrollment applications. Faculty must have approved the payment first.</span>
    </div>

    <div class="rp-table-wrap">
      <table class="rp-table">
        <thead><tr><th>Student</th><th>Reference</th><th>Status</th><th style="text-align:right">Actions</th></tr></thead>
        <tbody>
          ${submittedApps.length ? submittedApps.map(app => {
            const u = users.find(x => String(x.id) === String(app.user_id)) || { name: 'Unknown' };
            const isApproved = app.status === 'Approved';
            
            return `
              <tr>
                <td><strong>${esc(u.name)}</strong></td>
                <td>${esc(app.reference || '—')}</td>
                <td><span class="rp-badge ${isApproved ? 'green' : 'gold'}">${esc(app.status || 'Pending')}</span></td>
                <td style="text-align:right">
                  ${!isApproved 
                    ? `<button class="rp-btn rp-btn-primary rp-btn-sm" data-action="adminApproveEnrollment" data-id="${app.user_id}">Final Approve</button>`
                    : `<span class="rp-badge green">Officially Enrolled</span>`}
                </td>
              </tr>
            `;
          }).join('') : '<tr><td colspan="4" class="rp-empty">No submitted applications.</td></tr>'}
        </tbody>
      </table>
    </div>
  `;
}

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
    let pr = app.program || {};
    if (typeof pr === 'string') { try { pr = JSON.parse(pr); } catch (err) {} }

    const fullName = p.first_name ? `${p.first_name} ${p.middle_name || ''} ${p.last_name || ''}`.trim() : u.name;

    const subjectRows = subjects.map((s) => {
      const c = courses.find((x) => String(x.id) === String(s.course_id));
      let badge = '';
      if (s.status === 'Taken') badge = '<span class="rp-badge green">Taken</span>';
      else if (s.status === 'Enrolled') badge = '<span class="rp-badge gold">Enrolled</span>';
      else badge = '<span class="rp-badge grey">Unenrolled</span>';

      return `
        <tr>
          <td><strong>${esc(c ? c.code : '—')}</strong> ${esc(c ? c.title : '')}</td>
          <td>${badge}</td>
          <td style="text-align:right">
            <button class="rp-btn rp-btn-danger rp-btn-sm" data-action="adminRemoveSubject" data-id="${s.id}" data-user="${userId}">Delete</button>
          </td>
        </tr>`;
    }).join('');

    const modalHtml = `
      <div class="rp-modal-backdrop" id="adminModalBackdrop">
        <div class="rp-modal wide">
          <div class="rp-modal-head">
            <h3>Manage Student — ${esc(fullName)}</h3>
            <button class="rp-btn rp-btn-ghost rp-btn-sm" onclick="document.getElementById('adminModalBackdrop').remove()">✕</button>
          </div>
          <div class="rp-modal-body">
            
            <!-- EDIT STUDENT FORM -->
            <h4 style="margin-bottom:10px; font-size:14px; color:var(--mint-800);">Edit Student Details</h4>
            <form id="adminEditStudentForm" style="display:grid; gap:10px; margin-bottom:24px;">
              <input type="hidden" name="user_id" value="${userId}">
              <div class="field-row">
                <div class="field"><label>Full Name</label><input class="rp-input" name="name" value="${esc(u.name)}" required></div>
                <div class="field"><label>Program ID</label><input class="rp-input" name="program_id" value="${esc(pr.preferred || '')}" required></div>
              </div>
              <div class="field-row">
                <div class="field"><label>Email</label><input class="rp-input" name="email" value="${esc(u.email)}" required></div>
                <div class="field"><label>Role (Careful)</label><input class="rp-input" name="role" value="${esc(u.role)}" required></div>
              </div>
              <button type="submit" class="rp-btn rp-btn-primary" style="justify-self: start;">Save Changes</button>
            </form>

            <h4 style="margin-bottom:10px; font-size:14px; color:var(--mint-800);">Manage Subjects</h4>
            <div class="rp-table-wrap" style="margin-bottom: 16px;">
              <table class="rp-table">
                <thead><tr><th>Course</th><th>Status</th><th></th></tr></thead>
                <tbody>${subjectRows || '<tr><td colspan="3" class="rp-empty">No subjects recorded.</td></tr>'}</tbody>
              </table>
            </div>

            <form id="adminSubjectForm" style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;">
              <input type="hidden" name="user_id" value="${userId}">
              <div style="flex:2;min-width:200px">
                <label style="font-size:12.4px;font-weight:600;display:block;margin-bottom:5px">Course</label>
                <select class="rp-input" name="course_id" required>
                  ${courses.map((c) => `<option value="${c.id}">${esc(c.code)} — ${esc(c.title)}</option>`).join('')}
                </select>
              </div>
              <div style="width:140px">
                <label style="font-size:12.4px;font-weight:600;display:block;margin-bottom:5px">Status</label>
                <select class="rp-input" name="status">
                  <option value="Taken">Taken</option>
                  <option value="Enrolled">Enrolled</option>
                  <option value="Unenrolled">Unenrolled</option>
                </select>
              </div>
              <button class="rp-btn rp-btn-primary" type="submit">Add Subject</button>
            </form>

            <div style="margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px; text-align: right;">
              <button type="button" class="rp-btn rp-btn-danger" onclick="window.deleteStudent(${userId})">Delete Student Account</button>
            </div>

          </div>
        </div>
      </div>
    `;

    document.getElementById('adminModalBackdrop')?.remove();
    document.body.insertAdjacentHTML('beforeend', modalHtml);

  } catch (err) {
    console.error(err);
    toast('Failed to load student.', 'error');
  }
}
