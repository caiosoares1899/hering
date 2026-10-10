# Testes de navegador do modo "só Hering" (Playwright + Firebase falso)

Copiados da pasta de trabalho da sessão de 2026-10-08, pra existirem no repo. Não rodam sozinhos no CI — são scripts Node soltos:

- `fakefb.js` — Firebase falso (RTDB em memória com listeners ao vivo, `__authCb`, `__setDelay`, `__denySet`), instalado por `fake.install(ctx, seed)`.
- `test_so_hering.js` — `okr-dev.html` no modo atual: login só Google, uma torre só, dados de outras torres invisíveis (lista/calendário/histórico/mural), sem pergunta de torre, pessoas só Hering, conta Arezzo barrada.
- `test_so_hering_kanban_painel.js` — `kanban-dev.html` e `painel-dev.html`: tela de login, domínios, menção, inscrição sem torre, ajuda, filtros do 👥 Global Users.
- `test_apresentacao.js` / `test_apresentacao_nav.js` — `okr-apresentacao.slide.html`: filtro de tag nos 2 modos, visualizador externo, falha ao gravar anotação; teclado, detalhe, Esc em camadas, colapsar concluídos, slide sumindo ao vivo (exigem o `fakefb.js` ao lado).
- `test_apresentacao_capa.js` — capa da apresentação: logo do Radar em imagem, subtítulo sem "torre" no modo só Hering, favicon.
- `test_oceano.js` — `oceano-dev.html`: login Google, vitrine por pessoa, temas, peixinhos, cadastro, host dos produtos em iframe e troca pelo menu de 9 pontinhos do Radar, celular. (As 2 checagens de lista exata do menu de apps — fora do repo — mudaram: agora o 🌊 Oceano vem primeiro.)
- `test_links.js` — links do menu de produtos: cadastro no Painel (ADM), abas Hering/Meus links, imagem quebrada, segurança de URL, edição no Oceano.
- `test_monitorarbugs_1009.js` — /monitorarbugs de 09/10: apresentação ao vivo (ouvinte único, apresentador que recarrega, laser, copiar link), duplo clique em Salvar link (Oceano/Painel), link removido por outra pessoa, menu ao trocar de conta.
- `test_menu_kanban.js` — menu de produtos dentro do kanban logado (boot real, Firebase falso): botão visível no desktop/celular, abas, produtos por papel, Esc, Central de Ajuda. `K=kanban` testa a página de prod.
- `test_oceano_sino.js` — sininho do Oceano: selo, painel, marcar tudo/limpar, abrir item (aba nova e dentro do host), Esc, rodapé de push/som/Não Perturbe. `PAGE=oceano.html` testa a prod (depois da promoção).
- `gerar_prints_guia.js` — gera os prints (1180 px, dados fictícios) do `guia-okr.html` a partir de `okr.html`; saída em `guia_prints/` (não versionada).
- `test_painel_fluxo.js` — painel-dev, abas Visão e Fluxo (v5.36): KPIs sem Backlog, entregas por dia empilhadas por squad (7/14/30d), "onde está o trabalho" com WIP/limite, aging com squad+limite, comparação com N squads, filtros de gerência/squad, risco sem `[object Object]`.
- `test_monitorarbugs_1010c.js` — /monitorarbugs (2ª rodada de notificações): Oceano com a config chegando depois da janela fria (selo aparece, sem ding), religar o tipo ao vivo traz a notificação de volta, `viva()` = só TTL, Comunicado urgente de ADM só-por-e-mail avisa as falhas do fan-out e tipo desligado nos 2 canais não grava.
- `test_monitorarbugs_1010b.js` — /monitorarbugs da Central de Notificações: o ding não toca por tipo desligado quando a config chega depois (`fakefb.js` `__onValueDelay`), e ADM só por e-mail (papel `membro`) vê os interruptores travados + aviso e a mensagem de permissão certa.
- `test_notificacoes.js` — 🔔 Central de Notificações (painel-dev aba Notificações): catálogo × código (PUSH_PADRAO = PUSH_TYPES, todo `createNotif()` está no catálogo), interruptores sino/push gravando `kanban/notif_config`, sino do Painel e do Maré escondendo/gravando, Não Perturbe/aparelhos/uso 7d, não-ADM só lê, falha de gravação. `SHOT=/pasta` salva prints.
- `test_capa_menu.js` — menu de capa (🎨) do card: fecha por clique fora e ao trocar/fechar card.
- `test_dicas.js` — 💡 Dicas (mare-dicas(-dev).js) em Radar, Oceano e Maré: aparece sozinha, 1 por vez, intervalo, Saiba mais → Ajuda, desligar/religar (Firebase e aparelho), externo, celular. `SUFIXO=` (vazio) testa a prod.
- `test_okr_dashboard.js` — Dashboard do Radar (seed `seed_okr_dashboard.js`, 14 Objetivos × 8 snapshots): número grande + linha no desenho do atingimento, colunas por situação, filtro clicável, ordem 'pior', detalhe do Objetivo, troca Atingimento/Marcos e período; 1280 e 390 px. `BASE=…/okr.html` testa a prod.
- `test_okr_cards.js` — aba 🔗 Cards do Radar: não baixa cards ao abrir, lista só badge OKR (squads_meta incluídos), vínculo com Objetivos (arquivado não conta), filtro/busca, abrir card/Objetivo, visualizador externo. `BASE=…/okr.html` testa a prod.
- `test_apresentacao_live.js` — apresentação ao vivo: 2 páginas (apresentador e acompanhante), laser, caneta, passar/pedir/assumir controle, encerrar, visualizador externo.
- `test_tags.js` — apagar tag e Gerenciar tags do Radar (okr-dev): uso, histórico, duplo clique, ADM × PO, Esc.
- `test_calendario.js` — calendário do Radar (okr-dev): legenda clicável por tipo, sem resquício de torre/agenda global no modo só Hering, PO cria evento, 3 torres, deep link.
- `test_modal_edicao.js` — modal de edição do OKR (duplo clique, item apagado, alteração falsa, Esc…). Vale nos dois modos.

Rodar (precisa do servidor estático e do Chromium do ambiente):
```bash
cd /caminho/hering && python3 -m http.server 8941 &
node docs/arezzo/testes/test_so_hering.js            # BASE=http://localhost:8941/okr-dev.html por padrão
```
Ajuste os caminhos `require('/opt/node22/lib/node_modules/playwright')` e `executablePath` pro seu ambiente.

**Pra provar que religar funciona:** troque `window.MARE_SO_HERING = true` por `false` no `okr-dev.html`, rode as suítes antigas de torres/gerências/calendário (não versionadas; só existem nos históricos da sessão) e os testes de `functions/` com `MARE_MODO_TESTE=varias-torres` — na sessão de 2026-10-08 todas passaram nesse modo.
