import { esc, isHistorySubject } from './utils.js';
import { supa } from './api.js';
import { decodePrereqSet, hydratePrereqSets, evaluatePrerequisites, missingLabel } from './prereqs.js';
import { reportCard } from './report.js';
import { isMetaRow, programLabel, programOptionsHtml, courseMatchesProgram, findUnitLimit, getAcademicTerm, SEMESTERS } from './catalog.js';
import { isVisibleToFaculty } from './documents.js';
import { applicationStatus } from './status.js';

export async function renderFacultyDashboard() {
  const [students, apps, courses, subjectRows, presetRows] = await Promise.all([
    supa('users', { match: { role: 'student' } }).catch(() => []),
    supa('applications').catch(() => []),
    supa('courses').catch(() => []),
    supa('student_subjects').catch(() => []),
    supa('presets').catch(() => [])
  ]);

  const verified = apps.filter(isVisibleToFaculty).length;
  const assigned = new Set(subjectRows.filter(s => !isHistorySubject(s)).map(s => String(s.user_id)));
  const passed = subjectRows.filter(s => String(s.remarks || '').trim() === 'Passed').length;
  const prereqSets = presetRows.map(decodePrereqSet).filter(Boolean);

  const rows = students.map(u => {
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
      load.length,
      units,
      applicationStatus(app)
    ];
  });

  return `
    <div class="rp-grid-4">
      <div class="rp-card rp-stat"><div class="ic">ST</div><div><div class="val">${students.length}</div><div class="lbl">Total Students</div></div></div>
      <div class="rp-card rp-stat gold"><div class="ic">RD</div><div><div class="val">${verified}</div><div class="lbl">Ready for Subjects</div></div></div>
      <div class="rp-card rp-stat"><div class="ic">AS</div><div><div class="val">${assigned.size}</div><div class="lbl">With Subjects Assigned</div></div></div>
      <div class="rp-card rp-stat gold"><div class="ic">PS</div><div><div class="val">${passed}</div><div class="lbl">Subjects Passed on Record</div></div></div>
    </div>
    <div class="rp-grid-2">
      <div class="rp-card">
        <h3>College Department</h3>
        <p class="rp-hint" style="margin-top:10px;">Go to <strong>Check Students</strong> to assign subjects. Only students who have confirmed their documents appear here.</p>
      </div>
      <div class="rp-card">
        <h3>Prerequisite Sequences</h3>
        <p class="rp-hint" style="margin-top:10px;">${prereqSets.length} sequence(s) are enforced when subjects are added. Subjects that break a sequence are flagged in red and cannot be confirmed.</p>
      </div>
    </div>

    ${reportCard({
      id: 'faculty-load',
      title: 'Student Subject Load Report',
      hint: 'Subjects currently assigned per student, with units and application status.',
      columns: ['Student', 'Student ID', 'Program', 'Year', 'Subjects Assigned', 'Units', 'Status'],
      rows,
      filename: 'ucc-faculty-subject-load.csv'
    })}
  `;
}

