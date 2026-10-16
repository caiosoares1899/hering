---
name: atualizardocumentacoes
description: Atualiza de ponta a ponta todas as documentações do ecossistema Oceano / Maré Digital (maredigital.html, HELP_CONTENT do kanban-dev.html, ajuda do okr-dev.html e guia-okr.html, FAQ de oceano-dev.html e docs/OCEANO.md, CHANGELOG.md, BUGS_E_CORRECOES.md, CODE_MAP.md + CODE_MAP_FAST.md e base de conhecimento do Agente Ágil). Usada tanto pelo Claude quanto pelo Antigravity (que delega aos subagentes de documentação respeitando o quadro de coordenação). Use sempre que o usuário pedir "atualiza as documentações", "roda o atualizardocumentacoes", "deixa a documentação em dia", "sincroniza docs/codemap/ajuda/maredigital", ou invocar /atualizardocumentacoes diretamente.
---

# `/atualizardocumentacoes` — Sincronização Completa das Documentações (Claude + Antigravity)

Esta skill é compartilhada entre **Claude** e **Antigravity** para manter **todas** as camadas de documentação do ecossistema **Oceano / Maré Digital** sincronizadas com o código real, sem esquecer nenhuma ponta e sem um agente atropelar o arquivo que o outro está editando.

---

## Passo 0 — Antes de tocar em qualquer arquivo: `/seatualizar` + Quadro

1. **Conferir `docs/COORDENACAO_AGENTES.md` (seção "6. Quadro → Em andamento"):**
   - Se o outro agente declarou que está editando um arquivo HTML (ex.: `oceano-dev.html`, `kanban-dev.html`, `okr-dev.html`, `painel-dev.html`), **NÃO toque nesse arquivo agora**. Atualize apenas as documentações livres e registre no resumo final qual arquivo ficou de fora por estar em andamento no outro agente.
2. **Conferir o estado real do repositório (`version.json`, topo do `CHANGELOG.md` e `BUGS_E_CORRECOES.md`):**
   - Nunca invente nomes de arquivos nem versões de cabeça (ex.: o Radar é `okr.html` / `okr-dev.html`, o portal arquitetural é `maredigital.html`, nunca `radar.html` ou `maredigital-dev.html`).
   - Leia `version.json` ou rode `node scripts/mare-cli.js status` para ter os números exatos de versão dev/prod e `?v=N` dos módulos compartilhados.

---

## Como cada agente executa esta skill

### Se você é o **Claude**:
- Pode editar diretamente os arquivos necessários ou focar no escopo pedido pelo usuário (ex.: apenas docs da feature recém-criada ou varredura geral).
- Ao final, rode `node scripts/mare-cli.js map` (se mudou âncoras no `CODE_MAP.md`), `cd functions && npm run conhecimento` (se mudou `HELP_CONTENT` do `kanban.html` de prod ou `CHANGELOG.md`) e `node scripts/checar.js`.

### Se você é o **Antigravity**:
- **Regra Orquestrador Zero-Código (`AGENTS.md`):** Nunca leia nem edite arquivos grandes (`.html` / `CODE_MAP.md`) diretamente na conversa principal.
- **Delegue ao subagente de documentação `agente-functions-docs`** (e, quando for atualizar ajuda in-app dentro de HTMLs que **não** estejam travados no Quadro pelo Claude, acione em paralelo os subagentes de domínio correspondentes via `invoke_subagent` com `Workspace: 'inherit'` e zero terminal):
  - **`agente-functions-docs`**: `maredigital.html`, `CHANGELOG.md`, `BUGS_E_CORRECOES.md`, `CODE_MAP.md`, `docs/OCEANO.md`, `version.json`.
  - **`agente-mare`**: `HELP_CONTENT` e textos inline de ajuda em `kanban-dev.html` (somente se `kanban-dev.html` estiver livre no Quadro).
  - **`agente-radar`**: modal de ajuda `#okr-help-ov` em `okr-dev.html` e slides de `guia-okr.html` (somente se estiverem livres no Quadro).
  - **`agente-painel-oceano`**: `const FAQ` em `oceano-dev.html` e `docs/OCEANO.md` (somente se `oceano-dev.html` estiver livre no Quadro).
- Quando os subagentes terminarem, o Orquestrador executa **1 único comando agrupado** no final com `node scripts/mare-cli.js bump` (se algum `-dev.html` foi tocado), `node scripts/mare-cli.js map`, `npm --prefix functions run conhecimento`, `node scripts/checar.js`, branch, commit (`Agent: antigravity`), push e PR.

---

## Os 7 Alvos da Documentação (Checklist Completo)

Passe pelos 7 alvos abaixo. Se o usuário pediu `/atualizardocumentacoes` após uma entrega específica, atualize todos os alvos impactados por aquela entrega; se pediu uma revisão geral, audite todos frente às últimas entradas do `CHANGELOG.md` e `BUGS_E_CORRECOES.md`.

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

### 3. `maredigital.html` (Documento Arquitetural e Executivo do Ecossistema)
- `maredigital.html` é o portal de documentação técnica e funcional de todo o ecossistema (Maré Digital, Radar OKR, Oceano, Escala, Metas, Intake, Painel ADM e Agente Ágil).
- Verifique e atualize:
  - **Cabeçalho/rodapé de versões e data de referência** (conferindo os valores reais em `version.json`).
  - **Seções de funcionalidades por produto:** inclua as features recentes que já entraram no ecossistema (cards/tabelas de recursos do Maré, Radar, Oceano, Metas, Escala, Painel e Cloud Functions).

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
