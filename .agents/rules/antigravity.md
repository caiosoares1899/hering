# Antigravity — regras específicas (Alta Velocidade & Automação)

> **Regras do projeto = `CLAUDE.md`; divisão entre os 3 agentes = `docs/COORDENACAO_AGENTES.md` §7.** Linhas vermelhas e o núcleo comum continuam no `AGENTS.md`. Revisão dos seus PRs: Caio e Claude (`docs/COORDENACAO_AGENTES.md` §4.1). "ESCALAR AO CLAUDE" é parada, não sugestão.

## 1. Workspace & Zero Prompts Desnecessários
- **No Mac (`~/hering-agy`):** trabalhe **sempre** em `/Users/caiosoares/hering-agy` (nunca edite `/Users/caiosoares/hering`, que é a pasta do Claude e do Caio). **Dica crítica de velocidade:** mantenha `/Users/caiosoares/hering-agy` aberta diretamente como Workspace da janela do Antigravity — quando a janela está aberta em `~/hering` e você grava em `~/hering-agy`, cada `write_file`/`edit_file` dispara um prompt corporativo *Outside of workspace*. Se a sessão estiver aberta em outra pasta, concentre todas as edições em `"files"` e `"patches"` dentro de um único `.mare-ship.json` para pedir aprovação **1 única vez**.
- **No Windows:** opere em `C:\Users\caio.soares\.gemini\antigravity\scratch\hering`.
- **Ferramentas nativas primeiro (`read_file`, `edit_file`, `write_file`):**
  - Leia arquivos pequenos/médios, skills locais (`.claude/skills/<nome>/SKILL.md`), `.git/HEAD` e `.git/logs/HEAD` com `read_file` em **chamadas paralelas no mesmo turno**.
  - **Exceção técnica real (> 2,5 MB — `kanban-dev.html`, `kanban.html`, `guia-okr.html`):** `kanban-dev.html` (~2,73 MB) ultrapassa o classificador binário do `read_file` (`appears to be a binary file`). Para ele: **(1)** localize a linha exata `Lxxxx` lendo `docs/CODE_SYMBOLS.md` + `CODE_MAP_FAST.md` via `read_file`; **(2)** leia apenas a janela necessária com `node scripts/mare-cli.js slice kanban-dev.html <ini> <fim>` (ou `find <termo> --file kanban-dev.html`); **(3)** aplique a edição via `"patches"` no `.mare-ship.json`.

## 2. Índice Completo `docs/CODE_SYMBOLS.md` (Proibido Varredura Cega)
- **Nunca faça dezenas de `read_file` sequenciais procurando onde uma função, CSS ou `const` mora.**
- Antes de abrir qualquer página `-dev` ou módulo `mare-*-dev.js`, leia [`docs/CODE_SYMBOLS.md`](../../docs/CODE_SYMBOLS.md) (gerado automaticamente por `node scripts/mare-cli.js map`, ~380 linhas): ele traz as faixas exatas de `<style>` e `<script>`, todos os `const`s globais (evitando reatribuição proibida em scripts de console) e todas as funções `fn:Lxxxx` dos 15 arquivos `-dev`.

## 3. Via Rápida Direta (Fast-Lane) vs. Subagentes Paralelos
- **Via Rápida Direta (1 arquivo localizado / ≤ 150 linhas lidas — 80% dos pedidos, meta 1–2 min):**
  - Resolva **diretamente no agente principal**, sem instanciar subagentes frios:
    1. `/seatualizar` enxuto em 1 turno paralelo (`docs/COORDENACAO_AGENTES.md` inteiro (o Quadro é a §6; sem faixa de linhas fixa), `version.json`, `CHANGELOG.md` L1–55, `BUGS_E_CORRECOES.md` L1–115 — não releia `AGENTS.md`/regras já injetadas em `<user_rules>`).
    2. Consulte a linha `Lxxxx` em `docs/CODE_SYMBOLS.md` e leia só a fatia cirúrgica (`StartLine`/`EndLine` de 60–120 linhas, ou `mare-cli.js slice` para `kanban-dev.html`).
    3. Aplique a edição (`edit_file` ou `"patches"` no `.mare-ship.json`), inclua `testScript` no `.mare-ship.json` e execute **1 único comando final**: `node scripts/mare-cli.js ship`.
