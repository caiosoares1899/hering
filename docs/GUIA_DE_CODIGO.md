# Guia de código — como escrever (e revisar) código neste repositório

> Para **qualquer agente ou pessoa** que edite as páginas do Maré/Oceano/Radar/Painel, os módulos `mare-*.js` e `functions/`. Não repete as regras de processo do `CLAUDE.md` (dev-first, release, tags) — fala de **como o código é e onde ele costuma quebrar**. Cada item abaixo nasceu de um bug real registrado em `BUGS_E_CORRECOES.md` (leia a seção "🛡️ Armadilhas" antes de mexer em Firebase, login ou comentários).

## 1. A base em 60 segundos (isso muda como você escreve)

- **Sem build.** Cada `.html` é uma página sozinha: `<style>` e `<script>` inline. Nada de `import` entre páginas. Os poucos arquivos compartilhados são `mare-notif`, `mare-dicas`, `mare-metas`, `mare-login` (raiz do domínio, versão por `?v=N`).
- **Dois mundos de script na mesma página.** O SDK do Firebase vive num `<script type="module">`; o resto da página é `<script>` **clássico**. Binding de `import` **não atravessa** esse limite: use sempre os aliases `window._ref`, `window._get`, `window._set`, `window._update`, `window._onValue`, `window._query`, `window._runTransaction`… Chamar `query(...)` "pelado" no script clássico dá `ReferenceError` engolido por um `try/catch`.
- **`function nome(){}` do topo do script clássico vira `window.nome`; `const`/`let` não.** Um `const today = new Date()` não se reatribui (nem no console): mude o valor (`today.setTime(...)`) e restaure.
- **Uma função pode ser reatribuída mais abaixo** (`saveCard = function(){…}` com notificações). Antes de dizer "essa função nunca faz X", `grep` pelo **nome sendo reatribuído**.
- **Banco compartilhado.** `-dev` e produção falam, em grande parte, com o **mesmo** Realtime Database. Só alguns nós têm irmão `_dev`. Trate dado como real, sempre.
- **Regras do banco são a segurança de verdade** (`database.rules.json`). Permissão que existe só na tela **não é** permissão. Nó novo sem regra = ninguém escreve; regra nova = deploy (só o Caio) → no plantão, isso é **ESCALAR AO CLAUDE**.

## 2. Método antes de editar (o que mais evita erro)

1. **Ache a área pelo mapa, não pelo arquivo.** `CODE_MAP_FAST.md` → `grep -na` do nome da função (a linha do mapa é retrato; confirme). Use `-a`: os arquivos têm emoji.
2. **Leia a função inteira**, de ponta a ponta, não um trecho. Bug de estado/condição só aparece assim.
3. **Liste TODOS os escritores do que você vai mudar.** `grep` pelo nome do campo/nó (`agil_cfg`, `card.owner`, `kanban/okr/…`) em **todas** as páginas. Quase todo bug "corrigido pela metade" era um segundo caminho que mexe no mesmo dado e ficou de fora (botão × autosave × automação × bulk × Agente Ágil × outra página).
4. **Compare com o irmão que já está certo.** Existe quase sempre uma função parecida já corrigida (`_doBulkAssign` × `executarReatribuir`, `unlinkDependsOn` × `setDependsOn`). Copie o **padrão**, não só o "como".
5. **Confira o comentário contra o código.** Comentário que promete "reverte se falhar" ou "só dias úteis" é o melhor mapa de bug: percorra cada promessa.
6. **Reproduza ANTES de corrigir** (função extraída em Node, ou script de console). Sem reprodução você não sabe se corrigiu a causa ou só o sintoma. Se o primeiro conserto não resolver o relato, **não** é o fim: pode haver um 2º bug na mesma área.

## 3. Armadilhas que mais geraram bug (e o que fazer no lugar)

