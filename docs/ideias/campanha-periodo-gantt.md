# 📅 Período da campanha, hora da entrega e visão Gantt (Maré)

Pedido do time (12/11/2026, com print do calendário do Trello que usavam): card de campanha/coleção com **data de início e de fim**, aparecendo no **calendário** (barra que atravessa os dias, como no Trello) e numa **visão tipo Gantt**; e **hora da entrega**, que vira alerta.

## Decisões do Caio (12/11/2026)
- **Datas no próprio card**, em **qualquer card** (campos opcionais). Filtra-se a campanha/coleção pela tag.
- **Fim separado do Prazo:** `Início` + `Fim` = período em que a campanha/coleção está no ar; `Prazo` (já existe) = entrega, agora com **hora opcional**.
- **Gantt = nova visão do board** (ao lado de Kanban e 🛤️ Timeline).
- **Alerta da hora: só com o Maré aberto** (sino + Ilha Dinâmica). Push com o Maré fechado = 2ª etapa (R3: função agendada + deploy).

## Modelo (não muda o formato de `due`)
| Campo | Formato | Vazio |
|---|---|---|
| `inicio` | `AAAA-MM-DD` | `''` |
| `fim` | `AAAA-MM-DD` (≥ `inicio`) | `''` |
| `dueHora` | `HH:MM` (24 h, horário de São Paulo) | `''` |
Nunca `undefined` (o RTDB recusa o update inteiro — incidente de 16/09). `due` continua `AAAA-MM-DD` (~56 leitores no kanban + ferramentas do Agente). O servidor grava card campo a campo (`agente-agil/board.js`) e as regras não limitam campos do card: os campos novos não somem.

## Entregas (coordenação v2: R2, 3 PRs em ordem, todos dev-first)
1. **PR 1a — campos e gravação** (Codex, R1 dentro do R2): campos no modal (perto do Prazo), persistência em todos os caminhos, histórico. Contrato abaixo.
2. **PR 1b — calendário estilo Trello** (Antigravity, R2): no 📅 Calendário do board, card com `inicio`+`fim` vira **barra que atravessa os dias** (quebra por semana, avatar na ponta, cor da tag); entrega de um dia (prazo) segue como cartão com ✓ quando concluída; mostra a hora do prazo quando houver.
3. **PR 2 — visão Gantt** (Antigravity, R2): 3º modo do board; barra de `inicio`→`fim` (sem início: só o marco do prazo); linha de "hoje"; agrupa por tag/raia; respeita os filtros; **só leitura** (clique abre o card, sem arrastar datas); 390 px com rolagem lateral só dentro do Gantt. Botões Timeline × Gantt mutuamente exclusivos; conferir todo leitor de `boardView`.
4. **PR 3 — alerta da hora** (Claude integra; mexe em `mare-notif`): tipo `due_hora` em `MareNotif.TIPOS` (fora de `PUSH_TYPES`), id determinístico `due_hora_{cardId}_{due}_{hora}` (Armadilha 3), só para a pessoa logada, respeita Não Perturbe, pula card pausado/arquivado/concluído, hora de São Paulo; entregas com hora de hoje entram no módulo 📅⏳ da Ilha.

Dica: sim no PR 2 (Gantt) e no PR 1b; Ajuda em dia em cada PR.

---

