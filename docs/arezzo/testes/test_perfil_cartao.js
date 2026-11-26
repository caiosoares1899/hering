// 👤 Perfil da pessoa — o cartão compartilhado (mare-perfil-dev.js) na Concha e a edição em Oceano › ⚙ Meu perfil › 👤 Meu cartão (26/11/2026).
// Decisões do Caio: cargo, telefone/WhatsApp, aniversário (dia/mês) e LinkedIn; a pessoa preenche no Oceano; toda a Hering vê; abre pela foto/nome.
// Fronteira: texto de outra pessoa só por textContent; links montados pelo módulo (wa.me só dígitos, LinkedIn só o <id>, foto só https).
// Rodar na raiz: python3 -m http.server 8949  →  node docs/arezzo/testes/test_perfil_cartao.js
const fs = require('node:fs'), path = require('node:path'), home = require('node:os').homedir();
const fake = require('./fakefb.js');
const { update: regras } = require('../../../functions/rules/rulesSim.js');
const RULES = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../database.rules.json'), 'utf8'));
const base = process.env.BASE_URL || 'http://127.0.0.1:8949';
const U = (uid, nome) => ({ uid, email: uid + '@ciahering.com.br', displayName: nome, photoURL: '', providerData: [{ providerId: 'google.com' }] });
const PAU = U('pau', 'Paula PO'), ANA = U('ana', 'Ana Lima');
const ag = Date.now();
const P = (n, x) => Object.assign({ nome: n, email: n.split(' ')[0].toLowerCase() + '@ciahering.com.br', squads: { dados: true } }, x || {});
const seed = () => ({ kanban: {
  usuarios: { pau: { role: 'membro', squads: { dados: true }, squads_roles: { dados: 'po' } }, ana: { role: 'membro', squads: { dados: true } } },
  usuarios_publicos: { bob: P('Bob Smith'), pau: P('Paula PO'), ana: P('Ana Lima', { diretoria: 'digital', foto: 'javascript:alert(1)' }) },
  squads_meta: { dados: { label: 'Dados', emoji: '📊' } },
  perfis: { bob: { tel: '+12025550123' }, ana: { cargo: '<img src=x onerror="window.__xss=1">Analista', tel: '+5547999998888', niver: '03-15', li: 'ana-lima' } },
  cardume: {
    canais: { dados: { nome: 'Dados' } }, membros: { dados: { pau: true, ana: true } }, meus: { pau: { dados: true }, ana: { dados: true } },
    msgs: { dados: { m1: { uid: 'ana', ts: ag - 60000, texto: 'oi, pessoal' }, m2: { uid: 'pau', ts: ag - 30000, texto: 'bom dia' } } },
  } } });
