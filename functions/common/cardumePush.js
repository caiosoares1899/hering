// functions/common/cardumePush.js
//
// 🐟 Cardume — prova de origem do push de menção (docs/ideias/cardume-v0-banco.md › Etapa 4).
// As notificações (kanban/usuarios/{uid}/notificacoes) são legíveis por toda a Hering e a regra delas aceita qualquer tipo,
// então uma notificação `cardume_mencao` sozinha NÃO prova nada. Só vira push se:
//  1. existir o registro privado kanban/cardume/mencoes/{uid}/{cardumeRef} apontando para ESTA notificação (`n === notifId`);
//  2. a mensagem do registro (kanban/cardume/msgs/{c}/{m}) for de quem o registro diz (`de`), não estiver apagada, e
//     MENCIONAR DE FATO a pessoa (mesmo critério da tela: nome mais longo entre os membros do canal, fora de código);
//  3. a pessoa ainda for membro do canal.
// O título e o texto do push são montados AQUI (dados confiáveis), nunca os que o navegador gravou na notificação.

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const BORDA_LETRA = /[\p{L}\p{N}]/u;
// Mesmo critério de cardume-dev.html (mencionadosEm): tira código; cada "@…" depois de início, espaço, parêntese ou marcação.
const RE_MENCAO = /(?:^|[\s(*_~>])(@[\p{L}][\p{L}.'-]*(?: [\p{L}][\p{L}.'-]*){0,3})/gu;

// nomes = { uid: 'Nome Completo' } (só membros do canal). Devolve os uids mencionados.
function mencionadosNoTexto(txt, nomes) {
  const limpo = String(txt || '').replace(/```[\s\S]*?(```|$)/g, ' ').replace(/`[^`\n]*`/g, ' ');
  const uids = new Set(); let m;
  RE_MENCAO.lastIndex = 0;
  while ((m = RE_MENCAO.exec(limpo))) {
    const t = m[1].slice(1).toLocaleLowerCase('pt-BR');
    let melhor = null;
    for (const [uid, nome] of Object.entries(nomes || {})) {
      const nl = String(nome || '').toLocaleLowerCase('pt-BR');
      if (nl && t.startsWith(nl) && !BORDA_LETRA.test(t.charAt(nl.length)) && (!melhor || nl.length > melhor.n)) melhor = { uid, n: nl.length };
    }
    if (melhor) uids.add(melhor.uid);
  }
  return [...uids];
}

// O registro nasce no mesmo update da notificação, então o gatilho chega em segundos. Recriar a
// notificação depois (o nó do Sino é legível por toda a Hering) não pode reaproveitar um registro velho.
const FRESCOR_MS = 5 * 60 * 1000;

// rec = registro privado; msg = a mensagem; membros = membros/{c}; nomes = { uid: nome } dos membros.
function mencaoConfere(notif, notifId, uid, rec, msg, membros, nomes, agora = Date.now()) {
  if (!notif || notif.type !== 'cardume_mencao') return false;
  if (!ID_RE.test(String(notif.cardumeRef || '')) || !ID_RE.test(String(notifId || '')) || !ID_RE.test(String(uid || ''))) return false;
  if (!rec || typeof rec !== 'object' || rec.n !== String(notifId) || !ID_RE.test(String(rec.c || '')) || !ID_RE.test(String(rec.m || ''))) return false;
  if (rec.lida || typeof rec.ts !== 'number' || rec.ts > agora + 60000 || agora - rec.ts > FRESCOR_MS) return false;
  if (!msg || msg.apagada || msg.uid !== rec.de || typeof msg.texto !== 'string') return false;
  if (!membros || membros[uid] !== true || membros[rec.de] !== true) return false;
  return mencionadosNoTexto(msg.texto, nomes).includes(uid);
}

const nomeDe = (pub, uid) => String((pub && (pub.nome || pub.displayName)) || '').trim();

// Lê tudo com o Admin SDK e confere. Devolve { ok, title, body } — nunca lança (na dúvida, não manda push).
async function mencaoValida(db, uid, notif, notifId) {
  const nao = { ok: false };
  try {
    if (!ID_RE.test(String(uid || '')) || !notif || !ID_RE.test(String(notif.cardumeRef || ''))) return nao;
    const rec = (await db.ref(`kanban/cardume/mencoes/${uid}/${notif.cardumeRef}`).get()).val();
    if (!rec || !ID_RE.test(String(rec.c || '')) || !ID_RE.test(String(rec.m || '')) || !ID_RE.test(String(rec.de || ''))) return nao;
    const [msg, membros] = await Promise.all([
      db.ref(`kanban/cardume/msgs/${rec.c}/${rec.m}`).get().then(s => s.val()),
      db.ref(`kanban/cardume/membros/${rec.c}`).get().then(s => s.val() || {}),
    ]);
    const uids = Object.keys(membros).filter(u => membros[u] === true && ID_RE.test(u));
    const pubs = await Promise.all(uids.map(u => db.ref(`kanban/usuarios_publicos/${u}`).get().then(s => [u, s.val()])));
    const nomes = Object.fromEntries(pubs.map(([u, p]) => [u, nomeDe(p, u)]).filter(([, n]) => n));
    if (!mencaoConfere(notif, notifId, uid, rec, msg, membros, nomes)) return nao;
    const quem = (nomes[rec.de] || 'Alguém').split(/\s+/)[0];
    return { ok: true, title: '🐟 Cardume', body: quem + ' te mencionou' };
  } catch (e) { return nao; }
}

module.exports = { mencionadosNoTexto, mencaoConfere, mencaoValida, FRESCOR_MS };
