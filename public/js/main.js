// Titik masuk AirLva
(function (A) {
  A.load();
  A.initUI();
  A.initChat();
  if (A.state.cur !== null) A.$('ptitle').textContent = A.state.projects[A.state.cur].name;
  A.setPill();
  A.render();
  setTimeout(() => A.$('splash').classList.add('out'), 2600);
})(window.AirLva);
