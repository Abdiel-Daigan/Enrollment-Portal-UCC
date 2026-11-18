/* =========================================================================
   CATALOG.JS — Programs, multi-program subjects, unit limits
   -------------------------------------------------------------------------
   The database has no dedicated tables for programs or unit limits, so they
   are stored in the existing `presets` table with a marker prefix — the same
   approach the prerequisite sequences use (see prereqs.js). Every portal
   reads them through this module, so a program created in the Registrar
   portal shows up in the student application form, the curriculum, the
   faculty portal and the admin reports at once.
   ========================================================================= */

import { supa } from './api.js';
import { esc } from './utils.js';
import { isPrereqRow } from './prereqs.js';

const PROGRAM_PREFIX = 'PROGRAM::';
const UNIT_LIMIT_PREFIX = 'UNITLIMIT::';
const COURSE_PROGRAM_PREFIX = 'COURSEPROG::';
const ACADEMIC_TERM_PREFIX = 'ACADEMIC_TERM::';
const PROGRAM_SEED_PREFIX = 'PROGRAM_SEED::';

export const DEFAULT_YEAR_LEVELS = 4;
export const MAX_PROGRAM_YEARS = 6;
export const YEAR_LEVELS = [1, 2, 3, 4];
export const SEMESTERS = ['1st Semester', '2nd Semester', 'Summer'];

// Unit limits are one maximum per program and year level; the semester column
// is kept filled so the shared `presets` table stays valid.
export const ALL_SEMESTERS = 'All Semesters';

const range = (count) => Array.from({ length: count }, (_, i) => i + 1);

export const yearLabel = (year) => {
  const n = Number(year);
  if (!Number.isFinite(n)) return 'Year';
  const suffix = n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th';
  return `${n}${suffix} Year`;
};

// General is not a program row: it is the bucket that means "offered to every
// program", and it is never listed or edited. The rest is only the seed for a
// database that has no programs yet; once seeded, every program is a normal row
// the Registrar can add, rename or delete.
const GENERAL_PROGRAM = { id: 0, code: 'General', name: 'General (All Programs)', general: true };

const DEFAULT_PROGRAMS = [
  GENERAL_PROGRAM,
  { id: 1, code: 'BEEd', name: 'BEEd (Elementary Education)', years: 4 },
  { id: 2, code: 'BSEd', name: 'BSEd (Secondary Education)', years: 4 },
  { id: 8, code: 'BSCS', name: 'BSCS (Computer Science)', years: 4 }
];

// Programs that no longer exist (or were never set) are shown as Unspecified
// and behave like General: offered to every program.
export const UNSPECIFIED_PROGRAM = 'Unspecified';

let programs = DEFAULT_PROGRAMS.slice();
let unitLimits = [];
let courseProgramMap = {};
let courseProgramRowId = null;

// The Registrar sets one current academic term and the whole site reads it
// from here, so presets, the faculty and the printed forms always agree.
const schoolYearFor = (date) => {
  const year = date.getMonth() >= 5 ? date.getFullYear() : date.getFullYear() - 1;
  return `${year}-${year + 1}`;
};

let academicTerm = { semester: '1st Semester', schoolYear: schoolYearFor(new Date()), rowId: null };

const decodeMeta = (row, prefix) => {
  try {
    const data = JSON.parse(String(row.name || '').slice(prefix.length));
    return data && typeof data === 'object' ? data : null;
  } catch (e) {
    return null;
  }
};

// Rows that are configuration, not presets, and must never be listed as one.
// Prerequisite sequences share the table too, so they are excluded as well.
export function isMetaRow(row) {
  const name = String((row && row.name) || '');
  return isPrereqRow(row)
    || name.startsWith(PROGRAM_PREFIX)
    || name.startsWith(UNIT_LIMIT_PREFIX)
    || name.startsWith(COURSE_PROGRAM_PREFIX)
    || name.startsWith(ACADEMIC_TERM_PREFIX)
    || name.startsWith(PROGRAM_SEED_PREFIX);
}

