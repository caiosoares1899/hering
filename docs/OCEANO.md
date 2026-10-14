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

## A página Oceano (lobby) — 2026-10-09, em produção (`oceano.html` v1.4; dev: `oceano-dev.html`)
`oceano.html` é a **sala de estar** da família: boas-vindas, "venda" interna, atalho pros produtos, parte técnica (links pra `maredigital.html`), ajuda e **cadastro/personalização** (`kanban/usuarios/{uid}/oceano`). Login **só Google @ciahering**.
- **Host dos produtos:** com o app instalado (ou preferência "sempre aqui dentro"), os produtos abrem em **iframes de nome `oceano-frame`** dentro do Oceano. O menu de 9 pontinhos (`mare-notif(-dev).js` v12) detecta esse nome e troca de produto via `postMessage({oceano:'abrir'|'lobby'})` em vez de abrir aba nova. Páginas não precisam mudar.
- **PWA próprio:** `oceano(-dev).webmanifest` (id e escopo só da página). **Não mexe no aplicativo do Maré Digital**, que continua com o manifesto dele.
- **Produto novo:** além de `APPS`/`appsVisivel()` no módulo, acrescente em `APPS` e `PROD` do `oceano-dev.html`.
- Visual: **Marine Glass igual às outras páginas** (tokens, vidro, peixinhos/bolhas do Maré). Temas `abrolhos` (padrão) e `lencois` compartilham `mare_theme`; `entardecer` é opcional só aqui. Peixinhos por preferência (espelha `fish_bg_off`). Logos: `favicon-oceano.png` (fundo azul), `oceano-logo.png` (sem fundo), ícones 192/512.
- **Tela inicial (v1.2):** abre na aba *Meus produtos* (grade de botões, teclas 1–9, atalhos por squad); a parte de "venda" e a técnica ficam nas abas *Conheça o Oceano* e *Por baixo do casco*. Fontes: Syne nos títulos pequenos e DM Sans no corpo, como o Maré.
- **Menu de 9 pontinhos:** o Oceano é o *título* do popover ("🌊 Oceano · início ↗", link pro lobby, só pra quem é da Hering), não um tile da grade — a grade é só de produtos. Decisão de 2026-10-09.
- **Links (2026-10-09, dev):** o menu de 9 pontinhos tem abas **Produtos · Hering · Meus links**. *Hering* = `kanban/config/links_hering/{id}` {titulo, desc, url, img, ordem} (ADM edita no Painel → ⚙ Configurações → 🔗 Links); *Meus links* = `kanban/usuarios/{uid}/links/{id}` (a pessoa edita em Oceano → ⚙ Meu perfil). Cache `mare_links_*` no localStorage. Só `http(s)` (imagem só `https`). A restrição a ADM é só da tela (as regras de `kanban/config` aceitam qualquer @ciahering).

## Menu de produtos com abas + links (2026-10-09, em produção: `mare-notif.js` v16)
O botão ⋮⋮⋮ (`MareNotif.appsMontar`) tem 3 abas: **Produtos** (grade; o título "🌊 Oceano" é o link do lobby), **Hering** e **Meus links**. Dados: `kanban/config/links_hering/{id}` (**nó compartilhado entre dev e prod** — o que o ADM cadastra em Painel → ⚙ Configurações → 🔗 Links vale nos dois) e `kanban/usuarios/{uid}/links/{id}` (editados em Oceano → ⚙ Meu perfil → 🔗 Meus links). Cache em `localStorage` (`mare_links_hering`, `mare_links_user_{uid}`, TTL 10 min). Só `http(s)` pro endereço e `https` pra imagem; sem imagem usa o favicon do site (serviço do Google — o nome do site é enviado a ele). Quantidade múltipla de 3 vira grade. O `kanban.html` de prod carrega o menu desde a v8.30.812.
Limitações conhecidas: a restrição "só ADM edita os links da Hering" é só da interface (as regras deixam qualquer `@ciahering` escrever em `kanban/config`); os caches ficam no aparelho depois do logout; conta externa (`painel_viewers`) só acompanha a apresentação ao vivo e não vê as abas de links.

