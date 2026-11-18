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

// Every required document has a file. Uploading a file marks it complete right
// away, so this is also the point where the student may confirm the set.
export const docsUploaded = (app) =>
  requiredDocIds(app && app.doc_type).length > 0 && missingRequiredDocs(app).length === 0;

// The student pressed "Confirm All Documents". Only then may the Faculty see
// the student and assign subjects.
export const docsComplete = (app) => !!(app && app.documents_verified);

export const isVisibleToFaculty = (app) =>
  !!(app && app.submitted && !app.returned && docsComplete(app));
