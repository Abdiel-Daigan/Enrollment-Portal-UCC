import { esc, toast } from './utils.js';
import { supa } from './api.js';

export async function renderAccountingDashboard() {
  const logs = await supa('payment_logs');
  const apps = await supa('applications');
  
  const totalCollected = logs.reduce((sum, log) => sum + Number(log.amount), 0);
  const onlinePayments = logs.filter(l => l.processed_by === 'Online').length;
  const inPersonPayments = logs.filter(l => l.processed_by === 'Accounting').length;

  return `
    <div class="rp-grid-4">
      <div class="rp-card rp-stat">
        <div class="ic">💰</div>
        <div><div class="val">₱${totalCollected.toLocaleString('en-PH', {minimumFractionDigits:2})}</div><div class="lbl">Total Collected</div></div>
      </div>
      <div class="rp-card rp-stat gold">
        <div class="ic">💳</div>
        <div><div class="val">${onlinePayments}</div><div class="lbl">Online Payments</div></div>
      </div>
      <div class="rp-card rp-stat">
        <div class="ic">🏢</div>
        <div><div class="val">${inPersonPayments}</div><div class="lbl">In-Person Payments</div></div>
      </div>
      <div class="rp-card rp-stat gold">
        <div class="ic">🧾</div>
        <div><div class="val">${logs.length}</div><div class="lbl">Total Transactions</div></div>
      </div>
    </div>
    <div class="rp-card">
      <h3>Accounting Overview</h3>
      <p class="rp-hint" style="margin-top:10px;">Use the sidebar to view payment logs, manage student balances, or update the tuition fee settings.</p>
    </div>
  `;
}

export async function renderAccountingLogs() {
  const logs = await supa('payment_logs');
  const users = await supa('users');
  
  // Sort by newest first
  logs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  return `
    <div class="rp-table-wrap">
      <table class="rp-table">
        <thead>
          <tr><th>Date</th><th>Student</th><th>Reference No.</th><th>Type</th><th>Processed By</th><th style="text-align:right">Amount</th></tr>
        </thead>
        <tbody>
          ${logs.length ? logs.map(log => {
            const u = users.find(x => String(x.id) === String(log.user_id)) || { name: 'Unknown' };
            return `
              <tr>
                <td class="rp-hint">${new Date(log.created_at).toLocaleDateString()}</td>
                <td><strong>${esc(u.name)}</strong></td>
                <td><span class="rp-badge grey">${esc(log.reference_no)}</span></td>
                <td>${esc(log.payment_type)}</td>
                <td><span class="rp-badge ${log.processed_by === 'Online' ? 'green' : 'gold'}">${esc(log.processed_by)}</span></td>
                <td style="text-align:right; font-weight:800; color:var(--mint-700);">₱${Number(log.amount).toLocaleString('en-PH', {minimumFractionDigits:2})}</td>
              </tr>
            `;
          }).join('') : '<tr><td colspan="6" class="rp-empty">No payment logs found.</td></tr>'}
        </tbody>
      </table>
    </div>
  `;
}

export async function renderAccountingSettings() {
  const settingsRes = await supa('system_settings', { match: { id: 1 } });
  const settings = settingsRes[0] || { tuition_per_unit: 444, misc_fee: 5452, reg_fee: 1000 };

  return `
    <div class="rp-card" style="max-width: 600px;">
      <div class="rp-card-head"><h3>Fee Settings</h3></div>
      <p class="rp-hint" style="margin-bottom:20px;">Update the dynamic rates used across the system. Changes will apply to new payment calculations.</p>
      
      <form id="accountingSettingsForm" style="display:flex; flex-direction:column; gap:14px;">
        <div class="field">
          <label>Tuition Fee (per unit)</label>
          <input class="rp-input" type="number" name="tuition_per_unit" value="${settings.tuition_per_unit}" required>
        </div>
        <div class="field">
          <label>Miscellaneous Fees</label>
          <input class="rp-input" type="number" name="misc_fee" value="${settings.misc_fee}" required>
        </div>
        <div class="field">
          <label>Registration Fee</label>
          <input class="rp-input" type="number" name="reg_fee" value="${settings.reg_fee}" required>
        </div>
        <button type="submit" class="rp-btn rp-btn-primary" style="margin-top:10px;">Save Settings</button>
      </form>
    </div>
  `;
}

