import { toast } from './utils.js';

const SUPABASE_URL = 'https://YOUR_PROJECT_ID.supabase.co';
const SUPABASE_KEY = 'YOUR_ANON_KEY';

export async function supa(table, options = {}) {
  const { method = 'GET', body, match } = options;
  let url = SUPABASE_URL + '/rest/v1/' + table;

  const params = [];
  if (match) {
    Object.entries(match).forEach(([k, v]) => {
      params.push(k + '=eq.' + encodeURIComponent(v));
    });
  }
  if (params.length) url += '?' + params.join('&');

  const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': 'Bearer ' + SUPABASE_KEY,
    'Content-Type': 'application/json'
  };
  
  if (method === 'POST' || method === 'PATCH') {
    headers['Prefer'] = 'return=representation';
  }

  const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }

  const text = await res.text();
  if (!text) return true;
  
  try { return JSON.parse(text); } catch (e) { return true; }
}
