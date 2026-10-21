// functions/vtex/statusVtex.js — 🚨 alerta automático de incidente da VTEX (2026-10-13).
//
// Lê o RSS da página de status da VTEX (https://status.vtex.com/feed.rss, gerado pelo incident.io) a cada 5 minutos e, quando aparece um
// incidente/manutenção EM ANDAMENTO, publica sozinho um Comunicado 🚨 (popup insistente, todas as squads, também no Mural do Oceano) e manda
// uma notificação (sino + push) pra todo mundo. Quando a VTEX marca como resolvido/concluído, o Comunicado é desativado.
//
// Formato real do feed (conferido em 13/10/2026): cada <item> é um incidente; `guid` = id estável do incidente (ULID); `title` pode começar com
// "Maintenance: "; `description` (CDATA/HTML) começa com `<b>Status: X</b>` (X = o estado ATUAL: Investigating · Identified · Monitoring ·
// Scheduled · In progress · Resolved · Complete…), depois o texto e `<b>Affected components</b><ul><li>Nome (Operational)</li>…</ul>`.
// O feed traz ~30 itens do histórico — por isso a 1ª execução NÃO cria nada pra item já encerrado (só reage a incidente aberto e recente).
//
// Estado em `kanban/vtex_status/{guid}` = { comunicadoId, estado, criadoEm, notificadoEm?, fechado? }. Regras:
//   • item aberto e recente → cria/atualiza o Comunicado `vtex_{guid}` (expira em 3 h e é renovado a cada tick: se a função parar, o popup some sozinho);
//   • push/sino: UMA vez por incidente, na 1ª vez que ele fica "urgente" (manutenção só agendada, ainda no futuro, vira aviso comum — sem push — e
//     só vira alerta quando começar);
//   • item resolvido/concluído → Comunicado desativado (`fechado:true`);
//   • se um ADM apagar ou desativar o Comunicado à mão, a função respeita (não recria nem reativa);
//   • item SEM "Status:" legível (formato do feed mudou) é ignorado — nunca vira alerta; feed inteiro sem nenhum Status legível conta como falha do monitor;
//   • o link do item só vale se for de https://status.vtex.com/ (senão cai na home da página de status); um item que falha ao gravar não derruba os outros.
// SAÚDE DO MONITOR: a cada tick grava `kanban/vtex_saude` = { ok, ultimoOkEm, abertos, incidentes:[{titulo,link,estado}], falhasSeguidas } (lido pelo selinho
// do Oceano: "VTEX ok" · "incidente" · "monitor sem resposta"). Feed fora do ar / vazio / formato mudado por LIMITE_FALHAS ticks seguidos (≈ 1 h) →
// notificação `vtex_monitor_falhou` (sino + push) pros ADMs, uma vez por queda — sem isso o selinho/avisos ficariam calados sem ninguém saber.
// TRADUÇÃO (21/10/2026): título e resumo são traduzidos pro português (traduzir.js, Google Cloud Translation), com cache em `vtex_status/{guid}.trad` (só chama a API quando o texto muda)
// e o original em inglês fica num "Ver original" dentro do mesmo aviso. Falhou/desligado → o aviso sai em inglês, como antes (o alerta nunca espera tradução).
// Interruptores: `kanban/config/vtex_status_off === true` (tudo) e `kanban/config/vtex_traducao_off === true` (só a tradução). Deploy isolado: firebase deploy --only functions:vtexStatus
//   (e `sendPushOnNotification`, por causa do tipo novo `vtex_incidente` em PUSH_TYPES).

const { onSchedule } = require('firebase-functions/v2/scheduler');
const { getDatabase } = require('firebase-admin/database');
const crypto = require('crypto');
const traducao = require('./traduzir');

const FEED_URL = 'https://status.vtex.com/feed.rss';
const SITE = 'https://status.vtex.com/';
const IDADE_MAX_MS = 7 * 24 * 3600 * 1000;      // item aberto há mais que isso = lixo do feed, ignora
const EXPIRA_MS = 3 * 3600 * 1000;               // o Comunicado se auto-expira se a função parar de renová-lo
const TIPO_NOTIF = 'vtex_incidente';
const TIPO_MONITOR = 'vtex_monitor_falhou';
const LIMITE_FALHAS = 12;                        // 12 ticks de 5 min ≈ 1 h sem conseguir ler o feed

