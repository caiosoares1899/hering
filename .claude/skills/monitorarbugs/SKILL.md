---
name: monitorarbugs
description: Varre o código do Maré Digital (kanban.html/kanban-dev.html principalmente, e por extensão painel.html/painel-dev.html, functions/ e database.rules.json quando a área tocar lá) como um engenheiro de arquitetura revisando o próprio sistema — procura bugs reais, inconsistências entre caminhos que deveriam se comportar igual, e código que sobrou de refactors incompletos, e corrige o que for claro. Use sempre que o usuário pedir "monitora bugs", "roda o monitorarbugs", "varre o código", "procura inconsistências", "audita o código atrás de bugs", "revisa essa área do código", "dá uma conferida se tem bug", ou invocar /monitorarbugs diretamente — mesmo que a frase não diga "bug" explicitamente (ex.: "dá uma olhada nessa parte, quero saber se tem algo pra corrigir"). Diferente de /otimizaçãoderotina (que é sobre bytes/performance/mobile, não correção de comportamento) e de /atualizarhelpcontent (documentação, não código).
---

# Monitorar Bugs — Maré Digital

Nasceu de uma revisão pedida direto pelo usuário na área de Supercards (2
níveis: campanha → criativo → versão) logo depois dela ir ao ar — usando o
`CODE_MAP.md` pra pular direto pras funções certas e lendo cada uma por
inteiro, 4 bugs reais apareceram em pouco tempo, sem chute. Esta skill
existe pra repetir esse método sempre que pedido, em vez de reconstruir a
abordagem do zero a cada vez.

## O que esta rotina NÃO é

- **Não é `/otimizaçãoderotina`** — aquela é sobre bytes de download,
  performance e mobile, sem mudar comportamento. Esta é sobre
  comportamento ERRADO ou INCONSISTENTE — corrigir, não emagrecer.
- **Não é `/atualizarhelpcontent`** — aquela sincroniza texto/documentação
  in-app. Esta mexe em lógica.
- **Não é licença pra refatorar/redesenhar.** A correção certa pra um bug
  costuma ser pequena e local. Se o jeito certo de corrigir exige mudar
  arquitetura (não só a função com o bug), **reporte como recomendação
  separada, não implemente de bandeja** — mesma regra que
  `/otimizaçãoderotina` já aplica pra "quebrar o script em arquivo
  externo".

## Escopo de cada rodada

- **Usuário nomeou uma área**: escopo só nela. Usa o `CODE_MAP.md` pra
  achar as âncoras da área — ele é um retrato, não live, então **sempre
  re-`grep` cada nome antes de confiar na linha**.
- **Pedido genérico** ("varre tudo", sem especificar onde): não tenta ler
  o arquivo inteiro (~28k linhas) numa passada só. Escolhe 1-2 áreas por
  rodada, nesta ordem de prioridade:
  1. áreas alteradas mais recentemente (`git log --oneline -20 --
     kanban-dev.html`) — código fresco é o de maior risco;
  2. áreas que o "Histórico de achados" abaixo ainda não cobre;
  3. se nada se destacar, pergunta ao usuário qual área focar.
- Arquivo padrão: `kanban-dev.html`. Estende pra `painel.html`/
  `painel-dev.html`, `functions/`, `database.rules.json` só se a área
  escopada morar lá ou o pedido for amplo o bastante pra justificar.

## Passo 1 — Reconstituir o entry point

