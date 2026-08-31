---
name: atualizarcodemap
description: Sincroniza o CODE_MAP.md com o código de verdade — revalida cada âncora existente (linha certa, função ainda existe com esse nome), acha áreas funcionais novas sem seção própria, e atualiza o rodapé "Retrato do commit". Use sempre que o usuário pedir "atualiza o codemap", "atualiza o mapa do código", "sincroniza o CODE_MAP", "revisa o CODE_MAP.md", "roda o atualizarcodemap", "o mapa do código tá desatualizado", ou invocar /atualizarcodemap diretamente — mesmo que a frase não mencione "CODE_MAP.md" explicitamente (ex.: "confere se o índice do código ainda bate com a realidade"). Diferente do passo 8 do /subirproprod (que só confere o diff de UMA promoção específica) — esta é a auditoria PROFUNDA do arquivo inteiro.
---

# Atualizar CODE_MAP — Maré Digital

O `CODE_MAP.md` é mantido à mão — o próprio arquivo já avisa no
cabeçalho que os números de linha são "um retrato de um commit
específico" e ficam desatualizados a cada edição. Isso é esperado e
tolerável pra *linha*: quem for usar sempre re-`grep` antes de confiar
(convenção documentada no próprio arquivo). O que NÃO é tolerável é uma
entrada morta — uma função que foi renomeada ou removida e o mapa ainda
aponta pra ela como se existisse, ou uma área funcional nova (Notas,
Backup, Supercard de 2 níveis...) que já tem centenas de linhas de
código mas nenhuma entrada — isso manda quem está procurando pro lugar
errado com falsa confiança, pior do que não ter mapa nenhum ali. O
`CLAUDE.md` já registra um caso real desse tipo de drift silencioso:
`functions/index.js` ficou documentado como "a única Cloud Function" por
semanas depois de várias outras terem sido adicionadas (Spotify, intake,
backup semanal). Esta skill existe pra pentear isso sistematicamente, em
vez de só corrigir o que aparece por acaso numa promoção.

Rode isso periodicamente por iniciativa própria também, não só quando
pedido — drift de documentação mantida à mão é silencioso por natureza,
ninguém percebe até tentar usar a entrada errada.

## Passo 1 — Confirma a premissa do cabeçalho: kanban.html e kanban-dev.html sincronizados?

```bash
diff kanban.html kanban-dev.html
```

O `CODE_MAP.md` assume os dois arquivos byte-idênticos exceto a versão/
`VERSION_KEY` (ver seu próprio cabeçalho: "os números abaixo valem pros
dois"). Se divergirem em mais que essas 2 linhas nesse momento (dev com
trabalho não promovido ainda), ajusta o texto do cabeçalho pra deixar
isso explícito em vez de simplesmente confiar que a premissa continua
verdadeira.

## Passo 2 — Revalida CADA âncora existente

Pra cada entrada `nomeDaFuncao() — LNNNN` do arquivo, re-`grep` a linha
real:

```bash
grep -na "function nomeDaFuncao\|^let nomeDaFuncao\|^const nomeDaFuncao\|^var nomeDaFuncao" kanban-dev.html
```

(`-a` sempre — os arquivos deste repo têm emoji/unicode que faz `grep`
sem `-a` reportar "binary file matches" e não mostrar nada.)

- **Linha só andou** (função ainda existe, número mudou): atualiza o
  número, sem mais nenhuma ação.
- **Função renomeada**: procura o equivalente (busca por um nome muito
  parecido, ou `git log -p --follow` em volta da linha antiga se não
  achar por nome) e atualiza a entrada pro nome novo — não deixa o nome
  velho.
- **Removida de vez, sem substituto**: apaga a entrada. Não deixa
  "anchor morto" só porque dá trabalho confirmar que sumiu mesmo.
- **Área inteira desativada, não removida** (ex.: a pausa do
  `spotifySync` já documentada): atualiza a nota explicando o status
  atual, no mesmo padrão que a seção "spotify/" já usa — não apaga a
  seção inteira quando o código ainda está lá, só pausado.

