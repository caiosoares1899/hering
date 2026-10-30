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
| ⛵ **Travessia** (pessoas / 1:1 / avaliação) | — | `travessia-dev.html` | Fase 1: Baú, faróis, humor, mural de Estrelas, avaliação com indicação de pares e trava de devolutiva (desenho em `docs/ideias/travessia-2026-10-22.md`; protótipo antigo em `docs/demo/travessia-prototipo-fase0.html`) |

Sem par dev: `okr-apresentacao.slide.html` (apresentação do Radar) · `guia-okr.html` (guia do Radar, 14 MB — prints embutidos).

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
| `AGENTS.md` | Só o que é específico do Antigravity (linhas vermelhas, aprovações) | Antigravity |
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
| `scripts/` | `checar.js` (checagens que a CI roda), `mare-cli.js` (`status`/`bump`/`log`/`map`/`ship`…) e `mapa.js` (gera o bloco automático do mapa) |
| `vendor/firebase-10.14.1/` | SDK do Firebase servido localmente (o FortiGate da Hering bloqueia o CDN) |
| `.claude/skills/` | Skills do Claude/Antigravity (`/subirproprod`, `/monitorarbugs`, `/seatualizar`, `/plantaobug`…) |
| `.agents/` | Regras e lista de skills do Antigravity |
| `.github/workflows/` | `pages.yml` (publica a raiz no Pages) e `checks.yml` (CI: `checar.js` + testes de `functions/`) |

### Índice de `docs/`
| Documento | Assunto |
|---|---|
| `MAPA_DO_REPOSITORIO.md` | **O mapa**: como as peças se encaixam (diagramas), por pasta e as tabelas geradas do código (`scripts/mapa.js`) |
| `COORDENACAO_AGENTES.md` | Como Claude e Antigravity dividem o repo; o **Quadro** (em andamento / escalado / pendente de deploy) |
| `GUIA_DE_CODIGO.md` | Como escrever código e testes sem cair nas armadilhas conhecidas |
| `OCEANO.md` | A família de produtos, nomes visíveis e fases |
| `PLANTAO_BUGS.md` | Plantão de Bugs: fluxo, regras e runbook |
| `MINIPAINEL.md` | Mini painel do Caio (`minipainel.html` + função `oceanoResumo`): peças, deploy, chave e limites |
| `changelog-archive-2026-07-a-09.md` | Histórico do CHANGELOG de jul–set/2026 |
| `ideias/camiseta-brasil-black-friday.md` | Ideia guardada para depois das férias |
| `ideias/dossie-concorrencia-2026-10.md` | Dossiê de concorrência do Antigravity, já triado — backlog pós-férias |
| `ideias/travessia-2026-10-22.md` | Desenho do Travessia (pessoas/PDI/1:1): concorrência, princípios, modelo de dados, fases, decisões do Caio e triagem do dossiê do Antigravity |
| `ideias/tema-claro-painel-radar-2026-10-17.md` | Auditoria do tema claro/Vice no Painel e no Radar + plano de correção (18/10) |
| `MIGRACAO_DOMINIO.md` | Internalização (30/10/2026): inventário de tudo que depende do endereço atual (código, CORS das funções, login Google, PWA, dados do navegador, links gravados) + checklist da virada |
| `AUDITORIA_SEGURANCA_2026-10-18.md` | Pente fino de segurança: achados, o que foi corrigido, riscos aceitos, o que o Caio vê no console do Google |
| `ideias/amanha-18-10-mapa-repo-e-push-antigravity.md` | Mapa do repositório, resumo no Ecossistema e push dos pedidos do Antigravity (18/10) |

---

## "Quero… onde mexo?"
| Quero | Vá em |
|---|---|
| Corrigir/alterar algo do board | `kanban-dev.html` (nunca direto o prod) → achar a função em `CODE_MAP_FAST.md` |
| Notificação nova | `MareNotif.TIPOS` em `mare-notif-dev.js` (+ `PUSH_TYPES` em `functions/` se for push) |
| Dica nova | linha no `CATALOGO` de `mare-dicas-dev.js` |
| Subir dev → prod | skill `/subirproprod` (`.claude/skills/subirproprod/promover.js`) |
| Ver o que o outro agente está fazendo | `docs/COORDENACAO_AGENTES.md` → Quadro |
| Registrar feature / bug | `node scripts/mare-cli.js log --type feature|bug` |
| Rodar as checagens da CI | `node scripts/checar.js` e `cd functions && npm test` |
| Testar uma tela no navegador | `docs/arezzo/testes/` (`fakefb.js` + Playwright) |
| Saber como o plantão de bugs funciona | `docs/PLANTAO_BUGS.md` |
| Criar tela nova no estilo da família | `MARINE_GLASS.md` |
