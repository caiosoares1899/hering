# 🧭 Guardião da rotina de gestão — proposta (17/10/2026)

> Pedido do Rafael ao Caio: ser o "dono" dos rituais e entregas de gestão do Digital (hoje sem dono). Fonte: `Rascunho Calendário.pdf` (macro PLAN / DO / CHECK / ENGAJAMENTO, com periodicidade). Rituais das squads ficam **fora** (já rodam 100%).
> Status: **só desenho** — nada implementado. Decisões em aberto no fim.

## 1. O que o rascunho pede (e o que ele não diz)
| Macro | Itens | Cadência |
|---|---|---|
| PLAN | Estratégia de crescimento · Planejamento estratégico anual (números + iniciativas) · Plano financeiro (orçamento de vendas e de despesas) | anual, pico no 3º tri |
| PLAN | Plano tático do trimestre (7 sub-planos: comercial, calendário, mídia, CX, operacional/logístico, estoque, faturamento) · Plano de compras (Out/Inv/Ver/AV) | todo trimestre |
| CHECK | All Hands (plano tático + iniciativas) · Reunião de resultados do e-commerce · Iniciativas do Digital | trimestral · semanal · quinzenal/semanal |
| DO | Showroom de compra · Data de lançamento das coleções (+ rituais de squads/gestores — fora de escopo) | por temporada |
| ENGAJAMENTO | Big Review · Encontro dos Fritos · Weeklyzona · Pulso dos times (Travessia) | a definir |

**Falta no rascunho** (e é o que o sistema precisa): a **data âncora** de cada item (qual dia da semana, qual mês), o **dono** e a **antecedência de preparo** (o Plano tático tem que estar pronto N dias antes do All Hands). Sem isso, só dá para avisar "chegou o dia", não para proteger a qualidade.

## 2. O que o Radar já tem (reaproveitar, não reinventar)
- **Calendário** (`kanban/okr/calendario/eventos`): reunião/evento/lembrete/prazo, **repetição** (dia/semana/mês/ano + intervalo + "até"), **agenda global** (`torre:''`), **convidados**, lembretes de véspera e do dia (`okrDailyScan` 07h → notificação `okr_reuniao` → sino + push), filtros por tag/gerência, legenda clicável.
- **Agente Ágil do Radar** (`okrAgenteChat`) com `listar_agenda` (só leitura) e ferramentas de escrita para Objetivo/Marco.
- Sino único, Central de Notificações (interruptor por tipo), Não Perturbe, Dicas, backup do nó `kanban/okr`.
- **Passo 0 já é possível hoje, sem código:** criar ~20 eventos recorrentes na agenda global, com o dono como *convidado* (ele recebe véspera + dia). Serve para o Rafael ver o calendário já; o Guardião é a camada em cima.

**O que não existe hoje:** dono explícito, "aconteceu?" por ocorrência, aviso de atraso/escalonamento, preparo com antecedência, evidência (link da ata/apresentação), visão de saúde da rotina.

## 3. Proposta
### 3.1 Dado — poucos campos novos, no mesmo calendário
Evento ganha tipo **🧭 Gestão** + campos opcionais: `macro` (`plan|do|check|engajamento`), `donoUid` (+ `suplenteUid`), `modelo` (checklist de preparo e campos de evidência), `antecedencia` (dias de aviso de preparo, ex.: `[30,14,7]`), `entregavel` (texto curto: "Plano tático 1T27").
Cumprimento por ocorrência em nó novo `kanban/okr/calendario/cumprimento/{eventoId}/{AAAA-MM-DD}` = `{estado: feito|adiado|pulado, por, ts, nota, link}`.
→ 1 nó novo = regra em `database.rules.json` + teste em `functions/rules/__tests__/okrRules.test.js` (já sob `kanban/okr`, então já entra no backup completo).

### 3.2 Guardião = função agendada determinística + o Agente Ágil do Radar como "voz"
**90% não precisa de IA** (datas, recorrência, atraso). Então:
- **`guardiaoDiario`** (07:30 Brasília, junto do `okrDailyScan`): para cada ritual de Gestão calcula a escada abaixo e grava notificações (`guardiao_*`, entram em `PUSH_TYPES` e `MareNotif.TIPOS`).
  - **D-antecedência** → dono: "Plano tático 1T27 — faltam 14 dias, checklist 3/7".
  - **Véspera / dia** → dono + convidados (já existe, só ganha texto de gestão).
  - **D+1 sem "feito"** → dono ("aconteceu?"); **D+3** → suplente + guardião (Caio/Rafael).
  - **Sem dono** → aviso ao guardião (1×/semana, nunca repete todo dia).
