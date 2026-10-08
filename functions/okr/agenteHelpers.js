// functions/okr/agenteHelpers.js
//
// Helpers compartilhados pelas ferramentas do Agente Ágil no domínio OKR
// (ver agenteTools.js) — resolução de Objetivo por id/título, checagem de
// permissão (mesma regra de _okrCanEdit()/_okrCanCreate() do painel.html) e
// registro de Histórico (mesmo formato {who,uid,what,tipo,at} que
// painel.html já grava pra edição humana — ver OKR_HIST_TIPOS/
// _okrRecordHistory() lá).

const AGENTE_UID = 'agente-agil'; // mesmo uid que o resto do orquestrador usa (mentionTrigger.js)
const AGENTE_NOME = '🤖 Agente Ágil';
const DEFAULT_ADM_EMAILS = ['caio.soares@ciahering.com.br', 'rafael.passos@ciahering.com.br'];
const OKR_HIST_CAP = 80;

// ── Torres (2026-10-07) ──────────────────────────────────────────────────────────────────────────────────────────────
// O OKR passou a ter 3 torres; o Objetivo guarda `torre` (sem o campo = Digital, mesma regra de _okrTorreDe() em okr-dev.html). A PESSOA também tem torre
// (`kanban/usuarios/{uid}/torre`; 'geral' = ADMs de OKR, que atuam em todas) e as gerências são configuráveis por torre (kanban/okr/gerencias/{torre}/{id}).
// Modo "só Hering" (common/mareModo.js): TORRES_ATIVAS = ['digital']; desligado = as 3 de sempre.
const { TORRES_ATIVAS, torreAtiva } = require('../common/mareModo');
const TORRES = TORRES_ATIVAS;
const TORRE_PADRAO = 'digital';
const TORRE_INFO = { digital: { icon: '🛒', label: 'Digital' }, comercial: { icon: '🛍️', label: 'Comercial' }, corporativa: { icon: '🏛️', label: 'Corporativa' } };
const torreValida = (t) => TORRES.includes(t);
const torreDe = (o) => (o && torreValida(o.torre) ? o.torre : TORRE_PADRAO);

// Padrão de cada torre enquanto ninguém configurou nada em kanban/okr/gerencias (espelho de OKR_GERENCIAS_POR_TORRE em okr-dev.html).
const GERENCIAS_PADRAO = {
  digital: [
    { id: 'geral', label: 'Geral' }, { id: 'comercial', label: 'Comercial' }, { id: 'performance', label: 'Marketing de Performance' },
    { id: 'dadosia', label: 'Dados e IA' }, { id: 'cx', label: 'CX' }, { id: 'tech', label: 'Tech' }, { id: 'crm', label: 'CRM' },
  ],
  comercial: [{ id: 'geral', label: 'Geral' }],
  corporativa: [{ id: 'geral', label: 'Geral' }],
};

// Gerências de uma torre a partir do que já foi lido de kanban/okr/gerencias (objeto inteiro): [{id, label, oculta}] na ordem da tela.
// Mesma regra de _okrGerenciasBase(): config da torre vazia → vale o padrão.
function gerenciasDeCfg(cfgTodas, torre) {
  const t = torreValida(torre) ? torre : TORRE_PADRAO;
  const cfg = cfgTodas && cfgTodas[t];
  const ids = cfg && typeof cfg === 'object' ? Object.keys(cfg).filter((id) => cfg[id] && typeof cfg[id] === 'object' && cfg[id].label) : [];
  if (!ids.length) return GERENCIAS_PADRAO[t].map((g) => ({ ...g, oculta: false }));
  return ids
    .map((id) => ({ id, label: String(cfg[id].label), oculta: !!cfg[id].oculta, ordem: Number(cfg[id].ordem) }))
    .sort((a, b) => (isFinite(a.ordem) ? a.ordem : 1e9) - (isFinite(b.ordem) ? b.ordem : 1e9) || a.label.localeCompare(b.label))
    .map(({ ordem, ...g }) => g);
}
async function gerenciasDaTorre(db, torre) {
  const snap = await db.ref('kanban/okr/gerencias').get();
  return gerenciasDeCfg(snap.val() || {}, torre);
}
const rotuloGerencia = (cfgTodas, torre, id) => (gerenciasDeCfg(cfgTodas, torre).find((g) => g.id === id) || { label: id || 'Geral' }).label;

async function isAdmUid(db, uid) {
  if (!uid) return false;
  const [userSnap, admSnap] = await Promise.all([
    db.ref('kanban/usuarios/' + uid + '/email').get(),
    db.ref('kanban/config/adm_emails').get(),
  ]);
  const email = String(userSnap.val() || '').toLowerCase();
  if (!email) return false;
  const admEmails = (Array.isArray(admSnap.val()) ? admSnap.val() : DEFAULT_ADM_EMAILS).map((e) => String(e).toLowerCase());
  return admEmails.includes(email);
}