**Firebase / dados**
- **Nunca reescreva um array/nó inteiro a partir de cópia local velha** (`set` do array de cards, de kudos, de lembretes, de `qlItems`). Outra pessoa que gravou nesse meio-tempo some. Escreva **só o filho tocado** (`fbSaveCard`) ou use `window._runTransaction` relendo o valor fresco.
- **`set` de objeto "fechado" em nó compartilhado apaga campos que outras telas acrescentaram** (`agil_cfg`). Use `update` com só os campos seus.
- **`undefined` derruba a gravação inteira** (RTDB é tudo-ou-nada). Normalize (`!!x`, `|| ''`). **Chave inválida** (vazia, ou com `. # $ [ ] /`) também.
- **Comentário: `ts` é string ISO** (`new Date().toISOString()`), nunca `Date.now()`. Notificação: ordene por `orderByChild('ts')`, não por chave.
- **Id novo a cada clique + gravação assíncrona = clique duplo cria dois.** Todo botão que grava com id novo nasce com trava "em andamento" (`_salvando`) e botão desabilitado.
- **Salvar item aberto não pode ressuscitar o que outra pessoa apagou**: releia antes e recuse se sumiu.
- **Quem lê estado "uma vez e reaplica"** (permissão ao abrir modal, uid do menu, retomada do apresentador) precisa esperar os dados de que depende — teste com a leitura **atrasada** (fake de banco instantâneo esconde corrida).
- **Função async que mexe em tela**: contador de chamada ("só a última resposta vale"), **inclusive no `catch`**. Função de leitura que devolve `null` para "não existe" **e** para "falhou" convida a recriar o que existe.
- **Antes de gravar a flag "já rodei hoje", cheque que há trabalho a fazer** (regra ligada, item candidato). Senão ligar a regra no mesmo dia perde a execução.

**HTML / interface**
- **`esc()` é escape de HTML, não de JS.** Valor que entra num literal JS dentro de atributo (`onclick="f('${x}')"`) precisa de `jsq()` (JSON + esc; existe em kanban/painel/okr — nas outras páginas procure o helper equivalente antes de inventar um). Todo `${...}` vindo do banco passa por `esc()` — **inclusive o campo "decorativo"** (ícone, cor, torre, classe). URL só `http(s)` (nada de `javascript:`).
- **Redesenhar com `innerHTML` perde foco, texto digitado e `<details>` aberto.** Sincronize o rascunho **antes** de re-renderizar ou atualize no lugar. Esc/Enter em modal empilhado: registre o dono do Esc (captura + `stopPropagation`).
- **Modal aberto de dentro de outro precisa de `z-index` maior** (ou vir depois no HTML). Teste com `elementFromPoint`, não só "a classe `open` apareceu".
- **`display:flex` numa classe vence o atributo `[hidden]`**: acrescente `.classe[hidden]{display:none}`.
- **Sempre que você troca um evento nativo por detecção manual** (`click` → `touchend`), liste o que o navegador filtrava de graça (rolagem, long-press) e refaça.
- **Datas:** `new Date(str + 'T00:00:00')` (local) — nunca `Date.parse` de string solta; "dias úteis" ignora sáb **e** dom; compare datas pelo dia, não pela hora.
- **Matemática visível:** `Math.round` × `Math.floor` muda o número que a pessoa vê (66% × 67%). Use o mesmo critério da tela vizinha.

**Dev × prod**
- Edite **só** o `-dev`. Subiu mudança: bump da versão (`node scripts/mare-cli.js bump <alvo>`) — o `<div class="version">`/`const VERSION` **e** `version.json` — e, se mexeu em módulo compartilhado, o `?v=` nas páginas.
- Mudou texto/ícone/validação **numa** página? `grep` o mesmo comportamento nas páginas irmãs e cópias (visualizador × escrita, login, `esc`). A cópia esquecida é o achado mais comum.

## 4. Estilo (parecer parte do código que já existe)

- **Diff mínimo.** Não reformate, não renomeie, não "limpe" ao passar. 1 bug = 1 PR. Refatoração é decisão do Caio, não de quem corrige bug.
- **Comentário explica o PORQUÊ**, em português, no tom do arquivo, com data quando é correção: `// (2026-10-16) …motivo…`. Não narre o óbvio.
- **Nomes e padrões do vizinho.** Procure a função irmã e siga o mesmo padrão de nome (`_okrXxx`, `feriasXxx`), de aviso/erro (o helper da própria página: `toast`, `uiConfirm`…) e de texto de interface (nome do botão exatamente como aparece na tela; emoji no mesmo estilo).
- **Não duplique lógica entre arquivos sem teste de paridade** (o pacote anônimo do Oceano × `functions/plantao/pacote.js` tem). Se copiou, diga onde está o espelho e mude os dois.
- **Dado de pessoa** (nome, e-mail, uid, print) nunca vai para PR, commit, log ou prompt. Segredo: ver `AGENTS.md`, linha vermelha nº 6.

