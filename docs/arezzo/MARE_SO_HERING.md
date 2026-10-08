# 🏢 Maré só Hering — o que existia (Arezzo · Torres · Menção), como foi implementado e como religar

> **Decisão de 2026-10-08:** o Maré passou a atender **só a Hering**. Isto desligou três coisas que tinham sido construídas entre 2026-10-01 e 2026-10-07:
>
> 1. **Login só pelo Google** (`@ciahering.com.br`) — saiu a integração **Arezzo / Microsoft**;
> 2. **OKR de uma torre só (Digital)** — saíram as torres **Comercial** e **Corporativa** (e a visão global);
> 3. **@menção e listas de pessoas só com contas `@ciahering.com.br`**.
>
> Nada foi apagado: tudo ficou atrás de **um interruptor por página** (`MARE_SO_HERING`) e de **um arquivo de regras arquivado**. Este documento é o mapa completo — o que cada peça fazia, onde está, como foi desligada, e o passo a passo pra **religar**. O último commit com tudo ligado (antes desta mudança) é **`bcbd200`** (`git show bcbd200:okr-dev.html`, `git diff bcbd200 HEAD`).

---

## 0. Resumo de 1 minuto

| O que | Antes (religado) | Agora (só Hering) | Onde está o interruptor |
|---|---|---|---|
| Login | Google (`@ciahering`) **e** Microsoft (`@arezzo`) + Microsoft pessoal pra externo autorizado | só Google; botões Microsoft escondidos e as funções recusam | `window.MARE_SO_HERING` (1º `<script>` de `kanban-dev`, `painel-dev`, `okr-dev`) |
| Domínios confiáveis | `TRUSTED_DOMAINS = ['@ciahering.com.br','@arezzo.com.br']` | `['@ciahering.com.br']` | idem |
| Regras do banco | `@ciahering`+Google **ou** `@arezzo`+Microsoft | só `@ciahering`+Google | `database.rules.json` (arquivo) — cópia antiga em `docs/arezzo/database.rules.com-arezzo.json` |
| Torres do OKR | Digital, Comercial, Corporativa (+ visão global, torre ⭐ Geral) | só Digital, direto na lista | `OKR_SO_DIGITAL` (derivado de `MARE_SO_HERING`) em `okr-dev`; `MARE_SO_HERING` em `okr-apresentacao.slide.html` |
| Torre da pessoa | pergunta no cadastro (OKR e inscrição do kanban); ADM troca no 👥 Global Users | ninguém é perguntado; seletor some | idem |
| @menção / pessoas | todo mundo com registro | só `@ciahering.com.br` (agentes e registros sem e-mail passam) | `_mencionavelNoModo()` (kanban), `_okrPessoaOptions()` (okr) |
| Sino único (feed) | filtra pela torre da pessoa | só `digital` ou `*` | `SO_HERING` em `mare-notif-dev.js` |
| Cloud Functions | `@arezzo` conta como empresa; 3 torres | só `@ciahering`; 1 torre | `functions/common/mareModo.js` |

**Dados NÃO apagados.** Objetivos, Marcos, eventos, avisos e snapshots das torres Comercial/Corporativa continuam no Firebase — só ficam **invisíveis** (nas telas, no Agente Ágil, no scan diário e no push do Mural). `kanban/usuarios/{uid}/torre` também é preservado. Religar traz tudo de volta.

**O que NÃO mudou (de propósito):** `kanban.html`, `painel.html`, `okr.html`, `mare-notif.js` (produção) — o modo só Hering está só nos `-dev` + `okr-apresentacao.slide.html` (compartilhado, sem cópia dev, vai ao ar assim que for mergeado) + regras/funções (que o usuário publica da própria máquina). Veja o §6 sobre a promoção.

---

## 1. Login: Google (Hering) × Microsoft (Arezzo)

### 1.1 O que existia e como foi implementado

