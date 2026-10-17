// TESTE — Busca nos comentários do card (Ctrl+K com o card aberto): filtra por texto sem acento, @autor e data; destaca; Esc fecha; limpa ao trocar de card; não vaza HTML; Ctrl+K sem card segue abrindo a busca global.
// Boot real do kanban com Firebase falso.   (python3 -m http.server 8941 &)   node docs/arezzo/testes/test_busca_comentarios.js     K=kanban para produção
const { chromium } = require('/opt/node22/lib/node_modules/playwright'); const fake = require('./fakefb.js');
const K = process.env.K || 'kanban-dev';
const U = { uid: 'eve', email: 'eve@ciahering.com.br', displayName: 'Eve', photoURL: '', providerData: [{ providerId: 'google.com' }] };
const iso = (d) => new Date(d).toISOString();
const card = (id, t) => ({ id, col: 'backlog', title: t, tags: [], tag: '', desc: '', checklist: [], created: 'Eve', createdAt: '2026-10-01', priority: 'medium', history: [], flow: { enteredAt: { backlog: iso('2026-10-01') }, log: [] } });
const cm = (id, author, text, ts) => ({ id, uid: author.toLowerCase(), author, init: author.slice(0, 2).toUpperCase(), foto: '', text, ts });
const seed = { kanban: { usuarios: { eve: { uid: 'eve', nome: 'Eve', email: 'eve@ciahering.com.br', inscrito: true, init: 'EV', role: 'po', squads: { dev: true } } }, usuarios_publicos: { eve: { uid: 'eve', nome: 'Eve', init: 'EV', role: 'po', squads: { dev: true } } }, config: { adm_emails: [] },
  squads: { dev: { dados: { columns: [{ id: 'backlog', name: 'Backlog' }, { id: 'done', name: 'Concluído' }], cards: { 0: card('c1', 'Card com comentários'), 1: card('c2', 'Outro card') }, cards_index: { c1: '0', c2: '1' },
    card_comments: { c1: { a: cm('a', 'Maria', 'Decidimos manter o filtro por atenção', iso('2026-10-14T13:00:00')), b: cm('b', 'João', 'Reunião em 15/10 com a diretoria', iso('2026-10-15T14:00:00')), c: cm('c', 'Maria', 'Segue o <b>link</b> do material', iso('2026-10-16T10:00:00')) }, c2: { d: cm('d', 'Ana', 'Comentário do outro card', iso('2026-10-16T11:00:00')) } } } } } } };
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] }); let ok = true;
  const t = (n, c, d) => { if (!c) ok = false; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : ' → ' + (JSON.stringify(d) || '').slice(0, 300))); };
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); await fake.install(ctx, seed);
  const p = await ctx.newPage(); const erros = []; p.on('pageerror', e => erros.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto(`http://localhost:8941/${K}.html?squad=dev`); await p.waitForFunction(() => !!window.__authCb); await p.evaluate(x => window.__authCb(x), U); await p.waitForTimeout(3000);
  await p.evaluate(() => document.querySelectorAll('.ov.open').forEach(o => o.classList.remove('open')));
  const estado = () => p.evaluate(() => ({ barra: getComputedStyle(document.getElementById('m-comment-search-bar')).display, cont: document.getElementById('m-comment-search-count').textContent, itens: document.querySelectorAll('#m-comment-list .comment-text').length, marcas: [...document.querySelectorAll('#m-comment-list mark')].map(m => m.textContent), foco: document.activeElement && document.activeElement.id, vazio: /Nenhum coment/.test(document.getElementById('m-comment-list').innerText) }));
  // Ctrl+K SEM card aberto continua abrindo a busca global
  await p.keyboard.press('Control+k'); await p.waitForTimeout(300);
  t('Sem card aberto, Ctrl+K abre a busca global', await p.evaluate(() => document.getElementById('search-overlay')?.classList.contains('open')), 1);
  await p.keyboard.press('Escape'); await p.evaluate(() => { try { closeSearch(); } catch (e) { } });
  await p.evaluate(() => openCard('c1')); await p.waitForTimeout(900);
  let s = await estado(); t('Card abre com 3 comentários e a busca fechada', s.itens === 3 && s.barra === 'none', s);
  await p.keyboard.press('Control+k'); await p.waitForTimeout(250);
  s = await estado(); t('Com o card aberto, Ctrl+K abre a barra de busca nos comentários e foca o campo', s.barra === 'flex' && s.foco === 'm-comment-search-inp', s);
  t('…e NÃO abre a busca global por cima', !(await p.evaluate(() => document.getElementById('search-overlay')?.classList.contains('open'))), 1);
  await p.keyboard.type('atencao'); await p.waitForTimeout(250); s = await estado();
  t('"atencao" (sem acento) acha "atenção": 1 de 3, contador 1/3, trecho destacado', s.itens === 1 && s.cont === '1/3' && s.marcas.join('').toLowerCase().startsWith('aten'), s);
  await p.fill('#m-comment-search-inp', '@joão'); await p.waitForTimeout(250); s = await estado(); t('"@joão" filtra pelo autor', s.itens === 1, s);
  await p.fill('#m-comment-search-inp', '15/10'); await p.waitForTimeout(250); s = await estado(); t('"15/10" filtra pela data', s.itens === 1, s);
  await p.fill('#m-comment-search-inp', 'zzz'); await p.waitForTimeout(250); s = await estado(); t('Sem resultado mostra a mensagem e o campo continua', s.itens === 0 && s.vazio, s);
  await p.fill('#m-comment-search-inp', '<img src=x onerror="window.__xss=1">'); await p.waitForTimeout(250);
  t('Texto de busca com HTML não executa nada (escapado)', !(await p.evaluate(() => window.__xss)) && !(await p.evaluate(() => document.querySelector('#m-comment-list img'))), 1);
  await p.fill('#m-comment-search-inp', 'link'); await p.waitForTimeout(250); s = await estado(); t('Comentário com HTML do usuário aparece como TEXTO (não vira tag) e é achado', s.itens === 1 && !(await p.evaluate(() => document.querySelector('#m-comment-list .comment-text b'))), s);
  await p.fill('#m-comment-search-inp', 'a'); await p.waitForTimeout(250); s = await estado(); t('Letra solta destaca várias vezes sem travar', s.itens >= 1 && s.marcas.length >= 2, s);
  await p.press('#m-comment-search-inp', 'Escape'); await p.waitForTimeout(250); s = await estado();
  t('Esc limpa e fecha a barra, voltando aos 3 comentários — e o card continua aberto', s.barra === 'none' && s.itens === 3 && (await p.evaluate(() => document.getElementById('card-ov').classList.contains('open'))), s);
  await p.keyboard.press('Control+k'); await p.waitForTimeout(120); await p.keyboard.type('maria'); await p.waitForTimeout(250);
  s = await estado(); t('Filtro por "maria" ativo antes de fechar (2 de 3)', s.itens === 2 && s.cont === '2/3', s);
  await p.evaluate(() => closeOv('card-ov')); await p.waitForTimeout(500);
  await p.evaluate(() => openNewCard()); await p.waitForTimeout(500);   // (reabrir OUTRO card com o Firebase falso entra em laço no travamento do card; o reset roda no mesmo ponto em openCard e openNewCard)
  s = await p.evaluate(() => ({ barra: getComputedStyle(document.getElementById('m-comment-search-bar')).display, cont: document.getElementById('m-comment-search-count').textContent, inp: document.getElementById('m-comment-search-inp').value }));
  t('Fechar e abrir outro card zera a busca (barra fechada, campo e contador vazios)', s.barra === 'none' && s.cont === '' && s.inp === '', s);
  t('Sem erro de JS', !erros.length, erros);
  await b.close(); console.log(ok ? 'TUDO OK' : 'HÁ FALHAS'); process.exit(ok ? 0 : 1);
})();
