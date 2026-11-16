// Só leitura: executa as funções reais em iframe isolado, com banco inteiramente falso.
(async () => {
  const fonte = await (await fetch('kanban-dev.html', {cache:'no-store'})).text();
  const trecho = (inicio, fim) => {
    const inicioTrechoAuditoria = fonte.indexOf(inicio), fimTrechoAuditoria = fonte.indexOf(fim, inicioTrechoAuditoria + inicio.length);
    if(inicioTrechoAuditoria < 0 || fimTrechoAuditoria < 0) throw new Error('Âncora ausente: '+inicio);
    return fonte.slice(inicioTrechoAuditoria,fimTrechoAuditoria);
  };
  const linhas = [];
  const executar = async (nome, codigo, teste) => {
    const frame = document.createElement('iframe'); frame.hidden=true; document.body.appendChild(frame);
    try {
      const w=frame.contentWindow;
      w.eval(codigo);
      const detalhe=await w.eval('('+teste.toString()+')()');
      linhas.push({teste:nome,resultado:detalhe.ok?'✅':'❌',detalhe:detalhe.texto});
    } catch(e) { linhas.push({teste:nome,resultado:'❌',detalhe:e.message}); }
    finally { frame.remove(); }
  };
  await executar('Salvar preserva o ocupante de posição realocada', `
    var cards=[], FB='banco-falso', _lastLocalSave=0, _hasLocalSession=false;
    var ocupante={id:'outro',title:'Preservar'}, atualizacoes=[];
    window._fbReady=true; window._cardsByKey={'0':{id:'editado'}};
    function _recusaSeDesatualizado(){return null} function _settleCardTimeTrackingLazy(){}
    function fb(p){return p} function _trackFbWrite(p){return p}
    function _stripUndefinedDeep(x){return x} function _stripUndefinedMultiPath(x){return x}
    function _marcaBaseCard(){} function showToast(){} function renderBoard(){}
    window._runTransaction=async function(p,fn){var v=fn(ocupante);if(v!==undefined)ocupante=v;return {committed:v!==undefined}};
    window._update=async function(p,v){atualizacoes.push(v);if(v['cards/0'])ocupante=v['cards/0']};
  `+trecho(' function fbSaveCard(card){','// Wrapper de fbSaveCard()'), async function(){
    const c={id:'editado',title:'Edição local',__base:{id:'editado',title:'Anterior'}};
    try { await fbSaveCard(c); } catch(e) { /* recusar é seguro */ }
    return {ok:ocupante.id==='outro',texto:'Ocupante final: '+ocupante.id+'; esperado: outro'};
  });
  await executar('Autosave de coluna registra movimentação', `
    var editingId='teste', _modalOpenCol='todo', _modalOpenOwner='',_modalOpenTags='[]';
    var editingTags=[],_mNoDue=true,_mCurrentGroups=[],_cardManualSnap=null,_CARD_DATAS=[];
    var SUBMARCA_TAGS=[],CANAL_VENDA_TAGS=[],chamadasFluxo=0;
    var cards=[{id:'teste',title:'Teste',col:'todo',tags:[],checklist:[],flow:{log:[],enteredAt:{todo:'2026-11-01'}}}];
    var campos={'m-title':'Teste','m-col':'done','m-owner':'','m-desc':''};
    document.getElementById=function(id){return {value:campos[id]||''}};
    document.querySelector=function(){return null};
    function getCL(){return []} function getRiscos(){return []} function getParticipants(){return []}
    function getCriativoData(){return {}} function _cleanExtraDescs(){return []} function _cardDatasToSave(){return {}}
    function _histSnapshot(){return {}} function _histDiff(){} function renderBoard(){}
    function _saveCardWithRetry(){return Promise.resolve()} function _crvPropagateToChildren(){}
    function parseMentions(){} function notifAssigned(){} function runAutoRules(){}
    function _reagirSeAgenteAgilAtribuido(){} function notifUnblocked(){} function _settleBlockedTag(){}
    function _isColDone(c){return c==='done'} function notifDone(){} function notifMoved(){}
    function notifRisk(){} function notifChecklistDone(){} function recordMove(){chamadasFluxo++}
  `+trecho('function _performAutoSave(){','// ── FIM AUTO-SAVE'), async function(){
    _performAutoSave(); await Promise.resolve();
    return {ok:cards[0].col==='done'&&chamadasFluxo===1,texto:'Coluna: '+cards[0].col+'; chamadas recordMove: '+chamadasFluxo+'; esperado: 1'};
  });
  await executar('Notificação lida não reabre entre abas de PO/ADM', `
    var ACTIVE_SQUAD='ficticio',_recentNotifs=new Map(),pendentes=[],notificacao=null,gravacoes=0;
    window._fbReady=true; window._db={}; window._ref=function(db,p){return p};
    function fbGet(){return new Promise(r=>pendentes.push(r))}
    window._set=async function(p,v){notificacao=JSON.parse(JSON.stringify(v));gravacoes++};
  `+trecho('function createNotif(targetUid,','// Resolve uid de um membro'), async function(){
    createNotif('destino-ficticio','mention','Teste','', 'card-ficticio','id-fixo');
    _recentNotifs.clear(); // simula outra aba, com dedupe local independente
    createNotif('destino-ficticio','mention','Teste','', 'card-ficticio','id-fixo');
    const vazio={exists:()=>false};
    pendentes[0](vazio); await Promise.resolve(); await Promise.resolve();
    notificacao.read=true; // pessoa lê após a primeira gravação
    pendentes[1](vazio); await Promise.resolve(); await Promise.resolve();
    return {ok:notificacao.read===true&&gravacoes===1,texto:'Gravações: '+gravacoes+'; lida ao final: '+notificacao.read+'; esperado: 1 e true'};
  });
  window._resultadosTeste=linhas; console.table(linhas); return linhas;
})();
