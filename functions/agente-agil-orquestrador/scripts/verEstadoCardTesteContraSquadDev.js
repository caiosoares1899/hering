#!/usr/bin/env node
// functions/agente-agil-orquestrador/scripts/verEstadoCardTesteContraSquadDev.js
//
// Script de leitura PURA — sem LLM, sem escrita, sem custo. Só imprime o
// estado atual (título, descrição, coluna, prioridade, tags) do card de
// teste no squad 'dev'. Existe porque, antes de rodar o canário 8 real
// (editar_campos.desc), o usuário precisa decidir se a descrição atual do
// card já tem conteúdo suficiente pra testar preservação, ou se vale a
// pena preencher uma descrição de exemplo manualmente pela UI antes
// (mesmo padrão usado no card de teste anterior, c1785505159707_geo,
// excluído, e no seguinte, c1785889397211_x0xr2, que acabou reaproveitado
// pra trabalho real — squad 'dev' não é um sandbox isolado, cards lá
// viram trabalho de verdade com o tempo. Card atual: c1786712278908,
// título "[TESTE Agente Ágil] Canário 8 — não editar manualmente", já
// criado com a mesma descrição aprovada no dryRun original: "Este post
// faz parte da campanha de Q3.").
//
// Uso:
//   cd functions
//   node agente-agil-orquestrador/scripts/verEstadoCardTesteContraSquadDev.js <cardId>
//
// Não precisa de ANTHROPIC_API_KEY (não chama o modelo).

const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');

const { resolveCardKey, cardsPath } = require('../../agente-agil/board');

const SQUAD_ID = 'dev';
const DATABASE_URL = process.env.FIREBASE_DATABASE_URL || 'https://hering-onboarding-default-rtdb.firebaseio.com';

async function main() {
  const cardId = process.argv[2];
  if (!cardId) {
    console.error(`Uso: node ${__filename.split(require('path').sep).pop()} <cardId>`);
    console.error('cardId é obrigatório, sem default. Use c1786712278908.');
    process.exit(1);
  }

  initializeApp({ credential: applicationDefault(), databaseURL: DATABASE_URL });
  const db = getDatabase();

  const cardKey = await resolveCardKey(db, cardId, { squadId: SQUAD_ID });
  if (!cardKey) {
    console.error(`Card "${cardId}" não encontrado no squad "${SQUAD_ID}".`);
    process.exit(1);
  }

  const cardSnap = await db.ref(`${cardsPath(SQUAD_ID)}/${cardKey}`).get();
  const card = cardSnap.val() || {};

  console.log(`\n=== Estado atual do card ${cardId} (squad ${SQUAD_ID}) ===`);
  console.log('título:', card.title || '(sem título)');
  console.log('coluna:', card.col || '(nenhuma)');
  console.log('prioridade:', card.priority || '(nenhuma)');
  console.log('tags:', Array.isArray(card.tags) ? card.tags.join(', ') || '(nenhuma)' : (card.tag || '(nenhuma)'));
  console.log('descrição:', card.desc ? JSON.stringify(card.desc) : '(vazia)');

  if (!card.desc) {
    console.log('\nDescrição está VAZIA. Pra testar o caso mais arriscado (preservação de');
    console.log('conteúdo existente), preencha uma descrição de exemplo pela UI');
    console.log(`(kanban-dev.html?squad=dev&opencard=${cardId}) antes de rodar o dryRun/canário real.`);
  } else {
    console.log('\nDescrição já tem conteúdo — bom, o teste de preservação já é válido como está.');
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('Falha ao rodar o script:', err.message || err);
  process.exit(1);
});
