# 🧭 Rotina de gestão pelo Agente Ágil — proposta (v2, 17/10/2026)

> Pedido do Rafael ao Caio: ser o "dono" dos rituais e entregas de gestão do Digital (hoje sem dono). Fonte: `Rascunho Calendário.pdf` (macro PLAN / DO / CHECK / ENGAJAMENTO, com periodicidade). Rituais das squads ficam **fora** (já rodam 100%).
> Status: **só desenho** — nada implementado. **v2:** o Caio esclareceu o papel — o Agente Ágil deve ser o *dono do processo* (garantir que cada parte foi executada, a reunião marcada, os envolvidos avisados, e olhar a qualidade, conectando Maré e Radar), não só lembrar. Sem agente novo: é mais uma **capacidade do Agente Ágil**. Decisões em aberto no fim.

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

## 3. Proposta (v2)

### 3.1 A ideia central: playbook por ritual + ciclo por ocorrência
Cada ritual vira um **playbook** (o Caio vai "destrinchar" um a um, então o motor tem que ser genérico e o conteúdo de cada ritual é dado, não código):
- **Objetivo** do ritual e **papéis** (dono, suplente, envolvidos/convidados);
- **Etapas com prazo relativo à data âncora** (ex.: T-30 rascunho dos 7 sub-planos · T-14 revisão · T-7 convite enviado · T-0 reunião · T+2 ata e decisões registradas);
- **Evidência** que prova cada etapa (reunião marcada = evento no calendário com os convidados; entrega = link/anexo; decisão = nota registrada);
- **Checagens automáticas** (fontes de dados dentro do ecossistema — ver 3.3) e **critérios de qualidade** (rubrica que o agente usa para avaliar, ex.: "todo Objetivo do trimestre tem responsável, prazo e atingimento configurado");
- **Comunicação**: quem precisa ser avisado, quando, com qual mensagem (rascunho do agente, aprovado pelo dono no começo).

Cada ocorrência gera um **ciclo** (estado por etapa: pendente · feito · atrasado · adiado · pulado, com quem/quando/evidência). Nós novos sob `kanban/okr/` (já cobertos pelo backup completo): `gestao/rituais/{id}` (playbook) e `gestao/ciclos/{ritualId}/{AAAA-MM-DD}` (instância). O calendário do Radar é a **vitrine**: o ritual aparece como evento do tipo 🧭 Gestão (cor por macro), com o semáforo do ciclo.

### 3.2 O agente: "ronda de gestão" (capacidade nova do Agente Ágil)
- Roda todo dia (07:30 Brasília) e quando alguém age (marca etapa, anexa evidência, @menção). Para cada ciclo ativo:
  1. **Checagem determinística primeiro** (data, existência do evento, convidados, checklist, link, vínculo com Objetivo) — grátis e sem alucinação;
  2. **LLM só quando há julgamento**: avaliar qualidade contra a rubrica, redigir a comunicação, decidir o tom/escalada, resumir a semana. Modelo barato na rotina, o forte só na revisão de qualidade (roteamento de modelo `escolheClienteParaTarefa` já existe); passa pelo **kill switch** e tem teto diário de chamadas.
  3. **Age conforme o nível de autonomia** (escada que o Agente Ágil já usa — modo sombra → escrita real, `perguntar_humano` quando não sabe):
     - **N0 sombra**: só mostra no painel o que faria. (começa aqui)
     - **N1 cobra**: lembra e cobra o dono pelo sino/push, escada D-n → véspera → dia → D+1 → D+3 (suplente + guardião final).
     - **N2 comunica**: redige o aviso para os envolvidos; o dono aprova com 1 clique; depois passa a enviar direto nos rituais já confiáveis.
     - **N3 age**: cria/ajusta o evento no calendário do Radar e os cards de preparo nos squads do Maré (`criar_card`), reagenda quando o dono pede.
- **Conversa**: as mesmas ferramentas entram no chat do Agente Ágil do Radar (`listar_rotina_gestao`, `registrar_etapa`, `adiar_ritual`, `criar_ritual`, `avaliar_qualidade`) — "o que está travado na gestão?", "adia o All Hands para dia 12", "o Plano de Mídia está bom?".
- **Transparência**: tudo que o agente faz entra no Histórico do Agente (`agenteLog.js`); o humano segue dono da *entrega*, o agente é dono do *processo*.

