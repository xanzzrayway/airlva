// Pop up dari admin (biasa atau HTML sendiri)
(function (A) {
  const $ = A.$, S = A.state;
  A.showPopup = function (p) {
    return new Promise((res) => {
      const o = $('popup');
      o.innerHTML = '<div class="pcard"><div class="pcontent"></div><button class="btn pok">' + (p.kind === 'html' ? 'Tutup' : 'Oke') + '</button></div>';
      const c = o.querySelector('.pcontent');
      if (p.kind === 'html') {
        const f = document.createElement('iframe'); f.className = 'pfr'; f.setAttribute('sandbox', 'allow-scripts'); c.appendChild(f); f.srcdoc = p.body;
      } else {
        const t = document.createElement('h3'); t.textContent = p.title;
        const m = document.createElement('p'); m.textContent = p.body; c.append(t, m);
      }
      o.classList.add('on');
      o.querySelector('.pok').onclick = () => { o.classList.remove('on'); setTimeout(() => (o.innerHTML = ''), 250); res(); };
    });
  };
  A.checkPopups = async function () {
    let seen = [];
    try { seen = JSON.parse(localStorage.getItem('airlva_popseen') || '[]'); } catch (e) {}
    const { data, error } = await S.sb.from('popups').select('id,title,kind,body').eq('active', true).order('id', { ascending: false }).limit(5);
    if (error || !data) return;
    for (const p of data.reverse()) {
      if (seen.includes(p.id)) continue;
      await A.showPopup(p);
      seen.push(p.id);
      try { localStorage.setItem('airlva_popseen', JSON.stringify(seen.slice(-50))); } catch (e) {}
    }
  };
})(window.AirLva);