let ok = true, total = 0;
const t = (n, c, d) => { total++; if (!c) ok = false; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : '  ← ' + String(JSON.stringify(d)).slice(0, 400))); };
const authDe = u => ({ uid: u.uid, token: { email: u.email, firebase: { sign_in_provider: 'google.com' } } });
(async () => {
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(home, 'hering-tools/playwright/node_modules/playwright'));
  const cr = path.join(home, 'hering-tools/chrome');
  const chrome = process.env.CHROME || (fs.existsSync(cr) ? path.join(cr, fs.readdirSync(cr).find(n => n.startsWith('mac_arm-')), 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing') : undefined);
  const b = await chromium.launch(chrome ? { executablePath: chrome } : {});
  const abre = async (url, quem, comLembrete) => {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 860 } }); await fake.install(ctx, seed(), { perfil: true });
    await ctx.addInitScript(l => { localStorage.setItem('oceano_prefs', JSON.stringify({ peixes: 'off' })); if (!l) ['pau', 'ana'].forEach(u => localStorage.setItem('mare_perfil_lembrete_' + u, 'nunca')); }, !!comLembrete);
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(base + url); await p.waitForFunction(() => !!window.__authCb);
    await p.evaluate(x => window.__authCb(x), quem); await p.waitForTimeout(1200);
    return { ctx, p, errs };
  };
  const cartao = p => p.evaluate(() => { const c = document.querySelector('.mp-ov:not([hidden]) .mp-card'); if (!c) return null;
    return { nome: (c.querySelector('.mp-nome') || {}).textContent, cargo: (c.querySelector('.mp-cargo') || {}).textContent || '', txt: c.textContent,
      links: [...c.querySelectorAll('a')].map(a => a.getAttribute('href')), img: !!c.querySelector('img'), editar: !!c.querySelector('.mp-pri'), dica: !!c.querySelector('.mp-dica') }; });

  // ── Concha: Paula abre o cartão da Ana pelo nome da mensagem ──
  { const { ctx, p, errs } = await abre('/cardume-dev.html?c=dados', PAU);
    t('o nome do autor é botão "Ver o perfil de Ana Lima"', await p.evaluate(() => !!document.querySelector('button.perfil-nome[data-perfil="ana"]')), 0);
    await p.click('button.perfil-nome[data-perfil="ana"]'); await p.waitForTimeout(400);
    let c = await cartao(p);
    t('o cartão abre com nome, cargo e chips (diretoria e squad pelo nome)', c && c.nome === 'Ana Lima' && /Analista/.test(c.cargo) && /Digital/.test(c.txt) && /Dados/.test(c.txt), c);
    t('cargo com HTML entra como TEXTO (sem <img>, sem script)', c && /<img/.test(c.cargo) && !c.img && await p.evaluate(() => !window.__xss), c);
    t('foto que não é https não vira <img>', c && !c.img, c);
    t('aniversário por extenso', c && /15 de março/.test(c.txt), c);
    t('links: e-mail, WhatsApp (wa.me só dígitos), ligar e LinkedIn montado pelo id', c && JSON.stringify(c.links) === JSON.stringify(['mailto:ana@ciahering.com.br', 'https://wa.me/5547999998888', 'tel:+5547999998888', 'https://www.linkedin.com/in/ana-lima/']), c && c.links);
    t('o cartão de outra pessoa não tem "Editar" nem a dica', c && !c.editar && !c.dica, c);
    await p.keyboard.press('Escape'); await p.evaluate(() => MarePerfil.abrir('bob')); await p.waitForTimeout(400);
    const cb = await cartao(p);
    t('número estrangeiro (+1…) não ganha 55: wa.me/12025550123', cb && cb.links.includes('https://wa.me/12025550123') && /\+12025550123/.test(cb.txt), cb && cb.links);
    await p.keyboard.press('Escape'); await p.waitForTimeout(100);
    await p.click('button.perfil-nome[data-perfil="ana"]'); await p.waitForTimeout(300);
    await p.keyboard.press('Escape'); await p.waitForTimeout(150);
    t('Esc fecha e o foco volta ao nome clicado', await p.evaluate(() => document.querySelector('.mp-ov').hidden && document.activeElement && document.activeElement.dataset.perfil === 'ana'), 0);
    t('Esc do cartão não fecha nem mexe na conversa', await p.evaluate(() => window.__cardume.estado.atual === 'dados'), 0);
    // a foto também abre (mouse); o próprio cartão tem Editar → Oceano
    await p.click('.grupo .avatar[data-perfil="pau"]'); await p.waitForTimeout(400);
    c = await cartao(p);
    t('a foto abre o MEU cartão: "Cargo não informado", a dica e "Editar meu perfil"', c && c.nome === 'Paula PO' && /Cargo não informado/.test(c.txt) && c.dica && c.editar, c);
    t('só 1 leitura de perfis/{uid} por pessoa (cache de 5 min)', await p.evaluate(() => { const n = (window.__log || []).filter(x => x[1] === 'kanban/perfis/pau').length; return n === 1; }), await p.evaluate(() => (window.__log || []).filter(x => /perfis/.test(x[1]))));
    await p.click('.mp-pri'); await p.waitForTimeout(400);
    t('"Editar meu perfil" leva ao Oceano › Meu cartão', /oceano-dev\.html#meu-cartao$/.test(p.url()) || /oceano-dev\.html/.test(p.url()), p.url());
    t('sem erro na página', !errs.length, errs);
    await ctx.close(); }

  // ── sugestão de @ não abre o cartão ──
  { const { ctx, p, errs } = await abre('/cardume-dev.html?c=dados', PAU);
    t('nas sugestões de @menção a foto não tem data-perfil', await p.evaluate(() => { return !!document.getElementById('entrada'); }), 0);
    await p.fill('#entrada', '@an'); await p.dispatchEvent('#entrada', 'input'); await p.waitForTimeout(300);
    t('…e a sugestão segue sendo só sugestão', await p.evaluate(() => !document.querySelector('.sugestao [data-perfil]')), 0);
    t('sem erro na página', !errs.length, errs);
    await ctx.close(); }

  // ── Oceano: a Paula preenche o próprio cartão ──
  { const { ctx, p, errs } = await abre('/oceano-dev.html#meu-cartao', PAU);
    await p.waitForSelector('#pf-cargo', { timeout: 8000 }).catch(() => {});
    t('#meu-cartao abre o ⚙ Meu perfil na seção 👤 Meu cartão', await p.evaluate(() => !!document.getElementById('pf-cartao-sec') && document.getElementById('ov-perfil').classList.contains('open')), 0);
    const preenche = async (id, v) => { await p.fill('#' + id, v); await p.dispatchEvent('#' + id, 'change'); await p.waitForTimeout(250); };
    await preenche('pf-cargo', 'Product Owner'); await preenche('pf-tel', '(47) 3333-4444'); await preenche('pf-niver', '5/12'); await preenche('pf-li', 'https://www.linkedin.com/in/paula-po/?trk=x');
    let pf = await p.evaluate(() => JSON.parse(JSON.stringify((window.__store.kanban.perfis || {}).pau || null)));
    t('grava cargo, tel (+55 e só dígitos), niver MM-DD e LinkedIn só o id', pf && pf.cargo === 'Product Owner' && pf.tel === '+554733334444' && pf.niver === '12-05' && pf.li === 'paula-po', pf);
    await preenche('pf-tel', '123'); await preenche('pf-niver', '31/02'); await preenche('pf-li', 'https://example.com/paula');
    pf = await p.evaluate(() => JSON.parse(JSON.stringify(window.__store.kanban.perfis.pau)));
    t('valor inválido não grava (telefone curto, 31/02, link que não é do LinkedIn)', pf.tel === '+554733334444' && pf.niver === '12-05' && pf.li === 'paula-po', pf);
    await preenche('pf-tel', '');
    pf = await p.evaluate(() => JSON.parse(JSON.stringify(window.__store.kanban.perfis.pau)));
    t('apagar o campo tira o telefone do cartão', !('tel' in pf), pf);
    const esc = await p.evaluate(() => (window.__escritas || []).filter(e => /kanban\/perfis/.test(e.p)));
    const ruins = esc.filter(e => { const real = Date.now; Date.now = () => e.t; try { return !regras(RULES, e.antes, authDe(PAU), { [e.p]: e.v }); } finally { Date.now = real; } }).map(e => e.p);
    t('todas as escritas do Oceano passam nas regras reais (' + esc.length + ')', esc.length >= 5 && !ruins.length, ruins);
    await p.click('#pf-ver-cartao'); await p.waitForTimeout(400);
    const c = await cartao(p);
    t('👁 Ver meu cartão mostra o cartão com o que acabou de salvar', c && /Product Owner/.test(c.cargo) && /5 de dezembro/.test(c.txt) && c.links.includes('https://www.linkedin.com/in/paula-po/'), c);
    await p.click('.mp-pri'); await p.waitForTimeout(300);
    t('"Editar meu perfil" dentro do Oceano volta para a seção (sem recarregar)', await p.evaluate(() => document.getElementById('ov-perfil').classList.contains('open') && document.querySelector('.mp-ov').hidden), 0);
    t('sem erro na página', !errs.length, errs);
    await ctx.close(); }

  // ── dentro do Oceano (iframe do lobby): "Editar" pede ao lobby, e o convite não aparece ──
  { const ctx = await b.newContext({ viewport: { width: 1280, height: 860 } }); await fake.install(ctx, seed(), { perfil: true });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(base + '/version.json');
    await p.evaluate(u => { window.__msgs = []; window.addEventListener('message', e => window.__msgs.push(e.data)); const f = document.createElement('iframe'); f.style.cssText = 'width:1200px;height:800px'; f.src = u; document.body.append(f); }, base + '/cardume-dev.html?c=dados');
    await p.waitForTimeout(800);
    const fr = p.frames().find(f => /cardume-dev/.test(f.url()));
    await fr.waitForFunction(() => !!window.__authCb); await fr.evaluate(x => window.__authCb(x), PAU); await fr.waitForTimeout(4500);
    t('no iframe do Oceano o convite NÃO aparece (o lobby convida)', await fr.evaluate(() => !document.querySelector('.mp-ov:not([hidden])')), 0);
    await fr.evaluate(() => MarePerfil.abrir('pau')); await fr.waitForTimeout(400);
    await fr.click('.mp-pri'); await p.waitForTimeout(300);
    t('"Editar meu perfil" no iframe pede ao lobby {oceano:"prefs", secao:"cartao"} e não navega', JSON.stringify(await p.evaluate(() => window.__msgs)).includes('{"oceano":"prefs","secao":"cartao"}') && /cardume-dev/.test(fr.url()), await p.evaluate(() => window.__msgs));
    t('sem erro na página', !errs.length, errs);
    await ctx.close(); }

  // ── 👤 lembrete de completar o cartão (pedido do Caio: ao entrar/recarregar; dá para adiar) ──
  const lembrete = p => p.evaluate(() => { const c = document.querySelector('.mp-ov:not([hidden]) .mp-card'); return c && /Complete o seu cartão/.test(c.textContent) ? [...c.querySelectorAll('button')].map(x => x.textContent) : null; });
  { const { ctx, p, errs } = await abre('/cardume-dev.html?c=dados', ANA, true);
    await p.waitForTimeout(3500);
    t('quem já preencheu o cartão (Ana) não é convidado', !(await lembrete(p)), await lembrete(p));
    await ctx.close(); }
  { const { ctx, p, errs } = await abre('/cardume-dev.html?c=dados', PAU, true);
    await p.waitForTimeout(3500);
    t('Concha: quem não preencheu nada (Paula) vê o convite com Preencher agora / Depois / Não mostrar mais', JSON.stringify(await lembrete(p)) === JSON.stringify(['Não mostrar mais', 'Depois', 'Preencher agora']), await lembrete(p));
    t('o foco vai para "Preencher agora"', await p.evaluate(() => document.activeElement && document.activeElement.textContent === 'Preencher agora'), 0);
    await p.click('.mp-acoes button:has-text("Depois")'); await p.waitForTimeout(200);
    t('"Depois" fecha e adia (marca o dia neste aparelho)', await p.evaluate(() => document.querySelector('.mp-ov').hidden && /^\d{4}-\d{1,2}-\d{1,2}$/.test(localStorage.getItem('mare_perfil_lembrete_pau') || '')), 0);
    await p.reload(); await p.waitForFunction(() => !!window.__authCb); await p.evaluate(x => window.__authCb(x), PAU); await p.waitForTimeout(4500);
    t('recarregar no mesmo dia não pergunta de novo', !(await lembrete(p)), await lembrete(p));
    await p.evaluate(() => localStorage.setItem('mare_perfil_lembrete_pau', '2020-1-1'));
    await p.reload(); await p.waitForFunction(() => !!window.__authCb); await p.evaluate(x => window.__authCb(x), PAU); await p.waitForTimeout(4500);
    t('no dia seguinte (próxima entrada) pergunta de novo', !!(await lembrete(p)), 0);
    await p.click('.mp-acoes button:has-text("Preencher agora")'); await p.waitForTimeout(500);
    t('"Preencher agora" na Concha leva ao Oceano › Meu cartão', /oceano-dev\.html#meu-cartao$/.test(p.url()) || /oceano-dev\.html$/.test(p.url()), p.url());
    t('sem erro na página', !errs.length, errs);
    await ctx.close(); }
  { const { ctx, p, errs } = await abre('/oceano-dev.html', PAU, true);
    await p.waitForTimeout(4000);
    const l = await lembrete(p);
    t('Oceano: o convite aparece também', !!l, l);
    if (l) { await p.click('.mp-acoes button:has-text("Preencher agora")'); await p.waitForTimeout(400); }
    t('"Preencher agora" no Oceano abre ⚙ Meu perfil › 👤 Meu cartão ali mesmo', await p.evaluate(() => document.getElementById('ov-perfil').classList.contains('open') && !!document.getElementById('pf-cargo')), 0);
    await p.fill('#pf-cargo', 'PO'); await p.dispatchEvent('#pf-cargo', 'change'); await p.waitForTimeout(300);
    t('o cargo preenchido pelo convite foi gravado (quem tem algo preenchido não é mais convidado: ver o caso da Ana)', await p.evaluate(() => ((window.__store.kanban.perfis || {}).pau || {}).cargo === 'PO'), 0);   // o banco falso volta à semente a cada recarga
    t('sem erro na página', !errs.length, errs);
    await ctx.close(); }

  await b.close();
  console.log((ok ? '\n✅ ' : '\n❌ ') + total + ' verificações');
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
