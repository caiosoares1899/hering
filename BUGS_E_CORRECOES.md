# Bugs e Correções Técnicas — Maré Digital (`BUGS_E_CORRECOES.md`)

Este arquivo concentra o registro técnico de **bugs reportados**, **correções pontuais**, **ajustes de regressão**, **investigações de causa-raiz** e **achados do `/monitorarbugs`** em todo o ecossistema Maré Digital.

- **Por que este arquivo existe:** manter o [`CHANGELOG.md`](CHANGELOG.md) focado exclusivamente em **novas funcionalidades (features)** e **grandes melhorias/entregas estruturais**, facilitando a leitura de evolução de produto, enquanto este documento serve como base de conhecimento técnica e memória de incidentes para desenvolvedores e agentes.
- **Como registrar novas correções:** via automação `node scripts/mare-cli.js log --type bug ...` ou adicionando uma entrada no topo da seção `## 🐛 Histórico de Bugs e Correções` abaixo.

---

## 🛡️ Armadilhas Conhecidas & Regras de Ouro (Não Repetir)

Antes de alterar código compartilhado, queries do Firebase, fluxos de autenticação ou scripts de promoção, consulte sempre estas **9 armadilhas recorrentes** já enfrentadas no projeto:

1. **Comentários de cards (`ts` sempre ISO string e caminho `card_comments`):**
   - `loadComments()` lê de `kanban/squads/{squadId}/dados/card_comments/{cardId}/{commentId}` e ordena comentários usando `a.ts.localeCompare(b.ts)`.
   - **Nunca** grave `ts: Date.now()` (número) em comentários de cards (`kanban/squads/{squadId}/dados/card_comments/{cardId}`), pois `Number.prototype.localeCompare` não existe e quebra a renderização/ordenação. Sempre grave `new Date().toISOString()` usando `window._set(window._ref(window._db, ...))`.

2. **Queries Firebase em `<script>` clássico vs `<script type="module">`:**
   - As páginas principais (`kanban.html`, `painel.html`, `okr.html`, `oceano.html`, `escala.html`, `intake.html`) carregam o SDK do Firebase em um `<script type="module">` e expõem as referências para o `<script>` clássico global via `window._x` (ou helpers equivalentes).
   - Qualquer função do SDK (`query`, `orderByChild`, `equalTo`, `limitToLast`, `orderByKey`, `startAt`, `endAt`) usada fora do módulo **precisa** estar exposta em `window._x` dentro do `<script type="module">`, caso contrário lançará `ReferenceError` silencioso em runtime no script clássico.

3. **Ordenação de notificações (`orderByChild('ts')` vs `orderByKey()`):**
   - Notificações com IDs determinísticos (`due_today_`, `mention_`, `reuniao-`) **não** começam com `'n' + timestamp`.
   - Usar `orderByKey()` combinado com `limitToLast()` exclui ou ordena incorretamente essas notificações lexicograficamente. Sempre use `orderByChild('ts')` (com `.indexOn: ["ts"]` garantido em `database.rules.json`).

4. **Isolamento de `localStorage` do Firebase (`FB_OVERRIDE_NS`):**
   - Chaves de override de configuração do Firebase no `localStorage` devem obrigatoriamente incluir o sufixo de namespace da página (`_kanban_dev`, `_painel_dev`, etc.).
   - Sem esse isolamento, um override salvo em `-dev.html` vaza para a página de produção `.html` por compartilharem o mesmo domínio no GitHub Pages (`caiosoares1899.github.io`).

5. **Login Popup e `Cross-Origin-Opener-Policy` (COOP) / Safari iOS:**
   - **Chrome Desktop:** a página de login do Google ocasionalmente aplica headers COOP que fazem `signInWithPopup` perder a referência da janela e disparar `auth/popup-closed-by-user` falsamente, exigindo fallback automático para `signInWithRedirect` após 2 falhas consecutivas.
   - **iPhone / iPad (Safari e Web App na Tela de Início):** nunca depender de `signInWithPopup` puro; usar sempre `MareLogin` (`mare-login.js`) com fluxo OAuth direto (`response_type=id_token`).