## Contrato PR 1a (Codex)
```
Objetivo: dar ao card os campos opcionais Início, Fim e Hora do prazo, gravados em todos os caminhos e no histórico.
Risco: R1 (parte de um R2) · Modelo e esforço: Sol high · Orçamento: ~50 min; estourou, pare e relate.
Contexto: docs/ideias/campanha-periodo-gantt.md (decisões e modelo). Campos: card.inicio 'AAAA-MM-DD', card.fim 'AAAA-MM-DD', card.dueHora 'HH:MM'; vazio = '' (nunca undefined). Não mude o formato de card.due.
  Este arquivo já perdeu campo 3 vezes por fiação incompleta (executorType 09/07; Demandante fora do histórico 09/08; modal desfazendo automação 31/10). Para CADA campo novo, ligue e confira:
  openCard (preencher) · openNewCard (limpar) · saveCard (os dois ramos) · scheduleAutoSave · _manualFieldsNow e _cardIsDirty · HIST_FIELDS/_histDiff (entrada legível: "Início: 10/11 → 12/11") · _modalSyncCol (linha de base, se aplicável) · _duplicarCardObj (copia, como o due) · Modelos/Recorrentes/Agendamentos NÃO guardam essas datas (mesma regra do due nos modelos) — confirme e documente no código.
  UI: no modal, ao lado do Prazo: "Hora" (<input type=time>) e uma linha "📅 Período: Início · Fim" (<input type=date>), mesmo estilo dos campos vizinhos; Fim < Início = aviso e não grava o Fim. Mostrar no cartão do board: se houver período, "10/11 → 20/11" discreto; se houver hora no prazo, "· 14:00" junto do prazo.
Arquivos: kanban-dev.html · version.json + <div class="version"> (node scripts/mare-cli.js bump kanban_dev) · CHANGELOG.md (mare-cli log --type feature, SÓ DEV) · docs/arezzo/testes/test_card_periodo.js (novo, Playwright, padrão de test_card_modal_ui.js).
Reservados por outros (não tocar): kanban.html (prod), mare-*-dev.js, okr-dev.html, docs/QUADRO.md.
Critérios de aceite (no teste novo, 1280 e 390 px):
  - preencher Início/Fim/Hora e esperar o autosave → o banco (fake) tem os 3 campos; reabrir o card mostra os 3; histórico tem as 3 entradas;
  - Salvar manual também grava; criar card novo com os 3 grava; card novo sem eles grava '' (nenhum undefined no objeto gravado);
  - Fim antes de Início → aviso e Fim não grava; duplicar copia os 3;
  - abrir card antigo (sem os campos) e fechar sem mexer → nenhum aviso de "alterações não salvas";
  - 390 px sem rolagem lateral no modal.
  node --check do maior <script> e do teste; node scripts/checar.js e node scripts/mapa.js (mapa entra no commit).
Não fazer: calendário, Gantt, alerta (são outros PRs); push, PR, merge, deploy; tocar no prod.
Prova: saída de node --check/checar.js colada; o que NÃO verificou (o maestro roda o Playwright).
Entrega: commit na branch codex/card-periodo (trailer "Agent: codex") + resumo com o que fez, a Prova, "Fronteira:" e decisão de dica.
```

## Contrato PR 1b (Antigravity) — depois do merge do PR 1a
```
Objetivo: no 📅 Calendário do board, mostrar o período do card como barra que atravessa os dias (estilo do Trello que o time usava) e a hora do prazo.
Risco: R2 · Modelo e esforço: Gemini 4 Carbon, padrão · Orçamento: ~1 h 30; estourou, pare e relate.
Contexto: docs/ideias/campanha-periodo-gantt.md (modelo, decisões, print do Trello descrito: barra por semana com avatares na ponta; entrega de 1 dia como cartão com ✓). Leia openCal/makeDayEl e o CSS do calendário inteiros (grep -n). Campos: card.inicio, card.fim ('AAAA-MM-DD'), card.dueHora ('HH:MM').
Arquivos: kanban-dev.html (só o calendário do board) · version.json + <div class="version"> · CHANGELOG.md (SÓ DEV) · HELP_CONTENT (tópico do Calendário) · docs/capturas/calendario-periodo/ (1280 e 390, 3 temas).
Reservados por outros (não tocar): kanban.html, mare-*-dev.js, okr-dev.html, docs/QUADRO.md.
Critérios de aceite: card com início+fim aparece como UMA barra por semana (quebra na virada da semana, sem repetir em cada dia), clicável (abre o card), cor da 1ª tag, avatares do responsável/participantes na ponta; várias barras na mesma semana empilham sem sobrepor; entrega de 1 dia continua no dia, com hora quando houver e ✓ se concluída; filtros do board valem; 390 px sem rolagem lateral; 3 temas legíveis. Teste Playwright novo docs/arezzo/testes/test_calendario_periodo.js com esses casos.
Não fazer: Gantt, alerta, push, merge, deploy, prod.
Prova: saída dos testes colada, caminhos das capturas, o que NÃO verificou.
Entrega: branch antigravity/calendario-periodo + PR (sem merge) + resumo com a Prova, "Fronteira:" e "Dica:".
```
