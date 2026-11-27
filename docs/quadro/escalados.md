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

### Ajuste de escopo após a #1866

**O print do Caio é posterior ao merge.** O caso tem 7 Marcos, 6 itens em Progressos, 1 Próximo passo, 1 Risco e nenhum Plano de ação. Progressos fica estreito, os painéis curtos deixam uma área grande vazia abaixo do conteúdo, e o contexto à esquerda ainda rola. Reproduzir com textos fictícios de comprimentos comparáveis.

A #1866 mede altura e, quando detecta desequilíbrio, volta a dividir a largura em partes iguais. A regressão hoje considera suficiente que corpo seja maior que rodapé e Progressos e Riscos tenham a mesma largura. Esse critério ainda permite o desperdício do print.

**Prioridade atualizada do Caio:** recalcule largura e altura em conjunto. Use largura suficiente para os textos curtos e redistribua a sobra para as listas que mais ganham linhas legíveis. Meça as alturas novamente após a quebra de linhas. Reduza a altura dos painéis curtos e esvazie a reserva de altura dos painéis vazios; devolva a altura liberada à região de Marcos e ao contexto. Se houver disputa, aceite rolagem interna em Progressos antes de reduzir a área ou a fonte dos Marcos. Esta preferência substitui o requisito anterior de zero rolagem a qualquer custo.

**Aceite do caso do print:** compare lado a lado com a versão pós-#1866 em 1280 × 900 e Full HD. Os sete Marcos ficam visíveis na fonte atual, quando couberem, e Progressos não força as outras três colunas a formar painéis altos e vazios. Meça altura ociosa nos painéis curtos e altura útil na parte de cima; confirme também o caso inverso, com Riscos e Próximos passos longos.

### Proposta de implementação para o Claude

**1. Escolher a largura pelo texto renderizado.** Evoluir `_okrMedirDivisaoDetalhe()`. Testar poucas distribuições do grid, começando pela atual, uma com Progressos mais largo e outra com Próximos passos e Riscos mais largos. Um bloco vazio pode virar uma linha compacta de estado vazio fora do grid, liberando sua coluna. Para cada candidato, ler a altura natural das listas na largura real, com a fonte final, incluindo espaçamento entre itens, título e moldura. Contar itens inteiros visíveis, pois ampliar uma coluna só vale a pena se reduzir quebras e liberar altura ou expuser mais conteúdo. Em empate, manter a distribuição atual para evitar que o slide fique repaginando por diferenças mínimas.

**2. Reservar altura de cima antes de expandir Progressos.** Estender `_okrDividirDetalhe()` para receber a altura dos Marcos em fonte normal, a altura do contexto e a altura medida de cada cartão do rodapé. Em cada candidato, reservar espaço para os Marcos e uma faixa que acomode Riscos e Próximos passos curtos. Usar o espaço restante para recuperar conteúdo do contexto à esquerda e expandir Progressos. Se nem os Marcos couberem na área útil, garantir uma faixa legível de Riscos e Próximos passos e entregar o restante aos Marcos. Progressos e Planos usam apenas a sobra desse orçamento. Manter o cabeçalho da tabela fora da rolagem.

**3. Aplicar altura individual aos cartões.** O rodapé recebe um teto, mas cada cartão usa a menor entre sua altura natural e esse teto. Usar alinhamento pelo topo e limitar a lista interna à altura disponível depois do título e do padding. Tirar a imposição da mesma altura para todas as `.d2-fcol`. Se Progressos transbordar, ele ganha rolagem interna; Riscos com uma linha ficam com altura de uma linha mais moldura. O corpo recebe a altura que o rodapé liberar. Escolher o candidato que, nessa ordem, mostra mais Marcos inteiros, mantém os itens prioritários visíveis, revela mais contexto e reduz área vazia.

