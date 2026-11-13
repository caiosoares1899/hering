# 📚 Biblioteca do repositório — onde está cada coisa

> O "bibliotecário" do `hering`: se você não sabe onde algo mora, comece aqui.
> **Regra de manutenção:** arquivo novo na **raiz** precisa ser citado neste documento — `node scripts/checar.js` falha (e a CI também) se aparecer na raiz um arquivo que a Biblioteca não menciona. Pasta nova ou arquivo movido → atualize aqui no mesmo PR.

## Por que tanta coisa na raiz?

O site é publicado **inteiro, da raiz**, pelo GitHub Pages (`.github/workflows/pages.yml`, `path: .`) e **não há build**. Isso fixa três coisas:

1. **A URL de cada página é o nome do arquivo** (`…/hering/kanban.html`). Mover uma página quebra links já compartilhados, atalhos da tela inicial, PWAs instalados e o menu de produtos. Por isso as páginas **ficam na raiz**.
2. As páginas apontam para imagens/sons/módulos por **caminho relativo** (`favicon.png`, `mare-notif.js?v=N`…), e mover esses arquivos mexeria nas páginas de **produção** (precisaria de bump de versão e recarga para todo mundo). Por isso eles **ficam na raiz também** — só estão agrupados e explicados abaixo.
3. `firebase-messaging-sw.js` **precisa** estar na raiz do domínio (escopo do Service Worker).

Tudo que **não** é servido ao usuário (documentação, testes, capturas, scripts, funções) mora em pasta.

---

## 1. Páginas (raiz) — a URL é o nome do arquivo

### Produtos Oceano (cada um tem par `-dev`; o `-dev` recebe a mudança primeiro)
| Produto | Prod | Dev | Para quê |
|---|---|---|---|
| 🌊 **Maré Digital** (kanban das squads) | `kanban.html` | `kanban-dev.html` | O board: cards, automações, Agente Ágil, metas, calendário |
| 🧭 **Painel** (ADM / gestão) | `painel.html` | `painel-dev.html` | Pessoas, comunicados, notificações, backup, OKR, plantão (⚠️ os dois **divergem** de propósito) |
| 📡 **Radar** (OKR) | `okr.html` | `okr-dev.html` | Objetivos, marcos, calendário, reunião ao vivo |
| 🏝️ **Oceano** (lobby / mural / host) | `oceano.html` | `oceano-dev.html` | Boas-vindas, Mural, login único, plantão de bugs, host dos produtos |
| 🗓️ **Escala** | `escala.html` | `escala-dev.html` | Trabalho / plantão / folga por dia |
| 📝 **Pedido (Intake)** | `intake.html` | `intake-dev.html` | Formulário de pedidos para as squads |
| 🛟 **A Bordo** (onboarding) | `onboarding.html` | — | Onboarding ágil |
| ⛵ **Travessia** (pessoas / 1:1 / avaliação) | em produção desde 31/10/2026 (entrada discreta: o card do Oceano segue "em breve") | `travessia.html` ↔ `travessia-dev.html` (sem versão própria; alvo `travessia` do `promover.js`) | Fase 1: Baú, faróis, humor, mural de Estrelas, avaliação com indicação de pares e trava de devolutiva (desenho em `docs/ideias/travessia-2026-10-22.md`; protótipo antigo em `docs/demo/travessia-prototipo-fase0.html`) |

Sem par dev: `okr-apresentacao.slide.html` (apresentação do Radar) · `guia-okr.html` (guia do Radar, 14 MB — prints embutidos) · `guia-mare.html` (guia do Maré: programa de boas-vindas, com as **telas reais** do board capturadas por `scripts/guia-mare-telas.js` — rode de novo quando o visual do Maré mudar).

### Documentação técnica navegável
`ecossistema.html` (Ecossistema de gestão — para a TI) · `maredigital.html` (documentação técnica do Maré Digital).

### Painel em miniatura
`minipainel.html` (Mini painel do Caio: saúde do ecossistema e os cards dele, lido da função `oceanoResumo`; `?demo=1` mostra dados de exemplo — runbook em `docs/MINIPAINEL.md`).

### Ferramentas e apresentações avulsas (não dependem do Maré; só links entre si)
| Arquivo | O que é |
|---|---|
| `ai-slide.html` · `ai-txt.html` | "IA no Digital Hering" (slides e plano de implementação) |
| `capacitacao.html` | Plano de capacitação — responsável por IA no Digital |
| `apresentacao.html` · `controle.html` | Cronômetro da "Conexão Digital" e o controle dele |
| `apresentacao.criativa.html` | Apresentação do Maré Digital (2,5 MB) |
| `resumo.slide.html` | Slides da reunião gerencial |
| `onboarding.slide.html` | Slides do onboarding |

## 2. Módulos compartilhados (raiz — carregados por mais de uma página)
Todos têm par `-dev`/prod e são chamados com `?v=N` (ao mudar o módulo, **bump o `?v=` em todas as páginas que o carregam**).

