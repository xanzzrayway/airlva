// Mengirim URL + publishable key Supabase ke browser (nilainya dari variabel Cloudflare)
export async function onRequestGet({ env }) {
  return new Response(JSON.stringify({ url: env.SUPABASE_URL || '', anonKey: env.SUPABASE_ANON_KEY || '' }), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}