- **`guardiaoSemanal`** (segunda 08h): resumo curto "próximos 14 dias · atrasados · sem dono". Aqui sim 1 chamada de LLM barata (modelo pequeno) só para redigir o texto; sem chamada se não houver nada a dizer. Vai ao sino/push do guardião e do Rafael, e ao Mural opcionalmente.
- **Agente Ágil do Radar** ganha ferramentas (mesmo padrão das atuais, com a trava 🔒 e permissão por papel): `listar_rotina_gestao`, `registrar_cumprimento`, `adiar_ritual`, `criar_ritual`. Assim o Caio conversa: "adia o All Hands pra dia 12", "o que está atrasado na gestão?". **Nome sugerido: Guardião** (a tela: "🧭 Rotina de gestão"); trocamos se preferirem algo mais "mar" (ex.: Farol).
- Custo de tokens ≈ desprezível (1 resumo/semana + conversas pontuais) — cabe na seção de consumo do `ecossistema.html`.

### 3.3 Tela (Radar, 100% reaproveitando o calendário)
1. Calendário com o tipo **🧭 Gestão** (cor por macro, tokens *text-safe* — armadilha nº 12) e filtro "só gestão".
2. Nova visão **🧭 Rotina de gestão**: lista por macro × próximo/atrasado/feito, dono e semáforo; "marcar como feito" (+ link da ata/apresentação); linha "sem dono" destacada.
3. **Saúde da rotina** (mini-painel): % cumprido no prazo (ritmo) e % com evidência (qualidade) por trimestre — é o número que o Rafael pode olhar.
4. Fase 3: cruzar com o Radar — "o trimestre começa em 15 dias e não há Objetivos ativos para ele".

### 3.4 Segurança de dados (regra do Caio: não mexer em dado real)
Dev e prod compartilham o mesmo banco. Desenvolver e testar **só com o Firebase falso** (Playwright + `fakefb.js`), sem escrever nada real; o catálogo inicial entra pela **tela** (ou um script de console que o Caio roda), depois da validação em dev. Escrita de `donoUid`/gestão limitada a ADM/PO/Gestor OKR; leitura para todos.

## 4. Fases
| Fase | Entrega | Mexe em |
|---|---|---|
| 0 (hoje, sem código) | ~20 eventos recorrentes na agenda global, dono como convidado | só dados, pela tela do Radar |
| 1 | Tipo 🧭 Gestão + dono + "feito/adiado" + visão Rotina de gestão | `okr-dev`, regras do banco |
| 2 | `guardiaoDiario` (escada de avisos) + tipos de notificação + resumo semanal | `functions/guardiao/`, `PUSH_TYPES`, `MareNotif.TIPOS` — **deploy do Caio** |
| 3 | Ferramentas no Agente Ágil do Radar + saúde da rotina + cruzamento com Objetivos | `functions/okr/agente*`, conhecimento do agente |

Pedaços 1 e 3 são `-dev` (Pages); o 2 exige deploy de functions + `firebase deploy --only database`. Dica (regra 7): sim, quando a visão existir ("marque como feito ao fim do ritual").

## 5. Timing
Caio de férias até 03/11 → dá para construir as fases 1–2 em `-dev` com testes e deixar pronto para ele validar na volta. **Primeiros usos reais (dez/26–jan/27):** Plano de Compras, Plano tático do 1T27 e o All Hands trimestral de janeiro. O pico "3 tri" (planejamento anual) só volta em jul/27.

## 6. Decisões em aberto (precisam do Caio / Rafael)
1. **Dono de cada item** (e suplente) — e quem é o "guardião final" que recebe a escalada (Caio? Rafael também?).
2. **Datas âncora e antecedência** de cada ritual (tabela a preencher; posso devolver o rascunho já em formato de planilha/seed).
3. **"Pico 3 TRI"**: é o mês/trimestre de *execução* do planejamento anual (jul–set)? E quais meses fecham Out/Inv/Ver/AV no Plano de Compras?
4. **Engajamento** (Big Review, Frito, Weeklyzona, Pulso): são rituais com data/lugar fixos ou só cadência? O Pulso/Travessia só entra como lembrete até o produto existir.
5. **Quem vê**: calendário de gestão aberto a todos @ciahering ou só gestores?
6. O rascunho tem PLAN/DO/CHECK/ENGAJAMENTO — falta o **ACT** (ajustar o que o CHECK mostrou)? Proponho incluir "Decisões e ajustes" como saída registrada do CHECK.
7. Nome: **Guardião** ok?
