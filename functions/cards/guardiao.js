// functions/cards/guardiao.js
//
// 🛡️ Guardião dos cards (03/11/2026) — impede que um card SUMA de vez do quadro.
//
// Por quê: cards da squad midiacriativa sumiram várias vezes (27/08→03/11), sempre por uma gravação do navegador que regrava o array inteiro (`/cards`) a partir de uma
// cópia defasada. O cliente já tem várias defesas (resgate em fbSaveAll, merge por card, trava de aba velha), mas TODAS rodam no navegador — e o navegador é justamente
// o que falha (aba velha, offline que volta, versão antiga). Este guardião roda no SERVIDOR e enxerga o resultado, não a intenção:
//
//   1. ESPELHO — a cada card gravado (`cards_updated_at/{id}`) guarda a última versão em `kanban/cards_espelho/{squad}/{id}`. Nó sem regra de leitura/escrita pros
//      navegadores (só o Admin SDK) — não pesa no download de ninguém. Também serve de "lixeira": o card excluído de propósito continua lá.
//   2. GUARDIÃO — quando um id SAI de `cards_index` e não existe a marca de exclusão (`cards_deleted_intentionally/{id}`) — toda exclusão de verdade grava essa marca na
//      mesma escrita atômica —, o card é RESTAURADO do espelho em segundos, o episódio é registrado em `kanban/cards_guardiao/{squad}/incidentes` e os ADMs/POs da squad
//      recebem a notificação 🛡️ (sino + push). Todo mundo com a squad aberta vê o aviso (`cards_guardiao/{squad}/ultimo`).
//
// Freios (para o guardião nunca virar o problema):
//   • espera ~6 s antes de decidir (a marca de exclusão e o índice novo chegam na mesma escrita, mas o gatilho de remoção pode vir antes dos irmãos);
//   • `cards_guardiao_pausa_ate` (ms) — o cliente liga ao SUBSTITUIR o conjunto de propósito (restaurar backup, importar do Trello): nada é restaurado enquanto valer;
//   • índice vazio ou squad sem `cards_index` = squad apagada/zerada de propósito: não restaura;
//   • mais de MAX_JANELA remoções sem marca em 2 min = operação em massa: NÃO restaura sozinho, só alerta (decisão humana);
//   • o mesmo card restaurado MAX_REINCIDENCIA vezes em 24 h para de ser restaurado (alguém o está apagando por um caminho sem marca) — alerta de reincidência.
//
// Deploy isolado: firebase deploy --only functions:cardsEspelhar,functions:cardsGuardiao,functions:cardsEspelhoVarredura   (e functions:sendPushOnNotification — conhece os tipos novos)
//   + firebase deploy --only database   (regras de kanban/cards_guardiao)

const { onValueWritten, onValueDeleted } = require('firebase-functions/v2/database');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { getDatabase } = require('firebase-admin/database');

const ESPERA_MS = 6000;
const JANELA_MS = 2 * 60 * 1000;
const MAX_JANELA = 30;
const MAX_REINCIDENCIA = 2;
const DIA_MS = 24 * 3600 * 1000;

const base = (sq) => `kanban/squads/${sq}/dados`;
const cortar = (s, n) => String(s || '').slice(0, n);
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

// ─── 1) ESPELHO ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// Guarda a versão atual do card. Lê o índice → posição → card (o id gravado em `cards_updated_at` é a verdade do "este card mudou").
async function espelharCard(db, squadId, cardId, agora) {
  const pos = (await db.ref(`${base(squadId)}/cards_index/${cardId}`).get()).val();
  if (pos == null) return { espelhado: false, motivo: 'fora do índice' };
  const card = (await db.ref(`${base(squadId)}/cards/${pos}`).get()).val();
  if (!card || card.id !== cardId) return { espelhado: false, motivo: 'posição não tem este card' };   // posição trocada no meio da escrita: a próxima gravação espelha
  await db.ref(`kanban/cards_espelho/${squadId}/${cardId}`).set({ card, em: (agora || new Date()).toISOString() });
  return { espelhado: true };
}