// Estados finais (o incidente acabou) e "só agendado" (ainda não começou). Todo o resto = em andamento.
const FINAIS = /^(resolved|complete|completed|cancelled|canceled|postmortem|resolvido|conclu[ií]d[oa]|cancelad[oa])$/i;
const AGENDADOS = /^(scheduled|planned|upcoming|agendad[oa]|programad[oa])$/i;
const ROTULO_PT = {
  investigating: 'Investigando', identified: 'Causa identificada', monitoring: 'Monitorando', 'in progress': 'Em andamento', 'under maintenance': 'Em manutenção',
  scheduled: 'Agendada', resolved: 'Resolvido', complete: 'Concluída', completed: 'Concluída', update: 'Atualização', degraded: 'Desempenho degradado',
};

// ── parser do RSS (sem dependência: o formato é simples e estável) ──
function decodeEntidades(s) {
  return String(s || '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, '&');
}
// O feed às vezes chega com UTF-8 "dobrado" (â€“ no lugar de –, Â no lugar de nada): conserta o que aparece de verdade.
function limpaMojibake(s) {
  return String(s || '').replace(/â€“/g, '–').replace(/â€”/g, '—').replace(/â€™/g, '’').replace(/â€œ|â€\u009d|â€/g, '"').replace(/Â ?/g, '').replace(/ /g, ' ');
}
function tag(bloco, nome) {
  const m = new RegExp('<' + nome + '(?:\\s[^>]*)?>([\\s\\S]*?)</' + nome + '>', 'i').exec(bloco);
  if (!m) return '';
  const cd = /^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/.exec(m[1]);
  return cd ? cd[1] : decodeEntidades(m[1]);
}
function htmlParaTexto(html) {
  return decodeEntidades(String(html || '').replace(/<\s*br\s*\/?>/gi, '\n').replace(/<\/li>/gi, '\n').replace(/<\/(p|ul)>/gi, '\n').replace(/<[^>]+>/g, ''))
    .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

// Devolve [{ guid, titulo, link, publicadoEm(ms), estado, corpoTexto, componentes:[{nome,estado}], manutencao }]
function parseFeed(xml) {
  const itens = [];
  const re = /<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi;
  let m;
  while ((m = re.exec(String(xml || '')))) {
    const b = m[1];
    const guid = tag(b, 'guid').trim() || tag(b, 'link').trim();
    if (!guid) continue;
    const desc = tag(b, 'description') || tag(b, 'content:encoded');
    const titulo = limpaMojibake(tag(b, 'title')).trim();
    const sm = /<b>\s*Status:\s*([^<]+?)\s*<\/b>/i.exec(desc);
    // Separa "Affected components" do resto do texto.
    const partes = desc.split(/<b>\s*Affected components\s*<\/b>/i);
    const componentes = [];
    const lis = /<li>([\s\S]*?)<\/li>/gi;
    let l;
    while ((l = lis.exec(partes[1] || ''))) {
      const t = limpaMojibake(htmlParaTexto(l[1]));
      const cm = /^(.*?)\s*\(([^)]*)\)\s*$/.exec(t);
      componentes.push(cm ? { nome: cm[1].trim(), estado: cm[2].trim() } : { nome: t, estado: '' });
    }
    const corpoTexto = limpaMojibake(htmlParaTexto((partes[0] || '').replace(/<b>\s*Status:[^<]*<\/b>/i, '')));
    const pub = Date.parse(tag(b, 'pubDate'));
    itens.push({
      guid, titulo, link: linkSeguro(tag(b, 'link').trim().replace(/([^:])\/\/+/g, '$1/')), publicadoEm: Number.isFinite(pub) ? pub : null,
      estado: sm ? limpaMojibake(sm[1]).trim() : '', corpoTexto, componentes, manutencao: /^maintenance\s*:/i.test(titulo),
    });
  }
  return itens;
}

// 'final' | 'agendado' | 'aberto' | 'desconhecido' (sem "Status:" legível: o formato do feed mudou — nunca alarma em cima de um estado que não deu pra ler)
function faseDe(item) {
  const est = String(item.estado || '').trim();
  if (!est) return 'desconhecido';
  if (FINAIS.test(est)) return 'final';
  if (AGENDADOS.test(est)) return 'agendado';
  return 'aberto';
}
// Item que ainda importa (aberto/agendado e não velho demais).
const recente = (item, agora) => !item.publicadoEm || (agora - item.publicadoEm) <= IDADE_MAX_MS;

// Chave segura pro Realtime Database a partir do guid (que é uma URL): só o id final do incidente (ULID), sem . # $ / [ ].
// Só links da própria página de status da VTEX viram href/link de notificação (um `javascript:` ou site estranho no feed nunca chega no popup).
const linkSeguro = (u) => (/^https:\/\/status\.vtex\.com\//i.test(String(u || '')) ? String(u) : '');

const chaveDe = (guid) => String(guid || '').replace(/\/+$/, '').split('/').pop().replace(/[.#$/\[\]]/g, '_').slice(0, 60);

// ── Comunicado / notificação ──
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const rotuloPt = (est) => ROTULO_PT[String(est || '').toLowerCase()] || est || 'Em andamento';

// O que o Comunicado mostra do incidente: título sem o "Maintenance:" e o resumo do texto (até 700 caracteres). É ISSO que se traduz.
const tituloBase = (item) => String(item.titulo || '').replace(/^maintenance\s*:\s*/i, '');
const resumoDe = (item) => (item.corpoTexto.length > 700 ? item.corpoTexto.slice(0, 700).replace(/\s+\S*$/, '') + '…' : item.corpoTexto);
const hashTexto = (item) => crypto.createHash('sha1').update(tituloBase(item) + '\n' + resumoDe(item)).digest('hex').slice(0, 16);

// `trad` = { titulo, resumo } em português, ou null (tradução desligada/falhou: o aviso sai em inglês, como sempre — o alerta nunca espera tradução).
function comunicadoDe(item, fase, agora, existente, trad) {
  const urgente = fase === 'aberto';
  const base = tituloBase(item);
  const titulo = (urgente ? '🚨 VTEX: ' : '🛠️ VTEX: ') + (item.manutencao ? 'manutenção — ' : '') + (trad ? trad.titulo : base);
  const comps = item.componentes.length
    ? '<p><b>Componentes afetados</b></p><ul>' + item.componentes.map((c) => `<li>${esc(c.nome)}${c.estado ? ' <i>(' + esc(c.estado) + ')</i>' : ''}</li>`).join('') + '</ul>' : '';
  const resumo = resumoDe(item);
  const corpo = trad
    ? `<p><b>Situação: ${esc(rotuloPt(item.estado))}</b> <i>(informado pela VTEX — tradução automática; o original em inglês está logo abaixo)</i></p>`
      + (trad.resumo ? '<p>' + esc(trad.resumo).replace(/\n+/g, '<br>') + '</p>' : '') + comps
      + `<details><summary>🇬🇧 Ver original em inglês</summary><p><b>${esc(base)}</b></p>${resumo ? '<p>' + esc(resumo).replace(/\n+/g, '<br>') + '</p>' : ''}</details>`
      + `<p><a href="${esc(item.link || SITE)}">Ver na página de status da VTEX</a></p>`
    : `<p><b>Situação: ${esc(rotuloPt(item.estado))}</b> <i>(informado pela VTEX — texto original em inglês)</i></p>`
      + (resumo ? '<p>' + esc(resumo).replace(/\n+/g, '<br>') + '</p>' : '') + comps
      + `<p><a href="${esc(item.link || SITE)}">Ver na página de status da VTEX</a></p>`;
  return {
    titulo: titulo.slice(0, 140), corpo,
    tipo: urgente ? 'urgente' : 'aviso', squad: '*', publico: 'todos', prioridade: 'popup', insistente: urgente, oceano: true,
    ativo: true, rascunho: false,
    criadoEm: (existente && existente.criadoEm) || new Date(agora).toISOString(),
    expiraEm: new Date(agora + EXPIRA_MS).toISOString(),
    autor: 'Monitor VTEX (automático)', origem: 'vtex_status', vtexGuid: item.guid,
  };
}

// Tradução do item, com cache: só chama o Google quando o texto mudou desde a última vez (o monitor roda a cada 5 min e reescreve o Comunicado a cada tick).
// Qualquer falha (API desligada, permissão, rede, tempo) → devolve o que já tinha em cache ou null: o aviso sai em inglês e tenta de novo no próximo tick.
async function traducaoDoItem({ item, est, traduzir, off }) {
  if (off) return null;
  const h = hashTexto(item);
  if (est && est.trad && est.trad.h === h && est.trad.titulo != null) return est.trad;
  try {
    const [titulo, resumo] = await (traduzir || traducao.traduzirEnPt)([tituloBase(item), resumoDe(item)]);
    return { h, titulo: String(titulo || '').slice(0, 200), resumo: String(resumo || '').slice(0, 1800) };
  } catch (e) {
    console.warn('[vtexStatus] tradução indisponível (o aviso sai em inglês):', (e && e.message) || e);
    return null;
  }
}

// Quem recebe a notificação: todo mundo, menos convidados/visualizadores externos.
async function destinatarios(db) {
  const pubs = (await db.ref('kanban/usuarios_publicos').get()).val() || {};
  return Object.keys(pubs).filter((uid) => pubs[uid] && !['convidado', 'visualizador'].includes(String(pubs[uid].role || '')));
}
async function notificar({ db, item, comunicadoId, agora, trad }) {
  const uids = await destinatarios(db);
  const id = `vtex_${chaveDe(item.guid)}`;
  const ts = new Date(agora).toISOString();
  const sub = (item.componentes.map((c) => c.nome).slice(0, 3).join(', ') || 'Veja os detalhes no aviso').slice(0, 140);
  let n = 0;
  for (const uid of uids) {
    const ref = db.ref(`kanban/usuarios/${uid}/notificacoes/${id}`);
    if ((await ref.get()).exists()) continue;
    await ref.set({ id, type: TIPO_NOTIF, title: ('🚨 VTEX: ' + (trad ? (item.manutencao ? 'manutenção — ' : '') + trad.titulo : item.titulo)).slice(0, 120), sub, comunicadoId, link: item.link || SITE, read: false, ts });
    n++;
  }
  return n;
}

// Processa o feed. `db` injetado (testes passam fake). Devolve contadores.
async function processar({ db, itens, agora, traduzir }) {
  const t = agora == null ? Date.now() : agora;
  const traducaoOff = (await db.ref('kanban/config/vtex_traducao_off').get()).val() === true;   // interruptor: desliga só a tradução (o aviso segue em inglês)
  const out = { criados: 0, atualizados: 0, fechados: 0, notificados: 0, ignorados: 0, erros: 0, incidentes: [] };
  for (const item of itens) {
    const fase = faseDe(item);
    const chave = chaveDe(item.guid);
    if (fase === 'desconhecido' || !chave) { out.ignorados++; continue; }   // chave vazia faria o set() cair no nó `vtex_status` inteiro
    try { await processarItem({ db, item, fase, chave, t, out, traduzir, traducaoOff }); }
    catch (e) { out.erros++; console.error('[vtexStatus] item', chave, 'falhou:', (e && e.message) || e); }   // um item ruim não derruba os outros
  }
  return out;
}

async function processarItem({ db, item, fase, chave, t, out, traduzir, traducaoOff }) {
  const estRef = db.ref(`kanban/vtex_status/${chave}`);
  const est = (await estRef.get()).val();
  const comId = `vtex_${chave}`;
  const comRef = db.ref(`kanban/comunicados/${comId}`);

  if (fase === 'final') {
    if (!est || est.fechado) { out.ignorados++; return; }       // nunca vimos aberto (1ª execução / histórico) ou já fechado
    const atual = (await comRef.get()).val();
    if (atual && atual.ativo !== false) { await comRef.update({ ativo: false, expiraEm: new Date(t).toISOString() }); out.fechados++; }
    await estRef.update({ fechado: true, estado: item.estado, fechadoEm: new Date(t).toISOString() });
    return;
  }
  if (!recente(item, t)) { out.ignorados++; return; }

  const trad = await traducaoDoItem({ item, est, traduzir, off: traducaoOff });
  if (fase === 'aberto') out.incidentes.push({ titulo: (trad ? trad.titulo : item.titulo).slice(0, 120), link: item.link || SITE, estado: item.estado });
  const atual = (await comRef.get()).val();
  if (est && !atual) { out.ignorados++; return; }                 // um ADM apagou o aviso: respeita
  if (atual && atual.ativo === false && !est?.fechado) { out.ignorados++; return; }   // ADM desativou à mão: respeita
  const com = comunicadoDe(item, fase, t, atual, trad);
  await comRef.set(com);
  atual ? out.atualizados++ : out.criados++;
  const novoEst = { comunicadoId: comId, estado: item.estado, criadoEm: est?.criadoEm || new Date(t).toISOString(), atualizadoEm: new Date(t).toISOString() };
  if (est?.notificadoEm) novoEst.notificadoEm = est.notificadoEm;
  if (trad) novoEst.trad = trad;
  if (fase === 'aberto' && !est?.notificadoEm) {
    out.notificados += await notificar({ db, item, comunicadoId: comId, agora: t, trad });
    novoEst.notificadoEm = new Date(t).toISOString();
  }
  await estRef.set(novoEst);
}

async function buscarFeed(fetchImpl) {
  const f = fetchImpl || fetch;
  const r = await f(FEED_URL, { headers: { 'user-agent': 'MareDigital-VtexStatus/1.0', accept: 'application/rss+xml, application/xml, text/xml' }, signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error('feed da VTEX respondeu HTTP ' + r.status);
  return r.text();
}

async function rodar({ db, fetchImpl, agora, log, traduzir }) {
  const say = log || console;
  if ((await db.ref('kanban/config/vtex_status_off').get()).val() === true) return { desligado: true };
  const xml = await buscarFeed(fetchImpl);
  const itens = parseFeed(xml);
  if (!itens.length) { say.warn('[vtexStatus] feed sem nenhum item — formato mudou? (nada alterado)'); return { itens: 0 }; }
  if (!itens.some((i) => i.estado)) { say.warn('[vtexStatus] feed sem nenhum "Status:" legível — formato mudou? (nada alterado)'); return { itens: 0 }; }
  const r = await processar({ db, itens, agora, traduzir });
  if (r.erros && r.erros >= itens.length) throw new Error('todos os ' + itens.length + ' itens do feed falharam ao gravar');
  return Object.assign({ itens: itens.length }, r);
}

// Notifica os ADMs (usuarios_publicos com role 'adm') que o monitor não consegue ler o feed. Id fixo por dia (reexecutar não duplica).
async function alertarMonitor({ db, falhas, erro, agora }) {
  const pubs = (await db.ref('kanban/usuarios_publicos').get()).val() || {};
  const adms = Object.keys(pubs).filter((uid) => pubs[uid] && pubs[uid].role === 'adm');
  const ts = new Date(agora).toISOString();
  const id = `vtexmon_${ts.slice(0, 10)}`;
  const sub = `Sem ler o status da VTEX há ~${Math.round((falhas * 5) / 60 * 10) / 10} h (${falhas} tentativas): ${String(erro || 'feed vazio').slice(0, 120)}. Os avisos automáticos de incidente estão parados.`;
  let n = 0;
  for (const uid of adms) {
    const ref = db.ref(`kanban/usuarios/${uid}/notificacoes/${id}`);
    if ((await ref.get()).exists()) continue;
    await ref.set({ id, type: TIPO_MONITOR, title: '🛰️ Monitor da VTEX sem resposta', sub, read: false, ts });
    n++;
  }
  return n;
}

// Um tick completo: lê o feed, aplica os avisos e registra a SAÚDE (kanban/vtex_saude). Em falha, conta e (≥ LIMITE_FALHAS) avisa os ADMs; relança o erro.
async function executar({ db, fetchImpl, agora, log, traduzir }) {
  const t = agora == null ? Date.now() : agora;
  const iso = new Date(t).toISOString();
  const ref = db.ref('kanban/vtex_saude');
  try {
    const r = await rodar({ db, fetchImpl, agora: t, log, traduzir });
    if (r.desligado) { await ref.set({ desligado: true, em: iso }); return r; }
    if (!r.itens) throw new Error('feed sem nenhum item legível (formato mudou?)');
    await ref.set({ ok: true, ultimoOkEm: iso, abertos: r.incidentes.length, incidentes: r.incidentes.slice(0, 3), falhasSeguidas: 0 });
    return r;
  } catch (e) {
    const prev = (await ref.get()).val() || {};
    const n = (prev.falhasSeguidas || 0) + 1;
    const upd = { ok: false, falhasSeguidas: n, ultimaTentativaEm: iso, erro: String((e && e.message) || e).slice(0, 200) };
    if (n >= LIMITE_FALHAS && !prev.avisadoEm) {
      try { await alertarMonitor({ db, falhas: n, erro: upd.erro, agora: t }); upd.avisadoEm = iso; }
      catch (e2) { console.error('[vtexStatus] não consegui avisar os ADMs (tenta de novo no próximo tick):', e2); }   // sem avisadoEm → repete; o contador e o erro original seguem
    }
    await ref.update(upd);
    throw e;
  }
}

exports.vtexStatus = onSchedule(
  { schedule: '*/5 * * * *', timeZone: 'America/Sao_Paulo', region: 'us-central1', timeoutSeconds: 120 },
  async () => {
    try { const r = await executar({ db: getDatabase() }); if (r.criados || r.fechados || r.atualizados) console.log('[vtexStatus]', JSON.stringify(r)); }
    catch (e) { console.error('[vtexStatus] falhou:', e); }
  }
);

// Exportados pra teste (lógica pura, sem mockar firebase-functions).
exports._test = { executar, alertarMonitor, LIMITE_FALHAS, TIPO_MONITOR, chaveDe, linkSeguro, parseFeed, faseDe, recente, comunicadoDe, processar, rodar, limpaMojibake, FEED_URL, TIPO_NOTIF, traducaoDoItem, hashTexto, tituloBase, resumoDe };
