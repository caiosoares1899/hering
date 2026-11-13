// functions/gantt/avisos.js
//
// 🔔 Avisos de mudança nos calendários do Gantt (13/11/2026, pedido do Caio: "notificar quando tiver uma mudança no gantt — a pessoa se
// cadastra pra receber", com push no celular).
//
// Quem se inscreve: kanban/gantt_inscritos(_dev)/{cal}/{uid} = { em, onde:'mare'|'radar' } — gravado pela própria pessoa (regras: só o
// próprio uid, Google @ciahering), pelo botão 🔔 do Gantt no Maré ou no Radar.
// Gatilho: cada publicação (ou volta de versão) grava UMA linha em kanban/calendarios_gantt_hist(_dev)/{cal}/{id} — as regras garantem
// que `porUid` é quem gravou. A função manda um aviso (tipo `gantt_cal`) pra cada inscrito daquele calendário, menos o próprio autor.
// O push sai do sendPushOnNotification (gantt_cal está no PUSH_TYPES) e o clique abre o Gantt naquele calendário, na página onde a pessoa
// se inscreveu (common/pushUrl.js).
//
// Cuidados: id determinístico (gantt_<cal>_<histId>) gravado por transação — retry da função não duplica. Destinatário conferido no CADASTRO
// DE LOGIN (Auth: existe, e-mail da empresa, provedor Google) e com registro em usuarios/{uid} — senão NÃO recebe (gravar em
// usuarios/{uid}/notificacoes recriaria um usuarios/{uid} órfão) e a inscrição dele é apagada. O nome de quem atualizou vem de
// usuarios_publicos/{porUid}/nome (o porNome da linha é texto livre: só reserva).
// Deploy (regras primeiro): firebase deploy --only database ; depois
//   firebase deploy --only functions:ganttAvisoMudanca,functions:ganttAvisoMudancaDev,functions:sendPushOnNotification
const { onValueCreated } = require('firebase-functions/v2/database');
const { getDatabase } = require('firebase-admin/database');
const { getAuth } = require('firebase-admin/auth');
const { emailDaEmpresa } = require('../common/mareModo');

const CALS = { marca: 'Calendário de Marca', comercial: 'Comercial Hering', mktplace: 'Comercial Marketplace', outlet: 'Comercial Outlet' };
const TIPO = 'gantt_cal';

const limpa = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);
// Data/hora no fuso de Brasília (o servidor roda em UTC)
function quando(ms) {
  if (!Number.isFinite(ms)) return '';
  const f = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  return f.format(new Date(ms)).replace(',', ' às');
}
// Texto do aviso a partir da linha do histórico
function textoDoAviso(cal, h) {
  const nome = CALS[cal];
  const quem = limpa(h.porNome, 60) || 'Alguém';
  if (h.acao === 'restaurou') {
    return { title: ('📊 ' + nome + ' voltou para uma versão anterior').slice(0, 120), sub: (quem + ' voltou para a versão de ' + (quando(Number(h.deEm)) || 'antes')).slice(0, 140) };
  }
  const n = (k) => Math.max(0, Number(h[k]) || 0);
  const partes = [];
  if (n('novas')) partes.push('＋' + n('novas'));
  if (n('mudaram')) partes.push('✎' + n('mudaram'));
  if (n('saem')) partes.push('−' + n('saem'));
  const arq = limpa(h.arquivo, 60);
  return { title: ('📊 ' + nome + ' atualizado').slice(0, 120), sub: (quem + (partes.length ? ' · ' + partes.join(' ') : ' · sem mudança nas ações') + (arq ? ' · ' + arq : '')).slice(0, 140) };
}

// Handler (testável): cal, id da linha do histórico, a linha, e se é o ambiente de testes (_dev)
// A pessoa ainda pode receber? (existe no login, é da empresa pelo Google e tem registro no Maré)
async function podeReceber(db, auth, uid) {
  let u = null;
  try { u = await auth.getUser(uid); } catch (e) { if (e && e.code === 'auth/user-not-found') return false; throw e; }
  const google = (u.providerData || []).some((p) => p && p.providerId === 'google.com');
  if (!u || u.disabled || !emailDaEmpresa(u.email) || !google) return false;
  return (await db.ref(`kanban/usuarios/${uid}`).get()).exists();
}

async function avisarMudanca({ db, auth, cal, histId, h, dev, agora }) {
  if (!CALS[cal] || !h || typeof h !== 'object') return { enviados: 0, motivo: 'linha inválida' };
  auth = auth || getAuth();
  const suf = dev ? '_dev' : '';
  const inscritos = (await db.ref(`kanban/gantt_inscritos${suf}/${cal}`).get()).val() || {};
  const autor = String(h.porUid || '');
  // nome real de quem publicou (porNome é texto livre na linha — qualquer um da Hering poderia escrever o nome de outra pessoa)
  const nomeReal = autor ? (await db.ref(`kanban/usuarios_publicos/${autor}/nome`).get()).val() : null;
  const { title, sub } = textoDoAviso(cal, Object.assign({}, h, nomeReal ? { porNome: nomeReal } : {}));
  const id = `gantt_${cal}_${String(histId).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 60)}`;
  const ts = new Date(agora || Date.now()).toISOString();
  let enviados = 0, removidos = 0;
  for (const [uid, insc] of Object.entries(inscritos)) {
    if (!uid || uid === autor || !insc) continue;
    // destinatário ainda pode receber? (senão: não grava — evitaria recriar um usuarios/{uid} órfão — e limpa a inscrição)
    if (!(await podeReceber(db, auth, uid))) { await db.ref(`kanban/gantt_inscritos${suf}/${cal}/${uid}`).remove(); removidos++; continue; }
    const ref = db.ref(`kanban/usuarios/${uid}/notificacoes/${id}`);
    const onde = insc.onde === 'radar' ? 'radar' : 'mare';
    // transação: retry da função (ou dois disparos) nunca duplica — só grava se ainda não existe
    const r = await ref.transaction((atual) => (atual ? undefined : { id, type: TIPO, title, sub, cal, onde, dev: !!dev, read: false, ts }));
    if (r && r.committed) enviados++;
  }
  console.log(`[ganttAviso] ${cal}${suf} ${histId}: ${enviados} aviso(s), ${removidos} inscrição(ões) removida(s)`);
  return { enviados, removidos };
}

const handler = (dev) => async (event) => {
  const { cal, histId } = event.params;
  await avisarMudanca({ db: getDatabase(), cal, histId, h: event.data.val(), dev });
};

exports.ganttAvisoMudanca = onValueCreated({ ref: '/kanban/calendarios_gantt_hist/{cal}/{histId}', region: 'us-central1' }, handler(false));
exports.ganttAvisoMudancaDev = onValueCreated({ ref: '/kanban/calendarios_gantt_hist_dev/{cal}/{histId}', region: 'us-central1' }, handler(true));
exports._test = { avisarMudanca, podeReceber, textoDoAviso, quando, CALS, TIPO };