## Passo 3 — Acha áreas funcionais novas sem seção

```bash
git log --oneline -30 -- kanban-dev.html painel.html functions/
```

Pra cada feature/fix notável que foi ao ar desde o commit do rodapé
atual (`*Retrato do commit ...*`, última linha do arquivo), decide: isso
é um ajuste dentro de uma área que o mapa JÁ indexa (não precisa de nada
novo), ou é uma área funcional genuinamente nova o suficiente pra
merecer seu próprio `###`? Ao adicionar, mantém o mesmo nível de curadoria
que o resto do arquivo já tem — âncoras são os pontos de entrada que
alguém realmente quer pra pular direto na área (função/const + linha +
descrição de uma linha), não um dump de toda função nova que existe.

## Passo 4 — Confere consistência interna do próprio arquivo

- **Drift sistemático**: se a MAIORIA das entradas de uma seção estão
  erradas por uma margem grande (não só ±10-15 linhas — comentários
  crescem com o tempo, isso é normal), é sinal de que aquela seção
  inteira não foi revisada desde antes de um lote grande de mudanças —
  vale conferir a área com mais cuidado, não só corrigir linha por
  linha.
- **`painel.html`/`painel-dev.html` realmente divergem** (nota já
  existente no cabeçalho da seção `painel.html`) — roda um `diff`
  rápido pra confirmar que a nota continua verdadeira, em vez de
  assumir.
- **`functions/index.js` — registro de exports** bate com o que está de
  fato exportado:
  ```bash
  grep -n "^exports\." functions/index.js
  ```
  Compara contra a lista que a seção "index.js — registro de exports"
  do `CODE_MAP.md` documenta (incluindo o que está comentado/pausado,
  tipo `spotifySync`).

## Passo 5 — Atualiza o rodapé

Última linha do arquivo, sempre:

```
*Retrato do commit `<hash-do-commit-atual>` (<data-de-hoje>).*
```

Usa o hash do commit em que a rodada está sendo feita (`git rev-parse
--short HEAD` antes de commitar as mudanças do mapa em si).

## Passo 6 — Checks + release

`CODE_MAP.md` é documentação pura, não código executável — não precisa
do `node --check` de sintaxe. Ainda assim segue o fluxo de release
normal do repo:

1. Nunca commita direto em `main` — sempre branch/PR, mesmo pra
   documentação.
2. Não precisa de bump de versão em `version.json` nem entrada no
   `CHANGELOG.md` a menos que a correção seja notável o suficiente pra
   valer registro (ex.: seção inteira nova, não só linhas reajustadas)
   — julgamento, não regra fixa.
3. `git fetch origin main -q && git rebase origin/main -q` antes de
   empurrar — o `main` deste repo avança com frequência.
4. `git push -u origin <branch-atual>`, abre PR (nunca self-merge sem
   checar).

## Histórico de rodadas (não repetir trabalho já feito)

- **2026-08-24 — 1ª rodada usando esta skill** (rodapé anterior:
  `49bd2c1`, 2026-08-21 → novo: `0b97e99`). `kanban.html`/`kanban-dev.html`
  divergiam no momento da rodada (dev com squad `dados` no autocomplete/
  atalhos do Agente Ágil, ainda não promovido) — cabeçalho atualizado
  pra deixar isso explícito, números agora são de `kanban-dev.html`
  (superset). ~60 âncoras revalidadas (todas ainda existiam, só linha
  andou — nenhuma removida/renomeada, drift de +11 a +33 linhas
  dependendo da posição, por conta dos commits do Agente Ágil client-side
  desde a última rodada). 2 seções novas em `functions/`: export
  `agenteAgilMencaoDados` (L198, squad `dados`) e dentro de
  `agente-agil-orquestrador/` — `escolheClienteParaTarefa.js` (roteamento
  de modelo, Item 7) e a fábrica `createMentionTrigger()` em
  `mentionTrigger.js` (multi-squad, substituiu a descrição de
  squad único). `tools/lerCard.js` ganhou entrada própria
  (`colunas_disponiveis`). Marcadores `// --- X ---` revalidados
  (mesmo drift). `painel.html`/`painel-dev.html` reconfirmado que
  divergem de verdade.