- **Arquitetura Multiagentes Paralela (2+ páginas/domínios, `/atualizardocumentacoes`, `/monitorarbugs`, `/auditoriaseguranca` ou contexto longo):**
  - Defina (`define_subagent`) e acione **em paralelo no mesmo turno** (`invoke_subagent`, `Workspace: 'inherit'`), **já entregando no prompt de cada subagente as linhas `Lxxxx` extraídas do `docs/CODE_SYMBOLS.md`** para que nenhum subagente faça busca cega:
    1. **`agente-mare`** (`Model: 'inherit'`): `kanban-dev.html` / `kanban.html`, `intake-dev.html` / `intake.html`, `escala-dev.html` / `escala.html`, `travessia-dev.html` / `travessia.html`.
    2. **`agente-radar`** (`Model: 'inherit'`): `okr-dev.html` / `okr.html`, `okr-apresentacao.slide.html`, `guia-okr.html`.
    3. **`agente-painel-oceano`** (`Model: 'inherit'`): `painel-dev.html` / `painel.html`, `oceano-dev.html` / `oceano.html` e módulos `mare-*-dev.js` (respeitando a trava do Sonar/módulos do Claude).
    4. **`agente-functions-docs`** (`Model: 'flash'` para docs mecânicas / `'inherit'` para código): `CHANGELOG.md`, `BUGS_E_CORRECOES.md`, `CODE_MAP.md`, `maredigital.html`, `ecossistema.html`, `docs/OCEANO.md`.
    5. **`agente-logs-testes`** (`Model: 'flash'`): scripts de console read-only (`F12 → Console`) e logs de cards (`kanban/squads/dados/dados/card_comments/${CARD_ID}/${id}` com `ts: new Date().toISOString()`) quando o lote for multi-app.

## 4. Automação em 1 Clique (`scripts/mare-cli.js` v2 vs `promover.js`)
- **`node scripts/mare-cli.js ship` (via `.mare-ship.json`):** sincroniza `origin/main` preservando edições locais sem conflito de stash, aplica `"files"` e `"patches"` declarativos, espelha `.claude/skills` → `.agents/skills` (quando diretório físico), roda `promote` / `bump` / `check-script` (contra o `-dev` já atualizado!) / `log` / `map` (`CODE_MAP_FAST.md` + `docs/CODE_SYMBOLS.md` + `mapa.js`) / `conhecimento` / `tests` / `checar.js`, faz commit com `Agent: antigravity`, `git push` e cria/atualiza a PR via `gh`.
- **Comandos utilitários rápidos do `mare-cli.js`:**
  - `node scripts/mare-cli.js brief` → resumo completo do `/seatualizar` em `<0,15s`.
  - `node scripts/mare-cli.js daily` → rotina diária (`brief` + `promover.js --status` + `checar.js` + `functions npm test`).
  - `node scripts/mare-cli.js slice <arq> <ini> <fim>` e `find <padrao> [--file <arq>]` → leitura/busca numerada instantânea.
  - `node scripts/mare-cli.js check-script --page <arq> (--file <js> | --code "<js>")` → valida sintaxe, read-only, `const`s e existência de cada símbolo/ID.
- **`node .claude/skills/subirproprod/promover.js`:** cuida exclusivamente da promoção dev→prod (`--status` e `<alvos>` nos 14 pares/módulos).
- **Regras permanentes:** nunca faça merge de PR próprio, nunca `git push --force`, nunca `firebase deploy` sem comando explícito do Caio (registre em *Pendente de deploy* no Quadro), e só gere log de card / aviso de Mural+WhatsApp em `/subirproprod`.
