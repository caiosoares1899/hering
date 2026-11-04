(async () => {
  // 🎯 Cria no Radar o OBJETIVO "Calendário de gestão do Digital": o que já fizemos (Marcos concluídos + Progressos), o que vem (Próximos passos + Marcos a fazer),
  // os indicadores, os riscos e os planos de ação — e, no Marco "📌 Decisões, riscos e limites", 3 comentários com as decisões, os riscos (com a mitigação) e o resumo.
  // Cole no console (F12) do Radar — okr.html — logado (ADM). Roda em SIMULAÇÃO por padrão: só mostra o que criaria. Para gravar, mude APLICAR para true e rode de novo.
  // Idempotente: ids fixos; se o Objetivo já existir, não grava nada (não duplica). Não envia aviso nenhum (nem sino, nem feed).
  const APLICAR = false;
  if (!window._db || !window._ref || !window._set || !window._get || !window._update || !window._currentUser) { console.error('❌ Abra isto no console do Radar (okr.html) já logado.'); return; }
  const R = p => window._ref(window._db, p), ler = async p => (await window._get(R(p))).val();
  const agora = new Date().toISOString(), u = window._currentUser, quem = u.displayName || u.email || '?';
  const OBJ_ID = 'obj_calendario_gestao_digital';

  // ── pessoas: os ADMs (Caio e Rafael) e quem está rodando o script ──────────────────────────────────────────────────────────────────────
  const adm = (await ler('kanban/config/adm_emails')) || [], pub = (await ler('kanban/usuarios_publicos')) || {};
  const admEmails = (Array.isArray(adm) ? adm : Object.values(adm)).map(e => String(e).toLowerCase());
  const admUids = Object.keys(pub).filter(id => pub[id] && admEmails.includes(String(pub[id].email || '').toLowerCase()));
  const rafael = admUids.find(id => /rafael/i.test((pub[id] || {}).nome || '')) || '';
  const responsaveis = Array.from(new Set([u.uid].concat(rafael ? [rafael] : [])));
  console.log('Responsáveis do Objetivo:', responsaveis.map(id => (pub[id] || {}).nome || id), rafael ? '' : '(Rafael não foi achado entre os ADMs — adicione depois no Objetivo)');

  // ── o Objetivo ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  const hist = (what, tipo) => ({ at: agora, uid: u.uid, who: quem, what, tipo: tipo || 'criado' });
  const objetivo = {
    id: OBJ_ID, torre: 'digital', areaId: 'geral', pilar: 'Gestão e governança do Digital', trimestres: ['4T', '1T27'],
    titulo: 'Calendário de gestão do Digital: cerimônias, entregas e cobrança num só lugar',
    descricao: 'Um calendário único no Radar com as cerimônias e entregas da gestão do Digital, cobrança automática por dias úteis e um subagente de agenda que propõe e a pessoa confirma.',
    responsaveis, tagIds: [], cardLinks: [], mostrarApresentacao: true, arquivado: false,
    indicadores: [
      'Entregas da gestão com responsável e prazo no Radar: meta 100%',
      'Entregas atrasadas há 3+ dias úteis sem escalonamento: meta 0',
      'Cadência de cada trimestre gerada e ajustada até 15 dias antes do início',
      'Reuniões da gestão com data e participantes confirmados antes de ligar o lembrete'
    ],
    progressos: [
      'Tipo 📦 Entrega e macros PLAN/CHECK/DO/ENGAJAMENTO no 📅 Calendário do Radar',
      '📋 Cadência do Digital gera planos táticos, compras e All Hands sem duplicar',
      'Plano pai conclui sozinho quando as 7 filhas são entregues',
      'Cobrança automática por dias úteis, com resumo semanal da gestão no sino e push',
      'Subagente de agenda no Agente Ágil: propõe, e a pessoa confirma com ✅',
      '2 revisões do Antigravity: 8 riscos reais corrigidos antes da produção',
      'Tudo em produção desde 04/11/2026 (Radar v2.103)'
    ],
    proximosPassos: [
      'Rafael e Caio validam a Cadência de um trimestre inteiro, de ponta a ponta',
      'Cadastrar Showroom e Lançamento das coleções como Entrega (macro DO) com responsáveis',
      'Ajustar datas e responsáveis da Cadência e só então ligar os lembretes das reuniões',
      'Tela para editar a lista de gestores da cobrança (hoje só pelo banco)',
      'Ponte de leitura com o Google Agenda, só de uma agenda de serviço (confirmar com a TI)',
      'Endurecer as regras do banco do calendário (permissão por torre e responsável)'
    ],
    riscos: [
      'Regras do banco do calendário abertas a qualquer conta @ciahering (trava só na tela)',
      'Cadência nasce com data provisória: lembrete ligado cedo avisa a torre à toa',
      'Sem responsável e prazo reais a cobrança não tem a quem avisar',
      'Agenda do Google (Big Review, Fritos, Weeklyzona) fica fora do Radar e pode divergir',
      'Aviso demais vira ruído e o time passa a ignorar',
      'O Agente lê a Ajuda publicada: mudou o recurso, é preciso republicar as funções'
    ],
    planosAcao: [
      'Revisar com o Rafael as datas e responsáveis do próximo trimestre antes de ligar avisos',
      'PR própria endurecendo as regras do calendário, com teste no simulador de regras',
      'Confirmar com a TI o uso de agenda compartilhada de serviço antes de integrar',
      'Acompanhar 2 semanas de cobrança e ajustar a régua (preventivo e escalonamento)'
    ],
    criadoEm: agora, criadoPor: quem, atualizadoEm: agora, atualizadoPor: quem,
    history: [hist('criou o Objetivo (a partir do documento docs/CALENDARIO_GESTAO.md)')]
  };

  // ── os Marcos (o que foi feito = concluído; o que vem = não iniciado, sem prazo inventado: o dono define) ──────────────────────────────────
  const M = (n, nome, descricao, prazo, progresso, responsavel) => ({
    id: 'marco_calgestao_' + n, objetivoId: OBJ_ID, nome, descricao, prazo: prazo || '', progresso, responsavel: responsavel || '',
    checklist: [], tags: [], participantes: [], arquivado: false, mostrarApresentacao: true,
    criadoEm: agora, criadoPor: quem, atualizadoEm: agora, atualizadoPor: quem, history: [hist('criou o Marco')]
  });
  const marcos = [
    M(1, 'Calendário com 📦 Entrega e macros (PLAN/CHECK/DO/ENGAJAMENTO)', 'Entrega com prazo, responsáveis e situação; plano pai com filhas; filtro por macro.', '2026-11-03', 'concluido', u.uid),
    M(2, '📋 Cadência do Digital', 'Gera planos táticos, compras, All Hands e fixos por trimestre, sem duplicar.', '2026-11-03', 'concluido', u.uid),
    M(3, 'Cobrança automática por dias úteis', 'Preventivo, véspera, dia, atraso e escalonamento; resumo semanal da gestão.', '2026-11-03', 'concluido', u.uid),
    M(4, 'Subagente de agenda no Agente Ágil', 'Propõe criar, remarcar, excluir e cobrar; a pessoa confirma. Nunca grava sozinho.', '2026-11-03', 'concluido', u.uid),
    M(5, 'Revisões do Antigravity (2 rodadas)', '8 riscos reais corrigidos: dias úteis, lembretes provisórios, pai/filhas, avisos.', '2026-11-03', 'concluido', u.uid),
    M(6, 'Calendário de gestão em produção', 'Radar v2.103 e mare-notif v40; conhecimento do Agente regenerado.', '2026-11-04', 'concluido', u.uid),
    M(7, '📌 Decisões, riscos e limites (ver os comentários)', 'Registro do que foi decidido, dos riscos assumidos e do que ficou de fora.', '2026-11-04', 'concluido', u.uid),
    M(8, 'Validar a Cadência de um trimestre inteiro com o Rafael', 'Conferir datas, planos e responsáveis do próximo trimestre; ajustar antes de ligar avisos.', '', 'nao_iniciado', rafael || u.uid),
    M(9, 'Cadastrar Showroom e Lançamento das coleções (Entrega, macro DO)', 'Uma entrega por coleção (Out, Inv, Ver, AV), com as pessoas que o agente vai cobrar.', '', 'nao_iniciado', u.uid),
    M(10, 'Ligar os lembretes das reuniões da Cadência', 'Só depois de confirmar datas e participantes de All Hands e Resultados do E-commerce.', '', 'nao_iniciado', u.uid),
    M(11, 'Tela para a lista de gestores da cobrança', 'Hoje só o banco guarda quem recebe o escalonamento (Caio e Rafael, por padrão).', '', 'nao_iniciado', u.uid),
    M(12, 'Endurecer as regras do banco do calendário', 'PR própria: permissão por torre, organizador e responsável, com teste no simulador.', '', 'nao_iniciado', u.uid),
    M(13, 'Ponte de leitura com o Google Agenda (agenda de serviço)', 'Só leitura, sem sincronizar nos dois sentidos; confirmar o desenho com a TI antes.', '', 'nao_iniciado', u.uid)
  ];

  // ── os comentários do Marco 7 (texto longo: decisões, riscos com mitigação, resumo) ────────────────────────────────────────────────────
  const C = (n, text) => ({ id: 'c_calgestao_' + n, uid: u.uid, author: quem, foto: u.photoURL || '', text, ts: new Date(Date.parse(agora) + n * 1000).toISOString() });
  const comentarios = [
    C(1, `📅 DECISÕES (03/11/2026)\n\n• Onde: dentro do 📅 Calendário do Radar, e não numa ferramenta nova — são pilares estratégicos e o Radar já tem agenda global, recorrência, lembretes e o Agente Ágil.\n• Fonte: o rascunho do Rafael (PLAN / CHECK / DO / ENGAJAMENTO), transcrito em docs/CALENDARIO_GESTAO.md.\n• Rituais ágeis: fora — o time já se organiza.\n• Big Review, Encontro dos Fritos, Weeklyzona: fora — já estão no Google Agenda (agenda do Caio, compartilhada com todos).\n• Pulso dos Times / Travessia: só como lembrete.\n• Showroom e Lançamento das Coleções: uma data por coleção (Out, Inv, Ver, AV), cadastradas como Entrega (macro DO) com as pessoas que o agente vai cobrar.\n• Iniciativas do Digital = o bloco quinzenal que já existe (Check-in OKR Bloco 1/2): não foi recriado.\n• Plano de Compras: cada trimestre fecha uma coleção só; o dono do plano edita depois.\n• Cobrança: régua padrão, contada em DIAS ÚTEIS, sem IA (por data, previsível); escalonamento para Caio e Rafael (os dois ADMs); aviso por sino e push; resumo da gestão toda segunda.\n• Subagente: começa PROPONDO — nunca grava sozinho; a pessoa confirma com ✅.\n• Google Agenda (futuro): só leitura, só de uma agenda de serviço, nunca agenda pessoal, sem sincronizar nos dois sentidos; confirmar com a TI.\n• Tudo nasce provisório (dia inteiro, sem responsável): os donos ajustam datas e responsáveis; as reuniões nascem com os lembretes DESLIGADOS.`),
    C(2, `⚠️ RISCOS E COMO MITIGAMOS\n\n1) Regras do banco abertas — o calendário aceita escrita de qualquer conta @ciahering; a trava de quem cria/edita está na tela e na confirmação, não no banco. Mitigação: PR própria com permissão por torre/organizador/responsável e teste no simulador (Marco "Endurecer as regras").\n2) Data provisória avisando à toa — a Cadência nasce com datas chutadas. Mitigação: as reuniões nascem com lembretes desligados; só ligar depois de confirmar data e participantes.\n3) Dias corridos × fim de semana — achado do Antigravity: em dias corridos o prazo de sexta pulava o "atrasou" e escalava na segunda. Corrigido: tudo conta em dias úteis, sem aviso no sábado e no domingo.\n4) Cobrança sem a quem cobrar — entrega sem responsável não recebe aviso; aparece só no resumo semanal ("K sem responsável"). Mitigação: preencher responsáveis na validação com o Rafael.\n5) Agente errar data ou pessoa — risco de disparar notificação para dezenas de pessoas. Mitigação: ele só PROPÕE; recusa data no passado, nome ambíguo, hora ausente, link sem https; só quem pediu (ou ADM) confirma; edição com base velha não grava.\n6) Ruído — aviso demais ensina o time a ignorar. Mitigação: 1 notificação por pessoa por dia, nada no fim de semana, "entregue" encerra, cada aviso carimbado com a data do prazo (não repete); o ADM liga/desliga o tipo na Central de Notificações.\n7) Dependência de deploy — o Agente lê a Ajuda de PRODUÇÃO; mudou o recurso, é preciso regenerar o conhecimento e republicar as 5 funções do agente.\n8) Google Agenda fora do Radar — Big Review, Fritos e Weeklyzona continuam lá e podem divergir do calendário. Mitigação: ponte de leitura (Marco próprio), só depois de a TI confirmar o desenho.`),
    C(3, `🧭 RESUMO — O QUE FOI FEITO E O QUE VEM\n\nFEITO (03–04/11/2026): 📦 Entrega + macros + filtro (#1575) · plano pai/filhas, Plano de Compras de 1 coleção, aviso de prazo (#1576) · cobrança automática (#1577) · subagente de agenda (#1578) · documento docs/CALENDARIO_GESTAO.md (#1582) · correções das 2 revisões do Antigravity (#1583) · promoção para produção (#1588).\n\nVEM: validar a Cadência de um trimestre inteiro com o Rafael · cadastrar Showroom e Lançamento das coleções · ligar os lembretes das reuniões · tela dos gestores da cobrança · endurecer as regras do banco · ponte de leitura com o Google Agenda (com a TI).\n\nMÉTRICAS DE SUCESSO: 100% das entregas com responsável e prazo; zero atraso de 3+ dias úteis sem escalonamento; cadência do trimestre pronta 15 dias antes; reuniões com data e participantes confirmados antes do lembrete.\n\nDocumento completo: docs/CALENDARIO_GESTAO.md (no repositório).`)
  ];

  // ── conferência dos limites de caracteres da apresentação (avisa, não bloqueia) ────────────────────────────────────────────────────────
  const aviso = [];
  const lim = (rot, t, n) => { if (String(t).length > n) aviso.push(rot + ' (' + String(t).length + '/' + n + '): ' + String(t).slice(0, 50) + '…'); };
  lim('descrição', objetivo.descricao, 200);
  ['indicadores', 'progressos', 'proximosPassos', 'riscos', 'planosAcao'].forEach(c => objetivo[c].forEach(t => lim(c, t, 90)));
  marcos.forEach(m => { lim('marco nome', m.nome, 70); lim('marco descrição', m.descricao, 110); });
  if (aviso.length) console.warn('Acima do limite da apresentação (só avisa):', aviso);

  const existe = await ler('kanban/okr/objetivos/' + OBJ_ID);
  console.log('📋 O que seria criado:', { objetivo: objetivo.titulo, indicadores: objetivo.indicadores.length, progressos: objetivo.progressos.length, proximosPassos: objetivo.proximosPassos.length, riscos: objetivo.riscos.length, planosAcao: objetivo.planosAcao.length, marcos: marcos.length, concluidos: marcos.filter(m => m.progresso === 'concluido').length, comentarios: comentarios.length });
  if (existe) { console.error('⛔ O Objetivo "' + OBJ_ID + '" já existe — nada foi gravado (para recriar, exclua ou arquive o antigo e rode de novo).'); return; }
  if (!APLICAR) { console.log('🔎 SIMULAÇÃO — nada foi gravado. Para criar de verdade, mude APLICAR para true e rode de novo.'); return; }

  const updates = {};
  updates['kanban/okr/objetivos/' + OBJ_ID] = objetivo;
  marcos.forEach(m => { updates['kanban/okr/marcos/' + m.id] = m; });
  comentarios.forEach(c => { updates['kanban/okr/marco_comments/marco_calgestao_7/' + c.id] = c; });
  await window._update(window._ref(window._db), updates);
  console.log('✅ Objetivo criado com ' + marcos.length + ' Marcos e ' + comentarios.length + ' comentários. Recarregue o Radar (F5) e procure "Calendário de gestão do Digital".');
})();
