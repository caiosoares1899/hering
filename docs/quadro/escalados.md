# Quadro: detalhe dos itens escalados

> Texto completo de cada item de "Escalado" do [`QUADRO.md`](../QUADRO.md), movido sem edição de `docs/COORDENACAO_AGENTES.md` em 11/11/2026.

<a id="radar-reduced-motion"></a>

| Quem achou | O que | Como reproduzir | Data |
|---|---|---|---|
| Claude | `okr-dev.html` não tem bloco `@media (prefers-reduced-motion: reduce)`: o `okrPulse` infinito do "digitando…" do Agente (`.okr-agente-typing`) roda mesmo com movimento reduzido. Entra na rodada `codex/radar-uiux` (o arquivo está reservado). | `grep -c prefers-reduced-motion okr-dev.html` → 0 | 09/11/2026 |

<a id="apresentacao-live"></a>

**Resolvido em 18/11/2026.** O teste tinha uma expectativa anterior ao hotfix de 15/10. A pausa local se mantém enquanto não há nova navegação do apresentador ou ADM. O teste passa a cobrir essa pausa, o botão de voltar a seguir e o retorno automático quando a sala muda de slide.

<a id="travessia-humor-inteiro"></a>

| Quem achou | O que | Como reproduzir | Data |
|---|---|---|---|
| Antigravity | `database.rules.json` (`travessia/humor/$uid/$dia` e `humor_comp`, L344/L365/L386): `.validate` aceita float entre `1` e `5` (ex.: `1.5`), sem exigir inteiro. O front (`travessia-dev.html`) já foi blindado com `faceDe()`, mas vale exigir `% 1 === 0` na regra. | gravar `{n: 1.5, ts: ServerValue.TIMESTAMP}` em `travessia/humor_comp/{uid}/{dia}` | 11/11/2026 |

<a id="seguranca-regras-c3-c4"></a>

| Quem achou | O que | Como reproduzir | Data |
|---|---|---|---|
| Antigravity | **Segurança (`database.rules.json` · `/auditoriaseguranca` de `painel-dev.html`):** 5 achados de regras RTDB confirmados por simulador (**✅ C1/C2 tratados pelo Claude em 11/11/2026 — PR das regras de papel; faltam C3, C4, D7/D8**) (`functions/rules/rulesSim.js`) e escalados sem editar `database.rules.json`: **(C1 · Alta)** escalada PO→ADM em `kanban/usuarios/$uid` (`L816–819`: `@ciahering` com `role === 'po'` consegue gravar `role: 'adm'` no próprio `$uid` ou rebaixar ADM, destravando `config/adm_emails/.write` `L789`, `painel_viewers/.write` `L779` e `config/agente_agil_orquestrador/.write` `L791`); **(C2 · Média)** auto-promoção em `kanban/usuarios/$uid` (`L816–832`: `auth.uid === $uid` aceita campos arbitrários sem `.validate`, permitindo gravar `gestorOkr: true` e `torre: 'geral'`, o que destrava `okr/datastudio/.write` `L199`); **(C3 · Alta)** leitura ampla concedida a `painel_viewers` externos nos nós-pai `kanban/painel_viewers` (`L778`: expõe lista completa de e-mails/nomes de todos os convidados), `kanban/painel` (`L172`: expõe `painel/config/backup_cfg` com chaves EmailJS), `kanban/config` (`L788`: expõe `adm_emails` e `webhookUrl` de `agentesExternos`), `kanban/feedback` (`L30`) e `kanban/squads/$sq/error_logs` (`L61`); **(C4 · Média)** `kanban/feedback/.write` (`L31`) na raiz permite a externo de 1 squad sobrescrever/apagar todo o nó; **(D7/D8 · Média)** `kanban/comunicados/.write` (`L26`) aceita qualquer `@ciahering` (não só ADM) e faltam regras para `campanhas_dev`/`feedback_dev`. ⚠️ **Aviso explícito do Caio:** ao apertar `database.rules.json` (especialmente C3/C1), **cuidado redobrado para NÃO bloquear os autorizados externos de entrar no Maré Digital** (`squads/$sq/externos` + `usuarios/$uid/squads` + `mare-login.js`) nem quebrar o `_check` de `painel_viewers` no boot do `painel.html` (`L10477`, que hoje lê `kanban/painel_viewers` inteiro — exigir migração coordenada para leitura por chave `$emailKey` antes de fechar o nó-pai). | `rulesSim.js` em `database.rules.json` (`L26,30-31,61,172,199,778-779,788-791,816-832`) | 11/11/2026 |


