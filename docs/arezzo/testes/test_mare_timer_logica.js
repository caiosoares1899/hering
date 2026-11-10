// Timer — contrato do IIFE real em Node puro, sem navegador ou Firebase.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

let total = 0, falhas = 0;
const json = x => JSON.parse(JSON.stringify(x));
async function teste(nome, testar) {
  total++;
  try { await testar(); console.log('✅ ' + nome); }
  catch (e) { falhas++; console.log('❌ ' + nome + ' ← ' + e.message); }
}
const arquivo = path.resolve(__dirname, '../../../mare-timer-dev.js');
const fonte = fs.readFileSync(arquivo, 'utf8');
function carregar(rejeitar = false) {
  const capturas = [], referencias = [];
  const contexto = vm.createContext({ console });
  contexto.window = contexto;
  contexto._db = {};
  contexto._ref = (db, p) => ({ p: p || '' });
  contexto._update = (ref, upd) => {
    referencias.push(ref);
    capturas.push(upd);
    return rejeitar ? Promise.reject(new Error('falha simulada de gravação')) : Promise.resolve();
  };
  vm.runInContext(fonte, contexto, { filename: arquivo, timeout: 1000 });
  return { M: contexto.MareTimer, capturas, referencias };
}
const { M } = carregar();
const base = { id:'t1', uid:'eve', sq:'site', cardId:'c1', atividade:'Revisar', tipo:'cronometro', status:'rodando', startedAt:1000, accMs:5000, porUid:'ana' };
const agora = 11000, iso = new Date(agora).toISOString();
const pausado = { ...base, status:'pausado', startedAt:null };
const registro = 'kanban/squads/site/dados/card_timers/c1/t1';
const indice = 'kanban/timers_ativos/eve/t1';
const pausa = { status:'pausado', startedAt:null, accMs:15000 };
function esperados(p, remover = false) {
  const upd = {};
  for (const [k, v] of Object.entries(p)) {
    upd[registro + '/' + k] = v;
    if (!remover) upd[indice + '/' + k] = v;
  }
  if (remover) upd[indice] = null;
  return upd;
}

