// Document checklists per application type. The student and registrar portals
// both read them from here so they always agree on what a complete application
// looks like.
export const DOC_TYPES = {
  freshman: [
    { id: 'form138', name: 'Form 138', required: true },
    { id: 'psa', name: 'PSA Birth Certificate', required: true },
    { id: 'idpic', name: 'ID Photo', required: true },
    { id: 'goodmoral', name: 'Good Moral Certificate', required: true },
    { id: 'exam', name: 'Entrance Exam Result', required: true }
  ],
  transferee: [
    { id: 'transfer_cred', name: 'Transfer Credentials / Honorable Dismissal', required: true },
    { id: 'tor', name: 'Transcript of Records', required: true },
    { id: 'goodmoral_prev', name: 'Good Moral Certificate (Previous School)', required: true },
    { id: 'psa', name: 'PSA Birth Certificate', required: true },
    { id: 'idpic', name: 'ID Photo', required: true }
  ],
  returnee: [
    { id: 'readmission', name: 'Readmission Form', required: true },
    { id: 'clearance', name: 'Clearance from Last Term', required: true },
    { id: 'approval', name: 'School Approval Document', required: false }
  ]
};

export const docsForType = (type) => DOC_TYPES[type] || [];

export const requiredDocIds = (type) => docsForType(type).filter(d => d.required).map(d => d.id);

// Required documents that still have no uploaded file.
export function missingRequiredDocs(app) {
  const uploaded = (app && app.documents) || {};
  return requiredDocIds(app && app.doc_type).filter(id => !uploaded[id]);
}

// The file is on file for this document.
export const docUploaded = (app, id) => !!(app && app.documents && app.documents[id]);

/* Uploading is what completes a document: the file is on record the moment the
   student uploads or replaces it, so there is no per-document review step. The
   Registrar checks the whole set once and confirms it (see status.js), which is
   what releases the student to the Faculty. */
export const docComplete = (app, id) => docUploaded(app, id);

// Every required document has a file. This is what unlocks "Confirm All Documents".
export function requiredDocsComplete(app) {
  const ids = requiredDocIds(app && app.doc_type);
  return ids.length > 0 && ids.every(id => docComplete(app, id));
}

// Every required document has a file. Uploading a file marks it complete right
// away, so this is also the point where the Registrar may confirm the set.
export const docsUploaded = (app) =>
  requiredDocIds(app && app.doc_type).length > 0 && missingRequiredDocs(app).length === 0;

/* The Registrar pressed "Confirm All Documents" (stored in documents_verified).
   Confirming is the one approval step: it issues the student ID, makes the
   student an Enrollee and lets the Faculty assign subjects. */
export const docsConfirmed = (app) => !!(app && app.documents_verified);
