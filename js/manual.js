/* =========================================================================
   USER MANUAL
   -------------------------------------------------------------------------
   A short, role-specific guide shown as its own tab in the Faculty, Registrar
   and Accounting portals. The text is static; it only explains the screens and
   rules the portal actually enforces, so keep it in step with those screens.
   ========================================================================= */

const MANUALS = {
  faculty: {
    title: 'Faculty User Manual',
    intro: 'The Faculty portal is where subject loads are given to students. You can see how each student is doing and add the subjects they will take for the current term.',
    quick: [
      'Open <strong>Check Students</strong> from the sidebar.',
      'Pick a student with <strong>Manage Student</strong>.',
      'Add the subjects, then press <strong>Confirm Subjects</strong>.'
    ],
    sections: [
      {
        title: 'Dashboard',
        intro: 'A quick count of the whole College Department, plus the subject load report.',
        steps: [
          '<strong>Total Students</strong> — every student account in the portal.',
          '<strong>Ready for Subjects</strong> — students the Registrar has already accepted.',
          '<strong>With Subjects Assigned</strong> — students who already have a load this term.',
          '<strong>Subjects Passed on Record</strong> — subject records the Registrar marked as Passed.',
          'Download the <strong>Student Subject Load Report</strong> as a CSV file with the button on that report.'
        ]
      },
      {
        title: 'Check Students — finding a student',
        intro: 'Only students the Registrar has accepted are listed here, because subjects can only be given after acceptance.',
        steps: [
          'Type a name or student ID in the search box and press <strong>Search</strong> (or Enter).',
          'Narrow the list with the <strong>All Years</strong> and <strong>All Programs</strong> filters.',
          'Press <strong>Manage Student</strong> on the row of the student you need.',
          'The student window shows the student\'s name, program, year level and current load. Use <strong>Back to List</strong> to return.'
        ]
      },
      {
        title: 'Check Students — assigning subjects',
        intro: 'The right card is <strong>Add Subjects</strong>. You can start from a preset or add subjects one by one.',
        steps: [
          '<strong>From a preset:</strong> presets that match the student\'s program, year level and the current Academic Term appear under <strong>Available Presets</strong>. Press <strong>Add to List</strong> to copy all of its subjects into the pending list.',
          '<strong>One at a time:</strong> use <strong>Find a subject</strong> to search by code or title, then press <strong>Add</strong> on the subject you want.',
          'Check the pending list on the left. Remove anything you do not want with its remove button.',
          'Press <strong>Confirm Subjects</strong> to save the load. The student immediately sees these subjects in their portal, and Accounting can assess them.'
        ]
      },
      {
        title: 'Rules the portal checks for you',
        steps: [
          'Subjects must belong to the student\'s program and to their year level or a lower one, so a student cannot be given a subject from a higher year level.',
          'A subject already passed or already in the load cannot be added twice.',
          'Subjects inside a prerequisite sequence must follow its order. A subject that breaks the order is flagged in red and the load cannot be confirmed until it is fixed.',
          'Each program and year level has a maximum number of units set by the Registrar in <strong>Unit Limits</strong>. If the load goes over it, a warning shows the allowed units; remove some subjects or ask the Registrar to raise the limit.',
          'A load that has already been paid for is frozen here. Ask the Registrar to make corrections to a paid load.'
        ]
      }
    ],
    notes: [
      'Nothing is saved until you press <strong>Confirm Subjects</strong>. Closing the student window or going back to the list discards the pending subjects.',
      'Adding subjects does not collect payment. Send the student to the Accounting Department, or let them pay online from their Payment tab.',
      'If a student you expect is missing from Check Students, their documents are not complete yet or the Registrar has not accepted them.'
    ]
  },

  registrar: {
    title: 'Registrar User Manual',
    intro: 'The Registrar portal keeps the student records and the curriculum: students, documents, programs, subjects, presets, prerequisites and the academic term.',
    quick: [
      'Open <strong>Student Management</strong> and press <strong>Manage</strong> on a student.',
      'In the <strong>Documents</strong> tab, mark each uploaded document <strong>Complete</strong>.',
      'When every required document is complete, press <strong>Accept Student</strong> in the footer.'
    ],
    sections: [
      {
        title: 'Student Management — the list',
        steps: [
          'Filter the list by <strong>Program</strong>, <strong>Year</strong> and <strong>Status</strong>, and search by name or student ID.',
          '<strong>Manage</strong> opens the student window with four tabs: <strong>Documents</strong>, <strong>Course(s) Taken</strong>, <strong>Student Record</strong> and <strong>Registration Form</strong>.',
          'The <strong>Registration Form</strong> tab only appears after the student is accepted, because the form is issued at acceptance.',
          'The footer holds the <strong>Accept Student</strong> button and a short note explaining what still blocks acceptance. Press <strong>Done</strong> to close the window.'
        ]
      },
      {
        title: 'Completing documents and accepting a student',
        steps: [
          'In the <strong>Documents</strong> tab, open each uploaded file to check it.',
          'Press <strong>Complete</strong> on a document once it is valid. The status is saved right away.',
          'Pressed by mistake? The same button becomes <strong>Undo</strong>; press it to send the document back to the student. A document with no upload has no button, so it must be uploaded first.',
          '<strong>Accept Student</strong> stays greyed out until every required document is Complete. The note beside it names the missing documents or the reason it is blocked.',
          'Press <strong>Accept Student</strong>. The application is accepted, a student ID (UCC-YYYY-####) is issued if the student has none, and the Faculty can now assign subjects.',
          'Undoing a document after acceptance asks for confirmation. Confirming pulls the student back out of the accepted list (status returns to Documents Complete) so they can be accepted again once the document is settled.'
        ],
        tip: 'The student uploads the file. The Registrar only reviews it — uploading a document again resets it to awaiting review.'
      },
      {
        title: 'Student Record — editing the details',
        steps: [
          'Open the <strong>Student Record</strong> tab inside the student window.',
          'Every detail can be changed: name, student ID, contact number, address, program, year level, and the guardian and previous-school fields.',
          'Changing the program reloads the year level choices for that program.',
          'Press <strong>Save Record</strong>. The change applies immediately across the student, Faculty and Accounting portals.'
        ]
      },
      {
        title: 'Course(s) Taken — credited subjects',
        steps: [
          'Use this tab for subjects already credited to the student, such as transferee or previously taken subjects.',
          'Pick a subject, set the units and remarks (for example Passed), then save it to the record.',
          'These subjects count as history: they are not billed by Accounting and do not appear as the student\'s current load.',
          'Removing a paid subject asks for confirmation first, because it changes a paid enrollment.'
        ]
      },
      {
        title: 'Programs',
        steps: [
          'Create a degree program with its code and name.',
          'Edit or delete a program from its row. Programs are used by everything else: subjects, presets, unit limits and student records.'
        ]
      },
      {
        title: 'Unit Limits',
        steps: [
          'Set the maximum number of units a program allows for each year level.',
          'Faculty see this limit when they build a load, and a warning appears when a load goes over it.',
          'Raise a limit when a student needs an overload.'
        ]
      },
      {
        title: 'Academic Term',
        steps: [
          'Set the current <strong>Semester</strong> and <strong>School Year</strong>, then press <strong>Save Current Term</strong>.',
          'This is the term students see on their registration form, and the only term the Faculty can load presets from.',
          'The presets card lists the presets for the current semester. Filter it by <strong>program</strong> and <strong>year level</strong> to find one quickly.'
        ]
      },
      {
        title: 'Preset Subjects',
        steps: [
          'Press <strong>Create New Preset</strong> and give it a name, program, year level and semester.',
          'Add the subjects that belong to that preset, then save.',
          'Filter the list by program, year level and semester. <strong>Edit</strong> or <strong>Delete</strong> a preset from its row.',
          'Faculty load a preset into a student\'s list in one press, so keep presets matched to the real curriculum.'
        ]
      },
      {
        title: 'Prerequisite Subjects',
        steps: [
          'Press <strong>Create New Prerequisite Set</strong> and choose the program it applies to.',
          'Add the subjects in the order they must be taken; the arrows show the sequence.',
          'Save the set. The Faculty portal then enforces that order and refuses a load that skips a subject.',
          'Filter the list by program, and edit or delete a set from its row.'
        ]
      },
      {
        title: 'Manage Subjects',
        intro: 'The subject catalog used by presets, prerequisites, loads and fees.',
        steps: [
          'On the left, create a subject: course code, units, the programs it is offered to (one, several, or General for all) and its schedule day and time.',
          'On the right, the <strong>Subject List</strong> can be filtered by <strong>program</strong>, <strong>day</strong> and <strong>time of day</strong> (Morning before 12:00, Afternoon 12:00–17:00, Evening from 17:00).',
          'Use <strong>Edit</strong> to change a subject and <strong>✕</strong> to delete it.'
        ]
      }
    ],
    notes: [
      'Acceptance depends on the documents only. Subjects are assigned by the Faculty after acceptance, so a student can be accepted with no load yet.',
      'The portal saves each action as you press it — document statuses, records and presets do not need a separate save at the top of the page.',
      'Deleting a program, preset or subject that students already use can leave records without their labels. Prefer editing over deleting once a term is running.'
    ]
  },

  accounting: {
    title: 'Accounting User Manual',
    intro: 'The Accounting portal handles assessments, counter payments and the fee rates used across the portal.',
    quick: [
      'Check the <strong>Fee Settings</strong> first so assessments use the correct rates.',
      'Open <strong>Student Payments</strong>, search the student and press <strong>Manage Payments</strong>.',
      'Enter the amount received and press <strong>Record Payment</strong>.'
    ],
    sections: [
      {
        title: 'Dashboard',
        intro: 'Collection totals and the financial state of every assessed student.',
        steps: [
          'The first row shows <strong>Total Collected</strong>, <strong>Total Transactions</strong>, <strong>Online Payments</strong> (paid by the student) and <strong>Counter Payments</strong> (recorded here).',
          'The second row shows <strong>Students Assessed</strong>, <strong>Fully Paid</strong>, <strong>With Balance</strong> and the <strong>Outstanding Balance</strong> in pesos.',
          'The <strong>Student Assessment and Balance Report</strong> and the <strong>Payment Transactions Report</strong> can each be downloaded as a CSV file.'
        ]
      },
      {
        title: 'Payment Logs',
        steps: [
          'Every receipt is listed newest first, with the date, student, reference number, payment type, who processed it and the amount.',
          'The <strong>Delete</strong> button removes a receipt. This also removes it from the student\'s Payment tab and lowers the amount paid on their record, so only delete a wrong entry.'
        ]
      },
      {
        title: 'Student Payments',
        steps: [
          'Search a student by name, then press <strong>Manage Payments</strong>.',
          'The window shows the <strong>Total Assessment</strong> and the <strong>Current Balance</strong>. The assessment is units × tuition per unit, plus the miscellaneous and registration fees. A student with no subject load has no assessment yet.',
          'Enter the <strong>Amount Received</strong>, choose <strong>Partial Payment</strong> or <strong>Full Payment</strong>, and press <strong>Record Payment</strong>.',
          'The receipt appears in Payment Logs, the balance updates, and the student sees the payment in their own Payment tab.',
          'Once the Registrar has accepted the student, the <strong>Registration Form</strong> tab shows the Accounting copy of their form for checking and printing.'
        ],
        tip: 'A fully paid student shows a green notice instead of the payment form. If the load later changes, the assessment and balance change with it.'
      },
      {
        title: 'Fee Settings',
        steps: [
          'Set the <strong>Tuition Fee (per unit)</strong>, <strong>Miscellaneous Fees</strong> and <strong>Registration Fee</strong>.',
          'Press <strong>Save Settings</strong>.',
          'The new rates apply to assessments calculated from then on. Payments already recorded keep their original amounts.'
        ]
      }
    ],
    notes: [
      'Accounting does not create or change subject loads. If an assessment looks wrong, check the student\'s load with the Faculty or Registrar first.',
      'Online payments are recorded by the student from their portal and appear here as <strong>Online</strong>. Counter payments recorded here appear as <strong>Accounting</strong>.',
      'Deleting a payment log cannot be undone — the receipt has to be recorded again.'
    ]
  }
};

