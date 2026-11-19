import { docsComplete, docsUploaded, requiredDocsComplete } from './documents.js';

/* The enrollment status is derived from the application fields so every portal
   shows the same label:
     In Progress        -> the student is still filling the application out
     Applicant          -> submitted, required documents not all complete yet
     Documents Complete -> every required document complete, waiting for the Registrar
     Enrollee           -> accepted by the Registrar (and given a student ID)
     Enrolled           -> accepted and a payment has been recorded
     Returned           -> the Registrar sent the application back

   A document is complete only when the Registrar pressed Complete for it (see
   documents.js). Accepting is what enrols the student, and because a document
   can still be undone, the acceptance follows the documents: undoing one drops
   the student back to Applicant and unlocks the Accept button again. */
export function applicationStatus(app) {
  if (!app) return 'In Progress';
  // Rows approved before document confirmation existed stay enrolled.
  if (app.status === 'Approved') return 'Enrolled';
  if (app.returned) return 'Returned';
  if (!app.submitted) return 'In Progress';
  if (isAccepted(app)) return Number(app.amount_paid || 0) > 0 ? 'Enrolled' : 'Enrollee';
  if (!docsComplete(app) || !requiredDocsComplete(app)) return 'Applicant';
  return 'Documents Complete';
}

/* The Registrar pressed "Accept Student", which records the acceptance in the
   status column. The acceptance only holds while every required document stays
   complete, so undoing a document takes the student out of Enrollee/Enrolled. */
export function isAccepted(app) {
  if (!app || !app.submitted || app.returned) return false;
  const status = String(app.status || '').trim();
  if (status === 'Approved') return true;
  if (!requiredDocsComplete(app)) return false;
  return status === 'Enrollee' || status === 'Enrolled';
}

// The Accept Student button is only available once every required document is
// uploaded and marked complete; until then it is shown greyed out.
export function canAccept(app) {
  if (!app || !app.submitted || app.returned) return false;
  if (isAccepted(app)) return false;
  return requiredDocsComplete(app);
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

// Why the Accept Student button cannot be pressed, in one short sentence.
export function acceptBlockReason(app) {
  if (!app || !app.submitted) return 'The student has not submitted the application yet.';
  if (app.returned) return 'This application was returned to the student.';
  if (isAccepted(app)) return 'This student is already accepted.';
  if (!docsUploaded(app)) return 'Some required documents have not been uploaded yet.';
  if (!requiredDocsComplete(app)) return 'Some required documents still need to be marked complete.';
  return '';
}
