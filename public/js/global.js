// Chat Global: obrolan publik, balas pesan, indikator mengetik, pesan suara, bagikan project/kode
(function (A) {
  const $ = A.$, S = A.state;
  const COLS = 'id,user_id,name,avatar,kind,content,meta,reply_to,reply_name,reply_text,created_at';
  const G = { msgs: [], ids: new Set(), ch: null, typing: {}, reply: null, loaded: false, err: false, last: 0, busy: false, cur: null };
  const ICON = {
    code: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16"/></svg>',
    project: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h16v11H9l-5 4z"/></svg>',
    play: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',
    pause: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>',
    more: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>',
    x: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  };
  const near = () => { const m = $('main'); return m.scrollHeight - m.scrollTop - m.clientHeight < 200; };
  const toBottom = () => { const m = $('main'); m.scrollTop = m.scrollHeight; };
  const snippet = (m) => m.kind === 'voice' ? 'Pesan suara'
    : m.kind === 'image' ? 'Foto' + (m.content && m.content !== 'Foto' ? ': ' + m.content : '')
    : (m.kind === 'project' ? 'Project: ' : m.kind === 'code' ? 'Kode: ' : '') + m.content;
  const BUCKET = 'global-images';
  const imgUrl = (path) => S.sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

  // gelombang suara dekoratif (tinggi batang dari angka acak yang tetap)
  function fillWave(el, seed) {
    let s = ((Number(seed) || 1) * 7919) % 2147483647 || 1;
    el.innerHTML = '';
    for (let k = 0; k < 30; k++) {
      s = (s * 16807) % 2147483647;
      const b = document.createElement('i'); b.style.setProperty('--h', 6 + Math.round((s / 2147483647) * 20) + 'px');
      el.appendChild(b);
    }
  }
  function setProg(el, r) {
    const bars = el.children, on = Math.floor(Math.max(0, Math.min(1, r)) * bars.length);
    for (let k = 0; k < bars.length; k++) bars[k].classList.toggle('on', k < on);
  }

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

  // teks = bubble kotak kaca; project/kode/suara = kartu yang berdiri sendiri
  function row(m) {
    const mine = m.user_id === S.user.id;
    const el = document.createElement('div'); el.className = 'gm ' + (mine ? 'me' : 'ot'); el.dataset.id = m.id;
    if (!mine) el.appendChild(avatar(m));
    const col = document.createElement('div'); col.className = 'gcol';
    if (!mine) { const n = document.createElement('div'); n.className = 'gn'; n.textContent = m.name || 'Pengguna'; col.appendChild(n); }
    const solo = m.kind !== 'text';
    const b = document.createElement('div'); b.className = 'gb';
    if (m.reply_to) {
      const q = document.createElement('div'); q.className = 'rq' + (solo ? ' solo' : ''); q.dataset.to = m.reply_to;
      q.innerHTML = '<b></b><span></span>'; q.firstChild.textContent = m.reply_name || 'Pengguna'; q.lastChild.textContent = m.reply_text || '';
      (solo ? col : b).appendChild(q);
    }
    if (!solo) {
      const t = document.createElement('div'); t.className = 'gt'; t.textContent = m.content; b.appendChild(t);
      col.appendChild(b);
    } else {
      const x = document.createElement('div'); x.className = 'gx';
      if (m.kind === 'voice') {
        const v = document.createElement('div'); v.className = 'gvoice';
        v.innerHTML = '<button class="vp" aria-label="Putar"><span class="ic-play">' + ICON.play + '</span><span class="ic-pause">' + ICON.pause + '</span></button><div class="wv"></div><span class="vt"></span>';
        fillWave(v.querySelector('.wv'), m.id);
        v.querySelector('.vt').textContent = m.meta || '';
        x.appendChild(v);
      } else if (m.kind === 'image') {
        const w = document.createElement('div'); w.className = 'gimg';
        const box = document.createElement('div'); box.className = 'gib';
        const dim = /_(\d+)x(\d+)\.jpg$/.exec(m.meta || '');
        if (dim) box.style.aspectRatio = dim[1] + ' / ' + dim[2]; else box.style.aspectRatio = '4 / 3';
        const im = new Image(); im.alt = 'Foto'; im.loading = 'lazy'; im.src = imgUrl(m.meta || ''); box.appendChild(im); w.appendChild(box);
        if (m.content && m.content !== 'Foto') { const cp = document.createElement('div'); cp.className = 'gcap'; cp.textContent = m.content; w.appendChild(cp); }
        x.appendChild(w);
      } else {
        const c = document.createElement('button'); c.className = 'gcard';
        c.innerHTML = '<span class="ic">' + ICON[m.kind] + '</span><span class="at"><b></b><small></small></span>';
        c.querySelector('b').textContent = m.content; c.querySelector('small').textContent = m.meta || '';
        x.appendChild(c);
      }
      const more = document.createElement('button'); more.className = 'ib2 gmore'; more.setAttribute('aria-label', 'Opsi'); more.innerHTML = ICON.more;
      x.appendChild(more); col.appendChild(x);
    }
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

  function toggleActs(gm) {
    const act = gm.querySelector('.gact'), show = act.hidden;
    $('gmsgs').querySelectorAll('.gact').forEach((a) => (a.hidden = true)); act.hidden = !show;
  }

  function onTap(e) {
    const gm = e.target.closest('.gm'); if (!gm) return;
    const m = G.msgs.find((x) => String(x.id) === gm.dataset.id); if (!m) return;
    if (e.target.closest('.gcard')) { openShared(m); return; }
    if (e.target.closest('.vp')) { playVoice(m, e.target.closest('.gvoice')); return; }
    if (e.target.closest('.gib')) { openImage(m); return; }
    if (e.target.closest('.gmore')) { toggleActs(gm); return; }
    const q = e.target.closest('.rq');
    if (q) {
      const t = $('gmsgs').querySelector('.gm[data-id="' + q.dataset.to + '"]');
      if (t) { t.scrollIntoView({ block: 'center', behavior: 'smooth' }); t.classList.add('flash'); setTimeout(() => t.classList.remove('flash'), 1200); }
      return;
    }
    const b = e.target.closest('[data-a]');
    if (b) { $('gmsgs').querySelectorAll('.gact').forEach((a) => (a.hidden = true)); if (b.dataset.a === 'reply') setReply(m); else del(m); return; }
    if (e.target.closest('.gb')) toggleActs(gm);
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
    if (IM.blob) { sendImage(); return; }
    if (!t && R.state === 'done') { sendVoice(); return; }
    if (!t || G.busy) { if (!t) inp.focus(); return; }
    G.busy = true; inp.value = ''; inp.style.height = 'auto'; A.updateAction();
    const ok = await send({ content: t.slice(0, 2000) });
    if (!ok) { inp.value = t; A.updateAction(); }
    G.busy = false;
  };
  async function del(m) {
    const { error } = await S.sb.from('global_messages').delete().eq('id', m.id);
    if (error) { A.toast('⚠ Gagal menghapus'); return; }
    if (m.kind === 'image' && m.meta) S.sb.storage.from(BUCKET).remove([m.meta]);
    remove(m.id);
  }

  // ---- pesan suara: rekam ----
  const R = { audio: null, seed: 1, rec: null, chunks: [], stream: null, t0: 0, timer: null, blob: null, url: null, dur: 0, state: 'idle', cancel: false, mime: '' };
  const fmtDur = (s) => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');

  function paintVoice() {
    const p = $('rec');
    $('mic').classList.toggle('recording', R.state === 'rec' || R.state === 'stopping');
    if (R.state === 'idle') { p.hidden = true; p.innerHTML = ''; return; }
    p.hidden = false;
    if (R.state === 'done') {
      p.innerHTML = '<div class="gvoice pv"><button class="vp" data-v="play" aria-label="Putar"><span class="ic-play">' + ICON.play + '</span><span class="ic-pause">' + ICON.pause + '</span></button><div class="wv"></div><span class="vt"></span></div><button class="mini" data-v="cancel">Buang</button><button class="mini" data-v="send">Kirim</button>';
      const gv = p.querySelector('.gvoice'), wv = gv.querySelector('.wv');
      fillWave(wv, R.seed); setProg(wv, 0); gv.querySelector('.vt').textContent = fmtDur(R.dur);
      const a = new Audio(R.url); R.audio = a;
      a.onplay = () => gv.classList.add('on');
      a.onpause = () => gv.classList.remove('on');
      a.onended = () => { gv.classList.remove('on'); setProg(wv, 0); };
      a.ontimeupdate = () => { const d = isFinite(a.duration) && a.duration ? a.duration : R.dur; if (d) setProg(wv, a.currentTime / d); };
    } else {
      p.innerHTML = '<span class="rdot"></span><b id="rtm">0:00</b><span class="rh">Merekam…</span><button class="mini" data-v="cancel">Batal</button><button class="mini" data-v="stop">Stop</button>';
    }
  }
  function resetRec() {
    clearInterval(R.timer);
    if (R.audio) { R.audio.pause(); R.audio = null; }
    if (R.url) URL.revokeObjectURL(R.url);
    Object.assign(R, { rec: null, chunks: [], stream: null, blob: null, url: null, dur: 0, state: 'idle', cancel: false });
    paintVoice();
  }
  async function startRec() {
    if (R.state !== 'idle') return;
    if (!navigator.mediaDevices || !window.MediaRecorder) { A.toast('Perekam suara tidak didukung di browser ini'); return; }
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch (e) { A.toast('⚠ Izin mikrofon ditolak'); return; }
    const mt = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((t) => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t));
    let rec;
    try { rec = new MediaRecorder(stream, Object.assign({ audioBitsPerSecond: 24000 }, mt ? { mimeType: mt } : {})); }
    catch (e) { stream.getTracks().forEach((t) => t.stop()); A.toast('⚠ Gagal memulai rekaman'); return; }
    R.rec = rec; R.stream = stream; R.chunks = []; R.t0 = Date.now(); R.state = 'rec'; R.cancel = false;
    rec.ondataavailable = (e) => { if (e.data && e.data.size) R.chunks.push(e.data); };
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      if (R.cancel || !R.chunks.length) { resetRec(); return; }
      R.mime = rec.mimeType || mt || 'audio/webm';
      R.blob = new Blob(R.chunks, { type: R.mime });
      R.dur = Math.max(1, Math.round((Date.now() - R.t0) / 1000));
      R.url = URL.createObjectURL(R.blob); R.seed = Date.now() % 100000; R.state = 'done'; paintVoice();
    };
    rec.start();
    R.timer = setInterval(() => {
      const s = Math.floor((Date.now() - R.t0) / 1000), e = $('rtm');
      if (e) e.textContent = fmtDur(s);
      if (s >= 60) stopRec();
    }, 250);
    paintVoice();
  }
  function stopRec() {
    if (R.state !== 'rec') return;
    R.state = 'stopping'; clearInterval(R.timer);
    try { R.rec.stop(); } catch (e) { resetRec(); }
  }
  A.voiceCancel = function () {
    stopVoice(); resetImg();
    if (R.state === 'rec') { R.cancel = true; stopRec(); }
    else if (R.state !== 'idle') resetRec();
  };
  const toDataURL = (blob) => new Promise((res, rej) => { const f = new FileReader(); f.onload = () => res(f.result); f.onerror = rej; f.readAsDataURL(blob); });
  async function sendVoice() {
    if (R.state !== 'done' || G.busy) return;
    G.busy = true;
    try {
      const a = await toDataURL(R.blob);
      if (a.length > 450000) { A.toast('Rekaman terlalu besar'); G.busy = false; return; }
      const ok = await send({ kind: 'voice', content: 'Pesan suara', meta: fmtDur(R.dur), payload: { a, d: R.dur } });
      if (ok) resetRec();
    } catch (e) { A.toast('⚠ Gagal mengirim rekaman'); }
    G.busy = false;
  }

  // ---- pesan suara: putar ----
  function stopVoice() {
    if (G.cur) { G.cur.a.pause(); G.cur.el.classList.remove('on'); G.cur = null; }
  }
  async function playVoice(m, el) {
    if (G.cur && G.cur.id === m.id) { if (G.cur.a.paused) G.cur.a.play(); else G.cur.a.pause(); return; }
    stopVoice();
    const btn = el.querySelector('.vp'); btn.classList.add('load');
    if (!m._a) {
      const { data, error } = await S.sb.from('global_messages').select('payload').eq('id', m.id).single();
      if (error || !data || !data.payload || !data.payload.a) { btn.classList.remove('load'); A.toast('⚠ Gagal memutar'); return; }
      m._a = data.payload.a; m._d = data.payload.d || 0;
    }
    btn.classList.remove('load');
    const a = new Audio(m._a), wv = el.querySelector('.wv');
    G.cur = { id: m.id, a, el };
    a.onplay = () => el.classList.add('on');
    a.onpause = () => el.classList.remove('on');
    a.onended = () => { el.classList.remove('on'); setProg(wv, 0); G.cur = null; };
    a.ontimeupdate = () => { const d = isFinite(a.duration) && a.duration ? a.duration : m._d; if (d) setProg(wv, a.currentTime / d); };
    a.play().catch(() => A.toast('⚠ Gagal memutar'));
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
  A.pick = pick;
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

  // ---- kirim foto ----
  const IM = { blob: null, url: null, w: 0, h: 0 };
  function loadImg(file) {
    return new Promise((res, rej) => {
      const u = URL.createObjectURL(file), im = new Image();
      im.onload = () => { URL.revokeObjectURL(u); res(im); };
      im.onerror = () => { URL.revokeObjectURL(u); rej(new Error('gagal')); };
      im.src = u;
    });
  }
  async function pickImage(file) {
    if (!file) return;
    if (!/^image\//.test(file.type)) { A.toast('File harus berupa gambar'); return; }
    try {
      const im = await loadImg(file);
      const sc = Math.min(1, 1280 / Math.max(im.width, im.height));
      const w = Math.max(1, Math.round(im.width * sc)), hh = Math.max(1, Math.round(im.height * sc));
      const c = document.createElement('canvas'); c.width = w; c.height = hh;
      const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, hh); ctx.drawImage(im, 0, 0, w, hh);
      const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.82));
      if (!blob) throw new Error('gagal');
      if (blob.size > 2000000) { A.toast('Foto terlalu besar'); return; }
      resetImg(); IM.blob = blob; IM.w = w; IM.h = hh; IM.url = URL.createObjectURL(blob); paintImg();
    } catch (e) { A.toast('⚠ Gagal membaca foto'); }
  }
  function paintImg() {
    const p = $('ipv');
    if (!IM.blob) { p.hidden = true; p.innerHTML = ''; return; }
    p.hidden = false;
    p.innerHTML = '<img class="ithumb" alt="Foto"><div class="iinfo"><b>Foto siap dikirim</b><small></small></div><button class="mini" data-i="cancel">Batal</button><button class="mini" data-i="send">Kirim</button>';
    p.querySelector('img').src = IM.url;
    p.querySelector('small').textContent = IM.w + ' × ' + IM.h + ' · ' + Math.round(IM.blob.size / 1024) + ' KB · ketik teks untuk keterangan';
  }
  function resetImg() {
    if (IM.url) URL.revokeObjectURL(IM.url);
    IM.blob = null; IM.url = null; paintImg();
  }
  async function sendImage() {
    if (!IM.blob || G.busy) return;
    G.busy = true;
    const path = S.user.id + '/' + Date.now() + '_' + IM.w + 'x' + IM.h + '.jpg';
    const up = await S.sb.storage.from(BUCKET).upload(path, IM.blob, { contentType: 'image/jpeg', cacheControl: '31536000' });
    if (up.error) { A.toast('⚠ Gagal mengunggah foto (jalankan SQL terbaru)'); G.busy = false; return; }
    const inp = $('inp'), cap = inp.value.trim().slice(0, 500);
    const ok = await send({ kind: 'image', content: cap || 'Foto', meta: path });
    if (ok) { inp.value = ''; inp.style.height = 'auto'; A.updateAction(); resetImg(); }
    else S.sb.storage.from(BUCKET).remove([path]);
    G.busy = false;
  }
  function openImage(m) {
    const v = $('pview');
    v.innerHTML = '<div class="avh"><button class="ib" data-a="x" aria-label="Tutup">' + ICON.x + '</button><div class="avt"></div></div><div class="avb imgfull"></div>';
    v.querySelector('.avt').textContent = (m.name || 'Foto');
    const im = new Image(); im.alt = ''; im.src = imgUrl(m.meta || ''); v.querySelector('.imgfull').appendChild(im);
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
    $('mic').onclick = () => { if (!S.global) return; if (R.state === 'idle') startRec(); else if (R.state === 'rec') stopRec(); };
    $('rec').onclick = (e) => {
      const b = e.target.closest('[data-v]'); if (!b) return;
      const v = b.dataset.v;
      if (v === 'stop') stopRec();
      else if (v === 'send') sendVoice();
      else if (v === 'play') { if (R.audio) { if (R.audio.paused) R.audio.play(); else R.audio.pause(); } }
      else if (R.state === 'rec') { R.cancel = true; stopRec(); } else resetRec();
    };
    // tombol +: panel kecil naik dari bawah, lalu tombol-tombolnya muncul
    $('plus').onclick = () => { if (!S.global) return; $('psheet').classList.add('on'); A.overlay(true); };
    $('shf').onclick = () => { A.closeAll(); $('pfile').value = ''; $('pfile').click(); };
    $('shp').onclick = () => { A.closeAll(); A.shareProject(); };
    $('shc').onclick = () => { A.closeAll(); A.shareCode(); };
    $('pfile').onchange = (e) => pickImage(e.target.files[0]);
    $('ipv').onclick = (e) => {
      const b = e.target.closest('[data-i]'); if (!b) return;
      if (b.dataset.i === 'send') sendImage(); else resetImg();
    };
  };
})(window.AirLva);