6. **Iniciais de usuários (`init_registry` via `runTransaction`):**
   - Toda criação ou edição de sigla/iniciais de usuário (`autoRegistrar`, `editarInicial`, `confirmarInscricao`) deve passar por transação atômica (`runTransaction`) em `kanban/init_registry/{INIT}` para impedir colisão entre usuários simultâneos.

7. **Divergências permanentes entre `-dev.html` e `.html` (nunca sobrescrever na promoção):**
   - Na promoção de `-dev.html` para `.html`, **nunca** faça cópia cega de arquivo inteiro sem preservar os 4 pontos de divergência intencional:
     - **(a)** String de versão (`vX.Y.Z-dev` vs `vX.Y.Z`) + constantes `VERSION_KEY` / `FB_OVERRIDE_NS`;
     - **(b)** Ícone da aba (`favicon-dev.png` vs `favicon.png`);
     - **(c)** Chave de logout remoto (`force_logout_after_dev` vs `force_logout_after`);
     - **(d)** Imports de módulos compartilhados (`mare-*-dev.js?v=N` vs `mare-*.js?v=N`).

8. **Inspeção SSL corporativa (FortiGate/VPN):**
   - O SDK do Firebase (`10.14.1`) é servido localmente a partir de `vendor/firebase-10.14.1/` porque firewalls corporativos (FortiGate/VPN) com inspeção SSL truncavam ou corrompiam o bundle ESM vindo de `www.gstatic.com`. Nunca reverta os imports de produção/dev para CDN externa sem fallback local.


9. **Nó novo em `kanban/okr` precisa de regra em `database.rules.json` (desde 16/10/2026):**
   - O nó `okr` não tem mais um `.write` único: cada filho (`objetivos`, `marcos`, `marco_comments`, `datastudio`, `mural`…) declara o seu. Um filho NOVO sem regra **perde a escrita** para todo mundo.
   - `functions/rules/__tests__/okrRules.test.js` varre o código atrás de `kanban/okr/<nó>` e falha se faltar a declaração. Depois de declarar: `firebase deploy --only database` (só o Caio).
   - Permissão que só existe na tela NÃO é permissão: se a UI diz "só o autor/ADM", a regra do banco precisa dizer o mesmo. A regra só enxerga `role` global, `gestorOkr` e o e-mail do Caio — não `squads_roles` nem a lista `adm_emails`.

10. **Schema de Cards ao criar/atualizar de fora do `kanban.html` (`intake.html`, `oceano.html`, `functions`):**
   - **`priority` usa os valores do `<select id="m-priority">` de `kanban-dev.html`:** `'critical' | 'high' | 'medium' | 'low'` (nunca `'alta'`/`'media'`/`'baixa'`, que deixam o `<select>` de prioridade vazio no modal do Maré). Se houver impedimento crítico, ligar também `blocker: true` + `blockerReason`.
   - **`created` é QUEM criou (nome/iniciais do autor), nunca uma data:** `kanban-dev.html` exibe `"Criado por ${card.created}"`; a data ISO `AAAA-MM-DD` fica em `createdAt`.
   - **`checklist` com `.text` e `.t`:** cada item deve ter `{ text: '...', t: '...', done: false }` para compatibilidade total no modal do Maré.
   - **`history` no formato `{ who, what, at }` (`recordHistory` em `kanban-dev.html`):** onde `at` é ISO string (`new Date().toISOString()`).
   - **`flow` no formato de `recordMove`:** `{ enteredAt: { [colId]: isoString }, log: [{ from: '—', to: colId, at: isoString }] }` e verificar se `cards/<slot>` não pertence a outro `card.id` antes de alocar `cards_index/<cardId>`. Sempre validar com `docs/arezzo/testes/test_ferias_card_contrato.js`.

---

## 🐛 Histórico de Bugs e Correções

### 2026-10-16 · kanban-dev.html (v8.30.873-dev) — getDue mostrava selo "⚡ Hoje" para amanhã (diff===1) em vez de hoje (diff===0)

