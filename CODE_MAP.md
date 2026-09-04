# Mapa do código

Índice de âncoras (funções/consts) por área funcional, pra achar código rápido
nos arquivos grandes deste repo (`kanban.html`/`kanban-dev.html` têm ~28.2k
linhas / até ~1.1MB) sem precisar ler o arquivo inteiro.

**Como usar:** os números de linha abaixo são um retrato de um commit
específico (ver rodapé) e ficam desatualizados a cada edição no arquivo —
**sempre confirme com `grep -n "nomeDaFuncao" arquivo.html` antes de confiar
neles pra uma edição**. O valor real deste arquivo é a lista de nomes
(âncoras estáveis), não os números de linha em si.

`kanban.html` e `kanban-dev.html` estão hoje byte-idênticos exceto 2
linhas (string de versão + `VERSION_KEY`) — os números abaixo valem pros
dois (retrato deste rodapé: promoção da v8.30.515 confirmada, ver
`CHANGELOG.md`). Isso pode mudar a qualquer momento que uma feature nova
entrar em dev antes de ir pra prod (ver "Release process" no
`CLAUDE.md`) — se os tamanhos dos arquivos divergirem, refaça o grep no
arquivo específico que você está editando.
`painel.html`/`painel-dev.html` **divergem de verdade** (dev tem
instrumentação extra) — os números da seção painel abaixo são de
`painel.html` (prod).

## kanban.html / kanban-dev.html

### Papéis & autenticação
- `ADM_EMAILS` (let) — L5777
- `getEffectiveRole()` — L5815 — papel efetivo, ADMs hardcoded não são rebaixáveis
- `loadSquadsFromFirebase()` / `SQUAD_META_LIVE` — L5868 / L5844
- `resolveSquadAndShow()` — L9118 — resolve squad da URL, decide o que mostrar
- `autoRegistrar()` — L9271 — cria/atualiza o doc do usuário no login

### Agentes de IA (cadastro — piloto híbrido humano+agente)
Identidades de IA (`kanban/squads/{squad}/dados/agentes`, por squad) que
aparecem lado a lado com pessoas nos seletores de Responsável/
Participante — `agentes` (let) — L6368 / `allIdentities()` — L6371
(combina `members`+`agentes` só pra exibição/seleção, NUNCA pra checagem
de permissão). Até 2026-08-31 só existia o listener (leitura) — pedido
direto do usuário ("quero que isso fique mais claro o cadastro"): CRUD
completo em ⚙ Configurações → Usuários → "🤖 Agentes de IA".
- `renderAgentesList()` — L19399 — lista + detecção de colisão de
  iniciais (humano×agente E agente×agente, mesmo padrão de `dupInit` em
  `renderUsuarios()`)
- `abrirAddAgente()`/`editarAgente(id)`/`fecharAddAgente()` — L19436/
  L19322/L19332 — abre/preenche/fecha o form inline (mesmo padrão de
  "+ Adicionar externo", não é modal separado)
- `salvarAgente()` — L19440 — valida nome/iniciais e colisão antes de
  gravar; `excluirAgente(id, nome)` — L19356 — usa `window._set()` direto
  (não `fbSet()`, que é fire-and-forget e engole erro em silêncio) pra
  aguardar a escrita e só avisar sucesso depois de confirmada — fix
  2026-09-01, reporte direto do usuário
- **`_fbKey`** (2026-09-01, fix de causa raiz do achado acima): o
  listener de `dados/agentes` guarda a CHAVE real do Firebase de cada
  entrada em `a._fbKey` (via `Object.entries(val)`, não mais
  `Object.values(val)`, que descartava a chave) — `editarAgente()`/
  `excluirAgente()`/a checagem de colisão em `salvarAgente()` usam
  `_fbKey`, não mais o campo `.id` gravado dentro do objeto. Motivo: dado
  cadastrado antes do CRUD existir (2026-08-31) podia ter uma chave real
  diferente do `.id` interno — excluir usando `.id` escrevia `null` num
  caminho que nunca existiu, "sucesso" sem nunca remover a entrada de
  verdade. Reeditar+salvar uma entrada legada agora também corrige seu
  `.id` pra bater com a chave (self-heal automático)
- Ligado ao Agente Ágil de verdade: ver `agenteMarcador.js` e
  `cards_por_agente` na seção `functions/` abaixo — quando o
  orquestrador muda algo num card cujo responsável/participante é um
  agente cadastrado aqui, ele mesmo posta um comentário marcando esse
  agente.
