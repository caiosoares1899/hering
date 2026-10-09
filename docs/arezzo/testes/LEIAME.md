# Testes de navegador do modo "só Hering" (Playwright + Firebase falso)

Copiados da pasta de trabalho da sessão de 2026-10-08, pra existirem no repo. Não rodam sozinhos no CI — são scripts Node soltos:

- `fakefb.js` — Firebase falso (RTDB em memória com listeners ao vivo, `__authCb`, `__setDelay`, `__denySet`), instalado por `fake.install(ctx, seed)`.
- `test_so_hering.js` — `okr-dev.html` no modo atual: login só Google, uma torre só, dados de outras torres invisíveis (lista/calendário/histórico/mural), sem pergunta de torre, pessoas só Hering, conta Arezzo barrada.
- `test_so_hering_kanban_painel.js` — `kanban-dev.html` e `painel-dev.html`: tela de login, domínios, menção, inscrição sem torre, ajuda, filtros do 👥 Global Users.
- `test_apresentacao.js` / `test_apresentacao_nav.js` — `okr-apresentacao.slide.html`: filtro de tag nos 2 modos, visualizador externo, falha ao gravar anotação; teclado, detalhe, Esc em camadas, colapsar concluídos, slide sumindo ao vivo (exigem o `fakefb.js` ao lado).
- `test_tags.js` — apagar tag e Gerenciar tags do Radar (okr-dev): uso, histórico, duplo clique, ADM × PO, Esc.
- `test_modal_edicao.js` — modal de edição do OKR (duplo clique, item apagado, alteração falsa, Esc…). Vale nos dois modos.

Rodar (precisa do servidor estático e do Chromium do ambiente):
```bash
cd /caminho/hering && python3 -m http.server 8941 &
node docs/arezzo/testes/test_so_hering.js            # BASE=http://localhost:8941/okr-dev.html por padrão
```
Ajuste os caminhos `require('/opt/node22/lib/node_modules/playwright')` e `executablePath` pro seu ambiente.

**Pra provar que religar funciona:** troque `window.MARE_SO_HERING = true` por `false` no `okr-dev.html`, rode as suítes antigas de torres/gerências/calendário (não versionadas; só existem nos históricos da sessão) e os testes de `functions/` com `MARE_MODO_TESTE=varias-torres` — na sessão de 2026-10-08 todas passaram nesse modo.
