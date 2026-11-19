// Titik masuk AirLva
(async function (A) {
  const $ = A.$, S = A.state;
  A.initUI();
  A.initChat();
  A.initGlobal();
  A.initKode();
  A.initAdmin();
  // chat mengalir di belakang header & chatbox (tanpa tepi potong)
  const layout = () => {
    const hd = document.querySelector('header'), bx = $('box'), mn = $('main');
    mn.style.paddingTop = hd.offsetHeight + 12 + 'px';
    mn.style.paddingBottom = (bx.style.display === 'none' ? 20 : bx.offsetHeight + 28) + 'px';
  };
  layout();
  window.addEventListener('resize', layout);
  if (window.ResizeObserver) { const ro = new ResizeObserver(layout); ro.observe(document.querySelector('header')); ro.observe($('box')); }

  A.showLoading();
  const minSplash = new Promise((r) => setTimeout(r, 2600));
  const q = new URLSearchParams(location.hash.slice(1) + '&' + location.search.slice(1));
  const oauthErr = q.get('error_description') || q.get('error');

  let started = false;
  const begin = async (sess) => {
    if (started) return;
    started = true;
    A.showLoading();
    try { await A.start(sess); } catch (e) { started = false; A.showLogin(A.explain(e)); }
  };

  const MSG = {
    nolib: 'Library Supabase gagal dimuat. Periksa internet lalu muat ulang.',
    nocfg: 'Endpoint /api/config tidak ditemukan. Pastikan folder functions ikut ter-deploy.',
    novars: 'Variabel SUPABASE_URL / SUPABASE_ANON_KEY belum diisi di Cloudflare (lalu deploy ulang).',
  };
  const status = await A.initCloud();
  if (status !== 'ok') A.showLogin(MSG[status]);
  else {
    S.sb.auth.onAuthStateChange((ev, sess) => { if (ev === 'SIGNED_IN' && sess) setTimeout(() => begin(sess), 0); });
    try {
      const sess = await A.getSession();
      if (sess) begin(sess); else A.showLogin(oauthErr ? 'Login gagal: ' + oauthErr : '');
    } catch (e) { A.showLogin(A.explain(e)); }
  }
  await minSplash;
  $('splash').classList.add('out');
})(window.AirLva);
