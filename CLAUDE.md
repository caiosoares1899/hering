# CLAUDE.md

Guia para o Claude Code neste repositório. É a **fonte única das regras do projeto** (`AGENTS.md` e `.agents/rules/` só acrescentam o que é do Antigravity e do Codex). Mantenha enxuto: detalhe por arquivo vive em `docs/BIBLIOTECA.md` (§6) e em `.claude/rules/*.md`.

## O que é este repo

Ferramentas internas da Hering, publicadas como páginas estáticas no GitHub Pages (https://caiosoares1899.github.io/hering/). Sem build, sem bundler, sem npm na raiz — cada `.html` é uma página autocontida (`<style>` e `<script type="module">` inline, sem imports entre páginas). O único projeto Node é `functions/` (Cloud Functions do Firebase).

O centro é a família **Oceano**: **Maré Digital** (kanban), **Painel**, **Radar** (= o OKR, `okr.html`), **A Bordo** (onboarding), **Travessia**, Escala, Intake e o Mini painel, sobre Firebase Realtime Database + Auth (Google) + Cloud Messaging. Só os **nomes visíveis** mudam; arquivos, URLs e caminhos do banco ficam. "OKR" segue como metodologia, papel e selo dos cards; texto novo que cite a página do OKR diz "Radar". Regras e fases em `docs/OCEANO.md` — **leia antes de renomear qualquer texto**.

Modo "só Hering" (login só Google `@ciahering.com.br`, uma torre, @menção só Hering): nada foi apagado, está atrás de `MARE_SO_HERING`. **Antes de mexer em login, torres, domínios ou regras, leia `docs/arezzo/MARE_SO_HERING.md`.**

## Comandos

Não há lint/test/build na raiz: edita-se o HTML e valida-se no navegador. Checagens: `node scripts/checar.js` (a CI roda) e `cd functions && npm test`. As páginas publicam sozinhas a cada push na `main` (`.github/workflows/pages.yml`).

### Deploy de `functions/` e do banco — é do Caio, na máquina dele, e sempre com resync antes

- Os agentes **nunca rodam `firebase deploy`** (sem credencial no sandbox): acrescentam a linha em "Pendente de deploy" de `docs/COORDENACAO_AGENTES.md`.
- **Sempre que for entregar um `firebase deploy`/`secrets:set`, entregue antes o resync** — o clone dele não se atualiza: `cd /d "C:\Users\caio.soares\.gemini\antigravity\scratch\hering"` → `git fetch origin <branch>` → `git reset --hard origin/<branch>`. Sem isso o deploy falha com `No function matches the filter`.
- Deploy de função é sempre `firebase deploy --only functions:<nome>`, nunca `--only functions` puro. Regras do banco: `firebase deploy --only database` (regras primeiro).
- MacBook do Caio: clone em `~/hering`, com Claude Code próprio — antes de qualquer pedido, `cd ~/hering && git pull`. Detalhes (caminhos, Mac, push, backup, conhecimento do Agente Ágil) em `.claude/rules/functions-e-banco.md`, que carrega ao tocar em `functions/**` ou `database.rules.json`.

## Onde está cada coisa

- `docs/BIBLIOTECA.md` — **o bibliotecário**: onde mora cada arquivo e por quê (URL do Pages = nome do arquivo). **Arquivo novo na raiz = linha nela** (`checar.js` falha se faltar); screenshots/saídas de teste vão para `docs/capturas/`. A §6 tem o catálogo detalhado dos arquivos-chave (módulos `mare-*`, Service Worker, `functions/index.js`, ecossistema…).
- `docs/MAPA_DO_REPOSITORIO.md` — diagramas páginas → módulos → Firebase → functions. O bloco "O que o código diz" é gerado: mudou módulo de uma página, função exportada ou nó do banco → `node scripts/mapa.js` e commite (a CI reprova se estiver velho).
- `docs/COORDENACAO_AGENTES.md` — como Claude, Antigravity e Codex dividem o repo, convenções e o **Quadro** (em andamento / escalado / pendente de deploy). **Você, Claude, é o maestro dos três (§7):** divide, delega por contrato (`codex exec`, `agy -p`) e revisa os PRs com o Caio — Codex é só autor. **Leia antes de qualquer tarefa.** A revisão automática das PRs do Antigravity está **⏸ pausada** (§4.1): se houver PR `antigravity/*` aberta sem comentário de revisão, revise à mão.
- `CODE_MAP_FAST.md` (gerado: `node scripts/mare-cli.js map`) e `CODE_MAP.md` (curado por área) — índices de funções/âncoras. Consulte **antes** de explorar; re-`grep` o nome, pois os números de linha envelhecem.
- `BUGS_E_CORRECOES.md` — bugs, correções, achados do `/monitorarbugs` e a seção `🛡️ Armadilhas Conhecidas & Regras de Ouro` (**leia antes de mexer em queries do Firebase, auth ou comentários**). `CHANGELOG.md` — só features e entregas estruturais.
- `scripts/mare-cli.js` (`status`/`bump`/`log --type feature|bug`/`map`) e `.claude/skills/subirproprod/promover.js` (promoção dev → prod, `--status` lista pendências).
- Segurança: `docs/SEGURANCA_FRONTEIRAS.md` (método por fronteira de confiança, 3 veredictos, severidade) e a skill `/auditoriaseguranca`; o que já foi achado e fechado está em `docs/AUDITORIA_SEGURANCA_2026-10-18.md`.
- Guias: `docs/GUIA_DE_CODIGO.md` (como codar sem cair nas armadilhas), `docs/GUIA_UI_UX.md` + `/melhoriauiux` e `MARINE_GLASS.md` (identidade) — **leia antes de desenhar ou alterar uma tela**.
- Outros: `docs/ASSISTENTE_FERIAS.md` (Assistente Férias + Plantão, desativado em 03/11/2026, guardado), `docs/CALENDARIO_GESTAO.md`, `docs/MINIPAINEL.md`, `ecossistema.html` (mantido por `/atualizardocumentacoes`; histórico das rodadas em `docs/HISTORICO_DOCUMENTACAO.md`).

## Regras por área (carregam sozinhas ao tocar nos arquivos)

Ficam em `.claude/rules/*.md`, cada uma com `paths:`. **Antigravity: leia o arquivo da área antes de editar** (o `AGENTS.md` aponta para cá).
- `radar-okr.md` — Radar: `okr*.html`, `guia-okr.html`, `functions/okr/**`, `docs/CALENDARIO_GESTAO.md`.
- `oceano-login-escala.md` — Oceano, `mare-login`, Escala/Intake/Travessia, Mini painel (`mac/`, `windows/`), `functions/oceano/**`.
- `functions-e-banco.md` — `functions/**` e `database.rules.json`.

Regras que valem **fora de qualquer arquivo** (resync, release dev→prod, tags, avisos, dica) ficam aqui — uma regra por caminho não carrega quando você só entrega um comando.

## Arquitetura (resumo)

- **Firebase sem build:** as páginas importam o SDK do CDN `gstatic.com` num `<script type="module">`; `firebaseConfig` inline, sobrescrevível por `localStorage` (como as páginas `-dev` apontam para outro projeto sem mudar código).
- **Dados** sob `kanban/` (`usuarios/{uid}`, `squads/{id}/...`, `painel`, `config`, `global`…); nós com irmão `_dev` evitam tocar a produção nas páginas `-dev`. Regras exigem e-mail `@ciahering.com.br` e checam squad por `kanban/usuarios/{uid}/squads/{id}`.
- **Módulos compartilhados** (`mare-notif`, `mare-dicas`, `mare-metas`, `mare-login`, `mare-sonar`; únicos arquivos carregados por mais de uma página) seguem o ciclo dev→prod com `?v=N` nas páginas: **ao mudar o módulo, bump o `?v=` em todas as páginas que o carregam** e promova módulo + páginas juntos. Detalhes de cada um em `docs/BIBLIOTECA.md` §6. Atalhos: **dica nova = 1 linha no `CATALOGO` de `mare-dicas-dev.js`**; **tipo de notificação novo = 1 entrada em `MareNotif.TIPOS`** (e em `PUSH_TYPES` se for push — ver a regra de `functions/`).
- **Auto-atualização:** cada página versionada consulta `version.json` (`cache: 'no-store'`) e, se o valor da sua `VERSION_KEY` mudou, bloqueia a tela com "atualizar agora". **Mudou página versionada → bump da chave em `version.json` e do `<div class="version">…</div>`** (`node scripts/mare-cli.js bump`).
- **Arquivos grandes** (centenas de KB): nunca leia a página inteira — `CODE_MAP_FAST.md` → `grep` → `Read` com offset, lendo a função alvo inteira.
- `kanban.html` e `kanban-dev.html` evoluem em sincronia deliberada; `painel.html` e `painel-dev.html` **divergem** (debug, banner dev) — `diff` antes de supor que a mudança vale nos dois. `firebase-messaging-sw.js` **fica na raiz** (cache offline + push com a aba fechada).

## Economia de tokens e higiene de sessão

- **Resposta curta, sem repetição:** vá direto ao diagnóstico e ao diff; não repita regra do `CLAUDE.md` nem decisão já fechada na sessão.
- **Busca cirúrgica, mas função inteira:** `CODE_MAP_FAST.md` → `grep -na` → leia a função alvo **de ponta a ponta** e todos os escritores do mesmo nó antes de editar (`docs/GUIA_DE_CODIGO.md` §2). Subagente só para área grande ou vários arquivos (§6); bug pequeno, faça direto.
- **Consulte o advisor (`/advisor opus`) em 3 momentos:** antes de fechar um plano não trivial; depois que o mesmo erro/teste falhar 2 vezes seguidas; e antes de dar por concluída qualquer tarefa em `functions/` ou nas regras do banco.
- **Pedido com 2+ partes independentes ou > ~1 h: divida e delegue antes de começar** (`docs/COORDENACAO_AGENTES.md` §7.7); correção e redesenho viram PRs separados. **Antes de abrir PR rode a bateria da CI inteira:** `checar.js` **e** `cd functions && npm test` se tocou CHANGELOG/Ajuda/páginas (Armadilhas 15–16 em `BUGS_E_CORRECOES.md`).
- **Mudou de assunto = contexto novo:** ao fechar um PR ou trocar de produto, sugira `/compact` ou sessão nova (começando por `/seatualizar`).

## Release process

Deploy é automático a cada push na `main` e não há gate de staging; isto faz o papel dele para toda página versionada (`kanban`, `painel`, `okr`, `oceano`, `escala`, `intake` e os pares `-dev`):

1. **Dev primeiro.** A mudança entra só no `-dev`; bump da chave em `version.json` **e** do `<div class="version">` da página; PR; merge (o Pages só publica o que chega à `main`).
2. **Espere a validação explícita** de quem pediu antes de tocar no prod. Nada de promover por achar que "parece certo".
3. **Promova** (`/subirproprod`, `promover.js`): o `diff` -dev × prod deve ser exatamente as correções acumuladas + a linha de versão/`VERSION_KEY`; restaure a versão/`VERSION_KEY` do prod (não leve a do `-dev`), bump da chave de prod, PR, merge.
4. **Tag** anotada no commit de merge, e `git push origin <tag>`: `kanban-vX.Y.Z` / `kanban_dev-vX.Y.Z-dev`, `painel-vX.Y` / `painel_dev-vX.Y-dev`.
5. **Registre — o split é obrigatório.** `CHANGELOG.md`: só features/entregas estruturais (`mare-cli.js log --type feature`), com o nº do PR. `BUGS_E_CORRECOES.md`: bugs, correções, regressões, achados do `/monitorarbugs` (`log --type bug`); mantenha as Armadilhas em dia. Skill que resume "o que mudou" lê **os dois**. Todo commit leva o trailer `Agent: claude`, `Agent: antigravity` ou `Agent: codex`; branches `<agente>/<assunto>`; **ninguém dá merge no próprio PR**.
6. **Avisos + log no card (regra fixa, a cada promoção do `kanban.html` de prod).** (a) Rascunhe o post do Mural (script de console no `painel.html` ou `COMUNICADO_RASCUNHOS_SEED`) e um texto de WhatsApp, em linguagem de usuário; (b) registre o lote como comentário no card certo, por script de console (squad `dados`): **`c1785199972010_nd0`** ("Implementação Agente Ágil") para tudo do Agente Ágil (`functions/agente-agil*/`, ferramentas do agente no kanban); **`c1783541085140`** ("Melhorias Maré Digital") para o resto. **Use sempre `ts: new Date().toISOString()`, nunca `Date.now()`** — `loadComments()` ordena com `a.ts.localeCompare(b.ts)`, que lança se `ts` não for string e quebra a lista de comentários inteira do card.
7. **Avaliar uma dica (regra permanente, 09/10/2026).** Toda coisa **nova e visível** em Radar, Maré ou Oceano: avalie se vale um mini popup e **diga na resposta** ("dica: sim, X" / "dica: não, porque Y"). Vale para atalho/recurso que a pessoa não descobre sozinha e que poupa tempo; não vale para bug, mudança interna ou o que já é óbvio. Uma frase, com "Saiba mais" se houver tópico na Ajuda (que também deve estar em dia — `/atualizarhelpcontent`). Implementar = linha no `CATALOGO` + entrada no `CHANGELOG.md`.
8. **Fronteira (regra permanente, 05/11/2026).** Toda mudança que **cria ou altera uma fronteira de confiança** — função `onRequest`/`onCall` nova, ferramenta do Agente Ágil, nó ou regra do banco, backup/restauração, iframe/`postMessage`, ou um **sink novo** (`innerHTML`/`href`/`window.open`) ou **campo novo** chegando ao DOM com texto escrito por outra pessoa, por externo, por anônimo ou pelo LLM — passa pelo checklist de `docs/SEGURANCA_FRONTEIRAS.md` e **a resposta diz o resultado** ("fronteira: sem mudança" ou "fronteira: X checado, Y exige validação do Caio"). Não vale para mudança que não toca em quem-pode-o-quê (texto, estilo, layout, ajuste de sink/campo já existente); não escreva "sem mudança" por reflexo — se não conferiu, não diga.

Sem par `-dev` (`firebase-messaging-sw.js`, `database.rules.json`, `functions/`): pulam o dev-first (são compartilhados ou têm deploy próprio), mas **tag e log valem** (ver `agente-agil-v1a` no `CHANGELOG.md`).

### Cadência de promoção do prod: bug agora, feature em lote

**Bug validado sobe na hora; feature sobe em lote, 1× por dia, no fim do dia** (exceção só ad hoc, ex.: algo urgente). Cada bump de prod força toda aba aberta a recarregar em até 5 min (`CHECK_INTERVAL_MS`) e re-anexar todos os listeners do Firebase; 13 promoções em ~40 h (04–05/08) foram os dois dias de maior banda medidos. O porquê completo está em `docs/BIBLIOTECA.md` §6.