| Módulo | Faz | Usado por |
|---|---|---|
| `mare-notif(-dev).js` | **Sino único** (feed da torre), menu de produtos ⋮⋮⋮, catálogo `TIPOS` de notificações | kanban, painel, okr, oceano |
| `mare-dicas(-dev).js` | 💡 Dicas (mini popups) e `CATALOGO` | kanban, okr, oceano |
| `mare-metas(-dev).js` | 🐟 Metas e desafios ("O mar tá pra peixe") | kanban, painel |
| `mare-timer(-dev).js` | ⏲ Timer: contas e gravação de play/pausa/encerrar (o Maré e, depois, a Ilha Dinâmica usam as mesmas funções) | kanban |
| `mare-gxl(-dev).js` | 📊 Calendários do Gantt: leitor de .xlsx (sem biblioteca), prévia, publicação com histórico e restauração — carregado só quando alguém atualiza um calendário | kanban (sob demanda), painel |
| `mare-gcal(-dev).js` | 📊 Calendários do Gantt: **fonte única** da configuração (abas, nomes, grupos do filtro, cores) + visualizador só leitura da régua de 6 semanas; v2: a aba virtual 🧭 Digital · dia a dia e `doDia()` | kanban (lê a configuração), okr/Radar (Calendário → 📊 Gantt, sob demanda) |
| `mare-sonar(-dev).js` | 🔍 Sonar: a busca do Oceano (Ctrl/⌘+K), um layout para todas as páginas | oceano, kanban, okr |
| `mare-login(-dev).js` | Login Google direto (iPhone/iPad) | oceano, kanban (+ escala/intake via Oceano) |
| `mare-plantao(-dev).js` | 🐛 Plantão de Bugs (relato, validação) | oceano, painel |
| `firebase-messaging-sw.js` | Service Worker (cache offline + push) — **só existe um, na raiz** | todas |
| `version.json` | Versão de cada página (auto-atualização, polling a cada 5 min) | todas |

## 3. Imagens, sons e manifestos (raiz — referenciados por nome pelas páginas)
| Arquivo | Uso |
|---|---|
| `favicon.png` | Ícone do **Maré Digital** (prod) |
| `favicon-dev.png` · `favicon-monochrome.png` · `favicon-dev-monochrome.png` | Maré em dev / versões monocromáticas |
| `favicon-vice.png` | Tema Vice City do Maré |
| `favicon-painel-v2.png` · `favicon-painel-v2-dev.png` | Painel (prod / dev) |
| `favicon-radar.png` · `radar-logo.png` | Radar (ícone / logo da apresentação) |
| `favicon-oceano.png` · `oceano-logo.png` · `oceano-icon-192.png` · `oceano-icon-512.png` | Oceano (ícone, logo sem fundo, ícones do app) |
| `favicon-bordo-v2.png` · `qr-onboarding.png` | A Bordo (ícone / QR dos slides) |
| `marinheiro.png` | Ícone das **notificações push** (usado pelo Service Worker) |
| `buzina-navio.mp3` | Buzina do popup 🐟 das metas (`mare-metas`) |
| `oceano.webmanifest` · `oceano-dev.webmanifest` | Manifesto do app Oceano (PWA) |

## 4. Documentação, rastros e configuração (raiz)
| Arquivo | O que é | Quem usa |
|---|---|---|
| `README.md` | Porta de entrada pública do repositório | todos |
| `CLAUDE.md` | **Fonte da verdade** das regras do projeto (release, dev→prod, deploy de `functions/`) | Claude e Antigravity |
| `AGENTS.md` | Entrada de Codex e Antigravity: núcleo comum, seção do Codex e as linhas vermelhas | Codex, Antigravity |
| `CHANGELOG.md` | **Features** e entregas estruturais (histórico jul–set em `docs/changelog-archive-2026-07-a-09.md`) | `scripts/mare-cli.js log`, skills |
| `BUGS_E_CORRECOES.md` | Bugs, correções, achados do `/monitorarbugs` e 🛡️ Armadilhas Conhecidas | idem |
| `CODE_MAP.md` · `CODE_MAP_FAST.md` | Índice de âncoras por área (curado / gerado por `node scripts/mare-cli.js map`) | todos antes de mexer em código |
| `MARINE_GLASS.md` | Manual de marca/design "Marine Glass" | quem cria tela nova |
| `database.rules.json` | Regras do Realtime Database (espelho do console; `firebase deploy --only database`) | deploy do Caio |
| `storage.rules` · `storage-lifecycle.json` | Regras e ciclo de vida do Cloud Storage (backups) | deploy do Caio |
| `firebase.json` | Aponta `functions/`, regras do banco e do storage | Firebase CLI |
| `.gitignore` | Ignorados (`node_modules`, `.env`, `.mare-ship.json`…) | git |

