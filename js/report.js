/* =========================================================================
   REPORT.JS — "Create report" cards: on-screen table + CSV download
   ========================================================================= */

import { esc } from './utils.js';

const store = () => (window.__uccReports = window.__uccReports || {});

function csvCell(value) {
  return '"' + String(value === null || value === undefined ? '' : value).replace(/"/g, '""') + '"';
}

export function registerReport(id, { title, columns, rows, filename }) {
  store()[id] = { title, columns, rows, filename: filename || 'ucc-report.csv' };
}

/* Builds the dashboard card. `rows` is an array of arrays matching `columns`. */
export function reportCard({ id, title, columns, rows, filename, hint }) {
  registerReport(id, { title, columns, rows, filename });

  return `
    <div class="rp-card report-card">
      <div class="rp-card-head">
        <div>
          <h3>${esc(title)}</h3>
          ${hint ? `<div class="rp-hint">${esc(hint)}</div>` : ''}
        </div>
        <button class="rp-btn rp-btn-primary rp-btn-sm" data-action="createReport" data-report="${esc(id)}">Create Report</button>
      </div>
      <div id="reportOut-${esc(id)}" class="report-out"></div>
    </div>
  `;
}

window.createReportTable = (id) => {
  const report = store()[id];
  const out = document.getElementById('reportOut-' + id);
  if (!report || !out) return;

  out.innerHTML = `
    <div class="report-head">
      <strong>${esc(report.title)}</strong>
      <div class="report-head-actions">
        <span class="rp-hint">${report.rows.length} row(s)</span>
        <button class="rp-btn rp-btn-ghost rp-btn-sm" data-action="downloadReport" data-report="${esc(id)}">Download CSV</button>
      </div>
    </div>
    <div class="rp-table-wrap">
      <table class="rp-table">
        <thead><tr>${report.columns.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead>
        <tbody>
          ${report.rows.length
            ? report.rows.map(row => `<tr>${row.map(cell => `<td>${esc(cell)}</td>`).join('')}</tr>`).join('')
            : `<tr><td colspan="${report.columns.length}" class="rp-empty">Nothing to report for the current data.</td></tr>`}
        </tbody>
      </table>
    </div>
  `;
};

window.downloadReport = (id) => {
  const report = store()[id];
  if (!report) return;

  const lines = [report.columns.map(csvCell).join(',')];
  report.rows.forEach(row => lines.push(row.map(csvCell).join(',')));
  const csv = '\uFEFF' + lines.join('\r\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = report.filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
};
