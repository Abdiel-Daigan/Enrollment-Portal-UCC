/* =========================================================================
   ADMINMANAGE.JS — Staff and student accounts
   -------------------------------------------------------------------------
   The Admin portal is the only place where staff accounts are created and
   where whole accounts can be removed. Student accounts stay self-service,
   but the Admin can still review, edit and delete them here.
   ========================================================================= */

import { esc, hash } from './utils.js';
import { supa } from './api.js';
import { session } from './auth.js';
import { applicationStatus, statusTone } from './status.js';
import {
  programLabel,
  programOptionsHtml,
  allYearLevels,
  yearLabel
} from './catalog.js';

const STAFF_ROLES = [
  { value: 'registrar', label: 'Registrar' },
  { value: 'accounting', label: 'Accounting' },
  { value: 'faculty', label: 'Faculty' }
];

const roleLabel = (role) => {
  const clean = String(role || '').trim();
  const found = STAFF_ROLES.find(r => r.value === clean);
  if (found) return found.label;
  if (clean === 'admin') return 'Admin';
  if (clean === 'student') return 'Student';
  return clean || '—';
};

export async function renderAdminUsers() {
  const users = await supa('users').catch(() => []);
  // Students have their own tab, so they never show up among the staff.
  const staff = users
    .filter(u => String(u.role || '').trim() !== 'student')
    .sort((a, b) => String(a.role).localeCompare(String(b.role)) || String(a.name).localeCompare(String(b.name)));

  return `
    <div class="rp-grid-2">
      <div class="rp-card" style="align-self:start;">
        <div class="rp-card-head"><h3>Create a Staff Account</h3></div>
        <form id="adminCreateUserForm" style="display:flex; flex-direction:column; gap:12px;">
          <div class="field"><label>Full Name</label><input class="rp-input" name="name" placeholder="e.g. Ms. Ana Reyes" required></div>
          <div class="field"><label>Email</label><input class="rp-input" type="email" name="email" placeholder="name@ucc.edu.ph" required></div>
          <div class="field"><label>Password</label><input class="rp-input" type="password" name="password" placeholder="At least 6 characters" minlength="6" required></div>
          <div class="field">
            <label>Role</label>
            <select class="rp-input" name="role" required>
              ${STAFF_ROLES.map(r => `<option value="${r.value}">${r.label}</option>`).join('')}
            </select>
          </div>
          <button type="submit" class="rp-btn rp-btn-primary" style="margin-top:6px;">Create Account</button>
        </form>
        <p class="rp-hint" style="margin-top:12px;">New students register themselves and are managed in Student Accounts. This form is only for Registrar, Accounting and Faculty staff.</p>
      </div>

      <div class="rp-card">
        <div class="rp-card-head">
          <h3>Staff Accounts</h3>
          <span class="rp-badge green">${staff.length} staff account(s)</span>
        </div>
        <div class="rp-table-wrap">
          <table class="rp-table" style="min-width:0;">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th style="text-align:right">Action</th></tr></thead>
            <tbody>
              ${staff.length ? staff.map(u => {
                const isSelf = String(u.id) === String(session && session.userId);
                return `
                  <tr>
                    <td><strong>${esc(u.name)}</strong></td>
                    <td>${esc(u.email)}</td>
                    <td><span class="rp-badge green">${esc(roleLabel(u.role))}</span></td>
                    <td style="text-align:right">
                      ${isSelf
                        ? '<span class="rp-hint">This is you</span>'
                        : `<button class="rp-btn rp-btn-danger rp-btn-sm" data-action="adminDeleteUser" data-id="${u.id}">Delete</button>`}
                    </td>
                  </tr>
                `;
              }).join('') : '<tr><td colspan="4" class="rp-empty">No staff accounts found.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

/* Student accounts, searchable and filtered by program, year level and
   enrollment status. Manage opens the same student window the Registrar uses,
   and Delete removes the account together with every record it owns. */
export async function renderStudentAccounts() {
  const [users, apps] = await Promise.all([
    supa('users').catch(() => []),
    supa('applications').catch(() => [])
  ]);

  const searchQ = String(window.adminStudentSearch || '').trim().toLowerCase();
  const filterProg = window.adminStuFilterProg || '';
  const filterYear = window.adminStuFilterYear || '';
  const filterStatus = window.adminStuFilterStatus || '';

  const rows = users
    .filter(u => String(u.role || '').trim() === 'student')
    .map((u) => {
      const app = apps.find(a => String(a.user_id) === String(u.id)) || {};
      let pr = app.program || {};
      if (typeof pr === 'string') { try { pr = JSON.parse(pr); } catch (e) { pr = {}; } }
      return { u, app, program: pr };
    })
    .filter(({ u, app, program }) => {
      if (searchQ) {
        const haystack = `${u.name || ''} ${u.email || ''} ${u.student_id || ''}`.toLowerCase();
        if (!haystack.includes(searchQ)) return false;
      }
      if (filterProg && String(program.preferred) !== String(filterProg)) return false;
      if (filterYear && String(program.year_level) !== String(filterYear)) return false;
      if (filterStatus && applicationStatus(app) !== filterStatus) return false;
      return true;
    })
    .sort((a, b) => String(a.u.name).localeCompare(String(b.u.name)));

  const statusOptions = ['In Progress', 'Applicant', 'Documents Complete', 'Enrollee', 'Enrolled', 'Returned'];

  return `
    <div class="rp-toolbar" style="gap: 10px; flex-wrap: wrap;">
      <div class="grow" style="min-width: 200px;">
        <form id="adminStudentSearchForm" style="display:flex; gap:8px;">
          <input class="rp-input" type="text" id="adminStudentSearchInput" placeholder="Search name, email or student ID, then press Enter..." value="${esc(window.adminStudentSearch || '')}">
          <button type="submit" class="rp-btn rp-btn-primary">Search</button>
        </form>
      </div>
      <div style="width: 160px;">
        <select class="rp-input" data-change="adminStuFilterProg">
          ${programOptionsHtml(filterProg, { all: true, allValue: '', allLabel: 'All Programs' })}
        </select>
      </div>
      <div style="width: 140px;">
        <select class="rp-input" data-change="adminStuFilterYear">
          <option value="">All Years</option>
          ${allYearLevels().map(y => `<option value="${y}" ${String(filterYear) === String(y) ? 'selected' : ''}>${esc(yearLabel(y))}</option>`).join('')}
        </select>
      </div>
      <div style="width: 180px;">
        <select class="rp-input" data-change="adminStuFilterStatus">
          <option value="">All Statuses</option>
          ${statusOptions.map(s => `<option value="${esc(s)}" ${filterStatus === s ? 'selected' : ''}>${esc(s)}</option>`).join('')}
        </select>
      </div>
    </div>

    <div class="rp-table-wrap">
      <table class="rp-table">
        <thead><tr><th>Student</th><th>Student ID</th><th>Email</th><th>Program</th><th>Year</th><th>Status</th><th style="text-align:right">Actions</th></tr></thead>
        <tbody>
          ${rows.length ? rows.map(({ u, app, program }) => {
            const status = applicationStatus(app);
            return `
              <tr>
                <td><strong>${esc(u.name)}</strong></td>
                <td>${esc(u.student_id || '—')}</td>
                <td>${esc(u.email || '')}</td>
                <td><span class="rp-badge green">${esc(programLabel(program.preferred, 'Not set'))}</span></td>
                <td>${program.year_level ? esc(yearLabel(program.year_level)) : '—'}</td>
                <td><span class="rp-badge ${statusTone(status)}">${esc(status)}</span></td>
                <td style="text-align:right; white-space:nowrap;">
                  <button class="rp-btn rp-btn-primary rp-btn-sm" data-action="adminOpenRecord" data-id="${u.id}">Manage</button>
                  <button class="rp-btn rp-btn-danger rp-btn-sm" data-action="adminDeleteUser" data-id="${u.id}" data-name="${esc(u.name)}">Delete</button>
                </td>
              </tr>
            `;
          }).join('') : '<tr><td colspan="7" class="rp-empty">No student accounts match this search.</td></tr>'}
        </tbody>
      </table>
    </div>
  `;
}

// Creates a staff account with the same password hashing the login uses.
export async function createStaffUser({ name, email, password, role }) {
  const cleanName = String(name || '').trim();
  const cleanEmail = String(email || '').trim().toLowerCase();
  const cleanRole = String(role || '').trim();

  if (!cleanName || !cleanEmail) throw new Error('Name and email are required.');
  if (String(password || '').length < 6) throw new Error('Password must be at least 6 characters.');
  if (!STAFF_ROLES.some(r => r.value === cleanRole)) throw new Error('Choose a valid staff role.');

  const existing = await supa('users', { match: { email: cleanEmail } }).catch(() => []);
  if (existing.length) throw new Error('That email is already registered.');

  await supa('users', {
    method: 'POST',
    body: { name: cleanName, email: cleanEmail, password_hash: hash(password), role: cleanRole }
  });
}
