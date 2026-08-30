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

- **v8.30.348-dev → v8.30.354-dev**: entrada "Supercard (cards filhos)"
  (`HELP_CONTENT.cards`) ficou desatualizada 2 vezes seguidas em relação
  ao texto inline da aba Config → Automações — 1ª vez faltava o modelo
  do card pai (corrigido junto com a feature, v8.30.348-dev), 2ª vez
  faltava o batch de "vários filhos separados por vírgula" (feature
  saiu na v8.30.351-dev, help só foi corrigido na v8.30.354-dev, depois
  de alguém perguntar "atualizou o help content também?"). Motivou a
  criação desta skill.

- **v8.30.417-dev → v8.30.425-dev (auditoria em 2026-08-14, PRs #369, #370,
  #372, #373)**: revisado tudo desde o último sync (#366) — nenhum gap
  encontrado. `b738e7d` (filtros no Dashboard do Controle de Criativos) não
  precisou de ajuste: a entrada "Ficha Técnica" já descreve a tabela como
  genericamente "filtrável", sem restringir a uma aba só. `2aff220`
  (opções Mktpace/Impresso/Outros + fix "Meu Dia" marcando card concluído
  de outro squad como atrasado) também não precisou: Plataforma já é
  documentada de forma genérica, e o fix restaura o comportamento que a
  entrada "Meu Dia" já prometia ("Cards já concluídos não aparecem"), não
  muda o que é prometido. `0f51b9a` e `8c75bc7` (Fases 1 e 2 do
  investimento em custo de Firebase) são só arquitetura interna
  (threshold do fallback de cards, carregamento sob demanda de Modelos) —
  zero texto de tela ou comportamento visível mudou, exceto uma mensagem
  de fallback do Agente Ágil pra uma corrida rara (`salvar_modelo` antes
  dos Modelos carregarem), já coberta pela bullet genérica existente em
  "Ações que o agente pode executar".

- **v8.30.455-dev → v8.30.458-dev (2026-08-24)**: squad `dados` ganhou o
  Agente Ágil (backend em escrita real, depois autocomplete/atalhos no
  client, v8.30.457-dev) — as entradas "O que é o Agente Ágil" e
  "Automações" ainda diziam "só disponível no squad dev", corrigidas
  pros dois squads. **Achado incidental, bug real (não só doc)**: o
  dropdown "🤖 Modo autônomo" da ação "Notificar Agente Ágil"
  (`_autoRenderValueOptions('agent_tab')`) checava `ACTIVE_SQUAD==='dev'`
  hardcoded, separado da fonte que a própria ação usa em `visible:`
  (`AGENTE_AGIL_MENTION_SQUADS`) — squad `dados` via a ação disponível
  mas o dropdown de valor vinha vazio. Corrigido pra usar a mesma fonte.
  Lição: ao expandir o escopo de squad de uma feature, checar TODO ponto
  que hardcoda o nome do squad, não só o de visibilidade top-level — um
  grep por `==='dev'`/`'dev'` perto do código da feature ajuda a achar
  esses gates duplicados e desalinhados.

- **v8.30.458-dev → v8.30.464-dev (2026-08-24)**: sync com o lote
  v8.30.462-dev (`⚡ Automações` liberado pra qualquer papel, com atalho
  novo em ⚡ Funções de card; filtro por nome/tag em "🧩 Aplicar
  receita"). 4 entradas corrigidas: "Supercard (cards filhos)" (2
  referências a "⚙ Config → Automações" + nota sobre o filtro novo),
  "Automações" (categoria), "O que é uma automação" (caminho/audiência),
  "Papéis no board" (removido "automações" da lista exclusiva do PO) e
  "Funções de card" (item novo "⚡ Automações" na lista — e,
  oportunisticamente, "🧹 Cards antigos", que já estava no menu mas
  nunca tinha entrado nessa descrição). v8.30.460-dev/461-dev/463-dev
  (fix crítico de card sumindo + rede de segurança + aviso ao sair de
  card não salvo) não geraram entrada nova: são comportamento de
  bastidor/rede de segurança, auto-explicativo no momento em que
  acontece (toast/diálogo já contam a história), sem tela ou fluxo novo
  pra documentar.

- **v8.30.464-dev → v8.30.484-dev (2026-08-26, invocação genérica
  "/atualizarhelpcontent /")**: maior sync desde a criação da skill —
  18 commits acumulados, incluindo a feature inteira do card hotline do
  Agente Ágil. Achado grande: **5 das 8 entradas da categoria `agente`
  eram resquício do painel de chat antigo** (`openAgent()`/`#ag-ov`,
  `agHistory` por aba) — "Daily", "Métricas", "Retrospectiva", "Memória
  da conversa" e "Snapshot inteligente". O painel morreu de vez em
  v8.30.466-dev (removidos os 2 últimos pontos de entrada, FAB + nav
  mobile) e já estava com `AGENTE_AGIL_ATIVO=false` antes disso (Worker
  Cloudflare fora do ar) — zero forma de alcançar essas telas há tempos,
  mas as entradas continuaram na Central de Ajuda descrevendo um recurso
  inacessível. Removidas as 5. "Dicas de uso" tinha uma contradição
  interna herdada de lá (dizia que o agente reconhece "me atribua", mas
  "Ações que o agente pode executar" já dizia que ele NÃO atribui
  responsável) — corrigida. "Worker e Firebase" (categoria `config`) e
  "Papéis no board" tinham o mesmo tipo de resquício (descreviam o
  Worker como se ainda conectasse o agente atual; diziam que só PO tinha
  acesso ao Agente Ágil) — corrigidas.
  **Lição pra próxima vez que uma feature for desativada/removida**: a
  skill original só previa "funcionalidade mudou de comportamento", não
  "funcionalidade morreu e ninguém tirou a entrada correspondente" — ao
  remover um ponto de entrada de UI (FAB, botão, aba), vale sempre
  perguntar "alguma entrada de HELP_CONTENT descreve só isso, ou algo
  que dependia disso?", não só corrigir o texto que mudou.
  Gaps de feature nova documentados: card especial "Converse com o
  Agente Ágil" (nova entrada), "🤖 Resumo do Agente Ágil" dentro de Meu
  Dia (sub-parágrafo), delay/toast de automações (~1s antes do efeito,
  sub-parágrafo em "O que é uma automação"), duplicar supercard com
  filhos (sub-parágrafo em "Duplicar card"), checkbox "Incluir
  supercards" nos dashboards de Criativos e Campanhas (sub-parágrafo em
  cada entrada). Checado e sem gap: fixes de presença/data/CSS/
  automação "assigned"/"move" (bug fix restaurando promessa já feita,
  ou puramente visual — sem tela nova pra documentar).

