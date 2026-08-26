---
name: monitorarbugs
description: Varre o código do Maré Digital (kanban.html/kanban-dev.html principalmente, e por extensão painel.html/painel-dev.html, functions/ e database.rules.json quando a área tocar lá) como um engenheiro de arquitetura revisando o próprio sistema — procura bugs reais, inconsistências entre caminhos que deveriam se comportar igual, e código que sobrou de refactors incompletos, e corrige o que for claro. Use sempre que o usuário pedir "monitora bugs", "roda o monitorarbugs", "varre o código", "procura inconsistências", "audita o código atrás de bugs", "revisa essa área do código", "dá uma conferida se tem bug", ou invocar /monitorarbugs diretamente — mesmo que a frase não diga "bug" explicitamente (ex.: "dá uma olhada nessa parte, quero saber se tem algo pra corrigir"). Diferente de /otimizaçãoderotina (que é sobre bytes/performance/mobile, não correção de comportamento) e de /atualizarhelpcontent (documentação, não código).
---

# Monitorar Bugs — Maré Digital

Nasceu de uma revisão pedida direto pelo usuário na área de Supercards (2
níveis: campanha → criativo → versão) logo depois dela ir ao ar — usando o
`CODE_MAP.md` pra pular direto pras funções certas e lendo cada uma por
inteiro, 4 bugs reais apareceram em pouco tempo, sem chute: um contradizia
o próprio comentário da função, outro só existia porque dois caminhos
diferentes pra mesma operação (botão manual vs. Automação) faziam coisas
diferentes, outro era a mesma "campo vazio?" resolvida certo em um lugar do
arquivo e errado em outro. Esta skill existe pra repetir esse método
sempre que pedido, em vez de reconstruir a abordagem do zero a cada vez.

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