const stepsHtml = (steps) => `<ol class="manual-steps">${steps.map(step => `<li>${step}</li>`).join('')}</ol>`;

const sectionHtml = (section) => `
  <div class="rp-card manual-sec">
    <h3>${section.title}</h3>
    ${section.intro ? `<p class="rp-hint" style="margin-top:6px;">${section.intro}</p>` : ''}
    ${section.steps ? stepsHtml(section.steps) : ''}
    ${section.tip ? `<div class="manual-tip"><strong>Tip:</strong> ${section.tip}</div>` : ''}
  </div>
`;

export function renderUserManual(role) {
  const manual = MANUALS[role] || MANUALS.faculty;

  return `
    <div class="rp-card manual-hero">
      <div class="rp-card-head"><h3>${manual.title}</h3></div>
      <p class="manual-intro">${manual.intro}</p>
      <div class="manual-quick">
        <strong>Your first steps</strong>
        ${stepsHtml(manual.quick)}
      </div>
    </div>

    <div class="manual-grid">
      ${manual.sections.map(sectionHtml).join('')}
    </div>

    <div class="rp-card manual-sec" style="margin-bottom:0;">
      <h3>Good to know</h3>
      <ul class="manual-notes">${manual.notes.map(note => `<li>${note}</li>`).join('')}</ul>
    </div>
  `;
}