## Sino no Oceano (2026-10-09, só dev: `oceano-dev.html` v1.5)
Botão 🔔 no topo, ao lado de ❓ Ajuda, com o módulo compartilhado `mare-notif-dev.js`. Pessoais (`kanban/usuarios/{uid}/notificacoes`, TTL do sino do kanban) + feed da torre; rodapé de som/push/Não Perturbe registra o aparelho em `fcm_tokens` (FCM por `import()` dinâmico). Clique roteia por `rotearUrl()` → `abrirApp()` (host/aba nova conforme a preferência). O push continua emitido pela Cloud Function; o clique na notificação de push (service worker) ainda abre `kanban`/`okr` numa aba do navegador, não o Oceano instalado.

## Login único pelo Oceano (2026-10-11, só dev: kanban-dev v8.30.826 · painel-dev v5.45 · oceano-dev v1.15)
O Oceano é a **porta de entrada**: quem não está logado no Maré ou no Painel é mandado pra `oceano(-dev).html?next=<página>`, entra com o Google da Hering (o cadastro básico em `kanban/usuarios/{uid}` é feito lá, sem sobrescrever) e **FICA no Oceano** — vê o Mural e a vitrine — com um atalho **"↩ Continuar para o Maré"** no topo (`#continuar`, `mostrarContinuar()`) que leva à página de origem (squad/card/hash incluídos). Ela **não** é devolvida sozinha: o objetivo é todo mundo passar pela página inicial (v1.19; a v1.15 devolvia sozinho e pulava o Mural).
- **Onde:** `_irParaOceano()` no ramo deslogado de `kanban(-dev)` (listener `auth-change`) e `painel(-dev)`; `NEXT` + `garantirCadastro()` + `mostrarContinuar()` no `oceano(-dev)`. Interruptor: `window.MARE_LOGIN_PELO_OCEANO` (1º `<script>` das duas páginas, ao lado de `MARE_SO_HERING`); `false` = cada página volta a mostrar a tela de login própria.
- **`next` seguro:** lista fechada `^(kanban|painel|okr)(-dev)?\.html(?query)(#hash)?$`; qualquer outra coisa é ignorada.
- **Exceções (não redireciona):** Radar (visualizador externo entra direto); página dentro do host do Oceano (iframe); `?login=local` (convidado externo/visualizador — guarda `sessionStorage.mare_login_local` pela aba; a tela de login do Oceano tem os links "Convidado externo? Entre direto"); recusa/aviso já escrito em `#login-err` ou guardado em `login_notice`; anti-loop (`sessionStorage.mare_oceano_ts`, 45 s).
- **Convidado externo (2026-10-14, só dev: oceano-dev v1.34):** como o Maré/Painel não sabem o e-mail de quem está deslogado, o freelancer também é mandado pro Oceano. Conta que NÃO é `@ciahering.com.br` + `?next=` válido → o Oceano encaminha pra `next` + `login=local` (squad/card/hash preservados), sem `signOut`; a página de origem valida a lista de externos. Sem `?next` (Oceano aberto direto) a recusa continua, e os links `lc-*` da tela de login levam a squad/card do `next`. Conta `@ciahering` sem Google segue recusada.
- **Também quem JÁ está logado (2026-10-14, só dev: kanban-dev v8.30.856 · painel-dev v5.65 · oceano-dev v1.33):** o login do Maré/Painel é uma sessão do Firebase guardada no navegador — sobrevive a sair da conta Google (e à verificação em 2 etapas pedida de novo), então a pessoa abria o Maré direto e nunca passava pelo Oceano. `_oceanoDoDia(user)` (logo antes de `autoRegistrar`/`_finishPainelLogin`) manda pro Oceano (`?next=` com a squad) na **1ª abertura do dia**; a marca é `localStorage.mare_oceano_dia[_dev]` = data local, e o próprio Oceano também a grava quando aberto direto (quem já passou por lá hoje não é mandado de novo). **Não manda:** iframe, `?login=local`, e-mail fora de `@ciahering.com.br`, app instalado (standalone), link com destino (qualquer parâmetro além de `?squad=`, ou `#hash`), anti-loop de 45 s (`mare_oceano_ts`). Interruptor: `window.MARE_OCEANO_DIARIO=false`. Teste: `docs/arezzo/testes/test_oceano_do_dia.js`.
- **Cuidado ao mexer em login:** a regra de deslogado só vale pra quem NÃO tem sessão no Maré. Se um dia o Oceano cair, `MARE_LOGIN_PELO_OCEANO=false` + promoção resolve; convidados externos usam `?login=local`.
- **A testar à mão:** o app instalado (PWA) indo e voltando pelo Oceano (escopo do manifest) no iPhone/desktop. Teste automático: `docs/arezzo/testes/test_login_oceano.js`.

