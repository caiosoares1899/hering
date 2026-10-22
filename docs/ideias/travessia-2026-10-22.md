# Travessia — primeiro desenho (22/10/2026)

**Status:** pensamento inicial pedido pelo Caio. Decisões de 22/10 na seção 9.1. Protótipo clicável (Fase 0, dados fictícios, sem banco) em `travessia-dev.html`.

**O pedido, em uma frase:** um app onde cada PO/líder tem um quadro do seu time e cada pessoa tem o seu próprio, dentro do ciclo de performance, com **PDI** feito junto com o Agente Ágil, **1:1 planejados com recorrência** (semanal, quinzenal, mensal, trimestral), **planos de ação** e **acompanhamento de demandas** por pessoa, **alimentado por dados do Maré e do Radar** — e que seja mais que um sistema de RH: **inteligente, visual e participativo**.

---

## 1. O que a concorrência faz (e onde dá para ser melhor)

Pesquisa feita em 22/10/2026 por busca na web. **Ressalva:** quase tudo vem de material de marketing e de avaliações de usuários; não testei nenhum produto por dentro, nem vi preços atuais.

| Produto | O que entrega (segundo as fontes) | Onde pesa |
|---|---|---|
| **Feedz** (hoje da Totvs) | All-in-one: avaliação de desempenho, feedback, **1:1 com pauta, perguntas e tarefas e histórico**, **PDI com plano trimestral de tarefas e indicação de cursos/livros**, OKR, pesquisa de clima por pulsos, eNPS, termômetro emocional, reconhecimento e gamificação, relatórios. Fontes: [blog Feedz](https://www.feedz.com.br/blog/?p=73595), [Baguete](https://www.baguete.com.br/noticias/22/01/2024/rodonaves-monitora-clima-com-feedz), [avaliações B2B Stack](https://www.b2bstack.com.br/product/feedz/avaliacoes?page=9) | Usuários citam interface pesada, configuração pouco intuitiva e falta de integração com Office 365. Tudo é digitado à mão: não sabe o que a pessoa de fato entregou. |
| **15Five** | 1:1 com pauta, OKR ponderado e um assistente de IA ("AMAYA") para revisões; IA vendida como adicional. [Comparativo 2026](https://www.performyard.com/articles/lattice-vs-15five-vs-culture-amp) | IA é um complemento, não parte do fluxo; dados de trabalho vêm de integração. |
| **Lattice** | 1:1 com tarefas, engajamento, carreira, remuneração. [Outsail](https://www.outsail.co/post/lattice-vs-15five-vs-culture-amp-performance) | Plataforma de RH geral; foco em processo. |
| **Culture Amp** | Pesquisas e benchmark; IA para achar temas em comentários abertos. | Módulo de performance menos maduro que o de pesquisa. |

**Leitura:** os módulos "de prateleira" (1:1, PDI, feedback, clima) todos têm. O que **ninguém tem de graça** é o que nós temos dentro de casa:

1. **Contexto automático do trabalho real** — o Maré sabe o que a pessoa entregou, o Radar sabe de quais objetivos ela é responsável, o Maré tem Kudos e a Escala sabe quando ela está de folga. Os concorrentes dependem de a pessoa digitar ou de integração paga.
2. **Um agente que já conhece o time** (Agente Ágil), com ferramentas, permissões por squad e controle de custo.
3. **Login único Google @ciahering e a mesma identidade visual** do resto do Oceano — sem mais um cadastro, sem interface "pesada".

O risco inverso: virar "o Feedz do Maré" com 30 funções mal acabadas. Preferimos **poucas coisas bem feitas e conectadas** (mesma lição do dossiê de concorrência).

---

## 2. Princípios (o que faz ser "mais que um sistema de RH")

1. **Pessoa no centro, não líder.** Cada um vê e edita o seu próprio plano. O líder vê o mesmo que a pessoa (simetria nos dados), e anotações privadas do líder são um espaço separado e explícito.
2. **Dado de trabalho abre conversa, não dá nota.** Entregas do Maré e do Radar aparecem como "contexto da conversa" ("você fechou 14 cards e destravou 3 bloqueios"), **nunca** como placar, ranking ou nota automática. Cards têm tamanhos diferentes; ranking por quantidade gera incentivo errado.
3. **Agente propõe, pessoa decide.** Tudo que o agente escreve entra como **rascunho "sugerido pelo Agente"**, que a pessoa/líder aceita, edita ou descarta. Nunca grava avaliação nem define nota.
4. **Visual antes de formulário.** Rota, marcos, anéis de progresso e linha do tempo; tabela é o plano B.
5. **Participativo por padrão.** Pauta construída pelos dois lados, autoavaliação antes da conversa, feedback pedido por quem quer crescer, pulso de humor opcional.
6. **Dado sensível, trecho separado.** Regras próprias no banco, desenhadas **antes** do código (já anotado em `docs/OCEANO.md`).

---

## 3. A experiência: duas portas de entrada

### 3.1 "Minha travessia" (cada pessoa)
- **Rota:** uma linha do tempo estilo mapa marítimo com os **marcos** (portos): objetivos de desenvolvimento do PDI, 1:1 realizados, conquistas, metas do Radar das quais participa. O "barco" mostra onde a pessoa está.
- **Meu PDI:** 2 a 4 focos por ciclo, cada um com ações (curso, mentoria, projeto real, leitura), prazo, evidência e progresso.
- **Meus 1:1:** próximo encontro, pauta compartilhada (os dois adicionam), notas, decisões que viram ações.
- **Minhas ações e demandas:** o que eu combinei, o que pedi de apoio, o que está atrasado.
- **Minha história:** entregas do Maré, Kudos recebidos, objetivos do Radar — gerado automaticamente, para eu usar na autoavaliação.

### 3.2 "Frota" (PO/líder: o quadro do time)
- Um cartão por pessoa com **sinais**: último e próximo 1:1, 1:1 atrasado, PDI parado (reaproveita a ideia do 🧊 do Radar), ações vencendo, humor opcional.
- **Linha de aderência** dos 1:1 (faixa de semanas, como o gráfico de contribuições do GitHub): vê de relance quem está sem conversa há muito tempo.
- **Resumo semanal** do time (determinístico, com 1 parágrafo do agente se o líder pedir).
- Clicar na pessoa abre a mesma visão que ela vê, mais o espaço privado do líder.

---

## 4. 1:1 com recorrência planejada

**Séries.** Uma série define: par (líder + pessoa), **cadência** (semanal, quinzenal, mensal, trimestral), dia/hora preferidos, duração e **tipo**:

| Tipo | Cadência típica | Foco |
|---|---|---|
| Acompanhamento | semanal ou quinzenal | bloqueios, prioridades, ações |
| Check-in de PDI | mensal | progresso do plano de desenvolvimento |
| Carreira e ciclo | trimestral | aspirações, feedback amplo, ajuste do PDI |

**Planejar.** O sistema gera as próximas ocorrências (ex.: 8 semanas à frente), respeitando **Escala** (não marca em dia de folga/plantão) e feriados. Dá para pular, remarcar uma ocorrência ou encerrar a série. Cada ocorrência vira um **encontro** com status: planejado, realizado, remarcado, pulado, atrasado.

**Pauta colaborativa.** Antes do encontro, os dois adicionam tópicos. O sistema **sugere** tópicos automaticamente: ações pendentes do último 1:1, entregas desde o último encontro, objetivos do Radar com atenção, Kudos recebidos, PDI sem atualização. O Agente pode montar um **briefing de preparação** (uma tela) sob demanda.

**Depois.** Notas compartilhadas + decisões. O Agente transforma as decisões em **ações com dono e prazo** (rascunho para confirmar).

**Lembretes.** Mesmo padrão dos lembretes de metas: função agendada que avisa por sino e push (1 dia antes, 1 h antes, e "seu 1:1 de ontem não foi registrado"). Entra no catálogo da Central de Notificações como tipo novo.

**Calendário.** Fase 1: calendário interno + aviso. Depois: criar o evento no Google Agenda (o Maré já tem a camada de calendários do Google) — é evolução, não pré-requisito.

---

## 5. PDI com o Agente Ágil

**O que é um PDI aqui:** um plano curto (trimestral, revisável) com **focos de desenvolvimento**, cada um ligado a uma **competência**, com ações no modelo 70-20-10 (70 % prática no trabalho, 20 % com pessoas/mentoria, 10 % cursos/leitura).

**Co-piloto de PDI** (o agente conversa, a pessoa decide):
1. Pergunta aspirações e dificuldades (a pessoa responde em texto livre).
2. Cruza com **o que o sistema já sabe**: feedback recebido, objetivos do Radar, tipos de entrega no Maré, histórico de 1:1, competências esperadas do papel.
3. Propõe **2 ou 3 focos** e, para cada um, ações concretas e mensuráveis (SMART), com sugestão de **projeto real do próprio trabalho** (ex.: "liderar a próxima campanha da squad X") e de gente para conversar.
4. A pessoa edita, aceita ou descarta; o líder comenta; o plano entra como **rascunho → ativo**.
5. Ao longo do ciclo, o agente **cutuca** com regras determinísticas (sem gastar tokens): PDI parado há 21 dias, ação vencendo, 1:1 de check-in chegando.

**Outras ajudas do agente:** briefing de 1:1, notas → ações, rascunho de autoavaliação a partir da "Minha história", resumo semanal do time para o líder, perguntas em chat ("como está o PDI da Ana?") **respondidas só se quem pergunta tem permissão**.

**Guard-rails do agente (importante):**
- Atua **em nome de quem pergunta**: o servidor confere o vínculo antes de ler qualquer dado (as Cloud Functions usam admin e **ignoram as regras do banco**, então a checagem tem que estar no código da função e ter teste).
- **Nunca** vê as anotações privadas de outra pessoa; nunca dá nota, ranking, "risco de saída" ou análise de sentimento individual.
- Mostra **de onde veio** cada sugestão ("com base no objetivo X do Radar e nos 3 últimos 1:1").
- Economia de tokens: o contexto é **agregado por código** (contagens, listas curtas) e só então vai ao modelo, sob demanda; lembretes e sinais não usam modelo.

---

## 6. Dados do Maré e do Radar que alimentam (já existem)

| Fonte | Sinal | Observação |
|---|---|---|
| Maré: cards | concluídos no período (`flow.doneAt`), em andamento, bloqueados que a pessoa destravou, atrasados | Só squads em que a pessoa participa. Sempre como contexto, nunca placar. |
| Maré: comentários/menções | participação e ajuda a colegas | Só contagem agregada. |
| Maré: **Kudos** | reconhecimentos recebidos e dados | Já existe; vira "conquistas". |
| Maré: **Escala** | folga/plantão | Evita marcar 1:1 em dia ruim. |
| Radar: objetivos e marcos | onde a pessoa é responsável, andamento, 🧊 parado, anotações de reunião em que foi mencionada | Liga o PDI ao trabalho real. |
| Metas ("O mar tá pra peixe") | participação em desafios | Opcional. |

**Como alimentar:** uma **função agendada** monta um **retrato por pessoa e período** (`contexto`), em vez de o navegador ler cards de todos os squads. Isso evita custo de leitura e garante que a regra de visibilidade é aplicada em um só lugar.

---

## 7. Modelo de dados e segurança (esboço para discutir)

**Nó de topo `travessia/`** (fora de `kanban/`), com regras próprias. Consequência: entra em `NOS_GLOBAIS` do backup completo (senão não tem backup) e ganha testes de regras.

```
travessia/
  vinculos/{uid}                 líder direto, squad, desde        (escrita: ADM/RH)
  pessoas/{uid}/
    perfil                       aspirações, interesses            (a pessoa escreve)
    pdi/{pdiId}                  focos, status, ciclo
    acoes/{acaoId}               ação/demanda: dono, prazo, origem (1:1, PDI, pedido), vínculo opcional a card do Maré
    series/{serieId}             cadência, tipo, líder, dia/hora
    encontros/{id}               data, status, pauta[], notas compartilhadas, decisões
    contexto/{periodo}           retrato do Maré/Radar (escrito só por função)
  privado_lider/{liderUid}/{uid} notas privadas do líder           (só o líder lê/escreve)
  ciclos/{cicloId}               fases, prazos, participantes
  pulsos/{periodo}               respostas agregadas (anonimato mínimo)
```

**Quem lê o quê (proposta):**
- A pessoa: tudo o que é dela, **menos** o espaço privado do líder.
- O líder direto: o que é da pessoa + o seu espaço privado.
- **ADM comum não lê por padrão.** Um papel estreito de "pessoas/RH" (`travessia_rh`) lê o que for combinado, com registro de acesso. (Hoje ADM tem leitura ampla no resto do banco — aqui é o contrário de propósito.)
- Visualizadores externos e contas fora de `@ciahering` Google: **sem acesso nenhum** (a regra repete a checagem de domínio e provedor do resto das regras).
- Anônimos (pulsos): só exibir agregado quando houver pelo menos N respondentes (proposta: 5), para ninguém ser identificado num time pequeno.

**Cuidados:** LGPD (dado sensível de desempenho — alinhar com TI/jurídico, aproveitando a reunião de 30/10), retenção e exclusão ao sair da empresa, trilha de auditoria de quem abriu o quê.

---

## 8. Visual e identidade

- Nome e metáfora: **Travessia** = a jornada. Cada pessoa é uma **embarcação**; o PDI é a **rota**; os marcos são **portos**; os 1:1 são **pontos de encontro em mar aberto**; "vento" é o humor opcional. Reaproveita o vocabulário marinho do Oceano e os peixes das Metas como conquistas.
- Marine Glass, mesmo padrão das outras páginas (`MARINE_GLASS.md`), três temas desde o primeiro dia (aprendemos com o tema claro do Radar e das Metas).
- Visualizações candidatas: rota com marcos, anel de progresso do PDI, faixa de aderência dos 1:1, mapa de competências (autoavaliação × visão do líder, só em ciclos formais). Seguir a skill `dataviz` na hora de desenhar.
- Mobile primeiro: a maior parte dos 1:1 e check-ins acontece no celular.

---

## 9. Decisões que preciso do Caio (e do RH/TI)

1. **Já existe processo/ferramenta oficial de avaliação na Hering?** Se sim, o Travessia **complementa** (dia a dia, PDI, 1:1) e gera um "dossiê do ciclo" para alimentar o processo oficial. Se não, podemos pensar em ciclo formal na Fase 4. *Recomendo começar complementando.*
2. **Quem é o "líder" de uma pessoa?** PO da squad, gerente, ou um vínculo explícito por pessoa? *Recomendo vínculo explícito (`vinculos/{uid}`), pré-preenchido com o PO da squad.*
3. **ADM lê tudo ou não?** *Recomendo que não por padrão* (papel `travessia_rh` à parte).
4. **Notas privadas do líder:** permitir ou não? *Recomendo permitir, separadas e visíveis como "privadas" na tela.*
5. **Nota/score no ciclo?** *Recomendo nenhuma nota na v1* — só texto, competências e PDI.
6. **Piloto:** qual squad e quantas pessoas? *Sugiro 1 squad pequena, com PO engajado, 4 a 8 pessoas.*
7. **Pulso de humor/clima:** entra no MVP ou fica para depois? *Recomendo depois* (sensível e exige anonimato bem feito).
8. **LGPD/TI/RH:** levar o tema à reunião de 30/10 para validação de dado sensível antes de gravar qualquer dado real.

---

## 9.1 Decisões do Caio (22/10/2026)

| # | Decisão | O que muda no desenho |
|---|---|---|
| 1 | **Processo de avaliação: "mais ou menos".** O RH provavelmente vai refazê-lo (estava parado; antes usavam o Feedz). | O Travessia pode ser o **veículo** do novo ciclo, não só um complemento. Ciclo, fases e competências ficam **configuráveis** (o RH define), e a decisão sobre nota/score segue aberta para quando o RH entrar na conversa. |
| 2 | **Líder = PO da squad, mas há níveis acima** (ex.: gerente que lidera POs). | O vínculo vira uma **cadeia**: pessoa → PO → gerente (… → diretoria). Cada nível vê o que é seu e o **agregado** de baixo; o gerente também tem 1:1 e PDI com os POs. Detalhe por pessoa de dois níveis abaixo só se o PO compartilhar (a confirmar). |
| 3 | **Cargo RH com acesso próprio.** | Papel `travessia_rh` (criado e dado pelo ADM). Vê adesão, PDIs, ciclo e o que os POs **compartilharem**; **não** vê notas privadas nem o conteúdo dos 1:1 (a confirmar com o RH). ADM comum continua sem leitura por padrão. |
| 4 | **Notas exclusivas do PO, mais um espaço de anotações para o RH** (o PO leva aos encontros com o RH). | Dois espaços privados do PO: **notas por pessoa** e **pauta com o RH**. Na pauta, cada item nasce privado e o PO pode marcá-lo como "compartilhado com o RH". |
| 6 | **Piloto: squad Dados.** | Fases 1 e 2 já pensadas para a squad Dados. |

Ainda abertas: pulso de humor/clima (fica para depois), nota/score no ciclo (depende do RH), LGPD com TI/jurídico (reunião de 30/10).

---

## 10. Fases propostas (cada uma entrega valor sozinha)

| Fase | Entrega | Perfil técnico |
|---|---|---|
| **0 — Validar** (agora até 04/11) | Decisões da seção 9 + **protótipo clicável com dados falsos** (só HTML, sem banco) para 2 ou 3 POs reagirem | Só `travessia-dev.html`; nenhum dado real |
| **1 — Meu Travessia + 1:1** | Vínculos, séries com recorrência, encontros, pauta colaborativa, notas, ações, lembretes (sino/push) | Nó `travessia/` + regras + testes de regras; função agendada de lembretes |
| **2 — PDI + Agente** | PDI estruturado, co-piloto de PDI, briefing de 1:1, notas → ações, contexto do Maré e do Radar | Função `contexto` agendada; função do agente com checagem de vínculo |
| **3 — Frota** | Quadro do time, sinais (1:1 atrasado, PDI parado), aderência, resumo semanal | Leitura agregada + regras do líder |
| **4 — Ciclo e participação** | Autoavaliação, feedback de pares, pulsos anônimos, dossiê do ciclo | Depende das decisões 1, 5 e 7 |

Cada fase segue o processo de sempre: dev primeiro, promoção só após validação do Caio, dica/Ajuda/CHANGELOG, e deploy de `functions/` e `database.rules.json` na máquina dele.

**Estimativa de esforço:** Fase 1 é parecida com a Escala + lembretes de Metas (conhecido). Fase 2 é a mais arriscada (agente + privacidade). O ponto de maior risco **não é técnico**: é confiança — se o time achar que o Travessia é vigilância, não usa. Por isso as regras de simetria e transparência (princípios 1 e 2).

---

## 11. Próximo passo sugerido
Fechar as decisões 1 a 4 e 6 (conversa rápida), e eu monto o **protótipo clicável da Fase 0** (Minha travessia + Frota + um 1:1), em `travessia-dev.html`, com dados falsos e Marine Glass nos 3 temas, para validar a metáfora e o fluxo antes de tocar em banco ou regras.
