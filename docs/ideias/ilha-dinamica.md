# 🏝️ Ilha Dinâmica — plano (10/11/2026)

Um controle **opcional** no topo central do Oceano (lobby e barra do host, ou seja, os produtos abertos dentro do Oceano) que mostra o que está acontecendo agora — **timer** e **notificações** — e abre num painel de vidro. Inspirada na Dynamic Island da Apple só na ideia (atividade viva, compacta, que se expande); visual Marine Glass, nunca o recorte preto do iPhone.

**Protótipo isolado (fase 0):** `docs/demo/ilha-dinamica-prototipo.html` — dados fictícios, sem Firebase, os 3 temas do lobby, desktop e celular, seletor de modo/cenário. Teste: `docs/arezzo/testes/test_ilha_prototipo.js` (137 asserções, escrito pelo Codex por contrato e rodado pelo Claude). Capturas: `docs/capturas/ilha-prototipo/`.

## Fase 1 — primeiro teste real NO MARÉ DEV (10/11/2026, decisão do Caio)
O primeiro teste com dados reais é no **Maré dev (`kanban-dev.html`)**, não no Oceano: a ilha fica no centro do cabeçalho, **sem leitura nova** (timers do índice que o ⏲ Timers já escuta; notificações da mesma lista do sino), pausar/continuar/encerrar pela mesma `tmAcao` do card (via `mare-timer`). Liga em **⏲ Timers → 🏝️ Ilha Dinâmica**; ajustes na aba **⚙ Ajustes** da própria ilha (a pílula muda ao vivo). Teste: `docs/arezzo/testes/test_ilha_mare.js`.

**Mudanças pedidas pelo Caio:** modo "ao passar o mouse" **sem nada visível** (só uma área transparente que reage ao mouse/Tab); **notificação nova alarga a pílula** e mostra quem/o quê + onde por ~6 s, no estilo do Vorssaint (nunca abre o painel; com **Não Perturbe**, só o número muda; em "compartilhar tela", "Nova notificação"); **sem Sonar dentro da ilha** (os dois separados).

**Do Vorssaint (referência de comportamento, implementação própria):** atividade principal escolhida (timer ou notificações), "ao reabrir" (última aba ou fixa), 📌 manter aberta (o clique fora não fecha; Esc fecha), módulo desligado sem custo (`window.__ilhaTicks` = 0), contagem regressiva para evento (**só no protótipo**, para comparar: no real exigiria ler a agenda do Radar).

## Decisões do Caio (10/11/2026)
| # | Decisão |
|---|---|
| 1 | **Notificações entram na ilha**: ligada, o 🔔 do topo sai e a ilha mostra a contagem e a lista (mesmo `MareNotif`: lido, som, Não Perturbe) |
| 2 | **Sonar fica com o botão próprio** — os dois separados (a variante "Sonar dentro da ilha" foi descartada) |
| 3 | **Timer completo já na v1**: ver, pausar, continuar, encerrar, abrir o card |
| 4 | **Sem favoritos** no MVP (os cartões, atalhos, links e o Sonar já levam a qualquer destino) — entram na V2 |
| 5 | **Preferência por aparelho** (localStorage), em ⚙ Meu perfil; desligada por padrão |
| 6 | **Modos de exibição** (ideia do Caio): *Sempre visível* · *Ao passar o mouse* · *Só quando houver ação* (padrão) |
| 7 | Sem resposta explícita, seguiu a recomendação: no celular só aparece com atividade (exceto "sempre visível"); notificação no modo "só com ação" aparece ~6 s |

## Estados e regras
- **Repouso** 🌊 · **Atividade** `⏲ Revisar campanha · 18:42 · +2 · 🔔 2` · **Aberta** (clique/toque/Enter; Esc recolhe e devolve o foco) · **Fio** (modo mouse: risco fino no topo, aparece no hover ou no Tab) · **Oculta**.
- Vários timers: mostra o rodando mais recente e "+N". Compartilhar tela: some o título, fica o tempo.
- **Notificação nova alarga a pílula** (quem/o quê + onde) por ~6 s e volta; nunca abre o painel; com Não Perturbe só muda o número.
- Modo "ao passar o mouse" no toque vira "só com ação" (não existe hover).
- Tempo **sempre por horário** (`accMs + agora − startedAt`); o relógio só roda com timer rodando, ilha visível e aba visível. Abrir/fechar: uma transição de ~200 ms; sem animação parada; "reduzir movimento" tira a transição.
- Desligar a ilha não para timer nem notificação.

