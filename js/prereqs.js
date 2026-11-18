/* =========================================================================
   PREREQS.JS — Prerequisite sequences (create, store, validate)
   -------------------------------------------------------------------------
   A prerequisite set is an ordered chain of subjects, e.g.
      CS 101 -> CS 102 -> CS 103 -> CS 104
   A subject inside a chain may only be taken when every subject before it
   in that chain is either already passed or included in the same load.
   Sequences are stored in the existing `presets` table so no database
   migration is required: the encoded payload lives in the `name` column and
   the program/year/semester are stored in their normal columns.
   ========================================================================= */

import { supa } from './api.js';

const PREFIX = 'PREREQ::';

export function isPrereqRow(row) {
  return String((row && row.name) || '').startsWith(PREFIX);
}

export function encodePrereqName(title, courseIds) {
  return PREFIX + JSON.stringify({ title: String(title || ''), courseIds: courseIds.map(Number) });
}

export function decodePrereqSet(row) {
  if (!isPrereqRow(row)) return null;
  let data;
  try {
    data = JSON.parse(String(row.name).slice(PREFIX.length));
  } catch (e) {
    return null;
  }
  if (!data || typeof data !== 'object') return null;
  return {
    id: row.id,
    title: String(data.title || 'Untitled sequence'),
    courseIds: Array.isArray(data.courseIds) ? data.courseIds.map(Number) : [],
    programId: row.program_id,
    yearLevel: row.year_level,
    semester: row.semester
  };
}

export async function loadPrereqSets() {
  try {
    const rows = await supa('presets');
    return rows.map(decodePrereqSet).filter(Boolean);
  } catch (e) {
    console.error('Could not load prerequisite sequences', e);
    return [];
  }
}

// Attach the real course rows and drop ids whose subject was deleted.
export function hydratePrereqSets(sets, courses) {
  const byId = new Map(courses.map(c => [String(c.id), c]));
  return sets.map(set => ({
    ...set,
    courses: set.courseIds.map(id => byId.get(String(id))).filter(Boolean)
  }));
}

// courseId -> [{ setId, title, earlierIds }] for every chain that has a
// subject in front of it.
export function buildChainIndex(sets) {
  const index = new Map();
  sets.forEach(set => {
    const chain = set.courses || [];
    chain.forEach((course, i) => {
      if (i === 0) return;
      const key = String(course.id);
      if (!index.has(key)) index.set(key, []);
      index.get(key).push({
        setId: set.id,
        title: set.title,
        earlierIds: chain.slice(0, i).map(c => String(c.id))
      });
    });
  });
  return index;
}

/* Validate a proposed load.
   selectedIds — subjects being added right now (the pre-confirmed list)
   passedIds   — subjects already passed by the student
   Returns Map(courseId -> [{ id, code }]) of unmet prerequisites. */
export function evaluatePrerequisites({ selectedIds, passedIds, sets, courses }) {
  const courseById = new Map(courses.map(c => [String(c.id), c]));
  const selected = new Set((selectedIds || []).map(String));
  const passed = new Set((passedIds || []).map(String));
  const index = buildChainIndex(sets || []);
  const problems = new Map();

  (selectedIds || []).forEach(rawId => {
    const key = String(rawId);
    const chains = index.get(key);
    if (!chains || !chains.length) return;

    const missing = [];
    chains.forEach(chain => {
      chain.earlierIds.forEach(earlierId => {
        if (passed.has(earlierId) || selected.has(earlierId)) return;
        if (missing.some(m => String(m.id) === earlierId)) return;
        const course = courseById.get(earlierId);
        missing.push({ id: earlierId, code: course ? course.code : 'Unknown subject' });
      });
    });

    if (missing.length) problems.set(key, missing);
  });

  return problems;
}

// "Prerequisites missing: CS 102, CS 103"
export function missingLabel(missing) {
  return 'Prerequisites missing: ' + missing.map(m => m.code).join(', ');
}