// O que a regra "por torre" precisa saber da pessoa (campos de kanban/usuarios/{uid}; lê só eles, o nó inteiro carrega notificações).
async function infoUsuario(db, uid) {
  if (!uid) return { poOrg: false, gestor: false, torre: TORRE_PADRAO, geral: false };
  const [role, squadsRoles, torre, gestor] = await Promise.all(
    ['role', 'squads_roles', 'torre', 'gestorOkr'].map((k) => db.ref('kanban/usuarios/' + uid + '/' + k).get().then((s) => s.val()))
  );
  const poOrg = role === 'po' || role === 'organizador' || !!(squadsRoles && typeof squadsRoles === 'object' && Object.values(squadsRoles).some((r) => r === 'po' || r === 'organizador'));
  return { poOrg, gestor: !!gestor, geral: torre === 'geral', torre: torreValida(torre) ? torre : TORRE_PADRAO };
}
// PO/Organizador de algum squad ou 🎯 Gestor OKR, na PRÓPRIA torre (ou torre ⭐ Geral, que vale em todas). Espelho de _okrCanEdit/_okrCanCreate (okr-dev.html).
async function podeAtuarNaTorre(db, uid, torre) {
  const u = await infoUsuario(db, uid);
  return (u.geral || u.torre === torre) && (u.poOrg || u.gestor);
}

// Mesma regra de _okrCanEdit() (okr-dev.html): ADM, Responsável do Objetivo, ou PO/Organizador/Gestor OKR da torre do Objetivo.
async function canEditObjetivo(db, uid, objetivo) {
  if (await isAdmUid(db, uid)) return true;
  if (objetivo && Array.isArray(objetivo.responsaveis) && objetivo.responsaveis.includes(uid)) return true;
  return podeAtuarNaTorre(db, uid, torreDe(objetivo));
}
// Mesma regra de _okrCanCreate(torre): ADM, ou PO/Organizador/Gestor OKR da torre.
async function canCreateObjetivo(db, uid, torre) {
  if (await isAdmUid(db, uid)) return true;
  return podeAtuarNaTorre(db, uid, torre);
}
// Torre onde um Objetivo novo nasce quando a pessoa não diz: a dela (a Geral cai em Digital) — espelho de _okrTorreParaCriar().
async function torreParaCriar(db, uid) {
  const u = await infoUsuario(db, uid);
  return u.geral ? TORRE_PADRAO : u.torre;
}

// 🔒 Trava de edição do Objetivo (kanban/okr/obj_locks/{id} = {uid, who, ts}, renovada a cada ~60 s por quem está com o modal aberto; velha = 10 min).
// Quem está editando salva o documento inteiro: uma escrita do agente no meio seria sobrescrita em silêncio. Mesma regra das ações rápidas do painel:
// trava viva de OUTRA pessoa bloqueia (a trava da própria pessoa que está pedindo não conta).
const OKR_LOCK_STALE_MS = 10 * 60 * 1000;
async function travaDeOutro(db, objetivoId, requestingUid) {
  const l = (await db.ref('kanban/okr/obj_locks/' + objetivoId).get()).val();
  return l && l.ts && Date.now() - l.ts < OKR_LOCK_STALE_MS && l.uid !== requestingUid ? l : null;
}
const msgTrava = (l, titulo) => `${(l && l.who) || 'Alguém'} está editando "${titulo}" agora — tente de novo quando ela(e) fechar a edição.`;

// 🔔 Sino único: eventos "Objetivo criado" / "Marco concluído" vão pro feed da torre (kanban/notif_feed), igual aos ganchos de okr-dev.html (_okrFeedPush).
// O autor é o agente (uid que nunca é o de uma pessoa → aparece pra todo mundo da torre). Nunca derruba a ação principal.
async function publicaFeed(db, { tipo, torres, titulo, sub, extra }) {
  const id = 'f' + Date.now() + Math.random().toString(36).slice(2, 6);
  const dado = { id, tipo, torres, titulo: String(titulo || ''), sub: String(sub || ''), autorUid: AGENTE_UID, autor: AGENTE_NOME, ts: new Date().toISOString(), ...(extra || {}) };
  Object.keys(dado).forEach((k) => { if (dado[k] === undefined) delete dado[k]; });
  try { await db.ref('kanban/notif_feed/' + id).set(dado); } catch (e) { console.error('[okr agente] feed falhou:', e); }
}

