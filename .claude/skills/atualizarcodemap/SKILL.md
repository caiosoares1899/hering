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

Atualize esta seção a cada rodada nova: data, commit revisado no rodapé
anterior vs. novo, quantas âncoras corrigidas/removidas, quantas seções
novas adicionadas. Isso evita reler o arquivo inteiro do zero numa
rodada futura sem saber o que já foi conferido recentemente.
