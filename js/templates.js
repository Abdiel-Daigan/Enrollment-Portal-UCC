/* =========================================================================
   TEMPLATES.JS — Portal HTML loader
   -------------------------------------------------------------------------
   Each portal's page markup lives in its own file under html/ instead of
   inside a JavaScript template literal. Templates are fetched once and
   cached, then filled with already-escaped values from the render
   functions. `{{key}}` placeholders are replaced with the matching value.
   ========================================================================= */

const cache = new Map();

export async function loadTemplate(name) {
  if (cache.has(name)) return cache.get(name);

  const url = new URL(`../html/${name}.html`, import.meta.url);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Could not load the "${name}" portal markup (${res.status}).`);
  }

  const markup = await res.text();
  cache.set(name, markup);
  return markup;
}

export async function preloadTemplates(names) {
  await Promise.all(names.map(loadTemplate));
}

export function fillTemplate(markup, data = {}) {
  return String(markup).replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (match, key) => {
    const value = key.split('.').reduce((obj, part) => (obj == null ? obj : obj[part]), data);
    return value === undefined || value === null ? '' : String(value);
  });
}

/* Loads a portal file and fills its placeholders.
   Values are inserted as-is, so callers escape user data with esc(). */
export async function renderTemplate(name, data = {}) {
  return fillTemplate(await loadTemplate(name), data);
}

/* Marks the sidebar button that belongs to the current portal view. */
export function setActiveNav(root, view) {
  root.querySelectorAll('.role-nav-item[data-nav-view]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.navView === view);
  });
}
