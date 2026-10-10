# Mapa do código

Índice de âncoras (funções/consts) por área funcional, pra achar código rápido
nos arquivos grandes deste repo (`kanban.html`/`kanban-dev.html` têm ~28.2k
linhas / até ~1.1MB) sem precisar ler o arquivo inteiro.

**Como usar:** os números de linha abaixo são um retrato de um commit
específico (ver rodapé) e ficam desatualizados a cada edição no arquivo —
**sempre confirme com `grep -n "nomeDaFuncao" arquivo.html` antes de confiar
neles pra uma edição**. O valor real deste arquivo é a lista de nomes
(âncoras estáveis), não os números de linha em si.

`kanban.html` e `kanban-dev.html` divergem em 3 linhas PERMANENTES/
deliberadas, nunca promovidas como diff: (1) string de versão +
`VERSION_KEY`/`FB_OVERRIDE_NS`; (2) favicon próprio de cada ambiente
(`favicon.png` em prod / `favicon-dev.png` em dev — `link rel="icon"`,
`apple-touch-icon`, a imagem de splash, e as 2 entradas de ícone do
manifest — commit `ff759f8`); (3) **nova desde 2026-09-21** — a chave do
Firebase que o listener de "Deslogar todos" escuta
(`kanban/global/force_logout_after` em prod, `force_logout_after_dev`
em dev — ver seção "Papéis & autenticação" abaixo). Fora essas 3
divergências permanentes, os dois arquivos ficam byte-idênticos só LOGO
DEPOIS de uma promoção (última confirmada: v8.30.794, 2026-10-07 —
colar lista em tópicos no checklist; antes dela, v8.30.786: externos com conta Microsoft
pessoal + cadastro guiado + 💬 de comentários + chip Híbrido + jsq anti-XSS — ver `CHANGELOG.md`) — o estado NORMAL na maior parte do
tempo é `kanban-dev.html` ter um lote acumulado não promovido ainda
(volta a acontecer assim que o próximo commit em dev acontecer). Os
números abaixo são os de `kanban-dev.html` (o superset). Se o `diff`
entre os dois mostrar mais do que essas 3 divergências conhecidas + um
lote pendente do momento, refaça o grep no arquivo específico que você
está editando (provavelmente `kanban-dev.html`).
`painel.html`/`painel-dev.html` **divergem de verdade** (dev tem
instrumentação extra) — os números da seção painel abaixo são de
`painel-dev.html` (o superset, mesmo padrão do par kanban — sempre
re-`grep` no arquivo específico que você está editando antes de
confiar num número aqui se for mexer em `painel.html` prod).

## kanban.html / kanban-dev.html

### Papéis & autenticação
- `ADM_EMAILS` (let) — L6677
- `getEffectiveRole()` — L6715 — papel efetivo, ADMs hardcoded não são rebaixáveis
- `loadSquadsFromFirebase()` / `SQUAD_META_LIVE` — L6808 / L6777
- `resolveSquadAndShow()` — L10957 — resolve squad da URL, decide o que mostrar
- **`force_logout_after` (botão "Deslogar todos") — chaves DIVERGEM de
  propósito entre prod/dev, promovido pra prod em v8.30.716**
  (2026-09-21, `/monitorarbugs`): listener em `kanban-dev.html` — L33667
  — escuta `kanban/global/force_logout_after_dev` (escrito por
  `deslogarTodos()` em `painel-dev.html` — L8011); `kanban.html` — L33667
  — escuta `kanban/global/force_logout_after` (sem sufixo, escrito por
  `deslogarTodos()` em `painel.html` — L8066). Antes desta correção as duas
  chaves eram confundidas (botão do painel-dev.html era um no-op; botão do
  painel.html de produção deslogava a produção com um aviso que dizia o
  contrário). **Essa é uma 3ª linha que diverge deliberadamente entre
  kanban.html/kanban-dev.html na promoção dev→prod** (além de versão/
  `VERSION_KEY`) — nunca copiar essa linha ao promover.
- `autoRegistrar()` — L11225 — cria/atualiza o doc do usuário no login.
- Cadastro guiado (2026-10-05) — `_squadsDoExterno()`/`_squadsElegiveis()` (squads onde o e-mail é externo / todos p/ domínio
  confiável), `_pedirSquadCadastro()` (tela `#cadastro-ov` "Complete seu cadastro", classe própria `.cad-ov` acima do login-ov),
  `_completarSquadFaltando()` (usuário sem nenhum squad, chamado por `resolveSquadAndShow()`). `autoRegistrar()` trata registro
  parcial (`_parcial`), aguarda a gravação, e recarrega 1x o externo recém-cadastrado; o gate de externos no listener
  `auth-change` consulta outros squads (`_squadsDoExterno`) antes de recusar.
  (2026-09-09) Branch de usuário JÁ EXISTENTE agora também cura `nome`
  (sincroniza sempre que diverge do Auth, mesmo padrão que `foto` já
  tinha) e `email` (cura só se vazio) de volta em `kanban/usuarios/{uid}`
  — antes só escrevia esses 2 campos no espelho leve `usuarios_publicos`,
  nunca no registro principal, deixando um registro nascido incompleto
  (ex.: criado só via painel, ver `_painelEnsureUserRecord()`) sem nome
  pra sempre mesmo com login repetido.
- `_claimUserInit()` — L11164 / `_ensureInitRegistryBackfilled()` — L11207
  — reivindica a sigla (`init`) de um usuário novo de forma ATÔMICA, via
  `runTransaction()` em `kanban/init_registry/{INIT}=uid` (node novo,
  precisa de entrada em `database.rules.json`, deploy manual). Achado
  real (2026-09-17, relato direto: card da Marina Saran Bernardo exibido
  como se fosse do Marciel Santos Alexandrino no painel) — o mecanismo
  antigo em `autoRegistrar()` (ler `usuarios_publicos`, computar
  localmente, escrever) tinha uma janela de corrida real entre 2 pessoas
  se cadastrando quase ao mesmo tempo com o mesmo par de iniciais.
  `editarInicial()` (L25321, troca manual de sigla) também usa a mesma
  transação antes de gravar, e libera a sigla antiga no registro (só se
  o registro ainda apontar pra este uid — sigla pode ser compartilhada).
  `confirmarInscricao()` (L11362, tela "Confirmar inscrição" — pessoa
  edita a própria sigla num campo de texto antes de confirmar) ganhou o
  mesmo tratamento numa rodada seguinte de `/monitorarbugs` no mesmo dia
  — era a 3ª mutação de `init` do arquivo e tinha ficado de fora do fix
  original, mesma corrida exata. As 3 funções caem de volta pro
  mecanismo antigo (não-atômico, mas não trava ninguém) se o registry
  ainda não tiver a regra publicada.
- **`window._signInRedirect()`/fallback de login por redirect (2026-09-29,
  relato direto de usuária — screenshot: popup de login travando com
  "Cross-Origin-Opener-Policy... would block the window.closed call",
  caindo em "Login cancelado" — promovido pra prod v8.30.764)**: `<script type="module">` — L6548 (perto
  de `window._signIn=(insc)=>signInWithPopup(...)`) — causa raiz
  confirmada lendo o SDK vendorizado (`vendor/firebase-10.14.1/
  firebase-auth.js`): `signInWithPopup()` detecta popup fechado checando
  `authWindow.window.closed` (`pollUserCancellation()`), mas a própria
  página de login do Google aplica Cross-Origin-Opener-Policy nela mesma
  — isola o popup, o Firebase não consegue ler `.closed`, interpreta como
  "fechado" e devolve `auth/popup-closed-by-user` mesmo com a pessoa
  ainda logando. Intermitente, só Chrome, fora do nosso controle (não é
  header nosso — GitHub Pages não define COOP aqui). `doSignIn()` — L10896
  — conta falhas SEGUIDAS desse tipo em `login_popup_fail_streak`
  (localStorage) e cai pra `signInWithRedirect()` (sem popup, elimina a
  causa raiz) na 2ª falha — só como fallback, popup continua sendo o
  caminho principal pra não mudar a UX de quem nunca bate nisso.
  `_pendingInsc` (sinaliza "clicou em Inscrever-se") precisa sobreviver
  ao reload de página inteira que o redirect causa — por isso vai pro
  localStorage (`mare_pending_insc`) em vez de `window.*`, restaurado
  SINCRONAMENTE antes de registrar `onAuthStateChanged` (evita corrida
  com `getRedirectResult()`, que não tem ordem garantida contra o
  primeiro disparo real do listener — mesma classe de armadilha de
  `_onRealAuthChange()` logo abaixo). Decisão do usuário via
  `AskUserQuestion`: fallback automático, não trocar o login inteiro pra
  redirect (mudaria a UX de popup pra navegação de página pra todo
  mundo). `reconectarGCal()`/`_requestCalendarScope()` (escopo de
  calendário, provider separado) NÃO ganharam o mesmo fallback —
  reportado como fora de escopo, feature secundária de risco bem menor
  que travar o login inteiro. **Achado real de passagem (2026-09-30,
  `/monitorarbugs`)**: o `<script type="module">` também tinha um
  `window.doSignOut = () => window._signOut('manual');` logo abaixo —
  sobrescrevia (por ser deferred, roda DEPOIS de scripts clássicos) a
  `doSignOut()` real, no `<script>` clássico mais abaixo, que é a única
  que limpa `gcal_token` do `localStorage` ao sair — mesma classe de
  colisão que o comentário acima já evitava pra `doSignIn()`, mas não
  pra `doSignOut()`. Removido, promovido pra prod v8.30.767.
