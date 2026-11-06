// functions/oceano/resumo.js — 🌊 "Mini painel" do Caio (30/10/2026): UM JSON pequeno com a saúde do ecossistema e os cards dele, para bater o olho.
//
// Quem consome: a página `minipainel.html` (e, depois, o item da barra de menu / widget do Mac do Caio). Tudo que já existe no Painel (aba 🔋 Status) mais os cards dele:
//   GET …/oceanoResumo?k=<OCEANO_RESUMO_KEY>   →   JSON  { geral, status:{vtex,github,firebase}, backup, plantao, alarmesSumico, meusCards, geradoEm }
// Segurança: a chave vai na URL (é o que um GET sem cabeçalho permite; mesmo desenho do `plantaoProximo`) e abre SÓ o resumo do DONO configurado em DONO_EMAIL
// (nunca o de outra pessoa). Vazou? Troca-se o secret e reimplanta-se esta função. Teto de requisições por hora. O JSON só leva títulos de card (≤ 80 caracteres), prazos e contagens.
// Custo no banco: os cards do dono vêm de `orderByChild('owner').equalTo(init)` — só chega o RESULTADO se `cards` tiver `.indexOn: ["owner"]` (database.rules.json; sem o índice o
// Firebase baixaria o nó inteiro de cada squad). Por isso o deploy das regras vem ANTES do deploy desta função. Cache em memória: 60 s o todo, 5 min os cards, 15 min o backup.
// Escopo dos cards: ATIVOS (não arquivados, fora das colunas de fim) em que o dono é o RESPONSÁVEL, nos squads onde ele é membro. Participante fica de fora de propósito (não dá para consultar).
const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { getDatabase } = require('firebase-admin/database');
const { getAuth } = require('firebase-admin/auth');
const { getStorage } = require('firebase-admin/storage');
const flowLib = require('../agente-agil/flow');
const { sinaisDoCard } = require('../agente-agil-orquestrador/resumoMeuDia');
const { verificar: verificarBackups } = require('../backup/vigia');
const { chaveOk } = require('../plantao/agente');

const OCEANO_RESUMO_KEY = defineSecret('OCEANO_RESUMO_KEY');
const SITE_ORIGIN = 'https://caiosoares1899.github.io';
const DONO_EMAIL = 'caio.soares@ciahering.com.br';
const LIMITE_POR_HORA = 600;
const MONITOR_PARADO_MS = 20 * 60000;          // os 3 monitores rodam a cada 5 min: 20 min sem atualizar = monitor parado
const TTL = { tudo: 60000, cards: 5 * 60000, backup: 15 * 60000 };
const MAX_CARDS_LISTA = 8;
const MAX_SQUADS = 20;
const GRAVIDADE = { ok: 0, off: 0, desconhecido: 1, atencao: 1, fora: 2 };

const corta = (s, n) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, n);
const minutosDesde = (iso, agora) => { const t = Date.parse(iso || ''); return Number.isFinite(t) ? Math.max(0, Math.round((agora - t) / 60000)) : null; };
const pior = (...estados) => estados.reduce((a, b) => (GRAVIDADE[b] > GRAVIDADE[a] ? b : a), 'ok');

