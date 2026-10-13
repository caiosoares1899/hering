#!/usr/bin/env node
// functions/backup/restaurar.js — restaura um nó (ou um squad) a partir do backup COMPLETO (backup/completo.js).
// Roda NA SUA MÁQUINA (não é Cloud Function), com credenciais do Firebase (ADC): `gcloud auth application-default login`
// ou GOOGLE_APPLICATION_CREDENTIALS apontando pra uma chave de service account. Por padrão é DRY-RUN: só mostra o que faria.
//
//   node backup/restaurar.js --listar [--modo semanal|diario]
//   node backup/restaurar.js --modo diario --data 2026-10-12 --no okr                 # simula
//   node backup/restaurar.js --modo diario --data ultimo   --no okr --aplicar         # grava de verdade
//   node backup/restaurar.js --modo semanal --data ultimo  --squad dados --aplicar
//
// Variáveis: FIREBASE_DATABASE_URL (ex.: https://<projeto>-default-rtdb.firebaseio.com) e
//            FIREBASE_STORAGE_BUCKET (ex.: hering-onboarding.firebasestorage.app).
//
// Como restaura (sempre MESCLA, nunca apaga): `update` no 1º nível do nó — o que existe hoje e NÃO está no backup fica;
// o que está no backup volta (sobrescrevendo o filho inteiro). Em `usuarios` o `update` é POR PESSOA (preserva as
// notificações e os tokens de push, que o backup não guarda). Antes de aplicar, o script grava o estado ATUAL do alvo em
// `backups-completos/pre-restauracao/{timestamp}/…` — dá pra desfazer a própria restauração.
const PREFIXO = 'backups-completos';

// Plano de escrita (puro — testado): lista de { path, valor } onde cada item vira `ref(path).update(valor)`.
function planoDeRestauracao({ no, squad, arquivo }) {
  if (squad) {
    const p = `kanban/squads/${squad}`;
    const itens = [];
    if (arquivo.dados != null) itens.push({ path: `${p}/dados`, valor: arquivo.dados });
    if (arquivo.snapshots != null) itens.push({ path: `${p}/snapshots`, valor: arquivo.snapshots });
    if (arquivo.externos != null) itens.push({ path: `${p}/externos`, valor: arquivo.externos });
    return itens;
  }
  const dados = arquivo.dados;
  if (dados == null || typeof dados !== 'object') return [];
  if (no === 'usuarios') return Object.keys(dados).map((uid) => ({ path: `kanban/usuarios/${uid}`, valor: dados[uid] || {} }));
  return [{ path: `kanban/${no}`, valor: dados }];
}

const caminhosAtuais = (itens) => itens.map((i) => i.path);

function args(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const k = a.slice(2), prox = argv[i + 1];
    if (prox && !prox.startsWith('--')) { o[k] = prox; i++; } else o[k] = true;
  }
  return o;
}

async function listarDatas(bucket, modo) {
  const [files] = await bucket.getFiles({ prefix: `${PREFIXO}/${modo}/` });
  return [...new Set(files.map((f) => f.name.split('/')[2]).filter(Boolean))].sort();
}

async function lerJson(bucket, caminho) {
  const [buf] = await bucket.file(caminho).download();
  return JSON.parse(buf.toString('utf8'));
}

async function main() {
  const a = args(process.argv.slice(2));
  const admin = require('firebase-admin');
  admin.initializeApp({ databaseURL: process.env.FIREBASE_DATABASE_URL, storageBucket: process.env.FIREBASE_STORAGE_BUCKET });
  const db = admin.database(), bucket = admin.storage().bucket();
  const modo = a.modo || 'semanal';

  if (a.listar) {
    for (const m of (a.modo ? [modo] : ['semanal', 'diario'])) console.log(`${m}:`, (await listarDatas(bucket, m)).join('  ') || '(nada)');
    return;
  }
  if (!a.no && !a.squad) { console.error('Informe --no <nome> ou --squad <id> (ou --listar).'); process.exit(2); }
  if (a.no && a.squad) { console.error('Use --no OU --squad, não os dois.'); process.exit(2); }

  const datas = await listarDatas(bucket, modo);
  const data = !a.data || a.data === 'ultimo' ? datas[datas.length - 1] : a.data;
  if (!data || !datas.includes(data)) { console.error(`Backup ${modo} de "${a.data || 'ultimo'}" não existe. Datas: ${datas.join(', ') || '(nenhuma)'}`); process.exit(2); }

  const arquivoPath = a.squad ? `${PREFIXO}/${modo}/${data}/squads/${a.squad}.json` : `${PREFIXO}/${modo}/${data}/global/${a.no}.json`;
  const arquivo = await lerJson(bucket, arquivoPath);
  const itens = planoDeRestauracao({ no: a.no, squad: a.squad, arquivo });
  console.log(`Backup ${modo} de ${data} → ${arquivoPath}`);
  console.log(`Exportado em ${arquivo.exportadoEm}. ${itens.length} gravação(ões):`);
  itens.slice(0, 25).forEach((i) => console.log(`  update ${i.path}  (${Object.keys(i.valor || {}).length} chave(s))`));
  if (itens.length > 25) console.log(`  … +${itens.length - 25}`);
  if (!a.aplicar) { console.log('\nDRY-RUN: nada foi gravado. Rode de novo com --aplicar.'); return; }

  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const antes = {};
  for (const p of caminhosAtuais(itens)) antes[p] = (await db.ref(p).get()).val();
  await bucket.file(`${PREFIXO}/pre-restauracao/${ts}/${a.squad ? 'squad-' + a.squad : a.no}.json`).save(JSON.stringify(antes), { contentType: 'application/json', resumable: false });
  console.log(`Estado atual salvo em ${PREFIXO}/pre-restauracao/${ts}/ (pra desfazer).`);
  for (const i of itens) await db.ref(i.path).update(i.valor);
  console.log('✅ Restauração aplicada.');
}

if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
module.exports = { planoDeRestauracao, args, listarDatas };
