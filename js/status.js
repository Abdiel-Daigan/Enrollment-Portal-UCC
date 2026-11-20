import { requiredDocsComplete, docsConfirmed } from './documents.js';

/* The enrollment status is derived from the application fields so every portal
   shows the same label:
     In Progress        -> the student is still filling the application out
     Applicant          -> submitted, required documents not all uploaded yet
     Documents Complete -> every required document uploaded, waiting for the Registrar
     Enrollee           -> the Registrar confirmed the documents (and issued a student ID)
     Enrolled           -> confirmed and a payment has been recorded
     Returned           -> the Registrar sent the application back

   A document is complete as soon as it is uploaded (see documents.js). The
   Registrar then confirms the whole set in one action, and confirming is what
   releases the student to the Faculty. */
export function applicationStatus(app) {
  if (!app) return 'In Progress';
  // Rows approved before document confirmation existed stay enrolled.
  if (app.status === 'Approved') return 'Enrolled';
  if (app.returned) return 'Returned';
  if (!app.submitted) return 'In Progress';
  if (isConfirmed(app)) return Number(app.amount_paid || 0) > 0 ? 'Enrolled' : 'Enrollee';
  if (requiredDocsComplete(app)) return 'Documents Complete';
  return 'Applicant';
}

/* The Registrar pressed "Confirm All Documents", recorded in documents_verified.
   Rows confirmed before this change carry the same meaning in the status column,
   so both are accepted. */
export function isConfirmed(app) {
  if (!app || !app.submitted || app.returned) return false;
  const status = String(app.status || '').trim();
  if (status === 'Enrollee' || status === 'Enrolled' || status === 'Approved') return true;
  return docsConfirmed(app);
}

// "Confirm All Documents" is only available once every required file is uploaded
// and the application has not been confirmed yet.
export function canConfirmDocuments(app) {
  if (!app || !app.submitted || app.returned) return false;
  if (isConfirmed(app)) return false;
  return requiredDocsComplete(app);
}

// Faculty may only load subjects for a student the Registrar has confirmed.
export const isVisibleToFaculty = (app) => ['Enrollee', 'Enrolled'].includes(applicationStatus(app));

export const isEnrolled = (app) => applicationStatus(app) === 'Enrolled';
export const isEnrollee = (app) => applicationStatus(app) === 'Enrollee';

// A registration form only exists for a student whose documents are confirmed,
// so the Registrar/Accounting/Admin copies are hidden until then.
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

// Why the Confirm All Documents button cannot be pressed, in one short sentence.
export function confirmBlockReason(app) {
  if (!app || !app.submitted) return 'The student has not submitted the application yet.';
  if (app.returned) return 'This application was returned to the student.';
  if (isConfirmed(app)) return 'The documents are already confirmed.';
  if (!requiredDocsComplete(app)) return 'Some required documents have not been uploaded yet.';
  return '';
}