<a id="gantt-pedidos-radar"></a>

## Gantt: pedir atualização e calendários no Radar — 13/11/2026

> ✅ **Os dois itens no dev em 13/11/2026**: (2) calendários no Radar (#1774) e (1) 📣 Pedir atualização — Comercial Hering = squads `app` + `site` (o Caio confirmou que "Adulto" é a Squad Site Hering), Marketplace = `mktplace`, Outlet = `outlet` (não a `outlet-crm`), Marca = Caio.

Pedido explícito do Caio, com esclarecimentos na sessão Codex:

1. Botão **Pedir atualização** contextual nas abas dos calendários do Gantt. Destinatários: Marketplace → pessoas da squad Marketplace; Comercial Hering → pessoas das squads Adulto e App; Outlet → pessoas da squad Outlet Comercial; Marca → Caio. Confirmar os IDs reais das squads pelo cadastro, sem inferir pelo nome visível. Deduplicar destinatários quando participarem de mais de uma squad. Não exportar cadastros ou dados pessoais. A notificação deve identificar o calendário solicitado e levar ao local de atualização. Definir proteção contra clique duplicado/repetição, usando os mecanismos existentes.
2. No calendário do Radar, disponibilizar os **mesmos calendários extras do Maré**: Marca, Comercial Hering, Marketplace e Outlet, com a visão Gantt. Caio esclareceu que não está pedindo Gantt de objetivos/marcos do Radar. Reutilizar a fonte dos calendários, sem duplicar dados. Navegação, período e filtros devem ter comportamento coerente com o Maré; leitura sob demanda.

**Encaminhamento ao Claude:** escopo R2 por envolver Maré, Radar e possível módulo compartilhado de notificações; AGENTS.md exige escalar módulo compartilhado/redesenho. Se exigir backend ou regras novas, separar avaliação R3 antes de implementar. Codex não iniciou alterações funcionais.

**Aceite proposto:** dev primeiro; notificações apenas aos destinatários do calendário escolhido (Marca só Caio), sem duplicar; calendários compartilhados exibidos no Radar; estados vazio/carregando/erro; desktop 1280 e toque 390, três temas, sem overflow; testes fakefb e checks completos; Ajuda/dicas/versões atualizadas. Sem merge, deploy ou promoção.


<a id="calendario-ferias-digital"></a>

## Ideia: calendário geral de férias do Digital — 13/11/2026

Caio pediu para deixar salva, como visão dentro de **Calendário**, uma agenda geral de férias do Digital. Cada pessoa pode cadastrar as próprias férias, e os períodos ficam visíveis para todo o Digital. Objetivo: consultar ausências e planejar entregas/cobertura entre equipes.

**Requisitos confirmados:** visão geral compartilhada; cadastro das próprias férias; filtros para consultar a agenda. Preferência de localização: dentro de Calendário, em vez de tratar como uma aba comercial do Gantt.

**Sugestões para o desenho (a confirmar, não decisões do Caio):** filtros por pessoa, squad e período; visualização mensal e faixas de duração; edição/cancelamento dos próprios registros. Definir em qual calendário/página entra e o alcance exato de "todo mundo" antes da implementação; não presumir acesso de convidados externos. Aprovação de férias, integração com RH, saldo e notificações não foram solicitados.

**Encaminhamento ao Claude:** desenhar fluxo e permissões antes do código; cadastro persistente/novo nó requer avaliação R3, regras garantindo autoria e visibilidade, backup e testes. Verificar se há dados/fluxos de férias existentes para reaproveitar. Ideia registrada, sem implementação.


<a id="modo-ferias"></a>

## Ideia: 🏖️ Modo férias (junto com o calendário geral de férias) — 13/11/2026

Pedido do Caio, complementa a [agenda geral de férias](#calendario-ferias-digital) — os dois viram uma coisa só:

1. **Cadastro das próprias férias** (período), visível para todo mundo e lançado no **calendário** (a agenda geral de férias da ideia acima).
2. **Alerta ao mencionar/marcar** alguém de férias: ao @mencionar, atribuir ou pôr como participante uma pessoa que está de férias, um aviso na tela ("Fulana está de férias até 28/11").
3. **Conferência antes de sair:** em tese a pessoa cadastra antes; se ela **ativar o modo férias sem ter cadastrado**, o cadastro passa a ser obrigatório (não ativa sem período).
4. **Passagem dos itens dela:** ao ativar, uma tela para decidir **cada card e cada Objetivo/Marco** dela — ⏸ pausar ou passar para outra pessoa — com confirmação item a item.

**Para o desenho (a confirmar):** onde fica o interruptor (Oceano/perfil?); quem vê o cadastro (só empresa, como os calendários); o alerta usa o mesmo nó do calendário; pausa = ⏸ Pausar card que já existe; passar = reatribuir com histórico + notificação. Nó novo e regras → avaliação R3 (autoria: cada um grava as próprias férias; ADM corrige).

<a id="periodo-historico"></a>

## Conferir: histórico do período e hora do card — 13/11/2026

Caio pediu para o histórico do card registrar quando alguém define período e hora. **Já existe desde 12/11 (PR 1a):** "Início: — → 10/11", "Fim: …", "Hora do prazo: …", no autosave e no Salvar (`test_card_periodo.js`). Se aparecer um caso sem registro, anotar QUAL caminho (Agente, duplicar, outra tela) — esse é o bug.

<a id="gantt-favorito-avisos"></a>

## Ideia: Gantt — aba favorita e avisos de mudança — 13/11/2026

Pedido do Caio:

1. **⭐ Aba favorita:** a pessoa escolhe qual Gantt abre primeiro (Cards da squad, Marca, Comercial Hering, Marketplace, Outlet ou 🧭 Digital · dia a dia), no Maré e no Radar. Hoje cada um lembra a última aba usada só no aparelho (`localStorage`); o favorito seria uma preferência da pessoa (segue para outros aparelhos), com ⭐ na própria aba.
2. **🔔 Avisos de mudança no Gantt:** opção de **se inscrever** para receber notificação quando um calendário mudar (ex.: "📊 Comercial Outlet atualizado por Fulana: ＋3 ✎1 −0"). A pessoa escolhe quais calendários segue. Encaixa no sino único (`mare-notif`): tipo novo + entrada na Central de Notificações; o gatilho é a publicação (que já grava a linha no 🕘 Histórico com ＋/✎/−).

**Para o desenho (a confirmar):** onde fica a inscrição (botão 🔔 na aba do calendário? Minhas Preferências?); push ou só sino; agrupar várias publicações seguidas; o aviso leva direto à aba do calendário (Maré e Radar). Inscrição e envio mexem em nó/regras e provavelmente numa function (fan-out) → avaliação R3. Relacionado: [pedir atualização](#gantt-pedidos-radar).

<a id="gantt-celular"></a>

## Ideia: 📱 Gantt no celular — texto não cabe — 13/11/2026

No celular (390 px) os dias são estreitos e nenhum texto cabe nas barras: sobram só as barrinhas. Caminhos a avaliar: janela menor no celular (2 semanas em vez de 6, com dia mais largo), nome da barra fora dela/ao lado quando não cabe, toque abre um painel com a lista do dia/da barra, ou uma lista por período no lugar da régua. Vale para os cards e para os calendários (Maré e Radar).

<a id="gantt-digital-por-dia"></a>

## Ideia: Gantt — visão consolidada Digital por dia — 13/11/2026

> ✅ **No dev em 13/11/2026** como **🧭 Digital · dia a dia** (Maré e Radar; régua única + painel do dia, decisão do Caio). Ver CHANGELOG.

Caio pediu para anotar uma visão no Gantt que reúna **todos os calendários comerciais por dia**, permitindo consultar, em cada data, o conjunto de ações do Digital.

**Escopo registrado:** consolidar Comercial Hering, Comercial Marketplace e Comercial Outlet numa mesma visão diária, preservando a identificação do calendário de origem de cada ação. Reutilizar os dados já publicados, sem exigir outra planilha ou cadastro duplicado. O pedido é de calendários comerciais; Marca não foi incluída explicitamente.

**Objetivo:** enxergar o que acontece simultaneamente em cada dia entre as frentes comerciais e facilitar alinhamento e planejamento do Digital.

**Desenho a definir com Claude:** apresentação da visão diária dentro do Gantt, tratamento de ações que duram vários dias e filtros por origem/frente e período. Esses detalhes são propostas para desenho, não decisões já confirmadas. Ideia salva, sem implementação.


<a id="gantt-favorita-autoria"></a>

## Prova de permissão da ⭐ aba favorita — exceção aceita — 13/11/2026

Contrato do Caio exige, antes do front, provar com `functions/rules/rulesSim.js` que só a própria pessoa grava `kanban/usuarios/{uid}/gantt_favorita`. Prova executada na main `925a144d`, com dados sintéticos: autora Google Hering grava `outlet` e `null`; outro membro comum é negado; **outro usuário com role PO ou ADM consegue gravar ambos**. A `.write` de `usuarios/$uid` concede escrita ao próprio uid ou Google Hering com role PO/ADM (e exceção administrativa existente). Logo, o critério literal "outra pessoa não consegue" não passa.

**Parada prevista no contrato:** nenhuma implementação funcional ou mudança em regras. Para exclusividade estrita, Claude precisa desenhar a correção R3: `.write` em nó ancestral não pode ser restringida apenas por `.write` no filho; exclusão `null` também precisa ser protegida. Alternativamente, Caio pode esclarecer que a exceção administrativa existente é aceita e ajustar o critério antes de retomar o front R1.

**Retomada autorizada pelo Caio e Claude:** outro membro comum deve ser negado; PO/ADM mantêm a exceção administrativa já existente. Preferência sem efeito de acesso, validada por lista de abas em cada app. Continua R1, sem alteração em `database.rules.json`.


## Cards sensiveis 1611

Rodada `/monitorarbugs` de 16/11/2026, Codex. ESCALAR AO CLAUDE: `kanban-dev.html` reservado no Quadro; código não alterado.

- Alta (integridade), `fbSaveCard`: espelho aponta A na chave 0, mas compactação/reordenação já pôs B ali no banco. Transação encontra id divergente e aborta, porém `updates['cards/0']` permanece e o update seguinte substitui B por A. Recusar/relocalizar por identidade, nunca gravar na posição antiga após abort. Prova local: ocupante final editado; esperado outro.
- Média, `_performAutoSave`: card em todo; escolher done e editar descrição para agendar autosave. Persiste coluna e notifica sem chamar `recordMove`: flow.log/enteredAt/firstStartAt/doneAt não acompanham. Salvar manual, arrasto e menu registram fluxo. Prova mede ausência de chamada à função canônica.
- Média, `createNotif`: duas abas de PO/ADM leem ausente para mesmo idOverride; primeira cria, destinatário lê, resposta atrasada da segunda grava read:false. Regra permite sobrescrita por PO/ADM ou dono da caixa; membro comum em caixa alheia é barrado. Dedupe de 5 s é local. Criar condicionalmente de forma atômica; conferir permissão de leitura/transação antes de escolher solução.

Revisão independente tentou refutar: confirmou os dois primeiros e qualificou o terceiro pelas regras reais. Teste Chromium com funções extraídas da página real, banco/dependências falsos: `node docs/arezzo/testes/test_cards_sensiveis_1611.js` → 3/3 falhas esperadas até correção. Console isolado/read-only: `docs/arezzo/testes/console_cards_sensiveis_1611.js`, validado por check-script. Não acessa Firebase real.

Cobertura: primitivas criar/salvar/lote; autosave × Salvar e wrapper; movimentação mouse/toque/menu; criação/dedupe de notificações pessoais. Criação inspecionada sem novo defeito confirmado. Não cobre push/FCM completo, todos os produtores server-side, regras implantadas ou dados reais. Sem evidência de ocorrência em produção. Fronteira: sem alteração; bugs de integridade dentro do modelo interno aceito. ADM valida em dev após correção, nunca o agente.


<a id="apresentacao-sem-rolagem"></a>

## Apresentação do Radar sem rolagem — 18/11/2026

**Escalado ao Claude.** Redesenho localizado na composição inteira do detalhe do Objetivo para quem apresenta no PC. A #1862 melhora contraste, distribuição do rodapé e leitura da tabela. O detalhe ainda reserva áreas separadas para contexto, Marcos e quatro listas do rodapé, com alturas ajustadas em `_okrFitDetailSections()`. Cada área que transborda rola por conta própria, mesmo quando outra tem espaço sobrando.

**Como reproduzir.** Abrir o Objetivo `o3` de `docs/arezzo/testes/seed_apresentacao.js` no Chromium com Firebase falso a 1280 × 900. São 14 marcos, descrição longa e listas de discussão. No ensaio após a #1862, a tabela ainda rolava 60 px. A mesma tabela cabia a 1920 × 1080. Compare também 1366 × 768, com título comprido e rodapé curto e cheio.

**Critérios de aceite.**

- Medir o espaço e o conteúdo reais. Blocos curtos ou vazios ocupam menos espaço, e blocos cheios aproveitam a sobra. Preservar ordem de leitura e métricas.
- Mostrar o máximo de conteúdo legível sem rolagem na página ou em painéis internos. Usar o piso atual de 16 px como ponto de partida para nomes de marcos.
- Se tudo não couber, preservar o contexto e indicar claramente quantos itens ficaram para uma continuação. Validar com Caio a prioridade dos blocos e a navegação da continuação antes de alterar o fluxo ao vivo.
- Comparar quantidade de conteúdo visível, fonte efetiva e ausência de overflow com dados simulados: sem marcos, 14 e 50 marcos, título longo e listas de riscos/próximos passos longas. Conferir também redimensionamento, teclado e apresentação ao vivo.

<a id="apresentacao-linha-dagua"></a>

### Evolução do atingimento — meta como linha d’água

**Pedido do Caio para o Claude, na mesma rodada da apresentação.** Na referência visual “10 - Outubro - Se Liga no Cardume DIGITAL.jpg”, a linha pontilhada na superfície separa os pontos submersos dos pontos acima da água. No gráfico de **Evolução do atingimento** do Radar, essa linha representa a **meta do Objetivo**. Use o tratamento visual Marine Glass e mantenha a série legível no projetor. A imagem de referência não está no repositório: peça ao Caio antes de desenhar.

- **Aquém da meta:** ponto submerso. **Na meta:** ponto na linha d’água. **Além da meta:** ponto acima da água. Rotule a linha com a meta e sua unidade. Use texto, além da diferença de fundo, para indicar de que lado está o resultado.
- Preserve datas, valores registrados, unidades e cálculo oficial de atingimento. O percentual oficial é limitado a 100%, portanto a posição dos pontos deve aproveitar os valores registrados, que já são usados pelo gráfico, para mostrar a superação.
- Para metas em que **reduzir é melhor** (tipo `abaixo` ou meta menor que o valor inicial), o lado bom segue o sentido da meta. Exemplo com meta de R$ 100: R$ 90 acima da água, R$ 100 na superfície, R$ 110 submerso. Se inverter o eixo nesses casos, deixe o sentido explícito e preserve os rótulos de valores reais.
- Aplique primeiro ao gráfico numérico da apresentação (`_okrAtingChartHtml`). Mantenha o comportamento atual dos tipos sem série numérica comparável e a evolução sem registros. Valide cruzamentos em ambos os sentidos, ponto exatamente na meta e leitura em 1280 × 900 e Full HD.
