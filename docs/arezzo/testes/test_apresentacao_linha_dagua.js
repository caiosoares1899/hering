// 🌊 18/11/2026: no gráfico de Evolução do atingimento da apresentação, a meta é a linha d'água. Abaixo da meta fica submerso, na meta fica na superfície e além da meta fica fora da água.
// Comparar com outra versão: APRESENTACAO_HTML=/caminho/da/versao.html node docs/arezzo/testes/test_apresentacao_linha_dagua.js
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), os = require('node:os');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(os.homedir(), 'hering-tools/playwright/node_modules/playwright'));
const fake = require('./fakefb'); const { seed } = require('./seed_apresentacao.js');
const ROOT = path.resolve(__dirname, '../../..');
const achar = d => { for (const n of fs.readdirSync(d)) { const f = path.join(d, n), st = fs.statSync(f); if (n === 'Google Chrome for Testing' && st.isFile()) return f; if (st.isDirectory()) { const x = achar(f); if (x) return x; } } return null; };
const chrome = () => process.env.CHROME || achar(path.join(os.homedir(), 'hering-tools/chrome'));
const tipos = { '.html': 'text/html', '.js': 'application/javascript', '.png': 'image/png', '.json': 'application/json', '.svg': 'image/svg+xml', '.css': 'text/css' };
const srv = http.createServer((q, r) => { let f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); if (process.env.APRESENTACAO_HTML && /okr-apresentacao\.slide\.html$/.test(f)) f = process.env.APRESENTACAO_HTML; fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': tipos[path.extname(f)] || 'application/octet-stream' }); r.end(d); }); });
let falhas = 0; const t = (n, ok, d) => { if (!ok) falhas++; console.log((ok ? '✅ ' : '❌ ') + n + (ok ? '' : ' → ' + JSON.stringify(d).slice(0, 320))); };
const reg = (...v) => v.map((valor, i) => ({ id: 'l' + i, em: '2026-0' + (i + 1) + '-10', valor }));
const casos = { sobe: { tipo: 'financeira', moeda: 'BRL', inicial: 0, meta: 100, lancamentos: reg(60, 100, 130) }, desce: { tipo: 'numero', inicial: 0, meta: 100, lancamentos: reg(130, 80) },
  reduz: { tipo: 'financeira', moeda: 'BRL', inicial: 200, meta: 100, lancamentos: reg(110, 100, 90) }, abaixo: { tipo: 'abaixo', meta: 100, lancamentos: reg(110, 90) }, manter: { tipo: 'acima', meta: 100, lancamentos: reg(90, 110) },
  todosAcima: { tipo: 'numero', inicial: 0, meta: 100, lancamentos: reg(120, 140) }, todosAbaixo: { tipo: 'numero', inicial: 0, meta: 100, lancamentos: reg(20, 40) }, unico: { tipo: 'numero', inicial: 0, meta: 100, lancamentos: reg(40) },
  binario: { tipo: 'binario', lancamentos: [{ id: 'b', em: '2026-01-10', atingido: true, valor: 100 }] }, vazio: { tipo: 'financeira', inicial: 0, meta: 100, lancamentos: [] } };
(async () => {
  await new Promise(ok => srv.listen(0, '127.0.0.1', ok)); const BASE = 'http://127.0.0.1:' + srv.address().port;
  const b = await chromium.launch({ executablePath: chrome(), headless: true });
  const dados = seed(); Object.entries(casos).forEach(([id, atingimento]) => { dados.kanban.okr.objetivos['c_' + id] = { ...dados.kanban.okr.objetivos.o3, id: 'c_' + id, titulo: 'Caso ' + id, atingimento }; });
  try {
    for (const [w, h] of [[1920, 1080], [1280, 900], [390, 844]]) {
      const ctx = await b.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block' }); await fake.install(ctx, JSON.parse(JSON.stringify(dados))); const p = await ctx.newPage(); const erros = []; p.on('pageerror', e => erros.push(e.message));
      await p.goto(BASE + '/okr-apresentacao.slide.html'); await p.waitForFunction(() => !!window.__authCb); await p.evaluate(u => window.__authCb(u), { uid: 'ana', email: 'ana@ciahering.com.br', displayName: 'Ana', photoURL: '', providerData: [{ providerId: 'google.com' }] }); await p.waitForTimeout(1600);
      const tag = `[${w}px] `;
      const ler = id => p.evaluate(async i => { window._okrOpenAting(i); await new Promise(r => setTimeout(r, 200)); const svg = document.querySelector('#ating-body svg'), linha = svg?.querySelector('.okr-agua-superficie'); const y = linha ? +linha.getAttribute('y1') : null;
        const pts = [...(svg?.querySelectorAll('.okr-ating-pt') || [])].map(g => ({ lado: g.dataset.lado, y: +g.querySelector('circle').getAttribute('cy'), tip: g.dataset.tip }));
        const r = svg?.getBoundingClientRect(), painel = document.querySelector('.ating-panel').getBoundingClientRect(); return { y, pts, meta: svg?.querySelector('.okr-agua-meta')?.textContent || '', lados: [...document.querySelectorAll('#ating-body .okr-agua-lado')].map(e => e.textContent), peixes: svg?.querySelectorAll('.okr-agua-peixe').length || 0, valores: [...(svg?.querySelectorAll('.okr-agua-valor') || [])].map(e => e.textContent), faixa: document.querySelector('.okr-ating-faixa')?.innerText || '', regAberto: document.querySelector('.okr-ating-reg')?.open, agua: !!svg?.querySelector('.okr-agua'), texto: document.getElementById('ating-body').innerText, cabe: !r || (r.left >= painel.left - 1 && r.right <= painel.right + 1) }; }, 'c_' + id);
      const posicoes = (r, esperado) => r.pts.length === esperado.length && r.pts.every((q, i) => q.lado === esperado[i] && (esperado[i] === 'acima' ? q.y < r.y : esperado[i] === 'abaixo' ? q.y > r.y : Math.abs(q.y - r.y) < .1));
      const sobe = await ler('sobe'); t(tag + 'sobe: abaixo, na linha e acima da água', posicoes(sobe, ['abaixo', 'na', 'acima']), sobe);
      t(tag + 'a linha mostra a meta com a unidade', /Meta R\$\s*100/.test(sobe.meta), sobe.meta);
      t(tag + 'o lado da meta também aparece em texto', sobe.lados.some(x => /Acima da superfície: meta superada/.test(x)) && sobe.lados.some(x => /Submerso: aquém da meta/.test(x)) && /meta superada/.test(sobe.pts[2].tip), sobe);
      t(tag + 'o gráfico cabe no painel', sobe.cabe, sobe);
      t(tag + 'só o registro mais recente tem peixe e valor escrito', sobe.peixes === 1 && sobe.valores.length === 1 && /130/.test(sobe.valores[0]), sobe);
      t(tag + 'a faixa mostra valor atual, distância até a meta e atingimento', /VALOR ATUAL|Valor atual/i.test(sobe.faixa) && /Superada em R\$\s*30/.test(sobe.faixa) && /100%/.test(sobe.faixa), sobe.faixa);
      t(tag + 'Registros começam recolhidos', sobe.regAberto === false, sobe.regAberto);
      const horizonte = await p.evaluate(() => {
        const svg = document.querySelector('.okr-agua-svg');
        const ceu = svg.querySelector('.okr-agua-ceu');
        const agua = svg.querySelector('.okr-agua');
        const nivel = Number(svg.querySelector('.okr-agua-superficie').getAttribute('y1'));
        return Boolean(ceu && agua && Number(agua.getAttribute('y')) === nivel
          && Math.abs(Number(ceu.getAttribute('y')) + Number(ceu.getAttribute('height')) - nivel) < 0.1
          && svg.querySelectorAll('g[clip-path="url(#okr-agua-recorte)"] path').length === 3);
      });
      t(tag + 'céu e água se encontram na meta e as ondas ficam submersas', horizonte, '');
      if (w === 1280 || w === 1920) await p.screenshot({ path: process.env.CAPTURA ? process.env.CAPTURA + '_' + w + '.png' : path.join(os.tmpdir(), 'linha_dagua_' + w + '.png') });
      t(tag + 'desce: cruza a linha no outro sentido', posicoes(await ler('desce'), ['acima', 'abaixo']), '');
      const reduz = await ler('reduz'); t(tag + 'meta de redução: gastar menos fica acima da água', posicoes(reduz, ['abaixo', 'na', 'acima']), reduz);
      t(tag + 'meta de redução: o sentido fica explícito', reduz.lados.some(x => /menor é melhor/i.test(x)) && /Superada em R\$\s*10/.test(reduz.faixa), reduz);
      t(tag + 'manter abaixo: menor que a meta fica acima da água', posicoes(await ler('abaixo'), ['abaixo', 'acima']), '');
      t(tag + 'manter acima: maior que a meta fica acima da água', posicoes(await ler('manter'), ['abaixo', 'acima']), '');
      t(tag + 'todos acima da meta ficam fora da água', posicoes(await ler('todosAcima'), ['acima', 'acima']), '');
      t(tag + 'todos abaixo da meta ficam submersos', posicoes(await ler('todosAbaixo'), ['abaixo', 'abaixo']), '');
      const unico = await ler('unico'); t(tag + 'um único registro mostra peixe e valor', unico.peixes === 1 && unico.valores.length === 1 && posicoes(unico, ['abaixo']), unico);
      await ler('sobe'); await p.focus('.okr-ating-reg summary'); await p.keyboard.press('Enter'); await p.waitForTimeout(150);
      t(tag + 'Registros abrem pelo teclado', await p.evaluate(() => document.querySelector('.okr-ating-reg').open && document.querySelectorAll('.okr-ating-reg .okr-ating-row').length === 3), '');
      await p.keyboard.press('Escape'); await p.waitForTimeout(150); t(tag + 'Esc fecha o modal', await p.evaluate(() => !document.getElementById('ating-ov').classList.contains('open')), '');
      const bin = await ler('binario'); t(tag + 'Atingido/Não atingido continua sem linha d’água', !bin.agua && bin.pts.length === 1, bin);
      t(tag + 'sem registros continua com a mensagem de vazio', /Nenhum registro ainda/.test((await ler('vazio')).texto), '');
      for (const id of ['sobe', 'reduz']) { const r = await p.evaluate(async i => { window._okrOpenAting('c_' + i); await new Promise(x => setTimeout(x, 200)); const bate = (a, b) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
          const peixes = [...document.querySelectorAll('#ating-body .okr-agua-peixe')].map(e => e.getBoundingClientRect()), avisos = [...document.querySelectorAll('#ating-body .okr-agua-meta, #ating-body .okr-agua-valor')].map(e => e.getBoundingClientRect());
          const linha = document.querySelector('#ating-body .okr-agua-superficie').getBoundingClientRect(), valores = [...document.querySelectorAll('#ating-body .okr-agua-valor')].map(e => e.getBoundingClientRect());
          return { avisoSobrePeixe: avisos.some(a => peixes.some(q => bate(a, q))), valorCruzaLinha: valores.some(v => v.top < linha.top && v.bottom > linha.bottom) }; }, id);
        t(tag + id + ': avisos e valores não ficam por cima dos peixes nem da linha', !r.avisoSobrePeixe && !r.valorCruzaLinha, r); }
      await ler('sobe');
      const sincronizacao = await p.evaluate(async () => {
        const ov = document.getElementById('ating-ov');
        document.querySelector('#ating-body .okr-ating-reg').open = true;
        const obj = window.__store.kanban.okr.objetivos.c_sobe;
        const ref = window._ref(window._db, 'kanban/okr/objetivos/c_sobe/atingimento/lancamentos');
        await window._set(ref, [...obj.atingimento.lancamentos, { em: '2026-04-10', valor: 150 }]);
        const atualizado = document.querySelector('#ating-body .okr-agua-valor')?.textContent.includes('150');
        const expandido = document.querySelector('#ating-body .okr-ating-reg')?.open;
        await window._set(ref, []);
        window.dispatchEvent(new Event('resize'));
        const vazio = document.getElementById('ating-body').textContent.includes('Nenhum registro ainda');
        await window._remove(window._ref(window._db, 'kanban/okr/objetivos/c_sobe'));
        return { atualizado, expandido, vazio, fechado: !ov.classList.contains('open') };
      });
      t(tag + 'Evolução aberta acompanha registros novos, lista vazia e exclusão do objetivo', Object.values(sincronizacao).every(Boolean), sincronizacao);
      t(tag + 'nenhum erro de JavaScript', !erros.length, erros);
      await ctx.close();
    }
  } finally { await b.close(); srv.close(); }
  console.log(falhas ? `\n${falhas} falha(s)` : '\nTudo certo'); process.exit(falhas ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
