---
name: atualizardocumentacoes
description: Atualiza de ponta a ponta todas as documentações do ecossistema Oceano / Maré Digital (maredigital.html, ecossistema.html — o documento técnico para a TI —, HELP_CONTENT do kanban-dev.html, ajuda do okr-dev.html e guia-okr.html, FAQ de oceano-dev.html e docs/OCEANO.md, CHANGELOG.md, BUGS_E_CORRECOES.md, CODE_MAP.md + CODE_MAP_FAST.md e base de conhecimento do Agente Ágil). Usada tanto pelo Claude quanto pelo Antigravity (que delega aos subagentes de documentação respeitando o quadro de coordenação). Use sempre que o usuário pedir "atualiza as documentações", "roda o atualizardocumentacoes", "deixa a documentação em dia", "sincroniza docs/codemap/ajuda/maredigital", ou invocar /atualizardocumentacoes diretamente.
---

# `/atualizardocumentacoes` — Sincronização Completa das Documentações (Claude + Antigravity)

Esta skill é compartilhada entre **Claude** e **Antigravity** para manter **todas** as camadas de documentação do ecossistema **Oceano / Maré Digital** sincronizadas com o código real, sem esquecer nenhuma ponta e sem um agente atropelar o arquivo que o outro está editando.

---

## Passo 0 — Antes de tocar em qualquer arquivo: `/seatualizar` + Quadro

1. **Conferir `docs/COORDENACAO_AGENTES.md` (seção "6. Quadro → Em andamento"):**
   - Se o outro agente declarou que está editando um arquivo HTML (ex.: `oceano-dev.html`, `kanban-dev.html`, `okr-dev.html`, `painel-dev.html`), **NÃO toque nesse arquivo agora**. Atualize apenas as documentações livres e registre no resumo final qual arquivo ficou de fora por estar em andamento no outro agente.
2. **Conferir o estado real do repositório (`version.json`, topo do `CHANGELOG.md` e `BUGS_E_CORRECOES.md`):**
   - Nunca invente nomes de arquivos nem versões de cabeça (ex.: o Radar é `okr.html` / `okr-dev.html`, o portal de visão do ecossistema para a TI é `ecossistema.html` e a referência detalhada do Maré é `maredigital.html`, nunca `radar.html` ou `maredigital-dev.html`).
   - Leia `version.json` ou rode `node scripts/mare-cli.js status` para ter os números exatos de versão dev/prod e `?v=N` dos módulos compartilhados.

---

## Como cada agente executa esta skill

### Se você é o **Claude**:
- Pode editar diretamente os arquivos necessários ou focar no escopo pedido pelo usuário (ex.: apenas docs da feature recém-criada ou varredura geral).
- Ao final, rode `node scripts/mare-cli.js map` (se mudou âncoras no `CODE_MAP.md`), `cd functions && npm run conhecimento` (se mudou `HELP_CONTENT` do `kanban.html` de prod ou `CHANGELOG.md`) e `node scripts/checar.js`.

### Se você é o **Antigravity**:
- **Regra Orquestrador Zero-Código (`AGENTS.md`):** Nunca leia nem edite arquivos grandes (`.html` / `CODE_MAP.md`) diretamente na conversa principal.
- **Delegue ao subagente de documentação `agente-functions-docs`** (e, quando for atualizar ajuda in-app dentro de HTMLs que **não** estejam travados no Quadro pelo Claude, acione em paralelo os subagentes de domínio correspondentes via `invoke_subagent` com `Workspace: 'inherit'` e zero terminal):
  - **`agente-functions-docs`**: `maredigital.html`, `ecossistema.html`, `CHANGELOG.md`, `BUGS_E_CORRECOES.md`, `CODE_MAP.md`, `docs/OCEANO.md`, `version.json`.
  - **`agente-mare`**: `HELP_CONTENT` e textos inline de ajuda em `kanban-dev.html` (somente se `kanban-dev.html` estiver livre no Quadro).
  - **`agente-radar`**: modal de ajuda `#okr-help-ov` em `okr-dev.html` e slides de `guia-okr.html` (somente se estiverem livres no Quadro).
  - **`agente-painel-oceano`**: `const FAQ` em `oceano-dev.html` e `docs/OCEANO.md` (somente se `oceano-dev.html` estiver livre no Quadro).