## Fases
| Fase | Entrega | Leitura no banco | Quem |
|---|---|---|---|
| **0 · protótipo** ✅ | protótipo isolado + teste + comparação com o topo atual | zero | Claude (protótipo) · Codex (teste) |
| **1a · `mare-timer`** | tirar do Maré a lógica do timer (decorrido, pausar, continuar, encerrar; "só quem recebeu controla") para um módulo compartilhado; o Maré passa a usar o módulo sem mudar comportamento | zero | Claude (escrita no banco → checklist de fronteira) |
| **1b · ilha no Oceano** | ilha no lobby e no host; timer completo via `mare-timer`; sino dentro da ilha; modos; Meu perfil | 1 escuta em `kanban/timers_ativos/{uid}` (só os próprios) **só com a ilha ligada**; escritas = as do Maré hoje | Claude |
| **2 · evoluções** | Não Perturbe na ilha; próxima reunião do Radar (sob demanda); status dos serviços (selo VTEX já existe); Agente Ágil só com estado real | caso a caso | a decidir |

## Fronteira (segurança)
- Escrita do timer pela **mesma função** do Maré (módulo), mesmas regras: o índice `timers_ativos/{uid}` só o dono lê/escreve; o registro `card_timers` fica no squad (gravar exige ser do squad) — fora do squad a ilha mostra o timer e avisa ao tentar pausar, nunca falha calada.
- Sem `postMessage` novo na fase 1 (a ilha mora no host e lê o próprio índice). Se vier: `origin`, `source` e formato fechado.
- O `oceanoResumo` (endpoint pessoal do Caio) não entra.

## Fora do escopo
Mural, gráficos, lista de atrasos, Travessia, Spotify, progresso simulado do agente, Dynamic Island real do iPhone (projeto nativo à parte).

## V2 (iniciada em 10/11/2026) — no Maré dev
A v1 subiu para prod em 10/11/2026 (kanban v8.30.932, desligada por padrão). A V2 continua no `kanban-dev.html`.

**Base: módulos registrados (Claude).** Cada recurso da ilha vira um módulo com interruptor próprio em ⚙ Ajustes, `ligar()`/`desligar()` (só ele abre e fecha a própria escuta) e `candidatos()` (atividades que ele oferece, com prioridade). **Módulo desligado não custa nada:** zero escuta nova no Firebase (teste conta os `_onValue`). **Combinar atividades:** a pílula mostra a principal + uma secundária (ex.: `⏲ 18:42 · 📅 em 12 min`); o usuário escolhe a principal, a secundária é a de maior prioridade entre as outras.

| # | Módulo | De onde vem o dado | Custo no banco | Decisão do Caio |
|---|---|---|---|---|
| 1 | 🔀 Combinar atividades | módulos ligados | zero | — |
| 2 | 🛡️ Guardião / backup (só ADM) | escuta já existente `cards_guardiao/{squad}/ultimo` + notificação 🛟 de backup que já chega | zero | filtro só de exibição (a regra de leitura vale para todo @ciahering) |
| 3 | ⭐ Favoritos (até 3) | squads, produtos, destinos | zero | **por aparelho** (localStorage) |
| 4 | 🚨 Status dos serviços | `vtex_saude` / `*_status` | 1 escuta só com o módulo ligado | texto de terceiro chega ao DOM → checklist de fronteira |
| 5 | 📅 Agenda do Radar | `okr/calendario` | **cópia de 3 h** (como o Sonar), sem escuta aberta | **só os meus** (convidado/responsável); contagem regressiva de um evento escolhido |
| 6 | 🤖 Agente Ágil | marcador "analisando" novo, gravado pela function da @menção e apagado na resposta | 1 escuta em nó pessoal | **mudar a function** (deploy do Caio); entra por último |

**Ordem e divisão:** (1)+(2) Claude, num PR; depois (3), (4), (5) ao Codex em PRs **em sequência**, base `main`, sem mexer em `version.json` (o bump é na integração); (6) Claude, com teste em `functions/` e linha em "Pendente de deploy".