Ache as âncoras da área no `CODE_MAP.md`, re-`grep` cada nome (`-a`
sempre — emoji/unicode fazem `grep -n` sem `-a` reportar "binary file
matches") pra confirmar a linha atual, e **leia as funções INTEIRAS**,
não trechos isolados — um bug de estado/condicional normalmente só
aparece olhando a função de ponta a ponta.

## Passo 2 — Técnicas que já renderam achados reais (nesta ordem de custo/benefício)

1. **Comparar caminhos paralelos pra mesma operação.** Toda vez que
   existe mais de um jeito de disparar a mesma mutação — botão manual vs.
   Automação vs. import/bulk vs. Agente Ágil — os dois deviam fazer
   exatamente a mesma coisa. Ache TODOS os call sites da função que
   persiste o dado (`grep -na "nomeDaFuncao("`) e compare o que cada um
   faz antes/depois. É a técnica de maior retorno — a maioria dos achados
   reais desta skill veio daqui (ver histórico abaixo).
2. **Comparar contra um padrão já resolvido em outro lugar do arquivo.**
   Se uma checagem se repete em mais de uma função (ex.: "isso é
   vazio?", "essa pessoa pode editar?"), grepe implementações irmãs e
   compare — uma pode ter o bug que a outra já resolveu.
3. **Confrontar o comportamento com o comentário da própria função.**
   Quando um comentário documenta um "mapa de estados", percorra CADA
   estado e confirme no código — um estado esquecido na condicional é o
   tipo de bug mais fácil de nunca aparecer em teste manual.
4. **Pegadinhas de JS em checagem de vazio/falsy.** `[]`/`{}` são
   truthy; `0`/`''`/`NaN` são falsy mas podem ser dado válido. Qualquer
   `if(!campo)` decidindo "vazio vs. preenchido" merece essa checagem.
5. **Rastrear recursão/cascata por ciclo e profundidade.** Confirme que
   proteção contra ciclo/profundidade documentada existe no CÓDIGO, não
   só bloqueada na UI (dado corrompido pode chegar por outro caminho —
   Firebase direto, corrida entre abas).
6. **Código morto / nunca chamado.** `grep -nac "nomeDaFuncao("` = 1 (só
   a declaração) é sinal de refactor incompleto. Reporte, não delete sem
   confirmar.

## Passo 3 — Classificar antes de corrigir

- **Bug claro, sem ambiguidade**: corrige direto, sem perguntar.
- **Ambíguo / decisão de produto**: pergunta antes de implementar.
- Nunca refatore/redesenhe além do necessário pra corrigir o achado
  específico — ver "O que esta rotina NÃO é" acima.

## Passo 4 — Reportar achados

Pra cada achado: arquivo + função/linha, o cenário concreto que expõe o
bug (input/estado → resultado errado), e a severidade. **Apresente a
lista antes de sair corrigindo tudo**, a menos que o pedido original já
tenha sido "corrige tudo que achar".

## Passo 5 — Corrigir + checks de rotina + release

1. Corrige só no arquivo `-dev`/de teste da área tocada (nunca
   `kanban.html` direto — "Release process" do `CLAUDE.md`).
2. `node --check` no maior bloco `<script>` + balanço de chaves/
   parênteses contra o baseline conhecido da sessão.
3. Função/helper novo → confere se o `CODE_MAP.md` precisa de anchor
   novo (mesmo commit, ou `/atualizarcodemap` depois).
4. Bump de versão + entrada em `CHANGELOG.md` com o cenário concreto do
   bug — não só "corrige inconsistência".
5. Commit → rebase em `origin/main` → push → PR (nunca self-merge sem
   checar CI).
6. Promoção pra prod é etapa separada (`/subirproprod`), só depois de
   validação explícita.

## Passo 6 — Sempre entregar um teste de console em português

**Regra fixa, todo pedido**: ao final de CADA rodada, entregue um script
pronto pra colar no console (`kanban-dev.html`, DevTools → Console) —
em português, testando cada achado corrigido.

Regras pro script:
- **Chame as funções DE VERDADE da página**, nunca uma reimplementação —
  senão o teste valida a cópia, não o arquivo real.
- `kanban-dev.html`/`kanban.html` são `<script>` clássico: `function
  nome(){}` de nível superior vira `window.nome` sozinha. `let`/`const`
  de nível superior fica só no escopo do script, mas o console avalia no
  MESMO escopo — reatribua com `_var = 'x'`, nunca `window._var = 'x'`
  (propriedade solta que o app nunca lê) nem `let _var = 'x'`
  (redeclaração, erro ou no-op).
- **Nunca crie elemento DOM com o MESMO id de um já existente na
  página** (`document.getElementById()` acha o real primeiro, teste lê/
  escreve numa cópia solta).
- **Guarde resultados numa variável que sobrevive fora do script**
  (`window._resultadosTeste = linhas`, não só `let` dentro de uma IIFE).
- Entregue o script COMPLETO e visível na resposta — nunca só um
  caminho de arquivo salvo em disco.
- `console.table(linhas)` no final, nome do teste + ✅/❌ + detalhe.

## Histórico de achados (não repetir análise já feita)

Formato: data — área — achados reais (gist) — versão/PR. Áreas
"sem achados" ficam registradas só quando relevante evitar reanálise.

- **2026-08-21, Supercards (origem)**: 4 bugs — visibilidade do 2º
  nível contradizia comentário; fan-out por Automação não propagava
  Ficha Técnica; `!crv[k]` não pegava array vazio; supercard concluía
  sozinho com filhos cancelados. PR #466/#467.
- **2026-08-26, Automações (`assigned`/`move`)**: 2 bugs — não
  disparavam via modal (Salvar/autosave), só arrastar/atalho. PR
  #533/#534.
- **2026-08-26, card hotline + Campanhas**: 2 bugs no hotline (métricas
  do board não excluíam; aparecia em 3 buscas de card) — Campanhas sem
  achado. dev v8.30.487.
- **2026-08-27, Automações bulk + `_duplicarComFilhos()`**: 5 bugs —
  bulk move/block/tag nunca disparavam Automação; duplicar sem achado
  (decisão já registrada em comentário). dev v8.30.488.
- **2026-08-27, coluna de impedimento**: 3 bugs — recorrente/agendado/
  edição de QL gravavam `col` sem revalidar se ainda existe. dev
  v8.30.489.
- **2026-08-27, Agente Ágil (Histórico + Intake)**: 2 bugs —
  `autonomous` binário não cobria origem "especialista"; tag de
  Submarca pré-marcada sem checar feature ligada. dev v8.30.493.
- **2026-08-29, Agentes Externos (painel)**: 1 bug — merge a partir de
  cache local em vez de ler fresco (perda em corrida). dev v3.02·painel-dev.
- **2026-08-29, Automações — `saveCard()` criação**: 3 bugs —
  `cover_set`/`padrao_set`/`tag_added` não disparavam no branch de
  criação. dev v8.30.502.
- **2026-08-29, Automações × orquestrador (arquitetural)**: mutação real
  do orquestrador nunca disparava Automação — fila `agente_pending_auto`
  + `_claimPendingAuto()`. 8 testes novos. dev v8.30.503.
- **2026-08-29, Padrões de card**: 1 bug — só 1 de 5 funções atualizava
  card já aberto. dev v8.30.504.
- **2026-08-30, Notificações in-app**: 1 bug — @menção em checklist só
  notificava via Salvar manual, não autosave. dev v8.30.505.
- **2026-08-30, Notas**: sem achados.
- **2026-08-30, `saveCard()`**: 1 bug severo — trava de reentrância
  armada antes de confirmar que o card ainda existe; card sumido
  travava Salvar pra SEMPRE. dev v8.30.506.
- **2026-08-30, processos de criar card**: 1 bug — Agendamentos nunca
  ganhou trigger `_created` equivalente a Recorrentes. dev v8.30.507.
- **2026-09-01, Agente Ágil owner/participant + resync periódico**: sem
  achados no cluster owner; 1 bug severo no resync (pulava card sem
  posição resolvida, ficava invisível a sessão toda). dev v8.30.517.
- **2026-09-01, duplicação**: 1 bug — `bulkDuplicate()` não resetava
  `childCardIds`/`pinned`. dev v8.30.522.
- **2026-09-01, pontos críticos (comentários/checklist/tags/desc/acesso)**:
  3 bugs em Acesso — 3 telas com checagem de papel na mão em vez de
  `_isPOorOrg()`. Resto sem achados. dev v8.30.523.
- **2026-09-01, indicador "🤖 pensando..."**: 3 bugs — hotline preso
  120s; indicador reaparecia em conversa já respondida; `notify_all`
  excluía o próprio autor sem sentido. dev v8.30.527.
- **2026-09-01, aba Agentes (painel)**: 1 bug — link "abrir card" sem
  fallback quando o card sumiu (mesmo gap em `openNotif()`). dev v8.30.536.
- **2026-09-01, Agentes Externos CRUD (2ª rodada)**: 2 bugs — erro
  silencioso ao editar registro sumido + cache fantasma; listener
  reconstruía a lista inteira destruindo form aberto. dev v3.07·painel-dev.
- **2026-09-01, pin do card**: 1 bug — sem fallback pra toque/teclado,
  adicionado ao menu de contexto. dev v8.30.537.
- **2026-09-02, redesenho mobile + card lock**: mobile sem achado; 1 bug
  no lock — card hotline herdava lock exclusivo de 1 pessoa. dev v8.30.543.
- **2026-09-02, multiselects**: 1 bug — bulk tag picker permitia 2 tags
  do mesmo grupo (tamanho/submarca) ao mesmo tempo. dev v8.30.545.
- **2026-09-02, campanhas/coleções**: 1 bug — `_filterCards()` não usava
  `getCardTags()`, badge da lista e do detalhe divergiam. dev v8.30.546.
- **2026-09-02, funções de card (Arquivados/Cards antigos/QL)**: 1 bug
  (3 lugares) — selo de tag lia campo legado. dev v8.30.547. (Achado de
  passagem, fora do escopo: mesmo padrão em `openSearch()`.)
- **2026-09-02, supercards (revisita)**: 1 bug — cascata de
  auto-conclusão sem proteção contra ciclo corrompido nos dados. dev
  v8.30.548.
- **2026-09-02, capa do card**: 2 bugs — `setCardCoverImage()` não
  disparava Automação; ação `set_cover` não limpava a imagem. dev
  v8.30.554.
- **2026-09-03, card sumido / QL temp**: 6 caminhos irmãos do mesmo gap
  — guard movido pras 3 primitivas de escrita (`fbSaveCard`/
  `fbCreateCard`/`fbSaveAll`). dev v8.30.561.
- **2026-09-03, dependências entre cards**: 2 bugs — exclusão de
  descendentes nunca implementada (ciclo fechável de verdade); badge
  "pai atual" comparava campo errado (`parentId`, de Nota). dev v8.30.563.
- **2026-09-03, modal do card (navegação)**: 1 bug — pilha de "← Voltar"
  mutada antes do gate assíncrono cancelável de fechar. dev v8.30.564.
- **2026-09-03, modal do card (lock, 2ª rodada)**: 1 bug — card
  `_isQLTemp` também vazava lock fantasma. dev v8.30.565.
- **2026-09-03, agente ágil orquestrador**: 1 bug — ferramenta de
  notificar especialista não checava o toggle por squad que o gatilho
  determinístico gêmeo já checava. Suíte 284/284.
- **2026-09-04, Timeline**: 3 bugs — `doneAt` só olhava 1ª coluna de
  fim; Feed perdia marco quando prioridade era removida; collapse não
  guardava estado aberto. dev v8.30.581, PR #723.
- **2026-09-04, Relatório de Tempo/CFD/Throughput (2ª rodada)**: achado
  grande — 9 funções reimplementavam `col==='done'` em vez de
  `_isColDone()`; 2 liam `c.doneAt` (campo que nunca existiu). dev v8.30.582.
- **2026-09-04, CFD/Burndown (3ª rodada)**: 1 bug (2 ocorrências) — sem
  fallback pra `createdAt` ausente, sumia dos gráficos. dev v8.30.585.
  Pedido do usuário virou o Passo 6 (sempre entregar teste de console).
- **2026-09-05, OKR — chat do Agente Ágil**: 1 bug — edição via chat
  nunca notificava o Responsável do Objetivo (só a edição manual
  disparava). PR #756, suíte 468/468.
- **2026-09-06, OKR bloco quinzenal (rodada 1) + todas as notificações
  (rodada 2, pedido explícito "faz um /monitorarbugs em todas
  notificações")**: 6 achados reais, todos mesma classe — clicar numa
  notificação não navegava a lugar nenhum, porque só `cardId`/`intake`
  tinham tratamento em `openNotif()`. PR #763: (1) 4 tipos `okr_*`
  sem navegação → redirecionam pra `painel(-dev).html?okr=<id>`; (2)
  `_okrBlocoNaData()` código morto removida + `Math.floor`→`Math.round`;
  (3) **mais severo** — sino PRÓPRIO do painel (`renderPainelNotifs()`,
  nunca auditado antes, UI separada do sino do kanban) tinha `n.link`
  descartado no mapeamento de `loadPainelNotifs()` — "rascunho
  aguardando revisão" nunca navegou desde que a feature existe, apesar
  do código já prometer isso (comentário + toast); (4) "🎥 Reunião em X
  min" não abria o link (só a notificação nativa abria) —
  `createNotif()` ganhou parâmetro `extra` opcional; (5) "📅 agenda
  pendente" não processava a fila ao clicar; (6) feedback do Mural pro
  ADM não navegava — novo deep-link genérico `?tab=<id>`
  (`_painelTryOpenTabFromUrl()`, complementar ao `?okr=<id>`). Achado
  incidental documentado, não corrigido: `_restoreTab()` também é
  código morto (painel sempre abre na aba Visão). PR #764: promoção
  isolada do achado 3 pra prod (só 1 linha, resto do lote de dev ainda
  não validado). Suíte de backend 475/475, 21 cenários Playwright.
  **Lição pra próxima vez**: antes de assumir "não existe X", grep pelo
  NOME GENÉRICO do conceito (`notif`, `link`) em vez de só pelos nomes
  já conhecidos de uma tela (`openNotif`/`NOTIF_ICONS` são do kanban;
  o painel tem seu próprio `loadPainelNotifs`/`renderPainelNotifs`,
  quase invisível na 1ª rodada por causa disso).
- **2026-09-06, avisos do Mural (pedido explícito, escopo nomeado)**: 2
  achados. PR #766: (1) **severo** — comunicado "Insistente (reaparece
  até expirar)" reabria sozinho ~400ms depois de dispensado, em loop,
  pelo resto da sessão — `dismissComunicado()` reagenda
  `_talvezMostrarComunicado()` em 400ms pra checar a fila, e o próprio
  insistente sempre contava como "pendente" de novo mesmo recém-fechado
  (`#comunicado-ov` só fecha via `dismissComunicado()`, sem
  clique-fora — sem saída pra quem fosse atingido). Achado via técnica
  3 (o que a opção promete na tela — "até EXPIRAR" — vs. o que o código
  fazia — reabre 400ms depois de fechar). Fix: `_comunicadoDismissedSession`
  (`Set` em memória, reseta a cada load de página) guarda ids
  dispensados NA SESSÃO; (2) menor — `_ccTogglePrioridadeUI()`
  desmarcava o checkbox Insistente ao trocar pra mural sem restaurar ao
  voltar pra popup, perdendo o valor original em silêncio — corrigido
  pra só desabilitar. 8 cenários Playwright.

Atualize esta seção a cada rodada nova (1-3 linhas: área, achados,
versão/PR) — o objetivo é não reanalisar do zero uma área já varrida,
não preservar a narrativa completa de cada investigação.