export async function loadCatalog() {
  let rows = [];
  try {
    rows = await supa('presets');
  } catch (e) {
    console.error('Could not load the program catalog', e);
    return { programs, unitLimits, courseProgramMap };
  }

  const custom = [];
  const limits = [];
  let map = {};
  let mapRowId = null;
  let term = null;
  let programsSeeded = false;

  rows.forEach((row) => {
    const name = String(row.name || '');

    if (name.startsWith(PROGRAM_PREFIX)) {
      const data = decodeMeta(row, PROGRAM_PREFIX);
      if (!data) return;
      const id = Number(row.program_id ?? data.id);
      const code = String(data.code || '').trim();
      if (!Number.isFinite(id) || !code) return;
      const years = Number(data.years);
      custom.push({
        id,
        code,
        name: String(data.name || code).trim(),
        years: Number.isFinite(years) && years >= 1 ? Math.min(years, MAX_PROGRAM_YEARS) : DEFAULT_YEAR_LEVELS,
        rowId: row.id
      });
    } else if (name.startsWith(UNIT_LIMIT_PREFIX)) {
      const data = decodeMeta(row, UNIT_LIMIT_PREFIX);
      if (!data) return;
      const programId = Number(row.program_id ?? data.programId);
      const year = Number(row.year_level ?? data.year);
      const semester = String(row.semester || data.semester || '');
      const maxUnits = Number(data.maxUnits);
      if (!Number.isFinite(programId) || !Number.isFinite(year) || !semester || !Number.isFinite(maxUnits)) return;
      limits.push({ rowId: row.id, programId, year, semester, maxUnits });
    } else if (name.startsWith(COURSE_PROGRAM_PREFIX)) {
      const data = decodeMeta(row, COURSE_PROGRAM_PREFIX);
      mapRowId = row.id;
      map = {};
      // The payload is { courseId: [programIds] }; accept a wrapped { map } too.
      const source = data && data.map && typeof data.map === 'object' ? data.map : data;
      Object.entries(source || {}).forEach(([courseId, ids]) => {
        if (Array.isArray(ids) && ids.length) map[courseId] = ids.map(Number);
      });
    } else if (name.startsWith(PROGRAM_SEED_PREFIX)) {
      programsSeeded = true;
    } else if (name.startsWith(ACADEMIC_TERM_PREFIX)) {
      const data = decodeMeta(row, ACADEMIC_TERM_PREFIX);
      if (!data) return;
      const semester = String(row.semester || data.semester || '1st Semester');
      const schoolYear = String(data.schoolYear || '');
      if (!SEMESTERS.includes(semester) || !schoolYear) return;
      term = { semester, schoolYear, rowId: row.id };
    }
  });

  // The same id may appear twice if two tabs seeded at once; the last row wins.
  const uniquePrograms = [...custom.reduce((byId, p) => byId.set(String(p.id), p), new Map()).values()];
  programs = [GENERAL_PROGRAM].concat(await seedDefaultPrograms(uniquePrograms, programsSeeded));
  unitLimits = limits;
  courseProgramMap = map;
  courseProgramRowId = mapRowId;
  academicTerm = term || { semester: '1st Semester', schoolYear: schoolYearFor(new Date()), rowId: null };

  return { programs, unitLimits, courseProgramMap };
}

// --- PROGRAMS -------------------------------------------------------------

export function getPrograms() {
  return programs;
}

// Programs a student can apply to (General is a curriculum bucket, not a course).
export function getSelectablePrograms() {
  return programs.filter(p => !p.general);
}

export function programById(id) {
  return programs.find(p => String(p.id) === String(id)) || null;
}

export function programLabel(id, fallback = UNSPECIFIED_PROGRAM) {
  const p = programById(id);
  if (p) return p.code;
  const empty = id === null || id === undefined || String(id).trim() === '';
  return empty ? fallback : UNSPECIFIED_PROGRAM;
}

// --- YEAR LEVELS ----------------------------------------------------------
// Every program says how many year levels it has, so a two-year course never
// offers Year 3 or Year 4 anywhere in the site.

