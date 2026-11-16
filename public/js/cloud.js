// Supabase: login Google, profil, project, dan pesan
(function (A) {
  const S = A.state;
  // hasil: 'ok' | 'nolib' | 'nocfg' | 'novars'
  A.initCloud = async function () {
    if (!window.supabase) return 'nolib';
    let c;
    try { const r = await fetch('/api/config'); if (!r.ok) return 'nocfg'; c = await r.json(); } catch (e) { return 'nocfg'; }
    if (!c.url || !c.anonKey) return 'novars';
    S.sb = window.supabase.createClient(c.url, c.anonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
    return 'ok';
  };
  A.login = async () => {
    const { error } = await S.sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + '/' } });
    if (error) throw error;
  };
  A.logout = async () => { await S.sb.auth.signOut(); location.reload(); };
  A.getSession = async () => (await S.sb.auth.getSession()).data.session;

  A.fetchProfile = async () => (await S.sb.from('profiles').select('*').eq('id', S.user.id).maybeSingle()).data;
  A.ensureProfile = async (plan) => {
    const { data, error } = await S.sb.rpc('ensure_profile', { p_plan: plan || null });
    if (error) throw error; S.profile = data; return data;
  };
  A.setPlan = async (plan) => {
    const { error } = await S.sb.rpc('set_plan', { p_plan: plan });
    if (error) throw error; S.profile.plan = plan;
  };

  A.loadProjects = async () => {
    const { data, error } = await S.sb.from('projects').select('id,name,mode').order('created_at');
    if (error) throw error;
    S.projects = (data || []).map((p) => ({ id: p.id, name: p.name, mode: p.mode, msgs: [], loaded: false }));
  };
  A.loadMsgs = async (p) => {
    const { data, error } = await S.sb.from('messages').select('role,content,mode,err').eq('project_id', p.id).order('id');
    if (error) throw error;
    p.msgs = data.map((m) => ({ r: m.role, t: m.content, mode: m.mode || undefined, err: m.err || undefined }));
    p.loaded = true;
  };
  A.dbNewProject = async (name) => {
    const { data, error } = await S.sb.from('projects').insert({ name }).select('id,name,mode').single();
    if (error) throw error; return data;
  };
  A.dbProject = (p, fields) => S.sb.from('projects').update(fields).eq('id', p.id);
  A.dbDelProject = (p) => S.sb.from('projects').delete().eq('id', p.id);
  A.dbMsg = (p, m) => S.sb.from('messages').insert({ project_id: p.id, role: m.r, content: m.t, mode: m.mode || null, err: !!m.err });
  A.fire = async (q) => {
    try { const { error } = await q; if (error) throw error; } catch (e) { A.toast('⚠ Gagal menyimpan ke server'); }
  };
})(window.AirLva);
