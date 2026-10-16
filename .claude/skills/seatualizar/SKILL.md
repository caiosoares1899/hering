---
name: seatualizar
description: Coloca o agente (Claude ou Antigravity) 100% em dia com tudo o que o outro agente e o Caio mudaram recentemente no repositório — quadro de coordenação, versões, changelog, bugs e correções, guia de código, plantão de bugs, codemap e últimos commits/PRs — antes de começar uma tarefa nova, evitando conflitos de arquivo, retrabalho ou premissas desatualizadas. Use sempre que o usuário pedir "se atualiza", "roda o seatualizar", "vê o que o Claude/Antigravity mudou", "fica em dia com o repositório", ou invocar /seatualizar diretamente — e aplique também como REGRA PERMANENTE no início de qualquer sessão ou novo pedido.
---

# `/seatualizar` — Sincronização entre Agentes e Leitura de Contexto Recente (Regra Permanente)

> **REGRA PERMANENTE DO PROJETO:** Tanto o **Claude** quanto o **Antigravity** devem executar este protocolo de atualização **sempre no início de uma sessão**, **após um resync/merge**, ou **antes de iniciar um novo pedido**, mesmo que o usuário não digite `/seatualizar` explicitamente. Começar uma tarefa sem saber o que o outro agente acabou de fazer causa conflito de branch, sobrescrita de código e premissas erradas.

---

## O que ler e conferir (Ordem Rápida e Sem Desperdício de Contexto)

> **Para o Antigravity:** Faça todas as leituras de arquivos abaixo usando **exclusivamente `view_file` e `read_url_content` em chamadas paralelas** (zero terminal!). Inspecione até mesmo a branch e o último commit local lendo `.git/HEAD` e `.git/logs/HEAD` via `view_file`, e leia comentários de revisão do Claude (`🔍 Revisão do Claude`) nas PRs via `read_url_content` na URL da PR (`https://github.com/caiosoares1899/hering/pull/<N>`). Só use terminal no comando único final da tarefa (`node scripts/mare-cli.js ship`).

### Passo 0 — Estado do Git Local e Revisões de PRs (`view_file` em `.git/HEAD` e `.git/logs/HEAD`)
1. Leia `.git/HEAD` e o final de `.git/logs/HEAD` com `view_file` (sem usar `git status`/`git log` no terminal) para saber em qual branch e commit o clone local está.
2. Se houver PR `antigravity/*` aberta, confira via `read_url_content` se há comentário `🔍 Revisão do Claude` (`docs/COORDENACAO_AGENTES.md` §4.1) antes de abrir qualquer nova frente.

### Passo 1 — Quadro de Coordenação e Divisão de Trabalho (`docs/COORDENACAO_AGENTES.md`)
Leia `docs/COORDENACAO_AGENTES.md` inteiro (é curto, ~150 linhas) e verifique:
1. **`### Em andamento`:** Quais arquivos e branches o outro agente está mexendo **agora**?
   - **Regra de ouro:** Se o outro agente declarou que está mexendo em um arquivo (ex.: `oceano-dev.html`, `kanban-dev.html`), **NÃO edite esse arquivo** até o PR dele ser mergeado.
2. **`### Escalado para o Claude` / `### Pendências do Antigravity`:** Há algum item pendente para você resolver ou algum bloqueio registrado?
3. **`### Pendente de deploy (só o Caio roda)`:** O que mudou em `functions/` ou `database.rules.json` que já está no código da `main`, mas pode aguardar deploy (ou já foi implantado)?

### Passo 2 — Versões Atuais (`version.json`)
Leia `version.json` completo (~25 linhas) para saber exatamente:
- Qual versão está em `-dev` e qual versão está em **produção** para cada app (`kanban`, `painel`, `okr`, `oceano`, `escala`, `intake`, `okr_apresentacao`).
- Se `-dev` está à frente de `prod` em algum arquivo (sinalizando que já existe mudança não promovida naquele arquivo!).

### Passo 3 — Últimas Entregas e Últimos Bugs (`CHANGELOG.md` e `BUGS_E_CORRECOES.md`)
1. Leia as **primeiras 100 linhas de `CHANGELOG.md`** (`StartLine: 1, EndLine: 100`) para ver as últimas features entregues por qualquer um dos dois agentes.
2. Leia as **primeiras 140 linhas de `BUGS_E_CORRECOES.md`** (`StartLine: 1, EndLine: 140`) para:
   - Relembrar a seção **`## 🛡️ Armadilhas Conhecidas & Regras de Ouro (Não Repetir)`**.
   - Ver as correções de bugs mais recentes no topo de **`## 🐛 Histórico de Bugs e Correções`**.

### Passo 4 — Guias Operacionais e Regras (`AGENTS.md`, `docs/GUIA_DE_CODIGO.md`, `docs/PLANTAO_BUGS.md`)
- Confira se houve apontamentos ou regras novas em:
  - `AGENTS.md` e `.agents/rules/release-process.md` (regras operacionais e linhas vermelhas).
  - `docs/GUIA_DE_CODIGO.md` (como escrever código e scripts de teste sem cair em armadilhas de `const`, escopo IIFE, XSS ou race conditions).
  - `docs/PLANTAO_BUGS.md` (se a tarefa envolver o Plantão de Férias / Oceano / `functions/plantao/`).

### Passo 5 — Índice Rápido do Arquivo Alvo (`CODE_MAP_FAST.md`)
- Antes de procurar qualquer função ou seção num arquivo grande, leia a seção correspondente em `CODE_MAP_FAST.md` para pegar as linhas atualizadas (`Lxxxx`) deixadas pela última entrega.

---

## Quando o usuário invocar `/seatualizar` diretamente (ou pedir "vê o que o outro mudou")

Entregue um resumo executivo curto e direto estruturado assim:
1. **🛠️ Em andamento / Travas no Quadro:** o que o outro agente está mexendo agora (e quais arquivos estão reservados).
2. **🚀 Últimas alterações que entraram no repositório:** resumo objetivo das últimas features (`CHANGELOG.md`), correções (`BUGS_E_CORRECOES.md`), regras/skills novas e estado das versões (`version.json` — o que já está igual em prod e o que está só em `-dev`).
3. **☁️ Pendente de deploy no Firebase:** itens listados na tabela de deploy do `docs/COORDENACAO_AGENTES.md`.
4. **✅ Pronto para começar:** confirmação de que o contexto foi atualizado e quais cuidados serão tomados no próximo pedido para não conflitar com o outro agente.
