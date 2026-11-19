// Cari kode & Publish kode (Top 300, like, visit, jalankan kode)
(function (A) {
  const $ = A.$, S = A.state;
  const I = (d, w) => '<svg width="' + (w || 18) + '" height="' + (w || 18) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + d + '</svg>';
  const ICON = {
    x: I('<path d="M6 6l12 12M18 6L6 18"/>', 20),
    heart: I('<path d="M12 21s-7.5-4.6-9.5-9.3C1.2 8.6 3 5 6.5 5c2 0 3.5 1.1 5.5 3 2-1.9 3.5-3 5.5-3C21 5 22.8 8.6 21.5 11.7 19.5 16.4 12 21 12 21z"/>', 16),
    eye: I('<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>', 16),
    search: I('<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>', 18),
  };
  const h = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const num = (n) => A.fmt(n || 0);
  const EXT = { html: 'html', javascript: 'js', python: 'py', css: 'css', json: 'json', bash: 'sh', lain: 'txt' };
  const LANGS = [['html', 'HTML'], ['javascript', 'JavaScript'], ['python', 'Python'], ['css', 'CSS'], ['json', 'JSON'], ['bash', 'Bash'], ['lain', 'Lainnya']];
  const normLang = (l) => { l = (l || '').toLowerCase(); if (l === 'js') return 'javascript'; if (l === 'py') return 'python'; if (l === 'sh') return 'bash'; return LANGS.some((x) => x[0] === l) ? l : 'lain'; };
  const isRun = (lang, code) => lang === 'html' || /<!doctype html|<html[\s>]|<body[\s>]|<script[\s>]/i.test(code || '');
  const FILE_LANG = { html: 'html', htm: 'html', js: 'javascript', mjs: 'javascript', py: 'python', css: 'css', json: 'json', sh: 'bash' };
  function copyText(t) {
    const fb = () => { const x = document.createElement('textarea'); x.value = t; document.body.appendChild(x); x.select(); try { document.execCommand('copy'); } catch (e) {} x.remove(); };
    try { navigator.clipboard.writeText(t).catch(fb); } catch (e) { fb(); }
  }

  const K = { tab: 'cari', cat: 'top', q: '', page: 0, items: [], more: false, loading: false, req: 0 };
  let P = { method: 'tempel', code: '', source: 'tempel' };

  // ---------- kerangka ----------
  function shell() {
    const v = $('kview');
    v.innerHTML = '<div class="avh"><button class="ib" data-k="x" aria-label="Tutup">' + ICON.x + '</button><div class="avt">Kode</div></div>' +
      '<div class="kseg"><button data-k="tab-cari">Cari kode</button><button data-k="tab-pub">Publish kode</button></div><div class="kbody" id="kbody"></div>';
    v.onclick = (e) => {
      const b = e.target.closest('[data-k]'); if (!b) return;
      const k = b.dataset.k;
      if (k === 'x') v.classList.remove('on');
      else if (k === 'tab-cari') renderCari();
      else if (k === 'tab-pub') renderPub();
      else if (K.tab === 'cari') onCari(k, b); else onPub(k, b);
    };
  }
  const markTabs = () => $('kview').querySelectorAll('.kseg button').forEach((b) => b.classList.toggle('on', b.dataset.k === 'tab-' + K.tab));
  A.openCari = function (tab) {
    shell();
    if (tab === 'pub') renderPub(); else renderCari();
    requestAnimationFrame(() => $('kview').classList.add('on'));
  };

  // ---------- Cari kode ----------
  function renderCari() {
    K.tab = 'cari'; markTabs();
    const b = $('kbody');
    b.innerHTML = '<div class="ksearch"><input id="kq" placeholder="Cari nama, deskripsi, atau pembuat" maxlength="60"><button class="ib2" data-k="go" aria-label="Cari">' + ICON.search + '</button></div>' +
      '<div class="kcat" id="kcat"><button data-k="cat-top">Top 300</button><button data-k="cat-biasa">Kode biasa</button></div>' +
      '<div class="klist" id="klist"></div><button class="btn kmore" id="kmore" data-k="more" hidden>Muat lebih banyak</button>';
    $('kq').value = K.q;
    $('kq').onkeydown = (e) => { if (e.key === 'Enter') doSearch(); };
    markCat(); loadList(true);
  }
  const markCat = () => $('kcat').querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.k === 'cat-' + K.cat));
  function doSearch() { K.q = $('kq').value.trim(); loadList(true); }
  function onCari(k, b) {
    if (k === 'go') doSearch();
    else if (k === 'cat-top' || k === 'cat-biasa') { K.cat = k.slice(4); markCat(); loadList(true); }
    else if (k === 'more') loadList(false);
    else if (k === 'item') { const it = K.items.find((x) => String(x.id) === b.dataset.id); if (it) openDetail(it); }
  }
  async function loadList(reset) {
    if (!reset && K.loading) return;
    const my = ++K.req; K.loading = true;
    if (reset) { K.page = 0; K.items = []; $('klist').innerHTML = '<div class="kempty">Memuat…</div>'; $('kmore').hidden = true; }
    let q = S.sb.from('codes_list').select('id,author,title,description,lang,runnable,likes,visits,rank');
    q = K.cat === 'top' ? q.lte('rank', 300).order('rank', { ascending: true }) : q.gt('rank', 300).order('id', { ascending: false });
    const t = K.q.replace(/[,()%*"'\\]/g, ' ').trim();
    if (t) q = q.or('title.ilike.%' + t + '%,description.ilike.%' + t + '%,author.ilike.%' + t + '%');
    const { data, error } = await q.range(K.page * 30, K.page * 30 + 29);
    if (my !== K.req) return;
    K.loading = false;
    const l = $('klist'); if (!l) return;
    if (error) { l.innerHTML = '<div class="kempty">Cari kode belum aktif. Jalankan SQL terbaru di Supabase.</div>'; return; }
    const rows = data || [];
    K.items = K.items.concat(rows); K.more = rows.length === 30; K.page++;
    paintList();
  }
  function card(it) {
    const el = h('button', 'kcard'); el.dataset.k = 'item'; el.dataset.id = it.id;
    const top = h('div', 'kh');
    if (it.rank <= 300) top.appendChild(h('span', 'krank', '#' + it.rank));
    top.appendChild(h('b', '', it.title));
    el.appendChild(top);
    el.appendChild(h('p', '', it.description || 'Tanpa deskripsi'));
    const f = h('div', 'kf');
    f.appendChild(h('span', 'kchip', (it.lang || 'kode') + (it.runnable ? ' · bisa dijalankan' : '')));
    f.appendChild(h('span', 'kauth', it.author || 'Pengguna'));
    const st = h('span', 'kst'); st.innerHTML = ICON.heart + '<i></i>' + ICON.eye + '<i></i>';
    st.querySelectorAll('i')[0].textContent = num(it.likes); st.querySelectorAll('i')[1].textContent = num(it.visits);
    f.appendChild(st); el.appendChild(f);
    return el;
  }
  function paintList() {
    const l = $('klist'); if (!l) return;
    l.innerHTML = '';
    if (!K.items.length) l.appendChild(h('div', 'kempty', K.q ? 'Tidak ada hasil.' : 'Belum ada kode di sini.'));
    K.items.forEach((it) => l.appendChild(card(it)));
    $('kmore').hidden = !K.more;
  }

  // ---------- detail kode (jalankan, like, visit) ----------
  async function openDetail(it, opts) {
    opts = opts || {};
    const v = $('kdet');
    const st = { liked: false, likes: it.likes || 0, visits: it.visits || 0, tab: 'code', code: '', lang: it.lang || '', run: false, desc: it.description || '', ready: false };
    v.innerHTML = '<div class="avh"><button class="ib" data-k="x" aria-label="Tutup">' + ICON.x + '</button><div class="avt"></div><div class="ra"><button class="mini" data-k="copy">Salin</button><button class="mini" data-k="dl">Unduh</button></div></div><div class="kmeta"></div><div class="kdesc"></div><div class="tabs" hidden></div><div class="avb"><div class="kempty">Memuat…</div></div>';
    v.querySelector('.avt').textContent = it.title;
    v.onclick = async (e) => {
      const b = e.target.closest('[data-k]'); if (!b) return;
      const k = b.dataset.k;
      if (k === 'x') { v.classList.remove('on'); setTimeout(() => (v.innerHTML = ''), 320); }
      else if (!st.ready) return;
      else if (k === 'tab-run' || k === 'tab-code') { st.tab = k.slice(4); paint(); }
      else if (k === 'copy') { copyText(st.code); b.textContent = 'Tersalin ✓'; setTimeout(() => (b.textContent = 'Salin'), 1200); }
      else if (k === 'dl') {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([st.code], { type: 'text/plain' }));
        a.download = (it.title || 'kode').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').slice(0, 40) + '.' + (EXT[normLang(st.lang)] || 'txt');
        a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      } else if (k === 'like') {
        const { data, error } = await S.sb.rpc('toggle_like', { p_code: it.id });
        if (error || !data || !data[0]) { A.toast('⚠ Gagal memberi like'); return; }
        st.liked = data[0].is_liked; st.likes = data[0].total; it.likes = st.likes; paint();
      }
    };
    requestAnimationFrame(() => v.classList.add('on'));

    function paint() {
      const meta = v.querySelector('.kmeta'); meta.innerHTML = '';
      meta.appendChild(h('span', 'kauth', 'oleh ' + (it.author || 'Pengguna')));
      if (!opts.admin) {
        const lk = h('button', 'klike' + (st.liked ? ' on' : '')); lk.dataset.k = 'like'; lk.innerHTML = ICON.heart + '<i></i>'; lk.querySelector('i').textContent = num(st.likes);
        const vs = h('span', 'kvis'); vs.innerHTML = ICON.eye + '<i></i>'; vs.querySelector('i').textContent = num(st.visits);
        meta.append(lk, vs);
      } else meta.appendChild(h('span', 'kchip', 'menunggu persetujuan'));
      v.querySelector('.kdesc').textContent = st.desc;
      const tabs = v.querySelector('.tabs');
      tabs.hidden = !st.run;
      if (st.run) tabs.innerHTML = '<button data-k="tab-run" class="' + (st.tab === 'run' ? 'on' : '') + '">Jalankan</button><button data-k="tab-code" class="' + (st.tab === 'code' ? 'on' : '') + '">Kode</button>';
      const body = v.querySelector('.avb'); body.innerHTML = '';
      if (st.tab === 'run' && st.run) { const f = h('iframe', 'avf'); f.setAttribute('sandbox', 'allow-scripts'); f.srcdoc = st.code; body.appendChild(f); }
      else { const pre = h('pre', 'avc'); pre.appendChild(h('code', '', st.code)); body.appendChild(pre); }
    }

    const { data, error } = await S.sb.from('codes').select('code,lang,runnable,description,title,author').eq('id', it.id).single();
    if (error || !data) { v.querySelector('.avb').innerHTML = '<div class="kempty">Gagal memuat kode.</div>'; return; }
    it.author = data.author || it.author; st.code = data.code; st.lang = data.lang || ''; st.desc = data.description || '';
    st.run = !!data.runnable || isRun(normLang(data.lang), data.code);
    st.tab = st.run ? 'run' : 'code'; st.ready = true;
    paint();
    if (!opts.admin) {
      const [vr, lr] = await Promise.all([S.sb.rpc('add_visit', { p_code: it.id }), S.sb.from('code_likes').select('code_id').eq('code_id', it.id)]);
      if (typeof vr.data === 'number' && vr.data) { st.visits = vr.data; it.visits = vr.data; }
      st.liked = !!(lr.data && lr.data.length);
      paint();
    }
  }
  A.openKodeDetail = openDetail;

  // ---------- Publish kode ----------
  function renderPub() {
    K.tab = 'pub'; markTabs();
    P = { method: 'tempel', code: '', source: 'tempel' };
    $('kbody').innerHTML = '<div class="kform"><div class="kcat" id="pm"><button data-k="m-tempel">Tempel kode</button><button data-k="m-file">Upload file</button><button data-k="m-ai">Upload dari AI</button></div>' +
      '<label>Nama</label><input id="pn" maxlength="80" placeholder="Nama kode">' +
      '<label>Deskripsi</label><textarea id="pd" rows="3" maxlength="500" placeholder="Jelaskan kode ini"></textarea>' +
      '<label>Bahasa</label><select id="pl">' + LANGS.map((x) => '<option value="' + x[0] + '">' + x[1] + '</option>').join('') + '</select>' +
      '<div id="psrc"></div>' +
      '<div class="ra2"><button class="btn" data-k="run">Jalankan</button><button class="btn" data-k="send">Kirim</button></div><div id="prun"></div>' +
      '<p class="knote">Kode yang dikirim akan dicek admin dulu sebelum tampil di Cari kode.</p></div>';
    paintMethod();
  }
  function paintMethod() {
    $('pm').querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.k === 'm-' + P.method));
    P.source = P.method === 'tempel' ? 'tempel' : P.method === 'file' ? 'file' : 'ai';
    const s = $('psrc');
    if (P.method === 'tempel') {
      s.innerHTML = '<label>Kode</label><textarea id="pc" class="mono" rows="9" placeholder="Tempel kode di sini"></textarea>';
      $('pc').value = P.code; $('pc').oninput = (e) => { P.code = e.target.value; };
    } else if (P.method === 'file') {
      s.innerHTML = '<label>File</label><label class="kfile"><input type="file" id="pf" accept=".html,.htm,.js,.mjs,.py,.css,.json,.sh,.txt,.php,.java,.c,.cpp"><span>Pilih file (maks 200 KB)</span></label><div class="kinfo" id="pfi"></div>';
      $('pf').onchange = async (e) => {
        const f = e.target.files[0]; if (!f) return;
        if (f.size > 200000) { A.toast('File terlalu besar (maks 200 KB)'); return; }
        P.code = await f.text();
        const ext = (f.name.split('.').pop() || '').toLowerCase();
        $('pl').value = FILE_LANG[ext] || 'lain';
        if (!$('pn').value.trim()) $('pn').value = f.name.replace(/\.[^.]+$/, '').slice(0, 80);
        $('pfi').textContent = f.name + ' · ' + A.fmt(P.code.length) + ' karakter';
      };
    } else {
      s.innerHTML = '<label>Dari AI</label><button class="btn" data-k="pickai">Pilih dari hasil AI</button><div class="kinfo" id="pfi"></div>';
      if (P.code) $('pfi').textContent = A.fmt(P.code.length) + ' karakter dipilih';
    }
  }
  async function aiCodes() {
    const { data, error } = await S.sb.from('messages').select('id,content,mode').eq('role', 'a').in('mode', ['website', 'code']).order('id', { ascending: false }).limit(30);
    if (error) throw error;
    const items = [];
    (data || []).forEach((m) => {
      const c = A.bestCode(A.parse(m.content).hasil);
      if (c.body) items.push({ label: A.artTitle({ mode: m.mode }, c), sub: (c.lang || 'kode') + ' · ' + A.fmt(c.body.length) + ' karakter', c });
    });
    return items;
  }
  async function pickAi() {
    let items;
    try { items = await aiCodes(); } catch (e) { A.toast('⚠ Gagal memuat kode AI'); return; }
    const it = await A.pick('Pilih kode dari AI', items, 'Belum ada kode yang dibuat AI.');
    if (!it) return;
    P.code = it.c.body.slice(0, 200000);
    $('pl').value = normLang(it.c.lang);
    if (!$('pn').value.trim()) $('pn').value = it.label.slice(0, 80);
    $('pfi').textContent = it.label + ' · ' + A.fmt(P.code.length) + ' karakter';
  }
  function runPreview() {
    const box = $('prun');
    if (box.firstChild) { box.innerHTML = ''; return; }
    if (!P.code.trim()) { A.toast('Kodenya masih kosong'); return; }
    if (!isRun($('pl').value, P.code)) { A.toast('Hanya kode HTML yang bisa dijalankan'); return; }
    const f = h('iframe', 'kfr'); f.setAttribute('sandbox', 'allow-scripts'); box.appendChild(f); f.srcdoc = P.code;
  }
  async function submit(b) {
    const title = $('pn').value.trim(), desc = $('pd').value.trim(), lang = $('pl').value, code = P.code;
    if (!title) { A.toast('Isi nama kode dulu'); return; }
    if (!code.trim()) { A.toast('Kodenya masih kosong'); return; }
    if (code.length > 200000) { A.toast('Kode terlalu besar (maks 200.000 karakter)'); return; }
    b.disabled = true;
    const { data, error } = await S.sb.from('codes').insert({ title, description: desc || null, lang, runnable: isRun(lang, code), source: P.source, code }).select('id,status').single();
    b.disabled = false;
    if (error) { A.toast('⚠ Gagal mengirim kode'); return; }
    A.toast(data.status === 'approved' ? '✓ Kode dipublikasikan' : '✓ Terkirim, menunggu persetujuan admin');
    renderPub();
  }
  function onPub(k, b) {
    if (k.startsWith('m-')) { P.method = k.slice(2); P.code = ''; paintMethod(); }
    else if (k === 'pickai') pickAi();
    else if (k === 'run') runPreview();
    else if (k === 'send') submit(b);
  }

  A.initKode = function () {
    $('kcari').onclick = () => { A.closeAll(); A.openCari('cari'); };
    $('kpub').onclick = () => { A.closeAll(); A.openCari('pub'); };
  };
})(window.AirLva);
