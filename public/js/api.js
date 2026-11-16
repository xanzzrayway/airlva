// Klien streaming ke /api/chat (Gemini lewat server, kredit dipotong di server)
(function (A) {
  A.stream = async function (mode, messages, onText, onMeta) {
    const { data } = await A.state.sb.auth.getSession();
    const tok = data.session && data.session.access_token;
    if (!tok) throw new Error('Sesi habis. Silakan masuk lagi.');
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok },
      body: JSON.stringify({ mode, messages }),
    });
    if (!res.ok) {
      if ([404, 405, 501].includes(res.status)) throw new Error('Endpoint /api/chat belum aktif. Pastikan folder functions ikut ter-deploy.');
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
          const j = JSON.parse(d);
          if (j.airlva) { if (onMeta) onMeta(j.airlva); continue; }
          const parts = (j.candidates || [{}])[0].content?.parts || [];
          parts.forEach((p) => { if (p.text) onText(p.text); });
        } catch (e) {}
      }
    }
  };
})(window.AirLva);
