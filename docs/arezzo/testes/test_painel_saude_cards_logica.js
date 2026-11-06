// 🛡️ Painel › Saúde dos cards — a LÓGICA e o HTML (sem navegador): carrega o bloco "SAÚDE DOS CARDS" do painel-dev.html num `vm` e testa classificação, bolinha de saúde, escape e permissões.
//   node docs/arezzo/testes/test_painel_saude_cards_logica.js        (o teste de navegador/3 temas/390 px continua em test_painel_saude_cards.js — precisa de Playwright)
const fs = require('fs'), vm = require('vm'), path = require('path'), assert = require('assert');
const src = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'painel-dev.html'), 'utf8');
const bloco = src.slice(src.indexOf('const _SC_DIAS = 30'), src.indexOf('async function loadStatusData('));
assert.ok(bloco.length > 1000, 'bloco da Saúde dos cards encontrado');
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function carregar({ adm = true, role = 'adm' } = {}) {
  const ctx = { esc, location: { pathname: '/painel-dev.html' }, window: { _currentUserRole: role, _currentUser: { uid: 'u1', displayName: 'Ana' } }, _isAdmPainel: () => adm, SQUADS: [], _SQ_ID_OK: /^[A-Za-z0-9_-]{1,40}$/,
    console, Date, Math, Object, Array, String, Number, Set, Promise, JSON, encodeURIComponent, showToast() {}, uiConfirm: () => Promise.resolve(true), document: { getElementById: () => null } };
  vm.createContext(ctx); vm.runInContext(bloco + '\nthis.__api = { _scMontarEventos, _scSaude, _scItemHtml, _scEhAbertoEv, _scEhRestEv, _scEhResolvidoEv, _scPodeResolver, _scCausa, _SC_ACAO, setAbertos: (s)=>{ _scAbertos = s; } };', ctx);
  return ctx.__api;
}
const AGORA = Date.parse('2026-11-06T12:00:00Z'), ago = (h) => new Date(AGORA - h * 3600000).toISOString();
let ok = true; const t = (n, f) => { try { f(); console.log('✅ ' + n); } catch (e) { ok = false; console.log('❌ ' + n + ' → ' + (e.message || e).toString().slice(0, 300)); } };

const lidos = [{ id: 'midia', g: {
  g1: { cardId: 'c1', titulo: 'Restaurado hoje', acao: 'restaurado', detectadoEm: ago(2) },
  g2: { cardId: 'c2', titulo: 'Sem cópia <img src=x onerror=alert(1)>', acao: 'sem_espelho', detectadoEm: ago(3), causaCodigo: 'sem_carimbo', causaTexto: 'Nenhum carimbo <b>x</b>', causadoPor: { por: 'Juliana <script>', ver: 'v8.30.908', origem: 'reordenar' } },
  g3: { cardId: 'c3', titulo: 'Antigo em massa', acao: 'em_massa', detectadoEm: ago(24 * 10) },
  g4: { cardId: 'c4', titulo: 'Já tratado', acao: 'reincidente', detectadoEm: ago(24 * 5) },
  g5: { cardId: 'velho', titulo: 'Fora de 30 dias', acao: 'sem_espelho', detectadoEm: ago(24 * 40) } },
  r: { g4: { por: 'Caio', uid: 'caio', em: ago(1) } },
  a: { a1: { cardId: 'c1', cardTitle: 'já socorrido', detectadoEm: ago(2.001) }, a2: { cardId: 'c9', cardTitle: 'Alarme sem socorro', detectadoEm: ago(4) }, a3: { cardId: 'c8', cardTitle: 'Alarme resolvido', detectadoEm: ago(30) } } }];
lidos[0].r.alarme_a3 = { por: 'Caio', uid: 'caio', em: ago(1) };

