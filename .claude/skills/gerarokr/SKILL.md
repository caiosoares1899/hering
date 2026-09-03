---
name: gerarokr
description: Gera o prompt humanizado (texto corrido, NUNCA JSON) pra mandar pro agente estratégico do Gemini — um gem que preenche automaticamente os slides de "Planejamento Estratégico" a partir de um prompt em linguagem natural — cobrindo os 2 objetivos ativos (Maré Digital e Agente Ágil), com base no que mudou nos últimos 15 dias segundo o CHANGELOG.md/CODE_MAP.md/log dos cards. Use sempre que o usuário pedir "atualiza o OKR", "gera o prompt do OKR", "atualiza os slides de planejamento estratégico", "prepara o resumo pro Gemini preencher os slides", "manda pro agente estratégico as novidades", ou invocar /gerarokr diretamente — mesmo que a frase não diga "OKR" explicitamente.
---

# Gerar OKR — Planejamento Estratégico (Maré Digital)

Nasceu de um pedido direto do usuário, mandando print dos 2 slides já
preenchidos ("Maré Digital" e "Agente Ágil") mais o molde em branco, e
pedindo pra ler as mudanças recentes e montar um script pra mandar pro
"agente estratégico" — um gem do Gemini que recebe um prompt e preenche o
slide sozinho. Primeira entrega foi em JSON; o usuário corrigiu na hora:
**"me manda como texto corrido e não como json! um prompt humanizado
msm"**. Essa correção é a regra mais importante desta skill — nunca
esquecer dela nas próximas rodadas.

## O que esta rotina NÃO é

- **Não escreve nem edita nenhum arquivo do repo.** É puramente geração de
  texto pra colar em outra ferramenta (o gem do Gemini) — sem
  `kanban-dev.html`, sem `CHANGELOG.md` novo, sem PR, sem "Release
  process" do `CLAUDE.md`.
- **Não é o log de card do `/subirproprod`.** Aquele é por promoção
  individual, em tom técnico (PRs, achados, checks de rotina), pro card do
  Firebase. Este é por período (15 dias), em tom de stakeholder/liderança,
  pro slide de planejamento estratégico — bem mais resumido e sem nenhum
  detalhe interno (nome de função, número de PR, versão do app).

## A estrutura do slide (o molde)

Cada slide representa 1 objetivo/pilar e tem estes campos (nomes exatos
usados no molde, formato `{{CAMPO}}`):

- `NOME_INICIATIVA` — título em negrito no topo-esquerda (ex.: "Maré
  Digital", "Agente Ágil").
- `PILAR` — rótulo "Pilar Estratégico". **Nos 2 slides já preenchidos isso
  ficou literalmente como "Nome do pilar"** — nunca foi customizado de
  verdade. Repita esse valor literal a menos que o usuário dê o nome real
  do pilar.
- `OBJETIVO` — 1 frase, igual nos 2 slides até agora: "Substituir Trello e
  processos manuais por um board único, com dados e notificações
  integradas". Só muda se o objetivo estratégico em si mudar (raro).
- `RESPONSAVEL` — "Caio Soares - Agilista" nos 2 slides atuais.
- `INDICADORES` — 1-2 linhas curtas, o número/fato que resume "estamos
  entregando de verdade" (ex.: "Squad usando o board como fonte única",
  "Toolset cresceu de 9 pra 15 ferramentas").
