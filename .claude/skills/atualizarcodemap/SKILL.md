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

Formato: data — rodapé anterior → novo — sync kanban/painel — âncoras
revalidadas — seções novas — achados incidentais notáveis.

- **2026-08-24 (1ª)**: `49bd2c1`→`0b97e99`. kanban/kanban-dev divergiam
  (squad `dados` não promovido). ~60 âncoras, sem remoção/renome. 2
  seções novas em `functions/` (`agenteAgilMencaoDados`,
  `escolheClienteParaTarefa.js`, fábrica `createMentionTrigger()`).
- **2026-08-25 (2ª)**: `0b97e99`→`61d2d4a`. kanban/kanban-dev
  sincronizados de novo. ~65 âncoras. 4 seções novas/reescritas
  (`_newCardHasContent()`, acesso à tela de Automações,
  `dueOverdueTrigger.js` desatualizado, 2 fixes de `mentionTrigger.js`
  sem entrada).
- **2026-08-26 (3ª)**: `61d2d4a`→`307e6d9`. Sincronizados. ~85 âncoras,
  drift crescente (+68 a +475 linhas). 2 seções novas: **Impedimentos
  (modo coluna vs. tag)** — nunca tinha âncora própria apesar de lógica
  não-trivial — e bullet sobre `agenteHotline` vazando em agregações.
- **2026-08-30 (4ª)**: `307e6d9`→`b5e99ae`. Sincronizados. ~110 âncoras.
  **Achado de processo**: script de auto-substituição colava o MESMO
  número em linhas com 2 nomes (`nomeA()/nomeB() — LX/LY` virava
  `LX/LX`) — sempre rodar `grep -E "L(\d+)/L\1"` depois de substituição
  em lote, não confiar só no diff visual. 1 seção nova: **Padrões de
  card** (já tinha causado 3 bugs reais, nunca teve âncora). 1
  inconsistência interna corrigida (`agenteAgilIntake` contradizia a si
  mesmo sobre modo sombra vs. escrita real).
- **2026-08-31 (5ª)**: `b5e99ae`→`68e233d`. kanban/kanban-dev divergiam
  (lote do dia não promovido) — números viraram os de `kanban-dev.html`.
  **Achado de processo**: script Python usou `grep` sem `-E`, todas as
  104 âncoras testadas vieram "MISSING" por engano — sempre confirmar 1
  caso manualmente antes de aceitar um resultado de "tudo sumiu". ~104
  âncoras revalidadas. 4 seções/entradas novas.
- **2026-09-05 (6ª)**: `68e233d`→`7d22d03`. Rodada delegada a um agente
  em background (~184 chamadas, ~18min). kanban/kanban-dev ganharam
  divergência PERMANENTE nova (favicon próprio pro dev, `ff759f8`) —
  cabeçalho atualizado. ~150 âncoras (maior drift já visto, +300 a
  +2500 linhas). 1 seção nova (Modal mobile estilo Trello, CSS puro). 1
  seção do painel corrigida pra refletir promoção que aconteceu no meio
  da rodada. **Lição operacional**: esta rodada rodou concorrente com
  outro trabalho na mesma sessão (promoção de prod + `/monitorarbugs`)
  — o agente em background e o trabalho em primeiro plano colidiram no
  mesmo `CODE_MAP.md` várias vezes (git checkout pisando em edits do
  agente e vice-versa), custando 4 PRs de checkpoint em vez de 1. Não
  rodar esta skill em background enquanto outro trabalho no mesmo
  repositório está ativo na mesma sessão — os dois compartilham o
  working directory independente de qual branch está "logicamente"
  ativa.

Atualize esta seção a cada rodada nova: data, commit revisado no rodapé
anterior vs. novo, quantas âncoras corrigidas/removidas, quantas seções
novas adicionadas. 2-6 linhas por rodada — o objetivo é não repetir
trabalho já feito, não preservar a narrativa completa.