**Exemplo de orçamento, com números ilustrativos.** Se houver 680 px úteis, os sete Marcos precisarem de 430 px, o contexto de 480 px, os cartões curtos de 110 px e Progressos de 310 px, reservar 480 px para cima e limitar o rodapé a 200 px. Os cartões curtos continuam com 110 px e só Progressos rola. Se uma coluna de Progressos mais larga derrubar a altura natural de 310 para 190 px, ela passa a caber inteira e devolve mais 10 px à parte de cima.

**Regressão a acrescentar.** Usar a fixture do print com 7 Marcos e textos longos, 6 Progressos, 1 Risco, 1 Próximo passo e Planos vazio. Comparar com o mesmo HTML da #1866 a 1280 × 900 e 1920 × 1080. Medir a quantidade de Marcos inteiros visíveis, tamanho efetivo da fonte, altura útil do contexto, rolagem de cada lista e altura de cada cartão em relação ao próprio conteúdo. O teste deve falhar se os cartões curtos continuarem esticados até a altura de Progressos, mesmo que o corpo seja maior que o rodapé. Cobrir também listas prioritárias longas, ausência de rodapé preenchido e troca de Objetivo ou tamanho da janela. Recalcular a partir do conteúdo natural a cada troca, com medição limitada às poucas alternativas do grid.

### Revisão dos avisos de texto no formulário do Radar

`okr.html` e `okr-dev.html` usam os mesmos avisos em `OKR_CHAR_LIMITS`: descrição do Objetivo 200, nome do Marco 70, descrição do Marco 110, e 90 por item em Indicadores, Progressos, Próximos passos, Riscos e Planos de ação. Título e Pilar Estratégico não têm esse aviso. O contador avisa acima do valor recomendado e o formulário aceita o texto completo. A colagem de várias linhas adiciona os itens diretamente e não mostra o aviso por item depois que eles entram na lista. A inclusão e a edição contam com `.length`, que conta unidades UTF-16: 46 emojis simples como o peixe aparecem como 92.

A conta original usava colunas fixas e larguras estimadas. Na apresentação atual, com Firebase falso e textos inseridos nos elementos da tela já renderizada, 90 caracteres de texto corrido ocuparam 4 linhas em Progressos e 3 em Riscos a 1280 × 900. Em Full HD, ocuparam 3 e 2 linhas. A descrição de 200 caracteres ficou em 5 linhas nos dois tamanhos com texto corrido, e variou de 3 a 7 linhas a 1280 px em amostras sintéticas de letras estreitas e largas. A medição compara a quebra de linha na geometria já calculada; não mede a redistribuição completa após salvar.

**Direcional para o Claude:** recalibrar os avisos após fechar a composição do slide. Definir primeiro um orçamento de linhas por campo e por bloco, inclusive o efeito acumulado de vários itens. Usar textos de referência (acentos, emoji, palavras longas e quebras) no Chromium a 1280 × 900 e Full HD. Preferir aviso consultivo por linha estimada ou por seção cheia, com a contagem de caracteres como referência. Mostrar a mesma orientação ao digitar, editar e colar em lote. Se o texto do contador continuar dizendo “caracteres”, alinhar o contador de ambos os caminhos a caracteres percebidos, por exemplo com `Intl.Segmenter`. Preservar texto existente e gravação integral. Conferir exatamente no limite e acima dele, além de vários itens que individualmente cabem mas juntos ocupam demais.

<a id="apresentacao-linha-dagua"></a>

### Evolução do atingimento — meta como linha d’água

**Pedido do Caio para o Claude, na mesma rodada da apresentação.** Na referência visual “10 - Outubro - Se Liga no Cardume DIGITAL.jpg”, a linha pontilhada na superfície separa os pontos submersos dos pontos acima da água. No gráfico de **Evolução do atingimento** do Radar, essa linha representa a **meta do Objetivo**. Use o tratamento visual Marine Glass e mantenha a série legível no projetor. A imagem de referência não está no repositório: peça ao Caio antes de desenhar.