- **7 marcos/atividades macros**, cada um com 3 partes: descrição curta (1
  linha), prazo (`DD/MM`, ou "contínuo"/"a definir" pra item sem data
  fixa), e status — bolinha colorida: **verde** = concluído/entregue,
  **amarelo** = em andamento com atenção/risco, **cinza** = próximo
  passo/trabalho contínuo (não é "concluído" nem "risco", só ainda não
  fechou), **vermelho** = bloqueado/problema real (raro — nenhum dos 2
  slides atuais usou vermelho até agora). Sempre priorize os marcos mais
  relevantes pro NEGÓCIO (o que foi pra produção, o que um PO/liderança
  reconheceria), não uma lista exaustiva de commits — várias mudanças
  técnicas do mesmo arco de trabalho (ex.: 4 versões seguidas de "redesign
  mobile") viram 1 marco só.
- `PROGRESSOS` — 2-3 frases curtas, cada uma numa linha, **sem marcador de
  bullet** (só quebra de linha).
- `PROXIMOS_PASSOS` — 2-3 itens, **cada linha começa com "•"** (esse é o
  único campo com bullet visível nos slides já preenchidos).
- `RISCOS` — 2-3 itens **bem curtos**, quase palavras-chave/frases soltas
  (ex.: "Firebase!!!", "Github"), não frases longas explicando o risco.
- `PLANOS_ACAO` — 1-2 frases curtas, sem bullet, o que vai ser feito em
  resposta aos riscos/próximos passos.

Todo campo é **texto pequeno numa caixinha pequena do slide** — errar pro
lado de curto demais é sempre melhor que errar pro lado de detalhado
demais. Sempre releia os slides já preenchidos (prints que o usuário
mandou, ou a última rodada desta skill, ver "Histórico de rodadas" no
fim) antes de escrever, pra manter o mesmo tom/densidade — não é uma
decisão livre a cada rodada.

## Passo 1 — Definir o período e levantar as fontes

Período padrão: **últimos 15 dias a partir de hoje** (recalcula a cada
rodada — não é uma data fixa). Se o usuário pedir um período diferente
("desde a última rodada", "do mês inteiro"), usa esse.

Fontes, nesta ordem de prioridade:
1. **`CHANGELOG.md`, seção `## kanban.html (produção)`** — é a fonte
   principal: já é escrita em tom de resumo pro usuário final, cada
   entrada de promoção já teoricamente linka o que foi validado e
   entregue. Filtra pelas datas do período.
2. **`CHANGELOG.md`, seção `## kanban-dev.html (ambiente de teste)`** —
   usa pra achar detalhe/contexto por trás de uma entrada de prod que
   ficou vaga, ou pra pegar trabalho que já está pronto em dev mas ainda
   não foi promovido (vale como "em andamento", nunca como "concluído").
3. **Entradas específicas do Agente Ágil Orquestrador** dentro do
   `CHANGELOG.md` (procure por "orquestrador", "roadmap", "item N do
   roadmap", "canário" — mas cuidado, a maioria dos canários é de antes
   de 15/08, já refletida nos slides antigos; só usa se algo novo do tipo
   apareceu no período) — pra granularidade específica do Agente Ágil que
   o resumo de prod às vezes comprime demais.
4. **`CODE_MAP.md`** — normalmente não traz nada que o CHANGELOG já não
   tenha de forma mais legível; usa só se precisar confirmar se uma área
   é "nova" (seção recém-criada no mapa) ou só uma extensão de algo que
   já existia.
5. **Log dos cards do Firebase** (`card_comments` de
   `c1785199972010_nd0`/`c1783541085140`, ver `/subirproprod`) — não dá
   pra ler direto neste ambiente (sem credencial Firebase); só usa se o
   usuário colar o conteúdo dos comentários na conversa, ou como
   checagem cruzada eventual, não como fonte primária de rotina.

`git log --since="15 days ago" --oneline` ajuda a confirmar que nada
saiu do CHANGELOG por engano, mas o volume normal (300+ commits, a
maioria merge/PR) é grande demais pra ler 1 a 1 — não tenta.

## Passo 2 — Separar por objetivo e curar em até 7 marcos

Os 2 objetivos ativos hoje:
- **Maré Digital** — tudo que é geral do board/painel: UI, mobile,
  Automações, Firebase/custo/banda, bugs de dado, features de
  produtividade que não são especificamente sobre o agente de IA.
- **Agente Ágil** — tudo que é especificamente sobre o orquestrador
  (`functions/agente-agil-orquestrador/`), ferramentas do agente,
  Agentes Externos/Agentes de IA, Histórico do Agente, roadmap do agente.

Se surgir um 3º pilar/objetivo (novo slide no molde), pergunta ao usuário
antes de inventar nome/objetivo/responsável pra ele.

Dentro de cada objetivo, agrupe o período em **até 7 marcos macro**
(nem sempre precisa preencher os 7 — os slides atuais usaram 5; use
quantos fizerem sentido, mas não invente marco fraco só pra completar).
Prefira:
- Features/fixes que **chegaram em produção** no período (status verde,
  prazo = data da promoção).
- Um incidente real relevante, se houve um (ex.: card sumindo por coluna
  excluída) — vale como marco concluído (a correção) e como matéria-prima
  pra `RISCOS`/`PLANOS_ACAO`.
- 1 marco final de "próximo passo/trabalho contínuo" (status cinza, prazo
  "contínuo" ou "a definir") — mesma lógica do "Relatório em HTML
  automático" nos slides originais: mostra que a lista de marcos continua,
  não parou nesta rodada.

## Passo 3 — Escrever os campos curtos

- Tom: sempre o que um PO/liderança reconheceria como valor entregue —
  nunca nome de função, versão do app (`v8.30.xxx`), número de PR, nome
  de arquivo. "Corrigimos um bug que sumia com cards", não "fix em
  `_applyRestorePayload()`".
- `INDICADORES`: prefira um número/fato concreto e comparável ao que já
  estava no slide anterior (cresceu de X pra Y, continua em zero
  incidentes, etc.) — dá pra ver progresso de rodada pra rodada.
- `RISCOS`: mantenha o registro dos riscos que **já estavam lá** se ainda
  forem válidos (ex.: "Firebase!!!" tende a continuar por várias rodadas
  — é um risco estrutural, não pontual) e só adicione um novo se algo
  realmente relevante apareceu no período.

## Passo 4 — Montar e entregar o prompt humanizado

**Nunca em JSON.** Escreve um texto corrido em português, endereçado ao
gem ("Preciso que você atualize os 2 slides..."), um parágrafo por slide,
narrando os campos em ordem (pilar/objetivo/responsável/indicadores, os
marcos um a um com descrição+prazo+status, depois
progressos/próximos passos/riscos/planos de ação). Mesma regra de entrega
de `/subirproprod` pro texto de WhatsApp/log de card: **sempre como bloco
de texto visível na resposta do chat**, pronto pra copiar — nunca só
salvo num arquivo.

Antes de mandar a versão final, se o campo `PILAR` ficou como "Nome do
pilar" (não customizado) ou se algum marco ficou sem prazo claro, é
aceitável — não trava a entrega por isso, só sinaliza rapidamente ao
usuário que são placeholders/assunções, caso ele queira corrigir.

## Histórico de rodadas

- **2026-09-03 (1ª rodada, origem desta skill)**: período 19/08-03/09.
  Maré Digital: 7 marcos (correções em lote via /monitorarbugs, pin de
  card + submarca, redesenho mobile completo, Vice City + registro de
  tema, corte de bytes em comunicados/capas, incidente da coluna
  Impedimentos, manter rotina de monitoramento). Agente Ágil: 7 marcos
  (item 7 do roadmap — roteamento de modelo, Histórico do Agente,
  Automações cobrindo mutações do orquestrador, Agentes Externos +
  webhook real, Agente Ágil como Responsável/Participante, @todos +
  indicador "pensando" + Ponto de vista/Análise do board, relatório
  automático como próximo passo). 1ª entrega foi em JSON — usuário pediu
  pra refazer em texto corrido/prompt humanizado; essa é a forma correta
  daqui pra frente.