- Quando os subagentes terminarem, o Orquestrador executa **1 único comando agrupado** no final com `node scripts/mare-cli.js bump` (se algum `-dev.html` foi tocado), `node scripts/mare-cli.js map`, `npm --prefix functions run conhecimento`, `node scripts/checar.js`, branch, commit (`Agent: antigravity`), push e PR.

---

## Os 8 Alvos da Documentação (Checklist Completo)

Passe pelos 8 alvos abaixo (3 e 3-B são a documentação técnica). Se o usuário pediu `/atualizardocumentacoes` após uma entrega específica, atualize todos os alvos impactados por aquela entrega; se pediu uma revisão geral, audite todos frente às últimas entradas do `CHANGELOG.md` e `BUGS_E_CORRECOES.md`.

### 1. `CHANGELOG.md` e `BUGS_E_CORRECOES.md` (Histórico de Entregas vs. Bugs)
- **`CHANGELOG.md`** — exclusivo para **novas funcionalidades (features)** e **grandes melhorias estruturais**:
  - Formato: `### AAAA-MM-DD — <Título claro da entrega>` logo abaixo de `## kanban.html (produção)`.
  - Se a entrega ainda estiver **apenas em `-dev`** (não promovida a prod), inclua `(SÓ DEV)` no título ou item para não quebrar o teste `conhecimento.test.js`.
  - Via CLI: `node scripts/mare-cli.js log --type feature --title "AAAA-MM-DD — ..." --body "..."`.
- **`BUGS_E_CORRECOES.md`** — concentra **bugs reportados**, **correções pontuais**, **ajustes de regressão**, **achados do `/monitorarbugs`** e **bugs do `/plantaobug`**:
  - Formato obrigatório: `### AAAA-MM-DD · <arquivo-real> (<versão-real>) — <título>` logo abaixo de `## 🐛 Histórico de Bugs e Correções` (nunca acima da seção `## 🛡️ Armadilhas Conhecidas`).
  - Se um bug revelou uma nova armadilha técnica recorrente, adicione também um item numerado em `## 🛡️ Armadilhas Conhecidas & Regras de Ouro (Não Repetir)`.
  - Via CLI: `node scripts/mare-cli.js log --type bug --title "<área> — <título>" --body "..."`.

### 2. `CODE_MAP.md` + `CODE_MAP_FAST.md` (Índice do Código)
- Sempre que uma feature ou correção criar/renomear funções, estados globais, modais, rotas de Cloud Functions ou nós do Firebase RTDB:
  1. Atualize a seção correspondente em `CODE_MAP.md` com o nome real da função/constante e o que ela faz.
  2. Atualize o cabeçalho de versões e o rodapé `*Retrato do commit ...*` em `CODE_MAP.md`.
  3. Rode `node scripts/mare-cli.js map` no passo final de terminal para recalcular automaticamente todos os números de linha (`Lxxxx`) em `CODE_MAP.md` e regenerar o `CODE_MAP_FAST.md`.
- *(Para uma auditoria profunda de todas as âncoras do arquivo, consulte também a skill `.claude/skills/atualizarcodemap/SKILL.md`.)*

### 3. `maredigital.html` (referência funcional do ecossistema)
- `maredigital.html` é a referência **funcional detalhada** do Maré Digital, Radar, Oceano, Escala, Metas, Intake, Painel ADM e Agente Ágil.
- Verifique e atualize:
  - **Cabeçalho/rodapé de versões e data de referência** (conferindo os valores reais em `version.json`).
  - **Seções de funcionalidades por produto:** inclua as features recentes que já entraram no ecossistema (cards/tabelas de recursos do Maré, Radar, Oceano, Metas, Escala, Painel e Cloud Functions).
  - O banner/link para `ecossistema.html` no topo continua apontando para a página certa.

