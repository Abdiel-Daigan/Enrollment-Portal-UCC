import { esc, toast } from './utils.js';
import { supa } from './api.js';

// Helper to map IDs to Program Names
const PROGRAMS = {
  '1': 'BEEd',
  '2': 'BSEd',
  '8': 'BSCS'
};

export async function renderFacultyDashboard() {
  const students = await supa('users', { match: { role: 'student' } });
  const apps = await supa('applications');
  const courses = await supa('courses');
  
  const submitted = apps.filter(a => a.submitted).length;

  return `
    <div class="rp-grid-4">
      <div class="rp-card rp-stat"><div class="ic">👥</div><div><div class="val">${students.length}</div><div class="lbl">Total Students</div></div></div>
      <div class="rp-card rp-stat gold"><div class="ic">✅</div><div><div class="val">${submitted}</div><div class="lbl">Applications Submitted</div></div></div>
      <div class="rp-card rp-stat"><div class="ic">📚</div><div><div class="val">${courses.length}</div><div class="lbl">Total Subjects</div></div></div>
    </div>
    <div class="rp-card">
      <h3>College Department</h3>
      <p class="rp-hint" style="margin-top:10px;">Go to <strong>Check Students</strong> to assign subjects, or <strong>Manage Subjects</strong> to update the curriculum.</p>
    </div>
  `;
}

export async function renderFacultyProgress() {
  const students = await supa('users', { match: { role: 'student' } });
  if (!students.length) return `<div class="rp-empty">No students found.</div>`;

  const courses = await supa('courses');
  const subjects = await supa('student_subjects');
  const apps = await supa('applications');

  // Read filter/search states
  const searchQ = (window.facultySearch || '').toLowerCase();
  const filterYear = window.facultyFilterYear || '';
  const filterProg = window.facultyFilterProg || '';

  // Filter the students list
  let filteredStudents = students.filter(u => {
    const app = apps.find(a => String(a.user_id) === String(u.id)) || {};
    let pr = app.program || {};
    if (typeof pr === 'string') { try { pr = JSON.parse(pr); } catch(e){} }
    
    const nameMatch = u.name.toLowerCase().includes(searchQ) || (u.student_id && u.student_id.toLowerCase().includes(searchQ));
    const yearMatch = filterYear ? String(pr.year_level) === String(filterYear) : true;
    const progMatch = filterProg ? String(pr.preferred) === String(filterProg) : true;
    
    return nameMatch && yearMatch && progMatch;
  });

  const selectedId = window.facultyStudent || (filteredStudents[0] ? filteredStudents[0].id : null);
  const student = filteredStudents.find(s => String(s.id) === String(selectedId)) || filteredStudents[0];

  return `
    <div class="rp-toolbar" style="gap: 10px; flex-wrap: wrap;">
      <div class="grow" style="min-width: 200px;">
        <input class="rp-input" type="text" placeholder="Search name or student ID..." data-change="facultySearch" value="${esc(window.facultySearch || '')}">
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
          <option value="">All Programs</option>
          <option value="1" ${filterProg === '1' ? 'selected' : ''}>BEEd</option>
          <option value="2" ${filterProg === '2' ? 'selected' : ''}>BSEd</option>
          <option value="8" ${filterProg === '8' ? 'selected' : ''}>BSCS</option>
        </select>
      </div>
    </div>

    ${!student ? `
      <div class="rp-empty">No students match your search criteria.</div>
    ` : (() => {
      const app = apps.find(a => String(a.user_id) === String(student.id)) || {};
      let pr = app.program || {};
      if (typeof pr === 'string') { try { pr = JSON.parse(pr); } catch(e){} }
      const progId = pr ? pr.preferred : null;
      const progName = progId ? (PROGRAMS[progId] || 'Unknown') : 'No Program';
      
      const programCourses = progId ? courses.filter(c => String(c.program_id) === String(progId)) : courses;
      const taken = subjects.filter(s => String(s.user_id) === String(student.id));
      const takenIds = taken.map(t => String(t.course_id));
      const availableToAdd = programCourses.filter(c => !takenIds.includes(String(c.id)));

      return `
        <div class="rp-card" style="margin-bottom: 20px;">
          <div class="rp-card-head">
            <div>
              <h3>${esc(student.name)} <span class="rp-hint">(${esc(student.student_id || 'No ID')})</span></h3>
              <div class="rp-hint">${esc(student.email)} · ${progName} - Year ${esc(pr.year_level || '?')}</div>
            </div>
            <span class="rp-badge ${app.submitted ? 'green' : 'gold'}">${app.submitted ? 'Application Submitted' : 'In Progress'}</span>
          </div>
        </div>

        <div class="rp-grid-2">
          <div class="rp-card">
            <div class="rp-card-head"><h3>📚 Current Subjects</h3></div>
            ${taken.length ? taken.map(t => {
              const c = courses.find(x => String(x.id) === String(t.course_id));
              let badge = '';
              if (t.status === 'Taken') badge = '<span class="rp-badge green">Taken</span>';
              else if (t.status === 'Enrolled') badge = '<span class="rp-badge gold">Enrolled (Pending Payment)</span>';
              else badge = `<span class="rp-badge grey">${esc(t.status)}</span>`;

              return `
                <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #eee; align-items: center;">
                  <div>
                    <div style="font-size:13.2px;font-weight:600">${esc(c ? c.code : '')} — ${esc(c ? c.title : '')}</div>
                    <div class="rp-hint">${c ? c.units : 0} units · ${esc(c ? c.schedule : '')}</div>
                  </div>
                  <div style="display:flex; gap: 8px; align-items: center;">
                    ${badge}
                    ${t.status === 'Enrolled' ? `
                      <button class="rp-btn rp-btn-primary rp-btn-sm" data-action="facultyApproveSubject" data-id="${t.id}" data-student="${student.id}">Approve Payment</button>
                    ` : ''}
                    <button class="rp-btn rp-btn-danger rp-btn-sm" data-action="facultyRemoveSubject" data-id="${t.id}" data-student="${student.id}">✕</button>
                  </div>
                </div>
              `;
            }).join('') : '<div class="rp-empty">No subjects assigned yet.</div>'}
          </div>

          <div class="rp-card">
            <div class="rp-card-head"><h3>➕ Add Subject</h3></div>
            
            ${availableToAdd.length ? `
              <form id="facultyAddSubjectForm" style="display:flex; gap:10px; flex-direction: column;">
                <input type="hidden" name="student_id" value="${student.id}">
                <select class="rp-input" name="course_id" required>
                  <option value="">Select a course to add...</option>
                  ${availableToAdd.map(c => `<option value="${c.id}">${esc(c.code)} — ${esc(c.title)} (${c.units} units)</option>`).join('')}
                </select>
                <select class="rp-input" name="status" required>
                  <option value="Enrolled">Enrolled (Waiting for Payment)</option>
                  <option value="Taken">Taken (Already Passed)</option>
                </select>
                <button type="submit" class="rp-btn rp-btn-primary" style="justify-content: center;">Add Subject</button>
              </form>
            ` : `
              <div class="rp-empty">
                <span class="big">✅</span>
                No subjects available to add.<br>
                <span style="font-size:12px; margin-top:5px; display:block; color:var(--muted);">
                  All subjects for this program have been assigned.
                </span>
              </div>
            `}
          </div>
        </div>
      `;
    })()}
  `;
}

