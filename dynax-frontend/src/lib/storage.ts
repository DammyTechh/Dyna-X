// Uploads 3D scan files to the Supabase `scans` storage bucket and returns a
// public URL. Uses the Storage REST API directly (no extra dependency).
//
// Requires (set in .env / Vercel):
//   NEXT_PUBLIC_SUPABASE_URL
//   NEXT_PUBLIC_SUPABASE_ANON_KEY
// and the `scans` bucket + policies created by migration 002.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const BUCKET = 'scans';

export function storageConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON);
}

function safeName(name: string): string {
  const dot = name.lastIndexOf('.');
  const ext = dot > -1 ? name.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, '') : 'glb';
  const rand = Math.random().toString(36).slice(2, 10);
  return `scan-${Date.now()}-${rand}.${ext}`;
}

/** Upload a scan file; resolves to its public URL. Throws on failure. */
export async function uploadScan(file: File): Promise<string> {
  if (!storageConfigured()) {
    throw new Error('Storage is not configured (missing Supabase env vars).');
  }
  const path = safeName(file.name);
  const res = await fetch(
    `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SUPABASE_ANON}`,
        apikey: SUPABASE_ANON,
        'Content-Type': file.type || 'application/octet-stream',
        'x-upsert': 'true',
      },
      body: file,
    },
  );
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Upload failed (${res.status}). ${detail}`.trim());
  }
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}
