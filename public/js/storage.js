// State, daftar mode/model, dan penyimpanan project + chat (localStorage)
(function (w) {
  const A = (w.AirLva = w.AirLva || {});
  A.$ = (id) => document.getElementById(id);
  // projects: [{ name, mode, msgs: [{ r, t, mode, err }] }]
  A.state = { projects: [], cur: null };
  A.MODES = [
    { label: 'Buat Website', key: 'website', model: 'gemini-3.5-flash' },
    { label: 'Chat Santai', key: 'chat', model: 'gemini-3.5-flash-lite' },
    { label: 'Buat kode', key: 'code', model: 'gemini-3.8-flash' },
  ];
  A.modeInfo = (label) => A.MODES.find((m) => m.label === label) || null;

  A.load = function () {
    const S = A.state;
    try {
      const raw = localStorage.getItem('airlva_v2');
      if (raw) {
        const d = JSON.parse(raw);
        S.projects = d.projects || [];
        S.cur = typeof d.cur === 'number' ? d.cur : null;
      } else {
        // migrasi dari versi lama (hanya nama project)
        const old = JSON.parse(localStorage.getItem('airlva_p') || '[]');
        S.projects = old.map((n) => ({ name: n, mode: null, msgs: [] }));
      }
    } catch (e) {}
    if (!S.projects[S.cur]) S.cur = null;
  };

  A.save = function () {
    const S = A.state;
    try {
      localStorage.setItem('airlva_v2', JSON.stringify({
        cur: S.cur,
        projects: S.projects.map((p) => ({
          name: p.name, mode: p.mode,
          msgs: p.msgs.filter((m) => !m.live).map((m) => ({ r: m.r, t: m.t, mode: m.mode, err: m.err })),
        })),
      }));
    } catch (e) {}
  };
})(window);
