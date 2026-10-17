# Dossiê de concorrência do Antigravity — triagem do Claude (16/10/2026)

**Status:** guardado para **depois das férias do Caio (a partir de 04/11/2026)**. Nada disto roda antes — decisão do Caio. Quando voltarmos, o Caio escolhe a ordem.

O dossiê original (34 itens catalogados, apesar de o texto dizer 42) foi feito pelo Antigravity comparando Linear, ClickUp, Jira, Shortcut, Tability, Viva Goals, WorkBoard, Notion etc. com o que o repo já tem. **Não conferimos o que os concorrentes fazem de fato**; o que foi conferido foi o lado do nosso código (abaixo). Os códigos (K = Maré/kanban, I = Intake, E = Escala, O = Radar/OKR, S = apresentação ao vivo, M = metas, P = Oceano/Painel, A = IA/sino) são os do dossiê.

## Já existe — sai da lista
- **P1 "Meu Dia"** no Oceano: o Maré já tem o 🌅 Meu Dia (27 menções em `kanban-dev.html`). Estender o que existe (quem está de folga/plantão hoje), em vez de widget novo.
- **A3.6 push agrupado por card**: já existe (`tagDoPush` em `functions/`, com testes).
- **Leitura de `kanban/escala` por intervalo, com cache**: já existe no Calendário do Maré — a ponte K3 reaproveita.

## Leva sugerida (ordem de valor × risco)
1. **Radar (1 página, só cliente):** O1 (🧊 objetivo sem check-in há 14 dias) · S1 + S2 (nota da reunião virar Próximo Passo; filtro "só Atenção/Risco" na apresentação).
2. **Escala vira cidadã:** K3 (alerta de card vencendo no dia de folga do dono) · E1 (copiar semana anterior + aviso) · P1 estendendo o Meu Dia.
3. **Painel:** P4 (Digest Executivo semanal para WhatsApp/Mural — determinístico). Health Score (P3) só depois de combinar os pesos com o Caio.
4. **Maré:** K2 (dias parado na coluna, via `flow.enteredAt`) · K8 (divisor "novos comentários") · parte do K10 (bloqueio mudo > 3 dias).

## É do Claude (regras do banco / módulo compartilhado / tokens)
- **I4 Meus Pedidos** (o solicitante vê o andamento do pedido): regra para ler só o que é seu + vínculo pedido→card. Maior ganho de adoção.
- **A1 sino com agrupar/filtrar/adiar**: mexe em `mare-notif` e num nó novo de preferências.
- **A3.2 / A3.3** (triagem e busca de cards parecidos pelo Agente): gastam tokens — só depois, e pesando o discurso de economia.

## Com ressalvas
P3 Health Score (vira nota "oficial" sem pesos acordados) · K1 Peek com Espaço · K4 Daily guiado · I1/I2 anti-duplicata e chips de briefing no Intake (baratos, segunda leva).

## Deixar de lado por ora
K5 Scope Creep (depende da sprint bem configurada) · K6 capacidade (depende de story points) · K7 edição inline na face do card (risco de edição acidental no celular) · K9 · A2 · K12 · O5 mapa de estratégia · M1 meta↔OKR (grande, módulo compartilhado) · S3 pacing.

## Cuidados ao retomar
- Tudo no Maré acumula em `kanban-dev.html` (2,5 MB) → promoção em lote força recarga geral; promover features em lote no fim do dia (regra do `CLAUDE.md`).
- Cada feature visível: avaliar dica, Ajuda in-app e CHANGELOG; menos itens bem acabados > 12 de uma vez.
- Datas: Camiseta Brasil/Black Friday (27/11) está na mesma fila.
