// mare-plantao-dev.js — 🛟 Plantão de Bugs: módulo COMPARTILHADO (Oceano = quem reporta · Painel › Monitor = quem administra). Runbook: docs/PLANTAO_BUGS.md.
//
// Por que um módulo: o Oceano só mostra o que o usuário comum vê (reportar + acompanhar os próprios chamados); TODO o controle de ADM foi para a aba 🐛 Monitor do Painel.
// As duas páginas precisam do mesmo código do card de bug na squad Dados (criar/atualizar) e do aviso ao autor — por isso ele mora aqui e não em cada página.
//   Oceano: MarePlantao.init({...}) e usa MarePlantao.sincronizarCard (cria o card ao reportar), .cardIdBug, .urlCardSquadDados, .montarPacote.
//   Painel: MarePlantao.init({...}) e MarePlantao.admin.iniciar(elemento) — lista as fichas (kanban/plantao), cadastra PR + script, valida, resolve, pausa.
// Quem usa passa o que é da página (P, usuário, perfil, esc, toast, tempoRel, souAdm). Mesmo ciclo dev→prod dos outros mare-*.js (?v=N nas páginas).
(function () {
  'use strict';
  const cfg = { P: (n) => n + '-dev.html', user: () => null, perfil: () => ({}), esc: (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])), toast: () => {}, tempoRel: () => '', souAdm: () => false };
  function init(o) { Object.assign(cfg, o || {}); }

  // ═════════════ Card do bug na squad Dados (coluna 🐛 Bugs) + aviso ao autor — movido do oceano-dev.html sem mudar o comportamento ═════════════

  function feriasCardIdBug(bugId){
    const s = String(bugId || '').trim();
    if(!s) return '';
    if(s.startsWith('c_ferias_')) return s;
    return 'c_ferias_' + s.replace(/^bug_ferias_/, '').replace(/[^0-9A-Za-z_]/g, '');
  }

  function feriasUrlCardSquadDados(bugOrId){
    const rawId = (bugOrId && typeof bugOrId === 'object') ? (bugOrId.kanbanCardId || bugOrId.id || '') : String(bugOrId || '');
    const cardId = feriasCardIdBug(rawId);
    const enc = cardId ? encodeURIComponent(cardId) : '';
    return cfg.P('kanban') + '?squad=dados' + (enc ? '&card=' + enc + '&opencard=' + enc : '');
  }

  const FERIAS_DEFAULT_COLS_DADOS = [
    {id:'backlog',name:'Backlog',color:'#888888',collapsible:true},
    {id:'todo',name:'A Fazer',color:'#38b6ff',collapsible:false},
    {id:'progress',name:'Em Progresso',color:'#1de9b6',collapsible:false},
    {id:'blocker',name:'Impedimentos',color:'#ff6b6b',collapsible:false},
    {id:'done',name:'Concluído',color:'#639922',collapsible:true}
  ];

  async function feriasGarantirColunaBugsDados(){
    const fbBase = 'kanban/squads/dados/dados';
    if(!window._get || !window._set || !window._ref || !window._db) return 'col_bugs';
    try{
      const snap = await window._get(window._ref(window._db, fbBase + '/columns'));
      const raw = snap && snap.exists() ? snap.val() : null;
      let cols = Array.isArray(raw) ? raw.filter(Boolean) : (raw && typeof raw === 'object' ? Object.values(raw).filter(Boolean) : []);
      if(!cols.length){
        cols = FERIAS_DEFAULT_COLS_DADOS.map(c=>Object.assign({}, c));
      }
      const colBug = cols.find(c => c && (String(c.id||'').toLowerCase().includes('bug') || String(c.name||'').toLowerCase().includes('bug')));
      if(colBug && colBug.id) return colBug.id;
      const novaCol = { id: 'col_bugs', name: '🐛 Bugs', color: '#ff6b6b', collapsible: true };
      const doneIdx = cols.findIndex(c => c && (c.id === 'done' || /conclu/i.test(String(c.name||''))));
      if(doneIdx >= 0) cols.splice(doneIdx, 0, novaCol);
      else cols.push(novaCol);
      await window._set(window._ref(window._db, fbBase + '/columns'), cols);
      return novaCol.id;
    }catch(e){
      return 'col_bugs';
    }
  }

  function feriasNormalizarPrioridadeKanban(p, imp){
    const s = String(p || '').toLowerCase().trim();
    if(s === 'critical' || s === 'high' || s === 'medium' || s === 'low') return s;
    if(s === 'bloqueado') return 'critical';
    if(s === 'alta') return /bloqueia|bloqueante|cr[ií]tic/i.test(String(imp || '')) ? 'critical' : 'high';
    if(s === 'media') return 'medium';
    if(s === 'baixa') return 'low';
    if(/bloqueia|bloqueante|cr[ií]tic/i.test(String(imp || ''))) return 'critical';
    return /atrapalha|alto|alta/i.test(String(imp || '')) ? 'high' : 'medium';
  }

  function feriasMontarCardBugDados(bugObj, colId, cardExistente){
    const ex = (cardExistente && typeof cardExistente === 'object') ? cardExistente : null;
    const cardId = feriasCardIdBug(bugObj.kanbanCardId || bugObj.id);
    const st = String(bugObj.status || 'pendente_monitorarbugs');
    const stLabel = st === 'resolvido'
      ? '🟢 Resolvido'
      : (st === 'em_analise' ? '🔵 Sendo tratado (Em análise)' : '🔴 Aberto (Na fila /monitorarbugs)');
    const imp = String(bugObj.impacto || '🟡 Dá pra contornar');
    const ehBloqueante = /bloqueia|bloqueante|cr[ií]tic/i.test(imp);
    const prio = feriasNormalizarPrioridadeKanban(ex && ex.priority, imp);
    const appNome = bugObj.app || 'Oceano';
    const arqAlvo = bugObj.arquivoAlvo || 'oceano-dev.html';
    const relatoTxt = String(bugObj.texto || bugObj.msg || 'Relato de bug').trim();
    const tituloCurto = relatoTxt.replace(/\s+/g, ' ').slice(0, 95);
    const title = '[Bug Férias · ' + appNome + '] ' + tituloCurto;

    const criadoMs = Number(bugObj.criadoEm) || Date.now();
    const criadoDataIso = new Date(criadoMs).toISOString().split('T')[0];
    const criadoFmt = new Date(criadoMs).toLocaleString('pt-BR');
    const agoraIso = new Date().toISOString();
    const hojeIso = agoraIso.split('T')[0];
    const autor = bugObj.autor || 'Time Hering';
    const quem = bugObj.atualizadoPor || autor;

    const linhasDesc = [
      '🏖️ CHAMADO DE BUG — ASSISTENTE FÉRIAS DO CAIO',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      '• Status atual: ' + stLabel,
      '• App / Módulo: ' + appNome + ' (' + arqAlvo + ')',
      '• Impacto: ' + imp,
      '• Reportado por: ' + autor + (bugObj.email ? ' (' + bugObj.email + ')' : ''),
      '• Data/Hora do relato: ' + criadoFmt,
      '• ID na fila: kanban/feedback/' + (bugObj.id || ''),
      '',
      '📝 O QUE ACONTECEU / COMO REPRODUZIR:',
      relatoTxt
    ];
    if(bugObj.evidenciaLink){
      linhasDesc.push('', '🔗 LINK / CARD / TELA INFORMADO:', String(bugObj.evidenciaLink));
    }
    if(bugObj.erroConsole){
      linhasDesc.push('', '🔴 ERROS DO CONSOLE (F12):', String(bugObj.erroConsole));
    }
    if(bugObj.evidenciaImg){
      linhasDesc.push('', '📸 PRINT ANEXADO:', 'Disponível na fila do Assistente Férias no Oceano (kanban/feedback/' + (bugObj.id || '') + '/evidenciaImg)');
    }
    if(bugObj.respostaStatus){
      linhasDesc.push('', '💬 DIAGNÓSTICO / RESOLUÇÃO (' + (bugObj.atualizadoPor || 'Agente / ADM') + '):', String(bugObj.respostaStatus));
    }
    // pacote ANÔNIMO (sem autor/e-mail/uid): é o que o agente de código recebe — recalculado dos campos, nunca o texto salvo (registros antigos podem ter o nome do autor)
    linhasDesc.push('', '🤖 PACOTE ANÔNIMO (cole no Antigravity):', feriasMontarPacoteAnonimo(bugObj));

    const linksArr = Array.isArray(ex && ex.links) ? ex.links.filter(Boolean).slice() : [];
    const addLinkUnico = (t, u)=>{
      const urlStr = String(u || '').trim();
      if(!/^https:\/\//i.test(urlStr)) return;
      if(!linksArr.some(x => x && x.url === urlStr)) linksArr.push({ title: t, url: urlStr });
    };
    if(bugObj.evidenciaLink && /^https:\/\//i.test(String(bugObj.evidenciaLink).trim())){
      addLinkUnico('Evidência / Tela do Bug', String(bugObj.evidenciaLink).trim());
    }

    const item1Txt = 'Relato registrado pelo usuário no Assistente Férias (' + autor + ')';
    const item2Txt = 'Diagnóstico /monitorarbugs em andamento pelo Antigravity / ADM';
    const item3Txt = 'Correção aplicada, validada e autor notificado no sino 🔔';
    const checklist = [
      { text: item1Txt, t: item1Txt, done: true },
      { text: item2Txt, t: item2Txt, done: st === 'em_analise' || st === 'resolvido' },
      { text: item3Txt, t: item3Txt, done: st === 'resolvido' }
    ];

    const colFinal = (ex && ex.col) ? ex.col : (colId || 'col_bugs');
    const flowBase = (ex && ex.flow && typeof ex.flow === 'object') ? Object.assign({}, ex.flow) : {};
    if(!flowBase[colFinal]) flowBase[colFinal] = criadoMs;
    if(!flowBase.enteredAt || typeof flowBase.enteredAt !== 'object'){
      flowBase.enteredAt = { [colFinal]: new Date(criadoMs).toISOString() };
    }
    if(!Array.isArray(flowBase.log) || !flowBase.log.length){
      flowBase.log = [{ from: '—', to: colFinal, at: new Date(criadoMs).toISOString() }];
    }

    const autoBlockerReason = '🔴 Bloqueia a operação (reportado via Assistente Férias)';
    const tinhaBlockerManual = Boolean(ex && ex.blocker && ex.blockerReason && ex.blockerReason !== autoBlockerReason);
    const blockerAtivo = st === 'resolvido' ? tinhaBlockerManual : (ehBloqueante || Boolean(ex && ex.blocker));
    const blockerReasonFinal = blockerAtivo
      ? ((ex && ex.blockerReason) || (ehBloqueante ? autoBlockerReason : ''))
      : '';
    const createdAntigoValido = (ex && typeof ex.created === 'string' && ex.created.trim() && !/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(ex.created.trim()) && !/^\d{4}-\d{2}-\d{2}/.test(ex.created.trim())) ? ex.created.trim() : '';

    return Object.assign({}, ex || {}, {
      id: cardId,
      col: colFinal,
      tags: Array.isArray(ex && ex.tags) && ex.tags.length ? ex.tags : ['bug'],
      tag: (ex && ex.tag) ? ex.tag : 'bug',
      title: title,
      desc: linhasDesc.join('\n'),
      descsExtra: Array.isArray(ex && ex.descsExtra) ? ex.descsExtra : [],
      owner: (ex && ex.owner) || '',
      demandante: (ex && ex.demandante) || autor,
      po: (ex && ex.po) || '',
      sp: (ex && ex.sp) || '',
      due: (ex && ex.due) || '',
      noDue: (ex && ex.due) ? Boolean(ex.noDue) : true,
      priority: prio,
      checklist: checklist,
      checklistGroups: Array.isArray(ex && ex.checklistGroups) ? ex.checklistGroups : [],
      riscos: Array.isArray(ex && ex.riscos) ? ex.riscos : [],
      participants: Array.isArray(ex && ex.participants) ? ex.participants : [],
      links: linksArr,
      linkedCards: Array.isArray(ex && ex.linkedCards) ? ex.linkedCards : [],
      childCardIds: Array.isArray(ex && ex.childCardIds) ? ex.childCardIds : [],
      executorType: (ex && ex.executorType) || 'human',
      agentStatus: st === 'resolvido' ? 'done' : (st === 'em_analise' ? 'running' : ((ex && ex.agentStatus) || '')),
      archived: Boolean(ex && ex.archived),
      blocker: blockerAtivo,
      blockerReason: blockerReasonFinal,
      created: createdAntigoValido || autor,
      createdAt: (ex && ex.createdAt && /^\d{4}-\d{2}-\d{2}$/.test(ex.createdAt)) ? ex.createdAt : criadoDataIso,
      edited: quem,
      editedAt: hojeIso,
      updatedAt: agoraIso,
      updatedBy: quem,
      origemFeriasBugId: bugObj.id || '',
      flow: flowBase
    });
  }

  const _feriasCardsSyncEmCurso = new Set();
  async function feriasSincronizarCardSquadDados(bugObj, eventoStatus){
    if(!bugObj || !bugObj.id) return null;
    if(!window._db || !window._ref || !window._get || !window._update) return null;
    const bugId = String(bugObj.id);
    const lockKey = bugId + ':' + String(eventoStatus || '');
    if(_feriasCardsSyncEmCurso.has(lockKey)) return null;
    _feriasCardsSyncEmCurso.add(lockKey);

    const fbBase = 'kanban/squads/dados/dados';
    const cardId = feriasCardIdBug(bugObj.kanbanCardId || bugId);
    try{
      const colId = await feriasGarantirColunaBugsDados();

      // 1) Descobre ou aloca a chave numérica em cards_index/<cardId> + valida contra colisão em cards/<cardKey>
      let cardKey = null;
      let cardExistente = null;
      try{
        const idxItemSnap = await window._get(window._ref(window._db, fbBase + '/cards_index/' + cardId));
        if(idxItemSnap && idxItemSnap.exists() && idxItemSnap.val() !== null && idxItemSnap.val() !== undefined){
          cardKey = String(idxItemSnap.val());
        }
      }catch(e){}

      if(cardKey !== null){
        try{
          const cSnap = await window._get(window._ref(window._db, fbBase + '/cards/' + cardKey));
          if(cSnap && cSnap.exists()){
            const val = cSnap.val();
            if(val && val.id && val.id !== cardId){
              // Posição ocupada por outro card: descarta cardKey para realocar sem sobrescrever card alheio
              cardKey = null;
            } else {
              cardExistente = val;
            }
          }
        }catch(e){}
      }

      if(cardKey === null){
        let floorMax = -1;
        const occupiedKeys = new Set();
        try{
          const cardsSnap = await window._get(window._ref(window._db, fbBase + '/cards'));
          const cardsVal = cardsSnap && cardsSnap.exists() ? cardsSnap.val() : null;
          if(cardsVal && typeof cardsVal === 'object'){
            Object.entries(cardsVal).forEach(([k, v])=>{
              const n = Number(k);
              if(Number.isInteger(n) && n >= 0){
                occupiedKeys.add(String(n));
                if(n > floorMax) floorMax = n;
              }
              if(v && v.id === cardId && cardKey === null){
                cardKey = String(k);
                cardExistente = v;
              }
            });
          }
        }catch(e){}

        if(cardKey === null){
          if(typeof window._runTransaction === 'function'){
            const txRes = await window._runTransaction(window._ref(window._db, fbBase + '/cards_index'), current=>{
              const map = (current && typeof current === 'object') ? Object.assign({}, current) : {};
              if(map[cardId] !== undefined && map[cardId] !== null && !occupiedKeys.has(String(map[cardId]))){
                return map;
              }
              const used = new Set(Object.values(map).map(String));
              occupiedKeys.forEach(k => used.add(String(k)));
              const nums = [...used].map(v=>Number(v)).filter(n=>Number.isInteger(n) && n>=0);
              let nextKey = Math.max(floorMax, nums.length ? Math.max(...nums) : -1) + 1;
              while(used.has(String(nextKey))) nextKey++;
              map[cardId] = String(nextKey);
              return map;
            });
            const finalMap = txRes && txRes.snapshot ? txRes.snapshot.val() : null;
            if(finalMap && finalMap[cardId] !== undefined) cardKey = String(finalMap[cardId]);
          }
          if(cardKey === null){
            cardKey = String(floorMax + 1);
          }
        }
      }

      // 2) Se ainda não leu cardExistente para o cardKey final, confere uma última vez
      if(!cardExistente && cardKey !== null){
        try{
          const cSnap = await window._get(window._ref(window._db, fbBase + '/cards/' + cardKey));
          if(cSnap && cSnap.exists()){
            const val = cSnap.val();
            if(!val || !val.id || val.id === cardId) cardExistente = val;
          }
        }catch(e){}
      }

      const cardNovo = feriasMontarCardBugDados(bugObj, colId, cardExistente);
      const agoraDate = new Date();
      const agoraIso = agoraDate.toISOString();
      const agoraPtBr = agoraDate.toLocaleDateString('pt-BR') + ' ' + agoraDate.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'});
      const quem = bugObj.atualizadoPor || bugObj.autor || 'Assistente Férias';
      const hist = Array.isArray(cardExistente && cardExistente.history)
        ? cardExistente.history.filter(Boolean).map(h => ({
            action: h.action || h.what || 'Atualizado via Assistente Férias',
            by: h.by || h.who || quem,
            col: h.col || cardNovo.col,
            ts: h.ts || (h.at ? new Date(h.at).toLocaleString('pt-BR') : agoraPtBr),
            who: h.who || h.by || quem,
            what: h.what || h.action || 'Atualizado via Assistente Férias',
            at: h.at || agoraIso
          }))
        : [];
      const acaoHist = !cardExistente
        ? 'Criado via Assistente Férias (' + (bugObj.app || 'Oceano') + ')'
        : (eventoStatus === 'resolvido'
            ? 'Marcou o bug como 🟢 Resolvido via Assistente Férias'
            : (eventoStatus === 'em_analise'
                ? 'Marcou o bug como 🔵 Sendo tratado via Assistente Férias'
                : 'Sincronizou dados do chamado via Assistente Férias'));
      hist.push({
        action: acaoHist,
        by: quem,
        col: cardNovo.col,
        ts: agoraPtBr,
        who: quem,
        what: acaoHist,
        at: agoraIso
      });
      if(hist.length > 50) cardNovo.history = hist.slice(-50);
      else cardNovo.history = hist;

      // 3) Grava card + cards_updated_at + cards_index atomicamente no squad Dados
      const updatesSquad = {};
      updatesSquad['cards/' + cardKey] = cardNovo;
      updatesSquad['cards_updated_at/' + cardId] = agoraIso;
      updatesSquad['cards_index/' + cardId] = String(cardKey);
      await window._update(window._ref(window._db, fbBase), updatesSquad);

      // 4) Registra comentário estruturado em card_comments/<cardId> com histórico da abertura / mudança de status
      const st = String(bugObj.status || 'pendente_monitorarbugs');
      const cmSuffix = (!cardExistente || eventoStatus === 'aberto') ? 'open' : (eventoStatus || st);
      const commentId = 'cm_ferias_' + cmSuffix.replace(/[^0-9A-Za-z_]/g, '') + '_' + bugId.replace(/[^0-9A-Za-z_]/g, '');
      let textoCm = '';
      if(!cardExistente || eventoStatus === 'aberto'){
        textoCm = '🏖️ **Relato de Bug registrado via Assistente Férias**\n'
          + '• **Módulo:** ' + (bugObj.app || 'Oceano') + ' (`' + (bugObj.arquivoAlvo || '') + '`)\n'
          + '• **Impacto:** ' + (bugObj.impacto || '') + '\n'
          + '• **Autor:** ' + (bugObj.autor || 'Time Hering') + '\n'
          + '• **Relato:** ' + String(bugObj.texto || bugObj.msg || '')
          + (bugObj.erroConsole ? '\n• **Console (F12):** `' + String(bugObj.erroConsole).slice(0, 220) + '`' : '');
      } else if(eventoStatus === 'em_analise' || eventoStatus === 'resolvido'){
        const ic = st === 'resolvido' ? '🟢 **Bug Resolvido**' : '🔵 **Bug Sendo Tratado (Em análise)**';
        textoCm = ic + ' — atualizado por **' + quem + '**\n'
          + (bugObj.respostaStatus ? '💬 ' + String(bugObj.respostaStatus) : '');
      }
      if(textoCm && window._set){
        const cmPayload = {
          id: commentId,
          uid: (cfg.user() && cfg.user().uid) || 'assistente_ferias',
          author: '🏖️ Assistente Férias (' + quem + ')',
          init: '🤖',
          foto: '',
          text: textoCm.trim(),
          ts: agoraIso
        };
        try{
          await window._set(window._ref(window._db, fbBase + '/card_comments/' + cardId + '/' + commentId), cmPayload);
          const allCmSnap = await window._get(window._ref(window._db, fbBase + '/card_comments/' + cardId));
          const totalCm = (allCmSnap && allCmSnap.exists() && allCmSnap.val() && typeof allCmSnap.val() === 'object')
            ? Object.keys(allCmSnap.val()).length
            : 1;
          await window._set(window._ref(window._db, fbBase + '/card_comments_count/' + cardId), totalCm);
        }catch(e){}
      }

      // 5) Vincula o ID do card no registro do bug em kanban/feedback/<bugId>
      bugObj.kanbanCardId = cardId;
      bugObj.kanbanSquad = 'dados';
      bugObj.kanbanColId = colId;
      bugObj.kanbanSchemaV = 3;
      try{
        await window._update(window._ref(window._db, 'kanban/feedback/' + bugId), {
          kanbanCardId: cardId,
          kanbanSquad: 'dados',
          kanbanColId: colId,
          kanbanSchemaV: 3
        });
      }catch(e){}

      _feriasCardsSyncEmCurso.delete(lockKey);
      return cardId;
    }catch(e){
      _feriasCardsSyncEmCurso.delete(lockKey);
      return null;
    }
  }


  async function feriasDispararNotifStatusBug(b, bugId, novoStatus, respostaStatus, quem, ts, nfIdFixo){
    if(!window._set || !window._ref || !window._db) return;
    const nfId = nfIdFixo || ('nf_bug_' + bugId + '_' + novoStatus);
    const iconeSt = novoStatus === 'resolvido' ? '🟢' : '🔵';
    const titNotif = novoStatus === 'resolvido'
      ? '🟢 Bug Resolvido (' + (b.app||'Oceano') + ')!'
      : '🔵 Seu relato de bug (' + (b.app||'Oceano') + ') está sendo tratado!';
    const msgNotif = (b.autor ? '@' + b.autor + ': ' : '') + respostaStatus + ' — Relato: "' + String(b.texto||b.msg||'').slice(0,90) + '"';
    const autorFmt = '🏖️ Assistente Férias (' + quem + ')';
    const notifPayload = {
      id: nfId,
      type: 'ferias_bug_status',
      tipo: 'ferias_bug_status',
      subtipo: 'bug_ferias_status',
      statusBug: novoStatus,
      bugId: bugId,
      app: b.app || 'Oceano',
      icone: iconeSt,
      title: titNotif,
      titulo: titNotif,
      sub: msgNotif,
      text: msgNotif,
      msg: msgNotif,
      texto: msgNotif,
      cardTitulo: titNotif,
      detalhe: respostaStatus,
      autor: autorFmt,
      autorNome: autorFmt,
      autorUid: 'assistente_ferias',
      destUid: b.uid || '',
      destEmail: b.email || '',
      torres: ['digital', '*'],
      read: false,
      criadoEm: ts,
      ts: new Date(ts).toISOString(),
      url: cfg.P('oceano') + '#ferias-bugs'
    };
    try{
      await window._set(window._ref(window._db, 'kanban/notif_feed/' + nfId), notifPayload);
    }catch(e){}
    if(b.uid){
      try{
        await window._set(window._ref(window._db, 'kanban/usuarios/' + b.uid + '/notificacoes/' + nfId), notifPayload);
      }catch(e){}
    }
  }

    // 🔒 Pacote ANÔNIMO: o único texto que sai daqui para o agente de código (Antigravity, comando /plantaobug). Só o BUG — sem autor, e-mail, uid, link de card nem print.
    // Espelho exato de functions/plantao/pacote.js (teste de paridade em functions/plantao/__tests__/pacote.test.js).
  function feriasSanitizarTexto(t, max){
    let x = String(t == null ? '' : t);
    x = x.replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '[e-mail]')                    // e-mails
         .replace(/https?:\/\/\S+/gi, '[link]')                                  // links (cards, drives, tokens na query)
         .replace(/\b(?:\+?55\s?)?\(?\d{2}\)?\s?9?\d{4}[-\s]?\d{4}\b/g, '[telefone]')
         .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, '[cpf]')
         .replace(/\b[A-Za-z0-9_-]{28,}\b/g, '[token]')                          // uids / ids longos / chaves
         .replace(/\s+/g, ' ').trim();
    return max ? x.slice(0, max) : x;
  }
  function feriasMontarPacoteAnonimo(b){
    b = b || {};
    const alvo = String(b.arquivoAlvo || 'kanban-dev.html').replace(/[^\w.\-]/g, '');
    const app = feriasSanitizarTexto(b.app || '', 40);
    const imp = feriasSanitizarTexto(b.impacto || '', 40);
    const desc = feriasSanitizarTexto(b.texto || b.msg || '', 900);
    const cons = feriasSanitizarTexto(b.erroConsole || '', 400);
    return '/plantaobug em ' + alvo + ' — Bug reportado no Oceano' + (app || imp ? ' (' + [app, imp].filter(Boolean).join(' · ') + ')' : '') + ': ' + desc
      + (cons ? ' [Console(F12), trecho sem dados pessoais: ' + cons + ']' : '');
  }

  const cardIdBug = feriasCardIdBug, urlCardSquadDados = feriasUrlCardSquadDados, sincronizarCard = feriasSincronizarCardSquadDados, dispararNotifStatus = feriasDispararNotifStatusBug, montarPacote = feriasMontarPacoteAnonimo;

  // ═════════════ 🛟 Painel de ADM do Plantão (Painel › Monitor) ═════════════
  // Fonte: kanban/plantao (ficha leve, só ADM). Tudo que um ADM faz com um bug passa por aqui: acompanhar, cadastrar PR + script de teste,
  // validar (✅/❌, máx. 3), marcar em produção (resolve o relato e avisa quem reportou), avisar quem reportou, pausar o plantão.
  const ESTADOS = { aguardando:['🟡','Aguardando'], em_analise:['🔵','Em análise'], pr_aberto:['🟣','PR aberta'], testando:['🧪','Pronto p/ testar'], reprovado:['❌','Reprovado'], validado:['✅','Validado'], em_prod:['🚀','Em produção'], duplicado:['♻️','Duplicado'], escalado:['🆘','Escalado ao Claude'], cancelado:['⛔','Cancelado'] };
  const PR_REGEX = /^https:\/\/github\.com\/caiosoares1899\/hering\/pull\/[0-9]+$/;
  const ORDEM = { testando: 0, pr_aberto: 1, validado: 2, reprovado: 3, escalado: 4, em_analise: 5, aguardando: 6, em_prod: 7, duplicado: 8, cancelado: 9 };
  const ENCERRADOS = ['em_prod', 'duplicado', 'cancelado'];
  const st = { fichas: {}, ativo: true, visto: 0, filtro: 'abertos', limite: 15, autores: {}, el: null, ligado: false, semPermissao: false };
  const E = (s) => cfg.esc(s);
  const souAdm = () => !!cfg.souAdm();
  const nomeQuem = () => { const u = cfg.user() || {}, p = cfg.perfil() || {}; return String(p.nome || u.displayName || u.email || 'ADM').slice(0, 120); };
  const val = (id) => { const e = document.getElementById(id); return e ? e.value.trim() : ''; };

  function injetarCss() {
    if (document.getElementById('mpl-css')) return;
    const s = document.createElement('style'); s.id = 'mpl-css';
    s.textContent = '.mpl{display:flex;flex-direction:column;gap:8px;font-size:12.5px;color:var(--txt,#e8f4ff);}'
      + '.mpl-head{display:flex;align-items:center;gap:6px;flex-wrap:wrap;}.mpl-head b{font-size:13px;}'
      + '.mpl-chip{display:inline-flex;align-items:center;gap:4px;padding:2px 9px;border-radius:99px;font-size:10.5px;border:1px solid var(--glass-b,rgba(255,255,255,.14));background:rgba(var(--ink-rgb,8,22,42),.4);color:var(--txt2,#a9c4dc);white-space:nowrap;}'
      + '.mpl-chip.ok{color:#6ef2a5;border-color:rgba(46,213,115,.4);}.mpl-chip.warn{color:#ffd166;border-color:rgba(255,209,102,.4);}.mpl-chip.bad{color:#ffb3b3;border-color:rgba(255,107,107,.4);}[data-theme="light"] .mpl-chip.ok{color:#0b6b3e;}[data-theme="light"] .mpl-chip.warn{color:#7a4f00;}[data-theme="light"] .mpl-chip.bad{color:#a11f2c;}'
      + '.mpl-btn{font:inherit;font-size:11px;padding:4px 10px;border-radius:8px;border:1px solid var(--glass-b,rgba(255,255,255,.18));background:rgba(var(--ink-rgb,8,22,42),.35);color:var(--txt,#e8f4ff);cursor:pointer;}.mpl-btn:hover{border-color:var(--accent,#38b6ff);}'
      + '.mpl-btn.ok{color:#6ef2a5;border-color:rgba(46,213,115,.5);}.mpl-btn.bad{color:#ffb3b3;border-color:rgba(255,107,107,.5);}.mpl-btn.pri{background:rgba(56,182,255,.18);border-color:rgba(56,182,255,.5);}'
      + '.mpl-card{border:1px solid var(--glass-b,rgba(255,255,255,.14));border-radius:11px;padding:9px 11px;background:rgba(var(--ink-rgb,8,22,42),.4);display:flex;flex-direction:column;gap:6px;}'
      + '.mpl-card.acao{border-color:rgba(56,182,255,.5);}.mpl-l1{display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:11px;color:var(--txt3,#7f9bb5);}'
      + '.mpl-txt{color:var(--txt,#e8f4ff);line-height:1.4;}.mpl-meta{font-size:11px;color:var(--txt3,#7f9bb5);display:flex;gap:10px;flex-wrap:wrap;}.mpl-meta a{color:var(--teal,#1de9b6);text-decoration:none;}'
      + '.mpl-in{width:100%;box-sizing:border-box;font:inherit;font-size:12px;padding:6px 8px;border-radius:8px;border:1px solid var(--glass-b,rgba(255,255,255,.18));background:rgba(var(--ink-rgb,8,22,42),.55);color:var(--txt,#e8f4ff);}'
      + '.mpl-ta{font-family:ui-monospace,Consolas,monospace;font-size:11.5px;min-height:70px;}.mpl-row{display:flex;gap:6px;flex-wrap:wrap;}'
      + '.mpl-nota{border-left:3px solid #ffd166;padding:4px 8px;font-size:11.5px;color:var(--txt2,#a9c4dc);}.mpl-det summary{cursor:pointer;font-size:11px;color:var(--txt3,#7f9bb5);}';
    document.head.appendChild(s);
  }

  async function gravarFicha(id, patch) { await window._update(window._ref(window._db, 'kanban/plantao/' + id), Object.assign({ atualizadoEm: Date.now() }, patch)); }

  async function obterAutor(id) {
    const f = st.fichas[id] || {};
    if (f.autorUid || f.autorNome) return { uid: f.autorUid || '', nome: f.autorNome || '' };
    if (st.autores[id]) return st.autores[id];
    try {
      const [u, n] = await Promise.all(['uid', 'autor'].map((c) => window._get(window._ref(window._db, 'kanban/feedback/' + id + '/' + c))));
      st.autores[id] = { uid: (u.exists() && u.val()) || '', nome: (n.exists() && n.val()) || '' };
    } catch (e) { st.autores[id] = { uid: '', nome: '' }; }
    return st.autores[id];
  }

  // Resolve/atualiza o relato do autor: status + resposta no kanban/feedback (só esses campos), aviso no sino do autor e card da squad Dados.
  async function marcarStatus(bugId, novoStatus, msg) {
    const snap = await window._get(window._ref(window._db, 'kanban/feedback/' + bugId));
    if (!snap.exists()) { cfg.toast('⚠️ O relato deste bug não existe mais no Firebase.'); return false; }
    const b = Object.assign({ id: bugId }, snap.val());
    const padrao = novoStatus === 'resolvido' ? 'Correção aplicada! Atualize a página com Ctrl+F5 para carregar a versão mais recente.' : 'Seu relato já está sendo analisado.';
    const resposta = String(msg || '').trim() || padrao;
    const ts = Date.now(), quem = nomeQuem();
    const cardId = cardIdBug(b.kanbanCardId || bugId);
    await window._update(window._ref(window._db, 'kanban/feedback/' + bugId), { status: novoStatus, respostaStatus: resposta, atualizadoEm: ts, atualizadoPor: quem, kanbanCardId: cardId, kanbanSquad: 'dados' });
    Object.assign(b, { status: novoStatus, respostaStatus: resposta, atualizadoEm: ts, atualizadoPor: quem, kanbanCardId: cardId, kanbanSquad: 'dados' });
    await dispararNotifStatus(b, bugId, novoStatus, resposta, quem, ts, 'nf_bug_' + bugId + '_' + novoStatus);
    await sincronizarCard(b, novoStatus);
    return true;
  }

  // Comentário no card da Squad Dados com o resumo da correção (PR, o que mudou, quem validou e o que foi visto). Id fixo por bug: validar de novo atualiza o mesmo comentário.
  async function comentarCorrecao(bugId, f, quem, nota) {
    try {
      const fbBase = 'kanban/squads/dados/dados';
      const cardId = cardIdBug(f.cardId || bugId);
      const prNum = f.prUrl ? (/\/pull\/(\d+)$/.exec(f.prUrl) || [])[1] : '';
      const ts = new Date().toISOString();
      const linhas = ['🛠️ **Correção validada em dev** — por **' + quem + '**'];
      if (f.prUrl) linhas.push('• **PR:** ' + (prNum ? '#' + prNum + ' ' : '') + (f.prTitulo ? '— ' + f.prTitulo + ' ' : '') + '(' + f.prUrl + ')');
      if (f.prResumo) linhas.push('• **O que mudou:** ' + f.prResumo);
      if (nota) linhas.push('• **O que o ADM viu:** ' + nota);
      linhas.push('• **Teste:** script de console rodado no dev, resultado ✅');
      const cm = { id: 'cm_ferias_correcao_' + String(bugId).replace(/[^0-9A-Za-z_]/g, ''), uid: (cfg.user() && cfg.user().uid) || 'assistente_ferias', author: '🏖️ Assistente Férias (' + quem + ')', init: '🤖', foto: '', text: linhas.join('\n'), ts };
      await window._set(window._ref(window._db, fbBase + '/card_comments/' + cardId + '/' + cm.id), cm);
      const all = await window._get(window._ref(window._db, fbBase + '/card_comments/' + cardId));
      await window._set(window._ref(window._db, fbBase + '/card_comments_count/' + cardId), (all.exists() && all.val() && typeof all.val() === 'object') ? Object.keys(all.val()).length : 1);
      return true;
    } catch (e) { return false; }
  }

  async function acao(id, a) {
    if (!souAdm()) { cfg.toast('⚠️ Só ADM mexe no plantão.'); return; }
    const f = st.fichas[id];
    if (!f) { cfg.toast('⚠️ Este bug não tem ficha do plantão.'); return; }
    const pr = val('mpl-pr-' + id), sc = val('mpl-sc-' + id), nt = val('mpl-nt-' + id), msg = val('mpl-msg-' + id);
    const u = cfg.user() || {};
    try {
      if (a === 'copiar') { const t = sc || f.scriptTeste || ''; if (!t) { cfg.toast('⚠️ Ainda não há script para copiar.'); return; } try { await navigator.clipboard.writeText(t); cfg.toast('📋 Script copiado — cole no console (F12) da página de DEV.'); } catch (e) { cfg.toast('⚠️ Não consegui copiar; selecione o texto e use Ctrl+C.'); } return; }
      if (a === 'pacote') { const t = montarPacote({ arquivoAlvo: f.arquivoAlvo, app: f.app || (/oceano/.test(f.arquivoAlvo || '') ? 'Oceano' : 'Maré Digital'), impacto: f.impacto, texto: f.resumo }); try { await navigator.clipboard.writeText(t); cfg.toast('📋 Pacote anônimo copiado (modo manual).'); } catch (e) { cfg.toast('⚠️ Não consegui copiar.'); } return; }
      if (a === 'salvar') {
        if (pr && !PR_REGEX.test(pr)) { cfg.toast('⚠️ O link precisa ser de um PR deste repositório (https://github.com/caiosoares1899/hering/pull/NÚMERO).'); return; }
        if (!pr && !sc) { cfg.toast('⚠️ Cole o link do PR e/ou o script de teste.'); return; }
        const patch = {}; if (pr) patch.prUrl = pr; if (sc) patch.scriptTeste = sc.slice(0, 20000);
        const temPr = pr || f.prUrl, temSc = sc || f.scriptTeste;
        if (['aguardando', 'em_analise', 'reprovado', 'pr_aberto', 'escalado'].includes(f.estado)) patch.estado = temPr && temSc ? 'testando' : temPr ? 'pr_aberto' : 'em_analise';
        if (f.estado === 'reprovado') ['resultadoTeste', 'notaTeste', 'validadoPor', 'validadoPorUid', 'validadoEm'].forEach((c) => { patch[c] = null; });
        await gravarFicha(id, patch); cfg.toast('💾 Salvo.'); return;
      }
      if (a === 'validei') {
        const autor = await obterAutor(id);
        if (autor.uid && u.uid && autor.uid === u.uid) { cfg.toast('⚠️ Quem reportou o bug não valida o próprio conserto — peça a outro ADM.'); return; }
        if (!f.prUrl || !PR_REGEX.test(f.prUrl) || !f.scriptTeste || f.scriptTeste.length < 20) { cfg.toast('⚠️ Sem PR e sem script de teste SALVOS não dá para validar. Cole os dois e clique em 💾 Salvar.'); return; }
        if (!['testando', 'pr_aberto'].includes(f.estado)) { cfg.toast('⚠️ Este bug não está pronto para validar (estado: ' + ((ESTADOS[f.estado] || [])[1] || f.estado) + ').'); return; }
        await gravarFicha(id, { estado: 'validado', resultadoTeste: 'ok', notaTeste: nt.slice(0, 500) || null, validadoPor: nomeQuem(), validadoPorUid: u.uid, validadoEm: Date.now() });
        const noCard = await comentarCorrecao(id, f, nomeQuem(), nt.slice(0, 500));
        cfg.toast('✅ Validado' + (noCard ? ' e resumo da correção comentado no card' : ' (não consegui comentar no card — veja o card manualmente)') + '. Agora o PR de PROD (promover.js) e, depois do merge, 🚀.'); return;
      }
      if (a === 'reprovei') {
        if (nt.length < 5) { cfg.toast('⚠️ Escreva em "O que você viu" o que falhou — o Antigravity precisa disso para tentar de novo.'); return; }
        const tent = (Number(f.tentativas) || 0) + 1;
        await gravarFicha(id, { estado: tent >= 3 ? 'escalado' : 'reprovado', tentativas: Math.min(tent, 3), resultadoTeste: 'falhou', notaTeste: nt.slice(0, 500), validadoPor: nomeQuem(), validadoPorUid: u.uid, validadoEm: Date.now() });
        cfg.toast(tent >= 3 ? '🆘 3ª reprovação: escalado ao Claude.' : '❌ Reprovado (' + tent + '/3). O Antigravity recebe a nota na próxima busca.'); return;
      }
      if (a === 'prod') {
        if (f.estado !== 'validado') { cfg.toast('⚠️ Só vai para produção o que está validado.'); return; }
        await gravarFicha(id, { estado: 'em_prod' });
        if (await marcarStatus(id, 'resolvido', msg)) cfg.toast('🚀 Resolvido: quem reportou foi avisado no sino e o card da Squad Dados foi atualizado.');
        return;
      }
      if (a === 'tratando') { if (await marcarStatus(id, 'em_analise', msg)) cfg.toast('🔵 Quem reportou foi avisado: "sendo tratado".'); return; }
    } catch (e) { cfg.toast('⚠️ Não consegui gravar no Firebase (sem permissão de ADM ou sem rede).'); }
  }

  async function pausar() {
    if (!souAdm()) return;
    try { await window._set(window._ref(window._db, 'kanban/config/plantao_ativo'), st.ativo ? false : null); cfg.toast(st.ativo ? '⏸ Plantão pausado (sem avisos novos).' : '▶ Plantão retomado.'); } catch (e) { cfg.toast('⚠️ Não consegui alterar o plantão.'); }
  }

  function fichaHtml(id, f, rasc) {
    const meta = ESTADOS[f.estado] || ['•', f.estado || '?'];
    const rv = (k, padrao) => (Object.prototype.hasOwnProperty.call(rasc, k) ? rasc[k] : (padrao || ''));
    const encerrado = ['validado', 'em_prod', 'duplicado', 'cancelado'].includes(f.estado);
    const precisaAcao = ['testando', 'pr_aberto', 'validado', 'reprovado'].includes(f.estado) || f.estado === 'escalado';
    const autor = f.autorNome || (st.autores[id] && st.autores[id].nome) || '';
    const tent = Number(f.tentativas) || 0;
    const prNum = f.prUrl ? (/\/pull\/(\d+)$/.exec(f.prUrl) || [])[1] : '';
    const aviso = f.estado === 'duplicado' ? '<div class="mpl-nota">♻️ Parece repetido de <code>' + E(f.duplicadoDe || '?') + '</code> — resolva aquele.</div>'
      : f.estado === 'escalado' ? '<div class="mpl-nota">🆘 3 reprovações: leve para o Claude. O conserto dele também passa por validação de ADM (cole o PR e o script aqui).</div>' : '';
    const nota = f.notaTeste ? '<div class="mpl-nota"><b>📝 Última nota' + (f.validadoPor ? ' (' + E(f.validadoPor) + ')' : '') + ':</b> ' + E(f.notaTeste) + '</div>' : '';
    const form = encerrado ? '' : (
      '<input class="mpl-in" id="mpl-pr-' + E(id) + '" maxlength="120" value="' + E(rv('mpl-pr-' + id, f.prUrl)) + '" placeholder="Link do PR de dev (preenchido sozinho quando o Antigravity abre a PR)">'
      + '<textarea class="mpl-in mpl-ta" id="mpl-sc-' + E(id) + '" maxlength="20000" placeholder="Script de teste (console) — vem sozinho do corpo da PR; sem ele não dá para validar">' + E(rv('mpl-sc-' + id, f.scriptTeste)) + '</textarea>'
      + '<input class="mpl-in" id="mpl-nt-' + E(id) + '" maxlength="500" value="' + E(rv('mpl-nt-' + id, '')) + '" placeholder="O que você viu ao rodar o script (obrigatório para reprovar)">'
      + '<div class="mpl-row">'
      +   '<button class="mpl-btn" data-mpl="salvar" data-id="' + E(id) + '">💾 Salvar</button>'
      +   '<button class="mpl-btn" data-mpl="copiar" data-id="' + E(id) + '">📋 Copiar script</button>'
      +   '<button class="mpl-btn ok" data-mpl="validei" data-id="' + E(id) + '">✅ Rodei o script e validei</button>'
      +   '<button class="mpl-btn bad" data-mpl="reprovei" data-id="' + E(id) + '">❌ Reprovei</button>'
      + '</div>');
    return '<article class="mpl-card' + (precisaAcao ? ' acao' : '') + '" data-id="' + E(id) + '">'
      + '<div class="mpl-l1"><span class="mpl-chip">' + meta[0] + ' ' + E(meta[1]) + '</span>'
      +   '<span class="mpl-chip">' + E(f.impacto || '') + '</span><span class="mpl-chip">' + E(f.arquivoAlvo || '') + '</span>'
      +   '<span>tentativas ' + tent + '/3</span><span style="margin-left:auto;">' + E(cfg.tempoRel(f.criadoEm ? new Date(f.criadoEm).toISOString() : '')) + '</span></div>'
      + '<div class="mpl-txt">' + E(f.resumo || '(sem descrição)') + '</div>'
      + '<div class="mpl-meta">' + (autor ? '<span>por <b>' + E(autor) + '</b></span>' : '')
      +   '<a href="' + E(urlCardSquadDados({ kanbanCardId: f.cardId, id: id })) + '" target="_blank" rel="noopener noreferrer">📋 Card na Squad Dados</a>'
      +   (f.prUrl ? '<a href="' + E(f.prUrl) + '" target="_blank" rel="noopener noreferrer">🔀 PR #' + E(prNum) + '</a>' : '')
      +   (f.scriptTeste ? '<span>🧪 script salvo</span>' : '') + '<a href="#" data-mpl="pacote" data-id="' + E(id) + '">copiar pacote (modo manual)</a></div>'
      + aviso + nota + form
      + (f.estado === 'validado' ? '<div class="mpl-row"><button class="mpl-btn pri" data-mpl="prod" data-id="' + E(id) + '">🚀 PR de prod mergeado — marcar Resolvido e avisar quem reportou</button></div>' : '')
      + (encerrado && f.estado !== 'validado' ? '' : '<details class="mpl-det"><summary>✉️ Avisar quem reportou</summary><div class="mpl-row" style="margin-top:6px;"><input class="mpl-in" id="mpl-msg-' + E(id) + '" maxlength="280" value="' + E(rv('mpl-msg-' + id, '')) + '" placeholder="Mensagem (opcional)" style="flex:1;min-width:180px;"><button class="mpl-btn" data-mpl="tratando" data-id="' + E(id) + '">🔵 Sendo tratado</button></div></details>')
      + '</article>';
  }

  function render() {
    const el = st.el; if (!el) return;
    if (!souAdm()) { el.innerHTML = ''; return; }
    const rasc = {}; let focoId = '', ini = null, fim = null;
    el.querySelectorAll('[id^="mpl-"]').forEach((i) => { rasc[i.id] = i.value; if (i === document.activeElement) { focoId = i.id; try { ini = i.selectionStart; fim = i.selectionEnd; } catch (e) {} } });
    if (st.semPermissao) { el.innerHTML = '<div class="mpl"><div class="mpl-nota">🔒 Sem permissão para ler o plantão. As regras exigem o papel <b>adm</b> no cadastro (ADM só por e-mail não basta) — ajuste em Usuários.</div></div>'; return; }
    const todos = Object.entries(st.fichas).filter(([, f]) => f && typeof f === 'object');
    const cont = {}; todos.forEach(([, f]) => { cont[f.estado] = (cont[f.estado] || 0) + 1; });
    const abertos = todos.filter(([, f]) => !ENCERRADOS.includes(f.estado));
    const lista = (st.filtro === 'todos' ? todos : st.filtro === 'encerrados' ? todos.filter(([, f]) => ENCERRADOS.includes(f.estado)) : abertos)
      .sort(([, a], [, b]) => (ORDEM[a.estado] - ORDEM[b.estado]) || ((b.criadoEm || 0) - (a.criadoEm || 0)));
    const agora = Date.now(), visto = st.visto ? Math.max(0, Math.round((agora - st.visto) / 60000)) : null;
    const agente = visto == null ? '<span class="mpl-chip">🤖 modo automático ainda não usado</span>' : '<span class="mpl-chip ' + (visto > 120 ? 'bad' : 'ok') + '" title="O Antigravity busca os bugs sozinho (tarefa agendada). Se parar, os ADMs são avisados.">🤖 Antigravity buscou ' + (visto < 1 ? 'agora' : visto < 60 ? 'há ' + visto + ' min' : 'há ' + Math.round(visto / 60) + ' h') + '</span>';
    const filtroBtn = (k, t) => '<button class="mpl-btn' + (st.filtro === k ? ' pri' : '') + '" data-mpl="filtro" data-id="' + k + '">' + t + '</button>';
    let h = '<div class="mpl"><div class="mpl-head"><b>🛟 Plantão de Bugs</b>'
      + '<span class="mpl-chip ' + (st.ativo ? 'ok' : 'warn') + '">' + (st.ativo ? 'ligado' : '⏸ pausado') + '</span>' + agente
      + (cont.testando ? '<span class="mpl-chip warn">🧪 ' + cont.testando + ' p/ testar</span>' : '') + (cont.validado ? '<span class="mpl-chip ok">✅ ' + cont.validado + ' validado(s)</span>' : '')
      + ((cont.escalado || 0) + (cont.reprovado || 0) ? '<span class="mpl-chip bad">❌ ' + ((cont.escalado || 0) + (cont.reprovado || 0)) + ' com problema</span>' : '')
      + '<span style="margin-left:auto;display:flex;gap:4px;">' + filtroBtn('abertos', 'Abertos (' + abertos.length + ')') + filtroBtn('encerrados', 'Encerrados') + filtroBtn('todos', 'Todos') + '<button class="mpl-btn" data-mpl="pausa">' + (st.ativo ? '⏸ Pausar' : '▶ Retomar') + '</button></span></div>';
    h += lista.length ? lista.slice(0, st.limite).map(([id, f]) => fichaHtml(id, f, rasc)).join('') : '<div class="mpl-nota" style="border-color:rgba(46,213,115,.4);">Nenhum bug nesta lista. 🎉</div>';
    if (lista.length > st.limite) h += '<div><button class="mpl-btn" data-mpl="mais" data-id="x">Ver mais (' + (lista.length - st.limite) + ')</button></div>';
    el.innerHTML = h + '</div>';
    lista.slice(0, st.limite).forEach(([id, f]) => { if (!f.autorNome && !st.autores[id]) obterAutor(id).then(() => render()); });
    if (focoId) { const n = document.getElementById(focoId); if (n) { try { n.focus({ preventScroll: true }); if (ini != null) n.setSelectionRange(ini, fim); } catch (e) {} } }
  }

  function onClick(e) {
    const b = e.target.closest('[data-mpl]'); if (!b) return;
    const a = b.dataset.mpl, id = b.dataset.id;
    if (a === 'pacote') e.preventDefault();
    if (a === 'filtro') { st.filtro = id; st.limite = 15; render(); return; }
    if (a === 'mais') { st.limite += 15; render(); return; }
    if (a === 'pausa') { pausar(); return; }
    acao(id, a);
  }

  function iniciar(el) {
    if (!el) return;
    st.el = el;
    if (!souAdm()) { el.innerHTML = ''; return; }
    if (st.ligado) { render(); return; }
    if (!window._onValue || !window._ref || !window._db) return;
    st.ligado = true; injetarCss(); el.addEventListener('click', onClick);
    const ouvir = (path, fn) => { try { window._onValue(window._ref(window._db, path), fn, () => { if (path === 'kanban/plantao') { st.semPermissao = true; render(); } }); } catch (e) {} };
    ouvir('kanban/plantao', (sn) => { st.fichas = sn && sn.exists() ? sn.val() : {}; st.semPermissao = false; render(); });
    ouvir('kanban/config/plantao_ativo', (sn) => { st.ativo = !(sn && sn.exists() && sn.val() === false); render(); });
    ouvir('kanban/plantao_status/agenteVistoEm', (sn) => { st.visto = sn && sn.exists() ? Number(sn.val()) || 0 : 0; render(); });
    render();
  }

  window.MarePlantao = {
    init, cardIdBug: feriasCardIdBug, urlCardSquadDados: feriasUrlCardSquadDados, sincronizarCard: feriasSincronizarCardSquadDados, dispararNotifStatus: feriasDispararNotifStatusBug,
    sanitizar: feriasSanitizarTexto, montarPacote: feriasMontarPacoteAnonimo, ESTADOS, PR_REGEX,
    admin: { iniciar, render, marcarStatus, acao },
  };
})();