- **Causa raiz:** Em `kanban-dev.html` (`getDue`), a condição do selo `⚡ Hoje` comparava `if(diff===1)` em vez de `if(diff===0)`, fazendo cards com prazo para amanhã exibirem `⚡ Hoje` (`due-warn`) e cards com prazo para hoje caírem no retorno padrão mostrando apenas a data.
- **Correção:** Restaurada a verificação `if(diff===0) return {cls:'due-warn',lbl:'⚡ Hoje'};` em `getDue()` (`bug_ferias_1792190400351`).

### 2026-10-16 · oceano-dev.html (v1.50-dev) — cartão da Meta Global começava ~47 px abaixo dos quadrados dos apps

- **Causa:** na grade da página inicial (só Meta, sem Mural) o cabeçalho "Meta Global · Digital" ficava acima do cartão e empurrava ele para baixo, deixando o topo desalinhado dos quadrados dos apps (o próprio cartão já traz o rótulo).
- **Correção:** o cabeçalho da coluna some nesse layout (desktop), alinhando o topo do cartão com o topo dos quadrados. Só o topo é alinhado; esticar os quadrados deformava com mais de uma meta.

### 2026-10-16 · kanban-dev.html (v8.30.869-dev) — clProg usava Math.floor (66% em 2/3) em vez de Math.round (67%)

- **Causa raiz:** Em kanban-dev.html (L12307), clProg(cl) calculava o percentual da barra de progresso do checklist na face do card com Math.floor(d/cl.length*100) (retornando 66% para 2 de 3 itens concluídos), divergindo do modal do card (renderCL, L17640), que já usava Math.round(done/total*100) (67%).
- **Correção:** Alinhado clProg(cl) para usar Math.round(d/cl.length*100), garantindo 67% para 2/3 tanto na face do card quanto dentro do modal (bug_ferias_1792179902877).

### 2026-10-16 · plantão automático: chave/segredo com espaço ou quebra de linha invisível derrubava a autenticação (401 / chave inválida)

- **Sintoma:** no 1º deploy do modo automático o webhook do GitHub respondeu `401 assinatura inválida` e a chave do `plantaoProximo` deu `chave inválida`, com os segredos recém-criados.
- **Causa provável:** o valor guardado no Secret Manager (colado à mão / de arquivo de texto) pode ter espaço ou quebra de linha no começo ou no fim, e a comparação era exata; `functions/plantao/agente.js` e `functions/plantao/webhook.js` não limpavam o segredo.
- **Correção:** `limpaSegredo()` nos dois (chave da URL, segredo do webhook); testes novos. **Exige redeploy** de `plantaoProximo` e `plantaoGithubWebhook`.

### 2026-10-16 · functions: os testes do servidor do plantão nunca rodavam no npm test / CI

- **O que estava errado:** o script `test` de `functions/package.json` lista as pastas de teste uma a uma e `plantao/__tests__` (criada no PR do plantão) ficou de fora — a CI nunca executou os testes de `plantaoBugNovo`/`plantaoVigia` (a contagem de `npm test` não subiu quando eles foram escritos).
- **Correção:** `plantao/__tests__/*.test.js` entra no script; agora 897 testes passam (os do plantão incluídos). **Lição:** ao criar uma pasta nova de testes em `functions/`, conferir se a contagem do `npm test` subiu.

### 2026-10-16 · 2026-10-16 — Contagem de dias úteis de atraso descontando sábado (kanban-dev)

- **Sintoma:** Card com prazo na sexta-feira passada (09/10) exibia ⚠ 6d atrasado na sexta seguinte (16/10) em vez de 5d.
- **Causa:** _diasUteisEntre(d1, d2) em kanban-dev.html filtrava apenas domingo (dow !== 0), sem excluir sábado (dow !== 6).
- **Correção:** Incluída a condição && dow !== 6 em _diasUteisEntre() em kanban-dev.html, corrigindo o cálculo em getDue() e _timelineCardRow().

### 2026-10-16 · Oceano: o botão do plantão copiava /monitorarbugs (comando genérico, sem as travas) em vez de /plantaobug

