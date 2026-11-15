// Titik masuk AirLva
(function (A) {
  A.load();
  A.initUI();
  A.initChat();
  if (A.state.cur !== null) A.$('ptitle').textContent = A.state.projects[A.state.cur].name;
  A.setPill();
  A.render();
  // chat mengalir di belakang header & chatbox (tanpa tepi potong)
  const layout = () => {
    const hd = document.querySelector('header'), bx = A.$('box'), mn = A.$('main');
    mn.style.setProperty('--hh', hd.offsetHeight + 'px');
    mn.style.paddingTop = hd.offsetHeight + 12 + 'px';
    mn.style.paddingBottom = (bx.style.display === 'none' ? 20 : bx.offsetHeight + 28) + 'px';
  };
  layout();
  window.addEventListener('resize', layout);
  if (window.ResizeObserver) { const ro = new ResizeObserver(layout); ro.observe(document.querySelector('header')); ro.observe(A.$('box')); }
  setTimeout(() => A.$('splash').classList.add('out'), 2600);
})(window.AirLva);
