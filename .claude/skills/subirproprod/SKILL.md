---
name: subirproprod
description: Promove o conteúdo validado dos arquivos -dev (kanban-dev.html, okr-dev.html, oceano-dev.html, escala-dev.html, intake-dev.html, painel-dev.html, mare-*-dev.js) para produção seguindo o Release process do CLAUDE.md/AGENTS.md em tempo recorde (~30s, 3-4 turnos), usando CHANGELOG.md, BUGS_E_CORRECOES.md e CODE_MAP_FAST.md para localizar os hunks instantaneamente e promover.js para sincronizar os arquivos grandes sem dezenas de replace_file_content sequenciais. Use sempre que o usuário pedir "sobe pro prod", "promove pra prod", "publica em produção", ou invocar /subirproprod diretamente.
---

# Subir pro Prod (`/subirproprod`) — Fluxo Rápido via `CODE_MAP_FAST.md` + `promover.js`

Promove o lote acumulado em `-dev` para produção em **3 a 4 turnos (~30 segundos)**, respeitando a política de **Zero terminal para leitura** e **1 único `run_command` encadeado no final** do `AGENTS.md`.

---

## Por que este fluxo é rápido (Regras de Ouro de Performance)

1. **Nunca faça buscas cegas nos HTMLs gigantes (`kanban.html` tem ~2,5 MB / 39 mil linhas):**
   - Todo item em `-dev` já está documentado no topo do `CHANGELOG.md` (features) ou `BUGS_E_CORRECOES.md` (bugs) com a tag **`(SÓ DEV)`** e os nomes exatos das funções/constantes alteradas.
   - O `CODE_MAP_FAST.md` (e o `CODE_MAP.md`) tem o índice exato de linhas de cada função/constante e o marcador de `COMUNICADO_RASCUNHOS_SEED` em `painel.html`.
2. **Nunca aplique dezenas de `replace_file_content` sequenciais em arquivos espelhados (`kanban.html`, `okr.html`, `oceano.html`, `escala.html`, `intake.html`, `mare-*.js`):**
   - Cada `replace_file_content` em um arquivo de 2,5 MB leva ~12–15s. Fazer 12 chamadas sequenciais desperdiça ~3 minutos.
   - Em vez disso, use o script **`node .claude/skills/subirproprod/promover.js`** dentro do `run_command` único final (ou a rota cirúrgica guiada por `CODE_MAP_FAST.md` quando for apenas 1 hunk pequeno ou edição em `painel.html`). O `promover.js` roda `git diff --no-index -U0`, promove 100% dos hunks de feature/versão, preserva 100% das linhas permanentes de ambiente de prod (`VERSION_KEY`, `FB_OVERRIDE_NS`, `favicon.png`, `oceano.webmanifest`, `fb_*`, `force_logout_after`), atualiza `version.json` e valida a sintaxe de todas as tags `<script>` via `vm.Script` em **menos de 0,2 segundo**.

---

## Passo 1 — Diagnóstico Instantâneo em 1 Único Turno Paralelo (Zero Terminal)

**Regra de ouro (2026-10-17): a skill confere TODAS as páginas e módulos, não só o que o texto do CHANGELOG lembra.** Dois pedaços já foram esquecidos por olhar só a lista de "(SÓ DEV)" ou só um arquivo (o `painel` ficou para trás numa promoção em que só o `kanban` foi). Por isso o diagnóstico começa SEMPRE por:

```
node .claude/skills/subirproprod/promover.js --status
```
Ele lista **os 11 pares** — `kanban`, `okr`, `oceano`, `escala`, `intake`, `painel` e os módulos `mare-notif`, `mare-dicas`, `mare-metas`, `mare-login`, `mare-plantao` — como EM DIA ou PENDENTE (o `painel` é comparado pelo conteúdo real, por merge de 3 vias, não só pela versão) e termina com uma linha de **cobertura**: se algum arquivo `-dev` novo aparecer na raiz sem alvo no `promover.js`, ele avisa (⚠) — nesse caso, acrescente o par em `TARGETS` antes de seguir. **Só diga "prod em dia" se o `--status` mostrar tudo EM DIA e a linha de cobertura estiver ✔.** Páginas sem par `-dev` (`okr-apresentacao.slide.html`, `guia-okr.html`, `ecossistema.html`, `maredigital.html`, `onboarding*.html`…) entram no ar no merge e não se promovem. Se o lote promovido incluir só alguns pares, **diga na resposta quais ficaram de fora e por quê** (ex.: "painel v5.80 sem validação").