- **2026-08-25 — 2ª rodada** (rodapé anterior: `0b97e99`, 2026-08-24 →
  novo: `61d2d4a`, 2026-08-25). `kanban.html`/`kanban-dev.html`
  confirmados byte-idênticos de novo (promoção da v8.30.460 já
  mergeada) — cabeçalho voltou a dizer "promoção da vX.Y.Z confirmada"
  em vez do aviso de divergência da rodada anterior. ~65 âncoras
  revalidadas nas 3 seções (`kanban.html`/`kanban-dev.html`,
  `painel.html`, `functions/`) — todas ainda existiam, só linha andou
  (nenhuma removida/renomeada). Drift bem maior que o normal na seção
  `kanban.html` (+150 a +270 linhas dependendo da posição no arquivo,
  vs. +11 a +33 na rodada anterior) por causa do lote grande desta
  sessão: extração do overlay `#auto-ov` (~80 linhas), `fbCreateCard()`
  + rede de segurança de card sumido, tags/filtro em receitas, guarda
  de card novo não salvo. Painel só teve drift pequeno (~35 linhas).
  4 seções novas/reescritas:
  - `kanban.html`: `_newCardHasContent()`/`_newCardGuardOff` (guarda
    "sair sem salvar" pra card em criação — antes só cobria edição de
    card existente).
  - `kanban.html`: bullet "Acesso à tela de Automações" dentro de
    Automações (achado: só chegava lá via Config, escondido de quem
    não é PO/Organizador/ADM, mesmo sem trava nenhuma nas ações —
    `openAutoOv()` extraiu pra overlay próprio, acessível também via
    ⚡ Funções de card) + campo `tags`/filtro em receitas de fan-out.
  - `functions/agente-agil-orquestrador/dueOverdueTrigger.js`: entrada
    estava desatualizada dizendo "só due_overdue" — corrigido, cobre
    due_today também desde o mesmo dia (2026-08-24), só não foi
    atualizada na rodada anterior por ter sido commitada num lote
    diferente.
  - `functions/agente-agil-orquestrador/mentionTrigger.js`: 2 fixes
    reais achados validando o item 5 em produção (disparo por
    Automação não notificava ninguém; `idOverride` colidindo com
    histórico antigo) — nenhum dos dois tinha entrada, adicionados.
  `painel.html`/`painel-dev.html` reconfirmado que divergem de verdade
  (diff rodado de novo, 1287 linhas de diferença).

