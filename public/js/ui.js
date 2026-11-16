// Menu samping, project (simpan/ganti nama/hapus), dialog, panel model, layar
(function (A) {
  const $ = A.$, S = A.state;
  const P = () => S.projects[S.cur];
  const PEN = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16v4zM13 7l4 4"/></svg>';
  const TRASH = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>';

  A.overlay = (on) => $('ov').classList.toggle('on', on);
  A.closeAll = function () {
    $('drawer').classList.remove('on'); $('sheet').classList.remove('on');
    if (A._dlgCancel) A._dlgCancel();
    $('dlg').classList.remove('on'); A.overlay(false);
  };
  A.toast = function (txt) {
    const t = $('toast'); t.textContent = txt; t.classList.add('on');
    clearTimeout(A._tt); A._tt = setTimeout(() => t.classList.remove('on'), 1800);
  };

  A.dialog = function (o) {
    return new Promise((res) => {
      const d = $('dlg'), hasIn = o.input != null;
      d.innerHTML = '<div class="grab"></div><h3>' + A.esc(o.title) + '</h3>' + (o.text ? '<p>' + A.esc(o.text) + '</p>' : '') +
        (hasIn ? '<input id="dlgin" class="dlgin" maxlength="40" value="' + A.escA(o.input) + '">' : '') +
        '<div class="drow"><button class="btn" id="dno">Batal</button><button class="btn' + (o.danger ? ' dng' : '') + '" id="dok">' + (o.ok || 'OK') + '</button></div>';
      const done = (v) => { d.classList.remove('on'); A._dlgCancel = null; A.overlay($('drawer').classList.contains('on')); res(v); };
      A._dlgCancel = () => done(null);
      $('dno').onclick = () => done(null);
      $('dok').onclick = () => done(hasIn ? $('dlgin').value.trim() : true);
      d.classList.add('on'); A.overlay(true);
      if (hasIn) setTimeout(() => { const i = $('dlgin'); if (i) { i.focus(); i.select(); } }, 300);
    });
  };

  A.renderList = function () {
    const l = $('plist'); l.innerHTML = '';
    if (!S.projects.length) { l.innerHTML = '<div class="empty">Belum ada project. Buat yang pertama!</div>'; return; }
    S.projects.forEach((p, i) => {
      const d = document.createElement('div');
      d.className = 'proj' + (i === S.cur ? ' act' : ''); d.dataset.i = i;
      d.innerHTML = '<span class="pn"></span><button class="ib2" data-a="ren" aria-label="Ganti nama">' + PEN + '</button><button class="ib2" data-a="del" aria-label="Hapus">' + TRASH + '</button>';
      d.firstChild.textContent = p.name;
      l.appendChild(d);
    });
  };

  A.createProject = async function () {
    let row;
    try { row = await A.dbNewProject('Project ' + (S.projects.length + 1)); } catch (e) { A.toast('⚠ Gagal membuat project'); return; }
    S.projects.push({ id: row.id, name: row.name, mode: null, msgs: [], loaded: true });
    await A.openProject(S.projects.length - 1);
    A.closeAll();
    A.toast('✓ ' + row.name + ' dibuat');
  };

  A.openProject = async function (i) {
    const p = S.projects[i];
    if (!p.loaded) { try { await A.loadMsgs(p); } catch (e) { A.toast('⚠ Gagal memuat chat'); return; } }
    S.cur = i; $('ptitle').textContent = p.name;
    try { localStorage.setItem('airlva_cur_' + S.user.id, p.id); } catch (e) {}
    A.setPill(); A.render();
  };

  A.renameProject = async function (i) {
    const p = S.projects[i];
    const n = await A.dialog({ title: 'Ganti nama project', input: p.name, ok: 'Simpan' });
    if (!n) return;
    p.name = n; A.fire(A.dbProject(p, { name: n })); A.renderList();
    if (i === S.cur) $('ptitle').textContent = n;
  };

  A.deleteProject = async function (i) {
    const p = S.projects[i];
    const ok = await A.dialog({ title: 'Hapus project?', text: '"' + p.name + '" dan semua chat di dalamnya akan dihapus.', ok: 'Hapus', danger: true });
    if (!ok) return;
    A.fire(A.dbDelProject(p));
    S.projects.splice(i, 1);
    if (S.cur === i) { S.cur = null; $('ptitle').textContent = 'AirLva'; }
    else if (S.cur > i) S.cur--;
    A.renderList(); A.setPill(); A.render();
  };

  A.render = function () {
    const m = $('main'); m.innerHTML = '';
    if (S.cur === null) {
      $('box').style.display = 'none';
      m.innerHTML = '<div class="center welcome"><div class="logo pop"><svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 15c3-1 4-5 8-5s4 4 10 3M5 19c2-.5 3-3 6-3s3 2 8 2"/></svg></div><h1>Halo, ini AirLva</h1><p>Buka menu ☰ lalu buat Project baru untuk mulai.</p><button class="btn" id="go">Buat Project</button></div>';
      $('go').onclick = A.createProject; return;
    }
    $('box').style.display = '';
    const p = P();
    if (!p.mode && !p.msgs.length) {
      m.innerHTML = '<div class="center menu"><h1>Mau Ngapain?</h1><div class="opts">' +
        A.MODES.map((x, i) => '<button class="opt" style="--i:' + i + '" data-m="' + x.label + '">' + x.label + '</button>').join('') + '</div></div>';
      m.querySelectorAll('.opt').forEach((b) => b.onclick = () => { p.mode = b.dataset.m; A.fire(A.dbProject(p, { mode: p.mode })); A.setPill(); A.render(); $('inp').focus(); });
      A.updateAction();
    } else A.renderMessages();
  };

  A.setPill = function () {
    const m = S.cur !== null && A.modeInfo(P().mode);
    $('model').innerHTML = (m ? m.model.replace('gemini-', '') : 'Pilih model') + '<span>›</span>';
  };
  A.renderSheet = function () {
    const cur = S.cur !== null ? P().mode : null;
    $('mlist').innerHTML = A.MODES.map((m) =>
      '<div class="mrow' + (m.label === cur ? ' act' : '') + '"><b>' + m.label + '</b><code>' + m.model + '</code></div>').join('');
  };

  A.initUI = function () {
    $('menu').onclick = () => { A.renderList(); $('drawer').classList.add('on'); A.overlay(true); };
    $('ov').onclick = A.closeAll; $('closeSheet').onclick = A.closeAll;
    $('model').onclick = () => { A.renderSheet(); $('sheet').classList.add('on'); A.overlay(true); };
    $('newp').onclick = A.createProject;
    $('pprof').onclick = A.openProfile; $('cr').onclick = A.openProfile;
    $('plist').onclick = (e) => {
      const row = e.target.closest('.proj'); if (!row) return;
      const i = +row.dataset.i, b = e.target.closest('[data-a]');
      if (!b) { A.openProject(i); A.closeAll(); }
      else if (b.dataset.a === 'ren') A.renameProject(i);
      else A.deleteProject(i);
    };
  };
})(window.AirLva);
