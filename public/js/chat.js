// Chatbox, animasi mengetik, box task, dan artefak
(function (A) {
  const $ = A.$, S = A.state;
  const P = () => S.projects[S.cur];
  const WAVE = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 10v4M8 7v10M12 4v16M16 8v8M20 11v2"/></svg>';
  const SEND = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';
  const CODE = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16"/></svg>';
  const LOGO = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 15c3-1 4-5 8-5s4 4 10 3M5 19c2-.5 3-3 6-3s3 2 8 2"/></svg>';
  const EXP = 2500; // perkiraan panjang hasil untuk centang task
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const escA = (s) => esc(s).replace(/"/g, '&quot;');
  A.esc = esc; A.escA = escA;

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
  const bestCode = (text) => blocks(text).filter((b) => b.code).reduce((a, b) => (b.body.length > a.body.length ? b : a), { body: '', lang: '' });
  A.parse = parse; A.bestCode = bestCode;
  A.artTitle = function (ai, code) {
    if (ai.mode === 'website' || code.lang === 'html') {
      const m = code.body.match(/<title>([^<]{1,60})<\/title>/i);
      return m && m[1].trim() ? m[1].trim() : 'Website';
    }
    return 'Kode' + (code.lang ? ' ' + code.lang : '');
  };

  // ---- DOM balasan AI dibuat sekali, lalu hanya diperbarui seperlunya (ringan) ----
  const setText = (el, v) => { if (el._v !== v) { el._v = v; el.textContent = v; } };
  function build(ai) {
    const el = document.createElement('div'); el.className = 'ai';
    el.innerHTML = '<div class="ld" hidden><span class="lgo">' + LOGO + '</span></div><div class="task" hidden><div class="th">Task</div><ul></ul></div><div class="atext"></div><div class="mk" hidden><span class="lgo'+'">' + LOGO + '</span><span>Membuat Kode</span></div><div class="artw"></div>';
    ai.el = el;
    ai.q = { ld: el.querySelector('.ld'), task: el.querySelector('.task'), ul: el.querySelector('ul'), txt: el.querySelector('.atext'), mk: el.querySelector('.mk'), art: el.querySelector('.artw'), akey: '' };
    return el;
  }
  function syncTasks(q, tasks, done, typing) {
    while (q.ul.children.length < tasks.length) q.ul.insertAdjacentHTML('beforeend', '<li><i></i><span></span></li>');
    while (q.ul.children.length > tasks.length) q.ul.lastChild.remove();
    tasks.forEach((x, i) => {
      const li = q.ul.children[i], c = i < done ? 'done' : i === done && typing ? 'run' : '';
      setText(li.lastChild, x);
      if (li.className !== c) li.className = c;
    });
  }
  function paint(ai, typing) {
    const q = ai.q; if (!q) return;
    const text = typing ? ai.t.slice(0, ai.shown || 0) : ai.t;
    ai.el.classList.toggle('err', !!ai.err);
    q.ld.hidden = !(typing && !ai.t.length);
    if (ai.mode === 'chat' || ai.err) { setText(q.txt, text); return; }
    const p = parse(text), bl = blocks(p.hasil), n = p.tasks.length;
    q.task.hidden = !n;
    if (n) {
      const done = !typing ? n : !p.has ? Math.max(0, n - 1) : Math.min(n - 1, Math.floor((p.hasil.length / EXP) * n));
      syncTasks(q, p.tasks, done, typing);
    }
    setText(q.txt, bl.filter((b) => !b.code).map((b) => b.body.trim()).filter(Boolean).join('\n\n').replace(/`{1,2}$/, ''));
    q.mk.hidden = !(typing && bl.some((b) => b.code));
    if (!typing) {
      const code = bestCode(p.hasil);
      if (code.body) {
        const key = code.body.length + ':' + code.lang;
        if (q.akey !== key) {
          q.akey = key;
          q.art.innerHTML = '<button class="art"><span class="ic">' + CODE + '</span><span class="at"><b>' + esc(A.artTitle(ai, code)) +
            '</b><small>Artefak · ' + esc(code.lang || 'kode') + '</small></span><span class="ch">›</span></button>';
          q.art.firstChild.onclick = () => A.openArtifact(ai);
        }
      }
    }
  }

  A.renderMessages = function () {
    const p = P(), m = $('main'); m.innerHTML = '';
    const w = document.createElement('div'); w.className = 'msgs';
    if (p.mode) { const t = document.createElement('div'); t.className = 'tag'; t.textContent = 'Mode: ' + p.mode; w.appendChild(t); }
    p.msgs.forEach((x) => {
      if (x.r === 'u') { const d = document.createElement('div'); d.className = 'm u'; d.textContent = x.t; w.appendChild(d); }
      else { w.appendChild(build(x)); paint(x, !!x.live); }
    });
    m.appendChild(w); m.scrollTop = m.scrollHeight;
    A.updateAction();
  };

  A.renderStatic = function (container, msgs) {
    msgs.forEach((x) => {
      if (x.r === 'u') { const d = document.createElement('div'); d.className = 'm u'; d.textContent = x.t; container.appendChild(d); }
      else { const o = { r: x.r, t: x.t, mode: x.mode }; container.appendChild(build(o)); paint(o, false); }
    });
  };

  // animasi mengetik cepat tanpa kursor; bagian kode langsung muncul instan
  const inCode = (t, s) => (t.slice(0, s).split('```').length - 1) % 2 === 1;
  function typeLoop(ai) {
    return new Promise((res) => {
      (function tick() {
        const len = ai.t.length; let s = ai.shown || 0;
        if (s < len) {
          if (ai.mode !== 'chat' && inCode(ai.t, s)) { const e = ai.t.indexOf('```', s); s = e >= 0 ? e + 3 : len; }
          else s = Math.min(len, s + Math.max(6, Math.ceil((len - s) / 6)));
          ai.shown = s; paint(ai, true); stick();
        } else if (ai.streamDone) return res();
        requestAnimationFrame(tick);
      })();
    });
  }

  const friendly = (e) => e instanceof TypeError
    ? 'Tidak bisa terhubung ke server. Buka lewat alamat Cloudflare Pages.'
    : e.message;

  A.send = async function () {
    if (S.global) return A.globalSend();
    const inp = $('inp'), t = inp.value.trim();
    if (!t) { inp.focus(); return; }
    const proj = P(), info = proj && A.modeInfo(proj.mode);
    if (A.busy || !info) return;
    if (S.profile && S.profile.credits <= 0) { A.toast('Kredit habis. Tunggu kredit harian atau ganti plan.'); return; }
    proj.msgs.push({ r: 'u', t });
    A.fire(A.dbMsg(proj, { r: 'u', t }));
    const history = proj.msgs.filter((m) => !m.err).map((m) => ({ r: m.r, t: m.t }));
    const ai = { r: 'a', t: '', mode: info.key, live: true, streamDone: false, shown: 0 };
    proj.msgs.push(ai);
    inp.value = ''; inp.style.height = 'auto';
    A.renderMessages();
    A.busy = true;
    let error = null, meta = null;
    A.stream(info.key, history, (c) => { ai.t += c; }, (m) => { meta = m; A.setCredits(m.credits); })
      .catch((e) => { error = e; })
      .finally(() => { ai.streamDone = true; });
    await typeLoop(ai);
    if (error) {
      if (!ai.t) { ai.err = true; ai.t = '⚠ ' + friendly(error); } else ai.t += '\n\n⚠ Koneksi terputus.';
    }
    if (meta && meta.cut) ai.t += '\n\n⚠ Kredit habis, jawaban dihentikan.';
    ai.live = false; ai.shown = ai.t.length;
    paint(ai, false); stick();
    if (ai.t && !ai.err) A.fire(A.dbMsg(proj, { r: 'a', t: ai.t, mode: ai.mode }));
    A.busy = false;
  };

  A.initChat = function () {
    $('inp').oninput = (e) => {
      e.target.style.height = 'auto';
      e.target.style.height = e.target.scrollHeight + 'px';
      A.updateAction();
      if (S.global && A.globalTyping) A.globalTyping();
    };
    $('act').onclick = A.send;
  };
})(window.AirLva);
