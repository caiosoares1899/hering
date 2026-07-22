// functions/agente-agil/outputs/index.test.js
//
// Testa buildWritePlan como função pura — sem emulador, sem Admin SDK.
// Pra relatorio_html, "puro" quer dizer: sem tocar Storage de verdade —
// ctx.uploadAndSign aqui é uma fake em memória. Rodar com:
// node functions/agente-agil/outputs/index.test.js

const assert = require('node:assert/strict');
const { buildWritePlan } = require('./index');

function fakeCtx(overrides) {
  let n = 0;
  return {
    agentUid: 'agente-agil',
    agentName: 'Agente Ágil',
    agentInit: 'AA',
    now: () => '2026-07-22T12:00:00.000Z',
    newId: (prefix) => `${prefix}fixo${n++}`,
    dryRun: false,
    reportBasePath: () => 'relatorios/dev-ecomm/cX/2026-07-22',
    uploadAndSign: async (path) => `https://fake-storage.example/${path}?sig=fake`,
    ...overrides,
  };
}

async function main() {
  // comentario -> update numa folha só, em comments/{id}
  {
    const ctx = fakeCtx();
    const plan = await buildWritePlan([{ type: 'comentario', texto: 'oi' }], ctx);
    assert.equal(plan.length, 1);
    assert.equal(plan[0].kind, 'update');
    assert.equal(plan[0].path, 'comments/agentefixo0');
    assert.equal(plan[0].value.text, 'oi');
    assert.equal(plan[0].value.origemAgente, true);
  }

  // link -> transaction escopada em links, não pisa em link existente
  {
    const ctx = fakeCtx();
    const plan = await buildWritePlan([{ type: 'link', url: 'https://x.com/r', titulo: 'Relatório' }], ctx);
    assert.equal(plan.length, 1);
    assert.equal(plan[0].kind, 'transaction');
    assert.equal(plan[0].path, 'links');
    assert.equal(plan[0].preview.url, 'https://x.com/r');
    const result = plan[0].apply(undefined);
    assert.equal(result.length, 1);
    assert.equal(result[0].url, 'https://x.com/r');
    const result2 = plan[0].apply(result);
    assert.equal(result2.length, 2);
  }

  // múltiplos outputs viram múltiplas entradas, na ordem
  {
    const ctx = fakeCtx();
    const plan = await buildWritePlan(
      [
        { type: 'comentario', texto: 'a' },
        { type: 'link', url: 'https://x.com', titulo: 't' },
      ],
      ctx
    );
    assert.equal(plan.length, 2);
    assert.equal(plan[0].kind, 'update');
    assert.equal(plan[1].kind, 'transaction');
  }

  // output sem handler registrado -> erro explícito, com .code pro http.js
  // conseguir diferenciar de uma falha de I/O real
  {
    const ctx = fakeCtx();
    await assert.rejects(() => buildWritePlan([{ type: 'checklistItem' }], ctx), /sem handler registrado/);
    try {
      await buildWritePlan([{ type: 'checklistItem' }], ctx);
      assert.fail('deveria ter lançado');
    } catch (err) {
      assert.equal(err.code, 'unknown_output_type');
    }
  }

  // relatorio_html (dryRun) -> não chama uploadAndSign, só devolve preview
  {
    let uploadCalls = 0;
    const ctx = fakeCtx({
      dryRun: true,
      uploadAndSign: async () => {
        uploadCalls += 1;
        return 'não deveria ter sido chamado';
      },
    });
    const html = '<html><body><img src="data:image/png;base64,QUJD"></body></html>';
    const plan = await buildWritePlan([{ type: 'relatorio_html', html, titulo: 'Relatório Diário' }], ctx);
    assert.equal(uploadCalls, 0, 'dryRun não deveria subir nada pro Storage');
    assert.equal(plan.length, 1);
    assert.equal(plan[0].kind, 'noop');
    assert.equal(plan[0].preview.imagensDetectadas, 1);
    assert.equal(plan[0].preview.titulo, 'Relatório Diário');
  }

  // relatorio_html (execução real) -> sobe imagens + html enxuto, plano
  // final é o MESMO formato que o output "link" produziria
  {
    const uploaded = [];
    const ctx = fakeCtx({
      dryRun: false,
      uploadAndSign: async (path, buffer, contentType) => {
        uploaded.push({ path, contentType, bytes: buffer.length });
        return `https://fake-storage.example/${path}`;
      },
    });
    const html =
      '<html><body><h1>Rel</h1><img src="data:image/png;base64,QUJD"><img src="data:image/png;base64,WFla"></body></html>';
    const plan = await buildWritePlan([{ type: 'relatorio_html', html, titulo: 'Relatório Diário' }], ctx);

    // 2 imagens + 1 html = 3 uploads, nessa ordem
    assert.equal(uploaded.length, 3);
    assert.ok(uploaded[0].path.endsWith('imagem-1.png'));
    assert.ok(uploaded[1].path.endsWith('imagem-2.png'));
    assert.ok(uploaded[2].path.endsWith('relatorio.html'));
    assert.equal(uploaded[2].contentType, 'text/html; charset=utf-8');

    // plano final: mesma forma que buildLinkPlan produz pro output "link"
    assert.equal(plan.length, 1);
    assert.equal(plan[0].kind, 'transaction');
    assert.equal(plan[0].path, 'links');
    assert.equal(plan[0].preview.title, 'Relatório Diário');
    assert.ok(plan[0].preview.url.endsWith('relatorio.html'));
  }

  console.log('outputs/index.test.js: ok');
}

main().catch((err) => {
  console.error('outputs/index.test.js FALHOU:', err);
  process.exit(1);
});
