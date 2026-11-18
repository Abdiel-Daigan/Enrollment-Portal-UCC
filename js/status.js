import { docsComplete } from './documents.js';

// The enrollment status is derived from the application fields so every portal
// shows the same label:
//   In Progress -> the student is still filling the application out
//   Applicant   -> submitted, documents not confirmed yet
//   Enrollee    -> documents confirmed, subjects not paid yet
//   Enrolled    -> documents confirmed and a payment has been recorded
//   Returned    -> the Registrar sent the application back
export function applicationStatus(app) {
  if (!app) return 'In Progress';
  // Rows approved before document confirmation existed stay enrolled.
  if (app.status === 'Approved') return 'Enrolled';
  if (app.returned) return 'Returned';
  if (!app.submitted) return 'In Progress';
  if (!docsComplete(app)) return 'Applicant';
  return Number(app.amount_paid || 0) > 0 ? 'Enrolled' : 'Enrollee';
}

export const isEnrolled = (app) => applicationStatus(app) === 'Enrolled';
export const isEnrollee = (app) => applicationStatus(app) === 'Enrollee';

export function statusTone(label) {
  if (label === 'Enrolled' || label === 'Enrollee') return 'green';
  if (label === 'Returned') return 'red';
  if (label === 'In Progress') return 'grey';
  return 'gold';
}
