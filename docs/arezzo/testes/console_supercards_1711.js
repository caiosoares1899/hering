// Read-only: funções reais em iframe isolado; persistência substituída por memória.
(async()=>{
 const fonte=await (await fetch('kanban-dev.html',{cache:'no-store'})).text();
 const extrair=(inicio,fim)=>{const iniAud=fonte.indexOf(inicio),fimAud=fonte.indexOf(fim,iniAud+inicio.length);if(iniAud<0||fimAud<0)throw Error('Âncora ausente: '+inicio);return fonte.slice(iniAud,fimAud)};
 const funcoes=[
  extrair('function _cardIsSuperChild(', '// Altura da árvore'),
  extrair('function _blankSuperChildCard(', '// Atalho pra fluxo'),
  extrair('function _superParentBasics(', 'function toggleSuperChildSearch('),
  extrair(fonte.includes('function _superPodeGerarFilhos(')?'function _superPodeGerarFilhos(':'function _applyFanoutTemplate(', '// Fonte única da regra'),
  extrair('function applyFanoutToCurrentCard(', "document.addEventListener('click', e=>{"),
  extrair('function _splitSuperChildIds(', '// Card (objeto completo)'),
  fonte.match(/^function esc\(.*$/m)[0],fonte.match(/^function jsq\(.*$/m)[0],
  extrair('function _renderFanoutApplyList(', 'function applyFanoutToCurrentCard('),
  extrair('function renderSuperChildrenList(', '// Campos "herdáveis"'),
 ];
 const acao=extrair("{ key:'apply_fanout',",'\n];').trim().replace(/,$/,'');
 const linhas=[];
 const testar=async(nome,preparar,verificar)=>{
  const quadro=document.createElement('iframe');quadro.hidden=true;document.body.appendChild(quadro);
  try{
   const w=quadro.contentWindow;
   w.eval(`var cards=[],gravados=[],avisos=[],editingId=null,editingSuperParent=null,editingSuperParentIsChild=false;
    var editingSuperChildren=[],editingSuperArchivedIds=[],_newSuperChildIds=[],_editingQLItem=null;
    var columns=[{id:'todo'}],qlItems={modelos:[]},fanoutTemplates={r:{nome:'Receita teste',filhos:[{sufixo:'A'},{sufixo:'B'}]}};
    function showToast(t){avisos.push(t)} function checkEditPermission(){return true}
    function _histWho(){return 'Pessoa fictícia'} function recordHistory(){} function recordMove(){}
    function fbCreateCard(c){gravados.push(c.id);return Promise.resolve()}
    function fbSaveCard(){return Promise.resolve()} function _crvPropagateToChildren(){}
    function _crvUpdateFichaSecVisibility(){} function renderSuperChildrenList(){} function renderBoard(){} function aplicarModeloNoCard(){}
    function _mergeModeloEmCardObj(c){c.modeloAplicado=true}
   `);
   funcoes.forEach(codigo=>w.eval(codigo));w.eval('var acaoAuditoria='+acao);
   w.eval('('+preparar.toString()+')()');
   const r=await w.eval('('+verificar.toString()+')()');
   linhas.push({teste:nome,resultado:r.ok?'✅':'❌',detalhe:r.detalhe});
  }catch(e){linhas.push({teste:nome,resultado:'❌',detalhe:e.message})}finally{quadro.remove()}
 };
 await testar('Campanha: receita cria dois filhos',()=>{cards=[{id:'pai',title:'Campanha',col:'todo'}]},()=>{
  const ids=_applyFanoutTemplate(cards[0],fanoutTemplates.r);
  return {ok:ids.length===2&&gravados.length===2&&cards[0].childCardIds.length===2,detalhe:ids.length+' filhos'};
 });
 await testar('Criativo: automação permite versões',()=>{cards=[{id:'campanha',childCardIds:['criativo']},{id:'criativo',title:'Peça',col:'todo'}]},()=>{
  const r=acaoAuditoria.run({actionVal:'r'},cards[1]);
  return {ok:r===true&&gravados.length===2,detalhe:gravados.length+' versões'};
 });
 await testar('Versão: automação não cria quarta camada',()=>{
  cards=[{id:'campanha',childCardIds:['criativo']},{id:'criativo',childCardIds:['versao']},{id:'versao',title:'Versão',col:'todo'}];
  fanoutTemplates.r.paiModeloIdx=0;qlItems.modelos=[{title:'Modelo'}];
 },()=>{
  const r=acaoAuditoria.run({actionVal:'r'},cards[2]);
  return {ok:r===false&&gravados.length===0&&!cards[2].modeloAplicado,detalhe:gravados.length+' filhos; retorno '+r};
 });
 await testar('Modelo em edição: receita não cria órfãos',()=>{
  cards=[{id:'temporario',title:'Modelo',col:'todo',_isQLTemp:true}];
  editingId='temporario';_editingQLItem={tipo:'modelos',idx:0};
 },()=>{
  applyFanoutToCurrentCard('r');
  return {ok:gravados.length===0&&!cards[0].childCardIds?.length,detalhe:gravados.length+' cards reais criados'};
 });
 await testar('Molde: chamada direta não cria órfãos',()=>{cards=[{id:'temporario',title:'Modelo',col:'todo',_isQLTemp:true}]},()=>{
  const ids=_applyFanoutTemplate(cards[0],fanoutTemplates.r);
  return {ok:ids.length===0&&gravados.length===0,detalhe:gravados.length+' cards reais criados'};
 });
 await testar('Ancestral arquivado não bloqueia versões',()=>{
  cards=[{id:'campanha',archived:true,childCardIds:['criativo']},{id:'criativo',childCardIds:['versao']},{id:'versao',title:'Versão',col:'todo'}];
 },()=>{
  const r=acaoAuditoria.run({actionVal:'r'},cards[2]);
  return {ok:r===true&&gravados.length===2,detalhe:gravados.length+' filhos com só um ancestral ativo'};
 });
 await testar('Filhos arquivados preservados separadamente',()=>{cards=[{id:'ativo',title:'Ativo',col:'todo'},{id:'arquivo',archived:true}]},()=>{
  const r=_splitSuperChildIds(['ativo','arquivo']);
  return {ok:r.ativos[0]?.id==='ativo'&&r.arquivadosIds[0]==='arquivo',detalhe:r.ativos.length+' ativo e '+r.arquivadosIds.length+' arquivado'};
 });
 for(const modo of ['receita','abrir filho','remover filho']){
  await testar('ID do banco seguro ao '+modo,()=>{
   var idHostil="x');xssSuper=1;('";
   window.xssSuper=0;window.idHostilAuditoria=idHostil;
   window._fanoutApplyTplIds=[idHostil];fanoutTemplates={};fanoutTemplates[idHostil]={nome:'Receita fictícia',filhos:[{}]};
   window.applyFanoutToCurrentCard=function(id){window.idRecebidoAuditoria=id};
   window._navigateToCard=function(id){window.idRecebidoAuditoria=id};
   window.removeSuperChild=function(id){window.idRecebidoAuditoria=id};
   window._crvUpdateFichaSecVisibility=function(){};
   window.SUBMARCA_TAGS=[];window.submarcaAtivo=false;window._isColDone=function(){return false};
   window._FeriasSelo=function(){return ''};window.getCardTags=function(){return []};
   cards=[{id:idHostil,title:'Filho fictício',col:'todo'}];editingSuperChildren=[{id:idHostil,title:'Filho fictício',col:'todo'}];
   ['m-super-fanout-list','m-super-children-list'].forEach(nomeEl=>{const elAud=document.createElement('div');elAud.setAttribute('id',nomeEl);document.body.appendChild(elAud)});
  },function(){
   // O modo é preenchido abaixo no código da função, sem acessar a página real.
   var modoLocal='MODO_AUDITORIA';
   if(modoLocal==='receita')_renderFanoutApplyList();else renderSuperChildrenList();
   var seletor=modoLocal==='receita'?'.link-option':modoLocal==='abrir filho'?'.minicard-body':'.minicard-rm';
   document.querySelector(seletor).click();
   return {ok:window.xssSuper===0&&window.idRecebidoAuditoria===window.idHostilAuditoria,detalhe:'execuções: '+window.xssSuper+'; ID íntegro: '+(window.idRecebidoAuditoria===window.idHostilAuditoria)};
  }.toString().replace('MODO_AUDITORIA',modo));
 }
 window._resultadosTeste=linhas;console.table(linhas);return linhas;
})();
