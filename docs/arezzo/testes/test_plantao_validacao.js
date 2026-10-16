// TESTE — Plantão de Bugs (painel-dev, aba 🐛 Monitor › 🛟 Plantão de Bugs; módulo mare-plantao-dev.js): a validação do ADM. Só ADM vê/usa; sem PR + script salvos não valida; quem
// reportou não valida o próprio; 3 reprovações escalam; "em produção" resolve o bug e avisa quem reportou; pausa geral.
// Roda:   (na raiz)  (python3 -m http.server 8941 >/dev/null 2>&1 &)   e depois   node docs/arezzo/testes/test_plantao_validacao.js
const { chromium } = require('/opt/node22/lib/node_modules/playwright'); const fake = require('./fakefb.js');
const BASE = process.env.BASE || 'http://localhost:8941', OC = process.env.OC || 'painel-dev';
let falhas = 0; const t = (n, c, d) => { if (!c) falhas++; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : ' → ' + JSON.stringify(d).slice(0, 400))); };
const U = (uid, n) => ({ uid, email: uid + '@ciahering.com.br', displayName: n, photoURL: '', providerData: [{ providerId: 'google.com' }] });
const PR = 'https://github.com/caiosoares1899/hering/pull/1500';
const SCRIPT = "console.table([{teste:'Salvar responde', ok: typeof window.saveCard==='function'}]) // script de teste de exemplo";
const bug = (n, uid) => ({ origem: 'assistente_ferias', texto: 'Botão Salvar não responde ' + n, msg: 'x', app: 'Maré Digital', arquivoAlvo: 'kanban-dev.html', impacto: '🟠 Atrapalha muito',
  autor: 'Eve Souza', email: uid + '@ciahering.com.br', uid, status: 'pendente_monitorarbugs', criadoEm: Date.now() - n, ts: new Date().toISOString(), kanbanSquad: 'dados' });
