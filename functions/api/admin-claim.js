// Jadikan akun yang sedang login sebagai admin, hanya jika kunci setup benar (ADMIN_SETUP_KEY di Cloudflare)
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });
const same = (a, b) => {
  const x = new TextEncoder().encode(a), y = new TextEncoder().encode(b);
  let d = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) d |= (x[i] || 0) ^ (y[i] || 0);
  return d === 0;
};

export async function onRequestPost({ request, env }) {
  if (!env.ADMIN_SETUP_KEY || !env.SUPABASE_URL || !env.SUPABASE_ANON_KEY || !env.SUPABASE_SERVICE_ROLE_KEY)
    return json({ error: 'Fitur ini belum aktif (ADMIN_SETUP_KEY belum diisi di Cloudflare).' }, 403);
  const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'Belum login.' }, 401);
  const ur = await fetch(env.SUPABASE_URL + '/auth/v1/user', { headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: 'Bearer ' + token } });
  if (!ur.ok) return json({ error: 'Sesi habis. Masuk lagi.' }, 401);
  const uid = (await ur.json()).id;
  let body; try { body = await request.json(); } catch (e) { body = {}; }
  if (!same(String(body.key || ''), env.ADMIN_SETUP_KEY)) {
    await new Promise((r) => setTimeout(r, 1500));
    return json({ error: 'Kunci salah.' }, 401);
  }
  const k = env.SUPABASE_SERVICE_ROLE_KEY;
  const headers = { apikey: k, 'Content-Type': 'application/json', Prefer: 'return=representation' };
  if (!k.startsWith('sb_secret_')) headers.Authorization = 'Bearer ' + k;
  const r = await fetch(env.SUPABASE_URL + '/rest/v1/profiles?id=eq.' + encodeURIComponent(uid), { method: 'PATCH', headers, body: JSON.stringify({ is_admin: true }) });
  const rows = r.ok ? await r.json() : [];
  if (!rows.length) return json({ error: 'Profil belum ada. Buka AirLva dan login sekali dulu.' }, 404);
  return json({ ok: true });
}
