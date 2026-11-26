# Quadro: detalhe do Backlog

> Texto completo de cada item do Backlog do [`QUADRO.md`](../QUADRO.md), movido sem edição de `docs/COORDENACAO_AGENTES.md` em 11/11/2026. No Quadro fica uma linha curta com o link para cá.

| Ideia | Dono | Onde está o desenho |
|---|---|---|

<a id="vidro-lapidado"></a>

| Ideia | Dono | Onde está o desenho |
|---|---|---|
| 🪟 **Acabamento "vidro lapidado"** (`--specular` por tema + curvas `--ease-*`, GUIA_UI_UX 2.4 e 2.5 regra 6): contrato pronto para o Antigravity (10/11/2026); depois, **diagrama `.arq` interativo + rodapé/mapa** nas abas institucionais do Oceano, junto com o O4 da consultoria | Antigravity (acabamento) · Claude (diagrama/rodapé, com o O4) | `docs/GUIA_UI_UX.md` §2.4, §2.5 e §6.2 |

<a id="ilha-dinamica"></a>

| Ideia | Dono | Onde está o desenho |
|---|---|---|
| 🏝️ **Ilha Dinâmica**: fase 0 (protótipo) e 1a (`mare-timer`) entregues; **1º teste real no Maré dev** (10/11/2026, aguardando o Caio testar); depois Oceano (lobby + host) | Claude | `docs/ideias/ilha-dinamica.md` · `docs/demo/ilha-dinamica-prototipo.html` |

| 📅 **Ilha · notificações do calendário à parte** (ideia do Caio, 13/11/2026): dentro da Ilha, os avisos de calendário (reunião, evento, prazo do Radar, 🔔 Gantt, 📣 Pedir atualização) ganham o próprio grupo, separados das outras notificações, como já é feito com os alertas de sistemas e o Guardião | Claude | a desenhar: quais tipos entram (`reuniao`, `okr_reuniao`, `okr_evento`, `gantt_cal`, `gantt_pedido`…), ordem do grupo e se o sino também separa |
| 🎨 **Tipos de notificação mais distintos** (ideia do Caio, 13/11/2026): diferenciar visualmente cada tipo além do emoji no começo da mensagem — ex.: faixa/cor lateral por família (pessoal, calendário, Radar, sistema), ícone em selo, rótulo curto do tipo | Claude | a desenhar com o `docs/GUIA_UI_UX.md` (Marine Glass, 3 temas; cor nunca como único sinal); vale para a Ilha e o sino (`mare-notif-dev.js`) |

<a id="cardume-texto"></a>

| Ideia | Dono | Onde está o desenho |
|---|---|---|
| 🐟 **Cardume · escrever melhor** (ideia do Caio, 24/11/2026): **enriquecimento de texto** (negrito, itálico, riscado, `código`, bloco de código, lista, citação, link — por atalho `Ctrl+B/I`, barrinha discreta e Markdown digitado); **botão de emoji** (seletor leve, recentes, busca por nome; `:nome:` digitado); **colar formatação** (colar do Word/Docs/e-mail mantém negrito, listas e links, convertidos para o mesmo Markdown — nunca o HTML colado); **mencionar cards** (`#` abre o autocompletar dos cards das squads da pessoa e vira a prévia do card). Encaixe sugerido: formatação básica, emoji e `#card` já na **etapa 2/3** do v0 (o `#card` é o começo do critério de sucesso do piloto); colar formatação logo depois | Claude | `docs/ideias/cardume.md` (plano). **Fronteira:** o texto é guardado como Markdown e renderizado **nó a nó no DOM** (`createElement`/`textContent`), nunca `innerHTML`; colar = HTML lido só para extrair a estrutura e descartado; link só `https:` (e os do Oceano); `#card` validado pelo mesmo `^[A-Za-z0-9_-]{1,64}$` das regras e aberto só se a pessoa enxerga o card |

<a id="cardume-interacoes"></a>