const seed = () => ({ kanban: {
  usuarios: { ana: { uid: 'ana', nome: 'Ana ADM', role: 'adm', inscrito: true, squads: { dados: true } }, eve: { uid: 'eve', nome: 'Eve Souza', role: 'membro', inscrito: true, squads: { dados: true } } },
  usuarios_publicos: { ana: { role: 'adm' }, eve: { role: 'membro' } }, config: { adm_emails: ['ana@ciahering.com.br'] },
  feedback: { bug_ferias_1: bug(1, 'eve'), bug_ferias_2: bug(2, 'ana') },
  plantao: { bug_ferias_1: { estado: 'aguardando', criadoEm: 1, atualizadoEm: 1, tentativas: 0, impacto: '🟠 Atrapalha muito', arquivoAlvo: 'kanban-dev.html', resumo: 'x', cardId: 'c_ferias_1' },
             bug_ferias_2: { estado: 'testando', criadoEm: 2, atualizadoEm: 2, tentativas: 0, prUrl: PR, scriptTeste: SCRIPT, prTitulo: 'fix(kanban-dev): exibir selo Hoje para diff===0', prResumo: 'getDue comparava diff===1; volta para diff===0.' } },
  squads: { dados: { dados: { columns: [{ id: 'backlog', name: 'Backlog' }, { id: 'done', name: 'Concluído' }] } } },
} });

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const abre = async (uid, nome) => {
    const c = await b.newContext({ viewport: { width: 1280, height: 1000 } }); await fake.install(c, seed());
    const p = await c.newPage(); const erros = []; p.on('pageerror', e => erros.push(e.message)); p.on('dialog', d => d.accept());
    await p.goto(`${BASE}/${OC}.html`); await p.waitForFunction(() => !!window.__authCb); await p.evaluate(x => window.__authCb(x), U(uid, nome)); await p.waitForTimeout(2500);
    await p.evaluate(() => swPtab('monitor')); await p.waitForTimeout(1200); return { p, erros, c };
  };
  const pl = (p, id) => p.evaluate(i => JSON.parse(JSON.stringify(window.__store.kanban.plantao[i])), id);
  const toasts = []; const ultimoToast = p => p.evaluate(() => (document.querySelector('.toast, #toast') || {}).textContent || '');
  const clica = async (p, id, acao) => { await p.evaluate(([i, a]) => document.querySelector(`[data-mpl="${a}"][data-id="${i}"]`).click(), [id, acao]); await p.waitForTimeout(500); };
  const preenche = async (p, sel, v) => { await p.evaluate(([s, x]) => { const e = document.querySelector(s); e.value = x; }, [sel, v]); };

  // ── A) quem NÃO é ADM não vê nada do plantão nem botões de status ──
  const e = await abre('eve', 'Eve Souza');
  const html = await e.p.evaluate(() => document.querySelector('#plantao-section').innerHTML);
  t('Membro NÃO vê o painel do plantão, nem os botões de status/validação', !/data-mpl|Plantão de Bugs|Atualizar status/.test(html), html.slice(0, 200));
  await e.p.evaluate(() => window.MarePlantao.admin.acao('bug_ferias_1', 'prod'));
  t('…e chamar a ação direto também não funciona (continua aguardando)', (await pl(e.p, 'bug_ferias_1')).estado === 'aguardando', 1);
  await e.c.close();

  // ── B) ADM ──
  const a = await abre('ana', 'Ana ADM');
  const h = await a.p.evaluate(() => document.querySelector('#plantao-section').innerHTML);
  t('ADM vê o banner do plantão (ligado) e a ficha de cada bug', /Plantão de Bugs/.test(h) && /ligado/.test(h) && (h.match(/class="mpl-card/g) || []).length === 2, h.slice(0, 200));
  t('A ficha mostra estado e tentativas', /Aguardando/.test(h) && /tentativas 0\/3/.test(h), 1);

  await clica(a.p, 'bug_ferias_1', 'validei');
  t('Validar SEM PR e SEM script salvos é recusado', (await pl(a.p, 'bug_ferias_1')).estado === 'aguardando', await pl(a.p, 'bug_ferias_1'));

  await preenche(a.p, '#mpl-pr-bug_ferias_1', 'https://github.com/outra/pessoa/pull/1'); await clica(a.p, 'bug_ferias_1', 'salvar');
  t('PR de outro repositório é recusado', !(await pl(a.p, 'bug_ferias_1')).prUrl, await pl(a.p, 'bug_ferias_1'));

  await preenche(a.p, '#mpl-pr-bug_ferias_1', PR); await clica(a.p, 'bug_ferias_1', 'salvar');
  let f = await pl(a.p, 'bug_ferias_1');
  t('Só o PR salvo → estado "PR aberto"', f.prUrl === PR && f.estado === 'pr_aberto' && !f.scriptTeste, f);
  await clica(a.p, 'bug_ferias_1', 'validei');
  t('Com PR mas SEM script, ainda não valida', (await pl(a.p, 'bug_ferias_1')).estado === 'pr_aberto', 1);

  await preenche(a.p, '#mpl-sc-bug_ferias_1', SCRIPT); await clica(a.p, 'bug_ferias_1', 'salvar');
  f = await pl(a.p, 'bug_ferias_1'); t('PR + script salvos → "Pronto p/ testar"', f.estado === 'testando' && f.scriptTeste === SCRIPT, f);

  await clica(a.p, 'bug_ferias_1', 'reprovei');
  t('Reprovar exige dizer o que falhou (nota)', (await pl(a.p, 'bug_ferias_1')).estado === 'testando', 1);
  await preenche(a.p, '#mpl-nt-bug_ferias_1', 'O botão continua sem responder no Chrome'); await clica(a.p, 'bug_ferias_1', 'reprovei');
  f = await pl(a.p, 'bug_ferias_1'); t('1ª reprovação: estado reprovado, tentativas 1, nota e quem reprovou', f.estado === 'reprovado' && f.tentativas === 1 && /continua sem/.test(f.notaTeste) && f.validadoPorUid === 'ana' && f.resultadoTeste === 'falhou', f);

  await preenche(a.p, '#mpl-pr-bug_ferias_1', PR); await preenche(a.p, '#mpl-sc-bug_ferias_1', SCRIPT); await clica(a.p, 'bug_ferias_1', 'salvar');
  f = await pl(a.p, 'bug_ferias_1'); t('Nova tentativa (novo PR+script) limpa o veredito anterior e volta a "Pronto p/ testar"', f.estado === 'testando' && !f.resultadoTeste && !f.notaTeste && f.tentativas === 1, f);
  for (let i = 2; i <= 3; i++) {
    await preenche(a.p, '#mpl-nt-bug_ferias_1', 'Falhou de novo ' + i); await clica(a.p, 'bug_ferias_1', 'reprovei');
    if (i === 2) { await preenche(a.p, '#mpl-pr-bug_ferias_1', PR); await preenche(a.p, '#mpl-sc-bug_ferias_1', SCRIPT); await clica(a.p, 'bug_ferias_1', 'salvar'); }
  }
  f = await pl(a.p, 'bug_ferias_1'); t('3ª reprovação ESCALA ao Claude (tentativas 3, sem mais botões de teste)', f.estado === 'escalado' && f.tentativas === 3, f);
  const h2 = await a.p.evaluate(() => document.querySelector('.mpl-card[data-id="bug_ferias_1"]').innerHTML);
  t('Escalado mostra o aviso "leve para o Claude" — e continua aceitando PR + script, porque o conserto do Claude também precisa de validação por ADM', /Escalado ao Claude/.test(h2) && /3 reprovações/.test(h2) && /data-mpl="salvar"/.test(h2) && /data-mpl="validei"/.test(h2), h2.slice(0, 200));

  // bug_ferias_2: o ADM Ana é quem REPORTOU → não valida o próprio
  await clica(a.p, 'bug_ferias_2', 'validei');
  t('Quem reportou o bug (ADM) não valida o próprio conserto', (await pl(a.p, 'bug_ferias_2')).estado === 'testando', await pl(a.p, 'bug_ferias_2'));
  await a.c.close();

  // ── C) outro ADM valida o bug que a Ana reportou e leva até produção ──
  const s2 = seed(); s2.kanban.usuarios.bia = { uid: 'bia', nome: 'Bia ADM', role: 'adm', inscrito: true, squads: { dados: true } }; s2.kanban.usuarios_publicos.bia = { role: 'adm' }; s2.kanban.config.adm_emails.push('bia@ciahering.com.br');
  const c = await b.newContext({ viewport: { width: 1280, height: 1000 } }); await fake.install(c, s2);
  const p = await c.newPage(); const erros = []; p.on('pageerror', x => erros.push(x.message));
  await p.goto(`${BASE}/${OC}.html`); await p.waitForFunction(() => !!window.__authCb); await p.evaluate(x => window.__authCb(x), U('bia', 'Bia ADM')); await p.waitForTimeout(2500);
  await p.evaluate(() => swPtab('monitor')); await p.waitForTimeout(1200);
  await preenche(p, '#mpl-nt-bug_ferias_2', 'Rodei o script: tudo ok'); await clica(p, 'bug_ferias_2', 'validei');
  f = await pl(p, 'bug_ferias_2'); t('Outro ADM valida: estado validado, resultado ok, quem validou e quando', f.estado === 'validado' && f.resultadoTeste === 'ok' && f.validadoPorUid === 'bia' && f.validadoPor === 'Bia ADM' && f.validadoEm > 0, f);
  const cms = await p.evaluate(() => { const c = (((window.__store.kanban.squads || {}).dados || {}).dados || {}).card_comments || {}; return Object.values(c.c_ferias_2 || {}); });
  const cor = cms.find(x => /correcao/.test(x.id));
  t('Validar comenta no card o resumo da correção: PR (número, título), o que mudou, quem validou e a nota do ADM', !!cor && /#1500/.test(cor.text) && /exibir selo Hoje/.test(cor.text) && /diff===0/.test(cor.text) && /Bia ADM/.test(cor.text) && /tudo ok/.test(cor.text) && typeof cor.ts === 'string', cor);
  const h3 = await p.evaluate(() => document.querySelector('.mpl-card[data-id="bug_ferias_2"]').innerHTML);
  t('Validado oferece "PR de prod mergeado" (🚀) e esconde os campos de teste', /data-mpl="prod"/.test(h3) && !/mpl-sc-bug_ferias_2/.test(h3), h3.slice(0, 160));
  await clica(p, 'bug_ferias_2', 'prod'); await p.waitForTimeout(800);
  const fin = await p.evaluate(() => ({ pl: window.__store.kanban.plantao.bug_ferias_2.estado, st: window.__store.kanban.feedback.bug_ferias_2.status, notif: Object.keys(((window.__store.kanban.usuarios.ana || {}).notificacoes) || {}) }));
  t('"Em produção" marca o bug Resolvido e avisa quem reportou (sino)', fin.pl === 'em_prod' && fin.st === 'resolvido' && fin.notif.some(k => /nf_bug_bug_ferias_2_resolvido/.test(k)), fin);

  // pausa geral
  await p.evaluate(() => document.querySelector('[data-mpl="pausa"]').click()); await p.waitForTimeout(600);
  const pausado = await p.evaluate(() => ({ cfg: window.__store.kanban.config.plantao_ativo, banner: document.querySelector('#plantao-section').innerHTML.includes('pausado') }));
  t('Pausar plantão grava kanban/config/plantao_ativo = false e o banner muda', pausado.cfg === false && pausado.banner, pausado);
  await p.evaluate(() => document.querySelector('[data-mpl="pausa"]').click()); await p.waitForTimeout(600);
  t('Retomar remove a chave (volta ao padrão: ligado)', await p.evaluate(() => window.__store.kanban.config.plantao_ativo === undefined || window.__store.kanban.config.plantao_ativo === null), 1);
  t('Painel sem erro de JS', erros.length === 0 && a.erros.length === 0 && e.erros.length === 0, [erros, a.erros, e.erros]);
  await b.close(); console.log(falhas ? `\n❌ ${falhas} falha(s)` : '\n✅ Tudo certo'); process.exit(falhas ? 1 : 0);
})();