export async function renderFacultyProgress() {
  const students = await supa('users', { match: { role: 'student' } }).catch(() => []);
  if (!students.length) return `<div class="rp-empty">No students found.</div>`;

  const courses = await supa('courses').catch(() => []);
  const subjects = await supa('student_subjects').catch(() => []);
  const apps = await supa('applications').catch(() => []);
  const presets = await supa('presets').catch(() => []);
  const presetSubs = await supa('preset_subjects').catch(() => []);
  // Prerequisite sequences are stored in the presets table with a marker name.
  const prereqSets = hydratePrereqSets(presets.map(decodePrereqSet).filter(Boolean), courses);

  const searchQ = (window.facultySearch || '').toLowerCase();
  const filterYear = window.facultyFilterYear || '';
  const filterProg = window.facultyFilterProg || '';

  const filteredStudents = students.filter(u => {
    const app = apps.find(a => String(a.user_id) === String(u.id)) || {};
    let pr = app.program || {};
    if (typeof pr === 'string') { try { pr = JSON.parse(pr); } catch(e){} }
    
    // 1. Basic Filters
    const nameMatch = searchQ ? (u.name.toLowerCase().includes(searchQ) || (u.student_id && u.student_id.toLowerCase().includes(searchQ))) : true;
    const yearMatch = filterYear ? String(pr.year_level) === String(filterYear) : true;
    const progMatch = filterProg ? String(pr.preferred) === String(filterProg) : true;
    
    // 2. Only students who submitted their application and confirmed every
    //    required document are visible to the Faculty.
    return isVisibleToFaculty(app) && nameMatch && yearMatch && progMatch;
  });

  if (window.facultySelectedStudent) {
    const student = students.find(s => String(s.id) === String(window.facultySelectedStudent));
    if (student) {
      const app = apps.find(a => String(a.user_id) === String(student.id)) || {};
      let pr = app.program || {};
      if (typeof pr === 'string') { try { pr = JSON.parse(pr); } catch(e){} }
      const progId = pr ? pr.preferred : null;
      const progName = progId ? programLabel(progId) : 'No Program';
      const isRegular = app.is_regular !== false;
      
      const programCourses = courses.filter(c => courseMatchesProgram(c, progId));
      const allRecorded = subjects.filter(s => String(s.user_id) === String(student.id));
      // Subjects the Registrar already graded (Passed/Dropped) are history, not current load
      const completedSubjects = allRecorded.filter(isHistorySubject);
      const taken = allRecorded.filter(s => !isHistorySubject(s));

      const confirmedIds = taken.map(t => String(t.course_id));
      const completedIds = completedSubjects.map(t => String(t.course_id));
      const tempIds = window.tempStudentSubjects.map(t => String(t.courseId));

      const availableToAdd = programCourses.filter(c =>
        !confirmedIds.includes(String(c.id)) &&
        !completedIds.includes(String(c.id)) &&
        !tempIds.includes(String(c.id))
      );

      // The Registrar's current term decides which presets may be offered.
      const term = getAcademicTerm();
      const matchingPresets = presets.filter(p =>
        !isMetaRow(p)
        && String(p.program_id) === String(progId)
        && String(p.year_level) === String(pr.year_level)
        && String(p.semester) === String(term.semester)
      );

      // Prerequisite check for the pending list: a subject may only be added when
      // everything before it in its sequence is passed already or also pending.
      const passedIds = completedSubjects
        .filter(c => String(c.remarks || '').trim() === 'Passed')
        .map(c => c.course_id);

      const prereqProblems = evaluatePrerequisites({
        selectedIds: window.tempStudentSubjects.map(s => s.courseId),
        passedIds,
        sets: prereqSets,
        courses
      });

      const prereqErrors = [...prereqProblems.entries()].map(([courseId, missing]) => {
        const c = courses.find(x => String(x.id) === String(courseId));
        return `${c ? c.code : 'Subject'} — ${missingLabel(missing)}`;
      });

      // Unit limit configured by the Registrar for this program/year/semester.
      // The faculty selector starts on the term the Registrar set.
      const semester = SEMESTERS.includes(window.facultySemester) ? window.facultySemester : term.semester;
      const isPaid = Number(app.amount_paid || 0) > 0;
      const unitLimit = findUnitLimit(progId, pr.year_level, semester);
      const takenUnits = taken.reduce((sum, t) => {
        const c = courses.find(x => String(x.id) === String(t.course_id));
        return sum + (c ? Number(c.units) : 0);
      }, 0);
      const pendingUnits = window.tempStudentSubjects.reduce((sum, s) => sum + (Number(s.units) || 0), 0);
      const plannedUnits = takenUnits + pendingUnits;
      const overLimit = !!unitLimit && plannedUnits > unitLimit.maxUnits;

      return `
        <div class="rp-toolbar" style="margin-bottom: 20px;">
          <button class="rp-btn rp-btn-ghost" onclick="window.closeFacultyStudent()">← Back to List</button>
        </div>

        <div class="rp-card" style="margin-bottom: 20px; background:var(--mint-50);">
          <div class="rp-card-head" style="margin-bottom:0">
            <div>
              <h3>${esc(student.name)} <span class="rp-hint">(${esc(student.student_id || 'No ID')})</span></h3>
              <div class="rp-hint">${esc(student.email)} · ${progName} - Year ${esc(pr.year_level || '?')}</div>
            </div>
            <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
              <label style="font-size:12.5px;font-weight:600;">Status:</label>
              <select class="rp-input" data-change="facultyRegularity" data-student="${student.id}" style="width:120px; padding:6px 10px;">
                <option value="true" ${isRegular ? 'selected' : ''}>Regular</option>
                <option value="false" ${!isRegular ? 'selected' : ''}>Irregular</option>
              </select>
              <label style="font-size:12.5px;font-weight:600;">Semester:</label>
              <select class="rp-input" data-change="facultySemester" style="width:150px; padding:6px 10px;">
                ${SEMESTERS.map(s => `<option value="${esc(s)}" ${semester === s ? 'selected' : ''}>${esc(s)}</option>`).join('')}
              </select>
            </div>
          </div>
        </div>

        <div class="rp-grid-2">
          <div class="rp-card" style="display:flex; flex-direction:column;">
            <div class="rp-card-head">
              <h3>Pre-Confirmed List</h3>
              <span class="rp-hint">${window.tempStudentSubjects.length} subject(s) · ${plannedUnits}${unitLimit ? ' / ' + unitLimit.maxUnits : ''} units</span>
            </div>
            
            <div id="tempSubjectList" style="flex:1;">
              ${window.tempStudentSubjects.length ? window.tempStudentSubjects.map((s, idx) => {
                const missing = prereqProblems.get(String(s.courseId));
                return `
                <div class="prereq-row ${missing ? 'invalid' : ''}">
                  <div>
                    <div style="font-size:13.5px; font-weight:600;">${esc(s.code)} — ${esc(s.title)}</div>
                    <div class="rp-hint">${s.units} units</div>
                    ${missing ? `<div class="prereq-error">${esc(missingLabel(missing))}</div>` : ''}
                  </div>
                  <button type="button" class="rp-btn rp-btn-danger rp-btn-sm" onclick="window.removeTempSubject(${idx})">✕</button>
                </div>
              `; }).join('') : '<div class="rp-empty" style="padding:20px 0;">No subjects pre-confirmed yet.</div>'}
            </div>

            ${prereqErrors.length ? `
              <div class="rp-notice red" style="margin-top:14px;">
                <div>
                  <strong>Prerequisite sequence is broken</strong>
                  <ul class="prereq-error-list">${prereqErrors.map(msg => `<li>${esc(msg)}</li>`).join('')}</ul>
                  <div class="rp-hint">Add the missing subject in sequence, or remove the subjects that cannot be taken yet.</div>
                </div>
              </div>
            ` : ''}

            ${overLimit ? `
              <div class="rp-notice red" style="margin-top:14px;">
                <div>
                  <strong>Unit limit exceeded</strong>
                  <div class="rp-hint" style="color:inherit;">
                    ${esc(progName)} · Year ${esc(pr.year_level || '?')} · ${esc(semester)} allows a maximum of ${unitLimit.maxUnits} units.
                    This load is ${plannedUnits} units (${plannedUnits - unitLimit.maxUnits} over).
                  </div>
                  <div class="rp-hint">Remove subjects from the list, or ask the Registrar to raise the limit in Unit Limits.</div>
                </div>
              </div>
            ` : ''}

            <button type="button" class="rp-btn rp-btn-primary" style="margin-top: 16px; width: 100%; display: ${window.tempStudentSubjects.length ? 'block' : 'none'};" id="btnConfirmSubjects" onclick="window.confirmStudentSubjects('${student.id}')">
              Confirm Subjects
            </button>
          </div>

          <div class="rp-card">
            <div class="rp-card-head"><h3>Add Subjects</h3></div>

            <div class="rp-notice info" style="margin-bottom:14px;">
              <span>Current term: <strong>${esc(term.semester)}</strong> · S.Y. ${esc(term.schoolYear)}. Only ${esc(term.semester)} presets are offered here.</span>
            </div>
            
            ${matchingPresets.length ? `
              <div style="margin-bottom: 20px; background:var(--mint-100); padding: 14px; border-radius: 10px;">
                <div style="font-size:13px; font-weight:700; margin-bottom:6px; color:var(--mint-800)">Available Presets</div>
                ${matchingPresets.map(mp => {
                  const subCount = presetSubs.filter(ps => String(ps.preset_id) === String(mp.id)).length;
                  return `
                    <div style="display:flex; justify-content:space-between; align-items:center; background:#fff; padding:10px 14px; border-radius:8px; margin-bottom:8px; box-shadow:0 2px 5px rgba(0,0,0,0.05);">
                      <div>
                        <div style="font-weight:600; font-size:13.5px;">${esc(mp.name)}</div>
                        <div class="rp-hint">${subCount} subjects</div>
                      </div>
                      <button type="button" class="rp-btn rp-btn-primary rp-btn-sm" data-action="facultyLoadPresetToTemp" data-preset="${mp.id}">Add to List</button>
                    </div>
                  `;
                }).join('')}
              </div>
            ` : ''}

            <form id="facultyAddSubjectForm" style="display:flex; gap:10px; flex-direction: column;">
              <input type="hidden" name="student_id" value="${student.id}">
              <select class="rp-input" name="course_id" required>
                <option value="">Select a course to add manually...</option>
                ${availableToAdd.map(c => `<option value="${c.id}">${esc(c.code)} — ${esc(c.title)} (${c.units} units)</option>`).join('')}
              </select>
              <button type="button" class="rp-btn rp-btn-ghost" style="justify-content: center; border: 1px dashed var(--mint-500);" onclick="window.tempAddSubject('${student.id}')">Add to List</button>
            </form>
          </div>
        </div>

        <div class="rp-card" style="margin-top: 20px;">
          <div class="rp-card-head">
            <h3>Subjects to be added</h3>
            <span class="rp-badge green">${taken.length} subject(s)</span>
          </div>
          ${isPaid ? `<p class="rp-hint" style="margin-bottom:8px;">This student has already paid, so the assigned subjects can no longer be removed here.</p>` : ''}
          ${taken.length ? taken.map(t => {
            const c = courses.find(x => String(x.id) === String(t.course_id));
            return `
              <div style="display:flex;justify-content:space-between;padding:12px 0;border-bottom:1px solid #eee; align-items: center;">
                <div>
                  <div style="font-size:13.5px;font-weight:600">${esc(c ? c.code : '')} — ${esc(c ? c.title : '')}</div>
                  <div class="rp-hint">${c ? c.units : 0} units · ${c ? c.schedule_day + ' ' + c.schedule_time : ''}</div>
                </div>
                <div style="display:flex; gap: 8px; align-items: center;">
                  <span class="rp-badge ${isPaid ? 'green' : 'gold'}">${isPaid ? 'Paid' : 'Pending Payment'}</span>
                  ${isPaid
                    ? '<span class="rp-hint">Locked</span>'
                    : `<button class="rp-btn rp-btn-danger rp-btn-sm" data-action="facultyRemoveSubject" data-id="${t.id}" data-student="${student.id}">✕</button>`}
                </div>
              </div>
            `;
          }).join('') : '<div class="rp-empty">No subjects added to the student yet.</div>'}
        </div>

        ${completedSubjects.length ? `
        <div class="rp-card" style="margin-top: 20px;">
          <div class="rp-card-head">
            <h3>Subjects Already Taken</h3>
            <span class="rp-badge grey">${completedSubjects.length} subject(s)</span>
          </div>
          ${completedSubjects.map(t => {
            const c = courses.find(x => String(x.id) === String(t.course_id)) || {};
            const remarks = String(t.remarks || '');
            return `
              <div style="display:flex;justify-content:space-between;padding:12px 0;border-bottom:1px solid #eee; align-items:center;">
                <div>
                  <div style="font-size:13.5px;font-weight:600">${esc(c.code || '—')} — ${esc(c.title || 'Unknown subject')}</div>
                  <div class="rp-hint">${esc(c.units || '—')} units · Grade: ${esc(t.grade || '—')}</div>
                </div>
                <span class="rp-badge ${remarks === 'Passed' ? 'green' : 'red'}">${esc(remarks || '—')}</span>
              </div>
            `;
          }).join('')}
        </div>` : ''}
      `;
    }
  }

  return `
    <div class="rp-toolbar" style="gap: 10px; flex-wrap: wrap;">
      <div class="grow" style="min-width: 250px;">
        <form id="facultySearchForm" style="display:flex; gap:8px;">
          <input class="rp-input" type="text" id="facultySearchInput" placeholder="Search name or student ID, then press Enter..." value="${esc(window.facultySearch || '')}">
          <button type="submit" class="rp-btn rp-btn-primary">Search</button>
        </form>
      </div>
      <div style="width: 150px;">
        <select class="rp-input" data-change="facultyFilterYear">
          <option value="">All Years</option>
          <option value="1" ${filterYear === '1' ? 'selected' : ''}>1st Year</option>
          <option value="2" ${filterYear === '2' ? 'selected' : ''}>2nd Year</option>
          <option value="3" ${filterYear === '3' ? 'selected' : ''}>3rd Year</option>
          <option value="4" ${filterYear === '4' ? 'selected' : ''}>4th Year</option>
        </select>
      </div>
      <div style="width: 150px;">
        <select class="rp-input" data-change="facultyFilterProg">
          ${programOptionsHtml(filterProg, { all: true, allValue: '' })}
        </select>
      </div>
    </div>

    <div class="rp-notice info" style="margin-bottom: 16px;">
      <span>Only students who have <strong>confirmed their documents</strong> appear here.</span>
    </div>

    <div class="rp-table-wrap">
      <table class="rp-table">
        <thead><tr><th>Student Name</th><th>Student ID</th><th>Program</th><th>Year</th><th style="text-align:right">Action</th></tr></thead>
        <tbody>
          ${filteredStudents.length ? filteredStudents.map(u => {
            const app = apps.find(a => String(a.user_id) === String(u.id)) || {};
            let pr = app.program || {};
            if (typeof pr === 'string') { try { pr = JSON.parse(pr); } catch(e){} }
            const progName = programLabel(pr.preferred);
            
            return `
              <tr>
                <td><strong>${esc(u.name)}</strong></td>
                <td>${esc(u.student_id || '—')}</td>
                <td><span class="rp-badge green">${progName}</span></td>
                <td>Year ${esc(pr.year_level || '?')}</td>
                <td style="text-align:right">
                  <button class="rp-btn rp-btn-primary rp-btn-sm" data-action="facultyManageStudent" data-id="${u.id}">Manage Student</button>
                </td>
              </tr>
            `;
          }).join('') : '<tr><td colspan="5" class="rp-empty">No verified students found.</td></tr>'}
        </tbody>
      </table>
    </div>
  `;
}