## 5. Pastas
| Pasta | Conteúdo |
|---|---|
| `docs/` | Documentação de apoio — **todo guia novo vai aqui**. Índice abaixo |
| `docs/arezzo/` | Modo "só Hering" (`MARE_SO_HERING.md`, regras com Arezzo) e **`testes/`** — scripts Playwright com Firebase falso (`fakefb.js`); ver `testes/LEIAME.md` |
| `docs/capturas/` | Capturas de tela soltas geradas por testes antigos (não são usadas por nenhuma página) |
| `docs/imagens-antigas/` | Ícones que nenhuma página usa mais (versões antigas do Painel) |
| `docs/ideias/` · `docs/demo/` | Ideias guardadas para depois · scripts de demonstração |
| `functions/` | **Cloud Functions** (Node 22). `index.js` registra todas; cada subpasta é uma área (`agente-agil-orquestrador/`, `backup/`, `plantao/`, `okr/`, `metas/`, `spotify/`, `rules/` = testes das regras…). Único projeto Node do repo |
| `mac/` | **App do Mac** (barra de menu + widget, Swift/SwiftUI) do mini painel: lê a função `oceanoResumo`. Projeto gerado com XcodeGen (`project.yml`); a chave fica em `Local.xcconfig`, fora do Git. Passo a passo em `mac/README.md`. **Nunca foi compilado** (escrito sem Xcode). |
| `windows/` | **Ícone na bandeja do Windows** do mini painel (`oceano-bandeja.ps1` + `iniciar-oceano.cmd`): bolinha 🟢🟡🔴, menu com o resumo e aviso quando o estado piora. Roda pelo `cmd` (sem abrir o PowerShell); lê a chave de `%USERPROFILE%\chave-oceano.txt`. Passo a passo em `windows/README.md`. **Nunca rodou no Windows** (escrito sem ele). |
| `scripts/` | `checar.js` (checagens que a CI roda), `mare-cli.js` (`status`/`brief`/`daily`/`bump`/`log`/`map`/`symbols`/`slice`/`find`/`check-script`/`ship`), `mapa.js` (gera o bloco automático do mapa) e `delegar.sh` (o maestro entrega um contrato ao Codex em worktree próprio, em segundo plano) |
| `vendor/firebase-10.14.1/` | SDK do Firebase servido localmente (o FortiGate da Hering bloqueia o CDN) |
| `.claude/skills/` | Skills do Claude/Antigravity (`/subirproprod`, `/monitorarbugs`, `/seatualizar`, `/auditoriaseguranca`, `/plantaobug`…) |
| `.agents/` | Regras e lista de skills do Antigravity (`rules/antigravity.md` = o que era só dele no `AGENTS.md`) |
| `.github/workflows/` | `pages.yml` (publica a raiz no Pages) e `checks.yml` (CI: `checar.js` + testes de `functions/`) |

