// functions/oceano/conchaAvisos.js
//
// 🐚 Concha — aviso de mensagem nova, estilo WhatsApp (25/11/2026). Desenho: docs/ideias/cardume-v0-banco.md › "Avisos de mensagem nova".
// Gatilho: kanban/cardume/msgs/{canal}/{msgId} criada. Push DIRETO para os membros (sem gravar em kanban/usuarios/.../notificacoes,
// que a empresa toda lê). Para cada membro, decide pela preferência PRIVADA dele:
//   kanban/cardume/avisos/{uid}/{canal} = {nivel:'mencoes'|'nada', ate?}   (sem nó, ou `ate` vencido = 🔔 todas — o padrão)
//   kanban/cardume/seguidas/{uid}/{tag} = ts                                (#tags seguidas: avisam mesmo com o canal em 🔕)
//   kanban/cardume/vendo/{uid}/{canal}  = ts                                (sinal de vida da conversa aberta: não avisa quem está vendo)
//   kanban/cardume/avisos_a/{uid}/{canal}/{aid} = {nivel:'seguir'|'mencoes', ate?}   (🧵 assunto: 🔔 seguir avisa mesmo com o canal em 🔕;
//                                                    🔕 silenciar deixa só @menção e #tag seguida; sem nó = como o canal)
// Quem recebe a @menção ou a resposta já tem o push dela (sendPushOnNotification + cardumePush): aqui pula, com o MESMO leitor de menção.
// Trava por canal (kanban/cardume/aviso_env/{uid}/{canal}, fechado nas regras): 1 push de "todas" a cada 2 min — o iPhone não junta pela tag.
// Mensagem com mais de 2 min (restauração do 🛟 backup recria mensagens velhas) e canal vencido não avisam ninguém.
// Texto (decisão do Caio, 25/11): "🐚 Ana em # Dados" / "#blackfriday" — sem trecho; canal temático só de convidados vira "num canal privado".
// Deploy isolado: firebase deploy --only functions:conchaAvisoMsg
const { SITE_BASE_URL } = require('../common/pushUrl');
const { lerConfigTipo, pushPermitido } = require('../common/notifConfig');
const { tokenMorto, resumirFalhas } = require('../common/pushTokens');
const { emailDaEmpresa } = require('../common/mareModo');
const { mencionadosNoTexto } = require('../common/cardumePush');

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const IDADE_MAX_MS = 2 * 60 * 1000;
const VENDO_MS = 70 * 1000;          // a página renova a cada 30 s
const INTERVALO_MS = 2 * 60 * 1000;  // trava de "todas" por canal e pessoa
const NIVEIS = new Set(['mencoes', 'nada']);
const NIVEIS_A = new Set(['seguir', 'mencoes']);
const AID_RE = /^a[a-z0-9]{1,20}$/;

