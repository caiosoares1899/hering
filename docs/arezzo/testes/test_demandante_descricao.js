// 🔒 Proteção da descrição do Demandante (relato 2026-10-28, midiacriativa: "não salva a descrição" num card DUPLICADO que herdou o Demandante do original).
// (1) o próprio Demandante edita o texto que ele pediu; outra pessoa (membro) continua bloqueada; ADM/PO/Organizador seguem livres. (2) a CÓPIA não herda o Demandante.
//   python3 -m http.server 8941 &   node docs/arezzo/testes/test_demandante_descricao.js        (K=kanban para a produção — antes de promover, A–D devem FALHAR lá)
const { chromium } = require('/opt/node22/lib/node_modules/playwright'); const fake = require('./fakefb.js');
const K = process.env.K || 'kanban-dev'; const SQ = 'midiacriativa';
const user = (uid, nome, init, role) => ({ uid, nome, email: uid + '@ciahering.com.br', inscrito: true, init, role, squads: { [SQ]: true } });
const USERS = { marina: user('marina', 'Marina Saran', 'MS', 'membro'), bea: user('bea', 'Beatriz Lima', 'BL', 'membro'), eve: user('eve', 'Eve Silva', 'EV', 'po') };
const login = u => ({ uid: u, email: u + '@ciahering.com.br', displayName: USERS[u].nome, photoURL: '', providerData: [{ providerId: 'google.com' }] });
const flow = col => ({ enteredAt: { [col]: '2026-10-20T12:00:00.000Z' }, log: [], firstStartAt: null, doneAt: null });
const ORIG = 'Texto original que o demandante escreveu';
const mk = (id, title, extra) => Object.assign({ id, title, col: 'doing', due: '2026-11-30', createdAt: '2026-10-20', desc: ORIG, demandante: 'MS', flow: flow('doing'), updatedAt: '2026-10-27T10:00:00.000Z' }, extra || {});
const seed = () => { const cs = { 0: mk('cD', 'Card do demandante') }; const idx = { cD: '0' }, upd = { cD: cs[0].updatedAt };
  return { kanban: { usuarios: JSON.parse(JSON.stringify(USERS)), usuarios_publicos: Object.fromEntries(Object.entries(USERS).map(([k, v]) => [k, { uid: v.uid, nome: v.nome, init: v.init, role: v.role, squads: v.squads }])), config: { adm_emails: [], demandante_ativo: true },
    squads: { [SQ]: { dados: { cards: cs, cards_index: idx, cards_updated_at: upd, columns: [{ id: 'doing', name: 'Fazendo' }] } } } } }; };
(async () => { const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] }); let ok = true;
  const t = (n, c, d) => { if (!c) ok = false; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : ' → ' + JSON.stringify(d).slice(0, 300))); };
  const abre = async (quem, abrir = true) => { const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); await fake.install(ctx, seed()); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('http://localhost:8941/' + K + '.html?squad=' + SQ); await p.waitForFunction(() => !!window.__authCb); await p.evaluate(x => window.__authCb(x), login(quem)); await p.waitForTimeout(4200);
    if (abrir) { await p.evaluate(() => openCard('cD')); await p.waitForTimeout(700); } return { ctx, p, errs }; };
  const bancoDesc = (p, id) => p.evaluate(([sq, id]) => { const d = window.__store.kanban.squads[sq].dados; const c = Object.values(d.cards).find(x => x && x.id === id); return c ? c.desc : null; }, [SQ, id || 'cD']);
  const digita = (p, txt) => p.evaluate(x => { const ta = document.getElementById('m-desc'); ta.readOnly = false; ta.value = x; ta.dispatchEvent(new Event('input', { bubbles: true })); }, txt);
  const NOVO = 'Texto totalmente reescrito para outra campanha';

  { const { ctx, p, errs } = await abre('marina');     // A: a própria demandante
    t('A1. o Demandante NÃO fica com a descrição travada', await p.evaluate(() => !_isDescLocked()), '');
    await digita(p, NOVO); await p.waitForTimeout(1600);
    t('A2. o autosave GRAVA a descrição reescrita pelo Demandante', (await bancoDesc(p)) === NOVO, await bancoDesc(p));
    await digita(p, NOVO + ' (2)'); await p.evaluate(() => saveCard()); await p.waitForTimeout(1200);
    t('A3. o botão Salvar também grava', (await bancoDesc(p)) === NOVO + ' (2)', await bancoDesc(p));
    const hist = await p.evaluate(sq => { const d = window.__store.kanban.squads[sq].dados; return (Object.values(d.cards)[0].history || []).filter(h => /descrição/.test(h.what)).length; }, SQ);
    t('A4. e a edição entra no Histórico do card', hist >= 1, hist); t('A5. sem erro de JS', !errs.length, errs); await ctx.close(); }

  { const { ctx, p } = await abre('bea');              // B: outra pessoa (membro) segue bloqueada
    t('B1. outra pessoa (membro) continua com a descrição TRAVADA', await p.evaluate(() => _isDescLocked()), '');
    await digita(p, NOVO); await p.waitForTimeout(1600);
    t('B2. e o autosave dela NÃO substitui o texto original', (await bancoDesc(p)) === ORIG, await bancoDesc(p));
    await digita(p, ORIG + ' + complemento dela'); await p.waitForTimeout(1600);
    t('B3. acrescentar por cima do texto original continua permitido', (await bancoDesc(p)) === ORIG + ' + complemento dela', await bancoDesc(p)); await ctx.close(); }

  { const { ctx, p } = await abre('eve');              // C: PO segue livre
    t('C1. PO/ADM/Organizador seguem livres', await p.evaluate(() => !_isDescLocked()), '');
    await digita(p, NOVO); await p.waitForTimeout(1600); t('C2. e gravam a substituição', (await bancoDesc(p)) === NOVO, await bancoDesc(p)); await ctx.close(); }

  { const { ctx, p } = await abre('bea');              // D: trocar o select para si mesma NÃO destrava (vale o demandante já SALVO)
    await p.evaluate(() => { const s = document.getElementById('m-demandante'); s.value = 'BL'; });
    t('D. escolher a si mesma no campo Demandante NÃO libera a trava antes de salvar', await p.evaluate(() => _isDescLocked()), ''); await ctx.close(); }

  { const { ctx, p, errs } = await abre('bea', false); // E: a CÓPIA não herda o Demandante (sem abrir o card original antes: reabrir um 2º card no Firebase falso entra em laço)
    const copia = await p.evaluate(() => { const c = cards.find(x => x.id === 'cD'); const n = _duplicarCardObj(c, {}); return { dem: n.demandante, desc: n.desc, titulo: n.title }; });
    t('E1. a cópia NÃO herda o Demandante e mantém o texto', copia.dem === undefined && copia.desc === ORIG && /cópia/.test(copia.titulo), copia);
    t('E2. o card original continua com o Demandante', await p.evaluate(() => cards.find(x => x.id === 'cD').demandante === 'MS'), '');
    await p.evaluate(() => { const n = _duplicarCardObj(cards.find(x => x.id === 'cD'), {}); cards.push(n); openCard(n.id); }); await p.waitForTimeout(700);
    t('E3. quem duplicou consegue reescrever a descrição da cópia', await p.evaluate(() => !_isDescLocked()), '');
    t('E4. sem erro de JS', !errs.length, errs); await ctx.close(); }
  await b.close(); console.log(ok ? '\nTUDO OK (' + K + ')' : '\nHÁ FALHAS (' + K + ')'); process.exit(ok ? 0 : 1); })();