### Índice de `docs/`
| Documento | Assunto |
|---|---|
| `MAPA_DO_REPOSITORIO.md` | **O mapa**: como as peças se encaixam (diagramas), por pasta e as tabelas geradas do código (`scripts/mapa.js`) |
| `COORDENACAO_AGENTES.md` | **Regras** de como Claude, Codex e Antigravity dividem o repo: decisões D1–D3, modelos, roteamento por risco R0–R3, revisão cruzada, contrato de tarefa (v2) |
| `QUADRO.md` | **Estado do dia** dos agentes: em andamento (arquivos reservados), fila de contratos, escalado, pendente de deploy e backlog; detalhe das linhas longas em `quadro/` |
| `coordenacao-invocacoes.md` | Como acionar cada agente: canais e flags testados (`codex exec`, `codex review`, `agy -p`, worktrees) |
| `historico/` | O que saiu dos docs vivos sem ser apagado (ex.: `coordenacao-2026-10-a-11.md`, a coordenação de 16/10 a 11/11 com a auditoria e os ✅ de deploy) |
| `GUIA_DE_CODIGO.md` | Como escrever código e testes sem cair nas armadilhas conhecidas |
| `CODE_SYMBOLS.md` | Índice automático completo de linhas (`<style>`, `<script>`, `const`s e funções `fn:Lxxxx`) de todas as páginas `-dev` e módulos `mare-*-dev.js`, gerado por `node scripts/mare-cli.js map` |
| `OCEANO.md` | A família de produtos, nomes visíveis e fases |
| `PLANTAO_BUGS.md` | Plantão de Bugs: fluxo, regras e runbook |
| `HISTORICO_DOCUMENTACAO.md` | 📚 Histórico das rodadas de documentação (o que foi sincronizado em cada data) — saiu do `CLAUDE.md` em 04/11/2026 para não ser lido a cada sessão; a skill `/atualizardocumentacoes` é o procedimento |
| `CALENDARIO_GESTAO.md` | 📅 Calendário de gestão do Digital (Radar): o pedido do Rafael, decisões, Entrega/macro/Cadência, cobrança automática, subagente de agenda, limites, deploy, roteiro de validação e próximos passos |
| `ASSISTENTE_FERIAS.md` | 🏖️ Assistente Férias do Caio — **desativado em 03/11/2026, guardado para reuso**: interruptor, inventário das peças, checklist da volta e como religar |
| `MINIPAINEL.md` | Mini painel do Caio (`minipainel.html` + função `oceanoResumo`): peças, deploy, chave e limites |
| `changelog-archive-2026-07-a-09.md` | Histórico do CHANGELOG de jul–set/2026 |
| `ideias/camiseta-brasil-black-friday.md` | Ideia guardada para depois das férias |
| `ideias/dossie-concorrencia-2026-10.md` | Dossiê de concorrência do Antigravity, já triado — backlog pós-férias |
| `ideias/cronograma-oceano.html` | Cronograma visual do plano da consultoria (8 sprints, gates, prompts para copiar); publicado em `…/hering/docs/ideias/cronograma-oceano.html`. O que se marca nele fica só no navegador; o registro oficial é o card do squad dados |
| `ideias/consultoria-oceano-2026-11-09.md` | Consultoria de produto de Radar, Travessia e lobby (09/11/2026): 21 propostas, decisões do Caio, desenho das partes difíceis e o prompt-base do plano em sprints |
| `ideias/ilha-dinamica.md` | 🏝️ Ilha Dinâmica (10/11/2026): conceito, decisões do Caio, modos de exibição, fases (protótipo → `mare-timer` → ilha no Oceano), custo e fronteira |
| `demo/ilha-dinamica-prototipo.html` | Protótipo isolado da Ilha Dinâmica (dados fictícios, 3 temas, desktop/celular; teste `arezzo/testes/test_ilha_prototipo.js`) — não é carregado por nenhuma página publicada |
| `ideias/travessia-2026-10-22.md` | Desenho do Travessia (pessoas/PDI/1:1): concorrência, princípios, modelo de dados, fases, decisões do Caio e triagem do dossiê do Antigravity |
| `ideias/tema-claro-painel-radar-2026-10-17.md` | Auditoria do tema claro/Vice no Painel e no Radar + plano de correção (18/10) |
| `MIGRACAO_DOMINIO.md` | Internalização (30/10/2026): inventário de tudo que depende do endereço atual (código, CORS das funções, login Google, PWA, dados do navegador, links gravados) + checklist da virada |
| `SEGURANCA_FRONTEIRAS.md` | Método de segurança por fronteira de confiança (adaptado do `cloudflare/security-audit-skill`, MIT): regra de entrada, quem é quem, 4 mapas do Oceano, 3 veredictos, severidade, antipadrões — usado por `/auditoriaseguranca` e pela regra 8 do Release process |
| `AUDITORIA_SEGURANCA_2026-10-18.md` | Pente fino de segurança: achados, o que foi corrigido, riscos aceitos, o que o Caio vê no console do Google |
| `ideias/amanha-18-10-mapa-repo-e-push-antigravity.md` | Mapa do repositório, resumo no Ecossistema e push dos pedidos do Antigravity (18/10) |

---

## "Quero… onde mexo?"
| Quero | Vá em |
|---|---|
| Corrigir/alterar algo do board | `kanban-dev.html` (nunca direto o prod) → achar a função em `docs/CODE_SYMBOLS.md` / `CODE_MAP_FAST.md` |
| Notificação nova | `MareNotif.TIPOS` em `mare-notif-dev.js` (+ `PUSH_TYPES` em `functions/` se for push) |
| Dica nova | linha no `CATALOGO` de `mare-dicas-dev.js` |
| Subir dev → prod | skill `/subirproprod` (`.claude/skills/subirproprod/promover.js`) |
| Ver o que o outro agente está fazendo | `docs/QUADRO.md` |
| Medir o trabalho por agente | `node scripts/placar.js` |
| Registrar feature / bug | `node scripts/mare-cli.js log --type feature|bug` |
| Rodar as checagens da CI | `node scripts/checar.js` e `cd functions && npm test` |
| Testar uma tela no navegador | `docs/arezzo/testes/` (`fakefb.js` + Playwright) |
| Saber como o plantão de bugs funciona | `docs/PLANTAO_BUGS.md` |
| Religar (ou entender) o Assistente Férias numa próxima ausência | `docs/ASSISTENTE_FERIAS.md` |
| Regras por área (Radar/OKR; Oceano, login, Escala, Mini painel; `functions/` e banco) que o Claude Code carrega ao tocar nos arquivos | `.claude/rules/*.md` (apontadas pelo `CLAUDE.md` e pelo `AGENTS.md`) |
| Entender o calendário de gestão do Digital (Entrega, Cadência, cobrança, subagente de agenda) | `docs/CALENDARIO_GESTAO.md` |
| Criar tela nova no estilo da família | `MARINE_GLASS.md` |

---

## 6. Arquivos-chave em detalhe (movido do `CLAUDE.md` em 04/11/2026)

