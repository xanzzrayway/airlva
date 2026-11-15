// Menu samping, panel model, project, dan layar-layar
(function (A) {
  const $ = A.$, S = A.state;
  
  A.overlay = (on) => $('ov').classList.toggle('on', on);
  A.closeAll = () => {
    $('drawer').classList.remove('on'); $('sheet').classList.remove('on'); A.overlay(false);
  };

  A.toast = function (txt) {
    const t = $('toast'); t.textContent = txt; t.classList.add('on');
    clearTimeout(A._tt); A._tt = setTimeout(() => t.classList.remove('on'), 1800);
  };

  A.renderList = function () {
    const l = $('plist'); l.innerHTML = '';
    if (!S.projects.length) { l.innerHTML = '<div class="empty">Belum ada project. Buat yang pertama!</div>'; return; }
    S.projects.forEach((p, i) => {
      const d = document.createElement('div');
      d.className = 'proj' + (i === S.cur ? ' act' : ''); d.textContent = p;
      d.onclick = () => { A.openProject(i); A.closeAll(); };
      l.appendChild(d);
    });
  };

  A.createProject = function () {
    S.projects.push('Project ' + (S.projects.length + 1));
    A.save();
    A.openProject(S.projects.length - 1);
    A.closeAll();
    A.toast('✓ ' + S.projects[S.cur] + ' dibuat');
  };

  A.openProject = function (i) {
    S.cur = i; S.mode = null; S.msgs = []; A.setPill();
    $('ptitle').textContent = S.projects[i];
    A.render();
  };

  A.render = function () {
    const m = $('main'); m.innerHTML = '';
    if (S.cur === null) {
      $('box').style.display = 'none';
      m.innerHTML = '<div class="center welcome"><div class="logo pop"><svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 15c3-1 4-5 8-5s4 4 10 3M5 19c2-.5 3-3 6-3s3 2 8 2"/></svg></div><h1>Halo, ini AirLva</h1><p>Buka menu ☰ lalu buat Project baru untuk mulai.</p><button class="btn" id="go">Buat Project</button></div>';
      $('go').onclick = A.createProject; return;
    }
    $('box').style.display = '';
    if (!S.mode && !S.msgs.length) {
      m.innerHTML = '<div class="center menu"><h1>Mau Ngapain?</h1><div class="opts">' +
        A.MODES.map((x, i) => '<button class="opt" style="--i:' + i + '" data-m="' + x.label + '">' + x.label + '</button>').join('') + '</div></div>';
      m.querySelectorAll('.opt').forEach((b) => b.onclick = () => { S.mode = b.dataset.m; A.setPill(); A.render(); $('inp').focus(); });
      A.updateAction();
    } else {
      A.renderMessages();
    }
  };

  A.setPill = function () {
    const m = A.modeInfo(S.mode);
    $('model').innerHTML = (m ? m.model.replace('gemini-', '') : 'Pilih model') + '<span>›</span>';
  };

  A.renderSheet = function () {
    $('mlist').innerHTML = A.MODES.map((m) =>
      '<div class="mrow' + (m.label === S.mode ? ' act' : '') + '"><b>' + m.label + '</b><code>' + m.model + '</code></div>').join('');
  };

  A.initUI = function () {
    $('menu').onclick = () => { A.renderList(); $('drawer').classList.add('on'); A.overlay(true); };
    $('ov').onclick = A.closeAll; $('closeSheet').onclick = A.closeAll;
    $('model').onclick = () => { A.renderSheet(); $('sheet').classList.add('on'); A.overlay(true); };
    $('newp').onclick = A.createProject;
  };
})(window.AirLva);
