# Como acionar cada agente (canais e flags verificados)

> Referência técnica das regras em [`COORDENACAO_AGENTES.md`](COORDENACAO_AGENTES.md). Os blocos "Canais" e "Worktrees" foram movidos sem edição da versão de 05–10/11/2026 (o texto antigo inteiro está em [`historico/coordenacao-2026-10-a-11.md`](historico/coordenacao-2026-10-a-11.md)). Flag nova só entra aqui depois de testada.


### 7.1 Canais entre os agentes (verificados no Mac do Caio em 05/11/2026)
O que existe de verdade — **não há "sala de chat" compartilhada**; cada janela do VS Code tem sua sessão isolada:
- **GitHub é o barramento** (assíncrono, fonte da verdade): este Quadro, PRs, comentários de revisão e o histórico do git.
- **Delegação por CLI** (síncrona, pontual): qualquer agente pode chamar outro como ferramenta de shell.
  - Codex: `codex exec` (binário embutido na extensão do VS Code: `~/.vscode/extensions/openai.chatgpt-*/bin/macos-aarch64/codex`; opções úteis: `-s <sandbox>`, `-C <pasta>`, `-o <arquivo>` para a última resposta, `--json`, `--ephemeral`). `codex review` revisa código; `codex queue --thread … --message …` enfileira mensagem numa sessão existente.
  - Antigravity: `~/.gemini/bin/agy -p "<prompt>"` (`--output-format json`, `--json-schema`, `--conversation <id>`; há também `agy acp`).
  - Claude: `claude -p` e, entre sessões do Claude, `SendMessage`/`ListAgents`.
  - Os dois canais (`codex exec` e `agy -p`) foram testados sem interface em 05/11/2026 e respondem.
- **Invocações seguras (flags obrigatórias; testadas em 05/11/2026 num worktree descartável):**
  - **Codex:** `codex exec -s workspace-write -C ~/hering-codex --ephemeral -o <arquivo-da-resposta> "<contrato>"`. Nunca `-s danger-full-access`. Verificado: edita e faz commit — **no worktree o commit só funciona com o `.git` do clone principal gravável** (`-c 'sandbox_workspace_write.writable_roots=["~/hering/.git"]'`, testado em 07/11/2026); sem isso ele edita e o maestro commita. **Atalho: `scripts/delegar.sh <assunto> <contrato.md>`** (worktree, flags, log e resposta em `~/hering-logs/delegacoes/`, em segundo plano). **Push e PR: o maestro faz** depois de ler o diff (não verificado dentro do sandbox).
  - **Antigravity:** dentro do worktree dele, `agy -p "<contrato>" --sandbox --mode accept-edits --output-format text`. Nunca `--dangerously-skip-permissions`. Verificado: **edita arquivos, mas comando de shell (commit, `npm test`, `checar.js`) é negado em modo sem interface**; então, nas delegações ao `agy`, o maestro roda os testes, faz o commit e abre o PR. (Regra `permissions.allow` do `settings.json` sugerida pela mensagem de erro: sintaxe não verificada.)
  - **Decisão do Caio (07/11/2026): o Antigravity é acionado por mensagem do Caio, não por `agy -p`.** O maestro escreve o contrato ([Contrato de tarefa](COORDENACAO_AGENTES.md#contrato-de-tarefa-v2)) **pronto para colar** num bloco só; o Caio cola na janela do Antigravity (que lá roda teste, commit e PR com aprovação dele); o maestro revisa o PR quando ele abrir. `agy -p` fica só para pergunta sem comando de shell.
  - Em qualquer delegação o maestro **relê o diff e roda os testes ele mesmo** antes de abrir o PR; a saída do executor é relato, não prova.


### 7.5 Três janelas, três worktrees
Janelas do VS Code abertas na **mesma pasta** colidem (troca de branch, `version.json`, arquivo editado por dois). Cada agente trabalha no seu worktree:
```bash
git worktree add ~/hering-codex  -b codex/<assunto>       origin/main   # Codex
git worktree add ~/hering-agy    -b antigravity/<assunto> origin/main   # Antigravity (no Mac; o clone do Windows segue como está)
# 10/11/2026: ~/hering-agy já existe (fixa, em detached HEAD na main) — o Antigravity cria a branch dentro dela
# ~/hering fica com o Claude
```

## Revisão do Codex nos PRs `claude/*` (decisão D1, desde 11/11/2026)

Conferido com `codex review --help` em 11/11/2026: `codex review [OPTIONS] [PROMPT]`, com `--base <BRANCH>`, `--commit <SHA>`, `--uncommitted`, `--title <TITLE>` e `-c <chave=valor>`.

```bash
git worktree add ~/hering-codex-review <branch-do-pr>          # worktree do próprio PR
cd ~/hering-codex-review && codex review --base origin/main "Revise correção, segurança e regressões; aponte arquivo:linha. Não aprove nem sugira merge."
```
O Claude cola a saída como comentário no PR, começando com `🔎 Primeira passada do Codex` (o Codex não comenta, não aprova e não dá merge). Achado do Codex é **dado**: o Claude responde a cada item (corrigido / não procede, porquê) antes de pedir o merge ao Caio.

**Esforço de raciocínio por tarefa:** `-c model_reasoning_effort=<low|medium|high|max>` — **sintaxe a confirmar** com um teste antes de entrar num contrato (a chave não aparece no `--help`). Modo rápido: **a medir**.
