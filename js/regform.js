/* =========================================================================
   REGFORM.JS — The registration form ("Schedule of Payment")
   -------------------------------------------------------------------------
   The same document is printed in several places: the student prints their
   own copy, and the Registrar, Accounting and Admin portals open it from the
   student management window as their copy. Keeping it here means the figures
   and the academic term can never disagree between portals.
   ========================================================================= */

import { esc } from './utils.js';
import { programLabel, getAcademicTerm } from './catalog.js';
import { applicationStatus } from './status.js';

export function registrationFormHtml({
  app = {},
  subjects = [],
  courses = [],
  settings = {},
  copyLabel = "STUDENT'S COPY",
  fallbackName = ''
} = {}) {
  let totalUnits = 0;
  let subjectsHtml = '';

  subjects.forEach(s => {
    const c = courses.find(x => String(x.id) === String(s.course_id));
    if (c) {
      totalUnits += Number(c.units);
      subjectsHtml += `
        <tr>
          <td style="border:1px solid #000; padding:4px;">${esc(c.code)}</td>
          <td style="border:1px solid #000; padding:4px;">${esc(c.title)}</td>
          <td style="border:1px solid #000; padding:4px; text-align:center;">${c.units}</td>
        </tr>
      `;
    }
  });

  const tuitionPerUnit = Number(settings.tuition_per_unit || 0);
  const tuition = totalUnits * tuitionPerUnit;
  const misc = Number(settings.misc_fee || 0);
  const reg = Number(settings.reg_fee || 0);
  const total = tuition + misc + reg;
  const paid = Number(app.amount_paid || 0);

  let pr = app.program || {};
  if (typeof pr === 'string') { try { pr = JSON.parse(pr); } catch (e) { pr = {}; } }
  const progName = programLabel(pr.preferred);
  const personal = app.personal || {};
  const fullName = personal.first_name
    ? `${personal.first_name} ${personal.middle_name || ''} ${personal.last_name || ''}`.trim()
    : fallbackName;

  // The Registrar sets the current term, so the form always prints the term
  // the student is actually enrolling in.
  const term = getAcademicTerm();

  // The ENROLLED stamp belongs only to a student who is officially enrolled.
  // An applicant or an enrollee prints the very same form without the stamp.
  const enrolled = applicationStatus(app) === 'Enrolled';

  return `
    <div class="progress-card" style="background:#fff; color:#000; font-family: 'Times New Roman', Times, serif; max-width: 800px; margin: 0 auto; padding: 40px;">

      <!-- HEADER -->
      <div style="text-align:center; margin-bottom:20px;">
        <h2 style="font-size:16px; font-weight:bold; margin-bottom:5px;">UNIDA CHRISTIAN COLLEGES</h2>
        <p style="font-size:12px;">Unida Street Anabu I-F, Imus City, Cavite</p>
        <h3 style="font-size:14px; font-weight:bold; margin-top:10px;">COLLEGE DEPARTMENT</h3>
        <p style="font-size:10px; text-align:right;">${esc(copyLabel)}</p>
      </div>

      <!-- DETAILS -->
      <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:10px;">
        <div>
          <p><strong>Schedule of Payment</strong></p>
          <p style="margin-top:10px;">NAME: <span style="border-bottom:1px solid #000; display:inline-block; width:200px;">${esc(fullName).toUpperCase()}</span></p>
          <p style="margin-top:5px;">COURSE AND YEAR: <span style="border-bottom:1px solid #000; display:inline-block; width:150px;">${progName} - YEAR ${esc(pr.year_level || '?')}</span></p>
        </div>
        <div style="text-align:right;">
          <p>AY: <strong>${esc(term.schoolYear)}</strong></p>
          <p>SEMESTER: <strong>${esc(term.semester).toUpperCase()}</strong></p>
        </div>
      </div>

      <!-- TABLE -->
      <div class="receipt-scroll">
      <table style="width:100%; border-collapse:collapse; font-size:11px; margin-bottom:20px;">
        <thead>
          <tr style="border:1px solid #000; text-align:center; font-weight:bold;">
            <th style="border:1px solid #000; padding:4px;" colspan="2">SUBJECTS</th>
            <th style="border:1px solid #000; padding:4px;">No. of Units</th>
            <th style="border:1px solid #000; padding:4px;">Amount per Unit</th>
            <th style="border:1px solid #000; padding:4px;">TOTAL TUITION FEE</th>
          </tr>
        </thead>
        <tbody>
          ${subjectsHtml}
          <tr>
            <td style="border:1px solid #000; padding:4px; font-weight:bold;" colspan="2">TOTAL TUITION</td>
            <td style="border:1px solid #000; padding:4px; text-align:center; font-weight:bold;">${totalUnits}</td>
            <td style="border:1px solid #000; padding:4px; text-align:center;">${tuitionPerUnit}</td>
            <td style="border:1px solid #000; padding:4px; text-align:right; font-weight:bold;">${tuition.toLocaleString('en-PH', {minimumFractionDigits:2})}</td>
          </tr>
          <tr>
            <td style="border:1px solid #000; padding:4px;" colspan="4">REGISTRATION</td>
            <td style="border:1px solid #000; padding:4px; text-align:right;">${reg.toLocaleString('en-PH', {minimumFractionDigits:2})}</td>
          </tr>
          <tr>
            <td style="border:1px solid #000; padding:4px;" colspan="4">MISCELLANEOUS FEES</td>
            <td style="border:1px solid #000; padding:4px; text-align:right;">${misc.toLocaleString('en-PH', {minimumFractionDigits:2})}</td>
          </tr>
          <tr>
            <td style="border:1px solid #000; padding:4px; font-weight:bold;" colspan="4">TOTAL</td>
            <td style="border:1px solid #000; padding:4px; text-align:right; font-weight:bold;">${total.toLocaleString('en-PH', {minimumFractionDigits:2})}</td>
          </tr>
          <tr>
            <td style="border:1px solid #000; padding:4px; font-weight:bold; color:green;" colspan="4">AMOUNT PAID</td>
            <td style="border:1px solid #000; padding:4px; text-align:right; font-weight:bold; color:green;">${paid.toLocaleString('en-PH', {minimumFractionDigits:2})}</td>
          </tr>
          <tr>
            <td style="border:1px solid #000; padding:4px; font-weight:bold; color:red;" colspan="4">REMAINING BALANCE</td>
            <td style="border:1px solid #000; padding:4px; text-align:right; font-weight:bold; color:red;">${(total - paid).toLocaleString('en-PH', {minimumFractionDigits:2})}</td>
          </tr>
        </tbody>
      </table>
      </div>

      <!-- STAMP (only for an officially enrolled student) -->
      ${enrolled ? `
      <div style="display:flex; justify-content:center; margin:30px 0;">
        <div style="border: 3px solid #2e7d32; color: #2e7d32; padding: 10px 30px; border-radius: 8px; text-align:center; transform: rotate(-5deg);">
          <p style="font-size:12px; font-weight:bold; margin-bottom:5px;">UCC ADMISSIONS OFFICE</p>
          <p style="font-size:28px; font-weight:900; letter-spacing:2px;">ENROLLED</p>
          <p style="font-size:12px;">Date: ${new Date().toLocaleDateString()}</p>
        </div>
      </div>
      ` : ''}

      <!-- SIGNATURES -->
      <div style="display:flex; flex-wrap:wrap; justify-content:space-between; gap:16px; font-size:11px; margin-top:40px;">
        <div style="text-align:center;">
          <p>Checked by:</p>
          <div style="border-bottom:1px solid #000; width:150px; margin:20px auto 5px;"></div>
          <p>Ms. Analee I. Ramos</p>
          <p style="font-weight:bold;">Registrar Head</p>
        </div>
        <div style="text-align:center;">
          <p>Approved by:</p>
          <div style="border-bottom:1px solid #000; width:150px; margin:20px auto 5px;"></div>
          <p>Dr. Ruthmita Rozul</p>
          <p style="font-weight:bold;">College Director</p>
        </div>
      </div>

    </div>
  `;
}
