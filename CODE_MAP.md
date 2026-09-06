# Mapa do código

Índice de âncoras (funções/consts) por área funcional, pra achar código rápido
nos arquivos grandes deste repo (`kanban.html`/`kanban-dev.html` têm ~28.2k
linhas / até ~1.1MB) sem precisar ler o arquivo inteiro.

**Como usar:** os números de linha abaixo são um retrato de um commit
específico (ver rodapé) e ficam desatualizados a cada edição no arquivo —
**sempre confirme com `grep -n "nomeDaFuncao" arquivo.html` antes de confiar
neles pra uma edição**. O valor real deste arquivo é a lista de nomes
(âncoras estáveis), não os números de linha em si.

`kanban.html` e `kanban-dev.html` estão hoje idênticos exceto pela string
de versão + `VERSION_KEY`, e pelo favicon próprio de cada ambiente
(`favicon.png` em prod / `favicon-dev.png` em dev — `link rel="icon"`,
`apple-touch-icon`, a imagem de splash, e as 2 entradas de ícone do
manifest — commit `ff759f8`, "favicon próprio pro dev + favicon do 🌴 Vice
City"). Essa divergência de favicon é **permanente e intencional**, não
"dev com trabalho não promovido" — os dois ambientes devem manter ícones
diferentes pra sempre, não vai ser promovida como diff. Os números abaixo
valem pros dois arquivos (retrato deste rodapé: promoção da v8.30.586
confirmada, ver `CHANGELOG.md`). Isso pode mudar a qualquer momento que
uma feature nova entrar em dev antes de ir pra prod (ver "Release
process" no `CLAUDE.md`) — se o `diff` entre os dois mostrar mais do que
versão/`VERSION_KEY`/favicon, refaça o grep no arquivo específico que
você está editando (provavelmente `kanban-dev.html`, o superset).
`painel.html`/`painel-dev.html` **divergem de verdade** (dev tem
instrumentação extra) — os números da seção painel abaixo são de
`painel.html` (prod).

## kanban.html / kanban-dev.html

### Papéis & autenticação
- `ADM_EMAILS` (let) — L5777
- `getEffectiveRole()` — L6137 — papel efetivo, ADMs hardcoded não são rebaixáveis
- `loadSquadsFromFirebase()` / `SQUAD_META_LIVE` — L6221 / L6190
- `resolveSquadAndShow()` — L9822 — resolve squad da URL, decide o que mostrar
- `autoRegistrar()` — L9975 — cria/atualiza o doc do usuário no login

### Agentes de IA (cadastro — piloto híbrido humano+agente)
Identidades de IA (`kanban/squads/{squad}/dados/agentes`, por squad) que
aparecem lado a lado com pessoas nos seletores de Responsável/
Participante — `agentes` (let) — L6760 / `allIdentities()` — L6772
(combina `members`+`agentes` só pra exibição/seleção, NUNCA pra checagem
de permissão). Até 2026-08-31 só existia o listener (leitura) — pedido
direto do usuário ("quero que isso fique mais claro o cadastro"): CRUD
completo em ⚙ Configurações → Usuários → "🤖 Agentes de IA".
- `renderAgentesList()` — L21259 — lista + detecção de colisão de
  iniciais (humano×agente E agente×agente, mesmo padrão de `dupInit` em
  `renderUsuarios()`)
- `abrirAddAgente()`/`editarAgente(id)`/`fecharAddAgente()` — L21300/
  L19322/L19332 — abre/preenche/fecha o form inline (mesmo padrão de
  "+ Adicionar externo", não é modal separado)
- `salvarAgente()` — L21304 — valida nome/iniciais e colisão antes de
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
- `CARD_SECTIONS` — L6696 — seções do modal (Conteúdo, Vínculos, Colaboração...)
- **📜 Histórico do card** (`card.history[]`) — `HIST_CAP`/`HIST_FIELDS`
  (rótulos legíveis), `_histSnapshot(card)` (antes de editar) →
  `_histDiff(card, before, whoOverride)` (compara e grava cada mudança)
  → `recordHistory(card, what, whoOverride)` (push + cap) →
  `renderHistory(card)`/`toggleHistory()` (UI). Mesmo padrão portado pro
  OKR (`_okrRecordHistory()`/`renderOkrHistory()`, painel-dev.html, ver
  seção OKR — comparados numa rodada de `/monitorarbugs` sem achado
  cruzado). Chamado por praticamente toda mutação de card — ações em
  massa, Automações, Agente Ágil orquestrador, recorrente/agendado,
  fan-out, pin, pausar — sempre passando `whoOverride` quando quem
  mudou não é o usuário logado (`'⚙ Automação'`/`'🤖 Agente Ágil'`).
  **Achado real (2026-09-06, `/monitorarbugs`, técnica 4 — pegadinha de
  vazio/falsy num diff genérico)**: `HIST_FIELDS.tag` rastreia só
  `card.tag` (campo legado, a 1ª tag do array — mantido só por
  compatibilidade com telas antigas), não `card.tags[]` de verdade.
  Adicionar uma 2ª/3ª tag ou remover uma tag que não fosse a 1ª nunca
  gerava entrada de histórico — nem via autosave (`scheduleAutoSave()`)
  nem via Salvar manual (`saveCard()`), os dois únicos caminhos de
  edição de tag via modal (os caminhos de ação em massa —
  `_doBulkTagMulti()`/`_doBulkTagClear()` — já tinham sua própria
  chamada explícita a `recordHistory()`, por isso nunca bateram nesse
  bug). Corrigido: `_histSnapshot()` agora também guarda `tags[]`
  inteiro, e `_histDiff()` tem um diff Set-based dedicado pra tags
  (mesma técnica de `_doBulkTagMulti()`/`_okrDiffStringArray()`), fora
  do loop genérico de `HIST_FIELDS` (que agora pula `'tag'`
  explicitamente).
  **Visual rico com avatar (2026-09-06, pedido direto — "aquele
  histórico que você criou pro OKR, com a fotinha da pessoa, dá pra
  fazer isso no kanban também?")**: `recordHistory()` passa a gravar
  `init` (de `window._currentUserInit`) em cada entrada — só quando é
  edição humana de verdade (sem `whoOverride`; Automação/Agente Ágil
  não têm pessoa nenhuma). `CARD_HIST_TIPOS`/`_histTipo(what)` — mesmo
  espírito de `OKR_HIST_TIPOS` (ícone+cor por tipo, borda colorida),
  mas classificado por regex em cima do texto de `what` em vez de um
  campo `tipo` explícito por entrada (evita ter que tocar nos ~50 call
  sites de `recordHistory()` — mesma técnica que `TIMELINE_FEED_COR`
  já usava, só com mais tipos cobertos: criado/titulo/movido/impedido/
  desimpedido/arquivado/tag/checklist/prioridade/responsavel/prazo/
  duplicado/tempo/pin/campo). `_histAvatarHtml(h)` — foto real via
  `init` → `_ownerAvatarHtml()` (mesmo componente do badge de
  responsável); `HIST_BOT_AVATARS` dá um emoji dedicado (⚙️/🤖) pras
  entradas de Automação/Agente Ágil/Supercard, que nunca têm `init`;
  sem nenhum dos dois, cai nas iniciais do nome (mesmo fallback de
  sempre). `.hist-dot` (CSS) removido — substituído pelo avatar.
- `openCard()` — L12986
- `openAgenteHotline()` — L12895 — card especial fixo por squad "🤖 Converse
  com o Agente Ágil" (`AGENTE_AGIL_MENTION_SQUADS`, hoje `dev`/
  `dados`, os únicos com escrita real do agente — até 2026-08-31 tinha uma
  constante própria `AGENTE_AGIL_HOTLINE_SQUADS` com o mesmo valor,
  unificada na revisão arquitetural dessa data), pra pedido solto que não
  precisa ficar ligado a um card real. É um card de VERDADE no Firebase
  (`agenteHotline:true`, criado sob demanda por `fbCreateCard`, achado via
  `_findAgenteHotlineCard()`) — reusa 100% do mecanismo de `@menção`
  existente, só some do board normal (filtro em `renderBoard()`'s
  `activeCards`) e o modal ganha tema cinza/robô + atalhos
  (`_applyAgenteHotlineSkin()` — L12871, chamado por `openCard()`/
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
- `saveCard()` — L13451 — auto-save (debounce 800ms) passa por aqui
- `_finishCloseOv()` — L28659 — fechamento do modal, reset de estado pendente
- `_newCardHasContent()`/`_newCardGuardOff` — L12225/L12199 — card ainda sem
  `editingId` (criação em andamento): se título/descrição/tags/checklist/
  riscos/PO/comentário têm algo preenchido, `closeOv('card-ov')` avisa
  antes de descartar (fora, Cancelar, ✕, arrastar no mobile — os 4 já
  passavam por `closeOv`). Não conta responsável/coluna/prazo, que vêm
  com valor padrão só de abrir o modal. `_newCardGuardOff` desarma o
  aviso nos 2 pontos em que o fechamento é legítimo mesmo com
  `editingId` ainda null (sucesso de `saveCard()`, e o fechamento do
  modal reaproveitado pra editar item de Recorrente/Modelo/Agendamento)
- `_navigateToCard(cardId)`/`voltarCardAnterior()` — perto de L12844/
  L12852 — pilha `_cardNavStack` pro botão "← Voltar" (pai de supercard,
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
- `fbSaveAll()` — L8191 — reescreve `/cards` INTEIRO (só pra operações
  estruturais em lote: duplicar/arquivar em massa, reordenar, importar,
  recorrências/agendamentos) — **nunca usar pra 1 card só**, arrisca
  sobrescrever o array com o estado local de outra pessoa
- `fbCreateCard()` — L8338 — cria 1 card NOVO com escrita pontual,
  posição alocada via `transaction()` no `cards_index` (atômico contra
  criações concorrentes) — achado real 2026-08-24 (squad
  `midiacriativa`, "cards sumindo"): `fbSaveAll()` na criação
  colidia com o mesmo tipo de ação concorrente e apagava cards de
  outras pessoas. Usar sempre pra criar 1 card (modal, duplicar, filho
  de supercard, fan-out)
- `fbSaveCard()` — L8397 — edita 1 card EXISTENTE, escrita pontual
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
- `_reportUnexpectedCardDisappearance()` — L8384 — dispara toast +
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
- `window._reconcileCardsUpdatedAtPeriodic` — L9184 — poll de 4min (rede
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
- `setDependsOn(parentId)`/`unlinkDependsOn()` — perto de L29503/L29528
  — vincula/desvincula, sempre a partir do card `editingId` aberto no
  modal. `searchDependsCards(q)` — L29466 — alimenta o picker
  (`openDependsPicker()`).
- **Guard de ciclo** (2026-09-03, `/monitorarbugs`) — `_dependsDescendants(cardId)`
  (logo antes de `openDependsPicker()`) — Set com todo descendente de
  `cardId` (BFS por `dependents`). Usado em 2 pontos: `searchDependsCards()`
  tira os descendentes da lista de candidatos mostrada;
  `setDependsOn()` recusa e avisa com toast se `parentId` estiver nesse
  Set (defesa em profundidade — mesma lição do fix de cascata do
  supercard, checagem só na UI de adicionar não basta).
- `buildDepChains()`/`renderDepMap()`/`chainContains()` — perto de
  L29896+ — monta e renderiza a árvore completa (⛓ Dependências na
  toolbar); já tinham `visited` contra ciclo corrompido nos dados (não
  trava), mas o resultado ficava truncado/errado sem o guard acima.
- Diferente de 🧩 Supercard (`childCardIds`): supercard é COMPOSIÇÃO
  (nenhum filho bloqueia o outro, teto de 2 níveis); Dependências é
  BLOQUEIO/ORDEM (um card não deveria "poder" antes do outro), sem teto
  de profundidade — só o guard de ciclo acima.

### Tema (claro/escuro + 🌴 Vice City)
- `_currentTheme()` — L28857 — lê `data-theme` do `<html>`, retorna
  `'light'`/`'dark'`/`'vice'`.
- `toggleTheme()` — L28903 — alterna claro/escuro (clique no botão de
  tema). `toggleThemeVariant()` — logo abaixo — variante mais escura do
  claro (duplo-clique, só faz sentido dentro do claro).
- `toggleViceCity()` / `exitViceCity()` — L28965/próximas linhas —
  easter egg (2026-09-02, piada interna com GTA 6/Vice City): 3º tema
  escondido, ativado segurando o botão de tema por
  `VICE_LONGPRESS_MS` (`_themeBtnPointerDown()`/`_themeBtnPointerUp()`,
  logo acima) — de propósito NÃO listado como opção visível. Paleta em
  `[data-theme="vice"]` no `<style>` (perto da L476, logo depois do
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
- `_refreshComunicados()` — L31622 — busca `kanban/comunicados`
  filtrado `ativo:true` no servidor (`query(...)`), com fallback pra
  árvore inteira se a query falhar (`_dbgTrack('comunicados_fallback', ...)`
  registra quando isso acontece de verdade — ver otimização de bytes
  2026-09-02). `_comunicadosAtivos` (popup) e `_muralTodos` (badge +
  Mural) saem os dois já filtrados por `c.ativo` na origem — nenhuma
  tela de `kanban-dev.html` mostra comunicado inativo/arquivado (isso é
  feature só do `painel.html`, pra ADM revisar).
- `COMUNICADOS_POLL_MS` — L31604 — 12min (era 3min até 2026-09-02,
  corte de bytes).
- **`insistente`** (opção "reaparece até expirar" na composição,
  `painel-dev.html`) — `_talvezMostrarComunicado()`/`dismissComunicado()`
  (`kanban-dev.html`). **Bug corrigido em 2026-09-06**
  (`/monitorarbugs`, escopo "avisos do mural"): antes, um comunicado
  insistente reabria ~400ms depois de fechado (`dismissComunicado()` →
  `setTimeout(_talvezMostrarComunicado, 400)`), em loop, pelo resto da
  sessão — `#comunicado-ov` só fecha via `dismissComunicado()` (sem
  clique-fora), então a pessoa ficava travada. `_comunicadoDismissedSession`
  (novo `Set`, só em memória — reseta a cada load da página, que é
  exatamente o "reaparece" prometido) guarda os ids já dispensados NA
  sessão atual; `_talvezMostrarComunicado()` checa esse Set pros
  insistente, em vez de ignorá-lo incondicionalmente.
- `_ccTogglePrioridadeUI()` (painel-dev.html) — desabilita o checkbox
  "Insistente" quando "Onde aparece" muda pra mural (insistente só faz
  sentido pra popup). Até 2026-09-06 também DESMARCAVA o checkbox — se
  o ADM trocasse pra mural e voltasse pra popup na mesma edição, sem
  salvar no meio, perdia o `insistente:true` original em silêncio.
  Corrigido: só desabilita, não desmarca — `saveComunicado()` já força
  `insistente:false` fora de popup na hora de salvar, então manter o
  checkbox marcado-mas-desabilitado é seguro.

### Modal do card no mobile — redesenho estilo Trello (2026-09-02, CSS puro, sem função nova)
3 commits em sequência no mesmo dia, cada um corrigindo o que o
Playwright anterior não pegou com dado real (`card-attr-row`/`.frow`
parecidas de nome, cards de teste vazios escondendo overflow). Nenhum
anchor JS novo — puro CSS escopado a `#card-ov`, perto de `.card-attr-
row{}` (L1604) e do bloco de comentário `/* .card-attr-row: é a classe
de verdade... */` (L2625): título vira bloco próprio (`order:99` no
`.panel-hd`), rodapé quebra linha em vez de scroll lateral, e
`#card-ov .card-attr-row{grid-template-columns:1fr}` empilha os campos
1 por linha (2 colunas espremidas era o que estourava a tela). Fica
registrado aqui só pelo padrão de bug (nome de classe parecido
enganando 2 rodadas seguidas) — não precisa de anchors próprios porque
não introduziu função nenhuma.

### Cabeçalho mobile — menu "⋯" (2026-09-02)
- `toggleHdMore(e)` / `closeHdMore()` / `renderHdMoreDD()` — L6313/L6321/L6324
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
- `renderNormal()` — L11282
- `renderRaiaOwner()` — L11340
- `renderRaiaTag()` — L11391
- `toggleRaia()` — L11684
- `passesFilter()` — L11641
- `handleDragStart/End/Over/Leave()` — L24360/L24371/L24382/L24410
- `addTouchDnD()` — L26791 — drag-and-drop por toque (mobile)
- `makeCardEl()` — L10242 — monta o HTML de um card no board (tags, badges,
  avatar, capa, ícone de pin...).
- `_sortCards()` / `_sortCardsByMode()` — L10438/L10488 — ordena os cards de
  uma coluna; `_sortCards()` resolve o pin (card fixado sempre no topo,
  ver `togglePinCard()`) por cima do resultado de `_sortCardsByMode()`
  (a lógica de ordenação de verdade — prioridade/criação/manual/etc.),
  num único ponto usado por `renderNormal()` E todas as raias.
- `togglePinCard()` — L10448 — fixa/desafixa 1 card no topo da coluna
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
  perto de L2200), NUNCA `style.display` direto — `.board{display:flex
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
  **2026-09-04**: `.tf-feed-action` (CSS perto de `.meudia-row-title`) —
  o texto da ação (tudo depois do `<b>título</b>`, nos 7 tipos) ganhou
  cor/peso mais discretos (mesma receita já calibrada pra
  `.meudia-row-meta` logo abaixo: `var(--txt)`+opacity reduzida, não
  `var(--txt2)` puro) — achado real (print do usuário) de que título e
  ação ficavam indistinguíveis em linhas longas. Vale nos 3 temas de
  graça, `var(--txt)` já se adapta sozinho.
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
    contexto), perto de L2209.
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
- **`/monitorarbugs` na Timeline (2026-09-04)** — 1ª revisão dedicada da
  área inteira, 3 achados reais:
  1. `recordMove()`/`backfillFlow()` (~L7967/~L8022) comparavam
     `toCol`/`from`/`card.col` só contra `_flowDoneColId()` (a 1ª coluna
     de fim configurada) pra gravar `card.flow.doneAt` — squad com 2+
     colunas de fim (`flowConfig.doneCols`, ex.: "Concluído"+
     "Cancelado") perdia `doneAt` pra card terminado na 2ª coluna, e por
     tabela sumia do bucket "✅ Concluído recente" (e de cycle time/
     throughput/CFD/"🧹 Cards antigos", tudo que lê `flow.doneAt`) —
     mesmo `_isColDone()` (2 linhas abaixo, na mesma função, pra
     auto-desimpedimento) já considerando concluído. Fix: as 2 funções
     passam a usar `_isColDone()` em vez de comparar contra a coluna
     única.
  2. Feed de marcos (`_marcosNoPeriodo()`) perdia o marco 🎚️ quando a
     prioridade era REMOVIDA (dropdown "— sem prioridade —") —
     `_histDiff()` gera "removeu prioridade" nesse caso (diferente de
     "alterou"/"definiu"), regex não cobria.
  3. `<details class="timeline-collapse">` de "Sem prazo definido"/
     "Concluído recente" nunca guardava `open` entre renders — como
     `_timelineSetPrazoInline()`/`_timelineAdiarCard()` (ação no lugar)
     terminam chamando `renderBoard()`, usar a própria ação DENTRO de
     "Sem prazo definido" fechava a seção na hora. Fix:
     `_timelineCollapseOpen`/`_timelineSetCollapseOpen()` (mesmo padrão
     do `_painelTimelineOpen` do painel — ver seção do painel.html)
     persistem o aberto/fechado entre renders.

### `/monitorarbugs`: coluna "concluído" hardcoded em 9 funções (2026-09-04)
2ª rodada seguida, continuação da Timeline acima — escolhida "Relatório de
Tempo/Cycle Time/Throughput/CFD" (nunca auditada, maior consumidora de
`flow.doneAt`) e achou um padrão bem mais amplo: `c.col==='done'` (string
fixa, ignora `flowConfig.doneCols` — a config manual do PO) reimplementado
em 9 lugares, de antes de `_isColDone()` existir como helper canônico.
Todos passam a usar `_isColDone(colId)`:
- `updateMetrics()` — L11788 — Throughput do toolbar.
- `renderBoardDataGrid()` — L11806 — Throughput/Cards ativos/Intake
  concluído (📊 Dados do Board → Visão Geral).
- `renderBoardDataInsights()` — L~18029 — mesma exclusão, aba Insights.
- `maybeSnapshot()` — L11941 — `done`/`sp_done` do snapshot histórico
  diário (`kanban/squads/{squad}/snapshots/{date}`) — sem correção
  retroativa nos snapshots já gravados, só os de hoje em diante.
- `agCtx()` — L~22075 — contagem "Concluídos" no prompt de sistema do
  Agente Ágil + a heurística local `doneCol` (regex de nome, sem checar
  `flowConfig.doneCols`) removida. **2º bug na mesma função**: lia
  `c.doneAt` (campo raso, NUNCA escrito em lugar nenhum do app — o real é
  `card.flow.doneAt`, ver `recordMove()`) — a omissão de cards concluídos
  há +7 dias do snapshot enviado à IA nunca funcionava.
- `computeAvisosQuadro()` — L16045 — mesmo bug do campo raso `c.doneAt`
  no aviso "✅ Resolvido: X" (🌅 Meu Dia) — nunca disparava, pra card
  nenhum, desde que a feature existe.
- 4 caminhos de notificação "card concluído" vs. "card movido" — cada um
  reimplementava a MESMA heurística local (regex de nome) por conta
  própria: modal-save (~L12153), `scheduleAutoSave()` (~L25048),
  `handleDrop()` (~L26751), `ctxMove()` (~L28236) — todos trocados por
  `if(_isColDone(colId)) notifDone(...); else notifMoved(...)`, sem
  variável local nenhuma.
Testado com Playwright, squad fictícia com coluna de conclusão de id
customizado (`col_999`, nunca `'done'` literal — o caso real de qualquer
squad que recriou a coluna) + 2ª coluna de fim (`col_888`) — todos os 9
pontos corretos, `ctxMove()` disparando `notifDone()` (não `notifMoved()`)
pro id customizado; regressão zero confirmada pro caso padrão (id `'done'`
literal, sem `flowConfig.doneCols`).

### 📜 Histórico: data em período de vários dias (2026-09-04)
Achado real do usuário (print de um período "01/09/26 a 04/09/26"):
`_timelineFeedRow()` mostrava só a hora (`🕐 09:01`) em toda linha do
Feed — não diz qual dia quando o período aberto tem mais de 1 dia. Fix:
se `_timelineFeedState.deStr!==_timelineFeedState.ateStr`, a hora vira
`DD/MM HH:mm`; período de 1 dia (o caso mais comum) continua só com a
hora. Mesmo fix espelhado em `_ptFeedRow()` do painel-dev.html.

### Busca (Ctrl+K + "Ver no board")
- `openSearch()` — L29297
- `renderSearchResults()` — L29309
- `verNoBoardFromSearch()` — L29376
- `_scheduleTextFilterApply()` — L11594 — debounce do filtro `#f-texto`

### Checklist (com grupos colapsáveis)
- `renderCL()` — L14038
- `_clGroupsInit()` — L14003
- `toggleChecklistGroupCollapse()` — L14016

### Campanhas (`openCamp()`, botão "📣 Campanhas")
- `renderCampDashboard()` — L19040 — aba "📊 Dados de Produção" do detalhe
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
- `_crvAutoTitle()` — L14468 — título automático do filho a partir da Ficha Técnica
- `searchSuperChildren()` — L24074 — busca de cards existentes ao criar um filho
- `_mergeModeloEmCardObj()` — L27149
- `_applyFanoutTemplate()` — L27118 — cria os filhos de uma receita de fan-out
- Nesting de 2 níveis (campanha → criativo → versão): `editingSuperParentIsChild`
  (global, L21647) + `initSuperChildren()` — L23850 — calcula se o card
  aberto já seria uma "versão" (teto real do 2º nível)
- `_crvOwnSummary()` — L23945 — resumo dos campos próprios do criativo,
  usado no card de versão (2º nível)
- `_checkSupercardAutoComplete(childCard, ancestry)` — L27710 — conclui o
  supercard sozinho quando todos os filhos ativos chegam numa coluna de
  fim; cascateia filho→pai→avô recursivamente. `_isColCancelLike()` —
  L27696, logo acima — se TODOS os filhos ativos terminaram cancelados,
  o pai NÃO conclui sozinho, fica onde está. `ancestry` (2026-09-02) —
  guard contra ciclo corrompido em `childCardIds`; Set copiado por
  chamada (não compartilhado entre irmãos, ao contrário do `visited` de
  `_duplicarComFilhos()` abaixo) — um Set global quebraria a cascata
  legítima de um card com 2 pais/avô compartilhado.
- `_duplicarComFilhos()` — L13915 — duplicar um supercard com opção de
  duplicar os filhos junto (checkbox opt-in no modal de duplicar, só
  aparece se `_cardIsSupercard()`). Recursivo (cobre netos, 3 níveis
  campanha→criativo→versão), religa `childCardIds` pros ids NOVOS, filhos
  mantêm a própria coluna (não herdam `opts.col` do card raiz), filhos
  arquivados ficam de fora, `visited` protege contra ciclo corrompido nos
  dados

### Card lock / "Pedir o card"
- `CARD_LOCK_REQUEST_GRACE_MS` — L12310
- `_cardLockRequestPath()` — L12317
- `pedirCard()` — L12327
- `liberarCardAgora()` — L12341
- `_renderLockRequestUI()` — L12345
- `_handleLockRequest()` — L12380
- `_checkCardLock(cardId)` — perto de L12453 — chamada de dentro de
  `openCard()`; lê/assina `card_locks/{cardId}` e decide travar em
  leitura ou assumir. 2 early-returns ANTES de tocar o Firebase, os dois
  achados via `/monitorarbugs` comparando o card hotline contra outros
  tipos especiais que passam pelo mesmo `openCard()`: card
  `agenteHotline` (2026-09-02, dev v8.30.543-dev — compartilhado por
  design, lock não faz sentido) e card `_isQLTemp` (2026-09-03, dev
  v8.30.565-dev — temporário/client-only de `openQLEdit()`, id nunca se
  repete, também não faz sentido travar). `_releaseCardLock(cardId)` —
  perto de L12556 — chamada por `_finishCloseOv()` (`if(editingId)`) e
  no `beforeunload`.

### Notificações in-app
- `createNotif(targetUid, type, title, sub, cardId, idOverride, commentId, extra)` —
  L24244. `extra` (2026-09-06, opcional) — objeto mesclado no registro,
  pra campo específico de 1 tipo só (ex.: `{meetingLink}` em `reuniao`)
  sem virar campo fixo de todo notif.
- `loadNotifs()` — L24505
- `NOTIF_ICONS` — ícone por `type`; ganhou `okr_editado`/`okr_prazo`/
  `okr_reuniao` (🎯), `okr_agente` (🤖) em 2026-09-06, e
  `recorrente`/`reuniao`/`gcal_pending`/`gcal_approved`/`reacao`/
  `feedback`/`painel_broadcast` na mesma data (caíam no 🔔 genérico).
  `due_soon` continua no mapa mas nenhum código emite esse tipo —
  código morto inofensivo.
- `openNotif(notifId, cardId, squad, commentId, type, okrObjId, meetingLinkEnc)` —
  navegação ao clicar. `type==='intake'` abre o painel de Intake; 4
  tipos `okr_*` redirecionam pra `painel(-dev).html?okr=<okrObjId>`
  (`?okr=chat` pro `okr_agente`) — ver `_okrTryOpenFromUrl()` na seção
  OKR (painel-dev.html); `type==='feedback'` redireciona pra
  `painel(-dev).html?tab=monitor` (ver `_painelTryOpenTabFromUrl()`,
  seção Sino do painel); `type==='reuniao'` abre `meetingLink`
  (`decodeURIComponent`, vem via `extra` do `createNotif()`) em nova
  aba; `type==='gcal_pending'` chama `processGcalQueueForAdmin()`
  direto (mesma ação do botão da toolbar). Todos os 3 últimos + os 4
  `okr_*`: achados via `/monitorarbugs` em 2026-09-06 — antes só
  marcavam como lida e fechavam o painel, sem navegar a lugar nenhum
  (nenhum desses tipos tem `cardId`, e só `intake` tinha tratamento
  especial pra isso). `cardId` presente (todo o resto): abre o card
  (mesmo squad ou redireciona `?squad=`).
- `checkDueNotifs()` — L24931 — due_today/due_overdue, 1x/dia
- `parseMentions()` — L24739 — @menção em descrição/PO/checklist/comentário;
  `@todos` (`TODOS_MENTION_ENTRY`, 2026-09-01) notifica todos os membros do
  squad de uma vez em vez de 1 pessoa.
- `mentionCandidates()`/`mentionMatchLabel()` — L7004/L7023 — autocomplete
  de @; entradas sintéticas (`init` sentinela, nunca um membro real):
  `TODOS_MENTION_ENTRY` (sempre 1ª opção) e `AGENTE_AGIL_MENTION_ENTRY`
  (só em squads com Cloud Function ouvindo).

### Notas
- `toggleNotas()` — L16619, `setNotasScope()` — L16632
- `renderNotasList()` — L16667, `createNota()` — L16699
- `openNota()`/`closeNotaEditor()` — L16715/L16716
- `renderNotaEditor()` — L16979, `toggleNotaModo()` — L17277 (livre/estruturado)
- `renderNotaLinkedCards()` — L16742, `notaSearchCards()`/`notaAddCardLink()`/`notaRemoveCardLink()` — L16760/L16785/L16794
- `renderNotasVinculadasNoCard()` — L16814 — seção "Vínculos" dentro do card

### Automações (Butler-style)
- `AUTO_TRIGGERS` — L27264 (21 triggers — `agendado_created` adicionado
  2026-08-30, par de `recorrente_created` que faltava)
- `AUTO_ACTIONS` — L27339 (15 ações — `notify_all` ["Notificar todos"]
  adicionada 2026-09-01, posta comentário `@todos` + `parseMentions()`
  manual pro fan-out de verdade, mesmo padrão de `notify_agent` mas sem
  squad-gate)
- `runAutoRules()` — L27827 — só decide QUAIS regras batem (síncrono);
  `_runAutoRuleAction()`/`AUTO_RULE_DELAY_MS` (logo acima) aplicam o efeito
  de verdade depois de ~1.2s (pedido direto: dar um respiro visual antes do
  efeito da automação, e mostrar toast "⚡ Automação ... foi aplicada" —
  antes era instantâneo e silencioso) — re-busca o card no momento de
  aplicar (guarda contra card excluído/arquivado durante o delay)
- `_autoTrigger()`/`_autoAction()` — L27469/L27470
- `_autoValLabel()`/`_autoRenderValueOptions()` — L27473/L27496
- **Acesso à tela de Automações** (achado real 2026-08-24: só existia via
  `⚙ Configurações → aba ⚡ Auto`, e o botão de Configurações fica
  escondido de quem não é PO/Organizador/ADM — `_applyRoleVisibility()`,
  L9153 — mesmo sem nenhuma trava de permissão nas ações em si) —
  `openAutoOv()` — L21027 — abre o overlay `#auto-ov` (fora de `#cfg-ov`), acessível
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
  `_claimPendingAuto()` — L27765 / `_refreshCardFromFirebase()` — L27783
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
- `ctxMove(colId)`/`ctxBlock()` — L28214/L28242 — `ctxBlock()` é só
  `ctxMove('blocker')`. Mesmo incidente:
  `ctxMove()` agora aborta com aviso se `colId` não bater com nenhuma
  coluna existente, em vez de gravar um `card.col` órfão —
  `renderNormal()` só mostra um card na coluna cujo id bate exatamente
  com `card.col`, então um id órfão faz o card sumir do board inteiro,
  intacto mas invisível (achável só via painel)
- Menu de contexto do card (`showCtxMenu()` — L28022) — 2026-09-01,
  pedido direto ("mudar prioridade e mudar coluna... deveria abrir a
  lista pro lado pra n ficar mt grande", comparando com o submenu do
  Windows Explorer): "Mover para" e "Prioridade" viraram flyouts em vez
  de listas soltas ocupando a metade do menu. `toggleCtxSubmenu(ev,key)`
  — L28147 — abre/fecha `#ctx-submenu-fly`, elemento ÚNICO e
  INDEPENDENTE (irmão de `#ctx-menu`, não filho — `.ctx-menu` tem
  `overflow-x:hidden`, que corta um filho `position:absolute` que vaza
  da caixa do pai, mesmo com z-index maior; achado só ao tirar
  screenshot de verdade, não bastava checar a classe `.open` via JS),
  reposicionado via JS a cada clique com flip pra esquerda perto da
  borda direita. Conteúdo de cada flyout fica em `_ctxSubmenus.mover`/
  `_ctxSubmenus.prioridade` (preenchido por `showCtxMenu()`). CSS
  reaproveita `.ctx-sub`/`.ctx-submenu`, que já existiam no arquivo mas
  nunca tinham sido usadas em HTML/JS nenhum — sobra de uma feature
  começada e abandonada antes. `hideCtxMenu()` — L28171 — também fecha
  o flyout agora. `ctxCopyLink(cardId)` — L28284 — item novo "🔗 Copiar
  link do card", mesma URL de `shareCardLink()` (botão do modal) mas sem
  precisar abrir o card primeiro — `_cardShareUrl()` ganhou um `cardId`
  opcional (antes só funcionava com `editingId`, o card do modal
  aberto).
- `_doBulkBlockCol()`/`_doBulkUnblockCol(colId)` — L7377/L7399 —
  versões em massa do mesmo par; `_doBulkBlockCol()` ganhou o mesmo
  guard de existência da coluna
- `delColumn(i)` — L21146 — editor de colunas em ⚙ Configurações.
  Bloqueia incondicionalmente excluir a coluna com id `blocker` (não só
  quando `blockerMode==='col'` — cards antigos podem carregar esse id
  independente do modo atual da squad; excluir a coluna em modo `tag` e
  só voltar pra `col` depois já causou o incidente uma 2ª vez)
- Ação de Automação "Mover card para coluna" (`AUTO_ACTIONS`, ver seção
  Automações acima) tem o mesmo guard de existência de coluna
- `_meuDiaIsBlocked(card)` — L19225 (dentro da seção "Meu Dia", ver
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
  para coluna" (`AUTO_ACTIONS`, `key:'move_card'`, ~L27340) mudava
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
- **📰 Feed de marcos — fix na contagem dos chips + calendário temático**
  (2026-09-04, pedido direto do usuário: "a contagem ali de 'criados;
  movidos...' deveria refletir os outros filtros aplicados"; "nesse de
  setar a data, coloca o calendario com nosso layout"). Contagem:
  `_timelineFeedMatchesFilter()` dividida em `_timelineFeedMatchesFilterBase()`
  (usuário/subtime/tag/só eu, sem o check de tipo) + o check de tipo por
  cima — `_renderTimelineFeed()` agora conta `nCriado`/`nMovido`/etc.
  sobre `todos.filter(_timelineFeedMatchesFilterBase)` em vez de `todos`
  puro, refletindo os outros filtros sem zerar o número do próprio chip
  ao desligá-lo (mesma garantia de antes, base diferente). Calendário:
  `#tf-de`/`#tf-ate` ganharam o botão `📅` (`class="dp-btn"`,
  `onclick="_dpOpen('tf-de',this)"`) que todo campo de data do app já usa
  (`_dpOpen()`/`_dpPick()`/`_dpRender()`, ~linha 17833) — antes só o
  input nativo (ícone do navegador já ficava escondido via CSS, mas sem
  o botão temático de abrir o popover).

### ⏸ Pausar card (tempo/métricas — 2026-09-03)
- `togglePauseCard()`/`_renderPauseBtn()`/`_cardPausedMs()` — perto de
  L13794 — botão "⏸ Pausar"/"▶ Retomar" no rodapé do modal (`#btn-pause-
  card`). Diferente de 🚧 Impedimento (visível pra todo mundo, tag/coluna
  própria): pausar é discreto, só o botão e o 📜 Histórico revelam.
- Modelo de dado: `card.paused` (bool) + `card.pausedAt` (ISO, pausa
  ATUAL em andamento) + `card.pausedMs` (acumulado de pausas já
  encerradas). `_cardPausedMs(c)` soma os dois.
- `_cardTempos()` (relatório de tempo/cycle/lead, perto de L17791)
  subtrai `_cardPausedMs(c)` do tempo decorrido (lead E cycle), com
  clamp em 0. Réplica deliberada em `functions/agente-agil-orquestrador/
  tools/visaoBoard.js` (`cardPausedMs()`/`cardTempos()`) — mesma
  duplicação já documentada nesse arquivo (kanban.html sem `<script
  src>` externo, Cloud Function CommonJS) — sem essa réplica, `visao_
  board` (usado pelo orquestrador e por `analisePO.js`) ficaria
  divergente do relatório client-side pra um card pausado.
- `_cardDataCriacaoStr()` — L17786, logo acima de `_cardTempos()` — data
  de criação (YYYY-MM-DD) com fallback pra `card.flow.log[0].at` quando
  `card.createdAt` falta (dado legado). Usada por `_cardColunaEmDia()`
  (CFD, ~L18273) e pelo filtro de escopo de `_renderBurndown()`
  (~L18340) — achado `/monitorarbugs` 2026-09-04: os dois liam
  `card.createdAt` puro e descartavam pra sempre um card sem o campo,
  em vez de cair no mesmo fallback que `_cardTempos()` já tinha.
- Visibilidade do botão: escondido em `openNewCard()` (pausar só faz
  sentido pra card já existente, com cycle/lead já em andamento).

### Padrões de card (cardPatterns) — never indexado antes desta rodada
Presets de campos/seções (`config/cardPatterns`, editor em ⚙ Configurações)
aplicáveis a um card via `setCardPattern()`; 3 bugs reais achados aqui em
dias recentes (#589/#590/#600/#605, todos `/monitorarbugs`), sempre a
mesma classe de problema — um dos 5-6 pontos que mexem no padrão ficando
pra trás de um comportamento que os outros já tinham.
- `criarPadraoCard()`/`renomearPadraoCard(id)`/`definirPadraoDefault(id)`/
  `excluirPadraoCard(id)` — L21726/L21737/L21747/L21756 — as 4 gravam
  direto em `config/cardPatterns` (`fbSet`), sem tocar um card já aberto
  na hora (dependiam só do round-trip do listener até o fix abaixo)
- `togglePadraoSecao(id, key, visible)` — L21766 — única das 5 que já
  atualizava o card aberto na hora, via `_applyCardSectionsVisibility()`
- `setCardPattern(patId)` — L21791 — aplica o padrão ao card (chamado na
  criação E na edição)
- `_refreshOpenCardPattern()` — L21721 (achado 2026-08-30, PR #605) —
  helper que replica o par `populateCardPatternSelect()` +
  `_applyCardSectionsVisibility()` que o `fbListen` de `config/
  cardPatterns` já fazia; chamado agora pelas 4 funções do 1º bullet, pra
  fechar a mesma janela de inconsistência visual que só `togglePadraoSecao`
  corrigia (alcançável de verdade: `mnavGo('cfg')` no nav mobile abre
  Configurações sem fechar um card já aberto)
- `_applyCardSectionsVisibility()` — L6741 / `populateCardPatternSelect()`
  — L21778
- `setCardCover(colorId)` — L6631 (achado 2026-08-29, PR #600): branch de
  card NOVO (`!editingId`) não disparava `runAutoRules('cover_set', ...)`
  — só o branch de card existente chamava; mesma classe de bug em
  `setCardPattern()`/`saveCard()` (branch de criação) pra `padrao_set`/
  `tag_added`/`submarca_set` — trigger de Automação dispara certinho numa
  EDIÇÃO do campo, mas não disparava quando o card já nascia com o campo
  preenchido no 1º Salvar. Fix: as 3 chamadas de `runAutoRules()`
  correspondentes adicionadas no branch de criação de `saveCard()`.

### Agente Ágil (client-side — atalhos que postam @menção real)
- `AGENTE_AGIL_MENTION_SQUADS` — L6822 — squads onde os atalhos abaixo
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
  `_stopAgenteAgilThinking()` — L6927/L6948 — estado efêmero client-side
  (`window._agenteAgilThinking`, não persistido) enquanto uma @menção real
  aguarda resposta; abre um listener TEMPORÁRIO em `card_comments`
  (mesma técnica de `_attachAgenteHotlineCommentsListener`, sem duplicar
  pro card hotline) que se auto-encerra ao ver um comentário
  `uid==='agente-agil'`, ou por timeout de 120s. `_updateAgenteThinkingBanner()`
  — L6955 — atualiza o banner `#m-agente-thinking` no modal;
  `_textMencionaAgenteAgil()` — L6965 — detecta @menção real (mesmo
  critério do backend) num comentário digitado à mão em `submitComment()`
  (chamada síncrona de `_dispatchAgenteAgilComment()` não precisa dessa
  detecção — todo call site dela já posta `@Agente Ágil` literal). Chip
  correspondente em `makeCardEl()` (board) e banner dentro do modal.
- `insightsCard()` — L15930 — botão "🤖 Insights" no rodapé do card
- `ctxInsights()` — L28274 — opção "Insights" no menu de contexto do card
- `_pedirResumoMeuDia()` — L19345 — botão "🤖 Resumo do Agente Ágil"
  dentro do painel "🌅 Meu Dia" (`openMeuDia()` L19241/`renderMeuDia()`
  L19271) — chama `agenteAgilResumoMeuDia` (onRequest, ver seção
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
- `renderAgenteLog()` — L20974 — aba "🤖 Histórico do Agente" em
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
  (`AGENTE_AGIL_MENTION_SQUADS`, gate em `openCfg()` — L20921);
  Configurações inteiro já é PO/Organizador/ADM-only (`#fab-cfg-btn`, ver
  `_applyRoleVisibility()`), não precisa de
  gate de papel próprio aqui.

### Externos / segurança
- `_extKey()` — L30825 — chave de e-mail sanitizada (`.` → `,`)
- `salvarExterno()` — L30826

### Intake (pedidos pendentes — formulário público E `criar_card` do Agente Ágil)
- `renderIntakeBody()` — L19502 — lista de `intakePendentes`
  (`_intakeBucket`, alimentado por listeners granulares em
  `intake_pending`, ver comentário na declaração). 2026-08-27: mostra
  `🤖` no título + linha "🏷 Submarca sugerida" quando o item veio do
  `criar_card` do Agente Ágil (campos `origem`/`submarca`, ver
  `functions/agente-agil-orquestrador/tools/criarCard.js`) — antes
  desses campos existirem, a tela só sabia renderizar pedidos do
  formulário público.
- `_intakeCriarCard(id)` — L19524 — abre o modal de novo card pré-
  preenchido; casa `squadDemandante` E (2026-08-27) `submarca` contra
  tags reais por label (case/acento-insensitive, `_norm()`), pré-
  marcando a tag — mesmo cuidado do bugfix de "usar modelo" (saveCard()
  valida submarca lendo o VALOR do `<select id="m-submarca">`, não
  `editingTags`, então os dois precisam ser setados).

### Backup
- `exportBackupJSON()` — L30927
- `maybeSnapshot()` — L10504
- `_applyRestorePayload(payload)` — L31452 — "🧯 Restaurar backup". Achado
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
- L21039 Ágil, L21124 Col editor, L21182 Usuários, L21468 Tags,
  L21867 "Worker / Firebase" (nome do comentário é antigo — hoje é
  config/legado de Firebase, **não** tem relação com o Cloudflare Worker,
  que não existe mais na arquitetura atual)
- L26531 D&D das colunas, L26600 D&D dos cards

## painel.html (prod — painel-dev.html diverge, confira com `diff` antes de assumir paridade)

### Sino de notificações do PAINEL (`loadPainelNotifs()`/`renderPainelNotifs()`)
UI separada do sino do kanban (`createNotif()`/`openNotif()`, ver
`CODE_MAP.md` de `kanban-dev.html`) — mesmo Firebase
(`kanban/usuarios/{uid}/notificacoes`), visível só pro ADM
(`_isAdmPainel()`), unifica notificações + lembretes próprios de squad
(`_kind:'notif'`/`'lembrete'`). `loadPainelNotifs()` registra os
listeners 1x; `_mergePainelNotifs(groupKey, items)` reconcilia por
grupo (1 grupo por squad de lembretes + 1 de notificações) em
`_painelNotifs`. Navegação ao clicar: `n.link` (existe, ex.:
`type:'rascunho'`→`link:'pessoas'`) → `swPtab(n.link)`; senão
`n.cardId && n.squad` → abre o card no board (`kanban(-dev).html?
squad=...&opencard=...`). **`n.link` era descartado no mapeamento de
`loadPainelNotifs()` até 2026-09-06** (`/monitorarbugs` — clicar em
"rascunho aguardando revisão" nunca navegava, apesar do código já
prometer isso nos dois lados) — corrigido incluindo `link:n.link||''`
no `.map()`.
- `_painelTryOpenTabFromUrl()` (2026-09-06) — deep-link genérico
  `?tab=<id>`, chamado direto no `fb-ready` (não depende de nenhum
  listener carregar dados antes — diferente de `_okrTryOpenFromUrl()`,
  que espera `okrObjetivos`). Troca de aba só, sem abrir um registro
  específico — usado pelo redirect de `openNotif()` (kanban-dev.html)
  pra notificação de feedback (`?tab=monitor`).
- `_restoreTab()` — **código morto** (achado incidental,
  `/monitorarbugs` 2026-09-06): lê `localStorage('_painel_tab')` e
  chamaria `swPtab()`, mas nunca é invocada em lugar nenhum — o painel
  sempre abre na aba "Visão" (única com `.on` fixo no HTML), mesmo
  `swPtab()` continuando a salvar a aba ativa a cada troca. Não
  corrigido ainda (fora do escopo daquela rodada — era sobre clique não
  navegar, isso é falta de persistência entre sessões).

### Aba "🛤️ Timeline" (criada 2026-09-04, presente nos dois arquivos —
promovida pra prod v3.09 · painel; revisão de UI/UX + visual "glass"
promovida pra prod v3.10 · painel)
Timeline agregada cross-squad, versão do painel da Timeline que já existe
em `kanban.html` (ver seção correspondente no `CODE_MAP.md` de lá) —
mesmos buckets progressivos, mas somando cards de TODAS as squads visíveis
de uma vez. `renderPainelTimeline()`/`_painelTimelineRow()`/
`_painelTimelineFimSemana()`, logo antes de `renderTrend()`. Chamada em
2 lugares: `swPtab()` (troca pra aba `timeline`) e `renderAll()` (a cada
poll de 60s). Tab `#ptab-timeline`/pane `#ppane-timeline` (entre Fluxo e
Pessoas), stats em `#pt-stats`, buckets em `#pt-buckets`.
- **Zero leitura nova** — usa o `squadData` já carregado pelo polling de
  60s (`POLL_MS`/`_applySquadDados()`).
- Clique no card chama `openPcModal(squadId,cardId)` (o modal read-only +
  link-out já existente) — sem edição inline.
- "Concluído" usa a mesma simplificação `c.col==='done'` que o resto do
  painel usa (`renderSquadCards`/`renderColDist`/etc.) — painel nunca
  busca `flowConfig` por squad, não introduz um 2º conceito de "done" só
  pra esta aba.
- Deliberadamente sem "ação no lugar" (editar prazo inline), sem marcos
  de contexto (eventos de calendário) e sem 📰 Feed de marcos — todos
  presentes na Timeline do `kanban-dev.html`, possíveis evoluções
  futuras desta aba.

**Revisão de UI/UX (2026-09-04, presente nos dois arquivos — promovida
pra prod v3.10 · painel)** — pedido
direto: "a timeline no painel ta mt ruim de ui/ux!... acho ruim o filtro
ficar em outra aba... como sao muitas informações, tem q ter uma outra
forma de expor... talvez um botao que colapse logo em cima".
- **Filtro local** (`#pt-filter-select`, no cabeçalho da própria aba) —
  reconstruído a cada render com `<option>` de `SQUADS`+`GERENCIAS`,
  `onchange="setFilter(this.value)"`. NÃO é um filtro paralelo: lê/escreve
  a MESMA `activeFilter` global que os botões da aba Visão — os dois
  ficam sincronizados nos dois sentidos (`renderPainelTimeline()` faz
  `selEl.value=activeFilter` a cada render, então mudar pela Visão também
  atualiza o select daqui).
- **Buckets colapsáveis** — cada `secao()` virou um `<details
  class="pt-bucket">`/`<summary>` com chevron próprio (`.pt-chevron`,
  CSS rotaciona 90° via `.pt-bucket[open] .pt-chevron`, marcador nativo
  do `<summary>` escondido). "Sem prazo" (antes um caso especial fora de
  `secao()`) foi unificado no mesmo helper.
- **`_painelTimelineOpen`** (objeto em memória, chaves
  `atrasado`/`hoje`/`amanha`/`resto`/`prox`/`depois`/`semPrazo`) guarda
  o aberto/fechado de cada bucket ENTRE renders — sem isso a poll de 60s
  (que reconstrói `#pt-buckets.innerHTML` do zero) fecharia de volta
  qualquer bucket aberto manualmente. `atrasado`/`hoje` começam `true`
  (mais urgente), resto `false`. `ontoggle` em cada `<details>` chama
  `_painelTimelineSetOpen(key, this.open)` pra persistir o clique manual.
- **`_painelTimelineToggleAll()`** — botão "🔼 Recolher tudo"/"🔽 Expandir
  tudo" dentro de `#pt-stats` (rótulo dinâmico: oferece expandir se menos
  da metade dos buckets estiver aberta, senão oferece recolher); seta
  todas as chaves de `_painelTimelineOpen` pro mesmo valor e re-renderiza.

**Visual "glass" portado do kanban.html (2026-09-04, presente nos dois
arquivos — promovido pra prod v3.10 · painel)** — pedido direto,
comparando prints: "quero esse layout bonito de glass no painel tb"
(referência: `.meudia-row`/`tagsHtml()` da
Timeline de `kanban-dev.html`). `_painelTimelineRow()` reescrita —
trocou `.panel-card`/`.pc-chip` (chips cinza empilhados, mesmo visual de
Bloqueios/OKR/Risco) por classes novas e exclusivas da Timeline:
`.pt-row`/`.pt-row-title`/`.pt-row-meta`/`.pt-tag`/`.pt-avatar` (perto
de `.pt-bucket`, CSS) — prefixo `pt-` pra nunca colidir com
`.panel-card`/`.pc-chip`, que continuam do jeito de sempre nas outras
abas. Avatar com iniciais (`_painelOwnerAvatarHtml()`), título+prioridade
+impedimento numa linha (emoji pequeno, não mais chip), meta compacta
"squad · coluna · responsável · prazo" numa linha só, e tags com cor de
verdade — `_ptTagsHtml()`/`_ptCardTags()`/`PT_PALETTE`/`_ptHexA()`, mesmo
padrão de paleta+`.hex` customizado que `tagHtml()`/`getPal()`/`PALETTE`
já usam no board, só que a definição da tag vem de
`squadData[sqId].tags` (por squad) em vez de um array global `tags`.
`secao()` também trocou o container de `.grid-2` (2 colunas) pra lista de
1 coluna, mais compacta. Achado incidental: `c.title` estava sendo
injetado sem `esc()` (única string de card não escapada nessa função) —
corrigido junto.

**Redesenho — filtros compostos + Histórico/Feed de marcos (2026-09-04,
presente nos dois arquivos — promovido pra prod v3.11 · painel)** —
pedido direto: "sao muitooooos cards!... mais filtros e filtros q se
conversem... historico
e as definições (criado, movido, concluido)". Substitui as duas
limitações que a seção acima registrava como "possível evolução futura".
- **Filtros compostos** (`_painelTimelineFilter`, objeto
  `{owner,tagLabel,prio,texto}`) — combinam em AND com o filtro de squad/
  gerência já existente (`activeFilter`). Selects novos
  `#pt-filter-owner`/`#pt-filter-tag`/`#pt-filter-prio` + input
  `#pt-filter-texto` (debounce 180ms via `_painelTimelineSetFilterTexto()`,
  só por desempenho — o campo nunca perde foco porque `#pt-filters` NUNCA
  é reconstruído por inteiro, só o `.innerHTML` dos 3 `<select>` a cada
  render). "Se conversam":
  `_painelTimelineOwnerOptions()`/`_painelTimelineTagOptions()` recebem o
  pool JÁ filtrado por squad/gerência (`poolSquad`, dentro de
  `renderPainelTimeline()`) — trocar de squad estreita as opções de
  Responsável/Tag. Responsável usa chave composta `squadId::init` (não só
  `init`) — iniciais são reaproveitadas entre squads diferentes, um
  filtro só por init misturaria pessoas sem ninguém perceber. Se o
  responsável/tag escolhido não existir mais nas novas opções ao trocar
  de squad, reseta sozinho (~L9186 de `renderPainelTimeline()`).
- **Teto de exibição + "Mostrar mais N"** (`PT_BUCKET_CAP=15`,
  `_painelTimelineExpanded`, `_painelTimelineExpandBucket()`) — dentro de
  `secao()`, cada bucket só renderiza os 15 primeiros cards (ordenados)
  até a pessoa clicar em "Mostrar mais".
- **"📜 Histórico" / Feed de marcos multi-squad** — botão no cabeçalho da
  aba (`openPainelHistorico()`) abre `#pt-feed-ov` (reusa o mesmo CSS
  `.pc-modal-ov`/`.pc-modal` do modal de card, id próprio). Geração de
  marcos: `_ptMarcosNoPeriodo(deStr,ateStr)` — porta
  `_marcosNoPeriodo()` de `kanban-dev.html` pra cruzar todas as squads
  visíveis (`squadVisible()`), lendo `card.createdAt`/`card.flow.log`/
  `card.history` que `squadData` já carrega (zero leitura nova no
  Firebase). 7 tipos, mesmas regras do kanban.html (`_ptFeedRow()`,
  cores em `PT_TIMELINE_FEED_COR`). "Concluído" usa `col==='done'` (mesma
  simplificação do resto da aba — sem `flowConfig` por squad). Filtro
  PRÓPRIO do Feed (`_ptFeedFilter`: `squad`/`owner`/`tagLabel`/`tipos`),
  independente de `_painelTimelineFilter` da Timeline principal — mesmo
  motivo do kanban.html (retrospecto não pode encolher só porque um
  filtro ficou ligado no board por outro motivo); reseta a cada abertura
  (`openPainelHistorico()`) ou busca de novo período
  (`_ptFeedBuscarPeriodo()`).
- Helper compartilhado novo: `_ptCardHasTagLabel(c,sqId,label)` — usado
  tanto pelo filtro da Timeline quanto pelo do Feed.
- Testado com Playwright (25 cenários) — ver `CHANGELOG.md` v3.15 ·
  painel-dev pro detalhamento.

**3 achados reais testando em produção (2026-09-04, só em
`painel-dev.html` por enquanto)** — ver `CHANGELOG.md` v3.16 ·
painel-dev pro detalhamento completo. Resumo:
- `[data-theme="vice"] .badge{color:var(--txt);}` — número do badge
  (ex.: contagem do bucket "Atrasado") ilegível no tema Vice City (mesmo
  tom rosa-poeira do texto e do fundo). Mesmo padrão já usado em
  `.hd-badge`/`.col-cnt` no kanban-dev.html.
- `_squadMembersFromGlobalCache(sqId)` (perto de `_globalUsersCache`,
  L~8091) — bug real e pré-existente: `_applySquadDados()` (caminho de
  squad FIXA via `loadAll()`) nunca preenchia `squadData[sqId].members`,
  então `resolveOwnerName()`/avatares nunca tinham foto (só iniciais),
  pra nenhuma squad fixa. Deriva members do `_globalUsersCache` já
  carregado (zero leitura nova); usado em `_applySquadDados()` e
  re-derivado dentro de `loadGlobalUsers()` (corrige a corrida de a
  squad carregar antes do cache global). `_painelOwnerAvatarHtml()`
  ganhou 2º parâmetro `sqId` e renderiza `<img>` quando a pessoa tem
  foto.
- `_ptFeedRow()`: quando o período do Histórico tem mais de 1 dia, a
  hora vira `DD/MM HH:mm` (mesmo fix espelhado em `_timelineFeedRow()`
  do kanban-dev.html).
- `.pc-modal-ov`/`.pc-modal`/`.pc-modal-hd`/`.pc-footer` (perto de L530)
  — fundo/borda hardcoded (não `var(...)`) ficavam incoerentes nos temas
  claro/Vice City; passam a usar `rgba(var(--deep-rgb),...)`/
  `rgba(var(--ink-rgb),...)`/`var(--glass-b)`. Afeta os DOIS modais que
  usam essas classes (card + 📜 Histórico).

### Aba "🎯 OKR" (Objetivos/Marcos, Fase 1 — 2026-09-04, presente nos dois arquivos — promovido pra prod v3.18)
Internalização do PDF trimestral "Iniciativas Estratégicas" (Azzas/Hering)
direto no painel — pedido do chefe do usuário depois de ver o Supercard,
mas com estrutura e nomes PRÓPRIOS (não é supercard: não usa
`childCardIds`, dados globais fora de squad). Ver `CHANGELOG.md`
v3.18 · painel-dev pro racional completo das decisões de produto.
- `OKR_GERENCIAS` — 7 entradas (Geral/Comercial/Marketing de Performance/
  Dados e IA/CX/Tech/CRM, as capas do PDF-fonte). Lista PRÓPRIA, não
  reaproveita a `GERENCIAS` do Dashboard (aquela é squad-bound, usa
  `squadIds:null` como catch-all de Comercial — Tech/CX/CRM/Geral não
  têm squad, quebraria o catch-all).
- `OKR_STATUS` — 5 estados (⚪ Não iniciado/🟢 No prazo/🟡 Risco/🔴
  Atrasado/✅ Concluído — semáforo do PDF + Concluído explícito, pedido
  direto). `_okrObjStatus(objId)` deriva o status do OBJETIVO a partir do
  pior status entre os marcos ativos — nunca setado manualmente.
- Dados: `kanban/okr/objetivos/{id}` e `kanban/okr/marcos/{id}` (marco
  tem `objetivoId`, mesmo padrão flat de `childCardIds` mas em nó
  próprio); comentários em `kanban/okr/marco_comments/{marcoId}/
  {commentId}`, mesmo formato de `card_comments`. Regra nova em
  `database.rules.json` (`kanban.okr`, espelha `kanban.painel`) —
  deploy (`firebase deploy --only database`) já feito (2026-09-04).
- `loadOkr()` — `_onValue` nos dois nós, populam `okrObjetivos`/
  `okrMarcos`. Chamado no boot junto de `loadGlobalUsers()`.
- Permissão: `_okrCanEdit(obj)`/`_okrCanCreate()` — só responsável(is) do
  objetivo + ADM, check client-side (mesmo padrão de gating de UI do
  resto do app, sem ACL granular no Realtime Database).
- Pessoas (responsável/participantes) via picker GLOBAL
  (`_okrPessoaOptions()`/`_okrPessoaInfo()`), fonte é `_globalUsersCache`
  — não amarrado a squad, ao contrário do resto do painel.
- `openOkrObjetivo(id)`/`openOkrMarco(id,objId)` — modais reaproveitam
  `.pc-modal-ov`/`.pc-modal` (já theme-safe, ver seção Histórico acima).
  1 modal por vez: abrir um Marco fecha visualmente o Objetivo, `closeOkrMarco()`
  reabre o pai atualizado.
- **Achado real (testado antes de sair, não chegou a produção)**:
  qualquer "+ Add" de lista/checklist/tag/participante/status
  re-renderiza o modal inteiro a partir do rascunho em memória
  (`_okrObjDraft`/`_okrMarcoDraft`) — sem sincronizar os campos de texto
  de volta pro rascunho antes, o que já tinha sido digitado sumia.
  `_okrSyncObjDraftFromDom()`/`_okrSyncMarcoDraftFromDom()` corrigem,
  chamados no início de toda função de lista/pessoa/checklist/tag/
  participante/status antes de re-renderizar.
- "🎯 Cards do board com badge OKR" (`renderOKR()`) mudou de casa: antes
  na aba Visão, agora dentro desta aba nova, junto do resto do assunto.

#### Extensão (2026-09-04, presente nos dois arquivos — promovido pra prod v3.19): Histórico, vínculo de cards, tags, notificações
Pedido direto do usuário depois de testar a Fase 1. Ver `CHANGELOG.md`
v3.19 · painel-dev pro racional completo.
- **Histórico**: `OKR_HIST_CAP`/`OKR_OBJ_HIST_FIELDS`/`OKR_MARCO_HIST_FIELDS`/
  `OKR_OBJ_LIST_FIELDS`/`OKR_HIST_TIPOS`, `_okrRecordHistory(entity,what,tipo)`,
  `_okrHistDiffObj(draft,before)`/`_okrHistDiffMarco(draft,before)`,
  `_okrDiffStringArray()` (diff genérico Set-based, usado por
  trimestres/indicadores/tags/etc.), `renderOkrHistory(entity)` — mesmo
  padrão de `recordHistory()`/`_histDiff()`/`renderHistory()` do
  kanban-dev.html (`card.history[]`), portado pra `objetivo.history[]`/
  `marco.history[]`. `saveOkrMarco()` também empurra um RESUMO pro
  `history[]` do Objetivo pai (via `window._update`, não sobrescreve o
  resto do objetivo) — "evolução do OKR inteiro" num lugar só. Ver
  achado real da rodada seguinte (visual rico) logo abaixo — este bloco
  descreve a versão original (texto simples), já superada.
  **Achado real (2026-09-06, `/monitorarbugs`, técnica 2 — comparar
  contra `_okrArquivarObjetivo()`/`saveOkrMarco()` no mesmo arquivo)**:
  `_okrArquivarMarco()` não registrava NENHUM histórico (nem no próprio
  Marco, nem o resumo no Objetivo pai que toda outra edição de Marco
  sempre empurra) — corrigido pro mesmo padrão. Server-side, o Agente
  Ágil grava história via `pushHistory()`
  (`functions/okr/agenteHelpers.js`), mesmo formato
  `{who,uid,what,tipo,at}` — sem duplicação de bug entre client/server
  aqui (checado nesta rodada).
- **Vínculo de cards** (tipo campanha/coleção, mesmo padrão de
  `notaSearchCards()`/`notaAddCardLink()` do kanban-dev.html, adaptado
  multi-squad): `objetivo.cardLinks:[{squadId,cardId}]`,
  `_okrCardSearchResults(query)` (só cards `isOKR===true`),
  `_okrCardLinkAdd/Remove()`, `_okrCardLinksHtml(podeEditar)` — modo
  leitura esconde busca/botão de desvincular.
- **Tags gerenciáveis** — só nível Objetivo (decisão do usuário: Marco
  continua com texto livre, escalas diferentes). Nó novo
  `kanban/okr/tags/{id}={label,colorIdx}` (`colorIdx` indexa
  `PT_PALETTE`, mesma paleta da Timeline), cache `okrTags`/
  `loadOkrTags()`. `_okrTagCriar()`/`_okrTagApagar()`/`_okrTagAddToObj()`/
  `_okrTagRemoveFromObj()`/`_okrTagPickerHtml()`/`_okrTagChipHtml()`.
- **Notificações** — `_okrNotifyEditado(objId)` (síncrono no save, avisa
  Responsáveis do Objetivo + Participantes de qualquer Marco, decisão do
  usuário; exclui o autor da edição), escreve no MESMO path que
  `createNotif()` (kanban-dev.html) usa (`kanban/usuarios/{uid}/
  notificacoes`) — aparece no sininho de qualquer board sem mudar nada
  lá. Prazo de marco/véspera de reunião precisam de scan diário — ver
  `functions/okr/dailyScan.js` abaixo. **Clicar numa notificação de OKR
  no sino do kanban** navega pra cá via `?okr=<id>`/`?okr=chat` — ver
  `_okrTryOpenFromUrl()` logo abaixo e `openNotif()` em kanban-dev.html
  (seção Notificações in-app).
- **Bloco quinzenal** (substitui os antigos pickers de Google Agenda
  `gcalPeriodoEventId`/`gcalReuniaoEventId`, removidos em 2026-09-05 —
  cada ocorrência de reunião recorrente tinha um ID de evento diferente,
  então um campo único nunca representava "essa reunião se repete a
  cada 2 semanas"): `OKR_BLOCO_AREAS`/`OKR_BLOCO_ANCHOR` (constantes),
  `_okrBlocoDaArea(areaId)`, `_okrProximaReuniaoDoBloco(bloco, hojeStr)`,
  `_okrBlocoInfoHtml(areaId)` — mostra bloco/gerências/próxima reunião
  no lugar dos pickers antigos, em `renderOkrObjBody()`. Fórmula
  espelhada em `functions/okr/dailyScan.js` (`OKR_BLOCO_AREAS`/
  `blocoDaArea`/`ehDiaDeReuniao`) — mudar a fórmula aqui exige mudar lá
  também (comentário cruzado nos dois arquivos). (`_okrBlocoNaData()`,
  mirror não usado por nenhuma tela, removido em 2026-09-06 —
  `/monitorarbugs`, código morto.)
- **`_okrTryOpenFromUrl()`** (2026-09-06, `/monitorarbugs`) — deep-link
  `?okr=<id>`/`?okr=chat`, chamado dentro do `onValue` de
  `kanban/okr/objetivos` (`loadOkr()`) assim que `okrObjetivos` tem o
  1º snapshot completo. Troca pra aba OKR (`swPtab('okr')`) e abre o
  Objetivo (`openOkrObjetivo(id)`) ou a Central Agente Ágil
  (`_okrToggleAgenteChat()`); Objetivo não encontrado → toast, mesmo
  padrão do card não encontrado. Guard `_okrUrlOpenAttempted` evita
  reabrir a cada mudança subsequente no nó. Existe porque antes disso
  clicar numa notificação de OKR não levava a lugar nenhum —
  `openNotif()` (kanban-dev.html) só sabia navegar por `cardId`.
- Achado (mesma classe do já documentado acima pra
  `_okrSyncObjDraftFromDom()`): `_okrTagCriar()` e as novas seções
  também re-renderizam o modal inteiro — todas as novas mutações
  (tag/vínculo) chamam `_okrSyncObjDraftFromDom()` primeiro, mesma
  disciplina já estabelecida.

#### 4 achados reais testando em prod (2026-09-04, v3.20 · painel-dev — presente nos dois arquivos, promovido pra prod v3.20)
Feedback direto do usuário depois de testar a extensão acima já em
produção. Ver `CHANGELOG.md` v3.20 · painel-dev pro racional completo.
- **Bug real: z-index** — `#pc-modal-ov{z-index:210;}` (CSS, perto de
  L593) — antes empatado em 200 com `#okr-obj-ov`/`#okr-marco-ov`
  (mesma classe `.pc-modal-ov`), ordem de empilhamento virava ordem no
  DOM e o visualizador de card pintava por baixo do modal de OKR.
- **Multi-trimestre**: `objetivo.trimestres:[]` (lista, reusa
  `_okrListEditorHtml()`) no lugar do antigo `objetivo.trimestre`
  (string única). `_okrTrimestresOf(o)` — helper de compatibilidade,
  lê `trimestres` com fallback pro campo antigo, sem migração de dado;
  chamado em toda leitura (filtro, badge do card, modal readonly,
  normalização do draft em `openOkrObjetivo()`).
- **"Ver arquivados"**: `_okrShowArquivados` (bool) +
  `_okrToggleArquivados()` — inverte a lista inteira entre ativos/
  arquivados. `_okrDesarquivarObjetivo(id)` (par de
  `_okrArquivarObjetivo()`) — botão no modal troca "Arquivar" por
  "Desarquivar" quando `d.arquivado===true`.
- **Histórico com visual rico** ("timeline bonitinha de rede social",
  pedido literal do usuário): `OKR_HIST_TIPOS` (ícone+cor por tipo —
  🎯 criado/📝 campo/👤 responsável/📋 lista/🏷️ tag/🔗 vínculo/🏁 marco/
  📊 status/💯 checklist/📦 arquivado), entradas ganham `uid` (renderiza
  `_okrAvatarHtml()`, mesmo componente da Fase 1) e `tipo` (borda
  colorida). Cobertura expandida: `_okrDiffStringArray()` cobre
  trimestres/Indicadores/Progressos/Próximos Passos/Riscos/Planos de
  Ação/tags do objetivo, mais diff de `cardLinks`/`tagIds`/
  `participantes` do marco — antes só campos principais + responsável.

#### 📈 Histórico semanal — Fase 3 (2026-09-05, v3.21 · painel-dev — promovida pra prod v3.23 em 2026-09-05)
Visualização de `kanban/okr/snapshots/{data}`, gravado toda sexta pela
Cloud Function `okrWeeklySnapshot` (ver seção `okr/` em Cloud
Functions). `okrSnapshots` (estado local, `loadOkrSnapshots()`),
`_okrShowHistorico`/`_okrToggleHistorico()` — mesmo padrão de
`_okrShowArquivados`, alterna a aba OKR inteira entre lista de
Objetivos e histórico (esconde `#okr-toolbar`/`#okr-objetivos-wrap`/
`#okr-section-title`/`#okr-list`, mostra `#okr-historico-wrap`).
`renderOkrHistorico()` popula o `<select>` de Objetivo (só ativos) e
chama `renderOkrHistoricoChart()` — gráfico de barras empilhadas por
status (SVG, mesmo padrão de `renderThroughputChart()`/`.tp-bar` já
usado na aba Fluxo), últimas ~12 semanas. `_okrHistoricoSelectObj(id)`
— tabela de evolução de 1 Objetivo (status/%/marcos por semana, mais
recente primeiro).

#### 🗑 Excluir Objetivo (2026-09-05, v3.23 · painel-dev — promovida pra prod v3.23 em 2026-09-05)
`_okrExcluirObjetivo(id)` — botão "🗑 Excluir" no rodapé do modal
(`renderOkrObjBody()`), só ADM (`_isAdmPainel()`). Diferente de
`_okrArquivarObjetivo()` (reversível, só esconde da lista de ativos):
exclusão definitiva, sem desfazer — disponível direto no modal,
independente de o Objetivo estar arquivado (mesmo espírito de
`deleteCard()` no kanban.html). Cascade: apaga também todo Marco
filho (`objetivoId===id` em `kanban/okr/marcos`) e os comentários dele
(`kanban/okr/marco_comments`) — escrita atômica multi-path com
`window._update(window._ref(window._db,'kanban/okr'), {'objetivos/'+id:null, ...})`.

#### 💬 Central Agente Ágil — chat pra ajudar a preencher (2026-09-05, v3.22 · painel-dev — promovida pra prod v3.23 em 2026-09-05)
Client-side da Cloud Function `okrAgenteChat` (ver seção `okr/` em Cloud
Functions). Botão `#okr-agente-btn` na aba OKR, `_okrShowAgenteChat`/
`_okrToggleAgenteChat()` — mesmo padrão de toggle de
`_okrShowArquivados`/`_okrShowHistorico`, agora unificado em
`_okrSetView('objetivos'|'historico'|'agente')` (único ponto que decide
qual das 3 vistas mutuamente exclusivas fica visível — `_okrToggleHistorico()`
e `_okrToggleAgenteChat()` só chamam ela). `okrAgenteChatMsgs` (estado
local, `loadOkrAgenteChat()`, `onValue` em `kanban/okr/agente_chat`),
`renderOkrAgenteChat()` (lista de bolhas `.okr-comment.okr-agente-msg`,
acento azul pra humano/teal pra agente via `.okr-agente-msg-humano`),
`_okrAgenteChatSend()` (grava `{id,uid,author,init,foto,text,ts}`, `ts`
sempre `new Date().toISOString()`). Central geral, não presa a um
Objetivo — a conversa inteira (pedidos + respostas) É o histórico de
pedidos, sem viewer de log separado.

#### ❓ Ajuda (help content) da aba OKR (2026-09-05, v3.24 · painel-dev — promovida pra prod v3.24 em 2026-09-05)
Modal estático `#okr-help-ov` (`openOkrHelp()`/`closeOkrHelp()`), mesmo
padrão de `#agentes-help-ov`/`openAgentesHelp()` (reusa as classes
`pev-modal-ov`/`pev-modal`/`pev-hd`/`pev-body`, sem CSS novo). Botão
"❓ Ajuda" no cabeçalho da aba OKR. Conteúdo cobre Objetivo/Marco/status,
permissão (ADM/Responsável), Arquivar×Excluir, Tags/vínculo de cards,
📈 Histórico semanal, a apresentação em slides, e a 💬 Central Agente
Ágil (como pedir, o que ela faz, que respeita a mesma permissão de
edição manual) — pedido direto do usuário.

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

**Fix de contraste no Vice City (2026-09-04, presente nos dois arquivos —
promovido pra prod v3.09)**: achado real do usuário ("monitor, dados e
agentes n da pra ler... backup tb n da pra ler") — as abas `#ptab-monitor`/
`#ptab-dados`/`#ptab-agentes` e os 3 botões `.hd-btn-adm` do cabeçalho
(Backup/Novo board/Usuários) fixam cor de destaque via `style` inline
(`--danger`/`--cyan`/`--accent`/`--teal`/`--warn`), que no Vice City é da
mesma família de tom do fundo `.ocean` — sem contraste. Override
`[data-theme="vice"] #ptab-monitor, ..., .hd-btn-adm { color:var(--txt)
!important; }`, logo após o bloco `[data-theme="vice"] .ocean{}` acima.

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
  recorrente/painel_broadcast/intake/okr_editado/okr_prazo/okr_reuniao/
  okr_agente — os 3 do meio 2026-09-04 (`okr/dailyScan.js`; `okr_periodo`
  removido em 2026-09-05 junto com o gatilho "período de editar"), o
  último 2026-09-05 (`okr/agenteChat.js`)) — L23
- `sendPushOnNotification` — L25
- `agenteAgil` (HTTP, agente v0-v3 mais antigo) — L119 → `agente-agil/http.js`
- `spotifyOauthCallback`/`Disconnect`/`SyncNow`/`Playback`/`RadioOwnerCallback`/`RadioSearch`/`RadioSuggest` — L123–L162 → `spotify/*.js`
- `intakeSubmit` — L168 → `intake/submit.js`
- `weeklyBackup` — L173 → `backup/weeklyBackup.js`
- `okrDailyScan` — L180 → `okr/dailyScan.js` (2026-09-04, novo — ver seção `okr/` abaixo)
- `okrWeeklySnapshot` — L187 → `okr/weeklySnapshot.js` (2026-09-05, novo — Fase 3, ver seção `okr/` abaixo)
- `okrAgenteChat` — L195 → `okr/agenteChat.js` (2026-09-05, novo — chat dedicado com o Agente Ágil, `DRY_RUN_OKR_CHAT=false` desde o 1º deploy, ver seção `okr/` abaixo)
- `agenteAgilMencao` — L209 → `agente-agil-orquestrador/mentionTrigger.js` (orquestrador novo, gatilho por @menção, squad `dev`)
- `agenteAgilMencaoDados` — L220 → mesma fábrica, squad `dados`, ativado em
  escrita real 2026-08-24 (ver seção abaixo)
- `agenteAgilDueOverdueScan` — L239 → `agente-agil-orquestrador/dueOverdueTrigger.js`,
  scan diário (`onSchedule`), item 5 do roadmap — squads `dev` **e**
  `dados` (dados adicionado 2026-08-25), cobre `due_overdue` **e**
  `due_today` (nome ficou de v1, só due_overdue/squad dev — ver seção
  abaixo)
- `agenteAgilResumoMeuDia` — L250 → `agente-agil-orquestrador/resumoMeuDia.js`,
  `onRequest` (não gatilho por evento) — "🤖 Resumo do Agente Ágil"
  dentro de "Meu Dia", 2026-08-25, ver seção abaixo
- `agenteAgilIntake` — L267 → `agente-agil-orquestrador/intakeTrigger.js`,
  squad `dev`, escrita real desde 2026-08-27 (rodou em modo sombra do 1º
  deploy até essa decisão) — 2º gatilho automático do orquestrador, escuta
  `agente_intake_pending/{id}` (ver `agente-agil/http.js` abaixo pro
  porquê de existir)
- `agenteAgilAnaliseDados` — L280 → `agente-agil-orquestrador/analiseDados.js`,
  `onRequest` (não gatilho por evento) — "🤖 Ponto de vista do Agente
  Ágil" dentro dos painéis "Dados do Board"/"Controle de Criativos",
  2026-09-01, ver seção abaixo
- `agenteAgilAnalisePO` — L293 → `agente-agil-orquestrador/analisePO.js`,
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

### okr/ — 2026-09-04, novo (+ `weeklySnapshot.js` e `agenteChat.js`/`agenteTools.js`/`agenteHelpers.js`/`agentePrompt.js` em 2026-09-05)
- `okr/dailyScan.js` — `okrDailyScan`, `onSchedule` todo dia 07:00
  (Brasília), mesmo padrão de `weeklyBackup`/`agenteAgilDueOverdueScan`
  (roda sozinho, sem depender de ninguém abrir o painel). 2 gatilhos
  (redesenhado em 2026-09-05 — ver abaixo): prazo de marco chegando (3 e
  1 dia antes, `diasAte()`) e véspera de reunião de **bloco quinzenal**
  (1 dia antes da quinta de check-in OKR do bloco da gerência do
  Objetivo — `blocoDaArea(areaId)`/`ehDiaDeReuniao(dataStr, bloco)`,
  constantes `OKR_BLOCO_AREAS`/`OKR_BLOCO_ANCHOR`). Substitui o antigo
  mecanismo de `objetivo.gcalPeriodoEventId`/`gcalReuniaoEventId` (1
  evento específico do Google Agenda por Objetivo) — quebrava porque
  cada ocorrência de uma reunião recorrente tem um ID de evento
  diferente, então nunca representava "essa reunião se repete a cada 2
  semanas"; o bloco agora é 100% derivado de `areaId` (mapeamento 1:1
  com `OKR_GERENCIAS`), zero input manual. Fórmula espelhada em
  `painel-dev.html` (`OKR_BLOCO_AREAS`/`_okrBlocoDaArea`/
  `_okrProximaReuniaoDoBloco`/`_okrBlocoInfoHtml`, ver seção OKR acima) —
  mudar aqui exige mudar lá também (comentário cruzado nos dois arquivos).
  Escreve em `kanban/usuarios/{uid}/notificacoes`, mesmo path/formato de
  `createNotif()` (kanban-dev.html), reusando o tipo `okr_reuniao`
  (nenhuma mudança em `PUSH_TYPES` foi necessária). `runOkrDailyScan(db,
  hojeOverride)`/`diasAte()`/`todaySP()`/`blocoDaArea()`/
  `ehDiaDeReuniao()` exportados pra teste (mesmo padrão de
  `dueOverdueTrigger.js`; `hojeOverride` existe só pra determinismo do
  teste do gatilho de bloco) — `okr/__tests__/dailyScan.test.js`, 21
  casos (fake DB, sem emulador). Deploy isolado:
  `firebase deploy --only functions:okrDailyScan`.
- `okr/weeklySnapshot.js` — `okrWeeklySnapshot`, `onSchedule` toda
  sexta-feira 17:00 (Brasília) — Fase 3 do OKR: NÃO notifica ninguém
  (isso é `dailyScan.js`), só grava uma foto do status agregado/% de
  progresso de cada Objetivo ATIVO em `kanban/okr/snapshots/{data}`
  (sobrescreve se rodar 2x no mesmo dia). `objStatus()`/
  `objProgressoPct()` replicam a mesma lógica de `_okrObjStatus()`/
  `_okrObjProgressoPct()` do painel/apresentação (pior status entre
  marcos ativos). `runOkrWeeklySnapshot(db)`/`todaySP()`/`objStatus()`/
  `objProgressoPct()` exportados pra teste —
  `okr/__tests__/weeklySnapshot.test.js`, 13 casos (fake DB). Deploy
  isolado: `firebase deploy --only functions:okrWeeklySnapshot`.
- `okr/agenteChat.js` — `okrAgenteChat`, `onValueCreated` em
  `/kanban/okr/agente_chat/{msgId}` — chat dedicado com o Agente Ágil
  (central geral, não presa a Objetivo, ver painel-dev.html v3.22).
  Diferente de `mentionTrigger.js`: sem @menção pra detectar (o nó é só
  pra isso). Mesmas 3 travas: anti-auto-disparo (`message.uid===AGENTE_UID`),
  kill switch global (`kanban/config/agente_agil_orquestrador/enabled`),
  idempotência (`kanban/okr/agente_chat_processed/{msgId}`). `processarMensagem(db,{msgId,message,llmClient,dryRun})`
  exportado pra teste, mesmo padrão de `processarMencao()`. Rede de
  segurança: sem chamada de `responder`, posta o `finalText` como
  fallback. Notifica quem mandou a mensagem (`type:'okr_agente'`, no
  `PUSH_TYPES`). **`DRY_RUN_OKR_CHAT=false`** desde o 1º deploy (const no
  topo do arquivo — decisão explícita do usuário via `AskUserQuestion`,
  sem modo sombra intermediário). `okr/__tests__/agenteChat.test.js`, 13
  casos (fake DB + `llmClient` scriptado). Deploy isolado:
  `firebase deploy --only functions:okrAgenteChat`.
- `okr/agenteTools.js` — `buildOkrTools({mode,db,requestingUid,dryRun})`
  — vocabulário 100% novo (orquestrador de card não tem noção de
  Objetivo/Marco, só o motor `loop.js`/`llmClient.js` é reaproveitado):
  `listar_objetivos`/`ler_objetivo` (leitura), `criar_objetivo` (só ADM),
  `editar_campos_okr`/`criar_marco`/`editar_marco` (ADM ou Responsável do
  Objetivo, via `agenteHelpers.canEditObjetivo()`), `responder` (sempre a
  última ferramenta chamada). Campos de lista (Indicadores/Progressos/
  Próximos Passos/Riscos/Planos de Ação) só SOMAM, nunca substituem.
  `resolveMarco()` exportado (resolve por id ou nome dentro do Objetivo,
  erro `marco_ambiguo` se mais de 1 bater). `okr/__tests__/agenteTools.test.js`,
  20 casos.
- `okr/agenteHelpers.js` — `isAdmUid()`/`canEditObjetivo()` (mesma regra
  client-side de `_okrCanEdit()`/`_okrCanCreate()` em `painel.html`,
  replicada servidor-side), `resolveObjetivo()` (por id ou título, só
  aceita título ambíguo se achar exatamente 1 match — exato antes de
  parcial), `pushHistory()` (mesmo formato `{who,uid,what,tipo,at}` que
  `painel.html` já grava pra edição humana, cap de 80 entradas),
  `notifyObjetivoEditado()` (achado real de `/monitorarbugs`,
  2026-09-05: notifica `responsaveis`/participantes de Marco quando o
  chat edita um Objetivo — mesma coisa que `_okrNotifyEditado()` no
  painel já fazia pra edição manual, `type:'okr_editado'`, exclui quem
  editou). Chamada pelos 3 handlers de escrita de `agenteTools.js`
  (`editar_campos_okr`/`criar_marco`/`editar_marco`).
- `okr/agentePrompt.js` — `SYSTEM_PROMPT_OKR_V1`, separado do prompt do
  orquestrador de card (`agente-agil-orquestrador/systemPrompt.js`). Foco
  em TRADUZIR texto corrido pra Progresso/Próximo Passo/Risco, não só
  repetir — e sempre terminar chamando `responder`.

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

*Retrato do commit `7d22d03` (2026-09-05).*
