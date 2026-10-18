// TESTE DE SEGURANÇA — XSS armazenado (rodada de pente fino, 18/10/2026).
// Envenena todo campo de TEXTO LIVRE do banco falso com um payload que tenta (1) sair de atributo HTML ("'>), (2) abrir uma tag <img onerror>
// e (3) injetar um atributo de evento num link markdown — e depois abre as telas do Maré/Radar/Painel/Oceano. Falha se:
//   • algum payload EXECUTA (xh() é chamado), ou
//   • sobra no DOM um elemento com atributo on* vindo do payload (mesmo que ninguém tenha passado o mouse nele).
// Boot real da página com o Firebase falso — nada toca dado real.   (python3 -m http.server 8941 &)   node docs/arezzo/testes/test_seguranca_xss.js
//   PAGINAS=kanban-dev,painel-dev,okr-dev,oceano-dev (padrão: as 4)   K=… para produção (ex.: PAGINAS=kanban,okr)
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fake = require('./fakefb.js');
const PAGINAS = (process.env.PAGINAS || 'kanban-dev,painel-dev,okr-dev,oceano-dev').split(',');
const U = { uid: 'eve', email: 'eve@ciahering.com.br', displayName: 'Eve', photoURL: '', providerData: [{ providerId: 'google.com' }] };
const iso = (d) => new Date(d).toISOString();

const PAY = (p) => `"'><img src=x onerror=xh('${p}')> [l](https://e.example/"onmouseover="xh('${p}-md')"x=")`;
const LIVRES = new Set(['title', 'name', 'nome', 'text', 'texto', 'desc', 'descricao', 'description', 'sub', 'label', 'author', 'autor', 'demandante', 'contato', 'squadDemandante', 'body', 'msg', 'mensagem', 'titulo', 'obs', 'nota', 'note', 'resumo', 'conteudo', 'mensagemHtml', 'autorNome', 'displayName', 'assunto', 'motivo', 'objetivo', 'what', 'who', 'group', 'color', 'cor', 'emoji', 'icon', 'icone', 'photo', 'foto', 'photoURL']);
// campos de URL: o payload é um esquema perigoso (javascript:) — nenhum <a href> pode sair assim na tela
const URLS = new Set(['url', 'link', 'href', 'meetingLink', 'relatorioUrl', 'pdfUrl', 'shortlink', 'prUrl', 'viewUrl', 'img', 'photoURL', 'foto']);
const LISTAS_LIVRES = new Set(['indicadores', 'progressos', 'proximosPassos', 'riscos', 'planosAcao']);
const ENVENENADOS = new Set();
function envenena(o, path) {
  if (Array.isArray(o)) return o.map((v, i) => envenena(v, path + '[' + i + ']'));
  if (o && typeof o === 'object') { const r = {}; for (const k of Object.keys(o)) r[k] = URLS.has(k) && typeof o[k] === 'string' ? (ENVENENADOS.add(path + '.' + k), "javascript:xh('" + path + '.' + k + "')") : LISTAS_LIVRES.has(k) && Array.isArray(o[k]) ? o[k].map((v, i) => (typeof v === 'string' ? (ENVENENADOS.add(path + '.' + k + '[' + i + ']'), v + PAY(path + '.' + k + '[' + i + ']')) : envenena(v, path + '.' + k + '[' + i + ']'))) : LIVRES.has(k) && typeof o[k] === 'string' ? (ENVENENADOS.add(path + '.' + k), o[k] + PAY(path + '.' + k)) : envenena(o[k], path + '.' + k); return r; }
  return o;
}

