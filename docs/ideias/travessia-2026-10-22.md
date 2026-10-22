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

**Nó `kanban/travessia/`** (decidido na triagem do dossiê do Antigravity, seção 12; antes eu havia sugerido um nó de topo): fica junto dos outros nós do banco, **sem `.read` no pai** e com regras próprias em cada sub-árvore. Importante: **não pode morar dentro de `kanban/usuarios/{uid}`**, porque a leitura liberada ali para qualquer conta da empresa desce para todos os filhos e não dá para revogar mais abaixo. Entra em `NOS_GLOBAIS` do backup completo (senão não tem backup — e aí vale a decisão da seção 12.3) e ganha testes de regras.

```
kanban/travessia/
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


---

## 12. Triagem do dossiê do Antigravity (22/10/2026)

O Antigravity entregou um dossiê de benchmarking (Lattice, Leapsome, Culture Amp, 15Five, Fellow, Small Improvements, Qulture.Rocks, Elofy, Feedz etc.) com arquitetura de segurança e roadmap. Conferi o que dá para conferir no repositório. **Não verifiquei os produtos concorrentes** (é pesquisa dele, de fontes que não revisei), então trate as descrições de mercado como hipóteses.

### 12.1 Conferido no repositório
| Afirmação do dossiê | Resultado |
|---|---|
| `.read` aberto em `kanban/usuarios` desce para os filhos, então dado sensível não pode ficar ali | **Correto** (`database.rules.json`). Já vale para o nosso desenho. |
| `kanban` não tem `.read` na raiz, então uma árvore `kanban/travessia/` com regras próprias funciona | **Correto.** Adotado (seção 7). |
| "O Copiloto reaproveita o `llmClient.js` com `gemini-2.5-flash` e prompt caching" | **Errado.** O `llmClient.js` chama a **API da Anthropic** (`claude-sonnet-5-5`, com fallback). A ideia de reaproveitar o cliente do Agente Ágil vale; o modelo citado não. |
| "Posicionamento oficial: *1:1 · PDI · Carreira…*" em `OCEANO.md` e `oceano-dev.html` | **Não encontrei esse texto.** O que existe é "ciclo de performance e desenvolvimento de gente: avaliação, PDI e dia a dia", marcado como *futuro*. |
| "Nem ADMs técnicos leem as notas privadas" | **Só vale para o cliente.** As regras do banco bloqueiam, mas quem tem o console do Firebase e as Cloud Functions (admin) leem tudo. Precisa ficar dito com todas as letras para o RH e para a TI (seção 12.3). |

### 12.2 O que adotar (melhora o desenho)
| Ideia do dossiê | Como entra |
|---|---|
| **📦 Baú da Travessia** (guardar conquista com 1 clique em card do Maré, marco do Radar ou Kudo) | Substitui e reforça a "Minha história". Excelente contra o viés de recência. **Fase 1.** Exige botão no `kanban-dev.html` e no `okr-dev.html`. |
| **Carryover automático** (ponto não discutido e ação pendente passam ao próximo 1:1, com selo "↩ herdado") | Entra na Fase 1. |
| **Radar de cadência** com 🟢 até 15 dias, 🟡 16 a 21, 🔴 acima de 21, **descontando férias da Escala** | Entra nos sinais da Frota (hoje só tenho "1:1 atrasado"). |
| **Notas compartilhadas × privadas** no encontro, em caminhos físicos separados | Já era a decisão 4 do Caio; o dossiê dá o desenho de regras (nota privada só do autor). |
| **Feedback no método SCI** (situação, comportamento, impacto) com **visibilidade escolhida e imutável** (só destinatário, destinatário + líder, só líder) e botão **"pedir feedback sobre esta entrega"** ao concluir card/marco | Entra na Fase 2. O Agente atua como coach de redação (reescrever julgamento em comportamento), sem nunca decidir nada. |
| **Painel lateral de evidências** (lado a lado com o formulário de avaliação) | Entra quando houver ciclo (Fase 3). |
| **Trava de devolutiva** (o liderado só vê o resultado depois que o líder libera na conversa) | Entra no ciclo (Fase 3), se o ciclo tiver resultado individual. |
| **Indicação de pares** sugerida por quem colaborou nos mesmos Supercards/Marcos, aprovada pelo líder | Entra no ciclo; é um diferencial real nosso. |
| **PDI ligado a card do Maré** (a ação de 70 % avança quando o card conclui) | Já estava no desenho como vínculo opcional; passa a ser regra da Fase 2. |
| **Separar papel ágil de papel de gente** (PO organiza backlog; líder de carreira é outro vínculo) | Confirma a decisão 2 do Caio. Usar vínculo explícito `liderUid`/`gerenteUid` e um papel `bp`/RH. |

### 12.3 Pontos de cuidado (decidir antes de construir)
1. **Backup.** O backup completo copia os nós listados em `NOS_GLOBAIS` para o bucket. Se `kanban/travessia/` entrar, **notas privadas e feedbacks vão junto** (bucket privado, mas legível por quem administra o projeto). Opções: (a) não fazer backup das notas privadas, aceitando que não há como restaurá-las; (b) fazer backup cifrado; (c) fazer backup de tudo e documentar o acesso. *Recomendo (a) para notas privadas e (c) para o resto, a validar com a TI.*
2. **Quem administra o projeto enxerga tudo.** Console e funções contornam as regras. Isso precisa constar na conversa com RH/TI (30/10) e na política de acesso, em vez de prometer sigilo que o banco não garante contra administradores.
3. **Nota e 9-Box (BARS de 4 níveis, calibração, eixo de "potencial").** Não conflita com o desenho, mas **depende da decisão do RH**, que vai refazer o processo. O eixo "potencial" é o mais contestado em pesquisa de RH (alto risco de viés) e um modelo com nota individual tem implicações trabalhistas. *Fica como Fase 3 opcional; nada de nota na v1.*
4. **Termômetro de energia pré-1:1 (autorrelato de 1 a 5).** Faz sentido como autorrelato **visível só ao par**. Mantenho a linha vermelha de que **nenhum modelo analisa sentimento ou "risco de burnout" por pessoa**; o gráfico de tendência é do líder olhar, não do sistema inferir.
5. **Upward feedback com trava de 3 respondentes.** Em squads de 5 a 7 pessoas, 3 respostas ainda identificam. Prefiro agregar por **gerência** (mais gente) ou subir a trava, e nunca mostrar comentário aberto sem moderação.
6. **Excesso de escopo.** O dossiê lista cerca de 25 funções. A lição do dossiê de concorrência do Maré vale aqui: **poucas coisas bem acabadas.**

### 12.4 Fases revisadas (juntando o dossiê com o que já tínhamos)
| Fase | Entrega |
|---|---|
| **0 — Validar** (feito, PR #1522) | Protótipo clicável com dados fictícios. |
| **1 — Rituais** | Vínculos (líder, gerente, RH), séries de 1:1, pauta colaborativa, notas compartilhadas e privadas, ações, carryover, radar de cadência, lembretes, **Baú da Travessia** (+ botão no Maré e no Radar). Regras e testes de regras. Piloto: squad Dados. |
| **2 — PDI e feedback** | PDI 70-20-10 com vínculo a cards, co-piloto de PDI, briefing de 1:1, **feedback SCI** com visibilidade e pedido de feedback, contexto automático Maré/Radar. |
| **3 — Frota e ciclo** | Quadro do time e do gerente, resumo semanal, painel de evidências, ciclo configurável pelo RH (autoavaliação, pares, devolutiva com trava). Nota/9-Box só se o RH decidir. |

## 13. Fase 1 — o que o Caio mandou fazer já (22/10/2026, tarde)

**Escopo pedido:** 📦 Baú · 🚦 faróis · 🌤️ humor dentro do 🌅 Meu Dia · 🔓 trava de devolutiva e 🤝 indicação de pares dentro da avaliação · ⭐ mural de Estrelas (Kudos) dentro do Travessia, só para quem tem.

**Como interpretei (corrigir se estiver errado):**
- **Faróis** = semáforo de cadência do 1:1 por pessoa (🟢 em dia, 🟡 atenção, 🔴 atrasado), medido contra a cadência combinada (semanal, quinzenal, mensal ou trimestral), **descontando as folgas da Escala**. Para o farol existir, entra um registro simples de 1:1 realizado (data e tipo), sem pauta nem série completa ainda.
- **Humor no Meu Dia** = um "como você está hoje?" de 1 a 5 no painel 🌅 Meu Dia do Maré. **Privado por padrão** (só a pessoa lê). Ela pode escolher **compartilhar com o líder direto**; descompartilhar apaga a cópia. Nenhum modelo analisa humor.
- **Avaliação v1** = só texto (sem nota, como combinado), com três vozes: autoavaliação, líder e pares. Perguntas padrão por ciclo (o RH poderá trocar depois). Fases: preparação (indicação de pares) → coleta → devolutiva → encerrado.
- **Indicação de pares:** o avaliado sugere, **o líder aprova**; só par aprovado responde; o avaliado nunca lê o feedback individual dos pares. Sugestões iniciais = colegas das mesmas squads.
- **Trava de devolutiva:** o avaliado só lê a devolutiva **depois que o líder libera**; mesmo liberada, a avaliação bruta do líder e os feedbacks individuais dos pares continuam fechados (a devolutiva é a síntese do líder).
- **Mural de Estrelas:** lê as Estrelas que a pessoa recebeu (nas squads dela e no mural geral); a seção só aparece se houver alguma; cada Estrela pode ir para o Baú com 1 clique.

**Já feito nesta etapa (PR de fundação):** regras do banco `kanban/travessia/*` + 11 testes de regras (inclui "o avaliado não lê a avaliação do líder", "humor privado", "ADM e RH não leem conteúdo") + o nó entra no backup semanal (não no diário).

**Quem lê o quê (resumo das regras):**
| Dado | Pessoa | Líder direto | Gerente | RH | ADM |
|---|---|---|---|---|---|
| Baú | ✅ grava e lê | lê | lê | ❌ | ❌ |
| Registro de 1:1 e cadência | ✅ | ✅ | lê | ❌ | ❌ |
| Humor | ✅ (privado) | só o que ela compartilhar | ❌ | ❌ | ❌ |
| Autoavaliação | ✅ | lê | lê | ❌ | ❌ |
| Avaliação do líder | ❌ | ✅ | lê | ❌ | ❌ |
| Feedback de cada par | ❌ | lê | lê | ❌ | ❌ |
| Devolutiva | só depois de liberada | ✅ | lê | ❌ | ❌ |
| Organograma (vínculos) | lê | lê | lê | grava | grava |
| Ciclos (nome, fase) | lê | lê | lê | grava | grava |

O ADM e o RH administram o **organograma e os ciclos**, mas **não leem conteúdo de pessoas** (lembrando: quem administra o projeto do Firebase contorna as regras — seção 12.3).

**Falta fazer (próximas PRs):** a tela real `travessia-dev.html` (login, Minha travessia, Frota, Avaliação, administração do organograma/RH/ciclos) · botão 📌 no card do Maré, no marco do Radar e na Estrela · humor no Meu Dia · notificação para o par indicado · Ajuda e dica.


### 13.1 Acréscimo (22/10/2026, noite): 🌙 Fechamento do dia e 📓 Diário
Ideia do Caio: dentro do 🌅 Meu Dia, além do humor da manhã, um **humor de fechamento do dia** com uma **caixa de texto** para a pessoa relatar como foi o dia, **avisando que fica salvo para ela se lembrar no Travessia**.
- **Onde grava:** `kanban/travessia/diario/{uid}/{dia}` com `n` (1 a 5, opcional), `texto` (até 1500 caracteres, opcional) e `ts`. **Privado:** só a própria pessoa lê e grava. Nem o líder, nem o gerente, nem o RH, nem o ADM, nem o Agente Ágil leem (e o fechamento **não** vai para o humor compartilhado). O texto de aviso na tela diz isso.
- **No Travessia:** o bloco de fechamento aparece em *Minha travessia* e há uma aba **📓 Diário** (lista por mês, busca, apagar um dia e 📌 guardar um dia no Baú).
- **Backup:** entra no backup semanal junto com o resto de `kanban/travessia`. Como é o dado mais pessoal de todos, vale a mesma conversa da §12.3 com a TI: **recomendo excluir o diário do backup** (hoje não está excluído).
- **Dica:** não, o bloco já está à vista no Meu Dia. A Ajuda do Maré foi atualizada.


### 13.2 Acréscimo (22/10/2026, noite): 🌡️ termômetro do time e 🫶 aviso de apoio ao líder
Pedido do Caio: o líder precisa de um **termômetro da média do time**, com **quantas respostas** existem, e **receber um alerta quando alguém marca que está mal**, só para ficar de olho e ajudar.
- **Como respeita a privacidade:** o humor continua **privado por padrão**. O termômetro e o alerta só consideram quem **escolheu compartilhar com o líder** (a caixa "Compartilhar com meu líder", agora com o texto explícito: "ele vê no termômetro do time e recebe um aviso se eu marcar que não estou bem, pra poder me apoiar"). Quem não compartilha não entra na média nem gera aviso, e o líder vê quantas pessoas não compartilham.
- **Termômetro (Frota):** média dos últimos 7 dias de 1 a 5 com a carinha correspondente e a cor (🟢 ≥ 3,5, 🟡 ≥ 2,5, 🔴 abaixo), comparação com a semana anterior (subiu, estável ou caiu), distribuição por humor, gráfico dos últimos 14 dias e a contagem "N respostas de P de T pessoas (quem compartilhou)".
- **Aviso de apoio:** quando uma pessoa que compartilha marca "mal" ou "muito mal", o líder direto recebe uma notificação no sino (tipo `travessia_apoio`, um por pessoa por dia, nova área "Travessia (gente)" na Central de Notificações) e vê na Frota a lista "🫶 Pra ficar de olho" (últimos 3 dias) e um selo "vale um oi" no cartão da pessoa. Clicar no aviso abre a Frota. **Sem push** por enquanto: o texto de uma notificação no celular poderia aparecer na tela bloqueada (fica como decisão do Caio).
- **Decisões que continuam abertas (do Caio e do RH):**
  1. **Opt-in × padrão compartilhado.** Hoje a cobertura depende de cada pessoa compartilhar. Se o Caio quiser a média do time inteira, a alternativa é um **agregado anônimo calculado no servidor** (só aparece com pelo menos 5 respostas, sem nomes e sem aviso individual) — exige mudar o texto prometido às pessoas e validar com RH/LGPD (humor pode ser considerado dado de saúde). Os avisos por pessoa continuariam dependendo de consentimento.
  2. **Push** para o aviso de apoio (com texto genérico, sem nome).
  3. Se o **gerente** também deve ver o termômetro dos times dos seus líderes (hoje só o líder direto lê o humor compartilhado).
