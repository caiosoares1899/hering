---
name: plantaobug
description: >-
  Plantão de Bugs (férias do Caio, 16/10→03/11/2026): conserta UM bug reportado no Oceano a partir do "pacote anônimo" colado pelo ADM, edita só o arquivo -dev indicado, entrega um script de teste de console para o ADM rodar antes de validar e para num único comando agrupado (branch + commit + push + PR de dev) que o ADM aprova com um clique. Use quando o usuário invocar /plantaobug (com o pacote colado) ou disser "plantão de bug", "bug do plantão", "conserta esse bug do Assistente Férias". Não é o /monitorarbugs (varredura ampla de uma área): aqui o escopo é o bug do pacote, nada além.
---

# Plantão de Bug — conserta UM bug do pacote anônimo

Runbook completo: `docs/PLANTAO_BUGS.md`. Regras de conduta: `AGENTS.md` ("Linhas vermelhas") — **valem aqui sem exceção**.

## Entrada

O ADM cola o **pacote anônimo** do Oceano (botão "📋 Copiar pacote anônimo"), no formato:
`/plantaobug em <arquivo>-dev.html — Bug reportado no Oceano (<app> · <impacto>): <descrição> [Console(F12)…]` (o botão já copia com `/plantaobug` na frente — é só colar; pacotes antigos começam com `/monitorarbugs em …`, trate igual)
Ele não traz nome, e-mail, link nem print — **não peça nem procure esses dados** (estão no card da Squad Dados e são confidenciais).

## O que fazer (nesta ordem)

0. **Leia `docs/GUIA_DE_CODIGO.md`** (seções 2, 3 e 7) antes de abrir qualquer arquivo de código — é onde estão as armadilhas que já geraram bug neste repositório e o checklist de antes do comando único. Bug de 1 linha em 1 arquivo: faça direto, sem subagentes; área grande ou vários arquivos: use os especialistas conforme a seção 6.

1. **Entenda e reproduza pelo código.** Leia só a área do bug (`CODE_MAP_FAST.md` e `BUGS_E_CORRECOES.md` primeiro; leia a função INTEIRA, não trechos). Use as ferramentas nativas de leitura/busca — **sem terminal** até o passo 6.
2. **Confira o escopo.** Se o conserto exigir mais de uma página, mexer em `functions/`, `database.rules.json`, módulos compartilhados (`mare-*-dev.js`) ou em qualquer arquivo de **produção**: **PARE** e responda `ESCALAR AO CLAUDE` + o motivo em 2 linhas. Não tente "dar um jeito".
3. **Corrija** só o necessário, só no arquivo `-dev` do pacote (padrão do repo: dev primeiro; nunca `kanban.html`/`oceano.html`/… direto). Sem refatorar além do bug.
4. **Versão e registro:** bump da versão do `-dev` (`node scripts/mare-cli.js bump <alvo>` — se o `mare-cli` pedir terminal, faça no passo 6, dentro do comando único) e entrada em `BUGS_E_CORRECOES.md` (`mare-cli.js log --type bug --title "<área> — <título>"`, mesmo comando único; **não ponha a data no `--title`**, o `mare-cli` já a coloca): cenário concreto do bug, causa, correção. **Só cite arquivos que existem** (a CI confere).
5. **Entregue o SCRIPT DE TESTE** (obrigatório — sem ele o ADM não pode validar):
   - em **português**, para colar no **console (F12) da página de DEV**, e diga **em que página/tela** rodar e o que preparar antes;
   - **SOMENTE LEITURA**: não grava no Firebase, não clica em "salvar/excluir/enviar", não chama `_set`/`_update`/`remove`. Se for impossível testar sem gravar, descreva o passo manual em vez de gravar;
   - chama as **funções reais** da página (regras do `monitorarbugs`, Passo 6), nunca uma cópia; nunca cria elemento com id repetido;
   - **nunca reatribua uma variável de página** para simular estado (ex.: `today = new Date(...)`): se ela for `const` (como o `today` do `kanban-dev.html`) o script quebra com "Assignment to constant variable". Para `Date` constante, **mude o valor** (`today.setTime(novo.getTime())`) e **restaure no `finally`**; para outros casos, passe o valor por parâmetro à função testada. **Rode o script você mesmo antes de entregar** (ex.: extraindo a função e executando em Node) e só entregue se ele imprimir a tabela até o fim;
   - guarda o resultado em `window._resultadosTeste` e termina com `console.table` de ✅/❌ por verificação (o cenário do bug e pelo menos 1 caso vizinho que não pode ter quebrado);
   - entregue o script **completo e visível na resposta** (não só um caminho de arquivo).
6. **Comando único** (o ADM aprova com 1 clique — não rode `git`/`node` antes disso; agrupe tudo numa única chamada de terminal):
   `git fetch origin && git checkout -b antigravity/bug-<id-curto> origin/main && <bump + log> && node scripts/checar.js && git add <arquivos> && git commit -m "<mensagem>` + linha em branco + `Agent: antigravity" && git push -u origin antigravity/bug-<id-curto>` e abrir o PR **de dev** contra `main` com título `Plantão: <resumo>` (token via `git credential fill`, como no `AGENTS.md`).
   **Nunca** faça merge, **nunca** push na `main`, **nunca** abra PR de prod (só depois do ✅ do ADM, e é outra tarefa: `/subirproprod`).
7. **Feche com um bloco curto para o ADM** (e nada mais):
   - **Resumo** do conserto (3 linhas);
   - **Link do PR** (depois do comando);
   - **Script de teste** (o bloco do passo 5);
   - **Como validar:** "cole o link do PR e o script no painel 🛟 Plantão (Oceano › 🐛 Reportar Bug), rode o script no console do dev e clique em ✅ ou ❌".

## Modo automático (tarefa agendada do Antigravity)

Quando a entrada vier de uma **busca automática** — texto começando por `PLANTAO_BUG` (com `id:`, `branch:`, `tentativa:` e, depois de `PACOTE:`, o pacote) — vale tudo acima, mais:
- **Use exatamente o `branch:` informado** (é por ele que o servidor liga a PR ao bug). Branch de outro nome = a PR não aparece no plantão.
- No **corpo da PR** ponha, além do resumo, uma seção `## Script de teste` com o script num bloco ```` ```javascript ````. O servidor lê dali (o Antigravity não consegue enviar nada por conta própria) e o ADM recebe o script já preenchido no painel 🛟.
- Se vier `REPROVADO pelo ADM`: leia a nota, corrija **no mesmo branch** com um novo commit (nada de PR novo; o servidor vê o novo commit sozinho), reescreva o script cobrindo o que falhou e atualize o `## Script de teste` da PR **no comando único**.
- Resposta `SEM_BUG_PENDENTE`: não faça nada.
- Mesmo nesse modo, **pare no comando único de git** e espere a aprovação — nunca tente aprová-lo por conta própria.

## Se o ADM reprovar

Ele volta com uma **nota** ("o que viu"). Leia a nota, corrija **no mesmo branch** (um novo commit, não um PR novo) e entregue um **novo script** cobrindo o que falhou. Máximo **3 tentativas**; na 3ª reprovação o bug é escalado ao Claude — não insista.

## O que NUNCA fazer

- Contornar a aprovação de terminal (daemon, `.bat`, agendador que "aperta o botão") — controle corporativo, não obstáculo.
- Abrir Issue/PR/commit com dado pessoal; mandar o pacote ou o log para fora do repositório.
- Validar o próprio conserto ou dar o bug por resolvido: **quem valida é um ADM**.
- Mexer em `functions/`, regras do banco ou produção neste fluxo.
