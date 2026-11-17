const SUPABASE_URL = 'https://oysqcmgdpmmhyaxxvjbl.supabase.co';
const SUPABASE_KEY = 'sb_publishable_DZyDoTCghbN0VccKWIFMlw_R1a5tlW1';

const BASE_URL = SUPABASE_URL.replace(/\/$/, ''); // avoids "//rest" or "//storage" in URLs
const BUCKET = 'student-documents';

// ===== Database (REST) helper =====
export async function supa(table, options = {}) {
  const { method = 'GET', body, match } = options;
  let url = BASE_URL + '/rest/v1/' + table;

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

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }

  const text = await res.text();
  if (!text) return true;

  try { return JSON.parse(text); } catch (e) { return true; }
}

// ===== File upload to Supabase Storage =====
// Requires a bucket named 'student-documents' and an INSERT policy on
// storage.objects for the role used by SUPABASE_KEY (anon, unless users log in).
export async function uploadFile(file, userId, docId) {
  // Sanitize parts of the path so Supabase doesn't reject it with "Invalid key"
  const safeUser = String(userId).replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeDoc = String(docId).replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileExt = (file.name.split('.').pop() || 'bin').toLowerCase();
  const filePath = `${safeUser}_${safeDoc}_${Date.now()}.${fileExt}`;

  const res = await fetch(`${BASE_URL}/storage/v1/object/${BUCKET}/${filePath}`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY,
      'Content-Type': file.type || 'application/octet-stream'
    },
    body: file
  });

  if (!res.ok) {
    // Supabase puts the real reason in the response body
    // (e.g. "new row violates row-level security policy")
    const text = await res.text();
    console.error('Storage upload error:', res.status, text);

    let message = 'Upload failed';
    try {
      const parsed = JSON.parse(text);
      message = parsed.message || parsed.error || message;
    } catch (e) {
      if (text) message = text;
    }
    throw new Error(message);
  }

  // Public URL (only works if the bucket is marked Public)
  return `${BASE_URL}/storage/v1/object/public/${BUCKET}/${filePath}`;
}
