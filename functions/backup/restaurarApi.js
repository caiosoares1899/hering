// functions/backup/restaurarApi.js — API da tela "🛟 Backup completo" do Maré (Config → Backup). Chamada via fetch + Bearer idToken (mesmo padrão
// de spotify/disconnect.js: nenhuma página do app importa o SDK de Functions). O Storage de `backups-completos/` NÃO é legível pelo cliente
// (tem papéis/e-mails de todo mundo), então quem lê é esta função, com o Admin SDK — e só devolve o recorte de UM squad, a quem é PO/Organizador
// do squad ou ADM.
//
// Ações (POST JSON):
//   { acao:'listar',    squad }                      → backups semanais que têm esse squad [{data, bytes}]
//   { acao:'comparar',  squad, data }                → por área: noBackup, agora, faltando, exemplos  (nada é gravado)
//   { acao:'restaurar', squad, data, areas:[ids] }   → traz de volta SÓ o que sumiu (nunca sobrescreve), grava um registro e devolve o que fez
// "Só o que sumiu": ver restaurarCore.js. Antes de gravar, a lista exata do que será criado vai pra backups-completos/pre-restauracao/ (pra desfazer),
// e quem restaurou fica em kanban/squads/{squad}/dados/backup_restauracoes/{ts}.
const { onRequest } = require('firebase-functions/v2/https');
const { getAuth } = require('firebase-admin/auth');
const { getDatabase } = require('firebase-admin/database');
const { getStorage } = require('firebase-admin/storage');
const { mencionaAgente } = require('../agente-agil-orquestrador/detectaMencao');
const { PREFIXO } = require('./completo');
const { AREAS_IDS, compararAreas, faltantes, marcadoresDeMencao } = require('./restaurarCore');

const SITE_ORIGIN = 'https://caiosoares1899.github.io';
const DEFAULT_ADM_EMAILS = ['caio.soares@ciahering.com.br', 'rafael.passos@ciahering.com.br'];
const SQUAD_RE = /^[A-Za-z0-9_-]{1,40}$/, DATA_RE = /^\d{4}-\d{2}-\d{2}$/;
const LOTE = 400;     // caminhos por update (o RTDB limita o tamanho de cada gravação)

class ErroApi extends Error { constructor(status, msg) { super(msg); this.status = status; } }

// Mesma regra do board (canBulkDelete): ADM, PO ou Organizador. PO/Organizador só no squad em que estão inscritos; ADM em qualquer um.
async function exigirPermissao(db, decoded, squad) {
  const email = String(decoded.email || '').toLowerCase();
  if (!email.endsWith('@ciahering.com.br') || (decoded.firebase && decoded.firebase.sign_in_provider) !== 'google.com') throw new ErroApi(403, 'Só contas Google @ciahering.com.br.');
  const [uSnap, admSnap] = await Promise.all([db.ref(`kanban/usuarios/${decoded.uid}`).get(), db.ref('kanban/config/adm_emails').get()]);
  const u = uSnap.val() || {};
  const adms = (Array.isArray(admSnap.val()) ? admSnap.val() : DEFAULT_ADM_EMAILS).map((e) => String(e).toLowerCase());
  if (u.role === 'adm' || adms.includes(email)) return { nome: u.nome || email, papel: 'adm' };
  const papel = (u.squads_roles && u.squads_roles[squad]) || u.role || 'membro';
  if (['po', 'organizador'].includes(papel) && u.squads && u.squads[squad] === true) return { nome: u.nome || email, papel };
  throw new ErroApi(403, 'Só ADM, PO ou Organizador deste squad pode usar o backup completo.');
}

const arquivoDoSquad = (data, squad) => `${PREFIXO}/semanal/${data}/squads/${squad}.json`;

async function lerBackupDoSquad(bucket, data, squad) {
  const f = bucket.file(arquivoDoSquad(data, squad));
  const [existe] = await f.exists();
  if (!existe) throw new ErroApi(404, `Não existe backup completo de ${squad} em ${data}.`);
  const [buf] = await f.download();
  return JSON.parse(buf.toString('utf8'));
}
async function lerAtuais(db, squad) {
  const out = {};
  await Promise.all(AREAS_IDS.map(async (a) => { out[a] = (await db.ref(`kanban/squads/${squad}/dados/${a}`).get()).val(); }));
  return out;
}