Pedido original (2026-10-01): *"o time da Arezzo colabora com a gente, mas usa Microsoft/Azure AD, não Google Workspace"*. Entregue em 3 páginas + regras (CHANGELOG: `v8.30.772-dev/v8.30.772` kanban, `painel-dev v3.83`, depois `okr`).

**Pré-requisitos FORA do código** (já feitos pelo usuário; se religar, confirmar que seguem valendo):
1. Azure/Entra ID → *App registrations* → app **multitenant**, *Redirect URI* `https://hering-onboarding.firebaseapp.com/__/auth/handler`.
2. Firebase Console → Authentication → *Sign-in method* → provider **Microsoft** habilitado (Application/Client ID + secret do passo 1).
3. `firebase deploy --only database` com as regras que aceitam `@arezzo` (§1.4).

**Front-end (cada uma das 3 páginas tem a sua cópia — `grep -n "microsoft\|arezzo\|TRUSTED_DOMAINS" <arquivo>`):**

- **Provider** (dentro do `<script type="module">`): `const msProvider = new OAuthProvider('microsoft.com'); msProvider.setCustomParameters({ tenant: 'organizations', prompt: 'select_account' })` — `organizations` = só contas de **trabalho/escola** (bloqueia hotmail/outlook na raiz). Exposto como `window._signInMicrosoft = () => signInWithPopup(auth, msProvider)`.
- **kanban** ainda tem: fallback **popup → redirect** (2 falhas seguidas de popup trocam pra `signInWithRedirect`, contador próprio `login_popup_fail_streak_ms`, `window._signInMicrosoftRedirect`), e um **2º provider** `msPersonalProvider` com `tenant: 'consumers'` (conta Microsoft **pessoal** de **externo autorizado** em `kanban/squads/{sq}/externos`; botão "Externo autorizado com hotmail/outlook?" na tela de login; `window._signInMicrosoftPessoal*`). Esse 2º provider existe porque o e-mail de uma conta corporativa Microsoft **não é verificado** (nOAuth — dá pra criar um tenant próprio com o e-mail de outro); com `consumers` só entra conta pessoal e esse e-mail a Microsoft verifica.
- **Botão** "Entrar com Microsoft" na tela de login (`#login-ov`): `doSignInMicrosoft()` (kanban: `doSignInMicrosoft(insc)`, com contador de falha/redirect).
- **Domínio confiável:** `const TRUSTED_DOMAINS = ['@ciahering.com.br','@arezzo.com.br']; function _isTrustedDomainEmail(email)`. Usado em: gate do `auth-change` (quem não é confiável só entra se estiver na whitelist de `externos` do kanban / `painel_viewers` do painel e do OKR), atribuição de papel no 1º cadastro (`membro` × `convidado`), `autoRegistrar()`, tela "+ Adicionar externo/visualizador" (recusa e-mail de domínio confiável), `_squadsDoExterno`, etc.
- **Pin de provedor** `_loginProviderMismatchMsg(user)`: espelha as regras — `@ciahering` só vale logado pelo Google, `@arezzo` só pela Microsoft; e-mail **vazio** (comum em Microsoft/Entra sem atributo `mail`) também é recusado. A mensagem é guardada (`_rejectLoginAfterReload`/`_showLoginNotice`, kanban) porque `_signOut()` termina em `location.reload()`.
- **painel-dev** ainda tem os filtros do 👥 *Usuários cadastrados*: chips **Hering / Arezzo / Externos** (`GU_EMPRESAS`, `_guEmpresa(u)` — empresa vem do domínio do e-mail).
- Textos que citam `@arezzo.com.br` (tela de login, "Acesso restrito a…", avisos de "+ Adicionar externo", textos de visualizador).

### 1.2 Como foi desligado (modo só Hering)

- **1º `<script>` de `kanban-dev.html`, `painel-dev.html`, `okr-dev.html`:**
  ```js
  window.MARE_SO_HERING = true;
  // + <style>.ms-login{display:none!important}</style> injetado na hora (esconde tudo que tem a classe .ms-login)
  ```