- **v8.30.484-dev → v8.30.508-dev (2026-08-30, invocação genérica
  "/atualizarhelpcontent")**: maior backlog desde a criação da skill —
  ~24 commits acumulados (multi-squad do Agente Ágil já coberto em
  rodada anterior à v8.30.484; desde então: ferramenta `criar_card`,
  ferramenta `risco`, Histórico do Agente, intake de especialista
  externo com escrita real, mutações do orquestrador disparando
  Automações, trigger novo `agendado_created`). 6 correções — ver
  entrada do `CHANGELOG.md` (v8.30.508-dev) pro texto completo de cada
  uma. **Achado mais sério: uma claim FALSA** em "Ações que o agente
  pode executar" ("o agente não cria... cards") — ficou desatualizada
  desde 2026-08-27 quando `criar_card` foi adicionado; diferente de um
  gap de "faltou documentar", isso ativamente MENTIA sobre o
  comportamento atual pra quem lesse a Central de Ajuda. Lição: ao
  revisar uma entrada antiga, não vale só perguntar "falta algo aqui?"
  — vale reler cada frase categórica ("não faz X", "sempre Y", "só Z")
  contra o código de verdade, porque são essas frases que envelhecem
  mal quando a funcionalidade ganha uma capacidade nova bem no meio do
  que antes era uma limitação documentada. Achado 2: o texto inline da
  própria aba "🤖 Histórico do Agente Ágil" (a OUTRA fonte, ver
  cabeçalho desta skill) tinha o MESMO tipo de gap que o
  `HELP_CONTENT` — as duas fontes desatualizaram juntas porque nenhuma
  cobre uma origem (`especialista`) que existe há mais de 3 dias no
  backend.

Atualize esta seção a cada rodada nova, com a versão e o que foi
encontrado/corrigido — isso evita re-analisar do zero algo que já foi
checado e está em dia.