## Mural de avisos (2026-10-11, só dev: oceano-dev v1.16 · painel-dev v5.46 · kanban-dev v8.30.827)
A página inicial do Oceano mostra um **📌 Mural** com os **Comunicados** (`kanban/comunicados`) marcados com `oceano:true`. Quem decide é o ADM no composer do Painel (aba Pessoas › Comunicados): **🌊 Mostrar no mural do Oceano** (padrão ligado) ou prioridade **🌊 Só no Oceano** (`prioridade:'oceano'` — fora do Maré e sem notificação). Campos novos do aviso: `oceano`, `capa` (https), `botao {rotulo,url}`, `fixado`, `autor`.
- **Oceano:** `iniciarMural()` (query `ativo=true`), `avPodeVer()` (squad / "só PO" / ADM / expiração), `avLimpa()` (sanitiza o HTML), `muralRender()`, `avAbre()`; `squads_roles` do usuário vem de `kanban/usuarios/{uid}/squads_roles`. **Painel:** `_ccTogglePrioridadeUI()`, `saveComunicado()`, `_comunicadoOndeTxt()`. **Maré:** `_muralTodos` ignora `prioridade==='oceano'`.
- **Layout (v1.20):** no desktop (≥ 980 px) o início é um grid de 2 colunas — produtos à esquerda, Mural à direita (`#inicio-grid.tem-mural`, rolagem interna na coluna); estreito = empilhado. Sem aviso, a classe `tem-mural` sai e os produtos ocupam tudo. O padrão aberto/recolhido acompanha o layout (aberto no desktop, recolhido no estreito) até a pessoa escolher.
- **Recolhível (v1.17):** o Mural começava recolhido (agora só no estreito, ver Layout) (`#mural-hd` é um botão; escolha em `localStorage.oceano_mural_aberto`); o selo `#mural-novos` conta o que ainda não foi visto (vermelho com 🚨 Urgente) e "visto" só é gravado com o Mural aberto (`oceano_mural_visto_<uid>`).
- Aviso antigo (sem `oceano`) **não** vai pro Oceano até alguém abrir, marcar e salvar. Sem mudança em regras nem functions.

## Escala (2026-10-12; prod `escala.html` v1.7 desde 13/10 · dev: escala-dev v1.9)
Página própria `escala-dev.html` — **não é um produto novo do menu ⋮⋮⋮ nem tile do Oceano**, é uma ferramenta ligada ao Maré (visão **👥 Escala** dentro do 📅 Calendários) e ao Painel (aba **Escala ↗**): quem trabalha quando, por squad e global, com cadastro pela própria pessoa ou pelo PO/Organizador/ADM. Dados em `kanban/escala/{data}/{squadId}/{uid}`; regras em `database.rules.json` (precisam de `firebase deploy --only database`). Detalhes no `CHANGELOG.md` e no `CODE_MAP.md`. Na promoção pra prod: `escala.html` (cópia sem o sufixo/`devtag`, `VERSION_KEY='escala'`, chave `escala` em `version.json`) + `kanban.html` + `painel.html` juntos.
**Dev v1.8–v1.9 (13/10):** os filtros de squad/subtime viraram uma mini tela (botão 🔎 Filtros, selo com o nº de filtros); o detalhe do dia ganhou a 📊 Visão Gantt (e JPG do Gantt); o cadastro aceita até 3 ☕ pausas por dia (campo `p`, regras novas — `firebase deploy --only database`). Na promoção levar `escala.html` + `database.rules.json` juntos.