const card = (id, t, extra) => Object.assign({ id, col: 'backlog', title: t, tags: ['t1'], tag: 't1', desc: 'descrição ' + id, checklist: [{ id: 'k1', text: 'item de checklist', done: false, gid: 'g1' }], checklistGroups: [{ id: 'g1', title: 'Grupo do checklist' }], owner: 'EV', created: 'Eve', createdAt: '2026-10-01', priority: 'medium', demandante: 'Fulano', history: [{ what: 'criou o card', who: 'Eve', at: iso('2026-10-01'), init: 'EV' }], extras: [{ id: 'x1', title: 'Extra', text: 'texto extra' }], links: [{ id: 'l1', title: 'Link', url: 'https://example.com', label: 'Link' }], flow: { enteredAt: { backlog: iso('2026-10-01') }, log: [] } }, extra || {});
const cm = (id, a, t) => ({ id, uid: 'eve', author: a, init: 'EV', foto: '', text: t, ts: iso('2026-10-14T13:00:00') });
function seedKanban() {
  const dados = {
    columns: [{ id: 'backlog', name: 'Backlog' }, { id: 'doing', name: 'Fazendo' }, { id: 'done', name: 'Concluído' }],
    cards: { 0: card('c1', 'Card um'), 1: card('c2', 'Card dois', { col: 'doing' }), 2: card('c3', 'Card três', { col: 'done' }) },
    cards_index: { c1: '0', c2: '1', c3: '2' },
    card_comments: { c1: { a: cm('a', 'Maria', 'comentário'), b: cm('b', 'João', 'outro') } },
    tags: { t1: { id: 't1', name: 'Tag um', color: '#38b6ff' } },
    intake_pending: { i1: { id: 'i1', titulo: 'Pedido público', demandante: 'Anônimo', contato: 'a@b.c', descricao: 'quero algo', squadDemandante: 'Comercial', origem: 'externo', status: 'pending', createdAt: iso('2026-10-10'), prazo: '2026-11-01' } },
    notas: { n1: { id: 'n1', titulo: 'Nota', blocos: [{ id: 'b1', texto: 'conteúdo', tipo: 'texto' }] } },
  };
  return {
    kanban: {
      usuarios: { eve: { uid: 'eve', nome: 'Eve', email: 'eve@ciahering.com.br', inscrito: true, init: 'EV', role: 'po', squads: { dev: true } }, bia: { uid: 'bia', nome: 'Bia Souza', email: 'bia@ciahering.com.br', inscrito: true, init: 'BS', role: 'membro', squads: { dev: true } } },
      usuarios_publicos: { eve: { uid: 'eve', nome: 'Eve', init: 'EV', role: 'po', squads: { dev: true } }, bia: { uid: 'bia', nome: 'Bia Souza', init: 'BS', role: 'membro', squads: { dev: true } } },
      config: { adm_emails: ['eve@ciahering.com.br'] },
      comunicados: { m1: { id: 'm1', titulo: 'Aviso', mensagem: 'texto do aviso', ativo: true, ts: iso('2026-10-15'), tipo: 'mural' } },
      campanhas: { k1: { id: 'k1', nome: 'Campanha', desc: 'descrição', status: 'ativa', squads: ['dev'] } },
      squads: { dev: { dados } },
    },
  };
}
function notificacoes() {
  return { n1: { id: 'n1', type: 'mention', title: '@EV mencionada', sub: 'no card', ts: iso(new Date()), read: false }, n2: { id: 'n2', type: 'intake', title: '📥 Novo pedido de intake', sub: 'Banner — Anônimo', ts: iso(new Date()), read: false, squad: 'dev' } };
}