// ── status dos 3 monitores (mesmos nós que a aba 🔋 Status do Painel lê) ──────────────────────────────────────────────────────────────────────────────────────────────────
function parado(n, agora) { const m = minutosDesde(n.verificadoEm || n.ultimoOkEm, agora); return m != null && m * 60000 > MONITOR_PARADO_MS ? m : null; }
function base(n, agora, nome) {
  if (!n) return { estado: 'desconhecido', texto: 'sem leitura do monitor' };
  if (n.desligado) return { estado: 'off', texto: 'monitor desligado' };
  if (n.ok === false) return { estado: 'fora', texto: 'monitor sem resposta' + (n.falhasSeguidas ? ` (${n.falhasSeguidas} falhas)` : '') };
  const p = parado(n, agora);
  if (p != null) return { estado: 'atencao', texto: `monitor parado há ${p} min`, minutos: p };
  return null;
}
function statusVtex(n, agora) {
  const b = base(n, agora); if (b) return b;
  const ab = Number(n.abertos) || 0;
  if (ab > 0) return { estado: 'atencao', texto: `${ab} incidente${ab > 1 ? 's' : ''}` + (n.incidentes && n.incidentes[0] ? ': ' + corta(n.incidentes[0].titulo, 70) : ''), abertos: ab };
  return { estado: 'ok', texto: 'operando' };
}
function statusGithub(n, agora) {
  const b = base(n, agora); if (b) return b;
  if (n.pagesAfetado) return { estado: 'atencao', texto: 'GitHub Pages afetado' + (n.pagesStatusLabel ? ' (' + corta(n.pagesStatusLabel, 40) + ')' : '') };
  if (n.indicador && n.indicador !== 'none') return { estado: 'atencao', texto: corta(n.descricao || n.indicador, 80) };
  const ab = Number(n.abertos) || 0;
  if (ab > 0) return { estado: 'atencao', texto: `${ab} incidente${ab > 1 ? 's' : ''}`, abertos: ab };
  return { estado: 'ok', texto: 'operando' };
}
function statusFirebase(n, agora) {
  const b = base(n, agora); if (b) return b;
  const deg = Array.isArray(n.servicosDegradados) ? n.servicosDegradados.length : Number(n.servicosDegradados) || 0;
  if (n.rtdbAfetado) return { estado: 'atencao', texto: 'Realtime Database afetado' + (n.rtdbStatusLabel ? ' (' + corta(n.rtdbStatusLabel, 40) + ')' : '') };
  if (deg > 0) return { estado: 'atencao', texto: `${deg} serviço${deg > 1 ? 's' : ''} degradado${deg > 1 ? 's' : ''}`, abertos: deg };
  const ab = Number(n.abertos) || 0;
  if (ab > 0) return { estado: 'atencao', texto: `${ab} incidente${ab > 1 ? 's' : ''}`, abertos: ab };
  return { estado: 'ok', texto: 'operando' };
}

// ── backup (reaproveita o vigia: mesma conta que avisa os ADMs) ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
async function resumirBackup({ db, bucket, agora }) {
  try {
    const { problemas } = await verificarBackups({ db, bucket, agora: new Date(agora) });
    return problemas.length ? { estado: 'fora', texto: corta(problemas[0].texto, 120), problemas: problemas.length } : { estado: 'ok', texto: 'em dia' };
  } catch (e) { return { estado: 'desconhecido', texto: 'não consegui conferir o backup' }; }
}

// ── plantão de bugs (fichas abertas) ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const PLANTAO_ABERTOS = new Set(['aguardando', 'em_analise', 'pr_aberto', 'testando', 'reprovado', 'escalado']);
async function resumirPlantao({ db }) {
  const fichas = (await db.ref('kanban/plantao').get()).val() || {};
  const c = {}; let total = 0;
  Object.values(fichas).forEach((f) => { if (f && PLANTAO_ABERTOS.has(f.estado)) { c[f.estado] = (c[f.estado] || 0) + 1; total++; } });
  return { abertos: total, porEstado: c, aguardandoValidacao: (c.testando || 0) + (c.pr_aberto || 0), escalados: c.escalado || 0 };
}

