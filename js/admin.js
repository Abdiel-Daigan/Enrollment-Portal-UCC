import { esc, toast } from './utils.js';
import { supa } from './api.js';

function statCard(val, lbl, icon, gold = false) {
  return `
    <div class="rp-card rp-stat ${gold ? 'gold' : ''}">
      <div class="ic">${icon}</div>
      <div>
        <div class="val">${val}</div>
        <div class="lbl">${esc(lbl)}</div>
      </div>
    </div>
  `;
}

export async function renderAdminDashboard() {
  const students = await supa('users', { match: { role: 'student' } });
  const apps = await supa('applications');
  const enrollments = await supa('enrollments');

  const submitted = apps.filter(a => a.submitted).length;
  const pending = students.length - submitted;

  return `
    <div class="rp-grid-4">
      ${statCard(students.length, 'Total Students', '👥')}
      ${statCard(submitted, 'Submitted Apps', '✅', true)}
      ${statCard(pending, 'In Progress', '⏳')}
      ${statCard(enrollments.length, 'Enrollments', '📝', true)}
    </div>
    <div class="rp-card">
      <div class="rp-card-head"><h3>Welcome to the Admin Portal</h3></div>
      <p class="rp-hint" style="margin-bottom: 16px;">Use the sidebar to manage students, review applications, and approve enrollments.</p>
    </div>
  `;
}

export async function renderAdminStudents() {
  const users = await supa('users', { match: { role: 'student' } });
  const apps = await supa('applications');

  return `
    <div class="rp-table-wrap">
      <table class="rp-table">
        <thead><tr><th>Name</th><th>Email</th><th>Application Status</th></tr></thead>
        <tbody>
          ${users.map(u => {
            const app = apps.find(a => String(a.user_id) === String(u.id)) || {};
            return `
              <tr>
                <td><strong>${esc(u.name)}</strong></td>
                <td>${esc(u.email)}</td>
                <td><span class="rp-badge ${app.submitted ? 'green' : 'gold'}">${app.submitted ? 'Submitted' : 'In Progress'}</span></td>
              </tr>
            `;
          }).join('')}
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
        <thead><tr><th>Code</th><th>Title</th><th>Units</th></tr></thead>
        <tbody>
          ${courses.map(c => `
            <tr>
              <td><strong>${esc(c.code)}</strong></td>
              <td>${esc(c.title)}</td>
              <td>${c.units}</td>
            </tr>
          `).join('')}
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
      <span>Approve submitted applications to officially enroll students.</span>
    </div>

    <div class="rp-table-wrap">
      <table class="rp-table">
        <thead><tr><th>Student</th><th>Reference</th><th>Status</th><th>Subjects</th><th style="text-align:right">Actions</th></tr></thead>
        <tbody>
          ${submittedApps.map(app => {
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
                    ? `<button class="rp-btn rp-btn-primary rp-btn-sm" data-action="adminApproveEnrollment" data-id="${app.user_id}">Approve</button>`
                    : `<span class="rp-badge green">Enrolled</span>`}
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}
