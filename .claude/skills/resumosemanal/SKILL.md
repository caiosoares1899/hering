---
name: resumosemanal
description: Lê o CHANGELOG.md e monta um resumo em texto corrido (nunca lista crua de entradas) do que mudou na SEMANA PASSADA no Maré Digital e no Agente Ágil, agrupado por tema/história pra apresentar na reunião semanal da squad. Use sempre que o usuário pedir "resumo semanal", "o que fizemos essa semana/semana passada", "prepara pra reunião da squad", "recap da semana", "o que rolou na última semana", ou invocar /resumosemanal diretamente — mesmo que a frase não diga "changelog" explicitamente.
---

# Resumo Semanal — reunião da squad

Nasceu de um pedido direto do usuário depois de eu montar esse resumo uma
vez sob demanda ("pegando pelo changelog, oq q fizemos na ultima semana") —
ele confirmou que sempre vai precisar disso pra reunião semanal da squad,
então virou rotina em vez de refazer o raciocínio do zero toda vez.

## O que esta rotina NÃO é

- **Não é o `/gerarokr`.** Aquela é pro slide de Planejamento Estratégico,
  período de 15 dias, tom de PO/liderança, zero detalhe técnico (sem nome
  de função/versão/PR), só os 2 objetivos ativos (Maré Digital/Agente
  Ágil), formato rígido de campos pro molde do slide, entregue como prompt
  pra colar num Gemini gem. Esta aqui é semanal, tom de squad técnica (a
  audiência já conhece o código — pode citar área/causa raiz quando ajudar
  a contar a história), sem molde fixo de campos, e o destino é a própria
  conversa (fala direto na reunião ou cola no chat do squad), não uma
  ferramenta externa.
- **Não escreve nem edita nenhum arquivo do repo.** Puramente leitura do
  `CHANGELOG.md` + texto de resposta. Sem `kanban-dev.html`, sem PR, sem
  "Release process" do `CLAUDE.md`.
- **Não é uma lista crua de todo `### ` do período.** Uma semana normal
  tem 40-60+ entradas de changelog — despejar todas em ordem cronológica
  não ajuda ninguém numa reunião. O valor desta skill é AGRUPAR por
  tema/história e CURAR o que é relevante pra squad ouvir, igual um editor
  faria com um digest.

## Passo 1 — Definir o período

Padrão: **semana passada = semana civil anterior completa (segunda a
domingo)**, não "últimos 7 dias corridos" — recalcula a cada rodada
a partir da data de hoje, não fixa. Se o usuário pedir outro recorte
("essa semana", "as últimas 2 semanas", "desde a sexta"), usa esse em vez
do padrão.

```bash
# Descobre a segunda-feira desta semana, depois os 7 dias anteriores a ela
# (a "semana passada" civil) -- ajuste conforme o utilitário `date` disponível
python3 -c "
import datetime
hoje = datetime.date.today()
seg_atual = hoje - datetime.timedelta(days=hoje.weekday())
seg_passada = seg_atual - datetime.timedelta(days=7)
dom_passado = seg_atual - datetime.timedelta(days=1)
print('início:', seg_passada, '/ fim:', dom_passado)
"
```

## Passo 2 — Levantar TODAS as seções do CHANGELOG.md (não só kanban prod)

Diferente do `/gerarokr` (que prioriza só `## kanban.html (produção)`),
aqui vale escopo AMPLO — reunião de squad cobre tudo que rolou, não só o
que chegou em prod: `kanban.html`/`kanban-dev.html`, `painel.html`/
`painel-dev.html`, Cloud Functions (`functions/okr/`, Agente Ágil
Orquestrador, Spotify, etc.), `database.rules.json`. Filtra pela data:

```bash
grep -n "^##" CHANGELOG.md | grep -E "<regex-do-período, ex: 2026-09-(2[1-7])>"
```

Pra cada entrada que bateu, leia o corpo completo (não só o título) — é
onde mora o "porquê"/causa raiz que faz a diferença entre "consertamos um
bug" e uma história que vale contar na reunião.

`git log --since="<início>" --oneline` ajuda a confirmar que nada saiu do
CHANGELOG por engano, mas não tenta ler commit a commit — o changelog já é
a fonte curada.

## Passo 3 — Agrupar por tema/história, não por ordem cronológica de commit

Releia todas as entradas do período e agrupe em blocos temáticos — cada
bloco é 1 parágrafo/bullet-group com um título curto + emoji. Ordem de
prioridade dos blocos (mais importante primeiro):

1. **Incidentes/correções críticas** — qualquer saga de causa-raiz (ex.:
   "escrita que não persistia" da semana de 21-22/09, que levou 4 rodadas
   até a causa real) vira UM bloco só contando a história do início ao
   fim, não uma entrada por versão intermediária.
2. **Rodadas de `/monitorarbugs`** — agrupe por área tocada, cite os
   achados mais relevantes (não todos, se a rodada teve muitos achados
   pequenos, resuma "N achados menores em X").
3. **Iniciativas de UX/feature com várias idas e vindas** (ex.: a
   sequência de tentativas no menu de contexto do iPad) — vira 1 bloco
   contando a evolução, não uma entrada por tentativa.
4. **Features novas entregues** (por página/área).
5. **Infra/outros** (favicons, performance, `database.rules.json`,
   Cloud Functions sem relação direta com o board).

Regra de ouro: se 3+ entradas do changelog são iterações da MESMA
história (mesmo bug, mesma feature sendo refinada), elas são 1 bloco na
resposta, não 3+. Objetivo é "o que a squad precisa saber pra acompanhar
a conversa", não "prova de que cada commit existiu".

## Passo 4 — Tom e formato de entrega

- Português, bullets/blocos curtos com emoji de tema no título (mesmo
  estilo usado na entrega em chat, não em Markdown de arquivo).
- Audiência é a própria squad técnica — pode citar página (`kanban`,
  `painel`), causa raiz em termos gerais, e "por que demorou"/"por que foi
  em várias rodadas" quando isso for parte da história. Não precisa (nem
  deve) citar nome de função/linha/número de PR — isso é ruído pra reunião
  falada; se alguém quiser esse nível, o `CHANGELOG.md`/PR já tem.
- Sempre entrega como texto visível na resposta do chat, pronto pra ler
  na reunião ou colar em qualquer lugar — nunca só num arquivo salvo.
- Fecha perguntando se quer aprofundar algum ponto — não tenta adivinhar
  qual vai interessar mais à squad antes de perguntar.

## Histórico de rodadas

- **2026-09-28 (1ª rodada, origem desta skill)**: período 21-26/09 (sem
  entrada em 27/09, domingo). 8 blocos: saga da escrita que não
  persistia (crítico, 21-22/09), rodadas de `/monitorarbugs` no kanban
  (21-24/09), UX de iPad com idas e vindas no menu de contexto (23/09),
  Raias (24-25/09), prazos automáticos em Recorrência/Agendamentos
  (23/09), login/segurança do painel (21/09), OKR no painel (24-25/09),
  favicons + lotes de promoção pra prod. Usuário confirmou que vai
  precisar disso toda semana pra reunião da squad — motivo direto da
  criação desta skill.
