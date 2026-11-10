# 🏝️ Ilha Dinâmica — plano (10/11/2026)

Um controle **opcional** no topo central do Oceano (lobby e barra do host, ou seja, os produtos abertos dentro do Oceano) que mostra o que está acontecendo agora — **timer** e **notificações** — e abre num painel de vidro. Inspirada na Dynamic Island da Apple só na ideia (atividade viva, compacta, que se expande); visual Marine Glass, nunca o recorte preto do iPhone.

**Protótipo isolado (fase 0):** `docs/demo/ilha-dinamica-prototipo.html` — dados fictícios, sem Firebase, os 3 temas do lobby, desktop e celular, seletor de modo/cenário. Teste: `docs/arezzo/testes/test_ilha_prototipo.js` (137 asserções, escrito pelo Codex por contrato e rodado pelo Claude). Capturas: `docs/capturas/ilha-prototipo/`.

## Decisões do Caio (10/11/2026)
| # | Decisão |
|---|---|
| 1 | **Notificações entram na ilha**: ligada, o 🔔 do topo sai e a ilha mostra a contagem e a lista (mesmo `MareNotif`: lido, som, Não Perturbe) |
| 2 | **Sonar fica com o botão próprio**. Variante B no protótipo: "Sonar dentro da ilha" (o botão some e a busca vai para o painel) — para comparar |
| 3 | **Timer completo já na v1**: ver, pausar, continuar, encerrar, abrir o card |
| 4 | **Sem favoritos** no MVP (os cartões, atalhos, links e o Sonar já levam a qualquer destino) |
| 5 | **Preferência por aparelho** (localStorage), em ⚙ Meu perfil; desligada por padrão |
| 6 | **Modos de exibição** (ideia do Caio): *Sempre visível* · *Ao passar o mouse* · *Só quando houver ação* (padrão) |
| 7 | Sem resposta explícita, seguiu a recomendação: no celular só aparece com atividade (exceto "sempre visível"); notificação no modo "só com ação" aparece ~6 s |

## Estados e regras
- **Repouso** 🌊 · **Atividade** `⏲ Revisar campanha · 18:42 · +2 · 🔔 2` · **Aberta** (clique/toque/Enter; Esc recolhe e devolve o foco) · **Fio** (modo mouse: risco fino no topo, aparece no hover ou no Tab) · **Oculta**.
- Vários timers: mostra o rodando mais recente e "+N". Compartilhar tela: some o título, fica o tempo.
- **Notificação nunca abre a ilha** e não toma o lugar do timer; no modo "só com ação" aparece compacta por ~6 s.
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
Favoritos, Mural, gráficos, lista de atrasos, Travessia, Spotify, progresso simulado do agente, Dynamic Island real do iPhone (projeto nativo à parte).