No **primeiro turno** (depois do `--status`), faça chamadas `view_file` **em paralelo**:

1. `version.json` (inteiro) → mostra imediatamente quais chaves `-dev` estão à frente das chaves de prod (`kanban_dev` vs `kanban`, `okr_dev` vs `okr`, `oceano_dev` vs `oceano`, `escala_dev` vs `escala`, `intake_dev` vs `intake`, `painel_dev` vs `painel`).
2. `CHANGELOG.md` (`StartLine: 1, EndLine: 90`) e `BUGS_E_CORRECOES.md` (`StartLine: 1, EndLine: 120`) → listam todas as seções marcadas com **`(SÓ DEV)`** ainda não promovidas, com os nomes exatos das funções/constantes mexidas.
3. `CODE_MAP_FAST.md` (inteiro, ~90 linhas) → dá as linhas exatas das seções e âncoras de cada arquivo (incluindo `painel.html`).

> **Pare se:** todas as chaves de `version.json` já estiverem empatadas entre dev e prod e não houver nenhum `(SÓ DEV)` no `CHANGELOG.md` ou `BUGS_E_CORRECOES.md` — avise o usuário que prod já está em dia.

---

## Passo 2 — Edições de Metadados, Rascunho do Mural e `painel.html`

Com o diagnóstico do Passo 1 em mãos, prepare as edições de texto usando `replace_file_content`:

### 2.1. `CHANGELOG.md` e `BUGS_E_CORRECOES.md`
- Nas entradas do topo que estavam marcadas como **`(SÓ DEV)`**, troque por **`(PROD)`** e atualize o cabeçalho com a versão de produção correspondente (ex.: `kanban v8.30.XXX`), mantendo o texto voltado ao usuário em `CHANGELOG.md` e o detalhamento técnico em `BUGS_E_CORRECOES.md`.

### 2.2. `CODE_MAP.md` / `CODE_MAP_FAST.md`
- O comando `node scripts/mare-cli.js map` no Passo 3 revalida automaticamente todos os números de linha (`Lxxxx`) do `CODE_MAP.md` e regenera o `CODE_MAP_FAST.md`. Se uma função importante nova nasceu no lote, adicione apenas a linha dela no `CODE_MAP.md`.

### 2.3. Rascunho do Mural em `painel.html` (`COMUNICADO_RASCUNHOS_SEED`)
- Use a linha de `COMUNICADO_RASCUNHOS_SEED` indicada no `CODE_MAP.md` (seção `painel.html` → *Comunicados + Rascunhos do Mural*), leia ~35 linhas ao redor com `view_file` e insira o rascunho da promoção no topo do array `COMUNICADO_RASCUNHOS_SEED` em `painel.html` (e `painel-dev.html` se quiser manter em paridade):
  - `id`: `'seed-v8-30-XXX-...'` (slug único — a função `seedComunicadoRascunhos()` grava em `kanban/painel/comunicados_rascunhos/{id}` apenas se ainda não existir).
  - `titulo`: curto, sem número de versão nem jargão técnico, até 120 caracteres.
  - `mensagem`: resumo amigável em português claro, bullets `•`, sem nomes de funções/arquivos.
  - **Regra de público separado (Maré vs. Radar):**
    - Se a promoção tiver mudanças visíveis **só no Maré Digital** → 1 rascunho no Mural + 1 texto de WhatsApp.
    - Se tiver mudanças visíveis **no Maré Digital E no Radar (`okr.html`)** → separe em **2 rascunhos no Mural e 2 blocos de WhatsApp** (um focado em quem usa o Maré no dia a dia das squads e outro focado em líderes/gestores que acompanham OKRs no Radar).

