import { esc, toast } from './utils.js';
import { supa } from './api.js';

const PROGRAMS = { '0': 'General', '1': 'BEEd', '2': 'BSEd', '8': 'BSCS' };
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export async function renderRegistrarDashboard() {
  // ... (Keep existing)
}

export async function renderRegistrarStudents() {
  // ... (Keep existing search & filter logic)
}

export async function regManageStudentModal(userId) {
  const users = await supa('users', { match: { id: userId } });
  const u = users[0];
  const apps = await supa('applications', { match: { user_id: userId } });
  const app = apps[0] || {};
  
  const DOC_TYPES = {
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

  const docs = DOC_TYPES[app.doc_type] || [];
  const uploaded = app.documents || {};
  const docStatus = app.doc_status || {};

  const docRows = docs.map(d => {
    const isUploaded = uploaded[d.id];
    const status = docStatus[d.id] || 'Missing';
    
    return `
      <tr>
        <td>
          <strong>${esc(d.name)}</strong><br>
          ${d.required ? '<span class="rp-badge red" style="margin-top:4px;">Required</span>' : '<span class="rp-badge grey" style="margin-top:4px;">Follow-up</span>'}
        </td>
        <td>
          ${isUploaded 
            ? `<button class="rp-btn rp-btn-ghost rp-btn-sm" onclick="window.viewDocument('${uploaded[d.id]}')">View File</button>` 
            : `<span class="rp-badge gold">Not Uploaded</span>`}
        </td>
        <td>
          <select class="rp-input" style="padding:4px; font-size:12px; width:120px;" data-change="regDocStatus" data-student="${userId}" data-doc="${d.id}">
            <option value="Missing" ${status === 'Missing' ? 'selected' : ''}>Missing</option>
            <option value="Complete" ${status === 'Complete' ? 'selected' : ''}>Complete</option>
          </select>
        </td>
      </tr>
    `;
  }).join('');

  const modalHtml = `
    <div class="rp-modal-backdrop" id="regStudentModal">
      <div class="rp-modal wide">
        <div class="rp-modal-head">
          <h3>Manage Documents — ${esc(u.name)}</h3>
          <button type="button" class="rp-btn rp-btn-ghost rp-btn-sm" onclick="document.getElementById('regStudentModal').remove()">✕</button>
        </div>
        <div class="rp-modal-body">
          <div class="rp-notice info" style="margin-bottom:20px;">
            <span>ℹ️</span>
            <span>Verify the uploaded documents below. Mark them as "Complete" once verified. The student will not appear in the Faculty portal until all <strong>Required</strong> documents are marked Complete.</span>
          </div>
          
          <div class="rp-table-wrap">
            <table class="rp-table">
              <thead><tr><th>Document Name</th><th>File</th><th>Registrar Status</th></tr></thead>
              <tbody>${docRows}</tbody>
            </table>
          </div>

          <div style="margin-top: 24px; border-top: 1px solid #eee; padding-top: 20px;">
            <h4 style="margin-bottom: 10px; font-size:14px;">Return Application?</h4>
            <p class="rp-hint" style="margin-bottom: 10px;">If a document is invalid or missing, you can return the application to the student with a reason.</p>
            <form id="regReturnForm" style="display:flex; gap:10px;">
              <input type="hidden" name="user_id" value="${userId}">
              <input class="rp-input" name="feedback" placeholder="Reason for returning (e.g., Blurry PSA image)" required>
              <button type="submit" class="rp-btn rp-btn-danger">Return Application</button>
            </form>
          </div>
        </div>
        <div class="rp-modal-foot">
          <button type="button" class="rp-btn rp-btn-primary" onclick="document.getElementById('regStudentModal').remove()">Done</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('regStudentModal')?.remove();
  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

window.viewDocument = (url) => {
  window.open(url, '_blank');
};

// ... (Keep existing renderRegistrarPresets and renderRegistrarCourses) ...