- **Aquém da meta:** ponto submerso. **Na meta:** ponto na linha d’água. **Além da meta:** ponto acima da água. Rotule a linha com a meta e sua unidade. Use texto, além da diferença de fundo, para indicar de que lado está o resultado.
- Preserve datas, valores registrados, unidades e cálculo oficial de atingimento. O percentual oficial é limitado a 100%, portanto a posição dos pontos deve aproveitar os valores registrados, que já são usados pelo gráfico, para mostrar a superação.
- Para metas em que **reduzir é melhor** (tipo `abaixo` ou meta menor que o valor inicial), o lado bom segue o sentido da meta. Exemplo com meta de R$ 100: R$ 90 acima da água, R$ 100 na superfície, R$ 110 submerso. Se inverter o eixo nesses casos, deixe o sentido explícito e preserve os rótulos de valores reais.
- Aplique primeiro ao gráfico numérico da apresentação (`_okrAtingChartHtml`). Mantenha o comportamento atual dos tipos sem série numérica comparável e a evolução sem registros. Valide cruzamentos em ambos os sentidos, ponto exatamente na meta e leitura em 1280 × 900 e Full HD.

### Revisão visual da linha d’água após a #1868

**Escalado ao Claude.** Redesenho do modal de Evolução na apresentação. O Caio aprovou a metáfora e pediu reorganização visual. Referência de reprodução: Objetivo com título longo, meta financeira de R$ 80 mil, valor inicial de R$ 36 mil e quatro registros fictícios de R$ 12 mil, R$ 21 mil, R$ 36 mil e R$ 51 mil, todos submersos. Boot real da apresentação com Firebase falso, código da origem em `467760a8`, 1280 × 900, Full HD e 390 × 800. A apresentação usa tema próprio.

| Achado | Evidência e efeito |
|---|---|
| Hierarquia disputada | Resumo, barra rosa, quatro rótulos sobre pontos, três linhas com estilos marcantes e histórico repetem ou disputam a atenção com a evolução. O SVG tem 15 rótulos já com quatro registros. |
| Marcadores pesados | Um peixe laranja e um rótulo contornado a cada registro dominam a série. O primeiro e o último peixe avançam para fora da área de plotagem. |
| Contraste e escala | Datas e eixo ficam apagados. O SVG mede 718 × 346 px tanto em 1280 quanto em 1920. A 390 px, o SVG inteiro encolhe para 316 × 152 px, com rótulos difíceis de ler, sem overflow horizontal do documento. |
| Dois níveis de informação competem | A lista de registros ocupa espaço vertical logo abaixo da visualização e usa uma borda colorida por linha. A projeção precisa da tendência, da meta e do valor atual antes dos detalhes de todos os registros. |

**Direção de implementação.**

1. Separar o título fixo “Evolução do atingimento” do nome do Objetivo em uma linha secundária. Alinhar valor atual, delta até a meta e período numa faixa curta de leitura. Reaproveitar valores existentes e manter o atingimento oficial com seu significado atual; se o delta for exibido, rotular em unidade real e conferir o sentido para “menor é melhor”. Avaliar remover a barra rosa redundante deste modal se o atingimento oficial continuar identificável no resumo.
2. Usar a linha d’água como única referência forte no SVG, com rótulo direto da meta e fundo submerso discreto. Elevar o contraste de datas e eixo, manter grade quieta e mover “Aquém da meta / Meta superada” para uma legenda compacta fora da área de dados. Quando a referência inicial for importante, torná-la secundária e evitar ticks quase coincidentes com ela. Usar traço sólido para a série e reservar pontilhado para a meta.
3. Usar pontos simples na série e um peixe discreto apenas no registro atual. Mostrar o valor atual junto ao ponto com margem de segurança; manter valores intermediários no foco, toque e lista. Reservar margem para primeiro e último ponto e evitar colisão com a meta, eixos ou borda. Preservar o eixo temporal, os valores reais, a semântica de igualdade e a direção de metas de redução.
4. Tratar “Registros” como detalhe secundário, com ação explícita para expandir e navegação por teclado. Expandido, usar linhas compactas de data, valor e atingimento com números alinhados. Usar largura e altura do modal de acordo com o espaço do projetor, reservando espaço para título e controles. Em viewport estreito, reduzir ticks e rótulos explícitos com tipografia legível, preservando acesso aos dados e ao botão de fechar.