t('classificação: precisam de você / restaurados / resolvidos (alarme resolvido e incidente resolvido saem da fila; restaurado vai para a aba própria; alarme já socorrido não duplica; >30 dias fora)', () => {
  const A = carregar(), ev = A._scMontarEventos(lidos, AGORA);
  const ab = ev.filter(A._scEhAbertoEv).map((e) => e.chave).sort(), re = ev.filter(A._scEhRestEv).map((e) => e.chave), rs = ev.filter(A._scEhResolvidoEv).map((e) => e.chave).sort();
  assert.deepStrictEqual(Array.from(ab), ['alarme_a2', 'g2', 'g3']); assert.deepStrictEqual(Array.from(re), ['g1']); assert.deepStrictEqual(Array.from(rs), ['alarme_a3', 'g4']);
  assert.ok(!ev.some((e) => e.chave === 'g5' || e.chave === 'alarme_a1'));
});
t('ordem: mais novo primeiro', () => { const ev = carregar()._scMontarEventos(lidos, AGORA); for (let i = 1; i < ev.length; i++) assert.ok(ev[i - 1].em >= ev[i].em); });
t('bolinha: verde ativo / vermelha sem pulso (>=15 min) / vermelha espelho atrasado / cinza sem nó', () => {
  const A = carregar();
  assert.strictEqual(A._scSaude({ ts: ago(0.05), ok: true }, AGORA).ok, true); assert.match(A._scSaude({ ts: ago(0.05), ok: true }, AGORA).texto, /ativo · pulso há 3 min/);
  const velho = A._scSaude({ ts: ago(0.5), ok: true }, AGORA); assert.strictEqual(velho.ok, false); assert.match(velho.texto, /sem pulso há 30 min/);
  const atr = A._scSaude({ ts: ago(0.01), ok: false, atrasoMaxMin: 12 }, AGORA); assert.strictEqual(atr.ok, false); assert.match(atr.texto, /atrasado 12 min/);
  const sem = A._scSaude(null, AGORA); assert.strictEqual(sem.ok, null); assert.match(sem.texto, /aguardando o primeiro pulso/);
});
t('HTML do episódio: escapa título/autor/causa (nada vira tag), mostra autor SÓ se o servidor provou, botão Resolver só para quem pode', () => {
  const A = carregar(), e = A._scMontarEventos(lidos, AGORA).find((x) => x.chave === 'g2'), h = A._scItemHtml(e, true);
  assert.ok(!/<img |<script|<b>x/.test(h), h.slice(0, 400)); assert.match(h, /&lt;img src=x onerror=alert\(1\)&gt;/); assert.match(h, /Causado por: <b>Juliana &lt;script&gt;<\/b> \(v8\.30\.908 · reordenar\)/);
  assert.match(h, /data-sc-acao="resolver"/); assert.ok(!/data-sc-acao="resolver"/.test(A._scItemHtml(e, false)), 'sem permissão: sem botão');
  const semAutor = A._scItemHtml(A._scMontarEventos(lidos, AGORA).find((x) => x.chave === 'g3'), true); assert.match(semAutor, /Autor não identificado/); assert.ok(!/@|email|foto/i.test(semAutor));
});
t('pista (contexto) NUNCA é apresentada como culpado', () => {
  const A = carregar(), e = { chave: 'z', sq: 'dados', cardId: 'c', titulo: 'T', em: ago(1), acao: 'sem_espelho', res: null, causa: A._scCausa({ causaTexto: 'x', contexto: { ultimaEscritaEstrutural: { por: 'Vinicius', ver: 'v1', origem: 'reordenar', haSeg: 4 } } }) };
  const h = A._scItemHtml(e, true); assert.match(h, /Pista \(não é culpa comprovada\)/); assert.ok(!/Causado por/.test(h));
});
t('resolvido: mostra quem na linha E quem/quando no corpo, sem botão; restaurado: link para abrir o card e sem botão de resolver', () => {
  const A = carregar(), ev = A._scMontarEventos(lidos, AGORA), res = A._scItemHtml(ev.find((x) => x.chave === 'g4'), true), rest = A._scItemHtml(ev.find((x) => x.chave === 'g1'), true);
  assert.match(res, /<span class="sc-meta">[^<]*✅ Caio<\/span>/, 'quem resolveu aparece na linha do resumo'); assert.match(res, /Resolvido por Caio/); assert.ok(!/data-sc-acao="resolver"/.test(res));
  assert.match(rest, /opencard=c1/); assert.ok(!/data-sc-acao="resolver"/.test(rest));
});
t('permissão de tela: ADM e PO/Organizador veem o botão; membro não (a regra do banco decide de verdade)', () => {
  assert.strictEqual(carregar({ adm: true, role: 'membro' })._scPodeResolver(), true); assert.strictEqual(carregar({ adm: false, role: 'po' })._scPodeResolver(), true);
  assert.strictEqual(carregar({ adm: false, role: 'organizador' })._scPodeResolver(), true); assert.strictEqual(carregar({ adm: false, role: 'membro' })._scPodeResolver(), false);
});
t('episódio aberto no acordeão continua aberto ao redesenhar', () => {
  const A = carregar(), e = A._scMontarEventos(lidos, AGORA).find((x) => x.chave === 'g2'); assert.ok(!/ open /.test(A._scItemHtml(e, true)));
  A.setAbertos(new Set(['midia|g2'])); assert.match(A._scItemHtml(e, true), /<details class="sc-item"[^>]* open /);
});
console.log(ok ? '\nTUDO OK' : '\nHÁ FALHAS'); process.exit(ok ? 0 : 1);