- Elementos Microsoft ganharam a classe **`ms-login`** (botão "Entrar com Microsoft", linha "Externo autorizado com hotmail/outlook?", e `<span class="ms-login">` em volta de " ou Microsoft" / " / @arezzo.com.br" nos textos).
- `TRUSTED_DOMAINS = MARE_SO_HERING ? ['@ciahering.com.br'] : ['@ciahering.com.br','@arezzo.com.br']` e `_dominiosTxt()` (monta "@ciahering.com.br" ou "@ciahering.com.br/@arezzo.com.br" nas mensagens).
- `doSignInMicrosoft()` (as 3 páginas) e `doSignInMicrosoftPessoal()` (kanban) começam com `if(MARE_SO_HERING){ …mensagem "desativado"; return; }`.
- Um e-mail `@arezzo` que chegasse (por qualquer meio) agora **não é confiável** → cai no portão de externos/visualizadores e é barrado com "Acesso restrito a @ciahering.com.br…".
- O `OAuthProvider` e o fallback de redirect **continuam no código** (só ficam sem uso).

### 1.3 Funções (servidor)

`functions/okr/pushMural.js` tinha `const empresa = (email) => /@(ciahering|arezzo)\.com\.br$/i.test(email)` (push do Mural só pra "empresa", não pra freelancer). Agora usa `emailDaEmpresa()` de `functions/common/mareModo.js` (§4).

### 1.4 Regras do banco (`database.rules.json`)

Antes (religado), **60 expressões** (`.read/.write/.validate`) tinham o formato:
```
((auth.token.email.endsWith('@ciahering.com.br')&&auth.token.firebase.sign_in_provider=='google.com')||(auth.token.email.endsWith('@arezzo.com.br')&&auth.token.firebase.sign_in_provider=='microsoft.com'))
```
Agora é só a 1ª metade:
```
(auth.token.email.endsWith('@ciahering.com.br')&&auth.token.firebase.sign_in_provider=='google.com')
```
(removido o trecho `||(auth.token.email.endsWith('@arezzo.com.br')&&auth.token.firebase.sign_in_provider=='microsoft.com')` das 60 ocorrências; JSON validado).

- **Arquivo da versão com Arezzo:** `docs/arezzo/database.rules.com-arezzo.json` (cópia exata das regras de `bcbd200`).
- **Como religar sem copiar o arquivo antigo** (melhor, porque o `database.rules.json` ativo pode ter ganhado regras novas depois):
  ```python
  s = open('database.rules.json', encoding='utf-8').read()
  h = "(auth.token.email.endsWith('@ciahering.com.br')&&auth.token.firebase.sign_in_provider=='google.com')"
  a = "(auth.token.email.endsWith('@arezzo.com.br')&&auth.token.firebase.sign_in_provider=='microsoft.com')"
  assert s.count(h) == 60 or True   # confira o número que aparecer
  s = s.replace(h, '(' + h + '||' + a + ')')
  open('database.rules.json', 'w', encoding='utf-8').write(s)
  ```
  (cada `h` vira `(h||a)` — mesmo desenho de antes: `((hering)||(arezzo))`). Depois `cd functions && npm test` (a matriz de `rules/__tests__/databaseRules.test.js` roda os dois arquivos) e **`firebase deploy --only database`** na máquina do usuário.
- **Teste:** `functions/rules/__tests__/databaseRules.test.js` roda a **mesma matriz ator × operação** contra o arquivo ativo (modo só Hering: a conta `arezzo` sempre negada) e contra o arquivado (`arquivada com Arezzo`: como foi escrita). Se religar, o arquivo ativo passa a ser igual ao arquivado — atualize o teste (remova o `modo === 'só Hering'` que força `arezzo → negado`).

---

## 2. OKR por Torres

### 2.1 O que existia (2026-10-07) e como foi implementado

Várias áreas passaram a usar o OKR, então a base foi dividida em **torres**: 🛒 Digital, 🛍️ Comercial, 🏛️ Corporativa. (CHANGELOG: `okr-dev v2.0` em diante; tasks "OKR por Torres", "Torre como flag do usuário", "Gerências configuráveis por torre".)

