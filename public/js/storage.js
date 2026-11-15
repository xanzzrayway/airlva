// State, daftar mode/model, dan penyimpanan lokal AirLva
(function (w) {
  const A = (w.AirLva = w.AirLva || {});
  A.$ = (id) => document.getElementById(id);
  A.state = { projects: [], cur: null, mode: null, msgs: [] };
  A.MODES = [
    { label: 'Buat Website', key: 'website', model: 'gemini-3.5-flash' },
    { label: 'Chat Santai', key: 'chat', model: 'gemini-3.5-flash-lite' },
    { label: 'Buat kode', key: 'code', model: 'gemini-3.8-flash' },
  ];
  A.modeInfo = (label) => A.MODES.find((m) => m.label === label) || null;
  A.load = function () {
    try { A.state.projects = JSON.parse(localStorage.getItem('airlva_p') || '[]'); } catch (e) {}
  };
  A.save = function () {
    try { localStorage.setItem('airlva_p', JSON.stringify(A.state.projects)); } catch (e) {}
  };
})(window);