- **Usuário nomeou uma área** ("supercards", "notificações", "ficha
  técnica", "checklist", "automações"...): escopo só nela. Usa o
  `CODE_MAP.md` pra achar as âncoras da área — ele é um retrato, não
  live, então **sempre re-`grep` cada nome antes de confiar na linha**
  (mesma regra que o próprio `CODE_MAP.md`/`CLAUDE.md` já deixam
  explícita).
- **Pedido genérico** ("varre tudo", "roda a rotina de bugs", sem
  especificar onde): não tenta ler o arquivo inteiro (~28k linhas) numa
  passada só. Escolhe 1-2 áreas por rodada, nesta ordem de prioridade:
  1. áreas alteradas mais recentemente (`git log --oneline -20 --
     kanban-dev.html`) — código fresco é o de maior risco;
  2. áreas que a seção "Histórico de achados" abaixo ainda não cobre;
  3. se nada se destacar, pergunta ao usuário qual área focar em vez de
     escolher às cegas.
- Arquivo padrão: `kanban-dev.html` (superfície viva de dev). Estende
  pra `painel.html`/`painel-dev.html`, `functions/`,
  `database.rules.json` só se a área escopada morar lá ou o pedido for
  amplo o bastante pra justificar.

## Passo 1 — Reconstituir o entry point

Ache as âncoras da área no `CODE_MAP.md`, re-`grep` cada nome (arquivos
deste repo têm emoji/unicode — se `grep -n` disser "binary file
matches", usa `grep -na`) pra confirmar a linha atual, e **leia as
funções INTEIRAS**, não trechos isolados — um bug de estado/condicional
normalmente só aparece olhando a função de ponta a ponta de uma vez, não
num grep pontual.

## Passo 2 — Técnicas que já renderam achados reais (nesta ordem de custo/benefício)

1. **Comparar caminhos paralelos pra mesma operação.** Toda vez que
   existe mais de um jeito de disparar a mesma mutação — botão manual
   dentro do modal vs. ação de Automação vs. import/bulk vs. chamada do
   Agente Ágil — os dois quase sempre deviam fazer exatamente a mesma
   coisa. Ache TODOS os call sites da função que persiste o dado
   (`grep -na "nomeDaFuncao("`) e compare linha a linha o que cada um
   faz antes/depois de chamá-la. Foi assim que se achou: fan-out
   disparado por Automação não propagava a Ficha Técnica pros filhos,
   porque só o botão manual chamava `_crvPropagateToChildren()` depois.
2. **Comparar contra um padrão já resolvido em outro lugar do arquivo.**
   Se uma checagem se repete em mais de uma função (ex.: "esse campo tá
   vazio?"), grepe por implementações irmãs da mesma checagem (nomes
   tipo `isEmpty`, ou o padrão `!campo`/`.length===0` espalhado) e
   compare. Foi assim que se achou: `_crvPropagateToChildren` usava
   `!crv[k]` (que NÃO pega array vazio `[]` — truthy em JS) enquanto
   `_mergeModeloEmCardObj`, resolvendo o mesmo tipo de problema, já
   tinha um helper `isEmpty()` correto.
3. **Confrontar o comportamento com o comentário da própria função.**
   Quando uma função documenta um "mapa de estados" no comentário (ex.:
   "N estados possíveis: ..."), percorra CADA estado descrito e
   confirme no código que ele realmente resulta no comportamento
   prometido — um estado esquecido na condicional é o tipo de bug mais
   fácil de nunca aparecer em teste manual (ninguém testa o estado que
   não sabe que existe). Foi assim que se achou: o comentário de
   `_crvUpdateFichaSecVisibility` descrevia que uma "versão" (2º nível)
   deveria esconder todos os campos próprios da ficha, mas a condicional
   só cobria o caso "campanha".
4. **Pegadinhas de JS em checagem de vazio/falsy.** `[]` e `{}` são
   truthy; `0`/`''`/`NaN` são falsy mas podem ser dado válido (ex.: um
   campo numérico zerado de propósito, não "vazio"). Qualquer
   `if(!campo)`/`if(campo)` decidindo entre "vazio" e "preenchido"
   merece essa checagem específica.
5. **Rastrear recursão/cascata por ciclo e profundidade.** Funções
   recursivas sobre relação pai-filho (conclusão em cascata, cópia
   recursiva, propagação) — confirme que o teto de profundidade
   documentado é aplicado no CÓDIGO, não só bloqueado na UI (uma
   checagem de UI que impede criar um estado não protege se o dado
   chegar por outro caminho — import, script de console, corrida de
   concorrência entre duas abas).
6. **Código morto / nunca chamado.** Uma função definida mas sem
   nenhum call site real (`grep -nac "nomeDaFuncao("` deve dar mais que
   1 — a própria declaração já conta uma vez) é sinal de refactor
   incompleto ou feature abandonada. Reporte, não delete sem confirmar
   — pode ser chamada só via `onclick="..."` inline no HTML (esse grep
   já pega) ou só existir pra uso futuro documentado.

## Passo 3 — Classificar antes de corrigir

- **Bug claro, sem ambiguidade de comportamento esperado** (ex.: os 4
  achados de exemplo acima): corrige direto, sem perguntar.
- **Ambíguo / decisão de produto** (a pergunta "o que deveria acontecer
  quando X?" não tem resposta óbvia só lendo o código): **pergunta antes
  de implementar** — mesmo padrão usado pra "supercard deveria concluir
  sozinho se todos os filhos forem cancelados?" antes de mexer nisso.
- Nunca refatore/redesenhe além do necessário pra corrigir o achado
  específico — ver "O que esta rotina NÃO é" acima.

## Passo 4 — Reportar achados

Pra cada achado: arquivo + função/linha, o cenário concreto que expõe o
bug (input/estado → resultado errado, não só "isso parece estranho"), e
a severidade. **Apresente a lista antes de sair corrigindo tudo**, a
menos que o pedido original já tenha sido "corrige tudo que achar" —
fluxo já validado: reportar achados, usuário responder "resolve!" +
esclarecer o caso ambíguo, só então implementar.

## Passo 5 — Corrigir + checks de rotina + release

Mesma disciplina de sempre neste repo:
1. Corrige só no arquivo `-dev`/de teste da área tocada (nunca
   `kanban.html` direto — segue o "Release process" do `CLAUDE.md`).
2. `node --check` no maior bloco `<script>` + balanço de chaves/
   parênteses do arquivo inteiro contra o baseline conhecido da sessão.
3. Se a correção criou uma função/helper novo, confere se o
   `CODE_MAP.md` precisa de anchor novo — atualiza no mesmo commit ou
   roda `/atualizarcodemap` depois.
4. Bump de versão + entrada em `CHANGELOG.md`, explicando o bug real
   com o cenário concreto que ele causava — não só "corrige
   inconsistência".
5. Commit → `git fetch origin main -q && git rebase origin/main -q` →
   push → PR (nunca self-merge sem checar CI).
6. Promoção pra prod é etapa separada (`/subirproprod`), só depois de
   validação explícita de quem pediu a revisão.

## Histórico de achados (não repetir análise já feita)

- **2026-08-21, área Supercards (2 níveis) — origem desta skill**:
  revisão pedida direto pelo usuário logo após a v8.30.454 (encadeamento
  campanha→criativo→versão) ir ao ar. 4 bugs reais achados e corrigidos
  (dev v8.30.454-dev, PR #466 → prod v8.30.455, PR #467):
  1. `_crvUpdateFichaSecVisibility` — versão (2º nível) mostrava campos
     próprios como editáveis, contradizendo a própria nota do card
     (achado via técnica 3, comentário vs. código).
  2. `apply_fanout` (ação de Automação) não chamava
     `_crvPropagateToChildren()` como o caminho manual chama (achado
     via técnica 1, caminhos paralelos).
  3. `_crvPropagateToChildren` usava `!crv[k]` em vez de checar array
     vazio de verdade (achado via técnica 2, comparação com
     `_mergeModeloEmCardObj`/`isEmpty()`).
  4. `_checkSupercardAutoComplete` concluía o supercard sozinho mesmo
     com todos os filhos cancelados — achado reportado como pergunta de
     produto (Passo 3), confirmado pelo usuário como bug real antes de
     implementar `_isColCancelLike()`.

- **2026-08-26, área Automações (`AUTO_TRIGGERS`/`runAutoRules`)**:
  não veio de pedido explícito de área — o usuário reportou "automações
  não estão funcionando" ao vivo, a investigação achou o 1º bug fora do
  fluxo desta skill, e o 2º veio de rodar a técnica 1 (caminhos
  paralelos) contra o achado do 1º. 2 bugs reais, mesma classe os dois:
  um evento de trigger disparava por alguns caminhos (arrastar, atalhos
  de contexto/bulk) mas não pelo modal do card (Salvar/autosave), porque
  o wrapper de notificações em `saveCard()`/`scheduleAutoSave()`
  disparava a notificação (`notifX()`) mas esquecia o `runAutoRules()`
  irmão — diferente dos outros blocos do mesmo wrapper, que sempre
  disparam os dois juntos.
  1. `assigned` ("Card atribuído a X") não disparava ao trocar
     responsável pelo dropdown do modal + Salvar (dev v8.30.474-dev,
     PR #533 → prod v8.30.474, PR #534).
  2. `move` ("Card movido para coluna") não disparava ao trocar a
     coluna pelo dropdown do modal + Salvar OU autosave — só
     arrastar/`ctxMove()` disparavam (dev v8.30.476-dev, PR aberta
     nesta rodada). Achado ao comparar TODOS os call sites de
     `runAutoRules('move', ...)` contra o padrão que causou o bug #1.

Atualize esta seção a cada rodada nova (área coberta, achados, PRs) —
isso evita reanalisar do zero uma área que já foi varrida e está limpa,
e documenta o "por quê" de cada correção pra quem ler depois.
