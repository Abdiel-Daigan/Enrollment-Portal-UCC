/* =========================================================================
   ADMINMANAGE.JS — Staff accounts and raw application records
   -------------------------------------------------------------------------
   The Admin portal is the only place where staff accounts are created and
   where whole records can be removed. Student accounts stay self-service.
   ========================================================================= */

import { esc, hash } from './utils.js';
import { supa } from './api.js';
import { session } from './auth.js';
import { applicationStatus, statusTone } from './status.js';
import { programLabel } from './catalog.js';

const STAFF_ROLES = [
  { value: 'registrar', label: 'Registrar' },
  { value: 'accounting', label: 'Accounting' },
  { value: 'faculty', label: 'Faculty' }
];

const roleLabel = (role) => {
  const found = STAFF_ROLES.find(r => r.value === role);
  if (found) return found.label;
  if (role === 'admin') return 'Admin';
  if (role === 'student') return 'Student';
  return role || '—';
};

export async function renderAdminUsers() {
  const users = await supa('users').catch(() => []);
  const sorted = users.slice().sort((a, b) => String(a.role).localeCompare(String(b.role)) || String(a.name).localeCompare(String(b.name)));

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
        <p class="rp-hint" style="margin-top:12px;">New students register themselves. This form is only for Registrar, Accounting and Faculty staff.</p>
      </div>

      <div class="rp-card">
        <div class="rp-card-head">
          <h3>Accounts</h3>
          <span class="rp-badge green">${sorted.length} user(s)</span>
        </div>
        <div class="rp-table-wrap">
          <table class="rp-table">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th style="text-align:right">Action</th></tr></thead>
            <tbody>
              ${sorted.length ? sorted.map(u => {
                const isSelf = String(u.id) === String(session && session.userId);
                return `
                  <tr>
                    <td><strong>${esc(u.name)}</strong>${u.student_id ? `<div class="rp-hint">${esc(u.student_id)}</div>` : ''}</td>
                    <td>${esc(u.email)}</td>
                    <td><span class="rp-badge ${u.role === 'student' ? 'grey' : 'green'}">${esc(roleLabel(u.role))}</span></td>
                    <td style="text-align:right">
                      ${isSelf
                        ? '<span class="rp-hint">This is you</span>'
                        : `<button class="rp-btn rp-btn-danger rp-btn-sm" data-action="adminDeleteUser" data-id="${u.id}">Delete</button>`}
                    </td>
                  </tr>
                `;
              }).join('') : '<tr><td colspan="4" class="rp-empty">No accounts found.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

/* Raw application records, including ones the Registrar screens hide (returned
   or still in progress). This is where the Admin can remove a record outright. */
export async function renderAdminRecords() {
  const [apps, users] = await Promise.all([
    supa('applications').catch(() => []),
    supa('users').catch(() => [])
  ]);

  const rows = apps
    .map(app => ({ app, user: users.find(u => String(u.id) === String(app.user_id)) || {} }))
    .filter(r => r.user.name)
    .sort((a, b) => String(a.user.name).localeCompare(String(b.user.name)));

  return `
    <div class="rp-notice info" style="margin-bottom:16px;">
      <span>Every application row in the database, including returned and unfinished ones. Deleting a record removes the application and its subject/payment records for that student.</span>
    </div>

    <div class="rp-table-wrap">
      <table class="rp-table">
        <thead><tr><th>Student</th><th>Program</th><th>Status</th><th>Submitted</th><th>Paid</th><th style="text-align:right">Actions</th></tr></thead>
        <tbody>
          ${rows.length ? rows.map(({ app, user }) => {
            let pr = app.program || {};
            if (typeof pr === 'string') { try { pr = JSON.parse(pr); } catch (e) { pr = {}; } }
            const status = applicationStatus(app);
            return `
              <tr>
                <td><strong>${esc(user.name)}</strong><div class="rp-hint">${esc(user.email || '')}</div></td>
                <td>${esc(programLabel(pr.preferred, 'Not set'))}</td>
                <td><span class="rp-badge ${statusTone(status)}">${esc(status)}</span></td>
                <td>${app.submitted ? 'Yes' : 'No'}</td>
                <td>₱${Number(app.amount_paid || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                <td style="text-align:right; white-space:nowrap;">
                  <button class="rp-btn rp-btn-primary rp-btn-sm" data-action="adminOpenRecord" data-id="${app.user_id}">Manage</button>
                  <button class="rp-btn rp-btn-danger rp-btn-sm" data-action="adminDeleteRecord" data-id="${app.user_id}" data-name="${esc(user.name)}">Delete</button>
                </td>
              </tr>
            `;
          }).join('') : '<tr><td colspan="6" class="rp-empty">No application records found.</td></tr>'}
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