### 3.3 Conexão com o Maré e o Radar (onde a qualidade é verificável)
| Verificação | Fonte (já existe no ecossistema) |
|---|---|
| "A reunião foi marcada e os envolvidos convidados?" | evento no calendário do Radar (`convidados`) e agendas Google em cache (`gcal_cache`, leitura) |
| "As pessoas fizeram a sua parte?" | cards de preparo nos squads (status, checklist, atraso) via `ler_card`/`visao_board`; etapas marcadas no ciclo |
| "O plano do trimestre está pronto e coerente?" | Objetivos/Marcos do Radar (responsável, prazo, atingimento, atualização recente) |
| "O ritmo da iniciativa está saudável?" | Marcos sem atualização há N dias, atingimento fora do ritmo, Metas (`mare-metas`) |
| "Os envolvidos foram comunicados?" | notificações enviadas + resposta/"li" do destinatário |
| "A reunião de resultados aconteceu e decidiu algo?" | nota da reunião (Anotações do Radar) / decisões registradas |
**Limite honesto:** qualidade só é verificável onde o dado vive no ecossistema. Para entregas em **Google Docs/Sheets/Slides**, o agente consegue checar *se existe link e se foi atualizado*, mas **ler o conteúdo exige escopo do Drive** — decisão a levar para a TI (reunião de 30/10). Do mesmo modo, **criar convite no Google Agenda** exige permissão de escrita (hoje só há leitura via cache do ADM): v1 marca no calendário do Radar e *verifica* o Google; escrever lá é fase posterior, com a TI.

### 3.4 Telas (Radar)
1. Calendário com o tipo **🧭 Gestão** + filtro "só gestão".
2. Visão **🧭 Rotina de gestão**: ritual × próximo ciclo × etapa atual × semáforo × dono; "marcar etapa" com evidência; "sem dono" em destaque; o que o agente fez/sugeriu (histórico).
3. **Saúde da rotina**: % de etapas no prazo (ritmo), % com evidência e nota de qualidade média (qualidade), por trimestre — o número para o Rafael.
4. Editor de playbook (ADM/Gestor OKR): começa simples (etapas, papéis, rubrica em texto livre) e evolui.

### 3.5 Segurança de dado (regra do Caio: não mexer em dado real)
Dev e prod compartilham o banco. Construir e testar **só com Firebase falso** (Playwright + `fakefb.js` e testes de função com db falso); o catálogo real entra depois da validação, pela tela ou script de console que o Caio roda. Escrita de playbook só ADM/Gestor OKR; marcar etapa, o dono; leitura a todos @ciahering (decisão 6). Regras + teste em `functions/rules/__tests__/okrRules.test.js`.

## 4. Fases (pilotos primeiro — o Caio destrincha o resto depois)
Pilotos que cobrem os 3 tipos de ritual: **(1) Reunião de resultados do e-commerce** (semanal: marcada? aconteceu? decisões registradas?) · **(2) Plano tático do trimestre → All Hands** (entrega com 7 sub-planos por dono, preparo, checagem de qualidade contra os Objetivos do Radar — o mais rico) · **(3) Iniciativas do Digital** (quinzenal: quase 100% dado do Radar, mostra a verificação de qualidade).
| Fase | Entrega | Mexe em |
|---|---|---|
| 0 (hoje, sem código) | eventos recorrentes na agenda global, dono como convidado | só dados, pela tela |
| 1 | motor: playbook + ciclo + etapas/evidência + visão 🧭 + tipo no calendário (**N0 sombra**) | `okr-dev`, regras do banco |
| 2 | ronda do agente: checagens determinísticas + escada de cobrança (**N1**) + notificações `gestao_*` + resumo semanal | `functions/gestao/`, `PUSH_TYPES`, `MareNotif.TIPOS` — **deploy do Caio** |
| 3 | qualidade (rubrica + LLM) e comunicação com aprovação (**N2**) + ferramentas no chat | `functions/okr/agente*`, conhecimento do agente |
| 4 | ação (**N3**): evento/cards automáticos; saúde da rotina; depois Drive/Google Agenda com a TI | — |

## 5. Timing
Caio de férias até 03/11 → fases 1–2 podem ser construídas em `-dev` com testes e ficar prontas para ele validar na volta. Primeiros usos reais: Plano de Compras, Plano tático do 1T27 e All Hands de janeiro (o pico "3 tri" só volta em jul/27).

## 6. Decisões em aberto (precisam do Caio / Rafael)
1. **Pilotos**: os 3 acima servem? Qual deles primeiro?
2. **Dono e suplente** de cada ritual; quem é o **guardião final** da escalada (Caio? Rafael também?).
3. **Data âncora e antecedência** de cada ritual (o rascunho só tem periodicidade) — posso devolver a lista como planilha para preencher.
4. **Autonomia**: começar em N0→N1 e subir ritual a ritual conforme a confiança? Alguma comunicação que o agente nunca deve mandar sozinho?
5. **Drive e Google Agenda (escrita)**: levar à TI em 30/10? Sem isso a qualidade só cobre o que está no Maré/Radar.
6. **Quem vê** o calendário e a saúde da rotina: todos os @ciahering ou só gestores?
7. **"Pico 3 TRI"** e os meses de Out/Inv/Ver/AV no Plano de Compras; **engajamento** (Big Review, Frito, Weeklyzona, Pulso): data fixa ou só cadência?
8. O rascunho tem PLAN/DO/CHECK/ENGAJAMENTO — falta o **ACT** (ajustar o que o CHECK mostrou). Incluir "Decisões e ajustes" como saída registrada.
