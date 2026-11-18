import { esc, isHistorySubject } from './utils.js';
import { supa } from './api.js';
import { docsComplete } from './registrar.js';
import { decodePrereqSet } from './prereqs.js';
import { reportCard } from './report.js';
import { isMetaRow, getPrograms, programLabel } from './catalog.js';

export async function renderAdminDashboard() {
  const [students, apps, courses, presetRows, subjectRows, logRows] = await Promise.all([
    supa('users', { match: { role: 'student' } }).catch(() => []),
    supa('applications').catch(() => []),
    supa('courses').catch(() => []),
    supa('presets').catch(() => []),
    supa('student_subjects').catch(() => []),
    supa('payment_logs').catch(() => [])
  ]);

  const presets = presetRows.filter(p => !isMetaRow(p));
  const prereqSets = presetRows.map(decodePrereqSet).filter(Boolean);
  const submitted = apps.filter(a => a.submitted && !a.returned);
  const verified = submitted.filter(docsComplete).length;
  const enrolled = apps.filter(a => a.status === 'Approved').length;
  const verifiedStudentIds = new Set(submitted.filter(docsComplete).map(a => String(a.user_id)));
  const withSubjects = new Set(subjectRows.filter(s => !isHistorySubject(s)).map(s => String(s.user_id)));
  const loadedUnits = subjectRows
    .filter(s => !isHistorySubject(s))
    .reduce((sum, s) => {
      const c = courses.find(x => String(x.id) === String(s.course_id));
      return sum + (c ? Number(c.units) : 0);
    }, 0);
  const collected = logRows.reduce((sum, l) => sum + Number(l.amount || 0), 0);

  const programRows = getPrograms().filter(p => !p.general).map((p) => {
    const ofProgram = apps.filter(a => {
      let pr = a.program || {};
      if (typeof pr === 'string') { try { pr = JSON.parse(pr); } catch (e) { pr = {}; } }
      return String(pr.preferred) === String(p.id);
    });
    return [
      p.code,
      ofProgram.length,
      ofProgram.filter(a => a.submitted && !a.returned).length,
      ofProgram.filter(docsComplete).length,
      ofProgram.filter(a => a.status === 'Approved').length
    ];
  });

  const rosterRows = students.map(u => {
    const app = apps.find(a => String(a.user_id) === String(u.id)) || {};
    let pr = app.program || {};
    if (typeof pr === 'string') { try { pr = JSON.parse(pr); } catch (e) { pr = {}; } }
    const load = subjectRows.filter(s => String(s.user_id) === String(u.id) && !isHistorySubject(s));
    const units = load.reduce((sum, s) => {
      const c = courses.find(x => String(x.id) === String(s.course_id));
      return sum + (c ? Number(c.units) : 0);
    }, 0);
    return [
      u.name,
      u.student_id || '-',
      programLabel(pr.preferred, 'Not set'),
      pr.year_level ? 'Year ' + pr.year_level : '-',
      app.status === 'Approved' ? 'Enrolled' : (app.submitted ? 'Applicant' : 'In Progress'),
      app.doc_type ? (docsComplete(app) ? 'Complete' : 'Incomplete') : 'No checklist',
      load.length,
      units,
      Number(app.amount_paid || 0).toFixed(2)
    ];
  });

  const paymentRows = students.map(u => {
    const app = apps.find(a => String(a.user_id) === String(u.id)) || {};
    const logs = logRows.filter(l => String(l.user_id) === String(u.id));
    const paid = logs.reduce((sum, l) => sum + Number(l.amount || 0), 0);
    const last = logs.slice().sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))[0];
    return [
      u.name,
      u.student_id || '-',
      logs.length,
      paid.toFixed(2),
      Number(app.amount_paid || 0).toFixed(2),
      last ? new Date(last.created_at).toLocaleDateString('en-PH') : '-'
    ];
  });

  return `
    <div class="rp-grid-4">
      <div class="rp-card rp-stat"><div class="ic">ST</div><div><div class="val">${students.length}</div><div class="lbl">Total Students</div></div></div>
      <div class="rp-card rp-stat gold"><div class="ic">SA</div><div><div class="val">${submitted.length}</div><div class="lbl">Submitted Applications</div></div></div>
      <div class="rp-card rp-stat"><div class="ic">DV</div><div><div class="val">${verified}</div><div class="lbl">Documents Verified</div></div></div>
      <div class="rp-card rp-stat gold"><div class="ic">EN</div><div><div class="val">${enrolled}</div><div class="lbl">Officially Enrolled</div></div></div>
    </div>

    <div class="rp-grid-4">
      <div class="rp-card rp-stat"><div class="ic">SB</div><div><div class="val">${courses.length}</div><div class="lbl">Subjects</div></div></div>
      <div class="rp-card rp-stat"><div class="ic">PR</div><div><div class="val">${presets.length}</div><div class="lbl">Presets</div></div></div>
      <div class="rp-card rp-stat"><div class="ic">PQ</div><div><div class="val">${prereqSets.length}</div><div class="lbl">Prerequisite Sequences</div></div></div>
      <div class="rp-card rp-stat gold"><div class="ic">LO</div><div><div class="val">${withSubjects.size}</div><div class="lbl">Students With Subject Load</div></div></div>
    </div>

    <div class="rp-grid-2">
      <div class="rp-card">
        <div class="rp-card-head"><h3>Enrollment Summary by Program</h3></div>
        <div class="rp-table-wrap">
          <table class="rp-table" style="min-width:0;">
            <thead><tr><th>Program</th><th>Students</th><th>Submitted</th><th>Verified</th><th>Enrolled</th></tr></thead>
            <tbody>
              ${programRows.map(r => `<tr><td><strong>${esc(r[0])}</strong></td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td><td>${r[4]}</td></tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
      <div class="rp-card">
        <div class="rp-card-head"><h3>System Totals</h3></div>
        <div class="rp-mini-grid">
          <div><span>Units on student loads</span><strong>${loadedUnits}</strong></div>
          <div><span>Students verified and waiting for subjects</span><strong>${verifiedStudentIds.size}</strong></div>
          <div><span>Payments collected</span><strong>PHP ${collected.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</strong></div>
          <div><span>Payment transactions</span><strong>${logRows.length}</strong></div>
        </div>
      </div>
    </div>

    ${reportCard({
      id: 'admin-roster',
      title: 'Enrollment Roster Report',
      hint: 'All students with program, application status, document verification and subject load.',
      columns: ['Student', 'Student ID', 'Program', 'Year', 'Status', 'Documents', 'Subjects', 'Units', 'Amount Paid'],
      rows: rosterRows,
      filename: 'ucc-enrollment-roster.csv'
    })}

    ${reportCard({
      id: 'admin-payments',
      title: 'Payment Summary Report',
      hint: 'Payments recorded per student, including the most recent transaction date.',
      columns: ['Student', 'Student ID', 'Transactions', 'Total Logged', 'Application Paid', 'Last Payment'],
      rows: paymentRows,
      filename: 'ucc-payment-summary.csv'
    })}
  `;
}