// ─── 2) GUARDIÃO ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// Quem recebe o aviso: ADMs e POs da squad (usuarios_publicos tem role + squads).
async function destinatarios(db, squadId) {
  const pubs = (await db.ref('kanban/usuarios_publicos').get()).val() || {};
  return Object.keys(pubs).filter((uid) => {
    const p = pubs[uid]; if (!p) return false;
    return p.role === 'adm' || (p.role === 'po' && p.squads && p.squads[squadId]);
  });
}

async function avisar(db, squadId, cardId, { tipo, titulo, sub }, agora) {
  const quando = (agora || new Date()).toISOString();
  const id = `crd_${cardId}_${quando.slice(0, 13).replace(/[^0-9]/g, '')}`;   // 1 por card por hora: reexecução não duplica
  let n = 0;
  for (const uid of await destinatarios(db, squadId)) {
    const ref = db.ref(`kanban/usuarios/${uid}/notificacoes/${id}`);
    if ((await ref.get()).exists()) continue;
    await ref.set({ id, type: tipo, title: titulo, sub: cortar(sub, 280), cardId, squad: squadId, read: false, ts: quando, noTTLDelete: true });
    n++;
  }
  return n;
}

// 🔎 DEDO-DURO (05/11/2026) — de QUEM foi a gravação que tirou o card do índice. O evento do banco (v2, firebase-functions 5.x) não traz o autor (`authId` só existe no Firestore),
// então o navegador carimba `cards_write_meta/ultimo` no MESMO update atômico de fbSaveAll (uid, versão, função, sinais de cache/rede/sessão, `servidorEm` = horário do SERVIDOR
// e `idsRemovidos` = ids que saíram do índice sem marca de exclusão). Aqui só se atribui a remoção a esse carimbo se (a) o card está em `idsRemovidos` E (b) o horário do evento
// do banco (`opts.eventoEm`, o `time` do CloudEvent) bate com `servidorEm` (±ATRIBUICAO_MS). Sem as duas coisas NINGUÉM é nomeado — uma gravação alheia 30 s antes não é prova.
// Melhor esforço: nada daqui pode impedir a restauração (try/catch em volta; quem chama usa `diag` só como enfeite).
const ATRIBUICAO_MS = 4000;
const FILA_OFFLINE_SEG = 15;
const SYNC_DEFASADO_SEG = 120;
const num = (v) => (typeof v === 'number' && isFinite(v) ? v : null);

function classificar(meta, sinais) {
  if (!meta) return { causaCodigo: 'sem_carimbo', causaTexto: 'Nenhum carimbo de gravação encontrado (gravação de uma versão que ainda não carimba, ou fora do fluxo normal de salvar)' };
  if (meta === 'outra') return { causaCodigo: 'carimbo_de_outra_gravacao', causaTexto: 'Há carimbo de uma gravação recente, mas não é desta remoção — autor não identificado' };
  if (sinais.delayFilaSeg != null && sinais.delayFilaSeg >= FILA_OFFLINE_SEG) return { causaCodigo: 'fila_offline', causaTexto: `Save ficou retido ~${sinais.delayFilaSeg}s na fila offline do navegador antes de chegar ao banco` };
  if (sinais.resgateStatus === 'erro') return { causaCodigo: 'falha_resgate', causaTexto: 'Falha de rede ao ler cards_index durante o resgate do fbSaveAll' };
  if ((sinais.cardsLocal != null && sinais.cardsIndice != null && sinais.cardsLocal < sinais.cardsIndice) || (sinais.ultimoSyncSeg != null && sinais.ultimoSyncSeg > SYNC_DEFASADO_SEG)) {
    return { causaCodigo: 'cache_ou_sync_defasado', causaTexto: `Memória local defasada (tinha ${sinais.cardsLocal ?? '?'} cards vs ${sinais.cardsIndice ?? '?'} no índice; último sync há ${sinais.ultimoSyncSeg ?? '?'}s)` };
  }
  return { causaCodigo: 'desconhecida', causaTexto: 'Carimbo encontrado, mas nenhum sinal conhecido explica a remoção' };
}