### 2.4. `painel-dev.html` → `painel.html` (agora automático, por merge de 3 vias)
- O par diverge de propósito (~55 linhas de instrumentação de debug só no `-dev`), por isso o `promover.js` não copia o arquivo: ele pega o `painel-dev.html` **do commit da última promoção do painel** (o que já está em prod) como base e aplica em `painel.html` só o que mudou no dev desde então (`git merge-file`). A linha de versão é neutralizada antes e reescrita depois (`vX · painel`).
- `node .claude/skills/subirproprod/promover.js painel` promove; se houver **conflito**, ele não grava nada e avisa — aí resolva à mão (`git merge-file`) e rode de novo. `--status` mostra "PENDENTE (merge de 3 vias limpo)" ou "com N CONFLITO(S)".
- Depois de promover, confira o diff de `painel.html` (`git diff painel.html`): deve ser exatamente o que o `CHANGELOG.md`/`BUGS_E_CORRECOES.md` marca como "(SÓ DEV)" do painel.

### 2.5. Rota cirúrgica opcional para `kanban.html` / `okr.html` (quando quiser editar direto via `CODE_MAP.md`)
- Se a promoção tiver apenas 1 ou 2 hunks pequenos e você quiser inspecioná-los antes, consulte a âncora da função no `CODE_MAP.md`, faça `view_file` paralelo na mesma linha em `kanban-dev.html` e `kanban.html` (as linhas são quase idênticas, diferença máxima de 0 a 2 linhas) e veja o código exato na hora.
- Na hora de aplicar a promoção completa de `kanban`, `okr`, `oceano`, `escala`, `intake` e `mare-*.js`, deixe o **`promover.js`** fazer a sincronização automática no Passo 3 — é instantâneo e à prova de esquecer hunks ou contaminar linhas de ambiente.

---

## Passo 3 — Execução Única Encadeada (`1 único run_command`)

Concluídas as edições de `CHANGELOG.md`, `CODE_MAP.md` e `painel.html` (`COMUNICADO_RASCUNHOS_SEED`), execute **uma única chamada `run_command`** que:
1. Roda `node .claude/skills/subirproprod/promover.js` para sincronizar todos os pares espelhados (`kanban`, `okr`, `oceano`, `escala`, `intake`, `painel` — por merge de 3 vias —, `mare-notif`, `mare-dicas`, `mare-metas`, `mare-login`, `mare-plantao`), atualizar `version.json`, preservar 100% das linhas permanentes de prod e validar a sintaxe JS de todos os `<script>` via `vm.Script`.
2. Regenera o conhecimento do Agente Ágil (`npm --prefix functions run conhecimento`) e roda o teste de frescor (`node --test functions/agente-agil-orquestrador/conhecimento.test.js`), pois o conhecimento lê `HELP_CONTENT` de `kanban.html`, a Ajuda de `okr.html`, o FAQ de `oceano.html` e o `CHANGELOG.md` de produção.
3. Cria a branch a partir de `origin/main` (ou atualiza a branch de promoção caso já exista uma aberta), faz commit, push e abre a PR no GitHub.

```powershell
$env:GH_TOKEN = ("protocol=https`nhost=github.com`n" | git credential fill | Select-String '^password=(.+)$').Matches[0].Groups[1].Value; node .claude/skills/subirproprod/promover.js && npm --prefix functions run conhecimento && node --test functions/agente-agil-orquestrador/conhecimento.test.js && git fetch origin && git checkout -b chore/promocao-prod-vX.Y.Z origin/main && git add -A && git commit -m "Promove vX.Y.Z pra prod" && git push -u origin chore/promocao-prod-vX.Y.Z && gh pr create --title "Promove vX.Y.Z pra prod" --body "Promove o lote validado em dev para produção."
```

> **Opções úteis do `promover.js`:**
> - `node .claude/skills/subirproprod/promover.js` → promove todos os pares sincronizados que estão com `-dev` à frente de `prod`.
> - `node .claude/skills/subirproprod/promover.js kanban okr` → promove apenas os alvos listados.
> - `node .claude/skills/subirproprod/promover.js --status` → exibe o diagnóstico de **todos** os pares (hunks pendentes, conflitos do painel, cobertura de arquivos `-dev`) sem modificar arquivos.

