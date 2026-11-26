// Layar login Google, pilih plan, dan profil
(function (A) {
  const $ = A.$, S = A.state;
  const LOGO = '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 15c3-1 4-5 8-5s4 4 10 3M5 19c2-.5 3-3 6-3s3 2 8 2"/></svg>';
  const G = '<svg width="20" height="20" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>';
  const show = (html) => { const g = $('gate'); g.innerHTML = html; g.classList.add('on'); };
  A.hideGate = () => $('gate').classList.remove('on');
  A.showLoading = () => show('<div class="gc"><span class="lgo big">' + LOGO + '</span></div>');
  A.explain = function (e) {
    const m = (e && e.message) || String(e);
    if (/does not exist|schema cache|ensure_profile|42P01|42883|PGRST2/i.test(m)) return 'Database belum disiapkan. Jalankan supabase.sql di Supabase (SQL Editor).';
    if (/JWT|session|token/i.test(m)) return 'Sesi tidak valid. Coba masuk lagi.';
    return 'Terjadi kesalahan: ' + m;
  };

  function fillAvatar(el, p) {
    el.textContent = (p.name || '?').trim().charAt(0).toUpperCase();
    if (p.avatar) {
      const im = new Image(); im.referrerPolicy = 'no-referrer'; im.alt = '';
      im.onload = () => { el.textContent = ''; el.appendChild(im); };
      im.src = p.avatar;
    }
  }
  A.setCredits = (n) => { if (S.profile) S.profile.credits = n; $('crn').textContent = A.fmt(n); };
  A.refreshProfileUI = function () {
    const p = S.profile; if (!p) return;
    $('crn').textContent = A.fmt(p.credits);
    $('pname').textContent = p.name || 'Akun';
    fillAvatar($('pav'), p);
  };

  A.showLogin = function (err) {
    show('<div class="gc"><div class="logo big pop">' + LOGO + '</div><h1>AirLva</h1><p>Masuk untuk menyimpan chat dan project kamu. Dapat <b>' + A.fmt(A.PLANS.free.initial) + ' kredit</b> di awal dan <b>' + A.fmt(A.PLANS.free.daily) + ' kredit</b> setiap hari.</p><button class="btn gbtn" id="glogin">' + G + 'Masuk dengan Google</button><div class="gerr" id="gerr"></div></div>');
    if (err) $('gerr').textContent = err;
    $('glogin').onclick = async () => {
      $('glogin').disabled = true;
      try { await A.login(); } catch (e) { $('glogin').disabled = false; $('gerr').textContent = 'Gagal masuk: ' + e.message; }
    };
  };

  A.showPlans = function (first, current) {
    return new Promise((res) => {
      let sel = current || 'free';
      const card = (k) => { const p = A.PLANS[k]; return '<button class="plan' + (k === sel ? ' sel' : '') + '" data-p="' + k + '"><div class="ph"><b>' + p.label + '</b><i class="rd"></i></div><div class="pr"><span>Kredit awal masuk</span><strong>' + A.fmt(p.initial) + '</strong></div><div class="pr"><span>Kredit setiap hari</span><strong>' + A.fmt(p.daily) + '</strong></div></button>'; };
      show('<div class="gc"><h1>Pilih plan</h1><p>' + (first ? 'Pilih plan untuk akun barumu.' : 'Plan baru berlaku mulai sekarang. Kredit awal hanya untuk akun baru.') + '</p><div class="plans">' + card('free') + card('pro') + '</div><button class="btn gbtn" id="pgo">Lanjut</button>' + (first ? '' : '<button class="btn gbtn" id="pno">Batal</button>') + '</div>');
      document.querySelectorAll('.plan').forEach((b) => b.onclick = () => {
        sel = b.dataset.p; document.querySelectorAll('.plan').forEach((x) => x.classList.toggle('sel', x === b));
      });
      $('pgo').onclick = () => res(sel);
      if (!first) $('pno').onclick = () => { A.hideGate(); res(null); };
    });
  };

  A.openProfile = function () {
    const p = S.profile, d = $('dlg'); if (!p) return;
    d.innerHTML = '<div class="grab"></div><div class="pinfo"><span class="av lg" id="pav2"></span><div><b>' + A.esc(p.name || 'Akun') + '</b><small>' + A.esc(p.email || '') + '</small></div></div>' +
      '<div class="pstat"><div><small>Plan</small><b>' + A.PLANS[p.plan].label + '</b></div><div><small>Kredit</small><b id="pcr">' + A.fmt(p.credits) + '</b></div></div>' +
      '<div class="theme"><small>Tema</small><div class="tseg"><button data-t="light">Terang</button><button data-t="dark">Gelap</button><button data-t="baru">Baru</button><button data-t="airyou">AirYou</button></div></div>' +
      '<p class="pnote">1 kata jawaban AI = 1 kredit. Kredit harian bertambah otomatis.<br>Versi ' + A.VERSION + '</p>' +
      '<button class="btn gbtn" id="pplan">Ganti plan</button><button class="btn gbtn dng" id="pout">Keluar</button>';
    fillAvatar($('pav2'), p);
    A._dlgCancel = () => { d.classList.remove('on'); A._dlgCancel = null; A.overlay($('drawer').classList.contains('on')); };
    $('pplan').onclick = async () => {
      A._dlgCancel();
      const pl = await A.showPlans(false, S.profile.plan);
      if (pl) { try { await A.setPlan(pl); A.toast('✓ Plan ' + A.PLANS[pl].label + ' aktif'); } catch (e) { A.toast('⚠ Gagal ganti plan'); } }
      A.hideGate();
    };
    const mark = () => d.querySelectorAll('.tseg button').forEach((b) => b.classList.toggle('on', b.dataset.t === A.theme()));
    d.querySelectorAll('.tseg button').forEach((b) => (b.onclick = () => { A.setTheme(b.dataset.t); mark(); }));
    mark();
    $('pout').onclick = A.logout;
    d.classList.add('on'); A.overlay(true);
  };

  // alur setelah login: profil, kredit harian, project
  A.start = async function (sess) {
    S.user = sess.user;
    const pr = await A.fetchProfile();
    if (!pr || !pr.plan_chosen) { const plan = await A.showPlans(true); await A.ensureProfile(plan); }
    else await A.ensureProfile(null);
    try { const r = await S.sb.from('profiles').select('is_admin').eq('id', S.user.id).maybeSingle(); S.profile.is_admin = !!(r.data && r.data.is_admin); } catch (e) {}
    await A.loadProjects();
    A.refreshProfileUI();
    A.hideGate();
    let last = null; try { last = localStorage.getItem('airlva_cur_' + S.user.id); } catch (e) {}
    const i = S.projects.findIndex((p) => p.id === last);
    if (i >= 0) await A.openProject(i); else A.render();
    A.checkPopups();
  };
})(window.AirLva);
