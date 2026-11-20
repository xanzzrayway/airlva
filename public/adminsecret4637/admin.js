// Admin panel tersembunyi: request kode, pop up, pengguna. Akses dijaga database (is_admin).
(function () {
  const $ = (id) => document.getElementById(id);
  const h = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const toast = (t) => { const e = $('toast'); e.textContent = t; e.classList.add('on'); clearTimeout(toast._t); toast._t = setTimeout(() => e.classList.remove('on'), 2000); };
  const G = '<svg width="20" height="20" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>';
  const X = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  let sb = null, user = null;
  const AD = { tab: 'req', mode: 'biasa', reqs: [], pops: [], usrs: [] };
  const say = (html) => { $('seg').hidden = true; $('out').hidden = true; $('body').innerHTML = html; };
  const note = (t) => say('<div class="gc" style="padding-top:60px"><p>' + t.replace(/</g, '&lt;') + '</p></div>');

  // ---------- masuk & cek admin ----------
  function login(err) {
    say('<div class="gc" style="padding-top:60px"><h1>Admin</h1><p>Masuk dengan akun Google untuk membuka panel.</p><button class="btn gbtn" id="glogin">' + G + 'Masuk dengan Google</button><div class="gerr" id="gerr"></div></div>');
    if (err) $('gerr').textContent = err;
    $('glogin').onclick = async () => {
      $('glogin').disabled = true;
      const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname } });
      if (error) { $('glogin').disabled = false; $('gerr').textContent = 'Gagal masuk: ' + error.message; }
    };
  }
  async function check() {
    const { data, error } = await sb.from('profiles').select('is_admin').eq('id', user.id).maybeSingle();
    if (error) return note('Gagal memeriksa akun: ' + error.message);
    if (data && data.is_admin) return panel();
    denied();
  }
  function denied() {
    say('<div class="gc" style="padding-top:50px"><h1>Bukan admin</h1><p>Akun ini belum punya akses admin.</p><div class="kform" style="text-align:left"><label>Kunci setup</label><input id="ck" type="password" placeholder="Kunci dari Cloudflare" autocomplete="off"></div><button class="btn gbtn" id="cgo">Jadikan saya admin</button><button class="btn gbtn" id="cout">Keluar</button><div class="gerr" id="cerr"></div></div>');
    $('cout').onclick = out;
    $('cgo').onclick = async () => {
      const key = $('ck').value; if (!key) return;
      $('cgo').disabled = true; $('cerr').textContent = '';
      try {
        const { data } = await sb.auth.getSession();
        const r = await fetch('/api/admin-claim', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + data.session.access_token }, body: JSON.stringify({ key }) });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) { $('cerr').textContent = j.error || 'Gagal.'; $('cgo').disabled = false; return; }
        toast('✓ Kamu sekarang admin'); check();
      } catch (e) { $('cerr').textContent = 'Tidak bisa terhubung ke server.'; $('cgo').disabled = false; }
    };
  }
  async function out() { await sb.auth.signOut(); location.reload(); }

  // ---------- panel ----------
  const mark = () => $('seg').querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.a === 'tab-' + AD.tab));
  function panel() {
    $('seg').hidden = false; $('out').hidden = false; $('out').onclick = out;
    $('seg').onclick = (e) => { const b = e.target.closest('[data-a]'); if (!b) return; ({ 'tab-req': renderReq, 'tab-pop': renderPop, 'tab-usr': renderUsr })[b.dataset.a](); };
    $('body').onclick = (e) => {
      const b = e.target.closest('[data-a]'); if (!b) return;
      if (AD.tab === 'req') onReq(b.dataset.a, b); else if (AD.tab === 'usr') onUsr(b.dataset.a, b); else onPop(b.dataset.a, b);
    };
    renderReq();
  }

  // ---------- Lihat request ----------
  async function renderReq() {
    AD.tab = 'req'; mark();
    $('body').innerHTML = '<div class="klist" id="rl"><div class="kempty">Memuat…</div></div>';
    const { data, error } = await sb.from('codes').select('id,author,title,description,lang,runnable,source,created_at').eq('status', 'pending').order('id').limit(50);
    const l = $('rl'); if (!l) return;
    if (error) { l.innerHTML = '<div class="kempty">Belum aktif. Jalankan SQL terbaru di Supabase.</div>'; return; }
    AD.reqs = data || []; paintReq();
  }
  function paintReq() {
    const l = $('rl'); if (!l) return; l.innerHTML = '';
    if (!AD.reqs.length) { l.appendChild(h('div', 'kempty', 'Tidak ada request baru.')); return; }
    AD.reqs.forEach((it) => {
      const c = h('div', 'kcard kreq'); c.dataset.id = it.id;
      c.appendChild(h('b', '', it.title));
      c.appendChild(h('p', '', it.description || 'Tanpa deskripsi'));
      c.appendChild(h('span', 'kchip', (it.lang || 'kode') + ' · dari ' + (it.author || 'Pengguna') + ' · ' + it.source));
      const r = h('div', 'ra');
      [['view', 'Lihat / jalankan'], ['ok', 'Setujui'], ['no', 'Tolak']].forEach(([k, t]) => { const bt = h('button', 'mini', t); bt.dataset.a = k; r.appendChild(bt); });
      c.appendChild(r); l.appendChild(c);
    });
  }
  async function onReq(k, b) {
    const card = b.closest('.kreq'); if (!card) return;
    const it = AD.reqs.find((x) => String(x.id) === card.dataset.id); if (!it) return;
    if (k === 'view') { viewCode(it); return; }
    const status = k === 'ok' ? 'approved' : 'rejected';
    const { error } = await sb.from('codes').update({ status }).eq('id', it.id);
    if (error) { toast('⚠ Gagal menyimpan'); return; }
    AD.reqs = AD.reqs.filter((x) => x.id !== it.id); paintReq();
    toast(status === 'approved' ? '✓ Kode disetujui' : '✓ Kode ditolak');
  }
  async function viewCode(it) {
    const v = $('kdet');
    v.innerHTML = '<div class="avh"><button class="ib" data-v="x" aria-label="Tutup">' + X + '</button><div class="avt"></div></div><div class="kdesc"></div><div class="tabs" hidden></div><div class="avb"><div class="kempty">Memuat…</div></div>';
    v.querySelector('.avt').textContent = it.title; v.querySelector('.kdesc').textContent = it.description || '';
    requestAnimationFrame(() => v.classList.add('on'));
    const body = v.querySelector('.avb'), tabs = v.querySelector('.tabs');
    const { data, error } = await sb.from('codes').select('code,runnable').eq('id', it.id).single();
    if (error || !data) { body.innerHTML = '<div class="kempty">Gagal memuat kode.</div>'; return; }
    const run = !!data.runnable || /<!doctype html|<html[\s>]|<body[\s>]|<script[\s>]/i.test(data.code);
    let tab = run ? 'run' : 'code';
    const draw = () => {
      tabs.hidden = !run;
      if (run) tabs.innerHTML = '<button data-v="run" class="' + (tab === 'run' ? 'on' : '') + '">Jalankan</button><button data-v="code" class="' + (tab === 'code' ? 'on' : '') + '">Kode</button>';
      body.innerHTML = '';
      if (tab === 'run') { const f = h('iframe', 'avf'); f.setAttribute('sandbox', 'allow-scripts'); body.appendChild(f); f.srcdoc = data.code; }
      else { const pre = h('pre', 'avc'); pre.appendChild(h('code', '', data.code)); body.appendChild(pre); }
    };
    v.onclick = (e) => {
      const b = e.target.closest('[data-v]'); if (!b) return;
      if (b.dataset.v === 'x') { v.classList.remove('on'); setTimeout(() => (v.innerHTML = ''), 320); } else { tab = b.dataset.v; draw(); }
    };
    draw();
  }

  // ---------- Kirim pop up ----------
  function showPopup(p) {
    const o = $('popup');
    o.innerHTML = '<div class="pcard"><div class="pcontent"></div><button class="btn pok">' + (p.kind === 'html' ? 'Tutup' : 'Oke') + '</button></div>';
    const c = o.querySelector('.pcontent');
    if (p.kind === 'html') { const f = h('iframe', 'pfr'); f.setAttribute('sandbox', 'allow-scripts'); c.appendChild(f); f.srcdoc = p.body; }
    else { c.append(h('h3', '', p.title), h('p', '', p.body)); }
    o.classList.add('on');
    o.querySelector('.pok').onclick = () => { o.classList.remove('on'); setTimeout(() => (o.innerHTML = ''), 250); };
  }
  function renderPop() {
    AD.tab = 'pop'; mark(); AD.mode = 'biasa';
    $('body').innerHTML = '<div class="kform"><div class="kcat" id="am"><button data-a="m-biasa">Biasa</button><button data-a="m-html">HTML sendiri</button></div>' +
      '<label>Judul</label><input id="at" maxlength="80" placeholder="Judul pop up">' +
      '<label id="al">Pesan</label><textarea id="ab" rows="8" maxlength="100000" placeholder="Isi pesan"></textarea>' +
      '<div class="ra2"><button class="btn" data-a="pv">Pratinjau</button><button class="btn" data-a="send">Kirim</button></div></div>' +
      '<h4 class="kh4">Pop up terkirim</h4><div class="klist" id="pl2"></div>';
    modeUI(); loadPops();
  }
  function modeUI() {
    $('am').querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.a === 'm-' + AD.mode));
    $('al').textContent = AD.mode === 'html' ? 'Kode HTML kustom (boleh pakai CSS dan JS sendiri)' : 'Pesan';
    $('ab').placeholder = AD.mode === 'html' ? '<div style="padding:20px">…</div>' : 'Isi pesan';
  }
  async function loadPops() {
    const { data } = await sb.from('popups').select('id,title,kind,active,created_at').order('id', { ascending: false }).limit(20);
    AD.pops = data || [];
    const l = $('pl2'); if (!l) return; l.innerHTML = '';
    if (!AD.pops.length) { l.appendChild(h('div', 'kempty', 'Belum ada pop up.')); return; }
    AD.pops.forEach((p) => {
      const c = h('div', 'kcard kpop'); c.dataset.id = p.id;
      c.appendChild(h('b', '', p.title));
      c.appendChild(h('span', 'kchip', (p.kind === 'html' ? 'HTML sendiri' : 'Biasa') + ' · ' + (p.active ? 'aktif' : 'nonaktif')));
      const r = h('div', 'ra');
      [['tg', p.active ? 'Matikan' : 'Aktifkan'], ['del', 'Hapus']].forEach(([k, t]) => { const bt = h('button', 'mini', t); bt.dataset.a = k; r.appendChild(bt); });
      c.appendChild(r); l.appendChild(c);
    });
  }
  async function onPop(k, b) {
    if (k.startsWith('m-')) { AD.mode = k.slice(2); modeUI(); return; }
    if (k === 'pv' || k === 'send') {
      const title = $('at').value.trim(), body = $('ab').value;
      if (!title || !body.trim()) { toast('Isi judul dan isinya dulu'); return; }
      if (k === 'pv') { showPopup({ title, kind: AD.mode, body }); return; }
      b.disabled = true;
      const { error } = await sb.from('popups').insert({ title, kind: AD.mode, body });
      b.disabled = false;
      if (error) { toast('⚠ Gagal mengirim pop up'); return; }
      toast('✓ Pop up terkirim'); $('at').value = ''; $('ab').value = ''; loadPops();
      return;
    }
    const card = b.closest('.kpop'); if (!card) return;
    const p = AD.pops.find((x) => String(x.id) === card.dataset.id); if (!p) return;
    const { error } = await (k === 'del' ? sb.from('popups').delete().eq('id', p.id) : sb.from('popups').update({ active: !p.active }).eq('id', p.id));
    if (error) toast('⚠ Gagal menyimpan'); else loadPops();
  }

  // ---------- Pengguna: kredit & plan ----------
  function renderUsr() {
    AD.tab = 'usr'; mark();
    $('body').innerHTML = '<div class="ksearch"><input id="uq" placeholder="Cari email atau nama" maxlength="60"><button class="ib2" data-a="usearch" aria-label="Cari"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg></button></div><div class="klist" id="ul" style="margin-top:12px"><div class="kempty">Memuat…</div></div>';
    $('uq').onkeydown = (e) => { if (e.key === 'Enter') loadUsr(); };
    loadUsr();
  }
  async function loadUsr() {
    const t = ($('uq').value || '').replace(/[,()%*"'\\]/g, ' ').trim();
    let q = sb.from('profiles').select('id,email,name,plan,credits').order('created_at', { ascending: false }).limit(50);
    if (t) q = q.or('email.ilike.%' + t + '%,name.ilike.%' + t + '%');
    const { data, error } = await q;
    const l = $('ul'); if (!l) return; l.innerHTML = '';
    if (error) { l.appendChild(h('div', 'kempty', 'Belum aktif. Jalankan SQL terbaru di Supabase.')); return; }
    AD.usrs = data || [];
    if (!AD.usrs.length) { l.appendChild(h('div', 'kempty', 'Tidak ada pengguna.')); return; }
    AD.usrs.forEach((u) => {
      const c = h('div', 'kcard kusr'); c.dataset.id = u.id;
      c.appendChild(h('b', '', u.name || 'Pengguna'));
      c.appendChild(h('span', 'kchip', u.email || ''));
      const f = h('div', 'uf');
      f.innerHTML = '<label>Kredit<input type="number" min="0" step="1" class="ucr"></label><label>Plan<select class="upl"><option value="free">Free</option><option value="pro">Pro</option></select></label><button class="mini" data-a="usave">Simpan</button>';
      f.querySelector('.ucr').value = u.credits; f.querySelector('.upl').value = u.plan;
      c.appendChild(f); l.appendChild(c);
    });
  }
  async function onUsr(k, b) {
    if (k === 'usearch') { loadUsr(); return; }
    if (k !== 'usave') return;
    const card = b.closest('.kusr'); if (!card) return;
    const u = AD.usrs.find((x) => x.id === card.dataset.id); if (!u) return;
    const credits = Math.max(0, parseInt(card.querySelector('.ucr').value, 10) || 0), plan = card.querySelector('.upl').value;
    b.disabled = true;
    const { error } = await sb.from('profiles').update({ credits, plan }).eq('id', u.id);
    b.disabled = false;
    if (error) { toast('⚠ Gagal menyimpan'); return; }
    Object.assign(u, { credits, plan }); toast('✓ Tersimpan');
  }

  // ---------- mulai ----------
  (async function boot() {
    if (!window.supabase) return note('Library Supabase gagal dimuat. Periksa internet lalu muat ulang.');
    let c; try { c = await (await fetch('/api/config')).json(); } catch (e) {}
    if (!c || !c.url || !c.anonKey) return note('Server belum dikonfigurasi (variabel Supabase di Cloudflare).');
    sb = window.supabase.createClient(c.url, c.anonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
    const { data } = await sb.auth.getSession();
    if (!data.session) return login(new URLSearchParams(location.hash.slice(1) + '&' + location.search.slice(1)).get('error_description') ? 'Login gagal. Coba lagi.' : '');
    user = data.session.user; check();
  })();
})();
