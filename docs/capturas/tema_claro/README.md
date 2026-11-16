# Prova de contraste — Painel e Radar (16/11/2026)

Main de referência: `3f0677200435f9610e6bc9fbc97e8428ed8b563e`. Branch: `codex/tema-claro-painel-radar`. Painel dev **v5.118**; Radar dev **v2.137**.

**Resultado:** 2956 ocorrências abaixo do mínimo no claro/Vice antes; **zero falhas sem justificativa depois**. Permanecem 10 ocorrências explicitamente isentas ou reservadas, listadas abaixo. **36/36 capturas do escuro sem mudança visual (33 exatas; 3 com até 21 pixels de rasterização)**. Zero erro JS e zero rolagem lateral. O autoteste do medidor tem 10 verificações.

A auditoria cobre as seis vistas do Radar e nove abas do Painel, mais toast de cada app e formulário habilitado do Painel: **108 cenários** (três temas × 1280/390). Os scripts das páginas (11 no Painel, sete no Radar) são byte a byte iguais aos da main integrada (48731a9a); só CSS e versão mudaram.

## Resumo por tela

Cada célula indica **ocorrências antes → falhas depois**; `ex.` são ocorrências abaixo do mínimo com motivo nominativo, não contadas como aprovadas em contraste. Texto normal: 4,5:1; texto ≥24 px ou ≥18,66 px em negrito: 3:1.

| Tela | Claro 1280 | Claro 390 | Vice 1280 | Vice 390 |
|---|---|---|---|---|
| radar/objetivos | 41 → 0 | 45 → 0 | 84 → 0 | 85 → 0 |
| radar/historico | 11 → 0 | 13 → 0 | 107 → 0 | 80 → 0 |
| radar/calendario | 27 → 0 | 9 → 0 | 64 → 0 | 30 → 0 |
| radar/notas | 4 → 0 | 6 → 0 | 20 → 0 | 18 → 0 |
| radar/cards | 3 → 0 | 5 → 0 | 21 → 0 | 18 → 0 |
| radar/datastudio | 2 → 0 | 4 → 0 | 22 → 0 | 19 → 0 |
| radar/toast | 2 → 0 | 5 → 0 | 23 → 0 | 23 → 0 |
| painel/visao | 29 → 0 | 26 → 0 | 114 → 0 | 114 → 0 |
| painel/fluxo | 6 → 0 | 7 → 0 | 66 → 0 | 58 → 0 |
| painel/timeline | 6 → 0 | 7 → 0 | 27 → 0 | 17 → 0 |
| painel/pessoas | 41 → 0 (+2 ex.) | 42 → 0 (+2 ex.) | 133 → 0 (+2 ex.) | 114 → 0 (+2 ex.) |
| painel/dados | 21 → 0 | 22 → 0 | 64 → 0 | 55 → 0 |
| painel/monitor | 12 → 0 (+1 ex.) | 13 → 0 (+1 ex.) | 53 → 0 | 46 → 0 |
| painel/notifs | 40 → 0 | 42 → 0 | 158 → 0 | 111 → 0 |
| painel/status | 19 → 0 | 20 → 0 | 96 → 0 | 114 → 0 |
| painel/agentes | 6 → 0 | 7 → 0 | 30 → 0 | 19 → 0 |
| painel/pessoas_ativo | 38 → 0 | 39 → 0 | 130 → 0 | 111 → 0 |
| painel/toast | 9 → 0 | 12 → 0 | 37 → 0 | 34 → 0 |

## Exceções do claro/Vice — todas

- `painel/pessoas/1280/light` · `button#lemp-btn` · 🏛️ Publicar aviso global · **2.431:1** (mín. 4.5) — Controle inativo: exceção da WCAG 1.4.3; estado desabilitado permanece identificável.
- `painel/pessoas/1280/light` · `button#kudosp-btn` · ⭐ Enviar estrela geral · **2.431:1** (mín. 4.5) — Controle inativo: exceção da WCAG 1.4.3; estado desabilitado permanece identificável.
- `painel/monitor/1280/light` · `span.mpl-chip.ok` · ligado · **4.316:1** (mín. 4.5) — mare-plantao-dev.js: módulo compartilhado reservado; contraste não piorou. Requer correção própria.
- `painel/pessoas/390/light` · `button#lemp-btn` · 🏛️ Publicar aviso global · **2.424:1** (mín. 4.5) — Controle inativo: exceção da WCAG 1.4.3; estado desabilitado permanece identificável.
- `painel/pessoas/390/light` · `button#kudosp-btn` · ⭐ Enviar estrela geral · **2.438:1** (mín. 4.5) — Controle inativo: exceção da WCAG 1.4.3; estado desabilitado permanece identificável.
- `painel/monitor/390/light` · `span.mpl-chip.ok` · ligado · **4.092:1** (mín. 4.5) — mare-plantao-dev.js: módulo compartilhado reservado; contraste não piorou. Requer correção própria.
- `painel/pessoas/1280/vice` · `button#lemp-btn` · 🏛️ Publicar aviso global · **2.318:1** (mín. 4.5) — Controle inativo: exceção da WCAG 1.4.3; estado desabilitado permanece identificável.
- `painel/pessoas/1280/vice` · `button#kudosp-btn` · ⭐ Enviar estrela geral · **2.44:1** (mín. 4.5) — Controle inativo: exceção da WCAG 1.4.3; estado desabilitado permanece identificável.
- `painel/pessoas/390/vice` · `button#lemp-btn` · 🏛️ Publicar aviso global · **2.398:1** (mín. 4.5) — Controle inativo: exceção da WCAG 1.4.3; estado desabilitado permanece identificável.
- `painel/pessoas/390/vice` · `button#kudosp-btn` · ⭐ Enviar estrela geral · **2.29:1** (mín. 4.5) — Controle inativo: exceção da WCAG 1.4.3; estado desabilitado permanece identificável.