**Modelo de dados (Firebase RTDB, tudo sob `kanban/`):**

| Nó | Campo | Significado |
|---|---|---|
| `okr/objetivos/{id}` | `torre` | `'digital'\|'comercial'\|'corporativa'`; **sem o campo = Digital** (tudo o que existia antes) |
| `usuarios/{uid}` | `torre` | torre **da pessoa**; sem o campo = Digital; **`'geral'`** (⭐) só existe pra pessoa — edita/cria em **todas** as torres. Gravado pelo cadastro e pelo ADM em 👥 Global Users (`setGlobalUserTorre`). `gestorOkr` (flag 🎯 Gestor OKR) é outro campo |
| `okr/gerencias/{torre}/{id}` | `{label, icon, ordem, oculta?}` | gerências **configuráveis por torre**; enquanto vazio vale o padrão (`OKR_GERENCIAS_POR_TORRE`: Digital = as 7 de sempre; as outras = só "Geral"). Mudança = 1 transação por torre; na 1ª edição o padrão é copiado pra lá |
| `okr/calendario/eventos/{id}` | `torre` | `''` = agenda **global** (todas as torres); torre preenchida = agenda **local** |
| `okr/mural/{id}` | `torres` | lista de torres alvo; `['*']`/vazio = todas |
| `notif_feed/{id}` | `torres` | idem (feed do sino único) |
| `okr/snapshots/{data}/objetivos/{id}` | `torre` | retrato semanal grava a torre do Objetivo na época (`functions/okr/weeklySnapshot.js`) |

**Permissões (client `okr-dev.html` e espelho em `functions/okr/agenteHelpers.js`):**
- `_okrCanEdit(obj)`: **ADM** ou **Responsável** do Objetivo sempre; senão (`_okrMinhaEhGeral()` ou torre do Objetivo = torre da pessoa) **e** (PO/Organizador de algum squad **ou** 🎯 Gestor OKR).
- `_okrCanCreate(torre)`: ADM; ou (Geral ou mesma torre) **e** (PO/Org ou Gestor OKR).
- `_okrPodeMudarTorre()`: ADM ou torre Geral (muda a torre de um Objetivo na ⚙ Configurações e escolhe a torre ao criar na visão global).