async function processar({ db, bucket, decoded, corpo, agora }) {
  const squad = String((corpo && corpo.squad) || ''), acao = String((corpo && corpo.acao) || '');
  if (!SQUAD_RE.test(squad)) throw new ErroApi(400, 'Squad inválido.');
  const quem = await exigirPermissao(db, decoded, squad);
  const iso = (agora || new Date()).toISOString();

  if (acao === 'listar') {
    const [arqs] = await bucket.getFiles({ prefix: `${PREFIXO}/semanal/` });
    const backups = arqs.filter((f) => f.name.endsWith(`/squads/${squad}.json`)).map((f) => ({ data: f.name.split('/')[2], bytes: Number((f.metadata && f.metadata.size) || 0) })).sort((a, b) => (a.data < b.data ? 1 : -1));
    return { backups };
  }

  const data = String((corpo && corpo.data) || '');
  if (!DATA_RE.test(data)) throw new ErroApi(400, 'Data inválida.');
  const backup = await lerBackupDoSquad(bucket, data, squad);
  const atuais = await lerAtuais(db, squad);

  if (acao === 'comparar') return { data, exportadoEm: backup.exportadoEm, areas: compararAreas(backup.dados, atuais) };

  if (acao === 'restaurar') {
    const areas = [...new Set(Array.isArray(corpo.areas) ? corpo.areas : [])];
    if (!areas.length || areas.some((a) => !AREAS_IDS.includes(a))) throw new ErroApi(400, 'Escolha ao menos uma área válida.');
    const base = `kanban/squads/${squad}/dados`;
    const caminhos = {}, porArea = {};
    let adicionadosComentarios = [];
    areas.forEach((a) => {
      const f = faltantes(atuais[a], (backup.dados || {})[a]);
      porArea[a] = f.length;
      f.forEach(({ path, valor }) => { caminhos[`${a}${path ? '/' + path : ''}`] = valor; });
      if (a === 'card_comments') adicionadosComentarios = f;
    });
    if (adicionadosComentarios.length) {
      const jaProc = (await db.ref(`${base}/agente_agil_mencao_processed`).get()).val() || {};
      Object.assign(caminhos, marcadoresDeMencao(adicionadosComentarios, jaProc, mencionaAgente, iso));
    }
    const total = Object.keys(caminhos).length;
    if (!total) return { restaurados: porArea, total: 0, mensagem: 'Nada pra restaurar: tudo que está no backup (nessas áreas) já existe hoje.' };

    // Registro pra desfazer: a lista EXATA de caminhos criados (desfazer = apagar esses caminhos).
    const ts = iso.replace(/[:.]/g, '-');
    await bucket.file(`${PREFIXO}/pre-restauracao/${ts}/api-${squad}.json`).save(JSON.stringify({ squad, backup: data, por: quem.nome, areas, criados: Object.keys(caminhos) }), { contentType: 'application/json', resumable: false });
    const ks = Object.keys(caminhos);
    for (let i = 0; i < ks.length; i += LOTE) {
      const lote = {}; ks.slice(i, i + LOTE).forEach((k) => { lote[k] = caminhos[k]; });
      await db.ref(base).update(lote);
    }
    await db.ref(`${base}/backup_restauracoes/${ts}`).set({ ts: iso, por: quem.nome, uid: decoded.uid, backup: data, areas, itens: total });
    return { restaurados: porArea, total, desfazer: `${PREFIXO}/pre-restauracao/${ts}/api-${squad}.json` };
  }
  throw new ErroApi(400, 'Ação desconhecida.');
}

exports.backupCompletoApi = onRequest({ region: 'us-central1', cors: SITE_ORIGIN, memory: '1GiB', timeoutSeconds: 120 }, async (req, res) => {
  if (req.method !== 'POST') { res.status(405).send('Method not allowed.'); return; }
  const m = (req.get('Authorization') || '').match(/^Bearer (.+)$/);
  if (!m) { res.status(401).send('Faltou o header Authorization: Bearer <idToken>.'); return; }
  let decoded;
  try { decoded = await getAuth().verifyIdToken(m[1]); } catch (e) { res.status(401).send('Token inválido ou expirado.'); return; }
  try {
    res.status(200).json(await processar({ db: getDatabase(), bucket: getStorage().bucket(), decoded, corpo: req.body || {} }));
  } catch (e) {
    if (e instanceof ErroApi) { res.status(e.status).json({ erro: e.message }); return; }
    console.error('[backupCompletoApi]', e);
    res.status(500).json({ erro: 'Falha inesperada — veja o log da função.' });
  }
});
Object.assign(exports, { processar, ErroApi, exigirPermissao });
