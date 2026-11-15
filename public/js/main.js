// Titik masuk AirLva
(function (A) {
  A.load();
  A.initUI();
  A.initChat();
  A.render();
  setTimeout(() => A.$('splash').classList.add('out'), 2600);
})(window.AirLva);
