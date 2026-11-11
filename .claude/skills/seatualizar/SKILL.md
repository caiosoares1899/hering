---
name: seatualizar
description: Coloca o agente (Claude ou Antigravity) 100% em dia com tudo o que o outro agente e o Caio mudaram recentemente no repositório — quadro de coordenação, versões, changelog, bugs e correções, guia de código, plantão de bugs, codemap e últimos commits/PRs — antes de começar uma tarefa nova, evitando conflitos de arquivo, retrabalho ou premissas desatualizadas. Use sempre que o usuário pedir "se atualiza", "roda o seatualizar", "vê o que o Claude/Antigravity mudou", "fica em dia com o repositório", ou invocar /seatualizar diretamente — e aplique também como REGRA PERMANENTE no início de qualquer sessão ou novo pedido.
---

# `/seatualizar` — Sincronização Rápida em 1 Turno Paralelo (Regra Permanente)

> **REGRA PERMANENTE DO PROJETO:** Tanto o **Claude** quanto o **Antigravity** devem executar este protocolo **no início de uma sessão**, **após um resync/merge**, ou **antes de iniciar um novo pedido**. Começar sem conferir o Quadro causa conflito de arquivo, retrabalho e premissas erradas.

---

## Modo Express (1 Único Turno Paralelo — ~2 segundos, Zero Desperdício de Contexto)

> **Para o Antigravity:** Você já recebe `AGENTS.md`, `.agents/rules/antigravity.md` e `.agents/rules/release-process.md` injetados automaticamente em `<user_rules>` — **NÃO gaste turnos relendo esses arquivos**! Faça **1 única bateria paralela de `read_file`** nos 4 alvos dinâmicos abaixo (ou rode `node scripts/mare-cli.js brief` se já for usar terminal na rotina diária):

1. **`docs/COORDENACAO_AGENTES.md` (`StartLine: 109, EndLine: 165`):**
   - **`### Em andamento`:** quais arquivos estão reservados por Claude ou Codex agora? (**Proibido tocar neles** até o merge.)
   - **`### Escalado para o Claude` / `### Pendente de deploy`:** há bloqueio ou deploy pendente do Caio?
   *(Na 1ª tarefa da sessão, se ainda não leu a tabela de escopo §1 ou o §7, leia `StartLine: 1, EndLine: 225`.)*
2. **`version.json` (inteiro, ~15 linhas):**
   - Quais páginas estão com `-dev` à frente de `prod` (`kanban`, `painel`, `okr`, `oceano`, `escala`)?
3. **`CHANGELOG.md` (`StartLine: 1, EndLine: 65`) e `BUGS_E_CORRECOES.md` (`StartLine: 1, EndLine: 130`):**
   - Últimas features e correções que acabaram de entrar + seção `🛡️ Armadilhas Conhecidas` (1 a 16).
4. **`.git/HEAD` (e últimas linhas de `.git/logs/HEAD`):**
   - Confirma branch/commit local sem rodar terminal. Se houver PR `antigravity/*` aberta sua, confira se há comentário `🔍 Revisão do Claude` antes de abrir outra frente.

### Ao partir para o código da tarefa:
- Leia **`docs/CODE_SYMBOLS.md`** (e `CODE_MAP_FAST.md`) para pegar a linha exata `Lxxxx` de qualquer `<style>`, `<script>`, `const` ou função antes de abrir páginas grandes.
- Se for mexer em tela/fluxo/cor, consulte `docs/GUIA_UI_UX.md`; se for editar código/testes de área nova, consulte `docs/GUIA_DE_CODIGO.md` e a regra `.claude/rules/*.md` correspondente.

---

## Quando o usuário invocar `/seatualizar` diretamente

Entregue um resumo executivo curto e direto em 4 pontos:
1. **🛠️ Em andamento / Travas no Quadro:** o que Claude e Codex estão mexendo agora (e quais arquivos estão reservados).
2. **🚀 Últimas alterações e Versões (`version.json`):** o que entrou recentemente em `CHANGELOG.md` e `BUGS_E_CORRECOES.md`, e o que está só em `-dev` vs. igual a `prod`.
3. **☁️ Pendente de deploy no Firebase:** itens ativos na tabela *Pendente de deploy* do Quadro.
4. **✅ Pronto para começar:** confirmação de contexto sincronizado e arquivos livres.
