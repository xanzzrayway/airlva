// State, daftar mode/model, dan daftar plan AirLva
(function (w) {
  const A = (w.AirLva = w.AirLva || {});
  A.$ = (id) => document.getElementById(id);
  A.VERSION = '202611261200';
  // projects: [{ id, name, mode, loaded, msgs: [{ r, t, mode, err }] }]
  A.state = { projects: [], cur: null, sb: null, user: null, profile: null };
  A.MODES = [
    { label: 'Buat Website', key: 'website', model: 'gemini-3.5-flash' },
    { label: 'Chat Santai', key: 'chat', model: 'gemini-3.5-flash-lite' },
    { label: 'Buat kode', key: 'code', model: 'gemini-3.8-flash' },
  ];
  A.fmt = (n) => Number(n).toLocaleString('id-ID');
  A.modeInfo = (label) => A.MODES.find((m) => m.label === label) || null;
  A.PLANS = {
    free: { label: 'Free', initial: 1000, daily: 500 },
    pro: { label: 'Pro', initial: 5000, daily: 1000 },
  };
})(window);