(async () => {
  await teste('API: expõe RAIZ e todas as funções', () => {
    assert.equal(M.RAIZ, 'kanban/timers_ativos');
    for (const nome of ['decorrido','fmt','mostra','estadoTxt','idx','doIndice','patch','caminhos','escrever','acao']) assert.equal(typeof M[nome], 'function', nome);
  });
  await teste('1: rodando soma acumulado e intervalo', () => assert.equal(M.decorrido(base, agora), 15000));
  await teste('1: pausado mantém acumulado', () => assert.equal(M.decorrido(pausado, agora), 5000));
  await teste('1: acumulado negativo não produz tempo negativo', () => assert.equal(M.decorrido({ ...pausado, accMs:-5000 }, agora), 0));
  await teste('1: relógio anterior ao início não produz tempo negativo', () => assert.equal(M.decorrido(base, -10000), 0));
  for (const [ms, txt] of [[65000,'01:05'],[3725000,'1:02:05'],[-1000,'00:00']]) {
    await teste('2: fmt(' + ms + ') = ' + txt, () => assert.equal(M.fmt(ms), txt));
  }
  await teste('3: cronômetro mostra decorrido', () => assert.deepEqual(json(M.mostra(base, agora)), { txt:'00:15', esg:false }));
  for (const [durMs, txt, esg] of [[20000,'00:05',false],[15000,'00:00',false],[10000,'+00:05',true]]) {
    await teste('3: timer com duração ' + durMs, () => assert.deepEqual(json(M.mostra({ ...base, tipo:'timer', durMs }, agora)), { txt, esg }));
  }
  for (const [status, txt] of Object.entries({ novo:'aguardando início', rodando:'em andamento', pausado:'pausado', encerrado:'encerrado' })) {
    await teste('API: estadoTxt ' + status, () => assert.equal(M.estadoTxt({ status }), txt));
  }
  await teste('4: play de novo grava início ISO', () => assert.deepEqual(json(M.patch({ ...base, status:'novo' }, 'play', agora)), { status:'rodando', startedAt:agora, accMs:5000, iniciadoEm:iso }));
  for (const extra of [{}, { iniciadoEm:'2026-01-01T00:00:00.000Z' }]) {
    await teste('4: play de pausado não grava iniciadoEm ' + (extra.iniciadoEm ? 'existente' : 'ausente'), () => {
      const p = M.patch({ ...pausado, ...extra }, 'play', agora);
      assert.equal(Object.hasOwn(p, 'iniciadoEm'), false);
      assert.deepEqual(json(p), { status:'rodando', startedAt:agora, accMs:5000 });
    });
  }
  await teste('4: play de rodando não tem efeito', () => assert.equal(M.patch(base, 'play', agora), null));
  await teste('5: pause de rodando acumula e limpa startedAt', () => assert.deepEqual(json(M.patch(base, 'pause', agora)), pausa));
  for (const status of ['novo','pausado','encerrado']) {
    await teste('5: pause de ' + status + ' não tem efeito', () => assert.equal(M.patch({ ...base, status }, 'pause', agora), null));
  }
  for (const status of ['novo','pausado','rodando']) {
    await teste('6: stop de ' + status + ' encerra com ISO e decorrido', () => assert.deepEqual(json(M.patch({ ...base, status }, 'stop', agora)), { status:'encerrado', startedAt:null, accMs:status === 'rodando' ? 15000 : 5000, encerradoEm:iso }));
  }
  await teste('6: stop de encerrado não tem efeito', () => assert.equal(M.patch({ ...base, status:'encerrado' }, 'stop', agora), null));
  await teste('7: pause escreve exatamente os seis caminhos e valores', () => assert.deepEqual(json(M.caminhos(base, pausa)), esperados(pausa)));
  await teste('7: stop remove índice inteiro sem subcampos', () => {
    const p = M.patch(base, 'stop', agora);
    assert.deepEqual(json(M.caminhos(base, p)), esperados(p, true));
  });
  await teste('API: idx contém o contrato completo do índice', () => assert.deepEqual(json(M.idx(base)), { sq:'site', cardId:'c1', cardTitle:'', atividade:'Revisar', tipo:'cronometro', status:'rodando', startedAt:1000, accMs:5000, durMs:null, porUid:'ana' }));
  await teste('7: criar grava idx inteiro com patch aplicado', () => {
    const esperado = {};
    for (const [k,v] of Object.entries(pausa)) esperado[registro + '/' + k] = v;
    esperado[indice] = json(M.idx({ ...base, ...pausa }));
    assert.deepEqual(json(M.caminhos(base, pausa, { criar:true })), esperado);
  });
  await teste('8: ignora undefined em campo extra do registro', () => assert.deepEqual(Object.keys(M.caminhos(base, { descricao:undefined })), []));
  await teste('8: ignora undefined também nos campos do índice', () => {
    // Não converter por JSON aqui: isso esconderia as propriedades undefined do update real.
    assert.deepEqual(Object.keys(M.caminhos(base, { atividade:undefined, durMs:undefined })), []);
  });
  await teste('9: doIndice recupera identidade e play não regrava início', () => {
    const t = M.doIndice('eve', 't9', { sq:'site', cardId:'c1', status:'pausado', accMs:1000 });
    assert.deepEqual(json(t), { id:'t9', uid:'eve', sq:'site', cardId:'c1', status:'pausado', accMs:1000 });
    const p = M.patch(t, 'play', agora);
    assert.equal(Object.hasOwn(p, 'iniciadoEm'), false);
    assert.deepEqual(json(p), { status:'rodando', startedAt:agora, accMs:1000 });
  });
  await teste('API: escrever envia um update na raiz e devolve sua promessa', async () => {
    const { M, capturas, referencias } = carregar();
    await M.escrever(base, pausa);
    assert.deepEqual(json(capturas), [esperados(pausa)]);
    assert.deepEqual(referencias, [{ p:'' }]);
  });
  await teste('10: outro uid é recusado sem escrita', async () => {
    const { M, capturas } = carregar();
    const r = await M.acao(base, 'stop', { uid:'outro', agora });
    assert.equal(r.ok, false);
    assert.equal(r.erro, 'nao_e_seu');
    assert.equal(capturas.length, 0);
  });
  await teste('10: ação sem efeito não escreve', async () => {
    const { M, capturas } = carregar();
    assert.deepEqual(json(await M.acao(pausado, 'pause', { uid:'eve', agora })), { ok:false, erro:'nada_a_fazer' });
    assert.equal(capturas.length, 0);
  });
  await teste('10: rejeição de update retorna gravacao e não notifica', async () => {
    const { M, capturas } = carregar(true);
    const avisos = [];
    const r = await M.acao(base, 'stop', { uid:'eve', agora, notificar:d => avisos.push(d) });
    assert.equal(r.ok, false);
    assert.equal(r.erro, 'gravacao');
    assert.equal(capturas.length, 1);
    assert.equal(avisos.length, 0);
  });
  await teste('10: stop notifica criador diferente uma vez após gravar', async () => {
    const { M, capturas } = carregar();
    const avisos = [];
    const r = await M.acao(base, 'stop', { uid:'eve', agora, nome:'Pessoa de teste', notificar:d => {
      assert.equal(capturas.length, 1);
      avisos.push(d);
    } });
    assert.equal(r.ok, true);
    assert.deepEqual(json(r.patch), json(M.patch(base, 'stop', agora)));
    assert.deepEqual(json(capturas), [esperados(M.patch(base, 'stop', agora), true)]);
    assert.equal(avisos.length, 1);
    const { uid, tipo, cardId, squad, tid, titulo } = avisos[0];
    assert.deepEqual({ uid, tipo, cardId, squad, tid }, { uid:'ana', tipo:'timer_encerrado', cardId:'c1', squad:'site', tid:'t1' });
    assert.ok(titulo.includes(base.atividade));
  });
  for (const porUid of [undefined, 'eve']) {
    await teste('10: stop não notifica com porUid ' + porUid, async () => {
      const { M, capturas } = carregar();
      const avisos = [];
      const r = await M.acao({ ...base, porUid }, 'stop', { uid:'eve', agora, notificar:d => avisos.push(d) });
      assert.equal(r.ok, true);
      assert.equal(capturas.length, 1);
      assert.equal(avisos.length, 0);
    });
  }
  for (const [ac, timer] of [['play', pausado], ['pause', base]]) {
    await teste('10: ' + ac + ' grava sem notificar', async () => {
      const { M, capturas } = carregar();
      const avisos = [];
      const r = await M.acao(timer, ac, { uid:'eve', agora, notificar:d => avisos.push(d) });
      assert.equal(r.ok, true);
      assert.deepEqual(json(capturas), [json(M.caminhos(timer, M.patch(timer, ac, agora)))]);
      assert.equal(avisos.length, 0);
    });
  }
  console.log('\n' + (falhas ? 'FALHOU' : 'TUDO OK') + ' — ' + total + ' verificações, ' + falhas + ' falhas');
  process.exitCode = falhas ? 1 : 0;
})().catch(e => { console.error('FALHOU — erro ao executar suíte:', e); process.exitCode = 1; });
