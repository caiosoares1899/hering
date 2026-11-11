// 🛡️ ANTES do deploy das regras de papel (C1/C2, 11/11/2026). Cole no console (F12) do painel.html de PRODUÇÃO, logado como o Caio.
// As regras novas só reconhecem ADM por `kanban/usuarios/{uid}/role === 'adm'` (ou o e-mail do Caio). Quem está na lista de ADMs
// (kanban/config/adm_emails) mas tem outro papel gravado perderia, no deploy, poderes de ADM no banco (gestor OKR, papéis, ADMs…).
// Este script lista essas pessoas e, se você confirmar, grava role 'adm' nelas (as regras antigas ainda deixam o Caio fazer isso).
(async () => {
  if (!window._db || !window._ref || !window._get || !window._set) { console.error('❌ Abra no console do painel.html já logado.'); return; }
  const lista = (await window._get(window._ref(window._db, 'kanban/config/adm_emails'))).val() || [];
  const emails = (Array.isArray(lista) ? lista : Object.values(lista)).map(e => String(e || '').toLowerCase()).filter(Boolean);
  const usuarios = (await window._get(window._ref(window._db, 'kanban/usuarios'))).val() || {};
  const porEmail = {}; Object.entries(usuarios).forEach(([uid, u]) => { if (u && u.email) porEmail[String(u.email).toLowerCase()] = { uid, role: u.role || '(sem papel)' }; });
  const linhas = emails.map(e => ({ email: e, uid: porEmail[e] ? porEmail[e].uid : '(ainda não entrou)', role: porEmail[e] ? porEmail[e].role : '—' }));
  console.table(linhas);
  const acertar = linhas.filter(l => l.uid !== '(ainda não entrou)' && l.role !== 'adm');
  if (!acertar.length) { console.log('✅ Todos os ADMs da lista já têm role "adm" — pode seguir com o deploy.'); return; }
  console.warn('⚠️ ADMs da lista sem role "adm" gravado:', acertar.map(l => l.email));
  if (!confirm('Gravar role "adm" em ' + acertar.length + ' pessoa(s) da lista de ADMs?\n\n' + acertar.map(l => l.email).join('\n'))) return;
  for (const l of acertar) {
    try { await window._set(window._ref(window._db, 'kanban/usuarios/' + l.uid + '/role'), 'adm'); console.log('✅', l.email); }
    catch (e) { console.warn('❌', l.email, e && e.message); }
  }
})();
