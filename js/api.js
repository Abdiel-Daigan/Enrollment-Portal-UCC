import { toast } from './utils.js';
const SUPABASE_URL = 'https://oysqcmgdpmmhyaxxvjbl.supabase.co';
const SUPABASE_KEY = 'sb_publishable_DZyDoTCghbN0VccKWIFMlw_R1a5tlW1';

export async function supa(table, options = {}) {
  // ... (Keep your existing supa function exactly as is) ...
}

// NEW: Upload file to Supabase Storage
export async function uploadFile(file, userId, docId) {
  const fileExt = file.name.split('.').pop();
  const fileName = `${userId}_${docId}_${Date.now()}.${fileExt}`;
  const filePath = `${fileName}`;

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
