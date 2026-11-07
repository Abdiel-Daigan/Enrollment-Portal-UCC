import { supa } from './api.js';
import { hash, toast } from './utils.js';

export let session = null;
const SESSION_KEY = 'ucc_session_v1';

export function loadSession() {
  const raw = localStorage.getItem(SESSION_KEY);
  if (raw) {
    try { session = JSON.parse(raw); } catch (e) { session = null; }
  }
  return session;
}

export function setSession(s) {
  session = s;
  if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
  else localStorage.removeItem(SESSION_KEY);
}

export async function doLogin(form, onSuccess) {
  const fd = new FormData(form);
  const email = String(fd.get('email') || '').trim().toLowerCase();
  const pw = String(fd.get('password') || '');

  try {
    const rows = await supa('users', { match: { email, password_hash: hash(pw) } });
    if (!rows || !rows.length) return toast('Invalid credentials.', 'error');
    
    const user = rows[0];
    setSession({ userId: user.id, name: user.name, email: user.email, role: user.role });
    toast('Welcome, ' + user.name.split(' ')[0] + '!');
    onSuccess();
  } catch (err) {
    console.error(err);
    toast('Cannot reach the server.', 'error');
  }
}

export async function doRegister(form, onSuccess) {
  const fd = new FormData(form);
  const name = String(fd.get('name') || '').trim();
  const email = String(fd.get('email') || '').trim().toLowerCase();
  const pw = String(fd.get('password') || '');

  if (!name || !email || !pw) return toast('Please complete all fields.', 'error');

  try {
    const rows = await supa('users', {
      method: 'POST',
      body: { name, email, password_hash: hash(pw), role: 'student' }
    });
    
    const user = rows[0];
    setSession({ userId: user.id, name: user.name, email: user.email, role: user.role });
    toast('Account created!');
    onSuccess();
  } catch (err) {
    console.error(err);
    toast('Email already exists or connection failed.', 'error');
  }
}

export function doLogout(onSuccess) {
  setSession(null);
  onSuccess();
}
