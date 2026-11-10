/* =========================================================================
   AUTH.JS — Authentication logic (Login, Register, Session)
   ========================================================================= */

import { supa } from './api.js';
import { hash, toast } from './utils.js';

export let session = null;
const SESSION_KEY = 'ucc_session_v1';

// Load session on boot
export function loadSession() {
  const raw = localStorage.getItem(SESSION_KEY);
  if (raw) {
    try { 
      session = JSON.parse(raw); 
    } catch (e) { 
      session = null; 
    }
  }
  return session;
}

// Save session
export function setSession(s) {
  session = s;
  if (s) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(s));
  } else {
    localStorage.removeItem(SESSION_KEY);
  }
}

// Login
export async function doLogin(form, onSuccess) {
  const fd = new FormData(form);
  const email = String(fd.get('email') || '').trim().toLowerCase();
  const pw = String(fd.get('password') || '');

  try {
    const rows = await supa('users', { match: { email, password_hash: hash(pw) } });
    
    if (!rows || !rows.length) {
      return toast('Invalid email or password.', 'error');
    }
    
    const user = rows[0];
    
    // Save the exact role from the database (admin, faculty, or student)
    setSession({ 
      userId: user.id, 
      name: user.name, 
      email: user.email, 
      role: user.role 
    });

    toast('Welcome, ' + user.name.split(' ')[0] + '!');
    onSuccess();
  } catch (err) {
    console.error(err);
    toast('Cannot reach the server.', 'error');
  }
}

// Register
export async function doRegister(form, onSuccess) {
  const fd = new FormData(form);
  const name = String(fd.get('name') || '').trim();
  const email = String(fd.get('email') || '').trim().toLowerCase();
  const pw = String(fd.get('password') || '');

  if (!name || !email || !pw) {
    return toast('Please complete all fields.', 'error');
  }
  if (pw.length < 6) {
    return toast('Password must be at least 6 characters.', 'error');
  }

  try {
    const rows = await supa('users', {
      method: 'POST',
      body: { 
        name, 
        email, 
        password_hash: hash(pw), 
        role: 'student' // New registrations are always students
      }
    });
    
    const user = rows[0];
    
    setSession({ 
      userId: user.id, 
      name: user.name, 
      email: user.email, 
      role: user.role 
    });

    toast('Account created. Welcome to UCC!');
    onSuccess();
  } catch (err) {
    console.error(err);
    toast('Email already registered or connection failed.', 'error');
  }
}

// Logout
export function doLogout(onSuccess) {
  setSession(null);
  onSuccess();
}
