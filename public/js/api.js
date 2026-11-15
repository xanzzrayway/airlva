// Klien streaming ke /api/chat (Gemini lewat server)
(function (A) {
  A.stream = async function (mode, messages, onText) {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode, messages }),
    });
    if (!res.ok) {
      if ([404, 405, 501].includes(res.status))
        throw new Error('Endpoint /api/chat belum aktif. Jalankan "node server.js" atau deploy ke Cloudflare Pages.');
      let m = 'Server error ' + res.status;
      try { m = (await res.json()).error || m; } catch (e) {}
      throw new Error(m);
    }
    const rd = res.body.getReader(), dec = new TextDecoder();
    let buf = '';
    for (;;) {
      const { done, value } = await rd.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
        if (!line.startsWith('data:')) continue;
        const d = line.slice(5).trim();
        if (!d || d === '[DONE]') continue;
        try {
          const parts = (JSON.parse(d).candidates || [{}])[0].content?.parts || [];
          parts.forEach((p) => { if (p.text) onText(p.text); });
        } catch (e) {}
      }
    }
  };
})(window.AirLva);
