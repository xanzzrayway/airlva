const MODELS = {
  chat: 'gemini-3.5-flash-lite',
  website: 'gemini-3.5-flash',
  code: 'gemini-3.8-flash',
};
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

export async function onRequestPost({ request, env }) {
  if (!env.GEMINI_API_KEY) return json({ error: 'GEMINI_API_KEY belum diatur di server.' }, 500);
  let body;
  try { body = await request.json(); } catch (e) { return json({ error: 'Permintaan tidak valid.' }, 400); }
  const mode = MODELS[body.mode] ? body.mode : 'chat';
  const msgs = Array.isArray(body.messages) ? body.messages.slice(-14) : [];
  const contents = msgs
    .filter((m) => m && typeof m.t === 'string' && m.t.trim())
    .map((m) => ({ role: m.r === 'u' ? 'user' : 'model', parts: [{ text: m.t.slice(0, 12000) }] }));
  if (!contents.length || contents[contents.length - 1].role !== 'user')
    return json({ error: 'Pesan kosong.' }, 400);

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODELS[mode]}:streamGenerateContent?alt=sse`;
  let r;
  try {
    r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM[mode] }] },
        contents,
        generationConfig: { maxOutputTokens: 16384 },
      }),
    });
  } catch (e) {
    return json({ error: 'Server tidak bisa menjangkau Gemini.' }, 502);
  }
  if (!r.ok) {
    const t = await r.text();
    return json({ error: 'Gemini ' + r.status + ': ' + t.slice(0, 200) }, 502);
  }
  return new Response(r.body, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store' } });
}