### 3-B. `ecossistema.html` (documento técnico e de governança — o que a TI lê)
`ecossistema.html` (criado em 16/10/2026 para a reunião com a TI de 30/10) é a visão **técnica e de governança** do ecossistema Oceano. **Não tem `-dev`: entra no ar no merge.** Cada número ali foi **medido no repositório** — ao atualizar, **refaça a medição** (não copie do texto anterior) e troque o cabeçalho "Retrato de DD/MM/AAAA" (pílula do topo e rodapé). Regra de ouro da página: **nunca escrever afirmação que não aponte para um arquivo do repositório.** Tom técnico e honesto, sem "vendedor".

| Seção (`id`) | O que conferir | Como medir / fonte |
|---|---|---|
| `resumo` (KPIs) | funções exportadas, testes, regras, tags, nº de skills/subagentes | `grep -c "^exports\." functions/index.js` · `cd functions && npm test` (conte `# tests`) · `wc -l database.rules.json` · `git tag \| wc -l` · `ls .claude/skills \| wc -l` |
| `produtos` | versões de cada produto e o que está em prod × só dev | `version.json` · `node .claude/skills/subirproprod/promover.js --status` |
| `arch` | páginas e módulos `mare-*` (e o que usa cada um), funções e nós novos do banco | `docs/BIBLIOTECA.md` · `functions/index.js` · `database.rules.json` (nó novo no banco → também em `NOS_GLOBAIS` do backup) |
| `google`, `seguranca` | contas/domínio, segredos, regras, backups (completo semanal + global diário + vigia) | `database.rules.json`, `storage.rules`, `functions/backup/`, `docs/arezzo/MARE_SO_HERING.md` |
| `ambientes` | dev × prod: pares `-dev`, nós `_dev`, ciclo de promoção (a skill `/subirproprod` agora confere **todos** os pares) | `promover.js --status` · `CLAUDE.md` (Release process) |
| `agente`, `agentes-dev` | modelos/roteamento, cache de prompt, limites, kill switch, ferramentas | `functions/agente-agil-orquestrador/` (README + constantes) — qualquer número de tokens/custo precisa de evidência no código |
| `github` | política de PR, CI, linhas vermelhas, trilha `Agent:` | `.github/workflows/`, `scripts/checar.js` (agora também cobra a Biblioteca da raiz), `AGENTS.md`, `git log` |
| `skills`, `subagentes` | lista **completa** de skills (hoje inclui `/melhoriauiux` e o guia `docs/GUIA_UI_UX.md`) e dos subagentes do Antigravity | `ls .claude/skills` · `.agents/` · `AGENTS.md` |
| `squads` | personalização por squad (campos, colunas, automações, receitas) | `CODE_MAP.md` |
| `operacao`, `riscos`, `internalizacao` | custo/monitores (VTEX, GitHub, Firebase), plantão de bugs, revisão automática das PRs do Antigravity, riscos e próximos passos | `docs/PLANTAO_BUGS.md`, `docs/COORDENACAO_AGENTES.md` (§4.1, Backlog) |
| `auditar` (comandos) + tabela "Onde está cada documento" | os comandos ainda existem e os comentários com números batem; documento novo em `docs/` entra na tabela | rode os comandos da própria seção; `docs/BIBLIOTECA.md` |

- **Sinal de drift conhecido (17/10):** a página citava 899 testes / 389 linhas de regras / 468 tags; as medições já eram 901–902 / 395 / 469+. Números envelhecem em dias — meça sempre.
- Mudou algo que a TI vê (segurança, regras, backup, política de PR, novo produto)? Esta página entra **no mesmo PR** da mudança, não numa rodada posterior.
- Link no Oceano: botão com `data-doc="ecossistema.html"` + `DOCS` em `oceano(-dev).html` — se renomear/mover a página, atualize os dois (e `maredigital.html`).

