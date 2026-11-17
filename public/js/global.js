// Chat Global: obrolan publik, balas pesan, indikator mengetik, bagikan project/kode
(function (A) {
  const $ = A.$, S = A.state;
  const COLS = 'id,user_id,name,avatar,kind,content,meta,reply_to,reply_name,reply_text,created_at';
  const G = { msgs: [], ids: new Set(), ch: null, typing: {}, reply: null, loaded: false, err: false, last: 0, busy: false };
  const ICON = {
    code: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16"/></svg>',
    project: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h16v11H9l-5 4z"/></svg>',
    x: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  };
  const near = () => { const m = $('main'); return m.scrollHeight - m.scrollTop - m.clientHeight < 200; };
  const toBottom = () => { const m = $('main'); m.scrollTop = m.scrollHeight; };
  const snippet = (m) => (m.kind === 'project' ? 'Project: ' : m.kind === 'code' ? 'Kode: ' : '') + m.content;

  function avatar(m) {
    const a = document.createElement('span'); a.className = 'av sm';
    a.textContent = (m.name || '?').trim().charAt(0).toUpperCase();
    if (m.avatar) {
      const im = new Image(); im.referrerPolicy = 'no-referrer'; im.alt = '';
      im.onload = () => { a.textContent = ''; a.appendChild(im); };
      im.src = m.avatar;
    }
    return a;
  }

  function row(m) {
    const mine = m.user_id === S.user.id;
    const el = document.createElement('div'); el.className = 'gm ' + (mine ? 'me' : 'ot'); el.dataset.id = m.id;
    if (!mine) el.appendChild(avatar(m));
    const col = document.createElement('div'); col.className = 'gcol';
    if (!mine) { const n = document.createElement('div'); n.className = 'gn'; n.textContent = m.name || 'Pengguna'; col.appendChild(n); }
    const b = document.createElement('div'); b.className = 'gb';
    if (m.reply_to) {
      const q = document.createElement('div'); q.className = 'rq'; q.dataset.to = m.reply_to;
      q.innerHTML = '<b></b><span></span>'; q.firstChild.textContent = m.reply_name || 'Pengguna'; q.lastChild.textContent = m.reply_text || '';
      b.appendChild(q);
    }
    if (m.kind === 'text') { const t = document.createElement('div'); t.className = 'gt'; t.textContent = m.content; b.appendChild(t); }
    else {
      const c = document.createElement('button'); c.className = 'gcard';
      c.innerHTML = '<span class="ic">' + ICON[m.kind] + '</span><span class="at"><b></b><small></small></span>';
      c.querySelector('b').textContent = m.content; c.querySelector('small').textContent = m.meta || '';
      b.appendChild(c);
    }
    col.appendChild(b);
    const act = document.createElement('div'); act.className = 'gact'; act.hidden = true;
    act.innerHTML = '<button class="mini" data-a="reply">Balas</button>' + (mine ? '<button class="mini" data-a="del">Hapus</button>' : '');
    col.appendChild(act); el.appendChild(col);
    return el;
  }

  // ---- tampilan ----
  A.renderGlobal = function () {
    const m = $('main'); m.innerHTML = '';
    const w = document.createElement('div'); w.className = 'gmsgs'; w.id = 'gmsgs';
    if (G.err) w.innerHTML = '<div class="gempty">Chat Global belum aktif. Jalankan SQL terbaru di Supabase.</div>';
    else if (!G.loaded) w.innerHTML = '<div class="gempty">Memuat…</div>';
    else if (!G.msgs.length) w.innerHTML = '<div class="gempty">Belum ada pesan. Jadilah yang pertama menyapa!</div>';
    else G.msgs.forEach((x) => w.appendChild(row(x)));
    const t = document.createElement('div'); t.className = 'gtyping'; t.id = 'gtyping'; t.hidden = true; w.appendChild(t);
    m.appendChild(w);
    w.onclick = onTap;
    toBottom(); renderTyping(); updateReplyBar(); A.updateAction();
  };

  function onTap(e) {
    const gm = e.target.closest('.gm'); if (!gm) return;
    const m = G.msgs.find((x) => String(x.id) === gm.dataset.id); if (!m) return;
    if (e.target.closest('.gcard')) { openShared(m); return; }
    const q = e.target.closest('.rq');
    if (q) {
      const t = $('gmsgs').querySelector('.gm[data-id="' + q.dataset.to + '"]');
      if (t) { t.scrollIntoView({ block: 'center', behavior: 'smooth' }); t.classList.add('flash'); setTimeout(() => t.classList.remove('flash'), 1200); }
      return;
    }
    const b = e.target.closest('[data-a]');
    if (b) { $('gmsgs').querySelectorAll('.gact').forEach((a) => (a.hidden = true)); if (b.dataset.a === 'reply') setReply(m); else del(m); return; }
    if (e.target.closest('.gb')) {
      const act = gm.querySelector('.gact'), show = act.hidden;
      $('gmsgs').querySelectorAll('.gact').forEach((a) => (a.hidden = true)); act.hidden = !show;
    }
  }

  function add(m) {
    m.id = Number(m.id); delete m.payload;
    if (G.ids.has(m.id)) return;
    G.ids.add(m.id); G.msgs.push(m); delete G.typing[m.user_id];
    if (!S.global) return;
    const w = $('gmsgs'); if (!w) return;
    const e = w.querySelector('.gempty'); if (e) e.remove();
    const stick = near() || m.user_id === S.user.id;
    w.insertBefore(row(m), $('gtyping')); renderTyping();
    if (stick) toBottom();
  }
  function remove(id) {
    id = Number(id); G.msgs = G.msgs.filter((x) => x.id !== id); G.ids.delete(id);
    const e = document.querySelector('.gm[data-id="' + id + '"]'); if (e) e.remove();
  }

  // ---- indikator mengetik ----
  function renderTyping() {
    const el = $('gtyping'); if (!el) return;
    const now = Date.now(), names = [];
    for (const k in G.typing) { if (now - G.typing[k].t > 3500) delete G.typing[k]; else names.push(G.typing[k].name); }
    if (!names.length) { el.hidden = true; el._v = ''; return; }
    const txt = names.length === 1 ? names[0] + ' sedang mengetik' : names.length === 2 ? names[0] + ' dan ' + names[1] + ' sedang mengetik' : 'Beberapa orang sedang mengetik';
    if (el._v !== txt) { el._v = txt; el.innerHTML = '<span></span><i class="dots"><u></u><u></u><u></u></i>'; el.firstChild.textContent = txt; }
    const was = el.hidden; el.hidden = false;
    if (was && near()) toBottom();
  }
  A.globalTyping = function () {
    const n = Date.now();
    if (n - G.last < 2000 || !G.ch) return;
    G.last = n;
    G.ch.send({ type: 'broadcast', event: 'typing', payload: { uid: S.user.id, name: (S.profile && S.profile.name) || 'Seseorang' } });
  };

  // ---- balas ----
  function setReply(m) { G.reply = { id: m.id, name: m.name || 'Pengguna', text: snippet(m).slice(0, 80) }; updateReplyBar(); $('inp').focus(); }
  function updateReplyBar() {
    const b = $('rbar');
    if (!G.reply || !S.global) { b.hidden = true; return; }
    b.hidden = false;
    b.innerHTML = '<div class="rtx"><b></b><span></span></div><button class="ib2" id="rcancel" aria-label="Batal">' + ICON.x + '</button>';
    b.querySelector('b').textContent = 'Membalas ' + G.reply.name; b.querySelector('span').textContent = G.reply.text;
    $('rcancel').onclick = () => { G.reply = null; updateReplyBar(); };
  }

  // ---- kirim ----
  async function send(o) {
    const row0 = { content: o.content, kind: o.kind || 'text', meta: o.meta || null, payload: o.payload || null, reply_to: G.reply ? G.reply.id : null };
    const { data, error } = await S.sb.from('global_messages').insert(row0).select(COLS).single();
    if (error) { A.toast('⚠ Gagal mengirim'); return false; }
    G.reply = null; updateReplyBar(); add(data); return true;
  }
  A.globalSend = async function () {
    const inp = $('inp'), t = inp.value.trim();
    if (!t || G.busy) { if (!t) inp.focus(); return; }
    G.busy = true; inp.value = ''; inp.style.height = 'auto'; A.updateAction();
    const ok = await send({ content: t.slice(0, 2000) });
    if (!ok) { inp.value = t; A.updateAction(); }
    G.busy = false;
  };
  async function del(m) {
    const { error } = await S.sb.from('global_messages').delete().eq('id', m.id);
    if (error) A.toast('⚠ Gagal menghapus'); else remove(m.id);
  }

  // ---- bagikan project / kode ----
  function pick(title, items, empty) {
    return new Promise((res) => {
      const d = $('dlg');
      d.innerHTML = '<div class="grab"></div><h3>' + A.esc(title) + '</h3>' +
        (items.length ? '<div class="plist2">' + items.map((it, i) => '<button class="pk" data-i="' + i + '"><b>' + A.esc(it.label) + '</b><small>' + A.esc(it.sub || '') + '</small></button>').join('') + '</div>' : '<p>' + A.esc(empty) + '</p>') +
        '<button class="btn" id="dno">Batal</button>';
      const done = (v) => { d.classList.remove('on'); A._dlgCancel = null; A.overlay($('drawer').classList.contains('on')); res(v); };
      A._dlgCancel = () => done(null);
      $('dno').onclick = () => done(null);
      d.querySelectorAll('.pk').forEach((b) => (b.onclick = () => done(items[+b.dataset.i])));
      d.classList.add('on'); A.overlay(true);
    });
  }
  A.shareProject = async function () {
    const items = S.projects.map((p) => ({ label: p.name, sub: (A.modeInfo(p.mode) || { label: 'Belum ada mode' }).label, p }));
    const it = await pick('Bagikan project', items, 'Belum ada project.');
    if (!it) return;
    const p = it.p;
    if (!p.loaded) { try { await A.loadMsgs(p); } catch (e) { A.toast('⚠ Gagal memuat project'); return; } }
    const msgs = p.msgs.filter((m) => !m.err && m.t).slice(-12).map((m) => ({ r: m.r, t: m.t.slice(0, 8000), mode: m.mode || null }));
    if (!msgs.length) { A.toast('Project masih kosong'); return; }
    await send({ kind: 'project', content: p.name, meta: 'Project · ' + msgs.length + ' pesan', payload: { name: p.name, mode: p.mode, msgs } });
  };
  A.shareCode = async function () {
    const { data, error } = await S.sb.from('messages').select('id,content,mode').eq('role', 'a').in('mode', ['website', 'code']).order('id', { ascending: false }).limit(30);
    if (error) { A.toast('⚠ Gagal memuat kode'); return; }
    const items = [];
    (data || []).forEach((m) => {
      const c = A.bestCode(A.parse(m.content).hasil);
      if (c.body) items.push({ label: A.artTitle({ mode: m.mode }, c), sub: (c.lang || 'kode') + ' · ' + A.fmt(c.body.length) + ' karakter', c, mode: m.mode });
    });
    const it = await pick('Bagikan kode', items, 'Belum ada kode yang dibuat.');
    if (!it) return;
    await send({ kind: 'code', content: it.label, meta: 'Kode · ' + (it.c.lang || 'kode'), payload: { lang: it.c.lang, mode: it.mode, code: it.c.body.slice(0, 60000) } });
  };

  async function openShared(m) {
    A.toast('Membuka…');
    const { data, error } = await S.sb.from('global_messages').select('payload').eq('id', m.id).single();
    if (error || !data || !data.payload) { A.toast('⚠ Gagal membuka'); return; }
    const p = data.payload;
    if (m.kind === 'code') { A.openArtifact({ mode: p.mode || 'code', t: '<hasil>\n```' + (p.lang || '') + '\n' + p.code + '\n```\n</hasil>' }); return; }
    const v = $('pview');
    v.innerHTML = '<div class="avh"><button class="ib" data-a="x" aria-label="Tutup">' + ICON.x + '</button><div class="avt"></div></div><div class="avb pvb"><div class="msgs"></div></div>';
    v.querySelector('.avt').textContent = p.name || m.content;
    A.renderStatic(v.querySelector('.msgs'), p.msgs || []);
    v.onclick = (e) => { if (e.target.closest('[data-a="x"]')) { v.classList.remove('on'); setTimeout(() => (v.innerHTML = ''), 320); } };
    requestAnimationFrame(() => v.classList.add('on'));
  }

  // ---- koneksi ----
  async function load() {
    const { data, error } = await S.sb.from('global_messages').select(COLS).order('id', { ascending: false }).limit(100);
    if (error) throw error;
    G.msgs = (data || []).reverse().map((x) => ({ ...x, id: Number(x.id) }));
    G.ids = new Set(G.msgs.map((x) => x.id)); G.loaded = true; G.err = false;
  }
  function subscribe() {
    if (G.ch) return;
    G.ch = S.sb.channel('airlva-global', { config: { broadcast: { self: false } } })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'global_messages' }, (p) => add(p.new))
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'global_messages' }, (p) => remove(p.old.id))
      .on('broadcast', { event: 'typing' }, (p) => {
        const d = p.payload; if (!d || d.uid === S.user.id) return;
        G.typing[d.uid] = { name: d.name || 'Seseorang', t: Date.now() }; renderTyping();
      })
      .subscribe();
    setInterval(renderTyping, 1000);
    // cadangan: ambil pesan baru tiap 6 detik kalau realtime terlambat
    setInterval(async () => {
      if (!S.global || document.hidden || !G.loaded) return;
      const last = G.msgs.length ? G.msgs[G.msgs.length - 1].id : 0;
      const { data } = await S.sb.from('global_messages').select(COLS).gt('id', last).order('id');
      (data || []).forEach(add);
    }, 6000);
  }

  A.openGlobal = async function () {
    S.global = true;
    $('ptitle').textContent = 'Chat Global';
    A.setPill(); A.render();
    try { if (!G.loaded) await load(); subscribe(); } catch (e) { G.err = true; }
    if (S.global) A.render();
  };

  A.initGlobal = function () {
    $('gchat').onclick = () => { A.openGlobal(); A.closeAll(); };
    $('plus').onclick = (e) => { if (!S.global) return; e.stopPropagation(); $('pmenu').hidden = !$('pmenu').hidden; };
    $('shp').onclick = () => { $('pmenu').hidden = true; A.shareProject(); };
    $('shc').onclick = () => { $('pmenu').hidden = true; A.shareCode(); };
    document.addEventListener('click', (e) => { if (!e.target.closest('#pmenu') && !e.target.closest('#plus')) $('pmenu').hidden = true; });
  };
})(window.AirLva);