export function programYears(programId) {
  const p = programById(programId);
  const years = p ? Number(p.years) : NaN;
  return Number.isFinite(years) && years >= 1 ? Math.min(years, MAX_PROGRAM_YEARS) : DEFAULT_YEAR_LEVELS;
}

export function yearLevelsFor(programId) {
  return range(programYears(programId));
}

// Filters that are not tied to one program cover the widest program on offer.
export function allYearLevels() {
  const widest = programs.reduce(
    (max, p) => Math.max(max, Number(p.years) || DEFAULT_YEAR_LEVELS),
    DEFAULT_YEAR_LEVELS
  );
  return range(Math.min(widest, MAX_PROGRAM_YEARS));
}

export function yearOptionsHtml(selected, years) {
  const list = Array.isArray(years) ? years : allYearLevels();
  return list.map(y => `<option value="${y}" ${String(selected) === String(y) ? 'selected' : ''}>${yearLabel(y)}</option>`).join('');
}

export function programOptionsHtml(selected, {
  all = false,
  allValue = 'all',
  allLabel = 'All Programs',
  includeGeneral = false
} = {}) {
  const options = [];
  if (all) {
    options.push(`<option value="${esc(allValue)}" ${String(selected ?? '') === String(allValue) ? 'selected' : ''}>${esc(allLabel)}</option>`);
  }
  programs
    .filter(p => includeGeneral || !p.general)
    .forEach((p) => {
      options.push(`<option value="${p.id}" ${String(selected) === String(p.id) ? 'selected' : ''}>${esc(p.name)}</option>`);
    });
  return options.join('');
}

/* -------------------------------------------------------------------------
   MULTI-PROGRAM PICKER
   -------------------------------------------------------------------------
   A subject, preset or prerequisite set may belong to one program, several
   programs, or General (every program). Instead of a wall of loose checkboxes
   this is one searchable list of chips with a live "Offered to" summary.
   General is exclusive: ticking it clears the specific programs, and ticking a
   specific program clears General.
   ------------------------------------------------------------------------- */

export function programPickerHtml(selectedIds, { showGeneral = true, id = '' } = {}) {
  const ids = [...new Set((selectedIds || []).map(Number).filter(n => Number.isFinite(n)))];
  const chosen = (value) => ids.some(v => String(v) === String(value));

  const chip = (value, code, name, general) => `
    <label class="program-chip ${general ? 'is-general' : ''}">
      <input type="checkbox" name="program_ids" value="${value}"
             ${chosen(value) ? 'checked' : ''}
             onchange="window.programPickerSync(this)">
      <span class="program-chip-text">
        <strong>${esc(code)}</strong>
        <small>${esc(name)}</small>
      </span>
    </label>
  `;

  const options = programs
    .filter(p => showGeneral || !p.general)
    .map(p => chip(p.id, p.code, p.name, !!p.general))
    .join('');

  return `
    <div class="program-picker" ${id ? `id="${id}"` : ''}>
      <div class="program-picker-bar">
        <input class="rp-input program-picker-search" type="search" placeholder="Filter programs by code or name…"
               oninput="window.filterProgramPicker(this)">
        <div class="program-picker-tools">
          <button type="button" class="rp-btn rp-btn-ghost rp-btn-sm" onclick="window.programPickerAll(this, true)">All programs</button>
          <button type="button" class="rp-btn rp-btn-ghost rp-btn-sm" onclick="window.programPickerAll(this, false)">Clear</button>
        </div>
      </div>
      <div class="program-picker-list">${options}</div>
      <p class="rp-hint program-picker-summary" data-picker-summary>${summaryHtml(ids)}</p>
    </div>
  `;
}

// "Offered to: …" text for a list of program ids, shared by the first paint
// and by every later change so the two never disagree.
function summaryHtml(ids) {
  const list = (ids || []).map(Number).filter(n => Number.isFinite(n));
  if (!list.length) return '<strong>Offered to:</strong> nothing selected yet';
  if (list.includes(0)) return '<strong>Offered to:</strong> General — every program';
  const names = list.map(id => programLabel(id));
  return `<strong>Offered to:</strong> ${esc(names.join(', '))}`;
}