**Telas / funções (`okr-dev.html`; re-grep o nome antes de confiar em linha):**
- Constantes: `OKR_TORRES` (id, label, icon, rgb), `OKR_TORRE_PADRAO='digital'`, `OKR_TORRES_CORTE='2026-10-07T00:00:00'`, `OKR_TORRE_GERAL='geral'`, `OKR_GERENCIAS_POR_TORRE`.
- Helpers: `okrTorreInfo`, `_okrTorreValida`, `_okrTorreDe(o)`, `_okrTorreDoUsuario`, `_okrMinhaTorre`, `_okrMinhaEhGeral`, `_okrTorreParaCriar`, `_okrNaVisao`, `okrGerenciasDa/_okrGerenciasBase/okrGerenciasTodas/_okrGerenciaDe`.
- **Home** (`#okr-home`, `renderOkrHome`): 3 cartões de torre + "Visão global" (cores `--torre`), contagem e barra por torre. **Barra de torre** (`#okr-torre-nav`). `_okrEntrarTorre(id, push)` (`'digital'|'comercial'|'corporativa'|'global'|''`; `?torre=` na URL + `popstate`). **Visão global** = todos os Objetivos separados por cor (`secaoTorres`/`.okr-torre-sec`), Histórico comparativo por torre.
- **Filtros presos ao contexto:** trocar de torre zera `_okrFilter.area/trimestre`, `_okrHistFiltro.*` (achado de `/monitorarbugs`).
- **Cadastro:** `_okrCheckTorrePrompt()`/`_okrAbrirPromptTorre()`/`_okrDefinirMinhaTorre()` — quem se cadastrou a partir de `OKR_TORRES_CORTE` e não tem torre vê uma tela obrigatória "Qual é a sua torre?". **Kanban:** a tela "🙋 Inscrever-se no quadro" (`#insc-torre-wrap`, `#insc-torre`, `_inscPedirTorre`, `mostrarInscricao(user, existe, {pedirTorre})`) pergunta a torre só em cadastro NOVO e grava `torre` em `kanban/usuarios/{uid}`.
- **⚙ Configurações do Objetivo:** campo Torre (`#okr-f-torre` select pra ADM/Geral; senão chip), `_okrMudarTorreDraft` (trocar a torre reseta a gerência pra "Geral"); `_okrAplicarTorreModal(torre)` pinta o modal na cor da torre (`.okr-t-<id>`, `.okr-modal-torre-chip`).
- **⚙ Gerências da torre** (`openOkrGerencias(torre)`, `_okrGerTx`), calendário (`_okrCalTorreFiltro`, agenda por torre), Mural por torre (`_okrAlvoTorres`, publicar "pra torres X"), `_okrFeedPush(tipo, torres, …)`, Histórico (`_okrHistTorreDe`, `_okrHistGlobal`).
- **painel-dev** (👥 Global Users): `GU_TORRES` (inclui `geral`), `_guTorreDe(u)`, select de torre por pessoa (`setGlobalUserTorre`), filtro "Todas as torres" (`_guFilter.torre`).
- **kanban-dev:** entrada da Central de Ajuda "Sua torre (Digital, Comercial ou Corporativa)".
- **`okr-apresentacao.slide.html`:** `OKR_TORRES`, cartões de torre na capa (`.torre-tile`), slide-capa por torre (`key:'torre:<id>'`), chip de torre na gerência, filtro `#tb-torre` e `?torre=`, tabela-resumo por torre; `_okrTorreDe`, `_okrObjetivosAtivos()`.
- **`mare-notif-dev.js` (sino único):** `paraMim(torres)` — ADM, torre ⭐ Geral e visualizador externo veem tudo; os demais, o das suas torres + o dirigido a `'*'`; `st.torre` vem de `kanban/usuarios/{uid}/torre`.

**Cloud Functions:**
- `okr/agenteHelpers.js`: `TORRES`, `TORRE_PADRAO`, `TORRE_INFO`, `torreDe`, `infoUsuario` (lê `role/squads_roles/torre/gestorOkr`), `podeAtuarNaTorre`, `canEditObjetivo`, `canCreateObjetivo`, `torreParaCriar`, `gerenciasDeCfg`.
- `okr/agenteTools.js`: schemas com `torreEnum()` (`z.enum(TORRES)`) nas ferramentas `listar_objetivos`, `listar_gerencias`, `criar_objetivo`, `resumo_atingimentos`, `listar_agenda` (`+ 'global'`); handlers filtram por torre; `criar_objetivo` publica no feed da torre.
- `okr/agentePrompt.js`: parágrafo "O OKR tem 3 torres…" (permissão por torre, perguntar a torre ao criar).
- `okr/dailyScan.js`: o bloco quinzenal já era **só Digital** (`if (o.torre && o.torre !== 'digital') continue`).
- `okr/pushMural.js`: `deveReceber()` — ADM/Geral/aviso `'*'` recebem; senão quem é da torre alvo.
- `okr/calendario.js`: `abrange(ev,o)` (evento local só atinge Objetivo da própria torre), `agendaNome`.

### 2.2 Como foi desligado (modo só Hering)