### 4. Central de Ajuda do Maré Digital (`HELP_CONTENT` em `kanban-dev.html`)
- Localização: objeto `const HELP_CONTENT` em `kanban-dev.html` (consulte a linha exata em `CODE_MAP_FAST.md`) e textos inline das abas de `⚙ Configurações`.
- Siga as diretrizes de `.claude/skills/atualizarhelpcontent/SKILL.md`:
  - Linguagem simples, direta, em português claro para o usuário final (sem nomes de variáveis ou funções).
  - Atualize as abas impactadas (`primeiros_passos`, `board`, `cards`, `filtros`, `metricas`, `config`, `notificacoes`, `agente_agil`, `faq`).
  - Se editar `kanban-dev.html`, lembre-se de rodar `node scripts/mare-cli.js bump kanban-dev` no final.

### 5. Central de Ajuda e Guia Visual do Radar (`okr-dev.html` e `guia-okr.html`)
- Em `okr-dev.html`: modal `#okr-help-ov` (abas `#hlp-Conceitos`, `#hlp-ComoUsar`, `#hlp-datastudio`, `#hlp-Agente`, `#hlp-Atalhos`).
- Em `guia-okr.html`: slides interativos do Guia do Radar.
- Garanta que fluxos novos do Radar (como promoção de itens, Data Studio, sala ao vivo, anotações, ferramentas do Agente Ágil do Radar) estejam refletidos nos dois lugares. Se editar `okr-dev.html`, faça bump via `node scripts/mare-cli.js bump okr-dev`.

### 6. Documentação e FAQ do Oceano (`docs/OCEANO.md` e `oceano-dev.html`)
- **`docs/OCEANO.md`**: documento markdown detalhando a arquitetura e funcionalidades do hub Oceano (`oceano.html` / `oceano-dev.html`), incluindo tiles, monitor de status, metas no Oceano, Assistente/Plantão de Férias e integrações.
- **`oceano-dev.html` (`const FAQ`)**: perguntas e respostas da seção de ajuda do Oceano (e base de conhecimento do Assistente de Férias, quando aplicável).
- ⚠️ **Atenção:** Verifique sempre o Quadro em `docs/COORDENACAO_AGENTES.md` antes de tocar em `oceano-dev.html`. Se o outro agente estiver trabalhando nele, atualize apenas `docs/OCEANO.md`.

### 7. Base de Conhecimento do Agente Ágil (`functions/agente-agil-orquestrador/conhecimento/`)
- O Agente Ágil lê os JSONs gerados por `functions/agente-agil-orquestrador/conhecimento/gerarConhecimento.js` a partir do `HELP_CONTENT` de `kanban.html` (prod) e do `CHANGELOG.md`.
- Sempre que `CHANGELOG.md` ou `kanban.html` mudarem, inclua no comando final:
  `npm --prefix functions run conhecimento`
  Isso regenera os JSONs e garante que o teste `conhecimento.test.js` (e `node scripts/checar.js`) passe sem divergências.

---

## Fechamento e Validação Obrigatória

No comando único final de terminal:
1. Se tocou em algum `-dev.html` ou `mare-*-dev.js`: `node scripts/mare-cli.js bump <alvos>`
2. Se tocou em `CODE_MAP.md` ou em linhas de arquivos mapeados: `node scripts/mare-cli.js map`
3. Se tocou em `CHANGELOG.md` ou `kanban.html`: `npm --prefix functions run conhecimento`
4. **Checagem obrigatória do repositório:** `node scripts/checar.js` (valida `version.json`, sintaxe de todos os `<script>` HTML, workflows e suíte de testes de `functions/`).
5. Fluxo Git (`git checkout -b ...`, `git add`, `git commit` com trailer `Agent: claude` ou `Agent: antigravity`, `git push` e `gh pr create`).
