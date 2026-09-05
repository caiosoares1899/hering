---
name: atualizarhelpcontent
description: Sincroniza a documentação in-app do Maré Digital (a Central de Ajuda "❓"/Ctrl+K, objeto `HELP_CONTENT` em kanban-dev.html, e o texto inline das telas de configuração) com o comportamento real de uma funcionalidade que acabou de mudar — ou audita tudo em busca de entradas desatualizadas. Use sempre que o usuário pedir para "atualiza o help content", "atualiza a central de ajuda", "sincroniza a documentação", "revisa a ajuda do board", "a documentação tá desatualizada", "roda a rotina de help content", ou perguntar algo como "atualizou o help content também?" depois de uma feature/fix — mesmo que a frase não mencione "HELP_CONTENT" ou "Ctrl+K" explicitamente.
---

# Atualizar Help Content — Maré Digital

Rotina criada depois de um gap real: a funcionalidade de Supercard/fan-out
mudou várias vezes numa mesma sessão (modelo do card pai, depois "vários
filhos separados por vírgula"), o texto inline da aba ⚙ Config →
Automações foi atualizado nas duas vezes, mas a entrada correspondente na
Central de Ajuda (`HELP_CONTENT.cards`) só foi corrigida numa 2ª rodada,
depois que alguém perguntou "atualizou o help content também?". Esta
skill existe pra não deixar esse tipo de gap escapar de novo.

## Onde a documentação in-app vive (2 lugares que precisam ficar em sincronia)

1. **`HELP_CONTENT`** (`kanban-dev.html`, objeto grande perto da linha
   ~17714) — uma chave por categoria (`board`, `cards`, `agente`,
   `config`, `agil`, `comunicacao`, `kudos`, `spotify`, `automacoes`),
   cada uma um array de `{ icon, title, text }`. Renderizado na "❓
   Central de Ajuda" (funções `openHelp()`/`renderHelp()`), buscável por
   Ctrl+K/Cmd+K em qualquer aba. `text` aceita `\n\n` pra quebra de
   parágrafo e `<b>` pra negrito; entradas mais ricas (chips coloridos,
   listas, `<div>` estruturado) usam template literal (crase) em vez de
   aspas simples — veja a entrada `automacoes` → "O que é uma automação"
   como exemplo desse padrão mais elaborado.
2. **Texto inline da própria tela** onde a funcionalidade mora — o `<p>`
   de intro de uma aba de Config (ex.: a descrição acima da lista de
   receitas de fan-out), tooltips `title="..."` em botões/selects,
   placeholders. É o que a pessoa vê PRIMEIRO, sem precisar abrir a
   Central de Ajuda.

**O risco**: são dois textos escritos e mantidos separadamente — dá pra
atualizar um e esquecer do outro com facilidade, porque nenhum dos dois
"sabe" que o outro existe. Trate sempre como uma coisa só: qualquer
mudança de comportamento que mereça atualizar um desses textos, quase
certamente merece atualizar o outro também.

## Passo 1 — Identificar o que mudou

Se a mudança já tem commits recentes, comece pelo histórico:
```bash
git log --oneline -15 -- kanban-dev.html
git show <hash> -- kanban-dev.html
```
Se for pedido geral ("revisa toda a documentação"), em vez de uma
feature específica, liste as entradas de `HELP_CONTENT` da categoria
relevante e compare cada uma contra o comportamento atual — abrindo a
tela de verdade ou lendo a função que ela descreve.

## Passo 2 — Achar a entrada certa em HELP_CONTENT

```bash
grep -n "title:'<palavra-chave>" kanban-dev.html
```
Categoria mais provável por assunto: `cards` (tudo relacionado a
card/modal — supercard, modelos, checklist, dependências…),
`automacoes` (regras, gatilhos, ações), `config` (abas de configuração
em geral), `board` (toolbar, filtros, visualização), `agil` (sprint,
WIP, métricas), `comunicacao` (mural, notificações), `agente` (Agente
Ágil/IA).

## Passo 3 — Checar o texto inline da tela (a OUTRA fonte, ver acima)

Busque o parágrafo de intro perto de onde a funcionalidade vive — no
Config costuma seguir o padrão `<p style="font-size:11px;color:var(--txt2)`
— e qualquer `title="..."` em botões/selects próximos. Se uma das duas
fontes mudou e a outra não foi checada, essa é a inconsistência a
corrigir. As duas devem contar a MESMA história, só que em profundidades
diferentes (inline = resumo rápido no contexto; Central de Ajuda =
explicação completa, buscável de qualquer lugar).

## Passo 4 — Escrever no mesmo tom/formato das entradas vizinhas

- Comece pelo cenário/problema real (como as entradas existentes fazem —
  ex.: "Quando um pedido único vira vários cards por causa de
  formato/veículo/teste diferentes…"), não por uma lista seca de campos.
- `\n\n` entre parágrafos; `<b>` só em 1-2 termos-chave por parágrafo,
  não negritar tudo.
- Nomeie o elemento de UI EXATAMENTE como aparece na tela — mesmo emoji,
  mesmo texto do botão/label. É assim que quem está lendo casa o que leu
  com o que está vendo.
- Funcionalidade existente ganhou uma capacidade nova (ex.: "modelo do
  card pai" chegou depois dos filhos)? Acrescente um sub-parágrafo com
  seu próprio emoji-marcador dentro do MESMO `text` da entrada já
  existente (`\n\n👑 Card pai também pode ter Modelo: ...`), do jeito que
  já é feito nas entradas atuais — não crie uma entrada nova pra cada
  evolução incremental da mesma funcionalidade; isso fragmenta a busca.

## Passo 5 — Verificar sintaxe antes de considerar pronto

`HELP_CONTENT.text` às vezes usa crase (template literal) em vez de
aspas simples pra entradas com HTML mais rico — cuidado com crase ou
`${...}` acidental dentro de texto que devia ser literal. Depois de
editar, rode o check de sintaxe já padrão neste repo (extrai o maior
bloco `<script>` e roda `node --check`):
```bash
python3 -c "
import re
html = open('kanban-dev.html', encoding='utf-8').read()
scripts = re.findall(r'<script>([\s\S]*?)</script>', html)
scripts.sort(key=len, reverse=True)
open('/tmp/help_check.js','w',encoding='utf-8').write(scripts[0])
"
node --check /tmp/help_check.js
```

## Passo 6 — Fluxo de release

Mesmo processo do `CLAUDE.md` ("Release process") — texto de ajuda é
conteúdo de `kanban-dev.html`, então segue as mesmas regras de qualquer
outra mudança na página:

1. Edite só `kanban-dev.html` — nunca `kanban.html` diretamente.
2. Bump da versão: `<div class="version">` no HTML + a chave `kanban_dev`
   em `version.json`.
3. Entrada no `CHANGELOG.md`, sob `## kanban-dev.html (ambiente de
   teste)` — pode ser só texto de ajuda ("puramente documentação, sem
   mudança de comportamento") se for o caso.
4. `git fetch origin main && git rebase origin/main` antes de empurrar —
   o `main` deste repo avança com frequência.
5. `git push -u origin <branch-atual>`, abra PR (nunca self-merge).
6. Promoção pra `kanban.html` (prod) é etapa separada — texto de ajuda
   puro costuma ser baixo risco o suficiente pra promover na sequência,
   mas confirme com quem pediu antes de assumir isso por padrão.

## Resumo do que já foi encontrado (histórico, pra não repetir trabalho)

Formato: baseline → novo — o que motivou — achados/correções.

- **v8.30.348→354-dev (origem da skill)**: "Supercard (cards filhos)"
  ficou desatualizada 2x seguidas (modelo do card pai, depois batch de
  filhos) antes de alguém perguntar "atualizou o help content também?".
- **v8.30.417→425-dev (2026-08-14)**: auditoria completa, sem gap
  encontrado — todos os commits do período já eram genéricos o
  suficiente ou puramente internos.
- **v8.30.455→458-dev (2026-08-24)**: squad `dados` ganhou Agente Ágil
  — 2 entradas corrigidas. **Achado incidental, bug real**: dropdown
  "🤖 Modo autônomo" checava `ACTIVE_SQUAD==='dev'` hardcoded, separado
  da fonte real de visibilidade — squad `dados` via a ação mas o
  dropdown vinha vazio. Lição: ao expandir escopo de squad, grep por
  `==='dev'` perto da feature pra achar gates duplicados.
- **v8.30.458→464-dev (2026-08-24)**: sync com liberação de Automações
  pra qualquer papel — 5 entradas corrigidas (Supercard, Automações,
  Papéis no board, Funções de card).
- **v8.30.464→484-dev (2026-08-26)**: maior sync até então, 18 commits.
  **Achado grande**: 5 de 8 entradas da categoria `agente` eram
  resquício do painel de chat morto (`AGENTE_AGIL_ATIVO=false` há
  tempos) — removidas. Lição: ao remover um ponto de entrada de UI,
  sempre perguntar "alguma entrada de ajuda descreve só isso?", não só
  corrigir texto que mudou.
- **v8.30.484→508-dev (2026-08-30)**: ~24 commits, 6 correções.
  **Achado mais sério**: "Ações que o agente pode executar" dizia "não
  cria cards" — falso desde `criar_card` (3 dias antes). Lição: reler
  cada frase categórica ("não faz X", "sempre Y") contra o código, não
  só perguntar "falta algo?" — são essas frases que envelhecem mal.
- **v8.30.508→514-dev (2026-08-31)**: 2 correções pequenas — sinal
  positivo de que quem implementa a feature já atualiza o help na hora.
- **v8.30.514→584-dev (2026-09-04)**: **achado de processo**: o
  baseline anterior registrado aqui estava ele mesmo desatualizado (a
  sync real tinha sido ~20 commits depois, sem nunca ter sido
  registrada) — esta seção de histórico também precisa de
  "retrato não é live", mesma disciplina do `CODE_MAP.md`. 1 gap real
  (atalho "🔗 Copiar link do card" sem menção na ajuda).

Atualize esta seção a cada rodada nova (2-4 linhas: baseline→novo, o
que motivou, achados) — evita re-analisar algo já checado e em dia.