export async function renderFacultyCourses() {
  const courses = await supa('courses');
  
  return `
    <div class="rp-grid-2">
      <div class="rp-card">
        <div class="rp-card-head"><h3>➕ Create New Subject</h3></div>
        <form id="facultyCreateCourseForm" style="display:flex; flex-direction: column; gap: 10px;">
          <div class="field-row">
            <div class="field"><label>Course Code</label><input class="rp-input" name="code" placeholder="e.g. BSCS-101" required></div>
            <div class="field"><label>Units</label><input class="rp-input" type="number" name="units" value="3" required></div>
          </div>
          <div class="field"><label>Title</label><input class="rp-input" name="title" placeholder="Introduction to Computing" required></div>
          <div class="field-row">
            <div class="field"><label>Schedule</label><input class="rp-input" name="schedule" placeholder="e.g. MWF 08:00-09:00" required></div>
            <div class="field">
              <label>Program</label>
              <select class="rp-input" name="program_id" required>
                <option value="1">BEEd (Elementary Education)</option>
                <option value="2">BSEd (Secondary Education)</option>
                <option value="8">BSCS (Computer Science)</option>
              </select>
            </div>
          </div>
          <button type="submit" class="rp-btn rp-btn-primary" style="margin-top: 10px; justify-content: center;">Create Subject</button>
        </form>
      </div>

      <div class="rp-card">
        <div class="rp-card-head"><h3>📚 All Subjects</h3></div>
        <div class="rp-table-wrap" style="max-height: 400px; overflow-y: auto;">
          <table class="rp-table">
            <thead><tr><th>Code</th><th>Title</th><th>Program</th><th>Units</th><th>Schedule</th><th style="text-align:right">Action</th></tr></thead>
            <tbody>
              ${courses.length ? courses.map(c => {
                const pName = PROGRAMS[c.program_id] || 'Unknown';
                return `
                <tr>
                  <td><strong>${esc(c.code)}</strong></td>
                  <td>${esc(c.title)}</td>
                  <td><span class="rp-badge green">${pName}</span></td>
                  <td>${c.units}</td>
                  <td class="rp-hint">${esc(c.schedule || 'TBA')}</td>
                  <td style="text-align:right">
                    <button class="rp-btn rp-btn-danger rp-btn-sm" data-action="facultyDeleteCourse" data-id="${c.id}">Delete</button>
                  </td>
                </tr>
              `}).join('') : '<tr><td colspan="6" class="rp-empty">No subjects found.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}