| Ideia | Dono | Onde está o desenho |
|---|---|---|
| ✅ **Feito no dev** — ↩️ Responder (#1959/#1960, 24/11) e 😀 reações (#1963, regras no ar em 25/11; uma por pessoa, aviso só no Sino). | | |
| 🐟 **Cardume · reagir e responder** (ideia do Caio, 24/11/2026): **reagir a uma mensagem com emoji** (👍 ❤️ 😂 🎉… — contador por emoji, clicar no seu tira a reação, passar o mouse mostra quem reagiu; usa o mesmo seletor de emojis do compositor) e **responder a uma mensagem** (botão "↩️ Responder" na mensagem: a resposta mostra o trecho citado de quem respondeu, e clicar na citação leva à mensagem original; base para uma futura conversa em fio). | Claude | `docs/ideias/cardume.md` (plano). **Banco (R3, regras + testes + 2 revisões):** reação = nó novo `reacoes/{canal}/{msgId}/{emoji}/{uid}: true` (só membro, só a própria reação, emoji de uma lista fechada; a limpeza apaga junto com a mensagem); responder = campo `resp` na mensagem com o id da original (validado pelo `ID_RE`), sem copiar o texto dela para o banco (a citação é montada na tela e some se a original for apagada). **Fronteira:** quem reagiu aparece só para membros do canal |

<a id="cardume-citar"></a>

| Ideia | Dono | Onde está o desenho |
|---|---|---|
| 🐟 **Cardume · `@card:` e `@objetivo:`** (ideia do Caio, 24/11/2026, para depois): digitar **`@card:`** abre o autocompletar dos cards (pelo título, das squads da pessoa) e **`@objetivo:`** abre o dos **objetivos do Radar**; o escolhido vira um chip na mensagem (🗂 título · squad / 🎯 objetivo · torre), que abre o card no Maré ou o objetivo no Radar (`okr(-dev).html?okr=<id>`). Junta e substitui o "`#` para mencionar cards" de [escrever melhor](#cardume-texto); o chip do card já existe (v0.6, link colado). | Claude | `docs/ideias/cardume.md`. **Banda:** buscar por título exige a lista de cards ou de objetivos; usar o que já é leve (índice de títulos, ou só os cards/objetivos citados e os recentes da pessoa) e medir antes de abrir. **Banco:** só leitura, sem regra nova (objetivos em `kanban/okr/objetivos`, cards em `kanban/squads/{sq}/dados`; conferir no simulador quem lê cada um, como na etapa 3). **Fronteira:** título de card e de objetivo entram só por `textContent`; os ids passam pelo `ID_RE` antes de virar link ou leitura; o texto gravado guarda só o link/id, nunca o título copiado |

<a id="cardume-zumbido"></a>

| Ideia | Dono | Onde está o desenho |
|---|---|---|
| 📳 **Concha · "Chamar atenção" (o zumbido do MSN)** (ideia do Caio, 24/11/2026): um botão na conversa faz a tela de outra pessoa **tremer**, como o "zumbido" do MSN, com o mesmo tremor do modo insistente do Sino (`tremer()` em `mare-notif-dev.js`, que mexe só no conteúdo principal e respeita "reduzir movimento"). **O ADM liga e desliga** o recurso para toda a casa (interruptor na Central de Notificações do Painel, `kanban/notif_config`). | Claude | `docs/ideias/cardume.md`. **Sugestões de desenho:** (1) só dentro de um canal, para um membro dele (ou o canal inteiro, se o ADM permitir); (2) **limite** de 1 zumbido por pessoa-alvo a cada 2–5 min, para não virar spam, e quem recebe pode **desligar para si** (preferência em `notif_prefs`; o Não Perturbe também bloqueia); (3) a tela treme só se a pessoa estiver com o Oceano aberto; fechado, vira uma notificação comum "📳 Fulano chamou sua atenção na Concha" (tipo novo em `MareNotif.TIPOS`, push opcional pelo `PUSH_TYPES`); (4) aparece na conversa como uma linha "📳 Fulano chamou a atenção de Ciclano". **Banco (R3):** nó de evento curto (`kanban/cardume/zumbidos/{alvo}/{id}` = `{de, c, ts}`, só membro do canal grava, só o alvo lê e apaga, limite por regra usando `ts`), regras + testes + 2 revisões. **Fronteira:** quem pode tremer a tela de quem; limite contra abuso; o texto visível usa só o nome (sem mensagem livre) |

<a id="concha-pedidos-2511"></a>

### 🐚 Concha — pedidos do Caio (25/11/2026)

| Pedido | O que já existe | Escopo sugerido |
|---|---|---|
| ✅ 📸 **Foto na lista do @** (entregue no lote de 25/11) | A lista de @ mostra só o nome (`atualizarSug`) | Avatar (o mesmo `avatar(uid)` das mensagens: foto `https:` do diretório público, senão iniciais) ao lado de cada nome, no campo e no editor. Só tela, R1 |
| ✅ 😀 **Quem reagiu e com o quê, à vista** (entregue: até 3 nomes no chip, mais que isso a lista ao tocar) | Chip "👍 3" com os nomes só no `title` (computador) e na mensagem tocada (celular) | Mostrar quem reagiu sem depender de passar o mouse: ex.: segurar/clicar no chip abre "👍 Ana, Bruno · 🎉 Carla", ou nomes curtos ao lado quando forem poucos. Decidir o formato com o Caio. Só tela, R1 |
| ✅ ✍️ **Barra de formatação com explicação + `#`** (entregue no lote de 25/11) | Botões B, I, S, `</>`, •, ❝, 😀, GIF com só o título no `title` | Cada botão com rótulo/tooltip que ensina ("**negrito** — Ctrl+B") e um botão **#** que insere `#` e abre a lista das #tags dos seus canais (`tags_ult`, o mesmo do Sonar). Só tela, R1 |
| ✅ ❓ **Ajuda da Concha (help content)** (entregue em 25/11: 13 tópicos, ❓ no topo, Sonar e `/atualizarhelpcontent`) | Só a linha de dicas embaixo do campo | Ajuda própria (❓ no topo), no padrão das outras: canais e seções, mensagem (formatação, @, #tag, GIF, responder, reagir, 📝 No card), avisos 🔔/🔕/🚫 e #tags seguidas, Sonar (Ctrl/⌘+K), @ Menções. Entra no `/atualizarhelpcontent` e na base do Agente Ágil. R0–R1 |
| ✅ ✏️ **Editar só por 15 min** (pedido 25/11; o Caio confirmou 15, como o WhatsApp — entregue) | Hoje dá para editar a própria mensagem a qualquer hora (enquanto o canal está ativo) | Some o ✏️ depois de 5 min e a **regra** barra a edição (`editado` ≤ `ts` + 5 min, com folga de relógio) — senão é só tela. O WhatsApp dá 15 min: confirmar o número com o Caio. Ajuda e dica acompanham. R3 (regra) |
| ✅ 🧷 **`@card:` e `@objetivo:` funcionando** (entregue em 25/11: índice do Maré #1981 + Concha) | Desenho pronto em [cardume-citar](#cardume-citar) | Seguir o desenho de lá (cache do Sonar para objetivos; títulos de card leves; chip na mensagem). R2 |

<a id="concha-novos-pedidos-2511"></a>

### Concha — novos pedidos do Caio (25/11/2026)

| Pedido | Escopo sugerido |
|---|---|
| ✅ **Encaminhar mensagens** (entregue em 26/11) | Adicionar a opção Encaminhar às ações da mensagem, com seleção do canal de destino. **Decisões do Caio (25/11):** a encaminhada mostra o **canal de origem** ("⏩ Encaminhada de Ana · # Dados"); encaminhar para um canal mais aberto que o de origem (ex.: só convidados → aberto, ou squad → temático aberto) **avisa antes** de mandar. |
| ✅ **Limpar a aba Menções** (entregue em 25/11: 🧹 Limpar + ✓ Marcar todas como lidas) | Adicionar a ação Limpar menções à aba da barra lateral esquerda. A ação afeta a lista pessoal e preserva as mensagens originais nos canais. |
| ✅ **Escolher os temas Claro e Vice City** (entregue em 25/11: 🎨 no topo, Vice City com contraste conferido) | Disponibilizar Lençóis (Claro) e Vice City na Concha. Conferir o fluxo de seleção e o uso da preferência do Oceano, que a página já lê ao abrir. |

<a id="concha-comparativo"></a>

### Concha — ideias do comparativo com Slack e concorrentes

Ordem sugerida para avaliar no piloto. A análise de 25/11/2026 partiu da Concha dev e do [plano existente](../ideias/cardume.md). O uso no piloto e o Firebase ficaram fora da verificação.

| Prioridade sugerida | Ideia | Referência |
|---|---|---|
| 1 | **Copiar link e salvar para depois.** Aproveitar o salto por ID para abrir a mensagem no contexto. Salvos ficam numa lista pessoal e respeitam o acesso ao canal e a exclusão da mensagem. Lembretes podem vir depois. | [Links no Slack](https://slack.com/help/articles/203274767-Forward-messages-in-Slack) · [Salvos no Slack](https://slack.com/intl/en-gb/help/articles/360042650274-Save-messages-and-files-for-later) |
| 2 | **Fixar no canal.** Reunir decisões, mensagens e links úteis em Detalhes, visíveis para quem pode ler o canal. | [Detalhes do chat no Teams](https://support.microsoft.com/en-us/teams/chat/show-chat-info-in-microsoft-teams) |
| 3 | **Paginar o histórico e buscar no texto.** Carregar mensagens mais antigas ao rolar para cima. Ampliar o Sonar com texto e filtros de canal, autor e período, respeitando o acesso às mensagens. A busca já consta no plano. | [Busca no Slack](https://slack.com/help/articles/202528808-Search-in-Slack-Search-in-Slack-) |
| 4 | **Acompanhar fios por mensagem.** Evoluir a citação do Responder para um painel com contagem e opção de seguir. Em canais de suporte, avaliar tópicos com estado Aberto ou Resolvido. | [Threads no Slack](https://slack.com/help/articles/115000769927-Use-threads-to-organize-discussions) · [Fóruns no Discord](https://support.discord.com/hc/en-us/articles/6208479917079-Forum-Channels-FAQ) |
| 5 | **Marcar como não lida e reunir pendências.** Dar uma forma de voltar à conversa e avaliar uma lista no Sino em que a leitura e a conclusão sejam ações distintas. | [Não lidas no Slack](https://slack.com/help/articles/226410907-View-all-your-unread-messages) · [Caixa de entrada do Twist](https://twist.com/help/articles/the-new-and-updated-twist-HSc4VzbsE) |
| 6 | **Enquetes rápidas e envio agendado.** Duas ideias independentes para decisões da squad e comunicados com hora marcada. | [Enquetes no Teams](https://support.microsoft.com/en-us/teams/apps-service/create-a-poll-in-microsoft-teams) · [Agendamento no Teams](https://support.microsoft.com/en-us/teams/teams-channels/schedule-channel-messages-in-microsoft-teams) |

**Integração já prevista com o Maré.** A Concha já registra mensagens em cards existentes. A próxima proposta é criar um card a partir da mensagem, com squad, responsável, prazo e link de volta à conversa. Mensagens diretas, anexos e chamadas já foram considerados para depois do v0. [Plano da Concha](../ideias/cardume.md) · [Tarefas no Google Chat](https://support.google.com/chat/answer/9920628?co=GENIE.Platform%3DDesktop&hl=en)

<a id="cardume-avisos"></a>

| Ideia | Dono | Onde está o desenho |
|---|---|---|
| 🐟 **Cardume · aviso de mensagem nova, estilo WhatsApp** (ideia do Caio, 24/11/2026): toda mensagem nova num canal avisa os membros (push e contador), **ligado por padrão**. Um **sininho 🔔 no topo da conversa** permite **silenciar aquele canal** (🔕 por 8 h, 1 semana ou sempre), e o canal silenciado mostra o 🔕 na lista. Sugestões: menção (`@`) continua avisando mesmo com o canal silenciado, como no WhatsApp (decisão do Caio); respeita o Não Perturbe; não avisa quem está com a conversa aberta; agrupa as mensagens seguidas do mesmo canal num push só (tag por canal), para o celular não disparar a cada linha. | Claude | `docs/ideias/cardume.md` (plano, junto da etapa 4). **Banco e função (R3, regras + testes + 2 revisões):** preferência privada `kanban/cardume/silenciados/{uid}/{canal}: {ate}` (só a própria pessoa lê e grava); push enviado **direto por uma função** no gatilho de `msgs/{canal}/{id}` para os membros, **sem gravar em `kanban/usuarios/.../notificacoes`** (o nó do Sino é legível por toda a Hering, ver [escalados](escalados.md#usuarios-leitura-ampla)), com texto genérico montado no servidor ("🐟 {nome} mandou mensagem"). **Banda:** é a função de maior volume do Cardume (1 gatilho por mensagem × membros); medir no piloto `dados` antes de abrir. **Fronteira:** nome do canal temático e trecho da mensagem não vão no push |

<a id="consultoria"></a>

| Ideia | Dono | Onde está o desenho |
|---|---|---|
| 🧭 **Plano da consultoria** (Radar, Travessia e lobby em sprints): **guardado em 10/11/2026** a pedido do Caio. Feito: E1–E3, período padronizado (R0) e o Sonar (que substituiu o O2). Próximo, quando voltar: T4 (cartão "próxima ação" da Travessia); em aberto a pergunta do T8 (aba fechada nos 8 s) | Claude | `docs/ideias/consultoria-oceano-2026-11-09.md` · `docs/ideias/cronograma-oceano.html` |

<a id="camiseta-black-friday"></a>

| Ideia | Dono | Onde está o desenho |
|---|---|---|
| 👕 Camiseta Brasil que "ganha forma" conforme a meta da Black Friday (Oceano, enchimento + peças nos marcos de 20 %, modo telão) | Claude | `docs/ideias/camiseta-brasil-black-friday.md` — depende da arte oficial; Black Friday = 27/11 |

<a id="dossie-concorrencia"></a>

| Ideia | Dono | Onde está o desenho |
|---|---|---|
| 🔬 Dossiê de concorrência do Antigravity (34 ideias): triagem em 4 levas — Radar (🧊 deriva, notas→Próximo Passo), Escala→Kanban, Digest do Painel, fluxo do Maré; Meus Pedidos e sino com adiar ficam com o Claude | Caio escolhe a ordem; Claude/Antigravity conforme a triagem | `docs/ideias/dossie-concorrencia-2026-10.md` — **nada roda antes de 04/11** |

<a id="ideias-kanbanize"></a>

| Ideia | Dono | Onde está o desenho |
|---|---|---|
| 🔗 **Kanbanize 1 · ícone de link** (18/11/2026): reconhecer `kanbanize.com` e `businessmap.io` nos links do card. Esforço trivial: uma linha em `KNOWN_SERVICES` (`kanban-dev.html`) | Claude | comparativo Kanbanize × Oceano de 18/11/2026 |
| ⏱️ **Kanbanize 2 · tempo por coluna no card**: barra compacta no modal mostrando onde o card passou o tempo. Esforço baixo: usa `flow.log`, que guarda só os 40 últimos movimentos. Esperar o merge da #1842, que mexe no modal | Claude | idem |
| 🎲 **Kanbanize 3 · previsão Monte Carlo leve**: "85% de chance de concluir N itens até DD/MM", no navegador, com a vazão que o Painel já carrega. Aprovado em 18/11/2026: piloto no squad Dados e IA, com o selo "Estimativa em teste" e primeira previsão possível em 11/01/2027. Fase 0 aprovada em 18/11/2026; próximo passo: fase 1 no `painel-dev.html` | Claude | [desenho](../ideias/monte-carlo-previsao.md) |
| 🚦 **Kanbanize 4 · coluna de fila ou ativa → eficiência de fluxo**: tipo opcional na coluna e % na aba 🌊 Fluxo do Painel. Esforço médio: vale para o histórico, mas precisa alinhar com a regra do Painel que já trata Backlog e A fazer como fila | Claude | idem |
| 🧱 **Kanbanize 5 · categorias de impedimento**: chips rápidos ao marcar impedido e ranking de causas no Painel. Esforço médio: hoje `blockedMs` soma por card e o motivo é texto livre, então é preciso registrar a causa de cada episódio | Claude | idem |
| 🌉 **Kanbanize 6 · ponte com a TI (webhook)**: status do chamado da TI refletido num card do Maré. Depende da TI liberar a API e cria fronteira de confiança nova: passar pelo checklist de `docs/SEGURANCA_FRONTEIRAS.md` antes de começar | Caio decide com a TI | idem |

<a id="tema-claro-painel-radar"></a>

| Ideia | Dono | Onde está o desenho |
|---|---|---|
| 🎨 Tema claro do Painel e do Radar (toast invisível, abas/botões com cor fixa, aba ativa, dia de hoje do calendário) — combinado para 18/10, **sem PR que prove que foi feito** | Claude (ou Antigravity: 1 página por vez) | `docs/ideias/tema-claro-painel-radar-2026-10-17.md` · `docs/arezzo/testes/auditoria_temas.js` |

<a id="ferramentas-teste-visual"></a>

| Ideia | Dono | Onde está o desenho |
|---|---|---|
| 🧪 Ferramentas de teste visual: `perf_apresentacao.js` com `CENARIO=` (medir só um cenário; hoje cada rodada mede 5) e variantes em paralelo; caminho do Chrome de `~/hering-tools` como padrão nas suítes da apresentação (as antigas têm caminho de Linux fixo); **contact sheet** 3×2 (3 temas × desktop/celular numa imagem só) no harness do GUIA §12.3 | Claude | sessão de 09/11/2026 (rodada de movimento da apresentação levou ~30 min, 2/3 em medição) |

<a id="video-release"></a>

| Ideia | Dono | Onde está o desenho |
|---|---|---|
| 🎬 Gerador de vídeo/GIF de release em Marine Glass: um HTML local em `scripts/` com `window.seek(t)` (cada quadro é função do tempo) + JSON `{titulo, entregas, metricas}` + Playwright/FFmpeg → 9:16 (WhatsApp) e 16:9 (Mural/OKR). Fora das páginas publicadas. **Sem Remotion:** a licença gratuita é só para indivíduos e equipes de até 3 pessoas, então empresa precisa de licença paga; o `seek(t)` próprio + Playwright + FFmpeg basta. Números e entregas vêm do `CHANGELOG.md`/dados, nunca inventados, e passam por validação antes de renderizar. Revisão por contact sheet antes de enviar | Caio decide se vale | dossiê do Antigravity de 09/11 + artigo de @e1genqq lido na íntegra |

<a id="firebase-functions-v6"></a>

| Ideia | Dono | Onde está o desenho |
|---|---|---|
| 🔧 Atualizar `firebase-functions` (^5 → atual): o deploy de 18/10 avisou que a versão nova traz breaking changes — fazer com calma e com testes, sem prazo | Claude | aviso do `firebase deploy` de 18/10/2026 |

<a id="nota-codex-radar-uiux"></a>

> Rodada `codex/radar-uiux` (09/11) encerrada em 10/11: o Codex parou sem entregar (sem navegador nem git no sandbox, ~86 mil tokens; log em `~/hering-logs/delegacoes/2026-11-09-codex-radar-uiux.*`). O `prefers-reduced-motion` do Radar (linha abaixo) entra nos itens do Radar do plano da consultoria. Lição: não delegar ao Codex o que precisa de navegador.

<a id="minhas-preferencias-areas"></a>

| Ideia | Dono | Onde está o desenho |
|---|---|---|
| 🧩 **Minhas Preferências com áreas separadas** (ideia do Caio, 13/11/2026): marcar a passagem de uma área para outra no painel 👤 Minhas Preferências, no nosso estilo — clarear um pouco o fundo de cada bloco (vidro mais claro), para ficar claro onde uma área termina e a outra começa | Claude | a desenhar com o `docs/GUIA_UI_UX.md`; conferir os 3 temas e 390 px |