O `CLAUDE.md` guarda só o que vale em qualquer tarefa; o catálogo detalhado de cada arquivo/módulo mora aqui. As regras que só importam ao mexer em `functions/` e no banco estão em `.claude/rules/functions-e-banco.md`.

- `docs/BIBLIOTECA.md` (este arquivo) — **o "bibliotecário" do repo**: onde mora cada arquivo da raiz e de cada pasta, e por que as páginas/imagens/módulos ficam na raiz (URL do GitHub Pages = nome do arquivo). **Arquivo novo na raiz = linha nela** (`node scripts/checar.js` falha se faltar); screenshots/saídas de teste não vão pra raiz (`docs/capturas/`). Ao lado dele, `docs/MAPA_DO_REPOSITORIO.md` é **o mapa** (diagramas das relações páginas → módulos → Firebase → functions, dev → prod); o bloco "O que o código diz" é gerado por `node scripts/mapa.js` e a CI reprova se estiver velho — **mudou módulo de uma página, função exportada ou nó do banco → rode `node scripts/mapa.js` e commite**.

- `docs/ASSISTENTE_FERIAS.md` — **Assistente Férias do Caio + Plantão de Bugs: desativado em 03/11/2026, guardado para reuso** (nada foi apagado): o interruptor (`FERIAS_FIM` / `?ferias=1` em `oceano(-dev).html`), o inventário de todas as peças (front, módulo `mare-plantao`, funções `plantao*`, regras, skill `/plantaobug`), o checklist do dia da volta e o passo a passo para religar numa próxima ausência. O runbook técnico do plantão continua em `docs/PLANTAO_BUGS.md`.
- `docs/COORDENACAO_AGENTES.md` — **the rules for how the three agents
  share this repo** (decisions D1–D3, models, risk routing R0–R3, cross
  review, task contract v2); the day-to-day state (in progress, queues,
  escalated, pending deploy, backlog) lives in `docs/QUADRO.md`, the only
  coordination file agents edit daily. **Read the board before starting any
  task.** This `CLAUDE.md` is the single source of truth for project rules;
  `AGENTS.md` and `.agents/rules/` only add what is specific to Antigravity
  and Codex and must not restate these rules.
- **Revisão automática das PRs do Antigravity (2026-10-16) — ⏸ PAUSADA em 03/11/2026 (tarefa agendada desabilitada, não apagada; religar = pedir ao Claude ou reabilitar no claude.ai, ver `docs/historico/coordenacao-2026-10-a-11.md`, seção 4.1)** — enquanto pausada, não há revisão automática; mesmo assim, quando você (Claude) for chamado numa conversa com o Caio e houver PR do Antigravity aberta, revise à mão. Como era: tarefa agendada acorda a sessão fixa "Revisor das PRs do Antigravity" (seg–sex, de 2 em 2 h, 8h–20h Brasília) para revisar toda PR `antigravity/*` e comentar nela (`<!-- revisao-claude:SHA7 -->`); nunca faz merge/aprovação/push. Procedimento, limites e como pausar em `docs/COORDENACAO_AGENTES.md` §4.1. Quando você (Claude) for chamado numa conversa com o Caio e houver PR aberta do Antigravity sem comentário de revisão, revise na hora.
- `CODE_MAP_FAST.md` — compact, auto-generated line index of functions and
  anchors for the main pages (`node scripts/mare-cli.js map`); `CODE_MAP.md`
  (below) is the detailed, hand-curated index by feature area.
- `BUGS_E_CORRECOES.md` — log of bugs, point fixes, regressions and
  `/monitorarbugs` findings, plus the `🛡️ Armadilhas Conhecidas & Regras de
  Ouro` section (read it before touching Firebase queries, auth or comments).
  `CHANGELOG.md` is for **new features and structural deliveries only**
  (July–Sept 2026 entries live in `docs/changelog-archive-2026-07-a-09.md`).
- `scripts/mare-cli.js` — `status` / `bump` (version + cache-buster) / `log
  --type feature|bug` (writes CHANGELOG or BUGS) / `map` (rebuilds
  `CODE_MAP_FAST.md`). `.claude/skills/subirproprod/promover.js` — dev → prod
  promotion preserving the prod-only lines (`--status` lists pending hunks).
- `CODE_MAP.md` — index of stable function/const anchors by feature area
  (auth, board render, cards, supercards, automations, notas, notifications,
  Cloud Functions...) for `kanban.html`/`kanban-dev.html`/`painel.html`/
  `functions/`. Use it to jump straight to the right area instead of reading
  the whole file — but always re-`grep` the anchor name before trusting a
  line number, since it's a snapshot that drifts on every edit.
