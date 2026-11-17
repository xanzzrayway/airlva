// Proxy Gemini + pemotongan kredit di server (1 kata jawaban AI = 1 kredit)
const MODELS = { chat: 'gemini-3.5-flash-lite', website: 'gemini-3.5-flash', code: 'gemini-3.8-flash' };
const BUSY = [429, 500, 502, 503, 504]; // kode error Gemini saat server sibuk
const FORMAT =
  'Balas PERSIS dengan format ini, tanpa teks apa pun di luar tag:\n' +
  '<tugas>\n- langkah 1\n- langkah 2\n</tugas>\n<hasil>\n...isi hasil...\n</hasil>\n' +
  'Isi <tugas> dengan 3 sampai 6 langkah pendek (maksimal 8 kata per langkah).';
const SYSTEM = {
  chat: 'Kamu AirLva, teman ngobrol santai. Jawab dalam bahasa Indonesia yang santai, singkat, dan ramah. Jangan pakai format markdown berat.',
  website:
    'Kamu AirLva, ahli pembuat website. Gunakan bahasa Indonesia. ' + FORMAT +
    ' Di <hasil> tulis satu kalimat pembuka lalu SATU blok kode ```html berisi satu file HTML lengkap (CSS dan JavaScript di dalam file, tanpa file lokal lain, responsif untuk HP).',
  code:
    'Kamu AirLva, ahli pemrograman. Gunakan bahasa Indonesia. ' + FORMAT +
    ' Di <hasil> tulis satu kalimat pembuka lalu kode lengkap dalam blok ```bahasa, dan penjelasan singkat jika perlu.',
};
const json = (o, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });

// panggil fungsi database dengan secret key (key baru sb_secret_ hanya lewat header apikey)
async function rpc(env, fn, args) {
  const k = env.SUPABASE_SERVICE_ROLE_KEY;
  const headers = { apikey: k, 'Content-Type': 'application/json' };
  if (!k.startsWith('sb_secret_')) headers.Authorization = 'Bearer ' + k;
  const r = await fetch(env.SUPABASE_URL + '/rest/v1/rpc/' + fn, { method: 'POST', headers, body: JSON.stringify(args) });
  if (!r.ok) throw new Error('rpc ' + fn + ' ' + r.status);
  return r.json();
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.GEMINI_API_KEY || !env.SUPABASE_URL || !env.SUPABASE_ANON_KEY || !env.SUPABASE_SERVICE_ROLE_KEY)
    return json({ error: 'Server belum dikonfigurasi (variabel Cloudflare belum lengkap).' }, 500);

  // 1) pastikan user benar-benar login
  const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'Sesi habis. Silakan masuk lagi.' }, 401);
  const ur = await fetch(env.SUPABASE_URL + '/auth/v1/user', {
    headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: 'Bearer ' + token },
  });
  if (!ur.ok) return json({ error: 'Sesi habis. Silakan masuk lagi.' }, 401);
  const uid = (await ur.json()).id;

  // 2) cek kredit
  let bal;
  try { bal = (await rpc(env, 'get_balance', { p_user: uid }))[0]; }
  catch (e) { return json({ error: 'Gagal membaca kredit.' }, 502); }
  if (!bal) return json({ error: 'Profil belum dibuat. Muat ulang halaman.' }, 403);
  if (bal.bal <= 0) return json({ error: 'Kredit habis. Tunggu kredit harian atau ganti plan.' }, 402);

  // 3) panggil Gemini
  let body;
  try { body = await request.json(); } catch (e) { return json({ error: 'Permintaan tidak valid.' }, 400); }
  const mode = MODELS[body.mode] ? body.mode : 'chat';
  const msgs = Array.isArray(body.messages) ? body.messages.slice(-14) : [];
  const contents = msgs
    .filter((m) => m && typeof m.t === 'string' && m.t.trim())
    .map((m) => ({ role: m.r === 'u' ? 'user' : 'model', parts: [{ text: m.t.slice(0, 12000) }] }));
  if (!contents.length || contents[contents.length - 1].role !== 'user') return json({ error: 'Pesan kosong.' }, 400);

  let r;
  try {
    r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODELS[mode]}:streamGenerateContent?alt=sse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM[mode] }] },
        contents,
        generationConfig: { maxOutputTokens: 16384 },
      }),
    });
  } catch (e) { return json({ error: 'Server Terlalu Berat, coba lagi nanti' }, 503); }
  if (!r.ok) {
    if (BUSY.includes(r.status)) return json({ error: 'Server Terlalu Berat, coba lagi nanti' }, 503);
    return json({ error: 'Gemini ' + r.status + ': ' + (await r.text()).slice(0, 200) }, 502);
  }

  // 4) teruskan stream sambil menghitung kata, lalu potong kredit
  const { readable, writable } = new TransformStream();
  const w = writable.getWriter(), enc = new TextEncoder();
  const pump = async () => {
    const rd = r.body.getReader(), dec = new TextDecoder();
    let buf = '', used = 0, inWord = false, cut = false, alive = true;
    const count = (t) => { for (const ch of t) { if (/\s/.test(ch)) inWord = false; else if (!inWord) { used++; inWord = true; } } };
    try {
      while (!cut) {
        const { done, value } = await rd.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let out = '', i;
        while ((i = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, i + 1); buf = buf.slice(i + 1); out += line;
          const l = line.trim();
          if (l.startsWith('data:')) {
            try {
              const j = JSON.parse(l.slice(5));
              (((j.candidates || [{}])[0].content || {}).parts || []).forEach((p) => { if (p.text) count(p.text); });
            } catch (e) {}
          }
        }
        if (out) await w.write(enc.encode(out));
        if (used >= bal.bal) cut = true;
      }
    } catch (e) { alive = false; }
    try { rd.cancel(); } catch (e) {}
    let left = bal.bal;
    try { left = await rpc(env, 'spend_credits', { p_user: uid, p_amount: used }); } catch (e) {}
    if (alive) {
      try { await w.write(enc.encode('data: ' + JSON.stringify({ airlva: { credits: left, used: Math.min(used, bal.bal), cut } }) + '\n\n')); } catch (e) {}
    }
    try { await w.close(); } catch (e) {}
  };
  const p = pump();
  if (typeof context.waitUntil === 'function') context.waitUntil(p);
  return new Response(readable, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store' } });
}