- **2026-08-26 — 3ª rodada** (rodapé anterior: `61d2d4a`, 2026-08-25 →
  novo: `307e6d9`, 2026-08-26). `kanban.html`/`kanban-dev.html`
  confirmados byte-idênticos de novo (promoção da v8.30.487 já
  mergeada) — cabeçalho atualizado. ~85 âncoras revalidadas nas 3
  seções (`kanban.html`/`kanban-dev.html`, `painel.html`, `functions/`)
  — todas ainda existiam, só linha andou (nenhuma removida/renomeada;
  só `fbSaveCard()` exigiu regex mais solto pro grep, já que a
  declaração está indentada — não é sinal de problema, só de estilo).
  Drift bem maior que as rodadas anteriores (+68 a +475 linhas
  dependendo da posição no arquivo, crescente da parte de cima pro
  fim), por causa do volume desta sessão: card hotline "Converse com o
  Agente Ágil" (6 rodadas de feedback, ~250 linhas), fix do bug de
  cards de impedimento sumindo do board (2 rodadas), sync geral de
  HELP_CONTENT, checkbox de Campanhas, e a rodada de `/monitorarbugs`
  que motivou parte desta auditoria. `functions/index.js` (registro de
  exports) e os arquivos internos do orquestrador tocados desde a
  rodada anterior (`dueOverdueTrigger.js`, `resumoMeuDia.js`,
  `mentionTrigger.js`, `escolheClienteParaTarefa.js`) já estavam
  corretos — as entradas desses arquivos tinham sido escritas
  corretamente na hora de cada mudança, sem esperar por esta rodada.
  2 seções novas:
  - `kanban.html`: **Impedimentos (modo coluna vs. tag)** — seção nova
    inteira (`blockerMode`, `_cardIsBlocked()`, `saveBlockerMode()`,
    `ctxMove()`/`ctxBlock()`, `_doBulkBlockCol()`/`_doBulkUnblockCol()`,
    `delColumn()`), motivada por um incidente real em produção (squad
    `midiacriativa`, 64 cards sumidos do board por coluna excluída) que
    NUNCA tinha tido nenhuma âncora própria neste mapa, apesar de ter
    lógica não-trivial há tempos.
  - `kanban.html`: bullet novo dentro de `openAgenteHotline()`
    documentando os achados do `/monitorarbugs` desta sessão (card
    hotline vazando em métricas de "Dados do Board" e em 3 buscas de
    card) — junta tudo que precisa lembrar de excluir `agenteHotline`
    ao escrever uma futura agregação "todos os cards".
  - `functions/agente-agil/board.js`: bullet aditivo (não seção nova)
    sobre `SQUAD_ID` default trocado de `'ecomm'` (descontinuado) pra
    `'dev'` (2026-08-25) — achado ao varrer `git log` do período, sem
    entrada nenhuma até esta rodada.
  `painel.html`/`painel-dev.html` reconfirmado que divergem de verdade.