- `MARINE_GLASS.md` — the brand/design-system manual for "Marine Glass"
  (the "glass over ocean" visual identity — dark oceanic gradient background
  + glassmorphism surfaces, "Abrolhos"/"Lençóis Maranhenses" theme names,
  Syne/DM Sans typography, semantic emoji, tone of voice) shared across
  `kanban.html`/`painel.html`, `onboarding.html`, and `bolao.html`. Written
  by the user from the real CSS/copy already in those pages — reference it
  (color tokens, glass blur recipe, the ready-made prompt template in its
  §10) before styling any new page or standalone piece (slide, WhatsApp art)
  that should read as "part of the family." Update it if the palette or
  conventions evolve in a new piece, same spirit as `CODE_MAP.md`.
- `docs/GUIA_UI_UX.md` + skill **`/melhoriauiux`** (2026-10-17) — a "aula" de UI/UX do ecossistema (como se pensam fluxos, páginas, cores, estados, mobile/toque, acessibilidade, dataviz, tom de voz, método de auditoria com Playwright + 3 temas) e o procedimento da rodada de melhoria de UI/UX (direcionada a uma tela ou geral). Complementa `MARINE_GLASS.md` (identidade) e `docs/GUIA_DE_CODIGO.md` (código). **Leia antes de desenhar ou alterar qualquer tela.** Descobriu regra de design nova? Ela entra no guia.
- `ecossistema.html` — **Oceano · Ecossistema de gestão** (2026-10-16, criado para a reunião com a TI de 30/10): documento técnico único (sem `-dev`, entra no ar no merge) sobre arquitetura, uso do Google Cloud/conta corporativa, segurança e dados, ambientes dev × prod, Agente Ágil e consumo de tokens, Claude × Antigravity, skills, subagentes, política de PR/CI/auditoria no GitHub, personalização por squad, riscos e internalização. Todo número ali é medido no repositório (comandos na seção 14) — **mantido por `/atualizardocumentacoes`**; `maredigital.html` virou a referência detalhada do Maré e aponta para ele. Aberto pelo Oceano (botão "Ecossistema de gestão").
- `kanban.html` — production kanban board (squad management).
- `kanban-dev.html` — test/dev copy of the board. **Currently byte-identical
  to `kanban.html`** — historically it's meant for testing changes safely
  before they hit prod, so keep changes to the two in sync deliberately, and
  never point the dev board at production data without reviewing first.
- `painel.html` / `painel-dev.html` — admin panel (people management,
  announcements, manual push notifications) and its dev counterpart. Unlike
  the kanban pair, these two **do** diverge (dev has extra debug
  instrumentation, a "dev" banner, etc.) — check `diff painel.html
  painel-dev.html` before assuming a change should land in both.
- `mare-notif-dev.js` / `mare-notif.js` — **sino único**: módulo compartilhado (raiz do domínio, único arquivo
  carregado por mais de uma página) que mantém o **feed da torre** (`kanban/notif_feed`, "lido" em
  `kanban/notif_feed_seen/{uid}`) e o roteador de tipos de notificação (ícone + URL entre páginas), além do rodapé do sino (🔊 som · permissão deste aparelho/push · 🔕 Não Perturbe) usado pelo OKR e pelo painel, usado pelo sino de
  `kanban`, `painel` e `okr` — a notificação tem que aparecer igual em qualquer página. Segue o mesmo ciclo dev→prod
  (as páginas `-dev` carregam `mare-notif-dev.js?v=N`, as de prod `mare-notif.js?v=N`; ao mudar o módulo, bump o `?v=` nas páginas).