// Resolve um Objetivo por id OU por título (busca exata case-insensitive
// primeiro; se não achar, tenta substring — só aceita se achar EXATAMENTE 1,
// pra nunca editar o Objetivo errado por ambiguidade). Nunca resolve
// arquivado — mesma regra que o painel já aplica em toda leitura "ativa".
async function resolveObjetivo(db, { objetivo_id, titulo } = {}) {
  const snap = await db.ref('kanban/okr/objetivos').get();
  const todos = snap.val() || {};
  if (objetivo_id) {
    const o = todos[objetivo_id];
    if (o && !o.arquivado && torreAtiva(o.torre)) return { id: objetivo_id, objetivo: o };
    return { error: 'objetivo_nao_encontrado', message: `Nenhum Objetivo ativo com id "${objetivo_id}".` };
  }
  if (!titulo) return { error: 'faltou_referencia', message: 'Preciso do id ou do título do Objetivo.' };
  const ativos = Object.entries(todos).filter(([, o]) => o && !o.arquivado && torreAtiva(o.torre));
  const alvo = String(titulo).toLowerCase().trim();
  const exatos = ativos.filter(([, o]) => String(o.titulo || '').toLowerCase().trim() === alvo);
  if (exatos.length === 1) return { id: exatos[0][0], objetivo: exatos[0][1] };
  if (exatos.length > 1) return { error: 'titulo_ambiguo', message: `Mais de um Objetivo ativo se chama "${titulo}" — preciso do id exato.` };
  const parciais = ativos.filter(([, o]) => String(o.titulo || '').toLowerCase().includes(alvo));
  if (parciais.length === 1) return { id: parciais[0][0], objetivo: parciais[0][1] };
  if (parciais.length > 1) {
    const opcoes = parciais.map(([, o]) => `"${o.titulo}"`).join(', ');
    return { error: 'titulo_ambiguo', message: `Mais de um Objetivo ativo bate com "${titulo}": ${opcoes} — seja mais específico.` };
  }
  return { error: 'objetivo_nao_encontrado', message: `Nenhum Objetivo ativo encontrado com título parecido com "${titulo}". Use listar_objetivos pra ver os que existem.` };
}

async function pushHistory(db, path, { what, tipo }) {
  const snap = await db.ref(path + '/history').get();
  const hist = Array.isArray(snap.val()) ? snap.val() : [];
  hist.push({ who: AGENTE_NOME, uid: AGENTE_UID, what, tipo: tipo || 'campo', at: new Date().toISOString() });
  const capped = hist.length > OKR_HIST_CAP ? hist.slice(-OKR_HIST_CAP) : hist;
  await db.ref(path + '/history').set(capped);
}

// Achado real de /monitorarbugs (2026-09-05, técnica 1 — comparar caminhos
// paralelos pra mesma mutação): no painel, saveOkrObjetivo()/saveOkrMarco()
// SEMPRE chamam _okrNotifyEditado() depois de gravar — notifica
// responsaveis do Objetivo + participantes de qualquer Marco dele
// (type:'okr_editado', no PUSH_TYPES). Os 3 handlers de escrita do Agente
// Ágil (editar_campos_okr/criar_marco/editar_marco, ver agenteTools.js)
// nunca chamavam nada equivalente — a Responsável de um Objetivo nunca
// ficava sabendo que ele mudou, se a mudança viesse via chat em vez da
// tela. `actingUid` é excluído dos alvos, mesmo comportamento do painel
// (quem editou não precisa ser notificado da própria edição).
async function notifyObjetivoEditado(db, objetivoId, actingUid) {
  const [objSnap, marcosSnap] = await Promise.all([
    db.ref('kanban/okr/objetivos/' + objetivoId).get(),
    db.ref('kanban/okr/marcos').get(),
  ]);
  const obj = objSnap.val();
  if (!obj) return;
  const alvos = new Set(Array.isArray(obj.responsaveis) ? obj.responsaveis : []);
  const marcos = marcosSnap.val() || {};
  Object.values(marcos).forEach((m) => {
    if (m && m.objetivoId === objetivoId && Array.isArray(m.participantes)) {
      m.participantes.forEach((uid) => alvos.add(uid));
    }
  });
  alvos.delete(actingUid);
  await Promise.all(
    [...alvos].map((uid) => {
      const id = 'n' + Date.now() + Math.random().toString(36).slice(2, 6);
      return db
        .ref('kanban/usuarios/' + uid + '/notificacoes/' + id)
        .set({
          id,
          type: 'okr_editado',
          title: `🎯 "${obj.titulo}" foi editado`,
          sub: 'Pedido via chat do Agente Ágil',
          okrObjId: objetivoId,
          read: false,
          ts: new Date().toISOString(),
        })
        .catch(() => {});
    })
  );
}

module.exports = {
  AGENTE_UID, AGENTE_NOME, DEFAULT_ADM_EMAILS, isAdmUid, canEditObjetivo, canCreateObjetivo, torreParaCriar, infoUsuario, resolveObjetivo, pushHistory, notifyObjetivoEditado,
  TORRES, TORRE_PADRAO, TORRE_INFO, torreValida, torreDe, torreAtiva, GERENCIAS_PADRAO, gerenciasDeCfg, gerenciasDaTorre, rotuloGerencia,
  OKR_LOCK_STALE_MS, travaDeOutro, msgTrava, publicaFeed,
};
