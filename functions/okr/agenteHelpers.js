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

// Mesma regra de _okrCanEdit() (painel.html): ADM ou responsável do Objetivo.
async function canEditObjetivo(db, uid, objetivo) {
  if (await isAdmUid(db, uid)) return true;
  return !!(objetivo && Array.isArray(objetivo.responsaveis) && objetivo.responsaveis.includes(uid));
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
    if (o && !o.arquivado) return { id: objetivo_id, objetivo: o };
    return { error: 'objetivo_nao_encontrado', message: `Nenhum Objetivo ativo com id "${objetivo_id}".` };
  }
  if (!titulo) return { error: 'faltou_referencia', message: 'Preciso do id ou do título do Objetivo.' };
  const ativos = Object.entries(todos).filter(([, o]) => o && !o.arquivado);
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

module.exports = { AGENTE_UID, AGENTE_NOME, DEFAULT_ADM_EMAILS, isAdmUid, canEditObjetivo, resolveObjetivo, pushHistory };