- **O que estava errado:** o pacote anônimo copiado no Oceano começava com `/monitorarbugs em …`, que no Antigravity dispara a varredura ampla e não a skill do plantão (`/plantaobug`: escopo só do bug, script de teste obrigatório, comando único, ESCALAR AO CLAUDE).
- **Correção (oceano-dev v1.46):** `feriasMontarPacoteAnonimo()` passa a gerar `/plantaobug em …`; botão, descrição do card e avisos falam em /plantaobug; a skill aceita os pacotes antigos. Teste: `docs/arezzo/testes/test_ferias_pacote_anonimo.js`.

### 2026-10-16 · Oceano: qualquer pessoa abria o painel de atualizar status do bug (e ?adm=1 liberava)

- **O que estava errado:** na lista do Assistente Férias o botão ⚙️ Atualizar status era exibido justamente para quem NÃO era ADM/PO (`!souAdmOuPo`), e `?adm=1` na URL liberava o painel; `feriasAtualizarStatusBug` não checava o papel. Qualquer conta podia marcar um bug como Resolvido e disparar a notificação ao autor.
- **Correção (oceano-dev v1.45):** o painel e a função só funcionam para ADM (`feriasSouAdm`); botão para não-ADM removido; `?adm=1` removido. Limite conhecido: `kanban/feedback` segue gravável por qualquer conta @ciahering (o Maré usa o mesmo nó) — a validação do plantão fica no nó novo `kanban/plantao` (só ADM). Teste: `docs/arezzo/testes/test_plantao_validacao.js`.

### 2026-10-16 · Plantão de Férias: contenção — Issue pública vazava nome/e-mail, workflow acionável por qualquer pessoa e daemon contornando o controle corporativo