**`okr-dev.html`** (a página inteira vira "uma torre só"):
- `window.MARE_SO_HERING` no 1º script + CSS injetado: `.ms-login,.okr-so-hering-esconde,#okr-torre-nav,#okr-home,.okr-modal-torre-chip,#hlp-torres,#hlp-faq13{display:none!important}`.
- `OKR_TORRES_TODAS` = as 3; **`OKR_SO_DIGITAL = !!MARE_SO_HERING`**; `OKR_TORRES = OKR_SO_DIGITAL ? [só digital] : TODAS`. Tudo que itera `OKR_TORRES` (home, seletores, filtros, avisos, agenda, ajuda) passa a ver só a Digital.
- `_okrTorreDe(o)` devolve a torre **crua** quando é uma das 3 mas inativa (`'comercial'`…) — **não** normaliza pra Digital; assim todo `…===torreAtual` deixa essas coisas de fora (snapshots do Histórico, Marcos, eventos…). `_okrSoAtivo(x)` = "sem `torre`, ou torre ativa".
- **Rótulo (okr-dev v2.45):** no modo só Hering a torre única é mapeada em `OKR_TORRES` pra `{label:'Digital Hering 🐟', icon:''}` e o helper `okrTorreTitulo(id)` (`_okrTorreTitulo` em `okr-apresentacao.slide.html`) devolve só esse rótulo; com o interruptor desligado volta `🛒 Torre Digital`. Todo texto novo que cite a torre deve usar o helper, não `icon+' Torre '+label` na mão.
- `let _okrTorreAtual = OKR_SO_DIGITAL ? 'digital' : ''` (já nasce dentro da Digital) e `_okrEntrarTorre()` força `id='digital'` (`?torre=comercial`, `'global'` e `''` caem na Digital).
- **Filtro nos 3 listeners** (os dados nem entram no cache): `loadOkr()` (Objetivos), `loadOkrMural()` (avisos dirigidos só a outra torre — helper `_okrAlvoTorresBruto`), `loadOkrCalendario()` (eventos de outra torre; a agenda global e a Digital ficam).
- `_okrCheckTorrePrompt()` retorna cedo (ninguém é perguntado). `_okrTorreCampoHtml(d)` (campo "Torre" da ⚙ Config) não é renderizado.
- Ajuda do OKR: `#hlp-torres` e `#hlp-faq13` escondidos; "O que eu posso fazer?" (`_okrHelpPerfil`) fala "os Objetivos" em vez de "as 3 torres / Visão global".
- `_okrPessoaOptions()` (responsável, participante, @menção das Anotações) só oferece `@ciahering.com.br` (§3).

**`painel-dev.html`:** chip "Arezzo" sai de `GU_EMPRESAS`; seletor de torre por pessoa e filtro "Todas as torres" do 👥 Global Users somem; `setGlobalUserTorre()` responde "modo só Hering" e não grava.

**`kanban-dev.html`:** `_inscPedirTorre = !MARE_SO_HERING && …` (inscrição não pergunta a torre); a entrada "Sua torre…" é removida do `HELP_CONTENT` na carga.

**`okr-apresentacao.slide.html`** (compartilhada): `OKR_TORRES_TODAS`, `const MARE_SO_HERING = true`, `OKR_TORRES` só Digital, `_okrTorreDe` crua pra inativa, e `_okrObjetivosAtivos()` só aceita `_okrTorreDe(o)==='digital'`. (Ainda aparece 1 cartão "Digital" na capa e o slide-capa "Torre Digital" — é o mesmo deck de antes com uma torre só.)

**`mare-notif-dev.js`:** `SO_HERING` (lê `window.MARE_SO_HERING`, padrão `true`): `paraMim(torres)` = só `'*'` ou `'digital'` — evento dirigido só a outra torre não aparece pra ninguém (nem ADM). `?v=7` → `?v=8` nas páginas.

**Funções:** `functions/common/mareModo.js` exporta `MARE_SO_HERING`, `DOMINIOS_EMPRESA`, `TORRES_ATIVAS`, `emailDaEmpresa()`, `torreAtiva()` (lê o campo **cru**). Usado por: `agenteHelpers` (`TORRES = TORRES_ATIVAS`; `resolveObjetivo` não acha Objetivo de torre inativa), `agenteTools` (3 loaders + `listar_agenda` filtram por `torreAtiva`; o `z.enum` de torre fica só `['digital']`), `agentePrompt` (bloco único: "O OKR é da torre Digital… não mencione Comercial/Corporativa"), `dailyScan` (Objetivos/eventos de outra torre invisíveis ao scan), `pushMural` (`deveReceber` descarta aviso dirigido só a outra torre; `empresa = emailDaEmpresa`).