// Devolve { causaCodigo, causaTexto, causadoPor?, sinais?, contexto? } — nunca lança.
// `lerCarimbo` é chamado ANTES da espera do guardião (6 s): outro save na squad durante a espera sobrescreve `ultimo` e a atribuição falharia.
async function lerCarimbo(db, squadId) {
  try { return (await db.ref(`${base(squadId)}/cards_write_meta/ultimo`).get()).val() || null; } catch (e) { return null; }
}
async function diagnosticar(db, squadId, cardId, opts, metaPre) {
  try {
    const meta = metaPre !== undefined ? metaPre : await lerCarimbo(db, squadId);
    const evento = opts && opts.eventoEm ? Date.parse(opts.eventoEm) : NaN;
    const servidorEm = meta ? num(meta.servidorEm) : null;
    const lista = meta && Array.isArray(meta.idsRemovidos) ? meta.idsRemovidos : (meta && meta.idsRemovidos ? Object.values(meta.idsRemovidos) : []);
    const casa = !!meta && servidorEm != null && isFinite(evento) && lista.includes(cardId) && Math.abs(evento - servidorEm) <= ATRIBUICAO_MS;
    if (!casa) {
      const out = classificar(meta ? 'outra' : null, {});
      if (meta) {
        const ha = servidorEm != null && isFinite(evento) ? Math.round((evento - servidorEm) / 1000) : null;
        out.contexto = { ultimaEscritaEstrutural: { por: cortar(meta.por, 80) || null, ver: cortar(meta.ver, 40) || null, origem: cortar(meta.origem, 80) || null, haSeg: ha != null && ha >= 0 ? ha : null } };
      }
      return out;
    }
    const clienteMs = Date.parse(meta.clienteEm);
    const resg = meta.resgate || {};
    const sinais = {
      clienteEm: cortar(meta.clienteEm, 30) || null, delayFilaSeg: isFinite(clienteMs) ? Math.round((servidorEm - clienteMs) / 1000) : null,
      abaAbertaMin: num(meta.abaAbertaMin), paradaMin: num(meta.paradaMin), ultimoSyncSeg: num(meta.ultimoSyncSeg), veioDoCacheIdb: !!meta.veioDoCacheIdb,
      offlineAgoraMs: num(meta.offlineAgoraMs), resgateStatus: cortar(resg.status, 12) || null, cardsLocal: num(resg.cardsLocal), cardsIndice: num(resg.cardsIndice),
    };
    return Object.assign({ causadoPor: { uid: cortar(meta.uid, 40) || null, por: cortar(meta.por, 80) || null, ver: cortar(meta.ver, 40) || null, pagina: cortar(meta.pagina, 20) || null, origem: cortar(meta.origem, 80) || null, pilha: cortar(meta.pilha, 240) || null }, sinais }, classificar(meta, sinais));
  } catch (e) {
    return { causaCodigo: 'diagnostico_falhou', causaTexto: 'Não foi possível ler o carimbo de autoria' };
  }
}
const origemCurta = (diag) => (diag && diag.causadoPor ? `Origem: ${diag.causadoPor.por || 'alguém'} (${[diag.causadoPor.ver, diag.causadoPor.origem, diag.causaCodigo === 'fila_offline' ? `fila offline ${diag.sinais.delayFilaSeg}s` : null].filter(Boolean).join(' · ')})` : '');

