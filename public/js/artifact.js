// Viewer artefak: pratinjau website / kode, salin, unduh
(function (A) {
  const $ = A.$;
  const X = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  const EXT = { html: 'html', javascript: 'js', js: 'js', python: 'py', py: 'py', css: 'css', json: 'json', bash: 'sh', sh: 'sh', java: 'java', php: 'php', cpp: 'cpp', c: 'c' };

  function copy(txt) {
    const fb = () => { const t = document.createElement('textarea'); t.value = txt; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); } catch (e) {} t.remove(); };
    try { navigator.clipboard.writeText(txt).catch(fb); } catch (e) { fb(); }
  }

  A.openArtifact = function (ai) {
    const code = A.bestCode(A.parse(ai.t).hasil), v = $('artv');
    const web = ai.mode === 'website' || code.lang === 'html';
    const title = A.artTitle(ai, code);
    let tab = web ? 'pv' : 'code';
    function draw() {
      v.innerHTML =
        '<div class="avh"><button class="ib" data-a="x" aria-label="Tutup">' + X + '</button><div class="avt">' + A.esc(title) +
        '</div><div class="ra"><button class="mini" data-a="copy">Salin</button><button class="mini" data-a="dl">Unduh</button></div></div>' +
        (web ? '<div class="tabs"><button data-a="pv" class="' + (tab === 'pv' ? 'on' : '') + '">Pratinjau</button><button data-a="code" class="' + (tab === 'code' ? 'on' : '') + '">Kode</button></div>' : '') +
        '<div class="avb">' + (tab === 'pv'
          ? '<iframe class="avf" sandbox="allow-scripts" srcdoc="' + A.escA(code.body) + '"></iframe>'
          : '<pre class="avc"><code>' + A.esc(code.body) + '</code></pre>') + '</div>';
    }
    v.onclick = (e) => {
      const b = e.target.closest('[data-a]'); if (!b) return;
      const a = b.dataset.a;
      if (a === 'x') { v.classList.remove('on'); setTimeout(() => (v.innerHTML = ''), 320); }
      else if (a === 'pv' || a === 'code') { tab = a; draw(); }
      else if (a === 'copy') { copy(code.body); b.textContent = 'Tersalin ✓'; setTimeout(() => (b.textContent = 'Salin'), 1200); }
      else if (a === 'dl') {
        const l = document.createElement('a');
        l.href = URL.createObjectURL(new Blob([code.body], { type: 'text/plain' }));
        l.download = 'airlva-' + (web ? 'website.html' : 'kode.' + (EXT[code.lang] || 'txt'));
        l.click(); setTimeout(() => URL.revokeObjectURL(l.href), 2000);
      }
    };
    draw();
    requestAnimationFrame(() => v.classList.add('on'));
  };
})(window.AirLva);