> **Importante (`AGENTS.md`):**
> - **NUNCA faça merge da PR por conta própria** (`gh pr merge` é proibido). Entregue o link da PR para o usuário aprovar e clicar em Merge no GitHub.
> - Se a promoção tocar em `database.rules.json`, `functions/` ou regenerar `functions/agente-agil-orquestrador/conhecimento/*.json`, avise o usuário quais comandos `firebase deploy` ele precisará rodar na máquina dele **depois** de aprovar o merge da PR (sempre incluindo o `git fetch origin main && git reset --hard origin/main` antes).

---

## Passo 4 — Avisos (Mural + WhatsApp) na Resposta ao Usuário

Sempre entregue na resposta final:

1. **Rascunho do Mural:** confirme que já foi pré-carregado automaticamente em `COMUNICADO_RASCUNHOS_SEED` no `painel.html` (basta abrir **Painel → 👥 Pessoas → 📢 Comunicados → 📝 Rascunhos → Usar** depois do merge).
2. **Texto pronto para WhatsApp** (em bloco copiável, com formatação `*negrito*` nativa do WhatsApp):
   - Linguagem simples, direta, focada no benefício prático para quem usa a ferramenta.
   - Nunca inclua número de versão (`v8.30...`), número de PR (`#1432`), nomes de variáveis/funções ou caminhos do banco.
   - Se a promoção cobrir **Maré Digital** e **Radar**, entregue **2 blocos separados** (*Mensagem 1 — Maré Digital* e *Mensagem 2 — Radar / OKRs*).

---

## Passo 5 — Log da Promoção no Card do Firebase (`squads/dados/cards/...`)

Entregue na resposta um snippet de console (F12 na aba do `kanban.html` logado) que registra a promoção como comentário no card correto da squad **`dados`**:

- **`c1785199972010_nd0`** (*"Implementação Agente Ágil"*) — se o lote for sobre o Agente Ágil.
- **`c1783541085140`** (*"Melhorias Maré Digital"*) — para todas as demais melhorias do ecossistema Oceano/Maré/Radar/Painel/Escala/Intake.
- Se o lote tiver entregas dos dois temas, o mesmo script pode gravar em cada card a sua parte.

### Regras obrigatórias do snippet de console (ou acione o subagente `agente-logs-testes`):
1. **Caminho REAL pós-Fase 1.1:** `kanban/squads/dados/dados/card_comments/${CARD_ID}/${id}` (a Cloud Function `contarComentarios` atualiza `card_comments_count` automaticamente). Nunca grave no legado `kanban/squads/dados/cards/${CARD_ID}/comments` nem em `kanban/comments/${CARD_ID}`.
2. **`ts: new Date().toISOString()` (STRING ISO) — NUNCA `Date.now()`:** `loadComments()` ordena com `a.ts.localeCompare(b.ts)`; se `ts` for número, quebra silenciosamente todos os comentários do card.
3. **Reutilize `window._db`, `window._ref` e `window._set` já autenticados na página** — nunca faça `import('https://www.gstatic.com/firebasejs/10.12.0/...')` (a página usa Firebase `10.14.1` local em `./vendor/firebase-10.14.1/` por causa do FortiGate SSL).

```js
// Cole no console (F12) do kanban.html logado:
(async () => {
  if (!window._db || !window._ref || !window._set) {
    console.error('❌ Abra este script no console do kanban.html já logado.');
    return;
  }
  const CARD_ID = 'c1783541085140'; // ou 'c1785199972010_nd0' para Agente Ágil
  const id = 'c' + Date.now() + '_' + Math.random().toString(36).slice(2, 5);
  await window._set(window._ref(window._db, `kanban/squads/dados/dados/card_comments/${CARD_ID}/${id}`), {
    id,
    uid: (window._currentUser && window._currentUser.uid) || 'caio',
    author: (window._currentUser && (window._currentUser.displayName || window._currentUser.email)) || 'Caio Soares',
    init: window._currentUserInit || 'CS',
    ts: new Date().toISOString(), // SEMPRE ISO string!
    text: `🚀 Promoção pra prod — v8.30.XXX (PR #NNNN)\n\n• ...`
  });
  console.log('✅ Log registrado no card', CARD_ID, id);
})();
```
