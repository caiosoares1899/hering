# 🌊 Oceano — a família de produtos (decisão de 2026-10-09)

O que antes era tudo "Maré Digital" passa a ser uma **família**, chamada **Oceano**. Só **nomes** mudam; arquivos, URLs, caminhos do banco (`kanban/...`, `kanban/okr/...`) e ids de código **não mudam**.

| Produto | O que é | Página / arquivo | Situação |
|---|---|---|---|
| **Maré Digital** | o kanban (gestão dos squads) | `kanban.html` | mantém o nome |
| **Painel** | gestão/diretoria, pessoas, comunicados | `painel.html` | mantém o nome (a ideia "Passadiço" foi descartada) |
| **Radar** 📡 | o OKR (Objetivos e Resultados-Chave) | `okr.html` | renomeado e **em produção** (okr v2.49, 2026-10-09) — logo: `favicon-radar.png` |
| **A Bordo** | onboarding | `onboarding.html` | a renomear (não mexido ainda) |
| **Travessia** | ciclo de performance/gente (avaliação, PDI, dia a dia, usa métricas do Radar e da Maré) | — | projeto futuro |

## Regras do que renomear (e do que NÃO)
- **Renomeia** onde "OKR" é o **nome da página/produto**: título da aba do navegador, cabeçalho, "Ajuda do Radar", "Mural do Radar", "Notificações do Radar", "Online no Radar", "Guia do Radar", links/abas nas outras páginas, textos de ajuda/inscrição, notificação "te mencionou nas anotações do Radar".
- **Mantém "OKR"** onde é a **metodologia, um papel ou um selo**: "🎯 Gestor OKR" (papel; mudar mexe no banco e no Global Users), o selo **OKR dos cards** do kanban ("Marcar como OKR", `isOKR`), "OKRs" no plural, eventos "Check-in OKR — Bloco 1/2" (dado já gravado).
- O texto de ajuda do Radar explica: "Radar é o nome do OKR dentro do Oceano".

## Fases
1. **Nomes visíveis** (em andamento): okr-dev v2.46, painel-dev v5.23, kanban-dev v8.30.804-dev.
   Ficam pra juntar na **promoção pra prod**, porque são compartilhados ou rodam fora das páginas: `guia-okr.html` (+ prints), `okr-apresentacao.slide.html`, `maredigital.html`, e os textos das **Cloud Functions** (prompt do Agente Ágil do OKR, push/notificações `okr_*`; exigem deploy).
2. **Menu entre produtos do Oceano** (hoje o menu de páginas já existe no cabeçalho do painel e lista "Radar").
3. **URLs/arquivos** só no fim, se valer a pena, com redirecionamento.

## Menu de produtos (2026-10-09, só dev)
Botão de 9 pontinhos no cabeçalho de cada produto (módulo `mare-notif(-dev).js`: `MareNotif.appsMontar()` / `appsUso()`), abre a grade com a logo de cada produto em **aba nova**. Quem vê o quê: Maré Digital e A Bordo = Hering; Radar = todos (inclusive visualizador externo); **Painel = ADM, visualizador externo ou quem já usa** (`kanban/usuarios/{uid}/apps/painel`, gravado quando a pessoa abre o painel ou é PO/Organizador/ADM no kanban). É vitrine, não segurança. **Produto novo** (ex.: Travessia): acrescente uma entrada em `APPS` e uma regra em `appsVisivel()` no módulo — as páginas não mudam.

## Cuidados
- Travessia lida com dado sensível (avaliação/PDI): regras de acesso próprias, num trecho separado do banco, desenhadas antes do código.

## Logos
- **Maré Digital**: `favicon.png` (peixinhos sobre ondas). **Radar**: `favicon-radar.png` (radar com peixinhos, 256 px). Painel e A Bordo ainda usam SVG provisório em `mare-notif(-dev).js` (`APPS`) — quando ganharem arquivo de logo, é só trocar por `img:'arquivo.png'`.

## A página Oceano (lobby) — 2026-10-09, só dev
`oceano-dev.html` (prod: `oceano.html`, na promoção) é a **sala de estar** da família: boas-vindas, "venda" interna, atalho pros produtos, parte técnica (links pra `maredigital.html`), ajuda e **cadastro/personalização** (`kanban/usuarios/{uid}/oceano`). Login **só Google @ciahering**.
- **Host dos produtos:** com o app instalado (ou preferência "sempre aqui dentro"), os produtos abrem em **iframes de nome `oceano-frame`** dentro do Oceano. O menu de 9 pontinhos (`mare-notif(-dev).js` v12) detecta esse nome e troca de produto via `postMessage({oceano:'abrir'|'lobby'})` em vez de abrir aba nova. Páginas não precisam mudar.
- **PWA próprio:** `oceano(-dev).webmanifest` (id e escopo só da página). **Não mexe no aplicativo do Maré Digital**, que continua com o manifesto dele.
- **Produto novo:** além de `APPS`/`appsVisivel()` no módulo, acrescente em `APPS` e `PROD` do `oceano-dev.html`.
- Visual: ambientes `entardecer` (padrão), `abrolhos`, `lencois`; peixinhos/ondas por preferência. Logos: `favicon-oceano.png` (fundo azul), `oceano-logo.png` (sem fundo), ícones 192/512.