async function rodar(pagina, seed, passos, usuario) {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript(() => { window.__xhHits = []; window.xh = (p) => { window.__xhHits.push(p); }; window.open = () => null;
    // Uma chamada xh( dentro de um literal de string de um onclick="..." é inofensiva; só conta se sobrar FORA de string (= quebrou o literal e virou código)
    window.__fora = (v) => { let o = '', q = null; for (let i = 0; i < v.length; i++) { const c = v[i]; if (q) { if (c === '\\') { i++; continue; } if (c === q) q = null; continue; } if (c === '"' || c === "'" || c === '`') { q = c; continue; } o += c; } return o; }; });
  await fake.install(ctx, seed);
  const p = await ctx.newPage(); const erros = []; p.on('pageerror', (e) => erros.push(e.message)); p.on('dialog', (d) => d.accept());
  await p.goto(`http://localhost:8941/${pagina}.html${pagina.startsWith('kanban') ? '?squad=dev' : ''}`);
  await p.waitForFunction(() => !!window.__authCb); await p.evaluate((x) => window.__authCb(x), usuario || U); await p.waitForTimeout(3000);
  const achados = new Map(); const cobertura = new Set();
  const confere = async (onde) => {
    const r = await p.evaluate(() => {
      const hits = window.__xhHits.slice(); window.__xhHits.length = 0;
      const foraDeString = window.__fora; const dom = []; document.querySelectorAll('*').forEach((el) => { for (const a of el.attributes) if (/^on/i.test(a.name) && /xh\(/.test(foraDeString(a.value))) dom.push(el.tagName.toLowerCase() + '[' + a.name + ']=' + a.value.slice(0, 60)); });
      document.querySelectorAll('a[href],area[href]').forEach((el) => { if (/^(javascript|vbscript):/i.test(el.getAttribute('href').replace(/[\u0000-\u0020]/g, ''))) dom.push('a[href=javascript:] ' + el.getAttribute('href').slice(0, 70)); });
      document.querySelectorAll('img[src="x"]').forEach((el) => dom.push('img[src=x] injetada em ' + (el.parentElement ? el.parentElement.outerHTML.slice(0, 160).replace(/\s+/g, ' ') : '?')));
      const cob = [...new Set([...document.documentElement.innerHTML.matchAll(/xh\((?:'|&#39;|&amp;#39;)([A-Za-z0-9_.\[\]-]+?)(?:'|&#39;)\)/g)].map((m) => m[1]))];
      return { hits, dom: [...new Set(dom)], cob };
    });
    r.hits.forEach((h) => achados.set('EXECUTOU ' + h, onde)); r.dom.forEach((d) => achados.set('DOM ' + d, onde)); r.cob.forEach((c) => cobertura.add(c.replace(/-md$/, '')));
  };
  await confere('boot');
  for (const [nome, fn] of passos) { try { await fn(p); } catch (e) { erros.push(nome + ': ' + e.message.slice(0, 100)); } await p.waitForTimeout(500); await confere(nome); }
  await b.close();
  EXTRA.forEach((v, k) => achados.set(k, v)); EXTRA.clear();
  return { achados, erros, cobertura };
}

const passosKanban = [
  ['abrir card c1', (p) => p.evaluate(() => openCard('c1'))],
  ['expandir seções do card', (p) => p.evaluate(() => { try { toggleAllModalSecs(); } catch (e) { } try { toggleHistory(); } catch (e) { } })],
  ['fechar card', (p) => p.evaluate(() => document.querySelectorAll('.ov.open').forEach((o) => o.classList.remove('open')))],
  ['menu de contexto do card', async (p) => { const el = await p.$('.card'); if (el) await el.click({ button: 'right' }); }],
  ['esc', (p) => p.keyboard.press('Escape')],
  ['busca global', async (p) => { await p.evaluate(() => { try { openSearch(); } catch (e) { } }); await p.keyboard.type('c'); }],
  ['fechar busca', (p) => p.evaluate(() => { try { closeSearch(); } catch (e) { } })],
  ['sino de notificações', (p) => p.evaluate(() => { const b = document.querySelector('[onclick*="toggleNotif"],#notif-btn,#bell-btn,.notif-bell'); if (b) b.click(); })],
];
// "varredura": chama TODA função open*/show*/toggle* sem argumentos que a página expõe (Firebase falso — nada real é tocado), fechando o que abrir
const NOMES_PULAR = /logout|signOut|reset|apagar|delete|excluir|clear|limpar|toggleTheme|toggleVice|toggleBlack|toggleSpotify|Sound/i;

function seedOkr() {
  const { objs, snaps } = require('./seed_okr_dashboard.js');
  const jc = (x) => JSON.parse(JSON.stringify(x));
  const o = jc(objs); Object.values(o).forEach((x) => { x.descricao = 'descrição'; x.progressos = ['progresso']; x.proximosPassos = ['passo']; x.riscos = ['risco']; x.indicadores = ['indicador']; x.planosAcao = ['plano']; x.tagIds = ['tg1']; });
  return { kanban: { okr: {
    objetivos: o, snapshots: jc(snaps), tags: { tg1: { id: 'tg1', label: 'Tag', color: '#38b6ff' } },
    marcos: { m1: { id: 'm1', objetivoId: Object.keys(o)[0], nome: 'Marco', descricao: 'desc', prazo: '2026-12-01', progresso: 'no_prazo', responsavel: '', checklist: [{ id: 'k1', text: 'item', done: false }], tags: ['tg1'], participantes: [], history: [{ what: 'criou', who: 'Ana', uid: 'ana', at: iso('2026-10-01') }] } },
    marco_comments: { m1: { c1: { id: 'c1', uid: 'ana', nome: 'Ana', autor: 'Ana', text: 'comentário', ts: iso('2026-10-10') } } },
    calendario: { eventos: { e1: { id: 'e1', titulo: 'Reunião', tipo: 'reuniao', data: '2026-10-20', diaInteiro: true, torre: '', descricao: 'pauta', local: 'sala', link: 'https://example.com', convidados: [], lembrar: { vespera: true, dia: true } } } },
    reuniao_notas: { '2026-10-16': { n1: { id: 'n1', texto: 'nota', autor: 'Ana', autorUid: 'ana', ts: iso('2026-10-16') } } },
    mural: { mm1: { id: 'mm1', titulo: 'Aviso', mensagem: 'mensagem', ts: iso('2026-10-12'), torres: ['digital'], tipo: 'mural' } },
  }, notif_feed: { f1: { id: 'f1', type: 'obj_criado', title: 'Novo objetivo', sub: 'sub', ts: iso(new Date()), torres: ['digital'], autor: 'Ana' } },
  usuarios: { ana: { uid: 'ana', nome: 'Ana', email: 'ana@ciahering.com.br', inscrito: true, init: 'AA', role: 'adm', squads: { dados: true } } }, usuarios_publicos: { ana: { uid: 'ana', nome: 'Ana', init: 'AA' } }, config: { adm_emails: ['ana@ciahering.com.br'] } } };
}
const U_ANA = { uid: 'ana', email: 'ana@ciahering.com.br', displayName: 'Ana ADM', photoURL: '', providerData: [{ providerId: 'google.com' }] };
const passosOkr = [
  ['entrar na torre', (p) => p.evaluate(() => { try { _okrEntrarTorre('digital'); } catch (e) { } })],
  ...['objetivos', 'historico', 'calendario', 'notas', 'cards', 'datastudio'].map((v) => ['visão ' + v, (p) => p.evaluate((v) => { try { _okrSetView(v); } catch (e) { } }, v)]),
  ['objetivo', (p) => p.evaluate(() => { const id = Object.keys(window.__store.kanban.okr.objetivos)[0]; openOkrObjetivo(id); })],
  ['marco', (p) => p.evaluate(() => { const id = Object.keys(window.__store.kanban.okr.objetivos)[0]; openOkrMarco('m1', id); })],
  ['evento', (p) => p.evaluate(() => { openOkrEvento('e1', '2026-10-20'); })],
  ['mural', (p) => p.evaluate(() => { openOkrMural(); })],
];

function seedPainel() {
  const dados = { columns: [{ id: 'backlog', name: 'Backlog' }], cards: { 0: { id: 'c1', col: 'backlog', title: 'Card', createdAt: '2026-10-01', owner: 'AA', flow: { enteredAt: { backlog: iso('2026-10-01') }, log: [] } } }, cards_index: { c1: '0' },
    error_logs: { e1: { id: 'e1', message: 'Erro', stack: 'stack', url: 'https://x', ts: iso(new Date()), uid: 'ana', autor: 'Ana', nome: 'Ana', page: 'kanban' } } };
  return { kanban: {
    usuarios: { ana: { uid: 'ana', nome: 'Ana ADM', email: 'ana@ciahering.com.br', inscrito: true, init: 'AA', role: 'adm', squads: { dados: true } }, bia: { uid: 'bia', nome: 'Bia', email: 'bia@ciahering.com.br', inscrito: true, init: 'BI', role: 'membro', squads: { dados: true } } },
    usuarios_publicos: { ana: { uid: 'ana', nome: 'Ana ADM', init: 'AA' }, bia: { uid: 'bia', nome: 'Bia', init: 'BI' } },
    config: { adm_emails: ['ana@ciahering.com.br'], links_hering: { l1: { id: 'l1', title: 'Link', url: 'https://example.com', label: 'Link', emoji: '🔗' } } },
    squads_meta: { novo: { id: 'novo', label: 'Squad Novo', emoji: '🐟', color: '#38b6ff', name: 'Novo' } },
    comunicados: { m1: { id: 'm1', titulo: 'Aviso', mensagem: 'texto', ativo: true, ts: iso('2026-10-15'), tipo: 'mural', autor: 'Ana' } },
    feedback: { f1: { id: 'f1', tipo: 'bug', texto: 'relato', titulo: 'Bug', app: 'kanban', autorNome: 'Bia', autorUid: 'bia', criadoEm: Date.now(), status: 'aberto' } },
    plantao: { p1: { id: 'p1', estado: 'testando', criadoEm: Date.now(), atualizadoEm: Date.now(), app: 'kanban', autorNome: 'Bia', autorUid: 'bia', titulo: 'Bug', descricao: 'descrição', prTitulo: 'Corrige', prResumo: 'resumo', resumo: 'resumo', prUrl: 'https://github.com/x/y/pull/1', cardId: 'c1' } },
    plantao_status: { agenteVistoEm: Date.now() },
    squads: { dados: { dados } },
  } };
}
const passosPainel = [
  ...['visao', 'fluxo', 'timeline', 'pessoas', 'dados', 'monitor', 'notifs', 'status', 'agentes', 'okr', 'config'].map((t) => ['aba ' + t, (p) => p.evaluate((t) => { try { swPtab(t); } catch (e) { } }, t)]),
];


function seedOceano() {
  return { kanban: {
    usuarios: { ana: { uid: 'ana', nome: 'Ana ADM', email: 'ana@ciahering.com.br', inscrito: true, init: 'AA', role: 'adm', squads: { dados: true } } },
    usuarios_publicos: { ana: { uid: 'ana', nome: 'Ana ADM', init: 'AA' } },
    config: { adm_emails: ['ana@ciahering.com.br'], links_hering: { l1: { id: 'l1', title: 'Link', url: 'https://example.com', label: 'Link' } } },
    comunicados: { m1: { id: 'm1', titulo: 'Aviso', mensagem: 'texto do aviso', ativo: true, ts: iso(new Date()), tipo: 'mural', oceano: true, autor: 'Ana', autorNome: 'Ana' } },
    notif_feed: { f1: { id: 'f1', type: 'intake', title: 'Pedido', sub: 'sub', ts: iso(new Date()), autor: 'Anônimo' }, nf_bug_1: { id: 'nf_bug_1', type: 'ferias_bug_status', title: 'Bug', sub: 'sub', ts: iso(new Date()), autor: 'Bia' } },
    feedback: { f1: { id: 'f1', tipo: 'bug', texto: 'relato do bug', titulo: 'Bug', app: 'kanban', autorNome: 'Ana ADM', autorUid: 'ana', autor: 'Ana ADM', criadoEm: Date.now(), status: 'aberto', msg: 'mensagem' } },
  } };
}
const passosOceano = [
  ...['chat', 'bugs', 'socorro', 'status', 'proximos', 'guia'].map((t) => ['assistente aba ' + t, (p) => p.evaluate((t) => { try { abrirFerias(t); } catch (e) { } }, t)]),
  ['sino', (p) => p.evaluate(() => { const b = document.querySelector('#sino-btn,[onclick*="sino"],.sino'); if (b) b.click(); })],
];

const EXTRA = new Map();
const crawl = [['varredura das telas open*/show*/toggle*', async (p) => {
  const nomes = await p.evaluate(() => Object.getOwnPropertyNames(window).filter((n) => /^(open|show|toggle)[A-Z]/.test(n) && typeof window[n] === 'function' && window[n].length === 0));
  for (const n of nomes) {
    if (NOMES_PULAR.test(n)) continue;
    await p.evaluate((n) => { try { const r = window[n](); if (r && r.catch) r.catch(() => { }); } catch (e) { } }, n);
    await p.waitForTimeout(150);
    await p.evaluate(() => { document.querySelectorAll('.open').forEach((o) => o.classList.remove('open')); document.querySelectorAll('[id$="-ov"],[id$="-overlay"],[id$="-modal"]').forEach((o) => { if (!/^(card-ov)$/.test(o.id)) o.classList.remove('open'); }); });
    // confere já aqui (a próxima tela pode fechar/substituir o que esta abriu)
    const r = await p.evaluate(() => { const hits = window.__xhHits.slice(); window.__xhHits.length = 0; const foraDeString = window.__fora; const dom = []; document.querySelectorAll('*').forEach((el) => { for (const a of el.attributes) if (/^on/i.test(a.name) && /xh\(/.test(foraDeString(a.value))) dom.push(el.tagName.toLowerCase() + '[' + a.name + ']'); }); document.querySelectorAll('img[src="x"]').forEach(() => dom.push('img[src=x]')); return { hits, dom }; });
    r.hits.forEach((h) => EXTRA.set('EXECUTOU ' + h, 'ao abrir ' + n)); r.dom.forEach((d) => EXTRA.set('DOM ' + d, 'ao abrir ' + n));
    // o que ficou de HTML injetado atrapalha a próxima função: recarrega só o que for preciso
    await p.evaluate(() => { document.querySelectorAll('img[src="x"]').forEach((el) => el.remove()); });
  }
}]];

(async () => {
  let ok = true; const todos = [];
  for (const pagina of PAGINAS) {
    const base = pagina.replace(/-dev$/, '');
    let seed, passos;
    if (base === 'kanban') { seed = envenena(seedKanban(), 'kanban'); seed.kanban.usuarios.eve.notificacoes = envenena(notificacoes(), 'notif'); passos = passosKanban.concat(crawl); }
    else if (base === 'oceano') { seed = envenena(seedOceano(), 'oceano'); passos = passosOceano.concat(crawl); }
    else if (base === 'painel') { seed = envenena(seedPainel(), 'painel'); passos = passosPainel.concat(crawl); }
    else if (base === 'okr') { seed = envenena(seedOkr(), 'okr'); passos = passosOkr.concat(crawl); }
    else { console.log('(' + pagina + ': semente específica ainda não escrita — pulando)'); continue; }
    const { achados, erros, cobertura } = await rodar(pagina, seed, passos, base === 'okr' || base === 'painel' || base === 'oceano' ? U_ANA : U);
    console.log('\n=== ' + pagina + ' — ' + achados.size + ' achado(s)' + (erros.length ? ' · avisos: ' + erros.slice(0, 3).join(' | ') : ''));
    console.log('   campos envenenados que apareceram na tela (cobertura): ' + cobertura.size + (process.env.COB ? ' → ' + [...cobertura].sort().join(', ') : ''));
    if (process.env.NAOVISTOS) console.log('   NÃO apareceram na tela: ' + [...ENVENENADOS].filter((x) => !cobertura.has(x)).join(', '));
    for (const [k, v] of achados) { ok = false; console.log('❌ ' + k + '   (visto em: ' + v + ')'); todos.push([pagina, k, v]); }
  }
  console.log(ok ? '\nTUDO OK — nenhum payload executou nem deixou atributo de evento no DOM' : '\nHÁ FALHAS DE XSS');
  process.exit(ok ? 0 : 1);
})();
