/* ══════════════════════════════════════════════════════════════════════════
   mare-timer-dev.js — ⏲ TIMER (lógica compartilhada, 10/11/2026)
   Carregado por kanban-dev (Maré) e oceano-dev (Ilha Dinâmica); a versão de produção, mare-timer.js, nasce na promoção.
   Mesmo ciclo dev→prod dos outros módulos (?v=N nas páginas; bump em todas ao mudar).

   O QUE MORA AQUI: as contas e a gravação de play/pausa/encerrar, saídas do Maré sem mudar comportamento, para a Ilha Dinâmica
   gravar EXATAMENTE como o Maré grava (uma função só, um contrato só). A tela (formulário, lista, popup) continua no Maré.
   Dados: registro completo em kanban/squads/{sq}/dados/card_timers/{cardId}/{tid} (dentro do squad, entra no backup) +
   índice pessoal dos ativos em kanban/timers_ativos/{uid}/{tid} (só o dono lê). Tempo = accMs + (agora − startedAt) enquanto rodando.
   Regra de quem controla: só quem RECEBEU a atividade (t.uid === eu) dá play/pausa/encerra — conferida aqui e também nas regras do banco.

   Correção ao extrair (10/11/2026): o play gravava `iniciadoEm` sempre que o objeto não o trazia. O índice NÃO guarda `iniciadoEm`,
   então continuar um timer pausado a partir do índice (popup "⏲ Timers" com o card fechado; Ilha Dinâmica) sobrescrevia a hora de início
   real com a hora atual. Agora `iniciadoEm` só é gravado quando o timer sai de 'novo' (o 1º play).
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  if(window.MareTimer) return;
  const RAIZ = 'kanban/timers_ativos';
  const decorrido = (t, agora) => Math.max(0, (+t.accMs||0) + ((t.status==='rodando' && t.startedAt) ? (agora - t.startedAt) : 0));
  function fmt(ms){ const s = Math.max(0, Math.floor(ms/1000)), h = Math.floor(s/3600), m = Math.floor(s%3600/60), p = n => String(n).padStart(2,'0'); return h ? h+':'+p(m)+':'+p(s%60) : p(m)+':'+p(s%60); }
  // Cronômetro mostra o decorrido; timer (com durMs) mostra o que falta e, passando de zero, o excedente com "+".
  function mostra(t, agora){ const d = decorrido(t, agora); if(t.tipo==='timer' && t.durMs){ const r = t.durMs - d; return r>=0 ? {txt:fmt(r), esg:false} : {txt:'+'+fmt(-r), esg:true}; } return {txt:fmt(d), esg:false}; }
  const estadoTxt = t => ({novo:'aguardando início', rodando:'em andamento', pausado:'pausado', encerrado:'encerrado'}[t.status] || t.status);
  // O que o índice pessoal guarda de cada timer ativo.
  const idx = t => ({sq:t.sq, cardId:t.cardId, cardTitle:t.cardTitle||'', atividade:t.atividade, tipo:t.tipo, status:t.status, startedAt:t.startedAt||null, accMs:t.accMs||0, durMs:t.durMs||null, porUid:t.porUid||''});
  // Entrada do índice → objeto de timer completo o bastante para patch/escrever (o índice não guarda id nem uid: vêm do caminho).
  const doIndice = (uid, tid, v) => Object.assign({}, v||{}, {id:String(tid), uid:String(uid)});
  function patch(t, acao, agora){
    const dec = decorrido(t, agora);
    if(acao==='play' && (t.status==='novo' || t.status==='pausado')){
      const p = {status:'rodando', startedAt:agora, accMs:t.accMs||0};
      if(t.status==='novo') p.iniciadoEm = new Date(agora).toISOString();   // só no 1º play (ver o cabeçalho)
      return p;
    }
    if(acao==='pause' && t.status==='rodando') return {status:'pausado', startedAt:null, accMs:dec};
    if(acao==='stop' && t.status!=='encerrado') return {status:'encerrado', startedAt:null, accMs:dec, encerradoEm:new Date(agora).toISOString()};
    return null;
  }
  // Registro (por campo, não sobrescreve descrição editada por outro) + índice do dono, num update só.
  function caminhos(t, p, opts){
    const base = 'kanban/squads/'+t.sq+'/dados/card_timers/'+t.cardId+'/'+t.id, ix = RAIZ+'/'+t.uid+'/'+t.id, upd = {};
    Object.keys(p).forEach(k=>{ if(p[k]!==undefined) upd[base+'/'+k] = p[k]; });
    const novo = Object.assign({}, t, p);
    if(novo.status==='encerrado') upd[ix] = null;
    else if(opts && opts.criar) upd[ix] = idx(novo);
    else ['status','startedAt','accMs','atividade','durMs','tipo'].forEach(k=>{ if(k in p) upd[ix+'/'+k] = p[k]; });
    return upd;
  }
  const escrever = (t, p, opts) => window._update(window._ref(window._db), caminhos(t, p, opts));
  // Ação completa (o que o Maré e a Ilha chamam). Devolve {ok, patch} ou {ok:false, erro}. A notificação a quem criou o timer
  // fica com a página (cada uma tem seu escritor de notificação): `notificar(dados)` recebe tipo, título, texto, card e squad.
  async function acao(t, ac, o){
    o = o || {};
    if(!t || !o.uid) return {ok:false, erro:'sem_timer'};
    if(t.uid !== o.uid) return {ok:false, erro:'nao_e_seu', msg:'Só quem recebeu a atividade controla o timer.'};
    const p = patch(t, ac, o.agora || Date.now()); if(!p) return {ok:false, erro:'nada_a_fazer'};
    try{ await escrever(t, p); }catch(e){ console.warn('[timer]', e); return {ok:false, erro:'gravacao', msg:'Não foi possível atualizar o timer.'}; }
    if(ac==='stop' && t.porUid && t.porUid!==t.uid && typeof o.notificar==='function'){
      try{ o.notificar({uid:t.porUid, tipo:'timer_encerrado', titulo:(o.nome||'Alguém')+' encerrou "'+t.atividade+'"', texto:'Tempo registrado: '+fmt(p.accMs), cardId:t.cardId, squad:t.sq, tid:t.id}); }catch(e){}
    }
    return {ok:true, patch:p};
  }
  window.MareTimer = {RAIZ, decorrido, fmt, mostra, estadoTxt, idx, doIndice, patch, caminhos, escrever, acao};
})();