// Decide o que fazer com a remoção de `cardId` de cards_index. Devolve { acao, ... } (pura em relação ao tempo: `agora`/`esperar` injetáveis → teste determinístico).
async function verificarRemocao(db, squadId, cardId, opts) {
  opts = opts || {};
  const agora = opts.agora || new Date();
  const esperar = opts.esperar == null ? ESPERA_MS : opts.esperar;
  const carimbo = await lerCarimbo(db, squadId);   // antes da espera (ver diagnosticar)
  if (esperar > 0) await dormir(esperar);
  const b = base(squadId);

  // 1. o que explica a remoção e NÃO é problema
  if ((await db.ref(`${b}/cards_index/${cardId}`).get()).exists()) return { acao: 'ignorado', motivo: 'voltou ao índice' };
  if ((await db.ref(`${b}/cards_deleted_intentionally/${cardId}`).get()).val() === true) return { acao: 'ignorado', motivo: 'exclusão intencional' };
  const pausa = Number((await db.ref(`${b}/cards_guardiao_pausa_ate`).get()).val()) || 0;
  if (pausa > agora.getTime()) return { acao: 'ignorado', motivo: 'operação em massa declarada (restaurar backup/importar)' };
  const indice = (await db.ref(`${b}/cards_index`).get()).val();
  if (!indice || !Object.keys(indice).length) return { acao: 'ignorado', motivo: 'índice vazio (squad zerada/apagada)' };

  // 2. há o que restaurar?
  const diag = await diagnosticar(db, squadId, cardId, opts, carimbo);
  const espelho = (await db.ref(`kanban/cards_espelho/${squadId}/${cardId}`).get()).val();
  const titulo = espelho && espelho.card ? espelho.card.title : null;
  const registrar = async (acao, extra) => {
    const chave = `${agora.getTime()}_${cardId}`.replace(/[.#$\[\]/]/g, '_');
    const reg = Object.assign({ cardId, titulo: cortar(titulo, 200) || null, detectadoEm: agora.toISOString(), acao }, diag, extra || {});
    await db.ref(`kanban/cards_guardiao/${squadId}/incidentes/${chave}`).set(reg);
    await db.ref(`kanban/cards_guardiao/${squadId}/ultimo`).set(reg);
    return reg;
  };

  // 3. freios: operação em massa e reincidência
  const jan = await db.ref(`kanban/cards_guardiao/${squadId}/janela`).transaction((j) => {
    j = j && j.ate > agora.getTime() ? j : { ate: agora.getTime() + JANELA_MS, n: 0 };
    j.n++; return j;
  });
  const nJanela = jan.snapshot.val().n;
  if (nJanela > MAX_JANELA) {
    const reg = await registrar('em_massa', { removidosNaJanela: nJanela });
    if (nJanela === MAX_JANELA + 1) await avisar(db, squadId, 'massa', { tipo: 'card_resgatado', titulo: '🚨 Muitos cards sumiram de uma vez', sub: `${nJanela}+ cards saíram de ${squadId} sem exclusão marcada em 2 min. Nada foi restaurado sozinho — confira o Painel › Cards.` }, agora);
    return { acao: 'alerta_em_massa', reg };
  }
  const rec = (await db.ref(`kanban/cards_guardiao/${squadId}/restauracoes/${cardId}`).get()).val() || {};
  const recentes = (rec.ts || []).filter((t) => t > agora.getTime() - DIA_MS);
  if (recentes.length >= MAX_REINCIDENCIA) {
    const reg = await registrar('reincidente', { vezes: recentes.length });
    await avisar(db, squadId, cardId, { tipo: 'card_resgatado', titulo: '🚨 Card sumindo de novo', sub: `${cortar(titulo, 100) || cardId} foi restaurado ${recentes.length}× nas últimas 24 h e saiu outra vez. Algo o apaga sem marcar exclusão — não restaurei de novo. ${origemCurta(diag)}` }, agora);
    return { acao: 'reincidente', reg };
  }
  if (!espelho || !espelho.card) {
    const reg = await registrar('sem_espelho');
    await avisar(db, squadId, cardId, { tipo: 'card_resgatado', titulo: '⚠️ Um card sumiu e não deu pra restaurar sozinho', sub: `${cardId} saiu de ${squadId} sem exclusão marcada e ainda não tinha cópia de segurança. Procure no backup do dia. ${origemCurta(diag)}` }, agora);
    return { acao: 'sem_espelho', reg };
  }

  // 4. restaura: pega uma posição livre no índice (mesma transação da criação de card) e regrava o card
  const card = Object.assign({}, espelho.card);
  card.history = (Array.isArray(card.history) ? card.history : []).concat([{ at: agora.toISOString(), who: '🛡️ Guardião', init: '', what: 'restaurado automaticamente — tinha sumido do quadro sem ninguém excluir' + (diag.causadoPor ? ' · ' + origemCurta(diag) : '') }]);
  const tx = await db.ref(`${b}/cards_index`).transaction((idx) => {
    idx = idx || {};
    if (idx[cardId] != null) return idx;   // alguém já o devolveu enquanto isso
    const usadas = new Set(Object.values(idx).map(String)); let k = 0; while (usadas.has(String(k))) k++;
    idx[cardId] = String(k); return idx;
  });
  const pos = tx.snapshot.val()[cardId];
  const ts = agora.toISOString();
  await db.ref(`${b}/cards/${pos}`).set(card);
  await db.ref(`${b}/cards_updated_at/${cardId}`).set(ts);      // carimbo novo: os aparelhos buscam o card de volta
  if (card.archived) await db.ref(`${b}/cards_archived/${cardId}`).set(true);
  await db.ref(`kanban/cards_guardiao/${squadId}/restauracoes/${cardId}`).set({ ts: recentes.concat([agora.getTime()]) });
  const reg = await registrar('restaurado', { espelhoEm: espelho.em || null, posicao: pos });
  await avisar(db, squadId, cardId, { tipo: 'card_resgatado', titulo: '🛡️ Card restaurado automaticamente', sub: `"${cortar(titulo, 120)}" saiu do quadro de ${squadId} sem ninguém excluir e já voltou (cópia de ${cortar(espelho.em, 16).replace('T', ' ')} UTC). ${origemCurta(diag)}` }, agora);
  return { acao: 'restaurado', reg };
}

// ─── 3) VARREDURA DIÁRIA DO ESPELHO ──────────────────────────────────────────────────────────────────────────────────────────────────
// Dois papéis: (a) PREENCHE o espelho dos cards que ninguém editou desde o deploy (sem isso o guardião diria "sem cópia" pra eles) e (b) fecha qualquer buraco do gatilho
// (evento perdido, posição trocada no meio da escrita). Compara `updatedAt` do card com o do espelho e só grava o que diverge. Roda de madrugada (05:30, depois dos backups).
async function varrerEspelho(db, squads, agora) {
  const ts = (agora || new Date()).toISOString(); const out = {};
  for (const sq of squads) {
    const [cardsV, idxV, espV] = await Promise.all([db.ref(`${base(sq)}/cards`).get(), db.ref(`${base(sq)}/cards_index`).get(), db.ref(`kanban/cards_espelho/${sq}`).get()]);
    const cards = cardsV.val() || {}, idx = idxV.val() || {}, esp = espV.val() || {};
    const lista = Array.isArray(cards) ? cards.map((c, i) => [String(i), c]) : Object.entries(cards);
    let novos = 0, atualizados = 0, iguais = 0;
    for (const [pos, c] of lista) {
      if (!c || !c.id || String(idx[c.id]) !== String(pos)) continue;       // só o que o índice reconhece naquela posição
      const e = esp[c.id];
      if (e && e.card && e.card.updatedAt === c.updatedAt) { iguais++; continue; }
      await db.ref(`kanban/cards_espelho/${sq}/${c.id}`).set({ card: c, em: ts });
      if (e) atualizados++; else novos++;
    }
    out[sq] = { novos, atualizados, iguais };
  }
  return out;
}

const cardsEspelhoVarredura = onSchedule(
  { schedule: 'every day 05:30', timeZone: 'America/Sao_Paulo', region: 'us-central1', memory: '1GiB', timeoutSeconds: 540 },
  async () => {
    const db = getDatabase();
    const squads = await require('../backup/weeklyBackup')._listActiveSquads(db);
    console.log('[cardsEspelhoVarredura]', JSON.stringify(await varrerEspelho(db, squads)));
  }
);

const cardsEspelhar = onValueWritten(
  { ref: '/kanban/squads/{squadId}/dados/cards_updated_at/{cardId}', region: 'us-central1' },
  async (event) => {
    if (!event.data.after.exists()) return;      // card removido: o espelho FICA (é a cópia de segurança/lixeira)
    await espelharCard(getDatabase(), event.params.squadId, event.params.cardId);
  }
);

const cardsGuardiao = onValueDeleted(
  { ref: '/kanban/squads/{squadId}/dados/cards_index/{cardId}', region: 'us-central1', timeoutSeconds: 60 },
  async (event) => {
    const r = await verificarRemocao(getDatabase(), event.params.squadId, event.params.cardId, { eventoEm: event.time });
    console.log('[cardsGuardiao]', event.params.squadId, event.params.cardId, r.acao, r.motivo || '');
  }
);

module.exports = { cardsEspelhar, cardsGuardiao, cardsEspelhoVarredura, varrerEspelho, espelharCard, verificarRemocao, diagnosticar, classificar, destinatarios, MAX_JANELA, MAX_REINCIDENCIA };