function pickerSummary(picker) {
  const summary = picker.querySelector('[data-picker-summary]');
  if (!summary) return;
  const checked = [...picker.querySelectorAll('input[name="program_ids"]:checked')];

  let html;
  if (!checked.length) {
    html = '<strong>Offered to:</strong> nothing selected yet';
  } else if (checked.some(input => input.value === '0')) {
    html = '<strong>Offered to:</strong> General — every program';
  } else {
    const names = checked.map(input => {
      const label = input.closest('.program-chip');
      return label ? label.querySelector('strong').textContent.trim() : input.value;
    });
    html = `<strong>Offered to:</strong> ${esc(names.join(', '))}`;
  }

  // Only touch the DOM when the text really changed: the mutation observer
  // that refreshes pickers would otherwise keep re-triggering itself.
  if (summary.innerHTML !== html) summary.innerHTML = html;
}

export function syncProgramPicker(input) {
  const picker = input.closest('.program-picker');
  if (!picker) return;

  if (input.checked) {
    const boxes = [...picker.querySelectorAll('input[name="program_ids"]')];
    if (input.value === '0') {
      boxes.forEach(box => { if (box !== input) box.checked = false; });
    } else {
      boxes.forEach(box => { if (box.value === '0') box.checked = false; });
    }
  }
  pickerSummary(picker);
}

export function filterProgramPicker(input) {
  const picker = input.closest('.program-picker');
  if (!picker) return;
  const query = String(input.value || '').trim().toLowerCase();
  picker.querySelectorAll('.program-chip').forEach((chip) => {
    const text = chip.textContent.toLowerCase();
    chip.hidden = !!query && !text.includes(query);
  });
}

export function selectProgramPicker(button, all) {
  const picker = button.closest('.program-picker');
  if (!picker) return;
  const boxes = [...picker.querySelectorAll('input[name="program_ids"]')];
  boxes.forEach((box) => { box.checked = all ? box.value === '0' : false; });
  pickerSummary(picker);
}

// Every picker on the page starts with its summary filled in.
export function refreshProgramPickers(root = document) {
  root.querySelectorAll('.program-picker').forEach(pickerSummary);
}

export const getPickedProgramIds = (root) => {
  if (!root) return [];
  return [...root.querySelectorAll('input[name="program_ids"]:checked')]
    .map(input => Number(input.value))
    .filter(n => Number.isFinite(n));
};

window.programPickerSync = syncProgramPicker;
window.filterProgramPicker = filterProgramPicker;
window.programPickerAll = selectProgramPicker;

/* A database with no program rows yet gets the programs this portal used to
   ship with, as ordinary rows. It runs only once, so a program the Registrar
   deletes stays deleted instead of being recreated on the next load. */
async function seedDefaultPrograms(custom, alreadySeeded) {
  if (custom.length || alreadySeeded) return custom;

  const seeded = [];
  for (const p of DEFAULT_PROGRAMS.filter(d => !d.general)) {
    try {
      const res = await supa('presets', {
        method: 'POST',
        body: {
          name: PROGRAM_PREFIX + JSON.stringify({ code: p.code, name: p.name, id: p.id, years: p.years }),
          program_id: p.id,
          year_level: 1,
          semester: '1st Semester'
        }
      });
      seeded.push({ id: p.id, code: p.code, name: p.name, years: p.years, rowId: Array.isArray(res) && res[0] ? res[0].id : null });
    } catch (e) {
      console.error('Could not seed the default program', p.code, e);
      seeded.push({ id: p.id, code: p.code, name: p.name, years: p.years, rowId: null });
    }
  }

  // The marker keeps a fresh load from recreating programs the Registrar deletes.
  await supa('presets', {
    method: 'POST',
    body: { name: PROGRAM_SEED_PREFIX + '1', program_id: 0, year_level: 1, semester: '1st Semester' }
  }).catch((e) => console.error('Could not record the program seed marker', e));

  return seeded;
}

function nextProgramId() {
  return Math.max(99, ...programs.map(p => Number(p.id) || 0)) + 1;
}