// ── alarmes "card sumiu" das últimas 24 h, nos squads do dono ──────────────────────────────────────────────────────────────────────
// Com o 🛡️ guardião (functions/cards/guardiao.js) o alarme do navegador deixou de ser sinônimo de card perdido: ele restaura do espelho em segundos e registra em
// kanban/cards_guardiao/{squad}/incidentes. Então o semáforo só fica em ATENÇÃO para o que NÃO teve socorro:
//   • `ultimas24h`   = cards sem socorro (alarme sem restauração do guardião, + incidentes do guardião que não deu pra restaurar: sem cópia, em massa, reincidente) — é o que pinta o semáforo;
//   • `restaurados24h` = cards que o guardião devolveu sozinho (informativo, verde);  • `alarmes24h` = alarmes brutos do navegador (como `ultimas24h` era antes).
const TOLERANCIA_SOCORRO_MS = 60000;   // o guardião decide ~6 s depois do alarme; folga pra relógio/reexecução
async function resumirAlarmes({ db, squads, agora }) {
  const corte = new Date(agora - 24 * 3600000).toISOString();
  const lidos = await Promise.all(squads.map(async (sq) => ({
    sq,
    v: (await db.ref(`kanban/squads/${sq}/dados/cards_incidentes_sumico`).get()).val() || {},
    g: (await db.ref(`kanban/cards_guardiao/${sq}/incidentes`).get()).val() || {},
    r: (await db.ref(`kanban/cards_guardiao/${sq}/resolvidos`).get()).val() || {},   // incidentes que um ADM/PO marcou como resolvidos (histórico fica; só deixam de pintar o semáforo)
  })));
  const itens = [], restauradosPorCard = new Map(), naoRestaurados = new Set(), restaurados = new Set();
  lidos.forEach(({ sq, v, g, r }) => {
    Object.values(v).forEach((x) => { if (x && x.detectadoEm >= corte) itens.push({ sq, cardId: x.cardId, em: x.detectadoEm }); });
    Object.entries(g).forEach(([chave, x]) => {
      if (!x || !x.cardId || !(x.detectadoEm >= corte)) return;
      if (x.acao !== 'restaurado' && r[chave]) return;        // resolvido por gente: não conta mais como "sem socorro"
      if (x.acao === 'restaurado') { restaurados.add(sq + ':' + x.cardId); restauradosPorCard.set(sq + ':' + x.cardId, x.detectadoEm); }
      else naoRestaurados.add(sq + ':' + x.cardId);          // sem_espelho / em_massa / reincidente: ninguém restaurou
    });
  });
  const socorrido = (i) => { const t = restauradosPorCard.get(i.sq + ':' + i.cardId); return !!t && Date.parse(t) >= Date.parse(i.em) - TOLERANCIA_SOCORRO_MS; };
  const distintos = new Set(itens.map((i) => i.sq + ':' + i.cardId));
  const semSocorro = new Set(naoRestaurados);
  itens.filter((i) => !socorrido(i)).forEach((i) => semSocorro.add(i.sq + ':' + i.cardId));
  const ultimo = itens.sort((a, b) => b.em.localeCompare(a.em))[0];
  return { ultimas24h: semSocorro.size, restaurados24h: restaurados.size, alarmes24h: distintos.size, ultimoEm: ultimo ? ultimo.em : null, squadUltimo: ultimo ? ultimo.sq : null };
}

// ── saúde do Guardião (pulso escrito por functions/cards/status.js a cada 5 min em kanban/cards_guardiao/_status) ─────────────────────────────────────────────────────
// ok = pulso com menos de 15 min E o espelho acompanhando os cards (atraso ≤ 5 min). Sem o nó (função ainda não publicada) = 'desconhecido' — NÃO pinta o semáforo geral.
const LIMITE_PULSO_MS = 15 * 60 * 1000;
function statusGuardiao(s, agora) {
  if (!s || !s.ts) return { estado: 'desconhecido', texto: 'sem pulso ainda', pulsoMin: null, atrasoMin: null, abertos: null };
  const pulsoMs = agora - Date.parse(s.ts), pulsoMin = Math.max(0, Math.round(pulsoMs / 60000));
  const atrasoMin = Number(s.atrasoMaxMin) || 0, abertos = Number(s.abertosTotal) || 0;
  if (!(pulsoMs <= LIMITE_PULSO_MS)) return { estado: 'atencao', texto: `sem pulso há ${pulsoMin} min`, pulsoMin, atrasoMin, abertos };
  if (s.ok === false) return { estado: 'atencao', texto: `espelho atrasado ${atrasoMin} min`, pulsoMin, atrasoMin, abertos };
  return { estado: 'ok', texto: abertos ? `ativo · ${abertos} incidente(s) em aberto` : 'ativo', pulsoMin, atrasoMin, abertos };
}

