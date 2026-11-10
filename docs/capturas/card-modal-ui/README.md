# Modal do card — rodada de 09/11/2026

Boot real de `kanban-dev.html` com Firebase falso; só dados fictícios. Antes: `origin/main` no commit `0b54376f`. Depois: branch `codex/card-modal-uiux`.

## Antes × depois

| Cenário | Antes | Depois |
|---|---|---|
| Celular 390 × 800, tema claro, 50 itens | [Antes](antes-390-50-light.png) | [Depois](depois-390-50-light.png) |
| Tablet 834 × 1112, tema claro, 2 itens | [Antes](antes-834-2-light.png) | [Depois](depois-834-2-light.png) |
| Desktop 1280 × 900, tema escuro, 50 itens | [Antes](antes-1280-50-dark.png) | [Depois](depois-1280-50-dark.png) |

[Checklists no celular após a correção](depois-390-50-light-checklist.png).

## Evidências

- Teste novo: 34 falhas antes da correção (largura, nomes acessíveis, tamanho de toque e foco); 61 verificações aprovadas na versão final, incluindo o script de console.
- Três temas, desktop/celular/tablet, 0/2/50 itens, papéis ADM/membro/PO. Títulos e itens longos.
- Suíte vizinha `test_checklist_ordem.js`: TUDO OK, tanto na main quanto na versão final; arrastar, setas e autosave cobertos.
- `test_seguranca_xss.js` com `PAGINAS=kanban-dev`: zero achados, 25 campos envenenados vistos na tela.
- `node scripts/checar.js`: aprovado. `cd functions && npm test`: 1194 aprovados, 0 falhas, 1 pulado.
- Suítes antigas executadas com adaptação em memória dos caminhos Linux do Playwright/Chrome e da porta do servidor; nenhum arquivo dessas suítes foi alterado.

## Troca e limites

No toque, alvos de 44 px e o nome do grupo em linha própria reduzem a quantidade de itens visíveis nos 340 px da lista. Há mais rolagem vertical dentro do checklist; o desktop mantém a geometria anterior.

Não validado com Firebase real, leitor de tela real, teclado virtual de iOS/Android ou usuário externo. Nenhum dado real foi acessado e produção não foi alterada.

## Reproduzir

Sirva o worktree com `python3 -m http.server 8947 --bind 127.0.0.1`. Rode `node docs/arezzo/testes/test_card_modal_ui.js` (use `CHROME` e `PLAYWRIGHT_MODULE` para caminhos diferentes dos padrões do Mac). Para comparar a main sem trocar o arquivo no disco, use `MAIN_HTML=/caminho/do/html-da-main`.

Validação do ADM: abra um card no dev, confira os três temas e execute `docs/arezzo/testes/console_card_modal_ui.js` no Console. Recolha/expanda um checklist duas vezes com Enter; o foco deve continuar no mesmo botão e os itens devem ser preservados.
