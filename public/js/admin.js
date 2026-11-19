// Admin panel (tersembunyi): lihat request publish kode, kirim pop up
(function (A) {
  const $ = A.$, S = A.state;
  const h = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const X = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  const AD = { tab: 'req', mode: 'biasa', reqs: [], pops: [] };

  function shell() {
    const v = $('adm');
    v.innerHTML = '<div class="avh"><button class="ib" data-a="x" aria-label="Tutup">' + X + '</button><div class="avt">Admin panel</div></div>' +
      '<div class="kseg"><button data-a="tab-req">Lihat request</button><button data-a="tab-pop">Kirim pop up</button></div><div class="kbody" id="abody"></div>';
    v.onclick = (e) => {
      const b = e.target.closest('[data-a]'); if (!b) return;
      const k = b.dataset.a;
      if (k === 'x') v.classList.remove('on');
      else if (k === 'tab-req') renderReq();
      else if (k === 'tab-pop') renderPop();
      else if (AD.tab === 'req') onReq(k, b); else onPop(k, b);
    };
  }
  const mark = () => $('adm').querySelectorAll('.kseg button').forEach((b) => b.classList.toggle('on', b.dataset.a === 'tab-' + AD.tab));
  A.openAdmin = function () {
    if (!(S.profile && S.profile.is_admin)) return;
    shell(); renderReq();
    requestAnimationFrame(() => $('adm').classList.add('on'));
  };

  // ---------- Lihat request ----------
  async function renderReq() {
    AD.tab = 'req'; mark();
    const b = $('abody'); b.innerHTML = '<div class="klist" id="rl"><div class="kempty">Memuat…</div></div>';
    const { data, error } = await S.sb.from('codes').select('id,author,title,description,lang,runnable,source,created_at').eq('status', 'pending').order('id').limit(50);
    const l = $('rl'); if (!l) return;
    if (error) { l.innerHTML = '<div class="kempty">Belum aktif. Jalankan SQL terbaru di Supabase.</div>'; return; }
    AD.reqs = data || [];
    paintReq();
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
    if (k === 'view') { A.openKodeDetail(it, { admin: true }); return; }
    const status = k === 'ok' ? 'approved' : 'rejected';
    const { error } = await S.sb.from('codes').update({ status }).eq('id', it.id);
    if (error) { A.toast('⚠ Gagal menyimpan'); return; }
    AD.reqs = AD.reqs.filter((x) => x.id !== it.id); paintReq();
    A.toast(status === 'approved' ? '✓ Kode disetujui' : '✓ Kode ditolak');
  }

  // ---------- Kirim pop up ----------
  function renderPop() {
    AD.tab = 'pop'; mark(); AD.mode = 'biasa';
    $('abody').innerHTML = '<div class="kform"><div class="kcat" id="am"><button data-a="m-biasa">Biasa</button><button data-a="m-html">HTML sendiri</button></div>' +
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
    const { data } = await S.sb.from('popups').select('id,title,kind,active,created_at').order('id', { ascending: false }).limit(20);
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
      if (!title || !body.trim()) { A.toast('Isi judul dan isinya dulu'); return; }
      if (k === 'pv') { A.showPopup({ title, kind: AD.mode, body }); return; }
      b.disabled = true;
      const { error } = await S.sb.from('popups').insert({ title, kind: AD.mode, body });
      b.disabled = false;
      if (error) { A.toast('⚠ Gagal mengirim pop up'); return; }
      A.toast('✓ Pop up terkirim'); $('at').value = ''; $('ab').value = ''; loadPops();
      return;
    }
    const card = b.closest('.kpop'); if (!card) return;
    const p = AD.pops.find((x) => String(x.id) === card.dataset.id); if (!p) return;
    const q = k === 'del' ? S.sb.from('popups').delete().eq('id', p.id) : S.sb.from('popups').update({ active: !p.active }).eq('id', p.id);
    const { error } = await q;
    if (error) A.toast('⚠ Gagal menyimpan'); else loadPops();
  }

  A.initAdmin = function () { $('kadm').onclick = () => { A.closeAll(); A.openAdmin(); }; };
})(window.AirLva);