// ── meus cards (responsável) ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
async function cardsDoDono(db, squadId, init) {
  const snap = await db.ref(`kanban/squads/${squadId}/dados/cards`).orderByChild('owner').equalTo(init).get();
  const v = snap.val();
  return Array.isArray(v) ? v.filter(Boolean) : Object.values(v || {});
}
async function resumirCards({ db, squads, init, agora }) {
  const hoje = new Date(agora).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });   // do `agora` recebido (não do relógio): em produção é o mesmo dia; nos testes o dia fica fixo
  const lista = [];
  const porSquad = await Promise.all(squads.map(async (sq) => {
    const [cards, meta] = await Promise.all([cardsDoDono(db, sq, init), flowLib.readFlowMeta(db, sq)]);
    return cards.filter((c) => c && !c.archived && !flowLib.isDoneColumn(c.col, meta)).map((c) => ({ sq, c }));
  }));
  porSquad.flat().forEach(({ sq, c }) => { const s = sinaisDoCard(c, { hoje }); lista.push({ squad: sq, id: c.id || null, titulo: corta(s.titulo, 80), prazo: s.prazo, atrasado: s.atrasado, diasAtraso: s.diasAtraso, venceHoje: s.venceHoje, bloqueado: s.bloqueado, semPrazo: s.semPrazo }); });
  const em7 = new Date(Date.parse(hoje + 'T12:00:00Z') + 7 * 86400000).toISOString().slice(0, 10);
  const urgente = (x) => (x.atrasado ? 0 : x.bloqueado ? 1 : x.venceHoje ? 2 : x.prazo && x.prazo <= em7 ? 3 : 9);
  const ordenada = lista.filter((x) => urgente(x) < 9).sort((a, b) => urgente(a) - urgente(b) || (a.prazo || '9999').localeCompare(b.prazo || '9999') || a.titulo.localeCompare(b.titulo));
  return {
    ativos: lista.length, atrasados: lista.filter((x) => x.atrasado).length, venceHoje: lista.filter((x) => x.venceHoje).length,
    bloqueados: lista.filter((x) => x.bloqueado).length, semPrazo: lista.filter((x) => x.semPrazo).length, venceEm7dias: lista.filter((x) => x.prazo && x.prazo > hoje && x.prazo <= em7).length,
    lista: ordenada.slice(0, MAX_CARDS_LISTA), hoje,
  };
}

// ── memo com TTL (instância quente); `relogio` injetável nos testes ─────────────────────────────────────────────────────────────────────────────────────────────────────────
function criarMemo() {
  const m = new Map();
  return async (chave, ttl, agora, fn) => { const c = m.get(chave); if (c && agora - c.t < ttl) return c.v; const v = await fn(); m.set(chave, { t: agora, v }); return v; };
}
const memoGlobal = criarMemo();

async function dadosDoDono({ db, resolverUid }) {
  const uid = await resolverUid();
  if (!uid) return { uid: null, init: null, squads: [] };
  const u = (await db.ref('kanban/usuarios_publicos/' + uid).get()).val() || {};
  const squads = Object.keys(u.squads || {}).filter((s) => u.squads[s] === true).slice(0, MAX_SQUADS);
  return { uid, init: (u.init && String(u.init).trim()) || null, squads };
}