---

## 3. Menção só a Hering

**O que existe:** autocomplete de `@` (kanban: comentários/descrições; OKR: Anotações da reunião) e as listas de pessoas (responsável, participante). Antes: qualquer pessoa com registro (inclusive `@arezzo.com.br` e freelancers `@gmail`).

**Como ficou:**
- **kanban-dev:** `_mencionavelNoModo(m)` = `!MARE_SO_HERING || m.isAgent || !m.email || /@ciahering\.com\.br$/i.test(m.email)`; aplicado em `mentionCandidates()` (a entrada `@todos` e o Agente Ágil continuam). ⚠️ Isso também tira **freelancers/externos autorizados** (gmail etc.) do autocomplete de @menção do kanban — se quiser mantê-los, troque o teste por "não é `@arezzo`" (ou use `_isTrustedDomainEmail` + whitelist).
- **okr-dev:** `_okrPessoaOptions()` filtra `!OKR_SO_DIGITAL || !u.email || /@ciahering\.com\.br$/i.test(u.email)`.
- **Não** bloqueia a **notificação**: se o texto já traz um nome (digitado à mão), `parseMentions()` ainda notifica. Foi uma escolha explícita (pergunta de 2026-10-08).

---

## 4. Interruptores — onde está cada um (para religar)

`grep -rn "MARE_SO_HERING" --include=*.html --include=*.js .` lista tudo. **Todos precisam ficar iguais** (`true` = só Hering, `false` = religado):

| Arquivo | Onde | Valor atual |
|---|---|---|
| `kanban-dev.html` | 1º `<script>`: `window.MARE_SO_HERING = true;` | `true` |
| `painel-dev.html` | idem | `true` |
| `okr-dev.html` | idem (e `OKR_SO_DIGITAL` deriva dele) | `true` |
| `okr-apresentacao.slide.html` | `const MARE_SO_HERING = true;` (perto de `OKR_TORRES`) | `true` |
| `mare-notif-dev.js` | `SO_HERING` lê `window.MARE_SO_HERING` (se não existir, `true`) | acompanha a página |
| `functions/common/mareModo.js` | `const MARE_SO_HERING = process.env.MARE_MODO_TESTE === 'varias-torres' ? false : true;` | `true` |
| `database.rules.json` | sem variável — o arquivo **é** o interruptor (§1.4) | só Hering |

Os `kanban.html`, `painel.html`, `okr.html`, `mare-notif.js` (prod) **não têm** o interruptor ainda — serão iguais ao dev depois da promoção (§6).

### Passo a passo pra RELIGAR (Arezzo + torres)

1. **Pré-requisitos externos:** Azure/Entra e provider Microsoft no Firebase Console (§1.1) — confirmar que continuam ativos.
2. **HTML:** trocar `true` → `false` nos 4 HTML da tabela (ou nos 8 se já promoveu pra prod: `kanban(.html|-dev)`, `painel`, `okr`, apresentação). Subir `mare-notif*.js?v=` +1.
3. **Funções:** em `functions/common/mareModo.js` trocar o `true` final por `false` (`const MARE_SO_HERING = false;`) e publicar **só** as funções que importam o arquivo (depois do *resync* do clone local, ver `CLAUDE.md`):
   ```bash
   cd C:\caminho\hering && git fetch origin <branch> && git reset --hard origin/<branch>
   cd functions && npm install
   firebase deploy --only functions:sendPushOnMural,functions:okrDailyScan,functions:okrAgenteChat
   ```
