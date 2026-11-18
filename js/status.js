import { docsComplete, docsUploaded } from './documents.js';

/* The enrollment status is derived from the application fields so every portal
   shows the same label:
     In Progress        -> the student is still filling the application out
     Applicant          -> submitted, required documents not all uploaded
     Documents Complete -> every document uploaded, waiting for the Registrar
     Enrollee           -> accepted by the Registrar (and given a student ID)
     Enrolled           -> accepted and a payment has been recorded
     Returned           -> the Registrar sent the application back

   Uploading the last document no longer enrols anybody: the Registrar accepts
   the student with the Accept Student button, and that acceptance is what the
   status records from then on. */
export function applicationStatus(app) {
  if (!app) return 'In Progress';
  // Rows approved before document confirmation existed stay enrolled.
  if (app.status === 'Approved') return 'Enrolled';
  if (app.returned) return 'Returned';
  if (!app.submitted) return 'In Progress';
  if (!docsComplete(app)) return 'Applicant';
  if (!isAccepted(app)) return 'Documents Complete';
  return Number(app.amount_paid || 0) > 0 ? 'Enrolled' : 'Enrollee';
}

/* The Registrar pressed "Accept Student", which records the acceptance in the
   status column. "Documents Complete" is the waiting state, so it is the one
   status that is confirmed documents without acceptance. */
export function isAccepted(app) {
  if (!app || !app.submitted || app.returned) return false;
  if (!app.documents_verified) return false;
  return String(app.status || '').trim() !== 'Documents Complete';
}

// The Accept Student button is only available once every required document is
// on file; until then it is shown greyed out and cannot be pressed.
export function canAccept(app) {
  if (!app || !app.submitted || app.returned) return false;
  if (isAccepted(app)) return false;
  return docsUploaded(app);
}

// Faculty may only load subjects for a student the Registrar has accepted.
export const isVisibleToFaculty = (app) => ['Enrollee', 'Enrolled'].includes(applicationStatus(app));

export const isEnrolled = (app) => applicationStatus(app) === 'Enrolled';
export const isEnrollee = (app) => applicationStatus(app) === 'Enrollee';

// A registration form only exists for a student who is actually enrolled in a
// program, so the Registrar/Accounting/Admin copies are hidden until then.
export function hasRegistrationForm(app) {
  const status = applicationStatus(app);
  return status === 'Enrollee' || status === 'Enrolled';
}

export function statusTone(label) {
  if (label === 'Enrolled' || label === 'Enrollee') return 'green';
  if (label === 'Returned') return 'red';
  if (label === 'In Progress') return 'grey';
  return 'gold';
}
