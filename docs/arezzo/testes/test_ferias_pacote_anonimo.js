// TESTE — Assistente Férias (oceano-dev): o que SAI para o agente de código é só o BUG (pacote anônimo), e nada vai para o GitHub.
//
// Por que existe (PR "Plantão — contenção", 16/10/2026): o fluxo antigo montava uma Issue PÚBLICA com nome + e-mail de quem reportou,
// o prompt do /monitorarbugs levava o nome da pessoa, e a página consultava a API do GitHub aceitando status de qualquer comentário.
// Este teste dirige o Oceano de verdade (formulário → feriasEnviarBug) com o Firebase falso e confere o resultado.
//
// Roda:   (na raiz do repositório)  (python3 -m http.server 8941 >/dev/null 2>&1 &)   e depois   node docs/arezzo/testes/test_ferias_pacote_anonimo.js
// Env:    BASE=http://localhost:8941   OC=oceano-dev
const { chromium } = require('/opt/node22/lib/node_modules/playwright'); const fake = require('./fakefb.js');
const BASE = process.env.BASE || 'http://localhost:8941', OC = process.env.OC || 'oceano-dev';
let falhas = 0; const t = (n, c, d) => { if (!c) falhas++; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : ' → ' + JSON.stringify(d).slice(0, 400))); };
const U = (uid, n) => ({ uid, email: uid + '@ciahering.com.br', displayName: n, photoURL: '', providerData: [{ providerId: 'google.com' }] });
const seed = () => ({ kanban: {
  usuarios: { eve: { uid: 'eve', nome: 'Eve Souza', email: 'eve@ciahering.com.br', init: 'ES', role: 'membro', inscrito: true, squads: { dados: true } } },
  usuarios_publicos: { eve: { uid: 'eve', nome: 'Eve Souza', init: 'ES', role: 'membro', squads: { dados: true } } },
  config: { adm_emails: [] },
  squads: { dados: { dados: { columns: [{ id: 'backlog', name: 'Backlog', color: '#888888' }, { id: 'done', name: 'Concluído', color: '#639922', collapsible: true }] } } },
} });
const PII = ['Eve', 'Souza', 'eve@ciahering', 'maria.silva@ciahering.com.br', 'https://drive.google.com', '11 98888-7777', '123.456.789-09', 'AIzaSyD0nTL3akThisKeyAbcdefghijk123456'];

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const c = await b.newContext({ viewport: { width: 1280, height: 900 } }); await fake.install(c, seed());
  const chamadasGithub = []; await c.route(/github\.com/, r => { chamadasGithub.push(r.request().url()); r.abort(); });
  const p = await c.newPage(); const erros = []; p.on('pageerror', e => erros.push(e.message));
  await p.goto(`${BASE}/${OC}.html?ferias=1`); await p.waitForFunction(() => !!window.__authCb); await p.evaluate(x => window.__authCb(x), U('eve', 'Eve Souza')); await p.waitForTimeout(2500);

  // A) funções puras
  const pura = await p.evaluate(() => ({
    sane: window.feriasSanitizarTexto('Oi maria.silva@ciahering.com.br veja https://drive.google.com/x?token=abc fone 11 98888-7777 cpf 123.456.789-09 chave AIzaSyD0nTL3akThisKeyAbcdefghijk123456'),
    pacote: window.feriasMontarPacoteAnonimo({ arquivoAlvo: 'kanban-dev.html', app: 'Maré Digital', impacto: '🟠 Atrapalha muito', texto: 'Botão Salvar não responde', erroConsole: 'TypeError at eve@ciahering.com.br', autor: 'Eve Souza', email: 'eve@ciahering.com.br', uid: 'eve', evidenciaLink: 'https://drive.google.com/x', evidenciaImg: 'data:image/png;base64,AAAA', promptAntigravity: 'Eve Souza disse' }),
  }));
  t('Sanitizar tira e-mail, link, telefone, CPF e chave longa', !/@|https?:|98888|123\.456|AIzaSy/.test(pura.sane) && /\[e-mail\]/.test(pura.sane) && /\[link\]/.test(pura.sane), pura.sane);
  t('Pacote tem o bug (arquivo, impacto, descrição) e começa com /plantaobug', /^\/plantaobug em kanban-dev\.html/.test(pura.pacote) && /Atrapalha muito/.test(pura.pacote) && /Botão Salvar não responde/.test(pura.pacote), pura.pacote);
  t('Pacote NÃO leva autor, e-mail, uid, link, print nem o prompt antigo — mesmo se o registro tiver tudo isso', !/Eve|Souza|@ciahering|drive\.google|data:image|AAAA/.test(pura.pacote), pura.pacote);
  t('Nome de arquivo fora do padrão é limpo (sem caminho/injeção)', await p.evaluate(() => !/[\s;&|\/]/.test(window.feriasMontarPacoteAnonimo({ arquivoAlvo: 'x.html; rm -rf /', texto: 'a' }).split(' ')[2])), 1);

  // B) fluxo real do formulário
  await p.evaluate(() => window.abrirFeriasCaio('bugs')); await p.waitForTimeout(600);
  await p.fill('#fbug-desc', 'Ao clicar em Salvar nada acontece. Falei com maria.silva@ciahering.com.br, fone 11 98888-7777');
  await p.fill('#fbug-link', 'https://drive.google.com/file/d/123/view');
  await p.fill('#fbug-console', 'TypeError: x is undefined (eve@ciahering.com.br) 123.456.789-09 AIzaSyD0nTL3akThisKeyAbcdefghijk123456');
  await p.click('#fbug-submit'); await p.waitForTimeout(1800);

  const out = await p.evaluate(() => {
    const fb = window.__store.kanban.feedback || {}; const id = Object.keys(fb).find(k => /^bug_ferias_/.test(k)); const reg = fb[id] || {};
    const res = document.querySelector('#fbug-res'); const cmd = res && res.querySelector('.ferias-cmd');
    const cardDesc = (() => { const cs = Object.values((((window.__store.kanban.squads.dados || {}).dados || {}).cards) || {}); return cs.map(x => x.desc || x.description || '').join('\n'); })();
    return { id, reg, painel: res ? res.innerHTML : '', cmd: cmd ? cmd.textContent : '', copia: res ? [...res.querySelectorAll('[data-fbug-copy]')].map(x => x.getAttribute('data-fbug-copy')) : [], cardDesc };
  });
  t('O bug foi gravado em kanban/feedback com autor/e-mail/uid (dados confidenciais ficam no Firebase)', !!out.id && out.reg.autor === 'Eve Souza' && out.reg.email === 'eve@ciahering.com.br' && out.reg.uid === 'eve', out.reg);
  t('O registro NÃO guarda mais o prompt com o nome de quem reportou (promptAntigravity)', !('promptAntigravity' in out.reg), Object.keys(out.reg));
  t('Quem reporta NÃO vê o pacote nem o comando do agente (isso é do ADM, no Painel › Monitor)', !out.cmd && out.copia.length === 0 && !/plantaobug|Antigravity|monitorarbugs/i.test(out.painel), out.painel.slice(0, 300));
  t('O pacote anônimo do módulo não leva nenhum dado pessoal', await p.evaluate(x => { const c = window.MarePlantao.montarPacote({ arquivoAlvo: 'kanban-dev.html', app: 'Maré Digital', impacto: 'x', texto: x }); return c.startsWith('/plantaobug em ') && !/maria\.silva|98888|drive\.google/.test(c); }, 'Falei com maria.silva@ciahering.com.br fone 11 98888-7777 https://drive.google.com/x'), 1);
  t('Nenhum link nem botão de GitHub na confirmação (o texto pode dizer que NÃO precisa de Issue)', !/github\.com|issues\/new|🐙/i.test(out.painel), out.painel.slice(0, 300));
  t('O card da Squad Dados recebeu o pacote anônimo (e não o prompt com o nome)', /PACOTE ANÔNIMO/.test(out.cardDesc) && !/COMANDO ANTIGRAVITY|ISSUE NO GITHUB/.test(out.cardDesc), out.cardDesc.slice(0, 300));
  t('O card guarda o link de evidência (confidencial, fica só no card — não no pacote)', /drive\.google\.com/.test(out.cardDesc) && !/drive\.google/.test(out.cmd || ''), 1);
  t('A página NÃO chamou o GitHub (API pública nem issue) em nenhum momento', chamadasGithub.length === 0, chamadasGithub);
  t('Oceano sem erro de JS', erros.length === 0, erros);
  await b.close(); console.log(falhas ? `\n❌ ${falhas} falha(s)` : '\n✅ Tudo certo'); process.exit(falhas ? 1 : 0);
})();