// Pura (db/bucket/relogio injetados). Cada bloco falha sozinho: uma leitura que dá erro vira { estado:'desconhecido' } e não derruba o resto.
async function montarResumo({ db, bucket, agora = Date.now(), resolverUid, memo = memoGlobal }) {
  const seguro = async (fn, padrao) => { try { return await fn(); } catch (e) { console.error('[oceanoResumo]', e && e.message); return padrao; } };
  const dono = await seguro(() => memo('dono', TTL.cards, agora, () => dadosDoDono({ db, resolverUid })), { uid: null, init: null, squads: [] });
  const [vtex, github, firebase, backup, plantao, alarmes, cards, guardiao] = await Promise.all([
    seguro(async () => statusVtex((await db.ref('kanban/vtex_saude').get()).val(), agora), { estado: 'desconhecido', texto: 'erro ao ler' }),
    seguro(async () => statusGithub((await db.ref('kanban/github_saude').get()).val(), agora), { estado: 'desconhecido', texto: 'erro ao ler' }),
    seguro(async () => statusFirebase((await db.ref('kanban/firebase_saude').get()).val(), agora), { estado: 'desconhecido', texto: 'erro ao ler' }),
    seguro(() => memo('backup', TTL.backup, agora, () => resumirBackup({ db, bucket, agora })), { estado: 'desconhecido', texto: 'erro ao ler' }),
    seguro(() => resumirPlantao({ db }), null),
    seguro(() => resumirAlarmes({ db, squads: dono.squads, agora }), null),
    seguro(() => (dono.init && dono.squads.length ? memo('cards', TTL.cards, agora, () => resumirCards({ db, squads: dono.squads, init: dono.init, agora })) : Promise.resolve(null)), null),
    seguro(async () => statusGuardiao((await db.ref('kanban/cards_guardiao/_status').get()).val(), agora), { estado: 'desconhecido', texto: 'erro ao ler', pulsoMin: null, atrasoMin: null, abertos: null }),
  ]);
  const alarmeEstado = alarmes && alarmes.ultimas24h > 0 ? 'atencao' : 'ok';
  const geral = pior(vtex.estado, github.estado, firebase.estado, backup.estado, alarmeEstado, plantao && plantao.escalados > 0 ? 'atencao' : 'ok', guardiao.estado === 'atencao' ? 'atencao' : 'ok');
  return {
    geral, geradoEm: new Date(agora).toISOString(), dono: { iniciais: dono.init, squads: dono.squads.length },
    status: { vtex, github, firebase }, backup, plantao, alarmesSumico: alarmes, guardiao, meusCards: cards,
  };
}

async function dentroDoLimite(db, agora) {
  const hora = new Date(agora).toISOString().slice(0, 13);
  let n = 0;
  await db.ref(`kanban/_oceano_resumo_rate/${hora}`).transaction((c) => { n = (c || 0) + 1; return n; });
  return n <= LIMITE_POR_HORA;
}

let _uidCache = null;
const resolverUidDoDono = async () => { if (!_uidCache) _uidCache = (await getAuth().getUserByEmail(DONO_EMAIL)).uid; return _uidCache; };

exports.oceanoResumo = onRequest(
  { region: 'us-central1', memory: '256MiB', timeoutSeconds: 30, secrets: [OCEANO_RESUMO_KEY] },
  async (req, res) => {
    res.set('Cache-Control', 'no-store'); res.set('Access-Control-Allow-Origin', SITE_ORIGIN); res.set('Vary', 'Origin');
    if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
    if (req.method !== 'GET') { res.status(405).json({ erro: 'método não permitido' }); return; }
    if (!chaveOk(req.query.k, OCEANO_RESUMO_KEY.value())) { res.status(403).json({ erro: 'chave inválida' }); return; }
    try {
      const db = getDatabase(), agora = Date.now();
      if (!(await dentroDoLimite(db, agora))) { res.status(429).json({ erro: 'muitas requisições nesta hora' }); return; }
      const resumo = await memoGlobal('tudo', TTL.tudo, agora, () => montarResumo({ db, bucket: getStorage().bucket(), agora, resolverUid: resolverUidDoDono }));
      res.status(200).json(resumo);
    } catch (e) { console.error('[oceanoResumo]', e); res.status(500).json({ erro: 'erro no servidor' }); }
  }
);
Object.assign(exports, { montarResumo, statusVtex, statusGithub, statusFirebase, resumirCards, resumirAlarmes, statusGuardiao, resumirPlantao, criarMemo, dentroDoLimite, DONO_EMAIL, LIMITE_POR_HORA, TTL });