export async function renderAccountingStudents() {
  const users = await supa('users', { match: { role: 'student' } });
  const apps = await supa('applications');
  const search = (window.accSearch || '').toLowerCase();

  const filtered = users.filter(u => u.name.toLowerCase().includes(search));

  return `
    <div class="rp-toolbar">
      <div class="grow">
        <input class="rp-input" type="text" placeholder="Search student name..." oninput="window.accSearch = this.value" onkeydown="if(event.key==='Enter') window.searchAcc()" value="${esc(search)}">
      </div>
      <button class="rp-btn rp-btn-primary" onclick="window.searchAcc()">Search</button>
    </div>

    <div class="rp-table-wrap">
      <table class="rp-table">
        <thead><tr><th>Student Name</th><th>Email</th><th>Amount Paid</th><th style="text-align:right">Action</th></tr></thead>
        <tbody>
          ${filtered.length ? filtered.map(u => {
            const app = apps.find(a => String(a.user_id) === String(u.id)) || { amount_paid: 0 };
            return `
              <tr>
                <td><strong>${esc(u.name)}</strong></td>
                <td>${esc(u.email)}</td>
                <td style="color:var(--mint-600); font-weight:800;">₱${Number(app.amount_paid || 0).toLocaleString('en-PH', {minimumFractionDigits:2})}</td>
                <td style="text-align:right">
                  <button class="rp-btn rp-btn-primary rp-btn-sm" data-action="accManageStudent" data-id="${u.id}">Manage Payments</button>
                </td>
              </tr>
            `;
          }).join('') : '<tr><td colspan="4" class="rp-empty">No students found.</td></tr>'}
        </tbody>
      </table>
    </div>
  `;
}

export async function accountingManageStudentModal(studentId) {
  const users = await supa('users', { match: { id: studentId } });
  const u = users[0];
  const apps = await supa('applications', { match: { user_id: studentId } });
  const app = apps[0] || { amount_paid: 0 };
  
  const subjects = await supa('student_subjects', { match: { user_id: studentId } });
  const courses = await supa('courses');
  const settingsRes = await supa('system_settings', { match: { id: 1 } });
  const settings = settingsRes[0] || { tuition_per_unit: 444, misc_fee: 5452, reg_fee: 1000 };

  let totalUnits = 0;
  subjects.forEach(s => {
    const c = courses.find(x => String(x.id) === String(s.course_id));
    if (c) totalUnits += Number(c.units);
  });

  const tuition = totalUnits * settings.tuition_per_unit;
  const total = tuition + settings.misc_fee + settings.reg_fee;
  const paid = Number(app.amount_paid || 0);
  const balance = total - paid;

  const modalHtml = `
    <div class="rp-modal-backdrop" id="accStudentModal">
      <div class="rp-modal">
        <div class="rp-modal-head">
          <h3>Process Payment — ${esc(u.name)}</h3>
          <button type="button" class="rp-btn rp-btn-ghost rp-btn-sm" onclick="document.getElementById('accStudentModal').remove()">✕</button>
        </div>
        <div class="rp-modal-body">
          <div class="rp-grid-2" style="margin-bottom:20px;">
            <div class="rp-card" style="background:var(--mint-50);">
              <div class="rp-hint">Total Assessment</div>
              <div style="font-size:20px; font-weight:800; color:var(--mint-800);">₱${total.toLocaleString('en-PH', {minimumFractionDigits:2})}</div>
              <div class="rp-hint" style="margin-top:4px;">(${totalUnits} units + misc + reg)</div>
            </div>
            <div class="rp-card" style="background:var(--mint-50);">
              <div class="rp-hint">Current Balance</div>
              <div style="font-size:20px; font-weight:800; color:${balance <= 0 ? 'var(--mint-600)' : 'var(--danger)'};">₱${balance.toLocaleString('en-PH', {minimumFractionDigits:2})}</div>
            </div>
          </div>

          ${balance > 0 ? `
            <form id="inPersonPaymentForm">
              <input type="hidden" name="user_id" value="${studentId}">
              <input type="hidden" name="total_assessment" value="${total}">
              <input type="hidden" name="current_paid" value="${paid}">
              
              <div class="field">
                <label>Amount Received (₱)</label>
                <input class="rp-input" type="number" name="amount" max="${balance}" min="1" required placeholder="Enter amount...">
              </div>
              <div class="field">
                <label>Payment Type</label>
                <select class="rp-input" name="payment_type" required>
                  <option value="Partial Payment">Partial Payment</option>
                  <option value="Full Payment">Full Payment</option>
                </select>
              </div>
              <button type="submit" class="rp-btn rp-btn-primary" style="margin-top:10px; width:100%;">Record Payment</button>
            </form>
          ` : `
            <div class="rp-notice mint">
              <span>✅</span><span>This student is fully paid.</span>
            </div>
          `}
        </div>
      </div>
    </div>
  `;

  document.getElementById('accStudentModal')?.remove();
  document.body.insertAdjacentHTML('beforeend', modalHtml);
}