- **O que estava errado:** (1) o Assistente Férias abria uma Issue pública com nome e e-mail de quem reportou (issue #1445); (2) o workflow do plantão (ferias-bug-bot, já removido) disparava em `issues`/`issue_comment` com permissão de escrita e promovia a prod com a palavra "aprovado" — qualquer pessoa na internet podia acioná-lo; (3) um daemon em scripts/ (ferias-daemon, já removido) apertava sozinho o botão de aprovação do Antigravity, contornando o controle corporativo; (4) `oceano-dev.html` lia comentários públicos da Issue e aceitava `FERIAS_STATUS` de qualquer autor; (5) o prompt do `/monitorarbugs` levava o nome do autor.
- **Correção (oceano-dev v1.44):** removidos workflow, daemon e o atalho .bat do daemon; removidos o polling do GitHub e o botão de Issue; o agente de código passa a receber um **pacote anônimo** (`feriasMontarPacoteAnonimo`, texto sanitizado); o registro em `kanban/feedback` deixa de guardar `promptAntigravity`. `scripts/checar.js` agora reprova workflow com gatilho `issues`/`issue_comment`/`pull_request_target` e página que abra issue pública; `AGENTS.md` ganhou as "Linhas vermelhas".
- **Teste:** `docs/arezzo/testes/test_ferias_pacote_anonimo.js` (novo) e `docs/arezzo/testes/test_ferias_card_contrato.js` (segue verde). Plano completo e passos manuais do Caio em `docs/PLANTAO_BUGS.md`.

### 2026-10-16 · oceano-dev.html v1.43 (2026-10-16) — Correção das 2 regressões de contrato Oceano ⇄ Maré no card de bug (`priority` e `created`)

- **`priority` em inglês (`critical|high|medium|low`) conforme `<select id="m-priority">` de `kanban-dev.html` (`feriasNormalizarPrioridadeKanban`):** Na v1.42, `feriasNormalizarPrioridadeKanban` havia convertido `priority` para `'alta'|'media'|'baixa'`, deixando o `<select id="m-priority">` vazio ao abrir o card no `kanban-dev.html`. Restaurado o mapeamento oficial (`🔴 Bloqueia a operação` → `'critical'`, `🟠 Atrapalha` → `'high'`, `🟡 Dá pra contornar` → `'medium'`) e adicionada migração automática de cards gravados com valores em português.
- **`created` com o nome do autor do relato em vez de data `DD/MM/YYYY` (`feriasMontarCardBugDados`):** Na v1.42, `created` passou a gravar `DD/MM/YYYY`, fazendo o modal do `kanban-dev.html` exibir `"Criado por 16/10/2026"`. Restaurado `created: autor` (com higienização automática caso o card existente tenha data em `created`) e `createdAt` com a data ISO `AAAA-MM-DD`, incrementando `kanbanSchemaV: 3` para curar automaticamente cards criados na v1.42 (validado pelo contrato `docs/arezzo/testes/test_ferias_card_contrato.js`).

### 2026-10-16 · oceano-dev.html v1.42 (2026-10-16) — /monitorarbugs na criação e sincronização do Card na coluna Bugs (Squad Dados)

- **Listener em tempo real abortava por `window._onVal` indefinido (`feriasIniciarBugsListener`):** O `<script type="module">` do `oceano-dev.html` expunha `window._onValue`, mas `feriasIniciarBugsListener` checava `if(!window._onVal ...)`, saindo na primeira linha. Exposto `window._onVal = onValue` no módulo e adicionado fallback `window._onValue || window._onVal`.
- **Itens do Checklist apareciam em branco/undefined no Maré (`feriasMontarCardBugDados`):** Os 3 itens do checklist eram gravados com a chave `{ t, done }`, mas `kanban-dev.html` renderiza `item.text`. Agora grava `{ text, t, done }`.
- **Flag automática de Impedimento (`blocker` / `blockerReason`):** Ativado `blocker: true` + `blockerReason` automaticamente quando o impacto é `🔴 Bloqueia a operação`, limpando o bloqueio automático ao resolver (Nota: a conversão de `priority` e `created` feita na v1.42 gerou regressão e foi revertida na v1.43).
- **Proteção contra colisão de slot em `cards_index` (`feriasSincronizarCardSquadDados`):** Verifica se `cards/<cardKey>` não pertence a outro `card.id` antes de reutilizar o índice e cruza `occupiedKeys` de `/cards` dentro da transação de `cards_index`.
- **Deep-link `&card=...&opencard=...` (`feriasUrlCardSquadDados`, `feriasProcessarSnapshotBugs`, `feriasEnviarBug`):** Incluído `&opencard=<id>` para abertura garantida após `fb-ready` e removido `kanbanCardId` prematuro antes da criação do card.

### 2026-10-16 · oceano-dev.html v1.40 (2026-10-16) — /monitorarbugs no Assistente Férias (sino pessoal, auto-sync no foco e validação de imagem)

- **Clique e leitura de notificações pessoais (`k === 'p'`) no sino (`iniciarSino`, `sinoItens`, `sinoClique`):** `iniciarSino()` mapeava `sinoPessoais` sem preservar `icon`/`title`/`sub` de notificações `ferias_bug_status`, e `sinoClique()` só abria `abrirFerias('bugs')` quando a notificação vinha do `notif_feed` (`k === 'f'`). Agora `iniciarSino` preserva todos os campos, `sinoItens` sincroniza o estado `unread` entre `notif_feed` e `sinoPessoais`, e `sinoClique` marca como lida em `kanban/usuarios/<uid>/notificacoes/<id>/read` e abre `abrirFerias('bugs')` tanto em `k === 'f'` quanto em `k === 'p'`.
- **Sincronização imediata ao retornar da aba do GitHub (`_feriasAoFocarJanela`):** Quando o usuário abria a Issue no GitHub em nova aba e voltava para o Oceano, o throttle de 45s de `feriasSincronizarGithubIssues` impedia a atualização imediata do chip `🐙 Issue #...`. Adicionado listener em `window.focus` e `visibilitychange` (com cooldown de 10s) que força `feriasSincronizarGithubIssues(true)` se o modal estiver aberto ou houver chamado ativo.
- **Validação de tipo de arquivo e tratamento de erro em `feriasComprimirImagem`:** Adicionada checagem `fileOrBlob.type.startsWith('image/')` (exibindo toast caso o usuário escolha um PDF/documento no seletor de arquivos) e handlers explícitos para `reader.onerror` e `img.onerror`.

### 2026-10-16 · oceano-dev.html v1.39 (2026-10-16) — /monitorarbugs no Assistente Férias

- **Regra do banco (`database.rules.json` L271–L273) e schema de notificações em `feriasDispararNotifStatusBug`:** A regra de escrita em `kanban/usuarios/$uid/notificacoes/$notifId` exige `newData.child('type').isString() && newData.child('type').val() !== 'painel_broadcast'` e `!data.exists()` quando gravada por outro usuário que não seja ADM/PO (ex.: na sincronização automática via GitHub Issues). O payload gravava apenas `tipo` (sem `type`) e não trazia os campos lidos pelo sino do Maré (`title`, `sub`, `text`, `icone`, `read: false`), além de encadear os dois `_set` no mesmo `try/catch`. Corrigido preenchendo o schema completo com `type: 'ferias_bug_status'`, chave determinística única por transição e `try/catch` independentes para `notif_feed` e `usuarios/$uid/notificacoes`.
- **`ReferenceError: feriasEhMeuBug is not defined` e filtro de ID no sino (`sinoItens`):** `sinoItens()` chamava `feriasEhMeuBug(b)` em vez de `feriasBugEhMeu(b)` (disparando `ReferenceError` sempre que uma notificação `ferias_bug_status` não trazia `autorEmail`/`autorUid`) e comparava `m[1]` (`"bug_ferias_<ts>"`) com `String(x.id).replace(/^bug_ferias_/,'')` (`"<ts>"`), que nunca batia e deixava passar notificações de outros usuários caso `feriasBugsLista` ainda não tivesse carregado. Corrigido o nome da função, a normalização dos dois lados do ID, o bloqueio seguro enquanto `feriasBugsLista` não carregou e a chamada a `sinoRender()` dentro de `feriasProcessarSnapshotBugs()`.
- **Verificação de `ehAdm` booleano como função + roteamento de `#ferias-bugs`:** Em `oceano-dev.html`, `ehAdm` é um booleano (`let ehAdm = false;`), mas `feriasRenderBugsLista()` fazia `typeof ehAdm === 'function' && ehAdm()`, ocultando os botões rápidos de status (`🔵 Sendo tratado` / `🟢 Resolvido`) para ADMs logados. Corrigido para checar `Boolean(ehAdm)` + papéis de `perfilFb`, além de adicionar suporte ao hash `#ferias-bugs` no boot e no `hashchange`.
- **Perda de texto digitado no `<input id="fbug-resp-<id>">` a cada snapshot do Firebase:** Qualquer atualização em `kanban/feedback` re-renderizava `#fbug-lista.innerHTML` e apagava a mensagem que o ADM estava digitando no campo de resposta do bug. Agora `feriasRenderBugsLista()` preserva e restaura o rascunho digitado, o foco e a posição do cursor entre re-renders.

### 2026-10-16 · Radar (`database.rules.json`) — qualquer conta @ciahering editava/apagava comentário alheio do Marco e configurava o Data Studio (permissão só na tela)

- **Sintoma:** "só o autor edita/apaga o comentário do Marco" e "só ADM/PO/Organizador/Gestor OKR configura o Data Studio" eram restrições só de tela. Qualquer conta @ciahering, com o console aberto, podia reescrever ou apagar o comentário de outra pessoa (inclusive em nome dela) e criar/remover painéis do Data Studio.
- **Causa-raiz:** `database.rules.json` tinha UM `.write` para o nó `kanban/okr` inteiro (qualquer conta Google @ciahering). Como `.write` cascateia para baixo, nenhum filho conseguia restringir.
- **Correção (`database.rules.json`, `okr` agora com regras por filho):** `marco_comments` — o autor cria/edita/apaga o próprio comentário (`uid` = `auth.uid`, validado: id = chave, texto 1–4000, `ts` string); ADM (`role: adm` ou e-mail do Caio) apaga o de qualquer um; apagar a conversa inteira (cascata ao excluir um Objetivo) só ADM — ou qualquer conta se ela já está vazia (a exclusão do Objetivo não pode falhar por marco sem comentário). `datastudio` — ADM, PO, Organizador ou Gestor OKR (`gestorOkr: true`). Os outros 13 filhos (`objetivos`, `marcos`, `tags`, `gerencias`, `calendario`, `agente_chat`, `agente_chat_processed`, `reuniao_notas`, `reuniao_agenda`, `snapshots`, `obj_locks`, `mural`, `apresentacao_live`) seguem abertos como antes, agora declarados um a um.
- **Limite conhecido:** a regra só enxerga o `role` GLOBAL. Quem é PO/Organizador só dentro de uma squad (`squads_roles`) passa na tela, mas não passa na regra do Data Studio; idem ADM que está só na lista `adm_emails` sem `role: adm`. Por isso há um script de checagem (só leitura) para rodar ANTES do deploy.
- **Teste:** `functions/rules/__tests__/okrRules.test.js` (9 testes; 6 falham nas regras antigas). O último teste falha se alguém usar um nó novo de `kanban/okr` no código sem declarar a regra (senão ele perderia a escrita). Suíte `functions/`: 856 passam, 0 falham, 1 pulado.
- **Deploy:** exige `firebase deploy --only database` (só o Caio, conta corporativa), depois de rodar o script de checagem.

### 2026-10-15 · Apresentação Executiva do Radar (`okr-apresentacao.slide.html`) — Títulos longos cortados em 2 linhas e sincronização de ADM na sala ao vivo
- **Sintoma:** (1) Na Apresentação Executiva (`okr-apresentacao.slide.html`), títulos longos de Objetivos no detalhe (`.d2-title`), de Gerência na capa da torre (`.ger-row .gr-name`) e de Marco nos comentários (`.mc-hd h3`) eram truncados com reticências; (2) quando um ADM clicava em um slide ou card de Objetivo durante a apresentação de outra pessoa, `liveSeguindo` desligava para o ADM e a navegação não era transmitida para a sala.
- **Causa-raiz:** (1) `.d2-title` usava `-webkit-line-clamp: 2; overflow: hidden;` e `.ger-row .gr-name`/`.mc-hd h3` usavam `text-overflow: ellipsis; white-space: nowrap;`; (2) `liveAposNavegar()` verificava apenas `liveSouHost()` em vez de `livePodeControlar()`.
- **Correção:** Remoção do corte de linha em `.d2-title`, `.obj-title`, `.ger-row .gr-name` e `.mc-hd h3`, auto-redução gradual do `font-size` de `.d2-title` até `15px` dentro de `_okrFitDetailSections()` quando o título passa de 2 linhas, e uso de `livePodeControlar()` + `navId` em `liveAposNavegar()`, `liveInit()` e `liveAplicar()`.

### 2026-10-15 · Apresentação Executiva do Radar (`okr-apresentacao.slide.html`) — Pacote de 7 correções do `/monitorarbugs`
- **Sintoma:** (1) Caneta/Laser (`#live-capture`) continuava bloqueando cliques na tela do ex-apresentador quando outra pessoa assumia o controle e `_liveSyncT` podia disparar atrasado; (2) relógio (`#tb-clock`) e cronômetro (`#tb-countdown`) sumiam para o apresentador e ADMs; (3) redimensionar janela ou usar tecla `F` com `#detail-ov` aberto não recalculava alturas nem alternava tela cheia; (4) filtrar por Tag/Torre não sincronizava a sala ao vivo; (5) reabrir `📋 Anotações` mantinha data passada selecionada; (6) `_liveDesfazer` (`Z`) não desfazia traço fixo para ADM ou após `F5`; (7) sub-modais (`#mc-ov`, `#ating-ov`) permaneciam abertos ao trocar/fechar Objetivo ou no logout.
- **Causa-raiz:** Falta de chamada a `liveDesligaFerr()` na perda de host em `liveInit()`, regra CSS legada `body.live-host .tb-clock-wrap { display: none }`, `return` antecipado no `keydown` do modal `#detail-ov`, ausência de `liveAposNavegar()` em `_okrSetTorre`/`rebuild`, precedência de `sel.value` sobre `_hojeStr()` em `_okrToggleNotes`, `_liveDesfazer` restrito à pilha local `liveMeus`, e limpeza incompleta em `_okrOpenDetail`/`_okrCloseDetail`/`_okrResetOverlays`.
- **Correção:** Aplicação das 7 correções em `okr-apresentacao.slide.html` (`liveDesligaFerr`, `.tb-clock-wrap`, `_okrFitDetailSections` no `resize`, `liveAposNavegar` no filtro, reset para `_hojeStr()`, fallback de `_liveDesfazer` nos traços do slide atual e fechamento em cascata de `#mc-ov`/`#ating-ov`).

### 2026-10-15 · Radar (`okr-dev.html` / `okr.html` v2.85–v2.87) e Apresentação (`okr-apresentacao.slide.html`) — Contraste ilegível e `Invalid Date` no seletor de datas das Anotações + `/monitorarbugs` na aba Data Studio
- **Sintoma:** (1) O `<select id="notes-date-sel">` abria com fundo branco e letras claras no Chrome/Windows, e 2 notas antigas (`nota_*`) na raiz de `kanban/okr/reuniao_notas` apareciam no topo como `Invalid Date`; (2) na aba `📈 Data Studio` (`okr-dev.html`), 7 pontos de fragilidade identificados no `/monitorarbugs` (interpolação de `r.id` em `onclick`, validação de host do iframe, recarga desnecessária do `<iframe id="okr-ds-iframe">` ao re-renderizar `#okr-ds-top`, chamadas concorrentes em `_okrDsEnsureLoaded`, falta de guard `_okrCanCreate()` em `_okrDsDelete`/`_okrDsMove`, reaparecimento de `#okr-novo-btn` fora da aba Objetivos e ordem de fechamento no `Escape`).
- **Causa-raiz:** Ausência de estilo para `#notes-date-sel option` e falta de filtro de chave `/^\d{4}-\d{2}-\d{2}$/` em `_notasPopulateDateSel` / `_okrNotasPopulateDateSel`; falta de blindagem defensiva nos fluxos recém-criados da aba Data Studio.
- **Correção:** Estilo escuro oceânico (`background: #0a1a2e; color: #e8f4ff; color-scheme: dark`) nas `<option>`, filtro `/^\d{4}-\d{2}-\d{2}$/` nas datas de `reuniao_notas` em `okr-apresentacao.slide.html` e `okr-dev.html`/`okr.html` (v2.87), e aplicação das 7 correções na aba Data Studio (`okr-dev.html` v2.85–v2.86 → `okr.html` v2.87).

### 2026-10-14 · Painel (`painel-dev.html` / `painel.html` v5.70–v5.71, `functions/github/statusGithub.js`, `functions/firebase/statusFirebase.js`) — `/monitorarbugs` nos monitores de status do GitHub Pages e do Firebase
- **Sintoma:** No modo fallback (leitura de `kanban/github_saude` e `kanban/firebase_saude`), componentes apareciam como `"Desconhecido"` e a lista de incidentes ativos vinha vazia; além disso, incidentes já resolvidos ou com mais de 7 dias podiam aparecer, `external_desc` trazia tags HTML cruas, `_fbMatchServicos` podia dar falso-positivo com `.includes('auth')` e `_setStatusPill` sobrescrevia o span do dot luminoso.
- **Causa-raiz:** Divergência entre os nomes de campos gravados pelas Cloud Functions (`componentesResumo`, `servicosResumo`, `incidentes[].titulo/estadoLabel/resumo/link/atualizadoEm`) e os lidos pelo navegador (`componentes`, `incidentesAtivos[].name/status/latestBody/shortlink/updatedAt`), somada à falta de normalização/sanitização na coleta ao vivo.
- **Correção:** Normalização dos dois schemas em `renderGithubStatusUI` e `renderFirebaseStatusUI`, filtro de incidentes resolvidos ou > 7 dias, limpeza de HTML (`_limparHtmlStatus`), validação de esquema de URL (`_linkSeguroStatus`), matcher por fronteira de palavra (`\b`) em `_fbMatchServicos` e preservação dos spans filhos em `_setStatusPill` (`painel-dev.html` v5.70–v5.71 → `painel.html` v5.68/v5.74).