4. **Regras:** aplicar o §1.4 (python) **ou** copiar `docs/arezzo/database.rules.com-arezzo.json` por cima (se as regras não mudaram desde 2026-10-08) e `firebase deploy --only database`.
5. **Testes:** `cd functions && npm test` (as suítes `agenteTorres/calendario/dailyScan/pushMural` já rodam com `MARE_MODO_TESTE=varias-torres`, que reproduz o modo religado; `modoSoHering.test.js` passa a falhar de propósito — atualize/remova); no navegador, rodar as suítes do OKR contra a página religada.
6. **Conferir no navegador:** login Microsoft aparece e entra; `?torre=comercial` abre a Comercial; home com 3 torres; cadastro novo pergunta a torre; 👥 Global Users mostra o seletor de torre e o chip Arezzo.
7. **Docs/ajuda:** voltam sozinhas (`#hlp-torres`, "Sua torre…" etc. só estavam escondidas).

---

## 5. O que foi testado (e onde)

- `functions/` — `npm test`: **matriz de regras nos dois arquivos** (`rules/__tests__/databaseRules.test.js`), `okr/__tests__/modoSoHering.test.js` (modo atual) e as 4 suítes legadas com `MARE_MODO_TESTE=varias-torres` (modo religado).
- Navegador (Playwright + Firebase falso; scripts na pasta de trabalho da sessão, não versionados): `test_so_hering.js` (okr-dev: login, uma torre só, dados de outra torre invisíveis em lista/calendário/histórico/mural, sem pergunta de torre, pessoas só Hering, conta Arezzo barrada), `test_so_hering_kanban_painel.js` (login, domínios, menção, inscrição, ajuda, filtros do Global Users); e as suítes antigas do OKR (`head/page/torres/gerencias/calendario/help/modal_edicao`) rodando **com o interruptor virado pra `false`** — todas passam, o que prova que religar devolve o comportamento anterior.

## 5.1 Auditoria `/monitorarbugs` pós-implementação (2026-10-08)

Achados corrigidos depois da promoção: (a) `pushMural.deveReceber()` agora trata a flag de torre antiga como Digital no modo só Hering (antes: pessoa com `torre:'comercial'` via o aviso no sino e não recebia o push); (b) `_loginProviderMismatchMsg()` não manda mais conta `@arezzo` pro botão Microsoft escondido; (c) `_okrSoAtivo()`/`torreAtiva()` só escondem Comercial/Corporativa de verdade (torre desconhecida = Digital). Pra **religar** lembre que a apresentação tem a própria constante (`const MARE_SO_HERING` em `okr-apresentacao.slide.html`) — com só o `okr-dev` virado, os testes de gerências da apresentação ainda falham.

## 6. Pendências / cuidados

- **Produção ainda não mudou.** `kanban.html`, `painel.html`, `okr.html` e `mare-notif.js` seguem como estavam (com Arezzo/Microsoft e 3 torres) até alguém autorizar a promoção (`/subirproprod`, fluxo normal do `CLAUDE.md`).
- **Ordem de publicação recomendada:** (1) promover as páginas pra prod (botão Microsoft some), (2) `firebase deploy --only database`, (3) funções. Se publicar as **regras antes das páginas**, quem estiver com a página antiga e entrar pela Microsoft verá o app vazio (permissão negada) — é o efeito desejado, mas sem a explicação amigável.
- **`okr-apresentacao.slide.html` vai ao ar assim que for mergeado** (sem cópia dev) — já fica só com a Digital.
- **Contas já cadastradas de `@arezzo`** continuam em `kanban/usuarios` (e `usuarios_publicos`); perdem o acesso pelas regras mas o registro fica. Se quiser limpar, é manual (👥 Global Users → excluir).
- **Torre ⭐ Geral:** no modo só Hering quem tem `torre:'geral'` age como qualquer outra pessoa da Digital (PO/Organizador/Gestor OKR editam Objetivos Digitais; ADM edita tudo).
- **`guia-okr.html`, `maredigital.html` e textos de ajuda in-app** ainda descrevem as 3 torres/Arezzo em vários trechos (só os itens `#hlp-torres`/`#hlp-faq13`/"Sua torre…" foram escondidos). Revisar se a ideia for apresentar o OKR como definitivo.
- **Agente Ágil do kanban** (orquestrador de card) e `weeklySnapshot` não foram alterados (não dependem de domínio Arezzo nem de torre além do campo `torre` gravado no snapshot).