export async function saveProgram({ id, code, name, years }) {
  const cleanCode = String(code || '').trim();
  const cleanName = String(name || '').trim() || cleanCode;
  if (!cleanCode) throw new Error('A program code is required.');

  const requestedYears = Number(years);
  const programYearsValue = Number.isFinite(requestedYears) && requestedYears >= 1
    ? Math.min(Math.round(requestedYears), MAX_PROGRAM_YEARS)
    : DEFAULT_YEAR_LEVELS;

  const payload = { code: cleanCode, name: cleanName, years: programYearsValue };

  if (id === null || id === undefined || id === '') {
    const newId = nextProgramId();
    await supa('presets', {
      method: 'POST',
      body: {
        name: PROGRAM_PREFIX + JSON.stringify({ ...payload, id: newId }),
        program_id: newId,
        year_level: 1,
        semester: '1st Semester'
      }
    });
    return newId;
  }

  const existing = programs.find(p => String(p.id) === String(id));
  if (!existing) throw new Error('This program could not be found.');

  const row = { name: PROGRAM_PREFIX + JSON.stringify(payload) };
  if (existing.rowId) {
    await supa('presets', { method: 'PATCH', match: { id: existing.rowId }, body: row });
  } else {
    await supa('presets', {
      method: 'POST',
      body: { ...row, program_id: Number(id), year_level: 1, semester: '1st Semester' }
    });
  }
  return Number(id);
}

export async function deleteProgram(id) {
  const existing = programs.find(p => String(p.id) === String(id));
  if (!existing || !existing.rowId) throw new Error('This program could not be found.');

  await supa('presets', { method: 'DELETE', match: { id: existing.rowId } });

  // Drop the program's unit limits and curriculum assignments so nothing
  // keeps pointing at a program that no longer exists.
  for (const limit of unitLimits.filter(l => String(l.programId) === String(id))) {
    await supa('presets', { method: 'DELETE', match: { id: limit.rowId } }).catch(() => {});
  }
  const map = { ...courseProgramMap };
  let changed = false;
  Object.keys(map).forEach((courseId) => {
    const kept = (map[courseId] || []).filter(pid => String(pid) !== String(id));
    if (kept.length !== (map[courseId] || []).length) {
      changed = true;
      if (kept.length > 1) map[courseId] = kept;
      else delete map[courseId];
    }
  });
  if (changed) await writeCourseProgramMap(map).catch(() => {});
}

// --- SUBJECT ↔ PROGRAMS ---------------------------------------------------

export function getCourseProgramIds(course) {
  const mapped = courseProgramMap[String(course && course.id)];
  if (Array.isArray(mapped) && mapped.length) return mapped.map(Number);
  return [Number(course && course.program_id)];
}

// A subject is offered to a program when it is general (0), listed for it, or
// points at a program that no longer exists (Unspecified behaves like General).
export function courseMatchesProgram(course, programId) {
  const ids = getCourseProgramIds(course);
  if (ids.includes(0)) return true;
  if (!ids.some(id => programById(id))) return true;
  return ids.some(id => String(id) === String(programId));
}

// A preset is offered when it belongs to the program, or is General/Unspecified.
export function presetMatchesProgram(preset, programId) {
  const pid = preset && preset.program_id;
  if (String(pid) === '0') return true;
  if (!programById(pid)) return true;
  return String(pid) === String(programId);
}

// A prerequisite set may list several programs; General (0) and programs that
// no longer exist apply to everyone, just like presets.
export function prereqMatchesProgram(set, programId) {
  const raw = set && (Array.isArray(set.programIds) && set.programIds.length ? set.programIds : [set.programId]);
  const ids = (raw || []).map(Number).filter(n => Number.isFinite(n));
  if (!ids.length) return true;
  if (ids.includes(0)) return true;
  if (!ids.some(id => programById(id))) return true;
  return ids.some(id => String(id) === String(programId));
}

export function courseProgramLabels(course) {
  return getCourseProgramIds(course).map(id => programLabel(id));
}