- **2026-08-30 — 4ª rodada** (rodapé anterior: `307e6d9`, 2026-08-26 →
  novo: `b5e99ae`, 2026-08-30). `kanban.html`/`kanban-dev.html`
  confirmados byte-idênticos de novo (promoção da v8.30.504 já
  mergeada) — cabeçalho atualizado. Rodada com volume grande de trabalho
  acumulado (~55 commits desde a rodada anterior: Agentes Externos no
  painel, mutações do orquestrador disparando Automações via
  `agente_pending_auto`, ferramenta `risco`, intake com escrita real,
  vários `/monitorarbugs`). ~110 âncoras revalidadas nas 3 seções
  (`kanban.html`/`kanban-dev.html`, `painel.html`/`painel-dev.html`,
  `functions/`) — todas ainda existiam, só linha andou (nenhuma
  removida/renomeada). Drift crescente da parte de cima pro fim do
  arquivo, mesmo padrão de sempre (+15 a +46 no topo, +62 em ~9-10k,
  +100 em ~12-15k, +243 a +311 em ~21-26k, +284 em ~26-28k). Achado
  incidental relevante: o script de auto-substituição usado nesta rodada
  tinha um bug de pareamento em linhas com múltiplos nomes/números
  (`nomeA()/nomeB() — LX/LY`) que colava o MESMO número novo nos dois —
  motivo pra sempre rodar uma checagem de "L(\d+)/L\1" (número repetido
  colado por engano) depois de qualquer substituição em lote, não só
  confiar no diff visual. 1 seção nova:
  - `kanban.html`: **Padrões de card (cardPatterns)** — nunca tinha tido
    seção própria apesar de já ter causado 3 bugs reais em dias recentes
    (#589/#590/#600/#605, todos `/monitorarbugs`) — mesma classe de bug
    toda vez: 1 de N pontos que mexem no padrão ficando pra trás de um
    comportamento que os outros já tinham (`runAutoRules()` não disparado
    na criação, card aberto não atualizado na hora).
  Também corrigida 1 inconsistência interna real (não drift de linha):
  o resumo de `agenteAgilIntake` em "index.js — registro de exports"
  ainda dizia "MODO SOMBRA (nunca validado em produção)", mas a entrada
  detalhada da própria seção `intakeTrigger.js`, mais abaixo no mesmo
  arquivo, já documentava escrita real desde 2026-08-27 — o próprio
  `functions/index.js` confirma (comentário + `dryRun:false` na
  instância `dev`). Corrigido pra não contradizer a si mesmo.
  `painel.html`/`painel-dev.html` reconfirmado que divergem de verdade
  (diff, 1451 linhas de diferença).

- **2026-08-31 — 5ª rodada** (rodapé anterior: `b5e99ae`, 2026-08-30 →
  novo: `68e233d`, 2026-08-31). `kanban.html`/`kanban-dev.html`
  **divergem no momento desta rodada** (374 linhas de diff — lote grande
  do dia ainda não promovido: cadastro de Agentes de IA, Agente Ágil
  como Responsável/Participante, revisão arquitetural dos disparos de
  `@Agente Ágil`, squad `dev` habilitado) — cabeçalho do `CODE_MAP.md`
  atualizado explicitando isso, números agora são de `kanban-dev.html`
  (superset), mesmo padrão da 1ª rodada quando isso já tinha acontecido
  antes. Script Python (`grep -E`, não BRE — achado de bug no processo:
  a 1ª tentativa usou `subprocess` sem `-E`, todas as 104 âncoras
  testadas vieram "MISSING" por causa disso, não porque sumiram de
  verdade — sempre confirmar 1 caso manualmente antes de confiar num
  resultado de "tudo sumiu") revalidou as 86 âncoras da seção
  `kanban.html`/`kanban-dev.html` (nenhuma removida/renomeada — todas só
  andaram de linha, drift de -7 a +284, crescente da parte de cima pro
  fim do arquivo, mesmo padrão de sempre) e as 18 da seção `painel.html`
  (15 com drift 0 — arquivo não mudou nessas partes —, 3 da subseção
  "Agentes Externos" com drift real, corrigidas usando os números de
  `painel-dev.html`, não `painel.html`, porque essa subseção específica
  já tinha uma nota própria dizendo "linhas abaixo são de
  painel-dev.html", diferente da convenção do resto da seção painel —
  quase pisei nisso substituindo pelos números de `painel.html` por
  engano, ver texto atualizado explicando o porquê). Seção
  `functions/agente-agil-orquestrador/` usa citação por FILE NAME na
  maioria das entradas (não por linha) — só 5 tinham `— LNNNN` explícito
  (`processarMencao`, `classificaComplexidade`, `MODEL_BY_TIER`,
  `sinaisDoCard`, `gerarResumoMeuDia`); 2 tinham drift real (`sinaisDoCard`
  L111→L87, `gerarResumoMeuDia` L174→L178), corrigidas; `processarMencao`
  L133→L134 corrigido por completude (drift de 1 linha). `functions/
  index.js` (registro de exports) conferido linha por linha contra
  `grep -n "^exports\."` — bate 100%, nenhuma divergência. Arquivos
  citados só por nome em `agente-agil/`/`intake/`/`backup/`/`spotify/`
  todos confirmados existentes (`ls`), nenhum removido.
  4 seções/entradas novas (todas já escritas corretamente na hora de
  cada mudança durante a sessão, não descobertas só agora nesta rodada —
  diferente das rodadas anteriores onde o gap só aparecia na auditoria):
  `squadScope.js`, `tools/notificarEspecialistaExterno.js`,
  `AGENTE_AGIL_ASSIGNEE_ENTRY`/`_dispatchAgenteAgilComment()` em
  `kanban.html`, e o bullet "Webhook de retorno" na subseção "Agentes
  Externos" do painel. `painel.html`/`painel-dev.html` reconfirmado que
  divergem de verdade (diff, 1466 linhas de diferença). Não indexada de
  propósito (curadoria, não esquecimento): opção "Dias úteis (seg-sex)"
  em recorrência automática — adição pequena a uma feature que nunca
  teve seção própria no mapa, não justifica criar uma agora só por essa
  adição.

Atualize esta seção a cada rodada nova: data, commit revisado no rodapé
anterior vs. novo, quantas âncoras corrigidas/removidas, quantas seções
novas adicionadas. Isso evita reler o arquivo inteiro do zero numa
rodada futura sem saber o que já foi conferido recentemente.
