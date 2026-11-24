// 🔒 Carga inicial do diretório público (fase A3 de docs/ideias/usuarios-leitura-fechar.md, 24/11/2026)
// Cole no console (F12) do PAINEL (painel.html ou painel-dev.html) logado como ADM. Precisa das regras da fase A (#1955) no ar.
//
// O que faz, para cada pessoa em kanban/usuarios:
//   • torre / gestorOkr → copia para kanban/usuarios_publicos/{uid} quando faltam ou divergem (gestorOkr só true; tira do espelho se a fonte não tem);
//   • quem NÃO tem espelho nenhum ganha o básico: nome, email, init, foto, role, inscrito, squads, squads_roles (+ diretoria, se válida);
//   • nunca apaga nada além de um gestorOkr do espelho sem fonte; nunca mexe no cadastro.
// 1ª rodada: SÓ MOSTRA o plano (console.table). Para gravar: rode de novo com  window.__ESPELHO_GRAVAR = true  antes.
// Grava em lotes de 50 pessoas (um update multi-caminho por lote) e diz quantas passaram e quais falharam (a regra recusa espelho ≠ fonte).
(async () => {
  if (!window._db || !window._ref || !window._get || !window._update) { console.error('❌ Abra no console do Painel já logado.'); return; }
  const TORRE_RE = /^[a-z0-9_-]{1,40}$/, DIR_RE = /^(digital|rh|marca|tecnologia)$/;
  const [sU, sP] = await Promise.all([window._get(window._ref(window._db, 'kanban/usuarios')), window._get(window._ref(window._db, 'kanban/usuarios_publicos'))]);
  const usuarios = sU.val() || {}, publicos = sP.val() || {};
  const plano = [], pulados = [];
  for (const [uid, u] of Object.entries(usuarios)) {
    if (!u || typeof u !== 'object' || !/^[A-Za-z0-9_-]{1,128}$/.test(uid)) continue;
    const pub = publicos[uid], up = {};
    const P = c => 'usuarios_publicos/' + uid + '/' + c;
    if (!pub) {   // sem espelho nenhum: o básico (as regras do espelho não validam estes campos; diretoria só se válida)
      up[P('nome')] = u.nome || ''; up[P('email')] = u.email || ''; up[P('init')] = u.init || ''; up[P('foto')] = typeof u.foto === 'string' ? u.foto : '';
      up[P('role')] = u.role || 'membro'; up[P('inscrito')] = !!u.inscrito;
      if (u.squads) up[P('squads')] = u.squads; if (u.squads_roles) up[P('squads_roles')] = u.squads_roles;
      if (typeof u.diretoria === 'string' && DIR_RE.test(u.diretoria)) up[P('diretoria')] = u.diretoria;
    }
    if (typeof u.torre === 'string') {
      if (!TORRE_RE.test(u.torre)) pulados.push({ uid, nome: u.nome || '', motivo: 'torre fora do formato: ' + u.torre });
      else if (!pub || pub.torre !== u.torre) up[P('torre')] = u.torre;
    }
    if (u.gestorOkr === true) { if (!pub || pub.gestorOkr !== true) up[P('gestorOkr')] = true; }
    else if (pub && pub.gestorOkr != null) up[P('gestorOkr')] = null;
    if (Object.keys(up).length) plano.push({ uid, nome: u.nome || u.email || uid, novo: !pub, campos: Object.keys(up).map(k => k.split('/').pop()).join(', '), up });
  }
  console.log('📋 Pessoas no cadastro:', Object.keys(usuarios).length, '· com espelho:', Object.keys(publicos).length, '· a ajustar:', plano.length, '(espelho novo:', plano.filter(x => x.novo).length + ')');
  if (plano.length) console.table(plano.map(({ uid, nome, novo, campos }) => ({ uid, nome, novo, campos })));
  if (pulados.length) { console.warn('⚠ Pulados (corrigir à mão no cadastro):'); console.table(pulados); }
  if (!window.__ESPELHO_GRAVAR) { console.log('ℹ️ Nada foi gravado. Para gravar: window.__ESPELHO_GRAVAR = true  e cole o script de novo.'); return; }
  window.__ESPELHO_GRAVAR = false;
  let ok = 0; const falhas = [];
  for (let i = 0; i < plano.length; i += 50) {
    const lote = plano.slice(i, i + 50), up = Object.assign({}, ...lote.map(x => x.up));
    try { await window._update(window._ref(window._db, 'kanban'), up); ok += lote.length; }
    catch (e) {   // um lote recusado: tenta uma pessoa por vez para achar quem falha
      for (const x of lote) { try { await window._update(window._ref(window._db, 'kanban'), x.up); ok++; } catch (e2) { falhas.push({ uid: x.uid, nome: x.nome, erro: e2.code || e2.message }); } }
    }
  }
  console.log('✅ Espelho ajustado para', ok, 'pessoa(s).'); if (falhas.length) { console.warn('❌ Falharam:'); console.table(falhas); }
})();