async function writeCourseProgramMap(map) {
  const name = COURSE_PROGRAM_PREFIX + JSON.stringify(map);
  if (courseProgramRowId) {
    await supa('presets', { method: 'PATCH', match: { id: courseProgramRowId }, body: { name } });
  } else {
    const res = await supa('presets', {
      method: 'POST',
      body: { name, program_id: 0, year_level: 1, semester: '1st Semester' }
    });
    courseProgramRowId = Array.isArray(res) && res[0] ? res[0].id : null;
  }
  courseProgramMap = map;
}

/* Store the programs a subject belongs to.
   General (0) or a single program live in courses.program_id; two or more
   specific programs are kept in the shared catalog row. */
export async function saveCoursePrograms(courseId, ids) {
  const clean = [...new Set((ids || []).map(Number).filter(n => Number.isFinite(n)))];
  const map = { ...courseProgramMap };
  const key = String(courseId);

  if (clean.length > 1 && !clean.includes(0)) map[key] = clean;
  else delete map[key];

  await writeCourseProgramMap(map);
}

// --- UNIT LIMITS ----------------------------------------------------------
// One maximum load per program and year level. The semester a student is in
// does not change the maximum, so the whole site reads the same number.

export function getUnitLimits() {
  return unitLimits.slice();
}

export function findUnitLimit(programId, year) {
  const matches = unitLimits.filter(l =>
    String(l.programId) === String(programId) && String(l.year) === String(year)
  );
  return matches.find(l => l.semester === ALL_SEMESTERS) || matches[0] || null;
}

export async function saveUnitLimit({ programId, year, maxUnits }) {
  const pid = Number(programId);
  const yr = Number(year);
  const max = Number(maxUnits);

  if (!Number.isFinite(pid) || !Number.isFinite(yr)) throw new Error('Program and year level are required.');
  if (!Number.isFinite(max) || max < 1) throw new Error('Maximum units must be at least 1.');
  if (max > 60) throw new Error('Maximum units cannot be more than 60.');

  const payload = {
    name: UNIT_LIMIT_PREFIX + JSON.stringify({ programId: pid, year: yr, maxUnits: max }),
    program_id: pid,
    year_level: yr,
    semester: ALL_SEMESTERS
  };

  const existing = findUnitLimit(pid, yr);
  if (existing) {
    await supa('presets', { method: 'PATCH', match: { id: existing.rowId }, body: payload });
  } else {
    await supa('presets', { method: 'POST', body: payload });
  }
}

/* Saves the whole year grid of one program at once.
   values is { year: units } where a blank value removes that year's limit. */
export async function saveProgramUnitLimits(programId, values) {
  for (const [year, raw] of Object.entries(values || {})) {
    const text = String(raw ?? '').trim();
    const existing = findUnitLimit(programId, year);
    if (!text) {
      if (existing) await deleteUnitLimit(existing.rowId);
      continue;
    }
    await saveUnitLimit({ programId, year, maxUnits: text });
  }
}

export async function deleteUnitLimit(rowId) {
  await supa('presets', { method: 'DELETE', match: { id: Number(rowId) } });
}

// --- ACADEMIC TERM --------------------------------------------------------

export function getAcademicTerm() {
  return { ...academicTerm };
}

export const currentSemester = () => academicTerm.semester;

export async function saveAcademicTerm({ semester, schoolYear }) {
  const sem = String(semester || '').trim();
  const sy = String(schoolYear || '').replace(/\s+/g, '');

  if (!SEMESTERS.includes(sem)) throw new Error('Choose a valid semester.');
  if (!/^[0-9]{4}-[0-9]{4}$/.test(sy)) throw new Error('School year must look like 2026-2027.');

  const payload = {
    name: ACADEMIC_TERM_PREFIX + JSON.stringify({ semester: sem, schoolYear: sy }),
    program_id: 0,
    year_level: 1,
    semester: sem
  };

  if (academicTerm.rowId) {
    await supa('presets', { method: 'PATCH', match: { id: academicTerm.rowId }, body: payload });
  } else {
    const res = await supa('presets', { method: 'POST', body: payload });
    academicTerm.rowId = Array.isArray(res) && res[0] ? res[0].id : null;
  }

  academicTerm = { ...academicTerm, semester: sem, schoolYear: sy };
}