- **Refresh silencioso do perfil — foto/nome/email (2026-10-01, relato
  direto: "tem usuarios q a foto do Google sumiu! la no google msm, a
  pessoa ainda ta c a foto")**: causa raiz confirmada com diagnóstico ao
  vivo (script de console testando cada URL de foto) — o Google trocou o
  FORMATO da URL de foto de perfil (de `.../a-/ALV-Uj...` pro atual
  `.../a/ACg8oc...`) e vem descontinuando o formato antigo; quem registrou
  a conta há mais tempo ficou com a URL antiga salva, que parou de
  resolver — não é dado perdido, só desatualizado (o SDK do Firebase Auth
  só re-busca `photoURL`/`displayName` do Google numa autenticação de
  VERDADE, popup/redirect; numa sessão restaurada — aba aberta por dias
  sem relogar — esses campos ficam congelados). `window._reloadAuthUser()`
  — `<script type="module">`, perto de `window._signOut` — usa `reload()`
  do SDK (oficial, sem popup, sem novo consentimento) pra re-buscar o
  perfil. `_syncAuthProfileToFirebase(user, existeJaLido?)` — L11250 (logo
  antes de `autoRegistrar()`) — a auto-cura de foto/nome/email que já
  existia DENTRO de `autoRegistrar()` (achado de 2026-09-09, ver
  histórico de versões), extraída pra função própria reutilizável;
  `autoRegistrar()` passa o `existe` que já leu (evita 2ª leitura),
  chamada standalone relê sozinha. `setInterval` de 1h (perto da função,
  L11263) — só com a aba em primeiro plano e alguém logado — chama
  `_reloadAuthUser()` então `_syncAuthProfileToFirebase()`, cobrindo
  sessões longas que nunca mais passam pelo login de verdade.
  **Correção da causa raiz (2026-10-01, mesmo dia — o fix acima foi
  promovido mas não resolveu pra Vinicius/André)**: diagnóstico ao vivo
  mais fundo mostrou que o problema NÃO é formato de URL antigo nem
  sessão desatualizada — é o próprio Google, em algumas contas, servindo
  um AVATAR GENÉRICO (quadrado com a inicial) na URL pública de foto
  (`lh3.googleusercontent.com/a/...`) quando acessada de fora da sessão
  autenticada da pessoa no Google (cross-origin, como qualquer app de
  terceiro faz) — mesmo a URL mais NOVA possível, já no formato atual,
  sofre disso (confirmado abrindo a URL direto no navegador). `reload()`/
  `_syncAuthProfileToFirebase()` continuam corretos pro que se propõem
  (manter `photoURL`/banco sincronizados com o que o Firebase Auth
  devolve) — só não têm como corrigir isso, porque a fonte (Google) já
  devolve o placeholder. Solução real cogitada, não implementada:
  permitir upload de foto própria dentro do Maré Digital, independente
  do Google. **Achado incidental, bug real e já corrigido nesta mesma
  investigação**: `#user-avatar` (header, `showApp()` — L11048) só é
  preenchido 1x no login — nunca re-sincroniza com `photoURL` mesmo
  depois do refresh silencioso rodar e mudar o valor — corrigido dentro
  de `_syncAuthProfileToFirebase()` (atualiza `#user-avatar` junto com o
  banco), mesmo sem resolver o caso do Google-placeholder (são 2
  problemas diferentes, este é só uma inconsistência real à parte).
  **(2026-10-01, retomado a pedido: "não tem como forçar uma releitura?")
  — v8.30.774-dev**: `window._relerFotoGoogle()` (`<script type="module">`,
  logo depois de `_reloadAuthUser`) — popup na mesma conta pra pegar
  accessToken OAuth fresco, consulta People API (`photos[].default`) +
  userinfo (`picture`), aplica via `updateProfile()` se achar URL melhor;
  `atualizarFotoGoogle()` (script clássico, perto de `closeStatusMenu()`)
  é o wrapper com toast, exposto no menu do avatar (`openStatusMenu()`,
  só pra `providerData` com `google.com`). Relatório em
  `window._ultimoRelFoto`.
- **Gate de login alinhado ao pin de provedor das regras (2026-10-01,
  `/monitorarbugs`, kanban v8.30.776 / painel v3.88)** —
  `_loginProviderMismatchMsg(user)` (kanban e painel, logo depois de
  `_isTrustedDomainEmail()`) recusa `@ciahering.com.br` fora do Google,
  `@arezzo.com.br` fora da Microsoft e conta sem e-mail (as regras do banco
  só aceitam essas combinações). No kanban, `window._signOut()` termina em
  `location.reload()`, então a mensagem de recusa passa por
  `_rejectLoginAfterReload(msg)` (`login_notice` no localStorage) e
  `_showLoginNotice()` (mostra 1x no boot seguinte); o painel não recarrega,
  escreve direto em `#login-err`.
- **Login via Microsoft (integração Arezzo, 2026-10-01, pedido direto —
  "time de Arezzo usa Microsoft")**: `msProvider` (`<script
  type="module">`, perto de `calProvider`) — `OAuthProvider('microsoft.com')`
  com `tenant:'organizations'` (só contas de trabalho/escola Microsoft,
  nunca pessoal). `window._signInMicrosoft`/`window._signInMicrosoftRedirect`
  — mesmo par popup+fallback-de-redirect que `window._signIn`/
  `window._signInRedirect` já tinham pro Google (ver bullet acima),
  contador de falha PRÓPRIO (`login_popup_fail_streak_ms`, não
  compartilha com o do Google). `doSignInMicrosoft()` — `<script>`
  clássico, ao lado de `doSignIn()`. `TRUSTED_DOMAINS`/
  `_isTrustedDomainEmail()` — perto de `ADM_EMAILS` — centraliza os 3
  pontos que só checavam `@ciahering.com.br` na mão (gate de login no
  listener `auth-change`, atribuição de papel no 1º cadastro, tela "+
  Adicionar externo"); `@arezzo.com.br` tratado como domínio confiável
  de pleno direito (mesmo nível de acesso de `@ciahering.com.br`, não
  como "externo"/convidado). `database.rules.json` ganhou a mesma
  checagem em paralelo nas 52 regras que restringiam a
  `@ciahering.com.br`. **Pré-requisito pendente, fora do código**: só
  funciona de verdade depois de (1) registrar um app no Azure AD/Entra
  ID e configurar o provider Microsoft no Firebase Console (nenhum dos
  dois pode ser feito deste ambiente) e (2) `firebase deploy --only
  database` publicar o `database.rules.json` atualizado.
- `_onRealAuthChange(fn)` — L34691 (perto de `_onFbReady()`) — espera o
  PRIMEIRO `auth-change` com usuário de verdade, ignorando qualquer
  disparo com `null` que aconteça antes (`onAuthStateChanged` dispara
  `auth-change` assim que o listener é registrado, quase sempre com
  `null`, e de novo quando o login termina). Fix real (2026-09-11,
  relato direto: "board abre pós login todo em branco, precisa de F5")
  — os 5 pontos que esperavam login pra rodar (`fbLoadAll()`, sino/
  notifs, backup, lembrete do sino, Mural) usavam
  `addEventListener('auth-change',...,{once:true})`, que é consumido
  pelo PRIMEIRO disparo (o `null`), nunca vendo o real. Qualquer novo
  código que precise esperar o login deve usar esta função, não
  reimplementar `{once:true}` na mão. Mesmo padrão quebrado achado
  independentemente em `painel-dev.html` (`checkOverdueGlobalBackup()`,
  que tem seu PRÓPRIO `onAuthStateChanged`, sem relação com o do kanban)
  — mesma função `_onRealAuthChange(fn)` também existe lá, L12750.

### Agentes de IA (cadastro — piloto híbrido humano+agente)
Identidades de IA (`kanban/squads/{squad}/dados/agentes`, por squad) que
aparecem lado a lado com pessoas nos seletores de Responsável/
Participante — `agentes` (let) — L7183 / `allIdentities()` — L7195
(combina `members`+`agentes` só pra exibição/seleção, NUNCA pra checagem
de permissão). Até 2026-08-31 só existia o listener (leitura) — pedido
direto do usuário ("quero que isso fique mais claro o cadastro"): CRUD
completo em ⚙ Configurações → Usuários → "🤖 Agentes de IA".
- `renderAgentesList()` — L24467 — lista + detecção de colisão de
  iniciais (humano×agente E agente×agente, mesmo padrão de `dupInit` em
  `renderUsuarios()`)
- `abrirAddAgente()`/`editarAgente(id)`/`fecharAddAgente()` — L24211/
  L24220/L24230 — abre/preenche/fecha o form inline (mesmo padrão de
  "+ Adicionar externo", não é modal separado)
- `salvarAgente()` — L24512 — valida nome/iniciais e colisão antes de
  gravar; `excluirAgente(id, nome)` — L24539 — usa `window._set()` direto
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
`AGENTE_AGIL_MENTION_ENTRY` (L6856, só autocomplete de `@`, nunca
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
- `CARD_SECTIONS` — L7119 — seções do modal (Conteúdo, Vínculos, Colaboração...)
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
  **Achado real (2026-09-08, `/monitorarbugs`, relato direto de
  usuário — mudanças em cards não apareciam no histórico)**: mesma
  classe de bug do achado de `tags[]` acima, em 4 campos diferentes.
  `participants[]`/`riscos[]` eram gravados normalmente por
  `saveCard()`/`scheduleAutoSave()` mas nunca tinham diff nenhum
  (corrigido com o mesmo padrão Set-based); `demandante` nem estava em
  `HIST_FIELDS` (diferente de `owner`, que já tinha tratamento
  dedicado em `_histVal()`); e o TEXTO de `blockerReason` só virava
  entrada quando o `blocker` booleano mudava junto — editar só o motivo
  com o impedimento já marcado nunca gerava histórico (diff dedicado,
  só dispara quando `blocker` continua `true` antes e depois, pra não
  duplicar a entrada de marcar/desmarcar).
  **Achado real (2026-09-22, relato direto de usuário — card recém-
  criado com 2 entradas que ninguém gerou)**: mesma classe de "pegadinha
  de vazio/falsy" do achado de 2026-09-06, mas na direção oposta —
  `blocker`/`archived`/`isOKR` nunca entram no objeto de um card novo
  (`_newCard`, branch de criação de `saveCard()` — ficam `undefined` de
  propósito), mas o diff genérico normalizava `undefined`/`null` pra
  `''` igual faz com campo de TEXTO. `String('')`≠`String(false)`, então
  a 1ª edição de verdade (autosave ou Salvar manual), que normaliza os 3
  campos pra `boolean` via `Object.assign`, gerava "removeu o
  impedimento"/"definiu OKR: não" mesmo sem ninguém ter tocado neles.
  Fix: os 3 campos booleanos normalizam com `!!` (undefined/null/false
  todos viram `false`, equivalentes) em vez de `''`.
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
  entradas de Automação/Supercard (client-side, só texto de `who`, sem
  `init`); `HIST_INIT_AVATARS` cobre Agente Ágil/especialista externo
  (server-side — ver abaixo); sem nenhum dos três, cai nas iniciais do
  nome (mesmo fallback de sempre). `.hist-dot` (CSS) removido —
  substituído pelo avatar.
  **Bug corrigido no mesmo dia, achado por print do usuário**: entradas
  de histórico escritas pelo Agente Ágil ANTIGO server-side
  (`functions/agente-agil/outputs/{agentStatus,checklistItem,
  editarCampos,moverColuna}.js` — 5 call sites, todos
  `history.push({who: ctx.actor.who, what, at})`) nunca propagavam
  `ctx.actor.init` (`resolveActor()`, `board.js` — já calculava `🤖`
  padrão/`🔌` especialista externo havia tempos, só não salvava). Sem
  `init` e com `who:'Agente Ágil'` (sem o emoji que o client usa como
  chave de `HIST_BOT_AVATARS`), o avatar caía no fallback de iniciais
  do nome — "Agente Ágil" virava "AÁ" na tela. Fix: os 5 call sites
  passam a incluir `init: ctx.actor.init` no push; `_histAvatarHtml()`
  ganhou `HIST_INIT_AVATARS` (lookup por `init`, não só por `who`) pra
  reconhecer esses casos sem precisar adivinhar toda variação de texto
  que o servidor possa gerar. Entradas gravadas ANTES desse fix
  continuam sem `init` (dado que nunca existiu) — caem no fallback de
  iniciais pra sempre, sem jeito de corrigir retroativamente.
  **Achados reais (2026-09-06, `/monitorarbugs`, "nas construções de
  hj")**: 2 bugs na mesma área, encontrados mapeando os textos de TODOS
  os ~50 call sites de `recordHistory()` contra os dois classificadores
  novos (`_histAvatarHtml()`/`_histTipo()`). (1) **mais severo, técnica
  3 — comportamento contradizia o próprio comentário da chamada**:
  `_applyFanoutTemplate()` (fan-out, botão "🧩 Aplicar receita") passava
  `whoLabel=_histWho()` (nome de pessoa de verdade) como `whoOverride`
  pro `recordHistory()` — mas o comentário de `recordHistory()` já
  documentava que `whoOverride` truthy significa "não é pessoa, é
  Automação/Agente Ágil/Supercard", zerando `init` (sem avatar com
  foto). Resultado: aplicar uma receita manualmente sempre mostrava
  iniciais genéricas no histórico, nunca a foto de quem fez — mesmo a
  pessoa sendo conhecida. Fix: `_applyFanoutTemplate()` só passa
  `whoOverride` de verdade quando o ator é o robô (`user==='⚙
  Automação'`); pra pessoa real, omite o override e deixa
  `recordHistory()` usar seu próprio default (mesmo texto + `init`
  correto). (2) `_histTipo(what)` — 11 frases de caminhos automáticos/
  bulk (recorrência, agendamento, arquivamento por idade/limpeza,
  reatribuir responsável, ações de Automação) não batiam com nenhum
  regex e caíam no ícone genérico ✏️ em vez do ícone próprio do tipo —
  e 1 delas, "impedimento removido automaticamente (card concluído)"
  (auto-desbloqueio em `recordMove()`), caía por engano no grupo
  **impedido** (🚧 vermelho) só por compartilhar a palavra
  "impedimento", mostrando o ícone de BLOQUEIO pro evento oposto
  (desbloqueio) — essa é a mais visível, o comentário da própria
  chamada já dizia "pra ficar indistinguível de uma remoção manual" e o
  código fazia o contrário. Fix: regexes de `_histTipo()` expandidos
  pra cobrir as variações automáticas, e "impedimento removido
  automaticamente" movido pro grupo `desimpedido`. 48 padrões de texto
  testados isoladamente contra os regexes novos, todos corretos. PR
  #778.
- `openCard()` — L14794
- `openAgenteHotline()` — L14703 — card especial fixo por squad "🤖 Converse
  com o Agente Ágil" (`AGENTE_AGIL_MENTION_SQUADS`, hoje `dev`/
  `dados`, os únicos com escrita real do agente — até 2026-08-31 tinha uma
  constante própria `AGENTE_AGIL_HOTLINE_SQUADS` com o mesmo valor,
  unificada na revisão arquitetural dessa data), pra pedido solto que não
  precisa ficar ligado a um card real. É um card de VERDADE no Firebase
  (`agenteHotline:true`, criado sob demanda por `fbCreateCard`, achado via
  `_findAgenteHotlineCard()`) — reusa 100% do mecanismo de `@menção`
  existente, só some do board normal (filtro em `renderBoard()`'s
  `activeCards`) e o modal ganha tema cinza/robô + atalhos
  (`_applyAgenteHotlineSkin()` — L14505, chamado por `openCard()`/
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
- `saveCard()` — L15305 — auto-save (debounce 800ms) passa por aqui.
  Monkey-patched (`saveCard = function(){...}`) perto de L26869, hook
  pra disparar notificações — qualquer chamada em runtime pega essa
  versão, não a declaração original
- `_finishCloseOv()` — L33221 — fechamento do modal, reset de estado pendente
- `_newCardHasContent()`/`_newCardGuardOff` — L13788/L13762 — card ainda sem
  `editingId` (criação em andamento): se título/descrição/tags/checklist/
  riscos/PO/comentário têm algo preenchido, `closeOv('card-ov')` avisa
  antes de descartar (fora, Cancelar, ✕, arrastar no mobile — os 4 já
  passavam por `closeOv`). Não conta responsável/coluna/prazo, que vêm
  com valor padrão só de abrir o modal. `_newCardGuardOff` desarma o
  aviso nos 2 pontos em que o fechamento é legítimo mesmo com
  `editingId` ainda null (sucesso de `saveCard()`, e o fechamento do
  modal reaproveitado pra editar item de Recorrente/Modelo/Agendamento)
- `_navigateToCard(cardId)`/`voltarCardAnterior()` — perto de L13064/
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
- **`_waitForFirebaseReady(timeoutMs=15000)`** — L8920 (2026-09-21, hotfix
  aplicado DIRETO em produção pelo dono do repo via GitHub web, sem passar
  pelo fluxo dev→PR — depois portado de volta pra `kanban-dev.html` pra
  restaurar a sincronia): as 3 primitivas abaixo faziam
  `if(!window._fbReady) return Promise.resolve();` — um save chamado antes
  do SDK terminar de inicializar (`window._fbReady` só vira `true` uma vez,
  perto do boot) confirmava sucesso sem nunca escrever nada. Agora esperam
  o evento `fb-ready` (com timeout) antes de seguir.
- `fbSaveAll()` — L8934 — reescreve `/cards` INTEIRO (só pra operações
  estruturais em lote: duplicar/arquivar em massa, reordenar, importar,
  recorrências/agendamentos) — **nunca usar pra 1 card só**, arrisca
  sobrescrever o array com o estado local de outra pessoa
- `fbCreateCard()` — L9112 — cria 1 card NOVO com escrita pontual,
  posição alocada via `transaction()` no `cards_index` (atômico contra
  criações concorrentes) — achado real 2026-08-24 (squad
  `midiacriativa`, "cards sumindo"): `fbSaveAll()` na criação
  colidia com o mesmo tipo de ação concorrente e apagava cards de
  outras pessoas. Usar sempre pra criar 1 card (modal, duplicar, filho
  de supercard, fan-out)
- `fbSaveCard()` — L9131 — edita 1 card EXISTENTE, escrita pontual
  (usada por drag-and-drop, autosave, etc.). **Espelha
  `window._cardsByKey[key]` de forma síncrona ANTES de escrever, desde
  2026-09-21** — mesmo padrão que `fbSaveAll()`/`fbCreateCard()` já
  usavam (ver comentário nesta última, que literalmente avisava disso e
  nunca tinha sido aplicado aqui). Causa raiz REAL do relato "salvo
  beleza, mas some ao atualizar a página" (3ª causa achada na mesma
  investigação, depois de `_saveCardWithRetry()`/`_flushAutoSave()`
  também terem sido corrigidos sem resolver o sintoma por completo):
  `_applyCardsSync()` (L9541) reconstrói TODO o array `cards` a partir
  de `window._cardsByKey` sempre que o listener de QUALQUER OUTRO card
  dispara, protegido só por uma janela fixa de 2s desde `_lastLocalSave`
  (carimbado no INÍCIO da tentativa, não na confirmação) — sem o
  espelho síncrono, uma escrita que demorasse mais que 2s (comum:
  `_waitForFirebaseReady()`, retry de 3s, latência) ficava vulnerável a
  ser revertida em memória (e às vezes regravada por cima no Firebase)
  por um `_applyCardsSync()` disparado por outro card qualquer, mesmo
  com a escrita original já confirmada com sucesso pelo Firebase.
  **Achado 2026-09-22, mesma classe**: o espelho síncrono só cobria a
  escrita demorada com `_fbReady` já `true` — as 3 primitivas ainda
  carimbavam `_lastLocalSave` ANTES de `await _waitForFirebaseReady()`,
  deixando o espelho (aqui) ou o cálculo local que o alimenta
  (`fbSaveAll()`, ver abaixo) intocado durante TODA a espera quando
  `_fbReady` começava `false` (cold start/reconexão — o cenário do
  próprio incidente, "começou depois das promoções"). Fix: a espera de
  `_fbReady` move pra acontecer só na frente da escrita de rede em si,
  depois do espelho/cálculo local já prontos, nas 3 primitivas.
- **`_stripUndefinedMultiPath(updates)`** — L19158 (CAUSA RAIZ REAL E
  FINAL do mesmo relato acima — o fix do `_cardsByKey` logo acima era
  real, mas não era isto): `fbSaveCard()`/`fbCreateCard()` chamavam
  `_stripUndefinedDeep(val)` (a função "irmã", que remove campos
  `undefined`/chaves inválidas RECURSIVAMENTE) no objeto de update
  MULTI-PATH INTEIRO, cujas chaves de nível superior são, de propósito,
  caminhos com barra (`'cards/'+key`, `'cards_updated_at/'+id`). Desde
  que `INVALID_FB_KEY_RE` (L~19035) passou a rejeitar qualquer chave com
  `/` (2026-09-17, commit `5c6278a`, fix de um bug DIFERENTE), todo
  update multi-path virava `{}` — `window._update(ref, {})` é um no-op
  válido que resolve com SUCESSO sem escrever nada. Isso deixou
  `fbSaveCard()`/`fbCreateCard()` **completamente quebrados desde
  17/09** (toda edição/criação de card "salvava" na tela sem nunca
  persistir), afetando qualquer pessoa/squad, não só quem reportou.
  Fix: `_stripUndefinedMultiPath()` aplica `_stripUndefinedDeep()` em
  cada VALOR do update, preservando as chaves de nível superior —
  mesmo padrão que `_notasUpdate()` (L19163) já usava certo. Trocada
  nos 3 pontos de escrita (`fbSaveAll()`/`fbCreateCard()`/
  `fbSaveCard()`). **Lição**: `_stripUndefinedDeep(val)` só deve
  receber um VALOR a ser escrito (um card, um bloco de Nota) — nunca o
  objeto de update multi-path inteiro.
- `_saveCardWithRetry(card, label)` — L9292 — wrapper de `fbSaveCard()`
  com 1 retry automático em 3s + aviso ⚠ se as 2 tentativas falharem;
  usada por `scheduleAutoSave()`/`_performAutoSave()` (L13700/L13758),
  `saveExtraDesc()` (L14318) e a simulação de agente (perto de L18100+).
  **Retorna a promise de verdade desde 2026-09-21** (`/monitorarbugs`,
  relato direto de usuária — "salvo beleza, mas some ao atualizar"):
  antes era fire-and-forget, e os 3 call sites mostravam feedback de
  sucesso ("✓ Salvo"/"✅ Descrição salva!") na mesma hora que chamavam a
  função, sem esperar a escrita confirmar — se as 2 tentativas
  falhassem (rede instável), o único aviso real vinha alguns segundos
  DEPOIS do sucesso falso já ter aparecido e sumido.
- **`_flushAutoSave()`** — L13751 (causa raiz REAL do mesmo relato acima
  — o fix de `_saveCardWithRetry()` sozinho não resolveu): `_performAutoSave()`
  (L13700, corpo extraído do `setTimeout` de `scheduleAutoSave()`) só
  rodava 800ms depois da última interação, e nada CANCELAVA ou FLUSHAVA
  esse timer pendente antes do modal fechar (`_finishCloseOv()`, L33221)
  ou trocar de card (`openCard()`, L14794) — se a pessoa fechasse/trocasse
  de card dentro dessa janela de 800ms, a edição pendente era perdida em
  silêncio (`editingId` já `null`, aborta) ou gravada no card ERRADO
  (`editingId` já aponta pro card novo). `_flushAutoSave()` cancela o
  timer e roda a escrita na hora, chamada no topo dos dois pontos acima
  — antes de qualquer um mexer em `editingId`/DOM. **Achado 2026-09-22,
  3º ponto**: `openNewCard()` (L15218) tinha o MESMO gap — chamada por
  `usarQLItem()`/`_intakeCriarCard()` sem fechar `#card-ov` primeiro
  (só fecham `ql-ov`/`intake-ov`, overlays que ficam empilhados por
  cima de um card já aberto — comportamento já documentado no próprio
  código). `_flushAutoSave()` adicionada no topo dela também.
- **Guard `_isQLTemp`, presente nas 3** (2026-09-03,
  `/monitorarbugs` — causa real de "[card sumiu inesperadamente]"):
  todas recusam operar sobre um card com `card._isQLTemp===true` (o
  card temporário que `openQLEdit()` empurra em `cards[]` pra
  reaproveitar o modal na edição de Modelo/Recorrente/Agendamento — ver
  seção "Modal reaproveitado..." abaixo). Ponto único de defesa contra
  qualquer call site, presente ou futuro, que tente persistir esse
  objeto por engano — não precisa (e não deve) ser reproduzido call
  site por call site.
- **`_stripUndefinedDeep(val)`** — L19122 — rede de segurança central
  aplicada nas 3 primitivas acima (mais `_notasUpdate()`) antes de todo
  `window._update()`: remove recursivamente campos `undefined` (achado
  2026-09-16) E, desde `/monitorarbugs` 2026-09-17, chaves inválidas de
  Realtime Database (vazia ou com `.#$/[]`) de qualquer objeto aninhado
  — Firebase rejeita a escrita MULTI-PATH INTEIRA se qualquer um dos
  dois aparecer em qualquer lugar da árvore, não só no campo tocado.
  Causa raiz do achado de chave inválida: `backfillFlow()` (L8592) e
  `recordMove()` (L8466) usam `card.col`/`toCol` como chave de
  `flow.enteredAt` — as duas agora só gravam quando o valor não é vazio
  (card criado fora do fluxo normal, sem coluna, é o único jeito
  observado de chegar nesse estado). `_stripUndefinedDeep()` continua
  como 2ª camada pra qualquer outro campo-objeto que acumule o mesmo
  problema por um caminho ainda não mapeado.

### Rede de segurança — detecção ao vivo de card sumido inesperadamente
- `_reportUnexpectedCardDisappearance()` — L9163 — dispara toast +
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
- `window._reconcileCardsUpdatedAtPeriodic` — L9647 — poll de 4min (rede
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
- `setDependsOn(parentId)`/`unlinkDependsOn()` — perto de L34261/L34302
  — vincula/desvincula, sempre a partir do card `editingId` aberto no
  modal. `searchDependsCards(q)` — L34224 — alimenta o picker
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

### Tema (claro/escuro + 🌴 Vice City + 🕐 automático)
- `_currentTheme()` — L33424 — lê `data-theme` do `<html>`, retorna
  `'light'`/`'dark'`/`'vice'`.
- `toggleTheme()` — L33486 — alterna claro/escuro (clique no botão de
  tema). `toggleThemeVariant()` — logo abaixo — variante mais escura do
  claro (duplo-clique, só faz sentido dentro do claro).
- `toggleThemeAuto()` — L33567 (2026-09-08) — 4º modo, botão próprio
  `#theme-auto-btn` (🕐) ao lado do botão de tema principal. Liga/desliga
  a troca automática de tema pelo horário de São Paulo —
  `_themeBandForSaoPauloNow()` (L33524, `Intl.DateTimeFormat` com
  `timeZone:'America/Sao_Paulo'`) mapeia a hora pra uma das 3 bandas já
  existentes (06h-12h claro, 12h-18h vice, resto escuro — nenhum CSS
  novo). `_applyAutoTheme()` reaplica a cada 1min
  (`_startThemeAutoWatch()`) e ao voltar a ficar visível
  (`visibilitychange`). Qualquer troca MANUAL de tema
  (`toggleTheme()`/`toggleThemeVariant()`/`toggleViceCity()`/
  `exitViceCity()`, todas chamando `_disableThemeAutoIfOn()` no início)
  desliga o automático. Estado em `localStorage` (`mare_theme_auto`),
  replicado no script anti-flash do `<head>` (perto da L3327) e no menu
  "⋯" mobile.
- `toggleViceCity()` / `exitViceCity()` — L33611/L33626 —
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
  quem nunca troca de tema); exclui `'blackfriday'` explicitamente
  (`/monitorarbugs` 2026-09-16 — `toggleBlackFriday()` nunca chama essa
  função de propósito, "é teste, sem sentido contar métrica", mas o
  listener genérico de `auth-change` gravava mesmo assim se o evento
  refirasse com a pessoa no tema BF).
- `_isViceCityEasterEggAtivo()` — L33715 — `vice` só conta como easter
  egg de verdade quando o Tema automático está DESLIGADO (`/monitorarbugs`
  2026-09-14, técnica 3): a banda 12h-18h do automático TAMBÉM deixa
  `_currentTheme()==='vice'`, então os handlers do botão de tema
  (`onThemeBtnClick()`/`onThemeBtnDblClick()`/`_mobileThemeRowClick()`)
  usavam só isso pra decidir "sai do easter egg" — clicar no botão
  durante a banda automática da tarde desligava o automático sem
  ninguém pedir.
- **🔥 Black Friday** (tema experimental, `toggleBlackFriday()` — L33647 /
  `exitBlackFriday()` — L33658, botão direito no botão de tema —
  `_themeBtnRightClick()` — L33670): 5º "tema" — não é opção visível
  nem tem paleta séria própria, é uma decoração temporária de campanha
  (fita diagonal "OFERTA", contador regressivo — `_bfUpdateCountdown()`
  — L33178 — mensagem do banner configurável, "peixinhos viram dinheiro"
  no fundo). `_isBlackFridayAtivo()` — L33646 — helper de estado, mesmo
  padrão de `_currentTheme()==='vice'`.

### Arquivados / arquivamento automático
- `maybeAutoArchiveOldCards()` — L13498 — roda a regra opcional de
  arquivar cards antigos E parados (`archiveCfg`, configurável em ⚙
  Config → Automações). (2026-09-08) ganhou `excludedCols` — Set de ids
  de coluna que a regra nunca toca (ex.: Backlog, onde cards ficam
  parados de propósito). Pending state em
  `_archCfgExcludedColsPending`, chips renderizados por
  `_archCfgExcludedColsChips()`/`_archCfgToggleExcludedCol()`, só grava
  em `archiveCfg.excludedCols` no "💾 Salvar regra"
  (`fillArchiveCfgTab()` L13674). (2026-09-14) **nunca mais arquiva
  sozinho** — candidatos entram na fila `archive_pending` (por squad,
  acumula até alguém decidir) e o 1º PO/Organizador/ADM a abrir o board
  no dia vê `#archive-validation-ov` (`_archiveValidationOpen()`, lista
  com checkbox por card) — confirma (`_archiveValidationConfirm()`, só
  arquiva os marcados) ou pula pra próxima pessoa elegível
  (`_archiveValidationSkip()`, grava `offeredUids[uid]=hoje`, não
  incomoda a mesma pessoa 2x no dia). (2026-09-15, `/monitorarbugs`) 2
  fixes: `excludedCols` agora revalidado também na limpeza da fila
  acumulada (não só na entrada de candidatos novos — card movido pra
  coluna excluída ficava preso na fila); idle-check passa a considerar
  também `card.updatedAt` (garantido centralizado por
  `fbSaveCard()`/`fbSaveAll()`), não só `card.editedAt` (setado manual
  por quem lembra) — pin/anexo de link agora conta como atividade.
- `_renderArquivadosBody()` — L23173 — lista da tela "📦 Arquivados"
  (`#arch-body`). (2026-09-15, pedido direto) o **título** de cada
  card agora é clicável — chama `openCard(id)` (o card continua
  arquivado; `saveCard()`/o resto do modal nunca tocam `c.archived`, só
  `archiveCard()`/`desarquivar()`) e fecha a própria tela
  (`closeOv('arch-ov')`), mesmo padrão do grid de cards vinculados de
  Campanha (`_renderCampCardsGrid()`).
- `openArquivados()` — L23238 — tela "Funções de card → Arquivados".
  (2026-09-08) filtro novo por coluna (`#arch-f-col`) — arquivar nunca
  reescreve `c.col` (só liga `c.archived`), então o valor atual do
  campo já É "a coluna de quando foi arquivado", sem precisar de campo
  dedicado. Coluna excluída desde então aparece como `id (coluna
  excluída)`, ordenada por último.
- `desarquivar(id)` — L23251 — restaura um card (chamado da lista de
  Arquivados E, desde 2026-09-15, de dentro do próprio modal do card —
  ver `btn-archive-card` abaixo). Só reabre/re-renderiza `#arch-ov` se
  ela já estava aberta (antes reabria incondicionalmente, criando um
  overlay novo por baixo do modal do card quando chamada de lá).
- **`#btn-archive-card`** (rodapé do modal do card, `archiveCard()`
  L15036) — achado real `/monitorarbugs` 2026-09-15: nunca checava
  `c.archived`, sempre mostrava "📦 Arquivar" mesmo pra um card já
  arquivado (clicar de novo só regravava os mesmos campos, sem
  restaurar). `openCard()` agora alterna o botão pra "♻️ Restaurar"
  (chama `desarquivar()` + fecha o modal) quando `c.archived`.

### Comunicados / Mural (popup + badge + Mural)
- `_refreshComunicados()` — L36425 — busca `kanban/comunicados`
  filtrado `ativo:true` no servidor (`query(...)`), com fallback pra
  árvore inteira se a query falhar (`_dbgTrack('comunicados_fallback', ...)`
  registra quando isso acontece de verdade). **Causa raiz confirmada e
  corrigida em 2026-09-11**: `query`/`orderByChild`/`equalTo` eram
  chamados direto (sem `window._x`) de dentro do `<script>` clássico,
  mas importados só no `<script type="module">` anterior — bindings de
  import de módulo ES não atravessam esse limite, então a query SEMPRE
  lançava `ReferenceError`, caindo no fallback em 100% das chamadas
  desde que essa feature existe (confirmado cruzando
  `comunicados_fallback` contra `comunicados` no `_debug_bytes_daily`
  de todas as squads — idênticos, todo dia). Fix: `query`/
  `orderByChild`/`equalTo` agora penduradas em `window` (~L6207, mesmo
  padrão de `window._ref`/`window._get`). `_comunicadosAtivos` (popup) e
  `_muralTodos` (badge + Mural) saem os dois já filtrados por `c.ativo`
  na origem — nenhuma tela de `kanban-dev.html` mostra comunicado
  inativo/arquivado (isso é feature só do `painel.html`, pra ADM
  revisar).
- `COMUNICADOS_POLL_MS` — L36054 — 12min (era 3min até 2026-09-02,
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
- **`painel_broadcast` — notificação/push de Comunicado urgente (2026-09-22,
  `/monitorarbugs`, técnica 6 — código morto pela via inversa)**: esse
  tipo já existia em `PUSH_TYPES` (`functions/index.js`) e em
  `NOTIF_ICONS` (`kanban-dev.html`, 📢), mas NADA no repo jamais criava
  uma notificação desse tipo — `saveComunicado()` só escrevia em
  `kanban/comunicados/{id}`, nunca em `kanban/usuarios/{uid}/
  notificacoes`. Quem não estivesse com o board aberto no momento nunca
  ficava sabendo de um Comunicado, nem um "🚨 Urgente". Confirmado com o
  usuário antes de implementar (feature real faltando, escopo decidido
  junto: só dispara pra `tipo==='urgente'` ou popup insistente, e só na
  transição pra `ativo` — não a cada edição de algo já publicado).
  `_painelResolveComunicadoAlvos(c)` (`painel-dev.html`) — resolve os
  uids-alvo a partir de `_globalUsersCache`, mesmo critério de
  visibilidade que `kanban-dev.html` já usa pro Mural (`c.squad`/
  `c.publico==='po'`, ver comentário acima); `_painelNotifyBroadcast(c,id)`
  escreve 1 notificação por alvo, mesmo padrão de `_okrNotifyEditado()`.
  `openNotif()` (`kanban-dev.html`, ~L28533) ganhou o tratamento pro
  tipo (`openMural()`, sem isso caía no `if(!cardId) return` — mesma
  classe de gap já corrigida 6x na rodada de 2026-09-06); o sino
  próprio do painel (`renderPainelNotifs()`, só visível a ADM) navega
  via `link:'pessoas'` (mesmo mecanismo genérico `?tab=<id>` daquela
  mesma rodada — "+ Novo comunicado" vive dentro de `#ppane-pessoas`).

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
- `toggleHdMore(e)` / `closeHdMore()` / `renderHdMoreDD()` — L6715/L6723/L6726
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
- `renderNormal()` — L12451
- `renderRaiaOwner()` — L12509
- `renderRaiaTag()` — L12560
- `toggleRaia()` — L13156
- `passesFilter()` — L13105
- `handleDragStart/End/Over/Leave()` — L30304/L30315/L30326/L30354
- `addTouchDnD()` — L30832 — drag-and-drop por toque (mobile)
- `makeCardEl()` — L11308 — monta o HTML de um card no board (tags, badges,
  avatar, capa, ícone de pin...).
- `_cardIdTs()` (hora de criação embutida no id, desempate de "Data de criação") e `_syncLastFlowCol()` (repõe `_lastFlowCol` a partir da coluna do banco em toda sync — corrige card movido pelo Agente Ágil, 2026-10-06) ficam junto de `_sortCardsByMode()`/`recordMove()`.
- `_sortCards()` / `_sortCardsByMode()` — L11511/L11565 — ordena os cards de
  uma coluna; `_sortCards()` resolve o pin (card fixado sempre no topo,
  ver `togglePinCard()`) por cima do resultado de `_sortCardsByMode()`
  (a lógica de ordenação de verdade — prioridade/criação/manual/etc.),
  num único ponto usado por `renderNormal()` E todas as raias.
- `togglePinCard()` — L11521 — fixa/desafixa 1 card no topo da coluna
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
  1. `recordMove()`/`backfillFlow()` (~L8466/~L8592) comparavam
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
- `updateMetrics()` — L13286 — Throughput do toolbar.
- `renderBoardDataGrid()` — L13313 — Throughput/Cards ativos/Intake
  concluído (📊 Dados do Board → Visão Geral). Desde 2026-09-11 essa aba
  também ganhou `_boardDataSmCvPorColuna()` — L20945 — tabela Submarca/
  Canal quebrado por coluna (chamada de dentro de `_boardDataBarChart()`
  — L20996), só pra squads que usam os campos. `_boardDataTrendChart()`
  (gráfico "Tendência — últimos 14 dias") e `_boardDataBarChart()`
  ("Cards ativos por coluna") ganharam hover com crosshair/tooltip em
  2026-09-18 (`_bdTrendHover()`/`_bdBarHover()`, mesmo espírito do
  crosshair do CFD).
- `renderBoardDataInsights()` — L20642 — mesma exclusão, aba Insights.
  Desde 2026-09-11, o botão "🤖 Ponto de vista do Agente Ágil" ali passou
  a chamar `_pedirAnaliseBoardInsights()` — L22333 (em vez de
  `_pedirAnaliseDados()` direto) — garante que `_renderCFD()`/
  `_renderBurndown()` (aba separada "📈 CFD & Burndown", L20878/L21006)
  já rodaram e preencheram `window._cfdResumo`/`window._burndownResumo`
  antes de montar o resumo enviado ao backend, mesmo se a pessoa nunca
  abriu aquela aba.
- `maybeSnapshot()` — L13457 — `done`/`sp_done` do snapshot histórico
  diário (`kanban/squads/{squad}/snapshots/{date}`) — sem correção
  retroativa nos snapshots já gravados, só os de hoje em diante.
- `agCtx()` — L~22075 — contagem "Concluídos" no prompt de sistema do
  Agente Ágil + a heurística local `doneCol` (regex de nome, sem checar
  `flowConfig.doneCols`) removida. **2º bug na mesma função**: lia
  `c.doneAt` (campo raso, NUNCA escrito em lugar nenhum do app — o real é
  `card.flow.doneAt`, ver `recordMove()`) — a omissão de cards concluídos
  há +7 dias do snapshot enviado à IA nunca funcionava.
- `computeAvisosQuadro()` — L18485 — mesmo bug do campo raso `c.doneAt`
  no aviso "✅ Resolvido: X" (🌅 Meu Dia) — nunca disparava, pra card
  nenhum, desde que a feature existe.
- 4 caminhos de notificação "card concluído" vs. "card movido" — cada um
  reimplementava a MESMA heurística local (regex de nome) por conta
  própria: modal-save (~L12153), `scheduleAutoSave()` (~L13582),
  `handleDrop()` (~L30707), `ctxMove()` (~L32732) — todos trocados por
  `if(_isColDone(colId)) notifDone(...); else notifMoved(...)`, sem
  variável local nenhuma.
Testado com Playwright, squad fictícia com coluna de conclusão de id
customizado (`col_999`, nunca `'done'` literal — o caso real de qualquer
squad que recriou a coluna) + 2ª coluna de fim (`col_888`) — todos os 9
pontos corretos, `ctxMove()` disparando `notifDone()` (não `notifMoved()`)
pro id customizado; regressão zero confirmada pro caso padrão (id `'done'`
literal, sem `flowConfig.doneCols`).

**Achado 2026-09-22, mesma classe, campo irmão nunca corrigido**:
`updateMetrics()`, `renderBoardDataGrid()` e `maybeSnapshot()` (os 3
listados acima) também calculavam `wip` comparando `c.col==='progress'`
(string fixa) — igual ao `c.col==='done'` que já tinha sido corrigido
em 2026-09-04 NESSAS MESMAS 3 FUNÇÕES, só que pro campo `done`, deixando
`wip` pra trás. `addColumn()` nunca gera id `'progress'` (gera
`'col_'+timestamp`) — squad que recriou/renomeou a coluna "Em andamento"
sempre via WIP=0. Trocado por `_flowStartColIds()` (L8436 — mesmo
resolvedor que Métricas de Fluxo já usa: config do PO
`flowConfig.startCols` + heurística por nome), igual espírito de
`_isColDone()` pro lado "início" em vez de "fim". `maybeSnapshot()`
grava `wip` permanente no Firebase 1x/dia — mesma ressalva do `done`
acima, snapshots antigos não são corrigidos retroativamente.
**Achado incidental, não corrigido (ambíguo — decisão de produto)**: os
3 também calculam `wipLimit=parseInt(agilCfg.wip||3)` — ignora
`_colWipLimit(col)` (L15115, que já suporta limite POR coluna via
`col.wip`, usado no cabeçalho da coluna no board desde antes). Como
`_flowStartColIds()` pode devolver mais de 1 coluna, não há uma forma
óbvia de agregar múltiplos `col.wip` num único "limite" pro widget sem
uma decisão de produto (somar? usar só o 1º?) — reportado, não
implementado.

### 📜 Histórico: data em período de vários dias (2026-09-04)
Achado real do usuário (print de um período "01/09/26 a 04/09/26"):
`_timelineFeedRow()` mostrava só a hora (`🕐 09:01`) em toda linha do
Feed — não diz qual dia quando o período aberto tem mais de 1 dia. Fix:
se `_timelineFeedState.deStr!==_timelineFeedState.ateStr`, a hora vira
`DD/MM HH:mm`; período de 1 dia (o caso mais comum) continua só com a
hora. Mesmo fix espelhado em `_ptFeedRow()` do painel-dev.html.

### Busca (Ctrl+K + "Ver no board")
- `openSearch()` — L34048
- `renderSearchResults()` — L34060 — **achado real (`/monitorarbugs`
  2026-09-22, fechando um achado de passagem registrado em 2026-09-02
  como "fora de escopo, mesmo padrão aqui")**: o selo de tag do
  resultado lia `c.tag` (campo legado, só a 1ª tag do array, sem
  garantia de sincronia com `tags[]`) — mesma classe já corrigida em 3
  lugares naquela rodada. Card com a tag original removida/trocada
  mostrava o selo errado ou nenhum. Trocado por `getCardTags(c)[0]`
  (array-aware, mesma fonte de `tagsHtml()`/`cardHasTag()`).
- `verNoBoardFromSearch()` — L34134
- `_scheduleTextFilterApply()` — L12792 — debounce do filtro `#f-texto`

### ⌨️ Atalhos de teclado personalizáveis (2026-09-07)
Pedido direto do usuário — "personalizar atalhos do teclado pra ações
do board... obviamente não substituir as que criamos e as mais óbvias
(ctrl+c, ctrl+k, ctrl+v)". Botão "⌨️ Atalhos" na toolbar (ao lado de
"❓ Ajuda", visível pra TODO papel — diferente de "⚙ Configurações",
que `_applyRoleVisibility()` esconde pra quem não é PO/Organizador/ADM)
abre `#atalhos-ov`.
- `ATALHO_ACOES` (const, ~L24655) — 24 ações customizáveis, mapeadas a
  partir dos botões DE VERDADE da toolbar e do modal do card (não uma
  lista inventada), divididas por `tipo` em 2 abas: `'global'` = 🗂️
  Board (Dados do Board, Timeline, Controle de Criativos, Central de
  Ajuda, Alternar tema, Recarregar colunas/tags, Raia, Filtros,
  Selecionar, Funções de card, Links, Mapa de dependências,
  Calendários, Campanhas, Intake) e `'card'` = 📇 Modal do card
  (Copiar link, Duplicar, Salvar como modelo, Arquivar, Excluir —
  já tem `uiConfirm()` própria, Pausar/retomar, Menu de capa,
  Expandir/recolher seções, Histórico) — `tipo:'card'` só dispara com
  o modal do card aberto (mesmo espírito do Ctrl+S). Achado por pedido
  direto (2026-09-07, "acho que vc pode mapear as ações mais usadas...
  pode ter uma aba 'modal do card' tb"), depois da 1ª versão (só 6
  ações) ter sido validada. Ação com `visivel:()=>...` (ex.:
  "criativos"→`criativosAtivo`, "intake"→visibilidade real do botão
  `#btn-intake` na toolbar) só aparece na tela de configurar quando a
  funcionalidade correspondente está ativa/visível pro squad atual. As
  5 combinações FIXAS de sempre (Ctrl+K/D/S/Z, Esc) continuam
  hardcoded no handler principal de `keydown`, não entram nesta lista.
- `ATALHO_RESERVADOS` (~L24698) — combinações que a UI de captura nunca
  deixa reatribuir: as 5 fixas acima (com `'mod'` cobrindo Ctrl E Cmd,
  mesmo critério que o handler principal já usa via
  `e.ctrlKey||e.metaKey`) + clássicos do navegador (Ctrl+C/V/X/A/F...) +
  teclas de função que o Chrome já usa pra alguma coisa (F1/F3/F5/F6/
  F7/F11/F12). **Achado direto do usuário (2026-09-07)**, testando F8
  ("no chrome n faz nada, n posso usar ele?") — SIM: F2/F4/F8/F9/F10
  não são usadas pelo navegador por padrão, e por serem teclas de
  função (não digitam nada num campo de texto) valem SOZINHAS, sem
  precisar de Ctrl/Cmd/Alt junto — ver `ehTeclaFuncao` em
  `_atalhoValidarESalvar()`. A própria tela do modal (`#atalhos-ov`)
  ganhou um bloco de dica explicando isso, pedido explícito ("acho q vc
  precisa tb falar sobre os atalhos ja usados pelo navegador, pra
  facilitar na escolha").
- Preferência 100% pessoal, mesmo padrão de `notif_prefs`/DND:
  `kanban/usuarios/{uid}/atalhos_custom` (`{acaoId: 'mod+shift+d', ...}`),
  `loadAtalhosCustom()` (~L27973, listener ao vivo, chamado junto de
  `loadNotifPrefs()` no boot) → cache local `_atalhosCustom`.
- `openAtalhos()`/`swAtalhosTab()`/`renderAtalhosBody()`
  (~L24709/24714/24733) — UI com 2 abas (`_atalhosTab`, sempre reseta
  pra `'global'` ao abrir o modal); cada linha mostra a ação +
  combinação atual (formatada por `_atalhoComboLabel()`, Cmd/Option em
  Mac, `F8` etc. já vêm maiúsculas de graça) + botões Definir/✕. Trocar
  de aba com uma captura "armada" cancela ela (senão a tecla capturaria
  numa ação que já saiu de vista).
- `_atalhoCapturaKeydown(e,id)` (~L28029) — captura a próxima tecla
  real depois de clicar "Definir" (ignora teclas de modificador puro,
  Esc cancela) → `_atalhoValidarESalvar()` (~L28042): rejeita sem
  Ctrl/Cmd/Alt (exceto tecla de função sozinha), rejeita
  `ATALHO_RESERVADOS`, rejeita conflito com outra
  ação já configurada (não conta como conflito consigo mesma).
- `_matchAtalhoCombo(e,combo)` (~L28065) — usado tanto pra validar
  quanto pelo handler principal de `keydown` (mesmo bloco onde já mora
  o Ctrl+Z, mesma cautela de não interceptar dentro de campo de
  texto/`contentEditable`) pra disparar `def.run()` da ação que bateu.

### 🎛️ board_prefs — preferências pessoais do board sincronizadas por conta (2026-09-07, rodadas 1-5 de 5 — completo)
Pedido direto do usuário, mesma linha de personalização de hoje: levar
Raia/ordenação/fonte/modo de visualização/filtro de Submarca/colunas
escondidas do Dashboard pro mesmo padrão de `atalhos_custom`/
`toolbar_order`, mais 3 features novas (densidade do card, squad
padrão, presets de filtro — este último em `filter_presets`, node
irmão, não `board_prefs`, ver Rodada 5 abaixo). `kanban/usuarios/
{uid}/board_prefs/{squadId}` (por squad) + `board_prefs_global` (o que
não depende de squad — fonte, densidade do card, squad padrão), mesmo
listener-ao-vivo + cache local de sempre.
- `_saveBoardPref(campo,valor)` (~L27854) — escrita otimista (atualiza
  `_boardPrefsSquad` local + `window._set()`), `loadBoardPrefs()`
  (~L27564) — listener, `_applyBoardPrefsSquad()` (~L27587) — aplica o
  snapshot nas variáveis de runtime já existentes e re-renderiza.
  Chamado no boot junto de `loadNotifPrefs()`/`loadAtalhosCustom()`/
  `loadToolbarOrder()`.
- **Rodada 1**: `raia` e `collapsed_cols` — nenhum dos dois salvava
  NADA antes disso, nem localStorage (voltavam ao padrão a cada F5,
  mesmo no mesmo navegador). `toggleRaia()` (~L13156, UI extraída pra
  `_applyRaiaBtnUI()`), `toggleRaiaCol(id)`/`toggleCol(id)`
  (~L13171/L13177) — os dois fazem a mesma coisa em `collapsedCols`
  (duplicação pré-existente, não tocada aqui) — ambos chamam
  `_saveBoardPref('collapsed_cols',...)`.
- **Rodada 2**: `col_sort`, `view_mode`, `submarca_filtro`,
  `dashboard_hidden_cols` — estes 4 já salvavam algo, só que preso ao
  navegador (`safeLS`/`localStorage`, chave por squad:
  `col_sort_`/`hybrid_view_`/`sm_filtro_`/`bd_hcols_`). Precisou de
  **migração** (diferente da Rodada 1): `_boardPrefLoadOrMigrate(campo,
  legacyKey, padrao, parse)` (~L27579) — se a conta já tem valor
  sincronizado usa ele; senão herda o que já tava salvo localmente (se
  tiver) e sobe pro Firebase na hora, sem resetar quem já tinha
  configurado. `setColSortMode()` (~L13264, UI extraída pra
  `_applyColSortBtnUI()` ~L13257), `setHybridView()` (~L7455),
  `_saveSubmarcaFiltroPadrao()` (~L12612), `_bdLoadHiddenCols()`/
  `_bdToggleCol()` (~L20310/L20313) — todos continuam gravando em
  `safeLS`/`localStorage` também (cache rápido pra 1ª pintura antes do
  Firebase responder), só ADICIONARAM a chamada a `_saveBoardPref()`.
- **Rodada 3**: densidade do card (`card_density`) — feature NOVA, não
  existia antes (diferente das rodadas 1-2, que só levavam algo já
  existente pro mecanismo sincronizado). `DENSITY_LABELS`/
  `boardCardDensity`/`_applyBoardCardDensity()`/`setBoardCardDensity()`
  (~L12002-12015) — vai direto pro `board_prefs_global` (sem
  localStorage/migração, mesmo espírito da Rodada 1). UI: 2ª seção do
  mesmo menu "🔍 Fonte" (depois de uma divisória) — "🗐 Detalhado"
  (padrão) / "🤏 Compacto" (esconde capa, indicadores de descrição/
  Milanote/anexos, barra de checklist, avatares de participantes além
  do responsável, badges de risco/direcional/aging — CSS `.card-compact`
  ~L671, aplicado em `#board`; independente do `.fontsize-*`, que só dá
  `zoom`). Título/prioridade/prazo/impedimento/OKR/avatar do responsável
  continuam sempre visíveis (nenhum dos 3 tem classe própria no card
  pra esconder). Aproveitado pra corrigir 3 comentários/tooltips que
  citavam `colSortMode`/tamanho de fonte como "só salva no navegador"
  — desatualizado desde a Rodada 2.
- **Tamanho de fonte** (`board_font_size`, `setBoardFontSize()`
  ~L12041) é o único desses que NÃO é por squad — vai pro node
  irmão `board_prefs_global` (`_saveBoardPrefGlobal()`/
  `loadBoardPrefsGlobal()`/`_applyBoardPrefsGlobal()`, ~L24887-24902),
  mesmo mecanismo, com listener PRÓPRIO (`loadBoardPrefsGlobal()`,
  node diferente de `loadBoardPrefs()`) — chamado no mesmo boot, só não
  é o mesmo listener.
- **Rodada 4**: squad padrão ao abrir o board — `last_squad`/
  `pinned_squad` em `board_prefs_global` (feature nova). Só entra em
  jogo quando a URL NÃO pede um squad específico (`_urlParams` sem
  `?squad=`, ver `ACTIVE_SQUAD` ~L6244, que nesse caso cai no
  `'dados'` hardcoded) — um link/seletor com `?squad=X` explícito
  sempre respeita a escolha, nunca é sobrescrito.
  - `_resolveSquadPadrao(user)` (~L10696) — lê `board_prefs_global`
    (`pinned_squad || last_squad`), só quando `semSquadNaUrl`; usado
    por `resolveSquadAndShow()` (~L10704, virou `async` — só os 2
    call sites relevantes, `onAuthStateChanged`/criação de usuário
    novo, ambos fire-and-forget, sem `await`) pra decidir se redireciona
    ANTES de mostrar o board (ADM: sempre pode ir pro squad padrão;
    multi-squad: só redireciona se `squadPadrao` for um squad de
    verdade da pessoa; squad único: ignora `squadPadrao`, sempre vai
    pro único squad que a pessoa tem, como já era).
  - `showApp(user)` (~L10760) — grava `last_squad = ACTIVE_SQUAD` toda
    vez que a pessoa efetivamente entra num squad (não sobrescreve
    `pinned_squad`).
  - **Achado real (mesmo dia, testando a rodada)**: quando não redireciona
    (squad resolvido já era o certo — ex.: `squadPadrao` coincide com o
    `'dados'` hardcoded que a URL cai por padrão), nada desligava o
    seletor PRÉ-AUTH que `initSquadSelector()` mostrava então (ver nota
    de remoção logo abaixo) — ele ficava por cima do board carregado por
    baixo, dando a impressão de squad padrão "não funcionar". Gap
    pré-existente (mecanismo já morava aqui antes desta rodada), só
    ficou visível porque a feature nova incentiva acessar a URL sem
    squad de propósito. Fix: `showApp(user)` — único ponto que sabe com
    certeza que o board de verdade vai aparecer — sempre roda
    `document.getElementById('squad-selector')?.classList.remove('active')`
    antes de mostrar o app (continua assim, ainda é o guard que desliga
    o seletor pós-login — ver nota abaixo).
  - **`initSquadSelector()` — PRÉ-AUTH removido de vez (2026-10-01,
    relato direto, print: "no kanban prod, antes da tela de login vem a
    tela de escolha de squad... n deveria ser o contrario?")**:
    `initSquadSelector()` (`<script>` clássico, ~L35233) mostrava um
    seletor com TODOS os squads existentes no `DOMContentLoaded`, ANTES
    de qualquer login resolver, sempre que a URL não tinha `?squad=` —
    qualquer visitante, logado ou não, via nome/emoji de squad que nem
    era dele. Removida a exibição pré-login (o bloco inteiro do
    `DOMContentLoaded` que dava `.active` em `#squad-selector` antes do
    auth); `renderSelectorGrid()`/`window._renderSelectorGrid` continuam
    existindo e expostos, porque `showSquadSelectorFiltered()`
    (`resolveSquadAndShow()`, ver acima) já cobre o caso de verdade —
    PÓS-login, FILTRADO só pros squads que a pessoa participa, com
    auto-redirect quando só tem 1. Login agora é sempre a 1ª tela,
    com ou sem `?squad=` na URL.
  - `_isPinnedSquad()`/`toggleFixarSquadPadrao()` (~L6682/L6685) — UI
    é a 1ª opção do dropdown de `toggleSquadSwitcher()` (~L6651,
    clique no nome do squad atual no cabeçalho): "📌 Fixar este squad
    como padrão" / "📌 ...remover", acima da lista de squads.
- **Rodada 5 (última das 5)**: presets de filtro nomeados — feature
  NOVA, própria tela, a maior das 5. `kanban/usuarios/{uid}/
  filter_presets/{squadId}/{presetId}` = `{id, nome, filtros}` (os 13
  campos de `activeFilters`, `FILTER_PRESET_CAMPOS`). Diferente de
  `board_prefs`, não mantém um cache de runtime pra "aplicar" — aplicar
  um preset é só popular os mesmos campos/DOM que `applyFilters()` já
  usa. `loadFilterPresets()` (~L12862, listener) → `_filterPresets`
  (array, ordenado por nome) → `renderFilterPresets()` (~L12870, chips
  reusando `.auto-action-chip`, mesmo estilo do chip de ação pendente
  de Automação). `saveFilterPresetPrompt()` (~L11973, `uiPrompt()` pro
  nome, `FILTER_PRESET_LIMITE=10` por squad) / `applyFilterPreset(id)`
  (~L12714, popula DOM + `activeFilters` + `_saveSubmarcaFiltroPadrao()`
  + `renderBoard()`, mesmo padrão de `clearFilters()`) /
  `removeFilterPreset(id)` (~L12009, `uiConfirm()` antes). UI: botão
  "💾 Salvar preset" + `#filter-presets-list` (chips), dentro do
  `#filter-bar` (barra de "🔭 Filtros"), depois do grupo "💡 Meus
  cards"/"Limpar".
  **Achado real (mesmo dia, usuário testando)**: "todos os cards da
  squad dados sumiram!" — susto sem perda de dado. Um filtro/preset
  ativo com a barra de Filtros FECHADA não dava nenhuma pista visual —
  `toggleFilters()` só destacava o botão `#btn-filters` enquanto o
  PAINEL estava aberto, não enquanto havia filtro de fato ATIVO
  (`activeFilters`). A Timeline já resolvia isso certo com
  `_hasActiveFilters()` (~L11797, existente antes de hoje) alimentando
  o próprio botão de Filtros dela — o board de colunas nunca ganhou o
  mesmo tratamento (achado via técnica 2, comparar contra padrão já
  resolvido). Fix: `_applyFiltrosBtnUI()` (nova, perto de
  `toggleFilters()`) vira a fonte única do destaque, chamada em
  `toggleFilters()`, `applyFilters()`, `clearFilters()`,
  `applyFilterPreset()` e `_applyBoardPrefsSquad()` (esta última cobre
  o filtro de Submarca já vindo ativo do boot).
  **Achado real 2 (mesmo dia, testando nos temas claro/vice)**: `.auto-
  action-chip` (reaproveitado pro chip de preset) e `#btn-save-preset`
  usam `var(--teal)` no texto — contraste ruim em ☀️ Lençóis Maranhenses
  (`#33D6D0`, ciano claro diluindo no fundo já claro) e em 🌴 Vice City
  (`#9c6f8a`, tom parecido com o fundo rosa/malva do tema). Mesma classe
  de achado já feita antes pra `.badge`/`.hd-btn-adm`. Fix:
  `[data-theme="light"]`/`[data-theme="vice"]` (~L2887, logo abaixo da
  definição de `.auto-action-chip`) forçam `color:var(--txt)` nesses 2
  temas — chip, botão ✕ dele (com `:not(:hover)` pra preservar o hover
  vermelho de "remover") e `#btn-save-preset`.
  **Achado real 3 (/monitorarbugs, 2026-09-07, PR #809)**: a correção do
  achado 1 acima cobriu `applyFilters()`/`clearFilters()`/
  `applyFilterPreset()`, mas esqueceu os 3 pontos que mudam
  `activeFilters.submarca` fora desses três —
  `setSubmarcaDropdownTodos()`/`toggleSubmarcaDropdownItem()`/
  `setSubmarcaFromDrawer()` (~L17147-15505). Filtrar só por submarca
  (menu "🏷️ Submarcas" da toolbar, ou o `<select>` de Submarca do
  drawer) escondia cards sem o botão "🔭 Filtros" acender. Fix: mesma
  chamada de `_applyFiltrosBtnUI()` adicionada nos 3.
  **Achado real 4 (/monitorarbugs, 2026-09-07, escopo nomeado "filtros
  do board")**: `applyFilterPreset()` (~L12888) nunca sincronizava
  `<select id="f-submarca">` com o `submarca` do preset aplicado —
  único dos 4 pontos que mudam `activeFilters.submarca` que não fazia
  isso. O filtro por baixo aplicava certo; só o campo do drawer ficava
  com o valor de uma seleção manual anterior.

### 🔀 Reorganizar barra de ferramentas (2026-09-07)
Pedido direto do usuário — "tem como deixar a pessoa reorganizar o
menu header? ex.: puxar o calendario para perto de fonte". 3ª aba do
mesmo modal "⌨️ Atalhos" (aba "🔀 Barra"). Mesmo esqueleto de
drag-and-drop já usado pra reordenar colunas
(`handleColDragStart`/`Over`/`Drop`, ~L31295) — aqui aplicado nos 25
filhos diretos de `#main-toolbar` (20 botões/menus + 5 divisores
`.tb-sep`, todos com `data-tb-id` — os divisores também são
arrastáveis, de propósito). Não compete com o clique-e-arraste de
rolagem horizontal que a toolbar já tinha
(`_initToolbarDragScroll`/`.crv-dragging`, ~L37601) — aquele já ignora
`mousedown` em cima de `<button>`/`<select>`/etc, então os dois
mecanismos nunca disputam o mesmo gesto.
- Preferência 100% pessoal, mesmo padrão de `atalhos_custom`/
  `notif_prefs`: `kanban/usuarios/{uid}/toolbar_order` (array de
  tb-ids). `_toolbarDefaultOrder` (~L28826, capturada 1x a partir do
  HTML original) + `loadToolbarOrder()` (~L28835, listener ao vivo,
  chamado junto de `loadAtalhosCustom()` no boot) → `_applyToolbarOrder()`
  (~L28844) reconcilia: id salvo que sumiu (feature removida) é
  ignorado; tb-id que existe na barra mas não está salvo (botão novo)
  entra no fim, na posição original — nunca some um botão sem avisar.
- `iniciarReorganizarToolbar()`/`finalizarReorganizarToolbar()`
  (~L28854/28867) — liga/desliga `_toolbarReorderMode`, fecha o modal
  de Atalhos e ativa `draggable` nos 25 itens + a pill flutuante
  `#tb-reorder-pill` ("✅ Pronto"). Ao finalizar, lê a ordem final DIRETO
  DO DOM (já reorganizado pelos drops) e persiste.
  `restaurarOrdemToolbarPadrao()` (~L28884) zera a customização.
- `_tbHandleDragStart/DragOver/DragEnd/Drop` (~L28900+) — mesmo padrão
  visual de `.col-drag-left`/`.col-drag-right` (`.tb-drag-before`/
  `.tb-drag-after`, calculado pelo `clientX` vs. o meio do elemento sob
  o cursor). `_wireToolbarDrag()` (~L28935) liga os 5 handlers via JS
  (não inline HTML, pra não repetir 5 atributos × 25 itens) — chamada 1x
  no boot; os próprios handlers só agem de verdade quando
  `_toolbarReorderMode` está ligado.
- **Auto-scroll perto da borda** (2026-09-30, pedido direto) —
  `_initToolbarEdgeAutoScroll()` (perto do fim do arquivo, logo depois
  de `_initToolbarDragScroll()`/`.crv-dragging`): motor único
  (`requestAnimationFrame`) alimentado por `mousemove` (hover parado
  perto da borda) E `dragover` nativo (arrastando um botão pra
  reorganizar perto da borda — `mousemove` não dispara durante drag
  nativo, por isso os 2 listeners). Desliga sozinho enquanto
  `.crv-dragging` está ativo, pra não brigar com a rolagem manual pelo
  mesmo `scrollLeft`.

### 💡 Personalização baseada em rotina (2026-09-11)
5 sugestões opt-in, nascidas de uma proposta direta do usuário — o app
observa como cada pessoa usa o board (100% em `localStorage`, nunca
Firebase — dado recalculável/descartável, sem custo de escrita remota) e,
quando um padrão se repete de verdade, **sugere** — nunca aplica — um
atalho pra esse padrão. Só o RESULTADO de uma sugestão aceita persiste de
verdade, sempre reaproveitando infraestrutura já existente (board_prefs,
filter_presets, `ATALHO_ACOES`), nenhum node novo no Firebase.
- **Mecanismo genérico** (compartilhado pelos 5 casos, de propósito — evita
  2 sugestões empilhadas na tela): `_mostrarSugestaoRotina(id, mensagemHtml,
  respostaSim, labelSim, aoAceitar)` — L13047, `_sugestaoRotinaResponder(resposta)`
  — L12945 (3 respostas sempre: aceitar/`'agora_nao'` some por 1 sessão
  pra QUALQUER sugestão/`'nunca'` recusa permanente só daquele `id`).
  `_sugestaoRecusadasKey()`/`_sugestaoRecusadaPermanente(id)`/
  `_sugestaoRecusarPermanente(id)` — L12908/L12909/L12914.
- **Caso #1 — Timeline como visão inicial**: `SUGESTAO_TIMELINE_*` — L11652,
  `_marcarUsoTimelineCedo()` — L11666 (chamada por `toggleTimelineView()`
  — L11638, só conta se dentro dos 3min iniciais do boot),
  `_checarSugestaoTimeline()` — L11676, `_tornarTimelineVisaoInicial()` —
  L11688 (grava `board_prefs.visao_inicial`). Aplicado no boot dentro de
  `_applyBoardPrefsSquad()` (L27882, ver abaixo) com guard
  `window._visaoInicialAplicada` — 1x por sessão, nunca força de volta se a
  pessoa trocar pra Kanban na mão (bug pego ANTES de shippar: o listener é
  ao vivo, sem o guard reaplicaria toda vez que outro board_pref mudasse).
- **Caso #2 — preset de filtro recorrente**: `SUGESTAO_FILTRO_CAMPOS`/
  `SUGESTAO_FILTRO_LIMIAR_DIAS`(4)/`SUGESTAO_FILTRO_JANELA_DIAS`(10) —
  L12843/L12844/L12845, `_filtroFingerprint(f)`/`_filtroComboLabel(f)` —
  L12850/L12861, `_registrarSinalFiltro()` — L12874 (chamada no fim de
  `applyFilters()` — L12796), `_checarSugestaoFiltro(fp,hist)` — L12992.
  Aceitar chama o `saveFilterPresetPrompt()` já existente, sem duplicar
  lógica.
- **Caso #3 — "Meus cards" fixado na toolbar**: `SUGESTAO_MEUSCARDS_*` —
  L12963, `_marcarUsoMeusCards()` — L12976 (chamada no topo de
  `highlightMyCards()` — L18437), `_checarSugestaoMeusCards()` — L13087,
  `_fixarMeusCardsNoHeader()`/`_applyMeusCardsFixadoUI()` — L13096/L13101
  (grava `board_prefs.meus_cards_fixado`, toggla `#tb-meus-cards`).
- **Caso #4 — atalho rápido de atribuição**: `SUGESTAO_ATRIBUICAO_*` —
  L27469, `_registrarSinalAtribuicao(ownerInit)` — L27472 (chamada no
  TOPO de `runAutoRules()` — L31972, funil único por onde os caminhos
  de atribuição — manual/autosave/bulk/criação, e desde 2026-09-21
  também `executarReatribuir()` (⚙ Config → "🔁 Reatribuir cards",
  achado real de `/monitorarbugs`: mutava `card.owner` sem
  `recordHistory()`/`runAutoRules()`) — já passam, evita duplicar o
  sinal em cada call site), `_checarSugestaoAtribuicao(hist)` —
  L27483, `_criarAtalhoAtribuicao(init)` — L27494 (grava
  `board_prefs.atribuicao_rapida[]`, registra ação dinâmica em
  `ATALHO_ACOES` e leva pra ⌨️ Atalhos já na aba certa),
  `_applyAtribuicaoRapidaAcoes()` — L27803 (recria as ações toda vez que
  board_prefs carrega — `ATALHO_ACOES` é `const`, mas isso só trava a
  REFERÊNCIA, adicionar propriedade continua válido), `_quickAssignOwner(init)`
  — L13700 (reusa `scheduleAutoSave()` do dropdown manual, não reimplementa
  `notifAssigned()`/histórico).
- **Caso #5 — filtro de atrasados por horário**: o mais caro/frágil dos 5
  (sinal mais ruidoso, amostra menor), deixado por último de propósito.
  `_cardEstaAtrasadoAgora(c)` — L31874 (NÃO reaproveita `_cardAtrasadoMs()`,
  que mede tempo acumulado histórico, não o estado atual),
  `_registrarSinalAtrasado(c)` — L32195 (chamada em `openCard()` — L14794),
  `_checarSugestaoAtrasados(hist)` — L31897, `_ativarVisaoAtrasados(bloco)`
  — L31910 (grava `board_prefs.visao_atrasados_bloco`). Aplicado no boot
  só 1x por sessão (`window._visaoAtrasadosAplicada`) e só se a hora atual
  cair no bloco de 2h aprendido — simplificação deliberada, versão
  "correta" (ligar/desligar dinamicamente ao longo do dia) tinha risco
  real de sobrescrever um filtro que a pessoa já mexeu na mão.
  **`/monitorarbugs` (mesmo dia, PR #867)**: histórico nasceu contando só
  eventos brutos (`SUGESTAO_ATRASADOS_LIMIAR`=0.5 sobre as últimas 12
  aberturas), sem checar em quantos DIAS diferentes o padrão se repetia —
  1 sessão de triagem já disparava a sugestão. Corrigido reaproveitando o
  padrão `{valor,date}`/dias-distintos do Caso #2:
  `SUGESTAO_ATRASADOS_LIMIAR_DIAS`(4)/`SUGESTAO_ATRASADOS_JANELA_DIAS`(10)
  — L30388-30389.
- **Aplicação no boot**: dentro de `_applyBoardPrefsSquad()` — L28592
  (listener AO VIVO de `loadBoardPrefs()` — L28569, roda de novo a cada
  mudança de QUALQUER board_pref) — casos #1/#3/#4/#5 todos aplicados
  aqui, cada um com seu próprio guard "1x por sessão" quando aplicável.
  Boot chama `_iniciarSessaoMeusCards()`/`_iniciarSessaoTimeline()` junto
  de `fbLoadAll()` no mesmo `_onRealAuthChange(...)` — L34691.

### 👤 Minhas Preferências (2026-09-28)
Painel único reunindo toda personalização pessoal do board — antes
espalhada em ~6 pontos de entrada diferentes (tema, menu Fonte, modal
Atalhos, sino de DND, dropdown do squad, sugestões que só apareciam
sozinhas), sem NENHUM lugar central pra ver/desfazer nada. Pedido
direto do usuário. Acessível a QUALQUER papel — menu do avatar ("Meu
status", `openStatusMenu()` ~L10865) — + atalho de dentro de
"⚙ Configurações" pra ADM/PO/Organizador (mesma tela, não duplicada,
botão `#cfg-minhasprefs-btn` no `panel-hd` de `#cfg-ov`).
- `openMinhasPrefs()` — L13520 / `renderMinhasPrefsBody()` — L13525 —
  monta as 7 seções (Tema/Fonte+Densidade/Squad padrão/Não Perturbe/
  Atalhos/Sugestões de rotina/Sugestões recusadas) a partir do estado
  já existente (`_boardPrefsSquad`, `_boardPrefsGlobal`, `_notifPrefs`,
  `boardFontSize`, `boardCardDensity`) — não introduz estado runtime
  novo pra essas, só front-door pra controles que já existiam noutro
  lugar (tema/fonte/densidade/squad padrão/DND continuam com suas
  próprias funções originais, só chamadas daqui também).
- **Sugestões de rotina, agora reversíveis** (achado de produto, não
  bug — nenhuma das 5 tinha jeito de desfazer pela UI até aqui):
  `_prefsToggleTimelineInicial()` — L13617, `_prefsToggleMeusCardsFixado()`
  — L13623 (toggle de verdade, liga E desliga), `_prefsToggleAtrasadosAuto()`
  — L13633 (só desliga — não tem como "ligar" sem um bloco de horário
  aprendido pela sugestão automática; linha correspondente do painel
  vira texto informativo, sem toggle, enquanto `visao_atrasados_bloco`
  for `null`), `_removerAtalhoAtribuicaoRapida(init)` — L13638 (remove
  o item de `board_prefs.atribuicao_rapida[]` + a entrada dinâmica de
  `ATALHO_ACOES` + a combinação de tecla via `_atalhoLimpar()`, se
  tinha uma — antes disso, o único dos 5 casos parcialmente reversível,
  mas a linha "👤 Atribuir a X" ficava pra sempre na tela de Atalhos
  mesmo removendo só a tecla).
- **"Não sugerir mais" — migrado de localStorage pra Firebase**:
  `loadSugestoesRecusadas()` — L13345 (listener,
  `kanban/usuarios/{uid}/sugestoes_recusadas/{squadId}`, com migração
  automática do que já estava só no `localStorage` do navegador na 1ª
  leitura — mesmo espírito de `_boardPrefLoadOrMigrate()`),
  `_sugestaoEsquecerRecusa(id)` — L13374 (novo — desfaz uma recusa),
  `_sugestaoRecusaLabel(id)` — L13384 (rótulo legível; ids de Caso
  #2/#4/#5 embutem parâmetro dinâmico — `filtro:<fp>`/
  `atribuicao:<init>`/`atrasados:<bloco>` — não são um id fixo só).
  `_sugestaoRecusadaPermanente()`/`_sugestaoRecusarPermanente()`
  (declaração original, ver seção "💡 Personalização baseada em
  rotina" acima) passaram a ler/escrever esse cache em vez do
  `localStorage` direto.
- Não tem seção/anchor pro Caso #2 (preset de filtro) neste painel de
  propósito — o resultado de aceitar aquela sugestão é um preset comum,
  já gerenciável na barra de Filtros (`removeFilterPreset()`); o painel
  só linka pra lá (`toggleFilters()`).
- **Atalho pro tema 🌴 Vice City (2026-09-28, fix 2026-09-29 — promovido
  pra prod v8.30.764)**: botão na
  seção 🎨 Tema que só aparece depois que a pessoa já descobriu o easter
  egg (long-press de 1.2s no botão de tema, `toggleViceCity()` — ver
  "Temas" mais abaixo) — nunca revela a existência dele pra quem nunca
  achou. `_temasDescobertos` (cache) / `loadTemasDescobertos()` — L13501
  (listener, `kanban/usuarios/{uid}/temasDescobertos`). Gate usa o campo
  `vice_manual` (não `vice`) — `vice` sozinho também é escrito pelo tema
  automático (`_applyAutoTheme()`, banda 12h-18h), então usá-lo pra
  gatear o atalho vazava o easter egg pra quem nunca descobriu na mão
  (`/monitorarbugs` 2026-09-29, dev v8.30.759-dev). `vice_manual` só é
  gravado por `_recordViceCityManualDiscovery()` — L34487, chamada de
  dentro de `toggleViceCity()` — L34495. Botão reusa `toggleViceCity()`
  direto (entra se não estiver no tema, sai se já estiver).
- **♾️ Contínuo (2026-09-29, pedido direto — promovido pra prod v8.30.764,
  após 5 rodadas de ajuste visual da fita diagonal, PRs #1100-#1104)**: categoria de card pra
  demanda que nunca fecha de propósito (ex.: "Melhorias Maré Digital",
  "Ajuste recorrentes de IA" na squad dados — sempre voltam a ter
  trabalho, sem data de finalização real). `card.continuo` (bool, sem
  campo companheiro de tempo — categoria fixa, sobrevive à duplicação de
  propósito, mesmo espírito de `card.isOKR`). `toggleContinuo(cardId)` —
  L16342 — e `_renderContinuoBtn()` — L16357 — mesmo padrão de
  `togglePauseCard()`/`_renderPauseBtn()` logo acima (`recordHistory()`
  explícito, não usa o sistema genérico `HIST_FIELDS`), cardId opcional
  (cai no card aberto no modal). 2 pontos de entrada: botão `#btn-continuo-card`
  no rodapé do modal + item no menu de contexto (ícone `♾️`, DIFERENTE de
  `🔁` — colidiria com "Salvar como recorrente" no mesmo menu, conceito
  totalmente diferente). **Indicador visual (fix 2026-09-29, mesmo dia,
  pedido direto "e se colocarmos esse infinito como aquela faixa q vc fez
  pro modo black friday?")**: fita diagonal `.card-continuo` (CSS, perto
  de `.card.card-prio-critical` do Black Friday — L626) reusando o MESMO
  fix de `clip-path` documentado ali (causa raiz do bug de clipping do
  Chromium/WebKit); substituiu o selo inline pequeno que existia antes.
  Diferente da fita "🔥 OFERTA" (theme-gated, decoração sazonal), a de
  Contínuo aparece em QUALQUER tema (`var(--teal)`, não cor fixa — cada
  tema já define a variável com valor coerente, sem precisar de override
  por tema). **`::after`, NUNCA `::before` (fix 2026-09-29, achado real —
  relato direto do usuário com screenshot: selo saindo ilegível em
  "Melhorias Maré Digital")**: `.card.card-mine::before` (selo "👤 seu
  card", ~L947) já ocupa `::before` nesse elemento — card marcado como
  seu E Contínuo ao mesmo tempo é o caso MAIS COMUM possível, não uma
  exceção. 2 regras `::before` de especificidade igual não fazem "uma
  vence inteira" — o CSS mescla PROPRIEDADE POR PROPRIEDADE (a última no
  arquivo vence cada propriedade que declara), então ficava com o texto
  "👤 seu card" (de `.card-mine`, declarado depois) mas girado 40°/
  largura 110px (que `.card-mine::before` não declara, sobrevivia da
  regra de Contínuo) — selo ilegível. Colisão bem mais rara (crítico +
  Black Friday + Contínuo juntos): como agora é `::after` vs. o
  `::before` do 🔥 OFERTA, os 2 pseudo-elementos coexistem sem se
  misturar, só podem se sobrepor visualmente no mesmo canto — aceito por
  ora. **2º achado real, mesmo relato/screenshot (fix 2026-09-29, mesmo
  dia)**: trocar pra `::after` resolveu a MISTURA de propriedades, mas
  não um 2º problema — `.card-continuo{clip-path:inset(0 round
  var(--r));}` clipa TUDO que passa da caixa do card, incluindo o selo
  "👤 seu card" (`.card-mine::before`, top:-9px de propósito, cortado na
  metade). Confirmado por geometria (a fita ♾️ rotacionada extrapola
  ~24px ACIMA do card perto do lado DIREITO — por isso o clip-path
  top:0 é necessário ali; o selo "seu card" fica no lado ESQUERDO, fora
  dessa região). Em vez de uma forma de clip customizada (frágil,
  dependeria da largura exata do card), fix mais simples: `.card.card-mine.card-continuo::before{top:0;}`
  — reposiciona o selo só nessa combinação (3 classes, especificidade
  maior que as 2 declarações originais, dark e claro, garante que vence
  sempre). Excluído de: `_renderCFD()`, `_renderBurndown()`
  (senão infla/nunca zera o gráfico, já que o card nunca sai da coluna) e
  `_computeTempoData()` (cycle/lead time E o "gargalo" por coluna saem
  juntos, mesmo filtro); e do alarme visual de "card parado" (esmaecimento
  aged-1/aged-2, badge "⏳ parado nesta coluna", trigger de Automação
  'aging') — mesma suspensão que `card.paused` já tem, mesmo motivo.
  Decisão explícita do usuário: continua contando no WIP (ocupa capacidade
  real) e no Throughput (sem caso especial se algum dia chegar num done).
  `functions/agente-agil-orquestrador/tools/visaoBoard.js` (`summarizeBoard()`)
  já é naturalmente imune — cycle/lead/gargalo ali só olham
  `flow.doneAt`, que um card contínuo nunca tem — confirmado lendo o
  código, não assumido, nenhuma mudança necessária lá.
- Validado com Playwright (harness de mock do Firebase, ver nota no
  `CHANGELOG.md` — SDK vendorizado localmente interceptado via
  `page.route()`, zero rede real) — abertura, os 7 toggles/ações, e
  layout mobile (botão de `#cfg-ov` colapsa pro emoji sozinho abaixo de
  768px, `@media(max-width:768px) #cfg-minhasprefs-btn span`).

### ⎋ Esc fecha a tela aberta (2026-09-07)
Pedido direto do usuário — "quando o board abre outras telas, tipo
dashboard ou help content, o esc tem q funcionar como um fechar". O
handler principal de `keydown` (mesmo bloco do Ctrl+K/D/S/Z e dos
Atalhos personalizáveis, ~L28983) ganhou
`document.querySelector('.ov.open')` → `closeOv(id)` — a MESMA função
que o clique-fora-do-backdrop já chama pra CADA overlay `.ov` (ver
`document.querySelectorAll('.ov').forEach(...)` perto de
`_finishCloseOv()`), não uma cópia — ganha de graça qualquer trava de
confirmação (ex.: `card-ov` com alteração não salva). Guard:
`if(!document.getElementById('ui-modal-ov'))` — não faz nada se um
`uiConfirm()`/`uiAlert()`/`uiPrompt()` estiver aberto (`#ui-modal-ov`,
sempre por cima, `z-index:99999`, criado dinamicamente por `_uiModal()`)
— sem esse guard, Esc fecharia os DOIS ao mesmo tempo (o modal de
confirmação E a tela por trás dele), quando a intenção normal é só
cancelar a confirmação.
**Ajustes de propagação feitos junto** (campos com seu próprio uso de
Esc, que agora precisam de `stopPropagation()` pra não fechar a tela
inteira sem querer): busca da Central de Ajuda (`#help-search`, só
propaga se já não tinha texto pra limpar), edição inline de item de
checklist (`finishEdit(false)`), dropdown de `@menção`
(`handleMentionKey`), e as 3 edições inline da Ficha Técnica
(`_crvDeleteRow` etc., campos due/qtd/texto livre).
**Achado incidental, não corrigido**: `document.querySelector('.ov.open')`
pega o PRIMEIRO `.ov.open` na ordem do DOM, não necessariamente o mais
recentemente aberto — na prática só importa se dois `.ov` abrirem
simultaneamente, o que hoje só pode acontecer via um atalho `tipo:'global'`
(ver seção Atalhos acima) disparado enquanto `card-ov` já está aberto
(`.ov` não bloqueia atalhos de teclado do resto da página, só cliques).
Cenário raro, não reproduzido nem corrigido nesta rodada.
**Achados reais (2026-09-07, `/monitorarbugs`, pedido explícito "roda um
/monitorarbugs nessas implementações" — antes de promover pra prod)**:
3 achados na própria rodada de features do dia (Atalhos + Esc + 🔀
Reorganizar barra), técnica 1 (comparar TODOS os call sites de um
padrão — aqui, todo handler de `Escape` do arquivo) e técnica 3
(confrontar o código contra o que a própria feature promete).
1. **6 handlers locais de Esc dentro do `card-ov` nunca ganharam
   `stopPropagation()`** na 1ª leva de ajustes — passei por cima deles
   ao mapear só os handlers que eu já lembrava, não TODOS os
   `key==='Escape'` do arquivo. Apertar Esc pra cancelar a edição da
   Descrição, do formulário de anexo, da busca de Notas vinculadas, da
   busca de card filho (Supercard), de um comentário novo, ou de um
   comentário já existente em edição — todos fechavam o CARD INTEIRO
   junto, mesmo só querendo cancelar aquele campo. Fix: `event.stopPropagation()`
   nos 6 (`m-desc`, `m-attach-url`, `m-notas-link-search-inp`,
   `m-super-search-inp`, `m-comment-inp`, `cedit-ta-{cid}`). Achado
   incidental, não corrigido: os drawers (Notas/Kudos/Spotify/Lembretes,
   `.lem-drawer`) não são `.ov` e Esc não fecha eles — fora do escopo do
   pedido original ("dashboard ou help content"), mecanismo de
   fechamento diferente o suficiente pra merecer pedido explícito antes
   de mexer.
2. **Modo "🔀 Reorganizar barra" nunca ganhou o bloqueador de clique
   prometido no desenho** ("Um bloqueador de clique... evita que um
   arrasto vire sem querer um clique que abre o painel do botão" — a
   implementação real nunca chegou a adicionar isso). Um clique rápido
   (sem arrastar de verdade) num botão durante o modo abria o painel
   dele normalmente — ex.: clicar querendo pegar "🎬 Controle de
   Criativos" pra arrastar abria o Controle de Criativos no meio da
   reorganização. Fix: listener de `click` em fase de CAPTURA em
   `#main-toolbar` (`_wireToolbarDrag()`), só intercepta enquanto
   `_toolbarReorderMode` está ligado.
3. **Esc não cancelava o modo de reorganizar** — contradizia a
   expectativa que a PRÓPRIA feature #1 (Esc fecha a tela aberta) acabou
   de criar no mesmo PR. Fix: handler principal de `keydown` checa
   `_toolbarReorderMode` ANTES do fechamento genérico de `.ov` (o modo
   não tem classe `.ov`) — Esc agora chama `finalizarReorganizarToolbar()`
   (mesmo caminho do botão "✅ Pronto", salva o que já foi arrastado).

### Checklist (com grupos colapsáveis)
- `renderCL()` — L16170
- `_clGroupsInit()` — L16135
- `toggleChecklistGroupCollapse()` — L16148
- `_clParsePasted()`/`addCIsToGroup()` — colar lista (2+ linhas) no "Novo item..." (listener `paste` do input em `renderCL()`): 1 item por linha, tira marcadores, entende `[x]`/`[ ]` (formato de `copyAllChecklist()`); 1 linha cola normal (v8.30.793-dev).

### Campanhas (`openCamp()`, botão "📣 Campanhas")
- `renderCampDashboard()` — L21956 — aba "📊 Dados de Produção" do detalhe
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
- `_crvAutoTitle()` — L16600 — título automático do filho a partir da Ficha Técnica
- `searchSuperChildren()` — L27400 — busca de cards existentes ao criar um filho
- `_mergeModeloEmCardObj()` — L31205
- `_applyFanoutTemplate()` — L31159 — cria os filhos de uma receita de fan-out;
  `applyFanoutToCurrentCard()` — L31266 — botão manual "🧩 Aplicar receita",
  recalcula `editingSuperChildren`/`editingSuperArchivedIds` via
  `_splitSuperChildIds()` depois de aplicar
- Nesting de 2 níveis (campanha → criativo → versão): `editingSuperParentIsChild`
  (global, L26879) + `initSuperChildren()` — L26899 — calcula se o card
  aberto já seria uma "versão" (teto real do 2º nível). `editingSuperParent`
  (busca reversa "quem é meu pai?", dentro da mesma função) filtra pai
  arquivado desde 2026-09-18 (`/monitorarbugs` — sem isso, um filho ainda
  ativo de uma campanha arquivada ficava "preso" a ela: Ficha Técnica
  própria escondida, mas já livre pra `searchSuperChildren()` adotar em
  outro supercard — contradição entre os 2 pontos, corrigida com o mesmo
  filtro `!c.archived` que o cálculo do avô, logo abaixo na função, já
  usava).
- `_crvOwnSummary()` — L27271 — resumo dos campos próprios do criativo,
  usado no card de versão (2º nível)
- **`_splitSuperChildIds(childCardIds)` — L27138** (2026-09-18) — separa
  `card.childCardIds` em `{ativos:[{id,title,col}], arquivadosIds:[id]}`;
  usado por `initSuperChildren()` e por `applyFanoutToCurrentCard()`.
  `editingSuperChildren` (global, L26696) guarda só os ativos — é o que
  o modal exibe/conta ("X/Y concluído(s)"); `editingSuperArchivedIds`
  (global, L26705) guarda os arquivados à parte, existe só pra não se
  perderem: `persistSuperChildren(histWhat)` — L27512 — grava
  `childCardIds` de volta sempre como `[...ativos, ...arquivadosIds]`
  juntos, senão salvar o card depois de abrir o modal desvincularia os
  arquivados de verdade do Firebase (achado ao filtrar só a exibição na
  1ª tentativa do fix); também chama `_notifySupercardAllDone(parent)`
  (2026-09-22, ver seção logo abaixo) — vincular um filho já concluído
  reavalia a conclusão do pai na hora, não só quando algo se MOVE.
  `histWhat` opcional grava no 📜 Histórico do PAI
  antes de salvar — chamado por `addSuperChild()` (L27433, "vinculou o
  card filho..."), `removeSuperChild()` (L27443, "desvinculou...") e
  `quickCreateSuperChild()` (L27053, "vinculou... (novo)"); `_histTipo()`
  (~L8745) classifica essas 3 frases + "aplicou fan-out..." (já existente)
  com ícone próprio 🧩 (`CARD_HIST_TIPOS.supercard`).
- **`_checkSupercardAllDone(childCard)`/`_notifySupercardAllDone(parent)`**
  — L31844, logo abaixo de `_isColCancelLike()`. Antes (até 2026-09-22)
  chamava-se `_checkSupercardAutoComplete()` e MOVIA o pai sozinho pra
  coluna de fim quando todos os filhos ativos concluíam, cascateando
  filho→pai→avô recursivamente (guard `ancestry` contra ciclo). Decisão
  do usuário (`/monitorarbugs`, relato direto — auto-mover não estava
  disparando de verdade): trocado por um COMENTÁRIO automático no pai
  (autoria "⚙ Automação"), marcando `@`+`parent.owner` (Responsável),
  pedindo pra mover manualmente — o board nunca muda a coluna sozinho
  agora. `parent._superAllDoneNudged` (novo campo) evita repetir o
  comentário a cada evento; reseta sozinho (via `_notifySupercardAllDone`)
  se o card deixar de estar 100% completo. Sem `ancestry`/recursão: como
  o pai não muda mais de coluna sozinho, a cascata pro avô só acontece
  quando a pessoa move o pai de verdade — isso já é um evento de 'move'
  novo, que re-roda a mesma checagem naturalmente. `_isColCancelLike()`
  — L31828, logo acima — se TODOS os filhos ativos terminaram cancelados,
  não avisa nada (cancelar tudo ≠ concluir tudo). Hooks: `runAutoRules
  ('move', card.id, ...)` chama `_checkSupercardAllDone(card)` direto
  (dentro de `runAutoRules()`) — herda cobertura dos 9 call sites que já
  disparam `runAutoRules('move',...)`; `persistSuperChildren()` (abaixo)
  chama `_notifySupercardAllDone(parent)` direto no pai — cobre o
  caminho que NUNCA disparava antes (vincular um filho JÁ concluído via
  `addSuperChild()`/"+ Adicionar", sem nenhum evento de 'move' — a causa
  raiz real do bug reportado).
- `_duplicarComFilhos()` — L15844 — duplicar um supercard com opção de
  duplicar os filhos junto (checkbox opt-in no modal de duplicar, só
  aparece se `_cardIsSupercard()`). Recursivo (cobre netos, 3 níveis
  campanha→criativo→versão), religa `childCardIds` pros ids NOVOS, filhos
  mantêm a própria coluna (não herdam `opts.col` do card raiz), filhos
  arquivados ficam de fora, `visited` protege contra ciclo corrompido nos
  dados
- **🏢 Enviar card pra outro squad (2026-09-09)** — MESMO modal de
  ⧉ Duplicar (`#dup-ov`), seletor `#dup-squad` no topo
  (`_dupPopulateSquadSelect()`, lista `SQUAD_META_LIVE` menos
  `ACTIVE_SQUAD`). `_dupOnSquadChange()` alterna a UI (esconde Coluna/
  Responsável/Participantes/Comentários — não fazem sentido cross-squad
  — quando um squad é escolhido). Como cada squad é uma página isolada
  (`ACTIVE_SQUAD` fixo por load, `FB='kanban/squads/'+ACTIVE_SQUAD+
  '/dados'` — colunas/membros/tags/config de outro squad NÃO estão
  carregados aqui), a implementação não tenta um 2º formulário de
  validação: `_confirmarEnviarOutroSquad(card, squad, opts)` monta um
  payload leve (tags por NOME, não id — squads têm tag ids diferentes),
  grava em `sessionStorage` (`mare_squad_transfer`), registra
  `recordHistory()` no card ORIGEM ("enviou uma cópia pra squad X") e
  navega pra `?squad=X&transfer=1` — mesmo mecanismo de troca de squad
  do header. `_maybeConsumirTransferSquad()` (chamada perto de
  `fbLoadAll()` no boot) detecta `transfer=1`, espera ~900ms (dar tempo
  de columns/tags/Submarca do squad de destino chegarem) e chama
  `_consumirTransferSquad(payload)`: abre `openNewCard()` (formulário
  REAL do squad de destino, com Submarca/Ficha Técnica já corretos pra
  lá) e pré-preenche título/desc/checklist/prazo/prioridade/riscos;
  tags casadas por label (mesma técnica de `_intakeCriarCard()`,
  silencioso se não achar). Links são um caso à parte: `attachSave()`
  exige um card com id real (não existe ainda nesse ponto) — ficam em
  `_pendingTransferLinks`/`_pendingTransferOrigem` (mesmo padrão de
  `_intakeOrigemPendingId`/`intakeId`) até `saveCard()` criar `_newCard`
  de verdade, que herda `links`/`transferOrigem` (traceability) direto
  no objeto. Sem checagem de permissão nova: `database.rules.json`
  já libera escrita em qualquer squad pra e-mail `@ciahering.com.br`
  (mesma base do seletor de squad do header).

### Card lock / "Pedir o card"
- `CARD_LOCK_REQUEST_GRACE_MS` — L13873
- `_cardLockRequestPath()` — L14037
- `pedirCard()` — L14047
- `liberarCardAgora()` — L14061
- `_renderLockRequestUI()` — L14065
- `_handleLockRequest()` — L14100
- `_checkCardLock(cardId)` — perto de L14173 — chamada de dentro de
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
- `createNotif(targetUid, type, title, sub, cardId, idOverride, commentId, extra, dedupeExtra)` —
  L27597. `extra` (2026-09-06, opcional) — objeto mesclado no registro,
  pra campo específico de 1 tipo só (ex.: `{meetingLink}` em `reuniao`)
  sem virar campo fixo de todo notif. `dedupeExtra` (2026-09-22,
  opcional) — a dedupeKey de 5s (`targetUid+type+(cardId||idOverride)`)
  colidia pra tipos sem `cardId` próprio (`kudos`/`kudos_monitor`/
  `gcal_pending`/`feedback`, sempre `cardId=null`) ou que compartilham o
  MESMO `cardId` entre eventos distintos (`reacao` — reações a
  comentários diferentes do mesmo card), derrubando notificações reais
  diferentes disparadas a poucos segundos de distância. Agora a
  dedupeKey também soma `commentId||dedupeExtra` — call sites afetados
  passam o id do próprio evento (`k.id`/`obj.id`/`reqId`/`id`/`cid`).
- `loadNotifs()` — L28411
- `NOTIF_ICONS` — ícone por `type`; ganhou `okr_editado`/`okr_prazo`/
  `okr_reuniao` (🎯), `okr_agente` (🤖) em 2026-09-06, e
  `recorrente`/`reuniao`/`gcal_pending`/`gcal_approved`/`reacao`/
  `feedback`/`painel_broadcast` na mesma data (caíam no 🔔 genérico).
  `due_soon` continua no mapa mas nenhum código emite esse tipo —
  código morto inofensivo.
- `openNotif(notifId, cardId, squad, commentId, type, okrObjId, meetingLinkEnc)` —
  L28533 — navegação ao clicar. `type==='intake'` abre o painel de Intake; 4
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
- `checkDueNotifs()` — L28913 — due_today/due_overdue, 1x/dia
- `parseMentions()` — L28711 — @menção em descrição/PO/checklist/comentário;
  `@todos` (`TODOS_MENTION_ENTRY`, 2026-09-01) notifica todos os membros do
  squad de uma vez em vez de 1 pessoa. `opts.includeSelf` (2026-09-01,
  achado real corrigido 2026-09-22): o branch `@todos` já respeitava desde
  a origem, mas o branch normal (`@handle`/`@init`, usado por
  `notify_po_org` e `_notifySupercardAllDone()`) ignorava o parâmetro por
  completo — `if(uid===window._currentUser?.uid) continue;` sem checar
  `opts.includeSelf` antes. Quando quem disparava o evento automático era
  justamente a pessoa @mencionada (PO que causou a própria regra,
  Responsável que acabou de vincular o último filho do supercard), ela
  nunca era notificada, em silêncio — achado via teste real na UI, não no
  console (o script de teste usava um init fake, que nunca bateria com o
  próprio usuário testando).
- `mentionCandidates()`/`mentionMatchLabel()` — L7427/L7446 — autocomplete
  de @; entradas sintéticas (`init` sentinela, nunca um membro real):
  `TODOS_MENTION_ENTRY` (sempre 1ª opção) e `AGENTE_AGIL_MENTION_ENTRY`
  (só em squads com Cloud Function ouvindo).

### 📅 Calendários (Google Calendar) — nunca teve seção própria até 2026-09-18
Arquitetura em 2 camadas independentes, sem token OAuth próprio pro squad
comum — só um ADM autentica de verdade, o resto lê um cache já pronto:
- **Squad ("local")**: `addCalendarToList()` — L30038 — grava a agenda
  direto em `FB+'/config/calendars'` (client-side), depois enfileira uma
  aprovação via `_queueGcalRequest()` — L30063 (`gcal_pending`, ver
  `NOTIF_ICONS`/`openNotif()` na seção Notificações acima) — porque só
  um ADM tem token OAuth válido pra buscar de verdade.
  `processGcalQueueForAdmin()` — L30289 — ADM aprova, dispara
  `_fetchAndCacheGcalForSquad()` — L30190 — fetch real na API do Google,
  escreve `gcal_cache` do squad.
- **Painel ("global")**: sistema PARALELO e independente em
  `painel-dev.html`, com seu próprio loop de fetch (~L7580-7660) e
  escrita em `kanban/painel/config/gcal_cache_dev` — cada squad pode ter
  calendários próprios ("locais") além dos globais do painel.
- **Merge pra exibição**: `_mergeGcalSources()` — L29843 (função aninhada,
  não top-level) — combina os eventos "locais" do squad com os "globais"
  do painel pra desenhar o calendário do kanban. Mais sensível que uma
  função de exibição normal: além de filtrar, ela REGRAVA o resultado
  filtrado de volta no `gcal_cache` LOCAL do squad (`window._set(...)`)
  — não é só uma view, é a fonte que persiste o cache local.
- **Dedup de eventos** (`/monitorarbugs` 2026-09-18, 3 sites: os 2 acima
  + o loop do painel): agendas públicas do Google (ex.: feriados
  nacionais) às vezes retornam o MESMO evento 2x com IDs internos
  diferentes — os 3 sites deduplicam por `_calId+data+título normalizado`.
  Achado real: a chave ORIGINAL (sem `_calId`) colidia eventos
  DIFERENTES de calendários DIFERENTES com título genérico igual na
  mesma data (ex.: "Reunião") — em `_mergeGcalSources()` isso é mais
  grave que um bug de exibição, porque apaga o evento de verdade do
  cache persistido, não só esconde de uma renderização.

### Notas
- `toggleNotas()` — L19194, `setNotasScope()` — L19207
- `renderNotasList()` — L19242, `createNota()` — L19274
- `openNota()`/`closeNotaEditor()` — L19290/L19291
- `renderNotaEditor()` — L19567, `toggleNotaModo()` — L19879 (livre/estruturado)
- `renderNotaLinkedCards()` — L19317, `notaSearchCards()`/`notaAddCardLink()`/`notaRemoveCardLink()` — L19335/L19360/L19379
- `renderNotasVinculadasNoCard()` — L19402 — seção "Vínculos" dentro do card

### Automações (Butler-style)
- `AUTO_TRIGGERS` — L32189 (21 triggers — `agendado_created` adicionado
  2026-08-30, par de `recorrente_created` que faltava)
- `AUTO_ACTIONS` — L32277 (16 ações — `notify_po_org` ["Notificar
  PO/Organizador"] adicionada 2026-09-17, pedido direto do usuário;
  mesmo padrão de `notify_all` mas filtra `members` por
  `role==='po'||role==='organizador'` antes de montar o `@menção`, sem
  postar nada se o squad não tiver ninguém nesses papéis)
- `runAutoRules()` — L32877 — só decide QUAIS regras batem (síncrono);
  `_runAutoRuleAction()`/`AUTO_RULE_DELAY_MS` (logo acima) aplicam o efeito
  de verdade depois de ~1.2s (pedido direto: dar um respiro visual antes do
  efeito da automação, e mostrar toast "⚡ Automação ... foi aplicada" —
  antes era instantâneo e silencioso) — re-busca o card no momento de
  aplicar (guarda contra card excluído/arquivado durante o delay)
- `_autoTrigger()`/`_autoAction()` — L32478/L32479
- `_autoValLabel()`/`_autoRenderValueOptions()` — L32482/L32506
- **`saveAutoRule()`/`toggleAutoRule()`/`delAutoRule()`** — L32654/L32696/L32707
  — CRUD das regras (`kanban/squads/{sq}/dados/auto_rules`, array com `id`
  estável por regra). **Achado real (relato direto, 2026-10-01 — Vinicius
  criou uma regra que nunca disparou e sumiu da lista)**: as 3 escreviam o
  array `autoRules` LOCAL inteiro de volta (`fbSet`, sobrescrita completa)
  mesmo com um listener ao vivo sincronizando — mesma corrida já corrigida
  em Kudos/Lembretes/Links (ver aquelas seções): regra criada/alterada por
  alguém é apagada em silêncio pela próxima escrita de qualquer um, dentro
  da janela entre o eco do listener e a ação seguinte. Fix: `runTransaction()`
  nos 3, toggle/exclusão casam por `id`.
- **Achado real (`/monitorarbugs`, 2026-10-01, escopo Automações)**: 7 ações
  de `AUTO_ACTIONS` (`set_priority`/`set_submarca`/`set_canal_venda`/
  `set_tamanho`/`set_demandante`/`set_padrao`/`set_cover`) não tinham o
  "no-op guard" (padrão já usado em `assign_owner`/`toggle_okr`) — regra
  re-disparando num card já no valor-alvo gravava histórico/salvava/
  mostrava toast à toa. Todas corrigidas pra retornar `false` sem mutar
  quando o valor já bate. Também achado: "Card bloqueado"/"Impedimento
  removido" nunca disparavam via botão **"✕ Remover impedimento"**
  (`removeBlockerTag()` — L33237, salva direto no Firebase sem passar por
  `saveCard()`) nem via marcar/desmarcar a linha de impedimento + 💾 Salvar
  no modal (branch de edição manual de `saveCard()`, ~L16138) — mesma
  classe já corrigida em `_doBulkBlockTag()`/`_doBulkUnblockTag()`
  (2026-08-27). Ambos agora chamam `notifUnblocked()`/`runAutoRules('blocked'/
  'unblocked', ...)` no mesmo ponto onde já fecham o episódio de ⏱️ tempo
  bloqueado (`_settleBlockedTag()`).
- **Acesso à tela de Automações** (achado real 2026-08-24: só existia via
  `⚙ Configurações → aba ⚡ Auto`, e o botão de Configurações fica
  escondido de quem não é PO/Organizador/ADM — `_applyRoleVisibility()`,
  L9153 — mesmo sem nenhuma trava de permissão nas ações em si) —
  `openAutoOv()` — L24944 — abre o overlay `#auto-ov` (fora de `#cfg-ov`), acessível
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
  `_claimPendingAuto()` — L31910 / `_refreshCardFromFirebase()` — L31928
  (força `cards` a refletir o estado mais recente do card antes de rodar
  `runAutoRules()`, já que a sincronização granular normal tem debounce de
  150ms e correria o risco de ler/resalvar um snapshot desatualizado por
  cima da própria mudança que disparou o evento). `criar_card` não
  precisa desse mecanismo — nunca cria card direto, só um rascunho em
  `intake_pending` que um humano confirma pelo modal normal (mesmo
  `saveCard()` que já dispara tudo certo).

### Campos dedicados por squad: Submarca / Canal de venda
Mesma arquitetura pros dois (toggle por squad + tags fixas + campo dedicado
+ filtro dedicado) — ver comentário na declaração de `CANAL_VENDA_TAGS`
sobre por que o nome interno é "canalVenda"/`CANAL_VENDA` (já existe um
campo "Canal" DIFERENTE — mídia de Ficha Técnica/Criativos,
`CANAL_OPCOES_DEFAULT`/`card.canal` — sem relação nenhuma com este).
- **Submarca** (squad Site Hering) — `SUBMARCA_TAGS` L7879 (10 tags fixas,
  5 marcas × Comercial/Cadastro); `submarcaAtivo`/`submarcasVisiveis` L7873-4;
  `toggleSubmarcaAtivo()`/`_ensureSubmarcaTagsBackfilled()` L15709/15687;
  `_applySubmarcaUIVisibility()` L16998; `setCardSubmarca()` L17008;
  dropdown da toolbar `renderSubmarcaQuickFilters()`/
  `toggleSubmarcaDropdown()` L17090/15869 (`#submarca-dd-wrap`); sempre
  **obrigatória** pra salvar assim que ativada (ver `saveCard()` ~L15305,
  HELP_CONTENT "Prazo, Submarca e Canal obrigatórios").
- **Canal de venda** (squad Marketplace, 2026-09-10, pedido direto do
  usuário "cria na mesma pegada do submarcas") — `CANAL_VENDA_TAGS` L7904
  (14 tags fixas: Mercado Livre ME1/ME2/Full, Dafiti, Netshoes, Shopee/
  Shopee Kids, Amazon/Amazon FBA, Privalia, Magazine Luiza, ZZ Mall, Off
  Premium, TikTok Shop); `canalVendaAtivo`/`canaisVendaVisiveis` L7900/7902;
  `toggleCanalVendaAtivo()`/`_ensureCanalVendaTagsBackfilled()` — mesmo
  bloco de funções logo depois de `renderSubmarcaCfgList()` (~L17158-16165);
  `_applyCanalVendaUIVisibility()`; `setCardCanalVenda()`; dropdown da
  toolbar `renderCanalVendaQuickFilters()`/`toggleCanalVendaDropdown()`
  (`#canalvenda-dd-wrap`, sem agrupamento — diferente do de Submarca, não
  há uma 2ª dimensão tipo Comercial/Cadastro aqui). Diferença deliberada de
  Submarca (confirmado com o usuário via `AskUserQuestion` antes de
  implementar): **opcional por padrão** — só vira obrigatório pra salvar se
  o squad ligar um 2º interruptor separado, `canalVendaObrigatorio`
  (`toggleCanalVendaObrigatorio()`, `config/canal_venda_obrigatorio`).
  Integrado em tudo que Submarca já tocava: `passesFilter()`
  (~L12253/12254), `activeFilters`/presets (`FILTER_PRESET_CAMPOS`),
  restauração no boot, exclusividade mútua em bulk-tag
  (`[SIZE_TAGS, SUBMARCA_TAGS, CANAL_VENDA_TAGS]`), 1-fixado-por-coluna+grupo
  (`togglePinCard()`), Automações (`AUTO_TRIGGERS` `canal_venda_set` /
  `AUTO_ACTIONS` `set_canal_venda`), donut "Por canal" em 📊 Dados do Board
  → Insights. **Gap conhecido, deixado de propósito fora desta rodada**: a
  ferramenta `criar_card` do Agente Ágil orquestrador
  (`functions/agente-agil-orquestrador/tools/criarCard.js`) tem uma cópia
  fixa `SUBMARCA_LABELS` validando o campo `submarca` server-side — ainda
  não existe um `CANAL_VENDA_LABELS` equivalente lá (mudança em
  `functions/`, exige deploy separado da Cloud Function pelo usuário, ver
  seção sobre `functions/` no `CLAUDE.md`) — o client (`_intakeCriarCard()`
  L~20885, executor de `criar_card` do chat direto L~23300) já está pronto
  pra casar `item.canal`/`input.canal` por label assim que o backend
  passar a enviá-lo.
  **`/monitorarbugs` (2026-09-10, rodada logo após criar o campo)**: 3
  achados reais comparando Canal ponto a ponto contra tudo que Submarca já
  cobre — `swCfgTab('tags')` não re-sincronizava os 2 checkboxes de Canal
  nem chamava `renderCanalVendaCfgList()` ao reabrir a aba (só Tamanho/
  Submarca tinham essa linha); `_hasActiveFilters()` (~L11797) não checava
  `f.canalVenda` — mesma classe de bug já corrigida 2x antes pra Submarca
  (PR #800/#809); import do Trello (~L23901, dentro da função de import)
  não tinha a "Prioridade 1" de match exato por nome que Submarca tem —
  label "Amazon"/"Shopee"/"Mercado Livre" caíam no fuzzy `includes()`
  genérico, risco real de colar no canal errado (ex.: "Amazon" → "Amazon
  (FBA)") pela ordem do array. Os 3 corrigidos, ver `CHANGELOG.md` (dev
  v8.30.628) pro detalhe de cada um.

### Botões exclusivos por squad na toolbar — 2 padrões diferentes, escolha proposital
- **Toggle de config, qualquer squad pode ligar** — ex.: "🎬 Controle de
  Criativos" (`btn-criativos`), visibilidade decidida por
  `config/criativos_ativo` (Firebase, `fbListen`), não pelo squad em si.
- **Hardcoded pro squad, sem toggle** (2026-09-30, pedido direto: "botão
  EXCLUSIVO pra eles" — promovido pra prod v8.30.765, mesmo dia) —
  **🐟 Cardume Criativo** (`btn-cardume-criativo`,
  `data-tb-id="cardumecriativo"`, perto de `btn-criativos` na toolbar):
  `window.open('https://cardume.ai.studio/','_blank')`, ferramenta própria
  da squad Mídia Criativa. Visibilidade decidida 1x no boot, logo depois
  de `ACTIVE_SQUAD` ser resolvido (~L6740) — `if(ACTIVE_SQUAD===
  'midiacriativa'){...style.display=''}` — mais simples que um toggle de
  config pra um caso que não precisa ser configurável (não é "qualquer
  squad pode querer isso", é uma ferramenta específica de UMA squad).
  Integra sozinho com o reorder de toolbar (`_toolbarDefaultOrder`,
  captura TODO `[data-tb-id]` via `querySelectorAll`, independente de
  `display`) — nenhuma mudança extra precisou ser feita lá.

### Impedimentos (modo coluna vs. tag)
- `blockerMode` (let) — L32866 — carregado de `config/blockerMode`, `'col'`
  (default) ou `'tag'`
- `_cardIsBlocked(card)` — L32876 — fonte única de verdade pro "está
  impedido?": modo `col` → `card.col==='blocker'`; modo `tag` →
  `!!card.blocker` (ignora o campo que não é da modalidade ativa)
- `saveBlockerMode(mode)` — L33084 — acionado em ⚙ Configurações →
  Impedimentos. Achado real 2026-08-26 (squad `midiacriativa`, incidente
  em produção — 64 cards sumidos do board): agora valida ANTES de trocar
  pra `'col'` se existe uma coluna com id `blocker`; se não existir,
  bloqueia a troca com aviso em vez de deixar a squad num estado onde
  cards já impedidos ficam invisíveis
- `ctxMove(colId)`/`ctxBlock()` — L32417/L32459 — `ctxBlock()` é só
  `ctxMove('blocker')`. Mesmo incidente:
  `ctxMove()` agora aborta com aviso se `colId` não bater com nenhuma
  coluna existente, em vez de gravar um `card.col` órfão —
  `renderNormal()` só mostra um card na coluna cujo id bate exatamente
  com `card.col`, então um id órfão faz o card sumir do board inteiro,
  intacto mas invisível (achável só via painel). **Achado real
  (`/monitorarbugs` 2026-09-06, técnica 1 — comparar caminhos paralelos):
  `ctxMove()` era o ÚNICO caminho de movimentação (drag `handleDrop()`/
  `_doBulkMove()`/mudança de coluna via modal `saveCard()` já chamavam)
  que nunca chamava `recordMove()`** — mover 1 card pelo submenu "↦
  Mover para" (ou pelo atalho `ctxBlock()`) deixava `flow.log`/
  `flow.doneAt`/`flow.firstStartAt` intocados (cycle/lead time, CFD,
  Timeline, Throughput cegos pra essa movimentação específica), o
  auto-desimpedimento em modo tag não disparava, e a rede de segurança
  mais robusta do ⏱️ tempo atrasado/bloqueado (ver seção própria acima)
  ficava sem cobertura. Corrigido: `recordMove(card, colId)` adicionado
  antes de mutar `card.col`, mesmo padrão de `_doBulkMove()`.
  **Achado real (`/monitorarbugs` 2026-09-22, técnica 1 — comparar
  contra `handleDrop()`, mesma operação "mover card")**: `handleDrop()`
  ganhou em 17/09 (PR #947, direto em prod pela gravidade) snapshot
  completo + revert total se `fbSaveCard()` falhar — `ctxMove()` nunca
  ganhou a mesma proteção. Uma falha de escrita (rede, permissão)
  deixava o card visualmente movido (já otimista/renderizado), com
  `flow`/histórico/`blocker` corrompidos em memória sem nenhum aviso.
  Mesmo padrão de snapshot (`JSON.parse(JSON.stringify(card))`)/revert
  no `.catch()` replicado aqui.
- **`_bulkFinish(msg, keepSelection, extraIds)`** — L7550 — finalizador
  COMPARTILHADO de toda ação em massa (mover, atribuir, tag, bloquear,
  excluir-marca...). **Achado real (`/monitorarbugs` 2026-09-22, mesma
  técnica acima)**: chamava `fbSaveAll()` fire-and-forget, sem
  `then()`/`catch()` — o toast de sucesso sempre aparecia, mesmo com a
  escrita falhando de verdade, pra QUALQUER ação em massa (choke point
  único). Reverter o estado local de N cards exigiria snapshot em CADA
  chamador antes de mutar (fora do escopo deste fix, maior) — corrigido
  só o mais direto: mostra aviso real (`.catch()`) em vez do toast de
  sucesso genérico quando a escrita falha.
- Menu de contexto do card (`showCtxMenu()` — L32427) — 2026-09-01,
  pedido direto ("mudar prioridade e mudar coluna... deveria abrir a
  lista pro lado pra n ficar mt grande", comparando com o submenu do
  Windows Explorer): "Mover para" e "Prioridade" viraram flyouts em vez
  de listas soltas ocupando a metade do menu. `toggleCtxSubmenu(ev,key)`
  — L32106 — abre/fecha `#ctx-submenu-fly`, elemento ÚNICO e
  INDEPENDENTE (irmão de `#ctx-menu`, não filho — `.ctx-menu` tem
  `overflow-x:hidden`, que corta um filho `position:absolute` que vaza
  da caixa do pai, mesmo com z-index maior; achado só ao tirar
  screenshot de verdade, não bastava checar a classe `.open` via JS),
  reposicionado via JS a cada clique com flip pra esquerda perto da
  borda direita. Conteúdo de cada flyout fica em `_ctxSubmenus.mover`/
  `_ctxSubmenus.prioridade` (preenchido por `showCtxMenu()`). CSS
  reaproveita `.ctx-sub`/`.ctx-submenu`, que já existiam no arquivo mas
  nunca tinham sido usadas em HTML/JS nenhum — sobra de uma feature
  começada e abandonada antes. `hideCtxMenu()` — L32626 — também fecha
  o flyout agora. `ctxCopyLink(cardId)` — L32839 — item novo "🔗 Copiar
  link do card", mesma URL de `shareCardLink()` (botão do modal) mas sem
  precisar abrir o card primeiro — `_cardShareUrl()` ganhou um `cardId`
  opcional (antes só funcionava com `editingId`, o card do modal
  aberto).
  **Submenus abrem no hover** (2026-09-15, `_ctxSubmenuHoverEnter()` —
  L32291 / `_ctxOpenSubmenuAt()` — L32249): passar o mouse por cima de
  "Mover para"/"Prioridade" já abre o flyout depois de 120ms
  (`_ctxHoverTimer`, L32130), sem precisar clicar. `/monitorarbugs` no
  mesmo lote (PR #925): nem `hideCtxMenu()` nem `showCtxMenu()`
  cancelavam esse timer — fechar o menu ou trocar de card com o timer
  ainda pendente fazia o flyout reabrir sozinho ~120ms depois, grudado
  no canto (trigger já desanexado), apontando pro card errado. Fix:
  `clearTimeout(_ctxHoverTimer)` nas duas funções.
- `_doBulkBlockCol()`/`_doBulkUnblockCol(colId)` — L7817/L7839 —
  versões em massa do mesmo par; `_doBulkBlockCol()` ganhou o mesmo
  guard de existência da coluna
- `delColumn(i)` — L24339 — editor de colunas em ⚙ Configurações. Coluna
  fixa `id==='blocker'` ("Impedimentos") só bloqueia a exclusão enquanto
  ainda tem cards nela (2026-09-10, antes era bloqueio incondicional —
  relaxado depois que `saveBlockerMode()`/`_doBulkBlockCol()`/`ctxMove()`
  passaram a recusar independentemente qualquer caminho que recriaria o
  card órfão que motivou o bloqueio original).
  Bloqueia incondicionalmente excluir a coluna com id `blocker` (não só
  quando `blockerMode==='col'` — cards antigos podem carregar esse id
  independente do modo atual da squad; excluir a coluna em modo `tag` e
  só voltar pra `col` depois já causou o incidente uma 2ª vez)
- Ação de Automação "Mover card para coluna" (`AUTO_ACTIONS`, ver seção
  Automações acima) tem o mesmo guard de existência de coluna
- `_meuDiaIsBlocked(card)` — L22150 (dentro da seção "Meu Dia", ver
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
  **2026-09-07**: `togglePauseCard(cardId)` ganha `cardId` opcional
  (mesmo padrão de `togglePinCard()`) — sem ele cai no `editingId` como
  sempre; passado direto, funciona com o card fechado, usado pelo novo
  item "⏸ Pausar"/"▶ Retomar" do menu de contexto (`showCtxMenu()`, ver
  seção própria), ao lado de "🚧 Marcar como impedido". `_renderPauseBtn()`
  só mexe no botão do modal se o card afetado for o mesmo aberto nele.
- Modelo de dado: `card.paused` (bool) + `card.pausedAt` (ISO, pausa
  ATUAL em andamento) + `card.pausedMs` (acumulado de pausas já
  encerradas). `_cardPausedMs(c)` soma os dois.
- `_cardTempos()` (relatório de tempo/cycle/lead, perto de L20390)
  subtrai `_cardPausedMs(c)` do tempo decorrido (lead E cycle), com
  clamp em 0. Réplica deliberada em `functions/agente-agil-orquestrador/
  tools/visaoBoard.js` (`cardPausedMs()`/`cardTempos()`) — mesma
  duplicação já documentada nesse arquivo (kanban.html sem `<script
  src>` externo, Cloud Function CommonJS) — sem essa réplica, `visao_
  board` (usado pelo orquestrador e por `analisePO.js`) ficaria
  divergente do relatório client-side pra um card pausado.
- `_cardDataCriacaoStr()` — L20155, logo acima de `_cardTempos()` — data
  de criação (YYYY-MM-DD) com fallback pra `card.flow.log[0].at` quando
  `card.createdAt` falta (dado legado). Usada por `_cardColunaEmDia()`
  (CFD, L21236) e pelo filtro de escopo de `_renderBurndown()`
  (L19719) — achado `/monitorarbugs` 2026-09-04: os dois liam
  `card.createdAt` puro e descartavam pra sempre um card sem o campo,
  em vez de cair no mesmo fallback que `_cardTempos()` já tinha.
- Visibilidade do botão: escondido em `openNewCard()` (pausar só faz
  sentido pra card já existente, com cycle/lead já em andamento).

### ⏱️ Tempo em atraso/bloqueado (arquivado — 2026-09-06)
Pedido direto do usuário: "esse espaço de tempo que ficou atrasado
precisa ser contado e arquivado, assim como os bloqueados". Diferente
de "Bloqueios"/"Prazo vencido" em Dados do Board (contagens AO VIVO, só
o agora), isto acumula quanto tempo cada card já passou nesses estados,
sobrevivendo à conclusão — mesmo espírito de `card.pausedMs` (seção
acima), mas 100% automático (nenhum clique dispara, só o estado
derivado do card mudando).
- `_cardIsOverdue(card)`/`_cardIsBlocked(card)` — perto de L32071/L32044
  — fonte única de verdade pros 2 estados (o 2º já existia antes desta
  rodada). `_cardIsOverdue` usa o mesmo critério de "Prazo vencido"
  (`due` no passado — due=hoje NÃO conta —, card ativo, não numa coluna
  de conclusão via `_isColDone()`).
- Modelo: `card.blockedMs`/`card.blockedAt` (mesmo par `pausedMs`/
  `pausedAt`) + `card.atrasadoMs`/`card.atrasadoDesde` (guarda a DATA de
  início, não a hora — `due` já é conhecido de antemão). Múltiplos
  episódios se somam — SEMPRE via `Number(x)||0` (2026-09-17, achado
  severo: relato direto do usuário, card mostrando "666202d 11h" de
  atraso acumulado — `(x||0)+número` faz CONCATENAÇÃO de string em JS
  se `x` já estiver salvo como string, não soma; confirmado o mecanismo
  exato via diagnóstico dos dados crus do card. Blindado nos 6 pontos
  de escrita E nas 3 funções de leitura abaixo). `_duplicarCardObj()`
  (L15519, "🧬 Duplicar card") também passou a RESETAR esses 5 campos +
  `flow`/`_lastFlowCol` pra uma cópia nova (mesmo motivo de
  `childCardIds`/`pinned`, já resetados ali) — antes herdava tempo
  acumulado (e `flow.enteredAt` desalinhado de `createdAt`) do card
  original.
- `_settleBlockedTag(card, wasBlocked)` — L32086 — fecha/abre o
  episódio em modo TAG, chamado nos pontos que já fazem esse toggle de
  propósito: `_doBulkBlockTag()`/`_doBulkUnblockTag()` (L7839/7856),
  `scheduleAutoSave()` (par `_prevBlocker`) e `saveCard()` manual
  (`_prevBlockerSave`).
- `recordMove()` (L8466, ver comentário grande no topo da função sobre
  `from` ser mais confiável que reler `card.col`) — trata modo COLUNA
  (transição pra/de `'blocker'`) E fecha atrasado quando o destino é
  coluna de conclusão, usando `due`/`from`/`toCol` que a função já
  resolve — é o ÚNICO ponto que fecha essas transições de forma robusta
  mesmo numa tacada só (card arrastado direto de Impedimentos/atrasado
  pra Concluído, sem nenhum save intermediário — settle preguiçoso
  sozinho perderia esse período, ver comentário em
  `_settleCardTimeTrackingLazy()`). `isNewFlow = !card.flow` (dentro
  dela) é o mecanismo que `_duplicarCardObj()` reaproveita ao apagar
  `novo.flow` — inicializa um flow de verdade do zero, mesmo caminho de
  um card genuinamente novo.
- `_settleCardTimeTrackingLazy(card)` — L32118 — rede de segurança
  genérica, chamada em `fbSaveCard()` e no loop por card de
  `fbSaveAll()` (só nos `touchedIds`). Idempotente.
- `_cardBlockedMs(c)`/`_cardAtrasadoMs(c)`/`_cardPausedMs(c)` — L31834/
  31842/15529 — total "efetivo até agora" (fechado + episódio aberto).
- `_renderCardTimeInfo(c)` — L32233 — mostra o total no modal do card
  (`#m-atraso-info` perto do campo Prazo, `#m-blocked-info` dentro do
  bloco de Impedimento), chamado no `openCard()` (L14794).
- Dashboards: `renderBoardDataInsights()` (L20642, seção "Tempo em
  atraso/bloqueado") e `renderCriativosDashboard()` (L17572, mesma
  seção) — os 2 já incluem cards CONCLUÍDOS (não filtram só ativos, ao
  contrário do resto dessas telas), de propósito — é o ponto principal
  do pedido ("mesmo que depois ele seja concluído"). `renderCriativosDashboard()`
  ganhou 2 blocos novos (2026-09-17, pedido direto do usuário): ⏱️ Tempo
  médio de produção por canal/plataforma/formato (`avgTempoBy()` — L17481,
  reusa `_cardTempos()`, só pedidos concluídos entram na média —
  `_crvBarRowTime()` — L17477 — desenha a barra) e motivo do bloqueio
  (`card.blockerReason`) na lista "Mais tempo bloqueado" (`crvBlockRow()`
  — L17439, silencioso quando não preenchido). **`card.lastBlockerReason`**
  (`/monitorarbugs` 2026-09-17): em modo TAG, `blockerReason` é zerado
  assim que o card é desbloqueado (`_doBulkUnblockTag()` L8099,
  auto-unblock em `recordMove()`, `removeBlockerTag()` L33237) — sem
  guardar em outro lugar, todo card já resolvido perdia o motivo no
  dashboard, mesmo preenchido. Cada um dos 3 pontos copia o texto pra
  `lastBlockerReason` antes de limpar `blockerReason`; `crvBlockRow()` lê
  `blockerReason||lastBlockerReason`. Só o Controle de Criativos mostra
  esse motivo — `renderBoardDataInsights()` usa um `cardRow()` genérico
  sem esse detalhe.
  Em modo COLUNA não precisa (nada limpa `blockerReason` lá, ver
  comentário em `saveCard()` ~L15305). `_duplicarCardObj()` (~L15753)
  também apaga `lastBlockerReason` da cópia, mesmo motivo de
  `atrasadoMs`/`blockedMs`/`pausedMs`.
- **Limitação conhecida, documentada no código** (`_settleCardTimeTrackingLazy`):
  card atrasado sem NENHUM save no meio até o prazo ser adiado direto
  pro futuro (sem completar) perde esse período — `due` antigo já foi
  sobrescrito, sem `_prevDue` explícito pra recuperar.
- **Gap arquitetural conhecido, não implementado**: o orquestrador do
  Agente Ágil (`functions/agente-agil-orquestrador/tools/
  moverColuna.js`) escreve direto no Firebase via Admin SDK, sem passar
  por `recordMove()`/`fbSaveCard()` — se ele mover um card pra/de
  Impedimentos, essa transição específica ainda não é rastreada. Mesma
  classe de gap já documentada pra Automações vs. orquestrador (ver
  seção "Agente Ágil (client-side...)" mais abaixo, fila
  `agente_pending_auto`) — reportado, não implementado nesta rodada.

### Padrões de card (cardPatterns) — never indexado antes desta rodada
Presets de campos/seções (`config/cardPatterns`, editor em ⚙ Configurações)
aplicáveis a um card via `setCardPattern()`; 3 bugs reais achados aqui em
dias recentes (#589/#590/#600/#605, todos `/monitorarbugs`), sempre a
mesma classe de problema — um dos 5-6 pontos que mexem no padrão ficando
pra trás de um comportamento que os outros já tinham.
- `criarPadraoCard()`/`renomearPadraoCard(id)`/`definirPadraoDefault(id)`/
  `excluirPadraoCard(id)` — L24694/L24705/L24715/L24724 — as 4 gravam
  direto em `config/cardPatterns` (`fbSet`), sem tocar um card já aberto
  na hora (dependiam só do round-trip do listener até o fix abaixo)
- `togglePadraoSecao(id, key, visible)` — L25012 — única das 5 que já
  atualizava o card aberto na hora, via `_applyCardSectionsVisibility()`
- `setCardPattern(patId)` — L25037 — aplica o padrão ao card (chamado na
  criação E na edição)
- `_refreshOpenCardPattern()` — L24967 (achado 2026-08-30, PR #605) —
  helper que replica o par `populateCardPatternSelect()` +
  `_applyCardSectionsVisibility()` que o `fbListen` de `config/
  cardPatterns` já fazia; chamado agora pelas 4 funções do 1º bullet, pra
  fechar a mesma janela de inconsistência visual que só `togglePadraoSecao`
  corrigia (alcançável de verdade: `mnavGo('cfg')` no nav mobile abre
  Configurações sem fechar um card já aberto)
- `_applyCardSectionsVisibility()` — L7164 / `populateCardPatternSelect()`
  — L21778
- `setCardCover(colorId)` — L7054 (achado 2026-08-29, PR #600): branch de
  card NOVO (`!editingId`) não disparava `runAutoRules('cover_set', ...)`
  — só o branch de card existente chamava; mesma classe de bug em
  `setCardPattern()`/`saveCard()` (branch de criação) pra `padrao_set`/
  `tag_added`/`submarca_set` — trigger de Automação dispara certinho numa
  EDIÇÃO do campo, mas não disparava quando o card já nascia com o campo
  preenchido no 1º Salvar. Fix: as 3 chamadas de `runAutoRules()`
  correspondentes adicionadas no branch de criação de `saveCard()`.

### Agente Ágil (client-side — atalhos que postam @menção real)
- `AGENTE_AGIL_MENTION_SQUADS` — L7245 — squads onde os atalhos abaixo
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
  `_stopAgenteAgilThinking()` — L7350/L7371 — estado efêmero client-side
  (`window._agenteAgilThinking`, não persistido) enquanto uma @menção real
  aguarda resposta; abre um listener TEMPORÁRIO em `card_comments`
  (mesma técnica de `_attachAgenteHotlineCommentsListener`, sem duplicar
  pro card hotline) que se auto-encerra ao ver um comentário
  `uid==='agente-agil'`, ou por timeout de 120s. `_updateAgenteThinkingBanner()`
  — L6955 — atualiza o banner `#m-agente-thinking` no modal;
  `_textMencionaAgenteAgil()` — L7388 — detecta @menção real (mesmo
  critério do backend) num comentário digitado à mão em `submitComment()`
  (chamada síncrona de `_dispatchAgenteAgilComment()` não precisa dessa
  detecção — todo call site dela já posta `@Agente Ágil` literal). Chip
  correspondente em `makeCardEl()` (board) e banner dentro do modal.
- `insightsCard()` — L18369 — botão "🤖 Insights" no rodapé do card
- `ctxInsights()` — L32829 — opção "Insights" no menu de contexto do card
- `_pedirResumoMeuDia()` — L22276 — botão "🤖 Resumo do Agente Ágil"
  dentro do painel "🌅 Meu Dia" (`openMeuDia()` L19522/`renderMeuDia()`
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
- `renderAgenteLog()` — L24157 — aba "🤖 Histórico do Agente" em
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
  simples, cada item passando por `renderMd()` desde 2026-09-17 (achado
  real: `esc()` puro mostrava `**negrito**` literal quando o agente
  formatava uma ação). Aba só aparece pra squads com escrita real do orquestrador
  (`AGENTE_AGIL_MENTION_SQUADS`, gate em `openCfg()` — L24095);
  Configurações inteiro já é PO/Organizador/ADM-only (`#fab-cfg-btn`, ver
  `_applyRoleVisibility()`), não precisa de
  gate de papel próprio aqui.

### Externos / segurança
- `_extKey()` — L35619 — chave de e-mail sanitizada (`.` → `,`)
- `salvarExterno()` — L35620
- Whitelist `externos` (por squad) checada no listener `auth-change` —
  L10744 (`ext_ok_{email}`, cache local). TTL 15min (reduzido de 24h em
  2026-09-21, `/monitorarbugs` "cancelar acesso de usuários excluídos":
  com 24h, remover alguém não tinha efeito prático por até 1 dia inteiro
  pra quem já tivesse o cache válido — pior ainda com `deleteGlobalUser()`,
  que RECRIAVA o cadastro do zero via `autoRegistrar()`). Mesmo achado
  corrigido em `painel_viewers` (`painel-dev.html`, ver seção própria) e
  em `okr-apresentacao.slide.html`.

### Intake (pedidos pendentes — formulário público E `criar_card` do Agente Ágil)
- `renderIntakeBody()` — L22479 — lista de `intakePendentes`
  (`_intakeBucket`, alimentado por listeners granulares em
  `intake_pending`, ver comentário na declaração). 2026-08-27: mostra
  `🤖` no título + linha "🏷 Submarca sugerida" quando o item veio do
  `criar_card` do Agente Ágil (campos `origem`/`submarca`, ver
  `functions/agente-agil-orquestrador/tools/criarCard.js`) — antes
  desses campos existirem, a tela só sabia renderizar pedidos do
  formulário público.
- `_intakeCriarCard(id)` — L22497 — abre o modal de novo card pré-
  preenchido; casa `squadDemandante` E (2026-08-27) `submarca` contra
  tags reais por label (case/acento-insensitive, `_norm()`), pré-
  marcando a tag — mesmo cuidado do bugfix de "usar modelo" (saveCard()
  valida submarca lendo o VALOR do `<select id="m-submarca">`, não
  `editingTags`, então os dois precisam ser setados).
- **2026-09-15, pedido direto**: cada pedido pendente ganhou 2 ações
  novas além de Criar card/Descartar — `_intakeItemHtml()` (L22460,
  template compartilhado entre as 2 abas) monta os botões (4 na aba
  Pendentes, 3 na aba Guardados — sem "Guardar" de novo):
  - `_intakeGuardar(id)` — L22599 — não resolve o pedido, só tira da
    fila de "pendentes" (`status:'pending'`→`'saved'`) e joga numa 2ª
    aba dentro do próprio Intake (`_intakeSwitchTab()`, L22450,
    `renderIntakeGuardadosBody()`, L22488) — sem prazo, pra decidir
    depois. De lá, Criar card/Vincular/Descartar continuam disponíveis.
  - `_intakeToggleLink()`/`_intakeSearchLink()`/`_intakePickLinkCard()`/
    `_intakeConfirmLink(id,mode)` — L22664/21716 — "🔗 Vincular a card":
    busca um card JÁ EXISTENTE (mesmo padrão de busca/dropdown de
    `searchLinkedCards()`) e vira **comentário** (escreve direto em
    `card_comments/`, mesmo formato de `submitComment()` — inclui o
    título do pedido desde o fix de 2026-09-15, achado pelo próprio
    teste de console entregue) ou **item de checklist**
    (`card.checklist.push()` + `fbSaveCard()`, mesmo padrão da ação
    `set_cover`/checklist de Automação) no card escolhido — pra
    demandas que não precisam de card próprio, só integrar uma já
    existente. `status:'pending'|'saved'`→`'linked'`.

### Backup
- `exportBackupJSON()` — L35721
- `maybeSnapshot()` — L13457
- `_applyRestorePayload(payload)` — L36246 — "🧯 Restaurar backup". Achado
  real 2026-08-28 (squad midiacriativa, `/monitorarbugs`): era a ÚNICA
  atribuição de `cards`/`columns`/`tags` a partir de dado externo no
  arquivo sem `.filter(Boolean)` (as 6 outras, todas `fbListen`/`fbGet` de
  `/columns`, filtram) — um backup com entrada nula em `columns` (ex.: o
  `weeklyBackup.js` abaixo, que lia o node cru via Admin SDK) propagava a
  sujeira pro estado ao vivo, travando `renderNormal()`/`renderColEditor()`
  (`col.name`/`col.id` de undefined). Agora normaliza igual ao client
  (`Array.isArray?:Object.values`, depois `filter(Boolean)`)

### Links / Modelos-Recorrentes-Agendamentos (`qlItems`) — escrita concorrente
- `addLink()`/`delLink()` — L23994+ ("🔗 Links", squad) e
  `addQLItem()`/`delQLItem()` — L23522/L23828 (Modelos/Recorrentes/
  Agendamentos, `qlItems[tipo]`) — **achado real (/monitorarbugs
  2026-09-22)**: os 2 arrays são sincronizados ao vivo (`fbListen`), mas
  adicionar/remover reescrevia o array local INTEIRO de volta
  (`fbSet`) — mesma classe já corrigida em Kudos (2026-09-14)/Lembretes/
  Dashboard consolidado (2026-09-17), só que aqui com listener em tempo
  real em vez de poll (janela de corrida bem mais estreita, mas real).
  Fix: `window._runTransaction()`, mesmo padrão de `addKudos()`.
  **Achado incidental reportado, NÃO corrigido**: os outros 6 pontos que
  mutam um item ESPECÍFICO de `qlItems` por índice local
  (`salvarAgendamento()` L23476, `saveReqFields()` L23512,
  `salvarRecorrencia()` L23881/L23895, e os 2 de criação automática
  diária de card recorrente/agendado L23651/L23732) têm o MESMO risco de
  corrida, mas `qlItems` não tem `id` próprio por item — corrigir direito
  exigiria localizar "o mesmo item" no valor fresco da transaction sem um
  identificador estável, ou adicionar um `id` a cada item (mudança de
  modelo de dado, não só do ponto de escrita) — fora do escopo de um fix
  pontual, reportado como recomendação.

### Marcadores `// --- X ---` já existentes no código
Só existem para um subconjunto pequeno de áreas — não é uma convenção
aplicada no arquivo inteiro, não confie neles como única forma de navegar:
- L23944 Ágil, L24039 Col editor, L24112 Usuários, L24436 Tags,
  L24835 "Worker / Firebase" (nome do comentário é antigo — hoje é
  config/legado de Firebase, **não** tem relação com o Cloudflare Worker,
  que não existe mais na arquitetura atual)
- L30234 D&D das colunas, L30303 D&D dos cards

## painel.html (prod — painel-dev.html diverge, confira com `diff` antes de assumir paridade)

### Papel de usuário (2 mecanismos — `squads_roles` é o correto/atual)
`kanban/usuarios/{uid}/role` é o campo GLOBAL legado; `squads_roles/
{squadId}` é o papel POR SQUAD, mecanismo mais novo e o que de fato tem
prioridade — `kanban-dev.html` resolve `window._currentUserRole` sempre
como `squads_roles[ACTIVE_SQUAD] || role || 'membro'` (~8 call sites,
`getEffectiveRole()` — L6519). Em `painel(-dev).html`,
`updateSquadUserRole()` — L10398 (modal "👥 Global Users",
`openGlobalUsersModal()` — L10223) já grava certo em
`squads_roles/{squadId}`. `updateUserRole()` — L9718 / `loadPcfgUsers()`
— L9673 (aba "👥 Usuários" do modal de Config do squad, `cfg-ov`) gravava
no campo global até corrigido em 2026-09-21 (`/monitorarbugs` — mostrava
o papel errado e podia ser um no-op silencioso se já existisse override
por squad) — agora também usa `squads_roles/{cfgSquadId}`. Lista de
papéis diverge entre os 2 mecanismos por decisão pré-existente, não bug:
`ROLES` (aba Usuários) tem `['adm','po','organizador','membro',
'convidado']`; `SQUAD_ROLES` (modal Global) tem só `['membro',
'organizador','po']`.
- **`addAdmEmail()`** — L9037 / **`removeAdmEmail(email)`** — L9055 (aba
  "🔑 ADMs" do mesmo modal — mecanismo SEPARADO dos dois acima, controla
  `ADM_EMAILS`/`kanban/config/adm_emails`, que `isAdmUser()` prioriza
  antes até de `squads_roles`). Achado real 2026-09-21
  (`/monitorarbugs`, "login e segurança", técnica 1 — comparar par
  add/remove): `addAdmEmail()` sincroniza
  `kanban/usuarios/{uid}/role='adm'` ao promover, mas `removeAdmEmail()`
  nunca desfazia isso — só limpava `ADM_EMAILS`. Como `getEffectiveRole()`
  cai pro campo `role` legado assim que `isAdmUser()` vira `false`, um
  ADM "removido" continuava com papel `adm` efetivo no board via esse
  resquício. Fix: `removeAdmEmail()` ganhou o mesmo lookup por e-mail que
  `addAdmEmail()` já usa, rebaixa `role` pra `'membro'` se ainda `'adm'`.

### 👥 Online no board × 🖥️ Online no painel (aba Visão) — 2 presenças distintas, nunca indexadas antes
`loadPresence()`/`renderOnline()` (existe desde a origem do painel, nunca
tinha ganhado seção própria neste mapa): LÊ (não escreve) a presença do
BOARD — `kanban/squads/{sqId}/presence`, o mesmo node que
`kanban(-dev).html` escreve via heartbeat (`setInterval` 15s, pausa em
aba oculta) — um listener `onValue` por squad (`_presenceListenedSquads`,
Set idempotente, porque `loadExtraSquads()` pode chamar de novo quando um
squad novo aparece em `SQUADS`), filtro local de 30s de timeout, pills em
`#online-list`/`#online-count`, título "👥 Online no board".
- **🖥️ Online no painel** (2026-09-30, pedido direto: "mostrar ali no
  visão tb as pessoas q tao online no painel"): node PRÓPRIO
  `kanban/painel/presence/{uid}` — painel.html NUNCA tinha escrito a
  própria presença antes disso, só lido a do board. Mesma técnica de
  heartbeat que o board já usa, portada: `_painelSendHeartbeat()`
  (`{ts,nome,foto}`, sem `init` de propósito — `window._currentUserInit`
  é outro campo nunca atribuído em painel-dev.html, mesma classe de
  achado que `window._currentUserRole`/`_isPOorOrg()`, ver seção OKR —
  não vale a pena depender dele aqui) + `_painelPresenceStart()`
  (`setInterval` 15s, chamado de `_finishPainelLogin()`, pula se
  `window._isPainelViewer`) → `loadPainelPresence()`/
  `renderPainelOnline()` (mesmo filtro de 30s local, pills em
  `#painel-online-list`/`#painel-online-count`, título "🖥️ Online no
  painel"). **Separado de propósito do board** — alguém pode estar nos
  dois ao mesmo tempo, em abas diferentes, apps distintos; juntar numa
  lista só criaria duplicata/confusão. Sem `onDisconnect()`, mesmo
  motivo do board (timeout de 30s já cobre quem fechou sem avisar). Sem
  mudança em `database.rules.json` — `kanban/painel` já tem `.write`
  liberado pra qualquer `@ciahering.com.br`, cobre o node novo.

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
- `markAllPainelNotifsRead()`/`clearReadPainelNotifs()` — usam
  `window._runTransaction()` sobre o node inteiro (achado real,
  `/monitorarbugs` 2026-09-22, mesma classe já corrigida em Kudos/
  Lembretes/Dashboard consolidado do painel): antes faziam `get()` do
  node inteiro + mutação local + `set()` de volta — notificação nova
  chegando nessa janela (menção, prazo, push de outra aba) era
  descartada em silêncio. `runTransaction` precisou ser importado do
  SDK e exposto em `window._runTransaction` pela 1ª vez em
  `painel-dev.html` (já existia em `kanban-dev.html` desde 2026-09-14).

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
  de squad, reseta sozinho (~L11363 de `renderPainelTimeline()`).
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
  **Achado real (2026-09-07, `/monitorarbugs`, técnica 2 — comparar
  contra o mesmo padrão já aplicado em `renderPainelTimeline()`, cujo
  próprio comentário cita "o Feed de marcos do kanban.html" como
  precedente)**: trocar o squad DESTE filtro (`ptFeedSetFilter('squad',
  ...)` — não confundir com o squad da Timeline principal) deixava
  `f.owner`/`f.tagLabel` presos num valor da squad anterior —
  `_ptFeedMatchesBase()` continuava comparando contra esse valor morto,
  zerando a lista inteira pra squad nova, com o `<select>` mostrando
  "Todos os responsáveis" (a option antiga já nem existe mais na lista
  recalculada) — nenhuma pista visual de que um filtro ainda estava
  ativo. `renderPainelTimeline()` já tinha essa proteção (reseta
  `_painelTimelineFilter.owner/tagLabel` se a opção some ao trocar de
  squad/gerência) e o Feed já tinha a mesma cautela pra troca de
  PERÍODO — só faltava pra troca de squad. Fix: mesmo check de 2 linhas
  (`ownerOpts.some()`/`tagOpts.includes()`) adicionado em
  `_renderPtFeed()`, ANTES de `paraContagem` (senão os chips de
  contagem também ficariam presos ao valor morto).
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

> ⚠️ **2026-10-07 (painel-dev v5.0):** todo o código desta seção (e das sub-seções `####` abaixo até "`guia-okr.html`") **saiu do `painel-dev.html`** e vive em **`okr-dev.html`/`okr.html`** com os MESMOS nomes de função/const — re-`grep` o nome lá (as linhas aqui são de antes da mudança). No painel sobraram só: `renderOKR()` (lista "🎯 Cards do board com badge OKR", agora na aba Visão — lê `squadData`), `toggleGestorOkr()` (toggle no 👥 Global Users), `OKR_PAGE` + `swPtab('okr')` (redireciona pra `okr-dev.html`) + o `<a id="ptab-okr">` da barra de abas + um `<script>` no `<head>` que repassa `?okr=<id>`/`?okr=chat`/`?tab=okr` pra página nova. Prod (`painel.html`) ganha isso na promoção.

### Aba "🎯 OKR" (Objetivos/Marcos, Fase 1 — 2026-09-04, presente nos dois arquivos — promovido pra prod v3.18)
> ⚠️ **Histórico (desde painel-dev v5.0, 2026-10-07):** o código desta aba SAIU do painel — `ptab-okr` virou atalho pra `okr-dev.html` e todas as âncoras `_okr*`/`OKR_*` abaixo vivem agora em `okr-dev.html` (mesmos nomes; **re-`grep` lá**, ver a seção "🎯 `okr-dev.html`" mais abaixo). O que ficou no painel: `renderOKR()` (lista dos CARDS do board com badge OKR), `loadOkrPresence()`/`renderOkrOnline()` (🎯 Online no OKR), o atalho `OKR_PAGE` e o 👁 Visualizadores. Os números de linha desta seção são do painel ANTIGO.
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
- Permissão: `_okrCanEdit(obj)`/`_okrCanCreate()` — responsável(is) do
  objetivo + ADM + PO/organizador (de QUALQUER squad) + **"🎯 Gestor
  OKR"** (2026-09-30 — flag `u.gestorOkr:true` em `kanban/usuarios/{uid}`,
  liga/desliga em "👥 Global Users" `renderGlobalUsers()`/
  `toggleGestorOkr()`, `_isGestorOkr(uid)` — check client-side
  (mesmo padrão de gating de UI do resto do app, sem ACL granular no
  Realtime Database). Ampliado de "só responsável(is) + ADM" em
  2026-09-29 (pedido direto — "sumiu o botão de adicionar OKR", usuário
  decidiu incluir PO). `_isPOouOrgEmAlgumSquad(uid)` — achado real na
  mesma rodada: `window._currentUserRole`/`_isPOorOrg()` (mais abaixo no
  arquivo) NUNCA são atribuídos em `painel-dev.html` — só LIDOS, sempre
  `undefined`/`false` — diferente de `kanban-dev.html`, onde a mesma
  variável é preenchida de verdade no login. Usar esse padrão aqui
  reproduziria o mesmo bug; o fix lê o papel direto de
  `_globalUsersCache` (já ao vivo, mesma fonte do picker de pessoas
  logo abaixo), checando `squads_roles`/`role` de QUALQUER squad —
  mesmo padrão que o resto do arquivo já usa pra ler o papel de
  QUALQUER OUTRA pessoa. **`_isPOorOrg()`/`window._currentUserRole`
  continuam quebrados pros outros usos** (Campanhas editar/excluir/ver
  logs, L3476/3491/3497/4089/4158/4342/4353) — reportado ao usuário,
  não corrigido nesta rodada (fora do escopo do pedido, mudança maior:
  precisa decidir de onde vem "o papel da pessoa" quando ela tem papéis
  DIFERENTES em squads diferentes, e Campanhas É amarrado a squad,
  diferente de OKR).
- **Filtros da tela "🗂 Usuários cadastrados"** (2026-10-02, pedido direto:
  "opções de filtros, principalmente de ser Hering ou Arezzo") — `_guFilter`
  ({empresa,role,squad,gestorOkr}) + `_guEmpresa(u)` (domínio do e-mail →
  `hering`/`arezzo`/`externo`), `_guTemPapel()`, `_guNoSquad()`,
  `_guSetFilter()`/`_guClearFilters()`/`_guFiltersHtml()` (logo antes de
  `renderGlobalUsers()`); a barra mora em `#gu-filters`, abaixo de
  `#gu-search`. Chips de empresa reusam `.okr-stat-chip`; a contagem por empresa
  é calculada ANTES do filtro de empresa.
- **"🎯 Gestor OKR"** (2026-09-30, pedido direto — "tem gente que n vai
  ser PO/ADM e vai mexer em OKR"): flag PROPOSITALMENTE separada de
  `role`/`squads_roles` (`u.gestorOkr:true`), não um 6º valor de
  `GLOBAL_ROLES`/`SQUAD_ROLES` — esses campos são lidos por telas fora do
  OKR que não deveriam saber que "Gestor OKR" existe (badge de papel no
  board do kanban, `_isPOorOrg()` de Campanhas); misturar vazaria esse
  comportamento pra lá. Quem liga o toggle continua "Membro" (ou o que já
  for) em tudo mais, só ganha `_okrCanEdit()`/`_okrCanCreate()` a mais.
  Toggle na tela "👥 Global Users" (`renderGlobalUsers()`, chip solto no
  mesmo wrap dos squads), `toggleGestorOkr(uid,checked)` grava só em
  `kanban/usuarios/{uid}` — de propósito NÃO espelha em
  `usuarios_publicos` (mesma técnica de `toggleUserSquad()` acima, mas
  aqui não precisa: só o OKR em `painel-dev.html` lê esse campo).
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
- **`_okrTryCloseObjetivo()`/`_okrTryCloseMarco()`** (`/monitorarbugs`
  2026-09-22, confirmado com o usuário antes de implementar — decisão de
  produto, não bug óbvio): fechar os modais (✕/clique fora/"Cancelar")
  nunca avisava sobre alteração não salva, diferente do modal de card do
  kanban.html (`_cardIsDirty()`) — um misclique descartava tudo em
  silêncio, inclusive campos de texto longo (descrição, indicadores,
  riscos, planos de ação). `_okrObjOpenSnapshot`/`_okrMarcoOpenSnapshot`
  guardam `JSON.stringify(draft)` no momento de abrir; as 2 funções
  sincronizam o DOM pro draft (`_okrSyncObjDraftFromDom()`/
  `_okrSyncMarcoDraftFromDom()`) e comparam antes de fechar de verdade —
  só confirmam com `uiConfirm()` se algo mudou. `closeOkrObjetivo()`/
  `closeOkrMarco()` continuam chamadas DIRETO (sem passar por aqui) nos
  fluxos que já persistiram ou descartaram de propósito (salvar/
  arquivar/desarquivar/excluir) — só ✕/clique fora/"Cancelar" passam
  pelo dirty-check. Já promovido pra `painel.html` também (confirmado
  em dia neste retrato: 2026-09-30).

#### Edição inline, reordenar Objetivos (▲▼ e drag-and-drop), "aparecer na apresentação", 🎯 Gestor OKR (2026-09-30, painel-dev.html v3.71-v3.73 + okr-apresentacao.slide.html — promovido pra prod v3.73 no mesmo dia)
Lote de 4 pedidos numa mensagem só (feedback do chefe do usuário +
ideias próprias, ver `CHANGELOG.md` v3.71 · painel-dev pro racional):
- **Click-to-edit em listas/checklist** — `_okrListEditorHtml()`
  (indicadores/progressos/próximos passos/riscos/planos de ação) e
  `_okrChecklistHtml()` (checklist do Marco) eram só add/remove; ganharam
  clique-pra-editar no texto já escrito, mesmo padrão do `renderCL()` do
  checklist de card em `kanban-dev.html` (span vira `<textarea>`
  auto-ajustável, Enter/blur salva, Esc cancela) — simplificado (sem
  markdown/@menção, texto puro). `_okrListEditStart(span,campo,i)`/
  `_okrChecklistEditStart(span,i)`.
- **Reordenar Objetivos (▲/▼) dentro da Gerência** — mesma técnica de
  `_okrMarcoMover()`/`_okrMarcosSorted()` (ver acima), replicada pro
  nível Objetivo: `_okrObjetivosSorted(lista)`/`_okrObjMover(areaId,objId,dir)`,
  materializa `ordem` numérico em TODOS os objetivos da Gerência no 1º
  reordenar manual (antes disso, segue alfabético por título, como
  sempre foi). Botões só aparecem com `_okrCanCreate()` E nenhum filtro
  ativo (área/trimestre/status/texto) — com filtro, a lista mostrada não
  é o grupo completo da Gerência, então ▲/▼ ficariam com índice errado.
  `renderOkrObjetivos()`/`_okrObjCardHtml(o,areaId,i,total,podeReordenar)`.
  (2026-09-30) Ganhou também **drag-and-drop nativo** (pedido explícito
  do usuário logo depois de validar os botões) — convive com ▲/▼, mesmo
  gate de permissão/filtro. `_okrObjReorderTo(areaId,draggedId,targetId)`
  reinsere o card na posição exata do alvo (diferente de `_okrObjMover()`,
  que só troca 2 adjacentes) e materializa `ordem` igual. Handlers
  `_okrObjDragStart/Over/Enter/Leave/Drop/End` + `_okrDraggedObjId`
  (estado entre os eventos nativos `dragstart`/`drop`), CSS
  `.okr-dragging`/`.okr-drag-over`. **(2026-10-01) Mesmo drag-and-drop
  estendido pros Marcos** (pedido direto do usuário) — `_okrMarcoReorderTo
  (objId,draggedId,targetId)`/`_okrMarcoDragStart/Over/Enter/Leave/Drop/End`
  + `_okrMarcoDraggedId`, idêntico em estrutura ao par acima, só trocando
  Objetivo→Marco e `kanban/okr/objetivos`→`kanban/okr/marcos`; convive com
  os botões ▲/▼ (`_okrMarcoMover()`) já existentes. Reutiliza as MESMAS
  classes CSS `.okr-dragging`/`.okr-drag-over` (seletor próprio
  `.okr-marco-row[draggable]`/`.okr-marco-row.okr-dragging`/
  `.okr-marco-row.okr-drag-over`, mesmo padrão visual do `.okr-card`).
- **`mostrarApresentacao` por Marco** — booleano novo em
  `kanban/okr/marcos/{id}` (ausente/`true` = visível, só `false` explícito
  esconde — marcos antigos sem o campo continuam aparecendo). Checkbox "🎬
  Aparecer na apresentação" no form de edição do Marco
  (`renderOkrMarcoBody()`/`openOkrMarco()`/`saveOkrMarco()`/
  `_okrSyncMarcoDraftFromDom()`). Pensado pra OKRs contínuos com muitos
  marcos acumulados — deixa esconder os que não interessam mais na
  apresentação executiva sem arquivar/apagar.
- **`okr-apresentacao.slide.html`**: `objMarcos(objId)` (L598, único
  choke-point de leitura de marcos — status/%/tabela de detalhe passam
  todos por ela) agora filtra `mostrarApresentacao!==false`, então o
  campo acima já se propaga sozinho pra todo lugar que consome marcos.
  Botão novo "▴ Colapsar concluídos" no cabeçalho da tabela do modal de
  detalhe (`.d2-table-header`, só aparece se o Objetivo tiver pelo menos
  1 marco concluído) — `window._okrToggleColapsarConcluidos()`, estado
  em `_okrColapsarConcluidos` (dura a sessão, não é filtro permanente):
  só esconde a LINHA (`style="display:none"`), não mexe em
  `objMarcos()`/`objStatus()`/`objProgressoPct()` — a contagem de
  progresso continua contando os concluídos normalmente, só a visão que
  colapsa. `_okrDetailCurrentId` (novo, guarda o Objetivo do modal aberto
  — antes não existia, `window._okrOpenDetail(id)` recebia `id` sempre
  por parâmetro sem guardar em nenhum lugar) permite reabrir o mesmo
  Objetivo depois de togglar.
- **👁 Pré-visualizar por Objetivo + contador de caracteres recomendado**
  (2026-10-01, pedido direto: "um preview da apresentação do objetivo
  para cada objetivo... a gente precisa tambem calcular quantos
  caracteres sao maximo para n quebrar a leitura") —
  `_okrPreviewApresentacao(id)` (`painel-dev.html`, perto de
  `_okrObjCardHtml()`) abre `okr-apresentacao.slide.html?preview=<id>`
  numa aba nova; do lado de lá, `_previewObjId` (lido de
  `new URLSearchParams(location.search)`) é consumido UMA VEZ dentro de
  `rebuild()`, chamando `window._okrOpenDetail(id)` assim que os 4
  listeners (`_loaded`) terminam o 1º carregamento — não reabre a cada
  atualização ao vivo do Firebase depois disso. `OKR_CHAR_LIMITS`
  (`painel-dev.html`) + `_okrCharCounterHtml(fieldId)`/
  `_okrUpdateCharCounter(fieldId,limite)` — soft cap NÃO bloqueante por
  campo (descrição do Objetivo ~200 car., item de lista ~90 car., nome
  do Marco ~70 car., descrição do Marco ~110 car.), calculado a partir
  da largura real dos containers em `okr-apresentacao.slide.html`
  (~0.52× font-size por caractere) — contador vive em `#okr-f-descricao`/
  `#okr-m-nome`/`#okr-m-descricao` (campos fixos) e no `okr-add-${campo}`/
  textarea de edição inline de `_okrListEditStart()` (itens de lista).
- **Auditoria de UI/UX da aba OKR** (2026-10-01, pedido direto: "faça
  uma analise de UI/UX e melhore a aba de okr do painel!") — 4 achados
  corrigidos (ver `CHANGELOG.md` v3.85 · painel-dev pro racional
  completo de cada um): (1) os 8 botões do cabeçalho da aba agora vivem
  em 3 grupos visuais (referência/ajuda · troca de visão · CTA
  "+ Novo Objetivo", este último como único botão preenchido `.btn-p`),
  separados por `<span>` de 1px (divisor); (2) `flex-wrap` adicionado
  nos grupos de botões (bug real de mobile: a linha inteira cortava os
  últimos botões pra fora da tela, sem scroll); (3) "📦 Ver arquivados"
  (`#okr-arquivados-btn`) movido do cabeçalho pra dentro do
  `.okr-toolbar` (é um filtro, não uma ação de página); (4) resumo
  agregado clicável — `_okrStatsStripHtml(lista)`/`#okr-stats-strip`,
  populado dentro de `renderOkrObjetivos()` — total de Objetivos + 1
  chip por status (clicável, reusa `_okrSetFilter('status',…)`) + % de
  marcos concluídos, calculado ANTES do filtro de status (senão o
  resumo sumiria ao clicar num chip); 📈 Atingimento (v3.100): motor PURO entre `/* ATING-ENGINE-BEGIN/END */` (`_okrAtingPctDe()`/`_okrAtingAtual()`/`_okrAtingPctObj()`/`_okrParseNum()`/`_okrFmtNum()`, 7 tipos em `OKR_ATING_TIPOS`; cópia mínima do cálculo em `okr-apresentacao.slide.html` — manter igual) + interface `_okrAtingSectionHtml()`/`_okrAtingAdd(quiet)`/`_okrAtingOnTipo()` + `_okrAtingCfgInput()` (edita meta/faixa atualizando % e histórico NO LUGAR via `_okrAtingHistWrapInner()` — não re-renderizar no blur, come o clique do botão seguinte; só `_okrAtingCfgChange()` da moeda redesenha) + `_okrDiffAtingimento()`; 📈 gráfico de evolução (v3.103, bloco `_okrAtingChartHtml()`/`_okrAtingTip()`/`_okrAtingChartPanelHtml()` — MESMO código em `okr-apresentacao.slide.html`, manter igual; abre por `openOkrAtingChart()` (painel, overlay `#okr-ating-chart-ov`) / `window._okrOpenAting()` (apresentação, `#ating-ov`); emoji do tipo = `ico` em `OKR_ATING_TIPOS`); tipo ♾️ `perene` (v3.104): `_okrAtingPctObj()` devolve `null` → barra pelos marcos; seção em `_okrAtingPereneHtml()`); `saveOkrObjetivo()` confirma valor digitado pendente e faz merge de 3 vias dos registros alheios (snapshot `_okrObjOpenSnapshot`); `_okrObjProgressoPct()` usa o atingimento quando configurado + 🏷️ cor da tag (v3.109): formulário `_okrTagFormOpen()`/`_okrTagFormSalvar()` (`#okr-tag-ov`), cor própria em `okrTags[id].cor` lida por `_okrTagCor()` (+ `_tagCor()` na apresentação), `colorIdx` mantido como fallback; 🏷️ tags nos cartões + filtro por tag (v3.108): `_okrCardTagsHtml()`/`_okrTagChipHtml(…,onClick,selecionada)`, `_okrFilter.tag` + `#okr-filter-tag` populado em `renderOkrObjetivos()` (só tags em uso; guarda de tag apagada); `_okrSecOpen()`/`OKR_SEC_TEMAS` (seções coloridas, classe `.okr-sec-*`, v3.97) + `_okrIrParaSecao()`/`_okrRenderObjNav()`/
  `_okrRenderMarcoNav()` (atalhos fixos `#okr-obj-nav`/`#okr-marco-nav` no cabeçalho dos modais; ids `okr-sec-obj-*`/`okr-sec-marco-*`) + `_okrFiltroPessoaUid()`/`_okrObjTemPessoa()` (filtro por pessoa,
  v3.96: responsável do Objetivo OU de marco ativo; `'__eu'` = logado) + `_okrTemFiltroAtivo()`/
  `_okrClearFilters()` — botão "✕ Limpar filtros" (só visível com algo
  filtrado) + mensagem de vazio diferenciada pra "filtro sem resultado"
  vs. "nenhum Objetivo ainda". Achado incidental corrigido junto:
  `.okr-progress-fill` (barra de progresso do card) sempre usava
  `--accent` fixo — agora usa `okrStatusInfo(status).dot`, a MESMA cor
  do dot de status, reforçando risco à distância num grid com dezenas
  de cards.
- **Auditoria de UI/UX DENTRO do modal de Objetivo/Marco** (2026-10-01,
  continuação direta: "agora dentro do modal do okr") — 3 achados (ver
  `CHANGELOG.md` v3.86 · painel-dev): (1) `_okrHistorySectionHtml(entity)`
  — Histórico (até `OKR_HIST_CAP`=80 entradas) parou de vir sempre 100%
  expandido no fim do modal; reusa `<details class="pt-bucket">`/
  `.pt-chevron` (mesmo componente da Timeline do painel,
  `_painelTimelineRender()`) — fechado por padrão com >5 entradas,
  aberto com poucas. Substituiu o par `<div class="okr-field-label">📜
  Histórico</div>`+`renderOkrHistory(d)` nos 4 lugares que o usavam
  (Objetivo/Marco × leitura/edição); (2) `_okrCardLinksHtml(podeEditar)`
  ganhou o MESMO padrão `<details>` — fechado quando a lista de cards
  vinculados está vazia (esconde também o campo de busca, que antes
  ficava sempre visível), aberto quando já tem algo vinculado; (3)
  `.okr-marco-row` (dentro de `_okrMarcosListHtml()`) ganhou
  `border-left:3px solid` na cor do status (mesma técnica que
  `.okr-hist-item` já usa pra tipo de evento) — o dot sozinho era a
  única pista de status na linha (inconsistente com o card da grid, que
  mostra dot+texto), mas o modal só tem 560px de largura pra
  nome+responsável+prazo+🎬, então texto full foi descartado em favor
  da borda colorida (não gasta largura).

- **Rascunho do Objetivo × escritas do Marco / texto pendente / seções
  recolhíveis (2026-10-01, `/monitorarbugs`, painel v3.87-v3.90)** —
  `_okrSyncObjDraftHistory(objId,hist)` (perto de `closeOkrConfigBack()`):
  `saveOkrMarco()`/`_okrArquivarMarco()` gravam um resumo no `history[]` do
  Objetivo pai, mas o Objetivo segue aberto com `_okrObjDraft` velho — sem
  isso o 💾 Salvar do Objetivo apagava a entrada do Marco; mantém rascunho e
  `_okrObjOpenSnapshot` em sincronia. `_okrReadPending()`/`_okrWritePending()`
  (`_OKR_OBJ_PENDING_IDS`/`_OKR_MARCO_PENDING_IDS`, antes de
  `_okrSyncObjDraftFromDom()`): texto digitado nas caixas "+ Add" é lido do
  DOM antes de `renderOkrObjBody()`/`renderOkrObjConfigBody()`/
  `renderOkrMarcoBody()` e devolvido depois; o corpo de cada modal é limpo em
  `openOkrObjetivo`/`closeOkrObjetivo`/`openOkrMarco`/`closeOkrMarco` pra não
  vazar texto entre Objetivos. `_okrDetailsState`/`_okrDetailsAttrs(chave,
  abertoPadrao)`: lembra aberto/fechado do Histórico/Cards vinculados entre
  re-renders do corpo.
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
  **Achado real (2026-09-06, `/monitorarbugs`, técnica 2 — comparar
  contra `getCardTags()`/`isOKR_` do kanban-dev.html, L11153/L11245,
  a fonte de verdade de "esse card tem badge 🎯 OKR no board")**: 4
  lugares em painel-dev.html detectavam "card é OKR" olhando só
  `card.tag` (campo legado, só a 1ª tag) — nunca `card.tags[]`
  inteiro. Um card com a tag OKR na 2ª/3ª posição mostrava o 🎯 no
  board (kanban usa `getCardTags()`, array completo) mas sumia dos 4
  lugares: `_okrCardSearchResults()` (busca pra vincular — o card nem
  aparecia pra ser linkado), `renderOKR()` (a própria lista "🎯 Cards
  do board com badge OKR" da aba), o agregador "OKR por coluna" dos
  Insights (subcontava), e o badge dentro de `openPcModal()` (modal
  aberto direto de "🔗 Cards vinculados" de um Objetivo — o card
  abria sem o badge 🎯, mesmo já vinculado). Mesma classe de bug do
  PR #770 (`_histDiff()` só rastreava `card.tag`, kanban-dev.html),
  desta vez espalhada em 4 call sites de outro arquivo, todos com a
  mesma lógica copiada. Fix: os 4 usam `_pGetCardTags(card)` (L3375,
  já existia, equivalente ao `getCardTags()` do kanban) pra checar
  TODAS as tags, não só a 1ª. 7 casos testados isoladamente contra a
  lógica de detecção, todos corretos. PR #779. Promovido pra prod
  (`painel.html`) no mesmo dia — patch aplicado cirurgicamente nos 4
  pontos equivalentes (`painel.html`/`painel-dev.html` divergem
  estruturalmente, não são cópia um do outro), não um copy do arquivo.
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
- **`shareOkrObjLink()`/`_okrObjShareUrl()`/`_copyToClipboard()` (2026-09-09)**
  — pedido direto: "cada okr ganhar um link compartilhado igual o
  card?". Botão 🔗 no cabeçalho de `#okr-obj-ov` (só visível pra
  Objetivo já existente, `openOkrObjetivo(id)` alterna
  `#okr-obj-share-btn`), reaproveita o `?okr=<id>` de
  `_okrTryOpenFromUrl()` acima — trabalho novo foi só o botão +
  `_copyToClipboard()` (helper novo no painel, portado igual de
  `kanban(-dev).html`, que já tinha `_cardShareUrl()`/`shareCardLink()`
  pro mesmo conceito em card). `_okrObjShareUrl()` detecta
  `painel-dev.html` no `location.pathname` e usa link direto pro dev
  nesse caso — `okr.html` (raiz do repo, ver abaixo) é fixo, sempre
  aponta pra `painel.html` (prod), não serve como atalho a partir do
  dev.
- **`okr.html` (prod, v1.0 · okr, 2026-10-06)** — era um redirect estático pra `painel.html?tab=okr` (2026-09-09); agora é a PÁGINA do OKR (promoção do `okr-dev.html`, ver a seção "🎯 `okr-dev.html`" abaixo — mesmas âncoras, `VERSION_KEY='okr'`, links pra `kanban.html`/`painel.html`). Links antigos `/okr?okr=<id>` continuam abrindo o Objetivo.
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
> ⚠ Desde 2026-10-07 (okr-dev v2.18) a aba aparece pro usuário como **📊 Dashboard** — os nomes internos (`renderOkrHistorico()`, `_okrHist*`, `okr-historico-btn`, `_okrToggleHistorico()`) continuam os mesmos.
Visualização de `kanban/okr/snapshots/{data}`, gravado toda sexta pela
Cloud Function `okrWeeklySnapshot` (ver seção `okr/` em Cloud
Functions). `okrSnapshots` (estado local, `loadOkrSnapshots()`),
`_okrShowHistorico`/`_okrToggleHistorico()` — mesmo padrão de
`_okrShowArquivados`, alterna a aba OKR inteira entre lista de
Objetivos e histórico (esconde `#okr-toolbar`/`#okr-objetivos-wrap`/
`#okr-section-title`/`#okr-list`, mostra `#okr-historico-wrap`).
**Redesenhado na v4.3 (2026-10-06)**: `renderOkrHistorico()` monta tudo dentro de `#okr-h-root` —
cabeçalho (último/próximo snapshot, `_okrHistSetRange()`: 4/8/12/tudo), 6 KPIs com variação vs. snapshot
anterior (`_okrHistKpisHtml()`, `_okrHistDeltaHtml()`), gráfico `renderOkrHistoricoChart()` (barras por
status + linha do progresso médio, dica `_okrHistTip()`/`_okrHistTipOff()`), "🔄 O que mudou"
(`_okrHistMudancas()`/`_okrHistMudancasRender()`, ranking `OKR_STATUS_RANK`), tabela "Por Objetivo"
(`_okrHistTabelaRender()`, filtros em `_okrHistFiltro`/`_okrHistFiltra()`, mini-tendência `_okrHistSpark()`) e
detalhe expansível `_okrHistoricoSelectObj(id)`/`_okrHistDetalheHtml()` (curva + quadro semana a semana, com os
campos `atingimento*` do snapshot). Só leitura — nenhum campo novo no snapshot.
**okr-dev v2.58 (2026-10-09) — Dashboard redesenhado**: `renderOkrHistorico()` agora monta aba/períodos (`_okrHistTabsHtml()`), `_okrHistHeroHtml()` (número grande + `_okrHistDeltaHtml()`), `_okrHistSituacaoHtml()`/`_okrHistSitFiltra()` (barra única + linhas clicáveis que filtram a tabela), e os gráficos medem a largura real em `renderOkrHistoricoChart()` → `_okrHistLineHtml()` (linha, desenho de `_okrAtingChartHtml`) + `_okrHistColsHtml()` (colunas por situação) sobre `_okrHistBuckets()`/`_okrHistTipTxt()`/`_okrHistXRotulos()`; tooltip é a do atingimento (`_okrAtingTip()`). Os 6 KPIs (`_okrHistKpisHtml`) e `_okrHistTip()` saíram. Detalhe do Objetivo: `_okrHistDetalheHtml()` + `_okrHistDetLineHtml()`/`_okrHistDetDesenha()`. Ordem padrão da tabela = 'pior'. Teste: `docs/arezzo/testes/test_okr_dashboard.js`.
**v4.5**: clique no KPI "Progresso médio" abre `#okr-hmedia-ov` (`_okrHistMediaOpen()`/`_okrHistMediaRender()`): contribuição
de cada Objetivo (progresso ÷ N), efeito de sair da conta, filtro de gerência (`_okrHistMArea`) e exclusão por checkbox —
`_okrHistExcl` (Set, `localStorage` `okr_hist_excl`, só simulação local) alimenta `_okrHistMedia()` (KPI + linha do gráfico).
**v4.8**: duas visões do progresso — `_okrHistMetrica` ('ating' padrão | 'marcos'), `_okrHistPctDe()`, e `_okrHistSnap(data)` devolve o snapshot normalizado pra visão (só Objetivos com valor, `progressoPct` = valor da visão, `resumoGeral` recontado; atingimento reconstruído por `lancamentos` ≤ data quando o snapshot não tem `atingimentoPct`); abas `_okrHistTabsHtml()`/`_okrHistSetMetrica()`. Toda a tela lê de `_okrHistSnap()`, não de `okrSnapshots` cru. **v4.7**: modo padrão `_okrHistMModo='dest'` (média + 3 que mais subiram/caíram, resto cinza; `_okrHistMDestaca()` destaca 1 Objetivo por hover em chip/linha da tabela/linha) e modo `mini` (um mini-gráfico por Objetivo). **v4.6**: janela maior (1400px); Objetivos viram **chips** (`.okr-hm-chip`, agrupados por gerência) no lugar da lista com checkbox; gráfico de linhas
`_okrHistMediaChartHtml()` (1 linha por Objetivo ou por gerência, ou só a média com faixa mín–máx; hover `_okrHistMLine()`), chips de visão
(`_okrHistMRange()`, `_okrHistMModo`, `_okrHistMStatus`/`_okrHistMStatusToggle()`, gerência `_okrHistMArea`) e destaques "puxam pra baixo / sustentam".

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
acento azul pra humano/teal pra agente via `.okr-agente-msg-humano`,
texto passa por `_renderMd()` — L3959, ver seção Campanhas — desde
2026-09-17, achado real: `**negrito**` aparecia literal),
`_okrAgenteChatSend()` (grava `{id,uid,author,init,foto,text,ts}`, `ts`
sempre `new Date().toISOString()`). Central geral, não presa a um
Objetivo — a conversa inteira (pedidos + respostas) É o histórico de
pedidos, sem viewer de log separado.

#### ⋯ Menu de contexto da aba OKR (2026-10-06, painel-dev.html v3.111) — clique direito no cartão de Objetivo e na linha de Marco (o botão ⋯ foi removido na v3.113)
- Motor genérico: `_okrCtxOpen(items,x,y,trigger)`/`_okrCtxClose()`/`_okrCtxHtml()`/`_okrCtxActivate()`; itens `{ico,label,key,run,disabled,title,danger,on,sub:[...]}` ou `{sep:true}`.
  Teclado por listener de captura (↑↓ ←→ Enter Esc + tecla de atalho de cada item); fecha ao clicar fora, rolar (após 300 ms),
  redimensionar, perder o foco. Disparo: `_okrCtxObjEv` (Objetivo), `_okrCtxMarcoEv` (Marco) — só `oncontextmenu`.
- Itens: `_okrCtxObjItems(id)` / `_okrCtxMarcoItems(id)` (mesmas permissões do modal: `_okrCanEdit`/`_okrCanCreate`/`_isAdmPainel`). Excluir Objetivo (`_okrExcluirObjetivo`) está no menu desde a v4.2, só pra ADM (`_isAdmPainel()`, mesma regra do modal), tecla X, com confirmação; Marco não tem Excluir (só Arquivar).
- Escritas rápidas por TRANSAÇÃO no nó (`_okrTx(path,mutate)` — clone, aborta com `false`): `_okrCtxTagToggle`, `_okrCtxMarcoStatus`, `_okrCtxMarcoApresentacao`,
  `_okrAtingQuickSalvar` (modal `#okr-aq-ov`: `_okrAtingQuickOpen/Ler/Prev/Close`); resumo no Histórico do Objetivo pai: `_okrCtxResumoNoObjetivo`; redesenho: `_okrCtxRefazTela`.
  `_okrArquivarMarco(idParam)` aceita o id (arquivar a partir da lista, sem o modal do Marco aberto).
- Teste: `scratchpad/test_okr_ctx.js` (37 cenários em Chromium com Firebase em memória).

#### 📋 Anotações da reunião na aba OKR (2026-09-17, v3.51 · painel-dev — promovida pra prod v3.55 em 2026-09-17)
Pedido direto do usuário depois de shippar a segmentação por reunião em
`okr-apresentacao.slide.html`: "na vdd quero q isso apareça la no painel
aba okr" — aditivo, lê/escreve o MESMO node
`kanban/okr/reuniao_notas/{data}/{id}` da apresentação (sync em tempo
real entre as duas telas, sem duplicar dado). Botão `#okr-notas-btn`,
`_okrShowNotas`/`_okrToggleNotas()` — L4983/L5079 — 4ª vista mutuamente
exclusiva em `_okrSetView('objetivos'|'historico'|'agente'|'notas')` —
L5046 (mesmo ponto único de decisão que já cobria as outras 3).
`okrReuniaoNotas` (estado local, `loadOkrReuniaoNotas()` — L4985 —
`onValue` no node inteiro, filtra por data no cliente, mesmo padrão de
`okrNotas` na apresentação), `renderOkrNotas()` — L5005 — reusa
`.okr-comment` (mesma bolha da Central Agente Ágil) + seletor de data
`#okr-notas-date-sel` (`window._okrNotasSetViewDate()`). Reunião que não
é a de hoje abre só leitura (`#okr-notas-compose` escondido,
`#okr-notas-readonly` visível). `window._okrNotaAdd()` — L5022 — sempre
grava no bucket de HOJE; `window._okrNotaDel()` — L5035 — só o próprio
autor apaga, só na reunião de hoje. Autor resolvido via
`_okrPessoaInfo(uid)` (já existente, fonte `_globalUsersCache`) — L5233
(ver seção Objetivos acima). Precisou expor `window._remove` no
`<script type="module">` (`remove` do SDK, novo import) — nenhuma outra
função do painel apagava nó do Firebase direto antes.

#### ❓ Ajuda (help content) da aba OKR (2026-09-05, v3.24 · painel-dev — promovida pra prod v3.24 em 2026-09-05; sincronizada com o lote de permissão/edição em 2026-09-30, v3.74 · painel-dev)
Modal estático `#okr-help-ov` (`openOkrHelp()`/`closeOkrHelp()`), mesmo
padrão de `#agentes-help-ov`/`openAgentesHelp()` (reusa as classes
`pev-modal-ov`/`pev-modal`/`pev-hd`/`pev-body`, sem CSS novo). Botão
"❓ Ajuda" no cabeçalho da aba OKR. Conteúdo cobre Objetivo/Marco/status,
permissão (ADM/PO-Organizador/🎯 Gestor OKR/Responsável — atualizado
2026-09-30, era só "ADM/Responsável"), click-to-edit em listas/
checklist, reordenar Objetivos e Marcos, Arquivar×Excluir, Tags/vínculo
de cards, 📈 Histórico semanal, a apresentação em slides (incl. "🎬
Aparecer na apresentação"/"Colapsar concluídos"), e a 💬 Central Agente
Ágil (como pedir, o que ela faz — **acha real, não corrigido**: a
ferramenta `criar_objetivo` do Agente Ágil, `functions/okr/
agenteTools.js:148`, continua hard-coded "só ADM", não foi atualizada
junto da expansão de permissão de 2026-09-30 — PO/Organizador/Gestor
OKR já criam Objetivo pela tela, mas são recusados incorretamente se
pedirem pro chat) — pedido direto do usuário.

#### `guia-okr.html` (raiz do repo, sem `-dev`/`version.json` — guia
visual em slides estáticos, gifs embutidos em base64; **linhas MUITO
longas** — algumas passam de 3 milhões de caracteres, nunca usar `Read`
sem `grep`/`awk` filtrando por tamanho de linha antes)
Criado 2026-09-25 (v3.65 · painel-dev), nunca tinha ganhado seção
própria neste mapa até agora. Botão "📘 Guia OKR" na página do OKR (e na tela inicial das torres)
abre em nova aba. Estrutura: `<section class="slide">` (33 desde
2026-10-07 à noite; eram 30 de manhã e 18 antes) navegadas por JS simples no fim do arquivo
(`document.querySelectorAll('.slide')`, dots + contador — some conta
sozinha, nunca precisa hardcodar o total ao adicionar/remover slide).
Conteúdo: conceito Objetivo/Marco, semáforo de status, criar Objetivo/
Marco, editar itens já escritos (click-to-edit, 2026-09-30), reordenar
Marcos E Objetivos (▲▼/arrastar, 2026-09-30), duplicar Objetivo,
arquivar/excluir/vincular, histórico/reuniões, notificações/Agente
Ágil, apresentação ao vivo (incl. "🎬 Aparecer na apresentação"/
"Colapsar concluídos", 2026-09-30), e uma tabela comparativa de
Permissões (`.cmp-row`, grid CSS — 5 colunas desde 2026-09-30: Ação/
ADM/PO-Org-Gestor OKR/Responsável/Outros, era 4). **2026-10-07**: +5
slides — 🏛️ Torres e gerências, ⚙ Gerências configuráveis, 📢 Mural do
OKR, 🔔 O sino do OKR (com @menção) e 👁 Visualizadores externos —
com prints reais (JPEG em base64) de uma página rodando com dados
fictícios; a tabela de Permissões ganhou a linha "Gerências e Mural"
e a ressalva "dentro da sua torre". Sincronizado com a
"❓ Ajuda" do painel (ver entrada acima) e com o `CHANGELOG.md` — as
duas fontes devem contar a MESMA história, mesmo princípio da skill
`/atualizarhelpcontent` (essa skill hoje só cobre `kanban-dev.html`
`HELP_CONTENT`, não este arquivo — considerar estender o escopo dela
se este gap se repetir).

### 🎯 `okr-dev.html` — OKR em página própria (2026-10-06, v1.0 · okr-dev; promovido como `okr.html` v1.0 · okr)

- **🔗 Aba "Cards" (v2.57, só dev)**: `renderOkrCards()`/`_okrCardsCarregar(refresh)`/`_okrCardsVinculos()`/`_okrCardsSet()`; reaproveita `_okrSquadOkrCards()` (que agora guarda também coluna/responsável/prazo + `_okrSqCols`). `_okrSetView('cards')`, wrapper `#okr-cards-wrap`. Só baixa os cards de cada squad ao clicar em "Carregar cards".
> 🪟 **Links entre páginas (okr-dev v2.36 / painel-dev v5.20 / kanban-dev v8.30.801)** — todo redirecionamento OKR ↔ painel ↔ kanban (botão "🐟 Painel", aba "OKR ↗", cliques do sino/`openNotif`) abre **aba nova** via `MareNotif.abrirPagina(url)` (`mare-notif-dev.js`; cai pra `location.href` só se o popup for bloqueado). Link novo entre páginas: usar esse helper (ou `<a target="_blank" rel="noopener">`), nunca `location.href=`. Exceção proposital: o encaminhamento de link antigo `painel?okr=` → OKR (`location.replace` no topo do painel).
> 🔔 **SINO ÚNICO (okr-dev v2.12 / kanban-dev v8.30.797 / painel-dev v5.11, `mare-notif-dev.js` na raiz)** — módulo compartilhado `window.MareNotif`: `start({user,isViewer,isAdm,onChange,abrirFeed})`, `items()`/`unread()`/`markOne()`/`markAll()` (feed da torre em `kanban/notif_feed`, "lido" em `kanban/notif_feed_seen/{uid}` ou localStorage pro externo), `pushFeed()`, `urlFeed()`/`urlPessoal()` (roteador de URLs entre páginas), `ICONS`; **rodapé do sino** (okr-dev v2.14 / painel-dev v5.13): `rodapeHtml()`/`rodapeRender()` (🔊 `somToggle()`/`novas()`, permissão do aparelho `permClick()` + push FCM, 🔕 `dndSet()`/`dndMenu()`, `menusFechar()` pro Esc) e "Limpar antigas" (`_okrBellLimpar()`) — mesmos dados do kanban (`notif_sound_muted`, `notif_prefs/dnd`, `fcm_tokens`). Integração: OKR `loadOkrFeed()`/`_okrBellItens()`/`_okrFeedPush()` (wrapper do `pushFeed`); kanban `renderNotifs()` mescla `MareNotif.items()` (itens `_feed`, `openFeedNotif()`), `markAllRead()` zera o feed também; painel `_painelSyncFeed()` (grupo `'feed'` do sino), `_painelLoadLembretes()` (só ADM, guarda própria). Mural do OKR = botão 📢 (`openOkrMural()`/`_okrMuralBadge()`/`_okrMuralRender()`), deep link `?mural=` (`_okrMuralDeepLink()`).
> 👁 **Visualizadores externos (v2.5+ · okr-dev)** — `window._isPainelViewer`, `_usuariosNode()` (visualizador lê `kanban/usuarios_publicos`, nunca `kanban/usuarios`), `openOkrViewers()`/`addOkrViewer()`/`removeOkrViewer()`/`_okrApplyViewersBtn()` (botão só ADM; lista `kanban/painel_viewers`), `_okrApplyViewerLock()` (campos de escrita travados); o sino/Mural do externo usa `localStorage` (`mare_feed_seen_<emailKey>` (módulo `mare-notif-dev.js`), `okr_mural_visto_<uid>`). **Quem já entrou (v2.23 · okr-dev / v5.18 · painel-dev):** `_viewerRegistrarAcesso(pagina)` (o externo grava `kanban/painel_viewers/{emailKey}/acesso = {primeiro, ultimo, uid, pagina}`, no máx. 1×/5 min; regra `painel_viewers/$k/acesso` em `database.rules.json`) + `_viewerStatus()`/`_viewerOrdena()` (🟢 online agora · ✅ entrou, visto há X · ⏳ ainda não entrou) usados por `renderOkrViewers()` e `renderPainelViewers()` — as mesmas funções existem nas duas páginas.
> 📢🔔 **Mural + sino do OKR (v2.10 · okr-dev)** — `okrMural`/`loadOkrMural()` (`kanban/okr/mural`), `_okrMuralRender()` (lista do botão 📢), `openOkrMuralModal()`/`saveOkrMural()`/`okrMuralArquivar()`, `_okrMuralChecaPopup()`/`_okrMuralAbrir()` (popup do 🚨 urgente), `_okrMuralPodePublicar()`/`_okrMuralPodeGerir()`; feed `okrFeed`/`loadOkrFeed()` (`kanban/okr/feed`, lido em `kanban/okr/feed_seen/{uid}`), `_okrFeedPush()`/`_okrFeedMarcoConcluido()`; sino `_okrBellItens()`/`_okrBellRender()`/`_okrBellToggle()`/`_okrBellClick()`; visibilidade `_okrAlvoParaMim()`; @menção `_okrMencaoInput()`/`_okrMencoesDoTexto()`/`_okrNotifyMencao()`/`_okrMencaoHtml()` (Anotações da reunião), deep link `?okr=notas`. v2.11: `_okrMuralSaving` (trava do Publicar) e o handler de Esc em camadas (aviso → sino → publicar); `_okrDuplicarObjetivo()` também grava o evento `obj_criado`; o sino do painel (`renderPainelNotifs()`) navega nas notificações `okr_*` via `OKR_PAGE`.

> ⚙ **Gerências configuráveis (v2.9 · okr-dev)** — `okrGerenciasCfg` (listener `loadOkrGerencias()` em `kanban/okr/gerencias`), `_okrGerenciasBase(torre)`/`okrGerenciasDa(torre, comOcultas)`/`okrGerenciasTodas()`/`_okrGerenciaDe(id, torre)`; `okrGerenciaLabel/Icon(id, torre)` agora recebem a torre; modal `openOkrGerencias()`/`renderOkrGerencias()`/`_okrGerTx()`/`_okrGerAplicar()`; `okr-apresentacao.slide.html`: `_okrGruposGerencia()`/`_okrGerenciasBase()`. **📅 Calendário do OKR (v2.25 · okr-dev):** bloco `// ═══ 📅 Calendário do OKR` — dado `kanban/okr/calendario/eventos/{id}` (`OKR_CAL_PATH`, listener `loadOkrCalendario()` → `okrEventos`); recorrência pura `_okrCalOcorrencia()`/`_okrCalRecNorm()`/`_okrCalOcorrencias(ev, de, ate)`/`_okrCalRecTexto()` (`OKR_CAL_REC`); agenda global (`torre:''`) × local (`torre:id`): `_okrCalVisivel()`/`_okrCalTorreFiltro()`/`_okrCalTorrePadrao()`/`_okrCalPodeCriar()`/`_okrCalPodeEditar()`; itens (eventos + prazos de Marcos) `_okrCalItens()`; visão `renderOkrCalendario()` (via `_okrSetView('calendario')`/`_okrToggleCal()`; wrap `#okr-cal-wrap`); detalhe `openOkrEvento()`/`renderOkrEventoDetalhe()` com pauta `_okrCalPauta()`; editor `openOkrEventoEditor()`/`renderOkrEventoEditor()`/`saveOkrEvento()`/`_okrEvExcluir()` (+ `_okrCalEscolha()`); lado do Objetivo `_okrCalCls()` (classe de torre segura — só id conhecido), `_okrCalAbrange()`/`_okrCalProximasDoObjetivo()`/`_okrCalProximasHtml()`/`_okrCalCardChip()`. O "bloco quinzenal" (`OKR_BLOCO_*`, `functions/okr/dailyScan.js`) segue separado — migrar pra eventos recorrentes é próximo passo. **Cabeçalho em níveis (v2.29):** `.okr-head` (título `#okr-titulo-aba` + 🎥 Apresentação + `#okr-more-btn`/`#okr-more-menu` via `_okrMoreToggle()`/`_okrMoreFecha()` + `#okr-novo-btn`), abas `#okr-tabs` (`#okr-tab-obj`, `#okr-cal-btn`, `#okr-historico-btn`, `#okr-notas-btn`, `#okr-agente-btn` — `_okrSetView()` só marca `.on`/`aria-selected`), filtros: `_okrFiltrosMaisToggle()`/`_okrFiltrosMaisSync()` (`#okr-filtros-mais`: período/pessoa/tag); `#okr-ger-btn` e `#okr-viewers-btn` são itens do menu (visibilidade em `_okrRenderNav()`/`_okrApplyViewersBtn()`). **Migração do bloco quinzenal (v2.28):** `_okrBlocoEventos()` (os 2 eventos a importar, `origem:'bloco_quinzenal'`), `_okrBlocoMigrado()`, `_okrCalImportarBloco()`/`_okrCalDesfazerBloco()` (banner `.okr-cal-migra` só pra ADM); com a origem presente `_okrBlocoInfoHtml()` devolve '' e `runOkrDailyScan()` (`blocoMigrado`) pula o gatilho 2 fixo — as constantes/fórmula `OKR_BLOCO_*` continuam até o calendário ir pra prod. **Tags (v2.27):** `ev.tagIds` — `_okrEvToggleTag()` (editor), `_okrCalSetTag()`/`_okrCalTagF` (filtro, aplicado em `_okrCalItens()`), escopo único em `_okrCalAbrange()` ↔ `abrange()` de `functions/okr/calendario.js` (vínculo → tag OU gerência → recorte sem acerto = fora → reunião sem recorte = torre toda); `_okrCalPauta()` usa o mesmo escopo. **Avisos/convidados/anotações (v2.26):** sino — `_okrCalAvisaFeed()` (feed `okr_evento` via `_okrFeedPush`), `_okrCalAvisaConvidados()`/`_okrCalNotificaPessoas()` (notificação pessoal `okr_reuniao` com `okrEventoId`/`okrEventoData`), `_okrCalMudou()`; abrir pelo sino/link `_okrAbrirEvento()`/`_okrEventoDeepLink()` (`?evento=&data=`; roteador em `mare-notif-dev.js`: `urlOkrEvento()`/`urlFeed()`/`urlPessoal()`); anotações `_okrEvdEscuta()`/`_okrEvdNotasHtml()`/`_okrEvdNotaAdd()`/`_okrEvdVincular()` (`kanban/okr/calendario/notas|vinculos`, escuta só o evento/data abertos); servidor `functions/okr/calendario.js` (`ocorrencias()`/`abrange()`/`alvosDoEvento()`/`convidadosDe()`/`lembretesDe()` — espelha o cliente) + gatilho 3 `avisaEventosDoCalendario()` em `functions/okr/dailyScan.js` (véspera e dia, `lembrar:{vespera,dia}`).
**Apresentação — teclado (2026-10-07):** `keydown` global (`document.addEventListener('keydown'`) — ←/→/Espaço passam slides; com o detalhe aberto ←/→ chamam `window._okrDetailVizinho(±1)` (Objetivo anterior/seguinte da gerência; mesma lista de `_okrGerenciaObjetivos()` dos botões); `_okrEhCampo(el)` ignora teclas em INPUT/TEXTAREA; Espaço faz `preventDefault` (senão o botão focado clicava junto).
**Apresentação por torre (2026-10-07):** `buildSlides()` monta capa (cartões `.torre-tile` por torre) → para cada torre um slide-capa (`key:'torre:<id>'`, `.torre-hd` + `.ger-row` clicáveis) seguido dos slides das gerências (`key:'ger:<torre>:<gerência>'`, chip `.torre-chip`) → panorama (faixa `.sum-torre` por torre + coluna Média); helpers `_okrStatsDe()`/`_okrSbarHtml()`/`_okrLegendaHtml()`/`window._okrGoToKey()`; filtro de torre `_okrFiltroTorre` (select `#tb-torre`, `_okrAtualizaFiltroTorre()`, `window._okrSetTorre()`, URL `?torre=<id>`) aplicado em `_okrObjetivosAtivos()`; cores por torre pelas classes `.t-digital/.t-comercial/.t-corporativa` (variável `--torre`) e bolinhas do rodapé coloridas.
> 🏢 **Modo só Hering (2026-10-08; okr-dev v2.43 · painel-dev v5.21 · kanban-dev v8.30.802-dev)** — `window.MARE_SO_HERING` no 1º `<script>` de cada página (+ `const MARE_SO_HERING` em `okr-apresentacao.slide.html`, `SO_HERING` em `mare-notif-dev.js`, `functions/common/mareModo.js`). `okr-dev`: `OKR_TORRES_TODAS`/`OKR_SO_DIGITAL`/`OKR_TORRES` (só Digital), `_okrSoAtivo()`, `_okrTorreDe()` (devolve a torre crua da inativa), `_okrEntrarTorre()` forçado, filtros em `loadOkr()`/`loadOkrMural()`/`loadOkrCalendario()`, `_okrPessoaOptions()` (só `@ciahering`), `_okrTorreCampoHtml()`, `okrTorreTitulo(id)` (rótulo "Digital Hering 🐟" no modo só Hering). `kanban-dev`/`painel-dev`: `TRUSTED_DOMAINS`/`_dominiosTxt()`, classe `.ms-login`, `_mencionavelNoModo()` + `mentionCandidates()`. **Mapa completo do que existia (Arezzo/Microsoft, Torres, menção) e como religar: `docs/arezzo/MARE_SO_HERING.md`.**
>
> 📅 **Legenda do calendário (okr-dev v2.51)** — `OKR_CAL_LEG`, `_okrCalTiposOff`, `_okrCalTipoDe()`, `_okrCalToggleTipo()`/`_okrCalMostrarTodos()`, `_okrCalLegendaHtml(todos)`; modo só Hering no calendário: `_okrCalTorreFiltro()`/`_okrCalTorrePadrao()`/`_okrCalAgendaNome()`/`_okrCalCls()`/`_okrCalOrgTxt()` e a classe `.okr-so-hering-so` (texto que só aparece nesse modo; a oposta é `.okr-so-hering-esconde`).
>
> 🏷️ **Tags do Radar (okr-dev v2.50)** — `_okrTagApagar()` (apaga a tag e a tira de todo Objetivo, com histórico; em uso só ADM), `_okrTagUso()`, `openOkrTagsMgr()`/`renderOkrTagsMgr()` (⋯ Mais → 🏷️ Gerenciar tags), `_okrTagFormOpen()` (editar/criar; `mgr` = veio do gerenciador, cria sem aplicar).
>
> 🔲 **Menu de produtos do Oceano (2026-10-09)** — `mare-notif(-dev).js`: `APPS`, `appsVisivel()`, `appsMontar()`, `appsUso()`, `appsToggle()`/`appsPopRender()`; cada página tem `<span id="mare-apps-slot">` no cabeçalho. Ver `docs/OCEANO.md`.
> ✏️ **Salvar/fechar do modal de edição (v2.42 · okr-dev)** — `saveOkrObjetivo()`/`saveOkrMarco()` são só a casca com a trava `_okrSalvandoObj`/`_okrSalvandoMarco` (+ botão desabilitado, `catch` com toast e restauro do `history`); o corpo está em `_saveOkrObjetivoInner()`/`_saveOkrMarcoInner()` (recusam salvar item apagado por outra pessoa). "Tem alteração?" = `_okrSnapshotMudou(draft, snapshot)` → `_okrDirtyStr()` (normaliza `mostrarApresentacao`/strings ausentes e ordena chaves; antes JSON cru acusava alteração falsa). Re-render assíncrono do modal (tags/gerências/comentários do Marco/reordenar) sempre sincroniza o rascunho antes: `_okrRerenderObjModalSync()`. Esc fecha o modal (keydown em BORBULHA no `document`, junto dos `click` de fora, perto do fim do bloco do modal de Marco).
> 🎬 **Objetivo oculto na apresentação + menu novo (v2.40 · okr-dev)** — `obj.mostrarApresentacao===false` = oculto (padrão: aparece). Toggle `_okrCtxObjApresentacao(id)` (transação `_okrTx` + histórico), checkbox `#okr-f-mostrar-apresentacao` em `renderOkrObjConfigBody()` (lido em `_okrSyncObjDraftFromDom`, diff em `_okrHistDiffObj`), selo no `_okrObjCardHtml()`, filtro `_okrFilter.apres` ('sim'/'nao', select `#okr-filter-apres`, conta em `_okrFiltrosMaisSync`). `okr-apresentacao.slide.html`: `_okrObjetivosAtivos()` exclui ocultos (tudo parte dele) + guarda no `?preview=`. Menu de contexto: `_okrCtxObjItems()` ganhou O/H/M/G → `_okrCtxVerHistorico`, `_okrCtxAgendarReuniao` (monta o rascunho e chama `renderOkrEventoEditor()` direto — `_okrEvRerender()` leria a tela antiga), `_okrCtxPerguntarAgente(prefixo)` (também no menu do Marco).
> 💬 **Agente Ágil flutuante (v2.39 · okr-dev; movido pro nível do body na v2.41)** — não é mais aba: `#okr-agente-fab` (botão, `.okr-fab`) + `#okr-agente-wrap` (painel `.okr-agente-panel`, `hidden`) logo DEPOIS do `</div><!-- /app-root -->` (dentro do app-root o painel ficava sempre por baixo dos modais; escondido antes do login por CSS `body:has(#app-root[style*="none"])`). `_okrVersaoMostrar()` copia o rótulo `.version` pro menu ⋯ Mais/Ajuda/tooltip do botão. `_okrAbrirAgente()`/`_okrFecharAgente()`/`_okrToggleAgenteChat()`; `_okrShowAgenteChat` = painel aberto; selo `_okrAgenteNaoLidas()`/`_okrAgenteBadge()`/`_okrAgenteMarcaVista()` (visto por aparelho em `localStorage okr_agente_seen_<uid>`; só conta resposta do agente logo após mensagem MINHA); `renderOkrAgenteChat()` (+ "pensando…"), `_okrAgenteChatSend()`, `_okrAgenteExemplo()`/`_okrAgenteExSync()` (atalhos). `_okrSetView('agente')` é legado (abre o painel). `?okr=chat` e a notificação `okr_agente` → `_okrIrParaChat()`. Mesmos ids `okr-agente-inp`/`okr-agente-send-btn`/`okr-agente-chat-list` de antes (o lock do visualizador usa).
> 🎨 **Gerências em faixas alternadas (v2.37 · okr-dev)** — `secaoGerencias()` (dentro de `renderOkrObjetivos`) envolve cada gerência em `<div class="okr-ger-bloco okr-ger-a|b">` (a/b = posição `pos%2` na lista renderizada, NÃO a gerência); CSS `.okr-ger-bloco/.okr-ger-a/.okr-ger-b` antes de `/* ── página própria do OKR ── */`; cor = `var(--torre, var(--okr-focus-rgb))` (global → cor da torre; claro → branco translúcido).
> ❓ **Ajuda do OKR (v2.35 · okr-dev)** — `#okr-help-ov` agora é abas + busca + FAQ: HTML estático (`.hlp-pane` por aba, `.hlp-it` = `<details>` por tópico com `id="hlp-<id>"` e `data-kw` de palavras-chave; 18 perguntas `hlp-faq1..18`); JS junto de `openOkrHelp(id?)`/`closeOkrHelp()`: `_okrHelpTab(t)`, `_okrHelpIr(id)` (abre aba+tópico, links `[data-go]`), `_okrHelpBusca(q)`/`_okrHelpLimpa()` (`_hlpNorm` sem acento, índice por item `_hlpIdx`, destaque `_hlpMarkDom`/`_hlpMarkHtml`), e **`_okrHelpPerfil()`/`_okrHelpEuHtml()` = o cartão "🙋 O que eu posso fazer?"** (lê `isAdmUser`, `_isPOouOrgEmAlgumSquad`, `_isGestorOkr`, `_okrMinhaEhGeral`, `_okrCanCreate`, `_okrIsResponsavel`, `window._isPainelViewer` — se mudar uma regra de permissão, ajustar o texto aqui). CSS `.hlp-*` antes de `/* ── página própria do OKR ── */`. Ao adicionar um tópico novo: `add` no HTML da aba certa + `data-kw`, e (se for dúvida comum) uma pergunta no FAQ.
> 🛡️ **Robustez do calendário/diálogos (v2.31–v2.33 · okr-dev)** — `_okrCalCls(torre)` (só torre conhecida vira classe CSS: `ev.torre` vem do banco), `_okrCalNav()` leva `_okrCalSel` ao mês exibido, `_okrEvExcluir()` avisa "toda a série" pela próxima ocorrência, `_okrEvSalvando` (trava de duplo clique em `saveOkrEvento()`; evento apagado por outra pessoa não ressuscita), `_uiEscFecha(fn)` (Esc na `window` em captura fecha SÓ o diálogo — `_uiModalPainel()`/`_okrCalEscolha()`); `functions/common/pushUrl.js` `urlDoPush()` abre `?evento=&data=` quando a notificação tem `okrEventoId`. A ajuda in-app (`#okr-help-ov`) ganhou "🧭 O cabeçalho", convidados/anotações do calendário e o Agente por torre.
> 📱 **Modais no celular (v2.34 · okr-dev)** — bloco CSS `/* 📱 Modais do OKR no celular` (`@media (max-width:640px)`, ids `#okr-obj-ov`/`#okr-obj-config-ov`/`#okr-marco-ov`): folha `100dvh`, cabeçalho em 2 linhas (`order` no `.pc-modal-hd`), `.okr-nav-sel` (o seletor "Ir para…" gerado por `_okrNavChipsHtml()` junto dos chips — CSS mostra um ou o outro), rodapé `.okr-foot-desk` (inline no desktop, `display:contents`) × `.okr-foot-more` (`<details>` ⋯ no celular) montados em `renderOkrObjBody()`; `_okrIrParaSecao()` não foca input em `(pointer:coarse)`.
> ⭐ **Torre "Geral" (v2.8 · okr-dev)** — `OKR_TORRE_GERAL`, `_okrMinhaEhGeral()`, `_okrPodeMudarTorre()`; `_okrCanEdit()`/`_okrCanCreate()`/`_okrTorreParaCriar()` tratam a Geral como "todas as torres" (só com papel). `painel-dev.html`: `GU_TORRES` ganhou `geral`; `MARE_PAGES`/`togglePagesSwitcher()` = menu de páginas do título.
> 📈 **Histórico por torre (v2.3 · okr-dev)** — `_okrHistGlobal()`, `_okrHistTorreDe(id,o)` (torre atual do Objetivo → gravada no snapshot → Digital), `_okrHistSub(snap,torre)`, `_okrHistTorresHtml()` (cartões), `_okrHistFiltraTorre()`, agrupamento da janela "Como cada Objetivo contribui" via `_okrHistGrupoDe/Label/Icon/Cor/Pos` (gerência numa torre, torre na global); `functions/okr/weeklySnapshot.js` grava `torre` em cada Objetivo.
> 🏛️ **Torres (v2.0 · okr-dev, 2026-10-07)** — `OKR_TORRES`/`OKR_TORRE_PADRAO`/`OKR_TORRES_CORTE`, `OKR_GERENCIAS_POR_TORRE`, `okrTorreInfo()`, `_okrTorreDe(o)` (sem campo = Digital), `okrGerenciasDa(torre)`, `_okrTorreDoUsuario()`/`_okrMinhaTorre()`, estado `_okrTorreAtual` (`''` home | id | `'global'`), `_okrNaVisao(o)`, `_okrTorreParaCriar()`, `_okrCanEdit(obj)`/`_okrCanCreate(torre)` (escopo por torre), `_okrAplicarShell()`/`_okrRenderHome()`/`_okrRenderNav()`/`_okrEntrarTorre(id,push)` (`?torre=`), `_okrAplicarTorreModal()`, `_okrCheckTorrePrompt()`/`_okrAbrirPromptTorre()`/`_okrDefinirMinhaTorre()`, `_okrMudarTorreDraft()`. Flag do usuário: `kanban/usuarios/{uid}/torre` — escrita em `painel-dev.html` (`setGlobalUserTorre()`, `GU_TORRES`, `_guTorreDe()`) e na inscrição do `kanban-dev.html` (`mostrarInscricao(user,dados,{pedirTorre})`/`confirmarInscricao()`, `#insc-torre`).
Extração mecânica (AST) da aba OKR do `painel-dev.html` v4.8 — todas as âncoras de OKR da seção acima (funções `_okr*`/`*Okr*`, `OKR_*`, `ATING-ENGINE`, `_okrCtx*`, `_okrHist*`) valem aqui com os mesmos nomes; **re-`grep` o nome em `okr-dev.html`**. Só a INFRA em volta é nova:
- Bloco "🎯 OKR — página própria" no início do `<script>`: `SQUADS`/`squadBoardUrl()`/`loadExtraSquads()` (squads base + `kanban/squads_meta`), `loadAdmList()`, `loadGlobalUsers()` (enxuto, só popula `_globalUsersCache` e re-renderiza o OKR).
- **Cards vinculados sob demanda**: `_okrCardCache`/`_okrCardFetchOne()`/`_okrCardEnsure()`/`_okrCardPaint()` (título por vínculo via `cards_index` → `cards/{chave}`), `_okrSquadOkrCards()` (carga única por squad na 1ª busca, só cards com badge OKR), `_okrCardSearchResults()`/`_okrRenderCardSearch()` (assíncrona) e `_okrCardLinksHtml()` — substituem as versões do painel, que liam `squadData` (todos os cards). `_okrOpenLinkedCard()` abre `kanban(-dev).html?squad=&card=` em aba nova.
- Bloco "🔐 Login / portão de acesso" (cópia do painel): `doSignIn()`/`doSignInMicrosoft()`, `_loginProviderMismatchMsg()`, handler de `auth-change` (viewers com cache de 15 min), `_okrEnsureUserRecord()`, `_finishOkrLogin()` (sobe `loadOkr()` & cia. 1x por usuário; outra conta na mesma aba recarrega).
- 🔒 **Trava de edição simultânea do Objetivo** (okr-dev v2.21; mesmo desenho de `_checkCardLock()` do kanban): `okrObjLocks` (listener `loadOkrLocks()` em `kanban/okr/obj_locks`), `_okrLockInfo()`/`_okrLockBloqueia()` (trava viva de OUTRA pessoa / guarda das ações rápidas), `_okrLockOnChange()` (reconcilia o Objetivo aberto: tomar/leitura/perdi/herdei), `_okrLockTomar()`/`_okrLockSoltar()` + heartbeat 1 min (`OKR_LOCK_*_MS`: 10 min abandonada, 5 min de carência no pedido), `_okrLockPedir()`/`_okrLockLiberarAgora()`/`_okrLockHandleReq()`, aviso `#okr-obj-lock-row`, selo `.okr-lock-chip` no cartão. **O Agente Ágil (servidor) respeita a trava** (v2.33, `functions/okr/agenteHelpers.js` `travaDeOutro()`: lê `kanban/okr/obj_locks/{id}`, 10 min de validade, trava da própria pessoa não conta → erro `objetivo_em_edicao`).
- 🟢 **Online no OKR** (v1.5): `_okrSendHeartbeat()`/`_okrPresenceStart()`/`loadOkrPresence()`/`renderOkrOnline()` — node `kanban/painel/okr_presence/{uid}`, `OKR_PRESENCE_TTL_MS` 30 s, faixa `#okr-online`. Visualizador externo também aparece (v2.19, selo 👁, campo `externo:true`; regra própria em `database.rules.json` → `kanban/painel/okr_presence/$uid`).
- `_okrObjShareUrl()` = `location.pathname + '?okr=<id>'`; `_okrTryOpenFromUrl()` sem `swPtab`. Auto-atualização: `VERSION_KEY = 'okr_dev'`.
- Módulo Firebase próprio: override de config em `localStorage` sob o sufixo `_okr_dev`.

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
esta feature, só descoberta ao promovê-la): `painel.html` tinha
`_pushHistReenviar()`/"🔔 Enviar push manual" e
`VISIBILITY_REFRESH_COOLDOWN_MS` (cooldown de 3min pro refresh ao voltar
a aba) que `painel-dev.html` nunca recebeu; `painel-dev.html` tinha o
banner de auto-update por polling de `version.json` (`_auCheckVersion()`)
que `painel.html` nunca teve. **Reconciliado na promoção pra prod (v3.29 ·
painel, 2026-09-06)**: os 3 pontos agora existem nos dois arquivos —
Push Manual e o cooldown de visibilidade foram preservados na promoção
(não fazem parte do diff normal dev→prod, então precisam continuar
sendo copiados manualmente toda vez que `painel-dev.html` for promovido,
até algum dia entrarem em paridade real com dev), e o banner de
auto-update passou a existir em `painel.html` também (`VERSION_KEY =
'painel'`, mesma mecânica de `kanban.html`/`kanban-dev.html`).

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
  Cache local (`localStorage`, chave `painel_viewer_ok_{email}`) evita
  reconsultar a whitelist a cada `auth-change` — TTL 15min (reduzido de
  24h em 2026-09-21, `/monitorarbugs` "login e segurança": com 24h,
  remover alguém de `painel_viewers` não tinha efeito prático por até 1
  dia inteiro pra quem já tivesse o cache válido no navegador; mesmo
  achado corrigido também no `externos` do kanban e em
  `okr-apresentacao.slide.html`, ver seção própria abaixo).
- **Login Microsoft (integração Arezzo, 2026-10-01)**: `painel.html`/
  `painel-dev.html` nunca tinham recebido o mesmo tratamento que
  `kanban.html`/`kanban-dev.html` ganharam no mesmo dia — só Google,
  domínio confiável checado só como `@ciahering.com.br` puro (achado
  real, pedido direto: "coisas ligadas ao usuário que são Google e você
  precisa adaptar pra Microsoft e ainda não fez"). `msProvider`
  (`<script type="module">`, perto de `calProvider`) + botão "Entrar
  com Microsoft" + `doSignInMicrosoft()` — mesmo padrão exato de
  `kanban-dev.html`, **sem** o fallback de popup→redirect (painel nunca
  teve isso nem pro Google, mantido consistente, não introduzido aqui).
  `TRUSTED_DOMAINS`/`_isTrustedDomainEmail()` — perto de `ADM_EMAILS` —
  substitui o `endsWith('@ciahering.com.br')` solto no gate de login
  (dentro do listener `auth-change`) e na tela "Adicionar
  visualizador". `database.rules.json` já cobria isso de graça (mesmo
  arquivo compartilhado, provider-pin feito mais cedo no mesmo dia já
  vale pros nodes que `painel.html` lê).
- **`_painelEnsureUserRecord(user)` (2026-09-09)** — chamada de dentro de
  `_finishPainelLogin()`, só pra quem NÃO é visualizador externo. Achado
  real, relato direto do usuário: quem só usa o painel (gente de OKR que
  não mexe no board) nunca ganhava registro em `kanban/usuarios/{uid}` —
  só `kanban(-dev).html` (`autoRegistrar()`) cria/cura esse node, no
  login do board. Cria o registro no 1º login pelo painel — **sem**
  `inscrito`/`squads`/`role` (abrir o painel não deve auto-matricular
  ninguém em squad nenhum do board, isso continua sendo decisão de um
  ADM em 👥 Pessoas). Se o registro já existir incompleto, cura só os
  campos vazios via `_update` (nunca reescreve o node inteiro — não
  toca em squads/inscrito/role de quem já é membro de verdade).
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
- `loadAgentesExternosPainel()` — L9110 — registra o listener em
  `kanban/config/agentesExternos`, chamado no boot (`fb-ready`).
- `renderAgentesExternosPainel()` — L9122 — lista expansível, agora
  dentro da aba própria "🤖 Agentes" (`ppane-agentes`, ver seção "Aba
  Agentes" abaixo — MOVIDA de dentro de `openCfg()`/`#cfg-ov` em
  2026-09-01, era dado GLOBAL vivendo dentro de um modal por squad);
  cada item mostra descrição (textarea) + chips de squad (`SQUADS`,
  checkbox por squad). Ganhou também um campo "🔗 Webhook de retorno"
  (`webhookUrl`, 2026-08-31 — ver entrada própria abaixo).
- `criarAgenteExternoPainel()` — L9076 / `salvarAgenteExternoPainel(id)`
  — L9111 / `toggleAgenteExternoSquad(id,squadId,checked)` — L9133
  (grava na hora, sem precisar de "Salvar") / `excluirAgenteExternoPainel(id)`
  — L6486. Todas as escritas gateadas por `_isAdmPainel()`. As duas do
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
- `_fillAgentesLogSquadFilter()` — L9279 — popula o `<select>` de filtro
  por squad a partir de `SQUADS` (client-side, sem leitura de Firebase),
  chamado toda vez que a aba abre (`swPtab()`).
- `loadAgentesTabData()` — L9286 — SOB DEMANDA (botão "🔄 Atualizar", não
  listener sempre ligado — são N squads × 2 leituras: `kanban/squads/
  {squadId}/dados/agentes` + `kanban/squads/{squadId}/dados/agente_log` —
  ambos sob `dados/`, mesmo path que `FB` já usa em kanban.html/
  kanban-dev.html; achado real, 2026-09-01: 1ª versão desta função lia
  `kanban/squads/{squadId}/agentes` SEM o `/dados/`, path sem regra
  nenhuma em `database.rules.json` → "Permission denied" ao vivo).
  Guarda o resultado em `_agentesTabCache` e chama os 2 renders abaixo.
- `renderAgentesAtivosGrid(results)` — L9310 — grid por squad cruzando
  Agentes de IA do board com Agentes Externos que têm `init` (mesma
  condição que os torna selecionáveis em `kanban-dev.html`); os sem
  `init` aparecem separados como "📡 só contexto".
- `renderAgentesLogCross()` — L9221 — mesma lógica de `renderAgenteLog()`
  (kanban.html/kanban-dev.html) mas agregando `_agentesTabCache` de
  TODOS os squads numa lista só, filtrável pelo select acima; link
  "abrir card ↗" usa `squadBoardUrl(squadId,cardId)` (já existente) pra
  abrir o board certo em nova aba. Cada item de `acoes[]` passa por
  `_renderMd()` desde 2026-09-17 (mesmo achado/fix de
  `renderAgenteLog()` — `esc()` puro mostrava `**negrito**` literal).
- `openAgentesHelp()`/`closeAgentesHelp()` — L9368/L9369 — modal estático
  (`agentes-help-ov`) explicando a diferença entre Agente Ágil/Agentes de
  IA no board/Agentes Externos (e os 2 sentidos de fluxo destes últimos)
  — primeiro help_content próprio do painel (não tem Central de Ajuda
  tipo `HELP_CONTENT`/Ctrl+K do kanban).

### Dashboard consolidado
- `loadAll()` — L10510 / `renderAll()` — L10530
- `renderPainelInsights()` — L6298 — stat cards + donuts cross-squad
  (prioridade, carga por responsável, riscos, parados, OKR por coluna,
  por submarca, por canal de venda — os 2 últimos só entram se pelo
  menos uma squad visível tiver o campo ativo, mesmo padrão de
  `renderBoardDataInsights()` em kanban-dev.html, mas agregado)
- `renderOKR()` — L6150
- `renderBlockers()` — L11124 / `resolveAllBlockers()` — L11037 (relê
  `/cards` fresco do Firebase antes de escrever, não usa `squadData`
  cacheado pra montar o payload — ver `/monitorarbugs` 2026-09-17)
- `renderRiscos()` — L6194
- `renderTrend()` — L11703 (throughput)
- `renderColDist()` — L11726
- `renderComparison()` — L10972
- `loadAgentUsage()` — L6635
- `renderGerenciaBar()` — L3221 / `gerenciaSquadIds()` — L3214 (Insights por Gerência)

### Board Setup
- `openBoardSetup()` — L11761

### Usuários
- `openGlobalUsersModal()` — L10223
- `initHiddenCols()` — L9764

## oceano-dev.html (lobby da família Oceano — 2026-10-09, só dev; arquivo único, 2 `<script>`: módulo Firebase + IIFE)
- **🔔 Sino (v1.5, só dev)**: `iniciarSino()`/`sinoRender()`/`sinoToggle()`/`sinoClique()`/`sinoTudoLido()`/`sinoLimpar()` + `rotearUrl()` (notificação → `abrirApp()`); usa `MareNotif.start()/items()/urlPessoal()/urlFeed()/rodapeHtml()`; FCM por `import()` dinâmico no módulo Firebase.
Re-grep o nome antes de confiar em linha.
- `APPS` / `PROD` / `FAQ` — os produtos (id, href, logo, visibilidade), o texto de cada aba e a ajuda; `visivel(a)` = mesma regra do menu de 9 pontinhos (Painel só ADM/quem usa).
- **Links:** `carregarLinks()`/`renderLinks()`, editor em ⚙ perfil (`htmlPerfilLinks()`, `salvarLink()`, `acaoLink()`); cache `mare_links_*`. No módulo `mare-notif-dev.js`: `linksCarregar()`/`linksLista()`/`linkLogo()` e as abas `.mn-tabs` do popover. No `painel-dev.html`: `loadPlinks()`/`savePlink()`/`removePlink()`/`movePlink()` (aba 🔗 Links do ⚙).
- **Abas:** `irAba()` (inicio/conheca/tecnica, `#conheca`/`#tecnica`); `renderTudo()` monta a grade `#tiles`, os atalhos `#atalhos` (squads do Maré + Radar) e a dica de teclas 1–9.
- `iniciarSessao()` — lê `nome/init/role/squads/apps/oceano/uid` de `kanban/usuarios/{uid}` (ramos, não o registro inteiro), cria cadastro básico se faltar, aplica prefs, `rotearHash()`.
- `prefs` / `salvarPrefs()` / `aplicarPrefs()` — tema (`data-tema`), peixinhos, ondas, `abrir`, `inicio`, `apelido`, `ultimo`; localStorage `oceano_prefs` + `kanban/usuarios/{uid}/oceano`.
- `criarPeixes()` — peixinhos/bolhas SVG; `renderTudo()`, `renderAbas()`, `renderVersoes()` (lê `version.json`).
- **Host:** `abrirApp()`, `mostrarHost()`, `fecharApp()`, `voltarLobby()`, `rotearHash()` (`#/id`), listener de `message` (`oceano:'abrir'|'lobby'`); iframes `name="oceano-frame"`.
- `abrirPerfil()`, `abrirAjuda()`, `instalar()` (`beforeinstallprompt`). `mare-notif-dev.js` v12: `APPS` ganhou `oceano` e o clique do `#mn-apps-pop` fala com o host.

## okr-apresentacao.slide.html — 🎙️ Apresentação ao vivo (2026-10-09): `liveInit()` (idempotente: `_liveIniciado`) ouve `kanban/okr/apresentacao_live`; `_liveComecar`/`_liveEncerrar`/`_livePassar`/`_livePedir`/`_liveAssumir`/`_liveFerr` (laser/caneta)/`liveAplicar(forcar)` (acompanhar; `forcar` = apresentador que recarregou retoma a posição, 1x — `_liveRetomar`)/`liveAposNavegar()` (envolve `_okrGoTo`/`_okrOpenDetail`/`_okrCloseDetail`)/`liveRender()`/`liveDesenhar()` (canvas dos traços + ponto do laser).

## okr-apresentacao.slide.html (raiz do repo, sem `-dev` — nunca teve
seção própria neste mapa até agora apesar de ~935 linhas e várias
rodadas de fix; só lê `kanban/okr/*`, exige login @ciahering normal)

Carrossel de slides "OKRs — Maré Digital" — 1 slide de capa + 1 por
gerência (grid de cards de Objetivo) + resumo — pra apresentar em tela
cheia/projetor, sempre "1 página só" (nunca scroll — encolhe por zoom
até caber, nunca corta conteúdo). Dados ao vivo via `onValue` direto em
`kanban/okr/{objetivos,marcos,tags}` + `kanban/usuarios` — qualquer
edição no painel reflete aqui sem F5 (grid de cards, não o modal de
detalhe aberto — ver nota abaixo).

- `buildSlides()` — L646 — monta a lista de slides a partir de
  `okrObjetivos` (agrupado por `areaId||'geral'`, ordenado por
  `titulo`). `startListeners()` — L1264 — os 4 listeners ao vivo, cada um
  chama `scheduleRebuild()` (debounce 150ms) → `rebuild()` — L720
  (preserva o slide atual pela `key`, não pelo índice) → `render()` —
  L724. **`?preview=<objId>`** (2026-10-01, botão "👁" do painel-dev.html
  — ver seção OKR acima) — `_previewObjId` lê o parâmetro no boot;
  `rebuild()` consome ele UMA VEZ no 1º carregamento completo
  (`window._okrOpenDetail(id)`), nunca de novo depois — senão reabriria o
  detalhe a cada atualização ao vivo, atropelando navegação real.
- **Zoom-fit ("nunca cortar, nunca scroll")** — `_zoomFitToHeight(content,
  availH)` — L621 — núcleo compartilhado: busca binária no `zoom` CSS até
  a altura renderizada (medida via `getBoundingClientRect()`, não
  `scrollHeight` — ver comentário grande na função sobre as 2 pegadinhas
  reais de `zoom` já batidas: coordenada local por dentro do zoom, e
  `width:%` compondo ao quadrado com a compensação). 2 chamadores, cada
  um encolhendo sua própria granularidade (nunca o slide inteiro de uma
  vez, senão uma seção curta encolhe à toa por causa de uma longa):
  `fitSlideContent(containerEl, contentEl)` — L856 — o carrossel de
  slides (dispara no `resize` e depois que a webfont troca de verdade,
  `document.fonts.ready`); `_okrFitDetailSections()` — L1032 — o modal de
  detalhe de 1 Objetivo (trava a divisão `.d2-body`/`.d2-footer` e dá piso
  de 30% ao rodapé). **Desde 2026-10-06 NÃO usa mais `_zoomFitToHeight`
  nas seções do detalhe**: Marcos (`.d2-table-rows`), colunas do rodapé
  (`.d2-flist`) e raia esquerda (`.d2-left`) mantêm a fonte e ROLAM
  (`overflow-y:auto`; margens automáticas nas pontas em vez de
  `justify-content:center`, que cortaria o topo). O recuo à direita do
  cabeçalho `.d2-table-header` acompanha a largura da barra de rolagem.
  O carrossel de slides continua com zoom-fit.
- **Modal de detalhe** (drill-down de 1 Objetivo) — `window._okrOpenDetail
  = id => {...}` — L777 — reescreve `#detail-modal` do zero a cada
  chamada (sem preservar zoom entre re-abertura, mas cada abertura já
  chama `_okrFitDetailSections()` de novo, então não perde o fit).
  Botão "Próximo →" (2026-09-10) usa `_okrGerenciaObjetivos(areaId)` —
  L646 — MESMO filtro+sort de `buildSlides()` (garante a mesma ordem que
  a pessoa já viu na grade), desabilitado no último Objetivo da gerência
  em vez de cruzar pra outra gerência sozinho (confirmado sem achado,
  `/monitorarbugs` 2026-09-11 — ver `SKILL.md` da skill monitorarbugs).
  (2026-09-30) `objMarcos(objId)` — L598 — único choke-point de leitura
  de marcos (status/%/tabela de detalhe passam todos por ela) — ganhou
  filtro `mostrarApresentacao!==false` (campo novo em painel-dev.html,
  ver seção OKR acima), então esconder um marco lá já reflete aqui
  sozinho. Botão "▴ Colapsar concluídos" no cabeçalho da tabela do modal
  (`window._okrToggleColapsarConcluidos()`, estado em
  `_okrColapsarConcluidos` — dura a sessão, view-only, não mexe na
  contagem de progresso) — só existe agora um `_okrDetailCurrentId`
  guardando qual Objetivo está aberto no modal (antes `_okrOpenDetail(id)`
  recebia `id` sempre por parâmetro sem persistir em lugar nenhum).
- Login: `window._okrHandleAuth = user => {...}` — L1320 — desde
  2026-09-17 (achado de análise de segurança), checa domínio OU
  `painel_viewers` (`_okrViewerKey()` — L1319, cache de 15min [reduzido
  de 24h em 2026-09-21, `/monitorarbugs` "login e segurança" — mesmo
  achado já corrigido em `kanban-dev.html`/`painel-dev.html`] +
  3 tentativas — mesmo padrão de `painel.html`
  `_finishPainelLogin()`/`_check()`) **antes** de chamar
  `_okrShowApp()` — L1291 — (mostra `#app`, chama `startListeners()`)
  — antes só checava `if(user)`, deixando `startListeners()` rodar pra
  qualquer login Google bem-sucedido e só recusando depois, se/quando
  um `onValue` batesse "permission denied". `_okrDenyAccess(msg)` —
  L1254 — usada tanto por essa checagem quanto pelo `onErr` dos 5
  listeners de `startListeners()`, erro mostra
  `#login-err`/`#login-out-btn` em vez de deixar a tela em branco.
- **📋 Anotações da reunião** (2026-09-17, pedido direto do usuário;
  2ª rodada no mesmo dia — fix real: `#notes-fab`/`#notes-ov` viraram
  sibling de `#app`/`#detail-ov` na raiz do documento, não mais filhos
  de `#app` — `#app` cria o próprio contexto de empilhamento CSS
  (`position:relative;z-index:1`), então um filho seu nunca escapava
  acima de `#detail-ov` mesmo com `z-index:450` — botão sumia/quebrava
  dentro do detalhamento do Objetivo. Visibilidade na tela de login
  agora por JS puro, `hidden` toggled em `window._okrHandleAuth()`; 3ª
  rodada — segmentação por reunião, ver abaixo) — botão flutuante abre
  um painel lateral (`#notes-ov`) de anotações ao vivo, salvas em
  `kanban/okr/reuniao_notas/{data}/{id}` (`{data}` = `_hojeStr()` — L1076
  — `YYYY-MM-DD` local, 1 reunião = 1 dia; node herda `.read`/`.write` de
  `kanban/okr` — cascata do `database.rules.json`, sem entrada própria
  necessária). Seletor `#notes-date-sel` troca a reunião sendo vista
  (`window._okrNotesSetViewDate()` — L1098, `_notasPopulateDateSel()` —
  L1075 — monta as opções a partir de `Object.keys(okrNotas)` ∪ hoje).
  Reunião que não é a de hoje abre só-leitura (`.notes-compose`
  escondido, `.notes-readonly` visível). `renderNotas()` — L1115 — lista
  cronológica do dia selecionado (mais antiga primeiro, lê como ata);
  `window._okrToggleNotes()` — L1125 — abre/fecha (sempre na reunião de
  hoje na 1ª abertura) + rola pro fim; `window._okrAddNota()` — L1137 —
  sempre grava no bucket de HOJE, Enter envia (Shift+Enter quebra linha,
  `window._okrNotesKeydown()` faz `stopPropagation()` em toda tecla pra
  não vazar pro atalho global de navegação de slides, ← → espaço).
  Exclusão (`window._okrDelNota()` — L1150) só pelo próprio autor
  (`n.autorUid===window._currentUser?.uid`) e só na reunião de hoje —
  sem papel de PO/organizador carregado nesta página, diferente do resto
  do Maré Digital, então não dá pra oferecer exclusão por admin aqui.
- **💬 Comentários do Marco** (2026-10-01, pedido direto do usuário: "o
  marco deveria ser clicável e mostrar os comentários feitos") — clicar
  numa linha de Marco (`.d2-marco-row`, dentro do modal de detalhe de um
  Objetivo) abre `#mc-ov`, painel lateral SÓ LEITURA (comentar de
  verdade continua sendo feito no modal do Marco em `painel.html`), lê
  `kanban/okr/marco_comments/{marcoId}` 1x por abertura (mesmo node que
  `_okrCommentSend()` em `painel-dev.html` grava — ver seção OKR acima).
  `window._okrOpenMarcoComments(marcoId)` — L1244 — busca `okrMarcos[marcoId]`
  pro título do painel (nunca passa o nome cru pro atributo `onclick`,
  só o id — evita quebrar o HTML se o nome tiver aspas);
  `window._okrCloseMarcoComments()` — L1275. Mesmo padrão visual/CSS de
  `#notes-ov`/`.notes-panel` (reaproveita as classes `.note-item`/
  `.note-author`/`.note-avatar`/`.note-time`/`.note-text`, classes
  próprias só pro wrapper `.mc-*`) e MESMO motivo de ficar sibling de
  `#app`/`#detail-ov` na raiz do documento (não dentro de `#app` — ver
  comentário grande em "📋 Anotações da reunião" acima sobre o contexto
  de empilhamento CSS), com `z-index:470` — acima de `#notes-ov` (460) e
  `#detail-ov` (400), já que normalmente abre com o Objetivo ainda
  detalhado por baixo. Checado no `keydown` global ANTES de `#detail-ov`
  (mesma lógica de prioridade de "painel de cima fecha primeiro").
  **2ª rodada (2026-10-01, mesmo dia, pedido direto: "o pessoal quer q
  apareça tambem a descrição do marco na apresentação")**: cada linha
  de `.d2-marco-row`, dentro de `window._okrOpenDetail()` — L1009 (a
  tabela "Marcos ou atividades macros"), ganhou uma 2ª linha opcional
  `.d2-marco-desc` com `m.descricao`, exibida só quando preenchida —
  nome e descrição agora moram juntos num `.d2-marco-main` (`flex:1`)
  pra status/prazo continuarem alinhados à 1ª linha.
- **⏱ Contagem regressiva da agenda** (2026-09-17, pedido direto do
  usuário: "quero um cronometro mostrando quanto tempo falta para a
  agenda acabar... configurável que horario começou + o horario
  programado para acabar") — relógio do topbar virou clicável
  (`#tb-clock-wrap`, `window._okrToggleAgendaCfg()` — L1205) e abre um
  popover (`#agenda-cfg-ov`) com `<input type="time">` de Início/Término
  previsto. Mesma segmentação por reunião/dia dos Anotações — grava em
  `kanban/okr/reuniao_agenda/{data}` (`window._okrAgendaSalvar()` —
  L1211 — exige os 2 campos preenchidos; `window._okrAgendaLimpar()` —
  L1220). `_okrAgendaHoje()` — L1198 — lê `okrAgendas[_hojeStr()]`;
  `_okrRenderCountdown()` — L1224 — roda dentro do MESMO `setInterval`
  de 1s que já movia o relógio (`#tb-clock`), escreve "⏳ Xmin restantes"
  (amarelo nos últimos 5min) ou "🔴 +Xmin (atrasado)" (vermelho, depois
  do horário previsto) em `#tb-countdown`; sem `fim` configurado pra
  hoje, o elemento fica `hidden`. Só `Término previsto` entra no
  cálculo — `Início` é só registro (pré-preenchido com o horário atual
  ao abrir o popover pela 1ª vez no dia). Mesmo guard de Escape de
  `#detail-ov`/`#notes-ov` no handler de teclado global, pra não vazar
  pro atalho de navegação de slides.
  Estrutura de dado deliberadamente simples (`texto`+`autorUid`+`ts` ISO
  string) — pensada pra uma evolução futura (análise estratégica da
  lista, gerar atividades) sem precisar remodelar nada agora,
  explicitamente NÃO implementada ainda (pedido do usuário: "depois
  podemos evoluir").

## functions/ (Cloud Functions — deploy manual, sempre resincronizar antes, ver `CLAUDE.md`)

### index.js — registro de exports
- `PUSH_TYPES` (allow-list de push, hoje: assigned/mention/unblocked/risk/
  recorrente/painel_broadcast/intake/okr_editado/okr_prazo/okr_reuniao/
  okr_agente/feedback/reuniao/due_today/due_overdue — os 3 do meio
  2026-09-04 (`okr/dailyScan.js`; `okr_periodo` removido em 2026-09-05
  junto com o gatilho "período de editar"), `okr_agente` 2026-09-05
  (`okr/agenteChat.js`), `feedback` 2026-09-14 (achado real — tinha o
  irmão `intake` com push mas `feedback`, criado pelo mesmo "✍️ Fale com
  o ADM", nunca tinha sido adicionado), `reuniao`/`due_today`/
  `due_overdue` 2026-09-18 (`/monitorarbugs`, técnica 1 — comparou TODOS
  os tipos de `createNotif()` contra `PUSH_TYPES`; `reuniao` tinha o
  mesmo gap do `feedback` — irmão quase idêntico `okr_reuniao` já tinha
  push, o genérico não)) — L23
- `sendPushOnNotification` — L25 (URL/tag do push em `common/pushUrl.js`: `urlDoPush()`/`tagDoPush()` — `okr_*` abre `okr.html`; `okr_mencao` entrou em `PUSH_TYPES` 2026-10-07)
- `sendPushOnMural` (`okr/pushMural.js`: `runPushMural()`/`deveReceber()`/`criaTrigger()`) — push do aviso novo do Mural, disparado por evento `tipo:'mural'` em `kanban/notif_feed/{id}`; só ADM/Geral/torre alvo, respeita Não Perturbe
- `agenteAgil` (HTTP, agente v0-v3 mais antigo) — L127 → `agente-agil/http.js`
- `spotifyOauthCallback`/`Disconnect`/`SyncNow`/`Playback`/`RadioOwnerCallback`/`RadioSearch`/`RadioSuggest` — L131–L170 → `spotify/*.js`
- `intakeSubmit` — L176 → `intake/submit.js`
- `weeklyBackup` — L181 → `backup/weeklyBackup.js`
- `okrDailyScan` — L188 → `okr/dailyScan.js` (2026-09-04, novo — ver seção `okr/` abaixo)
- `okrWeeklySnapshot` — L195 → `okr/weeklySnapshot.js` (2026-09-05, novo — Fase 3, ver seção `okr/` abaixo)
- `okrAgenteChat` — L203 → `okr/agenteChat.js` (2026-09-05, novo — chat dedicado com o Agente Ágil, `DRY_RUN_OKR_CHAT=false` desde o 1º deploy, ver seção `okr/` abaixo)
- `agenteAgilMencao` — L217 → `agente-agil-orquestrador/mentionTrigger.js` (orquestrador novo, gatilho por @menção, squad `dev`)
- `agenteAgilMencaoDados` — L228 → mesma fábrica, squad `dados`, ativado em
  escrita real 2026-08-24 (ver seção abaixo)
- `agenteAgilDueOverdueScan` — L247 → `agente-agil-orquestrador/dueOverdueTrigger.js`,
  scan diário (`onSchedule`), item 5 do roadmap — squads `dev` **e**
  `dados` (dados adicionado 2026-08-25), cobre `due_overdue` **e**
  `due_today` (nome ficou de v1, só due_overdue/squad dev — ver seção
  abaixo)
- `agenteAgilResumoMeuDia` — L258 → `agente-agil-orquestrador/resumoMeuDia.js`,
  `onRequest` (não gatilho por evento) — "🤖 Resumo do Agente Ágil"
  dentro de "Meu Dia", 2026-08-25, ver seção abaixo
- `agenteAgilIntake` — L275 → `agente-agil-orquestrador/intakeTrigger.js`,
  squad `dev`, escrita real desde 2026-08-27 (rodou em modo sombra do 1º
  deploy até essa decisão) — 2º gatilho automático do orquestrador, escuta
  `agente_intake_pending/{id}` (ver `agente-agil/http.js` abaixo pro
  porquê de existir)
- `agenteAgilAnaliseDados` — L288 → `agente-agil-orquestrador/analiseDados.js`,
  `onRequest` (não gatilho por evento) — "🤖 Ponto de vista do Agente
  Ágil" dentro dos painéis "Dados do Board"/"Controle de Criativos",
  2026-09-01, ver seção abaixo
- `agenteAgilAnalisePO` — L301 → `agente-agil-orquestrador/analisePO.js`,
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
- `mentionTrigger.js` — `createMentionTrigger({squadId, dryRun})` (L131)
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
  **`entry.htmlAnexo` — report diário via card recorrente (2026-09-28,
  pedido direto)**: quando o especialista manda um relatório HTML pronto
  (`schema.js:htmlAnexo` — `{html, titulo}`, campo separado de `texto`
  porque um relatório real passa longe do limite de 20.000 caracteres —
  o exemplo usado no comentário de `outputs/relatorioHtml.js` tem
  ~940KB), `processarIntake()` hospeda ele DETERMINISTICAMENTE
  (reaproveita `buildWritePlan`/`applyWritePlan` de `board.js` direto,
  igual `http.js` fazia antes da correção de arquitetura de
  2026-08-27) ANTES de montar a tarefa do LLM — decisão explícita do
  usuário (AskUserQuestion): o HTML bruto nunca passa pelo prompt do
  modelo, só o link final já pronto entra no `task` (`contextoRelatorio`).
  Só roda quando `cardId` resolveu pra um card real — sem card,
  `relatorioSemCardAviso` avisa o modelo (e por tabela
  `notificarFalhaSemCard()`) que chegou um relatório sem onde anexar.
  `uploadAndSign`/`reportBasePath` injetáveis em `processarIntake()` só
  pra teste (mesmo padrão de `buildWritePlan`).
  **Espelho em "📊 Central de Dados" (2026-09-28, pedido direto)**: quando
  o `htmlAnexo` vem do recorrente `relatorio_diario` especificamente
  (`entry.referencia.nome`, guardado a partir de `http.js` agora —
  antes só o `cardId` já resolvido sobrevivia até aqui), o link também é
  espelhado via `update()` (nunca `set()`) em
  `kanban/dados_diarios_dev/{data}` — é o node que `painel-dev.html`
  (`renderDadosHistorico()`, ver seção `painel.html` abaixo) já usa pro
  post manual diário de captação; o botão "🤖 Relatório" aparece sozinho
  no Histórico, sem ninguém colar link. `_dev` fixo de propósito por ora
  (mecanismo ainda em validação, squad `dev`) — vai precisar virar
  configurável quando for pra produção de verdade. Também mostrado no
  drawer "📊 Dados" do próprio board (`_renderDadosDay()`/
  `_renderDadosDayCompact()`, kanban-dev.html) — esse drawer lê
  `kanban/dados_diarios` SEM sufixo (compartilhado de propósito entre
  kanban.html/kanban-dev.html, diferente de painel), então só mostra de
  verdade quando o mecanismo for pra produção.
  **`entry.dadosDiarios` (2026-09-28, mesmo pedido, números de
  captação)**: `schema.js:dadosDiariosPayload` — `{data, capDia,
  metaDia, capAcum, metaAcum, lyAcumPct, metaAmanha, texto}` — DIFERENTE
  de `htmlAnexo`: independente de `cardId`/`referencia`, processado logo
  no início de `processarIntake()` (funciona mesmo sem nenhum card
  resolvido, ao contrário do link do relatório, que precisa de um card
  real pra anexar). Mesmo espelho `update()` em
  `kanban/dados_diarios_dev/{entry.dadosDiarios.data}`.
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
  squadId)` — L112 — squad-agnóstica, reusa a mesma rota da @menção
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
  sem nenhuma ferramenta de ação). `sinaisDoCard()` — L87 — pura — e
  `collectPendingCards()` — L115 calculam os sinais objetivos (atrasado,
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
  `gerarAnaliseDados()` — lógica pura testável (llmClient injetado).
  Desde 2026-09-11, o `resumo` do contexto `board_insights` também
  carrega `cfd`/`burndown` (`window._cfdResumo`/`window._burndownResumo`
  em `kanban-dev.html`, montados por `_pedirAnaliseBoardInsights()`) —
  `CONTEXTOS.board_insights.prompt` instrui explicitamente "SEMPRE
  comente CFD e Burndown", não só considerar em silêncio.
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
  não lidos mais aqui. `schema.js:htmlAnexo` (2026-09-28, report diário
  via card recorrente) — `{html, titulo}` opcional, `http.js` só repassa
  pra fila sem olhar o conteúdo; quem hospeda (fora do LLM) é
  `intakeTrigger.js`, ver seção do orquestrador acima.
- `board.js` — `resolveActor(especialistaId)`/`ctx.actor` (2026-08-25): identidade
  (`uid`/`author`/`who`/`init`) creditada em todo output. `init` (🤖 padrão/🔌
  especialista) só passou a ser PROPAGADO nos pushes de `card.history[]`
  (`outputs/agentStatus.js`/`checklistItem.js`/`editarCampos.js`/
  `moverColuna.js`) em 2026-09-06 — ver seção "Card — estrutura & modal"
  acima (avatar do histórico do card) pro achado que motivou isso. Achado
  real: antes,
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
- `board.js` — `isValidFirebaseKey(id)` (2026-09-29, `/monitorarbugs`,
  "área sensível e bastante utilizada"): `especialista` chega como texto
  livre de fora (envelope HTTP em `http.js`, ou escolhido pelo LLM em
  `notificar_especialista_externo` a partir do histórico do card) e 2
  lugares montavam `kanban/config/agentesExternos/{especialista}` direto
  com esse valor — chaves do RTDB não podem conter `.`/`#`/`$`/`[`/`]`,
  `db.ref()` real lança exceção SÍNCRONA nesse caso (confirmado contra o
  validador do `@firebase/database-compat` que `firebase-admin` usa por
  baixo — `makeFakeDb()` dos testes não reproduz essa validação). Um
  `especialista` plausível como `"databricks.ai"` derrubava
  `lerDescricaoEspecialista()` (`intakeTrigger.js`) ANTES do try/catch que
  `runLoop()` já tem — item ficava travado pra sempre em `status:'pending'`
  sem nenhum sinal de falha. Mesmo padrão em `tools/notificarEspecialistaExterno.js`
  (quebrava a própria promessa do comentário do arquivo, "NUNCA lança
  exceção pro loop acima"). Fix nos 2: `isValidFirebaseKey()` antes de
  montar o `ref()`, trata como especialista desconhecido/erro próprio em
  vez de deixar o pedido inteiro cair em silêncio. Lado de ESCRITA
  (`criarAgenteExternoPainel()`, painel-dev.html) já reverte a UI otimista
  quando `window._set()` rejeita (achado anterior, 2026-09-01) — isso aqui
  protege o lado de LEITURA, onde não existe promise nenhuma pra rejeitar.
- `outputs/sanitizeAgentText.js` — `sanitizeAgentText()` (2026-09-28,
  achado real no canário do `htmlAnexo`): o modelo vazou um fragmento de
  fechamento de tag alucinado (`</texto>\n</invoke>`) no fim de um
  comentário mais longo/complexo — corta com segurança qualquer sequência
  de tags de fechamento soltas no FIM do texto (nunca no meio). Usado nos
  3 campos de texto livre que vão direto pro board sem vocabulário fixo:
  `outputs/comentario.js` (`texto`), `outputs/risco.js` (`texto`),
  `outputs/editarCampos.js` (`desc`).

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
  `listar_objetivos`/`ler_objetivo` (leitura), `criar_objetivo` (ADM, ou
  PO/Organizador/🎯 Gestor OKR na própria torre — `canCreateObjetivo()`),
  `editar_campos_okr`/`criar_marco`/`editar_marco` (ADM, Responsável ou
  PO/Organizador/Gestor OKR da torre do Objetivo, via
  `agenteHelpers.canEditObjetivo()`), `responder` (sempre a
  última ferramenta chamada).
  **🏛️ Torres/gerências/agenda (2026-10-07, `agenteTorres.test.js`)**: `torre` em
  `listar_objetivos`/`resumo_atingimentos`/`criar_objetivo`; `area_id` virou string livre
  validada contra as gerências DA TORRE (`gerenciasDeCfg()`, `gerencia_invalida`/`gerencia_oculta`);
  `listar_gerencias`; `listar_agenda` (SÓ LEITURA do calendário — usa `calendario.js`
  `ocorrencias()`/`abrange()`/`recTexto()`; filtros torre/`global`/Objetivo/`evento_id`); escrita
  respeita a 🔒 trava (`travaDeOutro()`/`msgTrava()`); `criar_objetivo` e `editar_marco`→concluído
  publicam no 🔔 feed da torre (`publicaFeed()` → `kanban/notif_feed`, autor `agente-agil`). Campos de lista (Indicadores/Progressos/
  Próximos Passos/Riscos/Planos de Ação) só SOMAM, nunca substituem.
  **📈 Atingimento (2026-10-05)**: `resumo_atingimentos` (leitura geral, filtro
  por gerência e `sem_registro_ha_dias`), `registrar_atingimento` (transação
  sobre `…/atingimento/lancamentos`), `configurar_atingimento` (`update()`,
  nunca apaga registros; trocar tipo com registros exige
  `confirmar_recalculo`); `ler_objetivo`/`listar_objetivos` trazem
  `progresso_pct`/`progresso_origem`/`atingimento`. Motor de cálculo em
  `okr/atingimento.js` — bloco `ATING-ENGINE` é CÓPIA LITERAL de
  `painel-dev.html`/`painel.html` (testado em `atingimento.test.js`); helpers
  só do servidor fora do bloco (`resumoAtingimento()`/`progressoDoObjetivo()`/
  `lancamentosDe()`). `weeklySnapshot.js` usa o mesmo `progressoDoObjetivo()`.
  `resolveMarco()` exportado (resolve por id ou nome dentro do Objetivo,
  erro `marco_ambiguo` se mais de 1 bater). `okr/__tests__/agenteTools.test.js`,
  20 casos.
- `okr/agenteHelpers.js` — `isAdmUid()`/`canEditObjetivo()`/`canCreateObjetivo()`/
  `torreParaCriar()`/`infoUsuario()` (mesma regra POR TORRE de `_okrCanEdit()`/`_okrCanCreate()`
  em `okr-dev.html`, replicada servidor-side: ADM → tudo; PO/Organizador/Gestor OKR só na própria
  torre, ⭐ Geral em todas; Responsável sempre), `TORRES`/`torreDe()`/`GERENCIAS_PADRAO`/`gerenciasDeCfg()`/
  `rotuloGerencia()` (espelho de `_okrGerenciasBase()`), `travaDeOutro()`, `publicaFeed()`, `resolveObjetivo()` (por id ou título, só
  aceita título ambíguo se achar exatamente 1 match — exato antes de
  parcial), `pushHistory()` (mesmo formato `{who,uid,what,tipo,at}` que
  `painel.html` já grava pra edição humana, cap de 80 entradas),
  `notifyObjetivoEditado()` (achado real de `/monitorarbugs`,
  2026-09-05: notifica `responsaveis`/participantes de Marco quando o
  chat edita um Objetivo — mesma coisa que `_okrNotifyEditado()` no
  painel já fazia pra edição manual, `type:'okr_editado'`, exclui quem
  editou). Chamada pelos 3 handlers de escrita de `agenteTools.js`
  (`editar_campos_okr`/`criar_marco`/`editar_marco`).
- `okr/agentePrompt.js` — `SYSTEM_PROMPT_OKR_V1` (ganhou, em 2026-10-07, o bloco "Torres, gerências e agenda": torre do Objetivo, `geral` ambíguo entre torres, permissão por torre, 🔒 trava, sino, calendário só-leitura), separado do prompt do
  orquestrador de card (`agente-agil-orquestrador/systemPrompt.js`). Foco
  em TRADUZIR texto corrido pra Progresso/Próximo Passo/Risco, não só
  repetir — e sempre terminar chamando `responder`.

### spotify/ — PAUSADO (2026-08-04)
"Ouvindo agora" (presença ao vivo, opt-in) + "Rádio do Maré" (playlist
colaborativa). Completo e validado em produção, mas o sync periódico
(`spotify/sync.js`, `spotifySync`) era a única function agendada de todo o
projeto — rodava 24h/dia mesmo sem ninguém conectado — e custou mais do que
o esperado. Pausado desligando só essa function (linha comentada em
`functions/index.js`, L148) e escondendo a aba `#spotify-tab` no board.
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

### painel — consumo de banda (cards incrementais, `usuarios` sob demanda) — v3.93
Causa do pico de ~8 GB de download em 2026-10-01 e a correção. Linhas: re-`grep` o nome.
- `_fetchSquadDados()` / `_pollSquadDados(sqId, full)` — `painel-dev.html` L~11580 — busca por squad só os filhos de `dados` que `_applySquadDados()` usa (`_SQUAD_LEAF_PATHS`) e os cards de forma INCREMENTAL.
- `_fetchCardsFull()` / `_fetchCardsDelta()` — lê `cards_index` + `cards_updated_at` (índices leves, mesmo par do kanban/Cloud Functions) e baixa só os cards cujo timestamp mudou; qualquer inconsistência lança erro e cai no completo. Squad com card sem id/índice vira `_cardsNoDelta` (sempre completo).
- `_ccDb()` / `_ccLoad()` / `_ccSaveSoon()` / `_ccClearAll()` — cache de cards em IndexedDB (`painel_cards_cache` v2, chave `databaseURL|uid|squad`, limpo no `auth-change` null); recarga de segurança após `_CC_MAX_AGE_MS` (3 dias). `loadAll(true)` / `window._painelFullRefresh()` / Shift+clique em 🔄 ignoram o cache.
- `_SQUAD_REFRESH_MIN_MS` — volta pra aba só refaz o fetch de uma squad se o último foi há ≥ 5 min.
- `loadGlobalUsers(force)` / `_guRefreshSoon()` / `_guWrapWrites()` — `kanban/usuarios` deixou de ser `onValue`: leitura sob demanda com TTL 10 min; `_set`/`_update` em campos do perfil (regex `_GU_FIELD_RE`) agendam releitura.
- `loadStatusData(force)` — "Peso por squad" em cache de 6 h (`_stPesoLoad/_stPesoSave`).
- Telemetria: `poll:squads/<id>/dados` = completo, `...(delta)` = incremental. Diagnóstico hora a hora: ler `kanban/squads/<id>/dados/_debug_bytes_log` (atenção ao `/dados/` no caminho) e `kanban/painel/_debug_bytes_log`.

### Segurança — handlers inline, identidade do rate limit, redirect (2026-10-05)
- `jsq(x)` — `kanban-dev.html`/`painel-dev.html` (junto de `esc()`), `okr-apresentacao.slide.html`, `onboarding.slide.html` (helper próprio) — argumento STRING seguro pra `on*="f(${jsq(x)})"`. **Nunca** `on*="f('${esc(x)}')"` nem `'${x}'`: `esc()` vira `&#39;`, que o navegador decodifica antes de o JS do atributo rodar (XSS armazenado via id).
- `clientIp(req)` / `isPrivateIp()` — `functions/common/clientIp.js` — chave de rate limit de endpoint HTTP público (usada por `intakeSubmit` e `agenteAgil`). Ignora `fastly-client-ip`, usa a entrada mais à direita de `x-forwarded-for`.
- `functions/rules/rulesSim.js` + `functions/rules/__tests__/databaseRules.test.js` — simulador de `database.rules.json` (o projeto não tem emulador) e matriz ator × operação (`npm test`). Mudou as regras? Rode antes de pedir o `firebase deploy --only database`.
- `isAllowedReturnUrl(u)` — `functions/spotify/_shared.js` — destino do redirect do `spotifyOauthCallback` (só o próprio site).

### 💬 Indicador de comentários na face do card (2026-10-05)
- `_commentIndHtml(n)` / `_refreshCommentInd(cardId)` / `window._commentCounts` — `kanban-dev.html` (logo antes de `makeCardEl()`) — desenha/atualiza o 💬 na linha `.card-indicators`; contagem vem de `card_comments_count/{cardId}` (listener junto de `_uaRef`, `_onComCount`). Rede de segurança em `loadComments()`: corrige o índice se divergir da lista real.
- `contarComentarios` / `recalcularContagem()` — `functions/comentarios/contagem.js` — gatilho que mantém o índice (cobre cliente + Agente Ágil + importação). Deploy: `firebase deploy --only functions:contarComentarios`.

**2026-10-07 (noite, 2º lote)**: +3 slides — 🔒 trava de edição, 📅 Calendário do OKR e 👥 pauta/convidados/anotações; prints da home/Gerências/lista (cabeçalho em níveis)/Mural/sino (com rodapé) REFEITOS (🛒/🌐); textos "no Painel" → "no OKR"; Permissões ganhou 3 linhas e a classe `.cmp.compact` (padding menor — a tabela de 13 linhas não cabia em 1366×768). O overlay `#fsOverlay` ("Pressione F") é do GUIA — nunca colocar nele texto da apresentação. Prints: harness Playwright com Firebase fake (ver `CHANGELOG.md`).

#### 📊 Dados do Board — layout (2026-10-06, kanban-dev v8.30.791)
Popup `#boarddata-ov` até 1500px; barra única `#boarddata-colbar-chips` (`_bdRenderColBar()`/`_bdColToggleChips()`, classes `.bd-chip`/`.bd-colbar`) valendo pras 3 abas
(`_bdToggleCol()`); cartões `.bd-grid2`/`.bd-card`. Gráficos medem o container via `_bdChartW(el,min)` (barras/tendência/CFD/burndown) e redesenham no `resize` (`_bdResizeT`);
`openBoardData()` abre o overlay ANTES de desenhar (largura 0 se fechado).

### 💡 Dicas (mini popups) — `mare-dicas-dev.js` (módulo compartilhado, v2.59/8.30.813/1.6 dev)
Raiz do domínio, como `mare-notif-dev.js`. API `window.MareDicas`: `init({app,nome,user,isViewer,dicas,abrirAjuda})`, `gatilho(nome)`, `controle(elemento)` (interruptor + "Rever dicas"), `definir(bool)`, `reiniciar()`, `fechar()`, `_estado()`. Internos: `proxima(g, checaQuando)` (o `quando` só vale na hora de MOSTRAR), `mostra(d)` (marca vista ao aparecer), prefs em `kanban/usuarios/{uid}/dicas` + localStorage `mare_dicas_{uid}`.
**Marcador `edita`** (v2.60): dica que manda editar/criar (6 no Radar) é filtrada em `init()` quando `isViewer` (externo só acompanha). **`controle(el)`** desenha UMA vez e só sincroniza o `checked` (foco do teclado), 1 ouvinte por elemento (`el._mdicaOuv`), `avisa()` poda ouvinte que devolve `false`. Oceano: dicas de entrada com `_lobbyVisivel()`. `renderHelp()` (kanban) ordena título-antes-de-texto na busca. **Catálogo centralizado (painel-dev v5.34):** `CATALOGO` no módulo (dados puros por app: `dicas[{id,gatilho,texto,saiba,ajuda}]`, `gatilhos` = rótulos legíveis); `MareDicas.catalogo()` + `MareDicas.minhasPrefs(user)` alimentam a aba **💡 Dicas** do Painel (`renderPcfgDicas()`, `setPcfgTab('dicas')`, `#painel-cfg-dicas`). Ganchos por página (só o que depende do estado): `OKR_DICAS_QUANDO`/`_okrDicasIniciar()` (okr-dev; gatilhos em `_okrSetView()` `view:<aba>`, `openOkrObjetivo` `obj-modal`; controle em `#okr-help-dicas`); `MARE_DICAS_QUANDO`/`_mareDicasIniciar()` (kanban-dev, antes de `loadNotifs()`; gatilhos em `openCard()`/`openCfg()`; controle em `#help-dicas-ctl`); `OCEANO_DICAS_QUANDO`/`iniciarDicas()` (oceano-dev; gatilhos `sino` em `sinoToggle()`, `perfil` em `abrirPerfil()`; controle em `#pf-dicas`). Painel e A Bordo não mostram dicas. Teste: `docs/arezzo/testes/test_dicas.js`.

*Retrato do commit `32abbd5` (2026-10-07); seções `okr-dev.html`, `okr-apresentacao.slide.html` e `functions/okr/` revalidadas em 2026-10-07 (okr-dev v2.33, Agente Ágil por torre). As demais seções seguem o retrato de `6e30656` (2026-09-30).*
