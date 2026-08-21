# Changelog

Registro de mudanças do Maré Digital e demais ferramentas deste repositório,
organizado por página e versão (ver `version.json`). Cada entrada linka o PR
correspondente — `git diff <tag-antiga> <tag-nova>` mostra o diff exato do
que foi ao ar entre duas versões.

**Convenção de tags:** `kanban-vX.Y.Z` (produção), `kanban_dev-vX.Y.Z-dev`
(ambiente de teste), `painel-vX.Y`, `painel_dev-vX.Y-dev` — sempre no commit
de merge que efetivamente publicou aquela versão (o merge pra `main`, já
que o deploy do GitHub Pages roda automaticamente a partir daí). Ver seção
"Processo de release" no `CLAUDE.md` para o fluxo completo.

Este arquivo passou a ser mantido em 2026-07-24; histórico anterior a essa
data existe no `git log` mas não foi documentado retroativamente aqui (ver
`git log -- kanban.html` / `git log -- painel.html` etc. pro histórico
completo, incluindo commits antigos sem PR/descrição detalhada).

## kanban.html (produção)

### v8.30.258 — 2026-08-20 · promove pra prod
Promove pra produção o lote acumulado em dev desde a v8.30.257
(v8.30.449-dev), validado em dev.

- **Segurança: fecha escalação de privilégio na whitelist de externos**.
  Achado numa revisão de segurança pra internalização do projeto: a
  whitelist de colaboradores externos (não-`@ciahering.com.br`,
  autorizados por squad em Configurações) só era checada em JavaScript
  na tela de login — qualquer conta Google conseguia se auto-conceder
  acesso de leitura/escrita a um squad inteiro, contornando essa
  checagem direto via console do navegador. A regra do Firebase
  (`database.rules.json`, deploy manual, já em produção desde antes
  desta promoção do HTML) agora valida a whitelist de verdade; esta
  promoção leva o código do board a gravar a whitelist no formato que
  a regra nova exige (chave = email, não mais aleatória). Nenhum
  externo/membro existente perdeu acesso — não havia nenhum externo
  cadastrado no momento do fix.

- **Busca geral: "Ver N cards no board"**: botão logo abaixo dos
  resultados da busca (🔍/Ctrl+K) aplica o mesmo termo como filtro de
  texto do board, mostrando todos os cards que batem dispostos no board
  em vez de escolher um da lista. O filtro de texto também ganhou campo
  próprio na barra de Filtros, usável direto por lá.
- **Agente Ágil: modo autônomo nas Automações**: a ação "Notificar
  Agente Ágil" ganhou a opção "🤖 Modo autônomo" (squad `dev`) — em vez
  de abrir o painel local, escreve um comentário de verdade que aciona o
  orquestrador automaticamente, entrando no mesmo fluxo já validado da
  @menção. Validado em produção com um disparo real.
- **Supercards/cards filhos — 3 bugs corrigidos**: título de um card
  filho não deixava mais editar manualmente (voltava sozinho pro
  formato automático a cada mudança na Ficha Técnica); um Objetivo
  nunca marcado podia aparecer no título automático (mesma causa); busca
  de "card existente pra virar filho" disparava com 1 caractere só,
  mostrando resultados sem nexo aparente — agora exige 2+.

### v8.30.256 — 2026-08-20 · promove pra prod
Promove pra produção o lote acumulado em dev desde a v8.30.255
(v8.30.440-dev → v8.30.444-dev), validado em dev.

- **Checklist: opção de recolher cada checklist do card**: card com mais
  de um checklist ganhou um botão ▾/▸ no cabeçalho de cada um pra
  recolher só os itens (a barra de progresso continua visível mesmo
  recolhido). O estado fica salvo junto com o card.
- **Card travado: links e menções de card voltam a ficar clicáveis**:
  quando outra pessoa está editando um card, os links (descrição/
  comentário/checklist) e as menções a outro card agora funcionam
  normalmente — só a edição continua bloqueada. Antes, o modo leitura
  travava tudo, inclusive links.
- **Card travado: botão "🔔 Pedir o card"**: quem só precisa dar uma
  olhada num card enquanto outra pessoa edita agora pode "pedir" o card.
  Quem está editando recebe um aviso com 5 minutos pra salvar e sair (ou
  liberar na hora); se não fizer nada, o card salva e libera sozinho no
  prazo. O card de quem pediu atualiza automaticamente assim que o lock
  é liberado, sem precisar reabrir.
- **Notificações: fim das duplicatas e das menções ressuscitadas**:
  "Prazo hoje!"/"Prazo atrasado!" não duplicam mais quando várias abas
  reavaliam quase juntas (ex.: reload simultâneo de atualização). E uma
  @menção que a pessoa já viu e leu não volta mais a aparecer como não
  lida alguns dias depois.

### v8.30.255 — 2026-08-19 · promove pra prod
Promove pra produção o lote acumulado em dev desde a v8.30.254
(v8.30.438-dev → v8.30.439-dev), validado em dev.

- **Modelo (📋) passa a salvar e aplicar a Ficha Técnica**: quando um
  card com a Ficha Técnica preenchida é salvo como modelo, essa
  informação (Campanha/Funil/Etapa/Canal/Objetivo/Plataforma/Tipo/
  Formato/Variações/Direcional) vai junto. Ao usar o modelo — criando
  um card novo ou aplicando num card já aberto — a Ficha Técnica do
  modelo é aplicada seguindo a mesma regra de sempre: só entra onde o
  card ainda está vazio, nunca sobrescreve o que a pessoa já tinha
  preenchido. Editar um modelo existente (✏️) também passou a
  mostrar/salvar a Ficha Técnica normalmente.

### v8.30.254 — 2026-08-19 · promove pra prod
Promove pra produção o lote acumulado em dev desde a v8.30.253
(v8.30.434-dev → v8.30.437-dev), validado em dev.

- **Iniciais duplicadas passam a ser checadas no board inteiro, não só
  por squad**: bug real (duas pessoas diferentes com a mesma sigla em
  squads diferentes misturavam cards uma na outra em "Meu Dia") — agora
  o cadastro/confirmação/edição de iniciais checa conflito contra
  TODOS os squads, não só o atual.
- **Filtro por nome/tag no botão "📥 Usar modelo"**: achar o modelo
  certo numa lista grande, dentro do card já aberto, agora tem busca por
  nome + select de tag, combináveis — mesmo padrão de filtro já usado no
  drawer de Modelos.
- **Menção de card (@card:) na caixa de comentário volta a funcionar**:
  bug reportado por usuária real (clicava no card certo e nada era
  inserido) — a caixa de comentário usava uma implementação de menção
  separada e mais frágil que o resto do app; migrada pro mesmo sistema
  robusto de descrição/PO/campanhas. Bônus: comentário ganha
  autocomplete de @pessoa de graça.
- **Ficha Técnica compartilhada entre supercard e cards filhos**: dentro
  de uma campanha, Campanha/Funil/Etapa do Funil/Canal não mudam entre
  os cards filhos — agora esses 4 campos aparecem no supercard e
  propagam automaticamente pra cada filho (só preenchendo quem ainda
  está vazio, nunca sobrescrevendo dado que o filho já tinha). No card
  filho, esses 4 campos somem da Ficha (vêm herdados, com nota linkando
  de volta pro supercard) — só os campos que variam por peça continuam
  editáveis ali.

### v8.30.253 — 2026-08-17 · promove pra prod
Promove pra produção o lote acumulado em dev desde a v8.30.252
(v8.30.431-dev → v8.30.433-dev), validado em dev.

- **Ficha Técnica: "Outros" vira o texto especificado**: quando alguém
  escolhe "Outros" em Canal, Objetivo, Plataforma ou Tipo e preenche o
  campo "Qual?", esse texto passa a aparecer no lugar de "Outros" no
  título do card, na tabela do Controle de Criativos, nos gráficos do
  Dashboard e na exportação CSV. Tipo ganhou o campo "Qual?" que ainda
  não tinha.
- **Filtro de coluna em Dados do Board agora vale em Insights e CFD &
  Burndown**: a coluna que você tira da conta na aba Visão Geral (chips
  "📍 Colunas na conta") agora também sai dos números de Insights e do
  escopo de CFD/Burndown — os mesmos chips aparecem nas 3 abas.

### v8.30.252 — 2026-08-17 · promove pra prod
Promove pra produção o lote acumulado em dev desde a v8.30.251
(v8.30.430-dev), validado em dev.

- **Ctrl+S salva o card aberto na hora**: com um card aberto, Ctrl+S (ou
  Cmd+S no Mac) salva imediatamente, sem esperar o autosave automático.
- **Badge 📎 na visão board**: cards com pelo menos um link/anexo salvo
  ganham um indicador 📎 visível direto na lista, sem precisar abrir o
  card.
- **Filtro "Criado por"**: novo filtro na barra de Filtros pra achar
  rápido os cards criados por uma pessoa específica.
- **Filtro de coluna em 📊 Dados do Board**: dá pra tirar (e trazer de
  volta) uma coluna específica da conta de todos os indicadores da
  Visão Geral (WIP, Throughput, bloqueios etc.) — útil pra squads que
  têm colunas tipo Backlog/Arquivo que não deveriam entrar nas métricas
  de fluxo.

### v8.30.251 — 2026-08-15 · promove pra prod
Promove pra produção o lote acumulado em dev desde a v8.30.250
(v8.30.427-dev → v8.30.429-dev), validado em dev.

- **Auto-scroll de coluna durante drag-and-drop**: arrastar um card pra
  reordenar dentro de uma coluna mais longa que a tela agora rola a
  coluna sozinha ao chegar perto da borda superior/inferior visível —
  antes era preciso soltar o card, rolar na mão, pegar o drag de novo,
  repetir.
- **Agente Ágil passa a respeitar Prazo/Submarca/Ficha Técnica
  obrigatórios**: as mesmas regras de campo obrigatório que a tela de
  criar/editar card já aplica agora valem também quando o Agente Ágil
  cria um card ou limpa um prazo — squads que usam Submarca ou Ficha
  Técnica não ficam mais com cards incompletos criados pelo agente.
- **Agente Ágil aparece no autocomplete de @menção**: digitar "@a" num
  comentário agora sugere "Agente Ágil" como opção (nos squads onde o
  gatilho automático existe), então não é mais preciso lembrar de cor
  como chamar o agente.

### v8.30.250 — 2026-08-14 · promove pra prod
Promove pra produção o único achado da rotina de otimização (PR #375,
kanban-dev v8.30.426-dev): um `<link rel="preconnect">` órfão pro
`www.gstatic.com` no `<head>`, que ficou desatualizado desde que o SDK
do Firebase foi vendorizado localmente (v8.30.412-dev) — não há mais
chamada de runtime pra esse domínio. Removida a linha e corrigido o
comentário que ainda dizia o contrário. Puramente rede/documentação,
sem mudança de comportamento visível.

### v8.30.249 — 2026-08-14 · promove pra prod
Promove pra produção o investimento em custo de Firebase feito em dev
(v8.30.424-dev → v8.30.425-dev) — motivado pela cobrança que passa a
valer em 01/09.

- **Fase 1 — piso absoluto no fallback de carregamento de cards**: o
  carregamento em duas etapas caía no fallback completo (listener bruto
  em `/cards` inteiro, sem filtro de arquivados, somando banda a cada
  mudança de QUALQUER pessoa dali em diante) sempre que a proporção de
  cards a rebuscar passava de 40% do total ativo — mas squads pequenos
  caíam nisso repetidas vezes só pela proporção, mesmo com um número
  absoluto de cards baixo. Agora o limite usa o MAIOR valor entre a
  proporção de 40% e um piso absoluto de 150 cards a rebuscar; squads
  grandes não mudam de comportamento. Esta promoção também força (via
  auto-update) um reload em toda sessão aberta, reavaliando essa decisão
  do zero pra sessões que ficaram presas no fallback há dias.
- **Fase 2 — 📋 Modelos sob demanda**: o nó `ql_items` (Recorrentes,
  Agendamentos e Modelos) carregava tudo de uma vez, sempre, mesmo em
  squads com biblioteca grande de Modelos que quase ninguém abre.
  Recorrentes/Agendamentos continuam carregando sempre (o board precisa
  deles sozinho pra conferir itens vencidos); Modelos passa a carregar
  só quando a sessão realmente usa (drawer de Modelos, "Usar modelo" num
  card, salvar como modelo, aba Automações, backup manual).

### v8.30.248 — 2026-08-13 · promove pra prod
Promove pra produção todo o lote acumulado em dev desde a v8.30.247
(v8.30.422-dev → v8.30.423-dev), validado em dev.

- **Filtros no Dashboard do Controle de Criativos**: Tag, Responsável,
  Demandante, Coluna, Prioridade e Período livre (Prazo ou Criação, com
  De/Até) — antes só a aba Lista tinha filtros. Todos os gráficos/cards
  de resumo recalculam sobre o resultado filtrado.
- **Ficha Técnica**: nova opção "Mktpace" no Canal, "Impresso" no
  Formato; Objetivo e Plataforma ganham campo "Qual?" quando "Outros" é
  marcado (mesma mecânica que já existia só no Canal).
- **Fix: card concluído aparecendo como atrasado no "Meu Dia"** — a
  checagem de "coluna é fim" pra cards de outros squads agora usa a
  config de fim (`doneCols`) daquele squad quando existe, em vez de só
  adivinhar pelo nome da coluna.

### v8.30.247 — 2026-08-12 · promove pra prod
Promove pra produção todo o lote acumulado em dev desde a v8.30.246
(v8.30.414-dev → v8.30.421-dev), validado em dev.

- **Botão "🪄 Gerar título"**: monta o título a partir da Ficha Técnica
  sob demanda em qualquer card, a qualquer momento — não só em cards
  novos criados via Modelo (que já ganhavam o título automático sozinho).
- **Total de variações no dashboard**: o painel "🎬 Controle de
  Criativos" ganhou um card de estatística somando a quantidade total
  de variações marcadas nos cards do squad.
- **Nova ordenação Alfabética (A → Z)**: mais uma opção no botão ↕
  Ordenação (geral e por coluna), ordenando pelo título do card.
- **Proteção da descrição em cards com Demandante**: card com o campo
  Demandante preenchido trava a descrição principal pra quem não é
  ADM/PO/Organizador — a caixa nem abre pra edição (treme se alguém
  tentar), evitando apagar ou substituir por engano o conteúdo de quem
  pediu o card. Complementar continua livre pra qualquer um via
  "Descrições adicionais". (Passou por duas rodadas de correção em dev
  depois de bypasses encontrados em teste real — ver entradas de
  v8.30.416 a v8.30.418-dev pro histórico completo.)
- **🧯 Restaurar backup**: nova seção em Config → Backup, restrita a
  ADM/PO/Organizador — sobe um arquivo de backup (ou escolhe um
  snapshot do histórico) e traz os dados de volta. "🔍 Comparar com o
  board atual" lista só os cards que sumiram desde aquele backup (sem
  mexer no que foi arquivado/excluído de propósito), com restauração
  individual ou em lote; "🧯 Restaurar TUDO" substitui o board inteiro,
  pra cenários mais graves. Salva automaticamente um snapshot de
  segurança do estado atual antes de qualquer restauração.
- **Backup automático semanal**: nova Cloud Function (`weeklyBackup`,
  deploy separado) salva um snapshot de cada squad no Cloud Storage
  todo domingo às 04:00, sem depender de ninguém abrir o board —
  reforça a rede de segurança dos dados.
- **Central de Ajuda atualizada**: sincronizada com todas as features
  acima (campo Demandante nunca tinha entrada própria; Backup, Ficha
  Técnica e Ordenação estavam desatualizadas).

### v8.30.246 — 2026-08-12 · promove pra prod
Promove pra produção todo o lote acumulado em dev desde a v8.30.245
(v8.30.410-dev → v8.30.413-dev), validado em dev.

- **Título automático da Ficha Técnica, ajustes de formato**: colchetes
  literais isolando Plataforma e Objetivo do resto do título
  (`[Plataforma] Tipo - Campanha [Objetivo] - Etapa/Funil`); Formato
  trocado por Tipo — pedidos diretos do time depois do primeiro teste.
- **Restrito a cards novos via Modelo**: o título só se monta sozinho
  quando o card nasce de um item de 📐 Modelos — cards em branco e
  cards já existentes mantêm o título 100% manual, como sempre
  (pedido direto).
- **SDK do Firebase vendorizado**: sai do `gstatic.com`, passa a ser
  servido do próprio domínio (`vendor/firebase-10.14.1/`) —
  investigação de um `query is not defined` reportado por uma pessoa
  atrás de VPN corporativa com inspeção SSL (FortiGate); reduz
  dependência de CDN de terceiros pra todo mundo, independente da
  causa raiz específica desse caso não ter sido 100% fechada (o
  fallback da v8.30.245 já cobria o caso, esta entrada só troca a
  origem do arquivo).

### v8.30.245 — 2026-08-12 · promove pra prod
Promove pra produção todo o lote acumulado em dev desde a v8.30.244
(v8.30.401-dev → v8.30.409-dev), validado em dev.

- **Intake — campos obrigatórios + vínculo automático**: Descrição e
  "Squad/time solicitante" (`intake.html`) viram obrigatórios,
  validados também no servidor (`functions/intake/submit.js`); o
  campo de squad solicitante virou uma lista suspensa fixa (Outlet,
  Omni, App, Site Hering, MarketPlace, CX, Midia, Comercial Geral) —
  troca o texto livre (que exigia digitar certinho pra casar com uma
  tag) por uma lista fechada, e vincula a tag correspondente
  automaticamente ao criar o card.
- **Badge do 📥 Intake, fix definitivo de clipping**: parou de ser
  `position:absolute` tentando escapar do corte da `.toolbar` — agora
  é só mais um item em fila no flex do botão, imune a qualquer
  comportamento de overflow de ancestral.
- **Notificação de intake novo**: squad inteiro recebe notificação
  (sino 🔔 + push) assim que um pedido chega, disparada direto pela
  Cloud Function `intakeSubmit` — não depende de ninguém com o board
  aberto no momento.
- **Badge 📥 no próprio card + funil de métricas**: cards criados a
  partir de um pedido de intake ganham um `intakeId` permanente e um
  badge visual (só o ícone, mesmo padrão do 🎯 de OKR); "Dados do
  quadro" ganha dois cartões novos — pedidos recebidos/aprovados/
  descartados/pendentes, e quantos dos aprovados já foram concluídos.
- **Título do card gerado pela Ficha Técnica**: com a Ficha Técnica
  ativa, o título se monta sozinho a cada mudança em Plataforma,
  Formato, Campanha, Objetivo, Etapa do Funil ou Funil —
  `[Plataforma] [Formato] - [Campanha] [Objetivo] - [Etapa]/[Funil]`.
  Continua editável na mão; nunca reescreve o título só por abrir um
  card já existente.
- **Blindagem em `_refreshComunicados()`**: `query()` do Firebase
  agora roda dentro de um try/catch, com fallback pro comportamento
  sem filtro server-side se falhar por qualquer motivo — reportado por
  uma pessoa (`query is not defined`), causa raiz não confirmada, mas
  o crash não pode mais deixar Mural/avisos quebrados pro resto da
  sessão de quem for afetado.

### v8.30.244 — 2026-08-12 · promove pra prod
Promove pra produção a otimização de bandwidth do `comunicados`
(validada em dev): `_refreshComunicados()` trocou de baixar a árvore
inteira (ativos + inativos/arquivados) a cada 3min para uma query
server-side (`orderByChild('ativo').equalTo(true)`) — mesmo
comportamento visível (popup/badge/Mural), sem o peso morto do
histórico inativo. Achado investigando um aumento real de consumo de
download com a instrumentação `_dbg` já existente.

### v8.30.243 — 2026-08-11 · promove pra prod
Ajuste de legibilidade no painel 🌅 Meu Dia, depois de 3 rodadas de
feedback direto com print: título e texto secundário (squad/coluna/
prazo) de cada card maiores, com contraste mais forte, sem cair no
efeito "neon"/negrito que apareceu numa passada intermediária —
`.meudia-row-meta` fechou em peso 400, `opacity:.72`, 12.5px.

### v8.30.242 — 2026-08-11 · promove pra prod
Promove pra produção todo o lote acumulado em dev desde a v8.30.241
(v8.30.389-dev → v8.30.397-dev), validado em dev pelo usuário.

**🎬 Ficha Técnica (produção criativa)** — reformulação grande do antigo
"Ficha de Criativo" free-text: hierarquia fixa (Campanha, Funil, Etapa
do Funil, Canal, Objetivo, Plataforma, Tipo, Formato, Variações), todos
obrigatórios pro demandante exceto Direcional de Mídia (opcional).
Canal/Objetivo/Plataforma/Tipo/Formato viram listas fechadas
configuráveis em ⚙ Config → Criativos (igual tags — ninguém digita
texto livre), com Tipo dependente da Plataforma escolhida e uma
referência de quantidade sugerida por plataforma. "Status de produção"
foi removido (redundante com a coluna do board, já visível em 📊 Dados
do Board). Supercard não precisa de ficha própria — a seção some
sozinha do modal assim que o card ganha o primeiro filho, sem depender
de ninguém lembrar. Painéis de contagem (Controle de Criativos →
Dashboard, Dados do Board) agora separam Total/Cards/Supercards.

**🖼️ Capa de imagem** — dica de dimensão ideal recomenda subir em
postimages.org/imgbb.com quando não há onde hospedar (link do Google
Drive geralmente não funciona nas contas da Hering, política de
Workspace bloqueia o compartilhamento público necessário).

**📈 CFD** — filtro de colunas ocultas (⚙ Config → Fluxo → "Ocultar do
CFD"), pra tirar Backlog/Arquivo/Bloqueios do gráfico.

**📥 Intake** — vira opcional por squad (⚙ Config → Ágil), com opt-out
explícito; desligar esconde o botão e a Cloud Function passa a
rejeitar pedidos novos no link público.

**💬 Comentários** — botão "↩ Responder" insere automaticamente
"@handle" de quem comentou, reaproveitando a notificação de menção já
existente.

### v8.30.241 — 2026-08-11 · promove pra prod (PR #319)
Promove a dica de dimensão ideal pra capa de imagem de card, a partir
de feedback direto testando a capa em produção ("nem todas as imagens
ficam boas como capa"). Dica inline no menu 🎨 → aba de imagem +
HELP_CONTENT expandido explicando por que (a capa é uma faixa fixa de
64px com corte automático — banner largo com o assunto centralizado
funciona bem, foto quadrada/retrato perde a maior parte). Puramente
texto/UI — nenhum comportamento muda.

### v8.30.240 — 2026-08-11 · promove pra prod (PR #316)
Promove pra produção todo o lote de otimização, mobile, tema claro e
novas features acumulado em dev desde a v8.30.239, validado em rodadas
de teste ao vivo (incluindo um teste ponta a ponta do formulário de
intake, feito direto em produção do fluxo).

**Performance & banda** — menos dados trafegados do Firebase sem mudar
nada visível: listeners granulares (lembretes, comentários, cache do
Google Calendar), coalescimento de re-render (`scheduleRender`),
amostragem de telemetria interna, fim do polling de 400ms do estado
"não salvo".

**Mobile** — modal de card em bottom-sheet, navegação por coluna com
scroll-snap, alvos de toque 44×44, botão "+ Card" agora sabe em qual
coluna/squad você está.

**☀️ Tema claro** — nova paleta padrão ("duna branca vs. lagoa
turquesa"): card quase branco de verdade contra um fundo mais
saturado, melhor contraste que a versão anterior. Peixinhos/bolhas do
fundo ajustados pra continuarem visíveis contra o novo fundo.

**Comentários** — saíram de dentro do card pra um path próprio
(`card_comments/{cardId}`), fim do reenvio de comentários inteiros a
cada edição de qualquer campo do card.

**Features novas:**
- 🌅 **Meu Dia** (`Ctrl+D`) — seus cards de todos os squads, agrupados por prazo/menções/bloqueios.
- ⏳ **Aging visual** — badge no card quando ele passa tempo demais numa coluna (limite configurável).
- ✨ **Criação rápida** — `!alta @fulano #tag amanhã` no título de um card novo já preenche tudo.
- 📈 **CFD & Burndown** — nova aba em "📊 Dados do Board", reconstruída do histórico que cada card já guarda.
- 📥 **Formulário de intake** (`intake.html?squad=X`) — link público, sem login, pra pedidos externos virarem card sob revisão do squad.
- 🖼️ **Capa de card com imagem** — além da cor sólida que já existia.
- 🔴 **Indicador de offline** — selo no header + aviso do navegador antes de fechar a aba com algo não salvo.

Excluído desta rodada, por pedido direto: digest semanal por e-mail.

Detalhe completo de cada mudança nas entradas de `kanban-dev.html`
logo abaixo desta seção.

### v8.30.239 — 2026-08-10 · promove pra prod (PRs #289–#291)
Promove pra produção o fix de legibilidade do botão "💡 Meus cards" no
tema claro (barra de Filtros), validado em dev após 3 rodadas de
feedback direto (a técnica certa acabou sendo a mais simples: escurecer
texto/borda com `!important`, sem preencher o fundo do botão). Vale nos
dois: claro padrão e a variante escura do duplo-clique. Puramente
visual.

### v8.30.238 — 2026-08-10 · promove pra prod (PRs #282–#286) — tema claro
Promove pra produção o ajuste de contraste do tema claro, validado em
dev por várias rodadas de feedback direto:

- ☀️ **Tema claro padrão** continua a mesma paleta de sempre (a da
  v8.30.237) — ninguém é afetado sem pedir.
- 🌙☀️ **Duplo-clique no botão de tema, dentro do claro**, alterna pra
  uma variante mais escura e com azul mais profundo (opcional,
  persistente — fica salva no navegador de quem escolher). Clique único
  continua alternando claro/escuro normalmente.
- 🎨 Título das colunas ganha um tom mais suave (cinza-azulado em vez
  de quase-preto) e o fundo dos cards perde a camada de branco puro que
  diluía qualquer tingimento — os dois valem tanto no claro padrão
  quanto na variante escura.
- Puramente visual, não muda dado nenhum.

### v8.30.237 — 2026-08-10 · promove pra prod (PRs #278–#280)
Promove pra produção o filtro de Supercards e o redesenho da barra de
Filtros, ambos validados em dev:

- 🧩 **Filtro "Supercards"** (PR #278): novo checkbox no drawer de
  Filtros — mostra só cards com pelo menos 1 card filho ainda ativo.
  Combina com os outros filtros normalmente.
- 🎨 **Painel + agrupamento na barra de Filtros** (PRs #279–#280):
  feedback direto ("essas duas linhas... achei feio, vazio!") — a
  barra ganhou um container próprio (mesmo tratamento visual do
  `.goal-bar` já existente) e os campos agora ficam organizados em 3
  grupos (filtros / opções rápidas / ações) com divisores, em vez de
  soltos direto no fundo do board. Testado com artefato visual (3
  candidatas comparadas lado a lado) antes de aplicar.
- Central de Ajuda atualizada.

### v8.30.236 — 2026-08-10 · promove pra prod (PR #274) — Central de Ajuda
Atualiza o item "🧾 Receitas prontas" do help de Supercard (❓, Ctrl+K)
pra mencionar o batch de vários nomes de filho separados por vírgula
(já valia desde a v8.30.235, só o texto estava desatualizado).
Puramente texto de ajuda, sem mudança de comportamento.

### v8.30.235 — 2026-08-10 · promove pra prod (PRs #270–#272) — CORRIGE REGRESSÃO
Promove pra produção o lote que corrige uma regressão introduzida pela
própria v8.30.234 (poucas horas antes):

- 🚨 **Regressão crítica corrigida** (PR #272): aplicar uma receita de
  fan-out num card AINDA NÃO SALVO e depois clicar "Salvar" não estava
  vinculando os filhos — o fix de filhos órfãos da v8.30.234 (PR #268)
  apagava os filhos de verdade logo depois do salvamento ter sucesso,
  porque `editingId` continua `null` mesmo após um card novo salvar
  (mesma peculiaridade que causava cards duplicados em clique duplo).
  Corrigido: a lista de filhos "em risco" é limpa assim que o
  salvamento confirma sucesso, antes do fechamento do modal.
- 🧹 **Simplificações de UX** (PR #270): receitas sem filho configurado
  somem do dropdown "Aplicar receita"; "+ Card filho" aceita vários
  nomes separados por vírgula numa tacada só.
- 🧹 **Dedup de código** (PR #271): unifica o molde de card filho
  (`_blankSuperChildCard`) e a regra de mesclagem de Modelo
  (`_mergeModeloEmCardObj`) numa fonte só, eliminando as duplicações
  que causaram tanto o bug da submarca quanto esta regressão. Bônus:
  filhos de fan-out sem modelo agora herdam o PO do card pai.

Sem aviso externo — janela entre quebrar e corrigir foi de poucas
horas no mesmo dia, e o fluxo (fan-out em card novo) é recente o
suficiente pra não ter alcançado uso amplo ainda.
Promove pra produção 4 correções de bug validadas em dev, todas
reportadas com prints/feedback direto durante uso real:

- 🐛 **Cards duplicados ao clicar Salvar várias vezes** (PR #265):
  `saveCard()` não tinha trava de reentrância — clique repetido em
  "💾 Salvar" enquanto um salvamento anterior ainda não tinha
  confirmado (rede lenta) recriava o card do zero a cada clique.
  Botão agora desabilita e mostra "Salvando…" até o Firebase confirmar.
- 🧩 **Card pai da receita de fan-out pode ser vinculado a Modelo**
  (PR #266): antes só dava pra renomear a receita; agora o card pai
  também pode ser mesclado com um Modelo (descrição/checklist/tags/
  riscos), igual já acontecia com os filhos.
- 💬 **Confirmação clara do modelo aplicado** (PR #267): toast único
  mencionando modelo + filhos criados, em vez de dois toasts
  disputando o mesmo espaço (o 2º apagava o 1º antes de dar pra ler).
- 🐛 **Submarca do modelo não sincronizava + filhos órfãos ao
  cancelar** (PR #268): aplicar um modelo com submarca deixava o
  campo de Submarca do formulário sem atualizar, bloqueando o Salvar
  mesmo com a tag aplicada certinho por baixo dos panos — corrigido
  (afeta também o botão clássico "📥 Usar modelo"). Cancelar a criação
  de um card pai depois de aplicar uma receita de fan-out não deixa
  mais os cards filhos órfãos soltos no board.

Puramente correções de bug — sem aviso externo pra este lote (pedido
direto do responsável, "como foi correção, n precisa gerar avisos").
Promove pra produção o lote de legibilidade do tema claro, validado em
dev por vários rounds de feedback direto (o mais recente incluiu um
artefato visual comparando 4 técnicas antes de qualquer código subir):

- 🧩 **Supercard no tema claro** (PR #258): borda do card e cabeçalho
  do rollup "Cards filhos" (cor roxo-clara, pensada pro tema escuro)
  ganham contraste — estavam quase invisíveis no claro. Botão "✕" de
  remover filho também.
- 🏷 **Tags/labels/badges do card no tema claro** (PRs #260–#262):
  tags, chip de executor/agente, badge de prazo, badge de risco e
  pílula de prazo no calendário ganham a mesma pegada saturada/"neon"
  que já tinham no tema escuro. Duas tentativas anteriores
  (escurecimento simples, depois `mix-blend-mode`) não foram
  suficientes — a versão final reforça o preenchimento de cada pill
  (alpha baixo demais pra ler no claro) antes de escurecer tudo junto
  de forma consistente.
- Puramente visual, não muda legibilidade nem dado nenhum.

### v8.30.232 — 2026-08-09 · promove pra prod (PR #255)
Promove pra produção o ajuste no supercard validado em dev: cada
filho de uma receita de fan-out pode ser vinculado a um **📋 Modelo**
já existente (⚡ Funções de card → 📋 Modelos) — quando a receita
gerar esse filho, ele nasce com descrição, checklist, tags e riscos
do modelo escolhido, em vez de um card vazio só com título. Filho sem
modelo vinculado continua igual a antes.

### v8.30.231 — 2026-08-09 · promove pra prod (PRs #249–#253)
Promove pra produção o lote validado em dev:

- ⏱🏷 **Filtros de período e tag na aba Insights** (PR #249): a aba
  💡 Insights de "📊 Dados do Board" ganha um filtro de período
  (padrão "Ativos agora", ou só os criados nos últimos 7/14/30/90
  dias) e um filtro por tag, combináveis, resetando a cada reabertura
  do modal.
- 🧩 **Supercard (cards filhos)** (PRs #250–#253) — pedido do time de
  Mídia Alcance: um pedido do dia a dia costuma virar vários cards
  (formato/veículo/teste diferentes). Um card pode ganhar cards
  filhos — no board vira um "supercard" com rollup compacto dos
  filhos (coluna + progresso "X/N concluído(s)"); no modal, seção
  "Cards filhos" pra vincular um existente ou criar um novo já como
  filho (funciona mesmo num card ainda sendo criado, antes de salvar
  pela 1ª vez), herdando coluna/prazo/prioridade/demandante do pai.
  Filhos continuam cards normais e independentes, sem bloqueio entre
  eles.
  - **Receitas de fan-out**: em ⚙ Config → Automações, cria receitas
    nomeadas (ex.: "Campanha de mídia paga") com a lista de filhos
    que ela sempre gera — aplica manualmente (botão "🧩 Aplicar
    receita" no card) ou automaticamente (ação "🧩 Aplicar fan-out"
    numa regra de automação, com guarda de idempotência).
  - **← Voltar**: navegar entre cards relacionados (pai↔filho) ganha
    um botão de volta rápida no topo do modal, sem precisar buscar de
    novo.

### v8.30.230 — 2026-08-09 · promove pra prod (PR #244)
Promove pra produção a aba **💡 Insights** dentro de "📊 Dados do
Board", validada em dev (v8.30.334-dev): distribuição por prioridade
(com alerta se "Crítica" estiver desproporcional), carga por
responsável (com alerta de sobrecarga), cards com mais riscos
mapeados em aberto, OKR por coluna, cards parados há 1+ sprint e,
quando o squad usa o campo, distribuição por submarca. Tudo calculado
a partir do que o board já tem carregado — zero leitura nova do
Firebase.

### v8.30.229 — 2026-08-07 · rename de squad (pedido direto, fora do ciclo normal de promoção)
Renomeia a squad "Dados" pra **"Squad Dados e IA"** em todos os
lugares onde o nome aparece — pedido direto do usuário, aplicado
como mudança de conteúdo isolada (não é uma promoção do lote
acumulado em dev, que segue pendente/separado). Só o rótulo de
exibição muda; o id interno da squad (`dados`, usado nos caminhos do
Firebase) continua o mesmo, então não afeta nenhum dado existente.

### v8.30.228 — 2026-08-07 · promove pra prod (PRs #240–#241)
Promove pra produção o lote validado em dev (v8.30.332-dev a
v8.30.333-dev):

- 🖼️ **Otimização de bytes**: o favicon/logo/ícone do PWA estava
  embutido como base64 em 4 lugares do HTML (~75KB repetidos,
  re-baixados a cada atualização de versão). Extraído pra
  `favicon.png`, cacheável separadamente. Adicionado `preconnect`
  pros domínios de fonte/Firebase.
- 🏷 **Automação "Remover tag"**: nova ação (espelha "Adicionar tag")
  e novo gatilho "Tag removida do card" (espelha "Tag adicionada ao
  card"), pedidos pelo time.
- ❓ Skill de projeto `/otimizaçãoderotina` adicionada (não afeta o
  board em si — é uma rotina reaproveitável pra sessões futuras de
  desenvolvimento).

### v8.30.227 — 2026-08-07 · promove pra prod (PRs #234–#238)
Promove pra produção o lote de Automações + ajustes de tema, validado
em dev (v8.30.325-dev a v8.30.331-dev):

- ⚡ **Automações do board revisadas** (Config → ⚡ Auto), em 3 fases:
  motor data-driven (substitui if/else espalhado por 3 funções),
  correção de 2 triggers mortos (`due_today`/`due_overdue` nunca
  disparavam; "Notificar Agente Ágil" não fazia nada — agora só
  aparece quando o Agente Ágil está ativo), 7 ações novas (definir
  submarca/tamanho/demandante/padrão de card/capa de cor, marcar como
  OKR, adicionar item de checklist); 5 triggers novos (checklist
  100%, risco adicionado, bloqueado/desbloqueado, card parado há
  muito tempo); condição extra opcional ("E a tag é X") e múltiplas
  ações na mesma regra. Regras salvas antes desta versão continuam
  funcionando sem migração.
- 🐛 **Outro trigger morto corrigido**: "Prioridade definida como X"
  nunca disparava de verdade (evento genérico não escutado por nenhum
  trigger) — corrigido nos 3 pontos onde a prioridade é definida
  (Salvar do modal, menu de contexto, Ficha de Criativo), e
  generalizado pra aceitar qualquer nível (Baixa/Média/Alta/Crítica),
  não só Crítica.
- ⏰ **Horário fixo pras automações/notificações de prazo**: "Card
  vence hoje", "Card atrasado" e "Card parado há muito tempo" (e o
  aviso de prazo pro responsável) agora disparam sempre às 09:00,
  horário de São Paulo — independente do fuso do navegador de quem
  abriu o board. Se a aba já estiver aberta antes das 9h, dispara
  sozinho quando a hora chegar, sem precisar recarregar.
- 🔀 **7 gatilhos novos**, ampliando o QUANDO pra espelhar o ENTÃO: tag
  adicionada, submarca definida, card marcado como OKR, capa de cor
  definida, padrão de card definido, modelo usado, card recorrente
  criado.
- ❓ **Nova aba "⚡ Automações" na Central de Ajuda**, com exemplos
  visuais (blocos QUANDO/E/ENTÃO), lista completa de gatilhos/ações e
  uma seção de dúvidas frequentes.
- 🌤️ **Tema claro mais escuro (2ª rodada)**: nome da squad no header
  (e outros rótulos que usavam `--cyan`) estava praticamente ilegível
  no tema claro — corrigido; fundo/glass escurecidos mais uma vez.

### v8.30.226 — 2026-08-07 · promove pra prod (PRs #227–#232)
Promove pra produção o lote seguinte, validado em dev (v8.30.319-dev a
v8.30.324-dev):

- **Tema claro mais escuro**: fundo de página ("lençóis maranhenses")
  e botões da toolbar (Ajuda, Funções de card, Links, Dependências,
  Calendários, Dados do Board, Campanhas, Controle de Criativos) —
  ambos estavam com contraste ruim no tema claro. Cards continuam como
  estavam.
- **Duplicar card: opção de excluir comentários** — novo checkbox no
  modal de duplicar.
- **Novo campo opcional "📢 Demandante"**: quem solicitou o card,
  separado do Responsável (que executa e pode mudar de mão). Opcional
  e configurável por squad (Config → 📐 Padrões de card): campo no
  modal (ao lado de "Sem prazo definido"), filtro na toolbar, entra
  nas notificações de concluído/desbloqueado, aparece pro Agente Ágil,
  e é seção togglável em cada Padrão de card.
- **"Padrões de card" agora suporta múltiplos padrões nomeados** (não
  só 1 toggle global) — cada card escolhe o seu num seletor no modal;
  aba movida pra logo depois de Subtimes em Configurações.
- **Nova feature: Capa de cor (testeira)** — tira de cor fina no topo
  do card (board + modal), baseada no recurso de capa do Trello, pra
  organização visual além das tags. Paleta de 9 cores, acessível pelo
  botão 🎨 no header do modal.
- **Bugfix "Usar modelo"**: não preenchia a Descrição visualmente (em
  dois pontos: botão dentro do card e "+ Usar" no drawer de Modelos) e
  não funcionava em card ainda não salvo.
- **Bugfix Padrões de card**: trocar de padrão "acumulava" seções
  escondidas em vez de trocar; cards novos vinham com o último padrão
  aplicado em vez do padrão da squad.

### v8.30.225 — 2026-08-06 · promove pra prod (PRs #218–#226)
Promove pra produção o lote seguinte de Notas + card, validado em dev
(v8.30.310-dev a v8.30.318-dev):

- **Vincular nota ↔ card**, nos dois sentidos: de dentro da nota (busca por
  card) e de dentro do card, em 🔗 Vínculos & anexos (busca por nota,
  cruzando suas pessoais + as da squad). Reflexo mostra chip clicável dos
  dois lados, com ✕ pra desvincular.
- **Busca em Notas** por título e conteúdo (todos os blocos, livre ou
  estruturado), com trecho de contexto destacado no resultado.
- **Listas de usuários em ordem alfabética** — responsável, participantes,
  filtros de board/calendário/arquivados, Config → Usuários.
- **Descrição x Insights do PO rebalanceados**: PO (campo opcional) parava
  de "roubar a cena" da Descrição (campo principal) — PO virou neutro +
  "(opcional)" no rótulo, Descrição ganhou um realce sutil condizente.
- **"Padrões de card"** (Configurações → 📐): organizador/PO cria vários
  padrões nomeados, cada um escolhendo quais seções opcionais do modal
  ficam visíveis (Insights do PO, Descrições adicionais, Participantes,
  Checklist, Riscos, Criativo, Milanote, Anexos, Notas vinculadas,
  Comentários). Um padrão pode ser marcado como padrão-da-squad; cada card
  escolhe o seu pelo seletor no header do modal (ao lado de Compartilhar).
  Campos estruturais nunca entram na lista.
- **Notificação de prazo revista**: troca o aviso de véspera por um no dia
  do prazo + um no 1º dia atrasado, sem repetir enquanto seguir atrasado.
- **Bugfix "Usar modelo"**: tanto o botão dentro do card quanto o "+ Usar"
  do drawer de Modelos deixavam de preencher a Descrição visualmente (o
  valor salvava, só não redesenhava a tela) — e aplicar um modelo num card
  **ainda não salvo** simplesmente não fazia nada (a função exigia um
  `editingId` que só existe depois do 1º "Salvar" manual). Corrigido nos
  dois pontos.
- **Bugfix Padrões de card**: trocar de padrão num card "acumulava"
  seções escondidas em vez de trocar, e cards novos vinham com o último
  padrão aplicado em vez do padrão da squad.

### v8.30.224 — 2026-08-06 · promove pra prod (PRs #213–#216)
Promove pra produção a feature nova de Notas, validada em dev
(v8.30.306-dev a v8.30.309-dev):

- **Nova aba 📝 Notas** na lateral do board (mesmo padrão de
  Dados/Lembretes) — notas pessoais e da squad, sem anexos/arquivos.
- **Dois modos por nota**: livre (texto corrido, tipo Notas do
  computador — é o padrão pra nota nova) ou estruturado (outliner de
  blocos colapsável, estilo RemNote — Enter/Tab/Shift+Tab/Backspace,
  checklist embutido em qualquer bloco). Troca pelo botão 🧱/📄 na
  toolbar; trocar de estruturado pra livre avisa antes (é destrutivo
  pra hierarquia) e dá pra desfazer com Ctrl+Z.
- **Ctrl+Z** funciona nos blocos (pilha de undo por nota).
- Blocos mostram o texto formatado de verdade (negrito/itálico/link)
  quando não estão sendo editados — só a sintaxe crua aparece no modo
  edição.
- Listener do Firebase só existe com o painel aberto — desanexa ao
  fechar, não fica consumindo leitura à toa o resto da sessão.

### v8.30.223 — 2026-08-05 · promove pra prod (PRs #208–#211)
Promove pra produção a leva de correções de link validada em dev
(v8.30.302-dev a v8.30.305-dev), toda motivada por um caso real: um
link assinado do Vimeo (`.../file.mp4 (1080p).mp4?loc=...&signature=...`)
colado na Descrição/Comentário de um card:

- **Link com espaço/parêntese cru na URL não quebra mais**: `[texto](url)`
  aceita espaço cru e um nível de parênteses balanceados — a URL de um
  link assinado não pode ser reescrita (o servidor valida a assinatura
  byte-a-byte; chegou a ser tentado percent-encode numa primeira versão,
  mas isso invalidava a assinatura e o Vimeo passava a recusar).
- **Corrigido double-escape de `&`**: um `&` da URL virava `&amp;amp;` no
  meio do pipeline de escape e sobrava `&amp;` literal no link de
  verdade — quebrava qualquer URL com mais de um parâmetro na query.
- **Corrigido auto-link de URL solta começando uma linha nova**: caía
  numa exclusão pensada pra outra coisa (evitar linkar de novo o texto
  de um `[url](url)` já processado) e ficava como texto puro, não
  clicável.
- **Preview de Vimeo nos Anexos**: link reconhecido como Vimeo ganha um
  botão 🎬 que embeda um `<video>` (link direto de arquivo) ou `<iframe>`
  (player normal), mesmo padrão do preview do Milanote.

### v8.30.222 — 2026-08-05 · promove pra prod (PRs #202–#206)
Promove pra produção a leva de ajustes validada em dev
(v8.30.298-dev a v8.30.301-dev):

- **Sobrenome nos dropdowns de usuário**: filtro "Todos os usuários" da
  toolbar, filtro de responsável em Cards arquivados, filtro de
  usuário do Calendário, dropdown de "atribuir responsável" em massa e
  rótulo das raias por responsável agora mostram primeiro + último
  nome (`_shortName()`), não só o primeiro — mesmo ajuste que já tinha
  sido feito pra participantes.
- **Campanhas/coleções de squad fictícia voltam a aparecer no próprio
  board**: bug em que a exclusão de campanhas de demo escondia até de
  quem via o board da própria squad fictícia, não só de squads reais.
- **Seções do modal de card ficam expansíveis**: "Conteúdo", "Vínculos
  & anexos" e "Colaboração" ganham cabeçalho clicável com seta (igual
  o Histórico, que continua fixo no fim) — botão ⇕ no topo do modal
  expande/recolhe as 3 de uma vez. Checklist não virou recolhível, mas
  ganhou altura máxima com rolagem interna.
- **Modo leitura do lock de card libera anexos/links**: card travado
  (por edição real de outra pessoa, ou lock esquecido) não bloqueia
  mais o modal inteiro — dá pra abrir anexos, o link do Milanote e
  expandir/recolher seções mesmo travado; só os campos de edição de
  fato continuam bloqueados.

### v8.30.221 — 2026-08-05 · promove pra prod (PRs #199–#201)
Promove pra produção mais 2 ajustes finos, validados em dev
(v8.30.296-dev a v8.30.297-dev):

- **Texto do "seu card" no claro**: trocado de `var(--txt)` (lia como
  cinza em cima do fundo azul do card) pra um azul escuro saturado,
  testado lado a lado num protótipo antes de decidir.
- **Tela de login acompanha o tema**: o card de login já mudava de cor
  com o tema, mas o fundo ficava sempre num preto fixo, dando um card
  claro flutuando num fundo escuro no modo claro. Fundo agora
  acompanha o tema também.

### v8.30.220 — 2026-08-05 · promove pra prod (PRs #195–#198)
Promove pra produção mais uma leva de ajustes, validados em dev
(v8.30.292-dev a v8.30.295-dev):

- **Título obrigatório pra salvar card** — mesmo tratamento que
  Prazo/Submarca já tinham (antes, título vazio dava um "não acontece
  nada" silencioso).
- **Contraste no modo claro**: pulso de campo obrigatório/"achar meus
  cards" (amarelo → azul escuro), toast de campos obrigatórios (borda
  e sombra mais fortes), borda de card bloqueado (menos "rosinha", com
  um ajuste fino depois pra não ficar vermelhão demais) e borda de OKR
  (amarelo → dourado escuro).
- **"Seu card" mais aceso no escuro** — tingimento, borda e um glow
  leve mais fortes, pra divergir de verdade dos cards normais da
  coluna (no claro já estava bem destacado).

### v8.30.219 — 2026-08-05 · promove pra prod (PRs #190–#193)
Promove pra produção uma leva de melhorias validadas em dev
(v8.30.288-dev a v8.30.291-dev):

- **Temas renomeados**: "🌙 Mar Profundo"/"☀️ Mar Cristalino" viram
  "🌙 Abrolhos"/"☀️ Lençóis Maranhenses" — paisagens brasileiras com
  identidade própria.
- **Filtro de submarca persistente**: a última seleção do filtro
  rápido 🏷️ Submarcas agora fica salva por navegador e por squad,
  restaurada automaticamente (antes sempre abria em "Todos").
- **Prazo invertido**: nova opção "📅 Prazo (mais novos primeiro)" no
  menu de Ordenação.
- **Participantes com nome completo**: lista e chips de participantes
  mostram o nome completo, não só o primeiro nome.
- **Ordenação 100% livre (🖐 Manual)**: novo modo de ordenação onde
  arrastar um card dentro da mesma coluna reordena de verdade (antes
  era sempre um no-op). Corrigido pra respeitar filtros ativos —
  soltar no final da lista filtrada não pula mais por cima de cards
  escondidos pelo filtro.

### v8.30.218 — 2026-08-05 · promove pra prod (PRs #187–#188)
Promove pra produção mais uma rodada de leitura/contraste do modo
claro, validada em dev (v8.30.285-dev a v8.30.287-dev):

- **Mais badges legíveis no claro**: status do executor/agente, prazo
  do card e badge de risco — não passavam pelo mesmo fix de tags por
  usarem classes próprias, agora corrigidos.
- **Pílulas de "Prazo" no Calendário**: texto branco fixo em cima de
  fundo pálido só funcionava por acidente no escuro; corrigido pra
  usar a cor da própria coluna, legível nos dois temas.
- **Destaque do "seu card"**: tingimento e borda bem mais fortes +
  selinho "👤 seu card" — testado com protótipo antes de implementar,
  disponível nos dois temas.

### v8.30.217 — 2026-08-05 · promove pra prod (PRs #182–#184)
Promove pra produção mais 2 rodadas de ajuste fino do modo claro,
validadas em dev (v8.30.281-dev a v8.30.283-dev):

- **Distinção dos cards**: sombra + borda mais firmes (2 rodadas de
  feedback até o tom ficar escuro o suficiente pra diferenciar bem),
  card do modo escuro também ganhou um pouco mais de contraste.
- **Tags do card escurecidas no claro**: cores de fundo/borda/texto das
  tags (mais de 10 variantes geradas por JS) estavam pensadas pro fundo
  escuro e ficavam sem leitura no claro — `filter` escurece o pill
  inteiro de uma vez, incluindo cores customizadas por usuário.

### v8.30.216 — 2026-08-05 · promove pra prod (PRs #176–#180)
Promove pra produção o **modo claro** (validado em dev nas v8.30.276-dev
a v8.30.280-dev — ver entradas `kanban-dev.html` correspondentes):

- Botão 🌙/☀️ no canto superior direito alterna entre **🌙 Mar Profundo**
  (escuro, o de sempre) e **☀️ Mar Cristalino** (claro, paleta
  Caribe/Maldivas — fundo azulado, nunca branco puro). Preferência
  pessoal, salva só no navegador.
- Correções de leitura no claro: avatares de iniciais (círculo azul
  sólido + texto branco em vez de azul-em-azul) e ~15 seletores com
  cores "quase iguais" que a varredura inicial do CSS tinha deixado
  escuros chapados (comentários, anexos/links do card, painéis de
  Lembretes/Estrelas do Mar/Spotify/Central de Dados).

### v8.30.215 — 2026-08-05 · promove pra prod (PRs #173, #174)
Promove pra produção o ajuste visual dos badges no topo do card
(combina chip de Executor + Status do agente num só, e corrige o
espaçamento entre badges com `display:inline-block` — `margin-bottom`
não tinha efeito nenhum sem isso), validado em dev nas v8.30.274-dev e
v8.30.275-dev — ver entradas `kanban-dev.html` correspondentes.

### v8.30.214 — 2026-08-05 · promove pra prod (PR #171)
Promove pra produção o botão "↩ Restaurar selecionados" na tela de
Cards arquivados, validado em dev na v8.30.273-dev — ver entrada
`kanban-dev.html` correspondente.

### v8.30.213 — 2026-08-04 · promove pra prod (PR #169)
Promove pra produção o tamanho de fonte do board, validado em dev na
v8.30.272-dev — ver entrada `kanban-dev.html` correspondente.

- Novo botão **🔍 Fonte** na toolbar — menu suspenso com 4 tamanhos:
  Pequena, Padrão, Grande, Muito grande. Aplica `zoom` só no `#board`
  (colunas/cards). Preferência pessoal, salva só neste navegador.

### v8.30.212 — 2026-08-04 · revisão de código: excluir/esconder card
Pedido direto (depois de uma sequência de bugs reais de card sumindo):
revisão focada em todo caminho que exclui ou esconde card, mais uma
passada de otimização.

**Achado e corrigido — excluir coluna perdia cards.** `delColumn()`
reatribui o `.col` dos cards da coluna excluída pra primeira coluna,
mas só na memória local — `saveAgilCfg()` (único caminho de save da
edição de colunas) salvava `columns`/`agil_cfg`/`tags`, nunca `cards`.
Resultado: depois de excluir uma coluna com cards e clicar Salvar, a
coluna sumia de verdade de `/columns`, mas os cards que estavam nela
voltavam com o `.col` antigo (órfão) em qualquer outro reload/aba — e
como o board filtra cards por coluna (`c.col===col.id`), um card com
`.col` órfão não bate com NENHUMA coluna e simplesmente some (sem
arquivar, sem erro, ainda intacto em `/cards`). Afetava board normal E
os modos de raia (pessoa/tipo/subtime), que usam o mesmo filtro por
coluna. Fix: `saveAgilCfg()` agora salva os cards reatribuídos
(`fbSaveAll`) no mesmo save que persiste a exclusão da coluna.

**Auditoria dos demais caminhos de exclusão** (`deleteCard`,
`bulkDeleteSelected`, `ctxDelete`, `deleteSelectedArchived`,
`deleteSelectedOldCards`, `purgeOldArchived`, `excluirArquivado`,
Agente Ágil `excluir_card`) — todos já passam `touchedIds` corretos
(array vazio pra exclusão pura, já que nenhum card sobrevivente muda de
conteúdo) e agora se beneficiam dos fixes de listener das versões
anteriores (v8.30.209/210/211). Nenhum problema novo encontrado nesses
caminhos.

**Filtros e raia** (`passesFilter`, `renderRaiaOwner/Tag/Subteam`) —
revisados, sem bug de esconder card incorreto encontrado (raia sem
responsável/tag tem lane dedicada, não descarta).

**Otimização — já adequada, sem mudança necessária:** o cap de 80
cards renderizados por coluna (com "Ver mais") já limita o custo de
render do DOM mesmo em squads com milhares de cards. O padrão de 1
`window._get()` por card em mudanças estruturais (cards_index/
cards_updated_at) é uma troca deliberada da arquitetura de banda desta
sessão — já mitigado pro autor da escrita (que popula o espelho local
direto, sem esperar eco) e aceitável pros demais clientes (custo só
quando algo de fato muda). Arquitetura de `/cards` como array indexado
por posição (em vez de objeto chaveado por id) continua sendo uma
dívida técnica documentada (`fbSaveCard`) — funcional hoje, mas seria a
próxima fronteira de uma reescrita maior, não um fix pontual.

### v8.30.211 — 2026-08-04 · hotfix CRÍTICO: card virando outro card + F5 cortando o salvamento
Dois bugs a mais, achados a partir de um relato bem específico: um card
"Atualizar" (tag Hering Kids Comercial), importado na coluna Upload,
depois de um F5 apareceu como um card completamente diferente — com
título e coluna "Concluído". Não era mais "sumir", era **um card
mostrando o conteúdo de outro**.

**1. O próprio fix da v8.30.209 tinha um bug.** Ele "movia" o conteúdo
já conhecido de `_cardsByKey[posição antiga]` pra `_cardsByKey[posição
nova]` quando um card mudava de posição no array — rápido, mas errado:
quando VÁRIOS cards deslocam de posição na MESMA escrita (o caso comum
— qualquer criar/excluir/arquivar desloca todo mundo depois dele no
array), os eventos chegam em sequência, e a "posição antiga" de um
card podia já ter sido roubada por outro card que acabou de mover PRA
lá — misturando o conteúdo dos dois. `_cardsByKey` é indexado por
POSIÇÃO, não por id; "mover por posição" nunca foi seguro no meio de um
lote de deslocamentos em cadeia.
- Fix definitivo: nunca reaproveita conteúdo por posição — sempre busca
  o card fresco (`window._get`) na posição nova pelo id, mesmo padrão
  já comprovado do listener de `cards_updated_at`. Custa uma leitura de
  rede por deslocamento, mas elimina de vez o risco de misturar dois
  cards. Esse bug era só de renderização local (nunca escreveu nada
  errado no Firebase) — um F5 já resolve pra quem foi afetado.

**2. Import do Trello não esperava a escrita terminar antes de dizer
"sucesso".** `fbSaveAll()` era chamado fire-and-forget — o toast de
sucesso e o fechamento do modal apareciam na hora, mesmo com a escrita
real (o array inteiro de cards, pode ser vários MB num import grande)
ainda subindo pro Firebase. Se a pessoa desse F5 rápido demais
(confiando no toast), a aba fechava a conexão ANTES da escrita ser
confirmada pelo servidor — os cards recém-importados nunca chegavam a
ser salvos de verdade.
- `doTrelloImport()` agora `await` a escrita antes de fechar o modal ou
  mostrar o toast — só diz "importado" depois de confirmado de verdade.
- Proteção geral nova: `_pendingFbWrites` conta escritas em voo
  (`fbSaveAll`/`fbSaveCard`, qualquer lugar do app) e um `beforeunload`
  mostra o aviso nativo do navegador ("sair mesmo assim?") se ainda
  houver alguma pendente — rede de segurança pra QUALQUER save
  fire-and-forget do app, não só o import.

### v8.30.210 — 2026-08-04 · hotfix CRÍTICO: perda de dado real (não só render)
Depois da v8.30.209, usuário reportou que a contagem de "excluir todos"
continuava caindo SOZINHA entre uma checagem e outra (2886 → 2874, -12),
mesmo sem ninguém mais mexendo no board e já na versão com o fix
anterior. Investigação achou uma causa DIFERENTE e mais grave: não era
mais só renderização, era escrita real de `null` no índice.

Causa: `_reconcileCardsIndexOnce()` (autocorreção do índice, roda 1x por
carga do board) disparava num `setTimeout` fixo de **4 segundos**,
numa corrida contra o carregamento inicial em duas etapas
(`_twoPhaseCardsLoad`), que precisa buscar cada card individualmente
(`window._get()`, um request por card) que mudou desde o último cache.
Num squad grande (este tinha ~2886 cards ativos, muitos re-buscados
depois do import), esse carregamento legitimamente demora MAIS que 4s.
Quando o timer vencia a corrida, a reconciliação via os cards AINDA EM
CARREGAMENTO como "órfãos" (não estavam no espelho local ainda, apesar
de existirem de verdade) e **escrevia `null` em `cards_index` e
`cards_updated_at`** pra eles — apagando de verdade o único caminho pra
achar esses cards no carregamento em duas etapas. Na PRÓXIMA carga
(F5), esses cards nunca mais apareciam — o dado ficava órfão, intacto
mas inalcançável, em `/cards/{chave antiga}` — e squads grandes
perdiam MAIS cards a cada reload, porque o mesmo timer voltava a
perder a corrida (agora contra um carregamento ainda maior, com menos
cache válido).

- `fbLoadAll()`: a reconciliação agora só é agendada DEPOIS que
  `_twoPhaseCardsLoad()` realmente terminou de carregar tudo (encadeada
  no `.then()` da própria promise, nunca mais um timer correndo contra
  um carregamento de tamanho desconhecido).
- Nova ferramenta de reparo em Config → Trello → Diagnóstico:
  **"🔧 Reparar cards 'sumidos' (reconstruir índice)"** — lê `/cards`
  inteiro (a fonte de verdade real, nunca tocada por este bug) e
  reconstrói `cards_index`/`cards_updated_at`/`cards_archived` do zero.
  Não apaga nem altera nenhum card — só o índice, então é seguro rodar
  em qualquer squad que suspeite ter sido afetado (mesmo antes deste
  fix, já que é read-then-rebuild, não incremental).

Recomendação: qualquer squad grande (centenas+ de cards) deve rodar o
reparo pelo menos uma vez depois de atualizar, pra recuperar qualquer
card que já tenha ficado órfão do índice antes deste fix.

### v8.30.209 — 2026-08-04 · hotfix crítico GERAL (cards sumindo — não é só import)
Usuário reportou que cards continuavam sumindo mesmo fora do import do
Trello — "aconteceu comigo agora na coluna Upload do site Hering, tinha
um card de Kids ali e sumiu", e outros squads reclamando do mesmo. O
fix da v8.30.207 (popular `window._cardsByKey` direto no `fbSaveAll`)
só resolve pra quem FEZ o save, na própria aba — esta é a causa raiz
**geral**, que afeta qualquer aba já aberta assistindo o board quando
OUTRA pessoa faz qualquer operação estrutural.

Causa: `cards_index/{cardId}` guarda a POSIÇÃO do card no array
`/cards`. Toda vez que um `fbSaveAll()` estrutural roda (criar,
arquivar, excluir, duplicar card, drag que reordena — não precisa ser
import), a posição de TODOS os cards que vêm depois do ponto da
mudança desloca — mesmo os que ninguém tocou de verdade. Isso dispara
`child_changed` em `/cards_index` pra esses cards deslocados. O
listener, ao ver a posição mudar, apagava a entrada da posição antiga
em `_cardsByKey` e esperava um `child_changed` em `/cards_updated_at`
pra "re-baixar" o card na posição nova — MAS com `touchedIds` (ver
v8.30.201), `cards_updated_at` só muda de VALOR pra cards realmente
tocados; pra um card só deslocado (não tocado), o valor gravado é
idêntico ao anterior, e o Firebase não dispara `child_changed` pra um
valor idêntico. Resultado: a posição nova nunca era populada, e o card
— intacto no Firebase — ficava permanentemente ausente do board de
qualquer aba que já estivesse aberta (só um F5 resolvia, porque o
carregamento inicial não depende desse listener incremental).

- `_cardsByKey`: ao ver a posição de um card mudar, agora MOVE o
  conteúdo já conhecido (que não mudou, só a posição) da chave antiga
  pra nova, em vez de só apagar e esperar um fetch que talvez nunca
  chegasse. Se o conteúdo também mudou de verdade, o `child_changed` de
  `cards_updated_at` (que aí sim dispara) sobrescreve depois com a
  versão fresca — idempotente.

Esta é provavelmente a causa raiz real por trás da maioria dos relatos
de "sumiu um card" desde que o fix de banda (v8.30.201, touchedIds)
entrou no ar — não só do import do Trello.

### v8.30.208 — 2026-08-04 · hotfix (tags de Submarca faltando)
Achado a partir de um print do usuário: o editor de tags do squad "site"
mostrava só as 5 tags ANTIGAS de Submarca (Hering Adulto, Hering Kids,
Hering Sports, Hering Intimates, Hering Teens) — nenhuma das 10 novas
(Comercial/Cadastro, ver v8.30.201/204). Por isso os filtros por
Comercial/Cadastro não achavam nenhum card.

Causa: o backfill que cria as tags de Submarca que estão faltando só
roda dentro de `toggleSubmarcaAtivo()` — ou seja, só executa no momento
em que alguém MARCA o checkbox "Ativar campo de Submarca". Squads como o
"site", que já tinham o recurso ativado ANTES do split 5→10 tags
existir, nunca tiveram esse checkbox re-marcado depois — então nunca
ganharam as 10 tags novas, só ficaram com as 5 antigas presas no board
pra sempre.

- Nova função `_ensureSubmarcaTagsBackfilled()`: roda automaticamente 1x
  por squad por sessão (só pra quem pode editar tags — PO/Organizador),
  lê `config/submarca_ativo` e `tags` direto do Firebase (não confia no
  estado local, que pode não ter carregado ainda) e adiciona qualquer
  uma das 10 tags de Submarca que estiver faltando. Não mexe nas 5 tags
  antigas nem nos cards que já as usam (mesma filosofia não-destrutiva
  do resto do app) — só garante que as novas passam a existir.

Aplicado direto em dev e prod — usuário aguardando pra poder filtrar
por Comercial/Cadastro no import em andamento.

### v8.30.207 — 2026-08-04 · hotfix crítico (import Trello)
Dois bugs reais reportados ao vivo depois do import de 4 boards do Trello
(Hering Kids Digital, Cadastro Conteúdo, Intimates/Sports, Hering Adulto
Site — 3077 cards no total) pro squad **site**: "alguns cards sumiram" e
"o match automático das tags de submarca bugou".

**1. Cards "sumindo" depois de um import grande — não era perda de dado,
era um bug de renderização.** `fbSaveAll()` reescreve `cards_index` e
`cards_updated_at` por completo, e quem salva TAMBÉM está ouvindo esses
mesmos nós (dois-etapas de carregamento, ver v8.30.201/203) — cada
entrada nova dispara um `child_added` que busca aquele card individual
via `window._get()`, um request POR CARD. Num import de centenas/milhares
de cards isso é uma enxurrada de requests concorrentes; `_applyCardsSync()`
só protege o array local `cards` por 2 segundos — se nem todos os
requests voltarem dentro desses 2s (extremamente provável com uma base
dessas), o próximo sync reconstrói o board a partir de um mapa local
AINDA PARCIAL e derruba (visualmente) qualquer card cujo fetch
individual não tinha voltado ainda. O Firebase continuava com todos os
cards — só a renderização local é que ficava incompleta.
- `fbSaveAll()`: agora popula `window._cardsByKey` (o espelho usado pra
  reconstruir o board) diretamente e de forma síncrona, com o que já está
  sendo salvo — não depende mais de esperar o próprio eco via listener
  pra saber o que acabou de gravar. Os eventos que chegam depois só
  confirmam o que já está certo.
- Quem foi afetado: **um F5 (recarregar a página) já resolve** — o
  carregamento inicial (dois-etapas) espera TODOS os fetches antes de
  renderizar, diferente do caminho ao vivo que tinha o bug. Nenhum dado
  foi perdido de verdade no Firebase.

**2. Match automático de tag de Submarca no import do Trello errava o
time (Comercial/Cadastro).** O match "Prioridade 1" (label com o nome
EXATO de uma das 10 opções, ex.: "Hering Adulto Comercial") só cobria
boards que já escrevem marca+time juntos na label — na prática, a
maioria dos boards reais só tem a MARCA na label (ex.: "HERING ADULTO",
"ADULTO", "Hering Kids") porque o board INTEIRO já é de um time só. Sem
match exato, essas labels caíam no fuzzy `includes()` genérico, que
casava com QUALQUER uma das duas tags Comercial/Cadastro daquela marca
(ambas contêm "adulto"/"kids"/etc. como substring) — pegando sempre a
que existisse primeiro no array de tags do squad, virando praticamente
uma moeda ao ar.
- Novo seletor **"Time deste import"** (Comercial/Cadastro) na tela de
  import — labels só-marca (sem time explícito) agora usam esse time
  escolhido, em vez de adivinhar.
- Override por card: se um card tiver uma label solta "COMERCIAL" ou
  "CADASTRO" junto de uma label de marca (achado real no board "Hering
  Kids Digital" — mistura os dois times no mesmo board via uma label
  extra), esse card específico usa o time da label, não o padrão do
  import.
- O fuzzy `includes()` genérico nunca mais compara contra as 10 tags
  fixas de Submarca — evita esse "roubo" de match por acidente; sem um
  match de Prioridade 1/2, a label vira uma tag nova de verdade
  (visível, corrigível na mão) em vez de silenciosamente cair no time
  errado.

Hotfix urgente — usuário no meio de um import real quando os dois bugs
apareceram. Aplicado direto em dev e prod juntos.

### v8.30.206 — 2026-08-04 · hotfix
**"🗑 Excluir todos os cards" (`zerarBoard()`) não excluía de verdade.**
Reportado pelo usuário: precisava limpar o squad "site" (Hering) antes
de um import do Trello, e os cards voltavam depois de excluir.

Causa raiz: o fix de banda desta mesma sessão (`fbSaveAll` com
`touchedIds`, ver v8.30.201/203) introduziu `cards_index` /
`cards_updated_at` / `cards_archived` como os índices que o
carregamento em duas etapas (`_twoPhaseCardsLoad`) usa pra decidir
quais cards existem — mas `zerarBoard()` só zerava `/cards`, sem tocar
nesses três índices paralelos. Resultado: `cards_index` continuava
listando todos os ids antigos, então qualquer reload (ou outro device
com cache local em IndexedDB) reconstruía o board a partir do cache ou
re-buscava os cards "fantasma", fazendo o botão parecer quebrado.

- `zerarBoard()`: agora zera `cards` + `cards_index` +
  `cards_updated_at` + `cards_archived` num único `update()` atômico
  (mesmo padrão do `fbSaveAll`), e limpa o espelho local
  `window._cardsByKey` na hora — sem esperar o próximo evento remoto
  pra sumir de fato da tela.

Hotfix urgente (usuário bloqueado num import em andamento) — aplicado
direto em dev e prod juntos, sem esperar o ciclo normal de validação.

### v8.30.205 — 2026-08-04 · pausa de custo
**Spotify pausado** — a pedido direto do usuário, por causa do custo de
Cloud Function acima do esperado. `functions/spotify/sync.js`
(`spotifySync`) era a ÚNICA function agendada de todo o projeto: rodava
a cada minuto, 24h/dia, todo dia, com um `_sleep(30000)` interno
(simulando cadência de 30s já que o Cloud Scheduler não agenda abaixo
de 1 minuto) — na prática ficava ativamente rodando ~30-35s de cada
60s, o dia inteiro, **mesmo sem ninguém com o Spotify conectado**.
Nenhuma outra function do projeto é agendada; todas as outras só
custam quando alguém de fato usa.

- `functions/index.js`: export de `spotifySync` comentado (não
  deletado — fica pronto pra religar depois de uma análise de custo,
  ex.: cadência maior ou só rodar com gente conectada). **Só entra em
  vigor de verdade quando alguém rodar `firebase deploy --only
  functions` numa máquina com Firebase CLI autenticado** — esta sessão
  não tem credencial de deploy de Cloud Functions. Até lá, a function
  continua rodando (e cobrando) em produção; a ação mais rápida pra
  parar o gasto AGORA é pausar o job do Cloud Scheduler
  (`firebase-schedule-spotifySync-us-central1`) direto no console do
  Google Cloud — reversível com 1 clique, sem precisar de deploy.
- Botão "🎧 Spotify" escondido do board (`#spotify-tab`, e a aba
  correspondente na Central de Ajuda) — sem o sync alimentando dado
  fresco, o painel só mostraria presença desatualizada. Código/UI do
  Spotify continuam intactos (só escondidos), prontos pra reativar.

Achado incidental: o `CLAUDE.md` descrevia "a única Cloud Function"
como sendo só `sendPushOnNotification` — na verdade o projeto tem 11
functions exportadas (push, Agente Ágil, e 8 relacionadas a Spotify).
Vale corrigir a documentação numa próxima passada.

### v8.30.204 — 2026-08-04 · PR #154, #155, #156, #157, #158
Promove pra prod, a pedido direto do usuário — cinco entregas
acumuladas no dev desde a v8.30.203:

- **PR #154** — Submarca vira 10 tags (5 marcas × Comercial/Cadastro,
  antes só 5). O filtro rápido do header virou um menu suspenso
  "🏷️ Submarcas ▾" (não cabia mais como fileira de botões); também
  move `⏱ Relatórios de Tempo` da toolbar pra dentro de `📊 Dados do
  Board`. Cards com as 5 tags antigas (`tag_sm_adulto` etc.) ficam
  órfãos — reatribuir manualmente se algum já tiver sido usado.
- **PR #155** — hotfix: o menu de Submarcas não abria (painel
  `position:absolute` cortado por um ancestral com `overflow-x:auto`)
  e foi movido do header pra toolbar, logo depois de Filtros.
- **PR #156** — import do Trello vincula direto na tag de Submarca
  quando a label bate exato com uma das 10 opções; peixinhos do fundo
  viram preferência pessoal (clique no 🐟 do título liga/desliga,
  salvo por navegador).
- **PR #157** — hotfix: `ReferenceError` de temporal dead zone no
  toggle dos peixinhos travava o carregamento do board inteiro.
- **PR #158** — visual do menu de Submarcas melhorado: agrupado por
  marca (nome em destaque, Comercial/Cadastro indentado embaixo em
  vez de repetir "Hering X" dez vezes), hover nas linhas, "Todos"
  destacado.

Detalhes completos nas entradas `kanban-dev.html v8.30.259-dev` a
`v8.30.263-dev` abaixo. `diff kanban.html kanban-dev.html` antes desta
mudança mostrou só essas cinco entregas mais a string de versão/
`VERSION_KEY` — promoção limpa.

**Ressalva**: promovido a pedido explícito do usuário. Checagem de
sintaxe (`node --check`) passou limpa; este arquivo não tem suíte
automatizada (ver `CLAUDE.md`).

### v8.30.203 — 2026-08-04 · hotfix
**Hotfix de emergência**: a CSS do PR #147 (filtros rápidos de submarca
não quebrarem linha, promovido em v8.30.201) quebrava o header inteiro
— reportado ao vivo pelo usuário ("quebrou foi tudo no layout agora").
`flex-grow:1;flex-shrink:0;flex-basis:auto` em `#submarca-quickfilters`
colapsava a distribuição de espaço do `.hd`: tudo (filtros + avatares
+ botões) empilhava no canto direito, com um vão vazio enorme entre o
nome da squad e os filtros.

Revertido pra `flex:1` (o que já funcionava pra centralizar/crescer a
div), mantendo só `flex-wrap:nowrap` (pílulas não quebram linha) e
`overflow-x:auto` (rede de segurança).

Promovido direto, sem esperar o ciclo normal de validação em dev — bug
visível afetando todo mundo com o board aberto. Só essa linha de CSS
mudou; o resto do dev (Central de Ajuda, PR #153) fica pra promoção
separada depois de validado.

### v8.30.202 — 2026-08-04 · PR #150
Promove pra prod, a pedido direto do usuário: card não salva mais sem
prazo nem sem submarca (quando o squad usa Submarca).

- **Submarca obrigatória** (só quando `submarcaAtivo`) — não dá pra
  salvar um card sem escolher qual submarca é.
- **Prazo obrigatório em todo squad**, com escape hatch: botão "🚫 Sem
  prazo definido" embaixo do campo Prazo satisfaz a exigência sem
  precisar chutar uma data (mutuamente exclusivo com escolher uma data
  de verdade). Persiste como `card.noDue`.

Vale pra criação E edição pelo modal; não afeta autosave (cards antigos
sem esses campos continuam salvando outras mudanças normalmente) nem
criação de cards fora do modal (Trello, recorrentes/agendamentos,
Agente Ágil). Detalhes completos na entrada `kanban-dev.html
v8.30.256-dev` abaixo. `diff kanban.html kanban-dev.html` antes desta
mudança mostrou só essa entrega mais a string de versão/`VERSION_KEY`
— promoção limpa.

**Ressalva**: promovido a pedido explícito do usuário. Checagem de
sintaxe (`node --check`) passou limpa; este arquivo não tem suíte
automatizada (ver `CLAUDE.md`).

### v8.30.201 — 2026-08-04 · PR #146, #147, #148
Promove pra prod tudo que estava acumulado no dev, a pedido direto do
usuário ("pode subir tudo que tá pendente pro prod, já aprovei") — três
entregas:

- **PR #146** — corrige a causa raiz do consumo alto de banda (~1GB/dia
  em `outlet-crm`/`outlet`): `fbSaveAll()` carimbava `updatedAt` novo em
  todos os cards do squad a cada save estrutural, não só nos tocados
  pela operação, invalidando de uma vez o cache local de qualquer outro
  cliente com o board aberto e forçando fallback caro pra todo mundo.
  Ganhou um segundo parâmetro (`touchedIds`) e todos os call sites do
  arquivo foram convertidos pra passar a lista certa.
- **PR #147** — dois ajustes nos filtros rápidos de submarca (squad
  `site`, feedback direto do time): a fileira de pílulas parou de
  quebrar linha quando não cabia tudo (agora é a barra de avatares
  online que cede espaço primeiro) e passou a permitir marcar mais de
  uma submarca ao mesmo tempo.
- **PR #148** — import do Trello: membro sem match no board agora
  ganha uma tag "👤 Nome" nos cards em que está vinculado (responsável
  ou participante), em vez do vínculo simplesmente desaparecer —
  facilita reatribuir em lote quando essa pessoa se cadastrar de
  verdade no squad.

Detalhes completos nas entradas `kanban-dev.html v8.30.253-dev` a
`v8.30.255-dev` abaixo. `diff kanban.html kanban-dev.html` antes desta
mudança mostrou só essas três entregas mais a string de versão/
`VERSION_KEY` — promoção limpa.

**Ressalva**: promovido a pedido explícito do usuário ("já aprovei").
Checagem de sintaxe (`node --check`) passou limpa; este arquivo não tem
suíte automatizada (ver `CLAUDE.md`).

### v8.30.200 — 2026-08-03 · PR #139, #140, #141, #142, #143, #144
Promove pra prod tudo que estava acumulado no dev — seis entregas, a
pedido direto do usuário:

- **PR #139** — diagnóstico do fallback bruto de `/cards` (nenhuma
  mudança de comportamento): registra o motivo exato toda vez que
  `_twoPhaseCardsLoad()` desiste do caminho barato, em
  `_debug_fallback_log`. Relevante direto pra produção: a investigação
  de banda que motivou isso (`outlet-crm`/`outlet`, ~1GB/dia) é em
  squads de produção, não dev.
- **PR #140** — badge 🚧 de impedimento no título do card (mesmo padrão
  do 🎯 de OKR, via `_cardIsBlocked()` — funciona nos dois modos de
  impedimento) + bordas vermelha/dourada de 1px pra 2px (fino demais
  pra notar de relance, feedback do time) + trava de edição concorrente
  (lock por card, banner + modo leitura quando outra pessoa já está
  editando, libera sozinha quando fica obsoleta ou a outra pessoa
  fecha o modal).
- **PR #141** — campo dedicado "🏷️ Submarca" no card (Hering
  Adulto/Kids/Sports/Intimates/Teens), toggle por squad + visibilidade
  individual por marca em Configurações, filtros rápidos no board —
  peça que faltava pra migração do Site Hering (1 board só, em vez de
  vários por submarca).
- **PR #142** — select opcional em Configurações > Importar: aplica
  uma tag a todos os cards de um import do Trello (evita marcar
  submarca card por card ao importar vários boards pro mesmo squad).
- **PR #143** — corrige os filtros rápidos de submarca quebrando o
  layout (fileira própria) — movidos pra dentro do header, mesma linha
  do nome da squad e avatares online.
- **PR #144** — campo "Executor" ao lado de "Submarca" no modal do
  card (pedido direto), em vez de cada um na própria linha.

Detalhes completos nas entradas `kanban-dev.html v8.30.247-dev` a
`v8.30.252-dev` abaixo. `diff kanban.html kanban-dev.html` antes desta
mudança mostrou só essas seis entregas mais a string de versão/
`VERSION_KEY` — promoção limpa.

**Ressalva**: promovido a pedido direto do usuário ("pode subir tudo
que tá pendente pra prod"). Validação manual explícita no dev só
existe pra uma das seis entregas (a trava de edição concorrente, PR
#140 — "funcionou!", confirmado ao vivo em duas abas); as outras cinco
foram revisadas por leitura de código + checagem de sintaxe, sem teste
manual no navegador antes desta promoção. Duas delas nascem
desligadas por padrão em toda squad, inclusive `site` — ainda
precisam ser ativadas manualmente em Configurações antes de fazerem
qualquer diferença: o campo de Submarca (PR #141) e, por consequência,
o select de tag do import do Trello (PR #142) só faz sentido depois
disso.

### v8.30.199 — 2026-08-01 · PR #123, #124, #125, #126
Promove pra prod toda a investigação de consumo de banda do RTDB,
validada no dev — quatro entregas acumuladas desde a última promoção:

- **PR #123** — corrige contagem em dobro no medidor de bytes
  (`debugBytesRemote`): 4 pontos chamavam `fbGet()` (que já rastreia
  sob o path bruto) e depois rastreavam a mesma leitura de novo
  manualmente sob um rótulo agregado.
- **PR #124** — cards arquivados deixam de entrar na carga inicial do
  board; só são buscados quando alguém abre a tela de Arquivados. Era
  a causa real do consumo alto: o fallback usado quando não há cache
  local (1ª visita, aba anônima, cache limpo) baixava TUDO de uma vez,
  arquivados inclusos.
- **PR #125** — corrige `ReferenceError: _ensureArchivedCardsLoaded is
  not defined` (bug de escopo — função local a `fbLoadAll()`,
  chamada de fora sem passar por `window.`).
- **PR #126** — corrige card arquivado "ressuscitando" como ativo após
  reload (usava cache local desatualizado de quando o card ainda era
  ativo).

Detalhes completos nas entradas `kanban-dev.html v8.30.243-dev` a
`v8.30.246-dev` abaixo. `diff kanban.html kanban-dev.html` antes desta
mudança mostrou só essas quatro entregas mais a string de
versão/`VERSION_KEY` — promoção limpa.

Promovido após validação manual do usuário em produção-equivalente no
dev (os dois bugs reais dos PRs #125/#126 foram encontrados e
corrigidos justamente por causa dessa validação).

### v8.30.198 — 2026-07-31 · PR #121
Promove pra prod a limpeza visual da barra de botões do rodapé do modal
do card, validada no dev (`v8.30.242-dev`) — Arquivar e Milanote
saíram dos estilos destoantes (teal e chip preto customizado) e foram
pro mesmo outline neutro do resto dos botões utilitários. Só Excluir
(vermelho), Insights (teal) e Salvar (azul preenchido) mantêm destaque
visual, cada um com significado próprio. Sem mudança de comportamento.
Detalhes completos na entrada `kanban-dev.html v8.30.242-dev` abaixo.

`diff kanban.html kanban-dev.html` antes desta mudança mostrou só essa
entrada mais a string de versão/`VERSION_KEY` — promoção limpa.

Promovido sem validação manual prévia — a pedido direto do usuário logo
após o merge do PR #121 pro dev.

### v8.30.197 — 2026-07-31 · PR #118, #119
Promove pra prod duas leva de melhorias acumuladas no dev desde a última
promoção (`v8.30.240-dev` e `v8.30.241-dev`), sem validação manual prévia
do usuário — promovido direto a pedido, ver ressalva abaixo.

- **PR #118** — usar um modelo salvo da squad dentro de um card já aberto
  (mescla com o que já existe, nunca sobrescreve) e, no modal de
  duplicar, escolher a coluna de destino da cópia (+ abrir a cópia
  automaticamente depois de duplicar). Detalhes completos na entrada
  `kanban-dev.html v8.30.240-dev` abaixo.
- **PR #119** — corrige dois bugs reais de gestão de usuário externo:
  exclusão que não pegava (usuário reaparecia sozinho no próximo login)
  e adicionar externo numa squad nova que não dava acesso de fato (login
  continuava redirecionando pra outra squad). Detalhes completos na
  entrada `kanban-dev.html v8.30.241-dev` abaixo.

`diff kanban.html kanban-dev.html` antes desta mudança mostrou só as
mudanças dessas duas entradas (mais a string de versão/`VERSION_KEY`) —
promoção limpa, sem contaminação de trabalho não relacionado.

**Ressalva**: diferente do processo normal (dev-first → validação
explícita → promoção), essa promoção foi feita a pedido direto do
usuário logo após o merge do PR #119 pro dev, sem validação manual
prévia do fix de usuário externo em produção.

### v8.30.196 — 2026-07-31 · PR #117
Promove pra prod toda a integração com Spotify, validada em produção
(conectar, trocar de conta, desconectar, "ouvindo agora" ao vivo, Rádio
do Maré — playlist colaborativa por squad + geral, controle de playback
pessoal play/pause/próxima), acumulada em 12 PRs no dev
(`v8.30.232-dev` até `v8.30.239-dev`, PRs #105–#116). Promoção limpa:
`diff kanban.html kanban-dev.html` antes desta mudança mostrou só 526
linhas adicionadas (nada removido/alterado fora da string de versão e
`VERSION_KEY`) — o dev nunca teve nada além desse trabalho acumulado
desde a última promoção.

Resumo do que vai ao ar:

- **🎧 Ouvindo agora**: pílula nova no board, mostra o que cada pessoa
  do squad está ouvindo em tempo real (opt-in — só quem conecta a
  própria conta aparece). Tabs Squad/Geral, ordenação por prioridade
  (ouvindo agora > conectado parado > não conectado, e nesse último
  grupo só a própria pessoa aparece). Sync periódico a cada 30s efetivos
  + sync imediato ao abrir o painel.
- **🎵 Rádio do Maré**: playlist colaborativa real do Spotify (uma pra
  empresa toda, uma por squad) — NÃO é ao vivo, cada um ouve no próprio
  ritmo. Busca + sugestão de música direto pelo painel, sem precisar ter
  conectado o próprio Spotify pra sugerir.
- **▶️ Controle de playback pessoal**: play/pause/próxima direto pelo
  painel, pra própria reprodução de cada um (não é um "DJ" tocando pra
  todo mundo).
- Gestão de conta completa: conectar, trocar de conta, desconectar de
  verdade (apaga o token, não só desativa).

6 Cloud Functions novas por trás disso
(`spotifyOauthCallback`/`spotifyDisconnect`/`spotifySync`/
`spotifySyncNow`/`spotifyPlayback`/`spotifyRadioOwnerCallback`/
`spotifyRadioSearch`/`spotifyRadioSuggest` — 8, na verdade), já
deployadas e validadas em produção ao longo do desenvolvimento no dev
(não fazem parte desta promoção — só o HTML/JS do board). Duas correções
de bug reais encontradas e resolvidas durante a validação: migração de
endpoint da Web API do Spotify (`/playlists/{id}/tracks` →
`/playlists/{id}/items`, fev/2026) e um bug de cache de `access_token`
que ignorava reconexões. Detalhes completos e o histórico da investigação
nas entradas `v8.30.232-dev` a `v8.30.239-dev` abaixo e na seção "Cloud
Functions — Spotify" mais adiante neste arquivo — incluindo
`functions/spotify/README.md`, que consolida arquitetura e gotchas.

### v8.30.195 — 2026-07-30 · PR #100
Promove pra prod o fix validado no dev (`v8.30.231-dev`, PR #99): nova
ação em massa **🚧 Impedimento** na barra de seleção múltipla, pra
marcar/remover impedimento em vários cards de uma vez. Respeita o
`blockerMode` do squad (coluna vs tag) via `_cardIsBlocked()` — em modo
"coluna", marcar move os cards pra Impedimentos e remover pede uma
coluna de destino; em modo "tag", marcar/remover só liga/desliga
`card.blocker`+`card.blockerReason`, sem mexer na coluna. De passagem,
corrige a entrada de ajuda "Seleção múltipla" (estava desatualizada,
dizia "seis ações" quando já eram sete). Detalhes completos na entrada
de `v8.30.231-dev` abaixo.

### v8.30.194 — 2026-07-30 · PR #96
Promove pra prod os fixes validados no dev (`v8.30.230-dev`, PRs #94 e
#95):

- **Heartbeat de presença pausa em aba oculta** — evita escrita
  desperdiçada com a aba em background (comum no mobile ao trocar de
  app); a pessoa já aparece "offline" pros outros depois do timeout de
  30s de qualquer forma. Manda um heartbeat imediato ao voltar pra aba.
- **Colunas reordenáveis por toque (mobile)** — cards já tinham touch
  drag-and-drop custom (`addTouchDnD`); colunas só tinham `dragstart`
  nativo do HTML5, que não dispara em touch, e não havia alternativa
  nenhuma. Novo `addTouchColDnD` replica o mesmo gesto de long-press dos
  cards. Ajuda (F1/❓) ganhou entrada documentando o gesto.
- **Limpeza de código morto**: 17 funções órfãs, 2 variáveis órfãs e 8
  regras CSS órfãs removidas (achado por um agente de auditoria dedicado,
  cada item re-verificado manualmente antes de remover). Dois clusters
  (painel "mini dependência", subsistema "Linked Cards") ficaram de fora
  de propósito — precisam de decisão de produto, não são limpeza simples.

Detalhes completos de cada mudança nas entradas de `v8.30.229-dev` e
`v8.30.230-dev` abaixo.

### v8.30.193 — 2026-07-30 · PR #90
Promove pra prod o fix validado no dev (`v8.30.228-dev`, PR #89): reduz o
consumo de leitura do Firebase em boards com muito histórico arquivado.
Novo índice `cards_archived/{cardId}->true` (mantido junto de `cards_index`/
`cards_updated_at` em `fbSaveAll()`/`fbSaveCard()`) permite que o
carregamento em duas etapas (`_twoPhaseCardsLoad()`) pare de reverificar
cards já arquivados a cada sessão — eles só entram em `toFetch` na primeira
vez que o dispositivo os vê, não mais toda vez que o timestamp deles muda.
Achado num squad real (`outlet-crm`): 84% dos 4725 cards estavam
arquivados, e cada sessão baixava esse histórico inteiro de novo, mesmo sem
ninguém abrir a tela de Arquivados — consumo diário tinha saltado de ~156k
pra ~1,3M chamadas em 4 dias. `cards` continua carregando tudo (ativos +
arquivados) — essa mudança só reduz a FREQUÊNCIA de reverificação, não o
que fica disponível localmente. Requer a migração one-off (script enviado
fora do repo) que popula `cards_archived` pros cards já arquivados antes
desta versão, senão eles continuam sendo revalidados até o próximo
arquivamento/desarquivamento real.

### v8.30.192 — 2026-07-30 · PR #88
Promove pra prod o fix validado no dev (`v8.30.227-dev`): corrige a CAUSA
RAIZ das tags fantasma (as duas promoções anteriores só mitigavam o
sintoma). O listener ao vivo de `/tags` reatribuía o array `tags` assim
que qualquer atualização remota chegava, sem proteção contra colisão com
edições locais em andamento no editor de tags (diferente do listener de
`cards`, que já tinha essa guarda) — o que podia corromper silenciosamente
o array salvo em seguida, derrubando tags ainda em uso por cards. Agora
ignora a atualização remota enquanto o editor de tags está de fato aberto
e mostrando linhas.

### v8.30.191 — 2026-07-30 · PR #86
Promove pra prod o fix validado no dev (`v8.30.226-dev`): fortalece a
correção de "🔧 Detectar e reparar tags fantasma" pra também cobrir ids no
formato `tag_<Date.now() cru>` (o mesmo esquema que `addTag()` usa pra
tags criadas normalmente pelo time, não só import do Trello) —
`_derivarLabelTagFantasma()` agora rejeita um rótulo derivado que continue
sendo só dígitos, não só a ausência do prefixo `tag_`.

### v8.30.190 — 2026-07-30 · PR #71
Promove pra prod a documentação de "💡 Meus cards" no conteúdo de ajuda
(F1/❓), landed no dev há um tempo (PR #71) mas nunca promovida — mudança
doc-only, sem risco, agora sincronizada com o dev.

### v8.30.189 — 2026-07-30 · PR #83
Promove pra prod o fix validado no dev (`v8.30.225-dev`): "💡 Meus cards"
destacava cards de outra pessoa quando `window._currentUserInit` (recém-
calculado por uma fórmula ingênua a cada login) divergia do `init`
registrado no Firebase, que pode ter sido editado manualmente pra resolver
colisão de iniciais entre pessoas de nome parecido. `autoRegistrar()`
agora usa `existe.init` (autoritativo) pro usuário já cadastrado, em vez do
valor recém-calculado.

### v8.30.188 — 2026-07-30 · PR #81
Promove pra prod o fix validado no dev (v8.30.224-dev): "🔧 Detectar e
reparar tags fantasma" mostrava o ID cru como rótulo (ex.: `1782410107254`)
quando a tag órfã tinha um ID que não segue o padrão `tag_<slug>_<4chars>`
do import do Trello (squads com tags legadas de ID numérico). Extraído pra
`_derivarLabelTagFantasma()`, com fallback claro (`Tag sem nome (<id>)`)
pra IDs fora do formato esperado. Só afeta reparos futuros — tags já
criadas com nome numérico precisam ser renomeadas manualmente no editor.

### v8.30.187 — 2026-07-30 · PR #70
Promove pra prod tudo desde a v8.30.186 (PRs #68 e #69), validado no dev:
"💡 Meus cards" agora encontra e mostra corretamente cards em qualquer
coluna (não só Concluído) — corrige a expansão do limite de renderização
por coluna e a pré-posicionação da rolagem vertical independente de cada
coluna antes da rolagem horizontal final.

### v8.30.186 — 2026-07-30 · PR #67
Promove pra prod tudo desde a v8.30.185 (PRs #64-#66), validado no dev:

- Corrige quebra de linha feia dos botões "💡 Meus cards"/"✕🗑️" na barra
  de Filtros (agrupados, sem `margin-left:auto`, fluem normal com o resto
  da barra).
- Remove o filtro "Qualquer executor", redundante com o seletor 👤/🤝/🤖
  do cabeçalho.

### v8.30.185 — 2026-07-30 · PR #63
Promove pra prod tudo desde a v8.30.184 (PRs #61 e #62), validado no dev:

- Botão "💡 Meus cards" na barra de Filtros — destaca (glow/pulso, sem
  esconder o resto) os cards onde a pessoa é responsável ou participante,
  expande colunas colapsadas que tenham algum, e rola até o primeiro.
- Corrige crash real ao abrir um card com item de checklist sem texto
  (`t` undefined/null) — `renderMd()` chamado sem o fallback `||''` que o
  resto do app já usa, travava a abertura de qualquer card nessa condição.

### v8.30.184 — 2026-07-30 · PR #60
Promove pra prod tudo desde a v8.30.183 (PRs #56-#59), validado no dev:

- **Checklist**: corrige item inteiro ficando `draggable` desde a criação
  (quebrava seleção de texto por mouse — só dava pra selecionar clicando
  dentro e usando Ctrl+A); botão 📋 pra copiar todos os itens de uma vez;
  **@menção** (pessoa ou agente de IA) nos itens, tanto ao criar quanto ao
  editar, com o mesmo autocomplete/notificação de descrição/comentário/PO.
- **Modal do card**: botão ⬇️ fixo no cabeçalho pra rolar até a Descrição.
- **Descrição (principal e adicionais)**: dropdown "Tt" de tamanho de texto
  (Texto normal / Título 1/2/3), inspirado no Trello — dropdown custom
  (não `<select>` nativo, que renderiza fora do alcance do CSS do app).

### v8.30.183 — 2026-07-30 · PR #55
Promove pra prod o fix da PR #54 (validado no dev): ícone quebrado
(`/favicon.ico`, que nunca existiu neste repo) na notificação nativa do
navegador de lembrete de reunião. Trocado por `marinheiro.png`, arquivo
estático real. Mesma classe de bug já corrigida na PR #53 pro push
(`firebase-messaging-sw.js`/`functions/index.js`).

### v8.30.182 — 2026-07-28 · PR #48 · tag `kanban-v8.30.182`
Promove pra prod a correção de um bug real do delta-sync em squads grandes
(PR #47): o cache do carregamento em duas etapas guardava o conteúdo
completo dos cards em `localStorage`, que tem cota pequena (~5-10MB por
site, compartilhada entre todos os squads/páginas do domínio). Em squads
com muitos cards (ex.: `outlet-crm`, 4.690 cards) o JSON serializado
estourava essa cota — o `setItem` falhava em silêncio e o cache nunca
persistia, fazendo o board cair **sempre** no carregamento completo, sem
nenhum aviso visível, justamente nos squads onde a economia mais importa.
Corrigido movendo o cache pra **IndexedDB** (cota bem maior). Confirmado ao
vivo em `outlet-crm` após a promoção: carregamento caiu de ~9.045KB pra
~827KB numa recarga (~91% de redução), buscando individualmente só o card
que de fato tinha mudado.

### v8.30.181 — 2026-07-28 · PR #45 · tag `kanban-v8.30.181`
Promove pra prod tudo validado no dev desde a v8.30.180 (PRs #41, #42, #43,
#44):
- Tags de tamanho de camiseta (**👕 P/M/G/GG**), opcionais por squad —
  ativa em Configurações → Tags (só PO/ADM/Organizador). Provisiona 4 tags
  fixas; o emoji 👕 cresce de fonte conforme o tamanho.
- Ordenação dos cards por tamanho (P → GG), no menu global e por coluna.
- Botão "Prioridade" da toolbar virou **"Ordenação"** (rótulo fixo, mesmo
  padrão de Filtros/Raia — antes mudava de texto conforme o modo ativo).
- Campo dedicado "👕 Tamanho" no modal do card (exclusivo, ao lado de
  Prioridade) e filtro dedicado de tamanho na barra de Filtros, separados
  do campo/filtro genérico de tags.
- Correções no conteúdo de ajuda: notificação de mudança de coluna que
  faltava na lista, lista de abas de Configurações desatualizada (faltavam
  Fluxo, Calendário e Criativos), dicas novas pras abas Fluxo e Ficha de
  Criativo (que nunca tinham nenhuma).

### v8.30.180 — 2026-07-28 · PR #39 · tag `kanban-v8.30.180`
Promove pra prod o **carregamento em duas etapas dos cards** (delta-sync),
validado no dev desde a v8.30.204-dev (PRs #34, #35, #38): em vez de
`onChildAdded` direto em `/cards` (baixa o board inteiro toda vez que é
aberto), lê primeiro os índices pequenos `cards_index` +
`cards_updated_at`, compara com um cache local por squad, e busca
individualmente só os cards novos/mudados — cai automaticamente no
carregamento completo de sempre quando não há cache, mudou demais desde
a última visita, ou o board ainda não tem `cards_updated_at` migrado
(nunca perde nem atrasa a exibição de um card). Validado ao vivo numa
squad real (`ecomm`) antes da promoção: edição de card caiu de ~46,5KB
pra ~4,3KB no reload, exclusão não reaparece, sincronização ao vivo
entre abas funcionando.

### v8.30.179 — 2026-07-27 · PR #33 · tag `kanban-v8.30.179`
Promove pra prod tudo que tinha sido validado no dev desde a v8.30.178:
- Nova notificação **`notifMoved`**: card mudando pra qualquer coluna que
  não seja "Concluído" (que já tinha `notifDone` dedicada) agora notifica
  dono/participantes também — antes só coluna de conclusão disparava algo.
  Só sino, sem push, mesmo padrão de `done`/`checklist`.
- **Editar um comentário existente agora dispara `@`menção** — antes só
  criar um comentário novo chamava `parseMentions()`.

(A causa raiz de fundo — regra do Realtime Database bloqueando notificação
entre membros comuns, e depois bloqueando convidados com email fora do
domínio — foi corrigida em `database.rules.json`, não em `kanban.html`; ver
seção própria mais abaixo.)

### v8.30.178 — 2026-07-27 · PR #28 · tag `kanban-v8.30.178`
Promove pra prod tudo que tinha sido validado no dev desde a v8.30.177:
- **Notificação por @menção nunca disparava quando o card era salvo só
  pelo autosave** (o caminho mais comum — quase ninguém clica no botão
  "Salvar" manual): `scheduleAutoSave()` replicava os outros 5 gatilhos de
  notificação (atribuído/desbloqueado/concluído/risco/checklist), mas não
  chamava `parseMentions()`. Corrigido — junto com um bug adjacente onde o
  campo "motivo do impedimento" também não era capturado pelo autosave.
- **Notificação sumia em silêncio quando o dono/participante/mencionado
  não estava mais inscrito no squad atual** (saiu, foi removido, nunca
  "participou" formalmente) — `getUidByInit()` retornava `null` sem
  nenhum aviso. Agora cai pra buscar entre todos os usuários cadastrados
  antes de desistir, e sempre loga um aviso quando realmente não acha
  ninguém.
- Medidor de bytes por path do Realtime Database (`debugBytesRemote()`
  no console): agora também rastreia leituras pontuais (`fbGet()`), não
  só listeners em tempo real, e ganha um rollup diário de 90 dias
  (`debugBytesHistory()`/`debugBytesExportCSV()`) além do log horário de
  7 dias que já existia.

### v8.30.177 — 2026-07-25 · PR #22 · tag `kanban-v8.30.177`
Promove pra prod tudo que tinha sido validado no dev desde a v8.30.176:
- Sistema híbrido humano+agente de IA restaurado (perdido acidentalmente
  num commit anterior sem PR): visão 👤/🤝/🤖, campo Executor + status do
  agente no card, identidades de agente integradas em menções/seletores/
  avatares, ciclo de validar/devolver trabalho do agente.
- Agrupamento manual de campanhas do painel passa a valer no board de
  cada squad (`grupoId`), sem alterar o nome que cada squad enxerga.
- Agente Ágil Sprint 2: resolve "referencia" de negócio (recorrência +
  data) em vez de exigir `cardId` direto — mais o fix do bug de data que
  fazia `recorrenteData` e `createdAt` divergirem por 1 dia perto da
  meia-noite em fusos como o do Brasil.
- Impedimento vazando em squads no modo "tag" (ex.: Outlet Comercial):
  mover card pra uma coluna renomeada (ex.: "Impedimentos" → "Finalizado")
  não marca mais como impedido por baixo dos panos.
- Duplicar card abre modal deixando escolher quais campos entram na cópia
  (Descrição, Checklist, Tags, Responsável, Participantes, Prazo,
  Prioridade, Riscos, Anexos/Links).
- ADM, PO e Organizador podem excluir comentários de qualquer usuário
  (antes só ADM, além do próprio autor).
- "Texto" adicionado às sugestões de Formato da Ficha de Criativo.

### v8.30.176 — 2026-07-24 · PR #13 · tag `kanban-v8.30.176`
Promove pra prod tudo que tinha sido validado no dev desde a v8.30.174:
- Título de card com uma palavra só muito longa (sem espaço) agora quebra
  linha em vez de estourar a largura do card.
- Corrige board abrindo vazio às vezes logo depois do login (só voltava com
  F5): `fbLoadAll()` esperava o SDK do Firebase ficar pronto, não o login em
  si terminar.
- Dropdown de `@`menção/`@card:` na descrição principal passa a abrir perto
  do cursor, em vez de sempre no rodapé do campo inteiro.

### v8.30.175 — 2026-07-24 · PR #10 · tag `kanban-v8.30.175`
Promove pra prod a primeira leva de correções validadas no dev:
- Notificações: dedup determinístico de `@`menção (parava de renotificar a
  mesma menção antiga em todo save subsequente do card); clique na
  notificação navega entre squads e reabre o card certo; menção em
  descrição adicional passa a notificar e ganha o dropdown de
  `@`pessoa/`@card:`.
- Corrige link de card errado ao clicar em `[[CARD:...]]` dentro de
  comentário/descrição.
- Corrige iniciais duplicadas pra mesma pessoa (bug de `c.participantes`
  vs `c.participants` na migração de iniciais).
- Corrige participantes "sumindo" de cards (parsing frágil de DOM
  substituído por array em memória).
- Corrige perda silenciosa de autosave (`fbSaveCard()` sem tratamento de
  erro em `scheduleAutoSave`/`saveExtraDesc`/`toggleCardOKR`) com retry +
  aviso visível.
- Lembrete de acesso ao colar link do ecossistema Google (Docs/Sheets/
  Slides/Drive).

### v8.30.174 e anteriores
Base antes desta leva de trabalho. Ver `git log -- kanban.html` pro
histórico completo (sem tags/changelog retroativo).

## kanban-dev.html (ambiente de teste)

### v8.30.450-dev — 2026-08-21 — Supercard: conclusão automática + fix na duplicação
Dois pedidos direto sobre a área de Supercards:

- **Supercard conclui sozinho quando todos os filhos concluem**: nova
  `_checkSupercardAutoComplete(childCard)`, chamada a cada evento `'move'`
  processado por `runAutoRules()` (cobre drag-drop mouse/touch, o Agente
  Ágil via `mover_coluna`, e a movimentação rápida do modal — os mesmos
  pontos que já disparavam automações). Se o card movido tem
  `superParentId` e TODOS os filhos ativos do pai (`childCardIds`, excluindo
  arquivados) estão numa coluna de fim — `_flowDoneColIds()`, que respeita
  a config do PO em vez de assumir só uma coluna "done" —, o pai vai pra
  lá sozinho também, com histórico registrado ("concluído automaticamente
  — todos os filhos foram concluídos"). Se não sobrar nenhum filho ativo
  (todos arquivados), não decide sozinho. Espelha `_crvPropagateToChildren()`
  (pai→filhos, Ficha Técnica), na direção oposta.
- **Fix: duplicar um card não corrompe mais relações de supercard**.
  `_duplicarCardObj()` faz uma clonagem completa (`JSON.parse(JSON.stringify(card))`)
  e nunca zerava `childCardIds`/`superParentId` — duplicar um supercard
  fazia o clone "herdar" os mesmos filhos do original (dois pais
  reivindicando os mesmos `childCardIds`), e duplicar um filho deixava a
  cópia com `superParentId` apontando pra um pai cujo `childCardIds` nunca
  ia listar essa cópia. Agora todo duplicado nasce como card avulso,
  vinculável na mão depois. **Achado ao investigar um pedido de
  confirmação** de que a Ficha Técnica é duplicada corretamente (confirmado
  que já era — `card.criativo` nunca estava na lista de campos zerados do
  modal de duplicar, então sempre sobrevivia à clonagem).

### v8.30.449-dev — 2026-08-20 — Segurança: whitelist de externos passa a ser chaveada por email
Preparação pro fix de segurança em `database.rules.json` (ver seção
própria mais abaixo neste CHANGELOG) — achado durante uma revisão de
segurança pra internalização do projeto: a whitelist de externos
(`kanban/squads/{squad}/externos`) usava chave aleatória (`ext_`+timestamp),
o que impede a regra do Firebase de validar "esse email está na
whitelist?" sem escanear a lista inteira (rules não fazem isso). Sem essa
validação na regra, a única barreira contra alguém se auto-registrar num
squad sem nunca ter sido convidado por um PO era o JavaScript da tela de
login — contornável por qualquer um que chamasse a função direto no
console.

Mudança: a chave da whitelist passa a ser o próprio email, sanitizado
(`_extKey()`: minúsculo, `.` vira `,` — RTDB não aceita `.` em chave).
`salvarExterno()` já grava no formato novo; o check de login
(`auth-change`) faz lookup direto pela chave (mais rápido) com fallback
pro formato antigo até a migração de dados rodar. `removerExterno()` e
os fluxos de remoção global (painel.html) não mudam — já recebem a chave
pronta de quem lista.

**Passo manual pendente**: rodar o script de migração (re-chaveia as
entradas antigas) e o deploy de `database.rules.json` — ambos fora do
GitHub Pages, feitos à parte pelo responsável pela infra.

### v8.30.448-dev — 2026-08-20 — Supercards/filhos: 3 bugs corrigidos (título travado, objetivo fantasma, busca de filho confusa)
Investigação a partir de 3 relatos de usuário sobre Supercards e cards
filhos:

- **"Não consigo editar o título de um filho, ele volta pro automático"**:
  causa raiz encontrada em `_crvAutoTitle()` — a proteção "só reescreve o
  título em card NOVO vindo de Modelo" dependia só de `_pendingQLSource`,
  que fica setado em `usarQLItem()` mas só era limpo dentro de
  `saveCard()` **na criação bem-sucedida** de um card novo — nunca ao
  cancelar o modal sem salvar. Se a pessoa abrisse "+ Usar" num Modelo e
  desistisse, essa flag ficava presa pelo resto da sessão; qualquer card
  aberto depois (inclusive um filho JÁ SALVO, reaberto bem depois de
  criado) herdava o resíduo e tinha o título reescrito sozinho a cada
  campo da Ficha Técnica mexido. Corrigido com um guard direto
  (`!editingId` — só card ainda não salvo) mais robusto que depender do
  ciclo de vida da flag, e a flag também passou a ser limpa ao fechar o
  modal (não só ao salvar).
- **"Um objetivo que não marquei aparece no título automático"**: mesma
  causa raiz acima — com o título sendo recomposto sem devia, ele reflete
  o que estiver marcado NA HORA (ex.: um Objetivo pré-preenchido por um
  Modelo aplicado, nunca escolhido manualmente pela pessoa). Resolvido
  junto com o fix acima.
- **"Apareceu um card aleatório do board ao criar um filho"**: a busca de
  "card existente pra virar filho" (`searchSuperChildren()`) disparava a
  partir de 1 caractere digitado — um `.includes()` tão curto casa com
  praticamente qualquer card que tenha aquela letra em algum lugar do
  título, parecendo um resultado sem nexo. Agora exige 2+ caracteres
  antes de mostrar sugestões, padrão comum de autocomplete.

### v8.30.447-dev — 2026-08-20 — Fix: "Notificar Agente Ágil" não aparecia na lista de ações
Achado testando a v8.30.446-dev: a opção nem aparecia no dropdown de
ações das Automações, nem no squad `dev`. Causa: `AGENTE_AGIL_ATIVO` é
um interruptor mestre que desliga o painel ANTIGO do Agente Ágil
(`openAgent()`, hoje `false` de propósito) — a ação inteira dependia só
dessa flag pra aparecer, então desligar o painel antigo escondia junto
o "Modo autônomo" novo, que não tem nada a ver com ele. Corrigido:
- A ação agora aparece se o painel antigo estiver ligado OU se o squad
  ativo for `dev` (onde o modo autônomo funciona).
- O dropdown de opções (Aba Daily/Métricas/Retrospectiva vs. 🤖 Modo
  autônomo) só oferece o que realmente funciona no contexto atual — as
  abas do painel antigo somem da lista quando ele está desligado.

### v8.30.446-dev — 2026-08-20 — Automações: modo autônomo pra acionar o Agente Ágil
Item 5 do roteiro do orquestrador (`functions/agente-agil-orquestrador/`):
gatilho automático em mudança de card, plugado nas Automações que já
existem no board em vez de inventar semântica nova de "qualquer mudança
de card" — reusa os gatilhos já validados (`due_today`, `due_overdue`,
`aging`, `unblocked`, `checklist_complete`, etc.).

A ação **"Notificar Agente Ágil"** (`AUTO_ACTIONS.notify_agent`) ganhou
uma 3ª opção — **"🤖 Modo autônomo"** — só visível quando o squad ativo é
`dev` (a Cloud Function `agenteAgilMencao` tem esse squad travado no path
do trigger, literal, não wildcard). Marcada, em vez de abrir o painel
local do Agente Ágil (comportamento de sempre, continua padrão), a
automação escreve um comentário de verdade em `card_comments/{cardId}`
contendo `@Agente Ágil` — entra no MESMO pipeline já validado em produção
pela @menção humana, sem precisar de nenhuma Cloud Function nova. `uid`
do comentário é `'automacao'` (nunca `'agente-agil'` — esse é filtrado
como auto-comentário do próprio agente e seria ignorado). Mesmo ajuste
replicado no caso especial de `wip_exceeded` (fora do loop por-card de
`runAutoRules()`).

### v8.30.445-dev — 2026-08-20 — Busca geral: "Ver N cards no board"
Pedido do time: a busca geral (🔍/Ctrl+K) é ótima pra achar UM card
específico, mas às vezes a pessoa quer ver TODOS os cards que batem com
o termo buscado, dispostos no board (colunas, drag, etc.) em vez de uma
lista. Novo botão **"🔍 Ver N cards no board"** logo abaixo dos
resultados — aplica a mesma busca como um filtro de texto do board e
fecha a busca. Esse filtro de texto também ganhou vida própria: agora
tem um campo dedicado (`🔍 Título, descrição, PO, responsável…`) na
barra de Filtros do board, que dá pra usar direto por lá, sem passar
pela busca geral. Reaproveita os mesmos critérios de busca de sempre
(título, descrição, PO, responsável).

### v8.30.444-dev — 2026-08-20 — Notificações: fim das duplicatas e das menções ressuscitadas
Dois bugs reportados por usuários, mesma área (notificações):
- **Duplicadas**: "Prazo hoje!"/"Prazo atrasado!" (`checkDueNotifs()`)
  criavam a notificação com id aleatório — se várias abas/dispositivos da
  mesma pessoa reavaliassem quase juntos (ex.: todos recarregando ao
  mesmo tempo pelo overlay de auto-atualização), cada um passava pelo
  guard de "já rodou hoje" antes de qualquer um escrever, e cada um criava
  a SUA própria notificação pro mesmo card — várias entradas idênticas,
  todas "há 1min atrás". Corrigido com id determinístico
  (`due_today_{cardId}_{dia}` / `due_overdue_{cardId}_{dia}`), mesmo
  mecanismo que menção/lembrete de reunião já usavam: só a primeira
  escrita realmente cria, o resto bate em "já existe" e não duplica.
- **Menção "ressuscitando"**: notificações de @menção usam id
  determinístico (pessoa+card) desde antes — pra não duplicar em saves
  repetidos do mesmo card. Só que a limpeza por TTL (notificação LIDA some
  depois de 3 dias) apagava o nó de verdade do Firebase; como a @menção
  continua no texto do card pra sempre (ninguém tira uma menção antiga da
  descrição), o PRÓXIMO save recalculava o MESMO id, não achava mais o nó
  (apagado) e recriava do zero como não lida — uma menção de 3+ dias atrás,
  já vista, reaparecendo sozinha. Notificações de id determinístico agora
  ficam marcadas (`noTTLDelete`) e nunca são apagadas do Firebase — só
  saem da lista visível depois do TTL, igual sempre saíram; a diferença é
  que não voltam de novo depois.

### v8.30.443-dev — 2026-08-20 — Pedir o card: força atualização ao herdar o lock
Achado testando a v8.30.442-dev: quando o lock era liberado (manual ou por
timeout do pedido) e a pessoa que esperava herdava o card, a tela
continuava mostrando os campos de quando o card foi aberto — quem editou
antes pode ter mudado título, descrição, checklist etc., e nada
repopulava o modal com o que estava salvo agora no Firebase (o array
`cards` já chegava atualizado, mas o formulário aberto não é redesenhado
sozinho quando isso acontece). Corrigido: ao detectar que acabamos de
herdar o lock vindo de "travado por outra pessoa", o card é reaberto
(`openCard()`) automaticamente, recarregando todos os campos, comentários
e anexos com o estado atual — sem perder o lock recém-assumido.

### v8.30.442-dev — 2026-08-20 — Card travado: botão "🔔 Pedir o card"
Feedback de usuário: quando alguém só tinha o card aberto pra visualizar
(sem editar), quem precisava mexer nele de verdade ficava sem jeito de
avisar — só no privado mesmo ("poderia sair do card?"). Agora, no banner
de card travado, aparece um botão **"🔔 Pedir o card"**. Quem está
editando vê um aviso com contagem regressiva de 5 minutos pra salvar e
sair (ou clicar em "✅ Liberar agora"); se não fizer nada, o card salva e
fecha sozinho quando o prazo acaba, liberando pra quem pediu — cobre
justamente o caso de aba aberta parada. Se o dono do card estiver
offline/com a aba fechada de verdade, quem pediu assume o lock como rede
de segurança, sem precisar esperar os 10min de expiração por heartbeat
que já existiam. Não precisou de mudança no `database.rules.json` (o
pedido usa o mesmo nó do lock, que já tinha permissão de escrita pro
squad) nem de push notification — o aviso é só dentro do app por
enquanto.

### v8.30.441-dev — 2026-08-20 — Card travado: links e menções de card voltam a ficar clicáveis
Feedback de usuário: card travado (outra pessoa editando) virava
modo leitura, mas isso incluía sem querer os links da descrição/
comentário/checklist (`class="desc-link"`) e as menções a outro card
(`class="mention-card"`) — a pessoa que só queria ler um link precisava
pedir pro dono do lock sair do card. A exceção de `pointer-events` que já
existia pra anexos e pro link do Milanote (fix anterior) foi estendida
pra cobrir essas duas classes também. Não muda o comportamento do lock
em si — só libera navegação/leitura, igual já funcionava pra anexos.

### v8.30.440-dev — 2026-08-20 — Checklist: opção de recolher cada checklist do card
Pedido do time: quando o card tem mais de um checklist, a lista inteira
ficava sempre aberta e a visão poluía rápido. Cada checklist agora tem um
botão ▾/▸ no cabeçalho, ao lado do título, pra recolher ou expandir só os
itens (a barra de progresso e o "X/Y · Z%" continuam visíveis mesmo
recolhido, então dá pra acompanhar o andamento sem abrir). O estado
recolhido/expandido é salvo por checklist junto com o card
(`checklistGroups[].colapsado`), então volta do jeito que foi deixado da
última vez que o card foi aberto.

### v8.30.439-dev — 2026-08-19 — Editar modelo (✏️) agora também mostra/salva a Ficha Técnica
Achado ao preparar material de treinamento sobre Modelos: a v8.30.438-dev
fez "Salvar como modelo" gravar a Ficha Técnica e "Usar modelo"
aplicá-la, mas deixou de fora o terceiro caminho — editar um modelo já
existente pelo botão ✏️ (`openQLEdit()`). Esse fluxo abre um card
temporário construído a partir do modelo salvo; como esse card temporário
não recebia `criativo`, a Ficha Técnica aparecia em branco mesmo pra um
modelo que já tinha ela preenchida (confuso, mas o dado salvo não era
apagado — só não aparecia editável ali). `saveCard()` (ramo de edição de
modelo) também não escrevia `criativo` de volta no modelo ao salvar essa
tela. Os dois pontos corrigidos — editar um modelo agora reflete e
permite alterar a Ficha Técnica normalmente, igual todo o resto do
conteúdo do modelo.

### v8.30.438-dev — 2026-08-19 — Modelo (📋) passa a salvar e aplicar a Ficha Técnica
Pergunta direta: "quando um modelo é salvo, as informações da Ficha
Técnica também são salvas?" — não eram. `salvarComoModeloModal()` só
capturava título/tags/descrição/PO/checklist/riscos; a Ficha Técnica do
card ficava pra trás.

- **Salvar como modelo** (📋, dentro do card) agora também grava a Ficha
  Técnica do card (Campanha/Funil/Etapa/Canal/Objetivo/Plataforma/Tipo/
  Formato/Variações/Direcional) — `null` se o card não tinha nada
  preenchido na Ficha.
- **Aplicar o modelo** — tanto criando um card novo pelo drawer de
  Modelos (`usarQLItem()`) quanto usando "📥 Usar modelo" num card já
  aberto (`aplicarModeloNoCard()`) — agora também aplica a Ficha Técnica
  salva no modelo. Pedido explícito: "deixando a pessoa editar" — mesma
  regra "nunca sobrescreve o que já tiver preenchido" já usada pra
  descrição/PO/tags/checklist/riscos: só entra campo a campo onde o card
  AINDA ESTÁ VAZIO (`_mergeModeloEmCardObj()`); tudo continua 100%
  editável depois de aplicado, igual sempre foi.

### v8.30.437-dev — 2026-08-18 — Ficha Técnica compartilhada entre supercard e cards filhos
Pedido direto: dentro de uma campanha, Campanha/Funil/Etapa do Funil/Canal
não mudam entre os cards filhos (só Objetivo/Plataforma/Tipo/Formato/
Variações variam por peça). Antes, a Ficha Técnica inteira simplesmente
sumia do supercard (pedido antigo: "supercard não precisa de ficha, ele já
é a soma dos filhos") — cada filho preenchia esses 4 campos por conta
própria, repetindo a mesma informação N vezes.

- **No supercard**, a Ficha Técnica volta a aparecer, mas só com os 4
  campos compartilhados (Campanha, Funil, Etapa do Funil, Canal) — os que
  variam por peça continuam de fora, cada filho define o dele.
- **Ao salvar o supercard** (botão Salvar, autosave, adicionar/criar filho,
  ou aplicar uma receita de fan-out), esses 4 campos propagam
  automaticamente pra Ficha Técnica de cada card filho — só preenchendo
  quem ainda está vazio nesses campos, nunca sobrescrevendo um valor que o
  filho já tinha (protege dado antigo de squad que já usava supercard antes
  desta feature).
- **No card filho**, esses 4 campos somem da Ficha Técnica dele (vêm
  herdados do pai) — uma notinha no lugar mostra o resumo herdado e linka
  de volta pro supercard. Só os campos que realmente variam por peça
  continuam editáveis ali.
- Card comum (nem supercard, nem filho) continua com a Ficha Técnica
  completa, sem nenhuma mudança de comportamento.

### v8.30.436-dev — 2026-08-18 — Menção de card (@card:) na caixa de comentário não inseria ao clicar
Bug real reportado (mesma usuária que reportou o "Usar modelo", via
compartilhamento de tela): ela digitava `@card:`, achava o card certo na
lista, clicava — e o texto ficava só `@card:`, sem inserir nada.

Causa raiz: a caixa de comentário (`#m-comment-inp`) era o único lugar do
app que ainda usava uma implementação de menção separada e mais frágil
(`handleCommentMentions`/`insertCardMention`), diferente do sistema
robusto já usado em descrição, PO e composer de campanhas
(`initMentionDropdown`/`handleMentionInput`/`insertCardMentionInline`).
Dois problemas nela: (1) a regex exigia um espaço literal depois de
"@card" (`/@card\s+(\S*)$/i`), mas a própria dica na tela mostra
`@card:` com dois-pontos, então na prática caía sempre no fallback
genérico; (2) pior — `insertCardMention()` relia em reler
`ta.selectionStart` no momento do clique, e clicar num item do dropdown
tira o foco/cursor da textarea antes do clique disparar, então a posição
lida no clique já não é mais a posição de onde o "@card:" foi digitado —
resultado: nada é substituído.

Fix: migrado `#m-comment-inp` para o mesmo sistema robusto do resto do
app (`initMentionDropdown('m-comment-inp')`, chamado dentro de
`openCard()` junto com o de PO), que captura a posição do "@" como
parâmetro no momento do render do dropdown — imune a mudança de foco/
cursor entre abrir o dropdown e clicar. Removida a implementação antiga
(`handleCommentMentions`, `insertCardMention`) e a div fixa
`#comment-mention-dd` do HTML. Bônus: como o sistema novo já suporta
menção de pessoa além de card, a caixa de comentário ganha autocomplete
de `@pessoa` de graça.

### v8.30.435-dev — 2026-08-18 — Filtro por nome/tag no botão "📥 Usar modelo"
Pedido direto: com muitos modelos cadastrados, achar o certo no menu
"📥 Usar modelo" (dentro do card já aberto) ficava só de olho, rolando a
lista. Mesmo padrão de filtro já usado no drawer de Modelos (⚡ Funções
→ 📋 Modelos, `ql-f-nome`/`ql-f-tag`) — busca por nome (`oninput`, sem
precisar apertar Enter) e select de tag, os dois combináveis. Índice
original do array é preservado no filtro, então o botão de cada modelo
continua aplicando o modelo certo mesmo com a lista filtrada.

### v8.30.434-dev — 2026-08-17 — Checagem de iniciais repetidas passa a ser board inteiro, não só por squad
Bug real reportado: duas pessoas diferentes ("GS" de Outlet CRM e "GS" de
Site Hering) com a mesma sigla em squads diferentes — "Meu Dia" misturava
os cards de uma na outra. Renomear resolveu o sintoma, mas investigando
mais fundo a causa raiz é mais ampla: iniciais são um campo GLOBAL por uid
(`kanban/usuarios/{uid}.init`), só a CHECAGEM de conflito é que era
squad-scoped em 3 lugares diferentes — permitindo a colisão nascer sem
ninguém perceber.

- **`autoRegistrar()`** (1º login de um usuário novo): antes gerava a
  inicial a partir do nome sem checar conflito NENHUM, nem por squad. Agora
  checa contra `kanban/usuarios_publicos` inteiro e, se colidir, acrescenta
  um dígito automaticamente (ex.: "GS" → "GS2") — sem diálogo (não tem
  onde mostrar erro nesse fluxo), mas não duplica mais às cegas.
- **`confirmarInscricao()`** (tela de confirmar iniciais ao entrar num
  squad): checava só `members` do squad atual — agora busca fresco em
  `kanban/usuarios_publicos` e bloqueia com erro visível se colidir com
  QUALQUER outro uid, de qualquer squad.
- **`editarInicial()`** (ferramenta manual de renomear): já buscava o nó
  global, mas filtrava só gente inscrita no squad ativo — filtro removido,
  agora é board inteiro.

### v8.30.433-dev — 2026-08-17 — Chips do toggle de coluna visíveis em Insights e CFD & Burndown
Correção de cima: a v8.30.432-dev tinha aplicado o EFEITO do toggle
(cards em coluna oculta saindo da conta) em Insights e CFD & Burndown,
mas esqueceu de colocar o CONTROLE visível nessas duas abas — só dava
pra ligar/desligar coluna voltando pra Visão Geral. Usuário perguntou
"onde q ta isso aqui" ao abrir as duas abas e não achar os chips.

- Chips "📍 Colunas na conta" (mesmo componente usado na Visão Geral)
  agora aparecem também no topo da aba Insights (junto de Período/Tags)
  e no topo de CFD & Burndown — mesmo `_bdHiddenCols` compartilhado,
  ligar/desligar em qualquer uma das 3 abas reflete nas outras 2.

### v8.30.432-dev — 2026-08-17 — Toggle de coluna em Dados do Board estende pra Insights e CFD & Burndown
Pedido direto: o toggle de coluna adicionado na v8.30.430-dev (chips
abaixo do gráfico "Cards ativos por coluna", só na aba Visão Geral)
ficava restrito só àquela aba.

- **Insights**: cards em coluna oculta saem de todos os números da aba
  (cards ativos, prioridade, carga por responsável, riscos, aging) e a
  coluna some do donut "OKR por coluna".
- **CFD**: soma com o filtro já existente em ⚙ Config → Fluxo → "Ocultar
  do CFD" — uma coluna some do gráfico se estiver oculta em QUALQUER um
  dos dois, sem um substituir o outro.
- **Burndown**: cards cuja coluna atual está oculta saem do escopo da
  sprint (mesmo espírito de "tirar da conta" aplicado nas outras abas).
- Toggle re-renderiza a aba Insights/Fluxo na hora se ela já estiver
  aberta, sem precisar trocar de aba pra ver o efeito.

### v8.30.431-dev — 2026-08-17 — Ficha Técnica: "Outros" vira o texto especificado (Plataforma e Tipo)
Pedido direto (print de um card com Plataforma "Outros" → "Dafiti" gerando
o título "[Outros] Outros - ..." em vez de "[Dafiti] Dafiti - ...").

- **Tipo ganhou campo "Qual?"**: até aqui só Canal/Objetivo/Plataforma
  abriam um campo pra especificar ao escolher "Outros" — Tipo não tinha
  (a Ficha já tem várias entradas "Outros" na tabela de referência por
  plataforma). Mesmo padrão visual dos outros três.
- **"Outros" some em favor do texto especificado**: em qualquer lugar que
  hoje resolve Canal/Objetivo/Plataforma/Tipo pra exibição — título
  gerado (🪄 Gerar título / auto-título de Modelo), tabela do Controle de
  Criativos, gráficos "Top" do Dashboard, exportação CSV — a opção
  "Outros" agora aparece como o texto que a pessoa escreveu no campo
  "Qual?" (ex.: "Dafiti"), não mais como "Outros" literal. Sem
  especificação preenchida, continua mostrando "Outros" normalmente (sem
  regressão pra dados antigos sem esse campo).
- Estendido pros 4 campos de uma vez (não só Plataforma/Tipo do pedido
  original) por consistência — Canal e Objetivo tinham exatamente o
  mesmo problema latente, só não fotografado no print.

### v8.30.430-dev — 2026-08-17 — Ctrl+S, badge de anexo, filtro "Criado por" e filtro de coluna em Dados do Board
Lote de 4 pedidos diretos:

- **Ctrl+S salva o card**: com o modal de um card aberto, Ctrl+S (ou Cmd+S no
  Mac) dispara o mesmo `saveCard()` do botão 💾 Salvar, sem esperar o
  debounce do autosave (800ms), e bloqueia o "Salvar página" nativo do
  navegador. Fora do modal, o atalho não faz nada.
- **Badge 📎 na visão board**: cards com pelo menos um link/anexo em
  🔗 Anexos e links ganham um indicador 📎 na face do card, ao lado do já
  existente 📌 (Milanote).
- **Filtro "Criado por"**: novo select na barra de Filtros, ao lado de
  Demandante — usa o campo `created` (nome de quem criou o card, gravado
  desde sempre mas nunca virou filtro) e lista os nomes distintos já usados
  nos cards do squad.
- **Filtro de coluna em 📊 Dados do Board**: mesma lógica de
  `hiddenColsBySq`/chips do painel.html, escopada a 1 squad — clique numa
  coluna abaixo do gráfico "Cards ativos por coluna" pra tirá-la (ou trazê-la
  de volta) da conta de TODOS os números da aba Visão Geral (WIP, Throughput,
  bloqueios, etc.), não só do gráfico. Preferência salva no localStorage por
  squad.

### v8.30.429-dev — 2026-08-15 — Auto-scroll de coluna durante drag-and-drop
Bug de UX real reportado: reordenar manualmente um card do meio de uma
coluna longa pra primeira posição exigia soltar o card, rolar a coluna na
mão, pegar o drag de novo, repetir — sem auto-scroll nas bordas, virava
várias tentativas seguidas em colunas com mais cards do que cabe na tela.

**Causa**: HTML5 Drag and Drop nativo não rola sozinho containers
internos com `overflow` (só o viewport da página, em alguns browsers) —
`.col-body` nunca teve esse comportamento implementado.

**Correção**: `handleDragOver` passa a rastrear o `.col-body` e o
`clientY` mais recentes do cursor; um loop via `requestAnimationFrame`
(`_autoScrollTick`, independente da frequência irregular do próprio
evento `dragover`) rola a coluna sozinha quando o cursor entra numa zona
de 50px a partir da borda superior/inferior *visível*, com velocidade
crescente quanto mais perto da borda (até ~14px/frame). O loop se
autodesliga quando o drag termina (`handleDragEnd`) ou quando o cursor
sai de vez daquela coluna (`handleDragLeave`), evitando continuar
rolando uma coluna que não está mais sendo sobrevoada. Escopo: só drag
desktop (HTML5 DnD) — o drag touch/mobile (`addTouchDnD`) não suporta
reordenar dentro da mesma coluna hoje, então o bug relatado não se
aplica a esse caminho.

### v8.30.428-dev — 2026-08-14 — Agente Ágil aparece no autocomplete de @menção
Follow-up combinado (mesma causa raiz) de dois achados de UX sinalizados
ao testar o gatilho automático de @menção do Agente Ágil Orquestrador
(`functions/agente-agil-orquestrador/`): (1) ele não aparecia como
sugestão ao digitar "@" num comentário, e (2) mesmo cadastrado pra
aparecer, selecionar inseriria `@agente.gil` em vez do texto certo —
`getMemberHandle()` deriva o texto a partir do nome ("Agente Ágil" →
"agente" + "." + "gil", o "Á" acentuado é removido pela sanitização de
handle, não vira "a", simplesmente some) — não bate com a convenção que
`detectaMencao.js` espera (`"@agente agil"`).

**Correção**: entidade sintética `AGENTE_AGIL_MENTION_ENTRY` (nunca vira
registro real em `dados/agentes` — só o sistema de menção enxerga, não
aparece em seletor de responsável/participantes) aparece no autocomplete
ao digitar "@a"/"@age"/etc., **só nos squads onde o gatilho automático
existe** (`AGENTE_AGIL_MENTION_SQUADS`, hoje só `dev` — mesmo escopo de
`mentionTrigger.js:SQUAD_ID`, pra não sugerir uma menção que não dispara
nada em outro squad). Selecionar (mouse ou teclado) ou usar "↩ Responder"
num comentário do agente insere `@Agente Ágil ` literal, nunca passando
por `getMemberHandle()`.

Bônus encontrado no caminho: a seleção por TECLADO (Enter/Tab) no
dropdown de menção reparsava o texto exibido pra achar o membro de novo
(`activeOpt.querySelector('.mention-init').textContent`) — funcionava
por acaso pra membros humanos, mas quebraria pro Agente Ágil (texto
exibido é o nome, não um handle válido). Trocado por um `data-mention-init`
gravado direto no elemento ao renderizar — mais robusto, corrige de
quebra a mesma classe de fragilidade pra qualquer "agente" cadastrado em
`dados/agentes` também.

**Confirmado ao vivo pelo usuário, pelo fluxo real de UI**: digitou
"@a", "Agente Ágil" apareceu como sugestão, selecionou, o comentário
disparou o gatilho — `editar_campos` adicionou a tag pedida preservando
as existentes, `status:'done'`. Primeira confirmação ponta a ponta do
fluxo de descoberta (autocomplete → seleção → gatilho → escrita), não
só de texto digitado manualmente.

### v8.30.427-dev — 2026-08-14 — Agente Ágil (client-side) passa a respeitar Prazo/Submarca/Ficha Técnica obrigatórios
Pedido direto do PO/organizador do board: as regras de campo obrigatório
que a UI já aplica em `salvarCard()` (Prazo, e Submarca/Ficha Técnica
quando o squad usa) nunca tinham sido replicadas pro Agente Ágil (as
ferramentas `criar_card` e `atualizar_prazo` de `agTools`/`executeTool`,
que já estão em produção) — o agente escreve direto no Firebase via
`fbSaveCard()`, sem passar pelo botão Salvar nem pela validação que vive
só ali. Achado confirmado durante o trabalho do canário 8 do Agente Ágil
Orquestrador (server-side, projeto separado): squad "dev" teve um card
de teste virar card real, e isso levantou a pergunta de fundo sobre se o
agente client-side (já em produção) respeitava as mesmas regras — não
respeitava.

**Correção, nas duas ferramentas que tocam esses campos:**
- `criar_card`: se o squad tem Ficha Técnica ativa (`criativosAtivo`), a
  criação é recusada (o agente ainda não sabe preencher os campos da
  ficha — melhor recusar do que salvar incompleto). Se o squad usa
  Submarca (`submarcaAtivo`), a ferramenta agora aceita um parâmetro
  `submarca` (label exato, ex. "Hering Kids Comercial") — sem ele, ou
  com um valor que não bate com nenhuma opção visível, a criação é
  recusada com a lista de opções válidas. Card criado sem `prazo`
  informado nasce com `noDue:true` (mesma flag do botão "🚫 Sem prazo
  definido" do modal) em vez de ficar num estado que a UI bloquearia.
- `atualizar_prazo`: limpar o prazo (`novo_prazo` vazio) agora também
  marca `noDue:true`, pelo mesmo motivo.

Help content ("Ações que o agente pode executar") atualizado com essas
regras. Fora de escopo por ora: suporte completo aos campos da Ficha
Técnica no toolset do agente (10+ campos, listas fechadas, dependentes
entre si) — fica como recusa segura até virar necessidade real.

### v8.30.426-dev — 2026-08-14 — Rotina de otimização: preconnect órfão pro gstatic.com
Rodada de rotina da auditoria de bytes/performance/mobile (ver v8.30.332-dev
pra origem da skill). Sem asset base64 duplicado (fix da v8.30.332-dev
continua valendo), `setInterval`/`clearInterval` conferidos par a par sem
vazamento novo, `backdrop-filter` em 31 ocorrências (baseline informativo),
import do Firebase modular, viewport/touch DnD intactos.

**Único achado:** o `<link rel="preconnect" href="https://www.gstatic.com">`
no `<head>` ficou órfão desde que o SDK do Firebase foi vendorizado pra
`./vendor/firebase-10.14.1/` (v8.30.412-dev, fix do "query is not defined")
— o comentário ao lado ainda dizia que era "de onde o SDK do Firebase é
importado", mas isso deixou de ser verdade. Removida a linha (nenhuma
chamada de runtime resta pra esse domínio) e corrigido o comentário, que
agora aponta pra onde o SDK realmente vem. Puramente rede/documentação —
sem mudança de comportamento visível.

### v8.30.425-dev — 2026-08-13 — Fase 2 do investimento em custo de Firebase: 📋 Modelos sob demanda
Segunda fase do trabalho de redução de banda do Firebase (ver v8.30.424-dev
pra Fase 1) — pedido direto: "ja vai fazendo as outras fases q a gente sobe
tudo pra prod junto". Foca no nó `ql_items` (Recorrentes, Agendamentos e
Modelos), que carregava tudo de uma vez, sempre, em toda sessão, mesmo
squads com biblioteca grande de Modelos que quase ninguém abre.

**Correção:** o listener de `ql_items` foi dividido em três. Recorrentes e
Agendamentos continuam eager (carregam sempre) — são checados sozinhos
~3.5s depois do board abrir, pra saber se algum item recorrente/agendado
precisa virar card real, então não dá pra adiar. Modelos passou a carregar
sob demanda, só quando a sessão realmente precisa: abrir o drawer "📋
Modelos", usar "📥 Usar modelo" num card, salvar um card como modelo
(botão direto ou clique direito), abrir a aba Automações (usada pra
configurar receitas de fan-out com modelo), ou gerar um backup manual —
mesmo padrão já usado pros cards arquivados.

Todos os pontos que gravavam o nó `ql_items` inteiro (~10 no total,
incluindo dois usados pelo Agente Ágil) passaram a gravar só a sub-lista
que de fato mudou, pra nunca sobrescrever Modelos que aquela sessão nunca
chegou a carregar. O caso do Agente Ágil salvar um modelo (`salvar_modelo`)
ganhou uma checagem específica: como aquele fluxo roda de forma síncrona,
ele recusa educadamente ("tenta de novo em alguns segundos") se a lista
ainda não tiver carregado nesta sessão, em vez de arriscar apagar dado.

### v8.30.424-dev — 2026-08-13 — Fase 1 do investimento em custo de Firebase: piso absoluto no fallback de cards
Primeira fase de um trabalho maior investigando o consumo de banda do
Firebase (motivado pela cobrança que passa a valer em 01/09) — pedido
direto: "retomando aquele ponto de isolar os cards arquivados e modelos,
como podemos prosseguir para isso rodar 100%?". Essa etapa foca só no
fallback do carregamento de cards; Modelos/Recorrentes/Agendamentos
(`ql_items`) fica pra uma próxima fase, por mexer em mais pontos do código.

**Achado (via `_debug_fallback_log`, squad real "outlet"):** o
carregamento em duas etapas desiste e cai no fallback completo (listener
bruto em `/cards` inteiro, sem filtro de arquivados, que soma banda a cada
mudança de QUALQUER pessoa dali em diante) sempre que a proporção de cards
a rebuscar passa de 40% do total ativo — mas essa proporção é RELATIVA.
Um squad pequeno (44-52 cards ativos, no caso) cai nesse fallback repetidas
vezes só por precisar rebuscar 26-49 cards num dia de mais movimento,
mesmo esse número sendo, em termos absolutos, muito mais barato que ligar
um listener vitalício no board inteiro.

**Correção:** o limite agora usa o MAIOR valor entre a proporção de 40% e
um piso absoluto de 150 cards a rebuscar. Squads pequenos/médios (a
maioria) deixam de cair no fallback por causa só da proporção — só caem
quando o número absoluto de fato justifica. Squads grandes (onde
`ativos × 40%` já passa de 150 sozinho) não mudam de comportamento nenhum.

Também explica um segundo padrão encontrado (squad "outlet-crm", consumo
com cara de fallback mas sem registro novo no log dos últimos 7 dias):
a decisão de cair no fallback só é tomada uma vez, no carregamento da
página — uma aba aberta há mais de uma semana pode estar presa nesse modo
até hoje, sem gerar log novo. Promover esta correção pra prod força (via
o mecanismo de auto-update já existente) um reload em toda sessão aberta,
o que reavalia essa decisão do zero pra todo mundo, inclusive sessões
presas — resolve os dois achados com a mesma entrega.

### v8.30.423-dev — 2026-08-13 — Ficha Técnica: novas opções + "Outros" com campo pra especificar; fix no "Meu Dia"
Duas coisas represadas (pedido direto: "não sobe... deixa só salvo, quando
eu liberar você sobe" — time estava corrigindo os modelos em dev ao mesmo
tempo), liberadas agora.

**Ficha Técnica** — pedido do time de mídia criativa (print com o texto em
vermelho marcando o que faltava):
- **Canal**: nova opção "Mktpace".
- **Formato**: nova opção "Impresso".
- **Objetivo** e **Plataforma**: a opção "Outros" agora abre um campo
  "Qual?" pra especificar em texto livre — mesma mecânica que o Canal já
  tinha, adaptada pros dois campos serem de múltipla escolha (checkbox).
  Plataforma funciona nos dois modos (seleção única / múltipla quando
  supercard).
- Como essas listas são configuráveis por squad (⚙ Config → Criativos →
  "Opções da Ficha Técnica"), squads que já ativaram o recurso não ganham
  "Mktpace"/"Impresso" automaticamente — é só adicionar por lá, ou pedir
  pra alguém com acesso.

**Fix: card concluído aparecendo como atrasado no "Meu Dia"** — reportado
pelo time em teste real. "Meu Dia" (cards de todos os squads que a pessoa
participa) decidia se um card de OUTRO squad estava "concluído" só
adivinhando pelo NOME da coluna (regex `conclu|cancel|done|finaliz`) — se
a coluna de fim daquele squad tivesse um nome fora desse padrão (ex.:
"Aprovado", "Publicado", "No ar"), o card nunca era reconhecido como
concluído e aparecia como atrasado pra sempre, mesmo pronto. Corrigido pra
usar a config de fim (`doneCols`, ⚙ Config → Fluxo) do PRÓPRIO squad de
cada card quando ela existe — mesma prioridade que o squad ativo já usa —
só caindo na adivinhação por nome se aquele squad nunca configurou nada.
Não custa nenhuma leitura extra: o dado já vinha de graça no mesmo fetch
que "Meu Dia" já fazia (comentário antigo no código dizia o contrário,
por engano).

### v8.30.422-dev — 2026-08-13 — Filtros no Dashboard do Controle de Criativos
Pedido direto: "coloca, lá no dash do controle de criativos, filtros! tag,
responsável, demandante, data (setar a escolha do usuário) e mais filtros
que julgar interessante". A aba 📋 Lista já tinha filtros próprios (Canal,
Objetivo, Plataforma, Formato, Prazo, Prioridade, Qtd); a aba 📊 Dashboard
não tinha nenhum — os cards de resumo, donuts e barras sempre olhavam pro
squad inteiro.

- Nova barra de filtros na aba Dashboard: **🏷 Tag** (só as que aparecem
  nos pedidos, evita opção que nunca bate com nada), **👤 Responsável**,
  **📢 Demandante** (só aparece se o squad tem o campo ativado), **📍
  Coluna** e **🚦 Prioridade**.
- **Período**: em vez de presets fixos (como o "Atrasado/Próx. 7 dias" da
  Lista), aqui é livre — escolhe se filtra por 📅 Prazo ou 🕐 Data de
  criação, e define De/Até com dois campos de data.
- Todos os gráficos e cards de resumo (Total, Concluídos, Atrasados, Em
  andamento, Variações, Por lista/canal/plataforma/formato, donut de
  prioridade) recalculam em cima do resultado filtrado — filtrar por uma
  Tag, por exemplo, já refaz todos os breakdowns só com esses cards, sem
  precisar sair do Dashboard pra Lista.
- Contador "mostrando X de Y" quando algum filtro está ativo; botão
  "✕ Limpar" volta tudo ao squad inteiro.

### v8.30.421-dev — 2026-08-12 — Central de Ajuda: sincroniza com as features desta sessão
Rotina `/atualizarhelpcontent` — puramente documentação, sem mudança de
comportamento. Achados (mesmo padrão que motivou a criação da skill:
funcionalidade evoluiu, texto inline foi atualizado, `HELP_CONTENT` ficou
pra trás):

- **Campo Demandante**: não tinha NENHUMA entrada na Central de Ajuda —
  só existia como texto inline em Config → Padrões de card. Criada a
  entrada "📢 Campo Demandante", cobrindo o campo em si e a proteção de
  descrição (v8.30.416-418-dev).
- **Backup**: entrada existente só descrevia a exportação manual/e-mail.
  Atualizada com o backup automático semanal no Cloud Storage
  (`weeklyBackup`) e a nova UI "🧯 Restaurar backup" (comparar +
  restaurar individual/todos, v8.30.419-420-dev).
- **Ordenar cards nas colunas**: faltava a opção "🔤 Alfabética (A → Z)"
  (v8.30.415-dev) na lista de modos de ordenação.
- **Ficha Técnica (produção criativa)**: não mencionava o botão "🪄
  Gerar título" nem a automontagem de título em cards de Modelo
  (v8.30.408/410/413/414-dev), nem o total de variações no dashboard.
  Adicionados dois sub-parágrafos à entrada existente.
- **Abrindo configurações**: lista de abas do painel de Config estava
  sem "Padrões de card" (gap mais antigo, não desta sessão — corrigido
  de passagem por estar na mesma área).

### v8.30.420-dev — 2026-08-12 — Comparar com backup: recupera só quem sumiu, sem sobrescrever tudo
Pedido direto logo depois da v8.30.419-dev, pensando no incidente de card
sumido em `midiacriativa` de mais cedo: em vez de só o "Restaurar TUDO"
(substitui o board inteiro), agora dá pra **comparar** o backup carregado
com o board atual e ver exatamente quais cards divergem — com a
possibilidade de trazer de volta só os que realmente sumiram, sem correr
o risco de ressuscitar algo que foi excluído de propósito.

- Novo botão **🔍 Comparar com o board atual**, ao lado do "Restaurar TUDO",
  habilitado assim que um backup válido é carregado (arquivo ou snapshot
  do histórico).
- A comparação lista só os cards que estão no backup mas **sumiram por
  completo** do board atual — nem ativos, nem arquivados. Cards que foram
  arquivados/excluídos de propósito continuam arquivados no board (ou já
  não existem mesmo, se excluídos em definitivo) e não entram nessa lista
  por decisão automática nenhuma — a pessoa que revisa item por item decide
  o que faz sentido trazer de volta.
- Cada card divergente aparece com título, coluna (do backup) e aviso se
  estava arquivado, com botão **↩ Restaurar** individual — ou **↩
  Restaurar todos** pra trazer a lista inteira de uma vez.
- Card restaurado volta pra uma coluna válida do board atual (se a coluna
  original do backup não existir mais, cai na primeira coluna em vez de
  quebrar). Gravação via `fbSaveAll()` com `touchedIds`, mesmo padrão
  seguro do restore completo — `cards_index`/`cards_updated_at` saem
  sincronizados junto.
- Mesma trava de permissão do restore completo (`canBulkDelete()`).

### v8.30.419-dev — 2026-08-12 — Restaurar backup (finalmente um caminho de volta)
Achado ao validar o sistema de backup: a funcionalidade só sabia **exportar**
(baixar JSON, copiar JSON, salvar snapshot no Firebase, listar/baixar
snapshots antigos) — não existia nenhum jeito de pegar esse JSON e repor os
dados no board. Confirmado na prática: colar o JSON do backup no importador
de Trello dá "0 cards" (schemas diferentes, o parser do Trello não reconhece
o formato do nosso backup). Pedido direto: "cria o restaurar backup".

- Nova seção **🧯 Restaurar backup**, na mesma aba ⚙ Config → Backup:
  - Upload de um arquivo `mare-digital-*.json` (baixado antes, ou de um
    snapshot do histórico), com prévia mostrando squad de origem, data,
    quem exportou, quantos cards/colunas — e um aviso destacado se o
    backup for de uma squad DIFERENTE da atual.
  - Cada linha do histórico de snapshots do Firebase ganhou um botão
    "🧯 restaurar" direto, sem precisar baixar e reenviar o arquivo.
  - Confirmação explícita antes de aplicar (`uiConfirm`, modo perigo),
    deixando claro que é uma SUBSTITUIÇÃO completa (cards, colunas, tags,
    config), não uma mesclagem.
  - Só ADM, PO ou Organizador vê/usa a seção (`canBulkDelete()`) — é uma
    ação de alto risco, mesmo padrão de outras ações privilegiadas do
    sistema.
- **Rede de segurança**: antes de sobrescrever qualquer coisa, salva
  automaticamente um snapshot do estado ATUAL numa chave própria
  (`pre_restore_{timestamp}`, não colide com o backup do dia) — se a
  restauração sair errada, dá pra restaurar esse snapshot de volta pelo
  mesmo botão. Essa escrita de segurança usa `window._set()` direto (não
  `fbSet()`, que engole erro silenciosamente) — se ela falhar, a
  restauração inteira é **cancelada antes de mexer em qualquer coisa**,
  em vez de seguir sem rede de segurança nenhuma.
- Escrita final via `fbSaveAll()` (cards + `cards_index`/`cards_updated_at`/
  `cards_archived` recalculados juntos, no mesmo update atômico) — evita
  repetir o bug de índice órfão descoberto essa semana ao copiar cards por
  script direto pro `/cards`.

### v8.30.418-dev — 2026-08-12 — Proteção da descrição: trava a caixa de vez, em vez de reverter depois
A v8.30.417-dev bloqueava com um `.includes()` na hora de salvar, mas o
autosave revertia o valor da textarea **enquanto a pessoa ainda digitava**
(dispara sozinho 800ms depois de cada tecla) — isso entra em corrida com o
teclado e embaralha o texto na tela (reportado: campo virou algo tipo
"testesssssddddddd aaa aaa..."). Pedido direto pra corrigir de vez: "ideal é
que nem conseguisse abrir a caixa de texto sabe... tremesse pra pessoa".

- `eocEdit('desc-eoc')` agora recusa entrar em modo de edição quando o card
  tem Demandante e o texto original ainda não foi apagado/substituído e
  quem está mexendo não é ADM/PO/Organizador — a caixa nem abre, só
  "treme" (animação CSS) e mostra um aviso (throttle de 3s pra não
  spammar toast a cada clique).
- A textarea (`#m-desc`) fica `readOnly` como segunda camada nesse mesmo
  cenário — mesmo que algo force a entrada em modo de edição, não dá pra
  digitar ou colar por cima.
- `scheduleAutoSave()` não mexe mais no valor da textarea (fim da corrida
  com a digitação): se detectar violação, só preserva o conteúdo original
  no que é gravado no Firebase, sem tocar no DOM — o "bloqueio de
  verdade", com o campo corrigido de fato, acontece só no clique em
  Salvar (`saveCard()`), que já não brigava com digitação.
- A indicação visual (borda âmbar + cursor "não permitido") aparece direto
  na caixinha de descrição fechada quando ela está travada, então dá pra
  perceber antes mesmo de tentar clicar.
- Complementar informação continua livre pra qualquer um, sem trava — só
  que agora via "Descrições adicionais" (campo separado), já que a
  descrição principal fica bloqueada por inteiro pra quem não pode editar.

### v8.30.417-dev — 2026-08-12 — Fecha furo na proteção de descrição: substituir também é bloqueado
Achado em teste real, logo depois da v8.30.416-dev: a checagem só
olhava "o campo ficou vazio?" — dava pra contornar selecionando tudo e
digitando por cima (ex.: apagar o texto do demandante e escrever
"testessss"), já que o campo nunca passa por um estado vazio nesse
fluxo. Trocado por uma checagem mais forte: exige que o texto
ORIGINAL continue presente dentro do novo texto (`.includes()`) — bloqueia
apagar ou substituir o que já estava lá, mas ainda deixa livre
complementar/adicionar por cima, pra qualquer um. Ajustado em
`saveCard()`, `scheduleAutoSave()`, badge e textos de ajuda.

### v8.30.416-dev — 2026-08-12 — Proteção da descrição em cards com Demandante
Pedido direto: "avisar/bloquear descrição gerada por um demandante... pra
não perder essa informação sem querer". Card com o campo **Demandante**
preenchido não deixa mais ninguém apagar a descrição por completo — só
ADM, PO ou Organizador (mesmo papel que já libera exclusão em massa,
`canBulkDelete()`).

- Bloqueio nos dois caminhos que gravam a descrição: botão "Salvar"
  (`saveCard()`, mostra aviso e não deixa salvar) e o autosave
  (`scheduleAutoSave()`, dispara sozinho 800ms depois de qualquer
  digitação — sem essa segunda checagem, dava pra contornar o
  bloqueio só apagando o texto e esperando; aqui o campo é revertido
  automaticamente pro texto anterior, com aviso).
- Só trava o **esvaziamento total** de uma descrição que já tinha
  conteúdo — editar/complementar continua livre pra qualquer um.
  Cards sem Demandante, ou sendo criados agora, não são afetados.
- Badge "🔒 Protegida (Demandante)" ao lado do label de Descrição no
  modal, atualizado ao vivo conforme o campo Demandante é preenchido/
  limpo — avisa proativamente, antes de alguém tentar apagar e levar
  o bloqueio de surpresa.

### v8.30.415-dev — 2026-08-12 — Nova ordenação: Alfabética (A → Z)
Pedido direto: nova opção de ordenação de cards dentro da coluna, por
título em ordem alfabética. Entra no mesmo lugar de sempre — botão
↕ Ordenação na toolbar (padrão do board) e no seletor "Visualização"
de ⚙ Config da coluna (override por coluna). `localeCompare('pt-BR',
{sensitivity:'base'})` pra acentuação/maiúscula não bagunçar a ordem
(mesmo padrão já usado pra ordenar pessoas/agentes no resto do app).

### v8.30.414-dev — 2026-08-12 — Botão "Gerar título" + total de Variações no dash
Dois pedidos diretos:

- **Botão 🪄 Gerar título**: no fim da Ficha Técnica, monta o título
  sob demanda com a mesma composição do automático
  (`_crvComposeTitle()`) — mas funciona em QUALQUER card (em branco,
  já existente, não só os restritos a Modelo da v8.30.413-dev), já
  que é a pessoa clicando de propósito, não algo rodando sozinho.
- **Total de variações no dashboard**: novo cartão "🔀 Total de
  variações" em 🎬 Controle de Criativos, somando o campo Qtd de
  variações de todo card com Variações:"Sim" (cards com "Não" ou sem
  preencher não entram na soma).

### v8.30.413-dev — 2026-08-12 — Título automático restrito a cards novos criados a partir de Modelo
Pedido direto do time: "tem como deixar esse título automático só em
cards novos a partir de modelos?" — até aqui, `_crvAutoTitle()` rodava
em QUALQUER card com Ficha Técnica ativa, incluindo cards em branco e
cards já existentes sendo editados depois. Agora só roda quando o
card está sendo criado pela primeira vez a partir de um item de 📐
Modelos — reaproveita `_pendingQLSource` (já existia pra disparar o
trigger "Modelo usado" das Automações), que fica setado com
`tipo:'modelos'` exatamente durante essa janela: de `usarQLItem()` até
o card salvar pela 1ª vez. Cards em branco (`_pendingQLSource` nulo) e
cards já existentes (nunca passam por `usarQLItem()`) ficam de fora
automaticamente, sem precisar de nenhuma checagem extra.

### v8.30.412-dev — 2026-08-12 — SDK do Firebase vendorizado (sai do gstatic.com)
A v8.30.411-dev (trocar a versão pinada do SDK, `10.12.0` → `10.14.1`,
pra mudar a URL e furar um eventual cache velho) **não resolveu** —
mesmo erro `query is not defined`, reproduzido de novo pela mesma
pessoa. Isso descarta "cópia velha presa em cache numa URL
específica": o problema é a própria inspeção de SSL corrompendo o
conteúdo em trânsito, não importa a URL.

**Fix definitivo, sem depender do time de TI**: os 4 arquivos do SDK
modular do Firebase usados aqui (`firebase-app.js`,
`firebase-database.js`, `firebase-auth.js`, `firebase-messaging.js`)
saem de `gstatic.com` e passam a ser servidos do próprio domínio —
`vendor/firebase-10.14.1/` neste repositório, versionados junto com o
resto do app. Baixados do pacote npm oficial `firebase@10.14.1`
(mesmo conteúdo que o gstatic.com serve, publicado pela própria
Firebase); a única alteração foi reescrever a referência cruzada
interna entre eles (`firebase-database.js`/`firebase-auth.js`/
`firebase-messaging.js` importam `firebase-app.js`) de URL absoluta
do gstatic.com pra caminho relativo local. Nenhuma outra linha de
conteúdo tocada. Endpoints de API em runtime (Google Sign-In,
reCAPTCHA, FCM, Firebase Installations) continuam apontando pros
serviços do Google normalmente — só o código do SDK em si passa a vir
da mesma origem que o resto do app (que já comprovadamente funciona
pra essa pessoa, atrás do mesmo FortiClient/FortiGate).

**Trade-off consciente**: perde as atualizações automáticas de
segurança/bugfix do SDK que vinham de graça com a URL "flutuante" do
gstatic.com — de agora em diante, atualizar a versão do SDK exige
baixar os arquivos de novo manualmente (mesmo processo desta entrada)
e trocar o import. Aceitável pelo ganho de não depender de uma CDN de
terceiros que pode ser corrompida por proxies corporativos
man-in-the-middle, fora do nosso controle.

### v8.30.411-dev — 2026-08-12 — Bump do SDK do Firebase (10.12.0 → 10.14.1)
Tentativa de contornar, sem depender do time de TI, a causa raiz
encontrada pro `query is not defined`: uma pessoa tem o **FortiClient
VPN** corporativo sempre conectado (obrigatório, mesmo em casa), cujo
firewall (**FortiGate**) faz inspeção profunda de SSL — intercepta,
descriptografa e re-criptografa todo o tráfego HTTPS da máquina,
independente da rede física (confirmado via certificado raiz
"FortiGate CA" instalado localmente, achado em `certmgr.msc`, e a
política `EnableSha1ForLocalAnchors` com erro em `chrome://policy` —
ambos ligados à conta `@ciahering.com.br`, não a nada de rede). Em
algum ponto dessa interceptação, a resposta de
`firebase-database.js` (gstatic.com) chegava com o binding de `query`
faltando — mesmo com o conteúdo confirmado correto numa inspeção
posterior (bug conhecido dessa categoria de produto: corrupção
intermitente ligada a como o proxy remonta streams de conteúdo).

Pedir pro TI liberar `gstatic.com` da inspeção profunda resolveria
"de verdade", mas trava a agilidade — enquanto isso não acontece, os
4 imports do SDK (`firebase-app.js`, `firebase-database.js`,
`firebase-auth.js`, `firebase-messaging.js`) sobem de `10.12.0` pra
`10.14.1` (mesma major version, sem mudança de API esperada). Muda a
URL inteira que o navegador busca — se o problema for uma cópia
específica presa em cache em algum ponto do caminho (o mais provável,
dado o `age` de ~7 dias encontrado na investigação), a URL nova nunca
foi cacheada por ninguém, forçando um fetch do zero. Não elimina a
causa raiz (o FortiGate ainda pode corromper QUALQUER URL nova no
futuro), mas testa se resolve o caso concreto de agora. O fallback em
`_refreshComunicados()` (v8.30.409-dev) continua no lugar como rede
de segurança, independente disso funcionar ou não.

### v8.30.410-dev — 2026-08-12 — Título automático: colchetes + Tipo no lugar de Formato
Feedback direto do time depois de ver o título automático (v8.30.408-dev)
em uso: sem colchetes, ficava difícil separar visualmente onde terminava
cada pedaço (ex.: Objetivo colado no nome da Campanha, tipo um texto só
"Camiseta Brasil Tráfego"). Formato do título ajustado:

`[Plataforma] Tipo - Campanha [Objetivo] - Etapa do Funil/Funil`

- Plataforma e Objetivo ganham colchetes literais, isolando visualmente
  do resto (Tipo e Campanha, respectivamente).
- **Formato trocado por Tipo** — pedido direto ("no lugar de formato é a
  variável Tipo"); `_crvComposeTitle()` agora lê `m-crv-tipo` em vez de
  `m-crv-formato`. Gatilho de recomposição também migrou: sai do
  `onchange` de Formato, entra dentro de `_crvTipoChange()` (mesmo
  cuidado de antes — só dispara em resposta a uma escolha real da
  pessoa nesse select, `_crvTipoChange()` nunca é chamada
  programaticamente durante `setCriativoFields()`/abertura de card).

### v8.30.409-dev — 2026-08-12 — Blindagem: fallback se query() do Firebase falhar
Investigação extensa em cima do `Uncaught ReferenceError: query is not
defined` em `_refreshComunicados()` reportado por uma pessoa: código
conferido várias vezes contra o que estava realmente sendo servido pra
ela (batia, linha por linha, em dois momentos diferentes, com números de
linha diferentes acompanhando novos commits); confirmado via `import()`
manual no console que o SDK do Firebase exporta `query` normalmente;
descartado cache de HTML/Service Worker (já corrigido e desregistrado),
extensão de navegador (aba anônima), rede corporativa (rede de casa),
antivírus (nenhum instalado) e URL mal formada (reproduzido de novo com
URL limpa, inclusive no Edge). **Sem causa raiz confirmada.**

O que ficou claro, revendo o código: essa exceção é lançada de forma
SÍNCRONA como a 1ª linha de `_initComunicados()` — se acontecer, o
`setInterval()`/listener de `visibilitychange` logo depois nunca chegam
a ser registrados, deixando Mural/avisos quebrados pro resto da sessão
de quem for afetado, em silêncio. Independente de nunca achar a causa
exata, isso não pode continuar quebrando a função inteira: `query()`
agora roda dentro de um try/catch, caindo pro comportamento antigo
(busca a árvore inteira de `comunicados`, sem filtro no servidor — o
filtro de `ativo` já roda no cliente de qualquer forma) se falhar por
qualquer motivo. Sem perda de robustez pra quem nunca teve o problema.

### v8.30.408-dev — 2026-08-12 — Título do card gerado a partir da Ficha Técnica
Pedido direto do time: "definir o nome do Card somente com um nome
simples e o restante puxar os parâmetros que forem preenchidos na
Ficha Técnica". Com a Ficha Técnica ativa (e o card não sendo
supercard — mesma condição que já esconde a seção pra supercards),
o título passa a se recompor sozinho a cada mudança em Plataforma,
Formato, Campanha (tipo + nome), Objetivo, Etapa do Funil ou Funil:

`[Plataforma] [Formato] - [Campanha] [Objetivo] - [Etapa do Funil]/[Funil]`

- Segmentos vazios são ignorados de forma graciosa (sem `" - "`
  sobrando enquanto a Ficha ainda está sendo preenchida aos poucos).
- Campanha usa o nome digitado (`campanhaNome`) quando o tipo é
  Campanha/Ação Comercial; nos tipos Perene/Refresh (sem campo de
  nome), usa o próprio rótulo do tipo.
- Objetivo (múltipla escolha) e Plataforma (múltipla só em
  supercard) entram concatenados com `/` quando há mais de um.
- **Roda só em resposta a uma mudança feita pela pessoa** nesses
  campos — nunca ao só abrir um card já existente (a chamada fica só
  nos `onchange`/`oninput` desses campos específicos, não dentro das
  funções compartilhadas que `setCriativoFields()` também dispara ao
  carregar o card — evita reescrever silenciosamente o título de
  cards antigos só por terem sido abertos).
- Título continua editável na mão a qualquer momento — a próxima
  mudança num campo da Ficha volta a sobrescrever, comportamento
  "ao vivo" escolhido direto pelo time.

### v8.30.407-dev — 2026-08-12 — Badge de Intake vira só o ícone
Feedback direto logo após o teste: o badge "📥 Intake" da entrada
anterior (v8.30.406-dev) parecia uma tag/chip (fundo, borda, texto) —
pedido era pra ficar leve, no mesmo padrão visual do 🎯 de OKR (só o
emoji, sem fundo/borda/texto). Ajustado.

### v8.30.406-dev — 2026-08-12 — Badge e métricas de Intake
Pedido direto: dar visibilidade a cards que vieram do formulário de
intake, e contabilizar o funil (recebidos → aprovados/descartados →
concluídos) em vez de só ter a lista de pendentes.

- **`intakeId` no card**: `saveCard()` grava `intakeId` (o id do
  pedido em `intake_pending`) em todo card criado via "✅ Criar card"
  no painel de Intake — antes esse vínculo só existia enquanto o
  pedido estava pendente (`_intakeOrigemPendingId`, limpo assim que o
  card salvava); agora fica permanente no próprio card.
- **Badge 📥 no card**: cards com `intakeId` ganham um badge "📥
  Intake" no topo, ao lado do 📌 Direcional/🎯 OKR — dá pra saber de
  relance, sem abrir o card, que ele nasceu de um pedido externo.
- **Funil de Intake no "Dados do quadro"**: dois novos cartões de
  métrica — "📥 Pedidos de intake" (total recebido + quantos
  aprovados/viraram card, descartados, pendentes) e "✅ Intake
  concluído" (dos aprovados, quantos já chegaram na coluna
  Concluído). Cards de intake arquivados não entram na conta de
  concluído (podem estar fora da memória — ver
  `_ensureArchivedCardsLoaded`).

### v8.30.405-dev — 2026-08-12
Dois ajustes:

- **Badge do Intake, fix definitivo**: as duas tentativas anteriores
  (v8.30.403-dev, v8.30.404-dev) só reduziam o offset negativo
  (`top`/`right`) tentando escapar do corte da `.toolbar` — funcionava
  parcialmente, mas o badge ficava "flutuando por cima" do texto do
  botão em vez de no canto, ainda meio errado. Solução definitiva:
  parou de ser `position:absolute` tentando vazar pra fora da caixa do
  botão — agora é só mais um item em fila no próprio flex do botão
  (`.btn` já é `display:inline-flex;gap:5px`), sem overlap, sem
  depender do comportamento de overflow de nenhum ancestral nunca mais.
- **Notificação de intake novo** (pedido direto): squad member recebe
  notificação (sino 🔔 + push, ver seção da Cloud Function
  `intakeSubmit`) assim que um pedido chega, disparada pela própria
  Cloud Function — não depende de ninguém com o board aberto no
  momento. Ícone novo em `NOTIF_ICONS` (📥) e `openNotif()` passa a
  tratar `type==='intake'` abrindo o painel de Intake em vez de tentar
  navegar pra um card (que ainda não existe nesse ponto). HELP_CONTENT
  atualizado.

### v8.30.404-dev — 2026-08-12
A v8.30.403-dev não resolveu — feedback direto confirmou que o corte
continuava em cima (`top`), não do lado (`right`). Causa real: a spec
de CSS manda o navegador tratar `overflow-y:visible` como `auto`
sempre que o eixo irmão (`overflow-x`) não é `visible` — não dá pra um
eixo rolar e o outro ficar genuinamente sem corte ao mesmo tempo. O
`overflow-y:visible` da `.toolbar` (de uma correção anterior, outro
elemento) nunca preveniu corte vertical de verdade. `#intake-badge`:
`top:-7px` → `top:-2px`, mesmo raciocínio já aplicado ao `right`.

### v8.30.403-dev — 2026-08-12
Feedback direto com print: o número do badge do botão "📥 Intake" ficava
cortado. Causa: `.toolbar` tem `overflow-x:auto` (rolagem horizontal em
telas menores) — o eixo vertical já tinha sido corrigido antes
(`overflow-y:visible`), mas o badge ainda saía 7px pra fora da borda
DIREITA do botão (`right:-7px`), que podia cair fora da área visível
da rolagem horizontal e ser cortado. Reduzido pra `right:-2px`.

### v8.30.402-dev — 2026-08-12
HELP_CONTENT do "📥 Formulário de intake" atualizado — a entrada
"squad/time solicitante" agora descreve corretamente a lista suspensa
fixa (ver seção da Cloud Function `intakeSubmit` acima), em vez de
"texto livre". Nenhuma mudança de comportamento, só texto de ajuda.

### v8.30.401-dev — 2026-08-12
Dois ajustes pedidos direto no formulário de intake (`intake.html` +
`functions/intake/submit.js`, ver seção própria da Cloud Function) e
no lado do board que revisa os pedidos:

- **Descrição obrigatória** no formulário (antes opcional).
- **Novo campo "Squad/time solicitante"** (texto livre, obrigatório) —
  aparece na lista de pedidos pendentes (📥 Intake) e, ao clicar
  "✅ Criar card", vai pro corpo da descrição igual demandante/contato.
- **Vínculo automático de tag**: se o texto digitado bater (ignorando
  maiúscula/acento, via `_norm()`) com o nome de alguma tag já
  cadastrada no squad que recebe o pedido, essa tag já vem marcada no
  card criado — pensado pro time de Dados e IA, que já usa tags pra
  identificar o squad de origem do pedido. Não bate com nenhuma tag
  existente? Sem problema, só não pré-marca nada (o texto continua
  visível na descrição). HELP_CONTENT atualizado.

### v8.30.400-dev — 2026-08-12
Otimização de bandwidth, achada investigando um aumento de consumo de
download com a instrumentação `_dbg` já existente (ver `debugBytesAllSquads()`
no console): o path `comunicados` sozinho respondia por ~80MB em 7 dias
de amostra (~43KB por chamada, em 1877 chamadas).

**Causa raiz**: `_refreshComunicados()` baixava a árvore **inteira** de
`kanban/comunicados` — ativos **e** inativos/arquivados, todo o
histórico desde sempre — a cada 3 minutos, por aba aberta, de forma
global (não por squad). O badge do Mural, o popup automático e a
listagem do Mural (`renderMuralLista`) sempre filtraram só `ativo:true`
no cliente, DEPOIS de já ter baixado tudo — ou seja, todo comunicado
desativado/arquivado era puro peso morto, repetido a cada poll, pra
sempre.

**Fix**: `_refreshComunicados()` agora usa uma query do Firebase
(`orderByChild('ativo').equalTo(true)`) — filtra no servidor, baixa só
o que já era exibido antes. Comportamento visível idêntico (nada muda
pra quem usa o Mural/popup), só o volume trafegado cai. Adicionado
`.indexOn: ["ativo"]` em `comunicados` no `database.rules.json` pra a
query rodar eficiente no servidor.

`painel.html` (que legitimamente precisa ver os inativos pra
reativar/editar) não foi tocado — só o lado de exibição no board.

**Atenção — passo manual**: como `database.rules.json` mudou, precisa
de `firebase deploy --only database` pra a regra `.indexOn` valer de
verdade (sem isso a query ainda funciona, só sem o índice otimizado no
servidor).

### v8.30.399-dev — 2026-08-11
Terceira rodada de feedback sobre o texto secundário do 🌅 Meu Dia, com
print: a passada anterior (v8.30.398-dev, `var(--txt)` + peso 500 +
opacity .85) resolveu contraste mas trouxe um efeito colateral —
"aspecto meio neon, como se tivesse em negrito, que atrapalha a
leitura". Texto quase branco e quase tão pesado quanto o título, contra
o fundo escuro do card, criava esse halo/brilho.

- `.meudia-row-meta`: peso 500 → 400 (normal), opacity .85 → .72.
  Tamanho (12.5px) mantido — não era o que estava incomodando desta
  vez. Ainda mais legível que o `var(--txt2)` original (pré-v8.30.382),
  sem o efeito de brilho.

### v8.30.398-dev — 2026-08-11
Segunda rodada de feedback direto sobre a legibilidade do 🌅 Meu Dia
("ainda tô achando essa fonte ruim de ler") — a 1ª passada (v8.30.382-dev)
só tinha trocado a cor do texto secundário (`var(--txt3)`→`var(--txt2)`).
Perguntado o que ainda incomodava: tamanho pequeno demais **e** contraste
ainda fraco, os dois.

- Título de cada card no painel: 12px → 14px.
- Linha de baixo (squad/coluna/prazo): 11px → 12.5px, e cor
  `var(--txt2)` (65% opacity) → `var(--txt)` (mesma cor de contraste
  máximo do título, só com `opacity:.85` + peso 500 fazendo a
  diferenciação visual, em vez de depender só da cor).
- Título de cada seção (🚧 Bloqueios, ⏳ Atrasado etc.) e o contador
  redondo ao lado: mesmo tratamento (`var(--txt2)`→`var(--txt)` no
  título da seção, `var(--txt3)`→`var(--txt2)` no contador).
- Espaçamento das linhas um pouco mais folgado (`padding`/`margin-bottom`
  maiores), já que o texto maior precisava de mais respiro.

### v8.30.397-dev — 2026-08-11
Pedido direto: botão "↩ Responder" nos comentários do card. Clicar nele
abre a caixa de comentário já com "@" + o handle de quem fez o
comentário clicado preenchido (mesmo formato `@nome.sobrenome` que o
autocomplete manual insere), cursor no fim, pronto pra continuar
digitando — some se o comentário for de alguém sem cadastro resolvível
(ex.: sistema), sem quebrar nada. Reaproveita o pipeline de notificação
de @menção que já existe (`parseMentions()`, disparado no envio do
comentário) — nenhuma lógica de notificação nova, só um jeito mais
rápido de preencher a menção certa. Nova função `replyToComment()`;
`.comment-actions` ganhou `flex-wrap` pra não estourar em telas
estreitas com o botão a mais. HELP_CONTENT atualizado.

### v8.30.396-dev — 2026-08-11
Pedido direto: supercard não precisa de Ficha Técnica própria, já que ele
é só a soma dos cards filhos — cada filho já tem sua própria ficha
preenchida individualmente, pedir uma ficha "agregada" no pai seria
trabalho duplicado. Em vez de virar um padrão pra time seguir de
memória (risco real de esquecer e travar o save à toa), foi automatizado:

- Assim que um card ganha o primeiro filho, a seção Ficha Técnica **some
  do modal** (não fica só opcional) e para de contar na validação de
  campos obrigatórios do `saveCard()`.
- Reavaliado toda vez que a lista de filhos muda (adicionar/remover
  filho com o modal aberto já reflete na hora), reaproveitando o mesmo
  hook (`renderSuperChildrenList()`) que já reavaliava o modo da
  Plataforma.
- Não destrutivo: se o card já tinha uma ficha preenchida antes de virar
  supercard, o conteúdo continua salvo — só some da tela. Remover todos
  os filhos (voltar a ser card comum) traz a seção de volta.
- Novo helper `_crvUpdateFichaSecVisibility()`, chamado nos 4 pontos que
  antes decidiam a visibilidade da seção só por `criativosAtivo`
  (abertura de card, card novo, toggle da config, listener remoto).
- HELP_CONTENT atualizado.

### v8.30.395-dev — 2026-08-11
Dois pedidos diretos sobre a Ficha Técnica e seus painéis de contagem:

- **Removido "Status de produção"**: era um campo manual redundante —
  a coluna do board já mostra em que etapa cada card está, e isso já
  aparece em "📊 Dados do Board". Removido o campo do modal, a coluna e
  o filtro da tabela do Controle de Criativos, o donut "Por status" e a
  coluna no CSV/importação. Junto saiu toda a automação que tentava
  espelhar a coluna nesse campo (`_crvComputeAutoStatus`/
  `_crvApplyAutoStatus`/`_crvSweepAutoStatus`, ~17 pontos de chamada) —
  ficava sempre defasada pros estados intermediários (Briefing OK,
  Material pendente etc.) que não tinham como derivar sozinhos da
  coluna. Os cards "Concluídos"/"Em andamento"/"Atrasados" do painel
  🎬 Controle de Criativos → Dashboard agora calculam direto da coluna
  do board, sem depender de nenhum campo salvo no card.
- **Total/Cards/Supercards nas contagens**: supercards são só a junção
  de vários cards filhos — não têm "vida própria" como demanda
  independente. Sem tirar ninguém do total, os painéis que contam
  cards agora também separam a composição: novo painel "🧩 Cards vs.
  Supercards" no Dashboard do Controle de Criativos, e o sub-texto de
  "Cards ativos" em 📊 Dados do Board → Visão Geral. Helper novo
  `_cardIsSuperChild()` (reverso de `_cardIsSupercard()` já existente)
  identifica um card filho varrendo `childCardIds` de todo mundo, já
  que não existe campo `parentId` no filho.

### v8.30.394-dev — 2026-08-11
Pedido direto: Direcional de Mídia vira o único campo opcional da Ficha
Técnica — não bloqueia mais salvar o card quando vazio. Label ganhou
"(opcional)" pra deixar claro. Continua com o destaque visual (fundo
amarelo na ficha + badge 📌 no card) quando alguém de fato preenche.
HELP_CONTENT e descrição em Config → Criativos atualizados.

### v8.30.393-dev — 2026-08-11
Ajustes na Ficha Técnica logo após o primeiro teste real, todos
pedidos diretos:

- **BUGFIX real** (causa provável do "faltou colocar" no Canal): squads
  que já tinham a ficha antiga ativada ANTES desta reformulação nunca
  passavam pelo fluxo que semeia as listas padrão (Canal/Objetivo/
  Plataforma/Tipo/Formato) — só quem ativa o toggle NA HORA aciona
  isso. Resultado: Canal (e as outras 4 listas) carregavam
  completamente vazios pra sempre nesses squads. Agora o provisionamento
  também roda no carregamento normal do board (idempotente, só
  preenche o que falta) — não só no toggle interativo.
- **Canal ganhou campo condicional**: escolher "Outros" abre um campo
  de texto pra especificar, igual Campanha/Ação Comercial já tinham.
- **Removido da Ficha Técnica**: "Lista de Criativos" (o Config →
  Criativos → Listas e o filtro por lista na tabela do Controle de
  Criativos continuam existindo, só não fazem mais parte do card),
  "Obs" e "Quantidade de Criativos".
- **Quantidade de Criativos**: saiu do campo obrigatório do demandante
  (fazia sentido tirar — a quantidade real só se sabe depois que os
  designers entregam, pedir pro demandante chutar não ajudava). A
  referência de quantidade por Tipo (da tabela real da Hering) continua
  visível, agora ao lado do campo Variações, só como dica. A coluna
  Quantidade na tabela do Controle de Criativos foi mantida — segue
  disponível pra registrar o total real depois da entrega, sem estar
  mais atrelada à ficha do demandante.
- HELP_CONTENT atualizado.

### v8.30.392-dev — 2026-08-11
Reformulação grande pedida direto: "Ficha do Criativo" vira **Ficha
Técnica**, com uma hierarquia fixa de campos, todos obrigatórios pro
demandante.

**Novos campos** (Config → Criativos, opt-in por squad, como já era):
Campanha (Campanha/Ação Comercial/Perene/Refresh — escolha única, os
dois primeiros abrem um campo de texto pro nome), Funil (MKT/ECM),
Etapa do Funil (AWS/CON/PRF), Canal, Objetivo (múltipla escolha),
Plataforma (única — vira múltipla escolha automaticamente quando o
card é Supercard, isto é, tem cards filhos), Tipo (depende da
Plataforma escolhida), Formato (pré-preenchido pelo Tipo, editável),
Variações (Sim/Não + quantidade), Quantidade de Criativos, e
**Direcional de Mídia** (texto livre, com destaque visual — badge
📌 amarelo no card e campo com fundo destacado na ficha).

**Listas fechadas e configuráveis** — Canal/Objetivo/Plataforma/Tipo/
Formato não aceitam mais texto livre (evita duplicata tipo "vídeo"/
"vídeos"): agora são listas geridas pelo PO em Config → Criativos →
"🗂️ Opções da Ficha Técnica" (mesmo espírito de gerenciar tags),
pré-carregadas com o padrão real da Hering, inclusive a tabela de
referência Tipo × Plataforma × Formato × Quantidade sugerida (ex.:
Pmax → 15 criativos, ideal; mostrado como dica ao lado do campo de
Quantidade, não trava nada).

**Obrigatoriedade**: salvar um card com a Ficha Técnica ativada agora
bloqueia (mesmo padrão de Título/Prazo/Submarca) se qualquer campo da
ficha estiver vazio — toast lista o que falta, campo pisca em
vermelho.

**Controle de Criativos** (tabela/dashboard/filtros/CSV) adaptado pro
novo modelo: Canal/Formato viram select (não mais texto+sugestão);
Objetivo/Plataforma mostram os valores escolhidos (múltiplos) mas sem
edição inline na tabela — abre o card pra ajustar; export CSV ganhou
colunas Tipo e Direcional de Mídia. Import de planilha Excel continua
funcionando, mas entra como texto bruto (não como opção da lista
fechada) até alguém reabrir o card e escolher certo — limitação
aceita, não valia reescrever o import inteiro nesta rodada.

Cards com a ficha antiga (texto livre) não são apagados — ficam
"legados" até alguém reabrir e preencher os campos novos.

HELP_CONTENT atualizado.

### v8.30.391-dev — 2026-08-11
Dois ajustes pedidos direto sobre Fase 5.3 (CFD) e 5.4 (intake):

**📈 Filtro de colunas no CFD** — nem toda coluna do board é "fluxo de
trabalho" de verdade (Backlog, Arquivo, Bloqueios...). Novo campo
`flowConfig.cfdHiddenCols`, configurável em ⚙ Config → Fluxo → "Ocultar
do CFD" (mesmo padrão de checkbox-por-coluna já usado pra início/fim/
relatório/aging). Vazio = mostra todas as colunas, igual antes.

**📥 Intake virou opcional por squad** — novo campo
`agilCfg.intakeEnabled` em ⚙ Config → Ágil (checkbox, ligado por
padrão — precisa de opt-OUT explícito, já que o formulário já estava
ativo em produção pra todo mundo antes deste toggle existir). Desligar:
- esconde o botão "📥 Intake" da toolbar;
- a Cloud Function (`functions/intake/submit.js`) passa a rejeitar
  POSTs novos com `intake_disabled` — não é só cosmético no board, o
  link público de verdade para de aceitar pedido;
- `intake.html` mostra um aviso ("squad desativou os pedidos") em vez
  do formulário;
- pedidos já pendentes de antes de desligar continuam disponíveis pra
  revisar (nada é apagado).

**Atenção — passo manual:** requer novo
`firebase deploy --only functions:intakeSubmit` pra o opt-out valer
de verdade no link público (sem o deploy, o board esconde o botão mas
a function antiga continua aceitando pedido).

HELP_CONTENT atualizado nas duas entradas ("CFD & Burndown" e
"Formulário de intake").

### v8.30.390-dev — 2026-08-11
Feedback direto logo depois de v8.30.389-dev: "pela Hering não dá pra
colocar 'Qualquer pessoa com o link pode ver'" — a política do Google
Workspace da empresa bloqueia essa permissão, então o conversor de
link do Drive (implementado na versão anterior) não serve pra ninguém
na prática, mesmo funcionando tecnicamente.

- Dica inline no menu 🎨 e HELP_CONTENT reescritos: a recomendação
  principal agora é subir a imagem em **postimages.org** ou
  **imgbb.com** (sem conta, sem custo, gera link direto na hora) —
  Drive vira menção secundária, com o aviso claro de que geralmente
  não funciona nas contas da Hering.
- Toast do conversor de Drive (`setCardCoverImage`) atualizado com o
  mesmo aviso + sugestão de alternativa, pra quem tentar mesmo assim.
- Código do conversor de link do Drive (`_normalizeCoverImageUrl`)
  mantido — inofensivo, e ainda útil pra quem tiver uma conta pessoal
  ou parceiro externo sem essa restrição.
- Decisão explícita (perguntada ao usuário): NÃO implementar upload de
  imagem de verdade via Firebase Storage nesta rodada — ficaria mais
  caro e reverteria a decisão original da Fase 5.6 de não usar Storage.

### v8.30.389-dev — 2026-08-11
Pedido direto: time não tem onde hospedar imagem além do Google Drive,
e o link normal de "Compartilhar" do Drive não funciona como capa —
ele aponta pro visualizador em HTML do Drive, não pros bytes da
imagem, então colado ali simplesmente não carrega nada.

- `_normalizeCoverImageUrl()`: detecta um link do Drive (`/file/d/ID/...`,
  `?id=ID`, ou já no formato `uc?...id=ID`) e reescreve sozinho pro
  formato `drive.google.com/uc?export=view&id=ID`, que carrega como
  imagem de verdade. Roda dentro de `setCardCoverImage()` — cobre tanto
  colar a URL quanto "🔗 Usar 1º link". Qualquer URL que não seja do
  Drive passa direto, sem alteração.
- Toast avisando quando o link foi convertido, lembrando que o arquivo
  precisa estar com "Qualquer pessoa com o link pode ver" — sem isso
  não carrega mesmo convertido.
- **Limitação aceita, documentada na UI e no HELP_CONTENT:** o Google
  Drive não foi feito pra servir imagem em produção — o link pode
  falhar ocasionalmente sob carga (não é um SLA garantido do Google).
  Segue sendo, ainda assim, a opção mais prática pra quem não tem outro
  lugar pra hospedar.
- Dica inline no menu 🎨 → aba de imagem + HELP_CONTENT ("Capa do
  card") atualizados.

### v8.30.388-dev — 2026-08-11
Feedback direto depois de testar a capa de imagem (Fase 5.6, já em
prod): "nem todas as imagens ficam boas como capa" — a capa é uma
faixa fixa de 64px de altura com `background-size:cover`, então uma
imagem "quadrada" ou de retrato só mostra uma faixinha fina do meio
recortada, enquanto um banner largo com o assunto centralizado (como o
exemplo que funcionou bem) mostra praticamente tudo.

- Dica inline nova, direto no menu 🎨 → aba de imagem: explica a
  proporção ideal (~4:1, tipo 1000×250px) antes da pessoa colar a URL,
  em vez de só descobrir depois de ver o resultado cortado.
- HELP_CONTENT ("Capa do card") expandido com a explicação completa —
  o que funciona bem, o que não funciona, e uma alternativa (centralizar
  a imagem original num fundo sólido mais largo) pra quem só tem uma
  imagem quadrada/retrato à mão.

### v8.30.387-dev — 2026-08-11
Fase 5, item 7 aprovado: indicador de conectividade — escopo
deliberadamente reduzido em relação à proposta original de "fila
offline completa" (ver justificativa abaixo).

- Selo "🔴 Offline" no topo (ao lado do botão de tema), ligado ao nó
  `.info/connected` do próprio Realtime Database — aparece assim que a
  conexão cai, some assim que volta.
- Se a conexão está caindo E existe um card aberto com alteração não
  salva, fechar ou recarregar a aba dispara o aviso nativo do navegador
  ("sair mesmo assim?") — protege contra perder o que foi digitado sem
  perceber que estava offline.
- **Por que não uma fila genérica de reenvio:** o SDK do Realtime
  Database já reenvia sozinho qualquer escrita feita offline assim que a
  conexão volta, ENQUANTO a aba continua aberta (o autosave do card já
  tinha retry próprio antes desta mudança — ver `_saveCardWithRetry`).
  O buraco real era só a pessoa fechar/recarregar sem saber que estava
  offline, perdendo o que nem chegou a sair da memória — indicador +
  aviso de saída resolvem exatamente esse buraco, sem duplicar controle
  de estado em dezenas de pontos de escrita do app (risco alto pra um
  item que a própria proposta original já sinalizava como baixa
  prioridade).
- HELP_CONTENT atualizado.

### v8.30.386-dev — 2026-08-11
Fase 5, item 4 aprovado: formulário de intake por squad — link público,
sem login, pra quem está fora do squad (ou fora da empresa) pedir algo
sem precisar de conta no Maré Digital.

- **Novo:** `intake.html` (página pública, na raiz do site, sem SDK do
  Firebase/login) + Cloud Function `intakeSubmit`
  (`functions/intake/submit.js`) — único ponto de escrita anônima
  permitido no sistema. Link por squad: `intake.html?squad=SEU_SQUAD`
  (botão "🔗 Copiar link" dentro do painel de Intake).
- Decisão de arquitetura: a function NUNCA escreve direto em `/cards` —
  esse nó é um array reescrito por INTEIRO a cada `fbSaveAll()` do
  cliente (criar/excluir/reordenar card), então um card inserido por
  fora seria apagado silenciosamente no primeiro save estrutural de
  qualquer pessoa do squad. Em vez disso, grava um registro leve em
  `kanban/squads/{squad}/dados/intake_pending/{id}` (nó comum, chaveado
  por push-id) — o cliente lê esse nó e cria o card de verdade pelo
  fluxo normal, com uma pessoa confirmando antes.
- Defesa contra abuso sem custo de lib nova: honeypot (campo invisível
  só um bot preenche) + limite de 5 envios/hora por IP.
- No board: botão "📥 Intake" na toolbar (badge com a contagem de
  pendentes) abre a lista de pedidos. "✅ Criar card" abre o card de
  criação já pré-preenchido (título, descrição com nome/contato de quem
  pediu, prazo) pra revisar e salvar; "🗑 Descartar" remove da lista
  (fica registrado, não vira card). Pedido só sai de "pendente" quando o
  card é de fato SALVO com sucesso — cancelar o card no meio do caminho
  deixa o pedido pendente de novo.
- Campo `demandante` do card é uma lista fechada de membros do squad
  (não texto livre) — por isso o nome/contato de quem pediu (que pode
  ser alguém de fora) entra na descrição do card, não nesse campo.
- **Atenção — passo manual:** a Cloud Function precisa de
  `firebase deploy --only functions:intakeSubmit` pra ir ao ar (deploy
  de function não é automático como o GitHub Pages). Até isso rodar, o
  formulário público fica sem endpoint válido.
- HELP_CONTENT atualizado.

### v8.30.385-dev — 2026-08-11
Fase 5, item 3 aprovado: CFD (Cumulative Flow Diagram) + Burndown, nova
3ª aba "📈 CFD & Burndown" dentro de "📊 Dados do Board".

- Reconstrói o estado histórico direto de `card.flow.log` (sequência de
  `{from,to,at}` já gravada em toda movimentação) — zero coleta nova.
  Limitação aceita, documentada na própria UI: o log guarda só as
  últimas 40 movimentações por card, então histórico bem antigo de
  cards muito movimentados pode ficar incompleto.
- CFD: área empilhada (SVG desenhado na mão, sem lib externa) dos
  últimos 21 dias, na ordem/cores reais das colunas do board.
- Burndown: usa início/fim de sprint já configurados em ⚙ Config →
  Ágil. Escopo é aproximado (cards não arquivados criados até o fim da
  sprint, ainda não concluídos ou concluídos dentro da janela) — o
  modelo de dados não tem campo próprio de "pertence à sprint X", e a
  UI avisa disso explicitamente. Linha real (até hoje) vs. linha ideal
  tracejada.
- Aba lazy: só recalcula quando alguém realmente abre "CFD & Burndown".

### v8.30.384-dev — 2026-08-11
Fase 5, item 6 aprovado: capa de card com imagem. A capa de COR sólida
já existia (Trello-like); faltava a opção de imagem pedida no plano.

- Menu 🎨 no topo do card ganhou uma seção nova: cole a URL de uma
  imagem, ou clique "🔗 Usar 1º link" pra usar o primeiro link já salvo
  em Anexos. Só guarda o endereço — nunca faz upload nem guarda o
  arquivo (zero custo de Storage).
- Cor e imagem são exclusivas — escolher uma limpa a outra. "⊘ Sem capa"
  limpa as duas de uma vez.
- Card face: `background-image` (não `<img>`) de propósito — se o link
  cair ou for removido, a capa simplesmente some, sem ícone de imagem
  quebrada.
- HELP_CONTENT atualizado.

### v8.30.383-dev — 2026-08-11
Fase 1.1 (aprovada): comentários saíram de dentro do card. Maior fonte
de banda restante — cada edição de QUALQUER campo de um card
retransmitia os comentários dele inteiros pra todo mundo com o board
aberto, mesmo quem nunca abre aquele card específico.

- Novo path `squads/{squad}/dados/card_comments/{cardId}/{commentId}`
  (sob `dados/`, sem regra nova no Firebase). `_commentsCache` em
  memória é a fonte pro que a tela mostra.
- Migração sem lote: `loadComments()` tenta o path novo; se vazio E o
  card ainda tiver o campo legado `comments`, usa esse dado E migra em
  background (grava no path novo, remove o campo do card, salva) — cards
  só migram quando alguém realmente abre e vê os comentários deles.
- Todas as ações de comentário (postar/editar/excluir/reagir, e os
  comentários automáticos do Agente Ágil) escrevem só o item em si no
  path novo, nunca mais o card inteiro via `fbSaveCard`.
- Duplicar card: comentários da origem são copiados pro `card_comments`
  do novo card (do campo legado se ainda existir, senão busca do path
  novo) — cópia nunca nasce com o campo legado.
- Notificação de menção com comentário apagado (fix recente): passa a
  checar o path novo, com fallback pro legado.
- Trade-off documentado: abrir um card agora faz 1 leitura extra
  (`_get` no path novo) — antes era grátis (piggyback no card já
  carregado). Mitigado por ser lazy (só ao abrir o card específico) e
  por já existir um guard anti-corrida (`editingId!==id`) desenhado
  exatamente pra esse tipo de leitura assíncrona.
- Sem mudança de comportamento visível — comentários continuam
  funcionando exatamente igual pra quem usa.

### v8.30.382-dev — 2026-08-11
Feedback direto com print: "esse texto aqui tá ruim de leitura" (meta de
cada card em 🌅 Meu Dia — squad/coluna/prazo). `var(--txt3)` em 10px
ficava fraco demais em cima do fundo já escuro de `.meudia-row`. Trocado
por `var(--txt2)` (mesmo tom do título das seções) + 11px.

### v8.30.381-dev — 2026-08-11
Fase 5, item 1 aprovado: "Meu Dia" (visão pessoal cross-squad). Novo
botão "🌅 Meu Dia" na toolbar (+ atalho Ctrl+D / Cmd+D).

- Agrega os cards onde você é responsável OU participante, em TODOS os
  squads (não só o quadro atual) — agrupados em Atrasado, Hoje, Esta
  semana, Menções não lidas, Bloqueios que te afetam e Sem prazo. Cards
  concluídos não entram — é uma lista do que ainda precisa de atenção.
- Cross-squad reaproveita o MESMO padrão já usado pelas Campanhas
  multi-squad (`_campCrossData`): fetch pontual (`_get`, nunca um
  listener) de `cards`+`columns` por squad, só na abertura do painel,
  cacheado em memória pra não rebuscar depois na mesma sessão.
- Menções não lidas vêm de graça do listener de notificações que já
  roda desde o boot (`loadNotifs()` passou a cachear a última lista
  processada em `_activeNotifsCache`, sem nenhum fetch novo).
- Clique num card de outro squad navega pra lá (mesmo mecanismo de
  `?squad=&card=` já usado pelas notificações).
- Limitação conhecida, documentada no código: pra squads que não são o
  ativo, "coluna concluída" e "card bloqueado" usam uma heurística (nome
  da coluna / `card.blocker`+coluna `blocker`) em vez do `flowConfig`/
  `blockerMode` reais daquele squad — evita mais uma leitura por squad
  só pra isso. Pode errar em squads com nomenclatura de coluna fora do
  padrão.
- HELP_CONTENT atualizado.

### v8.30.380-dev — 2026-08-11
Fase 5, item 2 aprovado: aging visual de card ("parado há Xd").

- Badge `⏳ Xd` no card quando ele fica parado na MESMA coluna por mais
  dias que o limiar configurado — usa `card.flow.enteredAt[coluna]`
  (já gravado em toda movimentação, `recordMove()`), não precisa de
  dado novo.
- Limiar configurável POR COLUNA em ⚙ Config → Fluxo, seção nova "⏳
  Aging" — campo de dias por coluna, vazio/0 desliga o aviso naquela
  coluna. Sem configurar nada, o aviso fica desligado em todo lugar
  (feature opt-in, não muda o board de quem não configurar).
- Sinal diferente do esmaecimento automático que já existia (`aged-1`/
  `aged-2`, baseado em dias desde a última EDIÇÃO) — esse é sobre tempo
  parado NA COLUNA atual. Os dois convivem, sem conflito.
- Corrigido de propósito: o listener de `config/flow` reconstruía
  `flowConfig` do zero a cada mudança remota, sem o campo `agingDays` —
  sem o fix, a configuração salva seria apagada de volta no próximo
  evento do Firebase (inclusive o eco da própria escrita).
- HELP_CONTENT atualizado.

### v8.30.379-dev — 2026-08-11 · TESTE — peixes/bolhas somem na candidata B
Feedback direto com print: "essa versão está sem os peixinhos". Causa:
os peixes/bolhas usam fills azul/teal de baixo alpha, pensados pro fundo
pálido original — contra o novo fundo "lagoa" da candidata B (mesma
família de cor, mais saturada), viravam camuflagem quase perfeita.
Filtro do claro trocado: em vez de só escurecer, agora clareia bastante
e dessatura (viram silhuetas quase brancas) + sombra escura sutil pra
definição de borda — mesmo espírito "duna clara contra a lagoa".

### v8.30.378-dev — 2026-08-11
Fase 5, item 5 do plano: quick-add com parsing natural. Ao criar um card
NOVO, digitar `!alta`, `@nome`, `#tag` ou uma data (`hoje`/`amanhã`/dia
da semana/`dd/mm`) no título e sair do campo já preenche prioridade,
responsável, tag e prazo — os tokens somem do título, e um toast mostra
o que foi detectado. Só age em criação (nunca reescreve campos de um
card já existente ao editar). 100% client-side, zero custo novo de
Firebase. HELP_CONTENT atualizado.

### v8.30.377-dev — 2026-08-11 · TESTE — candidata B do tema claro (Fase 4)
Pedido direto: "tô na dúvida! implementa a B pra eu ver" — depois de ver o
artefato de preview (lencois-lab.html, 3 candidatas). Aplicada a candidata
B ("Duna × Lagoa") como paleta padrão do `[data-theme="light"]`, só pra
teste visual ao vivo — ainda não é decisão final.

- `--deep`/`.ocean`: fundo vira gradiente lagoa (turquesa+azul mais
  saturados) em vez do azul-claro uniforme atual.
- `--surface-rgb`: cards quase brancos de verdade (251,253,255), com
  sombra em camadas em vez do glow de borda.
- `--glass`/`--glass-b`: glass vira base branca ("areia molhada") em vez
  de azulada.
- `[data-theme="light"][data-theme-variant="b"]` (a variante do
  duplo-clique, de uma rodada anterior) **não foi tocada** — ainda usa a
  paleta antiga, não reconciliada com esta paleta nova ainda.

### v8.30.376-dev — 2026-08-11
Fase 3.4 do plano mobile: "criar card na coluna visível". Pedido original
era um FAB flutuante novo no canto inferior direito — mas o mobile já
tem um botão "➕ Card" fixo na bottom-nav, e o próprio CSS já documentava
a convenção do app ("FAB → bottom nav" no mobile, `.fab{display:none}`).
Confirmado com o usuário: em vez de duplicar a função com um FAB
separado, o botão "➕ Card" existente passou a criar o card na coluna
atualmente visível (reaproveita `_mobileCurrentColId`, da Fase 3.2), em
vez de sempre cair na primeira coluna.

### v8.30.375-dev — 2026-08-11
Fase 3.1-3.3 do plano mobile.

**3.1 — Card modal como bottom-sheet (mobile)**
- `#card-ov` (só o modal do card — os demais continuam dialog centralizado)
  sobe de baixo, cantos superiores arredondados, com uma alça de arrastar
  (`#card-sheet-handle`) no topo.
- Arrastar a alça pra baixo além de ~110px fecha o modal — passa por
  `closeOv('card-ov')`, então ganha de graça a confirmação de "alterações
  não salvas" já existente (Fase 2.2). Só a alça responde ao arrasto, não
  o header inteiro (que tem botões/abas).
- `visualViewport.resize`: quando o teclado abre, redimensiona a folha pro
  espaço que sobrou e rola o campo focado pro centro — sem isso o teclado
  cobria o campo sendo editado.

**3.2 — Navegação por coluna (scroll-snap)**
- `scroll-snap-type:x mandatory` no `#board-wrap` + `scroll-snap-align:start`
  nas colunas, só mobile — convive com o long-press drag existente (antes de
  "armar" o drag, qualquer movimento cancela o timer e deixa o scroll nativo
  rolar livremente).
- Indicador fixo discreto ("Em Progresso · 2/5") acima da bottom-nav,
  atualizado por scroll (passivo, coalescido em rAF) e depois de todo
  `renderBoard()`. Escopo: só board padrão — modo raia (múltiplas faixas
  horizontais independentes) ficou de fora por ora.

**3.3 — Alvos de toque (auditoria + preenchimento de lacunas)**
- Boa parte já estava OK (`.x-btn`, `.notif-btn`, `.mention-option`).
  Ajustados pra 44×44px via padding: `.icon-btn` (botões pequenos de ação
  tipo ✕/✏️, usado em vários lugares), `.toolbar .btn-sm`, `.eoc-save`/
  `.eoc-cancel`, `.attach-add-btn`/`.attach-save-btn`, `.x-btn`/`.notif-btn`
  (de 40 pra 44px).

### v8.30.374-dev — 2026-08-11
Fase 2.4 do plano de otimização: lazy-init de painéis pesados. Auditados
os 4 painéis listados (Relatório de Tempo, Campanhas, Calendário,
Controle de Criativos) — resultado por painel, cada um com motivo:

- **Campanhas**: era lazy só na hora de RENDERIZAR, mas
  `loadCampanhas()` (um `onValue` no nó `kanban/campanhas` INTEIRO, de
  TODAS as squads) rodava no boot pra todo mundo, mesmo quem nunca abre
  o painel. Agora só registra o listener na 1ª abertura (`openCamp()`,
  guarda `_campanhasLoaded`). Auditado: `_campanhas` não é usado em
  nenhuma automação de fundo, só dentro do próprio painel — seguro
  tornar lazy.
- **Calendário**: **mantido eager de propósito**, não é lazy. Motivo:
  `checkUpcomingMeetings()` (`setInterval` de 60s, alerta "reunião em N
  minutos") depende de `calEvents` já populado o tempo todo, pra quem
  NUNCA abre o painel Calendário também receber o alerta. Tornar
  `loadCalEvents()` lazy quebraria esse alerta pra maioria das pessoas.
- **Relatório de Tempo** e **Controle de Criativos**: já eram lazy —
  `openTempoReport()`/`openCriativos()` só calculam a partir do array
  `cards` (já carregado de qualquer forma) na hora de abrir, sem
  listener próprio registrado no boot. Nada a mudar.

### v8.30.373-dev — 2026-08-11
Fase 2.3 do plano de otimização: animações conscientes (peixinhos,
bolhas, pulsos de alerta).

- **Pausa em background**: `visibilitychange` alterna
  `[data-anim-paused]` no `<html>` — pausa a animação de peixes/bolhas
  quando a aba não está visível (`document.hidden`), retoma ao voltar.
  Zero trabalho de CPU/GPU animando algo que ninguém está vendo.
- **`prefers-reduced-motion: reduce`**: desliga (via `animation:none`)
  os peixinhos, bolhas e os pulsos de alerta contínuos (tag de iniciais
  duplicadas, botão "Salvar" com alteração não salva, bolinha de raia
  sem dono) — não mexe em animações curtas/pontuais (toast, abrir modal,
  popup de notificação), que não são o tipo de movimento que essa
  preferência do usuário pede pra evitar.
- **Mobile (≤768px)**: metade da quantidade de peixes/bolhas (4+8 em vez
  de 8+16) — mesma cena, menos elementos animados ao mesmo tempo, mais
  leve pra CPU/bateria de celular.
- Preferência pessoal de ligar/desligar peixinhos (🐟 no título) e a
  cena em si continuam do mesmo jeito — isso só reduz o CUSTO da
  animação, não muda a experiência de quem não pediu nada disso.

### v8.30.372-dev — 2026-08-11
Fase 2.2 do plano de otimização: `_updateSaveBtnDirtyState()` (indicador
"alterações não salvas" no botão Salvar do card) rodava num
`setInterval(400)` pra sempre — mesmo com o modal do card fechado.

- Trocado por um listener delegado (`input`/`change`) em `document`,
  filtrado pro modal do card (`#card-ov`), registrado UMA VEZ (não a
  cada abertura de card). Com o modal fechado, `_cardManualSnap` é
  `null` e `_cardIsDirty()` sai cedo — zero custo parado.
  `_startDirtyWatch()`/`_stopDirtyWatch()` continuam existindo (mesmos
  nomes, mesmos pontos de chamada), só que sem `setInterval`.
- Um caso não cai em `input`/`change`: mostrar/esconder o campo de
  impedimento é feito via `style.display` direto (`addBlockerTag`/
  `removeBlockerTag`), não dispara evento nenhum — adicionada uma
  chamada explícita a `_updateSaveBtnDirtyState()` nesses dois pontos
  pra não perder esse caso.
- Sem mudança de comportamento visível.

### v8.30.371-dev — 2026-08-11
Fase 2.1 do plano de otimização: `renderBoard()` é chamado em ~102 pontos
do código; cada um faz um re-render completo do board. Criado
`scheduleRender()` (coalesce via `requestAnimationFrame`, no máximo 1
render por frame, flag de pendente).

- **Escopo desta rodada, deliberadamente conservador**: só os ~11
  listeners de configuração "de fundo" registrados em `fbLoadAll()`
  (columns, agil_cfg, subteams, agentes, tags, blockerMode, flowConfig,
  poll de columns/tags a cada 60s) passaram a usar `scheduleRender()` —
  são exatamente os que, no boot ou numa reconexão, costumam disparar
  quase juntos, cada um re-renderizando o board por conta própria.
- O listener de `cards` (o mais frequente de todos) FICOU DE FORA de
  propósito — já tem seu próprio coalescing (debounce de 150ms em
  `_scheduleCardsSync`), mais agressivo que 1 frame; converter ali só
  adicionaria uma camada redundante.
- Os outros ~90 pontos (ações do usuário: clique, drag, salvar/arquivar
  card, filtros, seleção em massa) continuam chamando `renderBoard()`
  direto, de propósito — vários deles têm código logo depois que depende
  do board já estar redesenhado (restaurar scroll, fechar modal, foco), e
  sem uma sessão de teste visual ao vivo não dava pra auditar os ~90 com
  segurança. Fica como possível próxima rodada, se quiser aprofundar.

### v8.30.370-dev — 2026-08-11
Fase 1.5 do plano de otimização: reativa "Engajamento & Uso Efetivo"
(painel → Status), desativado desde 2026-07-21 por custar caro (lia o
log bruto de acesso de todos os squads inteiro).

- `_logAccess()` volta, mas grava em
  `kanban/squads/{squad}/dados/access_stats/{yyyy-mm-dd}/{uid}` (dentro
  de `dados/`, sem precisar de regra nova no Firebase — era esse o motivo
  do erro de permissão antes: o `access_log` antigo vivia FORA de
  `dados/`) em vez do `access_log` antigo. `count` incrementa via
  `increment()` do próprio servidor — 1 write pequeno, sem `fbGet` antes
  pra ler o valor atual.
- Limpeza de TTL (60 dias) também sem `fbGet`: só tenta apagar a data
  exata de 60 dias atrás (delete idempotente), throttled a 1x por dia
  por cliente via localStorage — nunca lista o node inteiro.
- `painel.html`/`painel-dev.html`: `loadUsoData()` reativado, lendo
  `dados/access_stats` no lugar de `access_log`.

### v8.30.369-dev — 2026-08-11
Fase 1.4 do plano de otimização: amostragem da instrumentação de bytes
(`_dbg`/`_dbgFlush`). Antes, TODO cliente escrevia em `_debug_bytes_log`
a cada 5min, o tempo todo — agora que a economia das fases anteriores já
foi confirmada com esses dados, não precisa mais medir 100% do tráfego.

- Medição local continua sempre ligada (`debugBytesReport()` funciona
  igual, em qualquer aba). Só a ESCRITA remota (o que alimenta
  `debugBytesRemote()`/`debugBytesHistory()`) passa a rodar só se: (a) a
  pessoa é ADM (`isAdmUser`), ou (b) a sessão caiu nos ~10% sorteados no
  boot (sorteio persistido em `sessionStorage`, estável durante a aba).
- `debugBytesRemote()`/`debugBytesHistory()`/`debugBytesExportCSV()`
  continuam funcionando normalmente — passam a refletir uma amostra do
  tráfego (ADM + ~10%), não mais 100% das sessões.

### v8.30.368-dev — 2026-08-11
Fase 1.3 do plano de otimização: comunicados e lembretes.

- **Comunicados** (`kanban/comunicados`): `onValue` no nó cheio →
  poll de 3 minutos (aba em primeiro plano), mesmo padrão já usado nos
  kudos (`_listenKudos`). Comunicados só são criados/editados pelo ADM
  via painel.html, nunca localmente aqui, então não há mutação otimista
  que dependesse de tempo real. Efeito colateral aceito: um comunicado
  novo pode levar até 3min pra aparecer pra quem já está com o board
  aberto (antes era instantâneo).
- **Lembretes do squad** (`FB+'/lembretes'`): `onValue` no nó cheio (cada
  add/del reescrevia o ARRAY INTEIRO) → listeners granulares
  (`child_added`/`child_changed`/`child_removed`), mesmo padrão já usado
  em cards/presence/spotify. Escritas passam a ser por item
  (`/lembretes/{id}`) em vez de regravar a lista toda.
- `painel.html`/`painel-dev.html`: `delLembretePainel()` (ferramenta do
  ADM pra apagar lembrete de qualquer squad) ajustado pra apagar só o
  item, não reescrever o node inteiro — evita apagar de volta um
  lembrete adicionado depois do snapshot local do painel.
- Sem mudança de comportamento visível pros lembretes; comunicados têm
  o delay de até 3min descrito acima.

### v8.30.367-dev — 2026-08-11
Rodada de otimização (Fase 1.2 do plano "banda/custo Firebase"): cache de
Google Agenda (local do squad + global do painel) parava de usar `onValue`
no nó cheio de eventos (`config/gcal_cache`) — cada escrita retransmitia
TODOS os eventos de TODAS as agendas conectadas pra TODO cliente com o
board aberto.

- Listener passa a escutar só `config/gcal_cache_meta` (leve:
  `{updatedAt, updatedBy}`); quando o timestamp muda, busca o cache cheio
  uma vez (`fbGet`), em vez de manter o payload inteiro sempre em memória
  como listener ativo.
- Mesmo padrão aplicado ao cache global (`kanban/painel/config/gcal_cache`)
  — `painel.html` já escrevia o meta na busca principal; passou a tocar o
  meta também nos 3 outros pontos que escrevem esse cache (purga imediata
  ao remover agenda, lista vazia, dedup manual de duplicatas), senão essas
  escritas ficariam invisíveis pros outros clientes sob o novo esquema.
- Mesmo ajuste replicado em `kanban-dev.html` pros 3 pontos equivalentes
  que escrevem o cache local do squad.
- Sem mudança de comportamento visível — só reduz o volume de dados
  retransmitido a cada alteração de agenda conectada.

### v8.30.366-dev — 2026-08-10
Feedback direto: "uma usuária aqui me informou que não está conseguindo
abrir as notificações" → investigação apontou que a notificação de
@menção apontava pra um comentário que já tinha sido excluído (o card
ainda abria normalmente, mas a notificação "não levava a lugar nenhum"
do ponto de vista da usuária). Pedido explícito: "acho melhor avisar q
o comentário não exista mais ou excluir a notificação em si".

- `createNotif`/`parseMentions` passam a aceitar um `commentId` opcional
  — só preenchido quando a @menção vem de dentro de um comentário
  (`submitComment`/`saveEditComment`); menções em outros campos
  (descrição, PO, checklist etc.) continuam sem vínculo a comentário
  nenhum, sem mudança de comportamento pra elas.
- `openNotif()`: ao abrir uma notificação de menção com `commentId`,
  confere se o comentário ainda existe no card. Se não existir mais
  (foi excluído), mostra um toast avisando e apaga a notificação —
  cobre as duas opções pedidas (avisar + limpar) numa ação só. Card
  continua abrindo normalmente em seguida.
- Limitação conhecida: como o id da notificação de menção é
  determinístico por (card, pessoa) — pra não duplicar a mesma menção
  a cada save — só a PRIMEIRA menção que gerou aquela notificação fica
  de fato vinculada a um comentário; notificações já existentes (antes
  desse fix) não têm `commentId` e continuam abrindo do jeito antigo.

### v8.30.365-dev — 2026-08-10
Feedback direto: "voltou a ficar claro demais" — o fix da v8.30.364-dev
não tinha efeito nenhum. Causa: o botão tem `style="color:var(--warn);
border-color:..."` **inline** no HTML, que sempre vence qualquer regra
de CSS externa (id ou não). Faltava `!important` — mesmo padrão já
usado no arquivo pra esse exato problema nos botões da toolbar
(`[data-theme="light"] .toolbar > button.btn`).

### v8.30.364-dev — 2026-08-10
Feedback direto (print): "ficou horrível kkkk" — a técnica de reforço de
preenchimento aplicada em `#btn-meus-cards` na v8.30.363-dev (certa pra
tags pequenas sem fundo visível) virou um bloco sólido pesado num
`<button class="btn">`, que já tem fundo próprio (`var(--glass)`,
herdado de `.btn`). Trocado por um ajuste bem mais simples: só escurece
texto/borda (cor direta, sem filter/box-shadow) — o glass de fundo já
dá contraste suficiente sozinho.

### v8.30.363-dev — 2026-08-10
Feedback direto com print: "com esse novo fundo com filtro, a função
meus cards tao muito claro nos dois modos claros".

- **Causa**: o botão "💡 Meus cards" usa `color:var(--warn)` (dourado,
  pensado pro tema escuro) sem fundo próprio — com o painel novo da
  barra de Filtros (v8.30.357-dev) por baixo, ficou ainda mais apagado
  (mesma categoria de problema já corrigida nas tags/badges, v8.30.350-
  dev — só que essa instância específica, sendo um `<button>` e não uma
  `.card-tag`/`.exec-chip`/etc., tinha ficado de fora daquele fix).
- Reaproveita a mesma técnica já validada (reforço de preenchimento +
  escurecimento) em `#btn-meus-cards`, vale no claro padrão e na
  variante B.

### v8.30.362-dev — 2026-08-10
Feedback direto: "nao mudou o branco dos cards! acho q pode dar uma
escurecida nele tb" — o tingimento da v8.30.361-dev tinha efeito quase
nenhum na prática.

- **Causa raiz**: a regra base `.card` soma uma camada de 5% de branco
  puro por cima do fundo (`linear-gradient(rgba(255,255,255,.05)...)`)
  — um "sheen" sutil pensado pro tema ESCURO, que no claro diluía
  qualquer tingimento de `--surface-rgb`, empurrando o card de volta
  pro branco. `[data-theme="light"] .card` agora sobrescreve o
  `background` inteiro pra usar `--surface-rgb` puro, sem essa camada.
- `--surface-rgb` escurecido mais um degrau: `238,246,250` →
  `222,235,242` (claro padrão), `235,244,248` → `219,233,240`
  (variante B).

### v8.30.361-dev — 2026-08-10
Feedback direto testando o double-click da v8.30.360-dev, com print do
board: "funcionou bem! mas achei o card branco longe do tema e os
títulos da coluna em preto ficou longe tb, tenta c um cinza ou branco".

- **Título da coluna** (`.col-title`) não tinha `color` próprio — herdava
  `var(--txt)` puro (bem escuro, quase preto em negrito/Syne). Agora usa
  `var(--txt2)` (mesma cor, com menos opacidade — já existente na
  paleta, sem inventar tom novo) — lê como cinza-azulado suave.
- **Fundo dos cards** (`--surface-rgb`) era quase branco puro
  (`252,254,255`) — tingido mais pra dentro da paleta azulada:
  `238,246,250` no claro padrão, `235,244,248` na variante B (mesmo
  delta proporcional de antes).
- Ambos os ajustes valem nos dois: tema claro padrão e variante B.

### v8.30.360-dev — 2026-08-10
Pedido direto: "guarda esse estilo B aí... coloca o anterior (da versão
8.30.237) como default do claro mas se a pessoa clicar 2x, vai pra essa
opção B". Vira uma preferência opcional em vez de substituir o padrão:

- Tema claro padrão volta a ser a paleta original (v8.30.237: `--deep
  #CBE3F2`, `--blue #00A9E6`, `--txt #14324A`, etc.) — as 2 rodadas de
  escurecimento (v8.30.358/359-dev) viram uma **variante opcional**,
  não o padrão pra todo mundo.
- Nova regra `[data-theme="light"][data-theme-variant="b"]` sobrescreve
  só os tokens de cor (mesma paleta "B" testada) quando a variante está
  ativa — reaproveita todo o resto do CSS do tema claro (fish/bubbles,
  `.card-mine`, botões da toolbar etc.), sem duplicar nada.
- **Duplo-clique** no botão de tema (🌙/☀️, header) alterna a variante,
  só dentro do claro (no escuro, um toast avisa que a opção não existe
  lá). Clique único continua alternando claro/escuro como sempre.
- Clique único e duplo-clique no mesmo botão precisam de um pequeno
  debounce (260ms) pra não disparar 2 toggles de tema (flash visível)
  antes do duplo-clique real ser reconhecido — ver comentário em
  `onThemeBtnClick()`.
- Persistência própria (`mare_theme_variant` no localStorage),
  independente do dark/light — trocar de tema não reseta a variante
  escolhida.

### v8.30.359-dev — 2026-08-10
Pedido direto: "bota o plano B" — troca a candidata "C" (v8.30.358-dev)
pela "B" do mesmo artefato visual, um degrau mais clara que a C.

- `--deep`: `#8FB8D9` → `#A9CCE3`.
- `--glass`: `rgba(96,155,190,.72)` → `rgba(120,178,208,.68)`.
- `--blue`/`--accent`: `#00729E` → `#0086BE`.
- `--cyan`: `#054459` → `#075674`.
- `--txt`/`--txt2`/`--txt3`: `#0A1D2E` → `#0F2436`.
- Borda do `.card`: `rgba(0,70,110,.65)` → `rgba(0,90,135,.6)`.
- `--surface-rgb`: `246,250,253` → `249,252,253` (ajuste mínimo, mesma
  lógica de sempre — mantém o card bem mais claro que o fundo).

### v8.30.358-dev — 2026-08-10 — MODO CLARO
Feedback direto: "time ainda ta achando o modo claro muitooo claro!
da uma boa escurecida mas ainda dentro do modo claro, aumenta o
contraste e traz um azul um pouco mais escuro!" — 3ª rodada de ajuste
do tema claro (as 2 anteriores já tinham escurecido o fundo 2x).
Testado com artefato visual (3 candidatas) antes de aplicar; esta é a
"C" (mais escura das 3), escolhida pra testar.

- `--deep` (fundo de página/oceano): `#CBE3F2` → `#8FB8D9`.
- `--glass` (header/toolbar/colunas/dropdowns): `rgba(155,205,230,.65)`
  → `rgba(96,155,190,.72)` — mais escuro e mais opaco.
- `--blue`/`--accent` (azul de destaque): `#00A9E6` (ciano vivo) →
  `#00729E` (azul mais fechado/profundo).
- `--cyan` (texto de rótulos/badges): `#0A6C8C` → `#054459`.
- `--txt`/`--txt2`/`--txt3`: `#14324A` → `#0A1D2E` (mais escuro, mais
  contraste).
- Borda do `.card` no tema claro: `rgba(0,120,175,.55)` →
  `rgba(0,70,110,.65)`.
- `--surface-rgb` (fundo dos cards) só ajustado de leve (`252,254,255`
  → `246,250,253`) — de propósito: é o card ficando bem mais claro que
  o fundo ao redor que reforça o contraste, escurecer os dois juntos
  anularia o ganho.
- Puramente visual, não muda nenhum dado/comportamento.

### v8.30.357-dev — 2026-08-10
Feedback direto (mais amplo que o do v8.30.356-dev): "essas duas linhas
do jeito que tão, achei feio, vazio!" — sobre a barra de Filtros como
um todo, não só o checkbox novo.

- **Causa**: `#filter-bar` não tinha fundo/borda própria — selects e
  checkboxes ficavam soltos direto em cima do fundo translúcido do
  board, com bastante espaço "vazio" se misturando com o fundo atrás.
- Testado antes de aplicar (artefato visual, 3 candidatas comparadas
  lado a lado no board real, dark e light) — escolhida a opção com
  painel + agrupamento.
- `#filter-bar` ganha um container próprio (`.filter-bar-panel`,
  reaproveita o mesmo tratamento visual do `.goal-bar` já existente:
  fundo translúcido + blur + borda). Campos de filtro, checkboxes
  rápidos e botões de ação agora ficam agrupados em 3 blocos
  (`.fb-group`) separados por divisores verticais (reaproveita o
  `.tb-sep` que já existe no toolbar).
- Nenhum `id`/`onchange` mudou — só a estrutura visual em volta.

### v8.30.356-dev — 2026-08-10
Feedback direto sobre o filtro novo: "funcionou mas esse layout eu n
gosto... fica feio e quebrado". Causa: o checkbox "🧩 Supercards" era o
único com emoji na frente do texto — "Só impedidos" e "Com riscos" (os
vizinhos na mesma linha) são só texto puro, sem ícone. Removido o
emoji do label (mantém só a cor roxa no próprio checkbox, que já
diferencia sem quebrar o padrão visual da linha). Central de Ajuda
ajustada junto.

### v8.30.355-dev — 2026-08-10
Pedido direto: "e os filtros? temos que ter filtros para os supercards
quando ativos".

- Novo filtro "🧩 Supercards" no drawer de Filtros (junto de "Só
  impedidos"/"Com riscos") — mostra só cards que têm pelo menos 1 card
  filho ainda ativo. Combina com os outros filtros, normalmente.
- Extraído `_cardIsSupercard(card)` (mesma regra que já decidia o
  rollup roxo no board) pra reusar no filtro em vez de duplicar a
  lógica.
- Central de Ajuda (❓/Ctrl+K) atualizada — item "Filtros" menciona a
  nova opção.

### v8.30.354-dev — 2026-08-10
Central de Ajuda (❓, Ctrl+K) atualizada: o item "🧾 Receitas prontas"
do help de Supercard agora menciona que dá pra digitar vários nomes de
filho de uma vez, separados por vírgula (já valia desde a v8.30.351-dev,
mas só o texto da aba Config tinha sido atualizado).

### v8.30.353-dev — 2026-08-10 — REGRESSÃO CRÍTICA
Bug reportado: "aplico a receita ao card pai na criação, aparecem os
filhos, mas não salva — não sei se foi aquele ponto de não salvar
quando cancelar, mas agora não tá salvando NUNCA". Era exatamente
isso — regressão do fix de filhos órfãos (v8.30.350-dev).

- **Causa raiz**: `editingId` continua `null` mesmo depois de um card
  NOVO salvar com SUCESSO (só passa a existir de verdade quando o card
  é reaberto — é o mesmo comportamento que causava cards duplicados em
  clique duplo, corrigido em v8.30.347-dev). O fix de filhos órfãos
  usava `!editingId` em `_finishCloseOv()` como sinal de "pai
  cancelado sem salvar" — mas esse mesmo `null` aparece TAMBÉM logo
  depois de um salvamento bem-sucedido, então a limpeza apagava os
  filhos de verdade (que tinham acabado de ser vinculados
  corretamente) segundos depois de criados.
- Corrigido: o `.then()` de sucesso de `saveCard()` agora limpa
  `_newSuperChildIds` ANTES de fechar o modal — os filhos já estão
  legitimamente vinculados no `childCardIds` que acabou de salvar, não
  são mais "órfãos em risco". A limpeza em `_finishCloseOv()` só
  dispara de verdade quando o modal fecha SEM ter passado por aqui
  (cancelar de fato).
- **Prioridade alta**: promover pro prod assim que validado — o fix
  anterior (v8.30.350-dev/prod v8.30.234) já está em produção e
  quebrando esse fluxo pra quem usa fan-out em card novo.

### v8.30.352-dev — 2026-08-10
Refatoração pura (sem mudança de comportamento pretendida) pedida na
revisão do supercard/fan-out — remove as 2 duplicações de código
identificadas:

- **Molde de card filho unificado**: `quickCreateSuperChild()` e
  `_applyFanoutTemplate()` tinham o mesmo objeto de "card em branco"
  (herda col/due/priority/demandante do pai) copiado em 2 lugares.
  Extraído pra `_blankSuperChildCard(parentCard, title, {idx, modelo,
  user})`. Bônus de consistência descoberto no processo: filhos de
  fan-out sem modelo vinculado agora herdam o PO do card pai (mesmo
  padrão de due/priority/demandante) — antes só herdavam PO quando
  vinha de um Modelo, ficando vazio nos outros casos.
- **Regra de mesclagem de Modelo unificada**: `aplicarModeloNoCard()`
  (mexe no form/DOM) agora lê o form pra um objeto simples, chama
  `_mergeModeloEmCardObj()` (mesma função que a automação já usava) e
  escreve o resultado de volta — em vez de reimplementar a regra
  "nunca sobrescreve" em paralelo. Foi essa duplicação que deixou o
  bug da submarca escapar numa correção anterior (corrigido só numa
  das duas cópias na 1ª rodada).
- `fbSaveCard()` do filho criado por `quickCreateSuperChild()` ganha
  `.catch()` (antes só o caminho de fan-out tinha).

### v8.30.351-dev — 2026-08-10
Revisão pedida do fluxo de Supercard/fan-out inteiro, atrás de
simplificação e melhoria de UX (não bug report). 3 ajustes de baixo
risco aplicados; outros pontos (dedup de código, batch-input real com
textarea) ficam de recomendação — ver conversa.

- **Receitas vazias somem do dropdown "🧩 Aplicar receita"**: antes
  toda receita cadastrada aparecia, mesmo sem nenhum filho configurado
  — clicar caía direto num toast de erro ("essa receita ainda não tem
  cards filhos"). Filtrado na origem.
- **Adicionar vários filhos de uma vez**: "+ Card filho" aceita nomes
  separados por vírgula (ex.: "Feed, Stories, Reels") em vez de exigir
  um clique+prompt por filho — reduz o atrito de montar uma receita
  com vários formatos, que era o próprio caso de uso original.
- Texto de ajuda da aba Automações atualizado (menciona o modelo do
  card pai, que ainda não estava documentado ali).

### v8.30.350-dev — 2026-08-10
Dois bugs reais reportados no teste do modelo de card pai (2ª rodada):
"n ta pegando... descrição, data e submarcas" + "cancelei o card mas
os cards filhos foram criados mesmo assim".

- **Fix — Submarca não sincronizava**: `aplicarModeloNoCard()` (usado
  tanto pelo botão "📥 Usar modelo" quanto pelo modelo do card pai do
  fan-out) mesclava a tag de submarca do modelo em `editingTags`
  certinho, mas o campo dedicado `<select id="m-submarca">` não é
  populado pelo picker geral de tags — continuava mostrando "sem
  submarca". Pior: `saveCard()` valida submarca obrigatória lendo o
  VALOR DO SELECT, não `editingTags` — então salvar continuava
  bloqueado mesmo com a tag aplicada (é o que gerou o "deu erro" do
  2º bug abaixo). Agora sincroniza o select também. Afeta os DOIS
  caminhos que usam essa função (botão "Usar modelo" isolado E o
  modelo do card pai do fan-out).
- **Sobre "data" não vir do modelo**: não é bug — Modelo nunca teve
  campo de Prazo (nem no "Usar modelo" clássico). Prazo é específico
  de cada card, não faz parte do que um Modelo guarda hoje.
- **Fix — filhos órfãos ao cancelar**: cards filhos criados via
  fan-out (ou "+ Adicionar" → título novo) já nascem como cards de
  verdade no Firebase mesmo com o card PAI ainda não salvo. Cancelar a
  criação do pai antes de salvar deixava esses filhos soltos no board,
  sem vínculo com nada. Agora `_finishCloseOv()` exclui de verdade os
  filhos criados nesta sessão (não os vinculados a partir de um card
  já existente — esses continuam intactos) quando o modal fecha sem o
  pai ter sido salvo.

### v8.30.349-dev — 2026-08-10
Feedback do teste do v8.30.348-dev: "quando apliquei a receita no
card, ele não usou o modelo que eu implantei como card pai". Investigado
a fundo — não era bug de lógica, era falta de confirmação: o modelo
testado só tinha tags (sem checklist/riscos/descrição), e essas tags
realmente foram aplicadas certinho, só que sem nenhum aviso visível.

- **Causa raiz**: `showToast()` usa um único elemento reaproveitado
  (não empilha mensagens). O toast "📥 Modelo aplicado" que
  `aplicarModeloNoCard()` dispara era sobrescrito quase na hora pelo
  toast final "✅ N card(s) criado(s)" — a pessoa nunca via a primeira
  mensagem, dando a impressão de que o modelo do card pai não tinha
  sido usado, mesmo tendo sido.
- O toast final agora menciona os dois: "✅ N card(s) criado(s) a
  partir de 'Receita' + modelo 'X' aplicado no card pai".
- Não muda nenhum comportamento de dado, só a mensagem de confirmação.

### v8.30.348-dev — 2026-08-10
Pedido direto: "o card pai 'supercard' lá nas configurações também em
automação, só da pra alterar o nome... tem que conseguir alterar o
card todo!" — no editor de receitas de fan-out (⚙ Config →
Automações), só dava pra renomear a receita (✎); cada card FILHO já
podia ser vinculado a um Modelo (descrição/checklist/tags/riscos), mas
o card PAI não tinha jeito de ser estruturado igual.

- Cada receita ganha um seletor "👑 Card pai" (mesmo lugar dos
  filhos): vincula um Modelo que é mesclado no card pai ao aplicar a
  receita — descrição/PO só entram se estiverem vazios, tags/checklist/
  riscos são somados sem duplicar (nunca apaga o que o card já tinha).
- Caminho manual (botão "🧩 Aplicar receita" dentro do card): reaproveita
  o `aplicarModeloNoCard()` que já existe pro "📥 Usar modelo" — mesma
  regra de mesclagem, já validada, funciona com o card salvo ou ainda
  sendo criado.
- Caminho automático (ação "🧩 Aplicar fan-out"): não tem modal aberto,
  então mescla direto no objeto do card via `_mergeModeloEmCardObj()`
  (mesma regra de mesclagem, versão sem DOM).
- Help content atualizado.

### v8.30.347-dev — 2026-08-10
Bug reportado com print: ao criar um card novo, o salvamento demorou,
o modal não fechou na hora e vários cliques em "💾 Salvar" criaram
vários cards duplicados ("teste" x4 no board).

- **Causa raiz**: `saveCard()` não tinha nenhuma trava de reentrância.
  Como `editingId` só é setado depois que o Firebase confirma (pra não
  fechar o modal antes da hora — fix de uma sessão anterior), cada
  clique extra enquanto o save original ainda estava em voo reexecutava
  o branch de "card novo" do zero, criando outro card.
- Adiciona flag `_savingCard` (só ativa a partir do commit, depois das
  validações — não trava quem está corrigindo um campo obrigatório) +
  desabilita o botão "💾 Salvar" com label "Salvando…" enquanto o
  Firebase não confirma. Reset também numa rede de segurança em
  `_finishCloseOv()`, cobrindo qualquer caminho de fechamento do modal.
- Corrige duplicação de card; não afeta nenhum outro comportamento.

### v8.30.346-dev — 2026-08-10
Correção de rota do v8.30.345-dev: `mix-blend-mode:multiply` (opção C
do artefato) saiu clara demais na prática — "ficou mt claro agora
kkkk". Trocado pela opção **D** do mesmo artefato, sem precisar de
novo round de teste visual (já tinha sido comparada lado a lado).

- `.card-tag`, `.exec-chip`, `.due-badge`, `.risco-badge` e
  `.cal-event-prazo` no tema claro agora reforçam o ALPHA do
  preenchimento primeiro (`box-shadow: inset 0 0 0 20px
  color-mix(in srgb, currentColor 22%, transparent)`) e só depois
  escurecem fundo+borda+texto juntos (`brightness(.48) saturate(1.55)
  drop-shadow(0 0 2px currentColor)`) — pill sólida e saturada em vez
  de um tingimento fraco.
- Puramente visual, não muda legibilidade nem dado nenhum.

### v8.30.345-dev — 2026-08-10
Continuação do v8.30.344-dev: o `drop-shadow(currentColor)` melhorou
texto/borda, mas as tags continuavam "apagadas" — feedback direto com
print apontando o 👕 tamanho. Antes de mexer de novo às cegas, montei
um artefato comparando 4 técnicas lado a lado (réplica pixel-a-pixel
do card real) e o usuário escolheu a opção **C**.

- Diagnóstico: o problema nunca foi o brilho do texto, e sim o
  **preenchimento** — cada pill usa uma cor clara com alpha baixo (ex.
  `rgba(255,209,102,.12)` no 👕), e alpha-blend de cor clara a 12%
  sobre um card quase-branco já é quase invisível antes de qualquer
  filter; escurecer essa mistura só troca "apagado claro" por
  "apagado escuro".
- Trocado `brightness(.5) saturate(1.4) drop-shadow(...)` por
  `mix-blend-mode:multiply` (+ `isolation:isolate` + `saturate(1.15)`)
  em `.card-tag`, `.exec-chip`, `.due-badge`, `.risco-badge` e
  `.cal-event-prazo` no tema claro. Mantém a cor viva ORIGINAL de cada
  tag (pensada pro escuro) e multiplica contra o fundo do card em vez
  de diluir por alpha — mesma saturação do tema escuro, sem escurecer
  o texto.
- Puramente visual, não muda legibilidade nem dado nenhum.

### v8.30.344-dev — 2026-08-09
Correção de rota: o pedido anterior (v8.30.343-dev) tinha entendido
"deixa mais aceso, meio que neon" como um pulso animado no card "seu
card" — não era isso. Removido o pulso; o pedido real era sobre as
**tags/labels/badges do card** (Data, Bloqueio, tamanho, submarca...)
parecerem "escurecidas" no tema claro, sem a pegada neon que elas têm
no escuro.

- Tags/badges no tema claro ganham um `drop-shadow(currentColor)`
  (glow sutil na cor original de cada uma) somado ao escurecimento já
  existente (`brightness(.5) saturate(1.4)`, validado em 2 rounds de
  feedback anteriores por legibilidade). `drop-shadow` com
  `currentColor` pega a cor VIVA de cada tag antes do escurecimento
  (filter não muda o valor computado de `color`, só o resultado
  pintado), então o brilho sai na cor certa mesmo com o pill mais
  escuro por baixo.
- Aplica em `.card-tag`, `.exec-chip`, `.due-badge`, `.risco-badge` e
  `.cal-event-prazo` (mesmo grupo que já tinha o fix de contraste).
- Puramente visual, não muda legibilidade nem dado nenhum.

### v8.30.343-dev — 2026-08-09
Pedido direto: "esse meu card pode ficar mais aceso, usa aquele
recurso de dar brilho, meio que neon". O selo "👤 seu card" (card em
que você é responsável/participante) ganha um brilho pulsante
contínuo, nos dois temas — reaproveita o mesmo truque de glow em
camadas (`box-shadow` com blur crescente) que outros destaques do
board já usam, só que em loop infinito em vez de disparar uma vez só.
Cor do brilho segue o mesmo azul que o "seu card" já usava em cada
tema (`--card-mine-glow-rgb`, nova variável), então não precisou de
uma animação separada por tema. Puramente visual.

### v8.30.342-dev — 2026-08-09
Fix de contraste reportado com print: o supercard estava muito ruim
de ler no tema claro — a borda esquerda roxa (`#a78bfa`) e o texto do
cabeçalho do rollup (`#c4b5fd`, "🧩 X/N concluído(s)") são cores
pensadas pro fundo escuro, quase invisíveis num card claro.

- Borda do supercard: cor mais escura/saturada só no tema claro (mesmo
  padrão já usado em `.okr-card`).
- Cabeçalho do rollup: mesmo `filter:brightness(.55) saturate(1.4)` já
  usado nos outros badges pastel do card (`.exec-chip`, `.due-badge`,
  `.risco-badge`).
- Botão "✕" de remover filho (dentro do modal): cor clara pensada pra
  "quase invisível até passar o mouse" no escuro trocada por um tom
  escuro equivalente no claro.
- Puramente visual, não muda nenhum dado nem comportamento.

### v8.30.341-dev — 2026-08-09
Feedback direto testando as receitas de fan-out: os filhos nasciam só
com um título, sem nenhuma estrutura — pedido pra deixá-los "o mais
estruturado possível pra quando eu gerar a receita".

- 📋 **Filhos vinculados a um Modelo**: em cada receita (Config →
  Automações), cada card filho agora tem um seletor "📋 Modelo"
  (opcional) — escolha um Modelo já existente (⚡ Funções de card →
  📋 Modelos) e, quando a receita gerar esse filho, ele nasce com a
  descrição, checklist (sempre desmarcado, mesmo que o modelo original
  tivesse itens já concluídos — mesmo comportamento de "usar modelo"
  num card normal), tags e riscos do modelo, em vez de um card vazio.
- Reaproveita o sistema de Modelos que já existe (mesmos campos que
  "✅ Usar modelo" aplica) em vez de um editor de descrição/checklist
  novo só pra isso — "edite só o que for diferente".
- Filho sem modelo vinculado continua funcionando exatamente como
  antes (nasce só com o título).

### v8.30.340-dev — 2026-08-09
Dois ajustes de feedback direto testando o supercard:

- **← Voltar**: ao pular de um card pra outro relacionado (abrir um card
  filho a partir do pai, ou voltar do filho pro pai pela nota "Este card
  é filho de..."), o modal ganha um botão "← Voltar" no topo que retorna
  pro card anterior sem precisar buscar de novo. Funciona encadeado
  (pai → filho → outro filho → volta → volta) e reseta sozinho sempre
  que um card é aberto "do zero" (clique direto no board, por exemplo) —
  não fica um botão "fantasma" apontando pra um contexto antigo.
- **Cards filhos ao criar um card novo**: antes a seção "🧩 Cards filhos"
  só aparecia depois do card já estar salvo (sem id ainda não tinha onde
  guardar o vínculo). Agora ela já funciona no card ainda sendo criado —
  vincular um existente, criar um novo filho ou aplicar uma receita
  funciona igual; os filhos já nascem como cards de verdade na hora, e o
  vínculo com o pai entra no Firebase junto quando você clica em Salvar.

### v8.30.339-dev — 2026-08-09
Fix de legibilidade reportado ao testar o supercard: a lista "🧩 Cards
filhos" dentro do card estava difícil de ler (fonte pequena e em
negrito — 11px/9px, bold — que borra/"neon" em telas escuras). Ajuste
de tipografia na lista de filhos (modal) e no cabeçalho do rollup
(board): fontes um pouco maiores, peso mais leve no título (600→500)
e cor de apoio mais contrastante (`--txt3` → `--txt2`). Puramente
visual, não muda nenhum dado nem comportamento.

### v8.30.338-dev — 2026-08-09
Camada de automação do supercard (v8.30.337-dev validado, "seguir para
automação"): pedido original também incluía uma tela pra configurar
receitas e disparar a criação dos cards filhos sozinha em casos já
"meio programados" (ex.: campanha de mídia paga sempre gera os mesmos
6 formatos).

- 🧾 **Receitas de Supercard (fan-out)** — nova seção em ⚙ Config →
  Automações: crie uma receita nomeada (ex.: "Campanha de mídia
  paga") com a lista de cards filhos que ela sempre gera (ex.: Feed,
  Stories, Reels, Display...). Cada filho nasce com o título
  "{card pai} — {nome do filho}", herdando coluna/prazo/prioridade/
  demandante do pai.
- 🧩 **Botão manual "Aplicar receita"** — dentro de qualquer card, ao
  lado de "+ Adicionar" na seção Cards filhos, escolha uma receita e
  todos os filhos são criados de uma vez. Cobre o caso "pedido do dia
  a dia" que não tem gatilho automático nenhum — a maioria dos casos
  reais, segundo o relato original.
- 🤖 **Ação de automação "Aplicar fan-out"** — nova opção em "Então"
  nas regras de automação (Config → Automações), pra quando o
  disparo É previsível (ex.: "Quando tag 'mídia paga' for adicionada
  → Aplicar fan-out: Campanha de mídia paga"). Só dispara uma vez por
  card (guarda de idempotência: card que já é supercard não aplica de
  novo), então um trigger que repita não duplica os filhos.
- Receita sem nenhum card filho configurado não faz nada (nem no
  botão manual, nem na automação) — sem erro silencioso, avisa no
  toast.

### v8.30.337-dev — 2026-08-09
Primeira versão do **"supercard"** (cards filhos) — pedido direto do
time de Mídia Alcance: um pedido do dia a dia (nem sempre é campanha
formal) costuma virar vários cards por causa de formato/veículo/teste
diferentes, e hoje isso fica solto no board sem nenhum agrupamento.

- 🧩 Um card pode ganhar **cards filhos**: dentro dele, na seção
  "🔗 Vínculos & anexos", tem "🧩 Cards filhos (supercard)" — vincula
  um card já existente pela busca, ou digita um título novo e aperta
  Enter pra criar um card filho na hora (herda coluna, prazo,
  prioridade e demandante do pai, pra não repetir contexto).
- No board, o card pai vira um **supercard**: borda esquerda roxa e
  uma lista compacta dos filhos dentro do próprio card (bolinha da
  cor da coluna de cada um + "X/N concluído(s)") — sem precisar abrir
  nada pra saber como anda. Clique num filho da lista abre ele
  direto.
- Os filhos continuam cards **normais e independentes** — cada um
  anda na sua própria coluna, tem seu próprio responsável/prazo. O
  supercard só agrupa a visão, não move nem trava nada. Diferente de
  "🔗 Vínculos" (referência solta) e "⛓ Dependências" (bloqueio/ordem
  entre cards).
- Trava simples contra bagunça: um card não pode virar filho de si
  mesmo, e um supercard não pode ter outro supercard como filho
  (profundidade 1 só, evita ciclo/recursão no rollup do board).
- Reaproveita um toolkit visual (`.minicard`/`.link-dropdown`/
  `.link-option`) que já existia pronto no CSS — sobra de uma versão
  anterior de "cards vinculados" que nunca ganhou HTML — em vez de
  inventar um padrão novo.
- **Escopo desta 1ª versão**: só o núcleo (dado + board + modal). A
  parte de configurar automações que criam os cards filhos sozinhas
  (ex.: "supercard de campanha de mídia paga sempre gera Feed/Stories/
  Reels") fica pra depois de validar o conceito visual com o time.

### v8.30.336-dev — 2026-08-09
Feedback direto depois de usar a aba 💡 Insights ao vivo: hoje ela é
sempre uma **foto do board agora** (recalcula do zero a cada abertura,
sem nenhum registro histórico) — passou a dar pra restringir essa foto
por período e por tag, em vez de só oferecer os dados como estão.

- ⏱ **Filtro de período**: por padrão continua olhando "🔵 Ativos
  agora" (todos os cards ativos, sem restrição — comportamento
  original, sem mudança pra quem não mexer no filtro). As outras
  opções (Criados 7/14/30/90 dias) restringem aos cards ativos
  **criados** dentro da janela — não muda a definição de "ativo"
  (continua excluindo concluídos/arquivados), só adiciona um corte por
  data de criação.
- 🏷 **Filtro de tag**: clique numa ou mais tags do squad pra restringir
  a análise só a cards com pelo menos uma delas marcada — útil pra
  perguntas tipo "como está a prioridade só dos cards da campanha X".
- Os dois filtros combinam entre si e com qualquer seção da aba
  (prioridade, carga, riscos, OKR, aging, submarca). Resetam sozinhos
  toda vez que o modal "📊 Dados do Board" é reaberto, pra ninguém
  esquecer um filtro ligado de uma visita anterior e estranhar os
  números.
- Ajustada a linguagem da aba (texto de intro + Central de Ajuda) de
  "PO/ADM" pra "PO/ADM/Organizador" — o botão "📊 Dados do Board" já
  era visível pra qualquer papel (não tinha restrição de acesso),
  então isso é só a descrição refletindo quem já podia ver.

### v8.30.335-dev — 2026-08-07
Renomeia a squad "Dados" pra "Squad Dados e IA" (mesma mudança
aplicada em `kanban.html`, `painel.html` e `painel-dev.html` — só o
rótulo de exibição, o id interno `dados` não muda).

### v8.30.334-dev — 2026-08-07
Nova aba "💡 Insights" dentro de 📊 Dados do Board, pedida direto pra
dar aos POs/ADMs uma leitura mais interpretativa da squad — sem
nenhuma leitura nova do Firebase (tudo calculado a partir do que o
board já tem carregado em memória).

- 🚦 **Por prioridade** (donut) — com aviso se "Crítica" passar de 30%
  do board ativo (priorização inflacionada).
- 👤 **Carga por responsável** (barras) — com aviso quando alguém tem
  bem mais cards ativos que a média do squad.
- ⚠️ **Cards com mais riscos mapeados em aberto** (lista clicável,
  top 5).
- 🎯 **OKR por coluna** — só aparece se houver card marcado como OKR;
  mostra se as entregas estratégicas estão de fato avançando ou
  paradas no Backlog.
- 💤 **Cards parados** — os com mais tempo sem edição (≥ 1 sprint),
  mesmo cálculo que já esmaece o card visualmente no board.
- 🏷️ **Por submarca** (donut) — só aparece se o squad usa o campo
  Submarca.
- Reaproveita o mesmo kit visual do dashboard de Controle de
  Criativos (donut/barras/abas) em vez de inventar um padrão novo.
- Aba de Ajuda atualizada com a explicação da nova aba.

### v8.30.333-dev — 2026-08-07
Nova ação de automação pedida pelo time: "Remover tag".

- 🏷 **Ação "Remover tag"** — espelha a "Adicionar tag" já existente.
- 🏷 **Gatilho "Tag removida do card"** (novo) — mesma lógica da "Tag
  adicionada ao card": dispara em qualquer remoção de tag, seja pelo
  campo do modal, seleção em massa ("Substituir"/"Remover todas as
  tags"), etc.
- Aba ⚡ Automações da Central de Ajuda atualizada com os dois itens
  e mais 1 receita de exemplo.

### v8.30.332-dev — 2026-08-07
1ª rodada de otimização de bytes/performance, pedida direto ("olhar
os códigos e diagnosticar/resolver questões de otimização de código +
mobile, pensando em economizar bytes de download").

Diagnóstico: o arquivo é 1 página auto-contida (~1.5MB), sem build
step por decisão de arquitetura (ver CLAUDE.md) — então minificar ou
quebrar em múltiplos arquivos JS/CSS externos está fora de escopo
(mudaria a arquitetura "cada página é standalone"). Dentro dessa
restrição, achei e corrigi:

- 🖼️ **Favicon duplicado 4x dentro do HTML**: o mesmo ícone (PNG
  180×180) estava embutido como `data:image/png;base64,...` em 4
  lugares (favicon, apple-touch-icon, logo da tela de login, ícone do
  manifest do PWA) — ~75KB de base64 REPETIDOS no arquivo, e pior:
  como o HTML inteiro é rebaixado a cada atualização de versão (o que
  acontece com bastante frequência), esses bytes eram baixados de
  novo toda vez, mesmo sem o ícone ter mudado. Extraído pra um arquivo
  `favicon.png` (14KB, cacheável separadamente pelo browser) e
  referenciado nos 4 lugares — **~75KB a menos no HTML** (~5% do
  arquivo) e o ícone passa a ser baixado só 1x, não a cada deploy.
- 🔌 **`<link rel="preconnect">`** pros domínios externos usados logo
  no `<head>`/topo do módulo Firebase (`fonts.googleapis.com`,
  `fonts.gstatic.com`, `www.gstatic.com`) — adianta o DNS/TLS desses
  domínios em paralelo com o resto do carregamento, sem custo.

Não fiz (ficam pra uma rodada futura, com mais contexto/aprovação,
por mudarem a arquitetura atual em vez de só cortar bytes redundantes):
dividir o `<script>` principal (~19 mil linhas, ~1MB) num arquivo
`.js` externo cacheável à parte do HTML — o maior ganho de bytes
possível no arquivo, mas contraria a decisão documentada de "cada
página é 100% self-contained, sem imports entre arquivos".

### v8.30.331-dev — 2026-08-07
Mais uma rodada de ajuste no tema claro ("lençóis maranhenses"),
pedida direto por 2 problemas de contraste vistos no board:

- 🐛 **Nome da squad ilegível no header** — o badge com o nome do
  squad (e vários outros rótulos: título de campo, título de seção,
  raia, contador de coluna...) usava `--cyan` num tom claro
  (`#4FC3F7`) que ficava quase invisível em cima do fundo/glass claros
  do tema (contraste ~1.6:1). Escurecido pra `#0A6C8C` (~4.5-4.8:1),
  ainda reconhecível como "ciano" mas legível de verdade.
- 🌤️ **Fundo mais escuro de novo** — 2ª rodada de escurecimento do
  fundo de página/glass (a 1ª foi na promoção pra prod v8.30.226);
  cards continuam como estavam (--surface-rgb intocado), o que reforça
  ainda mais o contraste card-vs-fundo.

### v8.30.330-dev — 2026-08-07
Mais 7 gatilhos novos, pedidos direto: 5 espelhando ações que já
existiam ("tag adicionada", "definir submarca", "marcar como OKR",
"definir capa de cor", "definir padrão de card") e 2 conceitos novos
("modelo usado", "card recorrente criado").

- 🏷 **Tag adicionada ao card** — dispara com qualquer tag nova
  (adicionada pelo campo do modal, seleção em massa, etc.).
- 🏷️ **Submarca definida como X** — reaproveita a mesma detecção de
  "Tag adicionada" (submarca é uma tag por baixo dos panos); só
  aparece no dropdown se o squad usa o campo Submarca.
- 🎯 **Card marcado como OKR** — dispara só ao marcar (não ao
  desmarcar), pelo menu de contexto ou pelo checkbox do modal.
- 🎨 **Capa de cor definida como X** — inclusive "sem capa" como valor,
  pra reagir quando alguém remove a capa.
- 📐 **Padrão de card definido como X** — só aparece se existir algum
  Padrão criado no squad.
- 📋 **Modelo X usado** / 🔁 **Card recorrente X criado** — conceitos
  que só existiam como AÇÃO disponível em "Salvar como modelo/
  recorrente" antes; agora um modelo/recorrente específico pode
  disparar uma regra quando é usado. "Card recorrente criado" cobre
  tanto o "✅ Usar" manual quanto a recriação automática (Recorrência
  automática, ao abrir o board). Cada gatilho só aparece se existir
  pelo menos 1 modelo/recorrente cadastrado.
- Lista de gatilhos (QUANDO) passou a esconder/mostrar opções
  dinamicamente conforme o squad (mesmo comportamento que a lista de
  ações já tinha) — antes só se aplicava ao ENTÃO.
- Aba ⚡ Automações da Central de Ajuda atualizada com os 7 gatilhos
  novos e mais 3 receitas de exemplo.

### v8.30.329-dev — 2026-08-07
Generaliza "Prioridade" e adiciona gatilho de atribuição, pedidos
depois do teste da v8.30.327/328-dev.

- 🔴 **"Prioridade definida como X" generalizado** — antes só existia
  travado em "Crítica"; agora aceita qualquer nível (Baixa/Média/Alta/
  Crítica), igual ao seletor de coluna do "Card movido para". Regras
  antigas (só "crítica") continuam funcionando sem migração — se a
  regra não tiver um nível salvo, o sistema assume "crítica" como
  antes. **Corrige também um resquício do bug anterior**: os 3 pontos
  onde a prioridade é definida (Salvar do modal, menu de contexto,
  Ficha de Criativo) agora disparam a automação em qualquer troca de
  nível, não só quando vira Crítica.
- 👤 **Novo gatilho "Card foi atribuído a X"** — dispara quando um
  responsável específico é atribuído ao card, seja pelo campo
  Responsável no modal, "Atribuir a mim" (menu de contexto) ou a ação
  em massa "👤 Responsável" (seleção múltipla). Junto com a ação
  "Mover card para coluna" já existente, cobre o caso pedido: "quando
  atribuído a Fulano, mover pra Em andamento".
- Aba ⚡ Automações da Central de Ajuda atualizada com os dois itens
  acima, incluindo 2 receitas novas e uma pergunta no Q&A sobre por
  que alguns gatilhos/ações aparecem só de um lado (QUANDO ou ENTÃO) e
  outros nos dois.

### v8.30.328-dev — 2026-08-07
Padroniza o horário de disparo diário das automações/notificações de
prazo — pedido direto depois do teste da v8.30.327-dev.

- ⏰ **Horário fixo: 09:00, horário de São Paulo** — os gatilhos
  "Card vence hoje", "Card atrasado (1º dia)" e "Card parado há muito
  tempo" (automações), e os avisos de prazo pro responsável
  (notificações), agora só disparam a partir das 09:00 (America/
  Sao_Paulo), calculado com `Intl.DateTimeFormat` — funciona igual
  não importa o fuso do computador de quem está com o board aberto.
  Antes, o disparo (1x/dia) acontecia em qualquer horário em que
  alguém abrisse/recarregasse o board, dependendo do fuso do sistema
  de cada um.
- Se o board já estiver aberto antes das 9h, não precisa recarregar a
  página: um retry a cada 5 minutos cobre esse caso e dispara sozinho
  assim que a hora chegar.
- Ajustada a aba ⚡ Automações da Central de Ajuda pra explicar o novo
  horário fixo.

### v8.30.327-dev — 2026-08-07
Bugfix reportado depois de testar as 5 automações da v8.30.325-dev: só
a de "Card foi marcado como impedido" disparou.

- 🐛 **"Prioridade definida como crítica" era um trigger morto** — igual
  ao bug do `due_today`/`due_overdue` corrigido na v8.30.325-dev, mas
  não pego na hora: prioridade só é gravada no card pelo botão Salvar
  manual do modal (não tem autosave, ver `_manualFieldsNow()`), e o
  `runAutoRules()` chamado nesse ponto dispara com o evento genérico
  `'edit'`/`'create'` — que nenhum trigger escuta. Resultado: essa
  automação nunca disparava de verdade em lugar nenhum. Corrigido
  disparando explicitamente `runAutoRules('priority', ...)` sempre que
  a prioridade vira Crítica, nos 3 lugares onde ela pode ser definida:
  botão Salvar do card (criação e edição), "Definir prioridade" do
  menu de contexto (clique direito no card) e a edição inline na
  tabela de 🎬 Controle de Criativos. Guarda contra prioridade que já
  estava Crítica (evita disparar de novo a cada edição não relacionada
  e duplicar ações não-idempotentes, como "Adicionar item de
  checklist").
- As outras 3 regras que não dispararam no teste (2x "Card vence hoje",
  1x "Card movido para coluna") não tinham bug de código — "Card vence
  hoje"/"Card atrasado" já eram, por design, checados só 1x por dia por
  navegador (mesmo horário do aviso de prazo); se a regra foi criada
  depois desse horário já ter passado no dia, só entra em ação amanhã.
  "Card movido para coluna" só dispara num movimento de verdade
  *depois* da regra ficar ativa — não retroage pra cards que já
  estavam parados na coluna antes da regra existir.
- Ajustada a aba ⚡ Automações da Central de Ajuda (adicionada na
  v8.30.326-dev) pra refletir a correção: selo "CORRIGIDO" no gatilho
  "Prioridade virou Crítica" e nota explicando o timing de 1x/dia dos
  gatilhos de prazo.

### v8.30.326-dev — 2026-08-07
Nova aba **⚡ Automações** na Central de Ajuda (❓, dentro do board),
dedicada ao recurso revisado na v8.30.325-dev — pedida pra ensinar o
uso com bastante exemplo visual em vez de só texto corrido.

- Explica o que é uma regra (QUANDO/E/ENTÃO) com um bloco visual
  colorido em vez de só texto.
- Lista todos os gatilhos e ações disponíveis hoje, com selos "NOVO"/
  "CORRIGIDO" nos que mudaram na revisão anterior, e nota de quais
  ações só aparecem se o squad usa aquele recurso.
- Explica condição extra e múltiplas ações com exemplo lado a lado.
- 7 "receitas prontas" (QUANDO → ENTÃO reais, prontas pra copiar a
  ideia), em cartões coloridos.
- Seção de dúvidas frequentes (Q&A) cobrindo as perguntas mais óbvias:
  regra antiga continua funcionando?, por que uma ação não aparece no
  dropdown?, por que "vence hoje" não disparou na hora?, etc.
- Aba adicionada no fim de todas as listas relevantes (botão, array de
  navegação por índice, busca global, rótulo do resultado de busca) —
  não mexe na ordem das abas existentes.

### v8.30.325-dev — 2026-08-07
Revisão completa de Automações do board (Config → ⚡ Auto), pedida
depois de perceber que o recurso estava defasado em relação ao resto
do app. Feita em 3 fases, todas neste lote:

**Fase 1 — motor data-driven + bugs corrigidos + ações novas.**
`populateAutoSelects`/`saveAutoRule`/`runAutoRules` deixaram de ser um
`if/else` repetido em 3 lugares (fácil de esquecer um — foi exatamente
o que causou os 2 bugs abaixo) e viraram uma config só (`AUTO_TRIGGERS`/
`AUTO_ACTIONS`), cada trigger/ação com sua própria lógica.
- 🐛 **`due_today`/`due_overdue` eram triggers mortos**: apareciam no
  dropdown e no rótulo da regra, mas nunca eram checados de verdade em
  `runAutoRules`. Agora disparam de verdade, 1x/dia, junto do aviso de
  prazo que já existia.
- 🐛 **"Notificar Agente Ágil" não fazia nada** — o Agente Ágil está
  temporariamente desativado (`AGENTE_AGIL_ATIVO=false`) e essa ação
  só mostrava um toast de "desativado". Agora essa opção só aparece no
  dropdown quando o Agente Ágil estiver ativo — evita configurar uma
  automação que não faz nada.
- Ações novas, fechando o gap com os campos que o card já tem:
  definir Submarca, Tamanho, Demandante, Padrão de card, Capa de cor,
  marcar como OKR, adicionar item de checklist. Cada uma só aparece no
  dropdown se o squad usa aquele recurso (ex.: "Definir submarca" só
  se `submarcaAtivo`).

**Fase 2 — triggers novos**, cobrindo eventos que já geravam
notificação dedicada mas nunca tinham automação: checklist chegou a
100%, risco foi adicionado, card foi bloqueado, card foi desbloqueado,
e card parado há muito tempo sem edição (reaproveita o mesmo cálculo
de "sprint parada" já usado pra esmaecer o card no board — checado
1x/dia, dispara só no dia exato em que cruza o limiar, não repete todo
dia).

**Fase 3 — regras mais expressivas**: condição extra opcional ("E a
tag do card é X") e mais de uma ação por regra (botão "+ Ação" antes
de salvar) — cobre o caso de "mover pra Done E definir prioridade",
por exemplo. Regras salvas antes desta versão continuam funcionando
sem nenhuma migração (formato antigo é lido on-the-fly).

Cuidado com bytes/layout: nada disso baixa dado novo do Firebase (só
reorganiza lógica que já rodava local); dropdowns continuam com o
mesmo tamanho visual, só escondem opção que não se aplica ao squad.

### v8.30.324-dev — 2026-08-06
Remove o campo de capa de cor debaixo do Título — ficou redundante
depois do botão 🎨 no header (pedido direto: "aí tira debaixo do
título"). O popover do header passa a ser o único lugar pra escolher a
capa.

### v8.30.323-dev — 2026-08-06
Pedido direto: botão 🎨 no header do modal (junto dos outros ícones,
ao lado de Compartilhar) abrindo um popover com os mesmos swatches de
capa de cor — acesso rápido sem precisar rolar até o campo abaixo do
Título, que continua existindo também. Os dois lugares ficam
sincronizados (mesmo estado, `card.coverColor`/`_pendingCoverColor`).

### v8.30.322-dev — 2026-08-06
- **Fix real do posicionamento do Demandante**: a v8.30.321-dev não
  funcionou — o raciocínio sobre CSS Grid estava errado (a linha
  inteira do grid fica com a altura da coluna mais alta, então o 3º
  item só aparecia DEPOIS de tudo, não "do lado"). Corrigido de
  verdade agrupando Responsável + Demandante num wrapper próprio
  dentro da mesma coluna do grid, o que os empilha e faz o Demandante
  nascer na altura aproximada de "Sem prazo definido".
- **Nova feature: Capa de cor (testeira)** — baseado no recurso de
  capa do Trello, pedido direto porque "as tags parecem não ser
  suficiente visualmente" pra organizar o board. Uma tira de cor fina
  no topo do card, visível tanto no board quanto no modal. Paleta fixa
  de 9 cores + "sem capa", escolhida num seletor simples de swatches
  logo abaixo do Título no modal. Funciona em card novo (ainda não
  salvo) também.

### v8.30.321-dev — 2026-08-06
Pedido direto vendo o layout: campo Demandante sai da linha própria
(cheia, isolada) e sobe pra dentro da mesma linha de Responsável/Prazo
— vira o 3º item do grid de 2 colunas, o que naturalmente cai alinhado
ao lado do botão "Sem prazo definido" (a coluna do Prazo é mais alta
por causa do input de data + botão calendário + esse botão). Deixa o
layout mais compacto, sem espaço vazio sobrando embaixo do Responsável.

### v8.30.320-dev — 2026-08-06
Fix de legibilidade no tema claro: os botões da toolbar (❓ Ajuda, ⚡
Funções de card, 🔗 Links, ⛓ Dependências, 📅 Calendários, 📊 Dados do
Board, 📣 Campanhas, 🎬 Controle de Criativos) usam cor de texto
diferenciada pra se destacar no fundo escuro (roxo/teal/rosa claros) —
no tema claro essas mesmas cores pálidas ficavam com contraste ruim
contra o fundo azul claro. Forçados de volta pro texto escuro padrão
só no tema claro. O badge de pendência do Google Calendar fica de fora
(usa laranja como sinalização de estado, não só estética, e já tem
contraste melhor).

### v8.30.319-dev — 2026-08-06
Rodada de 4 pedidos diretos:

- **Tema claro mais escuro**: fundo de página ("lençóis maranhenses")
  estava claro demais — trocado por um azul mais presente (`--deep`,
  gradiente `.ocean`, glass). Os cards (`--surface-rgb`) continuam como
  estavam, mantendo o contraste card-vs-fundo já ajustado antes.
- **Duplicar card: opção de excluir comentários**. O modal de duplicar
  (que já tinha checkboxes pra Descrição, Checklist, Tags etc.) ganhou
  "Comentários" na lista — antes a cópia sempre levava os comentários
  do card original, sem opção.
- **Novo campo "📢 Demandante"** — quem *solicitou* o card, separado do
  Responsável (que executa e pode mudar de mão ao longo do card, ex.:
  designer → redator; o demandante normalmente não muda). Opcional e
  configurável por squad (Configurações → 📐 Padrões de card, novo
  toggle no topo da aba): campo no card (mesma lista de pessoas do
  Responsável, sem agentes de IA), filtro dedicado na toolbar, entra
  nas notificações de card concluído/desbloqueado (junto com
  Responsável e Participantes), e no contexto que o Agente Ágil vê do
  board. Também vira uma seção togglável dentro de cada Padrão de
  card, igual as outras.
- **Aba "Padrões de card" movida** pra logo depois de Subtimes (antes
  ficava por último, depois de Criativos).

### v8.30.318-dev — 2026-08-06
Bugfix reportado direto: trocar de padrão de card "acumulava" seções
escondidas (padrão A esconde Checklist, padrão B esconde Riscos →
trocar de A pra B deixava os dois escondidos) e cards novos vinham com
o último padrão aplicado em vez do padrão da squad. Causa: duas peças
faltando desde a v8.30.314-dev —
1. `_applyCardSectionsVisibility()` só ESCONDIA, nunca reexibia (fazia
   sentido com 1 padrão fixo por squad; quebrou com padrão por card).
2. `openNewCard()` nunca chamava essa função — o modal é o MESMO
   elemento reaproveitado entre cards, então um card novo simplesmente
   herdava o que tivesse ficado escondido do card anterior.
Corrigido nos dois pontos (exceto Campos de criativo, que também
depende do toggle "Ativar Ficha de Criativo" — esse continua só
podendo esconder por cima, nunca forçar reabrir, senão vazaria com o
toggle desligado).

### v8.30.317-dev — 2026-08-06
Move o seletor "📐 Padrão de card" — pedido direto: em vez de ficar
como campo próprio logo abaixo do título, agora fica compacto no
HEADER do modal, ao lado de "Compartilhar este card". Continua
escondido até a squad ter pelo menos 1 padrão criado em Configurações
→ 📐 Padrões de card (é assim que "não aparece" — nada pra escolher
ainda; não é bug).

### v8.30.316-dev — 2026-08-06
Terceira e (esperamos) última parte do "usar modelo": a causa real do
"clica e nada acontece" era mais básica que os dois bugs visuais já
corrigidos — `aplicarModeloNoCard()` (botão "📥 Usar modelo" dentro do
card) exigia `editingId`, mas um card **novo** só ganha `editingId`
depois do 1º "Salvar" manual (`scheduleAutoSave()` nem roda antes
disso). Ou seja: criar um card novo e usar o modelo **antes** de
salvar saía da função sem fazer nada — nem toast. Agora funciona nos
dois casos: com o card já salvo (como antes) ou ainda novo (aplica só
no formulário em memória; salva quando a pessoa clicar em Salvar).

### v8.30.315-dev — 2026-08-06
Segunda parte do fix de "usar modelo" — o feedback "clica e nada
acontece" apontava pro botão **"+ Usar"** dentro do drawer ⚡ Funções de
card → 📋 Modelos (cria um card NOVO a partir do modelo), não só o
"📥 Usar modelo" de dentro de um card já aberto (corrigido na
v8.30.314-dev). Mesma causa raiz: `usarQLItem()` preenchia a Descrição
por baixo dos panos (`#m-desc.value`) mas nunca redesenhava o card
visível (`#m-desc-display`) — o modelo salvava certo, só continuava
aparecendo como "Adicionar descrição..." vazio. Corrigido com o mesmo
`eocInitDisplay()`.

### v8.30.314-dev — 2026-08-06
Dois ajustes, seguindo direto o feedback da v8.30.313-dev:

- **"Padrões de card" agora suporta vários padrões nomeados** (antes era um único toggle global por squad). Organizador/PO cria quantos padrões quiser em Configurações → 📐 Padrões de card (ex.: "Bug" sem Insights do PO, "Campanha" com tudo), marca um como ★ padrão da squad, e cada CARD ganha um seletor "📐 Padrão de card" (logo abaixo do título) pra escolher outro padrão específico pra ele — sem precisar reabrir a squad inteira. Sem nenhum padrão criado, o modal continua mostrando tudo, igual sempre foi.
- **Bugfix: "Usar modelo" não preenchia o card.** Causa raiz: `aplicarModeloNoCard()` atualizava o valor da Descrição por baixo dos panos, mas chamava a função errada pra redesenhar a tela (`renderDescPreview()`, que só existe pra mostrar @menções — não o card visível da Descrição). O valor salvava certo, só não aparecia. Corrigido pra usar o mesmo redraw que o resto do app usa (`eocInitDisplay`). *(Nota: Descrição/Insights do PO só são preenchidos pelo modelo se estiverem vazios no card — isso é por design, pra nunca sobrescrever o que alguém já escreveu; checklist/riscos/tags do modelo sempre são adicionados, independente de já ter conteúdo.)*

### v8.30.313-dev — 2026-08-06
Quatro pedidos diretos neste lote:

- **Vincular nota ↔ card no sentido contrário**: antes só dava pra vincular de dentro da nota; agora o card também tem "+ Vincular nota" em 🔗 Vínculos & anexos, com busca por título (suas notas + as da squad) e chip com ✕ pra desvincular dali mesmo.
- **Descrição x Insights do PO rebalanceados**: feedback direto — "Insights do PO" (campo opcional do PO) chamava mais atenção visual que a Descrição (campo principal do card). A caixa colorida do PO virou neutra e ganhou "(opcional)" no rótulo; a Descrição ganhou um destaque sutil (fundo/borda um pouco mais fortes) condizente com ser o campo principal.
- **"Padrões de card" (nova aba em Configurações)**: organizador/PO agora escolhe quais seções opcionais do modal do card ficam visíveis pra squad inteira — Insights do PO, Descrições adicionais, Participantes, Checklist, Riscos, Campos de criativo, Milanote, Anexos, Notas vinculadas e Comentários. Campos estruturais (título, tag, coluna, responsável, prazo, descrição) não entram — sempre visíveis. Config squad-wide, aplica pra todo mundo.
- **Notificação de prazo revista**: pedido direto — trocado o aviso "amanhã" (véspera) por um só no dia do prazo + um no dia seguinte (1º dia atrasado), sem repetir todo dia enquanto seguir atrasado.

### v8.30.312-dev — 2026-08-06
Listas de usuários em ordem alfabética (antes seguiam a ordem crua do
Firebase, basicamente aleatória). Corrigido no ponto único de origem
(`members`, ordenado ao carregar) — cascateia sozinho pra praticamente
todo select/filtro que lê dali: responsável (card, calendário,
arquivados), participantes (adicionar), filtro de responsável na
toolbar do board, e o import do Trello (lado "responsável no board").
Também ordenados separadamente: agentes de IA (@menção/seletor),
"Todos responsáveis" dos cards arquivados (lista derivada, não vem de
`members` direto) e a lista de usuários em Config → Usuários.

### v8.30.311-dev — 2026-08-06
Busca dentro de Notas: campo "🔍 Buscar em título e conteúdo..." acima
da lista (dentro do escopo selecionado — pessoal ou squad). Não olha só
o título — varre o texto de todos os blocos de cada nota (funciona
igual em modo livre e estruturado). Resultado só por conteúdo mostra um
trechinho de contexto ao redor do termo encontrado, com o termo
destacado (igual título, quando o match é lá); sem digitar nada, a
lista continua exatamente como era antes.

### v8.30.310-dev — 2026-08-06
Primeira parte de "vincular notas a cards" (a segunda, menção de
pessoas/cards dentro do texto das notas, fica pra um próximo lote):

- Cada nota (livre ou estruturada) agora pode ser **vinculada a um ou
  mais cards** — campo de busca no topo do editor da nota, resultado
  vira um chip clicável (abre o card) com botão de desvincular. Vínculo
  é armazenado do lado da nota (`nota.cardIds`), sem duplicar nada no
  card.
- O card, em **🔗 Vínculos & anexos**, ganha uma seção **📝 Notas
  vinculadas** mostrando o reflexo — squad e pessoais do usuário atual
  que apontam pra aquele card, clicável pra abrir a nota direto. Se o
  painel de Notas ainda não tiver sido aberto nesta sessão (sem
  listener ligado), mostra um botão "Ver notas vinculadas" em vez de
  puxar os dados sozinho — mesmo princípio de leitura sob demanda já
  usado no resto da feature (só busca quando alguém realmente pede).

### v8.30.309-dev — 2026-08-06
Pedido direto: inverte a ordem — nota nova nasce em **modo livre**
(texto corrido, tipo Notas do computador) em vez de modo estruturado.
Quem quiser organizar em blocos/hierarquia agora ativa isso pelo botão
🧱 da toolbar, em vez do caminho inverso.

### v8.30.308-dev — 2026-08-06
Duas melhorias pedidas depois de testar a aba de Notas:

- **Listener de Notas passa a ser sob demanda de verdade**: a 1ª versão
  montava o listener na primeira vez que a aba era aberta e nunca mais
  soltava, mesmo com o painel fechado — consumia leitura do Firebase o
  resto da sessão à toa. Agora anexa ao abrir e **desanexa ao fechar**
  (mesmo padrão que o Spotify já usa), com um "Carregando notas..." no
  lugar do conteúdo enquanto o 1º snapshot não chega de novo — pequeno
  atraso ao reabrir, aceito de propósito em troca de economizar leitura.
- **Modo livre**: cada nota agora pode alternar entre o outliner de
  blocos (padrão) e um modo texto corrido só, tipo o Notas do
  computador — sem marcador, sem indentação, sem filhos. Botão 🧱/📄 na
  toolbar alterna. Trocar de estruturado pra livre **é destrutivo pra
  hierarquia** (junta tudo num texto só, na ordem em que aparece) — avisa
  antes com confirmação se a nota tiver mais de um bloco; Ctrl+Z desfaz
  logo em seguida se for engano. Trocar de livre pra estruturado nunca
  perde nada (o texto vira o bloco raiz).

### v8.30.307-dev — 2026-08-06
Feedback direto testando a aba de Notas (v8.30.306-dev), três ajustes:

- **Ctrl+Z**: faltava desfazer — Notas não tinha nenhum, diferente do
  resto do app (checklist do card, por exemplo, já tinha). Nova pilha
  de undo por nota (snapshot do mapa de blocos antes de cada operação,
  até 20 passos) — Ctrl+Z num bloco ou o botão ↩ na toolbar restauram o
  estado anterior.
- **"Formatação não tava salvando"**: na verdade salvava — só nunca
  era desenhada. Os blocos mostravam sempre a sintaxe crua
  (`**negrito**`), mesmo depois de aplicar B/I/U pela toolbar, porque
  não existia visualização renderizada nenhuma. Corrigido: bloco fora
  de edição agora mostra o texto renderizado de verdade (mesmo motor
  `renderMd()` de Descrição/Comentário — negrito realmente em negrito,
  link clicável) e só volta a mostrar a sintaxe crua quando você clica
  nele pra editar (mesmo princípio do "clique pra editar" que a
  Descrição do card já usa).
- **Indentar (Tab) e a seta que aparece "na linha de cima"**: não era
  bug — é assim mesmo que outliners tipo Notion/Workflowy funcionam
  (Tab faz o bloco virar filho do irmão imediatamente acima; se esse
  irmão estava recolhido, ele reabre sozinho pra não sumir com o bloco
  que você acabou de indentar — por isso a seta aparece nele, não no
  bloco que você editou). Comentário no código explicando esse
  comportamento pra próxima vez que alguém for mexer ali.

### v8.30.306-dev — 2026-08-06
Feature nova, sugestão do usuário: aba **📝 Notas** (mesmo padrão de
Dados/Lembretes na lateral do board) — bloco de notas pessoal e da
squad, sem anexos/arquivos (pedido explícito, "pra não pesar"), com
checklist e organização hierárquica colapsável estilo RemNote.

- **Duas abas**: "🐠 Minhas notas" (pessoal, só a própria pessoa vê) e
  "👥 Da squad" (compartilhada com todo mundo do board).
- **Outliner de blocos**: cada nota é uma árvore de blocos, não um texto
  corrido — Enter cria um bloco irmão (dividindo o texto no cursor se
  não estiver no fim), Tab/Shift+Tab indenta/recua (vira filho do bloco
  acima / volta a ser irmão do pai), Backspace no início do bloco
  mescla com o anterior (herda os filhos do bloco apagado). Blocos com
  filhos ganham uma seta ▸/▾ pra recolher/expandir a ramificação.
- **Checklist embutido**: botão ☑ na barra de formatação vira o bloco
  focado num item de checklist (☐/☑, clicável, risca o texto quando
  marcado) — não é uma seção separada, qualquer bloco pode virar
  checklist.
- **Formatação**: reaproveita a mesma barra (B/I/U/🔗) e o mesmo motor
  de link (`_fmtText()`) já usados em Descrição/Comentário — mesma
  sintaxe markdown, mesmo parser.
- **Custo controlado**: cada bloco grava só o próprio path no Firebase
  (nunca reescreve a nota inteira a cada tecla — mesmo princípio do
  `fbSaveCard()`), autosave com debounce de 700ms, e o listener só é
  montado na primeira vez que a pessoa abre a aba (nunca no carregamento
  da página — mesmo princípio do lazy-load de arquivados, PR #124).
- Escopo deliberadamente cortado: sem anexos, sem WYSIWYG (os blocos
  mostram a sintaxe markdown crua, igual comentário/descrição sempre
  mostraram antes de renderizar), sem drag-and-drop pra reordenar (só
  teclado por enquanto).

### v8.30.305-dev — 2026-08-05
Terceiro achado testando os links do Vimeo: um link solto (sem
`[texto](url)`) colado numa linha em branco depois de outro parágrafo não
virava clicável — sobrava como texto puro. Causa: o auto-link de URL solta
excluía qualquer ocorrência "logo depois de um `>`", pra não linkar de novo
o texto visível de um `[url](url)` que já tinha acabado de virar `<a>...
</a>` (o texto dele fica logo após o `>` de fechamento da tag aberta). Só
que `\n` já virou `<br>` bem antes desse passo — então QUALQUER link colado
começando uma linha nova (o caso mais comum de todos: link na própria
linha) também ficava logo depois de um `>` (o do `<br>`) e caía nessa
mesma exclusão, por engano. Trocada a heurística "não depois de `>`" por
proteção de verdade: os `<a>`/`<span>` já gerados (menções, `[[CARD]]`,
`[texto](url)`) são extraídos pra um placeholder antes do auto-link rodar,
e devolvidos no lugar depois — sem excluir nada por posição.

Continua **não** dando pra auto-detectar um link solto que tenha espaço
cru no meio (ex.: o link puro do Vimeo, sem colchetes) — isso exigiria
adivinhar onde a URL termina e o texto normal começa, o que quebraria
frases comuns tipo "olha esse link https://x.com e me fala o que acha".
Pra esse caso, o jeito é usar o botão 🔗 (ou colchetes `[texto](url)` na
mão) — aí a URL fica delimitada de propósito, sem ambiguidade.

### v8.30.304-dev — 2026-08-05
Achado ao investigar por que até a URL crua (sem espaço/parêntese, já
percent-encoded do jeito certo) continuava não funcionando: `renderMd()`
escapa `&`/`<`/`>` da Descrição/Comentário inteiros logo no topo da função
(pra virar HTML seguro) — mas os dois handlers que constroem `<a href="...">`
(link nomeado `[texto](url)` e auto-link de URL solta) chamavam `esc()` de
novo em cima do texto que JÁ tinha passado por esse escape. Resultado: um
`&` da URL virava `&amp;` no passo do topo, e a segunda passada trocava o
`&` DENTRO de "&amp;" por `&amp;` de novo, sobrando `&amp;amp;` no HTML —
o navegador só decodifica entidade uma vez, então o href de verdade ficava
com um `&amp;` literal em vez de um `&`. Isso quebra qualquer URL com mais
de um parâmetro na query (o `&amp;` não separa parâmetro nenhum, todo
o resto vira um pedaço só do parâmetro anterior) — inclusive o link
assinado do Vimeo (`...&signature=...`) e o link do CDN direto
(`...&r=...`) que o usuário testou. Removida a segunda chamada de `esc()`
nos dois handlers — confirmado com uma simulação isolada (`node -e`) que o
href resolvido agora bate exatamente com a URL original, byte a byte.

### v8.30.303-dev — 2026-08-05
Regressão da v8.30.302-dev: "colocar esse % deu erro! só funciona com a
URL crua mesmo". A correção anterior trocava espaço/parêntese cru da URL
por `%20`/`%28`/`%29` — mas esse link do Vimeo é assinado (`signature=...`
na query), e o servidor valida a assinatura contra os bytes EXATOS que
foram emitidos; reescrever qualquer caractere (mesmo só espaço/parêntese)
invalida a assinatura e o Vimeo passa a recusar. Confirmado: em Anexos e
links (armazena a URL crua, sem passar por sintaxe de markdown) o mesmo
link já funcionava certinho, embed incluso — só quebrava dentro da
Descrição/Comentários, que passam a URL pelo parser `[texto](url)`.

Correção de verdade: **para de mexer nos caracteres da URL** — em vez
disso, o parser de `[texto](url)` (`renderMd()`, `_mdToExportHtml()`,
`copyFormatted()`) ficou tolerante a espaço cru **e** um nível de
parênteses balanceados dentro da URL, então a mesma URL crua e assinada
funciona também colada direto num comentário/descrição.

### v8.30.302-dev — 2026-08-05
Bug real, visto num link vindo do Vimeo: `.../file.mp4 (1080p).mp4?loc=...`
tem um espaço cru no meio da URL — a sintaxe de link `[texto](url)` do app
exigia que a URL não tivesse espaço (`[^\s)]+`), então o parser truncava
bem ali e sobrava o resto pendurado como texto solto do lado do link
("quebrado"). Duas frentes:

- **Campos de texto (hiperlink)**: nova `_sanitizeLinkUrl()` troca espaço/
  parênteses crus por `%20`/`%28`/`%29` (sem re-encodar tudo, pra não dar
  `%25` duplo em URL que já vem com `%XX` de verdade) — aplicada no botão
  🔗 de inserir link (Descrição/Comentários), no campo de Anexos e no campo
  do Milanote. `renderMd()`/`_mdToExportHtml()` também ficaram mais
  tolerantes (aceitam espaço cru na URL, só exigem não ter `(`/`)` cru) —
  cobre links já digitados à mão sem passar pelo botão.
- **Preview de Vimeo nos Anexos**: novo botão 🎬 por link reconhecido como
  Vimeo — embeda um `<video>` direto pros links de arquivo
  (`player.vimeo.com/progressive_redirect/...`, que É o binário do vídeo,
  não dá pra iframe) ou um `<iframe>` do player pros links normais
  (`vimeo.com/{id}`), mesmo padrão lazy-load do preview do Milanote.

### v8.30.301-dev — 2026-08-05
Reclamação real via WhatsApp: "já aconteceu 2 vezes de alguém esquecer
o card aberto, daí mostra que tá editando pra mim, mas na vdd não tá,
e daí não consigo clicar em nada". O lock de edição (`card_locks/{id}`,
heartbeat a cada 1min, expira sozinho depois de 10min sem heartbeat)
segue existindo — mas até então, enquanto travado, o modal inteiro
ficava com `pointer-events:none`, bloqueando até ações que não mexem
em nada (abrir um anexo, o link do Milanote, expandir/recolher as
seções novas). Agora o modo leitura libera especificamente essas ações
não-destrutivas (`.attach-info`, `.attach-open`, link/preview do
Milanote, cabeçalhos de seção) via `pointer-events:auto` nelas mesmas,
mantendo os campos de edição de fato bloqueados.

### v8.30.300-dev — 2026-08-05
Sugestão trazida pelo usuário (mockup externo): seções do modal de
card meio que expansíveis/recolhíveis, pra facilitar a rolagem em
cards grandes. Escopo fechado como: "📝 Conteúdo" (Descrição,
Descrições adicionais, Insights do PO), "🔗 Vínculos & anexos" (peça no
Milanote, Anexos e links) e "💬 Colaboração" (Comentários e atividade)
ganham cabeçalho clicável com seta, igual ao "📜 Histórico" que já
tinha esse comportamento — mas Histórico foi propositalmente mantido
como está (fixo no fim, sem entrar nesse novo mecanismo). Checklist
**não** virou recolhível — em vez disso ganhou altura máxima fixa
(340px) com rolagem interna própria, pra não esticar o modal quando
tem muito item. Novo botão ⇕ no cabeçalho do modal, do lado do botão
de "ir pra Descrição", expande/recolhe as 3 seções de uma vez.

### v8.30.299-dev — 2026-08-05
Bug real: "campanhas não rolou! os cards foram criados mas as
campanhas não" — não era falha de gravação (o `window._set` direto no
Firebase funcionou normalmente), era o filtro client-side de
`loadCampanhas()`. A exclusão de "campanhas de squad fictício não
aparecem fora dali" era incondicional — escondia até de quem tava
vendo o board da própria squad fictícia (ex.: uma campanha criada com
`squads:['dev']` ficava invisível mesmo dentro do board da squad dev).
Corrigido pra só excluir quando o squad ativo não é um dos squads da
campanha — squad fictícia continua sem ver campanha de OUTRA squad
fictícia, mas volta a ver a própria. Dados já gravados no Firebase
pela seed anterior devem aparecer sozinhos assim que essa versão
carregar, sem precisar rodar o script de novo.

### v8.30.298-dev — 2026-08-05
Mesma reclamação de antes (participantes), agora nos dropdowns/rótulos
de usuário: "talvez não caiba o nome todo, mas coloca pelo menos um
sobrenome". Nova função `_shortName()` (primeiro + último nome, cabe
melhor que o nome completo) aplicada em todo lugar que só mostrava o
primeiro nome pra identificar alguém numa lista: filtro de usuário da
toolbar, filtro de responsável em Cards arquivados, filtro de usuário
do Calendário, dropdown de "atribuir responsável" em massa (barra de
seleção), e o rótulo das raias quando agrupado por responsável.

### v8.30.297-dev — 2026-08-05
Feedback direto (com print bem-humorado): "a página de login tá feita
no modo claro kkk" — no modo claro, o card de login (já usava
`var(--glass)`, então mudava de cor com o tema) aparecia flutuando em
cima de um fundo sempre preto (`.login-ov` tinha um `rgba(1,8,16,X)`
fixo, nunca trocado — era o mesmo padrão dos backdrops de modal que
ficam escuros de propósito, mas ali faz sentido porque tem um board
por trás pra escurecer; a tela de login não tem nada atrás, ela É a
página inteira). Fundo agora acompanha o tema também (nova variável
`--deep-rgb`) — tela de login fica coerente nos dois temas.

### v8.30.296-dev — 2026-08-05
Texto do "seu card" no claro, testado lado a lado num protótipo
(atual/preto/branco) antes de decidir. Feedback direto: "o atual eu
acho que tá mais acinzentado, azul escuro eu acho que funcionaria" —
`var(--txt)` (#14324A) é pouco saturado, lê como cinza em cima do
fundo azul de saturação média do "seu card". Trocado por um azul bem
mais escuro e saturado (`#072747`), só nesse card.

### v8.30.295-dev — 2026-08-05
Três ajustes finos, feedback direto:

- **OKR mais dourado no claro**: mesmo problema do `.has-blocker-tag`
  — 40% de opacidade de amarelo puro em cima de um card quase-branco
  dilui e some. Trocado por um dourado escurecido/saturado (dark
  goldenrod), bem mais opaco, só no claro.
- **Vermelho de bloqueio, menos intenso**: a correção anterior
  (v8.30.294-dev) resolveu o "rosinha" mas ficou "vermelhão demais"
  pro resto do layout — tom mais discreto (menos saturado, menos
  opaco), ainda claramente vermelho.
- **"Seu card" mais aceso no escuro**: no claro já tinha ficado bem
  destacado; no escuro continuava discreto perto dos outros cards da
  coluna. Tingimento e borda mais fortes + um glow leve, pra divergir
  de verdade dos cards normais nos dois temas.

### v8.30.294-dev — 2026-08-05
Feedback direto com print: a borda vermelha de card bloqueado
(`.has-blocker-tag`) fica "quase um rosinha" no claro, perde o
destaque. Causa: 40% de opacidade da mesma cor vermelha em cima de um
card quase-branco dilui bastante. Vermelho mais escuro/saturado e bem
mais opaco só no claro.

### v8.30.293-dev — 2026-08-05
Feedback direto com print: os "piscas" amarelos (campo obrigatório e o
pulso de "achar meus cards") somem de vista no claro, e o aviso de
campo obrigatório na base do modal também tava sem contraste.

- **Pulso amarelo → azul escuro no claro**: `.card-pulse-highlight`
  (botão 💡 Meus cards) e `.req-missing` (campo obrigatório) usavam um
  glow amarelo fixo, pensado pro fundo escuro — em cima de um
  card/input já claro, simplesmente sumia. Cor movida pra uma variável
  de tema (`--pulse-rgb`); no claro vira um azul bem escuro, sugestão
  direta.
- **Toast de campo obrigatório sem contraste**: o pill do aviso
  ("🔒 Preencha os campos obrigatórios...") ficava quase branco em
  cima de um modal também quase branco, sem borda visível. Ganhou
  borda mais forte + sombra só no claro.

### v8.30.292-dev — 2026-08-05
Pedido direto: "lembra que a gente colocou submarca e prazo como
obrigatório? coloca também o título como obrigatório". Antes, salvar
com título vazio simplesmente não fazia nada — clique em "Salvar" sem
feedback nenhum, sem explicação. Título agora entra na mesma checagem
global de campos obrigatórios que Prazo/Submarca já tinham: destaca o
campo e mostra o toast "🔒 Preencha os campos obrigatórios: Título".
Vale tanto pra criar quanto pra editar um card — mesmo escopo de
antes (não cobre o fluxo de editar item recorrente/modelo, que
continua com a checagem silenciosa que sempre teve).

### v8.30.291-dev — 2026-08-05
Bug real encontrado ao confirmar com o usuário se a ordenação 🖐 Manual
(v8.30.290-dev) funcionava com filtro ativo (ex.: submarca): soltar um
card no FINAL da lista usava o final da COLUNA INTEIRA, não o final da
lista filtrada visível — com um filtro ativo, o card podia pular por
cima de outros cards escondidos pelo filtro, fora do que a pessoa via
na hora de arrastar. Corrigido: o caso "soltar no final" agora ancora
no último card VISÍVEL (lido do DOM, que só tem os cards que passam no
filtro atual) e insere logo depois dele. Sem filtro nenhum, dá
exatamente no mesmo lugar de antes (final da coluna) — a mudança só
importa com algum filtro ativo.

### v8.30.290-dev — 2026-08-05
Três pedidos diretos:

- **Ordenação por prazo invertida**: o botão ↕ Ordenação só tinha
  "mais antigos primeiro" (prazo mais próximo/urgente primeiro). Nova
  opção 📅 **Prazo (mais novos primeiro)** — mesma lógica invertida
  (prazos mais distantes primeiro; sem prazo continua indo pro final
  nos dois sentidos). Disponível no menu geral e no override por
  coluna (⚙ da coluna).
- **Participantes com nome completo**: a lista "+ Adicionar
  participante..." e os chips de participantes já adicionados
  mostravam só o primeiro nome — times com vários "João"/"Ana"
  diferentes não davam pra distinguir. Agora mostra o nome completo.
- **Ordenação 100% livre (🖐 Manual)**: nova opção no menu ↕
  Ordenação — arraste os cards pra qualquer posição dentro da coluna,
  do jeito que quiser. Antes, arrastar um card dentro da MESMA coluna
  não fazia nada (só funcionava entre colunas) — agora, só nesse modo,
  o drop recalcula a posição de todos os cards da coluna a partir de
  onde a linha-fantasma indicou. A ordem fica salva no próprio card
  (não só no navegador de quem arrastou), então todo mundo com esse
  modo ativo vê a mesma posição. Diferente da já existente "Posição
  dentro da prioridade" (que só reordena o desempate DENTRO de uma
  mesma prioridade) — o modo Manual reordena a coluna inteira, sem
  regra nenhuma por trás.

### v8.30.289-dev — 2026-08-05
Pedido direto: "o filtro de submarca sempre abre em Todos, eles tem
que ficar refazendo o filtro". Squad site (5 marcas, 10 submarcas) —
o filtro rápido 🏷️ Submarcas da toolbar agora lembra a última seleção,
salva por navegador e por squad (mesmo espírito de `col_sort_`/
`hybrid_view_` — preferência pessoal, não sincroniza entre pessoas).

- Restaurado automaticamente ao abrir o board — não precisa de um passo
  extra de "salvar como padrão", a última seleção já vira o próximo
  padrão.
- "Limpar filtros" também limpa o padrão salvo (senão o filtro
  "voltaria sozinho" no próximo load, contra a intenção de quem limpou).

### v8.30.288-dev — 2026-08-05
Renomeia os temas — de "🌙 Mar Profundo" / "☀️ Mar Cristalino" (genérico
demais) pra dois nomes de paisagens brasileiras, sugestão direta:

- **🌙 Abrolhos** (escuro) — maior banco de corais do Atlântico Sul,
  mar azul profundo, identidade forte.
- **☀️ Lençóis Maranhenses** (claro) — associação imediata com água
  cristalina.

Atualizado em todo lugar que citava os nomes antigos: `title` do botão
de toggle, toast ao alternar, e comentários no CSS/JS.

### v8.30.287-dev — 2026-08-05
Feedback direto: "faltou criar o selo no modo escuro tb" — o selinho
"👤 seu card" (v8.30.286-dev) só tinha sido criado pro claro. Movido
pra regra base `.card.card-mine::before` (vale pros dois temas por
padrão); o `[data-theme="light"] .card.card-mine::before` continua só
sobrescrevendo a cor pro claro.

### v8.30.286-dev — 2026-08-05
Destaque do "seu card" no claro, feedback direto: "o card atribuido a
pessoa ainda n ta c tanto destaque". Passou por um protótipo com 4
opções (cor do card normal do escuro / tingimento bem mais forte /
faixa+selo / mistura de tingimento+selo) — escolhida a mistura:

- `.card.card-mine` no claro: tingimento e borda bem mais fortes que o
  original (quase invisível em cima de um card quase-branco).
- Selinho "👤 seu card" saindo por cima do card — não depende só de
  cor pra chamar atenção.

### v8.30.285-dev — 2026-08-05
Mais badges sem leitura no claro, achados fora do `.card-tag` (que já
tinha sido corrigido): "status dos agentes, prazo e o badge de risco
ainda sem leitura" + "calendário n da pra ler nada".

- `.exec-chip` (status do executor/agente), `.due-badge` (prazo do
  card) e o badge de risco (⚠, sem classe própria até agora — ganhou
  `.risco-badge`) usam a mesma paleta clara pensada pro escuro que os
  tags tinham — não passam por `tagHtml()`, por isso ficaram de fora do
  fix anterior. Mesmo filter aplicado.
- **Pílulas de "Prazo" no Calendário**: usavam `color:#fff` fixo em
  cima de um fundo com só 15% de opacidade da cor da coluna — só
  funcionava por acidente no escuro (mesmo tint sobre fundo quase-preto
  ainda contrasta com branco). Texto trocado pra usar a própria cor da
  coluna (mesmo padrão "fundo pálido + texto saturado" que as tags já
  usam) + filter no claro. Pílulas de Evento (fundo opaco, cor
  pré-escolhida) não foram afetadas.

### v8.30.284-dev — 2026-08-05
2ª rodada de contraste nas tags do claro (v8.30.283-dev). Testado lado
a lado num protótipo comparando escuro / filtro atual / cor do escuro
sem filtro — as tags mais claras da paleta (`Feature` `#ffd166`, `OKR`
`#ffd700`) ainda ficavam fracas com `brightness(.68)`. Feedback direto
confirmando: "tem que escurecer mais esses aqui, dar mais contraste".

- `filter` do `.card-tag` no claro: `brightness(.68) saturate(1.35)` →
  `brightness(.5) saturate(1.4)`.

### v8.30.283-dev — 2026-08-05
Feedback direto com print: "as tags eu acho q tao mt claras no claro,
n ta dando leitura".

- As cores de fundo/borda/texto das tags do card vêm todas de estilo
  inline gerado por JS (mais de 10 variantes — OKR, cal_gestao,
  tamanho, submarca, cor customizada por usuário...), pensadas pro
  fundo escuro (texto num tom claro/saturado, baixo contraste em cima
  de um card branco). Em vez de reescrever cada variante, um `filter`
  (`brightness`+`saturate`) escurece o pill inteiro — fundo, borda e
  texto — de uma vez só no modo claro, cobrindo até cores customizadas
  escolhidas por cada pessoa.

### v8.30.282-dev — 2026-08-05
Mais um round de feedback direto na distinção de cards (v8.30.281-dev):
"tem que ser um tom mais escuro ainda, pra diferenciar bem" no claro, e
"no escuro dá pra clarear mais também".

- **Claro**: sombra e borda do card escurecidas de novo (tom mais forte
  e saturado, `rgba(0,50,80,X)`/`rgba(0,120,175,X)` em vez do tom mais
  claro da rodada anterior).
- **Escuro**: card ganhou um pouco mais de contraste — leve
  clareamento (5% branco sobre a superfície) e borda um pouco mais
  visível.
- `.card-mine` (destaque de "meu card") acompanhou o ajuste nos dois
  temas.

### v8.30.281-dev — 2026-08-05
Feedback direto com prints comparando os dois temas: no modo claro os
cards perdiam a distinção que tinham no escuro (não dava pra ver onde
um card terminava e a coluna/o próximo card começava).

- **Sombra sutil nos cards** só no modo claro — no escuro a distinção
  vinha de contraste/brilho de borda, truque que não funciona quando os
  dois lados (card e coluna) são claros. Borda também ficou um pouco
  mais firme.
- **`.card-mine`** (destaque de "meu card") também ganhou ajuste — o
  tingimento azul de 8% que já existia ficava quase invisível em cima
  de um card quase-branco; subiu a opacidade e a borda só no claro.

### v8.30.280-dev — 2026-08-05
Correções de leitura no modo claro (v8.30.279-dev), feedback direto com
3 pontos:

- **Avatares de iniciais** (comentários, Estrelas do Mar, Spotify,
  Equipe do quadro, @menções, seletor de responsável...) — texto azul
  em cima de fundo azul claro/translúcido ficava com contraste baixo.
  Trocado por um círculo azul sólido (`rgba(37,99,201,.85)`) + texto
  branco em TODOS os avatares de iniciais do arquivo (mais de 10 pontos
  diferentes usavam o mesmo padrão) — não afeta avatares com foto
  (`<img>`), só o fallback de iniciais.
- **Anexos/Links e Comentários dentro do card, e os painéis
  Lembretes/Estrelas do Mar/Spotify/Central de Dados** ficavam com um
  fundo azul-marinho escuro chapado no meio do modo claro. Causa: a
  varredura de regex da v8.30.276-dev que trocou os literais
  `rgba(6,26,46,X)`/`rgba(3,13,26,X)`/`rgba(10,37,64,X)` por
  `var(--surface-rgb)`/`var(--surface2-rgb)`/`var(--glass-rgb)` não
  pegou uma dúzia de cores "quase iguais mas não exatamente" espalhadas
  pelo arquivo (`rgba(6,20,44,X)`, `rgba(6,18,36,X)`, `rgba(6,22,42,X)`,
  `rgba(10,30,55,X)` etc.) usadas em `.comment-text`, `.attach-item`,
  `.lem-drawer`, `.dnd-menu`, `.camp-panel` e outros ~15 seletores.
  Todas migradas pras mesmas variáveis de tema — scrims/backdrops de
  modal (`.ov`, `.cal-ov`, `.ui-modal-ov` etc.) foram deixados de
  propósito escuros nos dois temas (dimming de fundo, não é conteúdo
  legível).

### v8.30.279-dev — 2026-08-05
Ajuste fino no ☀️ Mar Cristalino (v8.30.278-dev), depois de feedback bem
positivo ("ficou muito melhor do que eu imaginava... água cristalina, dá
vontade de usar") com 3 pontos pontuais:

- **Glow das bordas reduzido ~40%** — os radiais do `.ocean` estavam
  fortes demais ("parece um glow vindo de trás da tela"); opacidade
  baixada de `.28`/`.24` pra `.17`/`.14`.
- **Cards com 1-2% de azul** (`--surface-rgb: #FCFEFF` em vez de branco
  puro `#FFFFFF`) — imperceptível conscientemente, mas reforça a
  sensação de que tudo faz parte da água.
- **Header/toolbar/dropdowns um tom mais vivo** (`--glass-rgb: #C6EDFF`
  em vez de `#DDF7FF`) — se diferencia melhor do fundo, que antes
  estava quase da mesma cor.

### v8.30.278-dev — 2026-08-05
Revisão de identidade do modo claro (v8.30.277-dev): feedback direto —
"ainda tá mt claro", seguido de uma sugestão de paleta completa e
nomeada. Os dois temas agora são tratados como "horários do mar" em
vez de um dark/light genérico:

- **🌙 Mar Profundo** (escuro, o de sempre) e **☀️ Mar Cristalino**
  (claro, paleta Caribe/Maldivas) — nome refletido no `title` do botão
  de toggle e num toast ao alternar.
- Paleta do claro reformulada: fundo levemente azulado (`#F2FCFF`/
  `#DDF7FF`), nunca branco puro, com **cards brancos** por cima pra dar
  contraste sem precisar escurecer o fundo. Azul principal saturado
  (`#00A9E6`) + turquesa (`#33D6D0`) puxam a identidade "água" mesmo
  com um fundo claro.
- O degradê do oceano (`.ocean`) ganha sua própria versão em água
  cristalina no claro (não fica escondido).
- **Peixinhos/bolhas voltam a aparecer no modo claro** (antes ficavam
  desligados) — como as cores das SVGs foram pensadas pro fundo escuro,
  ganham um `filter` (saturate/brightness/contrast) só no claro pra
  manter contraste.

### v8.30.277-dev — 2026-08-05
Ajuste de acabamento do modo claro (v8.30.276-dev): feedback direto —
"ficou branco demais", pediu um azul claro tipo "mar do Caribe,
Maldivas".

- Paleta trocada de cinza/branco pra azul-turquesa claro (`--deep`,
  `--surface-rgb`, `--surface2-rgb`, `--glass-b`, `--accent`/`--cyan`/
  `--teal`, `--txt` todos ajustados pro tom).
- O fundo "oceano" (degradê de base) **não fica mais escondido** no
  modo claro como na 1ª versão — ganha um degradê próprio em tons de
  água tropical rasa (turquesa/ciano sobre uma base clara), preservando
  a identidade "mar" do app em vez de só apagá-la.
- Peixinhos/bolhas continuam desligados no claro por enquanto — as
  cores das SVGs deles foram desenhadas pro fundo escuro; ajustar isso
  fica pra uma próxima passada se fizer sentido.

### v8.30.276-dev — 2026-08-05
Pedido direto: modo claro, além do escuro atual (que continua sendo o
padrão).

- **Botão 🌙/☀️ no canto superior direito** (primeiro item do cluster
  de botões do header) — alterna entre os dois temas. Preferência
  pessoal, salva só neste navegador (não sincroniza entre pessoas nem
  dispositivos), aplicada bem cedo (script pequeno logo após o
  `</style>` no `<head>`, direto no `localStorage`) pra não dar o
  "flash" de escuro→claro antes do resto do JS carregar.
- **Sistema de variáveis CSS**: a maioria das cores já usava
  `var(--txt)`/`var(--glass)`/etc. — essas simplesmente trocam de
  valor com `:root[data-theme="light"]`. As que usavam `rgba(...)` cru
  com a mesma cor-base repetida em opacidades diferentes
  (`rgba(6,26,46,X)` pra modais/dropdowns/cards, `rgba(3,13,26,X)` pra
  inputs/sub-painéis "afundados", `rgba(10,37,64,X)` pro glass) foram
  trocadas, em TODO o arquivo (CSS estático e HTML gerado por JS —
  `var()` funciona igual em `style="..."` inline), por
  `rgba(var(--surface-rgb),X)` / `rgba(var(--surface2-rgb),X)` /
  `rgba(var(--glass-rgb),X)` — preserva a opacidade exata de cada
  regra, só troca a cor base num lugar só.
- Fundo "mar profundo" (gradiente + bolhas + peixinhos) some por
  completo no modo claro (não faz sentido visual nesse tema) —
  independente da preferência pessoal de peixinhos ligados/desligados.
- Cores de tags/prioridade/status de agente (translúcidas, com texto
  saturado próprio) ficaram de fora de propósito — já são legíveis nos
  dois temas sem alteração.

Escopo: cobre as superfícies principais (board, cards, colunas,
modais, dropdowns, inputs, toolbar, header). Pode ter algum canto
específico que ainda não ficou 100% refinado no modo claro — reportar
se achar algo estranho.

### v8.30.275-dev — 2026-08-05
Hotfix de acabamento do fix anterior (v8.30.274-dev): combinar
Executor+Status num chip só não bastou — o print mostrou que ainda
ficava tudo grudado. Causa raiz real: `margin-bottom` não tem efeito
NENHUM em `<span>` comum (`display:inline`) — só a tag (`.card-tag`,
que já tinha `display:inline-block` no CSS) respirava de verdade da
linha de baixo; os badges de prioridade, risco, OKR, impedimento e o
chip de executor eram `<span>` puro, então o `margin-bottom` que eu
tinha acabado de adicionar no chip de executor era ignorado
silenciosamente pelo navegador.

- Todos os badges do topo do card agora têm `display:inline-block` +
  `margin-bottom:4px` (mesmo valor da tag), garantindo espaço de
  verdade entre linhas quando eles quebram — e antes do título.

### v8.30.274-dev — 2026-08-05
Achado a partir de um print (cards fictícios de teste do Agente Ágil):
com uma tag longa + prioridade + chip de Executor + chip de Status do
agente, o topo do card ficava visualmente apertado, quase colando no
título.

- `makeCardEl()`: chip de **Executor** (🤖 Agente / 🤝 Híbrido) e chip
  de **Status do agente** (⏳ Na fila, ⚙️ Em execução, 👀 Aguardando
  validação, ✅ Concluído, ⚠️ Erro) agora aparecem **combinados num só
  chip** (ex.: "🤖 Agente · ⏳ Na fila") em vez de duas pills separadas
  — reduz a quantidade de elementos empilhados no topo do card. Sem
  status ainda definido, mostra só o chip de executor, como antes.

### v8.30.273-dev — 2026-08-04
Pedido direto: tela de "📦 Cards arquivados" tinha "☑ Todos"/"☐ Nenhum"
+ "🗑 Excluir selecionados", mas nenhum jeito de restaurar em lote —
só um por um.

- Novo botão **↩ Restaurar selecionados** — restaura de volta pro board
  todos os cards marcados nos checkboxes. Usa `fbSaveAll` com os ids
  restaurados como `touchedIds` (mesmo padrão de `bulkArchive`).

### v8.30.272-dev — 2026-08-04
Pedido direto: pessoas relatando dificuldade de leitura no board.

- Novo botão **🔍 Fonte** na toolbar (logo depois de ↕ Ordenação) — menu
  suspenso com 4 tamanhos: Pequena, Padrão, Grande, Muito grande. Aplica
  `zoom` só no `#board` (colunas/cards — não no header/toolbar).
  `zoom` em vez de `transform:scale()`: escala fonte + padding + cards
  proporcionalmente, igual um zoom de navegador de verdade, mas sem
  desalinhar coordenadas de mouse/drag-and-drop (`transform:scale()` tem
  esse problema conhecido).
- Preferência pessoal, salva só neste navegador (`localStorage`, mesmo
  padrão de `colSortMode`/`fish_bg_off`) — não sincroniza entre pessoas
  nem dispositivos.
- Documentado na Central de Ajuda (aba Board).

Só em dev por enquanto — segue o processo normal de release (aguardando
validação antes de promover pra prod).

### v8.30.271-dev — 2026-08-04
Mesma revisão de código da entrada `kanban.html v8.30.212` acima —
`delColumn()`/`saveAgilCfg()` agora persistem os cards reatribuídos ao
excluir uma coluna (antes só reatribuía localmente, e o card sumia do
board em qualquer reload). Auditoria dos demais caminhos de exclusão e
dos filtros/raia sem novos problemas encontrados. Aplicado nos dois
arquivos ao mesmo tempo.

### v8.30.270-dev — 2026-08-04
Mesmo hotfix CRÍTICO da entrada `kanban.html v8.30.211` acima: (1) o fix
de posição da v8.30.209/268-dev tinha um bug próprio — "mover" conteúdo
por posição podia misturar o conteúdo de dois cards diferentes quando
vários deslocavam na mesma escrita; agora sempre busca fresco pelo id.
(2) `doTrelloImport()` agora espera a escrita confirmar antes de
mostrar sucesso/fechar o modal; novo `_pendingFbWrites` + `beforeunload`
avisa se der F5 com alguma escrita ainda em voo. Aplicado nos dois
arquivos ao mesmo tempo.

### v8.30.269-dev — 2026-08-04
Mesmo hotfix CRÍTICO da entrada `kanban.html v8.30.210` acima —
`_reconcileCardsIndexOnce()` rodava num timer fixo de 4s que perdia a
corrida contra o carregamento de squads grandes e chegava a escrever
`null` em `cards_index`/`cards_updated_at` pra cards ainda carregando,
apagando de verdade o índice deles (não só a renderização). Agora só
roda depois que o carregamento realmente termina. Nova ferramenta de
reparo "🔧 Reparar cards 'sumidos'" em Config → Trello → Diagnóstico,
reconstrói o índice do zero a partir de `/cards`. Aplicado nos dois
arquivos ao mesmo tempo.

### v8.30.268-dev — 2026-08-04
Mesmo hotfix crítico GERAL da entrada `kanban.html v8.30.209` acima —
causa raiz real de cards sumindo em QUALQUER aba já aberta quando
alguém faz uma operação estrutural (criar/arquivar/excluir/duplicar/
reordenar card), não só no import do Trello. `_cardsByKey` agora MOVE
o card pra nova posição em vez de apagar e esperar um fetch que não
disparava pra cards não tocados (touchedIds). Aplicado nos dois
arquivos ao mesmo tempo.

### v8.30.267-dev — 2026-08-04
Mesmo hotfix da entrada `kanban.html v8.30.208` acima — nova
`_ensureSubmarcaTagsBackfilled()`, roda 1x por squad/sessão e adiciona
qualquer uma das 10 tags de Submarca (Comercial/Cadastro) que estiver
faltando em `tags` (squads que ativaram o recurso antes do split 5→10
nunca tinham ganho as novas). Aplicado nos dois arquivos ao mesmo tempo.

### v8.30.266-dev — 2026-08-04
Mesmo hotfix crítico da entrada `kanban.html v8.30.207` acima — cards
"sumindo" depois de import grande (bug de renderização em
`_applyCardsSync`, corrigido populando `window._cardsByKey` direto no
`fbSaveAll`) + match de tag de Submarca no import Trello errando o time
(novo seletor "Time deste import" + override por card via label solta
"COMERCIAL"/"CADASTRO"). Aplicado nos dois arquivos ao mesmo tempo —
usuário no meio de um import real de 4 boards (3077 cards).

### v8.30.265-dev — 2026-08-04
Mesmo hotfix da entrada `kanban.html v8.30.206` acima — `zerarBoard()`
("🗑 Excluir todos os cards") agora zera `cards_index` /
`cards_updated_at` / `cards_archived` junto com `/cards`, não só
`/cards`. Aplicado nos dois arquivos ao mesmo tempo (usuário bloqueado
num import do Trello em andamento).

### v8.30.264-dev — 2026-08-04
Mesmo pause de Spotify da entrada `kanban.html v8.30.205` acima —
aplicado nos dois arquivos ao mesmo tempo (pedido direto, urgência de
custo), sem esperar o ciclo normal de validação em dev. Botão
"🎧 Spotify" escondido (`#spotify-tab`); `functions/spotify/sync.js`
(`spotifySync`) comentado em `functions/index.js`.

### v8.30.263-dev — 2026-08-04
Pedido direto: visual do menu 🏷️ Submarcas melhorado, mais dentro do
estilo do resto do app.

- **Agrupado por marca.** Em vez de repetir "Hering X" nas 10 linhas
  (Hering Adulto Comercial, Hering Adulto Cadastro, Hering Kids
  Comercial...), agora mostra o nome da marca como cabeçalho (destaque
  em ciano) com só "Comercial"/"Cadastro" embaixo, indentado — reduz
  bastante a repetição visual e fica mais rápido de escanear.
- **Linhas com hover** (mesmo padrão do seletor de squad —
  `.squad-switcher-item`), cantos arredondados, checkbox um pouco maior.
- **"Todos" destacado** com fundo sutil (verde-água), separado do
  resto por uma linha divisória, e um título "🏷️ Filtrar por submarca"
  no topo do painel.

Puramente visual — nenhuma mudança na lógica de seleção múltipla
(`activeFilters.submarca`) nem no mecanismo de abertura/posicionamento
(`position:fixed`, corrigido em v8.30.260-dev).

Validado por leitura de código + checagem de sintaxe (`node --check`)
— este arquivo não tem suíte automatizada (ver `CLAUDE.md`); validação
manual no navegador ainda pendente antes de promover pra prod.

### v8.30.262-dev — 2026-08-04
**Hotfix**: v8.30.261-dev quebrou o board inteiro (tela em branco, só
o fundo animado aparecia) — reportado ao vivo com o erro `Uncaught
ReferenceError: Cannot access '_fishBgOn' before initialization`.

Causa: a IIFE "Fish & Bubbles" chamava `_applyFishBgVisibility()`
(que lê `_fishBgOn`) antes da linha `let _fishBgOn = ...` — que vinha
DEPOIS da IIFE no arquivo. `let`/`const` ficam em "temporal dead zone"
até a própria linha de declaração rodar (diferente de `function`, que
é hoisted por completo); chamar algo que depende de um `let` ainda não
inicializado estoura `ReferenceError` sem capturar, o que interrompe
todo o resto daquele `<script>` — inclusive o carregamento do board.

Corrigido só reordenando: `let _fishBgOn` e as duas funções
(`_applyFishBgVisibility`/`toggleFishBackground`) agora vêm ANTES da
IIFE que as usa. Nenhuma mudança de comportamento.

Validado por leitura de código + checagem de sintaxe (`node --check`)
— este arquivo não tem suíte automatizada (ver `CLAUDE.md`); validação
manual no navegador (confirmar que o board volta a carregar) ainda
pendente antes de promover pra prod — o que não é urgente aqui, já
que v8.30.261-dev nunca chegou a ser promovido.

### v8.30.261-dev — 2026-08-04
Duas entregas pedidas direto:

- **Import do Trello vincula direto na tag de Submarca.** Quando uma
  label do Trello tem o MESMO nome de uma das 10 opções de Submarca
  (ex.: "Hering Adulto Comercial"), o import agora casa ela direto na
  tag fixa (`tag_sm_adulto_com`) em vez de criar uma tag genérica nova
  — o card já nasce plugado no campo dedicado e no filtro de Submarca,
  sem precisar remapear manualmente depois. Match exato (case-
  insensitive), checado antes do fuzzy-match genérico existente, pra
  não arriscar "Hering Adulto" (sem time) casando por engano com
  "Hering Adulto Comercial".
- **Peixinhos do fundo viram preferência pessoal.** Clicar no 🐟 do
  título "Maré Digital" liga/desliga os peixinhos e bolhas animados —
  sem adicionar nenhum botão novo na tela, o próprio emoji já
  existente virou o toggle. Salvo por navegador (`localStorage`, mesmo
  padrão de outras preferências puramente visuais como ordenação de
  coluna) — não sincroniza entre dispositivos, não é dado de squad.
  Default continua ligado (comportamento de sempre); só quem desligar
  deixa de ver.

Validado por leitura de código + checagem de sintaxe (`node --check`)
— este arquivo não tem suíte automatizada (ver `CLAUDE.md`); validação
manual no navegador ainda pendente antes de promover pra prod.

### v8.30.260-dev — 2026-08-04
Corrige dois problemas reportados ao vivo no menu 🏷️ Submarcas
(v8.30.259-dev, ainda não tinha ido pra prod):

- **Não abria.** O painel usava `position:absolute` dentro de
  `#submarca-quickfilters`, que tinha `overflow-x:auto` — o overflow
  cortava o painel inteiro (altura efetiva zero), então clicar no
  botão parecia não fazer nada. Trocado pro mesmo padrão já usado
  pelo menu de Ordenação (↕) nesta mesma toolbar: `position:fixed`
  calculado via `getBoundingClientRect()` do botão, que não sofre
  corte por overflow de nenhum ancestral.
- **Local errado.** Pedido direto: o menu sai do header (onde tinha
  ido em v8.30.259-dev) e volta pra toolbar, logo depois do botão
  Filtros — mesma linha de Raia, Ordenação, Selecionar etc.

Sem mudança de comportamento além da posição/mecanismo de abertura —
a lógica de seleção múltipla e o estado (`activeFilters.submarca`)
continuam os mesmos.

Validado por leitura de código + checagem de sintaxe (`node --check`)
— este arquivo não tem suíte automatizada (ver `CLAUDE.md`); validação
manual no navegador ainda pendente antes de promover pra prod.

### v8.30.259-dev — 2026-08-04
Pedido direto: no squad Site Hering, cada marca tem dois times atuando
(Comercial e Cadastro) — as 5 tags de Submarca viraram 10 (cada marca
dividida em Comercial/Cadastro: Adulto, Kids, Sports, Intimates, Teen).
Cards já marcados com os 5 ids antigos (`tag_sm_adulto`, `tag_sm_kids`,
`tag_sm_sports`, `tag_sm_intimates`, `tag_sm_teens`) ficam órfãos —
precisam reatribuir manualmente se algum já tiver sido usado de
verdade (a feature só foi pra prod ontem, então é pouco provável).

Com 10 opções + "Todos", a fileira de botões no header não cabia mais
de jeito nenhum (já quase quebrou com só 6 — ver hotfix v8.30.203).
Trocado por um menu suspenso "🏷️ Submarcas ▾" (mesmo padrão visual/JS
do seletor de squad): abre um checkbox por opção visível + "Todos",
multi-seleção, mostra quantas estão marcadas no próprio botão (ex.:
"🏷️ Submarcas (2) ▾"). Fecha ao clicar fora ou Esc.

Também pedido direto: `⏱ Relatórios de Tempo` saiu da toolbar (que
estava lotada) e agora é acessado de dentro de `📊 Dados do Board`
(botão no topo do painel, fecha um modal e abre o outro).

Validado por leitura de código + checagem de sintaxe (`node --check`)
— este arquivo não tem suíte automatizada (ver `CLAUDE.md`); validação
manual no navegador (abrir squad `site`, testar o menu de Submarcas e
o novo caminho do Relatório de Tempo) ainda pendente antes de
promover pra prod.

### v8.30.258-dev — 2026-08-04
**Hotfix**: a CSS do PR #147 (filtros rápidos de submarca não quebrarem
linha) quebrou o header inteiro em produção — reportado ao vivo pelo
usuário ("quebrou foi tudo no layout agora"). A combinação
`flex-grow:1;flex-shrink:0;flex-basis:auto` em `#submarca-quickfilters`
fazia a distribuição de espaço do `.hd` colapsar: tudo (filtros +
avatares + botões) empilhava no canto direito, com um vão vazio enorme
entre o nome da squad e os filtros, em vez dos filtros ficarem
centralizados como antes.

Revertido pra `flex:1` (o que já funcionava pra centralizar/crescer),
mantendo só as duas mudanças que realmente eram necessárias:
`flex-wrap:nowrap` (pílulas não quebram linha) e `overflow-x:auto`
(rede de segurança se não couber tudo mesmo depois de crescer).

Promovido direto pra prod também (ver entrada `kanban.html`), sem
esperar validação — bug visível afetando todo mundo com o board
aberto agora.

### v8.30.257-dev — 2026-08-04
Atualiza a Central de Ajuda (❓), que estava defasada em relação às
últimas entregas — sem nenhuma dessas cinco coisas documentadas:

- **Badge de impedimento no card** — o 🚧 ao lado do 🎯 de OKR e as
  bordas mais grossas (dica nova em "cards").
- **Trava de edição concorrente** — banner + modo leitura quando outra
  pessoa já está editando o mesmo card (dica nova em "cards").
- **Prazo e Submarca obrigatórios** — inclui o botão "Sem prazo
  definido" como escape hatch (dica nova em "cards").
- **Submarca (marca do produto)** — toggle por squad, visibilidade por
  marca, filtros rápidos no header, multi-seleção (dica nova em
  "config", no mesmo espírito da dica já existente de "Tamanho").
- **Importar do Trello** — dica atualizada com as duas entregas mais
  recentes: aplicar uma tag a todos os cards do import, e a tag
  automática "👤 Nome" pra membro sem match no board.

Só conteúdo de ajuda (`HELP_CONTENT`), nenhuma mudança de
comportamento. Validado por leitura de código + checagem de sintaxe
(`node --check`) — este arquivo não tem suíte automatizada (ver
`CLAUDE.md`); validação manual no navegador ainda pendente antes de
promover pra prod.

### v8.30.256-dev — 2026-08-04
Pedido direto: dois campos passam a ser obrigatórios ao salvar um card
(criação E edição, em qualquer squad).

- **Submarca obrigatória** (só quando o squad usa Submarca —
  `submarcaAtivo`): não dá mais pra salvar um card sem escolher qual
  submarca é. Reaproveita o mesmo mecanismo de destaque/aviso que já
  existia pros campos obrigatórios de modelo (`.req-missing`, toast).
- **Prazo obrigatório em todo squad**, com escape hatch: se a pessoa
  ainda não sabe o prazo, um botão novo embaixo do campo Prazo —
  "🚫 Sem prazo definido" — satisfaz a exigência sem precisar chutar
  uma data. Mutuamente exclusivo com escolher uma data de verdade
  (marcar uma limpa o outro). Persiste como `card.noDue`.

Essas duas regras rodam em cima do mecanismo já existente de campos
obrigatórios (antes só disparado por modelo, e só na criação) — agora
rodam sempre, independente de modelo, tanto ao criar quanto ao editar
um card pelo modal. Não afeta autosave (que continua salvando outras
mudanças em cards antigos sem prazo/submarca já preenchidos, evitando
travar edição de cards legados só porque um campo novo ficou faltando)
nem criação de cards fora do modal (import Trello, recorrentes/
agendamentos automáticos, ferramentas do Agente Ágil) — a exigência é
da UI do modal, não uma regra de dados no Firebase.

Validado por leitura de código + checagem de sintaxe (`node --check`)
— este arquivo não tem suíte automatizada (ver `CLAUDE.md`); validação
manual no navegador ainda pendente antes de promover pra prod.

### v8.30.255-dev — 2026-08-04
Pedido direto: no import do Trello, membro sem match no board (`resolveOwner`
não encontra ninguém no squad com nome parecido) deixava de virar
responsável/participante e o vínculo simplesmente sumia, sem deixar rastro
no card. Agora, além de continuar sem responsável, o card ganha uma tag
"👤 Nome da Pessoa" (criada automaticamente, uma por pessoa não encontrada,
reaproveitada entre todos os cards dela no mesmo import) — quando ela se
cadastrar de verdade no squad, dá pra filtrar pela tag e reatribuir os
cards em lote, em vez de caçar card por card. Vale tanto pro responsável
principal quanto pra participantes adicionais (antes, participantes sem
match eram descartados até sem aviso — agora também geram warning + tag).
A tag entra no mesmo mecanismo de "tags novas serão criadas" que as tags
de label do Trello já usavam (preview do import + criação em `doTrelloImport`),
nenhum código novo de persistência.

Validado por leitura de código + checagem de sintaxe (`node --check`) —
este arquivo não tem suíte automatizada (ver `CLAUDE.md`); validação manual
no navegador (import de um board de teste com membro propositalmente sem
match) ainda pendente antes de promover pra prod.

### v8.30.254-dev — 2026-08-04
Feedback direto do time sobre os filtros rápidos de submarca (squad `site`,
v8.30.251-dev): duas correções.

- **Não quebra mais linha.** Antes, quando não cabiam todos os botões na
  mesma linha do header, a fileira de pílulas quebrava no meio (ex.: "Hering
  Teens" ia sozinha pra uma 2ª linha). Agora `#submarca-quickfilters` é
  `flex-wrap:nowrap` (com `overflow-x:auto` como rede de segurança) e cada
  pílula tem `flex-shrink:0` — os filtros são priorizados sobre a barra de
  avatares online: quando o espaço aperta, é `.hd-btns` que cede (encolhe/
  quebra internamente, já suportava isso), não os filtros de submarca.
- **Seleção múltipla.** Clicar numa submarca já marcada agora só desmarca
  ela — dá pra marcar várias ao mesmo tempo (ex.: Kids + Teens juntas).
  "Todas" limpa a seleção inteira. `activeFilters.submarca` deixou de ser
  uma string única e virou array; `passesFilter()` passa o card se ele bate
  com QUALQUER uma das submarcas selecionadas (OR, não AND). O `<select>`
  do drawer de Filtros continua escolha única (substitui a seleção
  inteira) — pra marcar mais de uma, usar os botões do header.
  `applyFilters()` (chamada por todo outro filtro do drawer) agora preserva
  a seleção de submarca em vez de tentar derivá-la de um `<select>` de
  valor único, senão mudar qualquer outro filtro apagava a multi-seleção.

Validado por leitura de código + checagem de sintaxe (`node --check`) —
este arquivo não tem suíte automatizada (ver `CLAUDE.md`); validação manual
no navegador ainda pendente antes de promover pra prod.

### v8.30.253-dev — 2026-08-04
Corrige a causa raiz do consumo alto de banda em produção (`outlet-crm`/
`outlet`, ~1GB/dia — investigado via `debugFallbackLog()`, PR #139):
`fbSaveAll()` sempre carimbava `updatedAt` novo em **todos** os cards do
squad a cada save estrutural, não só nos que a operação de fato tocou.
O custo real não é local — é em todo cliente alheio: qualquer
`fbSaveAll()` (até duplicar 1 card) fazia `cards_updated_at` de todos os
cards mudarem pro mesmo timestamp, invalidando de uma vez o cache local
(`_twoPhaseCardsLoad`) de qualquer outra pessoa com o board aberto, e
forçando todo mundo pro fallback caro (listener bruta em `/cards`
inteiro) — o padrão exato encontrado na investigação (consumo alto
sustentado, espalhado entre várias pessoas). Confirmado comparando
cache local (IndexedDB) vs remoto: cards diferentes com timestamp
*idêntico*, a assinatura desse comportamento.

`fbSaveAll(extra, touchedIds)` ganhou um segundo parâmetro opcional:
com `touchedIds`, só os cards da lista (+ qualquer card ainda sem
`updatedAt` nenhum — criação nova/legado) ganham timestamp novo; o
resto preserva o que já tinha. Omitir `touchedIds` mantém o
comportamento antigo (carimba tudo).

Todos os call sites de `fbSaveAll()` no arquivo foram convertidos pra
passar o `touchedIds` correto (mapeados por leitura de código,
call site a call site — nenhum ficou no comportamento antigo):
`fbSaveCard` (fallback), `_bulkFinish` (cobre os ~10 bulk actions:
mover, atribuir, prazo, tag, bloqueio/desbloqueio, arquivar),
`bulkDuplicate`, `bulkDeleteSelected`, inscrição de membro,
`maybeAutoArchiveOldCards`, `resetColSubPrio`, reorder de subprioridade
por drag-and-drop, `saveCard` (criação), `deleteCard`,
`deleteSelectedArchived`, `deleteSelectedOldCards`,
`bulkArchiveOldCards`, `purgeOldArchived`, `excluirArquivado`,
`processRecorrentes`, `processAgendamentos`, `executarReatribuir`,
`editarInicial` (migração de cards), a ferramenta legada `excluir_card`
do chat do Agente Ágil, `_recalcularDatasTrello`, `doTrelloImport`,
`doUndo` (diff de conteúdo entre estado atual e restaurado),
`ctxDelete`, `setDependsOn` e `unlinkDependsOn`.

Validado por leitura de código + checagem de sintaxe (`node --check`)
— este arquivo não tem suíte automatizada (ver `CLAUDE.md`); validação
manual no navegador e confirmação de queda de banda em produção ainda
pendentes antes de promover pra prod.

### v8.30.252-dev — 2026-08-03
Pedido direto: campo "Executor" ao lado de "Submarca" no modal do
card, em vez de cada um na própria linha. `.card-attr-row` é grid de 2
colunas — mesclado Submarca + Executor + Status do Agente num único
`.card-attr-row`: Submarca/Executor ficam lado a lado sempre; Status
do Agente (escondido na maioria dos cards — só aparece com executor
agente/híbrido) flui sozinho pra 2ª linha do grid quando visível, sem
precisar de JS novo pra reorganizar layout. Sem mudança de
comportamento, só posição dos campos.

### v8.30.251-dev — 2026-08-03
Corrige feedback direto do time: os botões de filtro rápido de
submarca (v8.30.249-dev) como fileira própria acima da toolbar
quebrava o layout. Movidos pra dentro do header (`.hd`), na mesma
linha do nome/seletor de squad e dos avatares online — novo
`#submarca-quickfilters` como filho flex entre `.hd-l` e `.hd-btns`
(`flex:1;justify-content:center`, com `min-width:0` pra poder encolher
em vez de estourar a largura). Botões trocaram de `.btn.btn-sm`
(tamanho de toolbar) pra uma classe nova e mais compacta
(`.hd-filter-btn`), no mesmo peso visual dos outros elementos do
header. Nenhuma mudança de comportamento — só posição/estilo.

### v8.30.250-dev — 2026-08-03
Import do Trello (`Configurações > Importar`) ganhou um select "Aplicar
uma tag a todos os cards deste import" (opcional) — pedido direto por
causa da migração do Site Hering: importando 4 boards do Trello pro
mesmo squad (`site`), sem isso seria preciso marcar a submarca card por
card depois do import. Lista as tags já existentes no squad (crie a tag
antes de importar, em Configurações > Tags — inclusive combina direto
com o campo de Submarca do release anterior). Aplicado em
`doTrelloImport()`, depois do mapeamento de colunas/membros e antes de
`cards.push(...)` — mesmo card final, só com a tag extra já no array
`tags`.

Validado por leitura de código + checagem de sintaxe (`node --check`)
— este arquivo não tem suíte automatizada (ver `CLAUDE.md`); validação
manual no navegador ainda pendente antes de promover pra prod.

### v8.30.249-dev — 2026-08-03
Decisão do time do Site Hering (depois da conversa sobre migrar do
Trello): em vez de 3-5 squads separadas (1 por submarca), **um board
só** (squad `site`), usando subtimes + filtros — este release entrega a
peça que faltava pra isso funcionar: um campo dedicado "Submarca".

- **Campo "🏷️ Submarca" no card** — mesmo padrão de "👕 Tamanho"
  (`SIZE_TAGS`): 5 tags de id fixo (`SUBMARCA_TAGS` — Hering
  Adulto/Kids/Sports/Intimates/Teens), select exclusivo no modal
  (`setCardSubmarca`, nunca 2 submarcas ao mesmo tempo), autosave ao
  trocar.
- **Toggle por squad** (`Configurações > Tags`, mesmo lugar de
  Tamanho) — `submarcaAtivo`: desligado por padrão em toda squad, PO
  ativa manualmente onde fizer sentido (squad `site`).
- **Visibilidade individual por marca** (`submarcasVisiveis`) —
  diferente de Tamanho (on/off pro recurso inteiro), aqui cada uma das
  5 submarcas tem o próprio checkbox, todas ligadas por padrão; PO
  desmarca as que não usa e elas somem do campo do card, do filtro do
  drawer e dos botões rápidos — sem apagar a tag de cards que já usam
  (mesma filosofia não-destrutiva de Tamanho/Ficha de Criativo).
- **Filtros rápidos de submarca** — nova fileira de botões centralizada
  acima da toolbar principal (só aparece com `submarcaAtivo`), um por
  submarca visível + "Todas". Reaproveita o MESMO estado do filtro do
  drawer (`#f-submarca` + `activeFilters.submarca`) — não é um filtro
  paralelo, então filtrar por um dos dois jeitos mantém o outro em
  sincronia (botão certo realçado mesmo se o filtro foi trocado pelo
  drawer).

Ativação pendente: o toggle nasce desligado em todas as squads,
inclusive `site` — precisa ser ligado manualmente em Configurações >
Tags depois do merge.

Validado por leitura de código + checagem de sintaxe (`node --check`)
— este arquivo não tem suíte automatizada (ver `CLAUDE.md`); validação
manual no navegador ainda pendente antes de promover pra prod.

### v8.30.248-dev — 2026-08-03
Dois pedidos do time do board (badges/bordas + trava de edição
concorrente):

- **Badge 🚧 de impedimento** — mesmo padrão do 🎯 de OKR, agora aparece
  no título do card sempre que `_cardIsBlocked(card)` for true — usa
  esse helper (não `card.blocker` cru) porque no modo "coluna" quem
  manda é a COLUNA do card, não a flag (`card.blocker` pode estar
  desatualizado nesse modo, ver comentário em `_cardIsBlocked`). Badge
  aparece nos dois modos (`col`/`tag`), conforme pedido.
- **Bordas mais grossas** — `.has-blocker-tag` (vermelha) e `.okr-card`
  (dourada) ganharam `border-width:2px` (eram 1px, herdado do card
  normal — time achou fino demais pra notar de relance).
- **Trava de edição concorrente** — novo nó por card,
  `kanban/squads/{squad}/dados/card_locks/{cardId}`, criado quando o
  modal do card abre (`openCard` → `_checkCardLock`). Se ninguém mais
  estiver editando (ou o lock for do próprio uid, ou estiver velho
  demais — mais de 10min sem heartbeat, considerado abandonado), assume
  o lock normalmente. Se outra pessoa já estiver editando (lock
  recente, uid diferente), mostra um banner ("🔒 Fulano está editando
  este card agora") e trava o formulário em modo leitura
  (`pointer-events:none` no corpo do modal) — trava de verdade, não só
  aviso, a pedido do time. Um listener ao vivo no lock atualiza a UI
  automaticamente se a outra pessoa soltar o lock enquanto o modal
  segue aberto, sem precisar reabrir o card. Sem `onDisconnect()` de
  propósito — mesmo padrão que `presence` já usa neste arquivo
  (`beforeunload` + timeout de staleness, não a API de disconnect do
  Realtime Database).

Corrigido durante a implementação: um bug de corrida onde duas pessoas
abrindo o mesmo card quase ao mesmo tempo assumiam o lock
otimisticamente as duas — sem o fix, quem "perdia" a corrida continuava
com o próprio heartbeat rodando, sobrescrevendo o lock de quem
realmente ganhou a cada minuto (as duas pessoas travando uma à outra em
loop). Agora, ao detectar que o lock pertence a outra pessoa (via
`.get()` inicial ou o listener ao vivo), para o próprio heartbeat de
verdade antes de mostrar o modo leitura.

Validado por leitura de código + checagem de sintaxe
(`node --check`) — este arquivo não tem suíte automatizada (ver
`CLAUDE.md`); validação manual no navegador ainda pendente antes de
promover pra prod.

### v8.30.247-dev — 2026-08-03
Investigação de consumo de banda (squads `outlet-crm`/`outlet`, ~1GB em
24h): o medidor de bytes (`_dbgTrack`/`debugBytesRemote`) mostrou que
80-90% do consumo vinha de `_cards:child_added`/`_cards:child_changed`
— a listener bruta em cima de `/cards` inteiro (sem filtro de
arquivados), que só existe quando `_twoPhaseCardsLoad()` desiste do
caminho em duas etapas e cai no fallback completo. Quebrando esse
consumo por pessoa/sessão: 5 pessoas diferentes em `outlet-crm`, 4 em
`outlet`, nenhuma dominando sozinha — descarta "sessão zumbi presa" e
aponta pra algo sistemático, mas o único rastro de "por que caiu no
fallback" era um `console.warn` que ninguém via (se perde ao fechar a
aba).

**Adiciona diagnóstico, sem mudar comportamento**: os dois pontos onde
`_twoPhaseCardsLoad()` desiste (índice remoto vazio; cache desatualizado
demais — mais de 40% dos cards ativos precisando revalidar, ver
`_CARDS_CACHE_STALE_RATIO`) e o `catch` de exceção agora chamam
`_logFallbackReason()`, que grava o motivo (+ números exatos: proporção
calculada, limite, ou a mensagem de erro) em
`kanban/squads/{squad}/dados/_debug_fallback_log` — mesmo espírito do
`_debug_bytes_log`, mas registrando a CAUSA, não só o custo. Novos
comandos de console: `debugFallbackLog()`/`debugFallbackLog(72)` (lê o
log da squad ativa) e `debugFallbackLogClear()`.

Só instrumentação — nenhuma lógica de decisão mudou. Objetivo:
da próxima vez que isso acontecer, o motivo exato fica registrado
automaticamente, sem precisar reconstruir manualmente com o medidor de
bytes genérico (como foi feito desta vez).

### v8.30.246-dev — 2026-08-01
Corrige outro bug real reportado testando o `v8.30.245-dev`: arquivar
um card funcionava na hora (aparecia certo em Arquivados), mas depois
de recarregar a página o card voltava pro board como se nunca tivesse
sido arquivado.

**Causa raiz**: `_twoPhaseCardsLoad()` usa o cache local (IndexedDB)
como fallback pra qualquer id que não esteja em `toFetch` — e, desde o
`v8.30.244-dev`, arquivado NUNCA entra em `toFetch` (de propósito, ver
entrada anterior). Só que um card que ERA ativo (e por isso já tinha
sido cacheado nesse device, com `archived` falso/ausente) e DEPOIS foi
arquivado continuava usando essa versão ANTIGA do cache — o
recarregamento nunca ia buscar a versão atual (com `archived:true`)
porque, sendo arquivado agora, ele foi excluído de `toFetch` também.
Resultado: o card "ressuscitava" como ativo a cada reload, mesmo já
arquivado de verdade no Firebase.

**Fix**: ao decidir se usa a cópia em cache pra um id atualmente
arquivado, `_twoPhaseCardsLoad()` agora só aceita o cache se ELE MESMO
já reflete `archived:true` — senão, fica de fora (deferido de verdade,
como deveria), buscado sob demanda por `_ensureArchivedCardsLoaded()`
quando alguém abrir Arquivados. Cards ativos continuam usando o cache
normalmente (sem mudança nesse caminho). De quebra,
`_ensureArchivedCardsLoaded()` agora também regrava o cache local
depois de buscar um arquivado — sem isso, o mesmo card ficaria pedindo
a rede de novo toda sessão que alguém abrisse Arquivados, pra sempre.

Testado via Playwright (7 cenários) reproduzindo o cenário exato
relatado: card ativo carregado e cacheado → arquivado (remoto muda,
cache local fica desatualizado de propósito no teste) → reload
simulado confirma que NÃO reaparece no board → abrir Arquivados busca
a versão correta → reload seguinte confirma que o cache já corrigido
não gera fetch de rede de novo E o card continua corretamente fora do
board ativo.

### v8.30.245-dev — 2026-08-01
Corrige bug real reportado ao testar o `v8.30.244-dev`: clicar em
"📦 Arquivados" quebrava com `Uncaught ReferenceError:
_ensureArchivedCardsLoaded is not defined`.

**Causa raiz**: `_ensureArchivedCardsLoaded()` (assim como
`_twoPhaseCardsLoad()`, `_planCardsDelta()` etc.) é definida DENTRO de
`fbLoadAll()` — uma função que roda 1x na inicialização, e cujas
funções internas são invisíveis pra código de fora dela (mesmo motivo
por trás de `window._cardsByKey` já existir: é o padrão usado no
próprio arquivo pra atravessar essa fronteira de escopo). `fbSaveAll()`,
`openArquivados()`, `buildBackupPayload()` e `previewBackupStats()`
ficam FORA de `fbLoadAll()` — chamavam a função local diretamente, que
nunca existiu nesse escopo.

**Fix**: `_ensureArchivedCardsLoaded` agora também é espelhada em
`window._ensureArchivedCardsLoaded` (mesmo padrão de
`window._cardsByKey`), e os 4 pontos de chamada externos passam a usar
essa referência, com guarda (`if(window._ensureArchivedCardsLoaded)`)
pro caso raro de serem chamados antes de `fbLoadAll()` ter rodado
(nesse caso, vira no-op seguro — não tem cards carregados ainda de
qualquer forma).

Achado porque o teste anterior extraía as funções isoladas (sem o
`fbLoadAll()` real por volta), então não reproduzia esse problema de
escopo. Reescrito pra rodar contra o `fbLoadAll()` inteiro de verdade —
12 cenários Playwright, incluindo o caso exato do bug relatado
(`openArquivados()` chamado depois de um `fbLoadAll()` real, sem
lançar erro e renderizando os arquivados corretamente) e uma
verificação de que `fbSaveAll()`/`openArquivados()` chamados mesmo
ANTES de `fbLoadAll()` ter rodado (guarda) não quebram.

### v8.30.244-dev — 2026-08-01
Deixa os cards arquivados de fora da carga inicial do board — só busca
sob demanda quando alguém realmente abre a tela de Arquivados. Segunda
etapa da investigação de consumo de banda iniciada no `v8.30.243-dev`
(fix de contagem em dobro): mesmo sem a duplicação, o volume real de
leituras continuava alto numa squad real (`outlet-crm`) por causa do
caminho de fallback (usado quando não há cache local no device — 1ª
visita, aba anônima, cache limpo) baixar **todos** os cards de uma vez
via listener bruto, arquivados inclusos, toda vez que roda.

**O que mudou**:
- `_planCardsDelta()`: arquivado nunca mais entra em `toFetch` — nem
  "na primeira vez que este device vê", como era antes. Só é buscado
  sob demanda (ver abaixo).
- `_twoPhaseCardsLoad()`: não desiste mais pro fallback completo só
  por não ter cache local ainda — o caminho em duas etapas (índice
  pequeno + fetch avulso por card) agora funciona também na 1ª visita,
  e como arquivado nunca entra em `toFetch`, o fallback caro
  praticamente deixa de ser necessário pra squads com muito histórico
  arquivado. A proporção de "mudou demais, mais barato baixar tudo"
  (só relevante quando JÁ havia cache) agora é calculada só sobre os
  cards ativos.
- `_ensureArchivedCardsLoaded()` (nova): busca os arquivados que
  faltam sob demanda. Chamada em 3 pontos: `openArquivados()` (preencher
  a tela quando pedido), `fbSaveAll()` e `buildBackupPayload()`/
  `previewBackupStats()` — ver nota de segurança abaixo.

**Nota de segurança (o motivo de tocar em `fbSaveAll`)**: `fbSaveAll()`
reescreve o node `/cards` inteiro no Firebase a partir do array local
`cards`. Se arquivados ficassem de fora desse array sem nenhuma
garantia, QUALQUER operação estrutural (criar card, arquivar/excluir em
lote, reordenar, recorrências) apagaria de verdade do Firebase todo
arquivado que aquele device não tinha baixado — silenciosamente, sem
erro visível. `fbSaveAll()` agora sempre chama
`_ensureArchivedCardsLoaded()` primeiro, garantindo que o array nunca
sai incompleto. Pelo mesmo motivo, `_diffCardsIndex()`/
`_diffCardsUpdatedAt()` (reconciliação automática do índice, roda 4s
após toda carga) ganharam uma exceção pra não tratar arquivado-ainda-não-
baixado como "órfão" e apagar sua entrada de `cards_index` — sem essa
exceção, o card ficaria inalcançável por id pra sempre, mesmo sem o
payload em si ser apagado.

Testado via Playwright (17 cenários): carga a frio baixa só os ativos,
zero fetch de payload de arquivado; `_ensureArchivedCardsLoaded` busca
o que falta e mescla no array global sem duplicar; `fbSaveAll` chamado
ANTES de qualquer tela de Arquivados ter sido aberta ainda assim escreve
todos os cards (nenhum arquivado se perde); reconciliação do índice não
apaga entrada de arquivado não baixado mas segue apagando órfão de
verdade; cache existente e stale demais entre os ativos ainda cai pro
fallback (comportamento antigo preservado); `openArquivados()` renderiza
os arquivados buscados sob demanda.

### v8.30.243-dev — 2026-07-31
Corrige bug de contagem em dobro no medidor de bytes (`debugBytesRemote`),
achado investigando um `debugBytesRemote(72)` real de uma squad
(`outlet-crm`) que mostrou `_cards:targeted_get(live)` como o maior
consumidor (875 MB / 432 mil chamadas em 72h) — e quase 5000 "paths"
diferentes na lista, um pra cada card individual que teve fetch.

**Causa raiz**: `fbGet(path)` já rastreia automaticamente sob o path
BRUTO passado a ele (`_dbgTrack(path, snap.val())` dentro da própria
função). Em `_twoPhaseCardsLoad()` (carregamento em duas etapas dos
cards) e em `_refreshKudosSquad()`/`_refreshKudosGeral()`, o código
chamava `fbGet(...)` e DEPOIS rastreava de novo manualmente sob um
rótulo agregado (`/cards:targeted_get`, `/cards:targeted_get(live)`,
`kudos_squad`, `kudos_geral`) — contando a mesma leitura duas vezes: uma
sob o path bruto individual (ex.: `kanban_squads_outlet-crm_dados_cards_4677`),
outra sob o rótulo agregado. Isso inflava o total reportado em ~2x pra
essas categorias E pulverizava o relatório em milhares de linhas por
card individual, em vez de ficar concentrado no rótulo agregado (que é
o que realmente ajuda a diagnosticar).

**Fix**: troca `fbGet(...)` por `window._get(fb(...))` bruto (sem
auto-rastreio) nesses 4 pontos, mantendo só o `_dbgTrack` manual com o
rótulo agregado. Sem mudança de comportamento funcional — só a
instrumentação de diagnóstico fica correta (contagem única, sem
poluição por path individual).

Mesmo corrigindo a duplicação, o volume real de leituras disparadas por
mudança em cards no `outlet-crm` continua alto (~438MB/72h só nessa
categoria) — isso é uma investigação separada, ainda em aberto, sobre
por que essa squad especificamente gera tantas atualizações de card.

### v8.30.242-dev — 2026-07-31
Limpa o visual da barra de botões do rodapé do modal do card (`.modal-ft-row`)
— feedback direto de que ela estava "desorganizada", com cores demais
competindo sem hierarquia real. Antes: 4 estilos visuais diferentes —
neutro, vermelho, teal (usado em DOIS botões sem relação nenhuma entre
si — Arquivar e Insights) e um chip preto/cinza customizado só pro
Milanote, destoando da paleta azul-teal do resto do app.

Agora só 3 pesos visuais, cada um com significado único:
- **Neutro** (outline padrão) — Duplicar, Modelo, Usar modelo, Arquivar,
  Dependência, Milanote, Cancelar. `btn-milanote` (chip preto) removido
  da CSS (única referência era esse botão).
- **Vermelho** — só Excluir (ação destrutiva).
- **Teal** — só Insights (único destaque, sinaliza IA).
- **Azul preenchido** — só Salvar (ação principal do modal).

Sem mudança de comportamento, só classe CSS trocada em 2 botões
(Arquivar, Milanote) e remoção da regra `.btn-milanote` órfã.

### v8.30.241-dev — 2026-07-31
Corrige dois bugs reais de gestão de usuário externo, reportados ao vivo
testando com um email pessoal na squad `ecomm`: exclusão não pegava
(usuário voltava sozinho no próximo login) e adicionar externo na squad
`dev` não dava acesso (login continuava redirecionando pra `ecomm`).

Investigação (agente de exploração dedicado) achou a causa raiz: existem
dois mecanismos de dado completamente separados que a UI chama de
"externo" — `kanban/squads/{squad}/externos` (whitelist por email, só
libera o login) e `kanban/usuarios/{uid}/squads/{squad}` (acesso real).
Nenhum fluxo de adicionar/remover tocava os dois ao mesmo tempo:

- **`salvarExterno()`** (Settings → Usuários → "Emails externos
  autorizados") só escrevia a whitelist, nunca `usuarios/{uid}/squads` —
  então adicionar alguém como externo numa squad nova não dava acesso de
  fato se a pessoa já tinha conta (criada ao logar pela primeira vez em
  outra squad). Agora, se já existir um `usuarios/{uid}` com aquele
  email, também grava `squads/{ACTIVE_SQUAD}=true` (papel `convidado` se
  a squad ainda não tinha um definido) — fecha o buraco que forçava
  marcar o squad manualmente no Painel depois.
- **`removerMembro()`** e **`removerExterno()`** só limpavam metade dos
  dados cada um (a inscrição no squad, ou a whitelist — nunca as duas).
  Como a whitelist sobrevivia, o próximo login caía no `if(!existe)` de
  `autoRegistrar()` e recriava a conta do zero. Agora os dois limpam a
  ponta que faltava: `removerMembro` também apaga a entrada da whitelist
  correspondente (recebe o email do usuário além de uid/nome);
  `removerExterno` também revoga `squads`/`squads_roles` se a pessoa já
  tinha uma conta real associada àquele email.
- **Redirect hardcoded pra produção** — `resolveSquadAndShow()` (usuário
  com um squad só é jogado direto pra lá) tinha `'kanban.html?squad=...'`
  fixo no código, copiado sem adaptar pro `kanban-dev.html`. Alguém
  testando no dev com squad único podia ser silenciosamente redirecionado
  pra produção. Agora usa o arquivo atual (`location.pathname`).

Testado via Playwright (13 cenários): whitelist + acesso real concedidos
juntos ao adicionar externo com conta pré-existente; sem crash quando o
email não tem conta ainda; remoção por qualquer um dos dois caminhos
limpa a whitelist e o acesso junto, sem afetar outras squads da mesma
pessoa; redirect de squad único aponta pro arquivo certo.

Ver também `painel-dev.html v2.94` — mesma investigação, correções
irmãs no lado do Painel (`toggleUserSquad`, `deleteGlobalUser`).

### v8.30.240-dev — 2026-07-31 · PR #118
Duas melhorias no board pedidas direto, fora do contexto do Spotify: usar
um modelo dentro de um card já aberto, e escolher a coluna de destino ao
duplicar (+ abrir a cópia automaticamente).

- **Usar modelo num card já aberto** — novo botão "📥 Usar modelo" no
  rodapé do modal do card, ao lado de "⧉ Duplicar"/"📋 Modelo" (mesmo
  padrão visual do menu de "Dependência" — dropdown posicionado acima do
  botão). Lista os modelos já salvos da squad (`qlItems.modelos`, já
  carregado ao vivo, nenhuma busca nova). Diferente de `usarQLItem()`
  (usado no drawer de Modelos), que sempre abre um card NOVO em branco a
  partir do modelo — aqui o card sendo editado continua sendo o mesmo.
  **Mescla, nunca sobrescreve** (decisão combinada antes de implementar):
  checklist e riscos do modelo são ADICIONADOS aos que já existem no card
  (riscos idênticos não duplicam); tags do modelo são somadas às já
  marcadas; descrição/PO só entram se estiverem vazios no card — nada do
  que a pessoa já tinha digitado é apagado. Registra um checkpoint de
  desfazer (`saveUndo`) antes de aplicar, igual a outras mutações do
  card.
- **Duplicar com escolha de coluna** — modal de duplicar (`#dup-ov`)
  ganhou um `<select>` de coluna de destino, pré-selecionado com a coluna
  ATUAL do card (então quem não mexer tem o comportamento de sempre —
  cópia na mesma coluna). Antes não existia essa opção: a coluna sempre
  copiava igual à original, sem alternativa (ex.: card em "Concluído",
  cópia só podia nascer em "Concluído" também). A escolha é aplicada
  ANTES de `recordMove()` internamente (`_duplicarCardObj` ganhou
  `opts.col`), pra o log de movimentação do card registrar a coluna
  certa, não a original.
- **Abre a cópia automaticamente** — depois de duplicar, o modal do card
  RECÉM-CRIADO abre sozinho, pronto pra edição (`openCard(novo.id)`).
  Antes, duplicar apenas fechava o modal do card original (se estava
  aberto) e deixava a pessoa olhando pro board — precisava achar e abrir
  a cópia manualmente. Vale tanto duplicando de dentro de um card aberto
  quanto pelo menu de contexto do board (clique direito → Duplicar, onde
  nenhum modal estava aberto antes).

Verificado com Playwright (26 cenários, ambiente de teste descartado
depois): modelo aplicado em card vazio preenche tudo; aplicado em card
com conteúdo mescla sem apagar nada (desc/PO não sobrescritos, checklist/
riscos/tags somados, riscos idênticos não duplicam); sem card aberto não
quebra; coluna pré-selecionada com a atual; sem trocar a coluna, cópia
fica na mesma; trocando, cópia nasce na coluna escolhida E o log de
movimentação registra a coluna certa; campos desmarcados continuam
funcionando junto com a coluna nova (sem regressão); modal da cópia abre
automaticamente com o id certo em ambos os pontos de entrada.

### v8.30.239-dev — 2026-07-31 · PR #115
Item 3 das 4 frentes de UX/performance: **controle de playback pessoal**
— play/pause/próxima direto pelo painel, sem precisar abrir o Spotify
separadamente. NÃO é um "DJ" tocando pra todo mundo (item 4, descartado
pelo próprio usuário por decisão de produto — fragilidade técnica,
latência desencontrada, exigiria permissão de escrita de todo mundo; a
playlist colaborativa da Rádio do Maré já resolve o espírito da ideia) —
é só um atalho de conveniência pra reprodução da PRÓPRIA pessoa.

- **`functions/spotify/playbackCore.js`** (novo): `controlPlayback(db,
  clientSecret, uid, action)` — `action` é `'play'`/`'pause'`/`'next'`,
  mapeado pra `PUT /me/player/play`, `PUT /me/player/pause`,
  `POST /me/player/next`. Usa o token **pessoal** de cada uid
  (`kanban/spotify_secrets/{uid}`) — reusa `_getAccessToken`/
  `_accessTokenCache` de `syncCore.js` (agora exportados), mesmo cache
  em memória, evita duplicar a troca de refresh_token uma terceira vez
  (a primeira é o sync, a segunda seria essa se não reusasse). Nunca usa
  o token da conta dona da Rádio do Maré — são coisas completamente
  diferentes (uma é token pessoal pra controlar o próprio player, a
  outra é token fixo de uma conta pra escrever numa playlist
  compartilhada).
  Distingue 3 causas de erro pela resposta do Spotify: `reason:
  PREMIUM_REQUIRED` (a própria conta não é Premium — requisito histórico
  do Spotify Connect pra controle via API, não relacionado à migração de
  endpoints de fev/2026), `reason: NO_ACTIVE_DEVICE` ou 404 puro (sem
  Spotify aberto em nenhum aparelho), e 403 com mensagem "Insufficient
  client scope" (conexão antiga, sem o escopo novo). Cada uma vira uma
  mensagem diferente na UI.
- **`functions/spotify/playback.js`** (novo): wrapper `onRequest`,
  autenticado por ID token — `uid` **sempre** do token decodificado,
  nunca aceito do corpo da requisição (mesmo cuidado de
  `syncNow.js`/`spotifyDisconnect`). Deploy isolado:
  `firebase deploy --only functions:spotifyPlayback`.
- **`functions/spotify/oauth.js`**: escopo do OAuth pessoal ganhou
  `user-modify-playback-state` — pedido só em conexões/reconexões NOVAS
  a partir de agora (`connectSpotify()` em `kanban-dev.html`), sem
  campanha de reconexão em massa pra quem já estava conectado. Quem
  tentar controlar o playback sem esse escopo recebe o erro
  `insufficient_scope` e um convite pra reconectar (reusa o mesmo botão
  "🔁 Trocar" já existente).
- **UI**: linha da própria pessoa ganhou botões ▶️/⏸️ (alterna com base
  em `status.playing`, já conhecido — sem chamada nova pra decidir qual
  ícone mostrar) e ⏭️, visíveis só quando conectada. Tenta-e-avisa em vez
  de checar dispositivo ativo antes de mostrar os botões (evita uma
  chamada de API extra só pra decidir se desabilita algo). Depois de uma
  ação bem-sucedida, dispara um sync sob demanda (mesmo do PR #114) pra
  refletir o novo estado sem esperar o tick periódico — sujeito ao mesmo
  cooldown de 10s de sempre, então pode ser ignorado silenciosamente se
  a pessoa acabou de abrir o painel; o tick de 30s cobre o resto.
  Ajuda (F1/❓) ganhou uma entrada nova sobre o controle de playback,
  incluindo os 3 requisitos (reconectar, Premium, dispositivo ativo).

Verificado com `node --test` (11 casos novos em `playback.test.js` —
usa o token pessoal certo (não o da conta dona), cada uma das 3 ações
chama o endpoint/método certo, distingue as 3 causas de erro
corretamente, reusa o cache de token do sync — 124/124 no total da
suíte de functions) e Playwright (12 cenários: ícone play/pause reflete
o estado certo, botões somem quando não conectada, cada causa de erro
mostra a mensagem certa, dispara o sync-now depois de uma ação
bem-sucedida).

### v8.30.238-dev — 2026-07-31 · PR #114
Primeira das 4 frentes de UX/performance discutidas e aprovadas antes de
implementar: **sync sob demanda ao abrir o painel** + **cadência do sync
periódico reduzida de 60s pra 30s efetivos**. As outras 2 frentes
(controle de playback pessoal, "DJ" sincronizado descartado) ficam pra
próxima leva.

- **`functions/spotify/syncCore.js`**: refactor — lógica por-uid extraída
  de `runSpotifySync()` pra `_syncOneUser(db, clientSecret, uid,
  refreshToken)` (monta as atualizações RTDB sem aplicar; quem chama
  decide como aplicar). `runSpotifySync()` continua com o mesmo
  comportamento externo exato (testes existentes passaram sem alteração
  nenhuma, confirmando que o refactor não mudou nada observável). Nova
  `syncOneUserNow(db, clientSecret, uid)`: sincroniza 1 pessoa só, com
  rate limit de 10s por uid (`Map` em memória, mesmo espírito dos caches
  de token já existentes).
- **`functions/spotify/syncNow.js`** (novo): `spotifySyncNow`, `onRequest`
  autenticado por ID token — o `uid` sincronizado é **sempre** o do token
  decodificado, nunca aceito do corpo da requisição (evita alguém forçar
  sync de outro uid). Deploy isolado:
  `firebase deploy --only functions:spotifySyncNow`.
- **`functions/spotify/sync.js`**: cadência efetiva mudou de 60s pra 30s
  — como o Cloud Scheduler não agenda sub-minuto via cron (mínimo é 1
  minuto), cada invocação agora roda `runSpotifySync()` duas vezes, com
  uma pausa de 30s no meio (`timeoutSeconds: 90`, margem sobre o default
  de 60s que ficaria justo). Número de invocações do Scheduler não muda
  (continua 1x/min, não afeta o limite gratuito de jobs); custo de API
  calculado antes de decidir (ver discussão) — ~43k chamadas/dia pra um
  squad de ~10 pessoas conectadas, longe de qualquer limite conhecido do
  Spotify ou do free tier do Firebase/GCP.
- **UI (`kanban-dev.html`)**: `toggleSpotify()` dispara `_spotifySyncNow()`
  (fire-and-forget, silencioso em caso de falha) quando a própria pessoa
  abre o painel e já está conectada — não espera o próximo tick do sync
  periódico pra refletir o que ela está ouvindo agora. Não bloqueia o
  painel abrir nem re-renderiza nada diretamente: o listener ao vivo já
  existente reflete a escrita assim que ela chegar no RTDB.

Verificado com `node --test` (9 casos novos em `sync.test.js`, cobrindo
`syncOneUserNow`: sincroniza só o uid pedido sem mexer em outros,
`skipped:not_connected` sem nem chamar o Spotify, cooldown de 10s
respeitado, cooldown é por uid — 113/113 no total da suíte de functions)
e Playwright (6 cenários: dispara o sync-now com o Bearer certo ao abrir
conectada, não dispara nada se não conectada, falha no sync-now não
derruba o painel abrir).

**Confirmado antes de implementar** (ver discussão): conta dona do app
Spotify (kicaio@hotmail.com) tem Premium ativo — sem risco do app parar
de funcionar por esse requisito (obrigatório desde fev/2026 pra apps em
Development Mode). `/me/player/currently-playing` conferido contra o
changelog oficial da Web API — não fez parte da leva de migração de
endpoints de fevereiro/2026 (só afetou `/playlists/{id}/tracks` e
outros, já corrigidos no PR #112).

### v8.30.237-dev — 2026-07-31 · PR #110
Fix de diagnóstico na Rádio do Maré: primeiro teste real de "sugerir"
(depois de conectar a conta dona e registrar 2 playlists reais) voltou
erro 500 genérico, sem detalhe nenhum acessível fora do Cloud Logging —
que nem eu nem o usuário tínhamos como consultar diretamente neste
ambiente. `spotifyRadioSuggest` engolia qualquer erro que não fosse
`radio_owner_not_connected` e devolvia só `{error:'add_track_failed'}`,
sem nenhum jeito de saber SE o problema era a troca do token da conta
dona ou a chamada em si de adicionar a faixa (403 de escopo? playlist
não editável pela conta dona? etc.).

- **`functions/spotify/radioSuggest.js`**: resposta de erro agora inclui
  `detail` (texto de erro real do Spotify ou da troca de token, truncado
  em 300 caracteres) — não é segredo nenhum, é só o texto de erro público
  da API deles. `radioSuggestCore.js` não mudou, só o wrapper que decide
  o que devolver pro cliente.
- **UI**: `sugerirSpotifyTrack()` agora mostra esse `detail` direto no
  toast ("Não deu pra sugerir: ...") em vez da mensagem genérica — o erro
  real fica visível na hora, sem precisar de ninguém entrar no Firebase
  Console.

Verificado com Playwright (3 cenários): detail devolvido pela function
aparece no toast; `radio_owner_not_connected` continua com a mensagem
específica de sempre (não regrediu); resposta sem body parseável cai no
fallback genérico sem quebrar.

**Ainda não é a causa raiz do 500 relatado** — só o instrumento pra
descobrir qual é, sem depender de acesso ao Cloud Logging. Aguardando o
usuário rodar de novo com este fix em produção pra ver o `detail` exato.

### v8.30.236-dev — 2026-07-31 · PR #109
**Rádio do Maré — Nível 1**: nova funcionalidade, playlist colaborativa
real do Spotify (não confundir com "ouvindo agora" — aqui NÃO é ao vivo,
não é sincronizado, cada um ouve no próprio ritmo). Design discutido e
aprovado antes de escrever código (dono da conta, UI, moderação — ver
PRs anteriores dessa conversa). Mesmo padrão Squad/Geral do resto do
painel: uma playlist pra empresa toda + uma por squad.

- **`database.rules.json`**: novo nó `kanban/spotify_radio_owner_secret`
  (deny total, mesmo padrão de `spotify_secrets`) — guarda o
  refresh_token de uma ÚNICA conta "dona" das playlists (a playlist é
  compartilhada, então precisa de um token de escrita fixo, independente
  de quem está sugerindo música — diferente do token pessoal de cada
  membro pro "ouvindo agora"). `radio_geral` (dentro de `painel`) e
  `radio_squad` (dentro de `squads/{id}/dados`) não precisaram de regra
  nova — já cobertos pelas regras existentes desses nós, mesmo caso de
  `spotify_now`.
- **`functions/spotify/radioOwnerCallback.js`** (novo): callback de
  conexão da conta dona — diferente de `spotifyOauthCallback` (uma
  conexão POR PESSOA, resolvida via `state`/`oauth_pending`), esta é uma
  conexão ÚNICA e manual (sem uid envolvido, é sempre a mesma conta
  fixa), pedindo os escopos `playlist-modify-public`/
  `playlist-modify-private` em vez de `user-read-currently-playing`.
  Deploy isolado: `firebase deploy --only functions:spotifyRadioOwnerCallback`.
- **`functions/spotify/radioSearchCore.js`** + **`radioSearch.js`**
  (novos): busca de faixas via `GET /v1/search`. Decisão importante:
  usa um token **app-only** via `client_credentials` (só
  client_id+client_secret, sem usuário nenhum envolvido) — busca é
  catálogo público, então funciona mesmo antes da conta dona ter sido
  conectada, e não arrisca nada relacionado a ela. Qualquer pessoa
  logada no Maré pode buscar (só verifica o ID token do Firebase Auth).
  Deploy isolado: `firebase deploy --only functions:spotifyRadioSearch`.
- **`functions/spotify/radioSuggestCore.js`** + **`radioSuggest.js`**
  (novos): adiciona a faixa escolhida na playlist via
  `POST /v1/playlists/{id}/tracks`, sempre usando o token da CONTA DONA
  (cacheado em memória entre chamadas, mesmo padrão de `syncCore.js`) —
  nunca o de quem sugere. Isso também significa que sugerir não exige
  ter conectado o próprio Spotify, só estar logado no Maré. **Moderação:
  livre total** — entra direto na playlist, sem fila de aprovação nem
  log de auditoria nesta v1 (decisão combinada, mesmo espírito de
  confiança do resto do app — Kudos/comentários também não têm
  aprovação). Deploy isolado: `firebase deploy --only functions:spotifyRadioSuggest`.
- **UI**: painel Spotify ganhou um sub-toggle "🎧 Ouvindo agora" /
  "🎵 Playlist" (escopo Squad/Geral continua como aba principal, como já
  era). Só um dos dois tem listener ativo por vez — entrar em "Playlist"
  desanexa o listener de presença (nada ali é ao vivo). Sem playlist
  registrada ainda, mostra um formulário simples pra colar o link/ID (a
  criação das playlists em si é manual, feita direto no app do Spotify —
  decisão de escopo pra v1, evita automatizar `POST /users/{id}/playlists`
  por um ganho pequeno). Registrada, mostra "🎵 Abrir playlist no
  Spotify" + busca + resultados com "+ Sugerir" em cada um.
- Ajuda (F1/❓) ganhou uma entrada nova sobre a Rádio do Maré.
- **Deixado de fora desta v1, por decisão combinada**: o botão "🎙️ Ir pra
  rádio" (extensão automática de sugestões do Spotify) — não existe uma
  URL/URI documentada e confiável pra abrir direto nesse modo (é um botão
  dentro do próprio app do Spotify, não um parâmetro de link conhecido);
  fica pra uma investigação futura, sem prioridade agora.

Verificado com Playwright (17 cenários) + `node --test` (8 casos novos em
`functions/spotify/__tests__/radioSearch.test.js` e `radioSuggest.test.js`,
105/105 no total da suíte de functions): form de registro aparece sem
playlist; extração do ID a partir de uma URL colada; grava no path certo
por escopo (squad vs. geral); busca manda o Bearer do usuário e a query
certa; sugerir manda playlistId+trackUri corretos e não depende de o
usuário ter conectado o próprio Spotify; mensagem específica quando a
conta dona ainda não foi conectada; token app-only da busca e token da
conta dona (sugestão) cacheados corretamente e nunca confundidos entre si;
autodesconexão simulada (rotação de refresh_token) coberta nos testes da
function.

**Pendência pra habilitar de verdade**: a conta dona ainda não foi
conectada — sem isso, `spotifyRadioSuggest` responde
`radio_owner_not_connected` (a UI já mostra essa mensagem específica) e
nenhuma playlist pode receber sugestões ainda. URL de autorização
(escopos `playlist-modify-public playlist-modify-private`) entregue fora
do repo, mesmo processo manual do `spotifyOauthCallback` original — só
depois do primeiro deploy + confirmação da Redirect URI exata no Firebase
Console + cadastro dela no Spotify for Developers (adicionando uma
segunda Redirect URI ao mesmo app já existente, mesmo `client_id`).

### v8.30.235-dev — 2026-07-31 · PR #108
Ajuste no grupo "não conectado" do painel Spotify (squad e geral): antes
mostrava TODAS as pessoas que nunca conectaram, cada uma com o convite
"Conectar Spotify" — em squads/na empresa toda isso vira uma lista longa
e pouco útil de gente que não usa a feature. Agora só a **própria pessoa
logada** aparece nesse grupo quando não conectada (com o botão de
conectar); as outras pessoas que nunca conectaram somem da lista.

- `renderSpotifyPanel()`: novo filtro antes do sort — mantém uma pessoa
  se ela for a própria (`isSelf`, sempre visível, conectada ou não) OU se
  `_spotifyGroupRank()` não for 2 (grupo "não conectado"). Os outros 2
  grupos (ouvindo agora / conectado parado) continuam mostrando todo
  mundo que se aplica, sem filtro nenhum — só o grupo 3 mudou.
  `_spotifyGroupRank()` em si não mudou (mesma lógica da v8.30.234-dev);
  o filtro roda em cima do resultado dela.

Verificado com Playwright (10 cenários, ambiente de teste descartado
depois): grupo 1/2 continuam mostrando todo mundo normalmente; grupo 3
mostra só a própria pessoa mesmo com outras pessoas nunca conectadas no
squad; self mantém o convite mesmo sem ninguém mais conectado; ao
conectar, self passa a aparecer no grupo certo e os outros continuam de
fora; mesmo comportamento reproduzido no escopo "Geral".

### v8.30.234-dev — 2026-07-31 · PR #107
Terceira leva da integração com Spotify: **a function agendada de sync**
(a peça que faltava pra "ouvindo agora" aparecer de verdade no painel) +
reordenação por prioridade na lista. Conectar/trocar/desconectar (PR
#106) já foi validado ponta a ponta pelo usuário em ambiente real — único
ajuste veio de lá: `database.rules.json` do PR #105 não tinha sido
deployado ainda (`firebase deploy --only database`), lembrete registrado
aqui pra não repetir: quando `database.rules.json` E `functions/` mudam
na mesma leva, os DOIS deploys são necessários, nenhum published pela
promoção do HTML.

- **`functions/spotify/syncCore.js`** (novo) + **`functions/spotify/
  sync.js`** (novo): lógica separada do wrapper `onSchedule`, mesmo
  motivo de `agente-agil/http.js` vs. `agente-agil/board.js` — a parte
  testável com `node --test` não deveria depender do runtime de Cloud
  Functions. `spotifySync` roda a cada 1 minuto (mínimo que o Cloud
  Scheduler permite — bate com o "a cada 60s" combinado desde o desenho
  original). Pra cada uid em `spotify_secrets`: renova o `access_token`
  via `refresh_token` (cacheado em memória entre execuções — o
  `access_token` dura ~1h, não faz sentido renovar a cada tick só pra 1
  leitura; testado que o segundo tick reusa o cache sem bater no Spotify
  de novo), consulta `GET /v1/me/player/currently-playing`, e escreve o
  resultado em **todos os squads que a pessoa participa + no geral**
  (mesmo fan-out multi-squad de `spotifyDisconnect`). Uma pessoa falhando
  (rede, token) não derruba o tick inteiro (`Promise.allSettled`).
  **Autocorreção**: se o `refresh_token` vier `invalid_grant` — a pessoa
  revogou o acesso direto pela tela "Apps conectados" do Spotify (o link
  de cortesia que a UI já oferece desde o PR #106), sem passar pelo nosso
  botão — a function desconecta a pessoa por completo (mesmo helper de
  `spotifyDisconnect`, agora extraído pra `functions/spotify/_shared.js`
  e reusado pelos dois), em vez de ficar tentando e falhando pra sempre e
  deixando um "conectado" fantasma no painel.
  Deploy isolado: `firebase deploy --only functions:spotifySync`.
- **`functions/spotify/_shared.js`** (novo): `buildDisconnectUpdates(db,
  uid)` — o multi-path update que apaga o refresh_token + todo o status
  público espalhado. Extraído de `spotifyDisconnect` (que passou a usar
  também) porque agora dois lugares diferentes (o botão de desconectar E
  a autocorreção do sync) precisam apagar exatamente as mesmas coisas —
  copiar essa lógica duas vezes seria um jeito fácil dela divergir se
  alguém adicionar um novo path de status no futuro e esquecer de
  atualizar as duas cópias.
- **`functions/package.json`**: novo `spotify/__tests__/*.test.js` no
  script de teste, mesma convenção de `agente-agil`/
  `agente-agil-orquestrador`. `functions/spotify/__tests__/sync.test.js`
  (5 casos, `node --test`, sem emulador — fake db local + `fetch`
  mockado): fan-out multi-squad + geral, imagem de capa pega a menor do
  array, entrada não some quando nada está tocando (`{playing:false}`,
  não ausência), autodesconexão real no `invalid_grant`, tick resiliente
  a uma pessoa falhando, cache de `access_token` reusado no tick seguinte.
- **UI (`kanban-dev.html`)**: nova ordenação por prioridade em
  `renderSpotifyPanel()`/`_spotifyGroupRank()` — **1º** quem está
  conectado E ouvindo algo agora, **2º** conectado mas parado, **3º** não
  conectado; dentro de cada grupo continua alfabético, como já era. A
  própria pessoa usa `_spotifySelfConnected` (a flag pública, não a
  presença no bucket) pra decidir o grupo 1-vs-3 — o sync só escreve a
  cada 1 minuto, então logo depois de conectar o bucket pode ainda não
  ter entrada nenhuma; sem esse cuidado a própria pessoa cairia no grupo
  "não conectado" por até 1 minuto após conectar (mesmo motivo de
  `_spotifySelfConnected` existir desde o PR #106). Pra todo mundo, é
  suficiente calcular com o que o sync já escreve — presença em
  `spotify_now` = conectado, `playing && track` = ouvindo, ausência = não
  conectado — sem precisar de nenhum dado novo.

Verificado com Playwright (8 cenários, ambiente de teste descartado
depois — client não tem framework de teste, ver `CLAUDE.md`): grupo 1
sempre no topo, dois "ouvindo agora" ficam juntos em ordem alfabética
entre si, grupo 2 logo depois, grupo 3 alfabético por último, própria
pessoa recém-conectada (sem entrada no bucket ainda) cai no grupo 2 e não
no 3, volta pro grupo 3 corretamente ao desconectar.

### v8.30.233-dev — 2026-07-31 · PR #106
Segunda leva da integração com Spotify: credenciais reais plugadas
(`SPOTIFY_CLIENT_ID` não é secreto, vive como constante no código; o
`SPOTIFY_CLIENT_SECRET` já estava no Secret Manager desde o primeiro
deploy) e gestão de conta por usuário — trocar de conta, desconectar de
verdade e lidar com quem está em mais de um squad. Design discutido e
aprovado antes de escrever código (ver PRs anteriores dessa conversa).

- **`functions/spotify/oauth.js`**: `SPOTIFY_CLIENT_ID` deixou de ser
  placeholder. O redirect de sucesso agora distingue `?spotify=connected`
  (primeira conexão) de `?spotify=reconnected` (já estava conectado,
  trocou de conta/reautorizou) — o cliente informa qual dos dois é via
  `wasConnected` no próprio `oauth_pending/{state}`, já que a function não
  tem outro jeito de saber. Gravação do token e da flag pública
  `spotify_connected` virou um `update()` multi-path atômico.
- **`functions/spotify/disconnect.js`** (novo): `spotifyDisconnect`, uma
  `onRequest` v2 em `us-central1` com CORS liberado só pro domínio do
  GitHub Pages (chamada via `fetch()` do navegador, não redirect — precisa
  de CORS, diferente do callback do OAuth). Verifica o ID token do
  Firebase Auth (`Authorization: Bearer`), e então **apaga de verdade**
  (não é flag de "inativo"): `spotify_secrets/{uid}` (o refresh token em
  si), `usuarios/{uid}/spotify_connected`, `painel/spotify_now_geral/{uid}`
  e `squads/{sq}/dados/spotify_now/{uid}` — este último pra **cada squad
  que a pessoa participa** (`usuarios/{uid}/squads` é um mapa
  `{squadId: true}`, confirmado que não existe conceito de "squad
  principal" em nenhum outro lugar do código; sem esse fan-out, alguém em
  dois squads continuaria aparecendo como "ouvindo" no squad que não foi
  desconectado). A ausência da entrada em `spotify_secrets` é o único
  sinal que a futura function de sync vai checar pra saber que parou —
  não tem flag separada de "ativo" pra ficar dessincronizada.
  Deploy isolado: `firebase deploy --only functions:spotifyDisconnect`.
- **`functions/index.js`**: exporta `spotifyDisconnect`.
- **UI (`kanban-dev.html`)**: a linha da própria pessoa no painel agora
  reflete `usuarios/{uid}/spotify_connected` (buscado uma vez ao abrir o
  painel, via `toggleSpotify()`) — se já conectada, mostra "🔁 Trocar
  conta" + "❌ Desconectar" + um link de cortesia "Gerenciar no Spotify ↗"
  pra `https://www.spotify.com/account/apps/` (pro caso de a pessoa
  querer revogar o acesso direto pelo lado do Spotify também); se não,
  mostra o botão "🔌 Conectar Spotify" de antes. "Trocar conta" reusa o
  mesmo fluxo de conexão (o `.set()` do callback já sobrescreve o token
  antigo) — só precisou passar `wasConnected` no `oauth_pending` pra virar
  o toast certo. Nova `desconectarSpotify()`: confirma
  (`uiConfirm`), chama `spotifyDisconnect` com o ID token da sessão, e em
  caso de sucesso limpa o estado local (`_spotifySelfConnected` e a
  entrada da própria pessoa nos buckets de "ouvindo agora" já
  carregados) sem esperar o próximo tick de um listener. Ajuda (F1/❓)
  ganhou uma 4ª entrada explicando trocar/desconectar.

Verificado com Playwright (24 cenários): estado não-conectado vs conectado
na linha própria; `connectSpotify()` grava `wasConnected` correto nos dois
casos; fluxo completo de `desconectarSpotify()` (chamada com o Bearer
certo, limpeza de estado local, toast) e seu cancelamento; os três
resultados de query string (`connected`/`reconnected`/`error`) mostram o
toast certo e limpam a URL depois.

**Ainda pendente** (fora do escopo desta leva): a function agendada de
sync (polling de `/me/player/currently-playing` a cada squad conectado e
fan-out pra `spotify_now`/`spotify_now_geral`) — sem ela, conectar/
desconectar e a UI já são testáveis ponta a ponta, mas o "ouvindo agora"
em si ainda não populará no painel.

### v8.30.232-dev — 2026-07-31
Primeira leva da integração com Spotify ("ouvindo agora") — escopo v1
deliberadamente simples: só o que cada pessoa está ouvindo neste momento,
sem histórico. Plano de arquitetura discutido e aprovado antes de
escrever código (investigação de OAuth existente, padrão do Kudos pra
squad/geral, leitura lazy) — ver PRs anteriores dessa conversa.

**Só as partes que não dependem de credenciais do Spotify**, por decisão
combinada — a troca de token real (`SPOTIFY_CLIENT_ID`/
`SPOTIFY_CLIENT_SECRET`) fica pra depois que o app for criado no Spotify
for Developers:

- **`database.rules.json`**: novo nó `kanban/spotify_secrets` com
  `.read`/`.write: false` pra todo mundo — só Admin SDK (Cloud Functions)
  acessa. Importante: teve que ficar FORA da árvore `kanban/usuarios`,
  porque essa árvore já tem `.read: "auth != null"` no nível raiz, e
  regras do Realtime Database cascateiam só numa direção — um `.read:
  false` mais profundo não revoga um acesso já concedido por um
  ancestral. Também novo `kanban/oauth_pending/{state}` (ponte de uso
  único entre "cliente inicia o OAuth" e "Spotify redireciona pro
  callback", já que o Spotify não sabe nada sobre uid do Firebase). Os
  nós de status público (`spotify_now` por squad, `spotify_now_geral`)
  não precisaram de regra nova — já caem dentro de `dados`/`painel`, que
  já têm regras adequadas.
- **`functions/spotify/oauth.js`** (novo): `spotifyOauthCallback`, uma
  `onRequest` v2 em `us-central1` (mesma região de `agenteAgil`). Troca o
  `code` por tokens usando `client_secret` (Secret Manager, mesmo padrão
  de `AGENTE_AGIL_KEY` em `agente-agil/http.js`), grava o `refresh_token`
  em `spotify_secrets/{uid}` via Admin SDK, redireciona de volta pro app
  com `?spotify=connected` ou `?spotify=error`. `SPOTIFY_CLIENT_ID` é
  constante no código (não é secreto — o próprio Spotify espera isso
  exposto no client) — hoje um placeholder, aguardando o app ser criado.
  Não existe function separada pra "iniciar" o OAuth: o link de
  autorização é montado direto no `kanban.html`, sem servidor.
- **UI**: novo botão "🎧 Spotify" na mesma família visual de "📊 Dados"/
  "📌 Lembretes" (pílula fixa na lateral direita), abrindo um painel com
  duas abas "Sua Squad"/"Geral" — mesmo padrão visual e arquitetural do
  Kudos (dois paths reais, não agregação: `kanban/squads/{squad}/dados/
  spotify_now` e `kanban/painel/spotify_now_geral`, function de sync
  futura escreve os dois a cada tick). Cada pessoa aparece com a música
  atual (capa + artista), "⏸ Nada tocando agora" (conectado mas parado),
  ou "Não conectado" — a própria pessoa, se não conectada, vê um botão
  "🔌 Conectar Spotify" em vez disso.
- **Leitura lazy**: diferente do Kudos (que faz poll a cada 3min o tempo
  todo, pra manter um badge de contagem), o Spotify não tem badge — então
  o listener (`_onChildAdded`/`_onChildChanged`/`_onChildRemoved`, mesmo
  padrão de `presence`) só é anexado quando o painel abre, na aba ativa;
  desanexado ao fechar ou trocar de aba. Zero leitura em background com o
  painel fechado. A function agendada de sync (ainda não implementada —
  fica pra quando as credenciais existirem) roda independente disso.
- Ajuda (F1/❓) ganhou uma aba nova "🎧 Spotify" com 3 entradas.

Verificado com Playwright (13 cenários): abrir o painel anexa listener só
no path certo; trocar de aba desanexa o antigo e anexa o novo; fechar
desanexa tudo; renderização cobre os 4 estados (tocando, parado, própria
pessoa não conectada, outra pessoa não conectada); `connectSpotify()` sem
`client_id` configurado avisa em vez de tentar redirecionar.

**Pendências explícitas pra próxima leva** (fora do escopo desta,
combinado com o usuário): function agendada de sync (polling da API do
Spotify a cada 60s, escrevendo `spotify_now`/`spotify_now_geral`);
preencher `SPOTIFY_CLIENT_ID`/`SPOTIFY_CLIENT_SECRET` reais depois que o
app for criado no Spotify for Developers; confirmar a Redirect URI exata
no Firebase Console após o primeiro deploy de `spotifyOauthCallback`,
antes de cadastrar no formulário do Spotify.

### v8.30.231-dev — 2026-07-30
Nova ação em massa na barra de seleção múltipla: **🚧 Impedimento**, pra
marcar/remover impedimento em vários cards de uma vez — pedido pelo
usuário depois de mexer no compilado de bloqueios do Painel.

Respeita o `blockerMode` do squad (coluna vs tag) através da mesma fonte
única de verdade que já existia (`_cardIsBlocked()`), em vez de
reimplementar a decisão:
- **Modo "coluna"** (padrão): marcar move os cards não-bloqueados
  selecionados pra Impedimentos (mesmo caminho de `bulkMove`, com rótulo
  dedicado pra descoberta). Remover pede uma coluna de destino — não
  existe (em nenhum lugar do código, nem no single-card) um "voltar pra
  coluna anterior" rastreado, então não inventei esse estado novo; só
  reaproveitei a lista de colunas já usada por `bulkMove()`.
- **Modo "tag"**: marcar liga `card.blocker`+`card.blockerReason` (com um
  campo de motivo opcional no popover) sem mexer na coluna; remover limpa
  os dois campos. Não abre o modal do card pra digitar o motivo (como o
  fluxo single-card faz) — o motivo vem direto do popover em massa, mais
  rápido pra aplicar o mesmo texto em vários cards.

O popover separa "marcar" (só cards ainda não impedidos) de "remover" (só
cards já impedidos) dentro da mesma seleção — evita marcar de novo quem já
está impedido ou tentar remover de quem nunca esteve.

Verificado com Playwright (18 cenários, sem tocar DOM real — chama as
funções de mutação diretamente): nos dois modos, marca só quem devia,
ignora cards fora da seleção, não duplica/reprocessa quem já está no
estado-alvo, e usa `_bulkFinish` com `keepSelection` correto pra cada modo
(estrutural em coluna, não-estrutural em tag — mesmo padrão das outras
ações em massa).

Ajuda (F1/❓) atualizada — a entrada de "Seleção múltipla" também estava
desatualizada (dizia "seis ações" mas já eram sete, faltando 📅 Prazo);
corrigido de passagem junto com a entrada nova de 🚧 Impedimento.

### v8.30.230-dev — 2026-07-30
Limpeza de código morto, parte 2 da leva de "otimização de rotina" —
relatório gerado por um agente de auditoria dedicado (750+ identificadores
top-level verificados contra o arquivo inteiro + `painel.html`/
`painel-dev.html`, buscando `onclick`, `window.x()`, dispatch por string).
Cada item foi re-verificado manualmente antes de remover (contagem de
referências no arquivo, confirmando exatamente 1 — a própria definição).

**17 funções órfãs removidas** (nunca chamadas — a maioria era duplicata
substituída por outra função, achado durante a auditoria): `cardHasDesc`,
`_doBulkTag`, `subteamsOfInit`, `_flowFirstColId`, `resetFlowBaseline`,
`cycleColSort`, `moveCardSubPrio`, `toggleCardOKR` (duplicata de
`ctxToggleOKR`), `addCI` (lia um `#cl-inp` inexistente no HTML —
substituída por `addCIToGroup`), `_nextDueDate`, `_cleanupQLTemp`,
`openTrelloImport`, `_maybeRequestNotifPermission` (duplicata de
`requestNotifPermission`), `ctxProgress`/`ctxDone` (duplicatas de
`ctxMove`), `renderMentionText` (duplicata de lógica já embutida em
`renderMd`), `resolveAllBugs`, `salvarComoModelo` (duplicata de
`ctxModel`/`salvarComoModeloModal`, cuidado pra não confundir com essa
que continua em uso).

**2 variáveis órfãs removidas**: `_origQa` (leftover de instrumentação
que nunca foi lida) e `_qlEditIdx` (superseded por `_editingQLItem`).

**CSS órfão removido** (correlacionado com o código acima ou standalone,
sem nenhuma referência em markup/JS, incluindo construção dinâmica via
template string): `.card-has-desc`, `.dep-node-indent`/`.dep-node-line-h`/
`.dep-node-line-v` (leftovers de um estilo antigo de árvore, substituído
pela seta de texto simples do Mapa de Dependências atual), `.parent-btn`
(substituído por `.minicard-*` no seletor de "Depende de" atual),
`.retro-s`/`.retro-t`/`.retro-i` (cluster órfão isolado, sem recurso vivo
correspondente).

**Deixado de fora desta leva, por decisão de produto** (não é limpeza de
código morto simples, precisa de decisão consciente — terminar de religar
a UI ou remover o subsistema inteiro):
- Painel "mini dependência" (`renderCardDepMini`, `depMiniNav` etc.) —
  chamado mas sempre no-opa, os IDs de DOM que espera não existem no HTML.
- Subsistema "Linked Cards" (`searchLinkedCards` e vizinhos) — parece
  substituído pelo "Depende de" atual, mas o texto de ajuda (F1/❓) e o
  prompt da IA ainda descrevem esse recurso pros usuários — inconsistência
  real, além do código morto.
- Cauda de ~30 classes CSS órfãs de confiança média (`.btn-modelo`,
  `.squad-btn`, `.cal-legend` etc.) — impacto individual pequeno, mas
  merecem uma segunda olhada isolada antes de remover em lote.

### v8.30.229-dev — 2026-07-30
Leva de otimização de rotina + auditoria mobile, pedida como "otimização
de rotina + análise e correção mobile" — escopo combinado antes de
implementar: performance de sync/polling, limpeza de código morto (relatório
separado) e auditoria geral de responsividade (sem bug específico relatado).

**Heartbeat de presença pausa em aba oculta.** O heartbeat (escreve
`kanban/squads/{squad}/presence/{uid}` a cada 15s) rodava mesmo com a aba
em background — diferente do poll de kudos, que já tinha essa guarda
(`if(!document.hidden)`). Cada heartbeat em background é escrita
desperdiçada (a pessoa já apareceria "offline" pros outros depois do
timeout de 30s de qualquer forma, que é o comportamento correto) —
especialmente relevante no mobile, onde trocar de app deixa a aba em
background o tempo todo. Ganha também um heartbeat imediato ao VOLTAR pra
aba (`visibilitychange`), pra não ficar "às escuras" até o próximo tick de
15s.

**Reordenar colunas por toque (mobile).** Auditoria mobile encontrou um
gap concreto: cards já tinham um sistema de touch drag-and-drop custom
(`addTouchDnD`, toque longo com vibração/clone visual), mas colunas só
tinham o `dragstart` nativo do HTML5 — que simplesmente não dispara em
touch. Não existia alternativa (sem botões mover-esquerda/direita, sem
menu): reordenar colunas só funcionava no desktop. Novo `addTouchColDnD`
replica o mesmo gesto de long-press dos cards (arma depois de 400ms
parado, vibra, classe visual `.col-armed`), calculando o destino pela
metade esquerda/direita da coluna sob o dedo — mesma lógica de
`handleColDrop` (mouse), reaproveitada. Verificado com Playwright
(dispatch de `TouchEvent` reais) antes de fechar: arrasto pro fim da
lista, arrasto pra posição inicial, tap rápido sem long-press (não deve
reordenar nada), e toque começando dentro de um `.card` (não deve colidir
com o drag do card). Os 4 cenários passaram. Texto novo em Ajuda (F1/❓)
documentando o gesto, ao lado da entrada já existente de "Arrastar card
no celular".

Auditoria também sinalizou dois pontos que ficam de fora desta leva, por
não terem risco/retorno claros o bastante pra mexer sem mais confirmação:
um poll de 60s que rebusca `/columns` e `/tags` inteiros além dos
listeners ao vivo que já existem pros dois (parece redundante, mas o
comentário no código descreve como "rede de segurança" deliberada — sem
histórico de por que foi adicionado, não risquei remover); e
`_cardDirtyTimer`, que faz polling de 400ms comparando `JSON.stringify`
pra detectar alterações não salvas no card aberto — daria pra trocar por
listeners de evento nos campos, mas é refator maior tocando a UX do botão
salvar em vários tipos de campo.

Reordenar cards DENTRO da mesma coluna por toque (só entre colunas
funciona hoje) fica como gap conhecido, não resolvido nesta leva.

### v8.30.228-dev — 2026-07-30
Reduz drasticamente o consumo de leitura do Firebase em boards com muito
histórico arquivado. Achado com dados reais de um squad de produção
(`outlet-crm`): 4.725 cards no total, **84% arquivados** (3.966) — e o
sync do board estava rebaixando TODOS eles, ativos e arquivados, a cada
sessão de cada pessoa conectada, o tempo todo (não só no carregamento
inicial — o listener ao vivo de `cards_updated_at` também revalidava
arquivados a cada burst). Consumo medido: mais que dobrando por dia
(155k → 1,3M chamadas/dia em 4 dias), espalhado por várias pessoas
simultaneamente, não uma sessão travada.

Novo índice leve `cards_archived/{cardId}->true` (só existe pra
arquivados, ausente = ativo) — mantido no mesmo funil que já mantém
`cards_index`/`cards_updated_at` (`fbSaveAll()`/`fbSaveCard()`).
`_planCardsDelta()` (kanban.html) passa a receber esse índice: um card
arquivado só entra na lista de busca individual se **nunca tiver sido
cacheado** neste dispositivo — não mais toda vez que o timestamp dele
mudar. `_onCardsUpdatedAtLive()` (listener ao vivo) ignora reverificar
ids já marcados como arquivados; novo listener em `cards_archived`
mantém isso atualizado em tempo real durante a sessão (arquivar/
desarquivar por qualquer pessoa reflete na hora, sem esperar reload).

Decisão deliberada de escopo: `cards` continua contendo TUDO (ativos +
arquivados), exatamente como hoje — investigação encontrou ~50 lugares no
código que dependem disso (renderização, filtros, `openArquivados()`,
`desarquivar()`, limpeza em massa, relatórios). Só muda a FREQUÊNCIA de
reverificação de arquivados, não o que fica disponível localmente — trade-
off: cada dispositivo ainda baixa os arquivados uma vez (não zero), mas
nunca mais fica re-baixando o mesmo histórico parado indefinidamente. Uma
versão "sob demanda" (só carrega arquivados ao abrir a tela de
Arquivados, evitando até esse custo único) fica pra uma investigação
separada — mudança maior, toca os ~50 call-sites que hoje assumem `cards`
completo.

**Requer migração pros squads com arquivados já existentes** (como este):
sem popular `cards_archived` retroativamente, o mecanismo só vale pra
arquivamentos novos a partir de agora. Script de migração fornecido à
parte (console do navegador, roda uma vez por squad).

Verificado: `_planCardsDelta()` (função pura) testada isoladamente contra
6 cenários (ativo mudou, ativo igual, arquivado já cacheado com timestamp
divergente, arquivado nunca cacheado, card legado sem timestamp, e
`remoteIds` sempre completo independente do que entra em `toFetch`).

### v8.30.227-dev — 2026-07-30
Corrige a CAUSA RAIZ das tags fantasma (as duas entradas anteriores só
mitigavam o sintoma — o rótulo numérico no reparo). O listener ao vivo de
`/tags` (`fbListen`) reatribuía `tags` pra um array novo assim que
QUALQUER atualização remota chegava, sem nenhuma proteção contra colisão
com edições locais em andamento — diferente do listener de `cards`, que já
tem essa guarda (`_hasLocalSession`/`_lastLocalSave`).

Sequência do bug: o editor de tags (Config → Tags) renderiza linhas cujos
handlers (`updateTagName(i,...)`, `delTag(i)`, etc.) dependem do ÍNDICE do
array `tags` no momento da renderização. Se uma atualização remota chegasse
enquanto o editor estava aberto (ex.: outra pessoa salvando tags ao mesmo
tempo), `tags` era reatribuído a um array novo por baixo do editor — os
handlers passavam a mexer no item ERRADO do array novo (mesmo índice, tag
diferente), e o `saveTags()` seguinte sobrescrevia `/tags` inteiro (`fbSet`,
sem merge) com esse estado corrompido, derrubando silenciosamente tags
ainda em uso por cards.

Fix: ignora a atualização remota enquanto o editor de tags está de fato
aberto E mostrando linhas (`cfg-ov` com `.open` E `#tag-editor .tag-row`
presente) — mesmo espírito de proteção que `cards` já tem. Verificado com
Playwright contra os 4 cenários relevantes (editor fechado, aberto em
outra aba, aberto na aba de tags, fechado de novo com DOM residual —
`closeOv()` só remove a classe `.open`, não limpa o HTML).

### v8.30.226-dev — 2026-07-30
Fortalece o fix de "🔧 Detectar e reparar tags fantasma" (v8.30.224-dev):
o fix anterior só checava se o ID **começa** com `tag_`, mas `addTag()`
cria tags com id `'tag_'+Date.now()` — sem sufixo de 4 caracteres. Pra
esses, o prefixo bate (entra no `if`), mas depois de remover `tag_` sobra
só o timestamp cru, ainda puramente numérico — escapando do fallback "Tag
sem nome" e reproduzindo o bug original. Achado com dados reais: 4 tags no
squad `midiacriativa` (`tag_1782410107254` e outras 3), usadas por 12+
cards de modelo (`MODELO | ...`), com esse formato exato. Agora
`_derivarLabelTagFantasma()` também rejeita um rótulo derivado que
continue sendo só dígitos, não só a ausência do prefixo `tag_`.

Isso também aponta o provável motivo dessas tags terem sumido: como
`tag_'+Date.now()` é exatamente o esquema que `addTag()` usa pra tags
criadas normalmente pelo time (não só import do Trello), a hipótese mais
forte é que elas eram tags de verdade, criadas via `addTag()`, e viraram
"fantasma" (removidas do array `tags` sem querer) por causa de
`saveTags()` fazer um `fbSet` — sobrescrita completa do array — sem
merge; duas edições concorrentes de tags podem se pisar, uma apagando a
tag que a outra tinha acabado de criar. Ainda não confirmado nem corrigido
— fica como próximo passo de investigação.

### v8.30.225-dev — 2026-07-30
Corrige "💡 Meus cards" destacando cards de OUTRA pessoa. Causa raiz:
`window._currentUserInit` (o que `_euEstouNoCard()` usa pra decidir "esse
card é meu") era recalculado a cada login só pela fórmula ingênua de
1ª-letra-de-cada-palavra do `displayName`/email do Google — e nunca
corrigido pro `init` de verdade registrado no Firebase (`existe.init`),
que pode ter sido editado manualmente (campo ✎ Iniciais) pra resolver
colisão com outra pessoa de nome parecido. Se o valor calculado na hora
divergisse do registrado — inclusive coincidindo com a inicial real de
OUTRA pessoa — "Meus cards" destacava os cards errados, já que o match é
exato. Reportado com um caso real: duas "Leticia" diferentes (iniciais LM
e LN), uma via os cards da outra ao clicar no botão. Fix: em
`autoRegistrar()`, pro ramo de usuário já cadastrado, usa `existe.init`
(autoritativo) em vez do recém-calculado.

### v8.30.224-dev — 2026-07-30
Corrige o rótulo mostrado por "🔧 Detectar e reparar tags fantasma" quando
o ID da tag órfã não segue o padrão `tag_<slug>_<4chars>` do import do
Trello (ex.: squads com tags legadas de ID puramente numérico). Antes, o
`replace()` de prefixo/sufixo não tinha o que remover nesses casos e o
"rótulo derivado" acabava sendo o próprio ID cru (ex.: `1782410107254`
aparecendo como nome da tag) — parecia bug de UI, não uma tag de verdade.
Agora só deriva do ID quando ele bate com o formato esperado; caso
contrário, usa `Tag sem nome (<id>)`, claramente sinalizando que precisa
de um nome, mas ainda rastreável pelo ID entre parênteses. Extraído pra
uma função própria (`_derivarLabelTagFantasma`) — mesma lógica, só
nomeada e testável isoladamente.

Achado numa sessão de uso real: o botão de reparo tinha sido clicado numa
squad de produção com tags de ID legado/não-padrão, gerando 5 tags com
nome numérico. O fix cobre reparos futuros; as 5 já criadas precisam ser
renomeadas manualmente no editor de tags (o editor já funciona bem pra
isso, não precisa de código).

### v8.30.223-dev — 2026-07-30 · PR #71
Documenta "💡 Meus cards" (PRs #61/#68/#69) no conteúdo de ajuda (F1/❓) —
novo item na seção do board, logo depois de "Filtros". Conferido que não
sobrou nenhuma menção ao filtro "Qualquer executor" removido na PR #66.

### v8.30.222-dev — 2026-07-30 · PR #69
Corrige "💡 Meus cards" (achado numa validação real, seguida da PR #68):
todos os cards da pessoa já pulsavam certo (fix anterior), mas só o
primeiro match ficava de fato visível — `scrollIntoView()` só decide UMA
posição horizontal final pro board (colunas dividem a mesma rolagem
horizontal), então cards em colunas fora da tela (ex.: Backlog rolado pra
fora) ou mais abaixo dentro de uma coluna já visível (ex.: Em
desenvolvimento) pulsavam "escondidos", sem a pessoa nunca ver.

Cada coluna tem sua PRÓPRIA rolagem vertical independente, então agora
pré-posiciona a rolagem vertical de toda coluna com card da pessoa
(`inline:'nearest'`, sem brigar pela rolagem horizontal ainda) antes da
rolagem "de verdade" (suave) pro primeiro match, que decide a posição
horizontal final por último. Resultado: mesmo colunas que não ficam
visíveis de cara já mostram o card certo assim que a pessoa rolar até lá
manualmente. Testado com harness Playwright confirmando a ordem das
chamadas (pré-posicionamento primeiro, rolagem suave final por último).

### v8.30.221-dev — 2026-07-30 · PR #68
Corrige "💡 Meus cards" (PR #61) só destacando/rolando até o card na
coluna Concluído, ignorando cards em outras colunas — achado numa
validação real. Causa: colunas grandes só renderizam os primeiros 80
cards por performance (`_colRenderLimit`, botão "ver mais") — um card da
pessoa além desse limite numa coluna maior (ex.: em andamento) nem existia
no DOM ainda, então não tinha como pulsar nem rolar até ele. Só funcionava
em colunas pequenas (como Concluído, tipicamente com poucos cards).
Corrigido expandindo o limite de renderização da coluna pro total dela
quando há um card da pessoa além do limite atual. Testado com harness
Playwright simulando uma coluna com 90 cards (card da pessoa na posição
85, além do limite padrão de 80) — agora renderiza e pulsa certo.

### v8.30.220-dev — 2026-07-30 · PR #66
Remove o filtro "Qualquer executor" (`#f-exectype`) da barra de Filtros —
redundante com o seletor 👤/🤝/🤖 do cabeçalho (`hybrid-view-switch`),
que já filtra por `card.executorType`. Não eram 100% idênticos (o seletor
do cabeçalho é inclusivo — 👤 mostra humano OU híbrido; o dropdown fazia
match exato — 👤 mostrava só humano, excluindo híbrido), mas a diferença é
sutil o bastante pra não valer o item a mais na barra, que também ajuda a
reduzir quebra de linha (discutido numa validação real comparando com o
fix da PR #65). Removida também a chave `execType` de `activeFilters` e o
check correspondente em `passesFilter()`.

### v8.30.219-dev — 2026-07-30 · PR #65
Ajuste no fix da PR #64 (achado numa validação real): o `margin-left:auto`
resolvia o agrupamento, mas fazia "💡 Meus cards"/"✕ Limpar" quebrarem pra
uma linha própria, flutuando isolados à direita numa linha por si só —
esteticamente estranho. Removido o `margin-left:auto` (o grupo agora flui
normal com o resto da barra, como qualquer outro item) e encurtado
"✕ Limpar" pra só "✕🗑️" (mantém o tooltip "Limpar filtros" no hover),
reduzindo a chance de quebra de linha também. Verificado com screenshot em
3 cenários (squad com/sem filtro de tamanho, janela larga e estreita).

### v8.30.218-dev — 2026-07-30 · PR #64
Corrige quebra de linha feia na barra de Filtros (achado numa validação
real, comparando squads `dados` e `ecomm`): "💡 Meus cards" e "✕ Limpar"
eram só mais dois itens soltos no `flex-wrap` da barra, então onde eles
quebravam de linha dependia de quantos filtros estavam visíveis (varia por
squad — ex.: o filtro de tamanho só aparece pra squads com essa opção
ativa) e da largura da tela. Às vezes cada um ficava sozinho numa linha
(ok), às vezes os dois ficavam espremidos meio deslocados no fim da linha
anterior (feio). Agrupados os dois num `<div>` próprio com
`margin-left:auto` — sempre ficam juntos e alinhados à direita, com ou sem
o filtro de tamanho visível. Verificado com screenshot comparando os dois
cenários (squad com/sem filtro de tamanho, mesma largura de tela).

### v8.30.217-dev — 2026-07-30 · PR #62
Corrige crash real achado ao abrir um card no squad `ecomm`: `renderCL()`
passava `item.t` direto pra `renderMd()` (introduzido na PR #58, @menção em
checklist) sem o fallback `||''` que todo outro call-site de `renderMd()`
no app já usa — um item de checklist existente com `t` undefined/null
(dado legado/malformado) travava com `TypeError: Cannot read properties
of undefined (reading 'replace')` ao tentar abrir QUALQUER card daquele
squad. Corrigido pra `renderMd(item.t||'')`/`dataset.raw=item.t||''`,
igual ao padrão já usado em `renderMd(d.text||'')` (descrições
adicionais). Testado com harness reproduzindo item sem `t`, com `t: null`
e com `t: undefined` — nenhum crasha mais, todos caem pra texto vazio.

### v8.30.216-dev — 2026-07-30 · PR #61
Novo botão "💡 Meus cards" na barra de Filtros — destaca (sem esconder o
resto) todos os cards onde a pessoa é responsável ou participante
(reaproveita `_euEstouNoCard()`, já usado pra dar um tom sutil permanente a
esses cards via `.card-mine`), expande colunas colapsadas que tenham algum,
e rola até o primeiro. Pedido do time: achar os próprios cards num board
lotado sem precisar filtrar (o filtro por usuário existente esconde o
resto, que nem sempre é o que a pessoa quer).

Destaque é um **glow/pulso suave** (3 pulsos, ~2s), não um blink literal —
flash rápido repetido é gatilho conhecido de fotosensibilidade. Testado com
harness Playwright isolado: cards certos pulsam, coluna colapsada expande
quando tem card da pessoa, scroll vai pro primeiro, clique de novo
reinicia o pulso (em vez de não fazer nada), sem card nenhum mostra toast
sem quebrar.

### v8.30.215-dev — 2026-07-30 · PR #59
Corrige a PR #58 (@menção em checklist): funcionava ao editar um item já
existente, mas não ao **criar** um item novo — achado numa validação real
(digitar "@" no campo "Novo item..." não abria dropdown nenhum). Causa:
`initMentionDropdown(addInpId)` era chamado antes do `<input>` estar
anexado à árvore do documento (`document.getElementById()` volta `null`
nesse ponto, então a função saía sem fazer nada, silenciosamente) — corrigido
chamando depois de `w.appendChild(sec)`. Confirmado com o mesmo harness
Playwright, testando especificamente o campo de novo item (dropdown abre ao
digitar "@", Enter com dropdown aberto não submete o item, Enter/clique
"+ Add" depois de escolher a menção funciona normalmente).

### v8.30.214-dev — 2026-07-30 · PR #58
Adiciona @menção (pessoa ou agente de IA) nos itens de checklist — pedido do
time, mesmo mecanismo que já funciona em descrição/comentário/PO.

- Item de checklist agora guarda o texto cru em `data-raw` e renderiza via
  `renderMd()` no modo leitura (menção vira chip clicável com tooltip,
  agente de IA ganha 🤖, igual em qualquer outro lugar do app).
- Edição trocou de `contenteditable` pra uma `<textarea>` real que entra/sai
  do DOM a cada clique — só assim dá pra reaproveitar `initMentionDropdown()`
  (autocomplete de `@nome`/`@sigla`/`@card:`, mesmo dropdown já usado em
  descrição/comentário/PO) sem duplicar toda aquela lógica, já que ela
  depende de `.value`/`.selectionStart`, que `contenteditable` não tem.
- `getCL()` ganhou um fallback: se o autosave (disparado por OUTRO campo,
  ex.: Título) cair bem no meio de uma edição de item ainda não commitada,
  lê o valor ao vivo da `<textarea>` em vez de simplesmente não achar
  `.cl-it` (que teria sido trocado pela textarea) e descartar o item do
  save silenciosamente — achado e testado antes de subir, com harness em
  Playwright simulando clique → editar → autosave no meio → Escape/Enter/
  blur, confirmando que nenhum cenário perde texto nem duplica o save.
- Hook central de notificação (`saveCard`) passa a escanear
  `card.checklist` também, junto com desc/po/blockerReason/descsExtra.

### v8.30.213-dev — 2026-07-30 · PR #57
Corrige o dropdown "Tt" da PR #56 (tamanhos de texto na Descrição): usava
`<select>` nativo, e a LISTA aberta de um `<select>` é renderizada pelo
sistema operacional/navegador, fora do alcance do CSS do app — ficava
branca, destoando completamente do tema escuro (achado numa validação real).
Trocado por um dropdown custom (botão + menu absolutamente posicionado),
mesmo padrão visual já usado no dropdown de `@card:` (`.link-dropdown`/
`.link-option`) — fecha ao clicar fora ou ao escolher uma opção.

### v8.30.212-dev — 2026-07-30 · PR #56
Três pedidos do time, todos só no modal do card:
- **Checklist difícil de selecionar com o mouse**: `d.draggable=true` era
  aplicado no item inteiro desde a criação, então qualquer gesto de
  clicar-e-arrastar no texto virava drag nativo do navegador em vez de
  seleção — só dava pra selecionar clicando dentro e usando Ctrl+A. Agora só
  a alcinha ⠿ arma o drag (mousedown/touchstart), igual ao padrão já usado
  em `renderColCfgSubPrio()`.
- **Botão "copiar checklist"**: 📋 no cabeçalho da seção Checklist —
  copia todos os itens de todos os grupos (`[x]`/`[ ]` + texto, agrupado por
  título) pro clipboard em texto puro, pra colar em outro lugar (Slack,
  outro card) sem precisar selecionar item por item.
- **Atalho "ir para Descrição"**: botão ⬇️ fixo no cabeçalho do modal (que
  já é `position:sticky`) — rola suave até o campo Descrição, que fica no
  meio do modal e é muito usado pelo time.
- **Tamanhos de texto na Descrição (principal e adicionais)**: dropdown "Tt"
  no início da barra de formatação (Texto normal / Título 1 / 2 / 3),
  inspirado no Trello (referência anexada pelo time). A sintaxe markdown
  (`#`/`##`/`###`) e a renderização já existiam (`renderMd()`,
  `_mdToExportHtml()`) desde a função de copiar com formatação — só faltava
  um jeito de inserir sem digitar na mão. Só 3 níveis (não os 6 do Trello),
  que é até onde a renderização já sabe desenhar; dá pra estender depois se
  fizer falta. Comentários (`m-comment-inp`, edição de comentário) ficaram
  de fora de propósito — não foi pedido pra eles.

Só landing no dev — aguardando validação antes de promover pra prod.

### v8.30.211-dev — 2026-07-30 · PR #54
Corrige o mesmo bug de ícone quebrado achado e corrigido na PR #53 pro push
(`firebase-messaging-sw.js`/`functions/index.js`), agora na notificação
nativa do navegador (`Notification`) de lembrete de reunião: `/favicon.ico`
nunca existiu neste repo (o ícone real do app é inline/data-URI), sempre
deu 404 silencioso — ícone genérico em vez do logo. Trocado por
`marinheiro.png` (arquivo estático real). Só landing no dev — aguardando
validação antes de promover pra prod.

### v8.30.191-dev — 2026-07-24 · PR #16 · tag `kanban_dev-v8.30.191-dev`
Restaura o sistema híbrido humano+agente de IA que tinha sido apagado por
acidente no commit `ea180cc` (22/07, edição direta pelo GitHub sem PR) — a
correção da lista de squads do dev arrastou junto ~2000 linhas de uma
feature que só existia lá. `functions/agente-agil/board.js` continua com
`SQUAD_ID='ecomm'` fixo, ou seja, a Cloud Function do Agente Ágil já
escrevia cards nesse squad enquanto o board tinha perdido a capacidade de
mostrar/gerenciar esses cards como "de agente". Restaurado e integrado ao
estado atual do arquivo:
- Botão de 3 visões no header (👤 Humanos / 🤝 Híbrido / 🤖 IA), só
  aparece em squads com agentes cadastrados.
- Campo "Executor" (Humano/Agente/Híbrido) + status do agente no modal do
  card, chip visual no card, filtro dedicado.
- Identidades de agente (`agentes[]`/`allIdentities()`) integradas em
  menções, dropdown de `@`, seletor de responsável/participante, avatares
  de card e comentário.
- Ciclo humano-agente: validar/devolver trabalho do agente (com
  comentário de sistema) + painel de simulação client-side pra ensaiar o
  fluxo antes de plugar agentes reais.
- Não restaurado (por escolha): dados de seed/demo fictícios — só a
  mecânica.

### v8.30.190-dev — 2026-07-24 · PR #12 · tag `kanban_dev-v8.30.190-dev`
Dropdown de `@`menção/`@card:` na descrição principal passa a medir a
posição real do cursor e abrir ali, em vez de sempre no rodapé do campo
(bug visível em campos longos, como a descrição principal de 12 linhas).

### v8.30.189-dev — 2026-07-24 · PR #11 · tag `kanban_dev-v8.30.189-dev`
- Título de card com uma palavra só muito longa (sem espaço) agora quebra
  linha.
- Corrige board abrindo vazio às vezes logo após o login: `fbLoadAll()`
  agora só roda depois de confirmar usuário autenticado de verdade, não só
  o SDK do Firebase pronto.

### v8.30.188-dev — 2026-07-24 · PR #9 · tag `kanban_dev-v8.30.188-dev`
Ativa o dropdown de `@`pessoa/`@card:` no campo de descrição adicional —
nunca tinha sido inicializado ali (`initMentionDropdown()` só era chamado
pra descrição principal, PO e comentário).

### v8.30.187-dev — 2026-07-24 · PR #8 · tag `kanban_dev-v8.30.187-dev`
- Menção em descrição adicional (`descsExtra`) passa a disparar
  notificação — nenhum ponto do código chamava `parseMentions()` pra esse
  texto antes.
- Corrige perda silenciosa de autosave: `fbSaveCard()` sem `.catch()` em
  `scheduleAutoSave()`/`saveExtraDesc()`/`toggleCardOKR()` deixava falha de
  escrita (rede instável, sessão expirada) completamente muda — a tela
  mostrava "salvo" mas o Firebase não recebia, e a sincronização seguinte
  sobrescrevia tudo sem aviso. Adicionado `_saveCardWithRetry()` (tenta de
  novo 1x, avisa com toast se falhar as duas vezes).

### v8.30.186-dev — 2026-07-24 · PR #7 · tag `kanban_dev-v8.30.186-dev`
- Notificações: dedup de `@`menção (parava de renotificar a mesma menção
  antiga em todo save subsequente); clique na notificação navega entre
  squads e reabre o card certo (com retry se o board ainda não sincronizou).
- Corrige link de card errado (`[[CARD:...]]` agora passa por
  `openCardMention()`, que respeita alterações não salvas).
- Corrige iniciais duplicadas pra mesma pessoa (typo `c.participantes` →
  `c.participants` na migração).
- Corrige participantes sumindo de cards.
- Lembrete de acesso ao colar link do Google (Docs/Sheets/Slides/Drive).

## Service Worker — `firebase-messaging-sw.js` (raiz do domínio, sem versão própria em `version.json`)

### 2026-08-12 — `/vendor/` também excluído do cache do SW (o bug nunca foi o gstatic.com)
A vendorização do SDK do Firebase (v8.30.412-dev de `kanban-dev.html`)
não resolveu o `query is not defined` reportado — mesmo com ctrl+F5,
mesma versão confirmada. Investigando o Network tab da pessoa afetada,
achado o motivo real: a requisição de `vendor/firebase-10.14.1/
firebase-database.js` aparecia com `Initiator: firebase-messaging-sw.js`
— o **próprio Service Worker** intercedendo. A exclusão anterior
(entrada de 2026-08-12 acima) só cobria `gstatic.com` — como o arquivo
vendorizado é MESMA ORIGEM, não caía em nenhuma das exclusões, e caiu
de volta na mesma estratégia cache-first arriscada (`cached || fresh`)
que causou o problema original com gstatic.com. Ou seja: a causa nunca
foi "gstatic.com" especificamente, foi a própria camada de cache do
nosso SW ser vulnerável a um primeiro fetch corrompido virar
permanente — trocar a origem do arquivo (CDN → mesmo domínio) não
resolve isso sozinho enquanto o SW ainda intercepta o caminho novo.

**Fix**: `/vendor/` entra na lista de exclusão (path, não domínio —
é same-origin). `CACHE` (`v3` → `v4`) pra purgar qualquer cópia ruim
do SDK vendorizado que já esteja presa no Cache Storage de quem já
passou por isso nesse meio-tempo.

### 2026-08-12 — `gstatic.com` exclu­ído do cache do SW (achado real: `query is not defined` em rede doméstica)
Reportado como `Uncaught ReferenceError: query is not defined` em
`_refreshComunicados()` — mesmo com hard refresh, aba anônima e fora
de rede corporativa (usuária confirmou "to na rede de casa"). O
próprio código estava correto (conferido byte a byte contra o `main`
no GitHub, e o `query` exportado normalmente pela lib — confirmado
via `import()` manual no console). O que diferenciava os dois testes:
o `import()` manual rodou DEPOIS do carregamento da página, batendo
num cache que o próprio SW já tinha corrigido em segundo plano nesse
meio-tempo — clássico sintoma da corrida na estratégia cache-first
abaixo (`cached || fresh`): a cópia ruim/incompleta cacheada é servida
NA HORA pro `<script type="module">` da página (que trava com o
`ReferenceError`), enquanto o fetch "fresh" concorrente já reescreve o
cache em background, tarde demais pra aquele carregamento.

**Fix**: `gstatic.com` (onde vive o SDK modular do Firebase, importado
em `kanban.html`/`kanban-dev.html`) entra na mesma lista de exclusão
de `firebaseio.com`/`googleapis.com`/`workers.dev` — para de passar
pela nossa camada de cache. É uma URL versionada e imutável
(`.../10.12.0/...`), o cache HTTP nativo do navegador já lida com ela
sem o risco extra da nossa reimplementação. `CACHE` (`v2` → `v3`) pra
purgar, no próximo `activate`, qualquer cópia ruim que já esteja presa
no Cache Storage de quem já passou por isso.

### 2026-07-29 · PR #53
Corrige push em iOS ainda levando pra 404 mesmo depois do fix da PR #36:
aquele fix trocou a URL absoluta (`/kanban.html`) por uma relativa
(`kanban.html`), confiando que o navegador resolve a partir de
`self.location` do Service Worker (que roda em `/hering/`) — funcionava no
desktop, mas usuárias em iOS reportaram o mesmo 404 (`caiosoares1899.github.io/kanban.html?...`,
sem `/hering/`), sinal de que o Web Push do iOS tem bug conhecido resolvendo
URL relativa dentro do Service Worker. Trocado por URL **totalmente
qualificada** (com esquema+domínio) tanto no payload do push
(`functions/index.js`) quanto no fallback do `notificationclick` — elimina
qualquer dependência de resolução de URL pelo navegador, em qualquer
plataforma. De quebra, corrigido também `icon`/`badge` da notificação
(`/favicon.ico` nunca existiu neste repo — sempre deu 404 silencioso,
ícone genérico em vez do logo do app); agora apontam pra `marinheiro.png`
(arquivo estático real) com URL completa também.

### CACHE v2 — 2026-07-24 · PR #14
Corrige o SW servindo HTML/`version.json` desatualizados: a estratégia
stale-while-revalidate cacheava as páginas HTML e o `version.json`, o que
mascarava o próprio mecanismo de auto-update do app (página e
`version.json` podiam vir do mesmo cache velho, sem detectar divergência
nenhuma). HTML (navegação) e `version.json` agora vão network-first; o
resto (imagens, libs de terceiros) continua como antes. Bump de `CACHE`
(`v1` → `v2`) pra purgar cache antigo salvo com a estratégia anterior.

## Cloud Function — `weeklyBackup` (`functions/backup/weeklyBackup.js`, sem versão própria em `version.json`)

### 2026-08-12 — Nova function: backup semanal automático de cada squad
Pedido direto, depois de validar o sistema de backup existente e criar a UI
de restauração: "já que agora temos uma fatia gratuita no storage, por que
não criamos uma função de baixar o backup semanalmente de cada squad e
colocar lá (excluindo o backup antigo)". O backup que já existia
(`saveSnapshotToFirebase()` em `kanban-dev.html`) só roda se alguém abrir o
board e clicar, ou deixar a aba aberta 7+ dias com e-mail configurado — na
prática pode passar semanas sem gerar nada se ninguém mexer no board. Essa
function roda sozinha, sem depender de ninguém.

- `onSchedule`, todo domingo 04:00 (horário de Brasília) — cadência
  deliberadamente baixa (~4-5 invocações/mês). Ver o comentário em
  `functions/index.js` sobre `spotifySync` ter sido pausado por rodar
  24h/dia (43mil invocações/mês) e custar acima do esperado — esse aqui é
  ordens de grandeza mais barato, fica bem dentro do free tier tanto do
  Cloud Scheduler quanto de invocações do Cloud Functions.
- Itera os squads de produção (3 fixos + o que estiver em
  `kanban/squads_meta`, excluindo os squads fictícios `dev`/`omnichannel`)
  e salva um JSON em `backups/{squadId}/{data}.json` no Cloud Storage.
- Formato do JSON é o MESMO de `exportBackupJSON()`
  (`{version, squad, exportedAt, exportedBy, board: {cards, columns, tags,
  ...}}`) — de propósito, pra um backup salvo por aqui poder ser
  restaurado direto pela UI "🧯 Restaurar backup" do board, sem conversão.
- Retenção via `storage-lifecycle.json` (mesmo mecanismo já usado pros
  relatórios do Agente Ágil): apaga automaticamente qualquer coisa em
  `backups/**` com mais de 60 dias (~8-9 backups semanais mantidos por
  squad) — sem precisar reimplementar poda manual dentro da function.
- `storage.rules` ganhou uma entrada pra `backups/**`: leitura liberada
  pra qualquer `@ciahering.com.br` autenticado (pra poder baixar um
  backup antigo direto do console se precisar), escrita bloqueada pro
  cliente (só a Cloud Function grava, via Admin SDK).
- **Requer deploy manual, feito pela pessoa com acesso ao Firebase CLI**
  (não é automático como o GitHub Pages):
  ```bash
  firebase deploy --only functions:weeklyBackup
  firebase deploy --only storage
  gsutil lifecycle set storage-lifecycle.json gs://hering-onboarding.firebasestorage.app
  ```

## Cloud Function — `sendPushOnNotification` (`functions/index.js`, sem versão própria em `version.json`)

### 2026-08-12 — `intake` entra em PUSH_TYPES
`PUSH_TYPES` ganha o tipo `'intake'` — notificação de pedido novo (ver
seção de `intakeSubmit`) agora também vira push, não só sino 🔔.
**Requer `firebase deploy --only functions` manual.**

### 2026-07-29 · PR #53
Mesmo fix descrito na seção do Service Worker acima: URL do deep-link do
push passa a ser totalmente qualificada
(`https://caiosoares1899.github.io/hering/kanban.html?...`) em vez de
relativa — corrige 404 persistente em iOS. **Requer `firebase deploy
--only functions` manual.**

### 2026-07-27 · PR #36
Corrige o link do push levando pra fora do site: a URL do deep-link do
card era montada como `/kanban.html?...` (absoluta a partir da raiz do
domínio), mas o site fica em `caiosoares1899.github.io/hering/`, não na
raiz — todo clique num push caía em 404
(`caiosoares1899.github.io/kanban.html`, sem `/hering/`). Tirada a barra
inicial (URL relativa) tanto na Cloud Function quanto no fallback do
`firebase-messaging-sw.js`. **Requer `firebase deploy --only functions`
manual** (feito no mesmo dia) — pushes entregues antes do redeploy mantêm
o link antigo quebrado.

## Cloud Function — `intakeSubmit` (`functions/intake/submit.js`, sem versão própria em `version.json`)

### 2026-08-12 — Remove debug temporário: notificação confirmada funcionando
Confirmado pelo usuário ("fiz um novo pedido e funcionou!") — os testes
anteriores que voltavam `null` eram de pedidos feitos antes do deploy
da versão com `notifySquadMembers()` valer, não um bug de verdade.
`notifySquadMembers()` volta à forma limpa, sem o "recibo" de
diagnóstico em `kanban/squads/{squad}/dados/_intake_notify_debug`
(gravado só pra achar a causa, entrada abaixo). **Requer
`firebase deploy --only functions` manual** pra tirar a gravação de
debug da versão em produção (o nó `_intake_notify_debug` já escrito
antes deste deploy fica órfão no banco, inofensivo, e pode ser
apagado manualmente se quiser).

### 2026-08-12 — Debug temporário: notificação deployada mas não chegando
Testado após o deploy da entrada anterior — pedido é gravado
normalmente, mas nenhuma notificação aparece pra ninguém do squad.
Sem acesso aos logs da Cloud Function pra ver o erro de verdade,
`notifySquadMembers()` ganhou um "recibo" de diagnóstico, gravado em
`kanban/squads/{squad}/dados/_intake_notify_debug` a cada chamada
(sucesso ou falha) — legível via console sem precisar abrir o Firebase
Console. Mostra quantos usuários existem no total, quantos bateram
como membros do squad, e o erro exato se alguma etapa falhar. Remover
depois de achar a causa. **Requer `firebase deploy --only functions`
manual.**

### 2026-08-12 — Notifica o squad inteiro quando chega um pedido novo
Pedido direto: "vc tem q criar uma notificação para avisar aos membros
da squad q tem um intake novo". Implementado direto na function (não
no cliente) — como é um formulário público, pode chegar a qualquer
hora, sem ninguém com o board aberto pra disparar a notificação.

- Nova `notifySquadMembers()`: lê `kanban/usuarios`, filtra quem tem
  `squads[squad]===true` (mesma checagem que o cliente usa pra montar
  `members` em `kanban-dev.html`, com o mesmo fallback legado
  `inscrito:true` sem `squads`) e grava uma notificação
  (`type:'intake'`) pra cada um em
  `kanban/usuarios/{uid}/notificacoes/{id}` — o mesmo path que
  `sendPushOnNotification` (`functions/index.js`) já escuta, então
  também já dispara push (ver entrada abaixo).
- Falha ao notificar não derruba a resposta de sucesso pro demandante
  — o pedido já foi gravado de verdade antes disso, a notificação é
  best-effort.
- Sem `cardId` (o pedido ainda não virou card) — o board trata isso
  abrindo o painel de Intake ao clicar na notificação, em vez de tentar
  navegar pra um card inexistente (ver entrada de `kanban-dev.html`).

### 2026-08-12 — "Squad/time solicitante" vira lista suspensa fixa
Feedback direto logo após o primeiro teste real: campo de texto livre
tinha o "velho problema" de precisar digitar o nome certinho pra bater
com uma tag — qualquer variação (acento, abreviação, espaço) quebrava
o vínculo automático. `intake.html` trocou o `<input type="text">` por
um `<select>` com 8 opções fixas: Outlet, Omni, App, Site Hering,
MarketPlace, CX, Midia, Comercial Geral. `functions/intake/submit.js`
não mudou (continua aceitando texto, só que agora vem de uma lista
fechada no client) — não precisa de novo deploy da function por causa
desta mudança específica.

### 2026-08-12 — Descrição e squad solicitante viram obrigatórios
Pedido direto: dois campos novos/alterados no formulário (`intake.html`)
com validação também no lado do servidor, não só no client:

- **Descrição** vira obrigatória (antes era opcional).
- **Squad/time solicitante**: campo novo, texto livre, obrigatório —
  alimenta o vínculo automático de tag ao criar o card (ver entrada
  correspondente em `kanban-dev.html`).

**Requer `firebase deploy --only functions:intakeSubmit` manual** pra
a validação server-side valer de verdade (o form já bloqueia no
client sem isso, mas um POST direto à API, sem passar pelo
`intake.html`, só fica bloqueado depois do deploy).

### 2026-08-11 — corrige validação de squad rejeitando squads reais
Primeiro teste manual pós-deploy (`intake.html?squad=dados`) voltou
"link inválido ou squad não encontrado" pra um squad real e ativo.

**Causa raiz**: a function validava a existência do squad checando só
`kanban/squads_meta/{squad}.label` — mas esse nó só é populado pros
squads criados dinamicamente pelo painel (mesma leitura que
`loadSquadsFromFirebase()` faz no board); os squads originais (dados,
prf, midiacriativa...) nunca tiveram entrada lá, e o board já lida com
isso caindo num mapa fixo de labels quando `squads_meta` não cobre o
squad. A function não tinha esse fallback, então rejeitava qualquer
squad que nunca passou pelo painel — ou seja, a maioria dos squads
reais em uso.

**Fix**: existência agora é checada em `kanban/squads/{squad}/dados`
(o path base real usado por todo o board) — `squads_meta` vira
metadado opcional só pra label/emoji/cor bonitos, com fallback pro
mesmo mapa fixo do cliente quando ausente. **Requer
`firebase deploy --only functions:intakeSubmit` manual** (a versão
anterior já tinha sido deployada com o bug).

## Cloud Functions — Spotify (`functions/spotify/`, sem versão própria em `version.json`)

### 2026-07-31 · PR #116 — corrige 401 no controle de playback + bug real de cache de token
Primeiro teste real do controle de playback (PR #115) voltou 500
genérico. `detail` (mecanismo criado nos PRs #110/#112 especificamente
pra não precisar de acesso ao Cloud Logging) mostrou o real motivo:
`http_401 Permissions missing`.

**Causa raiz nº1 — inconsistência real do Spotify**: a família de
endpoints `/me/player/*` (play/pause/next) devolve `401 "Permissions
missing"` pra escopo faltando, diferente da maioria da Web API (que
devolve `403 "Insufficient client scope"` pro mesmo problema, como
vimos na Rádio do Maré). `playbackCore.js` só reconhecia o padrão 403 —
corrigido pra também reconhecer esse 401 específico e mapear pra
`insufficient_scope` (mesma mensagem amigável de sempre, "reconecte sua
conta").

**Causa raiz nº2 — bug real, mais importante**: o usuário confirmou que
já tinha reconectado (🔁 Trocar) antes de testar, especificamente pra
ganhar o escopo novo — e mesmo assim tomou o erro de escopo faltando.
Investigado: `_accessTokenCache` (`syncCore.js`) e `_ownerTokenCache`
(`radioSuggestCore.js`) cacheavam o `access_token` em memória (~1h de
validade) só verificando o *tempo* de expiração, nunca se o
`refresh_token` usado pra gerar aquele token ainda era o mesmo salvo no
banco. Como o sync periódico (rodando a cada 30s) quase certamente já
tinha cacheado um `access_token` com o escopo VELHO minutos antes da
reconexão, o controle de playback recebia esse token cacheado — que
genuinamente não tinha o escopo novo — em vez de trocar o refresh_token
novo (já salvo no banco desde a reconexão) por um token fresco.

- **`functions/spotify/syncCore.js`**: `_getAccessToken()` agora só usa
  o cache se o `refreshToken` recebido bater exatamente com o que gerou
  o `access_token` cacheado — qualquer reconexão/troca de conta invalida
  o cache na próxima chamada, sem esperar expirar sozinho. Ao cachear
  depois de uma troca bem-sucedida, guarda o `refreshToken` já
  atualizado pra rotação (se o Spotify mandou um `refresh_token` novo
  junto) não invalidar o cache à toa no tick seguinte.
- **`functions/spotify/radioSuggestCore.js`**: mesmo fix em
  `_getOwnerAccessToken()` — agora lê o `refresh_token` atual do banco
  ANTES de decidir se o cache serve (leitura RTDB extra, barata, garante
  correção se a conta dona da Rádio do Maré um dia trocar/reconectar).
- **`functions/spotify/playbackCore.js`**: passou a persistir
  `refresh_token` rotacionado no banco quando o Spotify manda um novo
  durante um controle de playback — só `_syncOneUser()` fazia isso
  antes; sem persistir, o próximo tick do sync usaria um `refresh_token`
  que o Spotify já pode ter invalidado (rotação costuma ser de uso
  único), derrubando a conexão por `invalid_grant` sem motivo real.
  Também reconhece o 401 "Permissions missing" (ver acima).

Verificado com `node --test` (4 casos novos, todos nomeados "BUG DE
PRODUÇÃO CORRIGIDO" — reconexão não serve token cacheado velho, 401
"Permissions missing" vira `insufficient_scope`, rotação de
refresh_token persiste durante playback, mesmo cache-bug corrigido na
conta dona da Rádio — 128/128 no total da suíte de functions, sem
regressão em nenhum teste existente).

Deploy necessário depois do merge:
```
firebase deploy --only functions:spotifySync
firebase deploy --only functions:spotifySyncNow
firebase deploy --only functions:spotifyPlayback
firebase deploy --only functions:spotifyRadioSuggest
```
(as 4 functions que usam `_getAccessToken`/`_getOwnerAccessToken` —
`spotifyDisconnect` também importa `_shared.js` mas não usa cache de
token, não precisa redeploy por causa deste fix especificamente, mas
não custa incluir se for redeployar tudo de uma vez.)

### 2026-07-31 · PR #113 — fechamento: integração validada em produção
**Rádio do Maré (Nível 1) confirmada funcionando ponta a ponta em
produção**: conta dona conectada, playlists Geral + squad registradas,
busca funcionando, sugestão de música funcionando (depois do fix do PR
#112) — faixa sugerida apareceu de verdade na playlist real do Spotify.
Considero a integração completa como um todo — "ouvindo agora" (PRs
#105–#108) + Rádio do Maré (PRs #109–#112) — funcionalmente encerrada
com boa confiança.

- Removido o log temporário da requisição exata (URL/headers/body do
  `POST /playlists/{id}/items`), adicionado no PR #111 só pra descartar
  problema de forma antes de achar a causa raiz real (migração de
  endpoint, PR #112) — TODO marcado, cumprido agora que o fix foi
  validado em produção. O diagnóstico de propriedade (dono do token vs.
  dono da playlist, PR #110) continua no código — é uma checagem
  legítima de erro, não instrumentação temporária.
- **`functions/spotify/README.md`** (novo): visão consolidada das duas
  funcionalidades (arquitetura, RTDB, deploy, testes) + os 3 gotchas
  reais encontrados em produção (cascata de regras RTDB, allowlist do
  Developer Mode, migração `/tracks` → `/items`) num lugar só, pra quem
  mexer nisso no futuro não ter que garimpar em 9 PRs de changelog pra
  montar o quadro completo.

**Pendências conhecidas, fora de escopo desta v1** (não bloqueiam o
fechamento, só registradas pra continuidade futura):
- Function agendada de sync do "ouvindo agora" já roda todo minuto — ok.
- Rádio do Maré não tem histórico/log de quem sugeriu o quê (decisão
  deliberada: moderação livre total, sem auditoria, nesta v1).
- Botão "🎙️ Ir pra rádio" (extensão automática de sugestões do Spotify)
  segue fora de escopo — sem URL/URI documentada confiável encontrada.
- Conta dona da Rádio do Maré é pessoal, não institucional (não existe
  conta da Hering disponível ainda) — migrar pra uma conta institucional
  no futuro é só reconectar `spotifyRadioOwnerCallback` com a nova
  conta, sem mudança de código.

### 2026-07-31 · PR #112 — causa raiz DEFINITIVA do 403 (a nota abaixo estava incompleta)
A allowlist "Users and Access" (nota abaixo) era real e precisava ser
corrigida, mas **não era a causa completa** — o 403 continuou
idêntico mesmo depois de cadastrar a conta na allowlist e reconectar
com um token novo (confirmado pelo prefixo do token mudando). Um
diagnóstico adicional (log comparando dono do token vs. dono da
playlist, ambos "Caio Soares") também descartou mismatch de conta.

**Causa raiz real**: a Web API do Spotify migrou
`POST /playlists/{id}/tracks` pra `POST /playlists/{id}/items` em
fevereiro/2026, com cutover pra apps em Development Mode em 9/mar/2026
— depois disso, o endpoint antigo (`/tracks`) passa a devolver 403
Forbidden genérico pra QUALQUER chamada, mesmo com token, escopo e
allowlist certos. `radioSuggestCore.js` ainda usava `/tracks` (escrito
antes dessa migração ser conhecida). Migração afeta os 4 métodos
(GET/POST/PUT/DELETE) desse sub-recurso — `radioSuggestCore.js` só usava
o `POST`, foi o único ponto a corrigir no projeto.

Formato do corpo (`{"uris": [...]}`) não mudou — só o path. Resposta de
sucesso é `201` (não `200`), mas o código já tratava isso certo desde
sempre (checa `res.ok`, que é `true` pra qualquer 2xx — nunca comparou
com `status===200` em lugar nenhum).

O diagnóstico de propriedade (dono do token vs. dono da playlist,
adicionado num PR anterior) continua no código — não foi a causa desta
vez, mas é uma checagem legítima que pode ajudar num problema futuro
diferente. O log temporário da requisição exata (URL/headers/body) foi
o que permitiu montar o quadro completo antes de decidir a correção —
mantido por enquanto, com um TODO pra remoção depois que o fix for
validado em produção.

**Lição pra próxima vez que um endpoint do Spotify voltar 403 do nada,
com token/escopo/allowlist aparentemente certos**: conferir primeiro se
o endpoint em si não foi renomeado/migrado — `developer.spotify.com/
documentation/web-api/references/changes/` lista as mudanças por mês.

### 2026-07-31 · nota operacional (sem PR de código — achado ao investigar um bug)
**Spotify Developer Mode exige allowlist manual de usuários, ou toda
chamada de escrita à Web API volta 403.** Achado ao investigar o 500 da
Rádio do Maré (`spotifyRadioSuggest`) na primeira sugestão real de
música: os logs mostraram `add_track_failed: http_403 {"error":
{"status": 403, "message": "Forbidden"}}` — token válido, escopo
correto (`playlist-modify-public`/`playlist-modify-private`), mesmo
assim negado.

Causa raiz: desde fevereiro/2026, apps do Spotify em "Development Mode"
(o modo padrão de qualquer app novo, incluindo o nosso "Maré Digital")
ficam limitados a um máximo de 5 usuários autenticados — cadastrados
manualmente em **Spotify for Developers → seu app → "Users and Access"**
— e qualquer usuário fora dessa lista recebe 403 em endpoints de
escrita, independente de token/escopo estarem certos. Resolvido
adicionando o e-mail da conta dona da Rádio do Maré nessa lista, fora
do repo (configuração no painel do Spotify, não código).

**Isso vale pra QUALQUER conta que vá se autenticar no nosso app
Spotify com permissão de escrita** — a conta dona da Rádio do Maré já
foi cadastrada, mas se essa conta mudar no futuro (ver design de
"gestão de conta" no PR #106, aplicado à conta pessoal do "ouvindo
agora" — a conta da Rádio do Maré, sendo única e fixa, não tem esse
mesmo fluxo de troca automática), a nova conta precisa ser adicionada
manualmente na allowlist antes de funcionar. Vale desconfiar de 403 aqui
primeiro, antes de investigar código.

De passagem, uma segunda pista foi investigada e descartada como causa
deste erro: o mesmo changelog de fevereiro/2026 da Web API também
removeu/substituiu alguns endpoints escopados por `users/{user_id}`
(ex.: `POST /users/{user_id}/playlists` → `POST /me/playlists`,
`GET /users/{id}`, `GET /users/{id}/playlists`). Conferido: nenhum
desses aparece em `oauth.js`, `radioOwnerCallback.js`, `disconnect.js`,
`sync.js`/`syncCore.js`, `radioSearch.js`/`radioSearchCore.js` ou
`radioSuggest.js`/`radioSuggestCore.js` — todos usam `/me/...` (quando
aplicável) ou endpoints escopados por playlist/faixa diretamente, nunca
`/users/{id}/...`. Não era a causa, e não há nada a corrigir por esse
lado por enquanto — só fica registrado aqui caso alguém precise cruzar
essa informação de novo no futuro.

## painel.html / painel-dev.html

### painel.html — 2026-08-11 · rascunho de comunicado (sem bump de versão)
Adicionada 1 entrada em `COMUNICADO_RASCUNHOS_SEED`
(`seed_fase1a5_otimizacao_mobile_tema_features_2026_08_11`) resumindo
pro time o lote grande promovido em kanban.html v8.30.240 (performance,
mobile, tema claro, Meu Dia, aging, quick-add, CFD/Burndown, intake,
capa de card com imagem, indicador de offline) — aparece pro ADM
revisar em Pessoas → 📢 Comunicados → Rascunhos. Conteúdo apenas, sem
mudança de código/UI — não bumpa versão do painel.

### painel.html / painel-dev.html — 2026-08-11 · loadUsoData reativado (sem bump de versão)
Fase 1.5 (ver kanban-dev.html v8.30.370-dev): "Engajamento & Uso Efetivo"
(aba Status) reativado, lendo `dados/access_stats` (agregado, leve) em vez
do `access_log` bruto antigo. Mensagem de erro de permissão atualizada
pra citar o path novo.

### painel.html / painel-dev.html — 2026-08-11 · delLembretePainel apaga só o item (sem bump de versão)
Fase 1.3 (ver kanban-dev.html v8.30.368-dev): lembretes de squad passaram a
ser gravados como filhos individuais (`/lembretes/{id}`), não mais um array
regravado inteiro a cada mudança. `delLembretePainel()` (apagar lembrete de
qualquer squad, na visão do ADM) ajustado pra apagar só o item — reescrever
o array inteiro, como antes, apagaria de volta qualquer lembrete adicionado
depois do snapshot local de `squadData` no painel.

### painel.html — 2026-08-11 · gcal_cache_meta tocado em toda escrita (sem bump de versão)
Rodada de otimização (Fase 1.2, ver kanban-dev.html v8.30.367-dev):
kanban(-dev).html passou a ler o cache global de Google Agenda
(`kanban/painel/config/gcal_cache`) sob demanda, via `gcal_cache_meta`,
em vez de listener direto no nó cheio. `painel.html` já tocava o meta na
busca principal (`carregarPcalAgendasGlobais`); passou a tocar também
nos outros 3 pontos que escrevem esse cache (purga imediata ao remover
agenda global, lista de agendas vazia, dedup manual de duplicatas via
`_touchPcalCacheMeta()`) — sem isso essas escritas ficariam invisíveis
pros clientes do board sob o novo esquema de leitura. Puramente interno,
sem mudança de UI.

### painel.html — 2026-08-10 · rascunhos de comunicado (sem bump de versão) #2
Adicionadas 2 entradas em `COMUNICADO_RASCUNHOS_SEED`
(`seed_filtro_supercard_e_barra_filtros_2026_08_10`,
`seed_tema_claro_mais_escuro_2026_08_10`) sobre o filtro de Supercards
+ barra de Filtros reorganizada (kanban.html v8.30.237) e a variante
mais escura do tema claro por duplo-clique (v8.30.238). Conteúdo
apenas — não bumpa versão do painel.

### painel.html — 2026-08-10 · rascunho de comunicado (sem bump de versão)
Adicionado 1 entrada em `COMUNICADO_RASCUNHOS_SEED`
(`seed_legibilidade_tema_claro_2026_08_10`) sobre o lote de
legibilidade do tema claro (kanban.html v8.30.233) — aparece pro ADM
revisar em Pessoas → 📢 Comunicados → Rascunhos. Conteúdo apenas,
sem mudança de código/UI — não bumpa versão do painel.

### painel.html v2.98 · painel — 2026-08-09 · INCIDENTE: reconstrução da promoção v2.97
**O que aconteceu**: a promoção anterior (v2.97, "mapeamento real de
gerência") usou patch bruto do diff `painel.html`/`painel-dev.html`
inteiro. Além dos rascunhos de aviso (já corrigido antes daquele
merge — ver nota na entrada v2.97 abaixo), esse patch bruto também
levou pra produção uma quantidade grande de conteúdo **exclusivo do
ambiente de dev** que nunca deveria sair de lá: o banner fixo "🧪
PAINEL DEV — dados fictícios", o array `SQUADS` inteiro trocado pelas
squads fictícias (`dev`/`omnichannel`, em vez de
`dados`/`prf`/`midiacriativa`), `loadExtraSquads()` com um
`return;` que nunca carregava squads reais do Firebase, e várias
URLs de "Abrir Board" apontando pra `kanban-dev.html` em vez de
`kanban.html`. Ou seja: o painel de produção ficou, na prática,
mostrando dados fictícios e mandando quem clicasse em "Abrir Board"
pro board de teste — só descoberto porque um usuário reportou "por
que o painel prod tá aparecendo como painel dev?" com print em mãos.

**Causa raiz**: `painel.html` e `painel-dev.html` divergem de
propósito em vários pontos (instrumentação de debug, paths `_dev`,
squads fictícias — ver CLAUDE.md) — um diff/patch do arquivo inteiro
não distingue "isso é uma feature nova que deveria ir pra prod" de
"isso é conteúdo que só faz sentido em dev". O erro já tinha
acontecido uma vez nessa mesma promoção (rascunhos de aviso) e foi
corrigido antes do merge, mas o escopo real do problema era maior do
que percebido naquele momento — a correção anterior tratou só o
sintoma que eu tinha visto, não auditou o resto do diff.

**Correção**: reconstruído a partir do último commit conhecido bom
antes da promoção (`e25876b`), reaplicando manualmente só as duas
features legítimas (filtro de gerência com mapeamento real + aba
Insights agregados) e os rascunhos de aviso — sem trazer nada mais
do diff bruto. Validado com `node --check`, chaves CSS balanceadas, e
um diff linha-a-linha contra esse commit-base confirmando que a
mudança final é exatamente as 2 features + versão + seeds, nada mais.

**Lição pro processo**: promoção de `painel.html`/`painel-dev.html`
não pode mais usar `diff arquivo-inteiro` + `patch` como faz com o
par kanban (que não diverge estruturalmente do mesmo jeito) — precisa
ser feature por feature, copiando os blocos específicos.

### painel.html v2.98 · painel — 2026-08-09 · atualiza rascunho de aviso do supercard
Atualiza o texto do rascunho `seed_supercard_fanout_2026_08_09`
(`COMUNICADO_RASCUNHOS_SEED`) mencionando o vínculo de filho da
receita com Modelo (kanban.html v8.30.232), junto com o resto do lote
já descrito no rascunho.

### painel.html v2.97 · painel — 2026-08-09 · promove pra prod (mapeamento real de gerência)
Promove pra produção o lote validado em `painel-dev.html` (v2.96 a
v2.98): filtro "Ver por gerência" (👔) e a aba "💡 Insights" agregados
por squad/gerência na Visão Geral.

- 👔 **Mapeamento REAL de gerência** (substitui o placeholder
  `dev`/`omnichannel` usado só pra testar a mecânica em
  `painel-dev.html`): Gerência Marketing de Performance = Squad
  Criativa (`midiacriativa`) + Squad Marketing de Performance
  (`prf`); Gerência Digital = Squad Dados e IA (`dados`); Gerência
  Comercial = catch-all (hoje vazia, já que as 3 squads existentes
  estão todas mapeadas — qualquer squad nova criada depois cai
  automaticamente aqui, sem precisar editar nada).
- 💡 Aba **Insights** dentro da Visão Geral, somando as squads
  atualmente visíveis (respeita o filtro de squad/gerência acima):
  prioridade, carga por responsável, riscos, OKR por coluna, aging e
  submarca — zero leitura nova do Firebase.
- 📢 **Rascunho de aviso do supercard** semeado em
  `COMUNICADO_RASCUNHOS_SEED`, junto com o resto do lote de kanban.html
  v8.30.231.
- ⚠️ Nota interna: a 1ª tentativa de aplicar este diff (patch bruto do
  `painel-dev.html`) trocou `COMUNICADO_RASCUNHOS_SEED` inteiro pelo
  array de dev (que tem só um rascunho de teste) — `painel.html` e
  `painel-dev.html` mantêm rascunhos DIFERENTES de propósito (prod
  guarda o histórico real de avisos; dev só tem um de teste), então
  esse campo nunca deveria ter entrado no diff de promoção. Corrigido
  antes do merge — os 8 rascunhos reais de `painel.html` foram
  restaurados, mais o novo do supercard.

### painel.html v2.96 · painel — 2026-08-09 · rascunho de aviso (promoção do kanban v8.30.230)
Adiciona ao `COMUNICADO_RASCUNHOS_SEED` o rascunho de aviso pra aba
💡 Insights que acabou de ir pra produção no `kanban.html`
(v8.30.230) — aparece pro ADM revisar/publicar em Pessoas → 📢
Comunicados na próxima vez que abrir o painel autenticado.

### painel-dev.html v2.98 · painel-dev — 2026-08-09
Nova seção **💡 Insights** na aba Visão, pra PO/ADM/gerente enxergar
como o board (ou a gerência) está sem precisar abrir squad por squad —
espelha o conteúdo da aba "💡 Insights" de `kanban.html` (Dados do
Board), mas somando as squads atualmente visíveis em vez de uma só.

- Reaproveita o filtro de squad/gerência já existente
  (`squadVisible()`) — um gerente vendo só a própria gerência enxerga
  os insights só das squads dela; a Visão Geral (`🏠 Todos`) soma
  tudo. Zero leitura nova no Firebase: usa só `squadData` já carregado
  pelo polling de 60s que já existia.
- Seções: cards ativos/com risco/OKR/parados (cards de resumo), donut
  de prioridade (com alerta se ≥30% estiver "Crítica"), carga por
  responsável (com alerta de sobrecarga — chaveado por squad+iniciais
  pra não misturar pessoas de squads diferentes que compartilhem
  iniciais), top 5 cards com mais riscos mapeados, top 5 cards parados
  há 1+ sprint (usando o `sprintDays` de cada squad), donut de OKR por
  coluna (agrupado por nome — squads têm ids de coluna próprios) e,
  quando pelo menos uma squad visível tem o campo de submarca ativo
  (`config/submarca_ativo`, já vinha no payload do polling, só não era
  lido), um donut "Por submarca".
- Clique num card da lista abre o modal (`openPcModal`), mesmo padrão
  já usado nas listas de Riscos/OKR do painel.
- Validado com um smoke test em Node cobrindo filtro "Todos" vs.
  gerência, não-mistura de iniciais entre squads, `mediaDono` sem
  divisão por zero, aging por squad e o fallback do donut vazio.

### painel.html v2.95 · painel / painel-dev.html v2.97 · painel-dev — 2026-08-07 · rename de squad
Renomeia a squad "Dados" pra **"Squad Dados e IA"** em todos os
lugares (cabeçalhos de tabela, cards de métrica, dropdown, array de
squads, paleta de cores) — pedido direto, aplicado direto nos dois
ambientes por ser conteúdo puro, sem risco de lógica. Mesma mudança
espelhada em `kanban.html`/`kanban-dev.html` e `maredigital.html`. O
id interno `dados` não muda.

### painel-dev.html v2.96 · painel-dev — 2026-08-07
Nova filtragem por **Gerência** (grupo de squads), pedida direto:
cada gerente precisa ver só as squads da própria gerência, isolada,
sem perder a Visão Geral.

- 👔 **Novo filtro "Ver por gerência"** na aba Visão, acima do filtro
  por squad já existente (que continua intacto — inclusive o botão
  "🏠 Todos" que já era a Visão Geral). Reaproveita o mesmo mecanismo
  de `activeFilter`/`squadVisible()` que já filtrava por squad —
  ganhou só um novo formato de valor (`ger-xxx`), então as 13
  seções que já respeitavam `squadVisible()` (online agora, cards de
  squad, riscos, lembretes, etc.) passam a respeitar o filtro de
  gerência automaticamente, sem precisar tocar em cada uma.
- Uma gerência (a "catch-all", ex.: Comercial) pode ser configurada
  sem lista fixa de squads — nesse caso é calculada como "toda squad
  que não está em nenhuma outra gerência", então uma squad nova
  criada depois cai automaticamente nela, sem precisar editar nada.
- **Neste `painel-dev.html`**, o mapeamento de gerência usa as squads
  fictícias de teste (`dev`/`omnichannel`) como placeholder só pra
  validar a mecânica do filtro — o mapeamento real (squads de
  verdade) entra na promoção pra `painel.html`.

### painel.html v2.94 · painel / painel-dev.html v2.95 · painel-dev — 2026-08-04
Achado investigando um relatório real: 3h depois de promover o fix de
banda do `kanban.html` (`fbSaveAll` com `touchedIds`, v8.30.201),
`debugFallbackLog(2)` no squad "outlet-crm" mostrou 2 eventos NOVOS de
`cache_desatualizado_demais` com `proporcao: 1` — ou seja, 100% dos 543
cards ativos apareciam como "mudados" pra quem tinha acabado de abrir o
board, não uma fração pequena (o padrão esperado de aba antiga).

Causa: duas ferramentas de admin do Painel — **"Resolver todos os
bloqueios"** (`resolveAllBlockers()`) e **"Zerar contagem de fluxo"**
(`resetSquadFlow()`) — escrevem `/dados/cards` inteiro direto no
Firebase, mas NUNCA tocavam `/dados/cards_updated_at`, o índice paralelo
que `kanban.html` usa (desde o fix de banda) pra decidir, no
carregamento em duas etapas, quais cards precisam ser rebaixados de
novo. Sem atualizar esse índice:

- Pra quem JÁ tinha esses cards em cache: o timestamp cacheado batia com
  o remoto (que nunca mudava) — o board continuava mostrando o card
  ANTIGO (ex.: ainda bloqueado, ou com o flow velho) silenciosamente,
  até um fallback completo acontecer por outro motivo.
- Pra quem tinha PARTE dos cards em cache (o caso real observado): como
  o conteúdo real mudou mas o timestamp não, o cálculo de "quanto do
  cache está desatualizado" ficava incoerente — plausível pra gerar
  exatamente esse padrão de "100% precisa buscar de novo" reportado.

**Fix:** as duas funções agora usam `update()` multi-path atômico
(mesmo padrão do `fbSaveCard()` em `kanban.html`) — gravam `/cards`
inteiro (igual antes) JUNTO com `/cards_updated_at/{id}` de cada card
realmente tocado (chave com barra = caminho profundo, não substitui o
nó inteiro, preserva os demais cards intactos).

### painel-dev.html v2.94 · painel-dev — 2026-07-31
Correções irmãs de `kanban-dev.html v8.30.241-dev` (ver entrada acima
pro contexto completo dos dois bugs de usuário externo reportados:
exclusão não pegava, adicionar externo em squad nova não dava acesso).
Do lado do Painel:

- **`toggleUserSquad()`** (checkbox de squad no modal "Usuários
  Globais") desmarcava `squads/{id}` mas nunca sincronizava o espelho
  `usuarios_publicos/{uid}` (é o que `kanban.html` lê pra listar membros
  do squad — ficava com gente removida ainda aparecendo lá) nem limpava
  a whitelist `kanban/squads/{id}/externos` correspondente (deixando a
  pessoa conseguir logar de novo mesmo sem o squad marcado). Agora
  sincroniza os dois.
- **`deleteGlobalUser()`** ("🗑 Excluir" no modal "Usuários Globais")
  apagava só `kanban/usuarios/{uid}`, deixando `usuarios_publicos/{uid}`
  órfão e a whitelist de externos intacta em toda squad que a pessoa
  frequentava — reabrindo a mesma porta de reaparecer sozinho no
  próximo login. Agora também limpa `usuarios_publicos` e a whitelist
  `externos` de cada squad que estava em `squads` da pessoa.

Testado via Playwright (4 cenários): desmarcar squad limpa os três
lugares; marcar não mexe na whitelist (comportamento correto — só
desmarcar deve limpar); exclusão total cascade em múltiplas squads; sem
crash pra usuário sem squads/email.

**Nota de escopo**: `painel-dev.html` só gerencia as squads fictícias
(`dev`/`omnichannel` — `SQUADS` fixo no código, não carrega
`squads_meta` de produção, decisão de isolamento já documentada na
entrada `v2.93` abaixo). O bug original foi reproduzido numa squad real
(`ecomm`), então a validação completa do cenário exato só é possível
depois de promover pra `painel.html`; aqui a squad `dev` cobre o mesmo
código/mesmo bug já que a lógica não depende de qual squad é.

### painel.html v2.93 · painel — 2026-07-31
Promove pra prod o fix de `toggleUserSquad()`/`deleteGlobalUser()`
validado em `painel-dev.html v2.94` (ver entrada acima) — sincroniza
`usuarios_publicos` e limpa a whitelist `kanban/squads/{id}/externos`
correspondente ao desmarcar squad ou excluir usuário global, fechando o
bug de usuário externo removido que reaparecia sozinho. Patch aplicado
seletivamente só nessas duas funções (`diff painel.html painel-dev.html`
confirmou zero diferença nelas depois) — os dois arquivos continuam
divergindo deliberadamente no resto (banner de dev, "Push manual" que só
existe em produção, etc.), como sempre.

Promovido sem validação manual prévia — a pedido direto do usuário logo
após o merge do fix pro dev.

### painel.html v2.92 · painel — 2026-07-30
Promove pra prod o fix validado no dev (`v2.93 · painel-dev`): compilado
de "🚧 Bloqueios ativos" parava de mostrar cards já resolvidos, e filtro
de squad dinâmico (inclui squads criados via painel de setup, antes
ausentes da barra de filtro). Detalhes completos na entrada de
`painel-dev.html v2.93` logo abaixo.

Promovido sem validação manual prévia no dev — `painel-dev.html` roda só
contra squads fictícios fixos, não carrega `squads_meta` de produção
(decisão deliberada de isolamento), então não tinha como reproduzir o bug
relatado (num squad real) nesse ambiente. Validação foi só automatizada
(10 cenários via Playwright, ver entrada abaixo); usuário confirmou querer
subir direto pra prod dado esse impasse.

### painel-dev.html v2.93 · painel-dev — 2026-07-30
Corrige o compilado de "🚧 Bloqueios ativos" (seção que junta os cards
impedidos de todos os squads numa lista só) — reportado pelo usuário num
squad de produção: um card já resolvido dentro do board continuava
aparecendo pra sempre nessa lista do Painel.

**Causa raiz**: `renderBlockers()`/`resolveAllBlockers()` decidiam "este
card está impedido?" com `c.col==='blocker' || (c.blocker && c.blockerReason)`
incondicionalmente — um OR que ignora o `blockerMode` do squad (coluna vs
tag, configurável por squad em `kanban.html`, ver `_cardIsBlocked()` lá,
que já tinha esse mesmo fix aplicado só no board, nunca propagado pro
Painel). Em squads no modo padrão "coluna", mover um card pra fora de
Impedimentos só muda `c.col` — os campos legados `blocker`/`blockerReason`
(usados pelo modo "tag") não são limpos nesse fluxo, então o card
resolvido continuava batendo na segunda metade do OR pra sempre. `_applySquadDados()`
agora também captura `blockerMode` de `dados/config/blockerMode` (o mesmo
path que `kanban.html` lê/escreve — **não** `dados/agil_cfg/blockerMode`,
editado no modal de config do Painel, que é um path solto sem nenhuma
leitura correspondente em `kanban.html` e por isso nunca refletia o modo
real; ficou registrado no código como achado, não mexido nesta leva).
`resolveAllBlockers()` (botão "✅ Resolver todos") ganha a mesma detecção
mode-aware, e agora limpa `blockerReason` além de `blocker` ao resolver —
evita este mesmo bug se lançar de novo caso o squad troque de modo depois.

**Filtro de squad no compilado** (pedido junto pelo usuário): o filtro por
squad já existia e já era respeitado por `renderBlockers()`
(`squadVisible()`), mas a barra de botões (`.filter-bar`) era HTML fixo
com só os 3 squads originais — squads criados depois via painel de setup
(ex.: o squad de produção que motivou o reporte) nunca ganhavam botão
nenhum, então não dava pra isolar esses squads em nenhuma seção que usa
esse filtro (bloqueios, riscos, OKR, cards do squad — não só a lista de
impedimentos). Novo `renderFilterBar()` gera os botões dinamicamente a
partir do array `SQUADS` (que já cresce com `loadExtraSquads()`),
preservando o filtro ativo ao re-renderizar.

Verificado com Playwright (10 cenários): card resolvido com campos legados
não aparece mais em modo "coluna"; card com tag em modo "tag" continua
aparecendo independente da coluna; `resolveAllBlockers()` não re-escreve
cards que não estão genuinemente bloqueados e limpa os dois campos nos que
resolve; `renderFilterBar()` gera botão pra squads extras e `setFilter()`
continua funcionando com os botões dinâmicos.

**Nota de validação**: `painel-dev.html` roda contra um conjunto fixo de
squads fictícios (`dados`/`prf`/`midiacriativa`/`omnichannel` — não carrega
`squads_meta` de produção, decisão deliberada de isolamento, ver comentário
em `loadExtraSquads()`), então não dá pra validar isso contra o squad real
que motivou o reporte usando o Painel dev — a lógica foi validada de forma
genérica (não depende de nenhum id de squad específico) e o botão novo do
squad `omnichannel` (que faltava mesmo no HTML fixo do dev) já é visível
como confirmação indireta de que `renderFilterBar()` está funcionando.

## Agente Ágil Orquestrador (`functions/agente-agil-orquestrador/`) — Fase 2

### 2026-08-18 · Quarto ajuste: notifica quem fez a @menção original
Depois de ver a resposta aparecer certinho no card, o usuário perguntou:
"não deveria me mencionar pra aparecer notificação pra mim?". Resposta:
sim — e não estava acontecendo. `comentario` só dispara notificação
quando o TEXTO da resposta tem uma @menção reconhecível (heurística
pensada pra menção humana escrevendo o texto), e a resposta do agente
normalmente não menciona ninguém — quem perguntou nunca era avisado,
mesmo sendo resposta direta a ela.

**Fix**: `processarMencao()` notifica explicitamente quem fez a @menção
original, direto por `comment.uid` (já em mãos, não precisa resolver
init), reaproveitando `buildNotifStep()` (mesmo módulo de notificações já
usado por `agente-agil` v0-v3). Mesmo esquema de id determinístico que
@menção-no-texto usa (`mention_{cardId}_{uid}`) — se o texto por acaso
também mencionar a pessoa, não duplica notificação.

2 testes novos: notifica mesmo sem @menção no texto da resposta; não
duplica em 2 chamadas com o mesmo uid/card. Suíte inteira: **181/181
passando**.

**Validado em produção**: usuário confirmou a notificação "🤖 Agente Ágil
respondeu sua menção" aparecendo no sininho. Os quatro ajustes deste dia
(path morto, resposta presa no prompt, rede de segurança, notificação)
funcionando juntos, ponta a ponta — item 4 do plano de acionamento
(@menção real) considerado validado a partir daqui.

**Requer novo deploy manual** (`firebase deploy --only
functions:agenteAgilMencao`) pra valer em produção.

### 2026-08-18 · Terceiro achado: instrução no prompt não é garantia — rede de segurança no código
Validado em produção que o fix anterior (instrução "Entrega da resposta"
em `SYSTEM_PROMPT_V1`) funciona — mas não sempre. Mesma revisão deployada
(`agenteagilmencao-00007-com`), mesmo prompt: uma pergunta explicativa
resultou em `biblioteca_agil -> comentario` (funcionou), a próxima em só
`biblioteca_agil` (voltou a falhar). Não-determinismo do LLM, não bug de
deploy nem de path — confirmado cruzando IDs/timestamps de dois testes
consecutivos na mesma revisão.

**Fix**: pedir só no prompt reduz a frequência do problema, não garante.
`processarMencao()` (`mentionTrigger.js`) ganha uma rede de segurança no
código — depois do `runLoop()`, se nenhuma chamada de `comentario`
aconteceu mas existe `finalText`, posta ele mesmo automaticamente
(reaproveitando a mesma ferramenta `comentario`, mesmo dryRun/squad/card
que o modelo usaria). Registrado no log de produção
(`FALLBACK: finalText postado como comentario...`) e no registro de
idempotência (`fallbackComentario: true/false`) pra dar pra medir com que
frequência isso dispara.

2 testes novos (fallback dispara quando devia; NÃO duplica quando
`comentario` já foi chamado pelo modelo). Suíte inteira: **179/179
passando**.

**Requer novo deploy manual** (`firebase deploy --only
functions:agenteAgilMencao`) pra valer em produção.

### 2026-08-18 · Segundo achado: resposta ficava presa no finalText, nunca virava comentario
Depois do fix do path morto (entrada abaixo), o usuário testou de novo com
2 perguntas puramente explicativas ("me explica o conceito de sprint",
"como usar cards recorrentes") — deploy ok, log aparecia
(`ferramentas: biblioteca_agil({})`, `finalText` com a resposta completa e
correta), mas nada chegava no card.

**Causa raiz**: `SYSTEM_PROMPT_V1` nunca dizia explicitamente que a
resposta final precisa virar um `comentario`. Os canários manuais sempre
funcionaram porque o TEXTO DA TAREFA em si incluía "Comenta a resposta no
card" (ex.: scripts de `biblioteca_agil`) — a @menção real passa o
comentário da pessoa literal (`mentionTrigger.js: task: comment.text`),
sem esse empurrão. Pra pergunta puramente explicativa, o modelo tratava
como "só respondendo", nunca chamava `comentario`.

**Fix**: nova seção "Entrega da resposta" em `SYSTEM_PROMPT_V1` (exceção
#5 documentada no cabeçalho do arquivo, mesmo padrão das 4 anteriores) —
deixa explícito que texto fora de uma chamada de ferramenta nunca chega
até quem perguntou, e a resposta final sempre precisa ser um `comentario`,
mesmo pra perguntas/explicações. Resolvido na raiz (prompt), não só
remendando o texto da tarefa em `mentionTrigger.js`, porque o mesmo
problema reapareceria em qualquer canal automatizado futuro (item 5 do
plano — gatilho automático em mudança de card).

Teste novo em `systemPrompt.test.js` guardando a instrução. Suíte inteira:
**177/177 passando**.

**Requer novo deploy manual** (`firebase deploy --only
functions:agenteAgilMencao`) pra valer em produção.

### 2026-08-18 · ACHADO CRÍTICO: comentário do agente escrevia num campo morto desde 11/08 — corrigido
Investigando o relato do usuário ("os comentários do agente não chegaram"
depois de destravar `dryRun:false`), achei um bug real, silencioso, sem
relação com o susto de provisionamento do trigger investigado antes.

**Causa raiz**: `outputs/comentario.js` (compartilhado por `agente-agil`
v0-v3 E pelo orquestrador) escrevia em `{cardPath}/comments/{id}` — DENTRO
do card. Esse era o modelo de dado correto até 2026-08-11, quando
`kanban-dev.html` migrou comentários pra um path próprio,
`card_comments/{cardId}/{commentId}` (Fase 1.1, comentário "comments saiu
daqui"). `outputs/comentario.js` (e `tools/lerCard.js`, que lia
`card.comments` pra reconstruir contexto) **nunca foram atualizados junto**
— ficaram escrevendo/lendo um campo que a UI não usa mais desde então.

**Por que passou batido em canário 9, 10 e na 1ª @menção real**: a escrita
em si sempre teve sucesso (é um write RTDB válido, só que pro lugar
errado) — `dryRun:false` no output, sem erro nenhum. Os checks automáticos
dos canários só conferem o output da chamada (`comentarioCall.output.dryRun
=== false`), nunca a UI de verdade. O lembrete final dos scripts ("confira
no kanban-dev.html, ao vivo, os comentários") dependia de alguém realmente
olhar — canário 9 (14/08) e 10 (15/08), ambos DEPOIS da migração de 11/08,
tiveram esse passo manual reportado como "confirmado" sem pegar o
problema. Canários 1-8 (antes de 11/08) escreviam no lugar certo pra época
e continuam válidos.

**Impacto real**: qualquer comentário escrito por QUALQUER versão do
Agente Ágil (v0-v3 via `http.js`, usado por especialista externo tipo
Databricks, E o orquestrador) desde 11/08/2026 nunca apareceu de verdade
no board — silenciosamente. `ler_card` também nunca via comentários reais
de humanos (lia do mesmo campo morto), o que enfraquecia a reconstrução de
contexto que sustenta a arquitetura de @menção sem retomada de sessão.

**Fix**: novo helper `cardCommentsPath(squadId, cardId)` em
`agente-agil/board.js`, pré-calculado em `ctx.cardCommentsPath` (mesmo
padrão de `ctx.cardPath`) — `outputs/comentario.js` usa esse valor em vez
de montar o path sozinho (importar `board.js` diretamente de dentro de
`outputs/comentario.js` criaria dependência circular, já que `board.js`
requer `./outputs` no topo — achado real: `cardCommentsPath is not a
function`). `tools/lerCard.js` passa a buscar comentários no path novo em
paralelo com as outras leituras, não mais de `card.comments`.

**Efeito colateral esperado, não regressão**: comentário sozinho não
carimba mais `card.updatedAt`/`cards_updated_at` (o path fica fora da
subárvore do card agora) — mesmo comportamento que o cliente já tinha
("comentário desacoplado de qualquer outro campo do card", ver
`kanban-dev.html`), só que o lado do agente ainda não acompanhava.

**Testes**: 3 arquivos atualizados (`sprint3.test.js`, `board.test.js`,
`squadIdParam.test.js`, `lerCard.test.js`, `realHandlers.test.js`) —
assertions que checavam o path antigo agora checam o novo, incluindo um
teste-isca (`card.comments` populado com um comentário fantasma que NÃO
deveria aparecer no resumo do `ler_card`, provando que o handler não volta
a ler dali por acidente). Suíte inteira: **176/176 passando**.

**Requer novo deploy manual** (`firebase deploy --only
functions:agenteAgilMencao`) — o binário em produção agora mesmo ainda
tem o bug, escrevendo no campo morto.

### 2026-08-18 · `agenteAgilMencao` sai do modo sombra — escrita real ligada (decisão explícita do usuário)
Decisão do usuário, no mesmo dia do deploy (ver entrada anterior): com o
mecanismo de gatilho validado rodando em produção (dispara certo, ignora
comentário próprio, respeita kill switch, detecta menção), destravar
escrita real em vez de esperar mais tempo observando em modo sombra —
`DRY_RUN_MENCAO` (renomeado de `DRY_RUN_SOMBRA`, já não fazia sentido
chamar de "sombra" com o valor `false`) vira `false` em
`mentionTrigger.js`.

Esta é a **primeira vez que o Agente Ágil escreve em produção sem humano
no terminal digitando `ESCREVER`** — a rede de segurança agora é o kill
switch dinâmico (`kanban/config/agente_agil_orquestrador/enabled`) + o
escopo travado no squad `dev` (path do trigger, não checagem em
runtime), não mais confirmação manual por invocação.

Comentários/testes atualizados pra refletir o novo estado (inclusive o
assert que travava `DRY_RUN_MENCAO===true` de propósito, pra forçar
qualquer mudança futura a ser decisão revisada, não acidente). Suíte
inteira: **176/176 passando** (mesma contagem — só assertions ajustadas,
nenhum teste novo).

**Requer novo deploy manual** (`firebase deploy --only
functions:agenteAgilMencao`, na máquina do usuário) pra o `dryRun:false`
valer de verdade — o deploy de 2026-08-18 anterior ainda está rodando
com o binário antigo (`dryRun:true`) até isso acontecer.

### 2026-08-18 · `agenteAgilMencao` deployado — 1ª @menção real processada (item 4 do plano)
Deploy real da Cloud Function `agenteAgilMencao` (item 3/4 do plano de
acionamento sem supervisão — ver README, "Próximos passos"), primeira vez
rodando fora de canário manual. Continua em modo sombra (`dryRun` fixo em
`true`), squad `dev`.

**Susto investigado, sem bug de código**: 1º comentário com "@Agente
Ágil" não gerou log nenhum; 4 minutos depois, outro comentário no mesmo
card gerou log normal. Antes de mexer em qualquer coisa, testei
`detectaMencao.js` direto contra os dois textos exatos (com acento via
dropdown de menção, sem acento digitado à mão) — os dois batem na
detecção sem problema. Explicação mais provável: atraso de
provisionamento do trigger (Eventarc/RTDB) nos minutos seguintes ao 1º
deploy, comportamento conhecido do Firebase Functions v2. Confirmado:
uma menção nova rodou normal, sem qualquer mudança de código.

Agora na fase de observação real (item 4 do plano) — rodando por um
tempo antes de decidir sobre o gatilho automático em mudança de card
(item 5) ou virar escrita real (`dryRun:false`).

### 2026-08-15 · `biblioteca_agil` validada (dryRun) + décimo canário de escrita real
Dois dryRuns reais rodados pelo usuário (`dryRunBibliotecaAgilContraSquadDev.js`):
"Recorrência automática" não confundiu com "Itens recorrentes" (explicou
a diferença certa); "Ficha técnica" acertou os campos obrigatórios/opcional
E reconheceu a própria limitação de não saber preenchê-la sozinha —
honestidade calibrada sobre capacidade, não só sobre informação.
`biblioteca_agil` foi chamada sem pedido explícito nos dois casos.

**Canário de escrita real validado**: `scripts/escritaReal10BibliotecaAgilContraSquadDev.js`
rodado pelo usuário contra squad dev real — os mesmos dois cenários com
`dryRun:false`. `biblioteca_agil` chamada sozinha nos dois casos (output
sem campo `dryRun`, confirma que nunca toca escrita), `comentario`
confirmado com escrita real escrevendo os dois comentários de verdade no
card, conteúdo idêntico em qualidade ao dryRun. `biblioteca_agil` está
validada ponta a ponta.

### 2026-08-15 · Nova ferramenta `biblioteca_agil` — conceitos ágeis + como o board funciona
Expansão pedida pelo usuário: além dos conceitos ágeis já mapeados, o
agente precisava de conhecimento prático das funcionalidades do Maré
Digital (recorrência, ficha técnica, dependências, riscos, campanhas...)
pra ajudar na tomada de decisão sobre o board em si, não só de metodologia.

**Origem do conteúdo**: extraído e organizado do `HELP_CONTENT` real de
`kanban-dev.html` (abas `agil`, `board`, `cards`, `config`,
`comunicacao`), conferido linha a linha contra o repo antes de escrever —
não é conteúdo novo, é o texto oficial já existente reorganizado pro
agente. Duplicação deliberada (mesmo precedente de `flow.js`/
`visaoBoard.js`), HTML de formatação removido (texto pra LLM, não pra
modal).

**Decisões combinadas antes de implementar**:
- **Tool sob demanda, não baked no prompt** — mesmo padrão de
  `ler_card`/`visao_board`. Corpo de texto dobra de tamanho com o novo
  grupo; baked pagaria esse custo de tokens em toda invocação, mesmo nos
  pedidos que não precisam (mover card, editar campo).
- **Um grupo só, dois sub-grupos** (`Conceitos ágeis` + `Como o board
  funciona`), não duas ferramentas/fases separadas — a linha entre
  "conceito ágil" e "feature do produto" já é nebulosa (ex.: recorrência
  automática É sobre ritmo de sprint), e um lugar só é mais simples pro
  agente consultar.
- **Sem distinção fake/real** — diferente de `ler_card`/`visao_board`,
  nunca toca o Firebase (dado 100% estático), então não precisa da mesma
  cautela de escrita. Um único handler serve os dois modos.
- **Schema vazio no v1** — sem filtro por grupo/verbete, sempre retorna
  tudo. Mesma filosofia de "simples primeiro" de `visao_board`; filtro
  fica pra v2 se o custo por chamada importar na prática.
- **Filtragem de escopo**: de 13 verbetes propostos, 1 foi reduzido
  (Compartilhar card/Milanote → só o sinal 📌 de peça vinculada, cortando
  a mecânica de copiar link, que não ajuda julgamento) e 2 foram
  acrescentados por afetarem diretamente decisão sobre o board (Supercard,
  Prazo/Submarca obrigatórios — este último documenta uma restrição que o
  próprio agente já respeita ao criar cards).

**Resultado**: `tools/bibliotecaAgil.js` (9 verbetes de conceitos ágeis +
15 de como o board funciona), registrado em `buildTools()` como
`biblioteca_agil`, `SYSTEM_PROMPT_V1` atualizado (lista de ferramentas +
linha de orientação sobre quando consultar). 6 testes novos, suíte
inteira 176/176. **Pendente**: validação do usuário rodando um cenário
real (ex.: pergunta sobre recorrência ou ficha técnica) pra confirmar que
o agente lembra de chamar a ferramenta no momento certo.

### 2026-08-15 · `visao_board` validado (dryRun risco + saudável) — achado pendente de calibração
Dois dryRuns reais contra squad dev: (1) dado "sujo" acumulado de testes
(WIP 32/12, amostra pequena) — agente identificou o risco certo e
reconheceu sozinho a amostra pequena, sem eu pedir; (2) squad limpo +
`scripts/gerarHistoricoRealistaSquadDev.js` (310 cards, 3 meses de
histórico fabricado mas coerente) — WIP 10/12, throughput 53/14 dias, a
ressalva de amostra pequena sumiu como esperado.

**Achado pendente**: no cenário saudável, o agente tratou "Em Progresso"
ser a coluna mais lenta (84h) como risco, mas isso é razoável dentro de
uma sprint de 14 dias — `SYSTEM_PROMPT_V1` não dá referência de ritmo
esperado (`agilCfg.sprintDays`) pro agente calibrar "tempo alto de
verdade" vs. "é só a etapa onde o trabalho acontece". Números batem
exatamente com o gerador — não é bug, é nuance de julgamento. Não
corrigido de propósito, aguardando mais cenários antes de decidir se
ajusta o prompt. Detalhes completos: `functions/agente-agil-orquestrador/README.md`.

### 2026-08-14 · Nova ferramenta `visao_board` — "braço de PO" do agente (aguardando dryRun local)
Pedido do usuário: além da biblioteca de conceitos ágeis (design
combinado, ainda não implementada), o agente precisa de uma visão
consolidada do board — fluxo do time, histórico de cards, números — pra
atuar em gestão e dar contexto a especialistas externos.

**Decisão combinada**: métricas FIXAS no v1 (não interpretação livre em
cima de dado bruto — mais previsível, barato e fácil de validar por
canário). Reabriu e confirmou o precedente de `agente-agil/flow.js`:
`cardTempos()`/`cardTempoPorColuna()` são réplica deliberada das
equivalentes em `kanban.html` (não módulo compartilhado — kanban.html não
tem `<script src>` externo, propriedade arquitetural do repo).

Ferramenta nova (`tools/visaoBoard.js`), sempre disponível no toolset:
WIP vs. limite por coluna, throughput, cycle/lead time (média + mediana +
amostra), gargalo por coluna (lógica genuinamente nova, o resto reaproveita
cálculo já em produção), bloqueios ativos. `periodo_dias` opcional
(default 14). `SYSTEM_PROMPT_V1` atualizado (lista de ferramentas + linha
de orientação). 15 testes novos, suíte inteira 170/170.

**Pendente**: dryRun contra squad dev (script entregue, roda só
localmente) — cruzar os números com "📊 Dados do Board" antes de fechar o
v1. Detalhes completos: `functions/agente-agil-orquestrador/README.md`.

### 2026-08-14 · Item 4 satisfeito: lote de testes deliberados via @menção
4 pedidos inequívocos (ferramenta/valor certos nomeados de propósito)
rodados pelo usuário através do gatilho — objetivo era confirmar
escrita real escolhida certa via automação, não só script CLI. Todos
passaram: `checklist_item` 2x (item certo), `editar_campos.tags`
(preservou as 5 tags existentes), e um achado de julgamento inesperado
— pedido de prioridade "alta" pausou em `perguntar_humano` porque a
prioridade atual já era "crítica" (mais alta); o modelo reconheceu que
aplicar cegamente seria um downgrade não pedido, e confirmou antes.

**Item 4 satisfeito.** Segue rodando organicamente por mais alguns dias
(bônus, não bloqueante). **Decisão sobre `dryRun:false` no gatilho:
ainda pendente, não tomada** — registrado explicitamente pra não virar
suposição por inércia.

Achado de UX, não implementado: Agente Ágil não aparece no autocomplete
de menção (`@`), e mesmo cadastrado como "agente" apareceria, selecionar
inseriria `@agente.gil` (bug de sanitização de handle removendo o "Á"
acentuado) em vez do texto que `detectaMencao.js` espera — mesma causa
raiz do ajuste já sinalizado no botão "↩ Responder". Follow-up
combinado, fora do escopo desta fase.

### 2026-08-14 · @menção v1 em modo sombra (item 3) — 1º gatilho automático, 1º deploy real
Primeiro gatilho automático do orquestrador (até aqui, 100% invocação
manual) e primeiro deploy real deste módulo como Cloud Function.

**Convenção de menção** (`detectaMencao.js`): não reaproveita o regex de
menção humana (resolve contra INIT de membro real) — o agente não tem
init de verdade. Substring `"@agente agil"` normalizada (minúsculo, sem
diacríticos). Ajuste do botão "↩ Responder" pra pré-preencher a menção
certa fica como follow-up separado (mudança em `kanban-dev.html`, outro
ciclo de deploy).

**`mentionTrigger.js`**: `processarMencao()` — anti-auto-disparo
(`comment.uid === 'agente-agil'`) SEMPRE primeiro, antes de olhar o
texto; depois checa menção, kill switch (`limits.isEnabled`), e
idempotência (mesmo padrão de `agente-agil/http.js`, agora por
`commentId`) antes de rodar o loop. Squad `dev` travado no `ref` do
trigger (literal no path, não checagem em runtime).

**MODO SOMBRA**: `dryRun` fixo em `true` — o que falta validar não é o
modelo escolhendo ferramenta certa (já provado 9x), é o MECANISMO DE
GATILHO em si. Só vira escrita real depois de observar rodando de
verdade por um tempo.

`functions/index.js` ganha o primeiro export deste módulo:
`agenteAgilMencao`. 151 testes passando (13 novos). Pendente: usuário
precisa rodar `firebase functions:secrets:set ANTHROPIC_API_KEY` e
`firebase deploy --only functions:agenteAgilMencao`.

**Deploy confirmado** (mesmo dia): secret criado, deploy completo,
`agenteAgilMencao(us-central1)` ativa em produção, rodando em modo sombra.

**Primeira execução real confirmada** (minutos depois): usuário
comentou "@Agente Ágil ..." num card do squad `dev` — log mostrou
`processado, status=done, dryRun=true`. Mecanismo de gatilho validado
ponta a ponta contra o Firebase real (não fake db): detecta menção,
checa kill switch, passa pela idempotência, roda o loop com LLM real,
sem escrever nada de verdade. Vários testes anteriores geraram
`ignorado (no_mention)`/`ignorado (disabled)` corretamente, sem custo
de API (checagens acontecem antes do LLM ser chamado).

Gap identificado, e fechado no mesmo dia: `resumirResultadoParaLog()`
formata uma linha só com ferramentas na ordem + input resumido de cada
uma + `finalText`, truncando campos longos. 4 testes novos, 155 no
total.

### 2026-08-14 · Kill switch dinâmico (item 1 do plano de acionamento sem supervisão)
Combinado com o usuário: sequência final pra ligar os dois mecanismos de
acionamento pedidos (@menção + gatilho automático) — kill switch
dinâmico primeiro, antes de QUALQUER acionamento sem humano no terminal
(não só antes do gatilho automático).

`limits.js`: `isEnabled()` deixou de ser constante hardcoded
(`KILL_SWITCH_ENABLED = false`) e virou `async isEnabled(db)`, lendo
`kanban/config/agente_agil_orquestrador/enabled` no Firebase — ADM liga/
desliga na hora, sem deploy. Fail-safe preservado: sem db, nó ausente,
erro, ou qualquer valor não-`true` → desligado.

`loop.js`: default de `enabled` mudou de `limits.isEnabled()` (não dava
mais pra usar, virou async) pra `false` puro — quem quer respeitar o
switch de verdade resolve `await limits.isEnabled(db)` antes de chamar
`runLoop()`. Nenhum canário/teste existente afetado (todos já passavam
`enabled: true` explícito). 138 testes passando (2 novos).

Também registrado no README a decisão completa de sequenciamento dos
dois mecanismos de acionamento: kill switch → escopo squad `dev` → @menção
v1 (sem retomada de sessão dedicada — reconstrução via `ler_card`, mesmo
padrão já provado no canário 9) → rodar de verdade por um tempo → só
depois gatilho automático.

### 2026-08-14 · Canário 9 CONFIRMADO: item 5 fechado, toolset completo com escrita real
Mesma tarefa do dryRun anterior (mesmo dia), agora `dryRun:false`,
toolset completo sem filtro (1º canário de escrita real sem
`TOOLS_PERMITIDAS`, incluindo `relatorio_html` tecnicamente acessível
pela 1ª vez numa escrita real).

Rodado pelo usuário: `status: 'done'`, sequência idêntica ao dryRun
(`ler_card -> checklist_item -> editar_campos -> agent_status ->
comentario`). Passou em tudo, com escrita real confirmada em cada
ferramenta — item de checklist certo marcado, `agent_status` sem se
confundir com `checklist_item`, prioridade/tag corretas via
`editar_campos`, `mover_coluna`/`link`/`relatorio_html` corretamente não
chamados mesmo disponíveis. **Item 5 do plano de próximos passos
fechado.**

### 2026-08-14 · Item 5 validado em dryRun: as 9 ferramentas juntas, sem confusão
Primeiro teste sem filtro de `TOOLS_PERMITIDAS` — todo canário/cenário
anterior restringia o toolset pro subconjunto relevante daquele teste.
Pedido composto (4 instruções, sem ambiguidade) desenhado pra forçar
`checklist_item` vs `agent_status` e a armadilha "terminei" → `mover_coluna`
(gatilho que nos cenários 3/4 levava a cogitar mover coluna).

Rodado pelo usuário (card `c1785889397211_x0xr2`, squad `dev`): passou em
tudo — item de checklist certo marcado, `agent_status` sem se confundir
com checklist, prioridade/tag corretas via `editar_campos`, `mover_coluna`
corretamente não chamado apesar da linguagem de "terminei", `link`/
`relatorio_html` não usados à toa. Extra: notou uma pergunta pendente de
uma rodada anterior sem relação com o pedido, mencionou sem agir.

Achado real, mas na verificação do próprio script, não no modelo: a
checagem automática de `checklist_item` usava os nomes de campo errados
(`texto`/`concluido`, que são o formato de SAÍDA de `ler_card` — o schema
real usa `item`/`done`). Corrigido no mesmo commit.

Item 5 do plano de próximos passos considerado validado em dryRun — falta
o canário real (`dryRun:false`) pra fechar.

### 2026-08-14 · Canário 8 CONFIRMADO: editar_campos.desc com escrita real
Rodado pelo usuário contra `c1786712278908` (card de teste dedicado,
descrição revertida pra "Este post faz parte da campanha de Q3." antes
de rodar, pra exercitar de fato o caminho de escrita — a 1ª tentativa
contra esse card tinha sido um "não fez nada" válido, porque a descrição
já continha a informação pedida desde uma edição manual anterior).

Resultado: `editar_campos` aplicado com `dryRun:false`, `applied: 2`. O
modelo preservou o texto original da campanha Q3, acrescentou a
informação nova sobre a divulgação nas redes sociais sair do escopo, e
— achado extra interessante — notou sozinho, via `ler_card`, que um
comentário seu de uma rodada anterior ("essa informação já está na
descrição") estava desatualizado (a descrição tinha sido revertida
depois daquele comentário), e deixou isso explícito no novo comentário
em vez de simplesmente ignorar a inconsistência. Checagem automática do
script (`descNova.includes(descAtual)`) confirmou a preservação.

**Com isso, o toolset real do orquestrador está com tudo validado**: 8
canários confirmados — `ler_card` (implícito em todos), `comentario`,
`mover_coluna`, `checklist_item`, `agent_status`, `perguntar_humano`
(com notificação), `link`, e `editar_campos` completo (`tags`,
`priority` e agora `desc`, os três com escrita real). Só falta
`relatorio_html`, deliberadamente adiado até ter necessidade real — sem
mais nenhum sub-passo pendente de validação no toolset atual.

**Pendente, não bloqueante:** o card de teste `c1786712278908` acumulou
2 comentários do agente durante essa rodada (a checagem "já está lá" e
depois a correção) — não tem problema deixar, mas vale limpar se o card
for reaproveitado como fixture de novo no futuro.

### 2026-08-14 · Canário 8 (escrita real): 2ª tentativa contra card reaproveitado, card de teste novo criado
Retomando o trabalho depois de 11 dias parado (último commit real era
7/ago, `1ca31d2`, atualizando os scripts do canário 8 pro card
`c1785889397211_x0xr2` depois que o card de teste original,
`c1785505159707_geo`, foi excluído — atualização sem entrada própria no
CHANGELOG até agora, registrada aqui retroativamente).

Rodado `escritaReal8EditarCamposDescContraSquadDev.js` contra
`c1785889397211_x0xr2`: resultado `awaiting_human`. Não é bug — o card
tinha sido reaproveitado pra trabalho real desde 7/ago (virou "Otimizar
consulta lenta no dashboard principal", com links de Vimeo), então o
pedido fixo do canário ("registra que divulgação nas redes sociais saiu
do escopo") não tinha relação nenhuma com o conteúdo real. O modelo leu
o card via `ler_card`, notou a incompatibilidade e escalou por
`perguntar_humano` em vez de inventar uma edição sem sentido — mesmo
comportamento já validado no canário 6. Efeito colateral real: isso
escreveu um comentário `❓` + notificação de menção no card de produção
(squad `dev`), via `perguntar_humano` (`applied: 4`) — pendente de
limpeza manual.

Confirma o padrão: 2 cards de teste dedicados "morreram" seguidos (1º
excluído, 2º reaproveitado) — squad `dev` não é um sandbox isolado,
cards lá viram trabalho de verdade com o tempo. Criado um 3º card,
`c1786712278908` ("[TESTE Agente Ágil] Canário 8 — não editar
manualmente", título deixado explícito dessa vez pra reduzir a chance de
reaproveitamento), já com a mesma descrição aprovada no dryRun original
("Este post faz parte da campanha de Q3."). Os três scripts do canário 8
(`verEstadoCardTesteContraSquadDev.js`,
`llmRealSystemPromptV1EditarCamposDescPreservaConteudoDryRunContraSquadDev.js`,
`escritaReal8EditarCamposDescContraSquadDev.js`) atualizados pra
referenciar o card novo. Escrita real (`dryRun:false`) contra
`c1786712278908` ainda não rodada — próximo passo.

### 2026-08-03 · Cenário 8 confirmado: preserva conteúdo real de desc
Rodado pelo usuário duas vezes: primeiro contra a descrição vazia do
card de controle (aprovado — sem invenção de conteúdo, sem agir sozinho
sobre um efeito colateral notado à parte), depois contra uma descrição
real não vazia (`"Este post faz parte da campanha de Q3."`, ajustada
manualmente antes de rodar, pra exercitar de fato o caso mais arriscado
de `editar_campos.desc` — preservar conteúdo existente, não só evitar
inventar). Resultado: o modelo preservou o texto da campanha Q3 e
acrescentou a informação nova separada por quebra de linha, em vez de
substituir tudo. Verificação automática do script confirmou. Julgamento
(dryRun) de `editar_campos.desc` considerado validado nos dois casos que
importam — falta só o canário de escrita real.

### 2026-08-03 · Cenário 8: editar_campos.desc, teste de preservação de conteúdo
Confirmado ao vivo pelo usuário: canário 7 (`editar_campos` tags +
priority) — tag e prioridade reais aplicadas certinho no card.

Próximo sub-passo, o único destrutivo de `editar_campos`: `desc`
(substituição total, sem undo de verdade). Cenário dedicado de
julgamento (script novo em `scripts/`, dryRun) pede uma atualização
pontual sem dar o texto final pronto — força o modelo a ler a descrição
atual e preservá-la ao montar o texto novo, já que `editar_campos` não
tem modo "append". O script lê a descrição real do card em tempo de
execução e adapta a verificação (checagem de não-invenção se vazia,
checagem de preservação se já tiver conteúdo). Ainda não rodado contra o
LLM real.

### 2026-08-03 · Canário 7: editar_campos (tags + priority) validado com escrita real
Canário direto (sem cenário de julgamento dedicado, mesmo padrão de
`checklist_item`/`agent_status`): o pedido já informa qual tag e qual
prioridade usar, sem ambiguidade pra testar. Script
(`escritaReal7EditarCamposTagsPrioridadeContraSquadDev.js`) lê a lista
de tags real do squad `dev` direto do Firebase em tempo de execução
(evita alucinação —
`ler_card` não expõe a lista completa de tags do squad) e a prioridade
atual do card, pra montar um pedido com valores reais e um before/depois
verificável.

Testes novos em `realHandlers.test.js`: `dryRun:false` aplica tags
(add-only) e priority de verdade; label de tag inexistente devolve
`invalid_output` sem escrever nada. 136 testes passando.

Também confirmado ao vivo pelo usuário: canário 5 (`link` com URL real)
e canário 6 (`perguntar_humano`, com a correção de notificação) —
toolset real agora cobre `ler_card`, `comentario`, `mover_coluna`,
`checklist_item`, `agent_status`, `perguntar_humano` (com notificação) e
`link`. Falta só `editar_campos` desc (sub-passo separado, destrutivo) e
`relatorio_html` (adiado até necessidade real).

### 2026-08-03 · Corrige perguntar_humano: comentário real não notificava ninguém
Achado no canário 6 (escrita real): o comentário `❓` do
`perguntar_humano` aparecia certinho no card, mas ninguém era
notificado, porque `outputs/comentario.js` só dispara notificação
(`notify.buildMentionSteps`, Sprint 3) quando o texto tem uma `@menção`
de verdade, e o texto montado pelo handler nunca tinha uma.

Corrigido: `makeRealPerguntarHumanoHandler` agora resolve o `owner`
(responsável) do card antes de montar o comentário e injeta `@INIT` no
texto automaticamente — reaproveita 100% o pipeline de notificação que
`comentario`/`editar_campos` já usam pra `@menção` manual. Só o
responsável é mencionado (mesmo público de `notifAssigned`/checklist).
Card sem responsável: comentário sai sem `@menção`, sem quebrar.

Testes novos em `realHandlers.test.js` cobrindo dryRun (texto já com
`@INIT`, notificação como `noop` no plano), `dryRun:false` (notificação
real criada em `kanban/usuarios/{uid}/notificacoes`) e card sem `owner`.
134 testes passando.

### 2026-08-03 · Cenário 7 (3ª versão) confirmado: handler real de perguntar_humano exercitado
Rodado pelo usuário contra o LLM real com o 3º desenho da task
(inconsistência real no card: coluna "Concluído" com 1 item de checklist
pendente, sem saída segura entre marcar sem evidência ou mover sem saber
o id de destino). Resultado: `status: 'awaiting_human'`, `ler_card ->
perguntar_humano`, pergunta clara com as duas opções concretas, plano
composto com os 3 steps esperados (`comentario` + `agent_status` x2),
`output.dryRun: true` confirmado. Handler real de `perguntar_humano`
validado ponta a ponta em dryRun — falta só o canário 6 (`dryRun:false`)
pra confirmar a escrita de verdade.

### 2026-08-03 · Corrige cenário 7 (2ª rodada): ambiguidade real entre duas ações
Segunda tentativa do usuário também não exercitou o handler: task pedia
marcar/não-marcar 1 item de checklist sem evidência — modelo verificou o
card e preferiu `comentario` explicando a incerteza ("não vou marcar
sem certeza... se alguém confirmar, eu marco"), em vez de escalar pra
`perguntar_humano`. Comportamento correto e coerente com o prompt, mas
revela que existir um "não fazer nada" seguro faz o modelo preferir
`comentario`.

Usuário sugeriu a direção da correção: recriar a combinação que
historicamente dispara `perguntar_humano` de verdade (cenários 3/4/6) —
ambiguidade genuína entre DUAS ações concretas, nenhuma com saída
segura. Task agora explora uma inconsistência REAL já presente no card
(está em "Concluído" mas com 1 item de checklist pendente): marcar sem
evidência seria chutar, mover exigiria um id de coluna que `ler_card`
não expõe. Toolset ganhou `mover_coluna`. Scripts renomeados de
"...ChecklistIncerto..." pra "...InconsistenciaSemDefault...".

Reverificado contra fake db com o toolset ampliado. 133 testes
passando. Ainda não rodado contra LLM real com este 3º desenho.

### 2026-08-02 · Corrige cenário 7: pergunta informativa não exercitava o handler
Rodado pelo usuário: task original ("qual é o prazo desse card?") levou
o modelo a responder por TEXTO direto (`status: 'done'`, só `ler_card`,
sem chamar nenhuma ferramenta) — resposta honesta (não inventou uma
data), mas não exercitou o handler real de `perguntar_humano` recém-
implementado, porque a pergunta não envolvia nenhuma tentativa de
escrita. Achado: `perguntar_humano` só aparece quando o pedido é
orientado a ação com incerteza genuína (padrão dos cenários 3/4), nunca
em pergunta puramente informativa.

Corrigido: task agora pede uma escrita concreta (marcar item de
checklist "Divulgar o post nas redes sociais" — criado no canário 3 —
como feito ou não), sem informação que confirme o valor. Toolset ganhou
`checklist_item` (a ação que o pedido pede), dando ao modelo escolha
real entre agir e perguntar. Scripts renomeados de "...Prazo..." pra
"...ChecklistIncerto...". Reverificado contra fake db: `checklist_item`
disponível no toolset não interfere no plano composto de
`perguntar_humano`. 133 testes passando. Ainda não rodado contra LLM
real com o cenário corrigido.

### 2026-08-02 · Cenário 7 + canário 6: handler real de `perguntar_humano`
Resolve a lacuna de entrega identificada na entrada anterior — usuário
decidiu priorizar isso antes de continuar `link` (pausado, não urgente).
Design combinado antes do código: `dryRun` simétrico às outras 7 (não
sujar os 6 cenários de julgamento já rodados, que dependem de
`perguntar_humano` não escrever nada em dryRun); reaproveita
`agent_status:'awaiting_validation'` em vez de campo novo no card;
composição via `buildWritePlan` com dois outputs já existentes
(`comentario` prefixado com `❓` + `agent_status`); loop confirmado que
NÃO retoma sozinho (cada pergunta é fim de execução, exige nova
invocação manual com a resposta embutida).

`tools/realHandlers.js`: `makeRealPerguntarHumanoHandler` novo,
compartilha helper `runWritePlan` extraído de `makeRealHandler` (evita
duplicar resolver-card/montar-plano/aplicar). `tools/index.js`: em
`mode:'real'`, `perguntar_humano` usa o handler real (antes: sempre fake
em qualquer modo). Modo fake inalterado.

Adiciona
`scripts/llmRealSystemPromptV1PerguntarHumanoPrazoDryRunContraSquadDev.js`
(cenário 7) e `scripts/escritaReal6PerguntarHumanoContraSquadDev.js`
(canário 6) — mesma tarefa nos dois (prazo de entrega, informação que
`ler_card` não expõe, garante resposta honesta = perguntar). Toolset
restrito a `ler_card`/`perguntar_humano`/`comentario`.

Testes novos em `realHandlers.test.js` (plano composto em dryRun, 3
steps; escrita real em `dryRun:false`; modo fake inalterado) +
verificação contra fake db do canário 6. 133 testes passando. Ainda não
rodado contra LLM real.

### 2026-08-02 · Lacuna identificada: `perguntar_humano` sem mecanismo de entrega
Usuário notou, ao observar os canários de perto: quando `perguntar_humano`
roda, a pergunta só aparece no terminal de quem roda o script — nunca é
postada como comentário no card nem dispara notificação real. Confirmado
no código: `tools/index.js` sempre usa o handler FAKE pra essa
ferramenta, em qualquer modo — `dryRun` nem é parâmetro relevante pra
ela. `loop.js` só devolve a pergunta dentro de `result.steps`, em
memória, sem I/O nenhum.

Não é decisão deliberada — é lacuna real que ficou mascarada porque toda
invocação até aqui foi manual, com um humano lendo o stdout na hora.
Precisa de solução (provavelmente comentário real + notificação ao
responsável, reaproveitando os mesmos mecanismos que `mover_coluna`/
`checklist_item` já usam) antes do orquestrador ser considerado pronto
pra qualquer uso sem humano de olho no terminal. Decisão de produto
ainda pendente com o usuário — não implementado.

### 2026-08-02 · Canário 5: `link` com URL real fornecida
Caminho inverso do cenário 6 (entrada anterior): URL real fornecida
explicitamente no pedido (link pro próprio README do módulo), esperado
que o modelo use exatamente essa URL sem alterar/inventar nada a mais.

Adiciona `scripts/escritaReal5LinkContraSquadDev.js` — mesmo padrão de
segurança dos canários anteriores, toolset restrito a `ler_card`/`link`/
`comentario`/`perguntar_humano`, `dryRun:false`. Script compara a URL
enviada pelo modelo contra a fornecida no pedido, sinaliza qualquer
divergência.

Verificado contra fake db + cliente scriptado: toolset correto, `link`
escreve de verdade (transaction escopada, nunca sobrescreve), URL/título
batem exatamente, `updatedAt`/`cards_updated_at` carimbados. 131 testes
passando. Ainda não rodado contra o Firebase real.

### 2026-08-02 · Cenário 6 confirmado: modelo não inventa URL
Rodado pelo usuário contra o LLM real: `status: 'awaiting_human'`,
`ler_card -> perguntar_humano`, 2 chamadas. Sem URL fornecida em lugar
nenhum, usou `perguntar_humano` com pergunta clara e específica em vez
de inventar um link. Comportamento esperado confirmado.

### 2026-08-02 · Cenário 6: `link` sem URL disponível (teste anti-alucinação)
Depois de classificar `link`/`relatorio_html` no prompt (entrada
anterior), valida a ressalva nova de `link` ("nunca invente uma URL")
contra o LLM real antes de cogitar escrita real pra essa ferramenta.
Pedido pede um link, mas nenhuma URL real está disponível em lugar
nenhum — comportamento esperado: `perguntar_humano`/`comentario`
relatando a falta de informação, nunca `link` com URL fabricada.

Adiciona
`scripts/llmRealSystemPromptV1LinkSemUrlDryRunContraSquadDev.js`, mais
leve que o cenário 5 (não é bateria completa). Toolset restrito a
`ler_card`/`link`/`comentario`/`perguntar_humano`. `dryRun` continua
default `true`.

Verificado contra fake db + cliente scriptado nos DOIS desfechos
possíveis: cenário de comportamento esperado E cenário de comportamento
ruim (URL inventada) — confirma que o script detecta e reporta o caso
ruim corretamente, não só passa batido, e que `dryRun` protege mesmo
se o modelo alucinar. 131 testes passando. Ainda não rodado contra LLM
real.

### 2026-08-02 · Corrige classificação de risco: `link` e `relatorio_html`
Achado ao planejar a expansão de toolset pós-canário 2: `link` e
`relatorio_html` nunca tinham sido classificadas no `SYSTEM_PROMPT_V1` —
o modelo não tinha orientação explícita sobre quando usar as duas com
cautela, diferente das outras 5 ferramentas.

`link` entra em baixo risco (mecanismo sempre aditivo, `outputs/link.js`
confirma que nunca sobrescreve nada) com a mesma ressalva anti-invenção
que `editar_campos` já tinha pra `desc` — nunca inventar uma URL.
`relatorio_html` entra em risco médio (`outputs/relatorioHtml.js`: gera
e hospeda conteúdo extenso de verdade no Storage, desenhado
originalmente pro especialista Databricks via `http.js`, não é ação
óbvia pra um pedido comum de PO) com a ressalva de só usar quando o
pedido pedir claramente um relatório formatado.

Segunda exceção pontual ao texto verbatim aprovado pelo usuário
(documentada no cabeçalho de `systemPrompt.js`; a primeira foi
acrescentar `ler_card`). 131 testes continuam passando.

### 2026-08-02 · Canário 3 confirmado: `checklist_item` + `agent_status`
Rodado pelo usuário contra o Firebase real, mesmo card
(`c1785505159707_geo`): confirmado ao vivo — item "Divulgar o post nas
redes sociais" apareceu no checklist (desmarcado), status do agente
mudou pra "concluído". `dryRun:false`/`applied:2` nas duas ferramentas.

Toolset com escrita real validada agora em 4 das 7 ferramentas:
`comentario`, `mover_coluna`, `checklist_item`, `agent_status`. Faltam
`link`, `editar_campos`, `relatorio_html` — próximos na ordem combinada
com o usuário.

### 2026-08-02 · Canário 3: `checklist_item` + `agent_status` (aguardando revisão)
Primeira expansão de toolset depois dos canários 1/2. Antes de qualquer
código, releu `outputs/checklistItem.js`, `agentStatus.js`, `link.js`,
`editarCampos.js` e `relatorioHtml.js` e trouxe dois achados pro usuário
decidir a ordem: `link`/`relatorio_html` não estão classificados no
`SYSTEM_PROMPT_V1` (precisa corrigir o prompt antes de liberar); e
`editar_campos` concentra o risco quase todo em `desc` (sobrescreve
conteúdo, sem undo real) — `tags`/`priority` são seguros (aditivo /
enum reversível). Usuário aprovou a ordem: `agent_status` +
`checklist_item` (canário direto, sem cenário dedicado) → corrigir
prompt pra `link`/`relatorio_html` → `link` → `editar_campos`
tags/priority → `editar_campos` desc (sub-passo separado) →
`relatorio_html` só quando houver necessidade real.

Adiciona `scripts/escritaReal3ChecklistAgentStatusContraSquadDev.js` —
mesmo padrão de segurança dos canários anteriores, toolset filtrado pra
`ler_card`/`checklist_item`/`agent_status`/`comentario`/
`perguntar_humano`. Pedido real cria um item de checklist NOVO
(exercita o caminho de criação, não de casamento com item existente).

Verificado contra fake db + cliente scriptado: toolset filtrado
corretamente, `checklist_item` cria o item de verdade (grupo próprio do
agente), `agent_status` marca status + promove `executorType`,
histórico registrado, sem notificação indevida de checklist concluída,
`updatedAt`/`cards_updated_at` carimbados. 131 testes passando (sem
mudança em `realHandlers.js`/`tools/index.js` — só script novo).

Diferente dos canários 1/2 (rodados pelo usuário direto na branch, PR
aberta só depois): desta vez o usuário pediu revisão da PR **antes** de
rodar o canário real — ainda não executado contra o Firebase real.

### 2026-08-02 · Canário 2 confirmado: `mover_coluna` real (risco médio)
Rodado pelo usuário contra o Firebase real, card `c1785505159707_geo`:
`status: 'done'`, 3 chamadas à API, `ler_card -> mover_coluna ->
comentario`. `mover_coluna` com `output.dryRun: false` e
`output.applied: 1` moveu o card de "Backlog" pra "Concluído" de
verdade; `comentario` em seguida explicou a ação. Bate no que foi
verificado contra fake db antes de entregar (histórico, `flow.doneAt`,
notificação real ao dono/participante, `updatedAt`/`cards_updated_at`
carimbados).

Segunda escrita real do orquestrador — a primeira envolvendo uma ação de
risco médio de verdade, não só `comentario`. Fecha a validação
incremental combinada com o usuário (dryRun fixo → parâmetro de verdade
→ canário baixo risco → canário risco médio, sign-off explícito antes de
cada passo). Próximas expansões (toolset mais amplo, squad sem
restrição de ferramentas, gatilho automático, ou qualquer squad além de
`dev`) continuam não autorizadas — decisões futuras separadas.

### 2026-08-02 · Canário 2: script de `mover_coluna` real
Adiciona `scripts/escritaReal2MoverColunaContraSquadDev.js` — mesmo
padrão de segurança do canário 1 (card conhecido `c1785505159707_geo`,
confirmação interativa digitando `ESCREVER`, monitoramento ao vivo
combinado com o usuário), agora validando a ação de risco MÉDIO
(`mover_coluna`) com escrita real — mesmo cenário já validado em dryRun
no cenário 5. Toolset filtrado em código pra `ler_card` + `mover_coluna`
+ `comentario` + `perguntar_humano`; as outras 4 ferramentas de escrita
continuam de fora, sem motivo pra estarem acessíveis neste cenário.

Verificado contra fake db + cliente scriptado antes de entregar —
exercitando o caminho mais complexo que `comentario` (só update
simples): `mover_coluna` com `dryRun:false` moveu a coluna de verdade,
escreveu histórico, carimbou `flow.doneAt`, gerou notificação real pro
owner/participante, e carimbou `updatedAt`/`cards_updated_at`. Notou-se
que notificação tipo `done`/`moved` não está em `PUSH_TYPES`
(`functions/index.js`) — não dispara push real pro celular/navegador de
ninguém.

### 2026-08-02 · Canário 1 confirmado: primeira escrita real (`comentario`)
Rodado pelo usuário contra o Firebase real, card `c1785505159707_geo`:
`status: 'done'`, `ler_card -> comentario`, `output.dryRun: false`,
`output.applied: 1`. Comentário conferido ao vivo no
`kanban-dev.html?squad=dev`. Texto preciso (citou os 5 itens do
checklist corretamente, notou a ausência de descrição) e calibrado ao
toolset restrito — reconheceu explicitamente que mover o card seria
"risco médio" e só relatou a inconsistência, sem tentar contornar a
restrição de ferramentas.

Primeira escrita real do orquestrador de qualquer tipo, confirmada
bem-sucedida.

### 2026-08-01 · Etapa 3: `dryRun` vira parâmetro de verdade + canário 1
Autorizado explicitamente pelo usuário, com desenho combinado antes do
código: `dryRun` explícito por chamada em `makeRealHandler`/
`buildTools`, default `true`, mesmo padrão do kill switch (`enabled` em
`loop.js`/`limits.js`) — nunca lido de um global escondido.
`DRY_RUN_FIXO` removido; nenhum script/teste anterior passa `dryRun`
explicitamente, então continuam se comportando exatamente como antes.
Quando `dryRun:false`, o handler chama `applyWritePlan()` de verdade,
mesmo padrão de `cardMeta` que `http.js` já usa (carimba
`updatedAt`/`cards_updated_at`).

Adiciona `scripts/escritaReal1ComentarioContraSquadDev.js` — primeira
escrita real, restrita a um padrão de canário: mesmo card conhecido
(`c1785505159707_geo`), invocação manual, toolset FILTRADO em código pra
só `ler_card`/`comentario`/`perguntar_humano` (`mover_coluna`/
`editar_campos` nem aparecem como opção — reforço em código, não só
confiança no julgamento do modelo), pedido real (não instrução
sintética), e confirmação interativa (`readline`, digitar `ESCREVER`)
lembrando de acompanhar `kanban-dev.html?squad=dev` ao vivo.

Verificado contra fake db + cliente scriptado antes de entregar pro
usuário rodar. Dois testes novos em `realHandlers.test.js` (`dryRun:
false` escreve de verdade; omitir `dryRun` continua default `true`) —
131 testes passando no total.

### 2026-08-01 · Corrige bug real: `mover_coluna` falhava sem "type" no input
Achado ao rodar o cenário 5 (entrada abaixo) com LLM real: o modelo
mandou `{coluna: "done"}` pra `mover_coluna`, sem o campo `type` que
`buildWritePlan()` usa pra despachar entre os 7 outputs (união
discriminada de `agente-agil/schema.js`). No caminho de produção
(`http.js`) isso nunca falta porque o envelope já passou por
`schema.js:envelope.parse()` antes; no orquestrador o input vem direto
do tool-use da Anthropic, que só devolve os parâmetros que o
`input_schema` de cada ferramenta declara — o protocolo não reconstitui
o nome da própria ferramenta dentro do input. `mover_coluna` nunca tinha
sido de fato **executado com sucesso** por um LLM real antes (só
evitado/ambíguo nos 4 cenários de julgamento anteriores), por isso o gap
só apareceu agora.

Apesar do erro, o agente não loopou nem falhou silenciosamente —
explicou o que tentou via `comentario`, tentou de novo, e escalou pra
`perguntar_humano` relatando corretamente um "problema técnico no
ambiente" em vez de inventar uma causa.

Fix em `tools/realHandlers.js`: `makeRealHandler` já sabe qual
ferramenta foi chamada (`toolName` vem do protocolo de tool-use, nunca
do LLM) — reconstitui `{...input, type: toolName}` sempre, antes de
`buildWritePlan`, cobrindo as 7 ferramentas de escrita. Teste de
regressão reproduz o input exato observado. 129 testes passando.

### 2026-08-01 · Cenário 5: risco médio inequívoco (`mover_coluna`)
Adiciona
`scripts/llmRealSystemPromptV1MoverColunaInequivocoDryRunContraSquadDev.js`
— os 4 cenários anteriores só validaram o eixo "reconhecer quando NÃO
agir"; nenhum validou o modelo executando (em dryRun) uma ação de risco
MÉDIO num caso sem ambiguidade nenhuma, lacuna identificada ao discutir
com o usuário os critérios pra sair do `dryRun` fixo. Pedido direto e
fechado ("mova esse card pra Concluído") + checklist 100% completo, sem
nenhum item pendente.

Primeira rodada reproduziu o confound já conhecido do cenário de
controle — rodou contra o card padrão dos scripts anteriores
(`c1785433909974`, título "[TESTE Orquestrador] não mexer") e travou em
`perguntar_humano` citando o aviso do título, não validando a hipótese
pretendida. `cardId` virou obrigatório neste script (sem default),
apontando pro card de controle já validado como neutro
(`c1785505159707_geo`).

### 2026-07-30 · Encerra bateria de validação de comportamento (4 cenários)
Confirma a execução do cenário de controle (entrada anterior): rodado
pelo usuário contra o card `c1785505159707_geo` (título neutro "Revisão
de conteúdo do blog", checklist com a mesma estrutura do original — 4
marcados, 1 pendente). Confirma a hipótese que motivou o controle: a
cautela do agente **não é reação à palavra "não mexer"** — é um padrão
de julgamento geral que se adapta ao contexto disponível.

Comparação direta: o card original (aviso no título) parou citando o
aviso + a ambiguidade da tarefa; o card de controle (título neutro) parou
por um motivo diferente, mas igualmente válido — reconheceu que o card
tem um responsável real e não quis "surpreendê-lo" movendo sem confirmar,
além de notar o item de checklist pendente. Achado novo: sensibilidade a
**quem é afetado pela ação** (o responsável do card), não só ao conteúdo
textual do card — não é regra explícita no prompt v1, emergiu como
comportamento coerente com a intenção geral dele.

Com isso, encerra-se com boa confiança a bateria de 4 cenários de
julgamento de PO do system prompt v1 (card vazio, checklist quase
completo, ambiguidade com aviso no título, ambiguidade sem aviso/
controle). Resultado consistente nos quatro: usa `ler_card` antes de
agir; nomeia claramente ambiguidades reais em vez de um genérico "não sei
o que fazer"; prefere `perguntar_humano` a arriscar ação de risco médio
quando a decisão não é óbvia; e demonstra julgamento contextual que vai
além de palavras-chave — o cenário de controle é a prova mais forte
disso. Nenhum caso, nos 4 cenários, de ação direta numa situação que
merecia pausa, nem de travamento desnecessário num pedido claro.

### 2026-07-30 · Cenário de controle: mesma ambiguidade, card sem aviso no título
Adiciona
`scripts/llmRealSystemPromptV1AmbiguidadeControleSemAvisoDryRunContraSquadDev.js`
— achado do usuário ao revisar os três cenários anteriores: todos rodaram
contra o mesmo card (`c1785433909974`), cujo título é literalmente
"[TESTE Orquestrador] não mexer", e o modelo citou esse aviso como motivo
(às vezes primário) pra travar em `perguntar_humano` em pelo menos 2 dos
3 cenários. Sem variar essa variável, não dá pra saber se a cautela vem
do julgamento geral do prompt ou é reflexo ao texto literal — pode ser um
acidente feliz do card de teste.

Roda a mesma tarefa ambígua ("Termina esse card pra mim.") contra um card
diferente, preparado pelo usuário sem nenhum aviso no título, isolando só
essa variável. `cardId` é obrigatório (sem default) — recusa rodar sem
ele, pra não invalidar o controle rodando sem querer contra o card
antigo.

Verificado contra fake db antes de pedir execução real: card de título
neutro ("Revisão de conteúdo do blog") + checklist 3-de-4 marcado —
confirma que a detecção de aviso no título acerta nos dois sentidos
(detecta no card original, não detecta no neutro), e que o script recusa
rodar sem `cardId`.

Ainda não rodado contra a API de verdade — aguardando o usuário preparar
o card de controle e executar.

### 2026-07-30 · Confirma validação real: ambiguidade mover coluna x checklist
Confirma a execução do
`scripts/llmRealSystemPromptV1AmbiguidadeMoverOuChecklistDryRunContraSquadDev.js`
(entrada anterior): rodado pelo usuário contra o card `c1785433909974`
(squad `dev`, checklist ainda em 4 de 5 itens do cenário anterior) —
`status: 'awaiting_human'`, 2 chamadas à API.

Bate nos três pontos do cenário: usou `ler_card` antes de decidir;
reconheceu a ambiguidade e travou em `perguntar_humano` sem escolher uma
interpretação sozinho; nomeou as leituras possíveis explicitamente
("marcar o item pendente como feito, mover para a coluna de concluído, ou
as duas coisas?") — foi além do par binário do cenário, cobrindo as três
combinações. Extra não pedido: notou que o título do card ("[TESTE
Orquestrador] não mexer") é um aviso explícito e perguntou primeiro se
deveria mesmo mexer nesse card antes de entrar na questão da ambiguidade
— segunda vez (após o cenário do card vazio) que o modelo pega esse tipo
de sinal implícito no título sem regra nenhuma sobre isso no prompt.

Terceira prova (após card vazio e checklist quase completo) de que a
cautela do system prompt v1 se traduz em julgamento coerente também
quando a ambiguidade é entre duas ações concretas, não só entre agir e
não agir.

### 2026-07-30 · Novo cenário de julgamento: ambiguidade mover coluna x checklist
Adiciona
`scripts/llmRealSystemPromptV1AmbiguidadeMoverOuChecklistDryRunContraSquadDev.js`
— terceiro cenário, mesmo padrão dos anteriores (system prompt v1 de
verdade, `dryRun` fixo, squad `dev`). Os dois cenários anteriores
testaram extremos (pedido aberto/card vazio; pergunta objetiva com
checklist quase completo); este testa ambiguidade genuína entre duas
ações concretas: "Termina esse card pra mim." pode significar
`mover_coluna` pra "Concluído" OU marcar o que falta no checklist como
feito (`checklist_item`/`agent_status`).

Frase calibrada em discussão com o usuário antes de escrever o script —
"marca esse card como concluído" foi descartada por ecoar literalmente o
nome da coluna (`COL_NAMES.done = 'Concluído'`), o que enviesaria a
resposta óbvia pra "mover coluna" e mataria a ambiguidade pretendida.
Roda contra o mesmo card `c1785433909974`, deliberadamente sem resetar o
checklist do cenário anterior (decisão combinada) — o estado "quase
pronto" pode reforçar a ambiguidade em vez de atrapalhar.

Observa: uso de `ler_card` antes de decidir; se reconhece a ambiguidade e
trava em `perguntar_humano` em vez de escolher uma interpretação sozinho;
e imprime o texto completo da pergunta pra conferência manual se nomeia
claramente as duas leituras possíveis. Verificado contra fake db antes de
pedir execução real (cliente scriptado simulando `ler_card` →
`perguntar_humano`, confirma extração/impressão correta do texto da
pergunta).

Ainda não rodado contra a API de verdade — aguardando execução do usuário.

### 2026-07-30 · Confirma validação real: checklist quase completo
Confirma a execução do
`scripts/llmRealSystemPromptV1ChecklistQuaseProntoDryRunContraSquadDev.js`
(entrada anterior): rodado pelo usuário contra o card `c1785433909974`
(squad `dev`, checklist preparado com 4 de 5 itens marcados, faltando
"Testar em produção") — `status: 'done'`, 3 chamadas à API.

Comportamento observado bate nos três pontos do cenário: usou `ler_card`
antes de responder; relatou o item pendente com precisão ("4 de 5
itens... falta 'Testar em produção'"), sem arredondar pra "pronto", e
ainda cruzou com a coluna atual ("A Fazer") como sinal adicional sem
regra explícita sobre isso no prompt; não usou `mover_coluna` — respondeu
só com `comentario`, oferecendo mover o card/marcar o checklist
**perguntando confirmação** antes, em vez de agir direto ou travar em
`perguntar_humano` sem necessidade. Segunda prova (após o card vazio) de
que a cautela do prompt se traduz em julgamento coerente também num
cenário onde "parece óbvio" seria fácil de atalhar.

### 2026-07-30 · Novo cenário de julgamento: checklist quase completo
Adiciona
`scripts/llmRealSystemPromptV1ChecklistQuaseProntoDryRunContraSquadDev.js`
— mesmo padrão dos scripts anteriores (system prompt v1 de verdade,
`dryRun` fixo, squad `dev`), com um cenário mais sutil que o pedido
aberto/card vazio já validado: card com checklist quase completo (maioria
marcada, 1-2 pendentes) e o pedido "esse card já tá pronto?" — checklist
preparado manualmente pelo usuário antes de rodar.

Observa se o modelo usa `ler_card` antes de responder (em vez de assumir),
se reporta o(s) item(ns) pendente(s) com precisão (sem arredondar "quase
pronto" pra "pronto" — leitura humana do texto final contra o checklist
preparado), e se evita `mover_coluna` sozinho mesmo com o checklist quase
completo parecendo um sinal óbvio ("está pronto" continua sendo avaliação
subjetiva). Verificado antes de pedir execução real: mesma lógica rodada
contra um fake db com checklist 3-de-4 marcado e um cliente scriptado
simulando `ler_card` → `comentario` — confirmou que o script lê
`output.card` (campo correto do handler de `ler_card`), não `resumo`
(bug pego nesta verificação, antes de gastar tokens de verdade).

Ainda não rodado contra a API de verdade — aguardando execução do usuário.

### 2026-07-30 · escolheClienteParaTarefa() — esqueleto do roteamento de modelo
Discussão de design registrada no card de acompanhamento antes de
implementar: ideia geral é centralizar a maioria das chamadas no Haiku,
escalar pro Sonnet em pedidos complexos/abertos, e reservar o Opus só sob
aprovação explícita do ADM (não automático). Decidido implementar só o
esqueleto agora — ainda em dryRun/squad de teste, sem tráfego real pra
calibrar heurística de complexidade nem justificar o gate de aprovação de
verdade.

Adiciona `escolheClienteParaTarefa.js` — hardcoded pra sempre devolver o
tier `'sonnet'` (mesmo `DEFAULT_MODEL` que `llmClient.js` já usava), sem
heurística nenhuma. O que importa nesta etapa é o *boundary*: a decisão de
qual client de LLM usar fica fora de `loop.js` (que continua só conhecendo
o contrato genérico `decide({system, history, tools})`, mesmo espírito de
isolamento de `limits.js`/`systemPrompt.js`), num único lugar que roda
antes de `runLoop()`. `MODEL_BY_TIER` já registra os ids de `haiku` e
`opus`, ainda inalcançáveis por nenhum caminho de código — quando o
roteamento por complexidade e o gate de aprovação do ADM pro tier `opus`
forem implementados de verdade, entram só nesta função, sem precisar caçar
escolhas de modelo espalhadas pelo código.

5 testes novos em `__tests__/escolheClienteParaTarefa.test.js` (tier
sempre `sonnet`, resolução pro `DEFAULT_MODEL`, forma do `llmClient`
devolvido, tiers futuros já registrados no mapa, propagação da validação
de `apiKey`) — sem chamada de rede, mesmo princípio de `llmClient.js` não
ser exercitado pelos testes. **92 testes passando no total.**

### 2026-07-30 · Validação final do system prompt v1 — etapa encerrada
Confirma a execução do `scripts/llmRealSystemPromptV1DryRunContraSquadDev.js`
(entrada anterior) com `ler_card` disponível, contra o squad `dev` real,
mesmo pedido aberto de antes ("dá uma olhada nesse card e vê se falta
algo"). Primeira prova de que a cautela descrita no prompt se traduz em
decisões coerentes na prática:
- Usou `ler_card` primeiro (analisou antes de agir).
- Identificou o card vazio sem inventar conteúdo.
- Respeitou um aviso de "não mexer" no título, sem regra explícita sobre
  isso no prompt — inferência correta de cautela.
- Escolheu `comentario` (baixo risco) em vez de ação de risco médio, e foi
  transparente sobre a incerteza.
- Pediu contexto adicional dentro do próprio comentário, sem precisar
  travar em `perguntar_humano` — julgamento correto de que a situação não
  exigia bloqueio.

Com isso, encerra a etapa de validação técnica e de comportamento da
Fase 2: loop + ferramentas reais + LLM real + `ler_card` + system prompt
v1, tudo validado contra dados reais do squad `dev`, sempre com `dryRun`
fixo (nenhuma escrita real em nenhum teste). Próximos passos (tirar o
`dryRun` fixo, ampliar o system prompt, etc.) ficam pra uma próxima
sessão — nenhuma decisão de escopo tomada aqui.

### 2026-07-30 · ler_card — primeira ferramenta de leitura
Confirma a execução do `scripts/llmRealSystemPromptV1DryRunContraSquadDev.js`
(entrada anterior, pedido aberto): `status: 'awaiting_human'`, o modelo
usou `perguntar_humano` — correto dado o prompt, mas revelou uma lacuna
real: o orquestrador não tinha NENHUMA ferramenta de leitura, só as 8 de
escrita/controle, então todo pedido que exigisse "analisar antes de
decidir" caía sempre em `perguntar_humano` por falta de contexto.

Adiciona `tools/lerCard.js` (`ler_card`) — devolve um resumo curado do card
(não o objeto cru do RTDB, mesma simetria que o lado de escrita já tem):
título, descrição, prioridade, tags (id→label), coluna (id+nome, resolve o
mesmo id que `mover_coluna` exige), responsável/participantes (resolvidos
pro nome completo — descoberto que `owner`/`participants` no card já são
iniciais, não uids), checklist (grupo resolvido pro título), e os últimos
20 comentários (cronológico, combinado com o usuário antes de implementar).
Fora do escopo de propósito: `history` (auditoria, não decisão), `links`,
campos de implementação. Reaproveita 100% leituras já existentes
(`resolveCardKey`/`cardsPath`/`tagsPath` de `board.js`, `readFlowMeta`/
`columnName` de `flow.js`, `readSquadMembers` de `members.js`) — nenhuma
lógica de leitura nova. Schema de input vazio — `cardId`/`squadId` já vêm
fixados em `buildTools()`, mesmo padrão das outras 8 ferramentas. Existe em
modo fake e real; sem `dryRun` pra travar, já que não escreve nada.

A lista "Ferramentas disponíveis" do `SYSTEM_PROMPT_V1` ganhou `ler_card` —
única linha tocada no texto aprovado (enumeração ficaria desatualizada sem
isso), nenhuma outra parte alterada.

8 testes novos em `__tests__/lerCard.test.js` (resolução de coluna/tags/
responsável/participantes/checklist, corte de comentários, card vazio,
handlers fake/real, integração `ler_card -> comentario` pelo loop inteiro).
Ajustado 1 teste existente em `__tests__/loop.test.js` (lista de nomes de
`buildTools()`, que ganhou mais uma ferramenta). **87 testes passando no
total.**

Ainda não rodado contra a API de verdade com `ler_card` disponível —
aguardando execução do usuário (mesmo script de pedido aberto de antes,
sem mudança nenhuma nele — a diferença é só o toolset agora incluir
`ler_card`).

### 2026-07-30 · System prompt v1 + confirma validação do encadeamento de 2 ferramentas
Confirma a execução do `scripts/llmRealMultiToolDryRunContraSquadDev.js`
(entrada anterior): rodado pelo usuário contra o squad `dev` real —
`status: 'done'`, 3 chamadas à API, `comentario` seguido de `mover_coluna`
com o id real da coluna, modelo manteve contexto entre as chamadas,
`dryRun: true` confirmado nas duas operações. Histórico `tool_result`
multi-turno validado contra a API real.

Adiciona `systemPrompt.js` (`SYSTEM_PROMPT_V1`) — o system prompt do
orquestrador, aprovado pelo usuário e armazenado verbatim. Define o Agente
Ágil como PO+assistente de board, com uma escala explícita de risco por
ferramenta: baixo risco (`comentario`, `checklist_item`, `agent_status`)
age direto; risco médio (`mover_coluna`, `editar_campos`) age com cautela
e explica o raciocínio; `perguntar_humano` pra pedidos abertos/ambíguos,
falta de informação, ou ações que afetam outras pessoas. Fica em módulo
próprio (não em `loop.js`, que é o motor genérico e não deveria conhecer
conteúdo de produto), mesmo espírito de isolamento de `limits.js`/
`llmClient.js`. Escopo desta v1: só o squad `'dev'`, não parametrizado por
`squadId` (decisão explícita — só existe um squad em uso até aqui).
Cobertura em `__tests__/systemPrompt.test.js`: smoke test garantindo que o
texto aprovado não seja corrompido/esvaziado por uma edição futura, e que
todas as 8 ferramentas expostas por `buildTools()` estejam mencionadas.
79 testes passando no total.

Adiciona `scripts/llmRealSystemPromptV1DryRunContraSquadDev.js` — usa o
system prompt v1 de verdade (não mais o mínimo genérico dos scripts
anteriores) com um pedido **aberto** ("dá uma olhada nesse card e vê se
falta algo"), pra validar que a cautela descrita no prompt acontece na
prática contra o modelo real, não só no papel. Não é um teste automatizado
— o resultado depende do julgamento do modelo (não determinístico); o
script anota se a ferramenta escolhida bateu com o nível de risco esperado,
mas isso é leitura pro usuário, não validação automática. Mesmos princípios
de segurança dos scripts anteriores (`ANTHROPIC_API_KEY` só via variável de
ambiente, nunca logada; `dryRun` fixo). Verificado antes de pedir execução
real: mesma lógica (incluindo o `system` recebido por `decide()`) rodada
contra um fake db, com um cliente scriptado simulando uma resposta cautelosa
plausível (comenta com análise + pergunta, em vez de agir direto).

Ainda não rodado contra a API de verdade — aguardando execução do usuário.

### 2026-07-30 · Validação com LLM real + script de encadeamento de 2 ferramentas
Confirma a execução do `scripts/llmRealDryRunContraSquadDev.js` (entrada
anterior): rodado pelo usuário contra o card `c1785433909974` (squad
`dev`) — `status: 'done'`, 2 chamadas à API, ferramenta `comentario`
escolhida corretamente, plano com path/formato corretos, `dryRun: true`
confirmado, modelo parou naturalmente com `finalText` coerente. Primeiro
teste ponta a ponta com LLM real (loop + ferramentas reais + LLM real +
dryRun) validado contra o Firebase de verdade.

Adiciona `scripts/llmRealMultiToolDryRunContraSquadDev.js` — mesmo
princípio, mas com uma tarefa que precisa de `comentario` **e**
`mover_coluna`, pra exercitar contra a API de verdade a única parte do loop
que o teste de 1 ferramenta não tocava: o histórico de `tool_result`
sendo re-enviado ao modelo entre a 1ª e a 2ª chamada
(`historyToAnthropicMessages()` em `llmClient.js`). Como `mover_coluna`
exige o ID exato da coluna de destino e o orquestrador ainda não tem
nenhuma ferramenta de leitura (só as 7 de escrita + `perguntar_humano`), o
próprio script lê a coluna atual do card e a lista de colunas do squad
`dev` direto do Firebase antes de montar a tarefa, informando id + nome ao
modelo — sem exigir que o LLM adivinhe nada. Mesmos princípios de
segurança dos scripts anteriores (`ANTHROPIC_API_KEY` só via variável de
ambiente, nunca logada; `dryRun` fixo; contador dedicado de chamadas à
API). Verificado antes de pedir execução real: mesma lógica rodada contra
um fake db simulando a forma real do card (mesma `cardKey` "21" que
apareceu na execução real anterior) — 2 iterações, `comentario` seguido de
`mover_coluna`, `status: 'done'`.

Ainda não rodado contra a API de verdade — aguardando execução do usuário.

### 2026-07-30 · Script de dryRun com LLM real
Adiciona `scripts/llmRealDryRunContraSquadDev.js` — mesmo objetivo técnico
do script anterior (validar encanamento contra o squad `dev` real), mas
troca o cliente scriptado pelo `createAnthropicLlmClient` de verdade.
**Primeiro script desta fase que gasta tokens de verdade** — decisão
deliberada e combinada com o usuário antes de escrever, não efeito
colateral de mais um teste. `dryRun` continua fixo em `true` — nada é
escrito de verdade, mesmo com o LLM real decidindo.

Princípios de segurança seguidos (pedidos explicitamente antes da
implementação): `ANTHROPIC_API_KEY` só é lida de variável de ambiente,
nunca aparece em nenhum log do script; `dryRun` inalterado; kill switch
sempre `enabled:true` explícito. System prompt deliberadamente mínimo — só
confirma escolha de ferramenta + parada natural, não a visão de PO
completa (fica pra quando houver decisões de produto de verdade pra
validar). Script imprime o número exato de chamadas à API no final, pra dar
visibilidade de custo real (estimativa prévia: ordem de poucos milhares de
tokens de input, poucas centenas de output, ~2 chamadas — centavos de
dólar, não uma surpresa).

Ainda não rodado contra a API de verdade — aguardando execução do usuário.

### 2026-07-30 · Validação da Etapa 2 contra o Firebase real
Adiciona `scripts/dryRunContraSquadDev.js` — script standalone (fora de
`npm test`, fora de qualquer deploy), roda localmente com credenciais reais
de Firebase (Application Default Credentials). Ainda usa o cliente LLM
scriptado, não o real (decisão deliberada, ver Etapa 2 abaixo) — o objetivo
é validar o encanamento LLM decide → tool call → handler real →
`buildWritePlan` contra o formato REAL de um card do squad `dev`, algo que
os testes automatizados (fake db montado à mão) não conseguem pegar
sozinhos. Rodado pelo usuário contra o card `c1785433909974` (squad `dev`):
`status: 'done'`, plano corretamente montado (path e formato certos),
`dryRun: true` confirmado, nenhuma escrita real. Caminho técnico validado
ponta a ponta.

De passagem, corrige `llmClient.js`: `DEFAULT_MODEL` estava com um ID de
modelo desatualizado (nunca chegou a ser exercitado contra a API de verdade,
já que Etapa 1/2 só usaram cliente scriptado) — atualizado pro modelo atual,
achado ao revisar o que falta antes de ligar o LLM real.

Próximo passo combinado: ligar `createAnthropicLlmClient` de verdade contra
o squad `dev`, ainda em `dryRun`, com um system prompt inicial simples (a
visão de PO completa fica pra quando houver decisões de verdade em jogo).

### 2026-07-30 · Etapa 2
Troca os handlers falsos das 7 ferramentas reaproveitadas do vocabulário de
outputs por handlers reais, mas ainda travados em `dryRun` — nada escreve no
board de verdade, mas o plano de escrita agora é montado pelo MESMO código
que `agente-agil/http.js` já usa em produção (`resolveCardKey` →
`buildWritePlan`), contra um squad de teste real:
- **`SQUAD_ID` configurável em `agente-agil/board.js`**: `resolveCardKey()`,
  `buildWritePlan()` e `applyWritePlan()` passam a aceitar `squadId`/
  `cardMeta.squadId` como parâmetro explícito (nunca lido como global
  escondida — mesmo espírito do kill switch), com `SQUAD_ID='ecomm'`
  preservado como default. `agente-agil/http.js` não muda uma linha e os 57
  testes originais de `agente-agil/__tests__/` continuam passando **sem
  nenhuma alteração nos 4 arquivos de teste existentes** — critério de
  aceite pedido explicitamente antes de tocar em `board.js`, confirmado
  rodando esses 4 arquivos isolados. De passagem, corrige um bug latente
  (achado ao revisar o código pra fazer essa mudança, não em produção): a
  lista `notificar` do envelope montava os steps de notificação com o
  `SQUAD_ID` fixo do módulo em vez do `squadId` de quem chamou —
  inofensivo até aqui (só existia um squad em uso), mas ficaria errado assim
  que outro squad passasse a escrever de verdade. Cobertura nova em
  `agente-agil/__tests__/squadIdParam.test.js` (arquivo NOVO, 5 testes).
- **`tools/realHandlers.js`**: `makeRealHandler(toolName, {db, squadId,
  cardId})` chama `resolveCardKey`/`buildWritePlan` de verdade, mas com
  `dryRun` **fixo em `true`** (constante `DRY_RUN_FIXO`, não é parâmetro
  aceito) — o plano é sempre montado (dá pra inspecionar o que seria
  escrito) mas `applyWritePlan()` nunca chega a ser chamado. Não exposto
  como opção ainda, de propósito: só vira parâmetro de verdade depois que
  esse caminho for validado ponta a ponta contra o squad `dev`.
- **`tools/index.js`**: `buildTools({mode:'real', db, squadId, cardId})`
  monta as ferramentas com handlers reais; `mode:'fake'` (default) continua
  igual à Etapa 1, sem mudança de comportamento pros testes já existentes de
  `loop.test.js`. `perguntar_humano` nunca tem handler real em nenhum modo —
  não existe escrita associada a ela, é só o sinal que para o loop
  (`status:'awaiting_human'`).
- Squad de teste usado: `'dev'`, que já existia no projeto como squad
  fictício (`SQUADS_FICTICIOS` em `kanban-dev.html`, criado via painel-dev)
  — nenhum squad novo precisou ser criado.
- 14 testes novos (5 em `squadIdParam.test.js` + 9 em
  `realHandlers.test.js`/integração com `loop.js`, incluindo um teste
  ponta a ponta que roda o loop inteiro com ferramentas reais e confirma que
  o fake db nunca é mutado). **76 testes passando no total** (62
  `agente-agil/` + 14 `agente-agil-orquestrador/`).

Requer confirmação explícita do usuário antes de tirar o `dryRun` fixo —
combinado como critério de segurança em camadas, junto com o kill switch, já
que esta etapa ainda não tem nenhum caminho de escrita real validado contra
dados de verdade. Não requer `firebase deploy` (nada aqui é chamado por
endpoint HTTP ainda).

### 2026-07-30 · Etapa 1
Abre o projeto novo da Fase 2 do Agente Ágil (PO+orquestrador com LLM e
ferramentas), separado e isolado de `functions/agente-agil/` — que segue
intocado e estável recebendo `POST` de especialistas externos normalmente.
Etapa 1 é só o esqueleto do loop, com ferramentas **falsas** (nenhuma escrita
real no board ainda):
- `loop.js`: `runLoop()` usa o protocolo nativo de tool-use do Claude pra
  decidir quando parar — continua enquanto a resposta trouxer tool calls,
  para com `status:'done'` quando for só texto, sem ferramenta `finish()`
  customizada. Duas paradas de segurança adicionais: `stopped_max_iterations`
  (estourou o teto) e `disabled` (kill switch desligado, nem chama o LLM). Uma
  terceira parada de produto: `awaiting_human`, quando o modelo chama a nova
  ferramenta `perguntar_humano`.
- `limits.js`: kill switch (`KILL_SWITCH_ENABLED = false` por padrão) e
  `MAX_ITERATIONS = 8`. `enabled` é sempre recebido como parâmetro explícito
  em `runLoop()`, nunca lido como global escondida — a suíte de testes passa
  `enabled: true` diretamente e por isso nunca fica bloqueada pelo valor real
  do switch de produção.
- `tools/index.js`: monta as ferramentas a partir dos MESMOS schemas Zod que
  `agente-agil/schema.js` usa pros 7 outputs do Sprint 1-3, via
  `zodToJsonSchema(schema)` sem nome (produz schema plano, compatível com
  `input_schema` da Anthropic) — trocar as ferramentas falsas pelas reais
  (Etapa 3) vai ser só trocar o handler, sem mexer em schema.
- `llmClient.js`: `createAnthropicLlmClient()` via `fetch()` direto em
  `https://api.anthropic.com/v1/messages`, sem acrescentar dependência nova
  (`@anthropic-ai/sdk` não usado, propositalmente). Não exercitado pelos
  testes automatizados (que usam um cliente 100% falso/scripted).
- 9 testes novos em `__tests__/loop.test.js` (parada natural, encadeamento de
  múltiplas ferramentas, `perguntar_humano`, teto de iterações, kill switch,
  ferramenta desconhecida, defaults). `functions/package.json`'s `test` agora
  roda os dois pacotes de testes. 66 testes passando no total
  (57 `agente-agil/` + 9 `agente-agil-orquestrador/`).

Próximas etapas (não implementadas ainda): plugar o motor de escrita real
(`buildWritePlan`/`applyWritePlan`) nos handlers, rodar em `dryRun` contra um
squad de teste, tornar `SQUAD_ID` configurável. Nada aqui é chamado por
nenhum endpoint HTTP ainda — não requer `firebase deploy`.

## Agente Ágil (`functions/agente-agil/`)

### 2026-07-29 · PR #52
Corrige `mover_coluna` ficando silencioso ao mover um card pra coluna
intermediária: o fluxo manual (`kanban.html`/`notifMoved`, ver `handleDrop`)
notifica owner+participants em **qualquer** mudança de coluna há algum
tempo, mas `mover_coluna` do Agente Ágil só replicava a notificação de
coluna de fim (`notifDone`) — achado durante a validação manual do Sprint 3.
Divergência não intencional (o próprio comentário do arquivo sempre disse
"replica TODA movimentação manual"): o agente só ficou defasado depois que
`notifMoved` foi adicionado ao fluxo manual. Corrigido reaproveitando
`buildOwnerParticipantNotifSteps` também pra coluna não-final, com
`type:'moved'` e título `Card movido para {coluna}` (mesmo texto do
cliente). Teste de regressão atualizado pra confirmar a notificação em vez
de confirmar a ausência dela. **Requer `firebase deploy --only functions`
manual.**

### 2026-07-29 · PR #51
Corrige um bug bem mais sério, achado ao re-testar o fix da PR #50: nenhuma
escrita do Agente Ágil (nenhum dos 7 tipos de output — `comentario`, `link`,
`relatorio_html`, `checklist_item`, `agent_status`, `mover_coluna`,
`editar_campos`) nunca tocava `cards_updated_at/{cardId}`, o índice paralelo
que o cliente (`fbSaveCard`/`fbSaveAll` em `kanban.html`) sempre carimba
junto com qualquer escrita de card, e que o delta-sync
(`_planCardsDelta`/carregamento em duas etapas, ver PR #47/#48) usa pra
decidir se um card precisa ser rebuscado. Sem esse carimbo, toda mudança
feita pelo agente ficava invisível pro delta-sync — o board seguia servindo
a versão em cache de antes da chamada, pra sempre (nem no F5, nem ao vivo),
sem erro nenhum em lugar nenhum. Era exatamente por isso que o teste 6.2
(tags) continuava "sem efeito" na UI mesmo depois do fix da PR #50 gravar o
id certo no card. Corrigido centralizando o carimbo em `applyWritePlan()`
(`board.js`): quando o plano de escrita toca algum path dentro do card,
`updatedAt` do card e `cards_updated_at/{cardId}` são gravados no mesmo
commit lógico, com o mesmo timestamp — nenhum output builder precisa saber
disso individualmente. Regressão cobrindo os 7 tipos de output confirmando
o carimbo. **Requer `firebase deploy --only functions` manual.**

### 2026-07-29 · PR #50
Corrige `editar_campos` gravando tag "invisível" na UI: o especialista manda
o label legível (ex.: `"Piloto"`), mas `card.tags` é um array de IDs
internos (`kanban.html` resolve cada id via `getTag()` pra desenhar os
chips) — a função gravava o label cru sem resolver, então `getTag()` nunca
achava a tag e renderizava vazio, sem erro nenhum (achado na validação
manual do Sprint 3, teste 6.2). Mesma classe de bug já corrigida em
`checklistItem.js`/`resolveGroup()` pra grupo de checklist: agora
`editarCampos.js` resolve cada label contra
`kanban/squads/{squad}/dados/tags` (case-insensitive) e grava o `.id`
correspondente, mantendo o comportamento aditivo (nunca remove tag
existente). Label que não bate com tag nenhuma do squad agora é erro (400
`invalid_output`) em vez de gravar algo que a UI nunca vai conseguir
resolver. **Requer `firebase deploy --only functions` manual.**

### v2 — 2026-07-25 · PR #23 · tag `agente-agil-v2`
Sprint 3 — "vocabulário de ações": 4 novos tipos de output no envelope,
além de comentário/link/relatório — `checklist_item` (marca ou cria item +
grupo, grupo padrão "🤖 Processo automatizado" quando não especificado),
`agent_status` (status visível do agente no card, promove `executorType`
human→agent automaticamente), `mover_coluna` (move o card, decide coluna
de "fim" via `flowConfig.doneCols`) e `editar_campos` (descrição/
prioridade/tags — tags sempre aditivo, nunca remove). Toda ação nova
replica o que o cliente já faz numa edição manual (`recordMove`/
`recordHistory`/`createNotif`/`notifDone`/`notifChecklistDone`) — o agente
nunca muda um card silenciosamente: sempre grava histórico e, quando
aplicável, notifica dono/participantes/mencionados. Além disso, `@menções`
em `comentario`/`editar_campos.desc` passam a ser resolvidas e notificadas
do lado do servidor (antes, uma menção escrita pelo agente nunca
notificava ninguém, porque isso normalmente acontece no `<textarea>` do
cliente). O campo `notificar[]` do envelope, que já existia no schema mas
nunca tinha sido usado, também passa a funcionar.

### v1 Parte B — 2026-07-24 · PR #19 · tag `agente-agil-v1b`
Sprint 2: o envelope aceita `referencia` de negócio (`{tipo:'recorrente',
nome, data}`) além de `cardId` direto — o especialista externo (ex.:
Databricks) não precisa mais conhecer o id interno do card, só a
recorrência + a data da instância que quer atualizar. Resolvida via um
novo índice `recorrentes_index/{nome}/{data} → cardId`, mantido pelo
cliente no mesmo multi-path update que cria os cards recorrentes do dia
(mesmo espírito do `cards_index`). `cardId` e `referencia` são mutuamente
exclusivos — o schema exige exatamente um dos dois.

### v1 Parte A — 2026-07-23 · PR #6 · tag `agente-agil-v1a`
`cards_index` de verdade, mantido pelo cliente: `fbSaveAll()`/`fbSaveCard()`
escrevem o índice `id → chave` atomicamente junto com `/cards`;
`resolveCardKey()` na Cloud Function passa a ler esse índice pontualmente
(em vez de escanear `/cards` inteiro a cada chamada), com verificação +
retry e erro rastreável (`stale_cards_index`, HTTP 409) em caso de
divergência.

## `database.rules.json` (regras do Realtime Database, sem versão própria em `version.json`)

### 2026-08-20 — Escalação de privilégio: qualquer conta Google conseguia se auto-conceder acesso a um squad
Achado durante uma revisão de segurança pra internalização do projeto na
infra corporativa. A whitelist de "externos" (colaboradores não-
`@ciahering.com.br` autorizados pelo PO por squad, em Configurações) só
era checada em **JavaScript, na tela de login** — a regra de escrita de
`kanban/usuarios/$uid` permitia `auth.uid === $uid` (escrever o próprio
registro) sem checar domínio nem whitelist nenhuma. Como o fluxo de
login (`autoRegistrar()`) grava `squads/{squadId}: true` no próprio uid
pra completar o cadastro, **qualquer conta Google — mesmo sem nunca ter
sido convidada por ninguém — conseguia se auto-conceder acesso de leitura
e escrita a um squad inteiro**, bastando chamar a função direto no
console do navegador (pulando a tela de login, que é só JavaScript do
cliente, sem força de regra). A whitelist gerenciada pelo PO nunca era
consultada pela regra — só pela UI, que é contornável.

**Fix**: novo `.validate` em `kanban/usuarios/$uid/squads/$squadId` —
só permite gravar `true` se o email de quem está escrevendo termina em
`@ciahering.com.br` OU se esse email (normalizado) existe como chave em
`kanban/squads/{squadId}/externos` (whitelist do PO). Sempre permite
gravar `null` (sair de um squad). Pré-requisito: a whitelist de
`externos` precisou trocar de chave aleatória pra chave = próprio email
sanitizado (ver v8.30.449-dev do kanban-dev.html) — regra de Realtime
Database não consegue "procurar por valor" numa lista, só checar um
caminho exato, então sem essa mudança de chave a regra não teria como
validar a whitelist sem escanear tudo.

**Achado técnico ao validar a expressão da regra**: `.replace()` na
linguagem de regras do Firebase substitui só a **primeira** ocorrência
(diferente de `String.replace()` do JS com regex global) — a primeira
versão desta regra usava um `.replace('.', ',')` único, que quebraria
pra qualquer email com mais de um ponto (ou seja, praticamente todo
email real, já que só o domínio `@ciahering.com.br` tem 2). Corrigido
encadeando 8 `.replace('.', ',')` (cobre com folga qualquer email
plausível — cada chamada processa a próxima ocorrência restante).

**Passos manuais pendentes, nessa ordem**:
1. Rodar o script de migração de `externos` (re-chaveia as entradas
   existentes pro novo formato) — entregue à parte no chat.
2. Confirmar que o fix do `kanban-dev.html` (v8.30.449-dev) foi
   validado e promovido pra `kanban.html` (prod) — a regra nova, uma
   vez publicada, também vale pra prod, e o `salvarExterno()` de lá
   ainda grava no formato de chave antigo até a promoção acontecer
   (janela de falha segura: só atrasa onboarding de externo novo,
   não reabre a brecha).
3. `firebase deploy --only database` manual, na sua máquina.

Nenhum externo ou membro já cadastrado perde acesso com este deploy —
`.validate` só se aplica a escritas novas, não apaga concessões já
gravadas.

### 2026-08-12 — Regra faltando pra `backups`: o recurso de Backup nunca gravou nada, pra ninguém
Achado investigando um relato de card sumido (squad Mídia Criativa) —
tentando ver se dava pra recuperar via snapshot de backup, veio
`Uncaught (in promise) Error: Permission denied` ao ler
`kanban/squads/{squad}/backups`. Causa: esse path nunca teve regra
nenhuma neste arquivo — só existe regra pra `kanban/squads/{squad}/
snapshots` (feature diferente e não relacionada, de métricas diárias
usadas no CFD/Burndown). `fbSet()` engole erros de escrita
silenciosamente por design ("evita loop com logError"), então
`saveSnapshotToFirebase()` vem falhando 100% das vezes, pra TODO
squad, desde sempre, sem nenhum aviso — a aba ⚙ Config → Backup
provavelmente sempre mostrou "nenhum snapshot salvo" achando que
ninguém tinha rodado um backup ainda, quando na real todos os
backups (manuais e automáticos) estavam sendo descartados
silenciosamente pelas regras.

**Fix**: novo bloco `kanban/squads/$squadId/backups` com `.read`/
`.write` idêntico ao de `snapshots` (`auth != null` +
`@ciahering.com.br`). **Requer `firebase deploy --only database`
manual** pra valer — a partir daí, backups (manuais e automáticos)
passam a persistir de verdade. Não recupera o card específico que
motivou a investigação (não havia nenhum snapshot salvo até agora,
óbvio), mas previne que o mesmo aconteça daqui pra frente.

### 2026-07-31 · Regras pra integração com Spotify ("ouvindo agora")
Duas adições, ambas pra suportar a primeira leva da integração com
Spotify (ver entrada de `v8.30.232-dev` no `kanban-dev.html`):

- `kanban/spotify_secrets`: `.read`/`.write: false` incondicional — o
  `refresh_token` OAuth de cada pessoa não pode ser lido por nenhum
  cliente (só Admin SDK, usado pela Cloud Function). Ficou
  deliberadamente FORA da árvore `kanban/usuarios` — essa árvore já tem
  `.read: "auth != null"` no nível raiz, e regras do Realtime Database
  cascateiam só numa direção (um `.read: false` mais profundo não revoga
  um acesso já concedido por um ancestral) — aninhar o token ali dentro
  deixaria ele legível por qualquer pessoa logada, mesmo com `.read:
  false` no nó específico.
- `kanban/oauth_pending/$state`: ponte de uso único entre o cliente
  iniciando o fluxo OAuth e o callback recebendo o redirect do Spotify
  (que não sabe nada sobre uid do Firebase). `.write` exige que o
  registro criado aponte pro próprio uid de quem está escrevendo;
  `.read: false` (só a function precisa ler, via Admin SDK).

Os nós de status público (`spotify_now` por squad, `spotify_now_geral`)
não precisaram de regra nova — já caem dentro de `dados`/`painel`, que já
têm regras adequadas.

**Precisa de `firebase deploy --only database` depois do merge.**

### 2026-07-27 · PR #30
Corrige a causa raiz de notificações entre membros comuns nunca chegando
(mas chegando normalmente quando quem dispara a ação é `po`/`adm`):
`createNotif()` no cliente escreve direto em `kanban/usuarios/{uid-do-
destinatário}/notificacoes/{id}` — é assim que menção, atribuição,
desbloqueio etc. funcionam, quem dispara a ação escreve no nó de quem vai
ser avisado. A regra de `kanban/usuarios/{uid}` só liberava escrita pro
dono do próprio nó ou pra `po`/`adm`, então um membro comum notificando
outro membro comum tinha a escrita rejeitada (`PERMISSION_DENIED`) em
silêncio — só um `console.warn`, nenhum erro visível, nenhuma notificação
criada. Adiciona uma regra específica pra `notificacoes/$notifId`: qualquer
pessoa autenticada do domínio pode criar uma notificação nova em qualquer
conta; só o dono do nó ou `po`/`adm` pode modificar/apagar uma que já
existe (marcar como lida, limpar expiradas).
**Precisa de `firebase deploy --only database` depois do merge** — só
commitar/mergear este arquivo não muda as regras que já estão ao vivo no
Console.

### 2026-07-27 · correção da PR #30 (mesmo dia)
A regra acima exigia `auth.token.email.endsWith('@ciahering.com.br')` — mas
o app aceita convidados/freelancers com email fora desse domínio
(`role:'convidado'`, ver aviso na aba de acesso do painel), e eles ficaram
de fora tanto de mandar quanto de receber notificação. Removida a exigência
de domínio da regra de `notificacoes/$notifId`: agora basta estar
autenticado (`auth != null`) pra criar uma notificação nova em qualquer
conta; modificar/apagar uma existente continua exclusivo do dono do nó ou
`po`/`adm`. (Mesma restrição de domínio também bloqueia convidados de
atualizar `presence/$uid` — bug preexistente, fora do escopo desta correção,
sinalizado mas não alterado aqui.)
