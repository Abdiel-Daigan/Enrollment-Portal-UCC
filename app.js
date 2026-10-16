const SUPABASE_URL = 'https://xxxxx.supabase.co';       // paste your Project URL
const SUPABASE_KEY = 'eyJhbGci...';                     // paste your anon key

async function supa(table, options = {}) {
  const { method = 'GET', body, match } = options;
  let url = `${SUPABASE_URL}/rest/v1/${table}`;
  if (match) {
    const q = Object.entries(match).map(([k, v]) => `${k}=eq.${encodeURIComponent(v)}`).join('&');
    url += '?' + q;
  }
  const res = await fetch(url, {
    method,
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY,
      'Content-Type': 'application/json',
      'Prefer': method === 'POST' ? 'return=representation' : ''
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) throw new Error(await res.text());
  return method === 'DELETE' ? true : res.json();
}