**Aceite.** Comparar capturas antes/depois a 1280 × 900 e 1920 × 1080. A meta e o último valor devem ser identificáveis sem abrir Registros. Checar ausência de colisões e recortes com 1 ponto, os 4 pontos descritos, 50 registros, título longo e série que cruza a linha nos dois sentidos. Validar todos acima, todos abaixo, ponto na meta e meta de redução. Checar foco, toque, fechamento por Esc, estado vazio e 390 px. Não mudar fórmula, histórico ou dados; partir de `_okrAtingChartHtml()` e `_okrAtingChartPanelHtml()` em `okr-apresentacao.slide.html`.

**Ajuste de direção do Caio:** recuperar o neon da versão anterior e deixar a composição mais próxima do Marine Glass do Radar. Usar como referência lado a lado o gráfico anterior à #1868 e os painéis do detalhe do Objetivo. O redesenho deve parecer parte da mesma apresentação.

- **Série em neon rosa**, com `--ating-c` existente, traço sólido e um halo curto apenas no registro mais recente. Pontos anteriores pequenos no mesmo tom. O peixe final pode usar silhueta simples e contorno neon, no lugar do preenchimento laranja. O brilho é estático.
- **Superfície do mar em ciano**, com um traço fino e um rótulo direto junto à borda. Usar o azul profundo da apresentação como base e um degradê submerso translúcido, que escurece com a profundidade. O mar aparece pela superfície, pela profundidade e pelo marcador; evitar uma chapa azul opaca e elementos que concorram com a curva.
- **Moldura Marine Glass**, com o mesmo fundo, borda, raios, tipografia e espaçamento dos painéis vizinhos. Usar os tokens de texto e vidro já presentes. No histórico expandido, usar divisores discretos e reservar a cor rosa ao dado enfatizado.
- **Critério visual no projetor.** Em 1280 × 900 e Full HD, colocar a prévia ao lado do detalhe do Objetivo e da versão pré-#1868. A superfície deve ser reconhecível e a série em neon deve continuar sendo o primeiro elemento que se lê. Conferir também se o gráfico permanece legível em captura em escala de cinza, com identificação textual da meta e da condição do resultado.

<a id="radar-tempo-da-reuniao"></a>

## Radar — tempo da reunião e previsão por pauta

**Reprodução.** Inicie a apresentação pelo Bastidor ou pelo Calendário. O horário planejado já pode aparecer, mas não há escolha de iniciar o cronômetro no começo real da sessão. Depois de fechar todas as abas, a sala depende de encerramento manual ou de alguém assumir. A lista de participantes usa presença por conta e não inclui a Tela para o público.

**Etapa 1 — relógio opcional.** Ao clicar em Apresentar ao vivo, permitir iniciar com cronômetro, iniciar sem cronômetro ou cancelar. Em uma ocorrência do Calendário, sugerir o término já agendado e deixar editável antes de iniciar. Fora do Calendário, reaproveitar o término configurado e pedir duração ou horário quando estiver vazio. Exibir tempo decorrido desde o início real e, quando houver prazo, tempo restante. Um início atrasado não prorroga o término previsto por conta própria. A escolha segue a sala e persiste quando o apresentador muda ou recarrega. Iniciar sem cronômetro não alimenta o histórico de duração.