## 5. Testar (e entregar o teste)

- Rode `node scripts/checar.js` (JSON, versões, sintaxe, linhas vermelhas, referências) — a CI roda o mesmo. Em `functions/`: `npm test` (e **confira que a contagem subiu** se você criou testes).
- **Script de console** (o ADM roda antes de validar): português; **só leitura**; chama as **funções reais** da página; um caso do bug + pelo menos um **vizinho que não pode quebrar**; termina com `console.table` ✅/❌. **Rode você mesmo antes de entregar** (extraia a função e execute em Node): script que quebra no console não valida nada.
- Dado antigo importa: teste com o formato **antigo** (campo ausente, string no lugar de número), não só com o que a tela acabou de criar.

## 6. Subagentes: como usar bem (orquestrador × especialistas)

Os especialistas definidos no `AGENTS.md` (um por área: Maré, Radar, Painel/Oceano, functions+docs) existem para **ler e editar arquivos grandes sem encher a conversa principal**. Para bug pequeno do plantão (1 linha, 1 arquivo), **faça direto** — subagente é para quando a área é grande ou há mais de um arquivo.

- **Briefing completo e autônomo** (o subagente não vê a conversa): arquivo(s) e âncoras (`CODE_MAP_FAST.md`), o sintoma exato, o que **não** pode mudar, a regra "diff mínimo", e **o que devolver**.
- **Contrato de retorno:** (1) lista de arquivos + linhas tocadas, (2) o diff resumido, (3) evidência (reprodução antes/depois), (4) riscos e o que **não** foi verificado. Sem isso, não aceite.
- **Um dono por arquivo.** Dois subagentes nunca editam o mesmo arquivo ao mesmo tempo; áreas independentes podem rodar em paralelo.
- **Subagente nunca usa terminal** (aprovação por comando); só o orquestrador roda o comando único no fim.
- **Revisor independente:** depois que um especialista edita, peça a **outro** subagente (contexto limpo) para revisar o diff contra a seção 3 e o seu checklist da seção 7 — quem escreveu não é bom revisor do próprio código.
- **Docs (`/atualizardocumentacoes`):** o especialista de documentação (`agente-functions-docs`) cuida de `BUGS_E_CORRECOES.md` (via `mare-cli.js log`), `CHANGELOG.md` (só feature), `CODE_MAP*.md`, `maredigital.html`, `docs/OCEANO.md` e ajuda in-app; ele só cita arquivos que **existem** (a CI confere).
- **Logs de Cards & Scripts de Teste (`agente-logs-testes`):** especialista dedicado a montar (1) o script de console de log de cards em `kanban/squads/dados/dados/card_comments/${CARD_ID}/${id}` via `window._set(window._ref(window._db, ...))` com `ts: new Date().toISOString()` e (2) os scripts de teste de console read-only (`F12 → Console`) para todos os apps, cuidando das diferenças entre `<script>` clássico (`kanban`, `painel`, `okr`) e IIFE (`oceano`, `escala`, `intake`) e da mutação de `const` via `try / finally`.

## 7. Checklist antes do comando único (se um item falha, volte)

1. Reproduzi o bug antes e o conserto muda exatamente isso?
2. Li a função inteira e **todos** os outros escritores do mesmo dado?
3. O diff tem só o necessário (sem reformatação, sem arquivo a mais)?
4. Todo `${}` do banco passa por `esc()`/`jsq()`; nenhum `undefined`/chave inválida vai ao Firebase?
5. Botão que grava tem trava de clique duplo; função async tem "só a última resposta vale"?
6. Mesmo comportamento nas páginas irmãs/cópias — conferi com `grep`?
7. Versão do `-dev` + `version.json` (+ `?v=` se módulo) + entrada no `BUGS_E_CORRECOES.md` (só arquivos que existem)?
8. `node scripts/checar.js` passa? (`npm test` se mexeu em `functions/`)
9. O script de teste é só leitura, cobre o caso e um vizinho, e **eu o rodei**?
10. Nada de dado pessoal, segredo, produção, `functions/` ou regras do banco no diff? (senão: ESCALAR AO CLAUDE)
