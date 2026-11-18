export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

// Opens an uploaded document in a new tab. Defined once here so every portal
// uses the same behaviour (the inline onclick handlers call this global).
export function viewDocument(url) {
  if (!url) return;
  window.open(url, '_blank', 'noopener');
}

window.viewDocument = viewDocument;

// Remarks that mean a subject is already finished and must not be offered again
export const HISTORY_REMARKS = ['Passed', 'Dropped', 'Failed'];

export const isHistorySubject = (subject) =>
  HISTORY_REMARKS.includes(String((subject && subject.remarks) || '').trim());

export function hash(pw) {
  let h = 5381;
  const s = pw + '::ucc$salt';
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) + s.charCodeAt(i);
    h = h & 0xffffffff;
  }
  return 'sim$' + Math.abs(h).toString(16);
}

export function toast(msg, type = 'success') {
  const el = document.createElement('div');
  el.className = 'toast toast-' + type;
  el.textContent = msg;
  const root = $('#toastRoot');
  if (root) root.appendChild(el);
  
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 350);
  }, 3200);
}

export function initials(name) {
  return String(name || '?').trim().split(/\s+/).slice(0, 2)
    .map((w) => w[0]).join('').toUpperCase();
}