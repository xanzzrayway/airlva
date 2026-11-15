// Chatbox, animasi mengetik, box task & hasil
(function (A) {
  const $ = A.$, S = A.state;
  const WAVE = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 10v4M8 7v10M12 4v16M16 8v8M20 11v2"/></svg>';
  const SEND = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';
  const EXP = 2500; // perkiraan panjang hasil, untuk animasi centang task
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const escA = (s) => esc(s).replace(/"/g, '&quot;');

  A.updateAction = () => { $('act').innerHTML = $('inp').value.trim() ? SEND : WAVE; };
  const stick = () => { const m = $('main'); if (m.scrollHeight - m.scrollTop - m.clientHeight < 160) m.scrollTop = m.scrollHeight; };

  // ---- parsing format <tugas>/<hasil> ----
  function parse(raw) {
    const s = raw.replace(/<[^>\n]{0,20}$/, '');
    const t = s.match(/<tugas>([\s\S]*?)(?:<\/tugas>|$)/);
    const tasks = t ? t[1].split('\n').map((x) => x.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim()).filter((x) => x && !/[<>]/.test(x)) : [];
    const h = s.match(/<hasil>([\s\S]*?)(?:<\/hasil>|$)/);
    const has = !!h || (!t && s.trim() && !s.trim().startsWith('<'));
    return { tasks, has: !!has, hasil: (h ? h[1] : t ? '' : s).replace(/^\n+/, '') };
  }
  function blocks(text) {
    return text.split('```').map((p, i) => {
      if (i % 2 === 0) return { code: false, body: p };
      const nl = p.indexOf('\n');
      return { code: true, lang: (nl >= 0 ? p.slice(0, nl) : p).trim().toLowerCase(), body: nl >= 0 ? p.slice(nl + 1).replace(/\n$/, '') : '' };
    });
  }
  const renderHasil = (text) => blocks(text).map((b) => b.code ? '<pre><code>' + esc(b.body) + '</code></pre>' : (b.body.trim() ? '<p>' + esc(b.body.trim()) + '</p>' : '')).join('');
  const bestCode = (text) => blocks(text).filter((b) => b.code).reduce((a, b) => (b.body.length > a.body.length ? b : a), { body: '', lang: '' });

  // ---- menggambar balasan AI (tanpa bubble) ----
  function paint(ai, typing) {
    const el = ai.el; if (!el) return;
    const text = typing ? ai.t.slice(0, ai.shown || 0) : ai.t;
    const cur = typing ? '<span class="cur"></span>' : '';
    el.classList.toggle('err', !!ai.err);
    if (ai.mode === 'chat' || ai.err) { el.innerHTML = esc(text) + cur; return; }
    const p = parse(text);
    let h = '';
    if (p.tasks.length) {
      const n = p.tasks.length;
      const done = !typing ? n : !p.has ? Math.max(0, n - 1) : Math.min(n - 1, Math.floor((p.hasil.length / EXP) * n));
      h += '<div class="task"><div class="th">Task</div><ul>' + p.tasks.map((x, i) =>
        '<li class="' + (i < done ? 'done' : i === done && typing ? 'run' : '') + '"><i></i><span>' + esc(x) + '</span></li>').join('') + '</ul></div>';
    }
    if (p.has || !typing) {
      const code = !typing ? bestCode(p.hasil) : null;
      const btns = code && code.body
        ? '<div class="ra"><button class="mini" data-act="copy">Salin</button>' +
          (ai.mode === 'website' ? '<button class="mini" data-act="pv">' + (ai.preview ? 'Kode' : 'Pratinjau') + '</button>' : '') +
          '<button class="mini" data-act="dl">Unduh</button></div>' : '';
      const body = ai.preview && code ? '<iframe class="pv" sandbox="allow-scripts" srcdoc="' + escA(code.body) + '"></iframe>' : renderHasil(p.hasil) + cur;
      h += '<div class="res"><div class="rh"><span>Hasil</span>' + btns + '</div><div class="rb">' + body + '</div></div>';
    } else if (!p.tasks.length) h += cur;
    el.innerHTML = h;
  }

  function copy(txt) {
    const fb = () => { const t = document.createElement('textarea'); t.value = txt; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); } catch (e) {} t.remove(); };
    try { navigator.clipboard.writeText(txt).catch(fb); } catch (e) { fb(); }
  }
  const EXT = { html: 'html', javascript: 'js', js: 'js', python: 'py', py: 'py', css: 'css', json: 'json', bash: 'sh', sh: 'sh', java: 'java', php: 'php', cpp: 'cpp', c: 'c' };

  function mountAI(ai) {
    const el = document.createElement('div'); el.className = 'ai'; ai.el = el;
    el.onclick = (e) => {
      const b = e.target.closest('[data-act]'); if (!b || ai.live) return;
      const code = bestCode(parse(ai.t).hasil), act = b.dataset.act;
      if (act === 'copy') { copy(code.body); b.textContent = 'Tersalin ✓'; setTimeout(() => (b.textContent = 'Salin'), 1200); }
      if (act === 'pv') { ai.preview = !ai.preview; paint(ai, false); }
      if (act === 'dl') {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([code.body], { type: 'text/plain' }));
        a.download = 'airlva-' + (ai.mode === 'website' ? 'website.html' : 'kode.' + (EXT[code.lang] || 'txt'));
        a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      }
    };
    if (ai.live) { ai.shown = 0; paint(ai, true); } else paint(ai, false);
    return el;
  }

  A.renderMessages = function () {
    const m = $('main'); m.innerHTML = '';
    const w = document.createElement('div'); w.className = 'msgs';
    if (S.mode) { const t = document.createElement('div'); t.className = 'tag'; t.textContent = 'Mode: ' + S.mode; w.appendChild(t); }
    S.msgs.forEach((x) => {
      if (x.r === 'u') { const d = document.createElement('div'); d.className = 'm u'; d.textContent = x.t; w.appendChild(d); }
      else w.appendChild(mountAI(x));
    });
    m.appendChild(w); m.scrollTop = m.scrollHeight;
    A.updateAction();
  };

  // animasi mengetik: teks dari stream masuk antrean, ditampilkan sedikit demi sedikit
  function typeLoop(ai) {
    return new Promise((res) => {
      (function tick() {
        const len = ai.t.length;
        if ((ai.shown || 0) < len) {
          ai.shown = Math.min(len, (ai.shown || 0) + Math.max(2, Math.ceil((len - ai.shown) / 25)));
          paint(ai, true); stick();
        } else if (ai.streamDone) return res();
        requestAnimationFrame(tick);
      })();
    });
  }

  function friendly(e) {
    return e instanceof TypeError
      ? 'Tidak bisa terhubung ke server. Buka lewat alamat Cloudflare Pages atau jalankan "node server.js" (jangan buka index.html langsung).'
      : e.message;
  }

  A.send = async function () {
    const inp = $('inp'), t = inp.value.trim();
    if (!t) { inp.focus(); return; }
    const info = A.modeInfo(S.mode);
    if (A.busy || !info) return;
    S.msgs.push({ r: 'u', t });
    const history = S.msgs.filter((m) => !m.err).map((m) => ({ r: m.r, t: m.t }));
    const ai = { r: 'a', t: '', mode: info.key, live: true, streamDone: false, shown: 0 };
    S.msgs.push(ai);
    inp.value = ''; inp.style.height = 'auto';
    A.renderMessages();
    A.busy = true;
    let error = null;
    A.stream(info.key, history, (c) => { ai.t += c; })
      .catch((e) => { error = e; })
      .finally(() => { ai.streamDone = true; });
    await typeLoop(ai);
    if (error) {
      if (!ai.t) { ai.err = true; ai.t = '⚠ ' + friendly(error); } else ai.t += '\n\n⚠ Koneksi terputus.';
    }
    ai.live = false; paint(ai, false); A.busy = false; stick();
  };

  A.initChat = function () {
    $('inp').oninput = (e) => {
      e.target.style.height = 'auto';
      e.target.style.height = e.target.scrollHeight + 'px';
      A.updateAction();
    };
    $('act').onclick = A.send;
  };
})(window.AirLva);