O selo `ligado` é do **mare-plantao-dev.js**, compartilhado e reservado; não foi corrigido por override da página. Botões desabilitados têm exceção na WCAG 1.4.3; seus estados **habilitados** foram medidos separadamente em `pessoas_ativo` e passam. As ocorrências preexistentes do escuro ficam nominadas com motivo e piso no `depois.json`/`depois.txt`; o contrato preserva esse visual. Qualquer caso novo, piora além da tolerância de arredondamento ou diferença visual além de 25 pixels/delta 8 reprova (as diferenças observadas foram no máximo 21 pixels/delta 7).

## Método e reprodução

- Boot real das páginas com `fakefb.js`; usuários, status e dados são fictícios.
- Data fixa no Node/navegador; America/Bahia; Math.random semeado; cada HTML recebe seu version.json correspondente (main ou branch), sem aviso artificial de atualização. As dicas ficam desligadas pela preferência real para evitar popups distintos.
- O medidor oculta apenas os glyphs por instantes, lê os pixels do fundo real (gradientes e vidro), restaura o texto e aguarda a repintura do compositor. Percorre a rolagem, respeita oclusão e mede `fill` SVG, placeholders e as duas partes do seletor nativo de arquivo. Emoji isolado não é texto WCAG.
- As máscaras de versão e latência valem **só para a comparação das capturas**; a medição de contraste acontece antes, sem máscaras. Comparação pixel a pixel exige o mesmo Chromium/SO da referência.
- `antes.txt`/`depois.txt`: saída completa. JSONs: detalhes e exceções. `escuro_comparacao.txt`: hashes das 36 capturas. São guardadas 72 imagens de prova (incluindo as 36 referências do escuro): antes/depois dos dois apps, temas e larguras, além de Calendário/Dashboard/Dados/Status que mudaram.

```sh
python3 -m http.server 8941 --bind 127.0.0.1
SELFTEST=1 node docs/arezzo/testes/auditoria_temas.js
BASELINE_SHA=3f067720 OUT=/tmp/tema-antes node docs/arezzo/testes/auditoria_temas.js
OUT=/tmp/tema-depois node docs/arezzo/testes/auditoria_temas.js
```

A linha de base falha (saída 1); o branch passa (saída 0). O padrão usa `antes.json` como referência. `BASE_URL`, `CHROME`, `PLAYWRIGHT_MODULE`, `REFERENCIA`, `APP`, `TELAS`, `TEMAS`, `LARGURAS` e `OUT` são configuráveis; `RESUME=1` reaproveita checkpoints no OUT. O comparador de pixels exige o mesmo Chromium/SO; a varredura de contraste continua sendo por cenário.

`node scripts/checar.js`: verde. `NODE_PATH=/Users/caiosoares/hering/functions/node_modules npm test --prefix functions`: 1.259 testes, 1.258 aprovados, zero falhas, um ignorado. As dependências existentes foram reutilizadas; nenhum arquivo de functions mudou.

ADM: selecione Lençóis ou Vice City e rode [console_temas.js](console_temas.js), só leitura. O próprio auditor executou o roteiro nas duas páginas/temas/larguras.

**Não verificado:** Firebase real, aparelho físico, Safari/Firefox, fontes remotas reais, modais/chat fechados, popups de módulos e vistas Gantt/Férias. Calendário segue o comportamento real: mês no desktop e agenda no celular. Não houve alteração de layout, lógica, banco, kanban, módulos compartilhados ou produção.

Fronteira: sem mudança — só CSS/cores e testes locais. Dica: não, é correção.

## 16/11 — Vice com as cores de identidade (decisão do Caio)

As capturas `depois/*_vice.png` acima mostram a primeira versão (tons quase brancos). Por decisão do Caio, o Vice voltou às cores originais; o tema claro não mudou. Nova rodada da auditoria: exit 0, 120 registros, 0 falhas não justificadas (Vice como exceção nominal, sem piorar contra a `main`).