// #tags — o MESMO critério da página (cardume-dev.html › tagsEm): # depois de início/espaço/parêntese/marcação, 2–32 letras/números/_/-,
// pelo menos uma letra, fora de código e de link; chave em minúsculas como escrita; até 10.
function tagsEm(txt) {
  const limpo = String(txt || '').replace(/```[\s\S]*?(```|$)/g, ' ').replace(/`[^`\n]*`/g, ' ').replace(/https:\/\/[^\s<>"']+/g, ' ');
  const out = new Set(), re = /(?:^|(?<=[\s(*_~>]))#([\p{L}\p{N}_-]{2,32})(?![\p{L}\p{N}_-])/gu; let m;
  while ((m = re.exec(limpo)) && out.size < 10) { const k = m[1].toLowerCase(); if (/\p{L}/u.test(k)) out.add(k); }
  return [...out];
}

// Nível vigente de uma preferência (ausente, estranha ou com `ate` vencido = 'todas').
function nivelDe(pref, agora) {
  if (!pref || typeof pref !== 'object' || !NIVEIS.has(pref.nivel)) return 'todas';
  if (pref.ate != null && !(typeof pref.ate === 'number' && pref.ate > agora)) return 'todas';
  return pref.nivel;
}

// Nível do assunto (ausente, estranho ou vencido = 'canal').
function nivelAssuntoDe(pref, agora) {
  if (!pref || typeof pref !== 'object' || !NIVEIS_A.has(pref.nivel)) return 'canal';
  if (pref.ate != null && !(typeof pref.ate === 'number' && pref.ate > agora)) return 'canal';
  return pref.nivel;
}

// Decide para UMA pessoa (pura, para teste). Ordem: autor → menção/resposta → 🚫 nada do canal → assunto (🔕 silenciado sem tag seguida;
// 🔔 seguido fura o 🔕 do canal) → 🔕 do canal sem tag seguida → vendo → DND → fora da empresa → trava.
// Devolve { envia, motivo, tags } (tags = as seguidas que aparecem na mensagem).
function decidir({ uid, autor, mencionados, pref, prefAssunto, seguidas, vendoTs, dnd, empresa, ultimoEnvio, tagsMsg, agora }) {
  if (uid === autor) return { envia: false, motivo: 'autor' };
  if ((mencionados || []).includes(uid)) return { envia: false, motivo: 'mencao' };
  const nivel = nivelDe(pref, agora), na = nivelAssuntoDe(prefAssunto, agora);
  if (nivel === 'nada') return { envia: false, motivo: 'nada' };
  const tags = (tagsMsg || []).filter((t) => seguidas && seguidas[t] != null);
  if (na === 'mencoes' && !tags.length) return { envia: false, motivo: 'assunto_silenciado' };
  if (na !== 'seguir' && nivel === 'mencoes' && !tags.length) return { envia: false, motivo: 'silenciado' };
  if (typeof vendoTs === 'number' && agora - vendoTs < VENDO_MS) return { envia: false, motivo: 'vendo' };
  if (dnd && dnd.on && (!dnd.until || new Date(dnd.until).getTime() > agora)) return { envia: false, motivo: 'dnd' };
  if (!empresa) return { envia: false, motivo: 'fora' };
  if (!tags.length && typeof ultimoEnvio === 'number' && agora - ultimoEnvio < INTERVALO_MS) return { envia: false, motivo: 'trava' };
  return { envia: true, motivo: tags.length ? 'tag' : na === 'seguir' ? 'assunto' : 'todas', tags };
}

const primeiroNome = (p) => String((p && (p.nome || p.displayName)) || 'Alguém').trim().split(/\s+/)[0] || 'Alguém';
const nomeCompleto = (p) => String((p && (p.nome || p.displayName)) || '').trim();
const canalTxt = (canal, c) => (/^t-/.test(canal) && c && c.acesso === 'convite') ? 'num canal privado' : '# ' + String((c && c.nome) || canal).slice(0, 40);

async function runAvisoMsg(db, messaging, canal, msgId, msg, deps = {}) {
  const agora = deps.agora || Date.now(), log = deps.log || console.log;
  const emailDe = deps.emailDe;   // uid → e-mail do Firebase Auth (confiável; o e-mail de usuarios_publicos a pessoa mesma grava)
  if (!ID_RE.test(canal) || !ID_RE.test(msgId) || !msg || typeof msg !== 'object') return { enviados: 0 };
  if (msg.apagada || typeof msg.ts !== 'number' || !ID_RE.test(String(msg.uid || ''))) return { enviados: 0 };
  if (agora - msg.ts > IDADE_MAX_MS) { log(`[concha-aviso] ${canal}/${msgId}: mensagem com mais de 2 min (restauração?), sem aviso.`); return { enviados: 0 }; }
  if (!pushPermitido(await lerConfigTipo(db, 'cardume_msg'), true)) { log('[concha-aviso] desligado pelo ADM na Central de Notificações.'); return { enviados: 0 }; }
  const [c, membrosV] = await Promise.all([db.ref(`kanban/cardume/canais/${canal}`).get().then((s) => s.val()), db.ref(`kanban/cardume/membros/${canal}`).get().then((s) => s.val() || {})]);
  if (/^t-/.test(canal) && !c) return { enviados: 0 };
  if (c && typeof c.fim === 'number' && c.fim <= agora) return { enviados: 0 };
  const membros = Object.keys(membrosV).filter((u) => membrosV[u] === true && ID_RE.test(u));
  if (!membros.includes(msg.uid)) return { enviados: 0 };
  const pubs = Object.fromEntries(await Promise.all(membros.map((u) => db.ref(`kanban/usuarios_publicos/${u}`).get().then((s) => [u, s.val() || {}]))));
  // quem já recebe push de @menção ou de resposta (mesmo leitor do cardumePush)
  const nomes = Object.fromEntries(membros.map((u) => [u, nomeCompleto(pubs[u])]).filter(([, n]) => n));
  // ⏩ encaminhada não gera aviso de @menção (a página não grava o registro), então quem aparece mencionado no texto NÃO sai do push normal do canal
  const mencionados = !msg.enc && typeof msg.texto === 'string' ? mencionadosNoTexto(msg.texto, nomes) : [];
  if (typeof msg.resp === 'string' && ID_RE.test(msg.resp)) {
    const orig = (await db.ref(`kanban/cardume/msgs/${canal}/${msg.resp}`).get()).val();
    if (orig && typeof orig.uid === 'string') mencionados.push(orig.uid);
  }
  const tagsMsg = tagsEm(msg.texto);
  const aid = typeof msg.a === 'string' && AID_RE.test(msg.a) ? msg.a : '';
  const ass = aid ? (await db.ref(`kanban/cardume/assuntos/${canal}/${aid}`).get()).val() : null;
  const privado = /^t-/.test(canal) && c && c.acesso === 'convite';
  const nomeAss = ass && typeof ass.n === 'string' ? (ass.n.length > 30 ? ass.n.slice(0, 29) + '…' : ass.n) : '';
  const quem = primeiroNome(pubs[msg.uid]), onde = canalTxt(canal, c) + (nomeAss && !privado ? ' › ' + nomeAss : '');
  const url = SITE_BASE_URL + 'cardume-dev.html?c=' + encodeURIComponent(canal) + (aid ? '&a=' + aid : '') + '&m=' + encodeURIComponent(msgId);
  let enviados = 0;
  await Promise.all(membros.filter((u) => u !== msg.uid).map(async (uid) => {
    try {
      const tokObj = (await db.ref(`kanban/usuarios/${uid}/fcm_tokens`).get()).val();
      const entries = Object.entries(tokObj || {}).filter(([, t]) => t && t.token);
      if (!entries.length) return;                                   // nunca ativou push
      const [pref, prefAssunto, seguidas, vendoTs, dnd, ultimoEnvio, email] = await Promise.all([
        db.ref(`kanban/cardume/avisos/${uid}/${canal}`).get().then((s) => s.val()),
        aid ? db.ref(`kanban/cardume/avisos_a/${uid}/${canal}/${aid}`).get().then((s) => s.val()) : null,
        tagsMsg.length ? db.ref(`kanban/cardume/seguidas/${uid}`).get().then((s) => s.val() || {}) : {},
        db.ref(`kanban/cardume/vendo/${uid}/${canal}`).get().then((s) => s.val()),
        db.ref(`kanban/usuarios/${uid}/notif_prefs/dnd`).get().then((s) => s.val()),
        db.ref(`kanban/cardume/aviso_env/${uid}/${canal}`).get().then((s) => s.val()),
        emailDe ? emailDe(uid) : Promise.resolve(''),
      ]);
      const d = decidir({ uid, autor: msg.uid, mencionados, pref, prefAssunto, seguidas, vendoTs, dnd, empresa: emailDaEmpresa(String(email || '').toLowerCase()), ultimoEnvio, tagsMsg, agora });
      if (!d.envia) return;
      if (d.motivo === 'todas' || d.motivo === 'assunto') {   // trava por canal: só a primeira de uma rajada leva o push
        const r = await db.ref(`kanban/cardume/aviso_env/${uid}/${canal}`).transaction((v) => (typeof v === 'number' && agora - v < INTERVALO_MS ? undefined : agora));
        if (!r || !r.committed) return;
      }
      const title = '🐚 ' + quem + ' ' + (d.tags.length ? 'usou #' + d.tags[0] + ' ' : '') + (onde === 'num canal privado' ? onde : 'em ' + onde);
      const body = d.tags.length ? 'Você segue #' + d.tags.join(', #') : d.motivo === 'assunto' ? (privado ? 'Num assunto que você segue' : 'Você segue o assunto') : 'Nova mensagem na Concha';
      const resp = await messaging.sendEachForMulticast({ data: { title, body, tag: 'concha-' + canal, cardId: '', url }, tokens: entries.map(([, t]) => t.token) });
      enviados += resp.successCount;
      if (resp.failureCount) log(`[concha-aviso] ${uid}: falhas ${JSON.stringify(resumirFalhas(resp.responses))}`);
      const mortos = []; resp.responses.forEach((r, i) => { if (!r.success && tokenMorto(r.error)) mortos.push(db.ref(`kanban/usuarios/${uid}/fcm_tokens/${entries[i][0]}`).remove()); });
      if (mortos.length) await Promise.all(mortos);
    } catch (e) { log(`[concha-aviso] ${uid}: falhou (${e && e.message})`); }
  }));
  log(`[concha-aviso] ${canal}/${msgId}: ${enviados} push(es).`);
  return { enviados };
}

function criaTrigger() {
  const { onValueCreated } = require('firebase-functions/v2/database');
  const { getDatabase } = require('firebase-admin/database');
  const { getMessaging } = require('firebase-admin/messaging');
  const { getAuth } = require('firebase-admin/auth');
  const cache = new Map();   // uid → { email, em } (10 min por instância)
  const emailDe = async (uid) => {
    const x = cache.get(uid); if (x && Date.now() - x.em < 600000) return x.email;
    let email = ''; try { email = (await getAuth().getUser(uid)).email || ''; } catch (e) { email = ''; }
    cache.set(uid, { email, em: Date.now() }); return email;
  };
  return onValueCreated({ ref: '/kanban/cardume/msgs/{canal}/{msgId}', region: 'us-central1' },
    (event) => runAvisoMsg(getDatabase(), getMessaging(), event.params.canal, event.params.msgId, event.data.val(), { emailDe }));
}

module.exports = { tagsEm, nivelDe, nivelAssuntoDe, decidir, runAvisoMsg, criaTrigger, IDADE_MAX_MS, VENDO_MS, INTERVALO_MS };
