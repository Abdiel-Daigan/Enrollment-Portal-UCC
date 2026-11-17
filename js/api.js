const SUPABASE_URL = 'https://oysqcmgdpmmhyaxxvjbl.supabase.co';
const SUPABASE_KEY = 'sb_publishable_DZyDoTCghbN0VccKWIFMlw_R1a5tlW1';

export async function supa(table, options = {}) {
  const { method = 'GET', body, match } = options;
  const baseUrl = SUPABASE_URL.replace(/\/$/, '');
  let url = baseUrl + '/rest/v1/' + table;

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

// Upload file to Supabase Storage
export async function uploadFile(file, userId, docId) {
  const fileExt = file.name.split('.').pop();
  const fileName = `${userId}_${docId}_${Date.now()}.${fileExt}`;
  const filePath = `${fileName}`;

  // Make sure you created a bucket called 'student-documents' and marked it as Public
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/student-documents/${filePath}`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY,
    },
    body: file
  });

  if (!res.ok) throw new Error('Upload failed');
  
  // Return the public URL
  return `${SUPABASE_URL}/storage/v1/object/public/student-documents/${filePath}`;
}