- **`agentesExternos`** (2026-09-01, pedido direto: "meu ponto com os
  agentes dentro do board é que seja esses agentes externos!") — 2º
  array de identidades selecionáveis, ao lado de `agentes` (decorativos)
  acima — carregado de `kanban/config/agentesExternos` (registro GLOBAL,
  painel.html, NÃO `FB+`), filtrado client-side pra só quem tem `init`
  preenchido E este squad marcado em `squads`. `allIdentities()`/
  `populatePartSelect()`/`populateOwnerSelect()` mesclam os dois, em
  optgroups SEPARADOS ("🤖 Agentes" vs. "🔌 Agentes Externos") — a
  diferença real: quando o orquestrador muda algo num card responsável
  de um Agente Externo, ALÉM do "📎 cc" de sempre, ele manda um POST de
  verdade pro webhook cadastrado (ver `agenteMarcador.js`,
  `functions/agente-agil-orquestrador/`). Colisão de iniciais
  (`renderAgentesList()`/`salvarAgente()`) também checa contra
  `agentesExternos` agora, nos dois sentidos.

O Agente Ágil de VERDADE (não um cadastro decorativo) também pode ser
Responsável/Participante desde 2026-08-31, nos squads `dev`+`dados`
(começou só `dados`, ampliado pra `dev` no mesmo dia — pedido direto pra
testar sem mexer em dado de squad de trabalho):
`AGENTE_AGIL_ASSIGNEE_ENTRY`/`AGENTE_AGIL_ASSIGNEE_SQUADS`
(`init:'🤖'`, mesmo valor gravado por `functions/agente-agil-
orquestrador/*.js` em todo comentário real do agente). Diferente de
`AGENTE_AGIL_MENTION_ENTRY` (L6398, só autocomplete de `@`, nunca
selecionável). `_reagirSeAgenteAgilAtribuido(c, prevOwner,
prevParticipants)` — reusa o pipeline de `@menção` já testado (posta
comentário sintético `@Agente Ágil ...`, autoria de quem atribuiu) toda
vez que o campo muda de valor pra incluir o agente; chamada em
`scheduleAutoSave()`, e nos dois branches de `saveCard()` (edição e
criação). Zero Cloud Function nova — reusa `agenteAgilMencaoDados` (já em
produção, ver seção `functions/` abaixo).

**Dispatcher único** (revisão arquitetural 2026-08-31):
`_dispatchAgenteAgilComment(cardId, text, {squads, asAutomacao,
warnIfUnavailable})` — concentra "montar o comentário sintético +
decidir uid/autoria + checar squad", antes reimplementado
independentemente em 4 lugares (`_askAgenteAgilNoCard`,
`_reagirSeAgenteAgilAtribuido`, a automação `notify_agent`, o caminho
"WIP excedido"). Ver seção "Agente Ágil (client-side...)" abaixo pra
detalhe dos 4 call sites.

### Card — estrutura & modal
- `CARD_SECTIONS` — L6305 — seções do modal (Conteúdo, Vínculos, Colaboração...)
- `openCard()` — L11445
- `openAgenteHotline()` — L11371 — card especial fixo por squad "🤖 Converse
  com o Agente Ágil" (`AGENTE_AGIL_MENTION_SQUADS`, hoje `dev`/
  `dados`, os únicos com escrita real do agente — até 2026-08-31 tinha uma
  constante própria `AGENTE_AGIL_HOTLINE_SQUADS` com o mesmo valor,
  unificada na revisão arquitetural dessa data), pra pedido solto que não
  precisa ficar ligado a um card real. É um card de VERDADE no Firebase
  (`agenteHotline:true`, criado sob demanda por `fbCreateCard`, achado via
  `_findAgenteHotlineCard()`) — reusa 100% do mecanismo de `@menção`
  existente, só some do board normal (filtro em `renderBoard()`'s
  `activeCards`) e o modal ganha tema cinza/robô + atalhos
  (`_applyAgenteHotlineSkin()` — L11347, chamado por `openCard()`/
  `openNewCard()`). `_cardSectionVisible()` esconde toda seção exceto
  comentários pra esse card. Botão de acesso: `#fab-agente-hotline-btn`,
  visível pra todo mundo (não só PO/Organizador) nos squads habilitados —
  ver `_applyRoleVisibility()`. Guard equivalente no backend:
  `functions/agente-agil-orquestrador/systemPrompt.js` (seção "Card
  especial") instrui o modelo a nunca chamar mover_coluna/editar_campos/
  checklist_item/agent_status nesse card, reconhecendo-o só pelo título.
  Modal do card hotline esconde TUDO exceto a seção de comentários (título,
  grid de atributos, conteúdo/vínculos, meta, histórico, extras de
  header/rodapé — via CSS `#card-ov.agente-hotline`, não só
  `_cardSectionVisible()`) e tem tema robô/terminal (fonte monoespaçada do
  sistema). `refreshAgenteHotline()` — logo abaixo de `openAgenteHotline()`
  — botão "🔄 Limpar conversa": apaga `card_comments/{cardId}` inteiro
  (com confirmação nativa, irreversível), já que o card é compartilhado
  entre qualquer pessoa e acumula assuntos sem relação com o tempo.
  `#m-agente-hotline-info` — bloco explicando o que o card faz + aviso de
  que cada mensagem processada consome tokens pagos (uso com moderação),
  toggled junto no mesmo `_applyAgenteHotlineSkin()`. Colapsável via
  `toggleAgenteHotlineInfo()` — mesmo padrão de `toggleHistory()`.
  Comentário já abre com `@Agente Ágil ` pré-preenchido (dentro do
  `setTimeout()` de `openCard()`, logo depois de `initMentionDropdown(
  'm-comment-inp')`, só se o campo ainda estiver vazio).
  `_attachAgenteHotlineCommentsListener()`/
  `_detachAgenteHotlineCommentsListener()` — logo acima de
  `toggleAgenteHotlineInfo()` — listener ao vivo (`window._onValue`) nos
  comentários desse card específico, pra resposta do agente aparecer sem
  sair/voltar do card (`loadComments()` normal é leitura pontual, não
  serviria); detach chamado em `_finishCloseOv()` e toda vez que
  `openCard()`/`openNewCard()` abre outro card. Comentários do card
  hotline têm tema visual de terminal (fundo escuro, mensagem do agente
  em verde vs. humana em ciano — classes `comment-agent`/`comment-human`
  em `renderCommentList()`, estilo em `#card-ov.agente-hotline`).
  Achado real 2026-08-26 (skill `/monitorarbugs`): `renderBoard()` excluía
  o card hotline dos cards ativos, mas outras 4 agregações/buscas de
  "todos os cards" não tinham essa mesma exclusão (`!c.agenteHotline`) —
  corrigido em `renderBoardDataGrid()`/`renderBoardDataInsights()`/
  `_boardDataBarChart()` (painel "📊 Dados do Board") e nas 3 buscas de
  card (`@card:` em comentários/descrição, `notaSearchCards()`,
  `searchSuperChildren()`). Qualquer nova agregação "todos os cards"
  precisa lembrar dessa exclusão também. 2ª rodada, 2026-08-28: achado o
  mesmo gap em `renderMeuDia()` (painel "🌅 Meu Dia", ver linha abaixo) —
  não tinha passado pela varredura original porque usa `_meuDiaAllCards()`
  em vez de um `cards.filter(...)` direto (não pega num grep simples do
  padrão). Hoje não é explorável pela UI normal (o card hotline nasce com
  `owner`/`participants` sempre vazios, e o modal trava a edição desses
  campos pra ele), mas ficava inconsistente com a regra escrita acima.
- `saveCard()` — L11890 — auto-save (debounce 800ms) passa por aqui
- `_finishCloseOv()` — L26544 — fechamento do modal, reset de estado pendente
- `_newCardHasContent()`/`_newCardGuardOff` — L10730/L10607 — card ainda sem
  `editingId` (criação em andamento): se título/descrição/tags/checklist/
  riscos/PO/comentário têm algo preenchido, `closeOv('card-ov')` avisa
  antes de descartar (fora, Cancelar, ✕, arrastar no mobile — os 4 já
  passavam por `closeOv`). Não conta responsável/coluna/prazo, que vêm
  com valor padrão só de abrir o modal. `_newCardGuardOff` desarma o
  aviso nos 2 pontos em que o fechamento é legítimo mesmo com
  `editingId` ainda null (sucesso de `saveCard()`, e o fechamento do
  modal reaproveitado pra editar item de Recorrente/Modelo/Agendamento)
- `_navigateToCard(cardId)`/`voltarCardAnterior()` — perto de L12061/
  L12069 — pilha `_cardNavStack` pro botão "← Voltar" (pai de supercard,
  vínculo, dependência clicados de dentro do modal já aberto). Passam
  pelo mesmo `closeOv()` acima (ganham de graça a confirmação de
  "alterações não salvas" se o card estiver sujo). **Achado real
  (2026-09-03, `/monitorarbugs` "no modal dos cards")**: toda mutação
  da pilha/flag (`_cardNavStack.push`/`.pop`, `_cardNavSkipReset=true`)
  só acontece dentro do `afterClose` passado a `closeOv()` — nunca
  antes de chamar `closeOv()` — porque `afterClose` só roda se o
  fechamento for de fato confirmado; mutar antes e a pessoa cancelar
  ("Continuar editando") deixava a pilha corrompida (entrada duplicada
  em `_navigateToCard`, nível de histórico perdido pra sempre em
  `voltarCardAnterior`) e `_cardNavSkipReset` travado em `true`, vazando
  pro PRÓXIMO card aberto por qualquer caminho normal.

### Escrita de card no Firebase — 3 primitivas (não intercambiáveis)
- `fbSaveAll()` — L7615 — reescreve `/cards` INTEIRO (só pra operações
  estruturais em lote: duplicar/arquivar em massa, reordenar, importar,
  recorrências/agendamentos) — **nunca usar pra 1 card só**, arrisca
  sobrescrever o array com o estado local de outra pessoa
- `fbCreateCard()` — L7747 — cria 1 card NOVO com escrita pontual,
  posição alocada via `transaction()` no `cards_index` (atômico contra
  criações concorrentes) — achado real 2026-08-24 (squad
  `midiacriativa`, "cards sumindo"): `fbSaveAll()` na criação
  colidia com o mesmo tipo de ação concorrente e apagava cards de
  outras pessoas. Usar sempre pra criar 1 card (modal, duplicar, filho
  de supercard, fan-out)
- `fbSaveCard()` — L7800 — edita 1 card EXISTENTE, escrita pontual
  (usada por drag-and-drop, autosave, etc.)
- **Guard `_isQLTemp`, presente nas 3** (2026-09-03,
  `/monitorarbugs` — causa real de "[card sumiu inesperadamente]"):
  todas recusam operar sobre um card com `card._isQLTemp===true` (o
  card temporário que `openQLEdit()` empurra em `cards[]` pra
  reaproveitar o modal na edição de Modelo/Recorrente/Agendamento — ver
  seção "Modal reaproveitado..." abaixo). Ponto único de defesa contra
  qualquer call site, presente ou futuro, que tente persistir esse
  objeto por engano — não precisa (e não deve) ser reproduzido call
  site por call site.

### Rede de segurança — detecção ao vivo de card sumido inesperadamente
- `_reportUnexpectedCardDisappearance()` — L7787 — dispara toast +
  `console.error` + grava `cards_incidentes_sumico/{incId}` quando um id
  some de `/cards_index` sem ter passado por `cards_deleted_intentionally`
  — "ponto 2" da rede de segurança pras ~46 chamadas de `fbSaveAll()` que
  ainda reescrevem o array inteiro (fora do escopo do fix de
  `fbCreateCard()` acima, que só cobre a CRIAÇÃO de 1 card). Não recupera
  o card — só avisa na hora, em vez de descobrir dias depois.
- `_intentionalDeleteIds` (Set) — populado por um listener `onChildAdded`
  em `cards_deleted_intentionally` — grep `_delRef` dentro de `fbLoadAll()`
  pra achar o listener; o `onChildRemoved` de `/cards_index` (mesmo escopo,
  grep `window._onChildRemoved(_idxRef`) faz um debounce de ~3s checando
  esse Set antes de chamar `_reportUnexpectedCardDisappearance()`
- Os 5 pontos reais de exclusão gravam `cards_deleted_intentionally/{id}:
  true` como `extra` na MESMA chamada `fbSaveAll()` que já fazem —
  `bulkDeleteSelected()`, `deleteCard()`, `excluirArquivado()`,
  `ctxDelete()`, e a limpeza de filhos órfãos em `_finishCloseOv()`. Grep o
  nome da função + `cards_deleted_intentionally` pra achar a linha atual
  de cada um — não repetido aqui pra não ficar obsoleto a cada edição
  nessas funções.
- **2º consumidor de `_intentionalDeleteIds`** (2026-09-03, pedido
  direto do usuário): `compararComBackup()`/`_renderComparacaoBackup()`
  (comparação com backup, ⚙ Config → Backup) passam a cruzar os cards
  ausentes do board contra esse Set — separa "sumiu sem explicação"
  (⚠, destaque, restaurar em lote) de "excluído de propósito" (🗑,
  bloco recolhido `<details>`, só restaurar 1 por 1). Helpers
  `_backupMissingUnexplained()`/`_backupMissingIntentional()`.
- `window._reconcileCardsUpdatedAtPeriodic` — L8547 — poll de 4min (rede
  de segurança contra listener ao vivo que perde um evento
  silenciosamente — achado real 2026-08-31, reunião com board espelhado:
  prioridade salva não propagou por ~20min sem nenhum sinal de conexão
  caída). Lê `cards_updated_at` (leve) e refaz o fetch completo só dos
  cards que divergem do cache local — mesma lógica de
  `_onCardsUpdatedAtLive`, só disparada por tempo. Mesmo padrão que
  `_colTagPoll` (poll de 60s pra columns/tags) já usava; cards não
  tinham essa rede apesar de mudarem bem mais. Exposta em `window` pra
  testar/disparar manualmente sem esperar o intervalo.

### ⛓ Dependências entre cards (bloqueio/ordem, não hierarquia — diferente de supercard)
- Modelo de dado: `card.dependsOn` (id de 1 card só, o "pai"/bloqueador)
  + `card.dependents` (array de ids que dependem deste) — out-degree 1,
  in-degree N, mesmo shape de árvore do supercard (`childCardIds`), só
  com nomes/direção diferentes.
- `setDependsOn(parentId)`/`unlinkDependsOn()` — perto de L28591/L28615
  — vincula/desvincula, sempre a partir do card `editingId` aberto no
  modal. `searchDependsCards(q)` — L28561 — alimenta o picker
  (`openDependsPicker()`).
- **Guard de ciclo** (2026-09-03, `/monitorarbugs`) — `_dependsDescendants(cardId)`
  (logo antes de `openDependsPicker()`) — Set com todo descendente de
  `cardId` (BFS por `dependents`). Usado em 2 pontos: `searchDependsCards()`
  tira os descendentes da lista de candidatos mostrada;
  `setDependsOn()` recusa e avisa com toast se `parentId` estiver nesse
  Set (defesa em profundidade — mesma lição do fix de cascata do
  supercard, checagem só na UI de adicionar não basta).
- `buildDepChains()`/`renderDepMap()`/`chainContains()` — perto de
  L28953+ — monta e renderiza a árvore completa (⛓ Dependências na
  toolbar); já tinham `visited` contra ciclo corrompido nos dados (não
  trava), mas o resultado ficava truncado/errado sem o guard acima.
- Diferente de 🧩 Supercard (`childCardIds`): supercard é COMPOSIÇÃO
  (nenhum filho bloqueia o outro, teto de 2 níveis); Dependências é
  BLOQUEIO/ORDEM (um card não deveria "poder" antes do outro), sem teto
  de profundidade — só o guard de ciclo acima.

### Tema (claro/escuro + 🌴 Vice City)
- `_currentTheme()` — L27838 — lê `data-theme` do `<html>`, retorna
  `'light'`/`'dark'`/`'vice'`.
- `toggleTheme()` — L27849 — alterna claro/escuro (clique no botão de
  tema). `toggleThemeVariant()` — logo abaixo — variante mais escura do
  claro (duplo-clique, só faz sentido dentro do claro).
- `toggleViceCity()` / `exitViceCity()` — L27899/próximas linhas —
  easter egg (2026-09-02, piada interna com GTA 6/Vice City): 3º tema
  escondido, ativado segurando o botão de tema por
  `VICE_LONGPRESS_MS` (`_themeBtnPointerDown()`/`_themeBtnPointerUp()`,
  logo acima) — de propósito NÃO listado como opção visível. Paleta em
  `[data-theme="vice"]` no `<style>` (perto da L448, logo depois do
  bloco `[data-theme="light"]`). Sair é sempre 1 clique/duplo-clique
  normal (`onThemeBtnClick()`/`onThemeBtnDblClick()` tratam o caso
  `_currentTheme()==='vice'` primeiro). Persistido em `localStorage`
  (`mare_theme==='vice'`), replicado no menu mobile via
  `_mobileThemeRowClick()`.
- `_applyFavicon()` (2026-09-02) — troca o `<link id="favicon-link">`
  pro `favicon-vice.png` só enquanto o Vice City está ativo, restaura
  `_faviconDefaultHref` (capturado 1x no load — `favicon.png` em
  `kanban.html`, `favicon-dev.png` em `kanban-dev.html`, arte própria
  de cada ambiente pra diferenciar no ícone instalado do celular) ao
  sair. Chamada de dentro de `_applyThemeButtonIcon()`, mesmos pontos
  que já sincronizam o ícone 🌙/☀️/🌴 do botão.
- `_recordThemeDiscovered(theme)` (2026-09-02) — grava
  `kanban/usuarios/{uid}/temasDescobertos/{dark|light|vice}:true` na
  1ª vez que a pessoa usa cada tema (guard em `localStorage`,
  `mare_theme_seen_{tema}`), consultável via console. Chamada em
  `toggleTheme()`/`toggleViceCity()` + listener de `auth-change` (cobre
  quem nunca troca de tema).

### Comunicados / Mural (popup + badge + Mural)
- `_refreshComunicados()` — L30582 — busca `kanban/comunicados`
  filtrado `ativo:true` no servidor (`query(...)`), com fallback pra
  árvore inteira se a query falhar (`_dbgTrack('comunicados_fallback', ...)`
  registra quando isso acontece de verdade — ver otimização de bytes
  2026-09-02). `_comunicadosAtivos` (popup) e `_muralTodos` (badge +
  Mural) saem os dois já filtrados por `c.ativo` na origem — nenhuma
  tela de `kanban-dev.html` mostra comunicado inativo/arquivado (isso é
  feature só do `painel.html`, pra ADM revisar).
- `COMUNICADOS_POLL_MS` — L30533 — 12min (era 3min até 2026-09-02,
  corte de bytes).

### Cabeçalho mobile — menu "⋯" (2026-09-02)
- `toggleHdMore(e)` / `closeHdMore()` / `renderHdMoreDD()` — L6063/L6071/L6074
  — no mobile (≤768px), tudo que não é essencial no topo (tema, modo de
  visualização, avatares de quem tá online, perfil/status/sair, busca) some
  da fileira de ícones e vai pro menu "⋯" (`#hd-more-btn`/`#hd-more-dd`,
  perto de `#user-badge` no HTML) — mesmo padrão de "mais opções" do
  Trello. `renderHdMoreDD()` reconstrói o conteúdo a cada abertura (mesmo
  padrão do `toggleSquadSwitcher()` logo abaixo dele no arquivo) chamando
  as MESMAS funções globais dos botões originais (`toggleTheme()`,
  `setHybridView()`, `openTeamList()`, `openStatusMenu()`, `doSignOut()`,
  `openSearch()`) — no desktop os originais continuam 100% inalterados,
  só ficam escondidos no `@media(max-width:768px)` do mobile.

### Board & render
- `renderNormal()` — L9874
- `renderRaiaOwner()` — L9932
- `renderRaiaTag()` — L9983
- `toggleRaia()` — L10262
- `passesFilter()` — L10219
- `handleDragStart/End/Over/Leave()` — L24360/L24371/L24382/L24410
- `addTouchDnD()` — L24800 — drag-and-drop por toque (mobile)
- `makeCardEl()` — L9612 — monta o HTML de um card no board (tags, badges,
  avatar, capa, ícone de pin...).
- `_sortCards()` / `_sortCardsByMode()` — L9791/L9825 — ordena os cards de
  uma coluna; `_sortCards()` resolve o pin (card fixado sempre no topo,
  ver `togglePinCard()`) por cima do resultado de `_sortCardsByMode()`
  (a lógica de ordenação de verdade — prioridade/criação/manual/etc.),
  num único ponto usado por `renderNormal()` E todas as raias.
- `togglePinCard()` — L9801 — fixa/desafixa 1 card no topo da coluna
  (2026-09-01); 1 fixado por coluna — ou 1 por coluna+submarca em squads
  com `submarcaAtivo` (2026-09-02, cada submarca fixa o seu sem
  atrapalhar as outras).
- `toggleTimelineView()`/`renderTimelineView()` (2026-09-03) — view
  alternativa ao board de colunas: lista vertical cronológica dos cards
  ATIVOS agrupados por prazo (🔴 Atrasado, um grupo por dia, 🗂 Sem prazo
  recolhido) — `boardView` (`'kanban'`|`'timeline'`) controla qual das
  duas `renderBoard()` desenha; reusa o MESMO `activeCards` (já filtrado
  por `passesFilter()`) do board normal. `#timeline-view` fica FORA de
  `#board-wrap` de propósito (esse tem `overflow-y:hidden`, pensado só
  pro scroll horizontal das colunas). Reusa as classes `.meudia-sec`/
  `.meudia-row` de "🌅 Meu Dia" (mesmo visual). **Achado real (2026-09-03,
  relato do usuário — Timeline em branco)**: esconder `#board` exige a
  classe `board-hidden` (`.board.board-hidden{display:none!important;}`,
  perto de L2180), NUNCA `style.display` direto — `.board{display:flex
  !important}` do mobile (`@media max-width:768px`, ativo também com
  DevTools ocupando metade da tela) vence qualquer inline style. E
  `.board-wrap.mode-expanded-wrap` tem `height:calc(100vh - ...)` (perto
  de L627) que reserva altura pela VIEWPORT, não pelo conteúdo — precisa
  do mesmo escape hatch `:has()` que `raia-mode` já usa (`:has(.board
  .board-hidden){display:none;}`), senão a Timeline renderiza certinho
  mas fica empurrada pra baixo de um vão vazio do tamanho de uma tela.
  **2º achado real (2026-09-03, mesmo dia, relato seguinte — grupos
  lado a lado em vez de empilhados)**: a regra `#timeline-view{...}`
  (`flex-direction:column`) tinha sumido de verdade do parser — o
  comentário logo acima usava `.meudia-sec*/.meudia-row*` como forma
  informal de citar as duas classes, mas `*/` fecha comentário CSS no
  meio da frase, virando o resto em CSS-lixo que derruba a regra
  seguinte junto. Sem `flex-direction:column`, o `display:flex` (JS)
  caía no default `row` — cada grupo (Atrasado/Hoje/cada data) virava
  uma coluna lado a lado. Só detectável escaneando
  `document.styleSheets` em runtime (a regra "parecia" certa lendo o
  texto). Cuidado ao escrever comentário CSS citando 2+ seletores
  separados por `/` — nunca deixar `*/` se formar sem querer no meio.
- `openTimelineFeed()`/`_marcosDoDia()`/`_timelineFeedRow()` (2026-09-03)
  — "📰 Feed de marcos", duplo-clique num `.meudia-sec-hd` de UM dia
  exato da Timeline (não em "Atrasado") abre `#timeline-feed-ov` com um
  feed cronológico (mais recente primeiro) do que foi executado no
  board NAQUELE DIA — cobre o board inteiro, não só o grupo clicado.
  Marcos: 🆕 criado (`card.createdAt`), 🔀 movido / 🏁 concluído (ambos de
  `card.flow.log[]`, via `_isColDone(entry.to)` pra distinguir) — mesma
  fonte de dado que já alimenta `recordMove()`/relatório de tempo,
  ZERO leitura nova no Firebase (comentários ficaram de fora do
  escopo de propósito — exigiriam buscar `card_comments` por fora).
  `_marcosDoDia()` NÃO filtra `c.archived` — é retrospecto do que
  aconteceu, um card arquivado depois do marco continua aparecendo.
- `_timelineCardRow()`/`timelineOnlyMine()`/`_hasActiveFilters()`
  (2026-09-03, pedido direto do usuário: "falta filtros... comunique
  mais com o resto do board") — 2ª rodada de UX na Timeline. Linha de
  card ganhou avatar/prioridade/🚧/🧩/tags (mesma linguagem visual de
  `makeCardEl()`, antes só título+coluna+texto); `data-id` no
  `.meudia-row` pra `highlightMyCards()` ("💡 Meus cards" da toolbar)
  também achar linhas da Timeline (antes era no-op ali — só buscava
  `.card[data-id]`). `.timeline-toolbar` (topo de `#timeline-view`):
  contagem rápida + chip "💡 Só eu" (`timelineOnlyMine()`, alterna
  `activeFilters.owner` pro usuário atual) + atalho "🔭 Filtros" que
  abre o MESMO painel `#filter-bar` do board normal — Timeline sempre
  respeitou `passesFilter()`/`activeFilters` (nada novo aí), só faltava
  um jeito óbvio de acessar/ajustar isso estando na aba. Populate dos
  `<select>` de `#filter-bar` foi extraído de `toggleFilters()` pra
  `_populateFilterSelects()` (reuso: `timelineOnlyMine()` precisa
  popular `#f-owner` ANTES de setar `.value`, senão a option ainda não
  existe e o valor não gruda). **Achado real, testado com Playwright**:
  1ª versão usava `position:sticky` no `.timeline-toolbar` pra ficar
  fixo ao rolar — não funciona neste layout (`<body>` E `<html>` têm
  `overflow-y:auto` nos dois; quem rola de verdade é `<html>`, mas
  sticky gruda no ancestral mais PRÓXIMO com overflow≠visible, que é
  `<body>` — que nunca rola de fato, então a barra sobe junto com o
  resto do conteúdo como se sticky nem existisse). Removido — `.toolbar`
  do board normal também não é sticky, mantém consistência.
- `_ownerAvatarHtml()` (2026-09-04) — avatar do responsável extraído de
  dentro de `_timelineCardRow()` pra virar reusável, quando o Feed de
  marcos (`_timelineFeedRow()`) passou a precisar do mesmo avatar.
  NÃO tocou no `avHtml` de `makeCardEl()` (card real nas colunas) de
  propósito — lógica idêntica, mas aquele é código maduro/sensível.
  `_timelineFeedRow()` ganhou avatar/prioridade/🚧/🧩/tags (mesmo padrão
  de `_timelineCardRow()`) e uma faixa colorida na lateral por tipo de
  marco (`TIMELINE_FEED_COR`: dourado=criado, azul=movido, verde/teal=
  concluído) — pedido do usuário depois de testar a v1 ("falta mexer
  aqui no 'dia'"): o ícone 🏁 (concluído) rendeiza como bandeira
  genérica em alguns ambientes/fontes (sem o padrão xadrez), fácil de
  confundir com aviso — a cor é um canal redundante que não depende do
  emoji renderizar certo. `openTimelineFeed()` ganhou um resumo por tipo
  no topo do feed (🆕 N criados · 🔀 N movidos · 🏁 N concluídos), mesma
  ideia da contagem no topo da Timeline.
- `_renderTimelineFeed()`/`_timelineFeedFilter`/`timelineFeedSetFilter()`/
  `timelineFeedToggleTipo()`/`timelineFeedToggleMine()`/
  `timelineFeedClearFilter()` (2026-09-04, pedido direto do usuário
  depois de testar a v2: "faltou na vdd colocar filtros aqui tb" →
  "subtime, usuario, tag...") — Feed de marcos ganhou filtro PRÓPRIO
  (responsável/subtime/tag/💡 só eu/tipo de marco), deliberadamente
  DESACOPLADO do `activeFilters` global do board (`_timelineFeedFilter`,
  var própria) — o feed é retrospecto do dia inteiro por design (ver
  HELP_CONTENT), reusar o filtro global faria ele encolher escondido só
  porque um filtro ficou ligado no board por outro motivo, sem aviso
  dentro do próprio modal. Reseta sozinho em todo `openTimelineFeed()`
  novo (nunca herda filtro de uma investigação anterior). Chips de tipo
  (`timelineFeedToggleTipo()`) contam sobre `todos` (não sobre o já
  filtrado) — número fica estável, só os OUTROS filtros mudam o que
  aparece embaixo. `openTimelineFeed()` virou casca fina que só guarda
  `{dateStr,labelStr}` em `_timelineFeedState` e chama
  `_renderTimelineFeed()` — necessário pra qualquer toggle de filtro
  poder re-renderizar sem precisar reabrir o modal do zero.
  `_ownerOptionsHtml(placeholder)` extraído de dentro de
  `_populateFilterSelects()` (a lógica de "junta member cadastrado +
  init solto sem cadastro") pra reusar no `<select>` de responsável
  local do feed, sem duplicar. **Cuidado se mexer nos 3 `<select>`
  (`#tf-owner`/`#tf-subteam`/`#tf-tag`)**: a opção certa é marcada via
  `.value=` DEPOIS de inserir no DOM (não via atributo `selected` na
  string) — 1ª versão tentou marcar `selected` direto na string HTML e
  o `<select>` de responsável ficava sempre mostrando o placeholder,
  mesmo com filtro ativo (a option certa nunca ganhava o atributo).
- **Buckets progressivos, ação no lugar e marcos de contexto** (2026-09-04,
  a partir de consultoria técnica externa pedida pelo usuário sobre a
  feature Timeline) — 3ª rodada de evolução da Timeline, escolhida entre
  ~10 sugestões ("os 3 que eu faria agora: buckets progressivos, ação no
  lugar, marcos de contexto"):
  - `renderTimelineView()` reescrita: em vez de 1 grupo por DIA exato a
    partir de amanhã (virava lista de cabeçalhos com 1 card cada, achado
    real do consultor), agora agrupa em faixas fixas — 🔴 Atrasado · 📅
    Hoje · 📅 Amanhã · 🗓️ Resto da semana · 🗓️ Próxima semana · ⏳ Depois ·
    🗂 Sem prazo. Semana no padrão Domingo→Sábado, igual ao Calendário
    (`_timelineFimSemana()`, nova). `_timelineLabelForDate()` (que gerava
    o rótulo por-dia) foi REMOVIDA — não sobrou call site depois da
    reescrita.
  - **Ordenação cronológica** (`ordenaCronologico`, dentro de
    `renderTimelineView()`) substitui a alfabética em todo bucket
    multi-dia — Atrasado ordena do mais antigo pro mais recente (é a
    "dívida real"), os outros por prazo crescente.
  - **Custo do atraso**: `_timelineCardRow(card, hojeStr)` ganhou o 2º
    parâmetro (breaking change no único call site, dentro da própria
    Timeline) — mostra "Nd atrasado" (vermelho) pra cards vencidos, ou a
    data explícita (ex. "23 de set.") pros buckets que cobrem vários dias.
  - **Ação no lugar** (`_timelineSetPrazoInline()`/`_timelineAdiarCard()`,
    mesmo padrão checkEditPermission+recordHistory+fbSaveCard de
    `togglePinCard()`): card sem prazo ganha `<input type=date>` inline;
    card atrasado ganha "+1d"/"+1 sem". Cards concluídos (`_isColDone`)
    não ganham ação nenhuma.
  - **✅ Concluído recente** (bucket novo, recolhido, no fim da lista):
    cards concluídos desde domingo desta semana — pedido do consultor pra
    "fechar o loop", já que Timeline só olhava pra frente (pendências) e
    o Feed de marcos só pro passado (um dia específico).
  - **🎯 Marcos de contexto** (`_timelineEventMarkerHtml()`,
    `eventosEntre()`/`eventosNoDia()` dentro de `renderTimelineView()`):
    eventos de `calEvents` (mesma fonte do "📅 Calendários", já em
    memória — zero leitura nova) aparecem como divisor fino
    (`── DD/MM · Título ──`) intercalado cronologicamente entre os cards
    de cada bucket, via `comMarcos()`. `_gcal` (espelho do Google Agenda
    PESSOAL) fica de fora de propósito — evento pessoal de alguém não é
    marco do squad, e mostrar o título pra todo mundo seria vazamento de
    agenda privada.
  - CSS: `.timeline-semprazo` renomeada pra `.timeline-collapse`
    (genérica) quando passou a servir tanto "Sem prazo" quanto "Concluído
    recente"; `.timeline-event-marker` nova (divisor de marco de
    contexto), perto de L2196.
- **📜 Histórico (dia ou período qualquer, inclusive bem no passado)**
  (2026-09-04, pedido direto do usuário: "faltou... ter uma opção de a
  pessoa setar a data (um dia ou um período)... 'o que será que a gente
  fez no dia da Básica de 2025?'") — generaliza o Feed de marcos pra
  aceitar um INTERVALO de datas, não só 1 dia exato:
  - `_marcosDoDia(dateStr)` virou `_marcosNoPeriodo(deStr, ateStr)` (de/ate
    inclusive nos dois lados; de===ate é o caso de sempre de 1 dia só).
  - `_timelineFeedState` mudou de `{dateStr,labelStr}` pra
    `{deStr,ateStr,labelStr}`; `openTimelineFeed()` mudou de assinatura
    — agora `openTimelineFeed(deStr, ateStr, labelStr)` — único call site
    (duplo-clique num dia da Timeline, dentro de `secao()` em
    `renderTimelineView()`) atualizado pra passar a mesma data duas vezes.
  - `abrirHistoricoPeriodo()` — botão novo "📜 Histórico" na barra de topo
    da Timeline (`.timeline-actions`), abre o Feed já em modo período
    (começa hoje/hoje). `_timelineFeedBuscarPeriodo()` lê `#tf-de`/`#tf-ate`
    (validando de<=ate) e re-renderiza; reseta o filtro do Feed ao trocar
    de período (mesma razão de `openTimelineFeed()` já resetar: evita
    achar que "não teve nada" quando na verdade um filtro antigo não bate
    com o período novo). `_timelinePeriodoLabel(deStr,ateStr)` calcula o
    título quando não veio um `labelStr` explícito (Hoje/Amanhã/data
    única formatada/"DD/MM a DD/MM").
  - Seletor de datas (`#tf-de`/`#tf-ate` + "🔍 Buscar") fica SEMPRE visível
    dentro de `_renderTimelineFeed()`, mesmo com 0 marcos no período atual
    — pra dar pra trocar a data e tentar de novo sem fechar o modal.
  - **Sem limite de quão pra trás dá pra buscar** — cards só saem de
    `cards` se alguém excluir de vez via "🧹 Cards antigos" →
    `purgeOldArchived()` (ação MANUAL, confirmação digitando "EXCLUIR",
    threshold padrão de 2 ANOS) ou `deleteSelectedOldCards()` — confirmado
    lendo o código antes de prometer isso no HELP_CONTENT, não assumido.
    `archived:true` sozinho (arquivamento normal/automático) NUNCA
    remove do array, só esconde do board ativo — `_marcosNoPeriodo()` já
    não filtra `archived` de propósito (herdado de `_marcosDoDia`).

### Busca (Ctrl+K + "Ver no board")
- `openSearch()` — L27062
- `renderSearchResults()` — L27074
- `verNoBoardFromSearch()` — L27141
- `_scheduleTextFilterApply()` — L10172 — debounce do filtro `#f-texto`

### Checklist (com grupos colapsáveis)
- `renderCL()` — L12416
- `_clGroupsInit()` — L12381
- `toggleChecklistGroupCollapse()` — L12394

### Campanhas (`openCamp()`, botão "📣 Campanhas")
- `renderCampDashboard()` — L17336 — aba "📊 Dados de Produção" do detalhe
  de campanha, alimentada por `window._campVinculados` (cards com a(s)
  tag(s) da campanha — setado em `renderCampDetalhe()`). Checkbox "🧩
  Incluir supercards" (estado em `window._campDashIncludeSuper`, não no
  DOM — o corpo inteiro é `innerHTML=` a cada render) — mesmo padrão já
  usado em `renderCriativosDashboard()`/`crv-df-supercard-incluir`
  (Controle de Criativos, também sem seção própria neste mapa ainda).
- (Seção nunca indexada antes — só a âncora tocada nesta rodada foi
  adicionada; o resto de `openCamp()`/`renderCampDetalhe()`/etc. ainda
  não tem entrada própria aqui.)

### Supercards / Ficha Técnica
- `_crvAutoTitle()` — L12846 — título automático do filho a partir da Ficha Técnica
- `searchSuperChildren()` — L22143 — busca de cards existentes ao criar um filho
- `_mergeModeloEmCardObj()` — L25158
- `_applyFanoutTemplate()` — L25127 — cria os filhos de uma receita de fan-out
- Nesting de 2 níveis (campanha → criativo → versão): `editingSuperParentIsChild`
  (global, L21647) + `initSuperChildren()` — L21919 — calcula se o card
  aberto já seria uma "versão" (teto real do 2º nível)
- `_crvOwnSummary()` — L22014 — resumo dos campos próprios do criativo,
  usado no card de versão (2º nível)
- `_checkSupercardAutoComplete(childCard, ancestry)` — L25676 — conclui o
  supercard sozinho quando todos os filhos ativos chegam numa coluna de
  fim; cascateia filho→pai→avô recursivamente. `_isColCancelLike()` —
  L25662, logo acima — se TODOS os filhos ativos terminaram cancelados,
  o pai NÃO conclui sozinho, fica onde está. `ancestry` (2026-09-02) —
  guard contra ciclo corrompido em `childCardIds`; Set copiado por
  chamada (não compartilhado entre irmãos, ao contrário do `visited` de
  `_duplicarComFilhos()` abaixo) — um Set global quebraria a cascata
  legítima de um card com 2 pais/avô compartilhado.
- `_duplicarComFilhos()` — L12293 — duplicar um supercard com opção de
  duplicar os filhos junto (checkbox opt-in no modal de duplicar, só
  aparece se `_cardIsSupercard()`). Recursivo (cobre netos, 3 níveis
  campanha→criativo→versão), religa `childCardIds` pros ids NOVOS, filhos
  mantêm a própria coluna (não herdam `opts.col` do card raiz), filhos
  arquivados ficam de fora, `visited` protege contra ciclo corrompido nos
  dados

### Card lock / "Pedir o card"
- `CARD_LOCK_REQUEST_GRACE_MS` — L10841
- `_cardLockRequestPath()` — L10848
- `pedirCard()` — L10858
- `liberarCardAgora()` — L10872
- `_renderLockRequestUI()` — L10876
- `_handleLockRequest()` — L10911
- `_checkCardLock(cardId)` — perto de L11688 — chamada de dentro de
  `openCard()`; lê/assina `card_locks/{cardId}` e decide travar em
  leitura ou assumir. 2 early-returns ANTES de tocar o Firebase, os dois
  achados via `/monitorarbugs` comparando o card hotline contra outros
  tipos especiais que passam pelo mesmo `openCard()`: card
  `agenteHotline` (2026-09-02, dev v8.30.543-dev — compartilhado por
  design, lock não faz sentido) e card `_isQLTemp` (2026-09-03, dev
  v8.30.565-dev — temporário/client-only de `openQLEdit()`, id nunca se
  repete, também não faz sentido travar). `_releaseCardLock(cardId)` —
  perto de L11773 — chamada por `_finishCloseOv()` (`if(editingId)`) e
  no `beforeunload`.

### Notificações in-app
- `createNotif()` — L22303
- `loadNotifs()` — L22564
- `checkDueNotifs()` — L22956 — due_today/due_overdue, 1x/dia
- `parseMentions()` — L22977 — @menção em descrição/PO/checklist/comentário;
  `@todos` (`TODOS_MENTION_ENTRY`, 2026-09-01) notifica todos os membros do
  squad de uma vez em vez de 1 pessoa.
- `mentionCandidates()`/`mentionMatchLabel()` — L6533/L6552 — autocomplete
  de @; entradas sintéticas (`init` sentinela, nunca um membro real):
  `TODOS_MENTION_ENTRY` (sempre 1ª opção) e `AGENTE_AGIL_MENTION_ENTRY`
  (só em squads com Cloud Function ouvindo).

### Notas
- `toggleNotas()` — L14965, `setNotasScope()` — L14978
- `renderNotasList()` — L15013, `createNota()` — L15045
- `openNota()`/`closeNotaEditor()` — L15062/L14915
- `renderNotaEditor()` — L15325, `toggleNotaModo()` — L15623 (livre/estruturado)
- `renderNotaLinkedCards()` — L15088, `notaSearchCards()`/`notaAddCardLink()`/`notaRemoveCardLink()` — L15140/L14984/L14993
- `renderNotasVinculadasNoCard()` — L15160 — seção "Vínculos" dentro do card

### Automações (Butler-style)
- `AUTO_TRIGGERS` — L25273 (21 triggers — `agendado_created` adicionado
  2026-08-30, par de `recorrente_created` que faltava)
- `AUTO_ACTIONS` — L25642 (15 ações — `notify_all` ["Notificar todos"]
  adicionada 2026-09-01, posta comentário `@todos` + `parseMentions()`
  manual pro fan-out de verdade, mesmo padrão de `notify_agent` mas sem
  squad-gate)
- `runAutoRules()` — L25777 — só decide QUAIS regras batem (síncrono);
  `_runAutoRuleAction()`/`AUTO_RULE_DELAY_MS` (logo acima) aplicam o efeito
  de verdade depois de ~1.2s (pedido direto: dar um respiro visual antes do
  efeito da automação, e mostrar toast "⚡ Automação ... foi aplicada" —
  antes era instantâneo e silencioso) — re-busca o card no momento de
  aplicar (guarda contra card excluído/arquivado durante o delay)
- `_autoTrigger()`/`_autoAction()` — L25436/L25177
- `_autoValLabel()`/`_autoRenderValueOptions()` — L25462/L25202
- **Acesso à tela de Automações** (achado real 2026-08-24: só existia via
  `⚙ Configurações → aba ⚡ Auto`, e o botão de Configurações fica
  escondido de quem não é PO/Organizador/ADM — `_applyRoleVisibility()`,
  L9153 — mesmo sem nenhuma trava de permissão nas ações em si) —
  `openAutoOv()` — L19167 — abre o overlay `#auto-ov` (fora de `#cfg-ov`), acessível
  tanto por um atalho em ⚡ Funções de card (`#card-fn-ov`, visível pra
  qualquer papel) quanto pela aba "⚡ Auto" em Configurações (que virou
  um redirecionamento pro mesmo overlay, não mais uma aba inline)
- `fanoutTemplates` — receitas de fan-out (supercard); `renderFanoutCfg()`
  edita, incluindo o campo `tags` por receita (`setFanoutTags()`) usado só
  pra filtrar no dropdown abaixo — não afeta os cards gerados
- `toggleFanoutApplyMenu()`/`_renderFanoutApplyList()` — dropdown "🧩
  Aplicar receita" dentro do card, com filtro por nome+tag (mesmo padrão
  de "📥 Usar modelo"/`_renderUsarModeloList()`)
- **Fila de Automações pendentes do Agente Ágil** (2026-08-29, achado real
  `/monitorarbugs`: AUTO_TRIGGERS só existe aqui no cliente — uma mutação
  do orquestrador via Admin SDK, ex. `mover_coluna`, nunca disparava
  nenhuma Automação). Backend enfileira em `kanban/squads/{squad}/dados/
  agente_pending_auto` (ver `enqueuePendingAutoFromDiff()` em
  `functions/agente-agil-orquestrador/pendingAuto.js`, chamado de dentro
  de `runWritePlan()` em `tools/realHandlers.js`) — cliente escuta com
  `window._onChildAdded` (L8816) e reivindica cada entrada via
  `window._runTransaction()` antes de processar, garantindo exatamente 1
  disparo mesmo com várias pessoas com o board aberto ao mesmo tempo.
  `_claimPendingAuto()` — L25715 / `_refreshCardFromFirebase()` — L25733
  (força `cards` a refletir o estado mais recente do card antes de rodar
  `runAutoRules()`, já que a sincronização granular normal tem debounce de
  150ms e correria o risco de ler/resalvar um snapshot desatualizado por
  cima da própria mudança que disparou o evento). `criar_card` não
  precisa desse mecanismo — nunca cria card direto, só um rascunho em
  `intake_pending` que um humano confirma pelo modal normal (mesmo
  `saveCard()` que já dispara tudo certo).

### Impedimentos (modo coluna vs. tag)
- `blockerMode` (let) — L25832 — carregado de `config/blockerMode`, `'col'`
  (default) ou `'tag'`
- `_cardIsBlocked(card)` — L25585 — fonte única de verdade pro "está
  impedido?": modo `col` → `card.col==='blocker'`; modo `tag` →
  `!!card.blocker` (ignora o campo que não é da modalidade ativa)
- `saveBlockerMode(mode)` — L25590 — acionado em ⚙ Configurações →
  Impedimentos. Achado real 2026-08-26 (squad `midiacriativa`, incidente
  em produção — 64 cards sumidos do board): agora valida ANTES de trocar
  pra `'col'` se existe uma coluna com id `blocker`; se não existir,
  bloqueia a troca com aviso em vez de deixar a squad num estado onde
  cards já impedidos ficam invisíveis
- `ctxMove(colId)`/`ctxBlock()` — L26855/L26882 — `ctxBlock()` é só
  `ctxMove('blocker')`. Mesmo incidente:
  `ctxMove()` agora aborta com aviso se `colId` não bater com nenhuma
  coluna existente, em vez de gravar um `card.col` órfão —
  `renderNormal()` só mostra um card na coluna cujo id bate exatamente
  com `card.col`, então um id órfão faz o card sumir do board inteiro,
  intacto mas invisível (achável só via painel)
- Menu de contexto do card (`showCtxMenu()` — L26663) — 2026-09-01,
  pedido direto ("mudar prioridade e mudar coluna... deveria abrir a
  lista pro lado pra n ficar mt grande", comparando com o submenu do
  Windows Explorer): "Mover para" e "Prioridade" viraram flyouts em vez
  de listas soltas ocupando a metade do menu. `toggleCtxSubmenu(ev,key)`
  — L26788 — abre/fecha `#ctx-submenu-fly`, elemento ÚNICO e
  INDEPENDENTE (irmão de `#ctx-menu`, não filho — `.ctx-menu` tem
  `overflow-x:hidden`, que corta um filho `position:absolute` que vaza
  da caixa do pai, mesmo com z-index maior; achado só ao tirar
  screenshot de verdade, não bastava checar a classe `.open` via JS),
  reposicionado via JS a cada clique com flip pra esquerda perto da
  borda direita. Conteúdo de cada flyout fica em `_ctxSubmenus.mover`/
  `_ctxSubmenus.prioridade` (preenchido por `showCtxMenu()`). CSS
  reaproveita `.ctx-sub`/`.ctx-submenu`, que já existiam no arquivo mas
  nunca tinham sido usadas em HTML/JS nenhum — sobra de uma feature
  começada e abandonada antes. `hideCtxMenu()` — L26812 — também fecha
  o flyout agora. `ctxCopyLink(cardId)` — L26924 — item novo "🔗 Copiar
  link do card", mesma URL de `shareCardLink()` (botão do modal) mas sem
  precisar abrir o card primeiro — `_cardShareUrl()` ganhou um `cardId`
  opcional (antes só funcionava com `editingId`, o card do modal
  aberto).
- `_doBulkBlockCol()`/`_doBulkUnblockCol(colId)` — L6734/L6756 —
  versões em massa do mesmo par; `_doBulkBlockCol()` ganhou o mesmo
  guard de existência da coluna
- `delColumn(i)` — L19118 — editor de colunas em ⚙ Configurações.
  Bloqueia incondicionalmente excluir a coluna com id `blocker` (não só
  quando `blockerMode==='col'` — cards antigos podem carregar esse id
  independente do modo atual da squad; excluir a coluna em modo `tag` e
  só voltar pra `col` depois já causou o incidente uma 2ª vez)
- Ação de Automação "Mover card para coluna" (`AUTO_ACTIONS`, ver seção
  Automações acima) tem o mesmo guard de existência de coluna
- `_meuDiaIsBlocked(card)` — L17374 (dentro da seção "Meu Dia", ver
  `renderMeuDia()`/`_meuDiaCrossData` acima) — achado real 2026-08-28
  (`/monitorarbugs`): checava `card.blocker===true || card.col==='blocker'`
  incondicionalmente, dando falso-positivo pra squads em modo `col` com
  cards que ainda carregavam `blocker:true` de um período anterior em modo
  `tag`. Agora despacha por `blockerMode` de cada squad (ativo via
  `blockerMode` live; cruzado via `_meuDiaCrossData[sq].blockerMode`, que
  vem de graça do mesmo fetch de `/dados` que já trazia `doneCols`) —
  mesmo padrão de `_cardIsBlocked()`/`_meuDiaIsDone()`
- **Desimpede sozinho ao concluir** (`recordMove()`, ver Board & render —
  2026-09-04, pedido direto do usuário: "regra geral, para todos os
  boards... se o card está concluido, automaticamente ele é
  desimpedido!"). Só modo `tag` (modo `col` já resolve isso sozinho — 1
  card, 1 coluna por vez). Implementado DENTRO de `recordMove()`, não em
  cada função de mover card — é o único ponto por onde toda movimentação
  passa (drag `handleDrop()`, `ctxMove()`, dropdown do modal, ações em
  massa `_doBulkMove()`, criação de card), então corrige 1 vez, não N.
  Guard `from!==toCol` evita disparar na criação do card (`recordMove(novo,
  novo.col)` chega com from===toCol, sem transição de verdade) — sem esse
  guard, todo card novo criado direto numa coluna de Concluído (raro, mas
  possível via duplicar/recorrente) apagaria um `blocker:true` que nunca
  chegou a significar nada real. Mesmos campos/mensagem que
  `_doBulkUnblockTag()` já usa (`blocker=false`, `blockerReason=''`,
  `recordHistory('impedimento removido automaticamente (card
  concluído)')`) — fica indistinguível de uma remoção manual no histórico.
  **Limitações conhecidas, não resolvidas nesta rodada**: (1) NÃO
  retroativo — um card que já estava Concluído+impedido ANTES desta
  mudança só se corrige na PRÓXIMA vez que for movido de coluna de
  verdade (recordMove() com `from!==toCol`), não numa varredura automática
  do board existente; (2) o Agente Ágil move cards via Cloud Function
  (`functions/agente-agil/board.js` → `mover_coluna`), um caminho
  server-side que NÃO passa por este `recordMove()` do cliente nem tem
  lógica equivalente — confirmado grepando `blocker` nesse arquivo (zero
  ocorrências). Uma movimentação feita pelo Agente Ágil pra uma coluna de
  Concluído não desimpede o card sozinha ainda.
- **`recordMove()` — bug real do `from` em card recém-criado** (achado
  2026-09-04, relato do usuário vendo o próprio Feed de marcos que saiu
  nesta mesma sessão: "como é isso foi movido dentro da propria coluna?
  kkkk", print mostrando "moveu de A Fazer → A Fazer"). Causa raiz: TODA
  criação de card chama `recordMove(novo, novo.col)` — `novo.col` já
  vem setado no literal do objeto, ANTES dessa chamada, e `card.
  _lastFlowCol` também não existe ainda (card acabou de nascer) — o
  fallback antigo `card._lastFlowCol!=null ? ... : (card.col||null)`
  pegava esse MESMO valor já mutado como "coluna de origem", fazendo
  `from===toCol` sempre, pra TODO card novo, desde que a função existe.
  Como `card.flow.enteredAt[toCol]` também não existia ainda (flow
  acabou de ser inicializado 2 linhas acima), o guard de "sem transição
  real" (`if(from===toCol && enteredAt[toCol]) return;`) não disparava,
  e o código caía na criação do log — empurrando `{from:toCol, to:toCol}`
  em vez do esperado `{from:'—', to:toCol}` (o sentinel de criação).
  Bug **antigo, sempre existiu** — só ficou visível agora porque o Feed
  de marcos (lançado nesta mesma semana) é a primeira tela que expõe
  `flow.log` direto pra um humano; ninguém tinha como notar antes.
  **Fix**: `isNewFlow = !card.flow` (checado ANTES de inicializar
  `card.flow` — único jeito confiável de saber "isto é criação de
  verdade", já que `card.col` não é confiável nesse momento específico)
  força `from=null` (→ `'—'`) em vez de adivinhar a partir de `card.col`.
  **Achado irmão no mesmo mergulho**: a ação de Automação "Mover card
  para coluna" (`AUTO_ACTIONS`, `key:'move_card'`, ~L27178) mudava
  `card.col` DIRETO, sem NUNCA chamar `recordMove()` — movimentos feitos
  por essa automação eram invisíveis pro Timeline/Feed/relatório de
  tempo por coluna (sem erro, sem aviso, o card simplesmente não
  aparecia nessas telas). Corrigido no mesmo commit — a ação agora chama
  `recordMove(card, rule.actionVal)` antes de `recordHistory()`.
  **2ª rodada (mesmo dia, usuário testou em dev e ainda via o bug, com
  force refresh)**: o fix acima em `recordMove()` só evita entradas NOVAS
  — não reescreve o que já estava salvo no Firebase (cards criados ANTES
  do fix já carregavam a entrada `{from:X, to:X}` pra sempre em
  `flow.log`). Filtro defensivo adicionado direto em `_marcosNoPeriodo()`
  (`if(entry.from===entry.to) return;`, independente do índice — cobre
  tanto a entrada de criação quanto qualquer outra que porventura tenha o
  mesmo problema): "moveu de X pra X" nunca é um marco real, então nunca
  deveria aparecer no feed, seja qual for a origem do dado. Resolve o
  sintoma pra dados JÁ existentes sem precisar de migração/varredura no
  Firebase — o `recordMove()` mais robusto evita que o problema cresça.
- **📰 Feed de marcos — 4 tipos novos: prioridade/impedido/desimpedido/
  checklist completo** (2026-09-04, pedido direto do usuário: "tem nesse
  historico tb a alteração de prioridade? colocaria isso! colocaria tb
  cards marcado/desmarcado como impedimentos; cards com checklist 100%
  concluido"). `_marcosNoPeriodo()` ganhou uma 2ª fonte, além de
  `createdAt`/`flow.log`: varre `card.history[]` (já carregado com o
  card, `recordHistory()`/`_histDiff()`, zero leitura nova) procurando 3
  padrões de texto:
  - `/^(alterou|definiu) prioridade/` → tipo `prioridade` (🎚️, `#ff9800`)
  - `/^marcou como impedido/` → tipo `impedido` (🚧, `#ff6b6b`, mesma cor
    do badge de impedimento no card)
  - `/^removeu (o )?impedimento/` OU `/^impedimento removido
    automaticamente/` → tipo `desimpedido` (🔓, `#4ade80`) — cobre tanto a
    remoção manual quanto a automática (ver "Desimpede sozinho ao
    concluir" acima, mesmo dia/sessão)
  - regex `/checklist.*?(\d+)\/(\d+)/` extrai nd/nt de
    `"atualizou o checklist (nd/nt)"`/`"checklist: nd/nt concluídos"`
    (as 2 únicas frases que `_histDiff()`/Agente Ágil geram pra
    checklist) — `nd===nt>0` → tipo `checklist` (💯, `#a78bfa`). Como
    `_histDiff()` só grava entrada de checklist quando o progresso
    MUDOU (não a cada render), todo "nd===nt" achado aqui já é uma
    transição de verdade pra 100%, não precisa comparar com o estado
    anterior separadamente.
  - `m.texto` guarda o `h.what` ORIGINAL (já pronto, gerado por quem
    disparou o `recordHistory()`) — `_timelineFeedRow()` só prefixa com
    o título do card, sem reconstruir a frase.
  `_timelineFeedFilter.tipos`/`TIMELINE_FEED_COR`/chips de
  `_renderTimelineFeed()` (declarados em 2 lugares — `let
  _timelineFeedFilter=...` e `_timelineFeedResetFilter()`) expandidos
  pros 4 tipos novos, mesmo padrão dos 3 já existentes (criado/movido/
  concluido) — nenhuma lógica de filtro/toggle nova, só mais chaves.

### ⏸ Pausar card (tempo/métricas — 2026-09-03)
- `togglePauseCard()`/`_renderPauseBtn()`/`_cardPausedMs()` — perto de
  L13106 — botão "⏸ Pausar"/"▶ Retomar" no rodapé do modal (`#btn-pause-
  card`). Diferente de 🚧 Impedimento (visível pra todo mundo, tag/coluna
  própria): pausar é discreto, só o botão e o 📜 Histórico revelam.
- Modelo de dado: `card.paused` (bool) + `card.pausedAt` (ISO, pausa
  ATUAL em andamento) + `card.pausedMs` (acumulado de pausas já
  encerradas). `_cardPausedMs(c)` soma os dois.
- `_cardTempos()` (relatório de tempo/cycle/lead, perto de L17101)
  subtrai `_cardPausedMs(c)` do tempo decorrido (lead E cycle), com
  clamp em 0. Réplica deliberada em `functions/agente-agil-orquestrador/
  tools/visaoBoard.js` (`cardPausedMs()`/`cardTempos()`) — mesma
  duplicação já documentada nesse arquivo (kanban.html sem `<script
  src>` externo, Cloud Function CommonJS) — sem essa réplica, `visao_
  board` (usado pelo orquestrador e por `analisePO.js`) ficaria
  divergente do relatório client-side pra um card pausado.
- Visibilidade do botão: escondido em `openNewCard()` (pausar só faz
  sentido pra card já existente, com cycle/lead já em andamento).

### Padrões de card (cardPatterns) — never indexado antes desta rodada
Presets de campos/seções (`config/cardPatterns`, editor em ⚙ Configurações)
aplicáveis a um card via `setCardPattern()`; 3 bugs reais achados aqui em
dias recentes (#589/#590/#600/#605, todos `/monitorarbugs`), sempre a
mesma classe de problema — um dos 5-6 pontos que mexem no padrão ficando
pra trás de um comportamento que os outros já tinham.
- `criarPadraoCard()`/`renomearPadraoCard(id)`/`definirPadraoDefault(id)`/
  `excluirPadraoCard(id)` — L19597/L19608/L19618/L19627 — as 4 gravam
  direto em `config/cardPatterns` (`fbSet`), sem tocar um card já aberto
  na hora (dependiam só do round-trip do listener até o fix abaixo)
- `togglePadraoSecao(id, key, visible)` — L19637 — única das 5 que já
  atualizava o card aberto na hora, via `_applyCardSectionsVisibility()`
- `setCardPattern(patId)` — L19662 — aplica o padrão ao card (chamado na
  criação E na edição)
- `_refreshOpenCardPattern()` — L19841 (achado 2026-08-30, PR #605) —
  helper que replica o par `populateCardPatternSelect()` +
  `_applyCardSectionsVisibility()` que o `fbListen` de `config/
  cardPatterns` já fazia; chamado agora pelas 4 funções do 1º bullet, pra
  fechar a mesma janela de inconsistência visual que só `togglePadraoSecao`
  corrigia (alcançável de verdade: `mnavGo('cfg')` no nav mobile abre
  Configurações sem fechar um card já aberto)
- `_applyCardSectionsVisibility()` — L6350 / `populateCardPatternSelect()`
  — L19649
- `setCardCover(colorId)` — L6216 (achado 2026-08-29, PR #600): branch de
  card NOVO (`!editingId`) não disparava `runAutoRules('cover_set', ...)`
  — só o branch de card existente chamava; mesma classe de bug em
  `setCardPattern()`/`saveCard()` (branch de criação) pra `padrao_set`/
  `tag_added`/`submarca_set` — trigger de Automação dispara certinho numa
  EDIÇÃO do campo, mas não disparava quando o card já nascia com o campo
  preenchido no 1º Salvar. Fix: as 3 chamadas de `runAutoRules()`
  correspondentes adicionadas no branch de criação de `saveCard()`.

### Agente Ágil (client-side — atalhos que postam @menção real)
- `AGENTE_AGIL_MENTION_SQUADS` — L6405 — squads onde os atalhos abaixo
  estão ativos: `'dev'` e `'dados'` (2026-08-24) — precisa ter uma Cloud
  Function de verdade escutando o squad (ver seção `agente-agil-
  orquestrador/` abaixo), senão a sugestão aparece sem nada escutando.
  Até 2026-08-31 o botão hotline usava uma 2ª constante própria
  (`AGENTE_AGIL_HOTLINE_SQUADS`, mesmo valor) — unificada nesta, ver
  seção "Agentes de IA" mais acima.
- `_dispatchAgenteAgilComment(cardId, text, {squads, asAutomacao,
  warnIfUnavailable})` — dispatcher único (revisão arquitetural
  2026-08-31) pra "postar comentário sintético `@Agente Ágil`" — todos os
  4 producers abaixo passam por aqui em vez de montar o comentário cada
  um por conta própria:
  - `_askAgenteAgilNoCard(card, pergunta)` — posta `@Agente Ágil
    <pergunta>` com autoria de quem perguntou, `warnIfUnavailable:true`
    (ação direta de clique, mostra toast se o squad não tiver o gatilho)
  - `_reagirSeAgenteAgilAtribuido` (ver seção "Agentes de IA" acima) —
    `squads: AGENTE_AGIL_ASSIGNEE_SQUADS` (`dev`+`dados`)
  - Automação `notify_agent.run()` — `asAutomacao:true`
    (`uid:'automacao'`, NUNCA `'agente-agil'` — mentionTrigger.js
    ignoraria como auto-comentário do próprio agente)
  - Caminho "WIP excedido" (`tab==='auto'`, dentro de `runAutoRules()`) —
    mesma coisa, fora do loop por-card porque WIP é agregado do board
    inteiro
- **Indicador "🤖 pensando..."** (2026-09-01) — `_startAgenteAgilThinking()`/
  `_stopAgenteAgilThinking()` — L6516/L6536 — estado efêmero client-side
  (`window._agenteAgilThinking`, não persistido) enquanto uma @menção real
  aguarda resposta; abre um listener TEMPORÁRIO em `card_comments`
  (mesma técnica de `_attachAgenteHotlineCommentsListener`, sem duplicar
  pro card hotline) que se auto-encerra ao ver um comentário
  `uid==='agente-agil'`, ou por timeout de 120s. `_updateAgenteThinkingBanner()`
  — L6543 — atualiza o banner `#m-agente-thinking` no modal;
  `_textMencionaAgenteAgil()` — L6553 — detecta @menção real (mesmo
  critério do backend) num comentário digitado à mão em `submitComment()`
  (chamada síncrona de `_dispatchAgenteAgilComment()` não precisa dessa
  detecção — todo call site dela já posta `@Agente Ágil` literal). Chip
  correspondente em `makeCardEl()` (board) e banner dentro do modal.
- `insightsCard()` — L14285 — botão "🤖 Insights" no rodapé do card
- `ctxInsights()` — L26172 — opção "Insights" no menu de contexto do card
- `_pedirResumoMeuDia()` — L17637 — botão "🤖 Resumo do Agente Ágil"
  dentro do painel "🌅 Meu Dia" (`openMeuDia()` L17390/`renderMeuDia()`
  L17416) — chama `agenteAgilResumoMeuDia` (onRequest, ver seção
  `agente-agil-orquestrador/` abaixo) com `Bearer <idToken>`, mostra o
  texto retornado numa caixinha (`#meudia-resumo-box`). Único ponto do
  Agente Ágil que NÃO escreve nada no board — só lê e mostra texto
- `_pedirAnaliseDados(contexto, resumo, btnId, boxId)` (2026-09-01) —
  botão "🤖 Ponto de vista do Agente Ágil" — mesmo padrão de
  `_pedirResumoMeuDia()` acima, mas compartilhado por DOIS painéis:
  `renderBoardDataInsights()` (aba Insights de "📊 Dados do Board",
  `window._bdInsightsResumoCache`) e `renderCriativosDashboard()`
  (`window._criativosResumoCache`) — cada um monta o próprio resumo a
  partir dos números que já calcula pra desenhar a tela (não recalcula
  nada à parte) e passa `contexto` (`'board_insights'`|`'criativos'`)
  pra escolher o prompt certo no backend (`agenteAgilAnaliseDados`, ver
  `analiseDados.js` na seção `agente-agil-orquestrador/` abaixo). Gate
  de squad: `AGENTE_AGIL_ANALISE_DADOS_SQUADS` (`dev`+`dados`, constante
  própria mesmo tendo o mesmo valor de `AGENTE_AGIL_MENTION_SQUADS`)
- `_pedirAnalisePO()` (2026-09-01) — botão "🤖 Análise do board (PO)"
  dentro do painel "🌅 Meu Dia" (`#meudia-po-btn`/`#meudia-po-box`) —
  chama `agenteAgilAnalisePO` (ver `analisePO.js` na seção
  `agente-agil-orquestrador/` abaixo) só com `{squadId: ACTIVE_SQUAD}`,
  sem mandar nenhum resumo (backend lê tudo sozinho). Visibilidade
  gatilhada em `openMeuDia()`:
  `AGENTE_AGIL_ANALISE_PO_SQUADS.has(ACTIVE_SQUAD) && _isPOorOrg()` —
  único dos botões de análise restrito por papel (PO/Organizador/ADM),
  os outros dois (`_pedirResumoMeuDia()`/`_pedirAnaliseDados()`) são
  abertos a qualquer membro do squad
- Painel de chat antigo (`openAgent()`/`qa()`, `AGENTE_AGIL_ATIVO`) — os 2
  botões de entrada (FAB, nav mobile) foram removidos de vez (2026-08-25,
  pedido direto do usuário — "já morreu"), já que dependia de um Worker
  externo fora do ar. `openAgent()`/`#ag-ov`/`AGENTE_AGIL_ATIVO` seguem no
  arquivo (inacessíveis pela UI agora) por causa dos outros 2 pontos que
  ainda chamam `openAgent()` sem card real (AutoLab, alerta de WIP
  excedido) — não removidos nesta rodada, fora do escopo pedido
- `renderAgenteLog()` — L19114 — aba "🤖 Histórico do Agente" em
  ⚙ Configurações (pedido direto: "quero uma area q guarde todas as
  alterações nos cards que ele faça naquela squad, para servir de
  historico para o PO"). Leitura pontual (`window._get`, não um listener
  ao vivo) de `FB+'/agente_log'`, escrito pelo backend em
  `functions/agente-agil-orquestrador/agenteLog.js` (ver seção
  `agente-agil-orquestrador/` abaixo) — cada entrada já vem com `origem`
  (`mencao`/`automacao`/`especialista`, 2026-08-27 — antes disso só
  `autonomous` binário, achado real via `/monitorarbugs` no mesmo dia
  que `especialista` passou a existir: exibia "pediu via menção" pra
  ações vindas de especialista externo) e a lista de ações em português
  simples. Aba só aparece pra squads com escrita real do orquestrador
  (`AGENTE_AGIL_MENTION_SQUADS`, gate em `openCfg()` — L19061);
  Configurações inteiro já é PO/Organizador/ADM-only (`#fab-cfg-btn`, ver
  `_applyRoleVisibility()`), não precisa de
  gate de papel próprio aqui.

### Externos / segurança
- `_extKey()` — L28540 — chave de e-mail sanitizada (`.` → `,`)
- `salvarExterno()` — L28541

### Intake (pedidos pendentes — formulário público E `criar_card` do Agente Ágil)
- `renderIntakeBody()` — L17688 — lista de `intakePendentes`
  (`_intakeBucket`, alimentado por listeners granulares em
  `intake_pending`, ver comentário na declaração). 2026-08-27: mostra
  `🤖` no título + linha "🏷 Submarca sugerida" quando o item veio do
  `criar_card` do Agente Ágil (campos `origem`/`submarca`, ver
  `functions/agente-agil-orquestrador/tools/criarCard.js`) — antes
  desses campos existirem, a tela só sabia renderizar pedidos do
  formulário público.
- `_intakeCriarCard(id)` — L17563 — abre o modal de novo card pré-
  preenchido; casa `squadDemandante` E (2026-08-27) `submarca` contra
  tags reais por label (case/acento-insensitive, `_norm()`), pré-
  marcando a tag — mesmo cuidado do bugfix de "usar modelo" (saveCard()
  valida submarca lendo o VALOR do `<select id="m-submarca">`, não
  `editingTags`, então os dois precisam ser setados).

### Backup
- `exportBackupJSON()` — L28642
- `maybeSnapshot()` — L10504
- `_applyRestorePayload(payload)` — L28877 — "🧯 Restaurar backup". Achado
  real 2026-08-28 (squad midiacriativa, `/monitorarbugs`): era a ÚNICA
  atribuição de `cards`/`columns`/`tags` a partir de dado externo no
  arquivo sem `.filter(Boolean)` (as 6 outras, todas `fbListen`/`fbGet` de
  `/columns`, filtram) — um backup com entrada nula em `columns` (ex.: o
  `weeklyBackup.js` abaixo, que lia o node cru via Admin SDK) propagava a
  sujeira pro estado ao vivo, travando `renderNormal()`/`renderColEditor()`
  (`col.name`/`col.id` de undefined). Agora normaliza igual ao client
  (`Array.isArray?:Object.values`, depois `filter(Boolean)`)

### Marcadores `// --- X ---` já existentes no código
Só existem para um subconjunto pequeno de áreas — não é uma convenção
aplicada no arquivo inteiro, não confie neles como única forma de navegar:
- L19011 Ágil, L19096 Col editor, L19154 Usuários, L19339 Tags,
  L19738 "Worker / Firebase" (nome do comentário é antigo — hoje é
  config/legado de Firebase, **não** tem relação com o Cloudflare Worker,
  que não existe mais na arquitetura atual)
- L24290 D&D das colunas, L24359 D&D dos cards

## painel.html (prod — painel-dev.html diverge, confira com `diff` antes de assumir paridade)

### Aba "🛤️ Timeline" (2026-09-04, só painel-dev.html v3.11-dev por enquanto — não promovida pra prod)
Timeline agregada cross-squad, versão do painel da Timeline que já existe
em `kanban.html` (ver seção correspondente no `CODE_MAP.md` de lá) —
mesmos buckets progressivos, mas somando cards de TODAS as squads visíveis
de uma vez. `renderPainelTimeline()`/`_painelTimelineRow()`/
`_painelTimelineFimSemana()`, logo antes de `renderTrend()`. Chamada em
2 lugares: `swPtab()` (troca pra aba `timeline`) e `renderAll()` (a cada
poll de 60s). Tab `#ptab-timeline`/pane `#ppane-timeline` (entre Fluxo e
Pessoas), stats em `#pt-stats`, buckets em `#pt-buckets`.
- **Reaproveita 100% o filtro de squad/gerência já global** (`activeFilter`/
  `squadVisible()`, aba 👁 Visão) — não duplica UI de filtro, mesmo padrão
  que `renderBlockers()` já segue nas outras abas.
- **Zero leitura nova** — usa o `squadData` já carregado pelo polling de
  60s (`POLL_MS`/`_applySquadDados()`).
- Clique no card chama `openPcModal(squadId,cardId)` (o modal read-only +
  link-out já existente) — sem edição inline.
- "Concluído" usa a mesma simplificação `c.col==='done'` que o resto do
  painel usa (`renderSquadCards`/`renderColDist`/etc.) — painel nunca
  busca `flowConfig` por squad, não introduz um 2º conceito de "done" só
  pra esta aba.
- v1 deliberadamente sem "ação no lugar" (editar prazo inline), sem
  marcos de contexto (eventos de calendário) e sem 📰 Feed de marcos —
  todos presentes na Timeline do `kanban-dev.html`, possíveis evoluções
  futuras desta aba.

### Tema claro/escuro/🌴 Vice City (2026-09-03, presente nos dois arquivos — promovido pra prod v3.08)
Porta do mecanismo de tema do `kanban-dev.html` — os 3 temas, sem a
variante B do claro (duplo-clique) do kanban, que o painel não tem.
`toggleTheme()`/`_currentTheme()`/`_applyThemeButtonIcon()`/
`toggleViceCity()`/`exitViceCity()`/`_themeBtnPointerDown()`/
`_themeBtnPointerUp()` — perto do início do `<script>` principal, logo
antes do bloco `🔬 DEBUG: medidor de bytes`. Botão `#theme-toggle-btn`
no cabeçalho, ao lado do "🔄 Atualizar" — clique alterna claro/escuro,
segurar por `VICE_LONGPRESS_MS` (1,2s) entra no Vice City. CSS:
`:root[data-theme="light"]`/`:root[data-theme="vice"]` +
`[data-theme="X"] .ocean` logo após o `:root{}` base. Mesma chave de
localStorage (`mare_theme`) que o `kanban-dev.html` usa — preferência
compartilhada entre as duas páginas no mesmo domínio. Variáveis novas,
todas mesmo padrão `--surface-rgb`/`--surface2-rgb` do kanban (RGB puro,
combinado com `rgba(var(--x-rgb),alpha)` no lugar de um valor fixo, pra
não precisar de uma regra `[data-theme="X"]` dedicada por seletor):
`--deep-rgb` (usada por `.login-ov`), `--ink-rgb` (era `rgba(3,13,26,...)`
hardcoded, ~80 lugares — inputs/selects/chips/linhas de lista/
`.err-log-item`) e `--slate-rgb` (era `rgba(10,30,55,...)`, ~20 lugares —
`.status-card` e painéis maiores). As duas últimas foram achado real de
2026-09-03 (print do usuário: "esse azul acinzentado ficou ruim! pouca
leitura") — cobrem a maioria da UI, mas não as cores de overlay/modal
flutuante (`rgba(6,26,46,...)`/`rgba(8,22,42,...)`/`rgba(1,8,16,...)` e
variações), que continuam hardcoded — próxima rodada de contraste, se
necessário. Sem favicon próprio do Vice City (painel usa favicon de
emoji via data-URI, não arquivo `.png` como o kanban) — fora de escopo.

**Achados incidentais da promoção pra prod (v3.08 · painel, 2026-09-03)**,
divergência real e pré-existente entre os 2 arquivos (não causada por
esta feature, só descoberta ao promovê-la): `painel.html` tem
`_pushHistReenviar()`/"🔔 Enviar push manual" e
`VISIBILITY_REFRESH_COOLDOWN_MS` (cooldown de 3min pro refresh ao voltar
a aba) que `painel-dev.html` nunca recebeu; `painel-dev.html` tem o
banner de auto-update por polling de `version.json` (`_auCheckVersion()`)
que `painel.html` **nunca teve** — diferente do que o "Release process"
do `CLAUDE.md` descreve como padrão. Nenhum dos 3 foi tocado nesta
promoção (fora de escopo do pedido) — sinalizado aqui pra quem for
reconciliar o painel algum dia.

### Visualizador externo (2026-08-27, promovido pra prod 2026-08-28 — presente nos dois arquivos)
- `_finishPainelLogin(user)`/`_painelViewerKey(email)` — dentro do
  listener `auth-change` (perto de `doSignIn()`/`isAdmUser()`) — pedido
  direto: dar acesso de SÓ LEITURA ao painel pra alguém fora de
  `@ciahering.com.br`. Novo node `kanban/painel_viewers/{emailKey}`
  (whitelist, mesmo padrão de `externos` do kanban) — segurança de
  verdade fica em `database.rules.json` (write nunca libera pra quem
  não é `@ciahering.com.br`, em nenhum node do painel; visualizador só
  ganha exceção de READ nos nodes que o painel lê: `painel`,
  `squads_meta`, `config`, `feedback`, e por squad — `dados`,
  `presence`, `snapshots`, `error_logs`, `error_stats`, `agent_usage`).
- `window._isPainelViewer` / `_blockIfPainelViewer()` — flag + guard
  chamado no topo de toda função que abre modal de edição (`openCfg`,
  `openComunicadoCompose`, `openCampEdit`, `openPevModal`,
  `openGlobalBackup`, `openBoardSetup`, `openGlobalUsersModal`,
  `openPainelCampMsEdit`) — mostra toast em vez de abrir. CSS
  `body.painel-viewer-mode` esconde `.hd-btn-adm`/`[data-sqid]` (botões
  de admin do header + ⚙ Config de cada squad).
- `renderPainelViewers()`/`addPainelViewer()`/`removePainelViewer()` —
  gestão da whitelist, dentro da aba "🔑 ADMs" de `openCfg()` (seção
  "👁 Visualizadores externos do painel").
- Limitação conhecida: `openPevModal` (evento do calendário) é sempre
  um formulário editável, mesmo pra só VER um evento existente —
  bloqueá-lo pro visualizador também tira a visão de detalhe de um
  evento específico (a grade do calendário continua visível). Não
  corrigido — sinalizado no `CHANGELOG.md`.

### Agentes Externos (2026-08-28/29, presente em painel.html e painel-dev.html;
linhas abaixo são de painel-dev.html)
Registro global (não mais por squad) de sistemas externos que mandam
mensagens pro Agente Ágil via API — ADM/PO documenta o que cada um faz
e em quais squads a descrição vale. Migrado pra cá a partir de uma
versão anterior por squad dentro do próprio kanban.html/kanban-dev.html
(removida na mesma migração — pedido direto: "tem q ter uma area no
painel de configuração desses agentes plugados! listar todos eles...
setar em quais squads ele vai ficar"). Lido pelo backend em
`kanban/config/agentesExternos/{especialista}` — ver
`lerDescricaoEspecialista()` na seção "Cloud Functions" abaixo.
- `loadAgentesExternosPainel()` — L6804 — registra o listener em
  `kanban/config/agentesExternos`, chamado no boot (`fb-ready`).
- `renderAgentesExternosPainel()` — L6816 — lista expansível, agora
  dentro da aba própria "🤖 Agentes" (`ppane-agentes`, ver seção "Aba
  Agentes" abaixo — MOVIDA de dentro de `openCfg()`/`#cfg-ov` em
  2026-09-01, era dado GLOBAL vivendo dentro de um modal por squad);
  cada item mostra descrição (textarea) + chips de squad (`SQUADS`,
  checkbox por squad). Ganhou também um campo "🔗 Webhook de retorno"
  (`webhookUrl`, 2026-08-31 — ver entrada própria abaixo).
- `criarAgenteExternoPainel()` — L6862 / `salvarAgenteExternoPainel(id)`
  — L6885 / `toggleAgenteExternoSquad(id,squadId,checked)` — L6906
  (grava na hora, sem precisar de "Salvar") / `excluirAgenteExternoPainel(id)`
  — L6919. Todas as escritas gateadas por `_isAdmPainel()`. As duas do
  meio leem fresco do Firebase (`window._get`) antes de mesclar/escrever
  — achado real `/monitorarbugs` (2026-08-29): sem isso, marcar 2 squads
  em sequência rápida no mesmo agente podia apagar a 1ª marcação
  silenciosamente (corrida contra o cache local desatualizado).
- **Webhook de retorno** (2026-08-31, pedido direto do usuário, testando
  `notificar_especialista_externo` — ver seção `functions/` abaixo) —
  campo `webhookUrl` em `kanban/config/agentesExternos/{especialista}`,
  URL que recebe um POST quando o Agente Ágil decide mandar uma
  informação de volta pro especialista. `salvarAgenteExternoPainel()`
  valida esquema `http(s)://` antes de escrever; campo vazio é aceito
  (webhook é opcional). Promovido pra `painel.html` (prod) no mesmo dia
  (v3.03), depois de validado ponta a ponta com `notificar_especialista_externo`.
- **`nome`/`init`/`cor`/`avatarEmoji`** (2026-09-01, pedido direto do
  usuário: "o agente de VM da Vtex tem q ter um ID e ser responsável pelo
  card") — 4 campos novos, todos opcionais. `init` é o que importa de
  verdade: preenchido, o agente externo vira selecionável como
  Responsável/Participante de card em `kanban-dev.html` (ver
  `agentesExternos`/`allIdentities()` na seção "Board & render" abaixo),
  igual um Agente de IA decorativo — sem `init`, comportamento idêntico a
  antes desta mudança (só contexto pro LLM). `nome`/`cor`/`avatarEmoji`
  são só estética, mesmo shape de `dados/agentes`. Sem checagem de
  colisão de iniciais no painel (cruzaria vários squads de uma vez) —
  colisão é detectada do lado do board (`renderAgentesList()`/
  `salvarAgente()` em `kanban-dev.html`). O envio de verdade pro webhook
  quando o agente é responsável por um card é do lado do orquestrador —
  ver `agenteMarcador.js` na seção `functions/` abaixo, NÃO depende de
  nada configurado aqui além de `init`+`webhookUrl`.

### Aba "🤖 Agentes" (2026-09-01, presente em painel.html e painel-dev.html;
linhas abaixo são de painel-dev.html)
Aba própria na barra principal (`ptab-agentes`/`ppane-agentes`, ao lado
de Visão/Fluxo/Pessoas/Monitor/Status/Dados) — pedido direto: "isso
merece uma aba sozinha, nao ficar dentro de outras". Consolida tudo que
antes vivia espalhado: Agentes Externos (ver seção acima, movida pra cá),
visão cross-squad de quem está representado no board, e o Histórico do
Agente Ágil (que só existia por squad, dentro do próprio kanban).
- `_fillAgentesLogSquadFilter()` — L6937 — popula o `<select>` de filtro
  por squad a partir de `SQUADS` (client-side, sem leitura de Firebase),
  chamado toda vez que a aba abre (`swPtab()`).
- `loadAgentesTabData()` — L6944 — SOB DEMANDA (botão "🔄 Atualizar", não
  listener sempre ligado — são N squads × 2 leituras: `kanban/squads/
  {squadId}/dados/agentes` + `kanban/squads/{squadId}/dados/agente_log` —
  ambos sob `dados/`, mesmo path que `FB` já usa em kanban.html/
  kanban-dev.html; achado real, 2026-09-01: 1ª versão desta função lia
  `kanban/squads/{squadId}/agentes` SEM o `/dados/`, path sem regra
  nenhuma em `database.rules.json` → "Permission denied" ao vivo).
  Guarda o resultado em `_agentesTabCache` e chama os 2 renders abaixo.
- `renderAgentesAtivosGrid(results)` — L6968 — grid por squad cruzando
  Agentes de IA do board com Agentes Externos que têm `init` (mesma
  condição que os torna selecionáveis em `kanban-dev.html`); os sem
  `init` aparecem separados como "📡 só contexto".
- `renderAgentesLogCross()` — L6993 — mesma lógica de `renderAgenteLog()`
  (kanban.html/kanban-dev.html) mas agregando `_agentesTabCache` de
  TODOS os squads numa lista só, filtrável pelo select acima; link
  "abrir card ↗" usa `squadBoardUrl(squadId,cardId)` (já existente) pra
  abrir o board certo em nova aba.
- `openAgentesHelp()`/`closeAgentesHelp()` — L7026 — modal estático
  (`agentes-help-ov`) explicando a diferença entre Agente Ágil/Agentes de
  IA no board/Agentes Externos (e os 2 sentidos de fluxo destes últimos)
  — primeiro help_content próprio do painel (não tem Central de Ajuda
  tipo `HELP_CONTENT`/Ctrl+K do kanban).

### Dashboard consolidado
- `loadAll()` — L8518 / `renderAll()` — L8539
- `renderOKR()` — L3992
- `renderBlockers()` — L9092 / `resolveAllBlockers()` — L9022
- `renderRiscos()` — L4027
- `renderTrend()` — L9130 (throughput)
- `renderColDist()` — L9153
- `renderComparison()` — L8969
- `loadAgentUsage()` — L4421
- `renderGerenciaBar()` — L2481 / `gerenciaSquadIds()` — L2474 (Insights por Gerência)

### Board Setup
- `openBoardSetup()` — L9188

### Usuários
- `openGlobalUsersModal()` — L8121
- `initHiddenCols()` — L7764

## functions/ (Cloud Functions — deploy manual, sempre resincronizar antes, ver `CLAUDE.md`)

### index.js — registro de exports
- `PUSH_TYPES` (allow-list de push, hoje: assigned/mention/unblocked/risk/
  recorrente/painel_broadcast/intake) — L23
- `sendPushOnNotification` — L25
- `agenteAgil` (HTTP, agente v0-v3 mais antigo) — L119 → `agente-agil/http.js`
- `spotifyOauthCallback`/`Disconnect`/`SyncNow`/`Playback`/`RadioOwnerCallback`/`RadioSearch`/`RadioSuggest` — L123–L162 → `spotify/*.js`
- `intakeSubmit` — L168 → `intake/submit.js`
- `weeklyBackup` — L173 → `backup/weeklyBackup.js`
- `agenteAgilMencao` — L187 → `agente-agil-orquestrador/mentionTrigger.js` (orquestrador novo, gatilho por @menção, squad `dev`)
- `agenteAgilMencaoDados` — L198 → mesma fábrica, squad `dados`, ativado em
  escrita real 2026-08-24 (ver seção abaixo)
- `agenteAgilDueOverdueScan` — L217 → `agente-agil-orquestrador/dueOverdueTrigger.js`,
  scan diário (`onSchedule`), item 5 do roadmap — squads `dev` **e**
  `dados` (dados adicionado 2026-08-25), cobre `due_overdue` **e**
  `due_today` (nome ficou de v1, só due_overdue/squad dev — ver seção
  abaixo)
- `agenteAgilResumoMeuDia` — L228 → `agente-agil-orquestrador/resumoMeuDia.js`,
  `onRequest` (não gatilho por evento) — "🤖 Resumo do Agente Ágil"
  dentro de "Meu Dia", 2026-08-25, ver seção abaixo
- `agenteAgilIntake` — L245 → `agente-agil-orquestrador/intakeTrigger.js`,
  squad `dev`, escrita real desde 2026-08-27 (rodou em modo sombra do 1º
  deploy até essa decisão) — 2º gatilho automático do orquestrador, escuta
  `agente_intake_pending/{id}` (ver `agente-agil/http.js` abaixo pro
  porquê de existir)
- `agenteAgilAnaliseDados` — L~247 → `agente-agil-orquestrador/analiseDados.js`,
  `onRequest` (não gatilho por evento) — "🤖 Ponto de vista do Agente
  Ágil" dentro dos painéis "Dados do Board"/"Controle de Criativos",
  2026-09-01, ver seção abaixo
- `agenteAgilAnalisePO` — L~259 → `agente-agil-orquestrador/analisePO.js`,
  `onRequest` (não gatilho por evento) — "🤖 Análise do board (PO)"
  dentro de "Meu Dia", 2026-09-01, ver seção abaixo

### agente-agil-orquestrador/ (orquestrador novo — este é o documentado em `maredigital.html`)
- `squadScope.js` (2026-08-31, revisão arquitetural) — fonte única das
  listas "em quais squads o Agente Ágil está ativo, pra qual capacidade":
  `MENTION_SQUADS`/`DUE_SCAN_SQUADS`/`RESUMO_MEUDIA_SQUADS`/
  `NOTIFICAR_ESPECIALISTA_SQUADS`/`ANALISE_DADOS_SQUADS`/
  `ANALISE_PO_SQUADS` (as 2 últimas adicionadas 2026-09-01, ver
  `analiseDados.js`/`analisePO.js` abaixo). Antes,
  `dueOverdueTrigger.js`/`resumoMeuDia.js` hardcodavam `['dev','dados']`
  cada um por conta própria (já tinham comentário cruzado avisando
  "mesma lista que o outro arquivo", nunca chegaram a compartilhar de
  verdade). `mentionTrigger.js` FICA DE FORA de propósito — cada squad
  lá é uma Cloud Function exportada por nome, exigência do modelo de
  deploy do Firebase Functions gen2, não duplicação acidental —, mas faz
  uma checagem de drift contra `MENTION_SQUADS` no module load
  (`console.warn` se divergir, não bloqueia).
- `tools/index.js` — `buildTools()`, registro das 15 ferramentas reais (`comentario`, `link`, `relatorio_html`, `checklist_item`, `agent_status`, `mover_coluna`, `editar_campos`, `risco`, `perguntar_humano`, `ler_card`, `visao_board`, `biblioteca_agil`, `criar_card`, `cards_por_agente`, `notificar_especialista_externo`). `semCard:true` (2026-08-27) — variante restrita pra quando não há cardId fixo (ver `intakeTrigger.js`): só `criar_card`/`visao_board`/`biblioteca_agil`/`cards_por_agente`/`notificar_especialista_externo` sobrevivem, as demais exigem card já resolvido.
- `tools/notificarEspecialistaExterno.js` (2026-08-31) — `notificar_especialista_externo`, "encaminha de volta" pro especialista externo (POST HTTP pro `webhookUrl` cadastrado em `kanban/config/agentesExternos/{especialista}`, ver painel.html). Só aparece no toolset em `mode:'real'` quando `squadId` está em `NOTIFICAR_ESPECIALISTA_SQUADS` (`squadScope.js`, hoje só `dev`) — decisão explícita do usuário: escrita real direto, sem modo sombra (risco baixo, é só uma URL que o próprio ADM cadastrou). Identifica QUAL especialista pelo `especialista_id` que `ler_card`/`lerCard.js` (`especialistaIdDoComentario()`) já extrai do `uid` de cada comentário (`especialista:{id}`) — nunca do texto de exibição (`author`), que pode vir formatado diferente da chave real. Timeout 8s, nunca lança exceção (sempre `{ok:false, error, message}` em falha). **Achado real (2026-09-03, `/monitorarbugs`)**: além de existência de `webhookUrl`, também checa `config.squads[squadId]===true` antes de chamar — mesmo toggle por squad que `agenteMarcador.js`/`agentesExternosDoSquad()` (abaixo) já respeitava; sem isso, um especialista habilitado só em OUTRO squad ainda recebia o POST de verdade se o modelo identificasse o id certo no histórico de comentários do card.
- `tools/cardsPorAgente.js` — `cards_por_agente` (2026-08-31, pedido direto:
  "fica mais fácil pro agente ágil se organizar dentro do quadro").
  Consulta `kanban/squads/{squad}/dados/agentes` (registro de identidades
  de IA, ver seção "Agentes de IA" em kanban.html abaixo) e agrupa os
  cards ativos (owner/participants) por agente — filtra por um agente
  (`agente`, nome ou init) ou lista todos se omitido. Não exige cardId
  fixo (mesma categoria de `visao_board`/`biblioteca_agil`/`criar_card`),
  disponível também em `semCard:true`.
- `agenteMarcador.js` — `marcarAgenteResponsavel()` (2026-08-31, pedido
  direto: "se tem um outro agente de responsavel ali, ele deve ser
  notificado quando as coisas acontecerem"). Um agente cadastrado em
  `dados/agentes` não tem uid/login pra notificação de verdade — a
  solução acordada foi um comentário adicional automático ("📎 cc: ...")
  postado depois de QUALQUER mutação real do orquestrador (mesmo
  critério `acoesRegistro.length` de `coletarAcoesAgente()`,
  `agenteLog.js`) num card cujo owner/participant bate com um agente
  cadastrado. Chamado de `processarMencao()` (`mentionTrigger.js`, cobre
  @menção/Automação/scan diário) e `processarIntake()`
  (`intakeTrigger.js`, quando resolve um card real) — os 2 mesmos pontos
  que já chamam `registrarLogAgente()`.
  **2026-09-01** (pedido direto: unificar o board com Agentes Externos —
  "o agente de VM da Vtex tem q ter um ID e ser responsável pelo card...
  tudo de importante q acontecer ali, o agente agil vai pegar essas
  informações e levar pro agente de vm externo"): também resolve agentes
  de `kanban/config/agentesExternos` (registro GLOBAL, painel.html)
  habilitados neste squad e com `init` preenchido
  (`agentesExternosDoSquad()`), incluídos no MESMO comentário "📎 cc".
  Pros que têm `webhookUrl`, `notificarAgentesExternosResponsaveis()`
  chama o handler real de `tools/notificarEspecialistaExterno.js`
  (reaproveitado direto, não como tool) — só nos squads em
  `NOTIFICAR_ESPECIALISTA_SQUADS` (squadScope.js). Gatilho
  DETERMINÍSTICO por decisão explícita do usuário (não uma tool que o
  LLM escolhe chamar) — garante disparo em toda mutação real. Falha no
  webhook não invalida o "📎 cc" já postado (passo isolado, try/catch
  próprio).
  `risco` (2026-08-28, pedido direto — "pensando em grandes projetos, pode
  ser legal") — só adiciona (`card.riscos` é array de strings puras,
  sem id/estado, sem "resolver"); reusa o mesmo par schema Zod
  (`agente-agil/schema.js`) + builder (`agente-agil/outputs/risco.js`,
  mesmo padrão transacional de `outputs/link.js`) que as outras 7
  ferramentas reaproveitadas já usam — nenhum código novo em
  `tools/index.js`/`realHandlers.js` além de registrar o schema em
  `REUSED_OUTPUT_SCHEMAS`, tudo genérico a partir daí.
- `tools/criarCard.js` — `criar_card` (2026-08-27, fecha o gap "não existe
  criar_card no toolset dele" registrado no README). NÃO escreve em
  `/cards` direto (mesmo risco de perda silenciosa de `intake/submit.js`
  — array reescrito por inteiro a cada `fbSaveAll()`) — grava rascunho em
  `intake_pending`, revisável na tela que já existe
  (`renderIntakeBody()`/`_intakeCriarCard()` em kanban-dev.html — ver
  seção "Intake" abaixo). Replica as regras obrigatórias do `criar_card`
  client-side (Ficha Técnica recusa, Submarca exige opção válida —
  `SUBMARCA_LABELS`, cópia fixa de `SUBMARCA_TAGS` do kanban-dev.html).
  Campos opcionais adicionados 2026-09-01, testado na prática — o agente
  recebeu um processo em etapas e um pedido de tags/riscos e não tinha
  onde colocar nada disso além de texto corrido na descrição:
  `checklist` (até 20 strings, itens sempre desmarcados), `tags` (até 10
  NOMES — nunca ids, casados por label no cliente) e `riscos` (até 10
  strings soltas, mesmo formato de `card.riscos` no board).
  `_intakeCriarCard()` aplica os 3 ao confirmar o rascunho.
- `pendingAuto.js` — `enqueuePendingAuto()`/`enqueuePendingAutoFromDiff()`
  (2026-08-29, achado real `/monitorarbugs`: Automações client-side nunca
  disparavam pra mutação do orquestrador). Chamado de dentro de
  `runWritePlan()` em `tools/realHandlers.js` — lê o card antes/depois de
  `applyWritePlan()` (clone via `JSON.parse(JSON.stringify(...))`, não
  spread — achado ao rodar o teste de `mover_coluna`: um fake db de teste
  que devolve a MESMA referência de objeto em `get()` fazia o snapshot
  "antes" mudar sozinho quando o depois era escrito) e enfileira só os
  eventos que mudaram de verdade (`move`/`priority`/`tag_added`/
  `tag_removed`/`checklist_complete`/`risk_added` — os únicos campos que
  `mover_coluna`/`editar_campos`/`checklist_item`/`risco` conseguem
  tocar). Ver seção "Automações (Butler-style)" (kanban-dev.html) acima
  pro lado que consome a fila.
- `tools/lerCard.js` — inclui `colunas_disponiveis` no retorno (mapa
  id↔nome↔fim de TODAS as colunas do board) — `mover_coluna` precisa do
  ID, não do nome de exibição; achado real 2026-08-21 (agente chutou
  "Concluído"/"Concludo", ambos erraram, corretamente pausou com
  `perguntar_humano` antes deste fix). `origemDoComentario(uid)` —
  2026-08-27, "orquestrador lendo input de especialistas externos" (ver
  README.md) — cada comentário que `summarizeCard()` devolve ganha
  `origem` (`humano`/`proprio`/`automacao`/`especialista`), resolvida do
  mesmo `uid` que `resolveActor()` (`agente-agil/board.js`) já grava;
  zero campo novo no Firebase. `systemPrompt.js` ganhou seção instruindo
  o modelo a nunca reconciliar especialistas que se contradizem sozinho
  — só sinalizar.
- `mentionTrigger.js` — `createMentionTrigger({squadId, dryRun})` (L130)
  é uma FÁBRICA multi-squad (2026-08-21) — cada squad suportado vira sua
  própria Cloud Function com path LITERAL no trigger (não wildcard, por
  custo). Instâncias hoje: `dev` (dryRun:false) e `dados` (dryRun:false,
  2026-08-24) — ambas em escrita real. `processarMencao()` — L134
  (dentro da fábrica, por instância). 2 fixes reais achados validando o
  item 5 (due_overdue/due_today) em produção, 2026-08-24: (1) disparo
  por Automação (`comment.uid==='automacao'`, ator sintético) não
  notificava ninguém — agora resolve e notifica o responsável do card
  (`card.owner`) nesse caso; (2) o `idOverride` da notificação por
  Automação colidia com o de outros caminhos de notificação do mesmo
  card — passou a incluir `commentId` (`mention_auto_{cardId}_{uid}_
  {commentId}`) pra não bloquear disparos novos com uma notificação
  antiga no mesmo slot. 3º fix real, achado ao vivo (2026-08-27): o
  MESMO problema do 2º fix, nunca replicado pro caso "original" — a
  notificação de @menção HUMANA usava `mention_{cardId}_{uid}` (sem
  `commentId`), então uma 2ª @menção da mesma pessoa no mesmo card
  (pergunta nova, não reprocessamento) nunca notificava, o slot já
  estava ocupado pela 1ª. Mesmo fix: `commentId` no idOverride.
- `intakeTrigger.js` — `createIntakeTrigger({squadId, dryRun})` (2026-08-27,
  fábrica no mesmo padrão de `mentionTrigger.js`) — 2º gatilho automático
  do orquestrador, o 1º que não depende de card existente. Escuta
  `agente_intake_pending/{id}` (escrito por `agente-agil/http.js`, ver
  seção abaixo). `processarIntake()` resolve `cardId`/`referencia` de
  novo (o card pode ter sumido entre o especialista mandar e o trigger
  rodar); se resolve, monta o toolset normal (igual @menção); se não,
  monta `semCard:true` (só `criar_card`/`visao_board`/`biblioteca_agil`).
  Resultado gravado de volta no próprio item da fila (`resultText`,
  `pendingIdCriado`) — sem card pra comentar nesse caminho. Só a
  instância `dev` existe hoje, com escrita real desde 2026-08-27
  (`DRY_RUN_INTAKE:false` — validada com 7 rodadas de teste, ver
  `README.md`; squad `dados` ainda não tem instância deployada).
  `notificarFalhaSemCard()`/`acharCardHotline()` (2026-08-28, pedido
  direto após um teste real via HTTPS): quando `semCard` e nada de
  acionável nasceu (`criar_card` recusou, ou o modelo decidiu não
  criar), comenta no card hotline "🤖 Converse com o Agente Ágil" (só
  LÊ — nunca cria um card novo em `/cards`, mesmo risco de perda
  silenciosa que `criarCard.js` já contorna) e notifica quem tem papel
  `po`/`adm` na squad (`members.js` ganhou o campo `role` por membro,
  mesmo fallback de `getEffectiveRole()` do cliente, sem replicar o
  allowlist de super-admin `isAdmUser()`). Sem card hotline ainda,
  notifica do mesmo jeito com `type:'intake'`/`cardId:null` (mesmo tipo
  que `openNotif()` já trata pra abrir Pedidos de Intake em vez de
  navegar pra um card inexistente). Sem isso, uma recusa (ex.: Ficha
  Técnica obrigatória) ficava visível só pra quem abrisse Pedidos de
  Intake por conta própria.
  `lerDescricaoEspecialista()` (2026-08-28, pedido direto: "área em
  configurações para os ADM's/PO explicarem as funções dos outros
  agentes... pra ele usar como contexto"; migrado pra registro GLOBAL no
  mesmo dia, pedido direto: "listar todos eles... setar em quais squads
  ele vai ficar") — lê `kanban/config/agentesExternos/{especialista}`
  (editado em painel.html/painel-dev.html, ⚙ Config → 🔌 Agentes
  Externos, ver `agentesExternosCfg`/`renderAgentesExternosPainel()`,
  chave = mesmo valor do campo `especialista` do envelope) e injeta a
  descrição no início do `task` só se `squads[squadId]===true` na
  entrada — sem o squad atual marcado ali, trata como especialista
  desconhecido (não injeta nada). Não existe mais UI equivalente dentro
  do kanban (removida na mesma migração).
- `agenteLog.js` — histórico do Agente Ágil por squad, 2026-08-27, pedido
  direto ("quero uma area q guarde todas as alterações nos cards que ele
  faça naquela squad, para servir de historico para o PO... pode ate
  gravar quem pediu, se for o caso, ou se foi autonomo"). Chamado de 2
  pontos: `processarMencao()` (mentionTrigger.js, cobre @menção manual/
  Automação/scan diário — os 3 passam pela mesma rota, escrevem um
  comentário `@Agente Ágil` real) e `processarIntake()`
  (intakeTrigger.js, informação de especialista externo, sem comentário
  nenhum). `coletarAcoesAgente(steps)` achata `result.steps` (ver
  `loop.js`) numa lista de frases em português, só das tools que mudam
  algo de verdade (`ler_card`/`visao_board`/`biblioteca_agil` ficam de
  fora, e chamadas em `dryRun`/que falharam também). `registrarLogAgente
  (db, {squadId, cardId, comment, acoes})` grava em `kanban/squads/
  {squadId}/dados/agente_log/{logId}` — `classificarOrigem(comment)`
  (2026-08-27, achado real via `/monitorarbugs`: binário antigo
  `autonomous` fazia `comment.uid==='especialista:*'` virar
  `autonomous:false`/exibir "pediu via menção" no cliente, frase falsa)
  resolve `origem: 'mencao'|'automacao'|'especialista'` a partir do
  `uid` — `automacao` é o único caso sem `requestedBy` (null); `mencao`
  e `especialista` preenchem `requestedBy` com autor/uid. Sem entrada se
  nenhuma ação mutante rodou (não polui o log com "só leu o card").
  Lido pelo client em `renderAgenteLog()` (kanban.html, ver seção
  "Agente Ágil" acima) — aba "🤖 Histórico do Agente" em
  ⚙ Configurações, com fallback pra derivar `origem` de `autonomous` em
  entradas gravadas antes deste fix. `database.rules.json` não precisou
  de regra nova — `agente_log` já cai dentro do `.read`/`.write` amplo de
  `squads/$squadId/dados` (mesmo nível de acesso de `cards`/
  `card_comments`; a visibilidade de fato fica só na UI, PO/Organizador/
  ADM, mesmo padrão do resto do app).
- `escolheClienteParaTarefa.js` — roteamento de modelo real (Item 7 do
  roadmap, 2026-08-21): `classificaComplexidade()` — L70 — heurística de
  texto que manda perguntas curtas/conceituais pro `haiku`, tudo o resto
  (qualquer pedido de ação) pro `sonnet`; sem caminho automático pro
  `opus` em v1, só override manual via
  `kanban/config/agente_agil_orquestrador/model_tier_override`
  (fail-safe: erro/ausente cai pra heurística). `MODEL_BY_TIER` — L27
- `dueOverdueTrigger.js` — item 5 do roadmap, v1 (2026-08-24):
  `onSchedule` diário, cobre `due_overdue` **e** `due_today` (due_today
  adicionado no mesmo dia, ao mesmo scan — nome da function ficou de
  quando era só due_overdue, não renomeado pra não exigir apagar/
  recriar). `SQUADS` — array de squads escaneados (`['dev','dados']`,
  `dados` adicionado 2026-08-25) — 1 Cloud Function só, itera os squads
  em sequência (cada um em try/catch próprio); diferente de
  `mentionTrigger.js`, aqui NÃO faz sentido 1 function por squad (só se
  justifica pra escutar evento com path literal — `onSchedule` não
  escuta squad nenhum, só dispara 1x/dia). `runDueOverdueScan(db,
  squadId)` — L108 — squad-agnóstica, reusa a mesma rota da @menção
  (escreve comentário, `agenteAgilMencao` processa), só age se o ADM já
  tiver configurado a Automação correspondente pro gatilho ("Card vence
  hoje"/"Card atrasado (1º dia)") NAQUELE squad
- `systemPrompt.js`, `loop.js`, `limits.js`, `detectaMencao.js`
- `llmClient.js` — única camada que fala o formato Anthropic
  (`createAnthropicLlmClient()`). Prompt caching (2026-08-26, achado
  direto no Console: sem cache, um único acionamento do loop com 6
  iterações cobrou ~50k tokens de entrada em preço cheio, já que cada
  iteração reenvia o histórico acumulado do zero) — `withSystemCacheControl()`
  marca o bloco de `system` (cobre tools+system juntos, TTL 1h — prefixo
  reusado entre tarefas diferentes, não só iterações do mesmo loop) e
  `withMessagesCacheControl()` marca o último bloco de `messages` (TTL
  padrão 5min — prefixo específico da tarefa em andamento). `decide()`
  agora também repassa `usage` (inclui `cache_read_input_tokens`/
  `cache_creation_input_tokens`) pra quem chamar poder verificar hit
  rate.
- `resumoMeuDia.js` — "🤖 Resumo do Agente Ágil" (2026-08-25), primeira
  invocação SOB DEMANDA do orquestrador (`onRequest`, não gatilho por
  evento) e a única que NÃO ESCREVE NADA no board — só lê os cards
  ativos da pessoa (responsável/participante, squads `dev`/`dados` que
  ela participa) e devolve texto interpretado pelo LLM (`tools: []`,
  sem nenhuma ferramenta de ação). `collectPendingCards()`/
  `sinaisDoCard()` — L87/pura, calculam os sinais objetivos (atrasado,
  bloqueado, sem descrição, checklist vazio/pendente) ANTES do LLM ver
  qualquer coisa. `gerarResumoMeuDia()` — L178 — lógica pura testável
  (llmClient injetado). Sem cards pendentes, não chama o LLM (custo
  zero). Auth via `Bearer <idToken>` verificado manualmente (mesmo
  padrão de `spotify/disconnect.js`), kill switch dinâmico do resto do
  orquestrador respeitado, rate limit de 2min/pessoa
- `analiseDados.js` — "🤖 Ponto de vista do Agente Ágil" (2026-09-01),
  mesmo padrão de `resumoMeuDia.js` acima (`onRequest`, `tools: []`, kill
  switch, rate limit 2min/pessoa), mas UM endpoint pra DOIS painéis
  (`kanban-dev.html`: "Dados do Board" → Insights e "Controle de
  Criativos") — `contexto` (`'board_insights'`|`'criativos'`) escolhe o
  system prompt certo em `CONTEXTOS`. NÃO lê cards via Admin SDK — o
  `resumo` (números já agregados) vem pronto no corpo do POST, calculado
  client-side pelos próprios painéis que já mostram esses números na
  tela (`renderBoardDataInsights()`/`renderCriativosDashboard()`); o
  handler só valida formato/tamanho (`resumo` objeto, máx. 12.000
  caracteres de JSON) e `squadId` contra `ANALISE_DADOS_SQUADS`.
  `gerarAnaliseDados()` — lógica pura testável (llmClient injetado)
- `analisePO.js` — "🤖 Análise do board (PO)" (2026-09-01), dentro de
  "Meu Dia", só pra PO/Organizador/ADM (gate no client, ver
  `AGENTE_AGIL_ANALISE_PO_SQUADS` abaixo). Mesmo padrão de
  `resumoMeuDia.js` (`onRequest`, `tools: []`, kill switch, rate limit),
  mas lê cards/campanhas direto via Admin SDK (não recebe resumo do
  cliente) — precisa comparar tags dos cards ativos contra
  `kanban/campanhas` (nó GLOBAL, não por squad). Reaproveita
  `summarizeBoard()` de `tools/visaoBoard.js` (WIP/throughput/cycle/
  lead/gargalo/bloqueios). `buildBoardPOPayload()` — lógica pura,
  calcula listas de atrasados/bloqueados/incompletos (cap 8, exclui
  cards em coluna de fim) e `tagsSemCampanha` — tags com ≥3 cards ativos
  que AINDA NÃO pertencem a nenhuma campanha `ativa`/`planejamento`
  (`campanhasRelevantes()`) — só essa lista já filtrada chega ao LLM, que
  decide SE vale sugerir uma campanha nova, nunca inventa a comparação
  sozinho. `collectBoardPOData()` — I/O, chama `buildBoardPOPayload()`
  com os dados lidos. Escopo só do squad atual (`ANALISE_PO_SQUADS`),
  não cross-squad como o resto de Meu Dia (confirmado com o usuário)

### agente-agil/ (agente v0-v3, HTTP, mais antigo — ainda deployado como `exports.agenteAgil`, mas não é o orquestrador documentado em `maredigital.html`)
- `http.js`, `schema.js`, `board.js`, `flow.js`, `members.js`, `notifications.js`, `resolver.js`, `storage.js`
- `http.js` — CORREÇÃO DE ARQUITETURA (2026-08-27, pedido direto do
  usuário): parou de aplicar a ação do especialista direto no board.
  Agora só valida `schema.js:intakeEnvelope` (texto livre obrigatório;
  `cardId`/`referencia` viram dica opcional) e enfileira em
  `agente_intake_pending/{id}` — quem decide é sempre
  `agente-agil-orquestrador/intakeTrigger.js`. `schema.js:envelope`/
  `output` (vocabulário de ações antigo) ficam só como contrato legado,
  não lidos mais aqui.
- `board.js` — `resolveActor(especialistaId)`/`ctx.actor` (2026-08-25): identidade
  (`uid`/`author`/`who`/`init`) creditada em todo output — achado real: antes,
  todo output (especialista externo via `http.js` OU o próprio orquestrador via
  `agente-agil-orquestrador/tools/realHandlers.js`, que reusa os MESMOS
  builders) gravava sempre `uid:'agente-agil'`, o mesmo ator, tornando
  estruturalmente impossível o orquestrador diferenciar "especialista escreveu"
  de "eu mesmo escrevi" (o filtro anti-auto-disparo de `mentionTrigger.js`
  engolia os dois igual). `extra.especialista` em `buildWritePlan()` só vem
  preenchido quando quem chama é `http.js` (default `'databricks'`, único
  especialista real hoje) — `realHandlers.js` nunca passa isso, mantém a
  identidade de sempre. `SQUAD_ID` default trocado de `'ecomm'` (squad
  descontinuado, apagado do Realtime Database) pra `'dev'` (2026-08-25) —
  agora tem overlap real com o orquestrador, que só existe em `dev`/
  `dados`; `http.js` (canal do especialista externo) segue esse default
  automaticamente

### intake/ e backup/ — online
- `intake/submit.js` — `intakeSubmit`, HTTP público sem login, único ponto de
  escrita anônima do sistema. Grava em `intake_pending` (nunca em `/cards`
  direto — ver comentário no topo do arquivo pro porquê). Honeypot + rate
  limit por IP.
- `backup/weeklyBackup.js` — `weeklyBackup`, `onSchedule` todo domingo 04:00
  (Brasília), backup de cada squad pro Cloud Storage
  (`backups/{squadId}/{data}.json`), independente de alguém abrir o board.
  Retenção automática de 60 dias via `storage-lifecycle.json` (~8-9 backups
  semanais mantidos por squad).

### spotify/ — PAUSADO (2026-08-04)
"Ouvindo agora" (presença ao vivo, opt-in) + "Rádio do Maré" (playlist
colaborativa). Completo e validado em produção, mas o sync periódico
(`spotify/sync.js`, `spotifySync`) era a única function agendada de todo o
projeto — rodava 24h/dia mesmo sem ninguém conectado — e custou mais do que
o esperado. Pausado desligando só essa function (linha comentada em
`functions/index.js`, L129-L140) e escondendo a aba `#spotify-tab` no board.
As outras 6 functions da integração continuam deployadas normalmente:
- `oauth.js` (`spotifyOauthCallback`) — conexão por pessoa (opt-in)
- `disconnect.js` (`spotifyDisconnect`) — apaga o refresh_token de verdade
- `syncNow.js` (`spotifySyncNow`) — sync sob demanda ao abrir o painel
- `playback.js` (`spotifyPlayback`) — play/pause/próxima pessoal
- `radioOwnerCallback.js` / `radioSearch.js` / `radioSuggest.js` — playlist
  colaborativa (Rádio do Maré), não depende do sync pausado
- Ver `functions/spotify/README.md` pro desenho completo. Pra religar o
  sync: ver o comentário em `functions/index.js` sobre custo antes.

---

*Retrato do commit `68e233d` (2026-08-31).*
