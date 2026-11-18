import { esc, toast, isHistorySubject } from './utils.js';
import { supa } from './api.js';
import { reportCard } from './report.js';

export async function renderAccountingDashboard() {
  const [logs, apps, users, subjects, courses, settingsRes] = await Promise.all([
    supa('payment_logs').catch(() => []),
    supa('applications').catch(() => []),
    supa('users', { match: { role: 'student' } }).catch(() => []),
    supa('student_subjects').catch(() => []),
    supa('courses').catch(() => []),
    supa('system_settings', { match: { id: 1 } }).catch(() => [])
  ]);

  const settings = settingsRes[0] || { tuition_per_unit: 444, misc_fee: 5452, reg_fee: 1000 };
  const totalCollected = logs.reduce((sum, log) => sum + Number(log.amount || 0), 0);
  const onlinePayments = logs.filter(l => l.processed_by === 'Online').length;
  const inPersonPayments = logs.filter(l => l.processed_by === 'Accounting').length;

  const rows = users.map(u => {
    const app = apps.find(a => String(a.user_id) === String(u.id)) || {};
    const load = subjects.filter(s => String(s.user_id) === String(u.id) && !isHistorySubject(s));
    const units = load.reduce((sum, s) => {
      const c = courses.find(x => String(x.id) === String(s.course_id));
      return sum + (c ? Number(c.units) : 0);
    }, 0);
    const assessment = units > 0
      ? (units * Number(settings.tuition_per_unit)) + Number(settings.misc_fee) + Number(settings.reg_fee)
      : 0;
    const paid = Number(app.amount_paid || 0);
    const balance = Math.max(assessment - paid, 0);
    const transactions = logs.filter(l => String(l.user_id) === String(u.id)).length;
    return {
      name: u.name,
      id: u.student_id || '-',
      units,
      assessment,
      paid,
      balance,
      transactions
    };
  });

  const assessed = rows.filter(r => r.assessment > 0);
  const fullyPaid = assessed.filter(r => r.balance <= 0).length;
  const withBalance = assessed.length - fullyPaid;
  const outstanding = assessed.reduce((sum, r) => sum + r.balance, 0);

  const reportRows = rows.map(r => [
    r.name,
    r.id,
    r.units,
    r.assessment.toFixed(2),
    r.paid.toFixed(2),
    r.balance.toFixed(2),
    r.transactions
  ]);

  return `
    <div class="rp-grid-4">
      <div class="rp-card rp-stat">
        <div class="ic">TC</div>
        <div><div class="val">PHP ${totalCollected.toLocaleString('en-PH', {minimumFractionDigits:2})}</div><div class="lbl">Total Collected</div></div>
      </div>
      <div class="rp-card rp-stat gold">
        <div class="ic">TX</div>
        <div><div class="val">${logs.length}</div><div class="lbl">Total Transactions</div></div>
      </div>
      <div class="rp-card rp-stat">
        <div class="ic">OL</div>
        <div><div class="val">${onlinePayments}</div><div class="lbl">Online Payments</div></div>
      </div>
      <div class="rp-card rp-stat gold">
        <div class="ic">CT</div>
        <div><div class="val">${inPersonPayments}</div><div class="lbl">Counter Payments</div></div>
      </div>
    </div>

    <div class="rp-grid-4">
      <div class="rp-card rp-stat"><div class="ic">AS</div><div><div class="val">${assessed.length}</div><div class="lbl">Students Assessed</div></div></div>
      <div class="rp-card rp-stat"><div class="ic">FP</div><div><div class="val">${fullyPaid}</div><div class="lbl">Fully Paid</div></div></div>
      <div class="rp-card rp-stat gold"><div class="ic">WB</div><div><div class="val">${withBalance}</div><div class="lbl">With Balance</div></div></div>
      <div class="rp-card rp-stat gold"><div class="ic">OS</div><div><div class="val">PHP ${outstanding.toLocaleString('en-PH', {minimumFractionDigits:2})}</div><div class="lbl">Outstanding Balance</div></div></div>
    </div>

    <div class="rp-card">
      <h3>Accounting Overview</h3>
      <p class="rp-hint" style="margin-top:10px;">Use the sidebar to view payment logs, manage student balances, or update the tuition fee settings. Assessments use ${Number(settings.tuition_per_unit).toLocaleString('en-PH')} per unit plus ${Number(settings.misc_fee).toLocaleString('en-PH')} miscellaneous and ${Number(settings.reg_fee).toLocaleString('en-PH')} registration fees.</p>
    </div>

    ${reportCard({
      id: 'accounting-balances',
      title: 'Student Assessment and Balance Report',
      hint: 'Assessment per student based on the current fee settings, with payments logged and remaining balance.',
      columns: ['Student', 'Student ID', 'Units', 'Assessment', 'Paid', 'Balance', 'Transactions'],
      rows: reportRows,
      filename: 'ucc-accounting-balances.csv'
    })}

    ${reportCard({
      id: 'accounting-logs',
      title: 'Payment Transactions Report',
      hint: 'Every payment recorded by the portal or the cashier, newest first.',
      columns: ['Date', 'Student', 'Reference No.', 'Type', 'Processed By', 'Amount'],
      rows: logs
        .slice()
        .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
        .map(l => {
          const u = users.find(x => String(x.id) === String(l.user_id)) || { name: 'Unknown' };
          return [
            l.created_at ? new Date(l.created_at).toLocaleDateString('en-PH') : '-',
            u.name,
            l.reference_no || '-',
            l.payment_type || '-',
            l.processed_by || '-',
            Number(l.amount || 0).toFixed(2)
          ];
        }),
      filename: 'ucc-payment-transactions.csv'
    })}
  `;
}

export async function renderAccountingLogs() {
  const logs = await supa('payment_logs').catch(() => []);
  const users = await supa('users').catch(() => []);
  
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
  const settingsRes = await supa('system_settings', { match: { id: 1 } }).catch(() => []);
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
  const users = await supa('users', { match: { role: 'student' } }).catch(() => []);
  const apps = await supa('applications').catch(() => []);
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
  const users = await supa('users', { match: { id: studentId } }).catch(() => []);
  const u = users[0];
  if (!u) return toast('This student could not be loaded.', 'error');
  const apps = await supa('applications', { match: { user_id: studentId } }).catch(() => []);
  const app = apps[0] || { amount_paid: 0 };
  
  // Only subjects the student is currently enrolled in are billed;
  // ones already taken (Passed/Dropped) are history.
  const subjects = (await supa('student_subjects', { match: { user_id: studentId } }).catch(() => []))
    .filter(s => !isHistorySubject(s));
  const courses = await supa('courses').catch(() => []);
  const settingsRes = await supa('system_settings', { match: { id: 1 } }).catch(() => []);
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
              <span>This student is fully paid.</span>
            </div>
          `}
        </div>
      </div>
    </div>
  `;

  document.getElementById('accStudentModal')?.remove();
  document.body.insertAdjacentHTML('beforeend', modalHtml);
}