**Etapa 2 — fim automático da sala.** Contar conexões da sessão, inclusive a Tela para o público e abas distintas da mesma conta. Manter essa presença separada dos nomes exibidos em Passar controle. O encerramento usa o horário do servidor, espera cinco minutos contínuos sem presença e cancela a espera se alguém voltar. Um verificador do lado do servidor precisa executar mesmo com todas as abas fechadas. Antes de fechar, revalidar a identidade da sessão e a presença de forma atômica, para nunca encerrar uma sessão nova nem uma sala que voltou a ter alguém. O atraso efetivo depende da frequência do verificador. A regra vale também para salas iniciadas sem cronômetro e não encerra o Meet. Validar aba em segundo plano, queda de rede, reentrada no limite, apenas a projeção conectada, duas abas com o mesmo UID e nova sessão durante a verificação.

**Etapa 3 — plano por ocorrência e previsão.** Montar os blocos a partir dos slides que o Radar já gerou para o recorte do dia. Contar capa inicial, capas intermediárias de torre/bloco quando presentes e Panorama geral como itens reais. Cada gerência é um bloco. Detalhes de Objetivos e Evolução consomem tempo quando previstos ou usados, sem contar todos os Objetivos como slides obrigatórios. Permitir confirmar quais blocos entram no dia. Durante a reunião, projetar apenas o que resta e marcar saltos ou retornos sem somar uma visita como se fosse uma obrigação nova. O primeiro resultado pode ser uma faixa de duração com premissas visíveis. Quando houver histórico suficiente de reuniões cronometradas, estimar a chance de caber no prazo e uma faixa de término via amostragem das durações por tipo de bloco. Com pouca amostra, exibir a faixa e informar a falta de histórico, sem porcentagem artificial. O tempo de inatividade usado para fechar a sala não entra na duração de nenhum bloco.

**Aceite.** Ocorrência com início atrasado, sessão sem cronômetro, troca de apresentador, cinco minutos de ausência, retorno que cancela o fechamento e sessão nova que não é afetada por verificação antiga. Para a previsão, testar dois dias com pautas diferentes, capa e Panorama presentes, dia sem um bloco opcional, detalhes de Objetivo pulados e amostra insuficiente.

**Responsável.** Encaminhar o desenho da presença, do estado do relógio e da persistência de durações ao Claude. Essa fronteira envolve dados da sala e verificação no servidor. Fazer nota de desenho e revisão de regras antes da implementação. Validar no Chrome e no Safari em uma reunião real antes de ativar o encerramento automático.

<a id="usuarios-leitura-ampla"></a>

## `kanban/usuarios` legível por toda a Hering — 24/11/2026

