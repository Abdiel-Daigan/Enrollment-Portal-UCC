/* =========================================================================
   UNITLIMITS.JS — Maximum subject load per program and year level
   -------------------------------------------------------------------------
   The Registrar (and the Admin) see every program as one row. Editing a
   program opens a window with one input per year level, so all the maximums
   of a program are set in one place instead of being filtered one by one.
   ========================================================================= */

import { esc, toast } from './utils.js';
import {
  getPrograms,
  getUnitLimits,
  findUnitLimit,
  yearLevelsFor,
  yearLabel,
  programYears
} from './catalog.js';

export async function renderRegistrarUnitLimits() {
  const programs = getPrograms().filter(p => !p.general);
  const limits = getUnitLimits();

  return `
    <div class="rp-notice info" style="margin-bottom:16px;">
      <span>Each program allows one maximum load per year level. The Faculty cannot confirm a subject load above the maximum set here.</span>
    </div>

    <div class="rp-table-wrap">
      <table class="rp-table">
        <thead><tr><th>Program</th><th>Year Levels</th><th>Maximum Units per Year</th><th style="text-align:right">Actions</th></tr></thead>
        <tbody>
          ${programs.length ? programs.map(p => {
            const summary = yearLevelsFor(p.id).map((y) => {
              const limit = findUnitLimit(p.id, y);
              return `<span class="rp-badge ${limit ? 'green' : 'grey'}" style="margin:2px 2px 0 0;">${esc(yearLabel(y))}: ${limit ? limit.maxUnits : 'no limit'}</span>`;
            }).join(' ');

            return `
              <tr>
                <td>
                  <strong>${esc(p.code)}</strong>
                  <div class="rp-hint">${esc(p.name)}</div>
                </td>
                <td>${programYears(p.id)}</td>
                <td style="white-space:normal;">${summary}</td>
                <td style="text-align:right; white-space:nowrap;">
                  <button class="rp-btn rp-btn-primary rp-btn-sm" data-action="regEditUnitLimits" data-id="${p.id}">Edit</button>
                </td>
              </tr>
            `;
          }).join('') : '<tr><td colspan="4" class="rp-empty">No programs found. Create one in Programs first.</td></tr>'}
        </tbody>
      </table>
    </div>

    ${limits.length ? '' : '<p class="rp-hint" style="margin-top:12px;">No maximums are set yet, so every student may currently carry any number of units.</p>'}
  `;
}

export async function regUnitLimitModal(programId) {
  const program = getPrograms().find(p => String(p.id) === String(programId));
  if (!program) return toast('This program could not be found.', 'error');

  const fields = yearLevelsFor(program.id).map((year) => {
    const limit = findUnitLimit(program.id, year);
    return `
      <div class="unit-limit-field">
        <label for="unit_limit_${year}">${esc(yearLabel(year))}</label>
        <input class="rp-input" id="unit_limit_${year}" name="year_${year}" type="number"
               min="1" max="60" value="${limit ? limit.maxUnits : ''}" placeholder="No limit">
      </div>
    `;
  }).join('');

  const modalHtml = `
    <div class="rp-modal-backdrop" id="regUnitLimitModal">
      <div class="rp-modal">
        <div class="rp-modal-head">
          <div>
            <h3>Unit Limits — ${esc(program.code)}</h3>
            <div class="rp-hint">${esc(program.name)} · ${programYears(program.id)} year level(s)</div>
          </div>
          <button type="button" class="rp-btn rp-btn-ghost rp-btn-sm" onclick="document.getElementById('regUnitLimitModal').remove()">✕</button>
        </div>
        <div class="rp-modal-body">
          <p class="rp-hint" style="margin-bottom:14px;">Type the maximum number of units a student in each year level may carry. Leave a year blank for no limit.</p>
          <form id="regProgramUnitLimitsForm">
            <input type="hidden" name="program_id" value="${program.id}">
            <div class="unit-limit-grid">${fields}</div>
            <button type="submit" class="rp-btn rp-btn-primary" style="margin-top:18px; width:100%;">Save Unit Limits</button>
          </form>
        </div>
      </div>
    </div>
  `;

  document.getElementById('regUnitLimitModal')?.remove();
  document.body.insertAdjacentHTML('beforeend', modalHtml);
}