- `mare-dicas-dev.js` / `mare-dicas.js` — **dicas (mini popups)**: segundo módulo compartilhado (raiz do domínio), usado só por `kanban` (Maré), `okr` (Radar) e `oceano` — Painel e A Bordo não mostram dicas (o Painel só **lista** todas, em ⚙ Configurações → 💡 Dicas). O **catálogo de todos os apps vive no módulo** (`CATALOGO`: id, gatilho, texto curto, `saiba` → tópico da Ajuda, `ajuda` = nome do tópico); cada página só chama `MareDicas.init({app, user, quando:{id:fn}, abrirAjuda})` e `MareDicas.gatilho(...)` onde a pessoa chega. O módulo cuida de aparecer 1 por vez, uma vez só, **no máximo 1 por dia por app** (`dicas/ultima/{app}`), e do liga/desliga por app (`kanban/usuarios/{uid}/dicas`). **Dica nova = 1 linha no `CATALOGO` + (se depender do estado da tela) 1 entrada em `quando` na página.** Mesmo ciclo dev→prod do `mare-notif` (`?v=` nas páginas — bump em todas ao mudar o módulo).
- **Conhecimento do Agente Ágil (2026-10-10)** — `functions/agente-agil-orquestrador/conhecimento/*.json` são **gerados** (`cd functions && npm run conhecimento`) a partir de `HELP_CONTENT` (kanban.html), da Ajuda do Radar (okr.html), do FAQ do Oceano (oceano.html) e do CHANGELOG (produção); o teste `conhecimento.test.js` falha se ficarem velhos. **Mudou a Ajuda ou promoveu pra prod → regenerar, commitar e republicar as funções do agente** (`agenteAgilMencao`, `agenteAgilMencaoDados`, `agenteAgilIntake`, `agenteAgilAnalisePO`, `okrAgenteChat`) — Cloud Functions não leem o repo em runtime. Detalhes no `README.md` da pasta.
- **Central de Notificações (2026-10-10)** — aba 🔔 Notificações do `painel(-dev).html`: catálogo de todos os tipos (`MareNotif.TIPOS` em `mare-notif(-dev).js` — **tipo de notificação novo = 1 entrada lá**), interruptores sino/push por tipo em `kanban/notif_config/{tipo}` (regras: só PO/ADM gravam), e quem está com Não Perturbe/push. O push respeita o interruptor via `functions/common/notifConfig.js` (deploy de `sendPushOnNotification`/`sendPushOnMural` + `firebase deploy --only database`).
- `mare-metas-dev.js` / `mare-metas.js` — **metas e desafios ("O mar tá pra peixe", 2026-10-12, em prod desde 2026-10-13)**: terceiro módulo compartilhado (raiz do domínio), usado por `kanban` (aba lateral 📊 Dados com 2 abas Squad|Digital + ⚙ Config → 🐟 Metas) e `painel` (📊 Dados → metas do Digital). Concentra matemática (% / ritmo / situação / marcos de 20 %), gráficos no estilo do Radar, formulários, popup 🐟 e a camada de dados (`kanban/metas_digital[_dev]`, `kanban/metas_squads[_dev]/{squad}`, `kanban/metas_log[_dev]` — **regras novas, exige `firebase deploy --only database`**). Mesmo ciclo dev→prod do `mare-notif` (`?v=` nas páginas; ao promover: `mare-metas.js` + `kanban.html` + `painel.html` juntos). Recursos: ritmo não linear (diarização), entrada retroativa como parte do total e 🗂 Entradas (editar/excluir). Lembretes de preenchimento: função agendada `metasLembretes` (`functions/metas/lembretes.js`, a cada 15 min no horário de Brasília; deploy: `firebase deploy --only functions:metasLembretes,functions:sendPushOnNotification` + `firebase deploy --only database`; tipo `meta_lembrete` em `PUSH_TYPES` e em `MareNotif.TIPOS`).
- `mare-sonar-dev.js` / `mare-sonar.js` — **🔍 Sonar, a busca do Oceano (10/11/2026)**: quarto módulo compartilhado de página (raiz do domínio). Um layout e um comportamento para todas as páginas: janela com o título "Sonar" e o disco que varre só enquanto procura, abas de escopo (teclas 1..n com a caixa vazia, Tab, prefixos `m:`/`r:`), busca sem acento e com 1 erro de digitação, recentes por página. Cada página só entrega o próprio **foco** em `MareSonar.iniciar({fontes, depois, radar, escopos…})` (lobby: produtos, comandos, squads, links, ajuda; Maré: cards do board). A fonte do **Radar** é do módulo: 1 leitura de `kanban/okr/objetivos` + `marcos` (~393 KB em prod) só quando a busca pede o Radar, e a versão enxuta (id, título, período, responsáveis) fica no aparelho por 3 h em `oceano_sonar_radar[_dev]`, compartilhada entre as páginas. Mesmo ciclo dev→prod do `mare-notif` (`?v=` nas páginas; ao promover: `mare-sonar.js` + as páginas que o carregam, juntos).
- `firebase-messaging-sw.js` — the Service Worker. **Must stay at the domain
  root** (not in a subfolder) — it handles both offline caching and showing
  push notifications when the tab is closed/backgrounded.
- `functions/index.js` — registers every deployed Cloud Function (each
  `exports.xxx = require('./yyy/zzz').xxx` line documents its own deploy
  command in a comment above it — always deploy with
  `firebase deploy --only functions:<name>`, never a bare
  `--only functions`, unless you mean to touch every function at once).
  Currently live: `sendPushOnNotification` (push), `agenteAgilMencao`
  (Agente Ágil orquestrador, `agente-agil-orquestrador/`), `agenteAgil`
  (older HTTP-based agent v0-v3, `agente-agil/`), `intakeSubmit`
  (anonymous public form → `intake_pending`, `intake/`), `weeklyBackup`
  (automatic weekly board backup to Cloud Storage, `backup/weeklyBackup.js` — board only), `backupCompletoSemanal`/`backupGlobalDiario` (**full database backup**, `backup/completo.js` → private `backups-completos/`; **a new top-level node in the database = add it to `NOS_GLOBAIS` there, or it has no backup**; restore with `backup/restaurar.js` or the 🛟 screen in Config → Backup via `backupCompletoApi`; `backupVigia` alerts the ADMs when a backup fails), and most of
  the Spotify integration (`spotify/`, see below) — **except**
  `spotifySync`, which is commented out. See `CODE_MAP.md` for the full
  export list with line numbers.