| Quem achou | O que | Como reproduzir | Data |
|---|---|---|---|
| Codex (revisão da #1931) · confirmado pelo Claude | `database.rules.json` dá `.read` em `kanban/usuarios` (nó-pai) a **qualquer conta Google @ciahering**; o `.read` de `$uid` (só o dono) não restringe nada porque a leitura desce em cascata. Com isso, **toda a Hering lê** `notificacoes`, `fcm_tokens`, `notif_prefs`, papéis e squads de todo mundo. Já expõe conteúdo sensível: `travessia_apoio` grava "🫶 {nome} marcou que não está bem hoje" na notificação da liderança (`travessia-dev.html` L922). O Cardume deixou de pôr qualquer coisa privada na notificação (índice próprio `kanban/cardume/mencoes`). **Correção:** tirar o `.read` do nó-pai e dar leitura só ao que precisa ser público (provavelmente via `usuarios_publicos`), conferindo antes quem lê `kanban/usuarios` inteiro (Painel 👥, Escala, Intake…) — R3 do Maré inteiro, 2 revisões, simulador | `functions/rules/rulesSim.js`: `check(RULES, DB, 'read', 'kanban/usuarios/ana/notificacoes', <qualquer conta @ciahering google>)` → `true` | 24/11/2026 |

## GIFs no Cardume com KLIPY

Piloto na squad Dados em `cardume-dev.html`. O botão GIF fica ao lado do emoji, abre uma busca com prévias leves e coloca a seleção no compositor. O botão Enviar confirma. Troca de conta ou de canal limpa a seleção e cancela a busca pendente. Use filtro de conteúdo corporativo, anúncios desligados e atribuição conforme a documentação da KLIPY.

- **Provedor:** validar a busca em português, a disponibilidade no navegador corporativo e os termos da chave de produção. A chave de teste tem 100 chamadas por hora. Solicitar confirmação de preço para o uso interno antes de promover. [KLIPY para desenvolvedores](https://klipy.com/developers)
- **Privacidade:** enviar apenas a busca digitada no seletor e os parâmetros indispensáveis da API. Se um identificador for obrigatório, usar um identificador aleatório separado do Firebase, sujeito aos termos do fornecedor. Manter credenciais privadas em configuração protegida. Confirmar com o fornecedor a forma autorizada de integração antes de escolher entre requisição direta e função autenticada.
- **Contrato proposto:** acrescentar `gif: { provedor: "klipy", id }` opcional à mensagem. Validar o formato do ID contra a documentação, aceitar a referência apenas na criação, preservar autor e horário, remover a referência ao apagar e preservar mensagens antigas. Definir um texto alternativo curto para histórico e registro no card. Buscar a mídia por ID, agrupar consultas quando o provedor permitir, carregar só mensagens visíveis e exibir texto alternativo se a mídia falhar.
- **Fronteira:** aceitar mídia HTTPS somente dos hosts oficiais confirmados. Renderizar por propriedades do DOM e manter URLs arbitrárias fora do campo de mídia. Testar criação e leitura por membro, rejeição de não membro e ID inválido, edição sem troca de GIF, exclusão sem referência residual e mensagens antigas. Testar também falha da API, troca de canal durante busca e confirmação explícita do envio.
- **Coordenação:** mudança R3 por alterar o contrato das mensagens do Firebase. O Claude assume o desenho final das regras e a revisão antes do código. Verificar a liberação de `cardume-dev.html` no Quadro antes de editar a página.

## Concha: canal Geral

Inclui o canal **#oceano**, dedicado a reunir as atualizações do ecossistema Oceano. Os dois canais seguem as mesmas permissões de leitura e publicação.

No fluxo de `/subirproprod`, preparar um aviso para o **#oceano** com um resumo das mudanças da promoção e a assinatura visível **🤖 Agente Ágil**. A assinatura vai no rodapé da mensagem. A autoria registrada continua sendo a conta autorizada que publica.

Pedido de 26/11/2026. Exibir **Geral** e **#oceano** automaticamente na lista de toda conta com acesso à Concha, sem precisar entrar no canal. Pessoas sem papel de ADM podem ler as mensagens. A publicação é exclusiva de ADM e a permissão precisa valer no Firebase.

Como verificar a lacuna atual. Em dev, abra um canal temático configurado como aberto, entre com uma conta Hering sem papel de ADM e observe que o compositor fica disponível. O canal aberto atual permite publicação por membros.

Aceite para implementação. Testar no dev com uma conta ADM e uma conta comum. As duas veem os dois canais e leem as mensagens. A publicação funciona com ADM e a regra do banco recusa publicação para a conta comum, inclusive pelo fluxo de encaminhar. Aplicar a mesma definição de ADM das permissões existentes. Encaminhar ao Claude por envolver regras do banco e novo acesso compartilhado.

## Concha: Agente Ágil como remetente

Após o PR #2012, Caio pediu que os avisos de promoção no **#oceano** apareçam com **Agente Ágil** como remetente da mensagem, com nome e avatar no cabeçalho. O aviso preparado pelo `/subirproprod` deixa de trazer a assinatura no rodapé quando o novo envio estiver disponível.

O ADM aciona a publicação. A identidade do remetente é atribuída pelo servidor a um perfil de sistema, com registro da conta ADM que acionou a publicação. O cliente comum não escolhe essa identidade. O envio em nome do Agente Ágil fica restrito ao fluxo de avisos do **#oceano**.

Aceite. ADM publica um aviso que aparece com o perfil do Agente Ágil. Conta comum continua podendo ler e recebe recusa se tentar publicar como o agente. Mensagens humanas continuam associadas à conta que publicou.