- `database.rules.json` — Realtime Database security rules. This is a
  **manual mirror** of what's configured in the Firebase Console; if someone
  edits rules directly in the console, this file goes stale until someone
  copies the change back. Worth diffing against the console occasionally.
- `version.json` — the version each page's auto-update mechanism polls (see
  below). Bump the relevant key whenever a versioned page changes.
- Other standalone tools with no relation to Maré Digital: `bolao.html`,
  `capacitacao.html`, `onboarding.html` (+ `onboarding.slide.html`),
  `apresentacao.html`, `maredigital.html`, `resumo.slide.html`,
  `ai-slide.html`, `ai-txt.html`, `controle.html`.

### Modo "só Hering" e família Oceano (nomes)

## Modo "só Hering" (2026-10-08) — Arezzo/Microsoft, Torres e menção ficaram atrás de um interruptor

O Maré passou a atender só a Hering: login só Google (`@ciahering.com.br`), OKR de uma torre só (Digital), @menção só a quem é `@ciahering`. Nada foi apagado — `window.MARE_SO_HERING` (1º `<script>` de `kanban(-dev)`, `painel(-dev)`, `okr(-dev)`; `const MARE_SO_HERING` em `okr-apresentacao.slide.html`; `functions/common/mareModo.js`; `database.rules.json` sem a alternativa Arezzo). **Antes de mexer em login, torres, domínios ou regras, leia `docs/arezzo/MARE_SO_HERING.md`** (o que existia, como foi implementado, lista de interruptores e passo a passo pra religar). Os testes de torres/Arezzo das funções rodam com `MARE_MODO_TESTE=varias-torres`.

## Oceano (2026-10-09) — a família de produtos e os nomes

O que era tudo "Maré Digital" virou a família **Oceano**: **Maré Digital** (kanban), **Painel**, **Radar** (= o OKR, `okr.html`), **A Bordo** (onboarding) e **Travessia** (futuro, performance/gente). Só os **nomes visíveis** mudam — arquivos, URLs e caminhos do banco ficam. "OKR" continua como metodologia, papel ("🎯 Gestor OKR") e selo dos cards. Regras e fases em `docs/OCEANO.md` — **leia antes de renomear qualquer texto**; texto novo que cite a página do OKR deve dizer "Radar".

**Página Oceano (2026-10-09, em produção):** `oceano.html` / `oceano-dev.html` é o lobby/boas-vindas da família (login só Google, vitrine por pessoa, personalização, ajuda, selo `#vtex-pill` de status da VTEX e **host** dos produtos em iframe quando instalada como app — o PWA do Maré Digital não muda). Detalhes em `docs/OCEANO.md`. **Mural do Oceano (2026-10-11, em produção desde 2026-10-13):** os Comunicados do Painel (aba Pessoas) têm 🌊 "Mostrar no mural do Oceano" (padrão ligado) e "Só no Oceano" — página inicial do Oceano, ver `docs/OCEANO.md`. **Login único + 1ª abertura do dia (2026-10-11/14, em produção):** quem não está logado no Maré/Painel (ou na 1ª abertura do dia em `_oceanoDoDia`) é mandado pro Oceano (`?next=`), faz login + cadastro lá e **fica no Oceano** (vê o Mural; atalho "↩ Continuar" no topo leva de volta); Radar e convidados externos (`?login=local`) ficam de fora — ver `docs/OCEANO.md`, interruptores `MARE_LOGIN_PELO_OCEANO` e `MARE_OCEANO_DIARIO`. **Menu de produtos (⋮⋮⋮, `mare-notif(-dev).js`)** com abas Produtos · Hering · Meus links — links da Hering em `kanban/config/links_hering` (nó compartilhado dev/prod), pessoais em `kanban/usuarios/{uid}/links`; em prod em `kanban`, `painel`, `okr` e `oceano` desde 2026-10-09.

### Cadência de promoção — o porquê

Standing rule (2026-08-14): **bug fixes still promote to prod immediately**
once validated (step 3 above, no change there) — but **feature promotions
get batched and concentrated at the end of the day** instead of shipping
one-by-one as each gets validated. Exceptions handled ad hoc when they come
up in conversation (e.g. something time-sensitive), not a rigid rule.

Why: every prod version bump forces every open tab to reload within
`CHECK_INTERVAL_MS` (5 min) via the auto-update overlay (`kanban.html`
~line 24439). A reload isn't free — it re-authenticates and re-attaches
every Firebase listener from scratch (`cards`, `cards_index`, `tags`,
`columns`, `presence`, ...), which is the expensive "cold start" the
`_dbg` byte-measurement system (~line 6702) tracks. Confirmed against real
data: 13 separate "Promove pra prod" merges landed within ~40h on
2026-08-04/05, and those are the two highest-bandwidth days in the
`_debug_bytes_daily` sample for that window (~210MB and ~161MB, vs. a
typical quiet day around 1-2MB) — each promotion re-charges the cold-start
cost to everyone who had the board open at the time. Batching feature
promotions into one push per day means one forced reload instead of many.
